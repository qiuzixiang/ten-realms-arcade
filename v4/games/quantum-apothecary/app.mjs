import { mountPuzzle } from "../../shared/game-kit.mjs";
import { LEVEL, SIZE, TUTORIAL, cageFor, cageLabel, evaluate, isComplete, normalizeState, positionOf, setCell, undo, createState, tutorialSvg } from "./logic.mjs";

let selected = 0;

const tutorialCards = () => [
  {
    tag: "01 · 配方元素",
    title: "读懂反应笼",
    svg: tutorialSvg(TUTORIAL.initial, "elements"),
    body: "每格放入 1–4 号粒子；每一行、每一列各只能出现一次同号粒子。发光边框圈出一个反应笼，左上角标签是这笼的目标。",
    bullets: ["例如 3+ 表示笼内两颗粒子的总和必须为 3。", "同一反应笼允许重复数字，只要它们不处在同一行或同一列。"],
  },
  {
    tag: "02 · 一次真实投放",
    title: "先安放一枚 1 号粒子",
    svg: tutorialSvg(TUTORIAL.actionState, "action"),
    body: "本图执行的真实操作是 fill:0:1：在第 1 行第 1 列投放 1 号粒子。它没有重复行列数字，也不会让 3+ 反应笼失去可能性。",
    bullets: ["点击格子后点底部 1–4，或用键盘数字键投放。", "红色边缘只是在提示冲突；你仍可以用撤销回到上一步。"],
  },
  {
    tag: "03 · 反应完成",
    title: "让所有配方同时成立",
    svg: tutorialSvg(TUTORIAL.solved, "complete"),
    body: "所有 16 格填满后，行、列和每一个加、乘、减、除反应笼都必须同时成立，馆藏反应徽记才会结算。",
    bullets: ["通关图由固定关卡解复算，且不依赖内置答案的搜索器确认该关只有一个解。", "建议步数是 16 次正式投放；撤销后的最终成绩会如实记录。"],
  },
];

function moveFocus(board, cell, dx, dy) {
  const point = positionOf(cell);
  const row = Math.max(0, Math.min(SIZE - 1, point.row + dy));
  const column = Math.max(0, Math.min(SIZE - 1, point.column + dx));
  const next = row * SIZE + column;
  selected = next;
  markSelection(board);
  board.querySelector(`[data-cell="${next}"]`)?.focus();
}

function markSelection(board) {
  board.querySelectorAll("[data-cell]").forEach((button) => {
    button.classList.toggle("is-selected", Number(button.dataset.cell) === selected);
  });
}

function cellEdges(cell) {
  const cage = cageFor(LEVEL, cell);
  const point = positionOf(cell);
  const same = (row, column) => row >= 0 && row < SIZE && column >= 0 && column < SIZE && cageFor(LEVEL, row * SIZE + column)?.id === cage?.id;
  return {
    top: !same(point.row - 1, point.column), right: !same(point.row, point.column + 1),
    bottom: !same(point.row + 1, point.column), left: !same(point.row, point.column - 1),
  };
}

