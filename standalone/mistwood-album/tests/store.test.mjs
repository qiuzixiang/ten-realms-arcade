import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Store = require('../src/store.js');
const Rules = require('../src/rules.js');
const level = Object.assign({ id: 'store-cross', rows: ['.#.', '###', '.#.'] }, Rules.clues(['.#.', '###', '.#.']));
const other = Object.assign({ id: 'store-box', rows: ['###', '#.#', '###'] }, Rules.clues(['###', '#.#', '###']));
const day = '2026-09-08';
const lookup = (id, mode, date) => mode === 'daily' ? (date === day && id === level.id ? level : null) : [level, other].find(item => item.id === id);
const copy = value => JSON.parse(JSON.stringify(value));

function memory() {
  const data = new Map();
  return {
    data, writes: 0, failGet: false, failSet: false,
    getItem(key) { if (this.failGet) throw new Error('read denied'); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { this.writes += 1; if (this.failSet) throw new Error('quota exceeded'); data.set(key, value); }
  };
}
function solved(target = level, mode = 'story', date = '', hinted = false) {
  let session = Store.newSession(target, mode, date);
  if (hinted) session = Store.addHint(session);
  target.rows.join('').split('').forEach((symbol, index) => { session = Store.setCell(session, target, index, symbol === '#' ? 1 : 2); });
  assert.equal(Rules.complete(target, session.grid), true);
  return session;
}
function finish(state = Store.emptyState(), session = solved(), target = level) {
  return Store.settle(state, session, target, undefined, lookup);
}

test('storage keys are private and tutorial version is independent', () => {
  assert.equal(Store.PREFIX, 'mini-polish:mistwood-album:v1:');
  assert.equal(Store.KEY, Store.PREFIX + 'state');
  assert.equal(Store.TUTORIAL_KEY, Store.PREFIX + 'tutorial:v1');
  assert.notEqual(Store.KEY, Store.TUTORIAL_KEY);
});

test('immutable actions retain unknown, filled and excluded; illegal/no-op inputs do not count', () => {
  const start = Store.newSession(level);
  const fill = Store.setCell(start, level, 0, 1);
  const exclude = Store.setCell(fill, level, 0, 2);
  const erase = Store.setCell(exclude, level, 0, 0);
  assert.equal(start.grid[0], 0);
  assert.equal(fill.grid[0], 1);
  assert.equal(exclude.grid[0], 2);
  assert.equal(erase.grid[0], 0);
  assert.equal(erase.moves, 3);
  for (const [index, value] of [[0, 0], [-1, 1], [9, 1], [0.5, 1], [0, 3], [0, '1'], [Infinity, 1]]) {
    assert.equal(Store.setCell(erase, level, index, value), erase);
  }
  assert.equal(Store.setCell(erase, other, 1, 1), erase);
});

test('undo replays previous values but preserves historical moves and hint use', () => {
  const initial = Store.newSession(level);
  assert.equal(Store.undo(initial, level), initial);
  let session = Store.setCell(initial, level, 0, 1);
  session = Store.addHint(session);
  session = Store.setCell(session, level, 0, 2);
  session = Store.undo(session, level);
  assert.equal(session.grid[0], 1);
  assert.equal(session.moves, 2);
  assert.equal(session.hints, 1);
  assert.equal(session.undos, 1);
  session = Store.undo(session, level);
  assert.deepEqual(session.grid, Rules.blank(level));
  assert.equal(session.history.length, 0);
  assert.equal(session.hints, 1);
  assert.deepEqual(Store.restoreSession(copy(session), lookup), session);
});

test('restoration reconstructs board, history and metrics; cached flags and claims have no authority', () => {
  let session = Store.setCell(Store.newSession(level), level, 1, 1);
  session = Store.addHint(session);
  const forged = Object.assign(copy(session), { grid: Array(9).fill(1), history: [], hints: 0, moves: 999, complete: true, claims: ['free'] });
  assert.deepEqual(Store.restoreSession(forged, lookup), session);
  const state = Store.restore({ version: 1, current: forged, records: [], claims: ['free'], outbox: [{ rewardClaims: ['free'] }] }, lookup);
  assert.deepEqual(state.current, session);
  assert.deepEqual(state.claims, []);
  assert.deepEqual(state.outbox, []);
});

test('invalid replay actions, impossible undo, run metadata and unknown levels are rejected', () => {
  const initial = Store.newSession(level);
  const actions = [
    [{ type: 'undo' }], [{ type: 'set', index: 9, value: 1 }],
    [{ type: 'set', index: 0, value: 0 }], [{ type: 'set', index: 0, value: 7 }],
    [{ type: 'set', index: '0', value: 1 }], [{ type: 'award' }], [null],
    [{ type: 'set', index: 0, value: 1 }, { type: 'set', index: 0, value: 1 }]
  ];
  for (const log of actions) assert.equal(Store.restoreSession(Object.assign(copy(initial), { actions: log }), lookup), null);
  for (const patch of [{ actions: 'bad' }, { runId: '' }, { runId: '../other' }, { mode: 'win' }, { levelId: 'missing' }, { startedAt: 'not-a-time' }, { mode: 'daily', day: '2026-02-31' }]) {
    assert.equal(Store.restoreSession(Object.assign(copy(initial), patch), lookup), null);
  }
  assert.throws(() => Store.newSession(level, 'daily', '2026-02-31'), TypeError);
});

test('unfinished grid and a forged completed grid without actions cannot settle', () => {
  const initial = Store.newSession(level);
  assert.equal(finish(Store.emptyState(), initial).completed, false);
  const forged = Object.assign(copy(initial), { grid: solved().grid, complete: true, moves: 9, rewardClaims: ['free'] });
  const result = finish(Store.emptyState(), forged);
  assert.equal(result.completed, false);
  assert.equal(result.state.records.length, 0);
  assert.deepEqual(result.state.claims, []);
});

test('a real completion produces the strict payload, verified record and stable reward IDs', () => {
  const session = solved();
  const result = finish(Store.emptyState(), session);
  assert.equal(result.completed, true);
  assert.equal(result.duplicate, false);
  assert.deepEqual(Object.keys(result.payload).sort(), ['schemaVersion', 'gameId', 'levelId', 'mode', 'runId', 'completionId', 'rewardClaims', 'metrics', 'completedAt'].sort());
  assert.equal(result.payload.schemaVersion, 1);
  assert.equal(result.payload.gameId, 'mistwood-album');
  assert.equal(result.payload.completionId, 'mistwood-album:complete:' + session.runId);
  assert.deepEqual(result.payload.metrics, { moves: 9, hints: 0, undos: 0 });
  assert.deepEqual(result.payload.rewardClaims, ['mistwood-album:photo:store-cross', 'mistwood-album:independent:store-cross']);
  assert.deepEqual(result.state.outbox, [result.payload]);
  assert.deepEqual(Store.restore(copy(result.state), lookup), result.state);
});

test('repeated settlement and refresh are idempotent; restart gets a new run with no duplicate claims', () => {
  const firstSession = solved();
  const first = finish(Store.emptyState(), firstSession);
  const repeated = finish(Store.restore(copy(first.state), lookup), firstSession);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.state.records.length, 1);
  assert.deepEqual(repeated.payload, first.payload);
  const replay = solved(level, 'replay');
  assert.notEqual(firstSession.runId, replay.runId);
  const second = finish(repeated.state, replay);
  assert.equal(second.state.records.length, 2);
  assert.deepEqual(second.payload.rewardClaims, []);
  assert.equal(second.state.claims.length, 2);
});

