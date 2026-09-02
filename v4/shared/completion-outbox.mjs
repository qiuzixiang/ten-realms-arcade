/**
 * Pure helpers for the durable V4 completion outbox.  A game writes its
 * canonical completion before invoking the shared reward host; delivery may
 * then safely be retried after a reload because reward-engine de-duplicates
 * eventId.
 */
export const MAX_COMPLETION_OUTBOX = 24;

const safeInteger = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
const safeSlug = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,39}$/.test(value);
const safeLevel = (value) => typeof value === "string" && /^[a-z0-9:_-]{1,80}$/i.test(value);
const safeRun = (value) => typeof value === "string" && /^[a-z0-9-]{6,96}$/i.test(value);
const safeEvent = (value) => typeof value === "string" && /^[^\u0000-\u001f\u007f]{1,240}$/.test(value);

export function buildCompletionPayload({ realm, levelId, tier = 1, moves = 0, par = null, runId } = {}) {
  if (!safeSlug(realm) || !safeLevel(levelId) || !safeRun(runId) || !safeInteger(tier, 1, 3) || !safeInteger(moves, 0, 1_000_000)
      || (par !== null && !safeInteger(par, 0, 1_000_000))) return null;
  const eventId = `${realm}:${levelId}:${runId}:complete`;
  if (!safeEvent(eventId)) return null;
  return Object.freeze({ realm, levelId, tier, moves, par, eventId, completionId: eventId });
}

export function normalizeCompletionPayload(candidate, context = {}) {
  if (!candidate || typeof candidate !== "object") return null;
  if (candidate.eventId !== candidate.completionId || !safeEvent(candidate.eventId)
      || candidate.realm !== context.realm || candidate.levelId !== context.levelId || candidate.tier !== context.tier || candidate.par !== context.par) return null;
  const prefix = `${candidate.realm}:${candidate.levelId}:`;
  const suffix = ":complete";
  if (!candidate.eventId.startsWith(prefix) || !candidate.eventId.endsWith(suffix)) return null;
  const runId = candidate.eventId.slice(prefix.length, -suffix.length);
  return buildCompletionPayload({
    realm: candidate.realm,
    levelId: candidate.levelId,
    tier: candidate.tier,
    moves: candidate.moves,
    par: candidate.par,
    runId,
  });
}

export function normalizeCompletionOutbox(candidate, context) {
  if (!Array.isArray(candidate)) return Object.freeze([]);
  const seen = new Set(); const clean = [];
  for (const item of candidate.slice(-MAX_COMPLETION_OUTBOX)) {
    const payload = normalizeCompletionPayload(item, context);
    if (!payload || seen.has(payload.eventId)) continue;
    seen.add(payload.eventId); clean.push(payload);
  }
  return Object.freeze(clean);
}

export function enqueueCompletion(outbox, payload, context) {
  const current = normalizeCompletionOutbox(outbox, context);
  const clean = normalizeCompletionPayload(payload, context);
  if (!clean || current.some((item) => item.eventId === clean.eventId)) return current;
  return Object.freeze([...current, clean].slice(-MAX_COMPLETION_OUTBOX));
}

export function acknowledgeCompletion(outbox, eventId, context) {
  if (!safeEvent(eventId)) return normalizeCompletionOutbox(outbox, context);
  return Object.freeze(normalizeCompletionOutbox(outbox, context).filter((item) => item.eventId !== eventId));
}
