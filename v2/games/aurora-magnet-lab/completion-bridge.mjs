import { evaluatePosition, normalizePosition, positionToJSON } from "./logic.mjs";
import { LEVELS } from "./levels.mjs";
import {
  STORAGE_KEYS,
  normalizeRunId,
  readOwnedJSON,
  writeOwnedJSON,
} from "./persistence.mjs";

const GAME_ID = "aurora-magnet-lab";
const EVENT_PREFIX = `${GAME_ID}:completion:`;
const ATTEMPT_PREFIX = `${GAME_ID}:attempt:`;
export const COMPLETION_OUTBOX_VERSION = 1;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function completionEventIdForRun(runId) {
  const normalized = normalizeRunId(runId);
  if (!normalized) throw new TypeError("A stable Aurora runId is required.");
  return `${EVENT_PREFIX}${normalized}`;
}

function canonicalPuzzleForDetail(value) {
  const puzzle = LEVELS.find((item) => item.id === value.levelId);
  if (!puzzle || !isPlainObject(value.puzzle)) return null;
  if (
    value.puzzle.id !== puzzle.id
    || value.puzzle.seed !== puzzle.seed
    || value.puzzle.difficulty !== puzzle.difficulty
    || value.difficulty !== puzzle.difficulty
    || value.par !== puzzle.suggestedMoves
  ) return null;
  return puzzle;
}

/**
 * Canonicalizes a completion only after replaying its stored final position
 * through the real Magnets evaluator. Shape-only payloads are intentionally
 * insufficient because the outbox is persisted browser input.
 */
export function normalizeCompletionDetail(value) {
  if (!isPlainObject(value) || value.version !== 1 || value.gameId !== GAME_ID) return null;
  const runId = normalizeRunId(value.runId);
  if (!runId || typeof value.eventId !== "string" || !value.eventId.startsWith(EVENT_PREFIX)) return null;
  const currentEventId = completionEventIdForRun(runId);
  const identityVersion = value.identityVersion === 0 ? 0 : 1;
  if (identityVersion === 1 && value.eventId !== currentEventId) return null;
  if (identityVersion === 0 && !runId.startsWith("legacy-")) return null;
  if (value.completionId !== value.eventId) return null;
  if (!Number.isInteger(value.tier) || value.tier < 1 || value.tier > 3) return null;
  if (!Number.isInteger(value.moves) || value.moves < 1) return null;
  if (!Number.isInteger(value.par) || value.par < 0) return null;

  const puzzle = canonicalPuzzleForDetail(value);
  if (!puzzle) return null;
  const expectedTier = { calibration: 1, survey: 2, storm: 3 }[puzzle.difficulty];
  if (value.tier !== expectedTier) return null;

  if (!isPlainObject(value.metrics)) return null;
  const metrics = value.metrics;
  if (
    metrics.moves !== value.moves
    || metrics.par !== value.par
    || !Number.isInteger(metrics.undos)
    || metrics.undos < 0
    || !Number.isInteger(metrics.conflictMoves)
    || metrics.conflictMoves < 0
    || metrics.conflictMoves > metrics.moves
    || !Number.isInteger(metrics.elapsedMs)
    || metrics.elapsedMs < 0
    || typeof metrics.zeroConflict !== "boolean"
    || metrics.zeroConflict !== (metrics.conflictMoves === 0)
    || metrics.rareStorm !== Boolean(puzzle.storm)
    || !Number.isInteger(metrics.bestMoves)
    || metrics.bestMoves < 1
    || (metrics.previousBestMoves !== null
      && (!Number.isInteger(metrics.previousBestMoves) || metrics.previousBestMoves < 1))
  ) return null;

  if (!Array.isArray(value.rewards) || !Array.isArray(value.achievements)) return null;
  const rewardIds = new Set();
  const rewardKinds = [];
  for (const reward of value.rewards) {
    if (
      !isPlainObject(reward)
      || typeof reward.id !== "string"
      || !reward.id.startsWith(`${GAME_ID}:`)
      || typeof reward.kind !== "string"
      || !reward.kind
      || rewardIds.has(reward.id)
    ) return null;
    rewardIds.add(reward.id);
    rewardKinds.push(reward.kind);
  }
  if (!sameJson(value.achievements, rewardKinds)) return null;
  if (typeof value.completedAt !== "string" || !Number.isFinite(Date.parse(value.completedAt))) return null;

  if (
    !isPlainObject(value.proof)
    || typeof value.proof.attemptId !== "string"
    || !value.proof.attemptId.startsWith(ATTEMPT_PREFIX)
    || !isPlainObject(value.proof.position)
  ) return null;
  const restored = normalizePosition(puzzle, value.proof.position);
  if (!evaluatePosition(puzzle, restored).complete) return null;
  const canonicalPosition = positionToJSON(restored);
  if (!sameJson(canonicalPosition, value.proof.position)) return null;

  try {
    return clone({ ...value, identityVersion, runId, proof: { ...value.proof, position: canonicalPosition } });
  } catch {
    return null;
  }
}

