import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DIRECTION_ORDER,
  DIRECTIONS,
  applyLink,
  applyAutoLinks,
  candidateTargets,
  cellCount,
  clearAlgebraicChain,
  clearCell,
  connectionSegment,
  createPosition,
  defineLevel,
  deriveLabels,
  deserializePosition,
  evaluatePosition,
  givenMaps,
  indexFor,
  linksOf,
  pointFor,
  pointsAlongDirection,
  positionFromPath,
  referenceTimeline,
  serializePosition,
  solveLevel,
  validateLevel,
  validatePosition,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  findLevel,
  firstLevel,
  levelsForDifficulty,
  nextLevel,
} from "./levels.mjs";
import {
  HISTORY_LIMIT,
  STORAGE_KEYS,
  STORAGE_PREFIX,
  createRunId,
  createSession,
  defaultRecords,
  defaultSettings,
  enqueueOutbox,
  loadOutbox,
  loadRecords,
  loadSession,
  loadSettings,
  markTutorialSeen,
  normalizeOutbox,
  normalizeRecords,
  recordCompletion,
  removeFromOutbox,
  saveOutbox,
  saveRecords,
  saveSession,
  saveSettings,
  tutorialSeen,
  validEventId,
  validRunId,
} from "./storage.mjs";
import {
  COMPLETION_EVENT,
  COMPLETION_QUEUE,
  COMPLETION_SCHEMA,
  GAME_ID,
  completionTransport,
  createCompletion,
  deliverCompletion,
  normalizeCompletion,
  replayTimeline,
  validCompletion,
} from "./completion.mjs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.mjs", import.meta.url), "utf8");
const rules = readFileSync(new URL("./RULES.md", import.meta.url), "utf8");
const svgEntries = ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"].map((name) => ({
  name,
  source: readFileSync(new URL(`./assets/${name}`, import.meta.url), "utf8"),
}));
const tutorialLevel = findLevel("chronicle-dawn");
const RUN_A = "time-sand-post-test-run-alpha";
const RUN_B = "time-sand-post-test-run-bravo";

const REFERENCE_ORACLE = Object.freeze({
  "chronicle-dawn": Object.freeze({
    initial: Object.freeze([[2, 7], [4, 14]]),
    edgeCounts: Object.freeze([3, 5, 7, 8, 10, 12, 13, 15]),
  }),
  "amber-relay": Object.freeze({
    initial: Object.freeze([[5, 15], [10, 7], [14, 10]]),
    edgeCounts: Object.freeze([4, 5, 7, 8, 10, 11, 13, 15]),
  }),
  "moonlit-dispatch": Object.freeze({
    initial: Object.freeze([[7, 5], [13, 18], [23, 21]]),
    edgeCounts: Object.freeze([5, 6, 8, 9, 10, 11, 13, 15, 16, 17, 19, 20, 21, 22, 24]),
  }),
  "glass-hour-route": Object.freeze({
    initial: Object.freeze([[20, 21]]),
    edgeCounts: Object.freeze([3, 4, 6, 8, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 24]),
  }),
  "eclipse-express": Object.freeze({
    initial: Object.freeze([[9, 3], [11, 23], [26, 19], [27, 15]]),
    edgeCounts: Object.freeze([6, 7, 8, 10, 11, 12, 14, 16, 17, 19, 21, 22, 23, 25, 26, 27, 29]),
  }),
  "last-bell-circuit": Object.freeze({
    initial: Object.freeze([[14, 21], [15, 20], [21, 15], [24, 12], [25, 28], [28, 27]]),
    edgeCounts: Object.freeze([8, 10, 12, 13, 14, 15, 16, 18, 19, 21, 23, 24, 25, 26, 27, 29]),
  }),
});

const tests = [];
let assertions = 0;

function test(name, callback) { tests.push({ name, callback }); }
function equal(actual, expected, message) { assertions += 1; assert.deepEqual(actual, expected, message); }
function strictEqual(actual, expected, message) { assertions += 1; assert.strictEqual(actual, expected, message); }
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function match(value, pattern, message) { assertions += 1; assert.match(value, pattern, message); }
function doesNotMatch(value, pattern, message) { assertions += 1; assert.doesNotMatch(value, pattern, message); }
function throws(callback, expected, message) { assertions += 1; assert.throws(callback, expected, message); }

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries).map(([key, value]) => [key, String(value)]));
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

function solutionFor(level) {
  const result = solveLevel(level, 2);
  strictEqual(result.count, 1, `${level.id} 必须只有一解`);
  strictEqual(result.truncated, false, `${level.id} 必须穷尽到证明唯一`);
  return result.solutions[0];
}

const timelineCache = new Map();

function timelineFor(level) {
  if (!timelineCache.has(level.id)) {
    const timeline = referenceTimeline(level);
    if (!timeline) throw new TypeError(`No replayable reference timeline for ${level.id}`);
    timelineCache.set(level.id, timeline);
  }
  return timelineCache.get(level.id);
}

function detourTimelineFor(level) {
  const solved = timelineFor(level);
  return Object.freeze([
    solved[0],
    Object.freeze({ type: "clear", cell: solved[0].from }),
    ...solved,
  ]);
}

function completionFor(level = tutorialLevel, runId = RUN_A, options = {}) {
  const timeline = options.timeline ?? timelineFor(level);
  const replay = replayTimeline(level, timeline);
  return createCompletion(level, runId, {
    moves: options.moves ?? timeline.length,
    elapsedMs: options.elapsedMs ?? 42_000,
    timeline,
    edges: options.edges ?? replay?.edges,
  }, options.completedAt ?? new Date("2026-09-01T08:00:00.000Z"));
}

function parseTutorialCells(source) {
  const cells = [];
  const pattern = /<g data-cell-index="(\d+)" data-direction="([^"]*)" data-given="([^"]*)"(?: data-cell-number="([^"]*)")?/g;
  for (const item of source.matchAll(pattern)) {
    cells.push({
      index: Number(item[1]),
      direction: item[2] || null,
      given: item[3] === "" ? 0 : Number(item[3]),
      number: item[4] === undefined ? null : Number(item[4]),
    });
  }
  return cells;
}

