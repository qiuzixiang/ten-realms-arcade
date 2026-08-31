/**
 * Storm Lanterns / Net rules engine.
 *
 * A board is a rectangular collection of non-empty cable modules. Each
 * module is a four-bit mask (N/E/S/W). Rotating a module never changes its
 * shape. A solved board has no connector pointing at the border or at an
 * unmatching neighbour, every module is reachable from the lighthouse, and
 * the resulting undirected graph contains no cycle.
 *
 * This module deliberately has no DOM, timers, audio, or storage side effects.
 */

export const SAVE_SCHEMA = "storm-lanterns/net";
export const SAVE_VERSION = 1;

export const PORT = Object.freeze({
  N: 1,
  E: 2,
  S: 4,
  W: 8,
});

export const DIRECTIONS = Object.freeze([
  Object.freeze({ name: "N", bit: PORT.N, opposite: PORT.S, row: -1, column: 0 }),
  Object.freeze({ name: "E", bit: PORT.E, opposite: PORT.W, row: 0, column: 1 }),
  Object.freeze({ name: "S", bit: PORT.S, opposite: PORT.N, row: 1, column: 0 }),
  Object.freeze({ name: "W", bit: PORT.W, opposite: PORT.E, row: 0, column: -1 }),
]);

export const STATUS = Object.freeze({
  PLAYING: "playing",
  WON: "won",
});

export const DIFFICULTIES = Object.freeze([
  Object.freeze({
    id: "easy",
    label: "近岸 · 微澜",
    width: 5,
    height: 5,
    description: "五乘五航标阵，适合熟悉接头与边界。",
  }),
  Object.freeze({
    id: "medium",
    label: "外海 · 疾风",
    width: 6,
    height: 6,
    description: "六乘六航标阵，支路更长、分岔更多。",
  }),
  Object.freeze({
    id: "hard",
    label: "风眼 · 雷暴",
    width: 7,
    height: 7,
    description: "七乘七航标阵，需要同时约束边界、树枝与回路。",
  }),
]);

const DIFFICULTY_IDS = new Set(DIFFICULTIES.map((difficulty) => difficulty.id));
const FULL_MASK = PORT.N | PORT.E | PORT.S | PORT.W;

function assertDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError("Board width and height must be positive integers.");
  }
  if (width * height < 2) {
    throw new RangeError("A Net board must contain at least two modules.");
  }
}

function assertMask(mask) {
  if (!Number.isInteger(mask) || mask < 1 || mask > FULL_MASK) {
    throw new RangeError(`Cable mask must be an integer from 1 to ${FULL_MASK}.`);
  }
}

function flattenMasks(value) {
  if (!Array.isArray(value)) {
    throw new TypeError("Cable orientations must be an array.");
  }
  return value.flatMap((row) => (Array.isArray(row) ? row : [row]));
}

function normalizeMasks(width, height, masks) {
  const flat = flattenMasks(masks);
  if (flat.length !== width * height) {
    throw new RangeError(`Expected ${width * height} cable masks, received ${flat.length}.`);
  }
  for (const mask of flat) assertMask(mask);
  return flat;
}

function boardDimensions(board) {
  if (!board || typeof board !== "object") {
    throw new TypeError("Board must be an object with width and height.");
  }
  const { width, height } = board;
  assertDimensions(width, height);
  return { width, height, total: width * height };
}

export function keyOf(row, column) {
  return `${row}:${column}`;
}

export function pointFromKey(key) {
  const match = /^(\d+):(\d+)$/.exec(String(key));
  if (!match) return null;
  return { row: Number(match[1]), column: Number(match[2]) };
}

export function inBounds(board, row, column) {
  if (!board || !Number.isInteger(row) || !Number.isInteger(column)) return false;
  return row >= 0 && column >= 0 && row < board.height && column < board.width;
}

export function indexOf(board, row, column) {
  return inBounds(board, row, column) ? row * board.width + column : -1;
}

export function pointOf(board, index) {
  const total = Number.isInteger(board?.width) && Number.isInteger(board?.height)
    ? board.width * board.height
    : 0;
  if (!Number.isInteger(index) || index < 0 || index >= total) return null;
  return { row: Math.floor(index / board.width), column: index % board.width };
}

