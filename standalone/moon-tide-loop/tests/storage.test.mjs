import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWin } from '../src/engine.mjs';
import { LEVELS, getLevel, getSeedLevel } from '../src/levels.mjs';
import { createStore, createMemoryStorage, GAME_ID, STORAGE_PREFIX, STORAGE_LIMITS } from '../src/storage.mjs';

const levels = [
  { id: 'moon-01', chapter: 1, width: 2, height: 1, clues: [3, 3], solution: [1, 1, 1, 1, 1, -1, 1] },
  { id: 'moon-02', chapter: 1, width: 1, height: 1, clues: [null], solution: [1, 1, 1, 1] },
  { id: 'moon-03', chapter: 2, width: 1, height: 1, clues: [null], solution: [1, 1, 1, 1] }
];
const stateKey = STORAGE_PREFIX + 'state';
function setup(storage, extra) {
  return createStore(Object.assign({ levels: levels, getLevel: function (id, mode) {
    if (mode === 'daily' && id === 'daily-2026-09-08') return Object.assign({}, levels[0], { id: id });
    return levels.find(function (level) { return level.id === id; });
  }, checkWin: checkWin, storage: storage || createMemoryStorage(), now: function () { return 1788825600000; } }, extra || {}));
}
function solutionRun(store, index, hints) {
  const level = levels[index || 0];
  const run = store.createRun(level.id);
  run.actions = level.solution.map(function (value, edge) { return { edge: edge, value: value }; });
  run.hintsUsed = hints || 0;
  return run;
}

test('resume replays actions and preserves stable run identity, notes, undo and hints', function () {
  const storage = createMemoryStorage();
  const store = setup(storage);
  const run = store.createRun('moon-01');
  run.actions.push({ edge: 0, value: 1 }, { edge: 5, value: -1 }, { edge: 0, value: 0 });
  run.hintsUsed = 2;
  store.saveRun(run);
  const resumed = setup(storage).loadRun();
  assert.equal(resumed.runId, run.runId);
  assert.equal(resumed.edges[0], 0);
  assert.equal(resumed.edges[5], -1);
  assert.equal(resumed.hintsUsed, 2);
  assert.equal(resumed.done, false);
  resumed.actions.pop();
  const undone = store.saveRun(resumed);
  assert.equal(undone.edges[0], 1);
  assert.equal(store.loadRun().actions.length, 2);
  const restarted = store.createRun('moon-01');
  assert.notEqual(restarted.runId, run.runId);
  assert.deepEqual(restarted.edges, new Array(7).fill(0));
});

test('completion persists the exact event before send and survives duplicate calls and refresh', async function () {
  const storage = createMemoryStorage();
  const store = setup(storage);
  const run = solutionRun(store);
  const event = store.completeRun(run, { elapsedMs: 23000, moves: 900, hintsUsed: 8 });
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.gameId, GAME_ID);
  assert.equal(event.levelId, 'moon-01');
  assert.equal(event.mode, 'campaign');
  assert.equal(event.runId, run.runId);
  assert.equal(event.metrics.moves, 7);
  assert.equal(event.metrics.hintsUsed, 0);
  assert.equal(event.metrics.elapsedMs, 23000);
  assert.ok(Number.isFinite(Date.parse(event.completedAt)));
  assert.deepEqual(Object.keys(event).sort(), ['schemaVersion', 'gameId', 'levelId', 'mode', 'runId', 'completionId', 'rewardClaims', 'metrics', 'completedAt'].sort());
  const raw = JSON.parse(storage.getItem(stateKey));
  assert.deepEqual(raw.outbox, [event]);
  assert.deepEqual(raw.records[0].completion, event);
  assert.deepEqual(store.completeRun(run), event);
  const afterRefresh = setup(storage);
  assert.deepEqual(afterRefresh.completeRun(afterRefresh.loadRun()), event);
  assert.equal(afterRefresh.getProgress().totalCompleted, 1);
  let calls = 0;
  await afterRefresh.flushOutbox(function (payload) {
    assert.deepEqual(JSON.parse(storage.getItem(stateKey)).outbox[0], payload);
    assert.deepEqual(payload, event);
    calls += 1;
  });
  await afterRefresh.flushOutbox(function () { calls += 1; });
  assert.equal(calls, 1);
  assert.deepEqual(setup(storage).getOutbox(), []);
});

