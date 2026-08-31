export const GAME_ID = "dream-hotel";
export const COMPLETION_EVENT = "ten-realms-v2:game-complete";
export const COMPLETION_SCHEMA = "ten-realms-v2/game-completion@1";
export const COMPLETION_QUEUE = "__realmCompletionQueue";
const publishedByTarget = new WeakMap();
const TIER_BY_DIFFICULTY = Object.freeze({ easy: 1, medium: 2, hard: 3 });
const RETAINED_TRANSPORTS = new Set(["native-v2", "realm-arcade", "queue"]);

function validRunId(value) {
  return typeof value === "string"
    && !["__proto__", "prototype", "constructor"].includes(value)
    && /^(?=[a-z0-9-]{8,160}$)(?=.*[a-z0-9])[a-z0-9-]+$/i.test(value);
}

function validText(value, maximum = 160) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function validTextList(value, maximumItems = 256) {
  return Array.isArray(value)
    && value.length <= maximumItems
    && value.every((item) => validText(item));
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validCompletionDetail(detail) {
  try {
    const tier = TIER_BY_DIFFICULTY[detail?.difficulty];
    return detail?.schema === COMPLETION_SCHEMA
      && detail.schemaVersion === 1
      && detail.gameId === GAME_ID
      && validRunId(detail.runId)
      && validText(detail.levelId)
      && validText(detail.puzzleSeed)
      && tier !== undefined
      && detail.tier === tier
      && validCount(detail.moves)
      && validCount(detail.par)
      && detail.par > 0
      && validCount(detail.elapsedMs)
      && Number.isInteger(detail.rating)
      && detail.rating >= 1
      && detail.rating <= 3
      && typeof detail.oneStroke === "boolean"
      && typeof detail.noRework === "boolean"
      && validTextList(detail.roomTypes)
      && validTextList(detail.rewardIds)
      && typeof detail.completedAt === "string"
      && detail.completedAt.length <= 40
      && Number.isFinite(Date.parse(detail.completedAt))
      && detail.eventId === `${GAME_ID}:${detail.runId}:complete`;
  } catch {
    return false;
  }
}

export function createCompletionDetail({ level, runId, summary, elapsedMs, rewardIds, completedAt }) {
  const tier = TIER_BY_DIFFICULTY[level?.difficulty];
  const validLevel = validText(level?.id)
    && validText(level?.seed)
    && Array.isArray(level?.clues)
    && level.clues.length > 0
    && validCount(level.clues.length)
    && tier !== undefined;
  const validSummary = validCount(summary?.moves)
    && Number.isInteger(summary?.rating)
    && summary.rating >= 1
    && summary.rating <= 3
    && typeof summary.oneStroke === "boolean"
    && typeof summary.noRework === "boolean"
    && validTextList(summary.roomTypes);
  const validDuration = validCount(elapsedMs);
  const validRewards = validTextList(rewardIds);
  const parsedTimestamp = completedAt === undefined
    ? new Date()
    : typeof completedAt === "string" && completedAt.length <= 40
      ? new Date(completedAt)
      : null;
  if (!validLevel
      || !validRunId(runId)
      || !validSummary
      || !validDuration
      || !validRewards
      || !parsedTimestamp
      || !Number.isFinite(parsedTimestamp.getTime())) {
    throw new TypeError("Completion detail requires level, run ID, summary, and reward IDs");
  }
  const timestamp = parsedTimestamp.toISOString();
  const dedupedRewards = [...new Set(rewardIds)].sort();
  return Object.freeze({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    runId,
    levelId: level.id,
    difficulty: level.difficulty,
    tier,
    puzzleSeed: level.seed,
    moves: summary.moves,
    par: level.clues.length,
    elapsedMs,
    rating: summary.rating,
    oneStroke: summary.oneStroke,
    noRework: summary.noRework,
    roomTypes: Object.freeze([...summary.roomTypes]),
    rewardIds: Object.freeze(dedupedRewards),
    completedAt: timestamp,
    eventId: `${GAME_ID}:${runId}:complete`,
  });
}

/**
 * Publish once per run to the first available shared API, falling back to the
 * bounded queue if that API throws. The CustomEvent is an observation mirror,
 * not a second completion transport; reward consumers must use the API/queue.
 * Returns true when the event is retained now or was retained earlier.
 */
export function publishCompletion(target, detail) {
  if ((typeof target !== "object" && typeof target !== "function")
      || !target
      || !validCompletionDetail(detail)) return false;

  const priorEvents = publishedByTarget.get(target);
  const priorStatus = priorEvents?.get(detail.eventId);
  if (RETAINED_TRANSPORTS.has(priorStatus)) return true;
  if (priorStatus === "in-flight") return false;
  try {
    const pending = Array.isArray(target[COMPLETION_QUEUE]) ? target[COMPLETION_QUEUE] : [];
    const retainedDetail = pending.find((item) => (
      item?.eventId === detail.eventId && validCompletionDetail(item)
    ));
    if (retainedDetail) {
      const otherItems = pending.filter((item) => item?.eventId !== detail.eventId);
      try { target[COMPLETION_QUEUE] = [...otherItems.slice(-99), retainedDetail]; } catch { /* already retained */ }
      const knownEvents = priorEvents ?? new Map();
      knownEvents.set(detail.eventId, "queue");
      publishedByTarget.set(target, knownEvents);
      return true;
    }
  } catch {
    // A hostile queue getter should not prevent an available API from working.
  }

  const eventStates = priorEvents ?? new Map();
  eventStates.set(detail.eventId, "in-flight");
  publishedByTarget.set(target, eventStates);

  let retained = false;
  let transport = null;
  const queue = () => {
    try {
      const pending = Array.isArray(target[COMPLETION_QUEUE]) ? target[COMPLETION_QUEUE] : [];
      if (pending.some((item) => item?.eventId === detail.eventId && validCompletionDetail(item))) return true;
      const withoutInvalidDuplicate = pending.filter((item) => item?.eventId !== detail.eventId);
      target[COMPLETION_QUEUE] = [...withoutInvalidDuplicate, detail].slice(-100);
      return true;
    } catch {
      return false;
    }
  };

  try {
    if (typeof target.TenRealmsV2?.complete === "function") {
      target.TenRealmsV2.complete(detail);
      retained = true;
      transport = "native-v2";
    } else if (typeof target.RealmArcade?.complete === "function") {
      target.RealmArcade.complete(detail);
      retained = true;
      transport = "realm-arcade";
    } else {
      retained = queue();
      if (retained) transport = "queue";
    }
  } catch {
    retained = queue();
    if (retained) transport = "queue";
  }

  if (!retained) {
    eventStates.delete(detail.eventId);
    if (eventStates.size === 0) publishedByTarget.delete(target);
    return false;
  }
  eventStates.set(detail.eventId, transport);

  try {
    const EventClass = target.CustomEvent ?? globalThis.CustomEvent;
    if (typeof EventClass === "function" && typeof target.dispatchEvent === "function") {
      target.dispatchEvent(new EventClass(COMPLETION_EVENT, { detail }));
    }
  } catch {
    // Canonical delivery already succeeded; observation must not affect it.
  }
  return true;
}

/** Return the canonical transport that retained an event in this page. */
export function getCompletionTransport(target, eventId) {
  if ((typeof target !== "object" && typeof target !== "function") || !target || typeof eventId !== "string") {
    return null;
  }
  const status = publishedByTarget.get(target)?.get(eventId);
  return RETAINED_TRANSPORTS.has(status) ? status : null;
}

/** Expose a small, namespaced game API for the later v2 shell. */
export function installGameApi(target, handlers) {
  if (!target || !handlers) return null;
  const api = Object.freeze({
    apiVersion: 1,
    gameId: GAME_ID,
    getSnapshot: () => handlers.getSnapshot?.() ?? null,
    getRecords: () => handlers.getRecords?.() ?? null,
    openTutorial: () => handlers.openTutorial?.(),
    setDifficulty: (difficulty) => handlers.setDifficulty?.(difficulty),
    newPuzzle: () => handlers.newPuzzle?.(),
  });
  try {
    const registry = target.TenRealmsV2Games && typeof target.TenRealmsV2Games === "object"
      ? target.TenRealmsV2Games
      : {};
    registry[GAME_ID] = api;
    target.TenRealmsV2Games = registry;
  } catch {
    return api;
  }
  return api;
}
