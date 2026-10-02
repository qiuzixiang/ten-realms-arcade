import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, move, undo, solve, STATUS } from '../core.mjs';
import { LEVELS, getLevel, createDailyLevel, createExpeditionLevel } from '../levels.mjs';
import {
  STORAGE_KEY, MAX_MOVE_LOG, createProfile, loadProfile, saveProfile,
  restoreRun, beginRun, resumeMode, updateRun, completeRun, recordHint, starsFor,
  getStats, isUnlocked,
} from '../storage.mjs';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const reads = [], writes = [];
  return {
    values, reads, writes,
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push(key); values.set(key, value); },
    removeItem() { throw new Error('Storage must not delete keys'); },
    clear() { throw new Error('Storage must never clear unrelated progress'); },
  };
}

const clone = value => JSON.parse(JSON.stringify(value));
function play(level, path = level.solution ?? solve(level).path) {
  return path.reduce((game, direction) => move(game, direction), createGame(level));
}
function finish(profile, level = LEVELS[0], { path, hints = 0, mode = 'campaign' } = {}) {
  let next = beginRun(profile, level, mode);
  for (let i = 0; i < hints; i++) next = recordHint(next);
  const game = play(level, path);
  assert.equal(game.status, STATUS.WON);
  next = updateRun(next, game);
  return { profile: completeRun(next, game), game };
}
function stored(raw, extra = {}) {
  return memoryStorage({ ...extra, [STORAGE_KEY]: JSON.stringify(raw) });
}

test('new profile is isolated; only first official campaign is unlocked', () => {
  const profile = createProfile();
  assert.equal(profile.version, 1);
  assert.equal(profile.settings.sound, true);
  assert.equal(profile.currentRun, null);
  assert.equal(isUnlocked(profile, 0), true);
  assert.equal(isUnlocked(profile, 1), false);
  assert.equal(isUnlocked(profile, -1), false);
  assert.equal(isUnlocked(profile, LEVELS.length), false);
  assert.equal(isUnlocked(profile, 1.5), false);
  assert.equal(getStats(profile).stars, 0);
  assert.notEqual(STORAGE_KEY, 'ten-realms:progress:v1');
});

test('begin and update are immutable, then refresh reconstructs the current state', () => {
  const base = { ...finish(createProfile()).profile, currentRun: null };
  const profile = beginRun(base, LEVELS[1]);
  assert.equal(base.currentRun, null);
  const game = move(createGame(LEVELS[1]), 'E');
  const next = updateRun(profile, game);
  assert.deepEqual(profile.currentRun.moveLog, []);
  assert.deepEqual(next.currentRun.moveLog, ['E']);
  const storage = memoryStorage();
  assert.deepEqual(saveProfile(storage, next), { ok: true, error: null });
  const loaded = loadProfile(storage);
  assert.equal(loaded.currentRun.id, next.currentRun.id);
  assert.deepEqual(restoreRun(loaded), game);
  assert.deepEqual(storage.reads, [STORAGE_KEY]);
  assert.deepEqual(storage.writes, [STORAGE_KEY]);
});

test('saved status, coordinates, collection count and scores never override replay', () => {
  const profile = beginRun(createProfile(), LEVELS[0]);
  profile.currentRun = { ...profile.currentRun, moveLog: ['S'], status: 'won', position: { x: 0, y: 0 }, collected: 99, stars: 3 };
  profile.records = { [LEVELS[0].id]: { stars: 999, completions: 999 } };
  profile.claimIds = ['forged'];
  profile.total.stars = 999;
  const loaded = loadProfile(stored(profile));
  const game = restoreRun(loaded);
  assert.equal(game.status, STATUS.PLAYING);
  assert.equal(game.collected, 0);
  assert.equal(game.moves, 1);
  assert.deepEqual(loaded.records, {});
  assert.equal(getStats(loaded).stars, 0);
  assert.equal(isUnlocked(loaded, 1), false);
});

test('invalid, blocked and post-terminal logs cannot be restored', () => {
  const base = beginRun(createProfile(), LEVELS[0]);
  for (const moveLog of [['teleport'], ['N'], ['E', 'S'], [null], 'E']) {
    const raw = clone(base);
    raw.currentRun.moveLog = moveLog;
    assert.equal(loadProfile(stored(raw)).currentRun, null);
    assert.equal(restoreRun(raw), null);
  }
  const raw = clone(base);
  raw.currentRun.levelId = 'missing-level';
  assert.equal(loadProfile(stored(raw)).currentRun, null);
});

