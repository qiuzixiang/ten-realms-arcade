import { LEVELS } from "./levels.mjs";
import { flagCount, isWon, replayTimeline, stateEquals } from "./logic.mjs";
import { readJsonResult, STORAGE_KEYS, writeJson } from "./storage.mjs";

export const GAME_ID = "stardust-survey";
export const COMPLETION_QUEUE = "__realmCompletionQueue";
const runPattern = /^run-[a-z0-9-]{3,80}$/i;
const eventPattern = /^[a-z0-9:-]{6,180}$/i;
const count = (value, max = 1_000_000) => Number.isInteger(value) && value >= 0 && value <= max;
const text = (value, max = 180) => typeof value === "string" && value.length > 0 && value.length <= max;

function levelFor(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

/** A completion can only enter the queue after an action replay reaches all-safe. */
export function validCompletion(payload) {
  const level = levelFor(payload?.levelId);
  if (!level || payload?.schema !== "ten-realms-v3.game-complete" || payload?.schemaVersion !== 1
    || payload.gameId !== GAME_ID || payload.realm !== GAME_ID || !runPattern.test(payload.runId ?? "")
    || payload.eventId !== `${GAME_ID}:${payload.runId}:complete` || !eventPattern.test(payload.eventId ?? "")
    || payload.tier !== level.tier || payload.difficulty !== level.difficulty || payload.seed !== level.seed
    || payload.par !== level.par || !count(payload.moves) || !count(payload.scans) || !count(payload.flags)
    || !count(payload.elapsedMs) || !text(payload.completedAt, 48) || Number.isNaN(Date.parse(payload.completedAt))) return false;
  const replayed = replayTimeline(level, payload.timeline);
  return Boolean(replayed
    && isWon(replayed.state, level)
    && replayed.state.moves === payload.moves
    && replayed.state.scans === payload.scans
    && flagCount(replayed.state) === payload.flags);
}

export function createCompletion(level, session, elapsedMs = 0, completedAt = new Date()) {
  const replayed = replayTimeline(level, session?.timeline);
  const iso = completedAt instanceof Date ? completedAt.toISOString() : new Date(completedAt).toISOString();
  if (!replayed || !stateEquals(replayed.state, session?.state) || !isWon(replayed.state, level)) {
    throw new TypeError("Completion requires a replayable all-safe survey.");
  }
  const payload = {
    schema: "ten-realms-v3.game-complete",
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId: session.runId,
    eventId: `${GAME_ID}:${session.runId}:complete`,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: level.tier,
    seed: level.seed,
    moves: replayed.state.moves,
    scans: replayed.state.scans,
    flags: flagCount(replayed.state),
    par: level.par,
    elapsedMs: Math.max(0, Math.floor(elapsedMs)),
    timeline: session.timeline.map((action) => ({ ...action })),
    completedAt: iso,
  };
  if (!validCompletion(payload)) throw new TypeError("Completion schema or replay proof is invalid.");
  return Object.freeze({ ...payload, timeline: Object.freeze(payload.timeline.map((action) => Object.freeze(action))) });
}

function cleanOutbox(candidate) {
  const unique = new Map();
  for (const item of Array.isArray(candidate) ? candidate : []) {
    if (!validCompletion(item)) continue;
    unique.set(item.eventId, Object.freeze({ ...item, timeline: Object.freeze(item.timeline.map((action) => Object.freeze({ ...action }))) }));
  }
  return [...unique.values()];
}

function readOutbox(storage) {
  const loaded = readJsonResult(STORAGE_KEYS.outbox, [], storage);
  return { available: loaded.available, outbox: cleanOutbox(loaded.value) };
}

export function loadCompletionOutbox(storage = undefined) {
  return readOutbox(storage).outbox;
}

export function enqueueCompletion(storage, payload) {
  const loaded = readOutbox(storage);
  if (!loaded.available || !validCompletion(payload)) return { retained: false, outbox: loaded.outbox };
  const outbox = cleanOutbox([...loaded.outbox, payload]);
  return { retained: writeJson(STORAGE_KEYS.outbox, outbox, storage), outbox };
}

export function removeCompletion(storage, eventId) {
  const loaded = readOutbox(storage);
  if (!loaded.available || !eventPattern.test(eventId ?? "")) return { removed: false, outbox: loaded.outbox };
  const outbox = loaded.outbox.filter((payload) => payload.eventId !== eventId);
  return { removed: writeJson(STORAGE_KEYS.outbox, outbox, storage), outbox };
}

export function normalizeRecords(candidate) {
  const clean = { version: 1, wins: {}, settledEvents: {} };
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) || candidate.version !== 1) return clean;
  for (const [levelId, item] of Object.entries(candidate.wins ?? {})) {
    if (!levelFor(levelId) || !item || typeof item !== "object" || !count(item.wins) || item.wins < 1
      || !count(item.bestMoves) || item.bestMoves < 1 || !text(item.firstAt, 48) || !text(item.lastAt, 48)) continue;
    clean.wins[levelId] = { wins: item.wins, bestMoves: item.bestMoves, firstAt: item.firstAt, lastAt: item.lastAt };
  }
  for (const [eventId, timestamp] of Object.entries(candidate.settledEvents ?? {})) {
    if (eventPattern.test(eventId) && text(timestamp, 48) && !Number.isNaN(Date.parse(timestamp))) clean.settledEvents[eventId] = timestamp;
  }
  return clean;
}

