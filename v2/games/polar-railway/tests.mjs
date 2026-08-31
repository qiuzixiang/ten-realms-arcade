import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CELL_STATES,
  DIFFICULTIES,
  DIRECTIONS,
  DIRECTION_NAMES,
  EDGE_STATES,
  LEVELS,
  VALID_TRACK_MASKS,
  allCellKeys,
  allEdgeKeys,
  analyzeBoard,
  assertValidPuzzle,
  cellKey,
  cloneBoardState,
  countSolutions,
  createBoardState,
  createRecords,
  degreeAt,
  deserializeBoardState,
  directionBetween,
  directionsAt,
  directionsForMask,
  edgeKey,
  endpointFor,
  findLevel,
  fixedTrackEdges,
  getPuzzleErrors,
  inBounds,
  isEdgeCompatibleWithGivens,
  isSolved,
  levelsForDifficulty,
  maskForDirections,
  normalizeRecords,
  parseCellKey,
  parseEdgeKey,
  puzzleFromPath,
  recordCompletion,
  serializeBoardState,
  setCellState,
  setEdgeState,
  toggleCell,
  toggleEdge,
  traceRoute,
  unlockedCosmetics,
  validateBoardState,
  validatePuzzle,
} from "./logic.mjs";
import {
  COMPLETION_EVENT,
  DIFFICULTY_TIERS,
  STORAGE_KEYS,
  STORAGE_PREFIX,
  TUTORIAL_SLIDES,
  createModalController,
  deliverCompletion,
  isTypingTarget,
  makeCompletionEnvelope,
  restoreCompletionEnvelope,
} from "./ui-helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
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

function throws(callback, expected, message) {
  assertions += 1;
  assert.throws(callback, expected, message);
}

function matches(value, pattern, message) {
  assertions += 1;
  assert.match(value, pattern, message);
}

function doesNotMatch(value, pattern, message) {
  assertions += 1;
  assert.doesNotMatch(value, pattern, message);
}

function read(relativePath) {
  const path = join(HERE, relativePath);
  ok(existsSync(path), `${relativePath} must exist`);
  return readFileSync(path, "utf8");
}

function runtimeFiles(directory = HERE) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...runtimeFiles(path));
    else if (name !== "tests.mjs" && [".html", ".mjs", ".js", ".css", ".svg"].includes(extname(name))) files.push(path);
  }
  return files;
}

