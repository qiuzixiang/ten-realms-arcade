import {
  STORAGE_KEYS,
  normalizeRunId,
  readProfileDocument,
  removeOwned,
  writeProfileDocument,
} from "./persistence.mjs";
import { completionEventIdForRun, normalizeCompletionDetail } from "./completion-bridge.mjs";
import { evaluatePosition, normalizePosition, positionToJSON } from "./logic.mjs";

export const GAME_ID = "aurora-magnet-lab";
export const PROFILE_VERSION = 1;
export const COMPLETION_EVENT = "ten-realms-v2:game-complete";
export const READY_EVENT = "ten-realms-v2:game-ready";
export const DELIVERY_STATE = Object.freeze({
  UNSTAGED: "unstaged",
  STAGED: "staged",
  CONFIRMED: "confirmed",
});
const DELIVERY_RANK = Object.freeze({ unstaged: 0, staged: 1, confirmed: 2 });
export const DIFFICULTY_TIER = Object.freeze({
  calibration: 1,
  survey: 2,
  storm: 3,
});

export function completionRunIsDurable(complete, settlement) {
  if (complete !== true) return true;
  return Boolean(
    settlement
    && Object.hasOwn(DELIVERY_RANK, settlement.deliveryState)
    && settlement.deliveryState !== DELIVERY_STATE.UNSTAGED
  );
}

export function createProfile() {
  return {
    version: PROFILE_VERSION,
    records: {},
    spectrum: {},
    rewardLedger: {},
    settlements: {},
    totalClears: 0,
    updatedAt: null,
  };
}

