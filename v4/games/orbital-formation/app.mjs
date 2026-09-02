import { mountPuzzle } from "../../shared/game-kit.mjs";
import {
  MODULES, SUGGESTED_STEPS, WIDTH, applyShift, freshState, isComplete, moduleSvg,
  networkReport, normalizeState, tutorialCards,
} from "./logic.mjs";

function actionLabel(axis, index, direction) {
  const sequence = axis === "row" ? "行轨" : "列轨";
  const word = axis === "row" ? (direction > 0 ? "向右" : "向左") : (direction > 0 ? "向下" : "向上");
  return `第 ${index + 1} ${sequence}${word}环移`;
}

function shiftButton(axis, index, direction, glyph, state, commit, toast) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "orbit-control";
  button.setAttribute("aria-label", actionLabel(axis, index, direction));
  button.title = actionLabel(axis, index, direction);
  button.innerHTML = `<span aria-hidden="true">${glyph}</span><small>${index + 1}</small>`;
  button.addEventListener("click", () => {
    const next = applyShift(state, { axis, index, direction });
    if (next === state) { toast("这条轨道无法执行该指令"); return; }
    commit(next, actionLabel(axis, index, direction));
  });
  return button;
}

function renderBoard({ board, state, completed, commit, toast }) {
  board.className = "v4-board formation-console";
  const report = networkReport(state);
  const linked = new Set(report.connected);
  const faulty = new Set([...report.dangling.map((item) => item.position), ...report.mismatches.map((item) => item.position)]);
  const grid = document.createElement("div");
  grid.className = "formation-grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "轨道编队模块网格；使用四周箭头环移整行或整列");
  for (let position = 0; position < state.order.length; position += 1) {
    const module = MODULES[state.order[position]];
    const cell = document.createElement("div");
    cell.className = `formation-module${linked.has(position) ? " is-linked" : ""}${faulty.has(position) ? " has-fault" : ""}`;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-rowindex", String(Math.floor(position / WIDTH) + 1));
    cell.setAttribute("aria-colindex", String(position % WIDTH + 1));
    cell.setAttribute("aria-label", `第 ${Math.floor(position / WIDTH) + 1} 行第 ${position % WIDTH + 1} 列，${module.name}，端口 ${[...module.ports].join("、")}${faulty.has(position) ? "，有未对接端口" : linked.has(position) ? "，已接入中心网" : "，尚未接入中心网"}`);
    cell.innerHTML = moduleSvg(module.id, { label: true });
    grid.append(cell);
  }
  const top = document.createElement("div"); top.className = "orbit-controls is-top";
  const bottom = document.createElement("div"); bottom.className = "orbit-controls is-bottom";
  const left = document.createElement("div"); left.className = "orbit-controls is-left";
  const right = document.createElement("div"); right.className = "orbit-controls is-right";
  for (let index = 0; index < WIDTH; index += 1) {
    top.append(shiftButton("column", index, -1, "↑", state, commit, toast));
    bottom.append(shiftButton("column", index, 1, "↓", state, commit, toast));
    left.append(shiftButton("row", index, -1, "←", state, commit, toast));
    right.append(shiftButton("row", index, 1, "→", state, commit, toast));
  }
  [top, bottom, left, right].forEach((set) => {
    if (completed) set.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  });
  board.replaceChildren(top, left, grid, right, bottom);
}

mountPuzzle({
  slug: "orbital-formation",
  title: "轨道编队调度",
  eyebrow: "ORBITAL CONTROL · NETWORK REPOSITIONING",
  summary: "环移整条轨道，而不是旋转模块，让四散的信号重新汇成一张无环编队网。",
  accent: "#76e4e0",
  levelId: "formation-practice-03",
  tier: 2,
  par: SUGGESTED_STEPS,
  freshState,
  normalizeState,
  isComplete,
  tutorialCards,
  rules: [
    { title: "整轨环移", copy: "一次指令只移动整行或整列；离开一端的模块从另一端归队。" },
    { title: "模块不转", copy: "端口朝向是模块的固定特征，任何操作都不会改变它。" },
    { title: "连成一网", copy: "所有端口必须成对相接，九个模块连通且正好八条连接。" },
  ],
  statusFor(state, complete) {
    const report = networkReport(state);
    if (complete) return { title: "编队全网合流", copy: "所有模块已连成没有闭环的完整信号树。", help: "可重新调度争取更少指令，或重看图片教程。" };
    const broken = report.dangling.length + report.mismatches.length;
    return { title: "把端口调到相遇的位置", copy: `当前有 ${broken} 个未对接端口；中心网已覆盖 ${report.connected.length} / 9 个模块。`, help: "点四周箭头环移整条轨道。模块永远不旋转，亮线方向就是固定端口。" };
  },
  renderBoard,
});
