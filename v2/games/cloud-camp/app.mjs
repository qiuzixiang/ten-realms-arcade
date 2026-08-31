import {
  CELL_STATE,
  applyMove,
  evaluatePosition,
  isTree,
  keyOf,
  orthogonalNeighbours,
  pointFromKey,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  difficultyFor,
  levelsForDifficulty,
} from "./levels.mjs";
import {
  DECORATIONS,
  HISTORY_LIMIT,
  VISITORS,
  campSummary,
  confirmCampCompletion,
  createDefaultState,
  parseStoredGame,
  recordCampCompletionOnce,
  serializeStoredGame,
  snapshotFromState,
} from "./storage.mjs";

const STORAGE_KEY = "ten-realms-v2:games:cloud-camp:save:v1";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  assertiveStatus: document.querySelector("#assertive-status"),
  board: document.querySelector("#camp-board"),
  boardProgressBar: document.querySelector("#board-progress-bar"),
  boardScrollHint: document.querySelector("#board-scroll-hint"),
  boardViewport: document.querySelector("#board-viewport"),
  campMessage: document.querySelector("#camp-message"),
  campStreak: document.querySelector("#camp-streak"),
  checkButton: document.querySelector("#check-button"),
  clearProgress: document.querySelector("#clear-progress"),
  decorationList: document.querySelector("#decoration-list"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  difficultyKicker: document.querySelector("#difficulty-kicker"),
  difficultyNote: document.querySelector("#difficulty-note"),
  efficientCount: document.querySelector("#efficient-count"),
  flawlessCount: document.querySelector("#flawless-count"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  grassTool: document.querySelector("#grass-tool"),
  levelTitle: document.querySelector("#level-title"),
  matchingReadout: document.querySelector("#matching-readout"),
  mistakeCount: document.querySelector("#mistake-count"),
  moveCount: document.querySelector("#move-count"),
  muteButton: document.querySelector("#mute-button"),
  newGameButton: document.querySelector("#new-game-button"),
  nextLevelButton: document.querySelector("#next-level-button"),
  politeStatus: document.querySelector("#polite-status"),
  restartButton: document.querySelector("#restart-button"),
  rulesButton: document.querySelector("#rules-button"),
  rulesCloseButton: document.querySelector("#rules-close-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  saveState: document.querySelector("#save-state"),
  skyClock: document.querySelector("#sky-clock"),
  skipLink: document.querySelector(".skip-link"),
  stayButton: document.querySelector("#stay-button"),
  tentCount: document.querySelector("#tent-count"),
  tentProgress: document.querySelector("#tent-progress"),
  tentTool: document.querySelector("#tent-tool"),
  toast: document.querySelector("#toast"),
  treeTotal: document.querySelector("#tree-total"),
  undoButton: document.querySelector("#undo-button"),
  unlockCopy: document.querySelector("#unlock-copy"),
  victoryCopy: document.querySelector("#victory-copy"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryMistakes: document.querySelector("#victory-mistakes"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryPar: document.querySelector("#victory-par"),
  victoryVisitors: document.querySelector("#victory-visitors"),
  visitorList: document.querySelector("#visitor-list"),
};

let state = createDefaultState();
let currentEvaluation = evaluatePosition(state.level, state);
let cellElements = new Map();
let rowClueElements = [];
let columnClueElements = [];
let focusKey = null;
let audioContext = null;
let toastTimer = 0;
let saveTimer = 0;
let reviewTimer = 0;
let victoryTimer = 0;
let storageAvailable = true;
let rulesReturnFocus = null;
let victoryReturnFocus = null;
let victoryBlocker = null;
let dialogScrollY = 0;

function syncDialogScrollLock() {
  const hasOpenDialog = Boolean(document.querySelector("dialog[open]"));
  const locked = document.documentElement.classList.contains("is-dialog-locked");
  if (hasOpenDialog && !locked) {
    dialogScrollY = window.scrollY;
    document.documentElement.classList.add("is-dialog-locked");
    document.body.classList.add("is-dialog-locked");
    document.body.style.top = `-${dialogScrollY}px`;
  } else if (!hasOpenDialog && locked) {
    document.documentElement.classList.remove("is-dialog-locked");
    document.body.classList.remove("is-dialog-locked");
    document.body.style.removeProperty("top");
    window.scrollTo({ top: dialogScrollY, left: 0, behavior: "auto" });
  }
}

function setCampMessage(title, copy, tone = "normal") {
  elements.campMessage.querySelector("strong").textContent = title;
  elements.campMessage.querySelector("p span").textContent = copy;
  elements.campMessage.classList.toggle("is-warning", tone === "warning");
  elements.campMessage.classList.toggle("is-success", tone === "success");
}

function showToast(message, isError = false, duration = 2800) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
  announce(message, isError ? "assertive" : "polite");
}

function announce(message, priority = "assertive") {
  const region = priority === "polite" ? elements.politeStatus : elements.assertiveStatus;
  region.textContent = "";
  window.requestAnimationFrame(() => {
    region.textContent = message;
  });
}

function setSavedMessage(message = "刚刚已自动保存") {
  window.clearTimeout(saveTimer);
  if (!storageAvailable) {
    elements.saveState.textContent = "浏览器未开放本机存档";
    return;
  }
  elements.saveState.textContent = message;
  saveTimer = window.setTimeout(() => {
    elements.saveState.textContent = "每一步都留在本机";
  }, 2300);
}

function readSave() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
  }
  const result = parseStoredGame(raw);
  state = result.state;
  if (result.invalid) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      storageAvailable = false;
    }
  }
  return result;
}

