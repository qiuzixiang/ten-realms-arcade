export const SIDE = Object.freeze({
  TOP: "top",
  BOTTOM: "bottom",
  LEFT: "left",
  RIGHT: "right",
});

export const SIDES = Object.freeze([
  SIDE.TOP,
  SIDE.BOTTOM,
  SIDE.LEFT,
  SIDE.RIGHT,
]);

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "block", label: "街区", size: 4, tier: 1, note: "4×4 · 高密度观测点" }),
  Object.freeze({ id: "district", label: "城区", size: 5, tier: 2, note: "5×5 · 缺失线索与预填塔" }),
  Object.freeze({ id: "megacity", label: "都会", size: 6, tier: 3, note: "6×6 · 低密度观测网" }),
]);

const PERMUTATION_CACHE = new Map();
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cellIndex(size, row, column) {
  return row * size + column;
}

export function keyOf(row, column) {
  return `${row}:${column}`;
}

export function pointFromKey(value) {
  const match = /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(String(value));
  if (!match) return null;
  return { row: Number(match[1]), column: Number(match[2]) };
}

export function clueKey(side, index) {
  return `${side}:${index}`;
}

export function parseClueKey(value) {
  const match = /^(top|bottom|left|right):(0|[1-9]\d*)$/.exec(String(value));
  if (!match) return null;
  return { side: match[1], index: Number(match[2]) };
}

function freezeGrid(rows) {
  return Object.freeze(rows.map((row) => Object.freeze([...row])));
}

function normalizeSolutionRows(rows, size) {
  if (!Array.isArray(rows) || rows.length !== size) {
    throw new TypeError(`Solution must contain ${size} rows.`);
  }
  const normalized = rows.map((rawRow) => {
    const row = typeof rawRow === "string" ? [...rawRow].map(Number) : rawRow;
    if (!Array.isArray(row) || row.length !== size) {
      throw new TypeError(`Every solution row must contain ${size} heights.`);
    }
    if (row.some((value) => !Number.isInteger(value) || value < 1 || value > size)) {
      throw new RangeError(`Solution heights must be integers from 1 to ${size}.`);
    }
    return [...row];
  });
  return freezeGrid(normalized);
}

function expectedSet(size) {
  return Array.from({ length: size }, (_, index) => index + 1);
}

export function isLatinGrid(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.some((row) => !Array.isArray(row))) return false;
  const size = rows.length;
  if (rows.some((row) => row.length !== size)) return false;
  const expected = expectedSet(size).join(",");
  for (const row of rows) {
    if ([...row].sort((a, b) => a - b).join(",") !== expected) return false;
  }
  for (let column = 0; column < size; column += 1) {
    const values = rows.map((row) => row[column]).sort((a, b) => a - b);
    if (values.join(",") !== expected) return false;
  }
  return true;
}

export function visibleCount(values) {
  if (!Array.isArray(values)) throw new TypeError("A skyline must be an array.");
  let highest = 0;
  let visible = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) throw new TypeError("Skyline heights must be finite numbers.");
    if (value > highest) {
      highest = value;
      visible += 1;
    }
  }
  return visible;
}

export function lineFromGrid(rows, side, index) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.some((row) => !Array.isArray(row))) {
    throw new TypeError("Grid rows are required.");
  }
  const size = rows.length;
  if (!SIDES.includes(side) || !Number.isInteger(index) || index < 0 || index >= size) {
    throw new RangeError("Unknown skyline edge.");
  }
  if (rows.some((row) => row.length !== size)) throw new TypeError("Grid must be square.");
  if (side === SIDE.TOP) return rows.map((row) => row[index]);
  if (side === SIDE.BOTTOM) return rows.map((row) => row[index]).reverse();
  if (side === SIDE.LEFT) return [...rows[index]];
  return [...rows[index]].reverse();
}

export function cluesForGrid(rows) {
  if (!isLatinGrid(rows)) throw new TypeError("Visibility clues require a Latin square.");
  const size = rows.length;
  return Object.freeze(Object.fromEntries(SIDES.map((side) => [
    side,
    Object.freeze(Array.from({ length: size }, (_, index) => visibleCount(lineFromGrid(rows, side, index)))),
  ])));
}

