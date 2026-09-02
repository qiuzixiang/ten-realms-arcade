import {
  BOARD_SIZE,
  applyStateMove,
  evaluateBoard,
  stateForLevel,
  undoState,
  zoneCells,
} from "./logic.mjs";
import { DEFAULT_LEVEL_ID, DIFFICULTIES, LEVELS, findLevel, firstLevel, levelsForDifficulty, nextLevel } from "./levels.mjs";
import {
  GAME_ID,
  STORAGE_KEYS,
  createRunId,
  enqueueOutbox,
  loadOutbox,
  loadProfile,
  loadSession,
  markTutorialSeen,
  removeFromOutbox,
  saveProfile,
  saveSession,
  tutorialSeen,
} from "./storage.mjs";
import {
  completionFromSettledEvent,
  deliverCompletion,
  normalizeCompletion,
  queueCompletion,
  settleCompletion,
} from "./completion.mjs";

const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();

const TUTORIAL_LEVEL_ID = "orion-offset";
const TUTORIAL_ACTION = Object.freeze({ row: 2, column: 2, direction: "ccw" });
const TUTORIAL_CARDS = Object.freeze([
  Object.freeze({
    step: "01 · 识别星历环",
    title: "编号是星历，不是按钮",
    body: "每枚环都带着一段不可改写的星历编号。目标不是交换数字，而是让整个盘面从左到右、从上到下回到 1 至 16 的升序。",
    bullets: ["本图是「猎户偏置」的真实初始状态", "带小星标的环代表可校准的天球刻度"],
    image: "./assets/tutorial-elements.svg?tutorial=3",
    alt: "猎户偏置的真实初始星盘，十六枚星历环按扰动后的顺序排列。",
  }),
  Object.freeze({
    step: "02 · 明确旋转方向",
    title: "选 2 × 2 窗口，再选逆或顺",
    body: "点亮交点会圈定四枚相邻星环。此处对右下窗口做一次真实的逆时针校准：左上环移动到左下，右上环移动到左上。",
    bullets: ["左旋和右旋是不同动作，界面永远分开显示", "本图的操作是猎户偏置参考回放的第一步"],
    image: "./assets/tutorial-action.svg?tutorial=3",
    alt: "猎户偏置的真实第一次动作，右下角四枚星历环逆时针旋转后的状态。",
  }),
  Object.freeze({
    step: "03 · 让星历闭合",
    title: "全部 1 → 16 才会盖下校签",
    body: "当所有十六枚星历环都回到升序，星盘才真正完成。只对齐局部、或者只让几枚环排好，都不会触发结算。",
    bullets: ["本图是同一关卡执行完整参考回放后的真实完成盘面", "完成后记录首次校准、个人记录与参考线校签"],
    image: "./assets/tutorial-goal.svg?tutorial=3",
    alt: "猎户偏置的真实完成星盘，编号从左至右、从上至下为一到十六。",
  }),
]);

