import {
  CELL_STATES,
  DIFFICULTIES,
  DIRECTIONS,
  DIRECTION_NAMES,
  EDGE_STATES,
  LEVELS,
  allEdgeKeys,
  analyzeBoard,
  cellKey,
  cloneBoardState,
  countSolutions,
  createBoardState,
  createRecords,
  deserializeBoardState,
  directionsAt,
  directionsForMask,
  edgeKey,
  findLevel,
  fixedTrackEdges,
  inBounds,
  isEdgeCompatibleWithGivens,
  levelsForDifficulty,
  normalizeRecords,
  parseCellKey,
  parseEdgeKey,
  recordCompletion,
  serializeBoardState,
  setCellState,
  setEdgeState,
  unlockedCosmetics,
} from "./logic.mjs";
import {
  COMPLETION_EVENT,
  STORAGE_KEYS,
  TUTORIAL_SLIDES,
  createModalController,
  deliverCompletion,
  isTypingTarget,
  makeCompletionEnvelope,
  restoreCompletionEnvelope,
} from "./ui-helpers.mjs";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const MAX_HISTORY = 100;
const TOOL_IDS = new Set(["edge-track", "edge-excluded", "cell-candidate", "cell-excluded"]);
const DIRECTION_META = Object.freeze({
  N: Object.freeze({ dx: 0, dy: -1, angle: -90 }),
  E: Object.freeze({ dx: 1, dy: 0, angle: 0 }),
  S: Object.freeze({ dx: 0, dy: 1, angle: 90 }),
  W: Object.freeze({ dx: -1, dy: 0, angle: 180 }),
});

