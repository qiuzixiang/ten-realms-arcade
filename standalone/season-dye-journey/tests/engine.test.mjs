import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = vm.createContext({});
for (const file of ['engine.js', 'levels.js']) vm.runInContext(fs.readFileSync(new URL('src/' + file, root), 'utf8'), context, { filename: file });
const { Engine: E, Levels: L } = context.Dye;
const plain = value => JSON.parse(JSON.stringify(value));

/* Independent oracle uses repeated full-grid scans, not the engine's queue fill. */
function oracleRegion(board, width, start = 0) {
  const reached = new Set([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let cell = 0; cell < board.length; cell++) {
      if (reached.has(cell) || board[cell] !== board[start]) continue;
      const x = cell % width;
      const adjacent = (x > 0 && reached.has(cell - 1)) || (x + 1 < width && reached.has(cell + 1)) || reached.has(cell - width) || reached.has(cell + width);
      if (adjacent) { reached.add(cell); changed = true; }
    }
  }
  return reached;
}
function oracleFill(board, width, colour) {
  const result = board.slice();
  for (const cell of oracleRegion(board, width)) result[cell] = colour;
  return result;
}
function oracleComplete(board) { return new Set(board).size === 1; }
function regions(board, width) {
  const remaining = new Set(board.map((_, i) => i));
  let count = 0;
  while (remaining.size) {
    for (const cell of oracleRegion(board, width, remaining.values().next().value)) remaining.delete(cell);
    count++;
  }
  return count;
}
function canonical(board, n) {
  let matrix = Array.from({ length: n }, (_, y) => board.slice(y * n, y * n + n));
  const keys = [];
  for (let rotation = 0; rotation < 4; rotation++) {
    for (const view of [matrix, matrix.map(row => row.slice().reverse())]) {
      const mapping = new Map();
      const normalized = view.flat().map(colour => {
        if (!mapping.has(colour)) mapping.set(colour, mapping.size);
        return mapping.get(colour);
      });
      keys.push(n + ':' + normalized.join(''));
    }
    matrix = matrix.map((row, y) => row.map((_, x) => matrix[n - 1 - x][y]));
  }
  return keys.sort()[0];
}
function fixture(overrides = {}) {
  return { id: 'fixture', width: 2, height: 2, colours: 3, initialBoard: [0, 1, 1, 2], referencePath: [1, 2], referenceMoves: 2, moveLimit: 2, ...overrides };
}
function replayReference(level) {
  let board = Array.from(level.initialBoard);
  for (const colour of level.referencePath) {
    assert.notEqual(colour, board[0], level.id + ': same-colour reference step');
    assert(!oracleComplete(board), level.id + ': extra action after completion');
    board = oracleFill(board, level.width, colour);
  }
  assert(oracleComplete(board), level.id + ': independent reference replay is incomplete');
  assert(level.referenceMoves <= level.moveLimit, level.id + ': reference exceeds budget');
  return board;
}

test('all 72 authored main levels independently replay within their budgets', () => {
  assert.equal(L.all.length, 72);
  assert.equal(new Set(L.all.map(level => level.id)).size, 72);
  for (const level of L.all) {
    assert(E.validateLevel(level), level.id);
    assert.equal(new Set(level.initialBoard).size, level.colours, level.id + ': missing dye');
    assert.equal(level.referencePath.length, level.referenceMoves);
    const expected = replayReference(level);
    let state = E.create(level, 'test:' + level.id);
    for (const colour of level.referencePath) state = E.move(state, level, colour).state;
    assert.equal(state.status, 'won');
    assert.equal(state.controlled, level.width * level.height);
    assert.deepEqual(plain(state.board), expected);
    assert(Object.isFrozen(level) && Object.isFrozen(level.initialBoard) && Object.isFrozen(level.referencePath));
  }
});

