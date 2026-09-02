/**
 * 环轨星图台 / Sixteen
 *
 * There is deliberately no empty tile. Each command circularly shifts a full
 * numbered row or column by one cell; the displaced star marker reappears at
 * the opposite end. Victory is the natural 1…16 reading order.
 */
export const WIDTH = 4;
export const SIZE = WIDTH * WIDTH;
export const SOLVED_BOARD = Object.freeze(Array.from({ length: SIZE }, (_, index) => index + 1));

const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;

function isPermutation(board) {
  return Array.isArray(board)
    && board.length === SIZE
    && new Set(board).size === SIZE
    && board.every((value) => integer(value, 1, SIZE));
}

function freezeState(board, moves = 0) {
  return Object.freeze({ board: Object.freeze([...board]), moves });
}

export function createState(board = SOLVED_BOARD, moves = 0) {
  if (!isPermutation(board) || !integer(moves, 0, 100000)) throw new TypeError("Invalid orbit-atlas state.");
  return freezeState(board, moves);
}

export function normalizeState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  if (!isPermutation(candidate.board) || !integer(candidate.moves, 0, 100000)) return null;
  return freezeState(candidate.board, candidate.moves);
}

function shiftIndices(state, positions, direction) {
  const clean = normalizeState(state);
  if (!clean || ![1, -1].includes(direction)) return state;
  const next = [...clean.board];
  for (let offset = 0; offset < positions.length; offset += 1) {
    const target = positions[(offset + direction + positions.length) % positions.length];
    next[target] = clean.board[positions[offset]];
  }
  return createState(next, clean.moves + 1);
}

/** `-1` is left, `+1` is right. */
export function shiftRow(state, row, direction) {
  if (!integer(row, 0, WIDTH - 1)) return state;
  return shiftIndices(state, Array.from({ length: WIDTH }, (_, column) => row * WIDTH + column), direction);
}

/** `-1` is up, `+1` is down. */
export function shiftColumn(state, column, direction) {
  if (!integer(column, 0, WIDTH - 1)) return state;
  return shiftIndices(state, Array.from({ length: WIDTH }, (_, row) => row * WIDTH + column), direction);
}

export function applyShift(state, action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) return state;
  if (action.axis === "row") return shiftRow(state, action.index, action.direction);
  if (action.axis === "column") return shiftColumn(state, action.index, action.direction);
  return state;
}

export function isComplete(state) {
  const clean = normalizeState(state);
  return Boolean(clean) && clean.board.every((value, index) => value === SOLVED_BOARD[index]);
}

function runFromSolved(actions) {
  return actions.reduce((state, action) => applyShift(state, action), createState(SOLVED_BOARD));
}

// A known commissioning script supplies a reproducible practice board. It is
// called a suggested route, never an unproven shortest solution.
export const START_SCRIPT = Object.freeze([
  Object.freeze({ axis: "row", index: 0, direction: 1 }),
  Object.freeze({ axis: "column", index: 2, direction: -1 }),
  Object.freeze({ axis: "row", index: 1, direction: -1 }),
  Object.freeze({ axis: "column", index: 0, direction: 1 }),
  Object.freeze({ axis: "row", index: 3, direction: 1 }),
  Object.freeze({ axis: "column", index: 3, direction: -1 }),
]);
export const START_STATE = runFromSolved(START_SCRIPT);
export const SUGGESTED_STEPS = START_SCRIPT.length;
export function freshState() { return createState(START_STATE.board, 0); }

export const TUTORIAL_INITIAL = runFromSolved([
  { axis: "row", index: 2, direction: -1 },
  { axis: "column", index: 1, direction: 1 },
]);
export const TUTORIAL_AFTER_ACTION = applyShift(TUTORIAL_INITIAL, { axis: "column", index: 1, direction: -1 });
export const TUTORIAL_COMPLETE = applyShift(TUTORIAL_AFTER_ACTION, { axis: "row", index: 2, direction: 1 });

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function starPath(cx, cy, radius) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const distance = index % 2 === 0 ? radius : radius * .43;
    return `${index ? "L" : "M"}${(cx + Math.cos(angle) * distance).toFixed(2)} ${(cy + Math.sin(angle) * distance).toFixed(2)}`;
  }).join("") + "Z";
}

function atlasCellSvg(value, position, focus) {
  const column = position % WIDTH;
  const row = Math.floor(position / WIDTH);
  const x = 131 + column * 76;
  const y = 72 + row * 54;
  const highlighted = (focus?.axis === "row" && focus.index === row) || (focus?.axis === "column" && focus.index === column);
  const hue = 188 + (value % 4) * 18;
  return `<g data-atlas-cell="${position}" data-star="${value}"><rect x="${x}" y="${y}" width="64" height="43" rx="10" fill="hsl(${hue} 43% ${highlighted ? "32" : "22"}%)" stroke="${highlighted ? "#fff0a0" : "#8cccf6"}" stroke-width="${highlighted ? 2.8 : 1.2}"/><path d="${starPath(x + 16, y + 16, 8)}" fill="#f9e89d"/><path d="M${x + 37} ${y + 12}h17M${x + 37} ${y + 31}h17" stroke="#d8f5ff" stroke-opacity=".34"/><text x="${x + 45}" y="${y + 27}" text-anchor="middle" fill="#f8fcff" font-family="ui-monospace, monospace" font-size="16" font-weight="800">${value}</text></g>`;
}

