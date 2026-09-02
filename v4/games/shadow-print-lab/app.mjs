import { BLACK, CIRCLED, PRINTS, SIZE, WHITE, analyze, cycleMode, freshState, isComplete, normalizeState, setMode, tutorialCards } from "./logic.mjs";
import { mountPuzzle } from "../../shared/game-kit.mjs";

function statusFor(state, completed) {
  const result = analyze(state.modes);
  if (completed) return { title: "档案已净化", copy: "没有重复、相邻黑格或断开的白纸。", help: "本局结算完成；可重新开始挑战更少操作。" };
  if (!result.valid) {
    const copy = result.touching.size ? "两张被屏蔽的印纸正交相邻。" : result.duplicate.size ? "仍有一行或一列留下重复数字。" : "余下的白纸被黑格分隔成多个区域。";
    return { title: "净化条件冲突", copy, help: "调整遮罩，三项条件须同时成立。" };
  }
  return { title: "筛出重复幽影", copy: `当前屏蔽 ${result.blackCount} 张印纸；白格仍需无重复且完整连通。`, help: "点按轮换白格、遮罩与圈注；右键可直接添加圈注。" };
}

mountPuzzle({
  slug: "shadow-print-lab", title: "影印净化室", eyebrow: "SHADOW PRINT LAB · SINGLES", accent: "#d8a6ef",
  summary: "用遮罩净化重复印记；每一次涂黑都要确保余下的纸面仍是一整张。",
  levelId: "print-purify-4x4", tier: 1, par: 2, freshState, normalizeState, isComplete, tutorialCards, statusFor,
  rules: [
    { title: "去掉重复", copy: "任何行、列的剩余白格不能有相同数字。" },
    { title: "黑格不接触", copy: "两张被屏蔽的印纸不能共享边。" },
    { title: "白纸连成一片", copy: "所有未屏蔽格必须能沿边抵达彼此。" },
  ],
  renderBoard({ board, state, completed, commit, toast }) {
    board.className = "v4-board print-board";
    const errors = analyze(state.modes).errors;
    state.modes.forEach((mode, index) => {
      const button = document.createElement("button"); button.type = "button";
      button.className = `print-cell ${mode === BLACK ? "is-black" : mode === CIRCLED ? "is-circled" : "is-white"}${errors.has(index) ? " is-error" : ""}`;
      button.disabled = completed; button.setAttribute("aria-label", `第 ${Math.floor(index / SIZE) + 1} 行第 ${index % SIZE + 1} 列，印记 ${PRINTS[index]}，${mode === BLACK ? "已屏蔽" : mode === CIRCLED ? "已圈注" : "未处理"}`);
      button.innerHTML = `<b>${PRINTS[index]}</b><i aria-hidden=\"true\">${mode === BLACK ? "×" : mode === CIRCLED ? "○" : ""}</i>`;
      button.addEventListener("click", () => { const next = cycleMode(state, index); if (next) commit(next, "印纸状态已切换"); else toast("这一格没有可用改变"); });
      button.addEventListener("contextmenu", (event) => { event.preventDefault(); const next = setMode(state, index, CIRCLED); if (next) commit(next, "已添加圈注"); });
      board.append(button);
    });
  },
});
