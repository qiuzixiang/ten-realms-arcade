import {
  DIFFICULTIES,
  SIDE,
  SIDES,
  clueKey,
  evaluatePosition,
  keyOf,
  pointFromKey,
  positionToJSON,
} from "./logic.mjs";
import { LEVELS, levelsForDifficulty } from "./levels.mjs";
import {
  LANDMARKS,
  applySessionMove,
  cityProgress,
  confirmCompletionReport,
  createSession,
  mergeStats,
  recordCompletion,
  restartSession,
  restoreSave,
  serializeSave,
  undoSession,
} from "./session.mjs";

const STORAGE_KEY = "ten-realms-v2:games:neon-skyline:save:v1";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const HISTORY_SOUND_DELAY = 0.04;

const SIDE_LABEL = Object.freeze({
  [SIDE.TOP]: "北街",
  [SIDE.BOTTOM]: "南街",
  [SIDE.LEFT]: "西街",
  [SIDE.RIGHT]: "东街",
});

const elements = {
  assertiveStatus: document.querySelector("#assertive-status"),
  bestMoves: document.querySelector("#best-moves"),
  board: document.querySelector("#skyline-board"),
  boardMessage: document.querySelector("#board-message"),
  cellTotal: document.querySelector("#cell-total"),
  cityMap: document.querySelector("#city-map"),
  cityTotal: document.querySelector("#city-total"),
  clearButton: document.querySelector("#clear-button"),
  completedCount: document.querySelector("#completed-count"),
  conflictCount: document.querySelector("#conflict-count"),
  difficultyButtons: [...document.querySelectorAll("#difficulty-buttons [data-difficulty]")],
  difficultyNote: document.querySelector("#difficulty-note"),
  fillCandidatesButton: document.querySelector("#fill-candidates-button"),
  filledCount: document.querySelector("#filled-count"),
  flatViewButton: document.querySelector("#flat-view-button"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  landmarkCount: document.querySelector("#landmark-count"),
  landmarkList: document.querySelector("#landmark-list"),
  levelCode: document.querySelector("#level-code"),
  levelIndex: document.querySelector("#level-index"),
  levelKicker: document.querySelector("#level-kicker"),
  levelTitle: document.querySelector("#level-title"),
  levelTotal: document.querySelector("#level-total"),
  messageCopy: document.querySelector("#message-copy"),
  messageTitle: document.querySelector("#message-title"),
  meterRise: document.querySelector("#meter-rise"),
  moveCount: document.querySelector("#move-count"),
  muteButton: document.querySelector("#mute-button"),
  newGameButton: document.querySelector("#new-game-button"),
  nextLevelButton: document.querySelector("#next-level-button"),
  noteButton: document.querySelector("#note-button"),
  numberButtons: [...document.querySelectorAll("#number-pad [data-value]")],
  progressBar: document.querySelector("#progress-bar"),
  progressPercent: document.querySelector("#progress-percent"),
  puzzle: document.querySelector("#skyline-puzzle"),
  restartButton: document.querySelector("#restart-button"),
  rulesButton: document.querySelector("#rules-button"),
  rulesCloseButton: document.querySelector("#rules-close-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  saveState: document.querySelector("#save-state"),
  selectedCellLabel: document.querySelector("#selected-cell-label"),
  stayButton: document.querySelector("#stay-button"),
  toast: document.querySelector("#toast"),
  undoButton: document.querySelector("#undo-button"),
  victoryBest: document.querySelector("#victory-best"),
  victoryConflicts: document.querySelector("#victory-conflicts"),
  victoryCopy: document.querySelector("#victory-copy"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryUnlock: document.querySelector("#victory-unlock"),
};

const clueContainers = Object.freeze({
  [SIDE.TOP]: document.querySelector("#clues-top"),
  [SIDE.BOTTOM]: document.querySelector("#clues-bottom"),
  [SIDE.LEFT]: document.querySelector("#clues-left"),
  [SIDE.RIGHT]: document.querySelector("#clues-right"),
});

let level = LEVELS[0];
let session = createSession(level, { levels: LEVELS });
let evaluation = evaluatePosition(level, session);
let selectedKey = keyOf(0, 0);
let cellElements = new Map();
let clueElements = new Map();
let audioContext = null;
let toastTimer = 0;
let saveTimer = 0;
let victoryTimer = 0;
let victoryObserver = null;
let storageAvailable = true;
let newestTowerKey = null;
const dialogReturnFocus = new WeakMap();

function readStoredObject() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function initializeSave() {
  let candidate = null;
  let hadStoredValue = false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    hadStoredValue = Boolean(raw);
    candidate = raw ? JSON.parse(raw) : null;
  } catch {
    hadStoredValue = true;
  }
  const restored = restoreSave(LEVELS, candidate);
  if (restored) {
    level = restored.level;
    session = restored.session;
    return { restored: true };
  }
  if (hadStoredValue) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      storageAvailable = false;
    }
  }
  level = LEVELS[0];
  session = createSession(level, { levels: LEVELS });
  return { restored: false, invalid: hadStoredValue };
}