function validTimestamp(value) {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function validEarnedTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function legacyCompletionEventId(puzzleId, clearOrdinal, moves) {
  if (typeof puzzleId !== "string" || !puzzleId || !Number.isInteger(clearOrdinal) || clearOrdinal < 1
      || !Number.isInteger(moves) || moves < 1) {
    throw new TypeError("Legacy Aurora completion identity requires puzzle, ordinal, and moves.");
  }
  return `${GAME_ID}:completion:${puzzleId}:${clearOrdinal}:${moves}`;
}

function normalizeSolvedPosition(puzzle, value) {
  if (!isPlainObject(value)) return null;
  const position = normalizePosition(puzzle, value);
  return evaluatePosition(puzzle, position).complete ? positionToJSON(position) : null;
}

export function normalizeProfile(value, puzzles) {
  if (!value || value.version !== PROFILE_VERSION) return null;
  if (
    !isPlainObject(value.records)
    || !isPlainObject(value.spectrum)
    || !isPlainObject(value.rewardLedger)
    || (value.settlements !== undefined && !isPlainObject(value.settlements))
  ) return null;
  if (!Number.isInteger(value.totalClears) || value.totalClears < 0 || !validTimestamp(value.updatedAt ?? null)) return null;
  const known = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));
  const records = {};
  for (const [puzzleId, record] of Object.entries(value.records)) {
    if (!known.has(puzzleId) || !isPlainObject(record)) return null;
    if (!Number.isInteger(record.clears) || record.clears < 1) return null;
    if (!Number.isInteger(record.bestMoves) || record.bestMoves < 1) return null;
    if (!Number.isInteger(record.bestConflictMoves) || record.bestConflictMoves < 0) return null;
    if (typeof record.zeroConflict !== "boolean" || typeof record.stormCaptured !== "boolean") return null;
    if (!validEarnedTimestamp(record.firstClearedAt) || !validEarnedTimestamp(record.lastClearedAt)) return null;
    records[puzzleId] = {
      clears: record.clears,
      bestMoves: record.bestMoves,
      bestConflictMoves: record.bestConflictMoves,
      zeroConflict: record.zeroConflict,
      stormCaptured: record.stormCaptured,
      firstClearedAt: record.firstClearedAt,
      lastClearedAt: record.lastClearedAt,
    };
  }
  const spectrum = {};
  for (const [spectrumId, entry] of Object.entries(value.spectrum)) {
    if (!isPlainObject(entry) || !known.has(entry.puzzleId) || known.get(entry.puzzleId).spectrum !== spectrumId) return null;
    if (!validEarnedTimestamp(entry.unlockedAt)) return null;
    spectrum[spectrumId] = { puzzleId: entry.puzzleId, unlockedAt: entry.unlockedAt };
  }
  const rewardLedger = {};
  for (const [id, entry] of Object.entries(value.rewardLedger)) {
    if (!id.startsWith(`${GAME_ID}:`) || !isPlainObject(entry) || typeof entry.kind !== "string") return null;
    if (!known.has(entry.puzzleId) || !validEarnedTimestamp(entry.earnedAt)) return null;
    rewardLedger[id] = { id, kind: entry.kind, puzzleId: entry.puzzleId, earnedAt: entry.earnedAt };
  }
  if (Object.values(records).reduce((sum, record) => sum + record.clears, 0) !== value.totalClears) return null;

  const settlementSource = value.settlements ?? Object.fromEntries(
    Object.entries(records).flatMap(([puzzleId, record]) => {
      const rewardIds = Object.keys(rewardLedger).filter((id) => rewardLedger[id].puzzleId === puzzleId);
      return Array.from({ length: record.clears }, (_, index) => {
        const clearOrdinal = index + 1;
        return [
          `${GAME_ID}:attempt:legacy:${puzzleId}:${clearOrdinal}`,
          {
            puzzleId,
            moves: record.bestMoves,
            conflictMoves: record.bestConflictMoves,
            earnedAt: clearOrdinal === 1 ? record.firstClearedAt : record.lastClearedAt,
            rewardIds: clearOrdinal === 1 ? rewardIds : [],
            firstClear: clearOrdinal === 1,
            personalBest: clearOrdinal === 1,
            previousBestMoves: clearOrdinal === 1 ? null : record.bestMoves,
            bestMoves: record.bestMoves,
            clearOrdinal,
            zeroConflict: record.bestConflictMoves === 0,
            eventId: legacyCompletionEventId(puzzleId, clearOrdinal, record.bestMoves),
            legacyEventIdUnknown: true,
            undos: 0,
            elapsedMs: 0,
            finalPosition: null,
            deliveryState: DELIVERY_STATE.CONFIRMED,
          },
        ];
      });
    }),
  );

  const settlements = {};
  const referencedRewards = new Set();
  const settlementCountByPuzzle = new Map();
  const eventIds = new Set();
  for (const [attemptId, entry] of Object.entries(settlementSource)) {
    if (!attemptId.startsWith(`${GAME_ID}:attempt:`) || !isPlainObject(entry) || !known.has(entry.puzzleId)) return null;
    if (!Number.isInteger(entry.moves) || entry.moves < 1) return null;
    if (!Number.isInteger(entry.conflictMoves) || entry.conflictMoves < 0 || entry.conflictMoves > entry.moves) return null;
    if (!validEarnedTimestamp(entry.earnedAt) || !Array.isArray(entry.rewardIds)) return null;
    if (new Set(entry.rewardIds).size !== entry.rewardIds.length) return null;
    if (entry.rewardIds.some((id) => typeof id !== "string" || rewardLedger[id]?.puzzleId !== entry.puzzleId)) return null;
    if (typeof entry.firstClear !== "boolean" || typeof entry.personalBest !== "boolean" || typeof entry.zeroConflict !== "boolean") return null;
    if (entry.zeroConflict !== (entry.conflictMoves === 0)) return null;
    if (!Number.isInteger(entry.bestMoves) || entry.bestMoves < 1 || entry.bestMoves > entry.moves) return null;
    if (entry.previousBestMoves !== null && (!Number.isInteger(entry.previousBestMoves) || entry.previousBestMoves < 1)) return null;
    if (!Number.isInteger(entry.clearOrdinal) || entry.clearOrdinal < 1) return null;
    if (entry.firstClear !== (entry.clearOrdinal === 1) || !records[entry.puzzleId] || entry.clearOrdinal > records[entry.puzzleId].clears) return null;
    if (entry.personalBest && entry.bestMoves !== entry.moves) return null;
    const runId = entry.runId === undefined ? "" : normalizeRunId(entry.runId);
    if (entry.runId !== undefined && !runId) return null;
    const eventId = typeof entry.eventId === "string" && entry.eventId
      ? entry.eventId
      : (runId
        ? completionEventIdForRun(runId)
        : legacyCompletionEventId(entry.puzzleId, entry.clearOrdinal, entry.moves));
    if (!eventId.startsWith(`${GAME_ID}:completion:`) || eventIds.has(eventId)) return null;
    if (runId && eventId !== completionEventIdForRun(runId) && !runId.startsWith("legacy-")) return null;
    const undos = entry.undos === undefined ? 0 : entry.undos;
    const elapsedMs = entry.elapsedMs === undefined ? 0 : entry.elapsedMs;
    if (!Number.isInteger(undos) || undos < 0 || !Number.isInteger(elapsedMs) || elapsedMs < 0) return null;
    const finalPosition = entry.finalPosition === undefined || entry.finalPosition === null
      ? null
      : normalizeSolvedPosition(known.get(entry.puzzleId), entry.finalPosition);
    if (entry.finalPosition !== undefined && entry.finalPosition !== null && !finalPosition) return null;
    const deliveryState = Object.hasOwn(DELIVERY_RANK, entry.deliveryState)
      ? entry.deliveryState
      : (runId ? DELIVERY_STATE.UNSTAGED : DELIVERY_STATE.CONFIRMED);
    const legacyEventIdUnknown = entry.legacyEventIdUnknown === true;

    entry.rewardIds.forEach((id) => referencedRewards.add(id));
    eventIds.add(eventId);
    settlementCountByPuzzle.set(entry.puzzleId, (settlementCountByPuzzle.get(entry.puzzleId) ?? 0) + 1);
    settlements[attemptId] = {
      puzzleId: entry.puzzleId,
      moves: entry.moves,
      undos,
      conflictMoves: entry.conflictMoves,
      elapsedMs,
      earnedAt: entry.earnedAt,
      rewardIds: [...entry.rewardIds],
      firstClear: entry.firstClear,
      personalBest: entry.personalBest,
      previousBestMoves: entry.previousBestMoves,
      bestMoves: entry.bestMoves,
      clearOrdinal: entry.clearOrdinal,
      zeroConflict: entry.zeroConflict,
      eventId,
      legacyEventIdUnknown,
      finalPosition,
      deliveryState,
      ...(runId ? { runId } : {}),
    };
  }
  if (Object.keys(settlements).length !== value.totalClears) return null;
  if (Object.keys(rewardLedger).some((id) => !referencedRewards.has(id))) return null;
  for (const [puzzleId, record] of Object.entries(records)) {
    if ((settlementCountByPuzzle.get(puzzleId) ?? 0) !== record.clears) return null;
  }
  return {
    version: PROFILE_VERSION,
    records,
    spectrum,
    rewardLedger,
    settlements,
    totalClears: value.totalClears,
    updatedAt: value.updatedAt ?? null,
  };
}