function writeSave({ quiet = false } = {}) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeStoredGame(state)));
    storageAvailable = true;
    if (!quiet) setSavedMessage();
  } catch {
    storageAvailable = false;
    if (!quiet) setSavedMessage();
  }
}

function ensureAudio() {
  if (state.muted) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function tone(frequency, duration, options = {}) {
  const context = ensureAudio();
  if (!context) return;
  const start = context.currentTime + (options.delay ?? 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.025, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSound(effect) {
  if (state.muted) return;
  if (effect.includes("to-tent")) {
    tone(392, 0.18, { type: "triangle", gain: 0.026, endFrequency: 540 });
    tone(784, 0.22, { gain: 0.012, delay: 0.045 });
  } else if (effect.includes("to-grass")) {
    tone(290, 0.1, { type: "triangle", gain: 0.016 });
    tone(348, 0.08, { type: "sine", gain: 0.008, delay: 0.035 });
  } else if (effect.endsWith("to-unknown")) {
    tone(410, 0.13, { gain: 0.015, endFrequency: 310 });
  } else if (effect === "warning") {
    tone(156, 0.13, { type: "triangle", gain: 0.022 });
    tone(132, 0.15, { type: "triangle", gain: 0.012, delay: 0.1 });
  } else if (effect === "undo") {
    tone(360, 0.11, { gain: 0.014, endFrequency: 480 });
  } else if (effect === "new") {
    tone(440, 0.16, { gain: 0.013 });
    tone(660, 0.18, { gain: 0.01, delay: 0.08 });
  } else if (effect === "win") {
    [294, 392, 494, 659, 784].forEach((frequency, index) => {
      tone(frequency, 1.15 - index * 0.08, { gain: 0.022, delay: index * 0.13 });
      tone(frequency * 2, 0.58, { gain: 0.005, delay: index * 0.13 + 0.05 });
    });
  }
}

function treeMarkup() {
  return '<span class="tree-visual" aria-hidden="true"><i></i><i></i><i></i><b></b></span>';
}

function tentMarkup() {
  return '<span class="tent-visual" aria-hidden="true"><i></i><i></i><b class="campfire"></b></span>';
}

function grassMarkup() {
  return '<span class="grass-mark" aria-hidden="true">×</span>';
}

function createClue(kind, index, target) {
  const element = document.createElement("div");
  element.className = `clue-cell clue-cell--${kind}`;
  element.dataset.kind = kind;
  element.dataset.index = String(index);
  element.dataset.count = "0";
  element.textContent = String(target);
  element.setAttribute("role", kind === "column" ? "columnheader" : "rowheader");
  return element;
}

function buildBoard() {
  elements.board.replaceChildren();
  cellElements = new Map();
  rowClueElements = [];
  columnClueElements = [];
  elements.board.style.setProperty("--columns", state.level.width);
  elements.board.setAttribute("aria-rowcount", String(state.level.height + 1));
  elements.board.setAttribute("aria-colcount", String(state.level.width + 1));
  elements.board.setAttribute(
    "aria-label",
    `${state.level.title}，${state.level.width} 乘 ${state.level.height} 漂浮林地`,
  );

  const headerRow = document.createElement("div");
  headerRow.className = "board-row board-row--header";
  headerRow.setAttribute("role", "row");
  headerRow.setAttribute("aria-rowindex", "1");
  for (let column = 0; column < state.level.width; column += 1) {
    const clue = createClue("column", column, state.level.columnClues[column]);
    clue.setAttribute("aria-rowindex", "1");
    clue.setAttribute("aria-colindex", String(column + 1));
    columnClueElements.push(clue);
    headerRow.append(clue);
  }
  const corner = document.createElement("div");
  corner.className = "clue-corner";
  corner.setAttribute("role", "columnheader");
  corner.setAttribute("aria-rowindex", "1");
  corner.setAttribute("aria-colindex", String(state.level.width + 1));
  corner.setAttribute("aria-label", "右侧数字是每行帐篷数");
  corner.textContent = "✦";
  headerRow.append(corner);
  elements.board.append(headerRow);

  let firstPlayable = null;
  for (let row = 0; row < state.level.height; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";
    rowElement.setAttribute("role", "row");
    rowElement.setAttribute("aria-rowindex", String(row + 2));
    for (let column = 0; column < state.level.width; column += 1) {
      const key = keyOf(row, column);
      let element;
      if (isTree(state.level, key)) {
        element = document.createElement("div");
        element.className = "board-cell tree";
        element.innerHTML = treeMarkup();
      } else {
        element = document.createElement("button");
        element.type = "button";
        element.className = "board-cell plot";
        element.tabIndex = -1;
        if (!firstPlayable) firstPlayable = key;
        element.addEventListener("focus", () => {
          focusKey = key;
          updateRovingTabIndex();
          highlightCandidateTrees(key);
        });
        element.addEventListener("blur", clearCandidateTrees);
      }
      element.dataset.key = key;
      element.dataset.row = String(row);
      element.dataset.column = String(column);
      element.style.setProperty("--wave-index", String(row * state.level.width + column));
      element.setAttribute("role", "gridcell");
      element.setAttribute("aria-rowindex", String(row + 2));
      element.setAttribute("aria-colindex", String(column + 1));
      cellElements.set(key, element);
      rowElement.append(element);
    }
    const clue = createClue("row", row, state.level.rowClues[row]);
    clue.setAttribute("aria-rowindex", String(row + 2));
    clue.setAttribute("aria-colindex", String(state.level.width + 1));
    rowClueElements.push(clue);
    rowElement.append(clue);
    elements.board.append(rowElement);
  }
  focusKey = firstPlayable;
  const firstButton = cellElements.get(focusKey);
  if (firstButton) firstButton.dataset.realmGameFocus = "";
  updateRovingTabIndex();
}

function updateRovingTabIndex() {
  for (const [key, element] of cellElements) {
    if (element.matches("button")) element.tabIndex = key === focusKey ? 0 : -1;
  }
}

function cellLabel(row, column, evaluation) {
  const key = keyOf(row, column);
  if (isTree(state.level, key)) {
    const adjacent = evaluation.treeOptions.get(key)?.length ?? 0;
    return `第 ${row + 1} 行第 ${column + 1} 列，云杉，当前正交相邻 ${adjacent} 顶帐篷`;
  }
  const parts = [`第 ${row + 1} 行第 ${column + 1} 列`];
  if (evaluation.tents.has(key)) {
    const options = evaluation.tentOptions.get(key)?.length ?? 0;
    parts.push(`帐篷，正交相邻 ${options} 棵候选云杉，配对未固定`);
  } else if (evaluation.grass.has(key)) {
    parts.push("草地排除标记");
  } else {
    parts.push("未知空地");
  }
  if (evaluation.touching.has(key)) parts.push("与另一顶帐篷接触");
  if (evaluation.orphanTents.has(key)) parts.push("没有正交相邻的云杉");
  return parts.join("，");
}

function clearCandidateTrees() {
  for (const element of cellElements.values()) element.classList.remove("is-candidate-tree");
}

function highlightCandidateTrees(key) {
  clearCandidateTrees();
  if (!currentEvaluation.tents.has(key)) return;
  for (const treeKey of currentEvaluation.tentOptions.get(key) ?? []) {
    cellElements.get(treeKey)?.classList.add("is-candidate-tree");
  }
}

function updateClueElement(element, clue, kind, index) {
  element.dataset.count = String(clue.count);
  element.classList.toggle("is-exact", clue.exact);
  element.classList.toggle("is-impossible", clue.impossible);
  element.classList.remove("is-review-error");
  const axis = kind === "row" ? `第 ${index + 1} 行` : `第 ${index + 1} 列`;
  const status = clue.exact ? "已精确满足" : clue.impossible ? "当前已无法满足" : "尚未满足";
  element.setAttribute("aria-label", `${axis}要求 ${clue.target} 顶帐篷，当前 ${clue.count} 顶，${status}`);
}

function updateDifficultyButtons() {
  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficulty));
  }
  const difficulty = difficultyFor(state.difficulty) ?? DIFFICULTIES[0];
  const levels = levelsForDifficulty(state.difficulty);
  const levelIndex = levels.findIndex(({ id }) => id === state.level.id);
  elements.difficultyKicker.textContent = `${difficulty.label}营线 · ${String(levelIndex + 1).padStart(2, "0")}`;
  elements.difficultyNote.textContent = difficulty.note;
}

