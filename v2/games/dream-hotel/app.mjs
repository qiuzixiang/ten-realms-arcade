import {
  TOOL_TYPES,
  analyzeBoard,
  analyzeProposal,
  applyTool,
  boardSnapshot,
  cellKey,
  computeRunSummary,
  createGameState,
  normalizeRect,
  rectangleArea,
  rectangleContains,
  recordInvalidAttempt,
  rectKey,
  restartState,
  roomAtCell,
  serializeState,
  undoToSnapshot,
} from "./logic.mjs";
import { LEVELS, getLevel, getLevels, nextLevel } from "./levels.mjs";
import {
  applyCompletionToRecords,
  loadRecords,
  loadSession,
  loadSettings,
  markTutorialSeen,
  saveRecords,
  saveSession,
  saveSettings,
  tutorialSeen,
} from "./storage.mjs";
import {
  createCompletionDetail,
  getCompletionTransport,
  installGameApi,
  publishCompletion,
} from "./completion.mjs";
import { createModalController } from "./modal-controller.mjs";
import { createVictoryScheduler } from "./victory-scheduler.mjs";

const MAX_HISTORY = 80;
const DIFFICULTY_META = Object.freeze({
  easy: Object.freeze({ label: "浅梦", size: "5 × 5" }),
  medium: Object.freeze({ label: "叠梦", size: "7 × 7" }),
  hard: Object.freeze({ label: "深梦", size: "9 × 9" }),
});
const TOOL_META = Object.freeze({
  room: Object.freeze({ label: "成房", symbol: "◇" }),
  candidate: Object.freeze({ label: "候选", symbol: "?" }),
  exclude: Object.freeze({ label: "排除", symbol: "×" }),
});
const DREAM_SCENES = Object.freeze([
  Object.freeze({ name: "月湾", glyph: "☾", color: "#9d7be7" }),
  Object.freeze({ name: "云池", glyph: "☁", color: "#7bd8cf" }),
  Object.freeze({ name: "星野", glyph: "✦", color: "#e6bd70" }),
  Object.freeze({ name: "花钟", glyph: "✾", color: "#cf84b6" }),
  Object.freeze({ name: "潮声", glyph: "≋", color: "#7d9ae8" }),
  Object.freeze({ name: "森歌", glyph: "▲", color: "#8fe2b2" }),
  Object.freeze({ name: "雪灯", glyph: "✲", color: "#d4e1ff" }),
  Object.freeze({ name: "晨羽", glyph: "⌑", color: "#e6a989" }),
]);
const TUTORIAL_CARDS = Object.freeze([
  Object.freeze({
    image: "./assets/tutorial-elements.svg",
    alt: "数字旅客与梦境格子的真实棋盘示意图",
    tag: "01 · 旅客需求",
    title: "数字就是房间面积",
    body: "每个数字代表一位旅客。数字 6 需要一间恰好占 6 格的矩形客房。",
    bullets: ["数字可以在客房内任意位置", "每间客房必须恰含一个数字"],
  }),
  Object.freeze({
    image: "./assets/tutorial-action.svg",
    alt: "从起点拖到终点并预览三乘二客房的操作示意图",
    tag: "02 · 规划操作",
    title: "拖动，先预览再成房",
    body: "从任意起点拖到终点，四个方向都可以。预览会显示宽、高、面积和错误原因；松手才正式提交。",
    bullets: ["实线是客房，虚线与 × 只是笔记", "轻点已有客房可以拆除"],
  }),
  Object.freeze({
    image: "./assets/tutorial-goal.svg",
    alt: "六间矩形客房无缝覆盖整层楼的通关示意图",
    tag: "03 · 整层好梦",
    title: "无重叠，也不留一格空白",
    body: "每个房间恰含一个数字、面积等于数字，并且所有格子都被恰好覆盖一次，整层楼才会开门。",
    bullets: ["候选与排除笔记不会影响通关", "正式题均由求解器证明唯一解"],
  }),
]);

