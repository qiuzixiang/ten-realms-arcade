import {
  DEFAULT_PRESET_ID,
  PRESETS,
  dailySeed,
  puzzleIdFor,
  restoreGame,
  serializeGame,
} from "./logic.mjs";
import { completionIdFor, normalizeAttemptId } from "./integration.mjs";

export const STORAGE_PREFIX = "ten-realms-v2:season-dyehouse:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`,
  preferences: `${STORAGE_PREFIX}preferences:v1`,
  records: `${STORAGE_PREFIX}records:v1`,
});

export const STORAGE_VERSION = 1;
export const TUTORIAL_VERSION = 2;

export function defaultPreferences() {
  return {
    version: STORAGE_VERSION,
    muted: false,
    tutorialVersion: 0,
    presetId: DEFAULT_PRESET_ID,
  };
}

export function normalizePreferences(candidate) {
  const fallback = defaultPreferences();
  if (!candidate || typeof candidate !== "object" || candidate.version !== STORAGE_VERSION) return fallback;
  return {
    version: STORAGE_VERSION,
    muted: candidate.muted === true,
    tutorialVersion: candidate.tutorialVersion === TUTORIAL_VERSION ? TUTORIAL_VERSION : 0,
    presetId: PRESETS[candidate.presetId] ? candidate.presetId : DEFAULT_PRESET_ID,
  };
}

export function readJSON(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw === null || raw === undefined ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJSON(storage, key, value) {
  if (typeof storage?.setItem !== "function") return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(storage, key) {
  try {
    storage?.removeItem?.(key);
    return true;
  } catch {
    return false;
  }
}

export function loadPreferences(storage) {
  return normalizePreferences(readJSON(storage, STORAGE_KEYS.preferences));
}

export function savePreferences(storage, preferences) {
  return writeJSON(storage, STORAGE_KEYS.preferences, normalizePreferences(preferences));
}

export function sessionPayload(game, context = {}) {
  return {
    version: STORAGE_VERSION,
    mode: context.mode === "daily" ? "daily" : "seed",
    day: context.mode === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(context.day ?? "")
      ? context.day
      : "",
    attemptId: normalizeAttemptId(context.attemptId),
    game: JSON.parse(serializeGame(game)),
  };
}

export function saveSession(storage, game, context = {}) {
  return writeJSON(storage, STORAGE_KEYS.session, sessionPayload(game, context));
}

export function restoreSession(candidate) {
  try {
    const parsed = typeof candidate === "string" ? JSON.parse(candidate) : candidate;
    if (!parsed || parsed.version !== STORAGE_VERSION) return null;
    if (parsed.mode !== "seed" && parsed.mode !== "daily") return null;
    const game = restoreGame(parsed.game);
    if (!game) return null;
    if (parsed.mode === "daily") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.day ?? "")) return null;
      if (game.presetId !== "12x12-medium" || game.seed !== dailySeed(parsed.day)) return null;
    } else if (parsed.day !== "" && parsed.day !== undefined) {
      return null;
    }
    const attemptId = normalizeAttemptId(parsed.attemptId);
    if (game.reportedCompletionId) {
      if (!attemptId) return null;
      const day = parsed.mode === "daily" ? parsed.day : "";
      if (game.reportedCompletionId !== completionIdFor(puzzleIdFor(game, parsed.mode, day), attemptId)) return null;
    }
    return {
      game,
      mode: parsed.mode,
      day: parsed.mode === "daily" ? parsed.day : "",
      attemptId,
    };
  } catch {
    return null;
  }
}

export function loadSession(storage) {
  let raw;
  try {
    raw = storage?.getItem?.(STORAGE_KEYS.session);
  } catch {
    return null;
  }
  if (raw === null || raw === undefined) return null;
  const restored = restoreSession(raw);
  if (!restored) removeStored(storage, STORAGE_KEYS.session);
  return restored;
}
