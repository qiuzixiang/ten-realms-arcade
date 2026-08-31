export const CELL = Object.freeze({
  PLOT: ".",
  RUIN: "#",
});

export const DIRECTIONS = Object.freeze([
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([1, 0]),
  Object.freeze([0, -1]),
]);

export function keyOf(row, column) {
  return `${row}:${column}`;
}

export function pointFromKey(key) {
  const match = /^(\d+):(\d+)$/.exec(String(key));
  if (!match) return null;
  return { row: Number(match[1]), column: Number(match[2]) };
}

export function isRune(cell) {
  return typeof cell === "string" && /^[0-4]$/.test(cell);
}

export function isWall(cell) {
  return cell === CELL.RUIN || isRune(cell);
}

export function isPlot(cell) {
  return cell === CELL.PLOT;
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
  if (rows.some((row) => /[^.#0-4]/.test(row))) {
    throw new TypeError("Puzzle rows may contain only '.', '#', and clues 0–4.");
  }

  const puzzle = {
    ...definition,
    rows: Object.freeze(rows),
    width,
    height: rows.length,
  };

  return Object.freeze(puzzle);
}

export function cellAt(puzzle, row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
  if (row < 0 || column < 0 || row >= puzzle.height || column >= puzzle.width) return null;
  return puzzle.rows[row][column];
}

export function allPlotKeys(puzzle) {
  const keys = [];
  for (let row = 0; row < puzzle.height; row += 1) {
    for (let column = 0; column < puzzle.width; column += 1) {
      if (isPlot(cellAt(puzzle, row, column))) keys.push(keyOf(row, column));
    }
  }
  return keys;
}

export function orthogonalNeighbours(puzzle, row, column) {
  return DIRECTIONS.flatMap(([rowStep, columnStep]) => {
    const nextRow = row + rowStep;
    const nextColumn = column + columnStep;
    return cellAt(puzzle, nextRow, nextColumn) === null
      ? []
      : [{ row: nextRow, column: nextColumn, key: keyOf(nextRow, nextColumn) }];
  });
}

export function rayFrom(puzzle, row, column, rowStep, columnStep) {
  const ray = [];
  let nextRow = row + rowStep;
  let nextColumn = column + columnStep;

  while (cellAt(puzzle, nextRow, nextColumn) !== null) {
    if (isWall(cellAt(puzzle, nextRow, nextColumn))) break;
    ray.push({ row: nextRow, column: nextColumn, key: keyOf(nextRow, nextColumn) });
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  return ray;
}

function toKeySet(value) {
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function validPlotKey(puzzle, key) {
  const point = pointFromKey(key);
  return point && isPlot(cellAt(puzzle, point.row, point.column));
}

export function normalizePosition(puzzle, position = {}) {
  const bulbs = new Set(
    [...toKeySet(position.bulbs)].filter((key) => validPlotKey(puzzle, key)),
  );
  const marks = new Set(
    [...toKeySet(position.marks)].filter((key) => validPlotKey(puzzle, key) && !bulbs.has(key)),
  );
  return { bulbs, marks };
}

export function illuminationMap(puzzle, bulbsInput) {
  const bulbs = toKeySet(bulbsInput);
  const map = new Map();
  const addSource = (targetKey, sourceKey) => {
    if (!map.has(targetKey)) map.set(targetKey, new Set());
    map.get(targetKey).add(sourceKey);
  };

  for (const bulbKey of bulbs) {
    if (!validPlotKey(puzzle, bulbKey)) continue;
    const point = pointFromKey(bulbKey);
    addSource(bulbKey, bulbKey);
    for (const [rowStep, columnStep] of DIRECTIONS) {
      for (const target of rayFrom(puzzle, point.row, point.column, rowStep, columnStep)) {
        addSource(target.key, bulbKey);
      }
    }
  }

  return map;
}

export function visibleBulbs(puzzle, row, column, bulbsInput) {
  const bulbs = toKeySet(bulbsInput);
  const found = new Set();
  for (const [rowStep, columnStep] of DIRECTIONS) {
    for (const target of rayFrom(puzzle, row, column, rowStep, columnStep)) {
      if (bulbs.has(target.key)) found.add(target.key);
    }
  }
  return found;
}

export function adjacentBulbCount(puzzle, row, column, bulbsInput) {
  const bulbs = toKeySet(bulbsInput);
  return orthogonalNeighbours(puzzle, row, column)
    .filter((neighbour) => bulbs.has(neighbour.key)).length;
}

export function evaluatePosition(puzzle, position = {}) {
  const { bulbs, marks } = normalizePosition(puzzle, position);
  const light = illuminationMap(puzzle, bulbs);
  const plots = allPlotKeys(puzzle);
  const unlit = new Set(plots.filter((key) => !light.has(key)));
  const conflicts = new Set();

  for (const bulbKey of bulbs) {
    const point = pointFromKey(bulbKey);
    if (visibleBulbs(puzzle, point.row, point.column, bulbs).size > 0) {
      conflicts.add(bulbKey);
    }
  }

  const runes = new Map();
  for (let row = 0; row < puzzle.height; row += 1) {
    for (let column = 0; column < puzzle.width; column += 1) {
      const cell = cellAt(puzzle, row, column);
      if (!isRune(cell)) continue;
      const target = Number(cell);
      const count = adjacentBulbCount(puzzle, row, column, bulbs);
      const eligibleEmpty = orthogonalNeighbours(puzzle, row, column).filter((neighbour) => (
        isPlot(cellAt(puzzle, neighbour.row, neighbour.column))
        && !bulbs.has(neighbour.key)
        && !marks.has(neighbour.key)
      )).length;
      const impossible = count > target || count + eligibleEmpty < target;
      runes.set(keyOf(row, column), {
        target,
        count,
        exact: count === target,
        impossible,
      });
    }
  }

  const exactRunes = [...runes.values()].filter((rune) => rune.exact).length;
  const litCount = plots.length - unlit.size;
  const complete = (
    plots.length > 0
    && unlit.size === 0
    && conflicts.size === 0
    && [...runes.values()].every((rune) => rune.exact)
  );

  return {
    bulbs,
    marks,
    light,
    unlit,
    conflicts,
    runes,
    complete,
    totalPlots: plots.length,
    litCount,
    lightProgress: plots.length === 0 ? 0 : litCount / plots.length,
    totalRunes: runes.size,
    exactRunes,
  };
}

export function applyMove(puzzle, position = {}, move = {}) {
  const normalized = normalizePosition(puzzle, position);
  const bulbs = new Set(normalized.bulbs);
  const marks = new Set(normalized.marks);
  const key = typeof move.key === "string"
    ? move.key
    : keyOf(move.row, move.column);

  if (!validPlotKey(puzzle, key)) {
    return { accepted: false, reason: "not-a-plot", bulbs, marks };
  }

  if (move.type === "toggle-bulb") {
    if (bulbs.has(key)) {
      bulbs.delete(key);
      return { accepted: true, effect: "bulb-removed", bulbs, marks };
    }
    if (marks.has(key)) {
      return { accepted: false, reason: "marked", bulbs, marks };
    }
    bulbs.add(key);
    return { accepted: true, effect: "bulb-added", bulbs, marks };
  }

  if (move.type === "toggle-mark") {
    if (marks.has(key)) {
      marks.delete(key);
      return { accepted: true, effect: "mark-removed", bulbs, marks };
    }
    if (bulbs.has(key)) {
      return { accepted: false, reason: "bulb", bulbs, marks };
    }
    if (illuminationMap(puzzle, bulbs).has(key)) {
      return { accepted: false, reason: "lit", bulbs, marks };
    }
    marks.add(key);
    return { accepted: true, effect: "mark-added", bulbs, marks };
  }

  return { accepted: false, reason: "unknown-move", bulbs, marks };
}

export function positionToJSON(position = {}) {
  return {
    bulbs: [...toKeySet(position.bulbs)].sort(),
    marks: [...toKeySet(position.marks)].sort(),
  };
}

export function transformPuzzle(definition, transform = "identity") {
  const source = createPuzzle(definition);
  const turns = transform === "rotate-90" ? 1
    : transform === "rotate-180" ? 2
      : transform === "rotate-270" ? 3
        : 0;
  let rows = [...source.rows].map((row) => [...row]);

  for (let turn = 0; turn < turns; turn += 1) {
    rows = rows[0].map((_, column) => rows.map((row) => row[column]).reverse());
  }
  if (transform === "mirror-horizontal") rows = rows.map((row) => [...row].reverse());
  if (transform === "mirror-vertical") rows = [...rows].reverse();

  return createPuzzle({
    ...definition,
    id: transform === "identity" ? definition.id : `${definition.id}-${transform}`,
    rows: rows.map((row) => row.join("")),
    transform,
  });
}

function transformPoint(point, size, transform) {
  const [row, column] = point;
  if (transform === "rotate-90") return [column, size - 1 - row];
  if (transform === "rotate-180") return [size - 1 - row, size - 1 - column];
  if (transform === "rotate-270") return [size - 1 - column, row];
  if (transform === "mirror-horizontal") return [row, size - 1 - column];
  if (transform === "mirror-vertical") return [size - 1 - row, column];
  return [row, column];
}

const BASE_LEVELS = Object.freeze([
  Object.freeze({
    id: "dew-court",
    title: "露珠小径",
    difficulty: "glimmer",
    rows: Object.freeze(["....1", ".....", ".1..#", "..3..", "....."]),
    solution: Object.freeze([[0, 1], [1, 4], [2, 2], [3, 0], [3, 3], [4, 2]]),
  }),
  Object.freeze({
    id: "moss-gallery",
    title: "苔影回廊",
    difficulty: "moonpath",
    rows: Object.freeze(["#....1.", "...2...", "....3..", ".....#.", "1..2...", ".1....1", ".#....#"]),
    solution: Object.freeze([[0, 1], [0, 6], [1, 0], [1, 4], [2, 3], [2, 5], [4, 2], [4, 4], [5, 0], [5, 5], [6, 3]]),
  }),
  Object.freeze({
    id: "moonless-depths",
    title: "无月深庭",
    difficulty: "deepgarden",
    rows: Object.freeze([
      ".......1.",
      "..0.0....",
      ".0#.#...1",
      ".........",
      "#.2.#.#1.",
      "2...1....",
      "..#...1.2",
      "..#...1..",
      ".........",
    ]),
    solution: Object.freeze([
      [0, 1], [0, 8], [1, 0], [1, 6], [2, 7], [3, 2], [4, 3], [4, 8],
      [5, 1], [5, 5], [6, 0], [6, 7], [7, 4], [7, 8], [8, 6],
    ]),
  }),
]);

const LEVEL_TRANSFORMS = Object.freeze([
  "identity",
  "rotate-90",
  "rotate-180",
  "mirror-horizontal",
]);

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "glimmer", label: "微光", note: "5 × 5 · 初见夜色" }),
  Object.freeze({ id: "moonpath", label: "月径", note: "7 × 7 · 迂回光路" }),
  Object.freeze({ id: "deepgarden", label: "深庭", note: "9 × 9 · 符文密林" }),
]);

export const LEVELS = Object.freeze(BASE_LEVELS.flatMap((base) => (
  LEVEL_TRANSFORMS.map((transform, variantIndex) => {
    const transformed = transformPuzzle(base, transform);
    const solution = base.solution.map((point) => (
      keyOf(...transformPoint(point, base.rows.length, transform))
    ));
    return Object.freeze({
      ...transformed,
      baseId: base.id,
      title: `${base.title} · ${["初庭", "东庭", "暮庭", "镜庭"][variantIndex]}`,
      variantIndex,
      solution: Object.freeze(solution),
    });
  })
)));

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function findLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}
