import { generateUniquePuzzle, puzzleSignature } from "./generator.mjs";

export const DIFFICULTIES = Object.freeze([
  Object.freeze({
    id: "cloudlet",
    label: "云絮",
    note: "5 × 5 · 看清行列的第一块浮地",
    tier: 1,
  }),
  Object.freeze({
    id: "ridgewind",
    label: "岭风",
    note: "6 × 6 · 交错候选需要多看一步",
    tier: 2,
  }),
  Object.freeze({
    id: "aurora",
    label: "星穹",
    note: "7 × 7 · 配对与数字同时收紧",
    tier: 3,
  }),
]);

const LEVEL_CONFIGS = Object.freeze([
  Object.freeze({ id: "cotton-meadow", title: "棉云草甸", difficulty: "cloudlet", width: 5, height: 5, seed: 101, minNodes: 5, par: 8 }),
  Object.freeze({ id: "morning-slope", title: "晨风坡", difficulty: "cloudlet", width: 5, height: 5, seed: 203, minNodes: 5, par: 8 }),
  Object.freeze({ id: "chime-cape", title: "风铃岬", difficulty: "cloudlet", width: 5, height: 5, seed: 307, minNodes: 5, par: 8 }),
  Object.freeze({ id: "floating-ridge", title: "浮杉脊", difficulty: "ridgewind", width: 6, height: 6, seed: 401, minNodes: 14, par: 11 }),
  Object.freeze({ id: "stargrass-terrace", title: "星草台", difficulty: "ridgewind", width: 6, height: 6, seed: 503, minNodes: 14, par: 11 }),
  Object.freeze({ id: "sunset-harbor", title: "晚霞港", difficulty: "ridgewind", width: 6, height: 6, seed: 607, minNodes: 14, par: 11 }),
  Object.freeze({ id: "aurora-ring", title: "极光营环", difficulty: "aurora", width: 7, height: 7, seed: 701, minNodes: 25, par: 14 }),
  Object.freeze({ id: "moonless-heights", title: "无月高地", difficulty: "aurora", width: 7, height: 7, seed: 809, minNodes: 25, par: 14 }),
  Object.freeze({ id: "skyline-grove", title: "天穹林线", difficulty: "aurora", width: 7, height: 7, seed: 907, minNodes: 25, par: 14 }),
]);

export const LEVELS = Object.freeze(LEVEL_CONFIGS.map((configuration) => {
  const generated = generateUniquePuzzle({ ...configuration, attempts: 20000 });
  return Object.freeze({
    ...generated.puzzle,
    proofNodes: generated.proof.nodes,
    generationAttempt: generated.attempt,
    signature: puzzleSignature(generated.puzzle),
  });
}));

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function findLevel(levelId) {
  return LEVELS.find((level) => level.id === levelId) ?? null;
}

export function difficultyFor(difficultyId) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === difficultyId) ?? null;
}
