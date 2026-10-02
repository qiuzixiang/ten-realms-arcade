(function(root){
'use strict';
const E=root.SilkEngine||(typeof require==='function'?require('./engine.js'):null);
const L=(root.SilkLevels||(typeof require==='function'?require('./levels.js'):null)).levels;
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
function fresh(level,practice) {return {levelId:level.id,checksum:level.checksum,generatorVersion:level.generatorVersion,runId:uid(),actions:[],redo:[],practice:!!practice,hintCount:0};}
const board=run=>E.replay(L.find(l=>l.id===run.levelId).initial,run.actions);
function act(run,a){if(!E.validAction(a)||run.actions.length>=4096||E.solved(board(run)))return false;run.actions.push(Object.assign({},a));run.redo=[];return true;}
function undo(run){if(!run.actions.length)return false;run.redo.push(run.actions.pop());return true;}
function redo(run){if(!run.redo.length||run.actions.length>=4096)return false;run.actions.push(run.redo.pop());return true;}
function validRun(r){const l=r&&L.find(l=>l.id===r.levelId);return !!l&&r.checksum===l.checksum&&r.generatorVersion===l.generatorVersion&&typeof r.runId==='string'&&/^[a-z0-9-]{8,80}$/.test(r.runId)&&Array.isArray(r.actions)&&r.actions.length<=4096&&r.actions.every(E.validAction)&&Array.isArray(r.redo)&&r.redo.length<=4096&&r.redo.every(E.validAction)&&typeof r.practice==='boolean'&&Number.isInteger(r.hintCount)&&r.hintCount>=0&&r.hintCount<=10000;}
function validReceipt(r){return validRun(r)&&r.redo.length===0&&r.actions.length>0&&E.solved(board(r));}
function initial(){return {schema:1,run:fresh(L[0]),receipts:{},claims:[],outbox:[],settings:{target:true,motion:true,sound:false},tutorialSeen:false};}
function reconcile(candidate){
 const out=initial();if(!candidate||candidate.schema!==1)return out;
 if(validRun(candidate.run))out.run=JSON.parse(JSON.stringify(candidate.run));
 L.forEach(l=>{const r=candidate.receipts&&candidate.receipts[l.id];if(validReceipt(r))out.receipts[l.id]=JSON.parse(JSON.stringify(r));});
 if(candidate.settings){['target','motion','sound'].forEach(k=>{if(typeof candidate.settings[k]==='boolean')out.settings[k]=candidate.settings[k];});}
 out.tutorialSeen=candidate.tutorialSeen===true;
 // Reconstruct reward claims from replay-verified receipts; booleans/foreign claim IDs are ignored.
 const permissible=new Set();Object.keys(out.receipts).forEach(id=>{if(!out.receipts[id].practice)permissible.add('silk-loop-studio:'+id+':first');});
 out.claims=Array.from(permissible);
 if(Array.isArray(candidate.outbox))out.outbox=candidate.outbox.filter(p=>p&&permissible.has(p.claimId)&&p.eventId===p.claimId&&p.gameId==='silk-loop-studio'&&p.levelId===p.claimId.split(':')[1]).slice(0,48).map(p=>{const r=out.receipts[p.levelId];return {gameId:'silk-loop-studio',levelId:r.levelId,runId:r.runId,completionId:r.runId+':complete',claimId:p.claimId,eventId:p.claimId,moves:r.actions.length};});
 out.outbox=out.outbox.filter((p,i,all)=>all.findIndex(v=>v.eventId===p.eventId)===i);
 return out;
}
function settle(data){
 const r=data.run;if(!validReceipt(r))return null;
 const previous=data.receipts[r.levelId];
 const best = !previous || (previous.practice&&!r.practice) || (previous.practice===r.practice&&r.actions.length<previous.actions.length);
 if(best)data.receipts[r.levelId]=JSON.parse(JSON.stringify(r));
 const claimId='silk-loop-studio:'+r.levelId+':first';let earned=false;
 if(!r.practice&&!data.claims.includes(claimId)){data.claims.push(claimId);const p={gameId:'silk-loop-studio',levelId:r.levelId,runId:r.runId,completionId:r.runId+':complete',claimId,eventId:claimId,moves:r.actions.length};data.outbox.push(p);earned=true;}
 return {earned,best,practice:r.practice,moves:r.actions.length,completionId:r.runId+':complete'};
}
async function flush(data,save,host){
 if(!await save(data))return false;
 if(typeof host!=='function')return true;
 for(const p of data.outbox.slice()){try{if(await host(p)===true){data.outbox=data.outbox.filter(v=>v.eventId!==p.eventId);await save(data);}}catch(e){/* retain stable event for retry */}}
 return true;
}
const api={fresh,board,act,undo,redo,validRun,validReceipt,initial,reconcile,settle,flush};root.SilkSession=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
