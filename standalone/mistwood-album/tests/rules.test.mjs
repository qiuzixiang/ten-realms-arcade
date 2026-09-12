import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { solveIndependent } from '../scripts/independent-solver.mjs';
const require = createRequire(import.meta.url);
const R = require('../src/rules.js');
const L = require('../src/levels.js');
const truth = level => level.rows.join('').split('').map(value => value === '#' ? 1 : 2);
const cluesOnly = level => ({ width: level.width, height: level.height, rowClues: level.rowClues, columnClues: level.columnClues });

test('60 hand-drawn photographs in six 10-photo chapters; first twenty 5×5, rest 7×7', () => {
  assert.equal(L.levels.length, 60);
  assert.equal(L.chapters.length, 6);
  assert.equal(new Set(L.levels.map(level => level.id)).size, 60);
  for (const chapter of L.chapters) assert.equal(L.levels.filter(level => level.chapter === chapter.id).length, 10);
  for (const [i, level] of L.levels.entries()) {
    assert.equal(level.width, i < 20 ? 5 : 7);
    assert.equal(level.height, level.width);
    assert.equal(level.index, i + 1);
    assert.deepEqual(R.clues(level.rows), cluesOnly(level));
    assert.ok(level.title && level.caption && level.lesson);
    assert.equal(L.get(level.id), level);
  }
  assert.equal(L.get('nonexistent'), null);
});

function canonical(rows) {
  const keys = [];
  let current = rows;
  for (let i = 0; i < 4; i++) {
    keys.push(current.join('/'));
    keys.push(current.map(row => row.split('').reverse().join('')).join('/'));
    current = current.map((_, y) => current.map((row) => row[y]).reverse().join(''));
  }
  return keys.sort()[0];
}
test('all 60 photo designs are distinct, even after every rotation and reflection', () => {
  const seen = new Map();
  for (const level of L.levels) {
    const key = canonical(level.rows);
    assert.ok(!seen.has(key), `${level.id} repeats ${seen.get(key)}`);
    seen.set(key, level.id);
  }
});

test('independent exhaustive row-mask oracle proves all 60 clue sets unique (cap=2)', () => {
  let totalNodes = 0;
  for (const level of L.levels) {
    const proof = solveIndependent(cluesOnly(level), 2);
    assert.equal(proof.count, 1, `${level.id}: second solution found or no solution`);
    assert.equal(proof.exhausted, true, `${level.id}: search must be exhausted`);
    assert.deepEqual(proof.solutions[0], truth(level).map(v => v === 1 ? 1 : 0), level.id);
    totalNodes += proof.nodes;
  }
  assert.ok(totalNodes > 60);
});

test('oracle actually detects multiple solutions and impossible clue sets', () => {
  const ambiguous = { width: 2, height: 2, rowClues: [[1], [1]], columnClues: [[1], [1]] };
  const proof = solveIndependent(ambiguous, 2);
  assert.equal(proof.count, 2);
  assert.equal(proof.exhausted, false);
  assert.equal(solveIndependent({ ...ambiguous, columnClues: [[2], [2]] }, 2).count, 0);
  assert.throws(() => solveIndependent(ambiguous, 1));
});

test('independent oracle and production solver agree on every binary 3×3 photograph', () => {
  const seen = new Set();
  for (let bits = 0; bits < 512; bits++) {
    const rows = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => bits & 1 << (y * 3 + x) ? '#' : '.').join(''));
    const puzzle = R.clues(rows), key = JSON.stringify(puzzle);
    if (seen.has(key)) continue;
    seen.add(key);
    assert.equal(R.solve(puzzle, R.blank(puzzle), 2).length, solveIndependent(puzzle, 2).count, key);
  }
});

test('cell updates preserve unknown / filled / excluded states and are immutable', () => {
  const level = L.levels[0], grid = R.blank(level);
  assert.equal(grid.length, 25);
  assert.ok(grid.every(v => v === 0));
  const fill = R.apply(level, grid, 2, 1), exclude = R.apply(level, fill, 2, 2), erase = R.apply(level, exclude, 2, 0);
  assert.equal(grid[2], 0);
  assert.equal(fill[2], 1);
  assert.equal(exclude[2], 2);
  assert.deepEqual(erase, grid);
  assert.notEqual(fill, grid);
  assert.equal(R.apply(level, fill, 2, 1), fill);
  for (const index of [-1, 25, 1.5, NaN, '2']) assert.equal(R.apply(level, grid, index, 1), grid);
  for (const value of [-1, 3, undefined, null, '1', true]) assert.equal(R.apply(level, grid, 2, value), grid);
  const invalid = grid.slice(); invalid[3] = 99;
  assert.equal(R.apply(level, invalid, 0, 1), invalid);
  assert.equal(R.validGrid(level, invalid), false);
  assert.equal(R.validGrid(level, grid.slice(1)), false);
  assert.equal(R.validGrid({ ...level, rowClues: [null, [], [], [], []] }, grid), false);
});

