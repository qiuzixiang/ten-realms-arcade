import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SIZE, SOLVED_BOARD, START_SEQUENCE, START_STATE, SUGGESTED_STEPS, TUTORIAL_AFTER_SLIDE,
  TUTORIAL_COMPLETE, TUTORIAL_INITIAL, blankIndex, createState, freshState, isComplete,
  isLegalTile, isSolvableBoard, legalTiles, moveTile, moveTileDirection, normalizeState,
  tutorialCards,
} from "./logic.mjs";

assert.equal(SIZE, 9);
assert.equal(isComplete(createState(SOLVED_BOARD)), true);
assert.equal(isSolvableBoard([1, 2, 3, 4, 5, 6, 8, 7, 0]), false, "an odd inversion state is not reachable");
assert.equal(normalizeState({ board: [1, 2, 3], moves: 0 }), null, "corrupt storage is rejected");
assert.equal(normalizeState({ board: SOLVED_BOARD, moves: -1 }), null);
assert.deepEqual(freshState().board, START_STATE.board);
assert.equal(freshState().moves, 0);
assert.equal(SUGGESTED_STEPS, START_SEQUENCE.length);
assert.equal(isSolvableBoard(START_STATE.board), true, "the fixed practice manifest is built from legal slides");

assert.equal(blankIndex(TUTORIAL_INITIAL), 4);
assert.deepEqual(legalTiles(TUTORIAL_INITIAL), [1, 3, 5, 7]);
assert.equal(isLegalTile(TUTORIAL_INITIAL, 7), true);
assert.equal(isLegalTile(TUTORIAL_INITIAL, 8), false);
assert.deepEqual(TUTORIAL_AFTER_SLIDE.board, [1, 2, 3, 4, 5, 6, 7, 0, 8]);
assert.equal(TUTORIAL_AFTER_SLIDE.moves, 1);
assert.equal(moveTile(TUTORIAL_INITIAL, 8), TUTORIAL_INITIAL, "a diagonal tile cannot move");
assert.deepEqual(moveTileDirection(TUTORIAL_INITIAL, "up").board, TUTORIAL_AFTER_SLIDE.board, "up means a tile moves upward into the blank");
assert.equal(isComplete(TUTORIAL_COMPLETE), true);
assert.deepEqual(TUTORIAL_COMPLETE.board, SOLVED_BOARD);

const cards = tutorialCards();
assert.equal(cards.length, 3);
for (const [index, card] of cards.entries()) {
  assert.match(card.svg, /<svg\b[^>]*viewBox="0 0 540 320"/);
  assert.match(card.svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(card.svg, /data-tutorial-game="time-cargo-bay"/);
  assert.match(card.svg, new RegExp(`data-stage="${["elements", "action", "complete"][index]}"`));
  assert.equal((card.svg.match(/data-cargo-cell=/g) ?? []).length, 9, "each tutorial image shows the complete true board");
  assert.doesNotMatch(card.svg, /<image\b|(?:href|xlink:href)=["']https?:\/\//, "tutorial art is self-contained, not an unreviewed external image");
}
assert.match(cards[1].svg, /data-board="1,2,3,4,5,6,7,0,8"/);
assert.match(cards[2].svg, /data-board="1,2,3,4,5,6,7,8,0"/);
assert.match(cards[1].svg, /data-action-from="7" data-action-to="4"/, "the action art labels the actual upward cargo movement");
assert.match(cards[2].svg, /data-action-from="8" data-action-to="7"/, "the completion art labels the actual final leftward cargo movement");

const [html, app, css] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./app.mjs", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
]);
assert.match(html, /<html[^>]+data-realm="time-cargo-bay"/);
assert.match(html, /href="\.\.\/\.\.\/"/);
assert.match(html, /shared\/game-kit\.css/);
assert.match(html, /shared\/realm-ui\.mjs/);
assert.match(app, /mountPuzzle\(/);
assert.match(css, /min-width:\s*44px/);

console.log("time-cargo-bay: Fifteen rules, real tutorial states, persistence contract and mobile controls passed.");
