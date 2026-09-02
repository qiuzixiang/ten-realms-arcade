import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  CELL,
  applyStateMove,
  blackCount,
  createState,
  evaluateBoard,
  neighbourhood,
  referenceBoard,
  referenceState,
  replayMoves,
  sameBoard,
  stateForLevel,
  undoState,
  validateLevel,
} from "./logic.mjs";
import { DEFAULT_LEVEL_ID, DIFFICULTIES, LEVELS, TUTORIAL_ACTION, TUTORIAL_LEVEL_ID, findLevel, firstLevel, levelsForDifficulty, nextLevel } from "./levels.mjs";
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
  queueCompletion,
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
  return new RegExp(`\\b${name}="([^"]*)"`).exec(source)?.[1] ?? null;
}

function attrFrom(tag, name) {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function boardFromAttribute(source, name = "data-board") {
  return attr(source, name)?.split(",").map(Number) ?? null;
}

function tutorialCells(source, panel = null) {
  const tags = source.match(/<g\b[^>]*data-role="mosaic-cell"[^>]*>/g) ?? [];
  const values = [];
  const clues = [];
  for (const tag of tags) {
    if ((attrFrom(tag, "data-panel") ?? null) !== panel) continue;
    const index = Number(attrFrom(tag, "data-cell-index"));
    values[index] = Number(attrFrom(tag, "data-value"));
    clues[index] = Number(attrFrom(tag, "data-clue"));
  }
  return { values, clues };
}

function solvedState(level) {
  return referenceState(level);
}

test("Mosaic 邻域包含自身，角落和中央都会按边界裁切", () => {
  const level = findLevel(TUTORIAL_LEVEL_ID);
  equal(neighbourhood(level, 0), [0, 1, 4, 5]);
  equal(neighbourhood(level, 5), [0, 1, 2, 4, 5, 6, 8, 9, 10]);
  strictEqual(neighbourhood(level, -1).length, 0);
  const reference = referenceBoard(level);
  strictEqual(blackCount(level, reference, 5), 5);
  strictEqual(blackCount(level, reference, 0), 3);
});

test("左、右三态循环和显式清除严格保留 Mosaic 输入语义", () => {
  const level = findLevel(TUTORIAL_LEVEL_ID);
  let state = createState(level);
  const apply = (tool) => { const result = applyStateMove(level, state, { index: 0, tool }); ok(result.changed); state = result.state; };
  apply("black"); strictEqual(state.board[0], CELL.BLACK);
  apply("black"); strictEqual(state.board[0], CELL.WHITE);
  apply("black"); strictEqual(state.board[0], CELL.EMPTY);
  apply("white"); strictEqual(state.board[0], CELL.WHITE);
  apply("white"); strictEqual(state.board[0], CELL.BLACK);
  apply("white"); strictEqual(state.board[0], CELL.EMPTY);
  const noClear = applyStateMove(level, state, { index: 0, tool: "clear" });
  strictEqual(noClear.changed, false);
  const invalidIndex = applyStateMove(level, state, { index: -1, tool: "black" });
  strictEqual(invalidIndex.changed, false);
  const invalidTool = applyStateMove(level, state, { index: 0, tool: "violet" });
  strictEqual(invalidTool.changed, false);
  strictEqual(state.moves, 6, "only changed moves enter history");
});

test("未定格、矛盾线索与完成边界彼此分离", () => {
  const level = findLevel(TUTORIAL_LEVEL_ID);
  const partial = replayMoves(level, level.referenceSolution.slice(0, -1));
  const partialEval = evaluateBoard(level, partial.board);
  strictEqual(partialEval.allExplicit, false);
  strictEqual(partialEval.complete, false);
  const impossibleBoard = Array(level.width * level.height).fill(CELL.WHITE);
  for (const index of neighbourhood(level, 0)) impossibleBoard[index] = CELL.BLACK;
  const impossible = evaluateBoard(level, impossibleBoard).clues.find((clue) => clue.index === 0);
  strictEqual(impossible.impossible, true);
  strictEqual(impossible.exact, false);
  const complete = solvedState(level);
  strictEqual(evaluateBoard(level, complete.board).complete, true);
  strictEqual(evaluateBoard(level, complete.board).allExplicit, true);
  strictEqual(evaluateBoard(level, complete.board).allSatisfied, true);
  strictEqual(evaluateBoard(level, [3, ...complete.board.slice(1)]).valid, false);
});

test("五个固定壁画均能重算线索、完成且不误称唯一", () => {
  strictEqual(LEVELS.length, 5);
  strictEqual(DIFFICULTIES.length, 3);
  const seen = new Set();
  for (const level of LEVELS) {
    ok(validateLevel(level), `${level.id} 规则合同有效`);
    const reference = referenceBoard(level);
    const solved = solvedState(level);
    strictEqual(solved.complete, true, `${level.id} 参考回放应完成`);
    strictEqual(solved.moves, level.par);
    strictEqual(level.par, level.width * level.height);
    strictEqual(evaluateBoard(level, reference).complete, true);
    for (const clue of evaluateBoard(level, reference).clues) strictEqual(clue.black, clue.target, `${level.id} 线索 ${clue.index}`);
    seen.add(`${level.width}x${level.height}:${reference.join("")}`);
  }
  strictEqual(seen.size, LEVELS.length);
  strictEqual(findLevel(DEFAULT_LEVEL_ID), LEVELS[0]);
  strictEqual(firstLevel("hard").difficulty, "hard");
  strictEqual(levelsForDifficulty("medium").length, 2);
  strictEqual(nextLevel(LEVELS.at(-1).id), LEVELS[0]);
});

test("历史完整重放；完成后操作无效，撤回会恢复未完成态", () => {
  const level = findLevel(TUTORIAL_LEVEL_ID);
  const complete = solvedState(level);
  const afterFinish = applyStateMove(level, complete, { index: 0, tool: "black" });
  strictEqual(afterFinish.changed, false);
  equal(afterFinish.state.board, complete.board);
  strictEqual(replayMoves(level, [...level.referenceSolution, level.referenceSolution[0]]), null);
  const undone = undoState(level, complete);
  strictEqual(undone.changed, true);
  strictEqual(undone.state.complete, false);
  strictEqual(undone.state.moves, level.par - 1);
  const replayed = stateForLevel(level, complete.history);
  equal(replayed.board, complete.board);
});

test("存档只写本游戏命名空间、恢复时重放并拒绝篡改历史", () => {
  const level = findLevel("moon-river");
  const storage = new MemoryStorage({ "other-game:keep": "yes" });
  const profile = createProfile(level.id);
  ok(saveProfile(storage, profile, findLevel, DEFAULT_LEVEL_ID));
  strictEqual(loadProfile(storage, findLevel, DEFAULT_LEVEL_ID).profile.preferences.levelId, level.id);
  let state = createState(level);
  state = applyStateMove(level, state, level.referenceSolution[0]).state;
  const runId = createRunId(123456, "store-proof");
  ok(saveSession(storage, { level, runId, state, elapsedMs: 3456 }));
  const restored = loadSession(storage, findLevel);
  equal(restored.session.state.board, state.board);
  storage.setItem(STORAGE_KEYS.session, JSON.stringify({ version: 1, gameId: GAME_ID, levelId: level.id, runId, history: [{ index: 999, tool: "black" }], elapsedMs: 0, savedAt: new Date().toISOString() }));
  strictEqual(loadSession(storage, findLevel).session, null);
  strictEqual(storage.getItem("other-game:keep"), "yes");
  ok(storage.removed.every((key) => key.startsWith(STORAGE_PREFIX)));
  for (const key of Object.values(STORAGE_KEYS)) ok(key.startsWith(STORAGE_PREFIX));
  strictEqual(tutorialSeen(storage), false);
  ok(markTutorialSeen(storage));
  strictEqual(tutorialSeen(storage), true);
});

test("完成 payload 只能由真实完成历史生成；本地账本、outbox 和宿主均幂等", () => {
  const level = findLevel(TUTORIAL_LEVEL_ID);
  const state = solvedState(level);
  const runId = createRunId(987654321, "completion-proof");
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
  equal(duplicate.detail, first.detail);
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
  throws(() => settleCompletion({ profile: initial, level, state: { ...state, board: [CELL.BLACK, ...state.board.slice(1)] }, runId, elapsedMs: 1 }), /canonical solved mural/);
  const queuedTarget = {};
  strictEqual(queueCompletion(queuedTarget, first.detail), true);
  strictEqual(queuedTarget.__realmCompletionQueue.length, 1);
});

test("三张教程图绑定同一真实空盘、一次合法操作和完成态", () => {
  const level = findLevel(TUTORIAL_LEVEL_ID);
  for (const source of Object.values(tutorial)) {
    match(source, /<svg[^>]+viewBox="0 0 640 420"[^>]+role="img"/);
    match(source, /preserveAspectRatio="xMidYMid meet"/);
    strictEqual(attr(source, "data-game"), GAME_ID);
    strictEqual(attr(source, "data-tutorial-level"), level.id);
  }
  const initial = boardFromAttribute(tutorial.elements);
  equal(initial, createState(level).board);
  equal(tutorialCells(tutorial.elements).values, initial);
  equal(tutorialCells(tutorial.elements).clues, level.clues);
  strictEqual(attr(tutorial.elements, "data-state"), "initial");
  const before = boardFromAttribute(tutorial.action, "data-before-board");
  const after = boardFromAttribute(tutorial.action, "data-after-board");
  equal(before, initial);
  equal(tutorialCells(tutorial.action, "before").values, before);
  const action = { index: Number(attr(tutorial.action, "data-action-index")), tool: attr(tutorial.action, "data-action-tool") };
  equal(action, TUTORIAL_ACTION);
  const actionState = applyStateMove(level, createState(level), action).state;
  equal(actionState.board, after);
  equal(tutorialCells(tutorial.action, "after").values, after);
  strictEqual(actionState.complete, false);
  const goal = boardFromAttribute(tutorial.goal);
  equal(goal, solvedState(level).board);
  equal(tutorialCells(tutorial.goal).values, goal);
  strictEqual(evaluateBoard(level, goal).complete, true);
  strictEqual(attr(tutorial.goal, "data-player-moves"), String(level.par));
});

test("教程 SVG 可通过 XML 语法校验，且不存在脚本注入", () => {
  for (const name of ["elements", "action", "goal"]) {
    try {
      execFileSync("xmllint", ["--noout", new URL(`./assets/tutorial-${name}.svg`, import.meta.url).pathname], { stdio: "pipe" });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    ok(!tutorial[name].includes("<script"));
  }
});

test("入口、原生教程、完整浏览焦点回归、移动格与版本隔离合同均已接入", () => {
  match(html, /<html lang="zh-CN" data-realm="celestial-mural">/);
  match(html, /href="\.\.\/\.\.\/"/);
  match(html, /\.\.\/\.\.\/shared\/realm-ui\.css/);
  ok(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"));
  match(html, /id="tutorial-button"/);
  match(html, /id="tool-black"/);
  match(html, /id="tool-white"/);
  match(html, /id="tool-clear"/);
  match(css, /\.mural-cell\s*\{[^}]*min-height:\s*44px/s);
  match(css, /\.difficulty-picker button\s*\{[^}]*min-height:\s*44px/s);
  match(css, /object-fit:\s*contain/);
  match(app, /TUTORIAL_LEVEL_ID/);
  match(app, /tutorialReturnFocus = elements\.tutorialButton/);
  match(app, /else closeTutorial\(\);/);
  match(app, /tutorialReturnFocus\?\.focus/);
  doesNotMatch(app, /ten-realms-v2:/);
  doesNotMatch(app, /localStorage\.clear/);
  match(completionSource, /target\.TenRealmsV3 \?\? target\.RealmArcade/);
  match(rules, /5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/);
  match(rules, /doc-zh\/mosaic\.html/);
  match(rules, /vendor\/sgtpuzzles\/mosaic\.c/);
  match(rules, /src\/games\/mosaic\.ts/);
  match(rules, /MIT License/);
  match(rules, /celestial-mural:&lt;runId&gt;:complete|celestial-mural:<runId>:complete/);
});

for (const { name, callback } of tests) {
  try { callback(); console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

console.log(`\n${tests.length} tests · ${assertions} assertions · celestial-mural passed`);