function updateToolButtons() {
  const tentActive = state.tool === "tent";
  elements.tentTool.classList.toggle("is-active", tentActive);
  elements.grassTool.classList.toggle("is-active", !tentActive);
  elements.tentTool.setAttribute("aria-pressed", String(tentActive));
  elements.grassTool.setAttribute("aria-pressed", String(!tentActive));
}

function updateCampKeepsakes() {
  const summary = campSummary(state.stats);
  elements.clearProgress.textContent = `${summary.uniqueClears} / ${LEVELS.length} 块浮地`;
  const unlockedDecorations = new Set(summary.decorations.map(({ id }) => id));
  elements.decorationList.innerHTML = DECORATIONS.map((decoration) => `
    <li class="${unlockedDecorations.has(decoration.id) ? "is-unlocked" : "is-locked"}" title="${decoration.name}：通关 ${decoration.clears} 块不同浮地解锁">
      <b aria-hidden="true">${unlockedDecorations.has(decoration.id) ? decoration.symbol : "·"}</b>
      <small>${decoration.name}</small>
    </li>`).join("");
  elements.visitorList.innerHTML = summary.visitors.length
    ? summary.visitors.map((visitor) => `<li title="${visitor.name}" aria-label="${visitor.name}">${visitor.symbol}</li>`).join("")
    : '<li class="is-empty">通关后会有脚步声</li>';
  elements.campStreak.textContent = `${summary.streak} 天`;
  elements.flawlessCount.textContent = `${summary.flawlessClears} 局`;
  elements.efficientCount.textContent = `${summary.efficientClears} 局`;
}

