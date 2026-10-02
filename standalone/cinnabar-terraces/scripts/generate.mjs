import {canonical} from './canonical.mjs';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {oracle} from './oracle.mjs';
const require=createRequire(import.meta.url),E=require('../engine.js'),base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function rng(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function shuffle(a,r){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function latin(n,r){const a=Array(n*n).fill(0);function fill(c){if(c===a.length)return true;for(const v of shuffle(Array.from({length:n},(_,i)=>i+1),r)){if(a.slice(Math.floor(c/n)*n,c).includes(v))continue;let used=false;for(let row=0;row<Math.floor(c/n);row++)if(a[row*n+c%n]===v)used=true;if(used)continue;a[c]=v;if(fill(c+1))return true;}a[c]=0;return false;}fill(0);return a;}
const chapters=[['第一层赤土','行列齐备，尖端向小'],['顺坡读刻印','上下关系与连续高低链'],['五阶小院','五阶范围，行列排除'],['转角有高低','分叉链与候选交集'],['六阶长庭','长链，精确选格'],['夕照满庭','多链与行列综合']];
const titles=['初烧','拾阶','砂纹','暮墙','短坡','尖端向小','双刻','小径','回廊','赤土成庭','向上读','向下读','长坡','四阶刻线','折向','直角','链端','两坡','交会','顺坡成庭','添一阶','第五块陶','素墙','斜照','五阶端点','余数','五阶长链','互见','两排','五阶成庭','转角','分枝','左右坡','两者之间','汇点','空隙','相同也可','候选交集','横竖呼应','转角成庭','六阶开庭','选行安放','六个编号','长庭端点','连刻','远列','递增径','织坡','行列会面','长庭成庭','夕照','双线','留一格','互锁','三坡','双坡会合','刻印交汇','葡萄暮色','陶影','满庭'];
const levels=[],proofs=[],seen=new Set();let attempt=0;
for(let chapter=0;chapter<6;chapter++)for(let slot=0;slot<10;slot++){
  const n=4+Math.floor(chapter/2);let accepted=null;
  while(!accepted){attempt++;if(attempt>20000)throw Error('Generation exhausted');const seed=860000+attempt,r=rng(seed),solution=latin(n,r),relations=[];
    for(let a=0;a<n*n;a++)for(const b of [a%n<n-1?a+1:-1,a+n<n*n?a+n:-1])if(b>=0)relations.push({a,b,sign:solution[a]<solution[b]?'<':'>'});
    let l={n,relations};if(!E.deduce(l,Array(n*n).fill(0)).solved)continue;
    const target=(n===4?15:n===5?24:36)-Math.floor(slot*0.5)-(chapter%2?3:0);
    for(const e of shuffle(relations,r)){if(l.relations.length<=target)break;const trial={n,relations:l.relations.filter(t=>t!==e)};if(E.deduce(trial,Array(n*n).fill(0)).solved)l=trial;}
    const key=canonical(l);if(seen.has(key))continue;const deduction=E.deduce(l,Array(n*n).fill(0)),op=oracle(l);if(op.count!==1||!op.exhausted||op.witness.join()!==solution.join())continue;
    // Fixed representative requirements: vertical mark, a long directed chain, and a branching junction.
    const oriented=l.relations.map(e=>e.sign==='<'?[e.a,e.b]:[e.b,e.a]);let longest=0;
    function chain(c,depth){longest=Math.max(longest,depth);oriented.filter(e=>e[0]===c).forEach(e=>chain(e[1],depth+1));}for(let c=0;c<n*n;c++)chain(c,1);
    const branching=Array.from({length:n*n},(_,c)=>oriented.filter(e=>e[1]===c).length).some(x=>x>=2);
    if(slot===6 && chapter===2 && longest<5)continue;if(chapter===5 && slot===5&&!branching)continue;
    const index=levels.length,id='ct-'+String(index+1).padStart(2,'0');
    accepted={id,n,chapter:chapter+1,title:titles[index],seed,generatorVersion:'terrace-1',relations:l.relations,solution,checksum:E.checksum(l),teaching:chapters[chapter][1],metrics:{clues:l.relations.length,rounds:deduction.rounds,chainLength:longest,branching,hiddenSingles:deduction.trace.filter(s=>s.type==='hidden').length}};
    seen.add(key);proofs.push({id,checksum:accepted.checksum,unique:true,method:'independent-row-permutation-exhaustion',nodes:op.nodes,exhausted:op.exhausted,noGuess:true,logicSteps:deduction.trace.length,trace:deduction.trace});
  }levels.push(accepted);console.log(accepted.id+' '+n+'×'+n+' clues='+accepted.metrics.clues+' rounds='+accepted.metrics.rounds);
}
fs.writeFileSync(path.join(base,'levels.js'),"(function(root){ 'use strict'; root.TerraceLevels="+JSON.stringify({version:'terrace-1',chapters:chapters.map((c,i)=>({id:i+1,title:c[0],description:c[1]})),levels})+"; if(typeof module!=='undefined')module.exports=root.TerraceLevels; })(typeof window!=='undefined'?window:global);\n");
fs.writeFileSync(path.join(base,'release/level-proofs.json'),JSON.stringify({generator:'terrace-1',attempts:attempt,levels:proofs},null,2));
