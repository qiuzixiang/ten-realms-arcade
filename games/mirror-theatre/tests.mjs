import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ACTOR,
  ACTOR_CODE,
  ACTOR_TYPES,
  CELL,
  CODE_ACTOR,
  DIRECTION,
  LEVELS,
  SIDE,
  actorsToSolutionRows,
  allFloorKeys,
  applyMove,
  clockwiseClues,
  clueAt,
  cluesFromClockwise,
  countSolutions,
  createPuzzle,
  edgeEntries,
  entryKey,
  evaluatePosition,
  findLevel,
  isVisible,
  keyOf,
  normalizePosition,
  pointFromKey,
  positionToJSON,
  reflectDirection,
  solutionPosition,
  solvePuzzle,
  traceAllRays,
  traceFrom,
  traceRay,
} from "./logic.mjs";
import {
  shouldHandleGlobalShortcut,
  shouldRestoreDifficultyFocus,
} from "./shortcut.mjs";

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
  assert.deepEqual(actual, expected, message);
}

function throws(callback, expected, message) {
  assertions += 1;
  assert.throws(callback, expected, message);
}

function blankClues(width, height, value = 0) {
  return {
    top: Array(width).fill(value),
    right: Array(height).fill(value),
    bottom: Array(width).fill(value),
    left: Array(height).fill(value),
  };
}

function fixture(rows, options = {}) {
  const width = rows[0].length;
  const height = rows.length;
  const floorCount = rows.reduce(
    (total, row) => total + [...row].filter((cell) => cell === CELL.FLOOR).length,
    0,
  );
  return createPuzzle({
    id: options.id ?? "test-fixture",
    rows,
    targets: options.targets ?? {
      [ACTOR.HUMAN]: floorCount,
      [ACTOR.HOLOGRAM]: 0,
      [ACTOR.ROBOT]: 0,
    },
    clues: options.clues ?? blankClues(width, height),
    solution: options.solution,
  });
}

function edgeResult(result, side, index) {
  const value = result.edgeResults.get(entryKey({ side, index }));
  ok(value, `missing edge result ${side}:${index}`);
  return value;
}

test("主题映射保留 Ghost / Vampire / Zombie 的可见性真值", () => {
  equal(ACTOR_TYPES, [ACTOR.HUMAN, ACTOR.HOLOGRAM, ACTOR.ROBOT]);
  equal(ACTOR_CODE, { human: "H", hologram: "O", robot: "R" });
  equal(CODE_ACTOR, { H: ACTOR.HUMAN, O: ACTOR.HOLOGRAM, R: ACTOR.ROBOT });

  // Vampire -> 真人：只在尚未反射的直接视线中可见。
  equal(isVisible(ACTOR.HUMAN, false), true);
  equal(isVisible(ACTOR.HUMAN, true), false);
  // Ghost -> 全息：只在至少经过一面镜子后可见。
  equal(isVisible(ACTOR.HOLOGRAM, false), false);
  equal(isVisible(ACTOR.HOLOGRAM, true), true);
  // Zombie -> 机械：直视与反射两种状态均可见。
  equal(isVisible(ACTOR.ROBOT, false), true);
  equal(isVisible(ACTOR.ROBOT, true), true);
  equal(isVisible("candidate-only", false), false);
});

test("每个非镜格必须恰好放一位演员，三类总数必须覆盖全部地板", () => {
  const clues = blankClues(1, 1);
  throws(() => createPuzzle({
    rows: ["."],
    targets: { human: 0, hologram: 0, robot: 0 },
    clues,
  }), /sum to the number of non-mirror cells/);
  throws(() => createPuzzle({
    rows: ["."],
    targets: { human: 1, hologram: 0, robot: 0 },
    clues,
    solution: ["."],
  }), /Every solution floor/);
  throws(() => createPuzzle({
    rows: ["/."],
    targets: { human: 1, hologram: 0, robot: 0 },
    clues: blankClues(2, 1),
    solution: ["HH"],
  }), /mirrors must match/);
  throws(() => createPuzzle({
    rows: ["."],
    targets: { human: 1, hologram: 0, robot: 0 },
    clues,
    solution: ["H"],
  }), /Declared solution does not satisfy/);

  const level = findLevel("velvet-foyer");
  const position = solutionPosition(level);
  const removedKey = allFloorKeys(level)[0];
  position.actors.delete(removedKey);
  const partial = evaluatePosition(level, position);
  equal(partial.filledCount, level.floorCount - 1);
  equal(partial.emptyKeys, new Set([removedKey]));
  equal(partial.complete, false);
  equal(
    ACTOR_TYPES.reduce((sum, actor) => sum + level.targets[actor], 0),
    level.floorCount,
  );
  equal([...partial.totalResults.values()].every((result) => result.exact), false);
});

