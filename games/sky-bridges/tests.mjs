import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DIFFICULTIES,
  HISTORY_LIMIT,
  LEVELS,
  MAX_BRIDGES,
  applyMove,
  applySessionMove,
  connectedComponents,
  createPuzzle,
  createSession,
  edgeBetween,
  edgesCross,
  evaluatePosition,
  findLevel,
  levelsForDifficulty,
  normalizePosition,
  positionToJSON,
  restartSession,
  restoreSession,
  sessionToJSON,
  solvePuzzle,
  undoSession,
} from "./logic.mjs";
import { shouldRestoreDifficultyFocus } from "./ui-helpers.mjs";

const tests = [];
let assertions = 0;

function test(name, callback) {
  tests.push({ name, callback });
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function throws(callback, expected, message) {
  assertions += 1;
  assert.throws(callback, expected, message);
}

function puzzle(definition) {
  return createPuzzle({ id: "test", title: "test", difficulty: "clear", ...definition });
}

function bridgeMap(...entries) {
  return new Map(entries);
}

function solvedPosition(targetPuzzle) {
  const result = solvePuzzle(targetPuzzle, { limit: 2 });
  equal(result.count, 1, `${targetPuzzle.id} should have one solution`);
  return { bridges: result.solutions[0] };
}

test("constants use the classic two-route limit and three real difficulties", () => {
  equal(MAX_BRIDGES, 2);
  deepEqual(DIFFICULTIES.map(({ id }) => id), ["clear", "mist", "storm"]);
  equal(LEVELS.length, 6);
});

test("puzzle parser rejects malformed definitions", () => {
  throws(() => createPuzzle(), TypeError);
  throws(() => puzzle({ islands: [{ row: 0, column: 0, target: 1 }] }), TypeError);
  throws(() => puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "a", row: 0, column: 2, target: 1 },
  ] }), TypeError);
  throws(() => puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 0, target: 1 },
  ] }), TypeError);
  throws(() => puzzle({ islands: [
    { id: "a", row: -1, column: 0, target: 1 },
    { id: "b", row: 0, column: 1, target: 1 },
  ] }), TypeError);
  throws(() => puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 3 },
    { id: "b", row: 0, column: 1, target: 1 },
  ] }), TypeError, "a single neighbour can supply at most two routes");
});

test("candidate edges stop at the first visible port in every direction", () => {
  const line = puzzle({ width: 6, height: 4, islands: [
    { id: "a", row: 1, column: 0, target: 1 },
    { id: "b", row: 1, column: 2, target: 2 },
    { id: "c", row: 1, column: 5, target: 1 },
    { id: "d", row: 3, column: 2, target: 1 },
  ] });
  ok(edgeBetween(line, "a", "b"));
  ok(edgeBetween(line, "b", "c"));
  ok(edgeBetween(line, "b", "d"));
  equal(edgeBetween(line, "a", "c"), null, "a-c may not jump over b");
  equal(edgeBetween(line, "a", "d"), null, "diagonal ports are never candidates");
  equal(line.edges.length, 3);
});

test("edge lookup is canonical and open cells never contain an intermediate port", () => {
  const line = puzzle({ islands: [
    { id: "left", row: 0, column: 0, target: 1 },
    { id: "right", row: 0, column: 3, target: 1 },
  ] });
  const forward = edgeBetween(line, "left", "right");
  const backward = edgeBetween(line, "right", "left");
  equal(forward.id, backward.id);
  deepEqual(forward.cells, [{ row: 0, column: 1 }, { row: 0, column: 2 }]);
  equal(forward.orientation, "horizontal");
});

test("crossing is strict interior-only and shared endpoints are legal", () => {
  const cross = puzzle({ width: 5, height: 5, islands: [
    { id: "l", row: 2, column: 0, target: 1 },
    { id: "r", row: 2, column: 4, target: 1 },
    { id: "t", row: 0, column: 2, target: 1 },
    { id: "b", row: 4, column: 2, target: 1 },
  ] });
  ok(edgesCross(edgeBetween(cross, "l", "r"), edgeBetween(cross, "t", "b")));

  const elbow = puzzle({ width: 3, height: 3, islands: [
    { id: "corner", row: 0, column: 0, target: 2 },
    { id: "right", row: 0, column: 2, target: 1 },
    { id: "down", row: 2, column: 0, target: 1 },
  ] });
  equal(edgesCross(edgeBetween(elbow, "corner", "right"), edgeBetween(elbow, "corner", "down")), false);
  equal(edgesCross(elbow.edges[0], elbow.edges[0]), false);
});

