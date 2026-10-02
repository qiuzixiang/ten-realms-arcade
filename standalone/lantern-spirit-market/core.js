/* MIT · Lantern Spirit Market · pure Same Game engine, ES2017 */
(function(root){
'use strict';
function copy(b){return b.map(r=>r.slice());}
function group(b,r,c){if(!b[r]||b[r][c]==null)return [];const color=b[r][c],q=[[r,c]],seen={};seen[r+','+c]=true;for(let i=0;i<q.length;i++){const p=q[i];[[-1,0],[1,0],[0,-1],[0,1]].forEach(d=>{const y=p[0]+d[0],x=p[1]+d[1],k=y+','+x;if(b[y]&&b[y][x]===color&&!seen[k]){seen[k]=true;q.push([y,x]);}});}return q.sort((a,z)=>a[0]-z[0]||a[1]-z[1]);}
function groups(b){const seen={},out=[];b.forEach((row,r)=>row.forEach((v,c)=>{const k=r+','+c;if(v==null||seen[k])return;const g=group(b,r,c);g.forEach(p=>seen[p.join(',')]=true);if(g.length>1)out.push(g);}));return out;}
function stages(b,g){const removed=copy(b);g.forEach(p=>removed[p[0]][p[1]]=null);const fall=copy(removed),h=b.length,w=b[0].length;for(let x=0;x<w;x++){const a=removed.map(r=>r[x]).filter(v=>v!=null);for(let y=0;y<h;y++)fall[y][x]=y<h-a.length?null:a[y-h+a.length];}const cols=[];for(let x=0;x<w;x++)if(fall.some(r=>r[x]!=null))cols.push(x);const final=fall.map(r=>Array.from({length:w},(_,x)=>x<cols.length?r[cols[x]]:null));return {removed:removed,fall:fall,board:final};}
function count(b){return b.reduce((n,r)=>n+r.filter(v=>v!=null).length,0);}
function status(b){return count(b)===0?'cleared':groups(b).length?'playing':'stuck';}
function initial(level){return {board:copy(level.board),score:0,moves:0,removed:0,status:status(level.board)};}
function preview(s,r,c){const g=group(s.board,r,c);return s.status==='playing'&&g.length>=2?{group:g,delta:Math.pow(g.length-2,2),stages:stages(s.board,g)}:null;}
function move(s,r,c){const p=preview(s,r,c);if(!p)return null;return {board:p.stages.board,score:s.score+p.delta,moves:s.moves+1,removed:s.removed+p.group.length,status:status(p.stages.board)};}
function replay(level,path){let s=initial(level);if(!Array.isArray(path)||path.length>100)return null;for(const p of path){if(!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger))return null;s=move(s,p[0],p[1]);if(!s)return null;}return s;}
function solve(b,limit){let nodes=0,cut=false;const dead=new Set();function dfs(a){if(count(a)===0)return [];if(++nodes>limit){cut=true;return null;}const key=JSON.stringify(a);if(dead.has(key))return null;const totals={};a.forEach(r=>r.forEach(v=>{if(v!=null)totals[v]=(totals[v]||0)+1;}));if(Object.values(totals).some(n=>n===1))return null;const gs=groups(a).sort((x,y)=>y.length-x.length);for(const g of gs){const rest=dfs(stages(a,g).board);if(rest)return [g[0]].concat(rest);if(cut)return null;}dead.add(key);return null;}const path=dfs(b);return {path:path,nodes:nodes,exhaustive:!cut};}
root.LanternCore={copy:copy,group:group,groups:groups,stages:stages,count:count,status:status,initial:initial,preview:preview,move:move,replay:replay,solve:solve};
})(typeof window==='undefined'?globalThis:window);
