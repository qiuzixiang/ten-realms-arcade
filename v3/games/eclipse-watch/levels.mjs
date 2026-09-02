import { defineLevel } from "./logic.mjs";

const EASY = Object.freeze({ difficulty: "easy", tier: 1 });
const MEDIUM = Object.freeze({ difficulty: "medium", tier: 2 });
const HARD = Object.freeze({ difficulty: "hard", tier: 3 });

/** Fixed Range fixtures. `solution` supports regression only; the independent
 * solver searches solely from the light readings. 0=white, 1=black. */
export const LEVELS = Object.freeze([
  defineLevel({
    id: "first-umbra", title: "初蚀光幕", subtitle: "5 × 5 · 读懂一束光", note: "把必要格涂黑，光束会在黑格前停下。",
    ...EASY, width: 5, height: 5, seed: 61002, par: 6,
    clues: [[6, 5], [9, 4], [10, 3], [12, 5], [13, 4], [19, 2], [20, 7], [21, 6], [23, 5], [24, 6]],
    solution: [0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  }),
  defineLevel({
    id: "crescent-file", title: "新月档案", subtitle: "5 × 5 · 切断与连通", note: "黑格不准相邻；白色区域必须仍能在同一张巡检图上走通。",
    ...EASY, width: 5, height: 5, seed: 61058, par: 6,
    clues: [[2, 7], [4, 7], [7, 6], [11, 5], [12, 6], [15, 7], [18, 6], [19, 8], [21, 3], [23, 2]],
    solution: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
  }),
  defineLevel({
    id: "penumbra-ledger", title: "半影账册", subtitle: "5 × 5 · 交叉读数", note: "一条光线的计数包括线索本身；四向读数只把它算一次。",
    ...MEDIUM, width: 5, height: 5, seed: 61113, par: 6,
    clues: [[3, 2], [7, 4], [8, 4], [10, 7], [16, 3], [18, 3], [20, 5], [22, 3], [23, 4], [24, 6]],
    solution: [0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  }),
  defineLevel({
    id: "eclipse-conduit", title: "日蚀导管", subtitle: "6 × 6 · 长束巡检", note: "长光束会穿过白标和未知格，只有黑格能真正截断它。",
    ...MEDIUM, width: 6, height: 6, seed: 62195, par: 8,
    clues: [[5, 2], [7, 4], [9, 2], [13, 4], [16, 6], [20, 7], [21, 6], [25, 6], [27, 8], [28, 10], [29, 9], [30, 3], [33, 4], [35, 4], [0, 4]],
    solution: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
  }),
  defineLevel({
    id: "totality-watch", title: "全蚀巡界", subtitle: "6 × 6 · 双边光路", note: "当最后一束读数也精确时，检查所有白格是否仍然能彼此抵达。",
    ...HARD, width: 6, height: 6, seed: 62271, par: 8,
    clues: [[0, 6], [1, 5], [2, 10], [4, 10], [10, 7], [11, 5], [13, 6], [14, 10], [15, 7], [16, 10], [17, 8], [24, 2], [26, 9], [29, 7], [31, 2]],
    solution: [0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1],
  }),
]);

export function levelById(id) { return LEVELS.find((level) => level.id === id) ?? null; }
export function nextLevel(level) { const index = LEVELS.findIndex((candidate) => candidate.id === level?.id); return LEVELS[(Math.max(index, 0) + 1) % LEVELS.length]; }
