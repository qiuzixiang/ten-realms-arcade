export const GAME_VERSION = 1;
export const GENERATOR_VERSION = 1;
export const SOLVER_DEPTH = 3;
export const MAX_HISTORY = 512;

export const STATUS = Object.freeze({
  PLAYING: "playing",
  WON: "won",
  OVER_LIMIT: "over-limit",
});

export const PRESETS = Object.freeze({
  "12x12-easy": Object.freeze({
    id: "12x12-easy",
    name: "春绢·从容",
    note: "12×12 · 6 色 · 参考线 +5 步",
    width: 12,
    height: 12,
    colours: 6,
    leniency: 5,
    tier: 1,
    salt: 0x12eac605,
  }),
  "12x12-medium": Object.freeze({
    id: "12x12-medium",
    name: "夏织·精进",
    note: "12×12 · 6 色 · 参考线 +2 步",
    width: 12,
    height: 12,
    colours: 6,
    leniency: 2,
    tier: 2,
    salt: 0x12ead602,
  }),
  "12x12-hard": Object.freeze({
    id: "12x12-hard",
    name: "秋锦·严选",
    note: "12×12 · 6 色 · 贴合参考线",
    width: 12,
    height: 12,
    colours: 6,
    leniency: 0,
    tier: 3,
    salt: 0x12ead600,
  }),
  "16x16-medium": Object.freeze({
    id: "16x16-medium",
    name: "冬幕·进阶",
    note: "16×16 · 6 色 · 参考线 +2 步",
    width: 16,
    height: 16,
    colours: 6,
    leniency: 2,
    tier: 2,
    salt: 0x16a6d602,
  }),
  "16x16-hard": Object.freeze({
    id: "16x16-hard",
    name: "玄机大幅",
    note: "16×16 · 6 色 · 贴合参考线",
    width: 16,
    height: 16,
    colours: 6,
    leniency: 0,
    tier: 3,
    salt: 0x16a6d600,
  }),
  "12x12-3": Object.freeze({
    id: "12x12-3",
    name: "三候素染",
    note: "12×12 · 3 色 · 贴合参考线",
    width: 12,
    height: 12,
    colours: 3,
    leniency: 0,
    tier: 2,
    salt: 0x1230c300,
  }),
  "12x12-4": Object.freeze({
    id: "12x12-4",
    name: "四时雅染",
    note: "12×12 · 4 色 · 贴合参考线",
    width: 12,
    height: 12,
    colours: 4,
    leniency: 0,
    tier: 2,
    salt: 0x1240c400,
  }),
});

export const DEFAULT_PRESET_ID = "12x12-easy";

const PUZZLE_CACHE = new Map();
const PUZZLE_CACHE_LIMIT = 24;

const DIRECTIONS = Object.freeze([
  Object.freeze([0, 1]),
  Object.freeze([1, 0]),
  Object.freeze([0, -1]),
  Object.freeze([-1, 0]),
]);

export function presetFor(value) {
  return PRESETS[value] ?? PRESETS[DEFAULT_PRESET_ID];
}

export function validateParameters(params) {
  if (!params || typeof params !== "object") return false;
  if (!Number.isInteger(params.width) || !Number.isInteger(params.height)) return false;
  if (params.width < 1 || params.height < 1 || params.width * params.height < 2) return false;
  if (!Number.isSafeInteger(params.width * params.height)) return false;
  if (!Number.isInteger(params.colours) || params.colours < 3 || params.colours > 10) return false;
  return Number.isInteger(params.leniency) && params.leniency >= 0;
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

export function validateBoard(board, params) {
  if (!validateParameters(params) || !Array.isArray(board)) return false;
  if (board.length !== params.width * params.height) return false;
  return board.every((colour) => (
    Number.isInteger(colour) && colour >= 0 && colour < params.colours
  ));
}

function forEachNeighbour(index, width, height, visit) {
  const row = Math.floor(index / width);
  const column = index % width;
  for (const [rowStep, columnStep] of DIRECTIONS) {
    const nextRow = row + rowStep;
    const nextColumn = column + columnStep;
    if (nextRow < 0 || nextRow >= height || nextColumn < 0 || nextColumn >= width) continue;
    visit(nextRow * width + nextColumn);
  }
}

export function connectedComponent(board, width, height, start = 0) {
  if (
    !Array.isArray(board)
    || !Number.isInteger(width)
    || !Number.isInteger(height)
    || board.length !== width * height
    || !Number.isInteger(start)
    || start < 0
    || start >= board.length
  ) return [];

  const colour = board[start];
  const queue = [start];
  const seen = new Uint8Array(board.length);
  seen[start] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    forEachNeighbour(queue[cursor], width, height, (next) => {
      if (!seen[next] && board[next] === colour) {
        seen[next] = 1;
        queue.push(next);
      }
    });
  }
  return queue;
}

