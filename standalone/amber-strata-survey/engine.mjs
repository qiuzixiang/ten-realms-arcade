// 琥珀勘探队: deterministic Mines rules. Coordinates are row-major.
export const COVER = 'cover';
export const FLAG = 'flag';
export const OPEN = 'open';
export const HIT = 'hit';

export function neighbors(width, height, index) {
  if (!Number.isInteger(index) || index < 0 || index >= width * height) return [];
  const x = index % width, y = Math.floor(index / width), result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if ((dx || dy) && nx >= 0 && nx < width && ny >= 0 && ny < height) result.push(ny * width + nx);
  }
  return result;
}

export function validateLevel(level) {
  if (!level || !Number.isInteger(level.width) || !Number.isInteger(level.height) ||
      level.width < 2 || level.width > 8 || level.height < 2 || level.height > 10 ||
      !Number.isInteger(level.seed) || !Number.isInteger(level.firstSafe) ||
      level.firstSafe < 0 || level.firstSafe >= level.width * level.height ||
      !Array.isArray(level.mines) || !level.mines.length || level.mines.length >= level.width * level.height) return false;
  const sorted = [...level.mines].sort((a, b) => a - b);
  return sorted.every((n, i) => Number.isInteger(n) && n >= 0 && n < level.width * level.height &&
    n !== level.firstSafe && (i === 0 || sorted[i - 1] !== n));
}

export function readings(level, mines = level.mines) {
  const set = new Set(mines);
  return Array.from({ length: level.width * level.height }, (_, i) =>
    set.has(i) ? -1 : neighbors(level.width, level.height, i).filter(n => set.has(n)).length);
}

export function newGame(level) {
  if (!validateLevel(level)) throw new TypeError('Invalid level');
  return { mines: [...level.mines].sort((a, b) => a - b), cells: Array(level.width * level.height).fill(COVER),
    phase: 'ready', scans: 0, moves: 0, errors: [] };
}

export function clone(state) {
  return Object.assign({}, state, { mines: [...state.mines], cells: [...state.cells], errors: [...state.errors] });
}

export function safeLeft(state) {
  const mines = new Set(state.mines);
  return state.cells.reduce((n, cell, i) => n + (cell !== OPEN && !mines.has(i) ? 1 : 0), 0);
}

export function isWon(state) { return state.phase !== 'lost' && safeLeft(state) === 0; }

function relocate(state, level, clicked) {
  if (!state.mines.includes(clicked)) return;
  const mineSet = new Set(state.mines);
  mineSet.delete(clicked);
  const protectedCells = new Set([clicked, ...neighbors(level.width, level.height, clicked)]);
  const count = state.cells.length, start = ((level.seed + clicked * 17) % count + count) % count;
  let destination = -1;
  for (let pass = 0; pass < 2 && destination < 0; pass++) {
    for (let offset = 0; offset < count; offset++) {
      const i = (start + offset) % count;
      if (!mineSet.has(i) && i !== clicked && (pass || !protectedCells.has(i))) { destination = i; break; }
    }
  }
  if (destination < 0) throw new RangeError('First scan cannot be made safe');
  mineSet.add(destination);
  state.mines = [...mineSet].sort((a, b) => a - b);
}

function flood(state, level, start, grid) {
  const queue = [start], opened = [];
  while (queue.length) {
    const i = queue.pop();
    if (state.cells[i] !== COVER || grid[i] < 0) continue;
    state.cells[i] = OPEN;
    opened.push(i);
    if (grid[i] === 0) queue.push(...neighbors(level.width, level.height, i));
  }
  return opened;
}

export function apply(state, level, action) {
  const i = action && action.index, type = action && action.type;
  if (!['scan', 'flag', 'chord'].includes(type) || !Number.isInteger(i) || i < 0 || i >= state.cells.length ||
      !['ready', 'playing'].includes(state.phase)) return { state, changed: false, opened: [], hit: [] };
  if (type === 'flag') {
    if (![COVER, FLAG].includes(state.cells[i])) return { state, changed: false, opened: [], hit: [] };
    const next = clone(state);
    next.cells[i] = next.cells[i] === COVER ? FLAG : COVER;
    next.moves++;
    return { state: next, changed: true, opened: [], hit: [] };
  }
  if (type === 'scan' && state.cells[i] !== COVER) return { state, changed: false, opened: [], hit: [] };
  let targets = [i];
  if (type === 'chord') {
    if (state.cells[i] !== OPEN) return { state, changed: false, opened: [], hit: [] };
    const number = readings(level, state.mines)[i];
    const around = neighbors(level.width, level.height, i);
    if (number < 1 || around.filter(n => state.cells[n] === FLAG).length !== number) return { state, changed: false, opened: [], hit: [] };
    targets = around.filter(n => state.cells[n] === COVER);
    if (!targets.length) return { state, changed: false, opened: [], hit: [] };
  }
  const next = clone(state);
  if (type === 'scan' && next.scans === 0) relocate(next, level, i);
  const grid = readings(level, next.mines), opened = [], hit = [];
  for (const target of targets) {
    if (next.cells[target] !== COVER) continue;
    if (grid[target] < 0) {
      next.cells[target] = HIT;
      next.errors = [...new Set([...next.errors, target])].sort((a, b) => a - b);
      hit.push(target);
    } else opened.push(...flood(next, level, target, grid));
  }
  next.moves++;
  if (type === 'scan') next.scans++;
  next.phase = hit.length ? 'lost' : (safeLeft(next) === 0 ? 'won' : 'playing');
  return { state: next, changed: true, opened, hit };
}

export function undo(previous, current) {
  const next = clone(previous);
  next.errors = [...new Set([...previous.errors, ...current.errors])].filter(i => next.mines.includes(i)).sort((a, b) => a - b);
  return next;
}

export function replay(level, timeline, max = 1500) {
  if (!Array.isArray(timeline) || timeline.length > max) return null;
  let state = newGame(level);
  const history = [];
  for (const action of timeline) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
    if (action.type === 'undo' && Object.keys(action).length === 1) {
      if (!history.length) return null;
      state = undo(history.pop(), state);
    } else {
      if (Object.keys(action).some(k => !['type', 'index'].includes(k))) return null;
      const result = apply(state, level, action);
      if (!result.changed) return null;
      history.push(state);
      state = result.state;
    }
  }
  return { state, history };
}

// Solver receives this view; mine positions are never exposed.
export function publicView(level, state) {
  const grid = readings(level, state.mines);
  return { width: level.width, height: level.height, mineCount: state.mines.length,
    cells: [...state.cells], numbers: state.cells.map((cell, i) => cell === OPEN ? grid[i] : null) };
}
