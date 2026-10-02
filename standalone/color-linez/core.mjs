/** Color Linez 1.21 rules, independently implemented from the archived reference. */
export const PROFILE = 'color-linez-1.21';
export const SIZE = 9;
export const COLORS = 7;
const AXES = [[-1, 0], [-1, -1], [0, -1], [1, -1]];
const validCell = (i) => Number.isInteger(i) && i >= 0 && i < 81;
export const emptyCells = (board) => board.reduce((empty, color, i) => { if (!color) empty.push(i); return empty; }, []);

/** The original's LCG and 15-bit sampling, including modulo selection. */
export function randomBelow(state, limit) {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('Invalid random range');
  state.rng = (Math.imul(state.rng, 0x41c64e6d) + 0x3039) >>> 0;
  return ((state.rng >>> 16) & 0x7fff) % limit;
}

export function scoreFor(count) {
  return Number.isInteger(count) && count >= 5 ? 10 + 2 * (count - 5) ** 2 : 0;
}

export function findLines(board, at) {
  if (!validCell(at) || !board[at]) return { count: 0, cells: [], lines: [] };
  const color = board[at], x = at % 9, y = Math.floor(at / 9), lines = [];
  for (const [dx, dy] of AXES) {
    const line = [at];
    for (const sign of [1, -1]) {
      // v1.21 scans at most seven cells on either side of the moved ball.
      for (let step = 1; step < 8; step++) {
        const xx = x + dx * sign * step, yy = y + dy * sign * step;
        if (xx < 0 || xx >= 9 || yy < 0 || yy >= 9 || board[yy * 9 + xx] !== color) break;
        line.push(yy * 9 + xx);
      }
    }
    if (line.length >= 5) lines.push(line);
  }
  return { count: lines.reduce((n, line) => n + line.length, 0), cells: [...new Set([].concat(...lines))].sort((a, b) => a - b), lines };
}

function neighbors(i) {
  const x = i % 9, y = Math.floor(i / 9);
  return [y > 0 ? i - 9 : -1, x > 0 ? i - 1 : -1, y < 8 ? i + 9 : -1, x < 8 ? i + 1 : -1].filter(validCell);
}

/** Four-neighbor movement; reverse path tie-breaking matches v1.21. */
export function findPath(board, from, to) {
  if (!validCell(from) || !validCell(to) || !board[from] || board[to] || from === to) return null;
  const distances = Array(81).fill(-1), queue = [from];
  distances[from] = 0;
  for (let p = 0; p < queue.length && distances[to] < 0; p++) {
    for (const i of neighbors(queue[p])) {
      if (distances[i] < 0 && !board[i]) { distances[i] = distances[queue[p]] + 1; queue.push(i); }
    }
  }
  if (distances[to] < 0) return null;
  const path = [to];
  while (path[path.length - 1] !== from) path.push(neighbors(path[path.length - 1]).find((i) => distances[i] === distances[path[path.length - 1]] - 1));
  return path.reverse();
}

function clearLine(state, at, automatic, events) {
  const match = findLines(state.board, at);
  if (!match.count) return false;
  const color = state.board[at], points = automatic ? 0 : scoreFor(match.count);
  for (const i of match.cells) state.board[i] = 0;
  state.score += points;
  state.removed[color - 1] += match.cells.length;
  events.push({ type: 'clear', cells: match.cells, color, count: match.count, points, automatic });
  return true;
}

/** One slot is retried when its newly spawned ball automatically clears. */
function addBall(state, events) {
  for (;;) {
    const empty = emptyCells(state.board);
    if (!empty.length) return false;
    const at = empty[randomBelow(state, empty.length)], color = state.next.shift();
    state.board[at] = color;
    state.next.push(randomBelow(state, COLORS) + 1);
    events.push({ type: 'spawn', at, color, next: [...state.next] });
    if (!clearLine(state, at, true, events)) return true;
  }
}

export function createGame(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Invalid seed');
  const state = { profile: PROFILE, seed, rng: seed, board: Array(81).fill(0), next: [], score: 0, turns: 0, removed: Array(7).fill(0), gameOver: false };
  for (let i = 0; i < 3; i++) state.next.push(randomBelow(state, COLORS) + 1);
  // The archived 1.21 starts with FIVE balls, unlike many three-ball clones.
  for (let i = 0; i < 5; i++) addBall(state, []);
  return state;
}

export function move(state, from, to) {
  if (state.gameOver) return { ok: false, reason: 'finished', state, events: [] };
  const path = findPath(state.board, from, to);
  if (!path) return { ok: false, reason: 'blocked', state, events: [] };
  const next = Object.assign({}, state, { board: [...state.board], next: [...state.next], removed: [...state.removed], turns: state.turns + 1 });
  const color = next.board[from], events = [{ type: 'move', from, to, color, path }];
  next.board[from] = 0;
  next.board[to] = color;
  if (!clearLine(next, to, false, events)) {
    for (let i = 0; i < 3; i++) addBall(next, events);
  }
  next.gameOver = !next.board.includes(0);
  return { ok: true, state: next, events };
}

export function replay(seed, moves) {
  if (!Array.isArray(moves) || moves.length > 100000) throw new TypeError('Invalid move history');
  let state = createGame(seed);
  for (const entry of moves) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError('Invalid move');
    const result = move(state, ...entry);
    if (!result.ok) throw new Error('Illegal move history');
    state = result.state;
  }
  return state;
}

export function tutorialStates() {
  const before = createGame(121);
  before.board.fill(0);
  for (const i of [38, 39, 40, 41, 60]) before.board[i] = 2;
  for (const [i, color] of [[20, 5], [22, 3], [57, 7], [46, 4]]) before.board[i] = color;
  const result = move(before, 60, 42);
  return { before, path: result.events[0].path, after: result.state, events: result.events };
}
