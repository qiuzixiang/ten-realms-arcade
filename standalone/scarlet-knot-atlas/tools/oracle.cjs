'use strict';
// Separate exact integer algorithm: solve the two segment parameters with
// determinants; for parallel lines project onto a nonzero axis. No imports
// from the runtime geometry. Inputs are integer lattice coordinates.
function vec(a,b) { return [BigInt(b.x)-BigInt(a.x), BigInt(b.y)-BigInt(a.y)]; }
function det(a,b) { return a[0]*b[1]-a[1]*b[0]; }
function within(n,d) { return d>0n ? n>=0n&&n<=d : n<=0n&&n>=d; }
function intersects(a,b,c,d) {
  const r=vec(a,b), s=vec(c,d), q=vec(a,c), den=det(r,s);
  if (den) return within(det(q,s),den)&&within(det(q,r),den);
  if (det(q,r) || det(q,s)) return false;
  const axis=r[0]||s[0]? 'x':'y';
  return Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]))<=Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis])) && (!!(r[0]||r[1]||s[0]||s[1]) || (a.x===c.x&&a.y===c.y));
}
function pairs(points,edges) {
  const byId=Object.fromEntries(points.map(p=>[p.id,p])), out=[];
  for(let i=0;i<edges.length;i++) for(let j=i+1;j<edges.length;j++) {
    if(edges[i].some(id=>edges[j].includes(id))) continue;
    if(intersects(byId[edges[i][0]],byId[edges[i][1]],byId[edges[j][0]],byId[edges[j][1]])) out.push([i,j]);
  }
  return out;
}
module.exports={intersects,pairs};
