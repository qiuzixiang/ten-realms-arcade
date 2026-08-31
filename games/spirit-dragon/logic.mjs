/**
 * UI-free Pearl / Masyu rules for Spirit Dragon.
 *
 * Geometry follows the original puzzle exactly: every coordinate is a cell
 * centre and a line may join only two orthogonally adjacent centres.  Player
 * crosses (`marks`) are notes; they are mutually exclusive with lines but do
 * not affect rule evaluation or victory.
 */

export const PEARL_TYPES = Object.freeze({
  BLACK: "black",
  WHITE: "white",
});

export const EDGE_STATES = Object.freeze({
  EMPTY: "empty",
  LINE: "line",
  MARK: "mark",
});

export const DIRECTIONS = Object.freeze({
  north: Object.freeze({ dx: 0, dy: -1, opposite: "south" }),
  east: Object.freeze({ dx: 1, dy: 0, opposite: "west" }),
  south: Object.freeze({ dx: 0, dy: 1, opposite: "north" }),
  west: Object.freeze({ dx: -1, dy: 0, opposite: "east" }),
});

const DIRECTION_LIST = Object.freeze(Object.values(DIRECTIONS));
const VALID_PEARL_TYPES = new Set(Object.values(PEARL_TYPES));

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function asPoint(value, y) {
  if (Number.isInteger(value) && Number.isInteger(y)) return { x: value, y };
  if (Array.isArray(value) && value.length === 2) {
    return { x: Number(value[0]), y: Number(value[1]) };
  }
  if (value && typeof value === "object") {
    return { x: Number(value.x), y: Number(value.y) };
  }
  throw new TypeError("Expected a point with integer x and y coordinates");
}

function safeCoordinate(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function assertIntegerPoint(point, label = "point") {
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) {
    throw new TypeError(`${label} must have integer x and y coordinates`);
  }
}

function comparePoints(a, b) {
  return (a.y - b.y) || (a.x - b.x);
}

export function nodeKey(point, y) {
  const node = asPoint(point, y);
  assertIntegerPoint(node);
  return `${node.x},${node.y}`;
}

export function parseNodeKey(key) {
  if (typeof key !== "string" || !/^-?\d+,-?\d+$/.test(key)) {
    throw new TypeError(`Invalid node key: ${String(key)}`);
  }
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function isOrthogonalNeighbor(a, b) {
  const first = asPoint(a);
  const second = asPoint(b);
  assertIntegerPoint(first, "first point");
  assertIntegerPoint(second, "second point");
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y) === 1;
}

/** Return the stable row-major key `x,y|x,y` for an undirected edge. */
export function edgeKey(a, b, x2, y2) {
  let first;
  let second;
  if (arguments.length === 4) {
    first = asPoint(a, b);
    second = asPoint(x2, y2);
  } else {
    first = asPoint(a);
    second = asPoint(b);
  }
  assertIntegerPoint(first, "first endpoint");
  assertIntegerPoint(second, "second endpoint");
  if (!isOrthogonalNeighbor(first, second)) {
    throw new RangeError("An edge must join orthogonally adjacent nodes");
  }
  const [start, end] = comparePoints(first, second) <= 0
    ? [first, second]
    : [second, first];
  return `${nodeKey(start)}|${nodeKey(end)}`;
}

export const canonicalEdgeKey = edgeKey;

export function parseEdgeKey(key) {
  if (typeof key !== "string") throw new TypeError("Edge key must be a string");
  const parts = key.split("|");
  if (parts.length !== 2) throw new TypeError(`Invalid edge key: ${key}`);
  const a = parseNodeKey(parts[0]);
  const b = parseNodeKey(parts[1]);
  const canonical = edgeKey(a, b);
  if (canonical !== key) throw new TypeError(`Edge key is not canonical: ${key}`);
  return { a, b, key: canonical };
}

function normalizeEdgeInput(edge, secondEndpoint) {
  if (typeof edge === "string") return parseEdgeKey(edge).key;
  if (secondEndpoint !== undefined) return edgeKey(edge, secondEndpoint);
  if (Array.isArray(edge) && edge.length === 2) return edgeKey(edge[0], edge[1]);
  if (edge && typeof edge === "object" && edge.a && edge.b) {
    return edgeKey(edge.a, edge.b);
  }
  throw new TypeError("Expected a canonical edge key or two adjacent endpoints");
}

export function inBounds(puzzle, point, y) {
  const node = asPoint(point, y);
  return Number.isInteger(node.x)
    && Number.isInteger(node.y)
    && node.x >= 0
    && node.y >= 0
    && node.x < puzzle?.width
    && node.y < puzzle?.height;
}

/** Parse an untrusted saved cursor into canonical, in-bounds safe integers. */
export function normalizeBoardPoint(puzzle, value) {
  if (!isPlainObject(value)) return null;
  const x = safeCoordinate(value.x);
  const y = safeCoordinate(value.y);
  if (x === null || y === null) return null;
  const point = { x, y };
  return inBounds(puzzle, point) ? point : null;
}

/** Move one orthogonal keyboard step after normalizing an untrusted cursor. */
export function stepBoardPoint(puzzle, value, direction) {
  const point = normalizeBoardPoint(puzzle, value);
  if (!point
      || !isPlainObject(direction)
      || !Number.isSafeInteger(direction.x)
      || !Number.isSafeInteger(direction.y)
      || Math.abs(direction.x) + Math.abs(direction.y) !== 1) {
    return null;
  }
  return normalizeBoardPoint(puzzle, {
    x: point.x + direction.x,
    y: point.y + direction.y,
  });
}

export function allNodeKeys(puzzle) {
  const nodes = [];
  for (let y = 0; y < puzzle.height; y += 1) {
    for (let x = 0; x < puzzle.width; x += 1) nodes.push(nodeKey(x, y));
  }
  return nodes;
}

