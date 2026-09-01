import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RESPONSE,
  areResponseEquivalent,
  findDistinguishingPort,
  generateLayout,
  pointToPort,
  portToRay,
  responseSignature,
  responseMatchesRecord,
  traceRay,
} from "./logic.mjs";

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

test("empty water travels straight to the opposite port", () => {
  const response = traceRay(4, [], 1);
  assert.equal(response.kind, RESPONSE.EXIT);
  assert.equal(response.exit, 10);
  assert.deepEqual(response.path[0], { x: 1, y: -1 });
  assert.deepEqual(response.path.at(-1), { x: 1, y: 4 });
});

test("an energy body directly ahead absorbs the signal", () => {
  const response = traceRay(4, [[1, 0]], 1);
  assert.equal(response.kind, RESPONSE.HIT);
  assert.deepEqual(response.path.at(-1), { x: 1, y: 0 });
});

test("a direct hit takes priority over diagonal influences", () => {
  const response = traceRay(4, [[1, 0], [0, 0], [2, 0]], 1);
  assert.equal(response.kind, RESPONSE.HIT);
});

test("one diagonal body bends the signal 90 degrees away", () => {
  const response = traceRay(5, [[3, 1]], 2);
  assert.equal(response.kind, RESPONSE.EXIT);
  assert.equal(response.exit, 19);
  assert.deepEqual(response.path, [
    { x: 2, y: -1 },
    { x: 2, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
    { x: -1, y: 0 },
  ]);
});

test("after turning, the new forward direction is evaluated before moving", () => {
  const response = traceRay(4, [[0, 1], [3, 0]], 1);
  assert.equal(response.kind, RESPONSE.HIT);
  assert.deepEqual(response.path, [
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ]);
});

test("a diagonal influence before entry reflects to the same buoy", () => {
  const oneSide = traceRay(5, [[3, 0]], 2);
  const bothSides = traceRay(5, [[1, 0], [3, 0]], 2);
  assert.equal(oneSide.kind, RESPONSE.REFLECT);
  assert.equal(bothSides.kind, RESPONSE.REFLECT);
  assert.deepEqual(oneSide.path.at(-1), oneSide.path[0]);
});

test("two diagonal influences inside reverse the signal", () => {
  const response = traceRay(5, [[1, 1], [3, 1]], 2);
  assert.equal(response.kind, RESPONSE.REFLECT);
  assert.deepEqual(response.path.at(-1), { x: 2, y: -1 });
});

test("a route can bend repeatedly before leaving", () => {
  const response = traceRay(4, [[0, 0], [3, 0]], 9);
  assert.equal(response.kind, RESPONSE.EXIT);
  assert.equal(response.exit, 10);
  assert.deepEqual(response.path, [
    { x: 2, y: 4 },
    { x: 2, y: 3 },
    { x: 2, y: 2 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 1, y: 3 },
    { x: 1, y: 4 },
  ]);
});

test("an exit pair is reversible and has exact partner ports", () => {
  const balls = [[0, 0], [3, 0]];
  const forward = traceRay(4, balls, 9);
  const reverse = traceRay(4, balls, forward.exit);
  assert.equal(reverse.kind, RESPONSE.EXIT);
  assert.equal(reverse.exit, 9);

  const signature = responseSignature(4, balls);
  assert.equal(signature[9], "E:10");
  assert.equal(signature[10], "E:9");
});

test("all 3x3 layouts terminate and every exit remains reciprocal", () => {
  for (let mask = 0; mask < 2 ** 9; mask += 1) {
    const balls = [];
    for (let index = 0; index < 9; index += 1) {
      if (mask & (1 << index)) balls.push([index % 3, Math.floor(index / 3)]);
    }
    for (let port = 0; port < 12; port += 1) {
      const response = traceRay(3, balls, port);
      if (response.kind !== RESPONSE.EXIT) continue;
      const reverse = traceRay(3, balls, response.exit);
      assert.equal(reverse.kind, RESPONSE.EXIT);
      assert.equal(reverse.exit, port);
    }
  }
});

test("response-equivalent non-unique layouts are accepted", () => {
  const layoutA = [[1, 0], [3, 0], [1, 3]];
  const layoutB = [[1, 0], [1, 3], [3, 3]];
  assert.notDeepEqual(layoutA, layoutB);
  assert.equal(areResponseEquivalent(4, layoutA, layoutB), true);
  assert.deepEqual(responseSignature(4, layoutA), responseSignature(4, layoutB));
  assert.ok(responseSignature(4, layoutA).some((value) => value.startsWith("E:")));
});

test("a fixed one-body layout has the independently derived full response signature", () => {
  assert.deepEqual(responseSignature(3, [[1, 1]]), [
    "E:11",
    "H",
    "E:3",
    "E:2",
    "H",
    "E:6",
    "E:5",
    "H",
    "E:9",
    "E:8",
    "H",
    "E:0",
  ]);
});

test("model checking prefers one known contradiction, otherwise one new ray", () => {
  const hidden = [[0, 0]];
  const proposed = [[1, 1]];
  const mismatches = responseSignature(3, hidden)
    .map((value, port) => (value === responseSignature(3, proposed)[port] ? null : port))
    .filter((port) => port !== null);
  assert.ok(mismatches.length > 1);

  const unknown = findDistinguishingPort(3, hidden, proposed);
  assert.equal(unknown.alreadyRevealed, false);
  assert.equal(unknown.port, mismatches[0]);

  const preferred = mismatches.at(-1);
  const known = findDistinguishingPort(3, hidden, proposed, [preferred]);
  assert.equal(known.alreadyRevealed, true);
  assert.equal(known.port, preferred);
  assert.equal(responseMatchesRecord(3, hidden, known.port, known.expected), true);
  assert.equal(responseMatchesRecord(3, proposed, known.port, known.expected), false);
  assert.equal(
    findDistinguishingPort(4, [[1, 0], [3, 0], [1, 3]], [[1, 0], [1, 3], [3, 3]]),
    null,
  );
});

test("a layout with a different complete response is rejected", () => {
  assert.equal(areResponseEquivalent(3, [[0, 0]], [[1, 1]]), false);
});

test("clockwise port mapping covers all four boundary corners", () => {
  assert.deepEqual(portToRay(4, 0), { x: 0, y: -1, dx: 0, dy: 1, side: "top", offset: 0 });
  assert.deepEqual(portToRay(4, 4), { x: 4, y: 0, dx: -1, dy: 0, side: "right", offset: 0 });
  assert.deepEqual(portToRay(4, 8), { x: 3, y: 4, dx: 0, dy: -1, side: "bottom", offset: 0 });
  assert.deepEqual(portToRay(4, 12), { x: -1, y: 3, dx: 1, dy: 0, side: "left", offset: 0 });
  assert.equal(pointToPort(4, 0, -1), 0);
  assert.equal(pointToPort(4, 4, 0), 4);
  assert.equal(pointToPort(4, 3, 4), 8);
  assert.equal(pointToPort(4, -1, 3), 12);
});

test("layout generation is unique, bounded and validates edges", () => {
  const values = [0.01, 0.8, 0.2, 0.67, 0.4, 0.55, 0.1, 0.72, 0.3, 0.91, 0.15, 0.62, 0.34, 0.76, 0.48];
  let cursor = 0;
  const layout = generateLayout(4, 5, () => values[cursor++ % values.length]);
  assert.equal(layout.length, 5);
  assert.equal(new Set(layout.map(({ x, y }) => x + "," + y)).size, 5);
  assert.ok(layout.every(({ x, y }) => x >= 0 && x < 4 && y >= 0 && y < 4));
  assert.deepEqual(generateLayout(2, 0, () => 0), []);
  assert.throws(() => generateLayout(2, 5), RangeError);
  assert.throws(() => traceRay(4, [[4, 0]], 0), RangeError);
  assert.throws(() => traceRay(4, [[0, 0], [0, 0]], 0), /unique/);
  assert.throws(() => traceRay(4, [], 16), RangeError);
  assert.throws(() => traceRay(1, [], 0), RangeError);
  assert.throws(() => generateLayout(2, 1, () => 1), RangeError);
});

test("page wires the shared guide and reports each generated field only once", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /\.\.\/\.\.\/shared\/realm-ui\.css/);
  assert.match(html, /type="module" src="\.\.\/\.\.\/shared\/realm-ui\.mjs\?v=2"/);
  assert.match(app, /completionReported = saved\.completionReported === true \|\| state\.phase === "won"/);
  assert.match(app, /function completionLevelId\(\)[\s\S]*?state\.hidden/);
  assert.match(app, /if \(!completionReported\)\s*{[\s\S]*?reportRealmCompletion\(\)/);
  assert.match(app, /window\.__realmCompletionQueue \?\?= \[\]/);
});

test("compact layouts scale every difficulty to the available board width", async () => {
  const [css, app] = await Promise.all([
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
    readFile(new URL("./app.js", import.meta.url), "utf8"),
  ]);

  assert.match(app, /function syncBoardScale\(\)/);
  assert.match(app, /availableWidth \/ gridSize/);
  assert.match(app, /elements\.boardScroll\.scrollLeft = 0/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.board-scroll\s*{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.port::before\s*{[\s\S]*?width:\s*min\(30px, 76%\)/);
});

let passed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    passed += 1;
  } catch (error) {
    console.error("✗ " + name);
    throw error;
  }
}

console.log("Abyss Echo logic: " + passed + "/" + tests.length + " tests passed.");
