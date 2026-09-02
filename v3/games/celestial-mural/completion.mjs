import { evaluateBoard, replayMoves, sameBoard, stateForLevel } from "./logic.mjs";
import { findLevel } from "./levels.mjs";
import {
  GAME_ID,
  HISTORY_LIMIT,
  isPlainObject,
  normalizeProfile,
  validEventId,
  validRunId,
} from "./storage.mjs";

export const COMPLETION_SCHEMA = "ten-realms-v3.game-complete";
export const COMPLETION_EVENT = "ten-realms-v3.game-complete";
export const COMPLETION_QUEUE = "__realmCompletionQueue";

const deliveredByTarget = new WeakMap();

function canonicalTimestamp(value) {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function freezePayload(value) {
  return Object.freeze({
    ...value,
    history: Object.freeze(value.history.map((move) => Object.freeze({ ...move }))),
    rewardIds: Object.freeze([...value.rewardIds]),
  });
}

/** Only a replayable solved board may leave this game through the host bridge. */
export function normalizeCompletion(value) {
  if (!isPlainObject(value) || value.schema !== COMPLETION_SCHEMA || value.schemaVersion !== 1
      || value.gameId !== GAME_ID || value.realm !== GAME_ID || !validRunId(value.runId)
      || value.eventId !== `${GAME_ID}:${value.runId}:complete` || value.completionId !== value.eventId
      || !validEventId(value.eventId) || !Number.isInteger(value.moves) || value.moves < 1 || value.moves > HISTORY_LIMIT
      || !Number.isInteger(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > 31_536_000_000
      || !Array.isArray(value.history) || value.history.length !== value.moves || !Array.isArray(value.rewardIds)
      || value.rewardIds.length > 8 || new Set(value.rewardIds).size !== value.rewardIds.length
      || !value.rewardIds.every((id) => typeof id === "string" && id.startsWith(`${GAME_ID}:`))) return null;
  const level = findLevel(value.levelId);
  const replay = level ? replayMoves(level, value.history) : null;
  const completedAt = canonicalTimestamp(value.completedAt);
  if (!level || !replay || !evaluateBoard(level, replay.board).complete || value.difficulty !== level.difficulty
      || value.tier !== level.tier || value.par !== level.par || !completedAt || completedAt !== value.completedAt) return null;
  return freezePayload({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId: value.runId,
    eventId: value.eventId,
    completionId: value.eventId,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: level.tier,
    moves: replay.moves,
    par: level.par,
    elapsedMs: value.elapsedMs,
    history: replay.history,
    rewardIds: [...value.rewardIds],
    completedAt,
  });
}

export const validCompletion = (value) => normalizeCompletion(value) !== null;

function reward(id, kind, label, levelId, awardedAt) {
  return Object.freeze({ id, kind, label, levelId, awardedAt });
}

/**
 * Persisted settlement precedes host delivery. The local event ledger is the
 * authority for retrying the same run without minting a second reward claim.
 */
export function settleCompletion({ profile, level, state, runId, elapsedMs, completedAt = new Date().toISOString() }) {
  const official = findLevel(level?.id);
  const cleanProfile = normalizeProfile(profile, findLevel, official?.id);
  const canonicalState = official && stateForLevel(official, state?.history);
  const stamp = canonicalTimestamp(completedAt);
  if (!official || official !== level || !cleanProfile || !canonicalState || !canonicalState.complete
      || !Array.isArray(state?.board) || !sameBoard(state.board, canonicalState.board)
      || !validRunId(runId) || !Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 31_536_000_000 || !stamp) {
    throw new TypeError("A canonical solved mural, official level, run ID and elapsed time are required.");
  }
  const eventId = `${GAME_ID}:${runId}:complete`;
  if (cleanProfile.settledEvents[eventId]) {
    return Object.freeze({
      profile: cleanProfile,
      detail: completionFromSettledEvent(cleanProfile, eventId),
      claims: Object.freeze([]),
      alreadySettled: true,
    });
  }

  const moves = canonicalState.moves;
  const knownClaimIds = new Set(cleanProfile.rewardLedger.map((entry) => entry.id));
  const claims = [];
  const offer = (entry) => {
    if (!knownClaimIds.has(entry.id)) {
      knownClaimIds.add(entry.id);
      claims.push(entry);
    }
  };
  const completedBefore = cleanProfile.completedLevelIds.includes(official.id);
  const bestBefore = cleanProfile.bestMovesByLevel[official.id] ?? null;
  if (!completedBefore) offer(reward(`${GAME_ID}:clear:${official.id}`, "clear", `${official.title} · 首次显影`, official.id, stamp));
  if (bestBefore === null || moves < bestBefore) offer(reward(`${GAME_ID}:best:${official.id}:${moves}`, "best", `${official.title} · 新修复纪录 ${moves} 笔`, official.id, stamp));
  if (moves <= official.par) offer(reward(`${GAME_ID}:minimum:${official.id}`, "minimum", `${official.title} · 无返工全显影`, official.id, stamp));

  const next = {
    ...cleanProfile,
    completedLevelIds: completedBefore ? cleanProfile.completedLevelIds : [...cleanProfile.completedLevelIds, official.id],
    bestMovesByLevel: { ...cleanProfile.bestMovesByLevel, [official.id]: bestBefore === null ? moves : Math.min(bestBefore, moves) },
    rewardLedger: [...cleanProfile.rewardLedger, ...claims],
    settledEvents: {
      ...cleanProfile.settledEvents,
      [eventId]: {
        runId,
        levelId: official.id,
        moves,
        elapsedMs,
        history: canonicalState.history,
        rewardIds: claims.map((entry) => entry.id),
        completedAt: stamp,
      },
    },
  };
  const canonicalProfile = normalizeProfile(next, findLevel, official.id);
  if (!canonicalProfile) throw new TypeError("Canonical mural profile generation failed.");
  const detail = normalizeCompletion({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId,
    eventId,
    completionId: eventId,
    levelId: official.id,
    difficulty: official.difficulty,
    tier: official.tier,
    moves,
    par: official.par,
    elapsedMs,
    history: canonicalState.history,
    rewardIds: claims.map((entry) => entry.id),
    completedAt: stamp,
  });
  if (!detail) throw new TypeError("Completion proof generation failed.");
  return Object.freeze({ profile: canonicalProfile, detail, claims: Object.freeze(claims), alreadySettled: false });
}

export function completionFromSettledEvent(profile, eventId) {
  const clean = normalizeProfile(profile, findLevel, undefined);
  const settled = clean?.settledEvents?.[eventId];
  const level = settled ? findLevel(settled.levelId) : null;
  if (!clean || !settled || !level) return null;
  return normalizeCompletion({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId: settled.runId,
    eventId,
    completionId: eventId,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: level.tier,
    moves: settled.moves,
    par: level.par,
    elapsedMs: settled.elapsedMs,
    history: settled.history,
    rewardIds: settled.rewardIds,
    completedAt: settled.completedAt,
  });
}

/** Host delivery is an observation bridge, never a second local settlement. */
export function deliverCompletion(target, payload) {
  const clean = normalizeCompletion(payload);
  if (!clean || !target || (typeof target !== "object" && typeof target !== "function")) {
    return Object.freeze({ confirmed: false, duplicate: false, reason: "invalid" });
  }
  const ledger = deliveredByTarget.get(target) ?? new Set();
  if (ledger.has(clean.eventId)) return Object.freeze({ confirmed: true, duplicate: true, reason: "already-delivered" });
  const host = target.TenRealmsV3 ?? target.RealmArcade;
  if (!host || typeof host.complete !== "function") return Object.freeze({ confirmed: false, duplicate: false, reason: "host-unavailable" });
  try {
    host.complete(clean);
    ledger.add(clean.eventId);
    deliveredByTarget.set(target, ledger);
    try {
      const EventType = target.CustomEvent ?? globalThis.CustomEvent;
      if (typeof EventType === "function" && typeof target.dispatchEvent === "function") {
        target.dispatchEvent(new EventType(COMPLETION_EVENT, { detail: clean }));
      }
    } catch {
      // A convenience event must never invalidate canonical host delivery.
    }
    return Object.freeze({ confirmed: true, duplicate: false, reason: "delivered" });
  } catch {
    return Object.freeze({ confirmed: false, duplicate: false, reason: "host-threw" });
  }
}

export function queueCompletion(target, payload) {
  const clean = normalizeCompletion(payload);
  if (!clean || !target) return false;
  try {
    const existing = Array.isArray(target[COMPLETION_QUEUE])
      ? target[COMPLETION_QUEUE].map(normalizeCompletion).filter(Boolean)
      : [];
    target[COMPLETION_QUEUE] = [...existing.filter((entry) => entry.eventId !== clean.eventId), clean];
    return true;
  } catch {
    return false;
  }
}
