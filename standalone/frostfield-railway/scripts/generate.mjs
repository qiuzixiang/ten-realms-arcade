import fs from 'node:fs';
import {solve,analyze} from './oracle.mjs';
import {initial,inspect,pathState,change} from '../src/engine.mjs';
const chapterNames=['雪原第一站','直轨与弯道','空白也是路标','山口分流','一线穿过极夜','黎明通车'];
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function shuffled(a,r){return a.map(x=>[r(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
function makePath(n,r,min,max,zero){const start=(zero?1+Math.floor(r()*(n-2)):Math.floor(r()*(n-1)))*n;let answer=null,vis=new Set([start]);let count=0;
 function walk(path){if(answer||++count>8000)return;const i=path[path.length-1],y=Math.floor(i/n),x=i%n;if(y===n-1&&path.length>=min&&(path.length>=max||r()<.48)){answer=path.slice();return;}if(path.length>=max)return;for(const [dx,dy] of shuffled([[0,-1],[1,0],[0,1],[-1,0]],r)){const a=x+dx,b=y+dy,j=b*n+a;if(a<0||a>=n||b<(zero?1:0)||b>=n||vis.has(j))continue;vis.add(j);walk(path.concat(j));vis.delete(j);if(answer)return;}}
 walk([start]);return answer;}
function canonical(path,n){const forms=[];for(let f=0;f<8;f++){let q=path.map(i=>{let x=i%n,y=Math.floor(i/n);if(f>=4)x=n-1-x;for(let r=0;r<f%4;r++){const t=x;x=n-1-y;y=t;}return y*n+x;});forms.push(q.join(','),q.reverse().join(','));}return n+':'+forms.sort()[0];}
const levels=[],proofs=[],keys=new Set();
for(let ch=0;ch<6;ch++){
 const pool=[];let attempts=0;
 while(pool.length<18&&attempts<1200){
  const seed=20260922+ch*100000+attempts++,r=random(seed),n=ch<3?5:ch===3&&pool.length<3?5:6;
  const min=[9,12,11,16,19,22][ch],max=[15,20,19,25,29,30][ch];
  const path=makePath(n,r,min,max,ch===2);if(!path)continue;const key=canonical(path,n);if(keys.has(key))continue;
  const p={id:'',n,entry:Math.floor(path[0]/n),exit:path[path.length-1]%n,rows:Array(n).fill(0),cols:Array(n).fill(0),givens:[]};path.forEach(i=>{p.rows[Math.floor(i/n)]++;p.cols[i%n]++;});
  const full=pathState(p,path),fixed=new Set([path[0],path[path.length-1]]);const extra=shuffled(path.slice(1,-1),r);const ratio=[.48,.27,.18,.14,.07,.02][ch];extra.slice(0,Math.ceil(path.length*ratio)).forEach(i=>fixed.add(i));
  let proof;
  for(let tries=0;tries<path.length;tries++){
   p.givens=Array.from(fixed).sort((a,b)=>a-b).map(i=>[i,full.masks[i]]);proof=solve(p);
   if(proof.count===1&&proof.exhausted)break;
   const alt=proof.solutions.find(q=>q.join(',')!==path.join(','));let i=extra.find(i=>!fixed.has(i));if(alt){const other=pathState(p,alt);i=extra.find(i=>!fixed.has(i)&&other.masks[i]!==full.masks[i])||i;}if(i===undefined)break;fixed.add(i);
  }
  if(proof.count!==1||!proof.exhausted||inspect(p,full).status!=='won'||inspect(p,initial(p)).status==='won')continue;
  const metrics=Object.assign(analyze(p),{fixedRatio:fixed.size/path.length,searchNodes:proof.nodes,branchPoints:proof.branches,pathLength:path.length,turns:path.filter(i=>![5,10].includes(full.masks[i])).length});
  p.seed=seed;p.generatorVersion='fr-1';p.path=path;p.metrics=metrics;p.key=key;pool.push(p);keys.add(key);
 }
 if(pool.length<10)throw Error('Insufficient chapter '+ch);
 pool.sort((a,b)=>(ch===3?a.n-b.n:0)||a.metrics.unresolved-b.metrics.unresolved||a.metrics.searchNodes-b.metrics.searchNodes||a.metrics.pathLength-b.metrics.pathLength);
 const chosen=pool.filter((p,i)=>[0,1,3,5,7,9,11,13,15,17].includes(i));
 chosen.forEach((p,k)=>{p.id='fr-'+String(ch*10+k+1).padStart(3,'0');p.chapter=ch;p.title=chapterNames[ch]+' · '+String(k+1).padStart(2,'0');p.phase=k<2?'新概念':k<8?'组合推理':'综合';delete p.key;levels.push(p);proofs.push({id:p.id,seed:p.seed,unique:true,exhausted:true,metrics:p.metrics,canonical:canonical(p.path,p.n)});});
 console.log(chapterNames[ch],chosen.map(p=>[p.id,p.n,p.givens.length,p.path.length,p.metrics.searchNodes,p.metrics.unresolved]));
}
// First, middle and final chapters are the representative fixtures validated before publication.
for(const idx of [0,30,59]){const p=levels[idx],proof=solve(p);if(proof.count!==1||!proof.exhausted)throw Error('Representative proof');let s=initial(p);const goal=pathState(p,p.path);for(const i of p.path){if(p.givens.some(g=>g[0]===i))continue;const result=change(p,s,i,goal.masks[i]);if(result.ok)s=result.state;}if(inspect(p,s).status!=='won')throw Error('Representative replay');}
fs.writeFileSync('src/levels.mjs','export const CHAPTERS = '+JSON.stringify(chapterNames)+';\nexport const LEVELS = '+JSON.stringify(levels)+';\n');
fs.writeFileSync('release/level-proofs.json',JSON.stringify({generator:'fr-1',proof:'Independent exhaustive self-avoiding A→B path search, limit 2',representatives:['fr-001','fr-031','fr-060'],count:60,levels:proofs},null,2));