const $ = (selector) => document.querySelector(selector);
const elements = Object.freeze({
  board: $("#game-board"),
  boardSummary: $("#board-summary"),
  floorStage: $("#floor-stage"),
  levelTitle: $("#level-title"),
  levelSubtitle: $("#level-subtitle"),
  difficultyLabel: $("#difficulty-label"),
  levelSeed: $("#level-seed"),
  saveIndicator: $("#save-indicator"),
  statusStrip: $("#status-strip"),
  statusSymbol: $("#status-symbol"),
  statusTitle: $("#status-title"),
  statusCopy: $("#status-copy"),
  progressPercent: $("#progress-percent"),
  progressBar: $(".progress-track"),
  progressFill: $("#progress-fill"),
  roomCount: $("#room-count"),
  roomTotal: $("#room-total"),
  uncoveredCount: $("#uncovered-count"),
  moveCount: $("#move-count"),
  timeCount: $("#time-count"),
  undoButton: $("#undo-button"),
  restartButton: $("#restart-button"),
  nextButton: $("#next-button"),
  muteButton: $("#mute-button"),
  soundIcon: $("[data-sound-icon]"),
  tutorialButton: $("#tutorial-button"),
  rulesButton: $("#rules-button"),
  footerRulesButton: $("#footer-rules-button"),
  tutorialDialog: $("#tutorial-dialog"),
  tutorialSkip: $("#tutorial-skip"),
  tutorialPrevious: $("#tutorial-previous"),
  tutorialNext: $("#tutorial-next"),
  tutorialImage: $("#tutorial-image"),
  tutorialTag: $("#tutorial-tag"),
  tutorialTitle: $("#tutorial-title"),
  tutorialBody: $("#tutorial-body"),
  tutorialBullets: $("#tutorial-bullets"),
  tutorialCounter: $("#tutorial-counter"),
  tutorialDots: $("#tutorial-dots"),
  rulesDialog: $("#rules-dialog"),
  rulesClose: $("#rules-close"),
  victoryDialog: $("#victory-dialog"),
  victoryStars: $("#victory-stars"),
  victoryCopy: $("#victory-copy"),
  victoryMoves: $("#victory-moves"),
  victoryTypes: $("#victory-types"),
  victoryTime: $("#victory-time"),
  victoryRewards: $("#victory-rewards"),
  victoryStay: $("#victory-stay"),
  victoryNext: $("#victory-next"),
  roomTypeList: $("#room-type-list"),
  typeCount: $("#type-count"),
  overallRating: $("#overall-rating"),
  completionTotal: $("#completion-total"),
  achievementList: $("#achievement-list"),
  toast: $("#toast"),
  politeLive: $("#polite-live"),
  alertLive: $("#alert-live"),
  toolButtons: [...document.querySelectorAll("[data-tool]")],
  difficultyButtons: [...document.querySelectorAll("[data-difficulty]")],
});

const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();
const settings = loadSettings(storage);
let records = loadRecords(storage);
const restored = loadSession(storage, getLevel);
const initialLevel = restored?.level
  ?? getLevel(settings.lastLevelId)
  ?? getLevels(settings.difficulty)[0]
  ?? LEVELS[0];
const restoredAnalysis = restored ? analyzeBoard(restored.level, restored.game) : null;

function createRunId() {
  try {
    if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
  } catch {
    // A timestamp/random fallback still keeps separate local playthroughs distinct.
  }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

const state = {
  level: initialLevel,
  runId: restored?.runId ?? createRunId(),
  game: restored?.game ?? createGameState(),
  history: restored?.history ?? [],
  tool: restored?.tool ?? TOOL_TYPES.ROOM,
  cursor: restored?.cursor ?? { x: initialLevel.clues[0].x, y: initialLevel.clues[0].y },
  selection: null,
  pointerId: null,
  muted: settings.muted,
  completed: Boolean(restoredAnalysis?.solved),
  completionReported: Boolean(restoredAnalysis?.solved && restored?.completion?.delivered),
  completion: restoredAnalysis?.solved ? restored?.completion ?? null : null,
  elapsedBase: restored?.elapsedMs ?? 0,
  startedAt: performance.now(),
  finishedElapsed: restoredAnalysis?.solved ? restored.elapsedMs : null,
  tutorialIndex: 0,
  storageAvailable: Boolean(storage),
  generation: 1,
};

let audioContext = null;
let toastTimer = 0;
let statusTimer = 0;
let errorAnimationTimer = 0;

const tutorialController = createModalController({
  dialog: elements.tutorialDialog,
  initialFocus: () => elements.tutorialNext,
});
const rulesController = createModalController({
  dialog: elements.rulesDialog,
  initialFocus: () => elements.rulesClose,
});
const victoryController = createModalController({
  dialog: elements.victoryDialog,
  initialFocus: () => elements.victoryNext,
  dismissOnBackdrop: false,
});
const victoryScheduler = createVictoryScheduler({
  readContext: () => ({
    generation: state.generation,
    levelId: state.level.id,
    completed: state.completed,
  }),
  onShow: ({ summary, recordResult, duration }) => showVictory(summary, recordResult, duration),
});

function elapsedMs() {
  if (state.finishedElapsed !== null) return state.finishedElapsed;
  return state.elapsedBase + Math.max(0, performance.now() - state.startedAt);
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function hashIndex(text, length) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash, 31) + text.charCodeAt(index);
  return Math.abs(hash) % length;
}

function sceneFor(room) {
  return DREAM_SCENES[hashIndex(`${state.level.id}:${rectKey(room)}`, DREAM_SCENES.length)];
}

function openDialogs() {
  return [...document.querySelectorAll("dialog[open]")];
}

function announce(message, assertive = false) {
  const target = assertive ? elements.alertLive : elements.politeLive;
  target.textContent = "";
  requestAnimationFrame(() => { target.textContent = message; });
}

function showToast(message, { assertive = false } = {}) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  announce(message, assertive);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function setStatus(tone, title, copy, symbol = TOOL_META[state.tool].symbol, { temporary = false } = {}) {
  clearTimeout(statusTimer);
  elements.statusStrip.dataset.tone = tone;
  elements.statusSymbol.textContent = symbol;
  elements.statusTitle.textContent = title;
  elements.statusCopy.textContent = copy;
  if (temporary) {
    announce(`${title}。${copy}`, tone === "error");
    statusTimer = window.setTimeout(renderDefaultStatus, 2600);
  }
}