function setSaveState(text, saved = false) {
  window.clearTimeout(saveTimer);
  elements.saveState.classList.toggle("is-saved", saved);
  elements.saveState.classList.toggle("is-error", !storageAvailable);
  elements.saveState.lastChild.textContent = ` ${storageAvailable ? text : "本机留档不可用"}`;
  if (saved) {
    saveTimer = window.setTimeout(() => {
      elements.saveState.classList.remove("is-saved");
      elements.saveState.lastChild.textContent = " 本机自动留档";
    }, 1800);
  }
}

function writeSave(message = "规划已留档") {
  try {
    const external = restoreSave(LEVELS, readStoredObject());
    if (external) session.stats = mergeStats(session.stats, LEVELS, external.session.stats);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeSave(session)));
    storageAvailable = true;
    setSaveState(message, true);
  } catch {
    storageAvailable = false;
    setSaveState("本机留档不可用", false);
  }
}

function showToast(message, kind = "normal", duration = 2400) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.dataset.kind = kind;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}

function announce(message) {
  elements.assertiveStatus.textContent = "";
  window.requestAnimationFrame(() => {
    elements.assertiveStatus.textContent = message;
  });
}

function ensureAudio() {
  if (session.preferences.muted) return null;
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
  oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.018, start + Math.min(0.025, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSound(effect, value = 1) {
  if (session.preferences.muted) return;
  if (effect === "tower-built") {
    const base = 190 + value * 52;
    tone(base, 0.22, { type: "triangle", endFrequency: base * 1.28, gain: 0.023 });
    tone(base * 2, 0.11, { delay: 0.07, gain: 0.009 });
  } else if (effect === "tower-cleared") {
    tone(430, 0.18, { endFrequency: 180, type: "triangle", gain: 0.018 });
  } else if (["note-changed", "notes-filled", "clue-note"].includes(effect)) {
    tone(720, 0.07, { type: "sine", gain: 0.009 });
  } else if (effect === "undo") {
    tone(320, 0.16, { endFrequency: 510, type: "triangle", gain: 0.015 });
    tone(510, 0.09, { delay: HISTORY_SOUND_DELAY, gain: 0.007 });
  } else if (effect === "invalid") {
    tone(138, 0.13, { type: "square", gain: 0.009 });
    tone(112, 0.16, { delay: 0.07, type: "triangle", gain: 0.012 });
  } else if (effect === "win") {
    [262, 330, 392, 523, 659].forEach((frequency, index) => {
      tone(frequency, 0.75 - index * 0.04, { delay: index * 0.12, type: "triangle", gain: 0.018 });
      tone(frequency * 2, 0.36, { delay: index * 0.12 + 0.04, gain: 0.005 });
    });
  }
}

function noteValues(mask) {
  return Array.from({ length: level.size }, (_, index) => index + 1).filter((value) => mask & (1 << value));
}

function cellAriaLabel(row, column) {
  const index = row * level.size + column;
  const value = evaluation.values[index];
  const notes = noteValues(evaluation.notes[index]);
  const given = level.givens.some((item) => item.row === row && item.column === column);
  const parts = [`第 ${row + 1} 行第 ${column + 1} 列`];
  if (given) parts.push(`锁定的预填塔，高度 ${value}`);
  else if (value) parts.push(`建筑高度 ${value}`);
  else parts.push("空地块");
  if (notes.length) parts.push(`候选 ${notes.join("、")}`);
  if (evaluation.conflictCells.has(keyOf(row, column))) parts.push("当前高度冲突");
  if (keyOf(row, column) === selectedKey) parts.push("当前选择");
  return parts.join("，");
}

function createTower(value) {
  const shell = document.createElement("span");
  shell.className = "tower-shell";
  shell.style.setProperty("--tower-ratio", (value / level.size).toFixed(4));
  shell.setAttribute("aria-hidden", "true");
  const face = document.createElement("span");
  face.className = "tower-face";
  const windows = document.createElement("span");
  windows.className = "tower-windows";
  for (let index = 0; index < Math.max(2, value * 2); index += 1) windows.append(document.createElement("i"));
  face.append(windows);
  shell.append(face);
  return shell;
}

function createCandidates(mask) {
  const grid = document.createElement("span");
  grid.className = "candidate-grid";
  grid.setAttribute("aria-hidden", "true");
  for (let value = 1; value <= level.size; value += 1) {
    const mark = document.createElement("span");
    mark.textContent = mask & (1 << value) ? String(value) : "";
    grid.append(mark);
  }
  return grid;
}

function buildBoard() {
  elements.board.replaceChildren();
  cellElements = new Map();
  elements.puzzle.dataset.size = String(level.size);
  elements.puzzle.style.setProperty("--size", level.size);
  elements.board.style.setProperty("--size", level.size);
  elements.board.setAttribute("aria-rowcount", String(level.size));
  elements.board.setAttribute("aria-colcount", String(level.size));
  elements.board.setAttribute("aria-label", `${level.title}，${level.size} 乘 ${level.size} 建筑高度网格`);

  for (let row = 0; row < level.size; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "skyline-row";
    rowElement.setAttribute("role", "row");
    for (let column = 0; column < level.size; column += 1) {
      const key = keyOf(row, column);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "skyline-cell";
      button.dataset.key = key;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-rowindex", String(row + 1));
      button.setAttribute("aria-colindex", String(column + 1));
      button.tabIndex = key === selectedKey ? 0 : -1;
      button.addEventListener("click", () => selectCell(key, false));
      button.addEventListener("focus", () => selectCell(key, false));
      button.addEventListener("keydown", (event) => handleGridKey(event, key));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        selectCell(key, false);
        setNoteMode(true);
      });
      rowElement.append(button);
      cellElements.set(key, button);
    }
    elements.board.append(rowElement);
  }
  buildClues();
}

