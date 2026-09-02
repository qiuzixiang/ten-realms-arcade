/**
 * Star Dial Bureau's rule core.
 *
 * This is deliberately DOM-free: a board is always a 16-item permutation of
 * 1…16, and a move is an explicit 2×2 window plus a direction.  Keeping the
 * original Twiddle operation here makes the tutorial, saved games and
 * completion proof all replay the exact same transition.
 */
export const BOARD_SIZE = 4;
export const TILE_COUNT = BOARD_SIZE * BOARD_SIZE;
export const ROTATIONS = Object.freeze(["cw", "ccw"]);

export const SOLVED_BOARD = Object.freeze(Array.from({ length: TILE_COUNT }, (_, index) => index + 1));

const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
const safeId = (value) => typeof value === "string" && /^(?!__proto__$|prototype$|constructor$)[a-z0-9][a-z0-9-]{2,63}$/.test(value);

export function isBoard(board) {
  return Array.isArray(board)
    && board.length === TILE_COUNT
    && board.every((tile) => integer(tile, 1, TILE_COUNT))
    && new Set(board).size === TILE_COUNT;
}

export function sameBoard(left, right) {
  return isBoard(left) && isBoard(right) && left.every((tile, index) => tile === right[index]);
}

export function boardKey(board) {
  return isBoard(board) ? board.join(",") : "";
}

export function cellIndex(row, column) {
  return integer(row, 0, BOARD_SIZE - 1) && integer(column, 0, BOARD_SIZE - 1)
    ? row * BOARD_SIZE + column
    : -1;
}

export function zoneCells(row, column) {
  if (!integer(row, 0, BOARD_SIZE - 2) || !integer(column, 0, BOARD_SIZE - 2)) return Object.freeze([]);
  return Object.freeze([
    cellIndex(row, column),
    cellIndex(row, column + 1),
    cellIndex(row + 1, column),
    cellIndex(row + 1, column + 1),
  ]);
}

export function validMove(move) {
  return Boolean(move)
    && integer(move.row, 0, BOARD_SIZE - 2)
    && integer(move.column, 0, BOARD_SIZE - 2)
    && ROTATIONS.includes(move.direction);
}

export function normalizeMove(move) {
  return validMove(move)
    ? Object.freeze({ row: move.row, column: move.column, direction: move.direction })
    : null;
}

/**
 * Twiddle's base operation: clicking a 2×2 center with the left button turns
 * counter-clockwise; the right button turns clockwise.  We expose both names
 * so touch and keyboard controls have no ambiguous implicit direction.
 */
export function rotateBoard(board, move) {
  const cleanMove = normalizeMove(move);
  if (!isBoard(board) || !cleanMove) return Object.freeze({ changed: false, board: isBoard(board) ? Object.freeze([...board]) : null, move: cleanMove });
  const [northWest, northEast, southWest, southEast] = zoneCells(cleanMove.row, cleanMove.column);
  const next = [...board];
  if (cleanMove.direction === "cw") {
    // [ a b ]       [ c a ]
    // [ c d ]  -->  [ d b ]
    next[northWest] = board[southWest];
    next[northEast] = board[northWest];
    next[southWest] = board[southEast];
    next[southEast] = board[northEast];
  } else {
    // [ a b ]       [ b d ]
    // [ c d ]  -->  [ a c ]
    next[northWest] = board[northEast];
    next[northEast] = board[southEast];
    next[southWest] = board[northWest];
    next[southEast] = board[southWest];
  }
  return Object.freeze({ changed: true, board: Object.freeze(next), move: cleanMove });
}

export function inverseMove(move) {
  const cleanMove = normalizeMove(move);
  if (!cleanMove) return null;
  return Object.freeze({
    row: cleanMove.row,
    column: cleanMove.column,
    direction: cleanMove.direction === "cw" ? "ccw" : "cw",
  });
}

export function replayMoves(startBoard, moves) {
  if (!isBoard(startBoard) || !Array.isArray(moves) || moves.length > 4096) return null;
  let board = Object.freeze([...startBoard]);
  const history = [];
  for (const rawMove of moves) {
    const result = rotateBoard(board, rawMove);
    if (!result.changed) return null;
    board = result.board;
    history.push(result.move);
  }
  return Object.freeze({ board, history: Object.freeze(history) });
}

