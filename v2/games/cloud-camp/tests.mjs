import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CELL_STATE,
  applyMove,
  countPerfectMatchings,
  createPuzzle,
  evaluatePosition,
  keyOf,
  maximumTreeTentMatching,
  normalizePosition,
  orthogonalNeighbours,
  pointFromKey,
  positionToJSON,
  provePuzzle,
  solvePuzzle,
  stateAt,
  touchingNeighbours,
} from "./logic.mjs";
import { generateUniquePuzzle, puzzleSignature, seededRandom } from "./generator.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  difficultyFor,
  findLevel,
  levelsForDifficulty,
} from "./levels.mjs";
import {
  DECORATIONS,
  HISTORY_LIMIT,
  VISITORS,
  campSummary,
  campCompletionEventId,
  campCompletionPayload,
  confirmCampCompletion,
  createCampRunId,
  createCampStats,
  createDefaultState,
  difficultyProgress,
  localDayKey,
  normalizeCampCompletionOutbox,
  normalizeCampStats,
  parseSnapshot,
  parseStoredGame,
  recordCampCompletion,
  recordCampCompletionOnce,
  serializeStoredGame,
  snapshotFromState,
} from "./storage.mjs";
import { REALM_TUTORIALS, tutorialArt } from "../../shared/tutorial-data.mjs";
import { awardCompletion, createProgress } from "../../shared/reward-engine.mjs";

const tests = [];
function test(name, callback) {
  tests.push({ name, callback });
}

function keys(...coordinates) {
  return new Set(coordinates.map(([row, column]) => keyOf(row, column)));
}

function clueFixture() {
  return createPuzzle({
    id: "clue-fixture",
    width: 4,
    height: 4,
    trees: [[0, 1], [3, 2]],
    rowClues: [1, 0, 0, 1],
    columnClues: [1, 0, 0, 1],
  });
}

test("coordinate helpers and neighbour searches respect corners and both adjacency systems", () => {
  const puzzle = clueFixture();
  assert.equal(keyOf(12, 3), "12:3");
  assert.deepEqual(pointFromKey("12:3"), { row: 12, column: 3 });
  assert.equal(pointFromKey("00:00"), null);
  assert.equal(pointFromKey("00:03"), null);
  assert.equal(pointFromKey("-1:3"), null);
  assert.equal(pointFromKey("bad"), null);
  assert.deepEqual(
    orthogonalNeighbours(puzzle, 0, 0).map(({ key }) => key).sort(),
    ["0:1", "1:0"],
  );
  assert.deepEqual(
    touchingNeighbours(puzzle, 0, 0).map(({ key }) => key).sort(),
    ["0:1", "1:0", "1:1"],
  );
});

test("puzzle validation rejects malformed dimensions, clues, trees, totals, and solutions", () => {
  assert.throws(() => createPuzzle(), TypeError);
  assert.throws(() => createPuzzle({ width: 3, height: 4, trees: [], rowClues: [], columnClues: [] }), RangeError);
  assert.throws(() => createPuzzle({ width: 4, height: 4, trees: [[0, 0]], rowClues: [1], columnClues: [1] }), TypeError);
  assert.throws(() => createPuzzle({ width: 4, height: 4, trees: [[0, 0], [0, 0]], rowClues: [1, 0, 0, 0], columnClues: [1, 0, 0, 0] }), TypeError);
  assert.throws(() => createPuzzle({ width: 4, height: 4, trees: [[4, 0]], rowClues: [1, 0, 0, 0], columnClues: [1, 0, 0, 0] }), RangeError);
  assert.throws(() => createPuzzle({ width: 4, height: 4, trees: [[0, 0]], rowClues: [1, 0, 0, 0], columnClues: [0, 0, 0, 0] }), TypeError);
  assert.throws(() => createPuzzle({ width: 5, height: 4, trees: [[0, 0]], rowClues: [5, 0, 0, 0], columnClues: [1, 0, 0, 0, 0] }), TypeError);
  assert.throws(() => createPuzzle({ width: 4, height: 4, trees: [[0, 0]], rowClues: [1, 0, 0, 0], columnClues: [1, 0, 0, 0], solution: [[0, 0]] }), RangeError);

  const rectangular = createPuzzle({
    width: 5,
    height: 4,
    trees: [[0, 0], [0, 2], [0, 4], [2, 0], [2, 2]],
    rowClues: [5, 0, 0, 0],
    columnClues: [1, 1, 1, 1, 1],
  });
  assert.equal(rectangular.width, 5, "a row clue may equal rectangular width");
});

