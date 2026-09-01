import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  awardCompletion,
  badgeRulesForRealm,
  createProgress,
  localDayKey,
  masteryTargetFor,
  mergeProgress,
  normalizeProgress,
  progressSummary,
} from "./reward-engine.mjs";
import { REALM_TUTORIALS, tutorialArt } from "./tutorial-data.mjs";
import {
  evaluatePosition as evaluateFireflyPosition,
  LEVELS as FIREFLY_LEVELS,
} from "../games/firefly-garden/logic.mjs";
import {
  CANONICAL_ORIENTATION,
  rollOrientation,
} from "../games/memory-ark/logic.mjs";
import { FACE_VISUALS } from "../games/memory-ark/visuals.mjs";
import {
  ACTOR as MIRROR_ACTOR,
  evaluatePosition as evaluateMirrorPosition,
  LEVELS as MIRROR_LEVELS,
  solutionPosition as mirrorSolutionPosition,
} from "../games/mirror-theatre/logic.mjs";

const firstDate = new Date(2026, 7, 31, 9, 30);
const nextDate = new Date(2026, 8, 1, 12, 0);
assert.equal(localDayKey(firstDate), "2026-08-31");

const first = awardCompletion(createProgress(), {
  realm: "star-drift",
  levelId: "near:01",
  tier: 1,
  moves: 3,
  par: 3,
}, firstDate);
assert.equal(first.firstClear, true);
assert.equal(first.personalBest, false);
assert.equal(first.efficient, true);
assert.ok(first.awarded >= 200);
assert.equal(first.progress.streak.count, 1);
assert.deepEqual(first.newBadges, ["初入此境", "妙手破局"]);

const replay = awardCompletion(first.progress, {
  realm: "star-drift",
  levelId: "near:01",
  tier: 1,
  moves: 4,
  par: 3,
}, firstDate);
assert.equal(replay.firstClear, false);
assert.equal(replay.personalBest, false);
assert.equal(replay.progress.streak.count, 1);
assert.equal(replay.awarded, 0);
assert.deepEqual(replay.breakdown, []);

const best = awardCompletion(replay.progress, {
  realm: "star-drift",
  levelId: "near:01",
  tier: 1,
  moves: 2,
  par: 3,
}, nextDate);
assert.equal(best.personalBest, true);
assert.equal(best.progress.streak.count, 2);
assert.equal(best.progress.realms["star-drift"].clears["near:01"].bestMoves, 2);

const secondLevel = awardCompletion(best.progress, {
  realm: "star-drift",
  levelId: "near:02",
  tier: 2,
  moves: 7,
}, nextDate);
const thirdLevel = awardCompletion(secondLevel.progress, {
  realm: "star-drift",
  levelId: "near:03",
  tier: 3,
  moves: 9,
}, nextDate);
assert.ok(thirdLevel.newBadges.includes("三关巡礼"));
assert.equal(progressSummary(thirdLevel.progress, "star-drift").clears, 3);

const noParFirst = awardCompletion(createProgress(), {
  realm: "mirror-theatre",
  levelId: "preview:01",
  tier: 1,
  moves: 12,
}, firstDate);
assert.deepEqual(noParFirst.newBadges, ["初入此境"]);
const noParBest = awardCompletion(noParFirst.progress, {
  realm: "mirror-theatre",
  levelId: "preview:01",
  tier: 1,
  moves: 10,
}, firstDate);
assert.ok(noParBest.newBadges.includes("妙手破局"));

const corrupt = normalizeProgress({ version: 1, xp: -9, streak: { count: "x" }, realms: [] });
assert.deepEqual(corrupt, createProgress());
assert.deepEqual(normalizeProgress(null), createProgress());
assert.equal(awardCompletion(createProgress(), { realm: "constructor", levelId: "safe" }, firstDate).awarded, 0);
assert.equal(awardCompletion(createProgress(), { realm: "star-drift", levelId: "__proto__" }, firstDate).awarded, 0);