export function loadProfile(storage, puzzles) {
  const read = readProfileDocument(storage);
  if (!read.available) return { profile: createProfile(), available: false, restored: false };
  if (read.value === null) {
    if (read.corrupted) removeOwned(storage, STORAGE_KEYS.profile);
    return { profile: createProfile(), available: true, restored: false, corrupted: read.corrupted };
  }
  const profile = normalizeProfile(read.value, puzzles);
  if (!profile) {
    removeOwned(storage, STORAGE_KEYS.profile);
    return { profile: createProfile(), available: true, restored: false, corrupted: true };
  }
  return { profile, available: true, restored: true, corrupted: false };
}

function earlierEntry(left, right, timestampField) {
  if (!left) return { ...right };
  if (!right) return { ...left };
  const leftTime = Date.parse(left[timestampField]);
  const rightTime = Date.parse(right[timestampField]);
  return { ...(rightTime < leftTime ? right : left) };
}

function mergeSettlement(left, right) {
  if (!left) return { ...right, rewardIds: [...right.rewardIds], finalPosition: right.finalPosition ? JSON.parse(JSON.stringify(right.finalPosition)) : null };
  if (!right) return { ...left, rewardIds: [...left.rewardIds], finalPosition: left.finalPosition ? JSON.parse(JSON.stringify(left.finalPosition)) : null };
  if (left.legacyEventIdUnknown && !right.legacyEventIdUnknown) {
    return { ...right };
  }
  if (right.legacyEventIdUnknown && !left.legacyEventIdUnknown) {
    return { ...left };
  }
  if (!left.runId && right.runId?.startsWith("legacy-")) return { ...right };
  if (!right.runId && left.runId?.startsWith("legacy-")) return { ...left };
  const omitMutable = (entry) => {
    const copy = { ...entry };
    delete copy.deliveryState;
    delete copy.runId;
    delete copy.finalPosition;
    return copy;
  };
  if (!sameJson(omitMutable(left), omitMutable(right))) return null;
  if (left.runId && right.runId && left.runId !== right.runId) return null;
  if (left.finalPosition && right.finalPosition && !sameJson(left.finalPosition, right.finalPosition)) return null;
  return {
    ...left,
    ...(left.runId || right.runId ? { runId: left.runId ?? right.runId } : {}),
    finalPosition: left.finalPosition ?? right.finalPosition ?? null,
    deliveryState: DELIVERY_RANK[left.deliveryState] >= DELIVERY_RANK[right.deliveryState]
      ? left.deliveryState
      : right.deliveryState,
  };
}

