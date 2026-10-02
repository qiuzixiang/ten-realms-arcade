import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyBoard,inspect,setCell,validBoard,findDeduction,logicTrace} from '../logic.mjs';
import {oracleStatus,oracleSolve} from '../oracle.mjs';
import {LEVELS,CHAPTERS} from '../levels.mjs';
let checks=0;const check=c=>{assert.ok(c);checks++;};
for(const [w,h] of [[2,2],[3,3]]){
 const n=w*h,p={width:w,height:h,clues:Array((w+1)*(h+1)).fill(null)},num=3**n;
 for(let encoded=0;encoded<num;encoded++){
  let code=encoded;const board=[];for(let i=0;i<n;i++){board.push(['','\\','/'][code%3]);code=Math.floor(code/3);}
  const a=inspect(p,board),b=oracleStatus(p,board);assert.deepEqual(a.counts,b.degree);check(!!a.loops.length===b.cyclic);check(a.complete===b.complete);
  const constrained={width:w,height:h,clues:b.degree.map((v,i)=>{const x=i%(w+1),y=Math.floor(i/(w+1));return i%3===0?null:(encoded+i)%((Number(x>0)+Number(x<w))*(Number(y>0)+Number(y<h))+1);})};const ia=inspect(constrained,board),ob=oracleStatus(constrained,board);check(ia.complete===ob.complete);check(!!ia.errors.length===ob.numericBad);
 }console.log('exhaustive partial configurations '+w+'x'+h+': '+num);
}
const ring={width:2,height:2,clues:[0,2,0,2,0,2,0,2,0]},ringCells=['/','\\','\\','/'];
check(inspect(ring,ringCells).errors.length===0);check(inspect(ring,ringCells).loops.length===4);check(!inspect(ring,ringCells).complete);
const blank={width:2,height:2,clues:Array(9).fill(null)};check(inspect(blank,ringCells).loops.length===4);check(inspect(blank,['\\','\\','\\','\\']).complete);check(!inspect(blank,['\\','\\','\\','']).complete);
const zero={width:2,height:2,clues:[0,...Array(8).fill(null)]};check(inspect(zero,['\\','','','']).errors.length===1);check(inspect(blank,['\\','','','']).errors.length===0);
const p=LEVELS[0],empty=emptyBoard(p);check(setCell(p,empty,-1,'/')===null);check(setCell(p,empty,0,'X')===null);check(setCell(p,empty,0,'')===null);assert.deepEqual(empty,emptyBoard(p));check(validBoard(p,p.solution));check(!validBoard(p,p.solution.slice(1)));check(findDeduction(blank,ringCells).type==='conflict');
const perimeter={width:4,height:4,clues:Array(25).fill(null)},large=emptyBoard(perimeter);[[1,0,'/'],[2,0,'\\'],[3,1,'\\'],[3,2,'/'],[2,3,'/'],[1,3,'\\'],[0,2,'\\'],[0,1,'/']].forEach(([x,y,v])=>large[y*4+x]=v);check(inspect(perimeter,large).loops.length===8);check(oracleStatus(perimeter,large).cyclic);
function canonical(p){const forms=[];for(let swap=0;swap<2;swap++)for(let flipX=0;flipX<2;flipX++)for(let flipY=0;flipY<2;flipY++){const w=swap?p.height:p.width,h=swap?p.width:p.height,a=Array((w+1)*(h+1));for(let y=0;y<=p.height;y++)for(let x=0;x<=p.width;x++){let xx=swap?y:x,yy=swap?x:y;if(flipX)xx=w-xx;if(flipY)yy=h-yy;a[yy*(w+1)+xx]=p.clues[y*(p.width+1)+x];}forms.push(JSON.stringify([w,h,a]));}return forms.sort()[0];}
check(LEVELS.length===60);check(CHAPTERS.length===6);check(new Set(LEVELS.map(canonical)).size===60);
const certs=JSON.parse(readFileSync(new URL('../release/certificates.json',import.meta.url))).certificates;
for(const p of LEVELS){const proof=oracleSolve({width:p.width,height:p.height,clues:p.clues});check(proof.count===1&&proof.exhausted&&!proof.truncated);assert.deepEqual(proof.solutions[0],p.solution);check(inspect(p,p.solution).complete);check(oracleStatus(p,p.solution).complete);
 const trace=logicTrace(p,false),local=logicTrace(p,true),cert=certs.find(c=>c.id===p.id);check(trace.complete);check(cert.loopForced===trace.steps.filter(d=>d.type==='loop').length);check(p.chapter<3?local.complete:!local.complete);if(p.chapter>=5)check(cert.longLoopForced>=1);if(p.chapter===4||p.chapter===6)check(cert.blankLoop);
 trace.steps.filter(d=>d.type==='loop').forEach(d=>check(d.path.length>=3));
}check(oracleSolve(blank,{maxNodes:1}).truncated);
console.log('PASS rules: '+checks+' checks; all 60 independent unique, exhaustive completion comparisons, full-loop path and curriculum gates.');
