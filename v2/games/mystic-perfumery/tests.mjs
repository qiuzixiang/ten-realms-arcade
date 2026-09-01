import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ARCHIVE_RECIPE_COUNT,
  DIFFICULTIES,
  EMPTY_ESSENCE,
  INGREDIENTS,
  archiveRecipe,
  bottleIdentity,
  createGame,
  createRandom,
  dailyRecipe,
  difficultyById,
  enumerateSecrets,
  feedbackMarkers,
  generateSecret,
  hashSeed,
  isConsistentCandidate,
  isGuessSubmittable,
  localDayKey,
  normalizeGuess,
  normalizeSeed,
  recipeFromDescriptor,
  remainingRating,
  replayGame,
  scoreGuess,
  serializeGame,
  setDraftPeg,
  submitGuess,
  suggestGuess,
  toggleHold,
  validateParams,
} from "./logic.mjs";
import {
  HISTORY_LIMIT,
  STATS_ENTRY_LIMIT,
  SAVE_VERSION,
  createSaveState,
  createStats,
  confirmPerfumeryCompletion,
  difficultyStats,
  hasRevealedRecipe,
  markRecipeRevealed,
  normalizeSave,
  normalizeStats,
  recordOutcome,
  serializeSave,
  snapshotGame,
  statsSummary,
} from "./session.mjs";
import { REALM_TUTORIALS, tutorialArt } from "../../shared/tutorial-data.mjs";

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function customRecipe(params, seed = "test-seed") {
  return {
    id: "test:recipe",
    mode: "archive",
    difficulty: "apprentice",
    index: 0,
    title: "测试香方",
    seed,
    day: "",
    params: validateParams(params),
    par: 3,
    tier: 1,
  };
}

function setGuess(game, pegs) {
  let next = game;
  pegs.forEach((peg, index) => {
    const result = setDraftPeg(next, index, peg);
    assert.equal(result.accepted, true, `slot ${index} should accept ${peg}`);
    next = result.game;
  });
  return next;
}

function submitPegs(game, pegs) {
  const ready = setGuess(game, pegs);
  const result = submitGuess(ready);
  assert.equal(result.accepted, true);
  return result;
}

function differentFullGuess(game) {
  const guess = [...game.secret];
  guess[0] = guess[0] % game.params.colours + 1;
  return guess;
}

function referenceScore(secret, guess) {
  const secretUsed = Array(secret.length).fill(false);
  const guessUsed = Array(guess.length).fill(false);
  let exact = 0;
  for (let index = 0; index < secret.length; index += 1) {
    if (secret[index] === guess[index]) {
      exact += 1;
      secretUsed[index] = true;
      guessUsed[index] = true;
    }
  }
  let misplaced = 0;
  for (let guessIndex = 0; guessIndex < guess.length; guessIndex += 1) {
    if (guessUsed[guessIndex] || guess[guessIndex] === 0) continue;
    const secretIndex = secret.findIndex((value, index) => !secretUsed[index] && value === guess[guessIndex]);
    if (secretIndex >= 0) {
      misplaced += 1;
      secretUsed[secretIndex] = true;
    }
  }
  return { exact, misplaced };
}

test("three named difficulties preserve upstream Standard and Super exactly", () => {
  assert.equal(DIFFICULTIES.length, 3);
  assert.deepEqual(difficultyById("apprentice").params, {
    colours: 4, slots: 4, guesses: 10, allowBlank: false, allowDuplicates: true,
  });
  assert.deepEqual(difficultyById("standard").params, {
    colours: 6, slots: 4, guesses: 10, allowBlank: false, allowDuplicates: true,
  });
  assert.deepEqual(difficultyById("super").params, {
    colours: 8, slots: 5, guesses: 12, allowBlank: false, allowDuplicates: true,
  });
  assert.equal(difficultyById("missing"), null);
  assert.equal(INGREDIENTS.length, 8);
  assert.equal(new Set(INGREDIENTS.map(({ shape }) => shape)).size, 8);
  assert.equal(new Set(INGREDIENTS.map(({ pattern }) => pattern)).size, 8);
  assert.equal(new Set(INGREDIENTS.map(({ short }) => short)).size, 8);
});

test("parameter validation enforces every upstream boundary", () => {
  assert.deepEqual(validateParams({ colours: 2, slots: 2, guesses: 1, allowBlank: true, allowDuplicates: false }), {
    colours: 2, slots: 2, guesses: 1, allowBlank: true, allowDuplicates: false,
  });
  assert.equal(validateParams({ colours: 10, slots: 14, guesses: 99 }).colours, 10);
  for (const params of [
    null,
    { colours: 1, slots: 2, guesses: 1 },
    { colours: 11, slots: 2, guesses: 1 },
    { colours: 4, slots: 1, guesses: 1 },
    { colours: 4, slots: 2, guesses: 0 },
    { colours: 3, slots: 4, guesses: 10, allowDuplicates: false },
    { colours: 4.5, slots: 4, guesses: 10 },
  ]) assert.throws(() => validateParams(params));
});

