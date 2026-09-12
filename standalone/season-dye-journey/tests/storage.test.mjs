import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const engineSource = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const storageSource = readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
const baseLevel = { id: 'test:01', mode: 'campaign', width: 2, height: 2, colours: 3,
  initialBoard: [0, 1, 1, 2], referenceMoves: 2, referencePath: [1, 2], moveLimit: 7 };
Object.freeze(baseLevel.initialBoard); Object.freeze(baseLevel.referencePath); Object.freeze(baseLevel);

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values, writes: [], failRead: false, failWrite: false,
    getItem(key) { if (this.failRead) throw new Error('blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (this.failWrite) throw new Error('quota'); this.writes.push({ key, value }); values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { throw new Error('Cross-game clear must never occur'); }
  };
}
function setup(storage = memoryStorage(), extraLevels = []) {
  const context = vm.createContext({ Date, Math, JSON, Promise, Uint32Array });
  vm.runInContext(engineSource + '\n' + storageSource, context);
  const { Engine, Storage } = context.Dye;
  const levels = [baseLevel, ...extraLevels];
  const resolve = (id) => levels.find((level) => level.id === id) || null;
  const store = Storage.create(storage, resolve);
  const win = (runId, path = [1, 2], level = baseLevel, hints = 0) => {
    let state = Engine.create(level, runId);
    for (const colour of path) {
      const result = Engine.move(state, level, colour);
      assert.equal(result.accepted, true);
      state = result.state;
    }
    state.hints = hints;
    assert.equal(state.status, 'won');
    return state;
  };
  return { Engine, Storage, store, storage, win, resolve };
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('session resumes by replay and safely preserves generated-level descriptor', () => {
  const daily = { ...baseLevel, id: 'daily:2026-09-08', mode: 'daily' };
  const { Engine, store, storage } = setup(memoryStorage(), [daily]);
  const state = Engine.move(Engine.create(daily, 'daily-run'), daily, 1).state;
  assert.equal(store.saveSession(state, { date: '2026-09-08' }).persisted, true);
  const recovered = setup(storage, [daily]).store;
  assert.deepEqual(plain(recovered.loadSession()), plain(state));
  assert.deepEqual(plain(recovered.sessionDescriptor()), { date: '2026-09-08' });
  assert.equal(recovered.progress().completedCount, 0);
});

test('completion evidence, progress and outbox commit in one atomic write', () => {
  const { store, storage, win, Storage } = setup();
  const saved = store.saveCompletion(win('once'));
  assert.equal(saved.ok, true);
  assert.equal(saved.persisted, true);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0].key, Storage.KEY);
  const raw = JSON.parse(storage.writes[0].value);
  assert.equal(raw.evidence.length, 1);
  assert.deepEqual(raw.outbox, [saved.payload.completionId]);
  assert.equal(raw.session.state.runId, 'once');
  assert.equal(saved.progress.totalStars, 3);
  assert.equal(saved.progress.campaignCompleted, 1);
  assert.equal(saved.payload.rewardClaims.length, 4);
  assert.deepEqual(Object.keys(saved.payload).sort(), ['schemaVersion', 'gameId', 'levelId', 'mode', 'runId', 'completionId', 'rewardClaims', 'metrics', 'completedAt'].sort());
});

test('same run and refreshed completion retain stable event and do not repeat rewards', () => {
  const { store, storage, win } = setup();
  const first = store.saveCompletion(win('stable'));
  const duplicate = store.saveCompletion(win('stable'));
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(plain(first.payload), plain(duplicate.payload));
  assert.equal(storage.writes.length, 1);
  const resumed = setup(storage).store;
  const refreshed = resumed.saveCompletion(resumed.loadSession());
  assert.deepEqual(plain(refreshed.payload), plain(first.payload));
  assert.equal(resumed.progress().outboxCount, 1);
  assert.equal(resumed.progress().totalStars, 3);
});

test('restarting a level creates a distinct event with no duplicate claims', () => {
  const { store, win } = setup();
  const first = store.saveCompletion(win('restart-1'));
  const again = store.saveCompletion(win('restart-2'));
  assert.notEqual(first.payload.completionId, again.payload.completionId);
  assert.equal(again.payload.rewardClaims.length, 0);
  assert.equal(store.progress().totalStars, 3);
  assert.equal(store.progress().completedCount, 1);
});