export function resolveCell(board, target, column) {
  if (Number.isInteger(target) && column === undefined) {
    return pointOf(board, target) ? target : -1;
  }
  if (Number.isInteger(target) && Number.isInteger(column)) {
    return indexOf(board, target, column);
  }
  if (typeof target === "string") {
    const point = pointFromKey(target);
    return point ? indexOf(board, point.row, point.column) : -1;
  }
  if (target && typeof target === "object") {
    if (Number.isInteger(target.index)) return resolveCell(board, target.index);
    return indexOf(board, target.row, target.column);
  }
  return -1;
}

export function rotateMask(mask, turns = 1) {
  assertMask(mask);
  if (!Number.isInteger(turns)) throw new TypeError("Rotation turns must be an integer.");
  let result = mask;
  const normalized = ((turns % 4) + 4) % 4;
  for (let turn = 0; turn < normalized; turn += 1) {
    result = ((result << 1) & FULL_MASK) | ((result & PORT.W) >> 3);
  }
  return result;
}

export function hasPort(mask, direction) {
  assertMask(mask);
  const bit = typeof direction === "string"
    ? DIRECTIONS.find((item) => item.name === direction.toUpperCase())?.bit
    : direction;
  return Number.isInteger(bit) && (mask & bit) !== 0;
}

export function portsFor(mask) {
  assertMask(mask);
  return DIRECTIONS.filter((direction) => (mask & direction.bit) !== 0)
    .map((direction) => direction.name);
}

export function degreeOf(mask) {
  assertMask(mask);
  let count = 0;
  for (const direction of DIRECTIONS) {
    if ((mask & direction.bit) !== 0) count += 1;
  }
  return count;
}

export function rotationPeriod(mask) {
  assertMask(mask);
  for (let turns = 1; turns <= 4; turns += 1) {
    if (rotateMask(mask, turns) === mask) return turns;
  }
  return 4;
}

export function canonicalShape(mask) {
  assertMask(mask);
  return Math.min(mask, rotateMask(mask, 1), rotateMask(mask, 2), rotateMask(mask, 3));
}

export function sameShape(first, second) {
  return canonicalShape(first) === canonicalShape(second);
}

export function moduleShape(mask) {
  const degree = degreeOf(mask);
  if (degree === 1) return "end";
  if (degree === 2) return (mask === (PORT.N | PORT.S) || mask === (PORT.E | PORT.W))
    ? "straight"
    : "corner";
  if (degree === 3) return "tee";
  return "cross";
}

/**
 * Evaluate the complete Net rule set. Reachability follows reciprocal cable
 * connections only; an unmatched connector never carries lighthouse energy.
 */
export function evaluateNetwork(board, masksInput, lighthouse = undefined) {
  const { width, height, total } = boardDimensions(board);
  const fallbackMasks = board.orientations ?? board.initial ?? board.solution;
  const masks = normalizeMasks(width, height, masksInput ?? fallbackMasks);
  const defaultRoot = Number.isInteger(board.lighthouseIndex)
    ? board.lighthouseIndex
    : indexOf(board, Math.floor(height / 2), Math.floor(width / 2));
  const rootIndex = lighthouse === undefined ? defaultRoot : resolveCell(board, lighthouse);
  if (rootIndex < 0 || rootIndex >= total) {
    throw new RangeError("Lighthouse must identify a cell inside the board.");
  }

  const adjacency = Array.from({ length: total }, () => []);
  const edges = [];
  const dangling = [];

  for (let index = 0; index < total; index += 1) {
    const point = pointOf(board, index);
    for (const direction of DIRECTIONS) {
      if ((masks[index] & direction.bit) === 0) continue;
      const nextRow = point.row + direction.row;
      const nextColumn = point.column + direction.column;
      const neighbour = indexOf(board, nextRow, nextColumn);
      if (neighbour < 0) {
        dangling.push(Object.freeze({
          index,
          row: point.row,
          column: point.column,
          direction: direction.name,
          reason: "border",
          neighbour: null,
        }));
        continue;
      }
      if ((masks[neighbour] & direction.opposite) === 0) {
        dangling.push(Object.freeze({
          index,
          row: point.row,
          column: point.column,
          direction: direction.name,
          reason: "mismatch",
          neighbour,
        }));
        continue;
      }
      if (index < neighbour) {
        adjacency[index].push(neighbour);
        adjacency[neighbour].push(index);
        edges.push(Object.freeze([index, neighbour]));
      }
    }
  }

  const reachable = new Set([rootIndex]);
  const frontier = [rootIndex];
  for (let cursor = 0; cursor < frontier.length; cursor += 1) {
    for (const neighbour of adjacency[frontier[cursor]]) {
      if (reachable.has(neighbour)) continue;
      reachable.add(neighbour);
      frontier.push(neighbour);
    }
  }

  let components = 0;
  const seen = new Set();
  for (let start = 0; start < total; start += 1) {
    if (seen.has(start)) continue;
    components += 1;
    seen.add(start);
    const queue = [start];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const neighbour of adjacency[queue[cursor]]) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
  }

  // For an undirected simple graph, E - V + components is the independent
  // cycle count. Reciprocal neighbour pairs are added exactly once above.
  const cycleCount = edges.length - total + components;
  const hasCycle = cycleCount > 0;
  const allConnected = reachable.size === total;
  const portsComplete = dangling.length === 0;
  const solved = portsComplete && allConnected && !hasCycle;
  const unreachable = new Set(
    Array.from({ length: total }, (_, index) => index).filter((index) => !reachable.has(index)),
  );
  const danglingCells = new Set(dangling.map((connector) => connector.index));

  return {
    solved,
    complete: solved,
    allConnected,
    connected: allConnected,
    portsComplete,
    acyclic: !hasCycle,
    hasCycle,
    cycleCount,
    components,
    edgeCount: edges.length,
    edges: Object.freeze(edges),
    adjacency: Object.freeze(adjacency.map((neighbours) => Object.freeze([...neighbours]))),
    dangling: Object.freeze(dangling),
    danglingCells,
    reachable,
    powered: reachable,
    unreachable,
    reachableCount: reachable.size,
    total,
    rootIndex,
  };
}