test('only distinct verified clears collect an island; independent clear is separately idempotent', function () {
  const store = setup();
  const first = store.completeRun(solutionRun(store, 0, 1));
  assert.equal(first.rewardClaims.length, 1);
  assert.deepEqual(store.getProgress().collectedChapters, []);
  const second = store.completeRun(solutionRun(store, 1, 2));
  assert.ok(second.rewardClaims.some(function (claim) { return claim.kind === 'island' && claim.chapter === 1; }));
  assert.deepEqual(store.getProgress().collectedChapters, [1]);
  assert.equal(store.getProgress().chapterCounts[1], 2);
  assert.equal(store.getProgress().independent['moon-01'], undefined);
  const independent = store.completeRun(solutionRun(store, 0, 0));
  assert.deepEqual(independent.rewardClaims.map(function (claim) { return claim.kind; }), ['independent-clear']);
  const repeat = store.completeRun(solutionRun(store, 0, 0));
  assert.equal(repeat.rewardClaims.length, 0);
  const progress = store.getProgress();
  assert.equal(progress.totalCompleted, 2);
  assert.equal(progress.independent['moon-01'], true);
  const ids = progress.claims.map(function (claim) { return claim.rewardClaimId; });
  assert.equal(ids.length, new Set(ids).size);
});

test('done, edges, completed maps and naked reward/outbox caches cannot forge progress', function () {
  const storage = createMemoryStorage();
  const store = setup(storage);
  const run = store.createRun('moon-01');
  run.done = true;
  run.edges = levels[0].solution;
  assert.equal(store.completeRun(run), null);
  const raw = JSON.parse(storage.getItem(stateKey));
  raw.current.done = true;
  raw.current.edges = levels[0].solution;
  raw.completed = { 'moon-01': true, 'moon-02': true };
  raw.collectedChapters = [1, 2, 3, 4, 5, 6];
  raw.outbox = [{ completionId: 'fake', rewardClaims: [{ rewardClaimId: 'fake-island' }] }];
  raw.records.push({ run: raw.current, completedAt: new Date(1788825600000).toISOString(), delivered: false });
  storage.setItem(stateKey, JSON.stringify(raw));
  const restored = setup(storage);
  assert.equal(restored.loadRun().done, false);
  assert.equal(restored.getProgress().totalCompleted, 0);
  assert.deepEqual(restored.getProgress().collectedChapters, []);
  assert.deepEqual(restored.getOutbox(), []);
});

test('a completed action replay repairs missing ledger and ignores forged event rewards', function () {
  const storage = createMemoryStorage();
  const store = setup(storage);
  store.saveRun(solutionRun(store));
  let raw = JSON.parse(storage.getItem(stateKey));
  raw.records = [];
  raw.outbox = [];
  storage.setItem(stateKey, JSON.stringify(raw));
  const repaired = setup(storage);
  assert.equal(repaired.loadRun().done, true);
  assert.equal(repaired.getProgress().totalCompleted, 1);
  raw = JSON.parse(storage.getItem(stateKey));
  raw.records[0].completion.rewardClaims.push({ rewardClaimId: 'fake', kind: 'island', chapter: 6 });
  raw.outbox[0].rewardClaims.push({ rewardClaimId: 'fake-2', kind: 'island', chapter: 5 });
  storage.setItem(stateKey, JSON.stringify(raw));
  const verified = setup(storage);
  assert.deepEqual(verified.getProgress().collectedChapters, []);
  assert.ok(verified.getProgress().claims.every(function (claim) { return claim.kind !== 'island'; }));
});

