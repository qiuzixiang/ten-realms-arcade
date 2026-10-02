import assert from "node:assert/strict";
import test from "node:test";
import { CHAPTERS, LEVELS, findLevel } from "./levels.mjs";
import { solvePuzzle, explainStep } from "./solver.mjs";
import { applyMove, createPuzzle, evaluatePosition } from "./logic.mjs";

function transform(rows, bulbs, turns, mirror) {
  const size = rows.length;
  const turnPoint = ([r, c]) => {
    for (let n = 0; n < turns; n += 1) [r, c] = [c, size - 1 - r];
    if (mirror) c = size - 1 - c;
    return [r, c];
  };
  const grid = Array.from({ length: size }, () => Array(size).fill(""));
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const [nr, nc] = turnPoint([r, c]);
      grid[nr][nc] = rows[r][c];
    }
  }
  return {
    rows: grid.map((row) => row.join("")),
    bulbs: bulbs.map((key) => turnPoint(key.split(":").map(Number)).join(":")),
  };
}

function fingerprint(level) {
  const candidates = [];
  for (let turns = 0; turns < 4; turns += 1) {
    for (const mirror of [false, true]) {
      const form = transform(level.rows, level.solution, turns, mirror);
      candidates.push(`${form.rows.join("/")}|${form.bulbs.sort().join(",")}`);
    }
  }
  return candidates.sort()[0];
}

function longestRun(rows) {
  const lines = [
    ...rows,
    ...Array.from({ length: rows[0].length }, (_, c) => rows.map((row) => row[c]).join("")),
  ];
  return Math.max(...lines.flatMap((line) => line.split(/[#0-4]/).map((run) => run.length)));
}

function sharedClueCandidate(rows) {
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < rows[0].length; c += 1) {
      if (rows[r][c] !== ".") continue;
      const clues = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([nr, nc]) => nr >= 0 && nr < rows.length && nc >= 0 && nc < rows[0].length)
        .filter(([nr, nc]) => /[0-4]/.test(rows[nr][nc]));
      if (clues.length > 1) return true;
    }
  }
  return false;
}

function signature(solution) { return [...solution].sort().join(","); }

// Separate cell/ray brute force on small samples, to catch errors shared by
// the campaign data and the row/column-segment oracle.
function bruteSolutions(rows) {
  const plots = [];
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < rows[0].length; c += 1) {
      if (rows[r][c] === ".") plots.push([r, c]);
    }
  }
  const seenFrom = (r, c, bulbs) => {
    if (bulbs.has(`${r}:${c}`)) return true;
    for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
      let nr = r + dr;
      let nc = c + dc;
      while (nr >= 0 && nc >= 0 && nr < rows.length && nc < rows[0].length && rows[nr][nc] === ".") {
        if (bulbs.has(`${nr}:${nc}`)) return true;
        nr += dr;
        nc += dc;
      }
    }
    return false;
  };
  const answers = [];
  for (let mask = 0; mask < 2 ** plots.length; mask += 1) {
    const bulbs = new Set(plots.filter((_, i) => mask & (2 ** i)).map(([r, c]) => `${r}:${c}`));
    if (!plots.every(([r, c]) => seenFrom(r, c, bulbs))) continue;
    if ([...bulbs].some((key) => {
      const [r, c] = key.split(":").map(Number);
      const others = new Set(bulbs);
      others.delete(key);
      return seenFrom(r, c, others);
    })) continue;
    let valid = true;
    for (let r = 0; r < rows.length; r += 1) {
      for (let c = 0; c < rows[0].length; c += 1) {
        const cell = rows[r][c];
        if (!/[0-4]/.test(cell)) continue;
        const count = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([nr, nc]) => bulbs.has(`${nr}:${nc}`)).length;
        if (count !== Number(cell)) valid = false;
      }
    }
    if (valid) answers.push(signature(bulbs));
  }
  return answers.sort();
}

