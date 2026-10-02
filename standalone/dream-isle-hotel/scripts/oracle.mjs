// Independent exhaustive rectangle enumerator + cell exact-cover, no engine imports.
export function oracle(p,limit=2){
 const options=[];
 for(let top=0;top<p.n;top++)for(let left=0;left<p.n;left++)for(let bottom=top;bottom<p.n;bottom++)for(let right=left;right<p.n;right++){
 const cs=p.clues.filter(c=>c.x>=left&&c.x<=right&&c.y>=top&&c.y<=bottom);
 if(cs.length!==1||cs[0].v!==(right-left+1)*(bottom-top+1))continue;
 const cells=[];for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)cells.push(y*p.n+x);
 options.push({r:{x:left,y:top,w:right-left+1,h:bottom-top+1},cells});
 }
 const byCell=Array.from({length:p.n*p.n},(_,i)=>options.filter(o=>o.cells.includes(i)));
 const used=new Set(),answers=[];let nodes=0,branches=0,forced=0,maxChoices=0;
 function visit(chosen){nodes++;if(answers.length>=limit)return;if(used.size===p.n*p.n){answers.push(chosen.slice());return;}
 let viable=null;for(let i=0;i<p.n*p.n;i++){if(used.has(i))continue;const os=byCell[i].filter(o=>o.cells.every(c=>!used.has(c)));if(!os.length)return;if(!viable||os.length<viable.length)viable=os;}
 if(viable.length>1)branches++;else forced++;maxChoices=Math.max(maxChoices,viable.length);
 for(const o of viable){o.cells.forEach(c=>used.add(c));visit(chosen.concat([o.r]));o.cells.forEach(c=>used.delete(c));if(answers.length>=limit)return;}}
 visit([]);return {count:answers.length,answer:answers[0],nodes,branches,forced,maxChoices,candidates:options.length};
}
export function canonical(p){const forms=[];for(let k=0;k<8;k++){const cs=p.clues.map(c=>{let x=c.x,y=c.y;if(k>=4)x=p.n-1-x;for(let t=0;t<k%4;t++){const old=x;x=p.n-1-y;y=old;}return [x,y,c.v];}).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);forms.push(JSON.stringify([p.n,cs]));}return forms.sort()[0];}

export function solutionCanonical(p){const forms=[];for(let k=0;k<8;k++){const rs=p.answer.map(r=>{const points=[[r.x,r.y],[r.x+r.w-1,r.y+r.h-1]].map(([a,b])=>{let x=a,y=b;if(k>=4)x=p.n-1-x;for(let t=0;t<k%4;t++){const old=x;x=p.n-1-y;y=old;}return [x,y];});const x=Math.min(points[0][0],points[1][0]),y=Math.min(points[0][1],points[1][1]);return [x,y,Math.abs(points[0][0]-points[1][0])+1,Math.abs(points[0][1]-points[1][1])+1];}).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);forms.push(JSON.stringify([p.n,rs]));}return forms.sort()[0];}
