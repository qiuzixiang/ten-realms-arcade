export const PROGRESS_VERSION = 1;
export const DEFAULT_MASTERY_TARGET = 9;
export const REALM_MASTERY_TARGETS = Object.freeze({});
export const RANKS = Object.freeze([
  { name: "新境访客", threshold: 0 },
  { name: "探路新星", threshold: 300 },
  { name: "异境行家", threshold: 900 },
  { name: "秘境领航", threshold: 1800 },
  { name: "十境守望", threshold: 3200 },
  { name: "万象宗师", threshold: 5200 },
]);

export function createProgress() {
  return { version: PROGRESS_VERSION, xp: 0, xpBase: 0, rewards: {}, streak: { lastDay: "", count: 0 }, realms: {} };
}

const validId = (value, pattern) => typeof value === "string"
  && pattern.test(value)
  && !["__proto__", "prototype", "constructor"].includes(value);
const amount = (value, fallback = 0) => Number.isFinite(value) && value >= 0 ? value : fallback;
const rewardTotal = (rewards) => Object.values(rewards).reduce((sum, value) => sum + value, 0);

export function masteryTargetFor(realmId) {
  return Object.hasOwn(REALM_MASTERY_TARGETS, realmId) ? REALM_MASTERY_TARGETS[realmId] : DEFAULT_MASTERY_TARGET;
}

export function badgeRulesForRealm(realmId) {
  const target = masteryTargetFor(realmId);
  return [
    { name: "初入此境", clears: 1, description: "完成本境任意一关" },
    { name: "妙手破局", skillful: true, description: "达到效率线，或刷新一次个人最佳" },
    { name: "三关巡礼", clears: 3, description: "完成本境 3 个不同关卡" },
    { name: "本境行家", clears: 6, description: "完成本境 6 个不同关卡" },
    { name: "本境宗师", clears: target, description: `完成本境 ${target} 个不同关卡` },
  ];
}

export function normalizeProgress(candidate) {
  const clean = createProgress();
  if (!candidate || typeof candidate !== "object" || candidate.version !== PROGRESS_VERSION) return clean;
  if (candidate.rewards && typeof candidate.rewards === "object" && !Array.isArray(candidate.rewards)) {
    for (const [key, value] of Object.entries(candidate.rewards)) {
      if (!validId(key, /^[^\u0000-\u001f\u007f]{1,240}$/) || !Number.isFinite(value) || value <= 0) continue;
      clean.rewards[key] = Math.min(1000, Math.floor(value));
    }
  }
  const storedXp = Math.floor(amount(candidate.xp));
  clean.xpBase = Math.max(Math.floor(amount(candidate.xpBase)), storedXp - rewardTotal(clean.rewards));
  clean.xp = clean.xpBase + rewardTotal(clean.rewards);
  clean.streak.lastDay = /^\d{4}-\d{2}-\d{2}$/.test(candidate.streak?.lastDay) ? candidate.streak.lastDay : "";
  clean.streak.count = Math.floor(amount(candidate.streak?.count));
  if (!candidate.realms || typeof candidate.realms !== "object" || Array.isArray(candidate.realms)) return clean;
  for (const [realmId, source] of Object.entries(candidate.realms)) {
    if (!validId(realmId, /^[a-z0-9-]{2,40}$/) || !source || typeof source !== "object") continue;
    const realm = { clears: {}, badges: [] };
    if (source.clears && typeof source.clears === "object" && !Array.isArray(source.clears)) {
      for (const [levelId, record] of Object.entries(source.clears)) {
        if (!validId(levelId, /^[a-z0-9:_-]{1,80}$/i) || !record || typeof record !== "object") continue;
        realm.clears[levelId] = {
          wins: Math.max(1, Math.floor(amount(record.wins, 1))),
          bestMoves: Number.isFinite(record.bestMoves) && record.bestMoves >= 0 ? Math.floor(record.bestMoves) : null,
          firstAt: typeof record.firstAt === "string" ? record.firstAt.slice(0, 32) : "",
          lastAt: typeof record.lastAt === "string" ? record.lastAt.slice(0, 32) : "",
        };
      }
    }
    realm.badges = Array.isArray(source.badges)
      ? [...new Set(source.badges.filter((item) => typeof item === "string").map((item) => item.slice(0, 40)))].slice(0, 20)
      : [];
    clean.realms[realmId] = realm;
  }
  return clean;
}

export function mergeProgress(...candidates) {
  const sources = candidates.map(normalizeProgress);
  if (!sources.length) return createProgress();
  const merged = createProgress();
  merged.xpBase = Math.max(...sources.map((item) => item.xpBase), 0);
  for (const source of sources) {
    for (const [key, value] of Object.entries(source.rewards)) merged.rewards[key] = Math.max(merged.rewards[key] ?? 0, value);
    if (source.streak.lastDay > merged.streak.lastDay) merged.streak = { ...source.streak };
    else if (source.streak.lastDay === merged.streak.lastDay) merged.streak.count = Math.max(merged.streak.count, source.streak.count);
  }
  for (const realmId of [...new Set(sources.flatMap((item) => Object.keys(item.realms)))]) {
    const realms = sources.map((item) => item.realms[realmId]).filter(Boolean);
    const realm = { clears: {}, badges: [...new Set(realms.flatMap((item) => item.badges))] };
    for (const levelId of [...new Set(realms.flatMap((item) => Object.keys(item.clears)))]) {
      const records = realms.map((item) => item.clears[levelId]).filter(Boolean);
      const bests = records.map((item) => item.bestMoves).filter(Number.isFinite);
      realm.clears[levelId] = {
        wins: Math.max(...records.map((item) => item.wins)),
        bestMoves: bests.length ? Math.min(...bests) : null,
        firstAt: records.map((item) => item.firstAt).filter(Boolean).sort()[0] ?? "",
        lastAt: records.map((item) => item.lastAt).filter(Boolean).sort().at(-1) ?? "",
      };
    }
    merged.realms[realmId] = realm;
  }
  merged.rewards = Object.fromEntries(Object.entries(merged.rewards).sort(([a], [b]) => a.localeCompare(b)));
  merged.xp = merged.xpBase + rewardTotal(merged.rewards);
  return merged;
}

