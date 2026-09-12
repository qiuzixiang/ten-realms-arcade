import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {} });
for (const filename of ['engine.js', 'levels.js']) vm.runInContext(fs.readFileSync(path.join(directory, 'src', filename), 'utf8'), context);
const { CraneEngine: Engine, CraneLevels: Library } = context.window;
const titles = [
  ['第一声风', '小径回身', '檐下三折', '竹篱短廊', '双叶相迎', '池边转角', '晨光停处', '纸窗留白', '微风绕庭', '初羽归来'],
  ['浮莲入水', '曲廊相接', '两岸回声', '荷梗轻桥', '莲叶递风', '亭角回望', '水纹相续', '双廊织影', '疏叶成路', '莲塘小集'],
  ['竹外一枝', '折庭双径', '风过侧门', '青石留步', '疏竹照影', '支路相逢', '篱边等候', '叶间回廊', '清风接力', '竹庭归拢'],
  ['雨后开桥', '檐雨回声', '石阶相让', '折返微澜', '双桥会面', '远岸一羽', '桥心留鹤', '雨丝成线', '回廊候晴', '水光同归'],
  ['月门初开', '两院通风', '灯下留白', '池角清辉', '疏影成行', '空庭月步', '外廊折月', '窄门回声', '万籁轻起', '满院归心'],
  ['星桥远信', '长庭交织', '银河留渡', '三羽望归', '星芒分径', '双岸相守', '天际折返', '深院出口', '千纸流光', '万里归巢']
];

// Independent oracle: board strings and coordinate triples, with no calls to Engine
// and no inspection of the embedded witness. It proves existence, not uniqueness.
export function independentSolve(level, target = undefined, limit = 600000) {
  const width = level.width, height = level.height, initial = level.board.join('');
  const jumps = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const xx = x + 2 * dx, yy = y + 2 * dy;
      if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
      const a = y * width + x, b = (y + dy) * width + x + dx, c = yy * width + xx;
      if ([a, b, c].every(i => initial[i] !== '#')) jumps.push([a, b, c]);
    }
  }
  const dead = new Set(); let nodes = 0, truncated = false;
  function dfs(board, count) {
    if (++nodes > limit) { truncated = true; return null; }
    if (count === 1) return target === undefined || board[target] === 'P' ? [] : null;
    if (dead.has(board)) return null;
    for (const [a, b, c] of jumps) {
      if (board[a] !== 'P' || board[b] !== 'P' || board[c] !== '.') continue;
      const next = board.split(''); next[a] = next[b] = '.'; next[c] = 'P';
      const result = dfs(next.join(''), count - 1);
      if (result) return [{ from: a, to: c }, ...result];
      if (truncated) return null;
    }
    dead.add(board); return null;
  }
  const solution = dfs(initial, [...initial].filter(c => c === 'P').length);
  return { solution, nodes, truncated };
}

export function signature(level, shapeOnly = false) {
  const points = [];
  level.board.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '#') points.push([x, y, shapeOnly ? '.' : c]); }));
  const forms = [];
  for (let flip = 0; flip < 2; flip += 1) for (let rotation = 0; rotation < 4; rotation += 1) {
    const transformed = points.map(([x, y, cell]) => {
      if (flip) x = -x;
      for (let i = 0; i < rotation; i += 1) [x, y] = [-y, x];
      return [x, y, cell];
    });
    const minX = Math.min(...transformed.map(p => p[0])), minY = Math.min(...transformed.map(p => p[1]));
    forms.push(transformed.map(([x, y, cell]) => [x - minX, y - minY, cell].join(',')).sort().join(';'));
  }
  return forms.sort()[0];
}