/** Exact, generated star-map art for the three tutorial cards. */
export function tutorialSvg(state, { stage, focus = null, annotation = "" } = {}) {
  const clean = normalizeState(state);
  if (!clean) throw new TypeError("Tutorial art requires a real Sixteen state.");
  const label = stage === "elements" ? "真实起始星图" : stage === "action" ? "一次整列环移" : "真实校图结果";
  const cells = clean.board.map((value, position) => atlasCellSvg(value, position, focus)).join("");
  const marker = !focus ? "" : focus.axis === "column" && focus.direction < 0
    ? '<path d="M78 228V106" stroke="#fff0a0" stroke-width="3" stroke-dasharray="5 5"/><path d="M68 116l10-10 10 10" fill="none" stroke="#fff0a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    : focus.axis === "column"
      ? '<path d="M78 106v122" stroke="#fff0a0" stroke-width="3" stroke-dasharray="5 5"/><path d="M68 218l10 10 10-10" fill="none" stroke="#fff0a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
      : focus.direction < 0
        ? '<path d="M138 280h104" stroke="#fff0a0" stroke-width="3" stroke-dasharray="5 5"/><path d="M148 270l-10 10 10 10" fill="none" stroke="#fff0a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<path d="M242 280h104" stroke="#fff0a0" stroke-width="3" stroke-dasharray="5 5"/><path d="M336 270l10 10-10 10" fill="none" stroke="#fff0a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
  const actionData = focus ? ` data-action-axis="${focus.axis}" data-action-direction="${focus.direction}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 340" role="img" aria-label="${escapeXml(label)}" data-tutorial-game="orbit-atlas" data-stage="${escapeXml(stage)}" data-board="${clean.board.join(",")}"${actionData} preserveAspectRatio="xMidYMid meet"><rect width="560" height="340" rx="24" fill="#071522"/><text x="42" y="36" fill="#8cccf6" font-family="ui-monospace, monospace" font-size="13" font-weight="800">ORBIT ATLAS · ${escapeXml(label)}</text><rect x="112" y="56" width="344" height="244" rx="20" fill="#0d2738" stroke="#8cccf6" stroke-opacity=".45"/>${marker}${cells}<text x="42" y="321" fill="#bfdce8" font-family="ui-sans-serif, sans-serif" font-size="13">${escapeXml(annotation)}</text></svg>`;
}

export function tutorialCards() {
  if (!isComplete(TUTORIAL_COMPLETE)) throw new Error("Sixteen tutorial must finish in exact sequential order.");
  return Object.freeze([
    Object.freeze({
      tag: "01 · 观察无隙星图",
      title: "十六枚星标，没有空位",
      body: "这里没有可滑入的空格。每枚星标都占据一格；需要通过整行或整列的循环位移，把它们恢复到 1 至 16 的读图顺序。",
      bullets: Object.freeze(["离开一端的星标会从另一端出现。", "星标不能单独移动，也不会被旋转。"]),
      svg: tutorialSvg(TUTORIAL_INITIAL, { stage: "elements", annotation: "固定教程关 · 星标 1–16 尚未回到各自星位" }),
    }),
    Object.freeze({
      tag: "02 · 环移整列",
      title: "把第 2 列向上推动一次",
      body: "这张图由同一题面实际执行“第 2 列向上”得到。顶端离开的星标从最下方回到该列，不存在空格。",
      bullets: Object.freeze(["先选“列轨”和编号，再点方向箭头下达一次指令。", "黄色线标出本次真正移动的整列。"]),
      svg: tutorialSvg(TUTORIAL_AFTER_ACTION, { stage: "action", focus: { axis: "column", index: 1, direction: -1 }, annotation: "真实动作：shiftColumn(index: 1, direction: -1)" }),
    }),
    Object.freeze({
      tag: "03 · 依序校图",
      title: "让 1 至 16 从左到右、从上到下排列",
      body: "最后把第 3 行向右推动一次，全部星标就回到正确的星位。没有空格的完整 4 × 4 顺序才是完成条件。",
      bullets: Object.freeze(["这张完成图由两次真实环移后的棋盘状态复算。", "首次通关、刷新个人最佳和达到建议步数会计入 4.0 图鉴。"]),
      svg: tutorialSvg(TUTORIAL_COMPLETE, { stage: "complete", focus: { axis: "row", index: 2, direction: 1 }, annotation: "真实完成：shiftRow(index: 2, direction: 1) · 1–16 完整归位" }),
    }),
  ]);
}
