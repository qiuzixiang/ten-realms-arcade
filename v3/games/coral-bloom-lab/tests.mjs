import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS } from "./levels.mjs";
import { createState, evaluateState, replayTimeline, restoreState, setValue, solveLevel, toggleCandidate, validateLevel } from "./logic.mjs";
import { createRunId, createSession, normalizeSession, readJsonResult, STORAGE_KEYS, STORAGE_PREFIX, writeJson } from "./storage.mjs";
import { createCompletion, deliverCompletion, enqueueCompletion, loadCompletionOutbox, removeCompletion, validCompletion } from "./completion.mjs";

let assertions = 0;
const check = (value, message = "expected truthy value") => { assertions += 1; assert.ok(value, message); };
const equal = (left, right, message) => { assertions += 1; assert.equal(left, right, message); };
const deep = (left, right, message) => { assertions += 1; assert.deepEqual(left, right, message); };
const throws = (fn, expected, message) => { assertions += 1; assert.throws(fn, expected, message); };

equal(LEVELS.length, 5, "Coral Bloom Lab publishes exactly five fixed pools");
for (const level of LEVELS) {
  deep(validateLevel(level), [], `${level.id} has a structurally valid rule contract`);
  const oracle = solveLevel(level, { limit: 2 });
  equal(oracle.count, 1, `${level.id} has one independent solution`);
  equal(oracle.truncated, false, `${level.id} search exhausted before the second solution`);
  deep(oracle.solutions[0], level.solution, `${level.id} independent solver agrees with the fixture without reading it`);
  const complete = evaluateState(level, { values: level.solution });
  check(complete.complete && complete.valid, `${level.id} fixture satisfies every capacity group`);
  equal(createState(level).values.filter((value) => value === 0).length, level.par, `${level.id} par equals the number of formal openings`);
}

const tutorial = LEVELS[0];
const initial = createState(tutorial);
equal(evaluateState(tutorial, initial).complete, false, "an incomplete nursery never wins");
const clue = setValue(tutorial, initial, 5, 4);
equal(clue.changed, false, "a fixed nucleus is an atomic no-op");
const outside = setValue(tutorial, initial, 99, 4);
equal(outside.changed, false, "out-of-board fill is an atomic no-op");
const invalidDigit = setValue(tutorial, initial, 0, 10);
equal(invalidDigit.changed, false, "digits outside 0–9 are an atomic no-op");
const legal = setValue(tutorial, initial, 0, 4);
equal(legal.changed, true, "an empty non-nucleus accepts a formal digit");
equal(legal.state.moves, 1, "formal filling increments moves exactly once");
equal(setValue(tutorial, legal.state, 0, 4).changed, false, "writing the same digit is an atomic no-op");
const candidate = toggleCandidate(tutorial, initial, 0, 4);
equal(candidate.changed, true, "an empty non-nucleus accepts a candidate");
equal(candidate.state.moves, 0, "candidate marks do not count as formal moves");
equal(evaluateState(tutorial, candidate.state).complete, false, "candidate marks never satisfy victory");
equal(toggleCandidate(tutorial, legal.state, 0, 2).changed, false, "a formal coral cannot hold candidate marks");
equal(toggleCandidate(tutorial, initial, 5, 2).changed, false, "a fixed nucleus cannot hold candidate marks");

