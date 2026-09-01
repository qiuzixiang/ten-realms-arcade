import {
  GAME_VERSION,
  GENERATOR_VERSION,
  MAX_HISTORY,
  PRESETS,
  STATUS,
  dailySeed,
  puzzleIdFor,
  restoreGame,
} from "./logic.mjs";
import { createCompletionPayload } from "./integration.mjs";

export const RECORDS_VERSION = 1;

export const CATALOGUE = Object.freeze([
  Object.freeze({ id: "spring-sprig", name: "春枝细绢", hint: "完成任意一匹布" }),
  Object.freeze({ id: "summer-ripple", name: "夏澜纱", hint: "完成夏织·精进" }),
  Object.freeze({ id: "autumn-check", name: "秋鹿锦", hint: "完成秋锦·严选" }),
  Object.freeze({ id: "winter-brocade", name: "冬山大幅", hint: "完成任意 16×16 布面" }),
  Object.freeze({ id: "three-harmony", name: "三候素缎", hint: "完成三候素染" }),
  Object.freeze({ id: "four-turns", name: "四时纹绢", hint: "完成四时雅染" }),
  Object.freeze({ id: "solver-satin", name: "精算缎", hint: "不超过求解器参考步数" }),
  Object.freeze({ id: "unbroken-cloud", name: "无隙云纹", hint: "全程每步都扩张布面" }),
  Object.freeze({ id: "daily-sun", name: "朝日布样", hint: "完成 1 张每日布样" }),
  Object.freeze({ id: "daily-moon", name: "三日月绮", hint: "完成 3 个不同日期布样" }),
  Object.freeze({ id: "seven-frames", name: "七架合锦", hint: "通过全部 7 种规格" }),
  Object.freeze({ id: "masterpiece", name: "百转名绣", hint: "收录 20 匹不同布面" }),
]);

const CATALOGUE_IDS = new Set(CATALOGUE.map(({ id }) => id));

export function createRecords() {
  return {
    version: RECORDS_VERSION,
    wins: 0,
    puzzleWins: {},
    bestMoves: {},
    presetWins: {},
    referenceWins: {},
    wasteFreeWins: {},
    dailyDays: {},
    maxCleanStreak: 0,
    catalogue: {},
    rewards: {},
    pendingCompletions: {},
    completionReports: {},
  };
}

function safeKey(value, max = 200) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= max
    && value !== "__proto__"
    && value !== "prototype"
    && value !== "constructor"
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function booleanMap(candidate, keyPattern) {
  const result = {};
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return result;
  for (const [key, value] of Object.entries(candidate)) {
    if (value === true && safeKey(key) && keyPattern.test(key)) result[key] = true;
  }
  return result;
}

function validDayKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function normalizedPendingPayload(id, candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  if (
    candidate.version !== 1
    || candidate.generatorVersion !== GENERATOR_VERSION
    || candidate.completionId !== id
    || candidate.gameId !== "season-dyehouse"
    || candidate.levelId !== candidate.puzzleId
  ) return null;
  const preset = PRESETS[candidate.difficulty];
  if (!safeKey(candidate.puzzleId) || !preset) return null;
  if (candidate.mode !== "seed" && candidate.mode !== "daily") return null;
  if (candidate.mode === "daily") {
    if (
      !validDayKey(candidate.day)
      || candidate.difficulty !== "12x12-medium"
      || candidate.seed !== dailySeed(candidate.day)
    ) return null;
  } else if (candidate.day !== "") return null;
  if (typeof candidate.completedAt !== "string" || candidate.completedAt.length > 32) return null;
  const completedAt = new Date(candidate.completedAt);
  if (Number.isNaN(completedAt.getTime())) return null;
  if (
    !Number.isInteger(candidate.seed)
    || candidate.seed < 0
    || candidate.seed > 0xffffffff
    || !Array.isArray(candidate.timeline)
    || candidate.timeline.length > MAX_HISTORY
    || !candidate.timeline.every(Number.isInteger)
  ) return null;
  const integerFields = ["tier", "seed", "moves", "moveLimit", "referenceMoves", "par", "maxCleanStreak"];
  if (integerFields.some((field) => !Number.isInteger(candidate[field]) || candidate[field] < 0)) return null;
  const rewardClaims = [];
  if (!Array.isArray(candidate.rewardClaims) || candidate.rewardClaims.length > 64) return null;
  for (const claim of candidate.rewardClaims) {
    if (
      !claim
      || typeof claim !== "object"
      || !safeKey(claim.id, 240)
      || !safeKey(claim.kind, 48)
      || typeof claim.label !== "string"
      || claim.label.length > 120
    ) return null;
    rewardClaims.push({ id: claim.id, kind: claim.kind, label: claim.label });
  }

  const replayed = restoreGame({
    version: GAME_VERSION,
    generatorVersion: candidate.generatorVersion,
    presetId: candidate.difficulty,
    seed: candidate.seed,
    timeline: candidate.timeline,
    reportedCompletionId: "",
  });
  if (!replayed || replayed.status !== STATUS.WON) return null;
  if (puzzleIdFor(replayed, candidate.mode, candidate.day) !== candidate.puzzleId) return null;
  if (
    candidate.tier !== preset.tier
    || candidate.seed !== replayed.seed
    || candidate.moves !== replayed.moves
    || candidate.moveLimit !== replayed.moveLimit
    || candidate.referenceMoves !== replayed.referenceMoves
    || candidate.par !== replayed.referenceMoves
    || candidate.efficient !== (replayed.moves <= replayed.referenceMoves)
    || candidate.wasteFree !== (replayed.wastes === 0)
    || candidate.maxCleanStreak !== replayed.maxCleanStreak
  ) return null;
  try {
    const payload = createCompletionPayload({
      puzzleId: candidate.puzzleId,
      attemptId: candidate.attemptId,
      mode: candidate.mode,
      day: candidate.day,
      presetId: candidate.difficulty,
      tier: candidate.tier,
      seed: candidate.seed,
      moves: candidate.moves,
      moveLimit: candidate.moveLimit,
      referenceMoves: candidate.referenceMoves,
      efficient: candidate.efficient,
      wasteFree: candidate.wasteFree,
      maxCleanStreak: candidate.maxCleanStreak,
      timeline: replayed.timeline,
      claims: rewardClaims,
    }, completedAt);
    return payload.completionId === id ? payload : null;
  } catch {
    return null;
  }
}

