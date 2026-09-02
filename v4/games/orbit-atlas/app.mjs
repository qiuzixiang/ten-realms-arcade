import { mountPuzzle } from "../../shared/game-kit.mjs";
import {
  SUGGESTED_STEPS, WIDTH, applyShift, freshState, isComplete, normalizeState, tutorialCards,
} from "./logic.mjs";

let selectedAxis = "row";
let selectedIndex = 0;

function axisText(axis) { return axis === "row" ? "行轨" : "列轨"; }
function directionText(axis, direction) {
  if (axis === "row") return direction > 0 ? "向右" : "向左";
  return direction > 0 ? "向下" : "向上";
}

function tokenMarkup(value) {
  const constellation = ["✦", "✧", "✶", "✹"][value % 4];
  return `<i aria-hidden="true">${constellation}</i><b>${value}</b><small>星标</small>`;
}

function renderBoard({ board, state, completed, commit, toast }) {
  board.className = "v4-board atlas-console";
  const grid = document.createElement("div");
  grid.className = "atlas-grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "环轨星图 4 乘 4；使用下方指令台环移整行或整列");
  const tokens = [];
  for (let position = 0; position < state.board.length; position += 1) {
    const row = Math.floor(position / WIDTH);
    const column = position % WIDTH;
    const token = document.createElement("div");
    token.className = "atlas-token";
    token.setAttribute("role", "gridcell");
    token.dataset.row = String(row);
    token.dataset.column = String(column);
    token.setAttribute("aria-rowindex", String(row + 1));
    token.setAttribute("aria-colindex", String(column + 1));
    token.setAttribute("aria-label", `第 ${row + 1} 行第 ${column + 1} 列，${state.board[position]} 号星标`);
    token.innerHTML = tokenMarkup(state.board[position]);
    tokens.push(token);
    grid.append(token);
  }

  const deck = document.createElement("section");
  deck.className = "atlas-command-deck";
  deck.setAttribute("aria-label", "星图环移指令台");
  deck.innerHTML = '<p>选择一条轨道，再执行一次环移</p>';
  const axisList = document.createElement("div"); axisList.className = "atlas-selector atlas-axis-selector";
  const lineList = document.createElement("div"); lineList.className = "atlas-selector atlas-line-selector";
  const directionList = document.createElement("div"); directionList.className = "atlas-selector atlas-direction-selector";
  const axisButtons = [];
  const lineButtons = [];
  const directionButtons = [];

  const updateSelection = () => {
    axisButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.axis === selectedAxis)));
    lineButtons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.index) === selectedIndex)));
    tokens.forEach((token) => {
      const match = selectedAxis === "row" ? Number(token.dataset.row) === selectedIndex : Number(token.dataset.column) === selectedIndex;
      token.classList.toggle("is-selected-line", match);
    });
    directionButtons.forEach((button) => {
      const direction = Number(button.dataset.direction);
      const glyph = selectedAxis === "row" ? (direction > 0 ? "→" : "←") : (direction > 0 ? "↓" : "↑");
      button.querySelector("span").textContent = glyph;
      button.setAttribute("aria-label", `让第 ${selectedIndex + 1} ${axisText(selectedAxis)}${directionText(selectedAxis, direction)}环移`);
      button.title = button.getAttribute("aria-label");
    });
  };

  for (const [axis, label] of [["row", "行轨"], ["column", "列轨"]]) {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.axis = axis; button.textContent = label;
    button.addEventListener("click", () => { selectedAxis = axis; updateSelection(); });
    axisButtons.push(button); axisList.append(button);
  }
  for (let index = 0; index < WIDTH; index += 1) {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.index = String(index); button.textContent = String(index + 1);
    button.setAttribute("aria-label", `选择第 ${index + 1} 条轨道`);
    button.addEventListener("click", () => { selectedIndex = index; updateSelection(); });
    lineButtons.push(button); lineList.append(button);
  }
  for (const direction of [-1, 1]) {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.direction = String(direction); button.innerHTML = "<span aria-hidden=\"true\"></span><small>环移</small>";
    button.addEventListener("click", () => {
      const next = applyShift(state, { axis: selectedAxis, index: selectedIndex, direction });
      if (next === state) { toast("这条轨道无法执行该指令"); return; }
      commit(next, `第 ${selectedIndex + 1} ${axisText(selectedAxis)}已${directionText(selectedAxis, direction)}环移`);
    });
    directionButtons.push(button); directionList.append(button);
  }
  if (completed) [...axisButtons, ...lineButtons, ...directionButtons].forEach((button) => { button.disabled = true; });
  deck.append(axisList, lineList, directionList);
  board.replaceChildren(grid, deck);
  updateSelection();
}

mountPuzzle({
  slug: "orbit-atlas",
  title: "环轨星图台",
  eyebrow: "CELESTIAL ATLAS · LOOPED GRID CALIBRATION",
  summary: "推动无空隙的行列环轨，让十六枚星标回归正确天图序位。",
  accent: "#8cccf6",
  levelId: "atlas-calibration-04",
  tier: 2,
  par: SUGGESTED_STEPS,
  freshState,
  normalizeState,
  isComplete,
  tutorialCards,
  rules: [
    { title: "没有空格", copy: "十六枚星标始终占满棋盘；不能单独拖动任意一枚。" },
    { title: "整轨环移", copy: "选择一行或一列后推向箭头方向，离开的星标会从对侧出现。" },
    { title: "顺序校图", copy: "从左到右、从上到下恢复 1 至 16，完整 4 × 4 才算校准成功。" },
  ],
  statusFor(state, complete) {
    if (complete) return { title: "星图校准完成", copy: "十六枚星标已回到完整序位。", help: "可重新开始追求更少环移，或重看图片教程。" };
    const correct = state.board.reduce((count, value, index) => count + (value === index + 1 ? 1 : 0), 0);
    return { title: "选择轨道，推动星图", copy: `当前有 ${correct} / 16 枚星标在目标星位。`, help: "先选行轨或列轨、再选编号，最后点方向箭头。每次只环移整条轨道。" };
  },
  renderBoard,
});