test("seed normalization and deterministic generator are reproducible", () => {
  assert.equal(normalizeSeed("  perfume-42  "), "perfume-42");
  assert.equal(hashSeed("same"), hashSeed("same"));
  assert.notEqual(hashSeed("same"), hashSeed("other"));
  assert.throws(() => normalizeSeed(""));
  assert.throws(() => normalizeSeed("x\nsecret"));
  assert.throws(() => normalizeSeed("x".repeat(97)));

  const params = difficultyById("super").params;
  assert.deepEqual(generateSecret("stable", params), generateSecret("stable", params));
  assert.notDeepEqual(generateSecret("stable", params), generateSecret("different", params));
  for (let index = 0; index < 1000; index += 1) {
    const secret = generateSecret(`legal-${index}`, params);
    assert.equal(secret.length, params.slots);
    assert.ok(secret.every((value) => value >= 1 && value <= params.colours));
  }

  const randomA = createRandom("stream");
  const randomB = createRandom("stream");
  assert.deepEqual(Array.from({ length: 12 }, randomA), Array.from({ length: 12 }, randomB));
});

test("random colour sampling is balanced and no-duplicate generation is legal", () => {
  const params = validateParams({ colours: 4, slots: 4, guesses: 10, allowDuplicates: true });
  const counts = Array(params.colours).fill(0);
  const sampleCount = 12000;
  for (let index = 0; index < sampleCount; index += 1) {
    for (const colour of generateSecret(`balance-${index}`, params)) counts[colour - 1] += 1;
  }
  const expected = sampleCount * params.slots / params.colours;
  for (const count of counts) assert.ok(Math.abs(count - expected) / expected < 0.04, `${counts.join(",")} should be balanced`);

  const uniqueParams = validateParams({ colours: 7, slots: 5, guesses: 8, allowDuplicates: false });
  for (let index = 0; index < 500; index += 1) {
    const secret = generateSecret(`unique-${index}`, uniqueParams);
    assert.equal(new Set(secret).size, secret.length);
  }
});

test("archive and daily recipe descriptors are stable, finite, and strict", () => {
  const archive = DIFFICULTIES.flatMap(({ id }) => (
    Array.from({ length: ARCHIVE_RECIPE_COUNT }, (_, index) => archiveRecipe(id, index))
  ));
  assert.equal(archive.length, 12);
  assert.equal(new Set(archive.map(({ id }) => id)).size, 12);
  assert.ok(
    archive.some((recipe) => {
      const secret = generateSecret(recipe.seed, recipe.params);
      return recipe.params.allowDuplicates && new Set(secret).size < secret.length;
    }),
    "the finite archive should exercise legal duplicate essences",
  );
  for (const recipe of archive) {
    assert.deepEqual(recipeFromDescriptor(recipe), recipe);
    assert.deepEqual(generateSecret(recipe.seed, recipe.params), createGame(recipe).secret);
  }
  assert.equal(archiveRecipe("apprentice", -1).index, ARCHIVE_RECIPE_COUNT - 1);
  assert.throws(() => archiveRecipe("unknown", 0));
  assert.throws(() => archiveRecipe("standard", 0.5));

  const date = new Date(2026, 7, 31, 10, 0);
  assert.equal(localDayKey(date), "2026-08-31");
  assert.equal(dailyRecipe(date).id, "daily:2026-08-31");
  assert.deepEqual(dailyRecipe("2026-08-31"), dailyRecipe(date));
  assert.equal(recipeFromDescriptor({ mode: "daily", day: "2026-02-30" }), null);
  assert.throws(() => dailyRecipe("2026-02-30"));
  assert.equal(recipeFromDescriptor({ mode: "archive", difficulty: "standard", index: 99 }), null);
});

test("feedback handles duplicate colours without double counting", () => {
  const params = validateParams({ colours: 6, slots: 4, guesses: 10, allowBlank: false, allowDuplicates: true });
  assert.deepEqual(scoreGuess([1, 1, 2, 3], [1, 2, 1, 1], params), { exact: 1, misplaced: 2 });
  assert.deepEqual(scoreGuess([1, 1, 2, 2], [1, 1, 1, 1], params), { exact: 2, misplaced: 0 });
  assert.deepEqual(scoreGuess([1, 2, 3, 4], [2, 1, 4, 3], params), { exact: 0, misplaced: 4 });
  assert.deepEqual(scoreGuess([1, 1, 1, 2], [2, 2, 2, 1], params), { exact: 0, misplaced: 2 });
  assert.deepEqual(feedbackMarkers({ exact: 2, misplaced: 1 }, 4), ["exact", "exact", "misplaced", "none"]);
  assert.throws(() => feedbackMarkers({ exact: 3, misplaced: 2 }, 4));
});

