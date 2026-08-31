import {
  STORAGE_KEYS,
  readProfileDocument,
  removeOwned,
  writeProfileDocument,
} from "./persistence.mjs";

export const GAME_ID = "aurora-magnet-lab";
export const PROFILE_VERSION = 1;
export const COMPLETION_EVENT = "ten-realms-v2:game-complete";
export const READY_EVENT = "ten-realms-v2:game-ready";
export const DIFFICULTY_TIER = Object.freeze({
  calibration: 1,
  survey: 2,
  storm: 3,
});

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
          },
        ];
      });
    }),
  );

  const settlements = {};
  const referencedRewards = new Set();
  const ordinalsByPuzzle = new Map();
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

    entry.rewardIds.forEach((id) => referencedRewards.add(id));
    const ordinals = ordinalsByPuzzle.get(entry.puzzleId) ?? [];
    ordinals.push(entry.clearOrdinal);
    ordinalsByPuzzle.set(entry.puzzleId, ordinals);
    settlements[attemptId] = {
      puzzleId: entry.puzzleId,
      moves: entry.moves,
      conflictMoves: entry.conflictMoves,
      earnedAt: entry.earnedAt,
      rewardIds: [...entry.rewardIds],
      firstClear: entry.firstClear,
      personalBest: entry.personalBest,
      previousBestMoves: entry.previousBestMoves,
      bestMoves: entry.bestMoves,
      clearOrdinal: entry.clearOrdinal,
      zeroConflict: entry.zeroConflict,
    };
  }
  if (Object.keys(settlements).length !== value.totalClears) return null;
  if (Object.keys(rewardLedger).some((id) => !referencedRewards.has(id))) return null;
  for (const [puzzleId, record] of Object.entries(records)) {
    const ordinals = (ordinalsByPuzzle.get(puzzleId) ?? []).sort((a, b) => a - b);
    if (ordinals.length !== record.clears || ordinals.some((ordinal, index) => ordinal !== index + 1)) return null;
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

export function saveProfile(storage, profile, puzzles) {
  const normalized = normalizeProfile(profile, puzzles);
  return normalized ? writeProfileDocument(storage, normalized) : false;
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
  const conflictMoves = Number(metrics.conflictMoves ?? 0);
  if (!Number.isInteger(moves) || moves < 1) throw new TypeError("Completion moves must be a positive integer.");
  if (!Number.isInteger(conflictMoves) || conflictMoves < 0 || conflictMoves > moves) {
    throw new TypeError("Conflict moves must be between zero and total moves.");
  }
  const earnedAt = new Date(Number.isFinite(options.now) ? options.now : Date.now()).toISOString();
  const attemptId = options.attemptId
    ?? `${GAME_ID}:attempt:${puzzle.id}:${earnedAt}:${profile.totalClears + 1}`;
  if (typeof attemptId !== "string" || !attemptId.startsWith(`${GAME_ID}:attempt:`)) {
    throw new TypeError("Completion attempt ID must use the game attempt namespace.");
  }

  const settled = profile.settlements[attemptId];
  if (settled) {
    if (settled.puzzleId !== puzzle.id || settled.moves !== moves || settled.conflictMoves !== conflictMoves) {
      throw new Error("Completion attempt cannot be reused with different puzzle metrics.");
    }
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
      duplicate: true,
    };
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
    conflictMoves,
    earnedAt,
    rewardIds: rewards.map((reward) => reward.id),
    firstClear: previous === null,
    personalBest,
    previousBestMoves,
    bestMoves: record.bestMoves,
    clearOrdinal: record.clears,
    zeroConflict,
  };

  return {
    profile,
    rewards,
    firstClear: previous === null,
    personalBest,
    previousBestMoves,
    bestMoves: record.bestMoves,
    clearOrdinal: record.clears,
    zeroConflict,
    earnedAt,
    attemptId,
    duplicate: false,
  };
}

export function completionDetail(puzzle, metrics, award) {
  const moves = Number(metrics.moves);
  const detail = {
    version: 1,
    gameId: GAME_ID,
    eventId: rewardId("completion", `${puzzle.id}:${award.clearOrdinal}:${moves}`),
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
      undos: Number(metrics.undos ?? 0),
      conflictMoves: Number(metrics.conflictMoves ?? 0),
      elapsedMs: Number(metrics.elapsedMs ?? 0),
      zeroConflict: award.zeroConflict,
      rareStorm: puzzle.storm,
      bestMoves: award.bestMoves,
      previousBestMoves: award.previousBestMoves,
    },
    achievements: award.rewards.map((reward) => reward.kind),
    rewards: award.rewards.map((reward) => ({ id: reward.id, kind: reward.kind })),
    completedAt: award.earnedAt,
  };
  return JSON.parse(JSON.stringify(detail));
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
