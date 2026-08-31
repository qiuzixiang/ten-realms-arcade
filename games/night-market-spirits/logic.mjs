export const EMPTY = null;
export const MIN_GROUP_SIZE = 2;
export const SCORE_SUBTRACT = 2;
export const CLEAR_BONUS = 0;

export const STATUS = Object.freeze({
  PLAYING: "playing",
  CLEARED: "cleared",
  STUCK: "stuck",
});

export const DIRECTIONS = Object.freeze([
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([1, 0]),
  Object.freeze([0, -1]),
]);

export const DIFFICULTIES = Object.freeze({
  lantern: Object.freeze({
    id: "lantern",
    name: "灯影巷",
    note: "5 × 6 · 3 类灯灵",
    width: 5,
    height: 6,
    colors: 3,
    salt: 0x31a92f17,
  }),
  canopy: Object.freeze({
    id: "canopy",
    name: "伞幕街",
    note: "6 × 7 · 4 类灯灵",
    width: 6,
    height: 7,
    colors: 4,
    salt: 0x72e4bc53,
  }),
  bell: Object.freeze({
    id: "bell",
    name: "终钟市",
    note: "7 × 8 · 5 类灯灵",
    width: 7,
    height: 8,
    colors: 5,
    salt: 0xc568d09b,
  }),
});

const GAME_VERSION = 1;

export function difficultyFor(value) {
  return DIFFICULTIES[value] ?? DIFFICULTIES.lantern;
}

export function normalizeSeed(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value) >>> 0;
  const text = String(value ?? "").trim();
  if (/^[+-]?\d+$/.test(text)) return Number.parseInt(text, 10) >>> 0;
  if (!text) return 1;

  let hash = 0x811c9dc5;
  for (const character of text) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createRandom(seed) {
  let value = normalizeSeed(seed);
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function boardShape(board) {
  if (!Array.isArray(board) || board.length === 0 || !Array.isArray(board[0])) return null;
  const width = board[0].length;
  if (width === 0 || board.some((row) => !Array.isArray(row) || row.length !== width)) return null;
  return { width, height: board.length };
}

export function validateBoard(board, options = {}) {
  const shape = boardShape(board);
  if (!shape) return false;
  if (Number.isInteger(options.width) && shape.width !== options.width) return false;
  if (Number.isInteger(options.height) && shape.height !== options.height) return false;
  const colors = Number.isInteger(options.colors) ? options.colors : Number.POSITIVE_INFINITY;
  return board.every((row) => row.every((cell) => (
    cell === EMPTY || (Number.isInteger(cell) && cell >= 0 && cell < colors)
  )));
}

export function inBounds(board, row, column) {
  const shape = boardShape(board);
  return Boolean(
    shape
    && Number.isInteger(row)
    && Number.isInteger(column)
    && row >= 0
    && column >= 0
    && row < shape.height
    && column < shape.width,
  );
}

export function cellAt(board, row, column) {
  return inBounds(board, row, column) ? board[row][column] : EMPTY;
}

export function keyOf(row, column) {
  return `${row}:${column}`;
}

export function pointFromKey(key) {
  const match = /^(\d+):(\d+)$/.exec(String(key));
  return match ? { row: Number(match[1]), column: Number(match[2]) } : null;
}

export function getGroup(board, row, column) {
  if (!inBounds(board, row, column)) return [];
  const color = board[row][column];
  if (color === EMPTY) return [];

  const found = [];
  const seen = new Set([keyOf(row, column)]);
  const queue = [{ row, column }];

  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    found.push(point);
    for (const [rowStep, columnStep] of DIRECTIONS) {
      const nextRow = point.row + rowStep;
      const nextColumn = point.column + columnStep;
      const key = keyOf(nextRow, nextColumn);
      if (
        !seen.has(key)
        && inBounds(board, nextRow, nextColumn)
        && board[nextRow][nextColumn] === color
      ) {
        seen.add(key);
        queue.push({ row: nextRow, column: nextColumn });
      }
    }
  }

  return found.sort((left, right) => left.row - right.row || left.column - right.column);
}