export function reachableFromLighthouse(board, masks, lighthouse = undefined) {
  return evaluateNetwork(board, masks, lighthouse).reachable;
}

export function isSolved(boardOrGame, masks = undefined) {
  if (masks === undefined && boardOrGame?.evaluation?.solved !== undefined) {
    return boardOrGame.evaluation.solved;
  }
  return evaluateNetwork(boardOrGame, masks).solved;
}

export function maskAt(board, masks, row, column) {
  const index = indexOf(board, row, column);
  if (index < 0) return null;
  return normalizeMasks(board.width, board.height, masks)[index];
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

function seededRandom(seed) {
  let value = hashSeed(seed);
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/** Generate a deterministic spanning tree before any tile is scrambled. */
export function generateSolvedNetwork(width, height, seed = 1, start = undefined) {
  assertDimensions(width, height);
  const board = { width, height };
  const total = width * height;
  if (start !== undefined && resolveCell(board, start) < 0) {
    throw new RangeError("Tree start must be inside the board.");
  }

  // The upstream Net generator deliberately avoids degree-four crosses: they
  // are rotationally fixed and add no decision. Capping degree at three can
  // occasionally strand an unvisited pocket, so retry with a derived seed.
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const random = seededRandom(`tree:${seed}:${attempt}`);
    const startIndex = start === undefined
      ? Math.floor(random() * total)
      : resolveCell(board, start);
    const masks = Array(total).fill(0);
    const visited = new Set([startIndex]);
    const stack = [startIndex];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const point = pointOf(board, current);
      const currentDegree = DIRECTIONS.filter(
        (direction) => (masks[current] & direction.bit) !== 0,
      ).length;
      const candidates = currentDegree >= 3
        ? []
        : shuffled(DIRECTIONS, random).flatMap((direction) => {
          const neighbour = indexOf(
            board,
            point.row + direction.row,
            point.column + direction.column,
          );
          return neighbour >= 0 && !visited.has(neighbour)
            ? [{ direction, neighbour }]
            : [];
        });

      if (candidates.length === 0) {
        stack.pop();
        continue;
      }

      const { direction, neighbour } = candidates[0];
      masks[current] |= direction.bit;
      masks[neighbour] |= direction.opposite;
      visited.add(neighbour);
      stack.push(neighbour);
    }

    if (visited.size !== total || masks.some((mask) => mask === 0 || degreeOf(mask) > 3)) {
      continue;
    }
    const result = Object.freeze([...masks]);
    const evaluation = evaluateNetwork(
      { width, height, lighthouseIndex: Math.floor(total / 2) },
      result,
    );
    if (evaluation.solved && evaluation.edgeCount === total - 1) return result;
  }
  throw new Error("Internal tree generator could not produce a cross-free spanning tree.");
}

