export const CELL_STATE = Object.freeze({
  UNKNOWN: "unknown",
  TENT: "tent",
  GRASS: "grass",
});

export const ORTHOGONAL_STEPS = Object.freeze([
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([1, 0]),
  Object.freeze([0, -1]),
]);

export function keyOf(row, column) {
  return `${row}:${column}`;
}

export function pointFromKey(value) {
  const text = String(value);
  const match = /^(\d+):(\d+)$/.exec(text);
  if (!match) return null;
  const point = { row: Number(match[1]), column: Number(match[2]) };
  return text === keyOf(point.row, point.column) ? point : null;
}

function toKeySet(value) {
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function coordinateKey(value) {
  if (typeof value === "string") return pointFromKey(value) ? value : null;
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [row, column] = value;
  return Number.isInteger(row) && Number.isInteger(column) && row >= 0 && column >= 0
    ? keyOf(row, column)
    : null;
}

function integerClues(value, expected, label, maximum = expected) {
  if (!Array.isArray(value) || value.length !== expected) {
    throw new TypeError(`${label} must contain exactly ${expected} clues.`);
  }
  const clues = value.map(Number);
  if (clues.some((clue) => !Number.isInteger(clue) || clue < 0 || clue > maximum)) {
    throw new TypeError(`${label} must contain non-negative integer clues.`);
  }
  return clues;
}

export function createPuzzle(definition) {
  if (!definition || !Number.isInteger(definition.width) || !Number.isInteger(definition.height)) {
    throw new TypeError("Puzzle width and height must be integers.");
  }
  const { width, height } = definition;
  if (width < 4 || height < 4 || width > 15 || height > 15) {
    throw new RangeError("Puzzle width and height must be between 4 and 15.");
  }

  const rowClues = integerClues(definition.rowClues, height, "rowClues", width);
  const columnClues = integerClues(definition.columnClues, width, "columnClues", height);
  const treeKeys = (definition.trees ?? []).map(coordinateKey);
  if (treeKeys.some((key) => key === null) || new Set(treeKeys).size !== treeKeys.length) {
    throw new TypeError("Trees must be unique in-bounds coordinates.");
  }
  for (const key of treeKeys) {
    const point = pointFromKey(key);
    if (point.row >= height || point.column >= width) {
      throw new RangeError("Tree coordinates must be inside the puzzle grid.");
    }
  }

  const rowTotal = rowClues.reduce((sum, clue) => sum + clue, 0);
  const columnTotal = columnClues.reduce((sum, clue) => sum + clue, 0);
  if (treeKeys.length === 0 || rowTotal !== treeKeys.length || columnTotal !== treeKeys.length) {
    throw new TypeError("Row clues, column clues, and tree count must have the same positive total.");
  }

  const solution = (definition.solution ?? []).map(coordinateKey);
  if (solution.some((key) => key === null) || new Set(solution).size !== solution.length) {
    throw new TypeError("Solution tents must be unique coordinates.");
  }
  const treeSet = new Set(treeKeys);
  for (const key of solution) {
    const point = pointFromKey(key);
    if (point.row >= height || point.column >= width || treeSet.has(key)) {
      throw new RangeError("Solution tents must be inside non-tree cells.");
    }
  }

  return Object.freeze({
    ...definition,
    id: String(definition.id ?? "puzzle"),
    title: String(definition.title ?? "未命名营地"),
    width,
    height,
    rowClues: Object.freeze(rowClues),
    columnClues: Object.freeze(columnClues),
    trees: Object.freeze(treeKeys),
    solution: Object.freeze(solution),
    par: Number.isInteger(definition.par) && definition.par > 0
      ? definition.par
      : treeKeys.length,
  });
}

export function isInside(puzzle, row, column) {
  return Number.isInteger(row)
    && Number.isInteger(column)
    && row >= 0
    && column >= 0
    && row < puzzle.height
    && column < puzzle.width;
}

export function isTree(puzzle, rowOrKey, column) {
  const key = typeof rowOrKey === "string" ? rowOrKey : keyOf(rowOrKey, column);
  return puzzle.trees.includes(key);
}

export function orthogonalNeighbours(puzzle, row, column) {
  return ORTHOGONAL_STEPS.flatMap(([rowStep, columnStep]) => {
    const nextRow = row + rowStep;
    const nextColumn = column + columnStep;
    return isInside(puzzle, nextRow, nextColumn)
      ? [{ row: nextRow, column: nextColumn, key: keyOf(nextRow, nextColumn) }]
      : [];
  });
}

export function touchingNeighbours(puzzle, row, column) {
  const neighbours = [];
  for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
    for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
      if (rowStep === 0 && columnStep === 0) continue;
      const nextRow = row + rowStep;
      const nextColumn = column + columnStep;
      if (isInside(puzzle, nextRow, nextColumn)) {
        neighbours.push({ row: nextRow, column: nextColumn, key: keyOf(nextRow, nextColumn) });
      }
    }
  }
  return neighbours;
}

