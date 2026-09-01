import {
  createPosition,
  deserializePosition,
  serializePosition,
  validatePosition,
} from "./logic.mjs";
import { normalizeTimeline, replayTimeline } from "./completion.mjs";

export const STORAGE_PREFIX = "ten-realms-v2:games:time-sand-post:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`,
  settings: `${STORAGE_PREFIX}settings:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
  records: `${STORAGE_PREFIX}records:v1`,
  outbox: `${STORAGE_PREFIX}outbox:v1`,
});

export const HISTORY_LIMIT = 80;
const MAX_COUNTER = 1_000_000;
const MAX_ELAPSED_MS = 1000 * 60 * 60 * 24 * 30;
const SAFE_RUN_ID = /^(?=[a-z0-9-]{12,160}$)(?=.*[a-z])[a-z0-9-]+$/i;
const SAFE_EVENT_ID = /^(?=[a-z0-9:-]{16,220}$)(?=.*[a-z])[a-z0-9:-]+$/i;
const SAFE_LEVEL_ID = /^(?!__proto__$|prototype$|constructor$)[a-z0-9][a-z0-9-]{2,63}$/;

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeRead(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function safeWrite(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
    return typeof storage?.setItem === "function";
  } catch {
    return false;
  }
}

function safeJson(raw) {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function boundedInteger(value, maximum = MAX_COUNTER) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function timestamp(value) {
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function validRunId(value) {
  return typeof value === "string"
    && !["__proto__", "prototype", "constructor"].includes(value)
    && SAFE_RUN_ID.test(value);
}

export function validEventId(value) {
  return typeof value === "string"
    && !["__proto__", "prototype", "constructor"].includes(value)
    && SAFE_EVENT_ID.test(value);
}

export function createRunId(now = Date.now(), entropy = 0) {
  const time = boundedInteger(Math.floor(Number(now)), Number.MAX_SAFE_INTEGER) ? Math.floor(Number(now)) : Date.now();
  const salt = typeof entropy === "string"
    ? entropy.replace(/[^a-z0-9]/gi, "").slice(0, 24).toLowerCase()
    : Math.max(0, Math.floor(Number(entropy)) || 0).toString(36);
  return `time-sand-post-${time.toString(36)}-${salt || "0"}`;
}

export function defaultSettings() {
  return Object.freeze({ version: 1, difficulty: "easy", lastLevelId: null });
}

export function loadSettings(storage) {
  const raw = safeJson(safeRead(storage, STORAGE_KEYS.settings));
  if (!plainObject(raw) || raw.version !== 1) return { ...defaultSettings() };
  return {
    version: 1,
    difficulty: ["easy", "medium", "hard"].includes(raw.difficulty) ? raw.difficulty : "easy",
    lastLevelId: typeof raw.lastLevelId === "string" && /^[a-z0-9-]{3,63}$/.test(raw.lastLevelId) ? raw.lastLevelId : null,
  };
}

export function saveSettings(storage, settings) {
  const clean = {
    version: 1,
    difficulty: ["easy", "medium", "hard"].includes(settings?.difficulty) ? settings.difficulty : "easy",
    lastLevelId: typeof settings?.lastLevelId === "string" && /^[a-z0-9-]{3,63}$/.test(settings.lastLevelId)
      ? settings.lastLevelId
      : null,
  };
  return safeWrite(storage, STORAGE_KEYS.settings, JSON.stringify(clean));
}

export function tutorialSeen(storage) {
  return safeRead(storage, STORAGE_KEYS.tutorial) === "seen-v2";
}

export function markTutorialSeen(storage) {
  return safeWrite(storage, STORAGE_KEYS.tutorial, "seen-v2");
}

export function createSession(level, runId) {
  if (!level || !validRunId(runId)) throw new TypeError("A valid level and stable run ID are required");
  const start = level.givens.find(([, number]) => number === 1)?.[0] ?? 0;
  return {
    version: 1,
    level,
    runId,
    position: createPosition(level),
    timeline: [],
    history: [],
    moves: 0,
    elapsedMs: 0,
    activeCell: start,
    selectedFrom: null,
    completion: null,
  };
}

function normalizeHistoryEntry(level, entry) {
  if (!plainObject(entry) || !boundedInteger(entry.moves)) return null;
  const position = validatePosition(level, entry.position)
    ? entry.position
    : deserializePosition(level, entry.position);
  return position ? { position, moves: entry.moves } : null;
}

function normalizeCompletion(value, runId) {
  if (value === null || value === undefined) return null;
  if (!plainObject(value) || !validEventId(value.eventId)
      || value.eventId !== `time-sand-post:${runId}:complete`
      || typeof value.delivered !== "boolean") return null;
  const completedAt = timestamp(value.completedAt);
  return completedAt ? { eventId: value.eventId, delivered: value.delivered, completedAt } : null;
}

export function saveSession(storage, session) {
  const level = session?.level;
  if (!level || !validRunId(session.runId) || !boundedInteger(session.moves)
      || !boundedInteger(Math.floor(session.elapsedMs), MAX_ELAPSED_MS)
      || !boundedInteger(session.activeCell, level.width * level.height - 1)
      || !(session.selectedFrom === null || boundedInteger(session.selectedFrom, level.width * level.height - 1))
      || !Array.isArray(session.history) || session.history.length > HISTORY_LIMIT) return false;
  if (!validatePosition(level, session.position)) return false;
  const timeline = normalizeTimeline(level, session.timeline);
  const replay = timeline ? replayTimeline(level, timeline) : null;
  if (!timeline || !replay || timeline.length !== session.moves
      || !sameJson(serializePosition(session.position), serializePosition(replay.position))) return false;
  const history = session.history.map((entry) => normalizeHistoryEntry(level, entry));
  if (history.some((entry) => !entry || entry.moves > timeline.length)) return false;
  for (const entry of history) {
    const prefix = replayTimeline(level, timeline.slice(0, entry.moves));
    if (!prefix || !sameJson(serializePosition(prefix.position), serializePosition(entry.position))) return false;
  }
  const completion = normalizeCompletion(session.completion, session.runId);
  if ((session.completion !== null && !completion) || (completion && !replay.evaluation.complete)) return false;
  const payload = {
    version: 1,
    levelId: level.id,
    runId: session.runId,
    position: serializePosition(session.position),
    timeline: timeline.map((action) => ({ ...action })),
    history: history.map((entry) => ({ position: serializePosition(entry.position), moves: entry.moves })),
    moves: session.moves,
    elapsedMs: Math.floor(session.elapsedMs),
    activeCell: session.activeCell,
    selectedFrom: session.selectedFrom,
    completion,
    savedAt: new Date().toISOString(),
  };
  return safeWrite(storage, STORAGE_KEYS.session, JSON.stringify(payload));
}

export function loadSession(storage, findLevel) {
  const raw = safeJson(safeRead(storage, STORAGE_KEYS.session));
  if (!plainObject(raw) || raw.version !== 1 || typeof findLevel !== "function" || !validRunId(raw.runId)
      || !boundedInteger(raw.moves) || !boundedInteger(raw.elapsedMs, MAX_ELAPSED_MS)
      || !Array.isArray(raw.history) || raw.history.length > HISTORY_LIMIT) return null;
  const level = typeof raw.levelId === "string" ? findLevel(raw.levelId) : null;
  if (!level) return null;
  const maximumCell = level.width * level.height - 1;
  if (!boundedInteger(raw.activeCell, maximumCell)
      || !(raw.selectedFrom === null || boundedInteger(raw.selectedFrom, maximumCell))) return null;
  const position = deserializePosition(level, raw.position);
  const timeline = normalizeTimeline(level, raw.timeline);
  const replay = timeline ? replayTimeline(level, timeline) : null;
  const history = raw.history.map((entry) => normalizeHistoryEntry(level, entry));
  const completion = normalizeCompletion(raw.completion, raw.runId);
  if (!position || !timeline || !replay || timeline.length !== raw.moves
      || !sameJson(serializePosition(position), serializePosition(replay.position))
      || history.some((entry) => !entry || entry.moves > timeline.length)
      || (raw.completion !== null && raw.completion !== undefined && !completion)
      || (completion && !replay.evaluation.complete)) return null;
  const replayedHistory = [];
  for (const entry of history) {
    const prefix = replayTimeline(level, timeline.slice(0, entry.moves));
    if (!prefix || !sameJson(serializePosition(prefix.position), serializePosition(entry.position))) return null;
    replayedHistory.push({ position: prefix.position, moves: entry.moves });
  }
  return {
    version: 1,
    level,
    runId: raw.runId,
    position: replay.position,
    timeline,
    history: replayedHistory,
    moves: raw.moves,
    elapsedMs: raw.elapsedMs,
    activeCell: raw.activeCell,
    selectedFrom: raw.selectedFrom,
    completion,
  };
}

export function defaultRecords() {
  return { version: 1, totalWins: 0, levels: {}, settledEvents: {} };
}

export function normalizeRecords(value, findLevel = () => true) {
  const records = defaultRecords();
  if (!plainObject(value) || value.version !== 1) return records;
  records.totalWins = boundedInteger(value.totalWins) ? value.totalWins : 0;
  if (plainObject(value.levels)) {
    for (const [levelId, record] of Object.entries(value.levels)) {
      if (!SAFE_LEVEL_ID.test(levelId) || !findLevel(levelId) || !plainObject(record) || !boundedInteger(record.wins) || record.wins < 1
          || !(record.bestMoves === null || boundedInteger(record.bestMoves))) continue;
      const firstAt = timestamp(record.firstAt);
      const lastAt = timestamp(record.lastAt);
      if (firstAt && lastAt) records.levels[levelId] = { wins: record.wins, bestMoves: record.bestMoves, firstAt, lastAt };
    }
  }
  if (plainObject(value.settledEvents)) {
    for (const [eventId, settledAt] of Object.entries(value.settledEvents)) {
      const cleanTime = validEventId(eventId) ? timestamp(settledAt) : null;
      if (cleanTime) records.settledEvents[eventId] = cleanTime;
    }
  }
  return records;
}

export function loadRecords(storage, findLevel) {
  return normalizeRecords(safeJson(safeRead(storage, STORAGE_KEYS.records)), findLevel);
}

export function saveRecords(storage, records, findLevel) {
  return safeWrite(storage, STORAGE_KEYS.records, JSON.stringify(normalizeRecords(records, findLevel)));
}

export function recordCompletion(records, payload, findLevel, now = new Date()) {
  const next = normalizeRecords(records, findLevel);
  const date = now instanceof Date ? now : new Date(now);
  if (!validEventId(payload?.eventId) || !SAFE_LEVEL_ID.test(payload?.levelId ?? "") || !findLevel(payload?.levelId)
      || !Number.isFinite(date.getTime())
      || !boundedInteger(payload?.moves) || next.settledEvents[payload.eventId]) {
    return { records: next, recorded: false, firstClear: false, personalBest: false };
  }
  const previous = next.levels[payload.levelId] ?? null;
  const at = date.toISOString();
  next.levels[payload.levelId] = {
    wins: Math.min(MAX_COUNTER, (previous?.wins ?? 0) + 1),
    bestMoves: Math.min(previous?.bestMoves ?? Infinity, payload.moves),
    firstAt: previous?.firstAt ?? at,
    lastAt: at,
  };
  next.totalWins = Math.min(MAX_COUNTER, next.totalWins + 1);
  next.settledEvents[payload.eventId] = at;
  return {
    records: next,
    recorded: true,
    firstClear: previous === null,
    personalBest: previous !== null && (previous.bestMoves === null || payload.moves < previous.bestMoves),
  };
}

function defaultPayloadValidator(payload) {
  return plainObject(payload) && validEventId(payload.eventId);
}

export function normalizeOutbox(value, validator = defaultPayloadValidator) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const output = [];
  for (const payload of value) {
    let validated = false;
    try {
      validated = validator(payload);
    } catch {
      continue;
    }
    const canonical = validated === true ? payload : validated;
    if (!plainObject(canonical) || !validEventId(canonical.eventId) || seen.has(canonical.eventId)) continue;
    seen.add(canonical.eventId);
    output.push(canonical);
  }
  return output;
}

export function loadOutbox(storage, validator) {
  return normalizeOutbox(safeJson(safeRead(storage, STORAGE_KEYS.outbox)), validator);
}

export function saveOutbox(storage, outbox, validator) {
  return safeWrite(storage, STORAGE_KEYS.outbox, JSON.stringify(normalizeOutbox(outbox, validator)));
}

export function enqueueOutbox(storage, payload, validator) {
  const outbox = loadOutbox(storage, validator);
  const next = normalizeOutbox([...outbox.filter((entry) => entry.eventId !== payload?.eventId), payload], validator);
  return { outbox: next, saved: saveOutbox(storage, next, validator) };
}

export function removeFromOutbox(storage, eventId, validator) {
  const next = loadOutbox(storage, validator).filter((payload) => payload.eventId !== eventId);
  return { outbox: next, saved: saveOutbox(storage, next, validator) };
}
