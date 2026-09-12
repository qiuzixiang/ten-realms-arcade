/**
 * Local persistence for 月潮回环. The only achievement evidence is a replay
 * accepted by the current engine. Stored done/edges/claims/maps are never trusted.
 * This is corruption resistance, not authentication of a player's browser.
 */
export const GAME_ID = 'moon-tide-loop';
export const STORAGE_PREFIX = 'mini-polish:moon-tide-loop:v1:';
export const STORAGE_LIMITS = Object.freeze({ actions: 4096, records: 2048, bytes: 4000000, edges: 512 });
const STATE_KEY = STORAGE_PREFIX + 'state';
const MODES = ['campaign', 'daily', 'seed'];

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function integer(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }
function identifier(value) { return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value); }
function levelIdentifier(value) { return typeof value === 'string' && /^[A-Za-z0-9._:%!~*'()-]{1,512}$/.test(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function timestamp(value) { return integer(value, 0, 8640000000000000); }
function iso(value) { return typeof value === 'string' && value.length < 40 && Number.isFinite(Date.parse(value)); }
function emptyState() { return { schemaVersion: 1, current: null, records: [] }; }

/** An injectable localStorage-compatible store, also useful for tests. */
export function createMemoryStorage() {
  const entries = Object.create(null);
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null; },
    setItem: function (key, value) { entries[key] = String(value); },
    removeItem: function (key) { delete entries[key]; }
  };
}

/**
 * createStore({ levels, getLevel(id, mode), checkWin(level, edges), storage?,
 *               now?, onWarning? })
 *
 * levels is the complete campaign catalogue, required for island collections.
 * Runs expose actions, edges, done, hintsUsed and startedAt (milliseconds).
 * Change actions/hintsUsed then call saveRun; undo simply pops an action.
 * completeRun returns the stable event or null for an unfinished/invalid run.
 * flushOutbox accepts one optional async sender. false or rejection retains an
 * event; any other resolved result acknowledges it. Receivers must dedupe both
 * completionId and rewardClaimId, including a successful send whose ack was lost.
 */
