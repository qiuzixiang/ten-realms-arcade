import {
  CELL,
  DIFFICULTIES,
  HISTORY_LIMIT,
  LEVELS,
  applyCellState,
  applyStroke,
  createCollection,
  createSession,
  currentDailyStreak,
  cycleCell,
  dailyLevelFor,
  evaluateGrid,
  findLevel,
  levelsForDifficulty,
  localDayKey,
  mergeCollections,
  normalizeCollection,
  normalizeSession,
  recordCollectionCompletion,
} from "./logic.mjs";
import {
  confirmPhotoCompletion,
  recordPhotoCompletionOnce,
  restorePhotoCompletionFlags,
} from "./session.mjs";

const SESSION_KEY = "ten-realms-v2:games:mist-photo-studio:session:v1";
const COLLECTION_KEY = "ten-realms-v2:games:mist-photo-studio:collection:v1";
const COMPLETION_TIERS = Object.freeze({ contact: 1, street: 2, archive: 3 });
const TOOL_STATE = Object.freeze({
  fill: CELL.FILLED,
  exclude: CELL.EXCLUDED,
  erase: CELL.UNKNOWN,
});
const STATE_NAMES = Object.freeze({
  [CELL.UNKNOWN]: "unknown",
  [CELL.FILLED]: "filled",
  [CELL.EXCLUDED]: "excluded",
});
const STATE_LABELS = Object.freeze({
  [CELL.UNKNOWN]: "未知",
  [CELL.FILLED]: "已填黑",
  [CELL.EXCLUDED]: "已排除",
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const COMPACT_BOARD_BREAKPOINT = 760;
const elements = Object.fromEntries([
  "activeMeta", "activeCaption", "negativeNumber", "difficultyButtons", "dailyButton", "dailyLabel",
  "decidedCount", "cellTotal", "progressBar", "lineStatus", "boardFrame", "boardViewport", "board",
  "toolFill", "toolExclude", "toolErase", "inspectButton", "undoButton", "restartButton", "newButton",
  "muteButton", "rulesButton", "footerRulesButton", "tutorialButton", "albumCount", "firstCount",
  "flawlessCount", "referenceCount", "dailyStreak", "contactSheet", "dailyCardCopy", "liveRegion", "toast",
  "rulesDialog", "rulesCloseButton", "victoryDialog", "victoryCloseButton", "victoryPhoto", "victoryCaption",
  "victoryMoves", "victoryPar", "victoryQuality", "victoryUnlocks", "victoryNextButton", "victoryStayButton",
].map((id) => [id, document.getElementById(id)]));
elements.activeTitle = document.getElementById("active-title");
elements.dailyCardTitle = document.getElementById("daily-card-title");

let level = LEVELS[0];
let collection = createCollection();
let state = createSession(level);
let evaluation = evaluateGrid(level, state.grid);
let focusedIndex = 0;
let cellElements = [];
let rowClueElements = [];
let columnClueElements = [];
let audioContext = null;
let toastTimer = 0;
let inspectTimer = 0;
let victoryTimer = 0;
let victoryObserver = null;
let lastDialogFocus = null;
let gesture = null;
let suppressClickUntil = 0;

function storageRead(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageWrite(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // A blocked storage area is equivalent to an unavailable local save.
  }
}

function parseStored(key) {
  const raw = storageRead(key);
  if (raw === null) return { value: null, invalid: false };
  try {
    return { value: JSON.parse(raw), invalid: false };
  } catch {
    storageRemove(key);
    return { value: null, invalid: true };
  }
}

function loadLocalState() {
  const sessionStored = parseStored(SESSION_KEY);
  const normalized = normalizeSession(sessionStored.value);
  if (sessionStored.invalid || (normalized.invalid && !normalized.restored)) storageRemove(SESSION_KEY);

  const collectionStored = parseStored(COLLECTION_KEY);
  collection = normalizeCollection(collectionStored.value);
  if (collectionStored.invalid) storageRemove(COLLECTION_KEY);

  state = restorePhotoCompletionFlags(normalized.session, sessionStored.value);
  level = findLevel(state.levelId) ?? LEVELS[0];
  if (state.daily && state.dailyDay !== localDayKey()) {
    state.daily = false;
    state.dailyDay = "";
  }
  return {
    restored: normalized.restored,
    repaired: normalized.invalid || sessionStored.invalid || collectionStored.invalid,
  };
}

function sessionForStorage() {
  return {
    version: state.version,
    levelId: level.id,
    grid: [...state.grid],
    moves: state.moves,
    mistakes: state.mistakes,
    history: state.history.map((item) => ({
      grid: [...item.grid],
      moves: item.moves,
      mistakes: item.mistakes,
      completed: item.completed === true,
      completionReported: item.completionReported === true,
    })),
    completed: state.completed,
    completionRecorded: state.completionRecorded === true,
    completionReported: state.completionReported,
    tool: state.tool,
    muted: state.muted,
    daily: state.daily,
    dailyDay: state.dailyDay,
  };
}

function saveLocalState() {
  const storedCollection = parseStored(COLLECTION_KEY);
  collection = mergeCollections(collection, storedCollection.value);
  storageWrite(SESSION_KEY, JSON.stringify(sessionForStorage()));
  storageWrite(COLLECTION_KEY, JSON.stringify(collection));
}

function snapshot() {
  return {
    grid: [...state.grid],
    moves: state.moves,
    mistakes: state.mistakes,
    completed: state.completed,
    completionRecorded: state.completionRecorded === true,
    completionReported: state.completionReported,
  };
}

function pushHistory(item = snapshot()) {
  state.history.push(item);
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
}

function ensureAudio() {
  if (state.muted || audioContext) return audioContext;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function tone(frequency, duration, { type = "sine", gain = .035, delay = 0, endFrequency = null } = {}) {
  const context = ensureAudio();
  if (!context || state.muted) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  volume.gain.setValueAtTime(.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + Math.min(.025, duration / 3));
  volume.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(volume).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .03);
}

function paperNoise(duration = .08, gain = .017) {
  const context = ensureAudio();
  if (!context || state.muted) return;
  const frames = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) channel[index] = (Math.random() * 2 - 1) * (1 - index / frames);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const volume = context.createGain();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = .7;
  volume.gain.value = gain;
  source.buffer = buffer;
  source.connect(filter).connect(volume).connect(context.destination);
  source.start();
}

function playSound(name) {
  if (state.muted) return;
  if (name === "fill") {
    tone(112, .11, { type: "sine", gain: .045, endFrequency: 72 });
    paperNoise(.07, .013);
  } else if (name === "exclude") {
    tone(520, .055, { type: "triangle", gain: .025, endFrequency: 410 });
    paperNoise(.045, .009);
  } else if (name === "erase") {
    tone(190, .07, { type: "sine", gain: .018, endFrequency: 230 });
    paperNoise(.1, .018);
  } else if (name === "undo") {
    tone(250, .09, { type: "triangle", gain: .023, endFrequency: 150 });
  } else if (name === "inspect") {
    tone(310, .07, { type: "sine", gain: .025 });
    tone(465, .1, { type: "sine", gain: .02, delay: .06 });
  } else if (name === "warning") {
    tone(155, .12, { type: "sawtooth", gain: .018, endFrequency: 126 });
  } else if (name === "win") {
    [196, 247, 294, 392].forEach((frequency, index) => {
      tone(frequency, .52, { type: index % 2 ? "triangle" : "sine", gain: .032, delay: index * .09 });
    });
    paperNoise(.34, .011);
  }
}

function announce(message) {
  elements.liveRegion.textContent = "";
  window.requestAnimationFrame(() => {
    elements.liveRegion.textContent = message;
  });
}

function showToast(message, warning = false, duration = 2600) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-warning", warning);
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}

