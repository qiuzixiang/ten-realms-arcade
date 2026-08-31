import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  buildPlanarSolution,
  countCrossings,
  findCrossingPairs,
  generatePuzzle,
  isSolved,
  minimumVertexDistance,
  properSegmentsIntersect,
  segmentsIntersect,
} from "./logic.mjs";
import {
  canUndo,
  hasExactNodeIds,
  restoreSavedSession,
  undoLastMove,
} from "./session.mjs";

const tests = [];

function test(name, body) {
  tests.push({ name, body });
}

function countForTwoSegments(a, b, c, d) {
  return countCrossings(
    [
      { id: 0, x: a[0], y: a[1] },
      { id: 1, x: b[0], y: b[1] },
      { id: 2, x: c[0], y: c[1] },
      { id: 3, x: d[0], y: d[1] },
    ],
    [[0, 1], [2, 3]],
  );
}

test("detects a standard strict crossing", () => {
  assert.equal(
    properSegmentsIntersect([0, 0], [4, 4], [0, 4], [4, 0]),
    true,
  );
  assert.equal(
    properSegmentsIntersect({ x: -2, y: 1 }, { x: 3, y: 1 }, { x: 0, y: -1 }, { x: 0, y: 3 }),
    true,
  );
});

test("shared logical endpoints do not count as crossings", () => {
  assert.equal(
    properSegmentsIntersect([0, 0], [3, 3], [0, 0], [3, 0]),
    false,
  );

  const vertices = [
    { id: 0, x: 0, y: 0 },
    { id: 1, x: 1, y: 1 },
    { id: 2, x: 1, y: -1 },
  ];
  assert.deepEqual(findCrossingPairs(vertices, [[0, 1], [0, 2]]), []);
});

test("parallel and collinear-separated segments do not cross", () => {
  assert.equal(
    segmentsIntersect([0, 0], [4, 0], [0, 2], [4, 2]),
    false,
  );
  assert.equal(
    segmentsIntersect([0, 0], [2, 0], [3, 0], [6, 0]),
    false,
  );
});

test("closed segments count collinear overlap and every boundary touch", () => {
  assert.equal(
    segmentsIntersect([0, 0], [4, 0], [2, 0], [6, 0]),
    true,
    "collinear overlap",
  );
  assert.equal(countForTwoSegments([0, 0], [4, 0], [2, 0], [6, 0]), 1);
  assert.equal(
    segmentsIntersect([0, 0], [4, 0], [4, 0], [4, 3]),
    true,
    "endpoint touch",
  );
  assert.equal(countForTwoSegments([0, 0], [4, 0], [4, 0], [4, 3]), 1);
  assert.equal(
    segmentsIntersect([0, 0], [4, 0], [2, 0], [2, 3]),
    true,
    "T-touch",
  );
  assert.equal(countForTwoSegments([0, 0], [4, 0], [2, 0], [2, 3]), 1);
  assert.equal(
    segmentsIntersect([0, 0], [0, 0], [-1, 0], [1, 0]),
    true,
    "degenerate segment",
  );
  assert.equal(
    segmentsIntersect([0, 0], [2, 0], [2, 0], [4, 0]),
    true,
    "collinear single-point contact",
  );

  // The narrower helper remains available for visual X-knot treatment.
  assert.equal(
    properSegmentsIntersect([0, 0], [4, 0], [2, 0], [2, 3]),
    false,
  );
});

test("different logical vertices at the same coordinate still intersect", () => {
  const vertices = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 0, y: 0 },
    { id: "c", x: 2, y: 0 },
    { id: "d", x: 0, y: 2 },
  ];

  assert.deepEqual(
    findCrossingPairs(vertices, [["a", "c"], ["b", "d"]]),
    [[0, 1]],
  );
  assert.equal(countCrossings(vertices, [["a", "c"], ["b", "d"]]), 1);
});

