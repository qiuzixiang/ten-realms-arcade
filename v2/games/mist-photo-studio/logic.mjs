export const CELL = Object.freeze({
  UNKNOWN: 0,
  FILLED: 1,
  EXCLUDED: 2,
});

export const SESSION_VERSION = 1;
export const COLLECTION_VERSION = 1;
export const HISTORY_LIMIT = 80;

const VALID_STATES = new Set(Object.values(CELL));
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const linePatternCache = new Map();

function isSafeKey(value) {
  return typeof value === "string"
    && value !== "__proto__"
    && value !== "prototype"
    && value !== "constructor";
}

function finiteInteger(value, fallback = 0, maximum = 1_000_000) {
  return Number.isInteger(value) && value >= 0 && value <= maximum ? value : fallback;
}

function freezeClues(lines) {
  return Object.freeze(lines.map((line) => Object.freeze([...line])));
}

function solutionValue(value) {
  return value === "#" || value === 1 || value === true ? 1 : 0;
}

export function cluesForLine(values) {
  if (!values || typeof values[Symbol.iterator] !== "function") {
    throw new TypeError("A clue line must be iterable.");
  }
  const clues = [];
  let run = 0;
  for (const value of values) {
    if (solutionValue(value)) {
      run += 1;
    } else if (run > 0) {
      clues.push(run);
      run = 0;
    }
  }
  if (run > 0) clues.push(run);
  return clues;
}

export function validateClues(length, clues) {
  if (!Number.isInteger(length) || length < 1 || length > 25) return false;
  if (!Array.isArray(clues)) return false;
  if (clues.some((clue) => !Number.isInteger(clue) || clue <= 0 || clue > length)) return false;
  const required = clues.reduce((sum, clue) => sum + clue, 0) + Math.max(0, clues.length - 1);
  return required <= length;
}

export function linePatterns(length, clues) {
  if (!validateClues(length, clues)) throw new TypeError("Clues do not fit this line.");
  const cacheKey = `${length}:${clues.join(",")}`;
  if (linePatternCache.has(cacheKey)) return linePatternCache.get(cacheKey);

  const patterns = [];
  if (clues.length === 0) {
    patterns.push(Object.freeze(Array(length).fill(0)));
  } else {
    const working = Array(length).fill(0);
    const place = (clueIndex, cursor) => {
      if (clueIndex === clues.length) {
        patterns.push(Object.freeze([...working]));
        return;
      }
      const remainingRuns = clues.slice(clueIndex + 1);
      const remainingLength = remainingRuns.reduce((sum, clue) => sum + clue, 0)
        + remainingRuns.length;
      const latestStart = length - clues[clueIndex] - remainingLength;
      for (let start = cursor; start <= latestStart; start += 1) {
        for (let index = start; index < start + clues[clueIndex]; index += 1) working[index] = 1;
        place(clueIndex + 1, start + clues[clueIndex] + 1);
        for (let index = start; index < start + clues[clueIndex]; index += 1) working[index] = 0;
      }
    };
    place(0, 0);
  }

  const frozen = Object.freeze(patterns);
  linePatternCache.set(cacheKey, frozen);
  return frozen;
}

function binaryRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new TypeError("A photo must contain at least one row.");
  }
  const normalized = rows.map((row) => String(row));
  const width = normalized[0].length;
  if (width === 0 || width > 25 || normalized.length > 25) {
    throw new TypeError("Photo dimensions must be between 1 and 25 cells.");
  }
  if (normalized.some((row) => row.length !== width || /[^.#]/.test(row))) {
    throw new TypeError("Photo rows must be rectangular and contain only '.' or '#'.");
  }
  return normalized;
}

export function cluesForRows(rowsInput) {
  const rows = binaryRows(rowsInput);
  const width = rows[0].length;
  const height = rows.length;
  const rowClues = rows.map((row) => cluesForLine(row));
  const columnClues = Array.from({ length: width }, (_, column) => (
    cluesForLine(Array.from({ length: height }, (_, row) => rows[row][column]))
  ));
  return {
    width,
    height,
    rowClues: freezeClues(rowClues),
    columnClues: freezeClues(columnClues),
  };
}

function patternMatchesAssignment(pattern, assignment, offset, step) {
  for (let index = 0; index < pattern.length; index += 1) {
    const known = assignment[offset + index * step];
    if (known !== -1 && known !== pattern[index]) return false;
  }
  return true;
}

function viableLinePatterns(puzzle, assignment, kind, index) {
  const isRow = kind === "row";
  const length = isRow ? puzzle.width : puzzle.height;
  const clues = isRow ? puzzle.rowClues[index] : puzzle.columnClues[index];
  const offset = isRow ? index * puzzle.width : index;
  const step = isRow ? 1 : puzzle.width;
  return linePatterns(length, clues).filter((pattern) => (
    patternMatchesAssignment(pattern, assignment, offset, step)
  ));
}

function propagate(puzzle, assignment) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [kind, count] of [["row", puzzle.height], ["column", puzzle.width]]) {
      for (let line = 0; line < count; line += 1) {
        const viable = viableLinePatterns(puzzle, assignment, kind, line);
        if (viable.length === 0) return false;
        const isRow = kind === "row";
        const length = isRow ? puzzle.width : puzzle.height;
        const offset = isRow ? line * puzzle.width : line;
        const step = isRow ? 1 : puzzle.width;
        for (let index = 0; index < length; index += 1) {
          const value = viable[0][index];
          if (!viable.every((pattern) => pattern[index] === value)) continue;
          const cellIndex = offset + index * step;
          if (assignment[cellIndex] !== -1 && assignment[cellIndex] !== value) return false;
          if (assignment[cellIndex] === -1) {
            assignment[cellIndex] = value;
            changed = true;
          }
        }
      }
    }
  }
  return true;
}

function branchLine(puzzle, assignment) {
  let best = null;
  for (const [kind, count] of [["row", puzzle.height], ["column", puzzle.width]]) {
    for (let line = 0; line < count; line += 1) {
      const viable = viableLinePatterns(puzzle, assignment, kind, line);
      if (viable.length <= 1) continue;
      if (!best || viable.length < best.viable.length) best = { kind, line, viable };
    }
  }
  return best;
}

export function solvePuzzle(puzzle, limit = 2, initialGrid = null) {
  if (!puzzle || !Number.isInteger(puzzle.width) || !Number.isInteger(puzzle.height)) {
    throw new TypeError("A parsed puzzle is required.");
  }
  if (!Number.isInteger(limit) || limit <= 0) return [];
  const total = puzzle.width * puzzle.height;
  const start = new Int8Array(total);
  start.fill(-1);
  if (initialGrid !== null) {
    if (!Array.isArray(initialGrid) || initialGrid.length !== total) return [];
    for (let index = 0; index < total; index += 1) {
      const state = initialGrid[index];
      if (!VALID_STATES.has(state)) return [];
      if (state === CELL.FILLED) start[index] = 1;
      if (state === CELL.EXCLUDED) start[index] = 0;
    }
  }

  const solutions = [];
  const search = (candidate) => {
    if (solutions.length >= limit) return;
    const assignment = new Int8Array(candidate);
    if (!propagate(puzzle, assignment)) return;
    const branch = branchLine(puzzle, assignment);
    if (!branch) {
      if ([...assignment].some((value) => value === -1)) return;
      solutions.push([...assignment]);
      return;
    }

    const isRow = branch.kind === "row";
    const offset = isRow ? branch.line * puzzle.width : branch.line;
    const step = isRow ? 1 : puzzle.width;
    for (const pattern of branch.viable) {
      const next = new Int8Array(assignment);
      let conflict = false;
      for (let index = 0; index < pattern.length; index += 1) {
        const cellIndex = offset + index * step;
        if (next[cellIndex] !== -1 && next[cellIndex] !== pattern[index]) {
          conflict = true;
          break;
        }
        next[cellIndex] = pattern[index];
      }
      if (!conflict) search(next);
      if (solutions.length >= limit) break;
    }
  };

  search(start);
  return solutions;
}

export function countSolutions(puzzle, limit = 2, initialGrid = null) {
  return solvePuzzle(puzzle, limit, initialGrid).length;
}

export function createPuzzle(definition, { proveUnique = true } = {}) {
  if (!definition || !isSafeKey(definition.id) || !/^[a-z0-9-]{2,60}$/.test(definition.id)) {
    throw new TypeError("A safe puzzle id is required.");
  }
  const solutionRows = binaryRows(definition.solutionRows);
  const clues = cluesForRows(solutionRows);
  const solution = Object.freeze(solutionRows.flatMap((row) => [...row].map(solutionValue)));
  const puzzle = {
    ...definition,
    ...clues,
    solutionRows: Object.freeze(solutionRows),
    solution,
    par: finiteInteger(definition.par, clues.width * clues.height),
  };
  const proofCount = proveUnique ? countSolutions(puzzle, 2) : null;
  if (proveUnique && proofCount !== 1) {
    throw new Error(`Puzzle ${definition.id} must have exactly one solution; solver found ${proofCount}.`);
  }
  return Object.freeze({ ...puzzle, unique: proofCount === 1 });
}

