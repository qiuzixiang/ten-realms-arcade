/* Paper Crane Journey — a clean-room implementation of classic Pegs rules.
 * Rule source: Simon Tatham's Portable Puzzle Collection (MIT), see RULES.md. */
(function (root) {
  'use strict';
  var cache = Object.create(null);
  var BASE = 4294967296;
  var directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];

  function create(level) {
    if (!level || !Array.isArray(level.board) || level.board.length < 1 || level.board.length > 6) throw new TypeError('棋盘需要 1–6 行。');
    var width = typeof level.board[0] === 'string' ? level.board[0].length : 0;
    if (width < 1 || width > 6 || level.board.some(function (row) { return typeof row !== 'string' || row.length !== width || /[^#.P]/.test(row); })) throw new TypeError('棋盘应是 1–6 列的规则矩形。');
    if (level.width !== undefined && level.width !== width || level.height !== undefined && level.height !== level.board.length) throw new TypeError('棋盘尺寸不符。');
    return { width: width, height: level.board.length, cells: level.board.join('').split(''), moves: 0 };
  }

  function validState(state) {
    return !!state && Number.isInteger(state.width) && state.width > 0 && state.width <= 6 && Number.isInteger(state.height) && state.height > 0 && state.height <= 6 && Array.isArray(state.cells) && state.cells.length === state.width * state.height && state.cells.every(function (cell) { return cell === '#' || cell === '.' || cell === 'P'; }) && Number.isInteger(state.moves) && state.moves >= 0;
  }

  function middle(state, move) {
    if (!validState(state) || !move || !Number.isInteger(move.from) || !Number.isInteger(move.to) || move.from < 0 || move.to < 0 || move.from >= state.cells.length || move.to >= state.cells.length) return -1;
    var x1 = move.from % state.width, y1 = Math.floor(move.from / state.width);
    var x2 = move.to % state.width, y2 = Math.floor(move.to / state.width);
    if (!(x1 === x2 && Math.abs(y1 - y2) === 2 || y1 === y2 && Math.abs(x1 - x2) === 2)) return -1;
    return (move.from + move.to) / 2;
  }

  function apply(state, move) {
    var mid = middle(state, move);
    if (mid < 0 || state.cells[move.from] !== 'P' || state.cells[mid] !== 'P' || state.cells[move.to] !== '.') return state;
    var cells = state.cells.slice();
    cells[move.from] = '.'; cells[mid] = '.'; cells[move.to] = 'P';
    return { width: state.width, height: state.height, cells: cells, moves: state.moves + 1 };
  }

  function topology(state) {
    var key = state.width + ':' + state.cells.map(function (c) { return c === '#' ? '#' : '.'; }).join('');
    if (cache[key]) return cache[key];
    var jumps = [], bits = [], count = 0;
    state.cells.forEach(function (cell, index) {
      if (cell !== '#') { bits[index] = count < 32 ? { low: 1 << count, high: 0 } : { low: 0, high: 1 << (count - 32) }; count += 1; }
    });
    state.cells.forEach(function (cell, from) {
      if (cell === '#') return;
      var x = from % state.width, y = Math.floor(from / state.width);
      directions.forEach(function (d) {
        var tx = x + d[0], ty = y + d[1];
        if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return;
        var to = ty * state.width + tx, mid = (from + to) / 2;
        if (state.cells[to] === '#' || state.cells[mid] === '#') return;
        var f = bits[from], m = bits[mid], t = bits[to];
        jumps.push({ from: from, to: to, middle: mid, requiredLow: f.low | m.low, requiredHigh: f.high | m.high, toLow: t.low, toHigh: t.high, flipLow: f.low | m.low | t.low, flipHigh: f.high | m.high | t.high });
      });
    });
    var value = { jumps: jumps, bits: bits };
    // Each seeded board has a different shape; bound the optional performance cache.
    if (Object.keys(cache).length >= 128) cache = Object.create(null);
    cache[key] = value;
    return value;
  }

  function legal(state) {
    if (!validState(state)) return [];
    return topology(state).jumps.filter(function (j) { return state.cells[j.from] === 'P' && state.cells[j.middle] === 'P' && state.cells[j.to] === '.'; }).map(function (j) { return { from: j.from, to: j.to }; });
  }

  function count(state) {
    return validState(state) ? state.cells.reduce(function (n, cell) { return n + (cell === 'P' ? 1 : 0); }, 0) : 0;
  }

  function won(state) { return validState(state) && count(state) === 1; }

  function replay(level, moves) {
    if (!Array.isArray(moves) || moves.length > 35) return null;
    var state;
    try { state = create(level); } catch (error) { return null; }
    for (var i = 0; i < moves.length; i += 1) {
      var next = apply(state, moves[i]);
      if (next === state) return null;
      state = next;
    }
    return state;
  }

  function solve(state, options) {
    options = options || {};
    if (!validState(state)) return { solution: null, truncated: false, nodes: 0 };
    var nodeLimit = Number.isInteger(options.nodeLimit) && options.nodeLimit > 0 ? options.nodeLimit : 40000;
    var target = options.target;
    if (target !== undefined && (!Number.isInteger(target) || target < 0 || target >= state.cells.length || state.cells[target] === '#')) return { solution: null, truncated: false, nodes: 0 };
    var topo = topology(state), low = 0, high = 0, remaining = count(state);
    state.cells.forEach(function (cell, i) { if (cell === 'P') { low |= topo.bits[i].low; high |= topo.bits[i].high; } });
    var targetBits = target === undefined ? null : topo.bits[target];
    var visited = new Set(), path = [], answer = null, nodes = 0, truncated = false;
    function visit(lo, hi, n) {
      if (nodes >= nodeLimit) { truncated = true; return false; }
      nodes += 1;
      if (n === 1) {
        if (!targetBits || lo === targetBits.low && hi === targetBits.high) { answer = path.slice(); return true; }
        return false;
      }
      if (n === 0) return false;
      var key = (lo >>> 0) + hi * BASE;
      if (visited.has(key)) return false;
      visited.add(key);
      for (var i = 0; i < topo.jumps.length; i += 1) {
        var jump = topo.jumps[i];
        if ((lo & jump.requiredLow) !== jump.requiredLow || (hi & jump.requiredHigh) !== jump.requiredHigh || (lo & jump.toLow) || (hi & jump.toHigh)) continue;
        path.push({ from: jump.from, to: jump.to });
        if (visit(lo ^ jump.flipLow, hi ^ jump.flipHigh, n - 1)) return true;
        path.pop();
        if (truncated) return false;
      }
      return false;
    }
    visit(low, high, remaining);
    return { solution: answer, truncated: truncated, nodes: nodes };
  }

  root.CraneEngine = { create: create, apply: apply, legal: legal, count: count, won: won, replay: replay, solve: solve, middle: middle, validState: validState };
})(typeof window !== 'undefined' ? window : this);
