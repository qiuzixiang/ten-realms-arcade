import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DIFFICULTIES,
  TOOL_TYPES,
  analyzeBoard,
  analyzeProposal,
  analyzeRooms,
  applyRoom,
  applyTool,
  assertValidPuzzle,
  boardSnapshot,
  buildPuzzleFromRooms,
  candidateRectanglesForClue,
  cellKey,
  cluesInRectangle,
  computeRunSummary,
  createGameState,
  createSeededRandom,
  deserializeState,
  getPuzzleErrors,
  normalizeRect,
  normalizeStoredRect,
  parseCellKey,
  recordInvalidAttempt,
  rectangleArea,
  rectangleCells,
  rectangleContains,
  rectangleInBounds,
  rectanglesOverlap,
  rectKey,
  restartState,
  roomTypeKey,
  serializeState,
  solvePuzzle,
  toggleCandidate,
  toggleExclusions,
  undoToSnapshot,
  validatePuzzle,
} from "./logic.mjs";
import { LEVELS, getLevel, getLevels, nextLevel } from "./levels.mjs";
import {
  STORAGE_KEYS,
  STORAGE_PREFIX,
  applyCompletionToRecords,
  defaultRecords,
  defaultSettings,
  loadRecords,
  loadSession,
  loadSettings,
  markTutorialSeen,
  normalizeRecords,
  saveRecords,
  saveSession,
  saveSettings,
  tutorialSeen,
} from "./storage.mjs";
import {
  COMPLETION_EVENT,
  COMPLETION_QUEUE,
  COMPLETION_SCHEMA,
  GAME_ID,
  createCompletionDetail,
  getCompletionTransport,
  installGameApi,
  publishCompletion,
} from "./completion.mjs";
import { createModalController } from "./modal-controller.mjs";
import { createVictoryScheduler } from "./victory-scheduler.mjs";
import { sceneForLevel } from "./scene-themes.mjs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.mjs", import.meta.url), "utf8");
const completionSource = readFileSync(new URL("./completion.mjs", import.meta.url), "utf8");
const tutorialFiles = [
  "tutorial-elements.svg",
  "tutorial-action.svg",
  "tutorial-goal.svg",
];
const tutorialSvgs = tutorialFiles.map((name) => ({
  name,
  source: readFileSync(new URL(`./assets/${name}`, import.meta.url), "utf8"),
}));
const RUN_ID_A = "run-20260831-dream-a";
const RUN_ID_B = "run-20260831-dream-b";

const tests = [];
let assertions = 0;

function test(name, callback) {
  tests.push({ name, callback });
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function strictEqual(actual, expected, message) {
  assertions += 1;
  assert.strictEqual(actual, expected, message);
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function throws(callback, expected, message) {
  assertions += 1;
  assert.throws(callback, expected, message);
}

function match(value, pattern, message) {
  assertions += 1;
  assert.match(value, pattern, message);
}

function doesNotMatch(value, pattern, message) {
  assertions += 1;
  assert.doesNotMatch(value, pattern, message);
}

function solutionKeys(rooms) {
  return rooms.map(rectKey).sort();
}

function solveIntoState(level, initial = createGameState()) {
  let state = initial;
  for (const room of level.solution) {
    const result = applyRoom(level, state, room);
    ok(result.changed && result.action === "place", `${level.id} 的作者解每间客房都必须可提交`);
    state = result.state;
  }
  return state;
}

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.reads = [];
    this.writes = [];
  }

  getItem(key) {
    this.reads.push(key);
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.writes.push(key);
    this.values.set(key, String(value));
  }
}

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
}

function createFocusFixture({ dismissOnBackdrop = true, focusableCount = 2 } = {}) {
  const listeners = new Map();
  const scheduled = [];
  const focusLog = [];
  let active = null;

  function focusable(name) {
    return {
      name,
      focus(options) {
        active = this;
        focusLog.push({ name, options });
      },
    };
  }

  const trigger = focusable("trigger");
  const controls = Array.from({ length: focusableCount }, (_, index) => focusable(`control-${index + 1}`));
  const dialog = {
    open: false,
    returnValue: "",
    ownerDocument: { get activeElement() { return active; } },
    addEventListener(type, listener) {
      const group = listeners.get(type) ?? [];
      group.push(listener);
      listeners.set(type, group);
    },
    showModal() { this.open = true; },
    close(reason = "") {
      this.open = false;
      this.returnValue = reason;
      this.emit("close", { target: this });
    },
    focus(options) {
      active = this;
      focusLog.push({ name: "dialog", options });
    },
    emit(type, event = {}) {
      const payload = { target: this, ...event };
      for (const listener of listeners.get(type) ?? []) listener(payload);
      return payload;
    },
  };
  const controller = createModalController({
    dialog,
    initialFocus: controls[0],
    dismissOnBackdrop,
    getFocusable: () => controls,
    getActiveElement: () => active,
    schedule: (callback) => scheduled.push(callback),
  });
  const flush = () => {
    while (scheduled.length) scheduled.shift()();
  };
  return {
    controller,
    dialog,
    trigger,
    controls,
    focusLog,
    flush,
    setActive(value) { active = value; },
    getActive() { return active; },
  };
}

test("规则常量只暴露三种笔记/成房工具与三档正式难度", () => {
  equal(TOOL_TYPES, { ROOM: "room", CANDIDATE: "candidate", EXCLUDE: "exclude" });
  equal(DIFFICULTIES, ["easy", "medium", "hard"]);
  ok(Object.isFrozen(TOOL_TYPES));
  ok(Object.isFrozen(DIFFICULTIES));
});

test("拖拽终点四向正规化为同一个含首尾格的矩形", () => {
  const expected = { x: 1, y: 2, width: 3, height: 2 };
  equal(normalizeRect({ x: 1, y: 2 }, { x: 3, y: 3 }), expected, "右下方拖拽");
  equal(normalizeRect({ x: 3, y: 2 }, { x: 1, y: 3 }), expected, "左下方拖拽");
  equal(normalizeRect({ x: 1, y: 3 }, { x: 3, y: 2 }), expected, "右上方拖拽");
  equal(normalizeRect({ x: 3, y: 3 }, { x: 1, y: 2 }), expected, "左上方拖拽");
  equal(normalizeRect([4, 5]), { x: 4, y: 5, width: 1, height: 1 }, "轻点是单格矩形");
  throws(() => normalizeRect({ x: 0.5, y: 0 }, { x: 1, y: 1 }), TypeError);
  throws(() => normalizeRect({ x: 0, y: 0 }, { x: Number.NaN, y: 1 }), TypeError);
});

test("坐标、矩形与面积助手保持格线几何不变量", () => {
  const board = { width: 5, height: 4 };
  const rect = { x: 1, y: 1, width: 3, height: 2 };
  equal(cellKey(3, 2), "3,2");
  equal(parseCellKey("3,2"), { x: 3, y: 2 });
  throws(() => parseCellKey("03,2"), TypeError);
  throws(() => parseCellKey("-1,2"), TypeError);
  equal(normalizeStoredRect(rect), rect);
  strictEqual(normalizeStoredRect({ ...rect, width: 0 }), null);
  strictEqual(normalizeStoredRect({ ...rect, x: -1 }), null);
  equal(rectKey(rect), "1,1,3,2");
  strictEqual(rectangleArea(rect), 6);
  strictEqual(roomTypeKey(rect), "2×3", "房型应忽略旋转方向");
  strictEqual(rectangleContains(rect, { x: 1, y: 1 }), true);
  strictEqual(rectangleContains(rect, { x: 3, y: 2 }), true);
  strictEqual(rectangleContains(rect, { x: 4, y: 2 }), false);
  strictEqual(rectangleInBounds(board, rect), true);
  strictEqual(rectangleInBounds(board, { ...rect, width: 5 }), false);
  strictEqual(rectanglesOverlap(rect, { x: 3, y: 2, width: 2, height: 2 }), true);
  strictEqual(rectanglesOverlap(rect, { x: 4, y: 1, width: 1, height: 2 }), false, "共享边界不算重叠");
  equal(rectangleCells(rect), [
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
  ]);
});

test("合法客房必须恰含一个数字且面积相等", () => {
  const level = LEVELS[0];
  for (const room of level.solution) {
    const clues = cluesInRectangle(level, room);
    strictEqual(clues.length, 1, `${rectKey(room)} 必须只有一位旅客`);
    strictEqual(rectangleArea(room), clues[0].value, `${rectKey(room)} 面积必须等于数字`);
    strictEqual(rectangleInBounds(level, room), true);
  }
  const analysis = analyzeRooms(level, level.solution);
  strictEqual(analysis.solved, true);
  strictEqual(analysis.errors.length, 0);
  strictEqual(analysis.coveredCount, level.width * level.height);
  ok(analysis.coverage.every((count) => count === 1));
  ok(analysis.clueCoverage.every((count) => count === 1));
});

test("零数字、多数字、错面积与越界矩形均被原子拒绝", () => {
  const level = LEVELS[0];
  const state = createGameState();
  const missingClue = { x: 1, y: 0, width: 1, height: 1 };
  const multipleClues = { x: 0, y: 0, width: level.width, height: level.height };
  const wrongArea = { x: level.clues[0].x, y: level.clues[0].y, width: 1, height: 1 };
  const outOfBounds = { x: level.width - 1, y: level.height - 1, width: 2, height: 1 };

  for (const [rect, reason] of [
    [missingClue, "missing-clue"],
    [multipleClues, "multiple-clues"],
    [wrongArea, "wrong-area"],
    [outOfBounds, "out-of-bounds"],
  ]) {
    const proposal = analyzeProposal(level, state, rect, TOOL_TYPES.ROOM);
    strictEqual(proposal.valid, false);
    strictEqual(proposal.reason, reason);
    const result = applyRoom(level, state, rect);
    strictEqual(result.changed, false);
    strictEqual(result.state, state, "非法提交不得改写原状态");
  }

  const counted = recordInvalidAttempt(state, "wrong-area");
  strictEqual(counted.state.metrics.moves, 1);
  strictEqual(counted.state.metrics.invalidAttempts, 1);
  strictEqual(state.metrics.moves, 0, "错误计数也必须保持不可变输入");
});