test('independent completion can be earned on replay after a hinted first win', () => {
  const first = finish(Store.emptyState(), solved(level, 'story', '', true));
  assert.deepEqual(first.payload.rewardClaims, ['mistwood-album:photo:store-cross']);
  const second = finish(first.state, solved(level, 'replay'));
  assert.deepEqual(second.payload.rewardClaims, ['mistwood-album:independent:store-cross']);
  assert.equal(second.state.records[0].hints, 1);
  assert.equal(second.state.records[1].hints, 0);
});

test('daily first-win claim is stable across runs and daily level/date mismatches are rejected', () => {
  const session = solved(level, 'daily', day);
  const first = finish(Store.emptyState(), session);
  assert.equal(first.completed, true);
  assert.ok(first.payload.rewardClaims.includes('mistwood-album:daily:' + day));
  const second = finish(first.state, solved(level, 'daily', day));
  assert.deepEqual(second.payload.rewardClaims, []);
  assert.equal(Store.restoreSession(Object.assign(copy(session), { day: '2026-09-09' }), lookup), null);
  assert.equal(Store.restoreSession(Object.assign(copy(session), { levelId: other.id }), lookup), null);
});

test('record evidence is revalidated and malformed or duplicate records cannot award progress', () => {
  const valid = finish().state;
  const fake = Object.assign(copy(Store.newSession(other)), { completedAt: new Date().toISOString(), complete: true, rewardClaims: ['free'], grid: solved(other).grid });
  const raw = copy(valid);
  raw.records.push(fake, copy(raw.records[0]));
  raw.claims = ['free'];
  raw.outbox = [{ completionId: 'forged', rewardClaims: ['free'] }];
  raw.acked = ['forged'];
  const restored = Store.restore(raw, lookup);
  assert.equal(restored.records.length, 1);
  assert.deepEqual(restored.claims, valid.claims);
  assert.deepEqual(restored.outbox, valid.outbox);
  assert.deepEqual(restored.acked, []);
  assert.deepEqual(Store.restore({ version: 99, records: raw.records }, lookup), Store.emptyState());
});