const legacy = normalizeProgress({
  version: 1,
  xp: 777,
  streak: { lastDay: "2026-08-30", count: 4 },
  realms: {},
});
assert.equal(legacy.xp, 777);
assert.equal(legacy.xpBase, 777);
assert.deepEqual(legacy.rewards, {});

const tabA = awardCompletion(createProgress(), {
  realm: "star-drift",
  levelId: "tab:a",
  tier: 1,
  moves: 3,
  par: 3,
}, firstDate);
const tabB = awardCompletion(createProgress(), {
  realm: "mirror-theatre",
  levelId: "tab:b",
  tier: 2,
  moves: 8,
}, firstDate);
const mergedTabs = mergeProgress(tabA.progress, tabB.progress);
assert.deepEqual(mergedTabs, mergeProgress(tabB.progress, tabA.progress));
assert.deepEqual(mergedTabs, mergeProgress(mergedTabs, mergedTabs));
assert.ok(mergedTabs.realms["star-drift"].clears["tab:a"]);
assert.ok(mergedTabs.realms["mirror-theatre"].clears["tab:b"]);
assert.equal(mergedTabs.streak.count, 1);
assert.equal(
  mergedTabs.xp,
  tabA.progress.xp + tabB.progress.xp - tabA.progress.rewards[`daily:${localDayKey(firstDate)}`],
);

const duplicateTabA = awardCompletion(createProgress(), {
  realm: "star-drift",
  levelId: "same:first",
  tier: 1,
  moves: 3,
  par: 3,
}, firstDate);
const duplicateTabB = awardCompletion(createProgress(), {
  realm: "star-drift",
  levelId: "same:first",
  tier: 1,
  moves: 3,
  par: 3,
}, firstDate);
const mergedDuplicate = mergeProgress(duplicateTabA.progress, duplicateTabB.progress);
assert.equal(mergedDuplicate.xp, duplicateTabA.progress.xp);
assert.equal(Object.keys(mergedDuplicate.realms["star-drift"].clears).length, 1);

assert.equal(masteryTargetFor("sky-bridges"), 6);
assert.equal(masteryTargetFor("mirror-theatre"), 6);
assert.equal(masteryTargetFor("star-drift"), 9);
assert.equal(
  badgeRulesForRealm("sky-bridges").find(({ name }) => name === "本境宗师").description,
  "完成本境 6 个不同关卡",
);

let skyProgress = createProgress();
let sixthSkyClear;
for (let index = 1; index <= 6; index += 1) {
  sixthSkyClear = awardCompletion(skyProgress, {
    realm: "sky-bridges",
    levelId: `route:${index}`,
    tier: 1,
    moves: index + 4,
  }, firstDate);
  skyProgress = sixthSkyClear.progress;
}
assert.ok(sixthSkyClear.newBadges.includes("本境行家"));
assert.ok(sixthSkyClear.newBadges.includes("本境宗师"));
assert.ok(progressSummary(skyProgress, "sky-bridges").badges.includes("本境宗师"));

let defaultProgress = createProgress();
for (let index = 1; index <= 6; index += 1) {
  defaultProgress = awardCompletion(defaultProgress, {
    realm: "star-drift",
    levelId: `sector:${index}`,
    tier: 1,
    moves: index + 4,
  }, firstDate).progress;
}
assert.equal(progressSummary(defaultProgress, "star-drift").badges.includes("本境宗师"), false);

