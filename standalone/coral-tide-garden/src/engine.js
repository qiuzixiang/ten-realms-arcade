(function(root){
'use strict';
function neighbours(n,i){var a=[];if(i>=n)a.push(i-n);if(i%n<n-1)a.push(i+1);if(i<n*(n-1))a.push(i+n);if(i%n)a.push(i-1);return a;}
function initial(l){return {values:l.givens.slice(),notes:Array(l.n*l.n).fill(0),moves:0};}
function evaluate(l,s){var a=s.values,seen={},groups=[],errors=[];if(!Array.isArray(a)||a.length!==l.n*l.n)return {complete:false,groups:[],errors:['数据损坏'],remaining:l.n*l.n};
for(var i=0;i<a.length;i++){if(!Number.isInteger(a[i])||a[i]<0||a[i]>9||(l.givens[i]&&a[i]!==l.givens[i]))errors.push(i);if(!a[i]||seen[i])continue;var cells=[i];seen[i]=true;for(var k=0;k<cells.length;k++)neighbours(l.n,cells[k]).forEach(function(j){if(!seen[j]&&a[j]===a[i]){seen[j]=true;cells.push(j);}});groups.push({value:a[i],cells:cells,exact:cells.length===a[i],overflow:cells.length>a[i]});}
var remaining=a.filter(function(x){return x===0;}).length;return {complete:remaining===0&&!errors.length&&groups.every(function(g){return g.exact;}),groups:groups,errors:errors,remaining:remaining};}
function apply(l,s,action){if(!action||!Number.isInteger(action.cell)||action.cell<0||action.cell>=s.values.length||l.givens[action.cell]||!Number.isInteger(action.value))return s;var i=action.cell,v=action.value,values=s.values.slice(),notes=s.notes.slice(),moves=s.moves;
if(action.type==='fill'){if(v<0||v>9||values[i]===v)return s;values[i]=v;notes[i]=0;moves++;}else if(action.type==='note'){if(v<1||v>9||values[i])return s;notes[i]^=1<<(v-1);}else return s;return {values:values,notes:notes,moves:moves};}
function replay(l,actions){if(!Array.isArray(actions)||actions.length>8192)return null;var s=initial(l);for(var i=0;i<actions.length;i++){var next=apply(l,s,actions[i]);if(next===s)return null;s=next;}return s;}
root.CoralEngine={neighbours:neighbours,initial:initial,evaluate:evaluate,apply:apply,replay:replay};
})(typeof globalThis!=='undefined'?globalThis:window);
