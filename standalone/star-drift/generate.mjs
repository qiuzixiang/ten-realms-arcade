import { createLevel, createGame, attemptMove, DIRECTIONS, solve, replay } from './core.mjs';

export const GENERATOR_VERSION = 1;
export function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
export function seededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const CHAPTER_CONFIG = Object.freeze([
  { size: 6, energy: 2, walls: 0.03, anchors: 1, mines: 0, minPar: 2, maxPar: 5 },
  { size: 7, energy: 3, walls: 0.12, anchors: 0, mines: 0, minPar: 4, maxPar: 7 },
  { size: 8, energy: 4, walls: 0.10, anchors: 3, mines: 0, minPar: 6, maxPar: 10 },
  { size: 8, energy: 4, walls: 0.12, anchors: 2, mines: 3, minPar: 7, maxPar: 12 },
  { size: 9, energy: 5, walls: 0.15, anchors: 3, mines: 4, minPar: 9, maxPar: 15 },
  { size: 10, energy: 6, walls: 0.17, anchors: 4, mines: 6, minPar: 12, maxPar: 19 },
]);

/** One deterministic candidate. Generation and proof are separate. */
export function candidateLevel(seed, chapter = 2, overrides = {}) {
  const config = { ...CHAPTER_CONFIG[chapter], ...overrides };
  const random = seededRandom(seed);
  const width = config.size + (random() > 0.70 ? 1 : 0);
  const height = config.size;
  const grid = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
    x === 0 || y === 0 || x === width - 1 || y === height - 1 ? '#' : '.'));
  const free = [];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) free.push({ x, y });
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]];
  }
  const place = (tile, n) => { for (let i = 0; i < n; i++) { const p = free.pop(); if (p) grid[p.y][p.x] = tile; } };
  place('@', 1);
  place('o', config.anchors);
  place('x', config.mines);
  place('#', Math.floor((width - 2) * (height - 2) * config.walls));
  place('e', config.energy);
  return createLevel({ id: `seed-${hashSeed(seed).toString(36)}`, name: '未命名航区', chapter, seed: String(seed),
    generatorVersion: GENERATOR_VERSION, grid: grid.map(row => row.join('')) });
}

export function analyzeSolution(level, path) {
  let game = createGame(level);
  let diagonalMoves = 0, anchorStops = 0, homeStops = 0, emptyMoves = 0, dangerOptions = 0;
  const directions = new Set();
  for (const direction of path) {
    dangerOptions += DIRECTIONS.filter(d => attemptMove(game, d).state.status === 'lost').length;
    const result = attemptMove(game, direction);
    diagonalMoves += direction.length === 2 ? 1 : 0;
    anchorStops += result.stopReason === 'stop' ? 1 : 0;
    homeStops += result.stopReason === 'stop' && result.state.position.x === level.start.x && result.state.position.y === level.start.y ? 1 : 0;
    emptyMoves += result.collected.length === 0 ? 1 : 0;
    directions.add(direction);
    game = result.state;
  }
  return { diagonalMoves, anchorStops, homeStops, emptyMoves, dangerOptions, directionVariety: directions.size };
}

/** Bounded, reproducible curation. null asks caller for an explicit fallback. */
export function generateProvenLevel(seed, chapter = 2, options = {}) {
  const config = { ...CHAPTER_CONFIG[chapter], ...options };
  const attempts = options.attempts ?? 100;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const candidateSeed = `${seed}:${attempt}`;
    const candidate = candidateLevel(candidateSeed, chapter, options);
    const proof = solve(candidate, { maxStates: options.maxStates ?? 35_000 });
    if (!proof.path || proof.path.length < config.minPar || proof.path.length > config.maxPar) continue;
    const metrics = analyzeSolution(candidate, proof.path);
    if (metrics.diagonalMoves < (chapter > 0 ? 1 : 0)) continue;
    if (chapter >= 2 && metrics.anchorStops === 0) continue;
    if (chapter >= 3 && metrics.dangerOptions < 2) continue;
    if (options.reject?.(candidate, proof, metrics)) continue;
    return createLevel({ ...candidate, par: proof.path.length, solution: Object.freeze(proof.path),
      proof: Object.freeze({ algorithm: 'BFS', visited: proof.visited, shortest: true }), metrics: Object.freeze(metrics),
      generation: Object.freeze({ inputSeed: String(seed), attempt, fallback: false }) });
  }
  return null;
}
