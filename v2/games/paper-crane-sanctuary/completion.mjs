import { loadOutbox, saveOutbox } from "./storage.mjs";
import {
  COMPLETION_SCHEMA,
  GAME_ID,
  METRIC_NOTE,
  normalizeCompletionPayload,
  replayCompletionTimeline,
  sameReplayedState,
  validRunId,
  validateCompletionPayload,
} from "./completion-proof.mjs";

export { COMPLETION_SCHEMA, GAME_ID, normalizeCompletionPayload, validateCompletionPayload };
export const COMPLETION_EVENT = "ten-realms-v2:game-complete";
const TIER = Object.freeze({ easy: 1, medium: 2, hard: 3 });
const deliveredByTarget = new WeakMap();

export function createCompletionPayload({ level, runId, state, moves, elapsedMs, undoCount = 0, restartCount = 0, completedAt = new Date() }) {
  const proof = replayCompletionTimeline(level, moves);
  const date = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (!level || !proof || !sameReplayedState(state, proof.state) || !validRunId(runId)
      || !Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || !Number.isFinite(date.getTime())
      || !Number.isSafeInteger(undoCount) || undoCount < 0
      || !Number.isSafeInteger(restartCount) || restartCount < 0
      || TIER[level.difficulty] === undefined) {
    throw new TypeError("A verified completed Pegs state is required.");
  }
  const payload = {
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId,
    eventId: `${GAME_ID}:${runId}:complete`,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: TIER[level.difficulty],
    puzzleSeed: level.seed,
    timeline: proof.timeline,
    moves: proof.timeline.length,
    elapsedMs,
    undoCount,
    restartCount,
    noUndo: undoCount === 0,
    noRestart: restartCount === 0,
    completedAt: date.toISOString(),
    metricNote: METRIC_NOTE,
  };
  const normalized = normalizeCompletionPayload(payload);
  if (!normalized) throw new TypeError("Invalid Pegs completion payload.");
  return normalized;
}

function remember(target, eventId) {
  const ids = deliveredByTarget.get(target) ?? new Set();
  ids.add(eventId);
  deliveredByTarget.set(target, ids);
}

function alreadyDelivered(target, eventId) {
  return deliveredByTarget.get(target)?.has(eventId) ?? false;
}

function enqueueWindow(target, payload) {
  try {
    const queue = Array.isArray(target.__realmCompletionQueue) ? target.__realmCompletionQueue : [];
    const withoutDuplicate = queue.filter((item) => item?.eventId !== payload.eventId);
    target.__realmCompletionQueue = [...withoutDuplicate, payload];
    return true;
  } catch { return false; }
}

function removeWindowCopy(target, eventId) {
  try {
    if (!Array.isArray(target.__realmCompletionQueue)) return;
    target.__realmCompletionQueue = target.__realmCompletionQueue.filter((item) => item?.eventId !== eventId);
  } catch { /* best effort */ }
}

function retainLocally(storage, payload) {
  const current = loadOutbox(storage).filter((item) => item.eventId !== payload.eventId);
  return saveOutbox(storage, [...current, payload]);
}

function settleLocally(storage, eventId) {
  return saveOutbox(storage, loadOutbox(storage).filter((item) => item.eventId !== eventId));
}

export function publishCompletion(target, storage, payload) {
  const canonical = normalizeCompletionPayload(payload);
  if (!target || !canonical) return { retained: false, delivered: false, transport: null };
  if (alreadyDelivered(target, canonical.eventId)) {
    removeWindowCopy(target, canonical.eventId);
    settleLocally(storage, canonical.eventId);
    return { retained: true, delivered: true, transport: "realm-arcade" };
  }
  const persisted = retainLocally(storage, canonical);
  if (!persisted) return { retained: false, delivered: false, transport: null };
  try {
    if (typeof target.RealmArcade?.complete === "function") {
      removeWindowCopy(target, canonical.eventId);
      target.RealmArcade.complete(canonical);
      settleLocally(storage, canonical.eventId);
      remember(target, canonical.eventId);
      try {
        const EventClass = target.CustomEvent ?? globalThis.CustomEvent;
        if (typeof EventClass === "function" && typeof target.dispatchEvent === "function") {
          target.dispatchEvent(new EventClass(COMPLETION_EVENT, { detail: canonical }));
        }
      } catch { /* observation only */ }
      return { retained: true, delivered: true, transport: "realm-arcade" };
    }
  } catch {
    // The durable outbox below remains the source of truth.
  }
  const queued = enqueueWindow(target, canonical);
  return { retained: true, delivered: false, transport: queued ? "queue" : "outbox" };
}

/**
 * Gate a live settlement on its records and session writes. The delegated
 * transport still persists the private outbox before invoking the host. A
 * later outbox flush calls `publishCompletion` directly because the durable,
 * replay-verified payload is then the recovery source of truth.
 */
export function publishPersistedCompletion(target, storage, payload, writes = {}) {
  if (!writes || writes.recordsSaved !== true || writes.sessionSaved !== true) {
    return { retained: false, delivered: false, transport: null };
  }
  return publishCompletion(target, storage, payload);
}

export function flushOutbox(target, storage) {
  const results = [];
  for (const payload of loadOutbox(storage)) results.push({ payload, result: publishCompletion(target, storage, payload) });
  return results;
}