/** Preserve every module shape while deterministically changing orientations. */
export function scrambleNetwork(solutionInput, seed = 1) {
  const solution = flattenMasks(solutionInput);
  for (const mask of solution) assertMask(mask);
  const random = seededRandom(`scramble:${seed}`);
  const turns = solution.map((mask) => {
    const period = rotationPeriod(mask);
    if (period === 1) return 0;
    // Deliberately choose a non-solution orientation for every turnable tile.
    return 1 + Math.floor(random() * (period - 1));
  });
  const masks = solution.map((mask, index) => rotateMask(mask, turns[index]));
  return Object.freeze({
    masks: Object.freeze(masks),
    turns: Object.freeze(turns),
  });
}

export function orientationOptions(mask) {
  assertMask(mask);
  return Object.freeze([...new Set([
    mask,
    rotateMask(mask, 1),
    rotateMask(mask, 2),
    rotateMask(mask, 3),
  ])]);
}

function propagateOrientationDomains(board, domains) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < domains.length; index += 1) {
      const point = pointOf(board, index);
      const remaining = domains[index].filter((mask) => DIRECTIONS.every((direction) => {
        const neighbour = indexOf(
          board,
          point.row + direction.row,
          point.column + direction.column,
        );
        const connects = (mask & direction.bit) !== 0;
        if (neighbour < 0) return !connects;
        return domains[neighbour].some(
          (neighbourMask) => connects === ((neighbourMask & direction.opposite) !== 0),
        );
      }));
      if (remaining.length === 0) return false;
      if (remaining.length !== domains[index].length) {
        domains[index] = remaining;
        changed = true;
      }
    }
  }

  // If even the over-approximation containing every still-possible reciprocal
  // edge is disconnected, no refinement of these domains can span the board.
  const potentiallyReachable = new Set([0]);
  const queue = [0];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const point = pointOf(board, index);
    for (const direction of DIRECTIONS) {
      const neighbour = indexOf(
        board,
        point.row + direction.row,
        point.column + direction.column,
      );
      if (neighbour < 0 || potentiallyReachable.has(neighbour)) continue;
      const possible = domains[index].some((mask) => (
        (mask & direction.bit) !== 0
        && domains[neighbour].some((other) => (other & direction.opposite) !== 0)
      ));
      if (!possible) continue;
      potentiallyReachable.add(neighbour);
      queue.push(neighbour);
    }
  }
  return potentiallyReachable.size === domains.length;
}

/**
 * Enumerate legal orientations for a fixed collection of module shapes.
 * Constraint propagation enforces closed borders and reciprocal connectors;
 * complete candidates are then checked for whole-board connectivity and loops.
 */
export function solveNetwork(board, shapesInput, options = {}) {
  const { width, height, total } = boardDimensions(board);
  const shapes = normalizeMasks(width, height, shapesInput);
  const limit = typeof options === "number" ? options : (options.limit ?? 1);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Solution limit must be a positive integer.");
  }
  const solutions = [];

  function search(inputDomains) {
    if (solutions.length >= limit) return;
    const domains = inputDomains.map((domain) => [...domain]);
    if (!propagateOrientationDomains(board, domains)) return;

    let branchIndex = -1;
    let branchSize = Infinity;
    for (let index = 0; index < total; index += 1) {
      if (domains[index].length > 1 && domains[index].length < branchSize) {
        branchIndex = index;
        branchSize = domains[index].length;
      }
    }
    if (branchIndex < 0) {
      const candidate = domains.map((domain) => domain[0]);
      if (evaluateNetwork(board, candidate).solved) {
        solutions.push(Object.freeze(candidate));
      }
      return;
    }

    for (const mask of domains[branchIndex]) {
      const branch = domains.map((domain) => [...domain]);
      branch[branchIndex] = [mask];
      search(branch);
      if (solutions.length >= limit) return;
    }
  }

  search(shapes.map(orientationOptions));
  return Object.freeze(solutions);
}

export function countNetworkSolutions(board, shapes, limit = 2) {
  return solveNetwork(board, shapes, { limit }).length;
}

function rotationFromTo(from, to) {
  for (let turns = 0; turns < 4; turns += 1) {
    if (rotateMask(from, turns) === to) return turns;
  }
  return -1;
}