test("normalization keeps only legal counts and makes real routes win over notes", () => {
  const two = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 2, target: 1 },
  ] });
  const edgeId = two.edges[0].id;
  const normalized = normalizePosition(two, {
    bridges: [[edgeId, 2], ["missing", 1], [edgeId, 3]],
    marks: [edgeId, "missing"],
    checked: ["a", "missing"],
  });
  deepEqual([...normalized.bridges], [[edgeId, 2]]);
  deepEqual([...normalized.marks], []);
  deepEqual([...normalized.checked], ["a"]);
});

test("forward interaction cycles 0 to 1 to 2 to 0", () => {
  const two = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 2, target: 1 },
  ] });
  const edgeId = two.edges[0].id;
  let position = {};
  for (const expected of [1, 2, 0]) {
    const move = applyMove(two, position, { type: "cycle-bridge", edgeId });
    ok(move.accepted);
    equal(move.count, expected);
    position = move;
  }
  equal(position.bridges.size, 0);
});

test("reverse interaction cycles 0 to 2 to 1 to 0", () => {
  const two = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 2, target: 1 },
  ] });
  const edgeId = two.edges[0].id;
  let position = {};
  for (const expected of [2, 1, 0]) {
    const move = applyMove(two, position, { type: "cycle-bridge", edgeId, direction: -1 });
    ok(move.accepted);
    equal(move.count, expected);
    position = move;
  }
});

test("a real route blocks a geometric crossing atomically", () => {
  const cross = puzzle({ width: 5, height: 5, islands: [
    { id: "l", row: 2, column: 0, target: 1 },
    { id: "r", row: 2, column: 4, target: 1 },
    { id: "t", row: 0, column: 2, target: 1 },
    { id: "b", row: 4, column: 2, target: 1 },
  ] });
  const horizontal = edgeBetween(cross, "l", "r").id;
  const vertical = edgeBetween(cross, "t", "b").id;
  const first = applyMove(cross, {}, { type: "cycle-bridge", edgeId: horizontal });
  const rejected = applyMove(cross, first, { type: "cycle-bridge", edgeId: vertical });
  equal(rejected.accepted, false);
  equal(rejected.reason, "crossing");
  equal(rejected.blockingEdgeId, horizontal);
  deepEqual([...rejected.bridges], [[horizontal, 1]]);

  const cleared = applyMove(cross, first, { type: "cycle-bridge", edgeId: horizontal, direction: -1 });
  equal(cleared.bridges.size, 0, "reverse from one clears the route");
  ok(applyMove(cross, cleared, { type: "cycle-bridge", edgeId: vertical }).accepted);
});

test("non-route notes do not block crossing routes and stay mutually exclusive on one edge", () => {
  const cross = puzzle({ width: 5, height: 5, islands: [
    { id: "l", row: 2, column: 0, target: 1 },
    { id: "r", row: 2, column: 4, target: 1 },
    { id: "t", row: 0, column: 2, target: 1 },
    { id: "b", row: 4, column: 2, target: 1 },
  ] });
  const horizontal = edgeBetween(cross, "l", "r").id;
  const vertical = edgeBetween(cross, "t", "b").id;
  const marked = applyMove(cross, {}, { type: "toggle-mark", edgeId: horizontal });
  ok(marked.accepted);
  ok(applyMove(cross, marked, { type: "cycle-bridge", edgeId: vertical }).accepted);
  const rejected = applyMove(cross, marked, { type: "cycle-bridge", edgeId: horizontal });
  equal(rejected.accepted, false);
  equal(rejected.reason, "marked");
  equal(evaluatePosition(cross, marked).bridgeUnits, 0);
});

test("double routes contribute two to both endpoint degrees", () => {
  const two = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 2 },
    { id: "b", row: 0, column: 2, target: 2 },
  ] });
  const result = evaluatePosition(two, { bridges: bridgeMap([two.edges[0].id, 2]) });
  equal(result.degrees.get("a"), 2);
  equal(result.degrees.get("b"), 2);
  equal(result.bridgeUnits, 2);
  equal(result.complete, true);
});