test("/ 与 \\ 镜面在四个入射方向上精确反射", () => {
  equal(reflectDirection(CELL.MIRROR_SLASH, DIRECTION.UP), DIRECTION.RIGHT);
  equal(reflectDirection(CELL.MIRROR_SLASH, DIRECTION.RIGHT), DIRECTION.UP);
  equal(reflectDirection(CELL.MIRROR_SLASH, DIRECTION.DOWN), DIRECTION.LEFT);
  equal(reflectDirection(CELL.MIRROR_SLASH, DIRECTION.LEFT), DIRECTION.DOWN);
  equal(reflectDirection(CELL.MIRROR_BACKSLASH, DIRECTION.UP), DIRECTION.LEFT);
  equal(reflectDirection(CELL.MIRROR_BACKSLASH, DIRECTION.LEFT), DIRECTION.UP);
  equal(reflectDirection(CELL.MIRROR_BACKSLASH, DIRECTION.DOWN), DIRECTION.RIGHT);
  equal(reflectDirection(CELL.MIRROR_BACKSLASH, DIRECTION.RIGHT), DIRECTION.DOWN);
  throws(() => reflectDirection(CELL.FLOOR, DIRECTION.UP), /Reflection requires/);
  throws(() => reflectDirection(CELL.MIRROR_SLASH, "diagonal"), /Unknown light direction/);
});

test("边缘线索按顺时针排列，从边界格起步并在对边退出", () => {
  const clockwise = Array.from({ length: 10 }, (_, index) => index);
  const puzzle = fixture(["..", "..", ".."], {
    targets: { human: 6, hologram: 0, robot: 0 },
    clues: cluesFromClockwise(2, 3, clockwise),
  });

  equal(puzzle.clues, {
    top: [0, 1],
    right: [2, 3, 4],
    bottom: [6, 5],
    left: [9, 8, 7],
  });
  equal(clockwiseClues(puzzle), clockwise);
  equal(edgeEntries(puzzle), [
    { side: SIDE.TOP, index: 0 },
    { side: SIDE.TOP, index: 1 },
    { side: SIDE.RIGHT, index: 0 },
    { side: SIDE.RIGHT, index: 1 },
    { side: SIDE.RIGHT, index: 2 },
    { side: SIDE.BOTTOM, index: 1 },
    { side: SIDE.BOTTOM, index: 0 },
    { side: SIDE.LEFT, index: 2 },
    { side: SIDE.LEFT, index: 1 },
    { side: SIDE.LEFT, index: 0 },
  ]);
  equal(clueAt(puzzle, { side: SIDE.BOTTOM, index: 1 }), 5);
  equal(clueAt(puzzle, { side: SIDE.LEFT, index: 2 }), 7);

  const top = traceRay(puzzle, { side: SIDE.TOP, index: 0 });
  equal(top.path.map((step) => step.key), ["0:0", "1:0", "2:0"]);
  equal(top.occurrences.map((item) => item.hasReflected), [false, false, false]);
  equal(top.exit, { side: SIDE.BOTTOM, index: 0 });

  const right = traceRay(puzzle, { side: SIDE.RIGHT, index: 1 });
  equal(right.path.map((step) => step.key), ["1:1", "1:0"]);
  equal(right.exit, { side: SIDE.LEFT, index: 1 });

  const bottom = traceRay(puzzle, { side: SIDE.BOTTOM, index: 1 });
  equal(bottom.path.map((step) => step.key), ["2:1", "1:1", "0:1"]);
  equal(bottom.exit, { side: SIDE.TOP, index: 1 });

  const left = traceRay(puzzle, { side: SIDE.LEFT, index: 2 });
  equal(left.path.map((step) => step.key), ["2:0", "2:1"]);
  equal(left.exit, { side: SIDE.RIGHT, index: 2 });
  throws(() => traceRay(puzzle, { side: SIDE.TOP, index: 2 }), /outside the board/);
});

