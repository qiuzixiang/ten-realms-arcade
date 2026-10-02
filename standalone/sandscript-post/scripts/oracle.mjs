// Independent coordinate cross-product Hamilton search; does not import engine.
export function solve(l,limit=2,budget=2000000){
 const n=l.size*l.size,targets=Array.from({length:n},()=>[]),dirs=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
 for(let a=0;a<n;a++)for(let b=0;b<n;b++)if(a!==b&&l.arrows[a]>=0){const [vx,vy]=dirs[l.arrows[a]],dx=b%l.size-a%l.size,dy=(b/l.size|0)-(a/l.size|0);if(dx*vy===dy*vx&&dx*vx+dy*vy>0)targets[a].push(b);}
 const fixed=Object.fromEntries(Object.entries(l.givens).map(([c,k])=>[k,+c])),used=Array(n).fill(false),solutions=[];let nodes=0,branches=0,depth=0,truncated=false;
 function dfs(path,branchDepth){if(++nodes>budget){truncated=true;return;}const k=path.length,a=path[k-1];if(k===n){solutions.push(path.slice());return;}
 const opts=targets[a].filter(b=>!used[b]&&(!l.givens[b]||l.givens[b]===k+1)&&(fixed[k+1]===undefined||fixed[k+1]===b));
 if(opts.length>1){branches++;branchDepth++;depth=Math.max(depth,branchDepth);}for(const b of opts){used[b]=true;path.push(b);dfs(path,branchDepth);path.pop();used[b]=false;if(solutions.length>=limit||truncated)return;}}
 used[fixed[1]]=true;dfs([fixed[1]],0);return {count:solutions.length,solutions,nodes,branches,depth,truncated,exhausted:!truncated&&solutions.length<limit};
}
export function canonical(l){const n=l.size,dirs=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]],keys=[];
 for(let reflect=0;reflect<2;reflect++)for(let rot=0;rot<4;rot++){
 const transform=(x,y)=>{if(reflect)x=n-1-x;for(let k=0;k<rot;k++)[x,y]=[n-1-y,x];return [x,y];};const cells=[];
 for(let a=0;a<n*n;a++){const x=a%n,y=a/n|0,[tx,ty]=transform(x,y);let d=-1;if(l.arrows[a]>=0){const [vx,vy]=dirs[l.arrows[a]],[ex,ey]=transform(x+vx,y+vy);d=dirs.findIndex(v=>v[0]===ex-tx&&v[1]===ey-ty);}cells[ty*n+tx]=d+':'+(l.givens[a]||0);}keys.push(n+'|'+cells.join(','));}return keys.sort()[0];}
