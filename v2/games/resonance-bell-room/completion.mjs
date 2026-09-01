import { evaluateState, replayPresses } from "./logic.mjs";
import { getLevel } from "./levels.mjs";
import {
  GAME_ID,
  STORAGE_KEYS,
  isPlainObject,
  normalizeProfile,
  safeRead,
  safeRemove,
  safeSet,
} from "./storage.mjs";

export const COMPLETION_SCHEMA = "ten-realms-v2/game-completion@1";
export const OUTBOX_VERSION = 1;

function validRunId(value) {
  return typeof value === "string" && /^(?=[a-z0-9-]{8,80}$)(?=.*[a-z])[a-z0-9-]+$/.test(value);
}

function canonicalTimestamp(value = new Date().toISOString()) {
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function freezeDetail(detail) {
  return Object.freeze({
    ...detail,
    history: Object.freeze([...detail.history]),
    rewardIds: Object.freeze([...detail.rewardIds]),
  });
}

export function validateCompletion(detail) {
  const level = getLevel(detail?.levelId);
  const replayed = level ? replayPresses(level, detail?.history) : null;
  const timestamp = canonicalTimestamp(detail?.completedAt);
  return isPlainObject(detail)
    && Boolean(level)
    && Boolean(replayed)
    && evaluateState(level, replayed).complete
    && detail.schema === COMPLETION_SCHEMA
    && detail.schemaVersion === 1
    && detail.game === GAME_ID
    && detail.gameId === GAME_ID
    && detail.realm === GAME_ID
    && validRunId(detail.runId)
    && detail.completionId === `${GAME_ID}:${level.id}:run:${detail.runId}`
    && detail.eventId === detail.completionId
    && detail.difficulty === level.difficulty
    && detail.tier === level.tier
    && Number.isInteger(detail.moves) && detail.moves >= 1 && detail.moves <= 10000
    && detail.moves === replayed.moves
    && detail.par === level.suggestedMinimum
    && detail.minimumTaps === level.suggestedMinimum
    && detail.minimumProven === true
    && detail.efficient === (detail.moves === level.suggestedMinimum)
    && Number.isInteger(detail.elapsedMs) && detail.elapsedMs >= 0 && detail.elapsedMs <= 31_536_000_000
    && Array.isArray(detail.rewardIds) && detail.rewardIds.length <= 10
    && new Set(detail.rewardIds).size === detail.rewardIds.length
    && detail.rewardIds.every((id) => typeof id === "string" && id.startsWith(`${GAME_ID}:`))
    && timestamp === detail.completedAt;
}

function reward(id, kind, label, suggestedXp, awardedAt) {
  return Object.freeze({ id, kind, label, suggestedXp, awardedAt });
}

export function settleCompletion({ profile, level, state, runId, elapsedMs, completedAt = new Date().toISOString() }) {
  const cleanProfile = normalizeProfile(profile, getLevel);
  const replayed = replayPresses(level, state?.history);
  const stateMatchesReplay = replayed
    && state?.moves === replayed.moves
    && Array.isArray(state?.lights)
    && state.lights.length === replayed.lights.length
    && state.lights.every((light, index) => light === replayed.lights[index])
    && Array.isArray(state?.pressParity)
    && state.pressParity.length === replayed.pressParity.length
    && state.pressParity.every((parity, index) => parity === replayed.pressParity[index]);
  const timestamp = canonicalTimestamp(completedAt);
  if (!cleanProfile || !stateMatchesReplay || !evaluateState(level, replayed).complete || !validRunId(runId)
      || !Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 31_536_000_000
      || !timestamp || !Number.isInteger(level?.suggestedMinimum) || level.suggestedMinimum < 1) {
    throw new TypeError("A verified solved state, profile, run ID, and elapsed time are required.");
  }
  if (cleanProfile.settledRuns[runId]) {
    return Object.freeze({ profile: cleanProfile, detail: null, claims: Object.freeze([]), alreadySettled: true });
  }

  const moves = replayed.moves;
  const priorBest = cleanProfile.bestMovesByLevel[level.id] ?? null;
  const completedBefore = cleanProfile.completedLevelIds.includes(level.id);
  const knownRewards = new Set(cleanProfile.rewardLedger.map(({ id }) => id));
  const claims = [];
  const offer = (entry) => {
    if (!knownRewards.has(entry.id)) {
      knownRewards.add(entry.id);
      claims.push(entry);
    }
  };
  if (!completedBefore) {
    offer(reward(
      `${GAME_ID}:clear:${level.id}`,
      "clear",
      `${level.title} · 首次齐鸣`,
      70 + level.tier * 30,
      timestamp,
    ));
  }
  if (priorBest === null || moves < priorBest) {
    offer(reward(
      `${GAME_ID}:best:${level.id}:${moves}`,
      "best",
      `${level.title} · 新纪录 ${moves} 敲`,
      25,
      timestamp,
    ));
  }
  if (moves === level.suggestedMinimum) {
    offer(reward(
      `${GAME_ID}:minimum:${level.id}`,
      "minimum",
      `${level.title} · 求解器最少敲击`,
      45 + level.tier * 15,
      timestamp,
    ));
  }

  const completionId = `${GAME_ID}:${level.id}:run:${runId}`;
  const completedLevelIds = completedBefore
    ? [...cleanProfile.completedLevelIds]
    : [...cleanProfile.completedLevelIds, level.id];
  const bestMovesByLevel = {
    ...cleanProfile.bestMovesByLevel,
    [level.id]: priorBest === null ? moves : Math.min(priorBest, moves),
  };
  const settledRuns = {
    ...cleanProfile.settledRuns,
    [runId]: {
      levelId: level.id,
      moves,
      history: [...replayed.history],
      elapsedMs,
      completionId,
      completedAt: timestamp,
      rewardIds: claims.map(({ id }) => id),
    },
  };
  const nextProfile = normalizeProfile({
    ...cleanProfile,
    completedLevelIds,
    bestMovesByLevel,
    rewardLedger: [...cleanProfile.rewardLedger, ...claims],
    settledRuns,
  }, getLevel);
  if (!nextProfile) throw new TypeError("Completion could not produce a canonical profile.");

  const detail = freezeDetail({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    game: GAME_ID,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId,
    completionId,
    eventId: completionId,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: level.tier,
    moves,
    history: [...replayed.history],
    par: level.suggestedMinimum,
    minimumTaps: level.suggestedMinimum,
    minimumProven: true,
    efficient: moves === level.suggestedMinimum,
    elapsedMs,
    rewardIds: claims.map(({ id }) => id),
    completedAt: timestamp,
  });
  if (!validateCompletion(detail)) throw new TypeError("Completion payload failed canonical validation.");
  return Object.freeze({
    profile: nextProfile,
    detail,
    claims: Object.freeze(claims),
    alreadySettled: false,
  });
}

function completionFromCanonicalProfile(cleanProfile, runId) {
  const settled = cleanProfile?.settledRuns?.[runId];
  const level = settled ? getLevel(settled.levelId) : null;
  if (!level) return null;
  const detail = freezeDetail({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    game: GAME_ID,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId,
    completionId: settled.completionId,
    eventId: settled.completionId,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: level.tier,
    moves: settled.moves,
    history: settled.history,
    par: level.suggestedMinimum,
    minimumTaps: level.suggestedMinimum,
    minimumProven: true,
    efficient: settled.moves === level.suggestedMinimum,
    elapsedMs: settled.elapsedMs,
    rewardIds: settled.rewardIds,
    completedAt: settled.completedAt,
  });
  return validateCompletion(detail) ? detail : null;
}

export function completionFromSettledRun(profile, runId) {
  return completionFromCanonicalProfile(normalizeProfile(profile, getLevel), runId);
}

function sameCompletion(left, right) {
  return Boolean(left && right)
    && left.completionId === right.completionId
    && left.moves === right.moves
    && left.elapsedMs === right.elapsedMs
    && left.completedAt === right.completedAt
    && left.history.length === right.history.length
    && left.history.every((press, index) => press === right.history[index])
    && left.rewardIds.length === right.rewardIds.length
    && left.rewardIds.every((id, index) => id === right.rewardIds[index]);
}

function parseOutbox(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isPlainObject(value) || value.version !== OUTBOX_VERSION
      || !Array.isArray(value.entries)) return null;
  const entries = value.entries.map((entry) => validateCompletion(entry) ? freezeDetail(entry) : null);
  if (entries.includes(null) || new Set(entries.map(({ completionId }) => completionId)).size !== entries.length) return null;
  return entries;
}

