export const ENGINE_VERSION = 1;
export const TARGET_LIGHT = 1;
export const MAX_EXACT_NULLITY = 20;

function binary(value) {
  return value === true || value === 1 ? 1 : value === false || value === 0 ? 0 : null;
}

function validIndex(value, size) {
  return Number.isInteger(value) && value >= 0 && value < size;
}

function copyBits(values, expectedLength) {
  if (!Array.isArray(values) || values.length !== expectedLength) return null;
  const bits = values.map(binary);
  return bits.includes(null) ? null : bits;
}

export function cellIndex(level, row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column)
      || row < 0 || column < 0 || row >= level.height || column >= level.width) return -1;
  return row * level.width + column;
}

export function cellCoordinates(level, index) {
  const size = level.width * level.height;
  return validIndex(index, size)
    ? Object.freeze({ row: Math.floor(index / level.width), column: index % level.width })
    : null;
}

export function validateLevel(level) {
  if (!level || typeof level !== "object"
      || typeof level.id !== "string" || !/^[a-z0-9][a-z0-9-]{2,48}$/.test(level.id)
      || !["easy", "medium", "hard"].includes(level.difficulty)
      || !Number.isInteger(level.tier) || level.tier < 1 || level.tier > 3
      || !Number.isInteger(level.width) || level.width < 2 || level.width > 7
      || !Number.isInteger(level.height) || level.height < 2 || level.height > 7) return false;
  const size = level.width * level.height;
  if (!copyBits(level.initial, size)
      || !Array.isArray(level.templates) || level.templates.length !== size) return false;
  const signatures = new Set();
  for (let index = 0; index < size; index += 1) {
    const template = level.templates[index];
    if (!Array.isArray(template) || template.length < 1 || template.length > size
        || !template.includes(index)
        || template.some((target) => !validIndex(target, size))
        || new Set(template).size !== template.length) return false;
    signatures.add([...template].sort((a, b) => a - b).join(","));
  }
  return signatures.size === size;
}

export function createState(level) {
  if (!validateLevel(level)) throw new TypeError("Invalid resonance level.");
  const size = level.width * level.height;
  return Object.freeze({
    lights: Object.freeze([...level.initial]),
    pressParity: Object.freeze(Array(size).fill(0)),
    history: Object.freeze([]),
    moves: 0,
  });
}

export function normalizeState(level, candidate) {
  if (!validateLevel(level) || !candidate || typeof candidate !== "object") return null;
  const size = level.width * level.height;
  const history = Array.isArray(candidate.history) && candidate.history.length <= 10000
    && candidate.history.every((index) => validIndex(index, size))
    ? [...candidate.history]
    : null;
  if (!history) return null;
  return replayPresses(level, history);
}

export function affectedCells(level, index) {
  if (!validateLevel(level) || !validIndex(index, level.width * level.height)) return Object.freeze([]);
  return Object.freeze([...level.templates[index]]);
}

function transition(level, state, index, appendHistory) {
  const lights = [...state.lights];
  for (const target of level.templates[index]) lights[target] ^= 1;
  const pressParity = [...state.pressParity];
  pressParity[index] ^= 1;
  const history = appendHistory ? [...state.history, index] : state.history.slice(0, -1);
  return Object.freeze({
    lights: Object.freeze(lights),
    pressParity: Object.freeze(pressParity),
    history: Object.freeze(history),
    moves: history.length,
  });
}

export function pressCell(level, state, index) {
  const normalized = normalizeState(level, state);
  if (!normalized || !validIndex(index, level.width * level.height)) return state;
  return transition(level, normalized, index, true);
}

export function undoPress(level, state) {
  const normalized = normalizeState(level, state);
  if (!normalized || normalized.history.length === 0) return state;
  return transition(level, normalized, normalized.history.at(-1), false);
}

export function replayPresses(level, history = []) {
  if (!validateLevel(level) || !Array.isArray(history)
      || history.length > 10000
      || history.some((index) => !validIndex(index, level.width * level.height))) return null;
  const size = level.width * level.height;
  const lights = [...level.initial];
  const pressParity = Array(size).fill(0);
  for (const index of history) {
    pressParity[index] ^= 1;
    for (const target of level.templates[index]) lights[target] ^= 1;
  }
  return Object.freeze({
    lights: Object.freeze(lights),
    pressParity: Object.freeze(pressParity),
    history: Object.freeze([...history]),
    moves: history.length,
  });
}

export function evaluateState(level, state) {
  const normalized = normalizeState(level, state);
  if (!normalized) return Object.freeze({ valid: false, complete: false, lit: 0, total: 0, dark: Object.freeze([]) });
  const dark = [];
  normalized.lights.forEach((light, index) => { if (light !== TARGET_LIGHT) dark.push(index); });
  return Object.freeze({
    valid: true,
    complete: dark.length === 0,
    lit: normalized.lights.length - dark.length,
    total: normalized.lights.length,
    dark: Object.freeze(dark),
  });
}

