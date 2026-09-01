import {
  ORIENTATION,
  actionKey,
  applyOrientation,
  cellKey,
  createState,
  cycleOrientation,
  evaluateState,
  replayActions,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  difficultyForLevel,
  findLevel,
  levelsForDifficulty,
  nextLevel,
} from "./levels.mjs";
import {
  createRunId,
  loadRecords,
  loadSession,
  loadSettings,
  markTutorialSeen,
  recordCompletion,
  saveRecords,
  saveSession,
  saveSettings,
  tutorialSeen,
} from "./storage.mjs";
import {
  createCompletionPayload,
  flushOutbox,
  publishPersistedCompletion,
} from "./completion.mjs";

const TUTORIAL = Object.freeze([
  Object.freeze({
    image: "./assets/tutorial-elements.svg?tutorial=1",
    alt: "余烬一号闸真实初始状态：4×4 泄压舱全部留空，17 个压力数字位于交点",
    step: "01 · 认识泄压舱",
    title: "先看舱格，再看交点数字",
    body: "真实第一关有 16 个空舱格和 17 个数字测点。数字是最终要在该交点端接的导流板数。",
    bullets: ["空格通关时必须全部填满", "没有数字的点不等于 0"],
  }),
  Object.freeze({
    image: "./assets/tutorial-operation.svg?tutorial=1",
    alt: "余烬一号闸真实第一步：点按左上格放置反斜线导流板，左上数字1测点精确满足",
    step: "02 · 转动导流板",
    title: "点一下，从空格转到 \\",
    body: "首关左上格执行真实操作 0,0:B，即放置连接左上与右下的导流板。这一步使左上角的“1”恰好满足。",
    bullets: ["点按：空→\\→/→空", "右键顺序相反，触屏只用点按也能完成"],
  }),
  Object.freeze({
    image: "./assets/tutorial-goal.svg?tutorial=1",
    alt: "余烬一号闸经规则引擎验证的真实唯一完成状态：16格全填、17个测点满足、没有闭环",
    step: "03 · 稳定熔心",
    title: "全填、精确、无环，缺一不可",
    body: "画面是首关由同一规则引擎复算的真实完成态：16 块导流板全部安装，17/17 数字测点精确满足，全局闭环为 0。",
    bullets: ["局部数字对上但形成闭环，仍不通关", "六个发布题均已由独立求解器证明唯一"],
  }),
]);

const $ = (selector) => document.querySelector(selector);
const elements = Object.freeze({
  board: $("#vent-board"), boardShell: $("#board-shell"), clueLayer: $("#clue-layer"),
  levelKicker: $("#level-kicker"), levelTitle: $("#level-title"), levelSubtitle: $("#level-subtitle"), levelSeed: $("#level-seed"), saveStatus: $("#save-status"),
  filled: $("#filled-count"), cellTotal: $("#cell-total"), satisfied: $("#satisfied-count"), clueTotal: $("#clue-total"), cycle: $("#cycle-count"), moves: $("#move-count"), timer: $("#timer-value"),
  statusCard: $("#status-card"), statusTitle: $("#status-title"), statusCopy: $("#status-copy"),
  difficultyButtons: $("#difficulty-buttons"), difficultyNote: $("#difficulty-note"), levelButtons: $("#level-buttons"),
  newLevel: $("#new-level-button"), undo: $("#undo-button"), consoleUndo: $("#console-undo-button"), restart: $("#restart-button"), consoleRestart: $("#console-restart-button"), mute: $("#mute-button"),
  tutorialButton: $("#tutorial-button"), rulesButton: $("#rules-button"),
  clearCount: $("#clear-count"), stableCount: $("#stable-count"), bestActions: $("#best-actions"), sealGrid: $("#seal-grid"),
  rulesDialog: $("#rules-dialog"), rulesClose: $("#rules-close-button"),
  tutorialDialog: $("#tutorial-dialog"), tutorialSkip: $("#tutorial-skip-button"), tutorialPrevious: $("#tutorial-previous-button"), tutorialNext: $("#tutorial-next-button"), tutorialCounter: $("#tutorial-counter"), tutorialImage: $("#tutorial-image"), tutorialStep: $("#tutorial-step"), tutorialTitle: $("#tutorial-title"), tutorialBody: $("#tutorial-body"), tutorialBullets: $("#tutorial-bullets"), tutorialAnnouncement: $("#tutorial-announcement"),
  victoryDialog: $("#victory-dialog"), victoryLevel: $("#victory-level"), victoryMoves: $("#victory-moves"), victoryTime: $("#victory-time"), victoryStyle: $("#victory-style"), victoryReward: $("#victory-reward"), nextLevel: $("#next-level-button"), stay: $("#stay-button"),
  toast: $("#toast"), assertive: $("#assertive-status"),
});

