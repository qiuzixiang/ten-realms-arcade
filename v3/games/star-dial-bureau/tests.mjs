import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  BOARD_SIZE,
  SOLVED_BOARD,
  applyStateMove,
  boardKey,
  evaluateBoard,
  inverseMove,
  inverseSequence,
  isBoard,
  replayMoves,
  rotateBoard,
  sameBoard,
  stateForLevel,
  undoState,
  validateLevel,
  zoneCells,
} from "./logic.mjs";
import { DEFAULT_LEVEL_ID, DIFFICULTIES, LEVELS, findLevel, firstLevel, levelsForDifficulty, nextLevel } from "./levels.mjs";
import {
  GAME_ID,
  STORAGE_KEYS,
  STORAGE_PREFIX,
  createProfile,
  createRunId,
  enqueueOutbox,
  loadOutbox,
  loadProfile,
  loadSession,
  markTutorialSeen,
  removeFromOutbox,
  saveProfile,
  saveSession,
  tutorialSeen,
} from "./storage.mjs";
import {
  COMPLETION_SCHEMA,
  completionFromSettledEvent,
  deliverCompletion,
  normalizeCompletion,
  settleCompletion,
  validCompletion,
} from "./completion.mjs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.mjs", import.meta.url), "utf8");
const completionSource = readFileSync(new URL("./completion.mjs", import.meta.url), "utf8");
const rules = readFileSync(new URL("./RULES.md", import.meta.url), "utf8");
const tutorial = Object.fromEntries(["elements", "action", "goal"].map((name) => [name, readFileSync(new URL(`./assets/tutorial-${name}.svg`, import.meta.url), "utf8")]));

const tests = [];
let assertions = 0;
const test = (name, callback) => tests.push({ name, callback });
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const strictEqual = (actual, expected, message) => { assertions += 1; assert.strictEqual(actual, expected, message); };
const ok = (actual, message) => { assertions += 1; assert.ok(actual, message); };
const match = (actual, expected, message) => { assertions += 1; assert.match(actual, expected, message); };
const doesNotMatch = (actual, expected, message) => { assertions += 1; assert.doesNotMatch(actual, expected, message); };
const throws = (callback, expected, message) => { assertions += 1; assert.throws(callback, expected, message); };

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.removed = []; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.removed.push(key); this.values.delete(key); }
}

function attr(source, name) {
  return new RegExp(`${name}="([^"]*)"`).exec(source)?.[1] ?? null;
}

function boardFromAttribute(source, name = "data-board") {
  return attr(source, name)?.split(",").map(Number) ?? null;
}

function ringValues(source, panel = null) {
  const pattern = panel
    ? new RegExp(`<g data-role="star-ring" data-panel="${panel}" data-cell-index="(\\d+)" data-tile-value="(\\d+)"`, "g")
    : /<g data-role="star-ring" data-cell-index="(\d+)"(?: data-row="\d+" data-column="\d+")? data-tile-value="(\d+)"/g;
  const values = [];
  for (const found of source.matchAll(pattern)) values[Number(found[1])] = Number(found[2]);
  return values;
}

function solvedState(level) {
  let state = stateForLevel(level);
  for (const move of level.referenceSolution) state = applyStateMove(level, state, move).state;
  return state;
}

test("4×4 星盘从一到十六构成唯一排列", () => {
  strictEqual(BOARD_SIZE, 4);
  ok(isBoard(SOLVED_BOARD));
  equal(SOLVED_BOARD, Array.from({ length: 16 }, (_, index) => index + 1));
  strictEqual(evaluateBoard(SOLVED_BOARD).complete, true);
  strictEqual(isBoard([1, 1, ...SOLVED_BOARD.slice(2)]), false);
});

