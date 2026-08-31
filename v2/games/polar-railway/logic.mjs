/**
 * DOM-free Tracks rules for Polar Railway.
 *
 * Rule source: Simon Tatham's Tracks (vendor/sgtpuzzles/tracks.c).
 * A enters from the left edge and B exits through the bottom edge. A real
 * track cell has exactly two distinct orthogonal connections (including the
 * two fixed outer connections), so crossings and branches are impossible.
 * Row/column quotas count track cells, never edges.
 */

export const DIRECTIONS = Object.freeze({
  N: Object.freeze({ dx: 0, dy: -1, bit: 1, opposite: "S", label: "北" }),
  E: Object.freeze({ dx: 1, dy: 0, bit: 2, opposite: "W", label: "东" }),
  S: Object.freeze({ dx: 0, dy: 1, bit: 4, opposite: "N", label: "南" }),
  W: Object.freeze({ dx: -1, dy: 0, bit: 8, opposite: "E", label: "西" }),
});

export const DIRECTION_NAMES = Object.freeze(Object.keys(DIRECTIONS));
export const VALID_TRACK_MASKS = Object.freeze([3, 5, 6, 9, 10, 12]);

export const EDGE_STATES = Object.freeze({
  UNKNOWN: "unknown",
  TRACK: "track",
  EXCLUDED: "excluded",
});

export const CELL_STATES = Object.freeze({
  UNKNOWN: "unknown",
  CANDIDATE: "candidate",
  EXCLUDED: "excluded",
});

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "easy", label: "破雪线", short: "入门", size: "5 × 5", onTimeMs: 180_000 }),
  Object.freeze({ id: "medium", label: "冰脊线", short: "进阶", size: "6 × 6", onTimeMs: 300_000 }),
  Object.freeze({ id: "hard", label: "极夜线", short: "挑战", size: "7 × 7", onTimeMs: 480_000 }),
]);

const VALID_EDGE_STATES = new Set(Object.values(EDGE_STATES));
const VALID_CELL_STATES = new Set(Object.values(CELL_STATES));
const VALID_DIFFICULTIES = new Set(DIFFICULTIES.map(({ id }) => id));

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function popcount(mask) {
  let value = mask;
  let count = 0;
  while (value) {
    count += value & 1;
    value >>>= 1;
  }
  return count;
}

export function cellKey(point, y) {
  const x = typeof point === "object" ? Number(point?.x) : Number(point);
  const row = typeof point === "object" ? Number(point?.y) : Number(y);
  if (!Number.isInteger(x) || !Number.isInteger(row)) throw new TypeError("Cell coordinates must be integers");
  return `${x},${row}`;
}