const elements = Object.freeze({
  aligned: document.querySelector("#aligned-count"),
  board: document.querySelector("#star-dial-board"),
  clearCount: document.querySelector("#clear-count"),
  cw: document.querySelector("#cw-button"),
  difficultyPicker: document.querySelector("#difficulty-picker"),
  levelKicker: document.querySelector("#level-kicker"),
  levelPicker: document.querySelector("#level-picker"),
  levelSubtitle: document.querySelector("#level-subtitle"),
  levelTitle: document.querySelector("#level-title"),
  live: document.querySelector("#live-status"),
  moves: document.querySelector("#move-count"),
  newRun: document.querySelector("#new-run-button"),
  par: document.querySelector("#par-count"),
  referenceNote: document.querySelector("#reference-note"),
  replayButton: document.querySelector("#replay-button"),
  replayClose: document.querySelector("#replay-close-button"),
  replayCopy: document.querySelector("#replay-copy"),
  replayDialog: document.querySelector("#replay-dialog"),
  replayList: document.querySelector("#replay-list"),
  restart: document.querySelector("#restart-button"),
  rewardCount: document.querySelector("#reward-count"),
  saveStatus: document.querySelector("#save-status"),
  selectedZoneCopy: document.querySelector("#selected-zone-copy"),
  selectedZoneLabel: document.querySelector("#selected-zone-label"),
  toast: document.querySelector("#toast"),
  tutorialButton: document.querySelector("#tutorial-button"),
  tutorialBody: document.querySelector("#tutorial-body"),
  tutorialBullets: document.querySelector("#tutorial-bullets"),
  tutorialDialog: document.querySelector("#tutorial-dialog"),
  tutorialImage: document.querySelector("#tutorial-image"),
  tutorialNext: document.querySelector("#tutorial-next-button"),
  tutorialPosition: document.querySelector("#tutorial-position"),
  tutorialPrevious: document.querySelector("#tutorial-previous-button"),
  tutorialSkip: document.querySelector("#tutorial-skip-button"),
  tutorialStep: document.querySelector("#tutorial-step"),
  tutorialTitle: document.querySelector("#tutorial-title"),
  undo: document.querySelector("#undo-button"),
  victoryCopy: document.querySelector("#victory-copy"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryLevel: document.querySelector("#victory-level"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryNext: document.querySelector("#victory-next-button"),
  victoryPar: document.querySelector("#victory-par"),
  victoryRewards: document.querySelector("#victory-rewards"),
  victoryStay: document.querySelector("#victory-stay-button"),
  zoneGrid: document.querySelector("#zone-grid"),
  ccw: document.querySelector("#ccw-button"),
});

let profileResult = loadProfile(storage, findLevel, DEFAULT_LEVEL_ID);
let profile = profileResult.profile;
let sessionResult = loadSession(storage, findLevel);
let level = sessionResult.session?.level ?? findLevel(profile.preferences.levelId) ?? firstLevel("easy");
let runId = sessionResult.session?.runId ?? createRunId(Date.now(), entropy());
let state = sessionResult.session?.state ?? stateForLevel(level);
let carriedElapsed = sessionResult.session?.elapsedMs ?? 0;
let startedAt = Date.now();
let selectedZone = { row: 0, column: 0 };
let selectedDifficulty = level.difficulty;
let tutorialIndex = 0;
let tutorialReturnFocus = null;
let replayReturnFocus = null;
let victoryReturnFocus = null;
let victoryTimer = 0;
let toastTimer = 0;
let shownVictoryEvent = null;

function entropy() {
  try { return window.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Date.now(); } catch { return Date.now(); }
}

function elapsedMs() {
  return Math.max(0, Math.floor(carriedElapsed + (state.complete ? 0 : Date.now() - startedAt)));
}

function announce(message) {
  elements.live.textContent = "";
  window.setTimeout(() => { elements.live.textContent = message; }, 20);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3600);
}

function saveCurrentSession() {
  const saved = saveSession(storage, { level, runId, state, elapsedMs: elapsedMs() });
  if (!saved) elements.saveStatus.lastChild.textContent = "本机档案暂未写入";
  return saved;
}

function persistProfile() {
  const saved = saveProfile(storage, profile, findLevel, DEFAULT_LEVEL_ID);
  elements.saveStatus.lastChild.textContent = saved ? "本机星历档案已保存" : "本机档案暂未写入";
  return saved;
}

function zoneLabel(zone = selectedZone) {
  return `第 ${zone.row + 1} 行 · 第 ${zone.column + 1} 列四环`;
}

function renderDifficultyPicker() {
  elements.difficultyPicker.replaceChildren(...DIFFICULTIES.map((difficulty) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty;
    button.className = difficulty === selectedDifficulty ? "is-active" : "";
    button.textContent = ({ easy: "入门", medium: "进阶", hard: "深空" })[difficulty];
    button.addEventListener("click", () => {
      selectedDifficulty = difficulty;
      renderDifficultyPicker();
      renderLevelPicker();
    });
    return button;
  }));
}

function renderLevelPicker() {
  elements.levelPicker.replaceChildren(...levelsForDifficulty(selectedDifficulty).map((candidate) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = candidate.id === level.id ? "is-active" : "";
    if (profile.completedLevelIds.includes(candidate.id)) button.classList.add("is-cleared");
    button.innerHTML = "<b></b><small></small><span></span>";
    button.querySelector("b").textContent = candidate.title;
    button.querySelector("small").textContent = candidate.subtitle;
    button.querySelector("span").textContent = `${candidate.par} 旋`;
    button.addEventListener("click", () => startLevel(candidate, true));
    return button;
  }));
}

function renderZones() {
  elements.zoneGrid.replaceChildren(...Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "zone-button";
    button.dataset.row = String(row);
    button.dataset.column = String(column);
    button.dataset.coordinate = `${row + 1}·${column + 1}`;
    button.setAttribute("aria-label", `选择${zoneLabel({ row, column })}`);
    button.setAttribute("aria-pressed", String(row === selectedZone.row && column === selectedZone.column));
    if (row === selectedZone.row && column === selectedZone.column) button.classList.add("is-selected");
    button.addEventListener("click", () => selectZone({ row, column }, true));
    return button;
  }));
}

