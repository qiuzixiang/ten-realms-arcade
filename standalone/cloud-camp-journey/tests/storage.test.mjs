import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, STATE_KEY, STORAGE_PREFIX } from '../src/storage.mjs';

function memory() {
  const data = new Map();
  return { data, getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value) };
}
const levels = [
  { id: 'camp-1', chapter: 1, size: 2, trees: [0], rows: [1, 0], cols: [0, 1], solution: [1] },
  { id: 'camp-2', chapter: 1, size: 2, trees: [3], rows: [1, 0], cols: [0, 1], solution: [1] }
];
const daily = { ...levels[0], id: 'daily-2026-09-08' };
function createBoard(level) { return new Array(level.size * level.size).fill(0); }
function applyAction(level, board, index, value) {
  if (!Number.isInteger(index) || index < 0 || index >= board.length || level.trees.includes(index) ||
      ![0, 1, 2].includes(value) || board[index] === value) return { accepted: false, board, reason: 'invalid' };
  const next = board.slice(); next[index] = value;
  return { accepted: true, board: next, reason: '' };
}
function isSolved(level, board) { return board[1] === 1 && board.filter(value => value === 1).length === 1; }
let serial = 0;
function setup(storage = memory(), extra = {}) {
  const config = { levels, createBoard, applyAction, isSolved, storage,
    now: () => Date.parse('2026-09-08T08:00:00Z'), makeId: () => 'test-run-' + (++serial),
    resolveLevel: (id, meta) => id === daily.id && meta.mode === 'daily' && meta.day === '2026-09-08' ? daily : null,
    ...extra };
  return { store: createStorage(config), storage, config };
}
function win(store, id = 'camp-1', meta) { store.begin(id, meta); store.act(1, 1); return store.complete(); }

test('accepted history, hints and undo replay; supplied board and completion flags have no authority', () => {
  const { store, storage, config } = setup();
  store.begin('camp-1');
  assert.equal(store.act(0, 1).accepted, false);
  store.act(2, 2); store.hint(); store.act(1, 1); store.undo();
  const before = store.getRun();
  assert.deepEqual(before.board, [0, 0, 2, 0]);
  assert.equal(before.moves, 2); assert.equal(before.hints, 1); assert.equal(before.undoCount, 1);
  const raw = JSON.parse(storage.getItem(STATE_KEY));
  raw.active.board = [0, 1, 0, 0]; raw.active.completed = true; raw.active.hints = 0;
  storage.setItem(STATE_KEY, JSON.stringify(raw));
  const restored = createStorage(config);
  assert.deepEqual(restored.resume(), before);
  assert.equal(restored.complete().ok, false);
  assert.equal(restored.profile().totalRewards, 0);
});

test('the same completion is idempotent across repeated calls and reloads', () => {
  const { store, config } = setup();
  const first = win(store);
  const again = store.complete();
  assert.equal(first.ok, true); assert.equal(first.alreadyCompleted, false);
  assert.equal(again.alreadyCompleted, true);
  assert.deepEqual(again.payload, first.payload);
  const restored = createStorage(config);
  assert.equal(restored.resume().completed, true);
  assert.equal(restored.resume().runId, first.payload.runId);
  assert.deepEqual(restored.complete().payload, first.payload);
  assert.equal(restored.profile().totalWins, 1);
  assert.equal(restored.profile().totalRewards, 1);
  const oldId = restored.getRun().runId;
  restored.restart();
  assert.notEqual(restored.getRun().runId, oldId);
  restored.act(1, 1);
  assert.deepEqual(restored.complete().payload.rewardClaims, []);
  assert.equal(restored.profile().totalWins, 2);
  assert.equal(restored.profile().totalRewards, 1);
});

test('all story proofs unlock a chapter once; hints never remove rewards', () => {
  const { store, config } = setup();
  win(store);
  store.begin('camp-2'); store.hint(); store.hint(); store.act(1, 1);
  const result = store.complete();
  assert.equal(result.payload.metrics.hints, 2);
  assert.deepEqual(result.profile.completedLevelIds, ['camp-1', 'camp-2']);
  assert.deepEqual(result.profile.collections, [1]);
  assert.equal(result.profile.totalRewards, 3);
  assert.equal(result.payload.rewardClaims.length, 2);
  assert.deepEqual(createStorage(config).profile(), result.profile);
});

