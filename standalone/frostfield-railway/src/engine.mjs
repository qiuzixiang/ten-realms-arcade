// Tracks rules reimplemented for Frostfield Railway. See THIRD_PARTY_NOTICES.md.
export const DIRS = [{bit:1,op:4,dx:0,dy:-1,name:'上'},{bit:2,op:8,dx:1,dy:0,name:'右'},{bit:4,op:1,dx:0,dy:1,name:'下'},{bit:8,op:2,dx:-1,dy:0,name:'左'}];
export const TILES = [10,5,3,6,12,9];
export function pop(m) { return DIRS.reduce((s,d)=>s+((m&d.bit)?1:0),0); }
export function neighbor(p,i,d) { const x=i%p.n+d.dx,y=Math.floor(i/p.n)+d.dy;return x<0||x>=p.n||y<0||y>=p.n?-1:y*p.n+x; }
export function outside(p,i,d) { return (i===p.entry*p.n&&d.bit===8)||(i===(p.n-1)*p.n+p.exit&&d.bit===4); }
export function initial(p) {
 const s={masks:Array(p.n*p.n).fill(0),notes:Array(p.n*p.n).fill(0),moves:0};
 p.givens.forEach(g=>{s.masks[g[0]]|=g[1];DIRS.forEach(d=>{const j=neighbor(p,g[0],d);if(j>=0&&(g[1]&d.bit))s.masks[j]|=d.op;});});
 return s;
}
export function validState(p,s) {
 if(!s||!Array.isArray(s.masks)||!Array.isArray(s.notes)||s.masks.length!==p.n*p.n||s.notes.length!==p.n*p.n||!Number.isSafeInteger(s.moves)||s.moves<0||s.moves>1000000)return false;
 if(s.notes.some(x=>!Number.isInteger(x)||x<0||x>2))return false;
 for(let i=0;i<s.masks.length;i++){
  const m=s.masks[i];if(!Number.isInteger(m)||m<0||m>15||pop(m)>2||m&&s.notes[i])return false;
  for(const d of DIRS){const j=neighbor(p,i,d);if(j<0){if(!!(m&d.bit)!==outside(p,i,d))return false;}else if(!!(m&d.bit)!==!!(s.masks[j]&d.op))return false;}
 }
 return p.givens.every(g=>s.masks[g[0]]===g[1]);
}
export function change(p,s,i,value,kind='tile') {
 const fail=reason=>({ok:false,state:s,reason});
 if(!Number.isInteger(i)||i<0||i>=p.n*p.n||!validState(p,s))return fail('无效的格子');
 if(p.givens.some(g=>g[0]===i))return fail('带铆钉的固定轨片不能更改');
 const next={masks:s.masks.slice(),notes:s.notes.slice(),moves:s.moves+1};
 if(kind==='note'){
  if(![0,1,2].includes(value)||s.masks[i])return fail('请在没有轨道的格子做笔记');
  next.notes[i]=value;
 }else if(kind==='tile'){
  if(![0].concat(TILES).includes(value))return fail('一格只能有两个方向的接头');
  next.masks[i]=value;next.notes[i]=0;
  for(const d of DIRS){const j=neighbor(p,i,d);if(j<0){if(!!(value&d.bit)!==outside(p,i,d))return fail('只有 A 和 B 可以通向边界外');}else{next.masks[j]=(next.masks[j]&~d.op)|((value&d.bit)?d.op:0);if(next.masks[j])next.notes[j]=0;}}
 }else return fail('无效操作');
 if(!validState(p,next))return fail('会改变固定轨片，或让邻格超过两个接头');
 if(next.masks.every((v,k)=>v===s.masks[k])&&next.notes.every((v,k)=>v===s.notes[k]))return fail('这一格没有变化');
 return {ok:true,state:next,reason:''};
}
export function inspect(p,s) {
 if(!validState(p,s))return {status:'conflict',message:'轨道数据无效',path:[],rows:[],cols:[],conflicts:[]};
 const rows=Array(p.n).fill(0),cols=Array(p.n).fill(0),used=[],conflicts=[];
 s.masks.forEach((m,i)=>{if(m){used.push(i);rows[Math.floor(i/p.n)]++;cols[i%p.n]++;}});
 used.forEach(i=>{if(rows[Math.floor(i/p.n)]>p.rows[Math.floor(i/p.n)]||cols[i%p.n]>p.cols[i%p.n])conflicts.push(i);});
 const visited=new Set(),path=[];let curr=p.entry*p.n,prev=-1;
 while(curr>=0&&!visited.has(curr)){visited.add(curr);path.push(curr);const next=DIRS.map(d=>({d,j:neighbor(p,curr,d)})).find(q=>q.j>=0&&q.j!==prev&&(s.masks[curr]&q.d.bit));if(!next)break;prev=curr;curr=next.j;}
 const full=used.every(i=>pop(s.masks[i])===2);
 const exact=rows.every((v,i)=>v===p.rows[i])&&cols.every((v,i)=>v===p.cols[i]);
 const connected=path.length===used.length&&path[path.length-1]===(p.n-1)*p.n+p.exit;
 const won=full&&exact&&connected;
 // Detect any completed component without both stations, including a detached ring.
 let badComponent=false;const checked=new Set();
 used.forEach(start=>{if(checked.has(start))return;const stack=[start],component=[];checked.add(start);while(stack.length){const i=stack.pop();component.push(i);DIRS.forEach(d=>{const j=neighbor(p,i,d);if(j>=0&&(s.masks[i]&d.bit)&&!checked.has(j)){checked.add(j);stack.push(j);}});}if(component.every(i=>pop(s.masks[i])===2)&&!(component.includes(p.entry*p.n)&&component.includes((p.n-1)*p.n+p.exit))){badComponent=true;component.forEach(i=>conflicts.push(i));}});
 const conflict=conflicts.length>0||badComponent||(full&&exact&&!connected);
 return {status:won?'won':conflict?'conflict':'unfinished',message:won?'全线接通 · 可以发车':conflict?badComponent?'发现脱离主线的闭环':'轨道超出配额，或没有连成 A→B':'把接头接齐，让 A 与 B 连成一条线',path:won?path:[],rows,cols,conflicts};
}
export function pathState(p,path) {
 const s={masks:Array(p.n*p.n).fill(0),notes:Array(p.n*p.n).fill(0),moves:0};
 for(let k=0;k<path.length;k++){const i=path[k];if(k===0)s.masks[i]|=8;if(k===path.length-1)s.masks[i]|=4;if(k){const prev=path[k-1],d=DIRS.find(d=>neighbor(p,prev,d)===i);if(!d)throw Error('Nonadjacent path');s.masks[prev]|=d.bit;s.masks[i]|=d.op;}}
 return s;
}
export function tileName(mask) {return DIRS.filter(d=>mask&d.bit).map(d=>d.name).join('—')||'空白';}
