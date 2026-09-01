import {
  DIFFICULTIES,
  EDGE_ACTION,
  ENGINE_VERSION,
  analyzePosition,
  difficultyById,
  parsePosition,
  positionToJSON,
} from "./logic.mjs";

export const STORAGE_PREFIX = "ten-realms-v2:games:yokai-inn:";
export const STORAGE_KEYS = Object.freeze({
  profile: `${STORAGE_PREFIX}profile:v1`,
  session: `${STORAGE_PREFIX}session:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v2`,
  outbox: `${STORAGE_PREFIX}completion-outbox:v1`,
});

export const PROFILE_VERSION = 1;
export const SESSION_VERSION = 1;
export const HISTORY_LIMIT = 100;
export const TUTORIAL_VERSION = 2;
const OUTBOX_VERSION = 1;
const OUTBOX_LIMIT = 100;

export const DEMAND_LABELS = Object.freeze([
  "无灯静室",
  "一盏夜灯",
  "两碗热茶",
  "三枚风铃",
  "四叠软被",
  "五瓣月花",
]);

export const YOKAI_GUESTS = Object.freeze({
  "0-0": Object.freeze({ name: "提灯双子", note: "不点灯也能找到彼此的稀客", rare: true }),
  "0-1": Object.freeze({ name: "雨童与豆狸", note: "一静一闹，偏爱靠窗小室" }),
  "1-1": Object.freeze({ name: "镜狐姐妹", note: "两盏夜灯必须同时熄灭", rare: true }),
  "0-2": Object.freeze({ name: "河童与伞灵", note: "热茶要凉到月色一样温" }),
  "1-2": Object.freeze({ name: "鼬风与雪女", note: "灯影落在茶碗边最合心意" }),
  "2-2": Object.freeze({ name: "双尾猫又", note: "每位都坚持要两碗热茶", rare: true }),
  "0-3": Object.freeze({ name: "木魅与灯怪", note: "三声风铃后才肯入睡" }),
  "1-3": Object.freeze({ name: "狐火与酒虫", note: "一盏灯、三枚铃，缺一不可" }),
  "2-3": Object.freeze({ name: "青鹭火与座敷童", note: "茶香会把好运留在客房里" }),
  "3-3": Object.freeze({ name: "月兔双客", note: "六枚风铃会在午夜齐响", rare: true }),
  "0-4": Object.freeze({ name: "纸舞与山彦", note: "软被堆得越高，回声越轻" }),
  "1-4": Object.freeze({ name: "灯笼僧与白泽", note: "夜读只留一盏小灯" }),
  "2-4": Object.freeze({ name: "茶釜狸与网切", note: "两碗茶配四叠软被" }),
  "3-4": Object.freeze({ name: "风狸与胧车", note: "听着风铃在被褥间穿行" }),
  "4-4": Object.freeze({ name: "眠犬双仙", note: "八叠软被仍嫌不够", rare: true }),
  "0-5": Object.freeze({ name: "海坊主与花灵", note: "月花开时才会现身" }),
  "1-5": Object.freeze({ name: "狐面客与月鹿", note: "灯下能看见五瓣花纹" }),
  "2-5": Object.freeze({ name: "茶童与星熊", note: "热茶要盛在月花瓷里" }),
  "3-5": Object.freeze({ name: "铃彦与夜雀", note: "铃响三回，花落五瓣" }),
  "4-5": Object.freeze({ name: "被炉猫与云外镜", note: "最讲究的两位常住客" }),
  "5-5": Object.freeze({ name: "月华双姬", note: "只在满月同住一间房", rare: true }),
});

const COUNTER_KEYS = Object.freeze(DIFFICULTIES.flatMap(({ id }) => [`${id}:u`, `${id}:a`]));
const VALID_REWARD_KINDS = new Set(["clear", "best", "collection", "rare", "flawless", "star"]);

function baseCounters() {
  return Object.fromEntries(COUNTER_KEYS.map((key) => [key, 0]));
}

export function createDefaultProfile() {
  return {
    version: PROFILE_VERSION,
    preferences: {
      muted: false,
      difficulty: DIFFICULTIES[0].id,
      ensureUnique: true,
      tool: EDGE_ACTION.ROOM,
    },
    counters: baseCounters(),
    stats: {
      completedPuzzleIds: [],
      cleanPuzzleIds: [],
      bestMovesByPuzzle: {},
      clearsByDifficulty: Object.fromEntries(DIFFICULTIES.map(({ id }) => [id, 0])),
      compendium: [],
      rarePairs: [],
      rewardLedger: [],
      starLevel: 0,
    },
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function uniqueStrings(value, pattern, maximum) {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== "string" || !pattern.test(item))) {
    throw new TypeError("Invalid string record list.");
  }
  if (new Set(value).size !== value.length) throw new TypeError("Duplicate string record.");
  return [...value];
}

function nonNegativeInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new TypeError("Expected a bounded non-negative integer.");
  return value;
}

function normalizeAttemptId(value) {
  if (typeof value !== "string" || !/^[a-z0-9-]{8,64}$/.test(value)) throw new TypeError("Invalid attempt id.");
  return value;
}

function normalizeBestMoves(value) {
  if (!isPlainObject(value) || Object.keys(value).length > 1000) throw new TypeError("Invalid best-move records.");
  const result = {};
  for (const [id, moves] of Object.entries(value)) {
    if (!/^yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+$/.test(id)) throw new TypeError("Invalid best-move puzzle id.");
    result[id] = nonNegativeInteger(moves, 1000000);
  }
  return result;
}

function canonicalRewardEntry(id, kind) {
  let match;
  if (kind === "clear" && (match = id.match(/^yokai-inn:clear:(yokai-inn:g\d+:o(\d+):[ua]:[a-z0-9]+:a\d+)$/))) {
    const difficulty = DIFFICULTIES.find(({ order }) => order === Number(match[2]));
    if (difficulty) return { id, kind, label: `${difficulty.label}首次结账`, suggestedXp: 80 + difficulty.order * 20 };
  }
  if (kind === "best" && (match = id.match(/^yokai-inn:best:(yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+):(\d+)$/))) {
    const moves = nonNegativeInteger(Number(match[2]), 1000000);
    return { id, kind, label: `刷新旅簿：${moves} 步`, suggestedXp: 25 };
  }
  if (kind === "flawless" && /^yokai-inn:flawless:yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+$/.test(id)) {
    return { id, kind, label: "无误排房", suggestedXp: 35 };
  }
  if (kind === "collection" && (match = id.match(/^yokai-inn:guest:(\d-\d)$/)) && YOKAI_GUESTS[match[1]]) {
    return { id, kind, label: `住客图鉴：${YOKAI_GUESTS[match[1]].name}`, suggestedXp: 5 };
  }
  if (kind === "rare" && (match = id.match(/^yokai-inn:rare:(\d-\d)$/)) && YOKAI_GUESTS[match[1]]?.rare) {
    return { id, kind, label: `稀有组合：${YOKAI_GUESTS[match[1]].name}`, suggestedXp: 12 };
  }
  if (kind === "star" && (match = id.match(/^yokai-inn:star:([1-5])$/))) {
    const level = Number(match[1]);
    return { id, kind, label: `旅店晋升为 ${level} 星`, suggestedXp: 40 + level * 10 };
  }
  throw new TypeError("Reward id and kind disagree.");
}

function normalizeRewardLedger(value) {
  if (!Array.isArray(value) || value.length > 4000) throw new TypeError("Invalid reward ledger.");
  const ids = new Set();
  return value.map((entry) => {
    if (!isPlainObject(entry) || typeof entry.id !== "string" || !entry.id.startsWith("yokai-inn:")) {
      throw new TypeError("Invalid reward entry.");
    }
    if (ids.has(entry.id) || !VALID_REWARD_KINDS.has(entry.kind)) throw new TypeError("Duplicate or unknown reward entry.");
    ids.add(entry.id);
    const canonical = canonicalRewardEntry(entry.id, entry.kind);
    if (entry.label !== canonical.label || entry.suggestedXp !== canonical.suggestedXp) throw new TypeError("Reward metadata was modified.");
    return canonical;
  });
}