function updateScrollHint() {
  const needed = elements.boardViewport.scrollWidth > elements.boardViewport.clientWidth + 2;
  elements.boardScrollHint.classList.toggle("is-needed", needed);
}

function render() {
  currentEvaluation = evaluatePosition(state.level, state);
  for (let row = 0; row < state.level.height; row += 1) {
    for (let column = 0; column < state.level.width; column += 1) {
      const key = keyOf(row, column);
      const element = cellElements.get(key);
      if (isTree(state.level, key)) {
        element.setAttribute("aria-label", cellLabel(row, column, currentEvaluation));
        continue;
      }
      const nextState = currentEvaluation.tents.has(key)
        ? CELL_STATE.TENT
        : currentEvaluation.grass.has(key) ? CELL_STATE.GRASS : CELL_STATE.UNKNOWN;
      if (element.dataset.state !== nextState) {
        element.dataset.state = nextState;
        element.innerHTML = nextState === CELL_STATE.TENT
          ? tentMarkup()
          : nextState === CELL_STATE.GRASS ? grassMarkup() : "";
      }
      element.classList.toggle("has-tent", nextState === CELL_STATE.TENT);
      element.classList.toggle("has-grass", nextState === CELL_STATE.GRASS);
      element.classList.toggle("has-touch-conflict", currentEvaluation.touching.has(key));
      element.classList.toggle("has-orphan", currentEvaluation.orphanTents.has(key));
      element.classList.remove("is-review-error");
      element.setAttribute("aria-label", cellLabel(row, column, currentEvaluation));
    }
  }
  currentEvaluation.rows.forEach((clue, index) => updateClueElement(rowClueElements[index], clue, "row", index));
  currentEvaluation.columns.forEach((clue, index) => updateClueElement(columnClueElements[index], clue, "column", index));

  const ratio = Math.min(1, currentEvaluation.tentCount / currentEvaluation.treeCount);
  document.body.style.setProperty("--camp-progress", ratio.toFixed(3));
  document.body.classList.toggle("is-night-camp", currentEvaluation.complete);
  elements.skyClock.style.setProperty("--tent-ratio", ratio.toFixed(3));
  elements.boardProgressBar.style.width = `${Math.round(ratio * 100)}%`;
  elements.tentProgress.textContent = `${currentEvaluation.tentCount} / ${currentEvaluation.treeCount}`;
  elements.tentCount.textContent = String(currentEvaluation.tentCount);
  elements.treeTotal.textContent = ` / ${currentEvaluation.treeCount}`;
  elements.moveCount.textContent = String(state.moves);
  elements.mistakeCount.textContent = String(state.mistakes);
  elements.levelTitle.textContent = state.level.title;
  elements.undoButton.disabled = state.history.length === 0;
  elements.board.classList.toggle("is-complete", currentEvaluation.complete);

  elements.matchingReadout.classList.remove("is-valid", "is-invalid");
  if (currentEvaluation.matching.perfect) {
    elements.matchingReadout.textContent = "可一一安排";
    elements.matchingReadout.classList.add("is-valid");
  } else if (currentEvaluation.tentCount === currentEvaluation.treeCount) {
    elements.matchingReadout.textContent = "无法一一安排";
    elements.matchingReadout.classList.add("is-invalid");
  } else {
    elements.matchingReadout.textContent = `待安排 · ${currentEvaluation.matching.size}/${currentEvaluation.treeCount}`;
  }

  if (currentEvaluation.complete) {
    setCampMessage("篝火已经亮起", "所有数字精确归位，树与帐篷存在合法的全局一一安排。", "success");
  } else if (currentEvaluation.touching.size > 0) {
    setCampMessage("营位挨得太近", `${currentEvaluation.touching.size} 顶帐篷在水平、垂直或对角方向上接触。`, "warning");
  } else if (currentEvaluation.orphanTents.size > 0) {
    setCampMessage("这顶帐篷找不到云杉", "帐篷必须与至少一棵云杉上下左右相邻。", "warning");
  } else if (currentEvaluation.tentCount === currentEvaluation.treeCount && !currentEvaluation.matching.perfect) {
    setCampMessage("局部相邻，全局仍然拥堵", "每顶帐篷旁边有树还不够；当前无法让所有树与帐篷一一对应。", "warning");
  } else {
    const impossibleRows = currentEvaluation.rows.filter(({ impossible }) => impossible).length;
    const impossibleColumns = currentEvaluation.columns.filter(({ impossible }) => impossible).length;
    if (impossibleRows + impossibleColumns > 0) {
      setCampMessage("边缘数字正在告警", `${impossibleRows} 行、${impossibleColumns} 列已超额或被草地标记堵死。`, "warning");
    } else if (currentEvaluation.tentCount === 0) {
      setCampMessage("暮色刚刚落下", "选一块空地搭帐篷，行列数字会随之回应。");
    } else {
      const exactRows = currentEvaluation.rows.filter(({ exact }) => exact).length;
      const exactColumns = currentEvaluation.columns.filter(({ exact }) => exact).length;
      setCampMessage("云影正在换班", `已有 ${exactRows} 行、${exactColumns} 列数字精确满足；继续核对全局安排。`);
    }
  }
  updateToolButtons();
  updateDifficultyButtons();
  updateCampKeepsakes();
  if (document.activeElement === cellElements.get(focusKey)) highlightCandidateTrees(focusKey);
  else clearCandidateTrees();
  window.requestAnimationFrame(updateScrollHint);
}

