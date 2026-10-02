export const EMPTY_ESSENCE = 0;

export const INGREDIENTS = Object.freeze([
  Object.freeze({ id: 1, key: "rose", name: "暮红玫瑰", short: "玫", shape: "round", pattern: "petal" }),
  Object.freeze({ id: 2, key: "bergamot", name: "金柑佛手", short: "柑", shape: "diamond", pattern: "stripe" }),
  Object.freeze({ id: 3, key: "cedar", name: "青枝雪松", short: "松", shape: "square", pattern: "grain" }),
  Object.freeze({ id: 4, key: "iris", name: "夜紫鸢尾", short: "鸢", shape: "triangle", pattern: "ray" }),
  Object.freeze({ id: 5, key: "musk", name: "月白麝香", short: "麝", shape: "hex", pattern: "dot" }),
  Object.freeze({ id: 6, key: "oolong", name: "琥珀乌龙", short: "茶", shape: "capsule", pattern: "wave" }),
  Object.freeze({ id: 7, key: "sea-salt", name: "潮蓝海盐", short: "盐", shape: "star", pattern: "crystal" }),
  Object.freeze({ id: 8, key: "agarwood", name: "墨烟沉香", short: "沉", shape: "slant", pattern: "smoke" }),
]);

export const DIFFICULTIES = Object.freeze([
  Object.freeze({
    id: "apprentice",
    label: "香徒",
    note: "本作入门预设 · 4 香 / 4 滴 / 10 轮",
    params: Object.freeze({ colours: 4, slots: 4, guesses: 10, allowBlank: false, allowDuplicates: true }),
    par: 5,
    tier: 1,
  }),
  Object.freeze({
    id: "standard",
    label: "调香师",
    note: "经典 Standard · 6 香 / 4 滴 / 10 轮",
    params: Object.freeze({ colours: 6, slots: 4, guesses: 10, allowBlank: false, allowDuplicates: true }),
    par: 6,
    tier: 2,
  }),
  Object.freeze({
    id: "super",
    label: "秘典",
    note: "上游 Super · 8 香 / 5 滴 / 12 轮",
    params: Object.freeze({ colours: 8, slots: 5, guesses: 12, allowBlank: false, allowDuplicates: true }),
    par: 8,
    tier: 3,
  }),
]);

const RECIPE_NAMES = Object.freeze({
  apprentice: Object.freeze(["雾窗初醒", "绯信未启", "午后玻璃", "苔阶来客"]),
  standard: Object.freeze(["月桂密函", "铜钟余温", "雨夜藏书", "无名舞会"]),
  super: Object.freeze(["第七码头", "星砂禁室", "黑曜回廊", "永夜标本"]),
});

export const ARCHIVE_RECIPE_COUNT = 4;

export function validateParams(candidate) {
  if (!candidate || typeof candidate !== "object") throw new TypeError("Guess parameters must be an object.");
  const colours = Number(candidate.colours);
  const slots = Number(candidate.slots);
  const guesses = Number(candidate.guesses);
  const allowBlank = candidate.allowBlank === true;
  const allowDuplicates = candidate.allowDuplicates !== false;
  if (!Number.isInteger(colours) || colours < 2 || colours > 10) {
    throw new RangeError("Colours must be an integer from 2 to 10.");
  }
  if (!Number.isInteger(slots) || slots < 2) throw new RangeError("Slots must be an integer of at least 2.");
  if (!Number.isInteger(guesses) || guesses < 1) throw new RangeError("Guesses must be an integer of at least 1.");
  if (!allowDuplicates && colours < slots) {
    throw new RangeError("Disallowing duplicates requires at least as many colours as slots.");
  }
  return Object.freeze({ colours, slots, guesses, allowBlank, allowDuplicates });
}

export function difficultyById(id) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? null;
}

export function localDayKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) throw new RangeError("Invalid date.");
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function normalizeSeed(seed) {
  const text = String(seed ?? "").trim();
  if (!text || text.length > 96 || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new TypeError("Seed must be 1–96 printable characters.");
  }
  return text;
}

export function hashSeed(seed) {
  const text = normalizeSeed(seed);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 0x9e3779b9;
}

