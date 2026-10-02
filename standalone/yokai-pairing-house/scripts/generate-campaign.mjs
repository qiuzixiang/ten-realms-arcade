import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generatePuzzle } from '../src/logic.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chapterOrders = [
  Array(10).fill(2),
  [...Array(4).fill(2), ...Array(6).fill(3)],
  Array(10).fill(3),
  Array(10).fill(3),
  Array(10).fill(4),
  Array(10).fill(4),
];
const chapterNames = ['初夜登记', '谁与谁同住', '满房名单', '转角客房', '百妖大厅', '月下合宿'];

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map((tail) => [value, ...tail]));
}

function canonical(numbers, order) {
  const width = order + 2;
  const height = order + 1;
  const variants = [];
  for (const flipX of [false, true]) for (const flipY of [false, true]) {
    const transformed = [];
    for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) {
      transformed.push(numbers[(flipY ? height - row - 1 : row) * width + (flipX ? width - col - 1 : col)]);
    }
    variants.push(transformed);
  }
  let best = null;
  for (const variant of variants) for (const labels of permutations(Array.from({ length: order + 1 }, (_, i) => i))) {
    const text = variant.map((n) => labels[n]).join('');
    if (best === null || text < best) best = text;
  }
  return best;
}

function ambiguity(puzzle) {
  return puzzle.edges.reduce((sum, edge) => sum + puzzle.edgesByPair.get(edge.pairKey).length - 1, 0);
}

const needed = { 2: 14, 3: 26, 4: 20 };
const candidates = { 2: [], 3: [], 4: [] };
for (const order of [2, 3, 4]) {
  const seen = new Set();
  for (let i = 0; candidates[order].length < needed[order] && i < 30000; i += 1) {
    const puzzle = generatePuzzle(order, `yokai-pairing-house:v1:o${order}:candidate:${i}`);
    const key = canonical(puzzle.numbers, order);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates[order].push({
      order,
      numbers: puzzle.numbers.join(''),
      sourceSeed: puzzle.seed,
      sourceAttempt: puzzle.attempt,
      solution: puzzle.solution,
      ambiguity: ambiguity(puzzle),
      canonical: key,
    });
  }
  if (candidates[order].length < needed[order]) throw new Error(`Only ${candidates[order].length} distinct order ${order} puzzles`);
  candidates[order].sort((a, b) => a.ambiguity - b.ambiguity || a.canonical.localeCompare(b.canonical));
  process.stdout.write(`order ${order}: ${candidates[order].length} distinct unique puzzles\n`);
}

const next = { 2: 0, 3: 0, 4: 0 };
const levels = chapterOrders.flatMap((orders, chapter) => orders.map((order, index) => {
  const puzzle = candidates[order][next[order]++];
  return {
    id: `yokai-pairing-house-c${String(chapter + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
    chapter: chapter + 1,
    number: index + 1,
    order,
    numbers: puzzle.numbers,
    sourceSeed: puzzle.sourceSeed,
    sourceAttempt: puzzle.sourceAttempt,
    solution: puzzle.solution,
    ambiguity: puzzle.ambiguity,
    title: `${chapterNames[chapter]} · ${String(index + 1).padStart(2, '0')}`,
  };
}));
const content = `// Generated deterministically by scripts/generate-campaign.mjs; version 1.\nexport const LEVELS = ${JSON.stringify(levels, null, 2)};\n`;
await writeFile(path.join(root, 'src/levels.mjs'), content);
process.stdout.write(`wrote ${levels.length} levels\n`);
