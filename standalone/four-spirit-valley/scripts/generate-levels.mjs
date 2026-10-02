import { writeFile } from "node:fs/promises";
import { generatePuzzle, makeRandom } from "../src/engine.mjs";

const chapters = [
  { id: 1, title: "溪畔小屋", focus: "认清共边与角点", min: 6, max: 8, ratio: 0.68 },
  { id: 2, title: "三邻一席", focus: "用三种邻色排除第四种", min: 8, max: 10, ratio: 0.60 },
  { id: 3, title: "山居相望", focus: "沿邻接链逐步传播", min: 10, max: 12, ratio: 0.54 },
  { id: 4, title: "四灵留白", focus: "比较候选并寻找瓶颈", min: 12, max: 14, ratio: 0.48 },
  { id: 5, title: "深谷回声", focus: "连接远处区域的限制", min: 14, max: 16, ratio: 0.43 },
  { id: 6, title: "群山安居", focus: "综合运用邻接与候选", min: 14, max: 18, ratio: 0.39 },
];
const firstWords = ["灵泉", "松影", "石桥", "云阶", "竹径", "月潭", "溪声", "风栖", "苔庭", "星谷"];
const lastWords = ["初醒", "听雨", "归羽", "寻踪", "照月", "含翠", "迎风", "留白", "拾光", "安居"];
const chapterMarks = ["溪畔", "邻席", "相望", "留白", "深谷", "群山"];
function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) => permutations(items.filter((_, other) => other !== index).map((value) => value)).map((rest) => [item, ...rest]));
}
const colorPermutations = permutations([0, 1, 2, 3]);

function rotations(grid) {
  const result = [];
  let current = grid;
  for (let i = 0; i < 4; i += 1) {
    result.push(current);
    result.push(current.map((row) => [...row].reverse()));
    current = current[0].map((_, x) => current.map((row) => row[x]).reverse());
  }
  return result;
}
function fingerprint(level) {
  let best = null;
  for (const grid of rotations(level.layout)) {
    for (const colourMap of colorPermutations) {
      const labels = new Map();
      const clueList = [];
      const normalized = grid.map((row) => row.map((old) => {
        if (!labels.has(old)) {
          labels.set(old, labels.size);
          clueList[labels.get(old)] = Object.hasOwn(level.clues, String(old))
            ? colourMap[level.clues[old]] : -1;
        }
        return labels.get(old);
      }));
      const key = JSON.stringify([normalized, clueList]);
      if (best === null || key < best) best = key;
    }
  }
  return best;
}

const levels = [];
const seen = new Set();
for (const chapter of chapters) {
  for (let order = 0; order < 10; order += 1) {
    const id = `valley-${String(chapter.id).padStart(2, "0")}-${String(order + 1).padStart(2, "0")}`;
    let generated = null;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const seed = 20260923 + chapter.id * 100003 + order * 7919 + attempt * 104729;
      const random = makeRandom(seed);
      const span = chapter.max - chapter.min + 1;
      const regionTotal = chapter.min + random.int(span);
      const title = `${chapterMarks[chapter.id - 1]}·${firstWords[(order + chapter.id * 2) % firstWords.length]}${lastWords[(order * 3 + chapter.id) % lastWords.length]}`;
      const candidate = generatePuzzle({ id, title, chapter: chapter.id, seed, regionTotal, targetDifficulty: chapter.ratio });
      if (chapter.id === 1 && order === 0 && regionTotal - candidate.clueCount < 2) continue;
      const key = fingerprint(candidate);
      if (!seen.has(key)) { seen.add(key); generated = candidate; break; }
    }
    if (!generated) throw new Error(`Could not make a distinct level for ${id}.`);
    levels.push(generated);
    console.log(`${id}: ${generated.regionTotal} regions, ${generated.clueCount} clues, unique`);
  }
}
const source = `export const CHAPTERS = Object.freeze(${JSON.stringify(chapters)});\nexport const LEVELS = Object.freeze(${JSON.stringify(levels)});\n`;
await writeFile(new URL("../src/levels.mjs", import.meta.url), source);
