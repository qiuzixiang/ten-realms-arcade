(function(root){
'use strict';
var vectors=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
function empty(l){return Array(l.size*l.size).fill(-1);}
function ray(l,a,b){
 if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=l.arrows.length||b>=l.arrows.length||a===b||l.arrows[a]<0)return false;
 var dx=b%l.size-a%l.size,dy=Math.floor(b/l.size)-Math.floor(a/l.size),v=vectors[l.arrows[a]];
 return (dx===0||dy===0||Math.abs(dx)===Math.abs(dy))&&Math.sign(dx)===v[0]&&Math.sign(dy)===v[1];
}
function inspect(l,next){
 var n=l.size*l.size,prev=Array(n).fill(-1),numbers=Array(n).fill(0),seen=Array(n).fill(false),chains=[],edges=0;
 if(!Array.isArray(next)||next.length!==n)return {valid:false,reason:'邮路数据损坏'};
 for(var i=0;i<n;i++){
  var t=next[i];if(!Number.isInteger(t)||t < -1||t>=n)return {valid:false,reason:'站点无效'};
  if(t!==-1){if(!ray(l,i,t)||prev[t]!==-1||l.givens[t]===1||l.givens[i]===n)return {valid:false,reason:'沿箭头方向连接，每站只接一进一出'};prev[t]=i;edges++;}
 }
 for(var h=0;h<n;h++)if(prev[h]===-1){
  var chain=[],c=h,offset=null;
  while(c!==-1){if(seen[c])return {valid:false,reason:'不能形成小环'};seen[c]=true;chain.push(c);c=next[c];}
  for(var k=0;k<chain.length;k++)if(l.givens[chain[k]]){var o=l.givens[chain[k]]-k;if(offset!==null&&offset!==o)return {valid:false,reason:'这条连接与固定号码冲突'};offset=o;}
  if(offset!==null){if(offset<1||offset+chain.length-1>n)return {valid:false,reason:'序号超出邮路范围'};for(var j=0;j<chain.length;j++)numbers[chain[j]]=offset+j;}
  chains.push(chain);
 }
 if(seen.some(function(x){return !x;}))return {valid:false,reason:'不能形成小环'};
 return {valid:true,prev:prev,numbers:numbers,chains:chains,edges:edges,won:chains.length===1&&edges===n-1&&l.givens[chains[0][0]]===1&&l.givens[chains[0][n-1]]===n};
}
function apply(l,next,action){
 if(!inspect(l,next).valid||!action||!Number.isInteger(action.a)||action.a<0||action.a>=next.length)return {next:next,changed:false,reason:'请先选择站点'};
 var a=action.a,b=action.b,copy=next.slice();
 if(action.type==='link'){
  if(!ray(l,a,b))return {next:next,changed:false,reason:'落点须在箭头射线上，可以跨格'};
  copy[a]=-1;for(var i=0;i<copy.length;i++)if(copy[i]===b)copy[i]=-1;copy[a]=b;
 }else if(action.type==='cut'){copy[a]=-1;for(var j=0;j<copy.length;j++)if(copy[j]===a)copy[j]=-1;
 }else return {next:next,changed:false,reason:'未知操作'};
 var result=inspect(l,copy);if(!result.valid)return {next:next,changed:false,reason:result.reason};
 var changed=copy.some(function(x,k){return x!==next[k];});return {next:changed?copy:next,changed:changed,reason:changed?'邮路已更新':'邮路没有变化'};
}
function replay(l,log){if(!Array.isArray(log)||log.length>5000)return null;var state=empty(l);for(var i=0;i<log.length;i++){var r=apply(l,state,log[i]);if(!r.changed)return null;state=r.next;}return state;}
root.SandEngine={empty:empty,ray:ray,inspect:inspect,apply:apply,replay:replay,vectors:vectors};
})(typeof window==='undefined'?globalThis:window);
