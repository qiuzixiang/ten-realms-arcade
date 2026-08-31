export const CELL = Object.freeze({
  FLOOR: ".",
  MIRROR_SLASH: "/",
  MIRROR_BACKSLASH: "\\",
});

export const ACTOR = Object.freeze({
  HUMAN: "human",
  HOLOGRAM: "hologram",
  ROBOT: "robot",
});

export const ACTOR_TYPES = Object.freeze([
  ACTOR.HUMAN,
  ACTOR.HOLOGRAM,
  ACTOR.ROBOT,
]);

export const ACTOR_CODE = Object.freeze({
  [ACTOR.HUMAN]: "H",
  [ACTOR.HOLOGRAM]: "O",
  [ACTOR.ROBOT]: "R",
});

export const CODE_ACTOR = Object.freeze({
  H: ACTOR.HUMAN,
  O: ACTOR.HOLOGRAM,
  R: ACTOR.ROBOT,
});

export const DIRECTION = Object.freeze({
  UP: "up",
  RIGHT: "right",
  DOWN: "down",
  LEFT: "left",
});

export const DIRECTIONS = Object.freeze([
  DIRECTION.UP,
  DIRECTION.RIGHT,
  DIRECTION.DOWN,
  DIRECTION.LEFT,
]);

export const SIDE = Object.freeze({
  TOP: "top",
  RIGHT: "right",
  BOTTOM: "bottom",
  LEFT: "left",
});

export const SIDES = Object.freeze([
  SIDE.TOP,
  SIDE.RIGHT,
  SIDE.BOTTOM,
  SIDE.LEFT,
]);

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "preview", label: "序幕", note: "短光路，先认演员" }),
  Object.freeze({ id: "rehearsal", label: "联排", note: "连续镜面，交叉核对" }),
  Object.freeze({ id: "premiere", label: "首演", note: "回环光路，完整谢幕" }),
]);

const DIRECTION_STEP = Object.freeze({
  [DIRECTION.UP]: Object.freeze([-1, 0]),
  [DIRECTION.RIGHT]: Object.freeze([0, 1]),
  [DIRECTION.DOWN]: Object.freeze([1, 0]),
  [DIRECTION.LEFT]: Object.freeze([0, -1]),
});

const NOTE_CYCLE = Object.freeze([
  Object.freeze([]),
  Object.freeze([ACTOR.HUMAN]),
  Object.freeze([ACTOR.HOLOGRAM]),
  Object.freeze([ACTOR.ROBOT]),
  Object.freeze([ACTOR.HUMAN, ACTOR.HOLOGRAM]),
  Object.freeze([ACTOR.HUMAN, ACTOR.ROBOT]),
  Object.freeze([ACTOR.HOLOGRAM, ACTOR.ROBOT]),
  Object.freeze([...ACTOR_TYPES]),
]);

export function keyOf(row, column) {
  return `${row}:${column}`;
}

export function pointFromKey(key) {
  const match = /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(String(key));
  if (!match) return null;
  return { row: Number(match[1]), column: Number(match[2]) };
}

export function entryKey(entry) {
  return `${entry.side}:${entry.index}`;
}

export function isMirror(cell) {
  return cell === CELL.MIRROR_SLASH || cell === CELL.MIRROR_BACKSLASH;
}

export function isFloor(cell) {
  return cell === CELL.FLOOR;
}

export function cellAt(puzzle, row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
  if (row < 0 || column < 0 || row >= puzzle.height || column >= puzzle.width) return null;
  return puzzle.rows[row][column];
}

export function inBounds(puzzle, row, column) {
  return cellAt(puzzle, row, column) !== null;
}

export function allFloorKeys(puzzle) {
  const keys = [];
  for (let row = 0; row < puzzle.height; row += 1) {
    for (let column = 0; column < puzzle.width; column += 1) {
      if (isFloor(cellAt(puzzle, row, column))) keys.push(keyOf(row, column));
    }
  }
  return keys;
}