function functionSource(source, name) {
  const signature = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(signature, `function ${name} must exist`);
  const parametersOpen = source.indexOf("(", signature.index);
  let parameterDepth = 0;
  let parametersClose = -1;
  for (let index = parametersOpen; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    else if (source[index] === ")") {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parametersClose = index;
        break;
      }
    }
  }
  assert.notEqual(parametersClose, -1, `function ${name} parameters are unterminated`);
  const open = source.indexOf("{", parametersClose);
  assert.notEqual(open, -1, `function ${name} must have a body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(signature.index, index + 1);
    }
  }
  assert.fail(`function ${name} body is unterminated`);
}

function solutionState(puzzle) {
  const result = countSolutions(puzzle, 2);
  assert.equal(result.count, 1, `${puzzle.id} fixture must have one solution`);
  assert.equal(result.truncated, false, `${puzzle.id} uniqueness search must finish`);
  const tracks = new Set();
  for (let index = 1; index < result.solutions[0].length; index += 1) {
    tracks.add(edgeKey(result.solutions[0][index - 1], result.solutions[0][index]));
  }
  return {
    puzzleId: puzzle.id,
    tracks,
    edgeExclusions: new Set(),
    candidates: new Set(),
    cellExclusions: new Set(),
    moves: tracks.size,
    rework: 0,
  };
}

function fixturePuzzle(id = "fixture-route") {
  return puzzleFromPath({
    id,
    title: "测试支线",
    difficulty: "easy",
    width: 4,
    height: 4,
    seed: 42,
    path: [[0, 1], [1, 1], [2, 1], [2, 2], [2, 3]],
    givenIndices: [],
    parMoves: 12,
  });
}

function straightPuzzle(id = "fixture-straight") {
  return puzzleFromPath({
    id,
    title: "共享边与配额测试",
    difficulty: "easy",
    width: 4,
    height: 4,
    seed: 7,
    path: [[0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3]],
    givenIndices: [],
    parMoves: 10,
  });
}

function summaryFor(puzzle, completionId, overrides = {}) {
  return {
    completionId,
    puzzleId: puzzle.id,
    difficulty: puzzle.difficulty,
    moves: puzzle.parMoves,
    elapsedMs: 25_000,
    zeroRework: false,
    onTime: false,
    completedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

test("Tracks constants encode exactly six non-crossing two-port rail pieces", () => {
  deepEqual(DIRECTION_NAMES, ["N", "E", "S", "W"]);
  deepEqual(Object.fromEntries(DIRECTION_NAMES.map((name) => [name, DIRECTIONS[name].bit])), {
    N: 1, E: 2, S: 4, W: 8,
  });
  deepEqual(Object.fromEntries(DIRECTION_NAMES.map((name) => [name, DIRECTIONS[name].opposite])), {
    N: "S", E: "W", S: "N", W: "E",
  });
  deepEqual(VALID_TRACK_MASKS, [3, 5, 6, 9, 10, 12]);
  for (const mask of VALID_TRACK_MASKS) {
    equal(directionsForMask(mask).length, 2, `mask ${mask} must have exactly two ports`);
  }
  equal(VALID_TRACK_MASKS.includes(15), false, "a four-way crossing is not a rail piece");
  equal(VALID_TRACK_MASKS.includes(7), false, "a three-way branch is not a rail piece");
  equal(maskForDirections("N", "E"), 3);
  equal(maskForDirections("N", "S"), 5);
  equal(maskForDirections("E", "S"), 6);
  equal(maskForDirections("N", "W"), 9);
  equal(maskForDirections("E", "W"), 10);
  equal(maskForDirections("S", "W"), 12);
});

test("coordinate and shared-edge helpers are canonical and orthogonal", () => {
  const puzzle = fixturePuzzle();
  equal(cellKey(2, 3), "2,3");
  equal(cellKey({ x: 2, y: 3 }), "2,3");
  deepEqual(parseCellKey("2,3"), { x: 2, y: 3 });
  throws(() => parseCellKey("02,3"), TypeError);
  throws(() => parseCellKey("-1,3"), TypeError);
  throws(() => cellKey(1.5, 2), TypeError);
  equal(inBounds(puzzle, 0, 0), true);
  equal(inBounds(puzzle, 4, 0), false);
  equal(inBounds(puzzle, { x: 3, y: 3 }), true);
  equal(directionBetween({ x: 1, y: 1 }, { x: 2, y: 1 }), "E");
  equal(directionBetween({ x: 2, y: 1 }, { x: 1, y: 1 }), "W");
  equal(directionBetween({ x: 1, y: 1 }, { x: 2, y: 2 }), null);

  const key = edgeKey({ x: 2, y: 1 }, { x: 1, y: 1 });
  equal(key, "1,1|2,1");
  equal(edgeKey({ x: 1, y: 1 }, { x: 2, y: 1 }), key, "both cells address one shared edge");
  deepEqual(parseEdgeKey(key), { a: { x: 1, y: 1 }, b: { x: 2, y: 1 }, key });
  throws(() => edgeKey({ x: 0, y: 0 }, { x: 1, y: 1 }), RangeError);
  throws(() => parseEdgeKey("2,1|1,1"), /canonical/i);
  equal(allCellKeys(puzzle).length, 16);
  equal(allEdgeKeys(puzzle).length, 24, "a 4x4 grid has 12 horizontal plus 12 vertical shared edges");
  equal(new Set(allEdgeKeys(puzzle)).size, allEdgeKeys(puzzle).length);
});

test("A is fixed on the left and B is fixed on the bottom", () => {
  for (const puzzle of LEVELS) {
    const entry = endpointFor(puzzle, "entry");
    const exit = endpointFor(puzzle, "exit");
    deepEqual(entry, { x: 0, y: puzzle.entryRow, outside: "W" });
    deepEqual(exit, { x: puzzle.exitColumn, y: puzzle.height - 1, outside: "S" });
    const givenByCell = new Map(puzzle.givens.map((given) => [cellKey(given), given]));
    ok(givenByCell.get(cellKey(entry)).mask & DIRECTIONS.W.bit, `${puzzle.id} A must connect west`);
    ok(givenByCell.get(cellKey(exit)).mask & DIRECTIONS.S.bit, `${puzzle.id} B must connect south`);
    equal(directionsAt(puzzle, createBoardState(puzzle), entry) & DIRECTIONS.W.bit, DIRECTIONS.W.bit);
    equal(directionsAt(puzzle, createBoardState(puzzle), exit) & DIRECTIONS.S.bit, DIRECTIONS.S.bit);
  }
  throws(() => endpointFor(LEVELS[0], "north"), TypeError);
});

test("puzzle validation rejects malformed endpoints, clues, and non-integer givens", () => {
  const valid = fixturePuzzle("validation-fixture");
  equal(validatePuzzle(valid), true);
  equal(assertValidPuzzle(valid), valid);
  const invalidCases = [
    [{ ...valid, id: "BAD ID" }, /id/i],
    [{ ...valid, difficulty: "blizzard" }, /difficulty/i],
    [{ ...valid, entryRow: -1 }, /entryRow/i],
    [{ ...valid, exitColumn: valid.width }, /exitColumn/i],
    [{ ...valid, rowClues: [1] }, /rowClues/i],
    [{ ...valid, columnClues: valid.columnClues.map((value, index) => value + (index === 0 ? 1 : 0)) }, /totals/i],
    [{ ...valid, givens: valid.givens.map((given, index) => index ? given : { ...given, mask: 3.5 }) }, /given 0/i],
    [{ ...valid, givens: valid.givens.map((given, index) => index ? given : { ...given, x: 0.5 }) }, /given 0/i],
    [{ ...valid, givens: [...valid.givens, { ...valid.givens[0] }] }, /duplicate/i],
    [{ ...valid, givens: valid.givens.filter((given) => given.x !== 0 || given.y !== valid.entryRow) }, /entry/i],
    [{ ...valid, givens: valid.givens.filter((given) => given.x !== valid.exitColumn || given.y !== valid.height - 1) }, /exit/i],
    [{ ...valid, seed: -1 }, /seed/i],
    [{ ...valid, parMoves: 0 }, /parMoves/i],
  ];
  for (const [candidate, expected] of invalidCases) {
    equal(validatePuzzle(candidate), false);
    matches(getPuzzleErrors(candidate).join("; "), expected);
    throws(() => assertValidPuzzle(candidate), /Invalid Tracks puzzle/);
  }

  const wrongOuter = {
    ...valid,
    givens: valid.givens.map((given) => (
      given.x === 0 && given.y === valid.entryRow ? { ...given, mask: maskForDirections("N", "E") } : given
    )),
  };
  matches(getPuzzleErrors(wrongOuter).join("; "), /illegal outer|entry/i);
});

test("preset rail shapes and their shared edges are immutable", () => {
  const puzzle = fixturePuzzle("fixed-fixture");
  const initial = createBoardState(puzzle);
  ok(validateBoardState(puzzle, initial));
  const fixed = fixedTrackEdges(puzzle);
  ok(fixed.size >= 2);
  for (const key of fixed) {
    ok(initial.tracks.has(key));
    const removed = setEdgeState(puzzle, initial, key, EDGE_STATES.UNKNOWN);
    equal(removed.changed, false);
    equal(removed.reason, "fixed-track");
  }
  for (const given of puzzle.givens) {
    equal(Number.isInteger(given.x) && Number.isInteger(given.y) && Number.isInteger(given.mask), true);
    const changed = setCellState(puzzle, initial, cellKey(given), CELL_STATES.CANDIDATE);
    equal(changed.changed, false);
    equal(changed.reason, "fixed-track");
  }

  const entry = { x: 0, y: puzzle.entryRow };
  const incompatible = edgeKey(entry, { x: 0, y: puzzle.entryRow + 1 });
  equal(isEdgeCompatibleWithGivens(puzzle, incompatible), false);
  const rejected = setEdgeState(puzzle, initial, incompatible, EDGE_STATES.TRACK);
  equal(rejected.changed, false);
  equal(rejected.reason, "fixed-shape");
});

test("one track on a shared edge connects both adjacent cells exactly once", () => {
  const puzzle = straightPuzzle();
  const state = createBoardState(puzzle);
  const shared = edgeKey({ x: 1, y: 0 }, { x: 2, y: 0 });
  const result = setEdgeState(puzzle, state, shared, EDGE_STATES.TRACK);
  ok(result.changed);
  ok(result.state.tracks.has(shared));
  equal(directionsAt(puzzle, result.state, { x: 1, y: 0 }) & DIRECTIONS.E.bit, DIRECTIONS.E.bit);
  equal(directionsAt(puzzle, result.state, { x: 2, y: 0 }) & DIRECTIONS.W.bit, DIRECTIONS.W.bit);
  equal(degreeAt(puzzle, result.state, { x: 1, y: 0 }), 1);
  equal(degreeAt(puzzle, result.state, { x: 2, y: 0 }), 1);
  equal(result.state.moves, state.moves + 1);
  equal(state.tracks.has(shared), false, "actions must not mutate history snapshots");

  const excluded = toggleEdge(puzzle, state, shared, EDGE_STATES.EXCLUDED);
  ok(excluded.state.edgeExclusions.has(shared));
  const cleared = toggleEdge(puzzle, excluded.state, shared, EDGE_STATES.EXCLUDED);
  equal(cleared.state.edgeExclusions.has(shared), false);
  const invalid = toggleEdge(puzzle, state, shared, "paint");
  equal(invalid.changed, false);
  equal(invalid.reason, "invalid-tool");
});

test("edge/cell state transitions are immutable, mutually exclusive, and count rework", () => {
  const puzzle = straightPuzzle("transition-fixture");
  const initial = createBoardState(puzzle);
  const key = edgeKey({ x: 1, y: 0 }, { x: 2, y: 0 });
  const laid = setEdgeState(puzzle, initial, key, EDGE_STATES.TRACK);
  ok(laid.changed);
  equal(laid.previous, EDGE_STATES.UNKNOWN);
  equal(laid.state.moves, 1);
  equal(laid.state.rework, 0);
  const erased = setEdgeState(puzzle, laid.state, key, EDGE_STATES.UNKNOWN);
  ok(erased.changed);
  equal(erased.previous, EDGE_STATES.TRACK);
  equal(erased.state.moves, 2);
  equal(erased.state.rework, 1, "removing laid rail records real rework");
  equal(laid.state.tracks.has(key), true, "the prior undo snapshot remains intact");

  const cell = "1,0";
  const excluded = setCellState(puzzle, initial, cell, CELL_STATES.EXCLUDED);
  ok(excluded.changed);
  const blocked = setEdgeState(puzzle, excluded.state, key, EDGE_STATES.TRACK);
  equal(blocked.changed, false);
  equal(blocked.reason, "excluded-cell");
  const candidate = setCellState(puzzle, initial, cell, CELL_STATES.CANDIDATE);
  const candidateCleared = setCellState(puzzle, candidate.state, cell, CELL_STATES.UNKNOWN);
  equal(candidateCleared.state.rework, 1, "erasing a positive cell note is also rework");
  equal(validateBoardState(puzzle, candidateCleared.state), true);
});

test("row and column quotas count occupied cells rather than track edges", () => {
  const puzzle = straightPuzzle("cell-quota-fixture");
  const state = solutionState(puzzle);
  const analysis = analyzeBoard(puzzle, state);
  deepEqual(puzzle.rowClues, [0, 4, 1, 1]);
  deepEqual(puzzle.columnClues, [1, 1, 1, 3]);
  deepEqual(analysis.rowStatus.map(({ complete }) => complete), puzzle.rowClues);
  deepEqual(analysis.columnStatus.map(({ complete }) => complete), puzzle.columnClues);
  equal(analysis.completeCells, 6);
  equal(analysis.targetCells, 6);
  equal(state.tracks.size, 5, "six occupied cells contain only five internal shared edges");
  equal(analysis.solved, true);
});

test("candidate and exclusion notes never substitute for actual rail directions", () => {
  const puzzle = straightPuzzle("candidate-fixture");
  const solved = solutionState(puzzle);
  const removable = [...solved.tracks].find((key) => !fixedTrackEdges(puzzle).has(key));
  ok(removable);
  const missing = cloneBoardState(solved);
  missing.tracks.delete(removable);
  const { a, b } = parseEdgeKey(removable);
  missing.candidates.add(cellKey(a));
  missing.candidates.add(cellKey(b));
  const analysis = analyzeBoard(puzzle, missing);
  equal(analysis.solved, false);
  equal(analysis.connected, false);
  equal(analysis.cellResults.get(cellKey(a)).possible, true);
  equal(analysis.cellResults.get(cellKey(a)).complete, false, "candidate is possible occupancy, not a direction");

  const empty = createBoardState(puzzle);
  const candidate = setCellState(puzzle, empty, "1,2", CELL_STATES.CANDIDATE);
  ok(candidate.changed);
  ok(candidate.state.candidates.has("1,2"));
  const excluded = toggleCell(puzzle, candidate.state, "1,2", CELL_STATES.EXCLUDED);
  ok(excluded.changed);
  ok(excluded.state.cellExclusions.has("1,2"));
  equal(excluded.state.candidates.has("1,2"), false, "cell notes are mutually exclusive");
});

test("crossings and branches are rejected during input and detected in imported state", () => {
  const puzzle = fixturePuzzle("junction-fixture");
  const center = { x: 1, y: 2 };
  const spokes = {
    N: edgeKey(center, { x: 1, y: 1 }),
    E: edgeKey(center, { x: 2, y: 2 }),
    S: edgeKey(center, { x: 1, y: 3 }),
    W: edgeKey(center, { x: 0, y: 2 }),
  };
  const direct = (names) => ({
    puzzleId: puzzle.id,
    tracks: new Set([...fixedTrackEdges(puzzle), ...names.map((name) => spokes[name])]),
    edgeExclusions: new Set(),
    candidates: new Set(),
    cellExclusions: new Set(),
    moves: 0,
    rework: 0,
  });
  const branch = analyzeBoard(puzzle, direct(["N", "E", "S"]));
  ok(branch.conflicts.some(({ key, reason }) => key === cellKey(center) && reason === "branch"));
  equal(branch.solved, false);
  const crossing = analyzeBoard(puzzle, direct(["N", "E", "S", "W"]));
  ok(crossing.conflicts.some(({ key, reason }) => key === cellKey(center) && reason === "crossing"));
  equal(crossing.solved, false);

  let interactive = createBoardState(puzzle);
  interactive = setEdgeState(puzzle, interactive, spokes.N, EDGE_STATES.TRACK).state;
  interactive = setEdgeState(puzzle, interactive, spokes.E, EDGE_STATES.TRACK).state;
  const third = setEdgeState(puzzle, interactive, spokes.S, EDGE_STATES.TRACK);
  equal(third.changed, false);
  equal(third.reason, "degree-limit");
});

test("dead ends, stray rails, wrong loops, and quota mismatches cannot win", () => {
  const puzzle = fixturePuzzle("conflict-fixture");
  const initialAnalysis = analyzeBoard(puzzle, createBoardState(puzzle));
  equal(initialAnalysis.solved, false);
  equal(initialAnalysis.allTrackCellsComplete, false, "the free end of a preset edge is a dead end");
  ok([...initialAnalysis.cellResults.values()].some(({ degree }) => degree === 1));

  const loopPuzzle = puzzleFromPath({
    id: "loop-fixture",
    title: "环路与游离测试",
    difficulty: "medium",
    width: 5,
    height: 5,
    seed: 99,
    path: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
    givenIndices: [],
    parMoves: 14,
  });
  const solved = solutionState(loopPuzzle);
  const stray = cloneBoardState(solved);
  stray.tracks.add(edgeKey({ x: 0, y: 2 }, { x: 1, y: 2 }));
  const strayAnalysis = analyzeBoard(loopPuzzle, stray);
  equal(strayAnalysis.connected, true);
  ok(strayAnalysis.conflicts.some(({ reason }) => reason === "stray-track"));
  equal(strayAnalysis.solved, false);

  const loop = cloneBoardState(solved);
  const loopCells = [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 0, y: 3 }];
  for (let index = 0; index < loopCells.length; index += 1) {
    loop.tracks.add(edgeKey(loopCells[index], loopCells[(index + 1) % loopCells.length]));
  }
  const loopAnalysis = analyzeBoard(loopPuzzle, loop);
  equal(loopAnalysis.hasCycle, true);
  ok(loopAnalysis.conflicts.some(({ reason }) => reason === "cycle"));
  equal(loopAnalysis.solved, false);

  const quotaPuzzle = straightPuzzle("quota-mismatch-fixture");
  const wrongQuotas = assertValidPuzzle({ ...quotaPuzzle, rowClues: [1, 4, 0, 1] });
  const quotaAnalysis = analyzeBoard(wrongQuotas, solutionState(quotaPuzzle));
  equal(quotaAnalysis.connected, true);
  ok(quotaAnalysis.conflicts.some(({ type, reason }) => type === "row" && reason === "quota-mismatch"));
  equal(quotaAnalysis.solved, false);
});

test("only one complete A-to-B component with exact pieces and quotas wins", () => {
  const puzzle = fixturePuzzle("victory-fixture");
  const state = solutionState(puzzle);
  const analysis = analyzeBoard(puzzle, state);
  equal(validateBoardState(puzzle, state), true);
  equal(analysis.connected, true);
  equal(analysis.hasCycle, false);
  equal(analysis.allTrackCellsComplete, true);
  equal(analysis.givensExact, true);
  equal(analysis.components.length, 1);
  equal(analysis.conflicts.length, 0);
  equal(analysis.rowStatus.every(({ exact, over }) => exact && !over), true);
  equal(analysis.columnStatus.every(({ exact, over }) => exact && !over), true);
  equal(analysis.solved, true);
  equal(isSolved(puzzle, state), true);
  deepEqual(traceRoute(puzzle, state.tracks), analysis.route);
  deepEqual(analysis.route[0], { x: 0, y: puzzle.entryRow });
  deepEqual(analysis.route.at(-1), { x: puzzle.exitColumn, y: puzzle.height - 1 });
  for (const point of analysis.route) ok(VALID_TRACK_MASKS.includes(directionsAt(puzzle, state, point)));

  const annotated = cloneBoardState(state);
  const routeCells = new Set(analysis.route.map(cellKey));
  for (const key of allCellKeys(puzzle)) if (!routeCells.has(key)) annotated.cellExclusions.add(key);
  for (const key of allEdgeKeys(puzzle)) if (!annotated.tracks.has(key)) annotated.edgeExclusions.add(key);
  equal(validateBoardState(puzzle, annotated), true);
  equal(isSolved(puzzle, annotated), true, "correct exclusion notes may remain on a completed route");
});

test("all six bundled levels are valid, reproducible, and solver-proven unique", () => {
  equal(LEVELS.length, 6);
  deepEqual(DIFFICULTIES.map(({ id }) => id), ["easy", "medium", "hard"]);
  deepEqual(DIFFICULTIES.map(({ size }) => size), ["5 × 5", "6 × 6", "7 × 7"]);
  equal(new Set(LEVELS.map(({ id }) => id)).size, 6);
  for (const difficulty of DIFFICULTIES) {
    const levels = levelsForDifficulty(difficulty.id);
    equal(levels.length, 2, `${difficulty.id} must offer two reproducible levels`);
    for (const puzzle of levels) {
      equal(validatePuzzle(puzzle), true, puzzle.id);
      equal(Object.isFrozen(puzzle), true);
      equal(Object.isFrozen(puzzle.rowClues) && Object.isFrozen(puzzle.columnClues) && Object.isFrozen(puzzle.givens), true);
      equal(puzzle.width, Number(difficulty.size[0]));
      equal(puzzle.height, Number(difficulty.size[4]));
      equal(Number.isInteger(puzzle.seed) && puzzle.seed >= 0, true);
      equal(Object.hasOwn(puzzle, "solution"), false, "exported puzzles must not leak a solution");
      equal(Object.hasOwn(puzzle, "path"), false, "exported puzzles must not leak the generating route");
      equal(Object.hasOwn(puzzle, "givenIndices"), false);
      const result = countSolutions(puzzle, 2);
      equal(result.count, 1, `${puzzle.id} must have exactly one solution`);
      equal(result.truncated, false, `${puzzle.id} uniqueness proof must exhaust the search`);
      ok(result.nodes > 0);
      equal(result.solutions[0].length, puzzle.rowClues.reduce((sum, value) => sum + value, 0));
      equal(isSolved(puzzle, solutionState(puzzle)), true);
      equal(findLevel(puzzle.id), puzzle);
    }
  }
  equal(findLevel("missing"), null);
  equal(levelsForDifficulty("missing").length, 0);
  const deliberatelyLimited = countSolutions(LEVELS[0], 1);
  equal(deliberatelyLimited.count, 1);
  equal(deliberatelyLimited.truncated, true, "a halted limit-1 search must never be advertised as a uniqueness proof");
});

test("path generation is deterministic and exports clues/givens but no answer", () => {
  const definition = {
    id: "reproducible-fixture",
    title: "可复现生成测试",
    difficulty: "easy",
    width: 4,
    height: 4,
    seed: 123456,
    path: [[0, 2], [1, 2], [1, 1], [2, 1], [2, 2], [2, 3]],
    givenIndices: [2, 2, 4],
    parMoves: 11,
  };
  const first = puzzleFromPath(definition);
  const second = puzzleFromPath(structuredClone(definition));
  deepEqual(first, second);
  equal(Object.hasOwn(first, "path"), false);
  equal(Object.hasOwn(first, "solution"), false);
  deepEqual(first.rowClues, [0, 2, 3, 1]);
  deepEqual(first.columnClues, [1, 2, 3, 0]);
  equal(new Set(first.givens.map(cellKey)).size, first.givens.length);
  equal(countSolutions(first, 2).count, 1);

  throws(() => puzzleFromPath({ ...definition, id: "repeat-path", path: [[0, 0], [1, 0], [0, 0], [0, 1], [0, 2], [0, 3]] }), /repeats/i);
  throws(() => puzzleFromPath({ ...definition, id: "diagonal-path", path: [[0, 0], [1, 1], [1, 2], [1, 3]] }), /orthogonally/i);
  throws(() => puzzleFromPath({ ...definition, id: "wrong-entry", path: [[1, 0], [1, 1], [1, 2], [1, 3]] }), /left edge/i);
  throws(() => puzzleFromPath({ ...definition, id: "wrong-exit", path: [[0, 0], [1, 0], [1, 1], [1, 2]] }), /bottom edge/i);
});

test("board serialization round-trips sets and corrupted saves safely return null", () => {
  const puzzle = fixturePuzzle("save-fixture");
  let state = createBoardState(puzzle);
  const solved = solutionState(puzzle);
  const optionalEdge = [...solved.tracks].find((key) => !fixedTrackEdges(puzzle).has(key));
  state = setEdgeState(puzzle, state, optionalEdge, EDGE_STATES.TRACK).state;
  state = setCellState(puzzle, state, "3,0", CELL_STATES.CANDIDATE).state;
  state = setCellState(puzzle, state, "0,3", CELL_STATES.EXCLUDED).state;
  const serialized = serializeBoardState(state);
  equal(serialized.version, 1);
  equal(Array.isArray(serialized.tracks), true);
  deepEqual(serialized.tracks, [...serialized.tracks].sort());
  const restored = deserializeBoardState(JSON.parse(JSON.stringify(serialized)), puzzle);
  ok(restored);
  deepEqual(serializeBoardState(restored), serialized);
  equal(restored.tracks === state.tracks, false);

  const fixed = [...fixedTrackEdges(puzzle)][0];
  const invalidEdge = "0,0|9,9";
  const corruptions = [
    null,
    [],
    { ...serialized, version: 2 },
    { ...serialized, puzzleId: "another-level" },
    { ...serialized, moves: -1 },
    { ...serialized, moves: 10_000_001 },
    { ...serialized, rework: 1.5 },
    { ...serialized, rework: 10_000_001 },
    { ...serialized, tracks: serialized.tracks.filter((key) => key !== fixed) },
    { ...serialized, tracks: [...serialized.tracks, invalidEdge] },
    { ...serialized, edgeExclusions: [...serialized.edgeExclusions, serialized.tracks[0]] },
    { ...serialized, candidates: ["1,2"], cellExclusions: ["1,2"] },
    { ...serialized, tracks: Array(puzzle.width * puzzle.height * 2 + 1).fill(serialized.tracks[0]) },
  ];
  for (const corruption of corruptions) equal(deserializeBoardState(corruption, puzzle), null);
});

test("records normalize damage, deduplicate completions, and retain bests", () => {
  deepEqual(normalizeRecords(null), createRecords());
  deepEqual(normalizeRecords({ selectedEngine: "unknown", selectedCarriage: "unknown" }), createRecords());
  deepEqual(
    normalizeRecords({ selectedEngine: "midnight", selectedCarriage: "observatory" }),
    createRecords(),
    "locked cosmetic selections fall back when their awards are absent",
  );
  deepEqual(normalizeRecords({
    completed: { bogus: 9 },
    bestMoves: { bogus: 1 },
    bestTimes: { bogus: 1 },
    awards: {
      "atlas:bogus": "2026-08-31T00:00:00.000Z",
      [`atlas:${LEVELS[0].id}`]: "not-a-timestamp",
    },
  }), createRecords(), "unknown routes and forged award timestamps cannot unlock progress");
  const puzzle = LEVELS[0];
  const firstSummary = summaryFor(puzzle, "attempt-1", {
    moves: 40,
    elapsedMs: 50_000,
    zeroRework: true,
    onTime: true,
  });
  const first = recordCompletion(createRecords(), firstSummary);
  equal(first.invalid, false);
  equal(first.duplicate, false);
  equal(first.records.completed[puzzle.id], 1);
  equal(first.records.bestMoves[puzzle.id], 40);
  equal(first.records.bestTimes[puzzle.id], 50_000);
  equal(first.records.completionLedger["attempt-1"], true);
  ok(first.awards.some(({ id }) => id === `atlas:${puzzle.id}`));
  ok(first.awards.some(({ id }) => id === `zero-rework:${puzzle.id}`));
  ok(first.awards.some(({ id }) => id === `on-time:${puzzle.difficulty}`));
  ok(first.awards.some(({ id }) => id === "carriage:mail"));

  const duplicate = recordCompletion(first.records, { ...firstSummary, moves: 1, elapsedMs: 1 });
  equal(duplicate.duplicate, true);
  equal(duplicate.awards.length, 0);
  equal(duplicate.records.completed[puzzle.id], 1);
  equal(duplicate.records.bestMoves[puzzle.id], 40);

  const better = recordCompletion(first.records, summaryFor(puzzle, "attempt-2", { moves: 30, elapsedMs: 45_000 }));
  equal(better.records.completed[puzzle.id], 2);
  equal(better.records.bestMoves[puzzle.id], 30);
  equal(better.records.bestTimes[puzzle.id], 45_000);
  equal(better.awards.length, 0, "route and difficulty rewards are ledger-deduplicated");

  const invalidSummaries = [
    null,
    summaryFor(puzzle, "", {}),
    summaryFor(puzzle, "bad-level", { puzzleId: "missing" }),
    summaryFor(puzzle, "bad-difficulty", { difficulty: "hard" }),
    summaryFor(puzzle, "bad-moves", { moves: -1 }),
    summaryFor(puzzle, "bad-time", { elapsedMs: 1.5 }),
    summaryFor(puzzle, "bad-rework", { zeroRework: "yes" }),
    summaryFor(puzzle, "bad-ontime", { onTime: 1 }),
  ];
  for (const invalidSummary of invalidSummaries) {
    const result = recordCompletion(better.records, invalidSummary);
    equal(result.invalid, true);
    equal(result.awards.length, 0);
  }
});

test("the bounded completion ledger keeps the newest id retry-safe after reload", () => {
  const puzzle = LEVELS[0];
  let records = createRecords();
  for (let index = 0; index <= 500; index += 1) {
    records = recordCompletion(records, summaryFor(puzzle, `long-run-${index}`, {
      moves: 20 + (index % 5),
      elapsedMs: 40_000 + index,
    })).records;
  }
  equal(records.completed[puzzle.id], 501);
  const restored = normalizeRecords(JSON.parse(JSON.stringify(records)));
  equal(Object.keys(restored.completionLedger).length, 500);
  equal(restored.completionLedger["long-run-0"], undefined, "only the oldest id is evicted");
  equal(restored.completionLedger["long-run-500"], true, "the just-delivered id survives refresh");
  const replay = recordCompletion(restored, summaryFor(puzzle, "long-run-500", {
    moves: 1,
    elapsedMs: 1,
  }));
  equal(replay.duplicate, true);
  equal(replay.records.completed[puzzle.id], 501, "refresh retry cannot increment local clears again");
});

test("route atlas progress unlocks each engine and carriage exactly once", () => {
  let records = createRecords();
  const allAwards = [];
  for (const [index, puzzle] of LEVELS.entries()) {
    const result = recordCompletion(records, summaryFor(puzzle, `atlas-run-${index}`, {
      zeroRework: index === 0,
      onTime: true,
    }));
    records = result.records;
    allAwards.push(...result.awards);
    equal(result.duplicate, false);
  }
  equal(Object.keys(records.completed).length, LEVELS.length);
  equal(Object.keys(records.completionLedger).length, LEVELS.length);
  equal(Object.keys(records.awards).filter((id) => id.startsWith("atlas:")).length, LEVELS.length);
  equal(allAwards.filter(({ id }) => id === "engine:aurora").length, 1);
  equal(allAwards.filter(({ id }) => id === "engine:midnight").length, 1);
  equal(allAwards.filter(({ id }) => id === "carriage:mail").length, 1);
  equal(allAwards.filter(({ id }) => id === "carriage:observatory").length, 1);
  deepEqual(unlockedCosmetics(records), {
    engines: ["copper", "aurora", "midnight"],
    carriages: ["supply", "mail", "observatory"],
  });
  deepEqual(unlockedCosmetics(createRecords()), { engines: ["copper"], carriages: ["supply"] });
  const normalized = normalizeRecords({ ...records, selectedEngine: "midnight", selectedCarriage: "observatory" });
  equal(normalized.selectedEngine, "midnight");
  equal(normalized.selectedCarriage, "observatory");
});

test("completion envelopes expose the standardized v2 integration payload", () => {
  const puzzle = LEVELS[0];
  const rewardIds = [`atlas:${puzzle.id}`, "engine:aurora"];
  const rewards = [{ id: `atlas:${puzzle.id}`, label: "线路图鉴", unlocked: "route" }];
  const envelope = makeCompletionEnvelope({
    puzzle,
    completionId: "completion-whiteout-5a-1",
    attemptId: "attempt-whiteout-5a-1",
    moves: 24,
    elapsedMs: 42_000,
    undoCount: 1,
    restartCount: 0,
    zeroRework: true,
    onTime: true,
    rewardIds,
    rewards,
    completedAt: "2026-08-31T00:00:00.000Z",
  });
  equal(COMPLETION_EVENT, "ten-realms-v2:game-complete");
  equal(envelope.schema, "ten-realms-v2.game-complete");
  equal(envelope.version, 1);
  equal(envelope.gameId, "polar-railway");
  equal(envelope.puzzleId, puzzle.id);
  equal(envelope.levelId, puzzle.id);
  equal(envelope.difficulty, puzzle.difficulty);
  deepEqual(DIFFICULTY_TIERS, { easy: 1, medium: 2, hard: 3 });
  equal(envelope.tier, DIFFICULTY_TIERS[puzzle.difficulty]);
  for (const difficulty of DIFFICULTIES) {
    const level = levelsForDifficulty(difficulty.id)[0];
    const tierEnvelope = makeCompletionEnvelope({
      puzzle: level,
      completionId: `tier-${difficulty.id}`,
      attemptId: `attempt-${difficulty.id}`,
      moves: level.parMoves,
      elapsedMs: 1,
      undoCount: 0,
      restartCount: 0,
      zeroRework: true,
      onTime: true,
      rewardIds: [],
      completedAt: "2026-08-31T00:00:00.000Z",
    });
    equal(tierEnvelope.tier, DIFFICULTY_TIERS[difficulty.id]);
    equal(Number.isInteger(tierEnvelope.tier) && tierEnvelope.tier >= 1 && tierEnvelope.tier <= 3, true);
  }
  equal(envelope.moves, 24);
  equal(envelope.par, puzzle.parMoves);
  equal(envelope.completionId, "completion-whiteout-5a-1");
  deepEqual(envelope.rewardIds, rewardIds);
  equal(envelope.rewardIds === rewardIds, false, "the public event must not retain a mutable caller array");
  deepEqual(envelope.rewards, rewards);
  equal(envelope.rewards === rewards, false, "delayed victory UI needs an owned reward snapshot");
  equal(envelope.rewards[0] === rewards[0], false);
  equal(Object.isFrozen(envelope.rewards), true);
  equal(Object.isFrozen(envelope.rewards[0]), true);
  equal(Object.isFrozen(envelope), true);
});

test("delivery falls back to a de-duplicated queue when RealmArcade throws", () => {
  const payload = makeCompletionEnvelope({
    puzzle: LEVELS[0],
    completionId: "polar-railway:whiteout-5a:delivery-retry",
    attemptId: "whiteout-5a:delivery-retry",
    moves: 20,
    elapsedMs: 10_000,
    undoCount: 0,
    restartCount: 0,
    zeroRework: true,
    onTime: true,
    rewardIds: ["atlas:whiteout-5a"],
    rewards: [{ id: "atlas:whiteout-5a", label: "线路图鉴 · 雪原初发", unlocked: "route" }],
    completedAt: "2026-08-31T00:00:00.000Z",
  });
  const queue = [];
  let apiCalls = 0;
  const target = {
    RealmArcade: {
      complete() {
        apiCalls += 1;
        throw new Error("host unavailable");
      },
    },
    __realmCompletionQueue: queue,
  };

  const first = deliverCompletion(target, payload);
  equal(first.delivered, true, "a durable fallback queue counts as accepted delivery");
  equal(apiCalls, 1);
  equal(queue.length, 1);
  equal(queue[0], payload);

  const retry = deliverCompletion(target, payload);
  equal(retry.delivered, true, "an already queued completion remains confirmed");
  equal(apiCalls, 2, "a later retry may probe the recovered host before consulting the queue");
  equal(queue.length, 1, "the same completionId is never queued twice");
});

test("delivery never confirms when both the host API and fallback queue fail", () => {
  const payload = makeCompletionEnvelope({
    puzzle: LEVELS[0],
    completionId: "polar-railway:whiteout-5a:undelivered",
    attemptId: "whiteout-5a:undelivered",
    moves: 21,
    elapsedMs: 11_000,
    undoCount: 0,
    restartCount: 0,
    zeroRework: false,
    onTime: true,
    rewardIds: [],
    completedAt: "2026-08-31T00:00:00.000Z",
  });
  const throwingApi = { complete() { throw new Error("offline"); } };

  const getterFailure = { RealmArcade: throwingApi };
  Object.defineProperty(getterFailure, "__realmCompletionQueue", {
    configurable: true,
    get() { throw new Error("queue getter denied"); },
  });
  equal(deliverCompletion(getterFailure, payload).delivered, false);

  const setterFailure = { RealmArcade: throwingApi };
  Object.defineProperty(setterFailure, "__realmCompletionQueue", {
    configurable: true,
    get() { return undefined; },
    set() { throw new Error("queue setter denied"); },
  });
  equal(deliverCompletion(setterFailure, payload).delivered, false);

  const brokenQueue = [];
  Object.defineProperty(brokenQueue, "push", {
    configurable: true,
    value() { throw new Error("queue full"); },
  });
  const pushFailure = { RealmArcade: throwingApi, __realmCompletionQueue: brokenQueue };
  equal(deliverCompletion(pushFailure, payload).delivered, false);
  equal(brokenQueue.length, 0);

  equal(deliverCompletion(null, payload).delivered, false, "a missing host target is a recoverable delivery failure");
});

test("refresh retry restores the same pending payload without duplicating local rewards", () => {
  const puzzle = LEVELS[0];
  const attemptId = `${puzzle.id}:refresh-retry`;
  const completionId = `polar-railway:${attemptId}`;
  const summary = summaryFor(puzzle, completionId, {
    moves: 22,
    elapsedMs: 12_000,
    zeroRework: true,
    onTime: true,
  });
  const recorded = recordCompletion(createRecords(), summary);
  equal(recorded.invalid, false);
  equal(recorded.duplicate, false);
  equal(recorded.records.completed[puzzle.id], 1);
  const pending = makeCompletionEnvelope({
    puzzle,
    completionId,
    attemptId,
    moves: summary.moves,
    elapsedMs: summary.elapsedMs,
    undoCount: 0,
    restartCount: 0,
    zeroRework: summary.zeroRework,
    onTime: summary.onTime,
    rewardIds: recorded.awards.map(({ id }) => id),
    rewards: recorded.awards,
    completedAt: summary.completedAt,
  });

  const savedValue = JSON.parse(JSON.stringify(pending));
  const restored = restoreCompletionEnvelope(savedValue, { puzzle, attemptId });
  ok(restored);
  deepEqual(restored, pending);
  equal(Object.isFrozen(restored), true);
  equal(Object.isFrozen(restored.rewardIds), true);
  equal(Object.isFrozen(restored.rewards), true);

  const duplicate = recordCompletion(recorded.records, summary);
  equal(duplicate.duplicate, true);
  equal(duplicate.invalid, false);
  equal(duplicate.awards.length, 0);
  equal(duplicate.records.completed[puzzle.id], 1);
  equal(Object.keys(duplicate.records.completionLedger).length, 1);

  const unavailable = {};
  Object.defineProperty(unavailable, "__realmCompletionQueue", {
    get() { throw new Error("storage unavailable after refresh"); },
  });
  const delivery = deliverCompletion(unavailable, restored);
  equal(delivery.delivered, false);
  const pendingAfterRetry = delivery.delivered ? null : restored;
  equal(pendingAfterRetry, restored, "failed refresh delivery keeps the exact pending envelope for a later retry");

  const corruptions = [
    null,
    { ...savedValue, schema: "wrong" },
    { ...savedValue, completionId: "another-completion" },
    { ...savedValue, attemptId: "another-attempt" },
    { ...savedValue, puzzleId: "missing" },
    { ...savedValue, levelId: LEVELS[1].id },
    { ...savedValue, difficulty: "hard" },
    { ...savedValue, tier: 3 },
    { ...savedValue, moves: -1 },
    { ...savedValue, rewardIds: [1] },
    { ...savedValue, rewards: [{ id: 1, label: "bad", unlocked: "route" }] },
  ];
  for (const corruption of corruptions) equal(restoreCompletionEnvelope(corruption, { puzzle, attemptId }), null);
  equal(restoreCompletionEnvelope(savedValue, { puzzle, attemptId: "wrong-attempt" }), null);
  equal(restoreCompletionEnvelope(savedValue, { puzzle: LEVELS[1], attemptId }), null);
});

test("the modal controller uses a modal surface and restores the exact opener", () => {
  class FakeDialog extends EventTarget {
    constructor() {
      super();
      this.open = false;
      this.returnValue = "";
      this.showCalls = 0;
      this.ownerDocument = { activeElement: null };
    }

    showModal() {
      this.open = true;
      this.showCalls += 1;
    }

    close(value = "") {
      this.returnValue = value;
      this.open = false;
      this.dispatchEvent(new Event("close"));
    }
  }

  const dialog = new FakeDialog();
  const focusLog = [];
  const opener = { focus: (options) => focusLog.push(["opener", options]) };
  const firstControl = { focus: (options) => focusLog.push(["dialog", options]) };
  const closed = [];
  const controller = createModalController(dialog, { focusTarget: () => firstControl, onClosed: (value) => closed.push(value) });
  equal(controller.isOpen(), false);
  equal(controller.open(opener), true);
  equal(dialog.open, true);
  equal(dialog.showCalls, 1, "showModal provides native focus isolation");
  deepEqual(focusLog[0], ["dialog", { preventScroll: true }]);
  equal(controller.open(opener), false, "an open modal is not opened twice");
  equal(controller.close("skip"), true);
  equal(controller.isOpen(), false);
  deepEqual(focusLog[1], ["opener", { preventScroll: true }]);
  deepEqual(closed, ["skip"]);
  equal(controller.close(), false);
  throws(() => createModalController(null), TypeError);
});

test("keyboard shortcut filtering leaves form controls and editors alone", () => {
  equal(isTypingTarget({ tagName: "INPUT" }), true);
  equal(isTypingTarget({ tagName: "textarea" }), true);
  equal(isTypingTarget({ tagName: "SELECT" }), true);
  equal(isTypingTarget({ tagName: "BUTTON" }), false);
  equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  equal(isTypingTarget(null), false);
});

test("all private storage keys are isolated to the polar-railway v2 namespace", () => {
  equal(STORAGE_PREFIX, "ten-realms-v2:games:polar-railway:");
  equal(Object.keys(STORAGE_KEYS).length, 4);
  equal(new Set(Object.values(STORAGE_KEYS)).size, Object.values(STORAGE_KEYS).length);
  for (const [name, key] of Object.entries(STORAGE_KEYS)) {
    ok(key.startsWith(STORAGE_PREFIX), `${name} must use the game-private v2 prefix`);
  }

  const app = readFileSync(join(HERE, "app.mjs"), "utf8");
  for (const name of Object.keys(STORAGE_KEYS)) matches(app, new RegExp(`STORAGE_KEYS\\.${name}\\b`));
  doesNotMatch(app, /\bsessionStorage\b|\bindexedDB\b/);
  for (const call of app.matchAll(/\bstorage(?:Get|Set|Remove)\s*\(\s*([^,\n)]+)/g)) {
    const prefix = app.slice(Math.max(0, call.index - 12), call.index);
    if (/function\s+$/.test(prefix)) continue;
    matches(call[1], /^STORAGE_KEYS\.(?:save|preferences|records|tutorial)\b/,
      `storage wrapper call must receive a declared private key, got ${call[1]}`);
  }

  const sources = runtimeFiles().map((path) => [path, readFileSync(path, "utf8")]);
  const forbiddenV1Key = ["ten-realms", "progress", "v1"].join(":");
  for (const [path, source] of sources) {
    equal(source.includes(forbiddenV1Key), false, `${path} must never touch the 1.0 progress key`);
    const literalCalls = source.matchAll(/(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*(["'`])([^"'`]+)\1/g);
    for (const match of literalCalls) {
      ok(match[2].startsWith(STORAGE_PREFIX), `${path} contains an out-of-namespace storage literal: ${match[2]}`);
    }
  }
});

