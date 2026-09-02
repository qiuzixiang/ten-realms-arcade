import { CLUES, EXCLUDED, HEIGHT, SELECTED, UNKNOWN, WIDTH, analyze, cycleEdge, freshState, isComplete, normalizeState, setEdge, tutorialCards } from "./logic.mjs";
import { mountPuzzle } from "../../shared/game-kit.mjs";

function statusFor(state, completed) {
  const report = analyze(state.edges);
  if (completed) return { title: "月潮结界已闭合", copy: "数字全数吻合，且所有选边组成唯一闭环。", help: "本局已经结算；可重新开始挑战更少操作。" };
  if (report.overflow.size) return { title: "有刻印被潮线淹没", copy: "至少一个数字周边的选线数已经过多。", help: "把多余边切回排除或待定。" };
  if (report.selected.length && report.degreeErrors.size) return { title: "结界仍有岔口", copy: "选线端点不能悬空或形成分支；完成时每个经过的结点恰有两条线。", help: "继续选择或撤回边，让潮线首尾相接。" };
  return { title: "织出唯一月潮环", copy: `当前选入 ${report.selected.length} 条边；所有刻印与单一闭环必须同时满足。`, help: "点击每段边的中点轮换：待定 → 选入 → 排除。右键可直接排除。" };
}

mountPuzzle({
  slug: "lunar-tide-seal", title: "月潮结界", eyebrow: "LUNAR TIDE SEAL · LOOPY", accent: "#d7b8ff",
  summary: "根据潮汐刻印选取边线，让月光只沿一条没有岔路的封印环流动。",
  levelId: "tide-seal-3x3", tier: 1, par: 12, freshState, normalizeState, isComplete, tutorialCards, statusFor,
  rules: [
    { title: "数字计边", copy: "每个数字等于它周围被选择的结界边数量。" },
    { title: "只有一环", copy: "所有选择边必须组成一条连续且唯一的闭环。" },
    { title: "三态标记", copy: "待定、选入与排除分开显示，排除只是一种笔记状态。" },
  ],
  renderBoard({ board, state, completed, commit, toast }) {
    board.className = "v4-board loopy-board";
    const cells = document.createElement("div"); cells.className = "loopy-cells";
    const analysis = analyze(state.edges);
    CLUES.forEach((clue, index) => { const cell = document.createElement("div"); cell.className = `loopy-cell${analysis.overflow.has(index) ? " is-over" : ""}`; cell.textContent = String(clue); cells.append(cell); }); board.append(cells);
    Object.entries(state.edges).forEach(([key, value]) => {
      const [, rawY, rawX] = key.split(":"); const horizontal = key.startsWith("h:"); const x = Number(rawX); const y = Number(rawY); const stateClass = value === SELECTED ? "is-selected" : value === EXCLUDED ? "is-excluded" : "is-unknown";
      const line = document.createElement("span"); line.className = `loopy-edge-line ${horizontal ? "is-horizontal" : "is-vertical"} ${stateClass}`; line.setAttribute("aria-hidden", "true");
      line.style.setProperty("--edge-x", rawX); line.style.setProperty("--edge-y", rawY); board.append(line);
      const button = document.createElement("button"); button.type = "button";
      button.className = `loopy-edge-hit ${horizontal ? "is-horizontal" : "is-vertical"}`;
      button.style.left = `${((x + (horizontal ? .5 : 0)) / WIDTH) * 100}%`; button.style.top = `${((y + (horizontal ? 0 : .5)) / HEIGHT) * 100}%`; button.dataset.edgeKey = key; button.disabled = completed;
      button.setAttribute("aria-label", `${horizontal ? "横" : "竖"}边 ${key}：${value === SELECTED ? "已选入" : value === EXCLUDED ? "已排除" : "待定"}`);
      button.addEventListener("click", () => { const next = cycleEdge(state, key); if (next) commit(next, "月潮边状态已更新"); else toast("边状态没有变化"); });
      button.addEventListener("contextmenu", (event) => { event.preventDefault(); const next = setEdge(state, key, EXCLUDED); if (next) commit(next, "已排除这条潮线"); }); board.append(button);
    });
  },
});
