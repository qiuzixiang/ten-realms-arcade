import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSIGNED_STATES,
  POLARITY,
  SLOT_STATE,
  applyMove,
  cellAt,
  countSolutions,
  createPuzzle,
  evaluatePosition,
  normalizePosition,
  pointFromKey,
  polarityForState,
  positionToJSON,
  slotForCell,
  solutionPosition,
  solvePuzzle,
  statesToSolutionCode,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  LEVEL_SPECS,
  findPuzzle,
  nextPuzzle,
  puzzleAt,
  puzzleFingerprint,
  puzzlesForDifficulty,
} from "./levels.mjs";
import {
  HISTORY_LIMIT,
  STORAGE_KEYS,
  STORAGE_PREFIX,
  createSession,
  loadPreferences,
  loadSession,
  loadTutorialSeen,
  markTutorialSeen,
  normalizeSession,
  savePreferences,
  saveSession,
} from "./persistence.mjs";
import {
  COMPLETION_EVENT,
  DIFFICULTY_TIER,
  GAME_ID,
  READY_EVENT,
  awardCompletion,
  completionDetail,
  createProfile,
  loadProfile,
  normalizeProfile,
  profileSummary,
  saveProfile,
} from "./rewards.mjs";
import { createDialogController, nextFocusIndex } from "./dialog-controller.mjs";
import { completionDeliveryConfirmed, publishCompletion } from "./completion-bridge.mjs";
import {
  cellAriaLabel,
  clueId,
  cloneHistorySnapshot,
  formatElapsed,
  moveForTool,
  nextCellKey,
  shouldHandleGlobalShortcut,
} from "./ui-helpers.mjs";

const directory = fileURLToPath(new URL(".", import.meta.url));
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
  assert.deepStrictEqual(actual, expected, message);
}

function throws(callback, expected, message) {
  assertions += 1;
  assert.throws(callback, expected, message);
}

function blankClues(width, height, value = null) {
  return {
    rows: { plus: Array(height).fill(value), minus: Array(height).fill(value) },
    columns: { plus: Array(width).fill(value), minus: Array(width).fill(value) },
  };
}

function fixture(layout, options = {}) {
  const definition = {
    id: options.id ?? "fixture",
    layout,
    solution: options.solution,
    clueMask: options.clueMask,
  };
  if (Object.hasOwn(options, "clues")) definition.clues = options.clues;
  return createPuzzle(definition);
}

class FakeStorage {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
    this.accesses = [];
  }

  getItem(key) {
    this.accesses.push(["get", key]);
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.accesses.push(["set", key]);
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.accesses.push(["remove", key]);
    this.map.delete(key);
  }
}

class ThrowingStorage {
  getItem() { throw new Error("denied"); }
  setItem() { throw new Error("denied"); }
  removeItem() { throw new Error("denied"); }
}

test("三种完成状态在双格两端展开为精确的 +−、−+ 与中性", () => {
  equal(ASSIGNED_STATES, [SLOT_STATE.FORWARD, SLOT_STATE.REVERSE, SLOT_STATE.NEUTRAL]);
  equal(polarityForState(SLOT_STATE.FORWARD, 0), POLARITY.PLUS);
  equal(polarityForState(SLOT_STATE.FORWARD, 1), POLARITY.MINUS);
  equal(polarityForState(SLOT_STATE.REVERSE, 0), POLARITY.MINUS);
  equal(polarityForState(SLOT_STATE.REVERSE, 1), POLARITY.PLUS);
  equal(polarityForState(SLOT_STATE.NEUTRAL, 0), POLARITY.NEUTRAL);
  equal(polarityForState(SLOT_STATE.NEUTRAL, 1), POLARITY.NEUTRAL);
  equal(polarityForState(SLOT_STATE.EMPTY, 0), null);
  throws(() => polarityForState("charged", 0), /Unknown slot state/);
  throws(() => polarityForState(SLOT_STATE.FORWARD, 2), /must be 0 or 1/);
});

test("矩形题盘由不重叠的正交双格槽位完整覆盖", () => {
  const puzzle = fixture(["AABB", "CCDD"], { clues: blankClues(4, 2) });
  equal(puzzle.width, 4);
  equal(puzzle.height, 2);
  equal(puzzle.slots.length, 4);
  equal(puzzle.holes.length, 0);
  equal(puzzle.slots.map((slot) => [slot.id, slot.orientation, slot.cells.map((cell) => cell.key)]), [
    ["A", "horizontal", ["0:0", "0:1"]],
    ["B", "horizontal", ["0:2", "0:3"]],
    ["C", "horizontal", ["1:0", "1:1"]],
    ["D", "horizontal", ["1:2", "1:3"]],
  ]);
  equal(slotForCell(puzzle, "0:1").id, "A");
  equal(cellAt(puzzle, 0, 1).end, 1);
  equal(cellAt(puzzle, -1, 0), null);
});

test("奇数题盘恰保留一个不可操作且永久中性的固定空位", () => {
  const puzzle = fixture(["AA*"], { clues: blankClues(3, 1) });
  equal(puzzle.holes.map((hole) => hole.key), ["0:2"]);
  equal(cellAt(puzzle, 0, 2).type, "void");
  equal(slotForCell(puzzle, "0:2"), null);
  const evaluation = evaluatePosition(puzzle, { states: { A: SLOT_STATE.NEUTRAL } });
  equal(evaluation.polarities.get("0:2"), POLARITY.NEUTRAL);
  equal(evaluation.complete, true);
  equal(applyMove(puzzle, {}, { type: "cycle-primary", key: "0:2" }).reason, "not-a-slot");
});

test("非法布局拒绝漏格、额外空位、非矩形、非正交或非双格标签", () => {
  throws(() => createPuzzle({ layout: [] }), /non-empty/);
  throws(() => fixture(["AA", "B"]), /share one non-zero width/);
  throws(() => fixture(["A_"]), /slot labels/);
  throws(() => createPuzzle({ layout: ["AA*"], clues: blankClues(2, 1) }), /Column \+ clues must contain 3/);
  throws(() => fixture(["AA**"]), /requires exactly 0/);
  throws(() => fixture(["AB", "BA"]), /orthogonally adjacent/);
  throws(() => fixture(["AABB", "CCCD"]), /must occupy exactly two/);
  throws(() => fixture(["AABB", "CCDE"]), /must occupy exactly two/);
});

