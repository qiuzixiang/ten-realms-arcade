import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DIFFICULTIES,
  HISTORY_LIMIT,
  LEVELS,
  applyMove,
  applySessionMove,
  boundariesFromOwners,
  cellCoordinates,
  cellIndex,
  cellsAroundPoint,
  coreById,
  coreTypeFor,
  createPuzzle,
  createSession,
  decodeDescription,
  edgeById,
  edgeKey,
  evaluatePosition,
  findLevel,
  levelsForDifficulty,
  normalizePosition,
  oppositeCell,
  parseEdgeKey,
  positionToJSON,
  resolvePointerTarget,
  restartSession,
  restoreSession,
  sessionToJSON,
  solvePuzzle,
  undoSession,
} from "./logic.mjs";
import {
  awardCompletion,
  badgeRulesForRealm,
  createProgress,
  masteryTargetFor,
} from "../../shared/reward-engine.mjs";
import { REALM_CONFIGS, REALM_TUTORIALS, tutorialArt } from "../../shared/tutorial-data.mjs";
import { clientToBoardPoint } from "./app.mjs";
import {
  REALM_ID,
  confirmNebulaCompletion,
  createNebulaCompletionTracking,
  createNebulaRunId,
  enqueueNebulaCompletion,
  nebulaCompletionEventId,
  normalizeNebulaOutbox,
  recordNebulaAtlasCompletion,
  restoreNebulaCompletionTracking,
  stageNebulaCompletion,
} from "./completion.mjs";

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
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function notEqual(actual, expected, message) {
  assertions += 1;
  assert.notEqual(actual, expected, message);
}

function match(actual, expected, message) {
  assertions += 1;
  assert.match(actual, expected, message);
}

function throws(callback, expected, message) {
  assertions += 1;
  assert.throws(callback, expected, message);
}

function puzzleFrom(id, width, height, description) {
  return createPuzzle({ id, title: id, width, height, description });
}

function edgeCells(puzzle, edge) {
  if (edge.orientation === "v") {
    return [
      cellIndex(puzzle.width, edge.row, edge.column - 1),
      cellIndex(puzzle.width, edge.row, edge.column),
    ];
  }
  return [
    cellIndex(puzzle.width, edge.row - 1, edge.column),
    cellIndex(puzzle.width, edge.row, edge.column),
  ];
}

function cutAround(puzzle, members) {
  const member = members instanceof Set ? members : new Set(members);
  return new Set(puzzle.legalEdges
    .filter((edge) => {
      const [first, second] = edgeCells(puzzle, edge);
      return member.has(first) !== member.has(second);
    })
    .map(({ id }) => id));
}

function sorted(values) {
  return [...values].sort();
}

