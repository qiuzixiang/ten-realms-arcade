/* Flip rule mapping, referenced from Ten Realms Arcade (MIT), baseline 55cdddb.
   New standalone implementation. UI and persistence never determine victory. */
var BellEngine = (function () {
  'use strict';
  function index(i, n) { return Number.isInteger(i) && i >= 0 && i < n; }
  function valid(l) {
    if (!l || !Number.isInteger(l.size) || l.size < 2 || l.size > 5) return false;
    var n = l.size * l.size;
    return Array.isArray(l.initial) && l.initial.length === n && l.initial.every(function (v) { return v === 0 || v === 1; }) &&
      Array.isArray(l.templates) && l.templates.length === n && l.templates.every(function (t, i) {
        return Array.isArray(t) && t.indexOf(i) >= 0 && new Set(t).size === t.length && t.every(function (v) { return index(v, n); });
      }) && new Set(l.templates.map(function (t) { return t.slice().sort(function(a,b){return a-b;}).join(','); })).size === n;
  }
  function replay(l, history) {
    if (!valid(l) || !Array.isArray(history) || history.length > 10000 || !history.every(function (i) { return index(i, l.initial.length); })) return null;
    var lights = l.initial.slice();
    history.forEach(function (i) { l.templates[i].forEach(function (j) { lights[j] ^= 1; }); });
    return { lights: lights, history: history.slice(), moves: history.length };
  }
  function press(l, s, i) { if (!valid(l) || !s || !Array.isArray(s.history) || !index(i, l.initial.length) || s.history.length >= 10000) return s; return replay(l, s.history.concat(i)) || s; }
  function undo(l, s) { return s && Array.isArray(s.history) && s.history.length ? replay(l, s.history.slice(0, -1)) || s : s; }
  function won(l, s) { var r = s && replay(l, s.history); return !!r && r.lights.every(function (x) { return x === 1; }); }
  function solve(l, lights) {
    if (!valid(l) || !Array.isArray(lights) || lights.length !== l.initial.length || !lights.every(function(x){return x===0||x===1;})) return null;
    var n = lights.length, rows = lights.map(function (v, j) { return l.templates.map(function (t) { return t.indexOf(j) >= 0 ? 1 : 0; }).concat(v ^ 1); });
    var pivots = [], r = 0;
    for (var c = 0; c < n; c++) {
      var p = r; while (p < n && !rows[p][c]) p++;
      if (p === n) continue;
      var tmp = rows[r]; rows[r] = rows[p]; rows[p] = tmp;
      for (var k = 0; k < n; k++) if (k !== r && rows[k][c]) for (var a = c; a <= n; a++) rows[k][a] ^= rows[r][a];
      pivots.push(c); r++;
    }
    for (var z = r; z < n; z++) if (rows[z][n]) return null;
    var free = []; for (var q = 0; q < n; q++) if (pivots.indexOf(q) < 0) free.push(q);
    if (free.length > 14) return null; // bounded exact enumeration; reject oversized nullspaces at generation
    var best = null;
    for (var mask = 0; mask < Math.pow(2, free.length); mask++) {
      var x = Array(n).fill(0);
      free.forEach(function(f,j){ x[f] = (mask >>> j) & 1; });
      pivots.forEach(function(p,j){ var v=rows[j][n]; free.forEach(function(f){v ^= rows[j][f] & x[f];}); x[p]=v; });
      var taps=[]; x.forEach(function(v,j){if(v)taps.push(j);});
      if (!best || taps.length < best.length) best=taps;
    }
    return { presses: best, minimum: best.length, rank:r, nullity:free.length, solutions:Math.pow(2,free.length) };
  }
  return {valid:valid,replay:replay,press:press,undo:undo,won:won,solve:solve};
}());