export function allEdgeKeys(puzzle) {
  const edges = [];
  for (let y = 0; y < puzzle.height; y += 1) {
    for (let x = 0; x < puzzle.width; x += 1) {
      if (x + 1 < puzzle.width) edges.push(edgeKey(x, y, x + 1, y));
      if (y + 1 < puzzle.height) edges.push(edgeKey(x, y, x, y + 1));
    }
  }
  return edges;
}

export function incidentEdgeKeys(puzzle, point) {
  const node = asPoint(point);
  if (!inBounds(puzzle, node)) return [];
  return DIRECTION_LIST.flatMap(({ dx, dy }) => {
    const neighbor = { x: node.x + dx, y: node.y + dy };
    return inBounds(puzzle, neighbor) ? [edgeKey(node, neighbor)] : [];
  });
}

function hasGeometricPearlPattern(puzzle, pearl) {
  if (pearl.type === PEARL_TYPES.BLACK) {
    for (let firstIndex = 0; firstIndex < DIRECTION_LIST.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < DIRECTION_LIST.length; secondIndex += 1) {
        const first = DIRECTION_LIST[firstIndex];
        const second = DIRECTION_LIST[secondIndex];
        if (first.dx === -second.dx && first.dy === -second.dy) continue;
        const firstFar = { x: pearl.x + 2 * first.dx, y: pearl.y + 2 * first.dy };
        const secondFar = { x: pearl.x + 2 * second.dx, y: pearl.y + 2 * second.dy };
        if (inBounds(puzzle, firstFar) && inBounds(puzzle, secondFar)) return true;
      }
    }
    return false;
  }

  const axes = [[DIRECTIONS.north, DIRECTIONS.south], [DIRECTIONS.west, DIRECTIONS.east]];
  return axes.some(([first, second]) => {
    const neighbors = [first, second].map((direction) => ({
      x: pearl.x + direction.dx,
      y: pearl.y + direction.dy,
    }));
    if (!neighbors.every((point) => inBounds(puzzle, point))) return false;
    return neighbors.some((neighbor, index) => {
      const axisDirection = index === 0 ? first : second;
      const perpendiculars = axisDirection.dx === 0
        ? [DIRECTIONS.west, DIRECTIONS.east]
        : [DIRECTIONS.north, DIRECTIONS.south];
      return perpendiculars.some((direction) => inBounds(puzzle, {
        x: neighbor.x + direction.dx,
        y: neighbor.y + direction.dy,
      }));
    });
  });
}

