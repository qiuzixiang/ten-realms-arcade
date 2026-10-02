'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../core.js'),R=require('../renderer.js'),level=require('../tools/representatives.cjs')[0];
test('renderer uses exact formal points, all straight edges, all knot pairs in three tutorial states',()=>{
  let s=C.create(level,'tutorial-test');
  for(let i=0;i<3;i++){
    const text=R.svg(level,s.points),pairs=C.pairs(s.points,level.edges);
    assert.equal((text.match(/data-edge=/g)||[]).length,level.edges.length);
    assert.equal((text.match(/data-node=/g)||[]).length,level.initial.length);
    assert.equal((text.match(/data-knot=/g)||[]).length,pairs.length);
    assert(text.includes('data-crossings="'+pairs.length+'"'));
    s.points.forEach(p=>assert(text.includes('data-node="'+p.id+'" data-x="'+p.x+'" data-y="'+p.y+'"')));
    if(i<2){const a=level.replay[i];s=C.move(s,a.id,a.x,a.y);}
  }
  assert(C.solved(s.points,level.edges));
});
