import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
const mainLevels = [
  { id: 'crane-01', chapter: 1, seed: 11, title: '初归', board: ['PP.'], solution: [{ from: 0, to: 2 }], target: 2 },
  { id: 'crane-02', chapter: 1, seed: 12, title: '另一片莲叶', board: ['.PP'], solution: [{ from: 2, to: 0 }], target: 2 }
];
const clone = value => JSON.parse(JSON.stringify(value));
const engine = {
  create(level) { return { width: level.board[0].length, height: level.board.length, cells: level.board.join('').split(''), moves: 0 }; },
  count(state) { return state.cells.filter(cell => cell === 'P').length; },
  won(state) { return engine.count(state) === 1; },
  apply(state, move) {
    const { from, to } = move;
    if (!Number.isInteger(from) || !Number.isInteger(to) || Math.abs(from - to) !== 2 || state.cells[from] !== 'P' || state.cells[to] !== '.' || state.cells[(from + to) / 2] !== 'P') return state;
    const result = clone(state);
    result.cells[from] = '.';
    result.cells[(from + to) / 2] = '.';
    result.cells[to] = 'P';
    result.moves += 1;
    return result;
  },
  replay(level, moves) {
    let state = engine.create(level);
    for (const move of moves) {
      const next = engine.apply(state, move);
      if (next === state) return null;
      state = next;
    }
    return state;
  }
};
const levels = {
  find(id) { return mainLevels.find(level => level.id === id); },
  daily(date) { return { ...clone(mainLevels[0]), id: 'daily-' + date, date, seed: date, chapter: 2 }; },
  seeded(seed, chapter) { return { ...clone(mainLevels[0]), id: 'seed-' + chapter + '-' + seed, seed, chapter }; }
};
function memoryStorage() {
  const values = new Map();
  return {
    values, writes: [], failGet: false, failSet: false,
    getItem(key) { if (this.failGet) throw Error('read denied'); return values.get(key) ?? null; },
    setItem(key, value) { if (this.failSet) throw Error('quota'); values.set(key, value); this.writes.push(key); },
    clear() { throw Error('must never clear foreign data'); }
  };
}
function setup(storage = memoryStorage(), host) {
  const window = { CraneEngine: engine, CraneLevels: levels };
  vm.runInNewContext(source, { window, console, Uint32Array });
  return { storage, lib: window.CraneStorage, store: window.CraneStorage.create(storage, host) };
}
function solved(store, level = mainLevels[0], mode = 'main') {
  const session = store.newSession(level, mode);
  session.timeline = clone(level.solution);
  return session;
}

test('storage namespace is private, tutorial is independent, and sessions are copied', () => {
  const { storage, store, lib } = setup();
  storage.setItem('another-game:state', 'untouched');
  const session = store.newSession(mainLevels[0], 'main');
  assert.equal(lib.key, 'mini-polish:paper-crane-journey:v1:state');
  assert.equal(store.tutorialSeen(), false);
  const before = storage.getItem(lib.key);
  assert.equal(store.markTutorial(), true);
  assert.equal(store.tutorialSeen(), true);
  assert.equal(storage.getItem(lib.key), before);
  session.timeline.push({ from: 0, to: 2 });
  assert.equal(store.loadSession().timeline.length, 0);
  assert.equal(store.saveSession(session), true);
  const restored = setup(storage).store;
  assert.equal(restored.loadSession().runId, session.runId);
  assert.equal(restored.loadSession().timeline.length, 1);
  assert.equal(storage.getItem('another-game:state'), 'untouched');
});

test('illegal timelines and malformed or invented sessions cannot replace the last valid session', () => {
  const { store } = setup();
  const session = store.newSession(mainLevels[0], 'main');
  const mutations = [
    { timeline: [{ from: 1, to: 2 }] }, { timeline: [{ from: 0, to: 999 }] },
    { timeline: [{ from: 0.5, to: 2 }] }, { timeline: [{ from: 0, to: 2 }, { from: 0, to: 2 }] },
    { mode: 'foreign' }, { levelId: 'invented' }, { chapter: 9 }, { seed: 10 },
    { runId: '<script>' }, { hints: -1 }, { undos: 1.5 }, { startedAt: 'yesterday' },
    { completionId: 'made-up-event' }
  ];
  for (const mutation of mutations) {
    assert.equal(store.saveSession({ ...session, ...mutation }), false, JSON.stringify(mutation));
    assert.equal(store.loadSession().runId, session.runId);
    assert.equal(store.loadSession().timeline.length, 0);
  }
  assert.equal(store.complete({ ...session, complete: true, rewards: 99999 }).ok, false);
  assert.equal(store.progress().totalClaims, 0);
});

