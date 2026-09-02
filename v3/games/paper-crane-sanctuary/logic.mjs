export const CELL = Object.freeze({ BLOCKED: "#", HOLE: ".", PEG: "P" });

export const DIRECTIONS = Object.freeze([
  Object.freeze({ id: "up", dx: 0, dy: -1 }),
  Object.freeze({ id: "right", dx: 1, dy: 0 }),
  Object.freeze({ id: "down", dx: 0, dy: 1 }),
  Object.freeze({ id: "left", dx: -1, dy: 0 }),
]);

const VALID_CELL = new Set(Object.values(CELL));

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function parseCellKey(value) {
  const match = /^(\d+),(\d+)$/.exec(String(value));
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

export function moveKey(move) {
  return `${move.from.x},${move.from.y}>${move.to.x},${move.to.y}`;
}

export function parseMove(value) {
  const match = /^(\d+),(\d+)>(\d+),(\d+)$/.exec(String(value));
  if (!match) return null;
  return {
    from: { x: Number(match[1]), y: Number(match[2]) },
    to: { x: Number(match[3]), y: Number(match[4]) },
  };
}

function assertRows(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 8) {
    throw new TypeError("Pegs board requires 1–8 rows.");
  }
  const width = rows[0]?.length;
  if (!Number.isInteger(width) || width < 1 || width > 8 || rows.some((row) => typeof row !== "string" || row.length !== width)) {
    throw new TypeError("Pegs board rows must form a 1–8 cell rectangle.");
  }
  for (const row of rows) {
    for (const value of row) if (!VALID_CELL.has(value)) throw new TypeError(`Unknown Pegs cell: ${value}`);
  }
  const flat = rows.join("");
  if ((flat.match(/P/g) ?? []).length < 2 || !flat.includes(".")) {
    throw new TypeError("Pegs board requires at least two cranes and one empty perch.");
  }
  return { width, height: rows.length };
}

export function createState(level) {
  const { width, height } = assertRows(level?.board);
  return {
    width,
    height,
    cells: [...level.board.join("")],
    moveCount: 0,
  };
}

export function cloneState(state) {
  return {
    width: state.width,
    height: state.height,
    cells: [...state.cells],
    moveCount: state.moveCount,
  };
}

export function inBounds(state, point) {
  return Number.isInteger(point?.x) && Number.isInteger(point?.y)
    && point.x >= 0 && point.x < state.width && point.y >= 0 && point.y < state.height;
}

export function indexOf(state, point) {
  return inBounds(state, point) ? point.y * state.width + point.x : -1;
}

export function cellAt(state, point) {
  const index = indexOf(state, point);
  return index < 0 ? CELL.BLOCKED : state.cells[index];
}

export function middleOf(move) {
  if (!move?.from || !move?.to) return null;
  return { x: (move.from.x + move.to.x) / 2, y: (move.from.y + move.to.y) / 2 };
}

export function validateMove(state, move) {
  if (!inBounds(state, move?.from) || !inBounds(state, move?.to)) return { legal: false, reason: "out-of-bounds" };
  const dx = move.to.x - move.from.x;
  const dy = move.to.y - move.from.y;
  if (!((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0))) {
    return { legal: false, reason: "not-orthogonal-jump" };
  }
  const middle = middleOf(move);
  if (cellAt(state, move.from) !== CELL.PEG) return { legal: false, reason: "source-not-crane" };
  if (cellAt(state, middle) !== CELL.PEG) return { legal: false, reason: "middle-not-crane" };
  if (cellAt(state, move.to) !== CELL.HOLE) return { legal: false, reason: "target-not-empty" };
  return { legal: true, reason: null, middle };
}

export function applyMove(state, rawMove) {
  const move = typeof rawMove === "string" ? parseMove(rawMove) : rawMove;
  const validation = validateMove(state, move);
  if (!validation.legal) return { changed: false, reason: validation.reason, state };
  const next = cloneState(state);
  next.cells[indexOf(next, move.from)] = CELL.HOLE;
  next.cells[indexOf(next, validation.middle)] = CELL.HOLE;
  next.cells[indexOf(next, move.to)] = CELL.PEG;
  next.moveCount += 1;
  return {
    changed: true,
    reason: null,
    move: { from: { ...move.from }, to: { ...move.to }, middle: { ...validation.middle } },
    state: next,
  };
}

export function legalMoves(state) {
  const moves = [];
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (cellAt(state, { x, y }) !== CELL.PEG) continue;
      for (const direction of DIRECTIONS) {
        const move = {
          from: { x, y },
          to: { x: x + direction.dx * 2, y: y + direction.dy * 2 },
        };
        if (validateMove(state, move).legal) moves.push(move);
      }
    }
  }
  return moves;
}

export function pegCount(state) {
  return state.cells.reduce((count, cell) => count + (cell === CELL.PEG ? 1 : 0), 0);
}

export function evaluateState(state) {
  const cranes = pegCount(state);
  const availableMoves = legalMoves(state);
  return {
    cranes,
    availableMoves,
    complete: cranes === 1,
    deadEnd: cranes > 1 && availableMoves.length === 0,
  };
}

export function replayMoves(level, encodedMoves = []) {
  if (!Array.isArray(encodedMoves) || encodedMoves.length > 256) return null;
  let state;
  try { state = createState(level); } catch { return null; }
  for (const encoded of encodedMoves) {
    if (typeof encoded !== "string" || encoded.length > 40) return null;
    const result = applyMove(state, encoded);
    if (!result.changed) return null;
    state = result.state;
  }
  return state;
}

function searchKey(state) {
  return state.cells.join("");
}

export function solvePegs(initialState, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 1;
  const nodeLimit = Number.isInteger(options.nodeLimit) && options.nodeLimit > 0 ? options.nodeLimit : 500_000;
  const memo = new Set();
  const solutions = [];
  let nodes = 0;
  let truncated = false;

  function visit(state, path) {
    if (solutions.length >= limit || truncated) return;
    nodes += 1;
    if (nodes > nodeLimit) { truncated = true; return; }
    const count = pegCount(state);
    if (count === 1) { solutions.push([...path]); return; }
    const key = searchKey(state);
    if (memo.has(key)) return;
    memo.add(key);
    for (const move of legalMoves(state)) {
      const result = applyMove(state, move);
      visit(result.state, [...path, moveKey(move)]);
      if (solutions.length >= limit || truncated) break;
    }
  }

  visit(cloneState(initialState), []);
  return { solutions, count: solutions.length, nodes, truncated };
}

export function validateLevel(level, { solve = false } = {}) {
  if (!level || typeof level !== "object") return false;
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(level.id ?? "")) return false;
  if (!["easy", "medium", "hard"].includes(level.difficulty)) return false;
  if (typeof level.title !== "string" || !level.title || typeof level.seed !== "string" || !level.seed) return false;
  let initial;
  try { initial = createState(level); } catch { return false; }
  if (!Array.isArray(level.solution) || level.solution.length !== pegCount(initial) - 1) return false;
  const solved = replayMoves(level, level.solution);
  if (!solved || !evaluateState(solved).complete) return false;
  if (solve) {
    const search = solvePegs(initial, { limit: 1 });
    if (search.truncated || search.count !== 1) return false;
  }
  return true;
}
