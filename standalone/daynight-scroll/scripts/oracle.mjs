// Independent row-pattern search: no import from game engine.
export function oracle(givens,n,limit=2){
 const patterns=[];for(let mask=0;mask<2**n;mask++){const row=Array.from({length:n},(_,i)=>(mask>>i)&1);if(row.reduce((a,b)=>a+b,0)!==n/2)continue;if(row.some((v,i)=>i>1&&v===row[i-1]&&v===row[i-2]))continue;patterns.push(row);}
 const candidates=Array.from({length:n},(_,r)=>patterns.filter(row=>row.every((v,c)=>givens[r*n+c]===-1||givens[r*n+c]===v)));
 const solutions=[];let nodes=0;function visit(rows,counts){nodes++;if(solutions.length>=limit)return;if(rows.length===n){solutions.push(rows.flat());return;}for(const row of candidates[rows.length]){const depth=rows.length;if(row.some((v,c)=>counts[c]+v>n/2||depth+1-counts[c]-v>n/2||depth>1&&rows[depth-1][c]===v&&rows[depth-2][c]===v))continue;visit(rows.concat([row]),counts.map((x,c)=>x+row[c]));if(solutions.length>=limit)return;}}visit([],Array(n).fill(0));return {solutions,nodes};
}
export function canonical(a,n){const forms=[];for(let flip=0;flip<2;flip++)for(let rot=0;rot<4;rot++)for(let inv=0;inv<2;inv++){const b=Array(n*n);a.forEach((v,i)=>{let r=Math.floor(i/n),c=i%n;if(flip)c=n-1-c;for(let k=0;k<rot;k++){const old=r;r=c;c=n-1-old;}b[r*n+c]=v===-1?'.':String(inv?1-v:v);});forms.push(b.join(''));}return forms.sort()[0];}
