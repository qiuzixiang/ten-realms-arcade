/**
 * Yokai Inn / Dominosa rule engine.
 *
 * This module is deliberately DOM- and storage-free. A placement is an exact
 * cover over two kinds of primary constraints: every cell, and every unordered
 * pair in the complete 0..N domino set.
 */

export const ENGINE_VERSION = 1;

export const EDGE_ACTION = Object.freeze({
  ROOM: "room",
  EXCLUDE: "exclude",
});

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "cozy", label: "灯影小馆", order: 3, width: 5, height: 4, note: "0–3 · 10 间客房" }),
  Object.freeze({ id: "bustling", label: "百鬼正厅", order: 4, width: 6, height: 5, note: "0–4 · 15 间客房" }),
  Object.freeze({ id: "moonlit", label: "月隐别院", order: 5, width: 7, height: 6, note: "0–5 · 21 间客房" }),
]);

const DIFFICULTY_BY_ORDER = new Map(DIFFICULTIES.map((item) => [item.order, item]));
const DIFFICULTY_BY_ID = new Map(DIFFICULTIES.map((item) => [item.id, item]));

export function difficultyById(id) {
  return DIFFICULTY_BY_ID.get(id) ?? null;
}

export function difficultyByOrder(order) {
  return DIFFICULTY_BY_ORDER.get(order) ?? null;
}

export function dimensionsForOrder(order) {
  if (!Number.isInteger(order) || order < 1 || order > 9) throw new TypeError("Order must be an integer from 1 to 9.");
  return Object.freeze({
    order,
    width: order + 2,
    height: order + 1,
    dominoCount: ((order + 1) * (order + 2)) / 2,
    cellCount: (order + 1) * (order + 2),
  });
}

export function pairKey(first, second) {
  if (!Number.isInteger(first) || !Number.isInteger(second) || first < 0 || second < 0) {
    throw new TypeError("Pair values must be non-negative integers.");
  }
  const low = Math.min(first, second);
  const high = Math.max(first, second);
  return `${low}-${high}`;
}

export function pairIndex(first, second) {
  if (!Number.isInteger(first) || !Number.isInteger(second) || first < 0 || second < 0) {
    throw new TypeError("Pair values must be non-negative integers.");
  }
  const low = Math.min(first, second);
  const high = Math.max(first, second);
  return (high * (high + 1)) / 2 + low;
}

export function allPairKeys(order) {
  dimensionsForOrder(order);
  const keys = [];
  for (let high = 0; high <= order; high += 1) {
    for (let low = 0; low <= high; low += 1) keys.push(pairKey(low, high));
  }
  return Object.freeze(keys);
}

export function cellIndex(row, column, width) {
  if (![row, column, width].every(Number.isInteger) || row < 0 || column < 0 || width <= 0 || column >= width) {
    throw new RangeError("Invalid grid coordinate.");
  }
  return row * width + column;
}

export function coordinatesOf(index, width) {
  if (!Number.isInteger(index) || !Number.isInteger(width) || index < 0 || width <= 0) {
    throw new RangeError("Invalid cell index.");
  }
  return Object.freeze({ row: Math.floor(index / width), column: index % width });
}

export function areOrthogonalNeighbours(first, second, width, height) {
  if (![first, second, width, height].every(Number.isInteger) || first < 0 || second < 0 || width <= 0 || height <= 0) {
    return false;
  }
  if (first >= width * height || second >= width * height || first === second) return false;
  const a = coordinatesOf(first, width);
  const b = coordinatesOf(second, width);
  return Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;
}

export function edgeKey(first, second, width, height) {
  if (!areOrthogonalNeighbours(first, second, width, height)) throw new RangeError("An edge must join two orthogonally adjacent cells.");
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

export function parseEdgeKey(key, width, height) {
  if (typeof key !== "string" || !/^\d+:\d+$/.test(key)) return null;
  const [first, second] = key.split(":").map(Number);
  if (first >= second || !areOrthogonalNeighbours(first, second, width, height)) return null;
  return Object.freeze({ first, second, key: `${first}:${second}` });
}

function enumerateEdges(width, height, numbers) {
  const edges = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const first = cellIndex(row, column, width);
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const nextRow = row + dr;
        const nextColumn = column + dc;
        if (nextRow >= height || nextColumn >= width) continue;
        const second = cellIndex(nextRow, nextColumn, width);
        const type = pairKey(numbers[first], numbers[second]);
        edges.push(Object.freeze({
          key: `${first}:${second}`,
          first,
          second,
          pairKey: type,
          pairIndex: pairIndex(numbers[first], numbers[second]),
          orientation: dr === 0 ? "horizontal" : "vertical",
        }));
      }
    }
  }
  return Object.freeze(edges);
}

