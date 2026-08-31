export const PROGRESS_VERSION = 1;

export const DEFAULT_MASTERY_TARGET = 9;

export const REALM_MASTERY_TARGETS = Object.freeze({
  "sky-bridges": 6,
  "mirror-theatre": 6,
});

export const RANKS = Object.freeze([
  { name: "见习旅者", threshold: 0 },
  { name: "境门行者", threshold: 300 },
  { name: "巡界师", threshold: 900 },
  { name: "破境者", threshold: 1800 },
  { name: "十境守望", threshold: 3200 },
  { name: "谜游宗师", threshold: 5200 },
]);

export function createProgress() {
  return {
    version: PROGRESS_VERSION,
    xp: 0,
    xpBase: 0,
    rewards: {},
    streak: { lastDay: "", count: 0 },
    realms: {},
  };
}

function finiteNonNegative(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function validDayKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function safePropertyKey(value) {
  return value !== "__proto__" && value !== "prototype" && value !== "constructor";
}

function validRewardKey(value) {
  return typeof value === "string"
    && value.length <= 240
    && safePropertyKey(value)
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function rewardTotal(rewards) {
  return Object.values(rewards).reduce((sum, points) => sum + points, 0);
}

export function masteryTargetFor(realmId) {
  return Object.hasOwn(REALM_MASTERY_TARGETS, realmId)
    ? REALM_MASTERY_TARGETS[realmId]
    : DEFAULT_MASTERY_TARGET;
}

export function badgeRulesForRealm(realmId) {
  const masteryTarget = masteryTargetFor(realmId);
  return [
    { name: "初入此境", clears: 1, description: "完成本境任意一关" },
    { name: "妙手破局", skillful: true, description: "达到效率线，或刷新一次个人最佳" },
    { name: "三关巡礼", clears: 3, description: "完成本境 3 个不同关卡" },
    { name: "本境行家", clears: 6, description: "完成本境 6 个不同关卡" },
    { name: "本境宗师", clears: masteryTarget, description: `完成本境 ${masteryTarget} 个不同关卡` },
  ];
}

export function normalizeProgress(candidate) {
  const clean = createProgress();
  if (!candidate || candidate.version !== PROGRESS_VERSION || typeof candidate !== "object") return clean;

  const storedXp = Math.floor(finiteNonNegative(candidate.xp));
  if (candidate.rewards && typeof candidate.rewards === "object" && !Array.isArray(candidate.rewards)) {
    for (const [rewardId, points] of Object.entries(candidate.rewards)) {
      if (!validRewardKey(rewardId) || !Number.isFinite(points) || points <= 0) continue;
      clean.rewards[rewardId] = Math.min(1000, Math.floor(points));
    }
  }
  const rewardsXp = rewardTotal(clean.rewards);
  const explicitBase = Math.floor(finiteNonNegative(candidate.xpBase));
  clean.xpBase = Math.max(explicitBase, storedXp - rewardsXp, 0);
  clean.xp = clean.xpBase + rewardsXp;
  clean.streak.lastDay = validDayKey(candidate.streak?.lastDay);
  clean.streak.count = Math.floor(finiteNonNegative(candidate.streak?.count));

  if (!candidate.realms || typeof candidate.realms !== "object" || Array.isArray(candidate.realms)) return clean;
  for (const [realmId, realm] of Object.entries(candidate.realms)) {
    if (!/^[a-z0-9-]{2,40}$/.test(realmId) || !safePropertyKey(realmId) || !realm || typeof realm !== "object") continue;
    const realmProgress = { clears: {}, badges: [] };
    if (realm.clears && typeof realm.clears === "object" && !Array.isArray(realm.clears)) {
      for (const [levelId, record] of Object.entries(realm.clears)) {
        if (!/^[a-z0-9:_-]{1,80}$/i.test(levelId) || !safePropertyKey(levelId) || !record || typeof record !== "object") continue;
        const wins = Math.max(1, Math.floor(finiteNonNegative(record.wins, 1)));
        const bestMoves = Number.isFinite(record.bestMoves) && record.bestMoves >= 0
          ? Math.floor(record.bestMoves)
          : null;
        realmProgress.clears[levelId] = {
          wins,
          bestMoves,
          firstAt: typeof record.firstAt === "string" ? record.firstAt.slice(0, 32) : "",
          lastAt: typeof record.lastAt === "string" ? record.lastAt.slice(0, 32) : "",
        };
      }
    }
    realmProgress.badges = Array.isArray(realm.badges)
      ? [...new Set(realm.badges.filter((badge) => typeof badge === "string").map((badge) => badge.slice(0, 40)))].slice(0, 20)
      : [];
    clean.realms[realmId] = realmProgress;
  }
  return clean;
}

function firstTimestamp(...values) {
  return values.filter(Boolean).sort()[0] ?? "";
}

function lastTimestamp(...values) {
  return values.filter(Boolean).sort().at(-1) ?? "";
}

function bestMove(...values) {
  const moves = values.filter((value) => Number.isFinite(value) && value >= 0);
  return moves.length ? Math.min(...moves) : null;
}

export function mergeProgress(...candidates) {
  const sources = candidates.map(normalizeProgress);
  if (!sources.length) return createProgress();

  const merged = createProgress();
  merged.xpBase = Math.max(...sources.map((source) => source.xpBase), 0);

  for (const source of sources) {
    for (const [rewardId, points] of Object.entries(source.rewards)) {
      merged.rewards[rewardId] = Math.max(merged.rewards[rewardId] ?? 0, points);
    }

    if (source.streak.lastDay > merged.streak.lastDay) {
      merged.streak = { ...source.streak };
    } else if (source.streak.lastDay === merged.streak.lastDay) {
      merged.streak.count = Math.max(merged.streak.count, source.streak.count);
    }
  }

  const realmIds = [...new Set(sources.flatMap((source) => Object.keys(source.realms)))].sort();
  for (const realmId of realmIds) {
    const realms = sources.map((source) => source.realms[realmId]).filter(Boolean);
    const realm = { clears: {}, badges: [] };
    const levelIds = [...new Set(realms.flatMap((item) => Object.keys(item.clears)))].sort();
    for (const levelId of levelIds) {
      const records = realms.map((item) => item.clears[levelId]).filter(Boolean);
      realm.clears[levelId] = {
        wins: Math.max(...records.map((record) => record.wins)),
        bestMoves: bestMove(...records.map((record) => record.bestMoves)),
        firstAt: firstTimestamp(...records.map((record) => record.firstAt)),
        lastAt: lastTimestamp(...records.map((record) => record.lastAt)),
      };
    }
    realm.badges = [...new Set(realms.flatMap((item) => item.badges))];
    const badgeOrder = badgeRulesForRealm(realmId).map(({ name }) => name);
    realm.badges.sort((left, right) => {
      const leftIndex = badgeOrder.indexOf(left);
      const rightIndex = badgeOrder.indexOf(right);
      if (leftIndex < 0 && rightIndex < 0) return left.localeCompare(right, "zh-CN");
      if (leftIndex < 0) return 1;
      if (rightIndex < 0) return -1;
      return leftIndex - rightIndex;
    });
    merged.realms[realmId] = realm;
  }

  merged.rewards = Object.fromEntries(Object.entries(merged.rewards).sort(([left], [right]) => left.localeCompare(right)));
  merged.xp = merged.xpBase + rewardTotal(merged.rewards);
  return merged;
}

export function localDayKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return localDayKey(new Date());
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function serialDay(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function cloneProgress(progress) {
  return normalizeProgress(JSON.parse(JSON.stringify(progress)));
}

function badgeCandidates(realmId, clearCount, skillful) {
  return badgeRulesForRealm(realmId)
    .filter((rule) => rule.skillful ? skillful : clearCount >= rule.clears)
    .map((rule) => rule.name);
}

function addReward(progress, breakdown, rewardId, label, points) {
  if (progress.rewards[rewardId]) return;
  progress.rewards[rewardId] = points;
  breakdown.push({ label, points });
}

export function awardCompletion(progress, completion, now = new Date()) {
  const next = cloneProgress(progress);
  const realmId = typeof completion?.realm === "string" ? completion.realm : "";
  const levelId = typeof completion?.levelId === "string" ? completion.levelId : "";
  if (
    !/^[a-z0-9-]{2,40}$/.test(realmId)
    || !safePropertyKey(realmId)
    || !/^[a-z0-9:_-]{1,80}$/i.test(levelId)
    || !safePropertyKey(levelId)
  ) {
    return { progress: next, awarded: 0, firstClear: false, personalBest: false, newBadges: [], breakdown: [] };
  }

  const tier = Math.min(3, Math.max(1, Math.floor(finiteNonNegative(completion.tier, 1))));
  const moves = Number.isFinite(completion.moves) && completion.moves >= 0 ? Math.floor(completion.moves) : null;
  const par = Number.isFinite(completion.par) && completion.par > 0 ? Math.floor(completion.par) : null;
  const realm = next.realms[realmId] ?? { clears: {}, badges: [] };
  const previous = realm.clears[levelId] ?? null;
  const firstClear = previous === null;
  const personalBest = !firstClear && moves !== null && (previous.bestMoves === null || moves < previous.bestMoves);
  const efficient = moves !== null && par !== null && moves <= par;
  const breakdown = [];

  const baseByTier = [0, 120, 180, 260];
  if (firstClear) {
    addReward(next, breakdown, `first:${realmId}:${levelId}`, `首次通关 · ${["", "启程", "进阶", "大师"][tier]}`, baseByTier[tier]);
  } else if (personalBest) {
    addReward(next, breakdown, `best:${realmId}:${levelId}:${moves}`, "刷新个人最佳", Math.round(baseByTier[tier] * 0.36));
  }

  if (efficient && (firstClear || personalBest)) {
    const margin = Math.max(0, par - moves);
    addReward(
      next,
      breakdown,
      `efficient:${realmId}:${levelId}:${moves}`,
      margin > 0 ? `妙手余量 · ${margin} 步` : "建议步数达成",
      Math.min(90, 20 + margin * 8),
    );
  }

  const today = localDayKey(now);
  if (next.streak.lastDay !== today) {
    const consecutive = next.streak.lastDay && serialDay(today) - serialDay(next.streak.lastDay) === 1;
    next.streak.count = consecutive ? next.streak.count + 1 : 1;
    next.streak.lastDay = today;
    addReward(
      next,
      breakdown,
      `daily:${today}`,
      `今日首胜 · ${next.streak.count} 日连游`,
      40 + Math.min(7, next.streak.count) * 10,
    );
  }

  const timestamp = (now instanceof Date ? now : new Date(now)).toISOString();
  realm.clears[levelId] = {
    wins: (previous?.wins ?? 0) + 1,
    bestMoves: moves === null ? previous?.bestMoves ?? null : Math.min(previous?.bestMoves ?? Infinity, moves),
    firstAt: previous?.firstAt || timestamp,
    lastAt: timestamp,
  };

  const clearCount = Object.keys(realm.clears).length;
  const candidates = badgeCandidates(realmId, clearCount, efficient || personalBest);
  const newBadges = candidates.filter((badge) => !realm.badges.includes(badge));
  for (const badge of newBadges) realm.badges.push(badge);
  for (const badge of newBadges) {
    addReward(next, breakdown, `badge:${realmId}:${badge}`, `新徽章 · ${badge}`, 30);
  }

  const awarded = breakdown.reduce((sum, item) => sum + item.points, 0);
  next.xp = next.xpBase + rewardTotal(next.rewards);
  next.realms[realmId] = realm;

  return { progress: next, awarded, firstClear, personalBest, efficient, newBadges, breakdown };
}

export function progressSummary(progress, realmId) {
  const clean = normalizeProgress(progress);
  const realm = clean.realms[realmId] ?? { clears: {}, badges: [] };
  const rankIndex = Math.max(0, RANKS.findLastIndex((rank) => clean.xp >= rank.threshold));
  const rank = RANKS[rankIndex];
  const nextRank = RANKS[rankIndex + 1] ?? null;
  const range = nextRank ? nextRank.threshold - rank.threshold : 1;
  const within = nextRank ? clean.xp - rank.threshold : 1;
  return {
    xp: clean.xp,
    rank: rank.name,
    nextRank: nextRank?.name ?? "已达最高境界",
    nextThreshold: nextRank?.threshold ?? clean.xp,
    ratio: nextRank ? Math.max(0, Math.min(1, within / range)) : 1,
    streak: clean.streak.count,
    clears: Object.keys(realm.clears).length,
    badges: [...realm.badges],
  };
}
