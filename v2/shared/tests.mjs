import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { awardCompletion, createProgress, mergeProgress, progressSummary } from "./reward-engine.mjs";
import { V2_PROGRESS_KEY, V2_STORAGE_PREFIX, gameStorageKey, tutorialStorageKey } from "./storage.mjs";
import { REALM_CONFIGS, REALM_TUTORIALS, tutorialArt } from "./tutorial-data.mjs";

assert.equal(V2_STORAGE_PREFIX, "ten-realms-v2:");
assert.equal(V2_PROGRESS_KEY, "ten-realms-v2:progress:v1");
assert.equal(tutorialStorageKey("sample-realm"), "ten-realms-v2:tutorial:sample-realm:v1");
assert.equal(tutorialStorageKey("sample-realm", 2), "ten-realms-v2:tutorial:sample-realm:v2");
assert.equal(gameStorageKey("sample-realm", "save"), "ten-realms-v2:games:sample-realm:save:v1");
assert.throws(() => gameStorageKey("../escape", "save"), /Invalid game slug/);

const now = new Date(2026, 7, 31, 12, 0);
const first = awardCompletion(createProgress(), {
  realm: "sample-realm", levelId: "level:1", tier: 1, moves: 4, par: 5,
}, now);
assert.equal(first.firstClear, true);
assert.equal(first.efficient, true);
assert.ok(first.awarded > 0);
assert.equal(progressSummary(first.progress, "sample-realm").clears, 1);

const repeated = awardCompletion(first.progress, {
  realm: "sample-realm", levelId: "level:1", tier: 1, moves: 4, par: 5,
}, now);
assert.equal(repeated.awarded, 0, "replaying the same score must not award more XP");
assert.equal(repeated.progress.xp, first.progress.xp);
assert.equal(progressSummary(repeated.progress, "sample-realm").clears, 1);

const improved = awardCompletion(repeated.progress, {
  realm: "sample-realm", levelId: "level:1", tier: 1, moves: 3, par: 5,
}, now);
assert.equal(improved.personalBest, true);
assert.ok(improved.awarded > 0, "a genuine personal best should remain rewarding");
assert.equal(improved.progress.realms["sample-realm"].clears["level:1"].bestMoves, 3);
assert.equal(progressSummary(improved.progress, "sample-realm").clears, 1);

const repeatedBest = awardCompletion(improved.progress, {
  realm: "sample-realm", levelId: "level:1", tier: 1, moves: 3, par: 5,
}, now);
assert.equal(repeatedBest.awarded, 0);
assert.equal(repeatedBest.progress.xp, improved.progress.xp);

const zeroPar = awardCompletion(createProgress(), {
  realm: "zero-realm", levelId: "level:zero", tier: 1, moves: 0, par: 0,
}, now);
assert.equal(zeroPar.efficient, true);
assert.ok(zeroPar.breakdown.some(({ label }) => label === "建议步数达成"));

const other = awardCompletion(createProgress(), {
  realm: "second-realm", levelId: "level:1", tier: 2, moves: 8,
}, now);
const merged = mergeProgress(first.progress, other.progress);
assert.ok(merged.realms["sample-realm"]);
assert.ok(merged.realms["second-realm"]);
assert.deepEqual(mergeProgress(merged, merged), merged);