const elements = Object.freeze({
  boardViewport: document.querySelector("#board-viewport"),
  quotaBoard: document.querySelector("#quota-board"),
  railGrid: document.querySelector("#rail-grid"),
  columnClues: document.querySelector("#column-clues"),
  rowClues: document.querySelector("#row-clues"),
  cellLayer: document.querySelector("#cell-layer"),
  edgeLayer: document.querySelector("#edge-layer"),
  trainLayer: document.querySelector("#train-layer"),
  quotaSummary: document.querySelector("#quota-summary"),
  progressBar: document.querySelector("#progress-bar"),
  signalLight: document.querySelector("#signal-light"),
  routeStatus: document.querySelector("#route-status"),
  levelKicker: document.querySelector("#level-kicker"),
  levelTitle: document.querySelector("#level-title"),
  puzzleSeed: document.querySelector("#puzzle-seed"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  toolButtons: document.querySelector("#tool-buttons"),
  undoButton: document.querySelector("#undo-button"),
  restartButton: document.querySelector("#restart-button"),
  newPuzzleButton: document.querySelector("#new-puzzle-button"),
  muteButton: document.querySelector("#mute-button"),
  tutorialButton: document.querySelector("#tutorial-button"),
  footerTutorialButton: document.querySelector("#footer-tutorial-button"),
  rulesButton: document.querySelector("#rules-button"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  moveCount: document.querySelector("#move-count"),
  quotaTotal: document.querySelector("#quota-total"),
  parMoves: document.querySelector("#par-moves"),
  timerValue: document.querySelector("#timer-value"),
  completionCount: document.querySelector("#completion-count"),
  conflictCount: document.querySelector("#conflict-count"),
  statusTitle: document.querySelector("#status-title"),
  statusCopy: document.querySelector("#status-copy"),
  saveStatus: document.querySelector("#save-status"),
  atlasGrid: document.querySelector("#atlas-grid"),
  collectionCount: document.querySelector("#collection-count"),
  collectionTotal: document.querySelector("#collection-total"),
  zeroCount: document.querySelector("#zero-count"),
  badgeNoRework: document.querySelector("#badge-no-rework"),
  badgeOnTime: document.querySelector("#badge-on-time"),
  punctualGrid: document.querySelector("#punctual-grid"),
  engineOptions: document.querySelector("#engine-options"),
  carriageOptions: document.querySelector("#carriage-options"),
  tutorialDialog: document.querySelector("#tutorial-dialog"),
  tutorialImage: document.querySelector("#tutorial-image"),
  tutorialEyebrow: document.querySelector("#tutorial-eyebrow"),
  tutorialTitle: document.querySelector("#tutorial-title"),
  tutorialCopy: document.querySelector("#tutorial-copy"),
  tutorialBack: document.querySelector("#tutorial-back"),
  tutorialNext: document.querySelector("#tutorial-next"),
  tutorialSkip: document.querySelector("#tutorial-skip"),
  tutorialClose: document.querySelector("#tutorial-close"),
  rulesDialog: document.querySelector("#rules-dialog"),
  rulesClose: document.querySelector("#rules-close"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryTitle: document.querySelector("#victory-title"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryTime: document.querySelector("#victory-time"),
  victoryRoute: document.querySelector("#victory-route"),
  victoryAwards: document.querySelector("#victory-awards"),
  victoryNext: document.querySelector("#victory-next"),
  victoryStay: document.querySelector("#victory-stay"),
  toast: document.querySelector("#toast"),
  politeStatus: document.querySelector("#polite-status"),
  alertStatus: document.querySelector("#alert-status"),
});

let storageAvailable = true;
let audioContext = null;
let toastTimer = 0;
let timerHandle = 0;
let trainAnimation = null;
let victoryTimer = 0;
let victoryGeneration = 0;
let tutorialIndex = 0;
let focusedCell = null;
let edgeAnchor = null;

function newAttemptId(puzzleId) {
  const suffix = window.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${puzzleId}:${suffix}`;
}

function defaultAttempt(puzzle) {
  return {
    id: newAttemptId(puzzle.id),
    startedAt: Date.now(),
    elapsedBeforeMs: 0,
    undoCount: 0,
    restartCount: 0,
    recorded: false,
    reported: false,
    completedAt: null,
    pendingCompletion: null,
  };
}

function defaultState() {
  const level = LEVELS[0];
  return {
    level,
    difficulty: level.difficulty,
    board: createBoardState(level),
    history: [],
    tool: "edge-track",
    muted: false,
    completed: false,
    records: createRecords(),
    attempt: defaultAttempt(level),
    lastAwards: [],
  };
}

let state = defaultState();

function safeParse(raw) {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storageGet(key) {
  try {
    const value = window.localStorage.getItem(key);
    storageAvailable = true;
    return value;
  } catch {
    storageAvailable = false;
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}

function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    storageAvailable = false;
  }
}

function loadPreferences() {
  const value = safeParse(storageGet(STORAGE_KEYS.preferences));
  return {
    muted: Boolean(value?.version === 1 && value.muted),
    tool: value?.version === 1 && TOOL_IDS.has(value.tool) ? value.tool : "edge-track",
  };
}

function loadRecords() {
  const value = safeParse(storageGet(STORAGE_KEYS.records));
  return value?.version === 1 ? normalizeRecords(value.records) : createRecords();
}

function normalizeAttempt(value, puzzle) {
  if (!value || typeof value !== "object" || typeof value.id !== "string"
      || !value.id.startsWith(`${puzzle.id}:`) || `polar-railway:${value.id}`.length > 160
      || !Number.isSafeInteger(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > 31_536_000_000
      || !Number.isSafeInteger(value.undoCount) || value.undoCount < 0 || value.undoCount > 10_000_000
      || !Number.isSafeInteger(value.restartCount) || value.restartCount < 0 || value.restartCount > 10_000_000
      || (value.recorded !== undefined && typeof value.recorded !== "boolean")
      || (value.reported !== undefined && typeof value.reported !== "boolean")) return null;
  const pendingCandidate = value.pendingCompletion ?? null;
  const pendingCompletion = pendingCandidate === null ? null : restoreCompletionEnvelope(pendingCandidate, {
    puzzle,
    attemptId: value.id,
  });
  if (pendingCandidate !== null && !pendingCompletion) return null;
  return {
    id: value.id,
    startedAt: Date.now(),
    elapsedBeforeMs: value.elapsedMs,
    undoCount: value.undoCount,
    restartCount: value.restartCount,
    recorded: Boolean(value.recorded),
    reported: Boolean(value.reported),
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
    pendingCompletion,
  };
}

function loadSavedGame() {
  const preferences = loadPreferences();
  const records = loadRecords();
  const fallback = defaultState();
  fallback.muted = preferences.muted;
  fallback.tool = preferences.tool;
  fallback.records = records;
  const saved = safeParse(storageGet(STORAGE_KEYS.save));
  if (!saved) return { restored: false, state: fallback };
  if (saved.version !== 1 || typeof saved.puzzleId !== "string") {
    storageRemove(STORAGE_KEYS.save);
    return { restored: false, invalid: true, state: fallback };
  }
  const level = findLevel(saved.puzzleId);
  const board = level ? deserializeBoardState(saved.board, level) : null;
  const attempt = level ? normalizeAttempt(saved.attempt, level) : null;
  if (!level || !board || !attempt || !TOOL_IDS.has(saved.tool)) {
    storageRemove(STORAGE_KEYS.save);
    return { restored: false, invalid: true, state: fallback };
  }
  const history = Array.isArray(saved.history)
    ? saved.history.slice(-MAX_HISTORY).map((item) => deserializeBoardState(item, level)).filter(Boolean)
    : [];
  const evaluation = analyzeBoard(level, board);
  const completionId = `polar-railway:${attempt.id}`;
  if (evaluation.solved) {
    attempt.recorded = Boolean(records.completionLedger[completionId]);
  } else {
    attempt.recorded = false;
    attempt.reported = false;
    attempt.completedAt = null;
    attempt.pendingCompletion = null;
  }
  return {
    restored: true,
    state: {
      level,
      difficulty: level.difficulty,
      board,
      history,
      tool: saved.tool,
      muted: preferences.muted,
      completed: evaluation.solved,
      records,
      attempt,
      lastAwards: attempt.pendingCompletion?.rewards.map((item) => ({ ...item })) ?? [],
    },
  };
}

function currentElapsedMs() {
  if (state.completed) return state.attempt.elapsedBeforeMs;
  return state.attempt.elapsedBeforeMs + Math.max(0, Date.now() - state.attempt.startedAt);
}

function savePreferences() {
  storageSet(STORAGE_KEYS.preferences, JSON.stringify({ version: 1, muted: state.muted, tool: state.tool }));
}

function saveRecords() {
  storageSet(STORAGE_KEYS.records, JSON.stringify({ version: 1, records: state.records }));
}

function saveGame() {
  const elapsedMs = currentElapsedMs();
  const saved = {
    version: 1,
    puzzleId: state.level.id,
    difficulty: state.difficulty,
    tool: state.tool,
    board: serializeBoardState(state.board),
    history: state.history.slice(-MAX_HISTORY).map(serializeBoardState),
    attempt: {
      id: state.attempt.id,
      elapsedMs,
      undoCount: state.attempt.undoCount,
      restartCount: state.attempt.restartCount,
      recorded: state.attempt.recorded,
      reported: state.attempt.reported,
      completedAt: state.attempt.completedAt,
      pendingCompletion: state.attempt.pendingCompletion,
    },
  };
  let savedOkay = storageSet(STORAGE_KEYS.save, JSON.stringify(saved));
  if (!savedOkay && saved.history.length > 0) {
    // A completed board plus its pending delivery is more important than undo
    // history when the storage quota is tight. Replacing the old save with this
    // smaller envelope keeps refresh retry-safe without changing the position.
    savedOkay = storageSet(STORAGE_KEYS.save, JSON.stringify({ ...saved, history: [] }));
  }
  if (elements.saveStatus) elements.saveStatus.textContent = savedOkay ? "调度记录已保存到本机" : "本机存档暂不可用";
  return savedOkay;
}

function tutorialWasSeen() {
  const value = safeParse(storageGet(STORAGE_KEYS.tutorial));
  return value?.version === 1 && value.seen === true;
}

function markTutorialSeen() {
  storageSet(STORAGE_KEYS.tutorial, JSON.stringify({ version: 1, seen: true }));
}

function ensureAudio() {
  if (state.muted) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function tone(frequency, duration, { delay = 0, type = "sine", gain = 0.028, to = null } = {}) {
  const context = ensureAudio();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (to) oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.016);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSound(effect) {
  if (state.muted) return;
  if (effect === "track") {
    tone(310, 0.12, { type: "triangle", to: 430 });
    tone(620, 0.08, { delay: 0.035, gain: 0.014 });
  } else if (effect === "exclude") {
    tone(205, 0.09, { type: "square", gain: 0.012, to: 155 });
  } else if (effect === "erase" || effect === "undo") {
    tone(410, 0.11, { type: "triangle", gain: 0.018, to: 280 });
  } else if (effect === "error") {
    tone(148, 0.17, { type: "sawtooth", gain: 0.016, to: 112 });
  } else if (effect === "complete") {
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      tone(frequency, 0.5, { delay: index * 0.12, type: index % 2 ? "triangle" : "sine", gain: 0.025 });
    });
    tone(880, 0.82, { delay: 0.52, type: "sine", gain: 0.018, to: 1046.5 });
  }
}

function announce(message, { assertive = false, toast = true } = {}) {
  if (assertive && elements.alertStatus) {
    elements.alertStatus.textContent = "";
    requestAnimationFrame(() => { elements.alertStatus.textContent = message; });
  } else if (elements.politeStatus) {
    elements.politeStatus.textContent = "";
    requestAnimationFrame(() => { elements.politeStatus.textContent = message; });
  }
  if (!toast || !elements.toast) return;
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function cellLabel(result, evaluation) {
  const row = evaluation.rowStatus[result.y];
  const column = evaluation.columnStatus[result.x];
  const shape = result.complete ? `轨型 ${directionsForMask(result.mask).join("")}`
    : result.possible ? `候选轨格，已有 ${result.degree} 条连接`
      : result.excluded ? "已排除轨道" : "未决定";
  return `第 ${result.y + 1} 行第 ${result.x + 1} 列，${shape}；行配额 ${row.complete}/${row.target}，列配额 ${column.complete}/${column.target}${result.given ? "，固定预置" : ""}`;
}

function renderClues(evaluation) {
  elements.columnClues?.replaceChildren();
  elements.rowClues?.replaceChildren();
  evaluation.columnStatus.forEach((status, index) => {
    const clue = document.createElement("span");
    clue.className = `quota quota--column${status.exact ? " is-exact" : ""}${status.over ? " is-over" : ""}`;
    clue.setAttribute("role", "listitem");
    clue.textContent = String(status.target);
    clue.setAttribute("aria-label", `第 ${index + 1} 列调度配额 ${status.target}，已完成 ${status.complete}`);
    clue.dataset.complete = String(status.complete);
    elements.columnClues?.append(clue);
  });
  evaluation.rowStatus.forEach((status, index) => {
    const clue = document.createElement("span");
    clue.className = `quota quota--row${status.exact ? " is-exact" : ""}${status.over ? " is-over" : ""}`;
    clue.setAttribute("role", "listitem");
    clue.textContent = String(status.target);
    clue.setAttribute("aria-label", `第 ${index + 1} 行调度配额 ${status.target}，已完成 ${status.complete}`);
    clue.dataset.complete = String(status.complete);
    elements.rowClues?.append(clue);
  });
}

function trackMarkup(mask) {
  return directionsForMask(mask).map((direction) =>
    `<i class="rail-arm rail-arm--${direction.toLowerCase()}" aria-hidden="true"></i>`).join("");
}

function renderCells(evaluation) {
  elements.cellLayer?.replaceChildren();
  if (!elements.cellLayer) return;
  elements.cellLayer.style.setProperty("--columns", state.level.width);
  elements.cellLayer.style.setProperty("--rows", state.level.height);
  for (let y = 0; y < state.level.height; y += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "rail-row";
    rowElement.setAttribute("role", "row");
    for (let x = 0; x < state.level.width; x += 1) {
      const key = cellKey(x, y);
      const result = evaluation.cellResults.get(key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `rail-cell${result.given ? " is-given" : ""}${result.possible ? " is-possible" : ""}${result.complete ? " is-complete" : ""}${result.excluded ? " is-excluded" : ""}${result.reasons.length ? " is-error" : ""}${edgeAnchor === key ? " is-edge-anchor" : ""}`;
      button.dataset.cellKey = key;
      button.dataset.x = String(x);
      button.dataset.y = String(y);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `${cellLabel(result, evaluation)}${edgeAnchor === key ? "，已选作边起点" : ""}`);
      button.setAttribute("aria-selected", String(focusedCell === key));
      button.tabIndex = focusedCell === key || (!focusedCell && x === 0 && y === state.level.entryRow) ? 0 : -1;
      const station = x === 0 && y === state.level.entryRow ? "<b class=\"station station--a\" aria-hidden=\"true\">A</b>" : "";
      const terminus = x === state.level.exitColumn && y === state.level.height - 1 ? "<b class=\"station station--b\" aria-hidden=\"true\">B</b>" : "";
      const candidate = state.board.candidates.has(key) && !result.complete
        ? "<span class=\"candidate-mark\" aria-hidden=\"true\">◆</span>" : "";
      const excluded = result.excluded ? "<span class=\"cell-x\" aria-hidden=\"true\">×</span>" : "";
      const rivet = result.given ? "<span class=\"given-rivet\" aria-hidden=\"true\">●</span>" : "";
      button.innerHTML = `<span class="track-piece" aria-hidden="true">${trackMarkup(result.mask)}</span>${candidate}${excluded}${rivet}${station}${terminus}`;
      button.addEventListener("focus", () => {
        focusedCell = key;
        for (const item of elements.cellLayer.querySelectorAll(".rail-cell")) {
          const selected = item === button;
          item.tabIndex = selected ? 0 : -1;
          item.setAttribute("aria-selected", String(selected));
        }
      });
      button.addEventListener("click", () => handleCellAction(key));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        applyCellTool(key, "cell-excluded");
      });
      button.addEventListener("keydown", (event) => handleCellKeydown(event, { x, y }));
      rowElement.append(button);
    }
    elements.cellLayer.append(rowElement);
  }
}

function renderEdges(evaluation) {
  elements.edgeLayer?.replaceChildren();
  if (!elements.edgeLayer) return;
  const fixed = fixedTrackEdges(state.level);
  for (const key of allEdgeKeys(state.level)) {
    const { a, b } = parseEdgeKey(key);
    const horizontal = a.y === b.y;
    const control = document.createElement("span");
    control.className = `edge-control edge-control--${horizontal ? "horizontal" : "vertical"}`;
    control.classList.toggle("is-track", state.board.tracks.has(key));
    control.classList.toggle("is-excluded", state.board.edgeExclusions.has(key));
    control.classList.toggle("is-fixed", fixed.has(key));
    control.classList.toggle("is-incompatible", !isEdgeCompatibleWithGivens(state.level, key));
    control.dataset.edgeKey = key;
    control.style.setProperty("--edge-x", String(((a.x + 0.5) + (b.x + 0.5)) / 2));
    control.style.setProperty("--edge-y", String(((a.y + 0.5) + (b.y + 0.5)) / 2));
    control.innerHTML = `<span class="edge-rail" aria-hidden="true"></span><span class="edge-x" aria-hidden="true">×</span>`;
    elements.edgeLayer.append(control);
  }
}

function renderDifficultyButtons() {
  if (!elements.difficultyButtons) return;
  const activeDifficulty = document.activeElement?.dataset?.difficulty ?? null;
  elements.difficultyButtons.replaceChildren();
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "difficulty-button";
    button.dataset.difficulty = difficulty.id;
    button.classList.toggle("is-active", state.difficulty === difficulty.id);
    button.setAttribute("aria-pressed", String(state.difficulty === difficulty.id));
    button.innerHTML = `<strong>${difficulty.short}</strong><span>${difficulty.size}</span>`;
    button.addEventListener("click", () => selectDifficulty(difficulty.id, button));
    elements.difficultyButtons.append(button);
  }
  if (activeDifficulty) elements.difficultyButtons
    .querySelector(`[data-difficulty="${CSS.escape(activeDifficulty)}"]`)
    ?.focus({ preventScroll: true });
}

function renderToolButtons() {
  const buttons = elements.toolButtons?.querySelectorAll("[data-tool]") ?? [];
  for (const button of buttons) {
    const active = button.dataset.tool === state.tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  elements.edgeLayer?.classList.toggle("is-cell-tool", state.tool.startsWith("cell-"));
}

function renderRecords() {
  if (elements.atlasGrid) {
    elements.atlasGrid.replaceChildren();
    for (const level of LEVELS) {
      const unlocked = Boolean(state.records.awards[`atlas:${level.id}`]);
      const card = document.createElement("span");
      card.className = `atlas-ticket${unlocked ? " is-unlocked" : ""}`;
      card.setAttribute("role", "listitem");
      card.innerHTML = `<i aria-hidden="true">${unlocked ? "✦" : "·"}</i><span><strong>${unlocked ? level.title : "未勘测线路"}</strong><small>${level.difficulty} · #${level.seed}</small></span>`;
      card.setAttribute("aria-label", unlocked ? `已收录线路 ${level.title}` : "尚未收录的线路");
      elements.atlasGrid.append(card);
    }
  }
  const zeroCount = Object.keys(state.records.awards).filter((id) => id.startsWith("zero-rework:")).length;
  if (elements.zeroCount) elements.zeroCount.textContent = `${zeroCount} 次`;
  const zeroEarned = zeroCount > 0;
  if (elements.badgeNoRework) {
    elements.badgeNoRework.classList.toggle("is-earned", zeroEarned);
    elements.badgeNoRework.setAttribute("aria-label", `零返工铺轨徽章，${zeroEarned ? `已取得 ${zeroCount} 次` : "尚未取得"}`);
    const badgeState = elements.badgeNoRework.querySelector(".badge-state");
    if (badgeState) badgeState.textContent = zeroEarned ? "已取得" : "未取得";
  }
  const atlasCount = Object.keys(state.records.awards).filter((id) => id.startsWith("atlas:")).length;
  if (elements.collectionCount) elements.collectionCount.textContent = String(atlasCount);
  if (elements.collectionTotal) elements.collectionTotal.textContent = String(LEVELS.length);
  const punctualCount = DIFFICULTIES.filter((difficulty) => state.records.awards[`on-time:${difficulty.id}`]).length;
  if (elements.badgeOnTime) {
    const punctualEarned = punctualCount > 0;
    elements.badgeOnTime.classList.toggle("is-earned", punctualEarned);
    elements.badgeOnTime.setAttribute("aria-label", `准点徽章，${punctualEarned ? `已取得 ${punctualCount} 档` : "尚未取得"}`);
    const badgeState = elements.badgeOnTime.querySelector(".badge-state");
    if (badgeState) badgeState.textContent = punctualEarned ? "已取得" : "未取得";
  }
  if (elements.punctualGrid) {
    elements.punctualGrid.replaceChildren();
    for (const difficulty of DIFFICULTIES) {
      const earned = Boolean(state.records.awards[`on-time:${difficulty.id}`]);
      const badge = document.createElement("span");
      badge.className = `punctual-badge${earned ? " is-earned" : ""}`;
      badge.innerHTML = `<i aria-hidden="true">${earned ? "✓" : "○"}</i>${difficulty.label}`;
      elements.punctualGrid.append(badge);
    }
  }
  renderCosmeticOptions();
}

const COSMETIC_LABELS = Object.freeze({
  copper: "黄铜先锋", aurora: "极光车头", midnight: "极夜车头",
  supply: "补给车厢", mail: "雪原邮车", observatory: "极光观景车",
});

function renderCosmeticOptions() {
  const unlocked = unlockedCosmetics(state.records);
  const activeCosmetic = document.activeElement?.dataset?.cosmetic
    ? { id: document.activeElement.dataset.cosmetic, type: document.activeElement.dataset.cosmeticType }
    : null;
  const render = (container, ids, selected, type) => {
    if (!container) return;
    container.replaceChildren();
    for (const id of ids) {
      const button = document.createElement("button");
      const checked = selected === id;
      button.type = "button";
      button.className = `cosmetic-option cosmetic-option--${id}`;
      button.dataset.cosmetic = id;
      button.dataset.cosmeticType = type;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
      button.innerHTML = `<span aria-hidden="true"></span>${COSMETIC_LABELS[id]}`;
      button.addEventListener("click", () => selectCosmetic(type, id));
      button.addEventListener("keydown", (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const forwards = event.key === "ArrowRight" || event.key === "ArrowDown";
        const backwards = event.key === "ArrowLeft" || event.key === "ArrowUp";
        if (!forwards && !backwards && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const currentIndex = ids.indexOf(id);
        const nextIndex = event.key === "Home" ? 0
          : event.key === "End" ? ids.length - 1
            : (currentIndex + (forwards ? 1 : -1) + ids.length) % ids.length;
        const nextId = ids[nextIndex];
        selectCosmetic(type, nextId);
        container.querySelector(`[data-cosmetic="${CSS.escape(nextId)}"]`)?.focus({ preventScroll: true });
      });
      container.append(button);
    }
  };
  render(elements.engineOptions, unlocked.engines, state.records.selectedEngine, "engine");
  render(elements.carriageOptions, unlocked.carriages, state.records.selectedCarriage, "carriage");
  if (activeCosmetic) {
    const container = activeCosmetic.type === "engine" ? elements.engineOptions : elements.carriageOptions;
    container?.querySelector(`[data-cosmetic="${CSS.escape(activeCosmetic.id)}"]`)?.focus({ preventScroll: true });
  }
}

function messageFor(evaluation) {
  if (evaluation.solved) return { className: "is-complete", title: "全线贯通，列车准点发车", copy: "A 到 B 只有这一条完整线路，所有调度配额均已满足。" };
  if (evaluation.hasCycle) return { className: "is-warning", title: "检测到错误回路", copy: "轨道不能绕成闭环；列车必须沿一条简单线路抵达 B。" };
  const over = evaluation.conflicts.filter(({ reason }) => reason === "quota-over").length;
  if (over) return { className: "is-warning", title: `${over} 项调度配额已超限`, copy: "红色感叹号同时标出形状与数量错误，请拆除多余轨道或候选。" };
  const complete = evaluation.completeCells;
  if (complete === 0) return { className: "", title: "锅炉已升压，等待铺轨", copy: "从 A 的固定轨型向外延伸；每个轨道格最终必须恰有两条连接。" };
  if (evaluation.connected) return { className: "is-warning", title: "主线已接通，仍需核对配额", copy: "A 与 B 已相连；检查是否还有断头、游离轨段或不吻合的行列数字。" };
  return { className: "", title: `已定型 ${complete} / ${evaluation.targetCells} 格`, copy: "黄铜实轨表示已确定方向；蓝色菱形仍只是方向未知的候选。" };
}

function renderStatus(evaluation) {
  const message = messageFor(evaluation);
  const panel = elements.statusTitle?.closest(".dispatch-message");
  panel?.classList.toggle("is-warning", message.className === "is-warning");
  panel?.classList.toggle("is-complete", message.className === "is-complete");
  if (elements.statusTitle) elements.statusTitle.textContent = message.title;
  if (elements.statusCopy) elements.statusCopy.textContent = message.copy;
  if (elements.routeStatus) elements.routeStatus.textContent = message.title;
  elements.signalLight?.classList.toggle("is-warning", message.className === "is-warning");
  elements.signalLight?.classList.toggle("is-clear", message.className === "is-complete");
  if (elements.moveCount) elements.moveCount.textContent = String(state.board.moves);
  const exactQuotas = evaluation.rowStatus.filter(({ exact }) => exact).length
    + evaluation.columnStatus.filter(({ exact }) => exact).length;
  const totalQuotas = state.level.width + state.level.height;
  if (elements.completionCount) elements.completionCount.textContent = String(exactQuotas);
  if (elements.quotaTotal) elements.quotaTotal.textContent = ` / ${totalQuotas}`;
  if (elements.parMoves) elements.parMoves.textContent = String(state.level.parMoves);
  if (elements.conflictCount) elements.conflictCount.textContent = String(evaluation.conflicts.length);
  if (elements.progressBar) elements.progressBar.style.setProperty("--quota-progress", String(exactQuotas / totalQuotas));
  if (elements.quotaSummary) {
    const rows = evaluation.rowStatus.filter(({ exact }) => exact).length;
    const columns = evaluation.columnStatus.filter(({ exact }) => exact).length;
    elements.quotaSummary.textContent = `行配额 ${rows}/${state.level.height}，列配额 ${columns}/${state.level.width}`;
  }
  if (elements.undoButton) elements.undoButton.disabled = state.history.length === 0 || state.completed;
}

function renderBoard(evaluation) {
  if (elements.quotaBoard) {
    elements.quotaBoard.style.setProperty("--board-columns", state.level.width);
    elements.quotaBoard.style.setProperty("--board-rows", state.level.height);
  }
  if (elements.railGrid) {
    elements.railGrid.style.setProperty("--columns", state.level.width);
    elements.railGrid.style.setProperty("--rows", state.level.height);
    elements.railGrid.classList.toggle("is-complete", evaluation.solved);
    elements.railGrid.dataset.tool = state.tool;
    elements.railGrid.setAttribute("aria-label", `${state.level.title}，${state.level.width} 列 ${state.level.height} 行极地铁路图`);
    elements.railGrid.setAttribute("aria-rowcount", String(state.level.height));
    elements.railGrid.setAttribute("aria-colcount", String(state.level.width));
  }
  renderClues(evaluation);
  renderCells(evaluation);
  renderEdges(evaluation);
}

function render({ preserveTrain = false } = {}) {
  const evaluation = analyzeBoard(state.level, state.board);
  document.body.classList.toggle("is-complete", state.completed);
  document.body.dataset.engine = state.records.selectedEngine;
  document.body.dataset.carriage = state.records.selectedCarriage;
  if (elements.levelKicker) elements.levelKicker.textContent = `${DIFFICULTIES.find(({ id }) => id === state.level.difficulty)?.label ?? "极地线"} · ${state.level.id}`;
  if (elements.levelTitle) elements.levelTitle.textContent = state.level.title;
  if (elements.puzzleSeed) elements.puzzleSeed.textContent = `可复现题面 #${state.level.seed}`;
  renderBoard(evaluation);
  renderDifficultyButtons();
  renderToolButtons();
  renderStatus(evaluation);
  renderRecords();
  if (elements.muteButton) {
    elements.muteButton.setAttribute("aria-pressed", String(state.muted));
    elements.muteButton.querySelector(".action-label")?.replaceChildren(document.createTextNode(state.muted ? "声音关闭" : "声音开启"));
  }
  if (!preserveTrain && !state.completed) clearTrain();
  return evaluation;
}

function snapshotBeforeMove() {
  state.history.push(cloneBoardState(state.board));
  if (state.history.length > MAX_HISTORY) state.history.shift();
}

function reasonMessage(reason) {
  return {
    "fixed-track": "这是不可修改的预置轨道。",
    "fixed-shape": "预置轨型封住了这个方向。",
    "degree-limit": "该格已有两条连接；再铺会造成分叉或交叉。",
    "excluded-cell": "先清除格心叉号，才能从这里铺轨。",
    "connected-cell": "该格已有实际轨道，不能整格排除。",
    "invalid-edge": "这里不是可用的共享边。",
  }[reason] ?? "这个标记与当前轨道状态冲突。";
}

function commitAction(result, effect) {
  if (!result.changed) {
    playSound("error");
    announce(reasonMessage(result.reason), { assertive: true });
    return false;
  }
  snapshotBeforeMove();
  // snapshotBeforeMove must capture the previous state, not the returned one.
  state.history[state.history.length - 1] = state.board;
  state.board = result.state;
  playSound(result.previous === EDGE_STATES.TRACK || result.previous === CELL_STATES.CANDIDATE ? "erase" : effect);
  const evaluation = analyzeBoard(state.level, state.board);
  if (evaluation.solved) {
    const finalElapsedMs = state.attempt.elapsedBeforeMs + Math.max(0, Date.now() - state.attempt.startedAt);
    state.completed = true;
    completeGame(evaluation, finalElapsedMs);
  }
  else {
    state.completed = false;
    render();
    saveGame();
  }
  return true;
}

function applyEdgeTool(key, tool = state.tool) {
  if (state.completed) return announce("该班次已经完成；换一题可继续调度。"), false;
  const next = tool === "edge-excluded"
    ? (state.board.edgeExclusions.has(key) ? EDGE_STATES.UNKNOWN : EDGE_STATES.EXCLUDED)
    : (state.board.tracks.has(key) ? EDGE_STATES.UNKNOWN : EDGE_STATES.TRACK);
  return commitAction(setEdgeState(state.level, state.board, key, next), tool === "edge-excluded" ? "exclude" : "track");
}

function applyCellTool(key, tool = state.tool) {
  if (state.completed) return announce("该班次已经完成；换一题可继续调度。"), false;
  const next = tool === "cell-excluded"
    ? (state.board.cellExclusions.has(key) ? CELL_STATES.UNKNOWN : CELL_STATES.EXCLUDED)
    : (state.board.candidates.has(key) ? CELL_STATES.UNKNOWN : CELL_STATES.CANDIDATE);
  return commitAction(setCellState(state.level, state.board, key, next), tool === "cell-excluded" ? "exclude" : "track");
}

function clearEdgeAnchor() {
  if (!edgeAnchor) return false;
  const anchor = elements.cellLayer?.querySelector(`[data-cell-key="${CSS.escape(edgeAnchor)}"]`);
  const anchorSuffix = "，已选作边起点";
  edgeAnchor = null;
  anchor?.classList.remove("is-edge-anchor");
  if (anchor?.getAttribute("aria-label")?.endsWith(anchorSuffix)) {
    anchor.setAttribute("aria-label", anchor.getAttribute("aria-label").slice(0, -anchorSuffix.length));
  }
  return true;
}

function handleCellAction(key) {
  if (state.tool.startsWith("edge-")) {
    const point = parseCellKey(key);
    if (!edgeAnchor) {
      edgeAnchor = key;
      focusedCell = key;
      render({ preserveTrain: true });
      focusCell(point);
      announce("已选边起点；再选一个正交相邻格即可操作这条边。", { toast: false });
      return;
    }
    if (edgeAnchor === key) {
      edgeAnchor = null;
      render({ preserveTrain: true });
      focusCell(point);
      announce("已取消边起点。", { toast: false });
      return;
    }
    const anchor = parseCellKey(edgeAnchor);
    if (Math.abs(anchor.x - point.x) + Math.abs(anchor.y - point.y) !== 1) {
      edgeAnchor = key;
      focusedCell = key;
      render({ preserveTrain: true });
      focusCell(point);
      announce("两格必须正交相邻；已改选当前格为起点。", { toast: false });
      return;
    }
    const priorAnchor = edgeAnchor;
    edgeAnchor = null;
    if (!applyEdgeTool(edgeKey(anchor, point))) edgeAnchor = priorAnchor;
    else focusCell(point);
    return;
  }
  if (applyCellTool(key)) focusCell(parseCellKey(key));
}

function focusCell(point) {
  if (!inBounds(state.level, point)) return false;
  focusedCell = cellKey(point);
  const target = elements.cellLayer?.querySelector(`[data-cell-key="${CSS.escape(focusedCell)}"]`);
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function handleCellKeydown(event, point) {
  const directionName = { ArrowUp: "N", ArrowRight: "E", ArrowDown: "S", ArrowLeft: "W" }[event.key];
  if (directionName) {
    event.preventDefault();
    const direction = DIRECTION_META[directionName];
    const next = { x: point.x + direction.dx, y: point.y + direction.dy };
    if (event.shiftKey && state.tool.startsWith("edge-")) {
      if (!inBounds(state.level, next)) return announce("棋盘边界外不能新增轨道。"), undefined;
      const priorAnchor = edgeAnchor;
      edgeAnchor = null;
      if (!applyEdgeTool(edgeKey(point, next))) edgeAnchor = priorAnchor;
      focusCell(point);
    } else {
      focusCell(next);
    }
    return;
  }
  if (event.key === "Escape" && clearEdgeAnchor()) {
    event.preventDefault();
    announce("已取消边起点。", { toast: false });
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleCellAction(cellKey(point));
  }
}

function undo() {
  cancelVictorySchedule();
  clearEdgeAnchor();
  if (!state.history.length || state.completed) return;
  state.board = cloneBoardState(state.history.pop());
  state.attempt.undoCount += 1;
  state.completed = false;
  playSound("undo");
  render();
  saveGame();
  announce("已撤销上一步调度。", { toast: false });
}

function startLevel(level, { countRestart = false, focusSource = null } = {}) {
  cancelVictorySchedule();
  clearTrain();
  edgeAnchor = null;
  const priorRestartCount = countRestart ? state.attempt.restartCount + 1 : 0;
  const priorElapsed = countRestart ? currentElapsedMs() : 0;
  state.level = level;
  state.difficulty = level.difficulty;
  state.board = createBoardState(level);
  state.history = [];
  state.completed = false;
  state.lastAwards = [];
  state.attempt = defaultAttempt(level);
  state.attempt.restartCount = priorRestartCount;
  state.attempt.elapsedBeforeMs = priorElapsed;
  focusedCell = cellKey(0, level.entryRow);
  render();
  saveGame();
  announce(countRestart ? "本班次已重开，累计计时继续。" : `已调入题面：${level.title}。`);
  focusSource?.focus?.({ preventScroll: true });
}

function selectDifficulty(difficulty, focusSource) {
  if (!VALID_DIFFICULTY(difficulty)) return;
  const levels = levelsForDifficulty(difficulty);
  startLevel(levels[0]);
  requestAnimationFrame(() => elements.difficultyButtons
    ?.querySelector(`[data-difficulty="${CSS.escape(difficulty)}"]`)
    ?.focus({ preventScroll: true }));
}

function VALID_DIFFICULTY(difficulty) {
  return DIFFICULTIES.some(({ id }) => id === difficulty);
}

function nextPuzzle() {
  const levels = levelsForDifficulty(state.difficulty);
  const index = levels.findIndex(({ id }) => id === state.level.id);
  startLevel(levels[(index + 1) % levels.length]);
}

function selectCosmetic(type, id) {
  const unlocked = unlockedCosmetics(state.records);
  if (type === "engine" && unlocked.engines.includes(id)) state.records.selectedEngine = id;
  else if (type === "carriage" && unlocked.carriages.includes(id)) state.records.selectedCarriage = id;
  else return;
  saveRecords();
  render({ preserveTrain: true });
  announce(`已换装：${COSMETIC_LABELS[id]}。`);
}

function recordPayloadLocally(payload) {
  const result = recordCompletion(state.records, {
    completionId: payload.completionId,
    puzzleId: payload.levelId,
    difficulty: payload.difficulty,
    moves: payload.moves,
    elapsedMs: payload.elapsedMs,
    zeroRework: payload.zeroRework,
    onTime: payload.onTime,
    completedAt: payload.completedAt,
  });
  state.records = result.records;
  state.attempt.recorded = Boolean(state.records.completionLedger[payload.completionId]);
  return result;
}

function completionPayload(_evaluation, completedAt) {
  if (state.attempt.pendingCompletion) {
    const payload = state.attempt.pendingCompletion;
    recordPayloadLocally(payload);
    state.lastAwards = payload.rewards.map((item) => ({ ...item }));
    return payload;
  }
  const elapsedMs = state.attempt.elapsedBeforeMs;
  const difficulty = DIFFICULTIES.find(({ id }) => id === state.level.difficulty);
  const zeroRework = state.board.rework === 0 && state.attempt.undoCount === 0 && state.attempt.restartCount === 0;
  const onTime = state.board.moves <= state.level.parMoves && elapsedMs <= difficulty.onTimeMs;
  const completionId = `polar-railway:${state.attempt.id}`;
  const result = recordCompletion(state.records, {
    completionId,
    puzzleId: state.level.id,
    difficulty: state.level.difficulty,
    moves: state.board.moves,
    elapsedMs,
    zeroRework,
    onTime,
    completedAt,
  });
  state.records = result.records;
  state.lastAwards = result.awards;
  const payload = makeCompletionEnvelope({
    puzzle: state.level,
    completionId,
    attemptId: state.attempt.id,
    moves: state.board.moves,
    elapsedMs,
    undoCount: state.attempt.undoCount,
    restartCount: state.attempt.restartCount,
    zeroRework,
    onTime,
    rewardIds: result.awards.map(({ id }) => id),
    rewards: result.awards,
    completedAt,
  });
  state.attempt.recorded = Boolean(state.records.completionLedger[completionId]);
  state.attempt.pendingCompletion = payload;
  return payload;
}

function reportCompletion(payload) {
  const attempt = state.attempt;
  if (attempt.reported) return false;
  // Persist both the idempotent local record and exact pending envelope before
  // invoking any synchronous, re-entrant host integration.
  saveRecords();
  saveGame();
  window.dispatchEvent(new CustomEvent(COMPLETION_EVENT, { detail: payload }));
  const delivery = deliverCompletion(window, payload);
  if (state.attempt === attempt && attempt.id === payload.attemptId) {
    if (delivery.delivered) {
      attempt.reported = true;
      attempt.pendingCompletion = null;
    } else {
      attempt.reported = false;
    }
    saveGame();
  }
  return delivery.delivered;
}

function settleCompletion(evaluation, completedAt) {
  const payload = completionPayload(evaluation, completedAt);
  saveRecords();
  saveGame();
  if (!state.attempt.reported) reportCompletion(payload);
  else if (state.attempt.pendingCompletion) {
    state.attempt.pendingCompletion = null;
    saveGame();
  }
  return payload;
}

function retryPendingCompletion() {
  if (!state.completed || !state.attempt.pendingCompletion) return false;
  if (!state.attempt.reported) return reportCompletion(state.attempt.pendingCompletion);
  return false;
}

function completeGame(evaluation, finalElapsedMs) {
  const attemptToken = state.attempt.id;
  const levelToken = state.level.id;
  const generation = ++victoryGeneration;
  window.clearTimeout(victoryTimer);
  const completedAt = new Date().toISOString();
  state.attempt.elapsedBeforeMs = finalElapsedMs;
  state.attempt.startedAt = Date.now();
  state.attempt.completedAt = completedAt;
  const payload = settleCompletion(evaluation, completedAt);
  if (generation !== victoryGeneration || !state.completed
      || state.attempt.id !== attemptToken || state.level.id !== levelToken) return;
  render({ preserveTrain: true });
  playSound("complete");
  animateTrain(evaluation.route);
  victoryTimer = window.setTimeout(() => {
    if (generation !== victoryGeneration || !state.completed
        || state.attempt.id !== attemptToken || state.level.id !== payload.levelId) return;
    victoryTimer = 0;
    showVictory(payload);
  }, reduceMotion.matches ? 120 : Math.min(1800, 420 + evaluation.route.length * 40));
  announce("线路贯通，蒸汽列车正在从 A 驶向 B！", { assertive: true });
}

function cancelVictorySchedule({ closeDialog = true } = {}) {
  window.clearTimeout(victoryTimer);
  victoryTimer = 0;
  victoryGeneration += 1;
  if (closeDialog && typeof victoryModal !== "undefined" && victoryModal.isOpen()) {
    victoryModal.close("cancelled");
  }
}

function clearTrain() {
  trainAnimation?.cancel?.();
  trainAnimation = null;
  elements.trainLayer?.replaceChildren();
}

function angleFor(route, index) {
  const current = route[index];
  const next = route[Math.min(route.length - 1, index + 1)];
  const previous = route[Math.max(0, index - 1)];
  const target = index < route.length - 1 ? next : current;
  const source = index < route.length - 1 ? current : previous;
  if (target.x > source.x) return 0;
  if (target.x < source.x) return 180;
  if (target.y > source.y) return 90;
  return -90;
}

function animateTrain(route) {
  clearTrain();
  if (!elements.trainLayer || route.length < 2) return;
  const train = document.createElement("div");
  train.className = `steam-train steam-train--${state.records.selectedEngine} steam-train-carriage--${state.records.selectedCarriage}`;
  train.setAttribute("aria-hidden", "true");
  train.innerHTML = "<span class=\"steam-train__engine\"></span><span class=\"steam-train__carriage\"></span><i></i><i></i>";
  elements.trainLayer.append(train);
  const layerRect = elements.trainLayer.getBoundingClientRect();
  const cellWidth = layerRect.width / state.level.width;
  const cellHeight = layerRect.height / state.level.height;
  const keyframes = route.map((point, index) => ({
    transform: `translate(${(point.x + 0.5) * cellWidth}px, ${(point.y + 0.5) * cellHeight}px) rotate(${angleFor(route, index)}deg)`,
    offset: index / (route.length - 1),
  }));
  if (reduceMotion.matches || typeof train.animate !== "function") {
    train.style.transform = keyframes.at(-1).transform;
    train.classList.add("is-arrived");
    return;
  }
  trainAnimation = train.animate(keyframes, {
    duration: Math.max(2200, route.length * 180),
    easing: "linear",
    fill: "forwards",
  });
  trainAnimation.finished.then(() => train.classList.add("is-arrived")).catch(() => {});
}

function showVictory(payload) {
  if (elements.victoryTitle) elements.victoryTitle.textContent = payload.onTime ? "准点抵达极地终点" : "极地线路全线贯通";
  if (elements.victoryMoves) elements.victoryMoves.textContent = `${payload.moves} / ${payload.par} 步`;
  if (elements.victoryTime) elements.victoryTime.textContent = formatTime(payload.elapsedMs);
  if (elements.victoryRoute) elements.victoryRoute.textContent = payload.puzzleTitle;
  if (elements.victoryAwards) {
    elements.victoryAwards.hidden = false;
    elements.victoryAwards.replaceChildren();
    const awards = payload.rewards.length ? payload.rewards : [{ label: "本次奖励已登记，不会重复发放", id: "recorded" }];
    for (const item of awards) {
      const badge = document.createElement("span");
      badge.textContent = item.label;
      elements.victoryAwards.append(badge);
    }
  }
  victoryModal.open(document.activeElement);
}

function renderTutorial() {
  const slide = TUTORIAL_SLIDES[tutorialIndex];
  if (elements.tutorialDialog) elements.tutorialDialog.scrollTop = 0;
  if (elements.tutorialImage) {
    elements.tutorialImage.src = slide.image;
    elements.tutorialImage.alt = slide.title;
  }
  if (elements.tutorialEyebrow) elements.tutorialEyebrow.textContent = slide.eyebrow;
  if (elements.tutorialTitle) elements.tutorialTitle.textContent = slide.title;
  if (elements.tutorialCopy) elements.tutorialCopy.textContent = slide.copy;
  if (elements.tutorialBack) elements.tutorialBack.disabled = tutorialIndex === 0;
  if (elements.tutorialNext) elements.tutorialNext.textContent = tutorialIndex === TUTORIAL_SLIDES.length - 1 ? "开始铺轨" : "下一张";
  elements.tutorialDialog?.style.setProperty("--tutorial-progress", String((tutorialIndex + 1) / TUTORIAL_SLIDES.length));
  for (const [index, dot] of [...document.querySelectorAll("[data-tutorial-dot]")].entries()) {
    const active = index === tutorialIndex;
    dot.classList.toggle("is-active", active);
    dot.setAttribute("aria-label", `第 ${index + 1} 步${active ? "，当前步骤" : ""}`);
  }
}

function openTutorial(source = null) {
  tutorialIndex = 0;
  renderTutorial();
  tutorialModal.open(source);
}

const tutorialModal = createModalController(elements.tutorialDialog, {
  focusTarget: () => elements.tutorialClose,
  onClosed: markTutorialSeen,
});
const rulesModal = createModalController(elements.rulesDialog, { focusTarget: () => elements.rulesClose });
const victoryModal = createModalController(elements.victoryDialog, { focusTarget: () => elements.victoryNext });

function bindControls() {
  elements.toolButtons?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tool]");
    if (!button || !TOOL_IDS.has(button.dataset.tool)) return;
    state.tool = button.dataset.tool;
    if (state.tool.startsWith("cell-")) clearEdgeAnchor();
    savePreferences();
    renderToolButtons();
    announce(`已选择：${button.querySelector("strong")?.textContent ?? button.textContent.trim()}。`, { toast: false });
  });
  elements.undoButton?.addEventListener("click", undo);
  elements.restartButton?.addEventListener("click", () => startLevel(state.level, { countRestart: true, focusSource: elements.restartButton }));
  elements.newPuzzleButton?.addEventListener("click", nextPuzzle);
  elements.muteButton?.addEventListener("click", () => {
    state.muted = !state.muted;
    savePreferences();
    render({ preserveTrain: true });
    if (!state.muted) playSound("track");
  });
  elements.tutorialButton?.addEventListener("click", () => openTutorial(elements.tutorialButton));
  elements.footerTutorialButton?.addEventListener("click", () => openTutorial(elements.footerTutorialButton));
  elements.rulesButton?.addEventListener("click", () => rulesModal.open(elements.rulesButton));
  elements.footerRulesButton?.addEventListener("click", () => rulesModal.open(elements.footerRulesButton));
  elements.tutorialBack?.addEventListener("click", () => {
    tutorialIndex = Math.max(0, tutorialIndex - 1);
    renderTutorial();
  });
  elements.tutorialNext?.addEventListener("click", () => {
    if (tutorialIndex < TUTORIAL_SLIDES.length - 1) {
      tutorialIndex += 1;
      renderTutorial();
    } else tutorialModal.close("complete");
  });
  elements.tutorialSkip?.addEventListener("click", () => tutorialModal.close("skip"));
  elements.tutorialClose?.addEventListener("click", () => tutorialModal.close("close"));
  elements.rulesClose?.addEventListener("click", () => rulesModal.close("close"));
  elements.victoryStay?.addEventListener("click", () => victoryModal.close("stay"));
  elements.victoryNext?.addEventListener("click", () => {
    victoryModal.close("next");
    nextPuzzle();
  });
  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || isTypingTarget(event.target) || document.querySelector("dialog[open]")) return;
    const key = event.key.toLowerCase();
    const commandUndo = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && key === "z";
    if ((event.metaKey || event.ctrlKey || event.altKey) && !commandUndo) return;
    const boardFocus = event.target?.dataset?.cellKey
      ? parseCellKey(event.target.dataset.cellKey)
      : null;
    const toolByKey = { "1": "edge-track", "2": "edge-excluded", "3": "cell-candidate", "4": "cell-excluded" };
    if (toolByKey[event.key]) {
      state.tool = toolByKey[event.key];
      if (state.tool.startsWith("cell-")) clearEdgeAnchor();
      savePreferences();
      renderToolButtons();
      event.preventDefault();
      return;
    }
    if (commandUndo) {
      event.preventDefault();
      undo();
      if (boardFocus) focusCell(boardFocus);
    } else if (key === "z") {
      undo();
      if (boardFocus) focusCell(boardFocus);
    } else if (key === "r") {
      startLevel(state.level, { countRestart: true });
      if (boardFocus) focusCell({ x: 0, y: state.level.entryRow });
    } else if (key === "n") {
      nextPuzzle();
      if (boardFocus) focusCell({ x: 0, y: state.level.entryRow });
    } else if (key === "m") {
      elements.muteButton?.click();
      if (boardFocus) focusCell(boardFocus);
    }
    else if (key === "t") openTutorial(document.activeElement);
  });
}

