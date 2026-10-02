import { restore } from "./engine.mjs";
const KEY = "mini-polish:scent-letter:v1:save";
const TUTORIAL_KEY = "mini-polish:scent-letter:v1:tutorial:scent-letter-tutorial-v1";
const blank = () => ({ schemaVersion: 1, current: null, records: [], revealed: [], outbox: [] });
function load(storage, findLevel) {
  try {
    const raw = JSON.parse(storage.getItem(KEY));
    if (!raw || raw.schemaVersion !== 1) return blank();
    const clean = blank();
    clean.revealed = Array.isArray(raw.revealed) ? raw.revealed.filter((x) => typeof x === "string" && x.length < 90) : [];
    for (const item of Array.isArray(raw.records) ? raw.records : []) {
      const l = findLevel(item.levelId);
      const run = l && restore(l, item);
      if (run && run.status === "won" && !clean.records.some((r) => r.runId === run.runId)) {
        clean.records.push(run);
        if (!clean.revealed.includes(run.levelId)) clean.revealed.push(run.levelId);
      }
    }
    const level = raw.current && findLevel(raw.current.levelId);
    clean.current = level ? restore(level, raw.current) : null;
    if (clean.current && clean.current.status !== "playing" && !clean.revealed.includes(clean.current.levelId)) clean.revealed.push(clean.current.levelId);
    let rebuilt = blank();
    for (const r of clean.records) rebuilt = settle(rebuilt, r);
    const pending = new Set((Array.isArray(raw.outbox) ? raw.outbox : []).filter((p) => p && typeof p.completionId === "string").map((p) => p.completionId));
    clean.outbox = rebuilt.outbox.filter((p) => pending.has(p.completionId)).map((p) => {
      const original = raw.outbox.find((x) => x.completionId === p.completionId);
      return { ...p, completedAt: typeof original.completedAt === "string" ? original.completedAt : p.completedAt };
    });
    return clean;
  } catch {
    return blank();
  }
}
function save(storage, db) {
  try {
    storage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}
function payload(run, claims, at = (/* @__PURE__ */ new Date()).toISOString()) {
  return { schemaVersion: 1, gameId: "scent-letter", levelId: run.levelId, mode: run.levelId.indexOf("daily:") === 0 ? "daily" : "chapter", runId: run.runId, completionId: "scent-letter:" + run.runId, rewardClaims: claims, metrics: { rounds: run.history.length, hints: run.hints, practice: run.practice }, completedAt: at };
}
function settle(db, run) {
  let next = { ...db, current: run, revealed: db.revealed.slice(), records: db.records.slice(), outbox: db.outbox.slice() };
  if (run.status === "playing") return next;
  if (!next.revealed.includes(run.levelId)) next.revealed.push(run.levelId);
  if (run.status !== "won" || next.records.some((r) => r.runId === run.runId)) return next;
  const prior = next.records.filter((r) => r.levelId === run.levelId && !r.practice);
  const claims = [];
  if (!run.practice) {
    if (!prior.length) claims.push("scent-letter:" + run.levelId + ":first");
    if (!prior.some((r) => r.hints === run.hints && r.history.length <= run.history.length)) claims.push("scent-letter:" + run.levelId + ":best:" + run.hints + ":" + run.history.length);
  }
  next.records.push(run);
  next.outbox.push(payload(run, claims));
  return next;
}
function deliver(storage, db, host) {
  if (typeof host !== "function") return db;
  let next = db;
  for (const p of db.outbox) {
    try {
      if (host(p) === true) {
        const candidate = { ...next, outbox: next.outbox.filter((x) => x.completionId !== p.completionId) };
        if (save(storage, candidate)) next = candidate;
      }
    } catch {
    }
  }
  return next;
}
export {
  KEY,
  TUTORIAL_KEY,
  blank,
  deliver,
  load,
  save,
  settle
};
