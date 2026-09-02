import {
  CELL,
  applyStateMove,
  cellCoordinates,
  createState,
  evaluateBoard,
  neighbourhood,
  referenceState,
  stateForLevel,
  undoState,
} from "./logic.mjs";
import {
  DEFAULT_LEVEL_ID,
  DIFFICULTIES,
  LEVELS,
  TUTORIAL_ACTION,
  TUTORIAL_LEVEL_ID,
  findLevel,
  firstLevel,
  levelsForDifficulty,
  nextLevel,
} from "./levels.mjs";
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
  deliverCompletion,
  normalizeCompletion,
  queueCompletion,
  settleCompletion,
} from "./completion.mjs";

const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();

const TUTORIAL_CARDS = Object.freeze([
  Object.freeze({
    step: "01 · 认识残片",
    title: "数字记录九格深色颜料",
    body: "这是真实首关「晨星档案」的初始状态。每枚带数字的印记都会数自己在内、周围最多九格中有多少格最终是深色；数字不是该格本身的颜色。",
    bullets: Object.freeze(["深色、浅色、未定用材质、纹理与文字三重区分", "边缘印记只统计棋盘内真实存在的邻格"]),
    image: "./assets/tutorial-elements.svg?tutorial=1",
    alt: "晨星档案真实初始状态：4乘4壁画均未定，十六个印记显示各自3乘3邻域的深色目标数量。",
  }),
  Object.freeze({
    step: "02 · 落下一笔",
    title: "深色与浅色都能明确一格",
    body: "从同一真实题面，对第 2 行第 2 列执行一次深色操作。空格会按左键顺序变成深色；右键则先变浅色。触屏可在颜料台明确选深色、浅色或清除。",
    bullets: Object.freeze(["这一步只改变第 2 行第 2 列，附近印记的当前深色计数随之更新", "同一工具继续点会遵循上游的三态循环；清除直接回到未定"]),
    image: "./assets/tutorial-action.svg?tutorial=1",
    alt: "晨星档案真实一次操作：左侧是空白初始壁画，右侧是第2行第2列被填为深色后的壁画。",
  }),
  Object.freeze({
    step: "03 · 完成复原",
    title: "全盘明确，全部印记吻合才通关",
    body: "这是对同一首关执行固定参考填格后的真实完成状态。任何空格都会让壁画保持未完成；即使全盘都涂了，只要有一个印记的深色数不对，也不能结算。",
    bullets: Object.freeze(["首关共 16 格，全部从未定变为明确至少需要 16 笔", "无返工完成会获得效率墨章；该线由单笔只能改变一格的规则严格证明"]),
    image: "./assets/tutorial-goal.svg?tutorial=1",
    alt: "晨星档案真实完成状态：所有十六格为深色或浅色，全部十六个印记的深色计数满足。",
  }),
]);

const elements = Object.freeze({
  board: document.querySelector("#mural-grid"),
  clearCount: document.querySelector("#clear-count"),
  difficultyPicker: document.querySelector("#difficulty-picker"),
  explicitCount: document.querySelector("#explicit-count"),
  levelKicker: document.querySelector("#level-kicker"),
  levelPicker: document.querySelector("#level-picker"),
  levelSubtitle: document.querySelector("#level-subtitle"),
  levelTitle: document.querySelector("#level-title"),
  live: document.querySelector("#live-status"),
  localClues: document.querySelector("#local-clues"),
  moveCount: document.querySelector("#move-count"),
  newRun: document.querySelector("#new-run-button"),
  parCount: document.querySelector("#par-count"),
  restart: document.querySelector("#restart-button"),
  rewardCount: document.querySelector("#reward-count"),
  satisfiedCount: document.querySelector("#satisfied-count"),
  saveStatus: document.querySelector("#save-status"),
  selectedCopy: document.querySelector("#selected-copy"),
  selectedState: document.querySelector("#selected-state"),
  selectedTitle: document.querySelector("#selected-title"),
  stage: document.querySelector("#mural-stage"),
  toast: document.querySelector("#toast"),
  toolBlack: document.querySelector("#tool-black"),
  toolClear: document.querySelector("#tool-clear"),
  toolWhite: document.querySelector("#tool-white"),
  tutorialBody: document.querySelector("#tutorial-body"),
  tutorialBullets: document.querySelector("#tutorial-bullets"),
  tutorialButton: document.querySelector("#tutorial-button"),
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
  victoryMoves: document.querySelector("#victory-moves"),
  victoryNext: document.querySelector("#victory-next-button"),
  victoryPar: document.querySelector("#victory-par"),
  victoryRewards: document.querySelector("#victory-rewards"),
  victoryStay: document.querySelector("#victory-stay-button"),
});

