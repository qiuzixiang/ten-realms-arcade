/**
 * Pure rules and puzzle generation for 《月老红线事务所》.
 *
 * Coordinates are normalised to the inclusive 0..1 board. An edge may be an
 * `[from, to]` tuple or an object with `from`/`to`, `a`/`b`, or `u`/`v` keys.
 * A vertex may be `{ id, x, y }` or `[x, y]`.
 */

export const GEOMETRY_EPSILON = 1e-9;

const DIFFICULTY_DATA = {
  easy: {
    key: "easy",
    label: "初签·七印",
    vertexCount: 7,
    spokeCount: 2,
    slotColumns: 3,
    slotRows: 3,
    edgeDensity: 8 / 15,
  },
  medium: {
    key: "medium",
    label: "合契·十印",
    vertexCount: 10,
    spokeCount: 6,
    slotColumns: 4,
    slotRows: 3,
    edgeDensity: 15 / 24,
  },
  hard: {
    key: "hard",
    label: "星罗·十四印",
    vertexCount: 14,
    spokeCount: 13,
    slotColumns: 4,
    slotRows: 4,
    edgeDensity: 26 / 36,
  },
};

export const DIFFICULTIES = Object.freeze(
  Object.fromEntries(
    Object.entries(DIFFICULTY_DATA).map(([key, value]) => [
      key,
      Object.freeze({ ...value }),
    ]),
  ),
);

function asPoint(point, name = "point") {
  const x = Array.isArray(point) ? point[0] : point?.x;
  const y = Array.isArray(point) ? point[1] : point?.y;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`${name} must contain finite x and y coordinates`);
  }

  return { x, y };
}

function asEdge(edge, name = "edge") {
  let from;
  let to;

  if (Array.isArray(edge)) {
    [from, to] = edge;
  } else if (edge && typeof edge === "object") {
    if ("from" in edge || "to" in edge) {
      ({ from, to } = edge);
    } else if ("a" in edge || "b" in edge) {
      from = edge.a;
      to = edge.b;
    } else {
      from = edge.u;
      to = edge.v;
    }
  }

  if (from === undefined || to === undefined) {
    throw new TypeError(`${name} must contain two vertex identifiers`);
  }

  if (from === to) {
    throw new RangeError(`${name} cannot connect a vertex to itself`);
  }

  return [from, to];
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function orientationSign(a, b, c, epsilon) {
  const value = cross(a, b, c);
  const abScale = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  const acScale = Math.abs(c.x - a.x) + Math.abs(c.y - a.y);
  const tolerance = epsilon * Math.max(1, abScale * acScale);

  if (Math.abs(value) <= tolerance) return 0;
  return value > 0 ? 1 : -1;
}

/**
 * Geometric helper for the strict/open-interior case. This is useful to draw
 * X-shaped knots, but is intentionally narrower than the official game rule
 * implemented by `segmentsIntersect` below.
 */
export function properSegmentsIntersect(
  pointA,
  pointB,
  pointC,
  pointD,
  epsilon = GEOMETRY_EPSILON,
) {
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new RangeError("epsilon must be a non-negative finite number");
  }

  const a = asPoint(pointA, "pointA");
  const b = asPoint(pointB, "pointB");
  const c = asPoint(pointC, "pointC");
  const d = asPoint(pointD, "pointD");
  const abC = orientationSign(a, b, c, epsilon);
  const abD = orientationSign(a, b, d, epsilon);

  if (abC === 0 || abD === 0 || abC === abD) return false;

  const cdA = orientationSign(c, d, a, epsilon);
  const cdB = orientationSign(c, d, b, epsilon);
  return cdA !== 0 && cdB !== 0 && cdA !== cdB;
}

export const segmentsProperlyIntersect = properSegmentsIntersect;

function liesInsideClosedBounds(a, b, point, epsilon) {
  const scale = Math.max(
    1,
    Math.abs(a.x),
    Math.abs(a.y),
    Math.abs(b.x),
    Math.abs(b.y),
    Math.abs(point.x),
    Math.abs(point.y),
  );
  const tolerance = epsilon * scale;

  return (
    point.x >= Math.min(a.x, b.x) - tolerance &&
    point.x <= Math.max(a.x, b.x) + tolerance &&
    point.y >= Math.min(a.y, b.y) - tolerance &&
    point.y <= Math.max(a.y, b.y) + tolerance
  );
}

/**
 * Official Untangle closed-segment test. It includes proper X intersections,
 * endpoint-on-interior T touches, coincident endpoints belonging to different
 * logical vertices, and every collinear overlap or contact. Parallel or
 * collinear-separated segments remain non-intersecting.
 */
