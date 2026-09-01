import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LEVELS } from "./levels.mjs";
import { analyse, applyColour, buildAdjacency, createState, replayColourTimeline, restoreState, solveLevel, toggleNote, validateLevel } from "./logic.mjs";
import { createSession, normalizeSession, readJsonResult, STORAGE_PREFIX, writeJson } from "./storage.mjs";
import { createCompletion, deliverCompletion, enqueueCompletion, knownLevelIds, loadCompletionOutbox, removeCompletion, validCompletion } from "./completion.mjs";

let assertions = 0;
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const deep = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const throws = (fn, expected, message) => { assertions += 1; assert.throws(fn, expected, message); };

equal(LEVELS.length, 6, "V2.5 Map must publish six levels");
for (const level of LEVELS) {
  check(validateLevel(level), `${level.id} must be structurally valid`);
  const solved = solveLevel(level, { limit: 2 });
  equal(solved.count, 1, `${level.id} must have exactly one independently found colouring`);
  deep(solved.solutions[0], level.solution, `${level.id} independent solution must match the fixture`);
  check(analyse({ colours: level.solution, notes: new Array(level.solution.length).fill(0), moves: level.par }, level).solved,
    `${level.id} fixture must satisfy the real completion predicate`);
  const initial = createState(level);
  equal(analyse(initial, level).solved, false, `${level.id} initial state must not win early`);
  equal(initial.colours.filter((colour) => colour < 0).length, level.par, `${level.id} par is the forced uncoloured count`);
}

const tutorial = LEVELS[0];
const initial = createState(tutorial);
const fixed = applyColour(initial, tutorial, 0, 2);
equal(fixed.changed, false, "fixed shrine cannot be recoloured");
const action = applyColour(initial, tutorial, 1, tutorial.solution[1]);
equal(action.changed, true, "tutorial action must be legal");
equal(action.state.moves, 1, "formal colouring counts one move");
equal(analyse(action.state, tutorial).solved, false, "one action is not an early victory");
const noted = toggleNote(initial, tutorial, 1, 2);
equal(noted.changed, true, "blank region accepts a candidate note");
equal(noted.state.moves, 0, "candidate notes do not count as moves");
equal(analyse(noted.state, tutorial).solved, false, "candidate notes never satisfy completion");

const pointTouch = [[0, 2], [1, 3]];
const pointEdges = buildAdjacency(pointTouch);
check(!pointEdges[0].includes(3), "regions touching only at a point are not adjacent");
check(!pointEdges[1].includes(2), "opposite point-only regions are not adjacent");
check(pointEdges[0].includes(1) && pointEdges[0].includes(2), "shared edges still create adjacency");

