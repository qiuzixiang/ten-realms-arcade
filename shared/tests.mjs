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
for (const seal of ["归", "晴", "知", "安", "逢", "暖"]) assert.match(redThreadArt, new RegExp(seal));

console.log("Realm reward engine: all assertions passed.");
