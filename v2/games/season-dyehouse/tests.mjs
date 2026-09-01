import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_PRESET_ID,
  GAME_VERSION,
  GENERATOR_VERSION,
  MAX_HISTORY,
  PRESETS,
  SOLVER_DEPTH,
  STATUS,
  applyMove,
  buildPuzzle,
  chooseSuggestedMove,
  connectedComponent,
  createGame,
  dailySeed,
  fillBoard,
  generateBoard,
  isComplete,
  localDayKey,
  markCompletionReported,
  normalizeSeed,
  restartGame,
  restoreGame,
  puzzleIdFor,
  serializeGame,
  solveBoard,
  statusFor,
  undoMove,
  validateBoard,
  validateParameters,
} from "./logic.mjs";
import {
  CATALOGUE,
  createRecords,
  normalizeRecords,
  recordCompletion,
  recordsSummary,
} from "./rewards.mjs";
import {
  STORAGE_KEYS,
  STORAGE_PREFIX,
  TUTORIAL_VERSION,
  defaultPreferences,
  loadPreferences,
  loadSession,
  restoreSession,
  savePreferences,
  saveSession,
  writeJSON,
} from "./storage.mjs";
import {
  COMPLETE_EVENT,
  COMPLETION_QUEUE,
  completionIdFor,
  createAttemptId,
  createCompletionPayload,
  emitCompletion,
  exposeGameApi,
  flushCompletionReports,
  normalizeAttemptId,
} from "./integration.mjs";
import { createDialogScheduler } from "./dialog-scheduler.mjs";

const baseUrl = new URL("./", import.meta.url);
const logicSource = readFileSync(new URL("./logic.mjs", baseUrl), "utf8");
const storageSource = readFileSync(new URL("./storage.mjs", baseUrl), "utf8");
const integrationSource = readFileSync(new URL("./integration.mjs", baseUrl), "utf8");
const appSource = readFileSync(new URL("./app.mjs", baseUrl), "utf8");
const html = readFileSync(new URL("./index.html", baseUrl), "utf8");
const css = readFileSync(new URL("./styles.css", baseUrl), "utf8");
const svgPaths = ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"];
const svgs = svgPaths.map((name) => readFileSync(new URL(`./assets/${name}`, baseUrl), "utf8"));

let assertions = 0;
let passed = 0;

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function svgAttribute(svg, name) {
  return svg.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
}