const forged = restoreState({ colours: tutorial.solution, notes: [], moves: 1 }, tutorial);
deep(forged, createState(tutorial), "malformed saved arrays fall back to a clean state");
const changedClue = { colours: [...initial.colours], notes: [...initial.notes], moves: 2 };
changedClue.colours[0] = 3;
deep(restoreState(changedClue, tutorial), createState(tutorial), "forged fixed shrine is rejected");
const session = createSession(tutorial, "run-test-1");
equal(normalizeSession(session, LEVELS)?.runId, "run-test-1", "valid run identity survives normalization");
equal(normalizeSession({ ...session, runId: "bad" }, LEVELS), null, "invalid run identity is rejected");
check(STORAGE_PREFIX.startsWith("ten-realms-v2:games:four-spirit-habitat:"), "private storage prefix is isolated");

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}
class ThrowingReadStorage extends MemoryStorage {
  getItem() { throw new Error("read blocked"); }
}
class ThrowingWriteStorage extends MemoryStorage {
  setItem() { throw new Error("quota"); }
}
const solvedTimeline = tutorial.solution.flatMap((colour, region) => (
  Object.hasOwn(tutorial.clues, String(region)) ? [] : [{ region, colour }]
));
const solvedState = replayColourTimeline(tutorial, solvedTimeline);
check(solvedState && analyse(solvedState, tutorial).solved, "completion timeline must replay through the real engine");
equal(solvedState.moves, tutorial.par, "one canonical formal action is required for each open region");
const solvedSession = {
  ...createSession(tutorial, "run-outbox-test"),
  state: solvedState,
  timeline: solvedTimeline,
  completed: true,
};
const repairedSession = normalizeSession({ ...solvedSession, completed: false, reported: "false" }, LEVELS);
equal(repairedSession.completed, true, "solved board repairs a stale false completion flag");
equal(repairedSession.reported, false, "a non-boolean reported marker cannot suppress settlement");
equal(writeJson("test", {}, null), false, "missing storage is never reported as a successful durable write");
const completion = createCompletion(tutorial, solvedSession, "2026-09-01T08:00:00.000Z");
equal(completion.eventId, "four-spirit-habitat:run-outbox-test:complete", "completion identity is stable for one run");
check(validCompletion(completion), "canonical completion validates");
equal(validCompletion({ ...completion, eventId: "forged" }), false, "forged completion identity is rejected");
equal(validCompletion({ ...completion, levelId: "missing-level" }), false, "unknown levels cannot enter the shared reward outbox");
equal(validCompletion({ ...completion, timeline: [], moves: 0 }), false, "an unplayed board cannot forge completion");
equal(validCompletion({ ...completion, timeline: completion.timeline.slice(0, 1), moves: 1 }), false, "a shortened fake timeline cannot claim the solved board");
throws(
  () => createCompletion(tutorial, createSession(tutorial, "run-unsolved-test"), "2026-09-01T08:00:00.000Z"),
  TypeError,
  "createCompletion must reject an unsolved session",
);
equal(normalizeSession({ ...solvedSession, timeline: [] }, LEVELS), null, "session restore must bind the solved board to its real timeline");
const forgedHistory = { ...solvedSession, history: [{ ...solvedState, moves: 0 }] };
equal(normalizeSession(forgedHistory, LEVELS), null, "undo history snapshots must match their timeline prefix");
deep(knownLevelIds(), LEVELS.map(({ id }) => id), "completion validator covers every published level");
const outboxStorage = new MemoryStorage();
check(enqueueCompletion(outboxStorage, completion).retained, "completion is persisted before delivery");
check(enqueueCompletion(outboxStorage, completion).retained, "same completion can be retried idempotently");
equal(loadCompletionOutbox(outboxStorage).length, 1, "durable outbox deduplicates by event id");
let calls = 0;
const throwingTarget = { RealmArcade: { complete() { calls += 1; throw new Error("offline"); } } };
let delivery = deliverCompletion(throwingTarget, completion);
equal(delivery.delivered, false, "a thrown shared bridge is not marked delivered");
equal(delivery.queued, true, "a thrown bridge keeps a compatibility queue copy");
delivery = deliverCompletion(throwingTarget, completion);
equal(throwingTarget.__realmCompletionQueue.length, 1, "retry keeps one queue copy for the stable event");
const accepted = [];
throwingTarget.RealmArcade.complete = (payload) => accepted.push(payload.eventId);
delivery = deliverCompletion(throwingTarget, loadCompletionOutbox(outboxStorage)[0]);
equal(delivery.delivered, true, "the same restored event is accepted when the bridge recovers");
deep(accepted, [completion.eventId], "refresh retry preserves the original event identity");
check(removeCompletion(outboxStorage, completion.eventId).removed, "accepted event is removed from the private outbox");
equal(loadCompletionOutbox(outboxStorage).length, 0, "no accepted event remains pending");
const unreadableStorage = new ThrowingReadStorage();
equal(readJsonResult("x", null, unreadableStorage).available, false, "a throwing storage read is reported unavailable");
equal(enqueueCompletion(unreadableStorage, completion).retained, false, "an unreadable outbox is never overwritten or treated as durable");
const unwritableStorage = new ThrowingWriteStorage();
equal(enqueueCompletion(unwritableStorage, completion).retained, false, "a failed outbox write blocks delivery eligibility");