test("tent, grass, and unknown form three reversible states while trees remain immutable", () => {
  const puzzle = clueFixture();
  const key = "0:0";
  const tent = applyMove(puzzle, {}, { type: "toggle-tent", key });
  assert.equal(tent.accepted, true);
  assert.equal(stateAt(puzzle, tent, key), CELL_STATE.TENT);

  const clearedTent = applyMove(puzzle, tent, { type: "toggle-tent", key });
  assert.equal(stateAt(puzzle, clearedTent, key), CELL_STATE.UNKNOWN);

  const grass = applyMove(puzzle, clearedTent, { type: "toggle-grass", key });
  assert.equal(stateAt(puzzle, grass, key), CELL_STATE.GRASS);
  const tentFromGrass = applyMove(puzzle, grass, { type: "toggle-tent", key });
  assert.equal(stateAt(puzzle, tentFromGrass, key), CELL_STATE.TENT);
  const cleared = applyMove(puzzle, tentFromGrass, { type: "set-unknown", key });
  assert.equal(stateAt(puzzle, cleared, key), CELL_STATE.UNKNOWN);

  const cycle1 = applyMove(puzzle, {}, { type: "cycle", key });
  const cycle2 = applyMove(puzzle, cycle1, { type: "cycle", key });
  const cycle3 = applyMove(puzzle, cycle2, { type: "cycle", key });
  assert.equal(stateAt(puzzle, cycle1, key), CELL_STATE.TENT);
  assert.equal(stateAt(puzzle, cycle2, key), CELL_STATE.GRASS);
  assert.equal(stateAt(puzzle, cycle3, key), CELL_STATE.UNKNOWN);

  assert.deepEqual(
    applyMove(puzzle, {}, { type: "toggle-tent", key: "0:1" }).reason,
    "not-playable",
  );
  assert.equal(applyMove(puzzle, {}, { type: "sing-to-cloud", key }).reason, "unknown-move");
});

test("normalization filters bounds, trees, malformed keys, and state overlap", () => {
  const puzzle = clueFixture();
  const normalized = normalizePosition(puzzle, {
    tents: ["0:0", "0:1", "9:9", "bad"],
    grass: ["0:0", "0:2", "3:2"],
  });
  assert.deepEqual(positionToJSON(normalized), { tents: ["0:0"], grass: ["0:2"] });
  assert.equal(stateAt(puzzle, normalized, "0:1"), null);
  assert.equal(stateAt(puzzle, normalized, "9:9"), null);
});

test("horizontal, vertical, and both diagonal tent contact are all conflicts", () => {
  const puzzle = createPuzzle({
    width: 5,
    height: 5,
    trees: [[4, 0], [4, 4]],
    rowClues: [1, 1, 0, 0, 0],
    columnClues: [1, 1, 0, 0, 0],
  });
  const pairs = [
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
    [[0, 0], [1, 1]],
    [[0, 1], [1, 0]],
  ];
  for (const pair of pairs) {
    const result = evaluatePosition(puzzle, { tents: keys(...pair) });
    assert.equal(result.touching.size, 2, `${JSON.stringify(pair)} must conflict`);
    assert.equal(result.complete, false);
  }
  assert.equal(evaluatePosition(puzzle, { tents: keys([0, 0], [0, 2]) }).touching.size, 0);
});

test("row and column clues distinguish under, exact, over, and impossible-by-grass", () => {
  const puzzle = clueFixture();
  const partial = evaluatePosition(puzzle, { tents: keys([0, 0]) });
  assert.deepEqual(partial.rows[0], { target: 1, count: 1, possible: 2, exact: true, over: false, impossible: false });
  assert.equal(partial.rows[3].exact, false);
  assert.equal(partial.rows[3].impossible, false, "an underfilled row with room must not be an error");
  assert.equal(partial.columns[0].exact, true);

  const over = evaluatePosition(puzzle, { tents: keys([0, 0], [0, 2]) });
  assert.equal(over.rows[0].over, true);
  assert.equal(over.rows[0].impossible, true);

  const blocked = evaluatePosition(puzzle, {
    tents: keys([0, 0]),
    grass: keys([3, 0], [3, 1], [3, 3]),
  });
  assert.equal(blocked.rows[3].count, 0);
  assert.equal(blocked.rows[3].possible, 0);
  assert.equal(blocked.rows[3].impossible, true);
});