test("feedback formula matches independent two-stage matching exhaustively with blanks", () => {
  const params = validateParams({ colours: 3, slots: 4, guesses: 10, allowBlank: true, allowDuplicates: true });
  const secrets = enumerateSecrets(params);
  const guesses = [];
  for (let value = 0; value < 4 ** params.slots; value += 1) {
    let encoded = value;
    const guess = [];
    for (let slot = 0; slot < params.slots; slot += 1) {
      guess.push(encoded % 4);
      encoded = Math.floor(encoded / 4);
    }
    guesses.push(guess);
  }
  let checked = 0;
  for (const secret of secrets) {
    for (const guess of guesses) {
      assert.deepEqual(scoreGuess(secret, guess, params), referenceScore(secret, guess));
      checked += 1;
    }
  }
  assert.equal(checked, 20736);
});

test("blank and duplicate submission edges match upstream markability", () => {
  const standard = difficultyById("standard").params;
  assert.equal(isGuessSubmittable([1, 2, 3, 4], standard), true);
  assert.equal(isGuessSubmittable([1, 2, 3, 0], standard), false);
  assert.equal(isGuessSubmittable([0, 0, 0, 0], standard), false);

  const blanks = validateParams({ colours: 4, slots: 4, guesses: 5, allowBlank: true, allowDuplicates: true });
  assert.equal(isGuessSubmittable([1, 0, 0, 0], blanks), true);
  assert.equal(isGuessSubmittable([0, 0, 0, 0], blanks), false, "allow-blank still requires one non-blank peg");
  assert.deepEqual(scoreGuess([1, 2, 3, 4], [0, 0, 0, 0], blanks), { exact: 0, misplaced: 0 });

  const unique = validateParams({ colours: 5, slots: 4, guesses: 5, allowBlank: true, allowDuplicates: false });
  assert.equal(isGuessSubmittable([1, 2, 0, 0], unique), true, "multiple blanks do not count as duplicates");
  assert.equal(isGuessSubmittable([1, 1, 0, 0], unique), false);
  assert.throws(() => scoreGuess([1, 2, 3, 4], [1, 1, 0, 0], unique));
});

test("guess normalization rejects wrong lengths, fractions, and out-of-range pegs", () => {
  const params = difficultyById("apprentice").params;
  assert.deepEqual(normalizeGuess([0, 1, 2, 4], params), [0, 1, 2, 4]);
  assert.equal(normalizeGuess([1, 2, 3], params), null);
  assert.equal(normalizeGuess([1, 2, 3, 5], params), null);
  assert.equal(normalizeGuess([1, 2, 3, 2.5], params), null);
  assert.equal(normalizeGuess([1, 2, 3, 0], params, { allowEmpty: false }), null);
});

test("draft edits enforce slot and colour bounds while allowing reversible duplicates", () => {
  const game = createGame(archiveRecipe("apprentice", 0));
  assert.equal(setDraftPeg(game, -1, 1).reason, "slot");
  assert.equal(setDraftPeg(game, 4, 1).reason, "slot");
  assert.equal(setDraftPeg(game, 0, 5).reason, "colour");
  const first = setDraftPeg(game, 0, 2);
  assert.equal(first.accepted, true);
  assert.equal(first.game.draft[0], 2);
  const duplicate = setDraftPeg(first.game, 1, 2);
  assert.equal(duplicate.accepted, true);
  const cleared = setDraftPeg(duplicate.game, 0, EMPTY_ESSENCE);
  assert.equal(cleared.accepted, true);
  assert.deepEqual(cleared.game.draft.slice(0, 2), [0, 2]);
  assert.equal(setDraftPeg(cleared.game, 0, 0).reason, "unchanged");
});

test("hold marks copy matching positions to the next row and remain editable", () => {
  let game = createGame(archiveRecipe("standard", 0));
  const guess = differentFullGuess(game);
  game = setGuess(game, guess);
  game = toggleHold(game, 0).game;
  game = toggleHold(game, 2).game;
  const result = submitGuess(game);
  assert.equal(result.accepted, true);
  assert.equal(result.game.status, "playing");
  assert.deepEqual(result.game.draft, [guess[0], 0, guess[2], 0]);
  assert.deepEqual(result.game.holds, [true, false, true, false]);
  const edited = setDraftPeg(result.game, 0, guess[0] % game.params.colours + 1);
  assert.equal(edited.accepted, true, "held pegs remain editable");

  const emptyHold = toggleHold(createGame(archiveRecipe("standard", 1)), 1);
  assert.equal(emptyHold.accepted, true, "an empty slot can be held upstream");
  assert.equal(emptyHold.game.holds[1], true);
});

