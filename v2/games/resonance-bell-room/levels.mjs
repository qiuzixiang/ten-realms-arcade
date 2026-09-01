import { solveMinimum, validateLevel } from "./logic.mjs";

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "easy", label: "入门 · 九钟", tier: 1, note: "3×3 钟阵，影响纹样短而清楚" }),
  Object.freeze({ id: "medium", label: "进阶 · 十六钟", tier: 2, note: "4×4 钟阵，需要组合多枚回响" }),
  Object.freeze({ id: "hard", label: "大师 · 廿五钟", tier: 3, note: "5×5 钟阵，局部敲击牵动全局" }),
]);

function hashSeed(text) {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomUnit(state) {
  let next = state.value || 0x9e3779b9;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  state.value = next >>> 0;
  return state.value / 0x100000000;
}

function neighbours(width, height, index) {
  const row = Math.floor(index / width);
  const column = index % width;
  return [
    row > 0 ? index - width : -1,
    column + 1 < width ? index + 1 : -1,
    row + 1 < height ? index + width : -1,
    column > 0 ? index - 1 : -1,
  ].filter((candidate) => candidate >= 0);
}

function growTemplate(width, height, origin, minimumSize, seed, occupiedSignatures) {
  const size = width * height;
  const state = { value: hashSeed(`${seed}:${origin}`) };
  const chosen = new Set([origin]);
  const targetSize = Math.min(size, minimumSize + ((origin + state.value) % 3));
  while (chosen.size < targetSize) {
    const frontier = [...new Set([...chosen].flatMap((index) => neighbours(width, height, index)))]
      .filter((index) => !chosen.has(index));
    const pool = frontier.length ? frontier : Array.from({ length: size }, (_, index) => index).filter((index) => !chosen.has(index));
    chosen.add(pool[Math.floor(randomUnit(state) * pool.length)]);
  }

  let template = [...chosen].sort((left, right) => left - right);
  let signature = template.join(",");
  while (occupiedSignatures.has(signature) && template.length < size) {
    const frontier = [...new Set(template.flatMap((index) => neighbours(width, height, index)))]
      .filter((index) => !chosen.has(index));
    const pool = frontier.length ? frontier : Array.from({ length: size }, (_, index) => index).filter((index) => !chosen.has(index));
    chosen.add(pool[Math.floor(randomUnit(state) * pool.length)]);
    template = [...chosen].sort((left, right) => left - right);
    signature = template.join(",");
  }
  occupiedSignatures.add(signature);
  return Object.freeze(template);
}

function templatesFor(width, height, minimumSize, seed) {
  const signatures = new Set();
  return Object.freeze(Array.from({ length: width * height }, (_, index) => (
    growTemplate(width, height, index, minimumSize, seed, signatures)
  )));
}

function scrambledInitial(size, templates, authorTaps) {
  const lights = Array(size).fill(1);
  for (const index of authorTaps) {
    for (const target of templates[index]) lights[target] ^= 1;
  }
  return Object.freeze(lights);
}

function defineLevel(specification) {
  const templates = templatesFor(
    specification.width,
    specification.height,
    specification.templateSize,
    specification.templateSeed,
  );
  const initial = scrambledInitial(specification.width * specification.height, templates, specification.authorTaps);
  const base = {
    id: specification.id,
    title: specification.title,
    subtitle: specification.subtitle,
    lore: specification.lore,
    difficulty: specification.difficulty,
    tier: specification.tier,
    width: specification.width,
    height: specification.height,
    templateSeed: specification.templateSeed,
    accent: specification.accent,
    initial,
    templates,
  };
  if (!validateLevel(base)) throw new TypeError(`Invalid fixed level: ${specification.id}`);
  const proof = solveMinimum(base);
  if (!proof.solvable || !proof.minimumProven || proof.minimumTaps < 1) {
    throw new TypeError(`Level lacks an exact non-trivial solution: ${specification.id}`);
  }
  return Object.freeze({
    ...base,
    suggestedMinimum: proof.minimumTaps,
    solutionCount: proof.solutionCount,
    solverRank: proof.rank,
  });
}

export const LEVELS = Object.freeze([
  defineLevel({
    id: "first-awakening",
    title: "初醒九响",
    subtitle: "让沉睡的青铜小钟同时回应",
    lore: "钟房最内圈刚从百年静默中醒来，每枚钟舌都牵着一段不同的共振纹。",
    difficulty: "easy",
    tier: 1,
    width: 3,
    height: 3,
    templateSize: 3,
    templateSeed: "resonance-first-awakening-v1",
    authorTaps: [0, 3, 4, 8],
    accent: "#f4c56a",
  }),
  defineLevel({
    id: "jade-echo",
    title: "碧玉回声",
    subtitle: "辨认九枚玉钟交叠的短波",
    lore: "玉钟不会轰鸣，只把清亮余音送给纹样中标出的同伴。",
    difficulty: "easy",
    tier: 1,
    width: 3,
    height: 3,
    templateSize: 3,
    templateSeed: "resonance-jade-echo-v1",
    authorTaps: [1, 2, 5, 6, 7],
    accent: "#79e0bd",
  }),
  defineLevel({
    id: "moonlit-canon",
    title: "月轮卡农",
    subtitle: "在十六枚银钟间接续月色",
    lore: "每次敲击都会翻转一组独立月纹；先后次序不限，奇偶才决定最后的光。",
    difficulty: "medium",
    tier: 2,
    width: 4,
    height: 4,
    templateSize: 4,
    templateSeed: "resonance-moonlit-canon-v1",
    authorTaps: [0, 2, 5, 7, 8, 11, 14],
    accent: "#9bb8ff",
  }),
  defineLevel({
    id: "amber-procession",
    title: "琥珀巡礼",
    subtitle: "重排古老钟列的金色回响",
    lore: "巡礼钟阵的影响纹更长，但每枚仍只服从自己铭刻的那一幅图。",
    difficulty: "medium",
    tier: 2,
    width: 4,
    height: 4,
    templateSize: 4,
    templateSeed: "resonance-amber-procession-v1",
    authorTaps: [1, 3, 4, 6, 9, 10, 12, 15],
    accent: "#ff9f6e",
  }),
  defineLevel({
    id: "aurora-orchestra",
    title: "极光编钟",
    subtitle: "让廿五道天光在同一瞬汇聚",
    lore: "极光沿钟纹跳跃，远处的钟也可能被一记轻敲同时唤醒。",
    difficulty: "hard",
    tier: 3,
    width: 5,
    height: 5,
    templateSize: 5,
    templateSeed: "resonance-aurora-orchestra-v1",
    authorTaps: [0, 2, 4, 6, 8, 11, 13, 17, 19, 22, 24],
    accent: "#79f2e0",
  }),
  defineLevel({
    id: "cosmic-carillon",
    title: "万象天钟",
    subtitle: "完成钟房最高层的宇宙齐鸣",
    lore: "星轨被刻进廿五枚天钟；只有全部钟面同时亮起，穹顶才会开启。",
    difficulty: "hard",
    tier: 3,
    width: 5,
    height: 5,
    templateSize: 6,
    templateSeed: "resonance-cosmic-carillon-v1",
    authorTaps: [1, 3, 5, 7, 9, 10, 12, 14, 16, 18, 20, 21, 23],
    accent: "#d79cff",
  }),
]);

export const TUTORIAL_LEVEL_ID = "first-awakening";
export const TUTORIAL_OPERATION_INDEX = 4;

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelsByDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function difficultyById(id) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? null;
}