let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
let settings = loadSettings(storage);
let records = loadRecords(storage);
const restored = loadSession(storage, findLevel);
let level = restored?.level ?? findLevel(settings.lastLevelId) ?? levelsForDifficulty(settings.difficulty)[0] ?? LEVELS[0];
if (level.difficulty !== settings.difficulty) settings.difficulty = level.difficulty;

function freshSession(next, restartCount = 0) {
  return { level: next, runId: createRunId(next.id), actions: [], state: createState(next), elapsedMs: 0, undoCount: 0, restartCount, conflictActions: 0, completion: null };
}

let session = restored ?? freshSession(level);
let state = session.state;
let activeIndex = 0;
let resumedAt = Date.now();
let tutorialIndex = 0;
let statusOverride = null;
let statusTimer = 0;
let toastTimer = 0;
let audio = null;
const dialogTriggers = new WeakMap();

function elapsed(now = Date.now()) {
  return session.completion ? session.elapsedMs : session.elapsedMs + Math.max(0, now - resumedAt);
}

function syncClock(now = Date.now()) {
  if (!session.completion) { session.elapsedMs = elapsed(now); resumedAt = now; }
}

function formatTime(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function showToast(message, assertive = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  if (assertive) elements.assertive.textContent = message;
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
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
  gain.gain.exponentialRampToValueAtTime(.018, audio.currentTime + .018);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + duration + .025);
}

function saveCurrent(message = "泄压轨迹已写入本机") {
  syncClock();
  session.level = level;
  session.state = state;
  const saved = saveSession(storage, session);
  elements.saveStatus.textContent = saved ? message : "本机存档暂不可用，当前仍可游玩";
  return saved;
}

function saveCurrentSettings() {
  settings = { version: 1, difficulty: level.difficulty, muted: settings.muted, lastLevelId: level.id };
  return saveSettings(storage, settings);
}

function setTemporaryStatus(title, copy, kind = "calm") {
  window.clearTimeout(statusTimer);
  statusOverride = { title, copy, kind };
  renderStatus();
  statusTimer = window.setTimeout(() => { statusOverride = null; renderStatus(); }, 2600);
}

function orientationName(value) {
  if (value === ORIENTATION.BACK) return "反斜线导流板，连接左上与右下";
  if (value === ORIENTATION.FORWARD) return "正斜线导流板，连接右上与左下";
  return "空泄压舱";
}

function buildDifficultyButtons() {
  elements.difficultyButtons.replaceChildren(...DIFFICULTIES.map((difficulty) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty.id;
    button.textContent = difficulty.label;
    button.addEventListener("click", () => changeDifficulty(difficulty.id));
    return button;
  }));
}

function buildLevelButtons() {
  const pool = levelsForDifficulty(level.difficulty);
  elements.levelButtons.replaceChildren(...pool.map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.levelId = item.id;
    button.textContent = `${String(index + 1).padStart(2, "0")} · ${item.title}`;
    button.addEventListener("click", () => startLevel(item));
    return button;
  }));
}