function validateProfileRecords(stats) {
  const completed = new Set(stats.completedPuzzleIds);
  const clean = new Set(stats.cleanPuzzleIds);
  const compendium = new Set(stats.compendium);
  const rare = new Set(stats.rarePairs);
  const rewardIds = new Set(stats.rewardLedger.map(({ id }) => id));

  if ([...rare].some((key) => !compendium.has(key))) throw new TypeError("Rare pairs must also be in the compendium.");
  if (Object.keys(stats.bestMovesByPuzzle).some((id) => !completed.has(id)) || [...completed].some((id) => !(id in stats.bestMovesByPuzzle))) {
    throw new TypeError("Best-move records do not match completions.");
  }
  for (const difficulty of DIFFICULTIES) {
    const actual = [...completed].filter((id) => id.includes(`:o${difficulty.order}:`)).length;
    if (stats.clearsByDifficulty[difficulty.id] !== actual) throw new TypeError("Difficulty totals do not match completion ids.");
  }
  const completedOrders = [...completed].map((id) => Number(id.match(/:o(\d+):/)?.[1]));
  if ([...compendium].some((key) => !completedOrders.some((order) => Number(key.split("-")[1]) <= order))) {
    throw new TypeError("Compendium entries require a matching completed scale.");
  }

  for (const entry of stats.rewardLedger) {
    if (entry.kind === "clear" && !completed.has(entry.id.slice("yokai-inn:clear:".length))) throw new TypeError("Unknown clear reward.");
    if (entry.kind === "flawless" && !clean.has(entry.id.slice("yokai-inn:flawless:".length))) throw new TypeError("Unknown flawless reward.");
    if (entry.kind === "collection" && !compendium.has(entry.id.slice("yokai-inn:guest:".length))) throw new TypeError("Unknown collection reward.");
    if (entry.kind === "rare" && !rare.has(entry.id.slice("yokai-inn:rare:".length))) throw new TypeError("Unknown rare reward.");
    if (entry.kind === "star" && Number(entry.id.at(-1)) > stats.starLevel) throw new TypeError("Unreached star reward.");
    if (entry.kind === "best") {
      const match = entry.id.match(/^yokai-inn:best:(yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+):(\d+)$/);
      if (!match || !completed.has(match[1]) || Number(match[2]) < stats.bestMovesByPuzzle[match[1]]) throw new TypeError("Unknown best-move reward.");
    }
  }
  for (const id of completed) if (!rewardIds.has(`yokai-inn:clear:${id}`)) throw new TypeError("Missing clear reward.");
  for (const id of clean) if (!rewardIds.has(`yokai-inn:flawless:${id}`)) throw new TypeError("Missing flawless reward.");
  for (const key of compendium) if (!rewardIds.has(`yokai-inn:guest:${key}`)) throw new TypeError("Missing collection reward.");
  for (const key of rare) if (!rewardIds.has(`yokai-inn:rare:${key}`)) throw new TypeError("Missing rare reward.");
  for (let level = 1; level <= stats.starLevel; level += 1) {
    if (!rewardIds.has(`yokai-inn:star:${level}`)) throw new TypeError("Missing star reward.");
  }
}

