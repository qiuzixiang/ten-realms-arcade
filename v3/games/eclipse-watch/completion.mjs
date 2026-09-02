import { levelById } from "./levels.mjs";
import { normalizeTimeline, replayTimeline } from "./logic.mjs";
import { STORAGE_KEYS, validEventId, validRunId, readJson, writeJson } from "./storage.mjs";

export const GAME_ID = "eclipse-watch";
export const COMPLETION_SCHEMA = "ten-realms-v3.game-complete";
export const COMPLETION_EVENT = "ten-realms-v3:game-complete";
export const COMPLETION_QUEUE = "__realmCompletionQueue";
const transports = new WeakMap();
const plainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const integer = (value, minimum = 0, maximum = 1_000_000) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;

function canonicalLevel(value) { const level = levelById(value?.id ?? value); return level && (typeof value === "string" || level === value) ? level : null; }

export function normalizeCompletion(source) {
  if (!plainObject(source) || source.schema !== COMPLETION_SCHEMA || source.schemaVersion !== 1 || source.gameId !== GAME_ID || source.realm !== GAME_ID
      || !validRunId(source.runId) || !validEventId(source.eventId) || source.eventId !== `${GAME_ID}:${source.runId}:complete`
      || !integer(source.moves, 0, 4096) || !integer(source.elapsedMs, 0, 2_592_000_000) || typeof source.completedAt !== "string" || !Number.isFinite(Date.parse(source.completedAt))) return null;
  const level = canonicalLevel(source.levelId);
  if (!level || source.difficulty !== level.difficulty || source.tier !== level.tier || source.seed !== level.seed || source.par !== level.par) return null;
  const timeline = normalizeTimeline(level, source.timeline);
  const replay = timeline ? replayTimeline(level, timeline) : null;
  if (!replay?.evaluation.complete || replay.state.moves !== source.moves) return null;
  return Object.freeze({ schema: COMPLETION_SCHEMA, schemaVersion: 1, gameId: GAME_ID, realm: GAME_ID, runId: source.runId, eventId: `${GAME_ID}:${source.runId}:complete`, completionId: `${GAME_ID}:${source.runId}:complete`, levelId: level.id, difficulty: level.difficulty, tier: level.tier, seed: level.seed, par: level.par, moves: replay.state.moves, elapsedMs: source.elapsedMs, timeline: replay.timeline, completedAt: new Date(source.completedAt).toISOString() });
}
export function validCompletion(value) { return normalizeCompletion(value) !== null; }
export function createCompletion(level, session, completedAt = new Date()) {
  const official = canonicalLevel(level); const date = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (!official || official !== level || !session || !validRunId(session.runId) || !Number.isFinite(date.getTime())) throw new TypeError("Completion requires an official level and replay-proof session");
  const payload = normalizeCompletion({ schema: COMPLETION_SCHEMA, schemaVersion: 1, gameId: GAME_ID, realm: GAME_ID, runId: session.runId, eventId: `${GAME_ID}:${session.runId}:complete`, levelId: official.id, difficulty: official.difficulty, tier: official.tier, seed: official.seed, par: official.par, moves: session.state?.moves, elapsedMs: Math.max(0, Math.floor(session.elapsedMs ?? 0)), timeline: session.timeline, completedAt: date.toISOString() });
  if (!payload) throw new TypeError("Completion does not replay to a valid eclipse inspection");
  return payload;
}

function outboxItems(storage) { const raw = readJson(STORAGE_KEYS.outbox, null, storage); return plainObject(raw) && raw.version === 1 && Array.isArray(raw.items) ? raw.items.map(normalizeCompletion).filter(Boolean) : []; }
export function loadCompletionOutbox(storage) { return Object.freeze(outboxItems(storage)); }
export function enqueueCompletion(storage, value) {
  const payload = normalizeCompletion(value); if (!payload || !storage) return Object.freeze({ retained: false, payload: null });
  const items = outboxItems(storage); const retained = writeJson(STORAGE_KEYS.outbox, { version: 1, items: [...items.filter((item) => item.eventId !== payload.eventId), payload] }, storage);
  return Object.freeze({ retained, payload: retained ? payload : null });
}
export function removeCompletion(storage, eventId) {
  if (!storage || !validEventId(eventId)) return Object.freeze({ removed: false });
  const items = outboxItems(storage); const next = items.filter((item) => item.eventId !== eventId);
  return Object.freeze({ removed: next.length !== items.length && writeJson(STORAGE_KEYS.outbox, { version: 1, items: next }, storage) });
}
function retainQueue(target, payload) { try { const existing = Array.isArray(target[COMPLETION_QUEUE]) ? target[COMPLETION_QUEUE].map(normalizeCompletion).filter(Boolean) : []; target[COMPLETION_QUEUE] = [...existing.filter((item) => item.eventId !== payload.eventId), payload]; return true; } catch { return false; } }
function observe(target, payload) { try { if (typeof target?.dispatchEvent === "function" && typeof target.CustomEvent === "function") target.dispatchEvent(new target.CustomEvent(COMPLETION_EVENT, { detail: payload })); } catch { /* observation never confirms delivery */ } }
export function deliverCompletion(target, value) {
  const payload = normalizeCompletion(value); if (!target || !payload) return Object.freeze({ delivered: false, queued: false, transport: null });
  const known = transports.get(target) ?? new Map(); if (known.get(payload.eventId) === "delivered") return Object.freeze({ delivered: true, queued: false, transport: "deduped" });
  for (const [name, host] of [["ten-realms-v3", target.TenRealmsV3], ["realm-arcade", target.RealmArcade]]) {
    try { if (typeof host?.complete !== "function") continue; host.complete(payload); known.set(payload.eventId, "delivered"); transports.set(target, known); observe(target, payload); return Object.freeze({ delivered: true, queued: false, transport: name }); } catch { /* next bridge or durable queue */ }
  }
  const queued = retainQueue(target, payload); if (queued) { known.set(payload.eventId, "queued"); transports.set(target, known); observe(target, payload); }
  return Object.freeze({ delivered: false, queued, transport: queued ? "queue" : null });
}