function renderBoard(placedKey = null, focus = false) {
  const evaluation = evaluateState(level, state);
  elements.boardShell.style.setProperty("--cols", String(level.width));
  elements.boardShell.style.setProperty("--rows", String(level.height));
  elements.board.style.setProperty("--cols", String(level.width));
  elements.board.style.setProperty("--rows", String(level.height));
  elements.clueLayer.style.setProperty("--cols", String(level.width));
  elements.clueLayer.style.setProperty("--rows", String(level.height));
  elements.board.setAttribute("aria-rowcount", String(level.height));
  elements.board.setAttribute("aria-colcount", String(level.width));
  elements.board.classList.toggle("is-complete", evaluation.complete);

  const cells = state.cells.map((orientation, index) => {
    const x = index % level.width;
    const y = Math.floor(index / level.width);
    const key = cellKey(x, y);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vent-cell";
    if (orientation === ORIENTATION.BACK) button.classList.add("is-back");
    if (orientation === ORIENTATION.FORWARD) button.classList.add("is-forward");
    if (orientation !== ORIENTATION.EMPTY) button.classList.add("is-filled");
    if (evaluation.cycleCells.has(key)) button.classList.add("is-cycle");
    if (placedKey === key) button.classList.add("is-placed");
    if (activeIndex === index) button.classList.add("is-active");
    button.dataset.index = String(index);
    button.dataset.key = key;
    button.dataset.orientation = orientation;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-rowindex", String(y + 1));
    button.setAttribute("aria-colindex", String(x + 1));
    button.setAttribute("aria-label", `第 ${y + 1} 行第 ${x + 1} 列，${orientationName(orientation)}${evaluation.cycleCells.has(key) ? "，它使管网形成了闭环" : ""}`);
    button.tabIndex = activeIndex === index ? 0 : -1;
    button.innerHTML = '<span class="vane" aria-hidden="true"></span>';
    button.addEventListener("focus", () => { activeIndex = index; updateTabStops(); });
    button.addEventListener("click", () => cycleCell(index, false));
    button.addEventListener("contextmenu", (event) => { event.preventDefault(); cycleCell(index, true); });
    return button;
  });
  elements.board.replaceChildren(...cells);

  const clues = evaluation.clues.map((clue) => {
    const node = document.createElement("span");
    node.className = "clue-node";
    if (clue.error) node.classList.add("is-error");
    if (clue.satisfied) node.classList.add("is-satisfied");
    node.style.setProperty("--vx", String(clue.x));
    node.style.setProperty("--vy", String(clue.y));
    node.dataset.count = String(clue.count);
    node.dataset.target = String(clue.target);
    node.textContent = String(clue.target);
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", `第 ${clue.y + 1} 行交点第 ${clue.x + 1} 列，目标 ${clue.target}，当前 ${clue.count}${clue.error ? "，冲突" : clue.satisfied ? "，已满足" : ""}`);
    return node;
  });
  elements.clueLayer.replaceChildren(...clues);

  if (focus) window.requestAnimationFrame(() => elements.board.querySelector(`[data-index="${activeIndex}"]`)?.focus());
}

function updateTabStops() {
  for (const button of elements.board.querySelectorAll(".vent-cell")) {
    const active = Number(button.dataset.index) === activeIndex;
    button.tabIndex = active ? 0 : -1;
    button.classList.toggle("is-active", active);
  }
}

function renderStatus() {
  const evaluation = evaluateState(level, state);
  const difficulty = difficultyForLevel(level);
  const pool = levelsForDifficulty(level.difficulty);
  const levelIndex = pool.findIndex((item) => item.id === level.id);
  elements.levelKicker.textContent = `${difficulty.label} · ${String(levelIndex + 1).padStart(2, "0")}`;
  elements.levelTitle.textContent = level.title;
  elements.levelSubtitle.textContent = level.subtitle;
  elements.levelSeed.textContent = level.seed;
  elements.filled.textContent = String(evaluation.filled);
  elements.cellTotal.textContent = String(evaluation.totalCells);
  elements.satisfied.textContent = String(evaluation.satisfiedClues);
  elements.clueTotal.textContent = String(evaluation.totalClues);
  elements.cycle.textContent = String(evaluation.cycle ? Math.max(1, evaluation.cycleCells.size) : 0);
  elements.moves.textContent = String(state.moveCount);
  elements.timer.textContent = formatTime(elapsed());
  const undoDisabled = session.actions.length === 0 || Boolean(session.completion);
  elements.undo.disabled = undoDisabled;
  elements.consoleUndo.disabled = undoDisabled;
  elements.difficultyNote.textContent = difficulty.note;
  elements.mute.setAttribute("aria-pressed", String(settings.muted));
  elements.mute.querySelector("b").textContent = settings.muted ? "静音" : "声音";
  for (const button of elements.difficultyButtons.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.difficulty === level.difficulty));
  for (const button of elements.levelButtons.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.levelId === level.id));

  let kind = "calm";
  let title = "等待安装";
  let copy = level.note;
  if (evaluation.complete) {
    kind = "complete"; title = "熔心已稳定"; copy = "舱格全填，所有数字精确满足，全局没有封闭热环。";
  } else if (statusOverride) {
    ({ kind, title, copy } = statusOverride);
  } else if (evaluation.cycle) {
    kind = "warning"; title = "检测到封闭热环"; copy = "红色舱格让导流管网首尾相接。转动或清空其中一块导流板。";
  } else if (evaluation.clueErrors > 0) {
    kind = "warning"; title = "压力数字冲突"; copy = `${evaluation.clueErrors} 个红色测点已超出目标，或剩余空格已不可能补足目标。`;
  } else if (evaluation.filled > 0) {
    title = "压力正在重分配"; copy = `${evaluation.filled}/${evaluation.totalCells} 块导流板已安装，${evaluation.satisfiedClues}/${evaluation.totalClues} 个数字测点已锁定。`;
  }
  elements.statusCard.dataset.kind = kind;
  elements.statusTitle.textContent = title;
  elements.statusCopy.textContent = copy;
}

