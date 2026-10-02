import {writeFileSync} from 'node:fs';
import {oracle,canonical,solutionCanonical} from './oracle.mjs';
let rng=20260914;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
const pool=[],seen=new Set();
for(let trial=0;trial<18000;trial++){
 const n=3+trial%4;let rooms=[{x:0,y:0,w:n,h:n}];const count=3+Math.floor(random()*(n+2));
 for(let k=1;k<count;k++){const choices=rooms.filter(r=>r.w*r.h>=4);if(!choices.length)break;const r=choices[Math.floor(random()*choices.length)];let vertical=r.w>1&&(r.h===1||random()<.5);const max=vertical?r.w:r.h;if(max<2)continue;const cut=1+Math.floor(random()*(max-1));rooms=rooms.filter(a=>a!==r);rooms.push(vertical?{x:r.x,y:r.y,w:cut,h:r.h}:{x:r.x,y:r.y,w:r.w,h:cut},vertical?{x:r.x+cut,y:r.y,w:r.w-cut,h:r.h}:{x:r.x,y:r.y+cut,w:r.w,h:r.h-cut});}
 const p={n,seed:'hotel-v1-'+trial,clues:rooms.map(r=>({x:r.x+Math.floor(random()*r.w),y:r.y+Math.floor(random()*r.h),v:r.w*r.h})).sort((a,b)=>a.y-b.y||a.x-b.x)};
 if(p.clues.filter(c=>c.v===1).length>1||p.clues.some(c=>c.v>12))continue;
 const key=canonical(p);if(seen.has(key))continue;const proof=oracle(p);if(proof.count!==1)continue;seen.add(key);p.answer=proof.answer;p.proof=Object.assign({},proof);delete p.proof.answer;
 p.score=proof.candidates-p.clues.length+proof.branches*4;p.key=key;pool.push(p);
}
const selected=[],taken=new Set(),tilings=new Set();
for(let ch=0;ch<6;ch++){
 let eligible=pool.filter(p=>!taken.has(p.key)&&(ch===0?p.n<=4&&p.score<=5:ch===1?p.n<=4&&p.score>=3:ch===2?p.n===4&&p.score>=5:ch===3?p.n>=4&&p.score>=8:ch===4?p.n>=5&&p.score>=12:p.n>=5&&p.score>=18));
 eligible.sort((a,b)=>a.score-b.score||a.seed.localeCompare(b.seed));
 if(eligible.length<10)throw Error('Insufficient pool chapter '+ch+' '+eligible.length);
 const low=[0,3,5,8,12,18][ch],high=[4,8,12,18,25,35][ch];
 for(let i=0;i<10;i++){
 const target=low+(high-low)*i/9;
 const choices=eligible.filter(p=>!taken.has(p.key)&&!tilings.has(solutionCanonical(p))&&(ch===0&&i<2?p.n===3&&p.clues.every(c=>c.v<=4):p.clues.length>=4));
 choices.sort((a,b)=>Math.abs(a.score-target)-Math.abs(b.score-target)||a.n-b.n||a.seed.localeCompare(b.seed));
 if(!choices.length)throw Error('Not enough distinct tilings '+ch+' '+i);
 const p=choices[0];taken.add(p.key);tilings.add(solutionCanonical(p));delete p.key;p.id='chapter-'+String(ch+1).padStart(2,'0')+'-level-'+String(i+1).padStart(2,'0');p.chapter=ch;p.lesson=i<2?'初识':i>=8?'综合':'练习';selected.push(p);
 }
}
for(let ch=0;ch<6;ch++){const ordered=selected.slice(ch*10,ch*10+10).sort((a,b)=>a.score-b.score||a.seed.localeCompare(b.seed));ordered.forEach((p,i)=>{p.id='chapter-'+String(ch+1).padStart(2,'0')+'-level-'+String(i+1).padStart(2,'0');p.lesson=i<2?'初识':i>=8?'综合':'练习';});selected.splice(ch*10,10,...ordered);}
const tutorial=JSON.parse(JSON.stringify(pool.find(p=>p.n===4&&p.score>=2&&p.score<=4)));tutorial.id='dream-isle-hotel-tutorial-v1';delete tutorial.key;
writeFileSync('src/levels.mjs','export const BANK_VERSION="hotel-v1";\nexport const LEVELS='+JSON.stringify(selected)+';\nexport const TUTORIAL='+JSON.stringify(tutorial)+';\n');
writeFileSync('release/level-proof.json',JSON.stringify({seed:20260914,pool:pool.length,levels:selected.map(p=>({id:p.id,n:p.n,score:p.score,proof:p.proof}))},null,2));
console.log('Selected',selected.length,'unique puzzles from',pool.length,'non-isomorphic candidates');
