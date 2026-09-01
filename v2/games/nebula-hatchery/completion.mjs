export const REALM_ID = "nebula-hatchery";

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,95}$/i;
const PAYLOAD_KEYS = Object.freeze(["eventId", "levelId", "tier", "moves", "par"]);
const EVENT_ID_PATTERN = /^nebula-hatchery:([a-z0-9][a-z0-9-]{7,95}):complete$/i;
let fallbackRunCounter = 0;

export function isNebulaRunId(value) {
  return typeof value === "string" && RUN_ID_PATTERN.test(value);
}

export function createNebulaRunId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  try {
    const candidate = randomUUID?.();
    if (isNebulaRunId(candidate)) return candidate;
  } catch {
    // Fall through when randomUUID is unavailable in a restricted frame.
  }
  fallbackRunCounter = (fallbackRunCounter + 1) % 0x100000;
  return `run-${Date.now().toString(36)}-${fallbackRunCounter.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function nebulaCompletionEventId(runId) {
  if (!isNebulaRunId(runId)) throw new TypeError("A valid nebula run id is required.");
  return `${REALM_ID}:${runId}:complete`;
}

function validDetails(details) {
  return details
    && typeof details === "object"
    && typeof details.levelId === "string"
    && /^[a-z0-9:_-]{1,80}$/i.test(details.levelId)
    && Number.isSafeInteger(details.tier)
    && details.tier >= 1
    && details.tier <= 3
    && Number.isSafeInteger(details.moves)
    && details.moves >= 0
    && Number.isSafeInteger(details.par)
    && details.par >= 0;
}

function payloadFor(tracking, details) {
  if (!validDetails(details)) throw new TypeError("Valid completion details are required.");
  return {
    eventId: tracking.completionEventId,
    levelId: details.levelId,
    tier: details.tier,
    moves: details.moves,
    par: details.par,
  };
}

function validCompletionPayload(candidate) {
  return candidate
    && typeof candidate === "object"
    && !Array.isArray(candidate)
    && Object.keys(candidate).length === PAYLOAD_KEYS.length
    && typeof candidate.eventId === "string"
    && EVENT_ID_PATTERN.test(candidate.eventId)
    && typeof candidate.levelId === "string"
    && /^[a-z0-9:_-]{1,80}$/i.test(candidate.levelId)
    && Number.isSafeInteger(candidate.tier)
    && candidate.tier >= 1
    && candidate.tier <= 3
    && Number.isSafeInteger(candidate.moves)
    && candidate.moves >= 0
    && candidate.moves <= 10_000_000
    && Number.isSafeInteger(candidate.par)
    && candidate.par >= 0
    && candidate.par <= 10_000_000;
}

export function normalizeNebulaOutbox(candidate) {
  const source = candidate == null ? [] : Array.isArray(candidate) ? candidate : [candidate];
  if (source.some((payload) => !validCompletionPayload(payload))) return null;
  const seen = new Set();
  const clean = [];
  for (const payload of source) {
    if (seen.has(payload.eventId)) continue;
    seen.add(payload.eventId);
    clean.push({ ...payload });
  }
  return clean;
}

export function enqueueNebulaCompletion(queue, payload) {
  if (!Array.isArray(queue) || !validCompletionPayload(payload)) return false;
  if (queue.some((item) => item?.eventId === payload.eventId)) return false;
  queue.push({ ...payload });
  return true;
}

function appendCompletion(outbox, payload) {
  if (!payload || outbox.some((item) => item.eventId === payload.eventId)) return outbox;
  return [...outbox, payload];
}

export function createNebulaCompletionTracking(options = {}) {
  const runId = isNebulaRunId(options.runId) ? options.runId : createNebulaRunId();
  const completionOutbox = normalizeNebulaOutbox(options.completionOutbox) ?? [];
  return {
    runId,
    completionEventId: nebulaCompletionEventId(runId),
    completionOutbox,
    completionReported: false,
  };
}

export function restoreNebulaCompletionTracking(candidate, details = null) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  if (!isNebulaRunId(candidate.runId)) return null;
  const eventId = nebulaCompletionEventId(candidate.runId);
  if (candidate.completionEventId !== eventId || typeof candidate.completionReported !== "boolean") return null;
  let completionOutbox = normalizeNebulaOutbox(candidate.completionOutbox);
  if (!completionOutbox) return null;
  if (candidate.completionReported) {
    completionOutbox = completionOutbox.filter((payload) => payload.eventId !== eventId);
  }
  return { ...candidate, completionOutbox };
}

export function stageNebulaCompletion(tracking, details) {
  const restored = restoreNebulaCompletionTracking(tracking);
  if (!restored) throw new TypeError("Invalid nebula completion tracking.");
  let completionOutbox = restored.completionOutbox;
  if (restored.completionReported) {
    completionOutbox = completionOutbox.filter((payload) => payload.eventId !== restored.completionEventId);
  } else {
    completionOutbox = appendCompletion(completionOutbox, payloadFor(restored, details));
  }
  return { ...tracking, completionOutbox };
}

export function confirmNebulaCompletion(tracking, reportCompletion) {
  if (!tracking || tracking.completionOutbox.length === 0 || typeof reportCompletion !== "function") {
    return {
      tracking,
      attempted: false,
      succeeded: tracking?.completionOutbox?.length === 0,
      reward: null,
      deliveredEventIds: [],
    };
  }
  const remaining = [...tracking.completionOutbox];
  const deliveredEventIds = [];
  let completionReported = tracking.completionReported;
  let reward = null;
  let failed = false;
  while (remaining.length > 0) {
    const payload = remaining[0];
    try {
      const result = reportCompletion(payload);
      if (result === false) {
        failed = true;
        break;
      }
      remaining.shift();
      deliveredEventIds.push(payload.eventId);
      if (payload.eventId === tracking.completionEventId) {
        completionReported = true;
        reward = result;
      }
    } catch {
      failed = true;
      break;
    }
  }
  return {
    tracking: { ...tracking, completionReported, completionOutbox: remaining },
    attempted: true,
    succeeded: !failed,
    reward,
    deliveredEventIds,
  };
}

export function recordNebulaAtlasCompletion(candidate, level, run = {}) {
  const atlas = {
    completed: new Set(candidate?.completed instanceof Set ? candidate.completed : []),
    rarities: new Set(candidate?.rarities instanceof Set ? candidate.rarities : []),
    badges: {
      zeroConflict: candidate?.badges?.zeroConflict === true,
      intuition: candidate?.badges?.intuition === true,
    },
  };
  const discoveries = [];
  if (!level || typeof level.id !== "string" || !Array.isArray(level.cores)) return { atlas, discoveries };
  if (!atlas.completed.has(level.id)) {
    atlas.completed.add(level.id);
    discoveries.push(level.title || level.id);
  }
  for (const core of level.cores) {
    if (typeof core?.rarity !== "string" || atlas.rarities.has(core.rarity)) continue;
    atlas.rarities.add(core.rarity);
    discoveries.push(`${core.rarity}星核`);
  }
  if (run.hadConflict !== true && !atlas.badges.zeroConflict) {
    atlas.badges.zeroConflict = true;
    discoveries.push("零矛盾孵化徽章");
  }
  if (run.usedNotes !== true && !atlas.badges.intuition) {
    atlas.badges.intuition = true;
    discoveries.push("对称直觉徽章");
  }
  return { atlas, discoveries };
}
