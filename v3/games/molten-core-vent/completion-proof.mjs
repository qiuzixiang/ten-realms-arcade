import {
  actionKey,
  evaluateState,
  parseAction,
  replayActions,
} from "./logic.mjs";
import { findLevel } from "./levels.mjs";

export const GAME_ID = "molten-core-vent";
export const COMPLETION_SCHEMA = "ten-realms-v3/game-completion@1";

const MAX_ACTIONS = 512;
const MAX_ELAPSED_MS = 31_536_000_000;

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validRunId(value) {
  return typeof value === "string"
    && !["__proto__", "prototype", "constructor"].includes(value)
    && /^(?=[a-z0-9-]{8,160}$)(?=.*[a-z0-9])[a-z0-9-]+$/i.test(value);
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function boundedCount(value, maximum = MAX_ACTIONS) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function canonicalTimeline(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ACTIONS) return null;
  const timeline = [];
  for (const encoded of value) {
    if (typeof encoded !== "string" || encoded.length > 30) return null;
    const action = parseAction(encoded);
    if (!action || actionKey(action) !== encoded) return null;
    timeline.push(encoded);
  }
  return timeline;
}

export function replayCompletionTimeline(level, timeline) {
  const canonical = canonicalTimeline(timeline);
  if (!level || !canonical) return null;
  const state = replayActions(level, canonical);
  if (!state || !evaluateState(level, state).complete || state.moveCount !== canonical.length) return null;
  return Object.freeze({
    timeline: Object.freeze(canonical),
    state,
  });
}

export function sameReplayedState(candidate, replayed) {
  return Boolean(candidate && replayed)
    && candidate.width === replayed.width
    && candidate.height === replayed.height
    && candidate.moveCount === replayed.moveCount
    && Array.isArray(candidate.cells)
    && candidate.cells.length === replayed.cells.length
    && candidate.cells.every((value, index) => value === replayed.cells[index]);
}

export function normalizeCompletionPayload(payload) {
  if (!plainObject(payload)) return null;
  const level = findLevel(payload.levelId);
  const proof = level ? replayCompletionTimeline(level, payload.timeline) : null;
  const completedAt = canonicalTimestamp(payload.completedAt);
  if (!level || !proof
      || payload.schema !== COMPLETION_SCHEMA || payload.schemaVersion !== 1
      || payload.gameId !== GAME_ID || payload.realm !== GAME_ID
      || !validRunId(payload.runId)
      || payload.eventId !== `${GAME_ID}:${payload.runId}:complete`
      || payload.difficulty !== level.difficulty || payload.tier !== ({ easy: 1, medium: 2, hard: 3 })[level.difficulty]
      || payload.puzzleSeed !== level.seed
      || payload.moves !== proof.timeline.length
      || !Number.isSafeInteger(payload.elapsedMs) || payload.elapsedMs < 0 || payload.elapsedMs > MAX_ELAPSED_MS
      || !boundedCount(payload.conflictActions) || !boundedCount(payload.undoCount)
      || payload.noConflict !== (payload.conflictActions === 0)
      || payload.noUndo !== (payload.undoCount === 0)
      || completedAt !== payload.completedAt) return null;

  return Object.freeze({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId: payload.runId,
    eventId: payload.eventId,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: ({ easy: 1, medium: 2, hard: 3 })[level.difficulty],
    puzzleSeed: level.seed,
    timeline: proof.timeline,
    moves: proof.timeline.length,
    elapsedMs: payload.elapsedMs,
    conflictActions: payload.conflictActions,
    undoCount: payload.undoCount,
    noConflict: payload.noConflict,
    noUndo: payload.noUndo,
    completedAt,
  });
}

export function validateCompletionPayload(payload) {
  return normalizeCompletionPayload(payload) !== null;
}
