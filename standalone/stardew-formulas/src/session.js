import {createState,apply,undo,replay,evaluate} from './engine.js';
export const PREFIX='mini-polish:stardew-formulas:v1:';
export const SAVE_KEY=PREFIX+'save';
export const TUTORIAL_KEY=PREFIX+'stardew-formulas-tutorial-v1';
export function runId(){return 'run-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}
export function fresh(){return {version:1,active:0,sessions:{},completed:{},ack:[]};}
export function newRun(){return {runId:runId(),events:[]};}
export function restore(raw,levels){
 const clean=fresh();
 try {
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(!data||data.version!==1)return clean;
  clean.active=Number.isInteger(data.active)&&data.active>=0&&data.active<levels.length?data.active:0;
  for(const l of levels){
   for(const kind of ['sessions','completed']){
    const r=data[kind]&&data[kind][l.id];
    if(!r||typeof r.runId!=='string'||!/^run-[a-z0-9-]{1,80}$/.test(r.runId))continue;
    const s=replay(l,r.events);if(!s||(kind==='completed'&&!evaluate(l,s).complete))continue;
    clean[kind][l.id]={runId:r.runId,events:r.events};
   }
  }
  const ids=Object.keys(clean.completed).map(id=>PREFIX+'first:'+id);
  clean.ack=Array.isArray(data.ack)?data.ack.filter((id,i,a)=>ids.includes(id)&&a.indexOf(id)===i):[];
 }catch(e){return fresh();}
 return clean;
}
export function record(l,run,state,action){const next=action&&action.type==='undo'?undo(state):apply(l,state,action);if(next===state||run.events.length>=2000)return state;run.events.push(action);return next;}
export function settle(data,l,run,state){if(!evaluate(l,state).complete||data.completed[l.id])return false;data.completed[l.id]={runId:run.runId,events:run.events.slice()};return true;}
export function outbox(data){return Object.keys(data.completed).filter(id=>!data.ack.includes(PREFIX+'first:'+id)).map(id=>({game:'stardew-formulas',levelId:id,runId:data.completed[id].runId,completionId:PREFIX+data.completed[id].runId+':complete',rewardClaimId:PREFIX+'first:'+id}));}
// Persist first. The optional host must acknowledge the stable rewardClaimId and deduplicate it.
export async function flush(data,persist,host){
 if(!persist(data)||typeof host!=='function')return false;
 for(const event of outbox(data)){
  try{const ack=await host(event);if(ack!==event.rewardClaimId)continue;data.ack.push(event.rewardClaimId);if(!persist(data)){data.ack.pop();return false;}}catch(e){return false;}
 }
 return true;
}
export function dailyIndex(date,count){const day=Math.floor((date.getTime()+8*3600000)/86400000);return ((day%count)+count)%count;}
