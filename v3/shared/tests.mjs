import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { REALM_CONFIGS, REALM_TUTORIALS } from "./tutorial-data.mjs";
import { REALM_MASTERY_TARGETS, awardCompletion, badgeRulesForRealm, createProgress, mergeProgress, progressSummary } from "./reward-engine.mjs";
import { V3_PROGRESS_KEY, V3_STORAGE_PREFIX, gameStorageKey, tutorialStorageKey } from "./storage.mjs";

assert.equal(V3_STORAGE_PREFIX, "ten-realms-v3:");
assert.equal(V3_PROGRESS_KEY, "ten-realms-v3:progress:v1");
assert.equal(tutorialStorageKey("sample-realm"), "ten-realms-v3:tutorial:sample-realm:v1");
assert.equal(gameStorageKey("sample-realm", "save"), "ten-realms-v3:games:sample-realm:save:v1");

const expectedRealms = [
  "time-sand-post", "molten-core-vent", "paper-crane-sanctuary", "resonance-bell-room", "four-spirit-habitat",
  "star-dial-bureau", "stardust-survey", "coral-bloom-lab", "eclipse-watch", "celestial-mural",
].sort();
assert.deepEqual(Object.keys(REALM_CONFIGS).sort(), expectedRealms);
assert.deepEqual(Object.keys(REALM_MASTERY_TARGETS).sort(), expectedRealms);
assert.deepEqual(Object.keys(REALM_TUTORIALS), []);
for (const realmId of expectedRealms) {
  const config = REALM_CONFIGS[realmId];
  assert.ok(config.title);
  assert.ok(config.token);
  assert.match(config.accent, /^#[0-9a-f]{6}$/i);
  assert.match(config.accentRgb, /^\d{1,3}, \d{1,3}, \d{1,3}$/);
  assert.equal(config.nativeTutorialSelector, "#tutorial-button");
}
assert.equal(badgeRulesForRealm("star-dial-bureau").at(-1).clears, 6);
assert.equal(badgeRulesForRealm("celestial-mural").at(-1).clears, 5);

const now = new Date("2026-09-02T08:00:00.000Z");
const first = awardCompletion(createProgress(), {
  realm: "celestial-mural",
  levelId: "mural-dawn",
  tier: 2,
  moves: 18,
  par: 20,
  eventId: "celestial-mural:run-a:complete",
  completionId: "celestial-mural:run-a:complete",
}, now);
assert.equal(first.accepted, true);
assert.equal(first.firstClear, true);
assert.ok(first.awarded > 0);
const duplicate = awardCompletion(first.progress, {
  realm: "celestial-mural",
  levelId: "mural-dawn",
  tier: 2,
  moves: 18,
  par: 20,
  eventId: "celestial-mural:run-a:complete",
}, new Date("2026-09-03T08:00:00.000Z"));
assert.equal(duplicate.accepted, true);
assert.equal(duplicate.duplicateEvent, true);
assert.equal(duplicate.awarded, 0);
assert.equal(duplicate.progress.xp, first.progress.xp);

const second = awardCompletion(createProgress(), {
  realm: "star-dial-bureau",
  levelId: "dawn-ring",
  tier: 1,
  moves: 5,
  par: 6,
  eventId: "star-dial-bureau:run-b:complete",
}, now);
const merged = mergeProgress(first.progress, second.progress);
assert.ok(merged.realms["celestial-mural"]);
assert.ok(merged.realms["star-dial-bureau"]);
assert.deepEqual(mergeProgress(merged, merged), merged);
assert.equal(progressSummary(first.progress, "celestial-mural").clears, 1);

const uiSource = await readFile(new URL("./realm-ui.mjs", import.meta.url), "utf8");
const uiStyles = await readFile(new URL("./realm-ui.css", import.meta.url), "utf8");
const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
assert.match(uiSource, /V3_PROGRESS_KEY/);
assert.match(uiSource, /window\.TenRealmsV3/);
assert.match(uiSource, /ten-realms-v3:realm-ready/);
assert.match(uiSource, /3\.0 十款共享/);
assert.doesNotMatch(uiSource, /ten-realms-v2/);
assert.match(uiStyles, /min-height:\s*44px/);
assert.match(uiStyles, /html:has\(dialog\[open\]\)/);
assert.match(worker, /__TEN_REALMS_V3_BUILD_REVISION__/);
assert.match(worker, /ten-realms-v3-arcade-/);
assert.doesNotMatch(worker, /ten-realms-v2-arcade-/);

console.log("V3 shared reward, storage, native tutorial and cache contracts: all assertions passed.");
