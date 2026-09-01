import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  DIFFICULTIES,
  DIRECTIONS,
  LEVELS,
  PORT,
  SAVE_SCHEMA,
  SAVE_VERSION,
  STATUS,
  applyAction,
  canonicalShape,
  countNetworkSolutions,
  createGame,
  createLevel,
  degreeOf,
  evaluateNetwork,
  findLevel,
  generateSolvedNetwork,
  hasPort,
  inBounds,
  indexOf,
  isLocked,
  isSolved,
  keyOf,
  levelsForDifficulty,
  moduleShape,
  orientationOptions,
  pointFromKey,
  pointOf,
  portsFor,
  reachableFromLighthouse,
  restartGame,
  restoreGame,
  rotate,
  rotateMask,
  rotationPeriod,
  sameShape,
  scrambleNetwork,
  serializeGame,
  solveNetwork,
  toggleLock,
  validateLevel,
} from "./logic.mjs";
import { createVictoryDialogController } from "./victory-dialog.mjs";

let assertions = 0;
const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
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

function simpleLevel(id = "test-tree") {
  //  0 ─ 1
  //  │
  //  2 ─ 3
  const solution = [PORT.E | PORT.S, PORT.W, PORT.N | PORT.E, PORT.W];
  return createLevel({
    id,
    name: `Test ${id}`,
    difficulty: "easy",
    width: 2,
    height: 2,
    lighthouse: { row: 0, column: 0 },
    solution,
    initial: [solution[0], PORT.N, solution[2], solution[3]],
  });
}

function turnsTo(from, to) {
  for (let turns = 0; turns < 4; turns += 1) {
    if (rotateMask(from, turns) === to) return turns;
  }
  return -1;
}

test("direction masks rotate clockwise and preserve module shape", () => {
  equal(DIRECTIONS.map((direction) => direction.name), ["N", "E", "S", "W"]);
  strictEqual(rotateMask(PORT.N), PORT.E);
  strictEqual(rotateMask(PORT.E), PORT.S);
  strictEqual(rotateMask(PORT.S), PORT.W);
  strictEqual(rotateMask(PORT.W), PORT.N);
  strictEqual(rotateMask(PORT.N | PORT.S), PORT.E | PORT.W);
  strictEqual(rotateMask(PORT.N | PORT.E, -1), PORT.N | PORT.W);
  strictEqual(rotateMask(PORT.N | PORT.E, 4), PORT.N | PORT.E);
  throws(() => rotateMask(0), /mask/i);
  throws(() => rotateMask(PORT.N, 0.5), /integer/i);

  strictEqual(rotationPeriod(PORT.N), 4);
  strictEqual(rotationPeriod(PORT.N | PORT.S), 2);
  strictEqual(rotationPeriod(15), 1);
  strictEqual(sameShape(PORT.N | PORT.E, PORT.S | PORT.W), true);
  strictEqual(sameShape(PORT.N | PORT.S, PORT.N | PORT.E), false);
  strictEqual(canonicalShape(PORT.S | PORT.W), canonicalShape(PORT.N | PORT.E));
});

test("port and module helpers distinguish every legal shape", () => {
  strictEqual(hasPort(PORT.N | PORT.W, "N"), true);
  strictEqual(hasPort(PORT.N | PORT.W, "E"), false);
  strictEqual(hasPort(PORT.N | PORT.W, PORT.W), true);
  equal(portsFor(PORT.N | PORT.S | PORT.W), ["N", "S", "W"]);
  strictEqual(degreeOf(PORT.E), 1);
  strictEqual(degreeOf(PORT.N | PORT.S), 2);
  strictEqual(degreeOf(PORT.N | PORT.E | PORT.S), 3);
  strictEqual(degreeOf(15), 4);
  strictEqual(moduleShape(PORT.W), "end");
  strictEqual(moduleShape(PORT.N | PORT.S), "straight");
  strictEqual(moduleShape(PORT.N | PORT.E), "corner");
  strictEqual(moduleShape(PORT.N | PORT.E | PORT.S), "tee");
  strictEqual(moduleShape(15), "cross");
});

