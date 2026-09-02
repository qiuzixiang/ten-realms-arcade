/**
 * Fixed survey sectors.  The mine coordinates are deliberately part of the
 * level contract: `logic.mjs` recomputes every numeric readout from them and
 * its local-inference solver proves that the listed first scan never needs a
 * coin-flip.
 */
export const LEVELS = Object.freeze([
  {
    id: "orbit-window",
    title: "舷窗零校准",
    difficulty: "入门",
    tier: 1,
    seed: 31011,
    width: 5,
    height: 5,
    mines: [4, 10, 20, 24],
    firstSafe: 0,
    par: 4,
  },
  {
    id: "comet-ledger",
    title: "彗尾账本",
    difficulty: "入门",
    tier: 1,
    seed: 31027,
    width: 5,
    height: 5,
    mines: [2, 4, 20, 21, 24],
    firstSafe: 0,
    par: 8,
  },
  {
    id: "ion-shelf",
    title: "离子层架",
    difficulty: "巡测",
    tier: 2,
    seed: 42041,
    width: 6,
    height: 6,
    mines: [5, 11, 18, 26, 30, 31, 35],
    firstSafe: 0,
    par: 11,
  },
  {
    id: "nebula-corridor",
    title: "星云回廊",
    difficulty: "巡测",
    tier: 2,
    seed: 42083,
    width: 6,
    height: 6,
    mines: [5, 11, 12, 18, 25, 29, 33, 35],
    firstSafe: 0,
    par: 15,
  },
  {
    id: "dark-field-array",
    title: "深场阵列",
    difficulty: "深空",
    tier: 3,
    seed: 53019,
    width: 7,
    height: 6,
    mines: [6, 13, 14, 21, 27, 33, 36, 37, 38, 39, 40],
    firstSafe: 0,
    par: 17,
  },
]);

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}