function normalizeClues(clues, size) {
  if (!isPlainObject(clues)) throw new TypeError("Puzzle clues must include all four sides.");
  const normalized = {};
  for (const side of SIDES) {
    const values = clues[side];
    if (!Array.isArray(values) || values.length !== size) {
      throw new TypeError(`${side} must contain ${size} clue slots.`);
    }
    normalized[side] = Object.freeze(values.map((value) => {
      if (value === null || value === 0 || value === "") return null;
      if (!Number.isInteger(value) || value < 1 || value > size) {
        throw new RangeError(`Clues must be missing or integers from 1 to ${size}.`);
      }
      return value;
    }));
  }
  return Object.freeze(normalized);
}

function normalizeGivens(givens, size, solution) {
  if (givens === undefined) return Object.freeze([]);
  if (!Array.isArray(givens)) throw new TypeError("Givens must be an array.");
  const occupied = new Set();
  const normalized = givens.map((given) => {
    if (
      !isPlainObject(given)
      || !Number.isInteger(given.row)
      || !Number.isInteger(given.column)
      || given.row < 0
      || given.column < 0
      || given.row >= size
      || given.column >= size
      || !Number.isInteger(given.value)
      || given.value < 1
      || given.value > size
    ) {
      throw new RangeError("Every given needs an in-range row, column, and height.");
    }
    const key = keyOf(given.row, given.column);
    if (occupied.has(key)) throw new TypeError("A cell cannot contain two givens.");
    occupied.add(key);
    if (solution && solution[given.row][given.column] !== given.value) {
      throw new TypeError("Every given must match the declared solution.");
    }
    return Object.freeze({ row: given.row, column: given.column, value: given.value });
  });
  return Object.freeze(normalized.sort((left, right) => (
    left.row - right.row || left.column - right.column
  )));
}

export function createPuzzle(definition) {
  if (!isPlainObject(definition)) throw new TypeError("Puzzle definition is required.");
  const size = definition.size;
  if (!Number.isInteger(size) || size < 3 || size > 9) {
    throw new RangeError("Towers grids must be between 3 and 9 cells wide.");
  }
  if (!/^[a-z0-9-]{2,64}$/.test(definition.id ?? "") || RESERVED_KEYS.has(definition.id)) {
    throw new TypeError("Puzzle id must be a stable lowercase slug.");
  }
  if (!DIFFICULTIES.some(({ id }) => id === definition.difficulty)) {
    throw new TypeError("Puzzle difficulty is not registered.");
  }
  const solution = normalizeSolutionRows(definition.solution, size);
  if (!isLatinGrid(solution)) throw new TypeError("Declared solution must be a Latin square.");
  const clues = normalizeClues(definition.clues, size);
  const givens = normalizeGivens(definition.givens, size, solution);
  for (const side of SIDES) {
    for (let index = 0; index < size; index += 1) {
      const clue = clues[side][index];
      if (clue !== null && visibleCount(lineFromGrid(solution, side, index)) !== clue) {
        throw new TypeError(`Declared solution violates ${side} clue ${index + 1}.`);
      }
    }
  }
  const clueCount = SIDES.reduce(
    (total, side) => total + clues[side].filter((value) => value !== null).length,
    0,
  );
  return Object.freeze({
    ...definition,
    size,
    solution,
    clues,
    givens,
    clueCount,
    par: Number.isInteger(definition.par) && definition.par >= 0 ? definition.par : size * size,
  });
}

export function initialPosition(puzzle) {
  const values = Array(puzzle.size * puzzle.size).fill(0);
  for (const given of puzzle.givens) values[cellIndex(puzzle.size, given.row, given.column)] = given.value;
  return { values, notes: Array(values.length).fill(0), clueDone: new Set() };
}