test("winning, losing, final-attempt priority, and terminal locks are exact", () => {
  const oneTry = customRecipe({ colours: 4, slots: 4, guesses: 1, allowBlank: false, allowDuplicates: true }, "one-try");
  let winning = createGame(oneTry);
  const winResult = submitPegs(winning, winning.secret);
  assert.equal(winResult.game.status, "won", "a correct final attempt wins before the limit loses");
  assert.equal(winResult.game.guesses.length, 1);
  assert.deepEqual(winResult.game.holds, [false, false, false, false]);
  assert.equal(setDraftPeg(winResult.game, 0, 1).reason, "finished");
  assert.equal(toggleHold(winResult.game, 0).reason, "finished");
  assert.equal(submitGuess(winResult.game).reason, "finished");

  let losing = createGame(oneTry);
  const lossResult = submitPegs(losing, differentFullGuess(losing));
  assert.equal(lossResult.game.status, "lost");
  assert.equal(lossResult.game.guesses.length, 1);
  assert.deepEqual(lossResult.game.draft, [0, 0, 0, 0]);
});

test("suggestions use only public feedback and stay consistent", () => {
  let game = createGame(archiveRecipe("apprentice", 0));
  const firstSuggestion = suggestGuess(game);
  assert.deepEqual(firstSuggestion, [1, 1, 1, 1]);
  assert.notDeepEqual(firstSuggestion, game.secret, "the first suggestion is not secret-aware");
  game = submitPegs(game, firstSuggestion).game;
  assert.equal(game.status, "playing");
  const nextSuggestion = suggestGuess(game);
  assert.ok(nextSuggestion);
  assert.equal(isConsistentCandidate(nextSuggestion, game.guesses, game.params), true);
  assert.equal(suggestGuess({ ...game, status: "won" }), null);

  const unique = validateParams({ colours: 4, slots: 3, guesses: 8, allowDuplicates: false });
  assert.equal(enumerateSecrets(unique).length, 24);
  assert.ok(enumerateSecrets(unique).every((candidate) => new Set(candidate).size === candidate.length));
  assert.throws(() => enumerateSecrets({ colours: 10, slots: 8, guesses: 10, allowDuplicates: true }));

  const large = validateParams({ colours: 10, slots: 8, guesses: 10, allowDuplicates: true });
  assert.deepEqual(suggestGuess({ status: "playing", params: large, guesses: [] }), Array(8).fill(1));
  assert.deepEqual(suggestGuess({
    status: "playing",
    params: large,
    guesses: [{ pegs: Array(8).fill(1), feedback: { exact: 0, misplaced: 0 } }],
  }), Array(8).fill(2), "feedback bounds should prune a huge impossible colour branch");
  const largeUnique = validateParams({ colours: 10, slots: 8, guesses: 10, allowDuplicates: false });
  assert.deepEqual(suggestGuess({ status: "playing", params: largeUnique, guesses: [] }), [1, 2, 3, 4, 5, 6, 7, 8]);
  const guarded = new Proxy(game, {
    get(target, property) {
      if (property === "secret") throw new Error("suggestions must not read the answer");
      return Reflect.get(target, property);
    },
  });
  assert.ok(suggestGuess(guarded));

  const small = validateParams({ colours: 3, slots: 3, guesses: 8, allowDuplicates: true });
  const smallCandidates = enumerateSecrets(small);
  for (const secret of smallCandidates) {
    for (const guess of smallCandidates) {
      const guesses = [{ pegs: guess, feedback: scoreGuess(secret, guess, small) }];
      const consistent = smallCandidates.filter((candidate) => isConsistentCandidate(candidate, guesses, small));
      const expected = consistent.find((candidate) => candidate.join(",") !== guess.join(",")) ?? consistent[0] ?? null;
      assert.deepEqual(suggestGuess({ status: "playing", params: small, guesses }), expected);
    }
  }
});

test("remaining-round rating and bottle identity are deterministic", () => {
  let game = createGame(archiveRecipe("apprentice", 2));
  game = submitPegs(game, game.secret).game;
  assert.deepEqual(remainingRating(game), { remaining: 9, stars: 3, label: "秘藏级", rare: true });
  const bottle = bottleIdentity(game.recipe, game.secret, remainingRating(game));
  assert.deepEqual(bottle, bottleIdentity(game.recipe, game.secret, remainingRating(game)));
  assert.equal(bottle.rare, true);
  const daily = createGame(dailyRecipe("2026-08-31"));
  const dailyBottle = bottleIdentity(daily.recipe, daily.secret, { rare: false });
  assert.equal(dailyBottle.rare, true, "daily recipes always form rare bottles");
  assert.equal(remainingRating(createGame(archiveRecipe("apprentice", 0))).stars, 0);
});