test('excluded marks, empty boards, branching and multiple loops cannot complete a save', function () {
  const store = setup();
  const run = store.createRun('moon-01');
  run.actions = levels[0].solution.map(function (_, edge) { return { edge: edge, value: -1 }; });
  assert.equal(store.completeRun(run), null);
  run.actions = [];
  assert.equal(store.completeRun(run), null);
  run.actions = levels[0].solution.map(function (_, edge) { return { edge: edge, value: 1 }; });
  assert.equal(store.completeRun(run), null);
  const twinLevel = { id: 'moon-twin', chapter: 1, width: 3, height: 1, clues: [null, null, null] };
  const twins = setup(undefined, { levels: [twinLevel], getLevel: function () { return twinLevel; } });
  const twinRun = twins.createRun(twinLevel.id);
  // Two disconnected 1x1 rings in the left/right cells.
  twinRun.actions = [0, 2, 3, 5, 6, 7, 8, 9].map(function (edge) { return { edge: edge, value: 1 }; });
  assert.equal(twins.completeRun(twinRun), null);
});

test('illegal and oversized action histories are rejected without replacing the valid current run', function () {
  const store = setup();
  const run = store.createRun('moon-01');
  [{ edge: -1, value: 1 }, { edge: 7, value: 1 }, { edge: 0.5, value: 1 }, { edge: 0, value: 2 }, { edge: 0, value: '1' }].forEach(function (action) {
    run.actions = [action];
    assert.equal(store.saveRun(run), null);
    assert.equal(store.completeRun(run), null);
    assert.equal(store.loadRun().actions.length, 0);
  });
  run.actions = new Array(STORAGE_LIMITS.actions + 1).fill({ edge: 0, value: 1 });
  assert.equal(store.saveRun(run), null);
  assert.equal(store.loadRun().actions.length, 0);
  assert.ok(store.getStatus().warnings.length > 0);
});

test('corrupt JSON and one corrupt proof fail safely without touching another game', function () {
  const storage = createMemoryStorage();
  storage.setItem('mini-polish:other:v1:state', 'untouched');
  storage.setItem(stateKey, '{broken');
  const repaired = setup(storage);
  assert.equal(repaired.loadRun(), null);
  assert.equal(storage.getItem('mini-polish:other:v1:state'), 'untouched');
  repaired.completeRun(solutionRun(repaired, 0));
  repaired.completeRun(solutionRun(repaired, 1));
  const raw = JSON.parse(storage.getItem(stateKey));
  raw.current = null;
  raw.records[0].run.actions[0].edge = 9000;
  storage.setItem(stateKey, JSON.stringify(raw));
  const partial = setup(storage);
  assert.equal(partial.getProgress().totalCompleted, 1);
  assert.equal(partial.getProgress().completed['moon-02'], true);
  assert.deepEqual(partial.getProgress().collectedChapters, []);
  assert.equal(storage.getItem('mini-polish:other:v1:state'), 'untouched');
});

test('host errors, false results and concurrent retries preserve payloads and dedupe locally', async function () {
  const storage = createMemoryStorage();
  const store = setup(storage);
  const event = store.completeRun(solutionRun(store));
  assert.equal((await store.flushOutbox()).skipped, true);
  assert.equal((await store.flushOutbox(function () { throw new Error('offline'); })).pending, 1);
  assert.equal((await store.flushOutbox(function () { return false; })).pending, 1);
  let calls = 0;
  let acknowledge;
  const first = store.flushOutbox(function (payload) {
    calls += 1;
    assert.deepEqual(payload, event);
    return new Promise(function (resolve) { acknowledge = resolve; });
  });
  const second = store.flushOutbox(function () { throw new Error('must not run twice'); });
  assert.equal(first, second);
  await Promise.resolve();
  acknowledge(true);
  assert.deepEqual(await first, { sent: 1, pending: 0, skipped: false });
  assert.equal(calls, 1);
  assert.deepEqual(setup(storage).getOutbox(), []);
});

test('optional host and failing storage leave a playable in-memory run with a warning', async function () {
  const messages = [];
  const broken = { getItem: function () { throw new Error('denied'); }, setItem: function () { throw new Error('denied'); } };
  const store = setup(broken, { onWarning: function (message) { messages.push(message); } });
  const run = solutionRun(store);
  const event = store.completeRun(run);
  assert.ok(event);
  assert.equal(store.loadRun().done, true);
  assert.equal(store.getProgress().totalCompleted, 1);
  assert.equal(store.getStatus().persistent, false);
  assert.ok(messages.some(function (message) { return message.indexOf('关闭或刷新') !== -1; }));
  assert.equal((await store.flushOutbox()).pending, 1);
  store.markTutorialSeen('1');
  assert.equal(store.hasSeenTutorial('1'), true);
});