function clueText(clues) {
  return clues.length ? clues.join("、") : "无黑格";
}

function cellAriaLabel(index) {
  const row = Math.floor(index / level.width);
  const column = index % level.width;
  return `第 ${row + 1} 行第 ${column + 1} 列，${STATE_LABELS[state.grid[index]]}；行提示 ${clueText(level.rowClues[row])}；列提示 ${clueText(level.columnClues[column])}`;
}

function createClueNumbers(clues) {
  const fragment = document.createDocumentFragment();
  if (clues.length === 0) {
    const empty = document.createElement("span");
    empty.textContent = "–";
    empty.setAttribute("aria-hidden", "true");
    fragment.append(empty);
    return fragment;
  }
  for (const clue of clues) {
    const number = document.createElement("span");
    number.textContent = String(clue);
    fragment.append(number);
  }
  return fragment;
}

function syncBoardScale() {
  if (!elements.boardViewport || !elements.board) return;
  const maxRowDepth = Math.max(1, ...level.rowClues.map((clues) => clues.length));
  const maxColumnDepth = Math.max(1, ...level.columnClues.map((clues) => clues.length));

  if (window.innerWidth > COMPACT_BOARD_BREAKPOINT) {
    elements.board.style.removeProperty("--cell-size");
    elements.board.style.setProperty("--row-clue-width", `${Math.max(84, maxRowDepth * 20 + 18)}px`);
    elements.board.style.setProperty("--column-clue-height", `${Math.max(74, maxColumnDepth * 18 + 20)}px`);
    return;
  }

  const availableWidth = elements.boardViewport.clientWidth;
  const rowClueWidth = Math.max(38, maxRowDepth * 14 + 8);
  const columnClueHeight = Math.max(42, maxColumnDepth * 12 + 8);
  const cellSize = Math.min(44, Math.max(14, Math.floor((availableWidth - rowClueWidth) / level.width)));
  elements.board.style.setProperty("--cell-size", `${cellSize}px`);
  elements.board.style.setProperty("--row-clue-width", `${rowClueWidth}px`);
  elements.board.style.setProperty("--column-clue-height", `${columnClueHeight}px`);
  elements.boardViewport.scrollLeft = 0;
}

