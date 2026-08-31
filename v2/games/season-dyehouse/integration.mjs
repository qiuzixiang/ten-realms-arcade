import { GENERATOR_VERSION } from "./logic.mjs";

export const GAME_ID = "season-dyehouse";
export { GENERATOR_VERSION };
export const COMPLETE_EVENT = "ten-realms-v2:game-complete";
export const READY_EVENT = "ten-realms-v2:game-ready";
export const COMPLETION_QUEUE = "__realmCompletionQueue";

const ATTEMPT_ID_PATTERN = /^[a-z0-9._~-]{8,80}$/i;

export function normalizeAttemptId(value) {
  const attemptId = typeof value === "string" ? value.trim() : "";
  return ATTEMPT_ID_PATTERN.test(attemptId) ? attemptId : "";
}

/**
 * One id is minted when a run starts and persisted with that run. This makes
 * delivery retries stable without conflating later replays of the same puzzle.
 */
export function createAttemptId(cryptoSource = globalThis.crypto) {
  try {
    const uuid = cryptoSource?.randomUUID?.();
    if (normalizeAttemptId(uuid)) return uuid;
  } catch {
    // Fall through to a local nonce when Web Crypto is unavailable or blocked.
  }
  const time = Date.now().toString(36);
  const random = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36).padStart(11, "0");
  return `${time}-${random}`;
}

export function completionIdFor(puzzleId, attemptId) {
  const safeAttemptId = normalizeAttemptId(attemptId);
  if (!safeAttemptId) throw new TypeError("A stable attemptId is required for completion delivery.");
  const rawPuzzleId = String(puzzleId);
  const canonicalPuzzleId = rawPuzzleId.startsWith(`v${GENERATOR_VERSION}:`)
    ? rawPuzzleId
    : `v${GENERATOR_VERSION}:${rawPuzzleId}`;
  return `${GAME_ID}:${canonicalPuzzleId}:run:${safeAttemptId}`;
}

export function createCompletionPayload(details, now = new Date()) {
  const completedAtValue = now instanceof Date ? now : new Date(now);
  const completedAt = Number.isNaN(completedAtValue.getTime())
    ? new Date().toISOString()
    : completedAtValue.toISOString();
  const rawPuzzleId = String(details.puzzleId);
  const puzzleId = rawPuzzleId.startsWith(`v${GENERATOR_VERSION}:`)
    ? rawPuzzleId
    : `v${GENERATOR_VERSION}:${rawPuzzleId}`;
  const attemptId = normalizeAttemptId(details.attemptId);
  return Object.freeze({
    version: 1,
    gameId: GAME_ID,
    completionId: completionIdFor(puzzleId, attemptId),
    attemptId,
    levelId: puzzleId,
    puzzleId,
    mode: details.mode === "daily" ? "daily" : "seed",
    day: details.mode === "daily" ? String(details.day ?? "") : "",
    difficulty: String(details.presetId),
    tier: Number(details.tier),
    seed: Number(details.seed) >>> 0,
    generatorVersion: GENERATOR_VERSION,
    moves: Number(details.moves),
    moveLimit: Number(details.moveLimit),
    referenceMoves: Number(details.referenceMoves),
    par: Number(details.referenceMoves),
    efficient: details.efficient === true,
    wasteFree: details.wasteFree === true,
    maxCleanStreak: Number(details.maxCleanStreak) || 0,
    rewardClaims: Object.freeze((details.claims ?? []).map((claim) => Object.freeze({ ...claim }))),
    completedAt,
  });
}

/**
 * Host contract: prefer the v2 API, then the compatible RealmArcade API.
 * Without either, queue once for RealmArcade and emit the v2 DOM event.
 */
export function emitCompletion(payload, host = globalThis.window) {
  if (!host) return "unavailable";
  try {
    if (typeof host.TenRealmsV2?.complete === "function") {
      host.TenRealmsV2.complete(payload);
      return "v2-api";
    }
  } catch {
    // A broken host adapter must not prevent the compatible API or queue.
  }
  try {
    if (typeof host.RealmArcade?.complete === "function") {
      host.RealmArcade.complete(payload);
      return "realm-api";
    }
  } catch {
    // The durable in-page queue below is the final delivery fallback.
  }

  try {
    const existing = host[COMPLETION_QUEUE];
    const queue = existing == null ? [] : existing;
    if (!Array.isArray(queue)) return "unavailable";
    if (existing == null) host[COMPLETION_QUEUE] = queue;
    const alreadyQueued = queue.some((entry) => entry?.completionId === payload.completionId);
    if (!alreadyQueued) queue.push(payload);
    if (!alreadyQueued && typeof host.dispatchEvent === "function" && typeof host.CustomEvent === "function") {
      try {
        host.dispatchEvent(new host.CustomEvent(COMPLETE_EVENT, { detail: payload }));
      } catch {
        // Queue insertion is already a reliable handoff even if event dispatch fails.
      }
    }
    return "event";
  } catch {
    return "unavailable";
  }
}

/**
 * Drain persisted reports in insertion order. The caller owns persistence;
 * entries remain pending when no adapter or reliable in-page queue exists.
 */
export function flushCompletionReports(records, host = globalThis.window) {
  const delivered = [];
  if (
    !records
    || typeof records !== "object"
    || !records.pendingCompletions
    || typeof records.pendingCompletions !== "object"
    || !records.completionReports
    || typeof records.completionReports !== "object"
  ) return { delivered, blocked: false };

  let blocked = false;
  for (const [completionId, payload] of Object.entries(records.pendingCompletions)) {
    const delivery = emitCompletion(payload, host);
    if (delivery === "unavailable") {
      blocked = true;
      break;
    }
    delete records.pendingCompletions[completionId];
    records.completionReports[completionId] = payload.completedAt;
    delivered.push(completionId);
  }
  return { delivered, blocked };
}

export function exposeGameApi(api, host = globalThis.window) {
  if (!host || !api || typeof api !== "object") return false;
  try {
    const existing = host.TenRealmsV2Games;
    if (existing != null && (typeof existing !== "object" || Array.isArray(existing))) return false;
    const registry = existing ?? {};
    if (existing == null) host.TenRealmsV2Games = registry;
    registry[GAME_ID] = Object.freeze({ version: 1, gameId: GAME_ID, ...api });
    if (typeof host.dispatchEvent === "function" && typeof host.CustomEvent === "function") {
      try {
        host.dispatchEvent(new host.CustomEvent(READY_EVENT, { detail: registry[GAME_ID] }));
      } catch {
        // Registry exposure succeeded; the optional readiness event may fail.
      }
    }
    return true;
  } catch {
    return false;
  }
}