const bulkStorage = new MemoryStorage();
const bulkTarget = {};
const bulkCompletions = Array.from({ length: 180 }, (_, index) => createCompletion(
  tutorial,
  { ...solvedSession, runId: `run-bulk-${String(index).padStart(4, "0")}` },
  "2026-09-01T09:00:00.000Z",
));
for (const item of bulkCompletions) {
  check(enqueueCompletion(bulkStorage, item).retained, "every pending completion must persist");
  check(deliverCompletion(bulkTarget, item).queued, "every compatibility event must remain queued");
}
equal(loadCompletionOutbox(bulkStorage).length, bulkCompletions.length, "private outbox never evicts an old pending event");
equal(loadCompletionOutbox(bulkStorage)[0].eventId, bulkCompletions[0].eventId);
equal(bulkTarget.__realmCompletionQueue.length, bulkCompletions.length, "compatibility queue never evicts an old pending event");

const here = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(here, "index.html"), "utf8");
const app = await readFile(path.join(here, "app.mjs"), "utf8");
const css = await readFile(path.join(here, "styles.css"), "utf8");
check(html.includes('data-realm="four-spirit-habitat"'), "page declares the canonical realm slug");
check(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"), "shared UI loads before game app");
check(html.includes('id="tutorial-button"'), "native tutorial entry is present");
check(app.includes('$(".tutorial-dialog[data-tutorial]")'), "native tutorial does not bind the shared dock button");
check(app.includes("four-spirit-habitat:${session.runId}:complete"), "completion uses a stable run event id");
check(app.includes("enqueueCompletion(storageAvailable ? storage : null, payload)"), "completion persists a private outbox before shared delivery");
check(app.includes('window.addEventListener("realm:ready", flushCompletionOutbox)'), "late shared bootstrap retries the durable outbox");
check(app.includes('window.addEventListener("ten-realms-v2:realm-ready", flushCompletionOutbox)'), "the V2 ready alias retries the durable outbox");
check(app.includes("session.timeline.push(formalAction)"), "formal moves are frozen into a replayable proof");
check(app.includes("if (analyse(session.state, level).solved) completeRun();"), "undoing back to a solved board immediately retries idempotent settlement");
check(app.includes("try { storage = window.localStorage; } catch { storage = null; }"), "disabled local storage cannot crash game startup");
check(!app.includes("localStorage.clear"), "game never clears unrelated storage");
check(css.includes("min-height: 44px"), "primary controls keep the touch target baseline");
check(/@media \(max-width: 340px\)[\s\S]*?main\s*\{\s*width:\s*100%/.test(css), "320px layout reclaims the full viewport for the 7x7 board");
check(/@media \(max-width: 340px\)[\s\S]*?\.board-wrap\s*\{[^}]*padding:\s*6px/.test(css), "7x7 cells retain at least 44px inside a 320px viewport");
check(/@media \(max-width: 340px\)[\s\S]*?scrollbar-width:\s*none/.test(css), "320px simulation reclaims overlay-scrollbar width for 44px board cells");
check(css.includes("prefers-reduced-motion"), "reduced motion is supported");

const tutorialFiles = ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"];
const expectedStates = ["initial", "action", "solved"];
for (let index = 0; index < tutorialFiles.length; index += 1) {
  const svg = await readFile(path.join(here, "assets", tutorialFiles[index]), "utf8");
  check(svg.includes('data-level-id="spirit-spring"'), `${tutorialFiles[index]} names the real tutorial level`);
  check(svg.includes(`data-state="${expectedStates[index]}"`), `${tutorialFiles[index]} names its real state`);
  check(svg.includes('preserveAspectRatio="xMidYMid meet"'), `${tutorialFiles[index]} preserves its full proportion`);
}
const actionSvg = await readFile(path.join(here, "assets", "tutorial-action.svg"), "utf8");
check(actionSvg.includes('data-action="paint:1:3"'), "tutorial action is tied to the legal engine move");
const goalSvg = await readFile(path.join(here, "assets", "tutorial-goal.svg"), "utf8");
check(goalSvg.includes('data-solution="0,3,1,0,2,0,3,3,2"'), "goal image identifies the independently verified solution");

console.log(`Four Spirit Habitat: ${assertions} assertions passed.`);