function renderArchive() {
  elements.clearCount.textContent = String(Object.keys(records.levels).filter((id) => findLevel(id)).length);
  elements.stableCount.textContent = String(Object.keys(records.stableLevels).filter((id) => findLevel(id)).length);
  const record = records.levels[level.id];
  elements.bestActions.textContent = record ? `${record.bestActions} 步` : "—";
  elements.sealGrid.replaceChildren(...LEVELS.map((item) => {
    const seal = document.createElement("span");
    const earned = Boolean(records.levels[item.id]);
    const stable = Boolean(records.stableLevels[item.id]);
    seal.className = `seal${earned ? " is-earned" : ""}${stable ? " is-stable" : ""}`;
    seal.textContent = item.title;
    seal.setAttribute("aria-label", `${item.title}，${earned ? "已稳定" : "尚未稳定"}${stable ? "，已获无冲突徽章" : ""}`);
    return seal;
  }));
}

function render(placedKey = null, focus = false) {
  renderBoard(placedKey, focus);
  renderStatus();
  renderArchive();
}

function cycleCell(index, reverse = false) {
  if (session.completion) { showToast("本井已稳定；可以前往下一井或重开。"); return; }
  const current = state.cells[index];
  setCell(index, cycleOrientation(current, reverse));
}

function setCell(index, orientation) {
  if (session.completion) { showToast("本井已稳定；请换题或重开。"); return; }
  const x = index % level.width;
  const y = Math.floor(index / level.width);
  const result = applyOrientation(state, { x, y, orientation });
  if (!result.changed) {
    setTemporaryStatus("舱格没有改变", "当前已经是这个方向，无效输入不计步。");
    tone(180, .08);
    return;
  }
  state = result.state;
  session.state = state;
  session.actions.push(actionKey(result.action));
  const evaluation = evaluateState(level, state);
  if (evaluation.cycle || evaluation.clueErrors > 0) session.conflictActions += 1;
  saveCurrent();
  render(cellKey(x, y), true);
  if (evaluation.complete) finishRun();
  else tone(evaluation.cycle || evaluation.clueErrors ? 165 : orientation === ORIENTATION.EMPTY ? 280 : 420, .1);
}

function undo() {
  if (session.completion) { showToast("已完成的结算不回滚；重开可开始新一局。"); return; }
  if (!session.actions.length) { showToast("还没有可撤销的导流操作。"); return; }
  session.actions.pop();
  session.undoCount += 1;
  state = replayActions(level, session.actions) ?? createState(level);
  session.state = state;
  saveCurrent("撤销后的泄压轨迹已保存");
  setTemporaryStatus("已撤销一步", "舱格已恢复到上一个可重放状态。");
  render(null, true);
  tone(260, .1);
}

function startLevel(next, restartCount = 0) {
  if (!next) return;
  level = next;
  session = freshSession(level, restartCount);
  state = session.state;
  activeIndex = 0;
  resumedAt = Date.now();
  statusOverride = null;
  saveCurrentSettings();
  buildLevelButtons();
  saveCurrent("新泄压井已建档");
  if (elements.victoryDialog.open) closeDialog(elements.victoryDialog);
  render(null, true);
  showToast(`已进入${level.title}`);
}