export function mergeProfiles(leftInput, rightInput, puzzles) {
  const left = normalizeProfile(leftInput, puzzles);
  const right = normalizeProfile(rightInput, puzzles);
  if (!left || !right) return null;
  const known = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));
  const settlements = {};
  for (const attemptId of new Set([...Object.keys(left.settlements), ...Object.keys(right.settlements)])) {
    const merged = mergeSettlement(left.settlements[attemptId], right.settlements[attemptId]);
    if (!merged) return null;
    settlements[attemptId] = merged;
  }

  const rewardLedger = {};
  for (const id of new Set([...Object.keys(left.rewardLedger), ...Object.keys(right.rewardLedger)])) {
    const first = left.rewardLedger[id];
    const second = right.rewardLedger[id];
    if (first && second && (first.kind !== second.kind || first.puzzleId !== second.puzzleId)) return null;
    rewardLedger[id] = earlierEntry(first, second, "earnedAt");
  }
  const spectrum = {};
  for (const id of new Set([...Object.keys(left.spectrum), ...Object.keys(right.spectrum)])) {
    const first = left.spectrum[id];
    const second = right.spectrum[id];
    if (first && second && first.puzzleId !== second.puzzleId) return null;
    spectrum[id] = earlierEntry(first, second, "unlockedAt");
  }

  const grouped = new Map();
  for (const settlement of Object.values(settlements)) {
    const entries = grouped.get(settlement.puzzleId) ?? [];
    entries.push(settlement);
    grouped.set(settlement.puzzleId, entries);
  }
  const records = {};
  for (const [puzzleId, entries] of grouped) {
    const puzzle = known.get(puzzleId);
    if (!puzzle) return null;
    const times = entries.map((entry) => entry.earnedAt).sort();
    records[puzzleId] = {
      clears: entries.length,
      bestMoves: Math.min(...entries.map((entry) => entry.moves)),
      bestConflictMoves: Math.min(...entries.map((entry) => entry.conflictMoves)),
      zeroConflict: entries.some((entry) => entry.zeroConflict),
      stormCaptured: Boolean(puzzle.storm),
      firstClearedAt: times[0],
      lastClearedAt: times[times.length - 1],
    };
  }
  const updatedAt = [left.updatedAt, right.updatedAt].filter(Boolean).sort().at(-1) ?? null;
  return normalizeProfile({
    version: PROFILE_VERSION,
    records,
    spectrum,
    rewardLedger,
    settlements,
    totalClears: Object.keys(settlements).length,
    updatedAt,
  }, puzzles);
}

export function saveProfile(storage, profile, puzzles) {
  const proposed = normalizeProfile(profile, puzzles);
  if (!proposed) return false;
  const read = readProfileDocument(storage);
  if (!read.available || read.corrupted) return false;
  if (read.value === null) return writeProfileDocument(storage, proposed);
  const current = normalizeProfile(read.value, puzzles);
  if (!current) return false;
  const merged = mergeProfiles(current, proposed, puzzles);
  return merged ? writeProfileDocument(storage, merged) : false;
}

function cloneProfile(profile) {
  return {
    version: PROFILE_VERSION,
    records: Object.fromEntries(Object.entries(profile.records).map(([id, record]) => [id, { ...record }])),
    spectrum: Object.fromEntries(Object.entries(profile.spectrum).map(([id, entry]) => [id, { ...entry }])),
    rewardLedger: Object.fromEntries(Object.entries(profile.rewardLedger).map(([id, entry]) => [id, { ...entry }])),
    settlements: Object.fromEntries(Object.entries(profile.settlements).map(([id, entry]) => [id, {
      ...entry,
      rewardIds: [...entry.rewardIds],
      finalPosition: entry.finalPosition ? JSON.parse(JSON.stringify(entry.finalPosition)) : null,
    }])),
    totalClears: profile.totalClears,
    updatedAt: profile.updatedAt,
  };
}

