import {
  applyMove,
  evaluatePosition,
  initialPosition,
  isStrictPosition,
  normalizePosition,
  positionToJSON,
} from "./logic.mjs";

export const SAVE_VERSION = 1;
export const HISTORY_LIMIT = 100;

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
  return {
    levelId: level.id,
    difficulty: level.difficulty,
    ...position,
    moves: 0,
    history: [],
    completed,
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

export function restartSession(level, session) {
  const position = initialPosition(level);
  const completed = evaluatePosition(level, position).complete;
  return {
    ...session,
    levelId: level.id,
    difficulty: level.difficulty,
    ...position,
    moves: 0,
    history: [],
    completed,
    completionRecorded: false,
    completionReported: false,
    hadConflict: false,
  };
}

export function recordCompletion(level, session) {
  if (!session.completed || session.completionRecorded) return session;
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
  return { ...session, completionRecorded: true, stats };
}

export function confirmCompletionReport(session, reportCompletion) {
  if (
    !session?.completed
    || session.completionRecorded !== true
    || session.completionReported === true
    || typeof reportCompletion !== "function"
  ) {
    return { session, attempted: false, succeeded: session?.completionReported === true, reward: null };
  }
  try {
    const reward = reportCompletion();
    return {
      session: { ...session, completionReported: true },
      attempted: true,
      succeeded: true,
      reward,
    };
  } catch {
    return {
      session: { ...session, completionReported: false },
      attempted: true,
      succeeded: false,
      reward: null,
    };
  }
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
  if (!Array.isArray(active.history) || active.history.length > HISTORY_LIMIT) return null;
  const history = active.history.map((item) => strictSnapshot(level, item));
  if (history.some((item) => item === null)) return null;
  if (history.length > restored.moves) return null;
  if (history.some((item, index) => index > 0 && item.moves !== history[index - 1].moves + 1)) return null;
  if (history.length > 0 && history[0].moves !== restored.moves - history.length) return null;
  if (history.length > 0 && history.at(-1).moves !== restored.moves - 1) return null;
  if (!validHistoryTimeline(level, history, restored)) return null;
  return {
    level,
    session: {
      levelId: level.id,
      difficulty: level.difficulty,
      ...normalizePosition(level, restored),
      moves: restored.moves,
      history,
      completed: restored.completed,
      completionRecorded: active.completionRecorded || active.completionReported,
      completionReported: active.completionReported,
      hadConflict: restored.hadConflict,
      preferences: cleanPreferences(candidate.preferences),
      stats: cleanStats(candidate.stats, levels),
    },
  };
}