test("声明答案长度、代码与规则都经过生成器防御校验", () => {
  throws(() => createPuzzle({ id: "short", layout: ["AA"], solution: "" }), /one F\/R\/N code/);
  throws(() => createPuzzle({ id: "bad-code", layout: ["AA"], solution: "X" }), /only F, R, or N/);
  throws(() => createPuzzle({
    id: "bad-answer",
    layout: ["AA", "BB"],
    solution: "FF",
  }), /does not satisfy/);
});

test("四周线索从合法答案生成，顶部/底部与左侧/右侧的极性映射不混淆", () => {
  const puzzle = fixture(["AA", "BB"], { solution: "FR" });
  equal(puzzle.clues.columns.plus, [1, 1], "top: column plus");
  equal(puzzle.clues.columns.minus, [1, 1], "bottom: column minus");
  equal(puzzle.clues.rows.plus, [1, 1], "left: row plus");
  equal(puzzle.clues.rows.minus, [1, 1], "right: row minus");
  const solved = evaluatePosition(puzzle, solutionPosition(puzzle));
  equal(solved.counts, {
    rows: { plus: [1, 1], minus: [1, 1] },
    columns: { plus: [1, 1], minus: [1, 1] },
  });
  equal(solved.complete, true);
});

test("缺失线索与数字 0 严格区分，缺失项不施加隐式中性约束", () => {
  const clues = blankClues(2, 1);
  clues.rows.plus[0] = null;
  clues.rows.minus[0] = 0;
  clues.columns.plus = [0, null];
  clues.columns.minus = [null, 0];
  const puzzle = fixture(["AA"], { clues });
  const forward = evaluatePosition(puzzle, { states: { A: SLOT_STATE.FORWARD } });
  equal(forward.clueResults.rows.plus[0].given, false);
  equal(forward.clueResults.rows.plus[0].target, null);
  equal(forward.clueResults.rows.plus[0].over, false);
  equal(forward.clueResults.rows.minus[0].given, true);
  equal(forward.clueResults.rows.minus[0].target, 0);
  equal(forward.clueResults.rows.minus[0].over, true);
  equal(forward.complete, false);
});

test("部分盘面报告超量与无法补足，但无错误绝不等同胜利", () => {
  const clues = blankClues(2, 1);
  clues.rows.plus[0] = 2;
  const impossible = fixture(["AA"], { clues });
  const empty = evaluatePosition(impossible);
  equal(empty.clueResults.rows.plus[0].count, 0);
  equal(empty.clueResults.rows.plus[0].remaining, 1);
  equal(empty.clueResults.rows.plus[0].maximum, 1);
  equal(empty.clueResults.rows.plus[0].impossible, true);
  equal(empty.complete, false);

  const solvable = fixture(["AA"], { solution: "F" });
  const partial = evaluatePosition(solvable);
  equal(partial.conflictPairs.length, 0);
  equal(partial.overClueCount, 0);
  equal(partial.allAssigned, false);
  equal(partial.complete, false);
});

test("同性正交相邻冲突，异性、对角同极与中性相邻均合法", () => {
  const horizontal = fixture(["AA", "BB"], { clues: blankClues(2, 2) });
  const same = evaluatePosition(horizontal, { states: { A: SLOT_STATE.FORWARD, B: SLOT_STATE.FORWARD } });
  equal(same.conflictPairs.map((pair) => [pair.polarity, pair.keys]), [
    [POLARITY.PLUS, ["0:0", "1:0"]],
    [POLARITY.MINUS, ["0:1", "1:1"]],
  ]);
  equal(same.conflictKeys, new Set(["0:0", "1:0", "0:1", "1:1"]));

  const vertical = fixture(["AB", "AB"], { clues: blankClues(2, 2) });
  const diagonal = evaluatePosition(vertical, { states: { A: SLOT_STATE.FORWARD, B: SLOT_STATE.REVERSE } });
  equal(diagonal.conflictPairs.length, 0, "equal poles appear only diagonally");
  const neutral = evaluatePosition(horizontal, { states: { A: SLOT_STATE.NEUTRAL, B: SLOT_STATE.FORWARD } });
  equal(neutral.conflictPairs.length, 0);
});

test("候选问号不填槽、不计极性、不影响冲突、求解或胜利", () => {
  const puzzle = fixture(["AA"], { solution: "F" });
  const noted = evaluatePosition(puzzle, { notes: ["A"], markedClues: ["rows:plus:0"] });
  equal(noted.notes, new Set(["A"]));
  equal(noted.assignedCount, 0);
  equal(noted.counts.rows.plus, [0]);
  equal(noted.counts.rows.minus, [0]);
  equal(noted.conflictPairs.length, 0);
  equal(noted.complete, false);
  equal(solvePuzzle(puzzle, { limit: 2, position: { notes: ["A"] } }).unique, true);

  const solvedWithIgnoredNote = evaluatePosition(puzzle, { states: { A: SLOT_STATE.FORWARD }, notes: ["A"] });
  equal(solvedWithIgnoredNote.notes.size, 0);
  equal(solvedWithIgnoredNote.complete, true);
});

test("主操作严格按被点端循环 +、−、清空，并拒绝直接覆盖中性", () => {
  const puzzle = fixture(["AA"], { clues: blankClues(2, 1) });
  const original = { states: new Map(), notes: new Set() };
  const plusHere = applyMove(puzzle, original, { type: "cycle-primary", key: "0:0" });
  equal(plusHere.accepted, true);
  equal(plusHere.states.get("A"), SLOT_STATE.FORWARD);
  equal(original.states.size, 0, "move must not mutate input");
  const minusHere = applyMove(puzzle, plusHere, { type: "cycle-primary", key: "0:0" });
  equal(minusHere.states.get("A"), SLOT_STATE.REVERSE);
  const cleared = applyMove(puzzle, minusHere, { type: "cycle-primary", key: "0:0" });
  equal(cleared.states.size, 0);
  const plusAtSecond = applyMove(puzzle, cleared, { type: "cycle-primary", key: "0:1" });
  equal(plusAtSecond.states.get("A"), SLOT_STATE.REVERSE);
  const neutral = applyMove(puzzle, {}, { type: "set-state", key: "0:0", state: SLOT_STATE.NEUTRAL });
  equal(applyMove(puzzle, neutral, { type: "cycle-primary", key: "0:0" }).reason, "neutral-locked");
});

