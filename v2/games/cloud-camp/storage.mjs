import { evaluatePosition, normalizePosition, positionToJSON } from "./logic.mjs";
import { DIFFICULTIES, LEVELS, difficultyFor, findLevel } from "./levels.mjs";

export const STORAGE_VERSION = 1;
export const HISTORY_LIMIT = 90;
export const CAMP_GAME_ID = "cloud-camp";

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{7,95}$/i;

function validRunId(value) {
  return typeof value === "string"
    && RUN_ID_PATTERN.test(value)
    && !["__proto__", "prototype", "constructor"].includes(value);
}

export function createCampRunId(uuidFactory) {
  let candidate = "";
  try {
    candidate = typeof uuidFactory === "function"
      ? uuidFactory()
      : globalThis.crypto?.randomUUID?.();
  } catch {
    // A UUID source is an enhancement; the fallback still creates a fresh run identity.
  }
  if (validRunId(candidate)) return candidate;
  const random = Math.random().toString(36).slice(2, 14).padEnd(12, "0");
  return `run-${Date.now().toString(36)}-${random}`;
}

export function campCompletionEventId(runId) {
  if (!validRunId(runId)) throw new TypeError("Invalid cloud-camp run id.");
  return `${CAMP_GAME_ID}:${runId}:complete`;
}

export function campCompletionPayload(state) {
  const difficulty = difficultyFor(state?.difficulty);
  if (!state?.level || !difficulty || state.level.difficulty !== difficulty.id) return null;
  const runId = validRunId(state.runId) ? state.runId : null;
  if (!runId) return null;
  return {
    runId,
    eventId: campCompletionEventId(runId),
    levelId: `${difficulty.id}:${state.level.id}`,
    tier: difficulty.tier,
    moves: safeInteger(state.moves),
    par: state.level.par,
  };
}

function normalizeCampCompletionPayload(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const match = typeof candidate.eventId === "string"
    ? candidate.eventId.match(/^cloud-camp:([a-z0-9][a-z0-9._-]{7,95}):complete$/i)
    : null;
  if (
    !match
    || !validRunId(match[1])
    || (candidate.runId !== undefined && candidate.runId !== match[1])
  ) return null;
  const level = LEVELS.find((item) => `${item.difficulty}:${item.id}` === candidate.levelId);
  const difficulty = level ? difficultyFor(level.difficulty) : null;
  if (
    !level
    || !difficulty
    || candidate.tier !== difficulty.tier
    || candidate.par !== level.par
    || !Number.isInteger(candidate.moves)
    || candidate.moves < 0
    || candidate.moves > 1_000_000
  ) return null;
  return {
    runId: match[1],
    eventId: campCompletionEventId(match[1]),
    levelId: `${level.difficulty}:${level.id}`,
    tier: difficulty.tier,
    moves: candidate.moves,
    par: level.par,
  };
}

export function normalizeCampCompletionOutbox(candidate) {
  if (!Array.isArray(candidate)) return [];
  const seen = new Set();
  const clean = [];
  for (const entry of candidate) {
    const payload = normalizeCampCompletionPayload(entry);
    if (!payload || seen.has(payload.eventId)) continue;
    seen.add(payload.eventId);
    clean.push(payload);
  }
  // Every valid unacknowledged completion is durable. A fixed-size tail here
  // would silently discard the oldest event when the host stays unavailable.
  return clean;
}

export const DECORATIONS = Object.freeze([
  Object.freeze({ id: "cloud-pennant", name: "云帆旗", clears: 1, symbol: "◒" }),
  Object.freeze({ id: "starlight-string", name: "星灯串", clears: 3, symbol: "✶" }),
  Object.freeze({ id: "moon-chair", name: "月桂椅", clears: 6, symbol: "◖" }),
  Object.freeze({ id: "aurora-chime", name: "极光风铃", clears: 9, symbol: "✦" }),
]);

export const VISITORS = Object.freeze([
  Object.freeze({ id: "cloud-hare", name: "云兔", requirement: "cloudlet", symbol: "🐇" }),
  Object.freeze({ id: "ridge-fox", name: "岭狐", requirement: "ridgewind", symbol: "🦊" }),
  Object.freeze({ id: "star-owl", name: "星鸮", requirement: "aurora", symbol: "🦉" }),
  Object.freeze({ id: "marmot", name: "旱獭", streak: 3, symbol: "🦦" }),
]);

