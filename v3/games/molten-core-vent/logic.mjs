export const ORIENTATION = Object.freeze({ EMPTY: "", BACK: "\\", FORWARD: "/" });
export const ORIENTATION_ORDER = Object.freeze([ORIENTATION.EMPTY, ORIENTATION.BACK, ORIENTATION.FORWARD]);
const ORIENTATION_SET = new Set(ORIENTATION_ORDER);

export function cellKey(x, y) { return `${x},${y}`; }
export function vertexKey(x, y) { return `${x},${y}`; }

export function parseCellKey(value) {
  const match = /^(\d+),(\d+)$/.exec(String(value));
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

export function actionKey(action) {
  const code = action.orientation === ORIENTATION.BACK ? "B" : action.orientation === ORIENTATION.FORWARD ? "F" : "E";
  return `${action.x},${action.y}:${code}`;
}

export function parseAction(value) {
  const match = /^(\d+),(\d+):([BFE])$/.exec(String(value));
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]), orientation: match[3] === "B" ? ORIENTATION.BACK : match[3] === "F" ? ORIENTATION.FORWARD : ORIENTATION.EMPTY };
}

function dimensions(level) {
  const width = level?.width;
  const height = level?.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width > 8 || height > 8) {
    throw new TypeError("Slant levels require integer dimensions from 2 to 8.");
  }
  return { width, height };
}

export function inBounds(levelOrState, point) {
  return Number.isInteger(point?.x) && Number.isInteger(point?.y)
    && point.x >= 0 && point.x < levelOrState.width && point.y >= 0 && point.y < levelOrState.height;
}

export function indexOf(state, point) { return inBounds(state, point) ? point.y * state.width + point.x : -1; }

function validateClues(level) {
  const { width, height } = dimensions(level);
  if (!Array.isArray(level.clues) || level.clues.length !== height + 1
      || level.clues.some((row) => !Array.isArray(row) || row.length !== width + 1)) return false;
  for (let y = 0; y <= height; y += 1) {
    for (let x = 0; x <= width; x += 1) {
      const clue = level.clues[y][x];
      const degree = (x > 0 ? 1 : 0) + (x < width ? 1 : 0);
      const maximum = degree * ((y > 0 ? 1 : 0) + (y < height ? 1 : 0));
      if (clue !== null && (!Number.isInteger(clue) || clue < 0 || clue > maximum)) return false;
    }
  }
  return true;
}

export function createState(level) {
  const { width, height } = dimensions(level);
  if (!validateClues(level)) throw new TypeError("Slant level clues are malformed.");
  return { width, height, cells: Array(width * height).fill(ORIENTATION.EMPTY), moveCount: 0 };
}

export function cloneState(state) {
  return { width: state.width, height: state.height, cells: [...state.cells], moveCount: state.moveCount };
}

export function orientationAt(state, point) {
  const index = indexOf(state, point);
  return index < 0 ? null : state.cells[index];
}

export function cycleOrientation(value, reverse = false) {
  const index = ORIENTATION_ORDER.indexOf(value);
  if (index < 0) return ORIENTATION.EMPTY;
  return ORIENTATION_ORDER[(index + (reverse ? ORIENTATION_ORDER.length - 1 : 1)) % ORIENTATION_ORDER.length];
}

export function applyOrientation(state, rawAction) {
  const action = typeof rawAction === "string" ? parseAction(rawAction) : rawAction;
  if (!inBounds(state, action) || !ORIENTATION_SET.has(action?.orientation)) return { changed: false, reason: "invalid-action", state };
  const index = indexOf(state, action);
  if (state.cells[index] === action.orientation) return { changed: false, reason: "unchanged", state };
  const next = cloneState(state);
  next.cells[index] = action.orientation;
  next.moveCount += 1;
  return { changed: true, reason: null, action: { x: action.x, y: action.y, orientation: action.orientation }, state: next };
}

export function endpointsFor(width, x, y, orientation) {
  if (orientation === ORIENTATION.BACK) return [{ x, y }, { x: x + 1, y: y + 1 }];
  if (orientation === ORIENTATION.FORWARD) return [{ x: x + 1, y }, { x, y: y + 1 }];
  return [];
}

function vertexIndex(width, point) { return point.y * (width + 1) + point.x; }

class DSU {
  constructor(size) { this.parent = Array.from({ length: size }, (_, index) => index); this.rank = Array(size).fill(1); }
  find(value) { while (this.parent[value] !== value) value = this.parent[value]; return value; }
  union(a, b) {
    a = this.find(a); b = this.find(b);
    if (a === b) return false;
    if (this.rank[a] < this.rank[b]) [a, b] = [b, a];
    this.parent[b] = a;
    this.rank[a] += this.rank[b];
    return true;
  }
}

