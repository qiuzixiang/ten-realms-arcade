/* Rules reimplemented from the MIT cloud-camp reference, 2026.
 * See RULES.md for Simon Tatham Tents attribution and original repository license. */
import { solve } from './solver.mjs';

export function orthogonal(size, index) {
  const r = Math.floor(index / size), c = index % size, values = [];
  if (r > 0) values.push(index-size);
  if (c+1 < size) values.push(index+1);
  if (r+1 < size) values.push(index+size);
  if (c > 0) values.push(index-1);
  return values;
}
export function touching(size, a, b) { return a !== b && Math.abs(Math.floor(a/size)-Math.floor(b/size)) <= 1 && Math.abs(a%size-b%size) <= 1; }
export function validateLevel(level) {
  if (!level || !Number.isInteger(level.size) || level.size < 2 || level.size > 7) return false;
  const n = level.size;
  if (!Array.isArray(level.trees) || !level.trees.length || new Set(level.trees).size !== level.trees.length || Array.from(level.trees).some(function(i) { return !Number.isInteger(i) || i < 0 || i >= n*n; })) return false;
  return [level.rows,level.cols].every(function(line) { return Array.isArray(line) && line.length === n && Array.from(line).every(function(v) { return Number.isInteger(v) && v >= 0 && v <= n; }) && line.reduce(function(a,b) { return a+b; },0) === level.trees.length; });
}
export function createBoard(level) {
  if (!validateLevel(level)) throw new TypeError('Invalid camp definition');
  return Array(level.size*level.size).fill(0);
}
export function validateBoard(level, board) {
  return validateLevel(level) && Array.isArray(board) && board.length === level.size*level.size && Array.from(board).every(function(v,i) { return Number.isInteger(v) && v >= 0 && v <= 2 && (level.trees.indexOf(i) < 0 || v === 0); });
}
export function applyAction(level, board, index, value) {
  if (!validateBoard(level,board)) return { accepted: false, board: board, reason: 'invalid-board' };
  if (!Number.isInteger(index) || index < 0 || index >= board.length || level.trees.indexOf(index) >= 0) return { accepted: false, board: board, reason: 'fixed-or-outside' };
  if (!Number.isInteger(value) || value < 0 || value > 2) return { accepted: false, board: board, reason: 'invalid-value' };
  if (board[index] === value) return { accepted: false, board: board, reason: 'unchanged' };
  const next = board.slice(); next[index] = value;
  return { accepted: true, board: next, reason: null };
}
// Complete bipartite maximum matching with augmenting paths; local adjacency alone is insufficient.
export function maximumMatching(level, tents) {
  const validTents = Array.from(new Set(tents)).filter(function(i) { return Number.isInteger(i) && i >= 0 && i < level.size*level.size && level.trees.indexOf(i) < 0; });
  const owners = new Map();
  function augment(tree, seen) {
    const candidates = orthogonal(level.size,tree).filter(function(i) { return validTents.indexOf(i) >= 0; });
    for (let p = 0; p < candidates.length; p += 1) {
      const tent = candidates[p];
      if (seen.has(tent)) continue;
      seen.add(tent);
      if (!owners.has(tent) || augment(owners.get(tent),seen)) { owners.set(tent,tree); return true; }
    }
    return false;
  }
  let size = 0;
  level.trees.forEach(function(tree) { if (augment(tree,new Set())) size += 1; });
  return { size: size, perfect: size === level.trees.length && validTents.length === level.trees.length, pairs: Array.from(owners.entries()).map(function(pair) { return {tree:pair[1],tent:pair[0]}; }) };
}
export function analyze(level, board) {
  if (!validateBoard(level,board)) return { solved: false, complete: false, contradiction: true, valid: false, errors: ['营地记录无效，请重新开始。'], conflictCells: [], rows: [], cols: [], tentCount: 0, treeCount: level && level.trees ? level.trees.length : 0, matching: {size:0,perfect:false,pairs:[]} };
  const n = level.size, trees = new Set(level.trees), tents = [], errors = [], conflict = new Set();
  board.forEach(function(v,i) { if (v === 1) tents.push(i); });
  const available = board.map(function(v,i) { return v === 0 && !trees.has(i) && orthogonal(n,i).some(function(t) { return trees.has(t); }) && !tents.some(function(t) { return touching(n,i,t); }); });
  let orphan = false, touchingTents = false;
  tents.forEach(function(i) {
    if (!orthogonal(n,i).some(function(t) { return trees.has(t); })) { orphan = true; conflict.add(i); }
    tents.forEach(function(t) { if (touching(n,i,t)) { touchingTents = true; conflict.add(i); conflict.add(t); } });
  });
  if (orphan) errors.push('帐篷需要在一棵树的上下左右。');
  if (touchingTents) errors.push('两顶帐篷不能相邻，斜角也要留空。');
  function line(axis, lineIndex, target) {
    const cells = [];
    for (let v = 0; v < n; v += 1) cells.push(axis === 'row' ? lineIndex*n+v : v*n+lineIndex);
    const count = cells.filter(function(i) { return board[i] === 1; }).length;
    const possible = cells.filter(function(i) { return available[i]; }).length;
    const over = count > target, impossible = over || count+possible < target;
    if (impossible) {
      errors.push('第'+(lineIndex+1)+(axis === 'row' ? '行' : '列')+(over ? '帐篷超过配额。' : '剩余位置不足，请检查帐篷或标空。'));
      cells.forEach(function(i) { if (board[i]) conflict.add(i); });
    }
    return {target:target,count:count,possible:possible,exact:count === target,over:over,impossible:impossible};
  }
  const rows = level.rows.map(function(v,r) { return line('row',r,v); }), cols = level.cols.map(function(v,c) { return line('col',c,v); });
  const matching = maximumMatching(level,tents);
  // Every placed tent must already be injectively assignable to a distinct tree.
  if (matching.size < tents.length) { errors.push('这些帐篷争用了同一组树，无法一一配对。'); tents.forEach(function(i) { conflict.add(i); }); }
  const futureMatching = maximumMatching(level,tents.concat(available.reduce(function(a,v,i) { if(v) a.push(i); return a; },[])));
  if (futureMatching.size < level.trees.length) errors.push('有一组树已没有足够的可用营位，请检查标空与邻接。');
  const solved = !errors.length && rows.every(function(v) { return v.exact; }) && cols.every(function(v) { return v.exact; }) && matching.perfect;
  return {solved:solved,complete:solved,contradiction:errors.length > 0,valid:true,errors:errors,conflictCells:Array.from(conflict),rows:rows,cols:cols,tentCount:tents.length,treeCount:trees.size,matching:matching,available:available};
}
export function isSolved(level,board) { return analyze(level,board).solved; }
function hint(index,value,text,kind) { return {index:index,value:value,text:text,kind:kind}; }
// Fast explainable deductions are also measured when selecting the main route.
export function logicalHint(level,board) {
  const state = analyze(level,board), n = level.size, trees = new Set(level.trees);
  if (!state.valid || state.contradiction || state.solved) return null;
  const candidates = [];
  board.forEach(function(v,i) { if (v === 0 && !trees.has(i)) candidates.push(i); });
  // A remaining row/column quota can force actual tent placements.
  for (let axis = 0; axis < 2; axis += 1) {
    const lines = axis === 0 ? state.rows : state.cols;
    for (let p = 0; p < n; p += 1) {
      const possible = candidates.filter(function(i) { return (axis === 0 ? Math.floor(i/n) : i%n) === p && state.available[i]; });
      const remaining = lines[p].target-lines[p].count;
      if (remaining > 0 && remaining === possible.length) return hint(possible[0],1,'第'+(p+1)+(axis === 0 ? '行' : '列')+'还缺 '+remaining+' 顶帐篷，恰好只剩 '+possible.length+' 个可用位置。','quota-fill');
    }
  }
  for (let p = 0; p < candidates.length; p += 1) {
    const i = candidates[p], r = Math.floor(i/n), c = i%n;
    if (state.rows[r].exact) return hint(i,2,'第'+(r+1)+'行的 '+level.rows[r]+' 顶帐篷已经齐了，其余营位可以标空。','quota-empty');
    if (state.cols[c].exact) return hint(i,2,'第'+(c+1)+'列的 '+level.cols[c]+' 顶帐篷已经齐了，其余营位可以标空。','quota-empty');
  }
  for (let p = 0; p < candidates.length; p += 1) {
    const i = candidates[p];
    if (board.some(function(v,t) { return v === 1 && touching(n,i,t); })) return hint(i,2,'这里与已有帐篷相邻（含斜角），需要留出草地。','separation');
    if (!orthogonal(n,i).some(function(t) { return trees.has(t); })) return hint(i,2,'这里的上下左右没有树，不能搭帐篷。','no-tree');
  }
  for (let p = 0; p < level.trees.length; p += 1) {
    const tree = level.trees[p], neighbors = orthogonal(n,tree);
    if (neighbors.some(function(i) { return board[i] === 1; })) continue;
    const spots = neighbors.filter(function(i) { return state.available[i]; });
    if (spots.length === 1) return hint(spots[0],1,'这棵树只剩一个可用的上下左右营位，需要在这里搭帐篷。','tree-single');
  }
  return null;
}
export function getHint(level,board) {
  if (!validateBoard(level,board) || isSolved(level,board)) return null;
  const current = solve(level,{board:board,limit:2});
  if (!current.count) {
    const base = solve(level,{limit:2});
    if (!base.count) return null;
    // A correction is labelled as such; it is not disguised as a local deduction.
    for (let i = 0; i < board.length; i += 1) {
      if (!board[i]) continue;
      const expected = base.solutions[0].indexOf(i) >= 0 ? 1 : 2;
      if (board[i] !== expected) return hint(i,0,'当前记录已无合法完成方式。先清除这个'+(board[i] === 1 ? '帐篷' : '标空')+'，再结合行列配额与树帐匹配继续。','correction');
    }
    return null;
  }
  const local = logicalHint(level,board);
  if (local) return local;
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] || level.trees.indexOf(i) >= 0) continue;
    const expected = current.solutions[0].indexOf(i) >= 0 ? 1 : 2;
    const trial = board.slice(); trial[i] = expected === 1 ? 2 : 1;
    if (!solve(level,{board:trial,limit:1}).count) return hint(i,expected,'综合行列配额、帐篷间隔和树帐一一匹配：假设这里'+(expected === 1 ? '留空' : '搭帐篷')+'，所有分支都会矛盾，所以这里应'+(expected === 1 ? '搭帐篷。' : '标空。'),'global');
  }
  return null;
}