function buildClues() {
  clueElements = new Map();
  for (const side of SIDES) {
    const container = clueContainers[side];
    container.replaceChildren();
    container.style.setProperty("--size", level.size);
    for (let index = 0; index < level.size; index += 1) {
      const clue = level.clues[side][index];
      const element = document.createElement("span");
      element.className = "edge-clue";
      element.dataset.clue = clueKey(side, index);
      element.textContent = clue ?? "·";
      element.classList.toggle("is-missing", clue === null);
      element.setAttribute("aria-label", clue === null
        ? `${SIDE_LABEL[side]}第 ${index + 1} 处没有观察线索`
        : `${SIDE_LABEL[side]}第 ${index + 1} 处，目标可见 ${clue} 栋`);
      container.append(element);
      clueElements.set(clueKey(side, index), element);
    }
  }
}

function updateBoard() {
  for (let row = 0; row < level.size; row += 1) {
    for (let column = 0; column < level.size; column += 1) {
      const key = keyOf(row, column);
      const index = row * level.size + column;
      const button = cellElements.get(key);
      const value = evaluation.values[index];
      const given = level.givens.some((item) => item.row === row && item.column === column);
      button.replaceChildren();
      button.classList.toggle("is-selected", key === selectedKey);
      const selected = pointFromKey(selectedKey);
      button.classList.toggle("is-peer", Boolean(selected && key !== selectedKey && (selected.row === row || selected.column === column)));
      button.classList.toggle("is-given", given);
      button.classList.toggle("is-conflict", evaluation.conflictCells.has(key));
      button.classList.toggle("has-tower", value > 0);
      button.classList.toggle("is-new-tower", newestTowerKey === key && value > 0);
      button.tabIndex = key === selectedKey ? 0 : -1;
      button.setAttribute("aria-selected", String(key === selectedKey));
      if (value > 0) {
        button.append(createTower(value));
        const number = document.createElement("span");
        number.className = "tower-number";
        number.textContent = String(value);
        button.append(number);
      } else if (evaluation.notes[index]) {
        button.append(createCandidates(evaluation.notes[index]));
      }
      if (given) {
        const lock = document.createElement("span");
        lock.className = "given-lock";
        lock.textContent = "◆";
        lock.setAttribute("aria-hidden", "true");
        button.append(lock);
      }
      button.setAttribute("aria-label", cellAriaLabel(row, column));
    }
  }
  newestTowerKey = null;
}