test('honest reference stars and improved records award only newly earned thresholds', () => {
  const { store, win } = setup();
  const one = store.saveCompletion(win('star-one', [2, 0, 2, 0, 1, 2], baseLevel, 4));
  const two = store.saveCompletion(win('star-two', [2, 0, 1, 2], baseLevel, 2));
  const three = store.saveCompletion(win('star-three', [1, 2], baseLevel, 10));
  assert.equal(one.payload.metrics.stars, 1);
  assert.equal(one.payload.rewardClaims.length, 2);
  assert.equal(two.payload.metrics.stars, 2);
  assert.equal(two.payload.rewardClaims.length, 1);
  assert.equal(three.payload.metrics.stars, 3);
  assert.equal(three.payload.rewardClaims.length, 1);
  const record = store.progress().levels[baseLevel.id];
  assert.equal(record.bestMoves, 2);
  assert.equal(record.bestHints, 2);
  assert.equal(record.stars, 3);
  assert.equal(store.progress().claims.length, 4);
});

test('optional host absence does not prevent local completion', async () => {
  const { store, win } = setup();
  store.saveCompletion(win('no-host'));
  const status = await store.flush();
  assert.equal(status.ok, true);
  assert.equal(status.hostAvailable, false);
  assert.equal(status.pending, 1);
  assert.equal(store.progress().campaignCompleted, 1);
});

test('host failure retries the identical persisted payload and acknowledges once', async () => {
  const { store, storage, win, Storage } = setup();
  const first = store.saveCompletion(win('retry'));
  const seen = [];
  const failed = await store.flush({ complete(event) {
    const disk = JSON.parse(storage.values.get(Storage.KEY));
    assert.ok(disk.outbox.includes(event.completionId));
    seen.push(event);
    throw new Error('offline');
  } });
  assert.equal(failed.ok, false);
  assert.equal(failed.pending, 1);
  const success = await store.flush({ complete(event) { seen.push(event); return Promise.resolve({ accepted: true }); } });
  assert.equal(success.sent, 1);
  assert.deepEqual(plain(seen[0]), plain(first.payload));
  assert.deepEqual(plain(seen[1]), plain(first.payload));
  assert.equal(setup(storage).store.progress().outboxCount, 0);
  assert.equal((await store.flush(() => { throw new Error('must not resend'); })).sent, 0);
});

test('concurrent flush requests share one delivery and host refusal retains outbox', async () => {
  const { store, win } = setup();
  store.saveCompletion(win('concurrent'));
  let sends = 0;
  let release;
  const host = { complete() { sends += 1; return new Promise((resolve) => { release = resolve; }); } };
  const first = store.flush(host);
  const second = store.flush(host);
  assert.equal(first, second);
  await Promise.resolve(); await Promise.resolve();
  release(false);
  assert.equal((await first).ok, false);
  assert.equal(sends, 1);
  assert.equal(store.progress().outboxCount, 1);
});

test('unavailable storage returns volatile status and never sends before persistence', async () => {
  const { store, storage, win } = setup();
  storage.failWrite = true;
  const completion = store.saveCompletion(win('volatile'));
  assert.equal(completion.ok, true);
  assert.equal(completion.persisted, false);
  assert.equal(completion.error, 'storage-unavailable');
  assert.equal(store.progress().totalStars, 3);
  let sent = 0;
  assert.equal((await store.flush(() => { sent += 1; })).ok, false);
  assert.equal(sent, 0);
  storage.failWrite = false;
  assert.equal((await store.flush(() => { sent += 1; })).ok, true);
  assert.equal(sent, 1);
  assert.equal(setup(storage).store.progress().totalStars, 3);
});

test('failed delivery acknowledgement can replay safely with stable IDs after reload', async () => {
  const { store, storage, win } = setup();
  const first = store.saveCompletion(win('ack-failure'));
  const events = [];
  const result = await store.flush((event) => { events.push(event); storage.failWrite = true; });
  assert.equal(result.error, 'delivery-ack-not-persisted');
  storage.failWrite = false;
  const reloaded = setup(storage).store;
  await reloaded.flush((event) => { events.push(event); });
  assert.equal(events.length, 2);
  assert.equal(events[0].completionId, first.payload.completionId);
  assert.deepEqual(plain(events[0]), plain(events[1]));
  assert.equal(reloaded.progress().totalStars, 3);
});

