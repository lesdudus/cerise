import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, setEntry, setTargets } from '../src/model.mjs';
import { mergeJournal, sameState } from '../src/cloud-state.mjs';
import { createCloudRepository, cloudKey } from '../src/cloud-repository.mjs';
import { createTransport, loginErrorMessage } from '../src/supabase.js';

test('Cloud merge combines independent edits, preserving null and zero', () => {
  const base = initialState();
  const local = setEntry(base, '2026-09-22', 'breakfast', 'calories', 0);
  const remote = setEntry(base, '2026-09-22', 'breakfast', 'protein', 20);
  const merged = mergeJournal(base, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.state.days['2026-09-22'].breakfast, { calories: 0, protein: 20 });
  assert.ok(sameState(merged.state, setEntry(remote, '2026-09-22', 'breakfast', 'calories', 0)));
});

test('Cloud merge detects competing edits and delete-versus-edit conflicts', () => {
  const base = setEntry(initialState(), '2026-09-22', 'lunch', 'calories', 400);
  const local = setEntry(base, '2026-09-22', 'lunch', 'calories', null);
  const remote = setEntry(base, '2026-09-22', 'lunch', 'calories', 500);
  assert.deepEqual(mergeJournal(base, local, remote).conflicts, ['2026-09-22/lunch/calories']);
  assert.ok(sameState(mergeJournal(base, local, base).state, local));
  assert.deepEqual(mergeJournal(base, remote, remote).conflicts, []);
});

test('Cloud merge preserves history and flags conflicting target changes', () => {
  const base = initialState();
  const local = setTargets(base, '2026-09-22', 1600, 120);
  const remote = setTargets(base, '2026-09-23', 1700, 130);
  assert.equal(mergeJournal(base, local, remote).state.targets.length, 3);
  assert.deepEqual(mergeJournal(base, local, setTargets(base, '2026-09-22', 1800, 140)).conflicts, ['2026-09-22/targets']);
  assert.ok(sameState(base, structuredClone(base)));
  assert.ok(!sameState(base, local));
});

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('Login errors distinguish rejected credentials, configuration, network and service failures without exposing responses', () => {
  assert.match(loginErrorMessage({ code: 'invalid_credentials', status: 400 }), /mot de passe incorrect/);
  assert.match(loginErrorMessage({ code: 'email_not_confirmed' }), /confirmée/);
  assert.match(loginErrorMessage({ code: 'email_provider_disabled' }), /désactivée/);
  assert.match(loginErrorMessage({ status: 429 }), /Trop de tentatives/);
  assert.match(loginErrorMessage({ name: 'AuthRetryableFetchError', status: 0 }), /injoignable/);
  assert.match(loginErrorMessage({ name: 'TimeoutError' }), /injoignable/);
  assert.match(loginErrorMessage({ name: 'AuthRetryableFetchError', status: 503 }), /service de connexion rencontre une erreur/);
  assert.match(loginErrorMessage({ code: 'unexpected_failure', status: 422, message: 'private response' }), /unexpected_failure · HTTP 422/);
  assert.doesNotMatch(loginErrorMessage({ code: '<private>', message: 'private response' }), /private/);
  assert.match(loginErrorMessage(new TypeError('private details')), /dans l’application/);
});

test('Cloud transport pins the owner token and rejects changed or expired sessions', async () => {
  let session = { user: { id: 'first' }, access_token: 'first-test-token' };
  let calls = 0;
  const client = {
    auth: { async getSession() { return { data: { session }, error: null }; } },
    rpc(name, args) {
      calls += 1;
      session = { user: { id: 'second' }, access_token: 'second-test-token' };
      return { setHeader(header, value) {
        assert.equal(header, 'Authorization');
        assert.equal(value, 'Bearer first-test-token');
        return Promise.resolve({ data: { name, args }, error: null });
      } };
    },
  };
  const transport = createTransport('first', client);
  assert.equal((await transport.read()).name, 'cerise_read_journal');
  await assert.rejects(transport.save(0, initialState(), 'operation'));
  session = null;
  await assert.rejects(transport.read());
  assert.equal(calls, 1);
});

test('Cloud repository retains offline drafts, recovers lost responses and isolates accounts', async () => {
  const storage = memoryStorage();
  let remote = { revision: 0, state: initialState() };
  let offline = true;
  let loseResponse = true;
  const transport = {
    async read() { if (offline) throw new Error('offline'); return structuredClone(remote); },
    async save(revision, state) {
      assert.equal(revision, remote.revision);
      remote = { revision: revision + 1, state: structuredClone(state) };
      if (loseResponse) { loseResponse = false; throw new Error('connection lost'); }
      return remote;
    },
  };
  const repository = createCloudRepository({ owner: 'first', storage, transport });
  const second = createCloudRepository({ owner: 'second', storage, transport });
  try {
    repository.update(state => setEntry(state, '2026-09-22', 'breakfast', 'calories', 0));
    await repository.sync();
    assert.equal(repository.load().days['2026-09-22'].breakfast.calories, 0);
    assert.deepEqual(second.load(), initialState());
    offline = false;
    await repository.sync();
    assert.equal(remote.revision, 1);
    await repository.sync();
    assert.equal(remote.revision, 1);
    assert.equal(repository.details().status, 'Synchronisé');
    assert.equal(storage.getItem(cloudKey('second')), null);
  } finally { repository.dispose(); second.dispose(); }
});

test('Cloud repository handles edits during a save and explicit conflicts', async () => {
  const storage = memoryStorage();
  let remote = { revision: 0, state: initialState() };
  let duringSave;
  const transport = {
    async read() { return structuredClone(remote); },
    async save(revision, state) {
      assert.equal(revision, remote.revision);
      remote = { revision: revision + 1, state: structuredClone(state) };
      duringSave?.();
      duringSave = null;
      return structuredClone(remote);
    },
  };
  const repository = createCloudRepository({ owner: 'first', storage, transport });
  try {
    repository.update(state => setEntry(state, '2026-09-22', 'breakfast', 'calories', 400));
    duringSave = () => repository.update(state => setEntry(state, '2026-09-22', 'lunch', 'protein', 30));
    await repository.sync();
    assert.equal(repository.load().days['2026-09-22'].lunch.protein, 30);
    await repository.sync();
    assert.equal(remote.state.days['2026-09-22'].lunch.protein, 30);
    repository.update(state => setEntry(state, '2026-09-22', 'breakfast', 'calories', 500));
    remote = { revision: 3, state: setEntry(remote.state, '2026-09-22', 'breakfast', 'calories', 600) };
    await repository.sync();
    assert.equal(repository.details().conflict.fields.length, 1);
    assert.equal(remote.state.days['2026-09-22'].breakfast.calories, 600);
    repository.resolve('remote');
    await repository.sync();
    assert.equal(repository.load().days['2026-09-22'].breakfast.calories, 600);
    assert.equal(repository.details().conflict, null);
  } finally { repository.dispose(); }
});

test('Cloud repository fails closed on corrupted storage and ignores disposed requests', async () => {
  const storage = memoryStorage();
  let resolveRead;
  const transport = { read: () => new Promise(resolve => { resolveRead = resolve; }) };
  const repository = createCloudRepository({ owner: 'first', storage, transport });
  const pending = repository.sync();
  repository.dispose();
  resolveRead({ revision: 0, state: initialState() });
  await pending;
  assert.equal(storage.getItem(cloudKey('first')), null);
  storage.setItem(cloudKey('first'), '{bad');
  assert.throws(() => repository.load());
  assert.throws(() => repository.save(initialState()));
});