function violationTokens(evaluation) {
  const tokens = new Set();
  for (const key of evaluation.touching) tokens.add(`touch:${key}`);
  for (const key of evaluation.orphanTents) tokens.add(`orphan:${key}`);
  evaluation.rows.forEach((clue, index) => {
    if (clue.impossible) tokens.add(`row:${index}`);
  });
  evaluation.columns.forEach((clue, index) => {
    if (clue.impossible) tokens.add(`column:${index}`);
  });
  if (evaluation.tentCount === evaluation.treeCount && !evaluation.matching.perfect) tokens.add("matching");
  return tokens;
}

function pushHistory() {
  state.history.push(snapshotFromState(state));
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
}

function reportRealmCompletion() {
  const difficulty = difficultyFor(state.difficulty) ?? DIFFICULTIES[0];
  const payload = {
    levelId: `${state.difficulty}:${state.level.id}`,
    tier: difficulty.tier,
    moves: state.moves,
    par: state.level.par,
  };
  if (typeof window.RealmArcade?.complete === "function") window.RealmArcade.complete(payload);
  else (window.__realmCompletionQueue ??= []).push(payload);
}

function settleCampCompletion() {
  const before = campSummary(state.stats);
  const local = recordCampCompletionOnce(state);
  state = local.state;
  const realm = confirmCampCompletion(state, reportRealmCompletion);
  state = realm.state;
  if (!local.recorded) return { newDecorations: [], newVisitors: [], realm };
  const after = campSummary(state.stats);
  const decorationIds = new Set(before.decorations.map(({ id }) => id));
  const visitorIds = new Set(before.visitors.map(({ id }) => id));
  return {
    newDecorations: after.decorations.filter(({ id }) => !decorationIds.has(id)),
    newVisitors: after.visitors.filter(({ id }) => !visitorIds.has(id)),
    realm,
  };
}

function fillVictory(newDecorations, newVisitors) {
  elements.victoryMoves.textContent = String(state.moves);
  elements.victoryPar.textContent = String(state.level.par);
  elements.victoryMistakes.textContent = String(state.mistakes);
  const summary = campSummary(state.stats);
  const visitors = newVisitors.length ? newVisitors : summary.visitors.slice(-3);
  elements.victoryVisitors.innerHTML = visitors.length
    ? visitors.map((visitor, index) => `<span style="--visitor-index:${index}" title="${visitor.name}">${visitor.symbol}</span>`).join("")
    : '<span style="--visitor-index:0" title="云上脚步">🐾</span>';
  const unlocks = [
    ...newDecorations.map(({ name }) => `新装饰「${name}」`),
    ...newVisitors.map(({ name }) => `新访客「${name}」`),
  ];
  if (state.mistakes === 0) unlocks.push("无误布营记录");
  if (state.moves <= state.level.par) unlocks.push("效率线达成");
  elements.unlockCopy.textContent = unlocks.length ? `本局收藏：${unlocks.join("·")}` : "营地记录已留在这台设备。";
}

