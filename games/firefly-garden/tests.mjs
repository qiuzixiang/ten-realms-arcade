import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CELL,
  DIFFICULTIES,
  LEVELS,
  adjacentBulbCount,
  allPlotKeys,
  applyMove,
  cellAt,
  createPuzzle,
  evaluatePosition,
  findLevel,
  illuminationMap,
  isPlot,
  isRune,
  isWall,
  keyOf,
  levelsForDifficulty,
  normalizePosition,
  orthogonalNeighbours,
  pointFromKey,
  positionToJSON,
  rayFrom,
  transformPuzzle,
  visibleBulbs,
} from "./logic.mjs";

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function keys(...coordinates) {
  return new Set(coordinates.map(([row, column]) => keyOf(row, column)));
}

function runeAt(result, row, column) {
  const rune = result.runes.get(keyOf(row, column));
  assert.ok(rune, `Expected a rune at ${row}:${column}`);
  return rune;
}

test("cell helpers distinguish plots, ruins, and numbered runes", () => {
  assert.equal(CELL.PLOT, ".");
  assert.equal(CELL.RUIN, "#");
  assert.equal(isPlot("."), true);
  assert.equal(isWall("#"), true);
  assert.equal(isWall("0"), true);
  assert.equal(isWall("4"), true);
  assert.equal(isRune("2"), true);
  assert.equal(isRune("5"), false);
  assert.equal(isRune("#"), false);
  assert.deepEqual(pointFromKey("12:3"), { row: 12, column: 3 });
  assert.equal(pointFromKey("-1:3"), null);
  assert.equal(pointFromKey("one:two"), null);
});

test("puzzle parsing rejects empty, ragged, zero-width, and invalid grids", () => {
  assert.throws(() => createPuzzle(), TypeError);
  assert.throws(() => createPuzzle({ rows: [] }), TypeError);
  assert.throws(() => createPuzzle({ rows: [""] }), TypeError);
  assert.throws(() => createPuzzle({ rows: ["..", "."] }), TypeError);
  assert.throws(() => createPuzzle({ rows: [".x"] }), TypeError);

  const puzzle = createPuzzle({ id: "bounds", rows: [".1", "#."] });
  assert.equal(puzzle.width, 2);
  assert.equal(puzzle.height, 2);
  assert.equal(cellAt(puzzle, 0, 1), "1");
  assert.equal(cellAt(puzzle, -1, 0), null);
  assert.equal(cellAt(puzzle, 2, 0), null);
  assert.equal(cellAt(puzzle, 0.5, 0), null);
  assert.deepEqual(allPlotKeys(puzzle), ["0:0", "1:1"]);
  assert.deepEqual(
    orthogonalNeighbours(puzzle, 0, 0).map((point) => point.key).sort(),
    ["0:1", "1:0"],
  );
});

test("plain ruins and numbered runes both stop a ray", () => {
  const puzzle = createPuzzle({ rows: [".#..2."] });

  assert.deepEqual(rayFrom(puzzle, 0, 2, 0, -1), []);
  assert.deepEqual(
    rayFrom(puzzle, 0, 2, 0, 1).map((point) => point.key),
    ["0:3"],
  );

  const light = illuminationMap(puzzle, keys([0, 2]));
  assert.deepEqual([...light.keys()].sort(), ["0:2", "0:3"]);
  assert.equal(light.has("0:0"), false, "plain ruin must block light");
  assert.equal(light.has("0:5"), false, "numbered rune must block light");
});

test("light travels orthogonally but never diagonally", () => {
  const puzzle = createPuzzle({ rows: ["...", "...", "..."] });
  const light = illuminationMap(puzzle, keys([1, 1]));

  assert.deepEqual(
    [...light.keys()].sort(),
    ["0:1", "1:0", "1:1", "1:2", "2:1"],
  );
  assert.equal(light.has("0:0"), false);
  assert.equal(light.has("0:2"), false);
  assert.equal(light.has("2:0"), false);
  assert.equal(light.has("2:2"), false);
});