function incidentVertices(width, x, y) {
  return [
    vertexIndex(width, { x, y }), vertexIndex(width, { x: x + 1, y }),
    vertexIndex(width, { x, y: y + 1 }), vertexIndex(width, { x: x + 1, y: y + 1 }),
  ];
}

export function evaluateState(level, state) {
  const { width, height } = dimensions(level);
  if (state?.width !== width || state?.height !== height || !Array.isArray(state.cells) || state.cells.length !== width * height
      || state.cells.some((value) => !ORIENTATION_SET.has(value))) throw new TypeError("State does not match Slant level.");
  const vertices = (width + 1) * (height + 1);
  const counts = Array(vertices).fill(0);
  const remaining = Array(vertices).fill(0);
  const dsu = new DSU(vertices);
  const cycleCells = new Set();
  let filled = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const orientation = state.cells[y * width + x];
      if (orientation === ORIENTATION.EMPTY) {
        for (const vertex of incidentVertices(width, x, y)) remaining[vertex] += 1;
        continue;
      }
      filled += 1;
      const [a, b] = endpointsFor(width, x, y, orientation).map((point) => vertexIndex(width, point));
      counts[a] += 1; counts[b] += 1;
      if (!dsu.union(a, b)) cycleCells.add(cellKey(x, y));
    }
  }
  const clues = [];
  let clueErrors = 0;
  let satisfiedClues = 0;
  let totalClues = 0;
  for (let y = 0; y <= height; y += 1) {
    for (let x = 0; x <= width; x += 1) {
      const target = level.clues[y][x];
      if (target === null) continue;
      totalClues += 1;
      const index = vertexIndex(width, { x, y });
      const count = counts[index];
      const possible = remaining[index];
      const error = count > target || count + possible < target;
      const satisfied = count === target && possible === 0;
      if (error) clueErrors += 1;
      if (satisfied) satisfiedClues += 1;
      clues.push({ x, y, target, count, remaining: possible, error, satisfied });
    }
  }
  const complete = filled === width * height && cycleCells.size === 0 && clueErrors === 0 && satisfiedClues === totalClues;
  return { complete, filled, totalCells: width * height, cycle: cycleCells.size > 0, cycleCells, clueErrors, satisfiedClues, totalClues, clues, counts, remaining };
}

export function stateFromSolution(level) {
  const state = createState(level);
  if (!Array.isArray(level.solution) || level.solution.length !== level.height) throw new TypeError("Missing Slant solution.");
  const cells = level.solution.join("").split("");
  if (cells.length !== level.width * level.height || cells.some((value) => value !== ORIENTATION.BACK && value !== ORIENTATION.FORWARD)) {
    throw new TypeError("Malformed Slant solution.");
  }
  state.cells = cells;
  return state;
}

export function replayActions(level, actions = []) {
  if (!Array.isArray(actions) || actions.length > 512) return null;
  let state;
  try { state = createState(level); } catch { return null; }
  for (const encoded of actions) {
    if (typeof encoded !== "string" || encoded.length > 30) return null;
    const result = applyOrientation(state, encoded);
    if (!result.changed) return null;
    state = result.state;
  }
  return state;
}

class RollbackDSU {
  constructor(size) { this.parent = Array.from({ length: size }, (_, index) => index); this.size = Array(size).fill(1); this.history = []; }
  find(value) { while (this.parent[value] !== value) value = this.parent[value]; return value; }
  snapshot() { return this.history.length; }
  union(a, b) {
    a = this.find(a); b = this.find(b);
    if (a === b) return false;
    if (this.size[a] < this.size[b]) [a, b] = [b, a];
    this.history.push([b, a, this.size[a]]);
    this.parent[b] = a; this.size[a] += this.size[b];
    return true;
  }
  rollback(snapshot) {
    while (this.history.length > snapshot) {
      const [child, root, oldSize] = this.history.pop();
      this.parent[child] = child; this.size[root] = oldSize;
    }
  }
}

