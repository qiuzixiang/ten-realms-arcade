/**
 * DOM-free Shikaku / Rectangles engine for Dream Hotel.
 *
 * A solved floor is an exact tiling of the board by axis-aligned rectangles.
 * Every rectangle contains exactly one clue and its area equals that clue.
 * Candidate rectangles and exclusion marks are notes only: they never affect
 * validation, solution search, or completion.
 */

export const TOOL_TYPES = Object.freeze({
  ROOM: "room",
  CANDIDATE: "candidate",
  EXCLUDE: "exclude",
});

export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);
const VALID_TOOLS = new Set(Object.values(TOOL_TYPES));
const METRIC_KEYS = Object.freeze([
  "moves",
  "invalidAttempts",
  "validPlacements",
  "reworks",
  "removals",
  "undos",
  "restarts",
]);
const MAX_COUNTER = 1_000_000;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeCounter(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNTER;
}

function copyRect(rect) {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function parsePoint(value) {
  if (Array.isArray(value) && value.length === 2) {
    return { x: value[0], y: value[1] };
  }
  if (isPlainObject(value)) return { x: value.x, y: value.y };
  return { x: Number.NaN, y: Number.NaN };
}

export function cellKey(point, y) {
  const cell = Number.isInteger(point) ? { x: point, y } : parsePoint(point);
  if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
    throw new TypeError("Cell coordinates must be integers");
  }
  return `${cell.x},${cell.y}`;
}

export function parseCellKey(key) {
  if (typeof key !== "string" || !/^(?:0|[1-9]\d*),(?:0|[1-9]\d*)$/.test(key)) {
    throw new TypeError(`Invalid cell key: ${String(key)}`);
  }
  const [x, y] = key.split(",").map(Number);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    throw new TypeError(`Invalid cell key: ${key}`);
  }
  return { x, y };
}

export function inBounds(puzzle, point, y) {
  const cell = Number.isInteger(point) ? { x: point, y } : parsePoint(point);
  return Number.isInteger(cell.x)
    && Number.isInteger(cell.y)
    && cell.x >= 0
    && cell.y >= 0
    && cell.x < puzzle?.width
    && cell.y < puzzle?.height;
}

/** Create an inclusive cell rectangle from any two drag endpoints. */
export function normalizeRect(start, end = start) {
  const first = parsePoint(start);
  const last = parsePoint(end);
  if (![first.x, first.y, last.x, last.y].every(Number.isInteger)) {
    throw new TypeError("Rectangle endpoints must have integer coordinates");
  }
  const x = Math.min(first.x, last.x);
  const y = Math.min(first.y, last.y);
  return {
    x,
    y,
    width: Math.abs(first.x - last.x) + 1,
    height: Math.abs(first.y - last.y) + 1,
  };
}

export function normalizeStoredRect(value) {
  if (!isPlainObject(value)) return null;
  const rect = {
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
  };
  return Object.values(rect).every(Number.isSafeInteger)
    && rect.x >= 0
    && rect.y >= 0
    && rect.width >= 1
    && rect.height >= 1
    ? rect
    : null;
}

export function rectKey(rect) {
  const normalized = normalizeStoredRect(rect);
  if (!normalized) throw new TypeError("Expected a canonical rectangle");
  return `${normalized.x},${normalized.y},${normalized.width},${normalized.height}`;
}

export function rectangleArea(rect) {
  return rect.width * rect.height;
}

export function rectangleEquals(first, second) {
  return first.x === second.x
    && first.y === second.y
    && first.width === second.width
    && first.height === second.height;
}

export function rectangleContains(rect, point) {
  const cell = parsePoint(point);
  return cell.x >= rect.x
    && cell.y >= rect.y
    && cell.x < rect.x + rect.width
    && cell.y < rect.y + rect.height;
}

export function rectangleInBounds(puzzle, rect) {
  const normalized = normalizeStoredRect(rect);
  return Boolean(normalized)
    && normalized.x + normalized.width <= puzzle?.width
    && normalized.y + normalized.height <= puzzle?.height;
}

export function rectanglesOverlap(first, second) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