export function parseCellKey(key) {
  if (typeof key !== "string" || !/^(?:0|[1-9]\d*),(?:0|[1-9]\d*)$/.test(key)) {
    throw new TypeError(`Invalid cell key: ${String(key)}`);
  }
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function inBounds(puzzle, point, y) {
  const x = typeof point === "object" ? point?.x : point;
  const row = typeof point === "object" ? point?.y : y;
  return Number.isInteger(x) && Number.isInteger(row)
    && x >= 0 && row >= 0 && x < puzzle?.width && row < puzzle?.height;
}

function compareCells(a, b) {
  return (a.y - b.y) || (a.x - b.x);
}

export function edgeKey(first, second) {
  if (!inBounds({ width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER }, first)
      || !inBounds({ width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER }, second)
      || Math.abs(first.x - second.x) + Math.abs(first.y - second.y) !== 1) {
    throw new RangeError("An edge must join two non-negative orthogonally adjacent cells");
  }
  const [a, b] = compareCells(first, second) <= 0 ? [first, second] : [second, first];
  return `${cellKey(a)}|${cellKey(b)}`;
}

export function parseEdgeKey(key) {
  if (typeof key !== "string") throw new TypeError("Edge key must be a string");
  const parts = key.split("|");
  if (parts.length !== 2) throw new TypeError(`Invalid edge key: ${key}`);
  const a = parseCellKey(parts[0]);
  const b = parseCellKey(parts[1]);
  const canonical = edgeKey(a, b);
  if (canonical !== key) throw new TypeError(`Edge key is not canonical: ${key}`);
  return { a, b, key };
}

export function directionBetween(from, to) {
  for (const name of DIRECTION_NAMES) {
    const direction = DIRECTIONS[name];
    if (from.x + direction.dx === to.x && from.y + direction.dy === to.y) return name;
  }
  return null;
}

export function maskForDirections(...names) {
  return names.reduce((mask, name) => mask | (DIRECTIONS[name]?.bit ?? 0), 0);
}

export function directionsForMask(mask) {
  return DIRECTION_NAMES.filter((name) => (mask & DIRECTIONS[name].bit) !== 0);
}

export function allCellKeys(puzzle) {
  const keys = [];
  for (let y = 0; y < puzzle.height; y += 1) {
    for (let x = 0; x < puzzle.width; x += 1) keys.push(cellKey(x, y));
  }
  return keys;
}

export function allEdgeKeys(puzzle) {
  const keys = [];
  for (let y = 0; y < puzzle.height; y += 1) {
    for (let x = 0; x < puzzle.width; x += 1) {
      if (x + 1 < puzzle.width) keys.push(edgeKey({ x, y }, { x: x + 1, y }));
      if (y + 1 < puzzle.height) keys.push(edgeKey({ x, y }, { x, y: y + 1 }));
    }
  }
  return keys;
}

function givenMap(puzzle) {
  return new Map((puzzle.givens ?? []).map((given) => [cellKey(given), given.mask]));
}

export function endpointFor(puzzle, kind) {
  if (kind === "entry") return { x: 0, y: puzzle.entryRow, outside: "W" };
  if (kind === "exit") return { x: puzzle.exitColumn, y: puzzle.height - 1, outside: "S" };
  throw new TypeError("Endpoint kind must be entry or exit");
}

export function getPuzzleErrors(puzzle) {
  const errors = [];
  if (!isPlainObject(puzzle)) return ["puzzle must be a plain object"];
  if (typeof puzzle.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(puzzle.id)) {
    errors.push("id must be a URL-safe string");
  }
  if (!VALID_DIFFICULTIES.has(puzzle.difficulty)) errors.push("difficulty is invalid");
  if (!Number.isInteger(puzzle.width) || puzzle.width < 4 || puzzle.width > 12) errors.push("width must be 4..12");
  if (!Number.isInteger(puzzle.height) || puzzle.height < 4 || puzzle.height > 12) errors.push("height must be 4..12");

  const dimensionsValid = Number.isInteger(puzzle.width) && Number.isInteger(puzzle.height)
    && puzzle.width >= 4 && puzzle.height >= 4;
  if (!Number.isInteger(puzzle.entryRow) || (dimensionsValid && (puzzle.entryRow < 0 || puzzle.entryRow >= puzzle.height))) {
    errors.push("entryRow must identify one left-edge row");
  }
  if (!Number.isInteger(puzzle.exitColumn) || (dimensionsValid && (puzzle.exitColumn < 0 || puzzle.exitColumn >= puzzle.width))) {
    errors.push("exitColumn must identify one bottom-edge column");
  }
  if (!Array.isArray(puzzle.rowClues) || (dimensionsValid && puzzle.rowClues.length !== puzzle.height)
      || puzzle.rowClues?.some((value) => !Number.isInteger(value) || value < 0 || (dimensionsValid && value > puzzle.width))) {
    errors.push("rowClues must contain one bounded integer per row");
  }
  if (!Array.isArray(puzzle.columnClues) || (dimensionsValid && puzzle.columnClues.length !== puzzle.width)
      || puzzle.columnClues?.some((value) => !Number.isInteger(value) || value < 0 || (dimensionsValid && value > puzzle.height))) {
    errors.push("columnClues must contain one bounded integer per column");
  }
  if (Array.isArray(puzzle.rowClues) && Array.isArray(puzzle.columnClues)
      && puzzle.rowClues.every(Number.isInteger) && puzzle.columnClues.every(Number.isInteger)
      && puzzle.rowClues.reduce((sum, value) => sum + value, 0)
        !== puzzle.columnClues.reduce((sum, value) => sum + value, 0)) {
    errors.push("row and column clue totals must match");
  }
  if (!Array.isArray(puzzle.givens) || puzzle.givens.length < 2) {
    errors.push("givens must include the fixed entry and exit pieces");
  } else if (dimensionsValid) {
    const seen = new Set();
    const map = new Map();
    for (const [index, given] of puzzle.givens.entries()) {
      if (!isPlainObject(given) || !Number.isInteger(given.x) || !Number.isInteger(given.y)
          || !Number.isInteger(given.mask) || !VALID_TRACK_MASKS.includes(given.mask)) {
        errors.push(`given ${index} is malformed`);
        continue;
      }
      const key = cellKey(given);
      if (!inBounds(puzzle, given)) errors.push(`given ${index} is out of bounds`);
      if (seen.has(key)) errors.push(`duplicate given at ${key}`);
      seen.add(key);
      map.set(key, given.mask);
      for (const name of directionsForMask(given.mask)) {
        const direction = DIRECTIONS[name];
        const neighbor = { x: given.x + direction.dx, y: given.y + direction.dy };
        if (inBounds(puzzle, neighbor)) continue;
        const isEntry = given.x === 0 && given.y === puzzle.entryRow && name === "W";
        const isExit = given.x === puzzle.exitColumn && given.y === puzzle.height - 1 && name === "S";
        if (!isEntry && !isExit) errors.push(`given ${index} has an illegal outer connection`);
      }
    }
    const entryMask = map.get(cellKey(0, puzzle.entryRow));
    const exitMask = map.get(cellKey(puzzle.exitColumn, puzzle.height - 1));
    if (!entryMask || !(entryMask & DIRECTIONS.W.bit)) errors.push("entry must be a fixed piece connected west to A");
    if (!exitMask || !(exitMask & DIRECTIONS.S.bit)) errors.push("exit must be a fixed piece connected south to B");

    for (const given of puzzle.givens.filter((item) => isPlainObject(item) && inBounds(puzzle, item))) {
      for (const name of DIRECTION_NAMES) {
        const direction = DIRECTIONS[name];
        const neighbor = { x: given.x + direction.dx, y: given.y + direction.dy };
        if (!inBounds(puzzle, neighbor)) continue;
        const otherMask = map.get(cellKey(neighbor));
        if (otherMask === undefined) continue;
        const connectedHere = Boolean(given.mask & direction.bit);
        const connectedThere = Boolean(otherMask & DIRECTIONS[direction.opposite].bit);
        if (connectedHere !== connectedThere) errors.push(`adjacent givens disagree at ${cellKey(given)} and ${cellKey(neighbor)}`);
      }
    }
  }
  if (typeof puzzle.title !== "string" || !puzzle.title.trim()) errors.push("title is required");
  if (!Number.isInteger(puzzle.seed) || puzzle.seed < 0) errors.push("seed must be a non-negative integer");
  if (!Number.isInteger(puzzle.parMoves) || puzzle.parMoves < 1) errors.push("parMoves must be a positive integer");
  return [...new Set(errors)];
}

export function validatePuzzle(puzzle) {
  return getPuzzleErrors(puzzle).length === 0;
}

export function assertValidPuzzle(puzzle) {
  const errors = getPuzzleErrors(puzzle);
  if (errors.length) throw new TypeError(`Invalid Tracks puzzle: ${errors.join("; ")}`);
  return puzzle;
}

export function fixedTrackEdges(puzzle) {
  const edges = new Set();
  for (const given of puzzle.givens) {
    for (const name of directionsForMask(given.mask)) {
      const direction = DIRECTIONS[name];
      const neighbor = { x: given.x + direction.dx, y: given.y + direction.dy };
      if (inBounds(puzzle, neighbor)) edges.add(edgeKey(given, neighbor));
    }
  }
  return edges;
}

export function isEdgeCompatibleWithGivens(puzzle, key) {
  let parsed;
  try {
    parsed = parseEdgeKey(key);
  } catch {
    return false;
  }
  if (!inBounds(puzzle, parsed.a) || !inBounds(puzzle, parsed.b)) return false;
  const map = givenMap(puzzle);
  const direction = directionBetween(parsed.a, parsed.b);
  const opposite = DIRECTIONS[direction].opposite;
  const firstMask = map.get(cellKey(parsed.a));
  const secondMask = map.get(cellKey(parsed.b));
  if (firstMask !== undefined && !(firstMask & DIRECTIONS[direction].bit)) return false;
  if (secondMask !== undefined && !(secondMask & DIRECTIONS[opposite].bit)) return false;
  return true;
}

export function createBoardState(puzzle) {
  assertValidPuzzle(puzzle);
  return {
    puzzleId: puzzle.id,
    tracks: fixedTrackEdges(puzzle),
    edgeExclusions: new Set(),
    candidates: new Set(),
    cellExclusions: new Set(),
    moves: 0,
    rework: 0,
  };
}

export function cloneBoardState(state) {
  return {
    puzzleId: state.puzzleId,
    tracks: new Set(state.tracks),
    edgeExclusions: new Set(state.edgeExclusions),
    candidates: new Set(state.candidates),
    cellExclusions: new Set(state.cellExclusions),
    moves: state.moves,
    rework: state.rework,
  };
}

export function directionsAt(puzzle, stateOrTracks, point) {
  const tracks = stateOrTracks instanceof Set ? stateOrTracks : stateOrTracks.tracks;
  let mask = 0;
  for (const name of DIRECTION_NAMES) {
    const direction = DIRECTIONS[name];
    const neighbor = { x: point.x + direction.dx, y: point.y + direction.dy };
    if (inBounds(puzzle, neighbor) && tracks.has(edgeKey(point, neighbor))) mask |= direction.bit;
  }
  if (point.x === 0 && point.y === puzzle.entryRow) mask |= DIRECTIONS.W.bit;
  if (point.x === puzzle.exitColumn && point.y === puzzle.height - 1) mask |= DIRECTIONS.S.bit;
  return mask;
}

export function degreeAt(puzzle, stateOrTracks, point) {
  return popcount(directionsAt(puzzle, stateOrTracks, point));
}

function validStateSets(puzzle, state) {
  if (!isPlainObject(state) || state.puzzleId !== puzzle.id
      || !(state.tracks instanceof Set) || !(state.edgeExclusions instanceof Set)
      || !(state.candidates instanceof Set) || !(state.cellExclusions instanceof Set)
      || !Number.isSafeInteger(state.moves) || state.moves < 0 || state.moves > 10_000_000
      || !Number.isSafeInteger(state.rework) || state.rework < 0 || state.rework > 10_000_000) return false;
  const edgeKeys = new Set(allEdgeKeys(puzzle));
  const cellKeys = new Set(allCellKeys(puzzle));
  const fixed = fixedTrackEdges(puzzle);
  if ([...state.tracks].some((key) => !edgeKeys.has(key))
      || [...state.edgeExclusions].some((key) => !edgeKeys.has(key))
      || [...state.candidates].some((key) => !cellKeys.has(key))
      || [...state.cellExclusions].some((key) => !cellKeys.has(key))) return false;
  if ([...fixed].some((key) => !state.tracks.has(key))) return false;
  if ([...state.tracks].some((key) => state.edgeExclusions.has(key) || !isEdgeCompatibleWithGivens(puzzle, key))) return false;
  if ([...state.candidates].some((key) => state.cellExclusions.has(key))) return false;
  const givens = givenMap(puzzle);
  if ([...state.candidates, ...state.cellExclusions].some((key) => givens.has(key))) return false;
  if ([...state.cellExclusions].some((key) => degreeAt(puzzle, state, parseCellKey(key)) > 0)) return false;
  if (allCellKeys(puzzle).some((key) => degreeAt(puzzle, state, parseCellKey(key)) > 2)) return false;
  return true;
}

export function validateBoardState(puzzle, state) {
  return validStateSets(puzzle, state);
}

function actionResult(state, changed, reason = null, previous = null) {
  return { state, changed, reason, previous };
}

export function setEdgeState(puzzle, state, rawKey, nextState) {
  if (!VALID_EDGE_STATES.has(nextState)) return actionResult(state, false, "invalid-state");
  let key;
  try {
    key = parseEdgeKey(rawKey).key;
  } catch {
    return actionResult(state, false, "invalid-edge");
  }
  const validEdges = new Set(allEdgeKeys(puzzle));
  if (!validEdges.has(key)) return actionResult(state, false, "out-of-bounds");
  const fixed = fixedTrackEdges(puzzle);
  const previous = state.tracks.has(key) ? EDGE_STATES.TRACK
    : state.edgeExclusions.has(key) ? EDGE_STATES.EXCLUDED : EDGE_STATES.UNKNOWN;
  if (previous === nextState) return actionResult(state, false, "unchanged", previous);
  if (fixed.has(key) && nextState !== EDGE_STATES.TRACK) return actionResult(state, false, "fixed-track", previous);
  if (nextState === EDGE_STATES.TRACK) {
    if (!isEdgeCompatibleWithGivens(puzzle, key)) return actionResult(state, false, "fixed-shape", previous);
    const { a, b } = parseEdgeKey(key);
    if (state.cellExclusions.has(cellKey(a)) || state.cellExclusions.has(cellKey(b))) {
      return actionResult(state, false, "excluded-cell", previous);
    }
    if (degreeAt(puzzle, state, a) >= 2 || degreeAt(puzzle, state, b) >= 2) {
      return actionResult(state, false, "degree-limit", previous);
    }
  }
  if (nextState === EDGE_STATES.EXCLUDED && previous === EDGE_STATES.TRACK) {
    // The explicit exclusion tool first removes a non-fixed track. A second
    // action may add the X, matching the upstream absolute-key behaviour.
    nextState = EDGE_STATES.UNKNOWN;
  }
  const next = cloneBoardState(state);
  next.tracks.delete(key);
  next.edgeExclusions.delete(key);
  if (nextState === EDGE_STATES.TRACK) next.tracks.add(key);
  if (nextState === EDGE_STATES.EXCLUDED) next.edgeExclusions.add(key);
  next.moves += 1;
  if (previous === EDGE_STATES.TRACK && nextState !== EDGE_STATES.TRACK) next.rework += 1;
  return actionResult(next, true, null, previous);
}

export function toggleEdge(puzzle, state, rawKey, tool = EDGE_STATES.TRACK) {
  let key;
  try {
    key = parseEdgeKey(rawKey).key;
  } catch {
    return actionResult(state, false, "invalid-edge");
  }
  if (tool === EDGE_STATES.TRACK) {
    return setEdgeState(puzzle, state, key, state.tracks.has(key) ? EDGE_STATES.UNKNOWN : EDGE_STATES.TRACK);
  }
  if (tool === EDGE_STATES.EXCLUDED) {
    return setEdgeState(puzzle, state, key,
      state.edgeExclusions.has(key) ? EDGE_STATES.UNKNOWN : EDGE_STATES.EXCLUDED);
  }
  return actionResult(state, false, "invalid-tool");
}

export function setCellState(puzzle, state, rawKey, nextState) {
  if (!VALID_CELL_STATES.has(nextState)) return actionResult(state, false, "invalid-state");
  let key;
  try {
    key = parseCellKey(rawKey) && rawKey;
  } catch {
    return actionResult(state, false, "invalid-cell");
  }
  const point = parseCellKey(key);
  if (!inBounds(puzzle, point)) return actionResult(state, false, "out-of-bounds");
  if (givenMap(puzzle).has(key)) return actionResult(state, false, "fixed-track");
  const previous = state.candidates.has(key) ? CELL_STATES.CANDIDATE
    : state.cellExclusions.has(key) ? CELL_STATES.EXCLUDED : CELL_STATES.UNKNOWN;
  if (previous === nextState) return actionResult(state, false, "unchanged", previous);
  if (nextState === CELL_STATES.EXCLUDED && degreeAt(puzzle, state, point) > 0) {
    return actionResult(state, false, "connected-cell", previous);
  }
  const next = cloneBoardState(state);
  next.candidates.delete(key);
  next.cellExclusions.delete(key);
  if (nextState === CELL_STATES.CANDIDATE) next.candidates.add(key);
  if (nextState === CELL_STATES.EXCLUDED) next.cellExclusions.add(key);
  next.moves += 1;
  if (previous === CELL_STATES.CANDIDATE && nextState !== CELL_STATES.CANDIDATE) next.rework += 1;
  return actionResult(next, true, null, previous);
}

export function toggleCell(puzzle, state, rawKey, tool = CELL_STATES.CANDIDATE) {
  let key;
  try {
    key = cellKey(parseCellKey(rawKey));
  } catch {
    return actionResult(state, false, "invalid-cell");
  }
  if (tool === CELL_STATES.CANDIDATE) {
    return setCellState(puzzle, state, key,
      state.candidates.has(key) ? CELL_STATES.UNKNOWN : CELL_STATES.CANDIDATE);
  }
  if (tool === CELL_STATES.EXCLUDED) {
    return setCellState(puzzle, state, key,
      state.cellExclusions.has(key) ? CELL_STATES.UNKNOWN : CELL_STATES.EXCLUDED);
  }
  return actionResult(state, false, "invalid-tool");
}

function graphInfo(puzzle, tracks) {
  const adjacency = new Map();
  for (const key of tracks) {
    const { a, b } = parseEdgeKey(key);
    const first = cellKey(a);
    const second = cellKey(b);
    if (!adjacency.has(first)) adjacency.set(first, new Set());
    if (!adjacency.has(second)) adjacency.set(second, new Set());
    adjacency.get(first).add(second);
    adjacency.get(second).add(first);
  }
  const components = [];
  const visited = new Set();
  let hasCycle = false;
  function walk(key, parent, component) {
    visited.add(key);
    component.add(key);
    for (const neighbor of adjacency.get(key) ?? []) {
      if (!visited.has(neighbor)) walk(neighbor, key, component);
      else if (neighbor !== parent) hasCycle = true;
    }
  }
  for (const key of adjacency.keys()) {
    if (visited.has(key)) continue;
    const component = new Set();
    walk(key, null, component);
    components.push(component);
  }
  return { adjacency, components, hasCycle };
}

export function traceRoute(puzzle, tracks) {
  const start = cellKey(0, puzzle.entryRow);
  const end = cellKey(puzzle.exitColumn, puzzle.height - 1);
  const { adjacency } = graphInfo(puzzle, tracks);
  const route = [];
  const seen = new Set();
  let previous = null;
  let current = start;
  while (current && !seen.has(current)) {
    route.push(parseCellKey(current));
    seen.add(current);
    if (current === end) return route;
    const next = [...(adjacency.get(current) ?? [])].find((key) => key !== previous);
    previous = current;
    current = next ?? null;
  }
  return [];
}

export function analyzeBoard(puzzle, state) {
  const rowPossible = Array(puzzle.height).fill(0);
  const rowComplete = Array(puzzle.height).fill(0);
  const rowExcluded = Array(puzzle.height).fill(0);
  const columnPossible = Array(puzzle.width).fill(0);
  const columnComplete = Array(puzzle.width).fill(0);
  const columnExcluded = Array(puzzle.width).fill(0);
  const cellResults = new Map();
  const conflicts = [];
  const map = givenMap(puzzle);

  for (let y = 0; y < puzzle.height; y += 1) {
    for (let x = 0; x < puzzle.width; x += 1) {
      const key = cellKey(x, y);
      const point = { x, y };
      const mask = directionsAt(puzzle, state, point);
      const degree = popcount(mask);
      const possible = degree > 0 || state.candidates.has(key);
      const complete = degree === 2;
      const excluded = state.cellExclusions.has(key);
      if (possible) {
        rowPossible[y] += 1;
        columnPossible[x] += 1;
      }
      if (complete) {
        rowComplete[y] += 1;
        columnComplete[x] += 1;
      }
      if (excluded) {
        rowExcluded[y] += 1;
        columnExcluded[x] += 1;
      }
      const givenMask = map.get(key);
      const reasons = [];
      if (degree > 2) reasons.push(degree === 4 ? "crossing" : "branch");
      if (excluded && degree > 0) reasons.push("track-on-excluded-cell");
      if (givenMask !== undefined && mask !== givenMask) reasons.push("given-shape");
      for (const reason of reasons) conflicts.push({ type: "cell", key, reason });
      cellResults.set(key, { key, x, y, mask, degree, possible, complete, excluded, given: givenMask !== undefined, reasons });
    }
  }

  const graph = graphInfo(puzzle, state.tracks);
  if (graph.hasCycle) conflicts.push({ type: "network", key: "cycle", reason: "cycle" });
  const startKey = cellKey(0, puzzle.entryRow);
  const endKey = cellKey(puzzle.exitColumn, puzzle.height - 1);
  const mainComponent = graph.components.find((component) => component.has(startKey));
  const connected = Boolean(mainComponent?.has(endKey));
  if (connected) {
    for (const component of graph.components) {
      if (component !== mainComponent && component.size > 0) {
        conflicts.push({ type: "network", key: [...component][0], reason: "stray-track" });
      }
    }
    for (const key of state.candidates) {
      if (!mainComponent.has(key)) conflicts.push({ type: "cell", key, reason: "stray-candidate" });
    }
  }

  const rowStatus = puzzle.rowClues.map((target, index) => {
    const over = rowPossible[index] > target || rowExcluded[index] > puzzle.width - target;
    const exact = rowComplete[index] === target;
    if (over || (connected && !exact)) conflicts.push({ type: "row", key: String(index), reason: over ? "quota-over" : "quota-mismatch" });
    return { target, possible: rowPossible[index], complete: rowComplete[index], excluded: rowExcluded[index], over, exact };
  });
  const columnStatus = puzzle.columnClues.map((target, index) => {
    const over = columnPossible[index] > target || columnExcluded[index] > puzzle.height - target;
    const exact = columnComplete[index] === target;
    if (over || (connected && !exact)) conflicts.push({ type: "column", key: String(index), reason: over ? "quota-over" : "quota-mismatch" });
    return { target, possible: columnPossible[index], complete: columnComplete[index], excluded: columnExcluded[index], over, exact };
  });

  const allTrackCellsComplete = [...cellResults.values()].every(({ degree }) => degree === 0 || degree === 2);
  const givensExact = [...cellResults.values()].filter(({ given }) => given).every(({ reasons }) => !reasons.includes("given-shape"));
  const solved = connected && !graph.hasCycle && allTrackCellsComplete && givensExact
    && graph.components.length === 1
    && rowStatus.every(({ exact, over }) => exact && !over)
    && columnStatus.every(({ exact, over }) => exact && !over)
    && conflicts.length === 0;
  return {
    solved,
    connected,
    hasCycle: graph.hasCycle,
    allTrackCellsComplete,
    givensExact,
    conflicts,
    rowStatus,
    columnStatus,
    cellResults,
    components: graph.components,
    route: solved ? traceRoute(puzzle, state.tracks) : [],
    completeCells: rowComplete.reduce((sum, value) => sum + value, 0),
    targetCells: puzzle.rowClues.reduce((sum, value) => sum + value, 0),
  };
}

export function isSolved(puzzle, state) {
  return analyzeBoard(puzzle, state).solved;
}

/**
 * Enumerate simple A-to-B paths. `truncated` is true whenever the requested
 * limit stopped the search; therefore count=1 is unique only when truncated
 * is false.
 */
export function countSolutions(puzzle, limit = 2) {
  assertValidPuzzle(puzzle);
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit must be a positive integer");
  const requiredLength = puzzle.rowClues.reduce((sum, value) => sum + value, 0);
  const rows = Array(puzzle.height).fill(0);
  const columns = Array(puzzle.width).fill(0);
  const visited = new Set();
  const path = [];
  const solutions = [];
  const map = givenMap(puzzle);
  const givenKeys = new Set(map.keys());
  let halted = false;
  let nodes = 0;

  function quotasRemainFeasible() {
    for (let y = 0; y < puzzle.height; y += 1) {
      if (rows[y] > puzzle.rowClues[y]) return false;
      let available = 0;
      for (let x = 0; x < puzzle.width; x += 1) if (!visited.has(cellKey(x, y))) available += 1;
      if (rows[y] + available < puzzle.rowClues[y]) return false;
    }
    for (let x = 0; x < puzzle.width; x += 1) {
      if (columns[x] > puzzle.columnClues[x]) return false;
      let available = 0;
      for (let y = 0; y < puzzle.height; y += 1) if (!visited.has(cellKey(x, y))) available += 1;
      if (columns[x] + available < puzzle.columnClues[x]) return false;
    }
    return true;
  }

  function recordSolution() {
    solutions.push(path.map(({ x, y }) => ({ x, y })));
    if (solutions.length >= limit) halted = true;
  }

  function search(current, incomingSide) {
    if (halted) return;
    nodes += 1;
    const key = cellKey(current);
    visited.add(key);
    path.push(current);
    rows[current.y] += 1;
    columns[current.x] += 1;

    const remainingCells = requiredLength - path.length;
    const exit = { x: puzzle.exitColumn, y: puzzle.height - 1 };
    const distance = Math.abs(current.x - exit.x) + Math.abs(current.y - exit.y);
    const unvisitedGivenCount = [...givenKeys].filter((givenKey) => !visited.has(givenKey)).length;
    let feasible = path.length <= requiredLength && quotasRemainFeasible()
      && distance <= remainingCells && ((remainingCells - distance) % 2 === 0)
      && unvisitedGivenCount <= remainingCells;

    const givenMask = map.get(key);
    if (givenMask !== undefined && !(givenMask & DIRECTIONS[incomingSide].bit)) feasible = false;

    if (feasible) {
      const possibleDirections = current.x === exit.x && current.y === exit.y
        ? ["S"] : DIRECTION_NAMES;
      for (const nextDirection of possibleDirections) {
        if (halted) break;
        if (nextDirection === incomingSide) continue;
        const pairMask = DIRECTIONS[incomingSide].bit | DIRECTIONS[nextDirection].bit;
        if (!VALID_TRACK_MASKS.includes(pairMask)) continue;
        if (givenMask !== undefined && pairMask !== givenMask) continue;

        if (nextDirection === "S" && current.x === exit.x && current.y === exit.y) {
          if (path.length === requiredLength && [...givenKeys].every((givenKey) => visited.has(givenKey))
              && rows.every((value, index) => value === puzzle.rowClues[index])
              && columns.every((value, index) => value === puzzle.columnClues[index])) recordSolution();
          continue;
        }
        const direction = DIRECTIONS[nextDirection];
        const next = { x: current.x + direction.dx, y: current.y + direction.dy };
        if (!inBounds(puzzle, next) || visited.has(cellKey(next))) continue;
        const nextGivenMask = map.get(cellKey(next));
        if (nextGivenMask !== undefined && !(nextGivenMask & DIRECTIONS[direction.opposite].bit)) continue;
        search(next, direction.opposite);
      }
    }

    rows[current.y] -= 1;
    columns[current.x] -= 1;
    path.pop();
    visited.delete(key);
  }

  search({ x: 0, y: puzzle.entryRow }, "W");
  return { count: solutions.length, solutions, truncated: halted, nodes };
}

function maskForPathCell(path, index, height) {
  const current = path[index];
  const incoming = index === 0 ? "W" : directionBetween(current, path[index - 1]);
  const outgoing = index === path.length - 1
    ? (current.y === height - 1 ? "S" : null)
    : directionBetween(current, path[index + 1]);
  if (!incoming || !outgoing) throw new TypeError("Path endpoints must enter west and exit south");
  return maskForDirections(incoming, outgoing);
}

export function puzzleFromPath({ id, title, difficulty, width, height, seed, path, givenIndices, parMoves }) {
  if (!Array.isArray(path) || path.length < 2) throw new TypeError("path is required");
  const normalizedPath = path.map((point) => Array.isArray(point)
    ? { x: Number(point[0]), y: Number(point[1]) }
    : { x: Number(point?.x), y: Number(point?.y) });
  const seen = new Set();
  for (const [index, point] of normalizedPath.entries()) {
    if (!inBounds({ width, height }, point)) throw new RangeError(`path cell ${index} is out of bounds`);
    const key = cellKey(point);
    if (seen.has(key)) throw new TypeError(`path repeats ${key}`);
    seen.add(key);
    if (index > 0 && !directionBetween(normalizedPath[index - 1], point)) throw new TypeError("path must move orthogonally");
  }
  if (normalizedPath[0].x !== 0) throw new TypeError("path must enter from the left edge");
  if (normalizedPath.at(-1).y !== height - 1) throw new TypeError("path must exit through the bottom edge");
  const rowClues = Array(height).fill(0);
  const columnClues = Array(width).fill(0);
  for (const { x, y } of normalizedPath) {
    rowClues[y] += 1;
    columnClues[x] += 1;
  }
  const indexes = [...new Set([0, normalizedPath.length - 1, ...(givenIndices ?? [])])].sort((a, b) => a - b);
  const givens = indexes.map((index) => ({
    ...normalizedPath[index],
    mask: maskForPathCell(normalizedPath, index, height),
  }));
  return assertValidPuzzle(Object.freeze({
    id,
    title,
    difficulty,
    width,
    height,
    seed,
    entryRow: normalizedPath[0].y,
    exitColumn: normalizedPath.at(-1).x,
    rowClues: Object.freeze(rowClues),
    columnClues: Object.freeze(columnClues),
    givens: Object.freeze(givens.map(Object.freeze)),
    parMoves,
  }));
}

const RAW_LEVELS = [
  {
    id: "whiteout-5a", title: "雪原初发", difficulty: "easy", width: 5, height: 5, seed: 501, parMoves: 28,
    path: [[0,0],[0,1],[1,1],[1,0],[2,0],[2,1],[2,2],[2,3],[2,4],[3,4],[3,3],[3,2],[3,1],[4,1],[4,2],[4,3],[4,4]],
    givenIndices: [4, 8, 12],
  },
  {
    id: "whiteout-5b", title: "风湾折返", difficulty: "easy", width: 5, height: 5, seed: 512, parMoves: 32,
    path: [[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],[3,3],[3,2],[3,1],[2,1],[2,2],[2,3],[2,4],[3,4]],
    givenIndices: [4, 8, 12, 16],
  },
  {
    id: "ridge-6a", title: "冰脊会车", difficulty: "medium", width: 6, height: 6, seed: 601, parMoves: 42,
    path: [[0,1],[0,0],[1,0],[1,1],[1,2],[0,2],[0,3],[1,3],[2,3],[3,3],[4,3],[4,2],[4,1],[5,1],[5,2],[5,3],[5,4],[4,4],[3,4],[2,4],[2,5],[3,5],[4,5]],
    givenIndices: [4, 8, 12, 16, 20],
  },
  {
    id: "ridge-6b", title: "冻原长坡", difficulty: "medium", width: 6, height: 6, seed: 612, parMoves: 46,
    path: [[0,2],[1,2],[1,3],[0,3],[0,4],[0,5],[1,5],[1,4],[2,4],[2,3],[2,2],[3,2],[3,3],[3,4],[4,4],[4,3],[4,2],[4,1],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[5,5]],
    givenIndices: [5, 10, 15, 20],
  },
  {
    id: "polar-night-7a", title: "极光总站", difficulty: "hard", width: 7, height: 7, seed: 701, parMoves: 58,
    path: [[0,1],[0,2],[0,3],[1,3],[2,3],[3,3],[3,2],[2,2],[1,2],[1,1],[1,0],[2,0],[2,1],[3,1],[3,0],[4,0],[5,0],[6,0],[6,1],[5,1],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[2,5],[3,5],[4,5],[4,6],[5,6]],
    givenIndices: [6, 12, 18, 24],
  },
  {
    id: "polar-night-7b", title: "极夜终班", difficulty: "hard", width: 7, height: 7, seed: 712, parMoves: 62,
    path: [[0,4],[0,5],[0,6],[1,6],[2,6],[2,5],[2,4],[2,3],[1,3],[0,3],[0,2],[1,2],[1,1],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[6,1],[5,1],[4,1],[4,2],[5,2],[5,3],[4,3],[3,3],[3,4],[4,4],[5,4],[6,4],[6,5],[6,6]],
    givenIndices: [6, 12, 18, 24, 30],
  },
];

export const LEVELS = Object.freeze(RAW_LEVELS.map((definition) => puzzleFromPath(definition)));

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function findLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function serializeBoardState(state) {
  return {
    version: 1,
    puzzleId: state.puzzleId,
    tracks: [...state.tracks].sort(),
    edgeExclusions: [...state.edgeExclusions].sort(),
    candidates: [...state.candidates].sort(),
    cellExclusions: [...state.cellExclusions].sort(),
    moves: state.moves,
    rework: state.rework,
  };
}

export function deserializeBoardState(value, puzzle) {
  if (!isPlainObject(value) || value.version !== 1 || value.puzzleId !== puzzle.id
      || !Array.isArray(value.tracks) || !Array.isArray(value.edgeExclusions)
      || !Array.isArray(value.candidates) || !Array.isArray(value.cellExclusions)
      || !Number.isSafeInteger(value.moves) || value.moves < 0 || value.moves > 10_000_000
      || !Number.isSafeInteger(value.rework) || value.rework < 0 || value.rework > 10_000_000) return null;
  if ([value.tracks, value.edgeExclusions, value.candidates, value.cellExclusions]
    .some((items) => items.length > puzzle.width * puzzle.height * 2 || items.some((item) => typeof item !== "string"))) return null;
  const state = {
    puzzleId: value.puzzleId,
    tracks: new Set(value.tracks),
    edgeExclusions: new Set(value.edgeExclusions),
    candidates: new Set(value.candidates),
    cellExclusions: new Set(value.cellExclusions),
    moves: value.moves,
    rework: value.rework,
  };
  return validateBoardState(puzzle, state) ? state : null;
}

export function createRecords() {
  return {
    completed: {},
    bestMoves: {},
    bestTimes: {},
    awards: {},
    completionLedger: {},
    selectedEngine: "copper",
    selectedCarriage: "supply",
  };
}

const ENGINE_IDS = new Set(["copper", "aurora", "midnight"]);
const CARRIAGE_IDS = new Set(["supply", "mail", "observatory"]);
const LEVEL_IDS = new Set(LEVELS.map(({ id }) => id));
const AWARD_IDS = new Set([
  ...LEVELS.flatMap(({ id }) => [`atlas:${id}`, `zero-rework:${id}`]),
  ...DIFFICULTIES.map(({ id }) => `on-time:${id}`),
  "engine:aurora",
  "engine:midnight",
  "carriage:mail",
  "carriage:observatory",
]);

function isIsoTimestamp(value) {
  if (typeof value !== "string" || value.length !== 24) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function normalizeRecords(value) {
  const fallback = createRecords();
  if (!isPlainObject(value)) return fallback;
  const cleanObject = (candidate, predicate, { keepLatest = false } = {}) => {
    if (!isPlainObject(candidate)) return {};
    const valid = Object.entries(candidate).filter(([key, item]) =>
      typeof key === "string" && key.length <= 160 && predicate(item, key));
    return Object.fromEntries(keepLatest ? valid.slice(-500) : valid.slice(0, 500));
  };
  const awards = cleanObject(value.awards, (item, key) => AWARD_IDS.has(key) && isIsoTimestamp(item));
  const requestedEngine = ENGINE_IDS.has(value.selectedEngine) ? value.selectedEngine : fallback.selectedEngine;
  const requestedCarriage = CARRIAGE_IDS.has(value.selectedCarriage) ? value.selectedCarriage : fallback.selectedCarriage;
  const selectedEngine = requestedEngine === "copper" || awards[`engine:${requestedEngine}`]
    ? requestedEngine : fallback.selectedEngine;
  const selectedCarriage = requestedCarriage === "supply" || awards[`carriage:${requestedCarriage}`]
    ? requestedCarriage : fallback.selectedCarriage;
  return {
    completed: cleanObject(value.completed, (item, key) => LEVEL_IDS.has(key) && Number.isSafeInteger(item) && item > 0),
    bestMoves: cleanObject(value.bestMoves, (item, key) => LEVEL_IDS.has(key) && Number.isSafeInteger(item) && item >= 0),
    bestTimes: cleanObject(value.bestTimes, (item, key) => LEVEL_IDS.has(key) && Number.isSafeInteger(item) && item >= 0),
    awards,
    completionLedger: cleanObject(value.completionLedger, (item) => item === true, { keepLatest: true }),
    selectedEngine,
    selectedCarriage,
  };
}

function award(records, id, label, earnedAt, unlocked) {
  if (records.awards[id]) return null;
  records.awards[id] = earnedAt;
  return { id, label, unlocked };
}

export function recordCompletion(recordsInput, summary) {
  const records = normalizeRecords(recordsInput);
  const level = isPlainObject(summary) ? findLevel(summary.puzzleId) : null;
  if (!isPlainObject(summary) || typeof summary.completionId !== "string" || summary.completionId.length < 1 || summary.completionId.length > 160
      || !level || summary.difficulty !== level.difficulty
      || !Number.isSafeInteger(summary.moves) || summary.moves < 0
      || !Number.isSafeInteger(summary.elapsedMs) || summary.elapsedMs < 0
      || typeof summary.zeroRework !== "boolean" || typeof summary.onTime !== "boolean") {
    return { records, awards: [], duplicate: false, invalid: true };
  }
  if (records.completionLedger[summary.completionId]) return { records, awards: [], duplicate: true, invalid: false };
  const earnedAt = isIsoTimestamp(summary.completedAt) ? summary.completedAt : new Date(0).toISOString();
  records.completionLedger[summary.completionId] = true;
  records.completed[summary.puzzleId] = (records.completed[summary.puzzleId] ?? 0) + 1;
  records.bestMoves[summary.puzzleId] = Math.min(records.bestMoves[summary.puzzleId] ?? Number.MAX_SAFE_INTEGER, summary.moves);
  records.bestTimes[summary.puzzleId] = Math.min(records.bestTimes[summary.puzzleId] ?? Number.MAX_SAFE_INTEGER, summary.elapsedMs);
  const awards = [];
  const atlas = award(records, `atlas:${summary.puzzleId}`, `线路图鉴 · ${findLevel(summary.puzzleId).title}`, earnedAt, "route");
  if (atlas) awards.push(atlas);
  if (summary.zeroRework) {
    const zero = award(records, `zero-rework:${summary.puzzleId}`, "零返工铺轨", earnedAt, "badge");
    if (zero) awards.push(zero);
  }
  if (summary.onTime) {
    const punctual = award(records, `on-time:${summary.difficulty}`, `准点徽章 · ${summary.difficulty}`, earnedAt, "badge");
    if (punctual) awards.push(punctual);
  }
  const atlasCount = Object.keys(records.awards).filter((id) => id.startsWith("atlas:")).length;
  const zeroCount = Object.keys(records.awards).filter((id) => id.startsWith("zero-rework:")).length;
  if (atlasCount >= 2) {
    const cosmetic = award(records, "engine:aurora", "极光车头", earnedAt, "engine");
    if (cosmetic) awards.push(cosmetic);
  }
  if (atlasCount >= 5) {
    const cosmetic = award(records, "engine:midnight", "极夜车头", earnedAt, "engine");
    if (cosmetic) awards.push(cosmetic);
  }
  if (zeroCount >= 1) {
    const cosmetic = award(records, "carriage:mail", "雪原邮车", earnedAt, "carriage");
    if (cosmetic) awards.push(cosmetic);
  }
  if (atlasCount >= LEVELS.length) {
    const cosmetic = award(records, "carriage:observatory", "极光观景车", earnedAt, "carriage");
    if (cosmetic) awards.push(cosmetic);
  }
  return { records, awards, duplicate: false, invalid: false };
}

export function unlockedCosmetics(recordsInput) {
  const records = normalizeRecords(recordsInput);
  return {
    engines: ["copper", ...(records.awards["engine:aurora"] ? ["aurora"] : []), ...(records.awards["engine:midnight"] ? ["midnight"] : [])],
    carriages: ["supply", ...(records.awards["carriage:mail"] ? ["mail"] : []), ...(records.awards["carriage:observatory"] ? ["observatory"] : [])],
  };
}
