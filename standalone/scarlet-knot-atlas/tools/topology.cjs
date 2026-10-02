'use strict';
function adjacency(level){const rows=Array.from({length:level.initial.length},()=>[]);level.edges.forEach(([a,b])=>{rows[a].push(b);rows[b].push(a);});return rows;}
function components(rows,removed=-1){const seen=new Set(removed<0?[]:[removed]);let count=0;for(let i=0;i<rows.length;i++)if(!seen.has(i)){count++;const todo=[i];seen.add(i);while(todo.length){for(const v of rows[todo.pop()])if(!seen.has(v)){seen.add(v);todo.push(v);}}}return count;}
function blocks(level){
  const rows=adjacency(level),seen=Array(rows.length).fill(0),low=Array(rows.length).fill(0),stack=[],out=[];let time=0;
  function visit(u,parent){seen[u]=low[u]=++time;for(const v of rows[u]){if(v===parent)continue;if(!seen[v]){stack.push([u,v]);visit(v,u);low[u]=Math.min(low[u],low[v]);if(low[v]>=seen[u]){const edges=[];let e;do{e=stack.pop();edges.push(e);}while(e[0]!==u||e[1]!==v);const vertices=[...new Set(edges.flat())].sort((a,b)=>a-b);out.push({vertices,edgeCount:edges.length,cycles:edges.length-vertices.length+1});}}else if(seen[v]<seen[u]){stack.push([u,v]);low[u]=Math.min(low[u],seen[v]);}}}
  for(let i=0;i<rows.length;i++)if(!seen[i])visit(i,-1);return out;
}
function stats(level){const rows=adjacency(level),bs=blocks(level);return {nodes:rows.length,edges:level.edges.length,components:components(rows),cycles:level.edges.length-rows.length+components(rows),articulations:rows.map((_,i)=>i).filter(i=>components(rows,i)>1),degrees:rows.map(r=>r.length).sort((a,b)=>a-b),blocks:bs,cyclicBlocks:bs.filter(b=>b.cycles>0).length};}
// Exact graph isomorphism, no WL hash accepted as a proof. Backtracking
// preserves every adjacency and non-adjacency; degree/neighbour-degree
// signatures only prune the candidate set. No search truncation.
function isomorphic(a,b){
  if(a.initial.length!==b.initial.length||a.edges.length!==b.edges.length)return false;
  const A=adjacency(a),B=adjacency(b),n=A.length;
  const sig=(rows,i)=>rows[i].length+':'+rows[i].map(j=>rows[j].length).sort((x,y)=>x-y).join(',');
  const choices=A.map((_,i)=>B.map((_,j)=>j).filter(j=>sig(A,i)===sig(B,j)));
  if(choices.some(c=>!c.length))return false;
  const order=A.map((_,i)=>i).sort((i,j)=>choices[i].length-choices[j].length||A[j].length-A[i].length),map=Array(n).fill(-1),used=new Set();
  function search(k){if(k===n)return true;const i=order[k];for(const j of choices[i]){if(used.has(j))continue;let ok=true;for(let h=0;h<k;h++){const v=order[h];if(A[i].includes(v)!==B[j].includes(map[v])){ok=false;break;}}if(!ok)continue;map[i]=j;used.add(j);if(search(k+1))return true;used.delete(j);map[i]=-1;}return false;}
  return search(0);
}
function automorphisms(level,limit=2){
  const rows=adjacency(level),n=rows.length,signature=i=>rows[i].length+':'+rows[i].map(j=>rows[j].length).sort((a,b)=>a-b).join(','),choices=rows.map((_,i)=>rows.map((_,j)=>j).filter(j=>signature(i)===signature(j))),order=rows.map((_,i)=>i).sort((a,b)=>choices[a].length-choices[b].length),mapping=Array(n).fill(-1),used=new Set();let count=0;
  function visit(k){if(k===n){count++;return;}const i=order[k];for(const j of choices[i]){if(used.has(j))continue;let ok=true;for(let h=0;h<k;h++){const v=order[h];if(rows[i].includes(v)!==rows[j].includes(mapping[v])){ok=false;break;}}if(!ok)continue;mapping[i]=j;used.add(j);visit(k+1);used.delete(j);mapping[i]=-1;if(count>=limit)return;}}
  visit(0);return count;
}
module.exports={adjacency,components,stats,blocks,isomorphic,automorphisms};