test('daily first win is one claim per date and daily reconstruction is required', () => {
  const { store, config } = setup();
  const first = win(store, daily.id, { mode: 'daily', day: '2026-09-08' });
  assert.equal(first.payload.rewardClaims[0].kind, 'daily-first');
  assert.deepEqual(first.profile.dailyDates, ['2026-09-08']);
  assert.equal(win(store, daily.id, { mode: 'daily', day: '2026-09-08' }).payload.rewardClaims.length, 0);
  assert.equal(createStorage(config).profile().totalRewards, 1);
  assert.throws(() => store.begin(daily.id, { mode: 'daily', day: '2026-09-09' }));
  assert.throws(() => store.begin(daily.id, { mode: 'daily', day: '2026-02-31' }));
});

test('forged completion flags, IDs, rewards and invalid history cannot unlock progress', () => {
  const { store, storage, config } = setup();
  store.begin('camp-1');
  const raw = JSON.parse(storage.getItem(STATE_KEY));
  raw.completedLevelIds = ['camp-1', 'camp-2']; raw.totalRewards = 9999;
  raw.completions = [{ run: { ...raw.active, completed: true, board: [0, 1, 0, 0] }, completedAt: '2026-09-08T08:00:00Z', rewardClaims: ['fake'] }];
  raw.active.events = [{ type: 'set', index: 2, value: 2 }, { type: 'set', index: 99, value: 1 }];
  storage.setItem(STATE_KEY, JSON.stringify(raw));
  const restored = createStorage(config);
  assert.equal(restored.profile().totalRewards, 0);
  assert.equal(restored.profile().totalWins, 0);
  assert.deepEqual(restored.profile().completedLevelIds, []);
  assert.deepEqual(restored.resume().board, [0, 0, 2, 0]);
  assert.match(restored.getStatus().recoveryMessage, /核验/);
  // A proof that was genuinely completed also stops counting if its replay is damaged.
  win(restored);
  const damaged = JSON.parse(storage.getItem(STATE_KEY));
  damaged.completions[0].run.events.push({ type: 'set', index: -1, value: 1 });
  storage.setItem(STATE_KEY, JSON.stringify(damaged));
  assert.equal(createStorage(config).profile().totalWins, 0);
});

test('corrupt storage and changed puzzle signature recover without touching unrelated keys', () => {
  const backing = memory(); backing.setItem('other-game', 'keep'); backing.setItem(STATE_KEY, '{broken');
  const { store, config } = setup(backing);
  assert.equal(store.resume(), null);
  assert.ok(store.getStatus().recoveryMessage);
  store.begin('camp-1'); store.act(2, 2);
  assert.equal(backing.getItem('other-game'), 'keep');
  const changed = createStorage({ ...config, levels: [{ ...levels[0], rows: [0, 1] }, levels[1]] });
  assert.equal(changed.resume(), null);
  assert.ok(changed.getStatus().recoveryMessage);
});

test('tutorial versions are isolated from game progress and each other', () => {
  const { store, storage, config } = setup(); win(store);
  const original = storage.getItem(STATE_KEY);
  store.markTutorialSeen('intro-1');
  assert.equal(store.tutorialSeen('intro-1'), true);
  assert.equal(store.tutorialSeen('intro-2'), false);
  store.markTutorialSeen('intro-2');
  assert.equal(storage.getItem(STATE_KEY), original);
  assert.equal(createStorage(config).tutorialSeen('intro-1'), true);
  assert.ok(Array.from(storage.data.keys()).every(key => key.startsWith(STORAGE_PREFIX)));
});

test('outbox is durable before the host call; failures retry exactly the same event', async () => {
  const { store, storage, config } = setup(); const first = win(store);
  let calls = 0; let firstPayload;
  const failed = await store.flushOutbox(payload => {
    calls += 1; firstPayload = payload;
    const disk = JSON.parse(storage.getItem(STATE_KEY));
    assert.equal(disk.completions[0].run.runId, payload.runId);
    assert.equal(disk.delivered.length, 0);
    throw new Error('host unavailable');
  });
  assert.deepEqual(firstPayload, first.payload);
  assert.deepEqual(failed, { sent: 0, pending: 1 });
  const restored = createStorage(config);
  const received = [];
  assert.deepEqual(await restored.flushOutbox(payload => { received.push(payload); }), { sent: 1, pending: 0 });
  assert.deepEqual(received, [firstPayload]);
  assert.deepEqual(await restored.flushOutbox(() => { calls += 1; }), { sent: 0, pending: 0 });
  assert.equal(calls, 1);
  assert.equal(createStorage(config).getStatus().pendingCompletions, 0);
});

