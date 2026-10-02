// Independent Akari oracle. Every plot belongs to one horizontal and one
// vertical uninterrupted run. A lamp lights the union of those runs.
// No game position, reference solution, or ray-casting helper is used here.

function modelPuzzle(puzzle) {
  const rows = puzzle && puzzle.rows;
  if (!Array.isArray(rows) || rows.length === 0 || rows.some((row) => typeof row !== "string")) {
    throw new TypeError("Puzzle rows must be a non-empty string array.");
  }
  const width = rows[0].length;
  if (width === 0 || rows.some((row) => row.length !== width || /[^.#0-4]/.test(row))) {
    throw new TypeError("Puzzle rows must form a rectangle of '.', '#', and clues 0–4.");
  }

  const index = rows.map((row) => Array.from(row, () => -1));
  const keys = [];
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      if (rows[r][c] === ".") {
        index[r][c] = keys.length;
        keys.push(`${r}:${c}`);
      }
    }
  }

  const horizontal = [];
  const vertical = [];
  const horizontalOf = new Int16Array(keys.length);
  const verticalOf = new Int16Array(keys.length);
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < width;) {
      if (index[r][c] < 0) { c += 1; continue; }
      const run = [];
      while (c < width && index[r][c] >= 0) {
        const n = index[r][c];
        run.push(n);
        horizontalOf[n] = horizontal.length;
        c += 1;
      }
      horizontal.push(run);
    }
  }
  for (let c = 0; c < width; c += 1) {
    for (let r = 0; r < rows.length;) {
      if (index[r][c] < 0) { r += 1; continue; }
      const run = [];
      while (r < rows.length && index[r][c] >= 0) {
        const n = index[r][c];
        run.push(n);
        verticalOf[n] = vertical.length;
        r += 1;
      }
      vertical.push(run);
    }
  }

  const covers = keys.map((_, n) => [
    ...new Set([...horizontal[horizontalOf[n]], ...vertical[verticalOf[n]]]),
  ]);
  const clues = [];
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      if (!/^[0-4]$/.test(rows[r][c])) continue;
      const neighbours = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([nr, nc]) => nr >= 0 && nr < rows.length && nc >= 0 && nc < width)
        .map(([nr, nc]) => index[nr][nc])
        .filter((n) => n >= 0);
      clues.push({ cells: neighbours, target: Number(rows[r][c]) });
    }
  }
  return { keys, rows, index, runs: [...horizontal, ...vertical], covers, clues };
}

function propagate(values, model) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const run of model.runs) {
      let placed = 0;
      for (const n of run) if (values[n] === 1) placed += 1;
      if (placed > 1) return false;
      if (placed === 1) {
        for (const n of run) {
          if (values[n] === -1) { values[n] = 0; changed = true; }
        }
      }
    }
    for (const clue of model.clues) {
      let placed = 0;
      let unknown = 0;
      for (const n of clue.cells) {
        if (values[n] === 1) placed += 1;
        else if (values[n] === -1) unknown += 1;
      }
      if (placed > clue.target || placed + unknown < clue.target) return false;
      if (placed === clue.target || placed + unknown === clue.target) {
        const forced = placed === clue.target ? 0 : 1;
        for (const n of clue.cells) {
          if (values[n] === -1) { values[n] = forced; changed = true; }
        }
      }
    }
    for (const cover of model.covers) {
      let lit = false;
      let lone = -1;
      let unknown = 0;
      for (const n of cover) {
        if (values[n] === 1) { lit = true; break; }
        if (values[n] === -1) { lone = n; unknown += 1; }
      }
      if (lit) continue;
      if (unknown === 0) return false;
      if (unknown === 1) { values[lone] = 1; changed = true; }
    }
  }
  return true;
}

