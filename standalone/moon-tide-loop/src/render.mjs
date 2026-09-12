export function cellEdges(level, index) {
  const w=level.width, r=Math.floor(index/w), c=index%w, base=(level.height+1)*w;
  return [r*w+c,base+r*(w+1)+c+1,(r+1)*w+c,base+r*(w+1)+c];
}
export function edgeCoordinates(level,id) {
  const w=level.width, base=(level.height+1)*w;
  if(id<base){const r=Math.floor(id/w),c=id%w;return [c,r,c+1,r];}
  const k=id-base,r=Math.floor(k/(w+1)),c=k%(w+1);return [c,r,c,r+1];
}
export function boardSvg(level,edges,options) {
  const o=options||{},w=level.width*80+32,h=level.height*80+32;
  let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="潮汐数字棋盘" data-level="'+level.id+'" data-state="'+(o.stage||'play')+'">';
  s+='<rect width="'+w+'" height="'+h+'" rx="20" fill="#f0eee2"/>';
  if(Number.isInteger(o.selectedCell)){const i=o.selectedCell;s+='<rect x="'+(18+i%level.width*80)+'" y="'+(18+Math.floor(i/level.width)*80)+'" width="76" height="76" rx="12" fill="#e0ddbf" stroke="#a2773e" stroke-width="1.5" stroke-dasharray="4 3"/>';}
  const count=(level.height+1)*level.width+level.height*(level.width+1);
  for(let i=0;i<count;i++){
    const p=edgeCoordinates(level,i),x1=16+p[0]*80,y1=16+p[1]*80,x2=16+p[2]*80,y2=16+p[3]*80;
    if(o.highlightEdge===i)s+='<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" stroke="#d19b42" stroke-width="12" stroke-linecap="round" opacity=".6" fill="none"/>';
    s+='<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" stroke="#b3c0b9" stroke-width="1.1" stroke-dasharray="2 6" fill="none"/>';
    if(edges[i]===1)s+='<path data-edge="'+i+'" d="M'+x1+' '+y1+' L'+x2+' '+y2+'" stroke="#238878" stroke-width="6" stroke-linecap="round" fill="none"/>';
    if(edges[i]===-1){const x=(x1+x2)/2,y=(y1+y2)/2;s+='<path data-excluded="'+i+'" d="M'+(x-4)+' '+(y-4)+' l8 8 m0 -8 l-8 8" stroke="#a86653" stroke-width="2.2" fill="none"/>';}
  }
  for(let y=0;y<=level.height;y++)for(let x=0;x<=level.width;x++)s+='<circle cx="'+(16+x*80)+'" cy="'+(16+y*80)+'" r="3.5" fill="#486d69"/>';
  for(let i=0;i<level.clues.length;i++){
    const n=level.clues[i];if(n===null||n<0)continue;
    const selected=cellEdges(level,i).filter(e=>edges[e]===1).length,x=56+i%level.width*80,y=56+Math.floor(i/level.width)*80;
    s+='<text data-clue="'+i+'" data-value="'+n+'" x="'+x+'" y="'+(y+10)+'" text-anchor="middle" fill="'+(selected>n?'#a1402f':'#254c4c')+'" font-family="Georgia, serif" font-size="31">'+n+'</text>';
    if(selected===n)s+='<path d="M'+(x-4)+' '+(y+21)+' h8" stroke="#238878" stroke-width="2"/>';
    if(selected>n)s+='<text x="'+(x+19)+'" y="'+(y-8)+'" fill="#a1402f" font-size="15">!</text>';
  }
  return s+'</svg>';
}
export function escapeHtml(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
