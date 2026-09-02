import { defineLevel } from "./logic.mjs";

const EASY = Object.freeze({ difficulty: "easy", tier: 1 });
const MEDIUM = Object.freeze({ difficulty: "medium", tier: 2 });
const HARD = Object.freeze({ difficulty: "hard", tier: 3 });

/** Fixed fixtures. Their answer is only a regression reference: solveLevel
 * deliberately searches from the displayed nuclei and never reads it. */
export const LEVELS = Object.freeze([
  defineLevel({
    id: "tidal-nursery", title: "潮汐育苗池", subtitle: "4 × 4 · 先辨认孢群容量", note: "从一枚孢核开始，让同色枝群刚好长到它标出的容量。",
    ...EASY, width: 4, height: 4, seed: 40101, par: 8,
    givens: [[15, 5], [8, 1], [5, 4], [6, 5], [14, 5], [11, 5], [9, 3], [7, 3]],
    solution: [4, 4, 3, 3, 4, 4, 5, 3, 1, 3, 5, 5, 3, 3, 5, 5],
  }),
  defineLevel({
    id: "lagoon-buds", title: "潟湖芽簇", subtitle: "4 × 4 · 分开相同孢群", note: "同样的容量数字可以有多簇；只有正交接触才会连成同一群。",
    ...EASY, width: 4, height: 4, seed: 40129, par: 8,
    givens: [[3, 4], [0, 1], [5, 3], [8, 2], [4, 2], [13, 4], [10, 4], [15, 4]],
    solution: [1, 4, 4, 4, 2, 3, 3, 4, 2, 3, 4, 1, 1, 4, 4, 4],
  }),
  defineLevel({
    id: "anemone-archive", title: "海葵标本库", subtitle: "4 × 4 · 容量互相卡位", note: "填错不会锁死棋盘，但会以警示环提示孢群过大或再也长不够。",
    ...MEDIUM, width: 4, height: 4, seed: 40183, par: 8,
    givens: [[11, 5], [12, 3], [5, 4], [9, 3], [7, 1], [4, 2], [15, 5], [13, 5]],
    solution: [2, 1, 4, 4, 2, 4, 4, 1, 3, 3, 5, 5, 3, 5, 5, 5],
  }),
  defineLevel({
    id: "shelf-reef", title: "陆架珊瑚坡", subtitle: "5 × 5 · 分枝扩散", note: "先数清已经接上的枝节，再决定哪一簇还需要抢占空位。",
    ...MEDIUM, width: 5, height: 5, seed: 50149, par: 13,
    givens: [[20, 4], [6, 3], [2, 5], [9, 2], [22, 4], [5, 4], [7, 3], [17, 2], [15, 1], [23, 3], [18, 1], [4, 5]],
    solution: [4, 4, 5, 5, 5, 4, 3, 3, 5, 2, 4, 3, 2, 5, 2, 1, 4, 2, 1, 3, 4, 4, 4, 3, 3],
  }),
  defineLevel({
    id: "abyssal-garden", title: "深蓝花园", subtitle: "5 × 5 · 双重孢带", note: "相同数字不必相连；真正要防的是相邻后让任何一簇超过自己的容量。",
    ...HARD, width: 5, height: 5, seed: 50251, par: 13,
    givens: [[13, 4], [22, 4], [3, 3], [20, 4], [9, 3], [7, 5], [17, 1], [19, 4], [15, 3], [11, 2], [6, 1], [23, 1]],
    solution: [5, 5, 5, 3, 3, 3, 1, 5, 5, 3, 3, 2, 2, 4, 1, 3, 4, 1, 4, 4, 4, 4, 4, 1, 4],
  }),
]);

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function nextLevel(level) {
  const index = LEVELS.findIndex((candidate) => candidate.id === level?.id);
  return LEVELS[(Math.max(index, 0) + 1) % LEVELS.length];
}