test("game replay recomputes all public feedback and rejects damaged snapshots", () => {
  const recipe = archiveRecipe("standard", 2);
  let game = createGame(recipe);
  game = submitPegs(game, differentFullGuess(game)).game;
  game = setDraftPeg(game, 0, 2).game;
  game = toggleHold(game, 0).game;
  const serialized = serializeGame(game);
  const replayed = replayGame(recipe, serialized);
  assert.ok(replayed);
  assert.deepEqual(serializeGame(replayed), serialized);
  assert.deepEqual(replayed.guesses[0].feedback, scoreGuess(replayed.secret, replayed.guesses[0].pegs, replayed.params));

  assert.equal(replayGame(recipe, { ...serialized, draft: [1, 2] }), null);
  assert.equal(replayGame(recipe, { ...serialized, holds: [true] }), null);
  assert.equal(replayGame(recipe, { ...serialized, guesses: [[9, 9, 9, 9]] }), null);
  assert.equal(replayGame(recipe, { ...serialized, guesses: Array(11).fill([1, 1, 1, 1]) }), null);
});

test("save round-trip stores no secret and restores strict undo history", () => {
  const recipe = archiveRecipe("standard", 1);
  let runtime = normalizeSave(createSaveState(recipe, { muted: true }));
  assert.ok(runtime);
  const before = snapshotGame(runtime.active.game, runtime.active);
  const edited = setDraftPeg(runtime.active.game, 0, 3).game;
  runtime.active.history.push({ game: runtime.active.game, selectedSlot: 0, selectedEssence: 1, actions: 0 });
  runtime.active.game = edited;
  runtime.active.selectedSlot = 1;
  runtime.active.selectedEssence = 3;
  runtime.active.actions = 1;
  const saved = serializeSave(runtime);
  const json = JSON.stringify(saved);
  assert.equal(json.includes('"secret"'), false, "ordinary save JSON must not contain a secret field");
  assert.equal(json.includes(runtime.active.game.secret.join(",")), false, "ordinary save JSON must not contain the answer sequence");
  const restored = normalizeSave(JSON.parse(json));
  assert.ok(restored);
  assert.equal(restored.preferences.muted, true);
  assert.deepEqual(snapshotGame(restored.active.game, restored.active), snapshotGame(runtime.active.game, runtime.active));
  assert.equal(restored.active.history.length, 1);
  assert.deepEqual(snapshotGame(restored.active.history[0].game, restored.active.history[0]), before);
  assert.equal(SAVE_VERSION, 1);
  assert.equal(HISTORY_LIMIT, 80);
});

test("save normalization safely rejects corrupt versions, recipes, state, and history", () => {
  const recipe = archiveRecipe("apprentice", 0);
  const valid = createSaveState(recipe);
  assert.equal(normalizeSave(null), null);
  assert.equal(normalizeSave({ ...valid, version: 99 }), null);
  assert.equal(normalizeSave({ ...valid, active: { ...valid.active, recipe: { mode: "daily", day: "not-a-day" } } }), null);
  assert.equal(normalizeSave({ ...valid, active: { ...valid.active, draft: [1, 2, 3, 99] } }), null);
  assert.equal(normalizeSave({ ...valid, active: { ...valid.active, selectedSlot: 99 } }), null);
  assert.equal(normalizeSave({ ...valid, active: { ...valid.active, selectedEssence: 0 } }), null);
  assert.equal(normalizeSave({ ...valid, active: { ...valid.active, actions: -1 } }), null);
  assert.equal(normalizeSave({ ...valid, active: { ...valid.active, history: [{ guesses: [], draft: [9, 0, 0, 0], holds: [false, false, false, false], selectedSlot: 0, selectedEssence: 1, actions: 0 }] } }), null);
});

