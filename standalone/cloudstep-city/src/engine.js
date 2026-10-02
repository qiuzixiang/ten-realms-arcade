/* Cloudstep City — Towers rules; independent implementation, MIT. ES2017. */
var City = (function () {
  const sides = ['top','bottom','left','right'];
  function visible(a) { let h=0,k=0; a.forEach(v=>{if(v>h){h=v;k++;}}); return k; }
  function line(p,b,s,i) { let a=[]; for(let j=0;j<p.n;j++) a.push(b[s==='left'||s==='right'?i*p.n+j:j*p.n+i]); return s==='bottom'||s==='right'?a.reverse():a; }
  function clues(n,b) {const p={n:n},c={}; sides.forEach(s=>{c[s]=Array.from({length:n},(_,i)=>visible(line(p,b,s,i)));}); return c;}
  function initial(p) {return {values:p.givens.slice(),notes:p.givens.map(()=>0)};}
  function move(p,s,a) {if(!a||!Number.isInteger(a.i)||a.i<0||a.i>=p.n*p.n||p.givens[a.i]||!Number.isInteger(a.v)||a.v<0||a.v>p.n||!['set','note'].includes(a.type))return s;
    if(a.type==='note'&&(s.values[a.i]||!a.v))return s;
    const t={values:s.values.slice(),notes:s.notes.slice()};
    if(a.type==='note')t.notes[a.i]^=1<<a.v;else {t.values[a.i]=a.v;t.notes[a.i]=0;}
    return JSON.stringify(t)===JSON.stringify(s)?s:t;
  }
  function evaluate(p,s) {const b=s.values,bad=[],edges=[]; let full=b.every(v=>Number.isInteger(v)&&v>=1&&v<=p.n);
    for(let i=0;i<p.n;i++) ['left','top'].forEach(side=>{const a=line(p,b,side,i);a.forEach((v,j)=>{if(v&&a.indexOf(v)!==a.lastIndexOf(v))bad.push(side==='left'?i*p.n+j:j*p.n+i);});});
    sides.forEach(side=>p.clues[side].forEach((c,i)=>{const a=line(p,b,side,i);if(c&&a.every(Boolean)&&visible(a)!==c)edges.push(side+':'+i);}));
    return {complete:full&&!bad.length&&!edges.length&&p.givens.every((v,i)=>!v||b[i]===v),bad:bad,edges:edges};
  }
  const cache={};
  function perms(n) {if(cache[n])return cache[n];const out=[];function rec(a){if(a.length===n){out.push(a);return;}for(let v=1;v<=n;v++)if(!a.includes(v))rec(a.concat(v));}rec([]);cache[n]=out;return out;}
  function solve(p,values,limit) {limit=limit||2;const b=values||p.givens,all=perms(p.n),rows=[];let nodes=0;const found=[];
    for(let r=0;r<p.n;r++)rows.push(all.filter(a=>(!p.clues.left[r]||visible(a)===p.clues.left[r])&&(!p.clues.right[r]||visible(a.slice().reverse())===p.clues.right[r])&&a.every((v,c)=>(!b[r*p.n+c]||b[r*p.n+c]===v)&&(!p.givens[r*p.n+c]||p.givens[r*p.n+c]===v))));
    const cols=Array.from({length:p.n},(_,c)=>all.filter(a=>(!p.clues.top[c]||visible(a)===p.clues.top[c])&&(!p.clues.bottom[c]||visible(a.slice().reverse())===p.clues.bottom[c])));
    function rec(grid,r,active){nodes++;if(found.length>=limit)return;if(r===p.n){found.push([].concat.apply([],grid));return;}rows[r].forEach(a=>{if(found.length>=limit)return;const next=active.map((items,c)=>items.filter(x=>x[r]===a[c]));if(next.every(x=>x.length))rec(grid.concat([a]),r+1,next);});}rec([],0,cols);return {solutions:found,nodes:nodes};
  }
  function replay(p,actions) {let s=initial(p);if(!Array.isArray(actions)||actions.length>20000)throw Error('history');actions.forEach(a=>{const t=move(p,s,a);if(t===s)throw Error('invalid history');s=t;});return s;}
  function daily(date,count){let h=2166136261;('cloudstep-v1:'+date).split('').forEach(c=>{h=Math.imul(h^c.charCodeAt(0),16777619);});return (h>>>0)%count;}
  return {sides:sides,visible:visible,line:line,clues:clues,initial:initial,move:move,evaluate:evaluate,solve:solve,replay:replay,daily:daily};
})();