function cloneClues(clues, width, height) {
  if (!clues || typeof clues !== "object") {
    throw new TypeError("Puzzle clues must include all four sides.");
  }

  const expected = {
    [SIDE.TOP]: width,
    [SIDE.RIGHT]: height,
    [SIDE.BOTTOM]: width,
    [SIDE.LEFT]: height,
  };
  const copy = {};
  for (const side of SIDES) {
    const values = clues[side];
    if (!Array.isArray(values) || values.length !== expected[side]) {
      throw new TypeError(`${side} must contain ${expected[side]} clues.`);
    }
    if (values.some((value) => !Number.isInteger(value) || value < 0)) {
      throw new TypeError("Edge clues must be non-negative integers.");
    }
    copy[side] = Object.freeze([...values]);
  }
  return Object.freeze(copy);
}

function cloneTargets(targets) {
  if (!targets || typeof targets !== "object") {
    throw new TypeError("Puzzle targets must include all actor types.");
  }
  const copy = {};
  for (const actor of ACTOR_TYPES) {
    if (!Number.isInteger(targets[actor]) || targets[actor] < 0) {
      throw new TypeError(`Invalid target for ${actor}.`);
    }
    copy[actor] = targets[actor];
  }
  return Object.freeze(copy);
}

function normalizeSolutionRows(rows, puzzleRows) {
  if (rows === undefined) return undefined;
  if (!Array.isArray(rows) || rows.length !== puzzleRows.length) {
    throw new TypeError("Solution must match the puzzle dimensions.");
  }

  const solution = rows.map((row, rowIndex) => {
    const value = String(row);
    if (value.length !== puzzleRows[rowIndex].length) {
      throw new TypeError("Solution must match the puzzle dimensions.");
    }
    for (let column = 0; column < value.length; column += 1) {
      const puzzleCell = puzzleRows[rowIndex][column];
      const solutionCell = value[column];
      if (isMirror(puzzleCell) && solutionCell !== puzzleCell) {
        throw new TypeError("Solution mirrors must match the puzzle.");
      }
      if (isFloor(puzzleCell) && !CODE_ACTOR[solutionCell]) {
        throw new TypeError("Every solution floor must contain H, O, or R.");
      }
    }
    return value;
  });
  return Object.freeze(solution);
}

export function createPuzzle(definition) {
  if (!definition || !Array.isArray(definition.rows) || definition.rows.length === 0) {
    throw new TypeError("Puzzle rows must be a non-empty array.");
  }

  const rows = definition.rows.map((row) => String(row));
  const width = rows[0].length;
  if (width === 0 || rows.some((row) => row.length !== width)) {
    throw new TypeError("Puzzle rows must have one non-zero width.");
  }
  if (rows.some((row) => /[^.\\/]/.test(row))) {
    throw new TypeError("Puzzle rows may contain only '.', '/', and '\\'.");
  }

  const height = rows.length;
  const targets = cloneTargets(definition.targets);
  const floorCount = rows.reduce(
    (sum, row) => sum + [...row].filter((cell) => cell === CELL.FLOOR).length,
    0,
  );
  const targetTotal = ACTOR_TYPES.reduce((sum, actor) => sum + targets[actor], 0);
  if (floorCount === 0 || targetTotal !== floorCount) {
    throw new TypeError("Actor targets must sum to the number of non-mirror cells.");
  }

  const clues = cloneClues(definition.clues, width, height);
  const solution = normalizeSolutionRows(definition.solution, rows);
  const puzzle = Object.freeze({
    ...definition,
    rows: Object.freeze(rows),
    width,
    height,
    floorCount,
    targets,
    clues,
    solution,
  });
  if (solution && !evaluatePosition(puzzle, solutionPosition(puzzle)).complete) {
    throw new TypeError("Declared solution does not satisfy every clue and actor target.");
  }
  return puzzle;
}

export function cluesFromClockwise(width, height, values) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new TypeError("Clue dimensions must be positive integers.");
  }
  if (!Array.isArray(values) || values.length !== 2 * (width + height)) {
    throw new TypeError("Clockwise clues must contain 2 × (width + height) entries.");
  }
  let offset = 0;
  const top = values.slice(offset, offset += width);
  const right = values.slice(offset, offset += height);
  const bottom = values.slice(offset, offset += width).reverse();
  const left = values.slice(offset, offset + height).reverse();
  return { top, right, bottom, left };
}

