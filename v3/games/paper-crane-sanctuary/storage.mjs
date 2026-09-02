import { evaluateState, moveKey, parseMove, replayMoves } from "./logic.mjs";
import { GAME_ID, normalizeCompletionPayload } from "./completion-proof.mjs";

export const STORAGE_PREFIX = "ten-realms-v3:games:paper-crane-sanctuary:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`,
  settings: `${STORAGE_PREFIX}settings:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
  records: `${STORAGE_PREFIX}records:v1`,
  outbox: `${STORAGE_PREFIX}outbox:v1`,
});

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const MAX_MOVES = 256;
const MAX_TIME = 1000 * 60 * 60 * 24 * 30;

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function read(storage, key) {
  try { return storage?.getItem?.(key) ?? null; } catch { return null; }
}

function write(storage, key, value) {
  try { storage?.setItem?.(key, value); return typeof storage?.setItem === "function"; } catch { return false; }
}

function parseJson(raw) {
  try { return typeof raw === "string" ? JSON.parse(raw) : null; } catch { return null; }
}

function safeText(value, maximum = 160) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    && !["__proto__", "prototype", "constructor"].includes(value) ? value : null;
}

function safeRunId(value) {
  return safeText(value) && /^(?=[a-z0-9-]{8,160}$)(?=.*[a-z0-9])[a-z0-9-]+$/i.test(value) ? value : null;
}

function safeTimestamp(value) {
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function bounded(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

export function createRunId(levelId, now = Date.now(), random = Math.random()) {
  const cleanLevel = String(levelId ?? "level").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 42) || "level";
  const time = Math.max(0, Math.floor(Number(now) || 0)).toString(36);
  const entropy = Math.floor(Math.max(0, Math.min(0.999999999, Number(random) || 0)) * 0x100000000).toString(36).padStart(6, "0");
  return `run-${cleanLevel}-${time}-${entropy}`;
}

export function defaultSettings() {
  return { version: 1, difficulty: "easy", muted: false, lastLevelId: null };
}

export function loadSettings(storage) {
  const value = parseJson(read(storage, STORAGE_KEYS.settings));
  if (!plainObject(value) || value.version !== 1) return defaultSettings();
  return {
    version: 1,
    difficulty: DIFFICULTIES.has(value.difficulty) ? value.difficulty : "easy",
    muted: value.muted === true,
    lastLevelId: safeText(value.lastLevelId) ?? null,
  };
}

export function saveSettings(storage, settings) {
  const clean = {
    version: 1,
    difficulty: DIFFICULTIES.has(settings?.difficulty) ? settings.difficulty : "easy",
    muted: settings?.muted === true,
    lastLevelId: safeText(settings?.lastLevelId) ?? null,
  };
  return write(storage, STORAGE_KEYS.settings, JSON.stringify(clean));
}

function cleanMoves(moves) {
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) return null;
  const clean = [];
  for (const raw of moves) {
    const parsed = parseMove(raw);
    if (!parsed) return null;
    clean.push(moveKey(parsed));
  }
  return clean;
}

function cleanCompletion(value, runId) {
  if (value === null || value === undefined) return null;
  if (!plainObject(value) || value.runId !== runId || value.delivered !== Boolean(value.delivered)) return null;
  const eventId = safeText(value.eventId, 220);
  const completedAt = safeTimestamp(value.completedAt);
  return eventId === `${GAME_ID}:${runId}:complete` && completedAt
    ? { runId, eventId, completedAt, delivered: value.delivered }
    : null;
}

export function loadSession(storage, getLevel) {
  const value = parseJson(read(storage, STORAGE_KEYS.session));
  if (!plainObject(value) || value.version !== 1 || typeof getLevel !== "function") return null;
  const levelId = safeText(value.levelId);
  const runId = safeRunId(value.runId);
  const level = levelId ? getLevel(levelId) : null;
  const moves = cleanMoves(value.moves);
  if (!level || !runId || !moves || !bounded(value.elapsedMs, MAX_TIME)
      || !bounded(value.undoCount, MAX_MOVES) || !bounded(value.restartCount, MAX_MOVES)) return null;
  const state = replayMoves(level, moves);
  if (!state) return null;
  const completion = cleanCompletion(value.completion, runId);
  if (value.completion != null && !completion) return null;
  if (completion && !evaluateState(state).complete) return null;
  return {
    level,
    runId,
    moves,
    state,
    elapsedMs: value.elapsedMs,
    undoCount: value.undoCount,
    restartCount: value.restartCount,
    completion,
    savedAt: safeTimestamp(value.savedAt),
  };
}

export function saveSession(storage, session) {
  const moves = cleanMoves(session?.moves);
  const runId = safeRunId(session?.runId);
  const rebuilt = session?.level && moves ? replayMoves(session.level, moves) : null;
  if (!session?.level || !moves || !runId || !rebuilt) return false;
  const completion = cleanCompletion(session.completion, runId);
  if (session.completion != null && !completion) return false;
  if (completion && !evaluateState(rebuilt).complete) return false;
  const payload = {
    version: 1,
    levelId: session.level.id,
    runId,
    moves,
    elapsedMs: bounded(Math.floor(session.elapsedMs), MAX_TIME) ? Math.floor(session.elapsedMs) : 0,
    undoCount: bounded(session.undoCount, MAX_MOVES) ? session.undoCount : 0,
    restartCount: bounded(session.restartCount, MAX_MOVES) ? session.restartCount : 0,
    completion,
    savedAt: new Date().toISOString(),
  };
  return write(storage, STORAGE_KEYS.session, JSON.stringify(payload));
}

export function tutorialSeen(storage) {
  return read(storage, STORAGE_KEYS.tutorial) === "seen-v1";
}

export function markTutorialSeen(storage) {
  return write(storage, STORAGE_KEYS.tutorial, "seen-v1");
}

export function defaultRecords() {
  return { version: 1, levels: {}, settledEvents: {}, noUndoLevels: {} };
}

export function normalizeRecords(value) {
  const clean = defaultRecords();
  if (!plainObject(value) || value.version !== 1) return clean;
  for (const [id, record] of Object.entries(plainObject(value.levels) ? value.levels : {})) {
    const key = safeText(id, 80);
    if (!key || !plainObject(record) || !bounded(record.wins, 100000) || record.wins < 1) continue;
    const firstAt = safeTimestamp(record.firstAt);
    const lastAt = safeTimestamp(record.lastAt);
    if (firstAt && lastAt) clean.levels[key] = { wins: record.wins, firstAt, lastAt };
  }
  for (const [id, timestamp] of Object.entries(plainObject(value.settledEvents) ? value.settledEvents : {})) {
    const key = safeText(id, 220);
    const time = safeTimestamp(timestamp);
    if (key && time) clean.settledEvents[key] = time;
  }
  for (const [id, timestamp] of Object.entries(plainObject(value.noUndoLevels) ? value.noUndoLevels : {})) {
    const key = safeText(id, 80);
    const time = safeTimestamp(timestamp);
    if (key && time) clean.noUndoLevels[key] = time;
  }
  return clean;
}

export function loadRecords(storage) {
  return normalizeRecords(parseJson(read(storage, STORAGE_KEYS.records)));
}

export function saveRecords(storage, records) {
  return write(storage, STORAGE_KEYS.records, JSON.stringify(normalizeRecords(records)));
}

export function recordCompletion(records, payload) {
  const next = normalizeRecords(records);
  const canonical = normalizeCompletionPayload(payload);
  if (!canonical) return { records: next, changed: false, firstClear: false, noUndo: false };
  const { eventId, levelId } = canonical;
  const timestamp = canonical.completedAt;
  if (next.settledEvents[eventId]) return { records: next, changed: false, firstClear: false, noUndo: false };
  const previous = next.levels[levelId];
  next.levels[levelId] = { wins: (previous?.wins ?? 0) + 1, firstAt: previous?.firstAt ?? timestamp, lastAt: timestamp };
  next.settledEvents[eventId] = timestamp;
  const noUndo = canonical.noUndo === true;
  if (noUndo && !next.noUndoLevels[levelId]) next.noUndoLevels[levelId] = timestamp;
  return { records: next, changed: true, firstClear: !previous, noUndo };
}

function cleanOutboxItem(value) {
  return normalizeCompletionPayload(value);
}

export function loadOutbox(storage) {
  const value = parseJson(read(storage, STORAGE_KEYS.outbox));
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  for (const item of value) {
    const clean = cleanOutboxItem(item);
    if (clean) unique.set(clean.eventId, clean);
  }
  return [...unique.values()];
}

export function saveOutbox(storage, items) {
  const unique = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const clean = cleanOutboxItem(item);
    if (clean) unique.set(clean.eventId, clean);
  }
  return write(storage, STORAGE_KEYS.outbox, JSON.stringify([...unique.values()]));
}