function safeInteger(value, fallback = 0, maximum = 1_000_000) {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, maximum) : fallback;
}

function safeText(value, maximum = 40) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function safeDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function serialDay(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function localDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return localDayKey(new Date());
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function createCampStats() {
  return {
    clears: {},
    streak: { lastDay: "", count: 0, best: 0 },
  };
}

export function normalizeCampStats(candidate) {
  const clean = createCampStats();
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return clean;
  const allowedIds = new Set(LEVELS.map(({ id }) => id));
  if (candidate.clears && typeof candidate.clears === "object" && !Array.isArray(candidate.clears)) {
    for (const [levelId, record] of Object.entries(candidate.clears)) {
      if (!allowedIds.has(levelId) || !record || typeof record !== "object" || Array.isArray(record)) continue;
      const bestMoves = Number.isInteger(record.bestMoves) && record.bestMoves >= 0
        ? Math.min(record.bestMoves, 1_000_000)
        : null;
      clean.clears[levelId] = {
        wins: Math.max(1, safeInteger(record.wins, 1)),
        bestMoves,
        flawless: record.flawless === true,
        efficient: record.efficient === true,
        firstAt: safeText(record.firstAt, 32),
        lastAt: safeText(record.lastAt, 32),
      };
    }
  }
  clean.streak.lastDay = safeDay(candidate.streak?.lastDay);
  clean.streak.count = safeInteger(candidate.streak?.count);
  clean.streak.best = Math.max(clean.streak.count, safeInteger(candidate.streak?.best));
  return clean;
}

function cloneStats(stats) {
  return normalizeCampStats(JSON.parse(JSON.stringify(stats)));
}

export function recordCampCompletion(stats, completion, now = new Date()) {
  const next = cloneStats(stats);
  const level = findLevel(completion?.levelId);
  if (!level) return { stats: next, firstClear: false, personalBest: false };
  const moves = safeInteger(completion.moves);
  const mistakes = safeInteger(completion.mistakes);
  const previous = next.clears[level.id] ?? null;
  const firstClear = previous === null;
  const personalBest = !firstClear && (previous.bestMoves === null || moves < previous.bestMoves);
  const timestamp = (now instanceof Date ? now : new Date(now)).toISOString();
  next.clears[level.id] = {
    wins: (previous?.wins ?? 0) + 1,
    bestMoves: previous?.bestMoves === null || previous?.bestMoves === undefined
      ? moves
      : Math.min(previous.bestMoves, moves),
    flawless: previous?.flawless === true || mistakes === 0,
    efficient: previous?.efficient === true || moves <= level.par,
    firstAt: previous?.firstAt || timestamp,
    lastAt: timestamp,
  };

  const today = localDayKey(now);
  if (today !== next.streak.lastDay) {
    const consecutive = next.streak.lastDay && serialDay(today) - serialDay(next.streak.lastDay) === 1;
    next.streak.count = consecutive ? next.streak.count + 1 : 1;
    next.streak.lastDay = today;
    next.streak.best = Math.max(next.streak.best, next.streak.count);
  }
  return { stats: next, firstClear, personalBest };
}

export function recordCampCompletionOnce(state, now = new Date()) {
  if (!state?.completed) return { state, recorded: false, outcome: null };
  const runId = validRunId(state.runId) ? state.runId : createCampRunId();
  const completionEventId = campCompletionEventId(runId);
  let next = {
    ...state,
    runId,
    completionEventId,
    completionOutbox: normalizeCampCompletionOutbox(state.completionOutbox),
  };
  let outcome = null;
  let recorded = false;
  if (next.completionRecorded !== true) {
    outcome = recordCampCompletion(next.stats, {
      levelId: next.level.id,
      moves: next.moves,
      mistakes: next.mistakes,
    }, now);
    next = { ...next, stats: outcome.stats, completionRecorded: true };
    recorded = true;
  }
  if (next.completionReported !== true) {
    const payload = campCompletionPayload(next);
    if (payload && !next.completionOutbox.some(({ eventId }) => eventId === payload.eventId)) {
      next.completionOutbox = [...next.completionOutbox, payload];
    }
  }
  return {
    state: next,
    recorded,
    outcome,
  };
}

export function confirmCampCompletion(state, reportCompletion) {
  const pending = normalizeCampCompletionOutbox(state?.completionOutbox);
  if (!pending.length || typeof reportCompletion !== "function") {
    return {
      state: { ...state, completionOutbox: pending },
      attempted: false,
      succeeded: pending.length === 0,
      reward: null,
      rewards: [],
    };
  }
  const rewards = [];
  let completionReported = state.completionReported === true;
  while (pending.length) {
    const payload = pending[0];
    try {
      rewards.push(reportCompletion(payload));
      pending.shift();
      if (payload.eventId === state.completionEventId) completionReported = true;
    } catch {
      return {
        state: { ...state, completionReported, completionOutbox: pending },
        attempted: true,
        succeeded: false,
        reward: rewards.at(-1) ?? null,
        rewards,
      };
    }
  }
  return {
    state: { ...state, completionReported, completionOutbox: pending },
    attempted: true,
    succeeded: true,
    reward: rewards.at(-1) ?? null,
    rewards,
  };
}

export function campSummary(stats) {
  const clean = normalizeCampStats(stats);
  const records = Object.entries(clean.clears);
  const clearedIds = new Set(records.map(([levelId]) => levelId));
  const difficultyClears = new Set(
    LEVELS.filter(({ id }) => clearedIds.has(id)).map(({ difficulty }) => difficulty),
  );
  const decorations = DECORATIONS.filter(({ clears }) => records.length >= clears);
  const visitors = VISITORS.filter((visitor) => (
    visitor.requirement ? difficultyClears.has(visitor.requirement) : clean.streak.best >= visitor.streak
  ));
  return {
    uniqueClears: records.length,
    totalWins: records.reduce((sum, [, record]) => sum + record.wins, 0),
    flawlessClears: records.filter(([, record]) => record.flawless).length,
    efficientClears: records.filter(([, record]) => record.efficient).length,
    streak: clean.streak.count,
    bestStreak: clean.streak.best,
    decorations,
    visitors,
  };
}

export function snapshotFromState(state) {
  return {
    ...positionToJSON(state),
    moves: safeInteger(state.moves),
    mistakes: safeInteger(state.mistakes),
  };
}

function validKeyArray(level, value, field) {
  if (!Array.isArray(value) || value.some((key) => typeof key !== "string")) return false;
  if (new Set(value).size !== value.length) return false;
  const normalized = normalizePosition(level, { [field]: value })[field];
  return normalized.size === value.length;
}

export function parseSnapshot(level, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!validKeyArray(level, value.tents, "tents") || !validKeyArray(level, value.grass, "grass")) return null;
  if (!Number.isInteger(value.moves) || value.moves < 0 || value.moves > 1_000_000) return null;
  if (!Number.isInteger(value.mistakes) || value.mistakes < 0 || value.mistakes > value.moves) return null;
  if (new Set([...value.tents, ...value.grass]).size !== value.tents.length + value.grass.length) return null;
  const normalized = normalizePosition(level, value);
  if (normalized.tents.size + normalized.grass.size !== new Set([...value.tents, ...value.grass]).size) return null;
  return {
    tents: normalized.tents,
    grass: normalized.grass,
    moves: value.moves,
    mistakes: value.mistakes,
  };
}

