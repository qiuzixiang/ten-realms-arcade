import { LEVELS, levelById } from "./levels.mjs";
import {
  CELL, PHASE, applyAction, chordCell, flagCount, isWon, numberGrid, safeCellsLeft, undoState,
} from "./logic.mjs";
import {
  createRunId, createSession, historyForSession, normalizeSession, readJson, readJsonResult, STORAGE_KEYS, writeJson,
} from "./storage.mjs";
import {
  createCompletion, deliverCompletion, enqueueCompletion, loadCompletionOutbox, loadRecords, removeCompletion, settleLocalRecord,
} from "./completion.mjs";

const TUTORIALS = [
  {
    title: "读懂星域与读数",
    image: "./assets/tutorial-elements.svg?tutorial=1",
    alt: "舷窗零校准的真实初始勘测棋盘，首扫安全星域被标出",
    copy: "每个格子都是一块待测星域。扫描后出现的数字，表示它周围八格里潜伏的暗物质扰动数量。",
    bullets: ["第一个真正扫描的星域必定安全；若误点到扰动，仪器会先将它移到别处并重新计算。", "覆盖格、扫描读数、黄旗标记与红色失稳记录使用轮廓和图形共同区分。"],
  },
  {
    title: "一次扫描与零值扩展",
    image: "./assets/tutorial-action.svg?tutorial=1",
    alt: "对舷窗零校准的左上星域执行真实扫描后，零值自动扩展的状态",
    copy: "点按“扫描”后再点星域。读数为 0 的星域会自动展开相连的安全区域，边缘数字保留作下一步推理。",
    bullets: ["本图的真实操作为 scan:0，展开后仍有一格安全星域与四个未判定的扰动格。", "用“标记扰动”留下黄旗笔记；标记本身不会算作安全星域。"],
  },
  {
    title: "扫开全部安全星域",
    image: "./assets/tutorial-goal.svg?tutorial=1",
    alt: "舷窗零校准的真实通关状态，所有非扰动星域均已扫描，扰动以标记示意",
    copy: "只要全部非扰动星域被扫描，测绘就完成；旗帜帮助推理，但通关不强迫你把每个扰动都标出来。",
    bullets: ["已扫描的数字格可执行“合鸣扫描”：周围黄旗数量恰好等于读数时，会一起扫描余下邻格。", "错旗会让合鸣误触扰动；仍可撤销，红色失稳记录会留下来提醒本局曾有返工。"],
  },
];

const $ = (selector) => document.querySelector(selector);
const board = $("[data-board]");
const status = $("[data-status]");
const tutorialDialog = $(".tutorial-dialog[data-tutorial]");
const winDialog = $(".win-dialog[data-win]");
const tutorialButton = $("#tutorial-button");
let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
const loadedSession = readJsonResult(STORAGE_KEYS.session, null, storage);
let storageAvailable = loadedSession.available;
let session = normalizeSession(loadedSession.value, LEVELS) ?? createSession(LEVELS[0]);
let level = levelById(session.levelId);
let history = historyForSession(level, session.timeline);
let mode = "scan";
let focusIndex = level.firstSafe;
let tutorialIndex = 0;
let tutorialWaiter = null;
let records = loadRecords(storageAvailable ? storage : null);

function save() {
  if (!storageAvailable) return false;
  const retained = writeJson(STORAGE_KEYS.session, session, storage);
  storageAvailable = storageAvailable && retained;
  return retained;
}

function say(text, kind = "") {
  status.textContent = text;
  status.className = `status${kind ? ` is-${kind}` : ""}`;
}

function displayNumber(value) {
  if (value === 0) return '<i class="cell-empty" aria-hidden="true"></i>';
  return `<span class="cell-number" data-value="${value}">${value}</span>`;
}

function cellLabel(index, cell, numbers) {
  const row = Math.floor(index / level.width) + 1;
  const column = (index % level.width) + 1;
  const error = session.state.errors.includes(index) ? "；本局曾在此误触扰动" : "";
  if (cell === CELL.MARKED) return `第 ${row} 行第 ${column} 列，标记为扰动${error}`;
  if (cell === CELL.EXPLODED) return `第 ${row} 行第 ${column} 列，扰动失稳${error}`;
  if (cell === CELL.REVEALED) return `第 ${row} 行第 ${column} 列，周围八格读数 ${numbers[index]}${error}`;
  return `第 ${row} 行第 ${column} 列，未扫描星域${error}`;
}