function normalizeCompletionDetail(value) {
  if (!isPlainObject(value) || value.version !== 1 || value.game !== "yokai-inn") throw new TypeError("Invalid completion outbox entry.");
  const puzzleIdentity = typeof value.puzzleId === "string"
    ? value.puzzleId.match(/^yokai-inn:g(\d+):o(\d+):([ua]):([a-z0-9]+):a(\d+)$/)
    : null;
  if (!puzzleIdentity) {
    throw new TypeError("Invalid completion puzzle id.");
  }
  const attemptId = normalizeAttemptId(value.attemptId);
  if (value.levelId !== value.puzzleId || value.completionId !== `${value.puzzleId}:run:${attemptId}`) {
    throw new TypeError("Completion identifiers disagree.");
  }
  const difficulty = difficultyById(value.difficulty);
  const order = nonNegativeInteger(value.order, 9);
  if (!difficulty || difficulty.order !== order) throw new TypeError("Invalid completion difficulty.");
  const expectedTier = DIFFICULTIES.findIndex(({ id }) => id === difficulty.id) + 1;
  if (value.tier !== expectedTier) throw new TypeError("Invalid completion tier.");
  const seed = nonNegativeInteger(value.seed, 0xffffffff);
  if (typeof value.ensureUnique !== "boolean" || value.uniqueRequested !== value.ensureUnique || typeof value.uniquenessProven !== "boolean") {
    throw new TypeError("Invalid completion uniqueness flags.");
  }
  if (
    Number(puzzleIdentity[1]) !== ENGINE_VERSION
    || Number(puzzleIdentity[2]) !== order
    || puzzleIdentity[3] !== (value.ensureUnique ? "u" : "a")
    || puzzleIdentity[4] !== seed.toString(36)
  ) throw new TypeError("Completion detail does not match its puzzle id.");
  if (value.ensureUnique && !value.uniquenessProven) throw new TypeError("A guaranteed-unique completion requires a proof.");
  const moves = nonNegativeInteger(value.moves, 1000000);
  const par = nonNegativeInteger(value.par, 1000);
  if (par !== ((order + 1) * (order + 2)) / 2) throw new TypeError("Invalid completion par.");
  const mistakes = nonNegativeInteger(value.mistakes, 1000000);
  if (moves < par || mistakes > moves) throw new TypeError("Invalid completion move totals.");
  if (value.flawless !== (mistakes === 0)) throw new TypeError("Invalid completion quality.");
  const elapsedMs = nonNegativeInteger(value.elapsedMs, 31_536_000_000);
  const starLevel = nonNegativeInteger(value.starLevel, 5);
  if (!Array.isArray(value.rewardClaims) || value.rewardClaims.length > 40) throw new TypeError("Invalid pending rewards.");
  const rewardClaims = normalizeRewardLedger(value.rewardClaims);
  const pairKeys = new Set();
  for (let high = 0; high <= order; high += 1) {
    for (let low = 0; low <= high; low += 1) pairKeys.add(`${low}-${high}`);
  }
  for (const claim of rewardClaims) {
    const collectionKey = claim.id.startsWith("yokai-inn:guest:") ? claim.id.slice("yokai-inn:guest:".length) : null;
    const rareKey = claim.id.startsWith("yokai-inn:rare:") ? claim.id.slice("yokai-inn:rare:".length) : null;
    const bestMatch = claim.id.match(/^yokai-inn:best:(yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+):(\d+)$/);
    const valid = (
      (claim.kind === "clear" && claim.id === `yokai-inn:clear:${value.puzzleId}`)
      || (claim.kind === "best" && bestMatch?.[1] === value.puzzleId && Number(bestMatch[2]) >= moves)
      || (claim.kind === "flawless" && claim.id === `yokai-inn:flawless:${value.puzzleId}`)
      || (claim.kind === "collection" && pairKeys.has(collectionKey))
      || (claim.kind === "rare" && pairKeys.has(rareKey) && YOKAI_GUESTS[rareKey]?.rare)
      || (claim.kind === "star" && /^yokai-inn:star:[1-5]$/.test(claim.id) && Number(claim.id.at(-1)) <= starLevel)
    );
    if (!valid) throw new TypeError("Pending reward does not belong to this completion.");
  }
  const rewardIds = rewardClaims.map(({ id }) => id);
  if (!Array.isArray(value.rewardIds) || value.rewardIds.length !== rewardIds.length || value.rewardIds.some((id, index) => id !== rewardIds[index])) {
    throw new TypeError("Completion reward ids disagree.");
  }
  return {
    version: 1,
    game: "yokai-inn",
    levelId: value.puzzleId,
    puzzleId: value.puzzleId,
    attemptId,
    completionId: `${value.puzzleId}:run:${attemptId}`,
    difficulty: difficulty.id,
    tier: expectedTier,
    order,
    seed,
    ensureUnique: value.ensureUnique,
    uniqueRequested: value.ensureUnique,
    uniquenessProven: value.uniquenessProven,
    moves,
    par,
    mistakes,
    flawless: mistakes === 0,
    elapsedMs,
    rewardIds,
    rewardClaims,
    starLevel,
  };
}

export function canonicalCompletionDetail(detailInput, completionResult, puzzle) {
  const detail = normalizeCompletionDetail(detailInput);
  if (!isPlainObject(completionResult) || !Array.isArray(completionResult.claims) || !isPlainObject(completionResult.profile)) {
    throw new TypeError("Invalid canonical completion result.");
  }
  if (!puzzle || puzzle.id !== detail.puzzleId || !Array.isArray(puzzle.pairKeys)) {
    throw new TypeError("Completion result does not use the official puzzle.");
  }
  const resultProfile = normalizeProfile(completionResult.profile);
  if (completionResult.flawless !== (detail.mistakes === 0) || completionResult.starLevel !== resultProfile.stats.starLevel) {
    throw new TypeError("Completion result disagrees with its canonical profile.");
  }
  const ledgerById = new Map(resultProfile.stats.rewardLedger.map((entry) => [entry.id, entry]));
  const pairKeys = new Set(puzzle.pairKeys);
  const candidates = new Map([...detail.rewardClaims, ...completionResult.claims].map((claim) => [claim?.id, claim]));
  const rewardClaims = [];
  for (const [id] of candidates) {
    const entry = typeof id === "string" ? ledgerById.get(id) : null;
    if (!entry) continue;
    const collectionKey = id.startsWith("yokai-inn:guest:") ? id.slice("yokai-inn:guest:".length) : null;
    const rareKey = id.startsWith("yokai-inn:rare:") ? id.slice("yokai-inn:rare:".length) : null;
    const bestMatch = id.match(/^yokai-inn:best:(yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+):(\d+)$/);
    const belongs = (
      (entry.kind === "clear" && id === `yokai-inn:clear:${detail.puzzleId}`)
      || (entry.kind === "best" && bestMatch?.[1] === detail.puzzleId && Number(bestMatch[2]) === detail.moves)
      || (entry.kind === "flawless" && detail.mistakes === 0 && id === `yokai-inn:flawless:${detail.puzzleId}`)
      || (entry.kind === "collection" && pairKeys.has(collectionKey))
      || (entry.kind === "rare" && pairKeys.has(rareKey) && YOKAI_GUESTS[rareKey]?.rare)
      || (entry.kind === "star" && /^yokai-inn:star:[1-5]$/.test(id) && Number(id.at(-1)) <= resultProfile.stats.starLevel)
    );
    if (belongs) rewardClaims.push(entry);
  }
  const normalized = normalizeCompletionDetail({
    ...detail,
    flawless: completionResult.flawless,
    rewardIds: rewardClaims.map(({ id }) => id),
    rewardClaims,
    starLevel: resultProfile.stats.starLevel,
  });
  return Object.freeze({
    ...normalized,
    rewardIds: Object.freeze([...normalized.rewardIds]),
    rewardClaims: Object.freeze(normalized.rewardClaims.map((claim) => Object.freeze({ ...claim }))),
  });
}

