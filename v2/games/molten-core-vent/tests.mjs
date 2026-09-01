import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  ORIENTATION,
  actionKey,
  applyOrientation,
  countSolutions,
  createState,
  cycleOrientation,
  endpointsFor,
  evaluateState,
  parseAction,
  replayActions,
  stateFromSolution,
  validateLevel,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  TUTORIAL_ACTION,
  TUTORIAL_LEVEL_ID,
  findLevel,
  levelsForDifficulty,
} from "./levels.mjs";
import {
  STORAGE_KEYS,
  STORAGE_PREFIX,
  createRunId,
  defaultRecords,
  loadOutbox,
  loadRecords,
  loadSession,
  loadSettings,
  markTutorialSeen,
  recordCompletion,
  saveRecords,
  saveSession,
  saveSettings,
  tutorialSeen,
} from "./storage.mjs";
import {
  createCompletionPayload,
  flushOutbox,
  publishCompletion,
  publishPersistedCompletion,
  validateCompletionPayload,
} from "./completion.mjs";

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

function solutionActions(level, runUp = false) {
  const actions = [];
  if (runUp) actions.push("0,0:B", "0,0:F", "0,0:B");
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (runUp && x === 0 && y === 0) continue;
      actions.push(actionKey({ x, y, orientation: level.solution[y][x] }));
    }
  }
  return actions;
}

equal(LEVELS.length, 6, "ships six fixed molten-core levels");
deepEqual(DIFFICULTIES.map((item) => item.id), ["easy", "medium", "hard"]);
for (const difficulty of DIFFICULTIES) equal(levelsForDifficulty(difficulty.id).length, 2, `${difficulty.id} has two levels`);
equal(TUTORIAL_LEVEL_ID, "ember-gate-1101");
equal(TUTORIAL_ACTION, "0,0:B");

for (const level of LEVELS) {
  check(validateLevel(level), `${level.id} basic contract is valid`);
  check(validateLevel(level, { unique: true }), `${level.id} unique contract is valid`);
  equal(findLevel(level.id), level);
  const result = countSolutions(level, { limit: 2 });
  equal(result.truncated, false, `${level.id} uniqueness search finishes`);
  equal(result.count, 1, `${level.id} has exactly one solution`);
  deepEqual(result.solutions[0], [...level.solution], `${level.id} independent solution matches built-in witness`);

  const initial = createState(level);
  equal(initial.cells.length, level.width * level.height);
  equal(initial.moveCount, 0);
  check(initial.cells.every((value) => value === ORIENTATION.EMPTY));
  const initialEvaluation = evaluateState(level, initial);
  equal(initialEvaluation.filled, 0);
  equal(initialEvaluation.complete, false);
  equal(initialEvaluation.cycle, false);
  equal(initialEvaluation.clueErrors, 0);

  const actions = solutionActions(level);
  let cursor = initial;
  for (const encoded of actions) {
    const before = cursor.moveCount;
    const applied = applyOrientation(cursor, encoded);
    check(applied.changed, `${level.id} solution action ${encoded} changes the state`);
    equal(applied.state.moveCount, before + 1, "each changed orientation counts once");
    cursor = applied.state;
  }
  const evaluation = evaluateState(level, cursor);
  check(evaluation.complete, `${level.id} replayed solution completes`);
  equal(evaluation.filled, level.width * level.height);
  equal(evaluation.satisfiedClues, evaluation.totalClues);
  equal(evaluation.clueErrors, 0);
  equal(evaluation.cycle, false);
  equal(cursor.moveCount, level.width * level.height);
  deepEqual(cursor.cells, level.solution.join("").split(""));
  deepEqual(replayActions(level, actions).cells, cursor.cells, "action replay is deterministic");

  const direct = stateFromSolution(level);
  check(evaluateState(level, direct).complete, `${level.id} built-in state is truly complete`);
  deepEqual(direct.cells, cursor.cells);
  const prefixed = countSolutions(level, { state: applyOrientation(initial, actions[0]).state, limit: 2 });
  equal(prefixed.count, 1, `${level.id} remains unique after a correct prefill`);
  equal(prefixed.truncated, false);
}