function restart() {
  startLevel(level, session.restartCount + 1);
}

function changeDifficulty(id) {
  const next = levelsForDifficulty(id)[0];
  if (next) startLevel(next);
}

function finishRun(presentVictory = true) {
  if (!evaluateState(level, state).complete || session.completion?.delivered) return false;
  syncClock();
  const eventId = `molten-core-vent:${session.runId}:complete`;
  const completedAt = session.completion?.completedAt
    ?? records.settledEvents[eventId]
    ?? new Date();
  const payload = createCompletionPayload({
    level, runId: session.runId, state, actions: session.actions, elapsedMs: session.elapsedMs,
    conflictActions: session.conflictActions, undoCount: session.undoCount,
    completedAt,
  });
  const hadStableBadge = Boolean(records.stableLevels[level.id]);
  const award = recordCompletion(records, payload);
  records = award.records;
  const recordsSaved = saveRecords(storage, records);
  session.completion = { runId: payload.runId, eventId: payload.eventId, completedAt: payload.completedAt, delivered: false };
  const sessionSaved = saveCurrent("完成印记与存档已写入本机");
  const delivery = publishPersistedCompletion(window, storage, payload, { recordsSaved, sessionSaved });
  if (delivery.delivered) {
    session.completion.delivered = true;
    saveCurrent("完成印记已交付成长图鉴");
  }
  render();

  if (!presentVictory) return recordsSaved && sessionSaved;
  const rewards = [];
  if (award.firstClear) rewards.push("首次稳定冷却印");
  if (award.personalBest) rewards.push("个人最佳操作纪录");
  if (award.stable && !hadStableBadge) rewards.push("无冲突泄压徽章");
  if (payload.noUndo) rewards.push("一气呵成标记");
  elements.victoryLevel.textContent = level.title;
  elements.victoryMoves.textContent = `${payload.moves} 步`;
  elements.victoryTime.textContent = formatTime(payload.elapsedMs);
  elements.victoryStyle.textContent = payload.noConflict ? payload.noUndo ? "无警报 · 无撤销" : "无警报泄压" : payload.noUndo ? "无撤销完成" : "完整泄压";
  elements.victoryReward.textContent = rewards.length ? `获得：${rewards.join("、")}。` : "本次通关已累计到本机稳定次数。";
  tone(620, .18);
  window.setTimeout(() => openDialog(elements.victoryDialog, elements.board), 260);
  return recordsSaved && sessionSaved;
}

function retryCompletionOutbox() {
  if (evaluateState(level, state).complete && !session.completion?.delivered) finishRun(false);
  const results = flushOutbox(window, storage);
  const delivered = results.find((item) => item.payload.eventId === session.completion?.eventId && item.result.delivered);
  if (delivered && session.completion && !session.completion.delivered) {
    session.completion.delivered = true;
    saveSession(storage, session);
  }
  return results;
}

function openDialog(dialog, trigger = document.activeElement) {
  if (!dialog || dialog.open) return;
  dialogTriggers.set(dialog, trigger instanceof HTMLElement ? trigger : null);
  document.body.classList.add("dialog-open");
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog?.open) return;
  if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
}

function onDialogClose(event) {
  if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
  dialogTriggers.get(event.currentTarget)?.focus?.();
}

function renderTutorial() {
  const card = TUTORIAL[tutorialIndex];
  elements.tutorialImage.src = card.image;
  elements.tutorialImage.alt = card.alt;
  elements.tutorialStep.textContent = card.step;
  elements.tutorialTitle.textContent = card.title;
  elements.tutorialBody.textContent = card.body;
  elements.tutorialBullets.replaceChildren(...card.bullets.map((text) => { const li = document.createElement("li"); li.textContent = text; return li; }));
  elements.tutorialPrevious.disabled = tutorialIndex === 0;
  elements.tutorialNext.textContent = tutorialIndex === TUTORIAL.length - 1 ? "看完，开始泄压" : "下一张";
  elements.tutorialCounter.textContent = `${tutorialIndex + 1} / ${TUTORIAL.length}`;
  elements.tutorialAnnouncement.textContent = `教程第 ${tutorialIndex + 1} 张，${card.title}`;
  elements.tutorialDialog.scrollTop = 0;
}

