/* Four Seasons Dye Journey · Flood rule engine. MIT; source attribution in RULES.md. */
var Dye = typeof Dye !== 'undefined' ? Dye : {};
(function () {
  'use strict';
  var MAX_HISTORY = 512;
  function integer(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function validBoard(board, level) {
    return !!level && integer(level.width) && integer(level.height) && level.width >= 1 && level.height >= 1 &&
      level.width * level.height >= 2 && level.width <= 10 && level.height <= 10 &&
      integer(level.colours) && level.colours >= 3 && level.colours <= 6 && Array.isArray(board) &&
      board.length === level.width * level.height && board.every(function (c) { return integer(c) && c >= 0 && c < level.colours; });
  }
  function neighbours(index, width, height) {
    var result = [], x = index % width, y = Math.floor(index / width);
    if (x > 0) result.push(index - 1);
    if (x + 1 < width) result.push(index + 1);
    if (y > 0) result.push(index - width);
    if (y + 1 < height) result.push(index + width);
    return result;
  }
  function component(board, width, height, start) {
    if (start === undefined) start = 0;
    if (!Array.isArray(board) || !integer(width) || !integer(height) || width < 1 || height < 1 ||
        board.length !== width * height || !integer(start) || start < 0 || start >= board.length) return [];
    var seen = [], queue = [start], colour = board[start], head, i, next;
    seen[start] = true;
    for (head = 0; head < queue.length; head += 1) {
      next = neighbours(queue[head], width, height);
      for (i = 0; i < next.length; i += 1) {
        if (!seen[next[i]] && board[next[i]] === colour) { seen[next[i]] = true; queue.push(next[i]); }
      }
    }
    return queue;
  }
  function complete(board) {
    return Array.isArray(board) && board.length > 0 && board.every(function (colour) {
      return integer(colour) && colour >= 0 && colour <= 5 && colour === board[0];
    });
  }
  function fill(board, width, height, colour) {
    if (!integer(width) || !integer(height) || width < 1 || height < 1 || width > 10 || height > 10 ||
        !Array.isArray(board) || board.length !== width * height || board.length < 2 ||
        !board.every(function (c) { return integer(c) && c >= 0 && c <= 5; }) || !integer(colour) || colour < 0 || colour > 5) {
      return { accepted: false, board: board, reason: 'invalid-input' };
    }
    if (colour === board[0]) return { accepted: false, board: board, reason: 'same-colour' };
    var old = component(board, width, height, 0), next = board.slice(), set = [], i;
    for (i = 0; i < old.length; i += 1) { next[old[i]] = colour; set[old[i]] = true; }
    var controlled = component(next, width, height, 0);
    var absorbed = controlled.filter(function (index) { return !set[index]; });
    return { accepted: true, board: next, recoloured: old, absorbed: absorbed, controlled: controlled, expandedBy: absorbed.length };
  }
  function validateLevel(level) {
    return !!level && typeof level.id === 'string' && level.id.length > 0 && level.id.length <= 160 &&
      validBoard(level.initialBoard, level) && !complete(level.initialBoard) && integer(level.moveLimit) &&
      level.moveLimit > 0 && level.moveLimit <= MAX_HISTORY && integer(level.referenceMoves) &&
      level.referenceMoves > 0 && level.referenceMoves <= level.moveLimit && Array.isArray(level.referencePath) &&
      level.referencePath.length === level.referenceMoves && level.referencePath.every(function (c) { return integer(c) && c >= 0 && c < level.colours; });
  }
  function statusFor(board, moves, limit) {
    if (complete(board) && moves <= limit) return 'won';
    if (moves >= limit) return 'over-limit';
    return 'playing';
  }
  function validRunId(runId) { return typeof runId === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(runId); }
  function create(level, runId) {
    if (!validateLevel(level) || !validRunId(runId)) return null;
    return { version: 1, levelId: level.id, board: level.initialBoard.slice(), moves: 0, timeline: [],
      status: 'playing', controlled: component(level.initialBoard, level.width, level.height).length,
      runId: runId, hints: 0, wastes: 0 };
  }
  function move(state, level, colour) {
    if (!state || !validateLevel(level) || state.levelId !== level.id || !validBoard(state.board, level) ||
        !Array.isArray(state.timeline) || state.moves !== state.timeline.length) return { accepted: false, state: state, reason: 'invalid-state' };
    if (!integer(colour) || colour < 0 || colour >= level.colours) return { accepted: false, state: state, reason: 'invalid-colour' };
    if (complete(state.board)) return { accepted: false, state: state, reason: 'complete' };
    if (colour === state.board[0]) return { accepted: false, state: state, reason: 'same-colour' };
    if (state.timeline.length >= MAX_HISTORY) return { accepted: false, state: state, reason: 'history-limit' };
    var result = fill(state.board, level.width, level.height, colour), moves = state.moves + 1;
    var next = { version: 1, levelId: level.id, board: result.board, moves: moves,
      timeline: state.timeline.concat([colour]), status: statusFor(result.board, moves, level.moveLimit),
      controlled: result.controlled.length, runId: state.runId, hints: state.hints,
      wastes: state.wastes + (result.expandedBy === 0 ? 1 : 0) };
    return { accepted: true, state: next, expandedBy: result.expandedBy, recoloured: result.recoloured, absorbed: result.absorbed };
  }
  function replay(level, runId, timeline, hints) {
    var state = create(level, runId), result, i;
    if (!state || !Array.isArray(timeline) || timeline.length > MAX_HISTORY || !integer(hints) || hints < 0 || hints > 10000) return null;
    for (i = 0; i < timeline.length; i += 1) {
      result = move(state, level, timeline[i]);
      if (!result.accepted) return null;
      state = result.state;
    }
    state.hints = hints;
    return state;
  }
  function undo(state, level) {
    if (!state || !Array.isArray(state.timeline) || !state.timeline.length) return state;
    return replay(level, state.runId, state.timeline.slice(0, -1), state.hints) || state;
  }
  function restore(raw, resolveLevel) {
    try {
      var value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!value || value.version !== 1 || typeof resolveLevel !== 'function' || typeof value.levelId !== 'string' || !validRunId(value.runId)) return null;
      var level = resolveLevel(value.levelId, value);
      if (!level || level.id !== value.levelId) return null;
      var state = replay(level, value.runId, value.timeline, value.hints);
      if (!state) return null;
      if (value.moves !== undefined && value.moves !== state.moves) return null;
      if (value.status !== undefined && value.status !== state.status) return null;
      if (value.board !== undefined && (!Array.isArray(value.board) || value.board.length !== state.board.length ||
          value.board.some(function (c, i) { return c !== state.board[i]; }))) return null;
      if (value.controlled !== undefined && value.controlled !== state.controlled) return null;
      if (value.wastes !== undefined && value.wastes !== state.wastes) return null;
      return state;
    } catch (error) { return null; }
  }
  function serialize(state) {
    if (!state || state.version !== 1 || !validRunId(state.runId) || !Array.isArray(state.timeline) || state.timeline.length > MAX_HISTORY) return null;
    return { version: 1, levelId: state.levelId, runId: state.runId, timeline: state.timeline.slice(), hints: state.hints };
  }
  /* 0/1 shortest-path heuristic: crossing a colour boundary costs one future dye. */
  function metrics(board, width, height) {
    var distance = [], queued = [], queue = [0], head = 0, i, next, cell, cost, far = 0, number = 0, total = 0, control = 0;
    for (i = 0; i < board.length; i += 1) distance[i] = Infinity;
    distance[0] = 0; queued[0] = true;
    while (head < queue.length) {
      cell = queue[head]; head += 1; queued[cell] = false;
      next = neighbours(cell, width, height);
      for (i = 0; i < next.length; i += 1) {
        cost = distance[cell] + (board[next[i]] === board[cell] ? 0 : 1);
        if (cost < distance[next[i]]) {
          distance[next[i]] = cost;
          if (!queued[next[i]]) { queued[next[i]] = true; queue.push(next[i]); }
        }
      }
    }
    for (i = 0; i < distance.length; i += 1) {
      if (distance[i] > far) { far = distance[i]; number = 1; } else if (distance[i] === far) number += 1;
      total += distance[i]; if (distance[i] === 0) control += 1;
    }
    return { far: far, number: number, total: total, control: control };
  }
  function better(a, b) {
    if (!b) return true;
    if (a.far !== b.far) return a.far < b.far;
    if (a.number !== b.number) return a.number < b.number;
    if (a.total !== b.total) return a.total < b.total;
    return a.control > b.control;
  }
  function choose(board, level, depth) {
    var best = null, colour, result, score;
    for (colour = 0; colour < level.colours; colour += 1) {
      if (colour === board[0]) continue;
      result = fill(board, level.width, level.height, colour);
      if (result.expandedBy === 0) continue;
      if (complete(result.board)) return { colour: colour, far: -1, number: -depth, total: 0, control: board.length };
      score = depth > 1 ? choose(result.board, level, depth - 1) : metrics(result.board, level.width, level.height);
      if (score && better(score, best)) best = { colour: colour, far: score.far, number: score.number, total: score.total, control: score.control };
    }
    return best;
  }
  function solve(board, level) {
    if (!validBoard(board, level)) return null;
    var current = board.slice(), path = [], choice, result;
    while (!complete(current) && path.length < board.length) {
      choice = choose(current, level, 2);
      if (!choice) return null;
      result = fill(current, level.width, level.height, choice.colour);
      if (!result.accepted || result.expandedBy <= 0) return null;
      path.push(choice.colour); current = result.board;
    }
    return complete(current) ? path : null;
  }
  function suggest(board, level) {
    if (!validBoard(board, level) || complete(board)) return null;
    var path = solve(board, level);
    if (!path || !path.length) return null;
    var result = fill(board, level.width, level.height, path[0]);
    return { color: path[0], path: path, expandedBy: result.expandedBy };
  }
  Dye.Engine = { MAX_HISTORY: MAX_HISTORY, create: create, move: move, undo: undo, restore: restore,
    serialize: serialize, complete: complete, fill: fill, component: component, validateLevel: validateLevel,
    validateBoard: validBoard, solve: solve, suggest: suggest, metrics: metrics };
}());
