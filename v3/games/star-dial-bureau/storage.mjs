import { replayMoves, stateForLevel } from "./logic.mjs";

export const GAME_ID = "star-dial-bureau";
export const STORAGE_PREFIX = "ten-realms-v3:games:star-dial-bureau:";
export const STORAGE_KEYS = Object.freeze({
  profile: `${STORAGE_PREFIX}profile:v1`,
  session: `${STORAGE_PREFIX}session:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v3`,
  outbox: `${STORAGE_PREFIX}completion-outbox:v1`,
});

export const PROFILE_VERSION = 1;
export const SESSION_VERSION = 1;
export const TUTORIAL_VERSION = 3;
export const HISTORY_LIMIT = 4096;

const RUN_ID = /^(?=[a-z0-9-]{12,120}$)(?=.*[a-z])[a-z0-9-]+$/;
const EVENT_ID = /^star-dial-bureau:[a-z0-9-]{12,120}:complete$/;
const LEVEL_ID = /^(?!__proto__$|prototype$|constructor$)[a-z0-9][a-z0-9-]{2,63}$/;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function safeRead(storage, key) {
  try {
    if (!STORAGE_PREFIX || !key.startsWith(STORAGE_PREFIX) || typeof storage?.getItem !== "function") return { value: null, available: false };
    return { value: storage.getItem(key) ?? null, available: true };
  } catch {
    return { value: null, available: false };
  }
}

