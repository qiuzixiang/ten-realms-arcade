import { buildPuzzleFromRooms, rectKey, solvePuzzle } from "./logic.mjs";

const DEFINITIONS = [
  {
    id: "lullaby-lobby",
    title: "摇篮前厅",
    subtitle: "月光刚好铺满第一层",
    difficulty: "easy",
    width: 5,
    height: 5,
    seed: "dream-hotel/easy/01/v1",
    clues: [[0, 1, 6], [1, 2, 3], [0, 4, 2], [1, 4, 4], [3, 0, 4], [4, 3, 6]],
    rooms: [[0, 0, 3, 2], [0, 2, 3, 1], [0, 3, 1, 2], [1, 3, 2, 2], [3, 0, 2, 2], [3, 2, 2, 3]],
  },
  {
    id: "cloud-checkin",
    title: "云端入住处",
    subtitle: "六位旅客带来六种轻梦",
    difficulty: "easy",
    width: 5,
    height: 5,
    seed: "dream-hotel/easy/02/v1",
    clues: [[1, 1, 4], [3, 1, 4], [0, 2, 2], [0, 3, 4], [2, 3, 6], [4, 1, 5]],
    rooms: [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 2, 1], [0, 3, 2, 2], [2, 2, 2, 3], [4, 0, 1, 5]],
  },
  {
    id: "starlight-wing",
    title: "星灯西翼",
    subtitle: "长廊与套房第一次交错",
    difficulty: "easy",
    width: 5,
    height: 5,
    seed: "dream-hotel/easy/03/v1",
    clues: [[0, 0, 5], [2, 1, 4], [4, 1, 4], [2, 2, 4], [1, 3, 2], [4, 3, 6]],
    rooms: [[0, 0, 1, 5], [1, 0, 2, 2], [3, 0, 2, 2], [1, 2, 4, 1], [1, 3, 1, 2], [2, 3, 3, 2]],
  },
  {
    id: "rain-library",
    title: "听雨书房层",
    subtitle: "十间客房共享一场长雨",
    difficulty: "medium",
    width: 7,
    height: 7,
    seed: "dream-hotel/medium/01/v1",
    clues: [[1, 0, 3], [5, 0, 3], [1, 1, 2], [4, 1, 4], [0, 2, 2], [2, 2, 6], [2, 5, 12], [4, 4, 10], [6, 1, 2], [6, 6, 5]],
    rooms: [[0, 0, 3, 1], [3, 0, 3, 1], [0, 1, 2, 1], [2, 1, 4, 1], [0, 2, 1, 2], [1, 2, 3, 2], [0, 4, 4, 3], [4, 2, 2, 5], [6, 0, 1, 2], [6, 2, 1, 5]],
  },
  {
    id: "moonlit-arcade",
    title: "月影回廊",
    subtitle: "窄门之后藏着更深的房型",
    difficulty: "medium",
    width: 7,
    height: 7,
    seed: "dream-hotel/medium/02/v1",
    clues: [[1, 1, 6], [3, 0, 2], [3, 1, 2], [5, 0, 2], [2, 2, 6], [4, 3, 4], [0, 4, 5], [5, 2, 3], [3, 6, 12], [6, 5, 7]],
    rooms: [[0, 0, 3, 2], [3, 0, 2, 1], [3, 1, 2, 1], [5, 0, 1, 2], [0, 2, 3, 2], [3, 2, 2, 2], [0, 4, 5, 1], [5, 2, 1, 3], [0, 5, 6, 2], [6, 0, 1, 7]],
  },
  {
    id: "whispering-atrium",
    title: "低语中庭",
    subtitle: "风从不同方向穿过十扇窗",
    difficulty: "medium",
    width: 7,
    height: 7,
    seed: "dream-hotel/medium/03/v1",
    clues: [[0, 2, 3], [0, 3, 2], [2, 0, 5], [1, 1, 4], [4, 2, 6], [3, 4, 10], [6, 4, 5], [0, 6, 2], [1, 6, 8], [6, 6, 4]],
    rooms: [[0, 0, 1, 3], [0, 3, 1, 2], [1, 0, 5, 1], [1, 1, 2, 2], [3, 1, 3, 2], [1, 3, 5, 2], [6, 0, 1, 5], [0, 5, 1, 2], [1, 5, 4, 2], [5, 5, 2, 2]],
  },
  {
    id: "aurora-penthouse",
    title: "极光顶层",
    subtitle: "十四段梦境在高处严丝合缝",
    difficulty: "hard",
    width: 9,
    height: 9,
    seed: "dream-hotel/hard/01/v1",
    clues: [[0, 1, 2], [1, 0, 2], [4, 0, 3], [5, 1, 5], [7, 0, 3], [8, 1, 3], [0, 3, 4], [0, 7, 3], [2, 2, 8], [4, 4, 12], [4, 7, 8], [5, 8, 7], [7, 4, 9], [6, 7, 12]],
    rooms: [[0, 0, 1, 2], [1, 0, 2, 1], [3, 0, 3, 1], [1, 1, 5, 1], [6, 0, 3, 1], [6, 1, 3, 1], [0, 2, 1, 4], [0, 6, 1, 3], [1, 2, 4, 2], [1, 4, 4, 3], [1, 7, 4, 2], [5, 2, 1, 7], [6, 2, 3, 3], [6, 5, 3, 4]],
  },
  {
    id: "comet-ballroom",
    title: "彗星宴会层",
    subtitle: "长桌、窄厅与星尘舞池彼此咬合",
    difficulty: "hard",
    width: 9,
    height: 9,
    seed: "dream-hotel/hard/02/v1",
    clues: [[0, 2, 4], [0, 6, 4], [5, 1, 12], [7, 0, 4], [1, 3, 6], [3, 5, 9], [4, 2, 8], [6, 6, 12], [8, 3, 5], [1, 7, 5], [8, 7, 3], [3, 8, 5], [5, 8, 2], [7, 8, 2]],
    rooms: [[0, 0, 1, 4], [0, 4, 1, 4], [1, 0, 6, 2], [7, 0, 2, 2], [1, 2, 3, 2], [1, 4, 3, 3], [4, 2, 4, 2], [4, 4, 4, 3], [8, 2, 1, 5], [1, 7, 5, 1], [6, 7, 3, 1], [0, 8, 5, 1], [5, 8, 2, 1], [7, 8, 2, 1]],
  },
  {
    id: "infinite-observatory",
    title: "无垠观星台",
    subtitle: "最深的一夜需要最精确的规划",
    difficulty: "hard",
    width: 9,
    height: 9,
    seed: "dream-hotel/hard/03/v1",
    clues: [[0, 0, 2], [2, 1, 4], [7, 0, 12], [3, 2, 8], [5, 3, 10], [0, 6, 4], [1, 4, 8], [3, 5, 8], [5, 6, 6], [7, 5, 3], [6, 7, 3], [8, 7, 4], [6, 8, 7], [7, 8, 2]],
    rooms: [[0, 0, 1, 2], [1, 0, 2, 2], [3, 0, 6, 2], [0, 2, 4, 2], [4, 2, 5, 2], [0, 4, 1, 4], [1, 4, 2, 4], [3, 4, 2, 4], [5, 4, 2, 3], [7, 4, 1, 3], [5, 7, 3, 1], [8, 4, 1, 4], [0, 8, 7, 1], [7, 8, 2, 1]],
  },
];

