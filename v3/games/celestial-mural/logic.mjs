/**
 * 天象壁画修复室的 Mosaic 规则核心。
 *
 * `EMPTY → BLACK → WHITE → EMPTY` 是左键（深色颜料）循环；右键反向
 * 以 `EMPTY → WHITE → BLACK → EMPTY` 循环。所有状态都从操作历史重放，
 * 所以界面、教程、存档与结算使用同一份真值。
 */
export const ENGINE_VERSION = 1;
export const HISTORY_LIMIT = 4096;
export const CELL = Object.freeze({ EMPTY: 0, BLACK: 1, WHITE: 2 });
export const TOOLS = Object.freeze(["black", "white", "clear"]);

const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
const safeId = (value) => typeof value === "string" && /^(?!__proto__$|prototype$|constructor$)[a-z0-9][a-z0-9-]{2,63}$/.test(value);
const frozen = (values) => Object.freeze([...values]);

export function cellIndex(level, row, column) {
  return Number.isInteger(level?.width) && Number.isInteger(level?.height)
    && integer(row, 0, level.height - 1) && integer(column, 0, level.width - 1)
    ? row * level.width + column
    : -1;
}

export function cellCoordinates(level, index) {
  const size = Number(level?.width) * Number(level?.height);
  return integer(index, 0, size - 1)
    ? Object.freeze({ row: Math.floor(index / level.width), column: index % level.width })
    : null;
}

/** The original Mosaic neighbourhood is the bounded 3×3 area including self. */
export function neighbourhood(level, index) {
  const coordinate = cellCoordinates(level, index);
  if (!coordinate) return Object.freeze([]);
  const cells = [];
  for (let row = coordinate.row - 1; row <= coordinate.row + 1; row += 1) {
    for (let column = coordinate.column - 1; column <= coordinate.column + 1; column += 1) {
      const target = cellIndex(level, row, column);
      if (target >= 0) cells.push(target);
    }
  }
  return frozen(cells);
}

function validCells(level, cells) {
  const size = level?.width * level?.height;
  return Array.isArray(cells) && cells.length === size && cells.every((cell) => integer(cell, CELL.EMPTY, CELL.WHITE));
}

function validReference(level, reference) {
  const size = level?.width * level?.height;
  return Array.isArray(reference) && reference.length === size && reference.every((value) => value === 0 || value === 1);
}

