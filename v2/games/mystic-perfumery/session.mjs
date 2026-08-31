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

export function createSaveState(recipe, preferences = {}, stats = createStats()) {
  const game = replayGame(recipe, { guesses: [], draft: Array(recipe.params.slots).fill(0), holds: Array(recipe.params.slots).fill(false) });
  return {
    version: SAVE_VERSION,
    preferences: { muted: preferences.muted === true },
    active: {
      recipe: { mode: recipe.mode, difficulty: recipe.difficulty, index: recipe.index, day: recipe.day },
      ...snapshotGame(game),
      history: [],
      completionReported: false,
      recordedStatus: "",
      updatedAt: "",
    },
    stats: normalizeStats(stats),
  };
}

export function confirmPerfumeryCompletion(active, reportCompletion) {
  if (
    active?.game?.status !== "won"
    || active.recordedStatus !== "won"
    || active.completionReported === true
    || typeof reportCompletion !== "function"
  ) {
    return { active, attempted: false, succeeded: active?.completionReported === true, reward: null };
  }
  try {
    const reward = reportCompletion();
    return {
      active: { ...active, completionReported: true },
      attempted: true,
      succeeded: true,
      reward,
    };
  } catch {
    return {
      active: { ...active, completionReported: false },
      attempted: true,
      succeeded: false,
      reward: null,
    };
  }
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

  let stats = normalizeStats(candidate.stats);
  if (["won", "lost"].includes(storedRecorded)) {
    stats = markRecipeRevealed(stats, recipe.id);
  }

  return {
    version: SAVE_VERSION,
    preferences: { muted: candidate.preferences?.muted === true },
    active: {
      recipe,
      game: active.game,
      selectedSlot: active.selectedSlot,
      selectedEssence: active.selectedEssence,
      actions: active.actions,
      history,
      completionReported: candidate.active.completionReported === true,
      recordedStatus: storedRecorded,
      updatedAt: validTimestamp(candidate.active.updatedAt),
    },
    stats,
  };
}

export function serializeSave(state) {
  const recipe = state.active.recipe;
  return {
    version: SAVE_VERSION,
    preferences: { muted: state.preferences.muted === true },
    active: {
      recipe: { mode: recipe.mode, difficulty: recipe.difficulty, index: recipe.index, day: recipe.day },
      ...snapshotGame(state.active.game, state.active),
      history: state.active.history.slice(-HISTORY_LIMIT).map((item) => snapshotGame(item.game, item)),
      completionReported: state.active.completionReported === true,
      recordedStatus: ["won", "lost"].includes(state.active.recordedStatus) ? state.active.recordedStatus : "",
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