export function rectangleCells(rect) {
  const cells = [];
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

export function cluesInRectangle(puzzle, rect) {
  return puzzle.clues.filter((clue) => rectangleContains(rect, clue));
}

export function roomTypeKey(rect) {
  const dimensions = [rect.width, rect.height].sort((left, right) => left - right);
  return `${dimensions[0]}×${dimensions[1]}`;
}

function hashSeed(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Stable PRNG used only for reproducible clue placement and level ordering. */
export function createSeededRandom(seed) {
  let value = hashSeed(seed) || 0x9e3779b9;
  return () => {
    value += 0x6d2b79f5;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function validateTiling(width, height, rooms) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return false;
  if (!Array.isArray(rooms) || rooms.length === 0) return false;
  const coverage = Array(width * height).fill(0);
  for (const rawRoom of rooms) {
    const room = normalizeStoredRect(rawRoom);
    if (!room || room.x + room.width > width || room.y + room.height > height) return false;
    for (const { x, y } of rectangleCells(room)) coverage[y * width + x] += 1;
  }
  return coverage.every((count) => count === 1);
}

/**
 * Build a reproducible puzzle from a complete rectangular tiling.
 * Each room may provide `clue: {x,y}`; otherwise its clue cell is chosen by
 * the stable seed. Uniqueness is intentionally proved separately by solver.
 */
export function buildPuzzleFromRooms(definition) {
  if (!isPlainObject(definition) || !validateTiling(definition.width, definition.height, definition.rooms)) {
    throw new TypeError("Level rooms must form an exact, non-overlapping tiling");
  }
  if (typeof definition.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(definition.id)) {
    throw new TypeError("Level id must be URL safe");
  }
  if (!DIFFICULTIES.includes(definition.difficulty)) throw new TypeError("Unknown difficulty");

  const random = createSeededRandom(definition.seed ?? definition.id);
  const solution = definition.rooms.map(copyRect);
  const clues = definition.rooms.map((rawRoom) => {
    const room = copyRect(rawRoom);
    let clue = rawRoom.clue ? parsePoint(rawRoom.clue) : null;
    if (!clue || !rectangleContains(room, clue) || !inBounds(definition, clue)) {
      const cells = rectangleCells(room);
      clue = cells[Math.floor(random() * cells.length)];
    }
    return { x: clue.x, y: clue.y, value: rectangleArea(room) };
  }).sort((left, right) => (left.y - right.y) || (left.x - right.x));

  const puzzle = {
    id: definition.id,
    title: String(definition.title ?? definition.id),
    subtitle: String(definition.subtitle ?? ""),
    difficulty: definition.difficulty,
    width: definition.width,
    height: definition.height,
    seed: String(definition.seed ?? definition.id),
    clues,
    solution,
  };
  const errors = getPuzzleErrors(puzzle);
  if (errors.length) throw new TypeError(`Generated puzzle is invalid: ${errors.join("; ")}`);
  return puzzle;
}

function basicPuzzleErrors(puzzle, { checkSolution = true } = {}) {
  const errors = [];
  if (!isPlainObject(puzzle)) return ["puzzle must be a plain object"];
  if (!Number.isInteger(puzzle.width) || puzzle.width < 2 || puzzle.width > 12) {
    errors.push("width must be an integer from 2 to 12");
  }
  if (!Number.isInteger(puzzle.height) || puzzle.height < 2 || puzzle.height > 12) {
    errors.push("height must be an integer from 2 to 12");
  }
  if (typeof puzzle.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(puzzle.id)) {
    errors.push("id must be a URL-safe string");
  }
  if (!DIFFICULTIES.includes(puzzle.difficulty)) errors.push("difficulty is invalid");
  if (!Array.isArray(puzzle.clues) || puzzle.clues.length === 0) {
    errors.push("clues must be a non-empty array");
  } else if (Number.isInteger(puzzle.width) && Number.isInteger(puzzle.height)) {
    const occupied = new Set();
    let clueArea = 0;
    for (const [index, clue] of puzzle.clues.entries()) {
      if (!isPlainObject(clue)
          || !Number.isInteger(clue.x)
          || !Number.isInteger(clue.y)
          || !Number.isInteger(clue.value)
          || clue.value < 1) {
        errors.push(`clue ${index} is malformed`);
        continue;
      }
      if (!inBounds(puzzle, clue)) errors.push(`clue ${index} is out of bounds`);
      const key = cellKey(clue);
      if (occupied.has(key)) errors.push(`duplicate clue at ${key}`);
      occupied.add(key);
      clueArea += clue.value;
    }
    if (clueArea !== puzzle.width * puzzle.height) {
      errors.push("clue values must sum to the board area");
    }
  }

  if (checkSolution && puzzle.solution !== undefined) {
    if (!Array.isArray(puzzle.solution) || puzzle.solution.length !== puzzle.clues?.length) {
      errors.push("solution must contain one rectangle per clue");
    } else if (Number.isInteger(puzzle.width) && Number.isInteger(puzzle.height)) {
      const analysis = analyzeRooms(puzzle, puzzle.solution);
      if (!analysis.solved) errors.push(`stored solution is invalid: ${analysis.errors.join(", ")}`);
    }
  }
  return errors;
}

export function getPuzzleErrors(puzzle, options = {}) {
  const errors = basicPuzzleErrors(puzzle, options);
  if (errors.length || !Array.isArray(puzzle?.clues)) return errors;
  for (const [index, clue] of puzzle.clues.entries()) {
    if (candidateRectanglesForClue(puzzle, clue).length === 0) {
      errors.push(`clue ${index} has no possible rectangle`);
    }
  }
  return errors;
}

export function validatePuzzle(puzzle, options) {
  return getPuzzleErrors(puzzle, options).length === 0;
}

export function assertValidPuzzle(puzzle, options) {
  const errors = getPuzzleErrors(puzzle, options);
  if (errors.length) throw new TypeError(`Invalid puzzle: ${errors.join("; ")}`);
  return puzzle;
}

export function candidateRectanglesForClue(puzzle, clue) {
  if (!inBounds(puzzle, clue) || !Number.isInteger(clue?.value) || clue.value < 1) return [];
  const candidates = [];
  const seen = new Set();
  for (let width = 1; width <= clue.value; width += 1) {
    if (clue.value % width !== 0) continue;
    const height = clue.value / width;
    if (width > puzzle.width || height > puzzle.height) continue;
    const minimumX = Math.max(0, clue.x - width + 1);
    const maximumX = Math.min(clue.x, puzzle.width - width);
    const minimumY = Math.max(0, clue.y - height + 1);
    const maximumY = Math.min(clue.y, puzzle.height - height);
    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let x = minimumX; x <= maximumX; x += 1) {
        const rect = { x, y, width, height };
        if (cluesInRectangle(puzzle, rect).length !== 1) continue;
        const key = rectKey(rect);
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(rect);
        }
      }
    }
  }
  return candidates.sort((left, right) => rectKey(left).localeCompare(rectKey(right)));
}

