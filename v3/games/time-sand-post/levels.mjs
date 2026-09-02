import { defineLevel } from "./logic.mjs";

const EASY = Object.freeze({ difficulty: "easy", tier: 1 });
const MEDIUM = Object.freeze({ difficulty: "medium", tier: 2 });
const HARD = Object.freeze({ difficulty: "hard", tier: 3 });

export const LEVELS = Object.freeze([
  defineLevel({
    id: "chronicle-dawn",
    title: "晨钟首邮",
    subtitle: "4 × 4 · 初级时序校准",
    note: "从时间戳 1 出发；点亮目标后再沿箭头继续。",
    ...EASY,
    width: 4,
    height: 4,
    seed: 11021,
    par: 8,
    directions: ["S", "S", "SE", "W", "SE", "S", "NE", null, "S", "E", "E", "NW", "N", "N", "E", "W"],
    givens: [[8, 1], [4, 4], [14, 5], [13, 7], [9, 10], [11, 12], [2, 15], [7, 16]],
  }),
  defineLevel({
    id: "amber-relay",
    title: "琥珀接力",
    subtitle: "4 × 4 · 双向驿线",
    note: "中途时间戳会校验整条已接邮路的位置。",
    ...EASY,
    width: 4,
    height: 4,
    seed: 11037,
    par: 8,
    directions: ["E", "E", "E", "S", "N", "SE", "S", "SW", "S", "NE", "NE", "W", "N", "N", "N", null],
    givens: [[8, 1], [1, 5], [11, 8], [14, 11], [10, 12], [7, 13], [5, 15], [15, 16]],
  }),
  defineLevel({
    id: "moonlit-dispatch",
    title: "月汐夜邮",
    subtitle: "5 × 5 · 月相转运",
    note: "箭头可跨越多个驿站，但只能落在同一条八向射线上。",
    ...MEDIUM,
    width: 5,
    height: 5,
    seed: 22041,
    par: 15,
    directions: ["SE", "S", "S", "S", "S", null, "N", "W", "N", "S", "NE", "NE", "NW", "S", "S", "E", "NW", "W", "W", "N", "NE", "E", "W", "W", "W"],
    givens: [[19, 1], [9, 3], [23, 6], [21, 7], [13, 12], [18, 13], [15, 15], [12, 19], [7, 24], [5, 25]],
  }),
  defineLevel({
    id: "glass-hour-route",
    title: "琉璃时径",
    subtitle: "5 × 5 · 沙漏折返",
    note: "无数字的短链也可先接好，遇到时间戳后会自动获得序号。",
    ...MEDIUM,
    width: 5,
    height: 5,
    seed: 22069,
    par: 16,
    directions: ["E", "E", "SE", "W", "S", "S", "E", "S", "SW", "NW", "NE", "E", "E", "NW", "S", "N", "N", null, "SW", "NW", "E", "NW", "E", "W", "NW"],
    givens: [[19, 1], [4, 3], [0, 6], [14, 8], [18, 10], [20, 13], [21, 14], [16, 20], [17, 25]],
  }),
  defineLevel({
    id: "eclipse-express",
    title: "蚀影急件",
    subtitle: "6 × 5 · 高阶全域投递",
    note: "先找只有一个合法后继的驿站，再合并带时间戳的长链。",
    ...HARD,
    width: 6,
    height: 5,
    seed: 33073,
    par: 17,
    directions: ["S", "SW", "S", "SW", "S", "W", "N", "E", "S", "N", "W", "S", "S", "E", "SE", null, "N", "SW", "S", "N", "NW", "W", "SW", "SW", "E", "E", "NW", "N", "N", "N"],
    givens: [[1, 1], [0, 3], [25, 7], [26, 11], [19, 12], [11, 14], [23, 15], [16, 18], [9, 20], [3, 21], [20, 25], [27, 29], [15, 30]],
  }),
  defineLevel({
    id: "last-bell-circuit",
    title: "终钟密邮",
    subtitle: "6 × 5 · 终局钟路",
    note: "跨格箭头会制造多个候选；用前后时间戳夹住链长。",
    ...HARD,
    width: 6,
    height: 5,
    seed: 33107,
    par: 16,
    directions: ["E", "E", "E", "SE", "W", "W", "S", "E", "E", "W", "S", "S", "SE", "N", "SE", "SW", "W", "N", "N", "SE", null, "N", "N", "W", "N", "E", "W", "NW", "W", "N"],
    givens: [[2, 1], [0, 3], [4, 5], [17, 7], [24, 13], [12, 14], [25, 17], [28, 18], [27, 19], [7, 21], [14, 27], [21, 28], [15, 29], [20, 30]],
  }),
]);

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "easy", label: "入门", note: "4 × 4 · 时间戳较密" }),
  Object.freeze({ id: "medium", label: "进阶", note: "5 × 5 · 跨格邮路" }),
  Object.freeze({ id: "hard", label: "秘境", note: "6 × 5 · 长链夹推" }),
]);

export function findLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function firstLevel(difficulty = "easy") {
  return levelsForDifficulty(difficulty)[0] ?? LEVELS[0];
}

export function nextLevel(level) {
  const group = levelsForDifficulty(level?.difficulty);
  const index = group.findIndex((candidate) => candidate.id === level?.id);
  return group[(index + 1 + group.length) % group.length] ?? LEVELS[0];
}
