(function(root){'use strict';
var E=root.SandEngine, prefix='mini-polish:sandscript-post:v1:', seq=0;
function fresh(level){return {schema:1,levelId:level.id,runId:'sand-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+(++seq),log:[],hints:0,notes:[]};}
function validSession(s,levels){if(!s||s.schema!==1||typeof s.runId!=='string'||!/^sand-[a-z0-9-]{8,100}$/.test(s.runId)||!Number.isInteger(s.hints)||s.hints<0||s.hints>10000)return null;var l=levels.find(function(x){return x.id===s.levelId;});if(!l||!E.replay(l,s.log))return null;var copy=JSON.parse(JSON.stringify(s));copy.notes=Array.isArray(s.notes)?s.notes.filter(function(n){return Number.isInteger(n)&&n>=0&&n<l.arrows.length;}):[];return copy;}
function open(storage,levels){
 var db={schema:1,current:null,records:{},outbox:{},seen:false},error='';
 try{var raw=storage.getItem(prefix+'ledger');if(raw){var read=JSON.parse(raw);if(!read||read.schema!==1)throw Error('version');db.seen=read.seen===true;db.current=validSession(read.current,levels);if(read.current&&!db.current)error='损坏的进度已安全重置';
 levels.forEach(function(l){var rec=read.records&&read.records[l.id],s=rec&&validSession(rec.session,levels);if(s&&s.levelId===l.id&&E.inspect(l,E.replay(l,s.log)).won){db.records[l.id]={session:s};}});Object.keys(read.outbox||{}).forEach(function(id){var item=read.outbox[id],saved=validSession(item&&item.session,levels);if(!saved)return;var lev=levels.find(function(x){return x.id===saved.levelId;}),p=payload(lev,saved);if(p.completionId===id&&E.inspect(lev,E.replay(lev,saved.log)).won)db.outbox[id]={session:saved,payload:p};});}}
 catch(e){error='存档无法读取，本次从新邮路开始';}
 function save(){try{storage.setItem(prefix+'ledger',JSON.stringify(db));error='';return true;}catch(e){error='本地存储不可用，进度仅保留在本次打开期间';return false;}}
 function settle(l,s){var next=E.replay(l,s.log);if(!next||!E.inspect(l,next).won)return false;var old=db.records[l.id];if(!old||s.hints<old.session.hints){db.records[l.id]={session:JSON.parse(JSON.stringify(s))};var p=payload(l,s);db.outbox[p.completionId]={session:JSON.parse(JSON.stringify(s)),payload:p};}db.current=s;return save();}
 var busy={};function flush(host){if(!host||typeof host.complete!=='function')return Promise.resolve();if(!save())return Promise.resolve();return Promise.all(Object.keys(db.outbox).map(function(id){if(busy[id])return Promise.resolve();busy[id]=true;return Promise.resolve().then(function(){return host.complete(db.outbox[id].payload);}).then(function(ack){if(ack===true||ack&&ack.accepted===true){delete db.outbox[id];save();}}).catch(function(){}).then(function(){delete busy[id];});}));}
 return {db:db,save:save,settle:settle,flush:flush,error:function(){return error;}};
}
function payload(l,s){return {gameId:'sandscript-post',levelId:l.id,runId:s.runId,completionId:'sandscript-post:'+s.runId+':complete',rewardClaimId:'sandscript-post:'+l.id+':'+(s.hints?'assisted':'independent'),hints:s.hints};}
root.SandStore={open:open,fresh:fresh,validSession:validSession,prefix:prefix};
})(typeof window==='undefined'?globalThis:window);
