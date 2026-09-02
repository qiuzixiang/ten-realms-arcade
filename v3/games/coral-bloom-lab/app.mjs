import { LEVELS, levelById, nextLevel } from "./levels.mjs";
import { createState, evaluateState, givenValue, isGiven, replayTimeline, restoreState, setValue, toggleCandidate } from "./logic.mjs";
import { createRunId, createSession, markTutorialSeen, normalizeSession, readJsonResult, saveSession, tutorialSeen } from "./storage.mjs";
import { createCompletion, deliverCompletion, enqueueCompletion, loadCompletionOutbox, removeCompletion } from "./completion.mjs";

const GAME_ID = "coral-bloom-lab";
const TUTORIALS = Object.freeze([
  Object.freeze({
    title: "认出孢核与容量", image: "./assets/tutorial-elements.svg", alt: "潮汐育苗池真实初始盘面，标有固定孢核和空培育格",
    copy: "每个带数字的孢核都是固定线索。最终每个正交连通的同数字孢群，面积都要恰好等于这个数字。",
    bullets: ["对角接触不连通；只有共用一条边才会长成同一簇。", "同一个数字可以有多簇彼此分离的珊瑚。"],
  }),
  Object.freeze({
    title: "让一格正式发芽", image: "./assets/tutorial-action.svg", alt: "在潮汐育苗池把左上角空格填为 4 的真实合法操作",
    copy: "选一个容量再点按空格，就会种下正式珊瑚。错误分枝会出现警示环，但不会阻止你继续推理或撤销。",
    bullets: ["本图真实操作：在内部格 0 填入 4（fill:0:4）。", "候选孢子只是笔记，不计步，也不参与胜利判定。"],
  }),
  Object.freeze({
    title: "整座苗圃盛放", image: "./assets/tutorial-goal.svg", alt: "潮汐育苗池经过规则引擎验证的完整通关盘面",
    copy: "所有空格都有正式数字，且每一簇面积都精确匹配数字，培育记录才会完成。",
    bullets: ["相邻同数字绝不能让任何一簇超过它的容量。", "通关图来自真实首关解，并由独立搜索器从线索复证唯一。"],
  }),
]);

const $ = (selector) => document.querySelector(selector);
const board = $("[data-board]");
const status = $("[data-status]");
const tutorialDialog = $(".tutorial-dialog[data-tutorial]");
const winDialog = $(".win-dialog[data-win]");
let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
const initialRead = readJsonResult("ten-realms-v3:games:coral-bloom-lab:session:v1", null, storage);
let storageAvailable = initialRead.available;
let session = normalizeSession(initialRead.value, LEVELS) ?? createSession(LEVELS[0]);
let level = levelById(session.levelId) ?? LEVELS[0];
let selectedValue = 4;
let noteMode = false;
let tutorialIndex = 0;

function save() {
  if (!storageAvailable) return false;
  const saved = saveSession(storage, session);
  storageAvailable = storageAvailable && saved;
  return saved;
}

function message(text, kind = "") {
  status.textContent = text;
  status.className = `status${kind ? ` is-${kind}` : ""}`;
}

function stateLabel(value) {
  return value ? `${value} 格容量` : "未种下";
}

function renderLevels() {
  const list = $("[data-levels]");
  list.replaceChildren(...LEVELS.map((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.level = candidate.id;
    button.setAttribute("aria-current", String(candidate.id === level.id));
    button.innerHTML = `<b>${index + 1}</b><span><strong></strong><small></small></span>`;
    button.querySelector("strong").textContent = candidate.title;
    button.querySelector("small").textContent = candidate.subtitle;
    button.addEventListener("click", () => switchLevel(candidate.id));
    return button;
  }));
}

function notesText(mask) {
  return Array.from({ length: 9 }, (_, index) => mask & (1 << index) ? index + 1 : "").filter(Boolean).join(" ");
}

