import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CELL,
  COLLECTION_VERSION,
  DIFFICULTIES,
  HISTORY_LIMIT,
  LEVELS,
  SESSION_VERSION,
  applyCellState,
  applyStroke,
  cluesForLine,
  cluesForRows,
  countSolutions,
  createCollection,
  createPuzzle,
  createSession,
  currentDailyStreak,
  cycleCell,
  dailyLevelFor,
  evaluateGrid,
  findLevel,
  isStrictGrid,
  lineAnalysis,
  linePatterns,
  levelsForDifficulty,
  localDayKey,
  mergeCollections,
  normalizeCollection,
  normalizeGrid,
  normalizeSession,
  recordCollectionCompletion,
  solvePuzzle,
  strokeIndices,
  transformRows,
  validateClues,
} from "./logic.mjs";
import {
  confirmPhotoCompletion,
  recordPhotoCompletionOnce,
  restorePhotoCompletionFlags,
} from "./session.mjs";
import { REALM_TUTORIALS, tutorialArt } from "../../shared/tutorial-data.mjs";

const tests = [];
function test(name, callback) {
  tests.push({ name, callback });
}

function solvedGrid(level) {
  return level.solution.map((value) => value ? CELL.FILLED : CELL.EXCLUDED);
}

function unknownGrid(level) {
  return Array(level.width * level.height).fill(CELL.UNKNOWN);
}

test("three states are mutually exclusive and Enter/Space cycles are exact inverses", () => {
  assert.deepEqual(CELL, { UNKNOWN: 0, FILLED: 1, EXCLUDED: 2 });
  assert.equal(new Set(Object.values(CELL)).size, 3);
  assert.equal(cycleCell(CELL.UNKNOWN), CELL.FILLED);
  assert.equal(cycleCell(CELL.FILLED), CELL.EXCLUDED);
  assert.equal(cycleCell(CELL.EXCLUDED), CELL.UNKNOWN);
  assert.equal(cycleCell(CELL.UNKNOWN, true), CELL.EXCLUDED);
  assert.equal(cycleCell(CELL.EXCLUDED, true), CELL.FILLED);
  assert.equal(cycleCell(CELL.FILLED, true), CELL.UNKNOWN);
  for (const state of Object.values(CELL)) {
    assert.equal(cycleCell(cycleCell(state), true), state);
  }
  assert.equal(cycleCell(99), CELL.UNKNOWN);
});

test("clues preserve run order, edge runs, empty lines, and multi-digit lengths", () => {
  assert.deepEqual(cluesForLine([]), []);
  assert.deepEqual(cluesForLine("....."), []);
  assert.deepEqual(cluesForLine("#####"), [5]);
  assert.deepEqual(cluesForLine("##..#.#"), [2, 1, 1]);
  assert.deepEqual(cluesForLine("#..###..##"), [1, 3, 2]);
  assert.deepEqual(cluesForLine("############"), [12]);
  assert.throws(() => cluesForLine(null), TypeError);

  const derived = cluesForRows(["#..", ".##"]);
  assert.equal(derived.width, 3);
  assert.equal(derived.height, 2);
  assert.deepEqual(derived.rowClues, [[1], [2]]);
  assert.deepEqual(derived.columnClues, [[1], [1], [1]]);
  assert.throws(() => cluesForRows([]), TypeError);
  assert.throws(() => cluesForRows(["##", "#"]), TypeError);
  assert.throws(() => cluesForRows(["#x"]), TypeError);
});

test("clue validation accepts empty lines and rejects non-positive or overfull runs", () => {
  assert.equal(validateClues(5, []), true);
  assert.equal(validateClues(5, [5]), true);
  assert.equal(validateClues(5, [2, 2]), true);
  assert.equal(validateClues(5, [2, 2, 1]), false);
  assert.equal(validateClues(5, [0]), false);
  assert.equal(validateClues(5, [-1]), false);
  assert.equal(validateClues(5, [1.5]), false);
  assert.equal(validateClues(0, []), false);
});