test("单间合法的客房也不得与已成房边界重叠", () => {
  const level = LEVELS[0];
  const candidateSets = level.clues.map((clue) => candidateRectanglesForClue(level, clue));
  let pair = null;
  for (let firstIndex = 0; firstIndex < candidateSets.length && !pair; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < candidateSets.length && !pair; secondIndex += 1) {
      for (const first of candidateSets[firstIndex]) {
        const second = candidateSets[secondIndex].find((candidate) => rectanglesOverlap(first, candidate));
        if (second) { pair = [first, second]; break; }
      }
    }
  }
  ok(pair, "测试题应包含需要全局排除的重叠候选");
  const placed = applyRoom(level, createGameState(), pair[0]);
  ok(placed.changed);
  const rejected = analyzeProposal(level, placed.state, pair[1]);
  strictEqual(rejected.valid, false);
  strictEqual(rejected.reason, "overlap");
  strictEqual(applyRoom(level, placed.state, pair[1]).state, placed.state);
});

test("重叠、遗漏或数字覆盖异常均不能误报通关", () => {
  const level = LEVELS[0];
  const omitted = analyzeRooms(level, level.solution.slice(1));
  strictEqual(omitted.solved, false);
  ok(omitted.errors.includes("floor-uncovered"));
  ok(omitted.errors.includes("clue-coverage"));
  ok(omitted.uncoveredCells.length > 0);

  const duplicated = analyzeRooms(level, [...level.solution, level.solution[0]]);
  strictEqual(duplicated.solved, false);
  ok(duplicated.errors.includes("rooms-overlap"));
  ok(duplicated.errors.includes("clue-coverage"));
  ok(duplicated.overlapCells.length > 0);

  const malformed = analyzeRooms(level, [{ x: -1, y: 0, width: 2, height: 2 }]);
  strictEqual(malformed.solved, false);
  ok(malformed.errors.includes("room-0:out-of-bounds"));
});

test("候选框与排除记号只是笔记，即使保留也不影响胜负", () => {
  const level = LEVELS[0];
  let state = createGameState();
  const candidate = toggleCandidate(level, state, { x: 0, y: 0, width: 2, height: 2 });
  ok(candidate.changed);
  state = candidate.state;
  const exclusion = toggleExclusions(level, state, { x: 0, y: 0, width: 2, height: 1 });
  ok(exclusion.changed);
  state = solveIntoState(level, exclusion.state);

  strictEqual(state.candidates.length, 1);
  strictEqual(state.excluded.size, 2);
  strictEqual(analyzeBoard(level, state).solved, true);
  const summary = computeRunSummary(level, state);
  ok(summary, "笔记不得阻止通关摘要");
  strictEqual(summary.rooms, level.clues.length);
  strictEqual(summary.oneStroke, true);
  strictEqual(summary.noRework, true);

  const candidateRemoved = toggleCandidate(level, state, { x: 0, y: 0, width: 2, height: 2 });
  strictEqual(candidateRemoved.action, "candidate-remove");
  const exclusionsRemoved = toggleExclusions(level, candidateRemoved.state, { x: 0, y: 0, width: 2, height: 1 });
  strictEqual(exclusionsRemoved.action, "exclude-remove");
  strictEqual(exclusionsRemoved.state.excluded.size, 0);
});

test("成房、轻点拆房、工具分派与错误工具都有明确语义", () => {
  const level = LEVELS[0];
  const room = level.solution[0];
  const initial = createGameState();
  const placed = applyTool(level, initial, room, TOOL_TYPES.ROOM);
  strictEqual(placed.action, "place");
  strictEqual(placed.state.metrics.validPlacements, 1);
  strictEqual(initial.rooms.length, 0);

  const tap = { x: room.x, y: room.y, width: 1, height: 1 };
  const removed = applyRoom(level, placed.state, tap);
  strictEqual(removed.action, "remove");
  strictEqual(removed.state.rooms.length, 0);
  strictEqual(removed.state.metrics.removals, 1);
  strictEqual(removed.state.metrics.reworks, 1);

  strictEqual(applyTool(level, initial, tap, TOOL_TYPES.CANDIDATE).action, "candidate-add");
  strictEqual(applyTool(level, initial, tap, TOOL_TYPES.EXCLUDE).action, "exclude-add");
  const unknown = applyTool(level, initial, tap, "paint");
  strictEqual(unknown.changed, false);
  strictEqual(unknown.reason, "unknown-tool");
});

test("撤销恢复房间与笔记快照，重开清盘但保留评级用返工计数", () => {
  const level = LEVELS[0];
  const initial = createGameState();
  const snapshot = boardSnapshot(initial);
  let state = applyRoom(level, initial, level.solution[0]).state;
  state = toggleCandidate(level, state, { x: 0, y: 0, width: 1, height: 1 }).state;
  state = toggleExclusions(level, state, { x: 0, y: 0, width: 1, height: 1 }).state;

  const undone = undoToSnapshot(state, snapshot, level);
  strictEqual(undone.changed, true);
  equal(boardSnapshot(undone.state), snapshot);
  strictEqual(undone.state.metrics.undos, 1);
  strictEqual(undone.state.metrics.reworks, 1);
  strictEqual(undone.state.metrics.moves, state.metrics.moves + 1);
  strictEqual(state.rooms.length, 1, "撤销不得回写输入状态");
  strictEqual(undoToSnapshot(state, { rooms: [] }, level).changed, false);

  const restarted = restartState(state);
  equal(boardSnapshot(restarted), { rooms: [], candidates: [], excluded: [] });
  strictEqual(restarted.metrics.restarts, state.metrics.restarts + 1);
  strictEqual(restarted.metrics.reworks, state.metrics.reworks + 1);
  strictEqual(restarted.metrics.moves, state.metrics.moves + 1);
  strictEqual(state.rooms.length, 1, "重开也不得改写旧状态");
});

test("完成摘要将一次成房、无返工与星级按真实指标计算", () => {
  const level = LEVELS[0];
  const perfect = solveIntoState(level);
  const summary = computeRunSummary(level, perfect);
  strictEqual(summary.rating, 3);
  strictEqual(summary.oneStroke, true);
  strictEqual(summary.noRework, true);
  strictEqual(summary.moves, level.solution.length);
  equal(summary.roomTypes, [...new Set(level.solution.map(roomTypeKey))].sort());

  const flawed = solveIntoState(level);
  flawed.metrics.invalidAttempts = 3;
  flawed.metrics.reworks = 3;
  const low = computeRunSummary(level, flawed);
  strictEqual(low.rating, 1);
  strictEqual(low.oneStroke, false);
  strictEqual(low.noRework, false);
  strictEqual(computeRunSummary(level, createGameState()), null);
});

test("题面构建只接受无重叠无遗漏的完整矩形分割", () => {
  const definition = {
    id: "seed-proof",
    title: "测试楼层",
    difficulty: "easy",
    width: 4,
    height: 4,
    seed: "same-seed",
    rooms: [
      { x: 0, y: 0, width: 2, height: 2 },
      { x: 2, y: 0, width: 2, height: 2 },
      { x: 0, y: 2, width: 2, height: 2 },
      { x: 2, y: 2, width: 2, height: 2 },
    ],
  };
  const first = buildPuzzleFromRooms(definition);
  const second = buildPuzzleFromRooms(structuredClone(definition));
  equal(first, second, "同一种子与分割必须产生字节级稳定题面");
  ok(validatePuzzle(first));
  strictEqual(assertValidPuzzle(first), first);

  const gap = structuredClone(definition);
  gap.rooms.pop();
  throws(() => buildPuzzleFromRooms(gap), TypeError);
  const overlap = structuredClone(definition);
  overlap.rooms[3] = { x: 1, y: 2, width: 2, height: 2 };
  throws(() => buildPuzzleFromRooms(overlap), TypeError);
  throws(() => buildPuzzleFromRooms({ ...definition, difficulty: "nightmare" }), TypeError);
  throws(() => buildPuzzleFromRooms({ ...definition, id: "bad id" }), TypeError);

  const randomA = createSeededRandom("hotel-seed");
  const randomB = createSeededRandom("hotel-seed");
  equal(Array.from({ length: 12 }, randomA), Array.from({ length: 12 }, randomB));
});

test("九道正式题覆盖三档、全部合法且可复现", () => {
  strictEqual(LEVELS.length, 9);
  strictEqual(new Set(LEVELS.map((level) => level.id)).size, 9);
  for (const difficulty of DIFFICULTIES) {
    strictEqual(getLevels(difficulty).length, 3, `${difficulty} 必须有三题`);
  }

  for (const level of LEVELS) {
    ok(Object.isFrozen(level));
    ok(Object.isFrozen(level.clues));
    ok(Object.isFrozen(level.solution));
    strictEqual(getLevel(level.id), level);
    equal(getPuzzleErrors(level), []);
    ok(validatePuzzle(level));
    strictEqual(level.clues.reduce((sum, clue) => sum + clue.value, 0), level.width * level.height);

    const roomsWithClues = level.solution.map((room) => {
      const clue = level.clues.find((candidate) => rectangleContains(room, candidate));
      ok(clue, `${level.id}:${rectKey(room)} 必须能找回作者数字`);
      return { ...room, clue: { x: clue.x, y: clue.y } };
    });
    const rebuilt = buildPuzzleFromRooms({
      id: level.id,
      title: level.title,
      subtitle: level.subtitle,
      difficulty: level.difficulty,
      width: level.width,
      height: level.height,
      seed: level.seed,
      rooms: roomsWithClues,
    });
    equal(rebuilt.clues, level.clues, `${level.id} 题面不可漂移`);
    equal(rebuilt.solution, level.solution, `${level.id} 作者分割不可漂移`);
  }
  strictEqual(getLevel("not-a-floor"), null);
});