test("coordinate helpers reject malformed and out-of-board cells", () => {
  const board = { width: 3, height: 2 };
  strictEqual(keyOf(1, 2), "1:2");
  equal(pointFromKey("12:3"), { row: 12, column: 3 });
  strictEqual(pointFromKey("-1:2"), null);
  strictEqual(pointFromKey("bad"), null);
  strictEqual(inBounds(board, 0, 0), true);
  strictEqual(inBounds(board, 2, 0), false);
  strictEqual(inBounds(board, 0.5, 0), false);
  strictEqual(indexOf(board, 1, 2), 5);
  strictEqual(indexOf(board, 1, 3), -1);
  equal(pointOf(board, 4), { row: 1, column: 1 });
  strictEqual(pointOf(board, 6), null);
});

test("a legal spanning tree satisfies every explicit Net invariant", () => {
  const board = { width: 2, height: 2, lighthouseIndex: 0 };
  const masks = [PORT.E | PORT.S, PORT.W, PORT.N | PORT.E, PORT.W];
  const result = evaluateNetwork(board, masks);

  strictEqual(result.portsComplete, true);
  strictEqual(result.dangling.length, 0);
  strictEqual(result.allConnected, true);
  strictEqual(result.components, 1);
  strictEqual(result.hasCycle, false);
  strictEqual(result.acyclic, true);
  strictEqual(result.edgeCount, 3);
  strictEqual(result.reachableCount, 4);
  equal([...result.reachable], [0, 1, 2, 3]);
  strictEqual(result.solved, true);
  strictEqual(result.complete, true);
  strictEqual(isSolved(board, masks), true);
});

test("the outer border is closed and cannot receive a connector", () => {
  const board = { width: 2, height: 1, lighthouseIndex: 0 };
  const result = evaluateNetwork(board, [PORT.W, PORT.E]);

  strictEqual(result.solved, false);
  strictEqual(result.portsComplete, false);
  strictEqual(result.dangling.length, 2);
  equal(result.dangling.map(({ index, direction, reason }) => ({ index, direction, reason })), [
    { index: 0, direction: "W", reason: "border" },
    { index: 1, direction: "E", reason: "border" },
  ]);
  strictEqual(result.edgeCount, 0);
  strictEqual(result.reachableCount, 1);
});

test("a one-sided connector is dangling and carries no lighthouse energy", () => {
  const board = { width: 2, height: 2, lighthouseIndex: 0 };
  const masks = [PORT.E, PORT.S, PORT.E, PORT.N | PORT.W];
  const result = evaluateNetwork(board, masks);

  strictEqual(result.dangling.some((item) => (
    item.index === 0 && item.direction === "E" && item.reason === "mismatch"
  )), true);
  strictEqual(result.adjacency[0].length, 0);
  equal([...result.reachable], [0]);
  equal([...reachableFromLighthouse(board, masks)], [0]);
  strictEqual(result.powered.has(1), false, "unreciprocated lines must never be highlighted");
  strictEqual(result.solved, false);
});

test("separate reciprocal subnetworks remain unpowered and cannot win", () => {
  const board = { width: 4, height: 1, lighthouseIndex: 0 };
  const result = evaluateNetwork(board, [PORT.E, PORT.W, PORT.E, PORT.W]);

  strictEqual(result.dangling.length, 0);
  strictEqual(result.portsComplete, true);
  strictEqual(result.components, 2);
  strictEqual(result.edgeCount, 2);
  strictEqual(result.hasCycle, false);
  equal([...result.reachable], [0, 1]);
  equal([...result.unreachable], [2, 3]);
  strictEqual(result.allConnected, false);
  strictEqual(result.solved, false);
});