function rewardId(kind, suffix) {
  return `${GAME_ID}:${kind}:${suffix}`;
}

function addReward(profile, rewards, reward) {
  if (profile.rewardLedger[reward.id]) return;
  const stored = { ...reward };
  profile.rewardLedger[reward.id] = stored;
  rewards.push(stored);
}

export function awardCompletion(profileInput, puzzle, metrics = {}, options = {}) {
  const profile = cloneProfile(profileInput);
  const moves = Number(metrics.moves);
  const undos = Number(metrics.undos ?? 0);
  const conflictMoves = Number(metrics.conflictMoves ?? 0);
  const elapsedMs = Number(metrics.elapsedMs ?? 0);
  if (!Number.isInteger(moves) || moves < 1) throw new TypeError("Completion moves must be a positive integer.");
  if (!Number.isInteger(undos) || undos < 0 || !Number.isInteger(elapsedMs) || elapsedMs < 0) {
    throw new TypeError("Completion undo and elapsed metrics must be non-negative integers.");
  }
  if (!Number.isInteger(conflictMoves) || conflictMoves < 0 || conflictMoves > moves) {
    throw new TypeError("Conflict moves must be between zero and total moves.");
  }
  const finalPosition = metrics.position === undefined ? null : normalizeSolvedPosition(puzzle, metrics.position);
  if (metrics.position !== undefined && !finalPosition) {
    throw new TypeError("Completion proof must restore to a genuinely solved Aurora position.");
  }
  const earnedAt = new Date(Number.isFinite(options.now) ? options.now : Date.now()).toISOString();
  const runId = normalizeRunId(options.runId);
  if (options.runId !== undefined && !runId) {
    throw new TypeError("Completion run ID must be a stable Aurora run identifier.");
  }
  const attemptId = options.attemptId
    ?? (runId
      ? `${GAME_ID}:attempt:${runId}`
      : `${GAME_ID}:attempt:${puzzle.id}:${earnedAt}:${profile.totalClears + 1}`);
  if (typeof attemptId !== "string" || !attemptId.startsWith(`${GAME_ID}:attempt:`)) {
    throw new TypeError("Completion attempt ID must use the game attempt namespace.");
  }

  const settled = profile.settlements[attemptId];
  if (settled) {
    if (settled.puzzleId !== puzzle.id) throw new Error("Completion attempt cannot be reused by a different puzzle.");
    if (runId && settled.runId && settled.runId !== runId) {
      throw new Error("Completion attempt cannot be reused by a different run.");
    }
    const wasLegacyUnbound = !settled.runId && Boolean(runId?.startsWith("legacy-"));
    if (runId && !settled.runId) settled.runId = runId;
    if (settled.legacyEventIdUnknown && typeof options.legacyEventId === "string") {
      const expectedLegacyId = legacyCompletionEventId(puzzle.id, settled.clearOrdinal, moves);
      if (options.legacyEventId !== expectedLegacyId || !runId?.startsWith("legacy-")) {
        throw new TypeError("Legacy Aurora completion event identity is invalid.");
      }
      settled.moves = moves;
      settled.undos = undos;
      settled.conflictMoves = conflictMoves;
      settled.elapsedMs = elapsedMs;
      settled.zeroConflict = conflictMoves === 0;
      settled.eventId = expectedLegacyId;
      settled.legacyEventIdUnknown = false;
    }
    if (!settled.finalPosition && finalPosition) settled.finalPosition = finalPosition;
    if (wasLegacyUnbound) settled.deliveryState = DELIVERY_STATE.UNSTAGED;
    return awardForSettlement(profile, attemptId, true);
  }

  const previous = profile.records[puzzle.id] ?? null;
  const previousBestMoves = previous?.bestMoves ?? null;
  const personalBest = previousBestMoves === null || moves < previousBestMoves;
  const zeroConflict = conflictMoves === 0;
  const record = {
    clears: (previous?.clears ?? 0) + 1,
    bestMoves: personalBest ? moves : previousBestMoves,
    bestConflictMoves: Math.min(previous?.bestConflictMoves ?? conflictMoves, conflictMoves),
    zeroConflict: Boolean(previous?.zeroConflict || zeroConflict),
    stormCaptured: Boolean(previous?.stormCaptured || puzzle.storm),
    firstClearedAt: previous?.firstClearedAt ?? earnedAt,
    lastClearedAt: earnedAt,
  };
  profile.records[puzzle.id] = record;
  profile.totalClears += 1;
  profile.updatedAt = earnedAt;

  const rewards = [];
  addReward(profile, rewards, {
    id: rewardId("clear", puzzle.id), kind: "clear", puzzleId: puzzle.id, earnedAt,
  });
  addReward(profile, rewards, {
    id: rewardId("spectrum", puzzle.spectrum), kind: "spectrum", puzzleId: puzzle.id, earnedAt,
  });
  if (!profile.spectrum[puzzle.spectrum]) {
    profile.spectrum[puzzle.spectrum] = { puzzleId: puzzle.id, unlockedAt: earnedAt };
  }
  if (zeroConflict) {
    addReward(profile, rewards, {
      id: rewardId("zero-conflict", puzzle.id), kind: "zero-conflict", puzzleId: puzzle.id, earnedAt,
    });
  }
  if (puzzle.storm) {
    addReward(profile, rewards, {
      id: rewardId("rare-storm", puzzle.id), kind: "rare-storm", puzzleId: puzzle.id, earnedAt,
    });
  }
  if (personalBest) {
    addReward(profile, rewards, {
      id: rewardId("best", `${puzzle.id}:${moves}`), kind: "personal-best", puzzleId: puzzle.id, earnedAt,
    });
  }

  profile.settlements[attemptId] = {
    puzzleId: puzzle.id,
    moves,
    undos,
    conflictMoves,
    elapsedMs,
    earnedAt,
    rewardIds: rewards.map((reward) => reward.id),
    firstClear: previous === null,
    personalBest,
    previousBestMoves,
    bestMoves: record.bestMoves,
    clearOrdinal: record.clears,
    zeroConflict,
    eventId: runId
      ? completionEventIdForRun(runId)
      : legacyCompletionEventId(puzzle.id, record.clears, moves),
    legacyEventIdUnknown: false,
    finalPosition,
    deliveryState: DELIVERY_STATE.UNSTAGED,
    ...(runId ? { runId } : {}),
  };

  return awardForSettlement(profile, attemptId, false);
}