function updateClues() {
  for (const [key, element] of clueElements) {
    const result = evaluation.clueStates.get(key);
    element.classList.toggle("is-exact", result.exact);
    element.classList.toggle("is-conflict", result.conflict);
    element.classList.toggle("is-done", result.done);
    if (!result.missing) {
      const state = result.conflict ? "当前冲突" : result.exact ? "已经满足" : result.done ? "手动标记为已读" : "仍待规划";
      element.setAttribute("aria-label", `${SIDE_LABEL[result.side]}第 ${result.index + 1} 处，目标可见 ${result.clue} 栋，${state}`);
    }
  }
}

function setMessage(title, copy, tone = "normal") {
  elements.messageTitle.textContent = title;
  elements.messageCopy.textContent = copy;
  elements.boardMessage.dataset.tone = tone;
}

function updateStatus() {
  if (session.completed) {
    setMessage("全城观察通过", "每行、每列与全部在线观察点同时吻合。", "success");
  } else if (evaluation.conflicts > 0) {
    setMessage("规划网出现冲突", `${evaluation.conflictCells.size} 个地块或 ${evaluation.clueConflicts} 处视线需要调整。`, "warning");
  } else if (evaluation.filled === level.givens.length) {
    setMessage("等待第一栋楼", "选择空地，再从下方高度台输入建筑高度。");
  } else {
    setMessage(
      "夜城正在成形",
      `还差 ${evaluation.empty} 栋；${evaluation.exactClues} / ${level.clueCount} 个在线观察点已确认。`,
    );
  }
}

function updateLevelDetails() {
  const difficulty = DIFFICULTIES.find((item) => item.id === level.difficulty);
  const levelNumber = LEVELS.findIndex((item) => item.id === level.id) + 1;
  elements.levelKicker.textContent = `${difficulty.label}级 · ${level.size} × ${level.size} · ${level.note}`;
  elements.levelTitle.textContent = level.title;
  elements.levelIndex.textContent = String(levelNumber).padStart(2, "0");
  elements.levelTotal.textContent = String(LEVELS.length).padStart(2, "0");
  elements.levelCode.textContent = `${level.difficulty.toUpperCase()}-${String(levelsForDifficulty(level.difficulty).indexOf(level) + 1).padStart(2, "0")}`;
  elements.difficultyNote.textContent = difficulty.note;
  for (const button of elements.difficultyButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === level.difficulty));
  }
}

function updateControls() {
  elements.noteButton.setAttribute("aria-pressed", String(session.preferences.noteMode));
  elements.noteButton.classList.toggle("is-active", session.preferences.noteMode);
  elements.muteButton.setAttribute("aria-pressed", String(session.preferences.muted));
  elements.muteButton.querySelector(".sound-glyph").textContent = session.preferences.muted ? "×" : "♪";
  elements.muteButton.querySelector(".action-label").textContent = session.preferences.muted ? "开声" : "声音";
  elements.flatViewButton.setAttribute("aria-pressed", String(session.preferences.flatView));
  document.body.classList.toggle("flat-view", session.preferences.flatView);
  elements.undoButton.disabled = session.history.length === 0;
  for (const button of elements.numberButtons) {
    const value = Number(button.dataset.value);
    button.hidden = value > level.size;
    button.disabled = value > level.size;
  }
  const point = pointFromKey(selectedKey);
  if (point) {
    const index = point.row * level.size + point.column;
    const value = evaluation.values[index];
    elements.selectedCellLabel.textContent = `第 ${point.row + 1} 行 · 第 ${point.column + 1} 列${value ? ` · 高度 ${value}` : " · 空地"}`;
  }
}

