import test from 'node:test';
import assert from 'node:assert/strict';
import { COVER, FLAG, OPEN, HIT, apply, isWon, neighbors, newGame, publicView, readings, replay, safeLeft, undo, validateLevel } from './engine.mjs';
import { certify, deductions } from './proof.mjs';
import { LEVELS } from './levels.mjs';
import { PREFIX, completionFromSession, flushOutbox, loadOutbox, loadRecords, normalizeSession, settle } from './store.mjs';
import { createPlatformStorage } from './platform-storage.mjs';

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
}
function independentNumbers(width, height, mines) {
  const truth = new Set(mines), result = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (truth.has(y * width + x)) { result.push(-1); continue; }
    let total = 0;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++)
      for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++)
        if (truth.has(yy * width + xx)) total++;
    result.push(total);
  }
  return result;
}

test('all 60 levels are distinct and certified from the specified start', () => {
  assert.equal(LEVELS.length, 60);
  assert.equal(new Set(LEVELS.map(level => level.id)).size, 60);
  for (let chapter = 1; chapter <= 6; chapter++) assert.equal(LEVELS.filter(level => level.chapter === chapter).length, 10);
  const signatures = new Set();
  for (const level of LEVELS) {
    assert.ok(validateLevel(level), level.id);
    const signature = `${level.width}x${level.height}:${level.mines.join(',')}`;
    assert.ok(!signatures.has(signature), level.id); signatures.add(signature);
    assert.deepEqual(readings(level), independentNumbers(level.width, level.height, level.mines), level.id);
    const proof = certify(level);
    assert.ok(proof, level.id);
    assert.ok(isWon(proof.state), level.id);
    assert.equal(safeLeft(proof.state), 0, level.id);
    assert.equal(proof.timeline.length, level.certificate.moves, level.id);
    assert.deepEqual(proof.counts, level.certificate.methods, level.id);
    assert.deepEqual(replay(level, proof.timeline)?.state, proof.state, level.id);
    // Recheck each claimed reason from the visible state before its action.
    let state = apply(newGame(level), level, proof.timeline[0]).state;
    for (let i = 1; i < proof.timeline.length; i++) {
      const suggestion = deductions(publicView(level, state));
      assert.deepEqual(proof.timeline[i], { type: suggestion.steps[0].type, index: suggestion.steps[0].index }, `${level.id} step ${i}`);
      state = apply(state, level, proof.timeline[i]).state;
    }
  }
  assert.ok(LEVELS.slice(0, 20).every(level => !level.certificate.methods.subset && !level.certificate.methods.enumeration));
  assert.ok(LEVELS.slice(20, 30).every(level => level.certificate.methods.subset > 0));
  assert.ok(LEVELS.slice(30, 40).every(level => level.certificate.methods.total || level.certificate.methods.enumeration));
  assert.ok(LEVELS.slice(50, 60).every(level => level.certificate.methods.enumeration > 0));
});

test('small boards match an independent coordinate oracle and zero expansion', () => {
  for (let mask = 1; mask < 1 << 9; mask++) {
    if (mask === (1 << 9) - 1) continue;
    const mines = Array.from({ length: 9 }, (_, i) => i).filter(i => mask & (1 << i));
    const firstSafe = Array.from({ length: 9 }, (_, i) => i).find(i => !mines.includes(i));
    const level = { width: 3, height: 3, seed: 11, mines, firstSafe };
    assert.deepEqual(readings(level), independentNumbers(3, 3, mines));
    const opened = apply(newGame(level), level, { type: 'scan', index: firstSafe });
    assert.equal(opened.hit.length, 0);
    const grid = independentNumbers(3, 3, mines);
    const expected = new Set([firstSafe]), queue = [firstSafe];
    while (queue.length) {
      const i = queue.pop(); if (grid[i] !== 0) continue;
      for (let j = 0; j < 9; j++) {
        if (Math.abs((j % 3) - (i % 3)) <= 1 && Math.abs(Math.floor(j / 3) - Math.floor(i / 3)) <= 1 && !mines.includes(j) && !expected.has(j)) {
          expected.add(j); queue.push(j);
        }
      }
    }
    assert.deepEqual(new Set(opened.opened), expected);
  }
  assert.deepEqual(neighbors(3, 3, 0), [1, 3, 4]);
});

