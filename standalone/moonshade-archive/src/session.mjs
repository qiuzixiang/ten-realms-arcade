import {fresh,act,replay,analyze} from './engine.mjs';
export const SAVE_KEY='mini-polish:moonshade-archive:v1:save';
export const TUTORIAL_KEY='mini-polish:moonshade-archive:v1:moonshade-archive-tutorial-v1';
export function uid(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}
export function dayStamp(date){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
export function dailyIndex(date){return Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000)%60;}
export function newSession(p,mode='campaign',date=''){return {levelId:p.id,mode,date,runId:uid(),log:[],hints:0};}
function safeSession(value,levels){if(!value||typeof value!=='object')return null;const p=levels.find(x=>x.id===value.levelId);if(!p||!['campaign','daily'].includes(value.mode)||typeof value.runId!=='string'||!/^[a-z0-9-]{5,70}$/.test(value.runId)||!Number.isInteger(value.hints)||value.hints<0||value.hints>10000)return null;
 const date=value.mode==='daily'?value.date:'';if(value.mode==='daily'){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;const parts=date.split('-').map(Number),d=new Date(parts[0],parts[1]-1,parts[2],12);if(dayStamp(d)!==date||levels[dailyIndex(d)].id!==p.id)return null;}
 const s=replay(p,value.log);if(!s)return null;return {levelId:p.id,mode:value.mode,date:date,runId:value.runId,log:value.log.map(a=>a.slice()),hints:value.hints};}
function recordKey(s){return s.mode==='daily'?'daily:'+s.date+':'+s.levelId:s.levelId;}
function emptySave(){return {schemaVersion:1,session:null,records:{},outbox:[],settled:[],quick:false};}
function payload(s,claims,when){return {schemaVersion:1,gameId:'moonshade-archive',levelId:s.levelId,mode:s.mode,runId:s.runId,completionId:'moonshade-archive:'+s.runId,rewardClaims:claims,metrics:{moves:s.log.length,hints:s.hints,independent:s.hints===0},completedAt:when};}
export function loadSave(storage,levels){const clean=emptySave();try{const raw=JSON.parse(storage.getItem(SAVE_KEY)||'null');if(!raw||raw.schemaVersion!==1)return clean;clean.session=safeSession(raw.session,levels);clean.quick=raw.quick===true;
 if(raw.records&&typeof raw.records==='object')Object.keys(raw.records).forEach(key=>{const r=raw.records[key],s=safeSession(r,levels),p=s&&levels.find(x=>x.id===s.levelId);if(s&&recordKey(s)===key&&analyze(p,replay(p,s.log)).complete&&typeof r.completedAt==='string'&&!isNaN(Date.parse(r.completedAt)))clean.records[key]=Object.assign(s,{completedAt:r.completedAt});});
 if(Array.isArray(raw.settled))clean.settled=raw.settled.filter(s=>typeof s==='string'&&/^[a-z0-9-]{5,70}$/.test(s)).slice(-200);
 if(Array.isArray(raw.outbox))raw.outbox.forEach(item=>{const s=safeSession(item.session,levels),p=s&&levels.find(x=>x.id===s.levelId);if(!s||!analyze(p,replay(p,s.log)).complete||!clean.records[recordKey(s)]||typeof item.when!=='string'||isNaN(Date.parse(item.when)))return;const allowed=[recordKey(s)+':first'];if(s.hints===0)allowed.push(recordKey(s)+':independent');const claims=Array.isArray(item.claims)?item.claims.filter((x,i,a)=>allowed.includes(x)&&a.indexOf(x)===i):[];if(!clean.outbox.some(x=>x.session.runId===s.runId))clean.outbox.push({session:s,claims,when:item.when});});
 }catch(e){}return clean;}
export function persist(storage,save){try{storage.setItem(SAVE_KEY,JSON.stringify(save));return true;}catch(e){return false;}}
export function changeSession(p,s,i,mode){if(!s||s.log.length>=10000)return s;const current=replay(p,s.log);if(!current)return s;const next=act(p,current,i,mode);if(next===current)return s;return Object.assign({},s,{log:s.log.concat([[i,mode]])});}
export function undoSession(s){return s.log.length?Object.assign({},s,{log:s.log.slice(0,-1)}):s;}
export function finish(save,p,storage,now=new Date().toISOString()){
 const s=save.session;if(!s||s.levelId!==p.id||!analyze(p,replay(p,s.log)).complete)return {completed:false,persisted:false};if(save.settled.includes(s.runId))return {completed:true,persisted:persist(storage,save),duplicate:true};
 const key=recordKey(s),old=save.records[key],claims=[];if(!old)claims.push(key+':first');if(s.hints===0&&(!old||old.hints!==0))claims.push(key+':independent');
 if(!old||(old.hints>0&&s.hints===0))save.records[key]=Object.assign({},s,{log:s.log.map(a=>a.slice()),completedAt:now});
 save.settled.push(s.runId);save.settled=save.settled.slice(-200);
 if(claims.length)save.outbox.push({session:Object.assign({},s,{log:s.log.map(a=>a.slice())}),claims,when:now});
 return {completed:true,persisted:persist(storage,save),claims};
}
export async function flush(save,storage,host){if(typeof host!=='function'||!persist(storage,save))return false;
 while(save.outbox.length){const item=save.outbox[0];try{const ack=await host(payload(item.session,item.claims,item.when));if(ack!==true)return false;}catch(e){return false;}save.outbox.shift();if(!persist(storage,save)){save.outbox.unshift(item);return false;}}
 return true;
}
