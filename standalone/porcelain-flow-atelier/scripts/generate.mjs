import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {emptyBoard,inspect,connectedPath,edgeEnds,logicTrace} from '../logic.mjs';
import {oracleSolve,oracleStatus} from '../oracle.mjs';
const chapters=[
 {id:1,title:'白坯入窑',concept:'角点与边点',relic:'白坯印章',note:'数字数的是接入这个点的瓷片端头。'},
 {id:2,title:'双端校准',concept:'两端相互校准',relic:'双耳小杯',note:'一片影响两端；已满的节点不再接入。'},
 {id:3,title:'热环禁区',concept:'闭合路径排除',relic:'隔热花砖',note:'数字对上也不能围成环，分离的分支是合法的。'},
 {id:4,title:'素釉留白',concept:'无线索节点',relic:'枝状纹盘',note:'空铆钉没有数字限制，仍然不能闭环。'},
 {id:5,title:'长枝织瓷',concept:'跨区长链',relic:'长柄茶滤',note:'两端若已通过远处相连，新瓷片就会闭合。'},
 {id:6,title:'开窑展',concept:'综合检验',relic:'工坊展盘',note:'把数字上下界与长路径一起核对。'}
];
let seed=2026100104;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function shuffled(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function hash(v){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
function canonical(p){
 const images=[];
 for(let swap=0;swap<2;swap++)for(let flipX=0;flipX<2;flipX++)for(let flipY=0;flipY<2;flipY++){
  const w=swap?p.height:p.width,h=swap?p.width:p.height,c=Array((w+1)*(h+1));
  for(let y=0;y<=p.height;y++)for(let x=0;x<=p.width;x++){
   let xx=swap?y:x,yy=swap?x:y;if(flipX)xx=w-xx;if(flipY)yy=h-yy;c[yy*(w+1)+xx]=p.clues[y*(p.width+1)+x];
  }images.push(JSON.stringify([w,h,c]));
 }return images.sort()[0];
}
const levels=[],certificates=[],seen=new Set();
for(const chapter of chapters){
 let attempts=0;
 while(levels.filter(p=>p.chapter===chapter.id).length<10){
  attempts++;if(attempts>12000)throw Error('Generation gate exhausted '+chapter.id);
  const order=levels.filter(p=>p.chapter===chapter.id).length, width=chapter.id===1?4:chapter.id===2?(order<5?4:5):chapter.id===3?5:chapter.id===4?(order<5?5:6):6,height=chapter.id===6&&order>=5?7:width;
  const initialSeed=seed,p={width,height,clues:Array((width+1)*(height+1)).fill(null)}, b=emptyBoard(p);
  let failed=false;
  for(const i of shuffled(b.map((_,i)=>i))){const values=shuffled(['\\','/']);let placed=false;for(const v of values){const e=edgeEnds(width,i,v);if(connectedPath(p,b,e[0],e[1])===null){b[i]=v;placed=true;break;}}if(!placed){failed=true;break;}}
  if(failed)continue;
  p.clues=inspect(p,b).counts;
  const candidates=shuffled(p.clues.map((_,i)=>i));
  // Each retained removal still has a complete forced-deduction proof.
  for(const v of candidates){if(chapter.id===1&&rnd()<0.65)continue;if(chapter.id===2&&rnd()<0.3)continue;const old=p.clues[v];p.clues[v]=null;const t=logicTrace(p,chapter.id<3);if(!t.complete)p.clues[v]=old;}
  const trace=logicTrace(p,false),local=logicTrace(p,true),loopSteps=trace.steps.filter(d=>d.type==='loop');
  const longSteps=loopSteps.filter(d=>d.path.length>=6&&Math.max(...d.path.map(i=>i%width))-Math.min(...d.path.map(i=>i%width))>=Math.floor(width/2));
  const blankLoop=loopSteps.some(d=>d.endpoints.some(v=>p.clues[v]===null));
  if(chapter.id===1&&!local.complete)continue;
  if(chapter.id===2&&(!local.complete||trace.maxDepth<3))continue;
  if(chapter.id>=3&&(local.complete||!loopSteps.length))continue;
  if(chapter.id===4&&(!blankLoop||p.clues.filter(v=>v!==null).length/p.clues.length>0.58))continue;
  if(chapter.id>=5&&!longSteps.length)continue;
  if(chapter.id===6&&(loopSteps.length<2||!blankLoop))continue;
  const key=canonical(p);if(seen.has(key))continue;
  const proof=oracleSolve({width,height,clues:p.clues});
  if(proof.count!==1||proof.truncated||!proof.exhausted||!oracleStatus(p,b).complete||proof.solutions[0].join('')!==b.join(''))continue;
  const no=levels.length+1,title=order===0?chapter.concept:order===9?'本章检验':`${['初刻','端头','对照','窑架','釉痕','接点','分枝','定向','合印'][order]} · ${chapter.title}`;
  const level=Object.assign({id:`porcelain-${String(no).padStart(2,'0')}`,number:no,chapter:chapter.id,title,seed:`pfa-${initialSeed}`,generatorVersion:'pfa-gen-1',solution:b},p);
  seen.add(key);levels.push(level);
  certificates.push({id:level.id,puzzleHash:hash([width,height,p.clues]),solutionHash:hash(b),seed:level.seed,count:proof.count,nodes:proof.nodes,truncated:proof.truncated,exhausted:proof.exhausted,oracleValid:true,localOnlyComplete:local.complete,numberForced:trace.steps.filter(d=>d.type==='number').length,loopForced:loopSteps.length,longLoopForced:longSteps.length,blankLoop,maxDepth:trace.maxDepth,clueDensity:p.clues.filter(v=>v!==null).length/p.clues.length,steps:trace.steps});
  console.log(`${no}/60 ${width}x${height} clues=${p.clues.filter(v=>v!==null).length} loops=${loopSteps.length} long=${longSteps.length} depth=${trace.maxDepth} attempts=${attempts}`);
 }
}
writeFileSync(new URL('../levels.mjs',import.meta.url),`export const CHAPTERS = ${JSON.stringify(chapters,null,2)};\nexport const LEVELS = ${JSON.stringify(levels,null,2)};\n`);
writeFileSync(new URL('../release/certificates.json',import.meta.url),JSON.stringify({generator:'pfa-gen-1',initialSeed:2026100104,independent:'oracle.mjs; no logic imports; complete search limit=2',geometricUnique:seen.size,certificates},null,2));
