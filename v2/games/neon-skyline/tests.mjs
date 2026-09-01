import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  DIFFICULTIES,
  SIDE,
  SIDES,
  applyMove,
  clueKey,
  cluesForGrid,
  countSolutions,
  createPuzzle,
  evaluatePosition,
  generateLatinSquare,
  generatePuzzle,
  initialPosition,
  isLatinGrid,
  isStrictPosition,
  keyOf,
  lineFromGrid,
  normalizePosition,
  partialClueState,
  pointFromKey,
  positionToJSON,
  solvePuzzle,
  visibleCount,
} from "./logic.mjs";
import { LEVELS, findLevel, levelsForDifficulty } from "./levels.mjs";
import {
  HISTORY_LIMIT,
  LANDMARKS,
  REALM_ID,
  SAVE_VERSION,
  applySessionMove,
  cityProgress,
  confirmCompletionReport,
  createSession,
  createSkylineRunId,
  enqueueSkylineCompletion,
  emptyStats,
  mergeStats,
  normalizeSkylineOutbox,
  recordCompletion,
  restartSession,
  restoreSave,
  serializeSave,
  skylineCompletionEventId,
  stageCompletion,
  undoSession,
} from "./session.mjs";
import { REALM_TUTORIALS, tutorialArt } from "../../shared/tutorial-data.mjs";
import { awardCompletion, createProgress } from "../../shared/reward-engine.mjs";

const tests = [];
let assertions = 0;