const realmUiSource = await readFile(new URL("./realm-ui.mjs", import.meta.url), "utf8");
assert.match(realmUiSource, /window\.addEventListener\("storage", syncFromStorage\)/);
assert.match(realmUiSource, /progress = mergeProgress\(progress, loadProgress\(\)\)/);
assert.match(realmUiSource, /element === document\.body \|\| element === document\.documentElement/);
assert.match(realmUiSource, /tutorialWaitObserver\.observe\(document\.body/);
assert.doesNotMatch(realmUiSource, /retryCount\s*</);
assert.match(realmUiSource, /\.\/tutorial-data\.mjs\?v=2/);
assert.match(realmUiSource, /\.\/realm-ui\.css\?v=2/);

for (const realmId of Object.keys(REALM_TUTORIALS)) {
  const pageSource = await readFile(new URL(`../games/${realmId}/index.html`, import.meta.url), "utf8");
  assert.match(pageSource, /\.\.\/\.\.\/shared\/realm-ui\.css\?v=2/);
  assert.match(pageSource, /\.\.\/\.\.\/shared\/realm-ui\.mjs\?v=2/);
}

for (const [realmId, tutorial] of Object.entries(REALM_TUTORIALS)) {
  assert.equal(tutorial.cards.length, 3, `${realmId} should have three tutorial cards`);
  const artwork = tutorial.cards.map(({ focus }) => tutorialArt(realmId, focus));
  assert.equal(new Set(artwork).size, 3, `${realmId} should render a distinct SVG for every card`);
  for (const [index, art] of artwork.entries()) {
    assert.match(art, /^<svg\b/, `${realmId} card ${index + 1} should render SVG artwork`);
    assert.match(art, /viewBox="0 0 320 184"/);
    assert.match(art, /preserveAspectRatio="xMidYMid meet"/);
    const stateLayerCount = ["art-elements", "art-action", "art-goal"]
      .filter((className) => art.includes(`class="${className}"`)).length;
    assert.equal(stateLayerCount, 1, `${realmId} card ${index + 1} should contain one focused state only`);
  }
}

const memoryTutorialArt = REALM_TUTORIALS["memory-ark"].cards
  .map(({ focus }) => tutorialArt("memory-ark", focus))
  .join("\n");
for (const sigil of ["✦", "≋", "◇", "⌁", "◉", "∿"]) assert.match(memoryTutorialArt, new RegExp(sigil));

const redThreadCopy = REALM_TUTORIALS["red-thread-office"].cards
  .flatMap(({ title, body, bullets }) => [title, body, ...bullets])
  .join("\n");
assert.match(redThreadCopy, /人物印章|红色方印/);
assert.doesNotMatch(redThreadCopy, /圆形角色/);
const redThreadArt = REALM_TUTORIALS["red-thread-office"].cards
  .map(({ focus }) => tutorialArt("red-thread-office", focus))
  .join("\n");
for (const seal of ["归", "晴", "知", "安", "逢", "暖", "同"]) assert.match(redThreadArt, new RegExp(seal));

const tutorialState = (realmId, focus) => tutorialArt(realmId, focus);

assert.match(tutorialState("star-drift", "action"), /data-path="1,1 2,2 3,3"/);
assert.match(tutorialState("star-drift", "action"), /data-direction="SE"/);
assert.match(tutorialState("star-drift", "goal"), /data-energy-remaining="0"/);

assert.match(tutorialState("memory-ark", "action"), /data-direction="east"/);
assert.match(tutorialState("memory-ark", "action"), /data-axis="Z"/);
assert.match(tutorialState("memory-ark", "action"), /data-quarter-turns="1"/);
assert.match(tutorialState("memory-ark", "goal"), /data-face-token-count="6"/);
assert.match(tutorialState("memory-ark", "goal"), /data-ground-token-count="0"/);

const memoryActionArt = tutorialState("memory-ark", "action");
const memoryFaceColors = Object.freeze({
  "Ⅰ": "#ffcc70",
  "Ⅱ": "#7ec9d4",
  "Ⅲ": "#a8c879",
  "Ⅳ": "#e7d8b0",
  "Ⅴ": "#b89ad7",
  "Ⅵ": "#e58c62",
});
const memoryFaceIndexes = Object.fromEntries(
  Object.entries(FACE_VISUALS).map(([faceId, { index }]) => [faceId, index]),
);
const memoryOrientations = {
  before: CANONICAL_ORIENTATION,
  after: rollOrientation(CANONICAL_ORIENTATION, "east"),
};
const memoryVisibleSlots = { top: "top", front: "south", right: "east" };
const renderedMemoryFaces = [...memoryActionArt.matchAll(
  /<path class="tutorial-memory-face" data-roll-state="([^"]+)" data-slot="([^"]+)" data-face-index="([^"]+)" data-face-color="([^"]+)" d="[^"]+" fill="[^"]+" stroke="([^"]+)"/g,
)].map(([, state, slot, index, color, stroke]) => ({ state, slot, index, color, stroke }));
for (const [state, orientation] of Object.entries(memoryOrientations)) {
  for (const [slot, position] of Object.entries(memoryVisibleSlots)) {
    const expectedIndex = memoryFaceIndexes[orientation[position]];
    const rendered = renderedMemoryFaces.find((face) => face.state === state && face.slot === slot);
    assert.ok(rendered, `memory ${state} ${slot} face should be rendered`);
    assert.equal(rendered.index, expectedIndex, `memory ${state} ${slot} should keep its physical face`);
    assert.equal(rendered.color, memoryFaceColors[expectedIndex], `memory ${state} ${slot} should keep its physical edge color`);
    assert.equal(rendered.stroke, rendered.color, `memory ${state} ${slot} edge should use its declared physical color`);
  }
}
assert.match(
  memoryActionArt,
  new RegExp(`data-bottom-face-index="${memoryFaceIndexes[memoryOrientations.after.bottom]}"`),
);