/** Exact-cover solver. A limit of 2 is sufficient to prove or refute uniqueness. */
export function solvePuzzle(puzzle, { limit = 2 } = {}) {
  const errors = basicPuzzleErrors(puzzle, { checkSolution: false });
  if (errors.length) throw new TypeError(`Cannot solve invalid puzzle: ${errors.join("; ")}`);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
    throw new RangeError("Solution limit must be an integer from 1 to 10000");
  }

  const candidates = puzzle.clues.map((clue) => candidateRectanglesForClue(puzzle, clue));
  const chosen = Array(puzzle.clues.length).fill(null);
  const occupied = new Set();
  const solutions = [];
  let nodes = 0;
  let stoppedAtLimit = false;

  function canPlace(rect) {
    return rectangleCells(rect).every((cell) => !occupied.has(cellKey(cell)));
  }

  function search(depth) {
    nodes += 1;
    if (solutions.length >= limit) {
      stoppedAtLimit = true;
      return;
    }
    if (depth === puzzle.clues.length) {
      if (occupied.size === puzzle.width * puzzle.height) {
        solutions.push(chosen.map(copyRect));
      }
      return;
    }

    let clueIndex = -1;
    let viable = null;
    for (let index = 0; index < candidates.length; index += 1) {
      if (chosen[index]) continue;
      const available = candidates[index].filter(canPlace);
      if (available.length === 0) return;
      if (!viable || available.length < viable.length) {
        clueIndex = index;
        viable = available;
      }
    }

    for (const rect of viable ?? []) {
      const keys = rectangleCells(rect).map(cellKey);
      chosen[clueIndex] = rect;
      keys.forEach((key) => occupied.add(key));
      search(depth + 1);
      keys.forEach((key) => occupied.delete(key));
      chosen[clueIndex] = null;
      if (solutions.length >= limit) {
        stoppedAtLimit = true;
        return;
      }
    }
  }

  search(0);
  return {
    count: solutions.length,
    solutions,
    nodes,
    exhausted: !stoppedAtLimit,
    unique: solutions.length === 1 && !stoppedAtLimit,
  };
}

