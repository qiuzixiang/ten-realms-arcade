import test from 'node:test';
import assert from 'node:assert/strict';
import { topology, createState, applyEdge, undo, restart, checkWin, inspect, restoreState, validEdges } from '../src/engine.mjs';
import { solve } from '../src/solver.mjs';
import { LEVELS, CHAPTERS, getLevel, getDailyLevel, getSeedLevel } from '../src/levels.mjs';
import { getHint } from '../src/hint.mjs';

const first = LEVELS[0];
function finish(level) {
  let state = createState(level);
  level.solution.forEach((value, edge) => { if (value === 1) state = applyEdge(level, state, edge, 1); });
  return state;
}

// A third implementation used only as an oracle: enumerate every 2×2 edge mask,
// count cell borders directly, and use vertex flood-fill for the single cycle.
function tinyOracle() {
  const width = 2, height = 2, pairs = [];
  for (let y = 0; y <= height; y++) for (let x = 0; x < width; x++) pairs.push([y * 3 + x, y * 3 + x + 1]);
  for (let y = 0; y < height; y++) for (let x = 0; x <= width; x++) pairs.push([y * 3 + x, (y + 1) * 3 + x]);
  const loops = [];
  for (let mask = 1; mask < 1 << 12; mask++) {
    const adjacency = Array.from({ length: 9 }, () => []), edges = [];
    for (let e = 0; e < 12; e++) {
      const present = (mask & 1 << e) !== 0;
      edges.push(present ? 1 : -1);
      if (present) { const [a, b] = pairs[e]; adjacency[a].push(b); adjacency[b].push(a); }
    }
    if (adjacency.some(neighbors => neighbors.length !== 0 && neighbors.length !== 2)) continue;
    const active = adjacency.map((neighbors, vertex) => neighbors.length ? vertex : -1).filter(vertex => vertex >= 0);
    const pending = [active[0]], visited = new Set();
    while (pending.length) { const vertex = pending.pop(); if (visited.has(vertex)) continue; visited.add(vertex); pending.push(...adjacency[vertex]); }
    if (visited.size !== active.length) continue;
    const counts = [];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) counts.push([y * 2 + x, (y + 1) * 2 + x, 6 + y * 3 + x, 6 + y * 3 + x + 1].reduce((sum, edge) => sum + (edges[edge] === 1 ? 1 : 0), 0));
    loops.push({ edges, counts });
  }
  return loops;
}

function canonicalSolution(level) {
  const board = topology(level.width, level.height), n = level.width, signatures = [];
  for (let reflection = 0; reflection < 2; reflection++) for (let rotate = 0; rotate < 4; rotate++) {
    const lines = [];
    const transform = vertex => {
      let x = vertex % (n + 1), y = Math.floor(vertex / (n + 1));
      if (reflection) x = n - x;
      for (let r = 0; r < rotate; r++) { const oldX = x; x = n - y; y = oldX; }
      return y * (n + 1) + x;
    };
    board.edges.forEach(edge => {
      if (level.solution[edge.id] === 1) lines.push([transform(edge.a), transform(edge.b)].sort((a, b) => a - b).join('-'));
    });
    signatures.push(lines.sort().join(','));
  }
  return n + ':' + signatures.sort()[0];
}

test('topology uses disjoint horizontal-first indexing and [top,right,bottom,left] cell borders', () => {
  const board = topology(3, 3);
  assert.equal(board.edgeCount, 24);
  assert.equal(board.vertexCount, 16);
  assert.deepEqual(board.cellEdges[0], [0, 13, 3, 12]);
  assert.deepEqual(board.edges[0], { id: 0, a: 0, b: 1, orientation: 'h', row: 0, col: 0 });
  assert.deepEqual(board.edges[12], { id: 12, a: 0, b: 4, orientation: 'v', row: 0, col: 0 });
  assert.deepEqual(topology(2, 3).cellEdges[5], [5, 16, 7, 15]);
  assert.throws(() => topology(0, 3), RangeError);
});

