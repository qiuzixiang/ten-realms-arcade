import { DIFFICULTIES, findLevel } from "./logic.mjs";

export const PHOTO_GAME_ID = "mist-photo-studio";

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{7,95}$/i;

function validRunId(value) {
  return typeof value === "string"
    && RUN_ID_PATTERN.test(value)
    && !["__proto__", "prototype", "constructor"].includes(value);
}

export function createPhotoRunId(uuidFactory) {
  let candidate = "";
  try {
    candidate = typeof uuidFactory === "function"
      ? uuidFactory()
      : globalThis.crypto?.randomUUID?.();
  } catch {
    // A UUID source is optional; the fallback still distinguishes fresh runs.
  }
  if (validRunId(candidate)) return candidate;
  const random = Math.random().toString(36).slice(2, 14).padEnd(12, "0");
  return `run-${Date.now().toString(36)}-${random}`;
}

export function photoCompletionEventId(runId) {
  if (!validRunId(runId)) throw new TypeError("Invalid mist-photo-studio run id.");
  return `${PHOTO_GAME_ID}:${runId}:complete`;
}

export function photoCompletionPayload(state) {
  const level = findLevel(state?.levelId);
  const difficulty = level ? DIFFICULTIES.find(({ id }) => id === level.difficulty) : null;
  if (!level || !difficulty || !validRunId(state.runId)) return null;
  return {
    runId: state.runId,
    eventId: photoCompletionEventId(state.runId),
    levelId: `photo:${level.difficulty}:${level.id}`,
    tier: difficulty.tier,
    moves: Number.isInteger(state.moves) && state.moves >= 0 ? Math.min(state.moves, 1_000_000) : 0,
    par: level.par,
  };
}

function normalizePhotoCompletionPayload(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const match = typeof candidate.eventId === "string"
    ? candidate.eventId.match(/^mist-photo-studio:([a-z0-9][a-z0-9._-]{7,95}):complete$/i)
    : null;
  if (
    !match
    || !validRunId(match[1])
    || (candidate.runId !== undefined && candidate.runId !== match[1])
    || typeof candidate.levelId !== "string"
  ) return null;
  const level = findLevel(candidate.levelId.replace(/^photo:[a-z0-9-]+:/, ""));
  const difficulty = level ? DIFFICULTIES.find(({ id }) => id === level.difficulty) : null;
  if (
    !level
    || !difficulty
    || candidate.levelId !== `photo:${level.difficulty}:${level.id}`
    || candidate.tier !== difficulty.tier
    || candidate.par !== level.par
    || !Number.isInteger(candidate.moves)
    || candidate.moves < 0
    || candidate.moves > 1_000_000
  ) return null;
  return {
    runId: match[1],
    eventId: photoCompletionEventId(match[1]),
    levelId: `photo:${level.difficulty}:${level.id}`,
    tier: difficulty.tier,
    moves: candidate.moves,
    par: level.par,
  };
}

export function normalizePhotoCompletionOutbox(candidate) {
  if (!Array.isArray(candidate)) return [];
  const seen = new Set();
  const clean = [];
  for (const entry of candidate) {
    const payload = normalizePhotoCompletionPayload(entry);
    if (!payload || seen.has(payload.eventId)) continue;
    seen.add(payload.eventId);
    clean.push(payload);
  }
  // Do not evict a valid unacknowledged event merely because the shared host
  // has been unavailable for many runs.
  return clean;
}

export function startPhotoRun(session, {
  runId = createPhotoRunId(),
  completionOutbox = [],
} = {}) {
  const safeRunId = validRunId(runId) ? runId : createPhotoRunId();
  return {
    ...session,
    runId: safeRunId,
    completionEventId: photoCompletionEventId(safeRunId),
    completionOutbox: normalizePhotoCompletionOutbox(completionOutbox),
    completionRecorded: false,
    completionReported: false,
  };
}

export function restorePhotoCompletionFlags(session, storedSession) {
  const runId = validRunId(storedSession?.runId) ? storedSession.runId : createPhotoRunId();
  const completionEventId = photoCompletionEventId(runId);
  const completionReported = session?.completionReported === true;
  const completionRecorded = storedSession?.completionRecorded === true || completionReported;
  let completionOutbox = normalizePhotoCompletionOutbox(storedSession?.completionOutbox);
  if (completionReported) {
    completionOutbox = completionOutbox.filter(({ eventId }) => eventId !== completionEventId);
  }
  const restored = {
    ...session,
    runId,
    completionEventId,
    completionOutbox,
    completionRecorded,
    completionReported,
  };
  if (restored.completed && completionRecorded && !completionReported) {
    const payload = photoCompletionPayload(restored);
    if (payload && !completionOutbox.some(({ eventId }) => eventId === payload.eventId)) {
      restored.completionOutbox = [...completionOutbox, payload];
    }
  }
  return restored;
}

export function recordPhotoCompletionOnce(state, collection, completion, recordCompletion) {
  if (!state?.completed) return { state, collection, recorded: false, result: null };
  const runId = validRunId(state.runId) ? state.runId : createPhotoRunId();
  let next = {
    ...state,
    runId,
    completionEventId: photoCompletionEventId(runId),
    completionOutbox: normalizePhotoCompletionOutbox(state.completionOutbox),
  };
  let nextCollection = collection;
  let result = null;
  let recorded = false;
  if (next.completionRecorded !== true && typeof recordCompletion === "function") {
    result = recordCompletion(collection, completion);
    nextCollection = result.progress;
    next = { ...next, completionRecorded: true };
    recorded = true;
  }
  if (next.completionRecorded === true && next.completionReported !== true) {
    const payload = photoCompletionPayload(next);
    if (payload && !next.completionOutbox.some(({ eventId }) => eventId === payload.eventId)) {
      next.completionOutbox = [...next.completionOutbox, payload];
    }
  }
  return { state: next, collection: nextCollection, recorded, result };
}

export function confirmPhotoCompletion(state, reportCompletion) {
  const pending = normalizePhotoCompletionOutbox(state?.completionOutbox);
  if (!pending.length || typeof reportCompletion !== "function") {
    return {
      state: { ...state, completionOutbox: pending },
      attempted: false,
      succeeded: pending.length === 0,
      reward: null,
      rewards: [],
    };
  }
  const rewards = [];
  let completionReported = state.completionReported === true;
  while (pending.length) {
    const payload = pending[0];
    try {
      rewards.push(reportCompletion(payload));
      pending.shift();
      if (payload.eventId === state.completionEventId) completionReported = true;
    } catch {
      return {
        state: { ...state, completionReported, completionOutbox: pending },
        attempted: true,
        succeeded: false,
        reward: rewards.at(-1) ?? null,
        rewards,
      };
    }
  }
  return {
    state: { ...state, completionReported, completionOutbox: pending },
    attempted: true,
    succeeded: true,
    reward: rewards.at(-1) ?? null,
    rewards,
  };
}
