import {
  ASSIGNED_STATES,
  evaluatePosition,
  normalizePosition,
  positionToJSON,
} from "./logic.mjs";

export const STORAGE_PREFIX = "ten-realms-v2:games:aurora-magnet-lab:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`,
  profile: `${STORAGE_PREFIX}profile:v1`,
  preferences: `${STORAGE_PREFIX}preferences:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
});
export const SESSION_VERSION = 1;
export const HISTORY_LIMIT = 80;

function assertOwnedKey(key) {
  if (!String(key).startsWith(STORAGE_PREFIX)) throw new Error("Refusing to access a storage key outside this game.");
}

function storageResult(value, available = true, corrupted = false) {
  return { value, available, corrupted };
}

export function readOwnedJSON(storage, key) {
  assertOwnedKey(key);
  if (!storage || typeof storage.getItem !== "function") return storageResult(null, false, false);
  try {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined) return storageResult(null);
    try {
      return storageResult(JSON.parse(raw));
    } catch {
      return storageResult(null, true, true);
    }
  } catch {
    return storageResult(null, false, false);
  }
}

export function writeOwnedJSON(storage, key, value) {
  assertOwnedKey(key);
  if (!storage || typeof storage.setItem !== "function") return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeOwned(storage, key) {
  assertOwnedKey(key);
  if (!storage || typeof storage.removeItem !== "function") return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function createSession(puzzle, options = {}) {
  return {
    version: SESSION_VERSION,
    puzzleId: puzzle.id,
    difficulty: puzzle.difficulty,
    position: { states: {}, notes: [] },
    moves: 0,
    undos: 0,
    conflictMoves: 0,
    elapsedMs: 0,
    history: [],
    markedClues: [],
    completed: false,
    completionReported: false,
    startedAt: Number.isFinite(options.now) ? options.now : Date.now(),
  };
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parsePosition(puzzle, value) {
  if (!value || !isPlainObject(value.states) || !Array.isArray(value.notes)) return null;
  const slotIds = new Set(puzzle.slots.map((slot) => slot.id));
  const entries = Object.entries(value.states);
  if (entries.some(([slotId, state]) => !slotIds.has(slotId) || !ASSIGNED_STATES.includes(state))) return null;
  if (value.notes.some((slotId) => typeof slotId !== "string" || !slotIds.has(slotId))) return null;
  if (new Set(value.notes).size !== value.notes.length) return null;
  if (value.notes.some((slotId) => Object.hasOwn(value.states, slotId))) return null;
  const normalized = normalizePosition(puzzle, { states: value.states, notes: value.notes });
  if (normalized.states.size !== entries.length || normalized.notes.size !== value.notes.length) return null;
  return normalized;
}

function clueIdExists(puzzle, id) {
  const match = /^(rows|columns):(plus|minus):(0|[1-9]\d*)$/.exec(String(id));
  if (!match) return false;
  const index = Number(match[3]);
  return puzzle.clues[match[1]][match[2]][index] !== undefined
    && puzzle.clues[match[1]][match[2]][index] !== null;
}

function parseSnapshot(puzzle, value) {
  if (!value || typeof value !== "object") return null;
  const position = parsePosition(puzzle, value.position);
  if (!position) return null;
  if (!Number.isInteger(value.moves) || value.moves < 0) return null;
  if (!Number.isInteger(value.conflictMoves) || value.conflictMoves < 0 || value.conflictMoves > value.moves) return null;
  return {
    position: positionToJSON(position),
    moves: value.moves,
    conflictMoves: value.conflictMoves,
  };
}

export function normalizeSession(puzzle, value, options = {}) {
  if (!value || value.version !== SESSION_VERSION) return null;
  if (value.puzzleId !== puzzle.id || value.difficulty !== puzzle.difficulty) return null;
  const position = parsePosition(puzzle, value.position);
  if (!position) return null;
  for (const field of ["moves", "undos", "conflictMoves", "elapsedMs"]) {
    if (!Number.isInteger(value[field]) || value[field] < 0) return null;
  }
  if (value.conflictMoves > value.moves) return null;
  if (!Array.isArray(value.history) || value.history.length > HISTORY_LIMIT) return null;
  const history = value.history.map((snapshot) => parseSnapshot(puzzle, snapshot));
  if (history.some((snapshot) => snapshot === null)) return null;
  if (!Array.isArray(value.markedClues) || new Set(value.markedClues).size !== value.markedClues.length) return null;
  if (value.markedClues.some((id) => !clueIdExists(puzzle, id))) return null;
  if (!Number.isFinite(value.startedAt) || value.startedAt < 0) return null;

  const evaluation = evaluatePosition(puzzle, position);
  const completed = evaluation.complete;
  if (completed && value.moves < 1) return null;
  return {
    version: SESSION_VERSION,
    puzzleId: puzzle.id,
    difficulty: puzzle.difficulty,
    position: positionToJSON(position),
    moves: value.moves,
    undos: value.undos,
    conflictMoves: value.conflictMoves,
    elapsedMs: value.elapsedMs,
    history,
    markedClues: [...value.markedClues],
    completed,
    completionReported: completed && value.completionReported === true,
    startedAt: value.startedAt,
    ...(options.includeRuntime ? { evaluation } : {}),
  };
}

export function loadSession(storage, puzzles, fallbackPuzzle, options = {}) {
  const read = readOwnedJSON(storage, STORAGE_KEYS.session);
  if (!read.available) return { session: createSession(fallbackPuzzle, options), available: false, restored: false };
  if (read.value === null) {
    if (read.corrupted) removeOwned(storage, STORAGE_KEYS.session);
    return {
      session: createSession(fallbackPuzzle, options),
      available: true,
      restored: false,
      corrupted: read.corrupted,
    };
  }
  const puzzle = puzzles.find((item) => item.id === read.value.puzzleId);
  const session = puzzle ? normalizeSession(puzzle, read.value) : null;
  if (!session) {
    removeOwned(storage, STORAGE_KEYS.session);
    return {
      session: createSession(fallbackPuzzle, options),
      available: true,
      restored: false,
      corrupted: true,
    };
  }
  return { session, puzzle, available: true, restored: true, corrupted: false };
}

export function saveSession(storage, puzzle, session) {
  const normalized = normalizeSession(puzzle, session);
  if (!normalized) return false;
  return writeOwnedJSON(storage, STORAGE_KEYS.session, normalized);
}

export const DEFAULT_PREFERENCES = Object.freeze({
  version: 1,
  muted: false,
  tool: "polarity",
  difficulty: "calibration",
});

export function normalizePreferences(value, validDifficulties = ["calibration", "survey", "storm"]) {
  if (!value || value.version !== 1) return { ...DEFAULT_PREFERENCES };
  return {
    version: 1,
    muted: value.muted === true,
    tool: ["polarity", "neutral", "note", "erase"].includes(value.tool) ? value.tool : "polarity",
    difficulty: validDifficulties.includes(value.difficulty) ? value.difficulty : "calibration",
  };
}

export function loadPreferences(storage, validDifficulties) {
  const read = readOwnedJSON(storage, STORAGE_KEYS.preferences);
  if (read.corrupted) removeOwned(storage, STORAGE_KEYS.preferences);
  return { preferences: normalizePreferences(read.value, validDifficulties), available: read.available, corrupted: read.corrupted };
}

export function savePreferences(storage, preferences, validDifficulties) {
  return writeOwnedJSON(storage, STORAGE_KEYS.preferences, normalizePreferences(preferences, validDifficulties));
}

export function loadTutorialSeen(storage) {
  const read = readOwnedJSON(storage, STORAGE_KEYS.tutorial);
  if (read.corrupted || (read.value !== null && (read.value.version !== 1 || typeof read.value.seen !== "boolean"))) {
    removeOwned(storage, STORAGE_KEYS.tutorial);
    return { seen: false, available: read.available, corrupted: true };
  }
  return { seen: read.value?.seen === true, available: read.available, corrupted: false };
}

export function markTutorialSeen(storage) {
  return writeOwnedJSON(storage, STORAGE_KEYS.tutorial, { version: 1, seen: true });
}

export function readProfileDocument(storage) {
  return readOwnedJSON(storage, STORAGE_KEYS.profile);
}

export function writeProfileDocument(storage, profile) {
  return writeOwnedJSON(storage, STORAGE_KEYS.profile, profile);
}