function updateProgress() {
  const percent = Math.round(evaluation.filled / (level.size * level.size) * 100);
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressBar.parentElement.setAttribute("aria-valuenow", String(percent));
  elements.meterRise.style.height = `${percent}%`;
  elements.filledCount.textContent = String(evaluation.filled);
  elements.cellTotal.textContent = ` / ${level.size * level.size}`;
  elements.conflictCount.textContent = String(evaluation.conflicts);
  elements.moveCount.textContent = String(session.moves);
  elements.bestMoves.textContent = session.stats.bestMovesByLevel[level.id] ?? "—";
}

function updateCityAtlas() {
  const progress = cityProgress(session.stats, LEVELS);
  elements.completedCount.textContent = String(progress.completed);
  elements.cityTotal.textContent = String(progress.total);
  [...elements.cityMap.children].forEach((item, index) => {
    const itemLevel = LEVELS[index];
    const complete = progress.completedIds.includes(itemLevel.id);
    item.classList.toggle("is-complete", complete);
    item.classList.toggle("is-current", itemLevel.id === level.id);
    item.querySelector("small").textContent = itemLevel.id === level.id ? "当前" : complete ? "已亮" : "未亮";
    item.title = `${itemLevel.title} · ${complete ? "已完成" : "未完成"}`;
  });
  let unlocked = 0;
  for (const landmark of progress.landmarks) {
    const item = elements.landmarkList.querySelector(`[data-landmark="${landmark.id}"]`);
    if (!item) continue;
    item.classList.toggle("is-unlocked", landmark.unlocked);
    item.querySelector("i").textContent = landmark.unlocked ? "◆" : "◇";
    if (landmark.unlocked) unlocked += 1;
  }
  elements.landmarkCount.textContent = `${unlocked} / ${LANDMARKS.length}`;
}

function render() {
  evaluation = evaluatePosition(level, session);
  session.completed = evaluation.complete;
  document.body.classList.toggle("is-complete", session.completed);
  updateBoard();
  updateClues();
  updateStatus();
  updateLevelDetails();
  updateControls();
  updateProgress();
  updateCityAtlas();
}

function selectCell(key, focus = true) {
  if (!cellElements.has(key)) return;
  const previous = cellElements.get(selectedKey);
  if (previous) previous.tabIndex = -1;
  selectedKey = key;
  const button = cellElements.get(key);
  button.tabIndex = 0;
  updateBoard();
  updateControls();
  if (focus) button.focus({ preventScroll: true });
}

function selectedPoint() {
  return pointFromKey(selectedKey);
}

function clearVictoryWait() {
  window.clearTimeout(victoryTimer);
  victoryTimer = 0;
  victoryObserver?.disconnect();
  victoryObserver = null;
}

function commit(move) {
  const beforeComplete = session.completed;
  const result = applySessionMove(level, session, move);
  if (!result.accepted) {
    playSound("invalid");
    if (result.reason === "given") showToast("这是一座锁定的基准塔。", "error");
    else if (result.reason === "occupied") showToast("先清除正式楼高，才能写候选。", "error");
    return false;
  }
  session = result.session;
  if (result.effect === "tower-built") newestTowerKey = selectedKey;
  render();
  writeSave();
  const point = selectedPoint();
  const placedValue = point ? evaluation.values[point.row * level.size + point.column] : 1;
  playSound(result.effect, placedValue || 1);
  if (!beforeComplete && session.completed && !session.completionReported) finishCity();
  return true;
}

function setHeight(value) {
  const point = selectedPoint();
  if (!point) return;
  if (session.preferences.noteMode) commit({ type: "toggle-note", ...point, value });
  else commit({ type: "set-value", ...point, value });
}

function clearSelected() {
  const point = selectedPoint();
  if (point) commit({ type: "set-value", ...point, value: 0 });
}

function setNoteMode(value = !session.preferences.noteMode) {
  session.preferences = { ...session.preferences, noteMode: Boolean(value) };
  updateControls();
  writeSave(value ? "候选模式已开启" : "建楼模式已开启");
  announce(value ? "候选笔记模式已开启" : "正式建楼模式已开启");
}