export function isSolved(level, state) {
  return evaluateState(level, state).complete;
}

function xorRow(target, source) {
  for (let index = 0; index < target.length; index += 1) target[index] ^= source[index];
}

function vectorWeight(vector) {
  let weight = 0;
  for (const bit of vector) weight += bit;
  return weight;
}

function compareVectors(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

/**
 * Solve A·x=b over GF(2), where every column is one bell's private influence
 * template. The solver reads no author taps or cached answer from a level.
 */
export function solveMinimum(level, lights = level?.initial) {
  if (!validateLevel(level)) throw new TypeError("Invalid resonance level.");
  const size = level.width * level.height;
  const start = copyBits(lights, size);
  if (!start) throw new TypeError("Invalid light vector.");

  const rows = Array.from({ length: size }, (_, output) => {
    const row = Array(size + 1).fill(0);
    for (let input = 0; input < size; input += 1) {
      row[input] = level.templates[input].includes(output) ? 1 : 0;
    }
    row[size] = start[output] ^ TARGET_LIGHT;
    return row;
  });

  const pivotColumns = [];
  let pivotRow = 0;
  for (let column = 0; column < size && pivotRow < size; column += 1) {
    const found = rows.findIndex((row, rowIndex) => rowIndex >= pivotRow && row[column] === 1);
    if (found < 0) continue;
    [rows[pivotRow], rows[found]] = [rows[found], rows[pivotRow]];
    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      if (rowIndex !== pivotRow && rows[rowIndex][column]) xorRow(rows[rowIndex], rows[pivotRow]);
    }
    pivotColumns.push(column);
    pivotRow += 1;
  }

  for (let rowIndex = pivotRow; rowIndex < size; rowIndex += 1) {
    if (rows[rowIndex][size]) {
      return Object.freeze({
        solvable: false,
        minimumProven: true,
        minimumTaps: null,
        presses: Object.freeze([]),
        solutionCount: 0,
        rank: pivotColumns.length,
        nullity: size - pivotColumns.length,
      });
    }
  }

  const pivotSet = new Set(pivotColumns);
  const freeColumns = Array.from({ length: size }, (_, index) => index)
    .filter((index) => !pivotSet.has(index));
  const particular = Array(size).fill(0);
  pivotColumns.forEach((column, rowIndex) => { particular[column] = rows[rowIndex][size]; });
  const basis = freeColumns.map((freeColumn) => {
    const vector = Array(size).fill(0);
    vector[freeColumn] = 1;
    pivotColumns.forEach((column, rowIndex) => { vector[column] = rows[rowIndex][freeColumn]; });
    return vector;
  });

  if (basis.length > MAX_EXACT_NULLITY) {
    const presses = particular.flatMap((bit, index) => bit ? [index] : []);
    return Object.freeze({
      solvable: true,
      minimumProven: false,
      minimumTaps: null,
      presses: Object.freeze(presses),
      solutionCount: 2 ** basis.length,
      rank: pivotColumns.length,
      nullity: basis.length,
    });
  }

  let best = [...particular];
  let bestWeight = vectorWeight(best);
  const combinations = 2 ** basis.length;
  for (let mask = 1; mask < combinations; mask += 1) {
    const candidate = [...particular];
    for (let bit = 0; bit < basis.length; bit += 1) {
      if ((mask >>> bit) & 1) xorRow(candidate, basis[bit]);
    }
    const weight = vectorWeight(candidate);
    if (weight < bestWeight || (weight === bestWeight && compareVectors(candidate, best) < 0)) {
      best = candidate;
      bestWeight = weight;
    }
  }
  const presses = best.flatMap((bit, index) => bit ? [index] : []);
  return Object.freeze({
    solvable: true,
    minimumProven: true,
    minimumTaps: bestWeight,
    presses: Object.freeze(presses),
    solutionCount: combinations,
    rank: pivotColumns.length,
    nullity: basis.length,
  });
}

export function applySolution(level, lights = level?.initial) {
  const solution = solveMinimum(level, lights);
  if (!solution.solvable) return null;
  const start = copyBits(lights, level.width * level.height);
  const synthetic = Object.freeze({
    lights: Object.freeze(start),
    pressParity: Object.freeze(Array(start.length).fill(0)),
    history: Object.freeze([]),
    moves: 0,
  });
  return solution.presses.reduce((state, index) => pressCell(level, state, index), synthetic);
}

export function bitString(bits) {
  return Array.isArray(bits) && bits.every((bit) => binary(bit) !== null)
    ? bits.map(binary).join("")
    : "";
}