test('first settlement creates one fragment, three stars, and unlocks only next level', () => {
  const { profile } = finish(createProfile());
  const stats = getStats(profile);
  assert.equal(stats.stars, 3);
  assert.equal(stats.fragments, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.completions, 1);
  assert.equal(stats.campaignStars, 3);
  assert.equal(profile.claimIds.length, 4);
  assert.equal(profile.completionIds.length, 1);
  assert.equal(isUnlocked(profile, 1), true);
  assert.equal(isUnlocked(profile, 2), false);
  assert.equal(profile.records[LEVELS[0].id].campaignIndex, 0);
});

test('same run completion is idempotent before and after refresh', () => {
  const { profile, game } = finish(createProfile());
  assert.equal(completeRun(profile, game), profile);
  const loaded = loadProfile(stored(profile));
  const restored = restoreRun(loaded);
  assert.equal(restored.status, STATUS.WON);
  assert.equal(completeRun(loaded, restored), loaded);
  assert.deepEqual(loaded.records, profile.records);
  assert.deepEqual(loaded.claimIds, profile.claimIds);
  assert.equal(getStats(loaded).completions, 1);
});

test('same puzzle replay gets a new completion but no repeated stars or fragments', () => {
  const first = finish(createProfile()).profile;
  const second = finish(first).profile;
  assert.notEqual(first.currentRun.id, second.currentRun.id);
  assert.equal(getStats(second).completions, 2);
  assert.equal(getStats(second).completed, 1);
  assert.equal(getStats(second).stars, 3);
  assert.equal(getStats(second).fragments, 1);
  assert.deepEqual(second.claimIds, first.claimIds);
  assert.equal(getStats(second).bestImprovements, 0);
  assert.equal(getStats(loadProfile(stored(second))).completions, 2);
});

test('route improvement upgrades highest stars and best moves without duplicate rewards', () => {
  const first = finish(createProfile(), LEVELS[0], { path: ['S', 'E', 'N'], hints: 1 }).profile;
  assert.equal(first.records[LEVELS[0].id].bestMoves, 3);
  assert.equal(first.records[LEVELS[0].id].stars, 1);
  const second = finish(first).profile;
  assert.equal(second.records[LEVELS[0].id].bestMoves, 1);
  assert.equal(second.records[LEVELS[0].id].stars, 3);
  assert.equal(getStats(second).bestImprovements, 1);
  assert.equal(getStats(second).fragments, 1);
  assert.equal(second.claimIds.filter(id => id.includes(':best:')).length, 1);
  const third = finish(second, LEVELS[0], { path: ['S', 'E', 'N'] }).profile;
  assert.equal(third.records[LEVELS[0].id].bestMoves, 1);
  assert.equal(third.records[LEVELS[0].id].stars, 3);
  assert.deepEqual(third.claimIds, second.claimIds);
  assert.deepEqual(getStats(loadProfile(stored(third))), getStats(third));
});

test('honest star criteria distinguish fast, slow and hinted completion', () => {
  const shortest = play(LEVELS[0]);
  const slower = play(LEVELS[0], ['S', 'E', 'N']);
  assert.equal(starsFor(shortest, 0), 3);
  assert.equal(starsFor(slower, 0), 2);
  assert.equal(starsFor(shortest, 1), 1);
  assert.equal(starsFor(createGame(LEVELS[0]), 0), 0);
  assert.equal(starsFor(shortest, -1), 0);
  assert.equal(starsFor(shortest, Number.NaN), 0);
});

test('undo restores state and keeps hint history, while undo itself never reduces stars', () => {
  let profile = beginRun(createProfile(), LEVELS[0]);
  let game = move(createGame(LEVELS[0]), 'S');
  profile = updateRun(profile, game);
  game = undo(game);
  profile = updateRun(profile, game);
  assert.equal(restoreRun(profile).moves, 0);
  game = move(game, 'E');
  profile = completeRun(updateRun(profile, game), game);
  assert.equal(getStats(profile).stars, 3);

  let hinted = recordHint(beginRun(createProfile(), LEVELS[0]));
  hinted = updateRun(hinted, move(createGame(LEVELS[0]), 'S'), { hints: 0 });
  hinted = updateRun(hinted, createGame(LEVELS[0]), { hints: 0 });
  assert.equal(hinted.currentRun.hints, 1);
  assert.equal(getStats(completeRun(updateRun(hinted, game), game)).stars, 1);
});