export function getPuzzleErrors(puzzle, { checkSolution = true } = {}) {
  const errors = [];
  if (!isPlainObject(puzzle)) return ["Puzzle must be a plain object"];
  if (!Number.isInteger(puzzle.width) || puzzle.width < 2 || puzzle.width > 30) {
    errors.push("width must be an integer from 2 to 30");
  }
  if (!Number.isInteger(puzzle.height) || puzzle.height < 2 || puzzle.height > 30) {
    errors.push("height must be an integer from 2 to 30");
  }
  if (typeof puzzle.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(puzzle.id)) {
    errors.push("id must be a non-empty URL-safe string");
  }
  if (!Array.isArray(puzzle.pearls) || puzzle.pearls.length === 0) {
    errors.push("pearls must be a non-empty array");
  } else if (Number.isInteger(puzzle.width) && Number.isInteger(puzzle.height)) {
    const occupied = new Set();
    for (const [index, pearl] of puzzle.pearls.entries()) {
      if (!isPlainObject(pearl)
          || !Number.isInteger(pearl.x)
          || !Number.isInteger(pearl.y)
          || !VALID_PEARL_TYPES.has(pearl.type)) {
        errors.push(`pearl ${index} is malformed`);
        continue;
      }
      if (!inBounds(puzzle, pearl)) errors.push(`pearl ${index} is out of bounds`);
      const key = nodeKey(pearl);
      if (occupied.has(key)) errors.push(`duplicate pearl at ${key}`);
      occupied.add(key);
      if (inBounds(puzzle, pearl) && !hasGeometricPearlPattern(puzzle, pearl)) {
        errors.push(`pearl ${index} has no geometrically possible path`);
      }
    }
  }

  if (puzzle.solution !== undefined && checkSolution) {
    if (!Array.isArray(puzzle.solution) || puzzle.solution.length < 4) {
      errors.push("solution must contain at least four edges");
    } else if (Number.isInteger(puzzle.width) && Number.isInteger(puzzle.height)) {
      const validEdges = new Set(allEdgeKeys(puzzle));
      const seen = new Set();
      for (const [index, rawEdge] of puzzle.solution.entries()) {
        try {
          const key = normalizeEdgeInput(rawEdge);
          if (!validEdges.has(key)) errors.push(`solution edge ${index} is out of bounds`);
          if (seen.has(key)) errors.push(`solution edge ${index} is duplicated`);
          seen.add(key);
        } catch {
          errors.push(`solution edge ${index} is malformed`);
        }
      }
      if (errors.length === 0) {
        const solutionState = createState(puzzle, { lines: seen });
        const result = analyzeBoard(puzzle, solutionState);
        if (!result.solved) errors.push("stored solution does not satisfy the puzzle");
      }
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

function coerceKeySet(value) {
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return new Set(value);
  if (value === undefined || value === null) return new Set();
  throw new TypeError("Edge collection must be an array or Set");
}

/** Create a fresh, mutable-by-replacement play state. */
export function createState(puzzle, snapshot = {}) {
  assertValidPuzzle(puzzle, { checkSolution: false });
  const state = {
    version: 1,
    puzzleId: puzzle.id,
    width: puzzle.width,
    height: puzzle.height,
    lines: coerceKeySet(snapshot.lines),
    marks: coerceKeySet(snapshot.marks),
    moves: Number.isInteger(snapshot.moves) && snapshot.moves >= 0 ? snapshot.moves : 0,
  };
  if (!validateState(puzzle, state)) throw new TypeError("Invalid initial play state");
  return state;
}

export const createGameState = createState;

export function cloneState(state) {
  return {
    version: 1,
    puzzleId: state.puzzleId,
    width: state.width,
    height: state.height,
    lines: new Set(state.lines),
    marks: new Set(state.marks),
    moves: state.moves,
  };
}

export function degreeAt(stateOrLines, point) {
  const lines = stateOrLines?.lines instanceof Set
    ? stateOrLines.lines
    : coerceKeySet(stateOrLines);
  const key = nodeKey(point);
  let degree = 0;
  for (const line of lines) {
    const { a, b } = parseEdgeKey(line);
    if (nodeKey(a) === key || nodeKey(b) === key) degree += 1;
  }
  return degree;
}

export function validateState(puzzle, state) {
  if (!isPlainObject(state)) return false;
  if (state.puzzleId !== puzzle.id || state.width !== puzzle.width || state.height !== puzzle.height) {
    return false;
  }
  if (!(state.lines instanceof Set) || !(state.marks instanceof Set)) return false;
  if (!Number.isInteger(state.moves) || state.moves < 0) return false;
  const validEdges = new Set(allEdgeKeys(puzzle));
  const degrees = new Map();
  for (const collection of [state.lines, state.marks]) {
    for (const key of collection) {
      if (typeof key !== "string" || !validEdges.has(key)) return false;
      try {
        if (parseEdgeKey(key).key !== key) return false;
      } catch {
        return false;
      }
    }
  }
  for (const key of state.lines) {
    if (state.marks.has(key)) return false;
    const { a, b } = parseEdgeKey(key);
    for (const node of [nodeKey(a), nodeKey(b)]) {
      const next = (degrees.get(node) ?? 0) + 1;
      if (next > 2) return false;
      degrees.set(node, next);
    }
  }
  return true;
}

function rejectedMove(state, edge, target, reason) {
  return Object.freeze({ state, changed: false, edge, target, action: "rejected", reason });
}

/**
 * Set one edge to `line`, `mark`, or `empty` without mutating the input state.
 * Adding a third line at either endpoint is rejected.  Marking a line (or
 * lining a mark) switches it atomically, preserving line/mark exclusivity.
 */
export function setEdgeState(puzzle, state, rawEdge, target) {
  if (!validateState(puzzle, state)) return rejectedMove(state, String(rawEdge), target, "invalid-state");
  if (!Object.values(EDGE_STATES).includes(target)) {
    throw new TypeError(`Unknown edge state: ${String(target)}`);
  }
  let edge;
  try {
    edge = normalizeEdgeInput(rawEdge);
  } catch {
    return rejectedMove(state, String(rawEdge), target, "invalid-edge");
  }
  if (!new Set(allEdgeKeys(puzzle)).has(edge)) {
    return rejectedMove(state, edge, target, "out-of-bounds");
  }
  const current = state.lines.has(edge)
    ? EDGE_STATES.LINE
    : state.marks.has(edge) ? EDGE_STATES.MARK : EDGE_STATES.EMPTY;
  if (current === target) return rejectedMove(state, edge, target, "unchanged");

  if (target === EDGE_STATES.LINE && current !== EDGE_STATES.LINE) {
    const { a, b } = parseEdgeKey(edge);
    if (degreeAt(state, a) >= 2 || degreeAt(state, b) >= 2) {
      return rejectedMove(state, edge, target, "degree-limit");
    }
  }

  const next = cloneState(state);
  next.lines.delete(edge);
  next.marks.delete(edge);
  if (target === EDGE_STATES.LINE) next.lines.add(edge);
  if (target === EDGE_STATES.MARK) next.marks.add(edge);
  next.moves += 1;
  return Object.freeze({
    state: next,
    changed: true,
    edge,
    previous: current,
    target,
    action: `${current}-to-${target}`,
    reason: null,
  });
}

export function toggleEdge(puzzle, state, edge, tool = EDGE_STATES.LINE) {
  if (tool !== EDGE_STATES.LINE && tool !== EDGE_STATES.MARK) {
    throw new TypeError("toggleEdge tool must be 'line' or 'mark'");
  }
  let key;
  try {
    key = normalizeEdgeInput(edge);
  } catch {
    return rejectedMove(state, String(edge), tool, "invalid-edge");
  }
  const isPresent = tool === EDGE_STATES.LINE ? state.lines.has(key) : state.marks.has(key);
  return setEdgeState(puzzle, state, key, isPresent ? EDGE_STATES.EMPTY : tool);
}

export function toggleLine(puzzle, state, edge) {
  return toggleEdge(puzzle, state, edge, EDGE_STATES.LINE);
}

export function toggleMark(puzzle, state, edge) {
  return toggleEdge(puzzle, state, edge, EDGE_STATES.MARK);
}

export function edgeStateAt(state, edge) {
  const key = normalizeEdgeInput(edge);
  if (state.lines.has(key)) return EDGE_STATES.LINE;
  if (state.marks.has(key)) return EDGE_STATES.MARK;
  return EDGE_STATES.EMPTY;
}

function adjacencyFromLines(lines) {
  const adjacency = new Map();
  for (const key of lines) {
    const { a, b } = parseEdgeKey(key);
    const aKey = nodeKey(a);
    const bKey = nodeKey(b);
    if (!adjacency.has(aKey)) adjacency.set(aKey, []);
    if (!adjacency.has(bKey)) adjacency.set(bKey, []);
    adjacency.get(aKey).push(bKey);
    adjacency.get(bKey).push(aKey);
  }
  return adjacency;
}

function componentDetails(lines) {
  const adjacency = adjacencyFromLines(lines);
  const unseen = new Set(adjacency.keys());
  const components = [];
  while (unseen.size) {
    const start = unseen.values().next().value;
    const stack = [start];
    const nodes = [];
    let edgeDegreeSum = 0;
    unseen.delete(start);
    while (stack.length) {
      const current = stack.pop();
      nodes.push(current);
      const neighbors = adjacency.get(current) ?? [];
      edgeDegreeSum += neighbors.length;
      for (const neighbor of neighbors) {
        if (unseen.delete(neighbor)) stack.push(neighbor);
      }
    }
    const edgeCount = edgeDegreeSum / 2;
    const closed = nodes.length >= 4
      && edgeCount === nodes.length
      && nodes.every((key) => adjacency.get(key)?.length === 2);
    components.push(Object.freeze({
      nodes: Object.freeze(nodes.slice().sort()),
      edgeCount,
      closed,
    }));
  }
  return { adjacency, components };
}

export function lineShapeAt(stateOrLines, point) {
  const lines = stateOrLines?.lines instanceof Set ? stateOrLines.lines : coerceKeySet(stateOrLines);
  const target = asPoint(point);
  const directions = [];
  for (const { dx, dy } of DIRECTION_LIST) {
    const neighbor = { x: target.x + dx, y: target.y + dy };
    let key;
    try {
      key = edgeKey(target, neighbor);
    } catch {
      continue;
    }
    if (lines.has(key)) directions.push({ dx, dy });
  }
  if (directions.length === 0) return "unused";
  if (directions.length === 1) return "end";
  if (directions.length > 2) return "branch";
  return directions[0].dx === -directions[1].dx && directions[0].dy === -directions[1].dy
    ? "straight"
    : "turn";
}

function lineDirections(lines, point) {
  const directions = [];
  for (const direction of DIRECTION_LIST) {
    const neighbor = { x: point.x + direction.dx, y: point.y + direction.dy };
    try {
      if (lines.has(edgeKey(point, neighbor))) directions.push(direction);
    } catch {
      // Every direction is geometrically adjacent; out-of-board endpoints are
      // simply absent from a valid line set.
    }
  }
  return directions;
}

function continuationStatus(puzzle, lines, pearl, direction) {
  const neighbor = { x: pearl.x + direction.dx, y: pearl.y + direction.dy };
  const beyond = { x: pearl.x + 2 * direction.dx, y: pearl.y + 2 * direction.dy };
  if (!inBounds(puzzle, beyond)) return "impossible";
  const required = edgeKey(neighbor, beyond);
  if (lines.has(required)) return "yes";
  return degreeAt(lines, neighbor) === 2 ? "impossible" : "unknown";
}

/**
 * Evaluate just one pearl against the current lines. `pending` never counts as
 * a conflict: incomplete degree-0/1 pearls do not leak the answer.
 */
export function evaluatePearl(puzzle, stateOrLines, pearl) {
  const lines = stateOrLines?.lines instanceof Set ? stateOrLines.lines : coerceKeySet(stateOrLines);
  const directions = lineDirections(lines, pearl);
  const degree = directions.length;
  const base = { pearl, key: nodeKey(pearl), degree };
  if (degree > 2) return { ...base, status: "conflict", reason: "degree" };

  if (pearl.type === PEARL_TYPES.BLACK) {
    if (degree === 0) return { ...base, status: "pending", reason: "unvisited" };
    if (degree === 1) {
      const continuation = continuationStatus(puzzle, lines, pearl, directions[0]);
      if (continuation === "impossible") {
        return { ...base, status: "conflict", reason: "black-continuation" };
      }
      return { ...base, status: "pending", reason: "incomplete" };
    }
    const shape = lineShapeAt(lines, pearl);
    if (shape !== "turn") return { ...base, status: "conflict", reason: "black-must-turn" };
    const continuations = directions.map((direction) => continuationStatus(puzzle, lines, pearl, direction));
    if (continuations.includes("impossible")) {
      return { ...base, status: "conflict", reason: "black-continuation" };
    }
    return continuations.every((status) => status === "yes")
      ? { ...base, status: "satisfied", reason: null }
      : { ...base, status: "pending", reason: "black-needs-straight-neighbors" };
  }

  if (pearl.type === PEARL_TYPES.WHITE) {
    if (degree === 0) return { ...base, status: "pending", reason: "unvisited" };
    if (degree === 1) {
      const opposite = { dx: -directions[0].dx, dy: -directions[0].dy };
      const requiredNeighbor = { x: pearl.x + opposite.dx, y: pearl.y + opposite.dy };
      if (!inBounds(puzzle, requiredNeighbor)) {
        return { ...base, status: "conflict", reason: "white-must-straight" };
      }
      return { ...base, status: "pending", reason: "incomplete" };
    }
    const shape = lineShapeAt(lines, pearl);
    if (shape !== "straight") return { ...base, status: "conflict", reason: "white-must-straight" };
    const neighborShapes = directions.map((direction) => {
      const neighbor = { x: pearl.x + direction.dx, y: pearl.y + direction.dy };
      return lineShapeAt(lines, neighbor);
    });
    if (neighborShapes.includes("turn")) return { ...base, status: "satisfied", reason: null };
    if (neighborShapes.every((neighborShape) => neighborShape === "straight")) {
      return { ...base, status: "conflict", reason: "white-needs-adjacent-turn" };
    }
    return { ...base, status: "pending", reason: "white-needs-adjacent-turn" };
  }

  return { ...base, status: "conflict", reason: "unknown-pearl" };
}

function conflictMessage(reason) {
  return ({
    degree: "龙脉在此分叉",
    "black-must-turn": "地珠上必须转弯",
    "black-continuation": "地珠转弯后两侧都须继续直行",
    "white-must-straight": "天珠上必须直行",
    "white-needs-adjacent-turn": "天珠前后至少一侧须紧邻转弯",
    "premature-loop": "龙脉过早闭合，尚有灵珠或线段在环外",
    "multiple-loops": "只能铺设唯一一条闭合龙脉",
  })[reason] ?? "此处龙脉与规则冲突";
}

/** Analyze degrees, pearl rules, components, and the exact one-loop victory. */
export function analyzeBoard(puzzle, stateOrLines) {
  const lines = stateOrLines?.lines instanceof Set ? stateOrLines.lines : coerceKeySet(stateOrLines);
  const { adjacency, components } = componentDetails(lines);
  const conflicts = [];
  const pearlResults = puzzle.pearls.map((pearl) => evaluatePearl(puzzle, lines, pearl));
  for (const result of pearlResults) {
    if (result.status === "conflict") {
      conflicts.push(Object.freeze({
        type: "pearl",
        key: result.key,
        x: result.pearl.x,
        y: result.pearl.y,
        pearlType: result.pearl.type,
        reason: result.reason,
        message: conflictMessage(result.reason),
      }));
    }
  }

  for (const [key, neighbors] of adjacency) {
    if (neighbors.length > 2) {
      const { x, y } = parseNodeKey(key);
      conflicts.push(Object.freeze({
        type: "degree", key, x, y, reason: "degree", message: conflictMessage("degree"),
      }));
    }
  }

  const closedComponents = components.filter((component) => component.closed);
  const allPearlKeys = new Set(puzzle.pearls.map(nodeKey));
  const allPearlsVisited = [...allPearlKeys].every((key) => adjacency.has(key));
  const allPearlsSatisfied = pearlResults.every((result) => result.status === "satisfied");
  const allUsedDegreesTwo = adjacency.size > 0
    && [...adjacency.values()].every((neighbors) => neighbors.length === 2);
  const exactlyOneClosedComponent = closedComponents.length === 1 && components.length === 1;

  if (closedComponents.length > 1) {
    conflicts.push(Object.freeze({
      type: "loop", key: null, reason: "multiple-loops", message: conflictMessage("multiple-loops"),
    }));
  } else if (closedComponents.length === 1
      && (!exactlyOneClosedComponent || !allPearlsVisited || !allPearlsSatisfied)) {
    conflicts.push(Object.freeze({
      type: "loop", key: null, reason: "premature-loop", message: conflictMessage("premature-loop"),
    }));
  }

  const solved = lines.size >= 4
    && conflicts.length === 0
    && exactlyOneClosedComponent
    && allUsedDegreesTwo
    && allPearlsVisited
    && allPearlsSatisfied;
  const openEnds = [...adjacency.entries()]
    .filter(([, neighbors]) => neighbors.length === 1)
    .map(([key]) => key);
  const uncoveredPearls = pearlResults
    .filter((result) => result.degree === 0)
    .map((result) => result.key);

  return Object.freeze({
    solved,
    complete: solved,
    status: solved ? "solved" : conflicts.length ? "conflict" : lines.size ? "in-progress" : "empty",
    lineCount: lines.size,
    usedNodeCount: adjacency.size,
    components: Object.freeze(components),
    closedLoopCount: closedComponents.length,
    openEnds: Object.freeze(openEnds),
    uncoveredPearls: Object.freeze(uncoveredPearls),
    pearls: Object.freeze(pearlResults.map(Object.freeze)),
    conflicts: Object.freeze(conflicts),
  });
}

export function isSolved(puzzle, stateOrLines) {
  return analyzeBoard(puzzle, stateOrLines).solved;
}

export const isComplete = isSolved;

export function getLocalConflicts(puzzle, stateOrLines) {
  return analyzeBoard(puzzle, stateOrLines).conflicts;
}

/**
 * Return one closed component in traversal order, without repeating its first
 * node. Returns `null` when the selected component is not a simple loop.
 */
export function traceLoop(puzzle, stateOrLines, requestedStart = null) {
  const lines = stateOrLines?.lines instanceof Set ? stateOrLines.lines : coerceKeySet(stateOrLines);
  const { adjacency, components } = componentDetails(lines);
  if (adjacency.size < 4) return null;
  let start;
  if (requestedStart !== null) {
    try {
      start = typeof requestedStart === "string" ? nodeKey(parseNodeKey(requestedStart)) : nodeKey(requestedStart);
    } catch {
      return null;
    }
  } else {
    const closed = components.find((component) => component.closed);
    if (!closed) return null;
    start = [...closed.nodes].sort((a, b) => comparePoints(parseNodeKey(a), parseNodeKey(b)))[0];
  }
  if (!adjacency.has(start) || adjacency.get(start).length !== 2) return null;
  const path = [start];
  let previous = null;
  let current = start;
  for (let step = 0; step <= lines.size; step += 1) {
    const neighbors = adjacency.get(current);
    if (!neighbors || neighbors.length !== 2) return null;
    const next = neighbors.find((neighbor) => neighbor !== previous);
    if (next === start) {
      return Object.freeze(path.map((key) => Object.freeze(parseNodeKey(key))));
    }
    if (!next || path.includes(next)) return null;
    path.push(next);
    previous = current;
    current = next;
  }
  return null;
}

function sortedEdgeArray(collection) {
  return [...collection].sort((first, second) => {
    const a = parseEdgeKey(first);
    const b = parseEdgeKey(second);
    return comparePoints(a.a, b.a) || comparePoints(a.b, b.b);
  });
}

export function serializeState(state) {
  return JSON.stringify({
    version: 1,
    puzzleId: state.puzzleId,
    width: state.width,
    height: state.height,
    lines: sortedEdgeArray(state.lines),
    marks: sortedEdgeArray(state.marks),
    moves: state.moves,
  });
}

export function deserializeState(serialized, puzzle) {
  try {
    const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    if (!isPlainObject(parsed) || parsed.version !== 1 || !Array.isArray(parsed.lines) || !Array.isArray(parsed.marks)) {
      return null;
    }
    if (new Set(parsed.lines).size !== parsed.lines.length || new Set(parsed.marks).size !== parsed.marks.length) {
      return null;
    }
    const state = {
      version: 1,
      puzzleId: parsed.puzzleId,
      width: parsed.width,
      height: parsed.height,
      lines: new Set(parsed.lines),
      marks: new Set(parsed.marks),
      moves: parsed.moves,
    };
    return validateState(puzzle, state) ? state : null;
  } catch {
    return null;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function solutionFromCycle(cycle) {
  return cycle.map((point, index) => edgeKey(point, cycle[(index + 1) % cycle.length]));
}

/* Static, human-audited seed levels. More levels are appended below. */
const RAW_LEVELS = [
  {
    id: "cloud-gate",
    title: "云岫初引",
    difficulty: "easy",
    width: 5,
    height: 5,
    pearls: [
      { x: 2, y: 1, type: "black" },
      { x: 3, y: 0, type: "white" },
      { x: 3, y: 2, type: "white" },
      { x: 0, y: 3, type: "white" },
      { x: 3, y: 4, type: "white" },
    ],
    cycle: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [3, 1], [3, 2], [3, 3], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3], [0, 2], [1, 2], [1, 3], [2, 3], [2, 2], [2, 1], [1, 1], [0, 1]],
  },
  {
    id: "brook-return",
    title: "涧口回澜",
    difficulty: "easy",
    width: 5,
    height: 5,
    pearls: [
      { x: 0, y: 0, type: "black" },
      { x: 0, y: 1, type: "white" },
      { x: 1, y: 2, type: "white" },
      { x: 4, y: 2, type: "white" },
      { x: 3, y: 3, type: "white" },
      { x: 1, y: 4, type: "white" },
    ],
    cycle: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1], [4, 2], [4, 3], [4, 4], [3, 4], [3, 3], [3, 2], [2, 2], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [2, 4], [1, 4], [0, 4], [0, 3], [0, 2], [0, 1]],
  },
  {
    id: "pine-spring",
    title: "松脊寻泉",
    difficulty: "easy",
    width: 5,
    height: 5,
    pearls: [
      { x: 2, y: 3, type: "black" },
      { x: 1, y: 0, type: "white" },
      { x: 3, y: 1, type: "white" },
      { x: 1, y: 2, type: "white" },
      { x: 1, y: 4, type: "white" },
    ],
    cycle: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [3, 1], [2, 1], [2, 2], [2, 3], [3, 3], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3], [1, 3], [1, 2], [1, 1], [0, 1]],
  },
  {
    id: "river-heart",
    title: "五岭盘云",
    difficulty: "medium",
    width: 6,
    height: 6,
    pearls: [
      { x: 0, y: 1, type: "black" },
      { x: 3, y: 1, type: "black" },
      { x: 5, y: 3, type: "black" },
      { x: 0, y: 5, type: "black" },
      { x: 4, y: 1, type: "white" },
      { x: 3, y: 4, type: "white" },
    ],
    cycle: [[2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [4, 1], [3, 1], [3, 2], [3, 3], [4, 3], [5, 3], [5, 4], [5, 5], [4, 5], [4, 4], [3, 4], [2, 4], [2, 5], [1, 5], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1], [1, 1], [2, 1]],
  },
  {
    id: "twin-abyss",
    title: "双渊合脉",
    difficulty: "medium",
    width: 6,
    height: 6,
    pearls: [
      { x: 0, y: 0, type: "black" },
      { x: 2, y: 2, type: "black" },
      { x: 3, y: 0, type: "white" },
      { x: 3, y: 2, type: "white" },
      { x: 5, y: 3, type: "white" },
      { x: 2, y: 5, type: "white" },
      { x: 3, y: 5, type: "white" },
    ],
    cycle: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [3, 1], [3, 2], [3, 3], [4, 3], [4, 2], [5, 2], [5, 3], [5, 4], [4, 4], [4, 5], [3, 5], [2, 5], [1, 5], [1, 4], [2, 4], [2, 3], [2, 2], [1, 2], [0, 2], [0, 1]],
  },
  {
    id: "jade-pass",
    title: "玉关叠嶂",
    difficulty: "medium",
    width: 6,
    height: 6,
    pearls: [
      { x: 0, y: 5, type: "black" },
      { x: 2, y: 1, type: "white" },
      { x: 4, y: 1, type: "white" },
      { x: 5, y: 1, type: "white" },
      { x: 0, y: 2, type: "white" },
      { x: 2, y: 2, type: "white" },
      { x: 3, y: 2, type: "white" },
      { x: 4, y: 4, type: "white" },
      { x: 2, y: 5, type: "white" },
    ],
    cycle: [[2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [4, 4], [3, 4], [3, 5], [2, 5], [1, 5], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3], [2, 2], [2, 1]],
  },
  {
    id: "heavenly-ridge",
    title: "九曲龙门",
    difficulty: "hard",
    width: 7,
    height: 7,
    pearls: [
      { x: 3, y: 0, type: "black" },
      { x: 4, y: 1, type: "black" },
      { x: 6, y: 4, type: "black" },
      { x: 0, y: 6, type: "black" },
      { x: 4, y: 6, type: "black" },
      { x: 1, y: 2, type: "white" },
      { x: 2, y: 2, type: "white" },
      { x: 1, y: 3, type: "white" },
      { x: 3, y: 3, type: "white" },
    ],
    cycle: [[3, 0], [4, 0], [5, 0], [6, 0], [6, 1], [5, 1], [4, 1], [4, 2], [4, 3], [5, 3], [5, 2], [6, 2], [6, 3], [6, 4], [5, 4], [4, 4], [4, 5], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5], [0, 4], [1, 4], [1, 3], [1, 2], [1, 1], [2, 1], [2, 2], [2, 3], [2, 4], [3, 4], [3, 3], [3, 2], [3, 1]],
  },
  {
    id: "sky-river",
    title: "天河折岳",
    difficulty: "hard",
    width: 7,
    height: 7,
    pearls: [
      { x: 2, y: 0, type: "black" },
      { x: 6, y: 0, type: "black" },
      { x: 2, y: 2, type: "black" },
      { x: 5, y: 2, type: "white" },
      { x: 1, y: 3, type: "white" },
      { x: 2, y: 3, type: "white" },
      { x: 1, y: 4, type: "white" },
      { x: 5, y: 4, type: "white" },
      { x: 1, y: 5, type: "white" },
      { x: 3, y: 5, type: "white" },
      { x: 5, y: 5, type: "white" },
    ],
    cycle: [[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [6, 1], [6, 2], [5, 2], [4, 2], [4, 3], [5, 3], [5, 4], [5, 5], [5, 6], [4, 6], [4, 5], [3, 5], [2, 5], [1, 5], [0, 5], [0, 4], [1, 4], [2, 4], [3, 4], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [1, 2], [2, 2], [2, 1]],
  },
  {
    id: "ten-thousand-valleys",
    title: "万壑归元",
    difficulty: "hard",
    width: 7,
    height: 7,
    pearls: [
      { x: 6, y: 0, type: "black" },
      { x: 1, y: 0, type: "white" },
      { x: 4, y: 0, type: "white" },
      { x: 1, y: 3, type: "white" },
      { x: 2, y: 3, type: "white" },
      { x: 0, y: 4, type: "white" },
      { x: 1, y: 4, type: "white" },
      { x: 5, y: 4, type: "white" },
      { x: 3, y: 5, type: "white" },
      { x: 4, y: 5, type: "white" },
      { x: 5, y: 5, type: "white" },
      { x: 6, y: 5, type: "white" },
    ],
    cycle: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [3, 0], [4, 0], [5, 0], [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6], [5, 6], [5, 5], [5, 4], [5, 3], [4, 3], [4, 4], [4, 5], [4, 6], [3, 6], [3, 5], [3, 4], [2, 4], [2, 3], [2, 2], [1, 2], [1, 3], [1, 4], [1, 5], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1]],
  },
];

