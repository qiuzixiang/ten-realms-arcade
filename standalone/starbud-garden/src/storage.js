var Starbud = typeof Starbud === 'undefined' ? {} : Starbud;
(function(S){
'use strict';
const PREFIX='mini-polish:starbud-garden:v1:',TUTORIAL='starbud-garden-tutorial-v1';
function fresh(){return {version:1,current:0,sessions:{},completed:{},outbox:{},ack:[],favorites:[],tutorial:'',reduced:false};}
function uid(){return 'sg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
function restore(raw,levels){const data=fresh();if(!raw||raw.version!==1)return data;data.current=Number.isSafeInteger(raw.current)&&raw.current>=0&&raw.current<levels.length?raw.current:0;data.tutorial=raw.tutorial===TUTORIAL?TUTORIAL:'';data.reduced=raw.reduced===true;data.favorites=Array.isArray(raw.favorites)?levels.filter(p=>raw.favorites.includes(p.id)).map(p=>p.id):[];
 for(const p of levels){const saved=raw.sessions&&raw.sessions[p.id];if(saved&&typeof saved.runId==='string'&&saved.runId.length<100){try{S.replay(p,saved.actions);data.sessions[p.id]={runId:saved.runId,actions:saved.actions,hints:Number.isSafeInteger(saved.hints)&&saved.hints>=0?saved.hints:0};}catch(e){}}
 const proof=raw.completed&&raw.completed[p.id];if(proof&&typeof proof.runId==='string'&&proof.runId.length<100){try{const state=S.replay(p,proof.actions);if(S.evaluate(p,state).complete){data.completed[p.id]={runId:proof.runId,actions:proof.actions,hints:Number.isSafeInteger(proof.hints)&&proof.hints>=0?proof.hints:0};const event=eventFor(p,proof.runId);if(Array.isArray(raw.ack)&&raw.ack.includes(event.rewardClaimId))data.ack.push(event.rewardClaimId);else data.outbox[event.rewardClaimId]=event;}}catch(e){}}}
 return data;
}
function eventFor(p,runId){return {game:'starbud-garden',levelId:p.id,runId,completionId:runId+':complete',rewardClaimId:'starbud-garden:v1:'+p.id+':first',type:'complete'};}
function complete(data,p,state,session){if(!S.evaluate(p,state).complete||data.completed[p.id])return false;data.completed[p.id]={runId:session.runId,actions:state.actions.slice(),hints:session.hints};const event=eventFor(p,session.runId);data.outbox[event.rewardClaimId]=event;return true;}
async function adapter(root){const x=root.xhs,mini=x&&x.miniTool;let build=Number(x&&x.launchOptions&&x.launchOptions.miniToolEnv&&x.launchOptions.miniToolEnv.buildVersion)||0;if(!build&&mini&&typeof mini.getLaunchOptions==='function')try{const o=await mini.getLaunchOptions();build=Number(o&&o.miniToolEnv&&o.miniToolEnv.buildVersion)||0;}catch(e){}
 const native=Math.floor(build/1000)>=9460&&mini&&typeof mini.getStorage==='function'&&typeof mini.setStorage==='function';const key=PREFIX+'garden';
 return {kind:native?'native':'browser',async read(){if(native){try{const r=await mini.getStorage({key});if(r&&r.data)return r.data;}catch(e){const reason=String(e&&(e.errMsg||e.message)||e);if(!/not.*(found|exist)|不存在|找不到/i.test(reason))throw Error('native-storage-unavailable');} // Migrate only valid browser data, preserving old data until native write succeeds.
 let old=null;try{old=JSON.parse(root.localStorage.getItem(key)||'null');}catch(e){}if(old){try{await mini.setStorage({key,data:old});return old;}catch(e){return old;}}return null;}
 try{return JSON.parse(root.localStorage.getItem(key)||'null');}catch(e){return null;}},async write(data){try{if(native)await mini.setStorage({key,data});else root.localStorage.setItem(key,JSON.stringify(data));return true;}catch(e){return false;}}};
}
// Optional web host callback is injected by the integrator, never a fabricated native API.
async function flush(data,save,host){if(!(await save(data)))return false;if(typeof host!=='function')return true;for(const id of Object.keys(data.outbox)){try{await host(data.outbox[id]);delete data.outbox[id];if(!data.ack.includes(id))data.ack.push(id);if(!(await save(data)))return false;}catch(e){return false;}}return true;}
Object.assign(S,{PREFIX,TUTORIAL,fresh,uid,restore,complete,eventFor,adapter,flush});
})(Starbud);
if(typeof module!=='undefined')module.exports=Starbud;
