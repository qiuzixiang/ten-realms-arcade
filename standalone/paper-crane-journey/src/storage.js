(function (root) {
  'use strict';

  var GAME = 'paper-crane-journey';
  var PREFIX = 'mini-polish:' + GAME + ':v1:';
  var KEY = PREFIX + 'state';
  var TUTORIAL_KEY = PREFIX + 'tutorial:v1';
  var sequence = 0;

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function empty() { return { schemaVersion: 1, session: null, journal: [], delivered: [], outbox: [] }; }
  function integer(value, max) { return Number.isInteger(value) && value >= 0 && value <= max; }
  function seedValid(value) {
    return (typeof value === 'string' && value.length > 0 && value.length <= 100) ||
      (Number.isSafeInteger(value) && value >= 0);
  }
  function dateValid(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    try { return new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value; }
    catch (error) { return false; }
  }
  function timestampValid(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    try { return new Date(value).toISOString() === value; } catch (error) { return false; }
  }
  function idValid(value) { return typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(value); }
  function completionId(runId) { return GAME + ':completion:' + runId; }
  function newRunId() {
    sequence += 1;
    var random = Math.random().toString(36).slice(2, 12);
    if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
      var bytes = new Uint32Array(2);
      root.crypto.getRandomValues(bytes);
      random = bytes[0].toString(36) + bytes[1].toString(36);
    }
    return 'run-' + Date.now().toString(36) + '-' + sequence.toString(36) + '-' + random;
  }
  function resolveLevel(session) {
    var levels = root.CraneLevels;
    if (!levels) return null;
    try {
      var level;
      if (session.mode === 'main') level = levels.find(session.levelId);
      else if (session.mode === 'daily' && dateValid(session.seed)) level = levels.daily(session.seed);
      else if (session.mode === 'seeded' && seedValid(session.seed)) level = levels.seeded(session.seed, session.chapter);
      if (!level || level.id !== session.levelId || level.chapter !== session.chapter) return null;
      if (session.mode !== 'daily' && level.seed !== session.seed) return null;
      return level;
    } catch (error) { return null; }
  }
  function validateSession(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    if (!idValid(input.runId) || typeof input.levelId !== 'string' || input.levelId.length > 180 ||
        !integer(input.chapter, 100) || !timestampValid(input.startedAt) ||
        !integer(input.hints, 100000) || !integer(input.undos, 100000) ||
        !Array.isArray(input.timeline) || input.timeline.length > 500) return null;
    var level = resolveLevel(input);
    var engine = root.CraneEngine;
    if (!level || !engine) return null;
    var timeline = [];
    for (var i = 0; i < input.timeline.length; i += 1) {
      var move = input.timeline[i];
      if (!move || !integer(move.from, 10000) || !integer(move.to, 10000)) return null;
      timeline.push({ from: move.from, to: move.to });
    }
    var state;
    try {
      state = engine.replay(level, timeline);
      if (!state || state.moves !== timeline.length || engine.count(state) < 1) return null;
    } catch (error) { return null; }
    var session = {
      levelId: level.id, mode: input.mode, seed: input.seed, chapter: level.chapter,
      runId: input.runId, timeline: timeline, hints: input.hints, undos: input.undos,
      startedAt: input.startedAt
    };
    if (input.completionId !== undefined) {
      if (input.completionId !== completionId(input.runId) || !engine.won(state)) return null;
      session.completionId = input.completionId;
    }
    return { session: session, level: level, state: state };
  }
  function proofSignature(session) {
    var result = copy(session);
    delete result.completionId;
    return JSON.stringify(result);
  }
  function derive(data) {
    var claims = Object.create(null);
    var payloads = Object.create(null);
    var progress = {
      completed: Object.create(null), independent: Object.create(null), targets: Object.create(null),
      daily: Object.create(null), records: Object.create(null), chapters: Object.create(null),
      rewardClaims: [], completedCount: 0, independentCount: 0, targetCount: 0, dailyCount: 0,
      seededCount: 0, totalClaims: 0, wins: data.journal.length, pending: data.outbox.length
    };
    data.journal.forEach(function (entry) {
      var checked = validateSession(entry.session);
      if (!checked || !root.CraneEngine.won(checked.state)) return;
      var session = checked.session;
      var level = checked.level;
      var independent = session.hints === 0;
      var targetReached = Number.isInteger(level.target) && checked.state.cells[level.target] === 'P';
      var freshClaims = [];
      function claim(type, identity) {
        var claimId = GAME + ':reward:' + type + ':' + identity;
        if (claims[claimId]) return;
        var item = { rewardClaimId: claimId, type: type, levelId: level.id };
        claims[claimId] = true;
        freshClaims.push(item);
        progress.rewardClaims.push(item);
      }
      claim('first', session.mode + ':' + level.id);
      if (independent) claim('independent', session.mode + ':' + level.id);
      if (targetReached) claim('target', session.mode + ':' + level.id + ':' + level.target);
      if (session.mode === 'daily') {
        claim('daily', session.seed);
        progress.daily[session.seed] = true;
      }
      if (session.mode === 'main') {
        progress.completed[level.id] = true;
        if (independent) progress.independent[level.id] = true;
        if (targetReached) progress.targets[level.id] = true;
        if (!progress.chapters[level.chapter]) progress.chapters[level.chapter] = { completed: 0, independent: 0, targets: 0 };
      }
      if (session.mode === 'seeded') progress.seededCount += 1;
      var record = progress.records[level.id] || { completed: true, independent: false, targetReached: false, clears: 0, hintsBest: session.hints };
      record.independent = record.independent || independent;
      record.targetReached = record.targetReached || targetReached;
      record.clears += 1;
      record.hintsBest = Math.min(record.hintsBest, session.hints);
      progress.records[level.id] = record;
      payloads[completionId(session.runId)] = {
        schemaVersion: 1, gameId: GAME, levelId: level.id, mode: session.mode,
        runId: session.runId, completionId: completionId(session.runId), rewardClaims: freshClaims,
        metrics: {
          moves: session.timeline.length, hints: session.hints, undos: session.undos,
          initialPegs: root.CraneEngine.count(root.CraneEngine.create(level)), remaining: 1,
          independent: independent, targetReached: targetReached
        },
        completedAt: entry.completedAt
      };
    });
    Object.keys(progress.completed).forEach(function (id) {
      var level = root.CraneLevels.find(id);
      var chapter = progress.chapters[level.chapter];
      chapter.completed += 1;
      if (progress.independent[id]) chapter.independent += 1;
      if (progress.targets[id]) chapter.targets += 1;
    });
    progress.completedCount = Object.keys(progress.completed).length;
    progress.independentCount = Object.keys(progress.independent).length;
    progress.targetCount = Object.keys(progress.targets).length;
    progress.dailyCount = Object.keys(progress.daily).length;
    progress.totalClaims = progress.rewardClaims.length;
    return { progress: progress, payloads: payloads };
  }
  function create(storage, host) {
    var data = empty();
    var errorMessage = '';
    var dirty = false;
    // A failed read is an unknown existing save, never evidence of an empty one.
    // Keep this instance temporary; a new instance may read the original safely.
    var readBlocked = false;
    var inFlight = null;
    var tutorialMemory = false;
    var hostCall = typeof host === 'function' ? host : host && typeof host.onComplete === 'function' ? function (payload) { return host.onComplete(payload); } : null;
    function failure(text) { errorMessage = text; return false; }
    function write(next) {
      data = next;
      if (readBlocked) {
        dirty = true;
        return failure('未能读取原存档；为保护已有进度，本次仅临时游玩。请重新打开页面重试。');
      }
      try {
        if (!storage || typeof storage.setItem !== 'function') throw new Error('storage unavailable');
        storage.setItem(KEY, JSON.stringify(data));
        dirty = false;
        errorMessage = '';
        return true;
      } catch (error) {
        dirty = true;
        return failure('暂时无法保存，仍可继续游玩；关闭页面后本次进度可能丢失。');
      }
    }
    function restore() {
      var raw;
      try { raw = storage && storage.getItem(KEY); }
      catch (error) { readBlocked = true; dirty = true; failure('未能读取原存档；为保护已有进度，本次仅临时游玩。请重新打开页面重试。'); return; }
      if (!raw) return;
      var invalid = false;
      var parsed;
      try {
        if (raw.length > 8000000) throw new Error('oversized');
        parsed = JSON.parse(raw);
        if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.journal) || parsed.journal.length > 10000) throw new Error('invalid');
      } catch (error) { dirty = true; failure('存档内容损坏，已安全返回新旅程。'); return; }
      var runIds = Object.create(null);
      parsed.journal.forEach(function (entry) {
        var checked = entry && validateSession(entry.session);
        if (!checked || !root.CraneEngine.won(checked.state) || !timestampValid(entry.completedAt) || runIds[checked.session.runId]) { invalid = true; return; }
        checked.session.completionId = completionId(checked.session.runId);
        runIds[checked.session.runId] = true;
        data.journal.push({ session: checked.session, completedAt: entry.completedAt });
      });
      var ids = data.journal.map(function (entry) { return completionId(entry.session.runId); });
      if (!Array.isArray(parsed.delivered) || !Array.isArray(parsed.outbox)) invalid = true;
      (Array.isArray(parsed.delivered) ? parsed.delivered : []).forEach(function (id) {
        if (typeof id !== 'string' || ids.indexOf(id) < 0 || data.delivered.indexOf(id) >= 0) { invalid = true; return; }
        data.delivered.push(id);
      });
      data.outbox = ids.filter(function (id) { return data.delivered.indexOf(id) < 0; });
      if (JSON.stringify(parsed.outbox) !== JSON.stringify(data.outbox)) invalid = true;
      if (parsed.session !== null && parsed.session !== undefined) {
        var checkedSession = validateSession(parsed.session);
        if (checkedSession) {
          var settled = data.journal.find(function (entry) { return entry.session.runId === checkedSession.session.runId; });
          if (!settled || proofSignature(settled.session) === proofSignature(checkedSession.session)) {
            data.session = checkedSession.session;
            if (settled) data.session.completionId = completionId(data.session.runId);
          } else invalid = true;
        } else invalid = true;
      }
      if (invalid) { dirty = true; failure('部分存档未通过规则校验，已保留可验证的旅程进度。'); }
    }
    restore();
    var api = {
      loadSession: function () { return data.session ? copy(data.session) : null; },
      newSession: function (level, mode) {
        mode = mode || 'main';
        var sourceSeed = level && level.seed;
        if (mode === 'daily' && level) {
          var dateInId = String(level.id).match(/\d{4}-\d{2}-\d{2}/);
          sourceSeed = level.date || (dateValid(level.seed) ? level.seed : dateInId && dateInId[0]);
        }
        var input = {
          levelId: level && level.id, mode: mode, seed: sourceSeed, chapter: level && level.chapter,
          runId: newRunId(), timeline: [], hints: 0, undos: 0, startedAt: new Date().toISOString()
        };
        var checked = validateSession(input);
        if (!checked) { failure('无法载入这段旅程，请选择有效关卡。'); return null; }
        var next = copy(data);
        next.session = checked.session;
        write(next);
        return copy(checked.session);
      },
      saveSession: function (session) {
        var checked = validateSession(session);
        if (!checked) return failure('这份进度未通过规则校验，未覆盖原存档。');
        var settled = data.journal.find(function (entry) { return entry.session.runId === checked.session.runId; });
        if (settled && proofSignature(settled.session) !== proofSignature(checked.session)) return failure('这局已结算，请用新的旅程编号继续探索。');
        if (settled) checked.session.completionId = completionId(checked.session.runId);
        var next = copy(data);
        next.session = checked.session;
        return write(next);
      },
      complete: function (session, suppliedLevel) {
        var checked = validateSession(session);
        if (!checked || (suppliedLevel && suppliedLevel.id !== checked.level.id) || !root.CraneEngine.won(checked.state)) {
          failure('尚未满足归巢条件，未记录通关。');
          return { ok: false, saved: false, duplicate: false, error: errorMessage };
        }
        var previous = data.journal.find(function (entry) { return entry.session.runId === checked.session.runId; });
        if (previous && proofSignature(previous.session) !== proofSignature(checked.session)) {
          failure('这局已经结算，请重开后再记录新的旅程。');
          return { ok: false, saved: false, duplicate: true, error: errorMessage };
        }
        checked.session.completionId = completionId(checked.session.runId);
        var next = copy(data);
        next.session = checked.session;
        if (!previous) {
          next.journal.push({ session: checked.session, completedAt: new Date().toISOString() });
          next.outbox.push(checked.session.completionId);
        }
        var saved = write(next);
        var result = derive(data);
        if (saved) api.retry();
        return {
          ok: true, saved: saved, duplicate: !!previous, session: copy(checked.session),
          payload: copy(result.payloads[checked.session.completionId]), progress: copy(result.progress), error: errorMessage
        };
      },
      progress: function () { return copy(derive(data).progress); },
      tutorialSeen: function () {
        if (tutorialMemory) return true;
        try { tutorialMemory = !!storage && storage.getItem(TUTORIAL_KEY) === '1'; }
        catch (error) { failure('暂时无法读取教程记录，仍可跳过或查看教程。'); }
        return tutorialMemory;
      },
      markTutorial: function () {
        tutorialMemory = true;
        try {
          if (!storage || typeof storage.setItem !== 'function') throw new Error('storage unavailable');
          storage.setItem(TUTORIAL_KEY, '1');
          return true;
        } catch (error) { return failure('教程记录未能保存，下次可能再次显示；仍可继续游玩。'); }
      },
      retry: function () {
        if (inFlight) return inFlight;
        if (dirty && !write(copy(data))) return Promise.resolve({ sent: 0, pending: data.outbox.length, saved: false, error: errorMessage });
        if (!hostCall || data.outbox.length === 0) return Promise.resolve({ sent: 0, pending: data.outbox.length, saved: !dirty, error: errorMessage });
        inFlight = Promise.resolve().then(function () {
          var sent = 0;
          function deliverNext() {
            if (!data.outbox.length) return { sent: sent, pending: 0, saved: !dirty, error: errorMessage };
            var id = data.outbox[0];
            var payload = derive(data).payloads[id];
            return Promise.resolve().then(function () { return hostCall(copy(payload)); }).then(function (accepted) {
              if (accepted === false) throw new Error('host rejected');
              var next = copy(data);
              next.outbox = next.outbox.filter(function (pendingId) { return pendingId !== id; });
              if (next.delivered.indexOf(id) < 0) next.delivered.push(id);
              sent += 1;
              if (!write(next)) return { sent: sent, pending: data.outbox.length, saved: false, error: errorMessage };
              return deliverNext();
            }).catch(function () {
              failure('归巢已保存，外部记录暂未确认，可稍后重试。');
              return { sent: sent, pending: data.outbox.length, saved: !dirty, error: errorMessage };
            });
          }
          return deliverNext();
        }).then(function (result) { inFlight = null; return result; }, function () {
          inFlight = null;
          failure('归巢已保存，外部记录暂未确认，可稍后重试。');
          return { sent: 0, pending: data.outbox.length, saved: !dirty, error: errorMessage };
        });
        return inFlight;
      }
    };
    Object.defineProperty(api, 'lastError', { enumerable: true, get: function () { return errorMessage; } });
    Object.defineProperty(api, 'saved', { enumerable: true, get: function () { return !dirty; } });
    return api;
  }
  root.CraneStorage = { create: create, key: KEY, prefix: PREFIX, tutorialKey: TUTORIAL_KEY };
}(window));
