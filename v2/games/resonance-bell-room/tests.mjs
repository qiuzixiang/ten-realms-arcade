import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  affectedCells,
  bitString,
  cellCoordinates,
  cellIndex,
  createState,
  evaluateState,
  pressCell,
  replayPresses,
  solveMinimum,
  undoPress,
  validateLevel,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  TUTORIAL_LEVEL_ID,
  TUTORIAL_OPERATION_INDEX,
  getLevel,
  levelsByDifficulty,
} from "./levels.mjs";
import {
  completionFromSettledRun,
  enqueueCompletion,
  flushCompletionOutbox,
  loadCompletionOutbox,
  settleCompletion,
  validateCompletion,
} from "./completion.mjs";
import {
  STORAGE_KEYS,
  STORAGE_PREFIX,
  createDefaultProfile,
  loadProfile,
  loadSession,
  markTutorialSeen,
  normalizeProfile,
  safeRead,
  saveProfile,
  saveSession,
  tutorialSeen,
} from "./storage.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const tests = [];
let assertions = 0;

function test(name, fn) { tests.push([name, fn]); }
function check(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function deepEqual(actual, expected, message) { assertions += 1; assert.deepEqual(actual, expected, message); }
function match(value, pattern, message) { assertions += 1; assert.match(value, pattern, message); }
function throws(fn, expectation, message) { assertions += 1; assert.throws(fn, expectation, message); }

class FakeStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class ThrowingReadStorage extends FakeStorage {
  getItem() { throw new Error("storage read blocked"); }
}

class ThrowingWriteStorage extends FakeStorage {
  setItem() { throw new Error("storage quota exceeded"); }
}

class ThrowingRemoveStorage extends FakeStorage {
  removeItem() { throw new Error("storage removal blocked"); }
}

function stateAfter(level, presses, initialState = createState(level)) {
  return presses.reduce((state, index) => pressCell(level, state, index), initialState);
}

function directToggle(level, lights, presses) {
  const result = [...lights];
  for (const press of presses) for (const target of level.templates[press]) result[target] ^= 1;
  return result;
}

function bruteMinimum(level, lights = level.initial) {
  const size = level.width * level.height;
  let minimum = Infinity;
  let solutions = 0;
  for (let mask = 0; mask < 2 ** size; mask += 1) {
    const presses = [];
    for (let index = 0; index < size; index += 1) if ((mask >>> index) & 1) presses.push(index);
    if (directToggle(level, lights, presses).every((light) => light === 1)) {
      solutions += 1;
      minimum = Math.min(minimum, presses.length);
    }
  }
  return { minimum, solutions };
}

function connectedTemplate(level, template) {
  const wanted = new Set(template);
  const reached = new Set([template[0]]);
  const queue = [template[0]];
  while (queue.length) {
    const current = queue.shift();
    const { row, column } = cellCoordinates(level, current);
    const candidates = [
      cellIndex(level, row - 1, column),
      cellIndex(level, row + 1, column),
      cellIndex(level, row, column - 1),
      cellIndex(level, row, column + 1),
    ];
    for (const candidate of candidates) {
      if (wanted.has(candidate) && !reached.has(candidate)) { reached.add(candidate); queue.push(candidate); }
    }
  }
  return reached.size === wanted.size;
}

function rootAttribute(svg, name) {
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  return root.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
}

test("六个固定题面覆盖三档真实规模", () => {
  equal(LEVELS.length, 6);
  deepEqual(DIFFICULTIES.map(({ id }) => id), ["easy", "medium", "hard"]);
  for (const difficulty of DIFFICULTIES) equal(levelsByDifficulty(difficulty.id).length, 2);
  deepEqual(LEVELS.map(({ width }) => width), [3, 3, 4, 4, 5, 5]);
  check(new Set(LEVELS.map(({ id }) => id)).size === LEVELS.length);
});

test("每格独立模板合法、包含自身、连通且无重复", () => {
  for (const level of LEVELS) {
    check(validateLevel(level), level.id);
    const signatures = new Set();
    level.templates.forEach((template, index) => {
      check(template.includes(index), `${level.id}:${index} 必须影响自身`);
      check(connectedTemplate(level, template), `${level.id}:${index} 影响纹必须连通`);
      signatures.add(template.join(","));
    });
    equal(signatures.size, level.width * level.height);
  }
});

test("坐标换算端到端一致，越界严格返回无效", () => {
  const level = LEVELS[4];
  for (let index = 0; index < 25; index += 1) {
    const point = cellCoordinates(level, index);
    equal(cellIndex(level, point.row, point.column), index);
  }
  equal(cellIndex(level, -1, 0), -1);
  equal(cellIndex(level, 0, 5), -1);
  equal(cellCoordinates(level, 25), null);
});

test("一次敲击只翻转该格真实模板且不修改输入", () => {
  const level = getLevel(TUTORIAL_LEVEL_ID);
  const initial = createState(level);
  const snapshot = [...initial.lights];
  const next = pressCell(level, initial, TUTORIAL_OPERATION_INDEX);
  deepEqual(initial.lights, snapshot);
  equal(bitString(next.lights), "101101000");
  deepEqual(affectedCells(level, TUTORIAL_OPERATION_INDEX), [1, 2, 3, 4, 5]);
  equal(next.moves, 1);
  deepEqual(next.history, [4]);
  for (let index = 0; index < 9; index += 1) {
    equal(next.lights[index], snapshot[index] ^ (level.templates[4].includes(index) ? 1 : 0));
  }
});

test("非法敲击是原子 no-op 且不计步", () => {
  const level = LEVELS[0];
  const state = createState(level);
  equal(pressCell(level, state, -1), state);
  equal(pressCell(level, state, 9), state);
  equal(pressCell(level, state, 1.5), state);
  deepEqual(state.history, []);
});

test("同格两敲抵消灯光但保留两次真实移动", () => {
  const level = LEVELS[1];
  const initial = createState(level);
  const twice = stateAfter(level, [3, 3]);
  deepEqual(twice.lights, initial.lights);
  equal(twice.pressParity[3], 0);
  equal(twice.moves, 2);
  deepEqual(twice.history, [3, 3]);
});

test("敲击顺序满足 GF(2) 可交换律", () => {
  for (const level of LEVELS) {
    const left = stateAfter(level, [0, 1, level.width]);
    const right = stateAfter(level, [level.width, 0, 1]);
    deepEqual(left.lights, right.lights, level.id);
    deepEqual(left.pressParity, right.pressParity, level.id);
  }
});

test("撤回完整恢复上一状态，空历史撤回 no-op", () => {
  const level = LEVELS[2];
  const initial = createState(level);
  equal(undoPress(level, initial), initial);
  const once = pressCell(level, initial, 6);
  const twice = pressCell(level, once, 10);
  const restored = undoPress(level, twice);
  deepEqual(restored.lights, once.lights);
  deepEqual(restored.pressParity, once.pressParity);
  deepEqual(restored.history, once.history);
  equal(restored.moves, 1);
});

test("只有全部点亮才完成，八亮仍是未完成", () => {
  const level = LEVELS[0];
  const solved = stateAfter(level, solveMinimum(level).presses);
  check(evaluateState(level, solved).complete);
  const broken = pressCell(level, solved, 0);
  check(!evaluateState(level, broken).complete);
  check(evaluateState(level, broken).dark.length >= 1);
  const invalid = evaluateState(level, { history: [99] });
  check(!invalid.valid);
  check(!invalid.complete);
});

test("独立 GF(2) 求解器复算六关并证明建议最少", () => {
  for (const level of LEVELS) {
    const proof = solveMinimum(level);
    check(proof.solvable, level.id);
    check(proof.minimumProven, level.id);
    equal(proof.minimumTaps, level.suggestedMinimum, level.id);
    equal(proof.solutionCount, level.solutionCount, level.id);
    check(directToggle(level, level.initial, proof.presses).every((light) => light === 1), level.id);
    equal(proof.presses.length, proof.minimumTaps, level.id);
  }
});

test("小盘以全状态枚举独立核验最少敲击与多解数", () => {
  for (const level of levelsByDifficulty("easy")) {
    const brute = bruteMinimum(level);
    const proof = solveMinimum(level);
    equal(proof.minimumTaps, brute.minimum, level.id);
    equal(proof.solutionCount, brute.solutions, level.id);
  }
});

test("求解器可从教程单步中间态继续求解", () => {
  const level = getLevel(TUTORIAL_LEVEL_ID);
  const operation = pressCell(level, createState(level), TUTORIAL_OPERATION_INDEX);
  const proof = solveMinimum(level, operation.lights);
  equal(proof.minimumTaps, 3);
  check(proof.minimumProven);
  check(directToggle(level, operation.lights, proof.presses).every((light) => light === 1));
});

test("不一致 GF(2) 方程诚实报告无解", () => {
  const impossible = {
    id: "test-impossible",
    title: "test",
    difficulty: "easy",
    tier: 1,
    width: 2,
    height: 2,
    initial: [0, 1, 1, 1],
    templates: [[0, 1], [0, 1, 2], [1, 2, 3], [2, 3]],
  };
  check(validateLevel(impossible));
  const found = solveMinimum(impossible);
  if (found.solvable) {
    check(directToggle(impossible, impossible.initial, found.presses).every((light) => light === 1));
  } else {
    equal(found.minimumTaps, null);
    equal(found.solutionCount, 0);
  }
});

test("损坏关卡结构不会进入规则引擎", () => {
  const base = LEVELS[0];
  check(!validateLevel({ ...base, initial: [1] }));
  check(!validateLevel({ ...base, templates: base.templates.map((template, index) => index === 0 ? [1] : template) }));
  check(!validateLevel({ ...base, templates: base.templates.map((template, index) => index === 1 ? [...base.templates[0]] : template) }));
  throws(() => createState({ ...base, width: 8 }), TypeError);
});

test("会话只存敲击历史，刷新后从官方初始盘重放", () => {
  const storage = new FakeStorage();
  const level = LEVELS[2];
  const state = stateAfter(level, [0, 7, 0, 15]);
  check(saveSession(storage, { level, state, runId: "resonance-run-0001", elapsedMs: 4321 }));
  const raw = JSON.parse(storage.getItem(STORAGE_KEYS.session));
  check(!Object.hasOwn(raw, "lights"));
  check(!Object.hasOwn(raw, "completed"));
  const restored = loadSession(storage, getLevel);
  equal(restored.status, "restored");
  deepEqual(restored.session.state.lights, state.lights);
  deepEqual(restored.session.state.history, state.history);
  equal(restored.session.completed, evaluateState(level, state).complete);
  equal(restored.session.elapsedMs, 4321);
});

test("伪造灯光或 completed 字段不能伪造完成", () => {
  const storage = new FakeStorage();
  const level = LEVELS[0];
  const payload = {
    version: 1,
    game: "resonance-bell-room",
    levelId: level.id,
    runId: "resonance-forged-1",
    history: [],
    lights: Array(9).fill(1),
    completed: true,
    elapsedMs: 10,
    savedAt: "2026-09-01T00:00:00.000Z",
  };
  storage.setItem(STORAGE_KEYS.session, JSON.stringify(payload));
  const restored = loadSession(storage, getLevel);
  equal(restored.status, "restored");
  deepEqual(restored.session.state.lights, level.initial);
  check(!restored.session.completed);
});

test("损坏会话仅清理本游戏会话键并安全回退", () => {
  const storage = new FakeStorage({
    [STORAGE_KEYS.session]: JSON.stringify({ version: 1, game: "resonance-bell-room", history: [999] }),
    "ten-realms-v2:games:foreign:session:v1": "keep-me",
  });
  const restored = loadSession(storage, getLevel);
  equal(restored.status, "invalid");
  equal(restored.session, null);
  equal(storage.getItem(STORAGE_KEYS.session), null);
  equal(storage.getItem("ten-realms-v2:games:foreign:session:v1"), "keep-me");
});

test("教程版本键独立且不清除进度", () => {
  const storage = new FakeStorage({ [STORAGE_KEYS.profile]: "profile-sentinel" });
  check(!tutorialSeen(storage));
  check(markTutorialSeen(storage));
  check(tutorialSeen(storage));
  equal(storage.getItem(STORAGE_KEYS.tutorial), "seen-v2");
  equal(storage.getItem(STORAGE_KEYS.profile), "profile-sentinel");
});

test("默认档案可严格往返，损坏档案只清自己的键", () => {
  const storage = new FakeStorage({ "foreign:key": "safe" });
  const profile = createDefaultProfile();
  check(saveProfile(storage, profile, getLevel));
  equal(loadProfile(storage, getLevel).status, "restored");
  storage.setItem(STORAGE_KEYS.profile, "{broken");
  const fallback = loadProfile(storage, getLevel);
  equal(fallback.status, "invalid");
  deepEqual(fallback.profile.completedLevelIds, []);
  equal(storage.getItem("foreign:key"), "safe");
});

test("真实最少解结算首次、最佳与最少敲击三个幂等奖励", () => {
  const level = LEVELS[0];
  const state = stateAfter(level, solveMinimum(level).presses);
  const result = settleCompletion({
    profile: createDefaultProfile(),
    level,
    state,
    runId: "resonance-settle-001",
    elapsedMs: 2500,
    completedAt: "2026-09-01T00:00:00.000Z",
  });
  equal(result.claims.length, 3);
  deepEqual(result.claims.map(({ kind }) => kind).sort(), ["best", "clear", "minimum"]);
  check(validateCompletion(result.detail));
  equal(result.detail.par, level.suggestedMinimum);
  check(result.detail.minimumProven);
  check(result.detail.efficient);
  deepEqual(result.detail.history, state.history);
  deepEqual(result.profile.settledRuns["resonance-settle-001"].history, state.history);
  check(Object.isFrozen(result.detail.history));
  equal(result.profile.bestMovesByLevel[level.id], level.suggestedMinimum);
  check(result.profile.completedLevelIds.includes(level.id));
  deepEqual(completionFromSettledRun(result.profile, "resonance-settle-001"), result.detail);

  const again = settleCompletion({
    profile: result.profile,
    level,
    state,
    runId: "resonance-settle-001",
    elapsedMs: 9999,
    completedAt: "2026-09-02T00:00:00.000Z",
  });
  check(again.alreadySettled);
  equal(again.detail, null);
  equal(again.claims.length, 0);
  equal(again.profile.rewardLedger.length, 3);
});

test("结算拒绝未完成、伪造和越界数据", () => {
  throws(() => settleCompletion({
    profile: createDefaultProfile(),
    level: LEVELS[0],
    state: createState(LEVELS[0]),
    runId: "resonance-invalid-1",
    elapsedMs: 1,
  }), TypeError);
  throws(() => settleCompletion({
    profile: createDefaultProfile(),
    level: LEVELS[0],
    state: stateAfter(LEVELS[0], solveMinimum(LEVELS[0]).presses),
    runId: "bad",
    elapsedMs: 1,
  }), TypeError);
  const solved = stateAfter(LEVELS[0], solveMinimum(LEVELS[0]).presses);
  throws(() => settleCompletion({
    profile: createDefaultProfile(),
    level: LEVELS[0],
    state: { ...solved, moves: solved.moves + 9 },
    runId: "resonance-forged-moves",
    elapsedMs: 1,
  }), TypeError);
  throws(() => settleCompletion({
    profile: createDefaultProfile(),
    level: LEVELS[0],
    state: { ...solved, lights: solved.lights.map((light, index) => index === 0 ? light ^ 1 : light) },
    runId: "resonance-forged-lights",
    elapsedMs: 1,
  }), TypeError);
});

test("完成证明必须携带可重放的真实敲击历史", () => {
  const level = LEVELS[0];
  const state = stateAfter(level, solveMinimum(level).presses);
  const result = settleCompletion({
    profile: createDefaultProfile(), level, state,
    runId: "resonance-proof-0001", elapsedMs: 2718, completedAt: "2026-09-01T03:30:00.000Z",
  });
  check(validateCompletion(result.detail));
  check(!validateCompletion({ ...result.detail, history: [] }));
  check(!validateCompletion({ ...result.detail, history: result.detail.history.slice(0, -1), moves: result.detail.moves - 1 }));
  check(!validateCompletion({ ...result.detail, moves: result.detail.moves + 2 }));
  check(!validateCompletion({ ...result.detail, tier: level.tier + 1 }));
  check(!validateCompletion({ ...result.detail, levelId: LEVELS[1].id }));
});

test("个人最佳可改善但同成绩与刷新不能刷奖励", () => {
  const level = LEVELS[1];
  const solution = solveMinimum(level).presses;
  const inefficient = stateAfter(level, [0, 0, ...solution]);
  const first = settleCompletion({
    profile: createDefaultProfile(), level, state: inefficient,
    runId: "resonance-best-0001", elapsedMs: 5000, completedAt: "2026-09-01T01:00:00.000Z",
  });
  equal(first.profile.bestMovesByLevel[level.id], level.suggestedMinimum + 2);
  check(!first.claims.some(({ kind }) => kind === "minimum"));
  const efficient = stateAfter(level, solution);
  const second = settleCompletion({
    profile: first.profile, level, state: efficient,
    runId: "resonance-best-0002", elapsedMs: 3500, completedAt: "2026-09-01T02:00:00.000Z",
  });
  equal(second.profile.bestMovesByLevel[level.id], level.suggestedMinimum);
  deepEqual(second.claims.map(({ kind }) => kind).sort(), ["best", "minimum"]);
  const repeat = settleCompletion({
    profile: second.profile, level, state: efficient,
    runId: "resonance-best-0003", elapsedMs: 3300, completedAt: "2026-09-01T03:00:00.000Z",
  });
  equal(repeat.claims.length, 0);
  equal(repeat.detail.rewardIds.length, 0);
});

test("completion outbox 先持久化、按稳定 ID 去重并成功派发后删除", () => {
  const storage = new FakeStorage();
  const level = LEVELS[2];
  const state = stateAfter(level, solveMinimum(level).presses);
  const result = settleCompletion({
    profile: createDefaultProfile(), level, state,
    runId: "resonance-outbox-01", elapsedMs: 4444, completedAt: "2026-09-01T04:00:00.000Z",
  });
  check(enqueueCompletion(storage, result.detail));
  check(enqueueCompletion(storage, result.detail));
  equal(loadCompletionOutbox(storage).entries.length, 1);
  equal(flushCompletionOutbox(storage, {}, result.profile).pending, 1);
  let calls = 0;
  const target = { RealmArcade: { complete(detail) { calls += 1; equal(detail.completionId, result.detail.completionId); } } };
  const delivered = flushCompletionOutbox(storage, target, result.profile);
  equal(delivered.delivered, 1);
  equal(delivered.pending, 0);
  equal(calls, 1);
  equal(loadCompletionOutbox(storage).entries.length, 0);
});

test("outbox 适配器抛错时保留原项，未落档结算不外发", () => {
  const storage = new FakeStorage();
  const level = LEVELS[3];
  const state = stateAfter(level, solveMinimum(level).presses);
  const result = settleCompletion({
    profile: createDefaultProfile(), level, state,
    runId: "resonance-outbox-02", elapsedMs: 3333, completedAt: "2026-09-01T05:00:00.000Z",
  });
  check(enqueueCompletion(storage, result.detail));
  const failed = flushCompletionOutbox(storage, { RealmArcade: { complete() { throw new Error("late"); } } }, result.profile);
  equal(failed.delivered, 0);
  equal(failed.pending, 1);
  let calls = 0;
  const unconfirmed = flushCompletionOutbox(storage, { RealmArcade: { complete() { calls += 1; } } }, createDefaultProfile());
  equal(unconfirmed.delivered, 0);
  equal(unconfirmed.pending, 1);
  equal(calls, 0);
});

test("storage 读写或删除失败时 outbox 全程 fail-closed", () => {
  const level = LEVELS[0];
  const state = stateAfter(level, solveMinimum(level).presses);
  const result = settleCompletion({
    profile: createDefaultProfile(), level, state,
    runId: "resonance-storage-fault", elapsedMs: 2048, completedAt: "2026-09-01T05:15:00.000Z",
  });

  const unreadable = new ThrowingReadStorage();
  equal(safeRead(unreadable, STORAGE_KEYS.outbox).available, false);
  equal(loadCompletionOutbox(unreadable).status, "unavailable");
  check(!enqueueCompletion(unreadable, result.detail));
  let calls = 0;
  const target = { RealmArcade: { complete() { calls += 1; } } };
  const readBlocked = flushCompletionOutbox(unreadable, target, result.profile);
  equal(readBlocked.delivered, 0);
  equal(readBlocked.available, false);
  equal(calls, 0);

  const unwritable = new ThrowingWriteStorage();
  check(!enqueueCompletion(unwritable, result.detail));
  equal(calls, 0);

  const removalBlocked = new ThrowingRemoveStorage();
  check(enqueueCompletion(removalBlocked, result.detail));
  const deliveredButRetained = flushCompletionOutbox(removalBlocked, target, result.profile);
  equal(deliveredButRetained.delivered, 1);
  equal(deliveredButRetained.pending, 1);
  equal(deliveredButRetained.available, false);
  equal(loadCompletionOutbox(removalBlocked).entries.length, 1);
  equal(calls, 1);
});

test("缺失证明的档案与 outbox fail-closed，不能调用宿主", () => {
  const storage = new FakeStorage();
  const level = LEVELS[0];
  const state = stateAfter(level, solveMinimum(level).presses);
  const result = settleCompletion({
    profile: createDefaultProfile(), level, state,
    runId: "resonance-proof-0002", elapsedMs: 1618, completedAt: "2026-09-01T05:30:00.000Z",
  });
  const profileWithoutHistory = JSON.parse(JSON.stringify(result.profile));
  delete profileWithoutHistory.settledRuns[result.detail.runId].history;
  equal(normalizeProfile(profileWithoutHistory, getLevel), null);
  check(enqueueCompletion(storage, result.detail));
  let calls = 0;
  const target = { RealmArcade: { complete() { calls += 1; } } };
  const blocked = flushCompletionOutbox(storage, target, profileWithoutHistory);
  equal(blocked.delivered, 0);
  equal(blocked.pending, 1);
  equal(calls, 0);

  storage.setItem(STORAGE_KEYS.outbox, JSON.stringify({
    version: 1,
    entries: [{ ...result.detail, history: undefined }],
  }));
  const invalid = loadCompletionOutbox(storage);
  equal(invalid.status, "invalid");
  equal(invalid.entries.length, 0);
  equal(calls, 0);
});

test("outbox 的真实路径必须与已落档 settlement 完全一致", () => {
  const storage = new FakeStorage();
  const level = LEVELS[0];
  const efficientState = stateAfter(level, solveMinimum(level).presses);
  const inefficientState = stateAfter(level, [0, 0, ...solveMinimum(level).presses]);
  const canonical = settleCompletion({
    profile: createDefaultProfile(), level, state: efficientState,
    runId: "resonance-match-0001", elapsedMs: 1200, completedAt: "2026-09-01T05:45:00.000Z",
  });
  const conflicting = settleCompletion({
    profile: createDefaultProfile(), level, state: inefficientState,
    runId: "resonance-match-0001", elapsedMs: 4200, completedAt: "2026-09-01T05:46:00.000Z",
  });
  check(validateCompletion(conflicting.detail));
  check(enqueueCompletion(storage, conflicting.detail));
  let calls = 0;
  const blocked = flushCompletionOutbox(storage, { RealmArcade: { complete() { calls += 1; } } }, canonical.profile);
  equal(blocked.delivered, 0);
  equal(blocked.pending, 1);
  equal(calls, 0);
});

test("超过旧容量后仍保留每个待投递事件与 settled run", () => {
  const storage = new FakeStorage();
  const level = LEVELS[0];
  const state = stateAfter(level, solveMinimum(level).presses);
  let profile = createDefaultProfile();
  const details = [];
  for (let index = 0; index < 260; index += 1) {
    const result = settleCompletion({
      profile,
      level,
      state,
      runId: `resonance-ledger-${String(index).padStart(4, "0")}`,
      elapsedMs: 1000 + index,
      completedAt: "2026-09-01T06:00:00.000Z",
    });
    profile = result.profile;
    details.push(result.detail);
    check(enqueueCompletion(storage, result.detail));
  }
  equal(Object.keys(profile.settledRuns).length, details.length);
  equal(loadCompletionOutbox(storage).entries.length, details.length);
  equal(loadCompletionOutbox(storage).entries[0].eventId, details[0].eventId);
  const replay = settleCompletion({
    profile,
    level,
    state,
    runId: details[0].runId,
    elapsedMs: details[0].elapsedMs,
    completedAt: details[0].completedAt,
  });
  check(replay.alreadySettled);
  equal(replay.detail, null);
  const failed = flushCompletionOutbox(storage, { RealmArcade: { complete() { throw new Error("offline"); } } }, profile);
  equal(failed.pending, details.length);
  equal(loadCompletionOutbox(storage).entries.length, details.length);
});

test("损坏 outbox 只移除本游戏 outbox", () => {
  const storage = new FakeStorage({
    [STORAGE_KEYS.outbox]: JSON.stringify({ version: 1, entries: [{ forged: true }] }),
    "ten-realms-v2:games:other:completion-outbox:v1": "keep",
  });
  const loaded = loadCompletionOutbox(storage);
  equal(loaded.status, "invalid");
  equal(loaded.entries.length, 0);
  equal(storage.getItem(STORAGE_KEYS.outbox), null);
  equal(storage.getItem("ten-realms-v2:games:other:completion-outbox:v1"), "keep");
});

test("三张教程 SVG 元数据可由真实规则链逐项复算", async () => {
  const level = getLevel(TUTORIAL_LEVEL_ID);
  const initial = createState(level);
  const operation = pressCell(level, initial, TUTORIAL_OPERATION_INDEX);
  const proof = solveMinimum(level);
  const goal = stateAfter(level, proof.presses);
  const names = ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"];
  const [elementsSvg, operationSvg, goalSvg] = await Promise.all(names.map((name) => readFile(path.join(directory, "assets", name), "utf8")));
  for (const svg of [elementsSvg, operationSvg, goalSvg]) {
    equal(rootAttribute(svg, "viewBox"), "0 0 320 184");
    equal(rootAttribute(svg, "preserveAspectRatio"), "xMidYMid meet");
    equal(rootAttribute(svg, "data-game-id"), "resonance-bell-room");
    equal(rootAttribute(svg, "data-level-id"), TUTORIAL_LEVEL_ID);
    equal(rootAttribute(svg, "data-tutorial-version"), "2");
    equal([...svg.matchAll(/data-cell-index="\d+"/g)].length, 9);
  }
  equal(rootAttribute(elementsSvg, "data-initial-bits"), bitString(initial.lights));
  equal(rootAttribute(elementsSvg, "data-template-signatures"), level.templates.map((template) => template.join(",")).join(";"));
  equal(rootAttribute(operationSvg, "data-before-bits"), bitString(initial.lights));
  equal(Number(rootAttribute(operationSvg, "data-action-index")), TUTORIAL_OPERATION_INDEX);
  equal(rootAttribute(operationSvg, "data-affected-indices"), level.templates[TUTORIAL_OPERATION_INDEX].join(","));
  equal(rootAttribute(operationSvg, "data-after-bits"), bitString(operation.lights));
  equal(rootAttribute(operationSvg, "data-moves"), String(operation.moves));
  match(operationSvg, /x="263" y="77" text-anchor="middle"[^>]*>2、3、4、5、6<\/text>/);
  equal(rootAttribute(goalSvg, "data-solution-presses"), proof.presses.join(","));
  equal(rootAttribute(goalSvg, "data-final-bits"), bitString(goal.lights));
  equal(rootAttribute(goalSvg, "data-complete"), String(evaluateState(level, goal).complete));
  equal(rootAttribute(goalSvg, "data-solver-minimum"), String(proof.minimumTaps));
  equal(rootAttribute(goalSvg, "data-solution-count"), String(proof.solutionCount));
  match(goalSvg, /\.num\{[^}]*fill:#fff0a5;[^}]*stroke:#251506/s);
});

test("教程入口统一缓存版本并提供跳过、看完与重看路径", async () => {
  const [html, app] = await Promise.all([
    readFile(path.join(directory, "index.html"), "utf8"),
    readFile(path.join(directory, "app.mjs"), "utf8"),
  ]);
  equal([...app.matchAll(/\.\/assets\/tutorial-(?:elements|operation|goal)\.svg\?tutorial=2/g)].length, 3);
  match(html, /id="tutorial-button"/);
  match(html, /id="tutorial-close"[^>]*>跳过/);
  match(html, /id="tutorial-next"/);
  match(html, /id="tutorial-previous"/);
  match(app, /if \(!tutorialSeen\(storage\)\)/);
  match(app, /markTutorialSeen\(storage\)/);
  match(app, /event\.key === " "[^\n]+event\.key === "Enter"/);
  match(app, /addEventListener\("realm:ready"[^\n]+flushCompletionOutbox/);
  match(app, /addEventListener\("ten-realms-v2:realm-ready"[^\n]+flushCompletionOutbox/);
  match(app, /const previousProfile = profile;/);
  match(app, /if \(!saved\) profile = previousProfile;/);
  match(app, /evaluateState\(level, state\)\.complete && !profile\.settledRuns\[runId\]/);
});

test("页面具备 V2.5 接入、规范返回与脚本顺序", async () => {
  const html = await readFile(path.join(directory, "index.html"), "utf8");
  match(html, /<html[^>]+data-realm="resonance-bell-room"/);
  match(html, /href="\.\.\/\.\.\/"/);
  match(html, /href="\.\.\/\.\.\/shared\/realm-ui\.css"/);
  const sharedIndex = html.indexOf('src="../../shared/realm-ui.mjs"');
  const appIndex = html.indexOf('src="./app.mjs"');
  check(sharedIndex >= 0 && appIndex > sharedIndex);
  match(html, /V2\.5/);
  match(html, /role="grid"/);
});

test("CSS 固化 44px、320px、教程 contain 与 reduced-motion 门槛", async () => {
  const css = await readFile(path.join(directory, "styles.css"), "utf8");
  match(css, /button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
  match(css, /\.bell\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
  match(css, /@media \(max-width:\s*340px\)/);
  match(css, /object-fit:\s*contain/);
  match(css, /overflow-x:\s*clip/);
  match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  match(css, /body\.is-dialog-open\s*\{[^}]*overflow:\s*hidden/s);
});

test("生产代码只使用私有存储前缀且不执行全量清理", async () => {
  const files = ["logic.mjs", "levels.mjs", "storage.mjs", "completion.mjs", "app.mjs"];
  const sources = await Promise.all(files.map((name) => readFile(path.join(directory, name), "utf8")));
  check(STORAGE_PREFIX.startsWith("ten-realms-v2:games:resonance-bell-room:"));
  check(sources.every((source) => !source.includes("localStorage.clear")));
  check(sources.every((source) => !source.includes("storage.clear")));
});

test("RULES 可追溯来源、许可证、教程真值与多解边界", async () => {
  const rules = await readFile(path.join(directory, "RULES.md"), "utf8");
  match(rules, /5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/);
  match(rules, /Simon Tatham/);
  match(rules, /MIT/);
  match(rules, /每格独立影响模板/);
  match(rules, /GF\(2\)/);
  match(rules, /110010000/);
  match(rules, /允许多解/);
  match(rules, /RealmArcade\.complete/);
});

let failures = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error.stack ?? error);
  }
}

if (failures) {
  console.error(`resonance-bell-room: ${failures} failed, ${tests.length} tests, ${assertions} assertions`);
  process.exit(1);
}
console.log(`resonance-bell-room: ${tests.length} tests, ${assertions} assertions passed`);
