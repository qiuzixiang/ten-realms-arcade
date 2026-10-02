'use strict';
const test=require('node:test'),a=require('node:assert/strict'),C=require('../core.js'),O=require('../tools/oracle.cjs'),T=require('../tools/topology.cjs'),levels=require('../levels.js');
const lattice=ps=>ps.map(p=>({id:p.id,x:Math.round(p.x*1000),y:Math.round(p.y*1000)}));
test('48 graphs, 6 chapters, distinct exact topology, closed geometry witnessed and replayable',()=>{
  a.equal(levels.length,48);a.equal(new Set(levels.map(l=>l.id)).size,48);
  for(let chapter=1;chapter<=6;chapter++)a.equal(levels.filter(l=>l.chapter===chapter).length,8);
  levels.forEach((level,i)=>{
    a.equal(T.stats(level).components,1);a(C.pairs(level.initial,level.edges).length>0);
    if(level.chapter===2)a(T.stats(level).cyclicBlocks>=2);
    if(level.chapter===4)a(T.stats(level).articulations.length>=2);
    if(level.chapter===5){a(T.stats(level).cyclicBlocks>=2);a.equal(T.automorphisms(level,2),1);}
    if(level.id==='scarlet-48')a.equal(T.stats(level).cyclicBlocks,3);
    a.deepEqual(C.pairs(level.initial,level.edges),O.pairs(lattice(level.initial),level.edges));
    a.deepEqual(O.pairs(lattice(level.witness),level.edges),[]);
    let state=C.create(level,'campaign-proof-'+i);level.replay.forEach(m=>{state=C.move(state,m.id,m.x,m.y);});
    a(C.solved(state.points,level.edges));a.deepEqual(C.restore(level,state),state);
    for(let j=0;j<i;j++)a.equal(T.isomorphic(level,levels[j]),false,level.id+' duplicates '+levels[j].id);
  });
});
test('initial and reference seals stay legible at 288 by 344 board; no rule-level distance restriction',()=>{
  for(const level of levels)for(const ps of [level.initial,level.witness])for(let i=0;i<ps.length;i++)for(let j=0;j<i;j++){
    const distance=Math.hypot((ps[i].x-ps[j].x)*252,(ps[i].y-ps[j].y)*304);
    a(distance>=44,level.id+': seal centres '+i+'/'+j+' distance '+distance);
  }
  // Player-created overlaps are legal moves, despite being visually dense.
  const state=C.create(levels[0],'overlap');a.equal(C.move(state,0,state.points[1].x,state.points[1].y).history.length,1);
});
