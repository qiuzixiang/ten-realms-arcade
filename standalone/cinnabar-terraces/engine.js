(function (root) {
  'use strict';
  function integer(x, a, b) { return Number.isInteger(x) && x >= a && x <= b; }
  function validLevel(l) {
    if (!l || !integer(l.n, 4, 6) || !Array.isArray(l.relations)) return false;
    var seen = {};
    return l.relations.every(function (e) {
      var valid = integer(e.a, 0, l.n*l.n-1) && integer(e.b, 0, l.n*l.n-1) &&
        (e.b === e.a+1 && Math.floor(e.a/l.n) === Math.floor(e.b/l.n) || e.b === e.a+l.n) && (e.sign === '<' || e.sign === '>') && !seen[e.a+':'+e.b];
      seen[e.a+':'+e.b] = true; return valid;
    });
  }
  function blank(n) { return { values: Array(n*n).fill(0), notes: Array.from({length:n*n}, function () { return []; }), history: [] }; }
  function snapshot(s) { return { values:s.values.slice(), notes:s.notes.map(function(a){return a.slice();}) }; }
  function validSnap(s,n) { return !!s && Array.isArray(s.values) && s.values.length===n*n && s.values.every(function(v){return integer(v,0,n);}) && Array.isArray(s.notes) && s.notes.length===n*n && s.notes.every(function(a){return Array.isArray(a) && a.length<=n && a.every(function(v,i){return integer(v,1,n) && a.indexOf(v)===i;});}); }
  function normalize(s,n) {
    if (!validSnap(s,n) || !Array.isArray(s.history) || s.history.length>160 || !s.history.every(function(p){return validSnap(p,n);})) return null;
    return {values:s.values.slice(), notes:s.notes.map(function(a){return a.slice();}), history:s.history.map(snapshot)};
  }
  function apply(s,n,cell,value,mode) {
    if (!integer(cell,0,n*n-1) || !integer(value,0,n) || (mode!=='fill' && mode!=='note')) return s;
    var next=snapshot(s);
    if (mode==='note' && value>0) {
      if(s.values[cell]) return s;
      var i=next.notes[cell].indexOf(value); if(i<0)next.notes[cell].push(value);else next.notes[cell].splice(i,1);
      next.notes[cell].sort(function(a,b){return a-b;});
    } else { if(next.values[cell]===value && !next.notes[cell].length)return s; next.values[cell]=value;next.notes[cell]=[]; }
    next.history=s.history.concat([snapshot(s)]).slice(-160);return next;
  }
  function undo(s) { if(!s.history.length)return s;var p=snapshot(s.history[s.history.length-1]);p.history=s.history.slice(0,-1);return p; }
  function units(n) { var out=[];for(var r=0;r<n;r++){var row=[],col=[];for(var c=0;c<n;c++){row.push(r*n+c);col.push(c*n+r);}out.push({name:'第'+(r+1)+'行',cells:row});out.push({name:'第'+(r+1)+'列',cells:col});}return out; }
  function evaluate(l,values) {
    if(!validLevel(l) || !Array.isArray(values) || values.length!==l.n*l.n || !values.every(function(v){return integer(v,0,l.n);}))return {complete:false,errors:[{type:'schema',cells:[]}],filled:0};
    var errors=[];
    units(l.n).forEach(function(u){for(var v=1;v<=l.n;v++){var cells=u.cells.filter(function(c){return values[c]===v;});if(cells.length>1)errors.push({type:'duplicate',cells:cells,text:u.name+'出现重复数字 '+v+'（下划线）'});}});
    l.relations.forEach(function(e){if(values[e.a] && values[e.b] && !(e.sign==='<'?values[e.a]<values[e.b]:values[e.a]>values[e.b]))errors.push({type:'relation',cells:[e.a,e.b],edge:e.a+':'+e.b,text:position(e.a,l.n)+' 应'+(e.sign==='<'?'小于':'大于')+' '+position(e.b,l.n)+'（!）'});});
    var filled=values.filter(Boolean).length;return {complete:filled===l.n*l.n && errors.length===0,errors:errors,filled:filled};
  }
  function position(c,n){return (Math.floor(c/n)+1)+'行'+(c%n+1)+'列';}
  function glyph(e,n){return e.b===e.a+n?(e.sign==='<'?'∧':'∨'):e.sign;}
  function candidates(l,values,cell){var out=[];for(var v=1;v<=l.n;v++){var t=values.slice();t[cell]=v;if(!evaluate(l,t).errors.some(function(e){return e.cells.indexOf(cell)>=0;}))out.push(v);}return out;}
  // Monotone domain propagation. Each deletion records its actual premise; no solution lookup or guessing.
  function deduce(l,values) {
    var n=l.n, ds=values.map(function(v){return v?[v]:Array.from({length:n},function(_,i){return i+1;});}), trace=[], rounds=0, changed=true, us=units(n),infeasible=false;
    function restrict(cell,keep,reason,premises,type) {
      var before=ds[cell],after=before.filter(keep);
      if(after.length===before.length)return;
      ds[cell]=after;changed=true;trace.push({cell:cell,before:before.slice(),after:after.slice(),reason:reason,premises:premises,type:type,round:rounds});
    }
    while(changed && rounds<100){changed=false;rounds++;
      l.relations.forEach(function(e){var a=e.sign==='<'?e.a:e.b,b=e.sign==='<'?e.b:e.a;
        restrict(a,function(v){return ds[b].some(function(w){return v<w;});},position(a,n)+'小于'+position(b,n)+'；后者候选为 '+ds[b].join('、'),[a,b],'relation');
        restrict(b,function(w){return ds[a].some(function(v){return v<w;});},position(b,n)+'大于'+position(a,n)+'；前者候选为 '+ds[a].join('、'),[a,b],'relation');
      });
      us.forEach(function(u){
        u.cells.forEach(function(c){if(ds[c].length===1){var v=ds[c][0];u.cells.forEach(function(d){if(d!==c)restrict(d,function(w){return w!==v;},u.name+'中'+position(c,n)+'只能为 '+v+'，同行/列不能重复',[c,d],'single');});}});
        for(var v=1;v<=n;v++){var locations=u.cells.filter(function(c){return ds[c].indexOf(v)>=0;});if(!locations.length)infeasible=true;if(locations.length===1){var c=locations[0];restrict(c,function(w){return w===v;},u.name+'中只有'+position(c,n)+'还可放 '+v,u.cells.slice(),'hidden');}}
      });
      if(infeasible||ds.some(function(d){return !d.length;}))break;
    }
    return {domains:ds,trace:trace,rounds:rounds,solved:ds.every(function(d){return d.length===1;}) && evaluate(l,ds.map(function(d){return d[0]||0;})).complete,contradiction:infeasible||ds.some(function(d){return !d.length;})};
  }
  function nextHint(l,values){
    var errors=evaluate(l,values).errors;if(errors.length)return {error:errors[0].text,cells:errors[0].cells};
    var proof=deduce(l,values);if(proof.contradiction)return {error:'当前数字让候选为空，请撤销或擦除近期填写。',cells:[]};
    var step=proof.trace.find(function(s){return !values[s.cell] && s.after.length===1;});
    if(!step)return {error:'暂未找到可证明的一步。可先标候选，检查已填数字或重开。',cells:[]};
    var premises=proof.trace.filter(function(s){return s.round<=step.round;});
    return {cell:step.cell,value:step.after[0],cells:step.premises,reason:step.reason,trace:premises,domains:proof.domains};
  }
  function checksum(l){var text=l.n+'|'+l.relations.map(function(e){return e.a+','+e.b+e.sign;}).join(';'),h=2166136261;for(var i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);}
  var api={integer:integer,validLevel:validLevel,blank:blank,snapshot:snapshot,normalize:normalize,apply:apply,undo:undo,units:units,evaluate:evaluate,position:position,glyph:glyph,candidates:candidates,deduce:deduce,nextHint:nextHint,checksum:checksum};
  root.TerraceEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:global);