function awardForSettlement(profile, attemptId, duplicate) {
  const settled = profile.settlements[attemptId];
  return {
    profile,
    rewards: settled.rewardIds.map((id) => ({ ...profile.rewardLedger[id] })),
    firstClear: settled.firstClear,
    personalBest: settled.personalBest,
    previousBestMoves: settled.previousBestMoves,
    bestMoves: settled.bestMoves,
    clearOrdinal: settled.clearOrdinal,
    zeroConflict: settled.zeroConflict,
    earnedAt: settled.earnedAt,
    attemptId,
    runId: settled.runId ?? null,
    eventId: settled.eventId,
    moves: settled.moves,
    undos: settled.undos,
    conflictMoves: settled.conflictMoves,
    elapsedMs: settled.elapsedMs,
    finalPosition: settled.finalPosition ? JSON.parse(JSON.stringify(settled.finalPosition)) : null,
    deliveryState: settled.deliveryState,
    duplicate,
  };
}

export function completionDetail(puzzle, metrics, award) {
  const runId = normalizeRunId(award.runId ?? metrics.runId);
  if (!runId) throw new TypeError("Completion detail requires the settled run ID.");
  if (!award.finalPosition) throw new TypeError("Completion detail requires the settled final position proof.");
  const currentEventId = completionEventIdForRun(runId);
  const eventId = award.eventId ?? currentEventId;
  const identityVersion = eventId === currentEventId ? 1 : 0;
  if (identityVersion === 0 && !runId.startsWith("legacy-")) {
    throw new TypeError("Only migrated legacy runs may retain a legacy completion event ID.");
  }
  const moves = award.moves;
  const detail = {
    version: 1,
    gameId: GAME_ID,
    eventId,
    completionId: eventId,
    identityVersion,
    runId,
    levelId: puzzle.id,
    tier: DIFFICULTY_TIER[puzzle.difficulty] ?? 1,
    difficulty: puzzle.difficulty,
    moves,
    par: puzzle.suggestedMoves,
    puzzle: {
      id: puzzle.id,
      seed: puzzle.seed,
      difficulty: puzzle.difficulty,
    },
    metrics: {
      moves,
      par: puzzle.suggestedMoves,
      undos: award.undos,
      conflictMoves: award.conflictMoves,
      elapsedMs: award.elapsedMs,
      zeroConflict: award.zeroConflict,
      rareStorm: puzzle.storm,
      bestMoves: award.bestMoves,
      previousBestMoves: award.previousBestMoves,
    },
    achievements: award.rewards.map((reward) => reward.kind),
    rewards: award.rewards.map((reward) => ({ id: reward.id, kind: reward.kind })),
    completedAt: award.earnedAt,
    proof: {
      attemptId: award.attemptId,
      position: JSON.parse(JSON.stringify(award.finalPosition)),
    },
  };
  const normalized = normalizeCompletionDetail(detail);
  if (!normalized) throw new TypeError("Completion detail failed canonical Aurora validation.");
  return normalized;
}