test("two disconnected closed loops are both detected and cannot win", () => {
  const board = { width: 4, height: 2, lighthouseIndex: 0 };
  const loops = [
    PORT.E | PORT.S,
    PORT.S | PORT.W,
    PORT.E | PORT.S,
    PORT.S | PORT.W,
    PORT.N | PORT.E,
    PORT.N | PORT.W,
    PORT.N | PORT.E,
    PORT.N | PORT.W,
  ];
  const result = evaluateNetwork(board, loops);

  strictEqual(result.dangling.length, 0);
  strictEqual(result.allConnected, false);
  strictEqual(result.components, 2);
  strictEqual(result.edgeCount, 8);
  strictEqual(result.cycleCount, 2);
  strictEqual(result.hasCycle, true);
  strictEqual(result.solved, false, "Net expressly forbids closed loops");
});

test("level construction rejects malformed, altered, solved, or illegal data", () => {
  throws(() => createLevel(), /object/i);
  throws(() => createLevel({}), /id/i);
  throws(() => createLevel({
    id: "BAD", name: "bad", difficulty: "easy", width: 2, height: 2,
    solution: [6, 8, 3, 8], initial: [6, 1, 3, 8],
  }), /id/i);
  throws(() => createLevel({
    id: "bad-difficulty", name: "bad", difficulty: "storm", width: 2, height: 2,
    solution: [6, 8, 3, 8], initial: [6, 1, 3, 8],
  }), /difficulty/i);
  throws(() => createLevel({
    id: "ragged", name: "bad", difficulty: "easy", width: 2, height: 2,
    solution: [6, 8, 3], initial: [6, 1, 3, 8],
  }), /Expected 4/i);
  throws(() => createLevel({
    id: "shape-swap", name: "bad", difficulty: "easy", width: 2, height: 2,
    solution: [6, 8, 3, 8], initial: [10, 1, 3, 8],
  }), /does not match/i);
  throws(() => createLevel({
    id: "solved-start", name: "bad", difficulty: "easy", width: 2, height: 2,
    solution: [6, 8, 3, 8], initial: [6, 8, 3, 8],
  }), /already solved/i);
  throws(() => createLevel({
    id: "loop-answer", name: "bad", difficulty: "easy", width: 2, height: 2,
    solution: [6, 12, 3, 9], initial: [3, 12, 3, 9],
  }), /connected.*acyclic/i);
});

test("the deterministic generator builds cross-free spanning trees", () => {
  const first = generateSolvedNetwork(6, 6, "deterministic", { row: 3, column: 3 });
  const again = generateSolvedNetwork(6, 6, "deterministic", { row: 3, column: 3 });
  const other = generateSolvedNetwork(6, 6, "different", { row: 3, column: 3 });

  equal(first, again);
  ok(first.some((mask, index) => mask !== other[index]), "different seeds should change topology");
  ok(first.every((mask) => degreeOf(mask) >= 1 && degreeOf(mask) <= 3));
  strictEqual(first.some((mask) => moduleShape(mask) === "cross"), false);
  const result = evaluateNetwork({ width: 6, height: 6, lighthouseIndex: 21 }, first);
  strictEqual(result.solved, true);
  strictEqual(result.edgeCount, 35);
  strictEqual(result.hasCycle, false);
  strictEqual(result.dangling.length, 0);
});

test("scrambling rotates in place without changing cable shapes", () => {
  const solution = generateSolvedNetwork(5, 5, "scramble-shapes");
  const first = scrambleNetwork(solution, "turns");
  const second = scrambleNetwork(solution, "turns");

  equal(first, second);
  strictEqual(first.masks.length, solution.length);
  strictEqual(first.turns.length, solution.length);
  for (let index = 0; index < solution.length; index += 1) {
    strictEqual(sameShape(first.masks[index], solution[index]), true);
    strictEqual(first.masks[index], rotateMask(solution[index], first.turns[index]));
    ok(first.turns[index] > 0, "cross-free generated pieces all receive a non-solution turn");
  }
});