test('tutorial versions use independent namespaced keys and preserve all progress', function () {
  const storage = createMemoryStorage();
  const store = setup(storage);
  store.completeRun(solutionRun(store));
  const before = storage.getItem(stateKey);
  assert.equal(store.hasSeenTutorial('1'), false);
  store.markTutorialSeen('1');
  assert.equal(store.hasSeenTutorial('1'), true);
  assert.equal(store.hasSeenTutorial('2'), false);
  store.markTutorialSeen('2');
  assert.equal(storage.getItem(stateKey), before);
  assert.equal(storage.getItem(STORAGE_PREFIX + 'tutorial:1'), 'seen');
  assert.equal(store.hasSeenTutorial('../escape'), false);
  assert.equal(store.markTutorialSeen('../escape'), false);
});

test('daily claims are separate and cannot add campaign islands', function () {
  const store = setup();
  const run = store.createRun('daily-2026-09-08', 'daily');
  run.actions = levels[0].solution.map(function (value, edge) { return { edge: edge, value: value }; });
  const event = store.completeRun(run);
  assert.equal(event.mode, 'daily');
  assert.ok(event.rewardClaims.every(function (claim) { return claim.rewardClaimId.indexOf(':daily:') !== -1; }));
  assert.equal(store.getProgress().totalCompleted, 0);
  assert.deepEqual(store.getProgress().collectedChapters, []);
});

test('Chinese and encoded seed IDs resume through the real catalogue without loss', function () {
  const storage = createMemoryStorage();
  const options = { levels: LEVELS, getLevel: getLevel, checkWin: checkWin, storage: storage };
  const store = createStore(options);
  const level = getSeedLevel('月光的回信 🌊 与海岸');
  assert.ok(level.id.indexOf('%') !== -1);
  const run = store.createRun(level.id, 'seed');
  run.actions = level.solution.map(function (value, edge) { return { edge: edge, value: value }; });
  store.saveRun(run);
  const event = store.completeRun(run);
  assert.equal(event.mode, 'seed');
  const restored = createStore(options);
  assert.equal(restored.loadRun().levelId, level.id);
  assert.equal(restored.loadRun().done, true);
  assert.equal(restored.getOutbox()[0].completionId, event.completionId);
  assert.equal(restored.getProgress().totalCompleted, 0);
});

test('all 72 real proofs rebuild six islands, and damaging one proof removes only its island', function () {
  const storage = createMemoryStorage();
  const options = { levels: LEVELS, getLevel: getLevel, checkWin: checkWin, storage: storage };
  const store = createStore(options);
  LEVELS.forEach(function (level) {
    const run = store.createRun(level.id, 'campaign');
    run.actions = level.solution.map(function (value, edge) { return { edge: edge, value: value }; });
    assert.ok(store.completeRun(run), level.id);
  });
  const restored = createStore(options);
  const progress = restored.getProgress();
  assert.equal(progress.totalCompleted, 72);
  assert.deepEqual(progress.collectedChapters, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(progress.chapterCounts, { 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12 });
  assert.equal(progress.claims.length, 150);
  const raw = JSON.parse(storage.getItem(stateKey));
  raw.current = null;
  const target = raw.records.find(function (record) { return record.run.levelId === 'moon-36'; });
  target.run.actions.find(function (action) { return action.value === 1; }).value = -1;
  storage.setItem(stateKey, JSON.stringify(raw));
  const damaged = createStore(options).getProgress();
  assert.equal(damaged.totalCompleted, 71);
  assert.deepEqual(damaged.collectedChapters, [1, 2, 4, 5, 6]);
  assert.equal(damaged.chapterCounts[3], 11);
  assert.equal(damaged.completed['moon-36'], undefined);
});