export function createCompletionOutbox() {
  return { version: COMPLETION_OUTBOX_VERSION, entries: {}, confirmed: {} };
}

function normalizeConfirmedEntry(eventId, value) {
  const runId = normalizeRunId(typeof value === "string" ? value : value?.runId);
  if (!eventId.startsWith(EVENT_PREFIX) || !runId) return null;
  if (eventId !== completionEventIdForRun(runId) && !runId.startsWith("legacy-")) return null;
  return runId;
}

function confirmationIsDurable(options, eventId, runId, detail = null) {
  return typeof options.validateConfirmed === "function"
    && options.validateConfirmed(eventId, runId, detail) === true;
}

export function normalizeCompletionOutbox(candidate, options = {}) {
  if (!isPlainObject(candidate) || candidate.version !== COMPLETION_OUTBOX_VERSION || !isPlainObject(candidate.entries)) {
    return null;
  }
  if (candidate.confirmed !== undefined && !isPlainObject(candidate.confirmed)) return null;
  const outbox = createCompletionOutbox();
  for (const [eventId, value] of Object.entries(candidate.entries)) {
    const detail = normalizeCompletionDetail(value);
    if (!detail || detail.eventId !== eventId) return null;
    if (typeof options.validateDetail === "function" && options.validateDetail(detail) !== true) return null;
    if (confirmationIsDurable(options, eventId, detail.runId, detail)) {
      outbox.confirmed[eventId] = detail.runId;
    } else {
      outbox.entries[eventId] = detail;
    }
  }
  for (const [eventId, value] of Object.entries(candidate.confirmed ?? {})) {
    const runId = normalizeConfirmedEntry(eventId, value);
    if (!runId) return null;
    if (typeof options.validateConfirmed === "function"
      && !confirmationIsDurable(options, eventId, runId)) continue;
    outbox.confirmed[eventId] = runId;
    delete outbox.entries[eventId];
  }
  return outbox;
}

export function mergeCompletionOutboxes(...inputs) {
  const merged = createCompletionOutbox();
  for (const input of inputs) {
    const outbox = normalizeCompletionOutbox(input);
    if (!outbox) throw new TypeError("Invalid Aurora completion outbox.");
    for (const [eventId, detail] of Object.entries(outbox.entries)) {
      const existing = merged.entries[eventId];
      if (existing && !sameJson(existing, detail)) {
        throw new Error("A completion event cannot be merged with different payload data.");
      }
      merged.entries[eventId] = detail;
    }
    for (const [eventId, runId] of Object.entries(outbox.confirmed)) {
      const existing = merged.confirmed[eventId];
      if (existing && existing !== runId) throw new Error("A completion acknowledgement cannot change run identity.");
      merged.confirmed[eventId] = runId;
      delete merged.entries[eventId];
    }
  }
  return merged;
}

export function loadCompletionOutbox(storage, options = {}) {
  const read = readOwnedJSON(storage, STORAGE_KEYS.completionOutbox);
  if (!read.available) return { outbox: createCompletionOutbox(), available: false, restored: false, corrupted: false };
  if (read.value === null) {
    return {
      outbox: createCompletionOutbox(),
      available: !read.corrupted,
      restored: false,
      corrupted: read.corrupted,
    };
  }
  const outbox = normalizeCompletionOutbox(read.value, options);
  if (!outbox) {
    // Fail closed and retain the original bytes. A malformed sibling must not
    // silently evict otherwise valid pending events.
    return { outbox: createCompletionOutbox(), available: false, restored: false, corrupted: true };
  }
  return { outbox, available: true, restored: true, corrupted: false };
}

export function saveCompletionOutbox(storage, outboxInput, options = {}) {
  const proposed = normalizeCompletionOutbox(outboxInput, options);
  if (!proposed) return false;
  const current = loadCompletionOutbox(storage, options);
  if (!current.available || current.corrupted) return false;
  let merged;
  try {
    merged = mergeCompletionOutboxes(current.outbox, proposed);
  } catch {
    return false;
  }
  return writeOwnedJSON(storage, STORAGE_KEYS.completionOutbox, merged);
}

export function stageCompletion(outboxInput, detailInput, options = {}) {
  const outbox = normalizeCompletionOutbox(outboxInput, options);
  const detail = normalizeCompletionDetail(detailInput);
  if (!outbox || !detail || (typeof options.validateDetail === "function" && options.validateDetail(detail) !== true)) {
    throw new TypeError("Invalid Aurora completion outbox entry.");
  }
  if (outbox.confirmed[detail.eventId]) return outbox;
  const existing = outbox.entries[detail.eventId];
  if (existing && !sameJson(existing, detail)) {
    throw new Error("A completion event cannot be restaged with different payload data.");
  }
  outbox.entries[detail.eventId] = detail;
  return outbox;
}