export function normalizeRecords(candidate) {
  const clean = createRecords();
  if (!candidate || typeof candidate !== "object" || candidate.version !== RECORDS_VERSION) return clean;
  clean.wins = Number.isInteger(candidate.wins) && candidate.wins >= 0 ? Math.min(candidate.wins, 100000) : 0;
  clean.maxCleanStreak = Number.isInteger(candidate.maxCleanStreak) && candidate.maxCleanStreak >= 0
    ? Math.min(candidate.maxCleanStreak, 512)
    : 0;

  if (candidate.puzzleWins && typeof candidate.puzzleWins === "object" && !Array.isArray(candidate.puzzleWins)) {
    for (const [key, value] of Object.entries(candidate.puzzleWins)) {
      if (safeKey(key) && Number.isInteger(value) && value > 0) clean.puzzleWins[key] = Math.min(value, 10000);
    }
  }
  if (candidate.bestMoves && typeof candidate.bestMoves === "object" && !Array.isArray(candidate.bestMoves)) {
    for (const [key, value] of Object.entries(candidate.bestMoves)) {
      if (safeKey(key) && Number.isInteger(value) && value >= 0 && value <= 512) clean.bestMoves[key] = value;
    }
  }
  clean.presetWins = booleanMap(candidate.presetWins, /^[a-z0-9-]+$/);
  clean.referenceWins = booleanMap(candidate.referenceWins, /^[a-z0-9:-]+$/i);
  clean.wasteFreeWins = booleanMap(candidate.wasteFreeWins, /^[a-z0-9:-]+$/i);
  clean.dailyDays = booleanMap(candidate.dailyDays, /^\d{4}-\d{2}-\d{2}$/);

  if (candidate.catalogue && typeof candidate.catalogue === "object" && !Array.isArray(candidate.catalogue)) {
    for (const [id, entry] of Object.entries(candidate.catalogue)) {
      if (!CATALOGUE_IDS.has(id) || !entry || typeof entry !== "object") continue;
      clean.catalogue[id] = {
        unlockedAt: typeof entry.unlockedAt === "string" ? entry.unlockedAt.slice(0, 32) : "",
      };
    }
  }
  if (candidate.rewards && typeof candidate.rewards === "object" && !Array.isArray(candidate.rewards)) {
    for (const [id, entry] of Object.entries(candidate.rewards)) {
      if (!safeKey(id, 240) || !entry || typeof entry !== "object") continue;
      clean.rewards[id] = {
        kind: typeof entry.kind === "string" ? entry.kind.slice(0, 32) : "achievement",
        awardedAt: typeof entry.awardedAt === "string" ? entry.awardedAt.slice(0, 32) : "",
      };
    }
  }
  if (candidate.pendingCompletions && typeof candidate.pendingCompletions === "object" && !Array.isArray(candidate.pendingCompletions)) {
    for (const [id, entry] of Object.entries(candidate.pendingCompletions)) {
      if (!safeKey(id, 240)) continue;
      const payload = normalizedPendingPayload(id, entry);
      if (payload) clean.pendingCompletions[id] = payload;
    }
  }
  if (candidate.completionReports && typeof candidate.completionReports === "object" && !Array.isArray(candidate.completionReports)) {
    for (const [id, reportedAt] of Object.entries(candidate.completionReports)) {
      if (!safeKey(id, 240) || typeof reportedAt !== "string") continue;
      clean.completionReports[id] = reportedAt.slice(0, 32);
    }
  }
  return clean;
}