function toggleClueForDirection(key, direction) {
  const point = pointFromKey(key);
  const mapping = {
    up: { side: SIDE.TOP, index: point.column },
    down: { side: SIDE.BOTTOM, index: point.column },
    left: { side: SIDE.LEFT, index: point.row },
    right: { side: SIDE.RIGHT, index: point.row },
  };
  const entry = mapping[direction];
  const result = commit({ type: "toggle-clue", ...entry });
  if (result) announce(`已切换${SIDE_LABEL[entry.side]}第 ${entry.index + 1} 处观察线索的已读标记`);
}

function moveSelection(key, rowStep, columnStep) {
  const point = pointFromKey(key);
  const row = Math.max(0, Math.min(level.size - 1, point.row + rowStep));
  const column = Math.max(0, Math.min(level.size - 1, point.column + columnStep));
  selectCell(keyOf(row, column));
}

function handleGridKey(event, key) {
  if (document.querySelector("dialog[open]")) return;
  const lower = event.key.toLowerCase();
  const directions = {
    arrowup: [-1, 0, "up"], w: [-1, 0, "up"],
    arrowright: [0, 1, "right"], d: [0, 1, "right"],
    arrowdown: [1, 0, "down"], s: [1, 0, "down"],
    arrowleft: [0, -1, "left"], a: [0, -1, "left"],
  };
  if (directions[lower]) {
    event.preventDefault();
    const [rowStep, columnStep, direction] = directions[lower];
    if (event.ctrlKey || event.shiftKey || event.metaKey) toggleClueForDirection(key, direction);
    else moveSelection(key, rowStep, columnStep);
    return;
  }
  if (/^[1-6]$/.test(event.key) && Number(event.key) <= level.size) {
    event.preventDefault();
    setHeight(Number(event.key));
  } else if (event.key === "Enter") {
    event.preventDefault();
    setNoteMode();
  } else if (event.key === "Backspace" || event.key === "Delete" || event.key === " ") {
    event.preventDefault();
    clearSelected();
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    selectCell(event.key === "Home" ? keyOf(0, 0) : keyOf(level.size - 1, level.size - 1));
  }
}

function undo() {
  const result = undoSession(level, session);
  if (!result.accepted) return;
  clearVictoryWait();
  closeDialog(elements.victoryDialog, false);
  session = result.session;
  render();
  writeSave("已撤销一步");
  playSound("undo");
  announce(`已撤销，当前 ${session.moves} 步`);
}

function loadLevel(nextLevel, message = "新街区已接入") {
  clearVictoryWait();
  closeDialog(elements.victoryDialog, false);
  const preferences = { ...session.preferences };
  const stats = session.stats;
  level = nextLevel;
  session = createSession(level, { preferences, stats, levels: LEVELS });
  selectedKey = keyOf(0, 0);
  newestTowerKey = null;
  buildBoard();
  render();
  writeSave();
  showToast(`${message}：${level.title}`);
  announce(`${level.title}，${level.size} 乘 ${level.size} 街区，${level.clueCount} 个在线观察点`);
}

function nextLevel({ focusBoard = false } = {}) {
  const candidates = levelsForDifficulty(level.difficulty);
  const index = candidates.findIndex((item) => item.id === level.id);
  loadLevel(candidates[(index + 1) % candidates.length], "已切换规划图");
  if (focusBoard) cellElements.get(selectedKey)?.focus({ preventScroll: true });
}

function changeDifficulty(difficulty) {
  if (difficulty === level.difficulty) return;
  const candidates = levelsForDifficulty(difficulty);
  const next = candidates.find((item) => !session.stats.completedByLevel[item.id]) ?? candidates[0];
  if (next) loadLevel(next, `已进入${DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? "新"}尺度`);
}

function restart() {
  clearVictoryWait();
  closeDialog(elements.victoryDialog, false);
  session = restartSession(level, session);
  render();
  writeSave("当前街区已重开");
  showToast("街区蓝图已恢复到初始状态。");
  announce(`${level.title}已重新开始`);
}

function currentUnlockedIds() {
  return cityProgress(session.stats, LEVELS).landmarks.filter((item) => item.unlocked).map((item) => item.id);
}