const tutorial = findLevel(TUTORIAL_LEVEL_ID);
const tutorialInitial = createState(tutorial);
const tutorialInitialEvaluation = evaluateState(tutorial, tutorialInitial);
equal(tutorialInitialEvaluation.filled, 0);
equal(tutorialInitialEvaluation.totalCells, 16);
equal(tutorialInitialEvaluation.totalClues, 17);
equal(tutorialInitialEvaluation.satisfiedClues, 0);
equal(tutorialInitialEvaluation.clueErrors, 0);
const tutorialStep = applyOrientation(tutorialInitial, TUTORIAL_ACTION);
check(tutorialStep.changed);
equal(tutorialStep.state.cells[0], ORIENTATION.BACK);
equal(tutorialStep.state.moveCount, 1);
const tutorialStepEvaluation = evaluateState(tutorial, tutorialStep.state);
equal(tutorialStepEvaluation.filled, 1);
equal(tutorialStepEvaluation.satisfiedClues, 1);
equal(tutorialStepEvaluation.clueErrors, 0);
equal(tutorialStepEvaluation.cycle, false);
const topLeftClue = tutorialStepEvaluation.clues.find((clue) => clue.x === 0 && clue.y === 0);
deepEqual(topLeftClue, { x: 0, y: 0, target: 1, count: 1, remaining: 0, error: false, satisfied: true });
const tutorialGoal = stateFromSolution(tutorial);
const tutorialGoalEvaluation = evaluateState(tutorial, tutorialGoal);
equal(tutorialGoalEvaluation.filled, 16);
equal(tutorialGoalEvaluation.satisfiedClues, 17);
equal(tutorialGoalEvaluation.cycle, false);
check(tutorialGoalEvaluation.complete);
deepEqual(tutorial.solution, ["\\//\\", "////", "////", "\\\\\\\\"]);

deepEqual(endpointsFor(4, 1, 2, ORIENTATION.BACK), [{ x: 1, y: 2 }, { x: 2, y: 3 }]);
deepEqual(endpointsFor(4, 1, 2, ORIENTATION.FORWARD), [{ x: 2, y: 2 }, { x: 1, y: 3 }]);
deepEqual(endpointsFor(4, 1, 2, ORIENTATION.EMPTY), []);
equal(cycleOrientation(ORIENTATION.EMPTY), ORIENTATION.BACK);
equal(cycleOrientation(ORIENTATION.BACK), ORIENTATION.FORWARD);
equal(cycleOrientation(ORIENTATION.FORWARD), ORIENTATION.EMPTY);
equal(cycleOrientation(ORIENTATION.EMPTY, true), ORIENTATION.FORWARD);
equal(cycleOrientation(ORIENTATION.FORWARD, true), ORIENTATION.BACK);
equal(cycleOrientation(ORIENTATION.BACK, true), ORIENTATION.EMPTY);
deepEqual(parseAction("2,3:B"), { x: 2, y: 3, orientation: ORIENTATION.BACK });
deepEqual(parseAction("2,3:F"), { x: 2, y: 3, orientation: ORIENTATION.FORWARD });
deepEqual(parseAction("2,3:E"), { x: 2, y: 3, orientation: ORIENTATION.EMPTY });
equal(parseAction("-1,0:B"), null);
equal(parseAction("0,0:X"), null);
equal(actionKey({ x: 2, y: 3, orientation: ORIENTATION.BACK }), "2,3:B");

const invalidAction = applyOrientation(tutorialInitial, { x: -1, y: 0, orientation: ORIENTATION.BACK });
equal(invalidAction.changed, false);
equal(invalidAction.reason, "invalid-action");
equal(invalidAction.state, tutorialInitial, "invalid input is an atomic no-op");
const badOrientation = applyOrientation(tutorialInitial, { x: 0, y: 0, orientation: "X" });
equal(badOrientation.changed, false);
equal(badOrientation.state, tutorialInitial);
const sameOrientation = applyOrientation(tutorialStep.state, TUTORIAL_ACTION);
equal(sameOrientation.changed, false);
equal(sameOrientation.reason, "unchanged");
equal(sameOrientation.state, tutorialStep.state);
equal(replayActions(tutorial, [TUTORIAL_ACTION, TUTORIAL_ACTION]), null, "unchanged forged action is rejected");
equal(replayActions(tutorial, ["bad"]), null);
equal(replayActions(tutorial, Array(513).fill("0,0:B")), null);

const wrongFirst = applyOrientation(tutorialInitial, "0,0:F").state;
const wrongEvaluation = evaluateState(tutorial, wrongFirst);
check(wrongEvaluation.clueErrors >= 2, "a wrong top-left vane creates both shortage and overflow evidence");
const shortage = wrongEvaluation.clues.find((clue) => clue.x === 0 && clue.y === 0);
equal(shortage.target, 1); equal(shortage.count, 0); equal(shortage.remaining, 0); check(shortage.error);
const overflow = wrongEvaluation.clues.find((clue) => clue.x === 1 && clue.y === 0);
equal(overflow.target, 0); equal(overflow.count, 1); check(overflow.error);
equal(wrongEvaluation.complete, false);

