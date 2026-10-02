import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, randomBelow, findLines, findPath, scoreFor, move, replay, tutorialStates } from '../core.mjs';
const reference = JSON.parse(await readFile(new URL('./reference-fixtures.json', import.meta.url)));
const fixture = () => ({ ...createGame(121), board: Array(81).fill(0), score: 0, removed: Array(7).fill(0) });

test('283 line fixtures match the archived 1.21 instruction oracle, including intersections and scan boundaries', () => {
  for (const [i, c] of reference.cases.entries()) {
    const result = findLines(c.board, c.at);
    assert.equal(result.count, c.count, `case ${i} count`);
    assert.deepEqual(result.cells, c.removed, `case ${i} removed`);
  }
});
test('every supported score matches the original instruction oracle', () => {
  for (const [n, expected] of Object.entries(reference.scores)) assert.equal(scoreFor(Number(n)), expected);
  assert.equal(scoreFor(4), 0); assert.equal(scoreFor(NaN), 0);
});
test('LCG uses original 32-bit overflow and high fifteen bits', () => {
  let state = { rng: 1 };
  assert.equal(randomBelow(state, 32768), 16838);
  assert.equal(randomBelow(state, 32768), 5758);
  assert.equal(randomBelow(state, 32768), 10113);
});
test('initial seed is reproducible; five starting slots, seven colors, three-color preview', () => {
  for (let seed = 0; seed < 250; seed++) {
    const a = createGame(seed); assert.deepEqual(a, createGame(seed));
    assert.equal(a.board.length, 81); assert.equal(a.next.length, 3);
    assert.equal(a.board.filter(Boolean).length, 5);
    assert.ok(a.board.every((c) => c >= 0 && c <= 7)); assert.ok(a.next.every((c) => c >= 1 && c <= 7));
    assert.equal(a.score, 0);
  }
  assert.notDeepEqual(createGame(1), createGame(2));
});
test('movement requires an orthogonal empty path, with original reverse tie-breaking', () => {
  const s = fixture(); s.board[0] = 1;
  assert.deepEqual(findPath(s.board, 0, 10), [0, 1, 10]);
  s.board[1] = 2; s.board[9] = 2;
  assert.equal(findPath(s.board, 0, 10), null);
  assert.equal(findPath(s.board, 0, 1), null);
  assert.equal(findPath(s.board, 0, -1), null);
  assert.equal(findPath(s.board, 81, 10), null);
});
test('illegal moves are atomic no-ops, including the random queue and turn counter', () => {
  const s = fixture(); s.board[0] = 1; s.board[1] = 2; s.board[9] = 3;
  const original = structuredClone(s);
  const result = move(s, 0, 10);
  assert.equal(result.ok, false); assert.equal(result.state, s); assert.deepEqual(result.events, []); assert.deepEqual(s, original);
});
test('active five-line gives ten points and does not consume the preview or random generator', () => {
  const { before, after, events } = tutorialStates();
  assert.equal(after.score, 10); assert.equal(after.turns, 1);
  assert.equal(after.board.filter(Boolean).length, 4);
  assert.equal(before.board.filter(Boolean).length, 9);
  assert.deepEqual(after.next, before.next); assert.equal(after.rng, before.rng);
  assert.deepEqual(events.map((e) => e.type), ['move', 'clear']);
});
test('two five-lines score sixty while removing their nine unique cells', () => {
  const s = fixture();
  for (const i of [38, 39, 41, 42, 20, 30, 50, 60, 13]) s.board[i] = 1;
  const result = move(s, 13, 40);
  assert.equal(result.ok, true); assert.equal(result.state.score, 60);
  assert.equal(result.state.board.filter(Boolean).length, 0);
  assert.equal(result.events[1].cells.length, 9);
  assert.equal(result.events.length, 2);
});
test('ordinary move consumes exactly the three preview colors in order', () => {
  const s = fixture(); s.board[0] = 4; s.next = [1, 2, 3];
  const result = move(s, 0, 1);
  assert.deepEqual(result.events.filter((e) => e.type === 'spawn').map((e) => e.color), [1, 2, 3]);
  assert.equal(result.state.board.filter(Boolean).length, 4); assert.equal(result.state.score, 0);
});
test('automatic clear gives zero points and retries that spawn slot', () => {
  const s = fixture(); for (let i = 0; i < 4; i++) s.board[i] = 2; s.board[75] = 1; s.next = [2, 3, 4];
  for (let seed = 0;; seed++) { const r = { rng: seed }; if (randomBelow(r, 76) === 0) { s.rng = seed; break; } }
  const result = move(s, 75, 76);
  assert.equal(result.state.score, 0);
  assert.equal(result.events.filter((e) => e.type === 'spawn').length, 4);
  const clear = result.events.find((e) => e.type === 'clear');
  assert.equal(clear.automatic, true); assert.equal(clear.points, 0); assert.deepEqual(clear.cells, [0, 1, 2, 3, 4]);
  assert.equal(result.state.removed[1], 5);
});
test('fewer than three spaces are handled without overwrite; full board ends game', () => {
  const s = fixture(); s.board = Array.from({ length: 81 }, (_, i) => (i % 9 + 2 * Math.floor(i / 9)) % 7 + 1); s.board[0] = 0;
  const result = move(s, 1, 0);
  assert.equal(result.ok, true); assert.equal(result.state.gameOver, true);
  assert.equal(result.events.filter((e) => e.type === 'spawn').length, 1);
  assert.equal(move(result.state, 0, 1).ok, false);
});
test('last-space automatic clear resolves before game-over detection and remaining spawns', () => {
  const s = fixture(); s.board = Array.from({ length: 81 }, (_, i) => (i % 9 + 2 * Math.floor(i / 9)) % 7 + 1);
  for (let i = 9; i <= 12; i++) s.board[i] = 2;
  s.board[4] = 0; s.board[13] = 6; s.next = [2, 3, 4];
  const result = move(s, 13, 4);
  assert.equal(result.state.gameOver, false);
  assert.ok(result.events.some((e) => e.type === 'clear' && e.automatic));
  assert.equal(result.state.score, 0);
});
test('long random play preserves path, color and deterministic replay invariants', () => {
  for (const seed of [121, 1999, 93, 709]) {
    let state = createGame(seed), history = [], choice = { rng: seed + 9 };
    for (let step = 0; step < 160 && !state.gameOver; step++) {
      const candidates = [];
      for (let i = 0; i < 81; i++) if (state.board[i]) for (let j = 0; j < 81; j++) if (!state.board[j] && findPath(state.board, i, j)) candidates.push([i, j]);
      if (!candidates.length) break;
      const selected = candidates[randomBelow(choice, candidates.length)], result = move(state, ...selected);
      assert.equal(result.ok, true); history.push(selected); state = result.state;
      assert.ok(state.board.every((c) => c >= 0 && c <= 7));
      assert.equal(state.gameOver, !state.board.includes(0));
    }
    assert.deepEqual(replay(seed, history), state);
  }
});
