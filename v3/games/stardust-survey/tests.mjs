import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS } from "./levels.mjs";
import {
  CELL, PHASE, canonicalMines, chordCell, createState, deriveNoGuessTimeline, flagCount, isWon, neighbors, numberGrid,
  replayTimeline, safeCellsLeft, scanCell, stateEquals, toggleMark, undoState, validateLevel,
} from "./logic.mjs";
import { createRunId, createSession, normalizeSession, readJsonResult, STORAGE_PREFIX, writeJson } from "./storage.mjs";
import {
  createCompletion, deliverCompletion, enqueueCompletion, loadCompletionOutbox, loadRecords, removeCompletion, settleLocalRecord, validCompletion,
} from "./completion.mjs";

let assertions = 0;
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const deep = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const throws = (fn, expected, message) => { assertions += 1; assert.throws(fn, expected, message); };

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}
class ThrowingReadStorage extends MemoryStorage { getItem() { throw new Error("read blocked"); } }
class ThrowingWriteStorage extends MemoryStorage { setItem() { throw new Error("quota"); } }

equal(LEVELS.length, 5, "V3.0 Stardust Survey exposes five fixed sectors");
for (const level of LEVELS) {
  check(validateLevel(level), `${level.id} recomputes as a valid no-guess sector`);
  const grid = numberGrid(level);
  equal(grid.length, level.width * level.height, `${level.id} has one eight-neighbor reading per cell`);
  deep(canonicalMines(level, [...level.mines].reverse()), level.mines, `${level.id} canonicalizes mine ordering without changing truth`);
  const proof = deriveNoGuessTimeline(level);
  check(Boolean(proof), `${level.id} has a local-inference proof`);
  equal(proof.timeline.length, level.par, `${level.id} par is the documented no-guess reference length`);
  check(proof.timeline.every((action) => action.type === "scan" || action.type === "mark"), `${level.id} proof only makes player-legal actions`);
  check(!proof.state.cells.includes(CELL.EXPLODED), `${level.id} proof never triggers a mine`);
  check(isWon(proof.state, level), `${level.id} proof reaches the real all-safe completion predicate`);
  equal(safeCellsLeft(proof.state, level), 0, `${level.id} completion leaves no safe cell hidden`);
  const replayed = replayTimeline(level, proof.timeline);
  check(replayed && stateEquals(replayed.state, proof.state), `${level.id} proof round-trips through the canonical timeline replayer`);
}

const tutorial = LEVELS[0];
deep(neighbors(tutorial, 6), [0, 1, 2, 5, 7, 10, 11, 12], "a center-ish cell uses every one of its eight actual neighbors");
deep(neighbors(tutorial, 0), [1, 5, 6], "corner topology does not invent out-of-bounds neighbors");
deep(numberGrid(tutorial), [0, 0, 0, 1, -1, 1, 1, 0, 1, 1, -1, 1, 0, 0, 0, 2, 2, 0, 1, 1, -1, 1, 0, 1, -1], "tutorial readings are recomputed from its fixed mine set");

const initial = createState(tutorial);
const zeroScan = scanCell(initial, tutorial, 0);
check(zeroScan.changed, "a covered first-safe sector scans");
equal(zeroScan.opened.length, 20, "tutorial zero scan expands its real 20-cell safe region");
deep([...zeroScan.opened].sort((a, b) => a - b), [0, 1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23], "zero cascade exactly opens the tutorial state shown in its SVG");
equal(zeroScan.state.moves, 1, "one scan costs one operation");
equal(zeroScan.state.scans, 1, "one scan is counted as one real scan");
equal(zeroScan.state.phase, PHASE.PLAYING, "partial zero expansion is not an early win");

const firstOnMine = scanCell(initial, tutorial, 4);
check(firstOnMine.changed && firstOnMine.relocated, "first scan on a fixed mine triggers deterministic safety relocation");
equal(firstOnMine.state.mines.length, tutorial.mines.length, "first-scan relocation preserves mine count");
check(!firstOnMine.state.mines.includes(4), "the clicked first scan is safe after relocation");
equal(firstOnMine.state.cells[4], CELL.REVEALED, "the first scanned mine position becomes a real revealed safe cell");
check(numberGrid(tutorial, firstOnMine.state.mines)[4] >= 0, "the relocated board recomputes the clicked reading instead of faking it");

