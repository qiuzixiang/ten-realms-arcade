export const WIDTH = 4;
export const HEIGHT = 4;
export const REGION_SIZE = 4;
export const EDGE_UNKNOWN = 0;
export const EDGE_WALL = 1;
export const EDGE_CLEAR = 2;

export const EDGE_KEYS = Object.freeze([
  ...Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH - 1 }, (_, x) => `v:${y}:${x + 1}`)).flat(),
  ...Array.from({ length: HEIGHT - 1 }, (_, y) => Array.from({ length: WIDTH }, (_, x) => `h:${y + 1}:${x}`)).flat(),
]);
export const CLUES = Object.freeze([3, 2, 2, 3, 3, 2, 2, 3, 3, 2, 2, 3, 3, 2, 2, 3]);
export const SOLUTION = Object.freeze(Object.fromEntries(EDGE_KEYS.map((key) => [key, key.startsWith("h:") ? EDGE_WALL : EDGE_UNKNOWN])));

const edgeValue = (value) => value === EDGE_UNKNOWN || value === EDGE_WALL || value === EDGE_CLEAR;
const indexFor = (x, y) => y * WIDTH + x;
const parseEdge = (key) => {
  const [axis, first, second] = key.split(":");
  const numberA = Number(first); const numberB = Number(second);
  return axis === "v" ? { axis, y: numberA, x: numberB } : { axis, y: numberA, x: numberB };
};

export function freshState() { return Object.freeze({ edges: Object.freeze(Object.fromEntries(EDGE_KEYS.map((key) => [key, EDGE_UNKNOWN]))), moves: 0 }); }
export function normalizeState(value) {
  if (!value || typeof value !== "object" || !value.edges || typeof value.edges !== "object" || Array.isArray(value.edges)
      || !Number.isInteger(value.moves) || value.moves < 0 || value.moves > 10_000) return null;
  const keys = Object.keys(value.edges).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...EDGE_KEYS].sort()) || !EDGE_KEYS.every((key) => edgeValue(value.edges[key]))) return null;
  return Object.freeze({ edges: Object.freeze(Object.fromEntries(EDGE_KEYS.map((key) => [key, value.edges[key]]))), moves: value.moves });
}

function interiorEdge(x, y, direction) {
  if (direction === "left") return x === 0 ? null : `v:${y}:${x}`;
  if (direction === "right") return x === WIDTH - 1 ? null : `v:${y}:${x + 1}`;
  if (direction === "up") return y === 0 ? null : `h:${y}:${x}`;
  return y === HEIGHT - 1 ? null : `h:${y + 1}:${x}`;
}
function wallAt(edges, x, y, direction) {
  const key = interiorEdge(x, y, direction);
  return key === null || edges[key] === EDGE_WALL;
}
export function boundaryCount(edges, x, y) { return ["left", "right", "up", "down"].filter((direction) => wallAt(edges, x, y, direction)).length; }

export function components(edges) {
  const visited = new Set(); const groups = [];
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    if (visited.has(index)) continue;
    const group = []; const pending = [index];
    while (pending.length) {
      const current = pending.pop(); if (visited.has(current)) continue; visited.add(current); group.push(current);
      const x = current % WIDTH; const y = Math.floor(current / WIDTH);
      if (x > 0 && !wallAt(edges, x, y, "left")) pending.push(indexFor(x - 1, y));
      if (x < WIDTH - 1 && !wallAt(edges, x, y, "right")) pending.push(indexFor(x + 1, y));
      if (y > 0 && !wallAt(edges, x, y, "up")) pending.push(indexFor(x, y - 1));
      if (y < HEIGHT - 1 && !wallAt(edges, x, y, "down")) pending.push(indexFor(x, y + 1));
    }
    groups.push(Object.freeze(group.sort((a, b) => a - b)));
  }
  return Object.freeze(groups);
}
export function analyze(edges) {
  const clueErrors = new Set(); const clueOverflows = new Set();
  CLUES.forEach((clue, index) => {
    const count = boundaryCount(edges, index % WIDTH, Math.floor(index / WIDTH));
    if (count !== clue) clueErrors.add(index);
    if (count > clue) clueOverflows.add(index);
  });
  const groups = components(edges);
  return Object.freeze({ groups, clueErrors, clueOverflows, validSizes: groups.every((group) => group.length === REGION_SIZE) });
}
export function isComplete(state) {
  const report = analyze(state.edges);
  return report.clueErrors.size === 0 && report.validSizes;
}
export function setEdge(state, key, value) {
  if (!EDGE_KEYS.includes(key) || !edgeValue(value) || state.edges[key] === value) return null;
  return normalizeState({ edges: { ...state.edges, [key]: value }, moves: state.moves + 1 });
}
export function cycleEdge(state, key) {
  const current = state.edges[key];
  return setEdge(state, key, current === EDGE_UNKNOWN ? EDGE_WALL : current === EDGE_WALL ? EDGE_CLEAR : EDGE_UNKNOWN);
}