export function safeWrite(storage, key, value) {
  try {
    if (!key.startsWith(STORAGE_PREFIX) || typeof storage?.setItem !== "function") return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(storage, key) {
  try {
    if (!key.startsWith(STORAGE_PREFIX) || typeof storage?.removeItem !== "function") return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function parseJson(raw) {
  if (typeof raw !== "string") return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function timestamp(value) {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

export function validRunId(value) {
  return typeof value === "string" && RUN_ID.test(value)
    && !["__proto__", "prototype", "constructor"].includes(value);
}

export function validEventId(value) {
  return typeof value === "string" && EVENT_ID.test(value);
}

export function createRunId(now = Date.now(), entropy = 0) {
  const time = Number.isFinite(Number(now)) ? Math.max(0, Math.floor(Number(now))) : Date.now();
  const salt = typeof entropy === "string"
    ? entropy.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 28)
    : Math.max(0, Math.floor(Number(entropy) || 0)).toString(36);
  return `${GAME_ID}-${time.toString(36)}-${salt || "0"}`;
}

export function createProfile(defaultLevelId) {
  return {
    version: PROFILE_VERSION,
    preferences: { levelId: defaultLevelId },
    completedLevelIds: [],
    bestMovesByLevel: {},
    rewardLedger: [],
    settledEvents: {},
  };
}

function normalizeReward(item, findLevel) {
  if (!isPlainObject(item) || typeof item.id !== "string" || !item.id.startsWith(`${GAME_ID}:`)
      || !["clear", "best", "reference"].includes(item.kind)
      || typeof item.label !== "string" || item.label.length < 1 || item.label.length > 100
      || !LEVEL_ID.test(item.levelId) || !findLevel(item.levelId) || !timestamp(item.awardedAt)) return null;
  if ((item.kind === "clear" && item.id !== `${GAME_ID}:clear:${item.levelId}`)
      || (item.kind === "reference" && item.id !== `${GAME_ID}:reference:${item.levelId}`)
      || (item.kind === "best" && !new RegExp(`^${GAME_ID}:best:${item.levelId}:\\d+$`).test(item.id))) return null;
  return Object.freeze({ id: item.id, kind: item.kind, label: item.label, levelId: item.levelId, awardedAt: timestamp(item.awardedAt) });
}

function normalizeSettled(eventId, item, findLevel) {
  if (!validEventId(eventId) || !isPlainObject(item) || !validRunId(item.runId)
      || eventId !== `${GAME_ID}:${item.runId}:complete` || !LEVEL_ID.test(item.levelId)
      || !findLevel(item.levelId) || !Number.isInteger(item.moves) || item.moves < 1 || item.moves > HISTORY_LIMIT
      || !Number.isInteger(item.elapsedMs) || item.elapsedMs < 0 || item.elapsedMs > 31_536_000_000
      || !Array.isArray(item.history) || item.history.length !== item.moves || !timestamp(item.completedAt)
      || !Array.isArray(item.rewardIds) || item.rewardIds.length > 8
      || new Set(item.rewardIds).size !== item.rewardIds.length
      || !item.rewardIds.every((id) => typeof id === "string" && id.startsWith(`${GAME_ID}:`))) return null;
  const level = findLevel(item.levelId);
  const replay = replayMoves(level.initialBoard, item.history);
  if (!replay || replay.history.length !== item.moves || !stateForLevel(level, replay.history)?.complete) return null;
  return Object.freeze({
    runId: item.runId,
    levelId: level.id,
    moves: item.moves,
    elapsedMs: item.elapsedMs,
    history: replay.history,
    rewardIds: Object.freeze([...item.rewardIds]),
    completedAt: timestamp(item.completedAt),
  });
}

export function normalizeProfile(value, findLevel, defaultLevelId) {
  if (!isPlainObject(value) || value.version !== PROFILE_VERSION || !isPlainObject(value.preferences)
      || !LEVEL_ID.test(value.preferences.levelId ?? "") || !findLevel(value.preferences.levelId)
      || !Array.isArray(value.completedLevelIds) || value.completedLevelIds.length > 64
      || !isPlainObject(value.bestMovesByLevel) || !Array.isArray(value.rewardLedger)
      || value.rewardLedger.length > 512 || !isPlainObject(value.settledEvents)) return null;
  const completedLevelIds = [...new Set(value.completedLevelIds)];
  if (completedLevelIds.length !== value.completedLevelIds.length || completedLevelIds.some((id) => !LEVEL_ID.test(id) || !findLevel(id))) return null;
  const bestMovesByLevel = {};
  for (const [id, moves] of Object.entries(value.bestMovesByLevel)) {
    if (!completedLevelIds.includes(id) || !findLevel(id) || !Number.isInteger(moves) || moves < 1 || moves > HISTORY_LIMIT) return null;
    bestMovesByLevel[id] = moves;
  }
  if (completedLevelIds.some((id) => !own(bestMovesByLevel, id))) return null;
  const rewardLedger = value.rewardLedger.map((entry) => normalizeReward(entry, findLevel));
  if (rewardLedger.includes(null) || new Set(rewardLedger.map((entry) => entry.id)).size !== rewardLedger.length) return null;
  const settledEvents = {};
  for (const [eventId, item] of Object.entries(value.settledEvents)) {
    const entry = normalizeSettled(eventId, item, findLevel);
    if (!entry) return null;
    settledEvents[eventId] = entry;
  }
  const rewardIds = new Set(rewardLedger.map((entry) => entry.id));
  for (const entry of Object.values(settledEvents)) {
    if (!completedLevelIds.includes(entry.levelId) || bestMovesByLevel[entry.levelId] > entry.moves
        || entry.rewardIds.some((id) => !rewardIds.has(id))) return null;
  }
  return {
    version: PROFILE_VERSION,
    preferences: { levelId: value.preferences.levelId || defaultLevelId },
    completedLevelIds,
    bestMovesByLevel,
    rewardLedger,
    settledEvents,
  };
}

export function loadProfile(storage, findLevel, defaultLevelId) {
  const read = safeRead(storage, STORAGE_KEYS.profile);
  if (!read.available) return { profile: createProfile(defaultLevelId), status: "unavailable", available: false };
  if (read.value === null) return { profile: createProfile(defaultLevelId), status: "empty", available: true };
  const profile = normalizeProfile(parseJson(read.value), findLevel, defaultLevelId);
  if (profile) return { profile, status: "restored", available: true };
  safeRemove(storage, STORAGE_KEYS.profile);
  return { profile: createProfile(defaultLevelId), status: "invalid", available: true };
}

export function saveProfile(storage, profile, findLevel, defaultLevelId) {
  const clean = normalizeProfile(profile, findLevel, defaultLevelId);
  return clean ? safeWrite(storage, STORAGE_KEYS.profile, JSON.stringify(clean)) : false;
}

export function normalizeHistory(level, history) {
  if (!Array.isArray(history) || history.length > HISTORY_LIMIT) return null;
  const replay = replayMoves(level?.initialBoard, history);
  return replay?.history ?? null;
}

export function loadSession(storage, findLevel) {
  const read = safeRead(storage, STORAGE_KEYS.session);
  if (!read.available) return { session: null, status: "unavailable", available: false };
  if (read.value === null) return { session: null, status: "empty", available: true };
  const value = parseJson(read.value);
  const level = findLevel(value?.levelId);
  const cleanHistory = level ? normalizeHistory(level, value?.history) : null;
  const savedAt = timestamp(value?.savedAt);
  if (!isPlainObject(value) || value.version !== SESSION_VERSION || value.gameId !== GAME_ID || !level
      || !validRunId(value.runId) || !cleanHistory || !Number.isInteger(value.elapsedMs)
      || value.elapsedMs < 0 || value.elapsedMs > 31_536_000_000 || !savedAt) {
    safeRemove(storage, STORAGE_KEYS.session);
    return { session: null, status: "invalid", available: true };
  }
  const state = stateForLevel(level, cleanHistory);
  if (!state) {
    safeRemove(storage, STORAGE_KEYS.session);
    return { session: null, status: "invalid", available: true };
  }
  return { session: { level, runId: value.runId, state, elapsedMs: value.elapsedMs, savedAt }, status: "restored", available: true };
}

export function saveSession(storage, session) {
  const level = session?.level;
  const cleanHistory = level ? normalizeHistory(level, session?.state?.history) : null;
  if (!level || !validRunId(session?.runId) || !cleanHistory || !Number.isInteger(session.elapsedMs)
      || session.elapsedMs < 0 || session.elapsedMs > 31_536_000_000) return false;
  const state = stateForLevel(level, cleanHistory);
  if (!state || session.state.moves !== state.moves || !Array.isArray(session.state.board)
      || session.state.board.some((tile, index) => tile !== state.board[index])) return false;
  return safeWrite(storage, STORAGE_KEYS.session, JSON.stringify({
    version: SESSION_VERSION,
    gameId: GAME_ID,
    levelId: level.id,
    runId: session.runId,
    history: cleanHistory,
    elapsedMs: session.elapsedMs,
    savedAt: new Date().toISOString(),
  }));
}

export function tutorialSeen(storage) {
  return safeRead(storage, STORAGE_KEYS.tutorial).value === `seen-v${TUTORIAL_VERSION}`;
}

export function markTutorialSeen(storage) {
  return safeWrite(storage, STORAGE_KEYS.tutorial, `seen-v${TUTORIAL_VERSION}`);
}

export function loadOutbox(storage, normalizeEntry) {
  const read = safeRead(storage, STORAGE_KEYS.outbox);
  if (!read.available) return { entries: [], status: "unavailable", available: false };
  if (read.value === null) return { entries: [], status: "empty", available: true };
  const source = parseJson(read.value);
  if (!isPlainObject(source) || source.version !== 1 || !Array.isArray(source.entries) || source.entries.length > 32) {
    safeRemove(storage, STORAGE_KEYS.outbox);
    return { entries: [], status: "invalid", available: true };
  }
  const entries = source.entries.map(normalizeEntry);
  if (entries.includes(null) || new Set(entries.map((entry) => entry.eventId)).size !== entries.length) {
    safeRemove(storage, STORAGE_KEYS.outbox);
    return { entries: [], status: "invalid", available: true };
  }
  return { entries, status: "restored", available: true };
}

export function saveOutbox(storage, entries, normalizeEntry) {
  if (!Array.isArray(entries) || entries.length > 32) return false;
  const clean = entries.map(normalizeEntry);
  if (clean.includes(null) || new Set(clean.map((entry) => entry.eventId)).size !== clean.length) return false;
  if (!clean.length) return safeRemove(storage, STORAGE_KEYS.outbox);
  return safeWrite(storage, STORAGE_KEYS.outbox, JSON.stringify({ version: 1, entries: clean }));
}

export function enqueueOutbox(storage, entry, normalizeEntry) {
  const clean = normalizeEntry(entry);
  if (!clean) return { saved: false, entries: [] };
  const loaded = loadOutbox(storage, normalizeEntry);
  if (!loaded.available) return { saved: false, entries: loaded.entries };
  const entries = [...loaded.entries.filter((item) => item.eventId !== clean.eventId), clean];
  return { saved: saveOutbox(storage, entries, normalizeEntry), entries };
}

export function removeFromOutbox(storage, eventId, normalizeEntry) {
  const loaded = loadOutbox(storage, normalizeEntry);
  if (!loaded.available) return false;
  return saveOutbox(storage, loaded.entries.filter((entry) => entry.eventId !== eventId), normalizeEntry);
}
