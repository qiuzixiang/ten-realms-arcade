import { COVER, FLAG, OPEN, apply, isWon, newGame, neighbors, publicView } from './engine.mjs';

function equationView(view) {
  const equations = [];
  for (let i = 0; i < view.cells.length; i++) {
    if (view.cells[i] !== OPEN || view.numbers[i] < 1) continue;
    const around = neighbors(view.width, view.height, i);
    const cells = around.filter(n => view.cells[n] === COVER);
    const need = view.numbers[i] - around.filter(n => view.cells[n] === FLAG).length;
    if (need < 0 || need > cells.length) return null;
    if (cells.length) equations.push({ cells, need, source: i });
  }
  return equations;
}

function conclusions(cells, need, method, sources, explanation) {
  if (need !== 0 && need !== cells.length) return [];
  return cells.map(index => ({ type: need === 0 ? 'scan' : 'flag', index, method, sources, explanation }));
}

// Every result follows only from the public view. No answer layout or hidden readings enter this function.
export function deductions(view, maxNodes = 80000) {
  const equations = equationView(view);
  if (!equations) return { steps: [], inconsistent: true };
  for (const eq of equations) {
    const steps = conclusions(eq.cells, eq.need, 'single', [eq.source], `读数 ${view.numbers[eq.source]}：${eq.cells.length} 格未定，还差 ${eq.need} 个危险格。`);
    if (steps.length) return { steps, inconsistent: false };
  }
  for (let a = 0; a < equations.length; a++) for (let b = 0; b < equations.length; b++) {
    if (a === b) continue;
    const small = equations[a], large = equations[b];
    if (small.cells.length >= large.cells.length || !small.cells.every(n => large.cells.includes(n))) continue;
    const difference = large.cells.filter(n => !small.cells.includes(n));
    const need = large.need - small.need;
    const steps = conclusions(difference, need, 'subset', [small.source, large.source],
      `两个读数的候选区域相减：多出的 ${difference.length} 格中有 ${need} 个危险格。`);
    if (steps.length) return { steps, inconsistent: false };
  }
  const covered = view.cells.reduce((out, cell, i) => { if (cell === COVER) out.push(i); return out; }, []);
  const remaining = view.mineCount - view.cells.filter(cell => cell === FLAG).length;
  if (remaining < 0 || remaining > covered.length) return { steps: [], inconsistent: true };
  const global = conclusions(covered, remaining, 'total', [], `全盘还差 ${remaining} 个危险格，未定格有 ${covered.length} 个。`);
  if (global.length) return { steps: global, inconsistent: false };

  // Exhaust the visible frontier. Unconstrained covered cells are counted by capacity,
  // so a truncated search never becomes a proof.
  const frontier = [...new Set(equations.reduce((out, eq) => out.concat(eq.cells), []))].sort((a, b) => a - b);
  if (!frontier.length || frontier.length > 20) return { steps: [], inconsistent: false, limited: true };
  const outside = covered.length - frontier.length;
  const positions = new Map(frontier.map((n, i) => [n, i]));
  const constraints = equations.map(eq => ({ indices: eq.cells.map(n => positions.get(n)), need: eq.need }));
  const assigned = Array(frontier.length).fill(-1), possible = Array(frontier.length).fill(0);
  let solutions = 0, nodes = 0, limited = false, minimumOutside = Infinity, maximumOutside = -Infinity;
  function search(at, count) {
    if (++nodes > maxNodes) { limited = true; return; }
    if (count > remaining || count + frontier.length - at + outside < remaining) return;
    for (const eq of constraints) {
      let found = 0, free = 0;
      for (const index of eq.indices) {
        if (assigned[index] === 1) found++;
        else if (assigned[index] === -1) free++;
      }
      if (found > eq.need || found + free < eq.need) return;
    }
    if (at === frontier.length) {
      if (remaining - count < 0 || remaining - count > outside) return;
      solutions++;
      minimumOutside = Math.min(minimumOutside, remaining - count);
      maximumOutside = Math.max(maximumOutside, remaining - count);
      for (let i = 0; i < assigned.length; i++) possible[i] |= assigned[i] ? 2 : 1;
      return;
    }
    assigned[at] = 0; search(at + 1, count);
    if (!limited) { assigned[at] = 1; search(at + 1, count + 1); }
    assigned[at] = -1;
  }
  search(0, 0);
  if (limited) return { steps: [], inconsistent: false, limited: true };
  if (!solutions) return { steps: [], inconsistent: true };
  const outsideCells = covered.filter(index => !positions.has(index));
  if (outsideCells.length && minimumOutside === maximumOutside &&
      (minimumOutside === 0 || minimumOutside === outsideCells.length)) return {
    steps: conclusions(outsideCells, minimumOutside, 'total', equations.map(eq => eq.source),
      `边界的 ${solutions} 种可行排布都使边界外还剩 ${minimumOutside} 个危险格。`),
    inconsistent: false, solutions,
  };
  const steps = frontier.reduce((out, index, i) => { if (possible[i] === 1 || possible[i] === 2) out.push({
    type: possible[i] === 1 ? 'scan' : 'flag', index, method: 'enumeration',
    sources: equations.map(eq => eq.source),
    explanation: `已穷尽当前读数允许的 ${solutions} 种边界排布，这一格在全部排布中${possible[i] === 1 ? '安全' : '危险'}。`,
  }); return out; }, []);
  return { steps, inconsistent: false, solutions };
}

export function certify(level, maxSteps = 300) {
  let state = newGame(level);
  const first = apply(state, level, { type: 'scan', index: level.firstSafe });
  if (!first.changed || first.hit.length || first.state.mines.join() !== [...level.mines].sort((a, b) => a - b).join()) return null;
  state = first.state;
  const timeline = [{ type: 'scan', index: level.firstSafe }];
  const reasons = [];
  const counts = { single: 0, subset: 0, total: 0, enumeration: 0 };
  while (!isWon(state) && timeline.length < maxSteps) {
    const found = deductions(publicView(level, state));
    if (found.inconsistent || found.limited || !found.steps.length) return null;
    const step = found.steps[0];
    const result = apply(state, level, { type: step.type, index: step.index });
    if (!result.changed || result.hit.length) return null;
    state = result.state;
    timeline.push({ type: step.type, index: step.index });
    reasons.push(step);
    counts[step.method]++;
  }
  return isWon(state) ? { timeline, reasons, counts, state } : null;
}
