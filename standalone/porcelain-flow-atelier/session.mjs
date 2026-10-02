import {GAME_ID,RULE_VERSION,emptyBoard,setCell,inspect} from './logic.mjs';
import {LEVELS} from './levels.mjs';
export const STORE_KEY='mini-polish:porcelain-flow-atelier:v1:state';
export const TUTORIAL_KEY='mini-polish:porcelain-flow-atelier:v1:tutorial-1';
export function makeRunId(){return 'pfa-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}
export function newSession(p){return {levelId:p.id,ruleVersion:RULE_VERSION,generatorVersion:p.generatorVersion,seed:p.seed,runId:makeRunId(),actions:[],cursor:0,hints:0,completedId:null};}
export function replaySession(p,s){
  if(!s||s.levelId!==p.id||s.ruleVersion!==RULE_VERSION||s.generatorVersion!==p.generatorVersion||s.seed!==p.seed||!/^pfa-[a-z0-9-]{8,80}$/.test(s.runId)||!Array.isArray(s.actions)||s.actions.length>4096||!Number.isInteger(s.cursor)||s.cursor<0||s.cursor>s.actions.length||!Number.isInteger(s.hints)||s.hints<0||s.hints>9999)return null;
  let board=emptyBoard(p),notes=emptyBoard(p),moves=0;const states=[];
  for(let k=0;k<s.actions.length;k++){
    const a=s.actions[k];if(!a||!['set','note'].includes(a.kind)||!Number.isInteger(a.i)||!['','/','\\'].includes(a.value))return null;
    const next=setCell(p,a.kind==='set'?board:notes,a.i,a.value);if(!next)return null;
    if(a.kind==='set'){board=next;moves++;}else notes=next;
    if(k===s.cursor-1)states.push({board:board.slice(),notes:notes.slice(),moves});
  }
  return s.cursor===0?{board:emptyBoard(p),notes:emptyBoard(p),moves:0}:states[0];
}
export function editSession(p,s,kind,i,value){
  const current=replaySession(p,s);if(!current||s.actions.length>=4096||!['set','note'].includes(kind)||!setCell(p,kind==='set'?current.board:current.notes,i,value))return null;
  const next=Object.assign({},s,{actions:s.actions.slice(0,s.cursor).concat({kind,i,value}),cursor:s.cursor+1});return next;
}
export function proofRecord(p,s,time){return {gameId:GAME_ID,levelId:p.id,seed:p.seed,generatorVersion:p.generatorVersion,ruleVersion:RULE_VERSION,runId:s.runId,completionId:GAME_ID+':'+s.runId+':complete',timeline:s.actions.slice(0,s.cursor),hints:s.hints,completedAt:time};}
export function validateRecord(p,r){
  if(!r||r.gameId!==GAME_ID||r.completionId!==GAME_ID+':'+r.runId+':complete'||typeof r.completedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(r.completedAt)||!Number.isFinite(Date.parse(r.completedAt)))return false;
  const s=Object.assign({},r,{actions:r.timeline,cursor:Array.isArray(r.timeline)?r.timeline.length:0});const replay=replaySession(p,s);
  return !!replay&&inspect(p,replay.board).complete;
}
export function cleanStore(raw){
  const next={schema:1,current:null,records:{},outbox:[],settings:{sound:false,cycle:false}};
  if(!raw||raw.schema!==1)return next;
  if(raw.settings)next.settings={sound:raw.settings.sound===true,cycle:raw.settings.cycle===true};
  if(raw.current){const p=LEVELS.find(p=>p.id===raw.current.levelId);if(p&&replaySession(p,raw.current))next.current=Object.assign({},raw.current,{completedId:raw.current.completedId===GAME_ID+':'+raw.current.runId+':complete'?raw.current.completedId:null});}
  LEVELS.forEach(p=>{const r=raw.records&&raw.records[p.id];if(!r)return;const first=validateRecord(p,r.first)?r.first:null,unassisted=validateRecord(p,r.unassisted)&&r.unassisted.hints===0?r.unassisted:null;if(first)next.records[p.id]={first,unassisted};});
  if(Array.isArray(raw.outbox))raw.outbox.slice(0,120).forEach(e=>{
    const p=LEVELS.find(p=>p.id===e.levelId),r=p&&next.records[p.id];if(!r)return;
    const proof=[r.first,r.unassisted].find(v=>v&&v.completionId===e.completionId);
    if(!proof||!Array.isArray(e.claimIds))return;
    const allowed=[];if(proof.completionId===r.first.completionId)allowed.push(GAME_ID+':'+p.id+':first');if(r.unassisted&&proof.completionId===r.unassisted.completionId)allowed.push(GAME_ID+':'+p.id+':unassisted');
    const claims=Array.from(new Set(e.claimIds.filter(c=>allowed.includes(c))));if(!claims.length||next.outbox.some(v=>v.completionId===proof.completionId))return;
    next.outbox.push(Object.assign({},proof,{claimIds:claims}));
  });return next;
}
export function settleStore(store,p,s,time){
  const replay=replaySession(p,s);if(!replay||!inspect(p,replay.board).complete)return null;
  const next=JSON.parse(JSON.stringify(store)),id=GAME_ID+':'+s.runId+':complete';
  if(s.completedId===id)return next;
  const proof=proofRecord(p,s,time),claims=[];
  if(!next.records[p.id]){next.records[p.id]={first:proof,unassisted:null};claims.push(GAME_ID+':'+p.id+':first');}
  if(s.hints===0&&!next.records[p.id].unassisted){next.records[p.id].unassisted=proof;claims.push(GAME_ID+':'+p.id+':unassisted');}
  if(claims.length)next.outbox.push(Object.assign({},proof,{claimIds:claims}));
  next.current=Object.assign({},s,{completedId:id});return next;
}
export async function createPersistence(host){
  const xhs=host.xhs,mini=xhs&&xhs.miniTool;let options=xhs&&xhs.launchOptions;
  if(!(options&&options.miniToolEnv&&Number(options.miniToolEnv.buildVersion))&&mini&&typeof mini.getLaunchOptions==='function'){try{options=await mini.getLaunchOptions();}catch(e){options=null;}}
  const env=options&&options.miniToolEnv,version=Math.floor((Number(env&&env.buildVersion)||0)/1000);
  const native=version>=9460&&mini&&typeof mini.setStorage==='function'&&typeof mini.getStorage==='function';
  return {
    mode:native?'native-9.46+':'browser-fallback',
    async read(key){try{const value=native?(await mini.getStorage({key})).data:host.localStorage.getItem(key);return {ok:true,value:value?JSON.parse(value):null};}catch(e){return {ok:false,value:null};}},
    async write(key,value){try{const data=JSON.stringify(value);if(data.length>900000)return false;if(native)await mini.setStorage({key,data});else host.localStorage.setItem(key,data);return true;}catch(e){return false;}}
  };
}