const almostActions = solutionActions(tutorial).slice(0, -1);
const almost = replayActions(tutorial, almostActions);
equal(evaluateState(tutorial, almost).filled, 15);
equal(evaluateState(tutorial, almost).complete, false, "an unfilled board never wins");

const loopLevel = { width: 2, height: 2, clues: [[null, null, null], [null, null, null], [null, null, null]] };
const loopActions = ["0,0:F", "1,0:B", "1,1:F", "0,1:B"];
const loopState = replayActions(loopLevel, loopActions);
const loopEvaluation = evaluateState(loopLevel, loopState);
equal(loopEvaluation.filled, 4);
check(loopEvaluation.cycle, "a four-edge diamond is detected as a global loop");
check(loopEvaluation.cycleCells.size >= 1);
equal(loopEvaluation.complete, false, "a full clue-free loop never wins");
const inconsistentPrefill = countSolutions(loopLevel, { state: loopState, limit: 2 });
equal(inconsistentPrefill.count, 0);
equal(inconsistentPrefill.truncated, false);

rejects(() => createState({ width: 1, height: 2, clues: [[null, null], [null, null], [null, null]] }), /dimensions/);
rejects(() => createState({ width: 2, height: 2, clues: [[null], [null], [null]] }), /clues/);
rejects(() => stateFromSolution({ ...tutorial, solution: ["bad"] }), /solution/);
check(!validateLevel({ ...tutorial, id: "Bad ID" }));
check(!validateLevel({ ...tutorial, clues: [[9]] }));

check(STORAGE_PREFIX.startsWith("ten-realms-v2:games:molten-core-vent:"));
for (const key of Object.values(STORAGE_KEYS)) check(key.startsWith(STORAGE_PREFIX));
const store = memoryStorage();
deepEqual(loadSettings(store), { version: 1, difficulty: "easy", muted: false, lastLevelId: null });
check(saveSettings(store, { difficulty: "hard", muted: true, lastLevelId: LEVELS[5].id }));
deepEqual(loadSettings(store), { version: 1, difficulty: "hard", muted: true, lastLevelId: LEVELS[5].id });
equal(tutorialSeen(store), false);
check(markTutorialSeen(store));
equal(tutorialSeen(store), true);
const runId = createRunId(tutorial.id, 1_700_000_000_000, .25);
check(/^run-ember-gate-1101-/.test(runId));
const liveSession = { level: tutorial, runId, actions: [TUTORIAL_ACTION], state: tutorialStep.state, elapsedMs: 3456, undoCount: 1, restartCount: 2, conflictActions: 0, completion: null };
check(saveSession(store, liveSession));
let loaded = loadSession(store, findLevel);
equal(loaded.level, tutorial);
equal(loaded.runId, runId);
deepEqual(loaded.actions, [TUTORIAL_ACTION]);
deepEqual(loaded.state.cells, tutorialStep.state.cells, "session state is rebuilt from its action log");
equal(loaded.state.moveCount, 1);
equal(loaded.undoCount, 1);
equal(loaded.restartCount, 2);

const savedRaw = JSON.parse(store.getItem(STORAGE_KEYS.session));
store.setItem(STORAGE_KEYS.session, JSON.stringify({ ...savedRaw, cells: tutorial.solution, complete: true }));
loaded = loadSession(store, findLevel);
deepEqual(loaded.state.cells, tutorialStep.state.cells, "forged board fields are ignored in favour of replay");
store.setItem(STORAGE_KEYS.session, JSON.stringify({ ...savedRaw, actions: [TUTORIAL_ACTION, TUTORIAL_ACTION] }));
equal(loadSession(store, findLevel), null, "forged unchanged action history is rejected");
store.setItem(STORAGE_KEYS.session, "not json");
equal(loadSession(store, findLevel), null);

const fakeCompletion = { runId, eventId: `molten-core-vent:${runId}:complete`, completedAt: "2026-09-01T00:00:00.000Z", delivered: true };
const forgedCompleteSession = { ...liveSession, completion: fakeCompletion };
equal(saveSession(store, forgedCompleteSession), false, "completion marker on an incomplete replay is rejected when saving");
store.setItem(STORAGE_KEYS.session, JSON.stringify({ ...savedRaw, completion: fakeCompletion }));
equal(loadSession(store, findLevel), null, "completion marker on an incomplete replay is rejected when loading");

