export const WIDTH = 3;
export const HEIGHT = 3;
export const UNKNOWN = 0;
export const SELECTED = 1;
export const EXCLUDED = 2;

export const EDGE_KEYS = Object.freeze([
  ...Array.from({ length: HEIGHT + 1 }, (_, y) => Array.from({ length: WIDTH }, (_, x) => `h:${y}:${x}`)).flat(),
  ...Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH + 1 }, (_, x) => `v:${y}:${x}`)).flat(),
]);
export const CLUES = Object.freeze([2, 1, 2, 1, 0, 1, 2, 1, 2]);
export const SOLUTION = Object.freeze(Object.fromEntries(EDGE_KEYS.map((key) => {
  const [, first, second] = key.split(":"); const y = Number(first); const x = Number(second);
  const selected = key.startsWith("h:") ? y === 0 || y === HEIGHT : x === 0 || x === WIDTH;
  return [key, selected ? SELECTED : UNKNOWN];
})));

const valid = (value) => value === UNKNOWN || value === SELECTED || value === EXCLUDED;
function endpoints(key) {
  const [axis, rawY, rawX] = key.split(":"); const y = Number(rawY); const x = Number(rawX);
  return axis === "h" ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];
}
function nodeKey([x, y]) { return `${x},${y}`; }
function faceEdges(x, y) { return [`h:${y}:${x}`, `h:${y + 1}:${x}`, `v:${y}:${x}`, `v:${y}:${x + 1}`]; }

export function freshState() { return Object.freeze({ edges: Object.freeze(Object.fromEntries(EDGE_KEYS.map((key) => [key, UNKNOWN]))), moves: 0 }); }
export function normalizeState(value) {
  if (!value || typeof value !== "object" || !value.edges || typeof value.edges !== "object" || Array.isArray(value.edges)
      || !Number.isInteger(value.moves) || value.moves < 0 || value.moves > 10_000) return null;
  if (JSON.stringify(Object.keys(value.edges).sort()) !== JSON.stringify([...EDGE_KEYS].sort()) || !EDGE_KEYS.every((key) => valid(value.edges[key]))) return null;
  return Object.freeze({ edges: Object.freeze(Object.fromEntries(EDGE_KEYS.map((key) => [key, value.edges[key]]))), moves: value.moves });
}

export function analyze(edges) {
  const selected = EDGE_KEYS.filter((key) => edges[key] === SELECTED);
  const clueErrors = new Set(); const overflow = new Set();
  CLUES.forEach((clue, index) => {
    const count = faceEdges(index % WIDTH, Math.floor(index / WIDTH)).filter((key) => edges[key] === SELECTED).length;
    if (count !== clue) clueErrors.add(index);
    if (count > clue) overflow.add(index);
  });
  const nodes = new Map();
  for (const key of selected) for (const point of endpoints(key)) {
    const id = nodeKey(point); nodes.set(id, (nodes.get(id) ?? 0) + 1);
  }
  const degreeErrors = new Set([...nodes.entries()].filter(([, degree]) => degree !== 2).map(([node]) => node));
  let connected = false;
  if (selected.length && degreeErrors.size === 0) {
    const adjacency = new Map();
    for (const key of selected) { const [a, b] = endpoints(key).map(nodeKey); (adjacency.get(a) ?? adjacency.set(a, []).get(a)).push(b); (adjacency.get(b) ?? adjacency.set(b, []).get(b)).push(a); }
    const seen = new Set(); const stack = [adjacency.keys().next().value];
    while (stack.length) { const node = stack.pop(); if (seen.has(node)) continue; seen.add(node); for (const next of adjacency.get(node) ?? []) stack.push(next); }
    connected = seen.size === adjacency.size;
  }
  return Object.freeze({ selected, clueErrors, overflow, degreeErrors, singleLoop: selected.length > 0 && degreeErrors.size === 0 && connected });
}
export function isComplete(state) { const report = analyze(state.edges); return report.singleLoop && report.clueErrors.size === 0; }
export function setEdge(state, key, value) { if (!EDGE_KEYS.includes(key) || !valid(value) || state.edges[key] === value) return null; return normalizeState({ edges: { ...state.edges, [key]: value }, moves: state.moves + 1 }); }
export function cycleEdge(state, key) { const current = state.edges[key]; return setEdge(state, key, current === UNKNOWN ? SELECTED : current === SELECTED ? EXCLUDED : UNKNOWN); }

