// Independent representation: each numbered tile owns a coordinate, not an array slot.
function oracle(board,actions) {
 const positions=new Map(board.map((v,p)=>[v,[Math.floor(p/4),p%4]]));
 for(const a of actions) for(const xy of positions.values()) {
  if(a.axis==='row' && xy[0]===a.index) xy[1]=((xy[1]+a.direction)%4+4)%4;
  if(a.axis==='column' && xy[1]===a.index) xy[0]=((xy[0]+a.direction)%4+4)%4;
 }
 const b=Array(16);for(const [v,[r,c]] of positions)b[r*4+c]=v;return b;
}
// Conjugate both positions and tile identities so the goal is preserved.
// Include torus translations; a shifted or mirrored puzzle cannot fill the campaign twice.
function canonical(board) {
 const keys=[];
 for(let mirror=0;mirror<2;mirror++) for(let turn=0;turn<4;turn++) for(let dr=0;dr<4;dr++)for(let dc=0;dc<4;dc++) {
  const transform=p=> {let r=Math.floor(p/4),c=p%4;if(mirror)c=3-c;for(let t=0;t<turn;t++)[r,c]=[c,3-r];return ((r+dr)%4)*4+(c+dc)%4;};
  const out=Array(16);board.forEach((v,p)=>out[transform(p)]=transform(v-1)+1);keys.push(out.map(v=>v.toString(16)).join(''));
 }
 return keys.sort()[0];
}
module.exports={oracle,canonical};