test("a tent requires an orthogonally adjacent tree, never only a diagonal tree", () => {
  const puzzle = createPuzzle({
    width: 4,
    height: 4,
    trees: [[1, 1]],
    rowClues: [1, 0, 0, 0],
    columnClues: [1, 0, 0, 0],
  });
  const diagonal = evaluatePosition(puzzle, { tents: keys([0, 0]) });
  assert.deepEqual([...diagonal.orphanTents], ["0:0"]);
  const orthogonal = evaluatePosition(puzzle, { tents: keys([0, 1]) });
  assert.equal(orthogonal.orphanTents.size, 0);
});

test("maximum matching follows augmenting paths instead of making a greedy fixed pairing", () => {
  const puzzle = createPuzzle({
    width: 4,
    height: 4,
    trees: [[1, 1], [1, 3]],
    rowClues: [0, 1, 1, 0],
    columnClues: [0, 1, 1, 0],
  });
  const tents = keys([1, 2], [2, 1]);
  const matching = maximumTreeTentMatching(puzzle, tents);
  assert.deepEqual(matching, { size: 2, perfect: true });
  assert.equal(countPerfectMatchings(puzzle, tents, 3), 1);
});

test("local neighbours are insufficient when Hall's global matching condition fails", () => {
  const puzzle = createPuzzle({
    width: 5,
    height: 5,
    trees: [[1, 0], [1, 2], [3, 3]],
    rowClues: [0, 1, 0, 2, 0],
    columnClues: [0, 1, 1, 0, 1],
  });
  const tents = keys([1, 1], [3, 2], [3, 4]);
  const result = evaluatePosition(puzzle, { tents });
  assert.equal(result.clueExact, true);
  assert.equal(result.touching.size, 0);
  assert.equal(result.orphanTents.size, 0);
  assert.ok([...result.treeOptions.values()].every((options) => options.length > 0));
  assert.equal(result.matching.perfect, false);
  assert.equal(result.complete, false);
  assert.equal(result.contradiction, true);
});

test("a solved placement with multiple possible tree-tent matchings is still a legal player win", () => {
  const puzzle = createPuzzle({
    width: 4,
    height: 4,
    trees: [[1, 0], [0, 1], [2, 1], [1, 2]],
    rowClues: [2, 0, 2, 0],
    columnClues: [2, 0, 2, 0],
  });
  const tents = keys([0, 0], [0, 2], [2, 0], [2, 2]);
  assert.equal(countPerfectMatchings(puzzle, tents, 3), 2);
  const result = evaluatePosition(puzzle, { tents });
  assert.equal(result.matching.perfect, true);
  assert.equal(result.complete, true, "player completion requires existence, not uniqueness, of matching");
});

test("grass and untouched unknown cells are notes only and never required for victory", () => {
  const level = LEVELS[0];
  const openKey = [...Array(level.height * level.width)].map((_, index) => (
    keyOf(Math.floor(index / level.width), index % level.width)
  )).find((key) => !level.trees.includes(key) && !level.solution.includes(key));
  const solvedUnknown = evaluatePosition(level, { tents: level.solution });
  const solvedMarked = evaluatePosition(level, { tents: level.solution, grass: [openKey] });
  assert.equal(solvedUnknown.complete, true);
  assert.equal(solvedMarked.complete, true);
});

test("the exact solver reports zero, one, and multiple layouts without confusing matchings for layouts", () => {
  const ambiguous = createPuzzle({
    width: 4,
    height: 4,
    trees: [[0, 1], [1, 2], [1, 3]],
    rowClues: [2, 0, 1, 0],
    columnClues: [1, 0, 1, 1],
  });
  const multiple = solvePuzzle(ambiguous, { limit: 2 });
  assert.equal(multiple.count, 2);
  assert.equal(multiple.unique, false);
  assert.equal(multiple.limited, true);

  const zero = solvePuzzle(ambiguous, { limit: 2, position: { grass: ["0:0"] } });
  assert.equal(zero.count, 0);
  assert.equal(zero.unique, false);

  const unique = solvePuzzle(LEVELS[0], { limit: 2 });
  assert.equal(unique.count, 1);
  assert.equal(unique.unique, true);
  assert.equal(unique.limited, false);

  const truncated = solvePuzzle(LEVELS[0], { limit: 1 });
  assert.equal(truncated.count, 1);
  assert.equal(truncated.unique, false, "a one-result search limit must never prove uniqueness");
});

