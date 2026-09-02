import { loadOutbox, saveOutbox } from "./storage.mjs";
import {
  COMPLETION_SCHEMA,
  GAME_ID,
  normalizeCompletionPayload,
  replayCompletionTimeline,
  sameReplayedState,
  validRunId,
  validateCompletionPayload,
} from "./completion-proof.mjs";

export { COMPLETION_SCHEMA, GAME_ID, normalizeCompletionPayload, validateCompletionPayload };
export const COMPLETION_EVENT = "ten-realms-v3:game-complete";
const TIER = Object.freeze({ easy: 1, medium: 2, hard: 3 });
const deliveredByTarget = new WeakMap();

export function createCompletionPayload({ level, runId, state, actions, elapsedMs, conflictActions = 0, undoCount = 0, completedAt = new Date() }) {
  const proof = replayCompletionTimeline(level, actions);
  const date = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (!proof || !sameReplayedState(state, proof.state) || !validRunId(runId)
      || !Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || !Number.isFinite(date.getTime())
      || !Number.isSafeInteger(conflictActions) || conflictActions < 0
      || !Number.isSafeInteger(undoCount) || undoCount < 0
      || TIER[level?.difficulty] === undefined) {
    throw new TypeError("A verified completed Slant state is required.");
  }
  const payload = {
    schema: COMPLETION_SCHEMA, schemaVersion: 1, gameId: GAME_ID, runId,
    realm: GAME_ID,
    eventId: `${GAME_ID}:${runId}:complete`, levelId: level.id, difficulty: level.difficulty,
    tier: TIER[level.difficulty], puzzleSeed: level.seed, timeline: proof.timeline,
    moves: proof.timeline.length, elapsedMs, conflictActions, undoCount,
    noConflict: conflictActions === 0, noUndo: undoCount === 0, completedAt: date.toISOString(),
  };
  const normalized = normalizeCompletionPayload(payload);
  if (!normalized) throw new TypeError("Invalid Slant completion payload.");
  return normalized;
}

function idsFor(target) { const ids = deliveredByTarget.get(target) ?? new Set(); deliveredByTarget.set(target, ids); return ids; }
function retain(storage, payload) { const values = loadOutbox(storage).filter((item) => item.eventId !== payload.eventId); return saveOutbox(storage, [...values, payload]); }
function settle(storage, eventId) { return saveOutbox(storage, loadOutbox(storage).filter((item) => item.eventId !== eventId)); }
function queue(target, payload) {
  try { const values = Array.isArray(target.__realmCompletionQueue) ? target.__realmCompletionQueue : []; target.__realmCompletionQueue = [...values.filter((item) => item?.eventId !== payload.eventId), payload]; return true; } catch { return false; }
}
function removeQueueCopy(target, eventId) { try { if (Array.isArray(target.__realmCompletionQueue)) target.__realmCompletionQueue = target.__realmCompletionQueue.filter((item) => item?.eventId !== eventId); } catch { /* best effort */ } }

export function publishCompletion(target, storage, payload) {
  const canonical = normalizeCompletionPayload(payload);
  if (!target || !canonical) return { retained: false, delivered: false, transport: null };
  const delivered = idsFor(target);
  if (delivered.has(canonical.eventId)) {
    removeQueueCopy(target, canonical.eventId);
    settle(storage, canonical.eventId);
    return { retained: true, delivered: true, transport: "realm-arcade" };
  }
  const persisted = retain(storage, canonical);
  if (!persisted) return { retained: false, delivered: false, transport: null };
  try {
    if (typeof target.RealmArcade?.complete === "function") {
      removeQueueCopy(target, canonical.eventId);
      target.RealmArcade.complete(canonical);
      settle(storage, canonical.eventId);
      delivered.add(canonical.eventId);
      try { const EventClass = target.CustomEvent ?? globalThis.CustomEvent; if (typeof EventClass === "function" && typeof target.dispatchEvent === "function") target.dispatchEvent(new EventClass(COMPLETION_EVENT, { detail: canonical })); } catch { /* observation only */ }
      return { retained: true, delivered: true, transport: "realm-arcade" };
    }
  } catch { /* durable outbox remains */ }
  const queued = queue(target, canonical);
  return { retained: true, delivered: false, transport: queued ? "queue" : "outbox" };
}

/**
 * A live run may contact the host only after both of its durable local
 * settlement writes have succeeded. `publishCompletion` then adds the third
 * durable leg (the private outbox) before it invokes the host API.
 *
 * Outbox replay intentionally calls `publishCompletion` directly: an entry
 * that survived in the outbox has already crossed this gate in an earlier
 * page lifetime and contains its own replayable completion proof.
 */
export function publishPersistedCompletion(target, storage, payload, writes = {}) {
  if (!writes || writes.recordsSaved !== true || writes.sessionSaved !== true) {
    return { retained: false, delivered: false, transport: null };
  }
  return publishCompletion(target, storage, payload);
}

export function flushOutbox(target, storage) {
  return loadOutbox(storage).map((payload) => ({ payload, result: publishCompletion(target, storage, payload) }));
}