test("undo history must be a contiguous chain of reachable playing states", () => {
  const recipe = archiveRecipe("apprentice", 1);
  let runtime = normalizeSave(createSaveState(recipe));
  const commit = (nextGame) => {
    runtime.active.history.push({
      game: runtime.active.game,
      selectedSlot: runtime.active.selectedSlot,
      selectedEssence: runtime.active.selectedEssence,
      actions: runtime.active.actions,
    });
    runtime.active.game = nextGame;
    runtime.active.actions += 1;
  };
  commit(setDraftPeg(runtime.active.game, 0, 2).game);
  commit(toggleHold(runtime.active.game, 0).game);
  commit(setDraftPeg(runtime.active.game, 1, 3).game);
  const saved = serializeSave(runtime);
  assert.ok(normalizeSave(saved), "a real action chain should restore");

  let cleared = runtime.active.game;
  cleared.draft.forEach((value, index) => {
    if (value) cleared = setDraftPeg(cleared, index, 0).game;
  });
  commit(cleared);
  assert.ok(normalizeSave(serializeSave(runtime)), "clearing several pegs is one reachable UI action");

  let hinted = normalizeSave(createSaveState(recipe));
  const suggestion = suggestGuess(hinted.active.game);
  hinted.active.history.push({ game: hinted.active.game, selectedSlot: 0, selectedEssence: 1, actions: 0 });
  suggestion.forEach((value, index) => {
    hinted.active.game = setDraftPeg(hinted.active.game, index, value).game;
  });
  hinted.active.actions = 1;
  assert.ok(normalizeSave(serializeSave(hinted)), "filling a full public hint is one reachable UI action");

  const duplicateAction = structuredClone(saved);
  duplicateAction.active.history[1].actions = duplicateAction.active.history[0].actions;
  assert.equal(normalizeSave(duplicateAction), null);

  const skippedAction = structuredClone(saved);
  skippedAction.active.actions += 1;
  assert.equal(normalizeSave(skippedAction), null);

  const impossibleEdit = structuredClone(saved);
  impossibleEdit.active.draft = [1, 2, 3, 4];
  impossibleEdit.active.holds = [true, true, true, true];
  assert.equal(normalizeSave(impossibleEdit), null, "one undo step cannot change every peg and hold at once");

  let won = createGame(recipe);
  won = submitPegs(won, won.secret).game;
  const terminalHistory = structuredClone(saved);
  terminalHistory.active.history[1] = {
    ...snapshotGame(won, { selectedSlot: 0, selectedEssence: 1, actions: 1 }),
  };
  assert.equal(normalizeSave(terminalHistory), null, "terminal snapshots can never be undo targets");
});

test("terminal saves preserve pending settlement and shared-report markers", () => {
  const recipe = archiveRecipe("apprentice", 0);
  let game = createGame(recipe);
  game = submitPegs(game, game.secret).game;
  let runtime = normalizeSave(createSaveState(recipe));
  runtime.active.game = game;
  runtime.active.completionReported = false;
  runtime.active.recordedStatus = "";
  const restored = normalizeSave(serializeSave(runtime));
  assert.equal(restored.active.game.status, "won");
  assert.equal(restored.active.completionReported, false);
  assert.equal(restored.active.recordedStatus, "");
  assert.equal(hasRevealedRecipe(restored.stats, recipe.id), false);
});

test("a thrown shared reward retries after restore without repeating perfume settlement", () => {
  const recipe = archiveRecipe("apprentice", 0);
  let game = createGame(recipe);
  game = submitPegs(game, game.secret).game;
  let runtime = normalizeSave(createSaveState(recipe));
  runtime.active.game = game;
  const local = recordOutcome(runtime.stats, game, new Date("2026-08-31T08:00:00Z"));
  runtime.stats = markRecipeRevealed(local.stats, recipe.id);
  runtime.active.recordedStatus = "won";
  assert.equal(runtime.stats.wins, 1);

  const failed = confirmPerfumeryCompletion(runtime.active, () => {
    throw new Error("shared API unavailable");
  });
  runtime.active = failed.active;
  assert.equal(failed.succeeded, false);
  assert.equal(runtime.active.completionReported, false);

  const restored = normalizeSave(serializeSave(runtime));
  assert.equal(restored.active.recordedStatus, "won");
  assert.equal(restored.active.completionReported, false);
  assert.equal(restored.stats.wins, 1);
  assert.equal(hasRevealedRecipe(restored.stats, recipe.id), true);

  const queued = [];
  const retried = confirmPerfumeryCompletion(restored.active, () => queued.push(recipe.id));
  assert.equal(retried.succeeded, true);
  assert.equal(retried.active.completionReported, true);
  assert.deepEqual(queued, [recipe.id]);
  assert.equal(restored.stats.wins, 1, "shared retry must not record the local bottle twice");
});

