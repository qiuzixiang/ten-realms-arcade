import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { independentSolve, signature } from '../scripts/generate-levels.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {} });
for (const filename of ['engine.js', 'levels.js']) vm.runInContext(fs.readFileSync(path.join(root, 'src', filename), 'utf8'), context);
const { CraneEngine: E, CraneLevels: L } = context.window;
const plain = value => JSON.parse(JSON.stringify(value));
const boardState = board => E.create({ board });

function oracleMoves(state) {
  const result = [];
  for (let from = 0; from < state.cells.length; from += 1) for (let to = 0; to < state.cells.length; to += 1) {
    const a = [from % state.width, Math.floor(from / state.width)];
    const b = [to % state.width, Math.floor(to / state.width)];
    const orthogonal = a[0] === b[0] && Math.abs(a[1] - b[1]) === 2 || a[1] === b[1] && Math.abs(a[0] - b[0]) === 2;
    if (orthogonal && state.cells[from] === 'P' && state.cells[(from + to) / 2] === 'P' && state.cells[to] === '.') result.push({ from, to });
  }
  return result;
}
function sortedMoves(moves) { return [...moves].map(m => `${m.from}:${m.to}`).sort(); }

test('valid board construction is defensive and accepts legitimate terminal states', () => {
  const state = boardState(['PP.']); assert.equal(state.width, 3); assert.equal(state.height, 1); assert.equal(state.moves, 0);
  for (const board of [null, [], [''], ['X'], ['...','..'], ['.......'], new Array(7).fill('.')]) assert.throws(() => E.create({ board }));
  assert.throws(() => E.create({ board: ['PP.'], width: 4 }));
  assert.equal(E.won(boardState(['P'])), true);
  assert.equal(E.won(boardState(['.'])), false);
  assert.equal(E.won(boardState(['#'])), false);
  assert.equal(E.won({ ...state, cells: ['P','?','.'] }), false);
});

test('all four orthogonal directions remove exactly the crossed crane', () => {
  for (const [board, move] of [[['PP.'], {from:0,to:2}], [['.PP'],{from:2,to:0}], [['P','P','.'],{from:0,to:2}], [['.','P','P'],{from:2,to:0}]]) {
    const state = boardState(board), snapshot = JSON.stringify(state), next = E.apply(state, move);
    assert.notEqual(next, state); assert.equal(JSON.stringify(state), snapshot);
    assert.equal(next.cells[move.to], 'P'); assert.equal(next.cells[move.from], '.'); assert.equal(next.cells[(move.from + move.to) / 2], '.');
    assert.equal(E.count(next), E.count(state) - 1); assert.equal(next.moves, 1); assert.equal(E.won(next), true);
  }
});

test('illegal input is an atomic no-op: no row wrap, diagonal, missing middle or occupied target', () => {
  const state = boardState(['PP..', '..P.', 'P#P.']);
  const invalid = [null, undefined, '', 1, {}, {from:-1,to:1}, {from:0,to:99}, {from:0.5,to:2.5}, {from:'0',to:2}, {from:0,to:0}, {from:0,to:1}, {from:0,to:10}, {from:0,to:8}, {from:6,to:8}, {from:8,to:10}, {from:10,to:6}, {from:1,to:3}];
  const snapshot = JSON.stringify(state);
  for (const move of invalid) { assert.equal(E.apply(state, move), state); assert.equal(JSON.stringify(state), snapshot); }
  assert.equal(E.apply(boardState(['PPP']), {from:0,to:2}).moves, 0);
});

test('classic victory accepts any final perch and target is only an optional search condition', () => {
  const level = { board: ['PP.'], target: 0 };
  const final = E.apply(E.create(level), {from:0,to:2});
  assert.equal(E.won(final), true); assert.equal(final.cells[level.target], '.');
  assert.deepEqual(plain(E.solve(final).solution), []);
  assert.equal(E.solve(final, {target:0}).solution, null);
  assert.equal(E.solve(final, {target:999}).truncated, false);
  const deadEnd = boardState(['P.P']); assert.equal(E.won(deadEnd), false); assert.equal(E.legal(deadEnd).length, 0);
  assert.equal(E.solve(deadEnd).solution, null);
});

