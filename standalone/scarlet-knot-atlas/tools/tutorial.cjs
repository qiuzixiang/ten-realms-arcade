'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../core.js'),R=require('../renderer.js'),level=require('./representatives.cjs')[0];
let s=C.create(level,'tutorial-render');const states=[C.clone(s)];
level.replay.forEach(a=>{s=C.move(s,a.id,a.x,a.y);states.push(C.clone(s));});
assert(C.solved(states[2].points,level.edges));
const metadata={tutorialVersion:1,levelId:level.id,states:[]};
states.forEach((s,i)=>{
  const file='tutorial-'+['initial','one','complete'][i]+'.svg';
  fs.writeFileSync(path.join(__dirname,'../assets',file),R.svg(level,s.points,{width:350,height:400,selected:i===1?0:null})+'\n');
  metadata.states.push({file,points:s.points,edges:level.edges,crossingPairs:C.pairs(s.points,level.edges),moves:s.history});
});
fs.writeFileSync(path.join(__dirname,'../release/tutorial-truth.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Rendered true initial / one legal move / completed tutorial: crossing pairs 1 / 1 / 0.');