export const LEVELS = Object.freeze(RAW_LEVELS.map(({ cycle, ...level }) => {
  const normalized = { ...level, solution: solutionFromCycle(cycle) };
  assertValidPuzzle(normalized);
  return deepFreeze(normalized);
}));

export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function getLevels(difficulty = null) {
  return difficulty === null ? [...LEVELS] : LEVELS.filter((level) => level.difficulty === difficulty);
}

function buildSolverModel(puzzle) {
  const edges = allEdgeKeys(puzzle);
  const edgeIndex = new Map(edges.map((key, index) => [key, index]));
  const nodes = allNodeKeys(puzzle).map((key) => ({ key, point: parseNodeKey(key), edges: [] }));
  const nodeIndex = new Map(nodes.map((node, index) => [node.key, index]));
  const endpoints = edges.map((key) => {
    const { a, b } = parseEdgeKey(key);
    const pair = [nodeIndex.get(nodeKey(a)), nodeIndex.get(nodeKey(b))];
    nodes[pair[0]].edges.push(edgeIndex.get(key));
    nodes[pair[1]].edges.push(edgeIndex.get(key));
    return pair;
  });

  function pattern(entries) {
    const values = new Map();
    for (const [rawKey, value] of entries) {
      if (rawKey !== null) values.set(edgeIndex.get(rawKey), value);
    }
    return values;
  }

  function localEdge(point, direction) {
    const other = { x: point.x + direction.dx, y: point.y + direction.dy };
    return inBounds(puzzle, other) ? edgeKey(point, other) : null;
  }

  const pearlConstraints = puzzle.pearls.map((pearl) => {
    const incident = DIRECTION_LIST.map((direction) => ({ direction, key: localEdge(pearl, direction) }));
    const templates = [];
    if (pearl.type === PEARL_TYPES.BLACK) {
      for (let i = 0; i < DIRECTION_LIST.length; i += 1) {
        for (let j = i + 1; j < DIRECTION_LIST.length; j += 1) {
          const first = DIRECTION_LIST[i];
          const second = DIRECTION_LIST[j];
          if (first.dx === -second.dx && first.dy === -second.dy) continue;
          const firstNear = { x: pearl.x + first.dx, y: pearl.y + first.dy };
          const secondNear = { x: pearl.x + second.dx, y: pearl.y + second.dy };
          const firstFar = { x: pearl.x + 2 * first.dx, y: pearl.y + 2 * first.dy };
          const secondFar = { x: pearl.x + 2 * second.dx, y: pearl.y + 2 * second.dy };
          if (![firstNear, secondNear, firstFar, secondFar].every((point) => inBounds(puzzle, point))) continue;
          const chosen = new Set([localEdge(pearl, first), localEdge(pearl, second)]);
          const entries = incident.filter(({ key }) => key !== null).map(({ key }) => [key, chosen.has(key) ? 1 : 0]);
          entries.push([edgeKey(firstNear, firstFar), 1], [edgeKey(secondNear, secondFar), 1]);
          templates.push(pattern(entries));
        }
      }
    } else {
      const orientations = [[DIRECTIONS.north, DIRECTIONS.south], [DIRECTIONS.west, DIRECTIONS.east]];
      for (const straightDirections of orientations) {
        if (straightDirections.some((direction) => localEdge(pearl, direction) === null)) continue;
        for (const turnSide of straightDirections) {
          const neighbor = { x: pearl.x + turnSide.dx, y: pearl.y + turnSide.dy };
          const perpendiculars = turnSide.dx === 0
            ? [DIRECTIONS.west, DIRECTIONS.east]
            : [DIRECTIONS.north, DIRECTIONS.south];
          for (const perpendicular of perpendiculars) {
            const turnEdge = localEdge(neighbor, perpendicular);
            if (turnEdge === null) continue;
            const chosen = new Set(straightDirections.map((direction) => localEdge(pearl, direction)));
            const entries = incident.filter(({ key }) => key !== null).map(({ key }) => [key, chosen.has(key) ? 1 : 0]);
            entries.push([turnEdge, 1]);
            const straightAhead = localEdge(neighbor, turnSide);
            if (straightAhead !== null) entries.push([straightAhead, 0]);
            for (const otherDirection of perpendiculars) {
              const otherEdge = localEdge(neighbor, otherDirection);
              if (otherEdge !== null && otherEdge !== turnEdge) entries.push([otherEdge, 0]);
            }
            templates.push(pattern(entries));
          }
        }
      }
    }
    return { node: nodeIndex.get(nodeKey(pearl)), templates };
  });
  return { edges, endpoints, nodes, pearlConstraints };
}