function branchIndex(values, model) {
  const scores = new Float64Array(values.length);
  for (const cover of model.covers) {
    if (cover.some((n) => values[n] === 1)) continue;
    const open = cover.filter((n) => values[n] === -1);
    for (const n of open) scores[n] += 6 / open.length;
  }
  for (const clue of model.clues) {
    const open = clue.cells.filter((n) => values[n] === -1);
    for (const n of open) scores[n] += 4 / open.length;
  }
  for (const run of model.runs) {
    const open = run.filter((n) => values[n] === -1);
    for (const n of open) scores[n] += 1 / open.length;
  }
  let selected = -1;
  for (let n = 0; n < values.length; n += 1) {
    if (values[n] === -1 && (selected < 0 || scores[n] > scores[selected])) selected = n;
  }
  return selected;
}

/**
 * Find complete lamp placements. `complete: true` means the search exhausted
 * every branch. Reaching `limit` or `maxNodes` is explicitly truncated, so a
 * single solution from a capped search is never a uniqueness certificate.
 */
function searchModel(model, { limit = 2, maxNodes = Infinity, initial = null } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit must be positive.");
  if (!(maxNodes === Infinity || (Number.isInteger(maxNodes) && maxNodes > 0))) {
    throw new RangeError("maxNodes must be positive.");
  }
  const solutions = [];
  let nodes = 0;
  let truncated = false;
  if (model.keys.length === 0) return { complete: true, truncated: false, solutions, nodes };

  const visit = (values) => {
    if (truncated) return;
    if (nodes >= maxNodes) { truncated = true; return; }
    nodes += 1;
    if (!propagate(values, model)) return;
    const n = branchIndex(values, model);
    if (n < 0) {
      solutions.push(model.keys.filter((_, i) => values[i] === 1));
      if (solutions.length >= limit) truncated = true;
      return;
    }
    for (const value of [1, 0]) {
      if (truncated) break;
      const next = values.slice();
      next[n] = value;
      visit(next);
    }
  };
  visit(initial ? initial.slice() : new Int8Array(model.keys.length).fill(-1));
  return { complete: !truncated, truncated, solutions, nodes };
}

export function solvePuzzle(puzzle, options = {}) {
  return searchModel(modelPuzzle(puzzle), options);
}

function readPosition(model, position) {
  const values = new Int8Array(model.keys.length).fill(-1);
  const keyIndex = new Map(model.keys.map((key, index) => [key, index]));
  for (const key of (position && position.bulbs) || []) {
    const index = keyIndex.get(key);
    if (index === undefined) return { error: `灯位 ${key} 不是可放灯的花径。` };
    values[index] = 1;
  }
  for (const key of (position && position.marks) || []) {
    const index = keyIndex.get(key);
    if (index === undefined) return { error: `记号 ${key} 不是花径。` };
    if (values[index] === 1) return { error: `同一格 ${key} 同时放灯和记号。` };
    values[index] = 0;
  }
  return { values };
}

function immediateStep(model, values, skip = new Set()) {
  const isLit = (n) => model.covers[n].some((candidate) => values[candidate] === 1);
  for (const run of model.runs) {
    const bulbs = run.filter((n) => values[n] === 1);
    if (bulbs.length > 1) return { type: "contradiction", reason: {
      kind: "sightline", anchor: model.keys[bulbs[0]], text: "两盏灯在同一条无遮挡光路上互照。" } };
  }
  for (let r = 0; r < model.rows.length; r += 1) {
    for (let c = 0; c < model.rows[r].length; c += 1) {
      if (!/^[0-4]$/.test(model.rows[r][c])) continue;
      const cells = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([nr, nc]) => nr >= 0 && nr < model.rows.length && nc >= 0 && nc < model.rows[r].length)
        .map(([nr, nc]) => model.index[nr][nc]).filter((n) => n >= 0);
      const placed = cells.filter((n) => values[n] === 1).length;
      const open = cells.filter((n) => values[n] === -1);
      const anchor = `${r}:${c}`;
      const target = Number(model.rows[r][c]);
      if (placed > target || placed + open.length < target) return { type: "contradiction", reason: {
        kind: "number", anchor, text: `数字 ${target} 周围的灯数已无法满足要求。` } };
      if (open.length === 0) continue;
      if (placed === target) {
        const markable = open.find((n) => !isLit(n) && !skip.has(n));
        if (markable !== undefined) return { type: "exclude", key: model.keys[markable], proof: "local", reason: {
          kind: "number", anchor, text: `数字 ${target} 已有足够的相邻灯，这格不能再放灯。` } };
      }
      if (placed + open.length === target) {
        const needed = open.find((n) => !skip.has(n));
        if (needed !== undefined) return { type: "bulb", key: model.keys[needed], proof: "local", reason: {
          kind: "number", anchor, text: `数字 ${target} 需要所有剩余的相邻格放灯。` } };
      }
    }
  }
  for (let i = 0; i < model.covers.length; i += 1) {
    const cover = model.covers[i];
    if (cover.some((n) => values[n] === 1)) continue;
    const open = cover.filter((n) => values[n] === -1);
    if (open.length === 0) return { type: "contradiction", reason: {
      kind: "dark-plot", anchor: model.keys[i], text: "这格已没有任何可能的光源。" } };
    if (open.length === 1 && !skip.has(open[0])) return { type: "bulb", key: model.keys[open[0]], proof: "local", reason: {
      kind: "last-light", anchor: model.keys[i], text: "只有这一格还能照亮暗处。" } };
  }
  return null;
}

