import { applyLink, clearAlgebraicChain, clearCell, createPosition, evaluatePosition, linksOf } from "./logic.mjs";
import { findLevel } from "./levels.mjs";

export const GAME_ID = "time-sand-post";
export const COMPLETION_EVENT = "ten-realms-v3:game-complete";
export const COMPLETION_SCHEMA = "ten-realms-v3.game-complete";
export const COMPLETION_QUEUE = "__realmCompletionQueue";

const transportByTarget = new WeakMap();
const SAFE_RUN_ID = /^(?=[a-z0-9-]{12,160}$)(?=.*[a-z])[a-z0-9-]+$/i;
const SAFE_LEVEL_ID = /^(?!__proto__$|prototype$|constructor$)[a-z0-9][a-z0-9-]{2,63}$/;
const MAX_TIMELINE = 4096;

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeRunId(value) {
  return typeof value === "string"
    && !["__proto__", "prototype", "constructor"].includes(value)
    && SAFE_RUN_ID.test(value);
}

function count(value, maximum = 1_000_000) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactKeys(value, expected) {
  return plainObject(value) && sameJson(Object.keys(value).sort(), [...expected].sort());
}

export function normalizeTimeline(level, value) {
  const total = level?.width * level?.height;
  if (!Number.isSafeInteger(total) || !Array.isArray(value) || value.length > MAX_TIMELINE) return null;
  const timeline = [];
  for (const action of value) {
    if (action?.type === "link" && exactKeys(action, ["type", "from", "to"])
        && count(action.from, total - 1) && count(action.to, total - 1) && action.from !== action.to) {
      timeline.push(Object.freeze({ type: "link", from: action.from, to: action.to }));
    } else if (action?.type === "clear" && exactKeys(action, ["type", "cell"])
        && count(action.cell, total - 1)) {
      timeline.push(Object.freeze({ type: "clear", cell: action.cell }));
    } else if (action?.type === "clear-chain" && exactKeys(action, ["type", "cell"])
        && count(action.cell, total - 1)) {
      timeline.push(Object.freeze({ type: "clear-chain", cell: action.cell }));
    } else {
      return null;
    }
  }
  return Object.freeze(timeline);
}

export function replayTimeline(level, value) {
  const timeline = normalizeTimeline(level, value);
  if (!timeline) return null;
  let position = createPosition(level);
  for (const action of timeline) {
    const result = action.type === "link"
      ? applyLink(level, position, action.from, action.to)
      : action.type === "clear-chain"
        ? clearAlgebraicChain(level, position, action.cell)
        : clearCell(level, position, action.cell);
    if (!result.changed) return null;
    position = result.position;
  }
  const evaluation = evaluatePosition(level, position);
  return Object.freeze({
    timeline,
    position,
    evaluation,
    edges: Object.freeze(linksOf(position).map(([from, to]) => Object.freeze([from, to]))),
  });
}

function normalizeEdges(level, value) {
  const total = level.width * level.height;
  if (!Array.isArray(value) || value.length > total - 1) return null;
  const output = [];
  for (const edge of value) {
    if (!Array.isArray(edge) || edge.length !== 2
        || !count(edge[0], total - 1) || !count(edge[1], total - 1) || edge[0] === edge[1]) return null;
    output.push(Object.freeze([edge[0], edge[1]]));
  }
  return Object.freeze(output);
}

export function normalizeCompletion(payload) {
  if (!plainObject(payload) || payload.schema !== COMPLETION_SCHEMA || payload.schemaVersion !== 1
      || payload.gameId !== GAME_ID || payload.realm !== GAME_ID || !safeRunId(payload.runId)
      || payload.eventId !== `${GAME_ID}:${payload.runId}:complete`
      || !SAFE_LEVEL_ID.test(payload.levelId ?? "") || !count(payload.elapsedMs)
      || !count(payload.moves, MAX_TIMELINE) || payload.moves < 1
      || typeof payload.completedAt !== "string" || payload.completedAt.length > 40) return null;
  const completedAt = Date.parse(payload.completedAt);
  if (!Number.isFinite(completedAt)) return null;
  const level = findLevel(payload.levelId);
  if (!level || payload.difficulty !== level.difficulty || payload.tier !== level.tier
      || payload.seed !== level.seed || payload.par !== level.par) return null;
  const replay = replayTimeline(level, payload.timeline);
  const edges = normalizeEdges(level, payload.edges);
  if (!replay || !replay.evaluation.complete || replay.timeline.length !== payload.moves
      || !edges || !sameJson(edges, replay.edges)) return null;
  return Object.freeze({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId: payload.runId,
    eventId: `${GAME_ID}:${payload.runId}:complete`,
    levelId: level.id,
    difficulty: level.difficulty,
    tier: level.tier,
    seed: level.seed,
    moves: replay.timeline.length,
    par: level.par,
    elapsedMs: payload.elapsedMs,
    timeline: replay.timeline,
    edges,
    completedAt: new Date(completedAt).toISOString(),
  });
}