export function localDayKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return localDayKey();
  return [value.getFullYear(), value.getMonth() + 1, value.getDate()]
    .map((part, index) => index ? String(part).padStart(2, "0") : String(part)).join("-");
}

const serialDay = (day) => {
  const [year, month, date] = day.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / 86400000);
};

export function awardCompletion(progress, completion, now = new Date()) {
  const next = normalizeProgress(JSON.parse(JSON.stringify(progress ?? null)));
  const realmId = completion?.realm;
  const levelId = completion?.levelId;
  const empty = { progress: next, awarded: 0, firstClear: false, personalBest: false, efficient: false, newBadges: [], breakdown: [] };
  if (!validId(realmId, /^[a-z0-9-]{2,40}$/) || !validId(levelId, /^[a-z0-9:_-]{1,80}$/i)) return empty;
  const realm = next.realms[realmId] ?? { clears: {}, badges: [] };
  const previous = realm.clears[levelId] ?? null;
  const moves = Number.isFinite(completion.moves) && completion.moves >= 0 ? Math.floor(completion.moves) : null;
  const par = Number.isFinite(completion.par) && completion.par >= 0 ? Math.floor(completion.par) : null;
  const tier = Math.min(3, Math.max(1, Math.floor(amount(completion.tier, 1))));
  const firstClear = !previous;
  const personalBest = !firstClear && moves !== null && (previous.bestMoves === null || moves < previous.bestMoves);
  const efficient = moves !== null && par !== null && moves <= par;
  const breakdown = [];
  const add = (id, label, points) => {
    if (next.rewards[id]) return;
    next.rewards[id] = points;
    breakdown.push({ label, points });
  };
  const base = [0, 120, 180, 260][tier];
  if (firstClear) add(`first:${realmId}:${levelId}`, "首次通关", base);
  else if (personalBest) add(`best:${realmId}:${levelId}:${moves}`, "刷新个人最佳", Math.round(base * .36));
  if (efficient && (firstClear || personalBest)) add(`efficient:${realmId}:${levelId}:${moves}`, "建议步数达成", Math.min(90, 20 + Math.max(0, par - moves) * 8));
  const today = localDayKey(now);
  if (next.streak.lastDay !== today) {
    const consecutive = next.streak.lastDay && serialDay(today) - serialDay(next.streak.lastDay) === 1;
    next.streak.count = consecutive ? next.streak.count + 1 : 1;
    next.streak.lastDay = today;
    add(`daily:${today}`, `今日首胜 · ${next.streak.count} 日连游`, 40 + Math.min(7, next.streak.count) * 10);
  }
  const timestamp = (now instanceof Date ? now : new Date(now)).toISOString();
  realm.clears[levelId] = {
    wins: (previous?.wins ?? 0) + 1,
    bestMoves: moves === null ? previous?.bestMoves ?? null : Math.min(previous?.bestMoves ?? Infinity, moves),
    firstAt: previous?.firstAt || timestamp,
    lastAt: timestamp,
  };
  const skillful = efficient || personalBest;
  const newBadges = badgeRulesForRealm(realmId)
    .filter((rule) => rule.skillful ? skillful : Object.keys(realm.clears).length >= rule.clears)
    .map((rule) => rule.name).filter((name) => !realm.badges.includes(name));
  for (const badge of newBadges) {
    realm.badges.push(badge);
    add(`badge:${realmId}:${badge}`, `新徽章 · ${badge}`, 30);
  }
  next.realms[realmId] = realm;
  next.xp = next.xpBase + rewardTotal(next.rewards);
  return { progress: next, awarded: breakdown.reduce((sum, item) => sum + item.points, 0), firstClear, personalBest, efficient, newBadges, breakdown };
}

export function progressSummary(progress, realmId) {
  const clean = normalizeProgress(progress);
  const index = Math.max(0, RANKS.findLastIndex((rank) => clean.xp >= rank.threshold));
  const rank = RANKS[index];
  const next = RANKS[index + 1];
  return {
    xp: clean.xp,
    rank: rank.name,
    nextRank: next?.name ?? "已达最高境界",
    nextThreshold: next?.threshold ?? clean.xp,
    ratio: next ? Math.max(0, Math.min(1, (clean.xp - rank.threshold) / (next.threshold - rank.threshold))) : 1,
    streak: clean.streak.count,
    clears: Object.keys(clean.realms[realmId]?.clears ?? {}).length,
    badges: [...(clean.realms[realmId]?.badges ?? [])],
  };
}