export function analyzeRooms(puzzle, rawRooms) {
  const rooms = Array.isArray(rawRooms) ? rawRooms : [];
  const coverage = Array(Math.max(0, (puzzle?.width ?? 0) * (puzzle?.height ?? 0))).fill(0);
  const errors = [];
  const roomResults = [];

  for (const [index, rawRoom] of rooms.entries()) {
    const rect = normalizeStoredRect(rawRoom);
    if (!rect || !rectangleInBounds(puzzle, rect)) {
      errors.push(`room-${index}:out-of-bounds`);
      roomResults.push({ index, valid: false, reason: "out-of-bounds" });
      continue;
    }
    const clues = cluesInRectangle(puzzle, rect);
    let reason = null;
    if (clues.length === 0) reason = "missing-clue";
    else if (clues.length > 1) reason = "multiple-clues";
    else if (rectangleArea(rect) !== clues[0].value) reason = "wrong-area";
    if (reason) errors.push(`room-${index}:${reason}`);
    roomResults.push({ index, rect, clue: clues[0] ?? null, valid: !reason, reason });
    for (const { x, y } of rectangleCells(rect)) coverage[y * puzzle.width + x] += 1;
  }

  const overlapCells = [];
  const uncoveredCells = [];
  coverage.forEach((count, index) => {
    const cell = { x: index % puzzle.width, y: Math.floor(index / puzzle.width) };
    if (count > 1) overlapCells.push(cell);
    if (count === 0) uncoveredCells.push(cell);
  });
  if (overlapCells.length) errors.push("rooms-overlap");
  if (uncoveredCells.length) errors.push("floor-uncovered");

  const clueCoverage = puzzle.clues.map((clue) => rooms.filter((room) => {
    const normalized = normalizeStoredRect(room);
    return normalized && rectangleContains(normalized, clue);
  }).length);
  if (clueCoverage.some((count) => count !== 1)) errors.push("clue-coverage");

  return {
    solved: errors.length === 0
      && rooms.length === puzzle.clues.length
      && coverage.length > 0
      && coverage.every((count) => count === 1),
    errors,
    roomResults,
    coverage,
    overlapCells,
    uncoveredCells,
    clueCoverage,
    coveredCount: coverage.filter((count) => count === 1).length,
  };
}

function emptyMetrics() {
  return Object.fromEntries(METRIC_KEYS.map((key) => [key, 0]));
}

export function createGameState() {
  return {
    rooms: [],
    candidates: [],
    excluded: new Set(),
    metrics: emptyMetrics(),
  };
}

export function cloneGameState(state) {
  return {
    rooms: state.rooms.map(copyRect),
    candidates: state.candidates.map(copyRect),
    excluded: new Set(state.excluded),
    metrics: { ...state.metrics },
  };
}

export function boardSnapshot(state) {
  return {
    rooms: state.rooms.map(copyRect),
    candidates: state.candidates.map(copyRect),
    excluded: [...state.excluded].sort(),
  };
}

export function roomAtCell(state, point) {
  return state.rooms.find((room) => rectangleContains(room, point)) ?? null;
}

