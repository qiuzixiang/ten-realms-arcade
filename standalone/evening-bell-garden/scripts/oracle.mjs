// Independent meet-in-the-middle oracle. No engine imports or Gaussian elimination.
export function oracle(level, lights=level.initial) {
  const masks=level.templates.map(t=>t.reduce((v,j)=>v^(1<<j),0));
  const target=lights.reduce((v,b,j)=>v|((1-b)<<j),0), split=Math.floor(masks.length/2);
  function enumerate(a){const out=[{v:0,taps:[]}];for(let i=0;i<a.length;i++){const len=out.length;for(let j=0;j<len;j++)out.push({v:out[j].v^a[i],taps:out[j].taps.concat(i)});}return out;}
  const left=new Map(); for(const x of enumerate(masks.slice(0,split))){const old=left.get(x.v);if(!old||x.taps.length<old.length)left.set(x.v,x.taps);}
  let best=null;for(const x of enumerate(masks.slice(split))){const y=left.get(target^x.v);if(y&&(!best||y.length+x.taps.length<best.length))best=y.concat(x.taps.map(i=>i+split));}
  return best;
}
export function canonical(l){const s=l.size,forms=[];for(let flip=0;flip<2;flip++)for(let turns=0;turns<4;turns++){const map=[];for(let i=0;i<s*s;i++){let x=i%s,y=Math.floor(i/s);if(flip)x=s-1-x;for(let j=0;j<turns;j++)[x,y]=[s-1-y,x];map[i]=y*s+x;}const bits=[],t=[];l.initial.forEach((v,i)=>bits[map[i]]=v);l.templates.forEach((a,i)=>t[map[i]]=a.map(j=>map[j]).sort((a,b)=>a-b));forms.push(JSON.stringify([s,bits,t]));}return forms.sort()[0];}
// Directed coloured graph isomorphism: vertices are bells, arcs are influence,
// vertex colours are initial light states. This also rejects non-geometric relabelings.
export function graphColours(l){
 const n=l.initial.length;let colours=l.initial.map((b,i)=>b+':'+l.templates[i].length+':'+l.templates.filter(t=>t.includes(i)).length);
 for(let r=0;r<3;r++)colours=colours.map((c,i)=>{const text=c+'|'+l.templates[i].map(j=>colours[j]).sort().join(',')+'|'+l.templates.map((t,j)=>t.includes(i)?colours[j]:null).filter(x=>x!==null).sort().join(',');return hash(text);});
 return colours;
}
function hash(s){let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return (a>>>0).toString(16)+':'+(b>>>0).toString(16);}
export function graphSignature(l){return l.size+'|'+graphColours(l).sort().join('|');}
export function isomorphic(a,b){
 if(a.size!==b.size)return false;const ac=graphColours(a),bc=graphColours(b);if(ac.slice().sort().join('|')!==bc.slice().sort().join('|'))return false;
 const n=ac.length,map=Array(n).fill(-1),used=new Set();let visited=0;
 function search(depth){if(depth===n)return true;if(++visited>1000000)throw Error('Isomorphism proof exceeded budget; reject candidate');let i=-1,candidates=null;for(let x=0;x<n;x++)if(map[x]<0){const cs=[];for(let y=0;y<n;y++)if(!used.has(y)&&ac[x]===bc[y]){let ok=true;for(let k=0;k<n;k++)if(map[k]>=0&&(a.templates[x].includes(k)!==b.templates[y].includes(map[k])||a.templates[k].includes(x)!==b.templates[map[k]].includes(y))){ok=false;break;}if(ok)cs.push(y);}if(!cs.length)return false;if(!candidates||cs.length<candidates.length){i=x;candidates=cs;}}
 for(const j of candidates){map[i]=j;used.add(j);if(search(depth+1))return true;map[i]=-1;used.delete(j);}return false;}
 return search(0);
}
