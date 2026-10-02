'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const core=require('../core.js'),oracle=require('./oracle.cjs');
const campaign=process.argv.includes('--campaign'),all=require('../levels.js'),levels=campaign?all:[0,8,14,18,24,32,40,47].map(i=>all[i]);
function lattice(points) { return points.map(p=>({id:p.id,x:Math.round(p.x*1000),y:Math.round(p.y*1000)})); }
const proofs=levels.map(level=>{
  assert(core.validGraph(level.initial,level.edges));
  assert(core.pairs(level.initial,level.edges).length>0);
  assert.deepEqual(core.pairs(level.initial,level.edges),oracle.pairs(lattice(level.initial),level.edges));
  assert.deepEqual(oracle.pairs(lattice(level.witness),level.edges),[]);
  let state=core.create(level,'proof-'+level.id);
  level.replay.forEach(a=>{state=core.move(state,a.id,a.x,a.y);});
  assert(core.solved(state.points,level.edges));
  assert.deepEqual(state.points,level.witness);
  assert.deepEqual(core.restore(level,state),state);
  return {id:level.id,nodes:level.initial.length,edges:level.edges.length,initialCrossingPairs:core.pairs(level.initial,level.edges).length,witnessCrossingPairs:0,replayedMoves:state.history.length,method:'independent exact BigInt determinant + legal runtime replay',claim:'solvable; no uniqueness or optimality claim'};
});
fs.mkdirSync(path.join(__dirname,'../release'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../release/'+(campaign?'campaign-proofs':'representative-proofs')+'.json'),JSON.stringify({stage:campaign?'campaign_geometry_only_not_play_review':'representatives_only_not_campaign',verifiedCount:proofs.length,proofs},null,2)+'\n');
console.log('Verified '+proofs.length+' '+(campaign?'campaign':'representative')+' graphs with independent oracle and runtime replay.');