function svgLine(key, state) {
  if (state === UNKNOWN) return "";
  const [[x1, y1], [x2, y2]] = endpoints(key); const scale = 104; const inset = 46;
  return `<path d=\"M ${inset + x1 * scale} ${inset + y1 * scale} L ${inset + x2 * scale} ${inset + y2 * scale}\" stroke=\"${state === SELECTED ? "#f0ccff" : "#6c6387"}\" stroke-width=\"${state === SELECTED ? 9 : 4}\" stroke-linecap=\"round\" ${state === EXCLUDED ? "stroke-dasharray=\"7 7\"" : ""}/>`;
}
export function tutorialSvg(edges, { highlight = "", caption = "月潮结界" } = {}) {
  const grid = Array.from({ length: HEIGHT + 1 }, (_, y) => `<path d=\"M 46 ${46 + y * 104} H 358\" stroke=\"#ffffff25\"/>`).join("") + Array.from({ length: WIDTH + 1 }, (_, x) => `<path d=\"M ${46 + x * 104} 46 V 358\" stroke=\"#ffffff25\"/>`).join("");
  const clues = CLUES.map((clue, index) => `<text x=\"${98 + (index % WIDTH) * 104}\" y=\"${111 + Math.floor(index / WIDTH) * 104}\" text-anchor=\"middle\" fill=\"#f3e9ff\" font-size=\"32\" font-family=\"Georgia\">${clue}</text>`).join("");
  return `<svg xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-label=\"${caption}\" viewBox=\"0 0 404 404\" preserveAspectRatio=\"xMidYMid meet\" data-game=\"loopy\" data-state=\"${caption}\"><rect width=\"404\" height=\"404\" rx=\"26\" fill=\"#19152b\"/>${grid}${clues}${Object.entries(edges).map(([key, value]) => svgLine(key, value)).join("")}${highlight ? `<path d=\"${highlight}\" stroke=\"#fff3a9\" stroke-width=\"14\" opacity=\".48\"/>` : ""}</svg>`;
}
export function tutorialCards() {
  const start = freshState(); const acted = setEdge(start, "h:0:0", SELECTED);
  return [
    { tag: "01 · 元素", title: "数字写着这一格要碰几条潮线", body: "每个圆印记只计算包围它的四条边中，被选入结界的数量。0 表示这格四边都不在环上。", bullets: ["紫色线是待定边", "排除态使用虚线，不与选择态混淆"], svg: tutorialSvg(start.edges, { caption: "月潮结界真实初始局" }) },
    { tag: "02 · 操作", title: "点一条边，纳入月潮", body: "这是对顶边做的一次真实选择。每条边可依次变为选择、排除、待定；右键会直接排除。", bullets: ["每段边的中点都有独立 44px 触控区，交叉点不会抢走另一条边", "单条选线还不是完整结界"], svg: tutorialSvg(acted.edges, { highlight: "M 46 46 H 150", caption: "月潮结界真实选边操作" }) },
    { tag: "03 · 通关", title: "只能有一条无岔的闭环", body: "完成状态同时满足所有数字，且全部选边首尾相接为唯一一条闭环，没有短环或分支。", bullets: ["任何结点的选线数只能是 0 或 2", "多个独立小环不能通关"], svg: tutorialSvg(SOLUTION, { caption: "月潮结界真实完成状态" }) },
  ];
}
