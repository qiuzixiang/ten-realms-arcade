import {writeFileSync} from 'node:fs';
import {solve,structureKey} from '../src/solver.mjs';
import {analyze} from '../src/engine.mjs';
let rngState=20260922;const rand=()=>{rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/4294967296;};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){let j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function candidate(n){const rows=shuffle(Array.from({length:n},(_,i)=>i)),cols=shuffle(Array.from({length:n},(_,i)=>i)),symbols=shuffle(Array.from({length:n},(_,i)=>i+1));const cells=Array.from({length:n*n},(_,i)=>symbols[(rows[(i/n)|0]+cols[i%n])%n]);const modes=Array(n*n).fill(0);const target=3+Math.floor(rand()*(n*n/3-2));
 for(const i of shuffle(Array.from({length:n*n},(_,j)=>j))){if(modes.filter(x=>x===1).length>=target)break;modes[i]=1;const a=analyze({n,cells},{modes,moves:0});if(a.touching.length||a.disconnected.length)modes[i]=0;}
 for(let i=0;i<cells.length;i++)if(modes[i]){const choices=[];for(let j=0;j<cells.length;j++)if(!modes[j]&&(((i/n)|0)===((j/n)|0)||i%n===j%n))choices.push(cells[j]);cells[i]=choices[Math.floor(rand()*choices.length)];}
 return {n,cells};
}
const pools={},keys=new Set();let attempts=0;
for(const n of [4,5,6]){const pool=[];while(pool.length<90&&attempts<150000){attempts++;const seed=rngState;const p=candidate(n),key=structureKey(p);if(keys.has(key))continue;const proof=solve(p);if(proof.solutions.length!==1||!proof.exhausted)continue;const solution=proof.solutions[0];if(!analyze(p,{modes:solution,moves:0}).complete)throw Error('oracle/engine disagree');keys.add(key);pool.push(Object.assign(p,{seed,solution,proof:{nodes:proof.nodes,depth:proof.maxDepth,connectivityPrunes:proof.connectivityPrunes}}));}
 if(pool.length<60)throw Error('insufficient pool '+n);pools[n]=pool;console.log('pool',n,pool.length,'attempts',attempts);}
const chosen=[];const used=new Set();
const themes=['初见重影','留白成径','书页相连','行列暗线','月下藏书','重见全卷'];
for(let c=0;c<6;c++){
 const n=c<3?4:c<5?5:6;
 let pool=pools[n].filter(p=>!used.has(p.seed));
 // Connectivity chapters prioritize branches rejected by disconnected white regions.
 pool.sort((a,b)=>c===2||c===4?b.proof.connectivityPrunes-a.proof.connectivityPrunes||a.proof.nodes-b.proof.nodes:a.proof.nodes-b.proof.nodes);
 const selection=c===5?Array.from({length:10},(_,k)=>pool[Math.floor(k*(pool.length-1)/9)]):pool.slice(0,10);selection.sort((a,b)=>a.proof.nodes-b.proof.nodes);
 selection.forEach((p,k)=>{used.add(p.seed);chosen.push(Object.assign({id:'ma-v1-'+String(c*10+k+1).padStart(2,'0'),chapter:c+1,chapterName:themes[c],stage:k<2?'入门':k<8?'组合':'综合',generatorVersion:1},p));});
}
writeFileSync('src/levels.mjs','export const LEVELS = '+JSON.stringify(chosen)+';\nexport const CHAPTERS = '+JSON.stringify(themes)+';\n');
writeFileSync('release/puzzle-proof.json',JSON.stringify({generatorVersion:1,seed:20260922,attempts,poolCounts:Object.fromEntries(Object.entries(pools).map(([n,p])=>[n,p.length])),count:chosen.length,proof:'independent binary CSP exhausted with limit=2; D4 duplicate-constraint-graph canonicalization',levels:chosen.map(p=>({id:p.id,seed:p.seed,n:p.n,solutions:1,exhausted:true,...p.proof}))},null,2));
console.log('generated',chosen.length);