export function segmentsIntersect(
  pointA,
  pointB,
  pointC,
  pointD,
  epsilon = GEOMETRY_EPSILON,
) {
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new RangeError("epsilon must be a non-negative finite number");
  }

  const a = asPoint(pointA, "pointA");
  const b = asPoint(pointB, "pointB");
  const c = asPoint(pointC, "pointC");
  const d = asPoint(pointD, "pointD");
  const abC = orientationSign(a, b, c, epsilon);
  const abD = orientationSign(a, b, d, epsilon);
  const cdA = orientationSign(c, d, a, epsilon);
  const cdB = orientationSign(c, d, b, epsilon);

  if (abC !== 0 && abD !== 0 && cdA !== 0 && cdB !== 0) {
    return abC !== abD && cdA !== cdB;
  }

  return (
    (abC === 0 && liesInsideClosedBounds(a, b, c, epsilon)) ||
    (abD === 0 && liesInsideClosedBounds(a, b, d, epsilon)) ||
    (cdA === 0 && liesInsideClosedBounds(c, d, a, epsilon)) ||
    (cdB === 0 && liesInsideClosedBounds(c, d, b, epsilon))
  );
}

function buildVertexLookup(vertices) {
  if (!Array.isArray(vertices)) {
    throw new TypeError("vertices must be an array");
  }

  const lookup = new Map();
  vertices.forEach((vertex, index) => {
    const point = asPoint(vertex, `vertices[${index}]`);
    const id = !Array.isArray(vertex) && vertex.id !== undefined ? vertex.id : index;
    if (lookup.has(id)) {
      throw new RangeError(`duplicate vertex id: ${String(id)}`);
    }
    lookup.set(id, point);
  });
  return lookup;
}

function normaliseGraph(vertices, edges) {
  if (!Array.isArray(edges)) {
    throw new TypeError("edges must be an array");
  }

  const vertexLookup = buildVertexLookup(vertices);
  const normalisedEdges = edges.map((edge, index) => {
    const [from, to] = asEdge(edge, `edges[${index}]`);
    if (!vertexLookup.has(from) || !vertexLookup.has(to)) {
      throw new RangeError(`edges[${index}] refers to an unknown vertex`);
    }
    return { from, to, a: vertexLookup.get(from), b: vertexLookup.get(to) };
  });

  return normalisedEdges;
}

/** Return `[edgeIndexA, edgeIndexB]` for every official closed-line crossing. */
export function findCrossingPairs(
  vertices,
  edges,
  epsilon = GEOMETRY_EPSILON,
) {
  const normalisedEdges = normaliseGraph(vertices, edges);
  const pairs = [];

  for (let firstIndex = 0; firstIndex < normalisedEdges.length; firstIndex += 1) {
    const first = normalisedEdges[firstIndex];

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < normalisedEdges.length;
      secondIndex += 1
    ) {
      const second = normalisedEdges[secondIndex];

      // The sole rule-level exemption is a shared logical vertex id. Merely
      // sharing coordinates without sharing an id is still an intersection.
      if (
        first.from === second.from ||
        first.from === second.to ||
        first.to === second.from ||
        first.to === second.to
      ) {
        continue;
      }

      if (
        segmentsIntersect(first.a, first.b, second.a, second.b, epsilon)
      ) {
        pairs.push([firstIndex, secondIndex]);
      }
    }
  }

  return pairs;
}

export const findCrossings = findCrossingPairs;

export function countCrossings(vertices, edges, epsilon = GEOMETRY_EPSILON) {
  return findCrossingPairs(vertices, edges, epsilon).length;
}

export const countIntersections = countCrossings;

export function isSolved(vertices, edges, epsilon = GEOMETRY_EPSILON) {
  return countCrossings(vertices, edges, epsilon) === 0;
}

export function crossingEdgeIndices(
  vertices,
  edges,
  epsilon = GEOMETRY_EPSILON,
) {
  const indices = new Set();
  for (const pair of findCrossingPairs(vertices, edges, epsilon)) {
    indices.add(pair[0]);
    indices.add(pair[1]);
  }
  return [...indices].sort((a, b) => a - b);
}