export function isComplete(board) {
  return Array.isArray(board) && board.length > 0 && board.every((colour) => colour === board[0]);
}

/**
 * Faithful upstream fill: recolour only the old top-left component. Existing
 * cells of the selected colour are not rewritten; once touching, they become
 * part of the newly controlled component by connectivity.
 */
export function fillBoard(board, width, height, newColour) {
  if (!Array.isArray(board) || board.length !== width * height) {
    throw new TypeError("Board dimensions are inconsistent.");
  }
  if (!Number.isInteger(newColour)) {
    return { accepted: false, reason: "invalid-colour", board };
  }
  if (newColour === board[0]) {
    return { accepted: false, reason: "same-colour", board };
  }

  const recoloured = connectedComponent(board, width, height, 0);
  const next = [...board];
  for (const index of recoloured) next[index] = newColour;
  const controlled = connectedComponent(next, width, height, 0);
  const recolouredSet = new Set(recoloured);
  const absorbed = controlled.filter((index) => !recolouredSet.has(index));
  return {
    accepted: true,
    board: next,
    recoloured,
    absorbed,
    controlled,
    expandedBy: absorbed.length,
  };
}

export function generateBoard(seed, presetId = DEFAULT_PRESET_ID) {
  const preset = presetFor(presetId);
  const normalizedSeed = normalizeSeed(seed);
  // Difficulty leniency never changes the underlying cloth: matching geometry
  // and colour counts consume the same seeded stream, as in upstream Flood.
  const random = createRandom(normalizedSeed);
  let board;
  do {
    board = Array.from(
      { length: preset.width * preset.height },
      () => Math.floor(random() * preset.colours),
    );
  } while (isComplete(board));
  return board;
}

/** Return the upstream solver's leaf metrics via a 0/1 shortest-path search. */
export function searchMetrics(board, width, height) {
  const count = board.length;
  const distance = Array(count).fill(Number.POSITIVE_INFINITY);
  const deque = Array(count * 4);
  let head = count * 2;
  let tail = head;
  deque[tail] = 0;
  tail += 1;
  distance[0] = 0;

  while (head < tail) {
    const index = deque[head];
    head += 1;
    const base = distance[index];
    forEachNeighbour(index, width, height, (next) => {
      const cost = board[next] === board[index] ? 0 : 1;
      const candidate = base + cost;
      if (candidate >= distance[next]) return;
      distance[next] = candidate;
      if (cost === 0) {
        head -= 1;
        deque[head] = next;
      } else {
        deque[tail] = next;
        tail += 1;
      }
    });
  }

  const dist = Math.max(...distance);
  return {
    dist,
    number: distance.filter((value) => value === dist).length,
    control: distance.filter((value) => value === 0).length,
  };
}

function betterMetrics(candidate, current) {
  if (!current) return true;
  if (candidate.dist !== current.dist) return candidate.dist < current.dist;
  if (candidate.number !== current.number) return candidate.number < current.number;
  return candidate.control > current.control;
}

function chooseMoveRecursive(board, width, height, colours, depth) {
  let best = null;
  for (let colour = 0; colour < colours; colour += 1) {
    if (colour === board[0]) continue;
    const filled = fillBoard(board, width, height, colour);
    if (isComplete(filled.board)) {
      return { move: colour, dist: -1, number: depth, control: board.length };
    }
    const metrics = depth < SOLVER_DEPTH - 1
      ? chooseMoveRecursive(filled.board, width, height, colours, depth + 1)
      : searchMetrics(filled.board, width, height);
    const candidate = { ...metrics, move: colour };
    if (betterMetrics(candidate, best)) best = candidate;
  }
  return best;
}