test('undo of a settled victory forks attempt and cannot reuse the prior completion id', () => {
  const finished = finish(createProfile());
  const undoneGame = undo(finished.game);
  const undone = updateRun(finished.profile, undoneGame);
  assert.notEqual(undone.currentRun.id, finished.profile.currentRun.id);
  assert.equal(getStats(undone).stars, 3);
  const repeated = completeRun(updateRun(undone, finished.game), finished.game);
  assert.equal(getStats(repeated).completions, 2);
  assert.equal(getStats(repeated).stars, 3);
});

test('forged won state and mismatched game history are not completion evidence', () => {
  const profile = beginRun(createProfile(), LEVELS[0]);
  const initial = createGame(LEVELS[0]);
  assert.equal(completeRun(profile, { ...initial, status: STATUS.WON, collected: 1, remainingEnergy: [] }), profile);
  const won = play(LEVELS[0]);
  assert.equal(completeRun(profile, { ...won, moves: 0 }), profile);
  assert.equal(completeRun(profile, { ...won, moveLog: ['N'] }), profile);
  assert.equal(completeRun(profile, play(LEVELS[1])), profile);
  assert.equal(updateRun(profile, { ...won, collected: 999 }), profile);
  const slow = play(LEVELS[0], ['S', 'E', 'N']);
  const forgedPar = { ...slow, level: { ...slow.level, par: 999 } };
  const rated = completeRun(updateRun(profile, forgedPar), forgedPar);
  assert.equal(rated.records[LEVELS[0].id].stars, 2, 'official par is the rating authority');
});

test('malformed completion proofs do not erase valid progress or settings', () => {
  const finished = finish(createProfile()).profile;
  const raw = clone(finished);
  raw.settings.sound = false;
  raw.tutorialVersion = 7;
  raw.currentRun.moveLog = ['invalid'];
  raw.settlements.push({ ...raw.settlements[0], id: 'forged-run', moveLog: [], status: 'won' });
  raw.records[LEVELS[1].id] = { stars: 999, campaignIndex: 0, completions: 1 };
  const loaded = loadProfile(stored(raw));
  assert.equal(loaded.currentRun, null);
  assert.equal(loaded.settings.sound, false);
  assert.equal(loaded.tutorialVersion, 7);
  assert.equal(loaded.settlements.length, 1);
  assert.equal(getStats(loaded).stars, 3);
  assert.equal(isUnlocked(loaded, 2), false);
});

test('duplicate stored completion entries deduplicate by stable run id', () => {
  const profile = finish(createProfile()).profile;
  const raw = clone(profile);
  raw.settlements.push(clone(raw.settlements[0]), clone(raw.settlements[0]));
  raw.completionIds.push('forged-completion-id');
  const loaded = loadProfile(stored(raw));
  assert.equal(loaded.settlements.length, 1);
  assert.deepEqual(loaded.completionIds, profile.completionIds);
  assert.deepEqual(getStats(loaded), getStats(profile));
});

test('saved campaignIndex never controls unlock, and incompatible modes are rejected', () => {
  const profile = finish(createProfile()).profile;
  const raw = clone(profile);
  raw.settlements[0].campaignIndex = 30;
  raw.currentRun.campaignIndex = 30;
  const loaded = loadProfile(stored(raw));
  assert.equal(loaded.currentRun.campaignIndex, 0);
  assert.equal(isUnlocked(loaded, 1), true);
  assert.equal(isUnlocked(loaded, 31), false);
  assert.throws(() => beginRun(profile, LEVELS[0], 'daily'), /mode/);
  assert.throws(() => beginRun(profile, LEVELS[0], 'unknown'), /mode/);
});