function validPlayableKey(puzzle, key) {
  const point = pointFromKey(key);
  return point && isInside(puzzle, point.row, point.column) && !isTree(puzzle, key);
}

export function normalizePosition(puzzle, position = {}) {
  const tents = new Set([...toKeySet(position.tents)].filter((key) => validPlayableKey(puzzle, key)));
  const grass = new Set(
    [...toKeySet(position.grass)].filter((key) => validPlayableKey(puzzle, key) && !tents.has(key)),
  );
  return { tents, grass };
}

export function stateAt(puzzle, position, rowOrKey, column) {
  const key = typeof rowOrKey === "string" ? rowOrKey : keyOf(rowOrKey, column);
  if (!validPlayableKey(puzzle, key)) return null;
  const normalized = normalizePosition(puzzle, position);
  if (normalized.tents.has(key)) return CELL_STATE.TENT;
  if (normalized.grass.has(key)) return CELL_STATE.GRASS;
  return CELL_STATE.UNKNOWN;
}

export function applyMove(puzzle, position = {}, move = {}) {
  const { tents, grass } = normalizePosition(puzzle, position);
  const key = typeof move.key === "string" ? move.key : keyOf(move.row, move.column);
  if (!validPlayableKey(puzzle, key)) {
    return { accepted: false, reason: "not-playable", tents, grass };
  }

  const current = tents.has(key)
    ? CELL_STATE.TENT
    : grass.has(key) ? CELL_STATE.GRASS : CELL_STATE.UNKNOWN;
  let next = null;
  if (move.type === "toggle-tent") {
    next = current === CELL_STATE.TENT ? CELL_STATE.UNKNOWN : CELL_STATE.TENT;
  } else if (move.type === "toggle-grass") {
    next = current === CELL_STATE.GRASS ? CELL_STATE.UNKNOWN : CELL_STATE.GRASS;
  } else if (move.type === "cycle") {
    next = current === CELL_STATE.UNKNOWN
      ? CELL_STATE.TENT
      : current === CELL_STATE.TENT ? CELL_STATE.GRASS : CELL_STATE.UNKNOWN;
  } else if (move.type === "set-unknown") {
    next = CELL_STATE.UNKNOWN;
  } else if (Object.values(CELL_STATE).includes(move.state)) {
    next = move.state;
  } else {
    return { accepted: false, reason: "unknown-move", tents, grass };
  }

  tents.delete(key);
  grass.delete(key);
  if (next === CELL_STATE.TENT) tents.add(key);
  if (next === CELL_STATE.GRASS) grass.add(key);
  return {
    accepted: next !== current,
    reason: next === current ? "unchanged" : null,
    effect: `${current}-to-${next}`,
    tents,
    grass,
  };
}

export function positionToJSON(position = {}) {
  return {
    tents: [...toKeySet(position.tents)].sort(),
    grass: [...toKeySet(position.grass)].sort(),
  };
}

function adjacencyForTree(puzzle, treeKey, tentSet) {
  const tree = pointFromKey(treeKey);
  return orthogonalNeighbours(puzzle, tree.row, tree.column)
    .map(({ key }) => key)
    .filter((key) => tentSet.has(key));
}

export function maximumTreeTentMatching(puzzle, tentsInput) {
  const tents = [...toKeySet(tentsInput)].filter((key) => validPlayableKey(puzzle, key));
  const tentSet = new Set(tents);
  const tentToTree = new Map();

  function augment(treeKey, seen) {
    for (const tentKey of adjacencyForTree(puzzle, treeKey, tentSet)) {
      if (seen.has(tentKey)) continue;
      seen.add(tentKey);
      const previousTree = tentToTree.get(tentKey);
      if (!previousTree || augment(previousTree, seen)) {
        tentToTree.set(tentKey, treeKey);
        return true;
      }
    }
    return false;
  }

  let size = 0;
  for (const treeKey of puzzle.trees) {
    if (augment(treeKey, new Set())) size += 1;
  }
  return {
    size,
    perfect: tents.length === puzzle.trees.length && size === puzzle.trees.length,
  };
}