const solvedActions = solutionActions(tutorial);
const solvedState = replayActions(tutorial, solvedActions);
const payload = createCompletionPayload({ level: tutorial, runId, state: solvedState, actions: solvedActions, elapsedMs: 9000, conflictActions: 0, undoCount: 0, completedAt: "2026-09-01T00:00:00.000Z" });
check(validateCompletionPayload(payload));
equal(payload.eventId, `molten-core-vent:${runId}:complete`);
equal(payload.moves, 16);
deepEqual(payload.timeline, solvedActions, "completion freezes the official replayable action timeline");
check(Object.isFrozen(payload.timeline));
equal(payload.realm, "molten-core-vent");
equal(payload.noConflict, true);
equal(payload.noUndo, true);
equal(Object.hasOwn(payload, "par"), false, "Slant completion never invents a par score");
rejects(() => createCompletionPayload({ level: tutorial, runId, state: tutorialInitial, actions: [], elapsedMs: 10 }), /verified completed/);
rejects(() => createCompletionPayload({ level: tutorial, runId: "bad", state: solvedState, actions: solvedActions, elapsedMs: 10 }), /verified completed/);
rejects(() => createCompletionPayload({ level: tutorial, runId, state: { ...solvedState, moveCount: 1 }, actions: solvedActions, elapsedMs: 10 }), /verified completed/);
equal(validateCompletionPayload({ ...payload, moves: 1 }), false, "forged move count cannot disagree with replay");
equal(validateCompletionPayload({ ...payload, timeline: [] }), false, "completion without a solving timeline is rejected");
equal(validateCompletionPayload({ ...payload, puzzleSeed: "forged" }), false, "completion is pinned to the official puzzle seed");
const solvedSession = { level: tutorial, runId, actions: solvedActions, state: solvedState, elapsedMs: 9000, undoCount: 0, restartCount: 0, conflictActions: 0, completion: fakeCompletion };
check(saveSession(store, solvedSession));
loaded = loadSession(store, findLevel);
check(evaluateState(loaded.level, loaded.state).complete);
equal(loaded.completion.eventId, fakeCompletion.eventId);

let records = defaultRecords();
const longRunId = createRunId(tutorial.id, 1_700_000_000_001, .26);
const longState = replayActions(tutorial, solutionActions(tutorial, true));
equal(longState.moveCount, 18);
const longActions = solutionActions(tutorial, true);
const longPayload = createCompletionPayload({ level: tutorial, runId: longRunId, state: longState, actions: longActions, elapsedMs: 12000, conflictActions: 2, undoCount: 1, completedAt: "2026-09-01T00:01:00.000Z" });
let award = recordCompletion(records, longPayload);
check(award.changed); check(award.firstClear); equal(award.personalBest, false); equal(award.stable, false);
records = award.records;
equal(records.levels[tutorial.id].wins, 1);
equal(records.levels[tutorial.id].bestActions, 18);
award = recordCompletion(records, payload);
check(award.changed); equal(award.firstClear, false); check(award.personalBest); check(award.stable);
records = award.records;
equal(records.levels[tutorial.id].wins, 2);
equal(records.levels[tutorial.id].bestActions, 16);
check(records.stableLevels[tutorial.id]);
award = recordCompletion(records, payload);
equal(award.changed, false, "same completion event is idempotent");
equal(award.records.levels[tutorial.id].wins, 2);
const invalidAward = recordCompletion(records, { ...payload, eventId: "another", moves: 0 });
equal(invalidAward.changed, false, "zero-move forged reward is rejected");
check(saveRecords(store, records));
equal(loadRecords(store).levels[tutorial.id].wins, 2);

