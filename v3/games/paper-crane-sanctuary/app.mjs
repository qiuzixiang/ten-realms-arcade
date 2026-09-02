import { CELL, applyMove, cellAt, cellKey, createState, evaluateState, moveKey, parseCellKey, replayMoves } from "./logic.mjs";
import { DIFFICULTIES, LEVELS, difficultyForLevel, findLevel, levelsForDifficulty, nextLevel } from "./levels.mjs";
import { createRunId, loadRecords, loadSession, loadSettings, markTutorialSeen, recordCompletion, saveRecords, saveSession, saveSettings, tutorialSeen } from "./storage.mjs";
import { createCompletionPayload, flushOutbox, publishPersistedCompletion } from "./completion.mjs";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const elements = Object.freeze({
  board: document.querySelector("#crane-board"), boardWrap: document.querySelector("#board-wrap"),
  levelKicker: document.querySelector("#level-kicker"), levelTitle: document.querySelector("#level-title"), levelSeed: document.querySelector("#level-seed"),
  statusTitle: document.querySelector("#status-title"), statusCopy: document.querySelector("#status-copy"), saveStatus: document.querySelector("#save-status"),
  craneCount: document.querySelector("#crane-count"), legalCount: document.querySelector("#legal-count"), moveCount: document.querySelector("#move-count"), timer: document.querySelector("#timer-value"),
  difficultyButtons: document.querySelector("#difficulty-buttons"), difficultyNote: document.querySelector("#difficulty-note"),
  newLevel: document.querySelector("#new-level-button"), undo: document.querySelector("#undo-button"), restart: document.querySelector("#restart-button"), mute: document.querySelector("#mute-button"),
  tutorialButton: document.querySelector("#tutorial-button"), rulesButton: document.querySelector("#rules-button"), sealGrid: document.querySelector("#seal-grid"), toast: document.querySelector("#toast"),
  rulesDialog: document.querySelector("#rules-dialog"), rulesClose: document.querySelector("#rules-close-button"),
  tutorialDialog: document.querySelector("#tutorial-dialog"), tutorialSkip: document.querySelector("#tutorial-skip-button"), tutorialPrevious: document.querySelector("#tutorial-previous-button"), tutorialNext: document.querySelector("#tutorial-next-button"), tutorialCounter: document.querySelector("#tutorial-counter"), tutorialImage: document.querySelector("#tutorial-image"), tutorialStep: document.querySelector("#tutorial-step"), tutorialTitle: document.querySelector("#tutorial-title"), tutorialBody: document.querySelector("#tutorial-body"), tutorialBullets: document.querySelector("#tutorial-bullets"),
  victoryDialog: document.querySelector("#victory-dialog"), victoryLevel: document.querySelector("#victory-level"), victoryMoves: document.querySelector("#victory-moves"), victoryTime: document.querySelector("#victory-time"), victoryStyle: document.querySelector("#victory-style"), nextLevel: document.querySelector("#next-level-button"), stay: document.querySelector("#stay-button"),
});

const TUTORIAL = Object.freeze([
  Object.freeze({ step: "01 · 认识庭院", title: "分清纸鹤、空栖位与断台", body: "真实第一关有八只纸鹤和三个空栖位。暗色断台不可进入。", bullets: ["纸鹤有清晰的双翼轮廓", "空栖位以虚线圆环表示"], image: "./assets/tutorial-elements.svg?tutorial=1", alt: "初羽回廊真实初始状态：八只纸鹤、三个空栖位和断台" }),
  Object.freeze({ step: "02 · 一次合法跳跃", title: "正交越过一鹤，落到紧接空位", body: "第一关坐标 3,0 的纸鹤竖直越过 3,1，落到 3,2。起点和被跨位置同时变空。", bullets: ["斜跳、远跳与跨空位都无效", "每次合法跳跃恰好少一只纸鹤"], image: "./assets/tutorial-operation.svg?tutorial=1", alt: "初羽回廊真实操作前后对比：3,0 跳到 3,2，纸鹤由八只变七只" }),
  Object.freeze({ step: "03 · 真实归巢", title: "任意位置只剩一鹤就通关", body: "回放第一关七次合法跳跃后，庭中只剩一只纸鹤。最后位置不必是中心。", bullets: ["通关步数由初始纸鹤数固定", "本作不设置少步或最短路线奖励"], image: "./assets/tutorial-goal.svg?tutorial=1", alt: "初羽回廊真实完成状态：七次跳跃后任意位置只剩一只纸鹤" }),
]);