test('completion requires every cell decided and every line correct, without reading a stored answer', () => {
  for (const level of L.levels) {
    const pure = cluesOnly(level), solved = truth(level);
    Object.defineProperty(pure, 'rows', { get() { throw new Error('completion read solution rows'); } });
    assert.equal(R.complete(pure, solved), true, level.id);
    assert.equal(R.complete(pure, R.blank(pure)), false);
    for (let i = 0; i < solved.length; i++) {
      const unknown = solved.slice(); unknown[i] = 0;
      assert.equal(R.complete(pure, unknown), false, `${level.id}: unknown at ${i}`);
      const wrong = solved.slice(); wrong[i] = wrong[i] === 1 ? 2 : 1;
      assert.equal(R.complete(pure, wrong), false, `${level.id}: wrong at ${i}`);
    }
  }
  assert.equal(R.complete(L.levels[0], null), false);
});

test('empty clues and separated run semantics are exact; exclusions are binding', () => {
  assert.deepEqual(R.lineClues([1, 1, 2, 1, 0]), [2, 1]);
  assert.deepEqual(R.lineOptions(5, []), [[0, 0, 0, 0, 0]]);
  assert.deepEqual(R.lineOptions(5, [], [0, 1, 0, 0, 0]), []);
  assert.deepEqual(R.lineOptions(5, [2, 2]), [[1, 1, 0, 1, 1]]);
  assert.deepEqual(R.lineOptions(4, [2, 2]), []);
  assert.equal(R.lineOptions(5, [3]).length, 3);
  assert.deepEqual(R.lineOptions(5, [3], [2, 0, 0, 0, 2]), [[0, 1, 1, 1, 0]]);
  assert.deepEqual(R.lineOptions(5, [0]), []);
  assert.deepEqual(R.lineOptions(5, [1], [1]), []);
  assert.throws(() => R.clues(['##', '#']));
  assert.throws(() => R.clues(['xx']));
});

test('current-state hints solve every photo without reading rows or applying an unsupported value', () => {
  for (const level of L.levels) {
    const pure = cluesOnly(level);
    Object.defineProperty(pure, 'rows', { get() { throw new Error('hint read solution rows'); } });
    let grid = R.blank(level), steps = 0;
    const expected = truth(level);
    while (!R.complete(pure, grid) && steps <= grid.length) {
      const hint = R.hint(pure, grid);
      assert.ok(hint, level.id);
      assert.notEqual(hint.kind, 'conflict', level.id);
      assert.ok(hint.index >= 0 && hint.index < grid.length, level.id);
      assert.equal(grid[hint.index], 0, level.id);
      assert.equal(hint.value, expected[hint.index], `${level.id}: unsound hint`);
      assert.ok(hint.text && hint.detail, level.id);
      grid = R.apply(pure, grid, hint.index, hint.value);
      steps++;
    }
    assert.equal(R.complete(pure, grid), true, level.id);
    assert.equal(R.hint(pure, grid), null, level.id);
  }
});

test('hints explain a row contradiction without silently fixing or penalizing it', () => {
  const level = L.levels[0], grid = R.blank(level); grid[5] = 1;
  const before = grid.slice(), hint = R.hint(level, grid);
  assert.equal(hint.kind, 'conflict');
  assert.equal(hint.axis, 'row');
  assert.equal(hint.line, 1);
  assert.match(hint.detail, /0/);
  assert.deepEqual(grid, before);
  assert.ok(R.analyze(level, grid).conflicts >= 1);
  assert.equal(R.analyze(level, truth(level)).complete, true);
});

test('hints catch global conflicts even when every individual line still has a candidate', () => {
  const level = { width: 3, height: 3, rowClues: [[1], [1], [1]], columnClues: [[1], [1], [1]] };
  const grid = [0, 2, 2, 0, 2, 2, 2, 0, 0];
  assert.equal(R.analyze(level, grid).conflicts, 0);
  const hint = R.hint(level, grid);
  assert.equal(hint.kind, 'conflict');
  assert.equal(hint.index, -1);
  assert.match(hint.detail, /交叉/);
});

test('daily mode deterministically selects a verified library photo and says it is a replay', () => {
  assert.equal(L.daily('2026-09-08'), L.daily('2026-09-08'));
  assert.ok(L.levels.includes(L.daily('2026-09-08')));
  const chosen = new Set(Array.from({ length: 28 }, (_, i) => L.daily(`2026-09-${String(i + 1).padStart(2, '0')}`).id));
  assert.ok(chosen.size >= 15);
  assert.match(L.dailyNote, /复拍/);
});