function buildBoard({ restoreFocus = false } = {}) {
  const previousFocus = restoreFocus ? focusedIndex : 0;
  elements.board.replaceChildren();
  cellElements = [];
  rowClueElements = [];
  columnClueElements = [];
  focusedIndex = Math.max(0, Math.min(level.width * level.height - 1, previousFocus));

  const maxRowDepth = Math.max(1, ...level.rowClues.map((clues) => clues.length));
  const maxColumnDepth = Math.max(1, ...level.columnClues.map((clues) => clues.length));
  elements.board.style.setProperty("--columns", level.width);
  elements.board.style.setProperty("--rows", level.height);
  elements.board.style.setProperty("--row-clue-width", `${Math.max(84, maxRowDepth * 20 + 18)}px`);
  elements.board.style.setProperty("--column-clue-height", `${Math.max(74, maxColumnDepth * 18 + 20)}px`);
  elements.board.setAttribute("aria-rowcount", String(level.height + 1));
  elements.board.setAttribute("aria-colcount", String(level.width + 1));
  elements.board.setAttribute("aria-describedby", "boardInstructions");

  const fragment = document.createDocumentFragment();
  const gridRows = Array.from({ length: level.height + 1 }, (_, row) => {
    const gridRow = document.createElement("div");
    gridRow.className = "grid-row";
    gridRow.setAttribute("role", "row");
    gridRow.setAttribute("aria-rowindex", String(row + 1));
    fragment.append(gridRow);
    return gridRow;
  });
  const corner = document.createElement("div");
  corner.className = "clue-corner";
  corner.innerHTML = `<div><span>ROWS × COLS</span><b>${level.height} × ${level.width}</b></div>`;
  corner.setAttribute("aria-hidden", "true");
  gridRows[0].append(corner);

  for (let column = 0; column < level.width; column += 1) {
    const clue = document.createElement("div");
    clue.className = "column-clue";
    clue.id = `column-clue-${column}`;
    clue.style.gridColumn = String(column + 2);
    clue.style.gridRow = "1";
    clue.setAttribute("role", "columnheader");
    clue.setAttribute("aria-colindex", String(column + 2));
    clue.setAttribute("aria-label", `第 ${column + 1} 列提示：${clueText(level.columnClues[column])}`);
    clue.append(createClueNumbers(level.columnClues[column]));
    columnClueElements.push(clue);
    gridRows[0].append(clue);
  }

  for (let row = 0; row < level.height; row += 1) {
    const clue = document.createElement("div");
    clue.className = "row-clue";
    clue.id = `row-clue-${row}`;
    clue.style.gridColumn = "1";
    clue.style.gridRow = String(row + 2);
    clue.setAttribute("role", "rowheader");
    clue.setAttribute("aria-colindex", "1");
    clue.setAttribute("aria-label", `第 ${row + 1} 行提示：${clueText(level.rowClues[row])}`);
    clue.append(createClueNumbers(level.rowClues[row]));
    rowClueElements.push(clue);
    gridRows[row + 1].append(clue);
  }

  for (let index = 0; index < level.width * level.height; index += 1) {
    const row = Math.floor(index / level.width);
    const column = index % level.width;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "grid-cell";
    cell.dataset.index = String(index);
    cell.dataset.row = String(row);
    cell.dataset.column = String(column);
    cell.style.gridColumn = String(column + 2);
    cell.style.gridRow = String(row + 2);
    cell.style.setProperty("--row", row);
    cell.style.setProperty("--column", column);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-rowindex", String(row + 2));
    cell.setAttribute("aria-colindex", String(column + 2));
    cell.setAttribute("aria-describedby", `row-clue-${row} column-clue-${column}`);
    cellElements.push(cell);
    gridRows[row + 1].append(cell);
  }
  elements.board.append(fragment);
  syncBoardScale();
  render();
  requestAnimationFrame(syncBoardScale);
}

function updateRovingFocus() {
  for (let index = 0; index < cellElements.length; index += 1) {
    const isFocused = index === focusedIndex;
    cellElements[index].tabIndex = isFocused ? 0 : -1;
    if (isFocused) cellElements[index].setAttribute("data-realm-game-focus", "");
    else cellElements[index].removeAttribute("data-realm-game-focus");
  }
}

function renderCells(changedIndices = []) {
  const changed = new Set(changedIndices);
  for (let index = 0; index < cellElements.length; index += 1) {
    const cell = cellElements[index];
    cell.dataset.state = STATE_NAMES[state.grid[index]];
    cell.setAttribute("aria-label", cellAriaLabel(index));
    cell.classList.toggle("just-changed", changed.has(index));
    if (changed.has(index)) {
      window.setTimeout(() => cell.classList.remove("just-changed"), 420);
    }
  }
  updateRovingFocus();
}

function renderClues() {
  for (let row = 0; row < rowClueElements.length; row += 1) {
    const analysis = evaluation.rows[row];
    rowClueElements[row].classList.toggle("is-satisfied", analysis.matches);
    rowClueElements[row].classList.toggle("is-contradiction", !analysis.possible);
    rowClueElements[row].setAttribute("aria-label", `第 ${row + 1} 行提示：${clueText(level.rowClues[row])}；${!analysis.possible ? "当前无可行排列" : analysis.matches ? "已吻合" : "尚未吻合"}`);
  }
  for (let column = 0; column < columnClueElements.length; column += 1) {
    const analysis = evaluation.columns[column];
    columnClueElements[column].classList.toggle("is-satisfied", analysis.matches);
    columnClueElements[column].classList.toggle("is-contradiction", !analysis.possible);
    columnClueElements[column].setAttribute("aria-label", `第 ${column + 1} 列提示：${clueText(level.columnClues[column])}；${!analysis.possible ? "当前无可行排列" : analysis.matches ? "已吻合" : "尚未吻合"}`);
  }
}

