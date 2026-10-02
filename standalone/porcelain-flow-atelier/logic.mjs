export const GAME_ID = 'porcelain-flow-atelier';
export const RULE_VERSION = 'slant-1';
export function edgeEnds(w, i, value) {
  const x=i%w, y=Math.floor(i/w), a=y*(w+1)+x;
  return value==='\\' ? [a,a+w+2] : value==='/' ? [a+1,a+w+1] : [];
}
export function adjacent(w,h,v) {
  const x=v%(w+1), y=Math.floor(v/(w+1)), result=[];
  for(let dy=-1;dy<=0;dy++) for(let dx=-1;dx<=0;dx++) {
    const cx=x+dx,cy=y+dy;
    if(cx>=0&&cx<w&&cy>=0&&cy<h) result.push(cy*w+cx);
  }
  return result;
}
export function validLevel(p) {
  if(!p||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<2||p.width>6||p.height<2||p.height>7||!Array.isArray(p.clues)||p.clues.length!==(p.width+1)*(p.height+1)) return false;
  return p.clues.every((v,i)=>v===null||(Number.isInteger(v)&&v>=0&&v<=adjacent(p.width,p.height,i).length));
}
export function emptyBoard(p) {return Array(p.width*p.height).fill('');}
export function validBoard(p,b) {return validLevel(p)&&Array.isArray(b)&&b.length===p.width*p.height&&b.every(v=>v===''||v==='/'||v==='\\');}
export function setCell(p,b,i,v) {
  if(!validBoard(p,b)||!Number.isInteger(i)||i<0||i>=b.length||!['','/','\\'].includes(v)||b[i]===v) return null;
  const next=b.slice(); next[i]=v; return next;
}
export function connectedPath(p,b,start,end,omit) {
  const graph=Array.from({length:(p.width+1)*(p.height+1)},()=>[]);
  b.forEach((value,i)=>{if(i===omit||!value)return; const pair=edgeEnds(p.width,i,value);graph[pair[0]].push([pair[1],i]);graph[pair[1]].push([pair[0],i]);});
  const q=[start], seen=new Set(q), prev={};
  for(let k=0;k<q.length;k++) {
    const v=q[k]; if(v===end) {const path=[];let t=end;while(t!==start){path.push(prev[t][1]);t=prev[t][0];}return path.reverse();}
    graph[v].forEach(e=>{if(!seen.has(e[0])){seen.add(e[0]);prev[e[0]]=[v,e[1]];q.push(e[0]);}});
  }
  return null;
}
export function inspect(p,b) {
  if(!validBoard(p,b)) throw new Error('Invalid board');
  const size=p.clues.length, counts=Array(size).fill(0), remaining=Array(size).fill(0), parents=Array.from({length:size},(_,i)=>i), loops=new Set();
  const find=v=>{while(parents[v]!==v)v=parents[v];return v;};
  b.forEach((value,i)=>{
    if(!value){const x=i%p.width,y=Math.floor(i/p.width),a=y*(p.width+1)+x;[a,a+1,a+p.width+1,a+p.width+2].forEach(v=>remaining[v]++);return;}
    const pair=edgeEnds(p.width,i,value);counts[pair[0]]++;counts[pair[1]]++;
    const a=find(pair[0]),c=find(pair[1]);if(a===c){const path=connectedPath(p,b,pair[0],pair[1],i)||[];path.concat(i).forEach(j=>loops.add(j));}else parents[a]=c;
  });
  const nodes=p.clues.map((target,i)=>({i,target,count:counts[i],remaining:remaining[i],error:target!==null&&(counts[i]>target||counts[i]+remaining[i]<target),locked:target!==null&&counts[i]===target&&remaining[i]===0}));
  const errors=nodes.filter(n=>n.error), filled=b.filter(Boolean).length;
  return {counts,remaining,nodes,errors,loops:Array.from(loops),filled,complete:filled===b.length&&!errors.length&&!loops.size&&nodes.every(n=>n.target===null||n.count===n.target)};
}
export function rejection(p,b,i,value,numberOnly) {
  const pair=edgeEnds(p.width,i,value), x=i%p.width,y=Math.floor(i/p.width),vs=[y*(p.width+1)+x,y*(p.width+1)+x+1,(y+1)*(p.width+1)+x,(y+1)*(p.width+1)+x+1];
  const report=inspect(p,b);
  for(const v of vs) {
    const target=p.clues[v];if(target===null)continue;
    const count=report.counts[v]+(pair.includes(v)?1:0),rem=report.remaining[v]-1;
    if(count>target||count+rem<target)return {type:'number',vertex:v,target,count:report.counts[v],remaining:report.remaining[v],invalid:value};
  }
  if(!numberOnly){const path=connectedPath(p,b,pair[0],pair[1]);if(path!==null)return {type:'loop',path,endpoints:pair,invalid:value};}
  return null;
}
export function findDeduction(p,b,numberOnly) {
  const report=inspect(p,b);
  if(report.errors.length||report.loops.length)return {type:'conflict',report};
  for(let i=0;i<b.length;i++)if(!b[i]) {
    const back=rejection(p,b,i,'\\',numberOnly), forward=rejection(p,b,i,'/',numberOnly);
    if(back&&forward)return {type:'contradiction',i};
    if(back||forward){const reason=back||forward;return Object.assign({i,value:back?'/':'\\'},reason);}
  }
  return null;
}
export function logicTrace(p,numberOnly) {
  const b=emptyBoard(p), steps=[],depth=Array(b.length).fill(0);
  while(steps.length<b.length){const d=findDeduction(p,b,numberOnly);if(!d||d.type==='conflict'||d.type==='contradiction')break;
    const affected=d.type==='loop'?d.path:adjacent(p.width,p.height,d.vertex);
    d.depth=1+Math.max(0,...affected.map(i=>depth[i]));depth[d.i]=d.depth;b[d.i]=d.value;steps.push(d);
  }
  return {complete:inspect(p,b).complete,steps,board:b,maxDepth:Math.max(0,...depth)};
}