function validateNumbers(order, numbers) {
  const { cellCount } = dimensionsForOrder(order);
  if (!Array.isArray(numbers) || numbers.length !== cellCount) {
    throw new TypeError(`A Dominosa order ${order} grid must contain exactly ${cellCount} cells.`);
  }
  const occurrences = Array.from({ length: order + 1 }, () => 0);
  for (const value of numbers) {
    if (!Number.isInteger(value) || value < 0 || value > order) throw new TypeError(`Grid values must be integers in 0..${order}.`);
    occurrences[value] += 1;
  }
  const expected = order + 2;
  if (occurrences.some((count) => count !== expected)) {
    throw new TypeError(`Every value in an order ${order} grid must occur exactly ${expected} times.`);
  }
  return occurrences;
}

export function createPuzzle(definition) {
  if (!definition || typeof definition !== "object") throw new TypeError("Puzzle definition is required.");
  const order = Number(definition.order);
  const dimensions = dimensionsForOrder(order);
  const numbers = [...definition.numbers];
  const occurrences = validateNumbers(order, numbers);
  const id = String(definition.id ?? "");
  if (!/^yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+$/.test(id)) throw new TypeError("Puzzle id is not canonical.");
  const seed = Number(definition.seed);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError("Puzzle seed must be an unsigned 32-bit integer.");
  const edges = enumerateEdges(dimensions.width, dimensions.height, numbers);
  const edgeMap = new Map(edges.map((edge) => [edge.key, edge]));
  const incidentEdges = Array.from({ length: dimensions.cellCount }, () => []);
  const edgesByPair = new Map(allPairKeys(order).map((key) => [key, []]));
  for (const edge of edges) {
    incidentEdges[edge.first].push(edge);
    incidentEdges[edge.second].push(edge);
    edgesByPair.get(edge.pairKey).push(edge);
  }
  for (const list of incidentEdges) Object.freeze(list);
  for (const list of edgesByPair.values()) Object.freeze(list);

  return Object.freeze({
    id,
    generatorVersion: ENGINE_VERSION,
    order,
    width: dimensions.width,
    height: dimensions.height,
    cellCount: dimensions.cellCount,
    dominoCount: dimensions.dominoCount,
    seed,
    attempt: Number(definition.attempt ?? 0),
    ensureUnique: definition.ensureUnique === true,
    title: String(definition.title ?? "无名旅簿"),
    numbers: Object.freeze(numbers),
    occurrences: Object.freeze(occurrences),
    pairKeys: allPairKeys(order),
    edges,
    edgeMap,
    incidentEdges: Object.freeze(incidentEdges),
    edgesByPair,
  });
}

function canonicalEdgeSet(puzzle, source, label) {
  if (source == null) return new Set();
  if (!(Array.isArray(source) || source instanceof Set)) throw new TypeError(`${label} must be an array or Set.`);
  const values = [...source];
  if (values.some((key) => typeof key !== "string" || !puzzle.edgeMap.has(key))) throw new TypeError(`${label} contains an invalid edge.`);
  if (new Set(values).size !== values.length) throw new TypeError(`${label} contains duplicate edges.`);
  return new Set(values);
}