test('legal inputs are immutable; invalid or identical inputs are exact no-ops', () => {
  const state = createState(first), original = JSON.stringify(state);
  const changed = applyEdge(first, state, 0, 1);
  assert.equal(JSON.stringify(state), original);
  assert.equal(changed.edges[0], 1);
  assert.equal(changed.moves, 1);
  assert.deepEqual(changed.history, [{ edge: 0, from: 0, to: 1 }]);
  for (const [edge, value] of [[-1, 1], [state.edges.length, 1], [0.5, 1], ['0', 1], [NaN, 1], [0, 3], [0, null], [0, 0]]) assert.equal(applyEdge(first, state, edge, value), state);
  assert.equal(applyEdge(first, changed, 0, 1), changed);
  const malformed = { edges: state.edges, history: [] };
  assert.equal(applyEdge(first, malformed, 0, 1), malformed);
});

test('undo restores all edge and move state; restart starts blank', () => {
  const blank = createState(first), drawn = applyEdge(first, blank, 0, 1), marked = applyEdge(first, drawn, 0, -1);
  assert.deepEqual(undo(first, marked), drawn);
  assert.deepEqual(undo(first, drawn), blank);
  assert.equal(undo(first, blank), blank);
  assert.deepEqual(restart(first), blank);
  const complete = finish(first);
  assert.equal(checkWin(first, complete), true);
  assert.equal(checkWin(first, undo(first, complete)), false);
});

test('winning requires nonempty connected cycle, exact clues, degree 0 or 2; notes do not count', () => {
  const blank = createState(first);
  assert.equal(checkWin(first, blank), false);
  assert.equal(checkWin(first, Array(24).fill(-1)), false);
  const correct = finish(first);
  assert.equal(checkWin(first, correct), true);
  assert.equal(checkWin(first, first.solution), true);
  assert.equal(checkWin(Object.assign({}, first, { clues: first.clues.map(() => 0) }), correct), false);
  const branched = first.solution.slice(); branched[1 * first.width] = 1;
  assert.equal(checkWin(first, branched), false);
  assert.ok(inspect(first, branched).branchVertices.length > 0);
  assert.equal(checkWin(first, { edges: [1] }), false);
  assert.equal(validEdges(first, Array(24).fill(2)), false);
  const twoLoops = { id: 'two-loops', width: 3, height: 1, clues: [null, null, null] }, graph = topology(3, 1);
  const pair = Array(graph.edgeCount).fill(-1);
  graph.cellEdges[0].forEach(e => { pair[e] = 1; }); graph.cellEdges[2].forEach(e => { pair[e] = 1; });
  const report = inspect(twoLoops, pair);
  assert.equal(report.degreeErrors.length, 0);
  assert.equal(report.components, 2);
  assert.equal(report.won, false);
});

test('incomplete and over-excluded clues have accurate diagnostic counts', () => {
  const values = createState(first).edges;
  const zeroCell = first.clues.indexOf(0), zeroEdge = topology(3, 3).cellEdges[zeroCell][0];
  values[zeroEdge] = 1;
  assert.ok(inspect(first, values).overflow.includes(zeroCell));
  assert.ok(inspect(first, values).impossibleClues.includes(zeroCell));
  values.fill(-1);
  assert.ok(inspect(first, values).impossibleClues.length > 0);
});

test('all 625 possible 2×2 clue sets match complete brute force oracle, including zero/multiple solutions', () => {
  const loops = tinyOracle();
  assert.equal(loops.length, 13);
  const possibilities = [null, 0, 1, 2, 3];
  for (let signature = 0; signature < 625; signature++) {
    let code = signature; const clues = [];
    for (let cell = 0; cell < 4; cell++) { clues.push(possibilities[code % 5]); code = Math.floor(code / 5); }
    const expected = loops.filter(loop => clues.every((clue, index) => clue === null || clue === loop.counts[index])).map(loop => loop.edges.join(',')).sort();
    const result = solve({ width: 2, height: 2, clues }, { limit: 100 });
    assert.equal(result.exhausted, true);
    assert.deepEqual(result.solutions.map(edges => edges.join(',')).sort(), expected, 'clues=' + JSON.stringify(clues));
  }
});