test("60 levels have stable chapter boundaries and authored geometry", () => {
  assert.equal(CHAPTERS.length, 6);
  assert.equal(LEVELS.length, 60);
  assert.equal(new Set(LEVELS.map((level) => level.id)).size, 60);
  assert.equal(new Set(LEVELS.map(fingerprint)).size, 60, "rotations and mirrors must not refill the main line");
  for (const [chapterIndex, chapter] of CHAPTERS.entries()) {
    const levels = LEVELS.filter((level) => level.chapterId === chapter.id);
    assert.equal(levels.length, 10, chapter.id);
    for (const level of levels) {
      assert.equal(findLevel(level.id), level);
      assert.equal(level.width, level.height);
      assert.ok(level.width >= [4, 5, 6, 6, 7, 8][chapterIndex]);
      assert.ok(level.width <= [5, 6, 6, 7, 8, 9][chapterIndex]);
      assert.ok(Number.isInteger(level.seed));
      assert.equal(level.generatorVersion, "garden-gen-1");
      assert.ok(Object.isFrozen(level) && Object.isFrozen(level.rows) && Object.isFrozen(level.solution));
    }
  }
  assert.equal(LEVELS[0].width, 4);
  assert.equal(LEVELS[0].rows.join("").match(/[0-4]/g).length, 2);
  assert.ok(LEVELS.slice(10, 20).every((level) => level.rows.join("").includes("0")));
  assert.ok(LEVELS.slice(30, 40).every((level) => sharedClueCandidate(level.rows)));
  assert.ok(LEVELS.slice(40).every((level) => longestRun(level.rows) >= level.width - 1));
});

test("every campaign puzzle is uniquely solved without reading its reference lamps", () => {
  for (const level of LEVELS) {
    const result = solvePuzzle({ rows: level.rows }, { limit: 2 });
    assert.equal(result.complete, true, `${level.id}: search was truncated`);
    assert.equal(result.truncated, false, level.id);
    assert.equal(result.solutions.length, 1, `${level.id}: not unique`);
    assert.equal(signature(result.solutions[0]), signature(level.solution), `${level.id}: wrong reference answer`);
    const puzzle = createPuzzle(level);
    let position = { bulbs: new Set(), marks: new Set() };
    for (const key of level.solution) {
      const next = applyMove(puzzle, position, { type: "toggle-bulb", key });
      assert.equal(next.accepted, true, `${level.id}: cannot replay ${key}`);
      position = next;
    }
    assert.equal(evaluatePosition(puzzle, position).complete, true, `${level.id}: engine rejects the solution`);
  }
});

test("segment oracle matches independent ray brute force on small boards", () => {
  let state = 317;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 2 ** 32; };
  for (let sample = 0; sample < 240; sample += 1) {
    const rows = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => {
      const x = random();
      return x < 0.58 ? "." : x < 0.7 ? "#" : String(Math.floor(random() * 5));
    }).join(""));
    const white = rows.join("").match(/\./g)?.length ?? 0;
    const expected = bruteSolutions(rows);
    const actual = solvePuzzle({ rows }, { limit: 2 ** white + 1 });
    assert.equal(actual.complete, true, rows.join("/"));
    assert.deepEqual(actual.solutions.map(signature).sort(), expected, rows.join("/"));
  }
});

test("capped searches never claim uniqueness", () => {
  const ambiguous = solvePuzzle({ rows: ["..", ".."] }, { limit: 1 });
  assert.equal(ambiguous.solutions.length, 1);
  assert.equal(ambiguous.complete, false);
  assert.equal(ambiguous.truncated, true);
  const budget = solvePuzzle({ rows: ["..", ".."] }, { limit: 2, maxNodes: 1 });
  assert.equal(budget.complete, false);
  assert.equal(budget.truncated, true);
});

test("proven hints lead to completion and reject contradictory notes", () => {
  for (const level of LEVELS) {
    const puzzle = createPuzzle(level);
    const solution = new Set(level.solution);
    let position = { bulbs: new Set(), marks: new Set() };
    for (let step = 0; step < 100 && !evaluatePosition(puzzle, position).complete; step += 1) {
      const hint = explainStep(puzzle, position);
      assert.ok(["bulb", "exclude"].includes(hint.type), `${level.id}: ${JSON.stringify(hint)}`);
      assert.equal(solution.has(hint.key), hint.type === "bulb", `${level.id}: false hint ${hint.key}`);
      const next = applyMove(puzzle, position, {
        type: hint.type === "bulb" ? "toggle-bulb" : "toggle-mark", key: hint.key,
      });
      assert.equal(next.accepted, true, `${level.id}: hinted move rejected (${next.reason})`);
      position = next;
    }
    assert.equal(evaluatePosition(puzzle, position).complete, true, `${level.id}: hints stalled`);
  }
  const wrongMark = explainStep(LEVELS[0], { marks: [LEVELS[0].solution[0]] });
  assert.equal(wrongMark.type, "contradiction");
  assert.equal(wrongMark.reason.kind, "marks");
});