export function listGroups(board, minimumSize = MIN_GROUP_SIZE) {
  if (!validateBoard(board)) return [];
  const shape = boardShape(board);
  const visited = new Set();
  const groups = [];

  for (let row = 0; row < shape.height; row += 1) {
    for (let column = 0; column < shape.width; column += 1) {
      const key = keyOf(row, column);
      if (visited.has(key) || board[row][column] === EMPTY) continue;
      const group = getGroup(board, row, column);
      for (const point of group) visited.add(keyOf(point.row, point.column));
      if (group.length >= minimumSize) groups.push(group);
    }
  }

  return groups;
}

export function hasLegalMove(board) {
  if (!validateBoard(board)) return false;
  const shape = boardShape(board);
  for (let row = 0; row < shape.height; row += 1) {
    for (let column = 0; column < shape.width; column += 1) {
      const color = board[row][column];
      if (color === EMPTY) continue;
      if (column + 1 < shape.width && board[row][column + 1] === color) return true;
      if (row + 1 < shape.height && board[row + 1][column] === color) return true;
    }
  }
  return false;
}

export function countSpirits(board) {
  if (!validateBoard(board)) return 0;
  return board.reduce(
    (total, row) => total + row.reduce((rowTotal, cell) => rowTotal + Number(cell !== EMPTY), 0),
    0,
  );
}

export function isBoardEmpty(board) {
  return countSpirits(board) === 0;
}

export function scoreForGroup(size) {
  if (!Number.isFinite(size)) return 0;
  const base = Math.max(Math.trunc(size) - SCORE_SUBTRACT, 0);
  return base * base;
}

/**
 * Keep the input-mode focus policy pure and testable: keyboard activation must
 * restore focus after the selected board is rebuilt; pointer activation must
 * not programmatically focus the replacement cell.
 */
export function selectionRenderOptions(preferredFocus, keyboard = false) {
  return {
    preferredFocus,
    focus: keyboard === true,
  };
}

export function boardFocusTarget(board) {
  return isBoardEmpty(board) ? "board" : "cell";
}

export function statusForBoard(board) {
  if (isBoardEmpty(board)) return STATUS.CLEARED;
  return hasLegalMove(board) ? STATUS.PLAYING : STATUS.STUCK;
}

