import { evaluateState, replayPresses } from "./logic.mjs";

export const GAME_ID = "resonance-bell-room";
export const STORAGE_PREFIX = "ten-realms-v2:games:resonance-bell-room:";
export const STORAGE_KEYS = Object.freeze({
  profile: `${STORAGE_PREFIX}profile:v1`,
  session: `${STORAGE_PREFIX}session:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
  outbox: `${STORAGE_PREFIX}completion-outbox:v1`,
});
export const PROFILE_VERSION = 1;
export const SESSION_VERSION = 1;
export const TUTORIAL_VERSION = 2;
export const SESSION_HISTORY_LIMIT = 10000;

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function safeRead(storage, key) {
  try {
    if (typeof storage?.getItem !== "function") return { value: null, available: false };
    return { value: storage.getItem(key) ?? null, available: true };
  } catch {
    return { value: null, available: false };
  }
}

export function safeGet(storage, key) {
  return safeRead(storage, key).value;
}

export function safeSet(storage, key, value) {
  try {
    if (typeof storage?.setItem !== "function") return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(storage, key) {
  try {
    if (typeof storage?.removeItem !== "function") return false;
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

function validRunId(value) {
  return typeof value === "string" && /^(?=[a-z0-9-]{8,80}$)(?=.*[a-z])[a-z0-9-]+$/.test(value);
}

function validTimestamp(value) {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function validLevelId(value, getLevel) {
  return typeof value === "string" && Boolean(getLevel?.(value));
}

function uniqueStrings(values, maximum = 1000) {
  return Array.isArray(values) && values.length <= maximum
    && values.every((value) => typeof value === "string" && value.length >= 1 && value.length <= 180)
    && new Set(values).size === values.length;
}

export function createDefaultProfile(defaultLevelId = "first-awakening") {
  return {
    version: PROFILE_VERSION,
    preferences: { muted: false, difficulty: "easy", levelId: defaultLevelId },
    completedLevelIds: [],
    bestMovesByLevel: {},
    rewardLedger: [],
    settledRuns: {},
  };
}

function normalizeReward(entry, getLevel) {
  if (!isPlainObject(entry)
      || typeof entry.id !== "string" || !/^resonance-bell-room:(?:clear|minimum|best):/.test(entry.id)
      || !["clear", "minimum", "best"].includes(entry.kind)
      || typeof entry.label !== "string" || entry.label.length < 1 || entry.label.length > 100
      || !Number.isInteger(entry.suggestedXp) || entry.suggestedXp < 1 || entry.suggestedXp > 1000
      || !validTimestamp(entry.awardedAt)) return null;
  let match;
  if (entry.kind === "clear") match = entry.id.match(/^resonance-bell-room:clear:([a-z0-9-]+)$/);
  if (entry.kind === "minimum") match = entry.id.match(/^resonance-bell-room:minimum:([a-z0-9-]+)$/);
  if (entry.kind === "best") match = entry.id.match(/^resonance-bell-room:best:([a-z0-9-]+):(\d+)$/);
  if (!match || !getLevel?.(match[1])) return null;
  if (entry.kind === "best" && (!Number.isSafeInteger(Number(match[2])) || Number(match[2]) < 1)) return null;
  return { ...entry };
}

export function normalizeProfile(value, getLevel, defaultLevelId = "first-awakening") {
  if (!isPlainObject(value) || value.version !== PROFILE_VERSION || !isPlainObject(value.preferences)) return null;
  const preferences = value.preferences;
  if (typeof preferences.muted !== "boolean"
      || !["easy", "medium", "hard"].includes(preferences.difficulty)
      || !validLevelId(preferences.levelId, getLevel)
      || !uniqueStrings(value.completedLevelIds, 100)
      || value.completedLevelIds.some((id) => !getLevel(id))
      || !isPlainObject(value.bestMovesByLevel)
      || !Array.isArray(value.rewardLedger) || value.rewardLedger.length > 2000
      || !isPlainObject(value.settledRuns)) return null;

  const bestMovesByLevel = {};
  for (const [levelId, moves] of Object.entries(value.bestMovesByLevel)) {
    if (!getLevel(levelId) || !value.completedLevelIds.includes(levelId)
        || !Number.isInteger(moves) || moves < 1 || moves > 10000) return null;
    bestMovesByLevel[levelId] = moves;
  }
  if (value.completedLevelIds.some((levelId) => !Object.hasOwn(bestMovesByLevel, levelId))) return null;

  const rewardLedger = value.rewardLedger.map((entry) => normalizeReward(entry, getLevel));
  if (rewardLedger.includes(null) || new Set(rewardLedger.map(({ id }) => id)).size !== rewardLedger.length) return null;
  const rewardIds = new Set(rewardLedger.map(({ id }) => id));
  for (const levelId of value.completedLevelIds) {
    if (!rewardIds.has(`${GAME_ID}:clear:${levelId}`)) return null;
    const minimumId = `${GAME_ID}:minimum:${levelId}`;
    if (bestMovesByLevel[levelId] === getLevel(levelId).suggestedMinimum && !rewardIds.has(minimumId)) return null;
  }

  const settledEntries = Object.entries(value.settledRuns);
  const settledRuns = {};
  for (const [runId, entry] of settledEntries) {
    const settledLevel = isPlainObject(entry) && validLevelId(entry.levelId, getLevel)
      ? getLevel(entry.levelId)
      : null;
    const replayed = settledLevel ? replayPresses(settledLevel, entry.history) : null;
    if (!validRunId(runId) || !isPlainObject(entry)
        || !settledLevel || !replayed || !evaluateState(settledLevel, replayed).complete
        || !value.completedLevelIds.includes(entry.levelId)
        || !Number.isInteger(entry.moves) || entry.moves < 1 || entry.moves > 10000
        || entry.moves !== replayed.moves
        || !Number.isInteger(entry.elapsedMs) || entry.elapsedMs < 0 || entry.elapsedMs > 31_536_000_000
        || typeof entry.completionId !== "string"
        || entry.completionId !== `${GAME_ID}:${entry.levelId}:run:${runId}`
        || !validTimestamp(entry.completedAt)
        || !uniqueStrings(entry.rewardIds, 20)
        || entry.rewardIds.some((id) => !rewardIds.has(id))) return null;
    settledRuns[runId] = {
      levelId: entry.levelId,
      moves: entry.moves,
      history: [...replayed.history],
      elapsedMs: entry.elapsedMs,
      completionId: entry.completionId,
      completedAt: new Date(entry.completedAt).toISOString(),
      rewardIds: [...entry.rewardIds],
    };
  }

  return {
    version: PROFILE_VERSION,
    preferences: { ...preferences },
    completedLevelIds: [...value.completedLevelIds],
    bestMovesByLevel,
    rewardLedger,
    settledRuns,
  };
}

export function loadProfile(storage, getLevel, defaultLevelId = "first-awakening") {
  const read = safeRead(storage, STORAGE_KEYS.profile);
  if (!read.available) return { profile: createDefaultProfile(defaultLevelId), status: "unavailable", available: false };
  const raw = read.value;
  if (raw === null) return { profile: createDefaultProfile(defaultLevelId), status: "empty", available: true };
  const profile = normalizeProfile(parseJson(raw), getLevel, defaultLevelId);
  if (profile) return { profile, status: "restored", available: true };
  safeRemove(storage, STORAGE_KEYS.profile);
  return { profile: createDefaultProfile(defaultLevelId), status: "invalid", available: Boolean(storage) };
}

export function saveProfile(storage, profile, getLevel, defaultLevelId = "first-awakening") {
  const normalized = normalizeProfile(profile, getLevel, defaultLevelId);
  return normalized ? safeSet(storage, STORAGE_KEYS.profile, JSON.stringify(normalized)) : false;
}

export function loadSession(storage, getLevel) {
  const read = safeRead(storage, STORAGE_KEYS.session);
  if (!read.available) return { session: null, status: "unavailable", available: false };
  const raw = read.value;
  if (raw === null) return { session: null, status: "empty", available: true };
  const value = parseJson(raw);
  if (!isPlainObject(value) || value.version !== SESSION_VERSION || value.game !== GAME_ID
      || !validLevelId(value.levelId, getLevel) || !validRunId(value.runId)
      || !Array.isArray(value.history) || value.history.length > SESSION_HISTORY_LIMIT
      || !Number.isInteger(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > 31_536_000_000
      || !validTimestamp(value.savedAt)) {
    safeRemove(storage, STORAGE_KEYS.session);
    return { session: null, status: "invalid", available: Boolean(storage) };
  }
  const level = getLevel(value.levelId);
  const state = replayPresses(level, value.history);
  if (!state) {
    safeRemove(storage, STORAGE_KEYS.session);
    return { session: null, status: "invalid", available: Boolean(storage) };
  }
  return {
    session: {
      level,
      runId: value.runId,
      state,
      elapsedMs: value.elapsedMs,
      savedAt: new Date(value.savedAt).toISOString(),
      completed: evaluateState(level, state).complete,
    },
    status: "restored",
    available: true,
  };
}

export function saveSession(storage, session) {
  const level = session?.level;
  const state = level ? replayPresses(level, session?.state?.history) : null;
  if (!level || !state || !validRunId(session.runId)
      || !Number.isInteger(session.elapsedMs) || session.elapsedMs < 0 || session.elapsedMs > 31_536_000_000) return false;
  const payload = {
    version: SESSION_VERSION,
    game: GAME_ID,
    levelId: level.id,
    runId: session.runId,
    history: [...state.history],
    elapsedMs: session.elapsedMs,
    savedAt: new Date().toISOString(),
  };
  return safeSet(storage, STORAGE_KEYS.session, JSON.stringify(payload));
}

export function tutorialSeen(storage) {
  return safeGet(storage, STORAGE_KEYS.tutorial) === `seen-v${TUTORIAL_VERSION}`;
}

export function markTutorialSeen(storage) {
  return safeSet(storage, STORAGE_KEYS.tutorial, `seen-v${TUTORIAL_VERSION}`);
}
