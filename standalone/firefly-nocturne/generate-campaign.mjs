// Deterministic offline authoring script. Run with node generate-campaign.mjs.
// Output is deliberately checked in as static level data for fast startup.
import { readFileSync, writeFileSync } from "node:fs";
import { solvePuzzle, explainStep } from "./solver.mjs";

const VERSION = "garden-gen-1";
const CHAPTERS = [
  { id: "gate", title: "门前一盏", subtitle: "看见光穿过花径", sizes: [4, 5, 5, 5, 5, 5, 5, 5, 5, 5], density: 0.32 },
  { id: "zero", title: "零灯石庭", subtitle: "听懂石上的数字", sizes: [5, 5, 5, 5, 6, 6, 6, 6, 6, 6], density: 0.32 },
  { id: "corridor", title: "花墙夹径", subtitle: "循着唯一的光源", sizes: Array(10).fill(6), density: 0.3 },
  { id: "bamboo", title: "竹影相借", subtitle: "让两处线索彼此照应", sizes: [6, 6, 6, 6, 7, 7, 7, 7, 7, 7], density: 0.29 },
  { id: "water", title: "水榭回光", subtitle: "追踪穿庭而过的光路", sizes: [7, 7, 7, 7, 8, 8, 8, 8, 8, 8], density: 0.29 },
  { id: "stars", title: "满庭星火", subtitle: "收拢稀疏的星点", sizes: [8, 8, 8, 8, 9, 9, 9, 9, 9, 9], density: 0.28 },
];
const TITLES = [
  ["门阶小夜灯", "苔砖初亮", "花径留光", "檐下微萤", "双墙之间", "曲角灯语", "露台斜影", "园门四望", "石径错落", "初庭长明"],
  ["零灯石", "两处数字", "三瓣花", "石纹邻光", "空心花坛", "数字之间", "月痕不落", "苔石绕灯", "四邻有数", "静庭归零"],
  ["单灯长廊", "花墙折径", "隔墙借光", "短径深处", "回身看灯", "双廊交会", "篱影收束", "暗角唯一", "曲径与石", "花墙尽头"],
  ["竹节相连", "两石共影", "竹林空格", "枝叶交错", "石隙藏萤", "数字相借", "疏竹照径", "交错灯位", "竹影回廊", "月下成双"],
  ["水榭初映", "池畔长光", "曲桥倒影", "隔水见灯", "双岸微明", "荷影穿庭", "回廊映水", "石桥相望", "临池灯阵", "水榭回光"],
  ["星点入庭", "深夜疏光", "幽径藏星", "九曲水榭", "花窗远照", "石庭连锁", "露影回环", "满庭灯语", "星河落园", "满庭星火"],
];

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function canonical(rows) {
  let forms = [rows.map((row) => [...row])];
  for (let i = 0; i < 3; i += 1) {
    const source = forms[forms.length - 1];
    forms.push(source[0].map((_, c) => source.map((row) => row[c]).reverse()));
  }
  forms.push(...forms.map((grid) => grid.map((row) => [...row].reverse())));
  return forms.map((grid) => grid.map((row) => row.join("")).join("/"))
    .sort()[0];
}

