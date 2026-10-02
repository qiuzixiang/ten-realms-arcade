(function(root) {
'use strict';
const goal = Array.from({length:16}, (_, i) => i + 1);
const validBoard = b => Array.isArray(b) && b.length === 16 && new Set(b).size === 16 && b.every(v => Number.isInteger(v) && v >= 1 && v <= 16);
const validAction = a => a && (a.axis === 'row' || a.axis === 'column') && Number.isInteger(a.index) && a.index >= 0 && a.index < 4 && (a.direction === -1 || a.direction === 1);
function shift(board, action) {
  if (!validBoard(board) || !validAction(action)) return board;
  const b = board.slice();
  for (let k=0;k<4;k++) {
    const p = action.axis === 'row' ? action.index*4+k : k*4+action.index;
    const j = (k+action.direction+4)%4;
    const q = action.axis === 'row' ? action.index*4+j : j*4+action.index;
    b[q] = board[p];
  }
  return b;
}
const inverse = a => ({axis:a.axis,index:a.index,direction:-a.direction});
const replay = (board, actions) => actions.reduce(shift, board.slice());
const solved = b => validBoard(b) && b.every((v,i) => v === i+1);
const same = (a,b) => a.join(',') === b.join(',');
function checksum(board) { let h=2166136261; board.forEach(v => { h ^= v; h = Math.imul(h,16777619); }); return (h>>>0).toString(16); }
function simplify(actions) {
 const out=[];
 actions.forEach(a => {
  if(!validAction(a)) throw Error('Invalid action');
  const last=out[out.length-1];
  if(last && last.axis===a.axis && last.index===a.index && last.direction===-a.direction) out.pop();
  else { out.push(a); if(out.length>=3) { const tail=out.slice(-3); if(tail.every(t=>t.axis===a.axis && t.index===a.index && t.direction===a.direction)) {out.splice(out.length-3,3,inverse(a));} } }
 });
 return out;
}
// A guaranteed legal route from this run, with immediate reversals and loops removed.
function route(level, actions) {
 let plan=simplify(actions.slice().reverse().map(inverse).concat(level.solution));
 let board=replay(level.initial,actions), seen=new Map([[board.join(','),0]]), path=[];
 plan.forEach(a=> { const next=shift(board,a), key=next.join(','); if(seen.has(key)) { path=path.slice(0,seen.get(key)); seen=new Map(); let b=replay(level.initial,actions); seen.set(b.join(','),0); path.forEach((m,i)=> {b=shift(b,m);seen.set(b.join(','),i+1);}); } else {path.push(a);seen.set(key,path.length);} board=next; });
 if(!solved(replay(replay(level.initial,actions),path))) throw Error('Invalid hint route');
 return path;
}
const tutorialActions=[{axis:'column',index:1,direction:-1},{axis:'row',index:2,direction:1}];
const tutorialInitial=replay(goal,tutorialActions.slice().reverse().map(inverse));
const tutorial=[tutorialInitial,shift(tutorialInitial,tutorialActions[0]),goal.slice()];
const api={goal,validBoard,validAction,shift,inverse,replay,solved,same,checksum,simplify,route,tutorial,tutorialActions};
root.SilkEngine=api;
if(typeof module!=='undefined') module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