test("中性操作严格循环未填、中性、两问号、未填，并拒绝磁铁", () => {
  const puzzle = fixture(["AA"], { clues: blankClues(2, 1) });
  const neutral = applyMove(puzzle, {}, { type: "cycle-secondary", key: "0:0" });
  equal(neutral.effect, "secondary-neutral");
  equal(neutral.states.get("A"), SLOT_STATE.NEUTRAL);
  const note = applyMove(puzzle, neutral, { type: "cycle-secondary", key: "0:1" });
  equal(note.effect, "secondary-note");
  equal(note.states.size, 0);
  equal(note.notes, new Set(["A"]));
  const clear = applyMove(puzzle, note, { type: "cycle-secondary", key: "0:0" });
  equal(clear.effect, "secondary-clear");
  equal(clear.notes.size, 0);
  const magnet = applyMove(puzzle, {}, { type: "cycle-primary", key: "0:0" });
  equal(applyMove(puzzle, magnet, { type: "cycle-secondary", key: "0:0" }).reason, "magnet-locked");
});

test("直接工具、候选与清空 API 严格校验槽位且保持不可变", () => {
  const puzzle = fixture(["AA*"], { clues: blankClues(3, 1) });
  const noted = applyMove(puzzle, {}, { type: "toggle-note", slotId: "A" });
  equal(noted.notes, new Set(["A"]));
  const assigned = applyMove(puzzle, noted, { type: "set-state", slotId: "A", state: SLOT_STATE.REVERSE });
  equal(assigned.states.get("A"), SLOT_STATE.REVERSE);
  equal(assigned.notes.size, 0);
  equal(applyMove(puzzle, assigned, { type: "toggle-note", slotId: "A" }).reason, "occupied");
  const cleared = applyMove(puzzle, assigned, { type: "clear-slot", slotId: "A" });
  equal(positionToJSON(cleared), { states: {}, notes: [] });
  equal(applyMove(puzzle, cleared, { type: "clear-slot", slotId: "A" }).reason, "unchanged");
  equal(applyMove(puzzle, {}, { type: "set-state", slotId: "A", state: "charged" }).reason, "unknown-state");
  equal(applyMove(puzzle, {}, { type: "teleport", slotId: "A" }).reason, "unknown-move");
  equal(applyMove(puzzle, {}, { type: "cycle-primary", slotId: "Z" }).reason, "not-a-slot");
});

test("位置归一化拒绝未知槽、非法状态、占用槽候选与非规范坐标", () => {
  const puzzle = fixture(["AA*"], { clues: blankClues(3, 1) });
  const normalized = normalizePosition(puzzle, {
    states: { A: SLOT_STATE.FORWARD, Z: SLOT_STATE.REVERSE, "0:0": SLOT_STATE.NEUTRAL },
    notes: ["A", "Z"],
  });
  equal(positionToJSON(normalized), { states: { A: SLOT_STATE.FORWARD }, notes: [] });
  equal(pointFromKey("0:0"), { row: 0, column: 0 });
  equal(pointFromKey("00:00"), null);
  equal(pointFromKey("-1:0"), null);
});

test("完整搜索区分唯一、无解、多解和搜索截断，不把 limit=1 冒充唯一", () => {
  const unique = fixture(["AA"], { solution: "F" });
  const uniqueResult = solvePuzzle(unique, { limit: 2 });
  equal(uniqueResult.count, 1);
  equal(uniqueResult.unique, true);
  equal(uniqueResult.truncated, false);
  equal(statesToSolutionCode(unique, uniqueResult.solutions[0]), "F");

  const ambiguous = fixture(["AA"], { clues: blankClues(2, 1) });
  const all = solvePuzzle(ambiguous, { limit: Infinity });
  equal(all.count, 3);
  equal(all.truncated, false);
  equal(all.unique, false);
  equal(new Set(all.solutions.map((solution) => statesToSolutionCode(ambiguous, solution))), new Set(["F", "R", "N"]));
  const truncated = solvePuzzle(ambiguous, { limit: 1 });
  equal(truncated.count, 1);
  equal(truncated.truncated, true);
  equal(truncated.unique, false);
  equal(solvePuzzle(ambiguous, { limit: 0 }), { solutions: [], count: 0, truncated: true, unique: false });
  throws(() => solvePuzzle(ambiguous, { limit: -1 }), /non-negative integer/);
  throws(() => solvePuzzle(ambiguous, { limit: 1.5 }), /non-negative integer/);

  const impossibleClues = blankClues(2, 1);
  impossibleClues.rows.plus[0] = 2;
  const unsatisfiable = fixture(["AA"], { clues: impossibleClues });
  equal(countSolutions(unsatisfiable, 2), 0);
});

test("求解器遵守固定正式状态、忽略候选，并且绝不读取声明答案", () => {
  const puzzle = fixture(["AA"], { solution: "F" });
  equal(solvePuzzle(puzzle, {
    limit: 2,
    position: { states: { A: SLOT_STATE.REVERSE } },
  }).count, 0);
  equal(solvePuzzle(puzzle, {
    limit: 2,
    position: { notes: ["A"] },
  }).unique, true);
  const guarded = new Proxy(puzzle, {
    get(target, property, receiver) {
      if (property === "solution") throw new Error("solver read the stored answer");
      return Reflect.get(target, property, receiver);
    },
  });
  equal(solvePuzzle(guarded, { limit: 2 }).unique, true);
});

test("六个稳定 seed 题面覆盖三档，并由完整求解器逐题证明唯一", () => {
  equal(DIFFICULTIES.map((item) => item.id), ["calibration", "survey", "storm"]);
  equal(LEVELS.length, 6);
  equal(LEVEL_SPECS.length, 6);
  equal(LEVELS.map((level) => level.id), [
    "ice-window", "polar-crossing", "ion-ribbon", "green-arc", "red-crown-storm", "silent-eye-storm",
  ]);
  equal(Object.fromEntries(DIFFICULTIES.map((item) => [item.id, puzzlesForDifficulty(item.id).length])), {
    calibration: 2, survey: 2, storm: 2,
  });

  for (const level of LEVELS) {
    const stored = solutionPosition(level);
    const evaluation = evaluatePosition(level, stored);
    equal(evaluation.complete, true, `${level.id} stored legal answer must win`);
    equal(evaluation.assignedCount, level.slots.length);
    equal(evaluation.conflictPairs.length, 0);
    equal(evaluation.cluesSatisfied, true);
    const solved = solvePuzzle(level, { limit: 2 });
    equal(solved.count, 1, `${level.id} must have exactly one solution`);
    equal(solved.truncated, false, `${level.id} uniqueness search must finish`);
    equal(solved.unique, true, `${level.id} may declare unique only after full search`);
    equal(statesToSolutionCode(level, solved.solutions[0]), statesToSolutionCode(level, stored));
    ok(level.seed.startsWith(`aurora-magnet-lab/${level.difficulty}/`));
  }
});

