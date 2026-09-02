import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { awardCompletion, badgeRulesForRealm, createProgress, mergeProgress, normalizeProgress, progressSummary } from "./reward-engine.mjs";
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
  eventId: "sample-realm:run-1:complete",
}, now);
assert.equal(first.firstClear, true);
assert.equal(first.efficient, true);
assert.ok(first.awarded > 0);
assert.equal(progressSummary(first.progress, "sample-realm").clears, 1);

const repeated = awardCompletion(first.progress, {
  realm: "sample-realm", levelId: "level:1", tier: 1, moves: 4, par: 5,
  eventId: "sample-realm:run-2:complete",
}, now);
assert.equal(repeated.awarded, 0, "replaying the same score must not award more XP");
assert.equal(repeated.progress.xp, first.progress.xp);
assert.equal(progressSummary(repeated.progress, "sample-realm").clears, 1);

const improved = awardCompletion(repeated.progress, {
  realm: "sample-realm", levelId: "level:1", tier: 1, moves: 3, par: 5,
  eventId: "sample-realm:run-3:complete",
}, now);
assert.equal(improved.personalBest, true);
assert.ok(improved.awarded > 0, "a genuine personal best should remain rewarding");
assert.equal(improved.progress.realms["sample-realm"].clears["level:1"].bestMoves, 3);
assert.equal(progressSummary(improved.progress, "sample-realm").clears, 1);

const repeatedBest = awardCompletion(improved.progress, {
  realm: "sample-realm", levelId: "level:1", tier: 1, moves: 3, par: 5,
  eventId: "sample-realm:run-4:complete",
}, now);
assert.equal(repeatedBest.awarded, 0);
assert.equal(repeatedBest.progress.xp, improved.progress.xp);

const stableEvent = awardCompletion(createProgress(), {
  realm: "event-realm", levelId: "level:1", tier: 2, moves: 7, par: 8, eventId: "event-realm:run-17:complete",
}, now);
const replayedEvent = awardCompletion(stableEvent.progress, {
  realm: "event-realm", levelId: "level:1", tier: 2, moves: 1, par: 8, eventId: "event-realm:run-17:complete",
}, new Date(2026, 7, 31, 12, 5));
assert.equal(replayedEvent.duplicateEvent, true, "the same stable eventId must be idempotent");
assert.equal(replayedEvent.accepted, true);
assert.equal(replayedEvent.awarded, 0);
assert.equal(replayedEvent.progress.xp, stableEvent.progress.xp);
assert.equal(replayedEvent.progress.realms["event-realm"].clears["level:1"].wins, 1, "event replay must not inflate wins");
assert.equal(replayedEvent.progress.realms["event-realm"].clears["level:1"].bestMoves, 7, "event replay must not forge a personal best");
assert.ok(replayedEvent.progress.events["event-realm:run-17:complete"]);

const completionAlias = awardCompletion(createProgress(), {
  realm: "alias-realm", levelId: "level:1", tier: 1, moves: 5, par: 6,
  completionId: "alias-realm:run-1:complete",
}, now);
const replayedAlias = awardCompletion(completionAlias.progress, {
  realm: "alias-realm", levelId: "level:1", tier: 1, moves: 1, par: 6,
  completionId: "alias-realm:run-1:complete",
}, new Date(2026, 8, 1, 12, 0));
assert.equal(replayedAlias.duplicateEvent, true, "legacy completionId must use the same event ledger");
assert.equal(replayedAlias.progress.xp, completionAlias.progress.xp, "a next-day retry must not mint another daily reward");
assert.equal(replayedAlias.progress.realms["alias-realm"].clears["level:1"].wins, 1);

const matchingAliases = awardCompletion(createProgress(), {
  realm: "alias-realm", levelId: "level:2", tier: 1, moves: 5, par: 6,
  completionId: "alias-realm:run-2:complete", eventId: "alias-realm:run-2:complete",
}, now);
assert.equal(matchingAliases.firstClear, true, "matching compatibility IDs are accepted");

const mismatchedAliases = awardCompletion(createProgress(), {
  realm: "alias-realm", levelId: "level:3", tier: 1, moves: 5, par: 6,
  completionId: "alias-realm:run-3:complete", eventId: "alias-realm:forged:complete",
}, now);
assert.equal(mismatchedAliases.awarded, 0, "conflicting event aliases must be rejected atomically");
assert.equal(mismatchedAliases.accepted, false);
assert.deepEqual(mismatchedAliases.progress, createProgress());

