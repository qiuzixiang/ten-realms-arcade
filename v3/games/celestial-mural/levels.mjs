import { deriveClues, referenceState, validateLevel } from "./logic.mjs";

const all = (width, height) => Array.from({ length: width * height }, (_, index) => index);
const checker = (width, height, step = 2) => all(width, height).filter((index) => (index + Math.floor(index / width)) % step !== 1);

function mural(rows) {
  return Object.freeze(rows.join("").split("").map((glyph) => glyph === "#" ? 1 : 0));
}

function defineLevel(spec) {
  const referenceMural = mural(spec.rows);
  const basis = { width: spec.width, height: spec.height, referenceMural };
  const fullClues = deriveClues(basis, referenceMural);
  const shown = new Set(spec.shown);
  const level = {
    id: spec.id,
    title: spec.title,
    subtitle: spec.subtitle,
    lore: spec.lore,
    difficulty: spec.difficulty,
    tier: spec.tier,
    width: spec.width,
    height: spec.height,
    referenceMural,
    clues: Object.freeze(fullClues.map((value, index) => shown.has(index) ? value : null)),
    referenceSolution: Object.freeze(referenceMural.map((value, index) => Object.freeze({ index, tool: value ? "black" : "white" }))),
    // Every cell begins empty and every completed board must be explicit.
    // One legal mark changes only one cell, so width × height is a proof of
    // the exact minimum number of non-undo moves (not merely a suggestion).
    par: spec.width * spec.height,
    muralTag: spec.muralTag,
  };
  if (!validateLevel(level) || !referenceState(level)?.complete) throw new TypeError(`Invalid fixed Mosaic level: ${spec.id}`);
  return Object.freeze(level);
}

export const LEVELS = Object.freeze([
  defineLevel({
    id: "dawn-archive",
    title: "晨星档案",
    subtitle: "复原第一块四乘四的晨昏残片",
    lore: "最外层壁画只留下十六格颜料孔；每一个数字都记着周围九格的深色星尘数。",
    difficulty: "easy",
    tier: 1,
    width: 4,
    height: 4,
    rows: [".#..", "###.", ".#.#", "..#."],
    shown: all(4, 4),
    muralTag: "晨星折线",
  }),
  defineLevel({
    id: "moon-river",
    title: "月河流光",
    subtitle: "让弯月与星河重新显影",
    lore: "月河的浅色底料先被风化；以每枚印记周边的深色数量辨认它原本的流向。",
    difficulty: "easy",
    tier: 1,
    width: 5,
    height: 5,
    rows: ["..#..", ".###.", "#...#", ".#.#.", "..#.."],
    shown: all(5, 5).filter((index) => index % 2 === 0 || index === 7 || index === 17),
    muralTag: "月河交汇",
  }),
  defineLevel({
    id: "comet-court",
    title: "彗尾庭院",
    subtitle: "在错落窗格里校正一束长彗尾",
    lore: "庭院穹顶的彗星并不连续，只有把深浅颜料全部落定，轨迹才会从断片间显出。",
    difficulty: "medium",
    tier: 2,
    width: 5,
    height: 5,
    rows: ["#....", ".##..", "..###", "...#.", "....#"],
    shown: checker(5, 5, 3).concat([1, 5, 19, 23]),
    muralTag: "彗尾斜掠",
  }),
  defineLevel({
    id: "aurora-vault",
    title: "极光穹窿",
    subtitle: "让六乘六的极光带再次穿过穹顶",
    lore: "这块穹窿残片保留了部分计数章；它们足够约束局部，却需要你把每一格都明确涂上。",
    difficulty: "medium",
    tier: 2,
    width: 6,
    height: 6,
    rows: [".#..#.", "###.##", ".#..#.", "..##..", ".##.##", "#..#.."],
    shown: checker(6, 6, 3).concat([7, 14, 21, 28]),
    muralTag: "极光折带",
  }),
  defineLevel({
    id: "zenith-restoration",
    title: "天顶复原",
    subtitle: "完成修复室最大的七乘七星图",
    lore: "最后一幅壁画把多条星脉压在同一层石灰下，全部深浅层都必须显影，才能得到真正完成的天象。",
    difficulty: "hard",
    tier: 3,
    width: 7,
    height: 7,
    rows: ["...#...", ".#.###.", "..#.#..", "#######", "..#.#..", ".###.#.", "...#..."],
    shown: checker(7, 7, 3).concat([3, 14, 20, 24, 28, 34, 45]),
    muralTag: "天顶星脉",
  }),
]);

export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);
export const DEFAULT_LEVEL_ID = "dawn-archive";
export const TUTORIAL_LEVEL_ID = "dawn-archive";
export const TUTORIAL_ACTION = Object.freeze({ index: 5, tool: "black" });

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