export function createLevel(definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("Level definition must be an object.");
  }
  const { id, name, difficulty, width, height } = definition;
  if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) {
    throw new TypeError("Level id must use lowercase letters, numbers, and hyphens.");
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new TypeError("Level name must be a non-empty string.");
  }
  if (!DIFFICULTY_IDS.has(difficulty)) {
    throw new RangeError(`Unknown difficulty: ${difficulty}`);
  }
  assertDimensions(width, height);

  const solution = normalizeMasks(width, height, definition.solution);
  const initial = normalizeMasks(width, height, definition.initial);
  const board = { width, height };
  const defaultLighthouse = {
    row: Math.floor(height / 2),
    column: Math.floor(width / 2),
  };
  const lighthouseIndex = resolveCell(
    board,
    definition.lighthouse ?? definition.lighthouseIndex ?? defaultLighthouse,
  );
  if (lighthouseIndex < 0) throw new RangeError("Lighthouse must be inside the level board.");

  for (let index = 0; index < solution.length; index += 1) {
    if (!sameShape(solution[index], initial[index])) {
      throw new RangeError(`Initial module ${index} does not match its solution shape.`);
    }
  }

  const evaluationBoard = { width, height, lighthouseIndex };
  const solutionEvaluation = evaluateNetwork(evaluationBoard, solution);
  if (!solutionEvaluation.solved) {
    throw new RangeError("A level solution must be connected, reciprocal, border-safe, and acyclic.");
  }
  if (definition.unique === true && countNetworkSolutions(evaluationBoard, solution, 2) !== 1) {
    throw new RangeError("A level marked unique must have exactly one legal orientation.");
  }
  const initialEvaluation = evaluateNetwork(evaluationBoard, initial);
  if (initialEvaluation.solved) {
    throw new RangeError("A level must not begin already solved.");
  }

  const lighthouse = Object.freeze(pointOf(board, lighthouseIndex));
  const scrambleTurns = initial.map((mask, index) => rotationFromTo(solution[index], mask));
  return Object.freeze({
    id,
    name: name.trim(),
    difficulty,
    difficultyLabel: DIFFICULTIES.find((item) => item.id === difficulty).label,
    briefing: typeof definition.briefing === "string" ? definition.briefing : "",
    width,
    height,
    total: width * height,
    seed: String(definition.seed ?? id),
    lighthouse,
    lighthouseIndex,
    solution: Object.freeze(solution),
    initial: Object.freeze(initial),
    scrambleTurns: Object.freeze(scrambleTurns),
    unique: definition.unique === true,
    referenceTurns: scrambleTurns.reduce((sum, turns, index) => {
      const period = rotationPeriod(solution[index]);
      return sum + Math.min(turns, period - turns);
    }, 0),
  });
}

function buildGeneratedLevel(definition) {
  const lighthouse = {
    row: Math.floor(definition.height / 2),
    column: Math.floor(definition.width / 2),
  };
  const board = {
    width: definition.width,
    height: definition.height,
    lighthouseIndex: indexOf(definition, lighthouse.row, lighthouse.column),
  };

  let solution = null;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = generateSolvedNetwork(
      definition.width,
      definition.height,
      attempt === 0 ? definition.seed : `${definition.seed}:topology:${attempt}`,
      lighthouse,
    );
    if (countNetworkSolutions(board, candidate, 2) === 1) {
      solution = candidate;
      break;
    }
  }
  if (!solution) throw new Error(`Unable to generate a unique level ${definition.id}.`);

  let scrambled = null;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = scrambleNetwork(solution, `${definition.seed}:${attempt}`);
    const evaluation = evaluateNetwork(board, candidate.masks);
    if (!evaluation.solved && !evaluation.hasCycle && evaluation.dangling.length > 0) {
      scrambled = candidate;
      break;
    }
  }
  if (!scrambled) throw new Error(`Unable to scramble generated level ${definition.id}.`);

  return createLevel({
    ...definition,
    lighthouse,
    solution,
    initial: scrambled.masks,
    unique: true,
  });
}