test('a cached no-hint counter cannot erase hint events when restoring completed records', () => {
  const state = finish(Store.emptyState(), solved(level, 'story', '', true)).state;
  state.records[0].hints = 0;
  state.records[0].rewardClaims.push('mistwood-album:independent:store-cross');
  state.claims.push('mistwood-album:independent:store-cross');
  const restored = Store.restore(state, lookup);
  assert.equal(restored.records[0].hints, 1);
  assert.deepEqual(restored.claims, ['mistwood-album:photo:store-cross']);
});

test('corrupt or inaccessible storage falls back without removing unrelated or tutorial keys', () => {
  const storage = memory();
  storage.data.set('another-game:save', 'keep');
  storage.data.set(Store.TUTORIAL_KEY, 'read');
  storage.data.set(Store.KEY, '{broken');
  assert.deepEqual(Store.load(storage, lookup), Store.emptyState());
  assert.equal(storage.data.get(Store.KEY), '{broken');
  assert.equal(storage.data.get('another-game:save'), 'keep');
  assert.equal(storage.data.get(Store.TUTORIAL_KEY), 'read');
  storage.failGet = true;
  assert.deepEqual(Store.load(storage, lookup), Store.emptyState());
  storage.failGet = false;
  assert.equal(Store.save(storage, finish().state).ok, true);
  assert.equal(storage.data.get('another-game:save'), 'keep');
  assert.equal(storage.data.get(Store.TUTORIAL_KEY), 'read');
});

test('save failure is explicit and preserves prior persisted state', () => {
  const storage = memory();
  Store.save(storage, Store.emptyState());
  const before = storage.data.get(Store.KEY);
  storage.failSet = true;
  assert.deepEqual(Store.save(storage, finish().state), { ok: false, error: 'quota exceeded' });
  assert.equal(storage.data.get(Store.KEY), before);
});

test('no host still persists completion and keeps its outbox available', async () => {
  const storage = memory();
  const original = finish().state;
  const result = await Store.flush(original, storage, null, lookup);
  assert.equal(result.sent, 0);
  assert.deepEqual(result.state, original);
  assert.deepEqual(Store.load(storage, lookup), original);
});

test('host is called only after persistence; confirmed completion is not sent again after refresh', async () => {
  const storage = memory();
  const original = finish().state;
  const calls = [];
  const host = payload => {
    assert.deepEqual(Store.load(storage, lookup).outbox[0], payload);
    calls.push(payload);
    return { ack: true };
  };
  const result = await Store.flush(original, storage, host, lookup);
  assert.equal(result.sent, 1);
  assert.deepEqual(result.state.outbox, []);
  assert.deepEqual(result.state.acked, [calls[0].completionId]);
  const again = await Store.flush(Store.load(storage, lookup), storage, host, lookup);
  assert.equal(again.sent, 0);
  assert.equal(calls.length, 1);
});