const marked = toggleMark(zeroScan.state, tutorial, 4);
check(marked.changed, "a covered sector can receive a yellow analyst flag");
equal(marked.state.cells[4], CELL.MARKED, "mark mode leaves a flag rather than a reveal");
equal(marked.state.scans, zeroScan.state.scans, "flags do not count as scans");
equal(safeCellsLeft(marked.state, tutorial), safeCellsLeft(zeroScan.state, tutorial), "flags never satisfy the safe-cell win condition");
const unmarked = toggleMark(marked.state, tutorial, 4);
equal(unmarked.state.cells[4], CELL.COVERED, "a second mark action removes the note");

const chordLevel = { id: "chord-fixture", title: "", difficulty: "", tier: 1, seed: 18, width: 3, height: 3, mines: [0, 2], firstSafe: 4, par: 1 };
let chordState = scanCell(createState(chordLevel), chordLevel, 4).state;
equal(numberGrid(chordLevel)[4], 2, "chord fixture shows two neighboring perturbations");
chordState = toggleMark(chordState, chordLevel, 0).state;
chordState = toggleMark(chordState, chordLevel, 2).state;
const correctChord = chordCell(chordState, chordLevel, 4);
check(correctChord.changed && !correctChord.exploded.length, "matching marker count allows a safe chord");
check(isWon(correctChord.state, chordLevel), "correct chord can reveal every remaining safe cell");
let wrongChordState = scanCell(createState(chordLevel), chordLevel, 4).state;
wrongChordState = toggleMark(wrongChordState, chordLevel, 0).state;
wrongChordState = toggleMark(wrongChordState, chordLevel, 1).state;
const wrongChord = chordCell(wrongChordState, chordLevel, 4);
check(wrongChord.changed && wrongChord.exploded.includes(2), "wrong flags make a chord expose a real mine");
equal(wrongChord.state.phase, PHASE.LOST, "wrong chord transitions to failure");

const failure = scanCell(zeroScan.state, tutorial, 4);
equal(failure.state.phase, PHASE.LOST, "a later mine scan enters the failure phase");
deep(failure.state.errors, [4], "mine failure records a diagnostic index");
const undoneFailure = undoState(zeroScan.state, failure.state, tutorial);
equal(undoneFailure.phase, PHASE.PLAYING, "undo restores a playable position after a mine failure");
equal(undoneFailure.cells[4], CELL.COVERED, "undo restores the mine cell's playable cover state");
deep(undoneFailure.errors, [4], "undo intentionally retains the error diagnosis instead of erasing it");
equal(safeCellsLeft(undoneFailure, tutorial), safeCellsLeft(zeroScan.state, tutorial), "the historical error does not alter win truth");
const errorTimeline = [{ type: "scan", index: 0 }, { type: "scan", index: 4 }, { type: "undo" }];
const replayedError = replayTimeline(tutorial, errorTimeline);
check(replayedError && stateEquals(replayedError.state, undoneFailure), "replayer preserves error diagnostics through undo too");
equal(replayTimeline(tutorial, [{ type: "undo" }]), null, "undo without a successful preceding operation is rejected atomically");
equal(scanCell(zeroScan.state, tutorial, 0).changed, false, "scanning an already open cell is a no-op");

const proof = deriveNoGuessTimeline(tutorial);
const solvedSession = { ...createSession(tutorial, "run-completion-1"), state: proof.state, timeline: proof.timeline, completed: true };
const normalized = normalizeSession(solvedSession, LEVELS);
check(normalized && normalized.completed, "a valid solved session repairs completion from the real board");
equal(normalizeSession({ ...solvedSession, completed: false }, LEVELS)?.completed, true, "stored completed boolean cannot suppress a true replayed win");
equal(normalizeSession({ ...solvedSession, state: { ...proof.state, moves: 99 } }, LEVELS), null, "forged session move count cannot pass replay restoration");
equal(normalizeSession({ ...solvedSession, timeline: [{ type: "scan", index: 0 }], state: proof.state }, LEVELS), null, "shortened timeline cannot claim a solved board");
equal(normalizeSession({ ...solvedSession, state: { mines: [], cells: [], errors: [], moves: 0, scans: 0, phase: "ready" } }, LEVELS), null, "malformed saved state is not silently accepted as a fresh-looking completion");
equal(createRunId(1000, 0.25), "run-rs-hra0hs", "run identity is deterministic under supplied time and entropy");
check(STORAGE_PREFIX.startsWith("ten-realms-v3:games:stardust-survey:"), "storage prefix is private to this V3 game");