test("all nine seeded levels are reproducible, distinct, solved legally, and solver-proven unique", () => {
  assert.equal(DIFFICULTIES.length, 3);
  assert.equal(LEVELS.length, 9);
  assert.equal(new Set(LEVELS.map(({ id }) => id)).size, LEVELS.length);
  assert.equal(new Set(LEVELS.map(({ signature }) => signature)).size, LEVELS.length);
  for (const difficulty of DIFFICULTIES) {
    const levels = levelsForDifficulty(difficulty.id);
    assert.equal(levels.length, 3);
    assert.equal(difficultyFor(difficulty.id), difficulty);
  }
  assert.equal(findLevel("missing-camp"), null);

  for (const level of LEVELS) {
    assert.equal(level.trees.length, Math.floor(level.width * level.height / 5));
    assert.equal(new Set(level.trees).size, level.trees.length);
    assert.equal(new Set(level.solution).size, level.solution.length);
    const result = evaluatePosition(level, { tents: level.solution });
    assert.equal(result.complete, true, `${level.id} stored solution must satisfy every player rule`);
    const proof = provePuzzle(level);
    assert.equal(proof.count, 1, `${level.id} must have one tent layout`);
    assert.equal(proof.unique, true, `${level.id} uniqueness must be fully proven`);
    assert.equal(proof.limited, false);
    assert.equal(proof.matchingCount, 1, `${level.id} generated matching must also be unique`);
    assert.equal(proof.uniquelyMatched, true);
    assert.deepEqual(proof.solution, level.solution);
  }
});

test("the deterministic generator repeats one seed and varies another seed", () => {
  const config = { id: "repeat", width: 5, height: 5, seed: 119, minNodes: 5, attempts: 5000 };
  const first = generateUniquePuzzle(config).puzzle;
  const second = generateUniquePuzzle(config).puzzle;
  const other = generateUniquePuzzle({ ...config, id: "other", seed: 120 }).puzzle;
  assert.equal(puzzleSignature(first), puzzleSignature(second));
  assert.notEqual(puzzleSignature(first), puzzleSignature(other));
  const randomA = seededRandom(44);
  const randomB = seededRandom(44);
  assert.deepEqual([randomA(), randomA(), randomA()], [randomB(), randomB(), randomB()]);
});

test("snapshots and full saves round-trip strict three-state history", () => {
  const state = createDefaultState(LEVELS[1]);
  state.tents = keys([0, 0]);
  state.grass = keys([0, 2]);
  state.moves = 2;
  state.mistakes = 1;
  state.history = [
    { tents: new Set(), grass: new Set(), moves: 0, mistakes: 0 },
    { tents: new Set(), grass: keys([0, 2]), moves: 1, mistakes: 0 },
  ];
  state.muted = true;
  state.tool = "grass";
  const serialized = serializeStoredGame(state);
  const restored = parseStoredGame(JSON.stringify(serialized));
  assert.equal(restored.restored, true);
  assert.equal(restored.invalid, false);
  assert.deepEqual(snapshotFromState(restored.state), snapshotFromState(state));
  assert.equal(restored.state.history.length, 2);
  assert.equal(restored.state.muted, true);
  assert.equal(restored.state.tool, "grass");
  assert.deepEqual(snapshotFromState(parseSnapshot(state.level, serialized.active)), snapshotFromState(state));
});