export function clockwiseClues(puzzle) {
  return [
    ...puzzle.clues.top,
    ...puzzle.clues.right,
    ...[...puzzle.clues.bottom].reverse(),
    ...[...puzzle.clues.left].reverse(),
  ];
}

export function edgeEntries(puzzle) {
  const entries = [];
  for (let column = 0; column < puzzle.width; column += 1) {
    entries.push({ side: SIDE.TOP, index: column });
  }
  for (let row = 0; row < puzzle.height; row += 1) {
    entries.push({ side: SIDE.RIGHT, index: row });
  }
  for (let column = puzzle.width - 1; column >= 0; column -= 1) {
    entries.push({ side: SIDE.BOTTOM, index: column });
  }
  for (let row = puzzle.height - 1; row >= 0; row -= 1) {
    entries.push({ side: SIDE.LEFT, index: row });
  }
  return entries;
}

export function clueAt(puzzle, entry) {
  if (!entry || !SIDES.includes(entry.side) || !Number.isInteger(entry.index)) return null;
  return puzzle.clues[entry.side]?.[entry.index] ?? null;
}

export function reflectDirection(mirror, direction) {
  if (!DIRECTIONS.includes(direction)) throw new TypeError("Unknown light direction.");
  if (mirror === CELL.MIRROR_SLASH) {
    return {
      [DIRECTION.UP]: DIRECTION.RIGHT,
      [DIRECTION.RIGHT]: DIRECTION.UP,
      [DIRECTION.DOWN]: DIRECTION.LEFT,
      [DIRECTION.LEFT]: DIRECTION.DOWN,
    }[direction];
  }
  if (mirror === CELL.MIRROR_BACKSLASH) {
    return {
      [DIRECTION.UP]: DIRECTION.LEFT,
      [DIRECTION.LEFT]: DIRECTION.UP,
      [DIRECTION.DOWN]: DIRECTION.RIGHT,
      [DIRECTION.RIGHT]: DIRECTION.DOWN,
    }[direction];
  }
  throw new TypeError("Reflection requires '/' or '\\'.");
}

function startForEntry(puzzle, entry) {
  if (!entry || !SIDES.includes(entry.side) || !Number.isInteger(entry.index)) {
    throw new TypeError("Invalid edge entry.");
  }
  if (entry.side === SIDE.TOP && entry.index >= 0 && entry.index < puzzle.width) {
    return { row: 0, column: entry.index, direction: DIRECTION.DOWN };
  }
  if (entry.side === SIDE.RIGHT && entry.index >= 0 && entry.index < puzzle.height) {
    return { row: entry.index, column: puzzle.width - 1, direction: DIRECTION.LEFT };
  }
  if (entry.side === SIDE.BOTTOM && entry.index >= 0 && entry.index < puzzle.width) {
    return { row: puzzle.height - 1, column: entry.index, direction: DIRECTION.UP };
  }
  if (entry.side === SIDE.LEFT && entry.index >= 0 && entry.index < puzzle.height) {
    return { row: entry.index, column: 0, direction: DIRECTION.RIGHT };
  }
  throw new RangeError("Edge entry index is outside the board.");
}

function exitForPoint(puzzle, row, column) {
  if (row < 0 && column >= 0 && column < puzzle.width) {
    return { side: SIDE.TOP, index: column };
  }
  if (column >= puzzle.width && row >= 0 && row < puzzle.height) {
    return { side: SIDE.RIGHT, index: row };
  }
  if (row >= puzzle.height && column >= 0 && column < puzzle.width) {
    return { side: SIDE.BOTTOM, index: column };
  }
  if (column < 0 && row >= 0 && row < puzzle.height) {
    return { side: SIDE.LEFT, index: row };
  }
  return null;
}

