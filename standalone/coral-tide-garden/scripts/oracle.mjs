// Independent cell-domain search. No imports from engine or reference answers.
export function solve(l,cap=300000){
 const n=l.n,a=l.givens.slice(),adj=a.map((_,i)=>Array.from({length:a.length},(_,j)=>j).filter(j=>Math.abs(i%n-j%n)+Math.abs(Math.floor(i/n)-Math.floor(j/n))===1));let nodes=0,cut=false,branches=0,maxDepth=0;const answers=[];
 function possible(){const parent=a.map((_,i)=>i),size=a.map(()=>1);function find(i){while(i!==parent[i])i=parent[i];return i;}for(let i=0;i<a.length;i++)if(a[i])for(const j of adj[i])if(a[j]===a[i]){let p=find(i),q=find(j);if(p!==q){parent[p]=q;size[q]+=size[p];}}
 for(let i=0;i<a.length;i++)if(a[i]&&find(i)===i){if(size[i]>a[i])return false;const reach=new Set([i]),todo=[i];while(todo.length){let p=todo.pop();for(const j of adj[p])if(!reach.has(j)&&(!a[j]||a[j]===a[i])){reach.add(j);todo.push(j);}}if(reach.size<a[i])return false;}return true;}
 function visit(depth){if(answers.length>=2||cut)return;if(++nodes>cap){cut=true;return;}maxDepth=Math.max(maxDepth,depth);let pick=-1,domain;
 for(let i=0;i<a.length;i++)if(!a[i]){const d=[];for(let v=1;v<=9;v++){a[i]=v;if(possible())d.push(v);}a[i]=0;if(!d.length)return;if(!domain||d.length<domain.length){pick=i;domain=d;if(d.length===1)break;}}
 if(pick<0){answers.push(a.slice());return;}if(domain.length>1)branches++;for(const v of domain){a[pick]=v;visit(depth+1);a[pick]=0;if(cut||answers.length>=2)return;}}
 if(possible())visit(0);return {count:answers.length,exhausted:!cut&&answers.length<2,truncated:cut,nodes,branches,maxDepth,solutions:answers};
}
export function canonical(l){let variants=[];for(let flip=0;flip<2;flip++)for(let r=0;r<4;r++){const a=Array(l.n*l.n);for(let i=0;i<a.length;i++){let x=i%l.n,y=Math.floor(i/l.n);if(flip)x=l.n-1-x;for(let k=0;k<r;k++){let t=x;x=l.n-1-y;y=t;}a[y*l.n+x]=l.givens[i];}variants.push(a.join(''));}return l.n+':'+variants.sort()[0];}
