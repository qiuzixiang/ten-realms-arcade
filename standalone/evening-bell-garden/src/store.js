var BellStore = (function () {
  'use strict';
  var key='mini-polish:evening-bell-garden:v1:save', tutorialKey='mini-polish:evening-bell-garden:v1:tutorial:evening-bell-garden-tutorial-v1';
  function fresh(){return {schemaVersion:1,records:{},receipts:{},outbox:[],session:null,quick:false};}
  function dateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function daily(date){var h=2166136261;('bell-bank-1:'+date).split('').forEach(function(c){h=Math.imul(h^c.charCodeAt(0),16777619);});return BellLevels.levels[20+(h>>>0)%40];}
  function levelById(id){return BellLevels.levels.find(function(l){return l.id===id;});}
  function resolve(k){if(/^chapter-\d\d-level-\d\d$/.test(k))return levelById(k);if(/^daily-v1-\d{4}-\d{2}-\d{2}$/.test(k)){var parts=k.slice(9).split('-').map(Number),date=new Date(parts[0],parts[1]-1,parts[2]);if(dateKey(date)===k.slice(9))return daily(k.slice(9));}return null;}
  function validHistory(l,h){return !!l&&!!BellEngine.replay(l,h);}
  function validWin(l,r){return r&&validHistory(l,r.history)&&BellEngine.won(l,{history:r.history})&&typeof r.assisted==='boolean';}
  function normalize(raw){
    var s=fresh();if(!raw||raw.schemaVersion!==1)return s;
    s.quick=raw.quick===true;
    if(raw.records&&typeof raw.records==='object')Object.keys(raw.records).forEach(function(k){var l=resolve(k),r=raw.records[k];if(!l||!r)return;var o={};['best','solo'].forEach(function(t){if(validWin(l,r[t])&&(t!=='solo'||r[t].assisted===false))o[t]={history:r[t].history.slice(),assisted:r[t].assisted};});if(o.best||o.solo)s.records[k]=o;});
    if(raw.receipts&&typeof raw.receipts==='object')Object.keys(raw.receipts).forEach(function(id){var r=raw.receipts[id];if(!/^run-[a-z0-9-]+:complete$/.test(id)||!r||r.completionId!==id||!validWin(resolve(r.key),r))return;var l=resolve(r.key),p=r.payload||{},allowed=claimsFor(s),claims=Array.isArray(p.rewardClaims)?p.rewardClaims.filter(function(c,i,a){return typeof c==='string'&&c.indexOf(r.key+':')===0&&allowed.indexOf(c)>=0&&a.indexOf(c)===i;}):[];
      var payload={schemaVersion:1,gameId:'evening-bell-garden',levelId:l.id,mode:r.key.indexOf('daily-')===0?'daily':'chapter',runId:id.slice(0,-9),completionId:id,rewardClaims:claims,metrics:{moves:r.history.length,minimum:l.minimum,assisted:r.assisted,puzzleKey:r.key},completedAt:typeof p.completedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.completedAt)?p.completedAt:'1970-01-01T00:00:00.000Z'};
      s.receipts[id]={key:r.key,history:r.history.slice(),assisted:r.assisted,completionId:id,payload:payload};});
    if(Array.isArray(raw.outbox))s.outbox=raw.outbox.filter(function(id,i,a){return typeof id==='string'&&Object.prototype.hasOwnProperty.call(s.receipts,id)&&a.indexOf(id)===i;});
    var x=raw.session;
    if(x&&resolve(x.key)&&/^run-[a-z0-9-]+$/.test(x.runId)&&validHistory(resolve(x.key),x.history))s.session={key:x.key,runId:x.runId,history:x.history.slice(),assisted:x.assisted===true};
    return s;
  }
  function load(storage){try{return normalize(JSON.parse(storage.getItem(key)));}catch(e){return fresh();}}
  function save(storage,s){try{storage.setItem(key,JSON.stringify(s));return true;}catch(e){return false;}}
  function claimsFor(s){var claims=[];Object.keys(s.records).forEach(function(k){var r=s.records[k],l=resolve(k);if(r.solo){claims.push(k+':first-solo');if(r.solo.history.length===l.minimum)claims.push(k+':efficient');}});return claims;}
  function settle(s,session,now){
    if(!session||!/^run-[a-z0-9-]+$/.test(session.runId))return null;var l=resolve(session.key);if(!validWin(l,session))return null;
    var id=session.runId+':complete';if(s.receipts[id])return s.receipts[id].payload;
    var before=claimsFor(s),r=s.records[session.key]||{},copy={history:session.history.slice(),assisted:session.assisted};
    if(!r.best||copy.history.length<r.best.history.length)r.best=copy;
    if(!copy.assisted&&(!r.solo||copy.history.length<r.solo.history.length))r.solo=copy;
    s.records[session.key]=r;
    var claims=claimsFor(s).filter(function(c){return before.indexOf(c)<0;});
    var payload={schemaVersion:1,gameId:'evening-bell-garden',levelId:l.id,mode:session.key.indexOf('daily-')===0?'daily':'chapter',runId:session.runId,completionId:id,rewardClaims:claims,metrics:{moves:copy.history.length,minimum:l.minimum,assisted:copy.assisted,puzzleKey:session.key},completedAt:now};
    s.receipts[id]={key:session.key,history:copy.history,assisted:copy.assisted,completionId:id,payload:payload};s.outbox.push(id);return payload;
  }
  function flush(storage,s,host){
    if(!save(storage,s))return false;
    if(typeof host!=='function')return true;
    s.outbox.slice().forEach(function(id){try{if(host(s.receipts[id].payload)===true){s.outbox=s.outbox.filter(function(x){return x!==id;});save(storage,s);}}catch(e){/* Retain durable receipt for same-id retry. */}});return true;
  }
  return {key:key,tutorialKey:tutorialKey,fresh:fresh,normalize:normalize,load:load,save:save,settle:settle,flush:flush,claimsFor:claimsFor,resolve:resolve,daily:daily,dateKey:dateKey};
}());
