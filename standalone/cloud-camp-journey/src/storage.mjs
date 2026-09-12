/** Cloud Camp persistence. The only authority for progress is a replayed solution. */
export const GAME_ID = 'cloud-camp-journey';
export const STORAGE_PREFIX = 'mini-polish:' + GAME_ID + ':v1:';
export const STATE_KEY = STORAGE_PREFIX + 'state';
const MAX_EVENTS = 12000;

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 160; }
function iso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function dayAt(value) {
  const d = new Date(value);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    iso(value + 'T12:00:00Z') !== null && iso(value + 'T12:00:00Z').slice(0, 10) === value;
}
function puzzleSignature(level) {
  return JSON.stringify([level.id, level.size, level.trees, level.rows, level.cols]);
}
function completionId(runId) { return GAME_ID + ':completion:' + runId; }
function freshState() { return { schemaVersion: 1, active: null, completions: [], delivered: [] }; }

/**
 * Inject pure engine functions. resolveLevel(id, {mode, seed, day}) reconstructs
 * daily/seed puzzles; story puzzles always come from the trusted levels array.
 * Host delivery is optional, asynchronous, and receives only persisted events.
 */
export function createStorage(options) {
  const config = options || {};
  ['createBoard', 'applyAction', 'isSolved'].forEach(function (name) {
    if (typeof config[name] !== 'function') throw new TypeError(name + ' is required');
  });
  const levels = Array.isArray(config.levels) ? config.levels : [];
  const clock = typeof config.now === 'function' ? config.now : Date.now;
  let storage = null;
  let available = true;
  let recoveryMessage = '';
  let state = freshState();
  let ledgerCache = null;
  let flushing = null;
  try {
    storage = Object.prototype.hasOwnProperty.call(config, 'storage') ? config.storage :
      (typeof localStorage === 'undefined' ? null : localStorage);
    available = Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
  } catch (error) { available = false; }

  function warn(message) { recoveryMessage = message; }
  function timeNow() { return iso(clock()) || new Date().toISOString(); }
  function newRunId() {
    if (typeof config.makeId === 'function') return String(config.makeId());
    return 'run-' + new Date(timeNow()).getTime().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  function levelFor(id, meta) {
    try {
      const level = meta.mode === 'story' ? levels.find(function (item) { return String(item.id) === id; }) :
        (typeof config.resolveLevel === 'function' ? config.resolveLevel(id, meta) : null);
      return level && String(level.id) === id ? level : null;
    } catch (error) { return null; }
  }
  function normalizeMeta(meta) {
    const source = meta || {};
    const mode = source.mode || 'story';
    if (['story', 'daily', 'seed'].indexOf(mode) === -1) return null;
    let seed = source.seed === undefined || source.seed === null ? null : source.seed;
    if (seed !== null && typeof seed !== 'string' && typeof seed !== 'number') return null;
    if (seed !== null && (String(seed).length > 120 || (typeof seed === 'number' && !Number.isFinite(seed)))) return null;
    let day = source.day === undefined || source.day === null ? null : source.day;
    if (day !== null && !validDay(day)) return null;
    if (mode === 'daily' && day === null) return null;
    if (mode === 'story') { seed = null; day = null; }
    return { mode: mode, seed: seed, day: day };
  }
  function replay(raw, allowPrefix) {
    if (!isObject(raw) || !validId(raw.runId) || !validId(raw.levelId) ||
      !Array.isArray(raw.events) || raw.events.length > MAX_EVENTS || !iso(raw.startedAt)) return null;
    const meta = normalizeMeta(raw);
    if (!meta) return null;
    const level = levelFor(raw.levelId, meta);
    if (!level || raw.puzzleSignature !== puzzleSignature(level)) return null;
    let board;
    try { board = config.createBoard(level).slice(); } catch (error) { return null; }
    const history = [];
    const events = [];
    let moves = 0;
    let hints = 0;
    let undoCount = 0;
    let valid = true;
    for (let i = 0; i < raw.events.length; i += 1) {
      const event = raw.events[i];
      if (!isObject(event)) { valid = false; break; }
      if (event.type === 'set') {
        if (!Number.isInteger(event.index) || !Number.isInteger(event.value) ||
          event.index < 0 || event.index >= board.length || event.value < 0 || event.value > 2) { valid = false; break; }
        let result;
        try { result = config.applyAction(level, board.slice(), event.index, event.value); } catch (error) { valid = false; break; }
        if (!result || !result.accepted || !Array.isArray(result.board) || result.board.length !== board.length) { valid = false; break; }
        history.push(board.slice());
        board = result.board.slice();
        events.push({ type: 'set', index: event.index, value: event.value });
        moves += 1;
      } else if (event.type === 'undo' && history.length > 0) {
        board = history.pop();
        events.push({ type: 'undo' });
        undoCount += 1;
      } else if (event.type === 'hint') {
        hints += 1;
        events.push({ type: 'hint' });
      } else { valid = false; break; }
    }
    if (!valid && !allowPrefix) return null;
    let solved = false;
    try { solved = config.isSolved(level, board) === true; } catch (error) { return null; }
    const clean = {
      runId: raw.runId, levelId: raw.levelId, mode: meta.mode, seed: meta.seed, day: meta.day,
      puzzleSignature: raw.puzzleSignature, startedAt: iso(raw.startedAt), events: events
    };
    return {
      valid: valid, level: level, raw: clean,
      run: {
        runId: raw.runId, levelId: raw.levelId, mode: meta.mode, seed: meta.seed, day: meta.day,
        board: board, moves: moves, hints: hints, undoCount: undoCount,
        canUndo: history.length > 0, completed: solved, completionId: completionId(raw.runId),
        startedAt: clean.startedAt
      }
    };
  }
  function persist() {
    if (!storage) { available = false; return false; }
    try { storage.setItem(STATE_KEY, JSON.stringify(state)); available = true; return true; }
    catch (error) { available = false; return false; }
  }
  function load() {
    if (!storage) return;
    let saved;
    try { saved = storage.getItem(STATE_KEY); }
    catch (error) { available = false; return; }
    if (saved === null || saved === undefined) return;
    let parsed;
    try { parsed = JSON.parse(saved); } catch (error) {
      warn('这份露营存档未能读取，已准备新的手账。其他游戏数据不受影响。'); return;
    }
    if (!isObject(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.completions) || !Array.isArray(parsed.delivered)) {
      warn('露营存档格式已损坏，已准备新的手账。'); return;
    }
    let recovered = false;
    if (parsed.active !== null && parsed.active !== undefined) {
      const active = replay(parsed.active, true);
      if (active) { state.active = active.raw; recovered = !active.valid; }
      else recovered = true;
    }
    const seen = new Set();
    parsed.completions.forEach(function (entry) {
      const proof = isObject(entry) ? replay(entry.run, false) : null;
      if (!proof || !proof.run.completed || !iso(entry.completedAt) || seen.has(proof.run.runId)) { recovered = true; return; }
      seen.add(proof.run.runId);
      state.completions.push({ run: proof.raw, completedAt: iso(entry.completedAt) });
    });
    const possible = new Set(state.completions.map(function (entry) { return completionId(entry.run.runId); }));
    state.delivered = parsed.delivered.filter(function (id, index, values) { return possible.has(id) && values.indexOf(id) === index; });
    if (recovered) warn('已核验手账并恢复有效操作；无法验证的记录没有计入成长。');
  }
  function deriveLedger() {
    if (ledgerCache) return ledgerCache;
    const completed = new Set();
    const dailyDates = new Set();
    const collections = new Set();
    const claimIds = new Set();
    const claims = [];
    const payloads = [];
    const chapterNumbers = Array.from(new Set(levels.map(function (level) { return level.chapter; }))).filter(function (n) { return Number.isInteger(n); }).sort(function (a, b) { return a - b; });
    state.completions.forEach(function (entry) {
      const proof = replay(entry.run, false);
      if (!proof || !proof.run.completed) return;
      const run = proof.run;
      const earned = [];
      function claim(id, kind, detail) {
        if (claimIds.has(id)) return;
        claimIds.add(id);
        const reward = Object.assign({ rewardClaimId: id, kind: kind, value: 1 }, detail);
        claims.push(reward); earned.push(reward);
      }
      if (run.mode === 'story') {
        completed.add(run.levelId);
        claim(GAME_ID + ':story:' + run.levelId + ':first', 'story-first', { levelId: run.levelId });
        chapterNumbers.forEach(function (chapter) {
          const members = levels.filter(function (level) { return level.chapter === chapter; });
          if (members.length > 0 && members.every(function (level) { return completed.has(String(level.id)); })) {
            collections.add(chapter);
            claim(GAME_ID + ':chapter:' + chapter + ':collection', 'chapter-collection', { chapter: chapter });
          }
        });
      } else if (run.mode === 'daily') {
        dailyDates.add(run.day);
        claim(GAME_ID + ':daily:' + run.day + ':first', 'daily-first', { day: run.day });
      }
      payloads.push({
        schemaVersion: 1, gameId: GAME_ID, levelId: run.levelId, mode: run.mode,
        runId: run.runId, completionId: run.completionId, rewardClaims: earned,
        metrics: { moves: run.moves, hints: run.hints, undoCount: run.undoCount,
          durationSeconds: Math.max(0, Math.floor((new Date(entry.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)) },
        completedAt: entry.completedAt
      });
    });
    ledgerCache = { payloads: payloads, profile: {
      completedLevelIds: levels.filter(function (level) { return completed.has(String(level.id)); }).map(function (level) { return String(level.id); }),
      dailyDates: Array.from(dailyDates).sort(), collections: Array.from(collections).sort(function (a, b) { return a - b; }),
      totalWins: payloads.length, totalRewards: claims.length, rewardClaims: claims
    } };
    return ledgerCache;
  }
  function getRun() {
    const proof = state.active ? replay(state.active, true) : null;
    return proof ? copy(proof.run) : null;
  }
  function profile() { return copy(deriveLedger().profile); }
  function begin(levelId, meta) {
    const supplied = Object.assign({}, meta || {});
    if (supplied.mode === 'daily' && !supplied.day) supplied.day = dayAt(timeNow());
    const context = normalizeMeta(supplied);
    const id = typeof levelId === 'object' && levelId ? String(levelId.id) : String(levelId);
    const level = context ? levelFor(id, context) : null;
    if (!level) throw new Error('无法恢复此营地，请从地图重新选择。');
    let runId = newRunId();
    if (!validId(runId)) throw new Error('Invalid run ID');
    // The normal random ID already differs. This also protects deterministic hosts.
    while ((state.active && state.active.runId === runId) || state.completions.some(function (entry) { return entry.run.runId === runId; })) runId += '-n';
    state.active = { runId: runId, levelId: id, mode: context.mode, seed: context.seed, day: context.day,
      puzzleSignature: puzzleSignature(level), startedAt: timeNow(), events: [] };
    persist();
    return getRun();
  }
  function act(index, value) {
    const proof = state.active ? replay(state.active, true) : null;
    if (!proof) return { accepted: false, run: null, reason: '请先选择营地。' };
    if (state.active.events.length >= MAX_EVENTS) return { accepted: false, run: getRun(), reason: '这页手账已写满，请重新开始这一关。' };
    let result;
    try { result = config.applyAction(proof.level, proof.run.board.slice(), index, value); }
    catch (error) { return { accepted: false, run: getRun(), reason: '这个操作不能落在此处。' }; }
    if (!result || !result.accepted) return { accepted: false, run: getRun(), reason: result && result.reason ? result.reason : '棋盘没有变化。' };
    // Replaying this proposed operation validates the same boundary used on restore.
    const proposed = copy(state.active);
    proposed.events.push({ type: 'set', index: index, value: value });
    const checked = replay(proposed, false);
    if (!checked) return { accepted: false, run: getRun(), reason: '这个操作不能落在此处。' };
    state.active = checked.raw; persist();
    return { accepted: true, run: copy(checked.run), reason: result.reason || '' };
  }
  function undo() {
    const run = getRun();
    if (run && run.canUndo && state.active.events.length < MAX_EVENTS) {
      state.active.events.push({ type: 'undo' }); persist();
    }
    return getRun();
  }
  function restart() {
    const run = getRun();
    return run ? begin(run.levelId, { mode: run.mode, seed: run.seed, day: run.day }) : null;
  }
  function hint() {
    if (state.active && state.active.events.length < MAX_EVENTS) { state.active.events.push({ type: 'hint' }); persist(); }
    return getRun();
  }
  function complete() {
    const proof = state.active ? replay(state.active, false) : null;
    if (!proof || !proof.run.completed) return { ok: false, alreadyCompleted: false, payload: null, profile: profile() };
    const existing = state.completions.some(function (entry) { return entry.run.runId === proof.run.runId; });
    if (!existing) {
      state.completions.push({ run: copy(proof.raw), completedAt: timeNow() });
      ledgerCache = null;
    }
    const payload = deriveLedger().payloads.find(function (item) { return item.completionId === proof.run.completionId; });
    const persisted = persist();
    // No host callback is possible until the completion and its outbox are on disk.
    if (persisted && typeof config.onComplete === 'function') flushOutbox().catch(function () {});
    return { ok: true, alreadyCompleted: existing, payload: copy(payload), profile: profile() };
  }
  function flushOutbox(host) {
    const receiver = typeof host === 'function' ? host : config.onComplete;
    if (typeof receiver !== 'function') return Promise.resolve({ sent: 0, pending: pending().length });
    if (flushing) return flushing;
    flushing = (async function () {
      let sent = 0;
      if (!persist()) return { sent: 0, pending: pending().length };
      const queue = pending();
      for (let i = 0; i < queue.length; i += 1) {
        try {
          const result = await receiver(copy(queue[i]));
          if (result === false) break;
        } catch (error) { break; }
        state.delivered.push(queue[i].completionId);
        sent += 1;
        if (!persist()) break;
      }
      return { sent: sent, pending: pending().length };
    }());
    flushing = flushing.then(function (result) { flushing = null; return result; }, function (error) { flushing = null; throw error; });
    return flushing;
  }
  function pending() {
    return deriveLedger().payloads.filter(function (payload) { return state.delivered.indexOf(payload.completionId) === -1; });
  }
  function tutorialKey(version) {
    if (!validId(version) || !/^[a-zA-Z0-9._-]+$/.test(version)) throw new Error('Invalid tutorial version');
    return STORAGE_PREFIX + 'tutorial:' + version;
  }
  const memoryTutorials = new Set();
  function tutorialSeen(version) {
    const key = tutorialKey(String(version));
    if (memoryTutorials.has(key)) return true;
    if (!storage) return false;
    try { return storage.getItem(key) === 'seen'; } catch (error) { available = false; return false; }
  }
  function markTutorialSeen(version) {
    const key = tutorialKey(String(version));
    memoryTutorials.add(key);
    if (storage) {
      // A tiny tutorial flag may still fit while the main save exceeds quota.
      // Only a successful full-state persist can clear a prior save failure.
      try { storage.setItem(key, 'seen'); } catch (error) { available = false; }
    }
    return true;
  }
  function getStatus() {
    return { persistenceAvailable: available, recoveryMessage: recoveryMessage, pendingCompletions: pending().length };
  }
  load();
  return {
    begin: begin, resume: getRun, getRun: getRun, act: act, undo: undo, restart: restart, hint: hint,
    complete: complete, profile: profile, flushOutbox: flushOutbox, getStatus: getStatus,
    tutorialSeen: tutorialSeen, markTutorialSeen: markTutorialSeen
  };
}