function normalizeOutbox(value) {
  if (!isPlainObject(value) || value.version !== OUTBOX_VERSION || !Array.isArray(value.entries) || value.entries.length > OUTBOX_LIMIT) {
    throw new TypeError("Invalid completion outbox.");
  }
  const entries = value.entries.map(normalizeCompletionDetail);
  if (new Set(entries.map(({ completionId }) => completionId)).size !== entries.length) throw new TypeError("Duplicate completion outbox entry.");
  return entries;
}

export function mergeCompletionOutbox(entriesInput, detailInput) {
  const entries = normalizeOutbox({ version: OUTBOX_VERSION, entries: entriesInput });
  const detail = normalizeCompletionDetail(detailInput);
  const previous = entries.find((entry) => entry.completionId === detail.completionId);
  const rewardClaims = previous
    ? [...new Map([...previous.rewardClaims, ...detail.rewardClaims].map((claim) => [claim.id, claim])).values()]
    : detail.rewardClaims;
  const merged = normalizeCompletionDetail({
    ...detail,
    starLevel: Math.max(previous?.starLevel ?? 0, detail.starLevel),
    rewardClaims,
    rewardIds: rewardClaims.map(({ id }) => id),
  });
  const next = entries.filter((entry) => entry.completionId !== merged.completionId);
  next.push(merged);
  if (next.length > OUTBOX_LIMIT) throw new TypeError("Completion outbox is full.");
  return Object.freeze(next.map((entry) => Object.freeze({
    ...entry,
    rewardIds: Object.freeze([...entry.rewardIds]),
    rewardClaims: Object.freeze(entry.rewardClaims.map((claim) => Object.freeze({ ...claim }))),
  })));
}

export function removeCompletionOutbox(entriesInput, completionId) {
  const entries = normalizeOutbox({ version: OUTBOX_VERSION, entries: entriesInput });
  return Object.freeze(entries.filter((entry) => entry.completionId !== completionId));
}

export function loadCompletionOutbox(storage) {
  let raw;
  try {
    raw = storageGet(storage, STORAGE_KEYS.outbox);
  } catch {
    return { status: "unavailable", entries: Object.freeze([]), storageAvailable: false };
  }
  if (raw === null) return { status: "empty", entries: Object.freeze([]), storageAvailable: true };
  try {
    return { status: "restored", entries: Object.freeze(normalizeOutbox(JSON.parse(raw))), storageAvailable: true };
  } catch {
    storageRemove(storage, STORAGE_KEYS.outbox);
    return { status: "invalid", entries: Object.freeze([]), storageAvailable: true };
  }
}

export function saveCompletionOutbox(storage, entriesInput) {
  try {
    const entries = normalizeOutbox({ version: OUTBOX_VERSION, entries: entriesInput });
    storage.setItem(STORAGE_KEYS.outbox, JSON.stringify({ version: OUTBOX_VERSION, entries }));
    return { ok: true, entries: Object.freeze(entries) };
  } catch {
    return { ok: false, entries: entriesInput };
  }
}