test("九道正式题都由 exact-cover 穷尽证明恰好一解且与作者答案一致", () => {
  for (const level of LEVELS) {
    const proof = solvePuzzle(level, { limit: 2 });
    strictEqual(proof.count, 1, `${level.id} 必须恰有一解`);
    strictEqual(proof.unique, true, `${level.id} 必须证明唯一性`);
    strictEqual(proof.exhausted, true, `${level.id} 搜索必须穷尽而非仅触发 limit`);
    ok(proof.nodes > 0);
    equal(solutionKeys(proof.solutions[0]), solutionKeys(level.solution), `${level.id} 求解器解必须等于作者解`);
    strictEqual(level.proof.unique, true);
    strictEqual(level.proof.version, "exact-cover-v1");
  }
  throws(() => solvePuzzle(LEVELS[0], { limit: 0 }), RangeError);
});

test("换题只在当前难度内循环，题库查询不暴露虚构题", () => {
  for (const difficulty of DIFFICULTIES) {
    const floors = getLevels(difficulty);
    for (let index = 0; index < floors.length; index += 1) {
      strictEqual(nextLevel(floors[index].id, difficulty), floors[(index + 1) % floors.length]);
    }
  }
  strictEqual(nextLevel("missing", "easy"), getLevels("easy")[0]);
});

test("状态序列化完整往返房间、候选、排除与评级指标", () => {
  const level = LEVELS[0];
  let state = applyRoom(level, createGameState(), level.solution[0]).state;
  state = toggleCandidate(level, state, { x: 2, y: 2, width: 2, height: 2 }).state;
  state = toggleExclusions(level, state, { x: 4, y: 4, width: 1, height: 1 }).state;
  state.metrics.invalidAttempts = 2;
  const encoded = serializeState(state);
  const restored = deserializeState(structuredClone(encoded), level);
  ok(restored);
  equal(serializeState(restored), encoded);
  strictEqual(restored.excluded instanceof Set, true);

  strictEqual(deserializeState({ ...encoded, version: 2 }, level), null);
  strictEqual(deserializeState({ ...encoded, rooms: [...encoded.rooms, encoded.rooms[0]] }, level), null);
  strictEqual(deserializeState({ ...encoded, excluded: ["99,99"] }, level), null);
  strictEqual(deserializeState({ ...encoded, metrics: { ...encoded.metrics, moves: -1 } }, level), null);
  strictEqual(deserializeState({ ...encoded, candidates: [{ x: -1, y: 0, width: 1, height: 1 }] }, level), null);
});

test("所有私有存档键严格使用 2.0 游戏前缀且绝不读写 1.0 进度", () => {
  strictEqual(STORAGE_PREFIX, "ten-realms-v2:games:dream-hotel:");
  equal(STORAGE_KEYS, {
    session: "ten-realms-v2:games:dream-hotel:session:v1",
    settings: "ten-realms-v2:games:dream-hotel:settings:v1",
    tutorial: "ten-realms-v2:games:dream-hotel:tutorial:v2",
    records: "ten-realms-v2:games:dream-hotel:records:v1",
  });
  strictEqual(new Set(Object.values(STORAGE_KEYS)).size, 4);
  for (const [name, key] of Object.entries(STORAGE_KEYS)) {
    ok(key.startsWith(STORAGE_PREFIX), `${name} 键必须在专属命名空间`);
    doesNotMatch(key, /^ten-realms:/, "不得借用 1.0 前缀");
  }

  const storage = new MemoryStorage({
    "ten-realms:progress:v1": JSON.stringify({ xp: 999999 }),
  });
  loadSettings(storage);
  loadRecords(storage);
  loadSession(storage, getLevel);
  tutorialSeen(storage);
  saveSettings(storage, defaultSettings());
  saveRecords(storage, defaultRecords());
  markTutorialSeen(storage);
  ok([...storage.reads, ...storage.writes].every((key) => key.startsWith(STORAGE_PREFIX)));
  strictEqual(storage.values.get("ten-realms:progress:v1"), JSON.stringify({ xp: 999999 }));
});

test("每个 session 必须携带合法 runId，丢失或畸形运行标识拒绝保存与恢复", () => {
  const level = LEVELS[0];
  const storage = new MemoryStorage();
  const session = {
    level,
    game: createGameState(),
    history: [],
    tool: TOOL_TYPES.ROOM,
    cursor: { x: 0, y: 0 },
    elapsedMs: 0,
    completion: null,
  };
  strictEqual(saveSession(storage, session), false, "无 runId 的局面不得写入");
  strictEqual(saveSession(storage, { ...session, runId: "short" }), false);
  strictEqual(saveSession(storage, { ...session, runId: "run id with spaces" }), false);
  ok(saveSession(storage, { ...session, runId: RUN_ID_A }));

  const payload = JSON.parse(storage.values.get(STORAGE_KEYS.session));
  strictEqual(payload.runId, RUN_ID_A);
  delete payload.runId;
  storage.values.set(STORAGE_KEYS.session, JSON.stringify(payload));
  strictEqual(loadSession(storage, getLevel), null, "旧或损坏存档无 runId 时必须安全回退");
  payload.runId = "bad/value";
  storage.values.set(STORAGE_KEYS.session, JSON.stringify(payload));
  strictEqual(loadSession(storage, getLevel), null);
});

test("session 持久化未完成/待交付/已交付状态，并拒绝损坏 completion 标记", () => {
  const level = LEVELS[0];
  const storage = new MemoryStorage();
  const base = {
    level,
    runId: RUN_ID_A,
    game: solveIntoState(level),
    history: [],
    tool: TOOL_TYPES.ROOM,
    cursor: { x: 0, y: 0 },
    elapsedMs: 12_000,
  };
  ok(saveSession(storage, { ...base, completion: null }));
  strictEqual(JSON.parse(storage.values.get(STORAGE_KEYS.session)).completion, null);
  strictEqual(loadSession(storage, getLevel).completion, null);

  const pending = { completedAt: "2026-08-31T08:00:00.000Z", delivered: false };
  ok(saveSession(storage, { ...base, completion: pending }));
  equal(loadSession(storage, getLevel).completion, pending);
  const delivered = { ...pending, delivered: true };
  ok(saveSession(storage, { ...base, completion: delivered }));
  equal(loadSession(storage, getLevel).completion, delivered);

  strictEqual(saveSession(storage, { ...base, completion: { completedAt: "invalid", delivered: false } }), false);
  strictEqual(saveSession(storage, { ...base, completion: { completedAt: pending.completedAt, delivered: "yes" } }), false);
  const raw = JSON.parse(storage.values.get(STORAGE_KEYS.session));
  raw.completion = { completedAt: pending.completedAt, delivered: 1 };
  storage.values.set(STORAGE_KEYS.session, JSON.stringify(raw));
  strictEqual(loadSession(storage, getLevel), null);
});

test("设置、局面、教程与长期记录均可安全往返", () => {
  const storage = new MemoryStorage();
  const level = LEVELS[0];
  let game = applyRoom(level, createGameState(), level.solution[0]).state;
  game = toggleCandidate(level, game, { x: 0, y: 0, width: 1, height: 1 }).state;
  const history = [boardSnapshot(createGameState())];

  ok(saveSettings(storage, { muted: true, difficulty: "medium", lastLevelId: level.id }));
  equal(loadSettings(storage), { version: 1, muted: true, difficulty: "medium", lastLevelId: level.id });
  ok(saveSession(storage, {
    level,
    runId: RUN_ID_A,
    game,
    history,
    tool: TOOL_TYPES.CANDIDATE,
    cursor: { x: 2, y: 3 },
    elapsedMs: 1234.9,
    completion: null,
  }));
  const restored = loadSession(storage, getLevel);
  strictEqual(restored.level, level);
  strictEqual(restored.runId, RUN_ID_A);
  equal(serializeState(restored.game), serializeState(game));
  equal(restored.history, history);
  strictEqual(restored.tool, TOOL_TYPES.CANDIDATE);
  equal(restored.cursor, { x: 2, y: 3 });
  strictEqual(restored.elapsedMs, 1234);
  strictEqual(restored.completion, null);
  ok(restored.savedAt && Number.isFinite(Date.parse(restored.savedAt)));

  strictEqual(tutorialSeen(storage), false);
  ok(markTutorialSeen(storage));
  strictEqual(tutorialSeen(storage), true);
  strictEqual(storage.values.get(STORAGE_KEYS.tutorial), "seen-v2");
  const legacyTutorial = new MemoryStorage({
    "ten-realms-v2:games:dream-hotel:tutorial:v1": "seen-v1",
  });
  strictEqual(tutorialSeen(legacyTutorial), false, "旧教程记录必须让新版教程再自动出现一次");
  ok(markTutorialSeen(legacyTutorial));
  strictEqual(legacyTutorial.values.get("ten-realms-v2:games:dream-hotel:tutorial:v1"), "seen-v1");
  ok(saveRecords(storage, defaultRecords()));
  equal(loadRecords(storage), defaultRecords());
});