test("the UI wires save fallback, undo/restart/switching, sound, pointer, and keyboard controls", () => {
  const html = read("index.html");
  const app = read("app.mjs");
  const css = read("styles.css");
  matches(html, /<link\b[^>]*href=["']\.\/styles\.css["']/i);
  matches(html, /<script\b[^>]*type=["']module["'][^>]*src=["']\.\/app\.mjs["']/i);
  const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  equal(new Set(htmlIds).size, htmlIds.length, "DOM ids must be unique");
  const htmlIdSet = new Set(htmlIds);
  for (const selector of app.matchAll(/querySelector\(\s*["']#([a-z][\w-]*)["']\s*\)/gi)) {
    ok(htmlIdSet.has(selector[1]), `app.mjs wires missing #${selector[1]}`);
  }
  matches(app, /STORAGE_KEYS/);
  matches(app, /localStorage\.(?:getItem|setItem)/);
  matches(app, /try\s*\{[\s\S]{0,800}JSON\.parse/);
  matches(app, /deserializeBoardState/);
  matches(app, /serializeBoardState/);
  matches(app, /storageRemove\s*\(\s*STORAGE_KEYS\.save\s*\)/);
  matches(app, /存档已损坏|旧存档已损坏/);
  matches(`${html}\n${app}`, /撤销/);
  matches(`${html}\n${app}`, /重开|重新开始/);
  matches(`${html}\n${app}`, /换题|下一班/);
  matches(`${html}\n${app}`, /难度/);
  matches(`${html}\n${app}`, /静音|声音/);
  matches(html, /零返工[\s\S]{0,120}未撤销、重开或改动已下标记/,
    "zero-rework reward copy must match its undo, restart, and revision checks");
  matches(app, /addEventListener\(["']keydown["']/);
  matches(app, /event\.key|\.key\s*===/);
  matches(app, /event\.(?:metaKey|ctrlKey|altKey)[\s\S]{0,300}commandUndo/,
    "browser shortcuts such as Cmd/Ctrl+R must not also restart the game");
  const controls = functionSource(app, "bindControls");
  matches(controls, /const\s+boardFocus\s*=\s*event\.target\?\.dataset\?\.cellKey[\s\S]{0,100}parseCellKey/,
    "global shortcuts must remember the originating gridcell before render replaces it");
  matches(controls, /key\s*===\s*["']z["'][\s\S]{0,180}focusCell\s*\(\s*boardFocus\s*\)/,
    "keyboard undo must restore the prior board cell focus");
  matches(controls, /key\s*===\s*["']r["'][\s\S]{0,220}focusCell\s*\(\s*\{\s*x\s*:\s*0\s*,\s*y\s*:\s*state\.level\.entryRow\s*\}\s*\)/,
    "keyboard restart must focus the rebuilt board entry");
  matches(controls, /key\s*===\s*["']n["'][\s\S]{0,180}focusCell\s*\(\s*\{\s*x\s*:\s*0\s*,\s*y\s*:\s*state\.level\.entryRow\s*\}\s*\)/,
    "keyboard puzzle switching must focus the new board entry");
  matches(controls, /key\s*===\s*["']m["'][\s\S]{0,180}focusCell\s*\(\s*boardFocus\s*\)/,
    "keyboard mute must restore the prior board cell focus");
  matches(app, /setAttribute\(\s*["']aria-selected["']\s*,\s*String\(selected\)\s*\)/,
    "roving grid focus must keep aria-selected synchronized");
  matches(app, /setAttribute\(\s*["']role["']\s*,\s*["']radio["']\s*\)/);
  matches(app, /setAttribute\(\s*["']aria-checked["']/);
  matches(app, /button\.tabIndex\s*=\s*checked\s*\?\s*0\s*:\s*-1/);
  matches(app, /ArrowRight[\s\S]{0,700}ArrowLeft[\s\S]{0,1200}selectCosmetic/,
    "cosmetic radiogroups need roving arrow-key selection");
  matches(app, /activeCosmetic[\s\S]{0,1800}focus\(\s*\{\s*preventScroll\s*:\s*true\s*\}\s*\)/,
    "re-rendering a selected cosmetic must restore its button focus");
  const difficultyRender = functionSource(app, "renderDifficultyButtons");
  matches(difficultyRender, /activeDifficulty[\s\S]{0,1200}data-difficulty[\s\S]{0,200}focus\(\s*\{\s*preventScroll\s*:\s*true\s*\}\s*\)/,
    "re-rendering global actions must restore focused difficulty controls");
  for (const selector of [
    'body\\[data-engine="aurora"\\] \\.preview-engine',
    'body\\[data-engine="midnight"\\] \\.preview-engine',
    'body\\[data-carriage="mail"\\] \\.preview-car',
    'body\\[data-carriage="observatory"\\] \\.preview-car',
  ]) matches(css, new RegExp(selector), `the selected livery needs a live preview selector: ${selector}`);
  matches(app, /badgeNoRework[\s\S]{0,900}badgeState\.textContent/);
  matches(app, /badgeOnTime[\s\S]{0,900}badgeState\.textContent/);
  const recordsRender = functionSource(app, "renderRecords");
  matches(recordsRender, /atlas-ticket[\s\S]{0,220}setAttribute\(\s*["']role["']\s*,\s*["']listitem["']\s*\)/,
    "route atlas cards must participate in their semantic list");
  const statusRender = functionSource(app, "renderStatus");
  matches(statusRender, /closest\(\s*["']\.dispatch-message["']\s*\)[\s\S]{0,260}classList\.toggle\(\s*["']is-warning["'][\s\S]{0,180}classList\.toggle\(\s*["']is-complete["']/,
    "status warnings and completion states must style the visible dispatch panel");
  const cellAction = functionSource(app, "handleCellAction");
  matches(cellAction, /render\s*\(\s*\{\s*preserveTrain\s*:\s*true\s*\}\s*\)[\s\S]{0,160}focusCell\s*\(/,
    "clicking a cell with an edge tool must restore focus after rebuilding the grid");
  matches(cellAction, /applyCellTool\s*\([^)]+\)[\s\S]{0,100}focusCell\s*\(/,
    "a cell-note action must also restore focus after rebuilding the grid");
  const cellInteraction = functionSource(app, "handleCellAction");
  matches(cellInteraction, /edgeAnchor[\s\S]{0,1800}Math\.abs\([\s\S]{0,300}edgeKey\s*\(/,
    "edge tools must use two unambiguous adjacent gridcells instead of overlapping edge hitboxes");
  matches(css, /\.edge-control\s*\{[^}]*pointer-events\s*:\s*none/is,
    "the visual edge layer must never intercept a 44px gridcell target");
  matches(css, /\.rail-cell\.is-edge-anchor\s*\{[^}]*box-shadow/is,
    "the first selected edge cell needs a non-color anchor cue");
  matches(app, /addEventListener\(["'](?:pointerdown|click)["']/);
  matches(app, /AudioContext|webkitAudioContext/);
  matches(css, /touch-action\s*:/);
  matches(css, /:focus-visible/);
});

test("completion is dispatched once to the event, RealmArcade API, or fallback queue", () => {
  const app = read("app.mjs");
  const helpers = readFileSync(join(HERE, "ui-helpers.mjs"), "utf8");
  const integration = `${app}\n${helpers}`;
  matches(app, /makeCompletionEnvelope/);
  matches(app, /deliverCompletion/);
  matches(app, /restoreCompletionEnvelope/);
  matches(app, /COMPLETION_EVENT/);
  matches(app, /CustomEvent\s*\(/);
  matches(app, /dispatchEvent\s*\(/);
  matches(integration, /RealmArcade/);
  matches(integration, /\.complete\s*\(/);
  matches(integration, /__realmCompletionQueue/);
  matches(integration, /\.push\s*\(/);
  matches(app, /completionId/);
  matches(app, /completionLedger|reportedCompletion|completionReported|reportedCompletions|attempt\.reported|reported\s*:|\.has\s*\(\s*(?:payload\.)?completionId/);
  matches(app, /PolarRailway/);
  matches(app, /ten-realms-v2:game-ready/);
  matches(app, /getState/);
  matches(app, /verifyCurrentPuzzle/);
  const report = functionSource(app, "reportCompletion");
  matches(report, /if\s*\(\s*(?:state\.attempt|attempt)\.reported\s*\)\s*return\s+false/);
  matches(report, /deliverCompletion\s*\(\s*window\s*,\s*payload\s*\)/);
  for (const field of ["levelId", "tier", "moves", "par"]) matches(readFileSync(join(HERE, "ui-helpers.mjs"), "utf8"), new RegExp(`\\b${field}\\b`));
});

test("app persists unconfirmed delivery and marks reported only after acceptance", () => {
  const app = read("app.mjs");
  matches(app, /deliverCompletion/);
  matches(app, /restoreCompletionEnvelope/);

  const defaults = functionSource(app, "defaultAttempt");
  matches(defaults, /pendingCompletion\s*:\s*null/);

  const normalize = functionSource(app, "normalizeAttempt");
  matches(normalize, /restoreCompletionEnvelope\s*\(/);
  matches(normalize, /pendingCompletion/);
  matches(normalize, /`polar-railway:\$\{value\.id\}`\.length\s*>\s*160/,
    "restored attempts must stay within the completion-id contract");
  matches(normalize, /value\.undoCount[\s\S]{0,100}>\s*10_000_000/,
    "restored undo counts must be bounded");
  matches(normalize, /value\.restartCount[\s\S]{0,100}>\s*10_000_000/,
    "restored restart counts must be bounded");

  const save = functionSource(app, "saveGame");
  matches(save, /pendingCompletion\s*:\s*state\.attempt\.pendingCompletion/,
    "the retry envelope must survive a refresh in the game save");
  matches(save, /!savedOkay[\s\S]{0,500}history\s*:\s*\[\]/,
    "a quota failure retries the critical board and pending envelope without bulky undo history");

  const report = functionSource(app, "reportCompletion");
  const completionBuilder = functionSource(app, "completionPayload");
  matches(`${completionBuilder}\n${report}`, /state\.attempt\.pendingCompletion\s*=\s*payload/,
    "the payload is retained before delivery is attempted");
  matches(report, /(?:const|let)\s+delivery\s*=\s*deliverCompletion\s*\(\s*window\s*,\s*payload\s*\)/);
  const accepted = /if\s*\(\s*delivery\.delivered\s*\)\s*\{([\s\S]*?)\}/.exec(report);
  const assignsBooleanResult = /(?:state\.attempt|attempt)\.reported\s*=\s*delivery\.delivered/.test(report);
  ok(accepted || assignsBooleanResult, "reported must derive only from delivery.delivered");
  if (accepted) matches(accepted[1], /(?:state\.attempt|attempt)\.reported\s*=\s*true/);
  doesNotMatch(report, /(?:state\.attempt|attempt)\.reported\s*=\s*true[\s\S]{0,300}deliverCompletion/,
    "reported cannot be committed optimistically before API/queue acceptance");
  const pendingClears = report.match(/(?:state\.attempt|attempt)\.pendingCompletion\s*=\s*null/g) ?? [];
  if (pendingClears.length) {
    ok(accepted && /pendingCompletion\s*=\s*null/.test(accepted[1]),
      "only confirmed delivery may clear the retry payload");
  }

  const settle = functionSource(app, "settleCompletion");
  matches(settle, /saveRecords\s*\(/, "local reward ledger is persisted even while external delivery is pending");
  matches(settle, /saveGame\s*\([\s\S]*reportCompletion\s*\(\s*payload\s*\)/,
    "the pending envelope is saved before the first external delivery attempt");

  const load = functionSource(app, "loadSavedGame");
  doesNotMatch(load, /attempt\.reported\s*=\s*true/,
    "a solved board is not proof that its completion reached RealmArcade or the fallback queue");

  matches(app, /function\s+(?:retryPendingCompletion|retryPendingDelivery)\s*\(/);
  const retryName = /function\s+(retryPendingCompletion|retryPendingDelivery)\s*\(/.exec(app)?.[1];
  ok(retryName);
  const retry = functionSource(app, retryName);
  matches(retry, /state\.completed/);
  matches(retry, /!state\.attempt\.reported|state\.attempt\.reported\s*===\s*false/);
  matches(retry, /state\.attempt\.pendingCompletion/);
  matches(retry, /reportCompletion\s*\(\s*state\.attempt\.pendingCompletion\s*\)/);
  doesNotMatch(retry, /completionPayload\s*\(|recordCompletion\s*\(/,
    "refresh retry reuses the saved envelope instead of re-awarding the solved board");
  const initialise = functionSource(app, "initialise");
  matches(initialise, new RegExp(`${retryName}\\s*\\(`), "initialisation must retry a solved, unconfirmed save");
  ok(initialise.indexOf("exposeApi()") < initialise.indexOf(`${retryName}()`),
    "game-ready and the public API must exist before a restored completion is re-dispatched");
});

test("delayed victory UI is generation-guarded and cannot leak into a new attempt", () => {
  const app = read("app.mjs");
  matches(app, /let\s+victoryTimer\s*=/);
  matches(app, /let\s+victoryGeneration\s*=/);

  const cancel = functionSource(app, "cancelVictorySchedule");
  matches(cancel, /clearTimeout\s*\(\s*victoryTimer\s*\)/);
  matches(cancel, /victoryTimer\s*=\s*0/);
  matches(cancel, /victoryGeneration\s*\+=\s*1|\+\+victoryGeneration|victoryGeneration\+\+/);

  const completion = functionSource(app, "completeGame");
  matches(`${completion}\n${readFileSync(join(HERE, "ui-helpers.mjs"), "utf8")}`,
    /capturedAwards\s*=\s*state\.lastAwards\.map\s*\(|rewards\s*:\s*Object\.freeze\s*\(\s*rewards\.map\s*\(/,
    "award rows must be copied into capturedAwards or the immutable payload before another attempt can replace state.lastAwards");
  matches(completion, /attemptToken\s*=\s*state\.attempt\.id/);
  matches(completion, /generation\s*=\s*(?:\+\+victoryGeneration|victoryGeneration\s*\+=\s*1)/);
  matches(completion, /clearTimeout\s*\(\s*victoryTimer\s*\)/);
  matches(completion, /victoryTimer\s*=\s*window\.setTimeout\s*\(/);
  matches(completion, /generation\s*!==\s*victoryGeneration/);
  matches(completion, /!state\.completed/);
  matches(completion, /state\.attempt\.id\s*!==\s*attemptToken/);
  matches(completion, /state\.level\.id\s*!==\s*payload\.levelId/);
  matches(completion, /showVictory\s*\(\s*payload(?:\s*,\s*capturedAwards)?\s*\)/);
  ok(completion.indexOf("attemptToken") < completion.indexOf("settleCompletion"));
  ok(completion.indexOf("generation") < completion.indexOf("settleCompletion"));
  ok(completion.indexOf("settleCompletion") < completion.indexOf("generation !== victoryGeneration"));
  ok(completion.indexOf("generation !== victoryGeneration") < completion.indexOf("animateTrain"),
    "a synchronous completion callback cannot leak the old train into a new attempt");

  const start = functionSource(app, "startLevel");
  const undoSource = functionSource(app, "undo");
  matches(start, /cancelVictorySchedule\s*\(/, "new puzzle, difficulty, and restart all pass through startLevel");
  matches(undoSource, /cancelVictorySchedule\s*\(/, "undo cancels even if called during the completion transition");
  matches(app, /addEventListener\(["']pagehide["'][\s\S]{0,500}cancelVictorySchedule\s*\(\s*\{\s*closeDialog\s*:\s*false\s*\}/,
    "leaving the page must invalidate the delayed callback without forcing dialog focus work");

  const victory = functionSource(app, "showVictory");
  matches(victory, /showVictory\s*\(\s*payload(?:\s*,\s*capturedAwards)?\s*\)/);
  matches(victory, /payload\.(?:levelId|puzzleTitle)/);
  matches(victory, /capturedAwards|payload\.rewards/);
  doesNotMatch(victory, /state\.level|state\.lastAwards/,
    "a delayed dialog must render only its captured level and reward snapshot");
});

test("the page has a v2 return path, semantic dialogs, live status, and no remote runtime", () => {
  const html = read("index.html");
  matches(html, /<html[^>]+lang=["']zh-CN["']/i);
  matches(html, /<html[^>]+data-realm=["']polar-railway["']/i);
  matches(html, /<meta[^>]+name=["']viewport["']/i);
  matches(html, /<header\b/i);
  matches(html, /<main\b/i);
  matches(html, /<dialog\b/i);
  matches(html, /<dialog[^>]+aria-labelledby=/i);
  matches(html, /aria-live=["'](?:polite|assertive)["']/i);
  matches(html, /href=["']\.\.\/\.\.\/["']/i, "return must target /v2/ via ../../");
  matches(html, /href=["']\.\.\/\.\.\/shared\/realm-ui\.css["']/i);
  matches(html, /src=["']\.\.\/\.\.\/shared\/realm-ui\.mjs["']/i);
  ok(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"), "shared progression must load before the game app");
  matches(html, /href=["']\.\.\/\.\.\/THIRD_PARTY_NOTICES\.md["']/i);
  doesNotMatch(html, /tabindex=["'](?:[1-9]\d*)["']/i, "positive tabindex breaks natural focus order");
  const remoteRuntime = [...html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["'](https?:\/\/[^"']+)/gi)];
  equal(remoteRuntime.length, 0, "scripts and styles must be self-contained");
  matches(html, /MIT/i);
  matches(html, /doc-zh\/tracks\.html|tracks\.html[^"']*lang=zh/i, "attribution must link the Chinese Tracks rules");
});

test("three first-run tutorial slides use distinct, contain-fitted real SVG scenes", () => {
  equal(TUTORIAL_SLIDES.length, 3);
  deepEqual(TUTORIAL_SLIDES.map(({ id }) => id), ["elements", "operation", "goal"]);
  equal(new Set(TUTORIAL_SLIDES.map(({ image }) => image)).size, 3);
  const pictures = TUTORIAL_SLIDES.map(({ image }) => {
    ok(image.startsWith("./assets/") && image.endsWith(".svg"));
    const source = read(image.slice(2));
    matches(source, /<svg\b[^>]*preserveAspectRatio=["']xMidYMid meet["']/i);
    matches(source, /viewBox=["'][^"']+["']/i);
    doesNotMatch(source, /(?:id|class|data-state)=["'][^"']*(?:before-state|after-state|state-before|state-after|scene-before|scene-after)[^"']*["']/i,
      "a tutorial image must show one state, not faded before/after layers");
    return source.replace(/\s+/g, " ").trim();
  });
  equal(new Set(pictures).size, 3, "all three tutorial pictures must be independently authored scenes");

  const html = read("index.html");
  const app = read("app.mjs");
  const css = read("styles.css");
  matches(`${html}\n${app}`, /跳过/);
  matches(`${html}\n${app}`, /重看教程|教程/);
  matches(app, /STORAGE_KEYS\.tutorial/);
  matches(app, /TUTORIAL_SLIDES/);
  matches(app, /tutorial[^\n]{0,120}(?:open|showModal)|(?:open|showModal)[^\n]{0,120}tutorial/i);
  matches(css, /object-fit\s*:\s*contain/);
});

test("accessibility and responsive CSS preserve 44px targets at phone through desktop sizes", () => {
  const html = read("index.html");
  const app = read("app.mjs");
  const css = read("styles.css");
  matches(`${html}\n${app}`, /role=["']grid["']|setAttribute\(\s*["']role["']\s*,\s*["']grid["']/i);
  matches(`${html}\n${app}`, /aria-label=/i);
  matches(`${html}\n${app}`, /aria-current|aria-pressed|aria-selected/i);
  matches(css, /(?:--[\w-]*(?:tap|touch|target)[\w-]*\s*:\s*44px|min-(?:width|height|inline-size|block-size)\s*:\s*(?:44px|var\([^)]*(?:tap|touch|target)))/i,
    "interactive controls need a 44px minimum target");
  matches(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i);
  matches(css, /prefers-reduced-motion[\s\S]{0,900}animation(?:-duration)?\s*:\s*(?:none|0?\.0*1ms)/i);
  matches(css, /@media\s*\([^)]*max-width\s*:/i);
  matches(css, /overflow-x\s*:\s*(?:hidden|clip)/i);
  matches(css, /min-width\s*:\s*0/);
  matches(css, /(?:width|max-width)\s*:\s*(?:min\(|clamp\(|calc\(|100%)/i);
  doesNotMatch(css, /[;{]\s*min-width\s*:\s*(?:3[3-9]\d|[4-9]\d\d|\d{4,})px/i, "fixed wide panels would overflow 320px");
});

test("rail candidates/exclusions have shape cues and the train animation stays inside the grid", () => {
  const html = read("index.html");
  const app = read("app.mjs");
  const css = read("styles.css");
  matches(`${html}\n${app}\n${css}`, /candidate/i);
  matches(`${html}\n${app}\n${css}`, /excluded/i);
  matches(`${html}\n${app}`, /×|✕|✖|叉号|排除/);
  matches(`${html}\n${app}\n${css}`, /train/i);
  matches(css, /\.quota-board\s*\{[^}]*display\s*:\s*grid[^}]*grid-template-columns/is);
  matches(css, /\.column-clues\s*\{[^}]*grid-area\s*:\s*1\s*\/\s*2/is);
  matches(css, /\.row-clues\s*\{[^}]*grid-area\s*:\s*2\s*\/\s*3/is,
    "row and column numbers live in dedicated grid tracks rather than squeezing or overlaying the board");
  matches(`${app}\n${css}`, /@keyframes\s+[\w-]*(?:train|journey|depart|arrival|rail)|(?:train|locomotive)\.animate\s*\(/i);
  matches(css, /(?:train|locomotive)[^{]*\{[^}]*pointer-events\s*:\s*none/is);
  matches(css, /(?:track-grid|rail-grid|board-grid|board-viewport|train-layer)[^{]*\{[^}]*overflow\s*:\s*(?:hidden|clip)/is,
    "the victory train must be clipped to the rail grid rather than cover quota clues");
});

let passed = 0;
const startedAt = Date.now();
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(error?.stack ?? error);
    process.exitCode = 1;
  }
}

const elapsedMs = Date.now() - startedAt;
console.log(`\nPolar Railway: ${passed}/${tests.length} tests passed · ${assertions} assertions · ${elapsedMs}ms`);
if (passed !== tests.length) process.exitCode = 1;
