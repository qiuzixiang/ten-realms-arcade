// Rect / Shikaku rule implementation. See RULES.md and THIRD_PARTY_NOTICES.md.
export function rect(a,b) { return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x)+1,h:Math.abs(a.y-b.y)+1}; }
export function inside(r,c) { return c.x>=r.x&&c.y>=r.y&&c.x<r.x+r.w&&c.y<r.y+r.h; }
export function overlap(a,b) { return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h; }
export function equal(a,b) { return ['x','y','w','h'].every(k=>a[k]===b[k]); }
export function reason(p,rooms,r) {
  if(!r||!['x','y','w','h'].every(k=>Number.isInteger(r[k]))||r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>p.n||r.y+r.h>p.n) return '房间要留在楼层里';
  const clues=p.clues.filter(c=>inside(r,c));
  if(clues.length!==1) return '每间房必须恰好包含一个数字';
  if(r.w*r.h!==clues[0].v) return '房间面积需要等于数字 '+clues[0].v;
  if(rooms.some(a=>overlap(a,r))) return '与已有房间重叠，请先清除原房间';
  return '';
}
export function place(p,rooms,r) { return reason(p,rooms,r)?rooms:rooms.concat([{x:r.x,y:r.y,w:r.w,h:r.h}]); }
export function solved(p,rooms) { const accepted=[]; for(const r of rooms){ if(reason(p,accepted,r))return false; accepted.push(r); } return accepted.reduce((s,r)=>s+r.w*r.h,0)===p.n*p.n; }
export function candidates(p,c,rooms) {
 const out=[]; for(let w=1;w<=p.n;w++){if(c.v%w)continue;const h=c.v/w;if(h>p.n)continue;
 for(let y=Math.max(0,c.y-h+1);y<=Math.min(c.y,p.n-h);y++)for(let x=Math.max(0,c.x-w+1);x<=Math.min(c.x,p.n-w);x++){const r={x,y,w,h};if(!reason(p,rooms,r))out.push(r);}}
 return out;
}
export function hint(p,rooms) {
 if(rooms.some(r=>!p.answer.some(a=>equal(a,r)))) return {text:'已有房间虽然面积正确，却挡住了整层的唯一布局。请撤销或清除后再试。'};
 const pending=p.clues.filter(c=>!rooms.some(r=>inside(r,c)));
 for(const c of pending){const opts=candidates(p,c,rooms);if(opts.length===1)return {r:opts[0],text:'第 '+(c.y+1)+' 行、第 '+(c.x+1)+' 列的 '+c.v+'：排除越界、其它数字和已住房间，只剩这一种矩形。'};}
 if(!pending.length)return {text:'整层已经安排好了。'};
 const r=p.answer.find(a=>!rooms.some(b=>equal(a,b)));
 return {r,text:'这一步需要综合排除。经过整层唯一解核验，这间房应为 '+r.w+' × '+r.h+'。这是答案辅助；确认后才会落房。'};
}
export function replay(p,actions) {
 if(!Array.isArray(actions)||actions.length>4000)return null;
 let rooms=[],history=[],helped=false;
 for(const a of actions){if(!a||typeof a!=='object')return null;
 if(a.type==='place'){const next=place(p,rooms,a.r);if(next===rooms)return null;history.push(rooms);rooms=next;}
 else if(a.type==='remove'){if(!a.r||!rooms.some(r=>equal(r,a.r)))return null;history.push(rooms);rooms=rooms.filter(r=>!equal(r,a.r));}
 else if(a.type==='undo'){if(!history.length)return null;rooms=history.pop();}
 else if(a.type==='hint')helped=true;
 else return null;
 }
 return {rooms,history,helped};
}