export function starSummary(stats) {
  const completed = stats.completedPuzzleIds.length;
  const clean = stats.cleanPuzzleIds.length;
  const exploredDifficulties = DIFFICULTIES.filter(({ id }) => stats.clearsByDifficulty[id] > 0).length;
  const collection = stats.compendium.length;
  const ratio = (current, target) => Math.min(1, current / target);
  const milestones = [
    { label: "完成第一本旅簿", current: Math.min(completed, 1), target: 1, progress: ratio(completed, 1), met: completed >= 1 },
    { label: "完成 3 题并踏入两座馆", current: Math.min(completed, 3), target: 3, progress: Math.min(ratio(completed, 3), ratio(exploredDifficulties, 2)), met: completed >= 3 && exploredDifficulties >= 2 },
    { label: "集齐 21 组住客并完成 6 题", current: Math.min(collection, 21), target: 21, progress: Math.min(ratio(collection, 21), ratio(completed, 6), ratio(exploredDifficulties, 3)), met: completed >= 6 && exploredDifficulties === 3 && collection >= 21 },
    { label: "完成 9 题，其中 3 题无误", current: Math.min(clean, 3), target: 3, progress: Math.min(ratio(completed, 9), ratio(clean, 3)), met: completed >= 9 && clean >= 3 },
    { label: "完成 15 题，其中 6 题无误", current: Math.min(clean, 6), target: 6, progress: Math.min(ratio(completed, 15), ratio(clean, 6)), met: completed >= 15 && clean >= 6 },
  ];
  let level = 0;
  for (const milestone of milestones) {
    if (!milestone.met) break;
    level += 1;
  }
  const next = milestones[level] ?? null;
  return Object.freeze({ level, next: next ? Object.freeze({ ...next }) : null, milestones: Object.freeze(milestones.map(Object.freeze)) });
}

export function normalizeProfile(value) {
  if (!isPlainObject(value) || value.version !== PROFILE_VERSION) throw new TypeError("Unsupported profile version.");
  if (!isPlainObject(value.preferences) || !difficultyById(value.preferences.difficulty)) throw new TypeError("Invalid preferences.");
  if (typeof value.preferences.muted !== "boolean" || typeof value.preferences.ensureUnique !== "boolean") throw new TypeError("Invalid preference flags.");
  if (![EDGE_ACTION.ROOM, EDGE_ACTION.EXCLUDE].includes(value.preferences.tool)) throw new TypeError("Invalid tool preference.");
  if (!isPlainObject(value.counters)) throw new TypeError("Invalid puzzle counters.");
  const counters = baseCounters();
  for (const key of COUNTER_KEYS) counters[key] = nonNegativeInteger(value.counters[key] ?? 0, 1000000);

  if (!isPlainObject(value.stats)) throw new TypeError("Invalid profile stats.");
  const completedPuzzleIds = uniqueStrings(value.stats.completedPuzzleIds, /^yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+$/, 1000);
  const cleanPuzzleIds = uniqueStrings(value.stats.cleanPuzzleIds, /^yokai-inn:g\d+:o\d+:[ua]:[a-z0-9]+:a\d+$/, 1000);
  if (cleanPuzzleIds.some((id) => !completedPuzzleIds.includes(id))) throw new TypeError("A flawless record must also be a completion.");
  const compendium = uniqueStrings(value.stats.compendium, /^\d-\d$/, 21);
  const rarePairs = uniqueStrings(value.stats.rarePairs, /^\d-\d$/, 6);
  if (compendium.some((key) => !YOKAI_GUESTS[key]) || rarePairs.some((key) => !YOKAI_GUESTS[key]?.rare)) {
    throw new TypeError("Unknown compendium pair.");
  }
  const clearsByDifficulty = {};
  if (!isPlainObject(value.stats.clearsByDifficulty)) throw new TypeError("Invalid difficulty records.");
  for (const { id } of DIFFICULTIES) clearsByDifficulty[id] = nonNegativeInteger(value.stats.clearsByDifficulty[id] ?? 0, 1000);
  if (Object.values(clearsByDifficulty).reduce((sum, count) => sum + count, 0) !== completedPuzzleIds.length) {
    throw new TypeError("Completion totals are inconsistent.");
  }
  const stats = {
    completedPuzzleIds,
    cleanPuzzleIds,
    bestMovesByPuzzle: normalizeBestMoves(value.stats.bestMovesByPuzzle),
    clearsByDifficulty,
    compendium,
    rarePairs,
    rewardLedger: normalizeRewardLedger(value.stats.rewardLedger),
    starLevel: 0,
  };
  stats.starLevel = starSummary(stats).level;
  validateProfileRecords(stats);
  return {
    version: PROFILE_VERSION,
    preferences: { ...value.preferences },
    counters,
    stats,
  };
}

function storageGet(storage, key) {
  if (!storage || typeof storage.getItem !== "function") throw new TypeError("Storage is unavailable.");
  return storage.getItem(key);
}

function storageRemove(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    // A failed cleanup must not block the in-memory fallback.
  }
}