test("mutually visible bulbs conflict, diagonal or blocked bulbs do not", () => {
  const open = createPuzzle({ rows: ["...", "...", "..."] });
  const rowConflict = evaluatePosition(open, { bulbs: keys([0, 0], [0, 2]) });
  assert.deepEqual([...rowConflict.conflicts].sort(), ["0:0", "0:2"]);
  assert.deepEqual([...visibleBulbs(open, 0, 0, rowConflict.bulbs)], ["0:2"]);

  const columnConflict = evaluatePosition(open, { bulbs: keys([0, 1], [2, 1]) });
  assert.deepEqual([...columnConflict.conflicts].sort(), ["0:1", "2:1"]);

  const diagonal = evaluatePosition(open, { bulbs: keys([0, 0], [1, 1]) });
  assert.equal(diagonal.conflicts.size, 0);
  assert.equal(visibleBulbs(open, 0, 0, diagonal.bulbs).size, 0);

  const blocked = createPuzzle({ rows: [".#."] });
  const behindRuin = evaluatePosition(blocked, { bulbs: keys([0, 0], [0, 2]) });
  assert.equal(behindRuin.conflicts.size, 0);
  assert.equal(visibleBulbs(blocked, 0, 0, behindRuin.bulbs).size, 0);
});

test("numbered runes report under, exact, over, and impossible states", () => {
  const puzzle = createPuzzle({ rows: ["...", ".2.", "..."] });

  const under = runeAt(evaluatePosition(puzzle, { bulbs: keys([0, 1]) }), 1, 1);
  assert.deepEqual(under, { target: 2, count: 1, exact: false, impossible: false });

  const exact = runeAt(
    evaluatePosition(puzzle, { bulbs: keys([0, 1], [1, 0]) }),
    1,
    1,
  );
  assert.deepEqual(exact, { target: 2, count: 2, exact: true, impossible: false });

  const over = runeAt(
    evaluatePosition(puzzle, { bulbs: keys([0, 1], [1, 0], [1, 2]) }),
    1,
    1,
  );
  assert.deepEqual(over, { target: 2, count: 3, exact: false, impossible: true });

  const impossible = runeAt(
    evaluatePosition(puzzle, {
      bulbs: keys([0, 1]),
      marks: keys([1, 0], [1, 2], [2, 1]),
    }),
    1,
    1,
  );
  assert.deepEqual(impossible, { target: 2, count: 1, exact: false, impossible: true });

  const cornerFour = createPuzzle({ rows: ["4.", ".."] });
  const geometricallyImpossible = runeAt(evaluatePosition(cornerFour), 0, 0);
  assert.equal(geometricallyImpossible.count, 0);
  assert.equal(geometricallyImpossible.impossible, true);
});

test("runes count only orthogonally adjacent bulbs", () => {
  const puzzle = createPuzzle({ rows: ["...", ".1.", "..."] });
  assert.equal(adjacentBulbCount(puzzle, 1, 1, keys([0, 0], [2, 2])), 0);
  assert.equal(adjacentBulbCount(puzzle, 1, 1, keys([0, 1], [0, 0])), 1);
});

test("an unnumbered ruin blocks light but imposes no adjacent-bulb constraint", () => {
  const puzzle = createPuzzle({ rows: [".#."] });
  const result = evaluatePosition(puzzle, { bulbs: keys([0, 0], [0, 2]) });

  assert.equal(result.runes.size, 0);
  assert.equal(result.totalRunes, 0);
  assert.equal(result.exactRunes, 0);
  assert.equal(result.conflicts.size, 0);
  assert.equal(result.complete, true);
});

test("marks can be cleared and reject bulb placement", () => {
  const puzzle = createPuzzle({ rows: ["..."] });
  const marked = applyMove(puzzle, {}, { type: "toggle-mark", row: 0, column: 1 });
  assert.equal(marked.accepted, true);
  assert.equal(marked.effect, "mark-added");
  assert.deepEqual(positionToJSON(marked), { bulbs: [], marks: ["0:1"] });

  const rejectedBulb = applyMove(puzzle, marked, {
    type: "toggle-bulb",
    row: 0,
    column: 1,
  });
  assert.equal(rejectedBulb.accepted, false);
  assert.equal(rejectedBulb.reason, "marked");
  assert.deepEqual(positionToJSON(rejectedBulb), { bulbs: [], marks: ["0:1"] });

  const cleared = applyMove(puzzle, marked, { type: "toggle-mark", key: "0:1" });
  assert.equal(cleared.accepted, true);
  assert.equal(cleared.effect, "mark-removed");
  assert.deepEqual(positionToJSON(cleared), { bulbs: [], marks: [] });
});