function renderBoard(previousBoard = null) {
  const selectedCells = new Set(zoneCells(selectedZone.row, selectedZone.column));
  const evaluation = evaluateBoard(state.board);
  elements.board.replaceChildren(...state.board.map((tile, index) => {
    const cell = document.createElement("div");
    cell.className = "dial-tile";
    if (tile === index + 1) cell.classList.add("is-aligned");
    if (selectedCells.has(index)) cell.classList.add("is-zone-selected");
    if (previousBoard && previousBoard[index] !== tile) cell.classList.add("is-changing");
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `第 ${Math.floor(index / BOARD_SIZE) + 1} 行，第 ${index % BOARD_SIZE + 1} 列，星历 ${tile}${tile === index + 1 ? "，已对准" : "，未对准"}`);
    cell.innerHTML = `<b>${tile}</b><small>ARC ${String(tile).padStart(2, "0")}</small>`;
    return cell;
  }));
  elements.aligned.textContent = `${evaluation.aligned} / 16`;
  elements.moves.textContent = String(state.moves);
  elements.par.textContent = `${level.par} 旋`;
  elements.undo.disabled = state.moves === 0;
}

function renderSummary() {
  elements.levelKicker.textContent = `${level.difficulty.toUpperCase()} · SEED ${level.seed}`;
  elements.levelTitle.textContent = level.title;
  elements.levelSubtitle.textContent = level.subtitle;
  elements.referenceNote.textContent = `本关有一条 ${level.par} 步可复算参考回放`;
  elements.clearCount.textContent = `${profile.completedLevelIds.length} / ${LEVELS.length}`;
  elements.rewardCount.textContent = String(profile.rewardLedger.length);
  elements.selectedZoneLabel.textContent = zoneLabel();
  elements.selectedZoneCopy.textContent = `选择后可让这 ${zoneCells(selectedZone.row, selectedZone.column).map((cell) => state.board[cell]).join("、")} 四枚星历环绕共同中心转动。`;
  renderDifficultyPicker();
  renderLevelPicker();
  renderZones();
  renderBoard();
}

function selectZone(zone, focus = false) {
  selectedZone = { row: Math.max(0, Math.min(BOARD_SIZE - 2, zone.row)), column: Math.max(0, Math.min(BOARD_SIZE - 2, zone.column)) };
  elements.selectedZoneLabel.textContent = zoneLabel();
  elements.selectedZoneCopy.textContent = `选择后可让这 ${zoneCells(selectedZone.row, selectedZone.column).map((cell) => state.board[cell]).join("、")} 四枚星历环绕共同中心转动。`;
  renderZones();
  renderBoard();
  if (focus) elements.zoneGrid.querySelector(`[data-row="${selectedZone.row}"][data-column="${selectedZone.column}"]`)?.focus({ preventScroll: true });
}

function startLevel(next, createFreshRun) {
  closeOpenDialogs();
  level = next;
  selectedDifficulty = next.difficulty;
  if (createFreshRun) runId = createRunId(Date.now(), entropy());
  state = stateForLevel(level);
  carriedElapsed = 0;
  startedAt = Date.now();
  selectedZone = { row: 0, column: 0 };
  profile = { ...profile, preferences: { ...profile.preferences, levelId: level.id } };
  persistProfile();
  saveCurrentSession();
  renderSummary();
  announce(`${level.title} 已载入。${zoneLabel()}已选中。`);
}

function restartLevel() {
  const previous = state.board;
  state = stateForLevel(level);
  carriedElapsed = 0;
  startedAt = Date.now();
  runId = createRunId(Date.now(), entropy());
  saveCurrentSession();
  renderBoard(previous);
  announce("已按原始可验证扰动序列重开本关。");
}

function rotate(direction) {
  if (state.complete || anyDialogOpen()) return;
  const previous = state.board;
  const result = applyStateMove(level, state, { ...selectedZone, direction });
  if (!result.changed) {
    showToast("这个校准动作无效，盘面没有改变。");
    return;
  }
  const elapsedBefore = elapsedMs();
  state = result.state;
  if (state.complete) {
    carriedElapsed = elapsedBefore;
    startedAt = Date.now();
  }
  saveCurrentSession();
  renderBoard(previous);
  elements.selectedZoneCopy.textContent = `刚刚${direction === "cw" ? "顺时针" : "逆时针"}校准；当前四环为 ${zoneCells(selectedZone.row, selectedZone.column).map((cell) => state.board[cell]).join("、")}。`;
  announce(`${direction === "cw" ? "顺时针" : "逆时针"}校准完成，第 ${state.moves} 次。`);
  if (state.complete) {
    const token = ++victoryTimer;
    window.setTimeout(() => { if (token === victoryTimer && state.complete) settleCurrentCompletion(true); }, 340);
  }
}