function queueRealmReward() {
  const difficulty = DIFFICULTIES.find((item) => item.id === level.difficulty);
  const reward = {
    levelId: level.id,
    tier: difficulty?.tier ?? 1,
    moves: session.moves,
    par: level.par,
  };
  if (window.RealmArcade?.complete) window.RealmArcade.complete(reward);
  else (window.__realmCompletionQueue ??= []).push(reward);
}

function openVictoryWhenAvailable() {
  const blocker = [...document.querySelectorAll("dialog[open]")].find((dialog) => dialog !== elements.victoryDialog);
  if (!blocker) {
    openDialog(elements.victoryDialog);
    return;
  }
  victoryObserver?.disconnect();
  victoryObserver = new MutationObserver(() => {
    if ([...document.querySelectorAll("dialog[open]")].some((dialog) => dialog !== elements.victoryDialog)) return;
    victoryObserver.disconnect();
    victoryObserver = null;
    openDialog(elements.victoryDialog);
  });
  victoryObserver.observe(document.body, { attributes: true, attributeFilter: ["open"], subtree: true });
}

function finishCity() {
  const before = new Set(currentUnlockedIds());
  session = recordCompletion(level, session);
  const after = currentUnlockedIds();
  const newLandmarks = after.filter((id) => !before.has(id));
  const realm = confirmCompletionReport(session, queueRealmReward);
  session = realm.session;
  writeSave("通关记录已留档");
  render();
  playSound("win");
  elements.victoryMoves.textContent = String(session.moves);
  elements.victoryConflicts.textContent = session.hadConflict ? "曾有" : "0";
  elements.victoryBest.textContent = String(session.stats.bestMovesByLevel[level.id] ?? session.moves);
  elements.victoryCopy.textContent = session.hadConflict
    ? "四条街的观察记录已经吻合；下一次试试零冲突规划。"
    : "四条街的观察记录全部吻合，零冲突交通流正在楼群之间启动。";
  elements.victoryUnlock.hidden = newLandmarks.length === 0;
  if (newLandmarks.length) {
    const names = LANDMARKS.filter((item) => newLandmarks.includes(item.id)).map((item) => item.name);
    elements.victoryUnlock.querySelector("strong").textContent = `新地标已接入：${names.join("、")}`;
  }
  announce(`城市规划完成：${level.title}，${session.moves} 步${session.hadConflict ? "" : "，零冲突"}`);
  victoryTimer = window.setTimeout(openVictoryWhenAvailable, reduceMotion.matches ? 50 : 950);
}

function openDialog(dialog) {
  if (dialog.open || [...document.querySelectorAll("dialog[open]")].some((item) => item !== dialog)) return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) dialogReturnFocus.set(dialog, active);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  dialog.querySelector("button")?.focus({ preventScroll: true });
}

function closeDialog(dialog, restoreFocus = true) {
  if (!dialog.open) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (!restoreFocus) return;
  const target = dialogReturnFocus.get(dialog);
  dialogReturnFocus.delete(dialog);
  if (target?.isConnected && typeof target.focus === "function") target.focus({ preventScroll: true });
  else cellElements.get(selectedKey)?.focus({ preventScroll: true });
}

function toggleMute() {
  session.preferences = { ...session.preferences, muted: !session.preferences.muted };
  if (!session.preferences.muted) {
    ensureAudio();
    tone(540, 0.1, { gain: 0.012 });
  }
  updateControls();
  writeSave(session.preferences.muted ? "声音已关闭" : "声音已开启");
  announce(session.preferences.muted ? "声音已关闭" : "声音已开启");
}

function toggleFlatView() {
  session.preferences = { ...session.preferences, flatView: !session.preferences.flatView };
  updateControls();
  writeSave(session.preferences.flatView ? "俯视清晰模式已开启" : "楼体模式已开启");
  announce(session.preferences.flatView ? "已切换到俯视清晰模式" : "已切换到霓虹楼体模式");
}