test('concurrent flushes share one delivery and an absent host does not block completion', async () => {
  const { store } = setup(); win(store);
  assert.deepEqual(await store.flushOutbox(), { sent: 0, pending: 1 });
  let release; let calls = 0;
  const a = store.flushOutbox(() => { calls += 1; return new Promise(resolve => { release = resolve; }); });
  const b = store.flushOutbox(() => { calls += 1; });
  release(); await Promise.all([a, b]);
  assert.equal(calls, 1);
});

test('unavailable storage keeps play in memory and never emits an unpersisted completion', async () => {
  let hostCalls = 0;
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  const { store } = setup(denied, { onComplete: () => { hostCalls += 1; } });
  assert.equal(win(store).ok, true);
  assert.equal(store.profile().totalWins, 1);
  assert.equal(store.getStatus().persistenceAvailable, false);
  store.markTutorialSeen('1'); assert.equal(store.tutorialSeen('1'), true);
  assert.deepEqual(await store.flushOutbox(), { sent: 0, pending: 1 });
  assert.equal(hostCalls, 0);
  const noStorage = setup(null).store;
  assert.equal(win(noStorage).ok, true);
  assert.equal(noStorage.getStatus().persistenceAvailable, false);
});

test('storage can recover after quota failure and only then deliver pending events', async () => {
  const backing = memory(); let denied = true; let calls = 0;
  const storage = { getItem: backing.getItem, setItem(key, value) { if (denied) throw new Error('quota'); backing.setItem(key, value); } };
  const { store } = setup(storage);
  win(store);
  assert.equal(store.getStatus().persistenceAvailable, false);
  denied = false;
  await store.flushOutbox(() => { calls += 1; });
  assert.equal(calls, 1);
  assert.equal(store.getStatus().persistenceAvailable, true);
  assert.equal(JSON.parse(backing.getItem(STATE_KEY)).completions.length, 1);
});

for (const recovery of ['action', 'retry']) {
  test('runtime quota failure preserves act/hint/undo/completion and recovers through ' + recovery, async () => {
    const backing = memory();
    let denied = false;
    let hostCalls = 0;
    const storage = {
      getItem: backing.getItem,
      setItem(key, value) {
        if (denied) { const error = new Error('Storage quota exceeded'); error.name = 'QuotaExceededError'; throw error; }
        backing.setItem(key, value);
      }
    };
    const { store, config } = setup(storage, { onComplete: () => { hostCalls += 1; } });
    store.begin('camp-1');
    assert.equal(store.act(2, 2).accepted, true);
    assert.equal(store.getStatus().persistenceAvailable, true);
    const lastSaved = backing.getItem(STATE_KEY);
    const beforeFailure = store.getRun();
    denied = true;
    function stillUnpersisted() {
      assert.equal(store.getStatus().persistenceAvailable, false);
      assert.equal(backing.getItem(STATE_KEY), lastSaved);
      assert.equal(hostCalls, 0);
    }
    assert.equal(store.act(3, 2).accepted, true);
    assert.deepEqual(store.getRun().board, [0, 0, 2, 2]); stillUnpersisted();
    assert.equal(store.hint().hints, 1); stillUnpersisted();
    assert.deepEqual(store.undo().board, [0, 0, 2, 0]); stillUnpersisted();
    assert.equal(store.act(1, 1).accepted, true); stillUnpersisted();
    const result = store.complete();
    assert.equal(result.ok, true);
    assert.equal(result.profile.totalWins, 1);
    assert.equal(result.profile.totalRewards, 1);
    assert.equal(store.getRun().completed, true); stillUnpersisted();
    assert.deepEqual(await store.flushOutbox(), { sent: 0, pending: 1 }); stillUnpersisted();
    assert.deepEqual(createStorage(config).resume(), beforeFailure);
    denied = false;
    if (recovery === 'action') {
      assert.equal(store.act(3, 2).accepted, true);
      assert.equal(store.getStatus().persistenceAvailable, true);
      assert.notEqual(backing.getItem(STATE_KEY), lastSaved);
    }
    const received = [];
    assert.deepEqual(await store.flushOutbox(payload => { received.push(payload); }), { sent: 1, pending: 0 });
    assert.equal(store.getStatus().persistenceAvailable, true);
    assert.deepEqual(received, [result.payload]);
    const restored = createStorage(config);
    assert.deepEqual(restored.getRun(), store.getRun());
    assert.deepEqual(restored.profile(), store.profile());
    assert.equal(restored.getRun().hints, 1);
    assert.equal(restored.getRun().undoCount, 1);
    assert.equal(restored.getStatus().pendingCompletions, 0);
    assert.equal(hostCalls, 0);
  });
}

