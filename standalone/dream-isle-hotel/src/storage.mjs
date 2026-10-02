import {replay,solved} from './engine.mjs';
export const GAME_ID='dream-isle-hotel';
export const PREFIX='mini-polish:'+GAME_ID+':v1:';
export const STORE_KEY=PREFIX+'save';
export const TUTORIAL_KEY=PREFIX+'tutorial:dream-isle-hotel-tutorial-v1';
export function fresh(){return {version:1,sessions:{},records:{},receipts:{},outbox:[]};}
export function runId(){return 'run-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
export function dailyKey(date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
export function dailyIndex(date,version,count){let hash=0;const s=date+':'+version;for(let i=0;i<s.length;i++)hash=(Math.imul(hash,31)+s.charCodeAt(i))>>>0;return hash%count;}
export function sessionKey(id,mode){return mode+':'+id;}
export function validSession(s,levels){
 if(!s||typeof s.runId!=='string'||!/^run-[a-z0-9-]{1,80}$/.test(s.runId)||typeof s.mode!=='string'||! /^(chapter|daily:\d{4}-\d{2}-\d{2}:hotel-v1)$/.test(s.mode))return null;
 const p=levels.find(p=>p.id===s.levelId);if(!p)return null;const state=replay(p,s.actions);return state?{p,state}:null;
}
export function completion(s,state,rewardClaims,time){return {schemaVersion:1,gameId:GAME_ID,levelId:s.levelId,mode:s.mode,runId:s.runId,completionId:GAME_ID+':'+s.runId,rewardClaims,metrics:{rooms:state.rooms.length,assisted:state.helped},completedAt:time};}
export function restore(raw,levels){
 const data=fresh();if(!raw||raw.version!==1)return data;
 if(raw.sessions&&typeof raw.sessions==='object')Object.keys(raw.sessions).slice(0,300).forEach(k=>{const s=raw.sessions[k];if(validSession(s,levels)&&k===sessionKey(s.levelId,s.mode))data.sessions[k]=s;});
 if(raw.records&&typeof raw.records==='object')Object.keys(raw.records).slice(0,500).forEach(k=>{const s=raw.records[k],v=validSession(s,levels);if(v&&solved(v.p,v.state.rooms)&&k===sessionKey(s.levelId,s.mode))data.records[k]=s;});
 if(raw.receipts&&typeof raw.receipts==='object')Object.keys(raw.receipts).slice(0,1000).forEach(k=>{const s=raw.receipts[k],v=validSession(s,levels);if(v&&solved(v.p,v.state.rooms)&&k===GAME_ID+':'+s.runId)data.receipts[k]=s;});
 if(Array.isArray(raw.outbox)){const seen=new Set();raw.outbox.slice(0,500).forEach(e=>{if(!e||seen.has(e.completionId))return;const s=data.receipts[e.completionId];if(!s)return;const v=validSession(s,levels);const expected=completion(s,v.state,claimsFor(s,v.state),s.completedAt);if(JSON.stringify(e)===JSON.stringify(expected)){data.outbox.push(expected);seen.add(e.completionId);}});}
 return data;
}
export function claimsFor(s,state){const key=GAME_ID+':'+sessionKey(s.levelId,s.mode);return [key+':complete'].concat(state.helped?[]:[key+':independent']);}
export function settle(data,s,p,now){
 const state=replay(p,s.actions);if(!state||!solved(p,state.rooms))return null;
 const key=sessionKey(s.levelId,s.mode),old=data.records[key];
 if(old){const prev=replay(p,old.actions);if(!prev.helped||state.helped)return null;}
 const record=Object.assign({},s,{completedAt:now});data.records[key]=record;
 const event=completion(record,state,claimsFor(record,state),now);
 data.receipts[event.completionId]=record;data.outbox.push(event);return event;
}
export function load(storage,levels){try{return restore(JSON.parse(storage.getItem(STORE_KEY)),levels);}catch(e){return fresh();}}
export function persist(storage,data){try{storage.setItem(STORE_KEY,JSON.stringify(data));return true;}catch(e){return false;}}
// Optional same-page host. Boolean true acknowledges the stable completion ID.
export function flush(storage,data,host){if(typeof host!=='function')return;const remaining=[];data.outbox.forEach(e=>{try{if(host(JSON.parse(JSON.stringify(e)))!==true)remaining.push(e);}catch(err){remaining.push(e);}});data.outbox=remaining;persist(storage,data);}
