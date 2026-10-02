/* Unruly rule mapping. MIT. Independent implementation, daynight-scroll. */
var LoomEngine = (function () {
  'use strict';
  function lines(n) { var a=[]; for(var r=0;r<n;r++){var row=[],col=[];for(var c=0;c<n;c++){row.push(r*n+c);col.push(c*n+r);}a.push(row,col);}return a; }
  function analyze(cells,n) {
    var bad=[], reasons=[];
    if(!Array.isArray(cells)||cells.length!==n*n||cells.some(function(v){return v!==-1&&v!==0&&v!==1;})) return {valid:false,bad:[],reasons:['无效棋盘'],complete:false};
    lines(n).forEach(function(line,k){var vals=line.map(function(i){return cells[i];}),label=(k%2?'第'+(Math.floor(k/2)+1)+'列':'第'+(Math.floor(k/2)+1)+'行');
      [0,1].forEach(function(v){if(vals.filter(function(x){return x===v;}).length>n/2){bad=bad.concat(line);reasons.push(label+'的'+(v?'昼':'夜')+'超过一半');}});
      for(var j=0;j<n-2;j++)if(vals[j]!==-1&&vals[j]===vals[j+1]&&vals[j]===vals[j+2]){bad=bad.concat(line.slice(j,j+3));reasons.push(label+'出现三连');}
    });
    return {valid:bad.length===0,bad:bad,reasons:reasons,complete:bad.length===0&&cells.indexOf(-1)===-1};
  }
  function fresh(p){return p.givens.slice();}
  function move(p,cells,i,v){if(!Number.isInteger(i)||i<0||i>=p.n*p.n||[-1,0,1].indexOf(v)<0||p.givens[i]!==-1||cells[i]===v)return null;var next=cells.slice();next[i]=v;return next;}
  function replay(p,events){if(!Array.isArray(events)||events.length>10000)return null;var a=fresh(p);for(var k=0;k<events.length;k++){var e=events[k];if(!Array.isArray(e)||e.length!==2)return null;a=move(p,a,e[0],e[1]);if(!a)return null;}return a;}
  function solve(cells,n,limit){var out=[],nodes=0;function visit(a){nodes++;if(out.length>=limit)return;if(!analyze(a,n).valid)return;var best=-1,opts=[];for(var i=0;i<a.length;i++)if(a[i]===-1){var o=[0,1].filter(function(v){var b=a.slice();b[i]=v;return analyze(b,n).valid;});if(!o.length)return;if(best<0||o.length<opts.length){best=i;opts=o;if(o.length===1)break;}}if(best<0){out.push(a);return;}opts.forEach(function(v){if(out.length<limit){var b=a.slice();b[best]=v;visit(b);}});}visit(cells.slice());return {solutions:out,nodes:nodes};}
  function deduction(cells,n){var ls=lines(n);for(var k=0;k<ls.length;k++){var line=ls[k], label=(k%2?'第'+(Math.floor(k/2)+1)+'列':'第'+(Math.floor(k/2)+1)+'行');for(var j=0;j<n-2;j++){var run=line.slice(j,j+3),empty=run.filter(function(i){return cells[i]===-1;}),filled=run.filter(function(i){return cells[i]!==-1;});if(empty.length===1&&cells[filled[0]]===cells[filled[1]])return {i:empty[0],v:1-cells[filled[0]],kind:j+1===line.indexOf(empty[0])?'sandwich':'triple',text:label+'这三格已有两个'+(cells[filled[0]]?'昼':'夜')+'，空格必须相反，避免三连。'};}
      for(var v=0;v<2;v++)if(line.filter(function(i){return cells[i]===v;}).length===n/2){var i=line.find(function(i){return cells[i]===-1;});if(i!==undefined)return {i:i,v:1-v,kind:'balance',text:label+'的'+(v?'昼':'夜')+'已占一半，剩余格只能织入'+(v?'夜':'昼')+'。'};}}
    return null;
  }
  function hint(cells,n){var status=analyze(cells,n);if(!status.valid)return {text:status.reasons[0]+'，请先擦除或撤销冲突。'};if(status.complete)return {text:'织卷已经完成。'};var answers=solve(cells,n,1).solutions;if(!answers.length)return {text:'当前填法无法完成，请撤销最近的尝试。'};var h=deduction(cells,n);if(h)return h;var i=cells.indexOf(-1);return {i:i,v:answers[0][i],kind:'search',text:'这一步需要组合推理。逐一排除无法完成的分支后，第'+(Math.floor(i/n)+1)+'行第'+(i%n+1)+'格应为'+(answers[0][i]?'昼':'夜')+'。'};}
  function daily(date,length){var key='bank-v1:'+date,h=2166136261;for(var i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);return (h>>>0)%length;}
  return {lines:lines,analyze:analyze,fresh:fresh,move:move,replay:replay,solve:solve,deduction:deduction,hint:hint,daily:daily};
}());
