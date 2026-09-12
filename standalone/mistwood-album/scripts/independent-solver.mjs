/** Audit oracle: exhaustive integer row masks + incremental column automata.
 * Deliberately imports NO production rules, clue generator, patterns, or answer rows.
 * Enumerates every matching row mask and proves the search space exhausted unless
 * it reaches the requested solution cap (always >= 2 in uniqueness audits).
 */
export function solveIndependent(puzzle, limit = 2) {
  if (!Number.isInteger(limit) || limit < 2) throw new TypeError('Audit requires a limit of at least two');
  const { width: w, height: h, rowClues, columnClues } = puzzle;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 15 || h > 15) throw new TypeError('Unsupported audit dimensions');
  function maskRuns(mask, length) {
    const runs = []; let current = 0;
    for (let x = 0; x < length; x++) {
      if (mask & (1 << x)) current++;
      else if (current) { runs.push(current); current = 0; }
    }
    if (current) runs.push(current);
    return runs.join(',');
  }
  const rows = rowClues.map((clue) => {
    const masks = [];
    for (let m = 0; m < 2 ** w; m++) if (maskRuns(m, w) === clue.join(',')) masks.push(m);
    return masks;
  });
  const solutions = []; let nodes = 0;
  function search(y, placed, runIndex, runLength) {
    if (solutions.length >= limit) return;
    nodes++;
    if (y === h) {
      for (let x = 0; x < w; x++) {
        const completed = runIndex[x] + (runLength[x] ? 1 : 0);
        if (runLength[x] && runLength[x] !== columnClues[x][runIndex[x]]) return;
        if (completed !== columnClues[x].length) return;
      }
      solutions.push(placed.flatMap((mask) => Array.from({ length: w }, (_, x) => mask & (1 << x) ? 1 : 0)));
      return;
    }
    for (const mask of rows[y]) {
      const nextIndex = runIndex.slice(), nextLength = runLength.slice();
      let fits = true;
      for (let x = 0; x < w && fits; x++) {
        const clue = columnClues[x];
        if (mask & (1 << x)) {
          nextLength[x]++;
          if (nextIndex[x] >= clue.length || nextLength[x] > clue[nextIndex[x]]) fits = false;
        } else if (nextLength[x]) {
          if (nextLength[x] !== clue[nextIndex[x]]) fits = false;
          nextIndex[x]++; nextLength[x] = 0;
        }
        if (fits) {
          const left = h - y - 1;
          let minimum = 0;
          if (nextLength[x]) {
            minimum = clue[nextIndex[x]] - nextLength[x];
            for (let r = nextIndex[x] + 1; r < clue.length; r++) minimum += 1 + clue[r];
          } else {
            for (let r = nextIndex[x]; r < clue.length; r++) minimum += clue[r] + (r > nextIndex[x] ? 1 : 0);
          }
          if (minimum > left) fits = false;
        }
      }
      if (fits) search(y + 1, placed.concat(mask), nextIndex, nextLength);
      if (solutions.length >= limit) break;
    }
  }
  search(0, [], Array(w).fill(0), Array(w).fill(0));
  return { count: solutions.length, solutions, nodes, exhausted: solutions.length < limit };
}