test('a successful small tutorial write cannot hide a still-failing main save', () => {
  const backing = memory(); let denyMain = false;
  const storage = { getItem: backing.getItem, setItem(key, value) {
    if (denyMain && key === STATE_KEY) throw new Error('Main save quota exceeded');
    backing.setItem(key, value);
  } };
  const { store } = setup(storage);
  store.begin('camp-1');
  denyMain = true;
  store.act(2, 2);
  assert.equal(store.getStatus().persistenceAvailable, false);
  store.markTutorialSeen('small-flag');
  assert.equal(store.tutorialSeen('small-flag'), true);
  assert.equal(backing.getItem(STORAGE_PREFIX + 'tutorial:small-flag'), 'seen');
  assert.equal(store.getStatus().persistenceAvailable, false);
  denyMain = false;
  store.hint();
  assert.equal(store.getStatus().persistenceAvailable, true);
});

test('profile and run return detached data; malformed actions never enter history', () => {
  const { store } = setup(); store.begin('camp-1');
  store.getRun().board[1] = 1;
  assert.equal(store.getRun().completed, false);
  assert.equal(store.act(1, '1').accepted, false);
  assert.equal(store.act(NaN, 1).accepted, false);
  win(store);
  const profile = store.profile(); profile.completedLevelIds.push('forged'); profile.rewardClaims[0].value = 999;
  assert.deepEqual(store.profile().completedLevelIds, ['camp-1']);
  assert.equal(store.profile().rewardClaims[0].value, 1);
});

test('production engine: every main camp settles once and all six collections survive replay', async () => {
  const engine = await import('../src/engine.mjs');
  const catalog = await import('../src/levels.mjs');
  const storage = memory();
  const config = { levels: catalog.LEVELS, createBoard: engine.createBoard, applyAction: engine.applyAction,
    isSolved: engine.isSolved, storage, makeId: () => 'production-' + (++serial) };
  const store = createStorage(config);
  for (const level of catalog.LEVELS) {
    store.begin(level.id);
    for (const cell of level.solution) assert.equal(store.act(cell, 1).accepted, true);
    assert.equal(store.getRun().completed, true, level.id);
    const result = store.complete();
    assert.equal(result.ok, true, level.id);
    assert.equal(result.alreadyCompleted, false);
  }
  const expected = store.profile();
  assert.equal(expected.completedLevelIds.length, 60);
  assert.equal(expected.totalWins, 60);
  assert.deepEqual(expected.collections, [1, 2, 3, 4, 5, 6]);
  assert.equal(expected.totalRewards, 66);
  const restored = createStorage(config);
  assert.deepEqual(restored.profile(), expected);
  assert.equal(restored.getRun().completed, true);
  assert.equal(restored.complete().alreadyCompleted, true);
  assert.deepEqual(restored.profile(), expected);
});

test('production daily and seed camps reconstruct independently after reload', async () => {
  const engine = await import('../src/engine.mjs');
  const catalog = await import('../src/levels.mjs');
  const generator = await import('../src/generator.mjs');
  const storage = memory();
  const config = { levels: catalog.LEVELS, createBoard: engine.createBoard, applyAction: engine.applyAction,
    isSolved: engine.isSolved, storage, resolveLevel(id, meta) {
      const choices = meta.mode === 'daily' ? [generator.dailyLevel(meta.day)] : generator.seedJourney(meta.seed, 10);
      return choices.find(level => level.id === id) || null;
    } };
  const store = createStorage(config);
  const day = '2026-09-08';
  const daily = generator.dailyLevel(day);
  store.begin(daily.id, { mode: 'daily', day });
  for (const cell of daily.solution) store.act(cell, 1);
  store.complete();
  const seed = '云野存档测试';
  const camp = generator.seedJourney(seed, 10)[4];
  store.begin(camp.id, { mode: 'seed', seed });
  store.act(camp.solution[0], 1); store.hint();
  const restored = createStorage(config);
  assert.deepEqual(restored.resume(), store.getRun());
  assert.deepEqual(restored.profile().dailyDates, [day]);
  for (const cell of camp.solution.slice(1)) restored.act(cell, 1);
  const result = restored.complete();
  assert.equal(result.ok, true);
  assert.equal(result.payload.mode, 'seed');
  assert.equal(result.payload.metrics.hints, 1);
  assert.deepEqual(result.payload.rewardClaims, []);
  assert.equal(result.profile.totalWins, 2);
  assert.equal(result.profile.totalRewards, 1);
});