function addClaim(records, claims, id, kind, label, awardedAt) {
  if (records.rewards[id]) return;
  records.rewards[id] = { kind, awardedAt };
  claims.push({ id, kind, label });
}

function catalogueEligible(id, records) {
  const distinctWins = Object.keys(records.puzzleWins).length;
  const presets = Object.keys(records.presetWins).length;
  const reference = Object.keys(records.referenceWins).length;
  const wasteFree = Object.keys(records.wasteFreeWins).length;
  const daily = Object.keys(records.dailyDays).length;
  switch (id) {
    case "spring-sprig": return distinctWins >= 1;
    case "summer-ripple": return records.presetWins["12x12-medium"] === true;
    case "autumn-check": return records.presetWins["12x12-hard"] === true;
    case "winter-brocade": return records.presetWins["16x16-medium"] === true || records.presetWins["16x16-hard"] === true;
    case "three-harmony": return records.presetWins["12x12-3"] === true;
    case "four-turns": return records.presetWins["12x12-4"] === true;
    case "solver-satin": return reference >= 1;
    case "unbroken-cloud": return wasteFree >= 1;
    case "daily-sun": return daily >= 1;
    case "daily-moon": return daily >= 3;
    case "seven-frames": return presets >= Object.keys(PRESETS).length;
    case "masterpiece": return distinctWins >= 20;
    default: return false;
  }
}

export function recordCompletion(candidate, completion, now = new Date()) {
  const records = normalizeRecords(candidate);
  const puzzleId = completion?.puzzleId;
  const presetId = completion?.presetId;
  const moves = completion?.moves;
  if (!safeKey(puzzleId) || !PRESETS[presetId] || !Number.isInteger(moves) || moves < 0 || moves > 512) {
    return { records, claims: [], newCatalogue: [], firstClear: false, personalBest: false };
  }

  const timestampValue = now instanceof Date ? now : new Date(now);
  const awardedAt = Number.isNaN(timestampValue.getTime()) ? new Date().toISOString() : timestampValue.toISOString();
  const previousWins = records.puzzleWins[puzzleId] ?? 0;
  const previousBest = records.bestMoves[puzzleId];
  const firstClear = previousWins === 0;
  const personalBest = previousBest === undefined || moves < previousBest;
  records.wins += 1;
  records.puzzleWins[puzzleId] = previousWins + 1;
  records.bestMoves[puzzleId] = personalBest ? moves : previousBest;
  records.presetWins[presetId] = true;
  records.maxCleanStreak = Math.max(records.maxCleanStreak, completion.maxCleanStreak ?? 0);
  if (completion.efficient === true) records.referenceWins[puzzleId] = true;
  if (completion.wasteFree === true) records.wasteFreeWins[puzzleId] = true;
  if (completion.mode === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(completion.day ?? "")) {
    records.dailyDays[completion.day] = true;
  }

  const claims = [];
  if (firstClear) {
    addClaim(records, claims, `season-dyehouse:first:${puzzleId}`, "first-clear", "新布面收录", awardedAt);
  }
  if (completion.efficient === true) {
    addClaim(records, claims, `season-dyehouse:reference:${puzzleId}`, "reference", "达到求解器参考线", awardedAt);
  }
  if (completion.wasteFree === true) {
    addClaim(records, claims, `season-dyehouse:waste-free:${puzzleId}`, "waste-free", "全程无空染", awardedAt);
  }
  if (completion.mode === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(completion.day ?? "")) {
    addClaim(records, claims, `season-dyehouse:daily:${completion.day}`, "daily", "今日布样", awardedAt);
  }

  const newCatalogue = [];
  for (const item of CATALOGUE) {
    if (records.catalogue[item.id] || !catalogueEligible(item.id, records)) continue;
    records.catalogue[item.id] = { unlockedAt: awardedAt };
    newCatalogue.push(item);
    addClaim(records, claims, `season-dyehouse:catalogue:${item.id}`, "catalogue", `织物图鉴·${item.name}`, awardedAt);
  }

  return { records, claims, newCatalogue, firstClear, personalBest };
}

export function recordsSummary(candidate) {
  const records = normalizeRecords(candidate);
  return {
    wins: records.wins,
    distinctWins: Object.keys(records.puzzleWins).length,
    catalogueUnlocked: Object.keys(records.catalogue).length,
    catalogueTotal: CATALOGUE.length,
    dailyCount: Object.keys(records.dailyDays).length,
    maxCleanStreak: records.maxCleanStreak,
  };
}
