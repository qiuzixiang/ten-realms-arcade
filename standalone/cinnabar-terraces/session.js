(function(root){
  'use strict';var E=root.TerraceEngine;
  function newRun(l){return {levelId:l.id,checksum:l.checksum,generatorVersion:l.generatorVersion,runId:'ct-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),state:E.blank(l.n),hints:0,practice:false,selected:0,mode:'fill'};}
  function fresh(l){return {schema:1,current:newRun(l),completed:{},outbox:[],tutorial:0};}
  function validRecord(r,l){return !!r && r.levelId===l.id && r.checksum===l.checksum && typeof r.runId==='string' && r.runId.length>5 && r.runId.length<100 && E.integer(r.hints,0,100000) && r.completionId===r.runId+':complete' && r.rewardClaimId==='cinnabar-terraces:'+l.id+':first' && E.evaluate(l,r.values).complete;}
  function restore(raw,levels){
    var map={};levels.forEach(function(l){map[l.id]=l;});var data=fresh(levels[0]),repaired=false;
    if(!raw || raw.schema!==1)return {data:data,repaired:!!raw};
    if(raw.completed && typeof raw.completed==='object')Object.keys(raw.completed).forEach(function(id){if(map[id] && validRecord(raw.completed[id],map[id]))data.completed[id]=Object.assign({},raw.completed[id],{values:raw.completed[id].values.slice()});else repaired=true;});
    if(Array.isArray(raw.outbox))data.outbox=raw.outbox.filter(function(p,i,all){return p && data.completed[p.levelId] && p.rewardClaimId===data.completed[p.levelId].rewardClaimId && p.completionId===data.completed[p.levelId].completionId && all.findIndex(function(q){return q && q.rewardClaimId===p.rewardClaimId;})===i;}).map(function(p){return payload(data.completed[p.levelId],map[p.levelId]);});
    var c=raw.current,l=c && map[c.levelId],s=l && E.normalize(c.state,l.n);
    if(c && l && s && c.checksum===l.checksum && c.generatorVersion===l.generatorVersion && typeof c.runId==='string' && c.runId.length>5 && c.runId.length<100 && E.integer(c.hints,0,100000) && typeof c.practice==='boolean')data.current={levelId:l.id,checksum:l.checksum,generatorVersion:l.generatorVersion,runId:c.runId,state:s,hints:c.hints,practice:c.practice,selected:E.integer(c.selected,0,l.n*l.n-1)?c.selected:0,mode:c.mode==='note'?'note':'fill'};else repaired=true;
    data.tutorial=E.integer(raw.tutorial,0,100)?raw.tutorial:0;return {data:data,repaired:repaired};
  }
  function payload(r,l){return {gameId:'cinnabar-terraces',levelId:l.id,generatorVersion:l.generatorVersion,seed:l.seed,runId:r.runId,completionId:r.completionId,rewardClaimId:r.rewardClaimId,reward:'terracotta-seal',hints:r.hints};}
  function settle(data,l){var c=data.current;if(!E.evaluate(l,c.state.values).complete || c.practice || data.completed[l.id])return false;
    var record={levelId:l.id,checksum:l.checksum,runId:c.runId,completionId:c.runId+':complete',rewardClaimId:'cinnabar-terraces:'+l.id+':first',values:c.state.values.slice(),hints:c.hints};data.completed[l.id]=record;data.outbox.push(payload(record,l));return true;}
  root.TerraceSession={newRun:newRun,fresh:fresh,restore:restore,settle:settle,payload:payload,validRecord:validRecord};if(typeof module!=='undefined')module.exports=root.TerraceSession;
})(typeof window!=='undefined'?window:global);