function renderBoard() {
  const evaluation = evaluateState(level, session.state);
  const warningCells = new Set(evaluation.errors.flatMap((error) => error.cells));
  const exactCells = new Set(evaluation.components.filter((component) => component.size === component.value)
    .flatMap((component) => component.cells));
  board.style.setProperty("--columns", level.width);
  board.replaceChildren(...Array.from({ length: level.width * level.height }, (_, cell) => {
    const value = session.state.values[cell];
    const clue = givenValue(level, cell);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "coral-cell";
    button.dataset.cell = String(cell);
    button.dataset.value = String(value);
    if (clue) button.classList.add("is-given");
    if (warningCells.has(cell)) button.classList.add("is-warning");
    if (value && exactCells.has(cell) && !warningCells.has(cell)) button.classList.add("is-exact");
    const x = cell % level.width + 1;
    const y = Math.floor(cell / level.width) + 1;
    button.setAttribute("aria-label", `第 ${y} 行第 ${x} 列，${clue ? "固定孢核，" : ""}${stateLabel(value)}${session.state.notes[cell] ? `，候选 ${notesText(session.state.notes[cell])}` : ""}`);
    if (value) {
      button.innerHTML = `<span class="coral-shape" aria-hidden="true"></span><b>${value}</b>${clue ? "<i>核</i>" : ""}`;
    } else if (session.state.notes[cell]) {
      button.innerHTML = `<span class="candidate-notes">${notesText(session.state.notes[cell])}</span>`;
    } else {
      button.innerHTML = "<span class=\"empty-mark\" aria-hidden=\"true\">·</span>";
    }
    button.addEventListener("click", () => activateCell(cell));
    button.addEventListener("keydown", (event) => handleCellKey(event, cell));
    return button;
  }));
  $("[data-moves]").textContent = String(session.state.moves);
  $("[data-left]").textContent = String(evaluation.remaining);
  $("[data-level-title]").textContent = level.title;
  $("[data-difficulty]").textContent = level.difficulty === "easy" ? "入门培育" : level.difficulty === "medium" ? "进阶培育" : "深海培育";
  if (evaluation.complete) message("全部孢群容量精确，整座苗圃正在盛放。", "good");
  else if (!evaluation.valid) message("警示环：有一簇已经过大，或已无法长到自己的容量。", "error");
  else message(`还差 ${evaluation.remaining} 格正式培育；候选孢子不算在内。`);
}

function renderTools() {
  const panel = $("[data-capacities]");
  panel.replaceChildren(...Array.from({ length: 9 }, (_, index) => {
    const value = index + 1;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = String(value);
    button.setAttribute("aria-pressed", String(selectedValue === value && !noteMode));
    button.setAttribute("aria-label", `选择 ${value} 格孢群容量`);
    button.innerHTML = `<i aria-hidden="true"></i><b>${value}</b><small>${value} 格</small>`;
    button.addEventListener("click", () => { selectedValue = value; noteMode = false; renderTools(); message(`已选择 ${value} 格孢群容量。`); });
    return button;
  }));
  const note = $("[data-note]");
  note.setAttribute("aria-pressed", String(noteMode));
  note.textContent = `候选孢子：${noteMode ? "开" : "关"}`;
}

function render() { renderLevels(); renderBoard(); renderTools(); }

function resetRunIfFinished() {
  if (!session.completed) return;
  session.runId = createRunId();
  session.completed = false;
  session.reported = false;
  session.completion = null;
}

function commit(result, action) {
  if (!result.changed) return false;
  resetRunIfFinished();
  session.state = result.state;
  session.timeline = [...session.timeline, action];
  session.completed = false;
  session.reported = false;
  session.completion = null;
  save();
  renderBoard();
  if (evaluateState(level, session.state).complete) completeRun();
  return true;
}

function activateCell(cell) {
  const result = noteMode && selectedValue > 0
    ? toggleCandidate(level, session.state, cell, selectedValue)
    : setValue(level, session.state, cell, selectedValue);
  if (!result.changed) {
    message(isGiven(level, cell) ? "带“核”标记的固定孢核不能修改。" : noteMode ? "候选只能写在空格中。" : "这个操作没有改变培育池。", "error");
    return;
  }
  if (noteMode) {
    session.state = result.state;
    save();
    renderBoard();
    return;
  }
  commit(result, { type: "fill", cell, value: selectedValue });
}

function undo() {
  if (!session.timeline.length) { message("还没有可撤销的正式培育。", "error"); return; }
  const notesBeforeUndo = session.state.notes;
  resetRunIfFinished();
  session.timeline = session.timeline.slice(0, -1);
  const replay = replayTimeline(level, session.timeline);
  if (!replay) { session = createSession(level, createRunId()); }
  else {
    session.state = restoreState(level, {
      values: replay.state.values,
      notes: notesBeforeUndo.map((note, cell) => replay.state.values[cell] === 0 && !isGiven(level, cell) ? note : 0),
      moves: replay.state.moves,
    });
    session.completed = replay.evaluation.complete;
    session.reported = false;
    session.completion = null;
  }
  save(); renderBoard();
  if (session.completed) completeRun();
}

function resetLevel() {
  session = createSession(level, createRunId());
  noteMode = false;
  selectedValue = 4;
  save(); render();
  message("已换上一池新的孢群培养液。\n");
}

function switchLevel(id) {
  const candidate = levelById(id);
  if (!candidate || candidate.id === level.id) return;
  level = candidate;
  session = createSession(level, createRunId());
  noteMode = false;
  selectedValue = 4;
  save(); render();
}

function focusStep(cell, dx, dy) {
  const x = cell % level.width + dx;
  const y = Math.floor(cell / level.width) + dy;
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return;
  board.querySelector(`[data-cell="${y * level.width + x}"]`)?.focus();
}