test("损坏、过界、未知版本或拒绝访问的存档会安全回退", () => {
  const corrupt = new MemoryStorage(Object.fromEntries(Object.values(STORAGE_KEYS).map((key) => [key, "{broken"])));
  equal(loadSettings(corrupt), defaultSettings());
  equal(loadRecords(corrupt), defaultRecords());
  strictEqual(loadSession(corrupt, getLevel), null);
  strictEqual(tutorialSeen(corrupt), false);

  const throwingStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  equal(loadSettings(throwingStorage), defaultSettings());
  equal(loadRecords(throwingStorage), defaultRecords());
  strictEqual(loadSession(throwingStorage, getLevel), null);
  strictEqual(tutorialSeen(throwingStorage), false);
  strictEqual(saveSettings(throwingStorage, defaultSettings()), false);
  strictEqual(saveRecords(throwingStorage, defaultRecords()), false);
  strictEqual(markTutorialSeen(throwingStorage), false);

  const level = LEVELS[0];
  const validStorage = new MemoryStorage();
  ok(saveSession(validStorage, {
    level,
    runId: RUN_ID_A,
    game: createGameState(),
    history: [],
    tool: TOOL_TYPES.ROOM,
    cursor: { x: 0, y: 0 },
    elapsedMs: 0,
    completion: null,
  }));
  const payload = JSON.parse(validStorage.values.get(STORAGE_KEYS.session));
  payload.cursor = { x: 999, y: 0 };
  validStorage.values.set(STORAGE_KEYS.session, JSON.stringify(payload));
  strictEqual(loadSession(validStorage, getLevel), null);
  payload.cursor = { x: 0, y: 0 };
  payload.levelId = "missing-level";
  validStorage.values.set(STORAGE_KEYS.session, JSON.stringify(payload));
  strictEqual(loadSession(validStorage, getLevel), null);

  const dirty = normalizeRecords({
    version: 1,
    completionCount: -9,
    completions: { "bad key!": { count: 2, lastAt: "never" } },
    roomTypes: { "2×3": { count: -1, unlockedAt: "never" } },
    bestRatings: { [level.id]: 99 },
    bestTimes: { [level.id]: -1 },
    achievements: { broken: "never" },
    rewardIds: { broken: "never" },
    settledRuns: {
      [RUN_ID_A]: { awardedIds: "not-an-array", unlockedRoomTypes: [], improvedRating: true },
    },
  });
  equal(dirty, defaultRecords());
});

test("房型图鉴、一次成房、无返工与星级奖励全部按稳定 ID 去重", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  const completedAt = "2026-08-31T08:00:00.000Z";
  const first = applyCompletionToRecords(defaultRecords(), {
    level,
    runId: RUN_ID_A,
    summary,
    elapsedMs: 12_345,
    completedAt,
  });
  ok(first.awardedIds.includes(`clear:${level.id}`));
  ok(first.awardedIds.includes(`first-draw:${level.id}`));
  ok(first.awardedIds.includes(`no-rework:${level.id}`));
  ok(first.awardedIds.includes(`rating:${level.id}:1`));
  ok(first.awardedIds.includes(`rating:${level.id}:2`));
  ok(first.awardedIds.includes(`rating:${level.id}:3`));
  for (const roomType of summary.roomTypes) ok(first.awardedIds.includes(`catalog:${roomType}`));
  strictEqual(new Set(first.awardedIds).size, first.awardedIds.length);
  equal(first.unlockedRoomTypes, summary.roomTypes);
  strictEqual(first.improvedRating, true);
  strictEqual(first.alreadySettled, false);
  strictEqual(first.records.completionCount, 1);
  strictEqual(first.records.bestTimes[level.id], 12_345);
  ok(first.records.settledRuns[RUN_ID_A], "首次结算必须按 runId 保存可回放结果");

  const duplicateSettlement = applyCompletionToRecords(first.records, {
    level,
    runId: RUN_ID_A,
    summary,
    elapsedMs: 20_000,
    completedAt: "2026-08-31T09:00:00.000Z",
  });
  strictEqual(duplicateSettlement.alreadySettled, true);
  equal(duplicateSettlement.records, first.records, "同 runId 重试不得再次增加本地计数");
  equal(duplicateSettlement.awardedIds, first.awardedIds, "重试必须回放首次 payload 的奖励 ID");
  equal(duplicateSettlement.unlockedRoomTypes, first.unlockedRoomTypes);
  strictEqual(duplicateSettlement.improvedRating, first.improvedRating);
  const otherLevel = LEVELS[1];
  const otherSummary = computeRunSummary(otherLevel, solveIntoState(otherLevel));
  throws(() => applyCompletionToRecords(first.records, {
    level: otherLevel,
    runId: RUN_ID_A,
    summary: otherSummary,
    elapsedMs: 10_000,
    completedAt: "2026-08-31T09:00:00.000Z",
  }), TypeError, "同 runId 不得改绑另一关");

  const second = applyCompletionToRecords(first.records, {
    level,
    runId: RUN_ID_B,
    summary,
    elapsedMs: 20_000,
    completedAt: "2026-08-31T09:00:00.000Z",
  });
  equal(second.awardedIds, [], "同一奖励不得再次映射全局 XP");
  equal(second.unlockedRoomTypes, []);
  strictEqual(second.improvedRating, false);
  strictEqual(second.records.completionCount, 2, "重玩次数仍应记录");
  strictEqual(second.records.completions[level.id].count, 2);
  ok(second.records.settledRuns[RUN_ID_B]);
  strictEqual(second.records.bestTimes[level.id], 12_345, "更慢重玩不得覆盖最佳用时");
  for (const roomType of summary.roomTypes) strictEqual(second.records.roomTypes[roomType].count, 2);
  const persisted = new MemoryStorage();
  ok(saveRecords(persisted, second.records));
  equal(loadRecords(persisted), second.records, "settledRuns 必须随长期记录完整往返");
});

test("本地结算拒绝缺少 runId、非法摘要、时长与时间戳", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  const valid = {
    level,
    runId: RUN_ID_A,
    summary,
    elapsedMs: 1000,
    completedAt: "2026-08-31T08:00:00.000Z",
  };
  throws(() => applyCompletionToRecords(defaultRecords(), { ...valid, runId: undefined }), TypeError);
  throws(() => applyCompletionToRecords(defaultRecords(), { ...valid, runId: "bad/value" }), TypeError);
  throws(() => applyCompletionToRecords(defaultRecords(), { ...valid, level: { ...level, id: "" } }), TypeError);
  throws(() => applyCompletionToRecords(defaultRecords(), { ...valid, summary: { ...summary, rating: 4 } }), TypeError);
  throws(() => applyCompletionToRecords(defaultRecords(), { ...valid, summary: { ...summary, roomTypes: "2×3" } }), TypeError);
  throws(() => applyCompletionToRecords(defaultRecords(), { ...valid, elapsedMs: -1 }), TypeError);
  throws(() => applyCompletionToRecords(defaultRecords(), { ...valid, completedAt: "not-a-date" }), TypeError);
});

test("完成 payload 包含 2.0 集成必需字段、稳定事件 ID 与去重奖励", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  const input = {
    level,
    runId: RUN_ID_A,
    summary,
    elapsedMs: 5432,
    rewardIds: ["rating:x:2", "clear:x", "rating:x:2"],
    completedAt: "2026-08-31T08:00:00.000Z",
  };
  const detail = createCompletionDetail(input);
  strictEqual(detail.schema, COMPLETION_SCHEMA);
  strictEqual(detail.schemaVersion, 1);
  strictEqual(detail.gameId, GAME_ID);
  strictEqual(detail.runId, RUN_ID_A);
  strictEqual(detail.levelId, level.id);
  strictEqual(detail.tier, ({ easy: 1, medium: 2, hard: 3 })[level.difficulty]);
  strictEqual(detail.moves, summary.moves);
  strictEqual(detail.par, level.clues.length);
  strictEqual(detail.elapsedMs, 5432);
  equal(detail.rewardIds, ["clear:x", "rating:x:2"]);
  strictEqual(detail.eventId, `${GAME_ID}:${RUN_ID_A}:complete`);
  ok(Object.isFrozen(detail));
  ok(Object.isFrozen(detail.rewardIds));
  ok(Object.isFrozen(detail.roomTypes));

  const sameVictory = createCompletionDetail({
    ...input,
    rewardIds: ["clear:x", "rating:x:2"],
    completedAt: "2027-01-01T00:00:00.000Z",
  });
  strictEqual(sameVictory.eventId, detail.eventId, "时间戳不得破坏同一胜利的去重标识");
  const nextRun = createCompletionDetail({ ...input, runId: RUN_ID_B });
  ok(nextRun.eventId !== detail.eventId, "同一题的不同运行必须有不同 eventId");
  throws(() => createCompletionDetail({ ...input, runId: undefined }), TypeError);
  throws(() => createCompletionDetail({ ...input, elapsedMs: 5432.9 }), TypeError);
});

test("完成 tier 将 easy、medium、hard 精确映射为全局奖励引擎的 1、2、3", () => {
  for (const [index, difficulty] of DIFFICULTIES.entries()) {
    const level = getLevels(difficulty)[0];
    const summary = computeRunSummary(level, solveIntoState(level));
    const detail = createCompletionDetail({
      level,
      runId: `run-tier-${difficulty}-20260831`,
      summary,
      elapsedMs: 0,
      rewardIds: [],
      completedAt: "2026-08-31T08:00:00.000Z",
    });
    strictEqual(detail.difficulty, difficulty);
    strictEqual(detail.tier, index + 1);
  }
});

test("完成 payload 构建与发布拒绝非法关卡、摘要、奖励、时间和伪造 eventId", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  const valid = {
    level,
    runId: RUN_ID_A,
    summary,
    elapsedMs: 1,
    rewardIds: [],
    completedAt: "2026-08-31T08:00:00.000Z",
  };
  throws(() => createCompletionDetail({ ...valid, level: { ...level, difficulty: "nightmare" } }), TypeError);
  throws(() => createCompletionDetail({ ...valid, level: { ...level, clues: [] } }), TypeError);
  throws(() => createCompletionDetail({ ...valid, summary: { ...summary, moves: -1 } }), TypeError);
  throws(() => createCompletionDetail({ ...valid, summary: { ...summary, oneStroke: "yes" } }), TypeError);
  throws(() => createCompletionDetail({ ...valid, summary: { ...summary, roomTypes: [3] } }), TypeError);
  throws(() => createCompletionDetail({ ...valid, elapsedMs: -1 }), TypeError);
  throws(() => createCompletionDetail({ ...valid, rewardIds: [null] }), TypeError);
  throws(() => createCompletionDetail({ ...valid, completedAt: "invalid" }), TypeError);

  const detail = createCompletionDetail(valid);
  strictEqual(publishCompletion({}, { ...detail, gameId: "other" }), false);
  strictEqual(publishCompletion({}, { ...detail, runId: "bad/value" }), false);
  strictEqual(publishCompletion({}, { ...detail, eventId: "forged" }), false);
  strictEqual(publishCompletion("not-a-target", detail), false);
});