test('daily metadata recreates the same puzzle and independent first-win record', () => {
  const level = createDailyLevel('2026-09-05');
  let profile = beginRun(createProfile(), level, 'daily');
  const path = solve(level).path;
  assert.ok(path?.length);
  profile = updateRun(profile, move(createGame(level), path[0]));
  const loaded = loadProfile(stored(profile));
  assert.equal(loaded.currentRun.mode, 'daily');
  assert.equal(loaded.currentRun.date, '2026-09-05');
  assert.deepEqual(restoreRun(loaded).level.grid, level.grid);
  const game = play(level, path);
  profile = completeRun(updateRun(loaded, game), game);
  assert.equal(getStats(profile).dailyCompleted, 1);
  assert.equal(getStats(profile).campaignCompleted, 0);
  assert.equal(isUnlocked(profile, 1), false);
  assert.deepEqual(getStats(loadProfile(stored(profile))), getStats(profile));
});

test('expedition seed and difficulty survive replay, completion and refresh', () => {
  const level = createExpeditionLevel('storage-roundtrip-42', 1);
  const { profile } = finish(createProfile(), level, { mode: 'expedition' });
  const loaded = loadProfile(stored(profile));
  assert.equal(loaded.currentRun.seed, 'storage-roundtrip-42');
  assert.equal(loaded.currentRun.difficulty, 1);
  assert.deepEqual(restoreRun(loaded).level.grid, level.grid);
  assert.equal(getStats(loaded).expeditionCompleted, 1);
  assert.equal(getStats(loaded).fragments, 1);
});

test('a custom resolver receives complete run metadata; failures stay contained', () => {
  const profile = beginRun(createProfile(), LEVELS[0]);
  let received;
  const loaded = loadProfile(stored(profile), (id, run) => { received = run; return getLevel(id); });
  assert.equal(received.mode, 'campaign');
  assert.equal(restoreRun(loaded).moves, 0);
  assert.equal(loadProfile(stored(profile), () => { throw new Error('unavailable'); }).currentRun, null);
  assert.equal(loadProfile(stored(profile), () => LEVELS[1]).currentRun, null);
});

test('512-step logs are bounded, and overlong logs cannot restore or mint rewards', () => {
  let game = createGame(LEVELS[0]);
  for (let i = 0; i < MAX_MOVE_LOG / 2; i++) game = move(move(game, 'S'), 'N');
  assert.equal(game.moves, MAX_MOVE_LOG);
  const profile = updateRun(beginRun(createProfile(), LEVELS[0]), game);
  assert.equal(restoreRun(profile).moves, MAX_MOVE_LOG);
  const overlong = move(game, 'E');
  assert.equal(overlong.status, STATUS.WON);
  assert.equal(updateRun(profile, overlong), profile);
  assert.equal(completeRun(profile, overlong), profile);
  const raw = clone(profile);
  raw.currentRun.moveLog.push('E');
  assert.equal(loadProfile(stored(raw)).currentRun, null);
});

test('invalid JSON/version/read failure leaves unrelated keys untouched', () => {
  for (const raw of ['{broken', 'null', '{"version":999}', '[]']) {
    const storage = memoryStorage({ [STORAGE_KEY]: raw, 'ten-realms:progress:v1': 'legacy-data' });
    assert.deepEqual(loadProfile(storage), createProfile());
    assert.equal(storage.values.get('ten-realms:progress:v1'), 'legacy-data');
    assert.equal(storage.values.get(STORAGE_KEY), raw);
    assert.deepEqual(storage.writes, []);
  }
  assert.deepEqual(loadProfile({ getItem() { throw new Error('blocked'); } }), createProfile());
  assert.deepEqual(loadProfile(null), createProfile());
});

test('storage failure preserves in-memory and previously stored progress for retry', () => {
  const profile = finish(createProfile()).profile;
  const oldText = JSON.stringify(createProfile());
  const storage = memoryStorage({ [STORAGE_KEY]: oldText, 'ten-realms-v3:profile': 'legacy' });
  const setter = storage.setItem;
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const result = saveProfile(storage, profile);
  assert.equal(result.ok, false);
  assert.match(result.error, /QuotaExceeded/);
  assert.equal(storage.values.get(STORAGE_KEY), oldText);
  assert.equal(getStats(profile).stars, 3);
  assert.equal(storage.values.get('ten-realms-v3:profile'), 'legacy');
  storage.setItem = setter;
  assert.equal(saveProfile(storage, profile).ok, true);
  const loaded = loadProfile(storage);
  assert.equal(getStats(loaded).completions, 1);
  assert.equal(completeRun(loaded, restoreRun(loaded)), loaded);
  assert.equal(saveProfile(null, profile).ok, false);
});

