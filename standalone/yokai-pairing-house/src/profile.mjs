import { makePuzzle, analyze, parsePosition } from './engine.mjs';

export const PREFIX = 'mini-polish:yokai-pairing-house:v1:';
export const TUTORIAL_KEY = PREFIX + 'tutorial:yokai-pairing-house-tutorial-v1';
const PROFILE_KEY = PREFIX + 'profile';
const SESSION_KEY = PREFIX + 'session';
const OUTBOX_KEY = PREFIX + 'outbox';

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch (_) { return null; }
}
function write(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
}
export function runId() {
  var random = Math.floor(Math.random() * 0x100000000).toString(36);
  return Date.now().toString(36) + '-' + random;
}
export function loadProfile(storage, levels) {
  var raw = read(storage, PROFILE_KEY);
  var levelMap = {};
  levels.forEach(function (level) { levelMap[level.id] = level; });
  var proofs = {};
  if (raw && raw.proofs && typeof raw.proofs === 'object') Object.keys(raw.proofs).forEach(function (id) {
    var level = levelMap[id];
    if (!level) return;
    var puzzle = makePuzzle(level);
    var position = parsePosition(puzzle, raw.proofs[id]);
    if (position && analyze(puzzle, position).complete) proofs[id] = { rooms: position.rooms.slice(), excluded: [] };
  });
  var daily = {};
  if (raw && raw.daily && typeof raw.daily === 'object') Object.keys(raw.daily).forEach(function (date) {
    var entry = raw.daily[date];
    var level = entry && levelMap[entry.levelId];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !level) return;
    var puzzle = makePuzzle(level);
    var position = parsePosition(puzzle, entry.position);
    if (position && analyze(puzzle, position).complete) daily[date] = { levelId: level.id, position: { rooms: position.rooms.slice(), excluded: [] } };
  });
  var claims = raw && Array.isArray(raw.claims) ? raw.claims.filter(function (id) { return typeof id === 'string' && id.length < 200; }).slice(0, 1000) : [];
  var completionIds = raw && Array.isArray(raw.completionIds) ? raw.completionIds.filter(function (id) { return typeof id === 'string' && id.length < 250; }).slice(-1000) : [];
  return { version: 1, proofs: proofs, daily: daily, claims: Array.from(new Set(claims)), completionIds: Array.from(new Set(completionIds)) };
}
export function saveProfile(storage, profile) { return write(storage, PROFILE_KEY, profile); }
export function loadSession(storage, levels) {
  var raw = read(storage, SESSION_KEY);
  if (!raw || typeof raw !== 'object') return null;
  var level = levels.filter(function (item) { return item.id === raw.levelId; })[0];
  if (!level || (raw.mode !== 'campaign' && raw.mode !== 'daily') || typeof raw.runId !== 'string' || raw.runId.length > 100) return null;
  var puzzle = makePuzzle(level);
  var position = parsePosition(puzzle, raw.position);
  if (!position) return null;
  return { level: level, mode: raw.mode, date: typeof raw.date === 'string' ? raw.date : '', runId: raw.runId, position: position, moves: Number.isInteger(raw.moves) && raw.moves >= 0 ? Math.min(raw.moves, 100000) : 0, hinted: raw.hinted === true };
}
export function saveSession(storage, session) {
  return write(storage, SESSION_KEY, { levelId: session.level.id, mode: session.mode, date: session.date, runId: session.runId, position: session.position, moves: session.moves, hinted: session.hinted });
}
export function loadOutbox(storage) {
  var raw = read(storage, OUTBOX_KEY);
  return Array.isArray(raw) ? raw.filter(function (entry) { return entry && typeof entry.completionId === 'string' && entry.gameId === 'yokai-pairing-house'; }).slice(-100) : [];
}
export function saveOutbox(storage, entries) { return write(storage, OUTBOX_KEY, entries); }
export function tutorialSeen(storage) { try { return storage.getItem(TUTORIAL_KEY) === 'seen'; } catch (_) { return false; } }
export function markTutorialSeen(storage) { try { storage.setItem(TUTORIAL_KEY, 'seen'); return true; } catch (_) { return false; } }

export function finish(profile, session, puzzle, date) {
  if (!analyze(puzzle, session.position).complete) return null;
  var completionId = 'yokai-pairing-house:' + session.mode + ':' + session.level.id + ':' + session.runId;
  if (profile.completionIds.indexOf(completionId) >= 0) return null;
  profile.completionIds.push(completionId);
  var claims = [];
  if (session.mode === 'campaign' && !profile.proofs[session.level.id]) {
    profile.proofs[session.level.id] = { rooms: session.position.rooms.slice(), excluded: [] };
    claims.push({ id: 'yokai-pairing-house:first:' + session.level.id, kind: 'first-clear' });
  }
  if (session.mode === 'daily' && (!profile.daily[date] || profile.daily[date].levelId !== session.level.id)) {
    profile.daily[date] = { levelId: session.level.id, position: { rooms: session.position.rooms.slice(), excluded: [] } };
    claims.push({ id: 'yokai-pairing-house:daily:' + date, kind: 'daily' });
  }
  claims = claims.filter(function (claim) { return profile.claims.indexOf(claim.id) < 0; });
  claims.forEach(function (claim) { profile.claims.push(claim.id); });
  return {
    schemaVersion: 1,
    gameId: 'yokai-pairing-house',
    levelId: session.level.id,
    mode: session.mode,
    runId: session.runId,
    completionId: completionId,
    rewardClaims: claims,
    metrics: { moves: session.moves, hintsUsed: session.hinted ? 1 : 0, rooms: puzzle.total, independent: !session.hinted },
    completedAt: new Date().toISOString(),
  };
}