test("首次反射后 hasReflected 永久为 true，多镜不会按奇偶切回直视", () => {
  const puzzle = findLevel("ninefold-applause");
  const trace = traceRay(puzzle, { side: SIDE.TOP, index: 2 });
  equal(trace.mirrorsHit, 9);
  equal(trace.loop, false);
  equal(trace.hasReflected, true);
  equal(trace.exit, { side: SIDE.LEFT, index: 3 });
  equal(
    trace.occurrences.map((item) => `${item.key}:${item.hasReflected}`),
    [
      "0:2:false",
      "1:0:true",
      "0:1:true",
      "0:2:true",
      "2:2:true",
      "3:1:true",
      "3:0:true",
    ],
  );

  const firstMirror = trace.path.findIndex((step) => step.cell !== CELL.FLOOR);
  equal(firstMirror, 1);
  equal(trace.path.slice(0, firstMirror).every((step) => !step.hasReflected), true);
  equal(trace.path.slice(firstMirror).every((step) => step.hasReflected), true);
  equal(trace.path.filter((step) => step.cell !== CELL.FLOOR).length, 9);
});

test("同一格被同一条光路重复经过时按 occurrence 计数，partial upper 也不去重", () => {
  const puzzle = findLevel("ninefold-applause");
  const trace = traceRay(puzzle, { side: SIDE.BOTTOM, index: 3 });
  equal(
    trace.occurrences.map((item) => `${item.key}:${item.hasReflected}`),
    ["4:3:false", "3:3:false", "3:3:true", "4:2:true"],
  );
  equal(trace.occurrences.length, 4);
  equal(new Set(trace.occurrences.map((item) => item.key)).size, 3);

  const empty = edgeResult(evaluatePosition(puzzle), SIDE.BOTTOM, 3);
  equal(empty.visible, 0);
  equal(empty.unknownOccurrences, 4);
  equal(empty.maximum, 4, "upper bound must count the repeated unknown cell twice");

  const noted = edgeResult(evaluatePosition(puzzle, {
    notes: new Map([["3:3", new Set(ACTOR_TYPES)]]),
  }), SIDE.BOTTOM, 3);
  equal(noted.visible, 0);
  equal(noted.unknownOccurrences, 4);
  equal(noted.maximum, 4);

  const robot = edgeResult(evaluatePosition(puzzle, {
    actors: new Map([["3:3", ACTOR.ROBOT]]),
  }), SIDE.BOTTOM, 3);
  equal(robot.visible, 2, "robot is visible on both visits");
  equal(robot.unknownOccurrences, 2);
  equal(robot.maximum, 4);

  const human = edgeResult(evaluatePosition(puzzle, {
    actors: new Map([["3:3", ACTOR.HUMAN]]),
  }), SIDE.BOTTOM, 3);
  equal(human.visible, 1, "human is visible only on the direct visit");

  const hologram = edgeResult(evaluatePosition(puzzle, {
    actors: new Map([["3:3", ACTOR.HOLOGRAM]]),
  }), SIDE.BOTTOM, 3);
  equal(hologram.visible, 1, "hologram is visible only on the reflected visit");
});

test("每条边缘光路从出口反向入射时，格子序列严格互逆", () => {
  const puzzle = findLevel("ninefold-applause");
  const traces = traceAllRays(puzzle);
  equal(traces.length, 2 * (puzzle.width + puzzle.height));
  for (const forward of traces) {
    ok(forward.exit, `${entryKey(forward.entry)} must leave the board`);
    const reverse = traceRay(puzzle, forward.exit);
    equal(reverse.exit, forward.entry, `${entryKey(forward.entry)} must return to its entrance`);
    equal(
      reverse.path.map((step) => step.key),
      forward.path.map((step) => step.key).reverse(),
      `${entryKey(forward.entry)} path must be reversible`,
    );
    equal(
      reverse.occurrences.map((item) => item.key),
      forward.occurrences.map((item) => item.key).reverse(),
      `${entryKey(forward.entry)} floor occurrences must be reversible`,
    );
  }
});

test("四镜封闭环由 (row,column,direction) visited state 截断，不会无限循环", () => {
  const puzzle = fixture(["/\\.", "\\/.", "..."]);
  const trace = traceFrom(puzzle, {
    row: 0,
    column: 0,
    direction: DIRECTION.UP,
    hasReflected: false,
  });
  equal(trace.loop, true);
  equal(trace.exit, null);
  equal(trace.path.map((step) => step.key), ["0:0", "0:1", "1:1", "1:0"]);
  equal(trace.occurrences, []);
  equal(trace.visitedStates, 4);
  equal(trace.mirrorsHit, 4);
  equal(trace.hasReflected, true);

  const limited = traceFrom(fixture(["..."]), {
    row: 0,
    column: 0,
    direction: DIRECTION.RIGHT,
  }, { stateLimit: 1 });
  equal(limited.loop, true);
  equal(limited.path.map((step) => step.key), ["0:0"]);
  equal(limited.visitedStates, 1);
});