function solverPropagate(model, assignment, pearlNodeSet) {
  let changed = true;
  while (changed) {
    changed = false;
    const assign = (index, value) => {
      if (assignment[index] !== -1) return assignment[index] === value;
      assignment[index] = value;
      changed = true;
      return true;
    };

    for (let nodeIndex = 0; nodeIndex < model.nodes.length; nodeIndex += 1) {
      const incident = model.nodes[nodeIndex].edges;
      const on = incident.filter((index) => assignment[index] === 1);
      const unknown = incident.filter((index) => assignment[index] === -1);
      const isPearl = pearlNodeSet.has(nodeIndex);
      if (on.length > 2) return false;
      if (isPearl) {
        if (on.length + unknown.length < 2) return false;
        if (on.length === 2 && !unknown.every((index) => assign(index, 0))) return false;
        if (on.length + unknown.length === 2 && !unknown.every((index) => assign(index, 1))) return false;
      } else {
        if (on.length === 1 && unknown.length === 0) return false;
        if (on.length === 2 && !unknown.every((index) => assign(index, 0))) return false;
        if (on.length === 1 && unknown.length === 1 && !assign(unknown[0], 1)) return false;
        if (on.length === 0 && unknown.length === 1 && !assign(unknown[0], 0)) return false;
      }
    }

    for (const constraint of model.pearlConstraints) {
      const compatible = constraint.templates.filter((template) => {
        for (const [index, value] of template) {
          if (assignment[index] !== -1 && assignment[index] !== value) return false;
        }
        return true;
      });
      if (compatible.length === 0) return false;
      const mentioned = new Set(compatible.flatMap((template) => [...template.keys()]));
      for (const index of mentioned) {
        const values = compatible.map((template) => template.get(index));
        if (values.every((value) => value !== undefined && value === values[0])) {
          if (!assign(index, values[0])) return false;
        }
      }
    }
  }
  return true;
}

