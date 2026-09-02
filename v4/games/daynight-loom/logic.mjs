export const SIZE = 4;
export const EMPTY = -1;
export const NIGHT = 0;
export const DAY = 1;

// A fixed, verified starter loom. Fixed threads are immutable, just as in
// Unruly; the player chooses the remaining black/white cells.
export const SOLUTION = Object.freeze([
  NIGHT, DAY, NIGHT, DAY,
  DAY, NIGHT, DAY, NIGHT,
  DAY, NIGHT, NIGHT, DAY,
  NIGHT, DAY, DAY, NIGHT,
]);
export const GIVENS = Object.freeze(new Map([[0, NIGHT], [3, DAY], [5, NIGHT], [10, NIGHT], [12, NIGHT], [15, NIGHT]]));

const allowed = (value) => value === EMPTY || value === NIGHT || value === DAY;
const coordinate = (index) => [Math.floor(index / SIZE), index % SIZE];

export function freshState() {
  const cells = Array(SIZE * SIZE).fill(EMPTY);
  for (const [index, value] of GIVENS) cells[index] = value;
  return Object.freeze({ cells: Object.freeze(cells), moves: 0 });
}

export function normalizeState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.cells) || value.cells.length !== SIZE * SIZE
      || !value.cells.every(allowed) || !Number.isInteger(value.moves) || value.moves < 0 || value.moves > 10_000) return null;
  for (const [index, given] of GIVENS) if (value.cells[index] !== given) return null;
  return Object.freeze({ cells: Object.freeze([...value.cells]), moves: value.moves });
}

function lines(cells) {
  const all = [];
  for (let row = 0; row < SIZE; row += 1) all.push(Array.from({ length: SIZE }, (_, column) => row * SIZE + column));
  for (let column = 0; column < SIZE; column += 1) all.push(Array.from({ length: SIZE }, (_, row) => row * SIZE + column));
  return all;
}

export function analyze(cells) {
  const invalid = new Set();
  const balanced = new Set();
  const triples = new Set();
  for (const line of lines(cells)) {
    const values = line.map((index) => cells[index]);
    for (const value of [NIGHT, DAY]) {
      const count = values.filter((item) => item === value).length;
      if (count > SIZE / 2 || (values.every((item) => item !== EMPTY) && count !== SIZE / 2)) {
        line.forEach((index) => { invalid.add(index); balanced.add(index); });
      }
    }
    for (let start = 0; start <= SIZE - 3; start += 1) {
      const run = values.slice(start, start + 3);
      if (run[0] !== EMPTY && run.every((value) => value === run[0])) {
        line.slice(start, start + 3).forEach((index) => { invalid.add(index); triples.add(index); });
      }
    }
  }
  return Object.freeze({ valid: invalid.size === 0, invalid, balanced, triples, filled: cells.filter((value) => value !== EMPTY).length });
}

export function isComplete(state) {
  return state.cells.every((value) => value !== EMPTY) && analyze(state.cells).valid;
}

export function setCell(state, index, value) {
  if (!Number.isInteger(index) || index < 0 || index >= SIZE * SIZE || !allowed(value) || GIVENS.has(index)) return null;
  if (state.cells[index] === value) return null;
  const cells = [...state.cells];
  cells[index] = value;
  return normalizeState({ cells, moves: state.moves + 1 });
}

export function cycleCell(state, index) {
  if (!Number.isInteger(index) || GIVENS.has(index)) return null;
  const current = state.cells[index];
  return setCell(state, index, current === EMPTY ? DAY : current === DAY ? NIGHT : EMPTY);
}

function tile(index, value, options = {}) {
  const [row, column] = coordinate(index);
  const fixed = GIVENS.has(index) ? " fixed" : "";
  const state = value === DAY ? "day" : value === NIGHT ? "night" : "empty";
  const symbol = value === DAY ? "☀" : value === NIGHT ? "☾" : "·";
  const mark = options.highlight === index ? " stroke=\"#ffdc73\" stroke-width=\"4\"" : "";
  return `<g data-cell=\"${index}\"><rect x=\"${column * 92 + 18}\" y=\"${row * 92 + 18}\" width=\"78\" height=\"78\" rx=\"15\" fill=\"${value === DAY ? "#f6da7d" : value === NIGHT ? "#56617e" : "#243046"}\"${mark}/><text x=\"${column * 92 + 57}\" y=\"${row * 92 + 66}\" text-anchor=\"middle\" font-size=\"39\" fill=\"${value === DAY ? "#1c2633" : "#edf5ff"}\" font-family=\"serif\">${symbol}</text><text x=\"${column * 92 + 27}\" y=\"${row * 92 + 35}\" fill=\"#dcecff\" font-size=\"10\">${fixed ? "固定" : state}</text></g>`;
}

export function tutorialSvg(cells, { highlight = null, caption = "昼夜织机" } = {}) {
  return `<svg xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-label=\"${caption}\" viewBox=\"0 0 404 404\" preserveAspectRatio=\"xMidYMid meet\" data-game=\"unruly\" data-state=\"${caption}\"><rect width=\"404\" height=\"404\" rx=\"26\" fill=\"#101522\"/>${cells.map((value, index) => tile(index, value, { highlight })).join("")}</svg>`;
}

export function tutorialCards() {
  const start = freshState();
  const acted = cycleCell(start, 1);
  return [
    { tag: "01 · 元素", title: "织机有昼、夜与未编格", body: "太阳纹是昼线，月纹是夜线；左上角的小标记代表不可修改的固定经线。", bullets: ["每一行与每一列的昼、夜各占一半", "除了颜色，太阳/月亮图案也区分状态"], svg: tutorialSvg(start.cells, { caption: "昼夜织机真实初始局" }) },
    { tag: "02 · 操作", title: "点按空格轮换三种状态", body: "这里对第 2 格做了一次真实左键操作：它从空白变为昼线。右键可以直接改为夜线。", bullets: ["固定格不会响应输入", "同一状态连续三个会立刻被标为冲突"], svg: tutorialSvg(acted.cells, { highlight: 1, caption: "昼夜织机真实合法操作后" }) },
    { tag: "03 · 通关", title: "均衡，且没有三连", body: "这是同一练习局由规则检验为完成的状态：每一行、列各两昼两夜，所有连续三格都不同色。", bullets: ["未填格不能提前通关", "黑白是规则状态；太阳/月亮只是主题外观"], svg: tutorialSvg(SOLUTION, { caption: "昼夜织机真实完成状态" }) },
  ];
}
