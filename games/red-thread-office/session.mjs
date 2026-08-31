import {
  DIFFICULTIES,
  findCrossingPairs,
  generatePuzzle,
} from "./logic.mjs";

const MIN_COORDINATE = 0.03;
const MAX_COORDINATE = 0.97;

function clonePoint(vertex) {
  return { id: vertex.id, x: vertex.x, y: vertex.y };
}

function isFiniteCoordinate(point) {
  return point
    && Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && point.x >= MIN_COORDINATE
    && point.x <= MAX_COORDINATE
    && point.y >= MIN_COORDINATE
    && point.y <= MAX_COORDINATE;
}

function isFiniteVertex(vertex) {
  return Number.isInteger(vertex?.id) && isFiniteCoordinate(vertex);
}

function parseSavedMove(move, vertexCount) {
  if (!move || !Number.isInteger(move.id) || move.id < 0 || move.id >= vertexCount) return null;
  if (!isFiniteCoordinate(move.from) || !isFiniteCoordinate(move.to)) return null;
  return {
    id: move.id,
    from: { x: move.from.x, y: move.from.y },
    to: { x: move.to.x, y: move.to.y },
  };
}

function samePosition(first, second) {
  return Math.abs(first.x - second.x) <= 1e-9
    && Math.abs(first.y - second.y) <= 1e-9;
}

function historyMatchesSnapshot(vertices, history) {
  const rewound = new Map(
    vertices.map((vertex) => [vertex.id, { x: vertex.x, y: vertex.y }]),
  );

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const move = history[index];
    const current = rewound.get(move.id);
    if (!current || !samePosition(current, move.to)) return false;
    rewound.set(move.id, { ...move.from });
  }
  return true;
}

/** True only when every integer id from 0 through expectedCount - 1 occurs once. */
export function hasExactNodeIds(vertices, expectedCount) {
  if (!Number.isInteger(expectedCount) || expectedCount < 0) return false;
  if (!Array.isArray(vertices) || vertices.length !== expectedCount) return false;

  const ids = new Set();
  for (const vertex of vertices) {
    if (!Number.isInteger(vertex?.id) || vertex.id < 0 || vertex.id >= expectedCount) return false;
    if (ids.has(vertex.id)) return false;
    ids.add(vertex.id);
  }
  return ids.size === expectedCount;
}

/** Undo availability deliberately depends on history alone, including after victory. */
export function canUndo(history) {
  return Array.isArray(history) && history.length > 0;
}

/** Return an immutable snapshot with the latest node move rewound. */
export function undoLastMove(vertices, history, steps) {
  if (!Array.isArray(vertices) || !canUndo(history)) return null;
  const move = history.at(-1);
  const vertexIndex = vertices.findIndex((vertex) => vertex.id === move?.id);
  if (vertexIndex < 0 || !isFiniteCoordinate(move?.from)) return null;

  const nextVertices = vertices.map(clonePoint);
  nextVertices[vertexIndex] = {
    id: move.id,
    x: move.from.x,
    y: move.from.y,
  };
  return {
    move,
    vertices: nextVertices,
    history: history.slice(0, -1),
    steps: Math.max(0, Number.isSafeInteger(steps) ? steps - 1 : history.length - 1),
  };
}

/**
 * Validate and rebuild a persisted session without touching browser state.
 * Invalid data returns null; generator/geometry exceptions intentionally bubble
 * to restoreSavedSession, which clears the poisoned storage entry safely.
 */
export function rebuildSavedSession(saved, {
  version,
  generate = generatePuzzle,
  findCrossings = findCrossingPairs,
} = {}) {
  if (!saved
    || saved.version !== version
    || !DIFFICULTIES[saved.difficulty]
    || typeof saved.seed !== "string"
    || !Array.isArray(saved.history)
    || !Number.isSafeInteger(saved.steps)
    || saved.steps < 0
    || typeof saved.solved !== "boolean") {
    return null;
  }

  const puzzle = generate(saved.difficulty, saved.seed);
  const vertexCount = puzzle?.vertices?.length;
  if (!Number.isInteger(vertexCount)
    || !hasExactNodeIds(saved.vertices, vertexCount)
    || !saved.vertices.every(isFiniteVertex)
    || !Array.isArray(puzzle.edges)) {
    return null;
  }

  const history = saved.history.map((move) => parseSavedMove(move, vertexCount));
  if (history.some((move) => move === null) || saved.steps < history.length) return null;

  const vertices = saved.vertices.map(clonePoint).sort((first, second) => first.id - second.id);
  if (!historyMatchesSnapshot(vertices, history)) return null;

  const edges = puzzle.edges.map(([from, to]) => [from, to]);
  const crossings = findCrossings(vertices, edges);
  const solved = crossings.length === 0;
  if (saved.solved !== solved) return null;

  // A completed session created by this game always has a final move from an
  // unsolved drawing. Enforcing that invariant guarantees victory can be undone.
  if (solved) {
    const undone = undoLastMove(vertices, history, saved.steps);
    if (!undone || findCrossings(undone.vertices, edges).length === 0) return null;
  }

  return {
    difficulty: saved.difficulty,
    seed: saved.seed,
    vertices,
    initialVertices: puzzle.vertices.map(clonePoint),
    edges,
    initialCrossingCount: puzzle.initialCrossingCount,
    history,
    steps: saved.steps,
    crossings,
    solved,
  };
}

function clearInvalidSave(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage may itself be unavailable; returning null still permits a new game.
  }
}

/** Read a save, clearing any malformed or unreconstructable payload. */
export function restoreSavedSession(storage, key, options) {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const restored = rebuildSavedSession(JSON.parse(raw), options);
    if (!restored) clearInvalidSave(storage, key);
    return restored;
  } catch {
    clearInvalidSave(storage, key);
    return null;
  }
}