export function traceFrom(puzzle, start, options = {}) {
  if (!start || !Number.isInteger(start.row) || !Number.isInteger(start.column)) {
    throw new TypeError("A ray needs an integer start point.");
  }
  if (!DIRECTIONS.includes(start.direction)) throw new TypeError("A ray needs a direction.");

  let row = start.row;
  let column = start.column;
  let direction = start.direction;
  let hasReflected = Boolean(start.hasReflected);
  let mirrorsHit = 0;
  const occurrences = [];
  const path = [];
  const visited = new Set();
  const stateLimit = options.stateLimit ?? puzzle.width * puzzle.height * DIRECTIONS.length + 1;

  while (inBounds(puzzle, row, column)) {
    const state = `${row}:${column}:${direction}`;
    if (visited.has(state) || visited.size >= stateLimit) {
      return {
        occurrences,
        path,
        exit: null,
        loop: true,
        hasReflected,
        mirrorsHit,
        visitedStates: visited.size,
      };
    }
    visited.add(state);

    const cell = cellAt(puzzle, row, column);
    const step = { row, column, key: keyOf(row, column), cell, directionIn: direction };
    if (isMirror(cell)) {
      direction = reflectDirection(cell, direction);
      hasReflected = true;
      mirrorsHit += 1;
      step.directionOut = direction;
      step.hasReflected = true;
    } else {
      const occurrence = {
        row,
        column,
        key: keyOf(row, column),
        hasReflected,
      };
      occurrences.push(occurrence);
      step.directionOut = direction;
      step.hasReflected = hasReflected;
    }
    path.push(step);

    const [rowStep, columnStep] = DIRECTION_STEP[direction];
    row += rowStep;
    column += columnStep;
  }

  return {
    occurrences,
    path,
    exit: exitForPoint(puzzle, row, column),
    loop: false,
    hasReflected,
    mirrorsHit,
    visitedStates: visited.size,
  };
}

export function traceRay(puzzle, entry, options = {}) {
  const start = startForEntry(puzzle, entry);
  return {
    entry: { side: entry.side, index: entry.index },
    ...traceFrom(puzzle, { ...start, hasReflected: false }, options),
  };
}

export function traceAllRays(puzzle) {
  return edgeEntries(puzzle).map((entry) => traceRay(puzzle, entry));
}

export function isVisible(actor, hasReflected) {
  if (actor === ACTOR.HUMAN) return !hasReflected;
  if (actor === ACTOR.HOLOGRAM) return Boolean(hasReflected);
  if (actor === ACTOR.ROBOT) return true;
  return false;
}

function toActorMap(value) {
  if (value instanceof Map) return new Map(value);
  if (Array.isArray(value)) return new Map(value);
  if (value && typeof value === "object") return new Map(Object.entries(value));
  return new Map();
}

function toNoteMap(value) {
  if (value instanceof Map) return new Map(value);
  if (Array.isArray(value)) return new Map(value);
  if (value && typeof value === "object") return new Map(Object.entries(value));
  return new Map();
}

function validFloorKey(puzzle, key) {
  const point = pointFromKey(key);
  return Boolean(point && isFloor(cellAt(puzzle, point.row, point.column)));
}

export function normalizePosition(puzzle, position = {}) {
  const actors = new Map();
  for (const [key, actor] of toActorMap(position.actors)) {
    if (validFloorKey(puzzle, key) && ACTOR_TYPES.includes(actor)) actors.set(key, actor);
  }

  const notes = new Map();
  for (const [key, rawActors] of toNoteMap(position.notes)) {
    if (!validFloorKey(puzzle, key) || actors.has(key)) continue;
    const values = rawActors instanceof Set ? [...rawActors] : Array.isArray(rawActors) ? rawActors : [];
    const unique = ACTOR_TYPES.filter((actor) => values.includes(actor));
    if (unique.length > 0) notes.set(key, new Set(unique));
  }
  return { actors, notes };
}

export function positionToJSON(position = {}) {
  const actors = Object.fromEntries([...toActorMap(position.actors)].sort(([left], [right]) => (
    left.localeCompare(right)
  )));
  const notes = Object.fromEntries([...toNoteMap(position.notes)]
    .map(([key, values]) => [key, ACTOR_TYPES.filter((actor) => (
      values instanceof Set ? values.has(actor) : Array.isArray(values) && values.includes(actor)
    ))])
    .filter(([, values]) => values.length > 0)
    .sort(([left], [right]) => left.localeCompare(right)));
  return { actors, notes };
}

