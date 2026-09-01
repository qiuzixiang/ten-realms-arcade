import {
  ARCHIVE_RECIPE_COUNT,
  DIFFICULTIES,
  bottleIdentity,
  recipeFromDescriptor,
  remainingRating,
  replayGame,
  serializeGame,
  suggestGuess,
  submitGuess,
} from "./logic.mjs";

export const SAVE_VERSION = 1;
export const HISTORY_LIMIT = 80;
export const STATS_ENTRY_LIMIT = 240;
export const REVEALED_RECIPE_LIMIT = 512;
export const REALM_ID = "mystic-perfumery";

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,95}$/i;
let fallbackRunCounter = 0;

export function isPerfumeryRunId(value) {
  return typeof value === "string" && RUN_ID_PATTERN.test(value);
}

export function createPerfumeryRunId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  try {
    const candidate = randomUUID?.();
    if (isPerfumeryRunId(candidate)) return candidate;
  } catch {
    // A browser can expose crypto while denying randomUUID in a restricted frame.
  }
  fallbackRunCounter = (fallbackRunCounter + 1) % 0x100000;
  return `run-${Date.now().toString(36)}-${fallbackRunCounter.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function perfumeryCompletionEventId(runId) {
  if (!isPerfumeryRunId(runId)) throw new TypeError("A valid perfumery run id is required.");
  return `${REALM_ID}:${runId}:complete`;
}

const ARCHIVE_RECIPE_IDS = new Set(DIFFICULTIES.flatMap(({ id }) => (
  Array.from({ length: ARCHIVE_RECIPE_COUNT }, (_, index) => `${id}:folio-${index + 1}`)
)));

const safeKey = (value) => typeof value === "string"
  && /^[a-z0-9:_-]{1,80}$/i.test(value)
  && !["__proto__", "prototype", "constructor"].includes(value);

const cleanCount = (value, maximum = 100000) => Number.isFinite(value)
  ? Math.min(maximum, Math.max(0, Math.floor(value)))
  : 0;

function validTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 32) : "";
}

function validDayKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

function normalizeRevealedRecipes(candidate) {
  if (!Array.isArray(candidate)) return [];
  const unique = [...new Set(candidate.filter(safeKey))];
  const archive = unique.filter((recipeId) => ARCHIVE_RECIPE_IDS.has(recipeId));
  const rotating = unique.filter((recipeId) => !ARCHIVE_RECIPE_IDS.has(recipeId)).slice(-REVEALED_RECIPE_LIMIT);
  return [...archive, ...rotating];
}

export function createStats() {
  return {
    wins: 0,
    losses: 0,
    winStreak: 0,
    bestStreak: 0,
    collection: {},
    bestByRecipe: {},
    dailyClears: [],
    revealedRecipes: [],
  };
}

export function normalizeStats(candidate) {
  const stats = createStats();
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return stats;
  stats.wins = cleanCount(candidate.wins);
  stats.losses = cleanCount(candidate.losses);
  stats.winStreak = cleanCount(candidate.winStreak);
  stats.bestStreak = Math.max(stats.winStreak, cleanCount(candidate.bestStreak));

  if (candidate.collection && typeof candidate.collection === "object" && !Array.isArray(candidate.collection)) {
    const valid = [];
    for (const [id, record] of Object.entries(candidate.collection)) {
      if (!safeKey(id) || !record || typeof record !== "object") continue;
      const name = typeof record.name === "string" ? record.name.trim().slice(0, 48) : "";
      const recipeId = typeof record.recipeId === "string" ? record.recipeId.slice(0, 80) : "";
      if (!name || !safeKey(recipeId)) continue;
      valid.push([id, {
        id,
        name,
        recipeId,
        rare: record.rare === true,
        stars: Math.min(3, Math.max(1, cleanCount(record.stars, 3))),
        unlockedAt: validTimestamp(record.unlockedAt),
      }]);
      if (valid.length > STATS_ENTRY_LIMIT) valid.shift();
    }
    stats.collection = Object.fromEntries(valid);
  }

  if (candidate.bestByRecipe && typeof candidate.bestByRecipe === "object" && !Array.isArray(candidate.bestByRecipe)) {
    const valid = [];
    for (const [recipeId, guesses] of Object.entries(candidate.bestByRecipe)) {
      if (!safeKey(recipeId) || !Number.isInteger(guesses) || guesses < 1 || guesses > 100000) continue;
      valid.push([recipeId, guesses]);
      if (valid.length > STATS_ENTRY_LIMIT) valid.shift();
    }
    stats.bestByRecipe = Object.fromEntries(valid);
  }

  stats.dailyClears = Array.isArray(candidate.dailyClears)
    ? [...new Set(candidate.dailyClears.filter(validDayKey))].sort().slice(-366)
    : [];
  stats.revealedRecipes = normalizeRevealedRecipes(candidate.revealedRecipes);
  return stats;
}

export function hasRevealedRecipe(candidate, recipeId) {
  return safeKey(recipeId) && normalizeStats(candidate).revealedRecipes.includes(recipeId);
}

export function markRecipeRevealed(candidate, recipeId) {
  const stats = normalizeStats(candidate);
  if (!safeKey(recipeId) || stats.revealedRecipes.includes(recipeId)) return stats;
  stats.revealedRecipes = normalizeRevealedRecipes([...stats.revealedRecipes, recipeId]);
  return stats;
}

export function statsSummary(candidate) {
  const stats = normalizeStats(candidate);
  const bottles = Object.values(stats.collection);
  return {
    wins: stats.wins,
    losses: stats.losses,
    winStreak: stats.winStreak,
    bestStreak: stats.bestStreak,
    bottleCount: bottles.length,
    rareCount: bottles.filter(({ rare }) => rare).length,
    dailyCount: stats.dailyClears.length,
  };
}

export function recordOutcome(candidate, game, now = new Date()) {
  const stats = normalizeStats(candidate);
  if (!game || !["won", "lost"].includes(game.status)) return { stats, recorded: false };
  if (game.status === "lost") {
    stats.losses += 1;
    stats.winStreak = 0;
    return { stats, recorded: true, status: "lost" };
  }

  const timestamp = now instanceof Date ? now : new Date(now);
  const safeNow = Number.isNaN(timestamp.getTime()) ? new Date(0) : timestamp;
  const rating = remainingRating(game);
  const bottle = bottleIdentity(game.recipe, game.secret, rating);
  const existing = stats.collection[bottle.id] ?? null;
  const guessesUsed = game.guesses.length;
  const previousBest = stats.bestByRecipe[game.recipe.id];

  stats.wins += 1;
  stats.winStreak += 1;
  stats.bestStreak = Math.max(stats.bestStreak, stats.winStreak);
  if (!previousBest || guessesUsed < previousBest) stats.bestByRecipe[game.recipe.id] = guessesUsed;
  if (!existing) {
    stats.collection[bottle.id] = {
      id: bottle.id,
      name: bottle.name,
      recipeId: game.recipe.id,
      rare: bottle.rare,
      stars: rating.stars,
      unlockedAt: safeNow.toISOString(),
    };
  } else if (rating.stars > existing.stars || (bottle.rare && !existing.rare)) {
    stats.collection[bottle.id] = { ...existing, rare: existing.rare || bottle.rare, stars: Math.max(existing.stars, rating.stars) };
  }
  if (game.recipe.mode === "daily" && game.recipe.day && !stats.dailyClears.includes(game.recipe.day)) {
    stats.dailyClears.push(game.recipe.day);
    stats.dailyClears.sort();
    stats.dailyClears = stats.dailyClears.slice(-366);
  }
  return {
    stats,
    recorded: true,
    status: "won",
    rating,
    bottle,
    newBottle: !existing,
    personalBest: !previousBest || guessesUsed < previousBest,
  };
}

export function snapshotGame(game, extras = {}) {
  return {
    ...serializeGame(game),
    selectedSlot: Number.isInteger(extras.selectedSlot) ? extras.selectedSlot : 0,
    selectedEssence: Number.isInteger(extras.selectedEssence) ? extras.selectedEssence : 1,
    actions: cleanCount(extras.actions),
  };
}

function normalizeGameSnapshot(recipe, candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const game = replayGame(recipe, candidate);
  if (!game) return null;
  const selectedSlot = Number(candidate.selectedSlot);
  const selectedEssence = Number(candidate.selectedEssence);
  const actions = Number(candidate.actions);
  if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot >= game.params.slots) return null;
  if (!Number.isInteger(selectedEssence) || selectedEssence < 1 || selectedEssence > game.params.colours) return null;
  if (!Number.isInteger(actions) || actions < 0 || actions > 1000000) return null;
  return { game, selectedSlot, selectedEssence, actions };
}

function sameGuesses(left, right) {
  return JSON.stringify(left.guesses.map(({ pegs }) => pegs)) === JSON.stringify(right.guesses.map(({ pegs }) => pegs));
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validNonSubmitTransition(previous, next) {
  const previousGame = previous.game;
  const nextGame = next.game;
  const draftChanges = previousGame.draft.reduce((count, value, index) => count + Number(value !== nextGame.draft[index]), 0);
  const holdChanges = previousGame.holds.reduce((count, value, index) => count + Number(value !== nextGame.holds[index]), 0);
  if (draftChanges === 0 && holdChanges === 1 && sameValues(previousGame.draft, nextGame.draft)) return true;
  if (holdChanges !== 0 || !sameValues(previousGame.holds, nextGame.holds)) return false;
  if (draftChanges === 1) return true;
  if (draftChanges > 0 && nextGame.draft.every((value) => value === 0)) return true;
  const hint = suggestGuess(previousGame);
  return hint !== null && sameValues(nextGame.draft, hint);
}

function validUndoTransition(previous, next) {
  if (previous.game.status !== "playing" || next.actions !== previous.actions + 1) return false;
  const guessDelta = next.game.guesses.length - previous.game.guesses.length;
  if (guessDelta === 0) return sameGuesses(previous.game, next.game) && validNonSubmitTransition(previous, next);
  if (guessDelta !== 1) return false;
  const submitted = submitGuess(previous.game);
  return submitted.accepted && JSON.stringify(serializeGame(submitted.game)) === JSON.stringify(serializeGame(next.game));
}

function completionPayload(active) {
  const game = active?.game;
  if (!game || game.status !== "won" || active.recordedStatus !== "won") return null;
  return {
    eventId: active.completionEventId,
    levelId: game.recipe.id,
    tier: game.recipe.tier,
    moves: game.guesses.length,
    par: game.recipe.par,
  };
}

const EVENT_ID_PATTERN = /^mystic-perfumery:([a-z0-9][a-z0-9-]{7,95}):complete$/i;
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
    && candidate.moves <= 1_000_000
    && Number.isSafeInteger(candidate.par)
    && candidate.par >= 0
    && candidate.par <= 1_000_000;
}

export function normalizePerfumeryOutbox(candidate) {
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

export function enqueuePerfumeryCompletion(queue, payload) {
  if (!Array.isArray(queue) || !validCompletionPayload(payload)) return false;
  if (queue.some((item) => item?.eventId === payload.eventId)) return false;
  queue.push({ ...payload });
  return true;
}

function appendCompletion(outbox, payload) {
  if (!payload || outbox.some((item) => item.eventId === payload.eventId)) return outbox;
  return [...outbox, payload];
}

export function stagePerfumeryCompletion(active) {
  if (!active) return active;
  let outbox = normalizePerfumeryOutbox(active.completionOutbox) ?? [];
  if (active.completionReported === true) {
    outbox = outbox.filter((payload) => payload.eventId !== active.completionEventId);
  } else {
    outbox = appendCompletion(outbox, completionPayload(active));
  }
  const unchanged = Array.isArray(active.completionOutbox)
    && JSON.stringify(active.completionOutbox) === JSON.stringify(outbox);
  return unchanged ? active : { ...active, completionOutbox: outbox };
}

export function createSaveState(recipe, preferences = {}, stats = createStats(), options = {}) {
  const game = replayGame(recipe, { guesses: [], draft: Array(recipe.params.slots).fill(0), holds: Array(recipe.params.slots).fill(false) });
  const runId = isPerfumeryRunId(options.runId) ? options.runId : createPerfumeryRunId();
  const completionOutbox = normalizePerfumeryOutbox(options.completionOutbox) ?? [];
  return {
    version: SAVE_VERSION,
    preferences: { muted: preferences.muted === true },
    active: {
      recipe: { mode: recipe.mode, difficulty: recipe.difficulty, index: recipe.index, day: recipe.day },
      ...snapshotGame(game),
      history: [],
      runId,
      completionEventId: perfumeryCompletionEventId(runId),
      completionOutbox,
      completionReported: false,
      recordedStatus: "",
      updatedAt: "",
    },
    stats: normalizeStats(stats),
  };
}

export function confirmPerfumeryCompletion(active, reportCompletion) {
  const prepared = stagePerfumeryCompletion(active);
  if (!prepared || prepared.completionOutbox.length === 0 || typeof reportCompletion !== "function") {
    return {
      active: prepared,
      attempted: false,
      succeeded: prepared?.completionOutbox?.length === 0,
      reward: null,
      deliveredEventIds: [],
    };
  }
  const remaining = [...prepared.completionOutbox];
  const deliveredEventIds = [];
  let completionReported = prepared.completionReported;
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
      if (payload.eventId === prepared.completionEventId) {
        completionReported = true;
        reward = result;
      }
    } catch {
      failed = true;
      break;
    }
  }
  return {
    active: { ...prepared, completionReported, completionOutbox: remaining },
    attempted: true,
    succeeded: !failed,
    reward,
    deliveredEventIds,
  };
}

export function normalizeSave(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.version !== SAVE_VERSION || !candidate.active) return null;
  const recipe = recipeFromDescriptor(candidate.active.recipe);
  if (!recipe) return null;
  const active = normalizeGameSnapshot(recipe, candidate.active);
  if (!active) return null;

  const historyInput = Array.isArray(candidate.active.history) ? candidate.active.history.slice(-HISTORY_LIMIT) : [];
  const history = historyInput.map((item) => normalizeGameSnapshot(recipe, item));
  if (history.some((item) => item === null)) return null;
  const timeline = [...history, active];
  if (history.some((item) => item.game.status !== "playing")) return null;
  for (let index = 1; index < timeline.length; index += 1) {
    if (!validUndoTransition(timeline[index - 1], timeline[index])) return null;
  }

  const storedRecorded = ["", "won", "lost"].includes(candidate.active.recordedStatus)
    ? candidate.active.recordedStatus
    : "";

  const hasRunMetadata = ["runId", "completionEventId", "completionOutbox"]
    .some((key) => Object.hasOwn(candidate.active, key));
  let runId;
  let completionEventId;
  if (hasRunMetadata) {
    if (!["runId", "completionEventId", "completionOutbox"].every((key) => Object.hasOwn(candidate.active, key))) return null;
    if (!isPerfumeryRunId(candidate.active.runId)) return null;
    runId = candidate.active.runId;
    completionEventId = perfumeryCompletionEventId(runId);
    if (candidate.active.completionEventId !== completionEventId) return null;
  } else {
    // V1 saves did not have a run id. Give the restored attempt one id once;
    // the next serialization persists it without changing the storage key.
    runId = createPerfumeryRunId();
    completionEventId = perfumeryCompletionEventId(runId);
  }

  let stats = normalizeStats(candidate.stats);
  if (["won", "lost"].includes(storedRecorded)) {
    stats = markRecipeRevealed(stats, recipe.id);
  }

  let normalized = {
    version: SAVE_VERSION,
    preferences: { muted: candidate.preferences?.muted === true },
    active: {
      recipe,
      game: active.game,
      selectedSlot: active.selectedSlot,
      selectedEssence: active.selectedEssence,
      actions: active.actions,
      history,
      runId,
      completionEventId,
      completionOutbox: [],
      completionReported: candidate.active.completionReported === true,
      recordedStatus: storedRecorded,
      updatedAt: validTimestamp(candidate.active.updatedAt),
    },
    stats,
  };
  if (hasRunMetadata) {
    const outbox = normalizePerfumeryOutbox(candidate.active.completionOutbox);
    if (!outbox) return null;
    normalized.active.completionOutbox = outbox;
  }
  normalized.active = stagePerfumeryCompletion(normalized.active);
  return normalized;
}

export function serializeSave(state) {
  const active = stagePerfumeryCompletion(state.active);
  const recipe = active.recipe;
  return {
    version: SAVE_VERSION,
    preferences: { muted: state.preferences.muted === true },
    active: {
      recipe: { mode: recipe.mode, difficulty: recipe.difficulty, index: recipe.index, day: recipe.day },
      ...snapshotGame(active.game, active),
      history: active.history.slice(-HISTORY_LIMIT).map((item) => snapshotGame(item.game, item)),
      runId: active.runId,
      completionEventId: active.completionEventId,
      completionOutbox: active.completionOutbox.map((payload) => ({ ...payload })),
      completionReported: active.completionReported === true,
      recordedStatus: ["won", "lost"].includes(active.recordedStatus) ? active.recordedStatus : "",
      updatedAt: new Date().toISOString(),
    },
    stats: normalizeStats(state.stats),
  };
}

export function difficultyStats(statsInput) {
  const stats = normalizeStats(statsInput);
  return Object.fromEntries(DIFFICULTIES.map(({ id }) => [
    id,
    Object.keys(stats.bestByRecipe).filter((recipeId) => recipeId.startsWith(`${id}:`)).length,
  ]));
}
