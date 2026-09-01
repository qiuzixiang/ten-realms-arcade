import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  CELL, applyMove, createState, evaluateState, legalMoves, moveKey, pegCount,
  replayMoves, solvePegs, validateLevel, validateMove,
} from "./logic.mjs";
import { DIFFICULTIES, LEVELS, TUTORIAL_ACTION, TUTORIAL_INITIAL_CRANES, TUTORIAL_LEVEL_ID, findLevel, levelsForDifficulty } from "./levels.mjs";
import {
  STORAGE_KEYS, STORAGE_PREFIX, createRunId, defaultRecords, loadOutbox, loadRecords,
  loadSession, loadSettings, markTutorialSeen, recordCompletion, saveRecords,
  saveSession, saveSettings, tutorialSeen,
} from "./storage.mjs";
import { createCompletionPayload, flushOutbox, publishCompletion, publishPersistedCompletion, validateCompletionPayload } from "./completion.mjs";

let assertions = 0;
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const deepEqual = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const rejects = (fn, expected) => { assertions += 1; assert.throws(fn, expected); };

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values),
  };
}

equal(LEVELS.length, 6, "ships six fixed boards");
deepEqual(DIFFICULTIES.map((item) => item.id), ["easy", "medium", "hard"]);
for (const difficulty of DIFFICULTIES) equal(levelsForDifficulty(difficulty.id).length, 2, `${difficulty.id} has two boards`);
equal(TUTORIAL_LEVEL_ID, "dawn-perch-101");
equal(TUTORIAL_ACTION, "3,0>3,2");
equal(TUTORIAL_INITIAL_CRANES, 8);

for (const level of LEVELS) {
  check(validateLevel(level), `${level.id} contract is valid`);
  equal(findLevel(level.id), level);
  const initial = createState(level);
  const initialCount = pegCount(initial);
  equal(level.solution.length, initialCount - 1, `${level.id} witness length follows invariant`);
  let cursor = initial;
  for (const encoded of level.solution) {
    const before = pegCount(cursor);
    const result = applyMove(cursor, encoded);
    check(result.changed, `${level.id} witness move ${encoded} is legal`);
    equal(pegCount(result.state), before - 1, "every legal jump removes exactly one crane");
    equal(result.state.moveCount, cursor.moveCount + 1, "legal move increments once");
    cursor = result.state;
  }
  const evaluation = evaluateState(cursor);
  equal(evaluation.cranes, 1);
  check(evaluation.complete, `${level.id} witness ends with one crane`);
  const independent = solvePegs(initial, { limit: 1, nodeLimit: 500_000 });
  check(!independent.truncated, `${level.id} DFS finishes`);
  equal(independent.count, 1, `${level.id} DFS proves at least one solution`);
  let searched = initial;
  for (const encoded of independent.solutions[0]) searched = applyMove(searched, encoded).state;
  check(evaluateState(searched).complete, `${level.id} independent DFS path completes`);
}

const tutorial = LEVELS[0];
const tutorialInitial = createState(tutorial);
const tutorialAction = applyMove(tutorialInitial, TUTORIAL_ACTION);
check(tutorialAction.changed);
equal(pegCount(tutorialAction.state), 7);
deepEqual([
  tutorialAction.state.cells.slice(0, 5).join(""),
  tutorialAction.state.cells.slice(5, 10).join(""),
  tutorialAction.state.cells.slice(10, 15).join(""),
  tutorialAction.state.cells.slice(15, 20).join(""),
  tutorialAction.state.cells.slice(20, 25).join(""),
], ["#PP.#", "##P.#", "##PPP", "#P..#", "#####"]);
const tutorialGoal = replayMoves(tutorial, tutorial.solution);
check(evaluateState(tutorialGoal).complete);
equal(pegCount(tutorialGoal), 1);
deepEqual([
  tutorialGoal.cells.slice(0, 5).join(""), tutorialGoal.cells.slice(5, 10).join(""),
  tutorialGoal.cells.slice(10, 15).join(""), tutorialGoal.cells.slice(15, 20).join(""),
  tutorialGoal.cells.slice(20, 25).join(""),
], ["#...#", "##..#", "##P..", "#...#", "#####"]);

const minimal = { id: "minimal-board", difficulty: "easy", title: "Minimal", seed: "fixed", board: ["PP."], solution: ["0,0>2,0"] };
const minimalState = createState(minimal);
equal(legalMoves(minimalState).length, 1);
const minimalResult = applyMove(minimalState, minimal.solution[0]);
check(minimalResult.changed);
check(evaluateState(minimalResult.state).complete, "one remaining at non-centre position wins");
equal(minimalResult.state.cells.join(""), "..P");

