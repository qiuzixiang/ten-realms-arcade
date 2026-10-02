export const SPIRITS = Object.freeze([
  { id: 0, name: "水麟", glyph: "麟", pattern: "water" },
  { id: 1, name: "火羽", glyph: "羽", pattern: "flame" },
  { id: 2, name: "月狐", glyph: "狐", pattern: "moon" },
  { id: 3, name: "森龟", glyph: "龟", pattern: "leaf" },
]);

export function regionCount(layout) {
  let maximum = -1;
  for (const row of layout) for (const region of row) if (region > maximum) maximum = region;
  return maximum + 1;
}

export function buildAdjacency(layout) {
  const height = layout.length;
  const width = layout[0].length;
  const count = regionCount(layout);
  const sets = Array.from({ length: count }, () => new Set());
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = layout[y][x];
      if (x + 1 < width && layout[y][x + 1] !== a) {
        sets[a].add(layout[y][x + 1]); sets[layout[y][x + 1]].add(a);
      }
      if (y + 1 < height && layout[y + 1][x] !== a) {
        sets[a].add(layout[y + 1][x]); sets[layout[y + 1][x]].add(a);
      }
    }
  }
  return sets.map((set) => [...set].sort((a, b) => a - b));
}

export function createState(level) {
  const colours = Array(regionCount(level.layout)).fill(-1);
  for (const [region, colour] of Object.entries(level.clues)) colours[Number(region)] = colour;
  return { colours, notes: Array(colours.length).fill(0), moves: 0 };
}

export function isFixed(level, region) {
  return Object.prototype.hasOwnProperty.call(level.clues, String(region));
}

export function applyColour(state, level, region, colour) {
  if (!Number.isInteger(region) || region < 0 || region >= state.colours.length
      || !Number.isInteger(colour) || colour < -1 || colour > 3 || isFixed(level, region)) {
    return { state, changed: false };
  }
  if (state.colours[region] === colour && state.notes[region] === 0) return { state, changed: false };
  const next = { colours: [...state.colours], notes: [...state.notes], moves: state.moves + 1 };
  next.colours[region] = colour;
  next.notes[region] = 0;
  return { state: next, changed: true };
}

export function toggleNote(state, level, region, spirit) {
  if (!Number.isInteger(region) || region < 0 || region >= state.colours.length
      || !Number.isInteger(spirit) || spirit < 0 || spirit > 3
      || isFixed(level, region) || state.colours[region] >= 0) return { state, changed: false };
  const next = { colours: [...state.colours], notes: [...state.notes], moves: state.moves };
  next.notes[region] ^= 1 << spirit;
  return { state: next, changed: true };
}

export function analyse(state, level) {
  const adjacency = buildAdjacency(level.layout);
  const conflicts = [];
  for (let a = 0; a < adjacency.length; a += 1) {
    for (const b of adjacency[a]) {
      if (b > a && state.colours[a] >= 0 && state.colours[a] === state.colours[b]) conflicts.push([a, b]);
    }
  }
  const uncoloured = state.colours.filter((colour) => colour < 0).length;
  return { conflicts, uncoloured, solved: uncoloured === 0 && conflicts.length === 0 };
}

export function solveLevel(level, { current = null, limit = 2, random = null } = {}) {
  const count = regionCount(level.layout);
  const adjacency = buildAdjacency(level.layout);
  const colours = Array(count).fill(-1);
  for (const [region, colour] of Object.entries(level.clues)) colours[Number(region)] = colour;
  if (current) {
    for (let i = 0; i < count; i += 1) if (current[i] >= 0) colours[i] = current[i];
  }
  for (let a = 0; a < count; a += 1) {
    if (colours[a] < 0) continue;
    if (adjacency[a].some((b) => b < a && colours[b] === colours[a])) return { count: 0, solutions: [] };
  }
  const solutions = [];
  function search() {
    if (solutions.length >= limit) return;
    let chosen = -1;
    let choices = null;
    for (let region = 0; region < count; region += 1) {
      if (colours[region] >= 0) continue;
      const used = new Set(adjacency[region].map((near) => colours[near]).filter((c) => c >= 0));
      let available = [0, 1, 2, 3].filter((c) => !used.has(c));
      if (random) available = random.shuffle(available);
      if (available.length === 0) return;
      if (!choices || available.length < choices.length) { chosen = region; choices = available; }
    }
    if (chosen < 0) { solutions.push([...colours]); return; }
    for (const colour of choices) {
      colours[chosen] = colour;
      search();
      colours[chosen] = -1;
      if (solutions.length >= limit) return;
    }
  }
  search();
  return { count: solutions.length, unique: solutions.length === 1, solutions };
}