test('replay validates every action and supports unbounded undo by replaying a valid prefix', () => {
  const level = L.levels[29], initial = E.create(level);
  let state = initial; const snapshots = [JSON.stringify(state)];
  for (const move of level.solution) { state = E.apply(state, move); snapshots.push(JSON.stringify(state)); }
  for (let length = 0; length <= level.solution.length; length += 1) assert.equal(JSON.stringify(E.replay(level, level.solution.slice(0,length))), snapshots[length]);
  assert.equal(E.replay(level, 'fake'), null); assert.equal(E.replay(level, [null]), null);
  assert.equal(E.replay(level, [{from:0,to:999}]), null); assert.equal(E.replay(level, Array(36).fill(level.solution[0])), null);
  assert.equal(E.replay({ board: ['?'] }, []), null);
  assert.equal(E.replay(level, level.solution.concat(level.solution[0])), null);
  assert.equal(JSON.stringify(E.create(level)), snapshots[0]);
});

test('36-cell solver keeps high bits and the signed 32nd bit distinct', () => {
  const state = boardState(Array(6).fill('......'));
  state.cells[31] = state.cells[32] = 'P';
  const result = E.solve(state, {target:33});
  assert.deepEqual(plain(result.solution), [{from:31,to:33}]);
  assert.equal(E.won(E.apply(state, result.solution[0])), true);
  const high = boardState(Array(6).fill('......')); high.cells[33] = high.cells[34] = 'P';
  assert.deepEqual(plain(E.solve(high, {target:35}).solution), [{from:33,to:35}]);
});

test('all 512 occupancy states of a 3×3 board agree with independent legality and reachability', () => {
  for (let mask = 0; mask < 512; mask += 1) {
    const cells = Array.from({length:9}, (_,i) => mask & 1 << i ? 'P' : '.');
    const level = { width:3, height:3, board:[cells.slice(0,3).join(''),cells.slice(3,6).join(''),cells.slice(6,9).join('')] };
    const state = E.create(level);
    assert.deepEqual(sortedMoves(E.legal(state)), sortedMoves(oracleMoves(state)), `moves ${mask}`);
    const expected = independentSolve(level), result = E.solve(state);
    assert.equal(result.truncated, false); assert.equal(!!result.solution, !!expected.solution, `reachability ${mask}`);
    if (result.solution) { const final = E.replay(level, result.solution); assert.equal(E.won(final), true); assert.equal(result.solution.length, E.count(state) - 1); }
  }
});

test('60 campaign boards replay and independently solve to their optional target', () => {
  assert.equal(L.levels.length, 60); assert.equal(L.chapters.length, 6);
  for (const level of L.levels) {
    const initial = E.create(level), final = E.replay(level, level.solution);
    assert.ok(level.width <= 6 && level.height <= 6); assert.equal(E.count(initial), level.stats.pegCount);
    assert.equal(level.solution.length, E.count(initial) - 1); assert.equal(E.won(final), true); assert.equal(final.cells[level.target], 'P');
    const search = E.solve(initial, {target:level.target}); assert.equal(search.truncated, false, level.id); assert.ok(search.solution, level.id);
    const oracle = independentSolve(level, level.target); assert.equal(oracle.truncated, false, level.id); assert.ok(oracle.solution, level.id);
    assert.equal(E.won(E.replay(level, oracle.solution)), true);
  }
});

test('campaign has 60 distinct boards and 60 distinct topologies after all D4 symmetries', () => {
  assert.equal(new Set(L.levels.map(level => signature(level))).size, 60);
  assert.equal(new Set(L.levels.map(level => signature(level, true))).size, 60);
  let priorPegs = 0;
  for (const level of L.levels) { assert.ok(level.stats.pegCount >= priorPegs); priorPegs = level.stats.pegCount; }
  for (const chapter of L.chapters) assert.equal(L.levels.filter(level => level.chapter === chapter.id).length, 10);
  const chapterMeans = L.chapters.map(c => { const pool = L.levels.filter(l => l.chapter === c.id); return pool.reduce((n,l) => n + l.stats.solutionBranches / l.solution.length, 0) / pool.length; });
  for (let i = 1; i < chapterMeans.length; i += 1) assert.ok(chapterMeans[i] > chapterMeans[i - 1], 'chapter branch progression');
});