export function solutionPosition(puzzle) {
  const actors = new Map();
  if (!puzzle.solution) return { actors, notes: new Map() };
  for (let row = 0; row < puzzle.height; row += 1) {
    for (let column = 0; column < puzzle.width; column += 1) {
      const actor = CODE_ACTOR[puzzle.solution[row][column]];
      if (actor) actors.set(keyOf(row, column), actor);
    }
  }
  return { actors, notes: new Map() };
}

export function evaluatePosition(puzzle, position = {}) {
  const { actors, notes } = normalizePosition(puzzle, position);
  const floorKeys = allFloorKeys(puzzle);
  const emptyKeys = new Set(floorKeys.filter((key) => !actors.has(key)));
  const actorCounts = Object.fromEntries(ACTOR_TYPES.map((actor) => [actor, 0]));
  for (const actor of actors.values()) actorCounts[actor] += 1;

  const totalResults = new Map(ACTOR_TYPES.map((actor) => {
    const count = actorCounts[actor];
    const target = puzzle.targets[actor];
    const over = count > target;
    const impossible = over || count + emptyKeys.size < target;
    return [actor, { actor, count, target, exact: count === target, over, impossible }];
  }));

  const edgeResults = new Map();
  const conflictKeys = new Set();
  let exactEdges = 0;
  for (const trace of traceAllRays(puzzle)) {
    const clue = clueAt(puzzle, trace.entry);
    let visible = 0;
    let unknownOccurrences = 0;
    const visibleOccurrences = [];
    for (const occurrence of trace.occurrences) {
      const actor = actors.get(occurrence.key);
      if (!actor) {
        unknownOccurrences += 1;
      } else if (isVisible(actor, occurrence.hasReflected)) {
        visible += 1;
        visibleOccurrences.push(occurrence);
      }
    }
    const over = visible > clue;
    const impossible = trace.loop || over || visible + unknownOccurrences < clue;
    const exact = !trace.loop && unknownOccurrences === 0 && visible === clue;
    if (exact) exactEdges += 1;
    if (over) {
      for (const occurrence of visibleOccurrences) conflictKeys.add(occurrence.key);
    }
    edgeResults.set(entryKey(trace.entry), {
      ...trace,
      clue,
      visible,
      unknownOccurrences,
      maximum: visible + unknownOccurrences,
      exact,
      atTarget: visible === clue,
      over,
      impossible,
    });
  }

  const totalsExact = [...totalResults.values()].every((result) => result.exact);
  const edgesExact = [...edgeResults.values()].every((result) => result.exact);
  const complete = emptyKeys.size === 0 && totalsExact && edgesExact;
  const errors = (
    [...totalResults.values()].filter((result) => result.impossible).length
    + [...edgeResults.values()].filter((result) => result.impossible).length
  );

  return {
    actors,
    notes,
    actorCounts,
    totalResults,
    edgeResults,
    emptyKeys,
    conflictKeys,
    filledCount: actors.size,
    floorCount: floorKeys.length,
    exactEdges,
    totalEdges: edgeResults.size,
    totalsExact,
    edgesExact,
    errors,
    complete,
  };
}

function copyPosition(position) {
  const actors = new Map(position.actors);
  const notes = new Map([...position.notes].map(([key, values]) => [key, new Set(values)]));
  return { actors, notes };
}