function openVictory() {
  if (!state.completed || elements.victoryDialog.open) return;
  const blocker = [...document.querySelectorAll("dialog[open]")]
    .find((dialog) => dialog !== elements.victoryDialog);
  if (blocker) {
    if (victoryBlocker !== blocker) {
      victoryBlocker = blocker;
      blocker.addEventListener("close", () => {
        if (victoryBlocker === blocker) victoryBlocker = null;
        if (!state.completed || elements.victoryDialog.open) return;
        window.clearTimeout(victoryTimer);
        victoryTimer = window.setTimeout(openVictory, reduceMotion.matches ? 0 : 120);
      }, { once: true });
    }
    return;
  }
  victoryBlocker = null;
  victoryReturnFocus = cellElements.get(focusKey) ?? elements.newGameButton;
  elements.victoryDialog.showModal();
  elements.nextLevelButton.focus({ preventScroll: true });
}

function completeCamp() {
  if (state.completed) return;
  state.completed = true;
  const { newDecorations, newVisitors } = settleCampCompletion();
  render();
  fillVictory(newDecorations, newVisitors);
  writeSave();
  playSound("win");
  window.clearTimeout(victoryTimer);
  victoryTimer = window.setTimeout(openVictory, reduceMotion.matches ? 0 : 620);
}

function activateCell(key, moveType) {
  if (state.completed) {
    showToast("这块浮地已经安顿完毕。可撤销查看，或再寻一块浮地。", false, 3400);
    return;
  }
  const beforeEvaluation = evaluatePosition(state.level, state);
  const result = applyMove(state.level, state, { type: moveType, key });
  if (!result.accepted) {
    const message = result.reason === "not-playable" ? "云杉格不能落帐篷或草地标记。" : "这次操作没有改变营地。";
    showToast(message, true);
    playSound("warning");
    return;
  }
  pushHistory();
  state.tents = result.tents;
  state.grass = result.grass;
  state.moves += 1;
  const afterEvaluation = evaluatePosition(state.level, state);
  const beforeTokens = violationTokens(beforeEvaluation);
  const introducedWarning = [...violationTokens(afterEvaluation)].some((token) => !beforeTokens.has(token));
  if (introducedWarning) state.mistakes += 1;
  render();
  playSound(result.effect);
  if (introducedWarning) {
    const message = "这一步引入了新的规则冲突；局面保留，可继续调整或撤销。";
    showToast(message, true, 3300);
    playSound("warning");
  }
  writeSave();
  if (currentEvaluation.complete) completeCamp();
}

function clearReview() {
  window.clearTimeout(reviewTimer);
  for (const element of cellElements.values()) element.classList.remove("is-review-error");
  for (const element of [...rowClueElements, ...columnClueElements]) element.classList.remove("is-review-error");
}

function reviewCamp() {
  clearReview();
  const evaluation = evaluatePosition(state.level, state);
  if (evaluation.complete) {
    if (!state.completed) completeCamp();
    else openVictory();
    return;
  }
  for (const key of new Set([...evaluation.touching, ...evaluation.orphanTents])) {
    cellElements.get(key)?.classList.add("is-review-error");
  }
  evaluation.rows.forEach((clue, index) => {
    if (!clue.exact) rowClueElements[index].classList.add("is-review-error");
  });
  evaluation.columns.forEach((clue, index) => {
    if (!clue.exact) columnClueElements[index].classList.add("is-review-error");
  });
  if (evaluation.tentCount === evaluation.treeCount && !evaluation.matching.perfect) {
    for (const [key, element] of cellElements) {
      if (evaluation.tents.has(key) || isTree(state.level, key)) element.classList.add("is-review-error");
    }
  }
  const details = [];
  const unmetRows = evaluation.rows.filter(({ exact }) => !exact).length;
  const unmetColumns = evaluation.columns.filter(({ exact }) => !exact).length;
  if (unmetRows) details.push(`${unmetRows} 行未精确满足`);
  if (unmetColumns) details.push(`${unmetColumns} 列未精确满足`);
  if (evaluation.touching.size) details.push(`${evaluation.touching.size} 顶帐篷互相接触`);
  if (evaluation.orphanTents.size) details.push(`${evaluation.orphanTents.size} 顶帐篷无相邻树`);
  if (evaluation.tentCount === evaluation.treeCount && !evaluation.matching.perfect) details.push("全局不存在一一安排");
  const message = `巡营未通过：${details.join("，")}。局面没有被改变。`;
  showToast(message, true, 4300);
  playSound("warning");
  reviewTimer = window.setTimeout(clearReview, 3200);
}