function toClueDone(value) {
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

export function normalizePosition(puzzle, position = {}) {
  const length = puzzle.size * puzzle.size;
  const values = Array.isArray(position.values) && position.values.length === length
    ? position.values.map((value) => (
      Number.isInteger(value) && value >= 0 && value <= puzzle.size ? value : 0
    ))
    : Array(length).fill(0);
  const notes = Array.isArray(position.notes) && position.notes.length === length
    ? position.notes.map((mask) => (
      Number.isInteger(mask) && mask >= 0 ? mask & ((1 << (puzzle.size + 1)) - 2) : 0
    ))
    : Array(length).fill(0);
  for (let index = 0; index < length; index += 1) {
    if (values[index] !== 0) notes[index] = 0;
  }
  for (const given of puzzle.givens) {
    const index = cellIndex(puzzle.size, given.row, given.column);
    values[index] = given.value;
    notes[index] = 0;
  }
  const clueDone = new Set();
  for (const key of toClueDone(position.clueDone)) {
    const parsed = parseClueKey(key);
    if (
      parsed
      && parsed.index < puzzle.size
      && puzzle.clues[parsed.side][parsed.index] !== null
    ) clueDone.add(clueKey(parsed.side, parsed.index));
  }
  return { values, notes, clueDone };
}

export function positionToJSON(position = {}) {
  return {
    values: Array.isArray(position.values) ? [...position.values] : [],
    notes: Array.isArray(position.notes) ? [...position.notes] : [],
    clueDone: [...toClueDone(position.clueDone)].sort(),
  };
}

export function isStrictPosition(puzzle, candidate) {
  if (!isPlainObject(candidate)) return false;
  const length = puzzle.size * puzzle.size;
  if (!Array.isArray(candidate.values) || candidate.values.length !== length) return false;
  if (!Array.isArray(candidate.notes) || candidate.notes.length !== length) return false;
  if (!Array.isArray(candidate.clueDone) || new Set(candidate.clueDone).size !== candidate.clueDone.length) return false;
  const fullMask = (1 << (puzzle.size + 1)) - 2;
  if (candidate.values.some((value) => !Number.isInteger(value) || value < 0 || value > puzzle.size)) return false;
  if (candidate.notes.some((mask) => !Number.isInteger(mask) || mask < 0 || (mask & ~fullMask) !== 0)) return false;
  if (candidate.values.some((value, index) => value !== 0 && candidate.notes[index] !== 0)) return false;
  for (const given of puzzle.givens) {
    const index = cellIndex(puzzle.size, given.row, given.column);
    if (candidate.values[index] !== given.value || candidate.notes[index] !== 0) return false;
  }
  return candidate.clueDone.every((key) => {
    const parsed = parseClueKey(key);
    return Boolean(
      parsed
      && parsed.index < puzzle.size
      && puzzle.clues[parsed.side][parsed.index] !== null,
    );
  });
}

function movePoint(puzzle, move) {
  const point = typeof move.key === "string"
    ? pointFromKey(move.key)
    : { row: move.row, column: move.column };
  if (
    !point
    || !Number.isInteger(point.row)
    || !Number.isInteger(point.column)
    || point.row < 0
    || point.column < 0
    || point.row >= puzzle.size
    || point.column >= puzzle.size
  ) return null;
  return point;
}

function givenAt(puzzle, row, column) {
  return puzzle.givens.find((given) => given.row === row && given.column === column) ?? null;
}

export function applyMove(puzzle, position, move = {}) {
  const current = normalizePosition(puzzle, position);
  const next = {
    values: [...current.values],
    notes: [...current.notes],
    clueDone: new Set(current.clueDone),
  };

  if (move.type === "fill-notes") {
    const fullMask = (1 << (puzzle.size + 1)) - 2;
    let changed = false;
    for (let index = 0; index < next.values.length; index += 1) {
      if (next.values[index] === 0 && next.notes[index] !== fullMask) {
        next.notes[index] = fullMask;
        changed = true;
      }
    }
    return changed
      ? { accepted: true, effect: "notes-filled", ...next }
      : { accepted: false, reason: "unchanged", ...next };
  }

  if (move.type === "toggle-clue") {
    const side = move.side;
    const index = move.index;
    if (!SIDES.includes(side) || !Number.isInteger(index) || index < 0 || index >= puzzle.size) {
      return { accepted: false, reason: "unknown-clue", ...next };
    }
    if (puzzle.clues[side][index] === null) {
      return { accepted: false, reason: "missing-clue", ...next };
    }
    const key = clueKey(side, index);
    if (next.clueDone.has(key)) next.clueDone.delete(key);
    else next.clueDone.add(key);
    return { accepted: true, effect: "clue-note", ...next };
  }

  const point = movePoint(puzzle, move);
  if (!point) return { accepted: false, reason: "outside-grid", ...next };
  if (givenAt(puzzle, point.row, point.column)) {
    return { accepted: false, reason: "given", ...next };
  }
  const index = cellIndex(puzzle.size, point.row, point.column);

  if (move.type === "set-value") {
    const value = move.value;
    if (!Number.isInteger(value) || value < 0 || value > puzzle.size) {
      return { accepted: false, reason: "invalid-height", ...next };
    }
    if (next.values[index] === value && next.notes[index] === 0) {
      return { accepted: false, reason: "unchanged", ...next };
    }
    next.values[index] = value;
    next.notes[index] = 0;
    return { accepted: true, effect: value === 0 ? "tower-cleared" : "tower-built", ...next };
  }

  if (move.type === "toggle-note") {
    const value = move.value;
    if (!Number.isInteger(value) || value < 1 || value > puzzle.size) {
      return { accepted: false, reason: "invalid-height", ...next };
    }
    if (next.values[index] !== 0) {
      return { accepted: false, reason: "occupied", ...next };
    }
    next.notes[index] ^= 1 << value;
    return { accepted: true, effect: "note-changed", ...next };
  }

  return { accepted: false, reason: "unknown-move", ...next };
}

function rowsFromValues(puzzle, values) {
  return Array.from({ length: puzzle.size }, (_, row) => (
    values.slice(row * puzzle.size, (row + 1) * puzzle.size)
  ));
}

export function partialClueState(values, clue, size) {
  if (clue === null) {
    return { missing: true, visible: 0, highest: 0, prefixLength: 0, exact: false, conflict: false };
  }
  let visible = 0;
  let highest = 0;
  let prefixLength = 0;
  for (const value of values) {
    if (value === 0) break;
    prefixLength += 1;
    if (value > highest) {
      highest = value;
      visible += 1;
    }
  }
  const full = prefixLength === size;
  const conflict = visible > clue
    || (highest === size && visible < clue)
    || (highest < size && visible === clue);
  return {
    missing: false,
    visible,
    highest,
    prefixLength,
    full,
    atTarget: visible === clue,
    exact: full && visible === clue,
    conflict,
  };
}

export function evaluatePosition(puzzle, position = {}) {
  const normalized = normalizePosition(puzzle, position);
  const rows = rowsFromValues(puzzle, normalized.values);
  const conflictCells = new Set();
  const rowStates = [];
  const columnStates = [];

  function duplicateIndexes(values) {
    const seen = new Map();
    values.forEach((value, index) => {
      if (value === 0) return;
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value).push(index);
    });
    return [...seen.values()].filter((indexes) => indexes.length > 1).flat();
  }

  for (let row = 0; row < puzzle.size; row += 1) {
    const duplicates = duplicateIndexes(rows[row]);
    duplicates.forEach((column) => conflictCells.add(keyOf(row, column)));
    rowStates.push({ index: row, duplicates, complete: rows[row].every((value) => value !== 0) });
  }
  for (let column = 0; column < puzzle.size; column += 1) {
    const values = rows.map((row) => row[column]);
    const duplicates = duplicateIndexes(values);
    duplicates.forEach((row) => conflictCells.add(keyOf(row, column)));
    columnStates.push({ index: column, duplicates, complete: values.every((value) => value !== 0) });
  }

  const clueStates = new Map();
  let exactClues = 0;
  let clueConflicts = 0;
  for (const side of SIDES) {
    for (let index = 0; index < puzzle.size; index += 1) {
      const clue = puzzle.clues[side][index];
      const result = {
        side,
        index,
        clue,
        done: normalized.clueDone.has(clueKey(side, index)),
        ...partialClueState(lineFromGrid(rows, side, index), clue, puzzle.size),
      };
      if (result.exact) exactClues += 1;
      if (result.conflict) clueConflicts += 1;
      clueStates.set(clueKey(side, index), result);
    }
  }

  const filled = normalized.values.filter((value) => value !== 0).length;
  const complete = filled === normalized.values.length
    && conflictCells.size === 0
    && clueConflicts === 0
    && exactClues === puzzle.clueCount;
  return {
    ...normalized,
    rows,
    filled,
    empty: normalized.values.length - filled,
    conflictCells,
    rowStates,
    columnStates,
    clueStates,
    exactClues,
    clueConflicts,
    conflicts: conflictCells.size + clueConflicts,
    complete,
  };
}