export function makeRandom(seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next: random,
    int(max) { return Math.floor(random() * max); },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

export function growLayout(regionTotal, seed) {
  const random = makeRandom(seed);
  const side = regionTotal <= 8 ? 5 : regionTotal <= 12 ? 6 : regionTotal <= 16 ? 7 : 8;
  const cells = side * side;
  const seeds = [random.int(cells)];
  while (seeds.length < regionTotal) {
    let best = -1;
    let bestDistance = -1;
    for (let index = 0; index < cells; index += 1) {
      if (seeds.includes(index)) continue;
      const x = index % side; const y = Math.floor(index / side);
      const distance = Math.min(...seeds.map((s) => Math.abs(x - s % side) + Math.abs(y - Math.floor(s / side))));
      if (distance > bestDistance || (distance === bestDistance && random.next() < 0.5)) {
        best = index; bestDistance = distance;
      }
    }
    seeds.push(best);
  }
  const layout = Array(cells).fill(-1);
  seeds.forEach((cell, region) => { layout[cell] = region; });
  let remaining = cells - regionTotal;
  while (remaining > 0) {
    const frontiers = [];
    for (let index = 0; index < cells; index += 1) {
      if (layout[index] >= 0) continue;
      const x = index % side; const y = Math.floor(index / side);
      const near = [];
      if (x > 0 && layout[index - 1] >= 0) near.push(layout[index - 1]);
      if (x + 1 < side && layout[index + 1] >= 0) near.push(layout[index + 1]);
      if (y > 0 && layout[index - side] >= 0) near.push(layout[index - side]);
      if (y + 1 < side && layout[index + side] >= 0) near.push(layout[index + side]);
      if (near.length) frontiers.push({ index, region: near[random.int(near.length)] });
    }
    if (!frontiers.length) throw new Error("Region growth reached a disconnected frontier.");
    const pick = frontiers[random.int(frontiers.length)];
    layout[pick.index] = pick.region;
    remaining -= 1;
  }
  return Array.from({ length: side }, (_, y) => layout.slice(y * side, (y + 1) * side));
}

export function generatePuzzle({ id, title, chapter, seed, regionTotal, targetDifficulty }) {
  const random = makeRandom(seed);
  const layout = growLayout(regionTotal, seed);
  const scaffold = { layout, clues: {} };
  const solved = solveLevel(scaffold, { limit: 1, random }).solutions[0];
  if (!solved) throw new Error(`Could not colour generated map ${id}.`);
  const clueOrder = random.shuffle(Array.from({ length: regionTotal }, (_, i) => i));
  const clues = Object.fromEntries(solved.map((colour, region) => [region, colour]));
  let kept = regionTotal;
  const target = Math.max(2, Math.round(regionTotal * targetDifficulty));
  for (const region of clueOrder) {
    if (kept <= target) break;
    const old = clues[region];
    delete clues[region];
    if (solveLevel({ layout, clues }, { limit: 2 }).count !== 1) clues[region] = old;
    else kept -= 1;
  }
  const proof = solveLevel({ layout, clues }, { limit: 2 });
  if (proof.count !== 1) throw new Error(`Unique-solution proof failed for ${id}: ${proof.count}.`);
  return {
    id, title, chapter, seed, regionTotal, layout, clues,
    clueCount: Object.keys(clues).length,
    difficulty: targetDifficulty <= 0.38 ? "山深" : targetDifficulty <= 0.55 ? "入谷" : "初识",
    proof: { method: "independent-second-solution-search", limit: 2, solutionsFound: proof.count },
  };
}