test("corrupt, old, foreign, overlapping, tree-tampered, negative, and forged-history saves fall back safely", () => {
  const valid = serializeStoredGame(createDefaultState());
  const corruptions = [
    "{broken",
    { ...valid, version: 999 },
    { ...valid, active: { ...valid.active, levelId: "missing" } },
    { ...valid, active: { ...valid.active, tents: [LEVELS[0].trees[0]] } },
    { ...valid, active: { ...valid.active, tents: ["0:0"], grass: ["0:0"] } },
    { ...valid, active: { ...valid.active, moves: -1 } },
    { ...valid, active: { ...valid.active, moves: 1, mistakes: 2 } },
    { ...valid, active: { ...valid.active, history: [{ tents: ["bad"], grass: [], moves: 0, mistakes: 0 }] } },
    { ...valid, active: { ...valid.active, moves: 1, history: [{ tents: [], grass: [], moves: 99, mistakes: 0 }] } },
    { ...valid, active: { ...valid.active, moves: 3, history: [{ tents: [], grass: [], moves: 1, mistakes: 0 }] } },
    { ...valid, active: { ...valid.active, moves: 1, history: [{ tents: [], grass: [], moves: 0, mistakes: 0 }] } },
    { ...valid, active: { ...valid.active, moves: 1, tents: ["0:0", "0:2"], history: [{ tents: [], grass: [], moves: 0, mistakes: 0 }] } },
    { ...valid, active: { ...valid.active, tents: ["00:00"] } },
    { ...valid, active: { ...valid.active, tents: ["00:03"] } },
  ];
  for (const corruption of corruptions) {
    const result = parseStoredGame(typeof corruption === "string" ? corruption : JSON.stringify(corruption));
    assert.equal(result.restored, false);
    assert.equal(result.invalid, true);
    assert.equal(result.state.level, LEVELS[0]);
    assert.deepEqual(positionToJSON(result.state), { tents: [], grass: [] });
  }
  assert.equal(parseStoredGame(null).invalid, false);
});

test("a save shortened by undo after the history cap still restores safely", () => {
  const state = createDefaultState(LEVELS[0]);
  const key = "0:0";
  state.moves = HISTORY_LIMIT;
  state.tents = new Set();
  state.history = Array.from({ length: HISTORY_LIMIT - 1 }, (_, index) => ({
    tents: (index + 1) % 2 === 1 ? new Set([key]) : new Set(),
    grass: new Set(),
    moves: index + 1,
    mistakes: 0,
  }));

  const restored = parseStoredGame(JSON.stringify(serializeStoredGame(state)));
  assert.equal(restored.restored, true);
  assert.equal(restored.invalid, false);
  assert.equal(restored.state.moves, HISTORY_LIMIT);
  assert.equal(restored.state.history.length, HISTORY_LIMIT - 1);
});

test("history is bounded and solved saves preserve independent local and shared completion markers", () => {
  const solved = createDefaultState(LEVELS[0]);
  solved.tents = new Set(LEVELS[0].solution);
  solved.moves = HISTORY_LIMIT + 15;
  const spareKey = keyOf(0, 1);
  solved.history = Array.from({ length: HISTORY_LIMIT + 15 }, (_, index) => ({
    tents: index <= 100
      ? ((100 - index) % 2 === 1 ? new Set([spareKey]) : new Set())
      : new Set(LEVELS[0].solution.slice(0, index - 100)),
    grass: new Set(),
    moves: index,
    mistakes: 0,
  }));
  solved.completionReported = false;
  const restored = parseStoredGame(JSON.stringify(serializeStoredGame(solved)));
  assert.equal(restored.restored, true);
  assert.equal(restored.state.history.length, HISTORY_LIMIT);
  assert.equal(restored.state.completed, true);
  assert.equal(restored.state.completionRecorded, false);
  assert.equal(restored.state.completionReported, false);

  const lying = serializeStoredGame(createDefaultState());
  lying.active.completed = true;
  lying.active.completionReported = false;
  const unsolved = parseStoredGame(JSON.stringify(lying));
  assert.equal(unsolved.state.completed, false, "saved completion flag is never trusted over the engine");
  assert.equal(unsolved.state.completionReported, false);
});

