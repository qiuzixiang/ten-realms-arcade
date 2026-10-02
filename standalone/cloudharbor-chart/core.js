/* Cloudharbor Chart — MIT, ES2017 classic namespace */
var Harbor = (function () {
  'use strict';
  function graph(p) {
    var edges=[];
    p.ports.forEach(function(a,i){ ['x','y'].forEach(function(axis){var other=axis==='x'?'y':'x';var best=-1; p.ports.forEach(function(b,j){if(b[other]===a[other]&&b[axis]>a[axis]&&(best<0||b[axis]<p.ports[best][axis]))best=j;});if(best>=0)edges.push([i,best]);});});
    return edges;
  }
  function cross(p,a,b) {
    var u=p.ports[a[0]],v=p.ports[a[1]],s=p.ports[b[0]],t=p.ports[b[1]];
    if(u.y===v.y&&s.x===t.x)return Math.min(u.x,v.x)<s.x&&s.x<Math.max(u.x,v.x)&&Math.min(s.y,t.y)<u.y&&u.y<Math.max(s.y,t.y);
    if(u.x===v.x&&s.y===t.y)return cross(p,b,a);return false;
  }
  function inspect(p,state) {
    var es=graph(p),degree=p.ports.map(function(){return 0;}),adj=p.ports.map(function(){return [];});var conflict=false;
    es.forEach(function(e,k){var n=state.lines[k]||0;degree[e[0]]+=n;degree[e[1]]+=n;if(n){adj[e[0]].push(e[1]);adj[e[1]].push(e[0]);es.forEach(function(f,j){if(j<k&&state.lines[j]&&cross(p,e,f))conflict=true;});}});
    var seen={},groups=[];p.ports.forEach(function(_,i){if(seen[i])return;var q=[i];seen[i]=true;for(var k=0;k<q.length;k++)adj[q[k]].forEach(function(j){if(!seen[j]){seen[j]=true;q.push(j);}});groups.push(q);});
    var exact=degree.filter(function(d,i){return d===p.ports[i].n;}).length;
    return {degree:degree,groups:groups,exact:exact,conflict:conflict,complete:p.ports.length>=2&&!conflict&&exact===p.ports.length&&groups.length===1};
  }
  function empty(p){return {lines:graph(p).map(function(){return 0;}),marks:[],checked:[]};}
  function clone(s){return JSON.parse(JSON.stringify(s));}
  function valid(p,s){var es=graph(p);if(!s||!Array.isArray(s.lines)||s.lines.length!==es.length||s.lines.some(function(n){return !Number.isInteger(n)||n<0||n>2;})||!Array.isArray(s.marks)||!Array.isArray(s.checked))return false;
    if(new Set(s.marks).size!==s.marks.length||new Set(s.checked).size!==s.checked.length)return false;
    if(s.marks.some(function(k){return !Number.isInteger(k)||!es[k]||s.lines[k];})||s.checked.some(function(i){return !Number.isInteger(i)||!p.ports[i];}))return false;
    var ev=inspect(p,s);return !ev.conflict&&s.checked.every(function(i){return ev.degree[i]===p.ports[i].n;});}
  function move(p,s,k,n){var es=graph(p);if(!es[k]||!Number.isInteger(n)||n<0||n>2)return {ok:false,reason:'只能连接四向最近港'};if(s.lines[k]===n)return {ok:false,reason:'航道没有变化'};
    if(n&&es.some(function(e,j){return j!==k&&s.lines[j]&&cross(p,es[k],e);}))return {ok:false,reason:'航道不能交叉，请先清除阻挡航线'};
    var next=clone(s);next.lines[k]=n;next.marks=next.marks.filter(function(j){return j!==k;});next.checked=next.checked.filter(function(i){return es[k].indexOf(i)<0;});return {ok:true,state:next};}
  function note(p,s,k){if(!graph(p)[k]||s.lines[k])return {ok:false,reason:'先清除真实航道，再记禁行'};var next=clone(s),i=next.marks.indexOf(k);if(i<0)next.marks.push(k);else next.marks.splice(i,1);return {ok:true,state:next};}
  function check(p,s,i){if(!p.ports[i]||inspect(p,s).degree[i]!==p.ports[i].n)return {ok:false,reason:'只有运力恰好满足的港口才能勾选'};var next=clone(s),j=next.checked.indexOf(i);if(j<0)next.checked.push(i);else next.checked.splice(j,1);return {ok:true,state:next};}
  return {graph:graph,cross:cross,inspect:inspect,empty:empty,clone:clone,valid:valid,move:move,note:note,check:check};
}());
if(typeof module!=='undefined')module.exports=Harbor;
