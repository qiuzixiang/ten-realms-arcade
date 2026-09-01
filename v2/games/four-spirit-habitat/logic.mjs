export const SPIRIT_COUNT = 4;

const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function regionCount(level) {
  return Math.max(...level.layout.flat()) + 1;
}

export function buildAdjacency(layout) {
  const height = layout.length;
  const width = layout[0]?.length ?? 0;
  const count = Math.max(...layout.flat()) + 1;
  const edges = Array.from({ length: count }, () => new Set());
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const here = layout[y][x];
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const there = layout[ny][nx];
        if (here === there) continue;
        edges[here].add(there);
        edges[there].add(here);
      }
    }
  }
  return edges.map((set) => [...set].sort((a, b) => a - b));
}

export function validateLevel(level) {
  if (!level || typeof level !== "object" || !Array.isArray(level.layout) || !level.layout.length) return false;
  const width = level.layout[0]?.length ?? 0;
  if (!width || level.layout.some((row) => !Array.isArray(row) || row.length !== width)) return false;
  const flat = level.layout.flat();
  if (flat.some((value) => !Number.isInteger(value) || value < 0)) return false;
  const count = Math.max(...flat) + 1;
  if (new Set(flat).size !== count || !Array.isArray(level.solution) || level.solution.length !== count) return false;
  if (level.solution.some((value) => !integer(value, 0, SPIRIT_COUNT - 1))) return false;
  if (!level.clues || typeof level.clues !== "object" || Array.isArray(level.clues)) return false;
  for (const [key, value] of Object.entries(level.clues)) {
    if (!/^\d+$/.test(key) || !integer(+key, 0, count - 1) || !integer(value, 0, SPIRIT_COUNT - 1)) return false;
    if (level.solution[+key] !== value) return false;
  }
  const adjacency = buildAdjacency(level.layout);
  if (adjacency.some((near, region) => near.some((other) => level.solution[region] === level.solution[other]))) return false;
  const cells = Array.from({ length: count }, () => []);
  level.layout.forEach((row, y) => row.forEach((region, x) => cells[region].push([x, y])));
  for (let region = 0; region < count; region += 1) {
    const seen = new Set([cells[region][0].join(",")]);
    const queue = [cells[region][0]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + dx},${y + dy}`;
        if (seen.has(key) || level.layout[y + dy]?.[x + dx] !== region) continue;
        seen.add(key);
        queue.push([x + dx, y + dy]);
      }
    }
    if (seen.size !== cells[region].length) return false;
  }
  return true;
}

export function createState(level) {
  const count = regionCount(level);
  const colours = new Array(count).fill(-1);
  for (const [region, colour] of Object.entries(level.clues)) colours[+region] = colour;
  return { colours, notes: new Array(count).fill(0), moves: 0 };
}

export function isFixed(level, region) {
  return Object.hasOwn(level.clues, String(region));
}

export function applyColour(state, level, region, colour) {
  if (!integer(region, 0, state.colours.length - 1) || !integer(colour, -1, SPIRIT_COUNT - 1) || isFixed(level, region)) {
    return { state, changed: false };
  }
  if (state.colours[region] === colour && state.notes[region] === 0) return { state, changed: false };
  const next = { colours: [...state.colours], notes: [...state.notes], moves: state.moves + 1 };
  next.colours[region] = colour;
  next.notes[region] = 0;
  return { state: next, changed: true };
}

export function replayColourTimeline(level, timeline, maximum = 10000) {
  if (!Array.isArray(timeline) || timeline.length > maximum) return null;
  let state = createState(level);
  for (const action of timeline) {
    if (!action || typeof action !== "object" || Array.isArray(action)
      || !integer(action.region, 0, state.colours.length - 1)
      || !integer(action.colour, -1, SPIRIT_COUNT - 1)) return null;
    const result = applyColour(state, level, action.region, action.colour);
    if (!result.changed) return null;
    state = result.state;
  }
  return state;
}

export function toggleNote(state, level, region, colour) {
  if (!integer(region, 0, state.colours.length - 1) || !integer(colour, 0, SPIRIT_COUNT - 1)
    || isFixed(level, region) || state.colours[region] >= 0) return { state, changed: false };
  const next = { colours: [...state.colours], notes: [...state.notes], moves: state.moves };
  next.notes[region] ^= 1 << colour;
  return { state: next, changed: true };
}

export function analyse(state, level) {
  const adjacency = buildAdjacency(level.layout);
  const conflicts = [];
  for (let region = 0; region < adjacency.length; region += 1) {
    for (const other of adjacency[region]) {
      if (other <= region || state.colours[region] < 0 || state.colours[region] !== state.colours[other]) continue;
      conflicts.push([region, other]);
    }
  }
  const uncoloured = state.colours.filter((colour) => colour < 0).length;
  return { conflicts, uncoloured, solved: uncoloured === 0 && conflicts.length === 0 };
}

export function solveLevel(level, { limit = 2 } = {}) {
  const count = regionCount(level);
  const adjacency = buildAdjacency(level.layout);
  const colours = new Array(count).fill(-1);
  for (const [region, colour] of Object.entries(level.clues)) colours[+region] = colour;
  const solutions = [];
  function optionsFor(region) {
    const used = new Set(adjacency[region].map((other) => colours[other]).filter((colour) => colour >= 0));
    return [0, 1, 2, 3].filter((colour) => !used.has(colour));
  }
  function search() {
    if (solutions.length >= limit) return;
    let region = -1;
    let options = null;
    for (let candidate = 0; candidate < count; candidate += 1) {
      if (colours[candidate] >= 0) continue;
      const available = optionsFor(candidate);
      if (!available.length) return;
      if (!options || available.length < options.length) {
        region = candidate;
        options = available;
      }
    }
    if (region < 0) {
      solutions.push([...colours]);
      return;
    }
    for (const colour of options) {
      colours[region] = colour;
      search();
      colours[region] = -1;
      if (solutions.length >= limit) return;
    }
  }
  search();
  return { count: solutions.length, unique: solutions.length === 1, solutions };
}

export function restoreState(candidate, level) {
  const clean = createState(level);
  if (!candidate || typeof candidate !== "object") return clean;
  const count = clean.colours.length;
  if (!Array.isArray(candidate.colours) || candidate.colours.length !== count
    || !Array.isArray(candidate.notes) || candidate.notes.length !== count) return clean;
  const colours = candidate.colours.map((value) => integer(value, -1, SPIRIT_COUNT - 1) ? value : -1);
  const notes = candidate.notes.map((value) => Number.isInteger(value) && value >= 0 && value < 16 ? value : 0);
  for (const [region, colour] of Object.entries(level.clues)) {
    if (colours[+region] !== colour) return clean;
  }
  for (let region = 0; region < count; region += 1) if (colours[region] >= 0) notes[region] = 0;
  return { colours, notes, moves: integer(candidate.moves, 0, 10000) ? candidate.moves : 0 };
}