test('first scan relocation, flags, failure, chord and undo retain the rule boundaries', () => {
  const level = { width: 3, height: 3, seed: 17, firstSafe: 4, mines: [0, 2] };
  const initial = newGame(level);
  const mark = apply(initial, level, { type: 'flag', index: 0 });
  assert.equal(mark.state.scans, 0);
  assert.equal(mark.state.cells[0], FLAG);
  const firstOnMine = apply(initial, level, { type: 'scan', index: 0 });
  assert.equal(firstOnMine.hit.length, 0);
  assert.ok(!firstOnMine.state.mines.includes(0));
  assert.equal(firstOnMine.state.mines.length, 2);
  assert.deepEqual(apply(initial, level, { type: 'scan', index: 0 }).state.mines, firstOnMine.state.mines);
  let state = apply(initial, level, { type: 'scan', index: 4 }).state;
  assert.equal(state.cells[4], OPEN);
  assert.equal(apply(state, level, { type: 'scan', index: 4 }).changed, false);
  assert.equal(apply(state, level, { type: 'chord', index: 4 }).changed, false);
  const safeCount = safeLeft(state);
  state = apply(state, level, { type: 'flag', index: 0 }).state;
  assert.equal(safeLeft(state), safeCount);
  const wrong = apply(state, level, { type: 'flag', index: 1 }).state;
  const failed = apply(wrong, level, { type: 'chord', index: 4 });
  assert.equal(failed.state.phase, 'lost');
  assert.ok(failed.hit.includes(2));
  assert.equal(apply(failed.state, level, { type: 'scan', index: 3 }).changed, false);
  const restored = undo(wrong, failed.state);
  assert.equal(restored.phase, 'playing');
  assert.equal(restored.cells[2], COVER);
  assert.deepEqual(restored.errors, [2]);
  assert.equal(safeLeft(restored), safeLeft(wrong));
  const correct = apply(state, level, { type: 'flag', index: 2 }).state;
  assert.ok(isWon(apply(correct, level, { type: 'chord', index: 4 }).state));
  let unmarkedWin = apply(initial, level, { type: 'scan', index: 4 }).state;
  for (let i = 0; i < 9; i++) if (!level.mines.includes(i) && unmarkedWin.cells[i] === COVER)
    unmarkedWin = apply(unmarkedWin, level, { type: 'scan', index: i }).state;
  assert.ok(isWon(unmarkedWin));
  assert.equal(unmarkedWin.cells.filter(cell => cell === FLAG).length, 0);
  const tiny = { width: 2, height: 2, seed: 1, firstSafe: 3, mines: [0, 1] };
  const fallback = apply(newGame(tiny), tiny, { type: 'scan', index: 0 });
  assert.equal(fallback.hit.length, 0);
  assert.equal(fallback.state.mines.length, 2);
});

test('public inference depends only on visible numbers and reports capped searches as unknown', () => {
  const view = { width: 3, height: 3, mineCount: 2,
    cells: [COVER, COVER, COVER, COVER, OPEN, COVER, COVER, COVER, COVER],
    numbers: [null, null, null, null, 2, null, null, null, null] };
  const first = deductions(view);
  assert.deepEqual(first, deductions(structuredClone(view)));
  assert.equal(first.steps.length, 0);
  const capped = deductions(view, 1);
  assert.equal(capped.limited, true);
  assert.equal(capped.steps.length, 0);
});

test('session recovery and completion records revalidate replay and deduplicate', async () => {
  const level = LEVELS[0], proof = certify(level), memory = new MemoryStorage();
  const candidate = { levelId: level.id, mode: 'campaign', runId: 'run-test-1', hints: 0, timeline: proof.timeline };
  const session = normalizeSession(candidate);
  assert.ok(session && isWon(session.state));
  assert.equal(normalizeSession({ ...candidate, timeline: [{ type: 'scan', index: 1 }] }), null);
  assert.equal(normalizeSession({ ...candidate, timeline: [{ type: 'undo' }] }), null);
  const completion = completionFromSession(session);
  assert.ok(completion);
  assert.ok(PREFIX.startsWith('mini-polish:amber-strata-survey:v1:'));
  assert.deepEqual(settle(memory, completion), { saved: true, first: true });
  assert.deepEqual(settle(memory, completion), { saved: true, first: false });
  assert.equal(loadRecords(memory).length, 1);
  assert.equal(loadOutbox(memory).length, 1);
  const fasterSession = normalizeSession({ ...candidate, runId: 'run-test-2', timeline: [
    { type: 'scan', index: level.firstSafe },
    ...proof.timeline.filter(action => action.type === 'scan').slice(1),
  ] });
  assert.ok(fasterSession && isWon(fasterSession.state));
  const faster = completionFromSession(fasterSession);
  assert.deepEqual(settle(memory, faster), { saved: true, first: false });
  assert.equal(loadRecords(memory).length, 1);
  assert.equal(loadRecords(memory)[0].moves, faster.moves);
  assert.equal(loadOutbox(memory).length, 2);
  const sent = [];
  assert.equal(await flushOutbox(memory, { complete: item => sent.push(item.eventId) }), true);
  assert.deepEqual(sent, [completion.eventId, faster.eventId]);
  assert.equal(loadOutbox(memory).length, 0);
  assert.deepEqual(settle(memory, faster), { saved: true, first: false });
  assert.equal(await flushOutbox(memory, { async complete() { throw new Error('offline'); } }), false);
  assert.equal(loadOutbox(memory).length, 1);
  memory.setItem(PREFIX + 'records', JSON.stringify([{ ...completion, moves: 0 }]));
  assert.equal(loadRecords(memory).length, 0);
});

test('native cache is preferred when available and reports failed durable writes', async () => {
  const writes = new Map(), browser = new MemoryStorage();
  browser.setItem(PREFIX + 'session', 'browser-copy');
  const host = { launchOptions: { miniToolEnv: { buildVersion: 9462004 } }, miniTool: {
    async getStorage({ key }) { return { data: key === PREFIX + 'session' ? 'native-copy' : null }; },
    async setStorage({ key, data }) { writes.set(key, data); },
  } };
  const cache = await createPlatformStorage(host, browser);
  assert.equal(cache.kind, 'xhs');
  assert.equal(cache.getItem(PREFIX + 'session'), 'native-copy');
  cache.setItem(PREFIX + 'session', 'new-copy');
  assert.equal(await cache.flush(), true);
  assert.equal(writes.get(PREFIX + 'session'), 'new-copy');
  assert.equal(browser.getItem(PREFIX + 'session'), 'browser-copy');
  host.miniTool.setStorage = async () => { throw new Error('quota'); };
  cache.setItem(PREFIX + 'records', '[]');
  assert.equal(await cache.flush(), false);
  const fallback = await createPlatformStorage({ launchOptions: { miniToolEnv: { buildVersion: 9459000 } }, miniTool: host.miniTool }, browser);
  assert.equal(fallback.kind, 'browser');
});
