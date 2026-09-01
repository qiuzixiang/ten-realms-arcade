import { LEVELS } from "./levels.mjs";
import { analyse, replayColourTimeline } from "./logic.mjs";
import { readJsonResult, STORAGE_KEYS, writeJson } from "./storage.mjs";

export const GAME_ID = "four-spirit-habitat";
export const COMPLETION_QUEUE = "__realmCompletionQueue";

const text = (value, max = 160) => typeof value === "string" && value.length > 0 && value.length <= max ? value : "";
const count = (value) => Number.isInteger(value) && value >= 0 && value <= 1_000_000;

export function validCompletion(payload) {
  const level = LEVELS.find(({ id }) => id === payload?.levelId);
  const replayed = level ? replayColourTimeline(level, payload?.timeline) : null;
  return Boolean(level)
    && payload.gameId === GAME_ID
    && payload.realm === GAME_ID
    && /^run-[a-z0-9-]{3,80}$/i.test(payload.runId ?? "")
    && payload.eventId === `${GAME_ID}:${payload.runId}:complete`
    && payload.tier === level.tier
    && payload.difficulty === level.difficulty
    && count(payload.moves)
    && payload.moves > 0
    && replayed?.moves === payload.moves
    && analyse(replayed, level).solved
    && payload.par === level.par
    && text(payload.completedAt, 40)
    && !Number.isNaN(Date.parse(payload.completedAt));
}

export function createCompletion(level, session, completedAt = new Date()) {
  const iso = completedAt instanceof Date ? completedAt.toISOString() : new Date(completedAt).toISOString();
  const payload = {
    gameId: GAME_ID,
    realm: GAME_ID,
    levelId: level.id,
    tier: level.tier,
    difficulty: level.difficulty,
    moves: session.state.moves,
    par: level.par,
    runId: session.runId,
    eventId: `${GAME_ID}:${session.runId}:complete`,
    timeline: session.timeline?.map(({ region, colour }) => ({ region, colour })),
    completedAt: iso,
  };
  const replayed = replayColourTimeline(level, payload.timeline);
  if (!replayed
    || !analyse(session.state, level).solved
    || replayed.colours.some((colour, region) => colour !== session.state.colours[region])) {
    throw new TypeError("Completion requires a replayable solved session.");
  }
  if (!validCompletion(payload)) throw new TypeError("Completion requires a canonical level, run, score, and timestamp.");
  return Object.freeze({
    ...payload,
    timeline: Object.freeze(payload.timeline.map((action) => Object.freeze({ ...action }))),
  });
}

function cleanOutbox(candidate) {
  const unique = new Map();
  for (const item of Array.isArray(candidate) ? candidate : []) {
    if (validCompletion(item)) unique.set(item.eventId, Object.freeze({
      ...item,
      timeline: Object.freeze(item.timeline.map((action) => Object.freeze({ ...action }))),
    }));
  }
  return [...unique.values()];
}

export function loadCompletionOutbox(storage = undefined) {
  return readOutbox(storage).outbox;
}

export function enqueueCompletion(storage, payload) {
  const loaded = readOutbox(storage);
  if (!validCompletion(payload) || !loaded.available) return { retained: false, outbox: loaded.outbox };
  const outbox = cleanOutbox([...loaded.outbox, payload]);
  return { retained: writeJson(STORAGE_KEYS.outbox, outbox, storage), outbox };
}

export function removeCompletion(storage, eventId) {
  const loaded = readOutbox(storage);
  if (!loaded.available) return { removed: false, outbox: loaded.outbox };
  const outbox = loaded.outbox.filter((item) => item.eventId !== eventId);
  return { removed: writeJson(STORAGE_KEYS.outbox, outbox, storage), outbox };
}

function readOutbox(storage) {
  const loaded = readJsonResult(STORAGE_KEYS.outbox, [], storage);
  return { outbox: cleanOutbox(loaded.value), available: loaded.available };
}

function retainQueue(target, payload) {
  try {
    const queue = Array.isArray(target?.[COMPLETION_QUEUE]) ? target[COMPLETION_QUEUE] : [];
    target[COMPLETION_QUEUE] = [...queue.filter((item) => item?.eventId !== payload.eventId), payload];
    return true;
  } catch {
    return false;
  }
}

export function deliverCompletion(target, payload) {
  if ((!target || (typeof target !== "object" && typeof target !== "function")) || !validCompletion(payload)) {
    return Object.freeze({ delivered: false, queued: false });
  }
  try {
    if (typeof target.RealmArcade?.complete === "function") {
      target.RealmArcade.complete(payload);
      if (Array.isArray(target[COMPLETION_QUEUE])) {
        target[COMPLETION_QUEUE] = target[COMPLETION_QUEUE].filter((item) => item?.eventId !== payload.eventId);
      }
      return Object.freeze({ delivered: true, queued: false });
    }
  } catch {
    // The durable game outbox remains authoritative while the compatibility
    // queue lets a late shared bootstrap consume this same stable event.
  }
  return Object.freeze({ delivered: false, queued: retainQueue(target, payload) });
}

export function knownLevelIds() {
  return Object.freeze(LEVELS.map(({ id }) => id));
}