test('completion has the exact contract envelope and stable identifiers; replaying a run is idempotent', () => {
  const { store, storage } = setup();
  const session = solved(store);
  const first = store.complete(session, mainLevels[0]);
  assert.equal(first.ok, true);
  assert.equal(first.saved, true);
  assert.equal(first.duplicate, false);
  assert.deepEqual(Object.keys(first.payload).sort(), ['schemaVersion', 'gameId', 'levelId', 'mode', 'runId', 'completionId', 'rewardClaims', 'metrics', 'completedAt'].sort());
  assert.equal(first.payload.metrics.moves, 1);
  assert.equal(first.payload.metrics.initialPegs, 2);
  assert.equal(first.payload.metrics.remaining, 1);
  assert.equal(first.payload.rewardClaims.length, 3);
  assert.equal(new Set(first.payload.rewardClaims.map(claim => claim.rewardClaimId)).size, 3);
  assert.equal(store.loadSession().completionId, first.payload.completionId);
  const second = store.complete(session);
  assert.equal(second.duplicate, true);
  assert.equal(JSON.stringify(second.payload), JSON.stringify(first.payload));
  const resumed = setup(storage).store;
  assert.equal(JSON.stringify(resumed.complete(resumed.loadSession()).payload), JSON.stringify(first.payload));
  assert.equal(resumed.progress().wins, 1);
  assert.equal(resumed.progress().completedCount, 1);
  assert.equal(resumed.progress().totalClaims, 3);
});

test('new runs cannot farm first, independent, or target rewards; independence can improve honestly', () => {
  const { store } = setup();
  const firstSession = solved(store);
  firstSession.hints = 2;
  const first = store.complete(firstSession);
  assert.equal(first.payload.metrics.independent, false);
  assert.equal(first.payload.rewardClaims.length, 2);
  const independentSession = solved(store);
  independentSession.undos = 5;
  const independent = store.complete(independentSession);
  assert.notEqual(independentSession.runId, firstSession.runId);
  assert.notEqual(independent.payload.completionId, first.payload.completionId);
  assert.equal(independent.payload.rewardClaims.length, 1);
  assert.equal(independent.payload.rewardClaims[0].type, 'independent');
  assert.equal(store.complete(solved(store)).payload.rewardClaims.length, 0);
  assert.equal(store.progress().totalClaims, 3);
  assert.equal(store.progress().completedCount, 1);
  assert.equal(store.progress().independentCount, 1);
  assert.equal(store.progress().chapters[1].completed, 1);
});