export function chooseSuggestedMove(board, width, height, colours) {
  if (isComplete(board)) return null;
  return chooseMoveRecursive(board, width, height, colours, 0)?.move ?? null;
}

export function solveBoard(board, width, height, colours) {
  let current = [...board];
  const path = [];
  const limit = board.length;
  while (!isComplete(current) && path.length < limit) {
    const colour = chooseSuggestedMove(current, width, height, colours);
    if (!Number.isInteger(colour) || colour === current[0]) {
      throw new Error("Reference solver failed to make progress.");
    }
    path.push(colour);
    current = fillBoard(current, width, height, colour).board;
  }
  if (!isComplete(current)) throw new Error("Reference solver exceeded the safe move bound.");
  return path;
}

export function buildPuzzle(seed, presetId = DEFAULT_PRESET_ID) {
  const preset = presetFor(presetId);
  const normalizedSeed = normalizeSeed(seed);
  const cacheKey = `${preset.id}:${normalizedSeed}`;
  const cached = PUZZLE_CACHE.get(cacheKey);
  if (cached) {
    return {
      preset,
      seed: normalizedSeed,
      initialBoard: [...cached.initialBoard],
      referencePath: [...cached.referencePath],
      referenceMoves: cached.referenceMoves,
      moveLimit: cached.moveLimit,
    };
  }
  const board = generateBoard(normalizedSeed, preset.id);
  const referencePath = solveBoard(board, preset.width, preset.height, preset.colours);
  const puzzle = {
    preset,
    seed: normalizedSeed,
    initialBoard: board,
    referencePath,
    referenceMoves: referencePath.length,
    moveLimit: referencePath.length + preset.leniency,
  };
  PUZZLE_CACHE.set(cacheKey, puzzle);
  if (PUZZLE_CACHE.size > PUZZLE_CACHE_LIMIT) {
    PUZZLE_CACHE.delete(PUZZLE_CACHE.keys().next().value);
  }
  return {
    ...puzzle,
    initialBoard: [...puzzle.initialBoard],
    referencePath: [...puzzle.referencePath],
  };
}

export function statusFor(board, moves, moveLimit) {
  if (isComplete(board) && moves <= moveLimit) return STATUS.WON;
  if (moves >= moveLimit) return STATUS.OVER_LIMIT;
  return STATUS.PLAYING;
}

function stateFromPuzzle(puzzle, timeline = [], reportedCompletionId = "") {
  let board = [...puzzle.initialBoard];
  let wastes = 0;
  let cleanStreak = 0;
  let maxCleanStreak = 0;
  const acceptedTimeline = [];

  for (const colour of timeline) {
    if (
      !Number.isInteger(colour)
      || colour < 0
      || colour >= puzzle.preset.colours
      || colour === board[0]
      || isComplete(board)
    ) return null;
    const result = fillBoard(board, puzzle.preset.width, puzzle.preset.height, colour);
    board = result.board;
    acceptedTimeline.push(colour);
    if (result.expandedBy === 0) {
      wastes += 1;
      cleanStreak = 0;
    } else {
      cleanStreak += 1;
      maxCleanStreak = Math.max(maxCleanStreak, cleanStreak);
    }
  }

  const moves = acceptedTimeline.length;
  const status = statusFor(board, moves, puzzle.moveLimit);
  if (reportedCompletionId && status !== STATUS.WON) return null;
  return {
    version: GAME_VERSION,
    generatorVersion: GENERATOR_VERSION,
    presetId: puzzle.preset.id,
    seed: puzzle.seed,
    board,
    timeline: acceptedTimeline,
    moves,
    moveLimit: puzzle.moveLimit,
    referenceMoves: puzzle.referenceMoves,
    status,
    controlled: connectedComponent(board, puzzle.preset.width, puzzle.preset.height, 0).length,
    wastes,
    cleanStreak,
    maxCleanStreak,
    reportedCompletionId,
  };
}