test("underfilled and overfilled ports can never win", () => {
  const two = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 2, target: 1 },
  ] });
  const under = evaluatePosition(two);
  equal(under.ports.get("a").under, true);
  equal(under.complete, false);
  const over = evaluatePosition(two, { bridges: bridgeMap([two.edges[0].id, 2]) });
  equal(over.ports.get("a").over, true);
  equal(over.complete, false);
});

test("checked-port markers require an exact port and clear after an incident edit", () => {
  const two = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 2, target: 1 },
  ] });
  const edgeId = two.edges[0].id;
  const premature = applyMove(two, {}, { type: "toggle-checked", islandId: "a" });
  equal(premature.accepted, false);
  equal(premature.reason, "not-exact");
  const routed = applyMove(two, {}, { type: "cycle-bridge", edgeId });
  const checked = applyMove(two, routed, { type: "toggle-checked", islandId: "a" });
  ok(checked.checked.has("a"));
  const edited = applyMove(two, checked, { type: "cycle-bridge", edgeId });
  equal(edited.checked.has("a"), false);
});

test("all exact degrees still fail when the network has two saturated components", () => {
  const rectangle = puzzle({ width: 5, height: 5, islands: [
    { id: "tl", row: 0, column: 0, target: 2 },
    { id: "tr", row: 0, column: 4, target: 2 },
    { id: "bl", row: 4, column: 0, target: 2 },
    { id: "br", row: 4, column: 4, target: 2 },
  ] });
  const result = evaluatePosition(rectangle, { bridges: bridgeMap(
    [edgeBetween(rectangle, "tl", "tr").id, 2],
    [edgeBetween(rectangle, "bl", "br").id, 2],
  ) });
  equal(result.exactPorts, 4);
  equal(result.connected, false);
  equal(result.components.length, 2);
  equal(result.complete, false);
});

test("classic mode explicitly accepts a connected four-port cycle", () => {
  const rectangle = puzzle({ width: 5, height: 5, islands: [
    { id: "tl", row: 0, column: 0, target: 2 },
    { id: "tr", row: 0, column: 4, target: 2 },
    { id: "bl", row: 4, column: 0, target: 2 },
    { id: "br", row: 4, column: 4, target: 2 },
  ] });
  const ring = new Map(rectangle.edges.map(({ id }) => [id, 1]));
  const result = evaluatePosition(rectangle, { bridges: ring });
  equal(result.bridgeUnits, 4);
  equal(result.connected, true);
  equal(result.complete, true, "cycles are legal in the classic rules");
});

test("crossed injected data is detected even though normal moves prevent it", () => {
  const cross = puzzle({ width: 5, height: 5, islands: [
    { id: "l", row: 2, column: 0, target: 1 },
    { id: "r", row: 2, column: 4, target: 1 },
    { id: "t", row: 0, column: 2, target: 1 },
    { id: "b", row: 4, column: 2, target: 1 },
  ] });
  const result = evaluatePosition(cross, { bridges: bridgeMap(
    [edgeBetween(cross, "l", "r").id, 1],
    [edgeBetween(cross, "t", "b").id, 1],
  ) });
  equal(result.crossings.size, 2);
  equal(result.complete, false);
});

test("victory follows rules rather than an embedded answer", () => {
  const fresh = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 1, target: 1 },
  ] });
  equal("solution" in fresh, false);
  const result = evaluatePosition(fresh, { bridges: bridgeMap([fresh.edges[0].id, 1]) });
  equal(result.complete, true);
});

test("auxiliary notes never add degree, connectivity, or a victory dependency", () => {
  const level = LEVELS[2];
  const solved = solvedPosition(level);
  const unused = level.edges.find(({ id }) => !solved.bridges.has(id));
  ok(unused, "fixture should have an unused candidate edge");
  const withNotes = {
    ...solved,
    marks: new Set([unused.id]),
    checked: new Set(level.islands.map(({ id }) => id)),
  };
  const result = evaluatePosition(level, withNotes);
  equal(result.complete, true);
  equal(result.bridgeUnits, evaluatePosition(level, solved).bridgeUnits);
});