async function test(name, run) {
  try {
    await run();
    passed += 1;
    process.stdout.write(`✓ Season Dyehouse · ${name}\n`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

class FakeStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.reads = [];
    this.writes = [];
    this.removals = [];
  }

  getItem(key) {
    this.reads.push(key);
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.writes.push(key);
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.removals.push(key);
    this.values.delete(key);
  }
}

function replayReference(puzzle) {
  let board = [...puzzle.initialBoard];
  for (const colour of puzzle.referencePath) {
    equal(colour === board[0], false, "参考路线不得选当前色");
    const result = fillBoard(board, puzzle.preset.width, puzzle.preset.height, colour);
    ok(result.accepted, "参考路线每手必须合法");
    board = result.board;
  }
  return board;
}

await test("七组上游预设、默认值与参数边界逐项保留", () => {
  equal(GAME_VERSION, 1);
  equal(SOLVER_DEPTH, 3);
  equal(DEFAULT_PRESET_ID, "12x12-easy");
  equal(Object.values(PRESETS).map(({ width, height, colours, leniency }) => [width, height, colours, leniency]), [
    [12, 12, 6, 5],
    [12, 12, 6, 2],
    [12, 12, 6, 0],
    [16, 16, 6, 2],
    [16, 16, 6, 0],
    [12, 12, 3, 0],
    [12, 12, 4, 0],
  ]);
  ok(validateParameters({ width: 1, height: 2, colours: 3, leniency: 0 }));
  ok(validateParameters({ width: 2, height: 1, colours: 10, leniency: 99 }));
  equal(validateParameters({ width: 1, height: 1, colours: 3, leniency: 0 }), false);
  equal(validateParameters({ width: 2, height: 2, colours: 2, leniency: 0 }), false);
  equal(validateParameters({ width: 2, height: 2, colours: 11, leniency: 0 }), false);
  equal(validateParameters({ width: 2, height: 2, colours: 3, leniency: -1 }), false);
});

await test("起点连通块只认正交连接，队列顺序为右下左上", () => {
  const board = [
    0, 0, 1, 2,
    0, 1, 1, 2,
    2, 1, 0, 0,
    1, 2, 0, 0,
  ];
  equal(connectedComponent(board, 4, 4, 0), [0, 1, 4]);
  equal(connectedComponent(board, 4, 4, 10), [10, 11, 14, 15]);
  equal(connectedComponent([0, 1, 1, 0], 2, 2, 0), [0], "对角同色不连通");
  equal(connectedComponent([], 0, 0, 0), []);
  ok(/Object\.freeze\(\[0, 1\]\)[\s\S]*Object\.freeze\(\[1, 0\]\)[\s\S]*Object\.freeze\(\[0, -1\]\)[\s\S]*Object\.freeze\(\[-1, 0\]\)/.test(logicSource));
});

await test("填色只改写旧起点块，再自然吸收接壤目标色链", () => {
  const board = [
    0, 0, 1, 2,
    0, 1, 1, 2,
    3, 3, 1, 2,
  ];
  const result = fillBoard(board, 4, 3, 1);
  ok(result.accepted);
  equal(result.recoloured, [0, 1, 4]);
  equal(result.absorbed, [2, 5, 6, 10]);
  equal(result.expandedBy, 4);
  equal(result.board, [
    1, 1, 1, 2,
    1, 1, 1, 2,
    3, 3, 1, 2,
  ]);
  equal(board[0], 0, "输入棋盘必须保持不变");
  equal(result.board[8], 3, "不接壤的其他色不变");
});

await test("同色严格无效；任意其他色即使零扩张也合法计步", () => {
  const board = Array(144).fill(0);
  board[143] = 1;
  const game = {
    version: 1,
    generatorVersion: GENERATOR_VERSION,
    presetId: "12x12-easy",
    seed: 7,
    board,
    timeline: [],
    moves: 0,
    moveLimit: 5,
    referenceMoves: 3,
    status: STATUS.PLAYING,
    controlled: 143,
    wastes: 0,
    cleanStreak: 3,
    maxCleanStreak: 3,
    reportedCompletionId: "",
  };
  const same = applyMove(game, 0);
  equal(same.accepted, false);
  equal(same.reason, "same-colour");
  equal(same.state, game, "同色必须返回完全未变的状态");

  const wasted = applyMove(game, 2);
  ok(wasted.accepted);
  equal(wasted.expandedBy, 0);
  equal(wasted.state.moves, 1);
  equal(wasted.state.timeline, [2]);
  equal(wasted.state.wastes, 1);
  equal(wasted.state.cleanStreak, 0);
  equal(wasted.state.maxCleanStreak, 3);
  equal(wasted.state.controlled, 143);

  const capped = { ...game, timeline: Array(MAX_HISTORY).fill(1), moves: MAX_HISTORY };
  equal(applyMove(capped, 0).reason, "same-colour", "记录上限也不能改变同色无效语义");
  const historyLimited = applyMove(capped, 2);
  equal(historyLimited.accepted, false);
  equal(historyLimited.reason, "history-limit", "第 513 步前必须阻止，避免写出无法恢复的存档");
  equal(historyLimited.state, capped);
});

await test("胜负精确遵循步限，超限后可继续但不再获胜", () => {
  const board = Array(144).fill(0);
  board[143] = 1;
  const base = {
    version: 1,
    generatorVersion: GENERATOR_VERSION,
    presetId: "12x12-hard",
    seed: 9,
    board,
    timeline: [],
    moves: 0,
    moveLimit: 1,
    referenceMoves: 1,
    status: STATUS.PLAYING,
    controlled: 143,
    wastes: 0,
    cleanStreak: 0,
    maxCleanStreak: 0,
    reportedCompletionId: "",
  };
  const exact = applyMove(base, 1);
  equal(exact.state.moves, 1);
  equal(isComplete(exact.state.board), true);
  equal(exact.state.status, STATUS.WON, "恰在限制步完成必须获胜");

  const atLimit = applyMove(base, 2);
  equal(atLimit.state.status, STATUS.OVER_LIMIT, "恰到限制仍未完成必须失败");
  equal(isComplete(atLimit.state.board), false);
  const continued = applyMove(atLimit.state, 1);
  ok(continued.accepted, "失败后仍允许继续染色");
  equal(isComplete(continued.state.board), true);
  equal(continued.state.moves, 2);
  equal(continued.state.status, STATUS.OVER_LIMIT, "超限合幅仍是失败");
  equal(applyMove(continued.state, 2).reason, "complete", "合幅后才禁止继续操作");
  equal(statusFor([0, 0], 1, 1), STATUS.WON);
  equal(statusFor([0, 1], 1, 1), STATUS.OVER_LIMIT);
  equal(statusFor([0, 0], 2, 1), STATUS.OVER_LIMIT);
});

await test("种子、日期题面可复现，宽限只改步限不改布面", () => {
  equal(normalizeSeed(42), 42);
  equal(normalizeSeed("42"), 42);
  equal(normalizeSeed(-1), 0xffffffff);
  equal(normalizeSeed("四季-42"), normalizeSeed("四季-42"));
  ok(normalizeSeed("四季-42") !== normalizeSeed("四季-43"));
  equal(localDayKey(new Date(2026, 7, 31, 23, 30)), "2026-08-31");
  equal(dailySeed("2026-08-31"), dailySeed("2026-08-31"));
  ok(dailySeed("2026-08-31") !== dailySeed("2026-09-01"));

  const easy = buildPuzzle(20260831, "12x12-easy");
  const medium = buildPuzzle(20260831, "12x12-medium");
  const hard = buildPuzzle(20260831, "12x12-hard");
  equal(easy.initialBoard, medium.initialBoard);
  equal(medium.initialBoard, hard.initialBoard);
  equal(easy.referencePath, medium.referencePath);
  equal(medium.referencePath, hard.referencePath);
  equal(easy.moveLimit, hard.moveLimit + 5);
  equal(medium.moveLimit, hard.moveLimit + 2);
  equal(generateBoard(77, "16x16-medium"), generateBoard(77, "16x16-hard"));
  ok(JSON.stringify(generateBoard(77, "12x12-easy")) !== JSON.stringify(generateBoard(78, "12x12-easy")));
});

await test("全部发布参数的多种子参考路线均可靠合幅", () => {
  const seeds = [0, 1, 2, 42, 2026, 0xffffffff];
  for (const preset of Object.values(PRESETS)) {
    for (const seed of seeds) {
      const puzzle = buildPuzzle(seed, preset.id);
      ok(validateBoard(puzzle.initialBoard, preset), `${preset.id}/${seed} 布面必须合法`);
      equal(isComplete(puzzle.initialBoard), false, "初局不得已完成");
      ok(puzzle.referencePath.length > 0);
      equal(puzzle.referenceMoves, puzzle.referencePath.length);
      equal(puzzle.moveLimit, puzzle.referenceMoves + preset.leniency);
      equal(isComplete(replayReference(puzzle)), true, `${preset.id}/${seed} 参考路线必须合幅`);
    }
  }
  const oracleBoard = [0, 1, 2, 0, 1, 2, 2, 1, 2];
  equal(chooseSuggestedMove(oracleBoard, 3, 3, 3), 1, "固定棋面的三层启发式首选应稳定");
  equal(solveBoard(oracleBoard, 3, 3, 3), [1, 2]);
});

await test("撤销、重开与不可变操作完整恢复规则状态", () => {
  const initial = createGame({ seed: 314159, presetId: "12x12-medium" });
  const colour = buildPuzzle(initial.seed, initial.presetId).referencePath[0];
  const applied = applyMove(initial, colour);
  ok(applied.accepted);
  equal(initial.moves, 0, "原状态不可被改写");
  equal(initial.timeline, []);
  equal(undoMove(applied.state), initial);
  equal(restartGame(applied.state), initial);
  equal(undoMove(initial), initial);
});

await test("存档只保留种子与操作日志，损坏或伪造数据安全拒绝", () => {
  let game = createGame({ seed: 8675309, presetId: "12x12-hard" });
  const reference = buildPuzzle(game.seed, game.presetId).referencePath;
  game = applyMove(game, reference[0]).state;
  equal(restoreGame(serializeGame(game)), game);
  equal(JSON.parse(serializeGame(game)).generatorVersion, GENERATOR_VERSION);
  equal(restoreGame("{broken"), null);
  equal(restoreGame({ version: 99, presetId: game.presetId, seed: game.seed, timeline: [] }), null);
  equal(restoreGame({ version: 1, generatorVersion: 99, presetId: game.presetId, seed: game.seed, timeline: [], reportedCompletionId: "" }), null);
  equal(restoreGame({ version: 1, generatorVersion: GENERATOR_VERSION, presetId: "unknown", seed: game.seed, timeline: [] }), null);
  equal(restoreGame({ version: 1, generatorVersion: GENERATOR_VERSION, presetId: game.presetId, seed: -1, timeline: [] }), null);
  equal(restoreGame({ version: 1, generatorVersion: GENERATOR_VERSION, presetId: game.presetId, seed: game.seed, timeline: [generateBoard(game.seed, game.presetId)[0]], reportedCompletionId: "" }), null, "伪造同色操作日志必须拒绝");
  equal(restoreGame({ version: 1, generatorVersion: GENERATOR_VERSION, presetId: game.presetId, seed: game.seed, timeline: Array(MAX_HISTORY + 1).fill(1), reportedCompletionId: "" }), null);
  equal(restoreGame({ version: 1, generatorVersion: GENERATOR_VERSION, presetId: game.presetId, seed: game.seed, timeline: [], reportedCompletionId: "forged" }), null);

  const completedTimeline = reference;
  const finalColour = (() => {
    let board = generateBoard(game.seed, game.presetId);
    for (const colour of completedTimeline) board = fillBoard(board, 12, 12, colour).board;
    return board[0];
  })();
  const extraColour = (finalColour + 1) % PRESETS[game.presetId].colours;
  equal(restoreGame({
    version: 1,
    generatorVersion: GENERATOR_VERSION,
    presetId: game.presetId,
    seed: game.seed,
    timeline: [...completedTimeline, extraColour],
    reportedCompletionId: "",
  }), null, "完成后附加的伪造操作必须拒绝");
});

await test("所有本地存储键均使用 v2 游戏私有前缀，损坏 session 仅移除自身", () => {
  equal(STORAGE_PREFIX, "ten-realms-v2:season-dyehouse:");
  ok(Object.values(STORAGE_KEYS).every((key) => key.startsWith(STORAGE_PREFIX)));
  equal(storageSource.includes("ten-realms:progress:v1"), false);
  equal(storageSource.includes("localStorage.clear"), false);

  equal(TUTORIAL_VERSION, 2);
  const preferences = { ...defaultPreferences(), muted: true, tutorialVersion: TUTORIAL_VERSION, presetId: "16x16-hard" };
  const preferenceStorage = new FakeStorage();
  ok(savePreferences(preferenceStorage, preferences));
  equal(loadPreferences(preferenceStorage), preferences);
  equal(writeJSON(null, STORAGE_KEYS.records, {}), false, "不存在的 storage 不得误报写入成功");
  equal(writeJSON({}, STORAGE_KEYS.records, {}), false, "缺少 setItem 时不得误报写入成功");

  const legacyPreferences = new FakeStorage({
    [STORAGE_KEYS.preferences]: JSON.stringify({
      version: 1,
      muted: true,
      tutorialSeen: true,
      presetId: "16x16-hard",
    }),
  });
  equal(loadPreferences(legacyPreferences), {
    version: 1,
    muted: true,
    tutorialVersion: 0,
    presetId: "16x16-hard",
  }, "旧教程已看标记必须失效，但静音与规格偏好不能丢失");

  const game = createGame({ seed: 12, presetId: "12x12-easy" });
  const sessionStorage = new FakeStorage();
  const attemptId = "test-attempt-0001";
  ok(saveSession(sessionStorage, game, { mode: "seed", day: "", attemptId }));
  equal(loadSession(sessionStorage), { game, mode: "seed", day: "", attemptId });
  ok([...sessionStorage.reads, ...sessionStorage.writes].every((key) => key.startsWith(STORAGE_PREFIX)));

  const broken = new FakeStorage({ [STORAGE_KEYS.session]: "{bad" });
  equal(loadSession(broken), null);
  equal(broken.removals, [STORAGE_KEYS.session]);
  equal(restoreSession({ version: 1, mode: "daily", day: "2026-08-31", game: JSON.parse(serializeGame(game)) }), null, "每日布样必须校验固定参数与日期种子");

  let wonGame = createGame({ seed: 15, presetId: "12x12-easy" });
  for (const colour of buildPuzzle(15, "12x12-easy").referencePath) wonGame = applyMove(wonGame, colour).state;
  const winAttemptId = "test-attempt-won-0001";
  const validCompletionId = completionIdFor(puzzleIdFor(wonGame), winAttemptId);
  wonGame = markCompletionReported(wonGame, validCompletionId);
  const wonStorage = new FakeStorage();
  ok(saveSession(wonStorage, wonGame, { mode: "seed", day: "", attemptId: winAttemptId }));
  equal(loadSession(wonStorage), { game: wonGame, mode: "seed", day: "", attemptId: winAttemptId });
  const forgedSession = JSON.parse(wonStorage.values.get(STORAGE_KEYS.session));
  forgedSession.game.reportedCompletionId = "forged-completion";
  equal(restoreSession(forgedSession), null, "已上报标记必须同本局 attemptId 严格对应");
});

await test("织物图鉴、少步、无空染与每日布样奖励全部稳定去重", () => {
  const completion = {
    puzzleId: `v${GENERATOR_VERSION}:12x12-medium:daily:2026-08-31`,
    presetId: "12x12-medium",
    moves: 17,
    efficient: true,
    wasteFree: true,
    maxCleanStreak: 17,
    mode: "daily",
    day: "2026-08-31",
  };
  const first = recordCompletion(createRecords(), completion, new Date("2026-08-31T10:00:00Z"));
  ok(first.claims.some(({ kind }) => kind === "first-clear"));
  ok(first.claims.some(({ kind }) => kind === "reference"));
  ok(first.claims.some(({ kind }) => kind === "waste-free"));
  ok(first.claims.some(({ kind }) => kind === "daily"));
  ok(first.claims.some(({ kind }) => kind === "catalogue"));
  equal(new Set(first.claims.map(({ id }) => id)).size, first.claims.length);
  const second = recordCompletion(first.records, completion, new Date("2026-08-31T11:00:00Z"));
  equal(second.claims, [], "同一胜利不得重复产生奖励 claim");
  equal(second.records.bestMoves[completion.puzzleId], 17);
  equal(second.records.puzzleWins[completion.puzzleId], 2);
  const summary = recordsSummary(second.records);
  equal(summary.dailyCount, 1);
  equal(summary.maxCleanStreak, 17);
  equal(CATALOGUE.length, 12);

  const poisoned = JSON.parse('{"version":1,"puzzleWins":{"__proto__":9},"rewards":{"constructor":{"kind":"x"}}}');
  const normalized = normalizeRecords(poisoned);
  equal(Object.hasOwn(normalized.puzzleWins, "__proto__"), false);
  equal(Object.hasOwn(normalized.rewards, "constructor"), false);

  const longLedger = createRecords();
  for (let index = 0; index <= 5000; index += 1) {
    const id = `v1:12x12-easy:seed:${index}`;
    longLedger.puzzleWins[id] = 1;
    longLedger.bestMoves[id] = 20;
    longLedger.completionReports[`season-dyehouse:${id}:run:test-${String(index).padStart(8, "0")}`] = "2026-08-31T12:00:00.000Z";
  }
  for (let index = 0; index <= 12000; index += 1) {
    longLedger.rewards[`season-dyehouse:volume:${index}`] = { kind: "volume", awardedAt: "2026-08-31T12:00:00.000Z" };
  }
  const normalizedLongLedger = normalizeRecords(longLedger);
  ok(normalizedLongLedger.puzzleWins["v1:12x12-easy:seed:5000"]);
  ok(normalizedLongLedger.bestMoves["v1:12x12-easy:seed:5000"]);
  ok(normalizedLongLedger.completionReports["season-dyehouse:v1:12x12-easy:seed:5000:run:test-00005000"]);
  ok(normalizedLongLedger.rewards["season-dyehouse:volume:12000"], "长期游玩不得在刷新时静默丢掉最新去重记录");
});

await test("每局完成 ID 稳定、真实回放可证，内存队列不冒充宿主确认", () => {
  const puzzle = buildPuzzle(1, "12x12-easy");
  let baselineGame = createGame({ seed: puzzle.seed, presetId: puzzle.preset.id });
  for (const colour of [1, ...puzzle.referencePath]) {
    const result = applyMove(baselineGame, colour);
    ok(result.accepted, "带一次空染的完成日志仍必须逐手合法");
    baselineGame = result.state;
  }
  equal(baselineGame.status, STATUS.WON);
  equal(baselineGame.wastes, 1);

  let improvedGame = createGame({ seed: puzzle.seed, presetId: puzzle.preset.id });
  for (const colour of puzzle.referencePath) improvedGame = applyMove(improvedGame, colour).state;
  equal(improvedGame.status, STATUS.WON);
  ok(improvedGame.moves < baselineGame.moves);

  const details = {
    puzzleId: puzzleIdFor(baselineGame),
    attemptId: "test-attempt-run-0042",
    mode: "seed",
    day: "",
    presetId: baselineGame.presetId,
    tier: puzzle.preset.tier,
    seed: baselineGame.seed,
    moves: baselineGame.moves,
    moveLimit: baselineGame.moveLimit,
    referenceMoves: baselineGame.referenceMoves,
    efficient: baselineGame.moves <= baselineGame.referenceMoves,
    wasteFree: baselineGame.wastes === 0,
    maxCleanStreak: baselineGame.maxCleanStreak,
    timeline: baselineGame.timeline,
    claims: [{ id: "season-dyehouse:first:42", kind: "first-clear", label: "新布面" }],
  };
  const payload = createCompletionPayload(details, new Date("2026-08-31T12:00:00Z"));
  equal(payload.levelId, payload.puzzleId);
  equal(payload.puzzleId, `v${GENERATOR_VERSION}:12x12-easy:seed:1`);
  equal(payload.par, baselineGame.referenceMoves);
  equal(payload.tier, 1);
  equal(payload.moves, baselineGame.moves);
  equal(payload.gameId, "season-dyehouse");
  equal(payload.attemptId, details.attemptId);
  equal(payload.timeline, baselineGame.timeline);
  ok(Object.isFrozen(payload.timeline));
  equal(normalizeAttemptId("bad"), "");
  equal(createAttemptId({ randomUUID: () => "test-attempt-fixed-0001" }), "test-attempt-fixed-0001");
  equal(
    createCompletionPayload(details, new Date("2026-09-01T12:00:00Z")).completionId,
    payload.completionId,
    "同一局的刷新重试必须保持 ID",
  );
  const improvedPayload = createCompletionPayload(
    {
      ...details,
      attemptId: "test-attempt-run-0043",
      moves: improvedGame.moves,
      efficient: true,
      wasteFree: true,
      maxCleanStreak: improvedGame.maxCleanStreak,
      timeline: improvedGame.timeline,
    },
    new Date("2026-09-01T12:00:00Z"),
  );
  ok(improvedPayload.completionId !== payload.completionId, "同题新局必须可再次上报");

  const v2Calls = [];
  const v2Host = { TenRealmsV2: { complete: (value) => v2Calls.push(value) } };
  equal(emitCompletion(payload, v2Host), "v2-api");
  equal(v2Calls, [payload]);

  const realmCalls = [];
  const realmHost = { RealmArcade: { complete: (value) => realmCalls.push(value) } };
  equal(emitCompletion(payload, realmHost), "realm-api");
  equal(realmCalls[0].levelId, payload.puzzleId);

  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const events = [];
  const fallbackHost = { CustomEvent: FakeCustomEvent, dispatchEvent: (event) => events.push(event) };
  equal(emitCompletion(payload, fallbackHost), "queue");
  equal(emitCompletion(payload, fallbackHost), "queue");
  equal(fallbackHost[COMPLETION_QUEUE].length, 1);
  equal(events.length, 1, "同一局重试不得重复派发 DOM 事件");
  equal(events[0].type, COMPLETE_EVENT);
  equal(events[0].detail, payload);

  const throwEvents = [];
  const throwingHost = {
    TenRealmsV2: { complete() { throw new Error("adapter unavailable"); } },
    RealmArcade: { complete() { throw new Error("compat unavailable"); } },
    CustomEvent: FakeCustomEvent,
    dispatchEvent: (event) => throwEvents.push(event),
  };
  equal(emitCompletion(payload, throwingHost), "queue", "适配器抛错后只能降级入队，不能冒充已确认");
  equal(throwingHost[COMPLETION_QUEUE], [payload]);
  equal(throwEvents.length, 1);

  const firstLocal = recordCompletion(createRecords(), {
    puzzleId: payload.puzzleId,
    presetId: details.presetId,
    moves: baselineGame.moves,
    efficient: false,
    wasteFree: false,
    maxCleanStreak: baselineGame.maxCleanStreak,
    mode: "seed",
    day: "",
  }, new Date("2026-08-31T12:00:00Z"));
  firstLocal.records.pendingCompletions[payload.completionId] = payload;
  const blocked = flushCompletionReports(firstLocal.records, throwingHost);
  equal(blocked.blocked, true);
  equal(blocked.delivered, []);
  equal(firstLocal.records.puzzleWins[payload.puzzleId], 1);
  ok(firstLocal.records.pendingCompletions[payload.completionId]);
  equal(firstLocal.records.completionReports, {});
  equal(throwingHost[COMPLETION_QUEUE], [payload], "内存队列中有副本时持久 pending 仍必须保留");

  const afterRefresh = normalizeRecords(JSON.parse(JSON.stringify(firstLocal.records)));
  equal(afterRefresh.puzzleWins[payload.puzzleId], 1, "失败后刷新不得重复本地结算");
  ok(afterRefresh.pendingCompletions[payload.completionId], "真实已解 timeline 必须可在刷新后完整恢复");
  const retryCalls = [];
  const retryHost = { RealmArcade: { complete: (value) => retryCalls.push(value) } };
  const retried = flushCompletionReports(afterRefresh, retryHost);
  equal(retried.delivered, [payload.completionId]);
  equal(retryCalls, [payload]);
  equal(afterRefresh.pendingCompletions, {});
  ok(afterRefresh.completionReports[payload.completionId]);
  equal(afterRefresh.puzzleWins[payload.puzzleId], 1);

  const forgedPayload = {
    ...payload,
    moves: 0,
    maxCleanStreak: 0,
    timeline: [],
  };
  const forgedRecords = createRecords();
  forgedRecords.pendingCompletions[payload.completionId] = forgedPayload;
  equal(normalizeRecords(forgedRecords).pendingCompletions, {}, "从未游玩的空 timeline 不得伪造完成");
  const tamperedMetrics = createRecords();
  tamperedMetrics.pendingCompletions[payload.completionId] = { ...payload, maxCleanStreak: payload.maxCleanStreak + 1 };
  equal(normalizeRecords(tamperedMetrics).pendingCompletions, {}, "真实 timeline 与伪造指标不一致时也必须拒绝");

  const dailyDay = "2026-09-01";
  const disguisedDaily = createCompletionPayload({
    ...details,
    puzzleId: puzzleIdFor(baselineGame, "daily", dailyDay),
    attemptId: "test-attempt-fake-daily-0001",
    mode: "daily",
    day: dailyDay,
  }, new Date("2026-09-01T12:00:00Z"));
  const disguisedDailyRecords = createRecords();
  disguisedDailyRecords.pendingCompletions[disguisedDaily.completionId] = disguisedDaily;
  equal(normalizeRecords(disguisedDailyRecords).pendingCompletions, {}, "普通规格与种子不得伪装成每日布样");

  const dailyPuzzle = buildPuzzle(dailySeed(dailyDay), "12x12-medium");
  let dailyGame = createGame({ seed: dailyPuzzle.seed, presetId: dailyPuzzle.preset.id });
  for (const colour of dailyPuzzle.referencePath) dailyGame = applyMove(dailyGame, colour).state;
  const dailyPayload = createCompletionPayload({
    puzzleId: puzzleIdFor(dailyGame, "daily", dailyDay),
    attemptId: "test-attempt-real-daily-0001",
    mode: "daily",
    day: dailyDay,
    presetId: dailyGame.presetId,
    tier: dailyPuzzle.preset.tier,
    seed: dailyGame.seed,
    moves: dailyGame.moves,
    moveLimit: dailyGame.moveLimit,
    referenceMoves: dailyGame.referenceMoves,
    efficient: true,
    wasteFree: dailyGame.wastes === 0,
    maxCleanStreak: dailyGame.maxCleanStreak,
    timeline: dailyGame.timeline,
    claims: [],
  }, new Date("2026-09-01T12:00:00Z"));
  const dailyRecords = createRecords();
  dailyRecords.pendingCompletions[dailyPayload.completionId] = dailyPayload;
  ok(normalizeRecords(dailyRecords).pendingCompletions[dailyPayload.completionId], "真实每日题面的完成证明必须可恢复");

  const invalidDay = "2026-02-30";
  const invalidDailyPuzzle = buildPuzzle(dailySeed(invalidDay), "12x12-medium");
  let invalidDailyGame = createGame({ seed: invalidDailyPuzzle.seed, presetId: invalidDailyPuzzle.preset.id });
  for (const colour of invalidDailyPuzzle.referencePath) invalidDailyGame = applyMove(invalidDailyGame, colour).state;
  const invalidDailyPayload = createCompletionPayload({
    ...details,
    puzzleId: puzzleIdFor(invalidDailyGame, "daily", invalidDay),
    attemptId: "test-attempt-invalid-day-0001",
    mode: "daily",
    day: invalidDay,
    presetId: invalidDailyGame.presetId,
    tier: invalidDailyPuzzle.preset.tier,
    seed: invalidDailyGame.seed,
    moves: invalidDailyGame.moves,
    moveLimit: invalidDailyGame.moveLimit,
    referenceMoves: invalidDailyGame.referenceMoves,
    efficient: true,
    wasteFree: invalidDailyGame.wastes === 0,
    maxCleanStreak: invalidDailyGame.maxCleanStreak,
    timeline: invalidDailyGame.timeline,
    claims: [],
  }, new Date("2026-02-28T12:00:00Z"));
  const invalidDailyRecords = createRecords();
  invalidDailyRecords.pendingCompletions[invalidDailyPayload.completionId] = invalidDailyPayload;
  equal(normalizeRecords(invalidDailyRecords).pendingCompletions, {}, "仅形式匹配但不存在的日期必须拒绝");

  const improvedLocal = recordCompletion(afterRefresh, {
    puzzleId: payload.puzzleId,
    presetId: details.presetId,
    moves: improvedGame.moves,
    efficient: true,
    wasteFree: true,
    maxCleanStreak: improvedGame.maxCleanStreak,
    mode: "seed",
    day: "",
  }, new Date("2026-09-01T12:00:00Z"));
  improvedLocal.records.pendingCompletions[improvedPayload.completionId] = improvedPayload;
  const improvementCalls = [];
  flushCompletionReports(improvedLocal.records, { TenRealmsV2: { complete: (value) => improvementCalls.push(value) } });
  equal(improvementCalls, [improvedPayload]);
  equal(improvedLocal.records.bestMoves[payload.puzzleId], improvedGame.moves);
  equal(improvedLocal.records.puzzleWins[payload.puzzleId], 2);

  const readyEvents = [];
  const readyHost = { CustomEvent: FakeCustomEvent, dispatchEvent: (event) => readyEvents.push(event) };
  ok(exposeGameApi({ getSnapshot() {} }, readyHost));
  equal(readyHost.TenRealmsV2Games["season-dyehouse"].gameId, "season-dyehouse");
  equal(readyEvents.length, 1);
  equal(exposeGameApi({}, { TenRealmsV2Games: 42 }), false);
  equal(exposeGameApi({}, { TenRealmsV2Games: Object.freeze({}) }), false);
});

await test("换题、重开或撤销会取消延迟胜利弹窗，旧局回调不得覆盖新布面", () => {
  let queued = null;
  const cancelled = [];
  const opened = [];
  let current = true;
  const scheduler = createDialogScheduler({
    scheduleTimer(callback, delay) {
      queued = { callback, delay, id: Symbol("timer") };
      return queued.id;
    },
    cancelTimer(handle) { cancelled.push(handle); },
  });
  scheduler.schedule(360, () => current, () => opened.push("old-win"));
  const stale = queued;
  scheduler.cancel();
  stale.callback();
  equal(opened, [], "被取消的旧局回调绝不能打开弹窗");
  equal(cancelled, [stale.id]);

  scheduler.schedule(360, () => current, () => opened.push("current-win"));
  queued.callback();
  equal(opened, ["current-win"]);
  scheduler.schedule(360, () => current, () => opened.push("not-current"));
  current = false;
  queued.callback();
  equal(opened, ["current-win"], "题面标识变更后即使计时器触发也必须阻止");
  ok((appSource.match(/victoryScheduler\.cancel\(\)/g) ?? []).length >= 3, "换题、重开和撤销必须各自取消弹窗");
  ok(/game\.reportedCompletionId === payload\.completionId[\s\S]*currentPuzzleId\(\) === puzzleId/.test(appSource));
});

await test("三张教程使用可由规则引擎复算的真实元素、操作与通关状态", () => {
  equal(new Set(svgs).size, 3);
  svgs.forEach((svg, index) => {
    ok(/^<svg\b/.test(svg.trim()), `${svgPaths[index]} 必须是独立 SVG`);
    ok(/viewBox="0 0 640 360"/.test(svg));
    ok(/preserveAspectRatio="xMidYMid meet"/.test(svg));
    ok(/<title\b/.test(svg) && /<desc\b/.test(svg));
    equal(/<script\b|(?:href|src)="https?:\/\//i.test(svg), false, "SVG 不得有脚本或远程依赖");
    equal(svgAttribute(svg, "data-tutorial-state"), ["elements", "action", "goal"][index]);
  });

  for (const label of ["春青", "夏绯", "秋金", "冬蓝", "梅紫", "松墨"]) ok(svgs[0].includes(label));
  for (const symbol of ["芽", "☀", "叶", "❄", "梅", "松"]) ok(svgs[0].includes(symbol));

  const tutorialGame = createGame({ seed: 1, presetId: "12x12-easy" });
  const expectedPrefix = Array.from({ length: 4 }, (_, row) => (
    tutorialGame.board.slice(row * 12, row * 12 + 5)
  ));
  const shownPrefix = svgAttribute(svgs[1], "data-board-prefix")
    .split(";")
    .map((row) => row.split(",").map(Number));
  equal(shownPrefix, expectedPrefix, "操作图必须截取真实种子 1 题面，不能手绘伪造色块");
  equal(Number(svgAttribute(svgs[1], "data-before-controlled")), tutorialGame.controlled);
  const tutorialMove = applyMove(tutorialGame, Number(svgAttribute(svgs[1], "data-selected-dye")));
  ok(tutorialMove.accepted);
  equal(Number(svgAttribute(svgs[1], "data-expanded-by")), tutorialMove.expandedBy);
  equal(Number(svgAttribute(svgs[1], "data-after-controlled")), tutorialMove.state.controlled);
  ok(/操作前/.test(svgs[1]) && /操作后/.test(svgs[1]) && /左右独立/.test(svgs[1]));

  const tutorialPuzzle = buildPuzzle(1, "12x12-easy");
  const completedBoard = replayReference(tutorialPuzzle);
  equal(new Set(completedBoard).size, 1);
  equal(Number(svgAttribute(svgs[2], "data-final-colour")), completedBoard[0]);
  equal(Number(svgAttribute(svgs[2], "data-controlled")), completedBoard.length);
  equal(Number(svgAttribute(svgs[2], "data-total")), completedBoard.length);
  equal(Number(svgAttribute(svgs[2], "data-moves")), tutorialPuzzle.referenceMoves);
  equal(Number(svgAttribute(svgs[2], "data-reference-moves")), tutorialPuzzle.referenceMoves);
  equal(Number(svgAttribute(svgs[2], "data-move-limit")), tutorialPuzzle.moveLimit);
  equal(svgAttribute(svgs[2], "data-board-size"), `${tutorialPuzzle.preset.width}x${tutorialPuzzle.preset.height}`);
});

await test("页面语义、规则源流、模态与所有交互接线完整", () => {
  for (const id of [
    "cloth-board", "dye-palette", "preset-select", "seed-form", "new-puzzle-button", "daily-button",
    "restart-button", "undo-button", "mute-button", "tutorial-button", "rules-button", "tutorial-dialog",
    "rules-dialog", "victory-dialog", "failure-dialog", "catalogue-grid", "toast", "live-status",
  ]) ok(html.includes(`id="${id}"`), `HTML 缺少 #${id}`);
  ok(/id="cloth-board"[^>]*role="grid"[^>]*tabindex="0"/s.test(html));
  ok(/aria-activedescendant=/.test(html));
  equal((html.match(/<dialog\b/g) ?? []).length, 4);
  ok(/href="\.\.\/\.\.\/"/.test(html), "返回按钮必须指向 v2 入口 ../../");
  ok(/https:\/\/puzzles\.ebnbin\.dev\/doc\/zh\/flood\.html/.test(html));
  ok(/github\.com\/ebnbin\/puzzles\/blob\/main\/src\/games\/flood\.ts/.test(html));
  ok(/github\.com\/ebnbin\/puzzles\/blob\/main\/vendor\/sgtpuzzles\/flood\.c/.test(html));
  ok(/MIT/.test(html));
  equal(/<(?:script|link)\b[^>]*(?:src|href)="https?:/i.test(html), false, "不得加载远程运行时依赖");
  equal(/ten-realms:progress:v1/.test(html + appSource + storageSource), false);
  ok(/<html\s+lang="zh-CN"\s+data-realm="season-dyehouse">/.test(html));
  ok(html.includes('../../shared/realm-ui.css'));
  ok(html.includes('../../shared/realm-ui.mjs'));
  ok(html.indexOf('../../shared/realm-ui.mjs') < html.indexOf('./app.mjs'), "共享成长层必须先于游戏应用加载");
  ok(html.includes('<script type="module" src="./app.mjs"></script>') && !html.includes('./app.mjs?'), "v2 游戏入口脚本不得附加查询参数");
  ok(html.includes('../../THIRD_PARTY_NOTICES.md'));
  ok(svgPaths.every((name) => appSource.includes(`./assets/${name}`)));
  ok(/showModal\(\)/.test(appSource));
  ok(/aria-activedescendant/.test(appSource));
  ok(/event\.key === "Enter" \|\| event\.key === " "/.test(appSource));
  ok(/previousStatus !== STATUS\.OVER_LIMIT/.test(appSource));
  ok(/pendingCompletions[\s\S]*flushPendingCompletions/.test(appSource), "本地结算必须先入待上报台账");
  ok(/completionReports[\s\S]*markCompletionReported/.test(appSource), "只有已上报局才能标记完成");
  ok(/addEventListener\("realm:ready",\s*flushPendingCompletions\)/.test(appSource));
  ok(/addEventListener\("ten-realms-v2:realm-ready",\s*flushPendingCompletions\)/.test(appSource));
  ok(/timeline:\s*game\.timeline/.test(appSource), "完成 payload 必须固化真实操作日志");
  ok(/delivery !== "v2-api" && delivery !== "realm-api"/.test(integrationSource), "内存队列或 DOM 事件不得冒充宿主确认");
  ok(/restoreGame\([\s\S]*STATUS\.WON[\s\S]*puzzleIdFor/.test(readFileSync(new URL("./rewards.mjs", baseUrl), "utf8")), "pending 必须由规则引擎重放验证");
  ok(/window\.AudioContext \|\| window\.webkitAudioContext/.test(appSource));
  ok(/document\.querySelector\("dialog\[open\]"\)/.test(appSource), "模态打开时必须隔离全局快捷键");
  ok(/dialogFocus/.test(appSource) && /restoreDialogFocus/.test(appSource));
  ok(/trapDialogFocus/.test(appSource), "原生 dialog 也必须在 Tab 边界显式环回");
  ok(/tutorialDialog\.scrollTop = 0/.test(appSource) && /tutorialScrollBody\.scrollTop = 0/.test(appSource), "换卡必须复位桌面与手机教程滚动容器");
  ok(/tutorialVersion !== TUTORIAL_VERSION/.test(appSource) && /tutorialVersion: TUTORIAL_VERSION/.test(appSource), "旧教程已看标记必须升级到 v2 后才视为已看");
  ok(/window\.RealmArcade\?\.complete|host\.RealmArcade\?\.complete/.test(integrationSource));
});

await test("触控尺寸、手机完整棋盘、纹理、动画辨识与系统偏好均有静态保障", () => {
  ok(/min-height:\s*44px/.test(css));
  ok(/min-width:\s*44px/.test(css));
  ok(/\.board-scroll-guard\s*\{[\s\S]*?overflow-x:\s*auto/.test(css), "桌面布面仍可在超大题面时安全滚动");
  ok(/grid-template-columns:\s*repeat\(var\(--board-columns\),\s*minmax\(44px,\s*1fr\)\)/.test(css));
  ok(/min-width:\s*calc\(var\(--board-columns\)\s*\*\s*44px\)/.test(css));
  ok(/\.cloth-cell\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/.test(css));
  ok(/@media \(max-width: 520px\)[\s\S]*?\.board-scroll-guard\s*{[\s\S]*?overflow-x:\s*hidden/.test(css), "手机必须一次显示完整布面");
  ok(/@media \(max-width: 520px\)[\s\S]*?\.cloth-board\s*{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0/.test(css));
  ok(/@media \(max-width: 520px\)[\s\S]*?\.cloth-cell\s*{[\s\S]*?min-width:\s*0[\s\S]*?min-height:\s*0/.test(css));
  ok(/overflow-x:\s*hidden/.test(css));
  ok(/@media\s*\([^)]*max-width:\s*(?:360|390|430|480|520)px/.test(css));
  ok(/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/.test(css), "320px 染料应为 3×2");
  ok(/prefers-reduced-motion:\s*reduce/.test(css));
  ok(/forced-colors:\s*active/.test(css));
  for (let colour = 0; colour < 6; colour += 1) {
    ok(new RegExp(`\\[data-dye=["']?${colour}["']?\\]`).test(css), `${colour} 号染料必须有独立纹理`);
  }
  ok(/\.is-newly-controlled/.test(css));
  ok(/\.is-recoloured/.test(css));
  ok(/waveOrder:\s*result\.controlled/.test(appSource), "扩张波必须沿真实 BFS 连通顺序播放");
  ok(/@media\s*\(max-height:\s*600px\)\s*and\s*\(min-width:\s*721px\)/.test(css), "短横屏教程必须保留底部操作");
  const animationBlocks = [...css.matchAll(/@keyframes\s+[^{]+\{([\s\S]*?)\n\}/g)].map((match) => match[1]).join("\n");
  equal(/opacity:\s*0(?:\D|$)/.test(animationBlocks), false, "扩张动画不得把最终格子淡出为不可辨状态");
});

process.stdout.write(`Season Dyehouse: ${assertions} assertions across ${passed} tests passed.\n`);