test("a bulb or an illuminated plot rejects a new mark", () => {
  const puzzle = createPuzzle({ rows: ["..."] });
  const withBulb = applyMove(puzzle, {}, { type: "toggle-bulb", key: "0:0" });
  assert.equal(withBulb.accepted, true);

  const onBulb = applyMove(puzzle, withBulb, { type: "toggle-mark", key: "0:0" });
  assert.equal(onBulb.accepted, false);
  assert.equal(onBulb.reason, "bulb");

  const onLight = applyMove(puzzle, withBulb, { type: "toggle-mark", key: "0:2" });
  assert.equal(onLight.accepted, false);
  assert.equal(onLight.reason, "lit");

  const removed = applyMove(puzzle, withBulb, { type: "toggle-bulb", key: "0:0" });
  assert.equal(removed.accepted, true);
  assert.equal(removed.effect, "bulb-removed");
});

test("a mark is an annotation, not a blocker for later light", () => {
  const puzzle = createPuzzle({ rows: ["..."] });
  const marked = applyMove(puzzle, {}, { type: "toggle-mark", key: "0:1" });
  const withBulb = applyMove(puzzle, marked, { type: "toggle-bulb", key: "0:0" });
  assert.equal(withBulb.accepted, true);

  const result = evaluatePosition(puzzle, withBulb);
  assert.equal(result.marks.has("0:1"), true);
  assert.deepEqual([...result.light.keys()].sort(), ["0:0", "0:1", "0:2"]);
  assert.equal(result.complete, true);
});

test("normalization filters invalid keys and prevents bulb/mark overlap", () => {
  const puzzle = createPuzzle({ rows: [".#"] });
  const normalized = normalizePosition(puzzle, {
    bulbs: ["0:0", "0:1", "9:9", "bad"],
    marks: ["0:0", "0:1", "9:9"],
  });
  assert.deepEqual([...normalized.bulbs], ["0:0"]);
  assert.deepEqual([...normalized.marks], []);
});

test("moves reject walls, runes, out-of-bounds coordinates, and unknown actions", () => {
  const puzzle = createPuzzle({ rows: [".#1"] });

  for (const key of ["0:1", "0:2", "0:3", "-1:0", "bad"] ) {
    const result = applyMove(puzzle, {}, { type: "toggle-bulb", key });
    assert.equal(result.accepted, false, `Expected ${key} to be rejected`);
    assert.equal(result.reason, "not-a-plot");
  }

  const unknown = applyMove(puzzle, {}, { type: "sing-to-firefly", key: "0:0" });
  assert.equal(unknown.accepted, false);
  assert.equal(unknown.reason, "unknown-move");
});

test("victory fails independently when any one invariant is false", () => {
  const unlitPuzzle = createPuzzle({ rows: [".#."] });
  const unlit = evaluatePosition(unlitPuzzle, { bulbs: keys([0, 0]) });
  assert.equal(unlit.unlit.size, 1);
  assert.equal(unlit.conflicts.size, 0);
  assert.equal(unlit.runes.size, 0);
  assert.equal(unlit.complete, false);

  const conflictPuzzle = createPuzzle({ rows: ["..."] });
  const conflict = evaluatePosition(conflictPuzzle, { bulbs: keys([0, 0], [0, 2]) });
  assert.equal(conflict.unlit.size, 0);
  assert.equal(conflict.conflicts.size, 2);
  assert.equal(conflict.runes.size, 0);
  assert.equal(conflict.complete, false);

  const runePuzzle = createPuzzle({ rows: ["1.."] });
  const wrongRune = evaluatePosition(runePuzzle, { bulbs: keys([0, 2]) });
  assert.equal(wrongRune.unlit.size, 0);
  assert.equal(wrongRune.conflicts.size, 0);
  assert.equal(runeAt(wrongRune, 0, 0).exact, false);
  assert.equal(wrongRune.complete, false);

  const solved = evaluatePosition(runePuzzle, { bulbs: keys([0, 1]) });
  assert.equal(solved.unlit.size, 0);
  assert.equal(solved.conflicts.size, 0);
  assert.equal(runeAt(solved, 0, 0).exact, true);
  assert.equal(solved.complete, true);

  assert.equal(evaluatePosition(createPuzzle({ rows: ["#"] })).complete, false);
});