export function analyzeProposal(puzzle, state, rawRect, tool = TOOL_TYPES.ROOM) {
  const rect = normalizeStoredRect(rawRect);
  if (!VALID_TOOLS.has(tool)) return { valid: false, reason: "unknown-tool", rect };
  if (!rect || !rectangleInBounds(puzzle, rect)) return { valid: false, reason: "out-of-bounds", rect };
  if (tool !== TOOL_TYPES.ROOM) return { valid: true, action: "note", rect, reason: null };

  const exact = state.rooms.find((room) => rectangleEquals(room, rect));
  const tapped = rectangleArea(rect) === 1 ? roomAtCell(state, { x: rect.x, y: rect.y }) : null;
  if (exact || tapped) return { valid: true, action: "remove", rect: exact ?? tapped, reason: null };

  const clues = cluesInRectangle(puzzle, rect);
  if (clues.length === 0) return { valid: false, reason: "missing-clue", rect };
  if (clues.length > 1) return { valid: false, reason: "multiple-clues", rect };
  if (rectangleArea(rect) !== clues[0].value) {
    return { valid: false, reason: "wrong-area", rect, clue: clues[0] };
  }
  if (state.rooms.some((room) => rectanglesOverlap(room, rect))) {
    return { valid: false, reason: "overlap", rect, clue: clues[0] };
  }
  return { valid: true, action: "place", rect, clue: clues[0], reason: null };
}

function changedResult(state, extra = {}) {
  return { changed: true, state, ...extra };
}

export function recordInvalidAttempt(state, reason = "invalid") {
  const next = cloneGameState(state);
  next.metrics.moves += 1;
  next.metrics.invalidAttempts += 1;
  return changedResult(next, { action: "reject", reason });
}

export function applyRoom(puzzle, state, rawRect) {
  const proposal = analyzeProposal(puzzle, state, rawRect, TOOL_TYPES.ROOM);
  if (!proposal.valid) return { changed: false, state, action: "reject", reason: proposal.reason, proposal };
  const next = cloneGameState(state);
  next.metrics.moves += 1;
  if (proposal.action === "remove") {
    next.rooms = next.rooms.filter((room) => !rectangleEquals(room, proposal.rect));
    next.metrics.reworks += 1;
    next.metrics.removals += 1;
    return changedResult(next, { action: "remove", rect: proposal.rect, proposal });
  }
  next.rooms.push(copyRect(proposal.rect));
  next.rooms.sort((left, right) => rectKey(left).localeCompare(rectKey(right)));
  next.metrics.validPlacements += 1;
  return changedResult(next, { action: "place", rect: proposal.rect, proposal });
}

export function toggleCandidate(puzzle, state, rawRect) {
  const rect = normalizeStoredRect(rawRect);
  if (!rect || !rectangleInBounds(puzzle, rect)) {
    return { changed: false, state, action: "reject", reason: "out-of-bounds" };
  }
  const next = cloneGameState(state);
  const existing = next.candidates.find((candidate) => rectangleEquals(candidate, rect));
  if (existing) next.candidates = next.candidates.filter((candidate) => !rectangleEquals(candidate, rect));
  else next.candidates.push(copyRect(rect));
  next.candidates.sort((left, right) => rectKey(left).localeCompare(rectKey(right)));
  next.metrics.moves += 1;
  return changedResult(next, { action: existing ? "candidate-remove" : "candidate-add", rect });
}

export function toggleExclusions(puzzle, state, rawRect) {
  const rect = normalizeStoredRect(rawRect);
  if (!rect || !rectangleInBounds(puzzle, rect)) {
    return { changed: false, state, action: "reject", reason: "out-of-bounds" };
  }
  const next = cloneGameState(state);
  const keys = rectangleCells(rect).map(cellKey);
  const shouldRemove = keys.every((key) => next.excluded.has(key));
  keys.forEach((key) => shouldRemove ? next.excluded.delete(key) : next.excluded.add(key));
  next.metrics.moves += 1;
  return changedResult(next, { action: shouldRemove ? "exclude-remove" : "exclude-add", rect });
}

export function applyTool(puzzle, state, rect, tool) {
  if (tool === TOOL_TYPES.ROOM) return applyRoom(puzzle, state, rect);
  if (tool === TOOL_TYPES.CANDIDATE) return toggleCandidate(puzzle, state, rect);
  if (tool === TOOL_TYPES.EXCLUDE) return toggleExclusions(puzzle, state, rect);
  return { changed: false, state, action: "reject", reason: "unknown-tool" };
}

