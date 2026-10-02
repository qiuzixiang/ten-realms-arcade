// Independent proof oracle. No engine import and no reading puzzle.solution.
// Enumerate connected symmetric regions around each mandatory core footprint,
// then exact-cover all cells and each core. BigInt only used during development.
export function prove(p,{regionLimit=50000,nodeLimit=500000}={}) {
 const n=p.w*p.h,bit=i=>1n<<BigInt(i),full=(1n<<BigInt(n))-1n;
 const neighbors=Array.from({length:n},(_,i)=>[i%p.w?i-1:-1,i%p.w<p.w-1?i+1:-1,i>=p.w?i-p.w:-1,i<n-p.w?i+p.w:-1].filter(j=>j>=0));
 const footprints=p.cores.map(c=>{let a=[];for(let i=0;i<n;i++){const x=2*(i%p.w)+1,y=2*Math.floor(i/p.w)+1;if(Math.abs(x-c.x)<=1&&Math.abs(y-c.y)<=1)a.push(i);}return a;});
 const regions=[],byCell=Array.from({length:n},()=>[]);let truncated=false,enumerated=0,nodes=0,branches=0,maxDepth=0;
 for(let k=0;k<p.cores.length;k++) {
  const c=p.cores[k],forbidden=new Set(footprints.filter((_,l)=>l!==k).flat());
  const opposite=Array.from({length:n},(_,i)=>{let x=c.x-1-i%p.w,y=c.y-1-Math.floor(i/p.w);return x<0||x>=p.w||y<0||y>=p.h?-1:y*p.w+x;});
  const allowed=i=>opposite[i]>=0&&!forbidden.has(i)&&!forbidden.has(opposite[i]);
  if(footprints[k].some(i=>!allowed(i)))return {count:0,unique:false,truncated:false};
  const initial=footprints[k].reduce((a,i)=>a|bit(i),0n),queue=[initial],seen=new Set(queue);let cursor=0;
  while(cursor<queue.length){const mask=queue[cursor++];const cells=[];for(let i=0;i<n;i++)if(mask&bit(i))cells.push(i);const ri=regions.length;regions.push({core:k,mask,cells});cells.forEach(i=>byCell[i].push(ri));enumerated++;
   if(enumerated>regionLimit){truncated=true;break;}
   const frontier=new Set(cells.flatMap(i=>neighbors[i]).filter(i=>!(mask&bit(i))&&allowed(i)));
   for(const i of frontier){const j=opposite[i];if(!neighbors[j].some(a=>(mask&bit(a))||a===i))continue;const next=mask|bit(i)|bit(j);if(!seen.has(next)){seen.add(next);queue.push(next);}}
  }
  if(truncated)break;
 }
 const solutions=[];
 function search(covered,chosen,used,depth){if(solutions.length>=2||truncated)return;if(++nodes>nodeLimit){truncated=true;return;}maxDepth=Math.max(depth,maxDepth);if(covered===full){if(chosen.length===p.cores.length){let owners=Array(n).fill(-1);chosen.forEach(r=>r.cells.forEach(i=>owners[i]=r.core));solutions.push(owners);}return;}
 let options=null;
 for(let i=0;i<n;i++)if(!(covered&bit(i))){const a=byCell[i].map(r=>regions[r]).filter(r=>!used.has(r.core)&&!(r.mask&covered));if(!a.length)return;if(!options||a.length<options.length)options=a;}
 if(options.length>1)branches++;
 for(const r of options){const next=new Set(used);next.add(r.core);search(covered|r.mask,chosen.concat(r),next,depth+(options.length>1?1:0));if(solutions.length>=2||truncated)return;}
 }
 if(!truncated)search(0n,[],new Set(),0);
 return {count:solutions.length,unique:solutions.length===1&&!truncated,truncated,solutions,enumerated,nodes,branches,maxDepth};
}
export function canonical(p){const keys=[];for(let swap=0;swap<2;swap++)for(let fx=0;fx<2;fx++)for(let fy=0;fy<2;fy++){const w=swap?p.h:p.w,h=swap?p.w:p.h;keys.push(w+'x'+h+':'+p.cores.map(c=>{let x=swap?c.y:c.x,y=swap?c.x:c.y;return [(fx?2*w-x:x),(fy?2*h-y:y)];}).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(c=>c.join(',')).join(';'));}return keys.sort()[0];}