test("the constraint solver counts only complete, border-safe, loop-free networks", () => {
  const level = simpleLevel("solver-tree");
  equal(orientationOptions(PORT.N), [PORT.N, PORT.E, PORT.S, PORT.W]);
  equal(orientationOptions(PORT.N | PORT.S), [PORT.N | PORT.S, PORT.E | PORT.W]);
  strictEqual(countNetworkSolutions(level, level.initial, 2), 1);
  const solutions = solveNetwork(level, level.initial, { limit: 2 });
  strictEqual(solutions.length, 1);
  equal(solutions[0], level.solution);
  strictEqual(evaluateNetwork(level, solutions[0]).solved, true);

  const loopShapes = {
    width: 2,
    height: 2,
    lighthouseIndex: 0,
  };
  // Four corners can only form the forbidden square loop on a 2×2 board.
  strictEqual(countNetworkSolutions(loopShapes, [6, 12, 3, 9], 2), 0);
  // Four endpoints cannot form one connected network on a one-row board.
  strictEqual(countNetworkSolutions(
    { width: 4, height: 1, lighthouseIndex: 0 },
    [PORT.E, PORT.W, PORT.E, PORT.W],
    2,
  ), 0);
  throws(() => solveNetwork(level, level.initial, { limit: 0 }), /positive integer/i);
});

test("rotation, inverse rotation, and lock actions are immutable", () => {
  const level = simpleLevel();
  const initial = createGame(level);
  strictEqual(initial.status, STATUS.PLAYING);
  strictEqual(initial.moves, 0);
  strictEqual(Object.isFrozen(initial), true);
  strictEqual(Object.isFrozen(initial.orientations), true);

  const clockwise = applyAction(initial, { type: "rotate-clockwise", row: 0, column: 1 });
  strictEqual(clockwise.accepted, true);
  strictEqual(clockwise.effect, "rotated-clockwise");
  strictEqual(clockwise.state.moves, 1);
  strictEqual(clockwise.state.orientations[1], PORT.E);
  strictEqual(initial.orientations[1], PORT.N, "the source state must not mutate");

  const back = applyAction(clockwise.state, {
    type: "rotate-counterclockwise", key: "0:1",
  });
  strictEqual(back.accepted, true);
  strictEqual(back.state.orientations[1], PORT.N);
  strictEqual(back.state.moves, 2);

  const locked = applyAction(back.state, { type: "toggle-lock", index: 1 });
  strictEqual(locked.accepted, true);
  strictEqual(locked.effect, "locked");
  strictEqual(isLocked(locked.state, 1), true);
  strictEqual(locked.state.moves, 2, "locking is an input aid, not a puzzle move");
  strictEqual(locked.state.evaluation.solved, back.state.evaluation.solved);

  const rejected = applyAction(locked.state, { type: "rotate", index: 1, turns: 1 });
  strictEqual(rejected.accepted, false);
  strictEqual(rejected.reason, "locked");
  strictEqual(rejected.state, locked.state);

  const unlocked = toggleLock(locked.state, { row: 0, column: 1 });
  strictEqual(isLocked(unlocked, 1), false);
  const convenience = rotate(unlocked, 1, -1);
  strictEqual(convenience.orientations[1], PORT.W);
});

test("locks never alter the rule evaluation or make an invalid board valid", () => {
  const level = simpleLevel("locks-annotation");
  const base = createGame(level);
  let locked = base;
  for (let index = 0; index < level.total; index += 1) locked = toggleLock(locked, index);

  equal(locked.orientations, base.orientations);
  strictEqual(locked.moves, base.moves);
  strictEqual(locked.evaluation.solved, false);
  strictEqual(locked.evaluation.dangling.length, base.evaluation.dangling.length);
  strictEqual(locked.evaluation.reachableCount, base.evaluation.reachableCount);
  strictEqual(locked.locked.every(Boolean), true);

  const solvedWithLocks = createGame(level, {
    orientations: level.solution,
    locked: Array(level.total).fill(true),
  });
  strictEqual(solvedWithLocks.status, STATUS.WON);
  strictEqual(solvedWithLocks.evaluation.solved, true);
});

