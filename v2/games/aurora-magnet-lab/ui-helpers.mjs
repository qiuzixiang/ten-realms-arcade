import { POLARITY, SLOT_STATE, keyOf, pointFromKey, slotForCell } from "./logic.mjs";

export const TOOL_IDS = Object.freeze(["polarity", "neutral", "note", "erase"]);

export function clueId(axis, polarity, index) {
  return `${axis}:${polarity}:${index}`;
}

export function moveForTool(tool, key, currentState = SLOT_STATE.EMPTY) {
  if (tool === "polarity") return { type: "cycle-primary", key };
  if (tool === "neutral") {
    return { type: "set-state", key, state: currentState === SLOT_STATE.NEUTRAL ? SLOT_STATE.EMPTY : SLOT_STATE.NEUTRAL };
  }
  if (tool === "note") return { type: "toggle-note", key };
  if (tool === "erase") return { type: "clear-slot", key };
  return null;
}

export function nextCellKey(puzzle, currentKey, key) {
  const point = pointFromKey(currentKey);
  if (!point) return currentKey;
  const directions = {
    ArrowUp: [-1, 0], w: [-1, 0], W: [-1, 0],
    ArrowRight: [0, 1], d: [0, 1], D: [0, 1],
    ArrowDown: [1, 0], s: [1, 0], S: [1, 0],
    ArrowLeft: [0, -1], a: [0, -1], A: [0, -1],
  };
  const step = directions[key];
  if (!step) return currentKey;
  let row = point.row + step[0];
  let column = point.column + step[1];
  while (row >= 0 && column >= 0 && row < puzzle.height && column < puzzle.width) {
    const candidate = keyOf(row, column);
    if (puzzle.cellSlots.has(candidate)) return candidate;
    row += step[0];
    column += step[1];
  }
  return currentKey;
}

export function shouldHandleGlobalShortcut(context = {}) {
  if (context.dialogOpen) return false;
  const tag = String(context.targetTag ?? "").toLowerCase();
  if (context.contentEditable || ["input", "textarea", "select"].includes(tag)) return false;
  const key = String(context.key ?? "").toLowerCase();
  const undo = (context.ctrlKey || context.metaKey) && key === "z" && !context.shiftKey;
  if (undo) return true;
  return context.targetIsBoardCell !== true;
}

function stateDescription(state, note) {
  if (state === SLOT_STATE.FORWARD) return "第一端为正极圆形加号，第二端为负极菱形减号";
  if (state === SLOT_STATE.REVERSE) return "第一端为负极菱形减号，第二端为正极圆形加号";
  if (state === SLOT_STATE.NEUTRAL) return "已装入中性模块，不计正负极";
  if (note) return "尚未装入，已记为不可能中性";
  return "尚未装入";
}

export function cellAriaLabel(puzzle, key, evaluation) {
  const point = pointFromKey(key);
  const reference = puzzle.cellSlots.get(key);
  const slot = slotForCell(puzzle, key);
  if (!point || !reference || !slot) return "固定中性空位";
  const state = evaluation.states.get(slot.id) ?? SLOT_STATE.EMPTY;
  const polarity = evaluation.polarities.get(key);
  const polarityText = polarity === POLARITY.PLUS
    ? "本格为正极，加号"
    : polarity === POLARITY.MINUS
      ? "本格为负极，减号"
      : polarity === POLARITY.NEUTRAL
        ? "本格为中性"
        : "本格未填";
  const orientation = slot.orientation === "horizontal" ? "横向" : "纵向";
  const conflict = evaluation.conflictKeys.has(key) ? "，此处与正交相邻同极冲突" : "";
  return `第 ${point.row + 1} 行第 ${point.column + 1} 列，${orientation}槽位 ${slot.id} 的第 ${reference.end + 1} 端，${polarityText}；${stateDescription(state, evaluation.notes.has(slot.id))}${conflict}`;
}

export function formatElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function cloneHistorySnapshot(session) {
  return {
    position: {
      states: { ...session.position.states },
      notes: [...session.position.notes],
    },
    moves: session.moves,
    conflictMoves: session.conflictMoves,
  };
}