export function loadCompletionOutbox(storage) {
  const read = safeRead(storage, STORAGE_KEYS.outbox);
  if (!read.available) return { entries: [], status: "unavailable", available: false };
  const raw = read.value;
  if (raw === null) return { entries: [], status: "empty", available: true };
  const entries = parseOutbox(raw);
  if (entries) return { entries, status: "restored", available: true };
  const removed = safeRemove(storage, STORAGE_KEYS.outbox);
  const verification = removed ? null : safeRead(storage, STORAGE_KEYS.outbox);
  const verified = removed || (verification.available && verification.value === null);
  return { entries: [], status: "invalid", available: verified };
}

function saveOutbox(storage, entries) {
  if (!Array.isArray(entries) || entries.some((entry) => !validateCompletion(entry))) return false;
  if (entries.length === 0) {
    if (safeRemove(storage, STORAGE_KEYS.outbox)) return true;
    const read = safeRead(storage, STORAGE_KEYS.outbox);
    return read.available && read.value === null;
  }
  return safeSet(storage, STORAGE_KEYS.outbox, JSON.stringify({ version: OUTBOX_VERSION, entries }));
}

export function enqueueCompletion(storage, detail) {
  if (!validateCompletion(detail)) return false;
  const loaded = loadCompletionOutbox(storage);
  if (!loaded.available) return false;
  const withoutDuplicate = loaded.entries.filter((entry) => entry.completionId !== detail.completionId);
  return saveOutbox(storage, [...withoutDuplicate, detail]);
}

/** Deliver durable entries once. Failed or unavailable adapters leave them intact. */
export function flushCompletionOutbox(storage, target, profile) {
  const loaded = loadCompletionOutbox(storage);
  const cleanProfile = normalizeProfile(profile, getLevel);
  const complete = target?.RealmArcade?.complete;
  if (!loaded.available || typeof complete !== "function" || !cleanProfile) {
    return Object.freeze({ delivered: 0, pending: loaded.entries.length, available: loaded.available });
  }
  const pending = [];
  let delivered = 0;
  for (const entry of loaded.entries) {
    const canonical = completionFromCanonicalProfile(cleanProfile, entry.runId);
    if (!sameCompletion(entry, canonical)) {
      pending.push(entry);
      continue;
    }
    try {
      complete.call(target.RealmArcade, entry);
      delivered += 1;
      try {
        target.dispatchEvent?.(new target.CustomEvent("ten-realms-v2.game-complete", { detail: entry }));
      } catch { /* observation mirrors never affect durable delivery */ }
    } catch {
      pending.push(entry);
    }
  }
  const saved = saveOutbox(storage, pending);
  return Object.freeze({ delivered, pending: saved ? pending.length : loaded.entries.length, available: loaded.available && saved });
}
