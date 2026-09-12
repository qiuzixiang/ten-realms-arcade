/* Four Seasons Dye Journey · replay-validated saves and completion outbox. MIT. */
var Dye = typeof Dye !== 'undefined' ? Dye : {};
(function () {
  'use strict';
  var GAME = 'season-dye-journey';
  var PREFIX = 'mini-polish:' + GAME + ':v1:';
  var KEY = PREFIX + 'journal';
  var TUTORIAL_KEY = PREFIX + 'tutorial:v1';
  var MAX_EVIDENCE = 512;
  var MAX_OUTBOX = 256;
  var runCounter = 0;

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function empty() { return { schemaVersion: 1, gameId: GAME, session: null, evidence: [], outbox: [] }; }
  function completionId(runId) { return GAME + ':completion:' + runId; }
  function modeFor(level) { return level.mode || (level.id.indexOf('daily:') === 0 ? 'daily' : level.id.indexOf('workshop:') === 0 ? 'workshop' : 'campaign'); }
  function stars(state, level) {
    if (!state || state.status !== 'won') return 0;
    return state.moves <= level.referenceMoves ? 3 : state.moves <= level.referenceMoves + 2 ? 2 : 1;
  }
  function earnedClaims(state, level) {
    var result = [], rating = stars(state, level), i;
    if (!rating) return result;
    result.push({ rewardClaimId: GAME + ':swatch:' + level.id, kind: 'swatch', levelId: level.id, value: 1 });
    for (i = 1; i <= rating; i += 1) {
      result.push({ rewardClaimId: GAME + ':star:' + level.id + ':' + i, kind: 'star', levelId: level.id, value: 1, star: i });
    }
    return result;
  }
  function newRunId() {
    runCounter += 1;
    var random = Math.floor(Math.random() * 4294967296).toString(36);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      try { var buffer = new Uint32Array(2); crypto.getRandomValues(buffer); random = buffer[0].toString(36) + buffer[1].toString(36); } catch (error) { /* A timestamp and process counter remain available. */ }
    }
    return 'dye-' + Date.now().toString(36) + '-' + runCounter.toString(36) + '-' + random;
  }
  function create(storage, resolveLevel) {
    var journal = empty(), persistent = true, dirty = false, warnings = [], lastError = null, tutorialMemory = false, flushPromise = null;
    var evidenceCache = Object.create(null);
    function note(code) { if (warnings.indexOf(code) < 0) warnings.push(code); }
    function warn(code) { lastError = code; note(code); }
    function levelFor(id, raw) { try { return typeof resolveLevel === 'function' ? resolveLevel(id, raw) : null; } catch (error) { return null; } }
    function restore(raw) { return Dye.Engine.restore(raw, levelFor); }
    function descriptor(value) {
      if (value === undefined || value === null) return null;
      try { var text = JSON.stringify(value); return text.length <= 2048 ? JSON.parse(text) : null; } catch (error) { return null; }
    }
    function evidenceState(entry) {
      var level = levelFor(entry.state.levelId, entry.state), key = completionId(entry.state.runId);
      var signature = JSON.stringify(entry.state), previous = evidenceCache[key];
      /* Only immutable rule definitions may reuse a private, replay-validated snapshot. */
      var cacheable = level && Object.isFrozen(level) && Object.isFrozen(level.initialBoard) && Object.isFrozen(level.referencePath);
      if (cacheable && previous && previous.level === level && previous.signature === signature) return previous.state;
      var state = restore(entry.state);
      if (cacheable && state) {
        Object.freeze(state.board); Object.freeze(state.timeline); Object.freeze(state);
        evidenceCache[key] = { signature: signature, level: level, state: state };
      } else delete evidenceCache[key];
      return state;
    }
    function trimCache() {
      var retained = Object.create(null);
      journal.evidence.forEach(function (entry) { retained[completionId(entry.state.runId)] = true; });
      Object.keys(evidenceCache).forEach(function (key) { if (!retained[key]) delete evidenceCache[key]; });
    }
    function persist(next) {
      journal = next;
      trimCache();
      try {
        if (!storage || typeof storage.setItem !== 'function') throw new Error('storage unavailable');
        storage.setItem(KEY, JSON.stringify(next));
        persistent = true; dirty = false; lastError = null;
        return true;
      } catch (error) {
        persistent = false; dirty = true; warn('storage-unavailable');
        return false;
      }
    }
    function result(ok, extra) {
      var value = { ok: ok, persisted: persistent && !dirty, error: lastError };
      if (extra) Object.keys(extra).forEach(function (key) { value[key] = extra[key]; });
      return value;
    }
    function findEvidence(id) {
      for (var i = 0; i < journal.evidence.length; i += 1) if (completionId(journal.evidence[i].state.runId) === id) return journal.evidence[i];
      return null;
    }
    function payload(entry) {
      var state = evidenceState(entry), level = state && levelFor(state.levelId, entry.state);
      if (!state || !level || state.status !== 'won') return null;
      var all = earnedClaims(state, level), ids = entry.claims;
      return { schemaVersion: 1, gameId: GAME, levelId: state.levelId, mode: modeFor(level), runId: state.runId,
        completionId: completionId(state.runId), rewardClaims: all.filter(function (claim) { return ids.indexOf(claim.rewardClaimId) >= 0; }),
        metrics: { moves: state.moves, referenceMoves: level.referenceMoves, moveLimit: level.moveLimit,
          stars: stars(state, level), hints: state.hints, wastes: state.wastes, width: level.width, height: level.height, colours: level.colours },
        completedAt: entry.completedAt };
    }
    function progress() {
      var levels = Object.create(null), claims = Object.create(null), totalStars = 0, collected = [], campaignCompleted = 0;
      journal.evidence.forEach(function (entry) {
        var state = evidenceState(entry), level = state && levelFor(state.levelId, entry.state);
        if (!state || !level || state.status !== 'won') return;
        var rating = stars(state, level), previous = levels[state.levelId];
        if (!previous) {
          levels[state.levelId] = { stars: rating, bestMoves: state.moves, bestHints: state.hints, mode: modeFor(level), completedAt: entry.completedAt };
        } else {
          previous.stars = Math.max(previous.stars, rating);
          previous.bestMoves = Math.min(previous.bestMoves, state.moves);
          previous.bestHints = Math.min(previous.bestHints, state.hints);
          if (entry.completedAt < previous.completedAt) previous.completedAt = entry.completedAt;
        }
        earnedClaims(state, level).forEach(function (claim) { claims[claim.rewardClaimId] = true; });
      });
      Object.keys(levels).forEach(function (id) {
        totalStars += levels[id].stars;
        if (levels[id].mode === 'campaign') { campaignCompleted += 1; collected.push(id); }
      });
      collected.sort();
      return { levels: levels, totalStars: totalStars, collected: collected, completedCount: Object.keys(levels).length,
        campaignCompleted: campaignCompleted, claims: Object.keys(claims), outboxCount: journal.outbox.length,
        persistent: persistent && !dirty, warnings: warnings.slice() };
    }
    function normalize(raw) {
      if (!raw || raw.schemaVersion !== 1 || raw.gameId !== GAME || !Array.isArray(raw.evidence) ||
          !Array.isArray(raw.outbox) || raw.evidence.length > MAX_EVIDENCE || raw.outbox.length > MAX_OUTBOX) return null;
      var clean = empty(), seen = Object.create(null);
      if (raw.session) {
        var session = restore(raw.session.state);
        if (session) clean.session = { state: Dye.Engine.serialize(session), descriptor: descriptor(raw.session.descriptor) };
        else warn('invalid-session');
      }
      raw.evidence.forEach(function (entry) {
        if (!entry || !entry.state || typeof entry.completedAt !== 'string' || !isFinite(Date.parse(entry.completedAt)) ||
            (entry.localOnly !== undefined && typeof entry.localOnly !== 'boolean')) { warn('invalid-evidence'); return; }
        var state = restore(entry.state), level = state && levelFor(state.levelId, entry.state), id = state && completionId(state.runId);
        if (!state || !level || state.status !== 'won' || seen[id]) { warn('invalid-evidence'); return; }
        var allowed = earnedClaims(state, level).map(function (claim) { return claim.rewardClaimId; });
        if (!Array.isArray(entry.claims) || entry.claims.length > allowed.length || entry.claims.some(function (claim, index) {
          return allowed.indexOf(claim) < 0 || entry.claims.indexOf(claim) !== index;
        })) { warn('invalid-evidence'); return; }
        seen[id] = entry.localOnly === true ? 'local-only' : 'sync';
        if (entry.localOnly === true) note('sync-queue-full');
        clean.evidence.push({ state: Dye.Engine.serialize(state), descriptor: descriptor(entry.descriptor), completedAt: entry.completedAt,
          claims: entry.claims.slice(), localOnly: entry.localOnly === true });
      });
      raw.outbox.forEach(function (id) { if (typeof id === 'string' && seen[id] === 'sync' && clean.outbox.indexOf(id) < 0) clean.outbox.push(id); else warn('invalid-outbox'); });
      return clean;
    }
    try {
      if (!storage || typeof storage.getItem !== 'function') throw new Error('storage unavailable');
      var saved = storage.getItem(KEY);
      if (saved) {
        if (saved.length > 2097152) throw new Error('oversized save');
        var normalized = normalize(JSON.parse(saved));
        if (normalized) journal = normalized; else warn('invalid-journal');
      }
    } catch (error) {
      if (error && (error.name === 'SyntaxError' || error.message === 'oversized save')) warn('invalid-journal');
      else { persistent = false; warn('storage-unavailable'); }
    }
    function loadSession() { return journal.session ? restore(journal.session.state) : null; }
    function saveSession(state, meta) {
      var restored = restore(state);
      if (!restored) return result(false, { error: 'invalid-session' });
      var next = copy(journal);
      next.session = { state: Dye.Engine.serialize(restored), descriptor: descriptor(meta) };
      persist(next);
      return result(true);
    }
    function trimEvidence(next) {
      var protectedIds = Object.create(null), best = Object.create(null), leastHints = Object.create(null), first = Object.create(null), i, entry, state, id;
      next.outbox.forEach(function (item) { protectedIds[item] = true; });
      if (next.session) protectedIds[completionId(next.session.state.runId)] = true;
      next.evidence.forEach(function (item) {
        var value = evidenceState(item), old = value && best[value.levelId];
        if (value && (!old || value.moves < old.state.moves || (value.moves === old.state.moves && value.hints < old.state.hints))) best[value.levelId] = { state: value, entry: item };
        if (value && (!leastHints[value.levelId] || value.hints < leastHints[value.levelId].state.hints)) leastHints[value.levelId] = { state: value, entry: item };
        if (value && (!first[value.levelId] || item.completedAt < first[value.levelId].entry.completedAt)) first[value.levelId] = { state: value, entry: item };
      });
      Object.keys(best).forEach(function (levelId) {
        protectedIds[completionId(best[levelId].state.runId)] = true;
        protectedIds[completionId(leastHints[levelId].state.runId)] = true;
        protectedIds[completionId(first[levelId].state.runId)] = true;
      });
      while (next.evidence.length > MAX_EVIDENCE) {
        for (i = 0; i < next.evidence.length; i += 1) if (!protectedIds[completionId(next.evidence[i].state.runId)]) break;
        if (i < next.evidence.length) { next.evidence.splice(i, 1); continue; }
        /* Keep every campaign best and every pending delivery. Older generated levels may rotate out. */
        for (i = 0; i < next.evidence.length; i += 1) {
          entry = next.evidence[i]; state = evidenceState(entry); id = completionId(entry.state.runId);
          if (state && modeFor(levelFor(state.levelId, entry.state)) !== 'campaign' && next.outbox.indexOf(id) < 0 &&
              (!next.session || next.session.state.runId !== state.runId)) break;
        }
        if (i === next.evidence.length) return false;
        next.evidence.splice(i, 1);
      }
      return true;
    }
    function saveCompletion(state, meta) {
      var restored = restore(state), level = restored && levelFor(restored.levelId, state);
      if (!restored || !level || restored.status !== 'won') return result(false, { error: 'not-complete' });
      var id = completionId(restored.runId), existing = findEvidence(id);
      if (existing) {
        if (existing.state.levelId !== restored.levelId || JSON.stringify(existing.state.timeline) !== JSON.stringify(restored.timeline) || existing.state.hints !== restored.hints) return result(false, { error: 'run-already-completed' });
        return result(true, { duplicate: true, localOnly: existing.localOnly === true, syncQueued: existing.localOnly !== true,
          payload: payload(existing), progress: progress() });
      }
      var localOnly = journal.outbox.length >= MAX_OUTBOX;
      var claimed = progress().claims;
      var entry = { state: Dye.Engine.serialize(restored), descriptor: descriptor(meta), completedAt: new Date().toISOString(),
        localOnly: localOnly,
        claims: earnedClaims(restored, level).filter(function (claim) { return claimed.indexOf(claim.rewardClaimId) < 0; }).map(function (claim) { return claim.rewardClaimId; }) };
      var next = copy(journal);
      next.evidence.push(entry);
      if (!localOnly) next.outbox.push(id);
      next.session = { state: Dye.Engine.serialize(restored), descriptor: descriptor(meta) };
      if (!trimEvidence(next)) return result(false, { persisted: false, error: 'evidence-capacity', progress: progress() });
      persist(next);
      if (localOnly) note('sync-queue-full');
      return result(true, { duplicate: false, localOnly: localOnly, syncQueued: !localOnly, payload: payload(entry), progress: progress() });
    }
    function flush(host) {
      if (flushPromise) return flushPromise;
      var bridge = host || (typeof DyeHost !== 'undefined' ? DyeHost : null);
      var send = typeof bridge === 'function' ? bridge : bridge && typeof bridge.complete === 'function' ? function (event) { return bridge.complete(event); } : null;
      var sent = 0;
      if (dirty && !persist(journal)) return Promise.resolve(result(false, { sent: 0, pending: journal.outbox.length, hostAvailable: !!send }));
      if (!send) return Promise.resolve(result(true, { sent: 0, pending: journal.outbox.length, hostAvailable: false }));
      function deliverNext() {
        if (!journal.outbox.length) return result(true, { sent: sent, pending: 0, hostAvailable: true });
        var id = journal.outbox[0], entry = findEvidence(id), event = entry && payload(entry);
        if (!event) return result(false, { error: 'invalid-outbox', sent: sent, pending: journal.outbox.length, hostAvailable: true });
        return Promise.resolve().then(function () { return send(copy(event)); }).then(function (accepted) {
          if (accepted === false || (accepted && accepted.accepted === false)) throw new Error('host declined');
          var next = copy(journal); next.outbox = next.outbox.filter(function (item) { return item !== id; });
          sent += 1;
          if (!persist(next)) return result(false, { sent: sent, pending: journal.outbox.length, hostAvailable: true, error: 'delivery-ack-not-persisted' });
          return deliverNext();
        }, function () { return result(false, { error: 'host-unavailable', sent: sent, pending: journal.outbox.length, hostAvailable: true }); }).catch(function () {
          return result(false, { error: 'host-unavailable', sent: sent, pending: journal.outbox.length, hostAvailable: true });
        });
      }
      flushPromise = Promise.resolve().then(deliverNext).then(function (value) { flushPromise = null; return value; }, function () {
        flushPromise = null; return result(false, { error: 'host-unavailable', sent: sent, pending: journal.outbox.length, hostAvailable: true });
      });
      return flushPromise;
    }
    function seenTutorial() {
      if (tutorialMemory) return true;
      try { return !!storage && storage.getItem(TUTORIAL_KEY) === '1'; } catch (error) { warn('tutorial-storage-unavailable'); return false; }
    }
    function markTutorial() {
      tutorialMemory = true;
      try { if (!storage) throw new Error('storage unavailable'); storage.setItem(TUTORIAL_KEY, '1'); return { ok: true, persisted: true }; }
      catch (error) { warn('tutorial-storage-unavailable'); return { ok: true, persisted: false, error: 'tutorial-storage-unavailable' }; }
    }
    return { loadSession: loadSession, saveSession: saveSession, saveCompletion: saveCompletion, progress: progress, flush: flush,
      sessionDescriptor: function () { return journal.session ? copy(journal.session.descriptor) : null; },
      seenTutorial: seenTutorial, markTutorial: markTutorial, newRunId: newRunId,
      status: function () { return result(true, { warnings: warnings.slice(), pending: journal.outbox.length }); } };
  }
  Dye.Storage = { create: create, stars: stars, newRunId: newRunId, PREFIX: PREFIX, KEY: KEY,
    TUTORIAL_KEY: TUTORIAL_KEY, MAX_EVIDENCE: MAX_EVIDENCE, MAX_OUTBOX: MAX_OUTBOX };
}());
