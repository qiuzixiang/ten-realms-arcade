import { LEVELS, levelById, nextLevel } from "./levels.mjs";
import { BLACK, UNKNOWN, WHITE_MARK, beamForClue, createState, cycleMark, evaluateState, isClue, replayTimeline, setMark } from "./logic.mjs";
import { createRunId, createSession, markTutorialSeen, normalizeSession, readJsonResult, saveSession, tutorialSeen } from "./storage.mjs";
import { createCompletion, deliverCompletion, enqueueCompletion, loadCompletionOutbox, removeCompletion } from "./completion.mjs";

const GAME_ID = "eclipse-watch";
const TUTORIALS = Object.freeze([
  Object.freeze({ title: "读数灯与三种标记", image: "./assets/tutorial-elements.svg", alt: "初蚀光幕的真实初始棋盘，包含读数灯与未知格", copy: "数字灯永远是白格。它的读数包括自己，并沿上下左右一直数到边界或黑影为止。", bullets: ["黑影不能正交相邻；所有非黑格必须形成一个连通的白色区域。", "未知格与白点笔记都不会截断光束。"] }),
  Object.freeze({ title: "用黑影截断一束光", image: "./assets/tutorial-action.svg", alt: "在初蚀光幕真实首关把内部格二标为黑影后，光束读数变化", copy: "选择黑影标记并点按非线索格，即可让穿过该格的光束停下。棋盘会实时高亮当前选中读数灯看到的格。", bullets: ["本图真实操作：将内部格 2 标为黑影（mark:2:1）。", "白点笔记仅是推理辅助，不改变读数，也不会单独带来胜利。"] }),
  Object.freeze({ title: "全部读数同时合格", image: "./assets/tutorial-goal.svg", alt: "初蚀光幕真实完整解，所有读数准确、黑格互不相邻且白格连通", copy: "当每盏读数灯都准确、黑影彼此不接触、所有白格仍连通，巡检完成。", bullets: ["未知白格并不是“额外白点”；原规则的光束只由黑影截断。", "这张通关图来自真实首关答案，并由独立二色搜索器复证唯一。"] }),
]);

const $ = (selector) => document.querySelector(selector);
const board = $("[data-board]");
const status = $("[data-status]");
const tutorialDialog = $(".tutorial-dialog[data-tutorial]");
const winDialog = $(".win-dialog[data-win]");
let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
const initialRead = readJsonResult("ten-realms-v3:games:eclipse-watch:session:v1", null, storage);
let storageAvailable = initialRead.available;
let session = normalizeSession(initialRead.value, LEVELS) ?? createSession(LEVELS[0]);
let level = levelById(session.levelId) ?? LEVELS[0];
let selectedMark = BLACK;
let activeClue = level.clues[0][0];
let tutorialIndex = 0;

function save() { if (!storageAvailable) return false; const saved = saveSession(storage, session); storageAvailable = storageAvailable && saved; return saved; }
function message(text, kind = "") { status.textContent = text; status.className = `status${kind ? ` is-${kind}` : ""}`; }
function markLabel(mark) { return mark === BLACK ? "黑影" : mark === WHITE_MARK ? "白点笔记" : "未知"; }

function renderLevels() {
  const list = $("[data-levels]");
  list.replaceChildren(...LEVELS.map((candidate, index) => {
    const button = document.createElement("button"); button.type = "button"; button.dataset.level = candidate.id; button.setAttribute("aria-current", String(candidate.id === level.id));
    button.innerHTML = `<b>${index + 1}</b><span><strong></strong><small></small></span>`; button.querySelector("strong").textContent = candidate.title; button.querySelector("small").textContent = candidate.subtitle;
    button.addEventListener("click", () => switchLevel(candidate.id)); return button;
  }));
}

