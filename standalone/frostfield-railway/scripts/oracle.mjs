// Independent proof: enumerate vertex-simple paths; no imports from game engine,
// no access to a stored solution. Exhaustion, not timeout, proves uniqueness.
export function solve(p,{limit=2,budget=3000000,required=null}={}) {
 const n=p.n,goal=(n-1)*n+p.exit,start=p.entry*n,total=p.rows.reduce((a,b)=>a+b,0);
 const directions=[[-n,1,4],[1,2,8],[n,4,1],[-1,8,2]];
 const fixed=new Map(p.givens),seen=new Uint8Array(n*n),row=Array(n).fill(0),col=Array(n).fill(0),path=[],solutions=[];
 let nodes=0,branches=0,truncated=false;
 function visit(i,incoming){
  if(solutions.length>=limit||truncated)return;
  if(++nodes>budget){truncated=true;return;}
  const r=Math.floor(i/n),c=i%n;
  if(seen[i]||row[r]>=p.rows[r]||col[c]>=p.cols[c])return;
  seen[i]=1;row[r]++;col[c]++;path.push(i);
  let feasible=true;
  for(let r2=0;r2<n;r2++){let available=0;for(let c2=0;c2<n;c2++)if(!seen[r2*n+c2]&&col[c2]<p.cols[c2])available++;if(row[r2]+available<p.rows[r2])feasible=false;}
  for(let c2=0;c2<n;c2++){let available=0;for(let r2=0;r2<n;r2++)if(!seen[r2*n+c2]&&row[r2]<p.rows[r2])available++;if(col[c2]+available<p.cols[c2])feasible=false;}
  if(feasible&&i===goal){
   const m=incoming|4;
   if(incoming!==4&&path.length===total&&(!fixed.has(i)||fixed.get(i)===m)&&(!required||!required[i]||(required[i]&m)===required[i])&&p.givens.every(g=>seen[g[0]])&&row.every((v,j)=>v===p.rows[j])&&col.every((v,j)=>v===p.cols[j]))solutions.push(path.slice());
  }else if(feasible&&path.length<total){
   const options=[];
   for(const [offset,bit,op] of directions){if(bit===incoming)continue;if(bit===1&&r===0||bit===2&&c===n-1||bit===4&&r===n-1||bit===8&&c===0)continue;const j=i+offset,m=incoming|bit;if(seen[j]||fixed.has(i)&&fixed.get(i)!==m||required&&required[i]&&(required[i]&m)!==required[i])continue;options.push([j,op]);}
   if(options.length>1)branches++;
   for(const [j,op] of options)visit(j,op);
  }
  path.pop();row[r]--;col[c]--;seen[i]=0;
 }
 visit(start,8);
 return {count:solutions.length,solutions,nodes,branches,exhausted:!truncated&&solutions.length<limit,truncated};
}
// Local domain propagation measures quota waves and how much remains for global reasoning.
export function analyze(p){
 const n=p.n,ds=[[-n,1,4],[1,2,8],[n,4,1],[-1,8,2]],givens=new Map(p.givens);
 const domains=Array.from({length:n*n},(_,i)=>[0,3,5,6,9,10,12].filter(m=>{if(givens.has(i)&&givens.get(i)!==m)return false;return ds.every(([off,b])=>{const r=Math.floor(i/n),c=i%n;const outer=b===1&&r===0||b===2&&c===n-1||b===4&&r===n-1||b===8&&c===0;return !outer||!!(m&b)===(b===8&&i===p.entry*n||b===4&&i===(n-1)*n+p.exit);});}));
 let waves=0,changed=true;while(changed){changed=false;waves++;const before=domains.map(x=>x.slice());
 for(let i=0;i<n*n;i++){const r=Math.floor(i/n),c=i%n;domains[i]=domains[i].filter(m=>ds.every(([off,b,op])=>{if(b===1&&r===0||b===2&&c===n-1||b===4&&r===n-1||b===8&&c===0)return true;return before[i+off].some(v=>!!(v&op)===!!(m&b));}));}
 for(let axis=0;axis<2;axis++)for(let line=0;line<n;line++){const ids=Array.from({length:n},(_,k)=>axis?k*n+line:line*n+k),quota=axis?p.cols[line]:p.rows[line];const min=ids.filter(i=>!domains[i].includes(0)).length,max=ids.filter(i=>domains[i].some(m=>m)).length;
 for(const i of ids){if(min===quota&&domains[i].includes(0))domains[i]=[0];if(max===quota&&domains[i].some(m=>m))domains[i]=domains[i].filter(m=>m);}}
 changed=domains.some((d,i)=>d.length!==before[i].length);
 }
 return {quotaWaves:waves-1,forcedRatio:domains.filter(x=>x.length===1).length/(n*n),unresolved:domains.filter(x=>x.length>1).length};
}