export function createStore(options) {
  if (!options || typeof options.getLevel !== 'function' || typeof options.checkWin !== 'function') {
    throw new TypeError('存档需要 getLevel 与 checkWin。');
  }
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const memory = createMemoryStorage();
  const warnings = [];
  let fallback = false;
  let storage;
  let flushing = null;
  let serial = 0;
  const catalogue = Array.isArray(options.levels) ? options.levels.filter(function (level) {
    return level && levelIdentifier(level.id) && integer(level.chapter, 1, 6);
  }) : [];

  function warn(message) {
    if (warnings.indexOf(message) === -1) {
      warnings.push(message);
      if (typeof options.onWarning === 'function') {
        try { options.onWarning(message); } catch (_) { /* Feedback cannot break play. */ }
      }
    }
  }
  function degrade() {
    fallback = true;
    warn('浏览器存储不可用，进度暂保存在本次页面中；关闭或刷新后可能丢失。');
  }
  try {
    storage = Object.prototype.hasOwnProperty.call(options, 'storage') ? options.storage : (typeof window !== 'undefined' ? window.localStorage : null);
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') degrade();
  } catch (_) { degrade(); }
  function read(key) {
    if (fallback) return memory.getItem(key);
    try {
      const value = storage.getItem(key);
      if (value !== null) memory.setItem(key, value);
      return value;
    } catch (_) { degrade(); return memory.getItem(key); }
  }
  function write(key, value) {
    memory.setItem(key, value);
    if (fallback) return false;
    try { storage.setItem(key, value); return true; } catch (_) { degrade(); return false; }
  }
  function levelFor(id, mode) {
    if (!levelIdentifier(id) || MODES.indexOf(mode) === -1) return null;
    let level;
    try { level = options.getLevel(id, mode); } catch (_) { return null; }
    if (!level || level.id !== id || !integer(level.width, 1, 16) || !integer(level.height, 1, 16)) return null;
    const count = level.width * (level.height + 1) + (level.width + 1) * level.height;
    if (count > STORAGE_LIMITS.edges) return null;
    if (mode === 'campaign' && catalogue.length && !catalogue.some(function (item) { return item.id === id; })) return null;
    return level;
  }
  function replay(raw) {
    if (!object(raw) || !identifier(raw.runId) || !timestamp(raw.startedAt) || !integer(raw.hintsUsed, 0, 1000000)) return null;
    if (!Array.isArray(raw.actions) || raw.actions.length > STORAGE_LIMITS.actions) return null;
    const level = levelFor(raw.levelId, raw.mode);
    if (!level) return null;
    const edgeCount = level.width * (level.height + 1) + (level.width + 1) * level.height;
    const edges = new Array(edgeCount).fill(0);
    const actions = [];
    for (let i = 0; i < raw.actions.length; i += 1) {
      const action = raw.actions[i];
      if (!object(action) || !integer(action.edge, 0, edgeCount - 1) || !integer(action.value, -1, 1)) return null;
      edges[action.edge] = action.value;
      actions.push({ edge: action.edge, value: action.value });
    }
    let done = false;
    try { done = options.checkWin(level, edges.slice()) === true; } catch (_) { return null; }
    return {
      schemaVersion: 1, gameId: GAME_ID, runId: raw.runId, levelId: level.id, mode: raw.mode,
      startedAt: raw.startedAt, hintsUsed: raw.hintsUsed, actions: actions, edges: edges, done: done
    };
  }
  function persistedRun(run, compact) {
    const actions = compact ? run.edges.map(function (value, edge) { return { edge: edge, value: value }; }).filter(function (action) { return action.value !== 0; }) : run.actions;
    return {
      runId: run.runId, levelId: run.levelId, mode: run.mode, startedAt: run.startedAt,
      hintsUsed: run.hintsUsed, actions: actions.map(function (action) { return { edge: action.edge, value: action.value }; })
    };
  }
  function metricsFor(run, metrics) {
    const result = { moves: run.actions.length, hintsUsed: run.hintsUsed };
    if (object(metrics) && integer(metrics.elapsedMs, 0, 31536000000)) result.elapsedMs = metrics.elapsedMs;
    return result;
  }
  function completionId(run) { return GAME_ID + ':' + run.runId + ':complete'; }

  let state = emptyState();
  const rawText = read(STATE_KEY);
  if (rawText !== null) {
    try {
      if (rawText.length > STORAGE_LIMITS.bytes) throw new Error('oversize');
      const parsed = JSON.parse(rawText);
      if (!object(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.records) || parsed.records.length > STORAGE_LIMITS.records) throw new Error('schema');
      const current = parsed.current === null ? null : replay(parsed.current);
      if (parsed.current !== null && !current) warn('部分续局数据损坏，已忽略；通过验证的岛屿进度仍保留。');
      state.current = current ? persistedRun(current, false) : null;
      const seen = Object.create(null);
      parsed.records.forEach(function (rawRecord) {
        if (!object(rawRecord)) return;
        const run = replay(rawRecord.run);
        if (!run || !run.done || !iso(rawRecord.completedAt)) {
          warn('已忽略无法重放验证的通关记录。');
          return;
        }
        const id = completionId(run);
        if (seen[id]) return;
        seen[id] = true;
        const metrics = metricsFor(run, rawRecord.metrics);
        if (object(rawRecord.metrics) && integer(rawRecord.metrics.moves, run.actions.length, STORAGE_LIMITS.actions)) metrics.moves = rawRecord.metrics.moves;
        state.records.push({ run: persistedRun(run, true), completedAt: new Date(rawRecord.completedAt).toISOString(), metrics: metrics, delivered: rawRecord.delivered === true });
      });
    } catch (_) {
      state = emptyState();
      warn('存档格式损坏，已恢复空白存档；本游戏之外的数据没有改动。');
    }
  }

  function claim(kind, run, chapter) {
    let id = GAME_ID + ':' + run.mode + ':' + run.levelId + ':' + kind;
    if (kind === 'island') id = GAME_ID + ':campaign:chapter-' + chapter + ':island';
    const result = { rewardClaimId: id, kind: kind };
    if (kind === 'island') result.chapter = chapter;
    else result.levelId = run.levelId;
    return result;
  }
  function derived() {
    const completed = Object.create(null);
    const independent = Object.create(null);
    const first = Object.create(null);
    const noHint = Object.create(null);
    const collectedChapters = [];
    const claims = [];
    const events = [];
    const chapterCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    state.records.forEach(function (record) {
      const run = record.run;
      const key = run.mode + ':' + run.levelId;
      const rewardClaims = [];
      if (!first[key]) {
        first[key] = true;
        rewardClaims.push(claim('first-clear', run));
      }
      if (run.hintsUsed === 0 && !noHint[key]) {
        noHint[key] = true;
        rewardClaims.push(claim('independent-clear', run));
      }
      if (run.mode === 'campaign') {
        completed[run.levelId] = true;
        if (run.hintsUsed === 0) independent[run.levelId] = true;
        for (let chapter = 1; chapter <= 6; chapter += 1) {
          const chapterLevels = catalogue.filter(function (level) { return level.chapter === chapter; });
          chapterCounts[chapter] = chapterLevels.filter(function (level) { return completed[level.id]; }).length;
          if (chapterLevels.length > 0 && chapterCounts[chapter] === chapterLevels.length && collectedChapters.indexOf(chapter) === -1) {
            collectedChapters.push(chapter);
            rewardClaims.push(claim('island', run, chapter));
          }
        }
      }
      rewardClaims.forEach(function (item) { claims.push(item); });
      events.push({
        schemaVersion: 1, gameId: GAME_ID, levelId: run.levelId, mode: run.mode,
        runId: run.runId, completionId: completionId(run), rewardClaims: rewardClaims,
        metrics: clone(record.metrics), completedAt: record.completedAt
      });
    });
    return {
      progress: { completed: completed, independent: independent, chapterCounts: chapterCounts, collectedChapters: collectedChapters, totalCompleted: Object.keys(completed).length, claims: claims },
      events: events
    };
  }
  function persist() {
    const events = derived().events;
    // Explicit payloads make the persisted outbox reviewable. On recovery they
    // are regenerated from proofs, so editing these caches cannot grant rewards.
    const snapshot = {
      schemaVersion: 1, current: state.current,
      records: state.records.map(function (record, index) {
        return { run: record.run, completedAt: record.completedAt, metrics: record.metrics, delivered: record.delivered, completion: events[index] };
      }),
      outbox: events.filter(function (_, index) { return !state.records[index].delivered; })
    };
    const value = JSON.stringify(snapshot);
    if (value.length > STORAGE_LIMITS.bytes) {
      degrade();
      warn('存档达到浏览器保存上限，本次新增进度暂保存在当前页面。');
    }
    return write(STATE_KEY, value);
  }
  function addCompletion(run, metrics) {
    const id = completionId(run);
    const existing = state.records.findIndex(function (record) { return completionId(record.run) === id; });
    if (existing !== -1) { persist(); return derived().events[existing]; }
    if (state.records.length >= STORAGE_LIMITS.records) {
      // No unacknowledged event or award evidence is silently removed.
      warn('本地通关记录已达保存上限，当前棋盘仍可继续游玩，暂无法新增收藏记录。');
      return null;
    }
    const completedAt = new Date(now()).toISOString();
    state.records.push({ run: persistedRun(run, true), completedAt: completedAt, metrics: metricsFor(run, metrics), delivered: false });
    persist(); // Event and reward outbox are derivable from this atomic write.
    return derived().events[state.records.length - 1];
  }

  // A valid completed current run can repair a lost/corrupt derived ledger.
  const restored = state.current ? replay(state.current) : null;
  if (restored && restored.done) addCompletion(restored, {});
  persist();

  return {
    createRun: function (levelId, mode) {
      const selectedMode = mode || 'campaign';
      if (!levelFor(levelId, selectedMode)) throw new TypeError('找不到可验证的题目。');
      const startedAt = now();
      serial += 1;
      const run = replay({ runId: 'r-' + startedAt.toString(36) + '-' + serial.toString(36) + '-' + Math.random().toString(36).slice(2, 12), levelId: levelId, mode: selectedMode, startedAt: startedAt, hintsUsed: 0, actions: [] });
      if (!run) throw new TypeError('无法建立此题目的存档。');
      state.current = persistedRun(run, false);
      persist();
      return clone(run);
    },
    saveRun: function (raw) {
      const run = replay(raw);
      if (!run) { warn('无法保存无效的边操作；原来的有效续局仍保留。'); return null; }
      state.current = persistedRun(run, false);
      persist();
      return clone(run);
    },
    loadRun: function () { return state.current ? replay(state.current) : null; },
    clearRun: function () { state.current = null; persist(); },
    completeRun: function (raw, metrics) {
      const run = replay(raw);
      if (!run || !run.done) return null;
      const existing = state.records.find(function (record) { return completionId(record.run) === completionId(run); });
      if (existing && (existing.run.levelId !== run.levelId || existing.run.mode !== run.mode)) return null;
      state.current = persistedRun(run, false);
      return clone(addCompletion(run, metrics));
    },
    getProgress: function () { return clone(derived().progress); },
    getOutbox: function () {
      const events = derived().events;
      return events.filter(function (_, index) { return !state.records[index].delivered; });
    },
    flushOutbox: function (send) {
      if (typeof send !== 'function') return Promise.resolve({ sent: 0, pending: this.getOutbox().length, skipped: true });
      if (flushing) return flushing;
      // Chain before calling send so concurrent calls share one flight.
      flushing = Promise.resolve().then(async function () {
        let sent = 0;
        const events = derived().events;
        for (let index = 0; index < events.length; index += 1) {
          const record = state.records[index];
          if (record.delivered) continue;
          try {
            const result = await send(clone(events[index]));
            if (result === false) continue;
            record.delivered = true;
            persist();
            sent += 1;
          } catch (_) { /* Keep the exact same payload for a later retry. */ }
        }
        return { sent: sent, pending: state.records.filter(function (record) { return !record.delivered; }).length, skipped: false };
      }).then(function (result) { flushing = null; return result; }, function (error) { flushing = null; throw error; });
      return flushing;
    },
    hasSeenTutorial: function (version) {
      const selected = String(version || '1');
      if (!identifier(selected)) return false;
      return read(STORAGE_PREFIX + 'tutorial:' + selected) === 'seen';
    },
    markTutorialSeen: function (version) {
      const selected = String(version || '1');
      if (!identifier(selected)) return false;
      return write(STORAGE_PREFIX + 'tutorial:' + selected, 'seen');
    },
    getStatus: function () { return { persistent: !fallback, warnings: warnings.slice() }; }
  };
}