test("invalid, no-op, fixed, and post-win rotations are rejected", () => {
  const level = simpleLevel("action-rejections");
  const game = createGame(level);
  strictEqual(applyAction(game, { type: "rotate", index: 99 }).reason, "outside-board");
  strictEqual(applyAction(game, { type: "sing", index: 0 }).reason, "unknown-action");
  strictEqual(applyAction(game, { type: "rotate", index: 0, turns: 0 }).reason, "no-op");
  strictEqual(applyAction(game, { type: "rotate", index: 0, turns: 1.5 }).reason, "invalid-turns");

  const crossSolution = [PORT.E, PORT.W | PORT.S, PORT.E, PORT.N | PORT.W];
  // Test fixed-shape handling directly with a state-shaped object, because
  // cross modules are intentionally absent from generated levels.
  const crossState = {
    ...game,
    orientations: [15, ...game.orientations.slice(1)],
    locked: [...game.locked],
  };
  strictEqual(applyAction(crossState, { type: "rotate", index: 0 }).reason, "fixed-shape");
  ok(crossSolution.every((mask) => mask > 0));

  const won = createGame(level, { orientations: level.solution });
  strictEqual(won.status, STATUS.WON);
  strictEqual(applyAction(won, { type: "rotate", index: 0 }).reason, "complete");
});

test("restart restores the authored scramble and clears locks and moves", () => {
  const level = simpleLevel("restart-test");
  let game = createGame(level);
  game = applyAction(game, { type: "rotate", index: 0 }).state;
  game = toggleLock(game, 2);
  const restarted = restartGame(game);

  equal(restarted.orientations, level.initial);
  strictEqual(restarted.locked.every((item) => !item), true);
  strictEqual(restarted.moves, 0);
  strictEqual(restarted.status, STATUS.PLAYING);
});

test("level catalogue supplies three genuinely different difficulty sizes", () => {
  strictEqual(DIFFICULTIES.length, 3);
  strictEqual(LEVELS.length, 9);
  strictEqual(new Set(LEVELS.map((level) => level.id)).size, LEVELS.length);
  equal(DIFFICULTIES.map(({ width, height }) => [width, height]), [
    [5, 5],
    [6, 6],
    [7, 7],
  ]);

  for (const difficulty of DIFFICULTIES) {
    const levels = levelsForDifficulty(difficulty.id);
    strictEqual(levels.length, 3);
    ok(levels.every((level) => level.difficulty === difficulty.id));
    ok(levels.every((level) => level.width === difficulty.width));
    ok(levels.every((level) => level.height === difficulty.height));
  }
  for (const level of LEVELS) strictEqual(findLevel(level.id), level);
  strictEqual(findLevel("missing-beacon"), null);
});

test("every built-in starts unsolved and carries a proven legal answer", () => {
  for (const level of LEVELS) {
    const report = validateLevel(level);
    strictEqual(report.valid, true, `${level.id}: ${report.errors.join(", ")}`);
    strictEqual(report.solution.solved, true, `${level.id} reference answer must win`);
    strictEqual(report.solution.portsComplete, true, `${level.id} answer has a dangling end`);
    strictEqual(report.solution.allConnected, true, `${level.id} answer is disconnected`);
    strictEqual(report.solution.hasCycle, false, `${level.id} answer contains a loop`);
    strictEqual(report.solution.edgeCount, level.total - 1, `${level.id} answer is not a tree`);
    strictEqual(report.solution.reachableCount, level.total, `${level.id} answer is not fully powered`);
    strictEqual(level.unique, true, `${level.id} must retain the default unique setting`);
    strictEqual(countNetworkSolutions(level, level.initial, 2), 1, `${level.id} must have one answer`);
    strictEqual(report.initial.solved, false, `${level.id} must not begin complete`);
    strictEqual(report.initial.hasCycle, false, `${level.id} authored scramble should begin loop-free`);
    ok(report.initial.dangling.length > 0, `${level.id} needs a visible initial mismatch`);
    ok(level.initial.some((mask, index) => mask !== level.solution[index]));
    ok(level.solution.every((mask) => degreeOf(mask) >= 1 && degreeOf(mask) <= 3));
    ok(level.solution.every((mask, index) => sameShape(mask, level.initial[index])));
    strictEqual(level.lighthouseIndex, indexOf(level, level.lighthouse.row, level.lighthouse.column));
    ok(level.referenceTurns > 0);
  }
});