const deliveryStore = memoryStorage();
const calls = [];
const target = { RealmArcade: { complete(value) { calls.push(value); } } };
let delivery = publishCompletion(target, deliveryStore, payload);
check(delivery.retained); check(delivery.delivered); equal(delivery.transport, "realm-arcade");
equal(calls.length, 1); equal(loadOutbox(deliveryStore).length, 0);
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
equal(publishCompletion(null, failureStore, payload).retained, false);
equal(publishCompletion({}, failureStore, { ...payload, eventId: "forged" }).retained, false);
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
  runId: `molten-bulk-run-${String(index).padStart(4, "0")}`,
  state: solvedState,
  actions: solvedActions,
  elapsedMs: 9000 + index,
  conflictActions: 0,
  undoCount: 0,
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
check(/<html[^>]+data-realm="molten-core-vent"[^>]+data-game-version="2\.5"/.test(files["index.html"]));
check(/href="\.\.\/\.\.\/"/.test(files["index.html"]));
check(/id="tutorial-button"/.test(files["index.html"]));
check(files["index.html"].indexOf("../../shared/realm-ui.mjs") < files["index.html"].indexOf("./app.mjs"), "shared realm UI loads before the game app");
check(/min-width:\s*44px/.test(files["styles.css"]));
check(/min-height:\s*44px/.test(files["styles.css"]));
check(/overflow-x:\s*hidden/.test(files["styles.css"]));
check(/object-fit:\s*contain/.test(files["styles.css"]));
check(/prefers-reduced-motion/.test(files["styles.css"]));
check(/@media \(max-width: 340px\)/.test(files["styles.css"]));
check(/grid-template-columns:\s*repeat\(var\(--cols\),\s*minmax\(44px,\s*1fr\)\)/.test(files["styles.css"]), "board preserves 44px cells at the 320px baseline");
check(files["app.mjs"].includes('addEventListener("contextmenu"'));
check(files["app.mjs"].includes("elements.tutorialDialog.scrollTop = 0"), "tutorial card changes reset the dialog scroll container");
check(files["app.mjs"].includes("elements.tutorialSkip.focus({ preventScroll: true })"), "the tutorial receives an explicit initial focus target");
for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Backspace", "Delete"]) check(files["app.mjs"].includes(key), `keyboard contract includes ${key}`);
check(files["app.mjs"].includes('event.key === "\\\\"'));
check(files["app.mjs"].includes('event.key === "/"'));
check(files["app.mjs"].includes('addEventListener("realm:ready"'));
check(files["app.mjs"].includes('addEventListener("ten-realms-v2:realm-ready"'));
check(files["app.mjs"].includes("replayActions(level, session.actions)"));
check(files["app.mjs"].includes("state, actions: session.actions"), "live completion freezes the same replayed session timeline");
check(files["app.mjs"].includes("evaluateState(level, state).complete && !session.completion?.delivered"), "a solved crash-window session, including a false marker, is settled after refresh or realm-ready");
const finishRunSource = files["app.mjs"].slice(files["app.mjs"].indexOf("function finishRun"), files["app.mjs"].indexOf("function retryCompletionOutbox"));
check(finishRunSource.indexOf("const recordsSaved = saveRecords") < finishRunSource.indexOf("publishPersistedCompletion"), "records persistence precedes live host delivery");
check(finishRunSource.indexOf("const sessionSaved = saveCurrent") < finishRunSource.indexOf("publishPersistedCompletion"), "the pending session marker precedes live host delivery");
check(/session\.completion\?\.completedAt[\s\S]*?records\.settledEvents\[eventId\][\s\S]*?new Date\(\)/.test(finishRunSource), "records-only partial-write recovery preserves the stable completion timestamp");
check(!/localStorage\.clear\s*\(/.test(Object.values(files).join("\n")));
check(/RealmArcade\.complete/.test(files["completion.mjs"]));
check(/normalizeCompletionPayload/.test(files["completion-proof.mjs"]), "completion proof owns the shared payload normalizer");
check(/outbox:v1/.test(files["storage.mjs"]));
check(/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/.test(files["RULES.md"]));
check(/doc-zh\/slant\.html/.test(files["RULES.md"]));
check(/vendor\/sgtpuzzles\/slant\.c/.test(files["RULES.md"]));
check(/limit=2/.test(files["RULES.md"]));
check(/\u4e0d虚构 `par`/.test(files["RULES.md"]));

const svgChecks = [
  ["tutorial-elements.svg", "initial", 'data-filled="0"', 'data-total-clues="17"'],
  ["tutorial-operation.svg", "operation", 'data-action="0,0:B"', 'data-after-filled="1"', 'data-satisfied-clues="1"'],
  ["tutorial-goal.svg", "complete", 'data-complete="true"', 'data-filled="16"', 'data-satisfied-clues="17"', 'data-cycle="false"'],
];
for (const [name, stateName, ...markers] of svgChecks) {
  const svg = await readFile(`${base}assets/${name}`, "utf8");
  check(/^<svg[\s\S]*<\/svg>\s*$/.test(svg), `${name} is a standalone SVG`);
  check(/viewBox="0 0 720 420"/.test(svg));
  check(new RegExp(`data-game-id="molten-core-vent"`).test(svg));
  check(new RegExp(`data-level-id="${TUTORIAL_LEVEL_ID}"`).test(svg));
  check(new RegExp(`data-state="${stateName}"`).test(svg));
  check(/data-tutorial-version="1"/.test(svg));
  for (const marker of markers) check(svg.includes(marker), `${name} contains ${marker}`);
}
for (const asset of ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]) check(files["app.mjs"].includes(`./assets/${asset}?tutorial=1`));

console.log(`熔心泄压站：${assertions} assertions passed`);