export function solvePuzzle(puzzle, options = {}) {
  if (!puzzle?.edgeMap || !Array.isArray(puzzle.numbers)) throw new TypeError("A validated puzzle is required.");
  const limit = options.limit === undefined ? 2 : Number(options.limit);
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError("Solution limit must be a positive integer.");
  const forbidden = canonicalEdgeSet(puzzle, options.excluded ?? [], "Excluded set");
  const required = canonicalEdgeSet(puzzle, options.requiredRooms ?? [], "Required room set");
  const covered = Array.from({ length: puzzle.cellCount }, () => false);
  const usedPairs = Array.from({ length: puzzle.dominoCount }, () => false);
  const chosen = [];

  for (const key of required) {
    if (forbidden.has(key)) return Object.freeze({ count: 0, unique: false, capped: false, solution: Object.freeze([]) });
    const edge = puzzle.edgeMap.get(key);
    if (covered[edge.first] || covered[edge.second] || usedPairs[edge.pairIndex]) {
      return Object.freeze({ count: 0, unique: false, capped: false, solution: Object.freeze([]) });
    }
    covered[edge.first] = true;
    covered[edge.second] = true;
    usedPairs[edge.pairIndex] = true;
    chosen.push(edge);
  }

  let count = 0;
  let firstSolution = null;

  const compatible = (edge) => (
    !forbidden.has(edge.key)
    && !covered[edge.first]
    && !covered[edge.second]
    && !usedPairs[edge.pairIndex]
  );

  const search = () => {
    if (count >= limit) return;
    if (chosen.length === puzzle.dominoCount) {
      if (covered.every(Boolean) && usedPairs.every(Boolean)) {
        count += 1;
        if (!firstSolution) firstSolution = chosen.map((edge) => edge.key).sort();
      }
      return;
    }

    let candidates = null;
    for (let cell = 0; cell < puzzle.cellCount; cell += 1) {
      if (covered[cell]) continue;
      const available = puzzle.incidentEdges[cell].filter(compatible);
      if (candidates === null || available.length < candidates.length) candidates = available;
      if (available.length <= 1) break;
    }
    if (candidates?.length !== 0) {
      for (let index = 0; index < puzzle.dominoCount; index += 1) {
        if (usedPairs[index]) continue;
        const key = puzzle.pairKeys[index];
        const available = puzzle.edgesByPair.get(key).filter(compatible);
        if (candidates === null || available.length < candidates.length) candidates = available;
        if (available.length === 0) break;
      }
    }
    if (!candidates?.length) return;

    for (const edge of candidates) {
      if (!compatible(edge)) continue;
      covered[edge.first] = true;
      covered[edge.second] = true;
      usedPairs[edge.pairIndex] = true;
      chosen.push(edge);
      search();
      chosen.pop();
      usedPairs[edge.pairIndex] = false;
      covered[edge.first] = false;
      covered[edge.second] = false;
      if (count >= limit) return;
    }
  };

  search();
  const capped = count >= limit;
  return Object.freeze({
    count,
    unique: count === 1 && !capped,
    capped,
    solution: Object.freeze(firstSolution ?? []),
  });
}

export function createPosition(source = {}) {
  return Object.freeze({
    rooms: new Set(source.rooms ?? []),
    excluded: new Set(source.excluded ?? []),
  });
}

export function positionToJSON(position = {}) {
  return Object.freeze({
    rooms: Object.freeze([...new Set(position.rooms ?? [])].sort()),
    excluded: Object.freeze([...new Set(position.excluded ?? [])].sort()),
  });
}

export function parsePosition(puzzle, value) {
  if (!value || typeof value !== "object") return null;
  let rooms;
  let excluded;
  try {
    rooms = canonicalEdgeSet(puzzle, value.rooms, "Room set");
    excluded = canonicalEdgeSet(puzzle, value.excluded, "Excluded set");
  } catch {
    return null;
  }
  if ([...rooms].some((key) => excluded.has(key))) return null;
  const occupied = new Set();
  for (const key of rooms) {
    const edge = puzzle.edgeMap.get(key);
    if (occupied.has(edge.first) || occupied.has(edge.second)) return null;
    occupied.add(edge.first);
    occupied.add(edge.second);
  }
  for (const key of excluded) {
    const edge = puzzle.edgeMap.get(key);
    if (occupied.has(edge.first) || occupied.has(edge.second)) return null;
  }
  return createPosition({ rooms, excluded });
}

export function analyzePosition(puzzle, position = {}) {
  const rooms = new Set(position.rooms ?? []);
  const excluded = new Set(position.excluded ?? []);
  const occupiedBy = new Map();
  const roomsByPair = new Map(puzzle.pairKeys.map((key) => [key, []]));
  const illegalEdges = [];
  const overlaps = new Set();

  for (const key of rooms) {
    const edge = puzzle.edgeMap.get(key);
    if (!edge) {
      illegalEdges.push(key);
      continue;
    }
    for (const cell of [edge.first, edge.second]) {
      if (occupiedBy.has(cell)) {
        overlaps.add(key);
        overlaps.add(occupiedBy.get(cell));
      } else occupiedBy.set(cell, key);
    }
    roomsByPair.get(edge.pairKey).push(key);
  }

  const invalidExclusions = [];
  for (const key of excluded) {
    const edge = puzzle.edgeMap.get(key);
    if (!edge || rooms.has(key) || occupiedBy.has(edge?.first) || occupiedBy.has(edge?.second)) invalidExclusions.push(key);
  }
  const duplicatePairKeys = puzzle.pairKeys.filter((key) => roomsByPair.get(key).length > 1);
  const duplicateRooms = new Set(duplicatePairKeys.flatMap((key) => roomsByPair.get(key)));
  const usedPairKeys = puzzle.pairKeys.filter((key) => roomsByPair.get(key).length > 0);
  const missingPairKeys = puzzle.pairKeys.filter((key) => roomsByPair.get(key).length === 0);
  const legalState = illegalEdges.length === 0 && overlaps.size === 0 && invalidExclusions.length === 0;
  const coveredCount = occupiedBy.size;
  const complete = legalState
    && rooms.size === puzzle.dominoCount
    && coveredCount === puzzle.cellCount
    && usedPairKeys.length === puzzle.dominoCount
    && duplicatePairKeys.length === 0;

  return Object.freeze({
    complete,
    legalState,
    roomCount: rooms.size,
    coveredCount,
    usedPairCount: usedPairKeys.length,
    exclusionCount: excluded.size,
    usedPairKeys: Object.freeze(usedPairKeys),
    missingPairKeys: Object.freeze(missingPairKeys),
    duplicatePairKeys: Object.freeze(duplicatePairKeys),
    duplicateRooms,
    roomsByPair,
    occupiedBy,
    overlaps,
    illegalEdges: Object.freeze(illegalEdges),
    invalidExclusions: Object.freeze(invalidExclusions),
  });
}

