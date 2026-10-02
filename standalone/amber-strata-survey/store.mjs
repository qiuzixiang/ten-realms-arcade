import { replay, isWon } from './engine.mjs';
import { LEVELS } from './levels.mjs';

export const PREFIX = 'mini-polish:amber-strata-survey:v1:';
const byId = id => LEVELS.find(level => level.id === id);
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,100}$/.test(value);
const get = (storage, key) => {
  try { return JSON.parse(storage.getItem(PREFIX + key)); } catch (error) { return null; }
};
const put = (storage, key, value) => {
  try { storage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch (error) { return false; }
};

export function runId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `run-${crypto.randomUUID()}`;
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeSession(candidate) {
  if (!candidate || typeof candidate !== 'object' || !byId(candidate.levelId) ||
      !['campaign', 'practice'].includes(candidate.mode) || !validId(candidate.runId) ||
      !Number.isInteger(candidate.hints) || candidate.hints < 0 || candidate.hints > 1000 ||
      !Array.isArray(candidate.timeline)) return null;
  const level = byId(candidate.levelId);
  if (candidate.mode === 'campaign' && candidate.timeline.length &&
      (candidate.timeline[0].type !== 'scan' || candidate.timeline[0].index !== level.firstSafe)) return null;
  const restored = replay(level, candidate.timeline);
  if (!restored) return null;
  return Object.assign({ level, mode: candidate.mode, runId: candidate.runId,
    timeline: candidate.timeline, hints: candidate.hints }, restored);
}

export function loadSession(storage) { return normalizeSession(get(storage, 'session')); }
export function saveSession(storage, session) {
  return put(storage, 'session', { levelId: session.level.id, mode: session.mode,
    runId: session.runId, timeline: session.timeline, hints: session.hints });
}

function validCompletion(record) {
  if (!record || !byId(record.levelId) || !['campaign', 'practice'].includes(record.mode) ||
      !validId(record.runId) || record.eventId !== `amber-strata-survey:${record.runId}:complete` ||
      record.completionId !== record.eventId || record.gameId !== 'amber-strata-survey' ||
      record.rewardClaimId !== `amber-strata-survey:${record.mode}:${record.levelId}:first` ||
      !Array.isArray(record.timeline) || !Number.isInteger(record.moves) ||
      !Number.isInteger(record.hints) || record.hints < 0 || record.hints > 1000) return false;
  const level = byId(record.levelId);
  if (record.seed !== level.seed || record.generatorVersion !== 1 ||
      (record.mode === 'campaign' && (!record.timeline[0] || record.timeline[0].type !== 'scan' || record.timeline[0].index !== level.firstSafe))) return false;
  const result = replay(level, record.timeline);
  return Boolean(result && isWon(result.state) && result.state.moves === record.moves);
}

export function completionFromSession(session) {
  if (!isWon(session.state)) return null;
  const record = { gameId: 'amber-strata-survey', levelId: session.level.id, mode: session.mode,
    runId: session.runId, eventId: `amber-strata-survey:${session.runId}:complete`,
    completionId: `amber-strata-survey:${session.runId}:complete`, seed: session.level.seed, generatorVersion: 1,
    rewardClaimId: `amber-strata-survey:${session.mode}:${session.level.id}:first`,
    timeline: session.timeline, moves: session.state.moves, hints: session.hints };
  return validCompletion(record) ? record : null;
}

export function loadRecords(storage) {
  const raw = get(storage, 'records');
  return Array.isArray(raw) ? raw.filter(validCompletion) : [];
}
export function loadOutbox(storage) {
  const raw = get(storage, 'outbox');
  return Array.isArray(raw) ? raw.filter(validCompletion) : [];
}
export function settle(storage, record) {
  if (!validCompletion(record)) return { saved: false, first: false };
  const records = loadRecords(storage), outbox = loadOutbox(storage);
  const first = !records.some(r => r.mode === record.mode && r.levelId === record.levelId);
  const better = old => record.moves < old.moves || (record.moves === old.moves && record.hints < old.hints);
  const updated = first ? [...records, record] : records.map(old => old.mode === record.mode && old.levelId === record.levelId && better(old) ? record : old);
  const queued = outbox.some(r => r.eventId === record.eventId) ? outbox : [...outbox, record];
  if (!put(storage, 'records', updated) || !put(storage, 'outbox', queued)) return { saved: false, first: false };
  return { saved: true, first };
}

// A host may opt in. The same event ID is retained until its callback succeeds.
export async function flushOutbox(storage, host = typeof window !== 'undefined' ? window.AmberStrataSurvey : undefined) {
  if (!host || typeof host.complete !== 'function') return false;
  let queue = loadOutbox(storage);
  for (const record of [...queue]) {
    try { await host.complete(record); }
    catch (error) { return false; }
    const before = queue;
    queue = queue.filter(item => item.eventId !== record.eventId);
    if (!put(storage, 'outbox', queue)) return false;
    if (storage.flush && !(await storage.flush())) { put(storage, 'outbox', before); return false; }
  }
  return true;
}