assert.match(tutorialState("red-thread-office", "action"), /data-crossings-before="1"/);
assert.match(tutorialState("red-thread-office", "action"), /data-crossings-after="0"/);
assert.match(tutorialState("red-thread-office", "goal"), /data-seal-count="7"/);
assert.match(tutorialState("red-thread-office", "goal"), /data-crossings="0"/);

assert.match(tutorialState("firefly-garden", "goal"), /data-all-plots-lit="true"/);
assert.match(tutorialState("firefly-garden", "goal"), /data-conflicts="0"/);
assert.match(tutorialState("firefly-garden", "goal"), /data-runes-exact="true"/);

const fireflyActionArt = tutorialState("firefly-garden", "action");
const fireflyGridContract = /data-grid-x="(\d+)" data-grid-y="(\d+)" data-cell-size="(\d+)"/.exec(fireflyActionArt);
assert.ok(fireflyGridContract, "firefly action should declare its grid geometry");
const [, fireflyGridX, fireflyGridY, fireflyCellSize] = fireflyGridContract.map(Number);
const fireflyActionWalls = [...fireflyActionArt.matchAll(
  /<rect class="tutorial-wall" data-row="(\d+)" data-column="(\d+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g,
)];
assert.equal(fireflyActionWalls.length, 2);
for (const [, row, column, x, y, width, height] of fireflyActionWalls) {
  assert.equal(Number(x), fireflyGridX + Number(column) * fireflyCellSize);
  assert.equal(Number(y), fireflyGridY + Number(row) * fireflyCellSize);
  assert.equal(Number(width), fireflyCellSize);
  assert.equal(Number(height), fireflyCellSize);
}