function renderDefaultStatus() {
  const analysis = analyzeBoard(state.level, state.game);
  if (state.completed) {
    setStatus("success", "整层已经进入好梦", "本层已锁定；可换一层继续收集梦境房型。", "✦");
  } else if (state.selection?.end) {
    const rect = normalizeRect(state.selection.start, state.selection.end);
    const proposal = analyzeProposal(state.level, state.game, rect, state.tool);
    const label = previewLabel(rect, proposal);
    setStatus(proposal.valid ? "calm" : "error", `${TOOL_META[state.tool].label}预览 · ${label.short}`, label.long, proposal.valid ? TOOL_META[state.tool].symbol : "!");
  } else if (state.game.rooms.length === 0) {
    setStatus("calm", "等待第一间客房", `选择“${TOOL_META[state.tool].label}”，从一个格子拖到另一个格子。`, TOOL_META[state.tool].symbol);
  } else {
    const remaining = analysis.uncoveredCells.length;
    setStatus("calm", `已有 ${state.game.rooms.length} 间客房安睡`, `还剩 ${remaining} 格待规划；候选与排除记号不会影响完成。`, "◇");
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

function tone(frequency, duration, { delay = 0, gain = 0.018, type = "sine", endFrequency } = {}) {
  const context = ensureAudio();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.025, duration / 3));
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSound(effect) {
  if (state.muted) return;
  if (effect === "room") {
    tone(392, 0.17, { endFrequency: 587, gain: 0.017 });
    tone(784, 0.22, { delay: 0.045, gain: 0.008 });
  } else if (effect === "note") {
    tone(660, 0.08, { type: "triangle", gain: 0.009 });
  } else if (effect === "remove") {
    tone(430, 0.14, { endFrequency: 260, type: "triangle", gain: 0.013 });
  } else if (effect === "undo") {
    tone(520, 0.15, { endFrequency: 390, gain: 0.012 });
  } else if (effect === "error") {
    tone(180, 0.16, { endFrequency: 135, type: "sawtooth", gain: 0.012 });
  } else if (effect === "complete") {
    [392, 493.88, 587.33, 783.99].forEach((frequency, index) => {
      tone(frequency, 0.65, { delay: index * 0.12, gain: 0.017 - index * 0.0015 });
    });
  }
}

function saveCurrentSession() {
  const success = saveSession(storage, {
    level: state.level,
    runId: state.runId,
    game: state.game,
    history: state.history,
    tool: state.tool,
    cursor: state.cursor,
    elapsedMs: Math.floor(elapsedMs()),
    completion: state.completion,
  });
  state.storageAvailable = success;
  elements.saveIndicator.dataset.error = String(!success);
  elements.saveIndicator.querySelector("small").textContent = success ? "本机自动留档" : "本机留档暂不可用";
  return success;
}

function saveCurrentSettings() {
  saveSettings(storage, {
    muted: state.muted,
    difficulty: state.level.difficulty,
    lastLevelId: state.level.id,
  });
}

function gridPlacement(element, rect) {
  element.style.gridColumn = `${rect.x + 1} / span ${rect.width}`;
  element.style.gridRow = `${rect.y + 1} / span ${rect.height}`;
}

function cellLabel(x, y, clue, analysis) {
  const room = roomAtCell(state.game, { x, y });
  const parts = [`第 ${y + 1} 行第 ${x + 1} 列`];
  if (clue) parts.push(`旅客数字 ${clue.value}`);
  else parts.push("空格");
  if (room) parts.push(`已属于 ${room.width} × ${room.height} 客房`);
  if (state.game.excluded.has(cellKey(x, y))) parts.push("有排除笔记");
  if (analysis.overlapCells.some((cell) => cell.x === x && cell.y === y)) parts.push("当前重叠");
  return parts.join("，");
}

function renderBoard() {
  const { level } = state;
  const analysis = analyzeBoard(level, state.game);
  const fragment = document.createDocumentFragment();
  elements.board.textContent = "";
  elements.board.style.setProperty("--cols", level.width);
  elements.board.style.setProperty("--rows", level.height);
  elements.board.setAttribute("aria-label", `梦境旅舍楼层，${level.width} 列 ${level.height} 行`);
  elements.board.setAttribute("aria-activedescendant", `cell-${state.cursor.x}-${state.cursor.y}`);
  elements.board.setAttribute("aria-disabled", String(state.completed));
  elements.board.classList.toggle("is-complete", state.completed);

  for (let y = 0; y < level.height; y += 1) {
    const row = document.createElement("div");
    row.className = "grid-row";
    row.setAttribute("role", "row");
    for (let x = 0; x < level.width; x += 1) {
      const clue = level.clues.find((item) => item.x === x && item.y === y);
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      if (clue) cell.classList.add("has-clue");
      if (state.game.excluded.has(cellKey(x, y))) cell.classList.add("is-excluded", "has-note");
      if (roomAtCell(state.game, { x, y })) cell.classList.add("is-covered");
      cell.id = `cell-${x}-${y}`;
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      gridPlacement(cell, { x, y, width: 1, height: 1 });
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", cellLabel(x, y, clue, analysis));
      cell.setAttribute("aria-selected", String(x === state.cursor.x && y === state.cursor.y));
      if (clue) {
        const badge = document.createElement("span");
        badge.className = "clue";
        badge.textContent = String(clue.value);
        badge.setAttribute("aria-hidden", "true");
        cell.append(badge);
      }
      row.append(cell);
    }
    fragment.append(row);
  }

  state.game.rooms.forEach((room) => {
    const scene = sceneFor(room);
    const layer = document.createElement("div");
    layer.className = "room-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.style.setProperty("--scene", scene.color);
    gridPlacement(layer, room);
    const glyph = document.createElement("span");
    glyph.className = "room-scene";
    glyph.textContent = scene.glyph;
    const caption = document.createElement("small");
    caption.className = "room-caption";
    caption.textContent = `${scene.name} · ${room.width}×${room.height}`;
    layer.append(glyph, caption);
    fragment.append(layer);
  });

  state.game.candidates.forEach((candidate) => {
    const layer = document.createElement("div");
    layer.className = "candidate-layer";
    layer.setAttribute("aria-hidden", "true");
    gridPlacement(layer, candidate);
    fragment.append(layer);
  });

  if (state.selection?.end) {
    const rect = normalizeRect(state.selection.start, state.selection.end);
    const proposal = analyzeProposal(level, state.game, rect, state.tool);
    const label = previewLabel(rect, proposal);
    const preview = document.createElement("div");
    preview.className = "selection-preview";
    preview.dataset.tool = state.tool;
    preview.dataset.valid = String(proposal.valid);
    preview.setAttribute("aria-hidden", "true");
    gridPlacement(preview, rect);
    const text = document.createElement("span");
    text.className = "preview-label";
    text.textContent = label.short;
    preview.append(text);
    fragment.append(preview);
  }

  const cursor = document.createElement("div");
  cursor.className = "keyboard-cursor";
  cursor.setAttribute("aria-hidden", "true");
  gridPlacement(cursor, { x: state.cursor.x, y: state.cursor.y, width: 1, height: 1 });
  fragment.append(cursor);
  elements.board.append(fragment);

  const percentage = Math.round((analysis.coveredCount / (level.width * level.height)) * 100);
  elements.boardSummary.textContent = `已完成 ${state.game.rooms.length} 间客房，覆盖 ${analysis.coveredCount} 格，还剩 ${analysis.uncoveredCells.length} 格。`;
  elements.progressPercent.textContent = `${percentage}%`;
  elements.progressFill.style.width = `${percentage}%`;
  elements.progressBar.setAttribute("aria-valuenow", String(percentage));
  elements.roomCount.textContent = String(state.game.rooms.length);
  elements.roomTotal.textContent = `/ ${level.clues.length}`;
  elements.uncoveredCount.textContent = String(analysis.uncoveredCells.length);
  elements.moveCount.textContent = String(state.game.metrics.moves);
  elements.undoButton.disabled = state.history.length === 0 || state.completed;
}

function renderHeader() {
  const levels = getLevels(state.level.difficulty);
  const levelIndex = Math.max(0, levels.findIndex((level) => level.id === state.level.id));
  elements.difficultyLabel.textContent = DIFFICULTY_META[state.level.difficulty].label;
  elements.levelSeed.textContent = `${String(levelIndex + 1).padStart(2, "0")} 号梦钥`;
  elements.levelTitle.textContent = state.level.title;
  elements.levelSubtitle.textContent = state.level.subtitle;
  elements.toolButtons.forEach((button) => {
    const active = button.dataset.tool === state.tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.difficultyButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.level.difficulty));
  });
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "开启声音" : "静音");
  elements.soundIcon.textContent = state.muted ? "×" : "♪";
}