export function transformRows(rowsInput, transform = "identity") {
  const rows = binaryRows(rowsInput).map((row) => [...row]);
  if (transform === "identity") return rows.map((row) => row.join(""));
  if (transform === "mirror-horizontal") return rows.map((row) => [...row].reverse().join(""));
  if (transform === "mirror-vertical") return [...rows].reverse().map((row) => row.join(""));
  if (transform === "rotate-180") return [...rows].reverse().map((row) => [...row].reverse().join(""));
  throw new TypeError(`Unsupported photo transform: ${transform}`);
}

export function lineAnalysis(states, clues) {
  if (!Array.isArray(states) || !states.every((state) => VALID_STATES.has(state))) {
    throw new TypeError("A line must contain only valid cell states.");
  }
  const assignment = Int8Array.from(states, (state) => (
    state === CELL.UNKNOWN ? -1 : state === CELL.FILLED ? 1 : 0
  ));
  const possibilities = linePatterns(states.length, clues).filter((pattern) => (
    patternMatchesAssignment(pattern, assignment, 0, 1)
  ));
  const decided = states.every((state) => state !== CELL.UNKNOWN);
  const actualClues = decided ? cluesForLine(states.map((state) => state === CELL.FILLED)) : null;
  const matches = decided
    && actualClues.length === clues.length
    && actualClues.every((clue, index) => clue === clues[index]);
  return {
    possible: possibilities.length > 0,
    possibilityCount: possibilities.length,
    decided,
    matches,
  };
}

export function normalizeGrid(puzzle, candidate) {
  const total = puzzle.width * puzzle.height;
  if (!Array.isArray(candidate) || candidate.length !== total) return Array(total).fill(CELL.UNKNOWN);
  return candidate.map((state) => VALID_STATES.has(state) ? state : CELL.UNKNOWN);
}

export function isStrictGrid(puzzle, candidate) {
  return Array.isArray(candidate)
    && candidate.length === puzzle.width * puzzle.height
    && candidate.every((state) => VALID_STATES.has(state));
}

export function evaluateGrid(puzzle, gridInput) {
  const grid = normalizeGrid(puzzle, gridInput);
  const rows = Array.from({ length: puzzle.height }, (_, row) => (
    lineAnalysis(grid.slice(row * puzzle.width, (row + 1) * puzzle.width), puzzle.rowClues[row])
  ));
  const columns = Array.from({ length: puzzle.width }, (_, column) => (
    lineAnalysis(
      Array.from({ length: puzzle.height }, (_, row) => grid[row * puzzle.width + column]),
      puzzle.columnClues[column],
    )
  ));
  const decidedCount = grid.filter((state) => state !== CELL.UNKNOWN).length;
  const filledCount = grid.filter((state) => state === CELL.FILLED).length;
  const complete = decidedCount === grid.length
    && rows.every((row) => row.matches)
    && columns.every((column) => column.matches);
  return {
    grid,
    rows,
    columns,
    decidedCount,
    filledCount,
    total: grid.length,
    complete,
    contradictions: rows.filter((row) => !row.possible).length
      + columns.filter((column) => !column.possible).length,
  };
}

export function cycleCell(state, reverse = false) {
  if (!VALID_STATES.has(state)) return CELL.UNKNOWN;
  if (reverse) {
    if (state === CELL.UNKNOWN) return CELL.EXCLUDED;
    if (state === CELL.EXCLUDED) return CELL.FILLED;
    return CELL.UNKNOWN;
  }
  if (state === CELL.UNKNOWN) return CELL.FILLED;
  if (state === CELL.FILLED) return CELL.EXCLUDED;
  return CELL.UNKNOWN;
}

