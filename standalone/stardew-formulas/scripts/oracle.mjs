// Independent tuple CSP oracle. Does not import engine, generator, or known answers.
export function solve(p,limit=2) {
 const n=p.n, board=Array(n*n).fill(0), rows=Array(n).fill(0), cols=Array(n).fill(0), owner=[];
 let nodes=0,branches=0,maxDepth=0;const solutions=[];
 const tuples=p.cages.map((c,k)=>{
  c.cells.forEach((v,j)=>owner[v]=[k,j]);const result=[];
  function enumerate(t){if(t.length<c.cells.length){for(let x=1;x<=n;x++)enumerate(t.concat(x));return;}
   for(let a=0;a<t.length;a++)for(let b=0;b<a;b++)if(t[a]===t[b]&&(Math.floor(c.cells[a]/n)===Math.floor(c.cells[b]/n)||c.cells[a]%n===c.cells[b]%n))return;
   let ok=false;
   switch(c.op){case '=':ok=t[0]===c.target;break;case '+':ok=t.reduce((a,b)=>a+b,0)===c.target;break;case '*':ok=t.reduce((a,b)=>a*b,1)===c.target;break;case '-':ok=t.length===2&&(t[0]-t[1]===c.target||t[1]-t[0]===c.target);break;case '/':ok=t.length===2&&(t[0]===t[1]*c.target||t[1]===t[0]*c.target);}
   if(ok)result.push(t);
  }enumerate([]);return result;
 });
 const initialCandidates=Array(n*n).fill(0).map((_,i)=>new Set(tuples[owner[i][0]].map(t=>t[owner[i][1]])).size);
 function search(depth){nodes++;if(solutions.length>=limit)return;let cell=-1,options=null;
  const live=tuples.map((ts,k)=>ts.filter(t=>p.cages[k].cells.every((i,j)=>board[i]?board[i]===t[j]:!((rows[Math.floor(i/n)]|cols[i%n])&(1<<t[j])))));
  if(live.some(t=>!t.length))return;
  for(let i=0;i<board.length;i++)if(!board[i]){const [k,j]=owner[i];const opts=Array.from(new Set(live[k].map(t=>t[j])));if(options===null||opts.length<options.length){cell=i;options=opts;}}
  if(cell<0){solutions.push(board.slice());return;}
  if(options.length>1)branches++;const d=depth+(options.length>1?1:0);maxDepth=Math.max(maxDepth,d);
  const r=Math.floor(cell/n),c=cell%n;
  for(const v of options){board[cell]=v;rows[r]|=1<<v;cols[c]|=1<<v;search(d);board[cell]=0;rows[r]&=~(1<<v);cols[c]&=~(1<<v);if(solutions.length>=limit)return;}
 }
 search(0);return {count:solutions.length,solutions,nodes,branches,maxDepth,initialCandidates,exhausted:solutions.length<limit};
}
export function canonical(p,topology=false){
 const n=p.n,versions=[];
 for(let mirror=0;mirror<2;mirror++)for(let turn=0;turn<4;turn++){
  const map=i=>{let r=Math.floor(i/n),c=i%n;if(mirror)c=n-1-c;for(let k=0;k<turn;k++){const old=r;r=c;c=n-1-old;}return r*n+c;};
  versions.push(p.cages.map(c=>c.op+':'+(topology?'':c.target)+':'+c.cells.map(map).sort((a,b)=>a-b).join(',')).sort().join('|'));
 }
 return n+':'+versions.sort()[0];
}