function renderRecords() {
  const roomTypes = Object.keys(records.roomTypes).sort((left, right) => left.localeCompare(right, "zh-CN"));
  elements.typeCount.textContent = `${roomTypes.length} 型`;
  elements.roomTypeList.textContent = "";
  if (roomTypes.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-record";
    empty.textContent = "尚未收录";
    elements.roomTypeList.append(empty);
  } else {
    roomTypes.forEach((type) => {
      const item = document.createElement("span");
      item.textContent = type;
      item.title = `已在 ${records.roomTypes[type].count} 次通关中使用`;
      elements.roomTypeList.append(item);
    });
  }

  const ratings = Object.values(records.bestRatings);
  const average = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
  const rounded = Math.round(average);
  elements.overallRating.textContent = `${"★".repeat(rounded)}${"☆".repeat(3 - rounded)}`;
  elements.overallRating.setAttribute("aria-label", ratings.length ? `旅舍平均 ${average.toFixed(1)} 星` : "尚无评级");
  elements.completionTotal.textContent = records.completionCount > 0
    ? `${records.completionCount} 层已迎客`
    : "尚待第一层开门";

  const achievementState = {
    "first-draw": Object.keys(records.achievements).some((id) => id.startsWith("first-draw:")),
    "no-rework": Object.keys(records.achievements).some((id) => id.startsWith("no-rework:")),
    rating: ratings.some((rating) => rating >= 3),
  };
  elements.achievementList.querySelectorAll("li").forEach((item) => {
    const unlocked = achievementState[item.dataset.achievement];
    item.classList.toggle("is-unlocked", unlocked);
    item.querySelector("em").textContent = unlocked ? "已解锁" : "待解锁";
  });
}

function render() {
  renderHeader();
  renderBoard();
  renderRecords();
  elements.timeCount.textContent = formatTime(elapsedMs());
  renderDefaultStatus();
}