function linesFromAssignment(model, assignment) {
  return new Set(model.edges.filter((_, index) => assignment[index] === 1));
}

function closedComponentPrune(puzzle, model, assignment) {
  const lines = linesFromAssignment(model, assignment);
  const { adjacency, components } = componentDetails(lines);
  const closed = components.filter((component) => component.closed);
  if (closed.length === 0) return { valid: true, solved: false };
  if (closed.length > 1 || components.length > 1) return { valid: false, solved: false };
  const loopNodes = new Set(closed[0].nodes);
  if (!puzzle.pearls.every((pearl) => loopNodes.has(nodeKey(pearl)))) return { valid: false, solved: false };
  for (let index = 0; index < assignment.length; index += 1) {
    if (assignment[index] === -1) assignment[index] = 0;
  }
  return { valid: true, solved: isSolved(puzzle, lines) };
}

function chooseSolverEdge(model, assignment, pearlNodeSet) {
  let bestIndex = -1;
  let bestScore = -Infinity;
  for (let index = 0; index < assignment.length; index += 1) {
    if (assignment[index] !== -1) continue;
    const [a, b] = model.endpoints[index];
    let score = Number(pearlNodeSet.has(a)) * 30 + Number(pearlNodeSet.has(b)) * 30;
    for (const node of [a, b]) {
      const incident = model.nodes[node].edges;
      score += incident.filter((edge) => assignment[edge] === 1).length * 12;
      score -= incident.filter((edge) => assignment[edge] === -1).length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/**
 * Enumerate solutions without using any stored answer. `limit` stops the DFS
 * early (use 2 for an efficient uniqueness check). `lines` and `excluded`
 * are optional hard givens; player marks are intentionally not assumed.
 */
export function solvePuzzle(puzzle, { limit = 1, lines = [], excluded = [] } = {}) {
  assertValidPuzzle(puzzle, { checkSolution: false });
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 1;
  const model = buildSolverModel(puzzle);
  const assignment = new Int8Array(model.edges.length);
  assignment.fill(-1);
  for (const [collection, value] of [[lines, 1], [excluded, 0]]) {
    for (const rawEdge of collection) {
      let key;
      try {
        key = normalizeEdgeInput(rawEdge);
      } catch {
        return { count: 0, solutions: [], searched: 0, limited: false };
      }
      const index = model.edges.indexOf(key);
      if (index < 0 || (assignment[index] !== -1 && assignment[index] !== value)) {
        return { count: 0, solutions: [], searched: 0, limited: false };
      }
      assignment[index] = value;
    }
  }
  const pearlNodeSet = new Set(puzzle.pearls.map((pearl) => model.nodes.findIndex((node) => node.key === nodeKey(pearl))));
  const solutions = [];
  let searched = 0;
  let stoppedEarly = false;

  function visit(current) {
    if (solutions.length >= safeLimit) {
      stoppedEarly = true;
      return;
    }
    searched += 1;
    if (!solverPropagate(model, current, pearlNodeSet)) return;
    const loop = closedComponentPrune(puzzle, model, current);
    if (!loop.valid) return;
    if (loop.solved) {
      solutions.push(Object.freeze(sortedEdgeArray(linesFromAssignment(model, current))));
      return;
    }
    const edge = chooseSolverEdge(model, current, pearlNodeSet);
    if (edge < 0) {
      const linesSet = linesFromAssignment(model, current);
      if (isSolved(puzzle, linesSet)) solutions.push(Object.freeze(sortedEdgeArray(linesSet)));
      return;
    }
    for (const value of [1, 0]) {
      const next = current.slice();
      next[edge] = value;
      visit(next);
      if (solutions.length >= safeLimit) break;
    }
  }

  visit(assignment);
  return Object.freeze({
    count: solutions.length,
    solutions: Object.freeze(solutions),
    searched,
    limited: stoppedEarly || solutions.length >= safeLimit,
  });
}

export function countSolutions(puzzle, limit = 2) {
  return solvePuzzle(puzzle, { limit }).count;
}
