import {
  DIFFICULTIES,
  applyMove,
  evaluatePosition,
  initialPosition,
  isStrictPosition,
  normalizePosition,
  positionToJSON,
} from "./logic.mjs";

export const SAVE_VERSION = 1;
export const HISTORY_LIMIT = 100;
export const REALM_ID = "neon-skyline";

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,95}$/i;
let fallbackRunCounter = 0;

export function isSkylineRunId(value) {
  return typeof value === "string" && RUN_ID_PATTERN.test(value);
}

export function createSkylineRunId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  try {
    const candidate = randomUUID?.();
    if (isSkylineRunId(candidate)) return candidate;
  } catch {
    // Fall through for restricted browser contexts.
  }
  fallbackRunCounter = (fallbackRunCounter + 1) % 0x100000;
  return `run-${Date.now().toString(36)}-${fallbackRunCounter.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function skylineCompletionEventId(runId) {
  if (!isSkylineRunId(runId)) throw new TypeError("A valid skyline run id is required.");
  return `${REALM_ID}:${runId}:complete`;
}

export const LANDMARKS = Object.freeze([
  Object.freeze({ id: "rainline-terminal", name: "雨线总站", requirement: "完成 1 个街区", clears: 1 }),
  Object.freeze({ id: "prism-exchange", name: "棱光换乘塔", requirement: "完成 3 个不同街区", clears: 3 }),
  Object.freeze({ id: "aurora-spire", name: "极光中枢", requirement: "完成 6 个不同街区", clears: 6 }),
  Object.freeze({ id: "midnight-crown", name: "零点王冠", requirement: "完成全部 9 个街区", clears: 9 }),
  Object.freeze({ id: "conflict-free", name: "无瑕规划局", requirement: "零冲突完成任意街区", special: "zero-conflict" }),
  Object.freeze({ id: "operations-record", name: "一笔成城台", requirement: "达到任意街区建议操作数", special: "efficient" }),
]);

export function emptyStats() {
  return {
    completedByLevel: {},
    bestMovesByLevel: {},
    zeroConflictByLevel: {},
    efficientByLevel: {},
  };
}

function cleanStats(candidate, levels) {
  const levelIds = new Set(levels.map((level) => level.id));
  const clean = emptyStats();
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return clean;
  for (const id of levelIds) {
    const completions = candidate.completedByLevel?.[id];
    const best = candidate.bestMovesByLevel?.[id];
    if (Number.isSafeInteger(completions) && completions > 0) clean.completedByLevel[id] = completions;
    if (Number.isSafeInteger(best) && best >= 0) clean.bestMovesByLevel[id] = best;
    if (candidate.zeroConflictByLevel?.[id] === true) clean.zeroConflictByLevel[id] = true;
    if (candidate.efficientByLevel?.[id] === true) clean.efficientByLevel[id] = true;
  }
  return clean;
}

function cleanPreferences(candidate = {}) {
  const value = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
  return {
    muted: Boolean(value.muted),
    flatView: Boolean(value.flatView),
    noteMode: Boolean(value.noteMode),
  };
}

export function createSession(level, options = {}) {
  const position = initialPosition(level);
  const completed = evaluatePosition(level, position).complete;
  const runId = isSkylineRunId(options.runId) ? options.runId : createSkylineRunId();
  const completionOutbox = normalizeSkylineOutbox(options.completionOutbox) ?? [];
  return {
    levelId: level.id,
    difficulty: level.difficulty,
    ...position,
    moves: 0,
    history: [],
    completed,
    runId,
    completionEventId: skylineCompletionEventId(runId),
    completionOutbox,
    completionRecorded: false,
    completionReported: false,
    hadConflict: false,
    preferences: cleanPreferences(options.preferences),
    stats: cleanStats(options.stats, options.levels ?? [level]),
  };
}

function snapshot(session) {
  return {
    ...positionToJSON(session),
    moves: session.moves,
    completed: session.completed,
    hadConflict: session.hadConflict,
  };
}

function cloneHistory(history) {
  return history.map((item) => ({
    values: [...item.values],
    notes: [...item.notes],
    clueDone: [...item.clueDone],
    moves: item.moves,
    completed: item.completed,
    hadConflict: item.hadConflict,
  }));
}

export function applySessionMove(level, session, move) {
  const result = applyMove(level, session, move);
  if (!result.accepted) return { accepted: false, reason: result.reason, session };
  const next = {
    ...session,
    values: result.values,
    notes: result.notes,
    clueDone: result.clueDone,
    moves: session.moves + 1,
    history: [...session.history, snapshot(session)].slice(-HISTORY_LIMIT),
    completed: false,
  };
  const evaluation = evaluatePosition(level, next);
  next.completed = evaluation.complete;
  next.hadConflict = session.hadConflict || evaluation.conflicts > 0;
  return { accepted: true, effect: result.effect, evaluation, session: next };
}

export function undoSession(level, session) {
  const previous = session.history.at(-1);
  if (!previous) return { accepted: false, reason: "empty-history", session };
  const normalized = normalizePosition(level, previous);
  const next = {
    ...session,
    ...normalized,
    moves: previous.moves,
    history: session.history.slice(0, -1),
    completed: evaluatePosition(level, normalized).complete,
    completionRecorded: session.completionRecorded,
    completionReported: session.completionReported,
    hadConflict: session.hadConflict,
  };
  return { accepted: true, session: next, evaluation: evaluatePosition(level, next) };
}

export function restartSession(level, session, options = {}) {
  const position = initialPosition(level);
  const completed = evaluatePosition(level, position).complete;
  const runId = isSkylineRunId(options.runId) ? options.runId : createSkylineRunId();
  const completionOutbox = normalizeSkylineOutbox(options.completionOutbox ?? session.completionOutbox) ?? [];
  return {
    ...session,
    levelId: level.id,
    difficulty: level.difficulty,
    ...position,
    moves: 0,
    history: [],
    completed,
    runId,
    completionEventId: skylineCompletionEventId(runId),
    completionOutbox,
    completionRecorded: false,
    completionReported: false,
    hadConflict: false,
  };
}

function expectedCompletionPayload(level, session) {
  if (!session?.completed || session.completionRecorded !== true) return null;
  return {
    eventId: session.completionEventId,
    levelId: level.id,
    tier: DIFFICULTIES.find((difficulty) => difficulty.id === level.difficulty)?.tier ?? 1,
    moves: session.moves,
    par: level.par,
  };
}

const EVENT_ID_PATTERN = /^neon-skyline:([a-z0-9][a-z0-9-]{7,95}):complete$/i;
const COMPLETION_PAYLOAD_KEYS = Object.freeze(["eventId", "levelId", "tier", "moves", "par"]);

function validCompletionPayload(candidate) {
  return candidate
    && typeof candidate === "object"
    && !Array.isArray(candidate)
    && Object.keys(candidate).length === COMPLETION_PAYLOAD_KEYS.length
    && typeof candidate.eventId === "string"
    && EVENT_ID_PATTERN.test(candidate.eventId)
    && typeof candidate.levelId === "string"
    && /^[a-z0-9:_-]{1,80}$/i.test(candidate.levelId)
    && Number.isSafeInteger(candidate.tier)
    && candidate.tier >= 1
    && candidate.tier <= 3
    && Number.isSafeInteger(candidate.moves)
    && candidate.moves >= 0
    && candidate.moves <= 10_000_000
    && Number.isSafeInteger(candidate.par)
    && candidate.par >= 0
    && candidate.par <= 10_000_000;
}

export function normalizeSkylineOutbox(candidate) {
  const source = candidate == null ? [] : Array.isArray(candidate) ? candidate : [candidate];
  if (source.some((payload) => !validCompletionPayload(payload))) return null;
  const seen = new Set();
  const clean = [];
  for (const payload of source) {
    if (seen.has(payload.eventId)) continue;
    seen.add(payload.eventId);
    clean.push({ ...payload });
  }
  return clean;
}

export function enqueueSkylineCompletion(queue, payload) {
  if (!Array.isArray(queue) || !validCompletionPayload(payload)) return false;
  if (queue.some((item) => item?.eventId === payload.eventId)) return false;
  queue.push({ ...payload });
  return true;
}

function appendCompletion(outbox, payload) {
  if (!payload || outbox.some((item) => item.eventId === payload.eventId)) return outbox;
  return [...outbox, payload];
}

export function stageCompletion(level, session) {
  if (!session) return session;
  let outbox = normalizeSkylineOutbox(session.completionOutbox) ?? [];
  if (session.completionReported === true) {
    outbox = outbox.filter((payload) => payload.eventId !== session.completionEventId);
  } else {
    outbox = appendCompletion(outbox, expectedCompletionPayload(level, session));
  }
  const unchanged = Array.isArray(session.completionOutbox)
    && JSON.stringify(session.completionOutbox) === JSON.stringify(outbox);
  return unchanged ? session : { ...session, completionOutbox: outbox };
}

export function recordCompletion(level, session) {
  if (!session.completed) return session;
  if (session.completionRecorded) return stageCompletion(level, session);
  const stats = {
    completedByLevel: { ...(session.stats?.completedByLevel ?? {}) },
    bestMovesByLevel: { ...(session.stats?.bestMovesByLevel ?? {}) },
    zeroConflictByLevel: { ...(session.stats?.zeroConflictByLevel ?? {}) },
    efficientByLevel: { ...(session.stats?.efficientByLevel ?? {}) },
  };
  const previousBest = stats.bestMovesByLevel[level.id];
  stats.completedByLevel[level.id] = (stats.completedByLevel[level.id] ?? 0) + 1;
  stats.bestMovesByLevel[level.id] = Number.isSafeInteger(previousBest)
    ? Math.min(previousBest, session.moves)
    : session.moves;
  if (!session.hadConflict) stats.zeroConflictByLevel[level.id] = true;
  if (session.moves <= level.par) stats.efficientByLevel[level.id] = true;
  return stageCompletion(level, { ...session, completionRecorded: true, stats });
}

export function confirmCompletionReport(session, reportCompletion) {
  if (!session || session.completionOutbox.length === 0 || typeof reportCompletion !== "function") {
    return {
      session,
      attempted: false,
      succeeded: session?.completionOutbox?.length === 0,
      reward: null,
      deliveredEventIds: [],
    };
  }
  const remaining = [...session.completionOutbox];
  const deliveredEventIds = [];
  let completionReported = session.completionReported;
  let reward = null;
  let failed = false;
  while (remaining.length > 0) {
    const payload = remaining[0];
    try {
      const result = reportCompletion(payload);
      if (result === false) {
        failed = true;
        break;
      }
      remaining.shift();
      deliveredEventIds.push(payload.eventId);
      if (payload.eventId === session.completionEventId) {
        completionReported = true;
        reward = result;
      }
    } catch {
      failed = true;
      break;
    }
  }
  return {
    session: { ...session, completionReported, completionOutbox: remaining },
    attempted: true,
    succeeded: !failed,
    reward,
    deliveredEventIds,
  };
}

export function mergeStats(stats, levels, incoming = {}) {
  const left = cleanStats(stats, levels);
  const right = cleanStats(incoming, levels);
  const merged = emptyStats();
  for (const level of levels) {
    const id = level.id;
    const completions = Math.max(left.completedByLevel[id] ?? 0, right.completedByLevel[id] ?? 0);
    const bests = [left.bestMovesByLevel[id], right.bestMovesByLevel[id]].filter(Number.isSafeInteger);
    if (completions > 0) merged.completedByLevel[id] = completions;
    if (bests.length) merged.bestMovesByLevel[id] = Math.min(...bests);
    if (left.zeroConflictByLevel[id] || right.zeroConflictByLevel[id]) merged.zeroConflictByLevel[id] = true;
    if (left.efficientByLevel[id] || right.efficientByLevel[id]) merged.efficientByLevel[id] = true;
  }
  return merged;
}

export function cityProgress(stats, levels) {
  const clean = cleanStats(stats, levels);
  const completedIds = levels.filter((level) => clean.completedByLevel[level.id]).map((level) => level.id);
  const zeroConflict = Object.keys(clean.zeroConflictByLevel).length > 0;
  const efficient = Object.keys(clean.efficientByLevel).length > 0;
  const landmarks = LANDMARKS.map((landmark) => ({
    ...landmark,
    unlocked: landmark.special === "zero-conflict"
      ? zeroConflict
      : landmark.special === "efficient"
        ? efficient
        : completedIds.length >= landmark.clears,
  }));
  return {
    completedIds,
    completed: completedIds.length,
    total: levels.length,
    zeroConflict,
    efficient,
    landmarks,
    bestMovesByLevel: { ...clean.bestMovesByLevel },
  };
}

function strictSnapshot(level, candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  if (!isStrictPosition(level, candidate)) return null;
  if (!Number.isSafeInteger(candidate.moves) || candidate.moves < 0 || candidate.moves > 10_000_000) return null;
  if (typeof candidate.completed !== "boolean" || typeof candidate.hadConflict !== "boolean") return null;
  const position = normalizePosition(level, candidate);
  if (evaluatePosition(level, position).complete !== candidate.completed) return null;
  return { ...positionToJSON(position), moves: candidate.moves, completed: candidate.completed, hadConflict: candidate.hadConflict };
}

function samePosition(left, right) {
  return JSON.stringify(positionToJSON(left)) === JSON.stringify(positionToJSON(right));
}

function isReachableByOneMove(level, before, after, { allowInheritedConflict = false } = {}) {
  if (after.moves !== before.moves + 1) return false;
  const moves = [{ type: "fill-notes" }];
  for (const [side, clues] of Object.entries(level.clues)) {
    clues.forEach((clue, index) => {
      if (clue !== null) moves.push({ type: "toggle-clue", side, index });
    });
  }
  for (let row = 0; row < level.size; row += 1) {
    for (let column = 0; column < level.size; column += 1) {
      for (let value = 0; value <= level.size; value += 1) {
        moves.push({ type: "set-value", row, column, value });
      }
      for (let value = 1; value <= level.size; value += 1) {
        moves.push({ type: "toggle-note", row, column, value });
      }
    }
  }
  return moves.some((move) => {
    const result = applyMove(level, before, move);
    if (!result.accepted || !samePosition(result, after)) return false;
    const evaluation = evaluatePosition(level, result);
    if (after.completed !== evaluation.complete) return false;
    const expectedConflict = before.hadConflict || evaluation.conflicts > 0;
    return after.hadConflict === expectedConflict
      || (allowInheritedConflict && after.hadConflict === true && expectedConflict === false);
  });
}

function validHistoryTimeline(level, history, active) {
  const timeline = [...history, active];
  return timeline.every((snapshot, index) => (
    index === 0 || isReachableByOneMove(level, timeline[index - 1], snapshot, {
      allowInheritedConflict: index === timeline.length - 1,
    })
  ));
}

export function serializeSave(session) {
  return {
    version: SAVE_VERSION,
    active: {
      levelId: session.levelId,
      difficulty: session.difficulty,
      ...snapshot(session),
      runId: session.runId,
      completionEventId: session.completionEventId,
      completionOutbox: session.completionOutbox.map((payload) => ({ ...payload })),
      completionRecorded: Boolean(session.completionRecorded),
      completionReported: Boolean(session.completionReported),
      history: cloneHistory(session.history),
    },
    preferences: cleanPreferences(session.preferences),
    stats: session.stats,
    updatedAt: new Date().toISOString(),
  };
}

export function restoreSave(levels, candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.version !== SAVE_VERSION) return null;
  const active = candidate.active;
  if (!active || typeof active !== "object") return null;
  const level = levels.find((item) => item.id === active.levelId);
  if (!level || active.difficulty !== level.difficulty) return null;
  const restored = strictSnapshot(level, active);
  if (
    !restored
    || typeof active.completionRecorded !== "boolean"
    || typeof active.completionReported !== "boolean"
  ) return null;
  const hasRunMetadata = ["runId", "completionEventId", "completionOutbox"]
    .some((key) => Object.hasOwn(active, key));
  let runId;
  let completionEventId;
  if (hasRunMetadata) {
    if (!["runId", "completionEventId", "completionOutbox"].every((key) => Object.hasOwn(active, key))) return null;
    if (!isSkylineRunId(active.runId)) return null;
    runId = active.runId;
    completionEventId = skylineCompletionEventId(runId);
    if (active.completionEventId !== completionEventId) return null;
  } else {
    // Preserve V1 saves by assigning the restored attempt an opaque id once.
    runId = createSkylineRunId();
    completionEventId = skylineCompletionEventId(runId);
  }
  if (!Array.isArray(active.history) || active.history.length > HISTORY_LIMIT) return null;
  const history = active.history.map((item) => strictSnapshot(level, item));
  if (history.some((item) => item === null)) return null;
  if (history.length > restored.moves) return null;
  if (history.some((item, index) => index > 0 && item.moves !== history[index - 1].moves + 1)) return null;
  if (history.length > 0 && history[0].moves !== restored.moves - history.length) return null;
  if (history.length > 0 && history.at(-1).moves !== restored.moves - 1) return null;
  if (!validHistoryTimeline(level, history, restored)) return null;
  let session = {
    levelId: level.id,
    difficulty: level.difficulty,
    ...normalizePosition(level, restored),
    moves: restored.moves,
    history,
    completed: restored.completed,
    runId,
    completionEventId,
    completionOutbox: [],
    completionRecorded: active.completionRecorded || active.completionReported,
    completionReported: active.completionReported,
    hadConflict: restored.hadConflict,
    preferences: cleanPreferences(candidate.preferences),
    stats: cleanStats(candidate.stats, levels),
  };
  if (hasRunMetadata) {
    const outbox = normalizeSkylineOutbox(active.completionOutbox);
    if (!outbox) return null;
    session.completionOutbox = outbox;
  }
  session = stageCompletion(level, session);
  return {
    level,
    session,
  };
}