export function applyMove(puzzle, position = {}, move = {}) {
  const normalized = normalizePosition(puzzle, position);
  const next = copyPosition(normalized);
  const key = typeof move.key === "string" ? move.key : keyOf(move.row, move.column);
  if (!validFloorKey(puzzle, key)) {
    return { accepted: false, reason: "not-a-floor", ...next };
  }

  if (move.type === "cycle-actor") {
    const current = next.actors.get(key);
    const index = current ? ACTOR_TYPES.indexOf(current) : -1;
    const following = index >= ACTOR_TYPES.length - 1 ? null : ACTOR_TYPES[index + 1];
    if (following) next.actors.set(key, following);
    else next.actors.delete(key);
    next.notes.delete(key);
    return { accepted: true, effect: following ? `actor-${following}` : "actor-cleared", ...next };
  }

  if (move.type === "set-actor") {
    const actor = move.actor ?? null;
    if (actor !== null && !ACTOR_TYPES.includes(actor)) {
      return { accepted: false, reason: "unknown-actor", ...next };
    }
    if ((next.actors.get(key) ?? null) === actor) {
      return { accepted: false, reason: "unchanged", ...next };
    }
    if (actor) next.actors.set(key, actor);
    else next.actors.delete(key);
    next.notes.delete(key);
    return { accepted: true, effect: actor ? `actor-${actor}` : "actor-cleared", ...next };
  }

  if (move.type === "toggle-note") {
    if (!ACTOR_TYPES.includes(move.actor)) {
      return { accepted: false, reason: "unknown-actor", ...next };
    }
    if (next.actors.has(key)) {
      return { accepted: false, reason: "occupied", ...next };
    }
    const values = new Set(next.notes.get(key) ?? []);
    if (values.has(move.actor)) values.delete(move.actor);
    else values.add(move.actor);
    if (values.size > 0) next.notes.set(key, values);
    else next.notes.delete(key);
    return { accepted: true, effect: "note-changed", ...next };
  }

  if (move.type === "cycle-notes") {
    if (next.actors.has(key)) {
      return { accepted: false, reason: "occupied", ...next };
    }
    const current = ACTOR_TYPES.filter((actor) => next.notes.get(key)?.has(actor));
    const index = NOTE_CYCLE.findIndex((values) => (
      values.length === current.length && values.every((actor) => current.includes(actor))
    ));
    const following = NOTE_CYCLE[(index + 1) % NOTE_CYCLE.length];
    if (following.length > 0) next.notes.set(key, new Set(following));
    else next.notes.delete(key);
    return { accepted: true, effect: "note-changed", ...next };
  }

  if (move.type === "clear-cell") {
    const changed = next.actors.delete(key) || next.notes.delete(key);
    return changed
      ? { accepted: true, effect: "cell-cleared", ...next }
      : { accepted: false, reason: "unchanged", ...next };
  }

  return { accepted: false, reason: "unknown-move", ...next };
}

function solverData(puzzle) {
  const traces = traceAllRays(puzzle);
  if (traces.some((trace) => trace.loop)) return null;
  const entries = edgeEntries(puzzle);
  const appearances = new Map(allFloorKeys(puzzle).map((key) => [key, []]));
  traces.forEach((trace, rayIndex) => {
    const statesByKey = new Map();
    for (const occurrence of trace.occurrences) {
      if (!statesByKey.has(occurrence.key)) statesByKey.set(occurrence.key, []);
      statesByKey.get(occurrence.key).push(occurrence.hasReflected);
    }
    for (const [key, states] of statesByKey) {
      appearances.get(key).push({ rayIndex, states });
    }
  });
  const keys = allFloorKeys(puzzle).sort((left, right) => {
    const leftWeight = appearances.get(left).reduce((sum, item) => sum + item.states.length, 0);
    const rightWeight = appearances.get(right).reduce((sum, item) => sum + item.states.length, 0);
    return rightWeight - leftWeight || left.localeCompare(right);
  });
  return {
    traces,
    entries,
    appearances,
    keys,
    clues: entries.map((entry) => clueAt(puzzle, entry)),
  };
}

