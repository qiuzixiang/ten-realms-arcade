export const WHITE = 0, BLACK = 1, CIRCLE = 2;
export function validPuzzle(p) { return !!p && Number.isInteger(p.n) && p.n >= 2 && p.n <= 6 && Array.isArray(p.cells) && p.cells.length === p.n*p.n && p.cells.every(x=>Number.isInteger(x)&&x>0&&x<=p.n); }
export function neighbors(i,n) { const r=Math.floor(i/n),c=i%n; return [r>0?i-n:-1,c>0?i-1:-1,c<n-1?i+1:-1,r<n-1?i+n:-1].filter(x=>x>=0); }
export function fresh(p) { return {modes:Array(p.n*p.n).fill(0),moves:0}; }
export function normalize(p,s) { return s && Array.isArray(s.modes) && s.modes.length===p.n*p.n && s.modes.every(x=>x===0||x===1||x===2) && Number.isInteger(s.moves)&&s.moves>=0&&s.moves<=100000 ? {modes:s.modes.slice(),moves:s.moves}:null; }
export function act(p,s,i,mode) { if(!Number.isInteger(i)||i<0||i>=p.cells.length||![0,1,2].includes(mode)||s.modes[i]===mode||s.moves>=100000)return s; const modes=s.modes.slice();modes[i]=mode;return {modes:modes,moves:s.moves+1}; }
export function analyze(p,s) {
 if(!validPuzzle(p)||!normalize(p,s))return {complete:false,invalid:true,duplicates:[],touching:[],disconnected:[],whiteCount:0};
 const dup=new Set(),touch=new Set(),white=[]; const n=p.n;
 for(let i=0;i<n*n;i++){if(s.modes[i]===1){neighbors(i,n).forEach(j=>{if(s.modes[j]===1){touch.add(i);touch.add(j);}});continue;}white.push(i);
  for(let j=i+1;j<n*n;j++)if(s.modes[j]!==1&&p.cells[i]===p.cells[j]&&(Math.floor(i/n)===Math.floor(j/n)||i%n===j%n)){dup.add(i);dup.add(j);}}
 const seen=new Set(),queue=white.length?[white[0]]:[];
 while(queue.length){const i=queue.pop();if(seen.has(i))continue;seen.add(i);neighbors(i,n).forEach(j=>{if(s.modes[j]!==1&&!seen.has(j))queue.push(j);});}
 const disconnected=white.filter(i=>!seen.has(i));
 return {complete:white.length>0&&!dup.size&&!touch.size&&!disconnected.length,invalid:false,duplicates:Array.from(dup),touching:Array.from(touch),disconnected:disconnected,whiteCount:white.length};
}
export function replay(p,log) { if(!Array.isArray(log)||log.length>10000)return null;let s=fresh(p);for(const a of log){if(!Array.isArray(a)||a.length!==2)return null;const t=act(p,s,a[0],a[1]);if(t===s)return null;s=t;}return s; }