test("通关同时接线 RealmArcade.complete 与 DOM CustomEvent", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  const detail = createCompletionDetail({ level, runId: RUN_ID_A, summary, elapsedMs: 1, rewardIds: [], completedAt: "2026-08-31T08:00:00.000Z" });
  const completed = [];
  const events = [];
  class FakeCustomEvent {
    constructor(type, init) { this.type = type; this.detail = init.detail; }
  }
  const target = {
    RealmArcade: { complete(payload) { completed.push(payload); } },
    CustomEvent: FakeCustomEvent,
    dispatchEvent(event) { events.push(event); return true; },
  };
  strictEqual(publishCompletion(target, detail), true);
  strictEqual(getCompletionTransport(target, detail.eventId), "realm-arcade");
  equal(completed, [detail]);
  strictEqual(target[COMPLETION_QUEUE], undefined, "已有共享 API 时不应重复入队");
  strictEqual(events.length, 1);
  strictEqual(events[0].type, COMPLETION_EVENT);
  strictEqual(events[0].detail, detail);
  strictEqual(publishCompletion(target, detail), true, "已 retained 的同一 eventId 应幂等确认成功");
  equal(completed, [detail]);
  strictEqual(events.length, 1, "去重事件也不得再次镜像派发");
});

test("共享 complete API 抛错时回落有界队列，仍只保留与镜像一次", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  class FakeCustomEvent {
    constructor(type, init) { this.type = type; this.detail = init.detail; }
  }
  for (const [index, apiName] of ["TenRealmsV2", "RealmArcade"].entries()) {
    const detail = createCompletionDetail({
      level,
      runId: `run-api-failure-${index}-20260831`,
      summary,
      elapsedMs: 1,
      rewardIds: [],
      completedAt: "2026-08-31T08:00:00.000Z",
    });
    let calls = 0;
    const events = [];
    const target = {
      [apiName]: { complete() { calls += 1; throw new Error("host unavailable"); } },
      CustomEvent: FakeCustomEvent,
      dispatchEvent(event) { events.push(event); return true; },
    };
    strictEqual(publishCompletion(target, detail), true, `${apiName} 失败后入队仍算已保留`);
    strictEqual(getCompletionTransport(target, detail.eventId), "queue");
    strictEqual(calls, 1);
    equal(target[COMPLETION_QUEUE], [detail]);
    strictEqual(events.length, 1);
    strictEqual(events[0].detail, detail);
    strictEqual(publishCompletion(target, detail), true, "重试已入队事件应返回 retained");
    strictEqual(calls, 1, "去重应在调用故障 API 之前生效");
    equal(target[COMPLETION_QUEUE], [detail]);
    strictEqual(events.length, 1);
  }
});

test("共享 API 尚未加载时完成 payload 进入标准队列且不会无界增长", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  const target = {};
  for (let index = 0; index < 105; index += 1) {
    const detail = createCompletionDetail({
      level,
      runId: `run-20260831-queue-${String(index).padStart(3, "0")}`,
      summary: { ...summary, moves: summary.moves + index },
      elapsedMs: index,
      rewardIds: [],
      completedAt: "2026-08-31T08:00:00.000Z",
    });
    strictEqual(publishCompletion(target, detail), true, "入队已安全保留完成事件");
  }
  strictEqual(COMPLETION_QUEUE, "__realmCompletionQueue");
  strictEqual(target[COMPLETION_QUEUE].length, 100);
  strictEqual(target[COMPLETION_QUEUE][0].moves, summary.moves + 5);
  strictEqual(target[COMPLETION_QUEUE].at(-1).moves, summary.moves + 104);
  strictEqual(getCompletionTransport(target, target[COMPLETION_QUEUE].at(-1).eventId), "queue");
  strictEqual(publishCompletion(null, target[COMPLETION_QUEUE][0]), false);
});

test("预置队列已含 eventId 时不重复调 API、入队或派发镜像事件", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  const detail = createCompletionDetail({
    level,
    runId: RUN_ID_A,
    summary,
    elapsedMs: 1,
    rewardIds: [],
    completedAt: "2026-08-31T08:00:00.000Z",
  });
  let apiCalls = 0;
  let eventCalls = 0;
  const earlier = Array.from({ length: 105 }, (_, index) => createCompletionDetail({
    level,
    runId: `run-prequeued-${String(index).padStart(3, "0")}-20260831`,
    summary,
    elapsedMs: index,
    rewardIds: [],
    completedAt: "2026-08-31T08:00:00.000Z",
  }));
  const target = {
    [COMPLETION_QUEUE]: [...earlier, detail, structuredClone(detail)],
    RealmArcade: { complete() { apiCalls += 1; } },
    CustomEvent: class {},
    dispatchEvent() { eventCalls += 1; },
  };
  strictEqual(publishCompletion(target, detail), true);
  strictEqual(getCompletionTransport(target, detail.eventId), "queue");
  strictEqual(apiCalls, 0);
  strictEqual(eventCalls, 0);
  strictEqual(target[COMPLETION_QUEUE].length, 100);
  strictEqual(target[COMPLETION_QUEUE].at(-1), detail);
  strictEqual(target[COMPLETION_QUEUE].filter((item) => item.eventId === detail.eventId).length, 1);
});

test("宿主 complete 同步重入 publishCompletion 时，调用前去重锁阻止二次传输", () => {
  const level = LEVELS[0];
  const summary = computeRunSummary(level, solveIntoState(level));
  const detail = createCompletionDetail({
    level,
    runId: RUN_ID_B,
    summary,
    elapsedMs: 1,
    rewardIds: [],
    completedAt: "2026-08-31T08:00:00.000Z",
  });
  let apiCalls = 0;
  let nestedResult = null;
  let events = 0;
  const target = {
    RealmArcade: {
      complete() {
        apiCalls += 1;
        nestedResult = publishCompletion(target, detail);
      },
    },
    CustomEvent: class {
      constructor(type, init) { this.type = type; this.detail = init.detail; }
    },
    dispatchEvent() { events += 1; },
  };
  strictEqual(publishCompletion(target, detail), true);
  strictEqual(nestedResult, false);
  strictEqual(apiCalls, 1);
  strictEqual(events, 1);
  strictEqual(getCompletionTransport(target, detail.eventId), "realm-arcade");
  strictEqual(publishCompletion(target, detail), true);
});

test("刷新可从 pending session 幂等重建原奖励 payload，成功交付后持久化 delivered", () => {
  const level = LEVELS[0];
  const game = solveIntoState(level);
  const summary = computeRunSummary(level, game);
  const completedAt = "2026-08-31T10:00:00.000Z";
  const pending = { completedAt, delivered: false };
  const storage = new MemoryStorage();
  const session = {
    level,
    runId: RUN_ID_A,
    game,
    history: [],
    tool: TOOL_TYPES.ROOM,
    cursor: { x: 0, y: 0 },
    elapsedMs: 18_000,
    completion: pending,
  };
  ok(saveSession(storage, session));

  const firstSettlement = applyCompletionToRecords(defaultRecords(), {
    level,
    runId: RUN_ID_A,
    summary,
    elapsedMs: session.elapsedMs,
    completedAt,
  });
  strictEqual(firstSettlement.alreadySettled, false);
  ok(firstSettlement.awardedIds.length > 0);
  ok(saveRecords(storage, firstSettlement.records));
  const firstDetail = createCompletionDetail({
    level,
    runId: RUN_ID_A,
    summary,
    elapsedMs: session.elapsedMs,
    rewardIds: firstSettlement.awardedIds,
    completedAt,
  });

  let failedApiCalls = 0;
  const unavailableTarget = {
    RealmArcade: {
      complete() {
        failedApiCalls += 1;
        throw new Error("offline");
      },
    },
  };
  Object.defineProperty(unavailableTarget, COMPLETION_QUEUE, {
    configurable: true,
    get() { return []; },
    set() { throw new Error("queue is read-only"); },
  });
  strictEqual(publishCompletion(unavailableTarget, firstDetail), false);
  strictEqual(getCompletionTransport(unavailableTarget, firstDetail.eventId), null);
  strictEqual(failedApiCalls, 1);
  ok(saveSession(storage, { ...session, completion: pending }), "交付失败后仍必须保留 pending");

  // Simulate a page refresh using only serialized state, not retained objects.
  const refreshedSession = loadSession(storage, getLevel);
  const refreshedRecords = loadRecords(storage);
  equal(refreshedSession.completion, pending);
  strictEqual(analyzeBoard(refreshedSession.level, refreshedSession.game).solved, true);
  const refreshedSummary = computeRunSummary(refreshedSession.level, refreshedSession.game);
  const replay = applyCompletionToRecords(refreshedRecords, {
    level: refreshedSession.level,
    runId: refreshedSession.runId,
    summary: refreshedSummary,
    elapsedMs: refreshedSession.elapsedMs,
    completedAt: refreshedSession.completion.completedAt,
  });
  strictEqual(replay.alreadySettled, true);
  equal(replay.records, refreshedRecords, "刷新重试不得重复本地结算");
  equal(replay.awardedIds, firstSettlement.awardedIds);
  equal(replay.unlockedRoomTypes, firstSettlement.unlockedRoomTypes);
  strictEqual(replay.improvedRating, firstSettlement.improvedRating);

  const replayDetail = createCompletionDetail({
    level: refreshedSession.level,
    runId: refreshedSession.runId,
    summary: refreshedSummary,
    elapsedMs: refreshedSession.elapsedMs,
    rewardIds: replay.awardedIds,
    completedAt: refreshedSession.completion.completedAt,
  });
  equal(replayDetail, firstDetail, "待交付 payload 必须在刷新后精确重建");

  const queueOnlyTarget = {};
  const queueRetained = publishCompletion(queueOnlyTarget, replayDetail);
  const queueTransport = getCompletionTransport(queueOnlyTarget, replayDetail.eventId);
  strictEqual(queueRetained, true, "无共享 API 时应先将完成事件保留在队列");
  strictEqual(queueTransport, "queue");
  const queueDelivered = queueRetained
    && (queueTransport === "native-v2" || queueTransport === "realm-arcade")
    && true;
  strictEqual(queueDelivered, false, "仅入队不得被标记为已交付");
  ok(saveSession(storage, {
    ...refreshedSession,
    completion: { completedAt, delivered: queueDelivered },
  }));
  equal(loadSession(storage, getLevel).completion, pending, "队列保留后刷新仍必须重试 API 交付");

  const deliveredPayloads = [];
  const availableTarget = {
    RealmArcade: { complete(detail) { deliveredPayloads.push(detail); } },
  };
  const apiRetained = publishCompletion(availableTarget, replayDetail);
  const apiTransport = getCompletionTransport(availableTarget, replayDetail.eventId);
  strictEqual(apiRetained, true);
  strictEqual(apiTransport, "realm-arcade");
  equal(deliveredPayloads, [replayDetail]);

  const delivered = {
    completedAt,
    delivered: apiRetained
      && (apiTransport === "native-v2" || apiTransport === "realm-arcade"),
  };
  strictEqual(delivered.delivered, true);
  ok(saveSession(storage, { ...refreshedSession, completion: delivered }));
  equal(loadSession(storage, getLevel).completion, delivered);
  equal(loadRecords(storage), firstSettlement.records, "交付成功不得再改写本地结算");
});