const LEVEL_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "harbour-whisper",
    name: "港湾初鸣",
    difficulty: "easy",
    width: 5,
    height: 5,
    seed: "salt-013",
    briefing: "从主灯塔辨认最短的近岸支路，让沉睡航标依次亮起。",
  }),
  Object.freeze({
    id: "gull-channel",
    name: "鸥影水道",
    difficulty: "easy",
    width: 5,
    height: 5,
    seed: "gull-127",
    briefing: "沿礁岸收好每个电缆接头，别让能量坠入海面。",
  }),
  Object.freeze({
    id: "moonlit-pier",
    name: "月栈回声",
    difficulty: "easy",
    width: 5,
    height: 5,
    seed: "moon-241",
    briefing: "月色会照亮假方向，只有相互咬合的线路才能传能。",
  }),
  Object.freeze({
    id: "squall-belt",
    name: "飑线外缘",
    difficulty: "medium",
    width: 6,
    height: 6,
    seed: "squall-359",
    briefing: "疾风切开航路，先用边界排除向外伸出的错误接头。",
  }),
  Object.freeze({
    id: "thunder-shelf",
    name: "雷架暗潮",
    difficulty: "medium",
    width: 6,
    height: 6,
    seed: "thunder-467",
    briefing: "分岔深入雨幕；每点亮一段，都要确认它没有闭合成环。",
  }),
  Object.freeze({
    id: "black-current",
    name: "墨流浮标",
    difficulty: "medium",
    width: 6,
    height: 6,
    seed: "current-571",
    briefing: "黑潮吞没远处的灯，循着主灯塔真正可达的暖光推进。",
  }),
  Object.freeze({
    id: "eye-of-tempest",
    name: "风眼列灯",
    difficulty: "hard",
    width: 7,
    height: 7,
    seed: "tempest-683",
    briefing: "七重风墙环绕主灯塔，整张电网只能是一棵无环之树。",
  }),
  Object.freeze({
    id: "leviathan-wake",
    name: "鲸脊雷痕",
    difficulty: "hard",
    width: 7,
    height: 7,
    seed: "wake-797",
    briefing: "长支路像鲸脊潜入云下，孤立小网不会获得灯塔能量。",
  }),
  Object.freeze({
    id: "last-beacon",
    name: "终夜群岬",
    difficulty: "hard",
    width: 7,
    height: 7,
    seed: "beacon-887",
    briefing: "雷暴最深处，每个航标、每根线缆、每处边界都必须吻合。",
  }),
]);

export const LEVELS = Object.freeze(LEVEL_DEFINITIONS.map(buildGeneratedLevel));

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function findLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function validateLevel(level) {
  const errors = [];
  if (!level || typeof level !== "object") {
    return { valid: false, errors: ["not-a-level"], solution: null, initial: null };
  }
  let solution = null;
  let initial = null;
  try {
    solution = evaluateNetwork(level, level.solution);
    if (!solution.solved) errors.push("illegal-solution");
    if (solution.edgeCount !== level.width * level.height - 1) errors.push("solution-not-a-tree");
  } catch {
    errors.push("invalid-solution-data");
  }
  try {
    initial = evaluateNetwork(level, level.initial);
    if (initial.solved) errors.push("initial-already-solved");
  } catch {
    errors.push("invalid-initial-data");
  }
  if (solution && initial) {
    for (let index = 0; index < solution.total; index += 1) {
      if (!sameShape(level.solution[index], level.initial[index])) {
        errors.push(`shape-changed:${index}`);
      }
    }
    if (level.unique === true && countNetworkSolutions(level, level.solution, 2) !== 1) {
      errors.push("solution-not-unique");
    }
  }
  return { valid: errors.length === 0, errors, solution, initial };
}

function normalizeLocks(level, value) {
  const locked = Array(level.total).fill(false);
  if (value === undefined || value === null) return locked;
  if (Array.isArray(value) && value.length === level.total && value.every((item) => typeof item === "boolean")) {
    return [...value];
  }
  if (typeof value === "string" || typeof value[Symbol.iterator] !== "function") {
    throw new TypeError("Locked cells must be a boolean array or iterable of cells.");
  }
  for (const target of value) {
    const index = resolveCell(level, target);
    if (index < 0) throw new RangeError("A locked cell lies outside the board.");
    locked[index] = true;
  }
  return locked;
}

function makeGame(level, orientationsInput, lockedInput, moves) {
  const orientations = normalizeMasks(level.width, level.height, orientationsInput);
  for (let index = 0; index < level.total; index += 1) {
    if (!sameShape(level.solution[index], orientations[index])) {
      throw new RangeError(`Game module ${index} changed shape.`);
    }
  }
  const locked = normalizeLocks(level, lockedInput);
  if (!Number.isInteger(moves) || moves < 0) throw new RangeError("Move count must be non-negative.");
  const evaluation = evaluateNetwork(level, orientations);
  return Object.freeze({
    level,
    levelId: level.id,
    orientations: Object.freeze(orientations),
    locked: Object.freeze(locked),
    moves,
    status: evaluation.solved ? STATUS.WON : STATUS.PLAYING,
    evaluation,
  });
}