test("all six declared board transforms map rows correctly", () => {
  const source = { id: "shape", rows: ["..#", "1.2"] };
  assert.deepEqual(transformPuzzle(source, "identity").rows, ["..#", "1.2"]);
  assert.deepEqual(transformPuzzle(source, "rotate-90").rows, ["1.", "..", "2#"]);
  assert.deepEqual(transformPuzzle(source, "rotate-180").rows, ["2.1", "#.."]);
  assert.deepEqual(transformPuzzle(source, "rotate-270").rows, ["#2", "..", ".1"]);
  assert.deepEqual(transformPuzzle(source, "mirror-horizontal").rows, ["#..", "2.1"]);
  assert.deepEqual(transformPuzzle(source, "mirror-vertical").rows, ["1.2", "..#"]);
});

test("level library exposes four variants for each of three difficulties", () => {
  assert.equal(DIFFICULTIES.length, 3);
  assert.equal(LEVELS.length, 12);
  assert.equal(new Set(LEVELS.map((level) => level.id)).size, LEVELS.length);

  for (const difficulty of DIFFICULTIES) {
    const levels = levelsForDifficulty(difficulty.id);
    assert.equal(levels.length, 4, `Expected four ${difficulty.id} levels`);
    assert.ok(levels.every((level) => level.difficulty === difficulty.id));
  }

  for (const level of LEVELS) {
    assert.equal(findLevel(level.id), level);
  }
  assert.equal(findLevel("missing-night-garden"), null);
});

test("every declared level solution is legal and completes all three rules", () => {
  for (const level of LEVELS) {
    assert.equal(
      new Set(level.solution).size,
      level.solution.length,
      `${level.id} solution must not contain duplicate bulbs`,
    );
    assert.ok(
      level.solution.every((key) => {
        const point = pointFromKey(key);
        return point && isPlot(cellAt(level, point.row, point.column));
      }),
      `${level.id} solution bulbs must all be on plots`,
    );

    const result = evaluatePosition(level, { bulbs: level.solution });
    assert.equal(result.unlit.size, 0, `${level.id} leaves a plot dark`);
    assert.equal(result.conflicts.size, 0, `${level.id} has mutually visible bulbs`);
    assert.ok(
      [...result.runes.values()].every((rune) => rune.exact),
      `${level.id} violates a numbered rune`,
    );
    assert.equal(result.complete, true, `${level.id} declared solution must win`);
  }
});

test("page wires the shared guide and guards completion rewards across restore and undo", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./app.mjs", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /\.\.\/\.\.\/shared\/realm-ui\.css\?v=2/);
  assert.match(html, /type="module" src="\.\.\/\.\.\/shared\/realm-ui\.mjs\?v=2"/);
  assert.match(app, /completionReported:\s*completed\s*\|\|\s*saved\.active\.completionReported === true/);
  assert.match(app, /if \(!state\.completionReported\)\s*{[\s\S]*?reportRealmCompletion\(\)/);
  assert.match(app, /window\.__realmCompletionQueue \?\?= \[\]/);
  assert.match(styles, /--board-inset:\s*10px/);
  assert.match(app, /function syncBoardScale\(\)/);
  assert.match(app, /elements\.boardFrame\.scrollLeft = 0/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.board-frame\s*{[^}]*overflow-x:\s*hidden/);
  assert.match(styles, /grid-template-columns:\s*repeat\(var\(--columns\),\s*var\(--cell, 44px\)\)/);
  assert.match(html, /styles\.css\?v=20260901b/);
  assert.match(html, /app\.mjs\?v=20260901b/);
});

test("firefly entities and illuminated range use redundant visual encodings", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./app.mjs", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /legend-firefly[\s\S]*?萤火实体/);
  assert.match(html, /legend-light[\s\S]*?照亮范围/);
  assert.match(app, /class="cell-state"/);
  assert.match(app, /element\.dataset\.visualState\s*=\s*hasConflict[\s\S]*?"萤火实体"[\s\S]*?"照亮范围"/);
  assert.match(styles, /\.has-bulb \.cell-state::before\s*{[\s\S]*?content:\s*"萤"/);
  assert.match(styles, /\.is-lit:not\(\.has-bulb\) \.cell-state::before\s*{[\s\S]*?content:\s*"光"/);
  assert.match(styles, /\.board-cell\.has-bulb\s*{[\s\S]*?border:\s*2px double/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*?\.has-bulb \.firefly\s*{[\s\S]*?animation:\s*none/);
  assert.doesNotMatch(styles, /(?:html|body)\s*{[^}]*min-width:\s*320px/);
});

let passed = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} firefly-garden tests passed.`);