test("run and event identities are stable across refresh but change for a genuinely new camp", () => {
  const level = LEVELS[0];
  const firstRunId = "cloud-run-00000001";
  const secondRunId = "cloud-run-00000002";
  assert.equal(createCampRunId(() => firstRunId), firstRunId);
  const first = createDefaultState(level, firstRunId);
  const restored = parseStoredGame(JSON.stringify(serializeStoredGame(first)));
  const second = createDefaultState(level, secondRunId);
  assert.equal(restored.state.runId, firstRunId);
  assert.equal(restored.state.completionEventId, campCompletionEventId(firstRunId));
  assert.equal(second.completionEventId, campCompletionEventId(secondRunId));
  assert.notEqual(second.runId, first.runId, "restarting the same level is a fresh run");
  assert.notEqual(second.completionEventId, first.completionEventId, "level and score never define event identity");
  assert.throws(() => campCompletionEventId("bad"), /Invalid cloud-camp run id/);

  const legacy = serializeStoredGame(first);
  delete legacy.active.runId;
  delete legacy.active.completionEventId;
  const migrated = parseStoredGame(JSON.stringify(legacy));
  const migratedAgain = parseStoredGame(JSON.stringify(serializeStoredGame(migrated.state)));
  assert.match(migrated.state.runId, /^[a-z0-9][a-z0-9._-]{7,95}$/i);
  assert.equal(migratedAgain.state.runId, migrated.state.runId, "a legacy save receives one persisted migration id");
});

test("a host throw retries the identical persisted event without duplicating local or shared settlement", () => {
  const level = LEVELS[0];
  const runId = "cloud-retry-0000001";
  let state = createDefaultState(level, runId);
  state.tents = new Set(level.solution);
  state.moves = level.par;
  state.completed = true;

  const local = recordCampCompletionOnce(state, new Date("2026-08-31T08:00:00Z"));
  state = local.state;
  assert.equal(local.recorded, true);
  assert.equal(state.completionRecorded, true);
  assert.equal(state.stats.clears[level.id].wins, 1);
  assert.equal(state.completionOutbox.length, 1);
  const stablePayload = campCompletionPayload(state);
  assert.deepEqual(state.completionOutbox[0], stablePayload);
  assert.equal(stablePayload.runId, runId);
  assert.equal(stablePayload.eventId, `cloud-camp:${runId}:complete`);

  let sharedProgress = createProgress();
  let xpAfterFirstDelivery = 0;
  const failed = confirmCampCompletion(state, (payload) => {
    assert.deepEqual(payload, stablePayload);
    const accepted = awardCompletion(sharedProgress, { ...payload, realm: "cloud-camp" }, new Date("2026-08-31T08:00:01Z"));
    sharedProgress = accepted.progress;
    xpAfterFirstDelivery = sharedProgress.xp;
    throw new Error("bridge lost the acknowledgement after host settlement");
  });
  assert.equal(failed.attempted, true);
  assert.equal(failed.succeeded, false);
  assert.equal(failed.state.completionReported, false);
  assert.deepEqual(failed.state.completionOutbox, [stablePayload], "a failed acknowledgement keeps the exact payload");
  assert.equal(sharedProgress.realms["cloud-camp"].clears[stablePayload.levelId].wins, 1);

  const restored = parseStoredGame(JSON.stringify(serializeStoredGame(failed.state)));
  assert.equal(restored.state.completed, true);
  assert.equal(restored.state.completionRecorded, true);
  assert.equal(restored.state.completionReported, false);
  assert.equal(restored.state.runId, runId);
  assert.equal(restored.state.completionEventId, stablePayload.eventId);
  assert.deepEqual(restored.state.completionOutbox, [stablePayload]);
  const duplicateLocal = recordCampCompletionOnce(restored.state);
  assert.equal(duplicateLocal.recorded, false);
  assert.equal(duplicateLocal.state.stats.clears[level.id].wins, 1);
  assert.deepEqual(duplicateLocal.state.completionOutbox, [stablePayload], "same-run settlement cannot enqueue twice");

  const deliveries = [];
  const retried = confirmCampCompletion(duplicateLocal.state, (payload) => {
    deliveries.push(payload.eventId);
    const replay = awardCompletion(sharedProgress, { ...payload, realm: "cloud-camp" }, new Date("2026-08-31T08:00:02Z"));
    assert.equal(replay.duplicateEvent, true, "the V2.5 host contract deduplicates a repeated stable event");
    sharedProgress = replay.progress;
    return replay;
  });
  assert.equal(retried.succeeded, true);
  assert.equal(retried.state.completionReported, true);
  assert.deepEqual(retried.state.completionOutbox, []);
  assert.deepEqual(deliveries, [stablePayload.eventId]);
  assert.equal(retried.state.stats.clears[level.id].wins, 1);
  assert.equal(sharedProgress.xp, xpAfterFirstDelivery);
  assert.equal(sharedProgress.realms["cloud-camp"].clears[stablePayload.levelId].wins, 1);

  const replayAfterAck = confirmCampCompletion(retried.state, () => assert.fail("an acknowledged outbox must stay empty"));
  assert.equal(replayAfterAck.attempted, false);

  const nextRun = createDefaultState(level, "cloud-retry-0000002");
  nextRun.completionOutbox = failed.state.completionOutbox;
  const pendingAcrossNewRun = parseStoredGame(JSON.stringify(serializeStoredGame(nextRun)));
  assert.deepEqual(pendingAcrossNewRun.state.completionOutbox, [stablePayload], "an old pending event survives a new run");
  const oldDelivery = confirmCampCompletion(pendingAcrossNewRun.state, () => ({ duplicateEvent: true }));
  assert.equal(oldDelivery.state.completionOutbox.length, 0);
  assert.equal(oldDelivery.state.completionReported, false, "delivering an older outbox item cannot mark the new run complete");
});