function renderLevels() {
  const list = $("[data-levels]");
  list.replaceChildren(...LEVELS.map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.level = item.id;
    button.setAttribute("aria-current", String(item.id === level.id));
    button.innerHTML = `<b>${index + 1}</b><b>${item.title}</b><small>${item.difficulty}</small>`;
    button.addEventListener("click", () => switchLevel(item.id));
    return button;
  }));
}

function renderBoard({ focus = false } = {}) {
  const numbers = numberGrid(level, session.state.mines);
  board.style.setProperty("--cols", level.width);
  board.style.setProperty("--board-max", `${level.width * 58 + (level.width - 1) * 2}px`);
  board.setAttribute("aria-label", `${level.title}，${level.width} × ${level.height} 星域棋盘`);
  const cells = [];
  for (let index = 0; index < session.state.cells.length; index += 1) {
    const state = session.state.cells[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `survey-cell is-${state}${session.state.errors.includes(index) ? " has-error" : ""}`;
    button.dataset.index = String(index);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", cellLabel(index, state, numbers));
    button.setAttribute("aria-rowindex", String(Math.floor(index / level.width) + 1));
    button.setAttribute("aria-colindex", String(index % level.width + 1));
    if (state === CELL.REVEALED) button.innerHTML = displayNumber(numbers[index]);
    else if (state === CELL.MARKED) button.innerHTML = '<span class="cell-mark" aria-hidden="true">⚑</span>';
    else if (state === CELL.EXPLODED) button.innerHTML = '<span class="cell-burst" aria-hidden="true">✹</span>';
    button.addEventListener("click", () => actAt(index));
    button.addEventListener("contextmenu", (event) => { event.preventDefault(); markAt(index); });
    button.addEventListener("keydown", (event) => keyboardAct(event, index));
    cells.push(button);
  }
  board.replaceChildren(...cells);
  $("[data-moves]").textContent = String(session.state.moves);
  $("[data-safe]").textContent = String(safeCellsLeft(session.state, level));
  $("[data-flags]").textContent = String(flagCount(session.state));
  $("[data-level-title]").textContent = level.title;
  $("[data-difficulty]").textContent = level.difficulty;
  if (focus) board.querySelector(`[data-index="${focusIndex}"]`)?.focus({ preventScroll: true });
}

function renderTools() {
  document.querySelectorAll("[data-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
}

function renderRecords() {
  const item = records.wins[level.id];
  $("[data-records]").textContent = item
    ? `本扇区已完成 ${item.wins} 次；个人最佳 ${item.bestMoves} 次操作。再次以更少操作完成可刷新记录。`
    : "首次完成新扇区、刷新更少操作数，都会留在本机勘测日志。";
}

function render(options) {
  renderLevels();
  renderBoard(options);
  renderTools();
  renderRecords();
}

function updateSession(nextState, action) {
  history.push(session.state);
  session.timeline = [...session.timeline, action];
  session.state = nextState;
  session.completed = isWon(nextState, level);
  save();
}

function reportOutcome(result) {
  if (result.exploded?.length) {
    say("暗物质扰动被触发。可以撤销这次操作继续勘测；红色失稳记录会保留。", "error");
  } else if (result.relocated) {
    say("首扫保护已将扰动移位，并按新位置重新计算周围读数。", "good");
  } else if (result.opened?.length > 1) {
    say(`扫描展开了 ${result.opened.length} 个相连安全星域。`, "good");
  } else if (session.state.phase === PHASE.PLAYING) {
    say("读数已记录。继续用八向邻格关系推断扰动位置。");
  }
}

function commit(action, focus = true) {
  const result = applyAction(session.state, level, action);
  if (!result.changed) {
    if (session.state.phase === PHASE.LOST) say("勘测暂时失稳：撤销上一操作后才能继续。", "error");
    else if (session.state.phase === PHASE.WON) say("本扇区已经测绘完成；可撤销或重启以继续实验。", "good");
    else say("这个操作没有改变星域。", "error");
    return false;
  }
  focusIndex = action.index;
  updateSession(result.state, action);
  render({ focus });
  reportOutcome(result);
  if (session.completed) completeRun();
  return true;
}

function actAt(index) {
  focusIndex = index;
  const cell = session.state.cells[index];
  if (mode === "mark") { markAt(index); return; }
  commit({ type: cell === CELL.REVEALED ? "chord" : "scan", index });
}

function markAt(index) {
  focusIndex = index;
  commit({ type: "mark", index });
}

function chordAt(index = focusIndex) {
  focusIndex = index;
  const result = chordCell(session.state, level, index);
  if (!result.changed) {
    say("合鸣要求先选中已扫描的数字格，且周围黄旗数必须恰好等于读数。", "error");
    return;
  }
  updateSession(result.state, { type: "chord", index });
  render({ focus: true });
  reportOutcome(result);
  if (session.completed) completeRun();
}

function undo() {
  const previous = history.pop();
  if (!previous) { say("还没有可撤销的操作。", "error"); return; }
  session.state = undoState(previous, session.state, level);
  session.timeline = [...session.timeline, { type: "undo" }];
  session.completed = isWon(session.state, level);
  save();
  render({ focus: true });
  if (session.state.errors.length) say("已撤销位置，但红色失稳记录保留在本局日志中。", "good");
  else say("已撤销上一项勘测操作。", "good");
  if (session.completed) completeRun();
}

function switchLevel(id) {
  level = levelById(id);
  session = createSession(level, createRunId());
  history = [];
  focusIndex = level.firstSafe;
  if (winDialog.open) winDialog.close();
  save();
  render();
  say("已载入新的固定勘测扇区；每一关均可用本地读数推断完成。");
}

function resetLevel() {
  session = createSession(level, createRunId());
  history = [];
  focusIndex = level.firstSafe;
  if (winDialog.open) winDialog.close();
  save();
  render();
  say("本次勘测已重新开始；首扫保护重新待命。", "good");
}

function keyboardAct(event, index) {
  const directions = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] };
  if (directions[event.key]) {
    event.preventDefault();
    const [dx, dy] = directions[event.key];
    const x = index % level.width + dx;
    const y = Math.floor(index / level.width) + dy;
    if (x >= 0 && x < level.width && y >= 0 && y < level.height) {
      focusIndex = y * level.width + x;
      board.querySelector(`[data-index="${focusIndex}"]`)?.focus();
    }
    return;
  }
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); actAt(index); return; }
  if (event.key.toLowerCase() === "m") { event.preventDefault(); setMode(mode === "scan" ? "mark" : "scan"); return; }
  if (event.key.toLowerCase() === "c") { event.preventDefault(); chordAt(index); return; }
  if (event.key.toLowerCase() === "u") { event.preventDefault(); undo(); return; }
  if (event.key === "Escape") { event.preventDefault(); setMode("scan"); }
}