test("游戏 API 以 dream-hotel 命名空间安装且保留其他 2.0 游戏", () => {
  const calls = [];
  const existing = Object.freeze({ gameId: "other" });
  const target = { TenRealmsV2Games: { other: existing } };
  const api = installGameApi(target, {
    getSnapshot: () => ({ levelId: "a" }),
    getRecords: () => ({ count: 2 }),
    openTutorial: () => calls.push("tutorial"),
    setDifficulty: (difficulty) => calls.push(difficulty),
    newPuzzle: () => calls.push("next"),
  });
  strictEqual(target.TenRealmsV2Games.other, existing);
  strictEqual(target.TenRealmsV2Games[GAME_ID], api);
  strictEqual(api.apiVersion, 1);
  strictEqual(api.gameId, GAME_ID);
  equal(api.getSnapshot(), { levelId: "a" });
  equal(api.getRecords(), { count: 2 });
  api.openTutorial();
  api.setDifficulty("hard");
  api.newPuzzle();
  equal(calls, ["tutorial", "hard", "next"]);
  ok(Object.isFrozen(api));
});

test("模态以 showModal 隔离背景、首次聚焦并在关闭后恢复触发器", () => {
  const fixture = createFocusFixture();
  fixture.setActive(fixture.trigger);
  strictEqual(fixture.controller.open(), true);
  strictEqual(fixture.dialog.open, true);
  strictEqual(fixture.controller.isOpen(), true);
  strictEqual(fixture.controller.open(), false, "已打开的模态不得重入");
  fixture.flush();
  strictEqual(fixture.getActive(), fixture.controls[0]);
  equal(fixture.focusLog.at(-1).options, { preventScroll: true });

  strictEqual(fixture.controller.close("done"), true);
  strictEqual(fixture.dialog.open, false);
  strictEqual(fixture.controller.lastReason(), "done");
  fixture.flush();
  strictEqual(fixture.getActive(), fixture.trigger);
  strictEqual(fixture.controller.close(), false);
});

test("模态 Tab 聚焦在内部首尾循环，cancel 与背景点击可控关闭", () => {
  const fixture = createFocusFixture();
  fixture.controller.open(fixture.trigger);
  fixture.flush();

  fixture.setActive(fixture.controls.at(-1));
  let prevented = false;
  fixture.dialog.emit("keydown", { key: "Tab", shiftKey: false, preventDefault() { prevented = true; } });
  strictEqual(prevented, true);
  strictEqual(fixture.getActive(), fixture.controls[0]);

  fixture.setActive(fixture.controls[0]);
  prevented = false;
  fixture.dialog.emit("keydown", { key: "Tab", shiftKey: true, preventDefault() { prevented = true; } });
  strictEqual(prevented, true);
  strictEqual(fixture.getActive(), fixture.controls.at(-1));

  let cancelPrevented = false;
  fixture.dialog.emit("cancel", { preventDefault() { cancelPrevented = true; } });
  strictEqual(cancelPrevented, true);
  strictEqual(fixture.dialog.open, false);
  strictEqual(fixture.controller.lastReason(), "cancel");
  fixture.flush();
  strictEqual(fixture.getActive(), fixture.trigger);

  fixture.controller.open(fixture.trigger);
  fixture.flush();
  fixture.dialog.emit("click", { target: fixture.dialog });
  strictEqual(fixture.dialog.open, false);
  strictEqual(fixture.controller.lastReason(), "backdrop");

  const locked = createFocusFixture({ dismissOnBackdrop: false });
  locked.controller.open(locked.trigger);
  locked.flush();
  locked.dialog.emit("click", { target: locked.dialog });
  strictEqual(locked.dialog.open, true, "胜利模态可禁止背景误触关闭");
});

test("无内部控件的模态仍将焦点留在 dialog 本身", () => {
  const fixture = createFocusFixture({ focusableCount: 0 });
  fixture.controller.open(fixture.trigger);
  fixture.flush();
  strictEqual(fixture.getActive(), fixture.dialog);
  let prevented = false;
  fixture.dialog.emit("keydown", { key: "Tab", preventDefault() { prevented = true; } });
  strictEqual(prevented, true);
  strictEqual(fixture.getActive(), fixture.dialog);
});

test("延迟胜利调度可取消、不重入，且只在原 generation 与原关卡仍完成时显示", () => {
  const context = { generation: 1, levelId: "floor-a", completed: true };
  const callbacks = new Map();
  const delays = new Map();
  const cleared = [];
  const shown = [];
  let nextHandle = 1;
  const scheduler = createVictoryScheduler({
    readContext: () => ({ ...context }),
    onShow: (payload) => shown.push(payload),
    setTimer(callback, delay) {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      delays.set(handle, delay);
      return handle;
    },
    clearTimer(handle) {
      cleared.push(handle);
      callbacks.delete(handle);
    },
  });

  const firstExpected = scheduler.schedule({ id: "first" });
  equal(firstExpected, context);
  strictEqual(scheduler.pending(), true);
  strictEqual(delays.get(1), 220);
  scheduler.schedule({ id: "replacement" }, 50);
  equal(cleared, [1], "新的 pending 胜利必须取消旧计时器");
  strictEqual(delays.get(2), 50);
  callbacks.get(2)();
  equal(shown, [{ id: "replacement" }]);
  strictEqual(scheduler.pending(), false);
  strictEqual(scheduler.cancel(), false);

  scheduler.schedule({ id: "cancelled" });
  strictEqual(scheduler.cancel(), true);
  strictEqual(scheduler.pending(), false);
  strictEqual(scheduler.cancel(), false);
});

test("generation、levelId 或 completed 变化时，旧胜利回调即使被调用也必须忽略", () => {
  for (const mutate of [
    (context) => { context.generation += 1; },
    (context) => { context.levelId = "floor-b"; },
    (context) => { context.completed = false; },
  ]) {
    const context = { generation: 8, levelId: "floor-a", completed: true };
    const shown = [];
    let pendingCallback = null;
    const scheduler = createVictoryScheduler({
      readContext: () => ({ ...context }),
      onShow: (payload) => shown.push(payload),
      setTimer(callback) { pendingCallback = callback; return 1; },
      clearTimer() {},
    });
    scheduler.schedule({ id: "stale" });
    mutate(context);
    pendingCallback();
    equal(shown, []);
    strictEqual(scheduler.pending(), false);
  }
  throws(() => createVictoryScheduler(), TypeError);
});

test("HTML 语义、本地资源、返回路径与规则源流接线完整", () => {
  match(html, /<html\s+lang="zh-CN"\s+data-realm="dream-hotel">/);
  match(html, /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  match(html, /<script\s+type="module"\s+src="\.\.\/\.\.\/shared\/realm-ui\.mjs"><\/script>/);
  match(html, /<script\s+type="module"\s+src="\.\/app\.mjs"><\/script>/);
  match(html, /<link\s+rel="stylesheet"\s+href="\.\.\/\.\.\/shared\/realm-ui\.css">/);
  match(html, /<link\s+rel="stylesheet"\s+href="\.\/styles\.css">/);
  ok(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"), "共享成长层必须先于游戏应用加载");
  doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)="https?:/i, "运行时不得依赖 CDN");
  ok((html.match(/href="\.\.\/\.\.\/"/g) ?? []).length >= 2, "顶部与页脚都应返回 /v2/");
  match(html, /id="game-board"[\s\S]*?role="grid"[\s\S]*?tabindex="0"/);
  match(html, /aria-describedby="board-instructions board-summary"/);
  match(html, /<main>/);
  match(html, /<nav\b[^>]*aria-label="游戏设置"/);
  match(html, /<dialog\b[^>]*id="tutorial-dialog"/);
  match(html, /<dialog\b[^>]*id="rules-dialog"/);
  match(html, /<dialog\b[^>]*id="victory-dialog"/);
  match(html, /https:\/\/puzzles\.ebnbin\.dev\/doc\/zh\/rect\.html/);
  match(html, /https:\/\/github\.com\/ebnbin\/puzzles\/blob\/main\/src\/games\/rect\.ts/);
  match(html, /THIRD_PARTY_NOTICES\.md/);
  match(html, /MIT 第三方声明/);
  for (const phrase of ["每房恰含一个数字", "面积必须等于数字", "整层无缝覆盖", "客房不可重叠"]) {
    ok(html.includes(phrase), `规则弹窗必须明示：${phrase}`);
  }
});

test("HTML 的 id 唯一，App 查询的所有静态元素都真实存在", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((matchResult) => matchResult[1]);
  strictEqual(new Set(ids).size, ids.length, "重复 id 会破坏 UI 与可访问性接线");
  const queriedIds = [...app.matchAll(/\$\("#([a-z0-9-]+)"\)/gi)].map((matchResult) => matchResult[1]);
  for (const id of queriedIds) ok(ids.includes(id), `app.mjs 查询的 #${id} 必须在 HTML 中`);
  for (const tag of html.matchAll(/<button\b[^>]*>/gi)) match(tag[0], /\btype="button"/, "按钮不得意外提交表单");
});