export function createGame(options = {}) {
  const puzzle = buildPuzzle(options.seed ?? 1, options.presetId ?? DEFAULT_PRESET_ID);
  return stateFromPuzzle(puzzle);
}

export function applyMove(game, colour) {
  const preset = PRESETS[game?.presetId];
  if (!preset || !Array.isArray(game.board)) {
    return { accepted: false, reason: "invalid-game", state: game };
  }
  if (!Number.isInteger(colour) || colour < 0 || colour >= preset.colours) {
    return { accepted: false, reason: "invalid-colour", state: game };
  }
  if (isComplete(game.board)) {
    return { accepted: false, reason: "complete", state: game };
  }
  if (colour === game.board[0]) {
    return { accepted: false, reason: "same-colour", state: game };
  }
  if (game.timeline.length >= MAX_HISTORY) {
    return { accepted: false, reason: "history-limit", state: game };
  }

  const fill = fillBoard(game.board, preset.width, preset.height, colour);
  const timeline = [...game.timeline, colour];
  const moves = game.moves + 1;
  const cleanStreak = fill.expandedBy > 0 ? game.cleanStreak + 1 : 0;
  const state = {
    ...game,
    board: fill.board,
    timeline,
    moves,
    status: statusFor(fill.board, moves, game.moveLimit),
    controlled: fill.controlled.length,
    wastes: game.wastes + Number(fill.expandedBy === 0),
    cleanStreak,
    maxCleanStreak: Math.max(game.maxCleanStreak, cleanStreak),
    reportedCompletionId: "",
  };
  return { accepted: true, state, ...fill };
}

export function undoMove(game) {
  if (!game?.timeline?.length) return game;
  const puzzle = buildPuzzle(game.seed, game.presetId);
  return stateFromPuzzle(puzzle, game.timeline.slice(0, -1));
}

export function restartGame(game) {
  return createGame({ seed: game.seed, presetId: game.presetId });
}

export function markCompletionReported(game, completionId) {
  if (game?.status !== STATUS.WON || typeof completionId !== "string" || !completionId) return game;
  return { ...game, reportedCompletionId: completionId.slice(0, 180) };
}

export function serializeGame(game) {
  if (
    !game
    || game.version !== GAME_VERSION
    || game.generatorVersion !== GENERATOR_VERSION
    || !PRESETS[game.presetId]
    || !Array.isArray(game.timeline)
    || game.timeline.length > MAX_HISTORY
  ) {
    throw new TypeError("Cannot serialize an invalid game.");
  }
  return JSON.stringify({
    version: GAME_VERSION,
    generatorVersion: GENERATOR_VERSION,
    presetId: game.presetId,
    seed: game.seed,
    timeline: [...game.timeline],
    reportedCompletionId: game.reportedCompletionId || "",
  });
}

export function restoreGame(candidate) {
  try {
    const parsed = typeof candidate === "string" ? JSON.parse(candidate) : candidate;
    if (
      !parsed
      || parsed.version !== GAME_VERSION
      || parsed.generatorVersion !== GENERATOR_VERSION
      || !PRESETS[parsed.presetId]
    ) return null;
    if (normalizeSeed(parsed.seed) !== parsed.seed) return null;
    if (!Array.isArray(parsed.timeline) || parsed.timeline.length > MAX_HISTORY) return null;
    if (typeof parsed.reportedCompletionId !== "string" || parsed.reportedCompletionId.length > 180) return null;
    const puzzle = buildPuzzle(parsed.seed, parsed.presetId);
    return stateFromPuzzle(puzzle, parsed.timeline, parsed.reportedCompletionId);
  } catch {
    return null;
  }
}

export function puzzleIdFor(game, mode = "seed", day = "") {
  if (mode === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return `v${GENERATOR_VERSION}:${game.presetId}:daily:${day}`;
  }
  return `v${GENERATOR_VERSION}:${game.presetId}:seed:${game.seed}`;
}

export function localDayKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const safe = Number.isNaN(value.getTime()) ? new Date() : value;
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, "0");
  const day = String(safe.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dailySeed(dayKey = localDayKey()) {
  return normalizeSeed(`season-dyehouse:daily:${dayKey}`);
}