export function sameBoard(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export function blackCount(level, cells, clueIndex) {
  if (!validCells(level, cells) || cellCoordinates(level, clueIndex) === null) return null;
  return neighbourhood(level, clueIndex).reduce((count, index) => count + Number(cells[index] === CELL.BLACK), 0);
}

export function deriveClues(level, referenceMural = level?.referenceMural) {
  if (!Number.isInteger(level?.width) || !Number.isInteger(level?.height) || !validReference(level, referenceMural)) return null;
  const referenceCells = referenceMural.map((value) => value ? CELL.BLACK : CELL.WHITE);
  return frozen(referenceCells.map((_, index) => blackCount(level, referenceCells, index)));
}

export function referenceBoard(level) {
  return validateLevel(level)
    ? frozen(level.referenceMural.map((value) => value ? CELL.BLACK : CELL.WHITE))
    : null;
}

export function normalizeMove(move, size) {
  if (!move || !integer(move.index, 0, size - 1) || !TOOLS.includes(move.tool)) return null;
  return Object.freeze({ index: move.index, tool: move.tool });
}

export function validateLevel(level) {
  if (!level || typeof level !== "object" || !safeId(level.id)
      || !["easy", "medium", "hard"].includes(level.difficulty)
      || !integer(level.tier, 1, 3) || !integer(level.width, 3, 8) || !integer(level.height, 3, 8)
      || typeof level.title !== "string" || !level.title.trim() || typeof level.subtitle !== "string"
      || !validReference(level, level.referenceMural) || !Array.isArray(level.clues)
      || level.clues.length !== level.width * level.height
      || !integer(level.par, level.width * level.height, level.width * level.height)
      || !Array.isArray(level.referenceSolution) || level.referenceSolution.length !== level.par) return false;
  const expected = deriveClues({ width: level.width, height: level.height }, level.referenceMural);
  if (!expected) return false;
  let shown = 0;
  for (let index = 0; index < level.clues.length; index += 1) {
    const clue = level.clues[index];
    if (clue === null) continue;
    if (!integer(clue, 0, neighbourhood(level, index).length) || clue !== expected[index]) return false;
    shown += 1;
  }
  if (shown < 1) return false;
  const expectedSolution = level.referenceMural.map((value, index) => ({ index, tool: value ? "black" : "white" }));
  return level.referenceSolution.every((move, index) => {
    const clean = normalizeMove(move, level.width * level.height);
    return Boolean(clean) && clean.index === expectedSolution[index].index && clean.tool === expectedSolution[index].tool;
  });
}

function nextCell(current, tool) {
  if (!integer(current, CELL.EMPTY, CELL.WHITE) || !TOOLS.includes(tool)) return null;
  if (tool === "clear") return current === CELL.EMPTY ? null : CELL.EMPTY;
  return tool === "black" ? (current + 1) % 3 : (current + 2) % 3;
}

function applyToBoard(level, board, move) {
  const clean = normalizeMove(move, level.width * level.height);
  if (!validCells(level, board) || !clean) return Object.freeze({ changed: false, board: validCells(level, board) ? frozen(board) : null, move: clean });
  const next = nextCell(board[clean.index], clean.tool);
  if (next === null) return Object.freeze({ changed: false, board: frozen(board), move: clean });
  const updated = [...board];
  updated[clean.index] = next;
  return Object.freeze({ changed: true, board: frozen(updated), move: clean });
}

export function evaluateBoard(level, board) {
  if (!validateLevel(level) || !validCells(level, board)) {
    return Object.freeze({ valid: false, complete: false, allExplicit: false, allSatisfied: false, black: 0, white: 0, empty: 0, clues: Object.freeze([]) });
  }
  const clues = [];
  for (let index = 0; index < level.clues.length; index += 1) {
    const target = level.clues[index];
    if (target === null) continue;
    const neighbours = neighbourhood(level, index);
    const black = neighbours.reduce((total, cell) => total + Number(board[cell] === CELL.BLACK), 0);
    const empty = neighbours.reduce((total, cell) => total + Number(board[cell] === CELL.EMPTY), 0);
    const white = neighbours.length - black - empty;
    clues.push(Object.freeze({
      index,
      target,
      black,
      white,
      empty,
      total: neighbours.length,
      exact: black === target,
      impossible: black > target || black + empty < target,
      settled: black === target && empty === 0,
    }));
  }
  const black = board.filter((cell) => cell === CELL.BLACK).length;
  const empty = board.filter((cell) => cell === CELL.EMPTY).length;
  const white = board.length - black - empty;
  const allExplicit = empty === 0;
  const allSatisfied = clues.every((clue) => clue.exact);
  return Object.freeze({
    valid: true,
    complete: allExplicit && allSatisfied,
    allExplicit,
    allSatisfied,
    black,
    white,
    empty,
    clues: frozen(clues),
  });
}

export const evaluateState = evaluateBoard;

function stateFrom(level, board, history) {
  const evaluation = evaluateBoard(level, board);
  return Object.freeze({
    board: frozen(board),
    history: frozen(history.map((move) => Object.freeze({ ...move }))),
    moves: history.length,
    complete: evaluation.complete,
  });
}

export function replayMoves(level, history = []) {
  if (!validateLevel(level) || !Array.isArray(history) || history.length > HISTORY_LIMIT) return null;
  let board = Array(level.width * level.height).fill(CELL.EMPTY);
  const canonicalHistory = [];
  for (const rawMove of history) {
    if (evaluateBoard(level, board).complete) return null;
    const result = applyToBoard(level, board, rawMove);
    if (!result.changed || !result.move) return null;
    board = [...result.board];
    canonicalHistory.push(result.move);
  }
  return stateFrom(level, board, canonicalHistory);
}

export function stateForLevel(level, history = []) {
  return replayMoves(level, history);
}

export function createState(level) {
  const state = replayMoves(level, []);
  if (!state) throw new TypeError("Invalid celestial mural level.");
  return state;
}

export function applyStateMove(level, state, move) {
  if (!validateLevel(level) || !state || !Array.isArray(state.history)) return Object.freeze({ changed: false, state: null });
  const canonical = replayMoves(level, state.history);
  if (!canonical || !sameBoard(canonical.board, state.board) || canonical.moves !== state.moves || canonical.complete) {
    return Object.freeze({ changed: false, state: canonical ?? null });
  }
  const result = applyToBoard(level, canonical.board, move);
  if (!result.changed || !result.move) return Object.freeze({ changed: false, state: canonical });
  return Object.freeze({ changed: true, state: stateFrom(level, result.board, [...canonical.history, result.move]) });
}

export function undoState(level, state) {
  if (!validateLevel(level) || !state || !Array.isArray(state.history) || state.history.length === 0) {
    return Object.freeze({ changed: false, state: state ?? null });
  }
  const replayed = replayMoves(level, state.history.slice(0, -1));
  return replayed ? Object.freeze({ changed: true, state: replayed }) : Object.freeze({ changed: false, state: null });
}

/** A proof-friendly solution only used to make fixed tutorials and tests. */
export function referenceState(level) {
  return validateLevel(level) ? replayMoves(level, level.referenceSolution) : null;
}