const fireflyGoalLevel = FIREFLY_LEVELS.find(({ id }) => id === "dew-court");
const fireflyGoalResult = evaluateFireflyPosition(fireflyGoalLevel, {
  bulbs: fireflyGoalLevel.solution,
});
assert.equal(fireflyGoalResult.complete, true, "tutorial firefly position should be a legal completed level");
const fireflyGoalArt = tutorialState("firefly-garden", "goal");
assert.ok(fireflyGoalArt.includes(`data-level="${fireflyGoalLevel.id}"`));
assert.ok(fireflyGoalArt.includes(`data-rows="${fireflyGoalLevel.rows.join("/")}"`));
assert.ok(fireflyGoalArt.includes(`data-solution="${fireflyGoalLevel.solution.join(",")}"`));
assert.ok(fireflyGoalArt.includes(`data-plot-count="${fireflyGoalResult.totalPlots}"`));
assert.ok(fireflyGoalArt.includes(`data-lit-count="${fireflyGoalResult.litCount}"`));
const fireflyPlots = [...fireflyGoalArt.matchAll(
  /<g class="tutorial-plot is-lit(?: has-firefly)?" data-row="(\d+)" data-column="(\d+)" data-lit="(true|false)" data-firefly="(true|false)"/g,
)];
assert.equal(fireflyPlots.length, fireflyGoalResult.totalPlots);
assert.ok(fireflyPlots.every(([, , , lit]) => lit === "true"), "every rendered firefly plot should visibly be lit");
const renderedFireflies = fireflyPlots
  .filter(([, , , , hasFirefly]) => hasFirefly === "true")
  .map(([, row, column]) => `${row}:${column}`)
  .sort();
assert.deepEqual(renderedFireflies, [...fireflyGoalLevel.solution].sort());
const renderedEmptyPlots = fireflyPlots.filter(([, , , , hasFirefly]) => hasFirefly === "false").length;
assert.equal((fireflyGoalArt.match(/class="tutorial-light"/g) ?? []).length, renderedEmptyPlots);
for (const [key, rune] of fireflyGoalResult.runes) {
  const [row, column] = key.split(":");
  assert.ok(fireflyGoalArt.includes(
    `class="tutorial-rune" data-row="${row}" data-column="${column}" data-target="${rune.target}" data-count="${rune.count}" data-exact="true"`,
  ));
}

assert.match(tutorialState("abyss-echo", "action"), /data-hidden-revealed="false"/);
assert.match(tutorialState("abyss-echo", "goal"), /data-response-count="24"/);
assert.match(tutorialState("abyss-echo", "goal"), /data-energy-count="4"/);
assert.match(tutorialState("abyss-echo", "goal"), /data-equivalent="true"/);

assert.match(tutorialState("storm-lanterns", "action"), /data-same-module="R03C04"/);
assert.match(tutorialState("storm-lanterns", "goal"), /data-module-count="25"/);
assert.match(tutorialState("storm-lanterns", "goal"), /data-powered-count="25"/);
assert.match(tutorialState("storm-lanterns", "goal"), /data-solved="true"/);
assert.match(tutorialState("storm-lanterns", "goal"), /data-errors="0"/);

assert.match(tutorialState("night-market-spirits", "action"), /data-collapsed-board="\.\.B\.\/YYB\."/);
assert.match(tutorialState("night-market-spirits", "action"), /data-action-sequence="remove,drop,shift"/);
assert.match(tutorialState("night-market-spirits", "action"), /data-action-step-count="3"/);
assert.match(tutorialState("night-market-spirits", "goal"), /data-remaining="0"/);

assert.match(tutorialState("sky-bridges", "action"), /data-primary-cycle="0,1,2,0"/);
assert.match(tutorialState("sky-bridges", "action"), /data-mark-action="contextmenu-or-tool"/);
assert.match(tutorialState("sky-bridges", "action"), /data-mark-in-cycle="false"/);
assert.match(tutorialState("sky-bridges", "goal"), /data-port-count="4"/);
assert.match(tutorialState("sky-bridges", "goal"), /data-route-counts="1,1,1,2"/);
assert.match(tutorialState("sky-bridges", "goal"), /data-complete="true"/);
assert.equal((tutorialState("sky-bridges", "goal").match(/data-exact="true"/g) ?? []).length, 4);

assert.match(tutorialState("spirit-dragon", "goal"), /data-level="cloud-gate"/);
assert.match(tutorialState("spirit-dragon", "goal"), /data-pearl-count="5"/);
assert.match(tutorialState("spirit-dragon", "goal"), /data-loop-count="1"/);

