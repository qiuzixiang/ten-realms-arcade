import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, CHAPTERS } from "../src/levels.mjs";
import { analyse, applyColour, buildAdjacency, createState, generatePuzzle, regionCount, solveLevel, toggleNote } from "../src/engine.mjs";
import { createTutorialStates, renderTutorialMap } from "../src/tutorial.mjs";
import { readFile } from "node:fs/promises";

function independentAdjacency(layout) {
  const total = Math.max(...layout.map((row) => Math.max(...row))) + 1;
  const graph = Array.from({ length: total }, () => new Set());
  for (let y = 0; y < layout.length; y += 1) for (let x = 0; x < layout[0].length; x += 1) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx; const ny = y + dy;
      if (ny < layout.length && nx < layout[0].length && layout[y][x] !== layout[ny][nx]) {
        graph[layout[y][x]].add(layout[ny][nx]); graph[layout[ny][nx]].add(layout[y][x]);
      }
    }
  }
  return graph.map((set) => [...set]);
}
function independentCount(level, maximum = 2) {
  const graph = independentAdjacency(level.layout);
  const colours = Array(graph.length).fill(-1);
  for (const [region, colour] of Object.entries(level.clues)) colours[Number(region)] = colour;
  let count = 0;
  function search(index) {
    if (count >= maximum) return;
    if (index === colours.length) { count += 1; return; }
    if (colours[index] >= 0) { search(index + 1); return; }
    for (let colour = 0; colour < 4; colour += 1) {
      if (graph[index].some((neighbor) => colours[neighbor] === colour)) continue;
      colours[index] = colour; search(index + 1); colours[index] = -1;
      if (count >= maximum) return;
    }
  }
  search(0);
  return count;
}
function assertConnectedRegions(layout, count) {
  const cells = Array.from({ length: count }, () => []);
  layout.forEach((row, y) => row.forEach((region, x) => cells[region].push([x, y])));
  for (let region = 0; region < count; region += 1) {
    const visited = new Set([cells[region][0].join(",")]); const queue = [cells[region][0]];
    for (let i = 0; i < queue.length; i += 1) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx; const ny = y + dy; const key = nx + "," + ny;
        if (!visited.has(key) && layout[ny] && layout[ny][nx] === region) { visited.add(key); queue.push([nx, ny]); }
      }
    }
    assert.equal(visited.size, cells[region].length, "region " + region + " is connected");
  }
}
function allPermutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) => allPermutations(items.filter((_, other) => other !== index)).map((rest) => [item, ...rest]));
}
function canonicalPuzzle(level) {
  const orientations = [];
  let grid = level.layout;
  for (let turn = 0; turn < 4; turn += 1) {
    orientations.push(grid, grid.map((row) => [...row].reverse()));
    grid = grid[0].map((_, x) => grid.map((row) => row[x]).reverse());
  }
  let best = null;
  for (const orientation of orientations) for (const colours of allPermutations([0, 1, 2, 3])) {
    const regions = new Map(); const clueList = [];
    const normalized = orientation.map((row) => row.map((old) => {
      if (!regions.has(old)) {
        regions.set(old, regions.size);
        clueList[regions.get(old)] = Object.prototype.hasOwnProperty.call(level.clues, String(old)) ? colours[level.clues[old]] : -1;
      }
      return regions.get(old);
    }));
    const key = JSON.stringify([normalized, clueList]);
    if (best === null || key < best) best = key;
  }
  return best;
}

test("the campaign contains ten levels in each of six chapters", () => {
  assert.equal(LEVELS.length, 60);
  assert.equal(CHAPTERS.length, 6);
  assert.deepEqual(CHAPTERS.map((chapter) => LEVELS.filter((level) => level.chapter === chapter.id).length), [10,10,10,10,10,10]);
  assert.equal(new Set(LEVELS.map((level) => level.id)).size, 60);
  assert.equal(new Set(LEVELS.map((level) => level.title)).size, 60);
  assert.equal(new Set(LEVELS.map(canonicalPuzzle)).size, 60, "levels must differ after rotation, mirror, and color renaming");
});

test("every puzzle is contiguous, properly seeded, and independently unique", () => {
  for (const level of LEVELS) {
    assert.equal(regionCount(level.layout), level.regionTotal, level.id);
    assertConnectedRegions(level.layout, level.regionTotal);
    const graph = independentAdjacency(level.layout);
    for (const [region, colour] of Object.entries(level.clues)) {
      assert.ok(Number.isInteger(Number(region)) && Number(region) >= 0 && Number(region) < level.regionTotal);
      assert.ok(Number.isInteger(colour) && colour >= 0 && colour < 4);
      assert.ok(!graph[Number(region)].some((neighbor) => level.clues[neighbor] === colour), level.id + " clue conflict");
    }
    assert.equal(independentCount(level), 1, level.id + " must have exactly one solution");
    assert.equal(solveLevel(level, { limit: 2 }).count, 1, level.id + " engine proof");
  }
});

test("fixed seeds reproduce the same first and last campaign puzzles", () => {
  for (const level of [LEVELS[0], LEVELS[59]]) {
    const chapter = CHAPTERS.find((item) => item.id === level.chapter);
    const generated = generatePuzzle({ id: level.id, title: level.title, chapter: level.chapter, seed: level.seed, regionTotal: level.regionTotal, targetDifficulty: chapter.ratio });
    assert.deepEqual(generated.layout, level.layout);
    assert.deepEqual(generated.clues, level.clues);
  }
});

test("adjacency follows shared edges, never corner contact", () => {
  const layout = [[0, 1], [2, 3]];
  const expected = [[1, 2], [0, 3], [0, 3], [1, 2]];
  assert.deepEqual(buildAdjacency(layout), expected);
});

test("fixed clues, invalid actions, notes, and incomplete states keep exact semantics", () => {
  const level = LEVELS[0]; const state = createState(level);
  const fixed = Number(Object.keys(level.clues)[0]);
  const illegal = applyColour(state, level, fixed, 3);
  assert.equal(illegal.changed, false); assert.equal(illegal.state, state);
  const empty = state.colours.findIndex((colour) => colour < 0);
  const withNote = toggleNote(state, level, empty, 2);
  assert.equal(withNote.changed, true); assert.equal(withNote.state.moves, 0);
  assert.equal(analyse(withNote.state, level).solved, false);
  const same = applyColour(state, level, empty, -1);
  assert.equal(same.changed, false); assert.equal(analyse(state, level).solved, false);
});

test("true tutorial states are generated from the first level and renderer", async () => {
  const level = LEVELS[0]; const states = createTutorialStates(level);
  assert.equal(analyse(states.completed, level).solved, true);
  assert.equal(states.afterAction.moves, 1);
  assert.equal(analyse(states.afterAction, level).solved, false);
  const names = ["01-elements.svg", "02-action.svg", "03-goal.svg"];
  const statesList = [states.initial, states.afterAction, states.completed];
  const captions = ["初始神龛：固定灵色不能更改", `合法操作：为第 ${states.action.region + 1} 境安置${["水麟", "火羽", "月狐", "森龟"][states.action.colour]}`, "完成状态：全部着色且共享边界无冲突"];
  for (let i = 0; i < names.length; i += 1) {
    const expected = renderTutorialMap(level, statesList[i], captions[i]);
    const actual = await readFile(new URL("../assets/tutorial/" + names[i], import.meta.url), "utf8");
    assert.equal(actual, expected, names[i] + " must match the formal renderer output");
    assert.match(actual, /<svg[^>]+viewBox=/);
  }
});
