/* Pure, parameterized arithmetic-cage rules. No solution data is read here. */
export const SYMBOLS = {'+':'+','*':'×','-':'−','/':'÷','=':''};
export function label(c) { return c.target + SYMBOLS[c.op]; }
export function satisfied(c, values) {
  const a=c.cells.map(i=>values[i]);
  if(a.some(v=>!Number.isInteger(v)||v<1)) return false;
  if(c.op==='=') return a.length===1&&a[0]===c.target;
  if(c.op==='+') return a.reduce((s,v)=>s+v,0)===c.target;
  if(c.op==='*') return a.reduce((s,v)=>s*v,1)===c.target;
  if(a.length!==2) return false;
  return c.op==='-' ? Math.abs(a[0]-a[1])===c.target : c.op==='/'&&Math.max(a[0],a[1])===c.target*Math.min(a[0],a[1]);
}
export function validateLevel(l) {
  if(!l||!Number.isInteger(l.n)||l.n<3||l.n>5||!Array.isArray(l.cages)) return false;
  const seen=new Set();
  for(const c of l.cages) {
    if(!c||!Array.isArray(c.cells)||!c.cells.length||!Object.prototype.hasOwnProperty.call(SYMBOLS,c.op)||!Number.isInteger(c.target)||c.target<0) return false;
    if((c.op==='-'||c.op==='/')&&c.cells.length!==2) return false;
    if(c.op==='='&&c.cells.length!==1) return false;
    for(const i of c.cells) { if(!Number.isInteger(i)||i<0||i>=l.n*l.n||seen.has(i))return false; seen.add(i); }
    const reached=new Set([c.cells[0]]);
    let changed=true;
    while(changed){ changed=false; for(const i of c.cells) if(!reached.has(i)&&Array.from(reached).some(j=>Math.abs(Math.floor(i/l.n)-Math.floor(j/l.n))+Math.abs(i%l.n-j%l.n)===1)){reached.add(i);changed=true;} }
    if(reached.size!==c.cells.length)return false;
  }
  return seen.size===l.n*l.n;
}
export function createState(l) {return {values:Array(l.n*l.n).fill(0),notes:Array(l.n*l.n).fill(0),history:[],moves:0};}
function rowOK(l,v,i,x) {for(let j=0;j<v.length;j++) if(j!==i&&v[j]===x&&(Math.floor(j/l.n)===Math.floor(i/l.n)||j%l.n===i%l.n))return false; return true;}
// Exhaustive local support search; repeated values in a cage are permitted across different rows/columns.
export function possible(l,c,values) {
  const v=values.slice();
  function fill(k) {
    if(k===c.cells.length)return satisfied(c,v);
    const i=c.cells[k];
    if(v[i])return fill(k+1);
    for(let x=1;x<=l.n;x++){if(!rowOK(l,v,i,x))continue;v[i]=x;if(fill(k+1)){v[i]=0;return true;}v[i]=0;}
    return false;
  }
  return fill(0);
}
export function evaluate(l,s) {
  const v=s&&s.values;
  if(!Array.isArray(v)||v.length!==l.n*l.n||v.some(x=>!Number.isInteger(x)||x<0||x>l.n)) return {complete:false,invalid:[],cages:[],malformed:true};
  const bad=new Set();
  for(let i=0;i<v.length;i++)if(v[i]&&!rowOK(l,v,i,v[i]))bad.add(i);
  const cages=l.cages.map(c=>satisfied(c,v)?'done':possible(l,c,v)?'open':'error');
  cages.forEach((x,k)=>{if(x==='error')l.cages[k].cells.forEach(i=>bad.add(i));});
  return {complete:v.every(Boolean)&&bad.size===0&&cages.every(x=>x==='done'),invalid:Array.from(bad),cages:cages};
}
export function apply(l,s,a) {
  if(!a||!Number.isInteger(a.cell)||a.cell<0||a.cell>=s.values.length||!Number.isInteger(a.value)||a.value<0||a.value>l.n||!['fill','note'].includes(a.type))return s;
  if(a.type==='note'&&(s.values[a.cell]||a.value===0))return s;
  if(a.type==='fill'&&s.values[a.cell]===a.value&&s.notes[a.cell]===0)return s;
  const next={values:s.values.slice(),notes:s.notes.slice(),history:s.history.concat([{values:s.values.slice(),notes:s.notes.slice(),moves:s.moves}]),moves:s.moves+(a.type==='fill'?1:0)};
  if(a.type==='fill'){next.values[a.cell]=a.value;next.notes[a.cell]=0;}else next.notes[a.cell]^=1<<a.value;
  return next;
}
export function undo(s){if(!s.history.length)return s;const h=s.history[s.history.length-1];return {values:h.values.slice(),notes:h.notes.slice(),moves:h.moves,history:s.history.slice(0,-1)};}
export function replay(l,events){if(!Array.isArray(events)||events.length>2000)return null;let s=createState(l);for(const a of events){const next=a&&a.type==='undo'?undo(s):apply(l,s,a);if(next===s)return null;s=next;}return s;}
export function candidates(l,s,i){const v=s.values.slice();v[i]=0;const c=l.cages.find(k=>k.cells.includes(i));const out=[];for(let x=1;x<=l.n;x++){if(!rowOK(l,v,i,x))continue;v[i]=x;if(possible(l,c,v))out.push(x);v[i]=0;}return out;}
export function hint(l,s){
  const status=evaluate(l,s);
  if(status.invalid.length)return {cell:status.invalid[0],text:'先检查标有 ! 的位置：同行同列不能重复，算笼也要能达到目标。可撤销或擦除后再试。'};
  let best=null;
  for(let i=0;i<s.values.length;i++)if(!s.values[i]){const opts=candidates(l,s,i);if(!best||opts.length<best.options.length)best={cell:i,options:opts};}
  if(!best)return {text:'所有行列和算笼均已完成。'};
  const c=l.cages.find(k=>k.cells.includes(best.cell));
  best.text='第 '+(Math.floor(best.cell/l.n)+1)+' 行第 '+(best.cell%l.n+1)+' 列：结合同行同列排除和 '+label(c)+' 算笼，可选 '+(best.options.join('、')||'无')+'。'+(best.options.length===1?'只剩一个候选，可以确定。':'继续观察交叉行列；这些是局部候选，不保证都能完成全盘。');
  return best;
}