export function solvePuzzle(puzzle, options = {}) {
  if (
    options.limit !== undefined
    && options.limit !== Infinity
    && (!Number.isInteger(options.limit) || options.limit < 0)
  ) {
    throw new RangeError("Solver limit must be a non-negative integer.");
  }
  const limit = options.limit ?? Infinity;
  if (limit === 0) return [];
  const data = solverData(puzzle);
  if (!data) return [];

  const solutions = [];
  const actors = new Map();
  const counts = Object.fromEntries(ACTOR_TYPES.map((actor) => [actor, 0]));
  const visible = data.traces.map(() => 0);
  const remainingOccurrences = data.traces.map((trace) => trace.occurrences.length);

  function search(depth) {
    if (solutions.length >= limit) return;
    if (depth === data.keys.length) {
      if (ACTOR_TYPES.some((actor) => counts[actor] !== puzzle.targets[actor])) return;
      if (visible.some((count, index) => count !== data.clues[index])) return;
      solutions.push({ actors: new Map(actors), notes: new Map() });
      return;
    }

    const key = data.keys[depth];
    const appearances = data.appearances.get(key);
    const remainingCells = data.keys.length - depth - 1;
    for (const actor of ACTOR_TYPES) {
      if (counts[actor] >= puzzle.targets[actor]) continue;
      actors.set(key, actor);
      counts[actor] += 1;
      for (const appearance of appearances) {
        remainingOccurrences[appearance.rayIndex] -= appearance.states.length;
        visible[appearance.rayIndex] += appearance.states.filter((state) => isVisible(actor, state)).length;
      }

      const totalsPossible = ACTOR_TYPES.every((type) => (
        counts[type] <= puzzle.targets[type]
        && counts[type] + remainingCells >= puzzle.targets[type]
      ));
      const raysPossible = visible.every((count, rayIndex) => (
        count <= data.clues[rayIndex]
        && count + remainingOccurrences[rayIndex] >= data.clues[rayIndex]
      ));
      if (totalsPossible && raysPossible) search(depth + 1);

      for (const appearance of appearances) {
        remainingOccurrences[appearance.rayIndex] += appearance.states.length;
        visible[appearance.rayIndex] -= appearance.states.filter((state) => isVisible(actor, state)).length;
      }
      counts[actor] -= 1;
      actors.delete(key);
      if (solutions.length >= limit) return;
    }
  }

  search(0);
  return solutions;
}

export function countSolutions(puzzle, limit = Infinity) {
  return solvePuzzle(puzzle, { limit }).length;
}

export function actorsToSolutionRows(puzzle, position) {
  const { actors } = normalizePosition(puzzle, position);
  return puzzle.rows.map((row, rowIndex) => [...row].map((cell, columnIndex) => {
    if (isMirror(cell)) return cell;
    return ACTOR_CODE[actors.get(keyOf(rowIndex, columnIndex))] ?? CELL.FLOOR;
  }).join(""));
}

const F = CELL.FLOOR;
const S = CELL.MIRROR_SLASH;
const B = CELL.MIRROR_BACKSLASH;
const H = ACTOR_CODE[ACTOR.HUMAN];
const O = ACTOR_CODE[ACTOR.HOLOGRAM];
const R = ACTOR_CODE[ACTOR.ROBOT];
const row = (...cells) => cells.join("");