test("三档题面线索稀疏度与规模递进，且奇数磁暴题保留固定空位", () => {
  const given = (puzzle) => [
    ...puzzle.clues.rows.plus,
    ...puzzle.clues.rows.minus,
    ...puzzle.clues.columns.plus,
    ...puzzle.clues.columns.minus,
  ].filter((value) => value !== null).length;
  equal(puzzlesForDifficulty("calibration").map(given), [16, 16]);
  equal(puzzlesForDifficulty("survey").map(given), [12, 12]);
  equal(puzzlesForDifficulty("storm").map(given), [8, 8]);
  equal(puzzlesForDifficulty("calibration").map((puzzle) => puzzle.slots.length), [8, 8]);
  equal(puzzlesForDifficulty("survey").map((puzzle) => puzzle.slots.length), [10, 10]);
  equal(puzzlesForDifficulty("storm").map((puzzle) => puzzle.slots.length), [15, 12]);
  equal(findPuzzle("silent-eye-storm").holes.length, 1);
  equal(findPuzzle("silent-eye-storm").holes[0].key, "2:2");
});

test("难度选题、换题与题面指纹完全可复现", () => {
  equal(puzzleAt("calibration", 0).id, "ice-window");
  equal(puzzleAt("calibration", 1).id, "polar-crossing");
  equal(puzzleAt("calibration", 2).id, "ice-window");
  equal(puzzleAt("calibration", -1).id, "polar-crossing");
  equal(nextPuzzle(findPuzzle("ice-window")).id, "polar-crossing");
  equal(nextPuzzle(findPuzzle("polar-crossing")).id, "ice-window");
  equal(puzzleAt("unknown", 0), null);
  equal(puzzleFingerprint(findPuzzle("ion-ribbon")), puzzleFingerprint(findPuzzle("ion-ribbon")));
  ok(puzzleFingerprint(findPuzzle("ion-ribbon")) !== puzzleFingerprint(findPuzzle("green-arc")));
});

test("存档键全部位于 2.0 游戏私有前缀，绝不接触 1.0 键", () => {
  equal(STORAGE_PREFIX, "ten-realms-v2:games:aurora-magnet-lab:");
  equal(Object.values(STORAGE_KEYS), [
    `${STORAGE_PREFIX}session:v1`,
    `${STORAGE_PREFIX}profile:v1`,
    `${STORAGE_PREFIX}preferences:v1`,
    `${STORAGE_PREFIX}tutorial:v2`,
  ]);
  equal(Object.values(STORAGE_KEYS).every((key) => key.startsWith(STORAGE_PREFIX)), true);
});

test("活动盘面、历史、候选和线索笔记严格往返存档", () => {
  const puzzle = findPuzzle("ice-window");
  const storage = new FakeStorage();
  const session = createSession(puzzle, { now: 1000 });
  session.position = { states: { A: SLOT_STATE.NEUTRAL }, notes: ["B"] };
  session.moves = 2;
  session.conflictMoves = 0;
  session.undos = 1;
  session.elapsedMs = 8200;
  session.history = [{ position: { states: {}, notes: [] }, moves: 0, conflictMoves: 0 }];
  session.markedClues = [clueId("rows", "plus", 0)];
  equal(saveSession(storage, puzzle, session), true);
  const loaded = loadSession(storage, LEVELS, LEVELS[0], { now: 9999 });
  equal(loaded.restored, true);
  equal(loaded.puzzle.id, puzzle.id);
  equal(loaded.session.position, session.position);
  equal(loaded.session.moves, 2);
  equal(loaded.session.undos, 1);
  equal(loaded.session.elapsedMs, 8200);
  equal(loaded.session.history, session.history);
  equal(loaded.session.markedClues, session.markedClues);
  equal(loaded.session.completed, false);
  equal(storage.accesses.every(([, key]) => key.startsWith(STORAGE_PREFIX)), true);
});

test("恢复时重新计算完成状态，不信任伪造布尔值，并保留已上报胜利", () => {
  const puzzle = findPuzzle("polar-crossing");
  const partial = createSession(puzzle, { now: 1000 });
  partial.moves = 1;
  partial.completed = true;
  partial.completionReported = true;
  const normalizedPartial = normalizeSession(puzzle, partial);
  equal(normalizedPartial.completed, false);
  equal(normalizedPartial.completionReported, false);

  const solved = createSession(puzzle, { now: 1000 });
  solved.position = positionToJSON(solutionPosition(puzzle));
  solved.moves = 12;
  solved.completed = false;
  solved.completionReported = true;
  const normalizedSolved = normalizeSession(puzzle, solved);
  equal(normalizedSolved.completed, true);
  equal(normalizedSolved.completionReported, true);

  solved.moves = 0;
  equal(normalizeSession(puzzle, solved), null, "a fabricated zero-move completion is corrupt");
});

test("损坏 JSON、未知题目、非法状态与过长历史只清理本游戏会话并安全回退", () => {
  const fallback = LEVELS[0];
  for (const raw of [
    "{broken",
    JSON.stringify({ version: 1, puzzleId: "unknown", difficulty: "storm" }),
    JSON.stringify({
      ...createSession(fallback, { now: 1 }),
      position: { states: { A: "charged" }, notes: [] },
    }),
    JSON.stringify({
      ...createSession(fallback, { now: 1 }),
      history: Array.from({ length: HISTORY_LIMIT + 1 }, () => ({ position: { states: {}, notes: [] }, moves: 0, conflictMoves: 0 })),
    }),
  ]) {
    const storage = new FakeStorage({ [STORAGE_KEYS.session]: raw });
    const loaded = loadSession(storage, LEVELS, fallback, { now: 55 });
    equal(loaded.restored, false);
    equal(loaded.corrupted, true);
    equal(loaded.session.puzzleId, fallback.id);
    equal(storage.map.has(STORAGE_KEYS.session), false);
    equal(storage.accesses.every(([, key]) => key.startsWith(STORAGE_PREFIX)), true);
  }
});