test('each main board is reproducible from its reverse seed and settings', () => {
  for (const [index, level] of L.levels.entries()) {
    const generated = L.generate(level.seed, level.chapter, L.parameters(level.chapter, index % 10));
    assert.deepEqual(plain(generated.board), plain(level.board), level.id);
    assert.deepEqual(plain(generated.solution), plain(level.solution), level.id);
    assert.equal(generated.target, level.target);
  }
});

test('generated perches form a connected usable courtyard', () => {
  for (const level of L.levels) {
    const state = E.create(level), start = state.cells.findIndex(c => c !== '#'), visited = new Set([start]), queue = [start];
    while (queue.length) {
      const at = queue.pop(), x = at % state.width, y = Math.floor(at / state.width);
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const xx = x + dx, yy = y + dy, i = yy * state.width + xx;
        if (xx >= 0 && yy >= 0 && xx < state.width && yy < state.height && state.cells[i] !== '#' && !visited.has(i)) { visited.add(i); queue.push(i); }
      }
    }
    assert.equal(visited.size, level.stats.playable, level.id);
    assert.ok(level.board[0].includes('.') || level.board[0].includes('P'));
    assert.ok(level.board[level.height - 1].includes('.') || level.board[level.height - 1].includes('P'));
  }
});

test('seeded play is stable, replayable, diverse and preserves the caller seed for restore', () => {
  assert.notEqual(L.seeded('same-wind',1).id, L.seeded('same-wind',6).id, 'chapter participates in reward identity');
  const signatures = new Set();
  for (let i = 0; i < 120; i += 1) {
    const chapter = i % 6 + 1, seed = `qa-wind-${i}`, a = L.seeded(seed, chapter), b = L.seeded(a.seed, a.chapter);
    assert.equal(a.seed, seed); assert.deepEqual(plain(a), plain(b));
    const result = E.replay(a, a.solution); assert.equal(E.won(result), true); assert.equal(result.cells[a.target], 'P');
    signatures.add(signature(a));
  }
  assert.ok(signatures.size >= 114, `seed variety: ${signatures.size}/120`);
});

test('daily dates produce stable, solvable daily boards and preserve date metadata', () => {
  const signatures = new Set();
  for (let month = 1; month <= 12; month += 1) {
    const date = `2026-${String(month).padStart(2,'0')}-08`, level = L.daily(date);
    assert.equal(level.id, `daily-${date}`); assert.equal(level.date, date); assert.equal(level.seed, date);
    assert.deepEqual(plain(L.daily(level.date)), plain(level));
    assert.equal(E.won(E.replay(level, level.solution)), true);
    const oracle = independentSolve(level, level.target); assert.ok(oracle.solution); assert.equal(oracle.truncated, false);
    signatures.add(signature(level));
  }
  assert.equal(signatures.size, 12); assert.throws(() => L.daily('September 8')); assert.throws(() => L.daily('2026-02-31'));
});

test('current-position hint search is non-mutating and reports truncation honestly', () => {
  const level = L.levels[59], state = E.replay(level, level.solution.slice(0,4)), snapshot = JSON.stringify(state);
  const result = E.solve(state, {target:level.target, nodeLimit:100000});
  assert.ok(result.solution); assert.equal(result.truncated, false); assert.equal(JSON.stringify(state), snapshot);
  let solved = state; for (const move of result.solution) { const next = E.apply(solved, move); assert.notEqual(next,solved); solved = next; }
  assert.equal(E.won(solved), true); assert.equal(solved.cells[level.target], 'P');
  const limited = E.solve(E.create(level), {nodeLimit:1}); assert.equal(limited.truncated,true); assert.equal(limited.solution,null); assert.equal(limited.nodes,1);
});

test('tutorial truth is a fixed 4 → 3 → 1 state sequence', () => {
  const level = L.find(L.tutorialId), first = E.create(level), second = E.apply(first,level.solution[0]), final = E.replay(level,level.solution);
  assert.equal(level.id,'crane-001'); assert.equal(E.count(first),4); assert.equal(E.count(second),3); assert.equal(E.count(final),1);
  assert.equal(E.won(first),false); assert.equal(E.won(second),false); assert.equal(E.won(final),true); assert.equal(L.find('missing'),null);
});
