export const treeShape = '<ellipse cx="24" cy="43" rx="14" ry="4" fill="rgba(41,76,56,0.125)"/><path d="M22 32h5v13h-5z" fill="#8a6642"/><path d="M24 3 8 27h7L5 38h38L32 27h7z" fill="#315f48"/><path d="M24 3v35h19L32 27h7z" fill="#234c3c"/><path d="m24 7-9 17h9" fill="#789369"/>';
export const tentShape = '<ellipse cx="25" cy="42" rx="22" ry="4" fill="rgba(122,88,53,0.149)"/><path d="m7 38 16-30 13 30z" fill="#efb575"/><path d="m23 8 17 4 11 27-15-1z" fill="#dc8b52"/><path d="m23 18-9 20h19z" fill="#70513b"/><path d="m23 18 1 20h9z" fill="#352f2b"/><path d="M4 40 22 5M36 40 23 5" stroke="#fcdeb0" stroke-width="2"/><path d="m38 17 9 22" stroke="#ad6842" stroke-width="1.5"/>';
export function symbol(kind) {
  return '<svg viewBox="0 0 54 48" aria-hidden="true" focusable="false">'+(kind==='tree'?treeShape:kind==='tent'?tentShape:'<path d="m18 18 16 16m0-16L18 34" stroke="#74886b" stroke-width="3" stroke-linecap="round"/>')+'</svg>';
}
export function boardSvg(level, board, label, selected) {
  const n=level.size, cell=62, edge=48, w=edge+n*cell+18;
  let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+(w+40)+'" role="img" data-level="'+level.id+'" data-board="'+board.join(',')+'"><rect width="100%" height="100%" rx="20" fill="#f4f0df"/><text x="24" y="28" font-family="sans-serif" font-size="15" fill="#355c48">'+label+'</text><g transform="translate(0 34)">';
  for(let i=0;i<n;i++)s+='<text x="'+(edge+i*cell+31)+'" y="30" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#355c48">'+level.cols[i]+'</text><text x="25" y="'+(edge+i*cell+39)+'" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#355c48">'+level.rows[i]+'</text>';
  for(let i=0;i<n*n;i++){
    const x=edge+(i%n)*cell,y=edge+Math.floor(i/n)*cell,tree=level.trees.includes(i),kind=tree?'tree':board[i]===1?'tent':board[i]===2?'grass':'unknown';
    s+='<g data-cell="'+i+'" data-kind="'+kind+'" transform="translate('+x+' '+y+')"><rect x="1" y="1" width="60" height="60" rx="6" fill="'+((Math.floor(i/n)+i%n)%2?'#dce4bf':'#e6eaca')+'" stroke="'+(selected===i?'#d98953':'#b8c39e')+'" stroke-width="'+(selected===i?3:1)+'"/>';
    if(kind!=='unknown')s+='<g transform="translate(5 6)">'+(tree?treeShape:board[i]===1?tentShape:'<path d="m20 18 15 15m0-15L20 33" stroke="#74886b" stroke-width="3" stroke-linecap="round"/>')+'</g>';
    s+='</g>';
  }
  return s+'</g></svg>';
}