export function countPerfectMatchings(puzzle, tentsInput, limit = 2) {
  const tents = [...toKeySet(tentsInput)].filter((key) => validPlayableKey(puzzle, key));
  if (tents.length !== puzzle.trees.length || limit <= 0) return 0;
  const tentSet = new Set(tents);
  const options = puzzle.trees
    .map((treeKey) => ({ treeKey, tents: adjacencyForTree(puzzle, treeKey, tentSet) }))
    .sort((left, right) => left.tents.length - right.tents.length);
  if (options.some((entry) => entry.tents.length === 0)) return 0;

  let count = 0;
  const used = new Set();
  function search(index) {
    if (count >= limit) return;
    if (index === options.length) {
      count += 1;
      return;
    }
    for (const tentKey of options[index].tents) {
      if (used.has(tentKey)) continue;
      used.add(tentKey);
      search(index + 1);
      used.delete(tentKey);
      if (count >= limit) return;
    }
  }
  search(0);
  return count;
}

function clueState(target, count, possible) {
  return {
    target,
    count,
    possible,
    exact: count === target,
    over: count > target,
    impossible: count > target || count + possible < target,
  };
}

export function evaluatePosition(puzzle, position = {}) {
  const { tents, grass } = normalizePosition(puzzle, position);
  const touching = new Set();
  const orphanTents = new Set();
  const tentOptions = new Map();
  const treeOptions = new Map();

  for (const tentKey of tents) {
    const point = pointFromKey(tentKey);
    const adjacentTrees = orthogonalNeighbours(puzzle, point.row, point.column)
      .map(({ key }) => key)
      .filter((key) => isTree(puzzle, key));
    tentOptions.set(tentKey, adjacentTrees);
    if (adjacentTrees.length === 0) orphanTents.add(tentKey);
    for (const neighbour of touchingNeighbours(puzzle, point.row, point.column)) {
      if (tents.has(neighbour.key)) {
        touching.add(tentKey);
        touching.add(neighbour.key);
      }
    }
  }
  for (const treeKey of puzzle.trees) {
    const point = pointFromKey(treeKey);
    treeOptions.set(
      treeKey,
      orthogonalNeighbours(puzzle, point.row, point.column)
        .map(({ key }) => key)
        .filter((key) => tents.has(key)),
    );
  }

  const rows = puzzle.rowClues.map((target, row) => {
    let count = 0;
    let possible = 0;
    for (let column = 0; column < puzzle.width; column += 1) {
      const key = keyOf(row, column);
      if (tents.has(key)) count += 1;
      else if (!isTree(puzzle, key) && !grass.has(key)) possible += 1;
    }
    return clueState(target, count, possible);
  });
  const columns = puzzle.columnClues.map((target, column) => {
    let count = 0;
    let possible = 0;
    for (let row = 0; row < puzzle.height; row += 1) {
      const key = keyOf(row, column);
      if (tents.has(key)) count += 1;
      else if (!isTree(puzzle, key) && !grass.has(key)) possible += 1;
    }
    return clueState(target, count, possible);
  });

  const matching = maximumTreeTentMatching(puzzle, tents);
  const clueExact = rows.every(({ exact }) => exact) && columns.every(({ exact }) => exact);
  const localRulesValid = touching.size === 0 && orphanTents.size === 0;
  const complete = clueExact && localRulesValid && matching.perfect;
  const contradiction = (
    tents.size > puzzle.trees.length
    || touching.size > 0
    || orphanTents.size > 0
    || rows.some(({ impossible }) => impossible)
    || columns.some(({ impossible }) => impossible)
    || (tents.size === puzzle.trees.length && !matching.perfect)
  );

  return {
    tents,
    grass,
    tentCount: tents.size,
    treeCount: puzzle.trees.length,
    rows,
    columns,
    touching,
    orphanTents,
    tentOptions,
    treeOptions,
    matching,
    clueExact,
    localRulesValid,
    contradiction,
    complete,
  };
}

function combinationsMask(columns, needed) {
  const masks = [];
  function build(index, remaining, mask, previousColumn) {
    if (remaining === 0) {
      masks.push(mask);
      return;
    }
    if (columns.length - index < remaining) return;
    for (let cursor = index; cursor < columns.length; cursor += 1) {
      const column = columns[cursor];
      if (column === previousColumn + 1) continue;
      build(cursor + 1, remaining - 1, mask | (1 << column), column);
    }
  }
  if (needed === 0) return [0];
  build(0, needed, 0, -2);
  return masks;
}

