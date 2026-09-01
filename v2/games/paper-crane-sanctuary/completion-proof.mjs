import {
  evaluateState,
  moveKey,
  parseMove,
  replayMoves,
} from "./logic.mjs";
import { findLevel } from "./levels.mjs";

export const GAME_ID = "paper-crane-sanctuary";
export const COMPLETION_SCHEMA = "ten-realms-v2/game-completion@1";
export const METRIC_NOTE = "Each legal jump removes exactly one crane; move count is not an optimisation score.";

const MAX_MOVES = 256;
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

function boundedCount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_MOVES;
}

function canonicalTimeline(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MOVES) return null;
  const timeline = [];
  for (const encoded of value) {
    if (typeof encoded !== "string" || encoded.length > 40) return null;
    const move = parseMove(encoded);
    if (!move || moveKey(move) !== encoded) return null;
    timeline.push(encoded);
  }
  return timeline;
}

export function replayCompletionTimeline(level, timeline) {
  const canonical = canonicalTimeline(timeline);
  if (!level || !canonical) return null;
  const state = replayMoves(level, canonical);
  const evaluation = state ? evaluateState(state) : null;
  if (!state || !evaluation?.complete || state.moveCount !== canonical.length) return null;
  return Object.freeze({ timeline: Object.freeze(canonical), state });
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
  const tier = ({ easy: 1, medium: 2, hard: 3 })[level?.difficulty];
  if (!level || !proof
      || payload.schema !== COMPLETION_SCHEMA || payload.schemaVersion !== 1
      || payload.gameId !== GAME_ID || payload.realm !== GAME_ID
      || !validRunId(payload.runId)
      || payload.eventId !== `${GAME_ID}:${payload.runId}:complete`
      || payload.difficulty !== level.difficulty || payload.tier !== tier
      || payload.puzzleSeed !== level.seed
      || payload.moves !== proof.timeline.length
      || !Number.isSafeInteger(payload.elapsedMs) || payload.elapsedMs < 0 || payload.elapsedMs > MAX_ELAPSED_MS
      || !boundedCount(payload.undoCount) || !boundedCount(payload.restartCount)
      || payload.noUndo !== (payload.undoCount === 0)
      || payload.noRestart !== (payload.restartCount === 0)
      || payload.metricNote !== METRIC_NOTE
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
    tier,
    puzzleSeed: level.seed,
    timeline: proof.timeline,
    moves: proof.timeline.length,
    elapsedMs: payload.elapsedMs,
    undoCount: payload.undoCount,
    restartCount: payload.restartCount,
    noUndo: payload.noUndo,
    noRestart: payload.noRestart,
    completedAt,
    metricNote: METRIC_NOTE,
  });
}

export function validateCompletionPayload(payload) {
  return normalizeCompletionPayload(payload) !== null;
}