async function main() {
  const levels = [], seen = new Set();
  for (let chapter = 1; chapter <= 6; chapter += 1) {
    for (let position = 0; position < 10; position += 1) {
      const settings = Library.parameters(chapter, position);
      const candidates = [];
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const seed = `main-c${chapter}-p${position + 1}-v1-${attempt}`;
        const level = Library.generate(seed, chapter, settings);
        const state = Engine.create(level), branches = Engine.legal(state).length;
        if (!branches || seen.has(signature(level))) continue;
        // Keep gentle opening choices; later chapters retain materially wider trees.
        if (chapter === 1 && branches > 3 || chapter > 2 && branches < 3) continue;
        const search = Engine.solve(state, { target: level.target, nodeLimit: 40000 });
        if (!search.solution || search.truncated) continue;
        const arbitrary = Engine.solve(state, { nodeLimit: 40000 });
        if (!arbitrary.solution || arbitrary.truncated) continue;
        const goal = Engine.replay(level, level.solution);
        if (!goal || !Engine.won(goal) || goal.cells[level.target] !== 'P' || level.solution.length !== Engine.count(state) - 1) throw new Error(`Bad reverse witness ${seed}`);
        let next = state, totalBranches = 0, maxBranches = 0;
        for (const move of level.solution) {
          const options = Engine.legal(next).length; totalBranches += options; maxBranches = Math.max(maxBranches, options); next = Engine.apply(next, move);
        }
        const score = chapter === 1 ? -branches * 10 - search.nodes : Math.min(search.nodes, 15000) / 100 + totalBranches * 2 + maxBranches * 5;
        candidates.push({ level, search, arbitrary, score, branches, totalBranches, maxBranches });
      }
      candidates.sort((a, b) => b.score - a.score);
      let chosen;
      for (const candidate of candidates) {
        const oracle = independentSolve(candidate.level, candidate.level.target);
        if (oracle.solution && !oracle.truncated) { chosen = { ...candidate, oracle }; break; }
      }
      if (!chosen) throw new Error(`No acceptable chapter ${chapter}, position ${position + 1}`);
      const { level, search, arbitrary, branches, totalBranches, maxBranches, oracle } = chosen;
      const ordinal = levels.length + 1;
      level.id = `crane-${String(ordinal).padStart(3, '0')}`; level.title = titles[chapter - 1][position];
      level.lesson = Library.lessons[chapter - 1][position];
      Object.assign(level.stats, { initialBranches: branches, solutionBranches: totalBranches, maxBranches, searchNodes: arbitrary.nodes, targetSearchNodes: search.nodes, independentSearchNodes: oracle.nodes, shapeSignature: signature(level, true) });
      levels.push(level); seen.add(signature(level));
      process.stdout.write(`${level.id} ${level.width}x${level.height} ${level.stats.pegCount} cranes · branches ${branches}/${maxBranches} · solver ${search.nodes} · oracle ${oracle.nodes}\n`);
    }
  }
  const filename = path.join(directory, 'src', 'levels.js');
  const source = fs.readFileSync(filename, 'utf8');
  fs.writeFileSync(filename, source.replace(/\/\* GENERATED_LEVELS_START \*\/[\s\S]*?\/\* GENERATED_LEVELS_END \*\//, `/* GENERATED_LEVELS_START */ ${JSON.stringify(levels, null, 2)} /* GENERATED_LEVELS_END */`));
  const report = {
    schemaVersion: 1, generatedBy: 'node scripts/generate-levels.mjs', rules: 'classic Pegs; any one remaining peg wins',
    levelCount: levels.length, chapterCount: 6, chapterSize: 10,
    proof: 'Every witness replayed; independent coordinate/string DFS found a solution to the optional target without reading the witness. No uniqueness claim.',
    canonicalUniqueBoards: new Set(levels.map(level => signature(level))).size,
    canonicalUniqueTopologies: new Set(levels.map(level => signature(level, true))).size,
    chapters: Library.chapters.map(chapter => {
      const pool = levels.filter(level => level.chapter === chapter.id);
      return { ...chapter, count: pool.length, minPegs: Math.min(...pool.map(l => l.stats.pegCount)), maxPegs: Math.max(...pool.map(l => l.stats.pegCount)), minInitialBranches: Math.min(...pool.map(l => l.stats.initialBranches)), maxInitialBranches: Math.max(...pool.map(l => l.stats.initialBranches)), meanWitnessBranches: +(pool.reduce((s, l) => s + l.stats.solutionBranches / l.solution.length, 0) / pool.length).toFixed(2), maxIndependentSearchNodes: Math.max(...pool.map(l => l.stats.independentSearchNodes)) };
    }),
    levels: levels.map(({ id, seed, chapter, width, height, target, solution, stats }) => ({ id, seed, chapter, width, height, target, solutionLength: solution.length, ...stats }))
  };
  fs.writeFileSync(path.join(directory, 'level-report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`Verified ${levels.length} levels, ${report.canonicalUniqueTopologies} canonical topologies.\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
