import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS } from "./levels.mjs";
import { BLACK, UNKNOWN, WHITE_MARK, beamForClue, createState, cycleMark, evaluateState, replayTimeline, restoreState, setMark, solveLevel, validateLevel } from "./logic.mjs";
import { createRunId, createSession, normalizeSession, readJsonResult, STORAGE_KEYS, STORAGE_PREFIX, writeJson } from "./storage.mjs";
import { createCompletion, deliverCompletion, enqueueCompletion, loadCompletionOutbox, removeCompletion, validCompletion } from "./completion.mjs";

let assertions = 0;
const check = (value, message = "expected truthy value") => { assertions += 1; assert.ok(value, message); };
const equal = (left, right, message) => { assertions += 1; assert.equal(left, right, message); };
const deep = (left, right, message) => { assertions += 1; assert.deepEqual(left, right, message); };
const throws = (fn, expected, message) => { assertions += 1; assert.throws(fn, expected, message); };

equal(LEVELS.length, 5, "Eclipse Watch publishes five fixed inspection files");
for (const level of LEVELS) {
  deep(validateLevel(level), [], `${level.id} is structurally valid`);
  const oracle = solveLevel(level, { limit: 2 });
  equal(oracle.count, 1, `${level.id} has exactly one independent black/white layout`);
  equal(oracle.truncated, false, `${level.id} oracle fully exhausts before a second solution`);
  deep(oracle.solutions[0], level.solution, `${level.id} independent result matches its regression fixture`);
  check(evaluateState(level, { marks: level.solution }).complete, `${level.id} fixture satisfies all Range rules`);
  equal(level.solution.filter((mark) => mark === BLACK).length, level.par, `${level.id} reference action count equals required black shadows`);
}

const tutorial = LEVELS[0];
const initial = createState(tutorial);
equal(evaluateState(tutorial, initial).complete, false, "initial reading field is not an early win");
const clue = setMark(tutorial, initial, 6, BLACK);
equal(clue.changed, false, "a number-light is permanently white and cannot be blackened");
equal(setMark(tutorial, initial, -1, BLACK).changed, false, "negative cell is an atomic no-op");
equal(setMark(tutorial, initial, 0, 2).changed, false, "invalid state marker is an atomic no-op");
const blackAction = setMark(tutorial, initial, 2, BLACK);
equal(blackAction.changed, true, "an unknown square accepts a black shadow");
equal(blackAction.state.moves, 1, "placing a black shadow counts one efficiency action");
const beforeBeam = beamForClue(tutorial, initial, 12);
const afterBeam = beamForClue(tutorial, blackAction.state, 12);
equal(beforeBeam.count, 9, "true initial beam count is available in real time");
equal(afterBeam.count, 8, "mark:2:1 truly shortens reading 12 from nine to eight");
const whiteAction = setMark(tutorial, initial, 0, WHITE_MARK);
equal(whiteAction.changed, true, "an unknown square accepts a white-dot note");
equal(whiteAction.state.moves, 0, "white-dot notes do not count as reward moves");
deep(beamForClue(tutorial, whiteAction.state, 12), beforeBeam, "a white-dot note cannot alter a light beam");
equal(evaluateState(tutorial, whiteAction.state).complete, false, "a white-dot note cannot turn an incorrect black layout into a win");
let allNotes = initial;
for (let cell = 0; cell < allNotes.marks.length; cell += 1) if (!tutorial.clueByCell[cell]) allNotes = setMark(tutorial, allNotes, cell, WHITE_MARK).state;
equal(evaluateState(tutorial, allNotes).complete, false, "a board full of white-dot notes is still not a solved inspection");
const same = setMark(tutorial, whiteAction.state, 0, WHITE_MARK);
equal(same.changed, false, "setting the same white note is an atomic no-op");
const cycle = cycleMark(tutorial, initial, 0);
equal(cycle.state.marks[0], BLACK, "forward cycle begins unknown → black");
equal(cycleMark(tutorial, cycle.state, 0).state.marks[0], WHITE_MARK, "forward cycle continues black → white note");
let adjacency = setMark(tutorial, initial, 0, BLACK).state;
adjacency = setMark(tutorial, adjacency, 1, BLACK).state;
check(evaluateState(tutorial, adjacency).errors.some((error) => error.type === "adjacent-black"), "orthogonally adjacent black shadows are rejected");
const barrierMarks = Array.from({ length: 25 }, (_, cell) => tutorial.clueByCell[cell] ? WHITE_MARK : UNKNOWN);
barrierMarks[1] = BLACK; barrierMarks[5] = BLACK;
check(evaluateState(tutorial, { marks: barrierMarks }).errors.some((error) => error.type === "disconnected-white"), "white connectivity remains a global constraint even with other errors");

