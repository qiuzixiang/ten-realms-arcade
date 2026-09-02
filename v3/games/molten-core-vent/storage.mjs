import { actionKey, evaluateState, parseAction, replayActions } from "./logic.mjs";
import { GAME_ID, normalizeCompletionPayload } from "./completion-proof.mjs";

export const STORAGE_PREFIX = "ten-realms-v3:games:molten-core-vent:";
export const STORAGE_KEYS = Object.freeze({
  session: `${STORAGE_PREFIX}session:v1`, settings: `${STORAGE_PREFIX}settings:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`, records: `${STORAGE_PREFIX}records:v1`, outbox: `${STORAGE_PREFIX}outbox:v1`,
});
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const MAX_ACTIONS = 512;
const MAX_TIME = 1000 * 60 * 60 * 24 * 30;

function plain(value) { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const p = Object.getPrototypeOf(value); return p === Object.prototype || p === null; }
function read(storage, key) { try { return storage?.getItem?.(key) ?? null; } catch { return null; } }
function write(storage, key, value) { try { storage?.setItem?.(key, value); return typeof storage?.setItem === "function"; } catch { return false; } }
function json(raw) { try { return typeof raw === "string" ? JSON.parse(raw) : null; } catch { return null; } }
function text(value, max = 180) { return typeof value === "string" && value.length > 0 && value.length <= max && !["__proto__", "prototype", "constructor"].includes(value) ? value : null; }
function runId(value) { return text(value, 160) && /^(?=[a-z0-9-]{8,160}$)(?=.*[a-z0-9])[a-z0-9-]+$/i.test(value) ? value : null; }
function timestamp(value) { return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function count(value, max = Number.MAX_SAFE_INTEGER) { return Number.isSafeInteger(value) && value >= 0 && value <= max; }

export function createRunId(levelId, now = Date.now(), random = Math.random()) {
  const level = String(levelId ?? "level").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 42) || "level";
  const time = Math.max(0, Math.floor(Number(now) || 0)).toString(36);
  const entropy = Math.floor(Math.max(0, Math.min(.999999999, Number(random) || 0)) * 0x100000000).toString(36).padStart(6, "0");
  return `run-${level}-${time}-${entropy}`;
}

export function defaultSettings() { return { version: 1, difficulty: "easy", muted: false, lastLevelId: null }; }
export function loadSettings(storage) {
  const value = json(read(storage, STORAGE_KEYS.settings));
  if (!plain(value) || value.version !== 1) return defaultSettings();
  return { version: 1, difficulty: DIFFICULTIES.has(value.difficulty) ? value.difficulty : "easy", muted: value.muted === true, lastLevelId: text(value.lastLevelId, 80) ?? null };
}
export function saveSettings(storage, settings) {
  return write(storage, STORAGE_KEYS.settings, JSON.stringify({ version: 1, difficulty: DIFFICULTIES.has(settings?.difficulty) ? settings.difficulty : "easy", muted: settings?.muted === true, lastLevelId: text(settings?.lastLevelId, 80) ?? null }));
}

function cleanActions(actions) {
  if (!Array.isArray(actions) || actions.length > MAX_ACTIONS) return null;
  const clean = [];
  for (const encoded of actions) { const action = parseAction(encoded); if (!action) return null; clean.push(actionKey(action)); }
  return clean;
}
function cleanCompletion(value, id) {
  if (value == null) return null;
  if (!plain(value) || value.runId !== id || typeof value.delivered !== "boolean") return null;
  const eventId = text(value.eventId, 220), completedAt = timestamp(value.completedAt);
  return eventId === `${GAME_ID}:${id}:complete` && completedAt
    ? { runId: id, eventId, completedAt, delivered: value.delivered }
    : null;
}

export function loadSession(storage, getLevel) {
  const value = json(read(storage, STORAGE_KEYS.session));
  if (!plain(value) || value.version !== 1 || typeof getLevel !== "function") return null;
  const level = getLevel(text(value.levelId, 80));
  const id = runId(value.runId), actions = cleanActions(value.actions);
  if (!level || !id || !actions || !count(value.elapsedMs, MAX_TIME) || !count(value.undoCount, MAX_ACTIONS) || !count(value.restartCount, MAX_ACTIONS) || !count(value.conflictActions, MAX_ACTIONS)) return null;
  const state = replayActions(level, actions);
  if (!state) return null;
  const completion = cleanCompletion(value.completion, id);
  if (value.completion != null && !completion) return null;
  if (completion && !evaluateState(level, state).complete) return null;
  return { level, runId: id, actions, state, elapsedMs: value.elapsedMs, undoCount: value.undoCount, restartCount: value.restartCount, conflictActions: value.conflictActions, completion, savedAt: timestamp(value.savedAt) };
}