test('solver stops at second solution and reports nonexhaustion honestly', () => {
  const result = solve({ width: 2, height: 2, clues: [null, null, null, null] }, { limit: 2 });
  assert.equal(result.count, 2);
  assert.equal(result.exhausted, false);
  assert.equal(solve(first, { limit: 1 }).exhausted, false);
  const noSolution = solve({ width: 2, height: 2, clues: [0, 0, 0, 0] }, { limit: 2 });
  assert.equal(noSolution.count, 0);
  assert.equal(noSolution.exhausted, true);
  assert.equal(solve(first, { edges: [1] }).invalid, true);
});

test('72 levels in six chapters have independently exhausted unique solution proofs', () => {
  assert.equal(LEVELS.length, 72);
  assert.equal(CHAPTERS.length, 6);
  assert.equal(new Set(LEVELS.map(level => level.id)).size, 72);
  for (const chapter of CHAPTERS) assert.equal(LEVELS.filter(level => level.chapter === chapter.id).length, 12);
  for (const level of LEVELS) {
    const problem = { id: level.id, width: level.width, height: level.height, clues: level.clues };
    Object.defineProperty(problem, 'solution', { get() { throw new Error('Oracle must not read supplied answer'); } });
    const result = solve(problem, { limit: 2 });
    assert.equal(result.count, 1, level.id);
    assert.equal(result.exhausted, true, level.id);
    assert.deepEqual(result.solutions[0], level.solution, level.id);
    assert.equal(result.nodes, level.proof.nodes, level.id);
    assert.equal(checkWin(problem, result.solutions[0]), true, level.id);
    assert.equal(checkWin(level, finish(level)), true, level.id);
  }
});

test('mainline shapes do not repeat under rotations or reflection; curriculum varies size and clue density', () => {
  assert.equal(new Set(LEVELS.map(canonicalSolution)).size, LEVELS.length);
  const expectedSize = [3, 4, 4, 5, 5, 6];
  const densities = [];
  CHAPTERS.forEach(chapter => {
    const group = LEVELS.filter(level => level.chapter === chapter.id);
    assert.ok(group.every(level => level.width === expectedSize[chapter.id - 1] && level.height === level.width));
    densities.push(group.reduce((sum, level) => sum + level.clueCount / level.clues.length, 0) / group.length);
    const sorted = chapter.id === 1 ? group.slice(1) : group;
    for (let index = 1; index < sorted.length; index++) assert.ok(sorted[index].proof.nodes >= sorted[index - 1].proof.nodes);
  });
  for (let chapter = 1; chapter < 6; chapter++) assert.ok(densities[chapter] < densities[chapter - 1]);
});

test('daily and bottle seeds deterministically recover valid unique transformed puzzles', () => {
  const signatures = new Set();
  for (let day = 1; day <= 28; day++) {
    const date = '2026-09-' + String(day).padStart(2, '0'), level = getDailyLevel(date);
    assert.deepEqual(getDailyLevel(date), level);
    assert.deepEqual(getLevel(level.id), level);
    assert.equal(level.seed, date);
    assert.equal(checkWin(level, level.solution), true);
    const proof = solve(level, { limit: 2 }); assert.equal(proof.count, 1); assert.equal(proof.exhausted, true);
    signatures.add(JSON.stringify(level.clues));
  }
  assert.ok(signatures.size >= 20);
  for (const seed of ['月光', '第一封信', 'a', '92', '', '海岸🌊', '  小岛  ']) {
    const level = getSeedLevel(seed);
    assert.deepEqual(getSeedLevel(seed), level);
    assert.deepEqual(getLevel(level.id), level);
    assert.equal(checkWin(level, level.solution), true);
    const proof = solve(level, { limit: 2 }); assert.equal(proof.count, 1); assert.equal(proof.exhausted, true);
  }
  assert.throws(() => getDailyLevel('2026-02-31'), RangeError);
  assert.equal(getLevel('daily-invalid'), null);
  assert.equal(getLevel('seed-%ZZ'), null);
  assert.equal(getLevel('missing'), null);
});

