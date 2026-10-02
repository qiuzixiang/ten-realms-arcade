// Independent representation: complete row permutations, column masks and vertical order filtering.
// Never imports the engine and never reads solution. Search only stops after a second witness.
const cache=new Map();
function permutations(n){if(cache.has(n))return cache.get(n);const out=[];function visit(a){if(a.length===n){out.push(a);return;}for(let v=1;v<=n;v++)if(!a.includes(v))visit(a.concat(v));}visit([]);cache.set(n,out);return out;}
export function oracle({n,relations},limit=2){
  let nodes=0,found=0,witness=null;const all=permutations(n);
  const rows=Array.from({length:n},(_,r)=>all.filter(p=>relations.every(e=>Math.floor(e.a/n)!==r || e.b-e.a!==1 || (e.sign==='<'?p[e.a%n]<p[e.b%n]:p[e.a%n]>p[e.b%n]))));
  const vertical=relations.filter(e=>e.b-e.a===n), assigned=Array(n).fill(null),masks=Array(n).fill(0);
  function options(r){return rows[r].filter(p=>p.every((v,c)=>!(masks[c]&(1<<v))) && vertical.every(e=>{
    const a=Math.floor(e.a/n),b=Math.floor(e.b/n),c=e.a%n;
    if(a===r && assigned[b])return e.sign==='<'?p[c]<assigned[b][c]:p[c]>assigned[b][c];
    if(b===r && assigned[a])return e.sign==='<'?assigned[a][c]<p[c]:assigned[a][c]>p[c];return true;
  }));}
  function search(){nodes++;if(found>=limit)return;let best=-1,choices=null;for(let r=0;r<n;r++){if(assigned[r])continue;const p=options(r);if(!p.length)return;if(!choices||p.length<choices.length){best=r;choices=p;}}
    if(best<0){found++;if(!witness)witness=assigned.flat();return;}
    for(const p of choices){assigned[best]=p;p.forEach((v,c)=>masks[c]|=1<<v);search();p.forEach((v,c)=>masks[c]&=~(1<<v));assigned[best]=null;if(found>=limit)return;}
  }search();return {count:found,exhausted:found<limit,nodes,witness};
}