const expectedTutorialRealms = [
  "cloud-camp",
  "mist-photo-studio",
  "mystic-perfumery",
  "nebula-hatchery",
  "neon-skyline",
];
assert.deepEqual(Object.keys(REALM_TUTORIALS).sort(), [...expectedTutorialRealms].sort());
const expectedConfiguredRealms = [
  ...expectedTutorialRealms,
  "polar-railway",
  "season-dyehouse",
  "yokai-inn",
  "aurora-magnet-lab",
  "dream-hotel",
];
assert.deepEqual(Object.keys(REALM_CONFIGS).sort(), [...expectedConfiguredRealms].sort());
for (const realmId of expectedConfiguredRealms) {
  const config = REALM_CONFIGS[realmId];
  assert.ok(config.title);
  assert.ok(config.token);
  assert.match(config.accent, /^#[0-9a-f]{6}$/i);
  assert.match(config.accentRgb, /^\d{1,3}, \d{1,3}, \d{1,3}$/);
}
for (const realmId of expectedConfiguredRealms.slice(expectedTutorialRealms.length)) {
  assert.equal(REALM_TUTORIALS[realmId], undefined);
  assert.equal(REALM_CONFIGS[realmId].nativeTutorialSelector, "#tutorial-button");
}
const svgIds = new Set();
for (const [realmId, tutorial] of Object.entries(REALM_TUTORIALS)) {
  assert.match(tutorial.accent, /^#[0-9a-f]{6}$/i);
  assert.match(tutorial.accentRgb, /^\d{1,3}, \d{1,3}, \d{1,3}$/);
  assert.equal(tutorial.version, 2);
  assert.equal(tutorialStorageKey(realmId, tutorial.version), `ten-realms-v2:tutorial:${realmId}:v2`);
  assert.ok(tutorial.token);
  assert.equal(tutorial.cards.length, 3, `${realmId} must have exactly three tutorial cards`);
  assert.deepEqual(tutorial.cards.map(({ focus }) => focus), ["elements", "action", "goal"]);
  const realmArt = [];
  for (const card of tutorial.cards) {
    const art = tutorialArt(realmId, card.focus);
    realmArt.push(art);
    assert.match(art, /^<svg\b/);
    assert.match(art, /viewBox="0 0 320 184"/);
    assert.match(art, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(art, new RegExp(`class=["']art-${card.focus}["']`));
    for (const [, id] of art.matchAll(/\bid=["']([^"']+)["']/g)) {
      assert.equal(svgIds.has(id), false, `duplicate tutorial SVG id: ${id}`);
      svgIds.add(id);
    }
  }
  assert.equal(new Set(realmArt).size, 3, `${realmId} must render three distinct tutorial illustrations`);
}
assert.equal(tutorialArt("cloud-camp", "missing"), "");
assert.equal(tutorialArt("missing-realm", "elements"), "");

const uiSource = await readFile(new URL("./realm-ui.mjs", import.meta.url), "utf8");
const uiStyles = await readFile(new URL("./realm-ui.css", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
assert.match(uiSource, /window\.RealmArcade/);
assert.match(uiSource, /REALM_CONFIGS/);
assert.match(uiSource, /nativeTutorialSelector/);
assert.match(uiSource, /\.\.\.payload, realm: realmId/);
assert.match(uiSource, /navigator\.serviceWorker\.register\(workerUrl/);
assert.match(uiSource, /some\(\(link\) => link\.href === href\)/);
assert.match(uiSource, /if \(!writeStoredJson\(V2_PROGRESS_KEY, result\.progress\)\)/);
assert.match(uiSource, /__realmCompletionQueue \?\?= \[\]\)\.push\(payload\)/);
assert.match(uiSource, /data-progress-badges/);
assert.match(uiSource, /如何获得 XP/);
assert.match(uiSource, /单纯重复同一成绩不会刷分/);
assert.doesNotMatch(uiSource, /ten-realms:progress/);
assert.match(uiStyles, /\[data-rank\]\s*\{[^}]*min-height:\s*44px/, "the shared rank control needs a full mobile touch target");
assert.match(uiStyles, /button\[data-next\]:is\(:hover, :focus-visible, :active\)/, "game footer hover rules must not hide the tutorial CTA");
assert.match(uiStyles, /html:has\(\.realm-guide-dialog\[open\]\)[\s\S]*?overflow:\s*hidden/, "an open mobile tutorial must lock background scrolling");
assert.match(serviceWorkerSource, /isGameDirectory/);
assert.match(serviceWorkerSource, /const directoryPath = relativePath\.replace/);
assert.match(serviceWorkerSource, /new URL\(`\$\{directoryPath\}index\.html`, scope\)/);
console.log("V2 shared reward, storage and tutorial contracts: all assertions passed.");