export function loadProfile(storage) {
  let raw;
  try {
    raw = storageGet(storage, STORAGE_KEYS.profile);
  } catch {
    return { status: "unavailable", profile: createDefaultProfile(), storageAvailable: false };
  }
  if (raw === null) return { status: "empty", profile: createDefaultProfile(), storageAvailable: true };
  try {
    return { status: "restored", profile: normalizeProfile(JSON.parse(raw)), storageAvailable: true };
  } catch {
    storageRemove(storage, STORAGE_KEYS.profile);
    return { status: "invalid", profile: createDefaultProfile(), storageAvailable: true };
  }
}

export function saveProfile(storage, profile) {
  try {
    const normalized = normalizeProfile(profile);
    storage.setItem(STORAGE_KEYS.profile, JSON.stringify(normalized));
    return { ok: true, profile: normalized };
  } catch {
    return { ok: false, profile };
  }
}

function parseSnapshot(puzzle, value) {
  if (!isPlainObject(value)) return null;
  const position = parsePosition(puzzle, value.position);
  if (!position) return null;
  try {
    return {
      position,
      moves: nonNegativeInteger(value.moves, 1000000),
      mistakes: nonNegativeInteger(value.mistakes, 1000000),
    };
  } catch {
    return null;
  }
}

export function loadSession(storage, resolvePuzzle) {
  let raw;
  try {
    raw = storageGet(storage, STORAGE_KEYS.session);
  } catch {
    return { status: "unavailable", session: null, storageAvailable: false };
  }
  if (raw === null) return { status: "empty", session: null, storageAvailable: true };
  try {
    const saved = JSON.parse(raw);
    if (!isPlainObject(saved) || saved.version !== SESSION_VERSION || saved.generatorVersion !== ENGINE_VERSION || !isPlainObject(saved.active)) {
      throw new TypeError("Unsupported session.");
    }
    const descriptor = {
      order: nonNegativeInteger(saved.active.order, 9),
      seed: nonNegativeInteger(saved.active.seed, 0xffffffff),
      ensureUnique: saved.active.ensureUnique,
    };
    const attemptId = normalizeAttemptId(saved.active.attemptId);
    if (descriptor.order < 1 || typeof descriptor.ensureUnique !== "boolean") throw new TypeError("Invalid puzzle descriptor.");
    const puzzle = resolvePuzzle(descriptor);
    if (!puzzle || puzzle.id !== saved.active.puzzleId || puzzle.generatorVersion !== ENGINE_VERSION) throw new TypeError("Puzzle identity mismatch.");
    const current = parseSnapshot(puzzle, saved.active);
    if (!current) throw new TypeError("Invalid active position.");
    if (!Array.isArray(saved.active.history) || saved.active.history.length > HISTORY_LIMIT) throw new TypeError("Invalid history.");
    const history = saved.active.history.map((snapshot) => parseSnapshot(puzzle, snapshot));
    if (history.some((snapshot) => snapshot === null)) throw new TypeError("Invalid history snapshot.");
    const elapsedMs = nonNegativeInteger(saved.active.elapsedMs, 31_536_000_000);
    const completed = analyzePosition(puzzle, current.position).complete;
    if (typeof saved.active.completionReported !== "boolean") throw new TypeError("Invalid completion delivery state.");
    if (!completed && saved.active.completionReported) throw new TypeError("Incomplete sessions cannot contain completion delivery state.");
    return {
      status: "restored",
      storageAvailable: true,
      session: {
        puzzle,
        attemptId,
        ...current,
        elapsedMs,
        history,
        completed,
        completionReported: saved.active.completionReported,
      },
    };
  } catch {
    storageRemove(storage, STORAGE_KEYS.session);
    return { status: "invalid", session: null, storageAvailable: true };
  }
}