function permutations(size) {
  if (PERMUTATION_CACHE.has(size)) return PERMUTATION_CACHE.get(size);
  const result = [];
  const values = expectedSet(size);
  function visit(prefix, remaining) {
    if (remaining.length === 0) {
      result.push(Object.freeze(prefix));
      return;
    }
    for (let index = 0; index < remaining.length; index += 1) {
      visit([...prefix, remaining[index]], [...remaining.slice(0, index), ...remaining.slice(index + 1)]);
    }
  }
  visit([], values);
  const frozen = Object.freeze(result);
  PERMUTATION_CACHE.set(size, frozen);
  return frozen;
}

function permutationMatches(perm, nearClue, farClue) {
  return (nearClue === null || visibleCount(perm) === nearClue)
    && (farClue === null || visibleCount([...perm].reverse()) === farClue);
}

export function solvePuzzle(puzzle, options = {}) {
  const limit = options.limit ?? Infinity;
  if (limit !== Infinity && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError("Solver limit must be a non-negative integer or Infinity.");
  }
  if (limit === 0) return [];
  if (puzzle.size >= 7) return solvePuzzleByCells(puzzle, limit);
  const size = puzzle.size;
  const allPermutations = permutations(size);
  const givens = new Map(puzzle.givens.map((given) => [keyOf(given.row, given.column), given.value]));
  const rowCandidates = Array.from({ length: size }, (_, row) => allPermutations.filter((perm) => (
    permutationMatches(perm, puzzle.clues.left[row], puzzle.clues.right[row])
    && perm.every((value, column) => (givens.get(keyOf(row, column)) ?? value) === value)
  )));
  const columnCandidates = Array.from({ length: size }, (_, column) => allPermutations.filter((perm) => (
    permutationMatches(perm, puzzle.clues.top[column], puzzle.clues.bottom[column])
    && perm.every((value, row) => (givens.get(keyOf(row, column)) ?? value) === value)
  )));
  if (rowCandidates.some((items) => items.length === 0) || columnCandidates.some((items) => items.length === 0)) return [];

  const solutions = [];
  const chosenRows = Array(size).fill(null);
  const unassigned = new Set(expectedSet(size).map((value) => value - 1));

  function search(activeColumns) {
    if (solutions.length >= limit) return;
    if (unassigned.size === 0) {
      solutions.push(chosenRows.flat());
      return;
    }
    let chosenRow = null;
    let viableRows = null;
    for (const row of unassigned) {
      const viable = rowCandidates[row].filter((perm) => perm.every((value, column) => (
        activeColumns[column].some((candidate) => candidate[row] === value)
      )));
      if (viableRows === null || viable.length < viableRows.length) {
        chosenRow = row;
        viableRows = viable;
      }
      if (viable.length === 0) return;
    }
    unassigned.delete(chosenRow);
    for (const perm of viableRows) {
      const nextColumns = activeColumns.map((candidates, column) => (
        candidates.filter((candidate) => candidate[chosenRow] === perm[column])
      ));
      if (nextColumns.every((candidates) => candidates.length > 0)) {
        chosenRows[chosenRow] = perm;
        search(nextColumns);
        chosenRows[chosenRow] = null;
      }
      if (solutions.length >= limit) break;
    }
    unassigned.add(chosenRow);
  }

  search(columnCandidates);
  return solutions;
}

