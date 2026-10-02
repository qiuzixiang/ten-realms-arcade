var LoomStorage = (function () {
 'use strict';var KEY='mini-polish:daynight-scroll:v1:save', TUTORIAL='mini-polish:daynight-scroll:v1:tutorial:daynight-scroll-tutorial-v1';
 function blank(){return {version:1,sessions:{},completed:{},outbox:[],chapter:1,cycle:false};}
 function runId(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
 function session(p,mode,date){return {levelId:p.id,mode:mode,date:date||'',runId:runId(),events:[],hints:0};}
 function validSession(s,levels){if(!s||typeof s.runId!=='string'||s.runId.length>100||!['chapter','daily'].includes(s.mode)||typeof s.date!=='string'||!Number.isInteger(s.hints)||s.hints<0)return false;var p=levels.find(function(p){return p.id===s.levelId;});if(s.mode==='daily'&&(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||levels[LoomEngine.daily(s.date,levels.length)].id!==s.levelId))return false;if(s.mode==='chapter'&&s.date!=='')return false;return !!p&&!!LoomEngine.replay(p,s.events);}
 function normalize(raw,levels){var clean=blank();if(!raw||raw.version!==1)return clean;clean.chapter=Number.isInteger(raw.chapter)&&raw.chapter>=1&&raw.chapter<=6?raw.chapter:1;clean.cycle=raw.cycle===true;
  Object.keys(raw.sessions||{}).slice(-100).forEach(function(k){var s=raw.sessions[k];if(validSession(s,levels)&&(k===s.levelId||k==='daily:'+s.date))clean.sessions[k]=s;});
  Object.keys(raw.completed||{}).slice(-2000).forEach(function(k){var s=raw.completed[k];if(!validSession(s,levels))return;var p=levels.find(function(p){return p.id===s.levelId;});if(k!==claim(s)||!LoomEngine.analyze(LoomEngine.replay(p,s.events),p.n).complete)return;clean.completed[k]=s;});
  (Array.isArray(raw.outbox)?raw.outbox:[]).forEach(function(payload){if(!payload||!Array.isArray(payload.rewardClaims))return;var key=payload.rewardClaims[0],s=clean.completed[key];if(s&&payload.completionId==='daynight-scroll:'+s.runId&&payload.levelId===s.levelId&&!clean.outbox.some(function(x){return x.completionId===payload.completionId;}))clean.outbox.push(makePayload(s));});return clean;
 }
 function load(storage,levels){try{return normalize(JSON.parse(storage.getItem(KEY)),levels);}catch(e){return blank();}}
 function save(storage,data){try{storage.setItem(KEY,JSON.stringify(data));return true;}catch(e){return false;}}
 function claim(s){return s.mode==='daily'?'daily:'+s.date:s.levelId;}
 function makePayload(s){return {schemaVersion:1,gameId:'daynight-scroll',levelId:s.levelId,mode:s.mode,runId:s.runId,completionId:'daynight-scroll:'+s.runId,rewardClaims:[claim(s)],metrics:{moves:s.events.length,hints:s.hints},completedAt:s.completedAt||''};}
 function settle(data,s,p,storage){var cells=LoomEngine.replay(p,s.events);if(!cells||!LoomEngine.analyze(cells,p.n).complete)return {complete:false};var key=claim(s);if(!data.completed[key]){var proof=JSON.parse(JSON.stringify(s));proof.completedAt=new Date().toISOString();data.completed[key]=proof;data.outbox.push(makePayload(proof));}var persisted=save(storage,data);return {complete:true,persisted:persisted};}
 function flush(data,storage,host){if(!host||!save(storage,data))return;data.outbox=data.outbox.filter(function(payload){try{return host(JSON.parse(JSON.stringify(payload)))!==true;}catch(e){return true;}});save(storage,data);}
 return {KEY:KEY,TUTORIAL:TUTORIAL,blank:blank,session:session,load:load,save:save,normalize:normalize,settle:settle,flush:flush,claim:claim};
}());
