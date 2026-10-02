(function(root){'use strict';const E=typeof module!=='undefined'?require('./engine.js'):root.AuroraEngine;
const PREFIX='mini-polish:aurora-beacons:v1:';
function fresh(p,id){return {levelId:p.id,runId:id,actions:[],state:E.initial(p)};}
function act(p,s,a){const state=E.move(p,s.state,a);if(state===s.state)return s;return {levelId:s.levelId,runId:s.runId,actions:s.actions.concat([a]),state};}
function undo(p,s){const actions=s.actions.slice(0,-1);return {levelId:s.levelId,runId:s.runId,actions,state:E.replay(p,actions)};}
function restore(raw,levels,id){let result={session:fresh(levels[0],id),records:{},outbox:[],delivered:[]};try{let d=JSON.parse(raw);if(!d||d.version!==1)return result;let p=levels.find(x=>x.id===d.session.levelId);if(p&&typeof d.session.runId==='string'&&/^[a-zA-Z0-9-]{1,90}$/.test(d.session.runId))result.session={levelId:p.id,runId:d.session.runId,actions:d.session.actions,state:E.replay(p,d.session.actions)};
 if(d.records&&typeof d.records==='object')levels.forEach(p=>{const rec=d.records[p.id];if(rec&&Array.isArray(rec.actions)&&typeof rec.runId==='string'&&/^[a-zA-Z0-9-]{1,90}$/.test(rec.runId)&&E.inspect(p,E.replay(p,rec.actions)).complete)result.records[p.id]={actions:rec.actions,runId:rec.runId};});
 const valid=Object.keys(result.records).map(k=>payload(k,result.records[k].runId));result.delivered=Array.isArray(d.delivered)?d.delivered.filter(x=>valid.some(v=>v.completionId===x)):[];result.outbox=valid.filter(v=>result.delivered.indexOf(v.completionId)<0);
 }catch(e){/* damaged data falls back; never remove unrelated keys */}return result;}
function payload(levelId,runId){return {game:'aurora-beacons',version:1,levelId,runId,completionId:'aurora-beacons:'+runId,rewardClaimId:'aurora-beacons:first:'+levelId};}
function encode(d){return JSON.stringify({version:1,session:{levelId:d.session.levelId,runId:d.session.runId,actions:d.session.actions},records:d.records,outbox:d.outbox,delivered:d.delivered});}
function commit(p,d,storage,host){if(E.inspect(p,d.session.state).complete&&!d.records[p.id]){d.records[p.id]={runId:d.session.runId,actions:d.session.actions.slice()};d.outbox.push(payload(p.id,d.session.runId));}storage.setItem(PREFIX+'save',encode(d));if(typeof host==='function'){const pending=d.outbox.slice();pending.forEach(v=>{try{if(host(v)!==true)return;d.outbox=d.outbox.filter(x=>x.completionId!==v.completionId);d.delivered.push(v.completionId);storage.setItem(PREFIX+'save',encode(d));}catch(e){/* retain stable outbox for retry */}});}return d;}
function daily(date,levels){const day=Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);return levels[((day%levels.length)+levels.length)%levels.length];}
const api={PREFIX,fresh,act,undo,restore,encode,commit,daily};if(typeof module!=='undefined')module.exports=api;else root.AuroraSession=api;
})(typeof window!=='undefined'?window:globalThis);