function undo() {
  if (anyDialogOpen()) return;
  const previous = state.board;
  const result = undoState(level, state);
  if (!result.changed) { showToast("还没有可撤销的校准。"); return; }
  const elapsedBefore = elapsedMs();
  state = result.state;
  carriedElapsed = elapsedBefore;
  startedAt = Date.now();
  saveCurrentSession();
  renderBoard(previous);
  announce(`已撤销，回到第 ${state.moves} 次校准。`);
}

function flushOutbox() {
  const loaded = loadOutbox(storage, normalizeCompletion);
  for (const detail of loaded.entries) {
    const delivery = deliverCompletion(window, detail);
    if (delivery.confirmed) removeFromOutbox(storage, detail.eventId, normalizeCompletion);
    else queueCompletion(window, detail);
  }
}

function settleCurrentCompletion(showVictory) {
  if (!state.complete) return;
  const result = settleCompletion({ profile, level, state, runId, elapsedMs: elapsedMs() });
  profile = result.profile;
  const profileSaved = persistProfile();
  const sessionSaved = saveCurrentSession();
  const detail = result.detail;
  const queued = detail ? enqueueOutbox(storage, detail, normalizeCompletion) : { saved: true };
  if (profileSaved && sessionSaved && queued.saved) flushOutbox();
  else if (detail) queueCompletion(window, detail);
  renderSummary();
  const rewardText = result.claims.length ? `获得 ${result.claims.length} 枚新校签` : "本次完成已在档案中";
  showToast(rewardText);
  if (showVictory && shownVictoryEvent !== detail?.eventId) {
    shownVictoryEvent = detail?.eventId ?? shownVictoryEvent;
    openVictory(result.claims.length);
  }
}

function openNativeDialog(dialog, focusTarget) {
  document.body.classList.add("is-dialog-open");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  focusTarget?.focus?.({ preventScroll: true });
}