function validHistoryTimeline(history, active) {
  const timeline = [...history, active];
  for (let index = 0; index < timeline.length - 1; index += 1) {
    const before = timeline[index];
    const after = timeline[index + 1];
    if (after.moves !== before.moves + 1) return false;
    if (after.mistakes < before.mistakes || after.mistakes > before.mistakes + 1) return false;
    const occupied = new Set([...before.tents, ...before.grass, ...after.tents, ...after.grass]);
    let changes = 0;
    for (const key of occupied) {
      const beforeState = before.tents.has(key) ? "tent" : before.grass.has(key) ? "grass" : "unknown";
      const afterState = after.tents.has(key) ? "tent" : after.grass.has(key) ? "grass" : "unknown";
      if (beforeState !== afterState) changes += 1;
    }
    if (changes !== 1) return false;
  }
  return true;
}

export function createDefaultState(level = LEVELS[0], runId = createCampRunId()) {
  const safeRunId = validRunId(runId) ? runId : createCampRunId();
  return {
    level,
    difficulty: level.difficulty,
    tents: new Set(),
    grass: new Set(),
    moves: 0,
    mistakes: 0,
    history: [],
    completed: false,
    completionRecorded: false,
    completionReported: false,
    runId: safeRunId,
    completionEventId: campCompletionEventId(safeRunId),
    completionOutbox: [],
    muted: false,
    tool: "tent",
    stats: createCampStats(),
  };
}

