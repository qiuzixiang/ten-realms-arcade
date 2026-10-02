import {initial,validState,inspect,change} from './engine.mjs';
export const TUTORIAL='frostfield-railway-tutorial-v1';
export function uid(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
export function newRun(p,mode='main'){return {levelId:p.id,mode,runId:uid(),board:initial(p),history:[],hints:0,settled:null};}
export function blank(){return {version:1,selected:'fr-001',chapter:0,tutorial:'',records:{},dailyRecords:{},claims:[],outbox:[],sessions:{}};}
export function normalize(raw,levels){
 const data=blank();if(!raw||raw.version!==1)return data;const ids=new Map(levels.map(p=>[p.id,p]));
 if(ids.has(raw.selected))data.selected=raw.selected;
 if(Number.isInteger(raw.chapter)&&raw.chapter>=0&&raw.chapter<6)data.chapter=raw.chapter;
 if(typeof raw.tutorial==='string')data.tutorial=raw.tutorial.slice(0,80);
 const isId=x=>typeof x==='string'&&/^[a-z0-9:-]{1,160}$/.test(x);
 if(raw.records&&typeof raw.records==='object')levels.forEach(p=>{const r=raw.records[p.id];if(r&&validState(p,r.board)&&inspect(p,r.board).status==='won'&&isId(r.completionId))data.records[p.id]={board:r.board,completionId:r.completionId,assisted:r.assisted===true};});
 if(raw.dailyRecords&&typeof raw.dailyRecords==='object')Object.keys(raw.dailyRecords).forEach(k=>{const r=raw.dailyRecords[k],p=r&&ids.get(r.levelId);if(/^daily:\d{4}-\d{2}-\d{2}$/.test(k)&&p&&isId(r.completionId)&&validState(p,r.board)&&inspect(p,r.board).status==='won')data.dailyRecords[k]={levelId:r.levelId,board:r.board,completionId:r.completionId};});
 if(raw.sessions&&typeof raw.sessions==='object')Object.keys(raw.sessions).slice(0,70).forEach(key=>{const s=raw.sessions[key],p=s&&ids.get(s.levelId);if(!p||!isId(s.runId)||!['main','daily'].includes(s.mode)||!validState(p,s.board)||!(key===p.id||/^daily:\d{4}-\d{2}-\d{2}$/.test(key)))return;
 data.sessions[key]={levelId:s.levelId,mode:s.mode,runId:s.runId,board:s.board,history:Array.isArray(s.history)?s.history.filter(h=>validState(p,h)).slice(-40):[],hints:Number.isSafeInteger(s.hints)&&s.hints>=0?s.hints:0,settled:s.settled===s.runId&&inspect(p,s.board).status==='won'?s.runId:null};});
 // Derive reward eligibility from validated solutions; raw completion booleans are ignored.
 const allowed=new Set();levels.forEach(p=>{if(data.records[p.id]){allowed.add('first:'+p.id);if(!data.records[p.id].assisted)allowed.add('solo:'+p.id);}});
 for(let c=0;c<6;c++)if(levels.filter(p=>p.chapter===c).every(p=>data.records[p.id]))allowed.add('station:'+c);
 Object.keys(data.dailyRecords).forEach(k=>allowed.add(k));
 data.claims=Array.from(allowed);
 if(Array.isArray(raw.outbox))data.outbox=raw.outbox.filter(e=>e&&e.schemaVersion===1&&e.gameId==='frostfield-railway'&&ids.has(e.levelId)&&isId(e.runId)&&e.completionId==='fr:'+e.runId&&Array.isArray(e.rewardClaims)&&e.rewardClaims.every(c=>allowed.has(c))&&validState(ids.get(e.levelId),e.proof)&&inspect(ids.get(e.levelId),e.proof).status==='won').filter((e,i,a)=>a.findIndex(q=>q.completionId===e.completionId)===i);
 return data;
}
export function perform(p,run,i,value,kind){const result=change(p,run.board,i,value,kind);if(!result.ok)return result;if(run.settled)return {ok:false,reason:'这班列车已到站，重开可再次挑战',state:run.board};run.history.push(run.board);run.history=run.history.slice(-40);run.board=result.state;return result;}
export function undo(run){if(!run.history.length||run.settled)return false;run.board=run.history.pop();return true;}
export function complete(data,p,run,levels,key,now=new Date().toISOString()){
 if(inspect(p,run.board).status!=='won'||run.settled===run.runId)return null;
 const claims=[],claim=c=>{if(!data.claims.includes(c)){data.claims.push(c);claims.push(c);}};
 if(run.mode==='main'){
 const previous=data.records[p.id];if(!previous||previous.assisted&&run.hints===0)data.records[p.id]={board:run.board,assisted:run.hints>0,completionId:'fr:'+run.runId};
 claim('first:'+p.id);if(run.hints===0)claim('solo:'+p.id);
 if(levels.filter(q=>q.chapter===p.chapter).every(q=>data.records[q.id]))claim('station:'+p.chapter);
 }else {if(!data.dailyRecords[key])data.dailyRecords[key]={levelId:p.id,board:run.board,completionId:'fr:'+run.runId};claim(key);}
 const event={schemaVersion:1,gameId:'frostfield-railway',levelId:p.id,mode:run.mode,runId:run.runId,completionId:'fr:'+run.runId,rewardClaims:claims,metrics:{moves:run.board.moves,hints:run.hints,assisted:run.hints>0},completedAt:now,proof:run.board};
 run.settled=run.runId;data.outbox.push(event);return event;
}
export async function flush(data,storage,host){
 if(!(await storage.write(data)))return false;
 if(typeof host!=='function')return true;
 for(const event of data.outbox.slice()){
  const payload=Object.assign({},event);delete payload.proof;
  try{const accepted=await host(payload);if(accepted!==true&&!(accepted&&accepted.accepted===true))continue;const index=data.outbox.indexOf(event);data.outbox.splice(index,1);if(!(await storage.write(data))){data.outbox.splice(index,0,event);return false;}}catch(e){/* retry the same completionId next time */}
 }
 return true;
}
export function daily(levels,date=new Date()) {const shifted=new Date(date.getTime()+8*3600000),key=shifted.toISOString().slice(0,10),days=Math.floor(shifted.getTime()/86400000);return {key:'daily:'+key,date:key,level:levels[((days%levels.length)+levels.length)%levels.length]};}