test('72 boards remain distinct after every D4 symmetry and colour renaming', () => {
  const keys = L.all.map(level => canonical(Array.from(level.initialBoard), level.width));
  assert.equal(new Set(keys).size, 72);
  const original = [0, 1, 2, 0, 0, 2, 1, 1, 0];
  const mirroredRenamed = [0, 1, 2, 0, 2, 2, 2, 1, 1];
  assert.equal(canonical(original, 3), canonical(mirroredRenamed, 3), 'dedup oracle catches mirror plus colour renaming');
});

test('six chapters genuinely progress in scale, dyes, reference work, and fragmentation', () => {
  assert.equal(L.chapters.length, 6);
  let previousMean = 0, previousRegions = 0;
  const stats = L.chapters.map(chapter => {
    const levels = L.all.filter(level => level.chapter === chapter.id);
    assert.equal(levels.length, 12);
    assert.equal(new Set(levels.map(level => level.topology)).size >= 6, true);
    const mean = levels.reduce((sum, level) => sum + level.referenceMoves, 0) / levels.length;
    const regionMean = levels.reduce((sum, level) => sum + regions(Array.from(level.initialBoard), level.width), 0) / levels.length;
    assert(mean > previousMean, 'mean reference work rises chapter to chapter');
    assert(regionMean > previousRegions, 'mean region count rises chapter to chapter');
    previousMean = mean; previousRegions = regionMean;
    return { chapter: chapter.id, size: [...new Set(levels.map(level => level.width))], colours: [...new Set(levels.map(level => level.colours))], referenceMin: Math.min(...levels.map(level => level.referenceMoves)), referenceMax: Math.max(...levels.map(level => level.referenceMoves)), referenceMean: +mean.toFixed(2), regionMean: +regionMean.toFixed(2), leniency: [...new Set(levels.map(level => level.moveLimit - level.referenceMoves))] };
  });
  assert.equal(L.all[0].width, 4); assert.equal(L.all[0].colours, 3);
  assert.equal(L.all[71].width, 10); assert.equal(L.all[71].colours, 6);
  console.log('Verified progression:', JSON.stringify(stats));
});

test('all 81 three-colour 2×2 boards agree with an independent flood oracle', () => {
  for (let code = 0; code < 81; code++) {
    const board = Array.from({ length: 4 }, (_, i) => Math.floor(code / (3 ** i)) % 3);
    for (let colour = 0; colour < 3; colour++) {
      const snapshot = board.slice();
      const filled = E.fill(board, 2, 2, colour);
      assert.equal(filled.accepted, colour !== board[0]);
      if (filled.accepted) {
        assert.deepEqual(plain(filled.board), oracleFill(board, 2, colour));
        assert.equal(filled.expandedBy, oracleRegion(filled.board, 2).size - oracleRegion(board, 2).size);
        assert.deepEqual(new Set(plain(filled.absorbed)), new Set([...oracleRegion(filled.board, 2)].filter(i => !oracleRegion(board, 2).has(i))));
      } else assert.equal(filled.board, board);
      assert.deepEqual(board, snapshot, 'fill is immutable');
    }
  }
  assert.deepEqual(plain(E.component([0, 1, 1, 0], 2, 2)), [0], 'diagonal contact does not connect');
  assert.deepEqual(plain(E.component([0, 1, 0, 0, 1, 0], 3, 2)), [0, 3], 'row edges do not wrap');
});

test('tutorial cards are an actual initial board, accepted dye, and completed state', () => {
  const level = L.get('c1-01'), initial = E.create(level, 'tutorial:truth');
  assert.equal(initial.controlled, 4);
  assert.equal(initial.moves, 0);
  assert.deepEqual(plain(level.referencePath), [1, 2]);
  const action = E.move(initial, level, 1);
  assert(action.accepted); assert.equal(action.expandedBy, 8);
  assert.equal(action.state.controlled, 12); assert.equal(action.state.status, 'playing');
  assert.deepEqual(plain(action.state.board), [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2]);
  const goal = E.move(action.state, level, 2);
  assert(goal.accepted); assert.equal(goal.state.status, 'won'); assert.equal(goal.state.moves, 2);
  assert.deepEqual(plain(goal.state.board), Array(16).fill(2));
});