export function parseStoredGame(input) {
  const fallback = createDefaultState();
  try {
    const saved = typeof input === "string" ? JSON.parse(input) : input;
    if (!saved || saved.version !== STORAGE_VERSION || !saved.active) throw new Error("Unsupported save");
    const level = findLevel(saved.active.levelId);
    if (!level || saved.active.difficulty !== level.difficulty) throw new Error("Unknown level");
    const active = parseSnapshot(level, saved.active);
    if (!active) throw new Error("Invalid active position");
    if (!Array.isArray(saved.active.history) || saved.active.history.length > HISTORY_LIMIT) {
      throw new Error("Invalid history length");
    }
    const historyInput = saved.active.history;
    const history = historyInput.map((snapshot) => parseSnapshot(level, snapshot));
    if (history.some((snapshot) => snapshot === null) || !validHistoryTimeline(history, active)) {
      throw new Error("Invalid history");
    }
    const completed = evaluatePosition(level, active).complete;
    if (
      (saved.active.completionRecorded !== undefined && typeof saved.active.completionRecorded !== "boolean")
      || (saved.active.completionReported !== undefined && typeof saved.active.completionReported !== "boolean")
    ) {
      throw new Error("Invalid completion markers");
    }
    const runId = validRunId(saved.active.runId) ? saved.active.runId : createCampRunId();
    const completionEventId = campCompletionEventId(runId);
    const completionReported = saved.active.completionReported === true;
    const completionRecorded = saved.active.completionRecorded === true || completionReported;
    let completionOutbox = normalizeCampCompletionOutbox(saved.completionOutbox ?? saved.active.completionOutbox);
    if (completionReported) {
      completionOutbox = completionOutbox.filter(({ eventId }) => eventId !== completionEventId);
    } else if (completed && completionRecorded && !completionOutbox.some(({ eventId }) => eventId === completionEventId)) {
      const payload = campCompletionPayload({
        level,
        difficulty: level.difficulty,
        ...active,
        runId,
      });
      if (payload) completionOutbox = [...completionOutbox, payload];
    }
    return {
      restored: true,
      invalid: false,
      state: {
        level,
        difficulty: level.difficulty,
        ...active,
        history,
        completed,
        completionRecorded,
        completionReported,
        runId,
        completionEventId,
        completionOutbox,
        muted: saved.preferences?.muted === true,
        tool: saved.preferences?.tool === "grass" ? "grass" : "tent",
        stats: normalizeCampStats(saved.stats),
      },
    };
  } catch {
    return { restored: false, invalid: input !== null && input !== undefined && input !== "", state: fallback };
  }
}

export function serializeStoredGame(state) {
  const runId = validRunId(state.runId) ? state.runId : createCampRunId();
  return {
    version: STORAGE_VERSION,
    preferences: { muted: state.muted === true, tool: state.tool === "grass" ? "grass" : "tent" },
    active: {
      levelId: state.level.id,
      difficulty: state.level.difficulty,
      ...snapshotFromState(state),
      completed: state.completed === true,
      completionRecorded: state.completionRecorded === true,
      completionReported: state.completionReported === true,
      runId,
      completionEventId: campCompletionEventId(runId),
      history: state.history.slice(-HISTORY_LIMIT).map(snapshotFromState),
      updatedAt: new Date().toISOString(),
    },
    completionOutbox: normalizeCampCompletionOutbox(state.completionOutbox),
    stats: normalizeCampStats(state.stats),
  };
}

export function difficultyProgress(stats) {
  const clean = normalizeCampStats(stats);
  const cleared = new Set(Object.keys(clean.clears));
  return Object.fromEntries(DIFFICULTIES.map(({ id }) => [
    id,
    LEVELS.filter((level) => level.difficulty === id && cleared.has(level.id)).length,
  ]));
}