test("不可用 storage 不抛错，偏好与首次教程也严格使用私有键", () => {
  const denied = new ThrowingStorage();
  const loaded = loadSession(denied, LEVELS, LEVELS[0], { now: 5 });
  equal(loaded.available, false);
  equal(loaded.restored, false);
  equal(saveSession(denied, LEVELS[0], loaded.session), false);

  const storage = new FakeStorage();
  equal(loadPreferences(storage, DIFFICULTIES.map((item) => item.id)).preferences.tool, "polarity");
  equal(savePreferences(storage, { version: 1, muted: true, tool: "note", difficulty: "storm" }, DIFFICULTIES.map((item) => item.id)), true);
  equal(loadPreferences(storage, DIFFICULTIES.map((item) => item.id)).preferences, {
    version: 1, muted: true, tool: "note", difficulty: "storm",
  });
  equal(loadTutorialSeen(storage).seen, false);
  equal(markTutorialSeen(storage), true);
  equal(loadTutorialSeen(storage).seen, true);
  equal(JSON.parse(storage.map.get(STORAGE_KEYS.tutorial)), { version: 2, seen: true });
  const legacyTutorial = new FakeStorage({
    [`${STORAGE_PREFIX}tutorial:v1`]: JSON.stringify({ version: 1, seen: true }),
  });
  equal(loadTutorialSeen(legacyTutorial).seen, false, "旧教程记录必须让新版教程再自动出现一次");
  equal(legacyTutorial.map.has(`${STORAGE_PREFIX}tutorial:v1`), true, "升级教程不得清理其他既有记录");
  equal(storage.accesses.every(([, key]) => key.startsWith(STORAGE_PREFIX)), true);
});

test("光谱、首次完成、零冲突与最佳操作使用稳定奖励 ID 去重", () => {
  const puzzle = findPuzzle("ice-window");
  const first = awardCompletion(createProfile(), puzzle, { moves: 13, conflictMoves: 0 }, { now: 1000 });
  equal(first.rewards.map((reward) => reward.kind).sort(), ["clear", "personal-best", "spectrum", "zero-conflict"]);
  equal(first.firstClear, true);
  equal(first.personalBest, true);
  equal(first.profile.totalClears, 1);
  equal(Object.keys(first.profile.rewardLedger).every((id) => id.startsWith(`${GAME_ID}:`)), true);

  const duplicate = awardCompletion(first.profile, puzzle, { moves: 13, conflictMoves: 0 }, { now: 2000 });
  equal(duplicate.rewards, []);
  equal(duplicate.firstClear, false);
  equal(duplicate.personalBest, false);
  equal(duplicate.clearOrdinal, 2);
  equal(duplicate.profile.totalClears, 2);

  const improved = awardCompletion(duplicate.profile, puzzle, { moves: 10, conflictMoves: 0 }, { now: 3000 });
  equal(improved.rewards.map((reward) => reward.kind), ["personal-best"]);
  equal(improved.rewards[0].id, `${GAME_ID}:best:${puzzle.id}:10`);
  equal(improved.bestMoves, 10);
});

test("同一实验结算跨刷新幂等，共享上报可重试但不重复累计通关", () => {
  const puzzle = findPuzzle("ice-window");
  const attemptId = `${GAME_ID}:attempt:${puzzle.id}:424242`;
  const metrics = { moves: 13, undos: 1, conflictMoves: 0, elapsedMs: 5000 };
  const first = awardCompletion(createProfile(), puzzle, metrics, { now: 1000, attemptId });
  const firstDetail = completionDetail(puzzle, metrics, first);
  equal(first.duplicate, false);
  equal(first.profile.totalClears, 1);
  equal(first.profile.records[puzzle.id].clears, 1);
  equal(first.profile.settlements[attemptId].clearOrdinal, 1);

  const storage = new FakeStorage();
  equal(saveProfile(storage, first.profile, LEVELS), true);
  const restored = loadProfile(storage, LEVELS);
  equal(restored.restored, true);
  const retried = awardCompletion(restored.profile, puzzle, metrics, { now: 9000, attemptId });
  const retriedDetail = completionDetail(puzzle, metrics, retried);
  equal(retried.duplicate, true);
  equal(retried.profile, first.profile);
  equal(retried.profile.totalClears, 1);
  equal(retried.profile.records[puzzle.id].clears, 1);
  equal(retriedDetail, firstDetail, "retry keeps one stable eventId and completion payload");
  throws(
    () => awardCompletion(retried.profile, puzzle, { ...metrics, moves: 14 }, { attemptId }),
    /different puzzle metrics/,
  );
});

test("宿主完成回调失败时入队且去重，所有兼容通道失败也不抛错", () => {
  const puzzle = findPuzzle("ion-ribbon");
  const award = awardCompletion(createProfile(), puzzle, { moves: 20, conflictMoves: 0 }, { now: 1000 });
  const detail = completionDetail(puzzle, { moves: 20, conflictMoves: 0 }, award);
  class FakeCustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  const events = [];
  const host = {
    RealmArcade: { complete() { throw new Error("host unavailable"); } },
    dispatchEvent(event) { events.push(event); return true; },
  };
  const first = publishCompletion(host, detail, COMPLETION_EVENT, { CustomEvent: FakeCustomEvent });
  const second = publishCompletion(host, detail, COMPLETION_EVENT, { CustomEvent: FakeCustomEvent });
  equal(first.compatibilityReported, true);
  equal(first.eventDispatched, true);
  equal(host.__realmCompletionQueue.length, 1);
  equal(host.__realmCompletionQueue[0].eventId, detail.eventId);
  equal(second.compatibilityReported, true);
  equal(host.__realmCompletionQueue.length, 1, "retry must not duplicate the pending payload");
  equal(events.map((event) => event.type), [COMPLETION_EVENT, COMPLETION_EVENT]);

  const sealedHost = Object.preventExtensions({
    RealmArcade: { complete() { throw new Error("host unavailable"); } },
    dispatchEvent() { return true; },
  });
  const failed = publishCompletion(sealedHost, detail, COMPLETION_EVENT, { CustomEvent: FakeCustomEvent });
  equal(failed.compatibilityReported, false);
  equal(failed.eventDispatched, true);
  equal(completionDeliveryConfirmed(true, first), true);
  equal(completionDeliveryConfirmed(false, first), false, "a delivered event cannot confirm an unpersisted settlement");
  equal(completionDeliveryConfirmed(true, failed), false, "a persisted settlement remains pending until delivery works");
});

test("稀有磁暴和有冲突完成记录分别产生正确、可去重的长期档案", () => {
  const regular = findPuzzle("polar-crossing");
  const conflicted = awardCompletion(createProfile(), regular, { moves: 16, conflictMoves: 2 }, { now: 1000 });
  equal(conflicted.zeroConflict, false);
  equal(conflicted.rewards.map((reward) => reward.kind).sort(), ["clear", "personal-best", "spectrum"]);
  equal(conflicted.profile.records[regular.id].zeroConflict, false);

  const storm = findPuzzle("red-crown-storm");
  const captured = awardCompletion(conflicted.profile, storm, { moves: 27, conflictMoves: 0 }, { now: 2000 });
  equal(captured.rewards.map((reward) => reward.kind).sort(), [
    "clear", "personal-best", "rare-storm", "spectrum", "zero-conflict",
  ]);
  equal(captured.profile.records[storm.id].stormCaptured, true);
  equal(captured.profile.rewardLedger[`${GAME_ID}:rare-storm:${storm.id}`].kind, "rare-storm");
  const summary = profileSummary(captured.profile, LEVELS);
  equal(summary.spectrumUnlocked, 2);
  equal(summary.zeroConflictExperiments, 1);
  equal(summary.stormsCaptured, 1);
});

