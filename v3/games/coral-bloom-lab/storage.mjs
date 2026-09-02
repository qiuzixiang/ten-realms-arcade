import { replayTimeline, restoreState, serializeState } from "./logic.mjs";

export const STORAGE_PREFIX = "ten-realms-v3:games:coral-bloom-lab:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
  outbox: `${STORAGE_PREFIX}outbox:v1`,
});

const RUN_ID = /^coral-bloom-lab-[a-z0-9]+-[a-z0-9]+$/;
const EVENT_ID = /^coral-bloom-lab:[a-z0-9-]+:complete$/;

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exact(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validRunId(value) {
  return typeof value === "string" && RUN_ID.test(value) && value.length <= 120;
}

export function validEventId(value) {
  return typeof value === "string" && EVENT_ID.test(value) && value.length <= 180;
}

export function createRunId(now = Date.now(), entropy = Math.floor(Math.random() * 0x7fffffff)) {
  const timestamp = Number.isSafeInteger(Math.floor(Number(now))) && Number(now) >= 0 ? Math.floor(Number(now)) : Date.now();
  const salt = typeof entropy === "string"
    ? entropy.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)
    : Math.max(0, Math.floor(Number(entropy) || 0)).toString(36);
  return `coral-bloom-lab-${timestamp.toString(36)}-${salt || "0"}`;
}

export function readJsonResult(key, fallback = null, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(key);
    if (raw === null || raw === undefined) return { value: fallback, available: true };
    return { value: JSON.parse(raw), available: true };
  } catch {
    return { value: fallback, available: false };
  }
}

export function readJson(key, fallback = null, storage = globalThis.localStorage) {
  return readJsonResult(key, fallback, storage).value;
}

export function writeJson(key, value, storage = globalThis.localStorage) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function createSession(level, runId = createRunId()) {
  if (!level || !validRunId(runId)) throw new TypeError("A canonical level and stable run id are required");
  const replay = replayTimeline(level, []);
  return {
    version: 1,
    levelId: level.id,
    runId,
    state: replay.state,
    timeline: [],
    completed: false,
    reported: false,
    completion: null,
  };
}

function normalizeCompletionHint(value, runId, solved) {
  if (value === null || value === undefined) return null;
  if (!plainObject(value) || !validEventId(value.eventId) || value.eventId !== `coral-bloom-lab:${runId}:complete`
      || typeof value.delivered !== "boolean" || typeof value.completedAt !== "string" || !Number.isFinite(Date.parse(value.completedAt)) || !solved) return null;
  return { eventId: value.eventId, delivered: value.delivered, completedAt: new Date(value.completedAt).toISOString() };
}

/** Restores only a replay-proof session; answer arrays and completion flags are never trusted. */
export function normalizeSession(source, levels) {
  if (!plainObject(source) || source.version !== 1 || !validRunId(source.runId) || !Array.isArray(levels)) return null;
  const level = levels.find((candidate) => candidate.id === source.levelId);
  if (!level || !Array.isArray(source.timeline)) return null;
  const replay = replayTimeline(level, source.timeline);
  const restored = replay && plainObject(source.state) ? restoreState(level, source.state) : null;
  if (!replay || !restored || !exact(
    { values: replay.state.values, moves: replay.state.moves },
    { values: restored.values, moves: restored.moves },
  )) return null;
  const completion = normalizeCompletionHint(source.completion, source.runId, replay.evaluation.complete);
  if (source.completion !== null && source.completion !== undefined && !completion) return null;
  return {
    version: 1,
    levelId: level.id,
    runId: source.runId,
    // Candidate spore notes have no truth-bearing role, but are still restored
    // after the formal values and move count are replay-verified.
    state: restored,
    timeline: [...replay.timeline],
    completed: replay.evaluation.complete,
    reported: completion?.delivered === true,
    completion,
  };
}

export function saveSession(storage, session) {
  if (!session?.levelId || !validRunId(session.runId)) return false;
  return writeJson(STORAGE_KEYS.session, {
    version: 1,
    levelId: session.levelId,
    runId: session.runId,
    state: serializeState(session.state),
    timeline: session.timeline,
    completed: session.completed === true,
    reported: session.reported === true,
    completion: session.completion,
  }, storage);
}

export function tutorialSeen(storage = globalThis.localStorage) {
  try { return storage?.getItem?.(STORAGE_KEYS.tutorial) === "seen-v1"; } catch { return false; }
}

export function markTutorialSeen(storage = globalThis.localStorage) {
  try { storage?.setItem?.(STORAGE_KEYS.tutorial, "seen-v1"); return typeof storage?.setItem === "function"; } catch { return false; }
}