function renderAlbum() {
  const completed = Object.keys(collection.completed).length;
  elements.albumCount.textContent = String(completed);
  elements.firstCount.textContent = String(completed);
  elements.flawlessCount.textContent = String(Object.keys(collection.flawless).length);
  elements.referenceCount.textContent = String(Object.keys(collection.reference).length);
  elements.dailyStreak.textContent = String(currentDailyStreak(collection));
  const today = localDayKey();
  const dailyDone = collection.dailyDays.includes(today);
  elements.dailyLabel.textContent = dailyDone ? "今日已盖章" : state.daily ? "正在冲洗" : "等待领取";
  elements.dailyCardTitle.textContent = dailyDone ? "今日底片已入册" : state.daily ? "今日底片正在显影" : "每日底片尚未完成";
  elements.dailyCardCopy.textContent = dailyDone
    ? `暗房已为 ${today} 盖章；明天会换一张固定可复现的底片。`
    : "每天的底片固定可复现；当天只盖一次章，也不会重复增加全局奖励。";
  elements.dailyButton.classList.toggle("is-active", state.daily);

  for (const card of elements.contactSheet.querySelectorAll(".contact-card")) {
    const unlocked = collection.completed[card.dataset.levelId] === true;
    card.classList.toggle("is-unlocked", unlocked);
    card.classList.toggle("is-active", card.dataset.levelId === level.id);
    card.querySelector(".lock-mark")?.toggleAttribute("hidden", unlocked);
    card.setAttribute("aria-label", unlocked
      ? `${findLevel(card.dataset.levelId).title}，已收入图鉴`
      : "尚未显影的馆藏底片");
  }
}

function renderControls() {
  for (const button of [elements.toolFill, elements.toolExclude, elements.toolErase]) {
    const active = button.dataset.tool === state.tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === level.difficulty && !state.daily));
  }
  elements.undoButton.disabled = state.history.length === 0;
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.querySelector("span:last-child").textContent = state.muted ? "静音" : "声音";
}

function render(changedIndices = []) {
  evaluation = evaluateGrid(level, state.grid);
  const percent = Math.round(evaluation.decidedCount / evaluation.total * 100);
  elements.activeMeta.textContent = `${level.takenAt}${state.daily ? ` · 每日底片 ${state.dailyDay}` : ""}`;
  elements.activeTitle.textContent = level.title;
  elements.activeCaption.textContent = level.caption;
  elements.negativeNumber.textContent = String(LEVELS.indexOf(level) + 1).padStart(2, "0");
  elements.decidedCount.textContent = String(evaluation.decidedCount);
  elements.cellTotal.textContent = String(evaluation.total);
  elements.progressBar.setAttribute("aria-valuenow", String(percent));
  elements.progressBar.setAttribute("aria-valuetext", `已明确 ${evaluation.decidedCount} / ${evaluation.total} 格`);
  elements.progressBar.querySelector("span").style.width = `${percent}%`;
  elements.lineStatus.classList.remove("is-warning", "is-success");
  if (evaluation.complete) {
    elements.lineStatus.textContent = "全部行列吻合 · 显影完成";
    elements.lineStatus.classList.add("is-success");
  } else if (evaluation.contradictions > 0) {
    elements.lineStatus.textContent = `${evaluation.contradictions} 条行列当前已无可行排列`;
    elements.lineStatus.classList.add("is-warning");
  } else if (evaluation.decidedCount === 0) {
    elements.lineStatus.textContent = "等待第一笔显影";
  } else {
    elements.lineStatus.textContent = `仍有 ${evaluation.total - evaluation.decidedCount} 格未知`;
  }
  elements.boardFrame.classList.toggle("is-complete", evaluation.complete);
  renderCells(changedIndices);
  renderClues();
  renderControls();
  renderAlbum();
}

function buildContactSheet() {
  const fragment = document.createDocumentFragment();
  LEVELS.forEach((photo, index) => {
    const card = document.createElement("div");
    card.className = "contact-card";
    card.dataset.levelId = photo.id;
    card.style.setProperty("--tilt", `${[-1.2, .7, -.4][index % 3]}deg`);
    card.setAttribute("role", "img");

    const thumbnail = document.createElement("div");
    thumbnail.className = "contact-thumbnail";
    thumbnail.style.gridTemplateColumns = `repeat(${photo.width}, 1fr)`;
    thumbnail.style.gridTemplateRows = `repeat(${photo.height}, 1fr)`;
    photo.solution.forEach((value) => {
      const pixel = document.createElement("span");
      pixel.className = `contact-pixel${value ? " is-filled" : ""}`;
      thumbnail.append(pixel);
    });
    const caption = document.createElement("p");
    caption.textContent = photo.title.replace(/ · .+$/, "");
    const lock = document.createElement("span");
    lock.className = "lock-mark";
    lock.textContent = "?";
    lock.setAttribute("aria-hidden", "true");
    card.append(thumbnail, caption, lock);
    fragment.append(card);
  });
  elements.contactSheet.append(fragment);
}