function longestRun(rows) {
  let longest = 0;
  const height = rows.length;
  const width = rows[0].length;
  for (const line of [rows, Array.from({ length: width }, (_, c) => rows.map((row) => row[c]).join(""))]) {
    for (const row of line) {
      for (const segment of row.split(/[#0-4]/)) longest = Math.max(longest, segment.length);
    }
  }
  return longest;
}

function build(seed, size, density, chapterIndex) {
  const random = rng(seed);
  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => random() < density ? "#" : "."));
  const wallCount = grid.flat().filter((cell) => cell === "#").length;
  if (wallCount < Math.max(2, Math.floor(size * size * 0.18)) || wallCount > size * size * 0.44) return null;
  let isolated = 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r][c] !== ".") continue;
      const adjacent = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === ".").length;
      if (adjacent === 0) isolated += 1;
    }
  }
  if (isolated > 2 || longestRun(grid.map((row) => row.join(""))) < Math.min(4, size)) return null;

  const wallRows = grid.map((row) => row.join(""));
  const answer = solvePuzzle({ rows: wallRows }, { limit: 1, maxNodes: 50000 });
  if (!answer.solutions.length) return null;
  const bulbSet = new Set(answer.solutions[0]);
  const wallPositions = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r][c] !== "#") continue;
      const neighbours = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size);
      const count = neighbours.filter(([nr, nc]) => bulbSet.has(`${nr}:${nc}`)).length;
      grid[r][c] = String(count);
      wallPositions.push([r, c]);
    }
  }
  const rowsOf = () => grid.map((row) => row.join(""));
  let result = solvePuzzle({ rows: rowsOf() }, { limit: 2, maxNodes: 50000 });
  if (!(result.complete && result.solutions.length === 1)) return null;

  // A reproducible clue-reduction pass; retain a mix of numbered and plain
  // stones, with extra zeros and full-neighbour numbers in chapter two.
  const order = shuffle(wallPositions, random);
  const minClues = Math.max(1, Math.round(wallCount * [0.3, 0.42, 0.3, 0.27, 0.22, 0.19][chapterIndex]));
  for (const [r, c] of order) {
    const clues = grid.flat().filter((cell) => /[0-4]/.test(cell)).length;
    if (clues <= minClues) break;
    const saved = grid[r][c];
    grid[r][c] = "#";
    const trial = solvePuzzle({ rows: rowsOf() }, { limit: 2, maxNodes: 50000 });
    if (!(trial.complete && trial.solutions.length === 1)) grid[r][c] = saved;
  }
  result = solvePuzzle({ rows: rowsOf() }, { limit: 2, maxNodes: 100000 });
  if (!(result.complete && result.solutions.length === 1)) return null;
  const rows = rowsOf();
  const clueCount = rows.join("").match(/[0-4]/g)?.length ?? 0;
  if (chapterIndex === 0 && clueCount > (size === 4 ? 2 : 6)) return null;
  if (chapterIndex === 1 && !rows.join("").includes("0")) return null;
  if (chapterIndex >= 4 && longestRun(rows) < size - 1) return null;
  return { rows, solution: result.solutions[0], nodes: result.nodes, clues: clueCount, walls: wallCount };
}

const levels = [];
const seen = new Set();
for (let chapterIndex = 0; chapterIndex < CHAPTERS.length; chapterIndex += 1) {
  const chapter = CHAPTERS[chapterIndex];
  for (let levelIndex = 0; levelIndex < 10; levelIndex += 1) {
    const size = chapter.sizes[levelIndex];
    let selected = null;
    let acceptedSeed = 0;
    for (let attempt = 1; attempt <= 20000; attempt += 1) {
      const seed = 104729 * (chapterIndex + 1) + 8191 * (levelIndex + 1) + attempt * 9973;
      const candidate = build(seed, size, chapter.density, chapterIndex);
      if (!candidate) continue;
      if (chapterIndex === 0 && levelIndex === 0 && explainStep(candidate).type !== "bulb") continue;
      const fingerprint = canonical(candidate.rows);
      if (seen.has(fingerprint)) continue;
      selected = candidate;
      acceptedSeed = seed;
      seen.add(fingerprint);
      break;
    }
    if (!selected) throw new Error(`Could not generate chapter ${chapterIndex + 1}, level ${levelIndex + 1}`);
    const id = `firefly-${String(chapterIndex + 1).padStart(2, "0")}-${String(levelIndex + 1).padStart(2, "0")}`;
    levels.push({ id, title: TITLES[chapterIndex][levelIndex], chapterId: chapter.id,
      rows: selected.rows, solution: selected.solution, seed: acceptedSeed, generatorVersion: VERSION });
    process.stdout.write(`${id} ${size}x${size} clues=${selected.clues} nodes=${selected.nodes} seed=${acceptedSeed}\n`);
  }
}

const chapterRecords = CHAPTERS.map(({ id, title, subtitle }) => ({ id, title, subtitle }));
const output = `// Generated by generate-campaign.mjs (${VERSION}).\n`+
  `import { createPuzzle } from "./logic.mjs";\n\n`+
  `export const CHAPTERS = Object.freeze(${JSON.stringify(chapterRecords, null, 2)}.map((chapter) => Object.freeze(chapter)));\n\n`+
  `export const LEVELS = Object.freeze(${JSON.stringify(levels, null, 2)}.map((level) => createPuzzle(Object.assign({}, level, { solution: Object.freeze(level.solution) }))));\n\n`+
  `export function findLevel(id) { return LEVELS.find((level) => level.id === id) || null; }\n`;
const outputFile = new URL("./levels.mjs", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(outputFile, "utf8") !== output) throw new Error("levels.mjs does not match its seeds and generator.");
  process.stdout.write("levels.mjs matches its deterministic generator.\n");
} else {
  writeFileSync(outputFile, output);
}
