import { solve } from './solver.mjs';
import { createBoard, logicalHint, getHint, isSolved, orthogonal, touching } from './engine.mjs';
import { REPLAY_LEVELS } from './levels.mjs';

export function hashSeed(input) {
  const text = String(input), prime = 16777619;
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i),prime);
  return h >>> 0;
}
export function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return function() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(values,random) {
  const list = values.slice();
  for (let i = list.length-1; i > 0; i -= 1) { const p = Math.floor(random()*(i+1)); const old = list[i]; list[i]=list[p]; list[p]=old; }
  return list;
}
// Canonical signature includes all 8 square symmetries, so rotations/reflections are not extra levels.
export function puzzleSignature(level) {
  const n = level.size, variants = [];
  for (let mirror = 0; mirror < 2; mirror += 1) for (let rotation = 0; rotation < 4; rotation += 1) {
    const trees = [], rows = Array(n).fill(0), cols = Array(n).fill(0);
    function transform(index) {
      let r = Math.floor(index/n), c = index%n;
      if (mirror) c = n-1-c;
      for (let k = 0; k < rotation; k += 1) { const previous = r; r=c; c=n-1-previous; }
      return r*n+c;
    }
    level.trees.forEach(function(i) { trees.push(transform(i)); });
    // Clues are transformed via artificial row/column tokens, not via the stored solution.
    for (let r = 0; r < n; r += 1) {
      const a = transform(r*n), b = transform(r*n+n-1);
      if (Math.floor(a/n) === Math.floor(b/n)) rows[Math.floor(a/n)] = level.rows[r]; else cols[a%n] = level.rows[r];
    }
    for (let c = 0; c < n; c += 1) {
      const a = transform(c), b = transform((n-1)*n+c);
      if (a%n === b%n) cols[a%n] = level.cols[c]; else rows[Math.floor(a/n)] = level.cols[c];
    }
    variants.push(n+'|'+trees.sort(function(a,b) { return a-b; }).join(',')+'|'+rows.join(',')+'|'+cols.join(','));
  }
  return variants.sort()[0];
}
export function generateUnique(configuration) {
  const n = configuration.size, tentCount = configuration.tentCount, seed = Number(configuration.seed) >>> 0;
  if (!Number.isInteger(n) || n < 4 || n > 7 || !Number.isInteger(tentCount) || tentCount < 1 || tentCount > Math.ceil(n/2)*Math.ceil(n/2)) throw new TypeError('Invalid generation parameters');
  const random = seededRandom(seed), cells = Array.from({length:n*n},function(_,i) { return i; });
  const attempts = configuration.attempts || 10000;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tents = [];
    const order = shuffled(cells,random);
    for (let p = 0; p < order.length && tents.length < tentCount; p += 1) if (tents.every(function(t) { return !touching(n,t,order[p]); })) tents.push(order[p]);
    if (tents.length !== tentCount) continue;
    const choices = shuffled(tents,random).map(function(t) { return shuffled(orthogonal(n,t).filter(function(i) { return tents.indexOf(i) < 0; }),random); }).sort(function(a,b) { return a.length-b.length; });
    const used = new Set();
    function assign(k) {
      if (k === choices.length) return true;
      for (let p = 0; p < choices[k].length; p += 1) {
        const i = choices[k][p]; if (used.has(i)) continue;
        used.add(i); if (assign(k+1)) return true; used.delete(i);
      }
      return false;
    }
    if (!assign(0)) continue;
    const rows = Array(n).fill(0), cols = Array(n).fill(0);
    tents.forEach(function(t) { rows[Math.floor(t/n)] += 1; cols[t%n] += 1; });
    const level = {size:n,trees:Array.from(used).sort(function(a,b) { return a-b; }),rows:rows,cols:cols,seed:seed};
    const proof = solve(level,{limit:2});
    if (!proof.unique) continue;
    level.solution = proof.solutions[0];
    level.signature = puzzleSignature(level);
    level.generationAttempt = attempt;
    return {level:level,proof:proof};
  }
  throw new Error('No unique '+n+'×'+n+' camp found for seed '+seed);
}
// Independent restricted strategy for the depth audit. It deliberately grants the
// quota player tree-adjacency and already-placed-tent exclusions for free, then
// permits ONLY filling every remaining quota slot and crossing out filled lines.
// Thus failure here is stronger evidence than merely counting named hint kinds.
export function quotaOnlyAudit(level) {
  const n = level.size, board = Array(n*n).fill(0), trees = new Set(level.trees), events = [];
  function candidates() {
    const result = [];
    for (let i = 0; i < board.length; i += 1) {
      if (board[i] !== 0 || trees.has(i)) continue;
      const r = Math.floor(i/n), c = i%n;
      const adjacent = (r > 0 && trees.has(i-n)) || (r+1 < n && trees.has(i+n)) || (c > 0 && trees.has(i-1)) || (c+1 < n && trees.has(i+1));
      if (!adjacent) continue;
      let clear = true;
      for (let t = 0; t < board.length; t += 1) if (board[t] === 1 && Math.abs(Math.floor(t/n)-r) <= 1 && Math.abs(t%n-c) <= 1) clear = false;
      if (clear) result.push(i);
    }
    return result;
  }
  while (true) {
    const possible = candidates();
    let action = null;
    for (let axis = 0; axis < 2 && !action; axis += 1) {
      for (let p = 0; p < n && !action; p += 1) {
        const cells = [];
        for (let v = 0; v < n; v += 1) cells.push(axis === 0 ? p*n+v : v*n+p);
        const count = cells.filter(function(i) { return board[i] === 1; }).length;
        const needed = (axis === 0 ? level.rows[p] : level.cols[p])-count;
        const available = cells.filter(function(i) { return possible.indexOf(i) >= 0; });
        if (needed > 0 && needed === available.length) action = {index:available[0],value:1};
      }
    }
    if (!action) {
      for (let i = 0; i < board.length && !action; i += 1) {
        if (board[i] !== 0 || trees.has(i)) continue;
        const r = Math.floor(i/n), c = i%n;
        let rowCount = 0, colCount = 0;
        for (let p = 0; p < n; p += 1) { if (board[r*n+p] === 1) rowCount += 1; if (board[p*n+c] === 1) colCount += 1; }
        if (rowCount === level.rows[r] || colCount === level.cols[c]) action = {index:i,value:2};
      }
    }
    if (!action || isSolved(level,board)) break;
    board[action.index] = action.value;
    events.push(action);
    if (events.length > n*n) throw new Error('Quota audit did not terminate');
  }
  return {solved:isSolved(level,board),steps:events.length,tentsPlaced:board.filter(function(v) { return v === 1; }).length,remainingTents:level.trees.length-board.filter(function(v) { return v === 1; }).length,board:board,events:events};
}
export function measureDifficulty(level, proof) {
  let board = createBoard(level), logicSteps = 0, globalSteps = 0;
  const techniques = {};
  while (!isSolved(level,board)) {
    let next = logicalHint(level,board);
    if (next) logicSteps += 1;
    else { next = getHint(level,board); if (next) globalSteps += 1; }
    if (!next || next.kind === 'correction') throw new Error('Difficulty walk failed');
    techniques[next.kind] = (techniques[next.kind] || 0)+1;
    board = board.slice(); board[next.index] = next.value;
    if (logicSteps+globalSteps > level.size*level.size*2) throw new Error('Difficulty walk did not converge');
  }
  const candidates = Array.from({length:level.size*level.size},function(_,i) { return i; }).filter(function(i) { return level.trees.indexOf(i)<0 && orthogonal(level.size,i).some(function(t) { return level.trees.indexOf(t)>=0; }); }).length;
  const zeroLines = level.rows.concat(level.cols).filter(function(v) { return v === 0; }).length;
  // This is an implementation-defined route score, not a claim about human or optimal difficulty.
  const quota = quotaOnlyAudit(level);
  const matchingRejectedLayouts = Math.max(0,proof.matchingChecks-1);
  const score = (level.size-4)*1000 + globalSteps*180 + matchingRejectedLayouts*90 + proof.branchPoints*12 + proof.nodes*2 + candidates*3 + level.trees.length*6 - zeroLines*5;
  return {score:score,nodes:proof.nodes,branchPoints:proof.branchPoints,candidateCells:candidates,zeroLines:zeroLines,logicSteps:logicSteps,globalSteps:globalSteps,techniques:techniques,quotaOnlySolved:quota.solved,quotaOnlyTentsPlaced:quota.tentsPlaced,quotaOnlyRemainingTents:quota.remainingTents,matchingRejectedLayouts:matchingRejectedLayouts};
}
export function dayKey(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = date instanceof Date ? date : new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
export function dailyLevel(date) { return REPLAY_LEVELS[hashSeed('cloud-camp-daily:'+dayKey(date)) % REPLAY_LEVELS.length]; }
export function seedJourney(seed,count) {
  const total = count === undefined ? 10 : Math.max(1,Math.min(REPLAY_LEVELS.length,Math.floor(Number(count) || 10)));
  return shuffled(REPLAY_LEVELS,seededRandom(hashSeed('cloud-camp-route:'+String(seed).trim()))).slice(0,total);
}