function previewLabel(rect, proposal) {
  const size = `${rect.width} × ${rect.height} = ${rectangleArea(rect)}`;
  if (state.tool === TOOL_TYPES.CANDIDATE) return { short: `${size} · 候选`, long: "松手可添加或移除这张虚线候选框。" };
  if (state.tool === TOOL_TYPES.EXCLUDE) return { short: `${rect.width} × ${rect.height} · 排除`, long: "松手可为选中格添加或清除 × 笔记。" };
  if (proposal.action === "remove") return { short: `拆除 ${proposal.rect.width} × ${proposal.rect.height}`, long: "松手将拆除这间客房；可用撤销恢复。" };
  if (proposal.valid) return { short: `${size} · 可成房`, long: `面积 ${rectangleArea(rect)} 与旅客数字完全相等，且没有重叠。` };
  const messages = {
    "missing-clue": "框内没有旅客数字；每间房必须恰含一个数字。",
    "multiple-clues": "框内有多位旅客；每间房只能包含一个数字。",
    "wrong-area": `当前面积是 ${rectangleArea(rect)}，与框内旅客所需面积不相等。`,
    overlap: "这里与已完成客房重叠；原有边界不会被覆盖。",
    "out-of-bounds": "预览已超出旅舍楼层。",
  };
  return { short: `${size} · 不可成房`, long: messages[proposal.reason] ?? "这个矩形暂时不能提交。" };
}

function setTool(tool, { focusBoard = false } = {}) {
  if (!Object.values(TOOL_TYPES).includes(tool) || state.completed) return false;
  cancelSelection();
  state.tool = tool;
  renderHeader();
  renderDefaultStatus();
  saveCurrentSession();
  playSound("note");
  if (focusBoard) elements.board.focus({ preventScroll: true });
  return true;
}

function cursorTo(point, { announceCell = false } = {}) {
  state.cursor = {
    x: Math.max(0, Math.min(state.level.width - 1, point.x)),
    y: Math.max(0, Math.min(state.level.height - 1, point.y)),
  };
  renderBoard();
  if (announceCell) {
    const cell = $(`#cell-${state.cursor.x}-${state.cursor.y}`);
    if (cell) announce(cell.getAttribute("aria-label"));
  }
}

function cancelSelection({ renderNow = true } = {}) {
  if (!state.selection) return false;
  state.selection = null;
  state.pointerId = null;
  if (renderNow) {
    renderBoard();
    renderDefaultStatus();
  }
  return true;
}

function clearPendingVictory() {
  victoryScheduler.cancel();
}

function flashBoardError() {
  clearTimeout(errorAnimationTimer);
  elements.board.classList.remove("is-error");
  requestAnimationFrame(() => elements.board.classList.add("is-error"));
  errorAnimationTimer = window.setTimeout(() => elements.board.classList.remove("is-error"), 320);
}

function commitRectangle(rect) {
  if (state.completed) return false;
  const before = boardSnapshot(state.game);
  const result = applyTool(state.level, state.game, rect, state.tool);
  if (!result.changed) {
    if (state.tool === TOOL_TYPES.ROOM) {
      state.game = recordInvalidAttempt(state.game, result.reason).state;
      const label = previewLabel(rect, result.proposal ?? { valid: false, reason: result.reason });
      render();
      setStatus("error", "这间客房不能成立", label.long, "!", { temporary: true });
      flashBoardError();
      playSound("error");
      saveCurrentSession();
    }
    return false;
  }
  state.history.push(before);
  state.history = state.history.slice(-MAX_HISTORY);
  state.game = result.state;
  state.selection = null;
  state.pointerId = null;
  render();
  if (result.action === "place") {
    const scene = sceneFor(result.rect);
    setStatus("success", `${scene.name}客房已经成形`, `${result.rect.width} × ${result.rect.height}，面积 ${rectangleArea(result.rect)}；边界清晰且没有重叠。`, "◇", { temporary: true });
    playSound("room");
  } else if (result.action === "remove") {
    setStatus("calm", "客房已拆除", "这次返工已记录；撤销可以恢复原来的边界。", "↺", { temporary: true });
    playSound("remove");
  } else {
    setStatus("calm", "笔记已更新", "候选与排除记号不会参与完成判定。", TOOL_META[state.tool].symbol, { temporary: true });
    playSound("note");
  }
  if (!checkCompletion()) saveCurrentSession();
  return true;
}

function pointForCell(cell) {
  if (!cell) return null;
  const point = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
  return Number.isInteger(point.x) && Number.isInteger(point.y) ? point : null;
}

function cellFromPointer(event) {
  const bounds = elements.board.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX >= bounds.right
      || event.clientY < bounds.top || event.clientY >= bounds.bottom) return null;

  const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".grid-cell");
  if (hit && elements.board.contains(hit)) return pointForCell(hit);

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const cell of elements.board.querySelectorAll(".grid-cell")) {
    const rect = cell.getBoundingClientRect();
    const dx = event.clientX < rect.left
      ? rect.left - event.clientX
      : event.clientX > rect.right ? event.clientX - rect.right : 0;
    const dy = event.clientY < rect.top
      ? rect.top - event.clientY
      : event.clientY > rect.bottom ? event.clientY - rect.bottom : 0;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearest = cell;
      nearestDistance = distance;
    }
  }
  return pointForCell(nearest);
}

function onPointerDown(event) {
  if (state.completed
      || openDialogs().length
      || state.pointerId !== null
      || event.isPrimary === false
      || event.button !== 0) return;
  const point = cellFromPointer(event);
  if (!point) return;
  event.preventDefault();
  elements.board.focus({ preventScroll: true });
  state.cursor = point;
  state.selection = { start: point, end: point, source: "pointer" };
  state.pointerId = event.pointerId;
  elements.board.setPointerCapture?.(event.pointerId);
  renderBoard();
  renderDefaultStatus();
}