function svgLine(key, value) {
  const { axis, x, y } = parseEdge(key);
  if (value !== EDGE_WALL && value !== EDGE_CLEAR) return "";
  const x1 = axis === "v" ? x * 92 + 18 : 18 + x * 92;
  const y1 = axis === "v" ? 18 + y * 92 : y * 92 + 18;
  const x2 = axis === "v" ? x1 : x1 + 92;
  const y2 = axis === "v" ? y1 + 92 : y1;
  return `<path d=\"M ${x1} ${y1} L ${x2} ${y2}\" stroke=\"${value === EDGE_WALL ? "#ffd77a" : "#6d9eaa"}\" stroke-width=\"${value === EDGE_WALL ? 7 : 3}\" ${value === EDGE_CLEAR ? "stroke-dasharray=\"6 6\"" : ""}/>`;
}
export function tutorialSvg(edges, { highlight = "", caption = "群岛边防署" } = {}) {
  const cells = CLUES.map((clue, index) => { const x = index % WIDTH; const y = Math.floor(index / WIDTH); return `<g data-cell=\"${index}\"><rect x=\"${18 + x * 92}\" y=\"${18 + y * 92}\" width=\"92\" height=\"92\" fill=\"${(x + y) % 2 ? "#194456" : "#1f5464"}\"/><text x=\"${64 + x * 92}\" y=\"${75 + y * 92}\" text-anchor=\"middle\" fill=\"#effffb\" font-size=\"35\" font-family=\"Georgia\">${clue}</text></g>`; }).join("");
  const highlightPath = highlight ? `<path d=\"${highlight}\" fill=\"none\" stroke=\"#fff4bd\" stroke-width=\"13\" opacity=\".55\"/>` : "";
  return `<svg xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-label=\"${caption}\" viewBox=\"0 0 404 404\" preserveAspectRatio=\"xMidYMid meet\" data-game=\"palisade\" data-state=\"${caption}\"><rect width=\"404\" height=\"404\" rx=\"26\" fill=\"#10212d\"/>${cells}<rect x=\"18\" y=\"18\" width=\"368\" height=\"368\" fill=\"none\" stroke=\"#ffd77a\" stroke-width=\"7\"/>${Object.entries(edges).map(([key, value]) => svgLine(key, value)).join("")}${highlightPath}</svg>`;
}
export function tutorialCards() {
  const start = freshState(); const firstWall = setEdge(start, "h:1:0", EDGE_WALL);
  return [
    { tag: "01 · 元素", title: "数字记录这格碰到几道墙", body: "海图每格的数字包含外海边缘与内部巡防墙。外圈金线是永远存在的海岸边界。", bullets: ["所有巡防区人数必须相同", "区域只能通过共享边相连"], svg: tutorialSvg(start.edges, { caption: "群岛边防署真实初始海图" }) },
    { tag: "02 · 操作", title: "点两座岛之间放墙", body: "这是在第一列的上、下两岛间放置的一道真实巡防墙；右键可标注“此处无墙”。", bullets: ["每段边的中点有独立 44px 触控区，交叉点不会和另一条边抢输入", "金色实线是墙，蓝色虚线是你的排除笔记"], svg: tutorialSvg(firstWall.edges, { highlight: "M 18 110 L 110 110", caption: "群岛边防署真实放墙操作" }) },
    { tag: "03 · 通关", title: "每个区恰好四座岛", body: "完成状态里四条横向群岛各自成一个四岛巡防区，所有数字都精确对应相邻墙数。", bullets: ["区域不能只在角上相接", "标注无墙不会替代真实边界"], svg: tutorialSvg(SOLUTION, { caption: "群岛边防署真实完成状态" }) },
  ];
}