export const LEVELS = Object.freeze([
  createPuzzle({
    id: "velvet-foyer",
    difficulty: "preview",
    title: "绒幕试光",
    subtitle: "短镜廊 · 11 位演员",
    note: "先听清三种掌声，再让幕布升起。",
    rows: [
      row(S, S, F, F),
      row(F, B, B, F),
      row(F, F, B, F),
      row(F, F, F, F),
    ],
    targets: { human: 5, hologram: 3, robot: 3 },
    clues: {
      top: [0, 1, 2, 3],
      right: [2, 2, 3, 2],
      bottom: [2, 2, 0, 3],
      left: [0, 1, 3, 2],
    },
    solution: [
      row(S, S, R, O),
      row(H, B, B, R),
      row(H, H, B, R),
      row(O, H, O, H),
    ],
  }),
  createPuzzle({
    id: "prism-entrance",
    difficulty: "preview",
    title: "棱镜入场",
    subtitle: "折光前厅 · 10 位演员",
    note: "零号席同样重要：它要求整条光路无人现身。",
    rows: [
      row(B, F, B, F),
      row(F, F, F, S),
      row(F, F, B, S),
      row(F, F, F, B),
    ],
    targets: { human: 4, hologram: 3, robot: 3 },
    clues: {
      top: [1, 2, 0, 3],
      right: [1, 1, 0, 0],
      bottom: [3, 2, 1, 2],
      left: [1, 3, 2, 2],
    },
    solution: [
      row(B, O, B, H),
      row(R, R, H, S),
      row(H, O, B, S),
      row(H, R, O, B),
    ],
  }),
  createPuzzle({
    id: "mirror-score",
    difficulty: "rehearsal",
    title: "镜谱校准",
    subtitle: "经典镜谱 · 8 位演员",
    note: "源自上游 4×4 回归题，只有真人与机械演员登台。",
    rows: [
      row(B, B, F, S),
      row(B, F, S, F),
      row(S, F, S, F),
      row(F, F, F, B),
    ],
    targets: { human: 2, hologram: 0, robot: 6 },
    clues: cluesFromClockwise(4, 4, [
      2, 1, 1, 1,
      2, 2, 2, 2,
      2, 2, 3, 3,
      3, 0, 0, 1,
    ]),
    solution: [
      row(B, B, R, S),
      row(B, H, S, R),
      row(S, R, S, R),
      row(H, R, R, B),
    ],
  }),
  createPuzzle({
    id: "mirror-chorus",
    difficulty: "rehearsal",
    title: "镜廊群像",
    subtitle: "双向群舞 · 15 位演员",
    note: "同一位演员可能绕镜再现；每次经过都要听见一次掌声。",
    rows: [
      row(S, S, S, F, B),
      row(F, F, F, F, F),
      row(B, F, B, S, F),
      row(F, B, B, B, F),
      row(F, F, F, F, F),
    ],
    targets: { human: 5, hologram: 5, robot: 5 },
    clues: {
      top: [0, 2, 2, 6, 0],
      right: [0, 2, 2, 1, 4],
      bottom: [2, 1, 2, 2, 5],
      left: [0, 2, 0, 1, 4],
    },
    solution: [
      row(S, S, S, R, B),
      row(O, O, H, O, R),
      row(B, H, B, S, R),
      row(H, B, B, B, O),
      row(H, H, R, R, O),
    ],
  }),
  createPuzzle({
    id: "grand-curtain",
    difficulty: "premiere",
    title: "回光谢幕",
    subtitle: "多幕终场 · 16 位演员",
    note: "直视与镜中先后交错，反向观众席会看到另一段开场。",
    rows: [
      row(F, F, B, S, F),
      row(F, B, S, F, F),
      row(F, F, F, F, F),
      row(F, F, F, S, S),
      row(B, B, F, F, S),
    ],
    targets: { human: 5, hologram: 5, robot: 6 },
    clues: {
      top: [3, 2, 0, 0, 3],
      right: [3, 3, 4, 4, 0],
      bottom: [0, 3, 3, 2, 0],
      left: [2, 4, 4, 2, 0],
    },
    solution: [
      row(R, O, B, S, H),
      row(R, B, S, H, O),
      row(O, R, R, H, R),
      row(H, R, O, S, S),
      row(B, B, H, O, S),
    ],
  }),
  createPuzzle({
    id: "ninefold-applause",
    difficulty: "premiere",
    title: "九折追光",
    subtitle: "深镜首演 · 12 位演员",
    note: "最长光路连过九面镜；第一次反射后，舞台始终属于镜中。",
    rows: [
      row(S, F, F, B, F),
      row(F, S, S, S, B),
      row(B, S, F, S, B),
      row(F, F, S, F, S),
      row(F, S, F, F, F),
    ],
    targets: { human: 4, hologram: 4, robot: 4 },
    clues: {
      top: [0, 2, 3, 1, 1],
      right: [1, 1, 2, 1, 3],
      bottom: [2, 2, 4, 2, 1],
      left: [0, 0, 1, 6, 2],
    },
    solution: [
      row(S, H, O, B, R),
      row(O, S, S, S, B),
      row(B, S, O, S, B),
      row(H, H, S, O, S),
      row(R, S, H, R, R),
    ],
  }),
]);

export function findLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}
