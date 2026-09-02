import { mountPuzzle } from "../../shared/game-kit.mjs";
import {
  SIZE, WIDTH, SUGGESTED_STEPS, blankIndex, freshState, isComplete, isLegalTile,
  legalTiles, moveTile, moveTileDirection, normalizeState, tutorialCards,
} from "./logic.mjs";

const directionByKey = Object.freeze({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" });

function cargoLabel(state, index) {
  const tile = state.board[index];
  const row = Math.floor(index / WIDTH) + 1;
  const column = index % WIDTH + 1;
  if (tile === 0) return `第 ${row} 行第 ${column} 列，空舱`;
  const legal = isLegalTile(state, index) ? "，可滑入空舱" : "，不在空舱同一行或列";
  return `第 ${row} 行第 ${column} 列，${tile} 号时间货箱${legal}`;
}

function renderBoard({ board, state, completed, commit, toast }) {
  board.className = "v4-board cargo-board";
  board.setAttribute("role", "grid");
  board.setAttribute("aria-label", "时序货舱 3 乘 3 滑运棋盘");
  const blank = blankIndex(state);
  const legal = new Set(legalTiles(state));
  const cells = state.board.map((tile, index) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `cargo-cell${tile === 0 ? " is-empty" : ""}${legal.has(index) ? " is-legal" : ""}`;
    cell.dataset.index = String(index);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-rowindex", String(Math.floor(index / WIDTH) + 1));
    cell.setAttribute("aria-colindex", String(index % WIDTH + 1));
    cell.setAttribute("aria-label", cargoLabel(state, index));
    cell.disabled = completed || tile === 0;
    if (tile === 0) cell.innerHTML = '<span aria-hidden="true">⌁</span><small>空舱</small>';
    else cell.innerHTML = `<i aria-hidden="true"></i><b>${tile}</b><small>货签</small>`;
    cell.addEventListener("click", () => {
      const next = moveTile(state, index);
      if (next === state) { toast("这件货物不在空舱的同行或同列"); return; }
      commit(next, `货签 ${tile} 已沿货舱滑运`);
    });
    cell.addEventListener("keydown", (event) => {
      const direction = directionByKey[event.key];
      if (!direction) return;
      event.preventDefault();
      const next = moveTileDirection(state, direction);
      if (next === state) { toast("这个方向没有可滑入空舱的相邻货物"); return; }
      commit(next, "已按货物移动方向执行一格滑运");
    });
    return cell;
  });
  board.replaceChildren(...cells);
  board.style.setProperty("--cargo-blank", String(blank));
}

mountPuzzle({
  slug: "time-cargo-bay",
  title: "时序货舱",
  eyebrow: "CHRONO FREIGHT · PRACTICE MANIFEST 03",
  summary: "沿空舱滑运遗物货箱，让时间货签回到正确归档序列。",
  accent: "#ffbd66",
  levelId: "cargo-manifest-03",
  tier: 1,
  par: SUGGESTED_STEPS,
  freshState,
  normalizeState,
  isComplete,
  tutorialCards,
  rules: [
    { title: "空舱滑运", copy: "选择空舱同行或同列的一件货箱；中间货物会依次让位。" },
    { title: "一次计步", copy: "无论跨越几格，一次选择只算一次操作。无效选择不会改变棋盘。" },
    { title: "签收条件", copy: "按 1 至 8 排列，并让空舱停在右下角。" },
  ],
  statusFor(state, complete) {
    if (complete) return { title: "货舱已签收", copy: "全部时间货签已归位。", help: "可重新开始挑战更少操作数，或打开图片教程复核规则。" };
    const legalCount = legalTiles(state).length;
    return { title: "定位空舱，再派送货箱", copy: `当前空舱可接收 ${legalCount} 件同行或同列货物。`, help: "点亮边框的货箱可直接滑入空舱；方向键表示货箱移动方向。" };
  },
  renderBoard,
});

// The module exposes its fixed board width to static tooling without making
// UI state mutable. This also guards against accidental redesign into a
// different puzzle family.
if (SIZE !== 9) throw new Error("Time cargo practice board must remain a compact Fifteen instance.");
