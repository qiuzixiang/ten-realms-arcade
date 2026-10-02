import fs from 'node:fs';import vm from 'node:vm';import {oracle,canonical} from './oracle.mjs';
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('src/engine.js','utf8'),ctx);const E=ctx.LoomEngine;
let seed=13092026;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const bank=[],seen=new Set();const reports=[];
for(let chapter=1;chapter<=6;chapter++){
 const n=chapter<=3?4:6;const solutions=oracle(Array(n*n).fill(-1),n,10000).solutions;
 for(let level=1;level<=12;level++){
  let chosen;for(let attempt=0;attempt<10000&&!chosen;attempt++){
   const initialSeed=seed>>>0;const solution=solutions[Math.floor(rand()*solutions.length)];const a=solution.slice();const baseTarget=n===4?(chapter===1?6:chapter===2?8:10):(chapter===4?19:chapter===5?23:25);const target=baseTarget-(level<=2?2:level<=6?1:level>=11?-1:0);
   let removed=0;for(const i of shuffle(Array.from({length:n*n},(_,i)=>i))){const old=a[i];a[i]=-1;if(oracle(a,n).solutions.length!==1){a[i]=old;continue;}removed++;if(removed>=target)break;}
   const key=canonical(a,n);if(seen.has(key))continue;
   let working=a.slice(),trace=[];while(working.includes(-1)){const h=E.deduction(working,n);if(!h)break;trace.push({i:h.i,v:h.v,kind:h.kind});working[h.i]=h.v;}
   if(working.includes(-1))continue;
   const desired=chapter===1?'triple':chapter===2?'sandwich':chapter===3?'balance':null;
   if(desired&&level<=2&&trace[0]?.kind!==desired)continue;if(chapter===1&&level<=2&&trace.some(h=>h.kind!=='triple'))continue;if(chapter===2&&level<=2&&trace.some(h=>h.kind==='balance'))continue;
   seen.add(key);chosen={id:`chapter-${String(chapter).padStart(2,'0')}-level-${String(level).padStart(2,'0')}`,chapter,level,n,seed:initialSeed,givens:a};
   reports.push({id:chosen.id,seed:initialSeed,fixed:n*n-removed,oracleNodes:oracle(a,n).nodes,unique:true,logicSteps:trace.length,kinds:[...new Set(trace.map(x=>x.kind))],trace,solution});
  }
  if(!chosen)throw Error('generation exhausted '+chapter+':'+level);bank.push(chosen);
 }
}
fs.writeFileSync('src/levels.js','var LoomLevels = '+JSON.stringify(bank)+';\n');fs.writeFileSync('release/level-proof.json',JSON.stringify({version:'bank-v1',seed:13092026,count:bank.length,canonicalTransforms:16,levels:reports},null,2));console.log('Generated',bank.length,'distinct, uniquely solved, deduction-only puzzles');
