import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DIFFICULTIES,
  EDGE_ACTION,
  allPairKeys,
  analyzePosition,
  applyEdgeAction,
  areOrthogonalNeighbours,
  createPosition,
  createPuzzle,
  dimensionsForOrder,
  edgeKey,
  generatePuzzle,
  pairIndex,
  pairKey,
  parseEdgeKey,
  parsePosition,
  positionToJSON,
  seedFromString,
  solvePuzzle,
  toggleHighlight,
  verifyGeneratedPuzzle,
} from "./logic.mjs";
import { reportCompatibilityCompletion } from "./delivery.mjs";
import { computeCompactBoardMetrics } from "./layout.mjs";
import {
  HISTORY_LIMIT,
  STORAGE_KEYS,
  STORAGE_PREFIX,
  TUTORIAL_VERSION,
  YOKAI_GUESTS,
  canonicalCompletionDetail,
  createDefaultProfile,
  loadProfile,
  loadCompletionOutbox,
  loadSession,
  markTutorialSeen,
  normalizeProfile,
  recordCompletion,
  mergeCompletionOutbox,
  removeCompletionOutbox,
  saveCompletionOutbox,
  saveProfile,
  saveSession,
  starSummary,
  tutorialSeen,
} from "./profile.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
let assertions = 0;
let cases = 0;

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function svgAttribute(svg, name) {
  return svg.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
}

