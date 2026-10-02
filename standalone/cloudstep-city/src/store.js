var CityStore = (function(){
 const key='mini-polish:cloudstep-city:v1:save', tutorialKey='mini-polish:cloudstep-city:tutorial:v1';
 function empty(){return {version:1,sessions:{},records:{},outbox:[],claims:[]};}
 function load(storage,levels){let d;try{d=JSON.parse(storage.getItem(key));}catch(e){return empty();}if(!d||d.version!==1)return empty();const clean=empty();
  levels.forEach(p=>{
   Object.keys(d.sessions||{}).filter(k=>k===p.id||new RegExp('^daily:[0-9]{4}-[0-9]{2}-[0-9]{2}:'+p.id+'$').test(k)).slice(-120).forEach(k=>{try{const s=d.sessions[k];if(!s||typeof s.runId!=='string'||!Number.isInteger(s.hints)||s.hints<0)return;City.replay(p,s.actions);clean.sessions[k]={runId:s.runId,actions:s.actions,hints:s.hints,mode:k===p.id?'chapter':'daily'};}catch(e){}});
   try{const r=d.records[p.id];if(r&&typeof r.completionId==='string'&&r.completionId.indexOf('cloudstep-city:'+p.id+':')===0&&City.evaluate(p,City.replay(p,r.actions)).complete&&Number.isInteger(r.hints)&&r.hints>=0){clean.records[p.id]={actions:r.actions,hints:r.hints,completionId:r.completionId};clean.claims.push('first:'+p.id);if(!r.hints)clean.claims.push('independent:'+p.id);}}catch(e){}
  });
  if(Array.isArray(d.outbox))clean.outbox=d.outbox.filter(x=>x&&x.schemaVersion===1&&x.gameId==='cloudstep-city'&&clean.records[x.levelId]&&typeof x.runId==='string'&&x.completionId==='cloudstep-city:'+x.levelId+':'+x.runId&&Array.isArray(x.rewardClaims)&&x.rewardClaims.length>0&&x.rewardClaims.every(c=>clean.claims.includes(c)&&(c==='first:'+x.levelId||c==='independent:'+x.levelId))&&x.metrics&&Number.isInteger(x.metrics.hints)&&x.metrics.hints>=0&&typeof x.completedAt==='string'&&['daily','chapter'].includes(x.mode)).slice(-120).map(x=>({schemaVersion:1,gameId:'cloudstep-city',levelId:x.levelId,mode:x.mode,runId:x.runId,completionId:x.completionId,rewardClaims:x.rewardClaims.slice(),metrics:{hints:x.metrics.hints},completedAt:x.completedAt}));
  return clean;
 }
 function save(storage,d){try{storage.setItem(key,JSON.stringify(d));return true;}catch(e){return false;}}
 function settle(d,p,s,now){if(!City.evaluate(p,City.replay(p,s.actions)).complete)return null;const claim='first:'+p.id,ind='independent:'+p.id;const rewards=[];if(!d.claims.includes(claim))rewards.push(claim);if(!s.hints&&!d.claims.includes(ind))rewards.push(ind);if(!rewards.length)return null;const id='cloudstep-city:'+p.id+':'+s.runId;
  const payload={schemaVersion:1,gameId:'cloudstep-city',levelId:p.id,mode:s.mode,runId:s.runId,completionId:id,rewardClaims:rewards,metrics:{hints:s.hints},completedAt:now};d.claims=d.claims.concat(rewards);d.records[p.id]={actions:s.actions.slice(),hints:s.hints,completionId:id};d.outbox.push(payload);return payload;
 }
 function recover(d,levels,now){let count=0;Object.keys(d.sessions).forEach(k=>{const p=levels.find(p=>k===p.id||k.slice(-p.id.length)===p.id);if(!p)return;try{if(settle(d,p,d.sessions[k],now))count++;}catch(e){}});return count;}
 function deliver(storage,d,host){if(typeof host!=='function'||!save(storage,d))return;d.outbox.slice().forEach(p=>{try{if(host(JSON.parse(JSON.stringify(p)))===true){d.outbox=d.outbox.filter(x=>x.completionId!==p.completionId);save(storage,d);}}catch(e){}});}
 return {key:key,tutorialKey:tutorialKey,empty:empty,load:load,save:save,settle:settle,recover:recover,deliver:deliver};
})();