const completion = createCompletion(tutorial, solvedSession, 0, "2026-09-02T08:00:00.000Z");
equal(completion.eventId, "stardust-survey:run-completion-1:complete", "completion event identity is stable for its run");
check(validCompletion(completion), "all-safe replay is accepted as a canonical completion");
equal(validCompletion({ ...completion, moves: completion.moves + 1 }), false, "forged score cannot enter completion outbox");
equal(validCompletion({ ...completion, eventId: "other" }), false, "forged event identity cannot enter completion outbox");
equal(validCompletion({ ...completion, timeline: [] }), false, "empty timeline cannot fabricate an all-safe completion");
throws(() => createCompletion(tutorial, createSession(tutorial, "run-unsolved-1"), 0, "2026-09-02T08:00:00.000Z"), TypeError, "unsolved session cannot be converted to a completion");

const memory = new MemoryStorage();
const firstRecord = settleLocalRecord(memory, completion);
check(firstRecord.retained && firstRecord.firstClear, "local first-clear medal persists before delivery");
const duplicateRecord = settleLocalRecord(memory, completion);
check(duplicateRecord.retained && duplicateRecord.duplicate, "same local completion is idempotently deduplicated");
equal(loadRecords(memory).wins[tutorial.id].wins, 1, "duplicate settlement never increments local wins");
check(enqueueCompletion(memory, completion).retained, "canonical completion persists in the private outbox before host delivery");
check(enqueueCompletion(memory, completion).retained, "retry retains the same outbox event safely");
equal(loadCompletionOutbox(memory).length, 1, "outbox deduplicates by stable event id");
const tenCalls = [];
const realmCalls = [];
const canonicalHost = { TenRealmsV3: { complete(payload) { tenCalls.push(payload.eventId); } }, RealmArcade: { complete(payload) { realmCalls.push(payload.eventId); } } };
const delivered = deliverCompletion(canonicalHost, completion);
check(delivered.delivered && !delivered.queued, "canonical host accepts queued completion");
deep(tenCalls, [completion.eventId], "TenRealmsV3 receives exactly one canonical call");
deep(realmCalls, [], "legacy host is not also called after canonical delivery");
check(removeCompletion(memory, completion.eventId).removed, "delivered event is removed from private outbox");
equal(loadCompletionOutbox(memory).length, 0, "accepted outbox event no longer remains pending");
let legacyAttempts = 0;
const failingHost = { TenRealmsV3: { complete() { throw new Error("offline"); } }, RealmArcade: { complete() { legacyAttempts += 1; } } };
const deferred = deliverCompletion(failingHost, completion);
check(!deferred.delivered && deferred.queued, "failing canonical host keeps a compatibility queue copy");
equal(legacyAttempts, 0, "canonical failure does not double-send to a second host");
equal(failingHost.__realmCompletionQueue.length, 1, "compatibility queue also deduplicates stable event identity");
const unreadable = new ThrowingReadStorage();
equal(readJsonResult("x", null, unreadable).available, false, "blocked browser storage is reported unavailable");
equal(enqueueCompletion(unreadable, completion).retained, false, "unreadable outbox is never overwritten");
const unwritable = new ThrowingWriteStorage();
equal(enqueueCompletion(unwritable, completion).retained, false, "failed durable outbox write blocks delivery eligibility");
equal(writeJson("x", {}, null), false, "missing storage never reports a durable write");