test("component search treats a double route as one adjacency", () => {
  const line = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 2 },
    { id: "b", row: 0, column: 2, target: 4 },
    { id: "c", row: 0, column: 4, target: 2 },
  ] });
  const position = { bridges: bridgeMap(
    [edgeBetween(line, "a", "b").id, 2],
    [edgeBetween(line, "b", "c").id, 2],
  ) };
  equal(connectedComponents(line, position).length, 1);
  equal(evaluatePosition(line, position).complete, true);
});

test("session undo restores routes, notes, checked ports, and move count", () => {
  const two = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 2, target: 1 },
  ] });
  const edgeId = two.edges[0].id;
  let session = createSession(two);
  session = applySessionMove(two, session, { type: "toggle-mark", edgeId }).session;
  equal(session.moves, 1);
  equal(session.position.marks.has(edgeId), true);
  let undone = undoSession(two, session);
  ok(undone.accepted);
  equal(undone.session.moves, 0);
  equal(undone.session.position.marks.size, 0);

  session = applySessionMove(two, undone.session, { type: "cycle-bridge", edgeId }).session;
  session = applySessionMove(two, session, { type: "toggle-checked", islandId: "a" }).session;
  equal(session.moves, 2);
  equal(session.position.bridges.get(edgeId), 1);
  equal(session.position.checked.has("a"), true);

  undone = undoSession(two, session);
  equal(undone.session.moves, 1);
  equal(undone.session.position.bridges.get(edgeId), 1);
  equal(undone.session.position.checked.size, 0);
  undone = undoSession(two, undone.session);
  equal(undone.session.moves, 0);
  equal(undone.session.position.bridges.size, 0);
  equal(undoSession(two, undone.session).accepted, false);
});

test("undo history stays bounded while preserving the latest reversible states", () => {
  const two = puzzle({ islands: [
    { id: "a", row: 0, column: 0, target: 1 },
    { id: "b", row: 0, column: 2, target: 1 },
  ] });
  const edgeId = two.edges[0].id;
  let session = createSession(two);
  for (let index = 0; index < HISTORY_LIMIT + 7; index += 1) {
    session = applySessionMove(two, session, { type: "toggle-mark", edgeId }).session;
  }
  equal(session.moves, HISTORY_LIMIT + 7);
  equal(session.history.length, HISTORY_LIMIT);
  for (let index = 0; index < HISTORY_LIMIT; index += 1) session = undoSession(two, session).session;
  equal(session.moves, 7);
  equal(session.history.length, 0);
  equal(undoSession(two, session).accepted, false);
});

test("rejected crossings never enter session history", () => {
  const cross = puzzle({ width: 5, height: 5, islands: [
    { id: "l", row: 2, column: 0, target: 1 },
    { id: "r", row: 2, column: 4, target: 1 },
    { id: "t", row: 0, column: 2, target: 1 },
    { id: "b", row: 4, column: 2, target: 1 },
  ] });
  let session = createSession(cross);
  session = applySessionMove(cross, session, {
    type: "cycle-bridge",
    edgeId: edgeBetween(cross, "l", "r").id,
  }).session;
  const rejected = applySessionMove(cross, session, {
    type: "cycle-bridge",
    edgeId: edgeBetween(cross, "t", "b").id,
  });
  equal(rejected.accepted, false);
  equal(rejected.session.moves, 1);
  equal(rejected.session.history.length, 1);
});

test("restart clears the entire gameplay position", () => {
  const level = LEVELS[0];
  let session = createSession(level);
  session = applySessionMove(level, session, {
    type: "cycle-bridge",
    edgeId: level.edges[0].id,
  }).session;
  const restarted = restartSession(level);
  equal(restarted.moves, 0);
  equal(restarted.history.length, 0);
  equal(restarted.position.bridges.size, 0);
  equal(restarted.position.marks.size, 0);
  equal(restarted.position.checked.size, 0);
});