test("主界面完整接线拖拽预览、触控捕获、键盘、撤销、重开、换题与静音", () => {
  for (const eventName of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
    ok(app.includes(`addEventListener("${eventName}"`), `缺少 ${eventName} 接线`);
  }
  match(app, /setPointerCapture\?\.\(event\.pointerId\)/);
  match(app, /releasePointerCapture\?\.\(event\.pointerId\)/);
  match(app, /function pointForCell\(cell\)[\s\S]*?Number\.isInteger\(point\.x\)\s*&&\s*Number\.isInteger\(point\.y\)/);
  match(app, /function cellFromPointer\(event\)[\s\S]*?getBoundingClientRect\(\)/);
  match(app, /event\.clientX < bounds\.left \|\| event\.clientX >= bounds\.right[\s\S]*?event\.clientY < bounds\.top \|\| event\.clientY >= bounds\.bottom/);
  match(app, /document\.elementFromPoint\(event\.clientX, event\.clientY\)\?\.closest\?\.\("\.grid-cell"\)/);
  match(app, /hit && elements\.board\.contains\(hit\)/);
  match(app, /for \(const cell of elements\.board\.querySelectorAll\("\.grid-cell"\)\)/);
  match(app, /const distance = dx \* dx \+ dy \* dy/);
  strictEqual((app.match(/const point = cellFromPointer\(event\);/g) ?? []).length, 3, "pointerdown/move/up 必须共用精确命中函数");
  match(app, /event\.isPrimary === false/);
  match(app, /event\.button !== 0/);
  match(app, /commitRectangle\(normalizeRect\(selection\.start, point\)\)/);
  match(app, /analyzeProposal\(state\.level, state\.game, rect, state\.tool\)/);
  match(app, /className = "selection-preview"/);
  match(app, /preview\.dataset\.valid = String\(proposal\.valid\)/);
  match(app, /elements\.undoButton\.addEventListener\("click", undo\)/);
  match(app, /elements\.restartButton\.addEventListener\("click", restart\)/);
  match(app, /elements\.nextButton\.addEventListener\("click", chooseNextLevel\)/);
  match(app, /elements\.muteButton\.addEventListener\("click", toggleMute\)/);
  for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Enter", "Escape", "Delete", "Backspace"]) {
    ok(app.includes(`"${key}"`), `键盘接线缺少 ${key}`);
  }
  match(app, /if \(openDialogs\(\)\.length \|\| event\.defaultPrevented \|\| event\.isComposing\) return;/);
  match(app, /if \(event\.repeat && !isArrow\) return;/, "只允许方向键安全连续移动");
  match(app, /if \(event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey\) return;/);
  match(app, /if \(!boardFocused \|\| isInteractiveTarget\) return;/);
  match(app, /target\.closest\("input, textarea, select, button, a, summary, \[contenteditable\], \[role='button'\], \[role='link'\]"\)/);
  match(app, /window\.AudioContext \|\| window\.webkitAudioContext/);
  match(app, /createOscillator\(\)/);
  match(app, /createGain\(\)/);
  match(app, /saveCurrentSession\(\)/);
  match(app, /saveCurrentSettings\(\)/);
});