export function saveSession(storage, session) {
  const actions = cleanActions(session?.actions), id = runId(session?.runId);
  const rebuilt = session?.level && actions ? replayActions(session.level, actions) : null;
  if (!session?.level || !actions || !id || !rebuilt) return false;
  const completion = cleanCompletion(session.completion, id);
  if (session.completion != null && !completion) return false;
  if (completion && !evaluateState(session.level, rebuilt).complete) return false;
  return write(storage, STORAGE_KEYS.session, JSON.stringify({
    version: 1, levelId: session.level.id, runId: id, actions,
    elapsedMs: count(Math.floor(session.elapsedMs), MAX_TIME) ? Math.floor(session.elapsedMs) : 0,
    undoCount: count(session.undoCount, MAX_ACTIONS) ? session.undoCount : 0,
    restartCount: count(session.restartCount, MAX_ACTIONS) ? session.restartCount : 0,
    conflictActions: count(session.conflictActions, MAX_ACTIONS) ? session.conflictActions : 0,
    completion, savedAt: new Date().toISOString(),
  }));
}

export function tutorialSeen(storage) { return read(storage, STORAGE_KEYS.tutorial) === "seen-v1"; }
export function markTutorialSeen(storage) { return write(storage, STORAGE_KEYS.tutorial, "seen-v1"); }

export function defaultRecords() { return { version: 1, levels: {}, settledEvents: {}, stableLevels: {} }; }
export function normalizeRecords(value) {
  const clean = defaultRecords();
  if (!plain(value) || value.version !== 1) return clean;
  for (const [id, record] of Object.entries(plain(value.levels) ? value.levels : {})) {
    const key = text(id, 80);
    if (!key || !plain(record) || !count(record.wins, 100000) || record.wins < 1 || !count(record.bestActions, MAX_ACTIONS)) continue;
    const firstAt = timestamp(record.firstAt), lastAt = timestamp(record.lastAt);
    if (firstAt && lastAt) clean.levels[key] = { wins: record.wins, bestActions: record.bestActions, firstAt, lastAt };
  }
  for (const [id, at] of Object.entries(plain(value.settledEvents) ? value.settledEvents : {})) { const key = text(id, 220), time = timestamp(at); if (key && time) clean.settledEvents[key] = time; }
  for (const [id, at] of Object.entries(plain(value.stableLevels) ? value.stableLevels : {})) { const key = text(id, 80), time = timestamp(at); if (key && time) clean.stableLevels[key] = time; }
  return clean;
}
export function loadRecords(storage) { return normalizeRecords(json(read(storage, STORAGE_KEYS.records))); }
export function saveRecords(storage, records) { return write(storage, STORAGE_KEYS.records, JSON.stringify(normalizeRecords(records))); }
export function recordCompletion(records, payload) {
  const next = normalizeRecords(records), canonical = normalizeCompletionPayload(payload);
  if (!canonical) return { records: next, changed: false, firstClear: false, personalBest: false, stable: false };
  const { eventId, levelId } = canonical;
  const at = canonical.completedAt;
  if (next.settledEvents[eventId]) return { records: next, changed: false, firstClear: false, personalBest: false, stable: false };
  const previous = next.levels[levelId];
  const personalBest = Boolean(previous && canonical.moves < previous.bestActions);
  next.levels[levelId] = { wins: (previous?.wins ?? 0) + 1, bestActions: Math.min(previous?.bestActions ?? Infinity, canonical.moves), firstAt: previous?.firstAt ?? at, lastAt: at };
  next.settledEvents[eventId] = at;
  const stable = canonical.noConflict === true;
  if (stable && !next.stableLevels[levelId]) next.stableLevels[levelId] = at;
  return { records: next, changed: true, firstClear: !previous, personalBest, stable };
}

function cleanOutboxItem(value) {
  return normalizeCompletionPayload(value);
}
export function loadOutbox(storage) {
  const value = json(read(storage, STORAGE_KEYS.outbox));
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  for (const item of value) { const clean = cleanOutboxItem(item); if (clean) unique.set(clean.eventId, clean); }
  return [...unique.values()];
}
export function saveOutbox(storage, values) {
  const unique = new Map();
  for (const item of Array.isArray(values) ? values : []) { const clean = cleanOutboxItem(item); if (clean) unique.set(clean.eventId, clean); }
  return write(storage, STORAGE_KEYS.outbox, JSON.stringify([...unique.values()]));
}