export function applyCellState(puzzle, gridInput, index, state) {
  const grid = normalizeGrid(puzzle, gridInput);
  if (!Number.isInteger(index) || index < 0 || index >= grid.length) {
    return { accepted: false, reason: "out-of-bounds", grid, changed: false };
  }
  if (!VALID_STATES.has(state)) {
    return { accepted: false, reason: "invalid-state", grid, changed: false };
  }
  if (grid[index] === state) return { accepted: true, reason: "unchanged", grid, changed: false };
  const next = [...grid];
  next[index] = state;
  return { accepted: true, reason: "applied", grid: next, changed: true };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function strokeIndices(puzzle, start, end, state) {
  if (!puzzle || !VALID_STATES.has(state)) return [];
  if (
    !start || !end
    || !Number.isInteger(start.row) || !Number.isInteger(start.column)
    || !Number.isInteger(end.row) || !Number.isInteger(end.column)
    || start.row < 0 || start.row >= puzzle.height
    || start.column < 0 || start.column >= puzzle.width
  ) return [];

  let endRow = clamp(end.row, 0, puzzle.height - 1);
  let endColumn = clamp(end.column, 0, puzzle.width - 1);
  if (state !== CELL.UNKNOWN) {
    const rowDistance = Math.abs(endRow - start.row);
    const columnDistance = Math.abs(endColumn - start.column);
    if (columnDistance > rowDistance) endRow = start.row;
    else endColumn = start.column;
  }

  const firstRow = Math.min(start.row, endRow);
  const lastRow = Math.max(start.row, endRow);
  const firstColumn = Math.min(start.column, endColumn);
  const lastColumn = Math.max(start.column, endColumn);
  const indices = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      indices.push(row * puzzle.width + column);
    }
  }
  return indices;
}

export function applyStroke(puzzle, gridInput, start, end, state) {
  const grid = normalizeGrid(puzzle, gridInput);
  const indices = strokeIndices(puzzle, start, end, state);
  if (indices.length === 0) {
    return { accepted: false, reason: "invalid-stroke", grid, changed: false, changedCount: 0 };
  }
  const next = [...grid];
  let changedCount = 0;
  for (const index of indices) {
    if (next[index] === state) continue;
    next[index] = state;
    changedCount += 1;
  }
  return {
    accepted: true,
    reason: changedCount > 0 ? "applied" : "unchanged",
    grid: next,
    changed: changedCount > 0,
    changedCount,
  };
}

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "contact", label: "试印", note: "5 × 5 · 认识连续段", tier: 1 }),
  Object.freeze({ id: "street", label: "街景", note: "10 × 10 · 雾巷纪实", tier: 2 }),
  Object.freeze({ id: "archive", label: "馆藏", note: "15 × 15 · 长线索底片", tier: 3 }),
]);

const BASE_PHOTOS = Object.freeze([
  Object.freeze({
    id: "umbrella-corner",
    title: "街角的旧伞",
    caption: "雨停前，伞柄在石阶边轻轻偏向西侧。",
    difficulty: "contact",
    takenAt: "雾历 03 · 南码头",
    par: 25,
    solutionRows: Object.freeze([
      "..#..",
      ".###.",
      "#####",
      "..#..",
      ".##..",
    ]),
  }),
  Object.freeze({
    id: "last-tram",
    title: "末班有轨车",
    caption: "煤烟、车窗与两枚车轮，被同一束安全灯留下。",
    difficulty: "street",
    takenAt: "雾历 11 · 七钟桥",
    par: 100,
    solutionRows: Object.freeze([
      "..#.......",
      ".###......",
      "..#.......",
      "########..",
      "#.######..",
      "#########.",
      "..#....#..",
      ".###..###.",
      "..........",
      "..........",
    ]),
  }),
  Object.freeze({
    id: "fog-clocktower",
    title: "雾钟楼与月",
    caption: "月轮停在塔尖右侧，午夜的钟面没有显出数字。",
    difficulty: "archive",
    takenAt: "雾历 27 · 旧城北坡",
    par: 225,
    solutionRows: Object.freeze([
      "...........##..",
      "......#...####.",
      ".....###...##..",
      "....#####......",
      "......#........",
      ".....###.......",
      "....#.#.#......",
      "....#####......",
      "...#######.....",
      "...#..#..#.....",
      "..#########....",
      "..#...#...#....",
      ".###..#..###...",
      "#####.#.#####..",
      "###############",
    ]),
  }),
]);

const VARIANTS = Object.freeze([
  Object.freeze({ id: "original", label: "原片", transform: "identity" }),
  Object.freeze({ id: "glass", label: "玻璃倒影", transform: "mirror-horizontal" }),
  Object.freeze({ id: "turn", label: "倒置底片", transform: "rotate-180" }),
]);