test('illegal actions are atomic no-ops and zero-expansion dyes still count', () => {
  const level = fixture(), state = E.create(level, 'run:illegal'), before = plain(state);
  for (const colour of [0, -1, 3, 6, NaN, Infinity, 1.5, '1', null, undefined]) {
    const result = E.move(state, level, colour);
    assert.equal(result.accepted, false); assert.equal(result.state, state);
    assert.deepEqual(plain(state), before);
  }
  const result = E.move(state, level, 2);
  assert(result.accepted); assert.equal(result.expandedBy, 0);
  assert.equal(result.state.moves, 1); assert.equal(result.state.wastes, 1);
  assert.deepEqual(plain(result.state.board), [2, 1, 1, 2]);
  assert.deepEqual(plain(state), before);
  assert.equal(E.fill([0, 1], 0, Infinity, 2).accepted, false);
  assert.equal(E.fill([0, -1], 2, 1, 2).accepted, false);
  assert.equal(E.move(state, fixture({ id: 'other' }), 1).accepted, false);
  assert.equal(E.create(level, ''), null);
});

test('winning, exact-budget failure, and completed over-budget practice are distinct', () => {
  const level = fixture();
  let state = E.create(level, 'run:won');
  state = E.move(state, level, 1).state;
  assert.equal(state.status, 'playing');
  state = E.move(state, level, 2).state;
  assert.equal(state.status, 'won'); assert.equal(state.moves, 2);
  assert.equal(E.move(state, level, 0).reason, 'complete');
  let practice = E.create(level, 'run:practice');
  practice = E.move(practice, level, 2).state;
  practice = E.move(practice, level, 1).state;
  assert.equal(practice.status, 'over-limit'); assert.equal(E.complete(practice.board), false);
  practice = E.move(practice, level, 2).state;
  assert.equal(practice.status, 'over-limit'); assert.equal(E.complete(practice.board), true);
  assert.equal(E.move(practice, level, 1).accepted, false);
});

test('undo faithfully restores board, counters, status, hints, and stable run id', () => {
  const level = fixture(), initial = E.create(level, 'run:undo');
  assert.equal(E.undo(initial, level), initial);
  initial.hints = 3;
  const step = E.move(initial, level, 1).state;
  const won = E.move(step, level, 2).state;
  assert.deepEqual(plain(E.undo(won, level)), plain(step));
  assert.deepEqual(plain(E.undo(step, level)), plain(initial));
  const waste = E.move(initial, level, 2).state;
  assert.equal(waste.wastes, 1); assert.equal(E.undo(waste, level).wastes, 0);
});

test('hints solve the current board, make real progress, and leave it unchanged', () => {
  for (const level of L.all.filter((_, index) => index % 5 === 0)) {
    let state = E.create(level, 'run:hint-' + level.id);
    for (let step = 0; step < Math.min(3, level.referenceMoves - 1); step++) {
      const choices = Array.from({ length: level.colours }, (_, i) => i).filter(c => c !== state.board[0]);
      const candidate = choices[(step + 1) % choices.length];
      const result = E.move(state, level, candidate);
      if (E.complete(result.state.board)) break;
      state = result.state;
    }
    const before = plain(state), hint = E.suggest(state.board, level);
    assert(hint && hint.path.length && hint.expandedBy > 0, level.id);
    assert.equal(hint.color, hint.path[0]); assert.deepEqual(plain(state), before);
    let board = Array.from(state.board);
    for (const colour of hint.path) board = oracleFill(board, level.width, colour);
    assert(oracleComplete(board), level.id + ': suggested route must really finish');
  }
  assert.equal(E.suggest([2, 2, 2, 2], fixture()), null);
  assert.equal(E.suggest([9, 0, 0, 0], fixture()), null);
  assert.equal(E.complete([null, null]), false);
  assert.equal(E.complete([undefined]), false);
});