function renderBoard() {
  const evaluation = evaluateState(level, session.state);
  const activeBeam = beamForClue(level, session.state, activeClue);
  const lit = new Set(activeBeam.cells);
  const warning = new Set(evaluation.errors.flatMap((error) => error.cells));
  const readings = new Map(evaluation.readings.map((reading) => [reading.cell, reading]));
  board.style.setProperty("--columns", level.width);
  board.replaceChildren(...Array.from({ length: level.width * level.height }, (_, cell) => {
    const mark = session.state.marks[cell]; const clue = isClue(level, cell); const button = document.createElement("button");
    button.type = "button"; button.className = "eclipse-cell"; button.dataset.cell = String(cell); button.dataset.mark = String(mark);
    if (clue) button.classList.add("is-clue"); if (mark === BLACK) button.classList.add("is-black"); if (mark === WHITE_MARK && !clue) button.classList.add("is-white-note"); if (lit.has(cell) && mark !== BLACK) button.classList.add("is-lit"); if (cell === activeClue) button.classList.add("is-active-clue"); if (warning.has(cell)) button.classList.add("is-warning");
    const x = cell % level.width + 1; const y = Math.floor(cell / level.width) + 1;
    const reading = readings.get(cell);
    button.setAttribute("aria-label", clue ? `第 ${y} 行第 ${x} 列，读数灯 ${reading.target}，当前可见 ${reading.count} 格${cell === activeClue ? "，当前光束已高亮" : ""}` : `第 ${y} 行第 ${x} 列，${markLabel(mark)}`);
    if (clue) button.innerHTML = `<span class="ray-star" aria-hidden="true">✦</span><b>${reading.target}</b><small>${reading.count}/${reading.target}</small>`;
    else if (mark === BLACK) button.innerHTML = "<span class=\"black-mark\" aria-hidden=\"true\"></span>";
    else if (mark === WHITE_MARK) button.innerHTML = "<span class=\"white-dot\" aria-hidden=\"true\">·</span>";
    else button.innerHTML = "<span class=\"unknown-mark\" aria-hidden=\"true\">+</span>";
    button.addEventListener("click", () => activateCell(cell));
    button.addEventListener("contextmenu", (event) => { event.preventDefault(); if (!clue) cycleCell(cell, true); });
    button.addEventListener("keydown", (event) => handleCellKey(event, cell));
    return button;
  }));
  $("[data-moves]").textContent = String(session.state.moves);
  $("[data-lights]").textContent = `${evaluation.readings.filter((reading) => reading.count === reading.target).length}/${level.clues.length}`;
  $("[data-level-title]").textContent = level.title;
  $("[data-difficulty]").textContent = level.difficulty === "easy" ? "入门巡检" : level.difficulty === "medium" ? "进阶巡检" : "全蚀巡检";
  if (evaluation.complete) message("所有光束准确，黑影隔离且白色巡界完整连通。", "good");
  else if (evaluation.errors.some((error) => error.type === "adjacent-black")) message("黑影警报：两个黑影不能正交相邻。", "error");
  else if (evaluation.errors.some((error) => error.type === "disconnected-white")) message("巡界断开：所有白格必须能沿白格彼此抵达。", "error");
  else message(`当前读数灯 ${activeBeam.target} 可见 ${activeBeam.count} 格；点击另一盏灯可切换光束。`);
}

function renderTools() { document.querySelectorAll("[data-mark]").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.mark) === selectedMark))); }
function render() { renderLevels(); renderBoard(); renderTools(); }

function resetRunIfBroken(wasComplete, nextComplete) {
  if (wasComplete && !nextComplete) { session.runId = createRunId(); session.completed = false; session.reported = false; session.completion = null; }
}

function commit(result, action) {
  if (!result.changed) return false;
  const wasComplete = session.completed && evaluateState(level, session.state).complete;
  const nextComplete = evaluateState(level, result.state).complete;
  resetRunIfBroken(wasComplete, nextComplete);
  session.state = result.state; session.timeline = [...session.timeline, action]; session.completed = nextComplete;
  if (!nextComplete) { session.reported = false; session.completion = null; }
  save(); renderBoard();
  if (nextComplete && !session.reported) completeRun();
  return true;
}

function activateCell(cell) {
  if (isClue(level, cell)) { activeClue = cell; renderBoard(); message(`已选读数灯 ${level.clueByCell[cell]}；亮起的格都在它真实可见范围中。`); return; }
  const result = setMark(level, session.state, cell, selectedMark);
  if (!result.changed) { message("这个格已经是当前标记；线索灯本身不能改动。", "error"); return; }
  commit(result, { type: "mark", cell, mark: selectedMark });
}

function cycleCell(cell, backward = false) {
  const result = cycleMark(level, session.state, cell, backward);
  if (result.changed) commit(result, { type: "mark", cell, mark: result.state.marks[cell] });
}

function undo() {
  if (!session.timeline.length) { message("还没有可撤销的标记。", "error"); return; }
  const wasComplete = session.completed && evaluateState(level, session.state).complete;
  const timeline = session.timeline.slice(0, -1); const replay = replayTimeline(level, timeline);
  if (!replay) { session = createSession(level, createRunId()); }
  else {
    resetRunIfBroken(wasComplete, replay.evaluation.complete);
    session.timeline = timeline; session.state = replay.state; session.completed = replay.evaluation.complete;
    if (!session.completed) { session.reported = false; session.completion = null; }
  }
  save(); renderBoard(); if (session.completed && !session.reported) completeRun();
}