function test(name, callback) {
  try {
    callback();
    cases += 1;
    console.log(`✓ 妖怪旅店 · ${name}`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

async function testAsync(name, callback) {
  try {
    await callback();
    cases += 1;
    console.log(`✓ 妖怪旅店 · ${name}`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

function fixturePuzzle(order, numbers, suffix = "fixture") {
  return createPuzzle({
    id: `yokai-inn:g1:o${order}:u:${seedFromString(suffix).toString(36)}:a0`,
    order,
    seed: seedFromString(suffix),
    attempt: 0,
    ensureUnique: true,
    title: suffix,
    numbers,
  });
}

function completionDetail(puzzle, result, attemptId = "attempt-0001", overrides = {}) {
  const difficulty = DIFFICULTIES.find(({ order }) => order === puzzle.order);
  const moves = overrides.moves ?? puzzle.dominoCount;
  const mistakes = overrides.mistakes ?? 0;
  return {
    version: 1,
    game: "yokai-inn",
    levelId: puzzle.id,
    puzzleId: puzzle.id,
    attemptId,
    completionId: `${puzzle.id}:run:${attemptId}`,
    difficulty: difficulty.id,
    tier: DIFFICULTIES.indexOf(difficulty) + 1,
    order: puzzle.order,
    seed: puzzle.seed,
    ensureUnique: puzzle.ensureUnique,
    uniqueRequested: puzzle.ensureUnique,
    uniquenessProven: puzzle.uniquenessProven,
    moves,
    par: puzzle.dominoCount,
    mistakes,
    flawless: mistakes === 0,
    elapsedMs: overrides.elapsedMs ?? 1234,
    rewardIds: result.claims.map(({ id }) => id),
    rewardClaims: result.claims.map((claim) => ({ ...claim })),
    starLevel: result.starLevel,
  };
}

const uniqueN1 = fixturePuzzle(1, [1, 0, 0, 0, 1, 1], "unique-n1");
const multipleN1 = fixturePuzzle(1, [0, 0, 0, 1, 1, 1], "multiple-n1");
const impossibleN1 = fixturePuzzle(1, [0, 1, 0, 1, 0, 1], "impossible-n1");

test("手机棋盘尺寸计算让三档在 320/390px 可用宽度内完整显示", () => {
  const narrow = DIFFICULTIES.map(({ width }) => computeCompactBoardMetrics({ availableWidth: 285, columns: width }));
  equal(narrow.map(({ cell, gap, boardWidth }) => ({ cell, gap, boardWidth })), [
    { cell: 44, gap: 8, boardWidth: 252 },
    { cell: 44, gap: 4, boardWidth: 284 },
    { cell: 39, gap: 2, boardWidth: 285 },
  ]);
  check(narrow.every(({ fits, boardWidth, availableWidth }) => fits && boardWidth <= availableWidth));

  const standard = DIFFICULTIES.map(({ width }) => computeCompactBoardMetrics({ availableWidth: 343, columns: width }));
  check(standard.every(({ fits, boardWidth, availableWidth }) => fits && boardWidth <= availableWidth));
  equal(standard.at(-1).cell, 44, "390px 视口下七列最高难度仍应保留 44px 数字格");
  equal(standard.at(-1).gap, 5);

  assert.throws(() => computeCompactBoardMetrics({ availableWidth: 0, columns: 5 })); assertions += 1;
  assert.throws(() => computeCompactBoardMetrics({ availableWidth: 285, columns: 1 })); assertions += 1;
  assert.throws(() => computeCompactBoardMetrics({ availableWidth: 285, columns: 5, minGap: 9, maxGap: 8 })); assertions += 1;
});

test("阶数公式、完整牌组和每值出现次数精确", () => {
  for (const order of [1, 3, 4, 5]) {
    const dimensions = dimensionsForOrder(order);
    equal(dimensions.width, order + 2);
    equal(dimensions.height, order + 1);
    equal(dimensions.dominoCount, ((order + 1) * (order + 2)) / 2);
    equal(dimensions.cellCount, dimensions.dominoCount * 2);
    const pairs = allPairKeys(order);
    equal(pairs.length, dimensions.dominoCount);
    equal(new Set(pairs).size, pairs.length);
    for (let value = 0; value <= order; value += 1) {
      let occurrences = 0;
      for (const key of pairs) {
        const [first, second] = key.split("-").map(Number);
        if (first === value) occurrences += 1;
        if (second === value) occurrences += 1;
      }
      equal(occurrences, order + 2, `数字 ${value} 在完整牌组中应出现 N+2 次`);
    }
  }
});

test("无序数对规范化对称、稠密且包含双数对", () => {
  equal(pairKey(4, 1), "1-4");
  equal(pairKey(1, 4), "1-4");
  equal(pairIndex(4, 1), pairIndex(1, 4));
  equal(allPairKeys(2), ["0-0", "0-1", "1-1", "0-2", "1-2", "2-2"]);
  equal(allPairKeys(2).map((key) => pairIndex(...key.split("-").map(Number))), [0, 1, 2, 3, 4, 5]);
  assert.throws(() => pairKey(-1, 0)); assertions += 1;
  assert.throws(() => pairIndex(0.5, 1)); assertions += 1;
});

test("相邻判定使用曼哈顿距离并拒绝行尾绕接、对角与越界", () => {
  check(areOrthogonalNeighbours(0, 1, 3, 2));
  check(areOrthogonalNeighbours(0, 3, 3, 2));
  check(!areOrthogonalNeighbours(2, 3, 3, 2), "行尾 2 与下一行首 3 不能伪装成横边");
  check(!areOrthogonalNeighbours(0, 4, 3, 2));
  check(!areOrthogonalNeighbours(0, 0, 3, 2));
  check(!areOrthogonalNeighbours(-1, 0, 3, 2));
  equal(edgeKey(3, 0, 3, 2), "0:3");
  equal(parseEdgeKey("0:3", 3, 2)?.key, "0:3");
  equal(parseEdgeKey("2:3", 3, 2), null);
  equal(parseEdgeKey("3:0", 3, 2), null);
  assert.throws(() => edgeKey(2, 3, 3, 2)); assertions += 1;
});

test("题面校验拒绝错误长度、越界值、非整数和不平衡次数", () => {
  assert.throws(() => fixturePuzzle(1, [0, 0], "short")); assertions += 1;
  assert.throws(() => fixturePuzzle(1, [0, 0, 0, 1, 1, 2], "range")); assertions += 1;
  assert.throws(() => fixturePuzzle(1, [0, 0, 0, 1, 1, 1.5], "fraction")); assertions += 1;
  assert.throws(() => fixturePuzzle(1, [0, 0, 0, 0, 1, 1], "balance")); assertions += 1;
  const puzzle = fixturePuzzle(1, [1, 0, 0, 0, 1, 1], "valid");
  equal(puzzle.occurrences, [3, 3]);
  equal(puzzle.edges.length, 7, "3×2 棋盘应只有 7 条正交候选边");
  check(!puzzle.edgeMap.has("2:3"));
});

test("exact-cover 分辨唯一、至少两解与无解，而不读取存储答案", () => {
  const unique = solvePuzzle(uniqueN1, { limit: 2 });
  equal(unique.count, 1);
  check(unique.unique);
  equal(unique.solution, ["0:3", "1:2", "4:5"]);
  const uniqueTruncated = solvePuzzle(uniqueN1, { limit: 1 });
  equal(uniqueTruncated.count, 1);
  check(uniqueTruncated.capped);
  check(!uniqueTruncated.unique, "唯一题在首解处截断时也不能宣称已证明唯一");
  const multiple = solvePuzzle(multipleN1, { limit: 2 });
  equal(multiple.count, 2);
  check(!multiple.unique);
  check(multiple.capped);
  const truncated = solvePuzzle(multipleN1, { limit: 1 });
  equal(truncated.count, 1);
  check(truncated.capped);
  check(!truncated.unique, "搜索在首解处截断时不能宣称唯一");
  const impossible = solvePuzzle(impossibleN1, { limit: 2 });
  equal(impossible.count, 0);
  check(!impossible.unique);
});

test("求解器严格处理确定边、排除边及冲突前置条件", () => {
  equal(solvePuzzle(uniqueN1, { limit: 2, requiredRooms: ["0:3"] }).count, 1);
  equal(solvePuzzle(uniqueN1, { limit: 2, excluded: ["0:3"] }).count, 0);
  equal(solvePuzzle(uniqueN1, { limit: 2, requiredRooms: ["0:1"] }).count, 0);
  equal(solvePuzzle(multipleN1, { limit: 2, requiredRooms: ["0:1"] }).count, 1);
  equal(solvePuzzle(multipleN1, { limit: 2, excluded: ["0:1"] }).count, 1);
  equal(solvePuzzle(uniqueN1, { limit: 2, requiredRooms: ["0:3"], excluded: ["0:3"] }).count, 0);
  equal(solvePuzzle(uniqueN1, { limit: 2, requiredRooms: ["0:1", "1:2"] }).count, 0);
  assert.throws(() => solvePuzzle(uniqueN1, { limit: 0 })); assertions += 1;
});

test("三档固定种子生成可复现、合法、可解且唯一声明都有证明", () => {
  const seeds = [0, "lantern", "moon-rain"];
  for (const difficulty of DIFFICULTIES) {
    equal(difficulty.width, difficulty.order + 2);
    equal(difficulty.height, difficulty.order + 1);
    for (const seed of seeds) {
      const first = generatePuzzle(difficulty.order, seed, { ensureUnique: true });
      const second = generatePuzzle(difficulty.order, seed, { ensureUnique: true });
      equal(first.id, second.id);
      equal(first.numbers, second.numbers);
      equal(first.solution, second.solution);
      equal(first.width, difficulty.width);
      equal(first.height, difficulty.height);
      check(first.uniquenessProven);
      const verification = verifyGeneratedPuzzle(first);
      check(verification.valid);
      check(verification.legalWitness);
      check(verification.legalStoredSolution);
      equal(verification.count, 1);
      for (let value = 0; value <= difficulty.order; value += 1) {
        equal(first.numbers.filter((item) => item === value).length, difficulty.order + 2);
      }
    }
  }
});

test("关闭唯一选项仍保留构造见证与求解验证，但不伪称多解", () => {
  for (const difficulty of DIFFICULTIES) {
    const puzzle = generatePuzzle(difficulty.order, `open-${difficulty.id}`, { ensureUnique: false });
    check(!puzzle.ensureUnique);
    check(puzzle.solutionCount >= 1);
    check(analyzePosition(puzzle, { rooms: new Set(puzzle.witness), excluded: new Set() }).complete);
    equal(puzzle.uniquenessProven, solvePuzzle(puzzle, { limit: 2 }).unique);
  }
});

test("确定配对再次操作拆房，排除线只在两端未入住时切换", () => {
  let position = createPosition();
  let result = applyEdgeAction(uniqueN1, position, "0:3", EDGE_ACTION.ROOM);
  check(result.accepted);
  equal([...result.position.rooms], ["0:3"]);
  result = applyEdgeAction(uniqueN1, result.position, "0:3", EDGE_ACTION.ROOM);
  equal(result.effect, "room-removed");
  equal([...result.position.rooms], []);
  result = applyEdgeAction(uniqueN1, result.position, "0:1", EDGE_ACTION.EXCLUDE);
  equal(result.effect, "exclusion-added");
  equal([...result.position.excluded], ["0:1"]);
  result = applyEdgeAction(uniqueN1, result.position, "0:1", EDGE_ACTION.EXCLUDE);
  equal(result.effect, "exclusion-removed");
  position = createPosition({ rooms: ["0:3"] });
  result = applyEdgeAction(uniqueN1, position, "0:1", EDGE_ACTION.EXCLUDE);
  check(!result.accepted);
  equal(result.reason, "occupied");
  equal(positionToJSON(result.position), { rooms: ["0:3"], excluded: [] });
});

test("新房原子拆掉一端或两端旧房，并清除两端全部排除线", () => {
  const oneRoom = createPosition({ rooms: ["0:3"] });
  let result = applyEdgeAction(uniqueN1, oneRoom, "0:1", EDGE_ACTION.ROOM);
  equal(result.removedRooms, ["0:3"]);
  equal(positionToJSON(result.position), { rooms: ["0:1"], excluded: [] });

  const twoRooms = createPosition({ rooms: ["0:3", "1:4"] });
  result = applyEdgeAction(uniqueN1, twoRooms, "0:1", EDGE_ACTION.ROOM);
  equal(result.removedRooms, ["0:3", "1:4"]);
  equal(positionToJSON(result.position), { rooms: ["0:1"], excluded: [] });

  let position = createPosition();
  for (const key of ["0:1", "0:3", "1:2", "1:4"]) {
    position = applyEdgeAction(uniqueN1, position, key, EDGE_ACTION.EXCLUDE).position;
  }
  equal([...position.excluded].sort(), ["0:1", "0:3", "1:2", "1:4"]);
  result = applyEdgeAction(uniqueN1, position, "0:1", EDGE_ACTION.ROOM);
  equal(result.removedExclusions, ["0:1", "0:3", "1:2", "1:4"]);
  equal(positionToJSON(result.position), { rooms: ["0:1"], excluded: [] });
});

test("满格但重复牌型标记所有副本且绝不误判通关", () => {
  const duplicateRooms = new Set(["0:3", "1:4", "2:5"]);
  const analysis = analyzePosition(multipleN1, { rooms: duplicateRooms, excluded: new Set() });
  equal(analysis.roomCount, 3);
  equal(analysis.coveredCount, 6);
  equal(analysis.usedPairCount, 1);
  equal(analysis.duplicatePairKeys, ["0-1"]);
  equal([...analysis.duplicateRooms].sort(), [...duplicateRooms].sort());
  check(!analysis.complete);
  const solved = analyzePosition(multipleN1, { rooms: new Set(solvePuzzle(multipleN1).solution), excluded: new Set() });
  check(solved.complete);
  const noteOnly = analyzePosition(multipleN1, { rooms: new Set(), excluded: new Set(["1:4"]) });
  equal(noteOnly.usedPairCount, 0, "排除笔记不得冒充已使用的牌型");
  equal(noteOnly.roomCount, 0, "排除笔记不得计入客房数");
});

test("严格存档位置拒绝非法边、重叠、重复数组与触及房间的排除线", () => {
  check(parsePosition(uniqueN1, { rooms: ["0:3"], excluded: ["1:2"] }));
  equal(parsePosition(uniqueN1, { rooms: ["0:3", "0:1"], excluded: [] }), null);
  equal(parsePosition(uniqueN1, { rooms: ["0:3", "0:3"], excluded: [] }), null);
  equal(parsePosition(uniqueN1, { rooms: ["2:3"], excluded: [] }), null);
  equal(parsePosition(uniqueN1, { rooms: ["0:3"], excluded: ["0:1"] }), null);
  equal(parsePosition(uniqueN1, { rooms: ["0:3"], excluded: ["0:3"] }), null);
});

test("同数字追踪最多两组，第三组不挤掉已有选择", () => {
  let highlights = toggleHighlight([], 0, 3);
  equal(highlights, [0]);
  highlights = toggleHighlight(highlights, 2, 3);
  equal(highlights, [0, 2]);
  equal(toggleHighlight(highlights, 3, 3), [0, 2]);
  highlights = toggleHighlight(highlights, 0, 3);
  equal(highlights, [2]);
  equal(toggleHighlight(highlights, 9, 3), [2]);
  equal(uniqueN1.numbers.map((value, index) => value === 0 ? index : null).filter((value) => value !== null), [1, 2, 3]);
  equal(uniqueN1.numbers.map((value, index) => value === 1 ? index : null).filter((value) => value !== null), [0, 4, 5]);
});

class FakeStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
    this.readKeys = [];
    this.writeKeys = [];
    this.removeKeys = [];
  }

  getItem(key) {
    this.readKeys.push(key);
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.writeKeys.push(key);
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.removeKeys.push(key);
    this.map.delete(key);
  }
}

test("全部本地键使用专属 v2 games 前缀，教程也不越界", () => {
  equal(STORAGE_PREFIX, "ten-realms-v2:games:yokai-inn:");
  equal(TUTORIAL_VERSION, 2);
  equal(STORAGE_KEYS.tutorial, `${STORAGE_PREFIX}tutorial:v2`);
  for (const key of Object.values(STORAGE_KEYS)) check(key.startsWith(STORAGE_PREFIX));
  const storage = new FakeStorage();
  loadProfile(storage);
  equal(tutorialSeen(storage), false);
  check(markTutorialSeen(storage));
  equal(tutorialSeen(storage), true);
  equal(JSON.parse(storage.map.get(STORAGE_KEYS.tutorial)), { version: 2, seen: true });
  saveProfile(storage, createDefaultProfile());
  const allKeys = [...storage.readKeys, ...storage.writeKeys, ...storage.removeKeys];
  check(allKeys.every((key) => key.startsWith(STORAGE_PREFIX)));
  check(!allKeys.some((key) => key.includes("progress:v1")));

  const previousTutorialKey = `${STORAGE_PREFIX}tutorial:v1`;
  const legacy = new FakeStorage({ [previousTutorialKey]: "seen", sentinel: "keep" });
  equal(tutorialSeen(legacy), false, "只看过旧教程的玩家必须自动看到本轮 v2 教程");
  check(markTutorialSeen(legacy));
  equal(tutorialSeen(legacy), true);
  equal(legacy.map.get(previousTutorialKey), "seen", "升级教程标记不得清理旧键或其他游戏数据");
  equal(legacy.map.get("sentinel"), "keep");
});

test("损坏 profile 只清本游戏 profile 键并安全回退，不碰其他数据", () => {
  const sentinel = "unrelated-user-data";
  const storage = new FakeStorage({ [STORAGE_KEYS.profile]: "{broken", [sentinel]: "keep" });
  const loaded = loadProfile(storage);
  equal(loaded.status, "invalid");
  equal(loaded.profile, createDefaultProfile());
  equal(storage.map.get(sentinel), "keep");
  equal(storage.removeKeys, [STORAGE_KEYS.profile]);
});

test("session 往返保留原子历史，完成态由规则重算并防止重复上报", () => {
  const puzzle = generatePuzzle(3, "save-roundtrip", { ensureUnique: true });
  const storage = new FakeStorage();
  const position = createPosition({ rooms: puzzle.solution });
  const history = [{ position: createPosition(), moves: 0, mistakes: 0 }];
  check(saveSession(storage, {
    puzzle,
    attemptId: "attempt-0001",
    position,
    history,
    moves: puzzle.dominoCount,
    mistakes: 0,
    elapsedMs: 1234,
    completionReported: false,
  }).ok);
  const restored = loadSession(storage, ({ order, seed, ensureUnique }) => generatePuzzle(order, seed, { ensureUnique }));
  equal(restored.status, "restored");
  check(restored.session.completed);
  check(!restored.session.completionReported, "未确认的终局刷新后必须保留重试状态");
  equal(restored.session.attemptId, "attempt-0001");
  equal(positionToJSON(restored.session.position), positionToJSON(position));
  equal(restored.session.history.length, 1);
  equal(restored.session.elapsedMs, 1234);
});

test("完成 outbox 按 attemptId 稳定重试，并保留同题的不同重开局", () => {
  const puzzle = generatePuzzle(3, "outbox-roundtrip", { ensureUnique: true });
  const position = createPosition({ rooms: puzzle.solution });
  const first = recordCompletion(createDefaultProfile(), {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: puzzle.dominoCount,
    mistakes: 0,
  });
  const firstDetail = completionDetail(puzzle, first, "attempt-1001");
  let entries = [...mergeCompletionOutbox([], firstDetail)];
  equal(entries.length, 1);

  const retried = recordCompletion(first.profile, {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: puzzle.dominoCount,
    mistakes: 0,
  });
  check(retried.claims.length === 0, "本地档案重放必须保持幂等");
  entries = [...mergeCompletionOutbox(entries, completionDetail(puzzle, retried, "attempt-1001"))];
  equal(entries.length, 1, "同一局重试只能保留一份 outbox 项");
  equal(entries[0].rewardIds, firstDetail.rewardIds, "崩溃后空 claims 重算不能抹掉已暂存奖励");

  entries = [...mergeCompletionOutbox(entries, completionDetail(puzzle, retried, "attempt-1002"))];
  equal(entries.length, 2, "同题重开是不同 run，不能按 puzzleId 折叠");
  check(entries[0].completionId !== entries[1].completionId);

  const storage = new FakeStorage();
  check(saveCompletionOutbox(storage, entries).ok);
  const loaded = loadCompletionOutbox(storage);
  equal(loaded.status, "restored");
  equal(loaded.entries.length, 2);
  const remaining = removeCompletionOutbox(loaded.entries, firstDetail.completionId);
  equal(remaining.length, 1);
  equal(remaining[0].attemptId, "attempt-1002");
});

test("outbox 派发只采用官方题面重算的奖励结果", () => {
  const puzzle = generatePuzzle(3, "outbox-canonical-rewards", { ensureUnique: true });
  const position = createPosition({ rooms: puzzle.solution });
  const firstMoves = puzzle.dominoCount + 4;
  const first = recordCompletion(createDefaultProfile(), {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: firstMoves,
    mistakes: 1,
  });
  const firstDetail = completionDetail(puzzle, first, "attempt-2001", { moves: firstMoves, mistakes: 1 });
  const expectedFirstIds = first.claims.map(({ id }) => id);
  const forgedClaims = [
    {
      id: `yokai-inn:flawless:${puzzle.id}`,
      kind: "flawless",
      label: "无误排房",
      suggestedXp: 35,
    },
    {
      id: "yokai-inn:star:5",
      kind: "star",
      label: "旅店晋升为 5 星",
      suggestedXp: 90,
    },
    {
      id: `yokai-inn:best:${puzzle.id}:${firstMoves + 100}`,
      kind: "best",
      label: `刷新旅簿：${firstMoves + 100} 步`,
      suggestedXp: 25,
    },
  ];
  for (const claim of forgedClaims) {
    const forged = {
      ...firstDetail,
      rewardIds: [claim.id],
      rewardClaims: [claim],
      starLevel: claim.kind === "star" ? 5 : firstDetail.starLevel,
    };
    const canonical = canonicalCompletionDetail(forged, first, puzzle);
    equal(canonical.rewardIds, expectedFirstIds, `${claim.kind} 伪造必须被重算结果替换`);
    check(!canonical.rewardIds.includes(claim.id), `${claim.kind} 伪造不得出站`);
    equal(canonical.starLevel, first.starLevel);
    check(!canonical.flawless);
  }

  const persistedFirst = recordCompletion(first.profile, {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: firstMoves,
    mistakes: 1,
  });
  equal(persistedFirst.claims, []);
  const retriedFirstDetail = canonicalCompletionDetail(firstDetail, persistedFirst, puzzle);
  equal(retriedFirstDetail.rewardIds, expectedFirstIds, "profile 已落盘时仍必须保留合法的 pending rewards");

  const bestMoves = puzzle.dominoCount + 2;
  const improved = recordCompletion(first.profile, {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: bestMoves,
    mistakes: 0,
  });
  const improvedDetail = canonicalCompletionDetail(
    completionDetail(puzzle, improved, "attempt-2002", { moves: bestMoves, mistakes: 0 }),
    improved,
    puzzle,
  );
  check(improvedDetail.rewardIds.includes(`yokai-inn:best:${puzzle.id}:${bestMoves}`));
  check(improvedDetail.rewardIds.includes(`yokai-inn:flawless:${puzzle.id}`));

  const repeated = recordCompletion(improved.profile, {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: bestMoves,
    mistakes: 0,
  });
  const pendingRetry = canonicalCompletionDetail(improvedDetail, repeated, puzzle);
  equal(pendingRetry.rewardIds, improvedDetail.rewardIds, "重算空 claims 不得抹掉已落盘且尚未送达的合法奖励");

  const repeatedDetail = canonicalCompletionDetail(
    completionDetail(puzzle, repeated, "attempt-2003", { moves: bestMoves, mistakes: 0 }),
    repeated,
    puzzle,
  );
  equal(repeatedDetail.rewardIds, [], "新 attempt 的重复完成不得重领奖励");
  equal(repeatedDetail.rewardClaims, []);
});

test("兼容完成适配器异常时按稳定 completionId 入队，成功时可确认送达", () => {
  const puzzle = generatePuzzle(3, "delivery", { ensureUnique: true });
  const position = createPosition({ rooms: puzzle.solution });
  const result = recordCompletion(createDefaultProfile(), {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: puzzle.dominoCount,
    mistakes: 0,
  });
  const detail = completionDetail(puzzle, result, "attempt-2001");
  const throwingTarget = {
    RealmArcade: { complete() { throw new Error("adapter unavailable"); } },
  };
  const queued = reportCompatibilityCompletion(throwingTarget, detail);
  check(!queued.delivered && queued.queued);
  equal(throwingTarget.__realmCompletionQueue.length, 1);
  reportCompatibilityCompletion(throwingTarget, detail);
  equal(throwingTarget.__realmCompletionQueue.length, 1, "同一 run 重试不得重复堆积队列");

  const calls = [];
  const delivered = reportCompatibilityCompletion({ RealmArcade: { complete(payload) { calls.push(payload); } } }, detail);
  check(delivered.delivered && !delivered.queued);
  equal(calls.length, 1);
  equal(calls[0].completionId, detail.completionId);
  equal(calls[0].levelId, puzzle.id);
});

test("异题、越界状态与超长历史 session 全部整份回退", () => {
  const puzzle = generatePuzzle(3, "bad-save", { ensureUnique: true });
  const baseStorage = new FakeStorage();
  saveSession(baseStorage, {
    puzzle,
    attemptId: "attempt-0002",
    position: createPosition(),
    history: [],
    moves: 0,
    mistakes: 0,
    elapsedMs: 0,
    completionReported: false,
  });
  const raw = JSON.parse(baseStorage.map.get(STORAGE_KEYS.session));
  const variants = [
    { ...raw, active: { ...raw.active, puzzleId: `${raw.active.puzzleId}-foreign` } },
    { ...raw, active: { ...raw.active, position: { rooms: ["4:5"], excluded: [] } } },
    { ...raw, active: { ...raw.active, history: Array.from({ length: HISTORY_LIMIT + 1 }, () => raw.active) } },
    { ...raw, version: 99 },
  ];
  for (const variant of variants) {
    const storage = new FakeStorage({ [STORAGE_KEYS.session]: JSON.stringify(variant), sentinel: "keep" });
    const loaded = loadSession(storage, ({ order, seed, ensureUnique }) => generatePuzzle(order, seed, { ensureUnique }));
    equal(loaded.status, "invalid");
    equal(loaded.session, null);
    equal(storage.map.get("sentinel"), "keep");
    equal(storage.removeKeys, [STORAGE_KEYS.session]);
  }
});

test("图鉴、稀有组合、无误排房与奖励 ID 均可去重", () => {
  const puzzle = generatePuzzle(3, "reward", { ensureUnique: true });
  const position = createPosition({ rooms: puzzle.solution });
  let profile = createDefaultProfile();
  let result = recordCompletion(profile, {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: 18,
    mistakes: 1,
  });
  profile = result.profile;
  check(result.firstClear);
  check(!result.flawless);
  equal(profile.stats.compendium.length, 10);
  equal(profile.stats.rarePairs.length, 4);
  equal(new Set(result.claims.map(({ id }) => id)).size, result.claims.length);
  check(result.claims.every(({ id }) => id.startsWith("yokai-inn:")));

  result = recordCompletion(profile, { puzzle, difficultyId: "cozy", position, moves: 10, mistakes: 0 });
  profile = result.profile;
  check(!result.firstClear);
  check(result.personalBest);
  check(result.flawless);
  check(result.claims.some(({ kind }) => kind === "best"));
  check(result.claims.some(({ kind }) => kind === "flawless"));
  equal(profile.stats.cleanPuzzleIds, [puzzle.id]);

  const repeated = recordCompletion(profile, { puzzle, difficultyId: "cozy", position, moves: 10, mistakes: 0 });
  equal(repeated.claims, []);
  equal(new Set(repeated.profile.stats.rewardLedger.map(({ id }) => id)).size, repeated.profile.stats.rewardLedger.length);
});

test("profile 拒绝伪造奖励元数据与未达成里程碑", () => {
  const puzzle = generatePuzzle(3, "reward-integrity", { ensureUnique: true });
  const position = createPosition({ rooms: puzzle.solution });
  const result = recordCompletion(createDefaultProfile(), {
    puzzle,
    difficultyId: "cozy",
    position,
    moves: puzzle.dominoCount,
    mistakes: 0,
  });
  const forgedXp = JSON.parse(JSON.stringify(result.profile));
  forgedXp.stats.rewardLedger[0].suggestedXp = 9999;
  assert.throws(() => normalizeProfile(forgedXp)); assertions += 1;

  const forgedStar = JSON.parse(JSON.stringify(result.profile));
  forgedStar.stats.rewardLedger.push({ id: "yokai-inn:star:5", kind: "star", label: "旅店晋升为 5 星", suggestedXp: 90 });
  assert.throws(() => normalizeProfile(forgedStar)); assertions += 1;

  const detachedRare = JSON.parse(JSON.stringify(result.profile));
  detachedRare.stats.compendium = detachedRare.stats.compendium.filter((key) => key !== detachedRare.stats.rarePairs[0]);
  assert.throws(() => normalizeProfile(detachedRare)); assertions += 1;
});

test("五星里程碑是递进长期目标且不信任存档中的 starLevel", () => {
  const profile = createDefaultProfile();
  equal(starSummary(profile.stats).level, 0);
  const fabricated = createDefaultProfile();
  fabricated.stats.starLevel = 5;
  equal(normalizeProfile(fabricated).stats.starLevel, 0);
  const stats = createDefaultProfile().stats;
  stats.completedPuzzleIds = Array.from({ length: 15 }, (_, index) => `yokai-inn:g1:o3:u:${(100 + index).toString(36)}:a0`);
  stats.cleanPuzzleIds = stats.completedPuzzleIds.slice(0, 6);
  stats.clearsByDifficulty = { cozy: 5, bustling: 5, moonlit: 5 };
  stats.compendium = Object.keys(YOKAI_GUESTS);
  equal(starSummary(stats).level, 5);
  equal(starSummary(stats).next, null);
});

await testAsync("HTML、SVG、CSS 与完成 API 接线满足教程/无障碍/集成合同", async () => {
  const [html, css, app, logic, profileSource, deliverySource, layoutSource, ...svgs] = await Promise.all([
    readFile(path.join(directory, "index.html"), "utf8"),
    readFile(path.join(directory, "styles.css"), "utf8"),
    readFile(path.join(directory, "app.mjs"), "utf8"),
    readFile(path.join(directory, "logic.mjs"), "utf8"),
    readFile(path.join(directory, "profile.mjs"), "utf8"),
    readFile(path.join(directory, "delivery.mjs"), "utf8"),
    readFile(path.join(directory, "layout.mjs"), "utf8"),
    ...["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"].map((name) => readFile(path.join(directory, "assets", name), "utf8")),
  ]);

  check(/href="\.\.\/\.\.\/"[^>]*aria-label="返回十境谜游馆 2\.0"/.test(html), "返回按钮必须指向 ../../");
  check(html.includes('data-realm="yokai-inn"'));
  check(html.includes('../../shared/realm-ui.css'));
  check(html.includes('../../shared/realm-ui.mjs'));
  check(html.indexOf('../../shared/realm-ui.mjs') < html.indexOf('./app.mjs'), "共享成长层必须先于游戏应用加载");
  check(html.includes('href="../../assets/favicon.svg"'));
  equal([...html.matchAll(/<img\s+src="\.\/assets\/tutorial-[^"]+\.svg\?tutorial=2"/g)].length, 3);
  equal([...html.matchAll(/<article class="tutorial-page"/g)].length, 3);
  check(html.includes("https://github.com/ebnbin/puzzles/blob/main/doc-zh/dominosa.html"));
  check(html.includes("../../THIRD_PARTY_NOTICES.md"));
  check(html.includes('role="grid"'));
  check(html.includes('aria-live="assertive"'));
  check(html.includes('aria-label="声音开关"') && html.includes('aria-label="教程"') && html.includes('aria-label="规则"'));
  equal([...html.matchAll(/<dialog\b/g)].length, 4);
  check(!/<script[^>]+src="https?:/i.test(html));
  check(!/<link[^>]+href="https?:/i.test(html));

  const states = ["elements", "action", "goal"];
  svgs.forEach((svg, index) => {
    check(svg.includes('preserveAspectRatio="xMidYMid meet"'));
    check(svg.includes(`data-tutorial-state="${states[index]}"`));
    check(svg.includes('role="img"'));
    check(!/href="https?:|url\(https?:/i.test(svg));
  });
  check(svgs[1].includes("01 · 先点需求 0") && svgs[1].includes("02 · 再点右侧需求 3"), "操作图必须把前后状态放在两个独立面板");
  check(!/opacity="0\.[0-9]+"/.test(svgs[1]), "操作图不得靠前后状态叠加淡化");
  equal(new Set(svgs).size, 3);

  const tutorialSeed = Number(svgAttribute(svgs[2], "data-seed"));
  const tutorialPuzzle = generatePuzzle(Number(svgAttribute(svgs[2], "data-order")), tutorialSeed, { ensureUnique: true });
  equal(tutorialPuzzle.id, svgAttribute(svgs[2], "data-puzzle-id"));
  equal(tutorialPuzzle.numbers, svgAttribute(svgs[2], "data-numbers").split(",").map(Number), "通关图数字必须来自真实生成题面");
  equal(tutorialPuzzle.solution, svgAttribute(svgs[2], "data-solution").split(","), "通关图房框必须来自求解器真实解");
  const tutorialSolution = createPosition({ rooms: tutorialPuzzle.solution });
  const tutorialAnalysis = analyzePosition(tutorialPuzzle, tutorialSolution);
  check(tutorialAnalysis.complete && tutorialAnalysis.legalState);
  equal(tutorialAnalysis.roomCount, tutorialPuzzle.dominoCount);
  equal(tutorialAnalysis.usedPairCount, tutorialPuzzle.pairKeys.length);
  equal(solvePuzzle(tutorialPuzzle, { limit: 2 }).count, 1, "图片标注的唯一解必须可由 exact-cover 复证");

  const actionEdge = svgAttribute(svgs[1], "data-edge");
  const actionResult = applyEdgeAction(tutorialPuzzle, createPosition(), actionEdge, svgAttribute(svgs[1], "data-action"));
  check(actionResult.accepted);
  check(actionResult.position.rooms.has(actionEdge));
  equal(tutorialPuzzle.numbers[Number(svgAttribute(svgs[1], "data-first-cell"))], 0);
  equal(tutorialPuzzle.numbers[Number(svgAttribute(svgs[1], "data-second-cell"))], 3);

  const elementPosition = createPosition({
    rooms: svgAttribute(svgs[0], "data-rooms").split(","),
    excluded: svgAttribute(svgs[0], "data-excluded").split(","),
  });
  check(analyzePosition(tutorialPuzzle, elementPosition).legalState, "元素图的房框与排除线必须组成合法实机状态");
  const highlightGroups = [...svgs[0].matchAll(/<g data-real-element="highlight-[ab]" data-highlight-value="(\d+)"[^>]*>([\s\S]*?)<\/g>/g)];
  equal(highlightGroups.length, 2, "元素图必须分别展示两种真实需求追踪印");
  for (const [, rawValue, marks] of highlightGroups) {
    const cells = [...marks.matchAll(/data-cell="(\d+)"/g)].map((match) => Number(match[1]));
    check(cells.length > 0, `需求 ${rawValue} 的追踪印必须绑定至少一个真实格`);
    for (const cell of cells) {
      equal(tutorialPuzzle.numbers[cell], Number(rawValue), `需求 ${rawValue} 的追踪印不得画在其他数字上`);
    }
  }

  check(css.includes("min-width: 44px"));
  check(css.includes("width: 44px"));
  check(css.includes("height: 44px"));
  check(css.includes("@media (max-width: 360px)"));
  check(css.includes("@media (prefers-reduced-motion: reduce)"));
  check(css.includes("overflow-x: hidden"));
  check(css.includes("max-height: 96dvh"));
  check(css.includes(".room-overlay.is-duplicate::after"), "冲突必须有三角形状提示，不只靠颜色");
  check(css.includes(".number-cell.is-highlight-b"), "第二高亮必须有不同形状");
  check(css.includes(".board-viewport.is-compact-fit") && css.includes("overflow: hidden"), "手机棋盘不得依赖横向滚动");
  check(/\.inn-board\.is-compact-fit \.edge-hit[\s\S]*?display: none;/.test(css), "紧凑棋盘应关闭相互重叠的接缝命中层");
  check(/\.inn-board\.is-compact-fit \.number-cell[\s\S]*?min-width: 0;[\s\S]*?touch-action: manipulation;/.test(css), "紧凑数字格必须可缩放并支持直接触控");
  check(html.includes("手机端已把完整房图收进一屏") && !html.includes("大馆可在房图内左右滑动"));
  check(app.includes("computeCompactBoardMetrics") && app.includes("ResizeObserver"), "房图应随真实可用宽度重新适配");
  check(layoutSource.includes("boardWidth <= width"), "尺寸计算必须显式证明不超出可用宽度");

  check(!/\bdocument\b|\bwindow\b|localStorage/.test(logic), "规则引擎必须与 DOM/存储分离");
  check(app.includes('new CustomEvent("ten-realms-v2:game-complete"'));
  check(app.includes('new CustomEvent("ten-realms-v2:reward-earned"'));
  const dispatchSource = app.match(/function dispatchCompletionEvents\(detail\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  const rewardLoopIndex = dispatchSource.indexOf("for (const claim of detail.rewardClaims)");
  check(app.includes("const announcedRewardIds = new Set();"), "奖励事件必须有独立的防重集合");
  check(/if \(!announcedCompletionIds\.has\(detail\.completionId\)\)/.test(dispatchSource), "完成事件必须继续按 completionId 防重");
  check(rewardLoopIndex >= 0 && !/\breturn\b/.test(dispatchSource.slice(0, rewardLoopIndex)), "已公告的完成事件不得提前阻断新奖励");
  check(/if \(announcedRewardIds\.has\(claim\.id\)\) continue;[\s\S]*?announcedRewardIds\.add\(claim\.id\);/.test(dispatchSource), "奖励事件必须独立按 claim.id 防重");
  check(app.includes('from "./delivery.mjs"'));
  check(deliverySource.includes("target?.RealmArcade?.complete"));
  check(deliverySource.includes("target.__realmCompletionQueue"));
  check(/try\s*{\s*localStorageRef = window\.localStorage;/.test(app), "localStorage getter 必须安全降级");
  check(/catch\s*{[\s\S]*?stable-id queue/.test(deliverySource), "RealmArcade 异常必须安全入队");
  check(deliverySource.includes("levelId: detail.levelId"));
  check(deliverySource.includes("tier: detail.tier"));
  check(deliverySource.includes("moves: detail.moves"));
  check(deliverySource.includes("par: detail.par"));
  check(/if \(!analysis\.complete \|\| state\.completionReported\) return;/.test(app), "同一胜利必须由 completionReported 防重");
  check(app.includes("mergeCompletionOutbox(completionOutbox, detail)"));
  check(app.includes("flushCompletionOutbox();"));
  check(app.includes('window.addEventListener("realm:ready", flushCompletionOutbox)'));
  check(app.includes("completionId: currentCompletionId()"));
  check(app.includes("window.YokaiInn = publicApi"));
  check(app.includes("showModal"));
  check(app.includes('event.key !== "Tab"'), "模态必须显式隔离循环焦点");
  check(app.includes("tutorialSeen(localStorageRef)"));
  check(app.includes("markTutorialSeen(localStorageRef)"));
  check(app.includes("setTimeout(() => openTutorial(true)"));
  check(app.includes("contextmenu"));
  check(app.includes("pointerType"));
  check(app.includes("onGlobalKeydown"));
  check(app.includes("if (event.metaKey || event.ctrlKey || event.altKey) return;"));
  check(app.includes("solvePuzzle(state.puzzle"), "UI 每一步的无误判定必须由求解器接线");

  const allSource = `${html}\n${app}\n${logic}\n${profileSource}\n${deliverySource}`;
  check(allSource.includes("ten-realms-v2:games:yokai-inn:"));
  check(!allSource.includes("ten-realms:progress:v1"));
  check(!allSource.includes("ten-realms:tutorial:"));
  check(!allSource.includes("ten-realms-v2:yokai-inn:"));
  check(html.includes('<script type="module" src="./app.mjs"></script>') && !html.includes('./app.mjs?'));
});

console.log(`Yokai Inn: ${cases}/${cases} cases passed, ${assertions} assertions; 3 scales and exact-cover proofs verified.`);