function handleGlobalKey(event) {
  if (document.querySelector("dialog[open]")) return;
  if (event.defaultPrevented) return;
  const lower = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && lower === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if (/^[1-6]$/.test(event.key) && Number(event.key) <= level.size) {
    event.preventDefault();
    setHeight(Number(event.key));
  } else if (lower === "p") setNoteMode();
  else if (lower === "f") commit({ type: "fill-notes" });
  else if (lower === "z") undo();
  else if (lower === "r") restart();
  else if (lower === "n") nextLevel({ focusBoard: true });
  else if (lower === "m") toggleMute();
  else if (lower === "v") toggleFlatView();
  else if (event.key === "?" || (event.key === "/" && event.shiftKey)) openDialog(elements.rulesDialog);
  else if (event.key === "Delete" || event.key === "Backspace") clearSelected();
  else if (["arrowup", "arrowright", "arrowdown", "arrowleft", "w", "a", "s", "d"].includes(lower)) {
    handleGridKey(event, selectedKey);
  }
}

function bindEvents() {
  elements.newGameButton.addEventListener("click", () => nextLevel());
  elements.undoButton.addEventListener("click", undo);
  elements.restartButton.addEventListener("click", restart);
  elements.muteButton.addEventListener("click", toggleMute);
  elements.flatViewButton.addEventListener("click", toggleFlatView);
  elements.rulesButton.addEventListener("click", () => openDialog(elements.rulesDialog));
  elements.footerRulesButton.addEventListener("click", () => openDialog(elements.rulesDialog));
  elements.rulesCloseButton.addEventListener("click", () => closeDialog(elements.rulesDialog));
  elements.noteButton.addEventListener("click", () => setNoteMode());
  elements.clearButton.addEventListener("click", clearSelected);
  elements.fillCandidatesButton.addEventListener("click", () => commit({ type: "fill-notes" }));
  elements.nextLevelButton.addEventListener("click", () => {
    closeDialog(elements.victoryDialog, false);
    nextLevel({ focusBoard: true });
  });
  elements.stayButton.addEventListener("click", () => closeDialog(elements.victoryDialog));
  for (const button of elements.numberButtons) {
    button.addEventListener("click", () => setHeight(Number(button.dataset.value)));
  }
  for (const button of elements.difficultyButtons) {
    button.addEventListener("click", () => changeDifficulty(button.dataset.difficulty));
  }
  for (const dialog of [elements.rulesDialog, elements.victoryDialog]) {
    dialog.addEventListener("cancel", (event) => {
      if (dialog === elements.victoryDialog) event.preventDefault();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && dialog === elements.rulesDialog) closeDialog(dialog);
    });
  }
  document.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
  document.addEventListener("keydown", (event) => {
    if (!audioContext) ensureAudio();
    handleGlobalKey(event);
  });
  elements.board.addEventListener("focus", (event) => {
    if (event.target === elements.board) cellElements.get(selectedKey)?.focus({ preventScroll: true });
  });
  window.addEventListener("pagehide", () => writeSave("规划已留档"));
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const incoming = restoreSave(LEVELS, JSON.parse(event.newValue));
      if (!incoming) return;
      session.stats = mergeStats(session.stats, LEVELS, incoming.session.stats);
      updateCityAtlas();
      updateProgress();
    } catch {
      // A corrupt write from another tab is ignored without disturbing this game.
    }
  });
}

function initialize() {
  const restore = initializeSave();
  evaluation = evaluatePosition(level, session);
  selectedKey = keyOf(0, 0);
  buildBoard();
  bindEvents();
  render();
  if (restore.restored) setSaveState("已恢复上次规划", true);
  else if (restore.invalid) {
    showToast("旧城市蓝图损坏，已安全回到首个街区。", "error", 3600);
    writeSave("已建立安全蓝图");
  } else writeSave();
  if (session.completed && !session.completionReported) finishCity();

  window.neonSkyline = Object.freeze({
    getState: () => ({
      levelId: level.id,
      difficulty: level.difficulty,
      size: level.size,
      ...positionToJSON(session),
      moves: session.moves,
      completed: session.completed,
      completionReported: session.completionReported,
      conflicts: evaluation.conflicts,
      selectedKey,
    }),
    chooseLevel: (id) => {
      const chosen = LEVELS.find((item) => item.id === id);
      if (chosen) loadLevel(chosen, "审核切题");
      return Boolean(chosen);
    },
    getSelectedCell: () => cellElements.get(selectedKey) ?? null,
  });
}

initialize();
