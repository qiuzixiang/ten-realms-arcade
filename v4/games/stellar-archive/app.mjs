import { mountPuzzle } from "../../shared/game-kit.mjs";
import { LEVEL, SIZE, TUTORIAL, createState, evaluate, givenAt, isComplete, normalizeState, setCell, tutorialSvg, undo } from "./logic.mjs";

let selected = 1;
const starGlyph = ["", "✦", "✧", "◆", "✺"];

const tutorialCards = () => [
  { tag: "01 · 档案元素", title: "校验星图", svg: tutorialSvg(TUTORIAL.initial, "elements"), body: "每个空格登记 1–4 号星标。行、列和每个 2×2 星区都必须各出现一次 1、2、3、4；带馆藏角标的星号不能修改。", bullets: ["粗线圈出四个真实 2×2 星区。", "数字和星形轮廓共同识别星标，不依赖颜色。"] },
  { tag: "02 · 一次真实归档", title: "补入二号星标", svg: tutorialSvg(TUTORIAL.actionState, "action"), body: "本图的真实操作是 fill:1:2：第 1 行第 2 列填入 2。它同时避开这一行、这一列和左上 2×2 星区已有的星标。", bullets: ["点格后用下方星标按钮，或直接按数字键。", "冲突会亮出红色警示，但可修改和撤销，不会锁住题面。"] },
  { tag: "03 · 编目完成", title: "封存星图", svg: tutorialSvg(TUTORIAL.solved, "complete"), body: "只有所有格填满，并且行、列、2×2 星区三组索引都无重复时，档案院才会封存这张星图。", bullets: ["通关图由规则引擎重算；独立搜索确认该固定档案只有一个解。", "本局需 10 次正式归档；首次、个人最佳和建议线都会通过稳定编号结算。"] },
];

function markSelection(grid) { grid.querySelectorAll("[data-cell]").forEach((node) => node.classList.toggle("is-selected", Number(node.dataset.cell) === selected)); }
function moveFocus(grid, cell, dx, dy) { const row = Math.max(0, Math.min(SIZE - 1, Math.floor(cell / SIZE) + dy)); const column = Math.max(0, Math.min(SIZE - 1, cell % SIZE + dx)); selected = row * SIZE + column; markSelection(grid); grid.querySelector(`[data-cell="${selected}"]`)?.focus(); }

function renderBoard({ board, state, commit, toast }) {
  const evaluation = evaluate(LEVEL, state); const conflicts = new Set(evaluation.invalidCells);
  const stage = document.createElement("div"); stage.className = "archive-stage";
  const grid = document.createElement("div"); grid.className = "archive-grid"; grid.setAttribute("role", "grid"); grid.setAttribute("aria-label", "星图档案盘");
  const place = (value) => { const next = setCell(state, selected, value); if (next === state) { toast(givenAt(LEVEL, selected) ? "馆藏星号不可改写" : "这一步没有改变档案"); return; } commit(next, value ? `已归档 ${value} 号星标` : "已清除所选星标"); };
  for (let cell = 0; cell < SIZE * SIZE; cell += 1) {
    const row = Math.floor(cell / SIZE); const column = cell % SIZE; const value = state.values[cell]; const given = givenAt(LEVEL, cell);
    const button = document.createElement("button"); button.type = "button"; button.className = "archive-cell"; button.dataset.cell = String(cell);
    if (given) button.classList.add("is-given"); if (selected === cell) button.classList.add("is-selected"); if (conflicts.has(cell)) button.classList.add("is-conflict");
    if (column % 2 === 0) button.style.borderLeftWidth = "3px"; if (row % 2 === 0) button.style.borderTopWidth = "3px"; if (column === SIZE - 1) button.style.borderRightWidth = "3px"; if (row === SIZE - 1) button.style.borderBottomWidth = "3px";
    button.innerHTML = `<i aria-hidden="true">${value ? starGlyph[value] : "·"}</i><b>${value || ""}</b>${given ? '<small>馆藏</small>' : ""}`;
    button.setAttribute("aria-label", `第 ${row + 1} 行第 ${column + 1} 列，${given ? "馆藏" : "可填写"}${value ? `，${value} 号星标` : "，空白"}`);
    button.addEventListener("click", () => { selected = cell; markSelection(grid); toast(`已选中第 ${row + 1} 行第 ${column + 1} 列`); });
    button.addEventListener("keydown", (event) => { const direction = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] }[event.key]; if (direction) { event.preventDefault(); moveFocus(grid, cell, ...direction); return; } if (/^[1-4]$/.test(event.key)) { event.preventDefault(); selected = cell; place(Number(event.key)); return; } if (["Backspace", "Delete", "0", " "].includes(event.key)) { event.preventDefault(); selected = cell; place(0); } });
    grid.append(button);
  }
  stage.append(grid);
  const controls = document.createElement("div"); controls.className = "archive-controls";
  for (let value = 1; value <= SIZE; value += 1) { const button = document.createElement("button"); button.type = "button"; button.className = "star-button"; button.innerHTML = `<i aria-hidden="true">${starGlyph[value]}</i><b>${value}</b>`; button.setAttribute("aria-label", `向所选格归档 ${value} 号星标`); button.addEventListener("click", () => place(value)); controls.append(button); }
  const clear = document.createElement("button"); clear.type = "button"; clear.className = "archive-utility"; clear.textContent = "清除"; clear.addEventListener("click", () => place(0)); controls.append(clear);
  const undoButton = document.createElement("button"); undoButton.type = "button"; undoButton.className = "archive-utility"; undoButton.textContent = "撤销"; undoButton.addEventListener("click", () => { const next = undo(state); if (next === state) { toast("还没有可撤销的归档"); return; } commit(next, "已撤销上一条归档"); }); controls.append(undoButton);
  board.className = "archive-board"; board.append(stage, controls);
}

mountPuzzle({
  slug: "stellar-archive", title: "星图档案院", eyebrow: "REALM 08 · STELLAR ARCHIVE", summary: "修复被分割的星图索引。每枚星标必须在行、列与星区中恰好出现一次。", accent: "#f2ab82", levelId: LEVEL.id, tier: 2, par: 10,
  rules: [{ title: "行列星序", copy: "每行、每列各保留 1–4 号星标各一枚。" }, { title: "星区封存", copy: "每个粗线 2×2 星区也要各有一枚 1–4。" }, { title: "馆藏不动", copy: "带“馆藏”角标的是固定索引，不能改写。" }],
  freshState: createState, normalizeState, isComplete, tutorialCards, renderBoard,
  statusFor(state, completed) { const result = evaluate(LEVEL, state); if (completed || result.complete) return { title: "星图已封存", copy: "三重索引完全吻合。", help: "可重开同一份档案，或重看真实图解。" }; if (result.errors.length) return { title: "索引发生重叠", copy: "红色星格与同一行、列或星区的重复有关。", help: "撤销、清除或改写非馆藏星标即可继续。" }; return { title: "修复星图索引", copy: `还有 ${state.values.filter((value) => !value).length} 颗星标待归档。`, help: "点选空格并选择 1–4；键盘方向键可移动焦点。" }; },
});
document.querySelector("#victory-title").textContent = "星图正式封存";
export { TUTORIAL };
