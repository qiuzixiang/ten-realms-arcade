import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DIFFICULTIES,
  EDGE_STATES,
  LEVELS,
  PEARL_TYPES,
  allEdgeKeys,
  allNodeKeys,
  analyzeBoard,
  assertValidPuzzle,
  canonicalEdgeKey,
  cloneState,
  countSolutions,
  createState,
  degreeAt,
  deserializeState,
  edgeKey,
  evaluatePearl,
  getLevel,
  getLevels,
  getPuzzleErrors,
  inBounds,
  incidentEdgeKeys,
  isOrthogonalNeighbor,
  isSolved,
  lineShapeAt,
  nodeKey,
  normalizeBoardPoint,
  parseEdgeKey,
  parseNodeKey,
  serializeState,
  setEdgeState,
  stepBoardPoint,
  toggleLine,
  toggleMark,
  traceLoop,
  validatePuzzle,
  validateState,
} from "./logic.mjs";

let assertions = 0;
let testsRun = 0;
let verifiedSolutions = 0;
let verifiedUnique = 0;

const INDEX_SOURCE = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const APP_SOURCE = readFileSync(new URL("./app.mjs", import.meta.url), "utf8");

function test(name, callback) {
  try {
    callback();
    testsRun += 1;
    process.stdout.write(`✓ 灵龙巡脉 · ${name}\n`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function strictEqual(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function throws(callback, matcher, message) {
  assertions += 1;
  assert.throws(callback, matcher, message);
}

function makePuzzle({
  id = "test-puzzle",
  width = 5,
  height = 5,
  pearls = [{ x: 2, y: 2, type: PEARL_TYPES.WHITE }],
  solution,
} = {}) {
  return {
    id,
    title: id,
    difficulty: "test",
    width,
    height,
    pearls,
    ...(solution === undefined ? {} : { solution }),
  };
}

function lines(...endpointPairs) {
  return new Set(endpointPairs.map(([a, b]) => edgeKey(a, b)));
}

function rectangleLoop(left, top, right, bottom) {
  const edges = [];
  for (let x = left; x < right; x += 1) {
    edges.push(edgeKey([x, top], [x + 1, top]));
    edges.push(edgeKey([x, bottom], [x + 1, bottom]));
  }
  for (let y = top; y < bottom; y += 1) {
    edges.push(edgeKey([left, y], [left, y + 1]));
    edges.push(edgeKey([right, y], [right, y + 1]));
  }
  return new Set(edges);
}

function conflictReasons(result) {
  return result.conflicts.map(({ reason }) => reason);
}

test("棋盘使用单一 group 语义并隐藏纯视觉与指针命中层", () => {
  const boardTag = INDEX_SOURCE.match(/<svg[\s\S]*?id="dragon-board"[\s\S]*?>/)?.[0] ?? "";
  ok(boardTag, "页面必须包含灵图棋盘 SVG");
  ok(boardTag.includes('role="group"'), "棋盘应作为单一可聚焦 group 暴露");
  strictEqual(boardTag.includes('role="grid"'), false, "没有 row/cell ownership 时不得宣称 grid");
  ok(
    boardTag.includes('aria-describedby="board-help board-pearl-status"'),
    "棋盘应关联操作说明与动态灵珠状态",
  );
  ok(INDEX_SOURCE.includes('<p hidden id="board-help">'), "操作说明应只作为引用描述，不重复占据浏览节点");
  ok(
    INDEX_SOURCE.includes('<p hidden id="board-pearl-status">'),
    "灵珠状态应只作为引用描述，不重复占据浏览节点",
  );
  strictEqual(APP_SOURCE.includes('role="gridcell"'), false, "视觉灵珠不得残留孤立 gridcell 语义");
  strictEqual(APP_SOURCE.includes('data-edge="${edge}" aria-label='), false, "透明边命中线不得产生读屏名称");
  ok(
    APP_SOURCE.includes('<g aria-hidden="true">${hitEdges.join("")}${touchNodes.join("")}</g>'),
    "整个纯指针命中层必须从无障碍树隐藏",
  );
  ok(
    APP_SOURCE.includes('class="pearl-group${stateClass}" aria-hidden="true"'),
    "视觉灵珠应隐藏，并由棋盘描述统一播报状态",
  );
});

test("节点、边解析与无向边规范化", () => {
  strictEqual(nodeKey([2, 3]), "2,3");
  strictEqual(nodeKey(2, 3), "2,3");
  equal(parseNodeKey("12,7"), { x: 12, y: 7 });
  equal(parseNodeKey("-2,4"), { x: -2, y: 4 });
  throws(() => parseNodeKey("2:3"), TypeError);
  throws(() => parseNodeKey("2.5,3"), TypeError);

  strictEqual(edgeKey([1, 2], [0, 2]), "0,2|1,2");
  strictEqual(edgeKey([2, 3], [2, 2]), "2,2|2,3");
  strictEqual(edgeKey(1, 2, 0, 2), "0,2|1,2");
  strictEqual(canonicalEdgeKey([0, 2], [1, 2]), "0,2|1,2");
  equal(parseEdgeKey("0,2|1,2"), {
    a: { x: 0, y: 2 },
    b: { x: 1, y: 2 },
    key: "0,2|1,2",
  });
  throws(() => parseEdgeKey("1,2|0,2"), /canonical/);
  throws(() => parseEdgeKey("0,0|1,1"), /orthogonally/);
  throws(() => edgeKey([1, 1], [1, 1]), RangeError);
  throws(() => edgeKey([0, 0], [1, 1]), RangeError);
  strictEqual(isOrthogonalNeighbor([0, 0], [1, 0]), true);
  strictEqual(isOrthogonalNeighbor([0, 0], [0, 1]), true);
  strictEqual(isOrthogonalNeighbor([0, 0], [1, 1]), false);
});

test("格心边界、节点集与可用边集精确", () => {
  const puzzle = makePuzzle({ id: "bounds", width: 3, height: 2, pearls: [{ x: 1, y: 0, type: "white" }] });
  strictEqual(inBounds(puzzle, [0, 0]), true);
  strictEqual(inBounds(puzzle, [2, 1]), true);
  strictEqual(inBounds(puzzle, [-1, 0]), false);
  strictEqual(inBounds(puzzle, [3, 1]), false);
  strictEqual(inBounds(puzzle, [1, 2]), false);
  strictEqual(inBounds(puzzle, [1.5, 1]), false);
  equal(allNodeKeys(puzzle), ["0,0", "1,0", "2,0", "0,1", "1,1", "2,1"]);
  strictEqual(allEdgeKeys(puzzle).length, 7, "3×2 格心图应有 3(2-1)+2(3-1)=7 条边");
  strictEqual(new Set(allEdgeKeys(puzzle)).size, 7);
  equal(new Set(incidentEdgeKeys(puzzle, { x: 0, y: 0 })), new Set(["0,0|1,0", "0,0|0,1"]));
  equal(incidentEdgeKeys(puzzle, { x: 9, y: 9 }), []);
});

test("题面解析拒绝越界、重珠、非规范边和伪解", () => {
  const valid = makePuzzle({ id: "valid-definition" });
  strictEqual(validatePuzzle(valid), true);
  strictEqual(getPuzzleErrors(valid).length, 0);
  strictEqual(assertValidPuzzle(valid), valid);

  ok(getPuzzleErrors({ ...valid, width: 1 }).some((message) => message.includes("width")));
  ok(getPuzzleErrors({ ...valid, pearls: [{ x: 5, y: 1, type: "white" }] })
    .some((message) => message.includes("out of bounds")));
  ok(getPuzzleErrors({ ...valid, pearls: [valid.pearls[0], { ...valid.pearls[0] }] })
    .some((message) => message.includes("duplicate pearl")));
  ok(getPuzzleErrors({ ...valid, pearls: [{ x: 1, y: 1, type: "moon" }] })
    .some((message) => message.includes("malformed")));
  ok(getPuzzleErrors({ ...valid, pearls: [{ x: 0, y: 0, type: "white" }] })
    .some((message) => message.includes("no geometrically possible path")), "四角天珠无法直穿");
  ok(getPuzzleErrors({ ...valid, solution: ["1,1|0,1", "0,0|1,0", "0,0|0,1", "0,1|1,1"] })
    .some((message) => message.includes("malformed")));
  ok(getPuzzleErrors({
    ...valid,
    solution: ["4,4|5,4", "0,0|1,0", "0,0|0,1", "0,1|1,1"],
  }).some((message) => message.includes("out of bounds")));
  throws(() => assertValidPuzzle({ ...valid, height: 31 }), /Invalid puzzle/);
});

test("画线、排除标记与清空三态原子互斥", () => {
  const puzzle = makePuzzle({ id: "moves", width: 4, height: 4, pearls: [{ x: 1, y: 1, type: "white" }] });
  const edge = edgeKey([0, 0], [1, 0]);
  const initial = createState(puzzle);
  const lined = setEdgeState(puzzle, initial, edge, EDGE_STATES.LINE);
  strictEqual(lined.changed, true);
  strictEqual(lined.previous, EDGE_STATES.EMPTY);
  strictEqual(lined.state.lines.has(edge), true);
  strictEqual(lined.state.marks.has(edge), false);
  strictEqual(lined.state.moves, 1);
  strictEqual(initial.lines.size, 0, "画线不得改写输入状态");

  const marked = setEdgeState(puzzle, lined.state, edge, EDGE_STATES.MARK);
  strictEqual(marked.changed, true);
  strictEqual(marked.previous, EDGE_STATES.LINE);
  strictEqual(marked.state.lines.has(edge), false);
  strictEqual(marked.state.marks.has(edge), true);
  strictEqual(lined.state.lines.has(edge), true, "后续改动不得污染撤销快照");

  const relined = setEdgeState(puzzle, marked.state, edge, EDGE_STATES.LINE);
  strictEqual(relined.state.lines.has(edge), true);
  strictEqual(relined.state.marks.has(edge), false);
  const cleared = setEdgeState(puzzle, relined.state, edge, EDGE_STATES.EMPTY);
  strictEqual(cleared.state.lines.has(edge), false);
  strictEqual(cleared.state.marks.has(edge), false);

  const unchanged = setEdgeState(puzzle, cleared.state, edge, EDGE_STATES.EMPTY);
  strictEqual(unchanged.changed, false);
  strictEqual(unchanged.reason, "unchanged");
  strictEqual(unchanged.state, cleared.state);

  const toggledLine = toggleLine(puzzle, initial, edge);
  strictEqual(toggledLine.state.lines.has(edge), true);
  const toggledMark = toggleMark(puzzle, toggledLine.state, edge);
  strictEqual(toggledMark.state.lines.has(edge), false);
  strictEqual(toggledMark.state.marks.has(edge), true);

  const overlapping = cloneState(toggledMark.state);
  overlapping.lines.add(edge);
  strictEqual(validateState(puzzle, overlapping), false, "同边不得同时是线与标记");
  strictEqual(setEdgeState(puzzle, initial, [[0, 0], [1, 1]], EDGE_STATES.LINE).reason, "invalid-edge");
  strictEqual(setEdgeState(puzzle, initial, [[3, 3], [4, 3]], EDGE_STATES.LINE).reason, "out-of-bounds");
});

test("操作层拒绝第三条线，分析层仍能识别手造度数3分叉", () => {
  const puzzle = makePuzzle({ id: "degree", width: 5, height: 5, pearls: [{ x: 1, y: 1, type: "white" }] });
  const north = edgeKey([2, 2], [2, 1]);
  const south = edgeKey([2, 2], [2, 3]);
  const east = edgeKey([2, 2], [3, 2]);
  let state = createState(puzzle);
  state = setEdgeState(puzzle, state, north, EDGE_STATES.LINE).state;
  state = setEdgeState(puzzle, state, south, EDGE_STATES.LINE).state;
  const rejected = setEdgeState(puzzle, state, east, EDGE_STATES.LINE);
  strictEqual(rejected.changed, false);
  strictEqual(rejected.reason, "degree-limit");
  strictEqual(rejected.state, state);
  strictEqual(state.lines.size, 2);

  const rawDegreeThree = new Set([north, south, east]);
  const invalidSnapshot = cloneState(state);
  invalidSnapshot.lines.add(east);
  strictEqual(validateState(puzzle, invalidSnapshot), false);
  strictEqual(degreeAt(rawDegreeThree, { x: 2, y: 2 }), 3);
  strictEqual(lineShapeAt(rawDegreeThree, { x: 2, y: 2 }), "branch");
  const result = analyzeBoard(puzzle, rawDegreeThree);
  strictEqual(result.solved, false);
  ok(result.conflicts.some(({ type, key, reason }) => type === "degree" && key === "2,2" && reason === "degree"));
});

test("空盘与未闭合路径都不误判，且只报告已确定信息", () => {
  const puzzle = makePuzzle({
    id: "open-path",
    width: 3,
    height: 3,
    pearls: [{ x: 1, y: 0, type: "white" }],
  });
  const empty = analyzeBoard(puzzle, createState(puzzle));
  equal(
    {
      solved: empty.solved,
      complete: empty.complete,
      status: empty.status,
      lineCount: empty.lineCount,
      usedNodeCount: empty.usedNodeCount,
      components: empty.components,
      closedLoopCount: empty.closedLoopCount,
      openEnds: empty.openEnds,
      uncoveredPearls: empty.uncoveredPearls,
      conflicts: empty.conflicts,
      pearl: {
        degree: empty.pearls[0].degree,
        status: empty.pearls[0].status,
        reason: empty.pearls[0].reason,
      },
    },
    {
      solved: false,
      complete: false,
      status: "empty",
      lineCount: 0,
      usedNodeCount: 0,
      components: [],
      closedLoopCount: 0,
      openEnds: [],
      uncoveredPearls: ["1,0"],
      conflicts: [],
      pearl: {
        degree: 0,
        status: "pending",
        reason: "unvisited",
      },
    },
  );
  const open = lines([[0, 0], [1, 0]], [[1, 0], [2, 0]]);
  const result = analyzeBoard(puzzle, open);
  strictEqual(result.solved, false);
  strictEqual(result.status, "in-progress");
  strictEqual(result.closedLoopCount, 0);
  strictEqual(result.components.length, 1);
  equal(new Set(result.openEnds), new Set(["0,0", "2,0"]));
  strictEqual(result.pearls[0].status, "pending");
  strictEqual(result.conflicts.length, 0);
  strictEqual(traceLoop(puzzle, open), null);
});

test("唯一闭环经过并满足所有珠时才胜利", () => {
  const puzzle = makePuzzle({
    id: "one-loop",
    width: 3,
    height: 3,
    pearls: [{ x: 1, y: 0, type: "white" }],
  });
  const loop = rectangleLoop(0, 0, 2, 2);
  const result = analyzeBoard(puzzle, loop);
  strictEqual(result.solved, true);
  strictEqual(result.complete, true);
  strictEqual(result.status, "solved");
  strictEqual(result.closedLoopCount, 1);
  strictEqual(result.components.length, 1);
  strictEqual(result.openEnds.length, 0);
  strictEqual(result.conflicts.length, 0);
  strictEqual(result.pearls[0].status, "satisfied");
  strictEqual(isSolved(puzzle, loop), true);

  const traced = traceLoop(puzzle, loop, { x: 1, y: 0 });
  ok(traced);
  strictEqual(traced.length, loop.size);
  equal(traced[0], { x: 1, y: 0 });
  const tracedEdges = new Set(traced.map((point, index) => edgeKey(point, traced[(index + 1) % traced.length])));
  equal(tracedEdges, loop);
});

test("未经全部珠子的小环被标记为过早闭合", () => {
  const puzzle = makePuzzle({
    id: "premature",
    width: 5,
    height: 4,
    pearls: [{ x: 4, y: 2, type: "white" }],
  });
  const result = analyzeBoard(puzzle, rectangleLoop(0, 0, 1, 1));
  strictEqual(result.solved, false);
  strictEqual(result.closedLoopCount, 1);
  ok(conflictReasons(result).includes("premature-loop"));
  ok(result.uncoveredPearls.includes("4,2"));
});

test("两个小环永远不能冒充唯一龙脉", () => {
  const puzzle = makePuzzle({
    id: "two-loops",
    width: 5,
    height: 3,
    pearls: [{ x: 2, y: 2, type: "white" }],
  });
  const twoLoops = new Set([
    ...rectangleLoop(0, 0, 1, 1),
    ...rectangleLoop(3, 0, 4, 1),
  ]);
  const result = analyzeBoard(puzzle, twoLoops);
  strictEqual(result.solved, false);
  strictEqual(result.closedLoopCount, 2);
  strictEqual(result.components.length, 2);
  ok(conflictReasons(result).includes("multiple-loops"));
});

test("合法环外任何多余线段也会阻止胜利", () => {
  const puzzle = makePuzzle({
    id: "extra-segment",
    width: 5,
    height: 4,
    pearls: [{ x: 1, y: 0, type: "white" }],
  });
  const loop = rectangleLoop(0, 0, 2, 2);
  const withExtra = new Set([...loop, edgeKey([3, 3], [4, 3])]);
  const result = analyzeBoard(puzzle, withExtra);
  strictEqual(analyzeBoard(puzzle, loop).solved, true, "基准环必须本来就合法");
  strictEqual(result.solved, false);
  strictEqual(result.closedLoopCount, 1);
  strictEqual(result.components.length, 2);
  ok(conflictReasons(result).includes("premature-loop"));
  equal(new Set(result.openEnds), new Set(["3,3", "4,3"]));
});

test("地珠正例：珠上转弯且两侧邻格延续直行", () => {
  const pearl = { x: 2, y: 2, type: "black" };
  const puzzle = makePuzzle({ id: "black-positive", pearls: [pearl] });
  const complete = lines(
    [[2, 2], [3, 2]], [[3, 2], [4, 2]],
    [[2, 2], [2, 3]], [[2, 3], [2, 4]],
  );
  const result = evaluatePearl(puzzle, complete, pearl);
  strictEqual(result.status, "satisfied");
  strictEqual(result.reason, null);
  strictEqual(lineShapeAt(complete, pearl), "turn");

  const directionPairs = [
    [[0, -1], [1, 0]],
    [[1, 0], [0, 1]],
    [[0, 1], [-1, 0]],
    [[-1, 0], [0, -1]],
  ];
  for (const pair of directionPairs) {
    const edges = [];
    for (const [dx, dy] of pair) {
      const near = [pearl.x + dx, pearl.y + dy];
      const far = [pearl.x + 2 * dx, pearl.y + 2 * dy];
      edges.push([[pearl.x, pearl.y], near], [near, far]);
    }
    strictEqual(evaluatePearl(puzzle, lines(...edges), pearl).status, "satisfied", `地珠转向 ${JSON.stringify(pair)} 应合法`);
  }

  const withUnconnectedTurn = new Set([
    ...complete,
    edgeKey([2, 1], [2, 0]),
    edgeKey([2, 1], [1, 1]),
  ]);
  strictEqual(
    evaluatePearl(puzzle, withUnconnectedTurn, pearl).status,
    "satisfied",
    "未与地珠连线的相邻拐角不得干扰 pathNbrs 判定",
  );

  const incomplete = lines([[2, 2], [3, 2]], [[2, 2], [2, 3]]);
  equal(
    { status: evaluatePearl(puzzle, incomplete, pearl).status, reason: evaluatePearl(puzzle, incomplete, pearl).reason },
    { status: "pending", reason: "black-needs-straight-neighbors" },
  );
  strictEqual(evaluatePearl(puzzle, new Set(), pearl).status, "pending");
});

test("地珠反例：珠上直行或紧邻转弯都精确冲突", () => {
  const pearl = { x: 2, y: 2, type: "black" };
  const puzzle = makePuzzle({ id: "black-negative", pearls: [pearl] });
  const straight = lines(
    [[2, 2], [1, 2]], [[1, 2], [0, 2]],
    [[2, 2], [3, 2]], [[3, 2], [4, 2]],
  );
  equal(
    { status: evaluatePearl(puzzle, straight, pearl).status, reason: evaluatePearl(puzzle, straight, pearl).reason },
    { status: "conflict", reason: "black-must-turn" },
  );

  const adjacentTurn = lines(
    [[2, 2], [3, 2]], [[3, 2], [3, 1]],
    [[2, 2], [2, 3]], [[2, 3], [2, 4]],
  );
  equal(
    { status: evaluatePearl(puzzle, adjacentTurn, pearl).status, reason: evaluatePearl(puzzle, adjacentTurn, pearl).reason },
    { status: "conflict", reason: "black-continuation" },
  );

  const oneArm = lines([[2, 2], [3, 2]]);
  equal(
    { status: evaluatePearl(puzzle, oneArm, pearl).status, reason: evaluatePearl(puzzle, oneArm, pearl).reason },
    { status: "pending", reason: "incomplete" },
  );

  const oneArmAlreadyTurns = lines([[2, 2], [3, 2]], [[3, 2], [3, 1]]);
  equal(
    {
      status: evaluatePearl(puzzle, oneArmAlreadyTurns, pearl).status,
      reason: evaluatePearl(puzzle, oneArmAlreadyTurns, pearl).reason,
    },
    { status: "conflict", reason: "black-continuation" },
    "地珠即使尚只画一臂，已确定的邻格拐角也应立即冲突",
  );
});

test("地珠边界：向内转弯可成立，向边外无法延直立即冲突", () => {
  const corner = { x: 0, y: 0, type: "black" };
  const cornerPuzzle = makePuzzle({ id: "black-corner-ok", width: 3, height: 3, pearls: [corner] });
  const inward = lines(
    [[0, 0], [1, 0]], [[1, 0], [2, 0]],
    [[0, 0], [0, 1]], [[0, 1], [0, 2]],
  );
  strictEqual(evaluatePearl(cornerPuzzle, inward, corner).status, "satisfied");

  const edgePearl = { x: 0, y: 1, type: "black" };
  const edgePuzzle = makePuzzle({ id: "black-edge-bad", width: 3, height: 3, pearls: [edgePearl] });
  const towardBoundary = lines([[0, 1], [0, 0]]);
  equal(
    { status: evaluatePearl(edgePuzzle, towardBoundary, edgePearl).status, reason: evaluatePearl(edgePuzzle, towardBoundary, edgePearl).reason },
    { status: "conflict", reason: "black-continuation" },
  );
});

test("天珠正例：珠上直穿，珠前或珠后任一紧邻处转弯", () => {
  const pearl = { x: 2, y: 2, type: "white" };
  const puzzle = makePuzzle({ id: "white-positive", pearls: [pearl] });
  const turnBefore = lines(
    [[1, 2], [2, 2]], [[2, 2], [3, 2]], [[1, 2], [1, 1]],
  );
  strictEqual(evaluatePearl(puzzle, turnBefore, pearl).status, "satisfied");

  const turnAfter = lines(
    [[1, 2], [2, 2]], [[2, 2], [3, 2]], [[3, 2], [3, 3]],
  );
  strictEqual(evaluatePearl(puzzle, turnAfter, pearl).status, "satisfied");

  const vertical = lines(
    [[2, 1], [2, 2]], [[2, 2], [2, 3]], [[2, 1], [1, 1]],
  );
  strictEqual(evaluatePearl(puzzle, vertical, pearl).status, "satisfied", "天珠竖向直穿也必须支持");

  const bothSidesTurn = lines(
    [[1, 2], [2, 2]], [[2, 2], [3, 2]],
    [[1, 2], [1, 1]], [[3, 2], [3, 3]],
  );
  strictEqual(evaluatePearl(puzzle, bothSidesTurn, pearl).status, "satisfied", "两侧都转弯合法，不是恰好一侧");

  const waiting = lines([[1, 2], [2, 2]], [[2, 2], [3, 2]]);
  equal(
    { status: evaluatePearl(puzzle, waiting, pearl).status, reason: evaluatePearl(puzzle, waiting, pearl).reason },
    { status: "pending", reason: "white-needs-adjacent-turn" },
  );
});

test("天珠反例：珠上转弯或珠前珠后都直行会精确冲突", () => {
  const pearl = { x: 2, y: 2, type: "white" };
  const puzzle = makePuzzle({ id: "white-negative", pearls: [pearl] });
  const turnsOnPearl = lines([[2, 2], [3, 2]], [[2, 2], [2, 3]]);
  equal(
    { status: evaluatePearl(puzzle, turnsOnPearl, pearl).status, reason: evaluatePearl(puzzle, turnsOnPearl, pearl).reason },
    { status: "conflict", reason: "white-must-straight" },
  );

  const tooStraight = lines(
    [[0, 2], [1, 2]], [[1, 2], [2, 2]],
    [[2, 2], [3, 2]], [[3, 2], [4, 2]],
  );
  equal(
    { status: evaluatePearl(puzzle, tooStraight, pearl).status, reason: evaluatePearl(puzzle, tooStraight, pearl).reason },
    { status: "conflict", reason: "white-needs-adjacent-turn" },
  );

  const verticalTooStraight = lines(
    [[2, 0], [2, 1]], [[2, 1], [2, 2]],
    [[2, 2], [2, 3]], [[2, 3], [2, 4]],
  );
  equal(
    {
      status: evaluatePearl(puzzle, verticalTooStraight, pearl).status,
      reason: evaluatePearl(puzzle, verticalTooStraight, pearl).reason,
    },
    { status: "conflict", reason: "white-needs-adjacent-turn" },
  );

  const nonPathTurnCannotHelp = new Set([
    ...tooStraight,
    edgeKey([2, 1], [2, 0]),
    edgeKey([2, 1], [1, 1]),
  ]);
  equal(
    {
      status: evaluatePearl(puzzle, nonPathTurnCannotHelp, pearl).status,
      reason: evaluatePearl(puzzle, nonPathTurnCannotHelp, pearl).reason,
    },
    { status: "conflict", reason: "white-needs-adjacent-turn" },
    "天珠只检查路径前后邻格，不连线方向的拐角不能满足规则",
  );
});

test("天珠边界：沿边直穿可成立，朝边外续直则不可能", () => {
  const topPearl = { x: 1, y: 0, type: "white" };
  const topPuzzle = makePuzzle({ id: "white-edge-ok", width: 3, height: 3, pearls: [topPearl] });
  const alongEdge = lines(
    [[0, 0], [1, 0]], [[1, 0], [2, 0]], [[0, 0], [0, 1]],
  );
  strictEqual(evaluatePearl(topPuzzle, alongEdge, topPearl).status, "satisfied");

  const leftPearl = { x: 0, y: 1, type: "white" };
  const leftPuzzle = makePuzzle({ id: "white-edge-bad", width: 3, height: 3, pearls: [leftPearl] });
  const downTheEdge = lines(
    [[0, 0], [0, 1]], [[0, 1], [0, 2]], [[0, 0], [1, 0]],
  );
  strictEqual(evaluatePearl(leftPuzzle, downTheEdge, leftPearl).status, "satisfied", "左边界天珠可竖向直穿");
  const inwardArm = lines([[0, 1], [1, 1]]);
  equal(
    { status: evaluatePearl(leftPuzzle, inwardArm, leftPearl).status, reason: evaluatePearl(leftPuzzle, inwardArm, leftPearl).reason },
    { status: "conflict", reason: "white-must-straight" },
  );
});

test("存档序列化稳定，恢复严格，状态可安全用于撤销快照", () => {
  const puzzle = makePuzzle({ id: "save", width: 4, height: 4, pearls: [{ x: 1, y: 1, type: "white" }] });
  const first = edgeKey([0, 0], [1, 0]);
  const second = edgeKey([2, 2], [2, 3]);
  const initial = createState(puzzle);
  const afterLine = setEdgeState(puzzle, initial, first, EDGE_STATES.LINE).state;
  const afterMark = setEdgeState(puzzle, afterLine, second, EDGE_STATES.MARK).state;

  strictEqual(initial.moves, 0);
  strictEqual(initial.lines.size, 0);
  strictEqual(afterLine.moves, 1);
  strictEqual(afterLine.lines.has(first), true);
  strictEqual(afterLine.marks.size, 0, "旧快照不得被下一步改写");
  strictEqual(afterMark.moves, 2);

  const serialized = serializeState(afterMark);
  strictEqual(serialized, serializeState(afterMark), "同一状态必须稳定序列化");
  const restored = deserializeState(serialized, puzzle);
  ok(restored);
  equal(restored, afterMark);
  ok(restored.lines !== afterMark.lines);
  ok(restored.marks !== afterMark.marks);

  const cloned = cloneState(afterMark);
  cloned.lines.delete(first);
  strictEqual(afterMark.lines.has(first), true, "cloneState 的 Set 必须深拷贝");
  strictEqual(deserializeState("{broken", puzzle), null);
  strictEqual(deserializeState(JSON.stringify({ ...JSON.parse(serialized), version: 2 }), puzzle), null);
  strictEqual(deserializeState(JSON.stringify({
    ...JSON.parse(serialized), lines: [first, first],
  }), puzzle), null);
  strictEqual(deserializeState(JSON.stringify({
    ...JSON.parse(serialized), marks: [first],
  }), puzzle), null, "线与标记重叠的存档必须拒绝");

  const stringCursor = normalizeBoardPoint(puzzle, { x: "1", y: "1" });
  equal(stringCursor, { x: 1, y: 1 }, "旧存档中的整数坐标字符串应归一化为数字");
  strictEqual(typeof stringCursor.x, "number");
  strictEqual(typeof stringCursor.y, "number");
  equal(
    stepBoardPoint(puzzle, stringCursor, { x: 1, y: 0 }),
    { x: 2, y: 1 },
    "归一化游标的后续键盘移动必须做数值加法",
  );
  equal(
    stepBoardPoint(puzzle, { x: "1", y: "1" }, { x: 0, y: 1 }),
    { x: 1, y: 2 },
    "键盘移动本身也应防御字符串游标",
  );
  strictEqual(normalizeBoardPoint(puzzle, { x: 1.5, y: 1 }), null, "非整数坐标必须拒绝");
  strictEqual(normalizeBoardPoint(puzzle, { x: "1.5", y: "1" }), null, "非整数字符串必须拒绝");
  strictEqual(
    normalizeBoardPoint(puzzle, { x: Number.MAX_SAFE_INTEGER + 1, y: 1 }),
    null,
    "非安全整数坐标必须拒绝",
  );
  strictEqual(normalizeBoardPoint(puzzle, { x: 4, y: 1 }), null, "越界坐标必须拒绝");
  strictEqual(stepBoardPoint(puzzle, { x: 3, y: 1 }, { x: 1, y: 0 }), null, "键盘不得越过边界");
});

test("三档九关的内置解都是完整单环且经过所有珠", () => {
  strictEqual(LEVELS.length, 9);
  equal(DIFFICULTIES, ["easy", "medium", "hard"]);
  strictEqual(new Set(LEVELS.map(({ id }) => id)).size, 9);
  for (const difficulty of DIFFICULTIES) {
    strictEqual(getLevels(difficulty).length, 3, `${difficulty} 应恰有三关`);
  }

  for (const level of LEVELS) {
    strictEqual(getLevel(level.id), level);
    strictEqual(validatePuzzle(level), true, `${level.id} 题面定义必须合法`);
    strictEqual(new Set(level.solution).size, level.solution.length, `${level.id} 解不得含重边`);
    ok(level.solution.length >= 4, `${level.id} 解环不得是占位数据`);
    ok(Object.isFrozen(level));
    ok(Object.isFrozen(level.pearls));
    ok(Object.isFrozen(level.solution));

    for (const key of level.solution) {
      const { a, b } = parseEdgeKey(key);
      ok(inBounds(level, a) && inBounds(level, b), `${level.id} 解边 ${key} 越界`);
    }
    const solvedState = createState(level, { lines: level.solution });
    strictEqual(validateState(level, solvedState), true);
    const result = analyzeBoard(level, solvedState);
    strictEqual(result.solved, true, `${level.id} 存储解必须胜利`);
    strictEqual(result.closedLoopCount, 1);
    strictEqual(result.components.length, 1);
    strictEqual(result.conflicts.length, 0);
    strictEqual(result.pearls.length, level.pearls.length);
    ok(result.pearls.every(({ status }) => status === "satisfied"));
    const traced = traceLoop(level, solvedState);
    ok(traced, `${level.id} 必须可追踪为单环`);
    strictEqual(traced.length, level.solution.length);
    const tracedEdges = new Set(traced.map((point, index) => edgeKey(point, traced[(index + 1) % traced.length])));
    equal(tracedEdges, new Set(level.solution));
    verifiedSolutions += 1;
  }
  strictEqual(verifiedSolutions, 9);
});

test("排除标记只是笔记，不影响已完成单环的胜利判定", () => {
  const level = LEVELS[0];
  const solution = new Set(level.solution);
  const unused = allEdgeKeys(level).find((key) => !solution.has(key));
  ok(unused);
  const state = createState(level, { lines: solution, marks: [unused], moves: 17 });
  strictEqual(analyzeBoard(level, state).solved, true);
});

test("求解器不读存储答案，九关都在上限2内只找到1解", () => {
  for (const level of LEVELS) {
    const solutionCount = countSolutions(level, 2);
    strictEqual(solutionCount, 1, `${level.id} 必须恰好一解`);
    verifiedUnique += 1;
  }
  strictEqual(verifiedUnique, 9);
});

process.stdout.write(
  `Spirit Dragon logic: ${testsRun} tests, ${assertions} assertions passed; `
  + `${verifiedSolutions}/9 stored solutions valid; ${verifiedUnique}/9 levels uniquely solvable.\n`,
);