let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
let settings = loadSettings(storage);
let records = loadRecords(storage);
const restored = loadSession(storage, findLevel);
let level = restored?.level ?? findLevel(settings.lastLevelId) ?? levelsForDifficulty(settings.difficulty)[0] ?? LEVELS[0];
if (level.difficulty !== settings.difficulty) settings.difficulty = level.difficulty;
let session = restored ?? newSession(level);
let state = session.state;
let selectedKey = null;
let activeKey = firstPlayableKey(state);
let resumedAt = Date.now();
let tutorialIndex = 0;
let toastTimer = 0;
let audio = null;
let focusBeforeDialog = null;

function newSession(next, restartCount = 0) {
  return { level: next, runId: createRunId(next.id), moves: [], state: createState(next), elapsedMs: 0, undoCount: 0, restartCount, completion: null };
}

function firstPlayableKey(board) {
  for (let y = 0; y < board.height; y += 1) for (let x = 0; x < board.width; x += 1) if (cellAt(board, { x, y }) !== CELL.BLOCKED) return cellKey(x, y);
  return "0,0";
}

function elapsed(now = Date.now()) {
  if (session.completion) return session.elapsedMs;
  return session.elapsedMs + Math.max(0, now - resumedAt);
}

function formatTime(value) {
  const seconds = Math.floor(Math.max(0, value) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function syncClock(now = Date.now()) {
  if (!session.completion) { session.elapsedMs = elapsed(now); resumedAt = now; }
}

function persist(message = "航迹已保存") {
  syncClock();
  session.state = state;
  const saved = saveSession(storage, session);
  elements.saveStatus.textContent = saved ? message : "本机存档暂不可用，当前仍可游玩";
  return saved;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2300);
}

function tone(frequency, duration = .12) {
  if (settings.muted) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audio ??= new AudioContextClass();
  if (audio.state === "suspended") audio.resume().catch(() => {});
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.018, audio.currentTime + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + duration + .02);
}

function buildDifficultyButtons() {
  elements.difficultyButtons.replaceChildren(...DIFFICULTIES.map((difficulty) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = difficulty.label;
    button.dataset.difficulty = difficulty.id;
    button.addEventListener("click", () => changeDifficulty(difficulty.id));
    return button;
  }));
}

function legalTargetKeys() {
  if (!selectedKey) return new Set();
  return new Set(evaluateState(state).availableMoves.filter((move) => cellKey(move.from.x, move.from.y) === selectedKey).map((move) => cellKey(move.to.x, move.to.y)));
}

function renderBoard(landedKey = null) {
  const targets = legalTargetKeys();
  elements.board.style.setProperty("--board-columns", String(state.width));
  elements.board.style.setProperty("--board-rows", String(state.height));
  elements.board.setAttribute("aria-rowcount", String(state.height));
  elements.board.setAttribute("aria-colcount", String(state.width));
  const nodes = [];
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const value = cellAt(state, { x, y });
      const key = cellKey(x, y);
      if (value === CELL.BLOCKED) {
        const blocked = document.createElement("span");
        blocked.className = "blocked-cell";
        blocked.setAttribute("aria-hidden", "true");
        nodes.push(blocked);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "board-cell";
      button.dataset.key = key;
      button.dataset.cell = value;
      button.setAttribute("role", "gridcell");
      button.tabIndex = key === activeKey ? 0 : -1;
      button.setAttribute("aria-selected", key === selectedKey ? "true" : "false");
      button.setAttribute("aria-label", `第 ${y + 1} 行第 ${x + 1} 列，${value === CELL.PEG ? "纸鹤" : targets.has(key) ? "空栖位，可作为当前纸鹤落点" : "空栖位"}`);
      if (value === CELL.PEG) button.innerHTML = '<span class="crane-shape" aria-hidden="true"></span>';
      if (key === selectedKey) button.classList.add("is-selected");
      if (targets.has(key)) button.classList.add("is-target");
      if (key === landedKey) button.classList.add("is-landed");
      button.addEventListener("focus", () => { activeKey = key; updateTabStops(); });
      button.addEventListener("click", () => activateCell(key, button));
      nodes.push(button);
    }
  }
  elements.board.replaceChildren(...nodes);
}