test('malformed save is isolated from other games and tutorial preference', () => {
  const { Storage } = setup();
  const storage = memoryStorage({ [Storage.KEY]: '{broken', [Storage.TUTORIAL_KEY]: '1', 'other-game:v1': 'keep' });
  const { store } = setup(storage);
  assert.equal(store.loadSession(), null);
  assert.equal(store.progress().totalStars, 0);
  assert.ok(store.progress().warnings.includes('invalid-journal'));
  assert.equal(store.seenTutorial(), true);
  assert.equal(storage.values.get('other-game:v1'), 'keep');
});

test('forged winning board, points and illegal logs cannot produce progress', () => {
  const { Engine, Storage } = setup();
  const legitimate = Engine.serialize(Engine.create(baseLevel, 'fake'));
  const state = { ...legitimate, board: [2, 2, 2, 2], moves: 2, status: 'won', timeline: [0, 2] };
  const raw = { schemaVersion: 1, gameId: 'season-dye-journey', session: { state },
    evidence: [{ state, completedAt: '2026-09-08T00:00:00.000Z', claims: ['unlimited-reward'] }],
    outbox: ['season-dye-journey:completion:fake'], totalStars: 999999, collected: ['everything'] };
  const { store } = setup(memoryStorage({ [Storage.KEY]: JSON.stringify(raw) }));
  assert.equal(store.loadSession(), null);
  assert.equal(store.progress().totalStars, 0);
  assert.equal(store.progress().outboxCount, 0);
  assert.equal(store.saveCompletion(state).ok, false);
});

test('restoration derives rewards from legal evidence and rejects altered reward claims', () => {
  const { store, storage, win, Storage } = setup();
  store.saveCompletion(win('verified'));
  const raw = JSON.parse(storage.values.get(Storage.KEY));
  raw.totalStars = 100000;
  raw.levels = { 'test:01': { stars: 100000 } };
  storage.values.set(Storage.KEY, JSON.stringify(raw));
  assert.equal(setup(storage).store.progress().totalStars, 3);
  raw.evidence[0].claims.push('season-dye-journey:star:test:01:99');
  storage.values.set(Storage.KEY, JSON.stringify(raw));
  assert.equal(setup(storage).store.progress().totalStars, 0);
});

test('tutorial version has its own key and neither skipping nor upgrading resets game data', () => {
  const { store, storage, win, Storage } = setup();
  store.saveCompletion(win('tutorial-independent'));
  const before = storage.values.get(Storage.KEY);
  assert.equal(store.seenTutorial(), false);
  assert.equal(store.markTutorial().persisted, true);
  assert.equal(storage.values.get(Storage.KEY), before);
  assert.equal(setup(storage).store.seenTutorial(), true);
  storage.values.set(Storage.PREFIX + 'tutorial:v2', '1');
  storage.values.delete(Storage.TUTORIAL_KEY);
  const upgraded = setup(storage).store;
  assert.equal(upgraded.seenTutorial(), false);
  assert.equal(upgraded.progress().totalStars, 3);
});

test('tutorial remains dismissed in memory when storage is blocked', () => {
  const storage = memoryStorage();
  storage.failRead = true; storage.failWrite = true;
  const { store } = setup(storage);
  assert.equal(store.seenTutorial(), false);
  assert.equal(store.markTutorial().persisted, false);
  assert.equal(store.seenTutorial(), true);
  assert.equal(store.status().persisted, false);
});

test('over-limit completion and reused run mutation are not rewarded', () => {
  const { Engine, store, win } = setup();
  store.saveCompletion(win('fixed-run'));
  assert.equal(store.saveCompletion(win('fixed-run', [2, 0, 1, 2])).error, 'run-already-completed');
  let state = Engine.create(baseLevel, 'too-long');
  for (const colour of [2, 0, 2, 0, 2, 0, 1, 2]) state = Engine.move(state, baseLevel, colour).state;
  assert.equal(state.status, 'over-limit');
  assert.equal(store.saveCompletion(state).error, 'not-complete');
  assert.equal(store.progress().completedCount, 1);
});