const here = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(here, "index.html"), "utf8");
const app = await readFile(path.join(here, "app.mjs"), "utf8");
const css = await readFile(path.join(here, "styles.css"), "utf8");
const completionSource = await readFile(path.join(here, "completion.mjs"), "utf8");
check(html.includes('data-realm="stardust-survey"'), "page declares its canonical realm slug");
check(html.indexOf("../../shared/realm-ui.mjs") < html.indexOf("./app.mjs"), "shared bootstrap loads before game app");
check(html.includes('id="tutorial-button"'), "native tutorial entry button contract is present");
check(app.includes('const tutorialDialog = $(".tutorial-dialog[data-tutorial]")'), "game owns a native tutorial dialog rather than relying on a shared illustration");
check(app.includes("stardust-survey:${session.runId}:complete"), "app uses stable run-scoped completion identity");
check(app.includes("deliverCompletion(window, payload)") && completionSource.includes("target.TenRealmsV3 ?? target.RealmArcade"), "app supports the frozen V3 canonical host contract");
check(app.includes("errors.length") && app.includes("undoState"), "app exposes retained mine-failure diagnostics after undo");
check(!app.includes("localStorage.clear"), "app never clears unrelated browser storage");
check(css.includes("min-height: 44px"), "touch controls and board cells declare the 44px baseline");
check(/@media \(max-width: 340px\)[\s\S]*?\.survey-board\s*\{[^}]*width:\s*100%/.test(css), "320px layout gives the seven-column board its full viewport width");
check(/@media \(max-width: 340px\)[\s\S]*?\.survey-cell\s*\{[^}]*min-width:\s*44px/.test(css), "320px layout retains 44px survey targets");
check(css.includes("prefers-reduced-motion"), "reduced-motion state changes remain supported");

function attr(svg, name) {
  const match = svg.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1] ?? "";
}
function actionList(value) {
  return value.split(",").filter(Boolean).map((part) => {
    const [type, index] = part.split(":");
    return { type, index: Number(index) };
  });
}
const tutorialFiles = ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"];
const expectedStates = ["initial", "action", "solved"];
const svgContents = [];
for (let index = 0; index < tutorialFiles.length; index += 1) {
  const filename = path.join(here, "assets", tutorialFiles[index]);
  try {
    execFileSync("xmllint", ["--noout", filename], { stdio: "pipe" });
  } catch (error) {
    // GitHub's hosted image may omit xmllint. The structural and truth checks
    // below still validate every SVG; rethrow actual XML validation failures.
    if (error?.code !== "ENOENT") throw error;
  }
  const svg = await readFile(filename, "utf8");
  svgContents.push(svg);
  equal(attr(svg, "data-tutorial-level"), tutorial.id, `${tutorialFiles[index]} names its fixed real tutorial level`);
  equal(attr(svg, "data-state"), expectedStates[index], `${tutorialFiles[index]} names its distinct true state`);
  check(attr(svg, "data-action").length > 0, `${tutorialFiles[index]} exposes an audited action marker`);
  equal(attr(svg, "data-mines"), tutorial.mines.join(","), `${tutorialFiles[index]} carries the real mine layout metadata`);
  check(svg.includes('viewBox="0 0 800 450"') && svg.includes('preserveAspectRatio="xMidYMid meet"'), `${tutorialFiles[index]} preserves a complete 16:9 tutorial composition`);
}
equal(attr(svgContents[0], "data-action"), "none", "element card stays at a true initial state");
const svgAction = actionList(attr(svgContents[1], "data-action"));
deep(svgAction, [{ type: "scan", index: 0 }], "action card invokes the real player scan action");
const svgActionState = replayTimeline(tutorial, svgAction)?.state;
deep([...svgActionState.cells.entries()].filter(([, cell]) => cell === CELL.REVEALED).map(([index]) => index).join(","), attr(svgContents[1], "data-revealed"), "action SVG's visible-safe cells exactly match engine replay");
const svgGoal = replayTimeline(tutorial, actionList(attr(svgContents[2], "data-timeline")));
check(svgGoal && isWon(svgGoal.state, tutorial), "goal SVG timeline reaches a genuine all-safe winning state");
equal(safeCellsLeft(svgGoal.state, tutorial), 0, "goal SVG has no hidden safe cells");
equal(flagCount(svgGoal.state), 4, "goal SVG's four displayed flags are a reachable real state");
equal(attr(svgContents[2], "data-safe-revealed"), "21", "goal SVG declares the actual safe-cell count");

console.log(`Stardust Survey: ${assertions} assertions passed.`);
