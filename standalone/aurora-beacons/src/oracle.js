/* Independent constraint solver. Does not import engine or read solution. */
(function(root){'use strict';
function solve(p,limit,fixed){
 limit=limit||2;const n=p.slots.length, domains=p.slots.map((q,i)=>fixed&&fixed[i]!==null&&fixed[i]!==undefined?[fixed[i]]:[1,-1,0]);let nodes=0,branches=0,maxDepth=0,solutions=[];
 const cellSlot=[],cellEnd=[];p.slots.forEach((q,i)=>q.forEach((c,e)=>{cellSlot[c]=i;cellEnd[c]=e;}));
 const lines=[];['rp','rm','cp','cm'].forEach(k=>p.clues[k].forEach((target,line)=>{if(target===null)return;const polarity=k[1]==='p'?1:-1;const contributions=p.slots.map(q=>[1,-1,0].map(v=>q.reduce((sum,c,e)=>sum+Number((k[0]==='r'?Math.floor(c/p.w):c%p.w)===line&&(e?-v:v)===polarity),0)));lines.push({target,contributions});}));
 const valueIndex=v=>v===1?0:v===-1?1:2;
 function propagate(ds){let changed=true;while(changed){changed=false;
 for(let i=0;i<n;i++){const good=ds[i].filter(v=>p.slots[i].every((cell,end)=>{if(!v)return true;const r=Math.floor(cell/p.w),c=cell%p.w,around=[];if(r)around.push(cell-p.w);if(r+1<p.h)around.push(cell+p.w);if(c)around.push(cell-1);if(c+1<p.w)around.push(cell+1);const pole=end?-v:v;return around.every(a=>cellSlot[a]===i||ds[cellSlot[a]].some(other=>(cellEnd[a]?-other:other)!==pole));}));if(!good.length)return false;if(good.length!==ds[i].length){ds[i]=good;changed=true;}}
 for(const line of lines){const ranges=ds.map((d,i)=>{const a=d.map(v=>line.contributions[i][valueIndex(v)]);return [Math.min.apply(null,a),Math.max.apply(null,a)];});const lo=ranges.reduce((s,x)=>s+x[0],0),hi=ranges.reduce((s,x)=>s+x[1],0);if(lo>line.target||hi<line.target)return false;for(let i=0;i<n;i++){const good=ds[i].filter(v=>{const c=line.contributions[i][valueIndex(v)];return lo-ranges[i][0]+c<=line.target&&hi-ranges[i][1]+c>=line.target;});if(!good.length)return false;if(good.length!==ds[i].length){ds[i]=good;changed=true;}}}
 }return true;}
 function dfs(ds,depth){nodes++;maxDepth=Math.max(maxDepth,depth);if(!propagate(ds))return;let i=-1;ds.forEach((d,j)=>{if(d.length>1&&(i<0||d.length<ds[i].length))i=j;});if(i<0){solutions.push(ds.map(d=>d[0]));return;}branches++;for(const v of ds[i]){const next=ds.map(d=>d.slice());next[i]=[v];dfs(next,depth+1);if(solutions.length>=limit)return;}}
 dfs(domains,0);return {solutions,count:solutions.length,unique:solutions.length===1&&solutions.length<limit,nodes,branches,maxDepth,exhausted:solutions.length<limit};
}
if(typeof module!=='undefined')module.exports={solve};else root.AuroraOracle={solve};
})(typeof window!=='undefined'?window:globalThis);