export function undoToSnapshot(state, snapshot, puzzle) {
  if (!isPlainObject(snapshot)
      || !Array.isArray(snapshot.rooms)
      || !Array.isArray(snapshot.candidates)
      || !Array.isArray(snapshot.excluded)
      || !puzzle) {
    return { changed: false, state, reason: "invalid-snapshot" };
  }
  const restored = deserializeState({
    version: 1,
    rooms: snapshot.rooms,
    candidates: snapshot.candidates,
    excluded: snapshot.excluded,
    metrics: state.metrics,
  }, puzzle);
  if (!restored) return { changed: false, state, reason: "invalid-snapshot" };
  const next = cloneGameState(state);
  next.rooms = restored.rooms;
  next.candidates = restored.candidates;
  next.excluded = restored.excluded;
  next.metrics.moves += 1;
  next.metrics.reworks += 1;
  next.metrics.undos += 1;
  return changedResult(next, { action: "undo" });
}

export function restartState(state) {
  const next = createGameState();
  next.metrics = { ...state.metrics };
  next.metrics.moves += 1;
  next.metrics.reworks += 1;
  next.metrics.restarts += 1;
  return next;
}

export function analyzeBoard(puzzle, state) {
  return analyzeRooms(puzzle, state?.rooms ?? []);
}

export function computeRunSummary(puzzle, state) {
  const analysis = analyzeBoard(puzzle, state);
  if (!analysis.solved) return null;
  const oneStroke = state.metrics.invalidAttempts === 0;
  const noRework = oneStroke && state.metrics.reworks === 0;
  const rating = noRework
    ? 3
    : state.metrics.invalidAttempts <= 2 && state.metrics.reworks <= 2 ? 2 : 1;
  return {
    rating,
    oneStroke,
    noRework,
    roomTypes: [...new Set(state.rooms.map(roomTypeKey))].sort(),
    rooms: state.rooms.length,
    moves: state.metrics.moves,
    invalidAttempts: state.metrics.invalidAttempts,
    reworks: state.metrics.reworks,
  };
}

export function serializeState(state) {
  return {
    version: 1,
    rooms: state.rooms.map(copyRect).sort((left, right) => rectKey(left).localeCompare(rectKey(right))),
    candidates: state.candidates.map(copyRect).sort((left, right) => rectKey(left).localeCompare(rectKey(right))),
    excluded: [...state.excluded].sort(),
    metrics: Object.fromEntries(METRIC_KEYS.map((key) => [key, state.metrics[key]])),
  };
}

export function deserializeState(raw, puzzle) {
  if (!isPlainObject(raw)
      || raw.version !== 1
      || !Array.isArray(raw.rooms)
      || !Array.isArray(raw.candidates)
      || !Array.isArray(raw.excluded)
      || !isPlainObject(raw.metrics)
      || raw.rooms.length > puzzle.clues.length
      || raw.candidates.length > puzzle.width * puzzle.height * 4
      || raw.excluded.length > puzzle.width * puzzle.height) return null;

  const rooms = raw.rooms.map(normalizeStoredRect);
  const candidates = raw.candidates.map(normalizeStoredRect);
  if (rooms.some((rect) => !rect || !rectangleInBounds(puzzle, rect))
      || candidates.some((rect) => !rect || !rectangleInBounds(puzzle, rect))) return null;
  if (new Set(rooms.map(rectKey)).size !== rooms.length
      || new Set(candidates.map(rectKey)).size !== candidates.length) return null;

  const partial = createGameState();
  for (const room of rooms) {
    const result = applyRoom(puzzle, partial, room);
    if (!result.changed || result.action !== "place") return null;
    partial.rooms = result.state.rooms;
  }

  const excluded = new Set();
  for (const key of raw.excluded) {
    let point;
    try { point = parseCellKey(key); } catch { return null; }
    if (!inBounds(puzzle, point) || excluded.has(key)) return null;
    excluded.add(key);
  }
  const metrics = {};
  for (const key of METRIC_KEYS) {
    if (!isSafeCounter(raw.metrics[key])) return null;
    metrics[key] = raw.metrics[key];
  }

  return {
    rooms: rooms.map(copyRect),
    candidates: candidates.map(copyRect),
    excluded,
    metrics,
  };
}
