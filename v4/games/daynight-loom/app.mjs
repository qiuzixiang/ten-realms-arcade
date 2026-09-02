import { mountPuzzle } from "../../shared/game-kit.mjs";
import { DAY, EMPTY, NIGHT, SIZE, analyze, cycleCell, freshState, isComplete, normalizeState, setCell, tutorialCards } from "./logic.mjs";

function statusFor(state, completed) {
  const report = analyze(state.cells);
  if (completed) return { title: "昼夜经纬已织成", copy: "每条横竖线均衡，且没有三连。", help: "本局已结算；可以重新开始挑战更少操作。" };
  if (!report.valid) return { title: "经纬出现冲突", copy: report.triples.size ? "同一条线里出现了连续三个相同纹样。" : "一条线的昼或夜数量已经超过一半。", help: "冲突不会结算；继续轮换相关格即可修正。" };
  return { title: "保持昼夜均衡", copy: `已编入 ${report.filled} / ${SIZE * SIZE} 格；每行每列都要各两昼、两夜。`, help: "点空格：昼 → 夜 → 空。右键可直接设为夜线。" };
}

mountPuzzle({
  slug: "daynight-loom",
  title: "昼夜织机",
  eyebrow: "DAY / NIGHT LOOM · UNRULY",
  summary: "把昼与夜编进同一张经纬。每次落线都要兼顾均衡与绝不三连。",
  accent: "#f6da7d",
  levelId: "loom-practice-4x4",
  tier: 1,
  par: 10,
  freshState,
  normalizeState,
  isComplete,
  tutorialCards,
  statusFor,
  rules: [
    { title: "昼夜对半", copy: "每一行、列都必须有相同数量的昼线与夜线。" },
    { title: "不许三连", copy: "横向与纵向都不能出现连续三个完全相同的纹样。" },
    { title: "固定经线", copy: "角标为“固定”的格子来自题面，始终不可改变。" },
  ],
  renderBoard({ board, state, completed, commit, toast }) {
    board.className = "v4-board loom-board";
    state.cells.forEach((value, index) => {
      const fixed = [0, 3, 5, 10, 12, 15].includes(index);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `loom-cell ${value === DAY ? "is-day" : value === NIGHT ? "is-night" : "is-empty"}${fixed ? " is-fixed" : ""}`;
      button.disabled = fixed || completed;
      button.setAttribute("aria-label", `第 ${Math.floor(index / SIZE) + 1} 行第 ${index % SIZE + 1} 列：${value === DAY ? "昼" : value === NIGHT ? "夜" : "未编"}${fixed ? "，固定" : ""}`);
      button.innerHTML = `<span aria-hidden=\"true\">${value === DAY ? "☀" : value === NIGHT ? "☾" : "·"}</span>${fixed ? "<small>固定</small>" : ""}`;
      button.addEventListener("click", () => {
        const next = cycleCell(state, index);
        if (next) commit(next, "经线已轮换"); else toast(fixed ? "这是题面固定的经线" : "状态没有变化");
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const next = setCell(state, index, NIGHT);
        if (next) commit(next, "已直接织入夜线");
      });
      board.append(button);
    });
  },
});
