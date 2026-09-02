import { CLUES, EDGE_CLEAR, EDGE_WALL, HEIGHT, WIDTH, analyze, cycleEdge, freshState, isComplete, normalizeState, setEdge, tutorialCards } from "./logic.mjs";
import { mountPuzzle } from "../../shared/game-kit.mjs";

function statusFor(state, completed) {
  const report = analyze(state.edges);
  if (completed) return { title: "群岛防线已成", copy: "每个巡防区恰含四岛，所有界碑计数正确。", help: "已完成结算；重新开始可尝试更少的边操作。" };
  if (report.clueOverflows.size) return { title: "墙数超过界碑", copy: "至少一座岛碰到的墙已超过它的数字；撤掉多余的边界。", help: "实线是墙，虚线只是“此处无墙”的笔记。" };
  const sizes = report.groups.map((group) => group.length).join("、");
  return { title: "划出等编制巡防区", copy: `当前连通区大小：${sizes}；每一队必须恰为 4 座岛。`, help: "点击岛格之间每段边的中点轮换：空白 → 墙 → 无墙标记。" };
}

mountPuzzle({
  slug: "archipelago-guard", title: "群岛边防署", eyebrow: "ARCHIPELAGO GUARD · PALISADE", accent: "#f2c879",
  summary: "根据每座岛的界碑，在海图上划出等编制、连续相接的巡防区域。",
  levelId: "guard-practice-4x4", tier: 1, par: 12, freshState, normalizeState, isComplete, tutorialCards, statusFor,
  rules: [
    { title: "等人数", copy: "每个以墙围出的巡防区恰好容纳四座岛。" },
    { title: "连成片", copy: "一个巡防区的岛必须沿边彼此抵达。" },
    { title: "界碑计墙", copy: "每格数字等于相邻的内外墙总数。" },
  ],
  renderBoard({ board, state, completed, commit, toast }) {
    board.className = "v4-board palisade-board";
    const analysis = analyze(state.edges);
    const cellLayer = document.createElement("div"); cellLayer.className = "palisade-cells";
    CLUES.forEach((clue, index) => { const cell = document.createElement("div"); cell.className = `palisade-cell${analysis.clueOverflows.has(index) ? " is-over" : ""}`; cell.textContent = String(clue); cellLayer.append(cell); });
    board.append(cellLayer);
    Object.entries(state.edges).forEach(([key, value]) => {
      const [, first, second] = key.split(":"); const edge = document.createElement("button"); edge.type = "button";
      const vertical = key.startsWith("v:"); const x = Number(second); const y = Number(first); const stateClass = value === EDGE_WALL ? "is-wall" : value === EDGE_CLEAR ? "is-clear" : "is-unknown";
      const line = document.createElement("span"); line.className = `palisade-edge-line ${vertical ? "is-vertical" : "is-horizontal"} ${stateClass}`; line.setAttribute("aria-hidden", "true");
      line.style.setProperty("--edge-x", String(x)); line.style.setProperty("--edge-y", String(y)); board.append(line);
      edge.className = `palisade-edge-hit ${vertical ? "is-vertical" : "is-horizontal"}`;
      edge.style.left = `${((x + (vertical ? 0 : .5)) / WIDTH) * 100}%`;
      edge.style.top = `${((y + (vertical ? .5 : 0)) / HEIGHT) * 100}%`;
      edge.dataset.edgeKey = key;
      edge.disabled = completed; edge.setAttribute("aria-label", `${vertical ? "竖" : "横"}向边 ${key}：${value === EDGE_WALL ? "巡防墙" : value === EDGE_CLEAR ? "无墙标注" : "未决定"}`);
      edge.addEventListener("click", () => { const next = cycleEdge(state, key); if (next) commit(next, "边界状态已更新"); else toast("边界状态没有变化"); });
      edge.addEventListener("contextmenu", (event) => { event.preventDefault(); const next = setEdge(state, key, EDGE_CLEAR); if (next) commit(next, "已标记此处无墙"); });
      board.append(edge);
    });
  },
});