function materialize(definition) {
  const rooms = definition.rooms.map(([x, y, width, height], index) => {
    const [clueX, clueY, value] = definition.clues[index];
    if (width * height !== value) throw new TypeError(`Clue/room mismatch in ${definition.id}`);
    return { x, y, width, height, clue: { x: clueX, y: clueY } };
  });
  const puzzle = buildPuzzleFromRooms({ ...definition, rooms });
  const proof = solvePuzzle(puzzle, { limit: 2 });
  if (!proof.unique) throw new TypeError(`${definition.id} is not uniquely solvable`);
  const expected = new Set(puzzle.solution.map(rectKey));
  const actual = new Set(proof.solutions[0].map(rectKey));
  if (expected.size !== actual.size || [...expected].some((key) => !actual.has(key))) {
    throw new TypeError(`${definition.id} solver result differs from its authored tiling`);
  }
  return Object.freeze({
    ...puzzle,
    clues: Object.freeze(puzzle.clues.map((clue) => Object.freeze({ ...clue }))),
    solution: Object.freeze(puzzle.solution.map((room) => Object.freeze({ ...room }))),
    proof: Object.freeze({ unique: true, nodes: proof.nodes, version: "exact-cover-v1" }),
  });
}

export const LEVELS = Object.freeze(DEFINITIONS.map(materialize));
const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]));

export function getLevel(id) {
  return LEVEL_BY_ID.get(id) ?? null;
}

export function getLevels(difficulty) {
  return LEVELS.filter((level) => !difficulty || level.difficulty === difficulty);
}

export function nextLevel(currentId, difficulty) {
  const levels = getLevels(difficulty);
  const index = levels.findIndex((level) => level.id === currentId);
  return levels[(index + 1 + levels.length) % levels.length] ?? LEVELS[0];
}