export function countSolutions(level, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit >= 1 ? options.limit : 2;
  const nodeLimit = Number.isInteger(options.nodeLimit) && options.nodeLimit >= 1 ? options.nodeLimit : 2_000_000;
  const start = options.state ? cloneState(options.state) : createState(level);
  const { width, height } = dimensions(level);
  if (start.width !== width || start.height !== height || start.cells.some((value) => !ORIENTATION_SET.has(value))) return { count: 0, solutions: [], nodes: 0, truncated: false };
  const vertexCount = (width + 1) * (height + 1);
  const clueTargets = level.clues.flat();
  const counts = Array(vertexCount).fill(0);
  const remaining = Array(vertexCount).fill(0);
  const dsu = new RollbackDSU(vertexCount);
  const unassigned = new Set();

  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) for (const vertex of incidentVertices(width, x, y)) remaining[vertex] += 1;

  function feasibleAt(x, y, orientation) {
    const endpoints = endpointsFor(width, x, y, orientation).map((point) => vertexIndex(width, point));
    if (dsu.find(endpoints[0]) === dsu.find(endpoints[1])) return false;
    const endpointSet = new Set(endpoints);
    for (const vertex of incidentVertices(width, x, y)) {
      const target = clueTargets[vertex];
      if (target === null) continue;
      const nextCount = counts[vertex] + (endpointSet.has(vertex) ? 1 : 0);
      const nextRemaining = remaining[vertex] - 1;
      if (nextCount > target || nextCount + nextRemaining < target) return false;
    }
    return true;
  }

  function assign(index, orientation) {
    const x = index % width, y = Math.floor(index / width);
    const endpoints = endpointsFor(width, x, y, orientation).map((point) => vertexIndex(width, point));
    const endpointSet = new Set(endpoints);
    for (const vertex of incidentVertices(width, x, y)) { remaining[vertex] -= 1; if (endpointSet.has(vertex)) counts[vertex] += 1; }
    dsu.union(endpoints[0], endpoints[1]);
    start.cells[index] = orientation;
  }

  function unassign(index, orientation, snapshot) {
    const x = index % width, y = Math.floor(index / width);
    const endpoints = new Set(endpointsFor(width, x, y, orientation).map((point) => vertexIndex(width, point)));
    for (const vertex of incidentVertices(width, x, y)) { if (endpoints.has(vertex)) counts[vertex] -= 1; remaining[vertex] += 1; }
    dsu.rollback(snapshot);
    start.cells[index] = ORIENTATION.EMPTY;
  }

  let invalidPrefill = false;
  for (let index = 0; index < start.cells.length; index += 1) {
    const orientation = start.cells[index];
    if (orientation === ORIENTATION.EMPTY) { unassigned.add(index); continue; }
    const x = index % width, y = Math.floor(index / width);
    if (!feasibleAt(x, y, orientation)) { invalidPrefill = true; break; }
    assign(index, orientation);
  }
  if (invalidPrefill) return { count: 0, solutions: [], nodes: 0, truncated: false };

  const solutions = [];
  let nodes = 0;
  let truncated = false;
  function visit() {
    if (solutions.length >= limit || truncated) return;
    nodes += 1;
    if (nodes > nodeLimit) { truncated = true; return; }
    if (unassigned.size === 0) {
      solutions.push(Array.from({ length: height }, (_, y) => start.cells.slice(y * width, (y + 1) * width).join("")));
      return;
    }
    let best = -1;
    let bestOptions = null;
    for (const index of unassigned) {
      const x = index % width, y = Math.floor(index / width);
      const orientations = [ORIENTATION.BACK, ORIENTATION.FORWARD].filter((orientation) => feasibleAt(x, y, orientation));
      if (bestOptions === null || orientations.length < bestOptions.length) { best = index; bestOptions = orientations; }
      if (orientations.length <= 1) break;
    }
    if (!bestOptions?.length) return;
    unassigned.delete(best);
    for (const orientation of bestOptions) {
      const snapshot = dsu.snapshot();
      assign(best, orientation);
      visit();
      unassign(best, orientation, snapshot);
      if (solutions.length >= limit || truncated) break;
    }
    unassigned.add(best);
  }
  visit();
  return { count: solutions.length, solutions, nodes, truncated };
}

export function validateLevel(level, { unique = false } = {}) {
  if (!level || typeof level !== "object" || !/^[a-z0-9][a-z0-9-]{2,60}$/.test(level.id ?? "")
      || !["easy", "medium", "hard"].includes(level.difficulty) || typeof level.seed !== "string" || !level.seed
      || typeof level.title !== "string" || !level.title || !validateClues(level)) return false;
  let solved;
  try { solved = stateFromSolution(level); } catch { return false; }
  if (!evaluateState(level, solved).complete) return false;
  if (unique) {
    const result = countSolutions(level, { limit: 2 });
    if (result.truncated || result.count !== 1) return false;
    if (result.solutions[0].join("") !== level.solution.join("")) return false;
  }
  return true;
}