function onPointerMove(event) {
  if (state.pointerId !== event.pointerId || state.selection?.source !== "pointer") return;
  event.preventDefault();
  const point = cellFromPointer(event);
  const changed = point?.x !== state.selection.end?.x || point?.y !== state.selection.end?.y;
  if (!point && state.selection.end) {
    state.selection.end = null;
    renderBoard();
    setStatus("error", "已离开楼层", "回到棋盘可继续预览；在楼层外松手会取消。", "!");
  } else if (point && changed) {
    state.selection.end = point;
    state.cursor = point;
    renderBoard();
    renderDefaultStatus();
  }
}

function onPointerUp(event) {
  if (state.pointerId !== event.pointerId || state.selection?.source !== "pointer") return;
  event.preventDefault();
  const point = cellFromPointer(event);
  const selection = state.selection;
  state.selection = null;
  state.pointerId = null;
  try { elements.board.releasePointerCapture?.(event.pointerId); } catch { /* capture may already be lost */ }
  if (!point || !selection.end) {
    render();
    setStatus("calm", "本次拖动已取消", "请在旅舍楼层内松手提交。", "×", { temporary: true });
    return;
  }
  commitRectangle(normalizeRect(selection.start, point));
}

function onPointerCancel(event) {
  if (state.pointerId !== event.pointerId) return;
  cancelSelection();
  setStatus("calm", "本次拖动已取消", "棋盘没有发生变化。", "×", { temporary: true });
}

function beginOrCommitKeyboardSelection() {
  if (state.completed) return;
  if (!state.selection) {
    state.selection = { start: { ...state.cursor }, end: { ...state.cursor }, source: "keyboard" };
    renderBoard();
    renderDefaultStatus();
    announce(`已从第 ${state.cursor.y + 1} 行第 ${state.cursor.x + 1} 列开始${TOOL_META[state.tool].label}。`);
    return;
  }
  if (state.selection.source !== "keyboard" || !state.selection.end) return;
  const rect = normalizeRect(state.selection.start, state.selection.end);
  state.selection = null;
  commitRectangle(rect);
}

function removeAtCursor() {
  if (state.completed) return false;
  let rect = null;
  if (state.tool === TOOL_TYPES.ROOM) rect = roomAtCell(state.game, state.cursor);
  else if (state.tool === TOOL_TYPES.CANDIDATE) {
    rect = [...state.game.candidates].reverse().find((candidate) => rectangleContains(candidate, state.cursor)) ?? null;
  } else if (state.game.excluded.has(cellKey(state.cursor))) {
    rect = { x: state.cursor.x, y: state.cursor.y, width: 1, height: 1 };
  }
  return rect ? commitRectangle(rect) : false;
}

function undo() {
  if (state.completed || state.history.length === 0) return false;
  clearPendingVictory();
  const snapshot = state.history.pop();
  const result = undoToSnapshot(state.game, snapshot, state.level);
  if (!result.changed) return false;
  state.game = result.state;
  state.selection = null;
  render();
  setStatus("calm", "已撤销上一步", "棋盘与笔记已恢复；本次返工仍会计入旅舍评级。", "↶", { temporary: true });
  playSound("undo");
  saveCurrentSession();
  return true;
}

function restart() {
  clearPendingVictory();
  state.generation += 1;
  state.runId = createRunId();
  if (victoryController.isOpen()) victoryController.close("restart");
  if (state.selection) cancelSelection({ renderNow: false });
  state.game = restartState(state.game);
  state.history = [];
  state.completed = false;
  state.completionReported = false;
  state.completion = null;
  state.finishedElapsed = null;
  state.elapsedBase = 0;
  state.startedAt = performance.now();
  state.cursor = { x: state.level.clues[0].x, y: state.level.clues[0].y };
  render();
  setStatus("calm", "本层已重新开门", "客房与笔记已清空；重开会计入返工记录。", "↺", { temporary: true });
  playSound("undo");
  saveCurrentSession();
}

function startLevel(level, message = "新的梦钥已经转动") {
  if (!level) return false;
  clearPendingVictory();
  state.generation += 1;
  state.runId = createRunId();
  if (victoryController.isOpen()) victoryController.close("new-level");
  state.level = level;
  state.game = createGameState();
  state.history = [];
  state.selection = null;
  state.pointerId = null;
  state.cursor = { x: level.clues[0].x, y: level.clues[0].y };
  state.completed = false;
  state.completionReported = false;
  state.completion = null;
  state.elapsedBase = 0;
  state.startedAt = performance.now();
  state.finishedElapsed = null;
  saveCurrentSettings();
  render();
  setStatus("calm", message, `${level.title} · ${level.width} × ${level.height}，唯一解已由求解器证明。`, "✦", { temporary: true });
  saveCurrentSession();
  return true;
}

function chooseNextLevel() {
  return startLevel(nextLevel(state.level.id, state.level.difficulty));
}

function setDifficulty(difficulty) {
  if (!DIFFICULTY_META[difficulty]) return false;
  const level = getLevels(difficulty)[0];
  return startLevel(level, `已进入${DIFFICULTY_META[difficulty].label}`);
}