export function validCompletion(payload) {
  return normalizeCompletion(payload) !== null;
}

export function createCompletion(level, runId, summary = {}, completedAt = new Date()) {
  const canonicalLevel = findLevel(level?.id);
  const timestamp = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const replay = canonicalLevel ? replayTimeline(canonicalLevel, summary.timeline) : null;
  if (!canonicalLevel || canonicalLevel !== level || !replay?.evaluation.complete
      || !Number.isFinite(timestamp.getTime())) {
    throw new TypeError("Completion requires an official level and a replayable solved timeline");
  }
  const payload = normalizeCompletion({
    schema: COMPLETION_SCHEMA,
    schemaVersion: 1,
    gameId: GAME_ID,
    realm: GAME_ID,
    runId,
    eventId: `${GAME_ID}:${runId}:complete`,
    levelId: canonicalLevel.id,
    difficulty: canonicalLevel.difficulty,
    tier: canonicalLevel.tier,
    seed: canonicalLevel.seed,
    moves: summary.moves,
    par: canonicalLevel.par,
    elapsedMs: summary.elapsedMs,
    timeline: replay.timeline,
    edges: summary.edges ?? replay.edges,
    completedAt: timestamp.toISOString(),
  });
  if (!payload) throw new TypeError("Completion proof does not match the official solved run");
  return payload;
}

function retainInQueue(target, payload) {
  try {
    const current = Array.isArray(target[COMPLETION_QUEUE]) ? target[COMPLETION_QUEUE] : [];
    const valid = current.map(normalizeCompletion).filter(Boolean);
    const existing = valid.find((entry) => entry.eventId === payload.eventId);
    target[COMPLETION_QUEUE] = [...valid.filter((entry) => entry.eventId !== payload.eventId), existing ?? payload];
    return true;
  } catch {
    return false;
  }
}

function removeQueueHint(target, eventId) {
  try {
    if (!Array.isArray(target[COMPLETION_QUEUE])) return;
    target[COMPLETION_QUEUE] = target[COMPLETION_QUEUE].filter((entry) => entry?.eventId !== eventId);
  } catch {
    // A confirmed host API remains authoritative even if its hint queue is sealed.
  }
}

function observeOnce(target, payload, known) {
  if (known.has(payload.eventId)) return;
  try {
    const EventType = target.CustomEvent ?? globalThis.CustomEvent;
    if (typeof EventType === "function" && typeof target.dispatchEvent === "function") {
      target.dispatchEvent(new EventType(COMPLETION_EVENT, { detail: payload }));
    }
  } catch {
    // Observation never confirms or invalidates durable delivery.
  }
}

/** Only a successful host API call confirms delivery; queue and DOM are hints. */
export function deliverCompletion(target, value) {
  const payload = normalizeCompletion(value);
  if ((!target || (typeof target !== "object" && typeof target !== "function")) || !payload) {
    return Object.freeze({ retained: false, confirmed: false, transport: null });
  }
  const known = transportByTarget.get(target) ?? new Map();
  const previous = known.get(payload.eventId);
  if (["native-v3", "realm-arcade"].includes(previous)) {
    return Object.freeze({ retained: true, confirmed: true, transport: previous });
  }

  let transport = null;
  for (const [name, owner] of [["native-v3", target.TenRealmsV3], ["realm-arcade", target.RealmArcade]]) {
    try {
      if (typeof owner?.complete !== "function") continue;
      owner.complete(payload);
      transport = name;
      break;
    } catch {
      // Try the compatible API before falling back to a hint queue.
    }
  }

  if (transport) {
    observeOnce(target, payload, known);
    known.set(payload.eventId, transport);
    transportByTarget.set(target, known);
    removeQueueHint(target, payload.eventId);
    return Object.freeze({ retained: true, confirmed: true, transport });
  }

  const retained = retainInQueue(target, payload);
  if (!retained) return Object.freeze({ retained: false, confirmed: false, transport: null });
  observeOnce(target, payload, known);
  known.set(payload.eventId, "queue");
  transportByTarget.set(target, known);
  return Object.freeze({ retained: true, confirmed: false, transport: "queue" });
}

export function completionTransport(target, eventId) {
  return transportByTarget.get(target)?.get(eventId) ?? null;
}