test("every pending camp completion survives beyond the former queue capacity", () => {
  const level = LEVELS[0];
  const events = Array.from({ length: 130 }, (_, index) => campCompletionPayload({
    ...createDefaultState(level, `cloud-pending-${String(index).padStart(4, "0")}`),
    moves: level.par + index,
  }));
  const normalized = normalizeCampCompletionOutbox([...events, events[0]]);
  assert.equal(normalized.length, events.length);
  assert.equal(normalized[0].eventId, events[0].eventId);
  assert.equal(normalized.at(-1).eventId, events.at(-1).eventId);
});

test("camp records defend streaks, bests, flawless runs, and efficiency milestones", () => {
  const firstDate = new Date(2026, 7, 31, 10, 0);
  const nextDate = new Date(2026, 8, 1, 10, 0);
  const gapDate = new Date(2026, 8, 3, 10, 0);
  assert.equal(localDayKey(firstDate), "2026-08-31");
  const level = LEVELS[0];
  const first = recordCampCompletion(createCampStats(), {
    levelId: level.id, moves: level.par, mistakes: 0,
  }, firstDate);
  assert.equal(first.firstClear, true);
  assert.equal(first.personalBest, false);
  assert.equal(first.stats.clears[level.id].flawless, true);
  assert.equal(first.stats.clears[level.id].efficient, true);
  assert.equal(first.stats.streak.count, 1);

  const replay = recordCampCompletion(first.stats, {
    levelId: level.id, moves: level.par + 3, mistakes: 2,
  }, firstDate);
  assert.equal(replay.firstClear, false);
  assert.equal(replay.personalBest, false);
  assert.equal(replay.stats.streak.count, 1, "same-day replays cannot extend streaks");
  assert.equal(replay.stats.clears[level.id].flawless, true, "earned flawless record is sticky");

  const best = recordCampCompletion(replay.stats, {
    levelId: level.id, moves: level.par - 1, mistakes: 1,
  }, nextDate);
  assert.equal(best.personalBest, true);
  assert.equal(best.stats.streak.count, 2);
  const afterGap = recordCampCompletion(best.stats, {
    levelId: LEVELS[1].id, moves: LEVELS[1].par, mistakes: 0,
  }, gapDate);
  assert.equal(afterGap.stats.streak.count, 1);
  assert.equal(afterGap.stats.streak.best, 2);
});

test("nine distinct clears unlock four decorations, all difficulty visitors, and progress counters", () => {
  let stats = createCampStats();
  for (const [index, level] of LEVELS.entries()) {
    stats = recordCampCompletion(stats, {
      levelId: level.id,
      moves: level.par,
      mistakes: index % 2,
    }, new Date(2026, 7, 31, 12, index)).stats;
  }
  stats.streak.best = 3;
  const summary = campSummary(stats);
  assert.equal(summary.uniqueClears, 9);
  assert.equal(summary.decorations.length, DECORATIONS.length);
  assert.equal(summary.visitors.length, VISITORS.length);
  assert.equal(summary.efficientClears, 9);
  assert.equal(summary.flawlessClears, 5);
  assert.deepEqual(difficultyProgress(stats), { cloudlet: 3, ridgewind: 3, aurora: 3 });
  assert.deepEqual(normalizeCampStats(JSON.parse(JSON.stringify(stats))), stats);
});