export function applyEdgeAction(puzzle, position, key, action) {
  const target = puzzle.edgeMap.get(key);
  if (!target) return Object.freeze({ accepted: false, reason: "invalid-edge", position });
  if (![EDGE_ACTION.ROOM, EDGE_ACTION.EXCLUDE].includes(action)) {
    return Object.freeze({ accepted: false, reason: "invalid-action", position });
  }
  const rooms = new Set(position.rooms ?? []);
  const excluded = new Set(position.excluded ?? []);

  if (action === EDGE_ACTION.EXCLUDE) {
    const occupied = analyzePosition(puzzle, { rooms, excluded }).occupiedBy;
    if (occupied.has(target.first) || occupied.has(target.second)) {
      return Object.freeze({ accepted: false, reason: "occupied", position });
    }
    const removed = excluded.delete(key);
    if (!removed) excluded.add(key);
    return Object.freeze({
      accepted: true,
      effect: removed ? "exclusion-removed" : "exclusion-added",
      removedRooms: Object.freeze([]),
      removedExclusions: Object.freeze([]),
      duplicateIntroduced: false,
      position: createPosition({ rooms, excluded }),
    });
  }

  if (rooms.has(key)) {
    rooms.delete(key);
    return Object.freeze({
      accepted: true,
      effect: "room-removed",
      removedRooms: Object.freeze([key]),
      removedExclusions: Object.freeze([]),
      duplicateIntroduced: false,
      position: createPosition({ rooms, excluded }),
    });
  }

  const endpointSet = new Set([target.first, target.second]);
  const removedRooms = [];
  for (const roomKey of [...rooms]) {
    const room = puzzle.edgeMap.get(roomKey);
    if (endpointSet.has(room.first) || endpointSet.has(room.second)) {
      rooms.delete(roomKey);
      removedRooms.push(roomKey);
    }
  }
  const removedExclusions = [];
  for (const excludedKey of [...excluded]) {
    const edge = puzzle.edgeMap.get(excludedKey);
    if (endpointSet.has(edge.first) || endpointSet.has(edge.second)) {
      excluded.delete(excludedKey);
      removedExclusions.push(excludedKey);
    }
  }
  rooms.add(key);
  const nextPosition = createPosition({ rooms, excluded });
  const analysis = analyzePosition(puzzle, nextPosition);
  return Object.freeze({
    accepted: true,
    effect: "room-added",
    removedRooms: Object.freeze(removedRooms.sort()),
    removedExclusions: Object.freeze(removedExclusions.sort()),
    duplicateIntroduced: analysis.roomsByPair.get(target.pairKey).length > 1,
    position: nextPosition,
  });
}

export function toggleHighlight(current, value, order) {
  if (!Number.isInteger(value) || value < 0 || value > order) return Object.freeze([...current]);
  const next = [...new Set(current)].filter((item) => Number.isInteger(item) && item >= 0 && item <= order).slice(0, 2);
  const index = next.indexOf(value);
  if (index >= 0) next.splice(index, 1);
  else if (next.length < 2) next.push(value);
  return Object.freeze(next);
}