test("revealed recipe eligibility is persistent, monotonic, and recipe-scoped", () => {
  const recipe = archiveRecipe("apprentice", 0);
  const other = archiveRecipe("apprentice", 1);
  const marked = markRecipeRevealed(createStats(), recipe.id);
  assert.equal(hasRevealedRecipe(marked, recipe.id), true);
  assert.equal(hasRevealedRecipe(marked, other.id), false);
  assert.deepEqual(markRecipeRevealed(marked, recipe.id).revealedRecipes, [recipe.id]);

  let crowded = marked;
  for (let index = 0; index < 512; index += 1) crowded = markRecipeRevealed(crowded, `daily:test-${index}`);
  assert.equal(hasRevealedRecipe(crowded, recipe.id), true, "fixed archive reveals must never age out");

  const restored = normalizeSave(JSON.parse(JSON.stringify(createSaveState(recipe, {}, marked))));
  assert.ok(restored);
  assert.equal(hasRevealedRecipe(restored.stats, recipe.id), true);

  let lost = createGame(recipe);
  for (let index = 0; index < lost.params.guesses; index += 1) {
    lost = submitPegs(lost, differentFullGuess(lost)).game;
  }
  let interrupted = normalizeSave(createSaveState(recipe));
  interrupted.active.game = lost;
  interrupted.active.actions = lost.guesses.length;
  const repaired = normalizeSave(serializeSave(interrupted));
  assert.ok(repaired);
  assert.equal(repaired.active.game.status, "lost");
  assert.equal(repaired.active.recordedStatus, "", "an interrupted terminal save remains pending for app settlement");
  assert.equal(hasRevealedRecipe(repaired.stats, recipe.id), false);
});

test("collection, streak, daily, personal-best, and rare bottle incentives persist safely", () => {
  const recipe = archiveRecipe("apprentice", 0);
  let game = createGame(recipe);
  game = submitPegs(game, game.secret).game;
  const first = recordOutcome(createStats(), game, new Date("2026-08-31T08:00:00Z"));
  assert.equal(first.recorded, true);
  assert.equal(first.newBottle, true);
  assert.equal(first.personalBest, true);
  assert.equal(first.stats.wins, 1);
  assert.equal(first.stats.winStreak, 1);
  assert.equal(statsSummary(first.stats).bottleCount, 1);

  const replay = recordOutcome(first.stats, game, new Date("2026-08-31T09:00:00Z"));
  assert.equal(replay.newBottle, false, "same recipe cannot mint the same bottle twice");
  assert.equal(statsSummary(replay.stats).bottleCount, 1);
  assert.equal(replay.stats.bestByRecipe[recipe.id], 1);
  assert.equal(difficultyStats(replay.stats).apprentice, 1);

  let dailyGame = createGame(dailyRecipe("2026-08-31"));
  dailyGame = submitPegs(dailyGame, dailyGame.secret).game;
  const dailyFirst = recordOutcome(replay.stats, dailyGame);
  const dailyAgain = recordOutcome(dailyFirst.stats, dailyGame);
  assert.deepEqual(dailyAgain.stats.dailyClears, ["2026-08-31"]);
  assert.equal(dailyFirst.bottle.rare, true);

  let lostGame = createGame(customRecipe({ colours: 4, slots: 4, guesses: 1, allowBlank: false, allowDuplicates: true }, "lose-streak"));
  lostGame = submitPegs(lostGame, differentFullGuess(lostGame)).game;
  const lost = recordOutcome(dailyAgain.stats, lostGame);
  assert.equal(lost.stats.losses, 1);
  assert.equal(lost.stats.winStreak, 0);
  assert.ok(lost.stats.bestStreak >= 1);
});

test("stats normalization filters dangerous keys and malformed records", () => {
  const malicious = JSON.parse('{"wins":-3,"winStreak":"x","collection":{"__proto__":{"name":"bad"},"bottle-good":{"name":"好瓶","recipeId":"standard:folio-1","rare":true,"stars":9,"unlockedAt":"2026-08-31T10:00:00.000Z"},"bad key":{"name":"x","recipeId":"bad"}},"bestByRecipe":{"constructor":1,"standard:folio-1":3},"dailyClears":["2026-08-31","bad","2026-08-31"]}');
  const stats = normalizeStats(malicious);
  assert.equal(stats.wins, 0);
  assert.equal(Object.hasOwn(stats.collection, "__proto__"), false);
  assert.equal(Object.hasOwn(stats.bestByRecipe, "constructor"), false);
  assert.equal(stats.collection["bottle-good"].stars, 3);
  assert.deepEqual(stats.dailyClears, ["2026-08-31"]);
});