test("finds crossing edge pairs once and recognises victory", () => {
  const vertices = [
    { id: 0, x: 0, y: 0 },
    { id: 1, x: 4, y: 4 },
    { id: 2, x: 0, y: 4 },
    { id: 3, x: 4, y: 0 },
    { id: 4, x: 5, y: 4 },
  ];
  const edges = [[0, 1], [2, 3], [1, 4]];

  assert.deepEqual(findCrossingPairs(vertices, edges), [[0, 1]]);
  assert.equal(countCrossings(vertices, edges), 1);
  assert.equal(isSolved(vertices, edges), false);

  const solvedVertices = vertices.map((vertex) => ({ ...vertex }));
  solvedVertices[2] = { id: 2, x: 0, y: 5 };
  solvedVertices[3] = { id: 3, x: 4, y: 5 };
  assert.equal(countCrossings(solvedVertices, edges), 0);
  assert.equal(isSolved(solvedVertices, edges), true);
});

test("the solved graph is planar and generated puzzles are deterministic", () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const planar = buildPlanarSolution(difficulty);
    assert.equal(countCrossings(planar.vertices, planar.edges), 0, difficulty);

    const first = generatePuzzle(difficulty, "deterministic-seed");
    const second = generatePuzzle({
      difficulty,
      seed: "deterministic-seed",
    });
    assert.deepEqual(first, second, difficulty);
    assert.equal(first.crossingCount, first.crossings.length);
    assert.ok(first.crossingCount > 0, `${difficulty} starts tangled`);
    assert.equal(isSolved(first.solution, first.edges), true);
  }

  assert.notDeepEqual(
    generatePuzzle("medium", "seed-a").vertices,
    generatePuzzle("medium", "seed-b").vertices,
  );
});

test("difficulty tiers increase size and density with unique safe slots", () => {
  const order = ["easy", "medium", "hard"];
  const puzzles = order.map((difficulty) =>
    generatePuzzle(difficulty, "slot-audit"),
  );

  for (const puzzle of puzzles) {
    assert.equal(puzzle.vertices.length, puzzle.config.vertexCount);
    assert.equal(
      new Set(puzzle.vertices.map((vertex) => vertex.id)).size,
      puzzle.vertices.length,
      `${puzzle.difficulty} vertex ids are unique`,
    );
    assert.equal(
      new Set(
        puzzle.vertices.map(
          (vertex) => `${vertex.x.toFixed(12)},${vertex.y.toFixed(12)}`,
        ),
      ).size,
      puzzle.vertices.length,
      `${puzzle.difficulty} positions are unique`,
    );
    assert.ok(
      minimumVertexDistance(puzzle.vertices) > 0.18,
      `${puzzle.difficulty} slots leave a touch-safe gap`,
    );
    assert.ok(
      puzzle.vertices.every(
        ({ x, y }) => x > 0.08 && x < 0.92 && y > 0.08 && y < 0.92,
      ),
      `${puzzle.difficulty} vertices remain inside the board margin`,
    );
  }

  assert.ok(puzzles[0].vertices.length < puzzles[1].vertices.length);
  assert.ok(puzzles[1].vertices.length < puzzles[2].vertices.length);
  assert.ok(puzzles[0].edges.length < puzzles[1].edges.length);
  assert.ok(puzzles[1].edges.length < puzzles[2].edges.length);
  assert.ok(
    puzzles[0].config.edgeDensity < puzzles[1].config.edgeDensity,
  );
  assert.ok(
    puzzles[1].config.edgeDensity < puzzles[2].config.edgeDensity,
  );
});

test("many seeds keep all tiers solvable, separated, and initially tangled", () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (let seed = 0; seed < 40; seed += 1) {
      const puzzle = generatePuzzle(difficulty, seed);
      assert.ok(puzzle.crossingCount > 0, `${difficulty}/${seed}`);
      assert.equal(countCrossings(puzzle.solution, puzzle.edges), 0);
      assert.ok(minimumVertexDistance(puzzle.vertices) > 0.18);
    }
  }
});

test("completed drawings remain undoable whenever move history exists", () => {
  const vertices = [
    { id: 0, x: 0.1, y: 0.1 },
    { id: 1, x: 0.9, y: 0.1 },
    { id: 2, x: 0.1, y: 0.9 },
    { id: 3, x: 0.9, y: 0.9 },
  ];
  const edges = [[0, 1], [2, 3]];
  const history = [{
    id: 1,
    from: { x: 0.9, y: 0.9 },
    to: { x: 0.9, y: 0.1 },
  }];

  assert.equal(isSolved(vertices, edges), true);
  assert.equal(canUndo(history), true, "solved state does not disable history");
  const undone = undoLastMove(vertices, history, 1);
  assert.ok(undone);
  assert.equal(undone.history.length, 0);
  assert.equal(undone.steps, 0);
  assert.deepEqual(undone.vertices[1], { id: 1, x: 0.9, y: 0.9 });
  assert.equal(isSolved(undone.vertices, edges), false, "the final move returns to an incomplete drawing");
  assert.equal(canUndo(undone.history), false);
});

