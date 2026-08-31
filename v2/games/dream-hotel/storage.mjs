import {
  TOOL_TYPES,
  boardSnapshot,
  createGameState,
  deserializeState,
  inBounds,
  serializeState,
} from "./logic.mjs";

export const STORAGE_PREFIX = "ten-realms-v2:games:dream-hotel:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`,
  settings: `${STORAGE_PREFIX}settings:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
  records: `${STORAGE_PREFIX}records:v1`,
});

const TOOL_SET = new Set(Object.values(TOOL_TYPES));
const MAX_HISTORY = 80;
const MAX_TIME_MS = 1000 * 60 * 60 * 24 * 365;
const MAX_COUNTER = 1_000_000;
const MAX_SETTLED_RUNS = 200;

function isPlainObject(value) {
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
    return Boolean(storage?.setItem);
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

function boundedInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function safeText(value, maximum = 120) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : null;
}

function safeMapKey(value, maximum = 160) {
  return safeText(value, maximum)
    && !["__proto__", "prototype", "constructor"].includes(value)
    && /^[a-z0-9×:_-]+$/i.test(value)
    ? value
    : null;
}

function safeTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function safeRunId(value) {
  return safeMapKey(value)
    && /^(?=[a-z0-9-]{8,160}$)(?=.*[a-z0-9])[a-z0-9-]+$/i.test(value)
    ? value
    : null;
}

function safeTextList(value, maximumItems = 256) {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const clean = value.map((item) => safeText(item, 160));
  return clean.some((item) => item === null) ? null : [...new Set(clean)];
}

function safeKeyList(value, maximumItems = 256) {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const clean = value.map((item) => safeMapKey(item));
  return clean.some((item) => item === null) ? null : [...new Set(clean)];
}

function normalizeSessionCompletion(value) {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value) || typeof value.delivered !== "boolean") return null;
  const completedAt = safeTimestamp(value.completedAt);
  return completedAt ? { completedAt, delivered: value.delivered } : null;
}

export function defaultSettings() {
  return { version: 1, muted: false, difficulty: "easy", lastLevelId: null };
}

export function loadSettings(storage) {
  const raw = safeJson(safeRead(storage, STORAGE_KEYS.settings));
  if (!isPlainObject(raw) || raw.version !== 1) return defaultSettings();
  return {
    version: 1,
    muted: raw.muted === true,
    difficulty: ["easy", "medium", "hard"].includes(raw.difficulty) ? raw.difficulty : "easy",
    lastLevelId: safeText(raw.lastLevelId) ?? null,
  };
}

export function saveSettings(storage, settings) {
  const clean = {
    version: 1,
    muted: settings?.muted === true,
    difficulty: ["easy", "medium", "hard"].includes(settings?.difficulty)
      ? settings.difficulty
      : "easy",
    lastLevelId: safeText(settings?.lastLevelId) ?? null,
  };
  return safeWrite(storage, STORAGE_KEYS.settings, JSON.stringify(clean));
}

function normalizeCursor(puzzle, cursor) {
  if (!isPlainObject(cursor)) return null;
  const point = { x: cursor.x, y: cursor.y };
  return inBounds(puzzle, point) ? point : null;
}

function normalizeHistoryEntry(entry, puzzle) {
  if (!isPlainObject(entry)
      || !Array.isArray(entry.rooms)
      || !Array.isArray(entry.candidates)
      || !Array.isArray(entry.excluded)) return null;
  const blankMetrics = createGameState().metrics;
  const restored = deserializeState({
    version: 1,
    rooms: entry.rooms,
    candidates: entry.candidates,
    excluded: entry.excluded,
    metrics: blankMetrics,
  }, puzzle);
  return restored ? boardSnapshot(restored) : null;
}

export function loadSession(storage, getLevel) {
  const raw = safeJson(safeRead(storage, STORAGE_KEYS.session));
  if (!isPlainObject(raw)
      || raw.version !== 1
      || typeof getLevel !== "function"
      || !safeText(raw.levelId)
      || !safeRunId(raw.runId)
      || !TOOL_SET.has(raw.tool)
      || !Array.isArray(raw.history)
      || raw.history.length > MAX_HISTORY
      || !boundedInteger(raw.elapsedMs, MAX_TIME_MS)) return null;
  const level = getLevel(raw.levelId);
  if (!level) return null;
  const game = deserializeState(raw.game, level);
  const cursor = normalizeCursor(level, raw.cursor);
  if (!game || !cursor) return null;
  const history = raw.history.map((entry) => normalizeHistoryEntry(entry, level));
  if (history.some((entry) => !entry)) return null;
  const completion = normalizeSessionCompletion(raw.completion);
  if (raw.completion !== null && raw.completion !== undefined && !completion) return null;
  return {
    level,
    runId: raw.runId,
    game,
    history,
    tool: raw.tool,
    cursor,
    elapsedMs: raw.elapsedMs,
    savedAt: safeTimestamp(raw.savedAt),
    completion,
  };
}

export function saveSession(storage, session) {
  const { level } = session;
  if (!level || !safeRunId(session.runId) || !TOOL_SET.has(session.tool) || !normalizeCursor(level, session.cursor)) return false;
  const history = Array.isArray(session.history) ? session.history.slice(-MAX_HISTORY) : [];
  if (history.some((entry) => !normalizeHistoryEntry(entry, level))) return false;
  const completion = normalizeSessionCompletion(session.completion);
  if (session.completion !== null && session.completion !== undefined && !completion) return false;
  const elapsedMs = boundedInteger(Math.floor(session.elapsedMs), MAX_TIME_MS) ? Math.floor(session.elapsedMs) : 0;
  const payload = {
    version: 1,
    levelId: level.id,
    runId: session.runId,
    game: serializeState(session.game),
    history,
    tool: session.tool,
    cursor: { x: session.cursor.x, y: session.cursor.y },
    elapsedMs,
    completion,
    savedAt: new Date().toISOString(),
  };
  return safeWrite(storage, STORAGE_KEYS.session, JSON.stringify(payload));
}

export function tutorialSeen(storage) {
  return safeRead(storage, STORAGE_KEYS.tutorial) === "seen-v1";
}

export function markTutorialSeen(storage) {
  return safeWrite(storage, STORAGE_KEYS.tutorial, "seen-v1");
}

export function defaultRecords() {
  return {
    version: 1,
    completionCount: 0,
    completions: {},
    roomTypes: {},
    bestRatings: {},
    bestTimes: {},
    achievements: {},
    rewardIds: {},
    settledRuns: {},
  };
}

function cleanStringMap(value, valueCleaner) {
  const output = {};
  if (!isPlainObject(value)) return output;
  for (const [key, raw] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)
        || !/^[a-z0-9×:_-]{1,160}$/i.test(key)) continue;
    const clean = valueCleaner(raw, key);
    if (clean !== null && clean !== undefined) output[key] = clean;
  }
  return output;
}

export function normalizeRecords(value) {
  if (!isPlainObject(value) || value.version !== 1) return defaultRecords();
  const records = defaultRecords();
  records.completionCount = boundedInteger(value.completionCount, MAX_COUNTER)
    ? value.completionCount
    : 0;
  records.completions = cleanStringMap(value.completions, (entry) => {
    if (!isPlainObject(entry) || !boundedInteger(entry.count, MAX_COUNTER) || entry.count < 1) return null;
    const lastAt = safeTimestamp(entry.lastAt);
    return lastAt ? { count: entry.count, lastAt } : null;
  });
  records.roomTypes = cleanStringMap(value.roomTypes, (entry) => {
    if (!isPlainObject(entry) || !boundedInteger(entry.count, MAX_COUNTER) || entry.count < 1) return null;
    const unlockedAt = safeTimestamp(entry.unlockedAt);
    return unlockedAt ? { count: entry.count, unlockedAt } : null;
  });
  records.bestRatings = cleanStringMap(value.bestRatings, (rating) => (
    Number.isInteger(rating) && rating >= 1 && rating <= 3 ? rating : null
  ));
  records.bestTimes = cleanStringMap(value.bestTimes, (time) => (
    boundedInteger(time, MAX_TIME_MS) ? time : null
  ));
  records.achievements = cleanStringMap(value.achievements, safeTimestamp);
  records.rewardIds = cleanStringMap(value.rewardIds, safeTimestamp);
  const settledRuns = cleanStringMap(value.settledRuns, (entry, runId) => {
    if (!safeRunId(runId)) return null;
    if (!isPlainObject(entry) || typeof entry.improvedRating !== "boolean") return null;
    const levelId = safeMapKey(entry.levelId);
    const completedAt = safeTimestamp(entry.completedAt);
    const awardedIds = safeKeyList(entry.awardedIds);
    const unlockedRoomTypes = safeKeyList(entry.unlockedRoomTypes);
    return levelId && completedAt && awardedIds && unlockedRoomTypes
      ? { levelId, completedAt, awardedIds, unlockedRoomTypes, improvedRating: entry.improvedRating }
      : null;
  });
  records.settledRuns = Object.fromEntries(
    Object.entries(settledRuns)
      .sort((left, right) => left[1].completedAt.localeCompare(right[1].completedAt))
      .slice(-MAX_SETTLED_RUNS),
  );
  return records;
}

export function loadRecords(storage) {
  return normalizeRecords(safeJson(safeRead(storage, STORAGE_KEYS.records)));
}

export function saveRecords(storage, records) {
  return safeWrite(storage, STORAGE_KEYS.records, JSON.stringify(normalizeRecords(records)));
}

function earn(records, rewardId, timestamp, awardedIds) {
  if (records.rewardIds[rewardId]) return false;
  records.rewardIds[rewardId] = timestamp;
  awardedIds.push(rewardId);
  return true;
}

/** Settle one run idempotently and preserve its original delivery outcome. */
export function applyCompletionToRecords(recordsInput, { level, runId, summary, elapsedMs, completedAt }) {
  const records = normalizeRecords(recordsInput);
  const timestamp = completedAt === undefined ? new Date().toISOString() : safeTimestamp(completedAt);
  const roomTypes = safeKeyList(summary?.roomTypes);
  const validSummary = boundedInteger(summary?.moves)
    && Number.isInteger(summary?.rating)
    && summary.rating >= 1
    && summary.rating <= 3
    && typeof summary.oneStroke === "boolean"
    && typeof summary.noRework === "boolean"
    && roomTypes !== null;
  if (!safeMapKey(level?.id)
      || !safeRunId(runId)
      || !validSummary
      || !boundedInteger(elapsedMs, MAX_TIME_MS)
      || !timestamp) {
    throw new TypeError("A solved level summary is required");
  }
  const priorRun = Object.hasOwn(records.settledRuns, runId) ? records.settledRuns[runId] : null;
  if (priorRun) {
    if (priorRun.levelId !== level.id) throw new TypeError("Run ID belongs to another level");
    return {
      records,
      awardedIds: [...priorRun.awardedIds],
      unlockedRoomTypes: [...priorRun.unlockedRoomTypes],
      improvedRating: priorRun.improvedRating,
      alreadySettled: true,
    };
  }

  const duration = elapsedMs;
  const awardedIds = [];
  const unlockedRoomTypes = [];
  const previousRating = records.bestRatings[level.id] ?? 0;

  records.completionCount = Math.min(MAX_COUNTER, records.completionCount + 1);
  const priorCompletion = records.completions[level.id];
  records.completions[level.id] = {
    count: Math.min(MAX_COUNTER, (priorCompletion?.count ?? 0) + 1),
    lastAt: timestamp,
  };
  earn(records, `clear:${level.id}`, timestamp, awardedIds);

  for (const roomType of roomTypes) {
    const prior = records.roomTypes[roomType];
    records.roomTypes[roomType] = {
      count: Math.min(MAX_COUNTER, (prior?.count ?? 0) + 1),
      unlockedAt: prior?.unlockedAt ?? timestamp,
    };
    if (!prior) unlockedRoomTypes.push(roomType);
    earn(records, `catalog:${roomType}`, timestamp, awardedIds);
  }

  if (summary.oneStroke) {
    const id = `first-draw:${level.id}`;
    records.achievements[id] ??= timestamp;
    earn(records, id, timestamp, awardedIds);
  }
  if (summary.noRework) {
    const id = `no-rework:${level.id}`;
    records.achievements[id] ??= timestamp;
    earn(records, id, timestamp, awardedIds);
  }

  records.bestRatings[level.id] = Math.max(previousRating, summary.rating);
  for (let star = 1; star <= summary.rating; star += 1) {
    earn(records, `rating:${level.id}:${star}`, timestamp, awardedIds);
  }
  if (duration > 0 && (!records.bestTimes[level.id] || duration < records.bestTimes[level.id])) {
    records.bestTimes[level.id] = duration;
  }

  const improvedRating = summary.rating > previousRating;
  records.settledRuns[runId] = {
    levelId: level.id,
    completedAt: timestamp,
    awardedIds: [...awardedIds],
    unlockedRoomTypes: [...unlockedRoomTypes],
    improvedRating,
  };
  const otherRuns = Object.entries(records.settledRuns)
    .filter(([id]) => id !== runId)
    .sort((left, right) => left[1].completedAt.localeCompare(right[1].completedAt))
  const staleRunIds = otherRuns
    .slice(0, Math.max(0, otherRuns.length - (MAX_SETTLED_RUNS - 1)))
    .map(([id]) => id);
  staleRunIds.forEach((id) => { delete records.settledRuns[id]; });

  return {
    records,
    awardedIds,
    unlockedRoomTypes,
    improvedRating,
    alreadySettled: false,
  };
}