function updateTabStops() {
  for (const button of elements.board.querySelectorAll(".board-cell")) button.tabIndex = button.dataset.key === activeKey ? 0 : -1;
}

function renderStatus() {
  const evaluation = evaluateState(state);
  const difficulty = difficultyForLevel(level);
  const pool = levelsForDifficulty(level.difficulty);
  const index = pool.findIndex((item) => item.id === level.id);
  elements.levelKicker.textContent = `${difficulty.label} · ${String(index + 1).padStart(2, "0")}`;
  elements.levelTitle.textContent = level.title;
  elements.levelSeed.textContent = level.seed;
  elements.craneCount.textContent = String(evaluation.cranes);
  elements.legalCount.textContent = String(evaluation.availableMoves.length);
  elements.moveCount.textContent = String(state.moveCount);
  elements.timer.textContent = formatTime(elapsed());
  elements.undo.disabled = session.moves.length === 0;
  elements.difficultyNote.textContent = difficulty.note;
  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    const active = button.dataset.difficulty === level.difficulty;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  if (evaluation.complete) {
    elements.statusTitle.textContent = "最后一鹤已归巢";
    elements.statusCopy.textContent = "任意位置只剩一只纸鹤，规则条件已经完整满足。";
  } else if (evaluation.deadEnd) {
    elements.statusTitle.textContent = "月风暂歇";
    elements.statusCopy.textContent = "当前没有合法跳跃；撤销一步或重新开局即可继续。";
  } else if (selectedKey) {
    elements.statusTitle.textContent = "已选起飞纸鹤";
    elements.statusCopy.textContent = "发光圆环是它当前能够抵达的真实空栖位。";
  } else {
    elements.statusTitle.textContent = "等待起飞";
    elements.statusCopy.textContent = level.note;
  }
}

function renderArchive() {
  elements.sealGrid.replaceChildren(...LEVELS.map((item) => {
    const seal = document.createElement("span");
    seal.className = `seal${records.levels[item.id] ? " is-earned" : ""}`;
    seal.textContent = item.title;
    seal.setAttribute("aria-label", `${item.title}，${records.levels[item.id] ? "已归巢" : "尚未归巢"}`);
    return seal;
  }));
}

function render(landedKey = null) {
  renderBoard(landedKey);
  renderStatus();
  renderArchive();
}

function markInvalid(button, message) {
  button?.classList.remove("is-invalid");
  window.requestAnimationFrame(() => button?.classList.add("is-invalid"));
  elements.statusCopy.textContent = message;
  tone(145, .1);
}