test("rotating each built-in to its stored answer completes the game", () => {
  for (const level of LEVELS) {
    let game = createGame(level);
    for (let index = 0; index < level.total; index += 1) {
      const turns = turnsTo(game.orientations[index], level.solution[index]);
      ok(turns >= 0, `${level.id} tile ${index} must be a rotation of its answer`);
      if (turns > 0 && game.status !== STATUS.WON) {
        const action = applyAction(game, { type: "rotate", index, turns });
        strictEqual(action.accepted, true, `${level.id} tile ${index} should rotate`);
        game = action.state;
      }
    }
    strictEqual(game.status, STATUS.WON, `${level.id} reference orientations must complete play`);
    strictEqual(isSolved(game), true);
    strictEqual(game.evaluation.reachableCount, level.total);
  }
});

test("save round-trip preserves orientation, locks, moves, and derived energy", () => {
  const level = LEVELS[0];
  let game = createGame(level);
  game = applyAction(game, { type: "rotate", index: 0 }).state;
  game = toggleLock(game, 2);
  const encoded = serializeGame(game);
  const payload = JSON.parse(encoded);

  strictEqual(payload.schema, SAVE_SCHEMA);
  strictEqual(payload.version, SAVE_VERSION);
  strictEqual(payload.levelId, level.id);
  const restored = restoreGame(encoded, level.id);
  ok(restored);
  equal(restored.orientations, game.orientations);
  equal(restored.locked, game.locked);
  strictEqual(restored.moves, game.moves);
  strictEqual(restored.status, game.status);
  equal([...restored.evaluation.reachable], [...game.evaluation.reachable]);
  equal(restored.evaluation.dangling, game.evaluation.dangling);
});

test("save restoration refuses corrupt, stale, foreign, and shape-changing data", () => {
  const level = LEVELS[0];
  const valid = JSON.parse(serializeGame(createGame(level)));
  const invalid = [
    null,
    "not json",
    {},
    { ...valid, schema: "other/game" },
    { ...valid, version: SAVE_VERSION + 1 },
    { ...valid, levelId: "missing-level" },
    { ...valid, orientations: valid.orientations.slice(1) },
    { ...valid, orientations: valid.orientations.map((mask, index) => (index === 0 ? 15 : mask)) },
    { ...valid, locked: [true] },
    { ...valid, moves: -1 },
  ];
  for (const payload of invalid) strictEqual(restoreGame(payload), null);
  strictEqual(restoreGame(valid, LEVELS[1].id), null);
  throws(() => serializeGame(createGame(simpleLevel("not-built-in"))), /built-in/i);
});