test('restoration only accepts replayable logs and rejects forged derived claims', () => {
  const level = fixture(), resolve = id => id === level.id ? level : null;
  let state = E.create(level, 'run:restore');
  state = E.move(state, level, 1).state;
  state.hints = 2;
  const encoded = E.serialize(state);
  assert.deepEqual(plain(E.restore(encoded, resolve)), plain(state));
  assert.deepEqual(plain(E.restore(JSON.stringify(state), resolve)), plain(state));
  for (const mutation of [
    { version: 2 }, { levelId: 'missing' }, { runId: '' }, { runId: '<bad>' }, { timeline: [0] },
    { timeline: [1, 2, 0] }, { timeline: [7] }, { timeline: ['1'] }, { timeline: null },
    { hints: -1 }, { hints: 10001 }, { hints: '0' }, { moves: 999 }, { status: 'won' },
    { board: [2, 2, 2, 2] }, { board: [1] }, { wastes: 999 }, { controlled: 4 }
  ]) assert.equal(E.restore({ ...encoded, ...mutation }, resolve), null, JSON.stringify(mutation));
  for (const raw of ['', '{', 'null', null, undefined, [], 42]) assert.equal(E.restore(raw, resolve), null);
  assert.equal(E.restore(encoded, () => { throw new Error('resolver unavailable'); }), null);
  const won = E.move(state, level, 2).state;
  assert.equal(E.restore(E.serialize(won), resolve).status, 'won');
});

test('the 512-step cap preserves undo and rejects oversized restore logs', () => {
  const level = fixture({ initialBoard: [0, 1, 1, 1], referencePath: [1], referenceMoves: 1, moveLimit: 1 });
  let state = E.create(level, 'run:long');
  for (let i = 0; i < 512; i++) {
    const result = E.move(state, level, i % 2 === 0 ? 2 : 0);
    assert(result.accepted); assert.equal(result.expandedBy, 0); state = result.state;
  }
  assert.equal(state.moves, 512); assert.equal(state.wastes, 512);
  assert.equal(E.move(state, level, 2).reason, 'history-limit');
  assert.equal(E.restore(E.serialize(state), () => level).moves, 512);
  const shorter = E.undo(state, level);
  assert.equal(shorter.moves, 511); assert.equal(E.move(shorter, level, 0).accepted, true);
  const tooLong = E.serialize(state); tooLong.timeline.push(2);
  assert.equal(E.restore(tooLong, () => level), null);
});

test('daily and workshop boards are deterministic, validated, and restore by their ids', () => {
  const daily = L.daily('2026-09-08');
  assert.equal(daily.mode, 'daily'); assert.deepEqual(plain(daily), plain(L.get(daily.id)));
  assert.notDeepEqual(plain(daily.initialBoard), plain(L.daily('2026-09-09').initialBoard));
  replayReference(daily);
  assert.equal(L.daily('2026-02-30'), null); assert.equal(L.daily('2026-9-8'), null);
  const keys = new Set();
  for (const size of [4, 6, 8, 10]) for (const colours of [3, 4, 5, 6]) for (const seed of [0, 1, 9283]) {
    const level = L.workshop(seed, size, colours);
    assert(E.validateLevel(level)); assert.equal(level.mode, 'workshop');
    assert.equal(new Set(level.initialBoard).size, colours);
    replayReference(level);
    assert.deepEqual(plain(level), plain(L.get(level.id)));
    const state = E.create(level, 'run:generated');
    assert.deepEqual(plain(E.restore(E.serialize(state), L.get)), plain(state));
    keys.add(level.id + ':' + level.initialBoard.join(''));
  }
  assert.equal(keys.size, 48);
  const textSeed = L.workshop('春水', 6, 4);
  assert.deepEqual(plain(textSeed), plain(L.workshop('春水', 6, 4)));
  for (const input of [[1, 3, 3], [1, 11, 3], [1, 6, 2], [1, 6, 7]]) assert.equal(L.workshop(...input), null);
  for (const id of ['missing', '__proto__', 'constructor', 'toString', 'workshop:4294967296:4:3', 'workshop:01:4:3', 'daily:2026-02-31']) assert.equal(L.get(id), null);
});
