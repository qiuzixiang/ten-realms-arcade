export const SIZE = 4;
export const WHITE = 0;
export const BLACK = 1;
export const CIRCLED = 2;

export const PRINTS = Object.freeze([
  1, 1, 2, 3,
  2, 3, 4, 1,
  3, 4, 1, 2,
  4, 2, 3, 4,
]);
export const PRACTICE_SOLUTION = Object.freeze([WHITE, BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, BLACK]);

const validMode = (value) => value === WHITE || value === BLACK || value === CIRCLED;
const rows = () => Array.from({ length: SIZE }, (_, row) => Array.from({ length: SIZE }, (_, column) => row * SIZE + column));
const columns = () => Array.from({ length: SIZE }, (_, column) => Array.from({ length: SIZE }, (_, row) => row * SIZE + column));
const neighbours = (index) => {
  const row = Math.floor(index / SIZE); const column = index % SIZE;
  return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
    .filter(([y, x]) => y >= 0 && y < SIZE && x >= 0 && x < SIZE).map(([y, x]) => y * SIZE + x);
};

export function freshState() { return Object.freeze({ modes: Object.freeze(Array(SIZE * SIZE).fill(WHITE)), moves: 0 }); }
export function normalizeState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.modes) || value.modes.length !== SIZE * SIZE
      || !value.modes.every(validMode) || !Number.isInteger(value.moves) || value.moves < 0 || value.moves > 10_000) return null;
  return Object.freeze({ modes: Object.freeze([...value.modes]), moves: value.moves });
}

export function analyze(modes) {
  const errors = new Set(); const duplicate = new Set(); const touching = new Set();
  for (const line of [...rows(), ...columns()]) {
    const seen = new Map();
    for (const index of line) {
      if (modes[index] === BLACK) continue;
      const number = PRINTS[index];
      const previous = seen.get(number);
      if (previous !== undefined) { errors.add(index); errors.add(previous); duplicate.add(index); duplicate.add(previous); }
      else seen.set(number, index);
    }
  }
  modes.forEach((mode, index) => {
    if (mode !== BLACK) return;
    for (const nearby of neighbours(index)) if (modes[nearby] === BLACK) { errors.add(index); errors.add(nearby); touching.add(index); touching.add(nearby); }
  });
  const white = modes.map((mode, index) => mode === BLACK ? -1 : index).filter((index) => index >= 0);
  const visited = new Set();
  if (white.length) {
    const stack = [white[0]];
    while (stack.length) { const index = stack.pop(); if (visited.has(index)) continue; visited.add(index); for (const nearby of neighbours(index)) if (modes[nearby] !== BLACK) stack.push(nearby); }
  }
  const disconnected = new Set(white.filter((index) => !visited.has(index)));
  disconnected.forEach((index) => errors.add(index));
  return Object.freeze({ valid: errors.size === 0, errors, duplicate, touching, disconnected, blackCount: modes.filter((mode) => mode === BLACK).length });
}

export function isComplete(state) { return analyze(state.modes).valid; }
export function setMode(state, index, mode) {
  if (!Number.isInteger(index) || index < 0 || index >= SIZE * SIZE || !validMode(mode) || state.modes[index] === mode) return null;
  const modes = [...state.modes]; modes[index] = mode;
  return normalizeState({ modes, moves: state.moves + 1 });
}
export function cycleMode(state, index) {
  const mode = state.modes[index];
  return setMode(state, index, mode === WHITE ? BLACK : mode === BLACK ? CIRCLED : WHITE);
}

function svgCell(index, mode, highlight) {
  const row = Math.floor(index / SIZE); const column = index % SIZE;
  const x = 18 + column * 92; const y = 18 + row * 92;
  const black = mode === BLACK;
  return `<g data-cell=\"${index}\"><rect x=\"${x}\" y=\"${y}\" width=\"78\" height=\"78\" rx=\"15\" fill=\"${black ? "#322239" : "#eadfce"}\" stroke=\"${highlight === index ? "#f0b5ee" : "#ffffff55"}\" stroke-width=\"${highlight === index ? 4 : 1}\"/>${black ? `<path d=\"M ${x + 11} ${y + 13} L ${x + 67} ${y + 65} M ${x + 67} ${y + 13} L ${x + 11} ${y + 65}\" stroke=\"#9b719b\" stroke-width=\"5\"/>` : ""}${mode === CIRCLED ? `<circle cx=\"${x + 39}\" cy=\"${y + 39}\" r=\"27\" fill=\"none\" stroke=\"#6a4b71\" stroke-width=\"3\"/>` : ""}<text x=\"${x + 39}\" y=\"${y + 54}\" text-anchor=\"middle\" fill=\"${black ? "#d9bbdc" : "#302537"}\" font-size=\"34\" font-family=\"Georgia\">${PRINTS[index]}</text></g>`;
}
export function tutorialSvg(modes, { highlight = null, caption = "影印净化室" } = {}) {
  return `<svg xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-label=\"${caption}\" viewBox=\"0 0 404 404\" preserveAspectRatio=\"xMidYMid meet\" data-game=\"singles\" data-state=\"${caption}\"><rect width=\"404\" height=\"404\" rx=\"26\" fill=\"#171020\"/>${modes.map((mode, index) => svgCell(index, mode, highlight)).join("")}</svg>`;
}
export function tutorialCards() {
  const start = freshState(); const acted = setMode(start, 1, BLACK);
  return [
    { tag: "01 · 元素", title: "重复印记藏在白纸里", body: "每一张格纸都有数字印记。遮罩纹理表示被屏蔽的黑格；圈注只是玩家笔记，不会改变规则。", bullets: ["白格的每一行、列不能留重复数字", "状态同时有数字、纹理与圈注，不只靠色彩"], svg: tutorialSvg(start.modes, { caption: "影印净化室真实初始局" }) },
    { tag: "02 · 操作", title: "先屏蔽一张重复印记", body: "第一行有两枚 1；这是一次真实操作，把第 2 格变为带斜纹的黑格。", bullets: ["点按可在白格、黑格、圈注之间循环", "相邻黑格会被立即标为冲突"], svg: tutorialSvg(acted.modes, { highlight: 1, caption: "影印净化室真实屏蔽操作" }) },
    { tag: "03 · 通关", title: "白纸要完整连通", body: "完成状态同时去除了横竖重复、避免黑格相邻，并保持所有白格可以沿边相通。", bullets: ["白格只在角上接触不算连通", "圈注不参与通关判定"], svg: tutorialSvg(PRACTICE_SOLUTION, { caption: "影印净化室真实完成状态" }) },
  ];
}