function solvePuzzleByCells(puzzle, limit) {
  const size = puzzle.size;
  const fullMask = (1 << (size + 1)) - 2;
  const grid = Array(size * size).fill(0);
  const rowMasks = Array(size).fill(0);
  const columnMasks = Array(size).fill(0);
  const givenValues = new Map(puzzle.givens.map((given) => [cellIndex(size, given.row, given.column), given.value]));
  const solutions = [];

  function line(side, index) {
    return lineFromGrid(rowsFromValues(puzzle, grid), side, index);
  }

  function cluePossible(row, column) {
    const left = partialClueState(line(SIDE.LEFT, row), puzzle.clues.left[row], size);
    if (left.conflict) return false;
    const top = partialClueState(line(SIDE.TOP, column), puzzle.clues.top[column], size);
    if (top.conflict) return false;
    if (column === size - 1) {
      const right = partialClueState(line(SIDE.RIGHT, row), puzzle.clues.right[row], size);
      if (right.conflict || (!right.missing && !right.exact)) return false;
    }
    if (row === size - 1) {
      const bottom = partialClueState(line(SIDE.BOTTOM, column), puzzle.clues.bottom[column], size);
      if (bottom.conflict || (!bottom.missing && !bottom.exact)) return false;
    }
    return true;
  }

  function search(index) {
    if (solutions.length >= limit) return;
    if (index === grid.length) {
      solutions.push([...grid]);
      return;
    }
    const row = Math.floor(index / size);
    const column = index % size;
    const given = givenValues.get(index);
    const candidates = given ? [given] : expectedSet(size);
    for (const value of candidates) {
      const bit = 1 << value;
      if ((rowMasks[row] & bit) || (columnMasks[column] & bit)) continue;
      grid[index] = value;
      rowMasks[row] |= bit;
      columnMasks[column] |= bit;
      const rowComplete = column === size - 1;
      const columnComplete = row === size - 1;
      const latinPossible = (!rowComplete || rowMasks[row] === fullMask)
        && (!columnComplete || columnMasks[column] === fullMask);
      if (latinPossible && cluePossible(row, column)) search(index + 1);
      rowMasks[row] ^= bit;
      columnMasks[column] ^= bit;
      grid[index] = 0;
      if (solutions.length >= limit) return;
    }
  }

  search(0);
  return solutions;
}