test('one remaining crane wins away from the optional target and settled run state cannot mutate', () => {
  const { store } = setup();
  const session = solved(store, mainLevels[1]);
  const result = store.complete(session, { ...mainLevels[1], target: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.payload.metrics.targetReached, false, 'canonical target takes precedence over supplied target');
  assert.equal(result.progress.targetCount, 0);
  assert.equal(result.payload.rewardClaims.length, 2);
  assert.equal(store.complete({ ...session, hints: 1 }).ok, false);
  assert.equal(store.saveSession({ ...session, timeline: [], undos: 1 }), false);
  assert.equal(store.progress().wins, 1);
});

test('daily and seeded sessions reproduce their original boards and dates after reload', () => {
  const { storage, store } = setup();
  const day = levels.daily('2026-09-08');
  let session = solved(store, day, 'daily');
  assert.equal(session.seed, '2026-09-08');
  const first = store.complete(session);
  assert.equal(first.payload.rewardClaims.filter(claim => claim.type === 'daily').length, 1);
  assert.equal(store.complete(solved(store, day, 'daily')).payload.rewardClaims.length, 0);
  assert.equal(store.progress().dailyCount, 1);
  assert.equal(store.progress().completedCount, 0);
  const generated = levels.seeded('paper-27', 4);
  session = store.newSession(generated, 'seeded');
  session.timeline = clone(generated.solution);
  store.saveSession(session);
  const restored = setup(storage).store;
  assert.equal(restored.loadSession().seed, 'paper-27');
  assert.equal(restored.loadSession().chapter, 4);
  assert.equal(restored.complete(restored.loadSession()).ok, true);
  assert.equal(restored.progress().seededCount, 1);
  assert.equal(restored.saveSession({ ...restored.loadSession(), seed: 'other' }), false);
  assert.equal(restored.newSession(levels.daily('2026-02-30'), 'daily'), null);
});

test('bad JSON and invalid completion flags do not invent progress or affect foreign saves', () => {
  const { storage, lib } = setup();
  storage.setItem('foreign:save', 'keep');
  storage.setItem(lib.key, '{broken');
  let store = setup(storage).store;
  assert.equal(store.loadSession(), null);
  assert.match(store.lastError, /损坏/);
  const session = store.newSession(mainLevels[0]);
  const forged = {
    schemaVersion: 1, session: { ...session, completed: true },
    journal: [{ session, completedAt: new Date().toISOString() }],
    rewards: 1000000, completed: { 'crane-02': true }, delivered: [],
    outbox: [{ completionId: 'forged', rewardClaims: [{ rewardClaimId: 'cash', amount: 999999 }] }]
  };
  storage.setItem(lib.key, JSON.stringify(forged));
  store = setup(storage).store;
  assert.equal(store.progress().wins, 0);
  assert.equal(store.progress().totalClaims, 0);
  assert.equal(store.progress().pending, 0);
  assert.equal(store.loadSession().completed, undefined);
  assert.equal(storage.getItem('foreign:save'), 'keep');
});

test('restoring a partly corrupted journal keeps only legal, distinct completion proofs', () => {
  const { storage, store, lib } = setup();
  store.complete(solved(store));
  const raw = JSON.parse(storage.getItem(lib.key));
  raw.journal.push(clone(raw.journal[0]));
  const bad = clone(raw.journal[0]);
  bad.session.runId = 'forged-valid-id';
  delete bad.session.completionId;
  bad.session.timeline = [{ from: 2, to: 0 }];
  raw.journal.push(bad);
  raw.session.timeline = [];
  raw.session.completionId = 'paper-crane-journey:completion:' + raw.session.runId;
  raw.outbox.push('phantom');
  raw.delivered.push('phantom');
  storage.setItem(lib.key, JSON.stringify(raw));
  const restored = setup(storage).store;
  assert.equal(restored.loadSession(), null);
  assert.equal(restored.progress().wins, 1);
  assert.equal(restored.progress().totalClaims, 3);
  assert.equal(restored.progress().pending, 1);
  assert.match(restored.lastError, /规则校验/);
});

test('host notification follows persistence and failed delivery retries an identical immutable payload', async () => {
  const storage = memoryStorage();
  const received = [];
  let accept = false;
  const { store, lib } = setup(storage, payload => {
    const persisted = JSON.parse(storage.getItem(lib.key));
    assert.ok(persisted.journal.some(entry => entry.session.runId === payload.runId));
    assert.ok(persisted.outbox.includes(payload.completionId));
    received.push(clone(payload));
    payload.rewardClaims.length = 0;
    if (!accept) throw Error('host offline');
  });
  const completion = store.complete(solved(store));
  let retry = await store.retry();
  assert.equal(retry.pending, 1);
  assert.equal(received.length, 1);
  assert.equal(store.progress().totalClaims, 3);
  accept = true;
  const promiseA = store.retry();
  const promiseB = store.retry();
  assert.equal(promiseA, promiseB, 'concurrent retries share one delivery attempt');
  retry = await promiseA;
  assert.equal(retry.pending, 0);
  assert.equal(retry.sent, 1);
  assert.equal(received.length, 2);
  assert.deepEqual(received[0], received[1]);
  assert.deepEqual(received[1], clone(completion.payload));
  await store.retry();
  assert.equal(received.length, 2);
  const restored = setup(storage, () => { throw Error('already acknowledged'); }).store;
  assert.equal((await restored.retry()).sent, 0);
  assert.equal(restored.progress().totalClaims, 3);
});

test('a forged outbox payload cannot be sent; only the reconstructed legal proof is delivered', async () => {
  const { storage, store, lib } = setup();
  const result = store.complete(solved(store));
  const raw = JSON.parse(storage.getItem(lib.key));
  raw.outbox = [{ completionId: result.payload.completionId, metrics: { moves: -1 }, rewardClaims: [{ rewardClaimId: 'forged' }] }];
  storage.setItem(lib.key, JSON.stringify(raw));
  const received = [];
  const restored = setup(storage, payload => received.push(clone(payload))).store;
  assert.match(restored.lastError, /规则校验/);
  await restored.retry();
  assert.equal(received.length, 1);
  assert.deepEqual(received[0], clone(result.payload));
});

test('failed persistence leaves the game playable but blocks external events until a successful write', async () => {
  const storage = memoryStorage();
  const received = [];
  const { store } = setup(storage, payload => received.push(payload));
  storage.failSet = true;
  const session = solved(store);
  assert.ok(session);
  assert.equal(store.saveSession(session), false);
  const result = store.complete(session);
  assert.equal(result.ok, true);
  assert.equal(result.saved, false);
  assert.equal(store.saved, false);
  assert.match(store.lastError, /无法保存/);
  assert.equal(store.progress().totalClaims, 3, 'temporary in-memory play remains available');
  assert.equal((await store.retry()).saved, false);
  assert.equal(received.length, 0);
  storage.failSet = false;
  await store.retry();
  assert.equal(received.length, 1);
  assert.equal(store.saved, true);
  assert.equal(setup(storage).store.progress().totalClaims, 3);
});

test('storage read failures and absent storage never prevent a new in-memory game', async () => {
  const storage = memoryStorage();
  storage.failGet = true;
  const { store } = setup(storage);
  assert.match(store.lastError, /读取/);
  assert.ok(store.newSession(mainLevels[0]));
  const absent = setup(null).store;
  const result = absent.complete(solved(absent));
  assert.equal(result.ok, true);
  assert.equal(result.saved, false);
  assert.equal(absent.markTutorial(), false);
  assert.equal(absent.tutorialSeen(), true);
  assert.equal((await absent.retry()).saved, false);
});

test('an unknown existing save is never overwritten when reads fail but writes would succeed', async () => {
  const storage = memoryStorage();
  const original = setup(storage);
  original.store.complete(solved(original.store));
  const active = original.store.newSession(mainLevels[1]);
  const originalRaw = storage.getItem(original.lib.key);
  const received = [];
  storage.failGet = true;
  const blocked = setup(storage, payload => received.push(payload)).store;
  assert.equal(blocked.saved, false);
  assert.equal((await blocked.retry()).saved, false, 'startup retry must not persist an assumed empty save');
  assert.equal(storage.values.get(original.lib.key), originalRaw);
  const temporary = solved(blocked);
  assert.equal(blocked.complete(temporary).ok, true);
  assert.equal(blocked.saved, false);
  assert.equal((await blocked.retry()).saved, false);
  assert.equal(received.length, 0);
  assert.equal(storage.values.get(original.lib.key), originalRaw, 'temporary play preserves the unknown original bytes');
  storage.failGet = false;
  assert.equal((await blocked.retry()).saved, false, 'this instance cannot merge unknown original and temporary sessions');
  assert.equal(storage.getItem(original.lib.key), originalRaw);
  const reopened = setup(storage).store;
  assert.equal(reopened.saved, true);
  assert.equal(reopened.loadSession().runId, active.runId);
  assert.equal(reopened.progress().completedCount, 1);
  assert.equal(reopened.progress().totalClaims, 3);
});

test('acknowledgement write failures use stable event IDs after reload', async () => {
  const storage = memoryStorage();
  const received = [];
  const { store } = setup(storage, payload => { received.push(clone(payload)); storage.failSet = true; });
  store.complete(solved(store));
  assert.equal((await store.retry()).saved, false);
  storage.failSet = false;
  const restored = setup(storage, payload => received.push(clone(payload))).store;
  await restored.retry();
  assert.equal(received.length, 2, 'receiver must deduplicate acknowledged-but-unsaved delivery by stable ID');
  assert.deepEqual(received[0], received[1]);
  assert.equal(restored.progress().totalClaims, 3);
});

test('real engine and all 60 campaign levels persist, replay, and recover with daily and seeded journeys', () => {
  const window = {};
  const context = vm.createContext({ window, console, Uint32Array });
  for (const file of ['engine.js', 'levels.js', 'storage.js']) {
    vm.runInContext(fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), context);
  }
  const storage = memoryStorage();
  const store = window.CraneStorage.create(storage);
  assert.equal(window.CraneLevels.levels.length, 60);
  for (const level of window.CraneLevels.levels) {
    const session = store.newSession(level, 'main');
    assert.ok(session, level.id + ' creates a session');
    session.timeline = clone(level.solution);
    assert.equal(store.saveSession(session), true, level.id + ' saves its legal solution');
    const result = store.complete(session, level);
    assert.equal(result.ok, true, level.id + ' completes');
    assert.equal(result.payload.metrics.moves, window.CraneEngine.count(window.CraneEngine.create(level)) - 1);
  }
  const daily = window.CraneLevels.daily('2026-09-08');
  const dailySession = store.newSession(daily, 'daily');
  assert.ok(dailySession);
  dailySession.timeline = clone(daily.solution);
  assert.equal(store.complete(dailySession).ok, true);
  const seeded = window.CraneLevels.seeded('return-home', 6);
  const seedSession = store.newSession(seeded, 'seeded');
  assert.ok(seedSession);
  seedSession.timeline = clone(seeded.solution);
  assert.equal(store.complete(seedSession).ok, true);
  const restored = window.CraneStorage.create(storage);
  assert.equal(restored.lastError, '');
  assert.equal(restored.progress().completedCount, 60);
  assert.equal(restored.progress().independentCount, 60);
  assert.equal(restored.progress().targetCount, 60);
  assert.equal(restored.progress().dailyCount, 1);
  assert.equal(restored.progress().seededCount, 1);
  assert.equal(restored.progress().totalClaims, 187);
  assert.equal(restored.loadSession().seed, 'return-home');
  assert.equal(restored.loadSession().chapter, 6);
  assert.equal(restored.complete(restored.loadSession()).duplicate, true);
  assert.equal(restored.progress().totalClaims, 187);
});