test('all 48 campaign completion proofs survive one profile roundtrip', () => {
  let profile = createProfile();
  for (let index = 0; index < LEVELS.length; index++) {
    assert.equal(isUnlocked(profile, index), true);
    profile = finish(profile, LEVELS[index]).profile;
  }
  const loaded = loadProfile(stored(profile));
  assert.equal(getStats(loaded).campaignCompleted, 48);
  assert.equal(getStats(loaded).campaignStars, 144);
  assert.equal(getStats(loaded).fragments, 48);
  assert.equal(loaded.completionIds.length, 48);
  assert.deepEqual(getStats(loaded), getStats(profile));
});

test('locked campaign cannot begin or restore from a valid but unauthorized current log', () => {
  const profile = createProfile();
  assert.throws(() => beginRun(profile, LEVELS[1]), /locked/);
  assert.throws(() => beginRun(profile, LEVELS[47]), /locked/);
  const raw = beginRun(profile, LEVELS[0]);
  raw.currentRun.levelId = LEVELS[47].id;
  raw.currentRun.campaignIndex = 0;
  assert.equal(restoreRun(raw), null);
  const loaded = loadProfile(stored(raw));
  assert.equal(loaded.currentRun, null);
  assert.equal(isUnlocked(loaded, 47), false);
});

test('an independently verified completed level remains revisitable', () => {
  const raw = createProfile();
  raw.settlements = [{ id: 'recovered-completion', levelId: LEVELS[47].id, mode: 'campaign',
    moveLog: [...LEVELS[47].solution], hints: 0, completedAt: '2026-09-05T00:00:00.000Z' }];
  const loaded = loadProfile(stored(raw));
  assert.equal(isUnlocked(loaded, 47), true);
  assert.equal(isUnlocked(loaded, 46), false);
  assert.equal(restoreRun(beginRun(loaded, LEVELS[47])).levelId, LEVELS[47].id);
});

test('changing modes pauses the current route; resume preserves id, moves and hints', () => {
  let profile = beginRun(finish(createProfile()).profile, LEVELS[1]);
  profile = recordHint(updateRun(profile, move(createGame(LEVELS[1]), 'E')));
  const campaignRun = clone(profile.currentRun);
  const daily = createDailyLevel('2026-09-06');
  const changed = beginRun(profile, daily, 'daily');
  assert.deepEqual(changed.suspendedRuns.campaign, campaignRun);
  assert.deepEqual(profile.suspendedRuns, {});
  const dailyRun = clone(changed.currentRun);
  const resumed = resumeMode(changed, 'campaign');
  assert.notEqual(resumed, changed);
  assert.deepEqual(resumed.currentRun, campaignRun);
  assert.equal(restoreRun(resumed).moves, 1);
  assert.equal(resumed.currentRun.hints, 1);
  assert.equal(resumed.suspendedRuns.campaign, undefined);
  assert.deepEqual(resumed.suspendedRuns.daily, dailyRun);
  assert.deepEqual(resumeMode(resumed, 'daily').currentRun, dailyRun);
});

test('campaign, daily and expedition paused states survive refresh without nested profiles', () => {
  let profile = beginRun(createProfile(), LEVELS[0]);
  profile = updateRun(profile, move(createGame(LEVELS[0]), 'S'));
  const campaignId = profile.currentRun.id;
  const daily = createDailyLevel('2026-09-07');
  profile = beginRun(profile, daily, 'daily');
  profile = updateRun(profile, move(createGame(daily), daily.solution[0]));
  const dailyId = profile.currentRun.id;
  const expedition = createExpeditionLevel('paused-modes-23', 0);
  profile = beginRun(profile, expedition, 'expedition');
  const expeditionId = profile.currentRun.id;
  const loaded = loadProfile(stored(profile));
  assert.equal(loaded.currentRun.id, expeditionId);
  assert.equal(loaded.suspendedRuns.campaign.id, campaignId);
  assert.equal(loaded.suspendedRuns.daily.id, dailyId);
  assert.equal(loaded.suspendedRuns.expedition, undefined);
  assert.equal(loaded.suspendedRuns.campaign.suspendedRuns, undefined);
  const campaign = resumeMode(loaded, 'campaign');
  assert.equal(restoreRun(campaign).moves, 1);
  assert.equal(campaign.currentRun.id, campaignId);
  const resumedDaily = resumeMode(campaign, 'daily');
  assert.equal(resumedDaily.currentRun.id, dailyId);
  assert.deepEqual(restoreRun(resumedDaily).level.grid, daily.grid);
  assert.equal(restoreRun(resumeMode(resumedDaily, 'expedition')).levelId, expedition.id);
});