function setMode(nextMode) {
  mode = nextMode;
  renderTools();
  say(mode === "mark" ? "标记模式已启用：点按覆盖格可切换黄旗。" : "扫描模式已启用：点按数字格可尝试合鸣。", "good");
}

function resultMessage(local) {
  if (local.firstClear) return "首次完成，已记入本机勘测日志。";
  if (local.personalBest) return "个人最佳已刷新，新的扫描轨迹已存档。";
  if (local.duplicate) return "同一份完成记录已去重；不会重复计入奖励。";
  return "完成轨迹已记入本机勘测日志。";
}

function completeRun() {
  if (!session.completed) return;
  const completedAt = session.completedAt ?? new Date().toISOString();
  session.completedAt = completedAt;
  save();
  const eventId = `stardust-survey:${session.runId}:complete`;
  let local = { firstClear: false, personalBest: false, duplicate: false, retained: false };
  if (!session.reported) {
    const payload = loadCompletionOutbox(storageAvailable ? storage : null).find((item) => item.eventId === eventId)
      ?? createCompletion(level, session, 0, completedAt);
    local = settleLocalRecord(storageAvailable ? storage : null, payload);
    records = local.records ?? records;
    const queued = local.retained || local.duplicate
      ? enqueueCompletion(storageAvailable ? storage : null, payload)
      : { retained: false };
    if (queued.retained) {
      const delivery = deliverCompletion(window, payload);
      if (delivery.delivered && removeCompletion(storage, payload.eventId).removed) session.reported = true;
    }
    save();
    renderRecords();
  }
  const diagnostics = session.state.errors.length ? `本局保留 ${session.state.errors.length} 次失稳记录；` : "本局无失稳记录；";
  $("[data-win-copy]").textContent = `${level.title}以 ${session.state.moves} 次操作完成，建议参考线为 ${level.par} 次。${diagnostics}${resultMessage(local)}`;
  if (!winDialog.open) winDialog.showModal();
}