let profileResult = loadProfile(storage, findLevel, DEFAULT_LEVEL_ID);
let profile = profileResult.profile;
let sessionResult = loadSession(storage, findLevel);
let level = sessionResult.session?.level ?? findLevel(profile.preferences.levelId) ?? firstLevel("easy");
let state = sessionResult.session?.state ?? createState(level);
let runId = sessionResult.session?.runId ?? createRunId(Date.now(), entropy());
let carriedElapsed = sessionResult.session?.elapsedMs ?? 0;
let startedAt = Date.now();
let selectedIndex = 0;
let selectedTool = "black";
let selectedDifficulty = level.difficulty;
let boardLevelId = "";
let cellButtons = [];
let tutorialIndex = 0;
let tutorialReturnFocus = null;
let victoryReturnFocus = null;
let victoryToken = 0;
let shownVictoryEvent = null;
let toastTimer = 0;

function entropy() {
  try { return window.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Date.now(); } catch { return Date.now(); }
}

function elapsedMs() {
  return Math.max(0, Math.floor(carriedElapsed + (state.complete ? 0 : Date.now() - startedAt)));
}

function announce(message) {
  elements.live.textContent = "";
  window.setTimeout(() => { elements.live.textContent = message; }, 15);
}

function showToast(message, duration = 3600) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}

function writeSaveStatus(message, successful) {
  elements.saveStatus.lastElementChild.textContent = successful ? message : "本机档案暂未写入 · 当前仍可游玩";
  elements.saveStatus.classList.toggle("is-saved", Boolean(successful));
}

function persistProfile() {
  const saved = saveProfile(storage, profile, findLevel, DEFAULT_LEVEL_ID);
  writeSaveStatus("本机修复档案已保存", saved);
  return saved;
}

function saveCurrentSession() {
  const saved = saveSession(storage, { level, runId, state, elapsedMs: elapsedMs() });
  writeSaveStatus("本局壁画已保存", saved);
  return saved;
}

function humanState(value) {
  return value === CELL.BLACK ? "深色" : value === CELL.WHITE ? "浅色" : "未定";
}

function levelLabel(candidate) {
  return `${candidate.width} × ${candidate.height} · ${candidate.par} 笔全显影`;
}

function buildDifficultyPicker() {
  elements.difficultyPicker.replaceChildren(...DIFFICULTIES.map((difficulty) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = difficulty === selectedDifficulty ? "is-active" : "";
    button.setAttribute("aria-pressed", String(difficulty === selectedDifficulty));
    button.textContent = ({ easy: "入门", medium: "进阶", hard: "天顶" })[difficulty];
    button.addEventListener("click", () => {
      selectedDifficulty = difficulty;
      buildDifficultyPicker();
      buildLevelPicker();
    });
    return button;
  }));
}