test("八向常量的顺序、向量、字形与文字同源", () => {
  equal(DIRECTION_ORDER, ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  equal(Object.fromEntries(DIRECTION_ORDER.map((id) => [id, [DIRECTIONS[id].dx, DIRECTIONS[id].dy, DIRECTIONS[id].glyph]])), {
    N: [0, -1, "↑"], NE: [1, -1, "↗"], E: [1, 0, "→"], SE: [1, 1, "↘"],
    S: [0, 1, "↓"], SW: [-1, 1, "↙"], W: [-1, 0, "←"], NW: [-1, -1, "↖"],
  });
  const expectedTargets = { N: [1], NE: [2], E: [5], SE: [8], S: [7], SW: [6], W: [3], NW: [0] };
  for (const direction of DIRECTION_ORDER) {
    const level = { width: 3, height: 3, directions: Array(9).fill(null) };
    level.directions[4] = direction;
    equal(candidateTargets(level, 4), expectedTargets[direction], `${direction} 的中心格落点`);
  }
  match(app, /DIRECTIONS\[direction\]\.glyph/);
});

test("坐标转换在边界和非整数上安全", () => {
  equal(pointFor(tutorialLevel, 0), { x: 0, y: 0 });
  equal(pointFor(tutorialLevel, 15), { x: 3, y: 3 });
  strictEqual(pointFor(tutorialLevel, -1), null);
  strictEqual(pointFor(tutorialLevel, 1.5), null);
  strictEqual(indexFor(tutorialLevel, 3, 3), 15);
  strictEqual(indexFor(tutorialLevel, 4, 3), -1);
  strictEqual(indexFor(tutorialLevel, 0.5, 1), -1);
});

test("渲染线段沿单位向量在两端留下固定数字安全区", () => {
  const horizontal = connectionSegment(tutorialLevel, 9, 10);
  equal(horizontal, { x1: 1.88, y1: 2.5, x2: 2.12, y2: 2.5 });
  const diagonal = connectionSegment(tutorialLevel, 4, 14);
  const from = pointFor(tutorialLevel, 4);
  const to = pointFor(tutorialLevel, 14);
  ok(Math.abs(Math.hypot(diagonal.x1 - (from.x + 0.5), diagonal.y1 - (from.y + 0.5)) - 0.38) < 1e-12);
  ok(Math.abs(Math.hypot(diagonal.x2 - (to.x + 0.5), diagonal.y2 - (to.y + 0.5)) - 0.38) < 1e-12);
  strictEqual(connectionSegment(tutorialLevel, 9, 9), null);
  strictEqual(connectionSegment(tutorialLevel, 9, 10, 0.5), null);
  strictEqual(connectionSegment(tutorialLevel, 9, 13), null, "非射线不能生成伪路线");
});

test("六个正式题面按三档各两个且结构合法", () => {
  strictEqual(LEVELS.length, 6);
  equal(DIFFICULTIES.map(({ id }) => id), ["easy", "medium", "hard"]);
  equal(LEVELS.map(({ id }) => id), [
    "chronicle-dawn", "amber-relay", "moonlit-dispatch", "glass-hour-route", "eclipse-express", "last-bell-circuit",
  ]);
  equal(LEVELS.map(({ seed }) => seed), [11021, 11037, 22041, 22069, 33073, 33107]);
  for (const [index, difficulty] of DIFFICULTIES.entries()) {
    const group = levelsForDifficulty(difficulty.id);
    strictEqual(group.length, 2);
    group.forEach((level) => {
      equal(validateLevel(level), []);
      strictEqual(level.tier, index + 1);
      strictEqual(level.par, cellCount(level) - level.givens.length);
      strictEqual(level.directions.filter((item) => item === null).length, 1);
      ok(level.givens.some(([, number]) => number === 1));
      ok(level.givens.some(([, number]) => number === cellCount(level)));
      ok(Object.isFrozen(level));
    });
  }
  strictEqual(firstLevel("medium").id, "moonlit-dispatch");
  strictEqual(nextLevel(findLevel("moonlit-dispatch")).id, "glass-hour-route");
  strictEqual(nextLevel(findLevel("glass-hour-route")).id, "moonlit-dispatch");
  strictEqual(findLevel("__proto__"), null);
  equal(LEVELS.map(({ par }) => par), [8, 8, 15, 16, 17, 16]);
});

test("六关开局自动边与固定 C 真源逐项一致", () => {
  equal(LEVELS.map((level) => linksOf(createPosition(level)).length), [2, 3, 3, 1, 4, 6]);
  for (const level of LEVELS) {
    equal(linksOf(createPosition(level)), REFERENCE_ORACLE[level.id].initial, `${level.id} 开局自动边`);
  }
});

test("六关参考操作逐步改变局面并在真实 par 时完成", () => {
  for (const level of LEVELS) {
    const timeline = timelineFor(level);
    strictEqual(timeline.length, level.par, `${level.id} 参考操作数`);
    let position = createPosition(level);
    const edgeCounts = [];
    timeline.forEach((action, index) => {
      const result = applyLink(level, position, action.from, action.to);
      strictEqual(result.changed, true, `${level.id} 第 ${index + 1} 步必须被 fixed C 接受`);
      position = result.position;
      const evaluation = evaluatePosition(level, position);
      edgeCounts.push(evaluation.linkCount);
      strictEqual(evaluation.complete, index === timeline.length - 1, `${level.id} 第 ${index + 1} 步完成边界`);
    });
    equal(edgeCounts, REFERENCE_ORACLE[level.id].edgeCounts, `${level.id} 单轮自动补线后的逐步边数`);
    strictEqual(linksOf(position).length, cellCount(level) - 1);
  }
});

test("六关均由不读内置答案的 limit=2 搜索证明唯一", () => {
  for (const level of LEVELS) {
    const path = solutionFor(level);
    strictEqual(path.length, cellCount(level));
    strictEqual(new Set(path).size, cellCount(level));
    const { cellByNumber } = givenMaps(level);
    strictEqual(path[0], cellByNumber[1]);
    strictEqual(path.at(-1), cellByNumber[cellCount(level)]);
    level.givens.forEach(([cell, number]) => strictEqual(path[number - 1], cell, `${level.id} 固定数 ${number}`));
    for (let index = 0; index < path.length - 1; index += 1) {
      ok(pointsAlongDirection(level, path[index], path[index + 1]), `${level.id} 第 ${index + 1} 段必须严格同射线`);
    }
    const solved = positionFromPath(level, path);
    ok(solved);
    const evaluation = evaluatePosition(level, solved);
    strictEqual(evaluation.complete, true);
    strictEqual(evaluation.linkCount, cellCount(level) - 1);
    strictEqual(evaluation.chainCount, 1);
    strictEqual(evaluation.numberedCount, cellCount(level));
  }
});

test("首关的真实唯一路径与教程基准固定", () => {
  equal(solutionFor(tutorialLevel), [8, 12, 0, 4, 14, 15, 13, 1, 5, 9, 10, 11, 6, 3, 2, 7]);
  equal(tutorialLevel.directions, ["S", "S", "SE", "W", "SE", "S", "NE", null, "S", "E", "E", "NW", "N", "N", "E", "W"]);
  equal(tutorialLevel.givens, [[8, 1], [4, 4], [14, 5], [13, 7], [9, 10], [11, 12], [2, 15], [7, 16]]);
});

test("合法连线改变恰好两个端点，非射线操作为原子 no-op", () => {
  const initial = createPosition(tutorialLevel);
  ok(validatePosition(tutorialLevel, initial));
  equal(linksOf(initial), [[2, 7], [4, 14]], "new_game 必须先补固定 4→5 与 15→16");
  const linked = applyLink(tutorialLevel, initial, 8, 12);
  strictEqual(linked.changed, true);
  strictEqual(linked.reason, "linked");
  strictEqual(linked.position.next[8], 12);
  strictEqual(linked.position.previous[12], 8);
  strictEqual(linksOf(linked.position).length, 3);
  const invalid = applyLink(tutorialLevel, initial, 8, 13);
  strictEqual(invalid.changed, false);
  strictEqual(invalid.reason, "off-ray");
  strictEqual(invalid.position, initial, "非法连线必须保留原对象");
});

test("开局自动边保留 pre-auto DSF，下一次相同 L 操作仍由上游接受", () => {
  const initial = createPosition(tutorialLevel);
  strictEqual(initial.next[4], 14);
  strictEqual(initial.previous[14], 4);
  ok(initial.regions[4] !== initial.regions[14], "check_completion 自动边不得回写本轮 DSF");
  const repeated = applyLink(tutorialLevel, initial, 4, 14);
  strictEqual(repeated.changed, true, "fixed C 会接受 L0,1-2,3 并计为一次操作");
  equal(linksOf(repeated.position), linksOf(initial), "重复自动边的端点集合不变");
  strictEqual(repeated.position.regions[4], repeated.position.regions[14], "下一轮 update_numbers 才合并 DSF");
});

test("为起点重选后继会释放旧后继端", () => {
  const first = applyLink(tutorialLevel, createPosition(tutorialLevel), 0, 12);
  ok(first.changed);
  const replacement = applyLink(tutorialLevel, first.position, 0, 4);
  ok(replacement.changed);
  strictEqual(replacement.position.next[0], 4);
  strictEqual(replacement.position.previous[4], 0);
  strictEqual(replacement.position.previous[12], -1);
  strictEqual(linksOf(replacement.position).length, 3);
});

test("同链重接 12 → 4 会在释放 12 → 0 → 4 前按上游 DSF 原子拒绝", () => {
  let position = createPosition(tutorialLevel);
  const first = applyLink(tutorialLevel, position, 12, 0);
  ok(first.changed);
  const second = applyLink(tutorialLevel, first.position, 0, 4);
  ok(second.changed);
  equal(linksOf(second.position), [[0, 4], [2, 7], [4, 14], [8, 12], [12, 0]]);

  const replacement = applyLink(tutorialLevel, second.position, 12, 4);
  strictEqual(replacement.changed, false);
  strictEqual(replacement.reason, "cycle");
  strictEqual(replacement.position, second.position);
  equal(linksOf(replacement.position), [[0, 4], [2, 7], [4, 14], [8, 12], [12, 0]]);
});

test("为目标重选前驱会释放旧前驱端", () => {
  let witness = null;
  for (const target of Array.from({ length: cellCount(tutorialLevel) }, (_, index) => index)) {
    const sources = Array.from({ length: cellCount(tutorialLevel) }, (_, index) => index)
      .filter((source) => candidateTargets(tutorialLevel, source).includes(target));
    for (let a = 0; a < sources.length && !witness; a += 1) {
      const first = applyLink(tutorialLevel, createPosition(tutorialLevel), sources[a], target);
      if (!first.changed) continue;
      for (let b = a + 1; b < sources.length; b += 1) {
        const replacement = applyLink(tutorialLevel, first.position, sources[b], target);
        if (replacement.changed) witness = { oldSource: sources[a], newSource: sources[b], target, replacement };
      }
    }
  }
  ok(witness, "首关应存在可验证的目标前驱替换");
  strictEqual(witness.replacement.position.next[witness.oldSource], -1);
  strictEqual(witness.replacement.position.next[witness.newSource], witness.target);
  strictEqual(witness.replacement.position.previous[witness.target], witness.newSource);
});

test("同链反向重接会在释放占用端点前原子拒绝", () => {
  let witness = null;
  for (const level of LEVELS) {
    for (let from = 0; from < cellCount(level) && !witness; from += 1) {
      for (const to of candidateTargets(level, from)) {
        const first = applyLink(level, createPosition(level), from, to);
        if (!first.changed || !candidateTargets(level, to).includes(from)) continue;
        const cycle = applyLink(level, first.position, to, from);
        if (cycle.reason === "cycle") witness = { level, first, cycle };
      }
    }
  }
  ok(witness, "题库应包含可复现的双向小环候选");
  strictEqual(witness.cycle.changed, false);
  strictEqual(witness.cycle.reason, "cycle");
  strictEqual(witness.cycle.position, witness.first.position);
});

test("固定时间戳冲突保持局面原状", () => {
  const initial = createPosition(tutorialLevel);
  const result = applyLink(tutorialLevel, initial, 4, 9);
  strictEqual(result.changed, false);
  strictEqual(result.reason, "stamp-order");
  strictEqual(result.position, initial);
  strictEqual(applyLink(tutorialLevel, initial, 7, 6).reason, "off-ray", "ispointing 必须先于 immutable 端点检查");
  strictEqual(applyLink(tutorialLevel, initial, 7, 7).reason, "invalid-cell");
  strictEqual(applyLink(tutorialLevel, initial, 0, 8).reason, "before-start");
});

test("ispointing 在端点与 DSF 前拒绝固定或可变的当前 raw N", () => {
  const witness = defineLevel({
    id: "terminal-witness",
    difficulty: "easy",
    tier: 1,
    width: 3,
    height: 3,
    seed: 9,
    par: 2,
    directions: ["E", "S", "W", "E", "S", "W", "E", "E", null],
    givens: [[0, 1], [1, 8], [8, 9]],
  });
  const derivedFinal = applyLink(witness, createPosition(witness), 1, 4);
  ok(derivedFinal.changed);
  strictEqual(deriveLabels(witness, derivedFinal.position).numbers[4], 9);
  const continued = applyLink(witness, derivedFinal.position, 4, 7);
  strictEqual(continued.changed, false, "ispointing 不区分 raw N 是否 immutable");
  strictEqual(continued.reason, "off-ray");
  strictEqual(continued.position, derivedFinal.position, "拒绝必须是原子 no-op");
  strictEqual(applyLink(witness, derivedFinal.position, 8, 7).reason, "off-ray", "固定终点同样先由 ispointing 拒绝");
});

test("拆线同时释放所选格的入边与出边", () => {
  let position = createPosition(tutorialLevel);
  position = applyLink(tutorialLevel, position, 8, 12).position;
  position = applyLink(tutorialLevel, position, 12, 0).position;
  const result = clearCell(tutorialLevel, position, 12);
  ok(result.changed);
  strictEqual(result.position.next[8], -1);
  strictEqual(result.position.previous[0], -1);
  strictEqual(result.position.next[12], -1);
  strictEqual(result.position.previous[12], -1);
  strictEqual(clearCell(tutorialLevel, createPosition(tutorialLevel), 12).changed, false);
});

test("未锚定短链显示代数组，C 只拆单格而 X 按 raw set 整组拆除", () => {
  const level = findLevel("amber-relay");
  let position = createPosition(level);
  position = applyLink(level, position, 12, 4).position;
  position = applyLink(level, position, 4, 0).position;
  const labels = deriveLabels(level, position);
  equal([labels.displayLabels[12], labels.displayLabels[4], labels.displayLabels[0]], ["a", "a+1", "a+2"]);
  equal([labels.numbers[12], labels.numbers[4], labels.numbers[0]], [17, 18, 19]);

  const single = clearCell(level, position, 12);
  ok(single.changed);
  strictEqual(single.position.next[12], -1);
  strictEqual(single.position.previous[4], -1);
  strictEqual(single.position.next[4], 0, "C 必须保留未触及的 4→0");

  const group = clearAlgebraicChain(level, position, 12);
  ok(group.changed);
  equal(linksOf(group.position), REFERENCE_ORACLE[level.id].initial, "X 清掉 a 组全部边并保留开局自动边");
  equal([group.position.numbers[12], group.position.numbers[4], group.position.numbers[0]], [0, 0, 0]);
});

test("单轮 auto 释放出的 stale 代数孤格不能误发 X 并拆掉同组边", () => {
  const level = findLevel("amber-relay");
  const actions = [
    ["L", 8, 12], ["X", 8], ["L", 3, 11], ["L", 8, 12], ["L", 13, 9], ["C", 9], ["X", 3],
    ["L", 13, 9], ["L", 6, 10], ["L", 7, 13], ["X", 8], ["C", 9], ["L", 11, 9], ["L", 14, 10],
    ["L", 9, 6], ["L", 8, 12], ["C", 9], ["C", 6], ["L", 6, 14], ["X", 8], ["L", 13, 9],
    ["L", 3, 7], ["L", 0, 3], ["L", 12, 0], ["L", 9, 6], ["C", 3], ["L", 14, 2],
  ];
  let position = createPosition(level);
  actions.forEach(([type, from, to], index) => {
    const result = type === "L"
      ? applyLink(level, position, from, to)
      : type === "C"
        ? clearCell(level, position, from)
        : clearAlgebraicChain(level, position, from);
    strictEqual(result.changed, true, `fixed C witness step ${index + 1}: ${type}${from}${to === undefined ? "" : `→${to}`}`);
    position = result.position;
  });
  equal(linksOf(position), [[5, 15], [6, 14], [7, 13], [9, 6], [10, 7], [12, 0], [13, 9], [14, 10]]);
  equal(position.numbers, [18, 5, 18, 0, 0, 15, 16, 13, 1, 15, 12, 8, 17, 14, 11, 16]);
  equal(position.numberCells, [-1, 8, -1, -1, -1, 1, -1, -1, 11, -1, -1, 14, 10, 7, 13, 9, 6]);
  equal(position.regions, [12, 1, 10, 3, 4, 5, 10, 10, 8, 10, 10, 11, 12, 10, 10, 5]);
  strictEqual(position.impossible, true);
  strictEqual(position.previous[2], -1);
  strictEqual(position.next[2], -1);
  strictEqual(position.numbers[2], 18, "孤格保留 a+1，而同组 a 的 12→0 仍存在");

  const cleared = clearAlgebraicChain(level, position, 2);
  strictEqual(cleared.changed, false, "interpret_move 不为孤立所选格发 C/X");
  strictEqual(cleared.reason, "already-clear");
  strictEqual(cleared.position, position);
  strictEqual(cleared.position.next[12], 0, "X no-op 不能误拆同 raw set 的 12→0");

  const serialized = serializePosition(position);
  equal(serializePosition(deserializePosition(level, serialized)), serialized, "可达 stale 代数孤格必须原样 round-trip");
});

test("clever=false 允许形成负数、零与错向红色错误态", () => {
  const level = findLevel("moonlit-dispatch");
  let position = createPosition(level);
  for (const [from, to] of [[0, 24], [24, 22], [22, 20], [20, 4], [4, 9]]) {
    const result = applyLink(level, position, from, to);
    strictEqual(result.changed, true, `${from}→${to} 必须是上游合法输入`);
    position = result.position;
  }
  equal([position.numbers[0], position.numbers[24], position.numbers[22], position.numbers[20], position.numbers[4], position.numbers[9]], [-2, -1, 0, 1, 2, 3]);
  const labels = deriveLabels(level, position);
  equal(labels.errorCells, [19, 20, 22, 24]);
  strictEqual(labels.errorCells.includes(0), false, "fixed C 的负数扫描从 cell index 1 开始");
  strictEqual(labels.hasErrors, true);
  strictEqual(labels.impossible, false);
  strictEqual(evaluatePosition(level, position).complete, false);
});

test("pre-auto numsi 在端点替换后仍精确保留重复 real-number 覆盖顺序", () => {
  let position = createPosition(tutorialLevel);
  for (const [from, to] of [[8, 12], [0, 4], [15, 14], [9, 10], [6, 3], [11, 6], [1, 5], [11, 1]]) {
    const result = applyLink(tutorialLevel, position, from, to);
    strictEqual(result.changed, true);
    position = result.position;
  }
  equal(linksOf(position), [[0, 4], [1, 5], [2, 7], [3, 2], [6, 3], [8, 12], [9, 10], [10, 11], [11, 6], [12, 0], [15, 14]]);
  equal(position.numbers, [3, 13, 15, 14, 4, 14, 13, 16, 1, 10, 11, 12, 2, 7, 5, 4]);
  equal(position.numberCells, [-1, 8, 12, 0, 15, 14, -1, 13, -1, -1, 9, 10, 11, 6, 3, 2, 7]);
  equal(deriveLabels(tutorialLevel, position).errorCells, [0, 1, 3, 4, 5, 6, 15]);
  strictEqual(position.numberCells[13], 6, "post-auto topology 会误猜 cell1，必须读取 stale numsi");
  strictEqual(position.numberCells[14], 3, "post-auto topology 会误猜 cell5，必须读取 stale numsi");
  const serialized = serializePosition(position);
  equal(serializePosition(deserializePosition(tutorialLevel, serialized)), serialized);
});

test("sticky impossible 只保留诊断，不伪造 FLAG_ERROR 或永久阻断完成", () => {
  const level = findLevel("moonlit-dispatch");
  let position = createPosition(level);
  for (const [from, to] of [[6, 1], [7, 6], [1, 21]]) {
    const result = applyLink(level, position, from, to);
    strictEqual(result.changed, true);
    position = result.position;
  }
  strictEqual(position.impossible, true);
  position = clearCell(level, position, 6).position;
  const cleared = deriveLabels(level, position);
  strictEqual(cleared.impossible, true, "上游 impossible 是 sticky diagnostic");
  equal(cleared.errorCells, [], "impossible 本身不等于 check_completion 的 FLAG_ERROR");
  strictEqual(cleared.hasErrors, false);
  for (const action of timelineFor(level)) position = applyLink(level, position, action.from, action.to).position;
  const completed = evaluatePosition(level, position);
  strictEqual(completed.impossible, true);
  strictEqual(completed.complete, true, "check_completion 不读取 sticky impossible");
});

test("单轮 auto 可形成上游合法错误小环，且能序列化与 C/X 拆除", () => {
  let position = createPosition(tutorialLevel);
  const actions = [
    { type: "link", from: 8, to: 12 },
    { type: "link", from: 0, to: 4 },
    { type: "link", from: 3, to: 1 },
    { type: "link", from: 1, to: 13 },
    { type: "clear", cell: 14 },
    { type: "link", from: 14, to: 15 },
    { type: "link", from: 15, to: 12 },
  ];
  actions.forEach((action) => {
    const result = action.type === "link"
      ? applyLink(tutorialLevel, position, action.from, action.to)
      : clearCell(tutorialLevel, position, action.cell);
    strictEqual(result.changed, true, JSON.stringify(action));
    position = result.position;
  });
  equal(linksOf(position), [[0, 4], [1, 13], [2, 7], [3, 1], [4, 14], [12, 0], [14, 15], [15, 12]]);
  equal(position.numbers, [8, 18, 15, 17, 4, 0, 0, 16, 1, 10, 0, 12, 7, 7, 5, 6]);
  equal(position.numberCells, [-1, 8, -1, -1, 4, 14, 15, 12, 0, -1, 9, -1, 11, -1, -1, 2, 7]);
  equal(position.regions, [14, 3, 2, 3, 14, 5, 6, 2, 8, 9, 10, 11, 14, 3, 14, 14]);
  strictEqual(position.impossible, true);
  strictEqual(validatePosition(tutorialLevel, position), true, "错误小环仍是可操作的 upstream position");
  strictEqual(evaluatePosition(tutorialLevel, position).complete, false);

  const serialized = serializePosition(position);
  equal(serializePosition(deserializePosition(tutorialLevel, serialized)), serialized);
  const structurallyDecoded = deserializePosition(tutorialLevel, { ...serialized, impossible: false });
  ok(structurallyDecoded, "结构 decoder 不得假设 cycle 必然同时写入 sticky impossible");
  strictEqual(structurallyDecoded.impossible, false);

  const single = clearCell(tutorialLevel, position, 14);
  ok(single.changed);
  strictEqual(single.position.impossible, true);
  strictEqual(single.position.next[4], -1);
  strictEqual(single.position.previous[15], -1);
  strictEqual(validatePosition(tutorialLevel, single.position), true);
  const grouped = clearAlgebraicChain(tutorialLevel, position, 14);
  equal(serializePosition(grouped.position), serializePosition(single.position), "X 对 raw set 0 与 C 同义");
});

test("最后一次玩家操作之前未完成，同轮自动收口后才完成", () => {
  const timeline = timelineFor(tutorialLevel);
  let position = createPosition(tutorialLevel);
  for (const action of timeline.slice(0, -1)) {
    position = applyLink(tutorialLevel, position, action.from, action.to).position;
  }
  const before = evaluatePosition(tutorialLevel, position);
  strictEqual(before.complete, false);
  strictEqual(before.linkCount, 13);
  const action = timeline.at(-1);
  const final = applyLink(tutorialLevel, position, action.from, action.to);
  ok(final.changed);
  equal(final.autoLinks, [[3, 2]], "最后一步后 check_completion 单轮自动补 14→15");
  const completed = evaluatePosition(tutorialLevel, final.position);
  strictEqual(completed.complete, true);
  equal(completed.path, solutionFor(tutorialLevel));
  equal(completed.numbers, [3, 8, 15, 14, 4, 9, 13, 16, 1, 10, 11, 12, 2, 7, 5, 6]);
});

test("position v2 结构 decoder 拒绝损坏边集并保留完整快照", () => {
  const solved = positionFromPath(tutorialLevel, solutionFor(tutorialLevel));
  const serialized = serializePosition(solved);
  strictEqual(serialized.version, 2);
  strictEqual(serialized.links.length, 15);
  const restored = deserializePosition(tutorialLevel, JSON.parse(JSON.stringify(serialized)));
  ok(restored);
  equal(linksOf(restored), linksOf(solved));
  strictEqual(deserializePosition(tutorialLevel, { ...serialized, links: [[8, 13]] }), null, "非射线");
  strictEqual(deserializePosition(tutorialLevel, { ...serialized, links: [[8, 12], [0, 12]] }), null, "重复前驱不得被静默替换");
  strictEqual(deserializePosition(tutorialLevel, { ...serialized, links: [[8, 12], [8, 12]] }), null, "重复边");
  strictEqual(deserializePosition(tutorialLevel, { version: 1, links: [] }), null, "旧版无 raw nums 的局面不得被信任");
  strictEqual(deserializePosition(tutorialLevel, { ...serialized, links: "8,12" }), null);
  strictEqual(deserializePosition(tutorialLevel, { ...serialized, numbers: serialized.numbers.map(() => 1) }), null, "固定时间戳不能伪造");
  strictEqual(deserializePosition(tutorialLevel, { ...serialized, numberCells: serialized.numberCells.map(() => 0) }), null, "pre-auto numsi 不能伪造");
});

test("六关可达确定性随机游走的 position v2 每一步都无损 round-trip", () => {
  let seed = 0x51a9d;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  let changed = 0;
  for (const level of LEVELS) {
    let position = createPosition(level);
    for (let step = 0; step < 240; step += 1) {
      const cell = random() % cellCount(level);
      const mode = random() % 10;
      let result;
      if (mode < 7) {
        const targets = candidateTargets(level, cell);
        const to = targets.length ? targets[random() % targets.length] : random() % cellCount(level);
        result = applyLink(level, position, cell, to);
      } else if (mode < 9) {
        result = clearCell(level, position, cell);
      } else {
        result = clearAlgebraicChain(level, position, cell);
      }
      if (result.changed) {
        position = result.position;
        changed += 1;
      }
      const serialized = serializePosition(position);
      const restored = deserializePosition(level, JSON.parse(JSON.stringify(serialized)));
      equal(restored ? serializePosition(restored) : null, serialized, `${level.id} reachable step ${step + 1}`);
    }
  }
  ok(changed > 500, "随机游走必须覆盖足量真实 L/C/X 状态变化");
});

test("存档前缀只属于时砂邮路局", () => {
  strictEqual(STORAGE_PREFIX, "ten-realms-v3:games:time-sand-post:");
  Object.values(STORAGE_KEYS).forEach((key) => ok(key.startsWith(STORAGE_PREFIX)));
  strictEqual(new Set(Object.values(STORAGE_KEYS)).size, 5);
  strictEqual(HISTORY_LIMIT, 80);
  doesNotMatch(app, /localStorage\.clear\s*\(/);
  doesNotMatch(readFileSync(new URL("./storage.mjs", import.meta.url), "utf8"), /\.clear\s*\(/);
});

test("设置、教程标记与其他本地键互不干扰", () => {
  const storage = new MemoryStorage({ unrelated: "keep", [STORAGE_KEYS.settings]: "broken" });
  equal(loadSettings(storage), defaultSettings());
  ok(saveSettings(storage, { difficulty: "hard", lastLevelId: "last-bell-circuit" }));
  equal(loadSettings(storage), { version: 1, difficulty: "hard", lastLevelId: "last-bell-circuit" });
  strictEqual(tutorialSeen(storage), false);
  storage.values.set(STORAGE_KEYS.tutorial, "seen-v1");
  strictEqual(tutorialSeen(storage), false, "旧教程标记必须触发 v2 重看");
  ok(markTutorialSeen(storage));
  strictEqual(tutorialSeen(storage), true);
  strictEqual(storage.values.get(STORAGE_KEYS.tutorial), "seen-v2");
  strictEqual(storage.values.get("unrelated"), "keep");
  strictEqual(storage.values.has(STORAGE_KEYS.records), false, "教程升级不应写入记录键");
});

test("会话可完整恢复局面、历史、焦点、选中与用时", () => {
  const storage = new MemoryStorage();
  const session = createSession(tutorialLevel, RUN_A);
  const initial = session.position;
  session.history = [{ position: initial, moves: 0 }];
  session.position = applyLink(tutorialLevel, initial, 8, 12).position;
  session.timeline = [{ type: "link", from: 8, to: 12 }];
  session.moves = 1;
  session.elapsedMs = 3210;
  session.activeCell = 12;
  session.selectedFrom = 12;
  ok(saveSession(storage, session));
  const restored = loadSession(storage, findLevel);
  strictEqual(restored.level.id, tutorialLevel.id);
  strictEqual(restored.runId, RUN_A);
  equal(linksOf(restored.position), [[2, 7], [4, 14], [8, 12]]);
  strictEqual(restored.history.length, 1);
  equal(restored.timeline, [{ type: "link", from: 8, to: 12 }]);
  strictEqual(restored.moves, 1);
  strictEqual(restored.elapsedMs, 3210);
  strictEqual(restored.activeCell, 12);
  strictEqual(restored.selectedFrom, 12);
  strictEqual(restored.completion, null);
  strictEqual(saveSession(storage, { ...session, position: {} }), false, "恶意局面应返回 false 而不是抛错");
  strictEqual(saveSession(storage, { ...session, timeline: [], moves: 0 }), false, "局面不得脱离真实日志存档");
});

test("刷新恢复后的 undo 使用完整 position v2，而不是只凭相同 links 猜状态", () => {
  const storage = new MemoryStorage();
  const session = createSession(tutorialLevel, RUN_A);
  const initial = session.position;
  const repeatedAutoEdge = applyLink(tutorialLevel, initial, 4, 14);
  ok(repeatedAutoEdge.changed);
  equal(linksOf(repeatedAutoEdge.position), linksOf(initial));
  ok(JSON.stringify(initial.regions) !== JSON.stringify(repeatedAutoEdge.position.regions), "见证局面的 links 相同但 DSF 快照不同");
  session.history = [{ position: initial, moves: 0 }];
  session.position = repeatedAutoEdge.position;
  session.timeline = [{ type: "link", from: 4, to: 14 }];
  session.moves = 1;
  ok(saveSession(storage, session));

  const restored = loadSession(storage, findLevel);
  ok(restored);
  equal(serializePosition(restored.position), serializePosition(repeatedAutoEdge.position));
  equal(serializePosition(restored.history[0].position), serializePosition(initial));
  const undone = {
    ...restored,
    position: restored.history[0].position,
    timeline: restored.timeline.slice(0, restored.history[0].moves),
    history: [],
    moves: restored.history[0].moves,
  };
  ok(saveSession(storage, undone), "刷新后撤销出的 pre-auto DSF 必须仍可完整保存");
  equal(serializePosition(loadSession(storage, findLevel).position), serializePosition(initial));
});

test("完成后撤销回到终钟前且 records/outbox 与同 run 奖励保持幂等", () => {
  const storage = new MemoryStorage();
  const timeline = timelineFor(tutorialLevel);
  const full = replayTimeline(tutorialLevel, timeline);
  const before = replayTimeline(tutorialLevel, timeline.slice(0, -1));
  ok(full?.evaluation.complete);
  strictEqual(before?.evaluation.complete, false);

  const payload = completionFor(tutorialLevel, RUN_A, { timeline });
  const recorded = recordCompletion(defaultRecords(), payload, findLevel, payload.completedAt);
  ok(saveRecords(storage, recorded.records, findLevel));
  strictEqual(enqueueOutbox(storage, payload, (item) => normalizeCompletion(item)).saved, true);

  const completed = createSession(tutorialLevel, RUN_A);
  completed.position = full.position;
  completed.timeline = [...timeline];
  completed.history = [{ position: before.position, moves: timeline.length - 1 }];
  completed.moves = timeline.length;
  completed.elapsedMs = 48_000;
  completed.completion = { eventId: payload.eventId, delivered: true, completedAt: payload.completedAt };
  ok(saveSession(storage, completed));

  const loaded = loadSession(storage, findLevel);
  ok(loaded);
  const previous = loaded.history.at(-1);
  const undone = {
    ...loaded,
    position: previous.position,
    timeline: loaded.timeline.slice(0, previous.moves),
    history: loaded.history.slice(0, -1),
    moves: previous.moves,
    completion: null,
  };
  ok(saveSession(storage, undone));
  const restored = loadSession(storage, findLevel);
  strictEqual(evaluatePosition(tutorialLevel, restored.position).complete, false);
  strictEqual(restored.completion, null);
  strictEqual(restored.elapsedMs, 48_000);
  strictEqual(loadRecords(storage, findLevel).totalWins, 1, "撤销不能回滚已落地胜场");
  equal(loadOutbox(storage, (item) => normalizeCompletion(item)).map(({ eventId }) => eventId), [payload.eventId], "撤销不能丢弃待交付事件");

  const finalAction = timeline.at(-1);
  const redone = applyLink(tutorialLevel, restored.position, finalAction.from, finalAction.to);
  strictEqual(evaluatePosition(tutorialLevel, redone.position).complete, true);
  const duplicate = recordCompletion(loadRecords(storage, findLevel), payload, findLevel, payload.completedAt);
  strictEqual(duplicate.recorded, false);
  strictEqual(duplicate.records.totalWins, 1, "同 run 重做不能重复奖励");
});

test("损坏或伪造会话安全回退，不删其他数据", () => {
  const storage = new MemoryStorage({ unrelated: "keep", [STORAGE_KEYS.session]: "{not-json" });
  strictEqual(loadSession(storage, findLevel), null);
  const raw = {
    version: 1, levelId: tutorialLevel.id, runId: RUN_A,
    position: { version: 1, links: [[8, 13]] }, timeline: [{ type: "link", from: 8, to: 13 }],
    history: [], moves: 1, elapsedMs: 5,
    activeCell: 8, selectedFrom: null, completion: null,
  };
  storage.values.set(STORAGE_KEYS.session, JSON.stringify(raw));
  strictEqual(loadSession(storage, findLevel), null);
  strictEqual(storage.values.get("unrelated"), "keep");
  storage.values.set(STORAGE_KEYS.session, JSON.stringify({ ...raw, position: { version: 1, links: [] }, runId: "__proto__" }));
  strictEqual(loadSession(storage, findLevel), null);

  const solved = replayTimeline(tutorialLevel, timelineFor(tutorialLevel));
  storage.values.set(STORAGE_KEYS.session, JSON.stringify({
    ...raw,
    position: serializePosition(solved.position),
    timeline: [],
    moves: 0,
  }));
  strictEqual(loadSession(storage, findLevel), null, "已解边集不能绕过日志重放");
});

test("run ID 与 event ID 的安全格式稳定", () => {
  const runId = createRunId(1_787_000_000_000, "ABC-123-entropy");
  ok(validRunId(runId));
  match(runId, /^time-sand-post-/);
  strictEqual(validRunId("__proto__"), false);
  strictEqual(validRunId("short"), false);
  ok(validEventId(`${GAME_ID}:${runId}:complete`));
  strictEqual(validEventId("constructor"), false);
});

test("本地完成记录按稳定 event ID 幂等，新 run 可重玩", () => {
  const firstPayload = completionFor(tutorialLevel, RUN_A, { timeline: detourTimelineFor(tutorialLevel) });
  const first = recordCompletion(defaultRecords(), firstPayload, findLevel, "2026-09-01T08:00:00Z");
  strictEqual(first.recorded, true);
  strictEqual(first.firstClear, true);
  strictEqual(first.personalBest, false);
  strictEqual(first.records.totalWins, 1);
  const duplicate = recordCompletion(first.records, firstPayload, findLevel, "2026-09-01T08:01:00Z");
  strictEqual(duplicate.recorded, false);
  strictEqual(duplicate.records.totalWins, 1);
  const replay = recordCompletion(duplicate.records, completionFor(tutorialLevel, RUN_B), findLevel, "2026-09-01T08:02:00Z");
  strictEqual(replay.recorded, true);
  strictEqual(replay.firstClear, false);
  strictEqual(replay.personalBest, true);
  strictEqual(replay.records.totalWins, 2);
  strictEqual(replay.records.levels[tutorialLevel.id].wins, 2);
  strictEqual(replay.records.levels[tutorialLevel.id].bestMoves, 8);
  const invalidDate = recordCompletion(replay.records, completionFor(tutorialLevel, "time-sand-post-test-run-charlie"), findLevel, "not-a-date");
  strictEqual(invalidDate.recorded, false);
  strictEqual(invalidDate.records.totalWins, 2);
});

test("记录恢复会丢弃原型链、未知关卡与损坏日期", () => {
  const malicious = JSON.parse(`{"version":1,"totalWins":9,"levels":{"__proto__":{"wins":9,"bestMoves":1,"firstAt":"2026-09-01T00:00:00Z","lastAt":"2026-09-01T00:00:00Z"},"unknown-level":{"wins":2,"bestMoves":3,"firstAt":"2026-09-01T00:00:00Z","lastAt":"2026-09-01T00:00:00Z"},"chronicle-dawn":{"wins":1,"bestMoves":15,"firstAt":"bad","lastAt":"2026-09-01T00:00:00Z"}},"settledEvents":{"bad":"x"}}`);
  const normalized = normalizeRecords(malicious, findLevel);
  strictEqual(normalized.totalWins, 9);
  equal(normalized.levels, {});
  equal(normalized.settledEvents, {});
  strictEqual(Object.getPrototypeOf(normalized.levels), Object.prototype);
  const storage = new MemoryStorage({ [STORAGE_KEYS.records]: "[]" });
  equal(loadRecords(storage, findLevel), defaultRecords());
  ok(saveRecords(storage, normalized, findLevel));
});

test("outbox 只保留合法且唯一的完成 payload", () => {
  const storage = new MemoryStorage();
  const a = completionFor(tutorialLevel, RUN_A);
  const b = completionFor(tutorialLevel, RUN_B);
  const validator = (payload) => normalizeCompletion(payload);
  const first = enqueueOutbox(storage, a, validator);
  strictEqual(first.saved, true);
  equal(first.outbox.map(({ eventId }) => eventId), [a.eventId]);
  const duplicate = enqueueOutbox(storage, a, validator);
  equal(duplicate.outbox.map(({ eventId }) => eventId), [a.eventId]);
  const second = enqueueOutbox(storage, b, validator);
  equal(second.outbox.map(({ eventId }) => eventId), [a.eventId, b.eventId]);
  const nonCanonicalA = { ...a, completedAt: "2026-09-01T16:00:00+08:00" };
  storage.values.set(STORAGE_KEYS.outbox, JSON.stringify([nonCanonicalA, { eventId: "bad" }, a, b]));
  const restored = loadOutbox(storage, validator);
  equal(restored.map(({ eventId }) => eventId), [a.eventId, b.eventId]);
  strictEqual(restored[0].completedAt, "2026-09-01T08:00:00.000Z", "outbox 保存校验器返回的规范对象");
  const removed = removeFromOutbox(storage, a.eventId, validator);
  strictEqual(removed.saved, true);
  equal(removed.outbox.map(({ eventId }) => eventId), [b.eventId]);
  equal(normalizeOutbox("broken", validator), []);
  equal(normalizeOutbox([a], (payload) => validCompletion(payload)), [a], "仍兼容布尔校验器");
  equal(normalizeOutbox([a], () => { throw new Error("bad validator"); }), []);
  const throwing = { getItem: () => "[]", setItem: () => { throw new Error("denied"); } };
  strictEqual(saveOutbox(throwing, [a], validator), false);
});

test("长期离线时 outbox 与本地完成台账都不逐出旧事件", () => {
  const validator = (payload) => normalizeCompletion(payload);
  const payloads = Array.from({ length: 320 }, (_, index) => completionFor(
    tutorialLevel,
    `time-sand-post-pending-${String(index).padStart(4, "0")}`,
  ));
  const storage = new MemoryStorage();
  ok(saveOutbox(storage, payloads, validator));
  strictEqual(loadOutbox(storage, validator).length, payloads.length);
  strictEqual(loadOutbox(storage, validator)[0].eventId, payloads[0].eventId);

  let records = defaultRecords();
  for (const payload of payloads) records = recordCompletion(records, payload, findLevel, "2026-09-01T08:00:00Z").records;
  strictEqual(Object.keys(records.settledEvents).length, payloads.length);
  strictEqual(recordCompletion(records, payloads[0], findLevel, "2026-09-02T08:00:00Z").recorded, false);

  const queueTarget = {};
  for (const payload of payloads) deliverCompletion(queueTarget, payload);
  strictEqual(queueTarget[COMPLETION_QUEUE].length, payloads.length);
  strictEqual(queueTarget[COMPLETION_QUEUE][0].eventId, payloads[0].eventId);
});

test("完成 payload 包含共享引擎所需的稳定字段", () => {
  const payload = completionFor();
  strictEqual(payload.schema, COMPLETION_SCHEMA);
  strictEqual(payload.schemaVersion, 1);
  strictEqual(payload.gameId, GAME_ID);
  strictEqual(payload.realm, GAME_ID);
  strictEqual(payload.runId, RUN_A);
  strictEqual(payload.eventId, `${GAME_ID}:${RUN_A}:complete`);
  strictEqual(payload.levelId, tutorialLevel.id);
  strictEqual(payload.difficulty, "easy");
  strictEqual(payload.tier, 1);
  strictEqual(payload.seed, 11021);
  strictEqual(payload.moves, 8);
  strictEqual(payload.par, 8);
  strictEqual(payload.elapsedMs, 42_000);
  equal(payload.timeline, timelineFor(tutorialLevel));
  equal(payload.edges, linksOf(replayTimeline(tutorialLevel, payload.timeline).position));
  strictEqual(validCompletion(payload), true);
  strictEqual(validCompletion({ ...payload, eventId: "forged:event" }), false);
  strictEqual(validCompletion({ ...payload, moves: 0, timeline: [], edges: [] }), false, "0 步不能伪造通关");
  strictEqual(validCompletion({ ...payload, timeline: [] }), false, "空日志不能伪造通关");
  strictEqual(validCompletion({ ...payload, moves: payload.moves + 1 }), false, "moves 必须等于可重放操作数");

  const unfinishedTimeline = payload.timeline.slice(0, -1);
  const unfinished = replayTimeline(tutorialLevel, unfinishedTimeline);
  strictEqual(validCompletion({
    ...payload,
    moves: unfinishedTimeline.length,
    timeline: unfinishedTimeline,
    edges: unfinished.edges,
  }), false, "未解日志即使边集一致也必须拒绝");
  strictEqual(validCompletion({ ...payload, edges: payload.edges.slice(0, -1) }), false, "边集必须与日志终局一致");
  strictEqual(validCompletion({ ...payload, seed: payload.seed + 1 }), false, "seed 必须绑定正式关卡");
  strictEqual(validCompletion({ ...payload, levelId: "amber-relay" }), false, "levelId 不得移花接木");
  strictEqual(validCompletion({ ...payload, difficulty: "hard" }), false);
  strictEqual(validCompletion({ ...payload, tier: 2 }), false);
  strictEqual(validCompletion({ ...payload, par: 999 }), false);
  strictEqual(validCompletion({
    ...payload,
    timeline: [{ ...payload.timeline[0], visualOnly: true }, ...payload.timeline.slice(1)],
  }), false, "日志动作只允许规则白名单字段");
  throws(() => createCompletion({ ...tutorialLevel }, RUN_A, {
    moves: payload.moves,
    elapsedMs: payload.elapsedMs,
    timeline: payload.timeline,
    edges: payload.edges,
  }), TypeError, "克隆关卡对象不能伪装正式关卡");
  throws(() => createCompletion(tutorialLevel, "bad", {
    moves: payload.moves,
    elapsedMs: payload.elapsedMs,
    timeline: payload.timeline,
    edges: payload.edges,
  }), TypeError);
});

test("完成证明白名单可重放 clear-chain，且拒绝任何额外字段", () => {
  const level = findLevel("amber-relay");
  const timeline = [
    { type: "link", from: 12, to: 4 },
    { type: "link", from: 4, to: 0 },
    { type: "clear-chain", cell: 12 },
    ...timelineFor(level),
  ];
  const replay = replayTimeline(level, timeline);
  ok(replay);
  strictEqual(replay.evaluation.complete, true);
  const payload = completionFor(level, "time-sand-post-clear-chain-proof", { timeline });
  strictEqual(payload.moves, level.par + 3);
  equal(payload.timeline[2], { type: "clear-chain", cell: 12 });
  strictEqual(validCompletion(payload), true);
  strictEqual(validCompletion({
    ...payload,
    timeline: payload.timeline.map((action, index) => index === 2 ? { ...action, visualOnly: true } : action),
  }), false);
});

test("RealmArcade 交付与观察事件在同页按 event ID 去重", () => {
  const payload = completionFor();
  const completions = [];
  const events = [];
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const target = {
    RealmArcade: { complete: (detail) => completions.push(detail) },
    CustomEvent: FakeCustomEvent,
    dispatchEvent: (event) => { events.push(event); return true; },
  };
  const first = deliverCompletion(target, payload);
  const duplicate = deliverCompletion(target, payload);
  equal(first, { retained: true, confirmed: true, transport: "realm-arcade" });
  equal(duplicate, { retained: true, confirmed: true, transport: "realm-arcade" });
  strictEqual(completions.length, 1);
  strictEqual(events.length, 1);
  strictEqual(events[0].type, COMPLETION_EVENT);
  equal(events[0].detail, payload);
  strictEqual(completionTransport(target, payload.eventId), "realm-arcade");
});

test("TenRealmsV3 是优先且可确认的完成通道", () => {
  const payload = completionFor();
  const calls = [];
  const target = {
    TenRealmsV3: { complete: (value) => calls.push(["native-v3", value.eventId]) },
    RealmArcade: { complete: (value) => calls.push(["realm-arcade", value.eventId]) },
  };
  equal(deliverCompletion(target, payload), { retained: true, confirmed: true, transport: "native-v3" });
  equal(calls, [["native-v3", payload.eventId]]);
  strictEqual(completionTransport(target, payload.eventId), "native-v3");
});

test("队列与 DOM 只是未确认提示，同页 API 就绪后会真实重试", () => {
  const a = completionFor(tutorialLevel, RUN_A);
  const events = [];
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const queueTarget = {
    CustomEvent: FakeCustomEvent,
    dispatchEvent: (event) => { events.push(event); return true; },
  };
  equal(deliverCompletion(queueTarget, a), { retained: true, confirmed: false, transport: "queue" });
  strictEqual(queueTarget[COMPLETION_QUEUE].length, 1);
  strictEqual(events.length, 1, "DOM 只观察一次");
  equal(deliverCompletion(queueTarget, a), { retained: true, confirmed: false, transport: "queue" });
  strictEqual(queueTarget[COMPLETION_QUEUE].length, 1);
  strictEqual(completionTransport(queueTarget, a.eventId), "queue");
  const accepted = [];
  queueTarget.RealmArcade = { complete: (value) => accepted.push(value.eventId) };
  equal(deliverCompletion(queueTarget, a), { retained: true, confirmed: true, transport: "realm-arcade" });
  equal(accepted, [a.eventId]);
  equal(queueTarget[COMPLETION_QUEUE], [], "API 确认后清理同页提示队列");
  strictEqual(events.length, 1);

  const b = completionFor(tutorialLevel, RUN_B);
  const throwingTarget = { RealmArcade: { complete: () => { throw new Error("not ready"); } } };
  equal(deliverCompletion(throwingTarget, b), { retained: true, confirmed: false, transport: "queue" });
  strictEqual(throwingTarget[COMPLETION_QUEUE][0].eventId, b.eventId);
  const recovered = [];
  throwingTarget.RealmArcade.complete = (value) => recovered.push(value.eventId);
  equal(deliverCompletion(throwingTarget, b), { retained: true, confirmed: true, transport: "realm-arcade" });
  equal(recovered, [b.eventId]);
  equal(throwingTarget[COMPLETION_QUEUE], []);
  const frozen = Object.freeze({});
  equal(deliverCompletion(frozen, a), { retained: false, confirmed: false, transport: null });
  equal(deliverCompletion(null, a), { retained: false, confirmed: false, transport: null });
});

test("私有 outbox 只在 API 确认后于 realm:ready 重试并移除", () => {
  const payload = completionFor();
  const validator = (item) => normalizeCompletion(item);
  const storage = new MemoryStorage();
  strictEqual(enqueueOutbox(storage, payload, validator).saved, true);
  const delivered = [];
  const target = {};
  const flush = () => {
    for (const item of loadOutbox(storage, validator)) {
      const result = deliverCompletion(target, item);
      if (result.confirmed) removeFromOutbox(storage, item.eventId, validator);
    }
  };
  flush();
  equal(delivered, []);
  equal(loadOutbox(storage, validator).map(({ eventId }) => eventId), [payload.eventId], "queue 不能删除私有 outbox");
  target.RealmArcade = { complete: (item) => delivered.push(item.eventId) };
  flush();
  equal(delivered, [payload.eventId]);
  equal(loadOutbox(storage, validator), []);
  match(app, /if\s*\(!result\.confirmed\)\s*continue/);
  match(app, /if\s*\(delivery\.confirmed\)/);
  for (const eventName of ["realm:ready", "ten-realms-v3:realm-ready"]) {
    match(app, new RegExp(`addEventListener\\("${eventName.replace(":", "\\:")}", flushOutbox\\)`));
  }
  match(app, /flushOutbox\(\);/);
});

test("HTML 保持 v3.0 返回路径、共享层顺序与原生教程入口", () => {
  match(html, /<html lang="zh-CN" data-realm="time-sand-post">/);
  match(html, /href="\.\.\/\.\.\/"/);
  match(html, /href="\.\.\/\.\.\/shared\/realm-ui\.css"/);
  match(html, /src="\.\.\/\.\.\/shared\/realm-ui\.mjs"/);
  match(html, /id="tutorial-button"/);
  match(html, /id="clear-button"[^>]*>拆所选格</);
  match(html, /id="clear-chain-button"[^>]*>拆代数链</);
  match(html, /Shift\+Delete 或右键拆代数链/);
  match(html, /建议步数按自动补线后仍需手动建立的邮段计算/);
  match(html, /src="\.\/app\.mjs"/);
  match(html, /5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/);
  ok(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"), "共享 module 必须先于游戏 app");
  ok(html.indexOf("../../shared/realm-ui.css") < html.indexOf("./styles.css"), "共享 CSS 必须先于私有 CSS");
});

test("CSS 保证无横滚、44px 触控、320/340 窄屏与减少动态", () => {
  match(css, /html\s*\{[^}]*overflow-x:\s*hidden/);
  match(css, /body\s*\{[^}]*overflow-x:\s*hidden/);
  match(css, /\.post-cell\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/);
  match(css, /min-height:\s*44px/);
  match(css, /@media\s*\(max-width:\s*340px\)/);
  match(css, /@media\s*\(max-width:\s*320px\)/);
  match(css, /6\s*\*\s*44|post-cell\s*\{[^}]*min-width:\s*44px/s);
  match(css, /object-fit:\s*contain/);
  match(css, /\.dialog-shell\s*>\s*header button[^}]*min-width:\s*44px/);
  match(css, /\.site-footer a\s*\{[^}]*min-height:\s*44px/);
  match(css, /\.connection-layer\s*\{[^}]*z-index:\s*3/);
  match(css, /\.connection-node\s*\{[^}]*fill:\s*none/);
  match(css, /\.tutorial-card\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*grid-auto-rows:\s*max-content;[^}]*align-content:\s*start/);
  match(css, /\.tutorial-visual\s*\{[^}]*aspect-ratio:\s*800\s*\/\s*520;[^}]*place-items:\s*center/);
  match(css, /\.tutorial-visual img\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*max-width:\s*100%;[^}]*max-height:\s*58dvh;[^}]*object-position:\s*center/);
  match(css, /\.post-cell__number\.is-algebraic/);
  match(css, /\.post-cell\.is-error/);
  match(css, /data-kind="warning"/);
  match(css, /body\.modal-open\s*\{[^}]*overflow:\s*hidden/);
  match(css, /\.game-dialog\s*\{[^}]*overflow:\s*clip/);
  match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("游戏 app 包含触摸、键盘、右键拆线、教程强制入口与焦点恢复", () => {
  match(app, /addEventListener\("pointerdown"/);
  match(app, /addEventListener\("contextmenu"/);
  match(app, /clearAlgebraicChain\(/);
  match(app, /event\.shiftKey\)\s*clearChainAt/);
  match(app, /rawNumber\s*<\s*0[^\n]*错误序号/);
  match(app, /evaluation\.impossible[^\n]*短链矛盾/);
  ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Delete", "Backspace", "Escape"].forEach((key) => match(app, new RegExp(key)));
  match(app, /URLSearchParams\(window\.location\.search\)\.get\("tutorial"\) === "1"/);
  match(app, /trigger\.focus\(\{ preventScroll: true \}\)/);
  match(app, /activeTrigger[\s\S]*?document\.activeElement[\s\S]*?openTutorial\(activeTrigger\)/);
  match(app, /hasVisibleNumber[\s\S]*?if\s*\(!hasVisibleNumber\)\s*continue;[\s\S]*?setAttribute\("r",\s*"\.38"\)[\s\S]*?connectionSegment\(state\.level,\s*from,\s*to\)[\s\S]*?routeGroup\.append\(line\)[\s\S]*?setAttribute\("r",\s*"\.39"\)/);
  match(app, /elements\.undo\.disabled\s*=\s*!state\.history\.length/);
  match(app, /function undo\(\)\s*\{[\s\S]*?if\s*\(!state\.history\.length\)\s*return false;[\s\S]*?closeDialog\(elements\.victoryDialog,\s*"undo-completion"\)[\s\S]*?state\.completion\s*=\s*null[\s\S]*?state\.finishedElapsed\s*=\s*null/);
  match(app, /function resetTutorialScroll\(\)\s*\{[\s\S]*?elements\.tutorialDialog\.scrollTop\s*=\s*0[\s\S]*?tutorialShell\.scrollTop\s*=\s*0[\s\S]*?tutorialCard\.scrollTop\s*=\s*0/);
  match(app, /function openTutorial[\s\S]*?const generation\s*=\s*\+\+tutorialGeneration[\s\S]*?openDialog\(elements\.tutorialDialog[\s\S]*?resetTutorialScroll\(\);[\s\S]*?requestAnimationFrame\([\s\S]*?generation\s*===\s*tutorialGeneration[\s\S]*?state\.tutorialIndex\s*===\s*0[\s\S]*?resetTutorialScroll\(\)/);
  match(app, /closeOtherDialogs\(dialog\)/);
  match(app, /markTutorialSeen\(storage\)/);
  doesNotMatch(app, /localStorage\.clear\s*\(/);
});

test("三张 SVG 使用同一真实关卡、完整比例与十六格", () => {
  for (const { name, source } of svgEntries) {
    match(source, /viewBox="0 0 800 520"/, name);
    match(source, /preserveAspectRatio="xMidYMid meet"/, name);
    match(source, /data-game-id="time-sand-post"/, name);
    match(source, /data-tutorial-version="2"/, name);
    match(source, /data-level-id="chronicle-dawn"/, name);
    match(source, /data-seed="11021"/, name);
    match(source, /data-directions="S,S,SE,W,SE,S,NE,-,S,E,E,NW,N,N,E,W"/, name);
    match(source, /data-givens="8:1,4:4,14:5,13:7,9:10,11:12,2:15,7:16"/, name);
    doesNotMatch(source, /<script\b|(?:href|src)="https?:|url\(https?:/i, `${name} 不得包含脚本或远程依赖`);
    const cells = parseTutorialCells(source);
    strictEqual(cells.length, 16, `${name} 必须编码全部十六格`);
    equal(cells.map(({ index }) => index), Array.from({ length: 16 }, (_, index) => index));
    equal(cells.map(({ direction }) => direction), tutorialLevel.directions);
    const { numberByCell } = givenMaps(tutorialLevel);
    equal(cells.map(({ given }) => given), Array.from(numberByCell));
  }
});

test("元素卡是含两条上游自动边的真实初始局面", () => {
  const source = svgEntries[0].source;
  match(source, /data-state="initial" data-link-count="2" data-auto-link-count="2" data-solved="false"/);
  const links = [...source.matchAll(/data-link-from="(\d+)" data-link-to="(\d+)"/g)].map((item) => [Number(item[1]), Number(item[2])]);
  equal(links, REFERENCE_ORACLE[tutorialLevel.id].initial);
  const evaluation = evaluatePosition(tutorialLevel, createPosition(tutorialLevel));
  strictEqual(evaluation.linkCount, 2);
  strictEqual(evaluation.complete, false);
});

test("操作卡的 8 → 12 由玩家同源函数复算为合法", () => {
  const source = svgEntries[1].source;
  match(source, /data-state="after-link" data-action-from="8" data-action-to="12" data-link-count="3" data-auto-link-count="2" data-player-moves="1" data-solved="false"/);
  match(source, /data-link-from="8" data-link-to="12" data-link-kind="player"/);
  const result = applyLink(tutorialLevel, createPosition(tutorialLevel), 8, 12);
  ok(result.changed);
  const evaluation = evaluatePosition(tutorialLevel, result.position);
  strictEqual(evaluation.linkCount, 3);
  strictEqual(evaluation.complete, false);
  strictEqual(evaluation.numbers[8], 1);
  strictEqual(evaluation.numbers[12], 2);
  const cells = parseTutorialCells(source);
  strictEqual(cells.find(({ index }) => index === 8).number, 1);
  strictEqual(cells.find(({ index }) => index === 12).number, 2);
});

test("通关卡的路径、十五边与格内数字均可由引擎复算", () => {
  const source = svgEntries[2].source;
  match(source, /data-state="solved" data-link-count="15" data-player-moves="8" data-auto-link-count="7" data-solved="true"/);
  const pathText = /data-path="([^"]+)"/.exec(source)?.[1];
  const path = pathText.split(",").map(Number);
  equal(path, solutionFor(tutorialLevel));
  const linkPairs = [...source.matchAll(/data-link-from="(\d+)" data-link-to="(\d+)"/g)].map((item) => [Number(item[1]), Number(item[2])]);
  equal(linkPairs, path.slice(0, -1).map((from, index) => [from, path[index + 1]]));
  const position = positionFromPath(tutorialLevel, path);
  const evaluation = evaluatePosition(tutorialLevel, position);
  strictEqual(evaluation.complete, true);
  const cells = parseTutorialCells(source);
  equal(cells.map(({ number }) => number), Array.from(evaluation.numbers));
});

test("app 对三张教程图均使用明确缓存版本", () => {
  for (const name of ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]) {
    match(app, new RegExp(`\\./assets/${name.replace(".", "\\.")}\\?tutorial=2`));
  }
  match(html, /tutorial-elements\.svg\?tutorial=2/);
});

test("完成处理的源码顺序是先本地记录与 outbox，再交付宿主", () => {
  const start = app.indexOf("function settleCompletion");
  const end = app.indexOf("function onBoardClick", start);
  const source = app.slice(start, end);
  const recordIndex = source.indexOf("recordCompletion(");
  const saveIndex = source.indexOf("saveRecords(");
  const queueIndex = source.indexOf("enqueueOutbox(");
  const deliveryIndex = source.indexOf("deliverCompletion(");
  ok(recordIndex >= 0 && saveIndex > recordIndex && queueIndex > saveIndex && deliveryIndex > queueIndex);
  match(source, /timeline:\s*state\.timeline/);
  match(source, /edges:\s*linksOf\(state\.position\)/);
  match(source, /if\s*\(recordsSaved\s*&&\s*queued\.saved\s*&&\s*sessionSaved\)\s*{[\s\S]*?deliverCompletion\(/);
  match(source, /state\.completion\?\.completedAt[\s\S]*?records\.settledEvents\[eventId\][\s\S]*?new Date\(\)\.toISOString\(\)/, "records-only crash recovery keeps the original completion timestamp");
  match(source, /if\s*\(delivery\.confirmed\)[\s\S]*?removeFromOutbox\(/);
  match(source, /removeFromOutbox\(/);
  match(app, /if\s*\(state\.completed\s*&&\s*!state\.completion\?\.delivered\)\s*settleCompletion\(false\)/);
});

test("RULES 完整记录固定来源、许可、归属、真值与事件合同", () => {
  match(rules, /5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/);
  match(rules, /doc-zh\/signpost\.html/);
  match(rules, /vendor\/sgtpuzzles\/signpost\.c/);
  match(rules, /src\/games\/signpost\.ts/);
  match(rules, /vendor\/sgtpuzzles\/LICENCE/);
  match(rules, /MIT License/);
  match(rules, /Janko/);
  match(rules, /James Harvey/);
  match(rules, /Hamilton/);
  match(rules, /time-sand-post:<runId>:complete/);
  match(rules, /outbox/);
  match(rules, /pre-auto DSF/);
  match(rules, /sticky impossible/);
  match(rules, /position 使用 schema `v2`/);
  match(rules, /\| 入门 \| `chronicle-dawn` \| 4 × 4 \| 11021 \| 8 \|/);
  match(rules, /data-tutorial-version="2"/);
  match(rules, /320×720/);
});

for (const { name, callback } of tests) {
  try {
    callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

console.log(`\n${tests.length} tests · ${assertions} assertions · time-sand-post passed`);