test("a genuine completed save restores with an undoable final move", () => {
  const puzzle = generatePuzzle("easy", "completed-save-roundtrip");
  const vertices = puzzle.vertices.map((vertex) => ({ ...vertex }));
  const history = [];

  for (const target of puzzle.solution) {
    const current = vertices[target.id];
    if (current.x === target.x && current.y === target.y) continue;
    history.push({
      id: target.id,
      from: { x: current.x, y: current.y },
      to: { x: target.x, y: target.y },
    });
    vertices[target.id] = { ...target };
    if (isSolved(vertices, puzzle.edges)) break;
  }

  assert.equal(isSolved(vertices, puzzle.edges), true);
  const payload = JSON.stringify({
    version: 2,
    difficulty: puzzle.difficulty,
    seed: puzzle.seed,
    vertices,
    history,
    steps: history.length,
    solved: true,
  });
  let removals = 0;
  const restored = restoreSavedSession({
    getItem: () => payload,
    removeItem: () => {
      removals += 1;
    },
  }, "save", { version: 2 });

  assert.ok(restored);
  assert.equal(removals, 0);
  const undone = undoLastMove(restored.vertices, restored.history, restored.steps);
  assert.ok(undone);
  assert.equal(isSolved(undone.vertices, restored.edges), false);
});

test("saved node ids must be exactly the complete zero-based range", () => {
  assert.equal(hasExactNodeIds([{ id: 2 }, { id: 0 }, { id: 1 }], 3), true);
  assert.equal(hasExactNodeIds([{ id: 0 }, { id: 1 }, { id: 3 }], 3), false, "out-of-range id");
  assert.equal(hasExactNodeIds([{ id: 0 }, { id: 0 }, { id: 2 }], 3), false, "duplicate and missing id");
  assert.equal(hasExactNodeIds([{ id: 0 }, { id: 1 }, { id: "2" }], 3), false, "non-integer id");
});

test("malformed saves and reconstruction failures are cleared without escaping", () => {
  function storageWith(value) {
    let current = value;
    let removals = 0;
    return {
      getItem: () => current,
      removeItem: () => {
        current = null;
        removals += 1;
      },
      get removals() {
        return removals;
      },
    };
  }

  const malformedIds = storageWith(JSON.stringify({
    version: 2,
    difficulty: "easy",
    seed: "bad-ids",
    vertices: Array.from({ length: 7 }, (_, id) => ({ id: id + 10, x: 0.5, y: 0.5 })),
    history: [],
    steps: 0,
    solved: false,
  }));
  assert.equal(restoreSavedSession(malformedIds, "save", { version: 2 }), null);
  assert.equal(malformedIds.removals, 1, "poisoned id set is removed");
  assert.equal(restoreSavedSession(malformedIds, "save", { version: 2 }), null);
  assert.equal(malformedIds.removals, 1, "a later refresh sees no poisoned payload");

  const rebuildFailure = storageWith(JSON.stringify({
    version: 2,
    difficulty: "easy",
    seed: "throws",
    vertices: [],
    history: [],
    steps: 0,
    solved: false,
  }));
  assert.doesNotThrow(() => {
    assert.equal(restoreSavedSession(rebuildFailure, "save", {
      version: 2,
      generate: () => {
        throw new Error("synthetic generator failure");
      },
    }), null);
  });
  assert.equal(rebuildFailure.removals, 1, "reconstruction exception clears the save");

  const brokenJson = storageWith("{not-json");
  assert.equal(restoreSavedSession(brokenJson, "save", { version: 2 }), null);
  assert.equal(brokenJson.removals, 1, "invalid JSON is removed");
});

let passed = 0;
for (const { name, body } of tests) {
  try {
    await body();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} red-thread-office rule tests passed.`);