function renderBoard({ board, state, commit, toast }) {
  const evaluation = evaluate(LEVEL, state);
  const conflicts = new Set(evaluation.invalidCells);
  const stage = document.createElement("div");
  stage.className = "apothecary-stage";
  const grid = document.createElement("div");
  grid.className = "apothecary-grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "量子配方反应格");

  const place = (value) => {
    const next = setCell(state, selected, value);
    if (next === state) { toast(value === state.values[selected] ? "该格已经是这个粒子" : "这一步没有改变配方"); return; }
    commit(next, value ? `已投放 ${value} 号粒子` : "已抽离这一格的粒子");
  };

  for (let cell = 0; cell < SIZE * SIZE; cell += 1) {
    const point = positionOf(cell);
    const cage = cageFor(LEVEL, cell);
    const edges = cellEdges(cell);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "apothecary-cell";
    button.dataset.cell = String(cell);
    button.style.borderTopWidth = `${edges.top ? 3 : 1}px`;
    button.style.borderRightWidth = `${edges.right ? 3 : 1}px`;
    button.style.borderBottomWidth = `${edges.bottom ? 3 : 1}px`;
    button.style.borderLeftWidth = `${edges.left ? 3 : 1}px`;
    if (selected === cell) button.classList.add("is-selected");
    if (conflicts.has(cell)) button.classList.add("is-conflict");
    const label = cage.cells[0] === cell ? `<small>${cageLabel(cage)}</small>` : "";
    button.innerHTML = `${label}<b>${state.values[cell] || "·"}</b><i aria-hidden="true">${state.values[cell] ? "✦" : ""}</i>`;
    button.setAttribute("aria-label", `第 ${point.row + 1} 行第 ${point.column + 1} 列，${state.values[cell] || "空白"}${cage.cells[0] === cell ? `，反应笼 ${cageLabel(cage)}` : ""}`);
    button.addEventListener("click", () => { selected = cell; markSelection(grid); toast(`已选择第 ${point.row + 1} 行第 ${point.column + 1} 列`); });
    button.addEventListener("keydown", (event) => {
      const direction = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] }[event.key];
      if (direction) { event.preventDefault(); moveFocus(grid, cell, ...direction); return; }
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); selected = cell; place(Number(event.key)); return; }
      if (["Backspace", "Delete", "0", " "].includes(event.key)) { event.preventDefault(); selected = cell; place(0); }
    });
    grid.append(button);
  }
  stage.append(grid);

  const controls = document.createElement("div");
  controls.className = "apothecary-controls";
  for (let value = 1; value <= SIZE; value += 1) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "particle-button";
    button.innerHTML = `<i aria-hidden="true">${["◒", "◐", "◑", "◓"][value - 1]}</i><b>${value}</b>`;
    button.setAttribute("aria-label", `向所选格投放 ${value} 号粒子`);
    button.addEventListener("click", () => place(value)); controls.append(button);
  }
  const clear = document.createElement("button");
  clear.type = "button"; clear.className = "utility-button"; clear.textContent = "抽离";
  clear.addEventListener("click", () => place(0)); controls.append(clear);
  const undoButton = document.createElement("button");
  undoButton.type = "button"; undoButton.className = "utility-button"; undoButton.textContent = "撤销";
  undoButton.addEventListener("click", () => {
    const next = undo(state);
    if (next === state) { toast("还没有可以撤销的投放"); return; }
    commit(next, "已撤销上一枚粒子");
  });
  controls.append(undoButton);
  board.className = "apothecary-board";
  board.append(stage, controls);
}

mountPuzzle({
  slug: "quantum-apothecary",
  title: "量子配方馆",
  eyebrow: "REALM 02 · QUANTUM APOTHECARY",
  summary: "让每支量子配方同时完成拉丁排列与算术反应；一格粒子的落点，会牵动整座配方馆。",
  accent: "#a9d5ff",
  levelId: LEVEL.id,
  tier: 2,
  par: 16,
  rules: [
    { title: "行列不重", copy: "每行、每列各有且只有一枚 1–4 号粒子。" },
    { title: "反应目标", copy: "每个粗边反应笼要满足左上角的加、乘、减或除配方。" },
    { title: "完成结算", copy: "16 格填满且全部条件成立，才会获得反应徽记。" },
  ],
  freshState: createState,
  normalizeState,
  isComplete,
  tutorialCards,
  renderBoard,
  statusFor(state, completed) {
    const evaluation = evaluate(LEVEL, state);
    if (completed || evaluation.complete) return { title: "配方完成", copy: "所有反应均已稳定。", help: "可重新开始，或重看真实配方教程。" };
    if (evaluation.errors.length) return { title: "反应尚不稳定", copy: "红色边缘指出重复粒子或无法满足的反应笼。", help: "冲突不会锁死操作；点“撤销”或改写对应格。" };
    return { title: "校准反应序列", copy: `还需投放 ${state.values.filter((value) => !value).length} 枚粒子。`, help: "选中格子后点 1–4；方向键和数字键也可操作。" };
  },
});
document.querySelector("#victory-title").textContent = "量子反应稳定";

// These exports keep the tutorial's action trace inspectable without exposing UI state.
export { TUTORIAL };
