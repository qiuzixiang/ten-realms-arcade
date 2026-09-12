/* Independent exhaustive Tents verifier. Does not import the game engine or read answers.
 * Row-mask enumeration + a separate tree-assignment DFS prove tent-layout uniqueness.
 * MIT; cloud-camp-journey contributors, 2026. */
export function solve(level, options) {
  options = options || {};
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 2;
  const result = { count: 0, solutions: [], nodes: 0, branchPoints: 0, maxDepth: 0, matchingChecks: 0, matchingRejectedWitnesses: [], exhausted: true, unique: false };
  if (!level || !Array.isArray(level.trees)) return result;
  const n = level.size;
  if (!Number.isInteger(n) || n < 2 || n > 7) return result;
  const trees = new Set(level.trees);
  const board = options.board || Array(n * n).fill(0);
  if (!Array.isArray(board) || board.length !== n * n || Array.from(board).some(function (v, i) { return !Number.isInteger(v) || v < 0 || v > 2 || (trees.has(i) && v !== 0); })) return result;
  if (!Array.isArray(level.rows) || !Array.isArray(level.cols) || level.rows.length !== n || level.cols.length !== n || Array.from(level.rows).some(function(v) { return !Number.isInteger(v) || v < 0 || v > n; }) || Array.from(level.cols).some(function(v) { return !Number.isInteger(v) || v < 0 || v > n; }) || level.rows.reduce(function(a,b) { return a+b; },0) !== trees.size || level.cols.reduce(function(a,b) { return a+b; },0) !== trees.size || trees.size !== level.trees.length || !trees.size || Array.from(level.trees).some(function(i) { return !Number.isInteger(i) || i < 0 || i >= n*n; })) return result;
  function adjacentTree(i) {
    const r = Math.floor(i / n), c = i % n;
    return (r > 0 && trees.has(i-n)) || (r+1 < n && trees.has(i+n)) || (c > 0 && trees.has(i-1)) || (c+1 < n && trees.has(i+1));
  }
  function bits(mask) { let count = 0; while (mask) { count += mask & 1; mask >>>= 1; } return count; }
  const patterns = [];
  for (let r = 0; r < n; r += 1) {
    let allowed = 0, required = 0;
    for (let c = 0; c < n; c += 1) {
      const i = r * n + c;
      if (!trees.has(i) && adjacentTree(i) && board[i] !== 2) allowed |= 1 << c;
      if (board[i] === 1) required |= 1 << c;
    }
    const rowPatterns = [];
    for (let mask = 0; mask < (1 << n); mask += 1) {
      if ((mask & allowed) !== mask || (mask & required) !== required || (mask & (mask << 1)) || bits(mask) !== level.rows[r]) continue;
      rowPatterns.push(mask);
    }
    if (!rowPatterns.length) return result;
    patterns.push(rowPatterns);
  }
  // Exact independent assignment search (not the engine's augmenting-path matcher).
  function hasPerfectAssignment(tents) {
    result.matchingChecks += 1;
    const candidates = level.trees.map(function(tree) {
      const r = Math.floor(tree/n), c = tree%n;
      return tents.filter(function(t) { return Math.abs(Math.floor(t/n)-r)+Math.abs(t%n-c) === 1; });
    }).sort(function(a,b) { return a.length-b.length; });
    const used = new Set();
    function assign(k) {
      if (k === candidates.length) return true;
      for (let p = 0; p < candidates[k].length; p += 1) {
        const t = candidates[k][p];
        if (used.has(t)) continue;
        used.add(t);
        if (assign(k+1)) return true;
        used.delete(t);
      }
      return false;
    }
    return assign(0);
  }
  const remaining = Array.from({ length: n+1 }, function() { return Array(n).fill(0); });
  for (let r = n-1; r >= 0; r -= 1) {
    for (let c = 0; c < n; c += 1) remaining[r][c] = remaining[r+1][c] + (patterns[r].some(function(m) { return (m & (1 << c)) !== 0; }) ? 1 : 0);
  }
  const counts = Array(n).fill(0), selected = Array(n).fill(0);
  function search(row, previous) {
    result.nodes += 1;
    result.maxDepth = Math.max(result.maxDepth, row);
    if (row === n) {
      if (counts.some(function(v,c) { return v !== level.cols[c]; })) return;
      const tents = [];
      for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (selected[r] & (1 << c)) tents.push(r*n+c);
      if (hasPerfectAssignment(tents)) result.solutions.push(tents);
      else if (result.matchingRejectedWitnesses.length < 3) result.matchingRejectedWitnesses.push(tents);
      return;
    }
    let viable = 0;
    for (let p = 0; p < patterns[row].length; p += 1) {
      const mask = patterns[row][p];
      if ((mask & previous) || (mask & (previous << 1)) || (mask & (previous >> 1))) continue;
      let valid = true;
      for (let c = 0; c < n; c += 1) {
        const next = counts[c] + ((mask >> c) & 1);
        if (next > level.cols[c] || next + remaining[row+1][c] < level.cols[c]) valid = false;
      }
      if (!valid) continue;
      viable += 1;
      selected[row] = mask;
      for (let c = 0; c < n; c += 1) counts[c] += (mask >> c) & 1;
      search(row+1, mask);
      for (let c = 0; c < n; c += 1) counts[c] -= (mask >> c) & 1;
      if (result.solutions.length >= limit) { result.exhausted = false; return; }
    }
    if (viable > 1) result.branchPoints += viable - 1;
  }
  search(0,0);
  result.count = result.solutions.length;
  result.unique = limit >= 2 && result.count === 1 && result.exhausted;
  return result;
}
