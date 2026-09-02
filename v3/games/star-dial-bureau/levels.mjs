import { defineLevel } from "./logic.mjs";

/**
 * Every board begins from the ordered 1…16 calibration plate and is produced
 * by this listed sequence of legal 2×2 Twiddle rotations.  `par` is therefore
 * a reproducible inverse replay length, deliberately labelled as a reference
 * rather than a claimed mathematical optimum.
 */
const rawLevels = [
  {
    id: "first-zenith",
    title: "北冠初校",
    subtitle: "一枚偏航的北冠环",
    difficulty: "easy",
    tier: 1,
    seed: 30101,
    scramble: [{ row: 0, column: 0, direction: "cw" }],
  },
  {
    id: "orion-offset",
    title: "猎户偏置",
    subtitle: "三枚相邻星环需要依序回正",
    difficulty: "easy",
    tier: 1,
    seed: 30102,
    scramble: [
      { row: 0, column: 0, direction: "cw" },
      { row: 1, column: 1, direction: "ccw" },
      { row: 2, column: 2, direction: "cw" },
    ],
  },
  {
    id: "lyra-shear",
    title: "织女剪影",
    subtitle: "中层星环被切成错位的旋臂",
    difficulty: "medium",
    tier: 2,
    seed: 30103,
    scramble: [
      { row: 0, column: 1, direction: "ccw" },
      { row: 1, column: 0, direction: "cw" },
      { row: 2, column: 1, direction: "cw" },
      { row: 1, column: 2, direction: "ccw" },
      { row: 0, column: 0, direction: "cw" },
    ],
  },
  {
    id: "perseus-weave",
    title: "英仙织网",
    subtitle: "七次历史偏转交错在星盘上",
    difficulty: "medium",
    tier: 2,
    seed: 30104,
    scramble: [
      { row: 2, column: 0, direction: "cw" },
      { row: 0, column: 2, direction: "ccw" },
      { row: 1, column: 1, direction: "cw" },
      { row: 0, column: 1, direction: "cw" },
      { row: 1, column: 0, direction: "ccw" },
      { row: 2, column: 2, direction: "ccw" },
      { row: 1, column: 2, direction: "cw" },
    ],
  },
  {
    id: "eclipse-lattice",
    title: "蚀影晶格",
    subtitle: "十次偏航后的四层定位晶格",
    difficulty: "hard",
    tier: 3,
    seed: 30105,
    scramble: [
      { row: 0, column: 0, direction: "ccw" },
      { row: 0, column: 2, direction: "cw" },
      { row: 2, column: 0, direction: "ccw" },
      { row: 2, column: 2, direction: "cw" },
      { row: 1, column: 1, direction: "cw" },
      { row: 0, column: 1, direction: "ccw" },
      { row: 1, column: 0, direction: "cw" },
      { row: 1, column: 2, direction: "ccw" },
      { row: 2, column: 1, direction: "cw" },
      { row: 1, column: 1, direction: "ccw" },
    ],
  },
  {
    id: "deep-field-drift",
    title: "深场漂移",
    subtitle: "远空干扰留下十四次可追溯偏转",
    difficulty: "hard",
    tier: 3,
    seed: 30106,
    scramble: [
      { row: 0, column: 1, direction: "cw" },
      { row: 2, column: 1, direction: "ccw" },
      { row: 1, column: 0, direction: "cw" },
      { row: 1, column: 2, direction: "ccw" },
      { row: 0, column: 0, direction: "cw" },
      { row: 2, column: 2, direction: "ccw" },
      { row: 1, column: 1, direction: "cw" },
      { row: 0, column: 2, direction: "cw" },
      { row: 2, column: 0, direction: "ccw" },
      { row: 0, column: 1, direction: "ccw" },
      { row: 2, column: 1, direction: "cw" },
      { row: 1, column: 0, direction: "ccw" },
      { row: 1, column: 2, direction: "cw" },
      { row: 1, column: 1, direction: "ccw" },
    ],
  },
];

export const LEVELS = Object.freeze(rawLevels.map(defineLevel));
export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);
export const DEFAULT_LEVEL_ID = "first-zenith";

export function findLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function firstLevel(difficulty = "easy") {
  return LEVELS.find((level) => level.difficulty === difficulty) ?? LEVELS[0];
}

export function levelsForDifficulty(difficulty) {
  return Object.freeze(LEVELS.filter((level) => level.difficulty === difficulty));
}

export function nextLevel(levelId) {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  return LEVELS[(index + 1 + LEVELS.length) % LEVELS.length];
}
