(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rules.js'), function () { return require('./levels.js'); });
  } else {
    root.MistStore = factory(root.MistRules, function () { return root.MistLevels; });
  }
}(typeof window !== 'undefined' ? window : this, function (Rules, getLevels) {
  'use strict';

  var GAME_ID = 'mistwood-album';
  var PREFIX = 'mini-polish:' + GAME_ID + ':v1:';
  var KEY = PREFIX + 'state';
  var TUTORIAL_KEY = PREFIX + 'tutorial:v1';
  var sequence = 0;
  var MAX_ACTIONS = 100000;

  function ownObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00.000Z');
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function validTime(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    var date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString() === value;
  }
  function now() { return new Date().toISOString(); }
  function validMode(mode) { return mode === 'story' || mode === 'daily' || mode === 'replay'; }
  function validId(id) { return typeof id === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(id); }
  function defaultLookup(id, mode, day) {
    var levels = getLevels();
    if (!levels) return null;
    if (mode === 'daily') {
      var daily = levels.daily(day);
      return daily && daily.id === id ? daily : null;
    }
    return levels.get ? levels.get(id) : levels.levels.filter(function (level) { return level.id === id; })[0];
  }
  function findLevel(id, mode, day, lookup) {
    try {
      var level = (lookup || defaultLookup)(id, mode, day);
      return level && level.id === id ? level : null;
    } catch (error) { return null; }
  }
  function emptyState() {
    return { version: 1, current: null, records: [], claims: [], outbox: [], acked: [] };
  }
  function skeleton(level, mode, day, runId, startedAt) {
    return {
      levelId: level.id, mode: mode, day: mode === 'daily' ? day : '', runId: runId,
      startedAt: startedAt, grid: Rules.blank(level), history: [], actions: [],
      hints: 0, moves: 0, undos: 0
    };
  }
  function newSession(level, mode, day) {
    mode = mode || 'story';
    day = day || '';
    if (!level || !validId(level.id) || !validMode(mode) || (mode === 'daily' && !validDate(day))) {
      throw new TypeError('A session requires a valid level, mode and daily date.');
    }
    sequence += 1;
    var runId = 'mw-' + Date.now().toString(36) + '-' + sequence.toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    return skeleton(level, mode, day, runId, now());
  }
  function setCell(session, level, index, value) {
    if (!session || !level || session.levelId !== level.id || session.actions.length >= MAX_ACTIONS) return session;
    var grid = Rules.apply(level, session.grid, index, value);
    if (grid === session.grid) return session;
    var result = Object.assign({}, session);
    result.grid = grid;
    result.history = session.history.concat([{ index: index, before: session.grid[index], after: value }]);
    result.actions = session.actions.concat([{ type: 'set', index: index, value: value }]);
    result.moves = session.moves + 1;
    return result;
  }
  function undo(session, level) {
    if (!session || !level || session.levelId !== level.id || !session.history.length || session.actions.length >= MAX_ACTIONS) return session;
    var action = session.history[session.history.length - 1];
    var grid = Rules.apply(level, session.grid, action.index, action.before);
    if (grid === session.grid) return session;
    var result = Object.assign({}, session);
    result.grid = grid;
    result.history = session.history.slice(0, -1);
    result.actions = session.actions.concat([{ type: 'undo' }]);
    result.undos = session.undos + 1;
    return result;
  }
  function addHint(session) {
    if (!session || session.actions.length >= MAX_ACTIONS) return session;
    var result = Object.assign({}, session);
    result.actions = session.actions.concat([{ type: 'hint' }]);
    result.hints = session.hints + 1;
    return result;
  }
  function restoreSession(raw, lookup) {
    if (!ownObject(raw) || !validId(raw.levelId) || !validId(raw.runId) || !validMode(raw.mode) || !validTime(raw.startedAt)) return null;
    if (raw.mode === 'daily' && !validDate(raw.day)) return null;
    if (!Array.isArray(raw.actions) || raw.actions.length > MAX_ACTIONS) return null;
    var level = findLevel(raw.levelId, raw.mode, raw.day, lookup);
    if (!level) return null;
    var session;
    try { session = skeleton(level, raw.mode, raw.day, raw.runId, raw.startedAt); } catch (error) { return null; }
    for (var i = 0; i < raw.actions.length; i += 1) {
      var action = raw.actions[i];
      if (!ownObject(action)) return null;
      try {
        if (action.type === 'set') {
          if (!Number.isInteger(action.index) || !Number.isInteger(action.value)) return null;
          var grid = Rules.apply(level, session.grid, action.index, action.value);
          if (grid === session.grid) return null;
          session.history.push({ index: action.index, before: session.grid[action.index], after: action.value });
          session.grid = grid;
          session.actions.push({ type: 'set', index: action.index, value: action.value });
          session.moves += 1;
        } else if (action.type === 'undo') {
          if (!session.history.length) return null;
          var previous = session.history.pop();
          session.grid = Rules.apply(level, session.grid, previous.index, previous.before);
          session.actions.push({ type: 'undo' });
          session.undos += 1;
        } else if (action.type === 'hint') {
          session.actions.push({ type: 'hint' });
          session.hints += 1;
        } else { return null; }
      } catch (error) { return null; }
    }
    return session;
  }
  function completionId(session) { return GAME_ID + ':complete:' + session.runId; }
  function claimCandidates(session) {
    var result = [GAME_ID + ':photo:' + session.levelId];
    if (session.hints === 0) result.push(GAME_ID + ':independent:' + session.levelId);
    if (session.mode === 'daily') result.push(GAME_ID + ':daily:' + session.day);
    return result;
  }
  function payloadFor(record) {
    return {
      schemaVersion: 1, gameId: GAME_ID, levelId: record.levelId, mode: record.mode,
      runId: record.runId, completionId: record.completionId,
      rewardClaims: record.rewardClaims.slice(),
      metrics: { moves: record.moves, hints: record.hints, undos: record.undos },
      completedAt: record.completedAt
    };
  }
  function restore(raw, lookup) {
    var state = emptyState();
    if (!ownObject(raw) || raw.version !== 1) return state;
    state.current = restoreSession(raw.current, lookup);
    var claimed = Object.create(null);
    var completed = Object.create(null);
    var records = Array.isArray(raw.records) ? raw.records : [];
    records.forEach(function (candidate) {
      if (!candidate || !validTime(candidate.completedAt)) return;
      var session = restoreSession(candidate, lookup);
      if (!session || candidate.completedAt < session.startedAt) return;
      var id = completionId(session);
      if (completed[id]) return;
      var level = findLevel(session.levelId, session.mode, session.day, lookup);
      if (!level || !Rules.complete(level, session.grid)) return;
      var rewards = claimCandidates(session).filter(function (claim) {
        if (claimed[claim]) return false;
        claimed[claim] = true;
        state.claims.push(claim);
        return true;
      });
      var record = Object.assign({}, session, {
        completedAt: candidate.completedAt, completionId: id, rewardClaims: rewards
      });
      state.records.push(record);
      completed[id] = true;
    });
    var acked = Object.create(null);
    if (Array.isArray(raw.acked)) raw.acked.forEach(function (id) {
      if (typeof id === 'string' && completed[id] && !acked[id]) { acked[id] = true; state.acked.push(id); }
    });
    state.outbox = state.records.filter(function (record) { return !acked[record.completionId]; }).map(payloadFor);
    return state;
  }
  function load(storage, lookup) {
    try {
      var raw = storage.getItem(KEY);
      return raw ? restore(JSON.parse(raw), lookup) : emptyState();
    } catch (error) { return emptyState(); }
  }
  function save(storage, state) {
    try { storage.setItem(KEY, JSON.stringify(state)); return { ok: true }; }
    catch (error) { return { ok: false, error: String(error && error.message || error) }; }
  }
  function settle(state, session, level, completedAt, lookup) {
    var lookupForRun = function (id, mode, day) {
      var found = findLevel(id, mode, day, lookup);
      if (found) return found;
      return level && level.id === id && mode !== 'daily' ? level : null;
    };
    var base = restore(state, lookupForRun);
    var checked = restoreSession(session, lookupForRun);
    var checkedLevel = checked && findLevel(checked.levelId, checked.mode, checked.day, lookupForRun);
    if (!checked || !level || checked.levelId !== level.id || !checkedLevel || !Rules.complete(checkedLevel, checked.grid)) {
      return { state: base, completed: false, payload: null, duplicate: false };
    }
    var id = completionId(checked);
    var existing = base.records.filter(function (record) { return record.completionId === id; })[0];
    if (existing) return { state: base, completed: true, payload: payloadFor(existing), duplicate: true };
    completedAt = completedAt || now();
    if (!validTime(completedAt) || completedAt < checked.startedAt) return { state: base, completed: false, payload: null, duplicate: false };
    base.current = checked;
    base.records.push(Object.assign({}, checked, { completedAt: completedAt }));
    base = restore(base, lookupForRun);
    var record = base.records[base.records.length - 1];
    return { state: base, completed: true, payload: payloadFor(record), duplicate: false };
  }
  function acknowledged(value) { return value === true || (ownObject(value) && value.ack === true); }
  async function flush(state, storage, host, lookup) {
    var current = restore(state, lookup);
    var firstSave = save(storage, current);
    if (!firstSave.ok) return { state: current, sent: 0, error: firstSave.error };
    if (typeof host !== 'function') return { state: current, sent: 0 };
    var sent = 0;
    while (current.outbox.length) {
      var payload = current.outbox[0];
      try {
        var response = await host(clone(payload));
        if (!acknowledged(response)) return { state: current, sent: sent, error: 'Completion was not acknowledged.' };
      } catch (error) { return { state: current, sent: sent, error: String(error && error.message || error) }; }
      var latest;
      try {
        var stored = storage.getItem(KEY);
        latest = stored ? restore(JSON.parse(stored), lookup) : current;
      } catch (error) { return { state: current, sent: sent, error: String(error && error.message || error) }; }
      // A slow host must not replace a newer in-progress session saved during delivery.
      var known = Object.create(null);
      var combined = current.records.slice();
      combined.forEach(function (record) { known[record.completionId] = true; });
      latest.records.forEach(function (record) { if (!known[record.completionId]) combined.push(record); });
      var next = restore({
        version: 1, current: latest.current, records: combined,
        acked: current.acked.concat(latest.acked, [payload.completionId])
      }, lookup);
      var result = save(storage, next);
      if (!result.ok) return { state: latest, sent: sent, error: result.error };
      current = next;
      sent += 1;
    }
    return { state: current, sent: sent };
  }

  return {
    GAME_ID: GAME_ID, PREFIX: PREFIX, KEY: KEY, TUTORIAL_KEY: TUTORIAL_KEY,
    emptyState: emptyState, newSession: newSession, setCell: setCell, undo: undo,
    addHint: addHint, restoreSession: restoreSession, restore: restore,
    load: load, save: save, settle: settle, flush: flush
  };
}));