test("完成只上报一次，并暴露后续 v2/shared 可接入的 API", () => {
  match(app, /runId:\s*restored\?\.runId \?\? createRunId\(\)/);
  match(app, /saveSession\(storage, \{\s*level: state\.level,\s*runId: state\.runId,/s);
  ok((app.match(/state\.runId = createRunId\(\)/g) ?? []).length >= 2, "重开与换题必须创建新 runId");
  match(app, /if \(state\.completed \|\| state\.completionReported\) return false;/);
  match(app, /state\.completed = true;/);
  match(app, /applyCompletionToRecords\(records,/);
  match(app, /createCompletionDetail\(\{\s*level: state\.level,\s*runId: state\.runId,/s);
  match(app, /publishCompletion\(window, detail\)/);
  strictEqual((app.match(/publishCompletion\(window, detail\)/g) ?? []).length, 1);
  match(app, /installGameApi\(window,/);
  match(completionSource, /target\.RealmArcade\?\.complete/);
  match(completionSource, /target\[COMPLETION_QUEUE\]/);
  match(completionSource, /publishedByTarget = new WeakMap\(\)/);
  match(completionSource, /const RETAINED_TRANSPORTS = new Set\(\["native-v2", "realm-arcade", "queue"\]\)/);
  match(completionSource, /if \(RETAINED_TRANSPORTS\.has\(priorStatus\)\) return true/);
  match(completionSource, /if \(priorStatus === "in-flight"\) return false/);
  match(completionSource, /eventStates\.set\(detail\.eventId, "in-flight"\)/);
  match(completionSource, /catch \{\s*retained = queue\(\);\s*if \(retained\) transport = "queue";\s*\}/s);
  match(completionSource, /export function getCompletionTransport\(target, eventId\)/);
  match(completionSource, /return RETAINED_TRANSPORTS\.has\(status\) \? status : null/);
  match(completionSource, /new EventClass\(COMPLETION_EVENT, \{ detail \}\)/);
});

test("应用层先持久化 pending，本地结算幂等，交付确认后再刷新 session", () => {
  match(app, /completionReported:\s*Boolean\(restoredAnalysis\?\.solved && restored\?\.completion\?\.delivered\)/);
  match(app, /completion:\s*restoredAnalysis\?\.solved \? restored\?\.completion \?\? null : null/);
  match(app, /saveSession\(storage, \{[\s\S]*?completion:\s*state\.completion,/);
  match(app, /function settleCompletion\([^)]*\) \{[\s\S]*?state\.completion \?\?= \{ completedAt: new Date\(\)\.toISOString\(\), delivered: false \};/);
  match(app, /state\.completion \?\?=[\s\S]*?saveCurrentSession\(\);[\s\S]*?applyCompletionToRecords\(records, \{\s*level: state\.level,\s*runId: state\.runId,/s);
  match(app, /const recordsSaved = saveRecords\(storage, records\)/);
  match(app, /const retained = publishCompletion\(window, detail\)/);
  match(app, /const completionTransport = getCompletionTransport\(window, detail\.eventId\)/);
  match(app, /const apiDelivered = completionTransport === "native-v2" \|\| completionTransport === "realm-arcade"/);
  match(app, /state\.completion\.delivered = retained && apiDelivered && \(recordsSaved \|\| storage === null\)/);
  match(app, /state\.completionReported = state\.completion\.delivered;[\s\S]*?saveCurrentSession\(\)/);
  match(app, /if \(state\.completed && !state\.completionReported\) settleCompletion\(\)/, "恢复待交付局面必须重试");
  ok((app.match(/state\.completion = null/g) ?? []).length >= 2, "重开与换题必须清除上一 run 交付标记");
});

test("应用层将胜利延迟回调与 generation、关卡切换及教程/规则模态互斥", () => {
  match(app, /const victoryScheduler = createVictoryScheduler\(\{/);
  match(app, /generation:\s*state\.generation,\s*levelId:\s*state\.level\.id,\s*completed:\s*state\.completed/s);
  match(app, /victoryScheduler\.schedule\(\{ summary, recordResult, duration: completedDuration \}\)/);
  match(app, /function restart\(\) \{\s*clearPendingVictory\(\);\s*state\.generation \+= 1;/s);
  match(app, /function startLevel\(level,[^)]*\) \{[\s\S]*?clearPendingVictory\(\);\s*state\.generation \+= 1;/);
  match(app, /function openTutorial\([^)]*\) \{\s*(?:clearPendingVictory\(\);|if \(victoryScheduler\.pending\(\)\) return false;)/s);
  match(app, /function openRules\([^)]*\) \{\s*(?:clearPendingVictory\(\);|if \(victoryScheduler\.pending\(\)\) return false;)/s);
});

test("首次教程自动打开、可跳过与重看，三张卡片使用三个独立素材", () => {
  strictEqual((html.match(/id="tutorial-image"/g) ?? []).length, 1, "不可叠放多张前后状态图");
  for (const file of tutorialFiles) {
    strictEqual((app.match(new RegExp(file.replace(".", "\\."), "g")) ?? []).length, 1, `${file} 应恰好是一张卡`);
  }
  match(app, /elements\.tutorialImage\.src = card\.image/);
  match(app, /elements\.tutorialSkip\.addEventListener\("click"/);
  match(app, /elements\.tutorialButton\.addEventListener\("click"/);
  match(app, /if \(!tutorialSeen\(storage\)\)/);
  match(app, /openTutorial\(elements\.tutorialButton\)/);
  match(app, /markTutorialSeen\(storage\)/);
  match(html, /id="tutorial-counter">1 \/ 3/);
  match(html, /id="tutorial-skip"/);
  match(html, /src="\.\/assets\/tutorial-elements\.svg\?tutorial=2"/, "HTML fallback must bypass the old tutorial image cache");
  const versionedTutorialImages = [...app.matchAll(/image:\s*"\.\/assets\/(tutorial-[^"?]+\.svg)\?tutorial=2"/g)]
    .map((match) => match[1]);
  equal(versionedTutorialImages, tutorialFiles, "每张新版教程图都必须使用同一缓存版本标识");
  match(html, /<script\s+type="module"\s+src="\.\/app\.mjs"><\/script>/, "游戏入口脚本必须保持规范路径");
});

test("三张教程 SVG 均独立、可访问且保持完整宽高比", () => {
  strictEqual(new Set(tutorialSvgs.map(({ source }) => source)).size, 3);
  for (const { name, source } of tutorialSvgs) {
    match(source, /<svg\b[^>]*viewBox="0 0 320 184"[^>]*preserveAspectRatio="xMidYMid meet"/i, `${name} 须保持居中完整显示`);
    match(source, /role="img"/);
    match(source, /aria-labelledby="title description"/);
    match(source, /<title\s+id="title">[^<]+<\/title>/);
    match(source, /<desc\s+id="description">[^<]+<\/desc>/);
    doesNotMatch(source, /<image\b/i, `${name} 不得内嵌另一张前后状态图`);
    doesNotMatch(source, /tutorial-(?:elements|action|goal)\.svg/i, `${name} 不得引用其他教程卡`);
    strictEqual((source.match(/<svg\b/gi) ?? []).length, 1, `${name} 必须是独立 SVG 文档`);
  }
  strictEqual(tutorialSvgs.every(({ source }) => source.includes('data-level-id="lullaby-lobby"')), true,
    "三张卡必须来自正式首关摇篮前厅");
  match(tutorialSvgs[0].source, /data-tutorial-scene="elements"[^>]*data-state="initial"/);
  match(tutorialSvgs[0].source, /data-board-size="5x5"/);
  match(tutorialSvgs[1].source, /data-tutorial-scene="operation"[^>]*data-state="intermediate"/);
  match(tutorialSvgs[1].source, /data-preview-room="0,0,3,2"/);
  match(tutorialSvgs[2].source, /data-tutorial-scene="goal"[^>]*data-state="solved"/);
  match(tutorialSvgs[2].source, /data-solution="0,0,3,2;0,2,3,1;0,3,1,2;1,3,2,2;3,0,2,2;3,2,2,3"/);
  const tutorialAttribute = (source, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(source)?.[1] ?? null;
  const tutorialLevel = getLevel("lullaby-lobby");
  const picturedClues = tutorialAttribute(tutorialSvgs[0].source, "data-clues").split(";");
  equal([...picturedClues].sort(), tutorialLevel.clues.map(({ x, y, value }) => `${x},${y},${value}`).sort(),
    "元素卡必须使用正式首关全部数字及坐标");
  const previewValues = tutorialAttribute(tutorialSvgs[1].source, "data-preview-room").split(",").map(Number);
  const previewRoom = { x: previewValues[0], y: previewValues[1], width: previewValues[2], height: previewValues[3] };
  const previewAnalysis = analyzeProposal(tutorialLevel, createGameState(), previewRoom);
  strictEqual(previewAnalysis.valid, true, "操作卡的三乘二预览必须能由真实关卡提交");
  strictEqual(rectangleArea(previewAnalysis.rect), 6);
  strictEqual(previewAnalysis.clue.value, 6);
  const picturedRooms = tutorialAttribute(tutorialSvgs[2].source, "data-solution").split(";").map((room) => {
    const [x, y, width, height] = room.split(",").map(Number);
    return { x, y, width, height };
  });
  equal(solutionKeys(picturedRooms), solutionKeys(tutorialLevel.solution), "通关图的六间房必须等于作者分区");
  strictEqual(analyzeRooms(tutorialLevel, picturedRooms).solved, true, "通关图必须通过真实无缝覆盖判定");
  const picturedScenes = tutorialAttribute(tutorialSvgs[2].source, "data-scenes");
  const expectedScenes = picturedRooms.map((room) => {
    const scene = sceneForLevel(tutorialLevel.id, room);
    return `${rectKey(room)}=${scene.name},${scene.glyph},${scene.color}`;
  }).join(";");
  strictEqual(picturedScenes, expectedScenes, "通关图每间房的名称、图标与颜色必须等于真实 sceneFor 映射");
  match(app, /sceneForLevel\(state\.level\.id, room\)/, "正式游戏与教程测试必须共享同一纯主题映射");
  const tutorialImageRule = cssRule(".tutorial-visual img");
  match(tutorialImageRule, /object-fit:\s*contain/);
  match(tutorialImageRule, /aspect-ratio:\s*320\s*\/\s*184/);
});

test("规则信息在小格中优先显示，错误、候选与排除不只依赖颜色", () => {
  match(cssRule(".grid-cell.has-clue"), /z-index:\s*8/);
  match(css, /\.room-layer,\s*\.candidate-layer,\s*\.selection-preview,\s*\.keyboard-cursor\s*\{[^}]*z-index:\s*4/s);
  match(cssRule(".clue"), /z-index:\s*8/);
  match(cssRule(".room-layer"), /border:\s*3px\s+solid/);
  match(cssRule(".candidate-layer"), /border:\s*2px\s+dashed/);
  match(cssRule(".grid-cell.is-excluded::after"), /content:\s*"×"/);
  match(cssRule('.selection-preview[data-valid="false"]'), /border-style:\s*double/);
  match(cssRule('.selection-preview[data-valid="false"]'), /repeating-linear-gradient/);
  match(cssRule(".preview-label"), /text-overflow:\s*ellipsis/);
  match(cssRule(".room-caption"), /text-overflow:\s*ellipsis/);
});

test("主要交互目标至少 44px，对话框不被视口裁切", () => {
  match(css, /button,\s*select,\s*summary\s*\{[^}]*min-height:\s*44px/s);
  match(cssRule(".back-link"), /min-height:\s*48px/);
  match(css, /footer:not\(\.tutorial-footer\) nav a,\s*footer:not\(\.tutorial-footer\) nav button\s*\{[^}]*min-height:\s*44px/s);
  match(cssRule(".dialog-topline button"), /min-height:\s*44px/);
  match(cssRule(".dialog-close"), /min-width:\s*44px/);
  match(cssRule(".source-card a"), /min-height:\s*44px/);
  const dialogRule = cssRule("dialog");
  match(dialogRule, /max-height:\s*min\(760px,\s*calc\(100dvh - 24px\)\)/);
  match(dialogRule, /overflow:\s*auto/);
});

test("320px、390px、平板与桌面断点均有无横向溢出的收缩约束", () => {
  match(cssRule("html"), /min-width:\s*0/);
  match(cssRule("body"), /min-width:\s*0/);
  match(cssRule("body"), /overflow-x:\s*hidden/);
  match(css, /\*\s*\{\s*box-sizing:\s*border-box;/);
  match(cssRule(".game-layout"), /minmax\(0,\s*1\.65fr\)/);
  match(cssRule(".board-panel"), /min-width:\s*0/);
  match(cssRule(".hotel-grid"), /grid-template-columns:\s*repeat\(var\(--cols\),\s*minmax\(0,\s*1fr\)\)/);
  match(cssRule(".hotel-grid"), /width:\s*min\(100%,\s*620px\)/);
  match(cssRule(".hotel-grid"), /touch-action:\s*none/);
  doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/, "页面和棋盘都不得依赖横向滚动");
  for (const breakpoint of [980, 700, 520, 350]) match(css, new RegExp(`@media \\(max-width: ${breakpoint}px\\)`));
  match(css, /@media \(max-width: 520px\)[\s\S]*?main,\s*[\s\S]*?footer:not\(\.tutorial-footer\)\s*\{[^}]*width:\s*min\(100% - 8px,\s*1240px\)/);
  match(css, /@media \(max-width: 520px\)[\s\S]*?\.board-panel\s*\{[^}]*padding:\s*8px/);
  match(css, /@media \(max-width: 520px\)[\s\S]*?\.floor-stage\s*\{[^}]*padding:\s*5px/);
  match(css, /@media \(max-width: 520px\)[\s\S]*?\.floor-sign\s*\{[^}]*display:\s*none/);
  match(css, /@media \(max-width: 350px\)[\s\S]*?main,\s*[\s\S]*?footer:not\(\.tutorial-footer\)\s*\{[^}]*width:\s*min\(100% - 4px,\s*1240px\)/);
  match(css, /@media \(max-width: 350px\)[\s\S]*?\.clue\s*\{[^}]*min-width:\s*20px[^}]*font-size:\s*0\.76rem/);
  match(css, /@media \(max-width: 520px\)[\s\S]*?dialog\s*\{[^}]*width:\s*calc\(100% - 16px\)[^}]*max-height:\s*calc\(100dvh - 16px\)/);
});

test("动画在 reduced-motion 下全面收敛，棋盘完成与错误边界仍清晰", () => {
  match(css, /@media \(prefers-reduced-motion: reduce\)/);
  match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration:\s*0\.01ms\s*!important/);
  match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-iteration-count:\s*1\s*!important/);
  match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration:\s*0\.01ms\s*!important/);
  match(css, /\.hotel-grid\.is-complete\s+\.room-layer\s*\{/);
  match(css, /\.hotel-grid\.is-error\s*\{/);
  match(css, /@media \(forced-colors: active\)/);
});

test("长期激励在 UI 中可见，教程、规则和胜利模态都由焦点控制器托管", () => {
  for (const phrase of ["梦境房型图鉴", "一次成房", "无返工规划", "三星旅舍", "旅舍总评"]) {
    ok(html.includes(phrase), `UI 必须显示长期目标：${phrase}`);
  }
  match(app, /const tutorialController = createModalController/);
  match(app, /const rulesController = createModalController/);
  match(app, /const victoryController = createModalController/);
  match(app, /dismissOnBackdrop:\s*false/);
  match(html, /id="toast"\s+aria-hidden="true"/);
  match(html, /id="polite-live"\s+role="status"\s+aria-live="polite"\s+aria-atomic="true"/);
  match(html, /role="alert"\s+aria-live="assertive"/);
  match(app, /politeLive:\s*\$\("#polite-live"\)/);
  match(app, /const target = assertive \? elements\.alertLive : elements\.politeLive/);
  match(app, /announce\(message, assertive\)/);
  match(html, /class="skip-link"\s+href="#game-board"/);
});

for (const { name, callback } of tests) {
  try {
    await callback();
    process.stdout.write(`✓ Dream Hotel · ${name}\n`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

process.stdout.write(`Dream Hotel: ${tests.length} tests, ${assertions} assertions passed.\n`);