test("档案严格往返，损坏档案安全回退且总通关数必须自洽", () => {
  const storage = new FakeStorage();
  const awarded = awardCompletion(createProfile(), LEVELS[0], { moves: 12, conflictMoves: 0 }, { now: 1000 });
  equal(saveProfile(storage, awarded.profile, LEVELS), true);
  const restored = loadProfile(storage, LEVELS);
  equal(restored.restored, true);
  equal(restored.profile, awarded.profile);
  const legacy = JSON.parse(JSON.stringify(awarded.profile));
  delete legacy.settlements;
  const migratedLegacy = normalizeProfile(legacy, LEVELS);
  ok(migratedLegacy, "pre-settlement profile:v1 documents migrate without losing progress");
  equal(migratedLegacy.totalClears, awarded.profile.totalClears);
  equal(Object.keys(migratedLegacy.settlements).length, awarded.profile.totalClears);
  const forged = { ...awarded.profile, totalClears: 99 };
  equal(normalizeProfile(forged, LEVELS), null);
  storage.map.set(STORAGE_KEYS.profile, JSON.stringify(forged));
  const fallback = loadProfile(storage, LEVELS);
  equal(fallback.corrupted, true);
  equal(fallback.profile, createProfile());
  equal(storage.map.has(STORAGE_KEYS.profile), false);
});

test("完成载荷包含 v2 标准事件、兼容字段与 JSON 可序列化去重信息", () => {
  const puzzle = LEVELS[0];
  const award = awardCompletion(createProfile(), puzzle, { moves: 11, conflictMoves: 0 }, { now: 1000 });
  const detail = completionDetail(puzzle, {
    moves: 11, undos: 2, conflictMoves: 0, elapsedMs: 65432,
  }, award);
  equal(COMPLETION_EVENT, "ten-realms-v2:game-complete");
  equal(READY_EVENT, "ten-realms-v2:game-ready");
  equal(detail.gameId, GAME_ID);
  equal(detail.levelId, puzzle.id);
  equal(DIFFICULTY_TIER, { calibration: 1, survey: 2, storm: 3 });
  equal(detail.tier, 1);
  for (const [difficulty, expectedTier] of [["calibration", 1], ["survey", 2], ["storm", 3]]) {
    const tierPuzzle = puzzlesForDifficulty(difficulty)[0];
    const tierAward = awardCompletion(createProfile(), tierPuzzle, {
      moves: tierPuzzle.suggestedMoves,
      conflictMoves: 0,
    }, { now: 1000 + expectedTier });
    const tierDetail = completionDetail(tierPuzzle, {
      moves: tierPuzzle.suggestedMoves,
      conflictMoves: 0,
    }, tierAward);
    equal(tierDetail.tier, expectedTier, `${difficulty} completion tier`);
  }
  equal(detail.difficulty, puzzle.difficulty);
  equal(detail.moves, 11);
  equal(detail.par, puzzle.suggestedMoves);
  equal(detail.puzzle.seed, puzzle.seed);
  equal(detail.metrics, {
    moves: 11,
    par: puzzle.suggestedMoves,
    undos: 2,
    conflictMoves: 0,
    elapsedMs: 65432,
    zeroConflict: true,
    rareStorm: false,
    bestMoves: 11,
    previousBestMoves: null,
  });
  ok(detail.eventId.startsWith(`${GAME_ID}:completion:${puzzle.id}:1:`));
  equal(new Set(detail.rewards.map((reward) => reward.id)).size, detail.rewards.length);
  equal(JSON.parse(JSON.stringify(detail)), detail);
});

test("UI 辅助函数提供触控工具、空间导航、三重极性朗读与快捷键隔离", () => {
  const puzzle = findPuzzle("silent-eye-storm");
  equal(moveForTool("polarity", "0:0"), { type: "cycle-primary", key: "0:0" });
  equal(moveForTool("neutral", "0:0", SLOT_STATE.EMPTY), { type: "set-state", key: "0:0", state: SLOT_STATE.NEUTRAL });
  equal(moveForTool("neutral", "0:0", SLOT_STATE.NEUTRAL), { type: "set-state", key: "0:0", state: SLOT_STATE.EMPTY });
  equal(moveForTool("note", "0:0"), { type: "toggle-note", key: "0:0" });
  equal(moveForTool("erase", "0:0"), { type: "clear-slot", key: "0:0" });
  equal(moveForTool("unknown", "0:0"), null);
  equal(nextCellKey(puzzle, "2:1", "ArrowRight"), "2:3", "arrow navigation skips the fixed void");
  equal(nextCellKey(puzzle, "0:0", "ArrowLeft"), "0:0");
  const evaluation = evaluatePosition(puzzle, { states: { A: SLOT_STATE.FORWARD } });
  const label = cellAriaLabel(puzzle, "0:0", evaluation);
  ok(label.includes("正极"));
  ok(label.includes("加号"));
  ok(label.includes("横向槽位"));
  equal(formatElapsed(65432), "01:05");
  equal(clueId("columns", "minus", 2), "columns:minus:2");
  equal(shouldHandleGlobalShortcut({ dialogOpen: true, key: "r" }), false);
  equal(shouldHandleGlobalShortcut({ dialogOpen: false, targetTag: "input", key: "r" }), false);
  equal(shouldHandleGlobalShortcut({ dialogOpen: false, targetIsBoardCell: true, key: "r" }), false);
  equal(shouldHandleGlobalShortcut({ dialogOpen: false, key: "z", ctrlKey: true }), true);
});

test("历史快照深拷贝位置，避免撤销记录被后续写入污染", () => {
  const session = createSession(LEVELS[0], { now: 0 });
  session.position = { states: { A: SLOT_STATE.FORWARD }, notes: ["B"] };
  session.moves = 3;
  session.conflictMoves = 1;
  const snapshot = cloneHistorySnapshot(session);
  session.position.states.A = SLOT_STATE.REVERSE;
  session.position.notes.push("C");
  equal(snapshot, {
    position: { states: { A: SLOT_STATE.FORWARD }, notes: ["B"] },
    moves: 3,
    conflictMoves: 1,
  });
});