function openTutorial(trigger) {
  tutorialIndex = 0;
  renderTutorial();
  openDialog(elements.tutorialDialog, trigger);
  elements.tutorialSkip.focus({ preventScroll: true });
}

function completeTutorial() {
  markTutorialSeen(storage);
  closeDialog(elements.tutorialDialog);
}

function moveFocus(dx, dy) {
  const x = activeIndex % level.width;
  const y = Math.floor(activeIndex / level.width);
  const nextX = Math.max(0, Math.min(level.width - 1, x + dx));
  const nextY = Math.max(0, Math.min(level.height - 1, y + dy));
  activeIndex = nextY * level.width + nextX;
  updateTabStops();
  elements.board.querySelector(`[data-index="${activeIndex}"]`)?.focus();
}

elements.board.addEventListener("keydown", (event) => {
  const controls = {
    ArrowLeft: () => moveFocus(-1, 0), ArrowRight: () => moveFocus(1, 0),
    ArrowUp: () => moveFocus(0, -1), ArrowDown: () => moveFocus(0, 1),
  };
  if (controls[event.key]) { event.preventDefault(); controls[event.key](); return; }
  if (event.key === "Enter") { event.preventDefault(); cycleCell(activeIndex, false); return; }
  if (event.key === " ") { event.preventDefault(); cycleCell(activeIndex, true); return; }
  if (event.key === "\\") { event.preventDefault(); setCell(activeIndex, ORIENTATION.BACK); return; }
  if (event.key === "/") { event.preventDefault(); setCell(activeIndex, ORIENTATION.FORWARD); return; }
  if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); setCell(activeIndex, ORIENTATION.EMPTY); }
});

elements.newLevel.addEventListener("click", () => startLevel(nextLevel(level)));
elements.nextLevel.addEventListener("click", () => startLevel(nextLevel(level)));
elements.undo.addEventListener("click", undo);
elements.consoleUndo.addEventListener("click", undo);
elements.restart.addEventListener("click", restart);
elements.consoleRestart.addEventListener("click", restart);
elements.mute.addEventListener("click", () => { settings.muted = !settings.muted; saveCurrentSettings(); renderStatus(); showToast(settings.muted ? "声音已关闭" : "声音已开启"); if (!settings.muted) tone(440, .08); });
elements.tutorialButton.addEventListener("click", () => openTutorial(elements.tutorialButton));
elements.rulesButton.addEventListener("click", () => openDialog(elements.rulesDialog, elements.rulesButton));
elements.rulesClose.addEventListener("click", () => closeDialog(elements.rulesDialog));
elements.tutorialSkip.addEventListener("click", completeTutorial);
elements.tutorialPrevious.addEventListener("click", () => { if (tutorialIndex > 0) { tutorialIndex -= 1; renderTutorial(); } });
elements.tutorialNext.addEventListener("click", () => { if (tutorialIndex < TUTORIAL.length - 1) { tutorialIndex += 1; renderTutorial(); } else completeTutorial(); });
elements.stay.addEventListener("click", () => closeDialog(elements.victoryDialog));
for (const dialog of [elements.rulesDialog, elements.tutorialDialog, elements.victoryDialog]) dialog.addEventListener("close", onDialogClose);

window.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || document.querySelector("dialog[open]") || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? "")) return;
  if (event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
  else if (event.key.toLowerCase() === "r") { event.preventDefault(); restart(); }
  else if (event.key.toLowerCase() === "n") { event.preventDefault(); startLevel(nextLevel(level)); }
});

window.addEventListener("realm:ready", retryCompletionOutbox);
window.addEventListener("ten-realms-v2:realm-ready", retryCompletionOutbox);
window.addEventListener("pagehide", () => saveCurrent());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveCurrent(); else resumedAt = Date.now(); });

buildDifficultyButtons();
buildLevelButtons();
saveCurrentSettings();
render();
retryCompletionOutbox();
window.setInterval(() => { if (!session.completion) elements.timer.textContent = formatTime(elapsed()); }, 1000);
if (evaluateState(level, state).complete) {
  if (!session.completion?.delivered) window.setTimeout(() => finishRun(false), 0);
} else if (!tutorialSeen(storage)) window.setTimeout(() => openTutorial(elements.tutorialButton), 320);