function test(name, callback) {
  tests.push({ name, callback });
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function notDeepEqual(actual, expected, message) {
  assertions += 1;
  assert.notDeepEqual(actual, expected, message);
}

function notEqual(actual, expected, message) {
  assertions += 1;
  assert.notEqual(actual, expected, message);
}

function match(actual, expected, message) {
  assertions += 1;
  assert.match(actual, expected, message);
}

function throws(callback, expected, message) {
  assertions += 1;
  assert.throws(callback, expected, message);
}

function doesNotThrow(callback, message) {
  assertions += 1;
  assert.doesNotThrow(callback, message);
}

const AUTHORITATIVE_4X4 = Object.freeze([
  Object.freeze([1, 2, 3, 4]),
  Object.freeze([2, 3, 4, 1]),
  Object.freeze([3, 4, 1, 2]),
  Object.freeze([4, 1, 2, 3]),
]);

const AUTHORITATIVE_CLUES = Object.freeze({
  top: Object.freeze([4, 3, 2, 1]),
  bottom: Object.freeze([1, 2, 2, 2]),
  left: Object.freeze([4, 3, 2, 1]),
  right: Object.freeze([1, 2, 2, 2]),
});

function allMissingClues(size) {
  return Object.fromEntries(SIDES.map((side) => [side, Array(size).fill(null)]));
}

function fixturePuzzle(overrides = {}) {
  const size = overrides.size ?? 4;
  const solution = overrides.solution ?? (size === 4
    ? AUTHORITATIVE_4X4
    : Array.from({ length: size }, (_, row) => (
      Array.from({ length: size }, (_, column) => (row + column) % size + 1)
    )));
  return createPuzzle({
    id: "test-skyline",
    difficulty: "block",
    title: "测试街区",
    size,
    solution,
    clues: overrides.clues ?? allMissingClues(size),
    givens: overrides.givens ?? [],
    par: overrides.par ?? size * size,
    ...overrides,
  });
}

function completedSession(level, overrides = {}) {
  const base = createSession(level, { levels: LEVELS });
  return {
    ...base,
    values: level.solution.flat(),
    notes: Array(level.size * level.size).fill(0),
    clueDone: new Set(),
    moves: level.par,
    completed: true,
    ...overrides,
  };
}

function cloneSave(save) {
  return structuredClone(save);
}

test("the authoritative 4×4 fixture has the exact four-direction clues", () => {
  deepEqual(cluesForGrid(AUTHORITATIVE_4X4), AUTHORITATIVE_CLUES);
  for (const side of SIDES) {
    for (let index = 0; index < 4; index += 1) {
      equal(
        visibleCount(lineFromGrid(AUTHORITATIVE_4X4, side, index)),
        AUTHORITATIVE_CLUES[side][index],
        `${side} clue ${index + 1}`,
      );
    }
  }
});

test("visibility counts rising, falling, plateaus, and saw-tooth skylines", () => {
  equal(visibleCount([1, 2, 3, 4]), 4, "strictly rising reveals every tower");
  equal(visibleCount([4, 3, 2, 1]), 1, "strictly falling reveals only the first tower");
  equal(visibleCount([2, 1, 4, 3]), 2, "a taller later peak hides both shorter followers");
  equal(visibleCount([1, 3, 2, 4]), 3, "saw-tooth visibility increases only at record highs");
  equal(visibleCount([2, 2, 3, 1]), 2, "equal height is not a new visible tower");
  throws(() => visibleCount("1234"), TypeError);
  throws(() => visibleCount([1, Number.NaN]), TypeError);
});

test("top, bottom, left, and right use the same index without mirroring it", () => {
  const labelled = [
    [11, 12, 13, 14],
    [21, 22, 23, 24],
    [31, 32, 33, 34],
    [41, 42, 43, 44],
  ];
  deepEqual(lineFromGrid(labelled, SIDE.TOP, 1), [12, 22, 32, 42]);
  deepEqual(lineFromGrid(labelled, SIDE.BOTTOM, 1), [42, 32, 22, 12]);
  deepEqual(lineFromGrid(labelled, SIDE.LEFT, 1), [21, 22, 23, 24]);
  deepEqual(lineFromGrid(labelled, SIDE.RIGHT, 1), [24, 23, 22, 21]);
  throws(() => lineFromGrid(labelled, SIDE.TOP, -1), RangeError);
  throws(() => lineFromGrid(labelled, SIDE.TOP, 4), RangeError);
  throws(() => lineFromGrid(labelled, "north", 0), RangeError);
});

test("coordinate and clue keys are canonical and reject malformed values", () => {
  equal(keyOf(2, 3), "2:3");
  deepEqual(pointFromKey("12:30"), { row: 12, column: 30 });
  equal(pointFromKey("-1:2"), null);
  equal(pointFromKey("01:2"), null);
  equal(pointFromKey("bad"), null);
  equal(clueKey(SIDE.RIGHT, 3), "right:3");
});

test("Latin validation requires every in-range height once in each row and column", () => {
  equal(isLatinGrid(AUTHORITATIVE_4X4), true);
  equal(isLatinGrid([[1, 2], [2, 1]]), true);
  equal(isLatinGrid([[1, 2, 3], [2, 3, 1]]), false, "missing row");
  equal(isLatinGrid([[1, 2, 3], [2, 3, 1], [3, 1]]), false, "ragged row");
  equal(isLatinGrid([[1, 2, 3], [2, 3, 1], [3, 1, 0]]), false, "missing height");
  equal(isLatinGrid([[1, 1, 3], [2, 3, 1], [3, 2, 2]]), false, "row duplicates");
  equal(isLatinGrid([[1, 2, 3], [1, 3, 2], [3, 1, 2]]), false, "column duplicates");
  equal(isLatinGrid([[1, 2, 4], [2, 3, 1], [3, 1, 2]]), false, "out-of-range height");
});

test("puzzle construction rejects invalid Latin, clues, and givens", () => {
  throws(() => fixturePuzzle({ solution: [[1, 2, 3, 4], [2, 3, 4, 1], [3, 4, 1, 2], [4, 1, 3, 2]] }), /Latin/i);
  throws(() => fixturePuzzle({ solution: [[0, 2, 3, 4], [2, 3, 4, 1], [3, 4, 1, 2], [4, 1, 2, 3]] }), /1 to 4/i);
  throws(() => fixturePuzzle({ clues: { ...allMissingClues(4), top: [5, null, null, null] } }), /Clues/i);
  throws(() => fixturePuzzle({ clues: { ...allMissingClues(4), left: [3, null, null, null] } }), /violates/i);
  throws(() => fixturePuzzle({ givens: [{ row: 0, column: 0, value: 2 }] }), /match/i);
  throws(() => fixturePuzzle({ givens: [
    { row: 0, column: 0, value: 1 },
    { row: 0, column: 0, value: 1 },
  ] }), /two givens/i);
  throws(() => fixturePuzzle({ givens: [{ row: 4, column: 0, value: 1 }] }), /in-range/i);
});

test("evaluation catches row and column duplicates and never completes with a hole", () => {
  const puzzle = fixturePuzzle();
  const duplicateRow = evaluatePosition(puzzle, {
    values: [1, 1, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2, 4, 2, 2, 3],
  });
  ok(duplicateRow.conflictCells.has("0:0"));
  ok(duplicateRow.conflictCells.has("0:1"));
  ok(duplicateRow.rowStates[0].duplicates.includes(0));
  equal(duplicateRow.complete, false);

  const duplicateColumn = evaluatePosition(puzzle, {
    values: [1, 2, 3, 4, 1, 3, 4, 2, 3, 4, 2, 1, 4, 1, 2, 3],
  });
  ok(duplicateColumn.conflictCells.has("0:0"));
  ok(duplicateColumn.conflictCells.has("1:0"));
  ok(duplicateColumn.columnStates[0].duplicates.includes(0));
  equal(duplicateColumn.complete, false);

  const missing = [...AUTHORITATIVE_4X4.flat()];
  missing[7] = 0;
  const incomplete = evaluatePosition(puzzle, { values: missing });
  equal(incomplete.empty, 1);
  equal(incomplete.complete, false);
  const normalized = normalizePosition(puzzle, { values: [...missing.slice(0, 1), 99, ...missing.slice(2)] });
  equal(normalized.values[1], 0, "out-of-range persisted values safely become holes");
});

test("missing clues are ignored by evaluation and cannot be marked done", () => {
  const puzzle = fixturePuzzle();
  const solved = evaluatePosition(puzzle, { values: AUTHORITATIVE_4X4.flat() });
  equal(puzzle.clueCount, 0);
  equal(solved.exactClues, 0);
  equal(solved.clueConflicts, 0);
  equal(solved.complete, true);
  for (const state of solved.clueStates.values()) {
    equal(state.missing, true);
    equal(state.conflict, false);
  }
  const move = applyMove(puzzle, initialPosition(puzzle), {
    type: "toggle-clue", side: SIDE.TOP, index: 0,
  });
  equal(move.accepted, false);
  equal(move.reason, "missing-clue");
});

test("partial clue conflicts match all four upstream Towers boundary cases", () => {
  const exceeded = partialClueState([1, 2, 3, 0], 2, 4);
  deepEqual(
    { visible: exceeded.visible, highest: exceeded.highest, prefixLength: exceeded.prefixLength, conflict: exceeded.conflict },
    { visible: 3, highest: 3, prefixLength: 3, conflict: true },
    "seen count above clue is already impossible",
  );

  const tallestTooSoon = partialClueState([2, 4, 0, 0], 3, 4);
  deepEqual(
    { visible: tallestTooSoon.visible, highest: tallestTooSoon.highest, conflict: tallestTooSoon.conflict },
    { visible: 2, highest: 4, conflict: true },
    "once height N appears, an unmet clue can no longer increase",
  );

  const targetWithoutTallest = partialClueState([2, 0, 4, 3], 1, 4);
  deepEqual(
    { visible: targetWithoutTallest.visible, highest: targetWithoutTallest.highest, prefixLength: targetWithoutTallest.prefixLength, conflict: targetWithoutTallest.conflict },
    { visible: 1, highest: 2, prefixLength: 1, conflict: true },
    "reaching the clue before N forces a later excess; cells after the first hole are unknown",
  );

  const stillFeasible = partialClueState([2, 0, 4, 3], 2, 4);
  deepEqual(
    { visible: stillFeasible.visible, highest: stillFeasible.highest, prefixLength: stillFeasible.prefixLength, conflict: stillFeasible.conflict },
    { visible: 1, highest: 2, prefixLength: 1, conflict: false },
    "an unmet clue with N still available remains feasible",
  );

  const exact = partialClueState([2, 1, 4, 3], 2, 4);
  equal(exact.full, true);
  equal(exact.exact, true);
  equal(exact.conflict, false);
  deepEqual(partialClueState([4, 3, 2, 1], null, 4), {
    missing: true, visible: 0, highest: 0, prefixLength: 0, exact: false, conflict: false,
  });
});

test("given towers cannot be changed, cleared, or annotated", () => {
  const puzzle = fixturePuzzle({ givens: [{ row: 0, column: 0, value: 1 }] });
  const start = initialPosition(puzzle);
  equal(start.values[0], 1);
  for (const move of [
    { type: "set-value", row: 0, column: 0, value: 4 },
    { type: "set-value", row: 0, column: 0, value: 0 },
    { type: "toggle-note", row: 0, column: 0, value: 2 },
  ]) {
    const result = applyMove(puzzle, start, move);
    equal(result.accepted, false);
    equal(result.reason, "given");
    equal(result.values[0], 1);
    equal(result.notes[0], 0);
  }
  const normalized = normalizePosition(puzzle, {
    values: Array(16).fill(0),
    notes: Array(16).fill(30),
  });
  equal(normalized.values[0], 1, "normalization restores a corrupted given");
  equal(normalized.notes[0], 0);
});

test("candidate toggles, fill-all, and real values follow upstream pencil semantics", () => {
  const puzzle = fixturePuzzle({ givens: [{ row: 0, column: 0, value: 1 }] });
  let position = initialPosition(puzzle);
  let move = applyMove(puzzle, position, { type: "toggle-note", row: 0, column: 1, value: 2 });
  equal(move.accepted, true);
  equal(move.notes[1], 1 << 2);
  move = applyMove(puzzle, move, { type: "toggle-note", row: 0, column: 1, value: 4 });
  equal(move.notes[1], (1 << 2) | (1 << 4));
  move = applyMove(puzzle, move, { type: "toggle-note", row: 0, column: 1, value: 2 });
  equal(move.notes[1], 1 << 4, "entering the same pencil digit erases it");

  const filled = applyMove(puzzle, move, { type: "fill-notes" });
  const fullMask = (1 << 2) | (1 << 3) | (1 << 4) | (1 << 1);
  equal(filled.accepted, true);
  equal(filled.notes[0], 0, "given stays unannotated");
  equal(filled.notes[1], fullMask);
  equal(filled.notes.filter((mask) => mask === fullMask).length, 15);
  const unchanged = applyMove(puzzle, filled, { type: "fill-notes" });
  equal(unchanged.accepted, false);
  equal(unchanged.reason, "unchanged");

  const built = applyMove(puzzle, filled, { type: "set-value", row: 0, column: 1, value: 2 });
  equal(built.accepted, true);
  equal(built.effect, "tower-built");
  equal(built.values[1], 2);
  equal(built.notes[1], 0, "a real value clears every pencil digit in its cell");
  const cleared = applyMove(puzzle, built, { type: "set-value", row: 0, column: 1, value: 0 });
  equal(cleared.accepted, true);
  equal(cleared.effect, "tower-cleared");
  equal(cleared.notes[1], 0, "clearing a real value also leaves pencils erased");
});

test("candidate digits and clue-done marks never affect evaluation or victory", () => {
  const puzzle = fixturePuzzle({ clues: AUTHORITATIVE_CLUES });
  const blank = evaluatePosition(puzzle, initialPosition(puzzle));
  const pencilOnly = evaluatePosition(puzzle, {
    values: Array(16).fill(0),
    notes: Array(16).fill(30),
    clueDone: new Set(["top:0", "right:3"]),
  });
  equal(pencilOnly.filled, blank.filled);
  equal(pencilOnly.conflicts, blank.conflicts);
  equal(pencilOnly.complete, blank.complete);
  equal(pencilOnly.clueStates.get("top:0").done, true);

  const solvedWithInjectedNotes = evaluatePosition(puzzle, {
    values: AUTHORITATIVE_4X4.flat(),
    notes: Array(16).fill(30),
    clueDone: new Set(),
  });
  equal(solvedWithInjectedNotes.complete, true);
  ok(solvedWithInjectedNotes.notes.every((mask) => mask === 0));
  equal(solvedWithInjectedNotes.exactClues, puzzle.clueCount);
});

test("moves are pure and every illegal move is an atomic no-op", () => {
  const puzzle = fixturePuzzle();
  const source = {
    values: Array(16).fill(0),
    notes: Array(16).fill(0),
    clueDone: new Set(),
  };
  const before = positionToJSON(source);
  const built = applyMove(puzzle, source, { type: "set-value", key: "0:0", value: 1 });
  deepEqual(positionToJSON(source), before, "accepted move does not mutate input");
  notEqual(built.values, source.values);
  notEqual(built.notes, source.notes);
  notEqual(built.clueDone, source.clueDone);

  for (const move of [
    { type: "set-value", row: -1, column: 0, value: 1 },
    { type: "set-value", row: 0, column: 0, value: 5 },
    { type: "toggle-note", row: 0, column: 0, value: 0 },
    { type: "toggle-clue", side: "north", index: 0 },
    { type: "unknown", row: 0, column: 0 },
  ]) {
    const rejected = applyMove(puzzle, source, move);
    equal(rejected.accepted, false);
    deepEqual(positionToJSON(rejected), before, `${move.type} leaves the full position unchanged`);
    deepEqual(positionToJSON(source), before, `${move.type} leaves its input unchanged`);
  }
});

test("strict positions reject malformed values, notes, givens, and clue marks", () => {
  const puzzle = fixturePuzzle({
    clues: AUTHORITATIVE_CLUES,
    givens: [{ row: 0, column: 0, value: 1 }],
  });
  const strict = positionToJSON(initialPosition(puzzle));
  equal(isStrictPosition(puzzle, strict), true);
  equal(isStrictPosition(puzzle, { ...strict, values: strict.values.slice(1) }), false);
  equal(isStrictPosition(puzzle, { ...strict, values: strict.values.map((value, index) => index ? value : 2) }), false);
  equal(isStrictPosition(puzzle, { ...strict, notes: strict.notes.map((value, index) => index === 1 ? 1 : value) }), false);
  equal(isStrictPosition(puzzle, { ...strict, clueDone: ["north:0"] }), false);
  equal(isStrictPosition(puzzle, { ...strict, clueDone: ["top:0", "top:0"] }), false);
  equal(isStrictPosition(puzzle, { ...strict, clueDone: ["top:4"] }), false);
});

test("solver distinguishes unique, impossible, and ambiguous puzzles", () => {
  const unique = LEVELS[0];
  const uniqueSolutions = solvePuzzle(unique, { limit: 2 });
  equal(uniqueSolutions.length, 1);
  deepEqual(uniqueSolutions[0], unique.solution.flat());
  equal(countSolutions(unique, 2), 1);

  const impossible = {
    ...fixturePuzzle(),
    givens: [
      { row: 0, column: 0, value: 1 },
      { row: 0, column: 1, value: 1 },
    ],
  };
  deepEqual(solvePuzzle(impossible, { limit: 2 }), []);
  equal(countSolutions(impossible, 2), 0);

  const ambiguous = fixturePuzzle({ size: 3 });
  const two = solvePuzzle(ambiguous, { limit: 2 });
  equal(two.length, 2, "the uncued 3×3 Latin square has multiple solutions");
  ok(two.every((solution) => isLatinGrid([
    solution.slice(0, 3), solution.slice(3, 6), solution.slice(6, 9),
  ])));
  deepEqual(solvePuzzle(ambiguous, { limit: 0 }), []);
  throws(() => solvePuzzle(ambiguous, { limit: -1 }), RangeError);
  throws(() => solvePuzzle(ambiguous, { limit: 1.5 }), RangeError);
  throws(() => solvePuzzle(ambiguous, { limit: Number.NaN }), RangeError);
});

test("the cell solver preserves the upstream 3..9 size boundary", () => {
  const size = 9;
  const solution = generateLatinSquare(size, "nine-by-nine");
  const fullyGiven = fixturePuzzle({
    id: "nine-by-nine",
    size,
    difficulty: "megacity",
    solution,
    clues: allMissingClues(size),
    givens: solution.flatMap((row, rowIndex) => row.map((value, column) => ({
      row: rowIndex,
      column,
      value,
    }))),
  });
  const solutions = solvePuzzle(fullyGiven, { limit: 2 });
  equal(solutions.length, 1);
  deepEqual(solutions[0], solution.flat());
  equal(evaluatePosition(fullyGiven, { values: solutions[0] }).complete, true);
  equal(createSession(fullyGiven).completed, true, "an all-given solved puzzle starts completed");
  equal(restartSession(fullyGiven, createSession(fullyGiven)).completed, true);
});

test("Latin and puzzle generators are deterministic, varied, legal, and unique", () => {
  const first = generateLatinSquare(5, "metro-seed");
  const again = generateLatinSquare(5, "metro-seed");
  const other = generateLatinSquare(5, "different-seed");
  deepEqual(first, again);
  notDeepEqual(first, other, "different seeds should alter the generated Latin square");
  equal(isLatinGrid(first), true);
  equal(isLatinGrid(other), true);
  throws(() => generateLatinSquare(2, "small"), RangeError);
  throws(() => generateLatinSquare(10, "large"), RangeError);

  const options = {
    id: "generated-test",
    size: 4,
    difficulty: "block",
    seed: "night-loop-17",
    clueCount: 9,
    givens: 1,
  };
  const generated = generatePuzzle(options);
  const regenerated = generatePuzzle(options);
  deepEqual(generated.solution, regenerated.solution);
  deepEqual(generated.clues, regenerated.clues);
  deepEqual(generated.givens, regenerated.givens);
  equal(isLatinGrid(generated.solution), true);
  equal(countSolutions(generated, 2), 1);
  equal(evaluatePosition(generated, { values: generated.solution.flat() }).complete, true);
  ok(generated.clueCount >= options.clueCount, "uniqueness may require retaining extra clues");
  ok(generated.givens.length >= options.givens, "uniqueness may require retaining extra givens");
  equal(generated.par, generated.size * generated.size - generated.givens.length);

  const compact = generatePuzzle({
    id: "generated-tiny",
    size: 3,
    seed: "tiny-complete",
    clueCount: 0,
    givens: 9,
  });
  equal(compact.difficulty, "block", "3×3 generation uses the nearest interactive profile");
  equal(compact.par, 0, "an all-given puzzle keeps its real zero-move par");
  equal(countSolutions(compact, 2), 1);

  throws(() => generatePuzzle({ ...options, givens: 1.5 }), /givens/i);
  throws(() => generatePuzzle({ ...options, givens: -1 }), /givens/i);
  throws(() => generatePuzzle({ ...options, clueCount: 17 }), /clueCount/i);
});

test("the library contains nine proven unique levels at three real scales and densities", () => {
  deepEqual(DIFFICULTIES.map(({ id }) => id), ["block", "district", "megacity"]);
  deepEqual(DIFFICULTIES.map(({ size }) => size), [4, 5, 6]);
  equal(LEVELS.length, 9);
  equal(new Set(LEVELS.map(({ id }) => id)).size, 9);
  deepEqual(DIFFICULTIES.map(({ id }) => levelsForDifficulty(id).length), [3, 3, 3]);
  equal(findLevel("pulse-midtown"), LEVELS[3]);
  equal(findLevel("missing-city"), null);

  const averageDensities = [];
  for (const difficulty of DIFFICULTIES) {
    const levels = levelsForDifficulty(difficulty.id);
    const densities = levels.map((level) => level.clueCount / (level.size * 4));
    averageDensities.push(densities.reduce((sum, value) => sum + value, 0) / densities.length);
    for (const level of levels) {
      equal(level.size, difficulty.size, `${level.id} uses its tier size`);
      equal(isLatinGrid(level.solution), true, `${level.id} answer is Latin`);
      equal(level.solution.length, level.size);
      equal(level.clues.top.length, level.size);
      equal(level.clues.bottom.length, level.size);
      equal(level.clues.left.length, level.size);
      equal(level.clues.right.length, level.size);
      for (const side of SIDES) {
        for (let index = 0; index < level.size; index += 1) {
          const clue = level.clues[side][index];
          if (clue !== null) {
            equal(
              visibleCount(lineFromGrid(level.solution, side, index)),
              clue,
              `${level.id} ${side}:${index} clue matches its answer`,
            );
          }
        }
      }
      for (const given of level.givens) {
        equal(level.solution[given.row][given.column], given.value, `${level.id} given matches answer`);
      }
      const solutions = solvePuzzle(level, { limit: 2 });
      equal(solutions.length, 1, `${level.id} has exactly one solution`);
      equal(countSolutions(level, 2), 1, `${level.id} countSolutions uniqueness proof`);
      deepEqual(solutions[0], level.solution.flat(), `${level.id} stored answer is the unique solution`);
      equal(evaluatePosition(level, { values: solutions[0] }).complete, true, `${level.id} answer wins by rules`);
    }
  }
  ok(averageDensities[0] > averageDensities[1]);
  ok(averageDensities[1] > averageDensities[2]);
  ok(levelsForDifficulty("block").every((level) => level.clueCount >= 14 && level.givens.length === 0));
  ok(levelsForDifficulty("district").every((level) => level.clueCount >= 11 && level.clueCount <= 13 && level.givens.length >= 2));
  ok(levelsForDifficulty("megacity").every((level) => level.clueCount <= 11 && level.givens.length >= 4));
});

test("session moves snapshot history, undo exactly, restart cleanly, and cap history", () => {
  const level = LEVELS[0];
  const original = createSession(level, {
    levels: LEVELS,
    preferences: { muted: true, flatView: true, noteMode: true },
  });
  const first = applySessionMove(level, original, { type: "toggle-note", row: 0, column: 0, value: 2 });
  equal(first.accepted, true);
  equal(first.session.moves, 1);
  equal(first.session.history.length, 1);
  equal(first.session.history[0].moves, 0);
  deepEqual(positionToJSON(original), positionToJSON(initialPosition(level)), "session move is pure");

  const second = applySessionMove(level, first.session, { type: "set-value", row: 0, column: 0, value: 1 });
  equal(second.session.moves, 2);
  equal(second.session.history.length, 2);
  equal(second.session.notes[0], 0);
  const undone = undoSession(level, second.session);
  equal(undone.accepted, true);
  equal(undone.session.moves, 1);
  equal(undone.session.values[0], 0);
  equal(undone.session.notes[0], 1 << 2);
  equal(undone.session.history.length, 1);
  const restoredOriginal = undoSession(level, undone.session);
  equal(restoredOriginal.session.moves, 0);
  deepEqual(positionToJSON(restoredOriginal.session), positionToJSON(original));
  equal(undoSession(level, restoredOriginal.session).accepted, false);

  const restarted = restartSession(level, second.session);
  equal(restarted.moves, 0);
  equal(restarted.history.length, 0);
  equal(restarted.completed, false);
  equal(restarted.completionRecorded, false);
  equal(restarted.completionReported, false);
  notEqual(restarted.runId, second.session.runId, "restart begins a distinct reward attempt");
  equal(restarted.completionEventId, skylineCompletionEventId(restarted.runId));
  deepEqual(restarted.completionOutbox, []);
  equal(restarted.hadConflict, false);
  equal(restarted.preferences.muted, true, "restart preserves preferences");
  equal(restarted.preferences.flatView, true);

  let long = createSession(level);
  for (let index = 0; index < HISTORY_LIMIT + 7; index += 1) {
    long = applySessionMove(level, long, {
      type: "toggle-note", row: 0, column: 0, value: index % level.size + 1,
    }).session;
  }
  equal(long.moves, HISTORY_LIMIT + 7);
  equal(long.history.length, HISTORY_LIMIT);
  equal(long.history[0].moves, 7, "the oldest snapshots are discarded first");
  equal(long.history.at(-1).moves, HISTORY_LIMIT + 6);
  const longUndo = undoSession(level, long);
  equal(longUndo.session.moves, HISTORY_LIMIT + 6);
  equal(longUndo.session.history.length, HISTORY_LIMIT - 1);
});

test("undo never erases the fact that a planning conflict occurred", () => {
  const level = LEVELS[0];
  const first = applySessionMove(level, createSession(level), {
    type: "set-value", row: 0, column: 0, value: 1,
  }).session;
  const conflicting = applySessionMove(level, first, {
    type: "set-value", row: 0, column: 1, value: 1,
  }).session;
  equal(conflicting.hadConflict, true);
  ok(evaluatePosition(level, conflicting).conflicts > 0);
  const undone = undoSession(level, conflicting).session;
  equal(evaluatePosition(level, undone).conflicts, 0);
  equal(undone.hadConflict, true, "undo repairs the board but cannot earn a zero-conflict clear");
  equal(restartSession(level, undone).hadConflict, false, "an explicit restart begins a fresh attempt");
});

test("rejected session moves preserve the exact session object and move count", () => {
  const level = LEVELS[0];
  const session = createSession(level);
  const result = applySessionMove(level, session, {
    type: "set-value", row: 0, column: 0, value: level.size + 1,
  });
  equal(result.accepted, false);
  equal(result.reason, "invalid-height");
  equal(result.session, session);
  equal(session.moves, 0);
  equal(session.history.length, 0);
});

test("strict saves round-trip and every malformed active field safely returns null", () => {
  const level = LEVELS[3];
  let session = createSession(level, {
    levels: LEVELS,
    runId: "run-neon-roundtrip-0001",
    preferences: { muted: 1, flatView: true, noteMode: false },
  });
  session = applySessionMove(level, session, { type: "toggle-note", row: 0, column: 0, value: 2 }).session;
  session = applySessionMove(level, session, { type: "toggle-note", row: 0, column: 0, value: 3 }).session;
  const saved = serializeSave(session);
  equal(saved.version, SAVE_VERSION);
  const restored = restoreSave(LEVELS, saved);
  equal(restored.level, level);
  deepEqual(positionToJSON(restored.session), positionToJSON(session));
  equal(restored.session.moves, session.moves);
  equal(restored.session.history.length, session.history.length);
  equal(restored.session.runId, "run-neon-roundtrip-0001");
  equal(restored.session.completionEventId, "neon-skyline:run-neon-roundtrip-0001:complete");
  deepEqual(restored.session.completionOutbox, []);
  deepEqual(restored.session.preferences, { muted: true, flatView: true, noteMode: false });

  const alternateBlank = Array.from({ length: level.size * level.size }, (_, index) => index)
    .find((index) => index !== 0 && !level.givens.some(({ row, column }) => row * level.size + column === index));
  const invalidCases = [
    ["version", (copy) => { copy.version = SAVE_VERSION + 1; }],
    ["level id", (copy) => { copy.active.levelId = "missing-level"; }],
    ["difficulty", (copy) => { copy.active.difficulty = "megacity"; }],
    ["value shape", (copy) => { copy.active.values.pop(); }],
    ["note shape", (copy) => { copy.active.notes.push(0); }],
    ["value range", (copy) => { copy.active.values[0] = level.size + 1; }],
    ["value integer", (copy) => { copy.active.values[0] = 1.5; }],
    ["note mask", (copy) => { copy.active.notes[0] = 1; }],
    ["given value", (copy) => {
      const given = level.givens[0];
      copy.active.values[given.row * level.size + given.column] = given.value % level.size + 1;
    }],
    ["given note", (copy) => {
      const given = level.givens[0];
      copy.active.notes[given.row * level.size + given.column] = 1 << 1;
    }],
    ["clue key", (copy) => { copy.active.clueDone = ["north:0"]; }],
    ["missing clue", (copy) => { copy.active.clueDone = ["top:1"]; }],
    ["duplicate clue", (copy) => { copy.active.clueDone = ["top:0", "top:0"]; }],
    ["history type", (copy) => { copy.active.history = {}; }],
    ["history limit", (copy) => { copy.active.history = Array(HISTORY_LIMIT + 1).fill(copy.active.history[0]); }],
    ["history shape", (copy) => { copy.active.history[0].values.pop(); }],
    ["history order", (copy) => { copy.active.history[0].moves = 5; copy.active.history[1].moves = 1; }],
    ["history longer than move count", (copy) => { copy.active.moves = 1; }],
    ["history gap", (copy) => { copy.active.history[1].moves = 3; copy.active.moves = 4; }],
    ["history unreachable snapshot", (copy) => { copy.active.history[1].notes[alternateBlank] = 1 << 2; }],
    ["unsafe move count", (copy) => { copy.active.moves = Number.MAX_SAFE_INTEGER + 1; }],
    ["completion mismatch", (copy) => { copy.active.completed = true; }],
    ["local completion marker", (copy) => { copy.active.completionRecorded = "yes"; }],
    ["completion marker", (copy) => { copy.active.completionReported = "yes"; }],
    ["run id", (copy) => { copy.active.runId = "bad"; }],
    ["event id mismatch", (copy) => { copy.active.completionEventId = "neon-skyline:another-run:complete"; }],
    ["outbox before completion", (copy) => { copy.active.completionOutbox = { eventId: copy.active.completionEventId }; }],
  ];

  for (const [label, mutate] of invalidCases) {
    const copy = cloneSave(saved);
    mutate(copy);
    doesNotThrow(() => restoreSave(LEVELS, copy), `${label} must not throw`);
    equal(restoreSave(LEVELS, copy), null, `${label} must fail closed`);
  }

  const nullPreferences = cloneSave(saved);
  nullPreferences.preferences = null;
  const sanitized = restoreSave(LEVELS, nullPreferences);
  deepEqual(sanitized.session.preferences, { muted: false, flatView: false, noteMode: false });
});

test("legacy saves migrate one opaque run id and later refreshes preserve it", () => {
  const level = LEVELS[0];
  const current = createSession(level, { levels: LEVELS, runId: "run-neon-current-0001" });
  const legacy = serializeSave(current);
  delete legacy.active.runId;
  delete legacy.active.completionEventId;
  delete legacy.active.completionOutbox;
  const migrated = restoreSave(LEVELS, legacy);
  ok(migrated.session.runId);
  equal(migrated.session.completionEventId, skylineCompletionEventId(migrated.session.runId));
  const refreshed = restoreSave(LEVELS, serializeSave(migrated.session));
  equal(refreshed.session.runId, migrated.session.runId);
  equal(createSkylineRunId(() => "run-neon-injected-0002"), "run-neon-injected-0002");
});

test("outbox migration and queue deduplication retain all 65 pending skyline events", () => {
  const payloads = Array.from({ length: 65 }, (_, index) => ({
    eventId: `neon-skyline:run-neon-bulk-${String(index).padStart(3, "0")}:complete`,
    levelId: `bulk-level-${index}`,
    tier: index % 3 + 1,
    moves: index,
    par: 30,
  }));
  const normalized = normalizeSkylineOutbox([...payloads, payloads[0]]);
  equal(normalized.length, 65);
  equal(normalized[0].eventId, payloads[0].eventId);
  equal(normalized.at(-1).eventId, payloads.at(-1).eventId);
  const bulkSession = createSession(LEVELS[0], {
    levels: LEVELS,
    runId: "run-neon-bulk-active",
    completionOutbox: normalized,
  });
  const bulkRestored = restoreSave(LEVELS, serializeSave(bulkSession));
  equal(bulkRestored.session.completionOutbox.length, 65);
  equal(bulkRestored.session.completionOutbox[0].eventId, payloads[0].eventId);
  equal(bulkRestored.session.completionOutbox.at(-1).eventId, payloads.at(-1).eventId);
  const queue = [];
  equal(enqueueSkylineCompletion(queue, payloads[0]), true);
  equal(enqueueSkylineCompletion(queue, payloads[0]), false);
  equal(queue.length, 1);

  const level = LEVELS[0];
  const recorded = recordCompletion(level, completedSession(level, {
    runId: "run-neon-single-migrate",
    completionEventId: "neon-skyline:run-neon-single-migrate:complete",
    completionOutbox: [],
    completionRecorded: false,
    completionReported: false,
    stats: emptyStats(),
  }));
  const legacySingle = serializeSave(recorded);
  legacySingle.active.completionOutbox = legacySingle.active.completionOutbox[0];
  const migrated = restoreSave(LEVELS, legacySingle);
  equal(migrated.session.completionOutbox.length, 1);
  equal(migrated.session.completionOutbox[0].eventId, recorded.completionEventId);
});

test("a host throw after awarding retries one event without duplicating local or shared city settlement", () => {
  const level = LEVELS[0];
  const firstRecord = recordCompletion(level, completedSession(level, {
    runId: "run-neon-retry-0001",
    completionEventId: "neon-skyline:run-neon-retry-0001:complete",
    completionOutbox: [],
    completionRecorded: false,
    completionReported: false,
    stats: emptyStats(),
  }));
  equal(firstRecord.completionRecorded, true);
  equal(firstRecord.completionReported, false);
  equal(firstRecord.completionOutbox[0].eventId, "neon-skyline:run-neon-retry-0001:complete");
  equal(firstRecord.stats.completedByLevel[level.id], 1);

  let host = createProgress();
  let firstHostResult;
  const failed = confirmCompletionReport(firstRecord, (payload) => {
    firstHostResult = awardCompletion(host, { ...payload, realm: REALM_ID }, new Date("2026-08-31T08:00:00Z"));
    host = firstHostResult.progress;
    throw new Error("shared API unavailable");
  });
  equal(failed.succeeded, false);
  equal(failed.session.completionReported, false);
  equal(firstHostResult.duplicateEvent, false);
  equal(host.realms[REALM_ID].clears[level.id].wins, 1);
  const xpAfterThrow = host.xp;
  const saved = serializeSave(failed.session);
  const restored = restoreSave(LEVELS, saved);
  equal(restored.session.completed, true);
  equal(restored.session.completionRecorded, true);
  equal(restored.session.completionReported, false);
  equal(restored.session.completionOutbox[0].eventId, firstRecord.completionOutbox[0].eventId);
  equal(restored.session.stats.completedByLevel[level.id], 1);

  const undonePending = {
    ...createSession(level, { levels: LEVELS, runId: restored.session.runId }),
    completionRecorded: true,
    completionReported: false,
    completionOutbox: restored.session.completionOutbox,
    stats: restored.session.stats,
  };
  const restoredAfterUndo = restoreSave(LEVELS, serializeSave(undonePending));
  equal(restoredAfterUndo.session.completed, false);
  equal(restoredAfterUndo.session.completionOutbox[0].eventId, firstRecord.completionOutbox[0].eventId);
  equal(restoredAfterUndo.session.stats.completedByLevel[level.id], 1);

  const duplicateLocal = recordCompletion(level, restoredAfterUndo.session);
  equal(duplicateLocal.stats.completedByLevel[level.id], 1, "local completion is idempotent");
  let retryHostResult;
  const retried = confirmCompletionReport(duplicateLocal, (payload) => {
    retryHostResult = awardCompletion(host, { ...payload, realm: REALM_ID }, new Date("2026-08-31T08:05:00Z"));
    host = retryHostResult.progress;
    return retryHostResult;
  });
  equal(retried.succeeded, true);
  equal(retried.session.completionReported, true);
  deepEqual(retried.session.completionOutbox, []);
  equal(retryHostResult.duplicateEvent, true);
  equal(host.realms[REALM_ID].clears[level.id].wins, 1);
  equal(host.xp, xpAfterThrow);
  equal(retried.session.stats.completedByLevel[level.id], 1);
  equal(retried.session.stats.bestMovesByLevel[level.id], level.par);

  const duplicateReport = confirmCompletionReport(retried.session, () => {
    throw new Error("a delivered session must never call the host again");
  });
  equal(duplicateReport.attempted, false);

  const deliveredAgain = awardCompletion(host, {
    ...firstRecord.completionOutbox[0],
    realm: REALM_ID,
  }, new Date("2026-08-31T08:10:00Z"));
  equal(deliveredAgain.duplicateEvent, true);
  equal(deliveredAgain.progress.realms[REALM_ID].clears[level.id].wins, 1);
  equal(deliveredAgain.progress.xp, xpAfterThrow);
});

test("a pending skyline completion survives switching districts and refreshing", () => {
  const oldLevel = LEVELS[0];
  const firstRecord = recordCompletion(oldLevel, completedSession(oldLevel, {
    runId: "run-neon-old-pending",
    completionEventId: "neon-skyline:run-neon-old-pending:complete",
    completionOutbox: [],
    completionRecorded: false,
    completionReported: false,
    stats: emptyStats(),
  }));
  const oldEventId = firstRecord.completionEventId;
  let host = createProgress();
  const failed = confirmCompletionReport(firstRecord, (payload) => {
    host = awardCompletion(host, { ...payload, realm: REALM_ID }, new Date("2026-08-31T09:00:00Z")).progress;
    throw new Error("host wrote but reply was lost");
  });
  const xpAfterThrow = host.xp;
  const winsAfterThrow = host.realms[REALM_ID].clears[oldLevel.id].wins;

  const nextLevel = LEVELS[1];
  const nextRunId = "run-neon-new-after-failure";
  const next = createSession(nextLevel, {
    levels: LEVELS,
    runId: nextRunId,
    completionOutbox: failed.session.completionOutbox,
    stats: failed.session.stats,
  });
  const refreshed = restoreSave(LEVELS, serializeSave(next));
  equal(refreshed.session.runId, nextRunId);
  equal(refreshed.session.completionReported, false);
  equal(refreshed.session.completionOutbox[0].eventId, oldEventId);

  let retryResult;
  const retried = confirmCompletionReport(refreshed.session, (payload) => {
    retryResult = awardCompletion(host, { ...payload, realm: REALM_ID }, new Date("2026-08-31T09:05:00Z"));
    host = retryResult.progress;
    return retryResult;
  });
  equal(retryResult.duplicateEvent, true);
  equal(retried.session.runId, nextRunId);
  equal(retried.session.completionReported, false, "an older event cannot mark the new run reported");
  deepEqual(retried.session.completionOutbox, []);
  equal(host.realms[REALM_ID].clears[oldLevel.id].wins, winsAfterThrow);
  equal(host.xp, xpAfterThrow);
});

test("completion records keep best operations, conflict-free and efficiency flags", () => {
  const level = LEVELS[0];
  const efficient = recordCompletion(level, completedSession(level, {
    moves: level.par - 2,
    hadConflict: false,
    completionReported: false,
    stats: emptyStats(),
  }));
  equal(efficient.stats.completedByLevel[level.id], 1);
  equal(efficient.stats.bestMovesByLevel[level.id], level.par - 2);
  equal(efficient.stats.zeroConflictByLevel[level.id], true);
  equal(efficient.stats.efficientByLevel[level.id], true);

  const slower = recordCompletion(level, {
    ...efficient,
    moves: level.par + 5,
    hadConflict: true,
    completionRecorded: false,
    completionReported: false,
  });
  equal(slower.stats.completedByLevel[level.id], 2);
  equal(slower.stats.bestMovesByLevel[level.id], level.par - 2, "slower replay cannot worsen the record");
  equal(slower.stats.zeroConflictByLevel[level.id], true, "earned flags are permanent");
  equal(slower.stats.efficientByLevel[level.id], true);

  const incompleteSession = { ...slower, completed: false, completionReported: false };
  const incomplete = recordCompletion(level, incompleteSession);
  equal(incomplete, incompleteSession, "incomplete sessions are returned without awarding");
  equal(incomplete.stats.completedByLevel[level.id], 2);
});

test("an all-given district preserves a legitimate zero-operation personal best", () => {
  const solution = generateLatinSquare(3, "zero-move-city");
  const level = fixturePuzzle({
    id: "zero-move-city",
    size: 3,
    solution,
    clues: allMissingClues(3),
    givens: solution.flatMap((row, rowIndex) => row.map((value, column) => ({
      row: rowIndex, column, value,
    }))),
  });
  const first = recordCompletion(level, completedSession(level, {
    moves: 0,
    completionReported: false,
    stats: emptyStats(),
  }));
  equal(first.stats.bestMovesByLevel[level.id], 0);
  equal(first.stats.efficientByLevel[level.id], true);

  const replay = recordCompletion(level, {
    ...first,
    moves: 1,
    completionRecorded: false,
    completionReported: false,
  });
  equal(replay.stats.bestMovesByLevel[level.id], 0, "a replay cannot worsen a zero-move record");

  const restored = restoreSave([level], serializeSave(first));
  equal(restored.session.stats.bestMovesByLevel[level.id], 0);
  equal(cityProgress(restored.session.stats, [level]).bestMovesByLevel[level.id], 0);
});

test("city progress unlocks landmarks from distinct levels, not repeat farming", () => {
  const repeated = cityProgress({
    completedByLevel: { [LEVELS[0].id]: 99 },
    bestMovesByLevel: { [LEVELS[0].id]: 12 },
    zeroConflictByLevel: { [LEVELS[0].id]: true },
    efficientByLevel: { [LEVELS[0].id]: true },
  }, LEVELS);
  equal(repeated.completed, 1);
  equal(repeated.landmarks.find(({ id }) => id === "rainline-terminal").unlocked, true);
  equal(repeated.landmarks.find(({ id }) => id === "prism-exchange").unlocked, false);
  equal(repeated.landmarks.find(({ id }) => id === "conflict-free").unlocked, true);
  equal(repeated.landmarks.find(({ id }) => id === "operations-record").unlocked, true);
  equal(repeated.bestMovesByLevel[LEVELS[0].id], 12);

  const threeIds = Object.fromEntries(LEVELS.slice(0, 3).map((level) => [level.id, 1]));
  const three = cityProgress({ completedByLevel: threeIds }, LEVELS);
  equal(three.completed, 3);
  equal(three.landmarks.find(({ id }) => id === "prism-exchange").unlocked, true);
  equal(three.landmarks.find(({ id }) => id === "aurora-spire").unlocked, false);

  const six = cityProgress({
    completedByLevel: Object.fromEntries(LEVELS.slice(0, 6).map((level) => [level.id, 1])),
  }, LEVELS);
  equal(six.landmarks.find(({ id }) => id === "aurora-spire").unlocked, true);
  equal(six.landmarks.find(({ id }) => id === "midnight-crown").unlocked, false);

  const all = cityProgress({
    completedByLevel: Object.fromEntries(LEVELS.map((level) => [level.id, 1])),
  }, LEVELS);
  equal(all.completed, 9);
  equal(all.total, 9);
  ok(all.landmarks.every(({ special, unlocked }) => special ? !unlocked : unlocked));
  equal(LANDMARKS.length, 6);
});

test("stat merging deduplicates clears, preserves flags, and chooses the best operation record", () => {
  const id = LEVELS[0].id;
  const merged = mergeStats({
    completedByLevel: { [id]: 1 },
    bestMovesByLevel: { [id]: 20 },
    zeroConflictByLevel: { [id]: true },
  }, LEVELS, {
    completedByLevel: { [id]: 4, unknown: 99 },
    bestMovesByLevel: { [id]: 15, unknown: 1 },
    efficientByLevel: { [id]: true, unknown: true },
  });
  equal(merged.completedByLevel[id], 4);
  equal(merged.bestMovesByLevel[id], 15);
  equal(merged.zeroConflictByLevel[id], true);
  equal(merged.efficientByLevel[id], true);
  equal("unknown" in merged.completedByLevel, false);
});

test("the three tutorial cards render three independent real-game SVG states", () => {
  const tutorial = REALM_TUTORIALS["neon-skyline"];
  equal(tutorial.version, 2);
  equal(tutorial.cards.length, 3);
  deepEqual(tutorial.cards.map(({ focus }) => focus), ["elements", "action", "goal"]);
  const art = tutorial.cards.map(({ focus }) => tutorialArt("neon-skyline", focus));
  equal(new Set(art).size, 3, "the cards are separate SVG snapshots, not faded layers");
  for (const [index, svg] of art.entries()) {
    match(svg, /^<svg\b/);
    match(svg, /preserveAspectRatio="xMidYMid meet"/);
    match(svg, new RegExp(`class="art-${tutorial.cards[index].focus}"`));
    equal((svg.match(/<svg\b/g) ?? []).length, 1);
    equal(/opacity="0(?:\.\d+)?"/.test(svg), false, "old state is not retained as a faded layer");
  }
  match(art[0], /\u5efa筑|\u8857口|\u89c2察数/);
  match(art[1], /候选笔记/);
  match(art[1], /正式建楼/);
  for (const side of SIDES) match(art[2], new RegExp(`data-clue-side="${side}"`), `${side} goal clue rail is shown`);
});

test("page source wires shared systems, all four clues, dialogs, flat view, and responsive safeguards", async () => {
  const [html, app, styles, realmUi] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./app.mjs", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
    readFile(new URL("../../shared/realm-ui.mjs", import.meta.url), "utf8"),
  ]);
  match(html, /<html[^>]+data-realm="neon-skyline"/);
  match(html, /\.\.\/\.\.\/shared\/realm-ui\.css/);
  match(html, /type="module" src="\.\.\/\.\.\/shared\/realm-ui\.mjs"/);
  match(html, /type="module" src="\.\/app\.mjs"/);
  match(realmUi, /from "\.\/reward-engine\.mjs"/);
  match(realmUi, /from "\.\/tutorial-data\.mjs"/);
  match(`${html}\n${app}`, /https:\/\/github\.com\/ebnbin\/puzzles\/blob\/main\/doc-zh\/towers\.html/);

  for (const side of SIDES) match(html, new RegExp(`id="clues-${side}"`), `${side} clue rail exists`);
  match(html, /id="skyline-board"[^>]+role="grid"/);
  match(html, /<dialog\b[^>]*id="rules-dialog"/);
  match(html, /<dialog\b[^>]*id="victory-dialog"/);
  match(html, /id="flat-view-button"/);
  match(app, /flatView/);
  match(app, /aria-rowindex/);
  match(app, /aria-colindex/);
  match(app, /completionReported/);
  match(app, /reportRealmCompletion|__realmCompletionQueue/);
  match(app, /else if \(session\.completionOutbox\.length > 0\) retryPendingRealmReward\(\)/);
  match(app, /createSession\(level, \{ preferences, stats, levels: LEVELS, completionOutbox \}\)/);

  match(styles, /@media\s*\([^)]*max-width:\s*320px[^)]*\)/);
  match(styles, /@media\s*\([^)]*prefers-reduced-motion:\s*reduce[^)]*\)/);
  match(styles, /min-(?:block-size|height):\s*44px|--(?:tap|touch)[^:]*:\s*44px/);
  match(styles, /overflow-x:\s*(?:hidden|clip)/);
  match(styles, /\.flat-view|\[data-flat/);
});

let passed = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} neon-skyline tests passed (${assertions} assertions).`);