const solveTimeline = tutorial.solution.flatMap((mark, cell) => mark === BLACK ? [{ type: "mark", cell, mark: BLACK }] : []);
const solvedReplay = replayTimeline(tutorial, solveTimeline);
check(solvedReplay?.evaluation.complete, "black-only formal replay reaches the actual win predicate");
equal(solvedReplay.state.moves, tutorial.par, "only black actions count in the completion efficiency score");
const notesThenSolved = replayTimeline(tutorial, [{ type: "mark", cell: 0, mark: WHITE_MARK }, ...solveTimeline]);
check(notesThenSolved?.evaluation.complete && notesThenSolved.state.moves === tutorial.par, "notes restore but remain absent from the score and win proof");
equal(replayTimeline(tutorial, [...solveTimeline, solveTimeline.at(-1)]), null, "a replayed no-op cannot pad a certified history");
deep(restoreState(tutorial, { marks: tutorial.solution, moves: 1 }), createState(tutorial), "forged move count cannot restore a solved answer");
const clueBlack = [...tutorial.solution]; clueBlack[6] = BLACK;
deep(restoreState(tutorial, { marks: clueBlack, moves: 3 }), createState(tutorial), "a forged black clue square cannot restore");

class MemoryStorage { constructor() { this.values = new Map(); } getItem(key) { return this.values.has(key) ? this.values.get(key) : null; } setItem(key, value) { this.values.set(key, String(value)); } }
class ThrowingStorage extends MemoryStorage { getItem() { throw new Error("blocked"); } setItem() { throw new Error("blocked"); } }
equal(STORAGE_PREFIX, "ten-realms-v3:games:eclipse-watch:", "storage stays in the isolated V3 game namespace");
check(Object.values(STORAGE_KEYS).every((key) => key.startsWith(STORAGE_PREFIX)), "all private keys share the game-specific prefix");
const freshSession = createSession(tutorial, "eclipse-watch-test-1");
check(normalizeSession(freshSession, LEVELS), "fresh replayable session restores");
equal(normalizeSession({ ...freshSession, runId: "forged" }, LEVELS), null, "invalid run identity is rejected");
const solvedSession = { ...freshSession, state: solvedReplay.state, timeline: solveTimeline, completed: true };
check(normalizeSession(solvedSession, LEVELS)?.completed, "replay derives completion independently from persisted flag");
equal(normalizeSession({ ...solvedSession, timeline: [] }, LEVELS), null, "solved state without a black-history proof is rejected");
equal(normalizeSession({ ...freshSession, completed: true }, LEVELS)?.completed, false, "forged completed flag cannot award a win");
equal(writeJson("x", {}, null), false, "missing storage is not falsely durable");
equal(readJsonResult("x", null, new ThrowingStorage()).available, false, "blocked storage does not crash the game");
check(createRunId(2000, 8).startsWith("eclipse-watch-"), "run ids retain the game slug");