export const LEVELS = Object.freeze(BASE_PHOTOS.flatMap((base) => (
  VARIANTS.map((variant, variantIndex) => createPuzzle({
    ...base,
    id: `${base.id}-${variant.id}`,
    baseId: base.id,
    title: `${base.title} · ${variant.label}`,
    variant: variant.id,
    variantIndex,
    solutionRows: transformRows(base.solutionRows, variant.transform),
  }))
)));

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function findLevel(levelId) {
  return LEVELS.find((level) => level.id === levelId) ?? null;
}

export function localDayKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return localDayKey(new Date());
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daySerial(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailyLevelFor(date = new Date()) {
  const day = localDayKey(date);
  return LEVELS[hashText(`mist-photo:${day}`) % LEVELS.length];
}

function blankCollection() {
  return {
    version: COLLECTION_VERSION,
    completed: {},
    flawless: {},
    reference: {},
    bestMoves: {},
    dailyDays: [],
  };
}

export function createCollection() {
  return blankCollection();
}

export function normalizeCollection(candidate) {
  const clean = blankCollection();
  if (!candidate || typeof candidate !== "object" || candidate.version !== COLLECTION_VERSION) return clean;
  const knownIds = new Set(LEVELS.map((level) => level.id));
  for (const field of ["completed", "flawless", "reference"]) {
    if (!candidate[field] || typeof candidate[field] !== "object" || Array.isArray(candidate[field])) continue;
    for (const [levelId, unlocked] of Object.entries(candidate[field])) {
      if (knownIds.has(levelId) && unlocked === true) clean[field][levelId] = true;
    }
  }
  if (candidate.bestMoves && typeof candidate.bestMoves === "object" && !Array.isArray(candidate.bestMoves)) {
    for (const [levelId, moves] of Object.entries(candidate.bestMoves)) {
      if (knownIds.has(levelId) && Number.isInteger(moves) && moves >= 0 && moves <= 1_000_000) {
        clean.bestMoves[levelId] = moves;
      }
    }
  }
  clean.dailyDays = Array.isArray(candidate.dailyDays)
    ? [...new Set(candidate.dailyDays.filter((day) => typeof day === "string" && DAY_PATTERN.test(day)))].sort().slice(-400)
    : [];
  return clean;
}

export function mergeCollections(...candidates) {
  const merged = blankCollection();
  const unlocked = Object.fromEntries([
    ["completed", new Set()],
    ["flawless", new Set()],
    ["reference", new Set()],
  ]);
  const bestMoves = new Map();
  const dailyDays = new Set();
  for (const candidate of candidates) {
    const normalized = normalizeCollection(candidate);
    for (const field of ["completed", "flawless", "reference"]) {
      Object.keys(normalized[field]).forEach((levelId) => unlocked[field].add(levelId));
    }
    for (const [levelId, moves] of Object.entries(normalized.bestMoves)) {
      bestMoves.set(levelId, Math.min(bestMoves.get(levelId) ?? Infinity, moves));
    }
    normalized.dailyDays.forEach((day) => dailyDays.add(day));
  }
  for (const { id } of LEVELS) {
    for (const field of ["completed", "flawless", "reference"]) {
      if (unlocked[field].has(id)) merged[field][id] = true;
    }
    if (bestMoves.has(id)) merged.bestMoves[id] = bestMoves.get(id);
  }
  merged.dailyDays = [...dailyDays].sort().slice(-400);
  return merged;
}

export function currentDailyStreak(collectionInput, now = new Date()) {
  const days = normalizeCollection(collectionInput).dailyDays;
  if (days.length === 0) return 0;
  const latestDay = daySerial(days.at(-1));
  const today = daySerial(localDayKey(now));
  if (today - latestDay > 1) return 0;
  let streak = 1;
  for (let index = days.length - 1; index > 0; index -= 1) {
    if (daySerial(days[index]) - daySerial(days[index - 1]) !== 1) break;
    streak += 1;
  }
  return streak;
}

export function recordCollectionCompletion(collectionInput, completion, now = new Date()) {
  const progress = normalizeCollection(collectionInput);
  const level = findLevel(completion?.levelId);
  if (!level) {
    return {
      progress,
      firstDevelopment: false,
      flawlessDevelopment: false,
      referenceDevelopment: false,
      personalBest: false,
      dailyFirst: false,
      streak: currentDailyStreak(progress, now),
      unlocks: [],
    };
  }
  const moves = finiteInteger(completion.moves, level.par);
  const mistakes = finiteInteger(completion.mistakes);
  const unlocks = [];
  const firstDevelopment = !progress.completed[level.id];
  if (firstDevelopment) {
    progress.completed[level.id] = true;
    unlocks.push("照片入册");
  }
  const flawlessDevelopment = mistakes === 0 && !progress.flawless[level.id];
  if (flawlessDevelopment) {
    progress.flawless[level.id] = true;
    unlocks.push("无误显影");
  }
  const referenceDevelopment = moves <= level.par && !progress.reference[level.id];
  if (referenceDevelopment) {
    progress.reference[level.id] = true;
    unlocks.push("参考曝光");
  }
  const previousBest = progress.bestMoves[level.id];
  const personalBest = Number.isInteger(previousBest) && moves < previousBest;
  if (!Number.isInteger(previousBest) || moves < previousBest) progress.bestMoves[level.id] = moves;

  let dailyFirst = false;
  if (completion.daily === true) {
    const today = localDayKey(now);
    if (!progress.dailyDays.includes(today)) {
      progress.dailyDays.push(today);
      progress.dailyDays.sort();
      dailyFirst = true;
      unlocks.push("每日底片");
    }
  }
  return {
    progress,
    firstDevelopment,
    flawlessDevelopment,
    referenceDevelopment,
    personalBest,
    dailyFirst,
    streak: currentDailyStreak(progress, now),
    unlocks,
  };
}

function blankSession(level = LEVELS[0]) {
  return {
    version: SESSION_VERSION,
    levelId: level.id,
    grid: Array(level.width * level.height).fill(CELL.UNKNOWN),
    moves: 0,
    mistakes: 0,
    history: [],
    completed: false,
    completionReported: false,
    tool: "fill",
    muted: false,
    daily: false,
    dailyDay: "",
  };
}

export function createSession(level = LEVELS[0]) {
  return blankSession(level);
}

function validSnapshot(level, snapshot) {
  return snapshot
    && typeof snapshot === "object"
    && isStrictGrid(level, snapshot.grid)
    && Number.isInteger(snapshot.moves)
    && snapshot.moves >= 0
    && snapshot.moves <= 1_000_000
    && Number.isInteger(snapshot.mistakes)
    && snapshot.mistakes >= 0
    && snapshot.mistakes <= 1_000_000
    && (snapshot.completed !== true || evaluateGrid(level, snapshot.grid).complete)
    && (snapshot.completionReported === undefined || typeof snapshot.completionReported === "boolean");
}

export function normalizeSession(candidate, fallbackLevel = LEVELS[0]) {
  const fallback = blankSession(fallbackLevel);
  if (!candidate || typeof candidate !== "object" || candidate.version !== SESSION_VERSION) {
    return { session: fallback, restored: false, invalid: candidate != null };
  }
  const level = findLevel(candidate.levelId);
  if (!level || !isStrictGrid(level, candidate.grid)) {
    return { session: fallback, restored: false, invalid: true };
  }
  const moves = finiteInteger(candidate.moves, -1);
  const mistakes = finiteInteger(candidate.mistakes, -1);
  if (moves < 0 || mistakes < 0) return { session: fallback, restored: false, invalid: true };
  if (candidate.completed === true && !evaluateGrid(level, candidate.grid).complete) {
    return { session: fallback, restored: false, invalid: true };
  }
  const history = Array.isArray(candidate.history)
    ? candidate.history.filter((snapshot) => validSnapshot(level, snapshot)).slice(-HISTORY_LIMIT).map((snapshot) => ({
      grid: [...snapshot.grid],
      moves: snapshot.moves,
      mistakes: snapshot.mistakes,
      completed: snapshot.completed === true,
      completionReported: snapshot.completionReported === true,
    }))
    : [];
  const daily = candidate.daily === true && DAY_PATTERN.test(candidate.dailyDay ?? "");
  return {
    session: {
      version: SESSION_VERSION,
      levelId: level.id,
      grid: [...candidate.grid],
      moves,
      mistakes,
      history,
      completed: candidate.completed === true,
      completionReported: candidate.completionReported === true,
      tool: ["fill", "exclude", "erase"].includes(candidate.tool) ? candidate.tool : "fill",
      muted: candidate.muted === true,
      daily,
      dailyDay: daily ? candidate.dailyDay : "",
    },
    restored: true,
    invalid: history.length !== (Array.isArray(candidate.history) ? Math.min(candidate.history.length, HISTORY_LIMIT) : 0),
  };
}