function flushCompletionOutbox() {
  if (!storageAvailable) return;
  for (const payload of loadCompletionOutbox(storage)) {
    const delivery = deliverCompletion(window, payload);
    if (!delivery.delivered) continue;
    const removed = removeCompletion(storage, payload.eventId);
    if (removed.removed && payload.eventId === `stardust-survey:${session.runId}:complete`) {
      session.reported = true;
      save();
    }
  }
}

function renderTutorial() {
  const card = TUTORIALS[tutorialIndex];
  $("[data-tutorial-title]").textContent = card.title;
  const image = $("[data-tutorial-image]");
  image.src = card.image;
  image.alt = card.alt;
  $("[data-tutorial-copy]").textContent = card.copy;
  $("[data-tutorial-bullets]").replaceChildren(...card.bullets.map((text) => { const item = document.createElement("li"); item.textContent = text; return item; }));
  $("[data-tutorial-position]").textContent = `${tutorialIndex + 1} / ${TUTORIALS.length}`;
  $("[data-tutorial-prev]").disabled = tutorialIndex === 0;
  $("[data-tutorial-next]").textContent = tutorialIndex === TUTORIALS.length - 1 ? "开始勘测" : "下一张";
  $(".tutorial-shell").scrollTop = 0;
}

function otherDialogOpen() {
  return [...document.querySelectorAll("dialog[open]")].some((dialog) => dialog !== tutorialDialog);
}

function openTutorial(auto = false) {
  if (tutorialDialog.open) return;
  if (otherDialogOpen()) {
    if (auto && !tutorialWaiter) {
      tutorialWaiter = new MutationObserver(() => {
        if (otherDialogOpen()) return;
        tutorialWaiter.disconnect();
        tutorialWaiter = null;
        openTutorial(true);
      });
      tutorialWaiter.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    }
    return;
  }
  tutorialIndex = 0;
  renderTutorial();
  tutorialDialog.showModal();
  $("[data-tutorial-next]").focus({ preventScroll: true });
}

function closeTutorial() {
  if (storageAvailable) writeJson(STORAGE_KEYS.tutorial, "seen-v1", storage);
  if (tutorialDialog.open) tutorialDialog.close();
  tutorialButton.focus({ preventScroll: true });
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
$("[data-chord]").addEventListener("click", () => chordAt());
$("[data-undo]").addEventListener("click", undo);
$("[data-reset]").addEventListener("click", resetLevel);
tutorialButton.addEventListener("click", () => openTutorial(false));
$("[data-tutorial-close]").addEventListener("click", closeTutorial);
$("[data-tutorial-prev]").addEventListener("click", () => { if (tutorialIndex) { tutorialIndex -= 1; renderTutorial(); } });
$("[data-tutorial-next]").addEventListener("click", () => { if (tutorialIndex < TUTORIALS.length - 1) { tutorialIndex += 1; renderTutorial(); } else closeTutorial(); });
tutorialDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeTutorial(); });
$("[data-win-close]").addEventListener("click", () => winDialog.close());
$("[data-win-next]").addEventListener("click", () => {
  winDialog.close();
  const index = LEVELS.findIndex((item) => item.id === level.id);
  switchLevel(LEVELS[(index + 1) % LEVELS.length].id);
});

render();
flushCompletionOutbox();
if (session.completed && !session.reported) completeRun();
window.addEventListener("realm:ready", flushCompletionOutbox);
window.addEventListener("ten-realms-v3:realm-ready", flushCompletionOutbox);
if (readJson(STORAGE_KEYS.tutorial, null, storage) !== "seen-v1") window.setTimeout(() => openTutorial(true), 520);