function buildLevelPicker() {
  elements.levelPicker.replaceChildren(...levelsForDifficulty(selectedDifficulty).map((candidate) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = candidate.id === level.id ? "is-active" : "";
    if (profile.completedLevelIds.includes(candidate.id)) button.classList.add("is-cleared");
    button.innerHTML = "<i aria-hidden=\"true\"></i><span><b></b><small></small></span><em></em>";
    button.querySelector("i").textContent = String(LEVELS.indexOf(candidate) + 1).padStart(2, "0");
    button.querySelector("b").textContent = candidate.title;
    button.querySelector("small").textContent = levelLabel(candidate);
    button.querySelector("em").textContent = profile.completedLevelIds.includes(candidate.id) ? "已复原" : "未复原";
    button.addEventListener("click", () => { if (candidate.id !== level.id) startLevel(candidate, true); });
    return button;
  }));
}

function buildBoard() {
  boardLevelId = level.id;
  elements.board.style.setProperty("--columns", String(level.width));
  elements.board.setAttribute("aria-rowcount", String(level.height));
  elements.board.setAttribute("aria-colcount", String(level.width));
  cellButtons = Array.from({ length: level.width * level.height }, (_, index) => {
    const coordinate = cellCoordinates(level, index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mural-cell";
    button.dataset.index = String(index);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-rowindex", String(coordinate.row + 1));
    button.setAttribute("aria-colindex", String(coordinate.column + 1));
    button.innerHTML = "<span class=\"pigment\" aria-hidden=\"true\"></span><span class=\"tile-constellation\" aria-hidden=\"true\">✦</span><span class=\"clue-mark\"></span>";
    button.addEventListener("click", () => applyTool(index, selectedTool));
    button.addEventListener("contextmenu", (event) => { event.preventDefault(); applyTool(index, "white"); });
    button.addEventListener("focus", () => { selectedIndex = index; renderSelection(); });
    button.addEventListener("keydown", (event) => handleGridKey(event, index));
    return button;
  });
  elements.board.replaceChildren(...cellButtons);
}

function renderBoard() {
  if (boardLevelId !== level.id) buildBoard();
  const evaluation = evaluateBoard(level, state.board);
  const clueByIndex = new Map(evaluation.clues.map((clue) => [clue.index, clue]));
  cellButtons.forEach((button, index) => {
    const coordinate = cellCoordinates(level, index);
    const value = state.board[index];
    const clue = level.clues[index];
    const result = clueByIndex.get(index);
    button.dataset.state = String(value);
    button.classList.toggle("is-selected", index === selectedIndex);
    button.classList.toggle("is-clue", clue !== null);
    button.classList.toggle("is-impossible", Boolean(result?.impossible));
    button.classList.toggle("is-exact", Boolean(result?.exact && !result?.impossible));
    button.classList.toggle("is-settled", Boolean(result?.settled));
    button.setAttribute("aria-label", `第 ${coordinate.row + 1} 行第 ${coordinate.column + 1} 列，${humanState(value)}${clue === null ? "，无数字印记" : `，印记 ${clue}，当前深色 ${result.black} 格`}`);
    button.querySelector(".clue-mark").textContent = clue === null ? "" : String(clue);
  });
  elements.stage.classList.toggle("is-complete", evaluation.complete);
  elements.moveCount.textContent = String(state.moves);
  elements.parCount.textContent = String(level.par);
  elements.explicitCount.textContent = `${state.board.length - evaluation.empty} / ${state.board.length}`;
  elements.satisfiedCount.textContent = `${evaluation.clues.filter((clue) => clue.exact).length} / ${evaluation.clues.length}`;
  elements.undo.disabled = state.moves === 0 || state.complete;
  renderSelection(evaluation);
}

function renderTools() {
  const tools = { black: elements.toolBlack, white: elements.toolWhite, clear: elements.toolClear };
  for (const [tool, button] of Object.entries(tools)) {
    const active = selectedTool === tool;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function renderSelection(evaluation = evaluateBoard(level, state.board)) {
  selectedIndex = Math.max(0, Math.min(state.board.length - 1, selectedIndex));
  const coordinate = cellCoordinates(level, selectedIndex);
  const nearby = evaluation.clues.filter((clue) => neighbourhood(level, clue.index).includes(selectedIndex));
  elements.selectedTitle.textContent = `第 ${coordinate.row + 1} 行 · 第 ${coordinate.column + 1} 列`;
  elements.selectedState.textContent = humanState(state.board[selectedIndex]);
  elements.selectedState.dataset.state = String(state.board[selectedIndex]);
  elements.selectedCopy.textContent = nearby.length
    ? `这里会影响 ${nearby.length} 枚可见印记；其中 ${nearby.filter((clue) => clue.exact).length} 枚当前深色数已吻合。`
    : "这里不在可见数字印记旁，但仍必须明确涂成深色或浅色才可以完成。";
  elements.localClues.replaceChildren(...nearby.map((clue) => {
    const item = document.createElement("li");
    item.className = clue.impossible ? "is-impossible" : clue.exact ? "is-exact" : "";
    const at = cellCoordinates(level, clue.index);
    item.innerHTML = "<b></b><span></span><small></small>";
    item.querySelector("b").textContent = String(clue.target);
    item.querySelector("span").textContent = `第 ${at.row + 1} 行 · 第 ${at.column + 1} 列`;
    item.querySelector("small").textContent = clue.impossible ? `深色 ${clue.black} · 已不可能` : `深色 ${clue.black} / ${clue.target} · 未定 ${clue.empty}`;
    return item;
  }));
  for (const [index, button] of cellButtons.entries()) button.classList.toggle("is-selected", index === selectedIndex);
}

function renderSummary() {
  elements.levelKicker.textContent = `${level.difficulty.toUpperCase()} · ${level.width} × ${level.height} · ${level.muralTag}`;
  elements.levelTitle.textContent = level.title;
  elements.levelSubtitle.textContent = level.subtitle;
  elements.clearCount.textContent = `${profile.completedLevelIds.length} / ${LEVELS.length}`;
  elements.rewardCount.textContent = String(profile.rewardLedger.length);
  buildDifficultyPicker();
  buildLevelPicker();
  renderTools();
  renderBoard();
}

function applyTool(index, tool) {
  if (state.complete || anyDialogOpen()) return;
  const elapsedBefore = elapsedMs();
  const result = applyStateMove(level, state, { index, tool });
  if (!result.changed || !result.state) {
    if (tool === "clear") showToast("这格本来就是未定，不需要清除。");
    return;
  }
  state = result.state;
  selectedIndex = index;
  if (state.complete) {
    carriedElapsed = elapsedBefore;
    startedAt = Date.now();
  }
  saveCurrentSession();
  renderBoard();
  const coordinate = cellCoordinates(level, index);
  const stateText = humanState(state.board[index]);
  announce(`第 ${coordinate.row + 1} 行第 ${coordinate.column + 1} 列已设为${stateText}，第 ${state.moves} 笔。`);
  if (state.complete) {
    const token = ++victoryToken;
    window.setTimeout(() => { if (token === victoryToken && state.complete) settleCurrentCompletion(true); }, 340);
  }
}

function selectCell(index, focus = false) {
  selectedIndex = Math.max(0, Math.min(state.board.length - 1, index));
  renderSelection();
  if (focus) cellButtons[selectedIndex]?.focus({ preventScroll: true });
}

function handleGridKey(event, index) {
  const coordinate = cellCoordinates(level, index);
  if (event.key === "Enter") { event.preventDefault(); applyTool(index, "black"); return; }
  if (event.key === " " || event.key === "Spacebar") { event.preventDefault(); applyTool(index, "white"); return; }
  if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); applyTool(index, "clear"); return; }
  if (event.key.toLowerCase() === "b") { event.preventDefault(); applyTool(index, "black"); return; }
  if (event.key.toLowerCase() === "w") { event.preventDefault(); applyTool(index, "white"); return; }
  const direction = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
  if (!direction) return;
  event.preventDefault();
  const row = Math.max(0, Math.min(level.height - 1, coordinate.row + direction[0]));
  const column = Math.max(0, Math.min(level.width - 1, coordinate.column + direction[1]));
  selectCell(row * level.width + column, true);
}

function startLevel(next, newRun) {
  closeOpenDialogs();
  level = next;
  selectedDifficulty = next.difficulty;
  state = createState(level);
  if (newRun) runId = createRunId(Date.now(), entropy());
  carriedElapsed = 0;
  startedAt = Date.now();
  selectedIndex = 0;
  boardLevelId = "";
  profile = { ...profile, preferences: { ...profile.preferences, levelId: level.id } };
  persistProfile();
  saveCurrentSession();
  renderSummary();
  announce(`${level.title} 已载入。`);
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function restartLevel(newRun = false) {
  if (anyDialogOpen()) return;
  victoryToken += 1;
  state = createState(level);
  if (newRun) runId = createRunId(Date.now(), entropy());
  carriedElapsed = 0;
  startedAt = Date.now();
  selectedIndex = 0;
  saveCurrentSession();
  renderBoard();
  announce(newRun ? "已开立新的修复记录。" : "壁画已回到真实初始状态。");
}

function undo() {
  if (anyDialogOpen() || state.complete) return;
  const result = undoState(level, state);
  if (!result.changed || !result.state) { showToast("还没有可撤回的落笔。"); return; }
  state = result.state;
  selectedIndex = state.history.at(-1)?.index ?? selectedIndex;
  saveCurrentSession();
  renderBoard();
  announce(`已撤回，回到第 ${state.moves} 笔。`);
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
  let result;
  try {
    result = settleCompletion({ profile, level, state, runId, elapsedMs: elapsedMs() });
  } catch {
    showToast("通关已确认，但本地结算暂时不可用。");
    return;
  }
  profile = result.profile;
  const profileSaved = persistProfile();
  const sessionSaved = saveCurrentSession();
  const queued = result.detail ? enqueueOutbox(storage, result.detail, normalizeCompletion) : { saved: true };
  if (profileSaved && sessionSaved && queued.saved) flushOutbox();
  else if (result.detail) queueCompletion(window, result.detail);
  renderSummary();
  if (!profileSaved || !sessionSaved || !queued.saved) showToast("已验证完成；连接恢复后会重试结算。", 4600);
  else if (result.claims.length) showToast(`获得 ${result.claims.length} 枚新墨章。`);
  if (showVictory && shownVictoryEvent !== result.detail?.eventId) {
    shownVictoryEvent = result.detail?.eventId ?? shownVictoryEvent;
    openVictory(result.claims.length);
  }
}

function anyDialogOpen() {
  return Boolean(document.querySelector("dialog[open]"));
}

function openNativeDialog(dialog, focusTarget) {
  document.body.classList.add("is-dialog-open");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  window.requestAnimationFrame(() => focusTarget?.focus?.({ preventScroll: true }));
}

function closeNativeDialog(dialog) {
  if (dialog.open && typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (!anyDialogOpen()) document.body.classList.remove("is-dialog-open");
}

function closeOpenDialogs() {
  [elements.tutorialDialog, elements.victoryDialog].forEach((dialog) => { if (dialog.open) closeNativeDialog(dialog); });
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
  elements.tutorialNext.textContent = tutorialIndex === TUTORIAL_CARDS.length - 1 ? "开始修复" : "下一张";
  elements.tutorialDialog.querySelector(".dialog-shell").scrollTop = 0;
}

function openTutorial() {
  if (anyDialogOpen()) return;
  // The tutorial may be opened automatically (where activeElement is body) or
  // relayed from the shared dock. In both cases returning to the page's own
  // persistent tutorial control is the stable, visible focus target.
  tutorialReturnFocus = elements.tutorialButton;
  tutorialIndex = 0;
  renderTutorialCard();
  openNativeDialog(elements.tutorialDialog, elements.tutorialNext);
}

function closeTutorial() {
  markTutorialSeen(storage);
  closeNativeDialog(elements.tutorialDialog);
  tutorialReturnFocus?.focus?.({ preventScroll: true });
}

function openVictory(rewards) {
  if (anyDialogOpen()) return;
  victoryReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : cellButtons[selectedIndex];
  elements.victoryMoves.textContent = `${state.moves} 笔`;
  elements.victoryPar.textContent = `${level.par} 笔`;
  elements.victoryRewards.textContent = `${rewards} 枚`;
  elements.victoryCopy.textContent = state.moves <= level.par
    ? "所有格都已明确，全部印记吻合，并达到无返工全显影线。"
    : "所有格都已明确，全部印记吻合；下次可挑战无返工全显影。";
  openNativeDialog(elements.victoryDialog, elements.victoryNext);
}

function closeVictory() {
  closeNativeDialog(elements.victoryDialog);
  victoryReturnFocus?.focus?.({ preventScroll: true });
}

elements.toolBlack.addEventListener("click", () => { selectedTool = "black"; renderTools(); announce("已选深色颜料。"); });
elements.toolWhite.addEventListener("click", () => { selectedTool = "white"; renderTools(); announce("已选浅色底料。"); });
elements.toolClear.addEventListener("click", () => { selectedTool = "clear"; renderTools(); announce("已选清除工具。"); });
elements.undo.addEventListener("click", undo);
elements.restart.addEventListener("click", () => restartLevel(false));
elements.newRun.addEventListener("click", () => restartLevel(true));
elements.tutorialButton.addEventListener("click", openTutorial);
elements.tutorialSkip.addEventListener("click", closeTutorial);
elements.tutorialPrevious.addEventListener("click", () => { if (tutorialIndex > 0) { tutorialIndex -= 1; renderTutorialCard(); } });
elements.tutorialNext.addEventListener("click", () => {
  if (tutorialIndex < TUTORIAL_CARDS.length - 1) { tutorialIndex += 1; renderTutorialCard(); }
  else closeTutorial();
});
elements.victoryStay.addEventListener("click", closeVictory);
elements.victoryNext.addEventListener("click", () => { closeVictory(); startLevel(nextLevel(level.id), true); });
for (const [dialog, close] of [[elements.tutorialDialog, closeTutorial], [elements.victoryDialog, closeVictory]]) {
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || anyDialogOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "")) return;
  if (event.key.toLowerCase() === "u") { event.preventDefault(); undo(); }
  else if (event.key.toLowerCase() === "r") { event.preventDefault(); restartLevel(false); }
});
window.addEventListener("pagehide", () => { if (!state.complete) saveCurrentSession(); });
window.addEventListener("ten-realms-v3:realm-ready", flushOutbox);
window.addEventListener("realm:ready", flushOutbox);
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEYS.profile) return;
  const loaded = loadProfile(storage, findLevel, DEFAULT_LEVEL_ID);
  if (loaded.status === "restored") { profile = loaded.profile; renderSummary(); }
});

// Static tutorial guard: these assets can only describe a replayable Mosaic state.
const tutorialLevel = findLevel(TUTORIAL_LEVEL_ID);
const tutorialInitial = tutorialLevel ? stateForLevel(tutorialLevel) : null;
const tutorialAfter = tutorialLevel && tutorialInitial ? applyStateMove(tutorialLevel, tutorialInitial, TUTORIAL_ACTION) : null;
if (!tutorialLevel || !tutorialInitial || !tutorialAfter?.changed || tutorialAfter.state.complete || !referenceState(tutorialLevel)?.complete) {
  throw new Error("Celestial Mural tutorial contract is not replayable.");
}

renderSummary();
flushOutbox();
if (state.complete) window.setTimeout(() => settleCurrentCompletion(true), 250);
else if (!tutorialSeen(storage)) window.setTimeout(() => { if (!anyDialogOpen()) openTutorial(); }, 420);