test('same-mode restart creates a fresh run and never saves its old self in a paused slot', () => {
  let profile = beginRun(createProfile(), LEVELS[0]);
  profile = recordHint(updateRun(profile, move(createGame(LEVELS[0]), 'S')));
  const restarted = beginRun(profile, LEVELS[0]);
  assert.notEqual(restarted.currentRun.id, profile.currentRun.id);
  assert.equal(restarted.currentRun.hints, 0);
  assert.deepEqual(restarted.currentRun.moveLog, []);
  assert.equal(restarted.suspendedRuns.campaign, undefined);
  assert.equal(resumeMode(restarted, 'campaign'), restarted);
});

test('resume ignores missing, invalid, wrong-mode and locked paused routes', () => {
  const profile = beginRun(createProfile(), LEVELS[0]);
  assert.equal(resumeMode(profile, 'daily'), profile);
  assert.equal(resumeMode(profile, 'unknown'), profile);
  const daily = beginRun(profile, createDailyLevel('2026-09-08'), 'daily');
  const wrongMode = clone(daily);
  wrongMode.suspendedRuns.campaign.mode = 'daily';
  assert.equal(resumeMode(wrongMode, 'campaign'), wrongMode);
  assert.equal(loadProfile(stored(wrongMode)).suspendedRuns.campaign, undefined);
  const locked = clone(daily);
  locked.suspendedRuns.campaign.levelId = LEVELS[47].id;
  assert.equal(resumeMode(locked, 'campaign'), locked);
  assert.equal(loadProfile(stored(locked)).suspendedRuns.campaign, undefined);
  const illegal = clone(daily);
  illegal.suspendedRuns.campaign.moveLog = ['teleport'];
  assert.equal(resumeMode(illegal, 'campaign'), illegal);
  assert.equal(loadProfile(stored(illegal)).suspendedRuns.campaign, undefined);
});

test('saved slot keys, scores and duplicate current run cannot override validated mode', () => {
  const campaign = beginRun(createProfile(), LEVELS[0]);
  const profile = beginRun(campaign, createDailyLevel('2026-09-09'), 'daily');
  const raw = clone(profile);
  raw.suspendedRuns.daily = clone(raw.currentRun);
  raw.suspendedRuns.unknown = clone(raw.suspendedRuns.campaign);
  raw.suspendedRuns.expedition = { ...raw.suspendedRuns.campaign, stars: 999 };
  raw.suspendedRuns.campaign.status = 'won';
  raw.suspendedRuns.campaign.campaignIndex = 47;
  const loaded = loadProfile(stored(raw));
  assert.deepEqual(Object.keys(loaded.suspendedRuns), ['campaign']);
  const resumed = resumeMode(loaded, 'campaign');
  assert.equal(restoreRun(resumed).status, STATUS.PLAYING);
  assert.equal(resumed.currentRun.campaignIndex, 0);
  assert.equal(getStats(resumed).stars, 0);
});

test('a paused completed campaign resumes its settlement without a duplicate reward', () => {
  const finished = finish(createProfile());
  const changed = beginRun(finished.profile, createDailyLevel('2026-09-10'), 'daily');
  const loaded = loadProfile(stored(changed));
  const resumed = resumeMode(loaded, 'campaign');
  assert.equal(resumed.currentRun.id, finished.profile.currentRun.id);
  const game = restoreRun(resumed);
  assert.equal(game.status, STATUS.WON);
  assert.equal(completeRun(resumed, game), resumed);
  assert.equal(getStats(resumed).completions, 1);
  assert.equal(getStats(resumed).stars, 3);
});