function hashSeed(seed) {
  const text = String(seed);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** A deterministic PRNG returning values in [0, 1). */
export function createSeededRandom(seed) {
  let state = hashSeed(seed);

  return function seededRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}

function resolveDifficulty(difficulty) {
  const key = String(difficulty ?? "easy").toLowerCase();
  const config = DIFFICULTIES[key];
  if (!config) {
    throw new RangeError(
      `unknown difficulty "${String(difficulty)}"; expected easy, medium, or hard`,
    );
  }
  return config;
}

function chooseSpokeTargets(outerCount, spokeCount) {
  const targets = [];
  for (let index = 0; index < spokeCount; index += 1) {
    const target = 1 + Math.floor((index * outerCount) / spokeCount);
    if (targets.at(-1) !== target) targets.push(target);
  }
  return targets;
}

/**
 * Construct the known solved drawing before any scrambling. The outer seals
 * form a convex cycle and the centre seal connects radially to selected outer
 * seals, so the straight-line embedding is planar by construction.
 */
export function buildPlanarSolution(difficulty = "easy") {
  const config = resolveDifficulty(difficulty);
  const outerCount = config.vertexCount - 1;
  const vertices = [{ id: 0, x: 0.5, y: 0.5 }];

  for (let index = 0; index < outerCount; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / outerCount;
    vertices.push({
      id: index + 1,
      x: 0.5 + Math.cos(angle) * 0.38,
      y: 0.5 + Math.sin(angle) * 0.38,
    });
  }

  const edges = [];
  for (let index = 1; index <= outerCount; index += 1) {
    edges.push([index, index === outerCount ? 1 : index + 1]);
  }
  for (const target of chooseSpokeTargets(outerCount, config.spokeCount)) {
    edges.push([0, target]);
  }

  return { vertices, edges };
}

function makeSlotPool(config, random) {
  const { slotColumns: columns, slotRows: rows } = config;
  const margin = 0.13;
  const xStep = columns === 1 ? 0 : (1 - margin * 2) / (columns - 1);
  const yStep = rows === 1 ? 0 : (1 - margin * 2) / (rows - 1);
  const minimumStep = Math.min(xStep || 1, yStep || 1);
  const jitter = minimumStep * 0.07;
  const slots = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      slots.push({
        x: margin + column * xStep + (random() * 2 - 1) * jitter,
        y: margin + row * yStep + (random() * 2 - 1) * jitter,
      });
    }
  }

  return shuffle(slots, random);
}

function randomScramble(config, random) {
  const slots = makeSlotPool(config, random);
  return Array.from({ length: config.vertexCount }, (_, id) => ({
    id,
    x: slots[id].x,
    y: slots[id].y,
  }));
}

function forcedCrossingScramble(config) {
  // Outer-cycle edges 1–2 and 3–4 are deliberately placed as the two
  // diagonals of a square. The remaining vertices occupy distinct 4×4 slots.
  const assigned = new Map([
    [1, { x: 0.13, y: 0.13 }],
    [2, { x: 0.87, y: 0.87 }],
    [3, { x: 0.87, y: 0.13 }],
    [4, { x: 0.13, y: 0.87 }],
  ]);
  const available = [];
  const coordinates = [0.13, 0.377, 0.623, 0.87];

  for (const y of coordinates) {
    for (const x of coordinates) {
      const isCorner =
        (x === 0.13 || x === 0.87) && (y === 0.13 || y === 0.87);
      if (!isCorner) available.push({ x, y });
    }
  }

  return Array.from({ length: config.vertexCount }, (_, id) => {
    const position = assigned.get(id) ?? available.shift();
    return { id, x: position.x, y: position.y };
  });
}

/** Minimum Euclidean separation between vertex centres. */
export function minimumVertexDistance(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 2) return Infinity;
  let minimum = Infinity;

  for (let first = 0; first < vertices.length; first += 1) {
    const a = asPoint(vertices[first], `vertices[${first}]`);
    for (let second = first + 1; second < vertices.length; second += 1) {
      const b = asPoint(vertices[second], `vertices[${second}]`);
      minimum = Math.min(minimum, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }

  return minimum;
}

/**
 * Generate a guaranteed-solvable puzzle. `generatePuzzle({ difficulty, seed })`
 * and `generatePuzzle(difficulty, seed)` are both supported.
 */
export function generatePuzzle(difficulty = "easy", seed = "red-thread-office") {
  if (difficulty && typeof difficulty === "object") {
    seed = difficulty.seed ?? seed;
    difficulty = difficulty.difficulty ?? "easy";
  }

  const config = resolveDifficulty(difficulty);
  const seedText = String(seed);
  const { vertices: solution, edges } = buildPlanarSolution(config.key);
  const random = createSeededRandom(`red-thread-office|${config.key}|${seedText}`);
  let vertices;
  let crossings;

  // A planar graph can occasionally land in another solved embedding after a
  // random permutation. Retry deterministically so a new round always begins
  // with actual work to do.
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const candidate = randomScramble(config, random);
    const candidateCrossings = findCrossingPairs(candidate, edges);
    if (candidateCrossings.length > 0) {
      vertices = candidate;
      crossings = candidateCrossings;
      break;
    }
  }

  if (!vertices) {
    vertices = forcedCrossingScramble(config);
    crossings = findCrossingPairs(vertices, edges);
  }

  const edgeCopies = edges.map(([from, to]) => [from, to]);
  const solutionCopies = solution.map((vertex) => ({ ...vertex }));
  const vertexCopies = vertices.map((vertex) => ({ ...vertex }));

  return {
    id: `${config.key}-${hashSeed(seedText).toString(16).padStart(8, "0")}`,
    difficulty: config.key,
    config,
    seed: seedText,
    vertices: vertexCopies,
    points: vertexCopies,
    edges: edgeCopies,
    solution: solutionCopies,
    solutionVertices: solutionCopies,
    crossings: crossings.map((pair) => [...pair]),
    crossingCount: crossings.length,
    initialCrossingCount: crossings.length,
  };
}