function activateCell(key, button) {
  if (evaluateState(state).complete) return;
  const point = parseCellKey(key);
  const value = cellAt(state, point);
  activeKey = key;
  if (value === CELL.PEG) {
    selectedKey = selectedKey === key ? null : key;
    tone(selectedKey ? 520 : 360, .08);
    render();
    document.querySelector(`[data-key="${activeKey}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (!selectedKey) { markInvalid(button, "先选择一只纸鹤，再选择它的发光落点。"); return; }
  const from = parseCellKey(selectedKey);
  const result = applyMove(state, { from, to: point });
  if (!result.changed) { markInvalid(button, "这不是正交跨过一只同伴后紧接的空栖位。"); return; }
  state = result.state;
  session.moves.push(moveKey(result.move));
  session.state = state;
  selectedKey = null;
  activeKey = key;
  tone(720, .16);
  persist();
  render(key);
  document.querySelector(`[data-key="${activeKey}"]`)?.focus({ preventScroll: true });
  if (evaluateState(state).complete) completeRun();
}

function completeRun(presentVictory = true) {
  if (!evaluateState(state).complete || session.completion?.delivered) return false;
  syncClock();
  const eventId = `paper-crane-sanctuary:${session.runId}:complete`;
  const completedAt = session.completion?.completedAt
    ?? records.settledEvents[eventId]
    ?? new Date();
  const payload = createCompletionPayload({ level, runId: session.runId, state, moves: session.moves, elapsedMs: session.elapsedMs, undoCount: session.undoCount, restartCount: session.restartCount, completedAt });
  const local = recordCompletion(records, payload);
  records = local.records;
  const recordsSaved = saveRecords(storage, records);
  session.completion = { runId: session.runId, eventId: payload.eventId, completedAt: payload.completedAt, delivered: false };
  const sessionSaved = persist("归巢记录已封存");
  const delivery = publishPersistedCompletion(window, storage, payload, { recordsSaved, sessionSaved });
  if (delivery.delivered) {
    session.completion.delivered = true;
    persist("归巢印记已交付成长图鉴");
  }
  renderArchive();
  if (!presentVictory) return recordsSaved && sessionSaved;
  elements.victoryLevel.textContent = level.title;
  elements.victoryMoves.textContent = `${state.moveCount} 次`;
  elements.victoryTime.textContent = formatTime(session.elapsedMs);
  elements.victoryStyle.textContent = session.undoCount === 0 ? "一气呵成" : "完整归巢";
  tone(880, .5);
  window.setTimeout(() => openDialog(elements.victoryDialog, elements.nextLevel), reduceMotion.matches ? 0 : 360);
  return recordsSaved && sessionSaved;
}

function undo() {
  if (!session.moves.length) return;
  const completedRun = Boolean(session.completion);
  session.moves.pop();
  session.undoCount += 1;
  if (completedRun) {
    session.runId = createRunId(level.id);
    session.completion = null;
    resumedAt = Date.now();
  }
  state = replayMoves(level, session.moves) ?? createState(level);
  session.state = state;
  selectedKey = null;
  closeDialog(elements.victoryDialog, false);
  persist("已撤销并保存");
  tone(410, .12);
  render();
}

function startLevel(next, restartCount = 0) {
  closeDialog(elements.victoryDialog, false);
  level = next;
  settings.difficulty = level.difficulty;
  settings.lastLevelId = level.id;
  saveSettings(storage, settings);
  session = newSession(level, restartCount);
  state = session.state;
  resumedAt = Date.now();
  selectedKey = null;
  activeKey = firstPlayableKey(state);
  persist("新庭院已保存");
  render();
  window.scrollTo({ top: elements.boardWrap.getBoundingClientRect().top + window.scrollY - 96, behavior: reduceMotion.matches ? "auto" : "smooth" });
}

function changeDifficulty(id) {
  const first = levelsForDifficulty(id)[0];
  if (first) startLevel(first);
}

function moveFocus(dx, dy) {
  const current = parseCellKey(activeKey) ?? { x: 0, y: 0 };
  for (let step = 1; step <= Math.max(state.width, state.height); step += 1) {
    const point = { x: current.x + dx * step, y: current.y + dy * step };
    const key = cellKey(point.x, point.y);
    const target = elements.board.querySelector(`[data-key="${key}"]`);
    if (target) { activeKey = key; updateTabStops(); target.focus({ preventScroll: true }); return true; }
  }
  return false;
}

function anyDialogOpen() { return [...document.querySelectorAll("dialog[open]")].length > 0; }

function openDialog(dialog, focusTarget) {
  if (!dialog || dialog.open || anyDialogOpen()) return;
  focusBeforeDialog = document.activeElement;
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  (focusTarget ?? dialog.querySelector("button"))?.focus({ preventScroll: true });
}

function closeDialog(dialog, restore = true) {
  if (!dialog?.open && !dialog?.hasAttribute("open")) return;
  if (dialog.open && typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
  const restoreTarget = focusBeforeDialog instanceof HTMLElement && focusBeforeDialog !== document.body && focusBeforeDialog.isConnected
    ? focusBeforeDialog : elements.tutorialButton;
  if (restore) restoreTarget?.focus({ preventScroll: true });
}

function renderTutorial() {
  const card = TUTORIAL[tutorialIndex];
  elements.tutorialStep.textContent = card.step;
  elements.tutorialTitle.textContent = card.title;
  elements.tutorialBody.textContent = card.body;
  elements.tutorialImage.src = card.image;
  elements.tutorialImage.alt = card.alt;
  elements.tutorialBullets.replaceChildren(...card.bullets.map((text) => { const item = document.createElement("li"); item.textContent = text; return item; }));
  elements.tutorialCounter.textContent = `${tutorialIndex + 1} / ${TUTORIAL.length}`;
  elements.tutorialPrevious.disabled = tutorialIndex === 0;
  elements.tutorialNext.textContent = tutorialIndex === TUTORIAL.length - 1 ? "开始归巢" : "下一张";
  elements.tutorialDialog.scrollTop = 0;
}

function openTutorial() {
  if (elements.tutorialDialog.open) return;
  if (elements.rulesDialog.open) closeDialog(elements.rulesDialog, false);
  tutorialIndex = 0; renderTutorial(); openDialog(elements.tutorialDialog, elements.tutorialSkip);
}

function closeTutorial() { markTutorialSeen(storage); closeDialog(elements.tutorialDialog); }

function retryOutbox() {
  if (evaluateState(state).complete && !session.completion?.delivered) completeRun(false);
  const results = flushOutbox(window, storage);
  const delivered = results.find((item) => item.payload.eventId === session.completion?.eventId && item.result.delivered);
  if (delivered && session.completion && !session.completion.delivered) { session.completion.delivered = true; saveSession(storage, session); }
}

buildDifficultyButtons();
render();
saveSettings(storage, { ...settings, lastLevelId: level.id });
retryOutbox();

elements.board.addEventListener("keydown", (event) => {
  const direction = { ArrowUp: [0,-1], ArrowRight: [1,0], ArrowDown: [0,1], ArrowLeft: [-1,0] }[event.key];
  if (direction && moveFocus(...direction)) event.preventDefault();
  if (event.key === "Escape" && selectedKey) { event.preventDefault(); selectedKey = null; render(); }
});
elements.undo.addEventListener("click", undo);
elements.restart.addEventListener("click", () => startLevel(level, session.restartCount + 1));
elements.newLevel.addEventListener("click", () => startLevel(nextLevel(level)));
elements.mute.addEventListener("click", () => { settings.muted = !settings.muted; saveSettings(storage, settings); elements.mute.setAttribute("aria-pressed", String(settings.muted)); elements.mute.querySelector("span").textContent = settings.muted ? "×" : "♪"; showToast(settings.muted ? "声音已关闭" : "声音已开启"); });
elements.tutorialButton.addEventListener("click", openTutorial);
elements.rulesButton.addEventListener("click", () => openDialog(elements.rulesDialog, elements.rulesClose));
elements.rulesClose.addEventListener("click", () => closeDialog(elements.rulesDialog));
elements.rulesDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(elements.rulesDialog); });
elements.tutorialSkip.addEventListener("click", closeTutorial);
elements.tutorialPrevious.addEventListener("click", () => { if (tutorialIndex > 0) { tutorialIndex -= 1; renderTutorial(); } });
elements.tutorialNext.addEventListener("click", () => { if (tutorialIndex < TUTORIAL.length - 1) { tutorialIndex += 1; renderTutorial(); } else closeTutorial(); });
elements.tutorialDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeTutorial(); });
elements.nextLevel.addEventListener("click", () => startLevel(nextLevel(level)));
elements.stay.addEventListener("click", () => closeDialog(elements.victoryDialog));
elements.victoryDialog.addEventListener("cancel", (event) => event.preventDefault());
window.addEventListener("realm:ready", retryOutbox);
window.addEventListener("ten-realms-v3:realm-ready", retryOutbox);
window.addEventListener("keydown", (event) => {
  if (anyDialogOpen() || event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? "")) return;
  const key = event.key.toLowerCase();
  if (key === "z") { event.preventDefault(); undo(); }
  else if (key === "r") { event.preventDefault(); startLevel(level, session.restartCount + 1); }
  else if (key === "n") { event.preventDefault(); startLevel(nextLevel(level)); }
  else if (event.key === "?") { event.preventDefault(); openDialog(elements.rulesDialog, elements.rulesClose); }
});
window.setInterval(() => { if (!session.completion) elements.timer.textContent = formatTime(elapsed()); }, 1000);
window.addEventListener("pagehide", () => persist("航迹已保存"));
elements.mute.setAttribute("aria-pressed", String(settings.muted));
elements.mute.querySelector("span").textContent = settings.muted ? "×" : "♪";
if (evaluateState(state).complete) {
  if (!session.completion?.delivered) window.setTimeout(() => completeRun(false), 0);
} else if (!tutorialSeen(storage)) window.setTimeout(openTutorial, 480);