test("Twiddle 顺时针的四格位置映射精确且不改其它格", () => {
  const initial = [...SOLVED_BOARD];
  const result = rotateBoard(initial, { row: 0, column: 0, direction: "cw" });
  ok(result.changed);
  equal(result.board, [5, 1, 3, 4, 6, 2, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  equal(initial, SOLVED_BOARD, "纯函数不能原地改写输入");
  equal(zoneCells(0, 0), [0, 1, 4, 5]);
});

test("逆时针严格是顺时针的逆动作", () => {
  const cw = { row: 1, column: 2, direction: "cw" };
  const back = inverseMove(cw);
  equal(back, { row: 1, column: 2, direction: "ccw" });
  const rotated = rotateBoard(SOLVED_BOARD, cw).board;
  equal(rotateBoard(rotated, back).board, SOLVED_BOARD);
  equal(inverseSequence([cw, { row: 0, column: 0, direction: "ccw" }]), [
    { row: 0, column: 0, direction: "cw" },
    { row: 1, column: 2, direction: "ccw" },
  ]);
});

test("非法窗口、方向和损坏棋盘均为 no-op", () => {
  const invalids = [
    { row: -1, column: 0, direction: "cw" },
    { row: 3, column: 0, direction: "cw" },
    { row: 0, column: 3, direction: "ccw" },
    { row: 0, column: 0, direction: "spin" },
  ];
  for (const move of invalids) {
    const result = rotateBoard(SOLVED_BOARD, move);
    strictEqual(result.changed, false);
    equal(result.board, SOLVED_BOARD);
  }
  strictEqual(rotateBoard([1, 1], { row: 0, column: 0, direction: "cw" }).board, null);
  equal(zoneCells(3, 0), []);
});

test("六个固定星历均从列出的扰动产生并能反向完成", () => {
  strictEqual(LEVELS.length, 6);
  strictEqual(DIFFICULTIES.length, 3);
  const seenBoards = new Set();
  for (const level of LEVELS) {
    ok(validateLevel(level), `${level.id} 规则合同有效`);
    const scrambled = replayMoves(SOLVED_BOARD, level.scramble);
    equal(scrambled.board, level.initialBoard, `${level.id} 初始盘必须来自列出的扰动`);
    strictEqual(evaluateBoard(level.initialBoard).complete, false);
    const replay = replayMoves(level.initialBoard, level.referenceSolution);
    strictEqual(evaluateBoard(replay.board).complete, true, `${level.id} 参考回放必须完成`);
    strictEqual(level.par, level.referenceSolution.length);
    seenBoards.add(boardKey(level.initialBoard));
  }
  strictEqual(seenBoards.size, LEVELS.length, "固定题面不能意外重复");
  strictEqual(findLevel(DEFAULT_LEVEL_ID), LEVELS[0]);
  strictEqual(firstLevel("hard").difficulty, "hard");
  strictEqual(levelsForDifficulty("medium").length, 2);
  strictEqual(nextLevel(LEVELS.at(-1).id), LEVELS[0]);
});

test("状态历史可复放，完成后禁止再旋转，撤销可恢复未完成态", () => {
  const level = findLevel("orion-offset");
  let state = stateForLevel(level);
  const before = state;
  for (const move of level.referenceSolution) {
    const result = applyStateMove(level, state, move);
    ok(result.changed);
    state = result.state;
  }
  strictEqual(state.complete, true);
  const afterFinish = applyStateMove(level, state, { row: 0, column: 0, direction: "cw" });
  strictEqual(afterFinish.changed, false);
  equal(afterFinish.state.board, state.board);
  const undone = undoState(level, state);
  strictEqual(undone.changed, true);
  strictEqual(undone.state.complete, false);
  strictEqual(undone.state.moves, level.par - 1);
  strictEqual(before.moves, 0);
});

test("存档只保存本游戏键、重放历史并拒绝篡改", () => {
  const level = findLevel("lyra-shear");
  const storage = new MemoryStorage({ "other-game:keep": "yes" });
  const profile = createProfile(level.id);
  ok(saveProfile(storage, profile, findLevel, DEFAULT_LEVEL_ID));
  const loadedProfile = loadProfile(storage, findLevel, DEFAULT_LEVEL_ID);
  strictEqual(loadedProfile.profile.preferences.levelId, level.id);
  const forgedRewardProfile = {
    ...profile,
    completedLevelIds: [level.id],
    bestMovesByLevel: { [level.id]: 1 },
    rewardLedger: [{ id: `${GAME_ID}:clear:not-a-level`, kind: "clear", label: "forged", levelId: level.id, awardedAt: new Date().toISOString() }],
  };
  strictEqual(saveProfile(storage, forgedRewardProfile, findLevel, DEFAULT_LEVEL_ID), false, "伪造 reward claim 不能写入档案");
  let state = stateForLevel(level);
  state = applyStateMove(level, state, level.referenceSolution[0]).state;
  const runId = createRunId(123456, "storeproof");
  ok(saveSession(storage, { level, runId, state, elapsedMs: 3456 }));
  const restored = loadSession(storage, findLevel);
  equal(restored.session.state.board, state.board);
  storage.setItem(STORAGE_KEYS.session, JSON.stringify({ version: 1, gameId: GAME_ID, levelId: level.id, runId, history: [{ row: 9, column: 0, direction: "cw" }], elapsedMs: 0, savedAt: new Date().toISOString() }));
  strictEqual(loadSession(storage, findLevel).session, null);
  strictEqual(storage.getItem("other-game:keep"), "yes");
  ok(storage.removed.every((key) => key.startsWith(STORAGE_PREFIX)));
  for (const key of Object.values(STORAGE_KEYS)) ok(key.startsWith(STORAGE_PREFIX));
  strictEqual(tutorialSeen(storage), false);
  ok(markTutorialSeen(storage));
  strictEqual(tutorialSeen(storage), true);
});

test("完成 payload 由真实完成历史证明，局部账本和宿主递送均幂等", () => {
  const level = findLevel("orion-offset");
  const state = solvedState(level);
  const runId = createRunId(987654321, "completionproof");
  const initial = createProfile(level.id);
  const first = settleCompletion({ profile: initial, level, state, runId, elapsedMs: 18_000, completedAt: "2026-09-02T08:00:00.000Z" });
  ok(first.detail);
  strictEqual(first.detail.eventId, `${GAME_ID}:${runId}:complete`);
  strictEqual(first.detail.completionId, first.detail.eventId);
  strictEqual(first.detail.schema, COMPLETION_SCHEMA);
  strictEqual(validCompletion(first.detail), true);
  strictEqual(first.profile.settledEvents[first.detail.eventId].moves, level.par);
  const duplicate = settleCompletion({ profile: first.profile, level, state, runId, elapsedMs: 18_000, completedAt: "2026-09-02T08:00:00.000Z" });
  strictEqual(duplicate.alreadySettled, true);
  strictEqual(duplicate.claims.length, 0);
  equal(duplicate.detail, first.detail, "重试必须恢复相同的稳定完成证明");
  const storage = new MemoryStorage();
  strictEqual(enqueueOutbox(storage, first.detail, normalizeCompletion).saved, true);
  strictEqual(loadOutbox(storage, normalizeCompletion).entries.length, 1);
  const deliveries = [];
  const host = { TenRealmsV3: { complete(payload) { deliveries.push(payload.eventId); } } };
  strictEqual(deliverCompletion(host, first.detail).confirmed, true);
  strictEqual(deliverCompletion(host, first.detail).duplicate, true);
  equal(deliveries, [first.detail.eventId]);
  strictEqual(removeFromOutbox(storage, first.detail.eventId, normalizeCompletion), true);
  strictEqual(loadOutbox(storage, normalizeCompletion).entries.length, 0);
  const restored = completionFromSettledEvent(first.profile, first.detail.eventId);
  equal(restored, first.detail);
  const forged = { ...first.detail, history: first.detail.history.slice(1) };
  strictEqual(normalizeCompletion(forged), null);
  throws(() => settleCompletion({ profile: initial, level, state: { ...state, board: SOLVED_BOARD.map((value, index) => index ? value : 16) }, runId, elapsedMs: 1 }), /canonical solved state/);
});

test("三张教程图都绑定同一真实关卡、动作和完成态", () => {
  const level = findLevel("orion-offset");
  for (const source of Object.values(tutorial)) {
    match(source, /<svg[^>]+viewBox="0 0 640 420"[^>]+role="img"/);
    match(source, /data-game="star-dial-bureau"/);
    strictEqual(attr(source, "data-tutorial-level"), level.id);
  }
  const initial = boardFromAttribute(tutorial.elements);
  equal(initial, level.initialBoard);
  equal(ringValues(tutorial.elements), initial);
  strictEqual(attr(tutorial.elements, "data-state"), "initial");
  const actionBefore = boardFromAttribute(tutorial.action, "data-before-board");
  const actionAfter = boardFromAttribute(tutorial.action, "data-after-board");
  equal(actionBefore, level.initialBoard);
  equal(ringValues(tutorial.action, "before"), actionBefore);
  const action = { row: Number(attr(tutorial.action, "data-action-row")), column: Number(attr(tutorial.action, "data-action-column")), direction: attr(tutorial.action, "data-action-direction") };
  equal(rotateBoard(actionBefore, action).board, actionAfter);
  equal(ringValues(tutorial.action, "after"), actionAfter);
  strictEqual(evaluateBoard(actionAfter).complete, false);
  const goal = boardFromAttribute(tutorial.goal);
  equal(goal, replayMoves(level.initialBoard, level.referenceSolution).board);
  equal(ringValues(tutorial.goal), goal);
  strictEqual(evaluateBoard(goal).complete, true);
  strictEqual(attr(tutorial.goal, "data-player-moves"), String(level.par));
});

test("教程 SVG 可通过 XML 语法校验（若宿主提供 xmllint）", () => {
  for (const name of ["elements", "action", "goal"]) {
    try {
      execFileSync("xmllint", ["--noout", new URL(`./assets/tutorial-${name}.svg`, import.meta.url).pathname], { stdio: "pipe" });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      // CI image may omit xmllint; structural and truth assertions above still run.
    }
    ok(!tutorial[name].includes("<script"));
  }
});

test("入口保留 V3 共享装载、原生教程、触屏命中和版本隔离合同", () => {
  match(html, /<html lang="zh-CN" data-realm="star-dial-bureau">/);
  match(html, /href="\.\.\/\.\.\/"/);
  match(html, /\.\.\/\.\.\/shared\/realm-ui\.css/);
  ok(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"));
  match(html, /id="tutorial-button"/);
  match(html, /tutorial-elements\.svg\?tutorial=3/);
  match(html, /id="ccw-button"/);
  match(html, /id="cw-button"/);
  match(css, /\.zone-button[^}]*width: 44px[^}]*height: 44px/s);
  match(css, /object-fit: contain/);
  match(completionSource, /target\.TenRealmsV3 \?\? target\.RealmArcade/);
  match(app, /TUTORIAL_LEVEL_ID = "orion-offset"/);
  match(app, /direction: "ccw"/);
  doesNotMatch(app, /ten-realms-v2:/);
  doesNotMatch(app, /localStorage\.clear/);
  match(rules, /5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/);
  match(rules, /doc-zh\/twiddle\.html/);
  match(rules, /vendor\/sgtpuzzles\/twiddle\.c/);
  match(rules, /src\/games\/twiddle\.ts/);
  match(rules, /MIT License/);
  match(rules, /star-dial-bureau:&lt;runId&gt;:complete|star-dial-bureau:<runId>:complete/);
});

for (const { name, callback } of tests) {
  try { callback(); console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

console.log(`\n${tests.length} tests · ${assertions} assertions · star-dial-bureau passed`);
