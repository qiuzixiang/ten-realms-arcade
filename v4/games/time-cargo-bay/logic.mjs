/**
 * 时序货舱 / Fifteen
 *
 * The board deliberately uses the upstream Fifteen movement model: one empty
 * bay, and a click anywhere in the empty bay's row or column slides the whole
 * intervening run.  The 3 × 3 practice manifest is a compact, touch-friendly
 * instance of the same rule set.
 */
export const WIDTH = 3;
export const SIZE = WIDTH * WIDTH;
export const SOLVED_BOARD = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 0]);

const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;

function isPermutation(board) {
  return Array.isArray(board)
    && board.length === SIZE
    && new Set(board).size === SIZE
    && board.every((value) => integer(value, 0, SIZE - 1));
}

function inversions(board) {
  const tiles = board.filter((tile) => tile !== 0);
  let count = 0;
  for (let left = 0; left < tiles.length; left += 1) {
    for (let right = left + 1; right < tiles.length; right += 1) {
      if (tiles[left] > tiles[right]) count += 1;
    }
  }
  return count;
}

/** A 3 × 3 Fifteen board is reachable exactly when its inversion count is even. */
export function isSolvableBoard(board) {
  return isPermutation(board) && inversions(board) % 2 === 0;
}

function freezeState(board, moves = 0) {
  return Object.freeze({ board: Object.freeze([...board]), moves });
}

export function createState(board = SOLVED_BOARD, moves = 0) {
  if (!isSolvableBoard(board) || !integer(moves, 0, 100000)) throw new TypeError("Invalid reachable cargo-board state.");
  return freezeState(board, moves);
}

/** Validate external storage without trusting it as a completion flag. */
export function normalizeState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  if (!isSolvableBoard(candidate.board) || !integer(candidate.moves, 0, 100000)) return null;
  return freezeState(candidate.board, candidate.moves);
}

export function blankIndex(state) {
  const clean = normalizeState(state);
  return clean ? clean.board.indexOf(0) : -1;
}

export function legalTiles(state) {
  const blank = blankIndex(state);
  if (blank < 0) return Object.freeze([]);
  const row = Math.floor(blank / WIDTH);
  const column = blank % WIDTH;
  return Object.freeze(Array.from({ length: SIZE }, (_, index) => index)
    .filter((index) => index !== blank && (Math.floor(index / WIDTH) === row || index % WIDTH === column)));
}

export function isLegalTile(state, index) {
  return integer(index, 0, SIZE - 1) && legalTiles(state).includes(index);
}

/**
 * Move the chosen tile into the empty bay. All tiles between it and the bay
 * move one slot, matching Fifteen's documented row/column click behavior.
 */
export function moveTile(state, index) {
  const clean = normalizeState(state);
  if (!clean || !isLegalTile(clean, index)) return state;
  const blank = clean.board.indexOf(0);
  const step = Math.floor(index / WIDTH) === Math.floor(blank / WIDTH) ? 1 : WIDTH;
  const next = [...clean.board];
  if (index < blank) {
    for (let cursor = blank; cursor > index; cursor -= step) next[cursor] = next[cursor - step];
  } else {
    for (let cursor = blank; cursor < index; cursor += step) next[cursor] = next[cursor + step];
  }
  next[index] = 0;
  return createState(next, clean.moves + 1);
}

/** Direction means the direction the cargo tile travels, as in upstream Fifteen. */
export function moveTileDirection(state, direction) {
  const blank = blankIndex(state);
  if (blank < 0) return state;
  const row = Math.floor(blank / WIDTH);
  const column = blank % WIDTH;
  const targets = {
    up: row < WIDTH - 1 ? blank + WIDTH : -1,
    down: row > 0 ? blank - WIDTH : -1,
    left: column < WIDTH - 1 ? blank + 1 : -1,
    right: column > 0 ? blank - 1 : -1,
  };
  return moveTile(state, targets[direction]);
}

export function isComplete(state) {
  const clean = normalizeState(state);
  return Boolean(clean) && clean.board.every((tile, index) => tile === SOLVED_BOARD[index]);
}

function applySequence(board, indices) {
  return indices.reduce((state, index) => moveTile(state, index), createState(board));
}

// The gameplay manifest is generated from legal slides, never from an
// arbitrary permutation. "Suggested" means this known dispatch script, not a
// claim of shortest-path optimality.
export const START_SEQUENCE = Object.freeze([7, 4, 1, 2, 5, 8, 7, 4, 3, 6]);
export const START_STATE = applySequence(SOLVED_BOARD, START_SEQUENCE);
export const SUGGESTED_STEPS = START_SEQUENCE.length;

export function freshState() {
  return createState(START_STATE.board, 0);
}

export const TUTORIAL_INITIAL = createState([1, 2, 3, 4, 0, 6, 7, 5, 8]);
export const TUTORIAL_AFTER_SLIDE = moveTile(TUTORIAL_INITIAL, 7);
export const TUTORIAL_COMPLETE = moveTile(TUTORIAL_AFTER_SLIDE, 8);

const svgEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function cargoTileSvg(tile, index, focus) {
  const column = index % WIDTH;
  const row = Math.floor(index / WIDTH);
  const x = 116 + column * 104;
  const y = 72 + row * 72;
  const active = focus.includes(index);
  if (tile === 0) {
    return `<g data-cargo-cell="${index}" data-tile="empty"><rect x="${x}" y="${y}" width="88" height="56" rx="12" fill="#07141d" stroke="#74d8ff" stroke-dasharray="5 5"/><path d="M${x + 31} ${y + 28}h26" stroke="#74d8ff" stroke-width="3" stroke-linecap="round"/><text x="${x + 44}" y="${y + 47}" text-anchor="middle" fill="#a9dff6" font-size="10">空舱</text></g>`;
  }
  const fill = active ? "#ffc66d" : "#18334a";
  const stroke = active ? "#fff0bd" : "#7fc7e8";
  return `<g data-cargo-cell="${index}" data-tile="${tile}"><rect x="${x}" y="${y}" width="88" height="56" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${active ? 3 : 1.5}"/><path d="M${x + 14} ${y + 14}h60M${x + 14} ${y + 42}h60" stroke="#d7f5ff" stroke-opacity=".38"/><circle cx="${x + 16}" cy="${y + 28}" r="4" fill="#f6d996"/><text x="${x + 48}" y="${y + 37}" text-anchor="middle" fill="#f8fcff" font-family="ui-monospace, monospace" font-size="24" font-weight="800">${tile}</text></g>`;
}

/** A rule-derived, self-contained SVG: it has no external asset or hidden state. */
export function tutorialSvg(state, { stage, focus = [], annotation = "" } = {}) {
  const clean = normalizeState(state);
  if (!clean) throw new TypeError("Tutorial art requires a real cargo-board state.");
  const label = stage === "elements" ? "真实初始货舱" : stage === "action" ? "一次合法滑运" : "真实归位结果";
  const cells = clean.board.map((tile, index) => cargoTileSvg(tile, index, focus)).join("");
  const action = stage === "action"
    ? '<path d="M94 258V170" stroke="#fff0bd" stroke-width="3" stroke-dasharray="5 5"/><path d="M84 180l10-10 10 10" fill="none" stroke="#fff0bd" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    : stage === "complete"
      ? '<path d="M370 288H266" stroke="#fff0bd" stroke-width="3" stroke-dasharray="5 5"/><path d="M276 278l-10 10 10 10" fill="none" stroke="#fff0bd" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
      : "";
  const actionData = stage === "action" ? ' data-action-from="7" data-action-to="4"' : stage === "complete" ? ' data-action-from="8" data-action-to="7"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 320" role="img" aria-label="${svgEscape(label)}" data-tutorial-game="time-cargo-bay" data-stage="${svgEscape(stage)}" data-board="${clean.board.join(",")}"${actionData} preserveAspectRatio="xMidYMid meet"><rect width="540" height="320" rx="24" fill="#07121b"/><path d="M48 54h444" stroke="#74d8ff" stroke-opacity=".35"/><text x="48" y="37" fill="#ffc66d" font-family="ui-monospace, monospace" font-size="13" font-weight="800">TIME CARGO BAY · ${svgEscape(label)}</text><text x="48" y="283" fill="#b4d9e8" font-family="ui-sans-serif, sans-serif" font-size="13">${svgEscape(annotation)}</text>${cells}${action}</svg>`;
}

export function tutorialCards() {
  if (!isComplete(TUTORIAL_COMPLETE)) throw new Error("Cargo tutorial must end in a true Fifteen completion.");
  return Object.freeze([
    Object.freeze({
      tag: "01 · 认识货签",
      title: "每件货物都有时间编号",
      body: "金属货签要按 1 到 8 的时间顺序归档；虚线的空舱不是货物，而是整次滑运的目标。",
      bullets: Object.freeze(["点空舱同一行或同一列的任意货箱。", "货箱之间的整段会一起移位，计为一次操作。"]),
      svg: tutorialSvg(TUTORIAL_INITIAL, { stage: "elements", focus: [4], annotation: "固定教程关 · 空舱在中央，可选择同列的 5 号货箱" }),
    }),
    Object.freeze({
      tag: "02 · 一次合法滑运",
      title: "让 5 号货箱滑进空舱",
      body: "这张图由同一题面实际执行“选择底行中央的 5 号货箱”得到。它与空舱同列，因此合法。",
      bullets: Object.freeze(["滑运后空舱来到原先的货箱位置。", "相邻和跨越多格的同行、同列选择都遵循同一规则。"]),
      svg: tutorialSvg(TUTORIAL_AFTER_SLIDE, { stage: "action", focus: [7], annotation: "真实动作：moveTile(index: 7) · 5 号货箱上移，空舱下移" }),
    }),
    Object.freeze({
      tag: "03 · 归位通关",
      title: "把空舱留在右下角",
      body: "最后让 8 号货箱滑进空舱。所有编号顺序正确、空舱位于右下角时，货舱才会签收。",
      bullets: Object.freeze(["这张完成图由教程中的第二次合法滑运实际复算。", "首次完成、刷新更少操作数与达到建议步数会计入 4.0 图鉴。"]),
      svg: tutorialSvg(TUTORIAL_COMPLETE, { stage: "complete", focus: [8], annotation: "真实完成：moveTile(index: 8) · 1–8 已归位，空舱在右下" }),
    }),
  ]);
}