let overflowing = initial;
for (const cell of [0, 1, 2, 3, 4]) overflowing = setValue(tutorial, overflowing, cell, 4).state;
check(evaluateState(tutorial, overflowing).errors.some((error) => error.type === "overflow"), "a five-cell 4 group receives an overflow warning");
const impossible = setValue(tutorial, initial, 0, 9).state;
check(evaluateState(tutorial, impossible).errors.some((error) => error.type === "trapped"), "a 9 group without nine reachable cells receives a trapped warning");
const solvedTimeline = tutorial.solution.flatMap((value, cell) => tutorial.givenByCell[cell] ? [] : [{ type: "fill", cell, value }]);
const solvedReplay = replayTimeline(tutorial, solvedTimeline);
check(solvedReplay?.evaluation.complete, "formal replay reaches the real win predicate");
equal(solvedReplay.state.moves, tutorial.par, "one formal fill is recorded for each opening");
equal(replayTimeline(tutorial, [...solvedTimeline, solvedTimeline.at(-1)]), null, "a no-op replay action cannot forge an additional move");
const erasedReplay = replayTimeline(tutorial, [{ type: "fill", cell: 0, value: 4 }, { type: "fill", cell: 0, value: 0 }]);
check(erasedReplay && erasedReplay.state.values[0] === 0 && erasedReplay.state.moves === 2, "clear is a replayable formal move");
deep(restoreState(tutorial, { values: tutorial.solution, notes: [], moves: 1 }), createState(tutorial), "malformed note array cannot restore an answer");
deep(restoreState(tutorial, { values: tutorial.solution.map((value, cell) => cell === 5 ? 1 : value), notes: Array(16).fill(0), moves: 2 }), createState(tutorial), "a changed nucleus cannot restore");

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}
class ThrowingStorage extends MemoryStorage { getItem() { throw new Error("blocked"); } setItem() { throw new Error("blocked"); } }

equal(STORAGE_PREFIX, "ten-realms-v3:games:coral-bloom-lab:", "private storage namespace is V3 and game-specific");
check(Object.values(STORAGE_KEYS).every((key) => key.startsWith(STORAGE_PREFIX)), "every private key stays inside the game namespace");
const freshSession = createSession(tutorial, "coral-bloom-lab-test-1");
check(normalizeSession(freshSession, LEVELS), "a fresh replayable session restores");
equal(normalizeSession({ ...freshSession, state: candidate.state }, LEVELS)?.state.notes[0], candidate.state.notes[0], "candidate notes persist only after formal state replay verifies");
equal(normalizeSession({ ...freshSession, runId: "forged" }, LEVELS), null, "a forged run id is rejected");
const solvedSession = { ...freshSession, state: solvedReplay.state, timeline: solvedTimeline, completed: true };
const normalizedSolved = normalizeSession(solvedSession, LEVELS);
check(normalizedSolved?.completed, "the replay—not a stored flag—derives completion");
equal(normalizeSession({ ...solvedSession, timeline: [] }, LEVELS), null, "a stored solved answer without its action proof is rejected");
equal(normalizeSession({ ...solvedSession, state: initial }, LEVELS), null, "a timeline/state mismatch is rejected");
equal(normalizeSession({ ...freshSession, completed: true }, LEVELS)?.completed, false, "a forged completed flag cannot create a win");
equal(writeJson("test", {}, null), false, "missing storage cannot be reported as durable");
equal(readJsonResult("test", null, new ThrowingStorage()).available, false, "blocked storage is surfaced without a crash");
check(createRunId(1000, 7).startsWith("coral-bloom-lab-"), "generated ids use the slug and stable format");