function closeVictory({ restoreFocus = true } = {}) {
  window.clearTimeout(victoryTimer);
  if (elements.victoryDialog.open) elements.victoryDialog.close();
  if (restoreFocus && victoryReturnFocus?.isConnected) victoryReturnFocus.focus({ preventScroll: true });
  victoryReturnFocus = null;
}

function startLevel(level, message, { focusBoard = false } = {}) {
  closeVictory({ restoreFocus: false });
  clearReview();
  state.level = level;
  state.difficulty = level.difficulty;
  state.tents = new Set();
  state.grass = new Set();
  state.moves = 0;
  state.mistakes = 0;
  state.history = [];
  state.completed = false;
  state.completionRecorded = false;
  state.completionReported = false;
  buildBoard();
  render();
  writeSave();
  playSound("new");
  if (message) showToast(message);
  if (focusBoard) window.requestAnimationFrame(() => cellElements.get(focusKey)?.focus({ preventScroll: true }));
}

function nextLevelFor(difficulty) {
  const levels = levelsForDifficulty(difficulty);
  const index = levels.findIndex(({ id }) => id === state.level.id);
  return levels[index < 0 ? 0 : (index + 1) % levels.length];
}

function startNewGame(difficulty = state.difficulty, options = {}) {
  const next = nextLevelFor(difficulty);
  startLevel(next, `新浮地已接近：${next.title}`, options);
}

function restartGame(options = {}) {
  startLevel(state.level, "云层倒流：这块浮地已经重开。", options);
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    showToast("还没有可以撤销的布营步骤。");
    return;
  }
  closeVictory({ restoreFocus: false });
  clearReview();
  state.tents = new Set(previous.tents);
  state.grass = new Set(previous.grass);
  state.moves = previous.moves;
  state.mistakes = previous.mistakes;
  state.completed = false;
  render();
  writeSave();
  playSound("undo");
  showToast("已退回上一步。");
}

function moveFocus(rowStep, columnStep) {
  const start = pointFromKey(focusKey);
  if (!start) return;
  let row = start.row + rowStep;
  let column = start.column + columnStep;
  while (row >= 0 && column >= 0 && row < state.level.height && column < state.level.width) {
    const candidateKey = keyOf(row, column);
    const candidate = cellElements.get(candidateKey);
    if (candidate?.matches("button")) {
      focusKey = candidateKey;
      updateRovingTabIndex();
      candidate.focus({ preventScroll: true });
      candidate.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    row += rowStep;
    column += columnStep;
  }
}

function setTool(tool) {
  state.tool = tool === "grass" ? "grass" : "tent";
  updateToolButtons();
  writeSave({ quiet: true });
  showToast(state.tool === "tent" ? "帐篷工具：点击空地搭起或收起帐篷。" : "草地工具：点击空地添加或清除排除标记。", false, 1900);
}

function openRules() {
  if (document.querySelector("dialog[open]") || elements.rulesDialog.open) return;
  rulesReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : elements.rulesButton;
  elements.rulesDialog.showModal();
  elements.rulesCloseButton.focus({ preventScroll: true });
}

function closeRules() {
  if (elements.rulesDialog.open) elements.rulesDialog.close();
  if (rulesReturnFocus?.isConnected) rulesReturnFocus.focus({ preventScroll: true });
  rulesReturnFocus = null;
}

function updateMuteButton() {
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "声音已静音，点击开启" : "声音已开启，点击静音");
  elements.muteButton.querySelector("span:last-child").textContent = state.muted ? "静音" : "声音";
}

function toggleMute() {
  state.muted = !state.muted;
  updateMuteButton();
  if (!state.muted) {
    ensureAudio();
    tone(523, 0.11, { gain: 0.012 });
  }
  writeSave({ quiet: true });
  showToast(state.muted ? "浮地已经静音。" : "云风与篝火声已开启。");
}

