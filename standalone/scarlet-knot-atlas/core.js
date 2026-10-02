(function (root) {
  'use strict';
  var EPS = 1e-10;
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function point(p) { return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1; }
  function orient(a, b, c) {
    var z = (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    return Math.abs(z) <= EPS ? 0 : z > 0 ? 1 : -1;
  }
  function on(a, b, p) {
    return p.x >= Math.min(a.x,b.x)-EPS && p.x <= Math.max(a.x,b.x)+EPS && p.y >= Math.min(a.y,b.y)-EPS && p.y <= Math.max(a.y,b.y)+EPS;
  }
  function intersect(a,b,c,d) {
    var u=orient(a,b,c), v=orient(a,b,d), w=orient(c,d,a), z=orient(c,d,b);
    if (u && v && w && z) return u !== v && w !== z;
    return (!u && on(a,b,c)) || (!v && on(a,b,d)) || (!w && on(c,d,a)) || (!z && on(c,d,b));
  }
  function validGraph(points, edges) {
    if (!Array.isArray(points) || points.length < 2 || !Array.isArray(edges) || !edges.length) return false;
    var ids={}, seen={};
    for (var i=0;i<points.length;i++) {
      if (!point(points[i]) || !Number.isInteger(points[i].id) || points[i].id < 0 || ids[points[i].id]) return false;
      ids[points[i].id]=true;
    }
    for (var j=0;j<edges.length;j++) {
      var e=edges[j];
      if (!Array.isArray(e) || e.length !== 2 || e[0] === e[1] || !ids[e[0]] || !ids[e[1]]) return false;
      var k=Math.min(e[0],e[1])+':'+Math.max(e[0],e[1]);
      if (seen[k]) return false;
      seen[k]=true;
    }
    return true;
  }
  function pairs(points, edges) {
    if (!validGraph(points,edges)) throw new Error('Invalid graph');
    var lookup={}, out=[];
    points.forEach(function(p) { lookup[p.id]=p; });
    for (var i=0;i<edges.length;i++) for (var j=i+1;j<edges.length;j++) {
      var a=edges[i], b=edges[j];
      if (a[0]===b[0] || a[0]===b[1] || a[1]===b[0] || a[1]===b[1]) continue;
      if (intersect(lookup[a[0]],lookup[a[1]],lookup[b[0]],lookup[b[1]])) out.push([i,j]);
    }
    return out;
  }
  function create(level, runId) {
    if (!validGraph(level.initial,level.edges)) throw new Error('Invalid level');
    return {levelId:level.id,graphVersion:level.graphVersion,runId:runId,points:clone(level.initial),history:[],hintsUsed:0,elapsedMs:0};
  }
  // Coordinates outside the inclusive board are invalid. Only the UI maps
  // pointer positions to clamped board coordinates before calling this action.
  function move(state,id,x,y) {
    if (!point({x:x,y:y})) return state;
    var p=state.points.filter(function(n){return n.id===id;})[0];
    if (!p || (p.x===x && p.y===y)) return state;
    var next=clone(state);
    next.points.forEach(function(n){if(n.id===id){n.x=x;n.y=y;}});
    next.history.push({id:id,from:{x:p.x,y:p.y},to:{x:x,y:y}});
    return next;
  }
  function undo(state) {
    if (!state.history.length) return state;
    var next=clone(state), a=next.history.pop();
    next.points.forEach(function(n){if(n.id===a.id){n.x=a.from.x;n.y=a.from.y;}});
    return next;
  }
  function restore(level, saved) {
    if (!saved || saved.levelId!==level.id || saved.graphVersion!==level.graphVersion || typeof saved.runId!=='string' || !saved.runId || saved.runId.length>120 || !Array.isArray(saved.history) || saved.history.length>10000 || !Number.isInteger(saved.hintsUsed) || saved.hintsUsed<0) return null;
    var state=create(level,saved.runId);
    for (var i=0;i<saved.history.length;i++) {
      var a=saved.history[i], p=a && state.points.filter(function(n){return n.id===a.id;})[0];
      if (!p || !a.from || !a.to || p.x!==a.from.x || p.y!==a.from.y) return null;
      var next=move(state,a.id,a.to.x,a.to.y);
      if (next===state) return null;
      state=next;
    }
    if (!Array.isArray(saved.points) || JSON.stringify(state.points)!==JSON.stringify(saved.points)) return null;
    state.hintsUsed=saved.hintsUsed;
    state.elapsedMs=Number.isFinite(saved.elapsedMs)&&saved.elapsedMs>=0?saved.elapsedMs:0;
    return state;
  }
  var api={EPS:EPS,clone:clone,validGraph:validGraph,intersect:intersect,pairs:pairs,create:create,move:move,undo:undo,restore:restore,solved:function(p,e){return pairs(p,e).length===0;}};
  root.ScarletCore=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
}(typeof window!=='undefined'?window:this));
