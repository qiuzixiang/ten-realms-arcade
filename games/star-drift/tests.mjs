import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  DIRECTIONS,
  LEVELS,
  SAVE_SCHEMA,
  SAVE_VERSION,
  STATUS,
  attemptMove,
  createGame,
  createLevel,
  getLegalMoves,
  isLost,
  isWon,
  move,
  normalizeDirection,
  remainingEnergyPositions,
  restoreGame,
  serializeGame,
  solveLevel,
  tileAt,
  undo,
  undoMove,
  validateLevel,
} from "./logic.mjs";

let assertions = 0;

function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function strictEqual(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function throws(callback, matcher, message) {
  assertions += 1;
  assert.throws(callback, matcher, message);
}

function customLevel(id, grid, par = 9) {
  return createLevel({
    id,
    name: `Test ${id}`,
    difficulty: DIFFICULTIES.EASY,
    par,
    grid,
  });
}

// All eight unit vectors and useful UI spellings normalize canonically.
equal(DIRECTIONS, ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
strictEqual(normalizeDirection("down-left"), "SW");
strictEqual(normalizeDirection(" North East "), "NE");
strictEqual(normalizeDirection([1, -1]), "NE");
strictEqual(normalizeDirection({ dx: -1, dy: 0 }), "W");
strictEqual(normalizeDirection([0, 0]), null);
strictEqual(normalizeDirection([2, 0]), null);
strictEqual(normalizeDirection("warp"), null);

// Structural validation catches malformed level definitions early.
throws(() => createLevel({ id: "BAD", name: "bad", difficulty: "easy", par: 1, grid: ["###", "#@#", "#e#"] }), /id/);
throws(() => customLevel("ragged", ["#####", "#@e#", "#####"]), /same width/);
throws(() => customLevel("two-starts", ["#####", "#@@e#", "#####"]), /exactly one/);
throws(() => customLevel("no-energy", ["#####", "#@..#", "#####"]), /at least one/);
throws(() => customLevel("bad-tile", ["#####", "#@?e#", "#####"]), /Unknown tile/);

// A wall directly ahead stops the craft on the preceding cell. A blocked
// command is not a move and does not enter history.
const wallLevel = customLevel("wall-stop", [
  "#######",
  "#@...##",
  "#....e#",
  "#######",
]);
const wallStart = createGame(wallLevel);
const wallResult = attemptMove(wallStart, "E");
check(wallResult.moved);
equal(wallResult.path, [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]);
equal(wallResult.state.position, { x: 4, y: 1 });
strictEqual(wallResult.stopReason, "wall");
strictEqual(wallResult.state.moves, 1);
strictEqual(wallStart.moves, 0, "movement must not mutate its input state");
const blocked = attemptMove(wallStart, "N");
strictEqual(blocked.moved, false);
strictEqual(blocked.state, wallStart);
strictEqual(blocked.stopReason, "blocked");
strictEqual(blocked.state.history.length, 0);

// An anchor is entered and stops immediately. Energy on the traversed path is
// collected but never causes a stop.
const anchorLevel = customLevel("anchor-stop", [
  "########",
  "#@e.o.e#",
  "#......#",
  "########",
]);
const anchorResult = attemptMove(createGame(anchorLevel), "E");
equal(anchorResult.state.position, { x: 4, y: 1 });
strictEqual(anchorResult.stopReason, "stop");
equal(anchorResult.collected, [{ x: 2, y: 1 }]);
strictEqual(anchorResult.state.status, STATUS.PLAYING);
equal(remainingEnergyPositions(anchorResult.state), [{ x: 6, y: 1 }]);
const departAnchor = attemptMove(anchorResult.state, "W");
check(departAnchor.moved, "a craft may depart an anchor on its next command");

// The original loader permanently converts START to STOP. The craft can leave
// the starting anchor, but a later slide back across it must end on @ rather
// than continuing to the wall beyond it.
const startAnchorLevel = customLevel("start-is-anchor", [
  "#######",
  "#e....#",
  "#.@...#",
  "#.....#",
  "#######",
]);
strictEqual(tileAt(startAnchorLevel, 2, 2), "o");
check(startAnchorLevel.stops.some((position) => position.x === 2 && position.y === 2));
const leaveStart = attemptMove(createGame(startAnchorLevel), "E");
equal(leaveStart.state.position, { x: 5, y: 2 });
strictEqual(leaveStart.stopReason, "wall");
const returnToStart = attemptMove(leaveStart.state, "W");
equal(returnToStart.path, [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }]);
equal(returnToStart.state.position, startAnchorLevel.start);
strictEqual(returnToStart.stopReason, "stop");
strictEqual(returnToStart.state.status, STATUS.PLAYING);

const energyPassLevel = customLevel("energy-pass", [
  "#######",
  "#@e.o##",
  "#.....#",
  "#######",
]);
const energyPass = attemptMove(createGame(energyPassLevel), "E");
equal(energyPass.path, [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]);
strictEqual(energyPass.stopReason, "stop");
strictEqual(energyPass.state.status, STATUS.WON);
check(isWon(energyPass.state));

// A diagonal step checks its destination only. It may pass between two
// orthogonally adjacent walls, matching Inertia's corner-gap rule.
const diagonalLevel = customLevel("diagonal-gap", [
  "#####",
  "#@#.#",
  "##..#",
  "#..e#",
  "#####",
]);
const diagonalStart = createGame(diagonalLevel);
strictEqual(tileAt(diagonalLevel, 2, 1), "#");
strictEqual(tileAt(diagonalLevel, 1, 2), "#");
const diagonal = attemptMove(diagonalStart, "SE");
check(diagonal.moved);
equal(diagonal.path, [{ x: 2, y: 2 }, { x: 3, y: 3 }]);
strictEqual(diagonal.state.status, STATUS.WON);

// Mine precedence is absolute: collecting the last energy earlier in the same
// slide still produces loss. The fatal state retains that collection for UI
// animation, and undo restores the complete pre-move state.
const fatalLevel = customLevel("fatal-precedence", [
  "########",
  "#@e.x..#",
  "#......#",
  "########",
]);
const beforeFatal = createGame(fatalLevel);
const fatal = attemptMove(beforeFatal, "E");
strictEqual(fatal.state.status, STATUS.LOST);
check(isLost(fatal.state));
strictEqual(fatal.stopReason, "mine");
equal(fatal.collected, [{ x: 2, y: 1 }]);
equal(fatal.state.remainingEnergy, []);
strictEqual(fatal.state.collected, 1);
equal(fatal.state.position, { x: 4, y: 1 });
strictEqual(fatal.state.moves, 1);
const fatalUndo = undoMove(fatal.state);
strictEqual(fatalUndo.undone, true);
equal(fatalUndo.state.position, beforeFatal.position);
equal(fatalUndo.state.remainingEnergy, beforeFatal.remainingEnergy);
strictEqual(fatalUndo.state.status, STATUS.PLAYING);
strictEqual(fatalUndo.state.moves, 0);
strictEqual(fatalUndo.state.history.length, 0);
strictEqual(fatalUndo.state.moveLog.length, 0);
strictEqual(undo(fatal.state).status, STATUS.PLAYING);

// Terminal states reject further movement without polluting history.
const afterLoss = attemptMove(fatal.state, "W");
strictEqual(afterLoss.moved, false);
strictEqual(afterLoss.stopReason, "terminal");
strictEqual(afterLoss.state, fatal.state);
const afterWin = attemptMove(energyPass.state, "W");
strictEqual(afterWin.moved, false);
strictEqual(afterWin.stopReason, "terminal");

// getLegalMoves is geometric (a direction can be legal but fatal) and excludes
// directions whose immediately adjacent target is a wall.
equal(getLegalMoves(beforeFatal), ["E", "SE", "S"]);
equal(getLegalMoves(fatal.state), []);
throws(() => move(beforeFatal, "zero-g"), /Invalid direction/);

// Every shipped difficulty exists, every level has useful metadata, and the
// BFS solver returns a shortest non-fatal path that actually wins when replayed.
equal(new Set(LEVELS.map((level) => level.difficulty)), new Set(Object.values(DIFFICULTIES)));
check(LEVELS.length >= 3);
for (const level of LEVELS) {
  check(level.name.length > 0, `${level.id} needs a name`);
  check(Number.isInteger(level.par) && level.par > 0, `${level.id} needs a par`);
  const validation = validateLevel(level);
  check(validation.valid, `${level.id}: ${validation.errors.join("; ")}`);
  check(Array.isArray(validation.solution) && validation.solution.length > 0, `${level.id} needs a solution`);
  strictEqual(validation.solution.length, level.par, `${level.id} par must equal the shortest solution`);
  let replay = createGame(level);
  for (const direction of validation.solution) {
    const result = attemptMove(replay, direction);
    check(result.moved, `${level.id} solver emitted a blocked move`);
    check(result.status !== STATUS.LOST, `${level.id} solver crossed a mine`);
    replay = result.state;
  }
  strictEqual(replay.status, STATUS.WON, `${level.id} solver path must win`);
  equal(solveLevel(level), validation.solution, `${level.id} solver must be deterministic`);
}

const impossible = customLevel("impossible", [
  "#######",
  "#@#.#e#",
  "#######",
]);
strictEqual(solveLevel(impossible), null);
strictEqual(validateLevel(impossible).valid, false);
strictEqual(validateLevel({ nope: true }).valid, false);

// Save restoration accepts only the exact current schema and canonical move
// logs. Replaying the log reconstructs both dynamic state and undo history.
const savableLevel = LEVELS[0];
const solution = solveLevel(savableLevel);
let savable = createGame(savableLevel);
for (const direction of solution.slice(0, -1)) savable = move(savable, direction);
const encoded = serializeGame(savable);
const decodedPayload = JSON.parse(encoded);
strictEqual(decodedPayload.schema, SAVE_SCHEMA);
strictEqual(decodedPayload.version, SAVE_VERSION);
equal(decodedPayload.moveLog, savable.moveLog);
const restored = restoreGame(encoded, savableLevel.id);
check(restored !== null);
equal(restored.position, savable.position);
equal(restored.remainingEnergy, savable.remainingEnergy);
strictEqual(restored.status, savable.status);
strictEqual(restored.history.length, savable.history.length);
strictEqual(undo(restored).moves, Math.max(0, restored.moves - 1));

const invalidSaves = [
  "not json",
  null,
  {},
  { schema: SAVE_SCHEMA, version: SAVE_VERSION - 1, levelId: savableLevel.id, moveLog: [] },
  { schema: SAVE_SCHEMA, version: SAVE_VERSION, levelId: "missing-level", moveLog: [] },
  { schema: SAVE_SCHEMA, version: SAVE_VERSION, levelId: savableLevel.id, moveLog: ["east"] },
  { schema: SAVE_SCHEMA, version: SAVE_VERSION, levelId: savableLevel.id, moveLog: ["N"] },
  { schema: SAVE_SCHEMA, version: SAVE_VERSION, levelId: savableLevel.id, moveLog: [], extra: true },
];
for (const invalid of invalidSaves) strictEqual(restoreGame(invalid), null);
strictEqual(restoreGame(encoded, LEVELS[1].id), null);
strictEqual(restoreGame(encoded, { nope: true }), null);

// A caller cannot serialize an ad-hoc level or a tampered built-in state.
throws(() => serializeGame(createGame(fatalLevel)), /built-in/);
throws(() => serializeGame({ ...createGame(savableLevel), moves: 99 }), /inconsistent/);

console.log(`star-drift: ${assertions} assertions passed across ${LEVELS.length} proven levels.`);
