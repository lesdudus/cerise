import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { initialState, setEntry, setTargets } from '../src/model.mjs';

test('PostgreSQL enforces ownership, atomic revisions, validation and idempotent retry', async () => {
  const database = new PGlite();
  const owner = randomUUID();
  const other = randomUUID();
  try {
    await database.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth, public to anon, authenticated;
      insert into auth.users values ('${owner}'), ('${other}');`);
    await database.exec(await readFile(new URL('../supabase/migrations/202609220001_cerise.sql', import.meta.url), 'utf8'));
    const identity = async (role, user = '') => {
      await database.exec(`reset role; set role ${role};`);
      await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    };
    const read = async () => (await database.query('select public.cerise_read_journal() as journal')).rows[0].journal;
    const save = async (revision, state, operation = randomUUID()) => (await database.query('select public.cerise_save_journal($1, $2, $3) as journal', [revision, operation, JSON.stringify(state)])).rows[0].journal;
    const denied = async operation => assert.rejects(operation, error => error.code === '42501');
    await identity('anon');
    await denied(read);
    await denied(() => save(0, initialState()));
    for (const table of ['cerise_journals', 'cerise_meals', 'cerise_targets']) {
      await denied(() => database.query(`select * from ${table}`));
      await denied(() => database.query(`delete from ${table}`));
      await denied(() => database.query(`update ${table} set user_id = '${owner}'`));
      await denied(() => database.query(`insert into ${table} default values`));
    }
    await identity('authenticated', owner);
    assert.deepEqual(await read(), { revision: 0, state: initialState() });
    const state = setTargets(setEntry(initialState(), '2026-09-22', 'breakfast', 'calories', 0), '2026-09-22', 1600, 120);
    const operation = randomUUID();
    assert.deepEqual(await save(0, state, operation), { revision: 1, state });
    assert.deepEqual(await save(0, state, operation), { revision: 1, state });
    await assert.rejects(() => save(0, initialState()), error => error.code === '40001');
    const invalid = structuredClone(state);
    invalid.days['2026-09-22'].breakfast.calories = -1;
    await assert.rejects(() => save(1, invalid));
    for (const amount of [1.234, '123', 1000001]) {
      invalid.days['2026-09-22'].breakfast.calories = amount;
      await assert.rejects(() => save(1, invalid));
    }
    await assert.rejects(() => save(1, { ...state, targets: [] }));
    await assert.rejects(() => save(1, { ...state, targets: [state.targets[1]] }));
    assert.deepEqual(await read(), { revision: 1, state });
    for (const table of ['cerise_journals', 'cerise_meals', 'cerise_targets']) {
      await denied(() => database.query(`delete from ${table}`));
      await denied(() => database.query(`update ${table} set user_id = '${other}'`));
      await denied(() => database.query(`insert into ${table} default values`));
    }
    await identity('authenticated', other);
    for (const table of ['cerise_journals', 'cerise_meals', 'cerise_targets']) {
      assert.equal((await database.query(`select * from ${table}`)).rows.length, 0);
    }
    assert.deepEqual(await read(), { revision: 0, state: initialState() });
    await save(0, initialState());
    await identity('authenticated', owner);
    assert.deepEqual(await read(), { revision: 1, state });
    assert.deepEqual(await save(1, initialState()), { revision: 2, state: initialState() });
    await identity('authenticated');
    await denied(read);
    await denied(() => save(0, initialState()));
  } finally { await database.close(); }
});