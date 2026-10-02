/** Standalone progress. Only validated move histories are persisted as proof. */
import { createGame, attemptMove, DIRECTIONS, STATUS } from './core.mjs';
import { LEVELS, getLevel, createDailyLevel, createExpeditionLevel } from './levels.mjs';

export const STORAGE_KEY = 'star-drift-standalone:profile:v1';
export const MAX_MOVE_LOG = 512;
const MODES = new Set(['campaign', 'daily', 'expedition']);
const directionSet = new Set(DIRECTIONS);
const campaignIndices = new Map(LEVELS.map((level, index) => [level.id, index]));
let fallbackSequence = 0;

export function createProfile() {
  return {
    version: 1,
    settings: { sound: true },
    tutorialVersion: 0,
    records: {},
    currentRun: null,
    suspendedRuns: {},
    settlements: [],
    claimIds: [],
    completionIds: [],
    total: emptyStats(),
  };
}

function emptyStats() {
  return {
    stars: 0, fragments: 0, completed: 0, completions: 0,
    campaignStars: 0, campaignCompleted: 0, dailyCompleted: 0,
    expeditionCompleted: 0, mastered: 0, bestImprovements: 0,
    totalMoves: 0,
  };
}

function newRunId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  fallbackSequence += 1;
  return `${Date.now().toString(36)}-${fallbackSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function safeIdentifier(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{1,160}$/.test(value);
}

function metadata(level, mode) {
  const result = { levelId: level.id, mode };
  if (Number.isInteger(level.seed) && level.seed >= 0 && level.seed <= 0xffffffff) result.seed = level.seed;
  if (typeof level.seed === 'string' && level.seed.length <= 160) result.seed = level.seed;
  if (typeof level.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(level.date)) result.date = level.date;
  if (Number.isInteger(level.difficulty) || ['easy', 'medium', 'hard'].includes(level.difficulty)) result.difficulty = level.difficulty;
  const campaignIndex = campaignIndices.get(level.id);
  if (campaignIndex !== undefined) result.campaignIndex = campaignIndex;
  return result;
}

function canonicalRun(candidate, level) {
  if (!candidate || !safeIdentifier(candidate.id) || candidate.levelId !== level?.id || !MODES.has(candidate.mode)) return null;
  if (candidate.mode === 'campaign' && !campaignIndices.has(level.id)) return null;
  if (campaignIndices.has(level.id) && candidate.mode !== 'campaign') return null;
  if (level.mode && level.mode !== candidate.mode) return null;
  if (!Array.isArray(candidate.moveLog) || candidate.moveLog.length > MAX_MOVE_LOG || candidate.moveLog.some(move => !directionSet.has(move))) return null;
  if (!Number.isSafeInteger(candidate.hints) || candidate.hints < 0) return null;
  return { id: candidate.id, ...metadata(level, candidate.mode), moveLog: [...candidate.moveLog], hints: candidate.hints };
}

function defaultResolver(id, candidate) {
  if (candidate.mode === 'daily' && typeof candidate.date === 'string') return createDailyLevel(candidate.date);
  if (candidate.mode === 'expedition' && candidate.seed !== undefined) return createExpeditionLevel(candidate.seed, candidate.difficulty);
  return getLevel(id);
}

function resolve(candidate, resolveLevel = defaultResolver) {
  if (!candidate || !safeIdentifier(candidate.levelId) || typeof resolveLevel !== 'function') return null;
  try {
    const level = resolveLevel(candidate.levelId, candidate);
    return level?.id === candidate.levelId ? level : null;
  } catch { return null; }
}

function replayRun(run, level) {
  const canonical = canonicalRun(run, level);
  if (!canonical) return null;
  try {
    let game = createGame(level);
    for (const direction of canonical.moveLog) {
      const result = attemptMove(game, direction);
      if (!result.moved) return null;
      game = result.state;
    }
    return game;
  } catch { return null; }
}

function resumableRun(profile, candidate, resolveLevel = defaultResolver) {
  const level = resolve(candidate, resolveLevel);
  const run = level && canonicalRun(candidate, level);
  if (!run || !replayRun(run, level)) return null;
  if (run.mode === 'campaign' && !isUnlocked(profile, campaignIndices.get(level.id))) return null;
  return run;
}

function suspendCurrent(profile, targetMode) {
  const slots = { ...(profile.suspendedRuns ?? {}) };
  delete slots[targetMode];
  const current = profile.currentRun;
  if (current && current.mode !== targetMode) {
    const valid = resumableRun(profile, current);
    if (valid) slots[current.mode] = valid;
  }
  return slots;
}

function sameGame(first, second) {
  return first?.levelId === second?.levelId
    && first?.status === second?.status
    && first?.moves === second?.moves
    && first?.collected === second?.collected
    && first?.totalEnergy === second?.totalEnergy
    && first?.position?.x === second?.position?.x
    && first?.position?.y === second?.position?.y
    && Array.isArray(first?.remainingEnergy)
    && [...first.remainingEnergy].sort().join('|') === [...second.remainingEnergy].sort().join('|');
}

/** Invalid or forged status fields are ignored: replay is the only source. */
export function restoreRun(profile, resolveLevel = defaultResolver) {
  const run = resumableRun(profile, profile?.currentRun, resolveLevel);
  const level = run && resolve(run, resolveLevel);
  return level ? replayRun(run, level) : null;
}

export function beginRun(profile, level, mode = 'campaign') {
  if (!MODES.has(mode)) throw new RangeError(`Unknown play mode: ${mode}`);
  createGame(level); // Validate before touching any existing progress.
  const run = canonicalRun({ id: newRunId(), levelId: level.id, mode, moveLog: [], hints: 0 }, level);
  if (!run) throw new RangeError('The level does not belong to this play mode.');
  if (mode === 'campaign' && !isUnlocked(profile, campaignIndices.get(level.id))) throw new RangeError('This campaign level is still locked.');
  return { ...profile, currentRun: run, suspendedRuns: suspendCurrent(profile, mode) };
}

/** Resume one valid paused mode, without changing its run id or hint usage. */
export function resumeMode(profile, mode) {
  if (!MODES.has(mode) || profile?.currentRun?.mode === mode) return profile;
  const candidate = profile?.suspendedRuns?.[mode];
  if (candidate?.mode !== mode || candidate?.id === profile?.currentRun?.id) return profile;
  const target = resumableRun(profile, candidate);
  if (!target) return profile;
  return { ...profile, currentRun: target, suspendedRuns: suspendCurrent(profile, mode) };
}

/** Updating also handles undo. Hint use persists throughout the attempt. */
export function updateRun(profile, game, { hints } = {}) {
  const current = profile?.currentRun;
  if (!current || current.levelId !== game?.levelId || !Array.isArray(game.moveLog)) return profile;
  let next = {
    ...current,
    moveLog: [...game.moveLog],
    hints: Number.isSafeInteger(hints) && hints >= 0 ? Math.max(hints, current.hints) : current.hints,
  };
  const officialLevel = resolve(current);
  const replayed = officialLevel && replayRun(next, officialLevel);
  if (!replayed || !sameGame(game, replayed)) return profile;
  // Undoing an already settled victory starts a fresh attempt, with hints kept.
  if (profile.completionIds.includes(completionId(current)) && game.status !== STATUS.WON) {
    next = { ...next, id: newRunId() };
  }
  return { ...profile, currentRun: next };
}

export function recordHint(profile) {
  if (!profile?.currentRun || profile.currentRun.hints >= Number.MAX_SAFE_INTEGER) return profile;
  return { ...profile, currentRun: { ...profile.currentRun, hints: profile.currentRun.hints + 1 } };
}

/** Undo never deducts stars; only hint use and the final valid route matter. */
export function starsFor(game, hints = 0) {
  if (game?.status !== STATUS.WON || !Number.isSafeInteger(hints) || hints < 0) return 0;
  if (hints > 0) return 1;
  return Number.isInteger(game.level?.par) && game.moves <= game.level.par ? 3 : 2;
}

function completionId(run) { return `star-drift:${run.id}:complete`; }

function addSettlement(profile, proof, game) {
  const id = completionId(proof);
  if (profile.completionIds.includes(id)) return profile;
  const previous = profile.records[game.levelId];
  const rating = starsFor(game, proof.hints);
  const bestImproved = Boolean(previous && game.moves < previous.bestMoves);
  const record = {
    levelId: game.levelId,
    mode: proof.mode,
    ...(campaignIndices.has(game.levelId) ? { campaignIndex: campaignIndices.get(game.levelId) } : {}),
    bestMoves: Math.min(previous?.bestMoves ?? Infinity, game.moves),
    stars: Math.max(previous?.stars ?? 0, rating),
    completions: (previous?.completions ?? 0) + 1,
    bestImprovements: (previous?.bestImprovements ?? 0) + Number(bestImproved),
    firstCompletedAt: previous?.firstCompletedAt ?? proof.completedAt,
    lastCompletedAt: proof.completedAt,
  };
  const claims = new Set(profile.claimIds);
  claims.add(`star-drift:${game.levelId}:fragment`);
  for (let star = 1; star <= record.stars; star++) claims.add(`star-drift:${game.levelId}:star:${star}`);
  if (bestImproved) claims.add(`star-drift:${game.levelId}:best:${game.moves}`);
  const updated = {
    ...profile,
    records: { ...profile.records, [game.levelId]: record },
    settlements: [...profile.settlements, proof],
    claimIds: [...claims],
    completionIds: [...profile.completionIds, id],
  };
  updated.total = getStats(updated);
  return updated;
}

/** Safe to retry after refresh or a failed localStorage write. */
export function completeRun(profile, game) {
  const current = profile?.currentRun;
  if (!current || current.levelId !== game?.levelId || game.status !== STATUS.WON) return profile;
  if (profile.completionIds.includes(completionId(current))) return profile;
  const updated = updateRun(profile, game);
  const officialLevel = resolve(updated.currentRun);
  const run = officialLevel && canonicalRun(updated.currentRun, officialLevel);
  const replayed = run && replayRun(run, officialLevel);
  if (!replayed || replayed.status !== STATUS.WON || !sameGame(game, replayed)) return profile;
  const proof = { ...run, completedAt: new Date().toISOString() };
  return addSettlement(updated, proof, replayed);
}

export function getStats(profile) {
  const stats = emptyStats();
  for (const record of Object.values(profile?.records ?? {})) {
    stats.stars += record.stars;
    stats.fragments += 1;
    stats.completed += 1;
    stats.completions += record.completions;
    stats.mastered += Number(record.stars === 3);
    stats.bestImprovements += record.bestImprovements;
    if (record.mode === 'campaign') {
      stats.campaignCompleted += 1;
      stats.campaignStars += record.stars;
    } else if (record.mode === 'daily') stats.dailyCompleted += 1;
    else if (record.mode === 'expedition') stats.expeditionCompleted += 1;
  }
  stats.totalMoves = (profile?.settlements ?? []).reduce((sum, proof) => sum + proof.moveLog.length, 0);
  return stats;
}

export function isUnlocked(profile, index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) return false;
  if (index === 0) return true;
  if ((profile?.records?.[LEVELS[index].id]?.completions ?? 0) > 0) return true;
  return (profile?.records?.[LEVELS[index - 1].id]?.completions ?? 0) > 0;
}

/** Read errors never clear any key. Each valid completion survives a bad run. */
export function loadProfile(storage, resolveLevel = defaultResolver) {
  let raw;
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return createProfile();
    raw = JSON.parse(text);
  } catch { return createProfile(); }
  if (!raw || raw.version !== 1 || typeof raw !== 'object') return createProfile();
  let profile = createProfile();
  profile.settings.sound = raw.settings?.sound !== false;
  profile.tutorialVersion = Number.isSafeInteger(raw.tutorialVersion) && raw.tutorialVersion >= 0 ? raw.tutorialVersion : 0;
  const cache = new Map();
  const cachedResolve = (id, run) => {
    if (!cache.has(id)) cache.set(id, resolve(run, resolveLevel));
    return cache.get(id);
  };
  if (Array.isArray(raw.settlements)) {
    for (const candidate of raw.settlements) {
      const level = resolve(candidate, cachedResolve);
      const run = level && canonicalRun(candidate, level);
      const game = run && replayRun(run, level);
      if (!game || game.status !== STATUS.WON) continue;
      const completedAt = typeof candidate.completedAt === 'string' && candidate.completedAt.length <= 40 && Number.isFinite(Date.parse(candidate.completedAt))
        ? new Date(candidate.completedAt).toISOString() : '1970-01-01T00:00:00.000Z';
      profile = addSettlement(profile, { ...run, completedAt }, game);
    }
  }
  const run = resumableRun(profile, raw.currentRun, cachedResolve);
  if (run) profile.currentRun = run;
  if (raw.suspendedRuns && typeof raw.suspendedRuns === 'object' && !Array.isArray(raw.suspendedRuns)) {
    for (const mode of MODES) {
      const candidate = raw.suspendedRuns[mode];
      if (candidate?.mode !== mode || mode === run?.mode || candidate?.id === run?.id) continue;
      const paused = resumableRun(profile, candidate, cachedResolve);
      if (paused) profile.suspendedRuns[mode] = paused;
    }
  }
  return profile;
}

/** Writes are explicit; the caller can show an unsaved indicator and retry. */
export function saveProfile(storage, profile) {
  try {
    if (!storage || typeof storage.setItem !== 'function') throw new Error('当前浏览器无法保存进度');
    storage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '进度保存失败' };
  }
}