export function loadRecords(storage = undefined) {
  return normalizeRecords(readJsonResult(STORAGE_KEYS.records, null, storage).value);
}

/** Local medals are settled before the shared host is called and are event-idempotent. */
export function settleLocalRecord(storage, payload) {
  const loaded = readJsonResult(STORAGE_KEYS.records, null, storage);
  const records = normalizeRecords(loaded.value);
  if (!loaded.available || !validCompletion(payload)) return { retained: false, duplicate: false, firstClear: false, personalBest: false, records };
  if (records.settledEvents[payload.eventId]) return { retained: true, duplicate: true, firstClear: false, personalBest: false, records };
  const before = records.wins[payload.levelId] ?? null;
  const firstClear = !before;
  const personalBest = Boolean(before && payload.moves < before.bestMoves);
  records.wins[payload.levelId] = {
    wins: (before?.wins ?? 0) + 1,
    bestMoves: Math.min(before?.bestMoves ?? Infinity, payload.moves),
    firstAt: before?.firstAt ?? payload.completedAt,
    lastAt: payload.completedAt,
  };
  records.settledEvents[payload.eventId] = payload.completedAt;
  const retained = writeJson(STORAGE_KEYS.records, records, storage);
  return { retained, duplicate: false, firstClear, personalBest, records: normalizeRecords(records) };
}

function retainCompatibilityQueue(target, payload) {
  try {
    const queue = Array.isArray(target?.[COMPLETION_QUEUE]) ? target[COMPLETION_QUEUE] : [];
    target[COMPLETION_QUEUE] = [...queue.filter((item) => item?.eventId !== payload.eventId), payload];
    return true;
  } catch {
    return false;
  }
}

/** One canonical host call: TenRealmsV3 takes precedence, RealmArcade is the compatibility fallback. */
export function deliverCompletion(target, payload) {
  if ((!target || (typeof target !== "object" && typeof target !== "function")) || !validCompletion(payload)) return Object.freeze({ delivered: false, queued: false });
  const host = target.TenRealmsV3 ?? target.RealmArcade;
  if (typeof host?.complete !== "function") return Object.freeze({ delivered: false, queued: retainCompatibilityQueue(target, payload) });
  try {
    host.complete(payload);
    if (Array.isArray(target[COMPLETION_QUEUE])) target[COMPLETION_QUEUE] = target[COMPLETION_QUEUE].filter((item) => item?.eventId !== payload.eventId);
    return Object.freeze({ delivered: true, queued: false });
  } catch {
    return Object.freeze({ delivered: false, queued: retainCompatibilityQueue(target, payload) });
  }
}