function fakeKeyEvent(key, options = {}) {
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperties(event, {
    key: { value: key },
    shiftKey: { value: Boolean(options.shiftKey) },
  });
  return event;
}

test("模态控制器圈闭 Tab、处理 Escape/cancel，并在关闭后恢复焦点", () => {
  const ownerDocument = { activeElement: null, defaultView: null };
  const outside = {
    isConnected: true,
    ownerDocument,
    focus() { ownerDocument.activeElement = this; },
    closest() { return null; },
    getAttribute() { return null; },
  };
  class FakeDialog extends EventTarget {
    constructor() {
      super();
      this.open = false;
      this.ownerDocument = ownerDocument;
      this.returnValue = "";
      this.items = [];
      this.nodeName = "DIALOG";
      this.tabIndex = -1;
    }
    showModal() { this.open = true; }
    close(value = "") { this.open = false; this.returnValue = value; this.dispatchEvent(new Event("close")); }
    contains(element) { return element === this || this.items.includes(element); }
    focus() { ownerDocument.activeElement = this; }
    getAttribute() { return null; }
    closest() { return null; }
    getBoundingClientRect() { return { left: 10, top: 10, right: 100, bottom: 100, width: 90, height: 90 }; }
  }
  const dialog = new FakeDialog();
  const makeItem = (name) => ({
    name,
    tabIndex: 0,
    isConnected: true,
    ownerDocument,
    focus() { ownerDocument.activeElement = this; },
    closest(selector) { return selector === "dialog" ? dialog : null; },
    getAttribute() { return null; },
  });
  const first = makeItem("first");
  const last = makeItem("last");
  dialog.items = [first, last];
  ownerDocument.activeElement = outside;
  const reasons = [];
  const controller = createDialogController({
    dialog,
    initialFocus: first,
    getFocusableElements: () => dialog.items,
    getActiveElement: () => ownerDocument.activeElement,
    onClose: ({ reason }) => reasons.push(reason),
  });
  equal(controller.show(), true);
  equal(dialog.open, true);
  equal(ownerDocument.activeElement, first);
  ownerDocument.activeElement = last;
  const tab = fakeKeyEvent("Tab");
  dialog.dispatchEvent(tab);
  equal(tab.defaultPrevented, true);
  equal(ownerDocument.activeElement, first);
  const backwards = fakeKeyEvent("Tab", { shiftKey: true });
  dialog.dispatchEvent(backwards);
  equal(backwards.defaultPrevented, true);
  equal(ownerDocument.activeElement, last);
  const escape = fakeKeyEvent("Escape");
  dialog.dispatchEvent(escape);
  equal(escape.defaultPrevented, true);
  equal(dialog.open, false);
  equal(ownerDocument.activeElement, outside);
  equal(reasons, ["escape"]);
  equal(controller.close(), false, "double close is idempotent");
  equal(controller.destroy(), true);
});

test("焦点索引包装在空集合、正向与反向边界都确定", () => {
  equal(nextFocusIndex(0, 0), -1);
  equal(nextFocusIndex(-1, 3), 0);
  equal(nextFocusIndex(-1, 3, true), 2);
  equal(nextFocusIndex(0, 3, true), 2);
  equal(nextFocusIndex(2, 3, false), 0);
  equal(nextFocusIndex(1, 3, false), 2);
});