test("session save and restore are deterministic and strict", () => {
  const level = LEVELS[0];
  let session = createSession(level);
  const solution = solvePuzzle(level, { limit: 2 }).solutions[0];
  for (const [edgeId, count] of solution) {
    for (let index = 0; index < count; index += 1) {
      session = applySessionMove(level, session, { type: "cycle-bridge", edgeId }).session;
    }
  }
  const unused = level.edges.find(({ id }) => !solution.has(id));
  ok(unused);
  session = applySessionMove(level, session, { type: "toggle-mark", edgeId: unused.id }).session;
  session = applySessionMove(level, session, { type: "toggle-checked", islandId: "p0" }).session;
  const json = sessionToJSON(level, session);
  const restored = restoreSession(level, JSON.parse(JSON.stringify(json)));
  deepEqual(sessionToJSON(level, restored), json);
  equal(restored.position.marks.has(unused.id), true);
  equal(restored.position.checked.has("p0"), true);
  const unchecked = undoSession(level, restored).session;
  equal(unchecked.position.checked.size, 0);
  equal(unchecked.position.marks.has(unused.id), true);
  const unmarked = undoSession(level, unchecked).session;
  equal(unmarked.position.marks.size, 0);
  equal(evaluatePosition(level, unmarked.position).complete, true);
  throws(() => restoreSession(level, { ...json, puzzleId: "other" }), TypeError);
  throws(() => restoreSession(level, {
    ...json,
    position: { ...json.position, bridges: [["missing", 1]] },
  }), TypeError);
  throws(() => restoreSession(level, { ...json, history: Array(HISTORY_LIMIT + 1).fill(json.position) }), TypeError);
  throws(() => restoreSession(level, { ...json, moves: Number.MAX_SAFE_INTEGER + 1 }), TypeError);
  const sparseMarks = [];
  sparseMarks.length = 1;
  throws(() => restoreSession(level, {
    ...json,
    position: { ...json.position, marks: sparseMarks },
  }), TypeError);
});

test("session creation rejects states that could not survive strict restoration", () => {
  const cross = puzzle({ width: 5, height: 5, islands: [
    { id: "l", row: 2, column: 0, target: 1 },
    { id: "r", row: 2, column: 4, target: 1 },
    { id: "t", row: 0, column: 2, target: 1 },
    { id: "b", row: 4, column: 2, target: 1 },
  ] });
  throws(() => createSession(cross, { bridges: bridgeMap(
    [edgeBetween(cross, "l", "r").id, 1],
    [edgeBetween(cross, "t", "b").id, 1],
  ) }), TypeError);
  throws(() => createSession(cross, { checked: new Set(["l"]) }), TypeError);
});

test("position JSON is stable regardless of map and set insertion order", () => {
  deepEqual(positionToJSON({
    bridges: new Map([["z", 1], ["a", 2]]),
    marks: new Set(["z", "a"]),
    checked: new Set(["p2", "p0"]),
  }), {
    bridges: [["a", 2], ["z", 1]],
    marks: ["a", "z"],
    checked: ["p0", "p2"],
  });
});

test("invalid targets and unknown actions never mutate a position", () => {
  const level = LEVELS[0];
  const original = { bridges: bridgeMap([level.edges[0].id, 1]) };
  const invalid = applyMove(level, original, { type: "cycle-bridge", edgeId: "missing" });
  equal(invalid.accepted, false);
  equal(invalid.reason, "not-a-candidate");
  deepEqual([...invalid.bridges], [...original.bridges]);
  equal(applyMove(level, original, { type: "invent-route" }).reason, "unknown-move");
});

test("all built-in candidate edges are exactly nearest visible orthogonal neighbours", () => {
  for (const level of LEVELS) {
    const coordinates = new Map(level.islands.map((island) => [
      `${island.row}:${island.column}`,
      island.id,
    ]));
    const actual = new Set(level.edges.map(({ id }) => id));
    const expectedPairs = new Set();
    for (const island of level.islands) {
      for (const [rowStep, columnStep] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        let row = island.row + rowStep;
        let column = island.column + columnStep;
        while (row >= 0 && column >= 0 && row < level.height && column < level.width) {
          const hit = coordinates.get(`${row}:${column}`);
          if (hit) {
            expectedPairs.add(edgeBetween(level, island.id, hit).id);
            break;
          }
          row += rowStep;
          column += columnStep;
        }
      }
    }
    deepEqual(actual, expectedPairs, `${level.id} candidate set`);
    for (const edge of level.edges) {
      const a = level.islands[edge.aIndex];
      const b = level.islands[edge.bIndex];
      ok(a.row === b.row || a.column === b.column, `${level.id}:${edge.id} is orthogonal`);
      equal(edge.cells.some(({ row, column }) => coordinates.has(`${row}:${column}`)), false);
    }
  }
});