function rewardLabel(id) {
  if (id.startsWith("clear:")) return "首次迎客";
  if (id.startsWith("catalog:")) return `新房型 ${id.split(":").at(-1)}`;
  if (id.startsWith("first-draw:")) return "一次成房";
  if (id.startsWith("no-rework:")) return "无返工规划";
  if (id.startsWith("rating:")) return `${id.split(":").at(-1)} 星评级里程碑`;
  return id;
}

function showVictory(summary, recordResult, duration) {
  elements.victoryStars.innerHTML = `${"★".repeat(summary.rating)}<span class="is-empty">${"☆".repeat(3 - summary.rating)}</span>`;
  elements.victoryStars.setAttribute("aria-label", `本次评级 ${summary.rating} 星`);
  elements.victoryCopy.textContent = summary.noRework
    ? "每位旅客都一次入住成功，整层楼没有返工，也没有一格被遗忘。"
    : summary.oneStroke
      ? "每次框选都准确成房；虽然调整过规划，最终整层楼依然严丝合缝。"
      : "所有客房现已无缝覆盖。下一把梦钥里，还藏着更稀有的房型。";
  elements.victoryMoves.textContent = `${summary.moves} 次`;
  elements.victoryTypes.textContent = recordResult.unlockedRoomTypes.length
    ? `${recordResult.unlockedRoomTypes.length} 型`
    : "已收录";
  elements.victoryTime.textContent = formatTime(duration);
  elements.victoryRewards.textContent = "";
  const rewards = recordResult.awardedIds.length ? recordResult.awardedIds : ["本次记录已更新"];
  rewards.slice(0, 8).forEach((id) => {
    const item = document.createElement("li");
    item.textContent = id === "本次记录已更新" ? id : rewardLabel(id);
    elements.victoryRewards.append(item);
  });
  victoryController.open(elements.board);
}

function settleCompletion({ presentVictory = false } = {}) {
  const summary = computeRunSummary(state.level, state.game);
  if (!summary) return false;
  state.completed = true;
  state.finishedElapsed ??= Math.floor(elapsedMs());
  state.completion ??= { completedAt: new Date().toISOString(), delivered: false };

  // Persist the pending marker before either local settlement or host delivery.
  // If the page stops between phases, the same run can resume idempotently.
  saveCurrentSession();
  const recordResult = applyCompletionToRecords(records, {
    level: state.level,
    runId: state.runId,
    summary,
    elapsedMs: state.finishedElapsed,
    completedAt: state.completion.completedAt,
  });
  records = recordResult.records;
  const recordsSaved = saveRecords(storage, records);
  const detail = createCompletionDetail({
    level: state.level,
    runId: state.runId,
    summary,
    elapsedMs: state.finishedElapsed,
    rewardIds: recordResult.awardedIds,
    completedAt: state.completion.completedAt,
  });
  const retained = publishCompletion(window, detail);
  const completionTransport = getCompletionTransport(window, detail.eventId);
  const apiDelivered = completionTransport === "native-v2" || completionTransport === "realm-arcade";
  state.completion.delivered = retained && apiDelivered && (recordsSaved || storage === null);
  state.completionReported = state.completion.delivered;
  render();
  saveCurrentSession();
  if (presentVictory) {
    playSound("complete");
    const completedDuration = state.finishedElapsed;
    victoryScheduler.schedule({ summary, recordResult, duration: completedDuration });
  }
  return true;
}

function checkCompletion() {
  if (state.completed || state.completionReported) return false;
  return settleCompletion({ presentVictory: true });
}

function toggleMute() {
  state.muted = !state.muted;
  if (state.muted && audioContext?.state === "running") audioContext.suspend().catch(() => {});
  renderHeader();
  saveCurrentSettings();
  showToast(state.muted ? "旅舍已进入静音时段" : "梦境合成音效已开启");
  if (!state.muted) playSound("note");
}

function renderTutorialCard() {
  const card = TUTORIAL_CARDS[state.tutorialIndex];
  elements.tutorialImage.src = card.image;
  elements.tutorialImage.alt = card.alt;
  elements.tutorialTag.textContent = card.tag;
  elements.tutorialTitle.textContent = card.title;
  elements.tutorialBody.textContent = card.body;
  elements.tutorialBullets.textContent = "";
  card.bullets.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    elements.tutorialBullets.append(item);
  });
  elements.tutorialCounter.textContent = `${state.tutorialIndex + 1} / ${TUTORIAL_CARDS.length}`;
  [...elements.tutorialDots.children].forEach((dot, index) => dot.classList.toggle("is-active", index === state.tutorialIndex));
  elements.tutorialPrevious.disabled = state.tutorialIndex === 0;
  elements.tutorialNext.textContent = state.tutorialIndex === TUTORIAL_CARDS.length - 1 ? "开始规划" : "下一张";
}

function openTutorial(trigger = elements.tutorialButton) {
  if (victoryScheduler.pending()) return false;
  if (openDialogs().length) return false;
  state.tutorialIndex = 0;
  renderTutorialCard();
  return tutorialController.open(trigger);
}

function finishTutorial(reason = "complete") {
  markTutorialSeen(storage);
  tutorialController.close(reason);
}

function openRules(trigger = elements.rulesButton) {
  if (victoryScheduler.pending()) return false;
  if (openDialogs().length) return false;
  return rulesController.open(trigger);
}

