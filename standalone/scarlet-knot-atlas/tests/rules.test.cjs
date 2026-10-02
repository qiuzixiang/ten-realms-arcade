'use strict';
const test=require('node:test'),a=require('node:assert/strict'),c=require('../core.js'),o=require('../tools/oracle.cjs'),level=require('../tools/representatives.cjs')[0];
function p(x,y){return {x,y};}
test('closed intersection: X, T, collinear, coincident and separate',()=>{
  const cases=[[[0,0],[10,10],[0,10],[10,0],true],[[0,0],[10,0],[5,0],[5,7],true],[[0,0],[10,0],[5,0],[15,0],true],[[0,0],[5,0],[5,0],[7,0],true],[[0,0],[4,0],[5,0],[7,0],false],[[0,0],[10,0],[0,1],[10,1],false],[[2,2],[2,2],[2,2],[2,2],true],[[2,2],[2,2],[3,2],[3,2],false]];
  for(const row of cases){const pts=row.slice(0,4).map(v=>p(...v));a.equal(o.intersects(...pts),row[4]);a.equal(c.intersect(...pts.map(v=>p(v.x/20,v.y/20))),row[4]);}
});
test('different IDs with identical coordinates count; same logical endpoint exempt',()=>{
  const pts=[{id:0,x:.1,y:.1},{id:1,x:.8,y:.8},{id:2,x:.8,y:.8},{id:3,x:.8,y:.1}];
  a.equal(c.pairs(pts,[[0,1],[2,3]]).length,1);
  a.equal(c.pairs(pts,[[0,1],[1,3]]).length,0);
});
test('10000 deterministic lattice samples agree with independent parameter oracle',()=>{
  let seed=9238;function r(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%1001;}
  for(let i=0;i<10000;i++) {const pts=Array.from({length:4},()=>p(r(),r()));a.equal(c.intersect(...pts.map(v=>p(v.x/1000,v.y/1000))),o.intersects(...pts));}
  a.equal(c.intersect(p(0,.5),p(1,.500001),p(0,.500002),p(1,.500003)),false);
});
test('moves are atomic; cancellation preview belongs outside engine; undo victory',()=>{
  let s=c.create(level,'run');
  for(const args of [[0,NaN,.5],[99,.5,.5],[0,-.1,.5],[0,.2,.2]]) a.equal(c.move(s,...args),s);
  a.equal(s.history.length,0);
  const first=c.move(s,0,.2,.55);a.equal(first.history.length,1);a.equal(c.pairs(first.points,level.edges).length,1);
  const win=c.move(first,3,.6,.1);a.equal(c.solved(win.points,level.edges),true);
  a.deepEqual(c.undo(win),first);a.equal(c.solved(c.undo(win).points,level.edges),false);
  a.deepEqual(c.undo(first),s);
});
test('restore replays all moves and rejects forged saved positions or histories',()=>{
  const s=c.move(c.create(level,'run'),0,.2,.55);a.deepEqual(c.restore(level,s),s);
  const forged=c.clone(s);forged.points[0].x=.4;a.equal(c.restore(level,forged),null);
  const bad=c.clone(s);bad.history[0].from.y=.3;a.equal(c.restore(level,bad),null);
  const version=c.clone(s);version.graphVersion=2;a.equal(c.restore(level,version),null);
  const ids=c.clone(s);ids.points[0].id=99;a.equal(c.restore(level,ids),null);
});