test('daily and workshop records restore independently from campaign collection', () => {
  const daily = { ...baseLevel, id: 'daily:2026-09-08', mode: 'daily' };
  const workshop = { ...baseLevel, id: 'workshop:17:4:3', mode: 'workshop' };
  const { store, storage, win } = setup(memoryStorage(), [daily, workshop]);
  store.saveCompletion(win('campaign'));
  assert.equal(store.saveCompletion(win('daily', [1, 2], daily)).payload.mode, 'daily');
  assert.equal(store.saveCompletion(win('workshop', [1, 2], workshop)).payload.mode, 'workshop');
  const p = setup(storage, [daily, workshop]).store.progress();
  assert.equal(p.completedCount, 3);
  assert.equal(p.campaignCompleted, 1);
  assert.equal(p.totalStars, 9);
  assert.deepEqual(plain(p.collected), ['test:01']);
});

test('run IDs differ across repeated restarts and obey engine format', () => {
  const { store } = setup();
  const ids = new Set(Array.from({ length: 1000 }, () => store.newRunId()));
  assert.equal(ids.size, 1000);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_.:-]{1,120}$/);
});

test('a full host queue still atomically saves a new campaign collection and survives refresh', () => {
  const newLevel = Object.freeze({ ...baseLevel, id: 'test:02' });
  const { store, storage, win, Storage } = setup(memoryStorage(), [newLevel]);
  for (let i = 0; i < Storage.MAX_OUTBOX; i += 1) assert.equal(store.saveCompletion(win('bounded-' + i)).ok, true);
  const before = JSON.parse(storage.values.get(Storage.KEY));
  const writesBefore = storage.writes.length;
  const overflow = store.saveCompletion(win('bounded-overflow', [1, 2], newLevel));
  assert.equal(overflow.ok, true);
  assert.equal(overflow.persisted, true);
  assert.equal(overflow.localOnly, true);
  assert.equal(overflow.syncQueued, false);
  assert.equal(storage.writes.length, writesBefore + 1);
  const raw = JSON.parse(storage.values.get(Storage.KEY));
  assert.equal(raw.evidence.length, Storage.MAX_OUTBOX + 1);
  assert.equal(raw.outbox.length, Storage.MAX_OUTBOX);
  assert.deepEqual(raw.outbox, before.outbox);
  assert.deepEqual(raw.evidence.slice(0, Storage.MAX_OUTBOX), before.evidence);
  assert.equal(raw.evidence.at(-1).localOnly, true);
  assert.equal(raw.session.state.runId, 'bounded-overflow');
  assert.equal(store.progress().totalStars, 6);
  const resumed = setup(storage, [newLevel]).store;
  assert.deepEqual(plain(resumed.progress().collected), ['test:01', 'test:02']);
  assert.ok(resumed.progress().warnings.includes('sync-queue-full'));
  const again = resumed.saveCompletion(resumed.loadSession());
  assert.equal(again.duplicate, true);
  assert.equal(again.localOnly, true);
  assert.equal(again.syncQueued, false);
  assert.deepEqual(plain(again.payload), plain(overflow.payload));
});

test('local-only records never enter retries and queued payloads remain unchanged', async () => {
  const { store, storage, win, Storage } = setup();
  const pending = [];
  for (let i = 0; i < Storage.MAX_OUTBOX; i += 1) pending.push(plain(store.saveCompletion(win('pending-' + i)).payload));
  const local = store.saveCompletion(win('local-after-full'));
  const resumed = setup(storage).store;
  const events = [];
  const delivery = await resumed.flush((event) => { events.push(plain(event)); });
  assert.equal(delivery.sent, Storage.MAX_OUTBOX);
  assert.deepEqual(events, pending);
  assert.equal(events.some((event) => event.completionId === local.payload.completionId), false);
  assert.equal(resumed.saveCompletion(resumed.loadSession()).localOnly, true);
  assert.equal(resumed.saveCompletion(resumed.loadSession()).syncQueued, false);
  assert.equal(resumed.progress().outboxCount, 0);
  const future = resumed.saveCompletion(win('queue-has-room-again'));
  assert.equal(future.localOnly, false);
  assert.equal(future.syncQueued, true);
  assert.equal(resumed.progress().outboxCount, 1);
});