test("候选标记不填格、不计全局总数，也不计边缘可见数", () => {
  const puzzle = findLevel("mirror-score");
  const notes = new Map(allFloorKeys(puzzle).map((key) => [key, new Set(ACTOR_TYPES)]));
  const result = evaluatePosition(puzzle, { notes });
  equal(result.notes.size, puzzle.floorCount);
  equal(result.actors.size, 0);
  equal(result.filledCount, 0);
  equal(result.emptyKeys.size, puzzle.floorCount);
  equal(result.actorCounts, { human: 0, hologram: 0, robot: 0 });
  equal([...result.edgeResults.values()].every((edge) => edge.visible === 0), true);
  equal(result.complete, false);
});

test("过量与不可能达成的全局/边缘线索会进入明确错误状态", () => {
  const puzzle = fixture([".."], {
    targets: { human: 1, hologram: 1, robot: 0 },
    clues: blankClues(2, 1, 0),
  });
  const actors = new Map([
    ["0:0", ACTOR.ROBOT],
    ["0:1", ACTOR.ROBOT],
  ]);
  const result = evaluatePosition(puzzle, { actors });
  equal(result.totalResults.get(ACTOR.ROBOT).over, true);
  equal(result.totalResults.get(ACTOR.ROBOT).impossible, true);
  equal(result.totalResults.get(ACTOR.HUMAN).impossible, true);
  equal(result.totalResults.get(ACTOR.HOLOGRAM).impossible, true);
  equal([...result.edgeResults.values()].every((edge) => edge.over && edge.impossible), true);
  equal(edgeResult(result, SIDE.LEFT, 0).visible, 2);
  equal(result.conflictKeys, new Set(["0:0", "0:1"]));
  equal(result.errors, 9);
  equal(result.complete, false);

  const unreachable = fixture(["."], {
    targets: { human: 1, hologram: 0, robot: 0 },
    clues: { top: [2], right: [0], bottom: [0], left: [0] },
  });
  const under = edgeResult(evaluatePosition(unreachable), SIDE.TOP, 0);
  equal(under.visible, 0);
  equal(under.maximum, 1);
  equal(under.over, false);
  equal(under.impossible, true);
});

