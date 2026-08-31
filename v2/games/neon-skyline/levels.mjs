import { createPuzzle } from "./logic.mjs";

const definitions = [
  {
    id: "aurora-crossing", difficulty: "block", title: "极光十字口",
    subtitle: "全域观测 · 4×4", note: "四面观测站全部在线", size: 4, par: 16,
    clues: { top: [4, 3, 2, 1], bottom: [1, 2, 2, 2], left: [4, 3, 2, 1], right: [1, 2, 2, 2] },
    givens: [],
    solution: [[1, 2, 3, 4], [2, 3, 4, 1], [3, 4, 1, 2], [4, 1, 2, 3]],
  },
  {
    id: "cyan-avenue", difficulty: "block", title: "青蓝大街",
    subtitle: "单点熄灯 · 4×4", note: "一处观测点离线", size: 4, par: 16,
    clues: { top: [2, 3, 2, 1], bottom: [3, 1, 2, 2], left: [3, 1, 2, 2], right: [1, null, 2, 2] },
    givens: [],
    solution: [[2, 1, 3, 4], [4, 3, 1, 2], [3, 2, 4, 1], [1, 4, 2, 3]],
  },
  {
    id: "harbor-grid", difficulty: "block", title: "港湾方格",
    subtitle: "双点熄灯 · 4×4", note: "辨认遮挡方向", size: 4, par: 16,
    clues: { top: [1, 3, 3, 2], bottom: [4, 2, 1, 2], left: [1, 2, 2, 3], right: [2, null, null, 2] },
    givens: [],
    solution: [[4, 1, 2, 3], [3, 2, 1, 4], [2, 4, 3, 1], [1, 3, 4, 2]],
  },
  {
    id: "pulse-midtown", difficulty: "district", title: "脉冲中城",
    subtitle: "缺失观测 · 5×5", note: "两座基准塔已锁定", size: 5, par: 23,
    clues: { top: [2, null, null, 3, 4], bottom: [2, 2, null, 2, 1], left: [null, 2, 1, null, 3], right: [3, null, 2, null, 1] },
    givens: [{ row: 1, column: 2, value: 1 }, { row: 3, column: 4, value: 3 }],
    solution: [[4, 3, 5, 2, 1], [3, 5, 1, 4, 2], [5, 1, 2, 3, 4], [1, 2, 4, 5, 3], [2, 4, 3, 1, 5]],
  },
  {
    id: "loop-interchange", difficulty: "district", title: "环线立交",
    subtitle: "稀疏观测 · 5×5", note: "三座基准塔贯通城区", size: 5, par: 22,
    clues: { top: [2, 1, null, 3, 2], bottom: [null, 4, 3, 1, 3], left: [null, 3, null, null, 2], right: [2, null, null, null, 2] },
    givens: [{ row: 1, column: 3, value: 4 }, { row: 2, column: 2, value: 2 }, { row: 4, column: 1, value: 1 }],
    solution: [[3, 5, 1, 2, 4], [2, 3, 5, 4, 1], [1, 4, 2, 3, 5], [5, 2, 4, 1, 3], [4, 1, 3, 5, 2]],
  },
  {
    id: "prism-quarter", difficulty: "district", title: "棱镜城区",
    subtitle: "断续观测 · 5×5", note: "用预填塔补全视线", size: 5, par: 22,
    clues: { top: [3, null, 3, 2, 1], bottom: [2, null, null, 2, null], left: [null, 2, 3, 1, 3], right: [null, 3, null, null, null] },
    givens: [{ row: 0, column: 1, value: 3 }, { row: 1, column: 3, value: 3 }, { row: 2, column: 0, value: 2 }],
    solution: [[1, 3, 2, 4, 5], [4, 5, 1, 3, 2], [2, 1, 4, 5, 3], [5, 2, 3, 1, 4], [3, 4, 5, 2, 1]],
  },
  {
    id: "zenith-sector", difficulty: "megacity", title: "天穹扇区",
    subtitle: "低密观测 · 6×6", note: "四座地标锚定天际线", size: 6, par: 32,
    clues: { top: [null, null, null, 5, 2, 3], bottom: [2, null, null, null, 4, null], left: [null, 3, 1, 2, 3, null], right: [3, null, 4, null, null, null] },
    givens: [{ row: 2, column: 1, value: 4 }, { row: 3, column: 0, value: 3 }, { row: 4, column: 3, value: 5 }, { row: 5, column: 5, value: 4 }],
    solution: [[1, 5, 6, 2, 4, 3], [2, 1, 4, 3, 6, 5], [6, 4, 5, 1, 3, 2], [3, 6, 2, 4, 5, 1], [4, 3, 1, 5, 2, 6], [5, 2, 3, 6, 1, 4]],
  },
  {
    id: "monolith-core", difficulty: "megacity", title: "巨塔核心",
    subtitle: "暗区观测 · 6×6", note: "五座地标切开暗区", size: 6, par: 31,
    clues: { top: [3, null, 2, null, null, 1], bottom: [null, null, null, null, 2, 5], left: [null, null, 1, null, null, 4], right: [null, null, 2, 3, null, 2] },
    givens: [{ row: 0, column: 4, value: 4 }, { row: 1, column: 0, value: 4 }, { row: 2, column: 3, value: 1 }, { row: 4, column: 1, value: 2 }, { row: 5, column: 5, value: 2 }],
    solution: [[2, 1, 3, 5, 4, 6], [4, 5, 6, 2, 3, 1], [6, 3, 4, 1, 2, 5], [1, 6, 2, 3, 5, 4], [5, 2, 1, 4, 6, 3], [3, 4, 5, 6, 1, 2]],
  },
  {
    id: "crown-metropolis", difficulty: "megacity", title: "冠冕都会",
    subtitle: "极低密观测 · 6×6", note: "六座地标守住全城", size: 6, par: 30,
    clues: { top: [2, null, 3, 3, null, null], bottom: [2, null, 2, null, null, null], left: [null, 1, null, 5, null, null], right: [null, 4, null, null, null, 3] },
    givens: [{ row: 0, column: 4, value: 3 }, { row: 1, column: 3, value: 3 }, { row: 2, column: 0, value: 2 }, { row: 3, column: 2, value: 4 }, { row: 4, column: 5, value: 4 }, { row: 5, column: 1, value: 6 }],
    solution: [[4, 5, 2, 1, 3, 6], [6, 2, 5, 3, 4, 1], [2, 4, 3, 6, 1, 5], [1, 3, 4, 5, 6, 2], [3, 1, 6, 2, 5, 4], [5, 6, 1, 4, 2, 3]],
  },
];

export const LEVELS = Object.freeze(definitions.map(createPuzzle));

export function findLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}
