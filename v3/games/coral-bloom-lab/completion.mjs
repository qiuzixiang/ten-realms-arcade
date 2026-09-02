import { levelById } from "./levels.mjs";
import { normalizeTimeline, replayTimeline } from "./logic.mjs";
import { STORAGE_KEYS, validEventId, validRunId, readJson, writeJson } from "./storage.mjs";

export const GAME_ID = "coral-bloom-lab";
export const COMPLETION_SCHEMA = "ten-realms-v3.game-complete";
export const COMPLETION_EVENT = "ten-realms-v3:game-complete";
export const COMPLETION_QUEUE = "__realmCompletionQueue";
const transports = new WeakMap();

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function integer(value, minimum = 0, maximum = 1_000_000) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function canonicalLevel(value) {
  const level = levelById(value?.id ?? value);
  return level && (typeof value === "string" || level === value) ? level : null;
}

export function normalizeCompletion(source) {
  if (!plainObject(source) || source.schema !== COMPLETION_SCHEMA || source.schemaVersion !== 1
      || source.gameId !== GAME_ID || source.realm !== GAME_ID || !validRunId(source.runId)
      || !validEventId(source.eventId) || source.eventId !== `${GAME_ID}:${source.runId}:complete`
      || !integer(source.moves, 1, 4096) || !integer(source.elapsedMs, 0, 2_592_000_000)
      || typeof source.completedAt !== "string" || !Number.isFinite(Date.parse(source.completedAt))) return null;
  const level = canonicalLevel(source.levelId);
  if (!level || source.difficulty !== level.difficulty || source.tier !== level.tier || source.seed !== level.seed || source.par !== level.par) return null;
  const timeline = normalizeTimeline(level, source.timeline);
  const replay = timeline ? replayTimeline(level, timeline) : null;
  if (!replay?.evaluation.complete || replay.timeline.length !== source.moves) return null;
  return Object.freeze({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId: source.runId,
    eventId: `${GAME_ID}:${source.runId}:complete`,
    completionId: `${GAME_ID}:${source.runId}:complete`,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: level.tier,
    seed: level.seed,
    par: level.par,
    moves: replay.timeline.length,
    elapsedMs: source.elapsedMs,
    timeline: replay.timeline,
    completedAt: new Date(source.completedAt).toISOString(),
  });
}

export function validCompletion(value) {
  return normalizeCompletion(value) !== null;
}

export function createCompletion(level, session, completedAt = new Date()) {
  const official = canonicalLevel(level);
  const date = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (!official || official !== level || !session || !validRunId(session.runId) || !Number.isFinite(date.getTime())) {
    throw new TypeError("Completion requires an official level, replay-proof session and stable run id");
  }
  const payload = normalizeCompletion({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId: session.runId,
    eventId: `${GAME_ID}:${session.runId}:complete`,
    levelId: official.id,
    difficulty: official.difficulty,
    tier: official.tier,
    seed: official.seed,
    par: official.par,
    moves: session.timeline?.length,
    elapsedMs: Math.max(0, Math.floor(session.elapsedMs ?? 0)),
    timeline: session.timeline,
    completedAt: date.toISOString(),
  });
  if (!payload) throw new TypeError("Completion does not replay to a solved coral nursery");
  return payload;
}

function outboxItems(storage) {
  const raw = readJson(STORAGE_KEYS.outbox, null, storage);
  if (!plainObject(raw) || raw.version !== 1 || !Array.isArray(raw.items)) return [];
  return raw.items.map(normalizeCompletion).filter(Boolean);
}

export function loadCompletionOutbox(storage) {
  return Object.freeze(outboxItems(storage));
}

/** Durable private outbox comes before any bridge call. */
export function enqueueCompletion(storage, value) {
  const payload = normalizeCompletion(value);
  if (!payload || !storage) return Object.freeze({ retained: false, payload: null });
  const items = outboxItems(storage);
  const merged = [...items.filter((item) => item.eventId !== payload.eventId), payload];
  const retained = writeJson(STORAGE_KEYS.outbox, { version: 1, items: merged }, storage);
  return Object.freeze({ retained, payload: retained ? payload : null });
}

export function removeCompletion(storage, eventId) {
  if (!validEventId(eventId) || !storage) return Object.freeze({ removed: false });
  const items = outboxItems(storage);
  const next = items.filter((item) => item.eventId !== eventId);
  if (next.length === items.length) return Object.freeze({ removed: false });
  return Object.freeze({ removed: writeJson(STORAGE_KEYS.outbox, { version: 1, items: next }, storage) });
}

function retainQueue(target, payload) {
  try {
    const current = Array.isArray(target[COMPLETION_QUEUE]) ? target[COMPLETION_QUEUE].map(normalizeCompletion).filter(Boolean) : [];
    target[COMPLETION_QUEUE] = [...current.filter((item) => item.eventId !== payload.eventId), payload];
    return true;
  } catch { return false; }
}

function observe(target, payload, delivered) {
  try {
    if (typeof target?.dispatchEvent === "function" && typeof target.CustomEvent === "function") {
      target.dispatchEvent(new target.CustomEvent(COMPLETION_EVENT, { detail: payload }));
    }
  } catch {
    // CustomEvent is observational only; it never confirms delivery.
  }
  return delivered;
}

/** Calls exactly one compatible host bridge; retries keep the same event id. */
export function deliverCompletion(target, value) {
  const payload = normalizeCompletion(value);
  if (!target || !payload) return Object.freeze({ delivered: false, queued: false, transport: null });
  const known = transports.get(target) ?? new Map();
  if (known.get(payload.eventId) === "delivered") return Object.freeze({ delivered: true, queued: false, transport: "deduped" });
  for (const [name, host] of [["ten-realms-v3", target.TenRealmsV3], ["realm-arcade", target.RealmArcade]]) {
    try {
      if (typeof host?.complete !== "function") continue;
      host.complete(payload);
      known.set(payload.eventId, "delivered");
      transports.set(target, known);
      observe(target, payload, true);
      return Object.freeze({ delivered: true, queued: false, transport: name });
    } catch {
      // A bridge that cannot persist progress must not consume the outbox item.
    }
  }
  const queued = retainQueue(target, payload);
  if (queued) {
    known.set(payload.eventId, "queued");
    transports.set(target, known);
    observe(target, payload, false);
  }
  return Object.freeze({ delivered: false, queued, transport: queued ? "queue" : null });
}