test('hints completely guide all 72 current boards using proved moves without reading embedded answers', () => {
  const kinds = new Set();
  for (const level of LEVELS) {
    const independent = { id: level.id, width: level.width, height: level.height, clues: level.clues };
    Object.defineProperty(independent, 'solution', { get() { throw new Error('Hint must not read embedded answer'); } });
    let state = createState(independent), step = 0;
    while (!checkWin(independent, state) && step <= state.edges.length) {
      const advice = getHint(independent, state);
      kinds.add(advice.kind);
      assert.ok(advice.action, level.id + ' at step ' + step);
      assert.ok(advice.explanation.length > 15);
      assert.equal(advice.action.value, level.solution[advice.action.edge], level.id);
      assert.equal(state.edges[advice.action.edge], 0, level.id);
      const next = applyEdge(independent, state, advice.action.edge, advice.action.value);
      assert.notEqual(next, state);
      state = next; step++;
    }
    assert.equal(checkWin(independent, state), true, level.id);
    assert.equal(getHint(independent, state).kind, 'complete');
  }
  assert.ok(kinds.has('clue-full'));
  assert.ok(kinds.has('clue-needed'));
  assert.ok(kinds.has('vertex-extend'));
  assert.ok(kinds.has('lookahead'));
});

test('wrong lines and wrong exclusions receive nonpunitive repair hints', () => {
  for (const level of [LEVELS[0], LEVELS[35], LEVELS[71]]) {
    for (const value of [-1, 1]) {
      const wrongEdge = level.solution.findIndex(expected => expected !== value);
      const state = applyEdge(level, createState(level), wrongEdge, value);
      const advice = getHint(level, state);
      assert.equal(advice.kind, 'repair');
      assert.deepEqual(advice.action, { edge: wrongEdge, value: 0 });
      assert.equal(solve(level, { edges: state.edges, limit: 1 }).count, 0);
      assert.equal(solve(level, { edges: applyEdge(level, state, advice.action.edge, advice.action.value).edges, limit: 1 }).count, 1);
    }
  }
});

test('serialized states are replayed; forged edges/moves/history cannot restore', () => {
  const played = applyEdge(first, applyEdge(first, createState(first), 0, 1), 12, -1);
  assert.deepEqual(restoreState(first, JSON.parse(JSON.stringify(played))), played);
  assert.equal(restoreState(first, Object.assign({}, played, { moves: 99 })), null);
  assert.equal(restoreState(first, Object.assign({}, played, { edges: first.solution })), null);
  assert.equal(restoreState(first, Object.assign({}, played, { levelId: 'moon-72' })), null);
  const broken = JSON.parse(JSON.stringify(played)); broken.history[0].from = 1;
  assert.equal(restoreState(first, broken), null);
  const complete = finish(first);
  assert.equal(checkWin(first, restoreState(first, complete)), true);
  const forged = Object.assign({}, createState(first), { won: true, rewards: 999 });
  const restored = restoreState(first, forged);
  assert.equal(checkWin(first, restored), false);
  assert.equal(Object.hasOwn(restored, 'rewards'), false);
});

test('tutorial trace uses initial board, an actual legal first line, and a true completed loop', () => {
  assert.equal(first.id, 'moon-01');
  assert.deepEqual(first.clues, [2, 1, 2, 1, 0, 1, 2, 1, 2]);
  const blank = createState(first), acted = applyEdge(first, blank, 0, 1), completed = finish(first);
  assert.equal(blank.edges.filter(value => value === 1).length, 0);
  assert.equal(acted.edges.filter(value => value === 1).length, 1);
  assert.equal(acted.moves, 1);
  assert.equal(checkWin(first, acted), false);
  assert.equal(completed.edges.filter(value => value === 1).length, 12);
  assert.equal(checkWin(first, completed), true);
});
