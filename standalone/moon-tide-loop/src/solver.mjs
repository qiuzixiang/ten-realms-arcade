/** Independent exhaustive Slitherlink solver. Does not import engine or read solution.
 * Each branch partitions all remaining binary edge assignments. No node/time cutoff.
 * A search stops only after `limit` distinct solutions, otherwise exhausted=true.
 */
export function solve(puzzle, options = {}) {
  const width = puzzle.width, height = puzzle.height;
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 2;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12 || height > 12 || !Array.isArray(puzzle.clues) || puzzle.clues.length !== width * height || !puzzle.clues.every(n => n === null || (Number.isInteger(n) && n >= 0 && n <= 3))) return { solutions: [], count: 0, exhausted: true, nodes: 0, invalid: true };
  const horizontalCount = width * (height + 1), edgeCount = horizontalCount + height * (width + 1);
  const endpoints = [], atPoint = Array.from({ length: (width + 1) * (height + 1) }, () => []), around = [], edgeClues = Array.from({ length: edgeCount }, () => []);
  for (let y = 0; y <= height; y++) for (let x = 0; x < width; x++) endpoints.push([y * (width + 1) + x, y * (width + 1) + x + 1]);
  for (let y = 0; y < height; y++) for (let x = 0; x <= width; x++) endpoints.push([y * (width + 1) + x, (y + 1) * (width + 1) + x]);
  endpoints.forEach((pair, edge) => pair.forEach(point => atPoint[point].push(edge)));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cell = y * width + x;
    const edges = [y * width + x, (y + 1) * width + x, horizontalCount + y * (width + 1) + x, horizontalCount + y * (width + 1) + x + 1];
    around.push(edges);
    if (puzzle.clues[cell] !== null) edges.forEach(edge => edgeClues[edge].push(cell));
  }
  const initial = Array(edgeCount).fill(0);
  if (options.edges !== undefined) {
    if (!Array.isArray(options.edges) || options.edges.length !== edgeCount || !options.edges.every(v => v === -1 || v === 0 || v === 1)) return { solutions: [], count: 0, exhausted: true, nodes: 0, invalid: true };
    options.edges.forEach((v, i) => { initial[i] = v; });
  }
  const solutions = []; let nodes = 0, reachedLimit = false;
  const propagate = values => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let cell = 0; cell < around.length; cell++) {
        const clue = puzzle.clues[cell];
        if (clue === null) continue;
        let lines = 0; const free = [];
        around[cell].forEach(e => { if (values[e] === 1) lines++; else if (values[e] === 0) free.push(e); });
        if (lines > clue || lines + free.length < clue) return false;
        if (free.length && (lines === clue || lines + free.length === clue)) {
          const value = lines === clue ? -1 : 1;
          free.forEach(e => { values[e] = value; }); changed = true;
        }
      }
      for (const group of atPoint) {
        let lines = 0; const free = [];
        group.forEach(e => { if (values[e] === 1) lines++; else if (values[e] === 0) free.push(e); });
        if (lines > 2 || (lines === 1 && free.length === 0)) return false;
        if (!free.length) continue;
        if (lines === 2 || (lines === 0 && free.length === 1)) { free.forEach(e => { values[e] = -1; }); changed = true; }
        else if (lines === 1 && free.length === 1) { values[free[0]] = 1; changed = true; }
      }
      // A closed line component can only be the entire final loop.
      // Force every remaining edge absent, or reject any outside selected line.
      const visited = new Set(); let closedComponent = null, selectedCount = 0;
      values.forEach(v => { if (v === 1) selectedCount++; });
      for (let first = 0; first < edgeCount; first++) {
        if (values[first] !== 1 || visited.has(first)) continue;
        const stack = [first], component = []; let closed = true;
        while (stack.length) {
          const edge = stack.pop();
          if (visited.has(edge)) continue;
          visited.add(edge); component.push(edge);
          endpoints[edge].forEach(point => {
            const neighbors = atPoint[point].filter(e => values[e] === 1);
            if (neighbors.length !== 2) closed = false;
            neighbors.forEach(e => { if (!visited.has(e)) stack.push(e); });
          });
        }
        if (closed) { closedComponent = component; break; }
      }
      if (closedComponent) {
        if (closedComponent.length !== selectedCount) return false;
        for (let e = 0; e < edgeCount; e++) if (values[e] === 0) { values[e] = -1; changed = true; }
      }
    }
    return true;
  };
  const complete = values => {
    const first = values.indexOf(1);
    if (first < 0) return false;
    const seen = new Set(), stack = [first];
    while (stack.length) {
      const edge = stack.pop();
      if (seen.has(edge)) continue;
      seen.add(edge);
      for (const point of endpoints[edge]) for (const other of atPoint[point]) if (values[other] === 1 && !seen.has(other)) stack.push(other);
    }
    return seen.size === values.filter(v => v === 1).length;
  };
  const search = values => {
    if (solutions.length >= limit) { reachedLimit = true; return; }
    nodes++;
    if (!propagate(values)) return;
    let choice = -1, best = -Infinity;
    for (let edge = 0; edge < edgeCount; edge++) {
      if (values[edge] !== 0) continue;
      let score = 0;
      for (const cell of edgeClues[edge]) {
        const free = around[cell].filter(e => values[e] === 0).length;
        score += 14 - free * 2;
      }
      for (const point of endpoints[edge]) {
        const group = atPoint[point];
        score += group.filter(e => values[e] === 1).length * 9 + 4 - group.filter(e => values[e] === 0).length;
      }
      if (score > best) { best = score; choice = edge; }
    }
    if (choice === -1) {
      if (complete(values)) solutions.push(values.slice());
      return;
    }
    const present = values.slice(); present[choice] = 1; search(present);
    if (solutions.length >= limit) { reachedLimit = true; return; }
    const absent = values.slice(); absent[choice] = -1; search(absent);
  };
  search(initial);
  return { solutions, count: solutions.length, exhausted: !reachedLimit && solutions.length < limit, nodes };
}