test("victory dialog traps its lifecycle and restores focus only on dismissal", () => {
  class FakeDialog extends EventTarget {
    open = false;
    showCalls = 0;
    closeCalls = 0;

    showModal() {
      this.showCalls += 1;
      this.open = true;
    }

    close() {
      this.closeCalls += 1;
      this.open = false;
    }
  }

  class FakeControl extends EventTarget {
    constructor(isConnected = true) {
      super();
      this.isConnected = isConnected;
      this.focusCalls = 0;
      this.onFocus = null;
    }

    focus() {
      this.focusCalls += 1;
      this.onFocus?.();
    }
  }

  const dialog = new FakeDialog();
  const primary = new FakeControl();
  const dismissButton = new FakeControl();
  const connectedTarget = new FakeControl();
  const detachedTarget = new FakeControl(false);
  let activeControl = null;
  primary.onFocus = () => { activeControl = primary; };
  dismissButton.onFocus = () => { activeControl = dismissButton; };
  let returnTarget = connectedTarget;
  let dismissals = 0;
  let fallbacks = 0;
  const controller = createVictoryDialogController({
    dialog,
    primaryAction: primary,
    dismissAction: dismissButton,
    getReturnFocus: () => returnTarget,
    getActiveFocus: () => activeControl,
    focusFallback: () => { fallbacks += 1; },
    onDismiss: () => { dismissals += 1; },
  });

  strictEqual(controller.show(), true);
  strictEqual(controller.show(), false, "an open modal must not be opened twice");
  strictEqual(dialog.showCalls, 1);
  strictEqual(primary.focusCalls, 1);

  activeControl = dismissButton;
  const forwardTab = new Event("keydown", { cancelable: true });
  Object.defineProperties(forwardTab, {
    key: { value: "Tab" },
    shiftKey: { value: false },
  });
  dialog.dispatchEvent(forwardTab);
  strictEqual(forwardTab.defaultPrevented, true);
  strictEqual(activeControl, primary, "Tab must wrap from the last action to the first");

  const reverseTab = new Event("keydown", { cancelable: true });
  Object.defineProperties(reverseTab, {
    key: { value: "Tab" },
    shiftKey: { value: true },
  });
  dialog.dispatchEvent(reverseTab);
  strictEqual(reverseTab.defaultPrevented, true);
  strictEqual(activeControl, dismissButton, "Shift+Tab must wrap from the first action to the last");

  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  strictEqual(cancel.defaultPrevented, true, "Escape must use the controlled dismissal path");
  strictEqual(dialog.open, false);
  strictEqual(dialog.closeCalls, 1);
  strictEqual(dismissals, 1);
  strictEqual(connectedTarget.focusCalls, 1);
  dialog.dispatchEvent(new Event("close"));
  strictEqual(connectedTarget.focusCalls, 1, "a queued native close event must not restore twice");

  controller.show();
  dismissButton.dispatchEvent(new Event("click"));
  strictEqual(dialog.closeCalls, 2);
  strictEqual(dismissals, 2);
  strictEqual(connectedTarget.focusCalls, 2, "the close button restores the pre-modal target");

  returnTarget = detachedTarget;
  controller.show();
  dismissButton.dispatchEvent(new Event("click"));
  strictEqual(detachedTarget.focusCalls, 0);
  strictEqual(fallbacks, 1, "a replaced board tile falls back to the current selection");

  returnTarget = connectedTarget;
  controller.show();
  strictEqual(controller.close(), true);
  strictEqual(dismissals, 3, "next/restart/undo closure must not count as dismissal");
  strictEqual(connectedTarget.focusCalls, 2, "programmatic closure must not restore stale focus");
});

test("victory prompt has a native labelled modal contract", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const openingTag = html.match(/<dialog\b[^>]*\bid="victory-panel"[^>]*>/)?.[0] ?? "";

  ok(openingTag, "victory-panel must be a native dialog");
  ok(/aria-labelledby="victory-title"/.test(openingTag));
  ok(/aria-describedby="victory-copy"/.test(openingTag));
  ok(/<h3\s+id="victory-title">/.test(html));
  ok(/<p\s+id="victory-copy">/.test(html));
  strictEqual(/\b(?:aria-hidden|inert)\b/.test(openingTag), false);
});

test("page wires shared progression and defers victory behind any open guide", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./app.mjs", import.meta.url), "utf8"),
  ]);

  ok(/\.\.\/\.\.\/shared\/realm-ui\.css/.test(html));
  ok(/type="module" src="\.\.\/\.\.\/shared\/realm-ui\.mjs\?v=2"/.test(html));
  ok(/completionReported:\s*payload\.completionReported === true \|\| restoredGame\.status === STATUS\.WON/.test(app));
  ok(/par:\s*game\.level\.referenceTurns/.test(app), "the proven reference turn count is a reliable par");
  ok(/if \(!completionReported\)\s*{[\s\S]*?reportRealmCompletion\(\)/.test(app));
  ok(/document\.querySelectorAll\("dialog\[open\]"\)/.test(app));
  ok(/window\.__realmCompletionQueue \?\?= \[\]/.test(app));
});

test("phone layout does not force the document wider than the visual viewport", async () => {
  const [css, html] = await Promise.all([
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
    readFile(new URL("./index.html", import.meta.url), "utf8"),
  ]);
  ok(/@media \(max-width: 720px\)[\s\S]*?html,\s*body\s*{[\s\S]*?min-width:\s*0;/.test(css));
  ok(html.includes('href="./styles.css?v=mobile-2"'));
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

console.log(`\nstorm-lanterns: ${assertions} assertions passed across ${passed} tests and ${LEVELS.length} proven levels.`);