function exposeApi() {
  const api = Object.freeze({
    version: 1,
    gameId: "polar-railway",
    completionEvent: COMPLETION_EVENT,
    getState: () => Object.freeze({
      puzzleId: state.level.id,
      difficulty: state.difficulty,
      board: serializeBoardState(state.board),
      completed: state.completed,
      elapsedMs: currentElapsedMs(),
      attemptId: state.attempt.id,
    }),
    getRecords: () => structuredClone(state.records),
    openTutorial: () => openTutorial(document.activeElement),
    choosePuzzle: (puzzleId) => {
      const level = findLevel(puzzleId);
      if (!level) return false;
      startLevel(level);
      return true;
    },
    restart: () => startLevel(state.level, { countRestart: true }),
    verifyCurrentPuzzle: () => {
      const proof = countSolutions(state.level, 2);
      return Object.freeze({ count: proof.count, truncated: proof.truncated, nodes: proof.nodes });
    },
  });
  Object.defineProperty(window, "PolarRailway", { value: api, configurable: true });
  window.dispatchEvent(new CustomEvent("ten-realms-v2:game-ready", {
    detail: Object.freeze({ schema: "ten-realms-v2.game-ready", version: 1, gameId: "polar-railway", api }),
  }));
}

function initialise() {
  const loaded = loadSavedGame();
  state = loaded.state;
  focusedCell = cellKey(0, state.level.entryRow);
  bindControls();
  const evaluation = render();
  exposeApi();
  const restoredAttempt = state.attempt;
  const restoredLevelId = state.level.id;
  if (state.completed) {
    if (!state.attempt.recorded || (!state.attempt.reported && !state.attempt.pendingCompletion)) {
      const completedAt = state.attempt.completedAt ?? new Date().toISOString();
      state.attempt.completedAt = completedAt;
      settleCompletion(evaluation, completedAt);
    } else if (!state.attempt.reported) {
      retryPendingCompletion();
    }
    if (state.attempt === restoredAttempt && state.level.id === restoredLevelId && state.completed) {
      render({ preserveTrain: true });
      animateTrain(evaluation.route);
    }
  }
  if (loaded.invalid) announce("旧存档已损坏，已安全回到新题面。", { assertive: true });
  else if (loaded.restored) announce("已恢复上次极地调度进度。", { toast: false });
  timerHandle = window.setInterval(() => {
    if (elements.timerValue) elements.timerValue.textContent = formatTime(currentElapsedMs());
  }, 1000);
  if (elements.timerValue) elements.timerValue.textContent = formatTime(currentElapsedMs());
  if (!tutorialWasSeen()) requestAnimationFrame(() => openTutorial(document.body));
}

window.addEventListener("pagehide", () => {
  cancelVictorySchedule({ closeDialog: false });
  if (!state.completed) {
    state.attempt.elapsedBeforeMs = currentElapsedMs();
    state.attempt.startedAt = Date.now();
  }
  saveGame();
  window.clearInterval(timerHandle);
});

initialise();