export function acknowledgeCompletion(outboxInput, eventId, options = {}) {
  if (typeof options.validateConfirmed !== "function") {
    throw new TypeError("Aurora completion acknowledgement requires a durable confirmation validator.");
  }
  const outbox = normalizeCompletionOutbox(outboxInput, options);
  if (!outbox || typeof eventId !== "string") throw new TypeError("Invalid Aurora completion acknowledgement.");
  const detail = outbox.entries[eventId];
  if (!detail) return outbox;
  if (!confirmationIsDurable(options, eventId, detail.runId, detail)) {
    throw new TypeError("Aurora completion acknowledgement requires a durable confirmed settlement.");
  }
  outbox.confirmed[eventId] = detail.runId;
  delete outbox.entries[eventId];
  return normalizeCompletionOutbox(outbox, options);
}

export function compatibilityPayload(detail) {
  return {
    levelId: detail.levelId,
    tier: detail.tier,
    difficulty: detail.difficulty,
    moves: detail.moves,
    par: detail.par,
    eventId: detail.eventId,
    completionId: detail.eventId,
    runId: detail.runId,
    gameId: detail.gameId,
    rewards: detail.rewards,
    achievements: detail.achievements,
  };
}

export function completionDeliveryConfirmed(profileSaved, outboxSaved, delivery) {
  return profileSaved === true && outboxSaved === true && delivery?.hostConfirmed === true;
}

function enqueueOnce(target, payload) {
  try {
    let queue = target.__realmCompletionQueue;
    if (!Array.isArray(queue)) {
      queue = [];
      target.__realmCompletionQueue = queue;
    }
    const alreadyQueued = queue.some((entry) => entry?.gameId === payload.gameId && entry?.eventId === payload.eventId);
    if (!alreadyQueued) queue.push(payload);
    return true;
  } catch {
    return false;
  }
}

function removeQueued(target, payload) {
  try {
    const queue = target?.__realmCompletionQueue;
    if (!Array.isArray(queue)) return;
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const entry = queue[index];
      if (entry?.gameId === payload.gameId && entry?.eventId === payload.eventId) queue.splice(index, 1);
    }
  } catch {
    // A confirmed host delivery remains valid even if a stale queue copy is sealed.
  }
}

export function publishCompletion(target, detail, eventName, options = {}) {
  const normalized = normalizeCompletionDetail(detail);
  if (!normalized) throw new TypeError("Refusing to publish an invalid Aurora completion.");
  const payload = compatibilityPayload(normalized);
  let hostConfirmed = false;
  try {
    const complete = target?.RealmArcade?.complete;
    if (typeof complete === "function") {
      complete.call(target.RealmArcade, payload);
      hostConfirmed = true;
      removeQueued(target, payload);
    }
  } catch {
    // The durable outbox retains this exact event ID for a later retry.
  }

  const queued = !hostConfirmed && target ? enqueueOnce(target, payload) : false;
  let eventDispatched = false;
  try {
    const CustomEventConstructor = options.CustomEvent ?? target?.CustomEvent;
    if (typeof target?.dispatchEvent === "function" && typeof CustomEventConstructor === "function") {
      target.dispatchEvent(new CustomEventConstructor(eventName, { detail: normalized }));
      eventDispatched = true;
    }
  } catch {
    // Observers never acknowledge or interrupt the game's own completion UI.
  }
  return { payload, hostConfirmed, compatibilityReported: hostConfirmed, queued, eventDispatched };
}

export function flushCompletionOutbox(outboxInput, target, eventName, options = {}) {
  const outbox = normalizeCompletionOutbox(outboxInput, {
    validateConfirmed: options.validateConfirmed,
  });
  if (!outbox) throw new TypeError("Invalid Aurora completion outbox.");
  const confirmedEventIds = [];
  const confirmedRunIds = [];
  const queuedEventIds = [];
  const blockedEventIds = [];
  const deliveries = [];
  for (const [eventId, detail] of Object.entries(outbox.entries)) {
    if (typeof options.validateDetail === "function" && options.validateDetail(detail) !== true) {
      blockedEventIds.push(eventId);
      continue;
    }
    const delivery = publishCompletion(target, detail, eventName, options);
    deliveries.push({ eventId, delivery });
    if (delivery.hostConfirmed) {
      confirmedEventIds.push(eventId);
      confirmedRunIds.push(detail.runId);
    } else if (delivery.queued) {
      queuedEventIds.push(eventId);
    }
  }
  return { outbox, confirmedEventIds, confirmedRunIds, queuedEventIds, blockedEventIds, deliveries };
}

export function completionConfirmedForRun(runIds, runId) {
  const normalized = normalizeRunId(runId);
  return Boolean(normalized && Array.isArray(runIds) && runIds.includes(normalized));
}