test("独立 HTML、CSS、应用接线与三张真实 SVG 教程满足静态契约", async () => {
  const tutorialFiles = ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"];
  const [html, css, app, logic, persistence, rewards, completionBridge, rules, ...svgs] = await Promise.all([
    readFile(path.join(directory, "index.html"), "utf8"),
    readFile(path.join(directory, "styles.css"), "utf8"),
    readFile(path.join(directory, "app.mjs"), "utf8"),
    readFile(path.join(directory, "logic.mjs"), "utf8"),
    readFile(path.join(directory, "persistence.mjs"), "utf8"),
    readFile(path.join(directory, "rewards.mjs"), "utf8"),
    readFile(path.join(directory, "completion-bridge.mjs"), "utf8"),
    readFile(path.join(directory, "RULES.md"), "utf8"),
    ...tutorialFiles.map((file) => (
      readFile(path.join(directory, "assets", file), "utf8")
    )),
  ]);
  equal((html.match(/<dialog\b/g) ?? []).length, 3);
  ok(html.includes('<main>'));
  ok(html.includes('role="grid"'));
  ok(html.includes('role="toolbar"'));
  ok(html.includes('aria-live="polite"'));
  ok(html.includes('aria-live="assertive"'));
  ok(html.includes('href="../../"'));
  for (const [id, label] of [
    ["new-puzzle-button", "换题"],
    ["undo-button", "撤销"],
    ["restart-button", "重开"],
    ["mute-button", "声音"],
    ["tutorial-button", "教程"],
    ["rules-button", "规则"],
  ]) {
    ok(new RegExp(`id="${id}"[^>]*aria-label="${label}"`).test(html), `${id} keeps its name when compact text is hidden`);
  }
  ok(html.includes("+ 正"));
  ok(html.includes("− 负"));
  ok(html.includes("青色圆形"));
  ok(html.includes("洋红菱形"));
  ok(html.includes("琥珀六边形"));
  ok(html.includes(`./assets/${tutorialFiles[0]}?tutorial=2`), "HTML must provide the versioned first tutorial image fallback");
  ok(/<script\s+type="module"\s+src="\.\/app\.mjs"><\/script>/.test(html), "game entry script must remain canonical");
  equal(
    [...app.matchAll(/image:\s*"\.\/assets\/(tutorial-[^"?]+\.svg)\?tutorial=2"/g)].map((match) => match[1]),
    tutorialFiles,
    "the app must wire all three tutorial cards in order",
  );
  ok(app.includes("elements.tutorialImage.src = card.image"));
  equal(new Set(svgs).size, 3, "tutorial images must be independent files");
  for (const svg of svgs) {
    ok(svg.includes('preserveAspectRatio="xMidYMid meet"'));
    ok(svg.includes('role="img"'));
    ok(/aria-label="[^"]+"/.test(svg));
    ok(svg.includes("+ 正"));
    ok(svg.includes("− 负"));
  }
  equal(svgs.every((svg) => svg.includes('data-level-id="ice-window"')), true, "三张卡必须取自同一正式关卡");
  ok(svgs[0].includes('data-tutorial-scene="elements"') && svgs[0].includes('data-state="initial"'));
  ok(svgs[1].includes('data-tutorial-scene="operation"') && svgs[1].includes('data-state="intermediate"'));
  ok(svgs[1].includes('data-position="A=N,E=R,G=F"'), "操作卡必须是一张真实可到达的中间局面");
  ok(svgs[2].includes('data-tutorial-scene="goal"') && svgs[2].includes('data-state="solved"'));
  ok(svgs[2].includes('data-solution="NNNNRNFF"'), "通关卡必须使用冰窗校极的作者解");
  ok(svgs.every((svg) => !/(?:before-state|after-state|state-before|state-after|scene-before|scene-after)/i.test(svg)));
  const svgAttribute = (source, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(source)?.[1] ?? null;
  const tutorialPuzzle = findPuzzle("ice-window");
  const authoredPosition = solutionPosition(tutorialPuzzle);
  equal(statesToSolutionCode(tutorialPuzzle, authoredPosition), svgAttribute(svgs[2], "data-solution"));
  equal(evaluatePosition(tutorialPuzzle, authoredPosition).complete, true, "教程完成图必须通过真实 Magnets 判定器");
  equal(svgAttribute(svgs[2], "data-column-plus"), tutorialPuzzle.clues.columns.plus.join(","));
  equal(svgAttribute(svgs[2], "data-column-minus"), tutorialPuzzle.clues.columns.minus.join(","));
  equal(svgAttribute(svgs[2], "data-row-plus"), tutorialPuzzle.clues.rows.plus.join(","));
  equal(svgAttribute(svgs[2], "data-row-minus"), tutorialPuzzle.clues.rows.minus.join(","));
  const operationPosition = {
    states: { A: SLOT_STATE.NEUTRAL, E: SLOT_STATE.REVERSE, G: SLOT_STATE.FORWARD },
    notes: [],
  };
  const operationEvaluation = evaluatePosition(tutorialPuzzle, operationPosition);
  equal(svgAttribute(svgs[1], "data-position"), "A=N,E=R,G=F");
  equal(operationEvaluation.assignedCount, 3);
  equal(operationEvaluation.conflictPairs.length, 0, "教程操作中间态必须是可真实到达的无冲突局面");
  equal(operationEvaluation.complete, false);
  equal(operationEvaluation.clueResults.rows.plus[2].atTarget, true);
  equal(operationEvaluation.clueResults.rows.plus[2].remaining, 1);
  equal(operationEvaluation.clueResults.rows.plus[2].exact, false, "F 槽未明确时第三行正极线索不得显示完成勾选");
  equal(operationEvaluation.clueResults.rows.minus[2].exact, false, "F 槽未明确时第三行负极线索不得显示完成勾选");
  ok(!svgs[1].includes("+1✓") && !svgs[1].includes("−1✓"));
  ok(svgs[1].includes("F 槽仍待明确"));

  ok(/button\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/.test(css));
  ok(/html\s*\{[^}]*min-width:\s*0;/s.test(css));
  ok(/body\s*\{[^}]*min-width:\s*0;/s.test(css));
  ok(css.includes("@media (max-width: 390px)"));
  ok(css.includes("@media (prefers-reduced-motion: reduce)"));
  const landscapeQuery = "@media (max-height: 500px) and (orientation: landscape)";
  const landscapeStart = css.indexOf(landscapeQuery);
  ok(landscapeStart >= 0, "compact landscape must have a dedicated tutorial layout");
  const nextMedia = css.indexOf("\n@media", landscapeStart + landscapeQuery.length);
  const landscapeCss = css.slice(landscapeStart, nextMedia < 0 ? undefined : nextMedia);
  ok(/\.tutorial-shell\s*\{[^}]*height:\s*calc\(100dvh - 12px\);[^}]*max-height:\s*calc\(100dvh - 12px\);/s.test(landscapeCss));
  ok(/\.tutorial-card\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.05fr\)\s+minmax\(250px, 0\.95fr\);/s.test(landscapeCss));
  ok(/\.tutorial-visual img\s*\{[^}]*max-height:\s*none;[^}]*object-fit:\s*contain;/s.test(landscapeCss));
  ok(/\.tutorial-footer\s*\{[^}]*min-height:\s*52px;/s.test(landscapeCss));
  ok(css.includes("overflow-x: clip"));
  ok(css.includes(".completion-aurora"));
  ok(css.includes("pointer-events: none"));
  ok(css.includes(".pole--plus"));
  ok(css.includes(".pole--minus"));
  ok(css.includes(".pole--neutral"));
  ok(css.includes(".conflict-mark"));
  ok(css.includes("safe-area-inset-left"));
  ok(css.includes("safe-area-inset-bottom"));
  ok(html.includes('id="tutorial-announcement" aria-live="polite" aria-atomic="true"'));
  ok(app.includes("elements.tutorialAnnouncement.textContent"));

  ok(app.includes("LONG_PRESS_MS"));
  ok(app.includes('addEventListener("contextmenu"'));
  ok(app.includes('addEventListener("keydown"'));
  ok(app.includes("window.AuroraMagnetLab"));
  ok(app.includes('from "./completion-bridge.mjs"'));
  ok(app.includes("publishCompletion(window, detail, COMPLETION_EVENT)"));
  ok(app.includes("const latestProfileLoad = loadProfile(storage, LEVELS)"));
  ok(app.includes("completionDeliveryConfirmed(profileSaved, delivery)"));
  ok(completionBridge.includes("target?.RealmArcade?.complete"));
  ok(completionBridge.includes("target.__realmCompletionQueue"));
  ok(app.includes("completionReported"));
  ok(completionBridge.includes("new CustomEventConstructor(eventName"));
  ok(app.includes("createOscillator"));
  ok(logic.includes("no DOM, storage, audio, timer, or random"));
  ok(rules.includes("count === 1 && truncated === false && unique === true"));

  const allSource = [html, css, app, logic, persistence, rewards, completionBridge, rules].join("\n");
  ok(!allSource.includes("ten-realms:progress:v1"));
  ok(!allSource.includes("ten-realms:tutorial:"));
  ok(html.includes('data-realm="aurora-magnet-lab"'));
  ok(html.includes('../../shared/realm-ui.css'));
  ok(html.includes('../../shared/realm-ui.mjs'));
  ok(html.indexOf('../../shared/realm-ui.mjs') < html.indexOf('./app.mjs'));
  ok(!/from\s+["']https?:\/\//.test(allSource));
  ok(!/<script\b[^>]*src=["']https?:\/\//i.test(html));
  ok(allSource.includes("ten-realms-v2:games:aurora-magnet-lab:"));
});

let passed = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    process.stdout.write(`✓ 极光磁场实验室 · ${name}\n`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

process.stdout.write(`Aurora Magnet Lab: ${passed} tests, ${assertions} assertions passed.\n`);