function handleCellKey(event, cell) {
  const direction = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] }[event.key];
  if (direction) { event.preventDefault(); focusStep(cell, ...direction); return; }
  if (/^[1-9]$/.test(event.key)) { event.preventDefault(); selectedValue = Number(event.key); noteMode = false; renderTools(); activateCell(cell); return; }
  if (["Backspace", "Delete", "0"].includes(event.key)) { event.preventDefault(); selectedValue = 0; noteMode = false; renderTools(); activateCell(cell); return; }
  if (event.key.toLowerCase() === "n") { event.preventDefault(); noteMode = !noteMode; if (!selectedValue) selectedValue = 4; renderTools(); return; }
  if (event.key === "Enter") { event.preventDefault(); activateCell(cell); }
}

function completeRun() {
  if (session.completed && session.reported) return;
  const payload = loadCompletionOutbox(storageAvailable ? storage : null)
    .find((entry) => entry.eventId === `${GAME_ID}:${session.runId}:complete`) ?? createCompletion(level, session);
  session.completed = true;
  const retained = enqueueCompletion(storageAvailable ? storage : null, payload);
  let delivered = false;
  if (retained.retained) {
    const response = deliverCompletion(window, retained.payload);
    delivered = response.delivered;
    if (delivered) removeCompletion(storage, payload.eventId);
  }
  session.reported = delivered;
  session.completion = { eventId: payload.eventId, delivered, completedAt: payload.completedAt };
  save();
  $("[data-win-copy]").textContent = `${level.title}以 ${session.state.moves} 步完成；建议线为 ${level.par} 步。首次通关、刷新个人最佳与达成建议线都会由稳定完成编号幂等结算。`;
  if (!winDialog.open) winDialog.showModal();
}

function flushCompletionOutbox() {
  if (!storageAvailable) return;
  for (const payload of loadCompletionOutbox(storage)) {
    const response = deliverCompletion(window, payload);
    if (response.delivered) removeCompletion(storage, payload.eventId);
  }
}

function renderTutorial() {
  const card = TUTORIALS[tutorialIndex];
  $("[data-tutorial-title]").textContent = card.title;
  const image = $("[data-tutorial-image]"); image.src = card.image; image.alt = card.alt;
  $("[data-tutorial-copy]").textContent = card.copy;
  $("[data-tutorial-bullets]").replaceChildren(...card.bullets.map((text) => { const item = document.createElement("li"); item.textContent = text; return item; }));
  $("[data-tutorial-position]").textContent = `${tutorialIndex + 1} / ${TUTORIALS.length}`;
  $("[data-tutorial-prev]").disabled = tutorialIndex === 0;
  $("[data-tutorial-next]").textContent = tutorialIndex === TUTORIALS.length - 1 ? "开始培育" : "下一张";
  $(".tutorial-shell").scrollTop = 0;
}

function openTutorial() {
  if (tutorialDialog.open || winDialog.open) return;
  tutorialIndex = 0;
  renderTutorial();
  tutorialDialog.showModal();
  $("[data-tutorial-next]").focus({ preventScroll: true });
}

function closeTutorial() {
  if (storageAvailable) markTutorialSeen(storage);
  if (tutorialDialog.open) tutorialDialog.close();
  $("#tutorial-button").focus({ preventScroll: true });
}

$("[data-note]").addEventListener("click", () => { noteMode = !noteMode; if (!selectedValue) selectedValue = 4; renderTools(); });
$("[data-clear]").addEventListener("click", () => { selectedValue = 0; noteMode = false; renderTools(); message("清除工具已选：点按一个非固定格即可恢复空白。") });
$("[data-undo]").addEventListener("click", undo);
$("[data-reset]").addEventListener("click", resetLevel);
$("#tutorial-button").addEventListener("click", openTutorial);
$("[data-tutorial-close]").addEventListener("click", closeTutorial);
$("[data-tutorial-prev]").addEventListener("click", () => { if (tutorialIndex) { tutorialIndex -= 1; renderTutorial(); } });
$("[data-tutorial-next]").addEventListener("click", () => { if (tutorialIndex < TUTORIALS.length - 1) { tutorialIndex += 1; renderTutorial(); } else closeTutorial(); });
tutorialDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeTutorial(); });
$("[data-win-close]").addEventListener("click", () => winDialog.close());
$("[data-win-next]").addEventListener("click", () => { winDialog.close(); switchLevel(nextLevel(level).id); });

render();
flushCompletionOutbox();
if (evaluateState(level, session.state).complete && !session.reported) completeRun();
window.addEventListener("realm:ready", flushCompletionOutbox);
window.addEventListener("ten-realms-v3:realm-ready", flushCompletionOutbox);
if (!tutorialSeen(storage)) window.setTimeout(openTutorial, 450);