assert.match(tutorialState("mirror-theatre", "goal"), /data-filled="true"/);
assert.match(tutorialState("mirror-theatre", "goal"), /data-cast-exact="true"/);
assert.match(tutorialState("mirror-theatre", "goal"), /data-edges-exact="true"/);

const mirrorGoalLevel = MIRROR_LEVELS.find(({ id }) => id === "velvet-foyer");
const mirrorGoalResult = evaluateMirrorPosition(mirrorGoalLevel, mirrorSolutionPosition(mirrorGoalLevel));
assert.equal(mirrorGoalResult.complete, true, "tutorial mirror position should solve velvet-foyer");
const mirrorGoalArt = tutorialState("mirror-theatre", "goal");
assert.ok(mirrorGoalArt.includes(`data-level="${mirrorGoalLevel.id}"`));
assert.ok(mirrorGoalArt.includes(`data-width="${mirrorGoalLevel.width}" data-height="${mirrorGoalLevel.height}"`));
assert.ok(mirrorGoalArt.includes(`data-rows="${mirrorGoalLevel.rows.join("/")}"`));
assert.ok(mirrorGoalArt.includes(`data-solution="${mirrorGoalLevel.solution.join("/")}"`));
assert.ok(mirrorGoalArt.includes(`data-floor-count="${mirrorGoalResult.floorCount}"`));
assert.ok(mirrorGoalArt.includes(`data-actor-count="${mirrorGoalResult.filledCount}"`));
assert.ok(mirrorGoalArt.includes(`data-mirror-count="${mirrorGoalLevel.width * mirrorGoalLevel.height - mirrorGoalResult.floorCount}"`));
assert.equal(
  (mirrorGoalArt.match(/class="tutorial-stage-cell tutorial-(?:mirror|actor)-cell"/g) ?? []).length,
  mirrorGoalLevel.width * mirrorGoalLevel.height,
);
assert.equal(
  (mirrorGoalArt.match(/class="tutorial-stage-cell tutorial-mirror-cell"/g) ?? []).length,
  5,
);
const mirrorActorCells = [...mirrorGoalArt.matchAll(
  /class="tutorial-stage-cell tutorial-actor-cell"[^>]+data-actor-code="([HOR])" data-actor="([^"]+)"/g,
)];
assert.equal(mirrorActorCells.length, 11);
const renderedActorCounts = { human: 0, hologram: 0, robot: 0 };
for (const [, , actor] of mirrorActorCells) renderedActorCounts[actor] += 1;
assert.deepEqual(renderedActorCounts, mirrorGoalResult.actorCounts);
assert.ok(mirrorGoalArt.includes(`data-cast-human="${mirrorGoalLevel.targets[MIRROR_ACTOR.HUMAN]}"`));
assert.ok(mirrorGoalArt.includes(`data-cast-hologram="${mirrorGoalLevel.targets[MIRROR_ACTOR.HOLOGRAM]}"`));
assert.ok(mirrorGoalArt.includes(`data-cast-robot="${mirrorGoalLevel.targets[MIRROR_ACTOR.ROBOT]}"`));
const mirrorEdgeClues = [...mirrorGoalArt.matchAll(
  /class="tutorial-edge-clue is-exact" data-side="([^"]+)" data-index="(\d+)" data-clue="(\d+)" data-visible="(\d+)" data-exact="(true|false)"/g,
)];
assert.equal(mirrorEdgeClues.length, mirrorGoalResult.totalEdges);
for (const [, side, index, clue, visible, exact] of mirrorEdgeClues) {
  const result = mirrorGoalResult.edgeResults.get(`${side}:${index}`);
  assert.ok(result);
  assert.equal(Number(clue), result.clue);
  assert.equal(Number(visible), result.visible);
  assert.equal(exact, String(result.exact));
}

console.log("Realm reward engine: all assertions passed.");