/**
 * Return one proven bulb or exclusion, or identify contradictory player notes.
 * Full-search deductions carry an exhaustive proof; node caps return `none`.
 */
export function explainStep(puzzle, position = {}, { maxNodes = 20000, maxChecks = 12 } = {}) {
  const model = modelPuzzle(puzzle);
  const parsed = readPosition(model, position);
  if (parsed.error) return { type: "contradiction", reason: { kind: "position", text: parsed.error } };
  const notedValues = parsed.values;
  const marked = new Set();
  const values = notedValues.slice();
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === 0) { marked.add(i); values[i] = -1; }
  }
  const baseline = searchModel(model, { limit: 1, maxNodes, initial: notedValues });
  if (!baseline.solutions.length) {
    if (!baseline.complete) return { type: "none", reason: { kind: "budget", text: "搜索尚未证明下一步。" } };
    const clue = marked.size ? searchModel(model, { limit: 1, maxNodes, initial: values }) : null;
    const marksCause = Boolean(clue && clue.solutions.length > 0);
    return { type: "contradiction", proof: "exhaustive", reason: { kind: marksCause ? "marks" : "bulbs",
      text: marksCause ? "当前记号排除了所有可行灯位。" : "当前灯位使题目无解。" } };
  }

  // Notes may be inconsistent with the intended reasoning. They are checked
  // above, then dropped from all proof searches; only placed lamps are fixed.
  const local = immediateStep(model, values, marked);
  if (local) return local;

  const solutionSet = new Set(baseline.solutions[0]);
  const candidates = [];
  const scoring = values.slice();
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== -1) continue;
    const selected = branchIndex(scoring, model);
    if (selected < 0) break;
    candidates.push(selected);
    scoring[selected] = 0;
  }
  const actionable = candidates.filter((candidate) => {
    if (marked.has(candidate)) return false;
    const mustBeBulb = solutionSet.has(model.keys[candidate]);
    return mustBeBulb || !model.covers[candidate].some((n) => values[n] === 1);
  });
  for (const candidate of actionable.slice(0, maxChecks)) {
    const opposite = values.slice();
    const mustBeBulb = solutionSet.has(model.keys[candidate]);
    opposite[candidate] = mustBeBulb ? 0 : 1;
    const counterexample = searchModel(model, { limit: 1, maxNodes, initial: opposite });
    if (counterexample.complete && counterexample.solutions.length === 0) {
      return { type: mustBeBulb ? "bulb" : "exclude", key: model.keys[candidate],
        proof: "exhaustive", reason: { kind: "cross-constraints", text: mustBeBulb
          ? "若这里不放灯，数字与照明条件无法同时成立。"
          : "若这里放灯，数字与照明条件无法同时成立。" } };
    }
  }
  return { type: "none", reason: { kind: "unproven", text: "目前没有在搜索上限内证明的单步。" } };
}