const missingEvent = awardCompletion(createProgress(), {
  realm: "alias-realm", levelId: "level:4", tier: 1, moves: 5, par: 6,
}, now);
assert.equal(missingEvent.awarded, 0, "an unstable completion without an event identity is rejected");
assert.equal(missingEvent.accepted, false);
assert.deepEqual(missingEvent.progress, createProgress());

const longLedger = createProgress();
longLedger.events = Object.fromEntries(Array.from({ length: 2001 }, (_, index) => [
  `long-realm:run-${index}:complete`,
  new Date(2026, 7, 31, 8, 0, index % 60).toISOString(),
]));
longLedger.realms["long-realm"] = {
  clears: { "level:1": { wins: 2001, bestMoves: 7, firstAt: "2026-08-31T08:00:00.000Z", lastAt: "2026-08-31T08:00:59.000Z" } },
  badges: [],
};
longLedger.streak = { lastDay: "2026-08-31", count: 1 };
const normalizedLongLedger = normalizeProgress(longLedger);
assert.equal(Object.keys(normalizedLongLedger.events).length, 2001, "stable completion identities must never age out of the exact ledger");
const replayAfterManyEvents = awardCompletion(normalizedLongLedger, {
  realm: "long-realm", levelId: "level:1", tier: 1, moves: 1, par: 7,
  eventId: "long-realm:run-0:complete",
}, new Date(2026, 8, 1, 8, 0));
assert.equal(replayAfterManyEvents.duplicateEvent, true, "old events remain idempotent after more than 2000 later completions");
assert.equal(replayAfterManyEvents.progress.realms["long-realm"].clears["level:1"].wins, 2001);
assert.equal(replayAfterManyEvents.progress.xp, normalizedLongLedger.xp, "an old retry cannot mint a new daily reward");

const zeroPar = awardCompletion(createProgress(), {
  realm: "zero-realm", levelId: "level:zero", tier: 1, moves: 0, par: 0,
  eventId: "zero-realm:run-1:complete",
}, now);
assert.equal(zeroPar.efficient, true);
assert.ok(zeroPar.breakdown.some(({ label }) => label === "建议步数达成"));

const other = awardCompletion(createProgress(), {
  realm: "second-realm", levelId: "level:1", tier: 2, moves: 8,
  eventId: "second-realm:run-1:complete",
}, now);
const merged = mergeProgress(first.progress, other.progress);
assert.ok(merged.realms["sample-realm"]);
assert.ok(merged.realms["second-realm"]);
assert.deepEqual(mergeProgress(merged, merged), merged);
assert.equal(badgeRulesForRealm("aurora-magnet-lab").at(-1).clears, 6);
assert.equal(badgeRulesForRealm("sample-realm").at(-1).clears, 9);

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
assert.equal(expectedConfiguredRealms.length, 10);
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
assert.match(uiSource, /if \(!result\.accepted\) throw new TypeError/);
assert.match(uiSource, /__realmCompletionQueue \?\?= \[\]\)\.push\(payload\)/);
assert.match(uiSource, /data-progress-badges/);
assert.match(uiSource, /如何获得 XP/);
assert.match(uiSource, /单纯重复同一成绩不会刷分/);
assert.match(uiSource, /2\.0 十款共享/);
assert.doesNotMatch(uiSource, /ten-realms:progress/);
assert.match(uiStyles, /\[data-rank\]\s*\{[^}]*min-height:\s*44px/, "the shared rank control needs a full mobile touch target");
assert.match(uiStyles, /button\[data-next\]:is\(:hover, :focus-visible, :active\)/, "game footer hover rules must not hide the tutorial CTA");
assert.match(uiStyles, /html:has\(\.realm-guide-dialog\[open\]\)[\s\S]*?overflow:\s*hidden/, "an open mobile tutorial must lock background scrolling");
assert.match(uiStyles, /html:has\(\.realm-progress-dialog\[open\]\)[\s\S]*?overflow:\s*hidden/, "the shared progress dialog must lock background scrolling");
assert.match(uiStyles, /html:has\(dialog\[open\]\)[\s\S]*?overflow:\s*hidden/, "native game dialogs must share the mobile background lock");
assert.match(uiSource, /guide\.scrollTop = 0/, "every shared tutorial card change must reset its scroll container");
assert.match(serviceWorkerSource, /isGameDirectory/);
assert.match(serviceWorkerSource, /const directoryPath = relativePath\.replace/);
assert.match(serviceWorkerSource, /new URL\(`\$\{directoryPath\}index\.html`, scope\)/);
console.log("V2 shared reward, storage and tutorial contracts: all assertions passed.");