function createDifficultyButtons() {
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty.id;
    button.textContent = difficulty.label;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${difficulty.label}营线，${difficulty.note}`);
    button.addEventListener("click", () => startNewGame(difficulty.id));
    elements.difficultyButtons.append(button);
  }
}

elements.board.addEventListener("click", (event) => {
  const cell = event.target.closest("button.board-cell");
  if (!cell) return;
  focusKey = cell.dataset.key;
  updateRovingTabIndex();
  activateCell(cell.dataset.key, state.tool === "grass" ? "toggle-grass" : "toggle-tent");
});

elements.board.addEventListener("contextmenu", (event) => {
  const cell = event.target.closest("button.board-cell");
  if (!cell) return;
  event.preventDefault();
  focusKey = cell.dataset.key;
  updateRovingTabIndex();
  activateCell(cell.dataset.key, "toggle-grass");
});

elements.board.addEventListener("pointerover", (event) => {
  const cell = event.target.closest("button.board-cell");
  if (cell) highlightCandidateTrees(cell.dataset.key);
});

elements.board.addEventListener("pointerleave", () => {
  if (!elements.board.contains(document.activeElement)) clearCandidateTrees();
});

elements.board.addEventListener("keydown", (event) => {
  const cell = event.target.closest("button.board-cell");
  if (!cell) return;
  const movement = {
    ArrowUp: [-1, 0], w: [-1, 0], W: [-1, 0],
    ArrowRight: [0, 1], d: [0, 1], D: [0, 1],
    ArrowDown: [1, 0], s: [1, 0], S: [1, 0],
    ArrowLeft: [0, -1], a: [0, -1], A: [0, -1],
  }[event.key];
  if (movement) {
    event.preventDefault();
    moveFocus(...movement);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activateCell(cell.dataset.key, "toggle-tent");
  } else if (event.key === "x" || event.key === "X") {
    event.preventDefault();
    activateCell(cell.dataset.key, "toggle-grass");
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    activateCell(cell.dataset.key, "set-unknown");
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    const playable = [...cellElements].filter(([, element]) => element.matches("button"));
    focusKey = (event.key === "Home" ? playable[0] : playable.at(-1))?.[0] ?? focusKey;
    updateRovingTabIndex();
    cellElements.get(focusKey)?.focus({ preventScroll: true });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
  const interactiveTarget = event.target.closest("button, a, input, select, textarea");
  if (interactiveTarget && !event.target.closest("button.board-cell")) return;
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "z") {
    event.preventDefault();
    undo();
  } else if (key === "z" || key === "u") {
    event.preventDefault();
    undo();
  } else if (key === "r") {
    event.preventDefault();
    restartGame({ focusBoard: true });
  } else if (key === "n") {
    event.preventDefault();
    startNewGame(state.difficulty, { focusBoard: true });
  } else if (key === "c") {
    event.preventDefault();
    reviewCamp();
  } else if (key === "m") {
    event.preventDefault();
    toggleMute();
  } else if (event.key === "?") {
    event.preventDefault();
    openRules();
  }
});

document.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
document.addEventListener("keydown", ensureAudio, { once: true, capture: true });
window.addEventListener("resize", updateScrollHint);
window.addEventListener("pagehide", () => writeSave({ quiet: true }));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") writeSave({ quiet: true });
});

elements.tentTool.addEventListener("click", () => setTool("tent"));
elements.grassTool.addEventListener("click", () => setTool("grass"));
elements.checkButton.addEventListener("click", reviewCamp);
elements.undoButton.addEventListener("click", undo);
elements.restartButton.addEventListener("click", () => restartGame());
elements.newGameButton.addEventListener("click", () => startNewGame());
elements.muteButton.addEventListener("click", toggleMute);
elements.rulesButton.addEventListener("click", openRules);
elements.footerRulesButton.addEventListener("click", openRules);
elements.skipLink.addEventListener("click", (event) => {
  event.preventDefault();
  const target = cellElements.get(focusKey);
  if (!target?.matches("button")) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center", inline: "nearest" });
});
elements.rulesCloseButton.addEventListener("click", closeRules);
elements.nextLevelButton.addEventListener("click", () => startNewGame(state.difficulty, { focusBoard: true }));
elements.stayButton.addEventListener("click", () => closeVictory());

elements.rulesDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeRules();
});
elements.rulesDialog.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeRules();
});
elements.rulesDialog.addEventListener("click", (event) => {
  if (event.target === elements.rulesDialog) closeRules();
});
elements.victoryDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeVictory();
});
elements.victoryDialog.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeVictory();
});
elements.victoryDialog.addEventListener("click", (event) => {
  if (event.target === elements.victoryDialog) closeVictory();
});

const dialogObserver = new MutationObserver(syncDialogScrollLock);
dialogObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["open"],
  childList: true,
  subtree: true,
});
syncDialogScrollLock();

createDifficultyButtons();
const restoreResult = readSave();
updateMuteButton();
buildBoard();
render();

if (state.completed && !state.completionReported) {
  settleCampCompletion();
  render();
  writeSave({ quiet: true });
}

if (restoreResult.restored) {
  setSavedMessage("已恢复上次浮地 · 自动存档开启");
  showToast(state.completed ? "已恢复篝火点亮后的营地；本次不会重复结算。" : "已恢复上次布营进度。");
} else if (restoreResult.invalid) {
  showToast("旧营地存档无法读取，已安全回到新浮地。", true, 3800);
  writeSave();
} else {
  setSavedMessage("自动存档已开启");
  writeSave({ quiet: true });
}