export function seedFromString(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function randomTiling(width, height, random) {
  const cellCount = width * height;
  const occupied = Array.from({ length: cellCount }, () => false);
  const placed = [];

  const search = () => {
    let first = -1;
    let bestNeighbours = null;
    for (let cell = 0; cell < cellCount; cell += 1) {
      if (occupied[cell]) continue;
      const { row, column } = coordinatesOf(cell, width);
      const neighbours = [];
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = row + dr;
        const nc = column + dc;
        if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
        const other = cellIndex(nr, nc, width);
        if (!occupied[other]) neighbours.push(other);
      }
      if (bestNeighbours === null || neighbours.length < bestNeighbours.length) {
        first = cell;
        bestNeighbours = neighbours;
      }
      if (neighbours.length <= 1) break;
    }
    if (first === -1) return true;
    if (!bestNeighbours?.length) return false;
    for (const other of shuffle(bestNeighbours, random)) {
      occupied[first] = true;
      occupied[other] = true;
      placed.push([Math.min(first, other), Math.max(first, other)]);
      if (search()) return true;
      placed.pop();
      occupied[first] = false;
      occupied[other] = false;
    }
    return false;
  };

  if (!search()) throw new Error("Unable to construct a full rectangular tiling.");
  return placed;
}

function mixedAttemptSeed(seed, attempt) {
  let value = (seed ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function candidateNumbers(order, seed) {
  const { width, height, cellCount } = dimensionsForOrder(order);
  const random = mulberry32(seed);
  const tiling = randomTiling(width, height, random);
  const pairs = [];
  for (let high = 0; high <= order; high += 1) {
    for (let low = 0; low <= high; low += 1) pairs.push([low, high]);
  }
  const shuffledPairs = shuffle(pairs, random);
  const numbers = Array.from({ length: cellCount }, () => -1);
  for (let index = 0; index < tiling.length; index += 1) {
    const [first, second] = tiling[index];
    const pair = shuffledPairs[index];
    const flip = random() < 0.5;
    numbers[first] = pair[flip ? 1 : 0];
    numbers[second] = pair[flip ? 0 : 1];
  }
  return Object.freeze({ numbers: Object.freeze(numbers), witness: Object.freeze(tiling.map(([a, b]) => `${a}:${b}`).sort()) });
}

const TITLE_OPENERS = Object.freeze(["青灯", "雨歇", "狐火", "月见", "纸门", "风铃", "薄雾", "星落"]);
const TITLE_ENDINGS = Object.freeze(["东廊", "客舍", "暖阁", "汤庭", "花院", "夜馆", "回廊", "别院"]);

export function titleForSeed(seed) {
  const first = TITLE_OPENERS[seed % TITLE_OPENERS.length];
  const second = TITLE_ENDINGS[(seed >>> 5) % TITLE_ENDINGS.length];
  return `${first}${second}`;
}

export function generatePuzzle(order, seedInput, options = {}) {
  dimensionsForOrder(order);
  const seed = typeof seedInput === "number" && Number.isInteger(seedInput)
    ? seedInput >>> 0
    : seedFromString(seedInput);
  const ensureUnique = options.ensureUnique !== false;
  const maxAttempts = options.maxAttempts === undefined ? 1200 : Number(options.maxAttempts);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10000) throw new TypeError("maxAttempts must be an integer from 1 to 10000.");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptSeed = mixedAttemptSeed(seed, attempt);
    const candidate = candidateNumbers(order, attemptSeed);
    const puzzle = createPuzzle({
      id: `yokai-inn:g${ENGINE_VERSION}:o${order}:${ensureUnique ? "u" : "a"}:${seed.toString(36)}:a${attempt}`,
      order,
      seed,
      attempt,
      ensureUnique,
      title: titleForSeed(attemptSeed),
      numbers: candidate.numbers,
    });
    const proof = solvePuzzle(puzzle, { limit: 2 });
    if (proof.count < 1) throw new Error("Generator produced a grid without its construction witness.");
    if (ensureUnique && !proof.unique) continue;
    return Object.freeze({
      ...puzzle,
      witness: candidate.witness,
      solution: proof.solution,
      solutionCount: proof.count,
      uniquenessProven: proof.unique,
      solutionCountCapped: proof.capped,
    });
  }
  throw new Error(`Unable to generate an order ${order} ${ensureUnique ? "unique " : ""}puzzle within ${maxAttempts} attempts.`);
}

export function verifyGeneratedPuzzle(puzzle) {
  const proof = solvePuzzle(puzzle, { limit: 2 });
  const witnessAnalysis = analyzePosition(puzzle, { rooms: new Set(puzzle.witness ?? []), excluded: new Set() });
  const solutionAnalysis = analyzePosition(puzzle, { rooms: new Set(puzzle.solution ?? []), excluded: new Set() });
  return Object.freeze({
    legalWitness: witnessAnalysis.complete,
    legalStoredSolution: solutionAnalysis.complete,
    hasSolution: proof.count >= 1,
    unique: proof.unique,
    count: proof.count,
    valid: witnessAnalysis.complete && solutionAnalysis.complete && proof.count >= 1 && (!puzzle.ensureUnique || proof.unique),
  });
}
