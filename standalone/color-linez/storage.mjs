import { createGame, replay } from './core.mjs';

export const KEYS = Object.freeze({ session: 'glass-linez:v1:session', records: 'glass-linez:v1:records', settings: 'glass-linez:v1:settings', tutorial: 'glass-linez:tutorial:1' });
export const DEFAULT_SETTINGS = Object.freeze({ sound: false, preview: true, symbols: true });
const read = (storage, key) => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
export function safeWrite(storage, key, value) { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
export function loadSettings(storage) {
  const saved = read(storage, KEYS.settings) || {};
  return Object.entries(DEFAULT_SETTINGS).reduce((settings, [key, fallback]) => { settings[key] = typeof saved[key] === 'boolean' ? saved[key] : fallback; return settings; }, {});
}
export function loadSession(storage) {
  const saved = read(storage, KEYS.session);
  if (!saved || saved.version !== 1 || typeof saved.id !== 'string' || !/^[a-z0-9-]{1,90}$/.test(saved.id)) return null;
  try {
    const state = replay(saved.seed, saved.moves);
    return { session: { version: 1, id: saved.id, seed: saved.seed, moves: saved.moves, target: Number.isSafeInteger(saved.target) && saved.target >= 100 ? saved.target : 100 }, state };
  } catch { return null; }
}
export function freshSession(seed, id, target = 100) {
  return { session: { version: 1, id, seed, moves: [], target: Math.max(100, target) }, state: createGame(seed) };
}
export function loadRecords(storage) {
  const value = read(storage, KEYS.records);
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter((r) => r && typeof r.id === 'string' && !seen.has(r.id) && seen.add(r.id) && Number.isSafeInteger(r.score) && r.score > 0 && Number.isSafeInteger(r.turns) && r.turns >= 0 && typeof r.date === 'string').sort((a, b) => b.score - a.score).slice(0, 10);
}
export function recordRun(records, session, state, date) {
  if (!state.score) return records;
  return [...records.filter((r) => r.id !== session.id), { id: session.id, score: state.score, turns: state.turns, date }].sort((a, b) => b.score - a.score).slice(0, 10);
}