export function createRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    let mixed = state;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x7feb352d);
    mixed ^= mixed >>> 15;
    mixed = Math.imul(mixed, 0x846ca68b);
    mixed ^= mixed >>> 16;
    return mixed >>> 0;
  };
}

function uniformInt(randomUint32, range) {
  const size = 0x100000000;
  const limit = Math.floor(size / range) * range;
  let value;
  do value = randomUint32(); while (value >= limit);
  return value % range;
}

export function generateSecret(seed, paramsInput) {
  const params = validateParams(paramsInput);
  const random = createRandom(seed);
  if (params.allowDuplicates) {
    return Object.freeze(Array.from({ length: params.slots }, () => uniformInt(random, params.colours) + 1));
  }
  const pool = Array.from({ length: params.colours }, (_, index) => index + 1);
  for (let index = 0; index < params.slots; index += 1) {
    const swapIndex = index + uniformInt(random, params.colours - index);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return Object.freeze(pool.slice(0, params.slots));
}

export function archiveRecipe(difficultyId, index = 0) {
  const difficulty = difficultyById(difficultyId);
  if (!difficulty) throw new RangeError("Unknown difficulty.");
  if (!Number.isInteger(index)) throw new TypeError("Recipe index must be an integer.");
  const recipeIndex = ((index % ARCHIVE_RECIPE_COUNT) + ARCHIVE_RECIPE_COUNT) % ARCHIVE_RECIPE_COUNT;
  const seed = normalizeSeed(`archive:v1:${difficulty.id}:${recipeIndex}`);
  return Object.freeze({
    id: `${difficulty.id}:folio-${recipeIndex + 1}`,
    mode: "archive",
    difficulty: difficulty.id,
    index: recipeIndex,
    title: RECIPE_NAMES[difficulty.id][recipeIndex],
    seed,
    day: "",
    params: difficulty.params,
    par: difficulty.par,
    tier: difficulty.tier,
  });
}

function validDayKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

export function dailyRecipe(date = new Date()) {
  if (typeof date === "string" && !validDayKey(date)) throw new RangeError("Daily recipe requires a valid day key.");
  const day = typeof date === "string" ? date : localDayKey(date);
  const difficulty = difficultyById("standard");
  return Object.freeze({
    id: `daily:${day}`,
    mode: "daily",
    difficulty: difficulty.id,
    index: -1,
    title: `${day.slice(5).replace("-", "·")} · 今日香方`,
    seed: normalizeSeed(`daily:v1:${day}`),
    day,
    params: difficulty.params,
    par: difficulty.par,
    tier: difficulty.tier,
  });
}

export function recipeFromDescriptor(descriptor = {}) {
  if (descriptor.mode === "daily") {
    if (!validDayKey(descriptor.day)) return null;
    return dailyRecipe(descriptor.day);
  }
  if (descriptor.mode !== "archive" || !difficultyById(descriptor.difficulty) || !Number.isInteger(descriptor.index)) return null;
  if (descriptor.index < 0 || descriptor.index >= ARCHIVE_RECIPE_COUNT) return null;
  return archiveRecipe(descriptor.difficulty, descriptor.index);
}

function normalizePeg(value, params, allowEmpty = true) {
  if (!Number.isInteger(value)) return null;
  if (value === EMPTY_ESSENCE && allowEmpty) return value;
  if (value < 1 || value > params.colours) return null;
  return value;
}

export function normalizeGuess(guess, paramsInput, options = {}) {
  const params = validateParams(paramsInput);
  if (!Array.isArray(guess) || guess.length !== params.slots) return null;
  const pegs = guess.map((value) => normalizePeg(value, params, options.allowEmpty !== false));
  return pegs.some((value) => value === null) ? null : pegs;
}

export function isGuessSubmittable(guess, paramsInput) {
  const params = validateParams(paramsInput);
  const pegs = normalizeGuess(guess, params);
  if (!pegs) return false;
  const nonBlank = pegs.filter((value) => value !== EMPTY_ESSENCE);
  if (params.allowBlank ? nonBlank.length < 1 : nonBlank.length !== params.slots) return false;
  if (!params.allowDuplicates && new Set(nonBlank).size !== nonBlank.length) return false;
  return true;
}

export function scoreGuess(secretInput, guessInput, paramsInput) {
  const params = validateParams(paramsInput);
  const secret = normalizeGuess(secretInput, params, { allowEmpty: false });
  const guess = normalizeGuess(guessInput, params);
  if (!secret || !guess) throw new TypeError("Secret and guess must match the configured slots and colours.");
  if (new Set(secret).size !== secret.length && !params.allowDuplicates) {
    throw new RangeError("The secret contains a duplicate colour while duplicates are disabled.");
  }
  const nonBlankGuess = guess.filter((value) => value !== EMPTY_ESSENCE);
  if (new Set(nonBlankGuess).size !== nonBlankGuess.length && !params.allowDuplicates) {
    throw new RangeError("The guess contains a duplicate colour while duplicates are disabled.");
  }
  let exact = 0;
  for (let index = 0; index < params.slots; index += 1) {
    if (guess[index] === secret[index]) exact += 1;
  }
  let overlap = 0;
  for (let colour = 1; colour <= params.colours; colour += 1) {
    const inSecret = secret.filter((value) => value === colour).length;
    const inGuess = guess.filter((value) => value === colour).length;
    overlap += Math.min(inSecret, inGuess);
  }
  return Object.freeze({ exact, misplaced: overlap - exact });
}

export function feedbackMarkers(feedback, slots) {
  if (!Number.isInteger(slots) || slots < 1) throw new RangeError("Slots must be positive.");
  const exact = Number(feedback?.exact);
  const misplaced = Number(feedback?.misplaced);
  if (!Number.isInteger(exact) || !Number.isInteger(misplaced) || exact < 0 || misplaced < 0 || exact + misplaced > slots) {
    throw new RangeError("Invalid feedback totals.");
  }
  return Object.freeze([
    ...Array(exact).fill("exact"),
    ...Array(misplaced).fill("misplaced"),
    ...Array(slots - exact - misplaced).fill("none"),
  ]);
}

function freshDraft(params) {
  return Array(params.slots).fill(EMPTY_ESSENCE);
}

export function createGame(recipe) {
  const params = validateParams(recipe?.params);
  const secret = generateSecret(recipe.seed, params);
  return Object.freeze({
    recipe,
    params,
    secret,
    guesses: Object.freeze([]),
    draft: Object.freeze(freshDraft(params)),
    holds: Object.freeze(Array(params.slots).fill(false)),
    status: "playing",
  });
}

function freezeGuessRecord(pegs, feedback) {
  return Object.freeze({ pegs: Object.freeze([...pegs]), feedback: Object.freeze({ ...feedback }) });
}

function nextGame(game, changes) {
  return Object.freeze({ ...game, ...changes });
}

export function setDraftPeg(game, slot, colour) {
  if (game?.status !== "playing") return { accepted: false, reason: "finished", game };
  if (!Number.isInteger(slot) || slot < 0 || slot >= game.params.slots) return { accepted: false, reason: "slot", game };
  if (normalizePeg(colour, game.params) === null) return { accepted: false, reason: "colour", game };
  if (game.draft[slot] === colour) return { accepted: false, reason: "unchanged", game };
  const draft = [...game.draft];
  draft[slot] = colour;
  return { accepted: true, game: nextGame(game, { draft: Object.freeze(draft) }) };
}

export function toggleHold(game, slot) {
  if (game?.status !== "playing") return { accepted: false, reason: "finished", game };
  if (!Number.isInteger(slot) || slot < 0 || slot >= game.params.slots) return { accepted: false, reason: "slot", game };
  const holds = [...game.holds];
  holds[slot] = !holds[slot];
  return { accepted: true, game: nextGame(game, { holds: Object.freeze(holds) }) };
}

export function submitGuess(game) {
  if (game?.status !== "playing") return { accepted: false, reason: "finished", game };
  if (!isGuessSubmittable(game.draft, game.params)) {
    const nonBlank = game.draft.filter(Boolean);
    const reason = !game.params.allowBlank && nonBlank.length < game.params.slots
      ? "incomplete"
      : game.params.allowBlank && nonBlank.length < 1
        ? "all-blank"
        : "duplicate";
    return { accepted: false, reason, game };
  }
  const feedback = scoreGuess(game.secret, game.draft, game.params);
  const record = freezeGuessRecord(game.draft, feedback);
  const guesses = Object.freeze([...game.guesses, record]);
  const won = feedback.exact === game.params.slots;
  const lost = !won && guesses.length >= game.params.guesses;
  const status = won ? "won" : lost ? "lost" : "playing";
  const draft = status === "playing"
    ? Object.freeze(game.draft.map((value, index) => game.holds[index] ? value : EMPTY_ESSENCE))
    : Object.freeze(freshDraft(game.params));
  const holds = status === "playing" ? game.holds : Object.freeze(Array(game.params.slots).fill(false));
  return {
    accepted: true,
    feedback,
    game: nextGame(game, { guesses, draft, holds, status }),
  };
}

export function replayGame(recipe, snapshot = {}) {
  let game = createGame(recipe);
  if (!Array.isArray(snapshot.guesses) || snapshot.guesses.length > game.params.guesses) return null;
  for (const guess of snapshot.guesses) {
    const pegs = normalizeGuess(guess, game.params);
    if (!pegs || !isGuessSubmittable(pegs, game.params) || game.status !== "playing") return null;
    game = nextGame(game, { draft: Object.freeze(pegs) });
    const result = submitGuess(game);
    if (!result.accepted) return null;
    game = result.game;
  }
  if (game.status !== "playing") {
    const emptyDraft = Array(game.params.slots).fill(EMPTY_ESSENCE);
    const emptyHolds = Array(game.params.slots).fill(false);
    if (snapshot.draft && JSON.stringify(snapshot.draft) !== JSON.stringify(emptyDraft)) return null;
    if (snapshot.holds && JSON.stringify(snapshot.holds) !== JSON.stringify(emptyHolds)) return null;
    return game;
  }
  const draft = normalizeGuess(snapshot.draft ?? freshDraft(game.params), game.params);
  const holds = Array.isArray(snapshot.holds) && snapshot.holds.length === game.params.slots
    && snapshot.holds.every((value) => typeof value === "boolean")
    ? [...snapshot.holds]
    : null;
  if (!draft || !holds) return null;
  return nextGame(game, { draft: Object.freeze(draft), holds: Object.freeze(holds) });
}

export function serializeGame(game) {
  return {
    guesses: game.guesses.map(({ pegs }) => [...pegs]),
    draft: [...game.draft],
    holds: [...game.holds],
  };
}

export function enumerateSecrets(paramsInput, limit = 100000) {
  const params = validateParams(paramsInput);
  const total = params.allowDuplicates
    ? params.colours ** params.slots
    : Array.from({ length: params.slots }, (_, index) => params.colours - index).reduce((a, b) => a * b, 1);
  if (!Number.isSafeInteger(total) || total > limit) throw new RangeError("Candidate space is too large to enumerate safely.");
  const results = [...iterateSecrets(params)];
  return Object.freeze(results);
}

function* iterateSecrets(params, acceptsPrefix = () => true) {
  const current = Array(params.slots).fill(0);
  const nextColour = Array(params.slots).fill(1);
  const used = new Set();
  let depth = 0;
  while (depth >= 0) {
    let colour = nextColour[depth];
    while (colour <= params.colours && !params.allowDuplicates && used.has(colour)) colour += 1;
    if (colour > params.colours) {
      nextColour[depth] = 1;
      if (depth === 0) break;
      depth -= 1;
      if (!params.allowDuplicates) used.delete(current[depth]);
      continue;
    }
    nextColour[depth] = colour + 1;
    current[depth] = colour;
    if (!params.allowDuplicates) used.add(colour);
    if (!acceptsPrefix(current, depth + 1)) {
      if (!params.allowDuplicates) used.delete(colour);
      continue;
    }
    if (depth === params.slots - 1) {
      yield Object.freeze([...current]);
      if (!params.allowDuplicates) used.delete(colour);
    } else {
      depth += 1;
      nextColour[depth] = 1;
    }
  }
}

function prepareFeedbackConstraints(guesses, params) {
  if (!Array.isArray(guesses)) return null;
  const constraints = [];
  for (const record of guesses) {
    const pegs = normalizeGuess(record?.pegs, params);
    const exact = Number(record?.feedback?.exact);
    const misplaced = Number(record?.feedback?.misplaced);
    if (!pegs || !isGuessSubmittable(pegs, params)
      || !Number.isInteger(exact) || !Number.isInteger(misplaced)
      || exact < 0 || misplaced < 0 || exact + misplaced > params.slots) return null;
    const counts = Array(params.colours + 1).fill(0);
    for (const peg of pegs) if (peg !== EMPTY_ESSENCE) counts[peg] += 1;
    constraints.push({ pegs, exact, overlap: exact + misplaced, counts });
  }
  return constraints;
}

function partialCandidateCouldMatch(candidate, length, constraints, params) {
  const candidateCounts = Array(params.colours + 1).fill(0);
  for (let index = 0; index < length; index += 1) candidateCounts[candidate[index]] += 1;
  const remaining = params.slots - length;
  for (const constraint of constraints) {
    let exactSoFar = 0;
    for (let index = 0; index < length; index += 1) {
      if (candidate[index] === constraint.pegs[index]) exactSoFar += 1;
    }
    if (exactSoFar > constraint.exact) return false;
    let possibleExact = exactSoFar;
    for (let index = length; index < params.slots; index += 1) {
      const colour = constraint.pegs[index];
      if (colour !== EMPTY_ESSENCE && (params.allowDuplicates || candidateCounts[colour] === 0)) possibleExact += 1;
    }
    if (possibleExact < constraint.exact) return false;

    let overlapSoFar = 0;
    let remainingOverlapCapacity = 0;
    for (let colour = 1; colour <= params.colours; colour += 1) {
      overlapSoFar += Math.min(candidateCounts[colour], constraint.counts[colour]);
      remainingOverlapCapacity += Math.max(0, constraint.counts[colour] - candidateCounts[colour]);
    }
    if (overlapSoFar > constraint.overlap) return false;
    if (overlapSoFar + Math.min(remaining, remainingOverlapCapacity) < constraint.overlap) return false;
  }
  return true;
}

export function isConsistentCandidate(candidate, guesses, paramsInput) {
  const params = validateParams(paramsInput);
  const secret = normalizeGuess(candidate, params, { allowEmpty: false });
  if (!secret) return false;
  return guesses.every((record) => {
    const pegs = normalizeGuess(record?.pegs, params);
    if (!pegs || !record?.feedback) return false;
    const feedback = scoreGuess(secret, pegs, params);
    return feedback.exact === record.feedback.exact && feedback.misplaced === record.feedback.misplaced;
  });
}

export function suggestGuess(game) {
  if (game?.status !== "playing") return null;
  const params = validateParams(game.params);
  const constraints = prepareFeedbackConstraints(game.guesses, params);
  if (!constraints) return null;
  const used = new Set(game.guesses.map(({ pegs }) => pegs.join(",")));
  let firstCandidate = null;
  const acceptsPrefix = (candidate, length) => partialCandidateCouldMatch(candidate, length, constraints, params);
  for (const candidate of iterateSecrets(params, acceptsPrefix)) {
    firstCandidate ??= candidate;
    if (!used.has(candidate.join(","))) return candidate;
  }
  return firstCandidate;
}

export function remainingRating(game) {
  if (game?.status !== "won") return Object.freeze({ remaining: 0, stars: 0, label: "未成方", rare: false });
  const remaining = Math.max(0, game.params.guesses - game.guesses.length);
  const ratio = remaining / game.params.guesses;
  const stars = ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;
  return Object.freeze({
    remaining,
    stars,
    label: stars === 3 ? "秘藏级" : stars === 2 ? "典藏级" : "成方级",
    rare: stars === 3,
  });
}

export function bottleIdentity(recipe, secret, rating) {
  const bases = ["雾滴瓶", "棱光瓶", "月相瓶", "星砂瓶", "墨晶瓶", "晨钟瓶"];
  const seals = ["蔷薇封", "铜羽封", "雪松封", "鸢尾封", "潮盐封", "沉烟封"];
  const hash = hashSeed(`${recipe.id}:${secret.join("-")}`);
  const rare = rating?.rare === true || recipe.mode === "daily";
  return Object.freeze({
    id: `bottle-${hash.toString(16).padStart(8, "0")}`,
    name: `${bases[hash % bases.length]} · ${seals[(hash >>> 8) % seals.length]}`,
    rare,
    kind: rare ? "rare" : "classic",
  });
}
