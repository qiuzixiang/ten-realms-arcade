import { createState, isWon, replayTimeline, restoreState, stateEquals } from "./logic.mjs";

export const STORAGE_PREFIX = "ten-realms-v3:games:stardust-survey:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`,
  settings: `${STORAGE_PREFIX}settings:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
  records: `${STORAGE_PREFIX}records:v1`,
  outbox: `${STORAGE_PREFIX}outbox:v1`,
});

const runPattern = /^run-[a-z0-9-]{3,80}$/i;

export function createRunId(now = Date.now(), random = Math.random()) {
  return `run-${Math.floor(now).toString(36)}-${Math.floor(random * 0x100000000).toString(36)}`;
}

export function createSession(level, runId = createRunId()) {
  return {
    version: 1,
    levelId: level.id,
    runId,
    state: createState(level),
    timeline: [],
    completed: false,
    reported: false,
    completedAt: null,
  };
}

/** Session restore replays the real actions, rather than trusting its board or win boolean. */
export function normalizeSession(candidate, levels) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) || candidate.version !== 1
    || typeof candidate.levelId !== "string" || !runPattern.test(candidate.runId ?? "")) return null;
  const level = levels.find((item) => item.id === candidate.levelId);
  if (!level || !Array.isArray(candidate.timeline)) return null;
  const replayed = replayTimeline(level, candidate.timeline);
  if (!replayed) return null;
  const stored = restoreState(candidate.state, level);
  if (!stateEquals(stored, candidate.state) || !stateEquals(stored, replayed.state)) return null;
  const completed = isWon(replayed.state, level);
  const completedAt = typeof candidate.completedAt === "string" && !Number.isNaN(Date.parse(candidate.completedAt))
    ? candidate.completedAt : null;
  return {
    version: 1,
    levelId: level.id,
    runId: candidate.runId,
    state: replayed.state,
    timeline: candidate.timeline.map((action) => Object.freeze({ ...action })),
    completed,
    reported: completed && candidate.reported === true,
    completedAt: completed ? completedAt : null,
  };
}

export function historyForSession(level, timeline) {
  return replayTimeline(level, timeline)?.history ?? [];
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage; }
  catch { return null; }
}

export function readJsonResult(key, fallback = null, storage = undefined) {
  const target = resolveStorage(storage);
  if (typeof target?.getItem !== "function") return { value: fallback, status: "unavailable", available: false };
  let raw;
  try { raw = target.getItem(key); }
  catch { return { value: fallback, status: "unavailable", available: false }; }
  if (raw === null || raw === undefined) return { value: fallback, status: "empty", available: true };
  try { return { value: JSON.parse(raw), status: "restored", available: true }; }
  catch { return { value: fallback, status: "invalid", available: true }; }
}

export function readJson(key, fallback = null, storage = undefined) {
  return readJsonResult(key, fallback, storage).value;
}

export function writeJson(key, value, storage = undefined) {
  const target = resolveStorage(storage);
  if (typeof target?.setItem !== "function") return false;
  try {
    target.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