test("移动 API 完整循环三类演员与候选，且拒绝镜格和非法操作", () => {
  const puzzle = fixture(["./"]);
  const original = { actors: new Map(), notes: new Map() };

  const human = applyMove(puzzle, original, { type: "cycle-actor", row: 0, column: 0 });
  equal(human.accepted, true);
  equal(human.effect, "actor-human");
  equal(human.actors.get("0:0"), ACTOR.HUMAN);
  equal(original.actors.size, 0, "moves must not mutate their input");

  const hologram = applyMove(puzzle, human, { type: "cycle-actor", key: "0:0" });
  equal(hologram.actors.get("0:0"), ACTOR.HOLOGRAM);
  const robot = applyMove(puzzle, hologram, { type: "cycle-actor", key: "0:0" });
  equal(robot.actors.get("0:0"), ACTOR.ROBOT);
  const cleared = applyMove(puzzle, robot, { type: "cycle-actor", key: "0:0" });
  equal(cleared.effect, "actor-cleared");
  equal(cleared.actors.has("0:0"), false);

  const note = applyMove(puzzle, cleared, {
    type: "toggle-note",
    key: "0:0",
    actor: ACTOR.HUMAN,
  });
  equal(note.accepted, true);
  equal(note.notes.get("0:0"), new Set([ACTOR.HUMAN]));
  const noNote = applyMove(puzzle, note, {
    type: "toggle-note",
    key: "0:0",
    actor: ACTOR.HUMAN,
  });
  equal(noNote.notes.has("0:0"), false);

  let cycledNotes = noNote;
  const expectedNotes = [
    [ACTOR.HUMAN],
    [ACTOR.HOLOGRAM],
    [ACTOR.ROBOT],
    [ACTOR.HUMAN, ACTOR.HOLOGRAM],
    [ACTOR.HUMAN, ACTOR.ROBOT],
    [ACTOR.HOLOGRAM, ACTOR.ROBOT],
    ACTOR_TYPES,
    [],
  ];
  for (const expected of expectedNotes) {
    cycledNotes = applyMove(puzzle, cycledNotes, { type: "cycle-notes", key: "0:0" });
    equal(cycledNotes.accepted, true);
    equal(cycledNotes.notes.get("0:0") ?? new Set(), new Set(expected));
  }

  const setActor = applyMove(puzzle, note, {
    type: "set-actor",
    key: "0:0",
    actor: ACTOR.ROBOT,
  });
  equal(setActor.actors.get("0:0"), ACTOR.ROBOT);
  equal(setActor.notes.has("0:0"), false, "placing an actor clears candidates");
  const occupiedNote = applyMove(puzzle, setActor, {
    type: "toggle-note",
    key: "0:0",
    actor: ACTOR.HUMAN,
  });
  equal(occupiedNote.accepted, false);
  equal(occupiedNote.reason, "occupied");

  const clearCell = applyMove(puzzle, setActor, { type: "clear-cell", key: "0:0" });
  equal(clearCell.accepted, true);
  equal(positionToJSON(clearCell), { actors: {}, notes: {} });
  equal(applyMove(puzzle, clearCell, { type: "clear-cell", key: "0:0" }).reason, "unchanged");
  equal(applyMove(puzzle, clearCell, {
    type: "set-actor", key: "0:0", actor: "understudy",
  }).reason, "unknown-actor");
  equal(applyMove(puzzle, clearCell, {
    type: "toggle-note", key: "0:0", actor: "understudy",
  }).reason, "unknown-actor");
  equal(applyMove(puzzle, clearCell, { type: "cycle-actor", key: "0:1" }).reason, "not-a-floor");
  equal(applyMove(puzzle, clearCell, { type: "cycle-actor", key: "9:9" }).reason, "not-a-floor");
  equal(applyMove(puzzle, clearCell, { type: "teleport", key: "0:0" }).reason, "unknown-move");

  const normalized = normalizePosition(puzzle, {
    actors: { "0:0": ACTOR.HUMAN, "0:1": ACTOR.ROBOT, "9:9": ACTOR.ROBOT },
    notes: { "0:0": [ACTOR.ROBOT], "0:1": [ACTOR.HUMAN] },
  });
  equal(positionToJSON(normalized), { actors: { "0:0": ACTOR.HUMAN }, notes: {} });
  equal(pointFromKey("00:00"), null, "coordinates must have one canonical spelling");
  equal(applyMove(puzzle, clearCell, { type: "cycle-actor", key: "00:00" }).reason, "not-a-floor");
  equal(
    positionToJSON(normalizePosition(puzzle, {
      actors: { "0:0": ACTOR.HUMAN, "00:00": ACTOR.ROBOT },
    })),
    { actors: { "0:0": ACTOR.HUMAN }, notes: {} },
  );
});

test("求解上限 0 会立即停止，非法上限不会悄悄退化为完整枚举", () => {
  const ambiguous = fixture([".."], {
    targets: { human: 1, hologram: 0, robot: 1 },
    clues: { top: [1, 1], right: [2], bottom: [1, 1], left: [2] },
  });
  equal(countSolutions(ambiguous, 2), 2);
  equal(countSolutions(ambiguous, 0), 0);
  equal(solvePuzzle(ambiguous, { limit: Infinity }).length, 2);
  throws(() => countSolutions(ambiguous, -1), /non-negative integer/);
  throws(() => countSolutions(ambiguous, 1.5), /non-negative integer/);
});

test("打开规则或胜利模态时，所有游戏快捷键都与背后棋局隔离", () => {
  for (const key of ["z", "c", "p", "1", "2", "3", "?"]) {
    equal(shouldHandleGlobalShortcut({
      dialogOpen: true,
      targetIsStageCell: false,
      key,
      ctrlKey: key === "z",
      metaKey: false,
    }), false, `rules dialog must block ${key}`);
  }

  equal(shouldHandleGlobalShortcut({
    dialogOpen: true,
    targetIsStageCell: false,
    key: "z",
    metaKey: true,
  }), false, "victory dialog keeps undo blocked until the player chooses an action");
  equal(shouldHandleGlobalShortcut({
    dialogOpen: false,
    targetIsStageCell: true,
    key: "z",
    ctrlKey: true,
  }), true, "undo still works while a stage cell owns focus");
  equal(shouldHandleGlobalShortcut({
    dialogOpen: false,
    targetIsStageCell: true,
    key: "c",
  }), false, "stage-cell shortcuts remain owned by the cell handler");
  equal(shouldHandleGlobalShortcut({
    dialogOpen: false,
    targetIsStageCell: false,
    key: "p",
  }), true, "global shortcuts remain available outside a modal");
});