export function countSolutions(puzzle, limit = Infinity) {
  return solvePuzzle(puzzle, { limit }).length;
}

function seedHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seedHash(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function generateLatinSquare(size, seed) {
  if (!Number.isInteger(size) || size < 3 || size > 9) throw new RangeError("Generator size must be 3..9.");
  const random = seededRandom(seed);
  const indexes = expectedSet(size).map((value) => value - 1);
  const rowOrder = shuffled(indexes, random);
  const columnOrder = shuffled(indexes, random);
  const symbols = shuffled(expectedSet(size), random);
  const square = rowOrder.map((row) => columnOrder.map((column) => symbols[(row + column) % size]));
  return freezeGrid(square);
}

export function generatePuzzle(options = {}) {
  const size = options.size;
  if (!Number.isInteger(size) || size < 3 || size > 6) {
    throw new RangeError("Interactive generator profiles support sizes 3..6.");
  }
  const difficulty = options.difficulty
    ?? DIFFICULTIES.find((item) => item.size === size)?.id
    ?? (size === 3 ? "block" : undefined);
  const seed = String(options.seed ?? `${difficulty}:${size}`);
  const solution = generateLatinSquare(size, seed);
  const allClues = cluesForGrid(solution);
  const random = seededRandom(`${seed}:carve`);
  const cellOrder = shuffled(Array.from({ length: size * size }, (_, index) => index), random);
  const clueOrder = shuffled(SIDES.flatMap((side) => (
    Array.from({ length: size }, (_, index) => ({ side, index }))
  )), random);
  const defaultGivens = difficulty === "block" ? 0 : difficulty === "district" ? 2 : 4;
  const defaultClueCount = difficulty === "block" ? size * 4 : difficulty === "district" ? size * 3 : size * 2;
  const requestedGivens = options.givens ?? defaultGivens;
  const targetClues = options.clueCount ?? defaultClueCount;
  if (!Number.isSafeInteger(requestedGivens) || requestedGivens < 0 || requestedGivens > size * size) {
    throw new RangeError("Generator givens must be an in-range integer.");
  }
  if (!Number.isSafeInteger(targetClues) || targetClues < 0 || targetClues > size * 4) {
    throw new RangeError("Generator clueCount must be an in-range integer.");
  }
  const givens = cellOrder.slice(0, requestedGivens).map((index) => ({
    row: Math.floor(index / size),
    column: index % size,
    value: solution[Math.floor(index / size)][index % size],
  }));
  const clues = Object.fromEntries(SIDES.map((side) => [side, [...allClues[side]]]));
  let definition = {
    id: options.id ?? `seed-${seedHash(seed).toString(16)}`,
    difficulty,
    size,
    title: options.title ?? "种子街区",
    subtitle: options.subtitle ?? `${size}×${size} 可复现天际线`,
    note: options.note ?? `种子 ${seed}`,
    par: options.par,
    seed,
    clues,
    givens,
    solution,
  };
  let puzzle = createPuzzle(definition);
  let nextGiven = requestedGivens;
  while (countSolutions(puzzle, 2) !== 1 && nextGiven < cellOrder.length) {
    const index = cellOrder[nextGiven];
    givens.push({
      row: Math.floor(index / size),
      column: index % size,
      value: solution[Math.floor(index / size)][index % size],
    });
    nextGiven += 1;
    puzzle = createPuzzle({ ...definition, givens });
  }
  definition = {
    ...definition,
    givens,
    par: Number.isSafeInteger(options.par) && options.par >= 0
      ? options.par
      : size * size - givens.length,
  };
  for (const entry of clueOrder) {
    if (puzzle.clueCount <= targetClues) break;
    const previous = clues[entry.side][entry.index];
    clues[entry.side][entry.index] = null;
    const candidate = createPuzzle({ ...definition, clues });
    if (countSolutions(candidate, 2) === 1) puzzle = candidate;
    else clues[entry.side][entry.index] = previous;
  }
  definition = { ...definition, clues };
  puzzle = createPuzzle(definition);
  if (countSolutions(puzzle, 2) !== 1) {
    throw new Error(`Seed ${seed} did not produce a unique puzzle.`);
  }
  return puzzle;
}
