import { createPuzzle } from "./logic.mjs";

export const DIFFICULTIES = Object.freeze([
  Object.freeze({
    id: "calibration",
    label: "校准",
    kicker: "POLAR CALIBRATION",
    note: "4 × 4 · 四周线索完整，适合熟悉极性循环",
  }),
  Object.freeze({
    id: "survey",
    label: "巡测",
    kicker: "AURORA SURVEY",
    note: "5 × 4 · 部分列线索缺失，需要交叉推断",
  }),
  Object.freeze({
    id: "storm",
    label: "磁暴",
    kicker: "MAGNETIC STORM",
    note: "5 × 5 / 5 × 6 · 大量线索缺失，含稀有磁暴样本",
  }),
]);

/**
 * Reproducible puzzle seeds. The deterministic generator in createPuzzle()
 * derives visible clues from the stored legal solution, applies an explicit
 * clue mask, and validates the answer against all Magnets invariants. The
 * independent solver proves uniqueness in tests without consulting solution.
 */
export const LEVEL_SPECS = Object.freeze([
  Object.freeze({
    id: "ice-window",
    seed: "aurora-magnet-lab/calibration/ice-window/v1",
    difficulty: "calibration",
    title: "冰窗校极",
    subtitle: "4 × 4 · 8 个横向槽位",
    note: "先从零线索入手：这一整行不能出现对应极性。",
    spectrum: "cyan",
    suggestedMoves: 13,
    layout: Object.freeze(["AABB", "CCDD", "EEFF", "GGHH"]),
    solution: "NNNNRNFF",
  }),
  Object.freeze({
    id: "polar-crossing",
    seed: "aurora-magnet-lab/calibration/polar-crossing/v1",
    difficulty: "calibration",
    title: "极昼交叉",
    subtitle: "4 × 4 · 横竖槽位交织",
    note: "竖槽会同时改变两行计数，落子前先看两侧。",
    spectrum: "mint",
    suggestedMoves: 14,
    layout: Object.freeze(["ABBC", "ADDC", "EEFF", "GGHH"]),
    solution: "NRRNNFRR",
  }),
  Object.freeze({
    id: "ion-ribbon",
    seed: "aurora-magnet-lab/survey/ion-ribbon/v1",
    difficulty: "survey",
    title: "离子光带",
    subtitle: "5 × 4 · 10 个混合槽位",
    note: "破折号代表线索缺失，不等于数字零。",
    spectrum: "violet",
    suggestedMoves: 18,
    layout: Object.freeze(["AABBC", "DDEEC", "FFGGH", "IIJJH"]),
    solution: "FFFNRFNNNR",
    clueMask: Object.freeze({
      rows: Object.freeze({ plus: "1111", minus: "1111" }),
      columns: Object.freeze({ plus: "10000", minus: "11100" }),
    }),
  }),
  Object.freeze({
    id: "green-arc",
    seed: "aurora-magnet-lab/survey/green-arc/v1",
    difficulty: "survey",
    title: "绿弧回波",
    subtitle: "5 × 4 · 纵向回路巡测",
    note: "行线索完整，但列侧只有少量观测数据。",
    spectrum: "emerald",
    suggestedMoves: 19,
    layout: Object.freeze(["ABBCC", "ADDEE", "FFGHH", "IIGJJ"]),
    solution: "FNFFNNNFRN",
    clueMask: Object.freeze({
      rows: Object.freeze({ plus: "1111", minus: "1111" }),
      columns: Object.freeze({ plus: "11010", minus: "01000" }),
    }),
  }),
  Object.freeze({
    id: "red-crown-storm",
    seed: "aurora-magnet-lab/storm/red-crown/v1",
    difficulty: "storm",
    title: "赤冠磁暴",
    subtitle: "5 × 6 · 15 个深舱槽位",
    note: "稀疏线索仍锁定唯一解；优先排除同性相邻。",
    spectrum: "crimson",
    storm: true,
    suggestedMoves: 27,
    layout: Object.freeze(["AABBC", "DDEEC", "FFGGH", "IIJJH", "KKLMM", "NNLOO"]),
    solution: "RRNNNNNNNFNNFNN",
    clueMask: Object.freeze({
      rows: Object.freeze({ plus: "000010", minus: "100100" }),
      columns: Object.freeze({ plus: "00001", minus: "11110" }),
    }),
  }),
  Object.freeze({
    id: "silent-eye-storm",
    seed: "aurora-magnet-lab/storm/silent-eye/v1",
    difficulty: "storm",
    title: "静眼磁暴",
    subtitle: "5 × 5 · 12 个槽位与 1 个固定中性空位",
    note: "中央封闭舱是奇数题盘的固定中性空位，不属于任何槽位。",
    spectrum: "gold",
    storm: true,
    suggestedMoves: 23,
    layout: Object.freeze(["AABBC", "DDEEC", "FF*GG", "HIIJJ", "HKKLL"]),
    solution: "RRNFNRRFRNFF",
    clueMask: Object.freeze({
      rows: Object.freeze({ plus: "10000", minus: "00101" }),
      columns: Object.freeze({ plus: "01011", minus: "01100" }),
    }),
  }),
]);

export const LEVELS = Object.freeze(LEVEL_SPECS.map((definition) => createPuzzle(definition)));

export function findPuzzle(id) {
  return LEVELS.find((puzzle) => puzzle.id === id) ?? null;
}

export function puzzlesForDifficulty(difficulty) {
  return LEVELS.filter((puzzle) => puzzle.difficulty === difficulty);
}

export function difficultyById(id) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? null;
}

export function puzzleAt(difficulty, index = 0) {
  const choices = puzzlesForDifficulty(difficulty);
  if (choices.length === 0) return null;
  const safeIndex = Number.isInteger(index) ? index : 0;
  return choices[((safeIndex % choices.length) + choices.length) % choices.length];
}

export function nextPuzzle(currentPuzzle) {
  const choices = puzzlesForDifficulty(currentPuzzle.difficulty);
  const index = choices.findIndex((puzzle) => puzzle.id === currentPuzzle.id);
  return choices[(index + 1 + choices.length) % choices.length];
}

export function puzzleFingerprint(puzzle) {
  return JSON.stringify({
    seed: puzzle.seed,
    layout: puzzle.rows,
    clues: puzzle.clues,
  });
}