test("难度按钮重建后仅为键盘或辅助技术激活恢复焦点", () => {
  equal(shouldRestoreDifficultyFocus({
    clickDetail: 0,
    buttonHadFocus: true,
  }), true, "a focused keyboard or assistive-technology activation should retain focus");
  equal(shouldRestoreDifficultyFocus({
    clickDetail: 1,
    buttonHadFocus: true,
  }), false, "mouse or touch clicks must not trigger programmatic focus");
  equal(shouldRestoreDifficultyFocus({
    clickDetail: 2,
    buttonHadFocus: true,
  }), false, "repeated pointer clicks must not trigger programmatic focus");
  equal(shouldRestoreDifficultyFocus({
    clickDetail: 0,
    buttonHadFocus: false,
  }), false, "an unfocused programmatic click must not steal focus");
  equal(shouldRestoreDifficultyFocus(), false, "missing event context must fail closed");
});

test("三类演员在演员表、工具栏与谢幕画面统一使用角色肖像结构", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  for (const actor of ["human", "hologram", "robot"]) {
    const portrait = new RegExp(
      `<span class="actor-mark actor-mark--${actor}"(?: aria-hidden="true")?><i><\\/i><\\/span>`,
      "g",
    );
    ok(
      (html.match(portrait) ?? []).length >= 3,
      `${actor} portrait should be reused across the theatre UI`,
    );
    ok(css.includes(`.actor-mark--${actor}::before`), `${actor} should define a head layer`);
    ok(css.includes(`.actor-mark--${actor} i`), `${actor} should define a body layer`);
    ok(css.includes(`.actor-mark--${actor}::after`), `${actor} should define a signature detail layer`);
  }

  ok(css.includes("repeating-linear-gradient"), "hologram portrait should retain scan-line texture");
  ok(css.includes("radial-gradient(circle at 6px 6px"), "robot portrait should retain two illuminated eyes");
});

test("六张内置题的完整答案同时满足全局数与全部边缘线索，且各自唯一解", () => {
  equal(LEVELS.length, 6);
  equal(LEVELS.map((level) => level.id), [
    "velvet-foyer",
    "prism-entrance",
    "mirror-score",
    "mirror-chorus",
    "grand-curtain",
    "ninefold-applause",
  ]);
  equal(
    LEVELS.reduce((counts, level) => {
      counts[level.difficulty] = (counts[level.difficulty] ?? 0) + 1;
      return counts;
    }, {}),
    { preview: 2, rehearsal: 2, premiere: 2 },
  );

  for (const level of LEVELS) {
    const expected = solutionPosition(level);
    const result = evaluatePosition(level, expected);
    equal(result.complete, true, `${level.id} stored answer must win`);
    equal(result.filledCount, level.floorCount, `${level.id} must fill every floor`);
    equal(result.emptyKeys.size, 0, `${level.id} must leave no empty cell`);
    equal(result.actorCounts, level.targets, `${level.id} actor totals must match`);
    equal(result.totalsExact, true, `${level.id} totals must all be exact`);
    equal(result.edgesExact, true, `${level.id} edge clues must all be exact`);
    equal(result.exactEdges, 2 * (level.width + level.height));
    equal(result.errors, 0, `${level.id} stored answer must have no errors`);
    equal(
      [...result.edgeResults.values()].every((edge) => (
        edge.visible === edge.clue && edge.exact && !edge.loop
      )),
      true,
      `${level.id} every edge must use its traced visible count`,
    );
    equal(actorsToSolutionRows(level, expected), level.solution);

    const solutions = solvePuzzle(level, { limit: 2 });
    equal(solutions.length, 1, `${level.id} must have exactly one solution`);
    equal(countSolutions(level, 2), 1, `${level.id} uniqueness must survive the public counter`);
    equal(actorsToSolutionRows(level, solutions[0]), level.solution);
  }
});

let passed = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    process.stdout.write(`✓ 镜影大剧院 · ${name}\n`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

process.stdout.write(
  `Mirror Theatre logic: ${passed} tests, ${assertions} assertions passed.\n`,
);