function closeNativeDialog(dialog) {
  if (dialog.open && typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (!anyDialogOpen()) document.body.classList.remove("is-dialog-open");
}

function anyDialogOpen() {
  return Boolean(document.querySelector("dialog[open]"));
}

function closeOpenDialogs() {
  [elements.tutorialDialog, elements.replayDialog, elements.victoryDialog].forEach((dialog) => {
    if (dialog.open) closeNativeDialog(dialog);
  });
}

function renderTutorialCard() {
  const card = TUTORIAL_CARDS[tutorialIndex];
  elements.tutorialStep.textContent = card.step;
  elements.tutorialTitle.textContent = card.title;
  elements.tutorialBody.textContent = card.body;
  elements.tutorialImage.src = card.image;
  elements.tutorialImage.alt = card.alt;
  elements.tutorialBullets.replaceChildren(...card.bullets.map((text) => {
    const item = document.createElement("li"); item.textContent = text; return item;
  }));
  elements.tutorialPosition.textContent = `${tutorialIndex + 1} / ${TUTORIAL_CARDS.length}`;
  elements.tutorialPrevious.disabled = tutorialIndex === 0;
  elements.tutorialNext.textContent = tutorialIndex === TUTORIAL_CARDS.length - 1 ? "开始校准" : "下一张";
  elements.tutorialDialog.querySelector(".dialog-shell").scrollTop = 0;
}

function openTutorial() {
  if (anyDialogOpen()) return;
  tutorialReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : elements.tutorialButton;
  tutorialIndex = 0;
  renderTutorialCard();
  openNativeDialog(elements.tutorialDialog, elements.tutorialNext);
}

function closeTutorial() {
  markTutorialSeen(storage);
  closeNativeDialog(elements.tutorialDialog);
  tutorialReturnFocus?.focus?.({ preventScroll: true });
}

function openReplay() {
  if (anyDialogOpen()) return;
  replayReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : elements.replayButton;
  elements.replayCopy.textContent = `「${level.title}」从完整 1–16 星盘执行下列 ${level.scramble.length} 次合法 2 × 2 扰动而来：`;
  elements.replayList.replaceChildren(...level.scramble.map((move, index) => {
    const item = document.createElement("li");
    item.textContent = `第 ${index + 1} 次：第 ${move.row + 1} 行、第 ${move.column + 1} 列窗口${move.direction === "cw" ? "顺时针" : "逆时针"}旋转`;
    return item;
  }));
  openNativeDialog(elements.replayDialog, elements.replayClose);
}

function closeReplay() {
  closeNativeDialog(elements.replayDialog);
  replayReturnFocus?.focus?.({ preventScroll: true });
}

function openVictory(rewards) {
  if (anyDialogOpen()) return;
  victoryReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : elements.cw;
  elements.victoryLevel.textContent = level.title;
  elements.victoryMoves.textContent = `${state.moves} 旋`;
  elements.victoryPar.textContent = `${level.par} 旋`;
  elements.victoryRewards.textContent = `${rewards} 枚`;
  elements.victoryCopy.textContent = state.moves <= level.par
    ? "十六枚星历环全部升序对齐，并达到这关可复算的参考回放。"
    : "十六枚星历环已经全部升序对齐；下次可尝试靠近可复算的参考回放。";
  openNativeDialog(elements.victoryDialog, elements.victoryNext);
}

function closeVictory() {
  closeNativeDialog(elements.victoryDialog);
  victoryReturnFocus?.focus?.({ preventScroll: true });
}

elements.newRun.addEventListener("click", () => {
  const choices = levelsForDifficulty(selectedDifficulty);
  const index = choices.findIndex((entry) => entry.id === level.id);
  startLevel(choices[(index + 1 + choices.length) % choices.length] ?? firstLevel(selectedDifficulty), true);
});
elements.undo.addEventListener("click", undo);
elements.restart.addEventListener("click", restartLevel);
elements.ccw.addEventListener("click", () => rotate("ccw"));
elements.cw.addEventListener("click", () => rotate("cw"));
elements.tutorialButton?.addEventListener("click", openTutorial);
elements.tutorialSkip.addEventListener("click", closeTutorial);
elements.tutorialPrevious.addEventListener("click", () => { if (tutorialIndex > 0) { tutorialIndex -= 1; renderTutorialCard(); } });
elements.tutorialNext.addEventListener("click", () => {
  if (tutorialIndex < TUTORIAL_CARDS.length - 1) { tutorialIndex += 1; renderTutorialCard(); }
  else closeTutorial();
});
elements.replayButton.addEventListener("click", openReplay);
elements.replayClose.addEventListener("click", closeReplay);
elements.victoryStay.addEventListener("click", closeVictory);
elements.victoryNext.addEventListener("click", () => { closeVictory(); startLevel(nextLevel(level.id), true); });

for (const [dialog, close] of [[elements.tutorialDialog, closeTutorial], [elements.replayDialog, closeReplay], [elements.victoryDialog, closeVictory]]) {
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || anyDialogOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "")) return;
  const directions = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (directions[event.key]) {
    event.preventDefault();
    const [dy, dx] = directions[event.key];
    selectZone({ row: selectedZone.row + dy, column: selectedZone.column + dx }, true);
  } else if (event.key === "Enter") { event.preventDefault(); rotate("ccw"); }
  else if (event.key === " ") { event.preventDefault(); rotate("cw"); }
  else if (event.key.toLowerCase() === "u") { event.preventDefault(); undo(); }
  else if (event.key.toLowerCase() === "r") { event.preventDefault(); restartLevel(); }
});

window.addEventListener("beforeunload", () => { if (!state.complete) saveCurrentSession(); });
window.addEventListener("ten-realms-v3:realm-ready", flushOutbox);
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEYS.profile) return;
  const loaded = loadProfile(storage, findLevel, DEFAULT_LEVEL_ID);
  if (loaded.status === "restored") { profile = loaded.profile; renderSummary(); }
});

// Static real-tutorial guard. If a future edit changes the chosen card's move,
// the visual metadata and runtime proof cannot silently drift apart.
const tutorialLevel = findLevel(TUTORIAL_LEVEL_ID);
const tutorialAfter = tutorialLevel ? applyStateMove(tutorialLevel, stateForLevel(tutorialLevel), TUTORIAL_ACTION) : null;
if (!tutorialLevel || !tutorialAfter?.changed || tutorialAfter.state.complete || tutorialLevel.referenceSolution[0].direction !== TUTORIAL_ACTION.direction) {
  console.error("Star Dial tutorial contract is not replayable.");
}

renderSummary();
flushOutbox();
if (state.complete) window.setTimeout(() => settleCurrentCompletion(true), 250);
else if (!tutorialSeen(storage)) window.setTimeout(() => { if (!anyDialogOpen()) openTutorial(); }, 420);