export function createGame(levelOrId = LEVELS[0], options = {}) {
  const level = typeof levelOrId === "string" ? findLevel(levelOrId) : levelOrId;
  if (!level) throw new RangeError(`Unknown level: ${levelOrId}`);
  return makeGame(
    level,
    options.orientations ?? level.initial,
    options.locked,
    options.moves ?? 0,
  );
}

function rejected(game, reason) {
  return { accepted: false, reason, state: game, evaluation: game.evaluation };
}

export function applyAction(game, action = {}) {
  if (!game?.level || !Array.isArray(game.orientations) || !Array.isArray(game.locked)) {
    throw new TypeError("Action requires a game created by createGame().");
  }
  const index = resolveCell(
    game.level,
    action.index ?? (action.key !== undefined ? action.key : action),
  );
  if (index < 0) return rejected(game, "outside-board");

  if (action.type === "toggle-lock" || action.type === "lock") {
    const locked = [...game.locked];
    locked[index] = !locked[index];
    const state = makeGame(game.level, game.orientations, locked, game.moves);
    return {
      accepted: true,
      effect: locked[index] ? "locked" : "unlocked",
      index,
      state,
      evaluation: state.evaluation,
    };
  }

  const isRotation = action.type === "rotate"
    || action.type === "rotate-clockwise"
    || action.type === "rotate-counterclockwise";
  if (!isRotation) return rejected(game, "unknown-action");
  if (game.status === STATUS.WON) return rejected(game, "complete");
  if (game.locked[index]) return rejected(game, "locked");

  const turns = action.type === "rotate-counterclockwise"
    ? -1
    : action.type === "rotate-clockwise"
      ? 1
      : (action.turns ?? 1);
  if (!Number.isInteger(turns)) return rejected(game, "invalid-turns");
  const normalized = ((turns % 4) + 4) % 4;
  if (normalized === 0) return rejected(game, "no-op");
  const nextMask = rotateMask(game.orientations[index], turns);
  if (nextMask === game.orientations[index]) return rejected(game, "fixed-shape");

  const orientations = [...game.orientations];
  orientations[index] = nextMask;
  const state = makeGame(game.level, orientations, game.locked, game.moves + 1);
  return {
    accepted: true,
    effect: turns < 0 ? "rotated-counterclockwise" : "rotated-clockwise",
    index,
    turns,
    state,
    evaluation: state.evaluation,
  };
}

export const applyMove = applyAction;

export function rotate(game, target, turns = 1) {
  return applyAction(game, { type: "rotate", index: resolveCell(game.level, target), turns }).state;
}

export function toggleLock(game, target) {
  return applyAction(game, { type: "toggle-lock", index: resolveCell(game.level, target) }).state;
}

export function isLocked(game, target) {
  const index = resolveCell(game.level, target);
  return index >= 0 && game.locked[index] === true;
}

export function restartGame(game) {
  return createGame(game.level);
}

export function serializeGame(game) {
  const builtIn = findLevel(game?.levelId);
  if (!builtIn || game.level !== builtIn) {
    throw new RangeError("Only a state for a built-in level can be saved.");
  }
  // Reconstructing also rejects altered masks, malformed locks, and moves.
  const normalized = makeGame(builtIn, game.orientations, game.locked, game.moves);
  if (normalized.status !== game.status) throw new RangeError("Game status is inconsistent.");
  return JSON.stringify({
    schema: SAVE_SCHEMA,
    version: SAVE_VERSION,
    levelId: builtIn.id,
    orientations: [...normalized.orientations],
    locked: [...normalized.locked],
    moves: normalized.moves,
  });
}

export function restoreGame(payload, expectedLevelId = undefined) {
  let data = payload;
  try {
    if (typeof data === "string") data = JSON.parse(data);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (data.schema !== SAVE_SCHEMA || data.version !== SAVE_VERSION) return null;
  if (typeof data.levelId !== "string") return null;
  if (expectedLevelId !== undefined && data.levelId !== expectedLevelId) return null;
  const level = findLevel(data.levelId);
  if (!level) return null;
  try {
    return makeGame(level, data.orientations, data.locked, data.moves);
  } catch {
    return null;
  }
}