test('throwing or non-acknowledging hosts retry the exact same completion ID and claims', async () => {
  const storage = memory();
  const original = finish().state;
  const seen = [];
  let result = await Store.flush(original, storage, payload => { seen.push(payload); throw new Error('offline'); }, lookup);
  assert.equal(result.sent, 0);
  assert.equal(result.error, 'offline');
  result = await Store.flush(Store.load(storage, lookup), storage, payload => { seen.push(payload); return { ok: true }; }, lookup);
  assert.equal(result.sent, 0);
  assert.equal(result.state.outbox.length, 1);
  result = await Store.flush(result.state, storage, payload => { seen.push(payload); return true; }, lookup);
  assert.equal(result.sent, 1);
  assert.deepEqual(seen[0], seen[1]);
  assert.deepEqual(seen[1], seen[2]);
});

test('storage failure before host dispatch prevents any external completion callback', async () => {
  const storage = memory();
  storage.failSet = true;
  let called = 0;
  const result = await Store.flush(finish().state, storage, () => { called += 1; return true; }, lookup);
  assert.equal(called, 0);
  assert.equal(result.sent, 0);
  assert.equal(result.error, 'quota exceeded');
  assert.equal(result.state.outbox.length, 1);
});

test('storage failure after host acknowledgement retains stable payload for a safe retry', async () => {
  const storage = memory();
  const original = finish().state;
  let observed;
  const result = await Store.flush(original, storage, payload => { observed = payload; storage.failSet = true; return true; }, lookup);
  assert.equal(result.sent, 0);
  assert.equal(result.error, 'quota exceeded');
  storage.failSet = false;
  const restored = Store.load(storage, lookup);
  assert.deepEqual(restored.outbox, [observed]);
  const retried = await Store.flush(restored, storage, payload => { assert.deepEqual(payload, observed); return true; }, lookup);
  assert.equal(retried.sent, 1);
});

test('read failure after acknowledgement does not remove queued evidence', async () => {
  const storage = memory();
  const result = await Store.flush(finish().state, storage, () => { storage.failGet = true; return true; }, lookup);
  assert.equal(result.sent, 0);
  assert.equal(result.error, 'read denied');
  storage.failGet = false;
  assert.equal(Store.load(storage, lookup).outbox.length, 1);
});

test('host payload mutation does not alter persistent reward or metric evidence', async () => {
  const storage = memory();
  const original = finish().state;
  const expected = copy(original.outbox[0]);
  const result = await Store.flush(original, storage, payload => { payload.rewardClaims.push('free'); payload.metrics.hints = 999; return false; }, lookup);
  assert.deepEqual(result.state.outbox[0], expected);
  assert.deepEqual(Store.load(storage, lookup).outbox[0], expected);
});

test('a slow host acknowledgement preserves newer gameplay saved while it was waiting', async () => {
  const storage = memory();
  const original = finish().state;
  let nextSession;
  const result = await Store.flush(original, storage, async () => {
    const latest = Store.load(storage, lookup);
    nextSession = Store.setCell(Store.newSession(other), other, 0, 1);
    latest.current = nextSession;
    Store.save(storage, latest);
    await Promise.resolve();
    return true;
  }, lookup);
  assert.deepEqual(result.state.current, nextSession);
  assert.deepEqual(Store.load(storage, lookup).current, nextSession);
  assert.equal(result.state.outbox.length, 0);
});

test('real level catalog works with the store default lookup and survives reload', () => {
  const Levels = require('../src/levels.js');
  const actual = Levels.levels[0];
  let session = Store.newSession(actual);
  actual.rows.join('').split('').forEach((symbol, index) => { session = Store.setCell(session, actual, index, symbol === '#' ? 1 : 2); });
  const result = Store.settle(Store.emptyState(), session, actual);
  assert.equal(result.completed, true);
  const storage = memory();
  assert.equal(Store.save(storage, result.state).ok, true);
  assert.deepEqual(Store.load(storage), result.state);
});
