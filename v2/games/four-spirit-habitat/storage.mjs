import { analyse, createState, replayColourTimeline, restoreState } from "./logic.mjs";

export const STORAGE_PREFIX = "ten-realms-v2:games:four-spirit-habitat:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`,
  settings: `${STORAGE_PREFIX}settings:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
  outbox: `${STORAGE_PREFIX}outbox:v1`,
});

export function createRunId(now = Date.now(), random = Math.random()) {
  return `run-${Math.floor(now).toString(36)}-${Math.floor(random * 0x100000000).toString(36)}`;
}

export function createSession(level, runId = createRunId()) {
  return {
    version: 1,
    levelId: level.id,
    runId,
    state: createState(level),
    history: [],
    timeline: [],
    completed: false,
    reported: false,
  };
}

export function normalizeSession(candidate, levels) {
  if (!candidate || typeof candidate !== "object" || candidate.version !== 1 || typeof candidate.levelId !== "string") return null;
  const level = levels.find((item) => item.id === candidate.levelId);
  if (!level || !/^run-[a-z0-9-]{3,80}$/i.test(candidate.runId ?? "")) return null;
  const state = restoreState(candidate.state, level);
  const replayed = replayColourTimeline(level, candidate.timeline);
  if (!replayed
    || replayed.moves !== state.moves
    || replayed.colours.some((colour, region) => colour !== state.colours[region])) return null;
  const history = Array.isArray(candidate.history) ? candidate.history.slice(-100).map((entry) => restoreState(entry, level)) : [];
  let priorMoves = null;
  for (const snapshot of history) {
    const prefix = replayColourTimeline(level, candidate.timeline.slice(0, snapshot.moves));
    if (!prefix
      || (priorMoves !== null && snapshot.moves < priorMoves)
      || (priorMoves !== null && snapshot.moves - priorMoves > 1)
      || snapshot.moves > state.moves
      || prefix.colours.some((colour, region) => colour !== snapshot.colours[region])) return null;
    priorMoves = snapshot.moves;
  }
  const completed = analyse(state, level).solved;
  return {
    version: 1,
    levelId: level.id,
    runId: candidate.runId,
    state,
    history,
    timeline: candidate.timeline.map(({ region, colour }) => ({ region, colour })),
    completed,
    reported: completed && candidate.reported === true,
  };
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
  try {
    if (typeof target?.setItem !== "function") return false;
    target.setItem(key, JSON.stringify(value));
    return true;
  }
  catch { return false; }
}