export function completionDetailFromSettlement(profile, attemptId, puzzles) {
  const settlement = profile.settlements[attemptId];
  const puzzle = settlement ? puzzles.find((item) => item.id === settlement.puzzleId) : null;
  if (!puzzle || !settlement.runId || !settlement.finalPosition || settlement.legacyEventIdUnknown) return null;
  try {
    return completionDetail(puzzle, {}, awardForSettlement(cloneProfile(profile), attemptId, true));
  } catch {
    return null;
  }
}

export function pendingCompletionDetails(profile, puzzles) {
  const details = [];
  for (const [attemptId, settlement] of Object.entries(profile.settlements)) {
    if (settlement.deliveryState === DELIVERY_STATE.CONFIRMED) continue;
    const detail = completionDetailFromSettlement(profile, attemptId, puzzles);
    if (detail) details.push(detail);
  }
  return details;
}

export function markCompletionDelivery(profileInput, eventIds, state) {
  if (!Object.hasOwn(DELIVERY_RANK, state) || !Array.isArray(eventIds)) {
    throw new TypeError("Invalid Aurora completion delivery transition.");
  }
  const profile = cloneProfile(profileInput);
  const wanted = new Set(eventIds);
  for (const settlement of Object.values(profile.settlements)) {
    if (!wanted.has(settlement.eventId)) continue;
    if (DELIVERY_RANK[state] > DELIVERY_RANK[settlement.deliveryState]) settlement.deliveryState = state;
  }
  return profile;
}

export function validateCompletionDetail(detailInput, profileInput, puzzles) {
  const detail = normalizeCompletionDetail(detailInput);
  const profile = normalizeProfile(profileInput, puzzles);
  if (!detail || !profile) return false;
  const expected = completionDetailFromSettlement(profile, detail.proof.attemptId, puzzles);
  return Boolean(expected && sameJson(expected, detail));
}

export function validateCompletionAcknowledgement(eventId, runIdInput, profileInput, puzzles, detailInput = null) {
  const runId = normalizeRunId(runIdInput);
  const profile = normalizeProfile(profileInput, puzzles);
  if (!runId || !profile || typeof eventId !== "string") return false;
  const match = Object.entries(profile.settlements).find(([, settlement]) => (
    settlement.eventId === eventId
    && settlement.runId === runId
    && settlement.deliveryState === DELIVERY_STATE.CONFIRMED
  ));
  if (!match) return false;
  const expected = completionDetailFromSettlement(profile, match[0], puzzles);
  if (!expected || expected.eventId !== eventId || expected.runId !== runId) return false;
  if (detailInput === null || detailInput === undefined) return true;
  const detail = normalizeCompletionDetail(detailInput);
  return Boolean(detail && sameJson(expected, detail));
}

export function profileSummary(profile, puzzles) {
  const unlocked = new Set(Object.keys(profile.spectrum));
  return {
    totalClears: profile.totalClears,
    solvedPuzzles: Object.keys(profile.records).length,
    spectrumUnlocked: unlocked.size,
    spectrumTotal: new Set(puzzles.map((puzzle) => puzzle.spectrum)).size,
    zeroConflictExperiments: Object.values(profile.records).filter((record) => record.zeroConflict).length,
    stormsCaptured: Object.values(profile.records).filter((record) => record.stormCaptured).length,
    unlocked,
  };
}