export function inverseSequence(moves) {
  if (!Array.isArray(moves)) return null;
  const reversed = [];
  for (let index = moves.length - 1; index >= 0; index -= 1) {
    const inverse = inverseMove(moves[index]);
    if (!inverse) return null;
    reversed.push(inverse);
  }
  return Object.freeze(reversed);
}

export function evaluateBoard(board) {
  if (!isBoard(board)) return Object.freeze({ valid: false, complete: false, aligned: 0, misplaced: TILE_COUNT });
  const aligned = board.reduce((total, tile, index) => total + Number(tile === index + 1), 0);
  return Object.freeze({ valid: true, complete: aligned === TILE_COUNT, aligned, misplaced: TILE_COUNT - aligned });
}

/** Fixed, traceable Twiddle level constructor. */
export function defineLevel(source) {
  if (!source || !safeId(source.id) || !["easy", "medium", "hard"].includes(source.difficulty)
      || !integer(source.tier, 1, 3) || !integer(source.seed, 0, 0x7fffffff)
      || !Array.isArray(source.scramble) || source.scramble.length < 1 || source.scramble.length > 64) {
    throw new TypeError("Invalid Star Dial level metadata");
  }
  const scrambleReplay = replayMoves(SOLVED_BOARD, source.scramble);
  if (!scrambleReplay || evaluateBoard(scrambleReplay.board).complete) {
    throw new TypeError(`Level ${source.id} needs a non-solved, replayable scramble`);
  }
  const referenceSolution = inverseSequence(scrambleReplay.history);
  const solvedReplay = replayMoves(scrambleReplay.board, referenceSolution);
  if (!solvedReplay || !evaluateBoard(solvedReplay.board).complete) {
    throw new TypeError(`Level ${source.id} scramble cannot be reversed`);
  }
  return Object.freeze({
    id: source.id,
    title: String(source.title ?? source.id),
    subtitle: String(source.subtitle ?? "四格星环校准"),
    difficulty: source.difficulty,
    tier: source.tier,
    seed: source.seed,
    scramble: Object.freeze(scrambleReplay.history),
    initialBoard: scrambleReplay.board,
    referenceSolution,
    // This is a verified replay length, not an unproven global minimum.
    par: referenceSolution.length,
  });
}

export function validateLevel(level) {
  try {
    const canonical = defineLevel(level);
    return sameBoard(canonical.initialBoard, level?.initialBoard)
      && Array.isArray(level?.referenceSolution)
      && level.referenceSolution.length === canonical.referenceSolution.length
      && level.referenceSolution.every((move, index) => JSON.stringify(move) === JSON.stringify(canonical.referenceSolution[index]));
  } catch {
    return false;
  }
}

export function stateForLevel(level, history = []) {
  if (!validateLevel(level)) return null;
  const replay = replayMoves(level.initialBoard, history);
  if (!replay) return null;
  return Object.freeze({
    board: replay.board,
    history: replay.history,
    moves: replay.history.length,
    complete: evaluateBoard(replay.board).complete,
  });
}

export function applyStateMove(level, state, move) {
  if (!validateLevel(level) || !state || !isBoard(state.board) || !Array.isArray(state.history)) {
    return Object.freeze({ changed: false, state: null });
  }
  const expected = replayMoves(level.initialBoard, state.history);
  if (!expected || !sameBoard(expected.board, state.board) || evaluateBoard(state.board).complete) {
    return Object.freeze({ changed: false, state: Object.freeze({ ...state }) });
  }
  const result = rotateBoard(state.board, move);
  if (!result.changed) return Object.freeze({ changed: false, state: Object.freeze({ ...state }) });
  const nextHistory = Object.freeze([...expected.history, result.move]);
  return Object.freeze({
    changed: true,
    state: Object.freeze({
      board: result.board,
      history: nextHistory,
      moves: nextHistory.length,
      complete: evaluateBoard(result.board).complete,
    }),
  });
}

export function undoState(level, state) {
  if (!validateLevel(level) || !state || !Array.isArray(state.history) || state.history.length === 0) {
    return Object.freeze({ changed: false, state: state ?? null });
  }
  const replay = replayMoves(level.initialBoard, state.history.slice(0, -1));
  if (!replay) return Object.freeze({ changed: false, state });
  return Object.freeze({
    changed: true,
    state: Object.freeze({
      board: replay.board,
      history: replay.history,
      moves: replay.history.length,
      complete: evaluateBoard(replay.board).complete,
    }),
  });
}
