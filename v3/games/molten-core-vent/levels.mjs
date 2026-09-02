import { validateLevel } from "./logic.mjs";

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "easy", label: "浅层井", tier: 1, note: "4 × 4 · 明确压力表" }),
  Object.freeze({ id: "medium", label: "岩脉井", tier: 2, note: "5 × 5 · 需要联动判断" }),
  Object.freeze({ id: "hard", label: "熔核井", tier: 3, note: "6 × 6 · 全局防回环" }),
]);

const RAW_LEVELS = [
  {
    id: "ember-gate-1101", difficulty: "easy", seed: "forest-1101", title: "余烬一号闸",
    subtitle: "4 × 4 初次泄压", note: "从 0 表开始：周围所有导流板都必须避开该测点。",
    width: 4, height: 4,
    clues: [[1,0,null,null,0],[0,3,null,1,null],[1,null,2,2,1],[2,null,null,2,0],[0,1,null,1,1]],
    solution: ["\\//\\","////","////","\\\\\\\\"],
  },
  {
    id: "basalt-lock-1207", difficulty: "easy", seed: "forest-1207", title: "玄武岩气锁",
    subtitle: "4 × 4 边缘校压", note: "角点只接触一个舱室，边缘测点也比内部更容易锁定。",
    width: 4, height: 4,
    clues: [[0,2,1,1,0],[null,null,null,1,2],[null,null,2,null,null],[null,3,2,1,null],[0,1,null,2,0]],
    solution: ["/\\\\\\","\\\\\\/","\\///","\\\\\\/"],
  },
  {
    id: "magma-vein-2303", difficulty: "medium", seed: "forest-2303", title: "赤浆支脉",
    subtitle: "5 × 5 双层导流", note: "测点计数和无环条件会共同排除看似可行的方向。",
    width: 5, height: 5,
    clues: [[null,null,null,0,null,null],[1,1,null,null,3,null],[0,3,null,3,null,1],[null,1,2,1,null,2],[null,null,2,2,null,1],[0,null,null,1,1,null]],
    solution: ["\\\\\\//","\\///\\","///\\\\","\\////","\\////"],
  },
  {
    id: "forge-heart-2411", difficulty: "medium", seed: "forest-2411", title: "铸炉心室",
    subtitle: "5 × 5 高温校准", note: "数字缺失不是 0；没有压力表的测点仍受全局无环约束。",
    width: 5, height: 5,
    clues: [[null,1,null,null,null,null],[1,null,null,null,2,0],[2,null,1,null,3,null],[null,4,1,2,1,null],[2,null,null,null,null,null],[null,1,1,1,null,0]],
    solution: ["/////","//\\\\\\","\\///\\","/\\///","\\\\\\\\/"],
  },
  {
    id: "mantle-chamber-3501", difficulty: "hard", seed: "forest-3501", title: "地幔回声舱",
    subtitle: "6 × 6 深井泄压", note: "局部压力吻合仍可能形成闭环，必须同时观察整座管网。",
    width: 6, height: 6,
    clues: [[null,null,null,0,null,null,0],[2,null,1,2,1,null,null],[null,null,2,null,null,1,1],[1,null,null,null,3,2,null],[null,1,1,null,2,2,null],[null,null,2,2,null,2,2],[0,1,null,null,null,null,null]],
    solution: ["//\\/\\\\","\\\\\\//\\","/\\\\\\\\\\","/\\\\/\\\\","\\\\//\\\\","\\\\////"],
  },
  {
    id: "core-crown-3613", difficulty: "hard", seed: "forest-3613", title: "熔冠终端井",
    subtitle: "6 × 6 稀疏测点", note: "把方向关系向远处传递；任何封闭热环都会令全站失稳。",
    width: 6, height: 6,
    clues: [[null,null,null,null,null,null,null],[null,3,null,null,null,4,null],[null,null,3,2,2,null,null],[1,null,2,null,3,2,1],[1,null,2,1,2,null,2],[null,2,null,null,null,1,null],[0,null,1,null,1,null,null]],
    solution: ["\\//\\\\/","\\\\/\\/\\","\\//\\/\\","\\////\\","\\\\\\///","\\\\\\\\\\/"],
  },
];

export const LEVELS = Object.freeze(RAW_LEVELS.map((raw) => {
  const level = Object.freeze({ ...raw, clues: Object.freeze(raw.clues.map((row) => Object.freeze([...row]))), solution: Object.freeze([...raw.solution]) });
  if (!validateLevel(level, { unique: true })) throw new Error(`Invalid molten-core level: ${level.id}`);
  return level;
}));

export const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]));
export const TUTORIAL_LEVEL_ID = LEVELS[0].id;
export const TUTORIAL_ACTION = "0,0:B";

export function findLevel(id) { return LEVEL_BY_ID.get(id) ?? null; }
export function levelsForDifficulty(difficulty) { return LEVELS.filter((level) => level.difficulty === difficulty); }
export function difficultyForLevel(level) { return DIFFICULTIES.find((item) => item.id === level?.difficulty) ?? DIFFICULTIES[0]; }
export function nextLevel(level) {
  const pool = levelsForDifficulty(level?.difficulty);
  const index = pool.findIndex((item) => item.id === level?.id);
  return pool[(index + 1 + pool.length) % pool.length] ?? LEVELS[0];
}
