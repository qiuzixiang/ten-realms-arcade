import { createState, pegCount, validateLevel } from "./logic.mjs";

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "easy", label: "晨风庭", tier: 1, note: "5 × 5 · 8–9 只纸鹤" }),
  Object.freeze({ id: "medium", label: "暮云庭", tier: 2, note: "6 × 5 · 10–11 只纸鹤" }),
  Object.freeze({ id: "hard", label: "星夜庭", tier: 3, note: "6 × 6 · 13–14 只纸鹤" }),
]);

const RAW_LEVELS = [
  {
    id: "dawn-perch-101", difficulty: "easy", seed: "reverse-101", title: "初羽回廊",
    subtitle: "七次正交归航", note: "先找能越过一只同伴、落到空栖位的纸鹤。",
    board: ["#PPP#", "##PP#", "##P.P", "#P..#", "#####"],
    solution: ["3,0>3,2", "1,0>3,0", "2,1>2,3", "1,3>3,3", "3,3>3,1", "3,0>3,2", "4,2>2,2"],
  },
  {
    id: "bamboo-window-203", difficulty: "easy", seed: "reverse-203", title: "竹窗轻岚",
    subtitle: "八次正交归航", note: "横向与纵向跳跃可以交替展开。",
    board: ["#PP##", "#PPP#", "#.PP.", "###.#", "#PP.#"],
    solution: ["3,1>3,3", "1,4>3,4", "3,4>3,2", "2,2>4,2", "2,0>2,2", "1,0>1,2", "1,2>3,2", "4,2>2,2"],
  },
  {
    id: "cloud-eaves-307", difficulty: "medium", seed: "reverse-307", title: "云檐折径",
    subtitle: "九次正交归航", note: "保留能衔接下一跳的空栖位，别过早封住侧翼。",
    board: ["######", "##P.PP", "##PP..", "##.PP.", "##PP.P"],
    solution: ["5,1>3,1", "2,4>4,4", "3,3>5,3", "2,1>2,3", "3,1>3,3", "2,3>4,3", "4,4>4,2", "5,4>5,2", "5,2>3,2"],
  },
  {
    id: "rain-bell-409", difficulty: "medium", seed: "reverse-409", title: "雨铃长阶",
    subtitle: "十次正交归航", note: "长阶两端会轮流成为下一次落点。",
    board: ["##P.PP", "##.PP.", "##P.P.", "##P#PP", "#####P"],
    solution: ["2,3>2,1", "3,1>5,1", "4,3>4,1", "5,0>3,0", "2,0>4,0", "5,4>5,2", "5,1>3,1", "2,1>4,1", "4,0>4,2", "5,2>3,2"],
  },
  {
    id: "moon-gate-503", difficulty: "hard", seed: "reverse-503", title: "月门千羽",
    subtitle: "十二次正交归航", note: "上下庭院共用少数通道，先观察落点的后续出口。",
    board: ["####PP", "#PP.PP", "###PP.", "###.P.", "###P.P", "####PP"],
    solution: ["1,1>3,1", "5,0>5,2", "5,5>5,3", "4,2>4,4", "3,1>3,3", "4,5>4,3", "3,4>3,2", "5,3>5,1", "4,0>4,2", "3,2>5,2", "5,1>5,3", "5,3>3,3"],
  },
  {
    id: "celestial-fold-607", difficulty: "hard", seed: "reverse-607", title: "天穹折庭",
    subtitle: "十三次正交归航", note: "多条支路会争用同一栖位，撤销永远不会扣除已得收藏。",
    board: ["######", ".PPPP.", "#P#P..", "#P#PPP", "PP.P.P", "######"],
    solution: ["2,1>0,1", "0,4>2,4", "2,4>4,4", "3,1>5,1", "3,3>3,1", "1,3>1,1", "5,4>5,2", "0,1>2,1", "4,4>4,2", "5,1>5,3", "2,1>4,1", "4,1>4,3", "5,3>3,3"],
  },
];

export const LEVELS = Object.freeze(RAW_LEVELS.map((raw) => {
  const level = Object.freeze({
    ...raw,
    board: Object.freeze([...raw.board]),
    solution: Object.freeze([...raw.solution]),
  });
  if (!validateLevel(level)) throw new Error(`Invalid paper-crane level: ${level.id}`);
  return level;
}));

export const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]));

export function findLevel(id) {
  return LEVEL_BY_ID.get(id) ?? null;
}

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function difficultyForLevel(level) {
  return DIFFICULTIES.find((item) => item.id === level?.difficulty) ?? DIFFICULTIES[0];
}

export function nextLevel(level) {
  const pool = levelsForDifficulty(level?.difficulty);
  const index = pool.findIndex((item) => item.id === level?.id);
  return pool[(index + 1 + pool.length) % pool.length] ?? LEVELS[0];
}

export const TUTORIAL_LEVEL_ID = LEVELS[0].id;
export const TUTORIAL_ACTION = LEVELS[0].solution[0];
export const TUTORIAL_INITIAL_CRANES = pegCount(createState(LEVELS[0]));