test("all six built-in levels have exactly one independently evaluated solution", () => {
  const expectedShape = [
    [7, 7], [7, 7], [13, 16], [13, 16], [25, 31], [25, 31],
  ];
  LEVELS.forEach((level, index) => {
    equal(level.islands.length, expectedShape[index][0], `${level.id} port count`);
    equal(level.edges.length, expectedShape[index][1], `${level.id} edge count`);
    const solved = solvePuzzle(level, { limit: 2 });
    equal(solved.count, 1, `${level.id} uniqueness`);
    equal(solved.unique, true, `${level.id} uniqueness proof completed`);
    equal(solved.truncated, false, `${level.id} search was exhaustive`);
    const evaluation = evaluatePosition(level, { bridges: solved.solutions[0] });
    equal(evaluation.complete, true, `${level.id} rules-based victory`);
    equal(evaluation.crossings.size, 0, `${level.id} no crossings`);
    equal(evaluation.exactPorts, level.islands.length, `${level.id} exact degrees`);
    equal(evaluation.components.length, 1, `${level.id} connected`);
  });
});

test("a capped solver never claims uniqueness without exhausting an ambiguous puzzle", () => {
  const ambiguous = puzzle({ width: 5, height: 5, islands: [
    { id: "tl", row: 0, column: 0, target: 3 },
    { id: "tr", row: 0, column: 4, target: 3 },
    { id: "bl", row: 4, column: 0, target: 3 },
    { id: "br", row: 4, column: 4, target: 3 },
  ] });
  const capped = solvePuzzle(ambiguous, { limit: 1 });
  equal(capped.count, 1);
  equal(capped.unique, false);
  equal(capped.truncated, true);
  const twoSolutions = solvePuzzle(ambiguous, { limit: 2 });
  equal(twoSolutions.count, 2);
  equal(twoSolutions.unique, false);
});

test("difficulty switching selects genuinely different puzzle scales", () => {
  deepEqual(DIFFICULTIES.map(({ id }) => levelsForDifficulty(id).length), [2, 2, 2]);
  equal(findLevel("mist-delta")?.difficulty, "mist");
  equal(findLevel("missing"), null);
  const sizes = DIFFICULTIES.map(({ id }) => levelsForDifficulty(id)[0].islands.length);
  ok(sizes[0] < sizes[1] && sizes[1] < sizes[2]);
});

test("difficulty focus restoration distinguishes pointer modalities", () => {
  equal(shouldRestoreDifficultyFocus({ eventDetail: 0, pointerType: "" }), true, "keyboard activation");
  equal(shouldRestoreDifficultyFocus({ eventDetail: 0 }), true, "assistive synthetic click");
  equal(shouldRestoreDifficultyFocus({ eventDetail: 1, pointerType: "mouse" }), true, "mouse activation");
  equal(shouldRestoreDifficultyFocus({ eventDetail: 1, pointerType: "touch" }), false, "touch activation");
  equal(shouldRestoreDifficultyFocus({ eventDetail: 1, pointerType: "pen" }), false, "pen activation");
  equal(shouldRestoreDifficultyFocus({ eventDetail: 0, pointerType: "touch" }), false, "touch is never refocused");
  equal(shouldRestoreDifficultyFocus({ eventDetail: 0, pointerType: "pen" }), false, "pen is never refocused");
  equal(shouldRestoreDifficultyFocus({ eventDetail: 1, pointerType: "" }), false, "unknown pointer activation");
});

test("route network uses grouped graph semantics instead of an ARIA grid", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("./app.mjs", import.meta.url), "utf8");
  ok(html.includes('id="route-board" role="group" aria-label="浮空港航路网络"'));
  ok(html.includes('id="edge-controls" role="group" aria-label="候选航线"'));
  ok(html.includes('id="port-layer" role="group" aria-label="浮空港"'));
  equal(html.includes('role="grid"'), false);
  equal(`${html}\n${appSource}`.includes('role="gridcell"'), false);
  for (const gridAttribute of ["aria-rowcount", "aria-colcount", "aria-rowindex", "aria-colindex", "aria-selected"]) {
    equal(appSource.includes(gridAttribute), false, `${gridAttribute} is absent from runtime rendering`);
  }
  ok(appSource.includes('button.setAttribute("aria-pressed", String(portPressed));'));
});

for (const { name, callback } of tests) {
  try {
    callback();
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

console.log(`Sky Bridges: ${tests.length}/${tests.length} cases, ${assertions} assertions, ${LEVELS.length} unique levels.`);
