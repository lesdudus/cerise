import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, parseAmount, setEntry, setTargets, targetsFor, daySummary, periodSummary, importState, validateState, validDate, shiftDate, localDate, createRepository, STORAGE_KEY } from '../src/model.mjs';
import { messages, messageFor } from '../src/messages.mjs';

test('Les pensées quotidiennes restent stables et tournent sans répétition immédiate', () => {
  assert.ok(messages.length >= 60);
  assert.equal(new Set(messages).size, messages.length);
  assert.equal(messageFor('2026-09-21'), messageFor('2026-09-21'));
  assert.notEqual(messageFor('2026-09-21'), messageFor('2026-09-22'));
  const cycle = Array.from({ length: messages.length }, (_, index) => messageFor(shiftDate('2026-09-01', index)));
  assert.equal(new Set(cycle).size, messages.length);
});

test('Les champs vides restent absents, zéro reste une valeur saisie', () => {
  const state = setEntry(initialState(), '2026-09-21', 'breakfast', 'calories', 0);
  assert.deepEqual(daySummary(state, '2026-09-21'), { calories: { total: 0, count: 1 }, protein: { total: null, count: 0 } });
  const proteinOnly = setEntry(initialState(), '2026-09-21', 'lunch', 'protein', 25.5);
  assert.equal(daySummary(proteinOnly, '2026-09-21').calories.total, null);
  assert.equal(daySummary(proteinOnly, '2026-09-21').protein.total, 25.5);
  assert.deepEqual(setEntry(state, '2026-09-21', 'breakfast', 'calories', null), initialState());
});

test('La saisie française accepte une virgule et rejette les valeurs invalides', () => {
  assert.equal(parseAmount(' 25,5 '), 25.5);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('0'), 0);
  for (const invalid of ['-1', 'NaN', 'Infinity', '1e3', '2.222', '12abc', '1000001']) assert.throws(() => parseAmount(invalid));
});

test('Les moyennes excluent les jours sans données, mais incluent zéro', () => {
  let state = setEntry(initialState(), '2026-09-20', 'breakfast', 'calories', 400);
  state = setEntry(state, '2026-09-21', 'lunch', 'calories', 0);
  state = setEntry(state, '2026-09-21', 'lunch', 'protein', 30);
  const period = periodSummary(state, '2026-09-21', 7);
  assert.equal(period.metrics.calories.average, 200);
  assert.equal(period.metrics.calories.logged, 2);
  assert.equal(period.metrics.calories.partial, 2);
  assert.equal(period.metrics.protein.average, 30);
  assert.equal(period.loggedDays, 2);
  assert.equal(period.days[0].calories.total, null);
});

test('Les objectifs datés ne modifient pas le passé', () => {
  let state = setTargets(initialState(), '2026-09-21', 1700, 120);
  assert.equal(targetsFor(state, '2026-09-20').calories, 1500);
  assert.equal(targetsFor(state, '2026-09-21').calories, 1700);
  state = setTargets(state, '2026-09-21', 1800, 125);
  assert.equal(state.targets.length, 2);
  assert.equal(targetsFor(state, '2026-09-22').protein, 125);
  assert.throws(() => setTargets(state, '2026-09-21', 0, 125));
});

test('Les sauvegardes sont validées avant remplacement', () => {
  const state = setEntry(initialState(), '2026-09-21', 'snack', 'protein', 12.5);
  assert.deepEqual(importState(JSON.stringify(state)), state);
  assert.throws(() => importState('{broken'));
  assert.throws(() => importState(JSON.stringify({ ...state, version: 2 })));
  assert.throws(() => validateState({ ...state, days: { '__proto__': null, 'not-a-date': {} } }));
  assert.throws(() => validateState({ ...state, days: { '2026-02-30': {} } }));
  assert.throws(() => validateState({ ...state, days: { '2026-09-21': { snack: { protein: -1, calories: null } } } }));
  assert.throws(() => validateState({ ...state, targets: [] }));
  assert.throws(() => validateState({ ...state, targets: [...state.targets, ...state.targets] }));
});

test('Le calendrier utilise la date locale et traverse les mois', () => {
  assert.equal(localDate(new Date(2026, 8, 21, 23, 59)), '2026-09-21');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(validDate('2026-02-29'), false);
});

test('Le stockage fusionne les mises à jour et signale ses échecs', () => {
  const items = new Map();
  const storage = { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
  const first = createRepository(storage);
  const second = createRepository(storage);
  first.update(state => setEntry(state, '2026-09-21', 'breakfast', 'calories', 350));
  second.update(state => setEntry(state, '2026-09-21', 'dinner', 'protein', 40));
  assert.equal(first.load().days['2026-09-21'].breakfast.calories, 350);
  assert.equal(first.load().days['2026-09-21'].dinner.protein, 40);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => first.save(initialState()));
  items.set(STORAGE_KEY, '{broken');
  assert.throws(() => first.load());
});