const completion = createCompletion(tutorial, solvedSession, "2026-09-02T00:00:00.000Z");
equal(completion.eventId, "coral-bloom-lab:coral-bloom-lab-test-1:complete", "completion event identity is stable for one run");
check(validCompletion(completion), "canonical completion proof validates");
equal(validCompletion({ ...completion, eventId: "coral-bloom-lab:forged:complete" }), false, "event identity cannot be swapped");
equal(validCompletion({ ...completion, timeline: completion.timeline.slice(1), moves: completion.moves - 1 }), false, "shortened replay cannot forge a win");
throws(() => createCompletion(tutorial, freshSession, "2026-09-02T00:00:00.000Z"), TypeError, "unsolved sessions cannot produce completion payloads");
const outbox = new MemoryStorage();
check(enqueueCompletion(outbox, completion).retained, "completion persists before bridge delivery");
check(enqueueCompletion(outbox, completion).retained, "same completion can retry idempotently");
equal(loadCompletionOutbox(outbox).length, 1, "outbox deduplicates stable event ids");
const calls = [];
const target = { TenRealmsV3: { complete(payload) { calls.push(`v3:${payload.eventId}`); } }, RealmArcade: { complete(payload) { calls.push(`compat:${payload.eventId}`); } } };
const delivered = deliverCompletion(target, completion);
equal(delivered.delivered, true, "primary V3 bridge receives a valid completion");
deep(calls, [`v3:${completion.eventId}`], "only one host API receives the completion");
equal(deliverCompletion(target, completion).transport, "deduped", "repeat delivery is ignored by stable event id");
check(removeCompletion(outbox, completion.eventId).removed, "accepted completion is removed from private outbox");
const offline = {};
equal(deliverCompletion(offline, completion).queued, true, "missing bridge retains one compatibility queue hint");
equal(deliverCompletion(offline, completion).queued, true, "queue retry remains safe");
equal(offline.__realmCompletionQueue.length, 1, "queue never duplicates a stable event");

const here = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(here, "index.html"), "utf8");
const app = await readFile(path.join(here, "app.mjs"), "utf8");
const css = await readFile(path.join(here, "styles.css"), "utf8");
check(html.includes('data-realm="coral-bloom-lab"'), "entry declares its canonical realm slug");
check(html.includes('href="../../"'), "entry has the canonical V3 return link");
check(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"), "shared realm UI loads before local app");
check(html.includes('id="tutorial-button"'), "native tutorial entry keeps the frozen id");
check(app.includes("coral-bloom-lab:${session.runId}:complete") || app.includes("${GAME_ID}:${session.runId}:complete"), "completion derives its run-stable id");
check(app.includes("enqueueCompletion(storageAvailable ? storage : null, payload)"), "app persists an outbox before bridge delivery");
check(!app.includes("localStorage.clear"), "app never clears unrelated browser storage");
check(css.includes("min-height: 44px"), "touch controls meet the 44px baseline");
check(/@media \(max-width: 560px\)[\s\S]*?\.capacity-panel \{[^}]*grid-template-columns: repeat\(3, minmax\(44px, 1fr\)\)/.test(css), "320px 下九个容量工具必须改为 3 列且每格不小于 44px");
check(css.includes("@media (max-width: 340px)"), "320px-specific responsive rules exist");
check(css.includes("prefers-reduced-motion"), "reduced-motion presentation is supported");

const tutorialFiles = ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"];
const states = ["initial", "action", "solved"];
for (let index = 0; index < tutorialFiles.length; index += 1) {
  const svg = await readFile(path.join(here, "assets", tutorialFiles[index]), "utf8");
  check(svg.startsWith("<svg"), `${tutorialFiles[index]} is an SVG asset`);
  check(svg.includes('data-level-id="tidal-nursery"'), `${tutorialFiles[index]} names the real tutorial level`);
  check(svg.includes(`data-state="${states[index]}"`), `${tutorialFiles[index]} declares its true state`);
  check(svg.includes('viewBox="0 0 640 360"') && svg.includes('preserveAspectRatio="xMidYMid meet"'), `${tutorialFiles[index]} preserves full proportions`);
  check(svg.includes("role=\"img\"") && svg.includes("<title"), `${tutorialFiles[index]} has semantic image labeling`);
}
const actionSvg = await readFile(path.join(here, "assets", "tutorial-action.svg"), "utf8");
check(actionSvg.includes('data-action="fill:0:4"'), "tutorial operation is the actual legal engine action");
const goalSvg = await readFile(path.join(here, "assets", "tutorial-goal.svg"), "utf8");
check(goalSvg.includes(`data-solution="${tutorial.solution.join(",")}"`) && goalSvg.includes('data-complete="true"'), "tutorial goal records the independently verified answer");

console.log(`Coral Bloom Lab: ${assertions} assertions passed.`);