function onGlobalKeyDown(event) {
  if (openDialogs().length || event.defaultPrevented || event.isComposing) return;
  const key = event.key;
  const boardFocused = event.target === elements.board || elements.board.contains(event.target);
  const isArrow = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(key);
  if (event.repeat && !isArrow) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (boardFocused && isArrow) {
    event.preventDefault();
    const delta = {
      ArrowUp: { x: 0, y: -1 },
      ArrowRight: { x: 1, y: 0 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
    }[key];
    const point = {
      x: Math.max(0, Math.min(state.level.width - 1, state.cursor.x + delta.x)),
      y: Math.max(0, Math.min(state.level.height - 1, state.cursor.y + delta.y)),
    };
    state.cursor = point;
    if (state.selection?.source === "keyboard") state.selection.end = { ...point };
    renderBoard();
    renderDefaultStatus();
    return;
  }
  if (boardFocused && (key === "Enter" || key === " ")) {
    event.preventDefault();
    beginOrCommitKeyboardSelection();
    return;
  }
  if (key === "Escape" && state.selection) {
    event.preventDefault();
    cancelSelection();
    showToast("已取消矩形预览");
    return;
  }
  if (boardFocused && (key === "Delete" || key === "Backspace")) {
    event.preventDefault();
    removeAtCursor();
    return;
  }
  const target = event.target;
  const isInteractiveTarget = target instanceof Element
    && target !== elements.board
    && Boolean(target.closest("input, textarea, select, button, a, summary, [contenteditable], [role='button'], [role='link']"));
  if (!boardFocused || isInteractiveTarget) return;

  if (key === "f" || key === "F" || key === "1") { event.preventDefault(); setTool(TOOL_TYPES.ROOM, { focusBoard: true }); }
  else if (key === "c" || key === "C" || key === "2") { event.preventDefault(); setTool(TOOL_TYPES.CANDIDATE, { focusBoard: true }); }
  else if (key === "x" || key === "X" || key === "3") { event.preventDefault(); setTool(TOOL_TYPES.EXCLUDE, { focusBoard: true }); }
  else if (key === "z" || key === "Z") { event.preventDefault(); undo(); }
  else if (key === "r" || key === "R") { event.preventDefault(); restart(); }
  else if (key === "n" || key === "N") { event.preventDefault(); chooseNextLevel(); }
  else if (key === "m" || key === "M") { event.preventDefault(); toggleMute(); }
  else if (key === "?" || (key === "/" && event.shiftKey)) { event.preventDefault(); openRules(elements.rulesButton); }
}

elements.board.addEventListener("pointerdown", onPointerDown);
elements.board.addEventListener("pointermove", onPointerMove);
elements.board.addEventListener("pointerup", onPointerUp);
elements.board.addEventListener("pointercancel", onPointerCancel);
elements.board.addEventListener("lostpointercapture", (event) => {
  if (state.pointerId === event.pointerId && state.selection?.source === "pointer") onPointerCancel(event);
});
elements.toolButtons.forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
elements.difficultyButtons.forEach((button) => button.addEventListener("click", () => setDifficulty(button.dataset.difficulty)));
elements.undoButton.addEventListener("click", undo);
elements.restartButton.addEventListener("click", restart);
elements.nextButton.addEventListener("click", chooseNextLevel);
elements.muteButton.addEventListener("click", toggleMute);
elements.tutorialButton.addEventListener("click", () => openTutorial(elements.tutorialButton));
elements.rulesButton.addEventListener("click", () => openRules(elements.rulesButton));
elements.footerRulesButton.addEventListener("click", () => openRules(elements.footerRulesButton));
elements.rulesClose.addEventListener("click", () => rulesController.close("close-button"));
elements.tutorialSkip.addEventListener("click", () => finishTutorial("skip"));
elements.tutorialPrevious.addEventListener("click", () => {
  state.tutorialIndex = Math.max(0, state.tutorialIndex - 1);
  renderTutorialCard();
});
elements.tutorialNext.addEventListener("click", () => {
  if (state.tutorialIndex < TUTORIAL_CARDS.length - 1) {
    state.tutorialIndex += 1;
    renderTutorialCard();
  } else finishTutorial("complete");
});
elements.tutorialDialog.addEventListener("close", () => markTutorialSeen(storage));
elements.victoryStay.addEventListener("click", () => victoryController.close("stay"));
elements.victoryNext.addEventListener("click", () => {
  victoryController.close("next");
  chooseNextLevel();
});
document.addEventListener("keydown", onGlobalKeyDown);

installGameApi(window, {
  getSnapshot: () => ({
    levelId: state.level.id,
    runId: state.runId,
    difficulty: state.level.difficulty,
    completed: state.completed,
    completionDelivered: state.completionReported,
    elapsedMs: Math.floor(elapsedMs()),
    game: serializeState(state.game),
  }),
  getRecords: () => JSON.parse(JSON.stringify(records)),
  openTutorial: () => openTutorial(elements.tutorialButton),
  setDifficulty,
  newPuzzle: chooseNextLevel,
});

render();
saveCurrentSettings();
if (state.completed && !state.completionReported) settleCompletion();
else saveCurrentSession();
window.setInterval(() => {
  if (!state.completed && !document.hidden) elements.timeCount.textContent = formatTime(elapsedMs());
}, 1000);

if (!tutorialSeen(storage)) {
  requestAnimationFrame(() => {
    if (!openDialogs().length) openTutorial(elements.tutorialButton);
  });
}
