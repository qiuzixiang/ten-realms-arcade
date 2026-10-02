// Independent binary-domain CSP: -1 unknown, 0 white, 1 black. No stored answers or engine imports.
export function solve(p,limit=2,assumptions=[]) {
 const n=p.n,N=n*n,adj=Array.from({length:N},()=>[]),dup=Array.from({length:N},()=>[]),solutions=[];
 let nodes=0,contradictions=0,connectivityPrunes=0,maxDepth=0;
 for(let a=0;a<N;a++)for(let b=a+1;b<N;b++){
  const ar=(a/n)|0,ac=a%n,br=(b/n)|0,bc=b%n;
  if(Math.abs(ar-br)+Math.abs(ac-bc)===1){adj[a].push(b);adj[b].push(a);}
  if((ar===br||ac===bc)&&p.cells[a]===p.cells[b]){dup[a].push(b);dup[b].push(a);}}
 function search(input,depth){if(solutions.length>=limit)return;nodes++;maxDepth=Math.max(maxDepth,depth);const s=input.slice();let changed=true;
  while(changed){changed=false;for(let a=0;a<N;a++){if(s[a]<0)continue;const list=s[a]===1?adj[a]:dup[a],v=1-s[a];for(const b of list){if(s[b]===1-v){contradictions++;return;}if(s[b]===-1){s[b]=v;changed=true;}}}}
  const start=s.findIndex(v=>v!==1);if(start<0){contradictions++;return;}
  const visited=new Set([start]),stack=[start];while(stack.length){for(const b of adj[stack.pop()])if(s[b]!==1&&!visited.has(b)){visited.add(b);stack.push(b);}}
  if(s.some((v,i)=>v===0&&!visited.has(i))){connectivityPrunes++;return;}
  let chosen=-1,score=-1;for(let a=0;a<N;a++)if(s[a]===-1){const sc=dup[a].filter(b=>s[b]===-1).length*3+adj[a].filter(b=>s[b]===-1).length;if(sc>score){chosen=a;score=sc;}}
  if(chosen<0){solutions.push(s);return;}s[chosen]=0;search(s,depth+1);s[chosen]=1;search(s,depth+1);
 }
 const initial=Array(N).fill(-1);for(const pair of assumptions){if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||pair[0]<0||pair[0]>=N||![0,1].includes(pair[1]))return {solutions:[],nodes:0,invalid:true};if(initial[pair[0]]!==-1&&initial[pair[0]]!==pair[1])return {solutions:[],nodes:0};initial[pair[0]]=pair[1];}
 search(initial,0);return {solutions,nodes,contradictions,connectivityPrunes,maxDepth,exhausted:solutions.length<limit};
}
export function structureKey(p) {
 const n=p.n,N=n*n,keys=[];
 for(let t=0;t<8;t++){const cells=Array(N);for(let i=0;i<N;i++){let r=(i/n)|0,c=i%n;if(t>=4)c=n-1-c;for(let k=0;k<t%4;k++){const old=r;r=c;c=n-1-old;}cells[r*n+c]=p.cells[i];}
 const pairs=[];for(let a=0;a<N;a++)for(let b=a+1;b<N;b++)if(cells[a]===cells[b]&&(((a/n)|0)===((b/n)|0)||a%n===b%n))pairs.push(a+':'+b);keys.push(pairs.join(','));}
 return n+'|'+keys.sort()[0];
}