export function collapseBoard(board, points) {
  if (!validateBoard(board)) throw new TypeError("Board must be a non-empty rectangle.");
  const shape = boardShape(board);
  const removed = new Set(
    (Array.isArray(points) ? points : [])
      .filter((point) => inBounds(board, point?.row, point?.column))
      .map((point) => keyOf(point.row, point.column)),
  );
  const cleared = cloneBoard(board);

  for (const key of removed) {
    const point = pointFromKey(key);
    cleared[point.row][point.column] = EMPTY;
  }

  const columns = [];
  for (let column = 0; column < shape.width; column += 1) {
    const spirits = [];
    for (let row = shape.height - 1; row >= 0; row -= 1) {
      if (cleared[row][column] !== EMPTY) spirits.push(cleared[row][column]);
    }
    if (spirits.length > 0) columns.push(spirits);
  }

  const result = Array.from({ length: shape.height }, () => Array(shape.width).fill(EMPTY));
  columns.forEach((spirits, column) => {
    spirits.forEach((color, offset) => {
      result[shape.height - 1 - offset][column] = color;
    });
  });
  return result;
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function runSizes(height, random) {
  const sizes = [];
  let remaining = height;
  while (remaining > 0) {
    if (remaining <= 3) {
      sizes.push(remaining);
      break;
    }
    const options = [2, 3].filter((size) => remaining - size !== 1);
    const size = options[Math.floor(random() * options.length)];
    sizes.push(size);
    remaining -= size;
  }
  return sizes;
}

/**
 * Every initial column is built from vertical runs of length 2 or 3. Each run
 * therefore remains a removable group as gravity and stable column compaction
 * move it. This construction guarantees at least one complete evacuation path.
 */
export function generateBoard(seed, difficulty = "lantern") {
  const config = difficultyFor(difficulty);
  const normalizedSeed = normalizeSeed(seed);
  const random = createRandom(normalizedSeed ^ config.salt);
  const board = Array.from({ length: config.height }, () => Array(config.width).fill(EMPTY));
  let bag = [];

  const nextColor = (previous) => {
    if (bag.length === 0) bag = shuffle(Array.from({ length: config.colors }, (_, index) => index), random);
    let color = bag.pop();
    if (color === previous && config.colors > 1) {
      if (bag.length === 0) bag = shuffle(Array.from({ length: config.colors }, (_, index) => index), random);
      const alternativeIndex = bag.findIndex((candidate) => candidate !== previous);
      if (alternativeIndex >= 0) {
        [color, bag[alternativeIndex]] = [bag[alternativeIndex], color];
      }
    }
    return color;
  };

  for (let column = 0; column < config.width; column += 1) {
    let row = config.height;
    let previous = -1;
    for (const size of runSizes(config.height, random)) {
      const color = nextColor(previous);
      for (let offset = 0; offset < size; offset += 1) {
        row -= 1;
        board[row][column] = color;
      }
      previous = color;
    }
  }

  return board;
}

export function evacuationPath(board) {
  if (!validateBoard(board)) return null;
  let current = cloneBoard(board);
  const path = [];
  const limit = countSpirits(current);

  for (let step = 0; step <= limit; step += 1) {
    if (isBoardEmpty(current)) return path;
    const group = listGroups(current)[0];
    if (!group) return null;
    const anchor = group[0];
    path.push({ ...anchor });
    current = collapseBoard(current, group);
  }
  return null;
}

export function createGame(options = {}) {
  const difficulty = difficultyFor(options.difficulty).id;
  const seed = normalizeSeed(options.seed ?? 1);
  const board = generateBoard(seed, difficulty);
  return {
    version: GAME_VERSION,
    difficulty,
    seed,
    board,
    score: 0,
    moves: 0,
    removed: 0,
    status: statusForBoard(board),
  };
}

export function previewMove(game, row, column) {
  if (!game || !validateBoard(game.board)) {
    return { accepted: false, reason: "invalid-game", state: game, group: [] };
  }
  if (game.status !== STATUS.PLAYING) {
    return { accepted: false, reason: "game-over", state: game, group: [] };
  }
  if (!inBounds(game.board, row, column) || game.board[row][column] === EMPTY) {
    return { accepted: false, reason: "empty", state: game, group: [] };
  }
  const group = getGroup(game.board, row, column);
  if (group.length < MIN_GROUP_SIZE) {
    return { accepted: false, reason: "group-too-small", state: game, group };
  }

  const board = collapseBoard(game.board, group);
  const scoreDelta = scoreForGroup(group.length);
  return {
    accepted: true,
    state: game,
    group,
    board,
    scoreDelta,
    clearBonus: CLEAR_BONUS,
    status: statusForBoard(board),
  };
}

export function applyMove(game, row, column) {
  const preview = previewMove(game, row, column);
  if (!preview.accepted) return preview;
  const state = {
    ...game,
    board: preview.board,
    score: game.score + preview.scoreDelta,
    moves: game.moves + 1,
    removed: game.removed + preview.group.length,
    status: preview.status,
  };
  return { ...preview, state };
}

export function gameToJSON(game) {
  return {
    version: GAME_VERSION,
    difficulty: game.difficulty,
    seed: game.seed,
    board: cloneBoard(game.board),
    score: game.score,
    moves: game.moves,
    removed: game.removed,
    status: game.status,
  };
}

export function validateGame(game) {
  if (!game || typeof game !== "object" || game.version !== GAME_VERSION) return false;
  const config = DIFFICULTIES[game.difficulty];
  if (!config || normalizeSeed(game.seed) !== game.seed) return false;
  if (!validateBoard(game.board, config)) return false;
  if (!Number.isInteger(game.score) || game.score < 0) return false;
  if (!Number.isInteger(game.moves) || game.moves < 0) return false;
  if (!Number.isInteger(game.removed) || game.removed < 0) return false;
  if (game.removed !== config.width * config.height - countSpirits(game.board)) return false;
  return game.status === statusForBoard(game.board);
}

export function serializeGame(game) {
  if (!validateGame(game)) throw new TypeError("Cannot serialize an invalid game.");
  return JSON.stringify(gameToJSON(game));
}

export function restoreGame(serialized) {
  try {
    const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    if (!validateGame(parsed)) return null;
    return gameToJSON(parsed);
  } catch {
    return null;
  }
}