test("line enumeration separates possible partial lines from exact completed matches", () => {
  assert.deepEqual(linePatterns(3, []), [[0, 0, 0]]);
  assert.deepEqual(linePatterns(3, [3]), [[1, 1, 1]]);
  assert.deepEqual(linePatterns(3, [1]), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  assert.equal(linePatterns(5, [1, 1]).length, 6);

  const possible = lineAnalysis([CELL.FILLED, CELL.UNKNOWN, CELL.UNKNOWN], [1]);
  assert.equal(possible.possible, true);
  assert.equal(possible.decided, false);
  assert.equal(possible.matches, false, "UNKNOWN may be possible but must never count as an exact line");

  const exact = lineAnalysis([CELL.FILLED, CELL.EXCLUDED, CELL.EXCLUDED], [1]);
  assert.equal(exact.matches, true);
  const emptyExact = lineAnalysis([CELL.EXCLUDED, CELL.EXCLUDED], []);
  assert.equal(emptyExact.matches, true);
  const emptyUnknown = lineAnalysis([CELL.UNKNOWN, CELL.EXCLUDED], []);
  assert.equal(emptyUnknown.possible, true);
  assert.equal(emptyUnknown.matches, false);
  const impossible = lineAnalysis([CELL.FILLED, CELL.FILLED], [1]);
  assert.equal(impossible.possible, false);
});

test("victory requires every cell decided and every row and column clue exact", () => {
  const diagonal = createPuzzle({
    id: "diagonal-test",
    title: "Diagonal",
    difficulty: "contact",
    solutionRows: ["#.", ".#"],
  }, { proveUnique: false });
  const solved = [CELL.FILLED, CELL.EXCLUDED, CELL.EXCLUDED, CELL.FILLED];
  assert.equal(evaluateGrid(diagonal, solved).complete, true);

  const blackOnly = [CELL.FILLED, CELL.UNKNOWN, CELL.UNKNOWN, CELL.FILLED];
  const blackOnlyResult = evaluateGrid(diagonal, blackOnly);
  assert.equal(blackOnlyResult.rows.every((row) => row.possible), true);
  assert.equal(blackOnlyResult.columns.every((column) => column.possible), true);
  assert.equal(blackOnlyResult.complete, false, "correct black cells with unknown whites must not win");

  const allWhite = Array(4).fill(CELL.EXCLUDED);
  assert.equal(evaluateGrid(diagonal, allWhite).complete, false);
  const wrongDiagonal = [CELL.EXCLUDED, CELL.FILLED, CELL.FILLED, CELL.EXCLUDED];
  assert.equal(evaluateGrid(diagonal, wrongDiagonal).complete, true, "any full assignment matching an ambiguous external clue set wins upstream");

  const emptyRow = createPuzzle({
    id: "empty-row-test",
    title: "Empty row",
    difficulty: "contact",
    solutionRows: ["...", "###"],
  }, { proveUnique: false });
  const missingWhite = solvedGrid(emptyRow);
  missingWhite[0] = CELL.UNKNOWN;
  assert.equal(evaluateGrid(emptyRow, solvedGrid(emptyRow)).complete, true);
  assert.equal(evaluateGrid(emptyRow, missingWhite).complete, false);
});

test("solver counts zero, one, and multiple solutions without reading stored photo pixels", () => {
  const unique = LEVELS[0];
  assert.equal(countSolutions(unique, 2), 1);
  assert.deepEqual(solvePuzzle(unique, 2)[0], [...unique.solution]);
  assert.doesNotMatch(solvePuzzle.toString(), /\.solution\b/);

  const ambiguous = createPuzzle({
    id: "ambiguous-test",
    title: "Ambiguous",
    difficulty: "contact",
    solutionRows: ["#.", ".#"],
  }, { proveUnique: false });
  assert.equal(countSolutions(ambiguous, 2), 2);
  assert.equal(countSolutions(ambiguous, 1), 1, "solution limit must stop enumeration");
  assert.deepEqual(solvePuzzle(ambiguous, 0), []);

  const impossible = {
    width: 2,
    height: 2,
    rowClues: [[2], [2]],
    columnClues: [[1], [1]],
  };
  assert.equal(countSolutions(impossible, 2), 0);
  assert.equal(countSolutions(unique, 2, Array(unique.width * unique.height).fill(CELL.FILLED)), 0);
});

test("the catalogue has three reproducible levels per difficulty and every one is solver-proven unique", () => {
  assert.equal(DIFFICULTIES.length, 3);
  assert.equal(LEVELS.length, 9);
  assert.equal(new Set(LEVELS.map(({ id }) => id)).size, 9);
  assert.equal(new Set(LEVELS.map(({ solutionRows }) => solutionRows.join("/"))).size, 9);
  const sizes = [];
  let assertions = 0;
  for (const difficulty of DIFFICULTIES) {
    const levels = levelsForDifficulty(difficulty.id);
    assert.equal(levels.length, 3);
    sizes.push(levels[0].width);
    for (const level of levels) {
      assert.equal(findLevel(level.id), level);
      assert.equal(level.unique, true);
      assert.equal(level.par, level.width * level.height);
      assert.equal(countSolutions(level, 2), 1);
      assert.deepEqual(solvePuzzle(level, 2)[0], [...level.solution]);
      const derived = cluesForRows(level.solutionRows);
      assert.deepEqual(level.rowClues, derived.rowClues);
      assert.deepEqual(level.columnClues, derived.columnClues);
      assert.equal(evaluateGrid(level, solvedGrid(level)).complete, true);
      assert.equal(evaluateGrid(level, unknownGrid(level)).complete, false);
      assertions += 8;
    }
  }
  assert.deepEqual(sizes, [5, 10, 15]);
  const longestColumnClue = Math.max(...LEVELS.flatMap((level) => level.columnClues.map((clues) => clues.length)));
  assert.ok(longestColumnClue >= 4, "archive levels should exercise genuinely long stacked column hints");
  assert.equal(assertions, 72);
});

test("photo transforms are deterministic and preserve dimensions", () => {
  const source = ["#..", ".##"];
  assert.deepEqual(transformRows(source), source);
  assert.deepEqual(transformRows(source, "mirror-horizontal"), ["..#", "##."]);
  assert.deepEqual(transformRows(source, "mirror-vertical"), [".##", "#.."]);
  assert.deepEqual(transformRows(source, "rotate-180"), ["##.", "..#"]);
  assert.throws(() => transformRows(source, "rotate-90"), TypeError);
});

test("atomic moves and strokes reject boundaries, preserve idempotence, and match upstream axis rules", () => {
  const level = LEVELS[0];
  const grid = unknownGrid(level);
  const out = applyCellState(level, grid, -1, CELL.FILLED);
  assert.equal(out.accepted, false);
  assert.equal(out.reason, "out-of-bounds");
  assert.deepEqual(out.grid, grid);
  assert.equal(applyCellState(level, grid, 0, 99).reason, "invalid-state");

  const filled = applyCellState(level, grid, 0, CELL.FILLED);
  assert.equal(filled.changed, true);
  assert.equal(filled.grid[0], CELL.FILLED);
  assert.equal(grid[0], CELL.UNKNOWN, "moves must not mutate their input");
  assert.equal(applyCellState(level, filled.grid, 0, CELL.FILLED).changed, false);

  assert.deepEqual(
    strokeIndices(level, { row: 2, column: 2 }, { row: 4, column: 4 }, CELL.FILLED),
    [12, 17, 22],
    "equal diagonal displacement snaps vertically",
  );
  assert.deepEqual(
    strokeIndices(level, { row: 2, column: 2 }, { row: 3, column: 9 }, CELL.EXCLUDED),
    [12, 13, 14],
    "horizontal dominance and out-of-board end coordinates clamp to the edge",
  );
  assert.deepEqual(
    strokeIndices(level, { row: 1, column: 1 }, { row: 2, column: 3 }, CELL.UNKNOWN),
    [6, 7, 8, 11, 12, 13],
    "unknown-state erasure uses an inclusive rectangle",
  );
  assert.deepEqual(strokeIndices(level, { row: -1, column: 0 }, { row: 0, column: 0 }, CELL.FILLED), []);

  const stroke = applyStroke(level, grid, { row: 0, column: 0 }, { row: 0, column: 2 }, CELL.FILLED);
  assert.equal(stroke.accepted, true);
  assert.equal(stroke.changedCount, 3);
  const noOp = applyStroke(level, stroke.grid, { row: 0, column: 0 }, { row: 0, column: 2 }, CELL.FILLED);
  assert.equal(noOp.changed, false);
  assert.equal(noOp.changedCount, 0);
});

test("daily film selection is stable for the local day and uses only declared levels", () => {
  const morning = new Date(2026, 7, 31, 8, 0);
  const evening = new Date(2026, 7, 31, 23, 59);
  assert.equal(localDayKey(morning), "2026-08-31");
  assert.equal(dailyLevelFor(morning).id, dailyLevelFor(evening).id);
  assert.ok(LEVELS.includes(dailyLevelFor(morning)));
  assert.equal(dailyLevelFor("not-a-date").unique, true);
});

test("photo collection unlocks first, flawless, reference, best, and daily streak only once", () => {
  const level = LEVELS[0];
  const firstDay = new Date(2026, 7, 31, 9, 0);
  const nextDay = new Date(2026, 8, 1, 9, 0);
  const first = recordCollectionCompletion(createCollection(), {
    levelId: level.id,
    moves: level.par,
    mistakes: 0,
    daily: true,
  }, firstDay);
  assert.equal(first.firstDevelopment, true);
  assert.equal(first.flawlessDevelopment, true);
  assert.equal(first.referenceDevelopment, true);
  assert.equal(first.dailyFirst, true);
  assert.equal(first.personalBest, false);
  assert.deepEqual(first.unlocks, ["照片入册", "无误显影", "参考曝光", "每日底片"]);
  assert.equal(first.streak, 1);

  const replay = recordCollectionCompletion(first.progress, {
    levelId: level.id,
    moves: level.par,
    mistakes: 0,
    daily: true,
  }, firstDay);
  assert.equal(replay.firstDevelopment, false);
  assert.equal(replay.flawlessDevelopment, false);
  assert.equal(replay.referenceDevelopment, false);
  assert.equal(replay.dailyFirst, false);
  assert.equal(replay.personalBest, false);
  assert.deepEqual(replay.unlocks, []);

  const better = recordCollectionCompletion(replay.progress, {
    levelId: level.id,
    moves: level.par - 1,
    mistakes: 2,
    daily: true,
  }, nextDay);
  assert.equal(better.personalBest, true);
  assert.equal(better.dailyFirst, true);
  assert.equal(better.streak, 2);
  assert.equal(currentDailyStreak(better.progress, nextDay), 2);
  assert.equal(currentDailyStreak(better.progress, new Date(2026, 8, 3, 9, 0)), 0);

  const unknown = recordCollectionCompletion(better.progress, { levelId: "constructor" }, nextDay);
  assert.equal(unknown.firstDevelopment, false);
  assert.deepEqual(unknown.progress, better.progress);
});

test("collection normalization discards forged ids, bad scores, duplicate days, and wrong versions", () => {
  const level = LEVELS[0];
  const normalized = normalizeCollection({
    version: COLLECTION_VERSION,
    completed: { [level.id]: true, stranger: true, constructor: true },
    flawless: { [level.id]: "yes" },
    reference: [],
    bestMoves: { [level.id]: 12, stranger: 1 },
    dailyDays: ["2026-08-31", "2026-08-31", "bad"],
  });
  assert.deepEqual(normalized.completed, { [level.id]: true });
  assert.deepEqual(normalized.flawless, {});
  assert.deepEqual(normalized.reference, {});
  assert.deepEqual(normalized.bestMoves, { [level.id]: 12 });
  assert.deepEqual(normalized.dailyDays, ["2026-08-31"]);
  assert.deepEqual(normalizeCollection({ version: 999 }), createCollection());
  assert.deepEqual(normalizeCollection(null), createCollection());
});

test("collection merging preserves monotonic unlocks and the best score across tabs", () => {
  const [first, second] = LEVELS;
  const left = {
    version: 1,
    completed: { [first.id]: true },
    flawless: { [first.id]: true },
    reference: {},
    bestMoves: { [first.id]: 27 },
    dailyDays: ["2026-08-29", "2026-08-30"],
  };
  const right = {
    version: 1,
    completed: { [second.id]: true },
    flawless: {},
    reference: { [first.id]: true },
    bestMoves: { [first.id]: 24, [second.id]: 30 },
    dailyDays: ["2026-08-30", "2026-08-31"],
  };
  const merged = mergeCollections(left, right);
  assert.deepEqual(Object.keys(merged.completed).sort(), [first.id, second.id].sort());
  assert.equal(merged.flawless[first.id], true);
  assert.equal(merged.reference[first.id], true);
  assert.equal(merged.bestMoves[first.id], 24);
  assert.equal(merged.bestMoves[second.id], 30);
  assert.deepEqual(merged.dailyDays, ["2026-08-29", "2026-08-30", "2026-08-31"]);
  assert.equal(JSON.stringify(merged), JSON.stringify(mergeCollections(right, left)));
});

test("session restoration round-trips valid state and safely rejects corrupt or forged saves", () => {
  const level = LEVELS[0];
  const session = createSession(level);
  session.grid[0] = CELL.FILLED;
  session.moves = 1;
  session.mistakes = level.solution[0] ? 0 : 1;
  session.tool = "exclude";
  session.muted = true;
  session.daily = true;
  session.dailyDay = "2026-08-31";
  session.history = [{
    grid: unknownGrid(level),
    moves: 0,
    mistakes: 0,
    completed: false,
    completionReported: false,
  }];
  const restored = normalizeSession(JSON.parse(JSON.stringify(session)));
  assert.equal(restored.restored, true);
  assert.equal(restored.invalid, false);
  assert.deepEqual(restored.session, session);

  assert.equal(normalizeSession({ version: SESSION_VERSION, levelId: "missing", grid: [] }).restored, false);
  assert.equal(normalizeSession({ ...session, grid: [CELL.UNKNOWN] }).invalid, true);
  assert.equal(normalizeSession({ ...session, grid: session.grid.map((value, index) => index ? value : 99) }).invalid, true);
  assert.equal(normalizeSession({ ...session, completed: true }).invalid, true, "a save cannot forge completion over an unfinished grid");
  assert.equal(normalizeSession({ version: 999 }).restored, false);

  const completed = { ...session, grid: solvedGrid(level), completed: true, completionReported: true };
  const completedRestore = normalizeSession(completed);
  assert.equal(completedRestore.restored, true);
  assert.equal(completedRestore.session.completed, true);
  assert.equal(completedRestore.session.completionReported, true);

  const damagedHistory = normalizeSession({ ...session, history: [{ grid: [1], moves: 0, mistakes: 0 }] });
  assert.equal(damagedHistory.restored, true);
  assert.equal(damagedHistory.invalid, true);
  assert.deepEqual(damagedHistory.session.history, []);
  assert.equal(HISTORY_LIMIT, 80);
  assert.equal(isStrictGrid(level, session.grid), true);
  assert.equal(isStrictGrid(level, [...session.grid, CELL.UNKNOWN]), false);
  assert.equal(normalizeGrid(level, [99]).every((state) => state === CELL.UNKNOWN), true);
});

test("a thrown shared reward retries after restore without repeating photo collection settlement", () => {
  const level = LEVELS[0];
  let state = createSession(level);
  state.grid = solvedGrid(level);
  state.moves = level.par;
  state.completed = true;
  state.completionRecorded = false;
  let recorderCalls = 0;
  const recorder = (progress, completion) => {
    recorderCalls += 1;
    return recordCollectionCompletion(progress, completion, new Date("2026-08-31T08:00:00Z"));
  };
  const local = recordPhotoCompletionOnce(state, createCollection(), {
    levelId: level.id,
    moves: state.moves,
    mistakes: 0,
    daily: false,
  }, recorder);
  state = local.state;
  assert.equal(local.recorded, true);
  assert.equal(recorderCalls, 1);
  assert.equal(local.collection.completed[level.id], true);

  const failed = confirmPhotoCompletion(state, () => {
    throw new Error("shared API unavailable");
  });
  assert.equal(failed.succeeded, false);
  assert.equal(failed.state.completionReported, false);

  const stored = JSON.parse(JSON.stringify({ ...failed.state, version: SESSION_VERSION }));
  const normalized = normalizeSession(stored);
  const restored = restorePhotoCompletionFlags(normalized.session, stored);
  assert.equal(restored.completionRecorded, true);
  assert.equal(restored.completionReported, false);
  const duplicateLocal = recordPhotoCompletionOnce(restored, local.collection, {
    levelId: level.id,
    moves: restored.moves,
    mistakes: restored.mistakes,
    daily: false,
  }, recorder);
  assert.equal(duplicateLocal.recorded, false);
  assert.equal(recorderCalls, 1);

  const queued = [];
  const retried = confirmPhotoCompletion(duplicateLocal.state, () => queued.push(level.id));
  assert.equal(retried.succeeded, true);
  assert.equal(retried.state.completionReported, true);
  assert.deepEqual(queued, [level.id]);
  assert.equal(recorderCalls, 1);
});

test("the shared tutorial exposes three distinct authentic nonogram states", () => {
  const tutorial = REALM_TUTORIALS["mist-photo-studio"];
  assert.equal(tutorial.version, 2);
  assert.equal(tutorial.cards.length, 3);
  const artwork = tutorial.cards.map(({ focus }) => tutorialArt("mist-photo-studio", focus));
  assert.equal(new Set(artwork).size, 3);
  for (const [index, art] of artwork.entries()) {
    assert.match(art, /^<svg\b/);
    assert.match(art, /preserveAspectRatio="xMidYMid meet"/);
    const stateLayers = ["art-elements", "art-action", "art-goal"]
      .filter((name) => art.includes(`class="${name}"`));
    assert.equal(stateLayers.length, 1, `tutorial card ${index + 1} should contain only its focused state`);
  }
  const copy = tutorial.cards.flatMap(({ title, body, bullets }) => [title, body, ...bullets]).join("\n");
  assert.match(copy, /黑格连续段/);
  assert.match(copy, /留白仍未知不算完成/);
  assert.match(artwork[0], /列提示/);
  assert.match(artwork[1], /显影 · F/);
  assert.match(artwork[1], /排除 · X/);
  assert.match(artwork[1], /未知 · Del/);
  assert.match(artwork[2], /全部明确/);
});

test("page wiring is offline, accessible, reward-safe, responsive, and visually distinguishes fill from exclusion", async () => {
  const [html, css, app] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
    readFile(new URL("./app.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(html, /<html[^>]+data-realm="mist-photo-studio"/);
  assert.match(html, /\.\.\/\.\.\/shared\/realm-ui\.css/);
  assert.match(html, /\.\.\/\.\.\/shared\/realm-ui\.mjs/);
  assert.match(html, /id="board" role="grid"/);
  assert.match(html, /id="lineStatus" role="status" aria-live="polite"/);
  assert.match(html, /id="contactSheet" role="region"[^>]+tabindex="0"/);
  assert.match(html, /id="toolFill"/);
  assert.match(html, /id="toolExclude"/);
  assert.match(html, /id="toolErase"/);
  assert.match(html, /id="undoButton"/);
  assert.match(html, /id="restartButton"/);
  assert.match(html, /id="newButton"/);
  assert.match(html, /id="muteButton"/);
  assert.match(html, /id="tutorialButton"/);
  assert.match(html, /puzzles\.ebnbin\.dev\/doc\/zh\/pattern\.html/);
  assert.match(html, /THIRD_PARTY_NOTICES\.md/);
  assert.doesNotMatch(html, /<(?:script|link|img|source)\b[^>]+(?:src|href)="https?:/i);

  assert.match(app, /new AudioContextClass\(\)/);
  assert.match(app, /window\.RealmArcade\?\.complete/);
  assert.match(app, /window\.__realmCompletionQueue/);
  assert.match(app, /if \(state\.completed && !state\.completionReported\)/);
  assert.match(app, /confirmPhotoCompletion\(state, reportRealmCompletion\)/);
  assert.doesNotMatch(app, /if \(state\.completed\) state\.completionReported = true/);
  assert.match(app, /if \(event\.altKey\) return/);
  assert.match(app, /window\.addEventListener\("storage"/);
  assert.match(app, /document\.querySelector\("dialog\[open\]"\)/);
  assert.match(app, /event\.key === "Enter"/);
  assert.match(app, /event\.key === " "/);
  assert.match(app, /event\.key === "Delete"/);
  assert.match(app, /event\.key === "Backspace"/);
  assert.match(app, /\["touch", "pen"\]\.includes\(event\.pointerType\)/);
  assert.match(app, /startDaily/);
  assert.match(app, /gridRow\.setAttribute\("role", "row"\)/);
  assert.match(app, /当前无可行排列/);

  assert.match(css, /\.grid-cell[\s\S]*?min-width:\s*44px/);
  assert.match(css, /\.grid-cell[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.board-viewport[\s\S]*?overflow:\s*auto/);
  assert.match(css, /\.column-clue[\s\S]*?position:\s*sticky/);
  assert.match(css, /\.row-clue[\s\S]*?position:\s*sticky/);
  assert.match(css, /\.grid-cell\[data-state="filled"\]/);
  assert.match(css, /\.grid-cell\[data-state="excluded"\]::before/);
  assert.match(css, /\.grid-cell\[data-column="4"\]/);
  assert.match(css, /\.grid-row\s*\{\s*display:\s*contents/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /content:\s*"×"/);
  assert.match(css, /@media \(max-width:\s*480px\)/);
  assert.match(css, /@media \(max-width:\s*340px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /overflow-x:\s*clip/);
});

test("compact photo boards show 5, 10, and 15 column negatives without horizontal scrolling", async () => {
  const [html, css, app] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
    readFile(new URL("./app.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(app, /function syncBoardScale\(\)/);
  assert.match(app, /\(availableWidth - rowClueWidth\) \/ level\.width/);
  assert.match(app, /Math\.max\(14, Math\.floor/);
  assert.match(app, /elements\.boardViewport\.scrollLeft = 0/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.board-viewport\s*{[^}]*overflow:\s*hidden/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.grid-cell,[\s\S]*?min-width:\s*0/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.nonogram-board\s*{[^}]*touch-action:\s*none/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.victory-photo\s*{[^}]*width:\s*min\(210px,\s*64vw\)/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.victory-actions\s*{[^}]*grid-template-columns:\s*1fr 1fr/);
  assert.match(html, /class="board-viewport"[^>]+aria-label="完整数织底片棋盘"/);
  assert.doesNotMatch(html, /id="boardViewport"[^>]+aria-label="[^"]*横向[^"]*滚动/);
  assert.match(html, /手机会自动缩放成完整棋盘/);
});

let passed = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

console.log(`Mist Photo Studio logic: ${passed}/${tests.length} tests passed; 9/9 photos solver-proven unique.`);