function createDifficultyButtons() {
  const fragment = document.createDocumentFragment();
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty.id;
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<b>${difficulty.label}</b><small>${difficulty.note}</small>`;
    button.setAttribute("aria-label", `${difficulty.label}难度，${difficulty.note}`);
    button.addEventListener("click", () => startNextLevel(difficulty.id, true));
    fragment.append(button);
  }
  elements.difficultyButtons.append(fragment);
}

function changedIndices(before, after) {
  const indices = [];
  for (let index = 0; index < before.length; index += 1) {
    if (before[index] !== after[index]) indices.push(index);
  }
  return indices;
}

function countNewMistakes(before, after) {
  let mistakes = 0;
  for (let index = 0; index < before.length; index += 1) {
    if (before[index] === after[index] || after[index] === CELL.UNKNOWN) continue;
    const shouldFill = level.solution[index] === 1;
    if ((after[index] === CELL.FILLED) !== shouldFill) mistakes += 1;
  }
  return mistakes;
}

function commitGrid(nextGrid, previous, soundName) {
  const changed = changedIndices(previous.grid, nextGrid);
  if (changed.length === 0) {
    state.grid = [...previous.grid];
    render();
    return false;
  }
  pushHistory(previous);
  state.grid = [...nextGrid];
  state.moves = previous.moves + 1;
  state.mistakes = previous.mistakes + countNewMistakes(previous.grid, nextGrid);
  state.completed = false;
  render(changed);
  saveLocalState();
  playSound(soundName);
  if (evaluation.complete) completePhoto();
  return true;
}

function desiredStateForTool() {
  return TOOL_STATE[state.tool] ?? CELL.FILLED;
}

function applySingle(index, desired, { cycle = false, reverse = false } = {}) {
  if (state.completed) {
    showToast("这张照片已经完成；可撤销最后一笔，或换一张底片。", false, 3200);
    return;
  }
  const previous = snapshot();
  const nextState = cycle ? cycleCell(state.grid[index], reverse) : desired;
  const result = applyCellState(level, state.grid, index, nextState);
  if (!result.accepted || !result.changed) return;
  const soundName = nextState === CELL.FILLED ? "fill" : nextState === CELL.EXCLUDED ? "exclude" : "erase";
  commitGrid(result.grid, previous, soundName);
}

function pointForCell(cell) {
  return { row: Number(cell.dataset.row), column: Number(cell.dataset.column) };
}

function pointerState(event) {
  if (event.shiftKey || event.button === 1) return CELL.UNKNOWN;
  if (event.button === 2) return CELL.EXCLUDED;
  return desiredStateForTool();
}

function beginPointerGesture(event, cell) {
  const mousePointer = event.pointerType === "mouse" && [0, 1, 2].includes(event.button);
  const directPointer = ["touch", "pen"].includes(event.pointerType)
    && event.isPrimary !== false && event.button === 0;
  if ((!mousePointer && !directPointer) || state.completed) return;
  event.preventDefault();
  focusedIndex = Number(cell.dataset.index);
  updateRovingFocus();
  cell.focus({ preventScroll: true });
  const previous = snapshot();
  const desired = pointerState(event);
  const start = pointForCell(cell);
  const result = applyStroke(level, previous.grid, start, start, desired);
  gesture = {
    pointerId: event.pointerId,
    start,
    end: start,
    desired,
    previous,
    preview: result.grid,
  };
  state.grid = [...result.grid];
  elements.board.setPointerCapture?.(event.pointerId);
  render(result.changed ? [focusedIndex] : []);
}

function updatePointerGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("button.grid-cell");
  if (!target || !elements.board.contains(target)) return;
  const end = pointForCell(target);
  if (end.row === gesture.end.row && end.column === gesture.end.column) return;
  gesture.end = end;
  const result = applyStroke(level, gesture.previous.grid, gesture.start, end, gesture.desired);
  const changed = changedIndices(state.grid, result.grid);
  gesture.preview = result.grid;
  state.grid = [...result.grid];
  render(changed);
}

function finishPointerGesture(event, cancelled = false) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const active = gesture;
  gesture = null;
  suppressClickUntil = performance.now() + 500;
  elements.board.releasePointerCapture?.(event.pointerId);
  state.grid = [...active.previous.grid];
  if (cancelled) {
    render();
    return;
  }
  const soundName = active.desired === CELL.FILLED ? "fill" : active.desired === CELL.EXCLUDED ? "exclude" : "erase";
  commitGrid(active.preview, active.previous, soundName);
}

function reportRealmCompletion() {
  const payload = {
    levelId: `photo:${level.difficulty}:${level.id}`,
    tier: COMPLETION_TIERS[level.difficulty] ?? 1,
    moves: state.moves,
    par: level.par,
  };
  if (typeof window.RealmArcade?.complete === "function") window.RealmArcade.complete(payload);
  else (window.__realmCompletionQueue ??= []).push(payload);
}

function settlePhotoCompletion() {
  const local = recordPhotoCompletionOnce(state, collection, {
    levelId: level.id,
    moves: state.moves,
    mistakes: state.mistakes,
    daily: state.daily && state.dailyDay === localDayKey(),
  }, recordCollectionCompletion);
  state = local.state;
  collection = local.collection;
  const realm = confirmPhotoCompletion(state, reportRealmCompletion);
  state = realm.state;
  saveLocalState();
  return { result: local.result, realm };
}

function buildVictoryPhoto() {
  elements.victoryPhoto.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "victory-photo-grid";
  grid.style.gridTemplateColumns = `repeat(${level.width}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${level.height}, 1fr)`;
  level.solution.forEach((value) => {
    const pixel = document.createElement("span");
    if (value) pixel.className = "is-filled";
    grid.append(pixel);
  });
  elements.victoryPhoto.append(grid);
  elements.victoryPhoto.setAttribute("aria-label", `完成照片：${level.title}`);
}

function cancelVictoryWait() {
  window.clearTimeout(victoryTimer);
  victoryObserver?.disconnect();
  victoryObserver = null;
}

function openVictoryWhenAvailable() {
  cancelVictoryWait();
  const openDialog = [...document.querySelectorAll("dialog[open]")].find((dialog) => dialog !== elements.victoryDialog);
  if (!openDialog) {
    if (!elements.victoryDialog.open) elements.victoryDialog.showModal();
    return;
  }
  victoryObserver = new MutationObserver(() => {
    if ([...document.querySelectorAll("dialog[open]")].some((dialog) => dialog !== elements.victoryDialog)) return;
    cancelVictoryWait();
    if (!elements.victoryDialog.open) elements.victoryDialog.showModal();
  });
  victoryObserver.observe(document.body, { attributes: true, attributeFilter: ["open"], subtree: true });
}

function completePhoto() {
  if (state.completed) return;
  state.completed = true;
  const settlement = settlePhotoCompletion();
  const result = settlement.result ?? { unlocks: [], personalBest: false };
  render();
  buildVictoryPhoto();
  elements.victoryCaption.textContent = `${level.title}｜${level.caption}`;
  elements.victoryMoves.textContent = String(state.moves);
  elements.victoryPar.textContent = `≤ ${level.par}`;
  elements.victoryQuality.textContent = state.mistakes === 0 ? "无误显影" : `修正 ${state.mistakes} 格`;
  elements.victoryUnlocks.replaceChildren();
  const unlocks = result.unlocks.length ? result.unlocks : [result.personalBest ? "刷新个人最佳" : "照片已复核"];
  for (const unlock of unlocks) {
    const badge = document.createElement("span");
    badge.textContent = unlock;
    elements.victoryUnlocks.append(badge);
  }
  announce(`显影完成：${level.title}，${state.moves} 次有效落笔。`);
  playSound("win");
  victoryTimer = window.setTimeout(openVictoryWhenAvailable, reduceMotion.matches ? 0 : 620);
}

function closeVictory({ restoreFocus = true } = {}) {
  cancelVictoryWait();
  if (elements.victoryDialog.open) elements.victoryDialog.close();
  if (restoreFocus) cellElements[focusedIndex]?.focus({ preventScroll: true });
}

function setTool(tool) {
  if (!Object.hasOwn(TOOL_STATE, tool)) return;
  state.tool = tool;
  renderControls();
  saveLocalState();
  const messages = {
    fill: "显影刷已就位：点击格子填黑。",
    exclude: "排除笔已就位：点击格子留下清晰的 ×。",
    erase: "回洗液已就位：点击格子恢复未知。",
  };
  showToast(messages[tool], false, 1800);
}

function startLevel(nextLevel, { daily = false, message = "" } = {}) {
  closeVictory({ restoreFocus: false });
  level = nextLevel;
  const muted = state.muted;
  const tool = state.tool;
  state = createSession(level);
  state.muted = muted;
  state.tool = tool;
  state.daily = daily;
  state.dailyDay = daily ? localDayKey() : "";
  focusedIndex = 0;
  buildBoard();
  saveLocalState();
  if (message) showToast(message);
  window.requestAnimationFrame(() => {
    elements.boardViewport.scrollTo({ top: 0, left: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    cellElements[0]?.focus({ preventScroll: true });
  });
}

function startNextLevel(difficulty = level.difficulty, explicitDifficulty = false) {
  const levels = levelsForDifficulty(difficulty);
  const currentIndex = levels.findIndex((candidate) => candidate.id === level.id);
  const nextIndex = explicitDifficulty && level.difficulty !== difficulty
    ? 0
    : currentIndex < 0 ? 0 : (currentIndex + 1) % levels.length;
  const next = levels[nextIndex];
  startLevel(next, { message: `新底片已装入：${next.title}` });
}

function startDaily() {
  const today = localDayKey();
  const daily = dailyLevelFor();
  startLevel(daily, { daily: true, message: `今日底片 ${today} 已装入：${daily.title}` });
}

function restart() {
  closeVictory({ restoreFocus: false });
  const previous = snapshot();
  const hasMarks = state.grid.some((cell) => cell !== CELL.UNKNOWN);
  if (!hasMarks) {
    showToast("这张底片还没有落笔。", false, 1800);
    return;
  }
  state.history = [previous];
  state.grid = Array(level.width * level.height).fill(CELL.UNKNOWN);
  state.moves = 0;
  state.mistakes = 0;
  state.completed = false;
  state.completionRecorded = false;
  state.completionReported = false;
  render();
  saveLocalState();
  playSound("erase");
  showToast("相纸已重新浸入显影液；撤销可回到重开前。", false, 2800);
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    showToast("还没有可以撤销的显影笔迹。", false, 1800);
    return;
  }
  closeVictory({ restoreFocus: false });
  const completionRecorded = state.completionRecorded === true;
  const completionReported = state.completionReported === true;
  state.grid = [...previous.grid];
  state.moves = previous.moves;
  state.mistakes = previous.mistakes;
  state.completed = previous.completed === true;
  state.completionRecorded = completionRecorded || previous.completionRecorded === true;
  state.completionReported = completionReported || previous.completionReported === true;
  render();
  saveLocalState();
  playSound("undo");
  showToast("已退回上一笔有效操作。", false, 1700);
  cellElements[focusedIndex]?.focus({ preventScroll: true });
}

function inspectClues() {
  window.clearTimeout(inspectTimer);
  elements.boardFrame.classList.remove("is-inspecting");
  rowClueElements.forEach((element) => element.classList.remove("is-inspected"));
  columnClueElements.forEach((element) => element.classList.remove("is-inspected"));
  window.requestAnimationFrame(() => elements.boardFrame.classList.add("is-inspecting"));
  const impossibleRows = evaluation.rows.flatMap((line, row) => line.possible ? [] : [row]);
  const impossibleColumns = evaluation.columns.flatMap((line, column) => line.possible ? [] : [column]);
  impossibleRows.forEach((row) => rowClueElements[row].classList.add("is-inspected"));
  impossibleColumns.forEach((column) => columnClueElements[column].classList.add("is-inspected"));
  playSound(impossibleRows.length + impossibleColumns.length > 0 ? "warning" : "inspect");
  if (evaluation.complete) {
    showToast("全部行列已经精确吻合。", false, 2200);
  } else if (impossibleRows.length + impossibleColumns.length > 0) {
    const message = `核片发现 ${impossibleRows.length} 行、${impossibleColumns.length} 列当前已无可行排列；没有揭示隐藏答案。`;
    showToast(message, true, 4200);
    announce(message);
  } else {
    showToast("当前每条行列仍至少有一种可行排列；核片不会揭示答案。", false, 3300);
  }
  inspectTimer = window.setTimeout(() => {
    elements.boardFrame.classList.remove("is-inspecting");
    rowClueElements.forEach((element) => element.classList.remove("is-inspected"));
    columnClueElements.forEach((element) => element.classList.remove("is-inspected"));
  }, 3000);
}

function moveFocus(rowStep, columnStep) {
  const row = Math.floor(focusedIndex / level.width);
  const column = focusedIndex % level.width;
  const nextRow = Math.max(0, Math.min(level.height - 1, row + rowStep));
  const nextColumn = Math.max(0, Math.min(level.width - 1, column + columnStep));
  const next = nextRow * level.width + nextColumn;
  if (next === focusedIndex) return;
  focusedIndex = next;
  updateRovingFocus();
  cellElements[focusedIndex]?.focus({ preventScroll: false });
}

function toggleMute() {
  state.muted = !state.muted;
  if (!state.muted) {
    ensureAudio();
    playSound("inspect");
  }
  renderControls();
  saveLocalState();
  showToast(state.muted ? "暗房已经静音。" : "合成暗房声音已经开启。", false, 1800);
}

function openRules(opener = document.activeElement) {
  if (elements.rulesDialog.open || [...document.querySelectorAll("dialog[open]")].length > 0) return;
  lastDialogFocus = opener instanceof HTMLElement ? opener : null;
  elements.rulesDialog.showModal();
  elements.rulesCloseButton.focus({ preventScroll: true });
}

function closeRules() {
  if (elements.rulesDialog.open) elements.rulesDialog.close();
  const target = lastDialogFocus?.isConnected ? lastDialogFocus : cellElements[focusedIndex];
  lastDialogFocus = null;
  target?.focus({ preventScroll: true });
}

function openTutorial() {
  if (typeof window.RealmArcade?.openTutorial === "function") {
    window.RealmArcade.openTutorial();
    return;
  }
  const onReady = () => window.RealmArcade?.openTutorial?.();
  window.addEventListener("realm:ready", onReady, { once: true });
}

elements.board.addEventListener("click", (event) => {
  const cell = event.target.closest("button.grid-cell");
  if (!cell || performance.now() < suppressClickUntil) return;
  focusedIndex = Number(cell.dataset.index);
  updateRovingFocus();
  const desired = event.shiftKey ? CELL.UNKNOWN : desiredStateForTool();
  applySingle(focusedIndex, desired);
});

elements.board.addEventListener("contextmenu", (event) => {
  const cell = event.target.closest("button.grid-cell");
  if (!cell) return;
  event.preventDefault();
  if (performance.now() < suppressClickUntil) return;
  focusedIndex = Number(cell.dataset.index);
  updateRovingFocus();
  applySingle(focusedIndex, CELL.EXCLUDED);
});

elements.board.addEventListener("pointerdown", (event) => {
  const cell = event.target.closest("button.grid-cell");
  if (cell) beginPointerGesture(event, cell);
});
window.addEventListener("pointermove", updatePointerGesture);
window.addEventListener("pointerup", (event) => finishPointerGesture(event));
window.addEventListener("pointercancel", (event) => finishPointerGesture(event, true));

elements.board.addEventListener("keydown", (event) => {
  const cell = event.target.closest("button.grid-cell");
  if (!cell) return;
  focusedIndex = Number(cell.dataset.index);
  const movement = {
    ArrowUp: [-1, 0],
    ArrowRight: [0, 1],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
  }[event.key];
  if (movement) {
    if (event.altKey) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      if (state.completed) {
        showToast("这张照片已经完成；可撤销最后一笔，或换一张底片。", false, 3200);
        return;
      }
      const desired = event.ctrlKey || event.metaKey
        ? event.shiftKey ? CELL.UNKNOWN : CELL.FILLED
        : CELL.EXCLUDED;
      const row = Math.floor(focusedIndex / level.width);
      const column = focusedIndex % level.width;
      const nextRow = Math.max(0, Math.min(level.height - 1, row + movement[0]));
      const nextColumn = Math.max(0, Math.min(level.width - 1, column + movement[1]));
      const nextIndex = nextRow * level.width + nextColumn;
      const previous = snapshot();
      const result = applyStroke(level, state.grid, { row, column }, { row: nextRow, column: nextColumn }, desired);
      focusedIndex = nextIndex;
      const soundName = desired === CELL.FILLED ? "fill" : desired === CELL.EXCLUDED ? "exclude" : "erase";
      commitGrid(result.grid, previous, soundName);
      cellElements[focusedIndex]?.focus({ preventScroll: false });
    } else {
      moveFocus(...movement);
    }
  } else if (event.key === "Enter") {
    event.preventDefault();
    applySingle(focusedIndex, null, { cycle: true });
  } else if (event.key === " ") {
    event.preventDefault();
    applySingle(focusedIndex, null, { cycle: true, reverse: true });
  } else if (event.key === "f" || event.key === "F") {
    event.preventDefault();
    applySingle(focusedIndex, CELL.FILLED);
  } else if (event.key === "x" || event.key === "X") {
    event.preventDefault();
    applySingle(focusedIndex, CELL.EXCLUDED);
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    applySingle(focusedIndex, CELL.UNKNOWN);
  } else if (event.key === "Home") {
    event.preventDefault();
    focusedIndex = 0;
    updateRovingFocus();
    cellElements[0]?.focus();
  } else if (event.key === "End") {
    event.preventDefault();
    focusedIndex = cellElements.length - 1;
    updateRovingFocus();
    cellElements[focusedIndex]?.focus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
  const targetIsControl = event.target.closest("button, a, input, select, textarea, summary");
  if (targetIsControl && !event.target.closest("button.grid-cell")) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    undo();
  } else if (key === "u" || key === "z") {
    event.preventDefault();
    undo();
  } else if (key === "r") {
    event.preventDefault();
    restart();
  } else if (key === "n") {
    event.preventDefault();
    startNextLevel();
  } else if (key === "c") {
    event.preventDefault();
    inspectClues();
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

for (const button of [elements.toolFill, elements.toolExclude, elements.toolErase]) {
  button.addEventListener("click", () => setTool(button.dataset.tool));
}
elements.inspectButton.addEventListener("click", inspectClues);
elements.undoButton.addEventListener("click", undo);
elements.restartButton.addEventListener("click", restart);
elements.newButton.addEventListener("click", () => startNextLevel());
elements.muteButton.addEventListener("click", toggleMute);
elements.dailyButton.addEventListener("click", startDaily);
elements.rulesButton.addEventListener("click", () => openRules(elements.rulesButton));
elements.footerRulesButton.addEventListener("click", () => openRules(elements.footerRulesButton));
elements.tutorialButton.addEventListener("click", openTutorial);
elements.rulesCloseButton.addEventListener("click", closeRules);
elements.victoryCloseButton.addEventListener("click", () => closeVictory());
elements.victoryStayButton.addEventListener("click", () => closeVictory());
elements.victoryNextButton.addEventListener("click", () => startNextLevel());

elements.rulesDialog.addEventListener("cancel", (event) => {
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
elements.victoryDialog.addEventListener("click", (event) => {
  if (event.target === elements.victoryDialog) closeVictory();
});

createDifficultyButtons();
buildContactSheet();
const restoreResult = loadLocalState();
buildBoard();
render();

if (state.completed && !state.completionReported) {
  settlePhotoCompletion();
  render();
}

window.addEventListener("storage", (event) => {
  if (event.key !== COLLECTION_KEY || event.newValue === null) return;
  try {
    const incoming = normalizeCollection(JSON.parse(event.newValue));
    collection = mergeCollections(collection, incoming);
    renderAlbum();
    const mergedValue = JSON.stringify(collection);
    if (mergedValue !== JSON.stringify(incoming)) storageWrite(COLLECTION_KEY, mergedValue);
  } catch {
    // Another tab's malformed value cannot displace this tab's validated collection.
  }
});

window.addEventListener("resize", () => requestAnimationFrame(syncBoardScale));

if (restoreResult.repaired) {
  showToast("有一段损坏的暗房记录无法读取，已安全回到可用底片。", true, 4200);
  saveLocalState();
} else if (restoreResult.restored) {
  showToast(state.completed ? "已恢复完成后的收藏照片。" : "已恢复上次未完成的显影进度。", false, 3000);
} else {
  saveLocalState();
}