test("shared tutorial uses three rule-accurate v2 scenes without covering the row and column labels", () => {
  const tutorial = REALM_TUTORIALS["cloud-camp"];
  assert.equal(tutorial.version, 2);
  assert.deepEqual(tutorial.cards.map(({ focus }) => focus), ["elements", "action", "goal"]);
  const [elementsArt, actionArt, goalArt] = tutorial.cards.map(({ focus }) => tutorialArt("cloud-camp", focus));
  assert.match(elementsArt, /上方/);
  assert.match(elementsArt, /列数/);
  assert.match(elementsArt, /右侧行数/);
  assert.doesNotMatch(elementsArt, /<text x="145" y="25">列数<\/text>/);
  assert.match(actionArt, /未知|帐篷|草地/);
  assert.match(goalArt, /class="art-goal"/);
});

test("page wiring keeps engine, save, shared rewards, tutorials, source, audio, and accessibility connected", async () => {
  const [html, app, styles, logic, storage] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./app.mjs", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
    readFile(new URL("./logic.mjs", import.meta.url), "utf8"),
    readFile(new URL("./storage.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(html, /data-realm="cloud-camp"/);
  assert.match(html, /\.\.\/\.\.\/shared\/realm-ui\.css/);
  assert.match(html, /type="module" src="\.\.\/\.\.\/shared\/realm-ui\.mjs"/);
  assert.match(html, /role="grid"/);
  assert.match(html, /aria-labelledby="rules-title" aria-describedby="rules-summary"/);
  assert.match(html, /aria-labelledby="victory-title" aria-describedby="victory-copy"/);
  assert.match(html, /github\.com\/ebnbin\/puzzles\/blob\/main\/doc-zh\/tents\.html/);
  assert.match(html, /THIRD_PARTY_NOTICES\.md/);
  assert.match(html, /MIT License/);
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:/i, "runtime assets must stay local");

  assert.match(app, /evaluatePosition\(state\.level, state\)/);
  assert.match(app, /if \(state\.completed && !state\.completionRecorded\)/);
  assert.match(app, /function flushCampCompletionOutbox\(\)/);
  assert.match(app, /confirmCampCompletion\(state, reportRealmCompletion\)/);
  assert.match(app, /if \(!writeSave\(\{ quiet: true \}\)\)/, "outbox must be persisted before host delivery");
  assert.doesNotMatch(app, /window\.__realmCompletionQueue/, "the persistent outbox is the sole delivery channel");
  assert.match(storage, /eventId: campCompletionEventId\(runId\)/);
  assert.match(storage, /completionOutbox: normalizeCampCompletionOutbox/);
  assert.match(app, /document\.querySelector\("dialog\[open\]"\)/);
  assert.match(app, /MutationObserver\(syncDialogScrollLock\)/);
  assert.match(app, /tentOptions\.get\(key\)/);
  assert.match(app, /highlightCandidateTrees\(focusKey\)/);
  assert.match(app, /focusBoard:\s*true/);
  assert.doesNotMatch(app, /proof\.solution|level\.solution/, "the page must not read stored answers");
  assert.match(app, /AudioContext|webkitAudioContext/);
  assert.match(app, /pagehide/);
  assert.match(app, /visibilitychange/);

  assert.doesNotMatch(styles, /min-width:\s*320px/);
  assert.match(styles, /--cell:\s*44px/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /html:has\(dialog\[open\]\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /animation:\s*none\s*!important/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(app, /function syncBoardScale\(\)/);
  assert.match(app, /state\.level\.width \+ 1/);
  assert.match(app, /elements\.boardViewport\.scrollLeft = 0/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.board-viewport\s*{[^}]*overflow-x:\s*hidden/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.tree-visual\s*{[^}]*width:\s*min\(34px, 77%\)/);
  assert.match(html, /styles\.css\?v=mobile-fit-1/);
  assert.match(html, /type="module" src="\.\/app\.mjs"/);
  assert.doesNotMatch(styles, /@import\s+url\(["']?https?:/i);
  assert.doesNotMatch(logic, /document|localStorage|AudioContext/);
  assert.doesNotMatch(storage, /window|document|localStorage/);
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

console.log(`\n${passed}/${tests.length} cloud-camp tests passed.`);