export function saveSession(storage, session) {
  try {
    const current = {
      position: session.position,
      moves: nonNegativeInteger(session.moves, 1000000),
      mistakes: nonNegativeInteger(session.mistakes, 1000000),
      elapsedMs: nonNegativeInteger(session.elapsedMs, 31_536_000_000),
    };
    const completed = analyzePosition(session.puzzle, session.position).complete;
    const completionReported = session.completionReported === true;
    if (!completed && completionReported) throw new TypeError("Incomplete sessions cannot contain completion delivery state.");
    const payload = {
      version: SESSION_VERSION,
      generatorVersion: ENGINE_VERSION,
      active: {
        puzzleId: session.puzzle.id,
        attemptId: normalizeAttemptId(session.attemptId),
        order: session.puzzle.order,
        seed: session.puzzle.seed,
        ensureUnique: session.puzzle.ensureUnique,
        position: positionToJSON(current.position),
        moves: current.moves,
        mistakes: current.mistakes,
        elapsedMs: current.elapsedMs,
        completionReported,
        history: session.history.slice(-HISTORY_LIMIT).map((snapshot) => ({
          position: positionToJSON(snapshot.position),
          moves: nonNegativeInteger(snapshot.moves, 1000000),
          mistakes: nonNegativeInteger(snapshot.mistakes, 1000000),
        })),
      },
    };
    storage.setItem(STORAGE_KEYS.session, JSON.stringify(payload));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function clearSession(storage) {
  try {
    storage.removeItem(STORAGE_KEYS.session);
    return true;
  } catch {
    return false;
  }
}

export function tutorialSeen(storage) {
  try {
    const record = JSON.parse(storageGet(storage, STORAGE_KEYS.tutorial));
    return isPlainObject(record) && record.version === TUTORIAL_VERSION && record.seen === true;
  } catch {
    return false;
  }
}

export function markTutorialSeen(storage) {
  try {
    storage.setItem(STORAGE_KEYS.tutorial, JSON.stringify({ version: TUTORIAL_VERSION, seen: true }));
    return true;
  } catch {
    return false;
  }
}

function cloneProfile(profile) {
  return normalizeProfile(JSON.parse(JSON.stringify(profile)));
}

function reward(id, kind, label, suggestedXp) {
  return { id, kind, label, suggestedXp };
}

export function recordCompletion(profileInput, completion) {
  const profile = cloneProfile(profileInput);
  const { puzzle, difficultyId, moves, mistakes } = completion;
  const difficulty = difficultyById(difficultyId);
  if (!puzzle || !difficulty || difficulty.order !== puzzle.order) throw new TypeError("Completion difficulty does not match the puzzle.");
  nonNegativeInteger(moves, 1000000);
  nonNegativeInteger(mistakes, 1000000);
  const analysis = analyzePosition(puzzle, completion.position);
  if (!analysis.complete) throw new TypeError("Only a complete legal position can be recorded.");

  const stats = profile.stats;
  const existingIds = new Set(stats.rewardLedger.map(({ id }) => id));
  const claims = [];
  const addClaim = (entry) => {
    if (existingIds.has(entry.id)) return;
    existingIds.add(entry.id);
    stats.rewardLedger.push(entry);
    claims.push(entry);
  };

  const firstClear = !stats.completedPuzzleIds.includes(puzzle.id);
  if (firstClear) {
    stats.completedPuzzleIds.push(puzzle.id);
    stats.clearsByDifficulty[difficultyId] += 1;
    addClaim(reward(`yokai-inn:clear:${puzzle.id}`, "clear", `${difficulty.label}首次结账`, 80 + puzzle.order * 20));
  }

  const previousBest = stats.bestMovesByPuzzle[puzzle.id];
  const personalBest = previousBest === undefined || moves < previousBest;
  if (personalBest) {
    stats.bestMovesByPuzzle[puzzle.id] = moves;
    if (!firstClear) addClaim(reward(`yokai-inn:best:${puzzle.id}:${moves}`, "best", `刷新旅簿：${moves} 步`, 25));
  }

  const flawless = mistakes === 0;
  if (flawless && !stats.cleanPuzzleIds.includes(puzzle.id)) {
    stats.cleanPuzzleIds.push(puzzle.id);
    addClaim(reward(`yokai-inn:flawless:${puzzle.id}`, "flawless", "无误排房", 35));
  }

  for (const key of puzzle.pairKeys) {
    if (!stats.compendium.includes(key)) {
      stats.compendium.push(key);
      const guest = YOKAI_GUESTS[key];
      addClaim(reward(`yokai-inn:guest:${key}`, "collection", `住客图鉴：${guest.name}`, 5));
    }
    if (YOKAI_GUESTS[key]?.rare && !stats.rarePairs.includes(key)) {
      stats.rarePairs.push(key);
      addClaim(reward(`yokai-inn:rare:${key}`, "rare", `稀有组合：${YOKAI_GUESTS[key].name}`, 12));
    }
  }
  stats.compendium.sort((a, b) => {
    const [al, ah] = a.split("-").map(Number);
    const [bl, bh] = b.split("-").map(Number);
    return (ah - bh) || (al - bl);
  });
  stats.rarePairs.sort();

  const stars = starSummary(stats);
  for (let level = stats.starLevel + 1; level <= stars.level; level += 1) {
    addClaim(reward(`yokai-inn:star:${level}`, "star", `旅店晋升为 ${level} 星`, 40 + level * 10));
  }
  stats.starLevel = stars.level;
  const normalized = normalizeProfile(profile);
  return Object.freeze({
    profile: normalized,
    claims: Object.freeze(claims.map(Object.freeze)),
    firstClear,
    personalBest,
    flawless,
    starLevel: normalized.stats.starLevel,
  });
}
