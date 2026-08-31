import {
  countPerfectMatchings,
  createPuzzle,
  keyOf,
  pointFromKey,
  provePuzzle,
} from "./logic.mjs";

export function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function neighbours(width, height, key) {
  const { row, column } = pointFromKey(key);
  return [
    [row - 1, column],
    [row, column + 1],
    [row + 1, column],
    [row, column - 1],
  ].filter(([nextRow, nextColumn]) => (
    nextRow >= 0 && nextColumn >= 0 && nextRow < height && nextColumn < width
  )).map(([nextRow, nextColumn]) => keyOf(nextRow, nextColumn));
}

function tentsTouch(leftKey, rightKey) {
  const left = pointFromKey(leftKey);
  const right = pointFromKey(rightKey);
  return Math.abs(left.row - right.row) <= 1 && Math.abs(left.column - right.column) <= 1;
}

function chooseTents(width, height, count, random) {
  const cells = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) cells.push(keyOf(row, column));
  }
  const tents = [];
  for (const key of shuffle(cells, random)) {
    if (tents.every((tentKey) => !tentsTouch(key, tentKey))) tents.push(key);
    if (tents.length === count) return tents.sort();
  }
  return null;
}

function chooseTrees(width, height, tents, random) {
  const tentSet = new Set(tents);
  const ordered = shuffle(tents, random)
    .map((tentKey) => ({
      tentKey,
      options: shuffle(
        neighbours(width, height, tentKey).filter((key) => !tentSet.has(key)),
        random,
      ),
    }))
    .sort((left, right) => left.options.length - right.options.length);
  const used = new Set();
  function assign(index) {
    if (index === ordered.length) return true;
    for (const treeKey of ordered[index].options) {
      if (used.has(treeKey)) continue;
      used.add(treeKey);
      if (assign(index + 1)) return true;
      used.delete(treeKey);
    }
    return false;
  }
  return assign(0) ? [...used].sort() : null;
}

function cluesFor(width, height, tents) {
  const rows = Array(height).fill(0);
  const columns = Array(width).fill(0);
  for (const key of tents) {
    const point = pointFromKey(key);
    rows[point.row] += 1;
    columns[point.column] += 1;
  }
  return { rows, columns };
}

export function generateUniquePuzzle(configuration) {
  const width = Number(configuration?.width);
  const height = Number(configuration?.height);
  const tentCount = Number(configuration?.tentCount ?? Math.floor(width * height / 5));
  const seed = Number(configuration?.seed ?? 1) >>> 0;
  const attempts = Math.max(1, Math.floor(configuration?.attempts ?? 4000));
  const minNodes = Math.max(0, Math.floor(configuration?.minNodes ?? 0));
  const random = seededRandom(seed);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const tents = chooseTents(width, height, tentCount, random);
    if (!tents) continue;
    const trees = chooseTrees(width, height, tents, random);
    if (!trees) continue;
    const clues = cluesFor(width, height, tents);
    let puzzle;
    try {
      puzzle = createPuzzle({
        id: String(configuration.id ?? `seed-${seed}`),
        title: String(configuration.title ?? "种子营地"),
        difficulty: String(configuration.difficulty ?? "trail"),
        width,
        height,
        trees,
        rowClues: clues.rows,
        columnClues: clues.columns,
        solution: tents,
        par: Number(configuration.par ?? tentCount + Math.ceil(width / 2)),
        seed,
      });
    } catch {
      continue;
    }
    if (countPerfectMatchings(puzzle, tents, 2) !== 1) continue;
    const proof = provePuzzle(puzzle);
    if (!proof.unique || proof.nodes < minNodes) continue;
    return Object.freeze({ puzzle, proof, attempt: attempt + 1 });
  }
  throw new Error(`Unable to generate a unique ${width}×${height} Tents puzzle from seed ${seed}.`);
}

export function puzzleSignature(puzzle) {
  return [
    `${puzzle.width}x${puzzle.height}`,
    [...puzzle.trees].sort().join(";"),
    puzzle.rowClues.join(""),
    puzzle.columnClues.join(""),
  ].join("|");
}
