import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { REALM_CONFIGS, REALM_TUTORIALS } from "./tutorial-data.mjs";
import { acknowledgeCompletion, buildCompletionPayload, enqueueCompletion, normalizeCompletionOutbox } from "./completion-outbox.mjs";
import { REALM_MASTERY_TARGETS, awardCompletion, badgeRulesForRealm, createProgress, mergeProgress, progressSummary } from "./reward-engine.mjs";
import { V4_PROGRESS_KEY, V4_STORAGE_PREFIX, completionOutboxStorageKey, gameStorageKey, tutorialStorageKey } from "./storage.mjs";

assert.equal(V4_STORAGE_PREFIX, "ten-realms-v4:");
assert.equal(V4_PROGRESS_KEY, "ten-realms-v4:progress:v1");
assert.equal(tutorialStorageKey("sample-realm"), "ten-realms-v4:tutorial:sample-realm:v1");
assert.equal(gameStorageKey("sample-realm", "save"), "ten-realms-v4:games:sample-realm:save:v1");
assert.equal(completionOutboxStorageKey("sample-realm"), "ten-realms-v4:games:sample-realm:completion-outbox:v1");

const outboxContext = { realm: "lunar-tide-seal", levelId: "tide-seal-3x3", tier: 1, par: 12 };
const pendingPayload = buildCompletionPayload({ ...outboxContext, moves: 14, runId: "fixture-run-001" });
assert.equal(pendingPayload.eventId, "lunar-tide-seal:tide-seal-3x3:fixture-run-001:complete");
const queuedOnce = enqueueCompletion([], pendingPayload, outboxContext);
assert.equal(queuedOnce.length, 1);
assert.deepEqual(enqueueCompletion(queuedOnce, pendingPayload, outboxContext), queuedOnce, "a refresh must not duplicate one completion event");
assert.deepEqual(normalizeCompletionOutbox([{ ...pendingPayload, moves: -1 }, pendingPayload], outboxContext), queuedOnce, "corrupt outbox records cannot replace a valid event");
assert.deepEqual(normalizeCompletionOutbox([{ ...pendingPayload, eventId: "lunar-tide-seal:tide-seal-3x3:evil:other", completionId: "lunar-tide-seal:tide-seal-3x3:evil:other" }], outboxContext), [], "an outbox event ID must match the canonical realm, level, run and completion suffix");
assert.deepEqual(acknowledgeCompletion(queuedOnce, pendingPayload.eventId, outboxContext), [], "acknowledged events leave the durable outbox");

const expectedRealms = [
  "time-cargo-bay", "quantum-apothecary", "lunar-tide-seal", "orbital-formation", "archipelago-guard",
  "shadow-print-lab", "orbit-atlas", "stellar-archive", "balance-terrace", "daynight-loom",
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
assert.equal(badgeRulesForRealm("time-cargo-bay").at(-1).clears, 1);
assert.equal(badgeRulesForRealm("daynight-loom").at(-1).clears, 1);

const now = new Date("2026-09-02T08:00:00.000Z");
const first = awardCompletion(createProgress(), {
  realm: "lunar-tide-seal",
  levelId: "tide-seal-3x3",
  tier: 2,
  moves: 18,
  par: 20,
  eventId: "lunar-tide-seal:run-a:complete",
  completionId: "lunar-tide-seal:run-a:complete",
}, now);
assert.equal(first.accepted, true);
assert.equal(first.firstClear, true);
assert.ok(first.awarded > 0);
const duplicate = awardCompletion(first.progress, {
  realm: "lunar-tide-seal",
  levelId: "tide-seal-3x3",
  tier: 2,
  moves: 18,
  par: 20,
  eventId: "lunar-tide-seal:run-a:complete",
}, new Date("2026-09-03T08:00:00.000Z"));
assert.equal(duplicate.accepted, true);
assert.equal(duplicate.duplicateEvent, true);
assert.equal(duplicate.awarded, 0);
assert.equal(duplicate.progress.xp, first.progress.xp);

const second = awardCompletion(createProgress(), {
  realm: "time-cargo-bay",
  levelId: "cargo-practice-3x3",
  tier: 1,
  moves: 5,
  par: 6,
  eventId: "time-cargo-bay:run-b:complete",
}, now);
const merged = mergeProgress(first.progress, second.progress);
assert.ok(merged.realms["lunar-tide-seal"]);
assert.ok(merged.realms["time-cargo-bay"]);
assert.deepEqual(mergeProgress(merged, merged), merged);
assert.equal(progressSummary(first.progress, "lunar-tide-seal").clears, 1);

const uiSource = await readFile(new URL("./realm-ui.mjs", import.meta.url), "utf8");
const uiStyles = await readFile(new URL("./realm-ui.css", import.meta.url), "utf8");
const gameKit = await readFile(new URL("./game-kit.mjs", import.meta.url), "utf8");
const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
assert.match(uiSource, /V4_PROGRESS_KEY/);
assert.match(uiSource, /window\.TenRealmsV4/);
assert.match(uiSource, /ten-realms-v4:realm-ready/);
assert.match(uiSource, /4\.0 十款共享/);
assert.doesNotMatch(uiSource, /ten-realms-v2/);
assert.doesNotMatch(uiSource, /ten-realms-v3/);
assert.match(uiStyles, /min-height:\s*44px/);
assert.match(uiStyles, /html:has\(dialog\[open\]\)/);
assert.match(gameKit, /completionOutboxStorageKey[\s\S]*enqueueCompletion[\s\S]*flushCompletionOutbox/, "V4 completion delivery has a durable retry path");
assert.match(gameKit, /guide\.addEventListener\("cancel"[\s\S]*closeGuide\(true\)/, "Esc marks the native tutorial as seen just like skip and finish");
assert.match(gameKit, /ten-realms-v4:realm-ready/, "a delayed shared reward host triggers an outbox retry");
assert.match(worker, /__TEN_REALMS_V4_BUILD_REVISION__/);
assert.match(worker, /ten-realms-v4-arcade-/);
assert.doesNotMatch(worker, /ten-realms-v2-arcade-/);

console.log("V4 shared reward, storage, native tutorial and cache contracts: all assertions passed.");