function candidateColumnsForRow(puzzle, row) {
  const columns = [];
  for (let column = 0; column < puzzle.width; column += 1) {
    if (isTree(puzzle, row, column)) continue;
    if (orthogonalNeighbours(puzzle, row, column).some(({ key }) => isTree(puzzle, key))) {
      columns.push(column);
    }
  }
  return columns;
}

function maskHas(mask, column) {
  return (mask & (1 << column)) !== 0;
}

export function solvePuzzle(puzzle, options = {}) {
  const limit = Math.max(1, Math.floor(options.limit ?? 2));
  const fixed = normalizePosition(puzzle, options.position);
  const patterns = [];
  for (let row = 0; row < puzzle.height; row += 1) {
    const fixedTentMask = [...fixed.tents].reduce((mask, key) => {
      const point = pointFromKey(key);
      return point.row === row ? mask | (1 << point.column) : mask;
    }, 0);
    const fixedGrassMask = [...fixed.grass].reduce((mask, key) => {
      const point = pointFromKey(key);
      return point.row === row ? mask | (1 << point.column) : mask;
    }, 0);
    const rowPatterns = combinationsMask(candidateColumnsForRow(puzzle, row), puzzle.rowClues[row])
      .filter((mask) => (mask & fixedTentMask) === fixedTentMask && (mask & fixedGrassMask) === 0);
    patterns.push(rowPatterns);
  }

  const suffixCapacity = Array.from({ length: puzzle.height + 1 }, () => (
    Array(puzzle.width).fill(0)
  ));
  for (let row = puzzle.height - 1; row >= 0; row -= 1) {
    for (let column = 0; column < puzzle.width; column += 1) {
      suffixCapacity[row][column] = suffixCapacity[row + 1][column]
        + (patterns[row].some((mask) => maskHas(mask, column)) ? 1 : 0);
    }
  }

  const solutions = [];
  const rowMasks = Array(puzzle.height).fill(0);
  const columnCounts = Array(puzzle.width).fill(0);
  let nodes = 0;

  function search(row, previousMask) {
    if (solutions.length >= limit) return;
    nodes += 1;
    if (row === puzzle.height) {
      if (columnCounts.some((count, column) => count !== puzzle.columnClues[column])) return;
      const tentKeys = [];
      for (let candidateRow = 0; candidateRow < puzzle.height; candidateRow += 1) {
        for (let column = 0; column < puzzle.width; column += 1) {
          if (maskHas(rowMasks[candidateRow], column)) tentKeys.push(keyOf(candidateRow, column));
        }
      }
      if (maximumTreeTentMatching(puzzle, tentKeys).perfect) solutions.push(Object.freeze(tentKeys));
      return;
    }

    for (const mask of patterns[row]) {
      if ((mask & previousMask) || (mask & (previousMask << 1)) || (mask & (previousMask >> 1))) {
        continue;
      }
      let valid = true;
      for (let column = 0; column < puzzle.width; column += 1) {
        if (maskHas(mask, column)) columnCounts[column] += 1;
        if (
          columnCounts[column] > puzzle.columnClues[column]
          || columnCounts[column] + suffixCapacity[row + 1][column] < puzzle.columnClues[column]
        ) valid = false;
      }
      if (valid) {
        rowMasks[row] = mask;
        search(row + 1, mask);
      }
      for (let column = 0; column < puzzle.width; column += 1) {
        if (maskHas(mask, column)) columnCounts[column] -= 1;
      }
      if (solutions.length >= limit) return;
    }
  }

  if (patterns.every((rowPatterns) => rowPatterns.length > 0)) search(0, 0);
  return {
    count: solutions.length,
    unique: limit > 1 && solutions.length === 1 && solutions.length < limit,
    solutions: Object.freeze(solutions),
    nodes,
    limited: solutions.length >= limit,
  };
}

export function provePuzzle(puzzle) {
  const result = solvePuzzle(puzzle, { limit: 2 });
  const solution = result.solutions[0] ?? [];
  return {
    ...result,
    solution,
    matchingCount: solution.length ? countPerfectMatchings(puzzle, solution, 2) : 0,
    uniquelyMatched: solution.length ? countPerfectMatchings(puzzle, solution, 2) === 1 : false,
  };
}