test("bounded collection and personal-best maps retain the newest valid entries", () => {
  const collection = {};
  const bestByRecipe = {};
  for (let index = 0; index <= STATS_ENTRY_LIMIT; index += 1) {
    const suffix = String(index).padStart(3, "0");
    collection[`bottle-${suffix}`] = {
      name: `香瓶 ${suffix}`,
      recipeId: `daily:2026-01-${String(index % 28 + 1).padStart(2, "0")}:${suffix}`,
      rare: false,
      stars: 1,
      unlockedAt: `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
    };
    bestByRecipe[`standard:test-${suffix}`] = index + 1;
  }
  const normalized = normalizeStats({ collection, bestByRecipe });
  assert.equal(Object.keys(normalized.collection).length, STATS_ENTRY_LIMIT);
  assert.equal(Object.keys(normalized.bestByRecipe).length, STATS_ENTRY_LIMIT);
  assert.equal(Object.hasOwn(normalized.collection, "bottle-000"), false);
  assert.equal(Object.hasOwn(normalized.bestByRecipe, "standard:test-000"), false);
  assert.equal(Object.hasOwn(normalized.collection, `bottle-${STATS_ENTRY_LIMIT}`), true);
  assert.equal(Object.hasOwn(normalized.bestByRecipe, `standard:test-${STATS_ENTRY_LIMIT}`), true);
});

test("page wiring includes shared realm UI, exact source links, offline assets, and all controls", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./app.mjs", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /data-realm="mystic-perfumery"/);
  assert.match(html, /\.\.\/\.\.\/shared\/realm-ui\.css/);
  assert.match(html, /type="module" src="\.\.\/\.\.\/shared\/realm-ui\.mjs"/);
  assert.match(html, /ebnbin\/puzzles\/blob\/main\/doc-zh\/guess\.html/);
  assert.match(html, /THIRD_PARTY_NOTICES\.md/);
  for (const id of ["submit-button", "undo-button", "restart-button", "new-game-button", "mute-button", "daily-button", "hint-button"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /<(?:img|script|link)[^>]+(?:src|href)="https?:/i, "runtime assets must remain local");
  assert.match(app, /window\.__realmCompletionQueue \?\?= \[\]/);
  assert.match(app, /levelId:\s*game\.recipe\.id/);
  assert.match(app, /document\.querySelector\("dialog\[open\]"\)/);
  assert.match(app, /selectSlot\(Number\(slot\.dataset\.slot\), true\)/);
  assert.match(app, /confirmPerfumeryCompletion\(state\.active, reportRealmCompletion\)/);
  assert.doesNotMatch(
    app,
    /!rewardEligible\)\s*state\.active\.completionReported\s*=\s*true/,
    "a previously collected recipe may still report a legitimate repeat win or personal best",
  );
  assert.match(app, /state\.active\.recordedStatus !== game\.status/);
  assert.match(app, /markRecipeRevealed\(state\.stats, game\.recipe\.id\)/);
  assert.match(app, /completionReported/);
  assert.match(html, /id="secret-slots" role="img"/);
  assert.match(html, /id="draft-row"\s+role="group"/);
  assert.doesNotMatch(html, /role="grid"/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /\.history-scroll\s*\{[\s\S]*?overflow:\s*auto/);
  assert.match(styles, /\.palette-scroll\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.palette-scroll\s*\{[\s\S]*?overflow-x:\s*visible/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.ingredient-palette\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.parameter-table\s*\{[\s\S]*?overflow-x:\s*visible/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.parameter-table table\s*\{[\s\S]*?min-width:\s*0[\s\S]*?table-layout:\s*fixed/);
  assert.match(styles, /@media \(max-width: 400px\)[\s\S]*?\.ingredient-button\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(html, /aria-label="香料精华选择器，可横向滚动"/);
  assert.match(styles, /@media \(max-width:\s*400px\)/);
  assert.match(styles, /@media \(max-height:\s*650px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /@media \(forced-colors:\s*active\)/);
  assert.match(styles, /\.result-dialog\s*\{[\s\S]*?overflow-y:\s*auto/);
});

test("three tutorial cards use distinct real-game SVG states", () => {
  const tutorial = REALM_TUTORIALS["mystic-perfumery"];
  assert.ok(tutorial);
  assert.equal(tutorial.version, 2);
  assert.equal(tutorial.cards.length, 3);
  const artwork = tutorial.cards.map(({ focus }) => tutorialArt("mystic-perfumery", focus));
  assert.equal(new Set(artwork).size, 3);
  for (const [index, art] of artwork.entries()) {
    assert.match(art, /^<svg\b/);
    assert.match(art, /preserveAspectRatio="xMidYMid meet"/);
    const layers = ["art-elements", "art-action", "art-goal"].filter((className) => art.includes(`class="${className}"`));
    assert.deepEqual(layers, [tutorial.cards[index].focus === "elements" ? "art-elements" : tutorial.cards[index].focus === "action" ? "art-action" : "art-goal"]);
  }
  assert.match(artwork[0], /玫|柑|松|鸢/);
  assert.match(artwork[1], /完全 2 · 成分 1/);
  assert.match(artwork[1], /data-feedback="2-exact-1-misplaced"/);
  assert.equal((artwork[1].match(/fill="#8f4962"/g) ?? []).length, 2, "two exact marks must be drawn, not only described");
  assert.match(artwork[2], /★/);
});

let passed = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} mystic-perfumery tests passed.`);