test('local-only flags are type checked and cannot also be queued', () => {
  const { store, storage, win, Storage } = setup();
  store.saveCompletion(win('flag-type'));
  const original = JSON.parse(storage.values.get(Storage.KEY));
  original.evidence[0].localOnly = 'false';
  storage.values.set(Storage.KEY, JSON.stringify(original));
  assert.equal(setup(storage).store.progress().completedCount, 0);
  original.evidence[0].localOnly = true;
  storage.values.set(Storage.KEY, JSON.stringify(original));
  const local = setup(storage).store;
  assert.equal(local.progress().completedCount, 1);
  assert.equal(local.progress().outboxCount, 0);
  assert.ok(local.progress().warnings.includes('invalid-outbox'));
  delete original.evidence[0].localOnly;
  storage.values.set(Storage.KEY, JSON.stringify(original));
  const olderVersionOne = setup(storage).store;
  assert.equal(olderVersionOne.progress().outboxCount, 1);
  assert.equal(olderVersionOne.saveCompletion(olderVersionOne.loadSession()).localOnly, false);
});

test('512 evidence cap rotates generated records without evicting pending events or campaign growth', () => {
  const campaign = Array.from({ length: 71 }, (_, i) => Object.freeze({ ...baseLevel, id: 'campaign:' + i }));
  const generated = Array.from({ length: 230 }, (_, i) => Object.freeze({ ...baseLevel, id: 'workshop:' + i + ':4:3', mode: 'workshop' }));
  const { store, storage, win, Storage } = setup(memoryStorage(), [...campaign, ...generated]);
  for (let i = 0; i < Storage.MAX_OUTBOX; i += 1) store.saveCompletion(win('protected-' + i));
  const pending = JSON.parse(storage.values.get(Storage.KEY)).outbox;
  for (const level of campaign) assert.equal(store.saveCompletion(win(level.id, [1, 2], level)).persisted, true);
  for (const level of generated) assert.equal(store.saveCompletion(win('generated-' + level.id, [1, 2], level)).persisted, true);
  const raw = JSON.parse(storage.values.get(Storage.KEY));
  assert.equal(raw.evidence.length, Storage.MAX_EVIDENCE);
  assert.deepEqual(raw.outbox, pending);
  for (const id of pending) assert.ok(raw.evidence.some((entry) => id.endsWith(':' + entry.state.runId)));
  const resumed = setup(storage, [...campaign, ...generated]).store;
  assert.equal(resumed.progress().campaignCompleted, 72);
  for (const level of [baseLevel, ...campaign]) assert.equal(resumed.progress().levels[level.id].stars, 3);
  assert.equal(resumed.loadSession().levelId, generated.at(-1).id);
  assert.equal(resumed.saveCompletion(resumed.loadSession()).localOnly, true);
});

test('private immutable replay cache avoids repeated verification without trusting caller mutation', () => {
  const { store, Engine, win, storage } = setup();
  const state = win('private-cache');
  const saved = store.saveCompletion(state);
  state.board[0] = 0; state.timeline[0] = 0; state.status = 'playing';
  saved.payload.metrics.stars = 99;
  saved.progress.levels['test:01'].stars = 99;
  let restores = 0;
  const original = Engine.restore;
  Engine.restore = function (...args) { restores += 1; return original(...args); };
  assert.equal(store.progress().levels['test:01'].stars, 3);
  assert.equal(store.progress().levels['test:01'].bestMoves, 2);
  assert.equal(restores, 0);
  assert.equal(setup(storage).store.progress().levels['test:01'].stars, 3);
});

test('mutable level definitions are replayed instead of cached', () => {
  const mutable = { ...baseLevel, id: 'mutable-level', initialBoard: [0, 1, 1, 2], referencePath: [1, 2] };
  const { store, win } = setup(memoryStorage(), [mutable]);
  store.saveCompletion(win('mutable-rule', [1, 2], mutable));
  assert.equal(store.progress().completedCount, 1);
  mutable.initialBoard = [0, 2, 1, 0];
  assert.equal(store.progress().completedCount, 0);
});

test('acknowledged replay evidence can be pruned while retaining best campaign record', async () => {
  const { store, storage, win, Storage } = setup();
  store.saveCompletion(win('best', [1, 2]));
  for (let i = 0; i < Storage.MAX_EVIDENCE + 4; i += 1) {
    store.saveCompletion(win('prune-' + i, [2, 0, 1, 2]));
    await store.flush(() => true);
  }
  const raw = JSON.parse(storage.values.get(Storage.KEY));
  assert.equal(raw.evidence.length, Storage.MAX_EVIDENCE);
  assert.ok(raw.evidence.some((entry) => entry.state.runId === 'best'));
  assert.equal(setup(storage).store.progress().levels['test:01'].bestMoves, 2);
});