const completion = createCompletion(tutorial, solvedSession, "2026-09-02T00:00:00.000Z");
equal(completion.eventId, "eclipse-watch:eclipse-watch-test-1:complete", "completion event identity is stable per run");
check(validCompletion(completion), "canonical replay-proof completion validates");
equal(validCompletion({ ...completion, moves: completion.moves + 1 }), false, "forged score cannot validate independent of replay");
equal(validCompletion({ ...completion, timeline: completion.timeline.slice(1) }), false, "shortened black history cannot validate");
throws(() => createCompletion(tutorial, freshSession, "2026-09-02T00:00:00.000Z"), TypeError, "unsolved session cannot be completed");
const outbox = new MemoryStorage();
check(enqueueCompletion(outbox, completion).retained, "completion is written before delivery");
check(enqueueCompletion(outbox, completion).retained, "retry retains the same event id idempotently");
equal(loadCompletionOutbox(outbox).length, 1, "outbox does not duplicate the stable event");
const calls = [];
const target = { TenRealmsV3: { complete(payload) { calls.push(`v3:${payload.eventId}`); } }, RealmArcade: { complete(payload) { calls.push(`compat:${payload.eventId}`); } } };
equal(deliverCompletion(target, completion).transport, "ten-realms-v3", "native V3 bridge is preferred");
deep(calls, [`v3:${completion.eventId}`], "only one host bridge receives the completion");
equal(deliverCompletion(target, completion).transport, "deduped", "same stable event never delivers twice");
check(removeCompletion(outbox, completion.eventId).removed, "accepted outbox record can be removed");
const offline = {};
check(deliverCompletion(offline, completion).queued, "missing bridge retains a compatibility queue");
check(deliverCompletion(offline, completion).queued, "queue retry stays safe");
equal(offline.__realmCompletionQueue.length, 1, "queue has one copy of stable event");

const here = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(here, "index.html"), "utf8");
const app = await readFile(path.join(here, "app.mjs"), "utf8");
const css = await readFile(path.join(here, "styles.css"), "utf8");
check(html.includes('data-realm="eclipse-watch"'), "entry declares canonical realm slug");
check(html.includes('href="../../"'), "entry returns to V3 guide");
check(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"), "shared realm UI loads before local app");
check(html.includes('id="tutorial-button"'), "native tutorial button keeps its frozen id");
check(app.includes("${GAME_ID}:${session.runId}:complete") || app.includes("eclipse-watch:${session.runId}:complete"), "completion id is run-stable");
check(app.includes("enqueueCompletion(storageAvailable ? storage : null, payload)"), "app persists outbox before delivery");
check(!app.includes("localStorage.clear"), "game never clears unrelated storage");
check(css.includes("min-height: 44px"), "touch targets meet the baseline");
check(css.includes("@media (max-width: 340px)"), "320px responsive layout is explicit");
check(css.includes("prefers-reduced-motion"), "reduced motion is supported");

const tutorialFiles = ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"];
const states = ["initial", "action", "solved"];
for (let index = 0; index < tutorialFiles.length; index += 1) {
  const svg = await readFile(path.join(here, "assets", tutorialFiles[index]), "utf8");
  check(svg.startsWith("<svg"), `${tutorialFiles[index]} is an SVG`);
  check(svg.includes('data-level-id="first-umbra"'), `${tutorialFiles[index]} names the real tutorial file`);
  check(svg.includes(`data-state="${states[index]}"`), `${tutorialFiles[index]} declares a true rule state`);
  check(svg.includes('viewBox="0 0 640 360"') && svg.includes('preserveAspectRatio="xMidYMid meet"'), `${tutorialFiles[index]} preserves its proportion`);
  check(svg.includes("role=\"img\"") && svg.includes("<title"), `${tutorialFiles[index]} has semantic labeling`);
}
const actionSvg = await readFile(path.join(here, "assets", "tutorial-action.svg"), "utf8");
check(actionSvg.includes('data-action="mark:2:1"') && actionSvg.includes('data-focus-clue="12"'), "tutorial action and highlighted light are tied to real engine state");
const goalSvg = await readFile(path.join(here, "assets", "tutorial-goal.svg"), "utf8");
check(goalSvg.includes(`data-solution="${tutorial.solution.join(",")}"`) && goalSvg.includes('data-complete="true"'), "tutorial goal pins the verified answer");

console.log(`Eclipse Watch: ${assertions} assertions passed.`);
