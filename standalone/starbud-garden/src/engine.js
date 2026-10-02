/* Starbud Garden — pure ES2017 rules; doubled integer core coordinates. */
var Starbud = typeof Starbud === 'undefined' ? {} : Starbud;
(function(S) {
'use strict';
const integer = Number.isSafeInteger;
function support(p, c) {
  const a=[];
  for(let y=Math.floor((c.y-1)/2);y<=Math.floor(c.y/2);y++)
    for(let x=Math.floor((c.x-1)/2);x<=Math.floor(c.x/2);x++) if(x>=0&&y>=0&&x<p.w&&y<p.h)a.push(y*p.w+x);
  return a;
}
function mirror(p,i,c) { const x=c.x-1-i%p.w,y=c.y-1-Math.floor(i/p.w);return x>=0&&y>=0&&x<p.w&&y<p.h?y*p.w+x:-1; }
function adjacent(p,i) {let a=[];if(i%p.w)a.push(i-1);if(i%p.w<p.w-1)a.push(i+1);if(i>=p.w)a.push(i-p.w);if(i<p.w*(p.h-1))a.push(i+p.w);return a;}
function key(a,b){return Math.min(a,b)+':'+Math.max(a,b);}
function edges(p) {const a=[];for(let i=0;i<p.w*p.h;i++)adjacent(p,i).filter(j=>j>i).forEach(j=>a.push({id:key(i,j),a:i,b:j,legal:!p.cores.some(c=>{const t=support(p,c);return t.includes(i)&&t.includes(j);})}));return a;}
function validPuzzle(p) {if(!p||!integer(p.w)||!integer(p.h)||p.w<2||p.h<2||p.w>9||p.h>9||!Array.isArray(p.cores)||!p.cores.length)return false;let used=new Set();return p.cores.every(c=>{if(!integer(c.x)||!integer(c.y)||c.x<1||c.x>=2*p.w||c.y<1||c.y>=2*p.h)return false;const a=support(p,c);if(a.some(i=>used.has(i)))return false;a.forEach(i=>used.add(i));return true;});}
function blank(){return {walls:[],notes:{},actions:[]};}
function evaluate(p,state) {
 const walls=new Set(state.walls),all=edges(p),seen=new Set(),groups=[],owner=[];
 for(let i=0;i<p.w*p.h;i++)if(!seen.has(i)){const cells=[i];seen.add(i);for(let k=0;k<cells.length;k++)adjacent(p,cells[k]).forEach(j=>{if(!seen.has(j)&&!walls.has(key(cells[k],j))){seen.add(j);cells.push(j);}});const set=new Set(cells);const cores=p.cores.map((c,k)=>({c,k,t:support(p,c)})).filter(o=>o.t.some(j=>set.has(j)));const core=cores.length===1?cores[0]:null;const symmetric=!!core&&cells.every(j=>set.has(mirror(p,j,core.c)));const contains=!!core&&core.t.every(j=>set.has(j));const slit=all.some(e=>walls.has(e.id)&&set.has(e.a)&&set.has(e.b));const valid=contains&&symmetric&&!slit;cells.forEach(j=>owner[j]=groups.length);groups.push({cells,core:core?core.k:-1,symmetric,contains,slit,valid});}
 const legal=new Set(all.filter(e=>e.legal).map(e=>e.id));const format=state.walls.every(e=>legal.has(e))&&walls.size===state.walls.length;
 return {groups,owner,validCount:groups.filter(g=>g.valid).length,complete:format&&groups.every(g=>g.valid)};
}
function act(p,state,action) {
 if(!action||typeof action!=='object')return state;
 let walls=state.walls.slice(),notes=Object.assign({},state.notes);
 if(action.type==='wall') {const edge=edges(p).find(e=>e.id===action.id&&e.legal);if(!edge)return state;const at=walls.indexOf(edge.id);if(at<0)walls.push(edge.id);else walls.splice(at,1);}
 else if(action.type==='note') {const i=action.cell,k=action.core;if(!integer(i)||i<0||i>=p.w*p.h||!integer(k)||!p.cores[k])return state;const j=mirror(p,i,p.cores[k]);if(j<0)return state;const touching=p.cores.some(c=>support(p,c).includes(i)||support(p,c).includes(j));if(touching)return state;const removing=notes[i]===k&&notes[j]===k;[i,j].forEach(n=>{const old=notes[n];if(old!==undefined){delete notes[mirror(p,n,p.cores[old])];delete notes[n];}});if(!removing){notes[i]=k;notes[j]=k;}}
 else return state;
 return {walls:walls.sort(),notes,actions:state.actions.concat([Object.assign({},action)])};
}
function replay(p,actions) {if(!Array.isArray(actions)||actions.length>10000)throw Error('invalid history');let state=blank();for(const a of actions){const next=act(p,state,a);if(next===state)throw Error('invalid action');state=next;}return state;}
function undo(p,state){return state.actions.length?replay(p,state.actions.slice(0,-1)):state;}
function solutionWalls(p,owners){return edges(p).filter(e=>owners[e.a]!==owners[e.b]).map(e=>e.id).sort();}
Object.assign(S,{support,mirror,adjacent,key,edges,validPuzzle,blank,evaluate,act,replay,undo,solutionWalls});
})(Starbud);
if(typeof module!=='undefined')module.exports=Starbud;