const invalidMoves = [
  { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
  { from: { x: 0, y: 0 }, to: { x: 2, y: 1 } },
  { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
  { from: { x: 2, y: 0 }, to: { x: 0, y: 0 } },
];
for (const move of invalidMoves) {
  check(!validateMove(minimalState, move).legal);
  const result = applyMove(minimalState, move);
  check(!result.changed);
  equal(result.state, minimalState, "invalid input is atomic no-op");
  equal(result.state.moveCount, 0);
}
rejects(() => createState({ board: ["P?."] }), /Unknown Pegs cell/);
rejects(() => createState({ board: ["P"] }), /at least two/);
equal(replayMoves(tutorial, ["bad"]), null);
equal(replayMoves(tutorial, ["3,0>3,2", "3,0>3,2"]), null);

check(STORAGE_PREFIX.startsWith("ten-realms-v2:games:paper-crane-sanctuary:"));
for (const key of Object.values(STORAGE_KEYS)) check(key.startsWith(STORAGE_PREFIX));
const store = memoryStorage();
deepEqual(loadSettings(store), { version: 1, difficulty: "easy", muted: false, lastLevelId: null });
check(saveSettings(store, { difficulty: "hard", muted: true, lastLevelId: LEVELS[5].id }));
deepEqual(loadSettings(store), { version: 1, difficulty: "hard", muted: true, lastLevelId: LEVELS[5].id });
equal(tutorialSeen(store), false);
check(markTutorialSeen(store));
equal(tutorialSeen(store), true);
const runId = createRunId(tutorial.id, 1_700_000_000_000, .25);
check(/^run-dawn-perch-101-/.test(runId));
const sessionState = tutorialAction.state;
const session = { level: tutorial, runId, moves: [TUTORIAL_ACTION], state: sessionState, elapsedMs: 3456, undoCount: 1, restartCount: 0, completion: null };
check(saveSession(store, session));
const loaded = loadSession(store, findLevel);
equal(loaded.level, tutorial);
equal(loaded.runId, runId);
deepEqual(loaded.moves, [TUTORIAL_ACTION]);
deepEqual(loaded.state.cells, sessionState.cells, "session is rebuilt from moves");
store.setItem(STORAGE_KEYS.session, JSON.stringify({ ...JSON.parse(store.getItem(STORAGE_KEYS.session)), moves: ["3,0>3,2", "3,0>3,2"] }));
equal(loadSession(store, findLevel), null, "forged illegal history is rejected");
store.setItem(STORAGE_KEYS.session, "not json");
equal(loadSession(store, findLevel), null);

check(saveSession(store, session));
const incompleteRaw = JSON.parse(store.getItem(STORAGE_KEYS.session));
const staleCompletion = { runId, eventId: `paper-crane-sanctuary:${runId}:complete`, completedAt: "2026-09-01T00:00:00.000Z", delivered: true };
store.setItem(STORAGE_KEYS.session, JSON.stringify({ ...incompleteRaw, completion: staleCompletion }));
equal(loadSession(store, findLevel), null, "an unsolved replay cannot restore a completion marker");
equal(saveSession(store, { ...session, completion: staleCompletion }), false, "an unsolved replay cannot save a completion marker");

const completed = replayMoves(tutorial, tutorial.solution);
const payload = createCompletionPayload({ level: tutorial, runId, state: completed, moves: tutorial.solution, elapsedMs: 9000, undoCount: 0, restartCount: 0, completedAt: "2026-09-01T00:00:00.000Z" });
check(validateCompletionPayload(payload));
equal(payload.eventId, `paper-crane-sanctuary:${runId}:complete`);
equal(payload.moves, 7);
deepEqual(payload.timeline, [...tutorial.solution], "completion freezes the official replayable move timeline");
check(Object.isFrozen(payload.timeline));
equal(payload.realm, "paper-crane-sanctuary");
equal(Object.hasOwn(payload, "par"), false, "Pegs never emits a fake par");
check(payload.metricNote.includes("not an optimisation score"));
rejects(() => createCompletionPayload({ level: tutorial, runId, state: tutorialInitial, moves: [], elapsedMs: 10 }), /verified completed/);
rejects(() => createCompletionPayload({ level: tutorial, runId, state: { ...completed, moveCount: 1 }, moves: tutorial.solution, elapsedMs: 10 }), /verified completed/);
equal(validateCompletionPayload({ ...payload, moves: 1 }), false, "forged move count cannot disagree with replay");
equal(validateCompletionPayload({ ...payload, timeline: [] }), false, "completion without a solving timeline is rejected");
equal(validateCompletionPayload({ ...payload, puzzleSeed: "forged" }), false, "completion is pinned to the official puzzle seed");

let records = defaultRecords();
let award = recordCompletion(records, payload);
check(award.changed); check(award.firstClear); check(award.noUndo);
records = award.records;
equal(records.levels[tutorial.id].wins, 1);
award = recordCompletion(records, payload);
equal(award.changed, false, "same event is idempotent");
equal(award.records.levels[tutorial.id].wins, 1);
check(saveRecords(store, records));
equal(loadRecords(store).levels[tutorial.id].wins, 1);

const deliveryStore = memoryStorage();
const calls = [];
const target = { RealmArcade: { complete(value) { calls.push(value); } } };
let delivery = publishCompletion(target, deliveryStore, payload);
check(delivery.delivered); equal(calls.length, 1); equal(loadOutbox(deliveryStore).length, 0);
delivery = publishCompletion(target, deliveryStore, payload);
check(delivery.delivered); equal(calls.length, 1, "same page retries do not redeliver");

const failureStore = memoryStorage();
const failingTarget = { RealmArcade: { complete() { throw new Error("offline"); } } };
delivery = publishCompletion(failingTarget, failureStore, payload);
check(delivery.retained); equal(delivery.delivered, false);
equal(loadOutbox(failureStore).length, 1);
equal(failingTarget.__realmCompletionQueue.length, 1);
publishCompletion(failingTarget, failureStore, payload);
equal(loadOutbox(failureStore).length, 1, "outbox deduplicates event id");
equal(failingTarget.__realmCompletionQueue.length, 1, "window queue deduplicates event id");
const retryCalls = [];
failingTarget.RealmArcade.complete = (value) => retryCalls.push(value);
const flushed = flushOutbox(failingTarget, failureStore);
equal(flushed.length, 1); equal(retryCalls.length, 1);
equal(loadOutbox(failureStore).length, 0); equal(failingTarget.__realmCompletionQueue.length, 0);
let unavailableCalls = 0;
const unavailableTarget = { RealmArcade: { complete() { unavailableCalls += 1; } } };
delivery = publishCompletion(unavailableTarget, null, payload);
equal(delivery.retained, false); equal(delivery.delivered, false); equal(unavailableCalls, 0, "missing durable storage prevents host delivery");
const failingStorage = { getItem: () => null, setItem() { throw new Error("quota"); }, removeItem: () => false };
delivery = publishCompletion(unavailableTarget, failingStorage, payload);
equal(delivery.retained, false); equal(delivery.delivered, false); equal(unavailableCalls, 0, "failed durable write prevents host delivery");
const gatedStore = memoryStorage();
let gatedCalls = 0;
const gatedTarget = { RealmArcade: { complete() { gatedCalls += 1; } } };
delivery = publishPersistedCompletion(gatedTarget, gatedStore, payload, { recordsSaved: false, sessionSaved: true });
equal(delivery.retained, false); equal(gatedCalls, 0, "a records-only write failure blocks the host"); equal(loadOutbox(gatedStore).length, 0);
delivery = publishPersistedCompletion(gatedTarget, gatedStore, payload, { recordsSaved: true, sessionSaved: false });
equal(delivery.retained, false); equal(gatedCalls, 0, "a session-only write failure blocks the host"); equal(loadOutbox(gatedStore).length, 0);
delivery = publishPersistedCompletion(gatedTarget, gatedStore, payload, { recordsSaved: true, sessionSaved: true });
check(delivery.delivered); equal(gatedCalls, 1, "the host is called only after both local settlement writes");
const forgedOutboxStore = memoryStorage({ [STORAGE_KEYS.outbox]: JSON.stringify([{ ...payload, moves: 1 }]) });
equal(loadOutbox(forgedOutboxStore).length, 0, "forged pending payload is discarded before flush");
let forgedHostCalls = 0;
equal(flushOutbox({ RealmArcade: { complete() { forgedHostCalls += 1; } } }, forgedOutboxStore).length, 0);
equal(forgedHostCalls, 0, "forged pending payload never reaches the shared host");

const bulkStore = memoryStorage();
const bulkTarget = {};
const bulkPayloads = Array.from({ length: 160 }, (_, index) => createCompletionPayload({
  level: tutorial,
  runId: `paper-bulk-run-${String(index).padStart(4, "0")}`,
  state: completed,
  moves: tutorial.solution,
  elapsedMs: 9000 + index,
  undoCount: 0,
  restartCount: 0,
  completedAt: "2026-09-01T06:00:00.000Z",
}));
let bulkRecords = defaultRecords();
for (const item of bulkPayloads) {
  check(publishCompletion(bulkTarget, bulkStore, item).retained);
  bulkRecords = recordCompletion(bulkRecords, item).records;
}
equal(loadOutbox(bulkStore).length, bulkPayloads.length, "long offline periods retain every private outbox event");
equal(bulkTarget.__realmCompletionQueue.length, bulkPayloads.length, "compatibility queue does not evict an older event");
equal(Object.keys(bulkRecords.settledEvents).length, bulkPayloads.length, "settled ledger keeps every stable event id");
equal(recordCompletion(bulkRecords, bulkPayloads[0]).changed, false, "the oldest settled event remains idempotent");

const base = fileURLToPath(new URL("./", import.meta.url));
const files = {};
for (const name of ["index.html", "styles.css", "app.mjs", "logic.mjs", "levels.mjs", "storage.mjs", "completion.mjs", "completion-proof.mjs", "RULES.md"]) files[name] = await readFile(`${base}${name}`, "utf8");
check(/<html[^>]+data-realm="paper-crane-sanctuary"/.test(files["index.html"]));
check(/href="\.\.\/\.\.\/"/.test(files["index.html"]));
check(/id="tutorial-button"/.test(files["index.html"]));
check(files["index.html"].indexOf("../../shared/realm-ui.mjs") < files["index.html"].indexOf("./app.mjs"), "shared UI loads before app");
check(/min-width:\s*44px/.test(files["styles.css"]));
check(/min-height:\s*44px/.test(files["styles.css"]));
check(/\.back-link\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s.test(files["styles.css"]));
check(/overflow-x:\s*hidden/.test(files["styles.css"]));
check(/prefers-reduced-motion/.test(files["styles.css"]));
check(!/localStorage\.clear\s*\(/.test(Object.values(files).join("\n")));
check(/RealmArcade\.complete/.test(files["completion.mjs"]));
check(/normalizeCompletionPayload/.test(files["completion-proof.mjs"]), "completion proof owns the shared payload normalizer");
check(/outbox:v1/.test(files["storage.mjs"]));
check(files["app.mjs"].includes('addEventListener("realm:ready"'));
check(files["app.mjs"].includes('addEventListener("ten-realms-v2:realm-ready"'));
check(files["app.mjs"].includes("session.completion = null"), "undoing a completed run clears its frozen completion state");
check(files["app.mjs"].includes("session.runId = createRunId(level.id)"), "undoing a completed run creates an independent settlement identity");
check(files["app.mjs"].includes("state, moves: session.moves"), "live completion freezes the same replayed session timeline");
check(files["app.mjs"].includes("evaluateState(state).complete && !session.completion?.delivered"), "solved sessions with a false marker are repaired after refresh or realm-ready");
const completeRunSource = files["app.mjs"].slice(files["app.mjs"].indexOf("function completeRun"), files["app.mjs"].indexOf("function undo"));
check(completeRunSource.indexOf("const recordsSaved = saveRecords") < completeRunSource.indexOf("publishPersistedCompletion"), "records persistence precedes live host delivery");
check(completeRunSource.indexOf("const sessionSaved = persist") < completeRunSource.indexOf("publishPersistedCompletion"), "the pending session marker precedes live host delivery");
check(/session\.completion\?\.completedAt[\s\S]*?records\.settledEvents\[eventId\][\s\S]*?new Date\(\)/.test(completeRunSource), "records-only partial-write recovery preserves the stable completion timestamp");
check(/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/.test(files["RULES.md"]));
check(/不设置“最少步数”/.test(files["RULES.md"]));

const svgChecks = [
  ["tutorial-elements.svg", "initial", "data-cranes=\"8\"", "data-board=\"#PPP#\|##PP#\|##P\.P\|#P\.\.#\|#####\""],
  ["tutorial-operation.svg", "operation", "data-action=\"3,0&amp;gt;3,2\"|data-action=\"3,0&gt;3,2\"", "data-after-cranes=\"7\""],
  ["tutorial-goal.svg", "complete", "data-cranes=\"1\"", "data-complete=\"true\""],
];
for (const [name, stateName, ...markers] of svgChecks) {
  const svg = await readFile(`${base}assets/${name}`, "utf8");
  check(/^<svg[\s\S]*<\/svg>\s*$/.test(svg), `${name} is standalone SVG`);
  check(/viewBox="0 0 720 420"/.test(svg));
  check(new RegExp(`data-level-id="${TUTORIAL_LEVEL_ID}"`).test(svg));
  check(new RegExp(`data-state="${stateName}"`).test(svg));
  check(/data-tutorial-version="1"/.test(svg));
  for (const marker of markers) check(new RegExp(marker).test(svg), `${name} contains ${marker}`);
}
for (const asset of ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]) check(files["app.mjs"].includes(`./assets/${asset}?tutorial=1`));

console.log(`纸鹤归巢台：${assertions} assertions passed`);