function resetLevel() { session = createSession(level, createRunId()); selectedMark = BLACK; activeClue = level.clues[0][0]; save(); render(); message("巡检档已恢复到初始光照。"); }
function switchLevel(id) { const candidate = levelById(id); if (!candidate || candidate.id === level.id) return; level = candidate; session = createSession(level, createRunId()); selectedMark = BLACK; activeClue = level.clues[0][0]; save(); render(); }
function focusStep(cell, dx, dy) { const x = cell % level.width + dx; const y = Math.floor(cell / level.width) + dy; if (x >= 0 && y >= 0 && x < level.width && y < level.height) board.querySelector(`[data-cell="${y * level.width + x}"]`)?.focus(); }
function handleCellKey(event, cell) {
  const vector = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] }[event.key];
  if (vector) { event.preventDefault(); focusStep(cell, ...vector); return; }
  if (event.key.toLowerCase() === "b") { event.preventDefault(); selectedMark = BLACK; renderTools(); activateCell(cell); return; }
  if (event.key.toLowerCase() === "w" || event.key === " ") { event.preventDefault(); selectedMark = WHITE_MARK; renderTools(); activateCell(cell); return; }
  if (["Backspace", "Delete", "0"].includes(event.key)) { event.preventDefault(); selectedMark = UNKNOWN; renderTools(); activateCell(cell); return; }
  if (event.key === "Enter") { event.preventDefault(); activateCell(cell); }
}

function selectNextClue() { const index = level.clues.findIndex(([cell]) => cell === activeClue); activeClue = level.clues[(Math.max(index, 0) + 1) % level.clues.length][0]; renderBoard(); }
function completeRun() {
  if (session.completed && session.reported) return;
  const payload = loadCompletionOutbox(storageAvailable ? storage : null).find((entry) => entry.eventId === `${GAME_ID}:${session.runId}:complete`) ?? createCompletion(level, session);
  session.completed = true; const retained = enqueueCompletion(storageAvailable ? storage : null, payload); let delivered = false;
  if (retained.retained) { const response = deliverCompletion(window, retained.payload); delivered = response.delivered; if (delivered) removeCompletion(storage, payload.eventId); }
  session.reported = delivered; session.completion = { eventId: payload.eventId, delivered, completedAt: payload.completedAt }; save();
  $("[data-win-copy]").textContent = `${level.title}以 ${session.state.moves} 次黑影操作完成；建议线为 ${level.par}。白点笔记不计步、不参与胜利，首次通关和效率记录均按稳定完成编号幂等结算。`;
  if (!winDialog.open) winDialog.showModal();
}
function flushCompletionOutbox() { if (!storageAvailable) return; for (const payload of loadCompletionOutbox(storage)) { const response = deliverCompletion(window, payload); if (response.delivered) removeCompletion(storage, payload.eventId); } }

function renderTutorial() { const card = TUTORIALS[tutorialIndex]; $("[data-tutorial-title]").textContent = card.title; const image = $("[data-tutorial-image]"); image.src = card.image; image.alt = card.alt; $("[data-tutorial-copy]").textContent = card.copy; $("[data-tutorial-bullets]").replaceChildren(...card.bullets.map((text) => { const item = document.createElement("li"); item.textContent = text; return item; })); $("[data-tutorial-position]").textContent = `${tutorialIndex + 1} / ${TUTORIALS.length}`; $("[data-tutorial-prev]").disabled = tutorialIndex === 0; $("[data-tutorial-next]").textContent = tutorialIndex === TUTORIALS.length - 1 ? "开始巡检" : "下一张"; $(".tutorial-shell").scrollTop = 0; }
function openTutorial() { if (tutorialDialog.open || winDialog.open) return; tutorialIndex = 0; renderTutorial(); tutorialDialog.showModal(); $("[data-tutorial-next]").focus({ preventScroll: true }); }
function closeTutorial() { if (storageAvailable) markTutorialSeen(storage); if (tutorialDialog.open) tutorialDialog.close(); $("#tutorial-button").focus({ preventScroll: true }); }

document.querySelectorAll("[data-mark]").forEach((button) => button.addEventListener("click", () => { selectedMark = Number(button.dataset.mark); renderTools(); message(`已选择${markLabel(selectedMark)}。`); }));
$("[data-undo]").addEventListener("click", undo); $("[data-reset]").addEventListener("click", resetLevel); $("[data-focus]").addEventListener("click", selectNextClue);
$("#tutorial-button").addEventListener("click", openTutorial); $("[data-tutorial-close]").addEventListener("click", closeTutorial); $("[data-tutorial-prev]").addEventListener("click", () => { if (tutorialIndex) { tutorialIndex -= 1; renderTutorial(); } }); $("[data-tutorial-next]").addEventListener("click", () => { if (tutorialIndex < TUTORIALS.length - 1) { tutorialIndex += 1; renderTutorial(); } else closeTutorial(); }); tutorialDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeTutorial(); });
$("[data-win-close]").addEventListener("click", () => winDialog.close()); $("[data-win-next]").addEventListener("click", () => { winDialog.close(); switchLevel(nextLevel(level).id); });

render(); flushCompletionOutbox(); if (evaluateState(level, session.state).complete && !session.reported) completeRun(); window.addEventListener("realm:ready", flushCompletionOutbox); window.addEventListener("ten-realms-v3:realm-ready", flushCompletionOutbox); if (!tutorialSeen(storage)) window.setTimeout(openTutorial, 450);
