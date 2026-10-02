import fs from 'node:fs';
import {runtime,root,json} from './lib.mjs';
import {oracle,canonical,graphSignature,isomorphic} from './oracle.mjs';
const E=runtime(['engine']).BellEngine;
const names=['一阵晚风','相邻回响','交错风线','庭中合奏','静夜余音','满庭铃光'];
const lessons=[['先看一口铃','再敲一次会复原','沿线看变化','把暗处留给下一步','两阵风相抵','先选后敲','角落的回应','让亮铃暂暗','慢慢连成光','初庭小合奏'],['十字的中心','边角少一线','避开重复敲击','先看最暗处','边线相抵','顺序可以交换','照顾四个角','亮铃也能敲','从目标倒着想','相邻大合奏'],['每口铃各有风线','箭头指出去向','看清不对称','一端牵动两端','从边缘读模板','留意单向回应','两条线相遇','多看一步','重叠不等于重复','风线大合奏'],['两个翻转会抵消','按两次等于不按','找会相抵的铃','从暗铃倒推','把局部连起来','接受中途变暗','换个顺序试试','用撤销作比较','为最后一步铺路','庭院大合奏'],['更深的一组回响','先照顾四角','留下少量暗铃','拆成两段来想','横纵线交汇','先解边再看中','回看受影响范围','绕过直觉陷阱','留一手收尾','静夜大合奏'],['一庭新风线','先读连线再动手','四角与中央','从最后一敲倒推','小范围先相抵','把回响串起来','暂暗也是路径','留意远处的铃','慢慢汇成一束光','满庭铃光']];
let state=0;function rng(){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;}
function templates(s,chapter){return Array.from({length:s*s},(_,i)=>{const x=i%s,y=Math.floor(i/s),t=[i];const ns=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&b>=0&&a<s&&b<s).map(([a,b])=>b*s+a);ns.forEach(j=>{if(chapter===1||chapter===4||rng()<(chapter===0?.35:.64))t.push(j);});if(chapter===5&&rng()<.3){const j=Math.floor(rng()*s*s);if(!t.includes(j))t.push(j);}return t.sort((a,b)=>a-b);});}
const seen=new Set(),levels=[],proof=[];
for(let ch=0;ch<6;ch++)for(let j=0;j<10;j++){
 const s=ch===0?(j<2?2:3):ch<4?3:ch===4?4:j<4?4:5;
 const desired=ch===0?1+Math.floor(j/3):ch<3?2+Math.floor(j/3):ch===3?3+Math.floor(j/4):ch===4?3+Math.floor(j/2):4+Math.floor(j/2);
 let chosen;
 for(let attempt=0;attempt<20000;attempt++){
  const seed=20260914+ch*1000000+j*21001+attempt;state=seed;
  const l={id:`chapter-${String(ch+1).padStart(2,'0')}-level-${String(j+1).padStart(2,'0')}`,chapter:ch,name:lessons[ch][j],size:s,seed,templates:templates(s,ch),initial:Array(s*s).fill(1)};
  const taps=[];while(taps.length<Math.min(desired,s*s)){const p=Math.floor(rng()*s*s);if(!taps.includes(p))taps.push(p);}
  taps.forEach(i=>l.templates[i].forEach(k=>l.initial[k]^=1));
  if(!E.valid(l))continue;const sol=E.solve(l,l.initial);if(!sol||sol.minimum!==Math.min(desired,s*s))continue;
  const key=canonical(l);if(seen.has(key))continue;const signature=graphSignature(l);if(levels.some(old=>graphSignature(old)===signature&&isomorphic(old,l)))continue;
  const independent=oracle(l);if(!independent||independent.length!==sol.minimum)throw Error('oracle mismatch');
  l.minimum=sol.minimum;l.nullity=sol.nullity;seen.add(key);chosen=l;
  proof.push({id:l.id,seed,size:s,minimum:l.minimum,nullity:sol.nullity,solutionCount:sol.solutions,verifiedPath:json(sol.presses),independentPath:independent,chapterRole:j<2?'introduce':j>=8?'combine':'practice'});break;
 }
 if(!chosen)throw Error('No level '+ch+'/'+j);levels.push(chosen);
}
const tutorial={id:'evening-bell-garden-tutorial-v1',size:3,seed:1,templates:templatesForTutorial(),initial:Array(9).fill(1)};
function templatesForTutorial(){return Array.from({length:9},(_,i)=>[i,i%3>0?i-1:-1,i%3<2?i+1:-1,i>2?i-3:-1,i<6?i+3:-1].filter(x=>x>=0).sort((a,b)=>a-b));}
[0,4].forEach(i=>tutorial.templates[i].forEach(j=>tutorial.initial[j]^=1));
fs.writeFileSync(new URL('src/levels.js',root),'var BellLevels = '+JSON.stringify({version:1,chapters:names,levels,tutorial,tutorialPath:[0,4]})+';\n');
fs.writeFileSync(new URL('release/level-proof.json',root),JSON.stringify({generatorVersion:1,seedBase:20260914,symmetry:'Eight geometric symmetries plus exact directed initial-coloured influence-graph isomorphism',levels:proof},null,2));
console.log('Generated and independently verified',levels.length,'levels');
