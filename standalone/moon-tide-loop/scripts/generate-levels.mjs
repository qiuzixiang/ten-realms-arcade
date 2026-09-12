/** Reproducible offline authoring: generate non-symmetric simple-polyomino loops,
 * discard ambiguous full clues, then erase clues only after exhaustive proof.
 * node scripts/generate-levels.mjs regenerates src/levels.mjs.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { topology, checkWin } from '../src/engine.mjs';
import { solve } from '../src/solver.mjs';

function random(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
function shuffle(values, rand) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)), temp = result[i]; result[i] = result[j]; result[j] = temp; }
  return result;
}
function boundary(size, cells) {
  const board = topology(size, size), edges = Array(board.edgeCount).fill(-1);
  cells.forEach(cell => board.cellEdges[cell].forEach(edge => { edges[edge] *= -1; }));
  return edges;
}
function validBoundary(size, cells) {
  return checkWin({ width: size, height: size, clues: Array(size * size).fill(null) }, boundary(size, cells));
}
function canonicalCells(size, cells) {
  const signatures = [];
  for (let transform = 0; transform < 8; transform++) {
    const result = Array(size * size).fill(0);
    cells.forEach(cell => {
      let x = cell % size, y = Math.floor(cell / size);
      if (transform >= 4) x = size - 1 - x;
      for (let rotation = 0; rotation < transform % 4; rotation++) { const next = size - 1 - y; y = x; x = next; }
      result[y * size + x] = 1;
    });
    signatures.push(result.join(''));
  }
  return size + ':' + signatures.sort()[0];
}
function grow(size, rand, target) {
  const cells = new Set([Math.floor(rand() * size * size)]);
  while (cells.size < target) {
    const candidates = [];
    for (let cell = 0; cell < size * size; cell++) {
      if (cells.has(cell)) continue;
      const x = cell % size, y = Math.floor(cell / size);
      if (!((x > 0 && cells.has(cell - 1)) || (x < size - 1 && cells.has(cell + 1)) || (y > 0 && cells.has(cell - size)) || (y < size - 1 && cells.has(cell + size)))) continue;
      const expanded = new Set(cells); expanded.add(cell);
      if (validBoundary(size, expanded)) candidates.push(cell);
    }
    if (!candidates.length) break;
    cells.add(candidates[Math.floor(rand() * candidates.length)]);
  }
  return cells;
}
const CHAPTERS = [
  { id: 1, title: '初月沙洲', subtitle: '第一缕月光落在沙岸', focus: '数字与四边', collectible: '贝光', color: '#e5c990' },
  { id: 2, title: '珊瑚浅湾', subtitle: '沿珊瑚的轮廓缓缓前行', focus: '共享角点', collectible: '珊瑚', color: '#edab9c' },
  { id: 3, title: '潮声石径', subtitle: '听见空白处的潮汐', focus: '空白与排除', collectible: '月螺', color: '#b3ceb5' },
  { id: 4, title: '蓝泪环礁', subtitle: '让微光接成一条路', focus: '连续延伸', collectible: '蓝泪', color: '#8dd6dc' },
  { id: 5, title: '银沙群岛', subtitle: '小环之外还有未完的航程', focus: '避免提前闭环', collectible: '银星', color: '#c1b5ec' },
  { id: 6, title: '满月深海', subtitle: '让所有潮线归于一个月环', focus: '整体单环', collectible: '月珀', color: '#f0d598' }
];
const motifs = ['潮起', '拾光', '浅弯', '回声', '沙痕', '微澜', '远帆', '夜航', '星屿', '归潮', '月影', '环心'];
const sizes = [3, 4, 4, 5, 5, 6], removals = [0, 0.10, 0.30, 0.34, 0.50, 0.55];
const difficultyNames = ['初学', '熟悉', '推演', '进阶', '深思', '全局'];
const levels = [], seen = new Set();
for (let chapter = 1; chapter <= 6; chapter++) {
  const size = sizes[chapter - 1];
  for (let local = 0; local < 12; local++) {
    let chosen = null;
    for (let attempt = 0; attempt < 500 && !chosen; attempt++) {
      const seed = 9082026 + chapter * 100000 + local * 1000 + attempt, rand = random(seed);
      const target = Math.max(3, Math.floor(size * size * (0.40 + rand() * 0.48)));
      const cells = chapter === 1 && local === 0 ? new Set(Array.from({ length: 9 }, (_, i) => i)) : grow(size, rand, target);
      const signature = canonicalCells(size, cells);
      if (seen.has(signature)) continue;
      const solution = boundary(size, cells), board = topology(size, size);
      const clues = board.cellEdges.map(group => group.filter(edge => solution[edge] === 1).length);
      if (clues.some(clue => clue > 3)) continue;
      let proof = solve({ width: size, height: size, clues }, { limit: 2 });
      if (proof.count !== 1 || !proof.exhausted) continue;
      const targetRemovals = Math.floor(size * size * (removals[chapter - 1] + local * (chapter === 1 ? 0.010 : 0.006)));
      let removed = 0;
      for (const cell of shuffle(Array.from({ length: clues.length }, (_, index) => index), rand)) {
        if (removed >= targetRemovals) break;
        const backup = clues[cell]; clues[cell] = null;
        const next = solve({ width: size, height: size, clues }, { limit: 2 });
        if (next.count === 1 && next.exhausted) { proof = next; removed++; } else clues[cell] = backup;
      }
      // Later islands include searches that need global reasoning, not merely larger art.
      // Keep the actual search effort as evidence; labels describe curriculum, not human timings.
      const number = levels.length + 1;
      chosen = { id: 'moon-' + String(number).padStart(2, '0'), chapter, number, title: CHAPTERS[chapter - 1].title.slice(0, 2) + '·' + motifs[local], width: size, height: size, clues, solution, seed, difficulty: difficultyNames[chapter - 1], clueCount: clues.filter(n => n !== null).length, proof: { count: 1, exhausted: true, nodes: proof.nodes }, shapeSignature: signature };
      seen.add(signature);
    }
    if (!chosen) throw new Error('Could not generate chapter ' + chapter + ' level ' + local);
    levels.push(chosen);
    process.stdout.write(chosen.id + ' ' + size + 'x' + size + ' clues=' + chosen.clueCount + ' nodes=' + chosen.proof.nodes + '\n');
  }
}
// Order each island by measured independent search effort, preserving the explicit first tutorial.
for (let chapter = 1; chapter <= 6; chapter++) {
  const start = (chapter - 1) * 12, group = levels.slice(start, start + 12);
  const first = chapter === 1 ? group.shift() : null;
  group.sort((a, b) => a.proof.nodes - b.proof.nodes || b.clueCount - a.clueCount);
  if (first) group.unshift(first);
  group.forEach((level, local) => {
    const number = start + local + 1;
    level.id = 'moon-' + String(number).padStart(2, '0'); level.number = number;
    level.title = CHAPTERS[chapter - 1].title.slice(0, 2) + '·' + motifs[local];
    levels[start + local] = level;
  });
}

const runtime = `
function hashSeed(seed) {
  let result = 2166136261;
  for (let i = 0; i < seed.length; i++) { result ^= seed.charCodeAt(i); result = Math.imul(result, 16777619); }
  return result >>> 0;
}
function transformed(level, transform, id, seed, mode) {
  const n = level.width, count = n * (n + 1), clues = Array(n * n).fill(null), solution = Array(level.solution.length).fill(-1);
  const point = (px, py, max) => {
    let x = px, y = py;
    if (transform >= 4) x = max - x;
    for (let r = 0; r < transform % 4; r++) { const next = max - y; y = x; x = next; }
    return [x, y];
  };
  level.clues.forEach((clue, index) => { const p = point(index % n, Math.floor(index / n), n - 1); clues[p[1] * n + p[0]] = clue; });
  level.solution.forEach((value, edge) => {
    let a, b;
    if (edge < count) { const x = edge % n, y = Math.floor(edge / n); a = point(x, y, n); b = point(x + 1, y, n); }
    else { const e = edge - count, x = e % (n + 1), y = Math.floor(e / (n + 1)); a = point(x, y, n); b = point(x, y + 1, n); }
    const index = a[1] === b[1] ? a[1] * n + Math.min(a[0], b[0]) : count + Math.min(a[1], b[1]) * (n + 1) + a[0];
    solution[index] = value;
  });
  return Object.assign({}, level, { id, title: mode === 'daily' ? '每日潮汐' : '瓶中潮汐', mode, seed, sourceLevelId: level.id, transform, clues, solution, proof: { count: 1, exhausted: true, method: 'D4 symmetry bijection of independently proved mainline', sourceLevelId: level.id } });
}
export function getDailyLevel(dateString) {
  const today = new Date();
  const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const date = String(dateString || localDate);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z')) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) throw new RangeError('Invalid daily date');
  const value = hashSeed('daily:' + date), base = LEVELS[12 + value % 48];
  return transformed(base, (value >>> 8) % 8, 'daily-' + date, date, 'daily');
}
export function getSeedLevel(input) {
  const seed = String(input === undefined ? '月光' : input).trim().slice(0, 32) || '月光';
  const value = hashSeed('seed:' + seed), base = LEVELS[value % LEVELS.length];
  return transformed(base, (value >>> 8) % 8, 'seed-' + encodeURIComponent(seed), seed, 'seed');
}
export function getLevel(id) {
  if (typeof id !== 'string') return null;
  const main = LEVELS.find(level => level.id === id);
  if (main) return main;
  try {
    if (id.indexOf('daily-') === 0) return getDailyLevel(id.slice(6));
    if (id.indexOf('seed-') === 0) return getSeedLevel(decodeURIComponent(id.slice(5)));
  } catch (error) { return null; }
  return null;
}
export const levelById = getLevel;
`;
const output = '// Generated by scripts/generate-levels.mjs. All 72 mainline shapes differ under D4 symmetry.\n// Every retained clue set has an exhaustive independent second-solution search proof.\nexport const CHAPTERS = ' + JSON.stringify(CHAPTERS, null, 2) + ';\nexport const LEVELS = ' + JSON.stringify(levels, null, 2) + ';\n' + runtime;
writeFileSync(fileURLToPath(new URL('../src/levels.mjs', import.meta.url)), output);
