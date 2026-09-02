import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SIZE, SOLVED_BOARD, START_SCRIPT, START_STATE, SUGGESTED_STEPS, TUTORIAL_AFTER_ACTION,
  TUTORIAL_COMPLETE, TUTORIAL_INITIAL, applyShift, createState, freshState, isComplete,
  normalizeState, shiftColumn, shiftRow, tutorialCards,
} from "./logic.mjs";

assert.equal(SIZE, 16);
assert.equal(isComplete(createState(SOLVED_BOARD)), true);
assert.equal(normalizeState({ board: SOLVED_BOARD, moves: -1 }), null);
assert.equal(normalizeState({ board: [...SOLVED_BOARD.slice(0, -1), 15], moves: 0 }), null, "duplicate star markers are rejected");
assert.deepEqual(shiftRow(createState(SOLVED_BOARD), 0, 1).board, [4, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
assert.deepEqual(shiftRow(shiftRow(createState(SOLVED_BOARD), 0, 1), 0, -1).board, SOLVED_BOARD, "row directions are true cyclic inverses");
assert.deepEqual(shiftColumn(createState(SOLVED_BOARD), 0, 1).board, [13, 2, 3, 4, 1, 6, 7, 8, 5, 10, 11, 12, 9, 14, 15, 16]);
assert.deepEqual(shiftColumn(shiftColumn(createState(SOLVED_BOARD), 0, 1), 0, -1).board, SOLVED_BOARD, "column directions are true cyclic inverses");
const untouched = createState(SOLVED_BOARD);
assert.equal(shiftRow(untouched, 8, 1), untouched, "invalid action returns its existing state");
assert.equal(isComplete(START_STATE), false);
assert.equal(SUGGESTED_STEPS, START_SCRIPT.length);
assert.deepEqual(freshState().board, START_STATE.board);
assert.equal(freshState().moves, 0);

assert.equal(isComplete(TUTORIAL_INITIAL), false);
assert.deepEqual(TUTORIAL_AFTER_ACTION.board, shiftRow(createState(SOLVED_BOARD), 2, -1).board, "operation tutorial derives the intermediate real board");
assert.equal(isComplete(TUTORIAL_AFTER_ACTION), false);
assert.equal(isComplete(TUTORIAL_COMPLETE), true);
assert.deepEqual(TUTORIAL_COMPLETE.board, SOLVED_BOARD);
assert.equal(applyShift(TUTORIAL_COMPLETE, { axis: "diagonal", index: 0, direction: 1 }), TUTORIAL_COMPLETE);

const cards = tutorialCards();
assert.equal(cards.length, 3);
for (const [index, card] of cards.entries()) {
  assert.match(card.svg, /<svg\b[^>]*viewBox="0 0 560 340"/);
  assert.match(card.svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(card.svg, /data-tutorial-game="orbit-atlas"/);
  assert.match(card.svg, new RegExp(`data-stage="${["elements", "action", "complete"][index]}"`));
  assert.equal((card.svg.match(/data-atlas-cell=/g) ?? []).length, 16, "each card retains all sixteen real stars");
  assert.doesNotMatch(card.svg, /<image\b|(?:href|xlink:href)=["']https?:\/\//);
}
assert.match(cards[2].svg, /data-board="1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16"/);
assert.match(cards[1].svg, /data-action-axis="column" data-action-direction="-1"/, "the operation art marks the real upward column movement");
assert.match(cards[2].svg, /data-action-axis="row" data-action-direction="1"/, "the goal art marks the real final rightward row movement");

const [html, app, css] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./app.mjs", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
]);
assert.match(html, /<html[^>]+data-realm="orbit-atlas"/);
assert.match(html, /href="\.\.\/\.\.\/"/);
assert.match(html, /shared\/game-kit\.css/);
assert.match(html, /shared\/realm-ui\.mjs/);
assert.match(app, /mountPuzzle\(/);
assert.match(css, /min-width:\s*44px/);

console.log("orbit-atlas: Sixteen cyclic row/column semantics, true tutorial states, persistence contract and compact touch controls passed.");