function maybeRead(relativeUrl) {
  const url = new URL(relativeUrl, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

function tagWithId(source, tagName, id) {
  return source.match(new RegExp(`<${tagName}\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i"))?.[0] ?? "";
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, "i"))?.[2] ?? null;
}

const htmlSource = maybeRead("./index.html");
const cssSource = maybeRead("./styles.css");
const appSource = maybeRead("./app.mjs");
const tutorialSource = maybeRead("../../shared/tutorial-data.mjs");
const realmUiSource = maybeRead("../../shared/realm-ui.mjs");
const noticesSource = maybeRead("../../../THIRD_PARTY_NOTICES.md");
const validatorSource = maybeRead("../../../scripts/validate.mjs");

test("双倍坐标解码保留格心、边心、角点奇偶与上下游跳码语义", () => {
  equal(coreTypeFor(1, 1), "cell");
  equal(coreTypeFor(3, 4), "edge");
  equal(coreTypeFor(4, 3), "edge");
  equal(coreTypeFor(4, 4), "vertex");

  const decoded = decodeDescription(4, 4, "AzA");
  deepEqual(decoded.map(({ x, y, ink, type }) => ({ x, y, ink, type })), [
    { x: 1, y: 1, ink: "black", type: "cell" },
    { x: 6, y: 4, ink: "black", type: "vertex" },
  ]);
  equal(Object.isFrozen(decoded), true);
  equal(Object.isFrozen(decoded[0]), true);

  const cellFixture = puzzleFrom("upstream-cell", 3, 3, "m");
  const verticalEdgeFixture = puzzleFrom("upstream-v-edge", 4, 3, "r");
  const horizontalEdgeFixture = puzzleFrom("upstream-h-edge", 3, 4, "r");
  const vertexFixture = puzzleFrom("upstream-vertex", 4, 4, "y");
  deepEqual(cellFixture.cores.map(({ x, y, type }) => [x, y, type]), [[3, 3, "cell"]]);
  deepEqual(verticalEdgeFixture.cores.map(({ x, y, type }) => [x, y, type]), [[4, 3, "edge"]]);
  deepEqual(horizontalEdgeFixture.cores.map(({ x, y, type }) => [x, y, type]), [[3, 4, "edge"]]);
  deepEqual(vertexFixture.cores.map(({ x, y, type }) => [x, y, type]), [[4, 4, "vertex"]]);
});

test("格子索引、星核种子与旋转伙伴严格遵循四向方格邻接", () => {
  for (let index = 0; index < 20; index += 1) {
    const coordinates = cellCoordinates(5, index);
    equal(cellIndex(5, coordinates.row, coordinates.column), index);
  }
  deepEqual(cellsAroundPoint(5, 5, 5, 5), [12], "cell core seeds one cell");
  deepEqual(cellsAroundPoint(5, 5, 4, 5), [11, 12], "vertical-edge core seeds two cells");
  deepEqual(cellsAroundPoint(5, 5, 5, 4), [7, 12], "horizontal-edge core seeds two cells");
  deepEqual(cellsAroundPoint(5, 5, 4, 4), [6, 7, 11, 12], "vertex core seeds four cells");
  deepEqual(cellsAroundPoint(3, 3, 0, 0), [0], "board corners are clipped safely");

  const centre = createPuzzle({
    id: "opposites",
    width: 5,
    height: 5,
    cores: [{ id: "k0", x: 5, y: 5 }],
  });
  equal(oppositeCell(centre, 6, "k0"), 18);
  equal(oppositeCell(centre, 7, centre.cores[0]), 17);
  equal(oppositeCell(centre, 0, "k0"), 24);
  equal(oppositeCell(centre, 4, "k0"), 20);
  equal(oppositeCell(centre, 0, "missing"), null);
  equal(oppositeCell(centre, -1, "k0"), null);
});

test("描述、棋盘与星核定义拒绝越界、重复、空集和过近种子", () => {
  throws(() => decodeDescription(2, 3, "a"), /at least 3/);
  throws(() => decodeDescription(3, 3, ""), /non-empty/);
  throws(() => decodeDescription(3, 3, "0"), /invalid token/);
  throws(() => decodeDescription(3, 3, "zz"), /exceeds/);
  throws(() => decodeDescription(4, 4, "z"), /at least one core/);
  throws(() => puzzleFrom("too-close", 3, 3, "aa"), /too close/);

  throws(() => createPuzzle({ id: "small", width: 2, height: 3, cores: [{ x: 1, y: 1 }] }), /at least 3/);
  throws(() => createPuzzle({ id: "empty", width: 3, height: 3, cores: [] }), /at least one core/);
  throws(() => createPuzzle({ id: "outside", width: 3, height: 3, cores: [{ x: 0, y: 1 }] }), /interior/);
  throws(() => createPuzzle({ id: "outside", width: 3, height: 3, cores: [{ x: 6, y: 1 }] }), /interior/);
  throws(() => createPuzzle({ id: "fractional", width: 3, height: 3, cores: [{ x: 1.5, y: 1 }] }), /integers/);
  throws(() => createPuzzle({
    id: "duplicate-id",
    width: 3,
    height: 3,
    cores: [{ id: "same", x: 1, y: 1 }, { id: "same", x: 5, y: 5 }],
  }), /unique/);
  throws(() => createPuzzle({
    id: "duplicate-coordinate",
    width: 3,
    height: 3,
    cores: [{ id: "a", x: 1, y: 1 }, { id: "b", x: 1, y: 1 }],
  }), /unique/);
  throws(() => createPuzzle({
    id: "overlapping-seeds",
    width: 3,
    height: 3,
    cores: [{ id: "cell", x: 1, y: 1 }, { id: "edge", x: 2, y: 1 }],
  }), /too close/);
});

test("内部边编号与相邻格唯一，边心和角点星核会封锁所有穿核边", () => {
  equal(edgeKey("v", 2, 3), "v:2:3");
  deepEqual(parseEdgeKey("h:12:4"), { orientation: "h", row: 12, column: 4 });
  equal(parseEdgeKey("x:1:2"), null);
  equal(parseEdgeKey("v:-1:2"), null);
  equal(parseEdgeKey(null), null);

  const plain = puzzleFrom("plain", 3, 3, "m");
  equal(plain.edges.length, 12);
  equal(new Set(plain.edges.map(({ id }) => id)).size, 12);
  for (const edge of plain.edges) {
    const [first, second] = edgeCells(plain, edge);
    const a = cellCoordinates(plain.width, first);
    const b = cellCoordinates(plain.width, second);
    equal(Math.abs(a.row - b.row) + Math.abs(a.column - b.column), 1, edge.id);
  }

  const edgeCore = puzzleFrom("blocked-edge", 4, 3, "r");
  deepEqual(edgeCore.edges.filter(({ legal }) => !legal).map(({ id }) => id), ["v:1:2"]);
  equal(edgeById(edgeCore, "v:1:2")?.legal, false);
  const vertexCore = puzzleFrom("blocked-vertex", 4, 4, "y");
  deepEqual(sorted(vertexCore.edges.filter(({ legal }) => !legal).map(({ id }) => id)), [
    "h:2:1", "h:2:2", "v:1:2", "v:2:2",
  ]);
  equal(coreById(vertexCore, "k0")?.type, "vertex");
  equal(coreById(vertexCore, "missing"), null);
  equal(edgeById(vertexCore, "missing"), null);

  const owners = new Int16Array(edgeCore.width * edgeCore.height);
  owners.forEach((_, index) => { owners[index] = index % edgeCore.width < 2 ? 0 : 1; });
  equal(boundariesFromOwners(edgeCore, owners).has("v:1:2"), false, "blocked midpoint never becomes a boundary");
});

test("归一化只保留合法边与星核笔记，正式落笔原子且不改写输入", () => {
  const puzzle = puzzleFrom("immutable", 4, 3, "r");
  const originalEdges = new Set(["v:0:1", "v:1:2", "unknown"]);
  const originalNotes = new Map([[0, "k0"], [99, "k0"], [1, "missing"]]);
  const normalized = normalizePosition(puzzle, { edges: originalEdges, notes: originalNotes });
  deepEqual([...normalized.edges], ["v:0:1"]);
  deepEqual([...normalized.notes], [[0, "k0"]]);
  deepEqual([...originalEdges], ["v:0:1", "v:1:2", "unknown"]);
  deepEqual([...originalNotes], [[0, "k0"], [99, "k0"], [1, "missing"]]);

  const blocked = applyMove(puzzle, { edges: originalEdges, notes: originalNotes }, {
    type: "toggle-edge",
    edgeId: "v:1:2",
  });
  equal(blocked.accepted, false);
  equal(blocked.reason, "core-blocked");
  deepEqual([...originalEdges], ["v:0:1", "v:1:2", "unknown"]);

  const added = applyMove(puzzle, normalized, { type: "toggle-edge", edgeId: "v:0:2" });
  equal(added.accepted, true);
  equal(added.effect, "edge-added");
  deepEqual(sorted(added.position.edges), ["v:0:1", "v:0:2"]);
  deepEqual([...normalized.edges], ["v:0:1"], "accepted move clones the position");

  const erased = applyMove(puzzle, added.position, { type: "set-edge", edgeId: "v:0:1", value: false });
  equal(erased.accepted, true);
  equal(erased.effect, "edge-removed");
  equal(erased.position.edges.has("v:0:1"), false);
  equal(applyMove(puzzle, erased.position, {
    type: "set-edge", edgeId: "v:0:1", value: false,
  }).reason, "no-change");
  equal(applyMove(puzzle, erased.position, { type: "toggle-edge", edgeId: "missing" }).reason, "not-an-edge");
  equal(applyMove(puzzle, erased.position, { type: "invent-rule" }).reason, "unknown-move");
});

test("上游格心、横边心、竖边心和角点整盘夹具都独立满足规则", () => {
  const fixtures = [
    puzzleFrom("whole-cell", 3, 3, "m"),
    puzzleFrom("whole-vertical-edge", 4, 3, "r"),
    puzzleFrom("whole-horizontal-edge", 3, 4, "r"),
    puzzleFrom("whole-vertex", 4, 4, "y"),
  ];
  for (const puzzle of fixtures) {
    const evaluation = evaluatePosition(puzzle);
    equal(evaluation.components.length, 1, puzzle.id);
    equal(evaluation.components[0].coreId, "k0", puzzle.id);
    equal(evaluation.components[0].exactCore, true, puzzle.id);
    equal(evaluation.components[0].symmetric, true, puzzle.id);
    equal(evaluation.components[0].internalEdges, 0, puzzle.id);
    equal(evaluation.components[0].valid, true, puzzle.id);
    equal(evaluation.complete, true, puzzle.id);
    equal(evaluation.progress, 1, puzzle.id);
  }
});

test("无中心星核与多余星核分别使 exactCore 失败", () => {
  const offCentre = puzzleFrom("off-centre", 3, 3, "a");
  const offEvaluation = evaluatePosition(offCentre);
  equal(offEvaluation.components.length, 1);
  deepEqual(offEvaluation.components[0].touchingCoreIds, ["k0"]);
  equal(offEvaluation.components[0].coreId, null);
  equal(offEvaluation.components[0].exactCore, false);
  equal(offEvaluation.components[0].symmetric, true);
  equal(offEvaluation.complete, false);

  const extra = puzzleFrom("extra-cores", 3, 3, "all");
  const extraEvaluation = evaluatePosition(extra);
  deepEqual(extraEvaluation.components[0].touchingCoreIds, ["k0", "k1", "k2"]);
  equal(extraEvaluation.components[0].coreId, "k1");
  equal(extraEvaluation.components[0].exactCore, false);
  equal(extraEvaluation.components[0].symmetric, true);
  equal(extraEvaluation.complete, false);
});

test("连通但非半周对称的凹形区域只在 symmetric 条件失败", () => {
  const puzzle = createPuzzle({
    id: "asymmetric-galaxy",
    width: 5,
    height: 5,
    cores: [{ id: "centre", x: 5, y: 5 }],
  });
  const asymmetricMembers = new Set([12, 11, 13, 7, 17, 6]);
  const evaluation = evaluatePosition(puzzle, { edges: cutAround(puzzle, asymmetricMembers) });
  const component = evaluation.components.find(({ cells }) => cells.includes(12));
  ok(component);
  deepEqual(new Set(component.cells), asymmetricMembers);
  deepEqual(component.center, { x: 5, y: 5 });
  deepEqual(component.touchingCoreIds, ["centre"]);
  equal(component.exactCore, true);
  equal(component.symmetric, false);
  equal(component.internalEdges, 0);
  equal(component.valid, false);
  equal(evaluation.complete, false);
});

test("四向连通、对角不连通与区域内部冗余边分别被严格审计", () => {
  const puzzle = puzzleFrom("connectivity", 3, 3, "m");
  const verticalCut = new Set(["v:0:1", "v:1:1", "v:2:1"]);
  const split = evaluatePosition(puzzle, { edges: verticalCut });
  equal(split.components.length, 2);
  equal(split.components.some(({ touchingCoreIds }) => touchingCoreIds.length === 0), true);
  equal(split.components.every(({ valid }) => !valid), true);
  equal(split.complete, false);

  const singletons = evaluatePosition(puzzle, {
    edges: new Set(puzzle.legalEdges.map(({ id }) => id)),
  });
  equal(singletons.components.length, 9, "diagonal contacts do not merge singleton cells");
  equal(singletons.components.every(({ cells }) => cells.length === 1), true);
  equal(singletons.validComponentCount, 1, "only the core's own singleton is locally valid");
  equal(singletons.complete, false);

  const redundant = evaluatePosition(puzzle, { edges: new Set(["v:0:1"]) });
  equal(redundant.components.length, 1, "an alternate route keeps the region connected");
  equal(redundant.components[0].exactCore, true);
  equal(redundant.components[0].symmetric, true);
  equal(redundant.components[0].internalEdges, 1);
  equal(redundant.components[0].valid, false);
});

test("完整分隔线完成三片星云，少一段则合并区域且仍可保留局部合法星云", () => {
  const puzzle = puzzleFrom("three-galaxies", 3, 3, "all");
  const expectedEdges = new Set(["v:0:1", "v:2:2", "h:1:0", "h:2:2"]);
  const solved = evaluatePosition(puzzle, { edges: expectedEdges });
  equal(solved.complete, true);
  equal(solved.components.length, 3);
  equal(solved.validComponentCount, 3);
  equal(solved.invalidComponentCount, 0);
  equal(solved.progress, 1);
  equal(solved.components.every(({ exactCore, symmetric, internalEdges, valid }) => (
    exactCore && symmetric && internalEdges === 0 && valid
  )), true);

  const missing = new Set(expectedEdges);
  missing.delete("v:0:1");
  const merged = evaluatePosition(puzzle, { edges: missing });
  equal(merged.complete, false);
  equal(merged.components.length, 2);
  equal(merged.validComponentCount, 1);
  equal(merged.invalidComponentCount, 1);
  equal(merged.components.some(({ valid }) => valid), true);
  equal(merged.components.some(({ touchingCoreIds, internalEdges, valid }) => (
    !valid && touchingCoreIds.length === 2 && internalEdges === 1
  )), true);
  ok(merged.progress > 0 && merged.progress < 1);
});

test("归属笔记按星核成对添加、覆盖旧轨道并再次切换移除", () => {
  const puzzle = puzzleFrom("note-orbits", 3, 3, "cjj");
  const initial = { edges: new Set(), notes: new Map() };
  const top = applyMove(puzzle, initial, { type: "toggle-note", cell: 0, coreId: "k0" });
  equal(top.accepted, true);
  equal(top.effect, "note-added");
  deepEqual(top.cells, [0, 2]);
  deepEqual([...top.position.notes], [[0, "k0"], [2, "k0"]]);
  equal(initial.notes.size, 0, "input note map is immutable");

  const overwritten = applyMove(puzzle, top.position, { type: "toggle-note", cell: 0, coreId: "k1" });
  equal(overwritten.accepted, true);
  equal(overwritten.effect, "note-added");
  deepEqual(overwritten.cells, [0, 8]);
  deepEqual([...overwritten.position.notes], [[0, "k1"], [8, "k1"]]);
  deepEqual([...top.position.notes], [[0, "k0"], [2, "k0"]], "overwrite does not mutate old state");

  const removed = applyMove(puzzle, overwritten.position, { type: "toggle-note", cell: 8, coreId: "k1" });
  equal(removed.accepted, true);
  equal(removed.effect, "note-removed");
  deepEqual([...removed.position.notes], []);
});

test("非法笔记有明确拒绝原因，合法对称笔记完全不参与胜负", () => {
  const notesPuzzle = puzzleFrom("note-rejections", 3, 3, "cjj");
  equal(applyMove(notesPuzzle, {}, { type: "toggle-note", cell: 1, coreId: "k0" }).reason, "note-on-core");
  equal(applyMove(notesPuzzle, {}, { type: "toggle-note", cell: 6, coreId: "k0" }).reason, "note-outside");
  equal(applyMove(notesPuzzle, {}, { type: "toggle-note", cell: 0, coreId: "missing" }).reason, "invalid-note-target");
  equal(applyMove(notesPuzzle, {}, { type: "toggle-note", cell: 99, coreId: "k0" }).reason, "invalid-note-target");

  const puzzle = puzzleFrom("notes-ignore-victory", 3, 3, "all");
  const solutionEdges = new Set(["v:0:1", "v:2:2", "h:1:0", "h:2:2"]);
  const notes = new Map([[1, "k1"], [7, "k1"]]);
  const evaluation = evaluatePosition(puzzle, { edges: solutionEdges, notes });
  equal(evaluation.complete, true);
  deepEqual([...evaluation.notes], [[1, "k1"], [7, "k1"]]);
  deepEqual([...notes], [[1, "k1"], [7, "k1"]]);
  const rejected = applyMove(puzzle, { edges: solutionEdges }, {
    type: "toggle-note", cell: 1, coreId: "k1",
  });
  equal(rejected.accepted, false);
  equal(rejected.reason, "region-complete");
  equal(rejected.position.edges.size, solutionEdges.size);
});

test("会话只记录成功落笔，撤销精确恢复，空撤销和重开保持原子", () => {
  const puzzle = puzzleFrom("session", 3, 3, "m");
  const initial = createSession(puzzle);
  const initialJson = sessionToJSON(puzzle, initial);
  const moved = applySessionMove(puzzle, initial, { type: "toggle-edge", edgeId: "v:0:1" });
  equal(moved.accepted, true);
  equal(moved.session.moves, 1);
  equal(moved.session.history.length, 1);
  deepEqual(moved.session.history[0], initialJson.position);
  equal(initial.moves, 0);
  equal(initial.history.length, 0);
  equal(initial.position.edges.size, 0);

  const rejected = applySessionMove(puzzle, moved.session, { type: "toggle-edge", edgeId: "missing" });
  equal(rejected.accepted, false);
  equal(rejected.reason, "not-an-edge");
  equal(rejected.session, moved.session, "rejected moves return the identical session object");
  equal(rejected.session.moves, 1);
  equal(rejected.session.history.length, 1);

  const undone = undoSession(puzzle, moved.session);
  equal(undone.accepted, true);
  equal(undone.session.moves, 0);
  deepEqual(sessionToJSON(puzzle, undone.session), initialJson);
  const emptyUndo = undoSession(puzzle, undone.session);
  equal(emptyUndo.accepted, false);
  equal(emptyUndo.reason, "empty-history");
  equal(emptyUndo.session, undone.session);

  const restarted = restartSession(puzzle);
  deepEqual(sessionToJSON(puzzle, restarted), initialJson);
});

test("撤销历史固定保留最后一百个可逆快照", () => {
  const puzzle = puzzleFrom("bounded-history", 3, 3, "m");
  let session = createSession(puzzle);
  for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
    const moved = applySessionMove(puzzle, session, { type: "toggle-edge", edgeId: "v:0:1" });
    equal(moved.accepted, true);
    session = moved.session;
  }
  equal(session.moves, 105);
  equal(session.history.length, HISTORY_LIMIT);
  for (let index = 0; index < HISTORY_LIMIT; index += 1) {
    session = undoSession(puzzle, session).session;
  }
  equal(session.moves, 5);
  equal(session.history.length, 0);
  equal(undoSession(puzzle, session).accepted, false);
});

test("会话 JSON 可往返且边和成对笔记的排序不依赖插入顺序", () => {
  const puzzle = puzzleFrom("save-roundtrip", 3, 3, "cjj");
  let session = createSession(puzzle);
  session = applySessionMove(puzzle, session, { type: "toggle-note", cell: 0, coreId: "k1" }).session;
  session = applySessionMove(puzzle, session, { type: "toggle-edge", edgeId: "v:0:1" }).session;
  const json = sessionToJSON(puzzle, session);
  const restored = restoreSession(puzzle, JSON.parse(JSON.stringify(json)));
  deepEqual(sessionToJSON(puzzle, restored), json);
  equal(restored.moves, 2);
  equal(restored.history.length, 2);
  deepEqual([...restored.position.edges], ["v:0:1"]);
  deepEqual([...restored.position.notes], [[0, "k1"], [8, "k1"]]);

  deepEqual(positionToJSON({
    edges: new Set(["v:2:2", "h:2:2", "v:0:1", "h:1:0"]),
    notes: new Map([[8, "k1"], [0, "k1"]]),
  }), {
    edges: ["h:1:0", "h:2:2", "v:0:1", "v:2:2"],
    notes: [[0, "k1"], [8, "k1"]],
  });
});

test("严格恢复拒绝错误题号、计数、历史、重复或封锁边及畸形笔记", () => {
  const puzzle = puzzleFrom("strict-save", 3, 3, "cjj");
  const blank = sessionToJSON(puzzle, createSession(puzzle));
  throws(() => restoreSession(puzzle, { ...blank, puzzleId: "another" }), /Invalid saved session/);
  throws(() => restoreSession(puzzle, { ...blank, moves: -1 }), /Invalid saved session/);
  throws(() => restoreSession(puzzle, { ...blank, moves: 1.5 }), /Invalid saved session/);
  throws(() => restoreSession(puzzle, { ...blank, moves: Number.MAX_SAFE_INTEGER + 1 }), /Invalid saved session/);
  throws(() => restoreSession(puzzle, { ...blank, moves: 0, history: [blank.position] }), /Invalid saved session/);
  throws(() => restoreSession(puzzle, {
    ...blank,
    moves: HISTORY_LIMIT + 1,
    history: Array.from({ length: HISTORY_LIMIT + 1 }, () => blank.position),
  }), /Invalid saved session/);
  throws(() => restoreSession(puzzle, {
    ...blank,
    position: { edges: ["v:0:1", "v:0:1"], notes: [] },
  }), /Duplicate saved edge/);
  throws(() => restoreSession(puzzle, {
    ...blank,
    position: { edges: ["missing"], notes: [] },
  }), /Invalid saved edge/);
  throws(() => restoreSession(puzzle, {
    ...blank,
    position: { edges: [], notes: [[0]] },
  }), /Invalid saved note/);
  throws(() => restoreSession(puzzle, {
    ...blank,
    position: { edges: [], notes: [[0, "k1"], [0, "k1"]] },
  }), /Invalid saved note/);
  throws(() => restoreSession(puzzle, {
    ...blank,
    position: { edges: [], notes: [[0, "missing"], [8, "missing"]] },
  }), /Invalid saved note/);
  throws(() => restoreSession(puzzle, {
    ...blank,
    position: { edges: [], notes: [[0, "k1"]] },
  }), /symmetry/);
  throws(() => createSession(puzzle, { notes: new Map([[0, "k1"]]) }), /symmetry/);

  const blockedPuzzle = puzzleFrom("strict-blocked", 4, 3, "r");
  const blockedBlank = sessionToJSON(blockedPuzzle, createSession(blockedPuzzle));
  throws(() => restoreSession(blockedPuzzle, {
    ...blockedBlank,
    position: { edges: ["v:1:2"], notes: [] },
  }), /Invalid saved edge/);
});

test("求解器对零解、歧义、唯一与截断状态给出不夸大的契约", () => {
  const impossible = solvePuzzle(puzzleFrom("zero", 3, 3, "ab"), { limit: 3 });
  equal(impossible.count, 0);
  equal(impossible.solutions.length, 0);
  equal(impossible.unique, false);
  equal(impossible.truncated, false);
  ok(impossible.visited >= 1);

  const uniquePuzzle = puzzleFrom("unique", 3, 3, "m");
  const unique = solvePuzzle(uniquePuzzle, { limit: 2 });
  equal(unique.count, 1);
  equal(unique.unique, true);
  equal(unique.truncated, false);
  equal(evaluatePosition(uniquePuzzle, { edges: unique.solutions[0].edges }).complete, true);

  const ambiguousPuzzle = puzzleFrom("ambiguous", 3, 3, "cjj");
  const one = solvePuzzle(ambiguousPuzzle, { limit: 1 });
  equal(one.count, 1);
  equal(one.unique, false);
  equal(one.truncated, true);
  const two = solvePuzzle(ambiguousPuzzle, { limit: 2 });
  equal(two.count, 2);
  equal(two.unique, false);
  equal(two.truncated, true);
  const exhaustive = solvePuzzle(ambiguousPuzzle, { limit: 3 });
  equal(exhaustive.count, 2);
  equal(exhaustive.unique, false);
  equal(exhaustive.truncated, false);
  equal(new Set(exhaustive.solutions.map(({ owners }) => [...owners].join(","))).size, 2);
  equal(exhaustive.solutions.every(({ edges }) => evaluatePosition(ambiguousPuzzle, { edges }).complete), true);
});

test("九道内置题逐题穷尽第二解并由生成归属边界重新完成", () => {
  const expected = [
    ["sprout-dewdrop", "sprout", 5, 101, "egfjdtkn"],
    ["sprout-pollen", "sprout", 5, 102, "cflkzdcddc"],
    ["sprout-shell", "sprout", 5, 103, "cflkkufe"],
    ["orbit-anemone", "orbit", 7, 201, "kqfdfizcgzfpfibd"],
    ["orbit-tide", "orbit", 7, 202, "ijiuuhzjecujfk"],
    ["orbit-cocoon", "orbit", 7, 203, "agjpzaeacszpczdg"],
    ["quasar-cathedral", "quasar", 9, 301, "bizovofccczzvzcddezfidjehf"],
    ["quasar-reef", "quasar", 9, 302, "mecuezigmlzzcilgkhzmcdsdg"],
    ["quasar-crown", "quasar", 9, 303, "bzckkczcodzcnzbezfdtgamzbg"],
  ];
  equal(LEVELS.length, 9);
  deepEqual(LEVELS.map(({ id, difficulty, width, generatorSeed, description }) => (
    [id, difficulty, width, generatorSeed, description]
  )), expected);
  for (const level of LEVELS) {
    equal(level.width, level.height, level.id);
    match(level.sourceParameters, new RegExp(`^${level.width}x${level.height}d[nu]$`), level.id);
    const solved = solvePuzzle(level, { limit: 2 });
    equal(solved.count, 1, `${level.id} has exactly one solution`);
    equal(solved.unique, true, `${level.id} uniqueness is exhaustive`);
    equal(solved.truncated, false, `${level.id} search reached its boundary`);
    ok(solved.visited >= 1, `${level.id} search visited a state`);
    const solution = solved.solutions[0];
    equal(solution.owners.length, level.width * level.height, level.id);
    equal([...solution.owners].every((owner) => owner >= 0 && owner < level.cores.length), true, level.id);
    const regenerated = boundariesFromOwners(level, solution.owners);
    deepEqual(regenerated, solution.edges, `${level.id} boundaries derive only from owners`);
    equal([...regenerated].every((id) => edgeById(level, id)?.legal), true, level.id);
    const evaluation = evaluatePosition(level, { edges: regenerated });
    equal(evaluation.complete, true, `${level.id} generated boundaries complete`);
    equal(evaluation.validComponentCount, level.cores.length, `${level.id} one galaxy per core`);
    equal(evaluation.validCells.size, level.width * level.height, `${level.id} covers every cell`);
  }
});

test("难度目录是三档各三题，查找与规模层级稳定", () => {
  deepEqual(DIFFICULTIES.map(({ id }) => id), ["sprout", "orbit", "quasar"]);
  deepEqual(DIFFICULTIES.map(({ id }) => levelsForDifficulty(id).length), [3, 3, 3]);
  deepEqual(DIFFICULTIES.map(({ id }) => levelsForDifficulty(id)[0].width), [5, 7, 9]);
  equal(findLevel("orbit-tide")?.difficulty, "orbit");
  equal(findLevel("missing"), null);
});

test("指针命中总让无歧义星核优先，笔记模式的普通位置才返回方格", () => {
  const fixtures = [
    puzzleFrom("pointer-cell", 3, 3, "m"),
    puzzleFrom("pointer-v-edge", 4, 3, "r"),
    puzzleFrom("pointer-h-edge", 3, 4, "r"),
    puzzleFrom("pointer-vertex", 4, 4, "y"),
  ];
  for (const puzzle of fixtures) {
    const core = puzzle.cores[0];
    const point = { x: core.x / 2, y: core.y / 2 };
    deepEqual(resolvePointerTarget(puzzle, point), { type: "core", coreId: "k0", distance: 0 }, puzzle.id);
    deepEqual(resolvePointerTarget(puzzle, point, { mode: "note" }), {
      type: "core", coreId: "k0", distance: 0,
    }, puzzle.id);
  }

  const notePuzzle = puzzleFrom("pointer-note", 3, 3, "m");
  deepEqual(resolvePointerTarget(notePuzzle, { x: 0.25, y: 2.25 }, { mode: "note" }), {
    type: "cell", cell: 6,
  });
  equal(resolvePointerTarget(notePuzzle, { x: -0.01, y: 1 }, { mode: "note" }), null);
  equal(resolvePointerTarget(notePuzzle, { x: 3, y: 1 }, { mode: "note" }), null);

  const blocked = puzzleFrom("pointer-blocked", 4, 3, "r");
  equal(resolvePointerTarget(blocked, { x: 2.02, y: 1.5 }, {
    coreTolerance: 0.01,
    edgeTolerance: 0.05,
  }), null, "a blocked edge never leaks through edge hit testing");
});

test("相邻星核的命中带重叠时不得落到下面的边或笔记格", () => {
  const adjacentCores = puzzleFrom("pointer-core-ambiguity", 3, 3, "ab");
  const drawTarget = resolvePointerTarget(adjacentCores, { x: 1, y: 0.5 }, {
    coreTolerance: 0.6,
    edgeTolerance: 0.22,
  });
  const noteTarget = resolvePointerTarget(adjacentCores, { x: 1, y: 0.5 }, {
    mode: "note",
    coreTolerance: 0.6,
  });
  deepEqual([drawTarget, noteTarget], [null, null],
    "equidistant cores must not fall through to another target kind");
});

test("边交点歧义、非数值和刚越界坐标全部拒绝落笔", () => {
  const puzzle = puzzleFrom("pointer-edge-ambiguity", 3, 3, "m");
  equal(resolvePointerTarget(puzzle, { x: 1, y: 1 }), null, "grid intersection has multiple equally close edges");
  equal(resolvePointerTarget(puzzle, { x: Number.NaN, y: 1 }), null);
  equal(resolvePointerTarget(puzzle, { x: 1, y: Number.POSITIVE_INFINITY }), null);
  equal(resolvePointerTarget(puzzle, null), null);
  equal(resolvePointerTarget(puzzle, { x: 1, y: -0.01 }), null, "nearby geometry outside the board is not interactive");
  equal(resolvePointerTarget(puzzle, { x: 3.01, y: 1 }), null, "right of the board is not interactive");
});

test("44px 逻辑命中带随棋盘缩放，所有三类星核及合法细边在 ±21px 可达", () => {
  const coreFixtures = [
    puzzleFrom("scale-cell", 3, 3, "m"),
    puzzleFrom("scale-v-edge", 4, 3, "r"),
    puzzleFrom("scale-h-edge", 3, 4, "r"),
    puzzleFrom("scale-vertex", 4, 4, "y"),
  ];
  for (const puzzle of coreFixtures) {
    const core = puzzle.cores[0];
    const centre = { x: core.x / 2, y: core.y / 2 };
    equal(resolvePointerTarget(puzzle, { x: centre.x + 21 / 100, y: centre.y })?.type, "core", `${puzzle.id} at 100px/cell`);
    equal(resolvePointerTarget(puzzle, { x: centre.x - 21 / 100, y: centre.y })?.coreId, "k0", `${puzzle.id} negative offset`);
    equal(resolvePointerTarget(puzzle, { x: centre.x + 21 / 50, y: centre.y }, {
      coreTolerance: 22 / 50,
    })?.type, "core", `${puzzle.id} at 50px/cell`);
  }

  const edgePuzzle = puzzleFrom("scale-edge-target", 3, 3, "m");
  equal(resolvePointerTarget(edgePuzzle, { x: 1 + 21 / 100, y: 0.5 })?.edgeId, "v:0:1");
  equal(resolvePointerTarget(edgePuzzle, { x: 1 + 23 / 100, y: 0.5 }), null);
  equal(resolvePointerTarget(edgePuzzle, { x: 1 + 21 / 50, y: 0.5 }, {
    edgeTolerance: 22 / 50,
  })?.edgeId, "v:0:1");
  equal(resolvePointerTarget(edgePuzzle, { x: 1 + 23 / 50, y: 0.5 }, {
    edgeTolerance: 22 / 50,
  }), null);
});

test("9×9 手机完整盘采用半格内边界命中，不会因缩放选到相邻边", () => {
  const puzzle = puzzleFrom("compact-edge-target", 3, 3, "m");
  const compactTolerance = Math.min(22 / (281 / 9), 0.46);
  equal(compactTolerance, 0.46);
  equal(resolvePointerTarget(puzzle, { x: 1 + 0.3, y: 0.5 }, {
    edgeTolerance: compactTolerance,
    ambiguityGap: 0.14,
  })?.edgeId, "v:0:1");
  equal(resolvePointerTarget(puzzle, { x: 1 + 0.44, y: 0.5 }, {
    edgeTolerance: compactTolerance,
    ambiguityGap: 0.14,
  }), null, "接近边交点的重叠命中不得猜测其他边");
});

test("HTML 提供本地入口、语义化游戏组、完整工具与实时状态", () => {
  ok(htmlSource, "index.html exists");
  match(htmlSource, /<html\b[^>]*\blang=["']zh-CN["'][^>]*\bdata-realm=["']nebula-hatchery["']/i);
  const viewport = htmlSource.match(/<meta\b[^>]*\bname=["']viewport["'][^>]*>/i)?.[0] ?? "";
  match(attribute(viewport, "content") ?? "", /width=device-width/);
  match(attribute(viewport, "content") ?? "", /viewport-fit=cover/);
  match(htmlSource, /href=["']\.\/styles\.css["']/);
  match(htmlSource, /href=["']\.\.\/\.\.\/shared\/realm-ui\.css["']/);
  match(htmlSource, /src=["']\.\.\/\.\.\/shared\/realm-ui\.mjs["']/);
  match(htmlSource, /src=["']\.\/app\.mjs["']/);

  const board = tagWithId(htmlSource, "svg", "nebula-board");
  ok(board);
  equal(attribute(board, "role"), "group");
  equal(attribute(board, "tabindex"), "0");
  ok(/\bdata-realm-game-focus(?:\s|>|=)/.test(board));
  ok(attribute(board, "aria-label"));
  match(attribute(board, "aria-describedby") ?? "", /\bboard-help\b/);
  match(attribute(board, "aria-describedby") ?? "", /\bboard-status\b/);
  equal(/role=["']grid["']/i.test(htmlSource), false);
  equal(/role=["']gridcell["']/i.test(htmlSource), false);

  match(htmlSource, /role=["']toolbar["'][^>]*aria-label=/i);
  for (const mode of ["draw", "erase", "note"]) {
    const button = htmlSource.match(new RegExp(`<button\\b[^>]*\\bdata-mode=["']${mode}["'][^>]*>`, "i"))?.[0] ?? "";
    ok(button, `${mode} tool exists`);
    equal(attribute(button, "type"), "button");
    ok(attribute(button, "aria-pressed") !== null);
  }
  match(htmlSource, /<fieldset\b[^>]*class=["'][^"']*difficulty-picker/);
  match(htmlSource, /<legend>选择培育强度<\/legend>/);
  for (const id of [
    "mute-button", "rules-button", "new-game-button", "restart-button", "undo-button",
    "footer-rules-button", "rules-close-button", "next-level-button", "stay-button",
  ]) {
    const button = tagWithId(htmlSource, "button", id);
    ok(button, `${id} exists`);
    equal(attribute(button, "type"), "button", `${id} has a non-submitting type`);
  }
  const progress = htmlSource.match(/<[^>]+role=["']progressbar["'][^>]*>/i)?.[0] ?? "";
  equal(attribute(progress, "aria-valuemin"), "0");
  equal(attribute(progress, "aria-valuemax"), "100");
  equal(attribute(progress, "aria-valuenow"), "0");
  match(htmlSource, /id=["']board-status["'][^>]*aria-live=["']polite["']/i);
  match(htmlSource, /id=["']toast["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/i);
  match(htmlSource, /id=["']assertive-status["'][^>]*role=["']alert["'][^>]*aria-live=["']assertive["']/i);
});

test("规则与胜利使用原生有标题对话框，规则、来源和笔记判胜边界写清", () => {
  for (const [id, titleId] of [["rules-dialog", "rules-title"], ["victory-dialog", "victory-title"]]) {
    const dialog = tagWithId(htmlSource, "dialog", id);
    ok(dialog, `${id} is a native dialog`);
    equal(attribute(dialog, "aria-labelledby"), titleId);
    match(htmlSource, new RegExp(`id=["']${titleId}["']`));
  }
  match(htmlSource, /Galaxies\s*\/\s*Spiral Galaxies/i);
  match(htmlSource, /Nikoli/i);
  match(htmlSource, /James Harvey/i);
  match(htmlSource, /ebnbin\/puzzles/i);
  match(htmlSource, /MIT License/i);
  match(htmlSource, /github\.com\/ebnbin\/puzzles\/blob\/main\/doc-zh\/galaxies\.html/i);
  match(htmlSource, /chiark\.greenend\.org\.uk\/~sgtatham\/puzzles/i);
  match(htmlSource, /THIRD_PARTY_NOTICES\.md/i);
  match(htmlSource, /格心、边心或角点/);
  match(htmlSource, /四向连通/);
  match(htmlSource, /180°/);
  match(htmlSource, /笔记正确与否都不参与通关/);
  match(htmlSource, /44px/);
  match(htmlSource, /方向键/);
  match(htmlSource, /Enter/);
  for (const button of htmlSource.matchAll(/<button\b[^>]*>/gi)) {
    equal(attribute(button[0], "type"), "button", button[0]);
  }
});

test("CSS 保证 44px 控件、可缩放矢量边、清楚玩家边界与窄屏无横溢", () => {
  ok(cssSource, "styles.css exists");
  match(cssSource, /button\s*\{[^}]*min-height:\s*44px/s);
  match(cssSource, /\.difficulty-button\s*\{[^}]*min-height:\s*44px/s);
  match(cssSource, /\.dialog-close\s*\{[^}]*(?:width|height):\s*44px/s);
  match(cssSource, /\.nebula-board\s*\{[^}]*touch-action:\s*none/s);
  ok((cssSource.match(/vector-effect:\s*non-scaling-stroke/g) ?? []).length >= 8);
  match(cssSource, /\.user-boundary-shadow\s*\{[^}]*stroke-width:\s*(?:[4-9]|\d{2,})(?:\.\d+)?/s);
  const playerBoundaryWidth = Number(cssSource.match(/\.user-boundary\s*\{[^}]*stroke-width:\s*([\d.]+)/s)?.[1]);
  ok(playerBoundaryWidth >= 2, "the visible player boundary remains at least 2px");
  match(cssSource, /overflow-x:\s*(?:clip|hidden)/);
  match(cssSource, /minmax\(0,\s*1fr\)/);
  match(cssSource, /width:\s*min\(100%/);
  match(htmlSource, /id=["']board-scroll["']/);
  match(htmlSource, /id=["']board-pan-left["']/);
  match(htmlSource, /id=["']board-pan-right["']/);
  match(cssSource, /\.board-frame\.is-wide-board\s+\.nebula-board\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%/s);
  match(cssSource, /\.board-frame\.is-wide-board\s+\.board-scroll\s*\{[^}]*overflow:\s*hidden/s);
  match(htmlSource, /class=["']board-pan-controls["'][^>]*hidden/);
  match(cssSource, /\.board-pan-controls button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
  match(appSource, /dataset\.gridSize\s*=\s*String\(width\)/);
  match(appSource, /classList\.toggle\(["']is-wide-board["'],\s*width\s*>=\s*9\)/);
  match(appSource, /MAX_COMPACT_EDGE_TOLERANCE\s*=\s*0\.46/);
  match(appSource, /Math\.min\([\s\S]*?MAX_COMPACT_EDGE_TOLERANCE/);
  for (const breakpoint of [760, 520, 350]) {
    match(cssSource, new RegExp(`@media\\s*\\(max-width:\\s*${breakpoint}px\\)`));
  }
  match(cssSource, /@media\s*\(prefers-contrast:\s*more\)/);
  match(cssSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("应用入口连接纯逻辑会话、坐标换算、指针捕获和取消路径", () => {
  ok(appSource, "app.mjs exists");
  match(appSource, /from\s+["']\.\/logic\.mjs["']/);
  for (const name of [
    "DIFFICULTIES", "LEVELS", "applySessionMove", "createSession", "evaluatePosition",
    "resolvePointerTarget", "restartSession", "restoreSession", "sessionToJSON", "undoSession",
  ]) {
    match(appSource, new RegExp(`\\b${name}\\b`), `${name} is wired into the app`);
  }
  match(appSource, /addEventListener\(["']pointerdown["']/);
  match(appSource, /addEventListener\(["']pointermove["']/);
  match(appSource, /addEventListener\(["']pointerup["']/);
  match(appSource, /addEventListener\(["']pointercancel["']/);
  match(appSource, /setPointerCapture\s*\(/);
  match(appSource, /releasePointerCapture\s*\(/);
  match(appSource, /getScreenCTM\?*\.?(?:\s*\()|getScreenCTM\?\.\(\)/);
  match(appSource, /matrixTransform\s*\(|\.inverse\s*\(/);
  match(appSource, /clientX/);
  match(appSource, /clientY/);

  const svg = {
    getScreenCTM() {
      return {
        inverse() {
          return { a: 0.5, b: 0, c: 0, d: 0.25, e: -5, f: -10 };
        },
      };
    },
  };
  deepEqual(clientToBoardPoint(svg, { clientX: 20, clientY: 48 }), { x: 5, y: 2 });
  deepEqual(clientToBoardPoint(svg, 24, 56), { x: 7, y: 4 });
  equal(clientToBoardPoint(svg, Number.NaN, 1), null);
  equal(clientToBoardPoint({ getScreenCTM: () => null }, 1, 1), null);
});

test("键盘、存储、静音合成声与减少动画偏好都有完整降级路径", () => {
  ok(appSource, "app.mjs exists");
  match(appSource, /addEventListener\(["']keydown["']/);
  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "1", "2", "3", "z", "r", "n", "m"]) {
    ok(appSource.includes(key), `${key} shortcut is present`);
  }
  match(appSource, /dialog\[open\]/);
  match(appSource, /localStorage\.(?:getItem|setItem)/);
  match(appSource, /try\s*\{/);
  match(appSource, /catch\s*(?:\([^)]*\))?\s*\{/);
  match(appSource, /\bAudioContext\b|webkitAudioContext/);
  match(appSource, /createOscillator\s*\(/);
  match(appSource, /createGain\s*\(/);
  match(appSource, /aria-pressed/);
  match(appSource, /prefers-reduced-motion/);
  match(appSource, /matchMedia(?:\?\.)?\s*\(/);
});

test("opaque run tracking survives refresh and renews only for a fresh star embryo", () => {
  const level = LEVELS[0];
  const details = {
    levelId: level.id,
    tier: DIFFICULTIES.findIndex(({ id }) => id === level.difficulty) + 1,
    moves: 12,
    par: 12,
  };
  const first = createNebulaCompletionTracking({ runId: "run-nebula-attempt-0001" });
  equal(first.completionEventId, "nebula-hatchery:run-nebula-attempt-0001:complete");
  const staged = stageNebulaCompletion(first, details);
  equal(staged.completionOutbox[0].eventId, first.completionEventId);
  const restored = restoreNebulaCompletionTracking(JSON.parse(JSON.stringify(staged)), details);
  equal(restored.runId, first.runId);
  deepEqual(restored.completionOutbox, staged.completionOutbox);

  const next = createNebulaCompletionTracking({ runId: "run-nebula-attempt-0002" });
  notEqual(next.runId, first.runId);
  equal(nebulaCompletionEventId(next.runId), next.completionEventId);
  equal(createNebulaRunId(() => "run-nebula-injected-0003"), "run-nebula-injected-0003");
  equal(restoreNebulaCompletionTracking({ ...staged, completionEventId: "nebula-hatchery:wrong-run:complete" }, details), null);
});

test("outbox migration and queue deduplication preserve all 65 pending nebula events", () => {
  const payloads = Array.from({ length: 65 }, (_, index) => ({
    eventId: `nebula-hatchery:run-nebula-bulk-${String(index).padStart(3, "0")}:complete`,
    levelId: `nebula-bulk-${index}`,
    tier: index % 3 + 1,
    moves: index,
    par: 24,
  }));
  const normalized = normalizeNebulaOutbox([...payloads, payloads[0]]);
  equal(normalized.length, 65);
  equal(normalized[0].eventId, payloads[0].eventId);
  equal(normalized.at(-1).eventId, payloads.at(-1).eventId);
  const bulkTracking = createNebulaCompletionTracking({
    runId: "run-nebula-bulk-active",
    completionOutbox: normalized,
  });
  const bulkRestored = restoreNebulaCompletionTracking(JSON.parse(JSON.stringify(bulkTracking)));
  equal(bulkRestored.completionOutbox.length, 65);
  equal(bulkRestored.completionOutbox[0].eventId, payloads[0].eventId);
  equal(bulkRestored.completionOutbox.at(-1).eventId, payloads.at(-1).eventId);
  const queue = [];
  equal(enqueueNebulaCompletion(queue, payloads[0]), true);
  equal(enqueueNebulaCompletion(queue, payloads[0]), false);
  equal(queue.length, 1);

  const tracking = createNebulaCompletionTracking({ runId: "run-nebula-single-migrate" });
  const staged = stageNebulaCompletion(tracking, {
    levelId: LEVELS[0].id,
    tier: 1,
    moves: 12,
    par: 12,
  });
  const migrated = restoreNebulaCompletionTracking({
    ...staged,
    completionOutbox: staged.completionOutbox[0],
  });
  equal(migrated.completionOutbox.length, 1);
  equal(migrated.completionOutbox[0].eventId, tracking.completionEventId);
});

test("host write-then-throw retry reuses one event and cannot repeat atlas or shared rewards", () => {
  const level = LEVELS[0];
  const details = {
    levelId: level.id,
    tier: DIFFICULTIES.findIndex(({ id }) => id === level.difficulty) + 1,
    moves: 12,
    par: 12,
  };
  const firstLocal = recordNebulaAtlasCompletion({
    completed: new Set(),
    rarities: new Set(),
    badges: { zeroConflict: false, intuition: false },
  }, level, { hadConflict: false, usedNotes: false });
  const repeatedLocal = recordNebulaAtlasCompletion(firstLocal.atlas, level, { hadConflict: false, usedNotes: false });
  equal(firstLocal.atlas.completed.size, 1);
  equal(repeatedLocal.atlas.completed.size, 1, "restoring the completed board cannot add another local clear");
  equal(repeatedLocal.discoveries.length, 0, "all local unlock claims are idempotent");

  const staged = stageNebulaCompletion(
    createNebulaCompletionTracking({ runId: "run-nebula-retry-0001" }),
    details,
  );
  let host = createProgress();
  let firstHostResult;
  const failed = confirmNebulaCompletion(staged, (payload) => {
    firstHostResult = awardCompletion(host, { ...payload, realm: REALM_ID }, new Date("2026-08-31T08:00:00Z"));
    host = firstHostResult.progress;
    throw new Error("bridge lost its acknowledgement");
  });
  equal(failed.succeeded, false);
  equal(failed.tracking.completionReported, false);
  equal(firstHostResult.duplicateEvent, false);
  equal(host.realms[REALM_ID].clears[level.id].wins, 1);
  const xpAfterThrow = host.xp;

  const refreshed = restoreNebulaCompletionTracking(
    JSON.parse(JSON.stringify(failed.tracking)),
    { ...details, moves: 5 },
  );
  equal(refreshed.completionOutbox[0].eventId, staged.completionOutbox[0].eventId);
  equal(refreshed.completionOutbox[0].moves, 12, "undoing the board cannot rewrite the historical completion payload");
  let retryHostResult;
  const retried = confirmNebulaCompletion(refreshed, (payload) => {
    retryHostResult = awardCompletion(host, { ...payload, realm: REALM_ID }, new Date("2026-08-31T08:05:00Z"));
    host = retryHostResult.progress;
    return retryHostResult;
  });
  equal(retried.succeeded, true);
  equal(retried.tracking.completionReported, true);
  deepEqual(retried.tracking.completionOutbox, []);
  equal(retryHostResult.duplicateEvent, true);
  equal(host.realms[REALM_ID].clears[level.id].wins, 1);
  equal(host.xp, xpAfterThrow);

  const duplicateDelivery = awardCompletion(host, { ...staged.completionOutbox[0], realm: REALM_ID });
  equal(duplicateDelivery.duplicateEvent, true);
  equal(duplicateDelivery.progress.realms[REALM_ID].clears[level.id].wins, 1);
  equal(duplicateDelivery.progress.xp, xpAfterThrow);
});

test("a pending nebula completion survives a new embryo and refresh", () => {
  const level = LEVELS[0];
  const details = {
    levelId: level.id,
    tier: DIFFICULTIES.findIndex(({ id }) => id === level.difficulty) + 1,
    moves: 12,
    par: 12,
  };
  const previous = stageNebulaCompletion(
    createNebulaCompletionTracking({ runId: "run-nebula-old-pending" }),
    details,
  );
  const oldEventId = previous.completionEventId;
  let host = createProgress();
  const failed = confirmNebulaCompletion(previous, (payload) => {
    host = awardCompletion(host, { ...payload, realm: REALM_ID }, new Date("2026-08-31T09:00:00Z")).progress;
    throw new Error("host acknowledgement lost");
  });
  const xpAfterThrow = host.xp;
  const winsAfterThrow = host.realms[REALM_ID].clears[level.id].wins;

  const nextRunId = "run-nebula-new-after-failure";
  const next = createNebulaCompletionTracking({
    runId: nextRunId,
    completionOutbox: failed.tracking.completionOutbox,
  });
  const refreshed = restoreNebulaCompletionTracking(JSON.parse(JSON.stringify(next)));
  equal(refreshed.runId, nextRunId);
  equal(refreshed.completionReported, false);
  equal(refreshed.completionOutbox[0].eventId, oldEventId);

  let retryResult;
  const retried = confirmNebulaCompletion(refreshed, (payload) => {
    retryResult = awardCompletion(host, { ...payload, realm: REALM_ID }, new Date("2026-08-31T09:05:00Z"));
    host = retryResult.progress;
    return retryResult;
  });
  equal(retryResult.duplicateEvent, true);
  equal(retried.tracking.runId, nextRunId);
  equal(retried.tracking.completionReported, false, "the previous embryo cannot mark the new run reported");
  deepEqual(retried.tracking.completionOutbox, []);
  equal(host.realms[REALM_ID].clears[level.id].wins, winsAfterThrow);
  equal(host.xp, xpAfterThrow);
});

test("完成只上报一次，队列后备、对话框串行和焦点恢复均显式实现", () => {
  ok(appSource, "app.mjs exists");
  match(appSource, /\bcompletionReported\b/);
  match(appSource, /stageNebulaCompletion\(completionTracking\(\), completionDetails\(\)\)/);
  match(appSource, /confirmNebulaCompletion\(completionTracking\(\), reportSharedCompletion\)/);
  match(appSource, /completionEventId/);
  match(appSource, /completionOutbox/);
  match(appSource, /realm:ready/);
  match(appSource, /else if \(state\.completionOutbox\.length > 0\) retryPendingSharedCompletion\(\)/);
  match(
    appSource,
    /applyCompletionTracking\(createNebulaCompletionTracking\(\{ completionOutbox: state\.completionOutbox \}\)\)/,
    "switching or restarting creates a new run id while preserving pending events",
  );
  match(appSource, /window\.RealmArcade\?*\.complete|window\.RealmArcade\s*&&\s*window\.RealmArcade\.complete/);
  match(appSource, /window\.__realmCompletionQueue/);
  match(appSource, /(?:push|concat)\s*\(/);
  match(appSource, /levelId\s*:/);
  match(appSource, /moves\s*:/);
  match(appSource, /tier\s*:/);
  ok(
    appSource.indexOf("persistGame();", appSource.indexOf("function registerCompletion"))
      < appSource.indexOf("confirmNebulaCompletion", appSource.indexOf("function registerCompletion")),
    "local settlement and outbox are persisted before the shared host call",
  );
  match(appSource, /dialog\[open\]/);
  match(appSource, /addEventListener\(["']close["'][^\n]*(?:once\s*:\s*true|\{\s*once:\s*true)/);
  match(appSource, /\.showModal\s*\(/);
  match(appSource, /\.focus\s*\(/);
  match(realmUiSource, /awardCompletion\(progress,\s*\{\s*\.\.\.payload,\s*realm:\s*realmId\s*\}\)/);
});

test("拖拽中的每次成功编辑仍按原子步计数，与边界数量效率线使用同一单位", () => {
  match(appSource, /state\.session\s*=\s*result\.session/);
  equal(/history:\s*transaction\.history/.test(appSource), false);
  equal(/moves:\s*transaction\.moves/.test(appSource), false);

  const puzzle = puzzleFrom("atomic-drag", 3, 3, "m");
  let session = createSession(puzzle);
  session = applySessionMove(puzzle, session, { type: "set-edge", edgeId: "v:0:1", value: true }).session;
  session = applySessionMove(puzzle, session, { type: "set-edge", edgeId: "v:1:1", value: true }).session;
  equal(session.moves, 2);
  equal(session.history.length, 2);
});

test("共享教程恰有三张异图且每张只含自己的状态类", () => {
  const tutorial = REALM_TUTORIALS["nebula-hatchery"];
  const config = REALM_CONFIGS["nebula-hatchery"];
  ok(tutorial);
  ok(config);
  equal(tutorial.cards.length, 3);
  deepEqual(tutorial.cards.map(({ focus }) => focus), ["elements", "action", "goal"]);
  const arts = tutorial.cards.map(({ focus }) => tutorialArt("nebula-hatchery", focus));
  equal(new Set(arts).size, 3);
  arts.forEach((art, index) => {
    match(art, /^<svg\b/);
    match(art, /preserveAspectRatio=["']xMidYMid meet["']/);
    equal((art.match(/class=["']art-(?:elements|action|goal)["']/g) ?? []).length, 1);
    match(art, new RegExp(`class=["']art-${tutorial.cards[index].focus}["']`));
    equal(/\bid=["']/.test(art), false, "tutorial SVGs avoid cross-card id collisions");
  });
  match(tutorialSource, /["']nebula-hatchery["']\s*:\s*nebulaHatchery/);
  match(arts[0], /格心核/);
  match(arts[0], /边心核/);
  match(arts[0], /角点核/);
  match(arts[1], /绘制边界/);
  match(arts[1], /归属笔记/);
  match(arts[2], /四向连通/);
  match(arts[2], /180° 对称/);
  equal(config.accent, "#86f2d0");
  equal(config.accentRgb, "134, 242, 208");
  equal(tutorial.version, 2);
  match(realmUiSource, /const accent = config\.accent/);
  match(realmUiSource, /const accentRgb = config\.accentRgb/);
});

test("第三方声明、九关宗师目标和独立验证入口保留可审计来源", () => {
  match(htmlSource, /Galaxies/i);
  match(noticesSource, /Simon Tatham/i);
  match(noticesSource, /MIT License/i);
  match(noticesSource, /ebnbin\/puzzles/i);
  match(htmlSource, /galaxies\.html|doc-zh\/galaxies/i);
  equal(masteryTargetFor("nebula-hatchery"), 9);
  equal(
    badgeRulesForRealm("nebula-hatchery").find(({ name }) => name === "本境宗师")?.description,
    "完成本境 9 个不同关卡",
  );
  match(validatorSource, /const discoveredV2Tests\s*=\s*files/);
  match(validatorSource, /\^v2\\\/games\\\/.+\\\/tests\\\.mjs\$/);
  match(validatorSource, /expectedV2TestPaths\s*=\s*new Set\(v2Games\.map/);
  match(validatorSource, /Unregistered v2 game test suite found/);
  match(validatorSource, /v2 game test suite is missing/);
});

let failures = 0;
for (const { name, callback } of tests) {
  try {
    callback();
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${name}`);
    console.error(error?.stack ?? error);
  }
}

if (failures > 0) {
  console.error(`Nebula Hatchery: ${tests.length - failures}/${tests.length} cases passed, ${failures} failed, ${assertions} assertions.`);
  process.exitCode = 1;
} else {
  console.log(`Nebula Hatchery: ${tests.length}/${tests.length} cases, ${assertions} assertions, ${LEVELS.length} exhaustively unique levels.`);
}
