import {
  DIFFICULTIES,
  DIRECTIONS,
  LEVELS,
  PORT,
  STATUS,
  applyAction,
  createGame,
  findLevel,
  levelsForDifficulty,
  moduleShape,
  pointOf,
  portsFor,
  restartGame,
  restoreGame,
  serializeGame,
} from "./logic.mjs";
import { createVictoryDialogController } from "./victory-dialog.mjs";

const STORAGE_KEY = "ten-realms.storm-lanterns.save.v1";
const PREFS_KEY = "ten-realms.storm-lanterns.preferences.v1";
const APP_SCHEMA = "storm-lanterns/app-state";
const APP_VERSION = 1;
const HISTORY_LIMIT = 200;
const LONG_PRESS_MS = 480;
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const RING_LENGTH = 358.14;
const SVG_NS = "http://www.w3.org/2000/svg";
const COMPLETION_TIERS = Object.freeze({ easy: 1, medium: 2, hard: 3 });

const $ = (selector) => document.querySelector(selector);
const elements = {
  difficultyButtons: $("#difficulty-buttons"),
  levelCode: $("#level-code"),
  levelName: $("#level-name"),
  levelBrief: $("#level-brief"),
  gridSize: $("#grid-size"),
  poweredCount: $("#powered-count"),
  progressRing: $("#progress-ring"),
  moveCount: $("#move-count"),
  lockCount: $("#lock-count"),
  timeCount: $("#time-count"),
  saveState: $("#save-state"),
  boardShell: $("#board-shell"),
  boardViewport: $("#board-viewport"),
  board: $("#network-board"),
  boardDescription: $("#board-description"),
  selectedReading: $("#selected-reading"),
  statusReadout: $("#status-readout"),
  networkReading: $("#network-reading"),
  liveRegion: $("#live-region"),
  rotateCounterclockwise: $("#rotate-ccw"),
  rotateClockwise: $("#rotate-cw"),
  toggleLock: $("#toggle-lock"),
  lockIcon: $("#lock-icon"),
  lockLabel: $("#lock-label"),
  newGame: $("#new-game"),
  restartGame: $("#restart-game"),
  undoMove: $("#undo-move"),
  muteAudio: $("#mute-audio"),
  muteIcon: $("#mute-icon"),
  muteLabel: $("#mute-label"),
  openRules: $("#open-rules"),
  rulesDialog: $("#rules-dialog"),
  victoryPanel: $("#victory-panel"),
  victoryCopy: $("#victory-copy"),
  nextLevel: $("#next-level"),
  closeVictory: $("#close-victory"),
  headerWeather: $("#header-weather"),
};

const directionLabels = Object.freeze({
  N: "北",
  E: "东",
  S: "南",
  W: "西",
});

const shapeLabels = Object.freeze({
  end: "单端信标",
  straight: "直航模块",
  corner: "转角模块",
  tee: "三岔模块",
  cross: "四向模块",
});

const difficultyShort = Object.freeze({
  easy: { name: "近岸", code: "5 × 5" },
  medium: { name: "外海", code: "6 × 6" },
  hard: { name: "风眼", code: "7 × 7" },
});

let preferences = loadPreferences();
const recovered = loadSavedState();
let game = recovered?.game ?? createGame(LEVELS[0]);
let history = recovered?.history ?? [];
let selectedIndex = recovered?.selectedIndex ?? game.level.lighthouseIndex;
let elapsedOffset = recovered?.elapsedMs ?? 0;
let clockStartedAt = Date.now();
let victoryDismissed = recovered?.victoryDismissed ?? false;
let completionReported = recovered?.completionReported ?? false;
let victoryTimer = 0;
let saveTimer = 0;
let clockTimer = 0;
let liveTimer = 0;
let longPress = null;
let suppressClick = null;

class StormAudio {
  constructor() {
    this.context = null;
    this.master = null;
  }

  ensure() {
    if (preferences.muted) return null;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  }

  setMuted(muted) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.14, now, 0.012);
  }

  tone(frequency, duration, options = {}) {
    const context = this.ensure();
    if (!context || !this.master) return;
    const start = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(Math.max(25, frequency), start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(25, options.endFrequency),
        start + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.14, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  noise(duration = 0.12, volume = 0.035) {
    const context = this.ensure();
    if (!context || !this.master) return;
    const length = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = 760;
    filter.Q.value = 0.65;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  rotate(clockwise, poweredDelta) {
    const root = clockwise ? 262 : 228;
    this.tone(root, 0.1, {
      type: "triangle",
      volume: 0.12,
      endFrequency: clockwise ? 392 : 150,
    });
    if (poweredDelta > 0) {
      this.tone(540 + Math.min(poweredDelta, 6) * 24, 0.2, {
        delay: 0.07,
        volume: 0.12,
        endFrequency: 760,
      });
    }
  }

  lock(locked) {
    this.tone(locked ? 188 : 310, 0.12, {
      type: "square",
      volume: 0.07,
      endFrequency: locked ? 132 : 430,
    });
  }

  blocked() {
    this.tone(92, 0.1, { type: "square", volume: 0.06, endFrequency: 62 });
  }

  undo() {
    this.tone(360, 0.18, { type: "triangle", volume: 0.1, endFrequency: 150 });
  }

  chart() {
    this.noise(0.13, 0.026);
    this.tone(195, 0.18, { type: "sine", volume: 0.08, endFrequency: 320 });
  }

  victory() {
    [392, 493.88, 587.33, 783.99].forEach((frequency, index) => {
      this.tone(frequency, 0.34, {
        type: index % 2 ? "sine" : "triangle",
        delay: index * 0.11,
        volume: 0.13,
        endFrequency: frequency * 1.02,
      });
    });
    this.noise(0.42, 0.025);
  }
}

const audio = new StormAudio();

function loadPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (parsed && typeof parsed === "object" && typeof parsed.muted === "boolean") {
      return { muted: parsed.muted };
    }
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
  return { muted: false };
}

function savePreferences() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences remain effective for this session.
  }
}

function restoreHistory(items, levelId) {
  if (!Array.isArray(items) || items.length > HISTORY_LIMIT) return [];
  const restored = [];
  for (const item of items) {
    const state = restoreGame(item, levelId);
    if (!state) return [];
    restored.push(state);
  }
  return restored;
}

function loadSavedState() {
  try {
    const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!payload || payload.schema !== APP_SCHEMA || payload.version !== APP_VERSION) return null;
    const restoredGame = restoreGame(payload.game);
    if (!restoredGame) return null;
    const restoredHistory = restoreHistory(payload.history, restoredGame.levelId);
    const fallbackIndex = restoredGame.level.lighthouseIndex;
    const restoredIndex = Number.isInteger(payload.selectedIndex)
      && payload.selectedIndex >= 0
      && payload.selectedIndex < restoredGame.level.total
      ? payload.selectedIndex
      : fallbackIndex;
    const elapsedMs = Number.isFinite(payload.elapsedMs) && payload.elapsedMs >= 0
      ? Math.min(payload.elapsedMs, 1000 * 60 * 60 * 24 * 30)
      : 0;
    return {
      game: restoredGame,
      history: restoredHistory,
      selectedIndex: restoredIndex,
      elapsedMs,
      victoryDismissed: payload.victoryDismissed === true,
      completionReported: payload.completionReported === true || restoredGame.status === STATUS.WON,
    };
  } catch {
    return null;
  }
}

function serializeState(gameState) {
  return JSON.parse(serializeGame(gameState));
}

function currentElapsed() {
  if (game.status === STATUS.WON) return elapsedOffset;
  return elapsedOffset + Math.max(0, Date.now() - clockStartedAt);
}

function saveState(immediate = false) {
  clearTimeout(saveTimer);
  const write = () => {
    try {
      const payload = {
        schema: APP_SCHEMA,
        version: APP_VERSION,
        game: serializeState(game),
        history: history.map(serializeState),
        selectedIndex,
        elapsedMs: currentElapsed(),
        victoryDismissed,
        completionReported,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      elements.saveState.textContent = "已同步";
    } catch {
      elements.saveState.textContent = "本地受限";
    }
  };
  elements.saveState.textContent = "写入中";
  if (immediate) write();
  else saveTimer = window.setTimeout(write, 80);
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function announce(message) {
  clearTimeout(liveTimer);
  elements.liveRegion.textContent = "";
  liveTimer = window.setTimeout(() => {
    elements.liveRegion.textContent = message;
  }, 20);
}

function tileIndexFromEvent(event) {
  const tile = event.target.closest?.(".network-tile");
  if (!tile || !elements.board.contains(tile)) return -1;
  return Number(tile.dataset.index);
}

function distancesFromRoot(evaluation) {
  const distances = Array(evaluation.total).fill(Infinity);
  distances[evaluation.rootIndex] = 0;
  const queue = [evaluation.rootIndex];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const neighbour of evaluation.adjacency[current]) {
      if (distances[neighbour] !== Infinity) continue;
      distances[neighbour] = distances[current] + 1;
      queue.push(neighbour);
    }
  }
  return distances;
}

function cycleCells(evaluation) {
  if (!evaluation.hasCycle) return new Set();
  const cells = new Set();
  for (const [edgeStart, edgeEnd] of evaluation.edges) {
    const seen = new Set([edgeStart]);
    const queue = [edgeStart];
    for (let cursor = 0; cursor < queue.length && !seen.has(edgeEnd); cursor += 1) {
      const current = queue[cursor];
      for (const neighbour of evaluation.adjacency[current]) {
        if ((current === edgeStart && neighbour === edgeEnd)
          || (current === edgeEnd && neighbour === edgeStart)) continue;
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
    if (seen.has(edgeEnd)) {
      cells.add(edgeStart);
      cells.add(edgeEnd);
    }
  }
  return cells;
}

function portPath(mask) {
  const segments = [];
  if (mask & PORT.N) segments.push("M50 50 L50 0");
  if (mask & PORT.E) segments.push("M50 50 L100 50");
  if (mask & PORT.S) segments.push("M50 50 L50 100");
  if (mask & PORT.W) segments.push("M50 50 L0 50");
  return segments.join(" ");
}

function appendSvgElement(parent, tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  parent.append(element);
  return element;
}

function buildModuleSvg(mask, source) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = portPath(mask);
  appendSvgElement(svg, "path", { class: "cable-shadow", d: path });
  appendSvgElement(svg, "path", { class: "cable-base", d: path });
  appendSvgElement(svg, "path", { class: "cable-power", d: path });
  appendSvgElement(svg, "path", { class: "cable-pulse", d: path });
  appendSvgElement(svg, "circle", { class: "buoy-halo", cx: 50, cy: 50, r: 25 });
  appendSvgElement(svg, "path", {
    class: "buoy-body",
    d: "M38 45 L42 31 L58 31 L62 45 L66 62 Q50 72 34 62 Z",
  });
  appendSvgElement(svg, "path", {
    class: "cable-rivet",
    d: "M31 51 A19 19 0 0 0 69 51",
  });
  appendSvgElement(svg, "circle", { class: "cable-rivet-inner", cx: 31, cy: 51, r: 2.3 });
  appendSvgElement(svg, "circle", { class: "cable-rivet-inner", cx: 69, cy: 51, r: 2.3 });
  appendSvgElement(svg, "path", {
    class: "buoy-lamp",
    d: "M45 44 Q50 35 55 44 L54 54 Q50 58 46 54 Z",
  });
  appendSvgElement(svg, "path", {
    class: "buoy-lamp",
    d: "M42 62 Q50 66 58 62 L56 69 L44 69 Z",
  });
  if (source) {
    appendSvgElement(svg, "path", {
      class: "source-crown",
      d: "M50 18 L54 25 L62 24 L58 31 L61 37 L50 34 L39 37 L42 31 L38 24 L46 25 Z",
    });
  }
  return svg;
}

function addBadge(tile, className, text = "") {
  const badge = document.createElement("span");
  badge.className = className;
  badge.setAttribute("aria-hidden", "true");
  if (className === "lock-badge") badge.append(document.createElement("i"));
  else badge.textContent = text;
  tile.append(badge);
}

function tileLabel(index, loopSet) {
  const point = pointOf(game.level, index);
  const mask = game.orientations[index];
  const ports = portsFor(mask).map((direction) => directionLabels[direction]).join("、");
  const details = [
    `第 ${point.row + 1} 行第 ${point.column + 1} 列`,
    shapeLabels[moduleShape(mask)],
    `接口朝向${ports}`,
  ];
  if (index === game.level.lighthouseIndex) details.push("主灯塔");
  details.push(game.evaluation.reachable.has(index) ? "已从主灯塔通能" : "尚未通能");
  if (game.evaluation.danglingCells.has(index)) details.push("存在悬空断口");
  if (loopSet.has(index)) details.push("位于闭合回路");
  if (game.locked[index]) details.push("已锁定");
  return details.join("，");
}

function renderBoard(options = {}) {
  const { focus = false } = options;
  const activeWasTile = document.activeElement?.classList?.contains("network-tile");
  const evaluation = game.evaluation;
  const distances = distancesFromRoot(evaluation);
  const loopSet = cycleCells(evaluation);
  elements.board.replaceChildren();
  elements.board.style.setProperty("--columns", game.level.width);
  elements.board.setAttribute("aria-rowcount", game.level.height);
  elements.board.setAttribute("aria-colcount", game.level.width);

  const fragment = document.createDocumentFragment();
  for (let row = 0; row < game.level.height; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "network-row";
    rowElement.setAttribute("role", "row");
    rowElement.setAttribute("aria-rowindex", String(row + 1));
    for (let column = 0; column < game.level.width; column += 1) {
      const index = row * game.level.width + column;
      const mask = game.orientations[index];
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "network-tile";
      tile.dataset.index = String(index);
      tile.dataset.powered = String(evaluation.reachable.has(index));
      tile.dataset.locked = String(game.locked[index]);
      tile.dataset.invalid = String(evaluation.danglingCells.has(index));
      tile.dataset.loop = String(loopSet.has(index));
      tile.dataset.source = String(index === game.level.lighthouseIndex);
      tile.style.setProperty(
        "--power-delay",
        `${REDUCED_MOTION.matches || !Number.isFinite(distances[index]) ? 0 : distances[index] * 58}ms`,
      );
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-rowindex", String(row + 1));
      tile.setAttribute("aria-colindex", String(column + 1));
      tile.setAttribute("aria-selected", String(index === selectedIndex));
      tile.setAttribute("aria-label", tileLabel(index, loopSet));
      tile.setAttribute("aria-keyshortcuts", "Enter Space A D F S");
      tile.tabIndex = index === selectedIndex ? 0 : -1;
      tile.append(buildModuleSvg(mask, index === game.level.lighthouseIndex));
      if (game.locked[index]) addBadge(tile, "lock-badge");
      if (evaluation.danglingCells.has(index)) addBadge(tile, "break-badge", "!");
      if (loopSet.has(index)) addBadge(tile, "loop-badge", "↻");
      rowElement.append(tile);
    }
    fragment.append(rowElement);
  }
  elements.board.append(fragment);
  if (focus || activeWasTile) {
    requestAnimationFrame(() => focusSelected());
  }
}

function evaluationStatus() {
  const evaluation = game.evaluation;
  if (evaluation.solved) return "全网连通，无悬空接头、无回路";
  if (evaluation.hasCycle) return `发现 ${evaluation.cycleCount} 处闭合回路`;
  if (evaluation.dangling.length > 0) return `仍有 ${evaluation.dangling.length} 个悬空接头`;
  if (!evaluation.allConnected) return `仍有 ${evaluation.unreachable.size} 座信标未接入`;
  return "继续校准航标";
}

function renderChrome() {
  const levelIndex = LEVELS.findIndex((level) => level.id === game.level.id);
  const point = pointOf(game.level, selectedIndex);
  const powered = game.evaluation.reachableCount;
  const total = game.level.total;
  const progress = powered / total;
  const selectedLocked = game.locked[selectedIndex];

  elements.levelCode.textContent = `SL-${String(levelIndex + 1).padStart(2, "0")}`;
  elements.levelName.textContent = game.level.name;
  elements.levelBrief.textContent = game.level.briefing;
  elements.gridSize.textContent = `${game.level.width} × ${game.level.height}`;
  elements.poweredCount.textContent = `${powered}/${total}`;
  elements.progressRing.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
  elements.moveCount.textContent = String(game.moves).padStart(2, "0");
  elements.lockCount.textContent = String(game.locked.filter(Boolean).length).padStart(2, "0");
  elements.timeCount.textContent = formatTime(currentElapsed());
  elements.selectedReading.textContent = `R ${String(point.row + 1).padStart(2, "0")} · C ${String(point.column + 1).padStart(2, "0")}`;
  elements.statusReadout.textContent = evaluationStatus();
  elements.networkReading.textContent = `${Math.round(progress * 100)}% ONLINE`;
  elements.boardDescription.textContent = `${game.level.name}，${game.level.width} 乘 ${game.level.height}。${powered} 座信标已通能。${evaluationStatus()}。`;
  elements.boardShell.dataset.state = game.status;
  elements.undoMove.disabled = history.length === 0;
  elements.rotateClockwise.disabled = selectedLocked || game.status === STATUS.WON;
  elements.rotateCounterclockwise.disabled = selectedLocked || game.status === STATUS.WON;
  elements.toggleLock.setAttribute("aria-pressed", String(selectedLocked));
  elements.toggleLock.disabled = false;
  elements.lockIcon.textContent = selectedLocked ? "◆" : "◇";
  elements.lockLabel.textContent = selectedLocked ? "解锁" : "锁定";
  document.body.dataset.cleared = String(game.status === STATUS.WON);
  elements.headerWeather.textContent = game.status === STATUS.WON ? "云墙消散" : "风暴警戒";

  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === game.level.difficulty));
  }
}

function render(options = {}) {
  renderBoard(options);
  renderChrome();
  if (game.status === STATUS.WON && !victoryDismissed) scheduleVictory();
  else if (game.status !== STATUS.WON) hideVictory();
}

function buildDifficultyButtons() {
  const fragment = document.createDocumentFragment();
  for (const difficulty of DIFFICULTIES) {
    const copy = difficultyShort[difficulty.id];
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty.id;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${difficulty.label}，${difficulty.description}`);
    button.append(document.createTextNode(copy.name));
    const small = document.createElement("small");
    small.textContent = copy.code;
    button.append(small);
    fragment.append(button);
  }
  elements.difficultyButtons.append(fragment);
}

function focusSelected() {
  const tile = elements.board.querySelector(`[data-index="${selectedIndex}"]`);
  if (!tile) return;
  tile.focus({ preventScroll: true });
  tile.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
}

function setSelected(index, options = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= game.level.total) return;
  selectedIndex = index;
  for (const tile of elements.board.querySelectorAll(".network-tile")) {
    const selected = Number(tile.dataset.index) === index;
    tile.tabIndex = selected ? 0 : -1;
    tile.setAttribute("aria-selected", String(selected));
  }
  renderChrome();
  if (options.focus) focusSelected();
  saveState();
}

function pushHistory(state) {
  history.push(state);
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
}

function actionMessage(result, beforePowered) {
  const point = pointOf(game.level, result.index);
  const location = `第 ${point.row + 1} 行第 ${point.column + 1} 列`;
  if (result.effect === "locked") return `${location}已锁定`;
  if (result.effect === "unlocked") return `${location}已解锁`;
  const direction = result.effect === "rotated-counterclockwise" ? "逆时针" : "顺时针";
  const delta = game.evaluation.reachableCount - beforePowered;
  if (game.status === STATUS.WON) return `${location}${direction}旋转，全海域完成通能`;
  if (delta > 0) return `${location}${direction}旋转，新点亮 ${delta} 座信标`;
  if (delta < 0) return `${location}${direction}旋转，${Math.abs(delta)} 座信标暂时失去能量`;
  return `${location}${direction}旋转`;
}

function rejectedMessage(reason) {
  if (reason === "locked") return "该航标已锁定，请先解锁";
  if (reason === "complete") return "海图已经完成";
  if (reason === "fixed-shape") return "该模块旋转后外形不变";
  return "这项校准无法执行";
}

function reportRealmCompletion() {
  const payload = {
    levelId: `${game.level.difficulty}:${game.level.id}`,
    tier: COMPLETION_TIERS[game.level.difficulty] ?? 1,
    moves: game.moves,
    par: game.level.referenceTurns,
  };
  if (typeof window.RealmArcade?.complete === "function") window.RealmArcade.complete(payload);
  else (window.__realmCompletionQueue ??= []).push(payload);
}

function performAction(action, options = {}) {
  const before = game;
  const beforePowered = game.evaluation.reachableCount;
  const elapsedBefore = currentElapsed();
  const result = applyAction(game, action);
  if (!result.accepted) {
    audio.blocked();
    announce(rejectedMessage(result.reason));
    elements.statusReadout.textContent = rejectedMessage(result.reason);
    return false;
  }

  pushHistory(before);
  game = result.state;
  selectedIndex = result.index;
  if (before.status !== STATUS.WON && game.status === STATUS.WON) {
    elapsedOffset = elapsedBefore;
    clockStartedAt = Date.now();
    victoryDismissed = false;
    if (!completionReported) {
      completionReported = true;
      reportRealmCompletion();
    }
  }

  render({ focus: options.focus === true });
  const message = actionMessage(result, beforePowered);
  announce(message);
  if (result.effect === "locked" || result.effect === "unlocked") {
    audio.lock(result.effect === "locked");
  } else {
    audio.rotate(result.effect !== "rotated-counterclockwise", game.evaluation.reachableCount - beforePowered);
  }
  saveState();
  return true;
}

function rotateSelected(turns, options = {}) {
  return performAction({ type: "rotate", index: selectedIndex, turns }, options);
}

function toggleSelectedLock(options = {}) {
  return performAction({ type: "toggle-lock", index: selectedIndex }, options);
}

function resetClock(elapsed = 0) {
  elapsedOffset = elapsed;
  clockStartedAt = Date.now();
  elements.timeCount.textContent = formatTime(elapsed);
}

function startLevel(level, options = {}) {
  hideVictory();
  game = createGame(level);
  history = [];
  selectedIndex = game.level.lighthouseIndex;
  victoryDismissed = false;
  completionReported = false;
  resetClock();
  render({ focus: options.focus === true });
  audio.chart();
  announce(`${game.level.name}已展开，${game.level.width}乘${game.level.height}航标阵`);
  saveState();
}

function nextLevelInDifficulty(focus = false) {
  const levels = levelsForDifficulty(game.level.difficulty);
  const current = levels.findIndex((level) => level.id === game.level.id);
  startLevel(levels[(current + 1 + levels.length) % levels.length], { focus });
}

function chooseDifficulty(difficulty, focus = false) {
  if (!difficultyShort[difficulty]) return;
  const levels = levelsForDifficulty(difficulty);
  if (difficulty === game.level.difficulty) {
    nextLevelInDifficulty(focus);
  } else {
    startLevel(levels[0], { focus });
  }
}

function restartCurrent(focus = false) {
  hideVictory();
  game = restartGame(game);
  history = [];
  selectedIndex = game.level.lighthouseIndex;
  victoryDismissed = false;
  completionReported = false;
  resetClock();
  render({ focus });
  audio.chart();
  announce(`${game.level.name}已恢复初始朝向`);
  saveState();
}

function undo(focus = false) {
  if (history.length === 0) {
    audio.blocked();
    announce("当前没有可撤销的校准");
    return;
  }
  const wasWon = game.status === STATUS.WON;
  game = history.pop();
  selectedIndex = Math.min(selectedIndex, game.level.total - 1);
  if (wasWon && game.status !== STATUS.WON) {
    victoryDismissed = false;
    clockStartedAt = Date.now();
  }
  hideVictory();
  render({ focus });
  audio.undo();
  announce("已撤销上一次校准");
  saveState();
}

function scheduleVictory() {
  if (victoryDismissed || elements.victoryPanel.open) return;
  clearTimeout(victoryTimer);
  const distances = distancesFromRoot(game.evaluation);
  const maximumDistance = Math.max(...distances.filter(Number.isFinite));
  const delay = REDUCED_MOTION.matches ? 80 : Math.min(900, 250 + maximumDistance * 58);
  victoryTimer = window.setTimeout(showVictory, delay);
}

function showVictory() {
  if (game.status !== STATUS.WON || victoryDismissed) return;
  const blockingDialog = [...document.querySelectorAll("dialog[open]")]
    .find((dialog) => dialog !== elements.victoryPanel);
  if (blockingDialog) {
    blockingDialog.addEventListener("close", showVictory, { once: true });
    return;
  }
  elements.victoryCopy.textContent = `用 ${game.moves} 次旋转、${formatTime(currentElapsed())} 校准 ${game.level.total} 座航标。整片海域重新看见了灯光。`;
  if (!victoryDialog.show()) return;
  audio.victory();
  announce("海图完成。所有航标连通且没有回路，云墙已经退去");
  saveState();
}

function hideVictory(dismiss = false) {
  clearTimeout(victoryTimer);
  if (dismiss) victoryDialog.dismiss();
  else victoryDialog.close();
}

function moveSelection(rowStep, columnStep) {
  const point = pointOf(game.level, selectedIndex);
  const row = Math.max(0, Math.min(game.level.height - 1, point.row + rowStep));
  const column = Math.max(0, Math.min(game.level.width - 1, point.column + columnStep));
  setSelected(row * game.level.width + column, { focus: true });
}

function clearLongPress() {
  if (!longPress) return;
  clearTimeout(longPress.timer);
  longPress = null;
}

function fireLongPress(record) {
  if (!record || record.fired) return;
  clearTimeout(record.timer);
  record.fired = true;
  suppressClick = {
    index: record.index,
    pointerId: record.pointerId,
    until: Number.POSITIVE_INFINITY,
  };
  selectedIndex = record.index;
  toggleSelectedLock({ focus: false });
  if (navigator.vibrate) navigator.vibrate(18);
}

function onBoardPointerDown(event) {
  const index = tileIndexFromEvent(event);
  if (index < 0) return;
  // A genuine new press must not be mistaken for the compatibility click
  // emitted after an earlier long press.
  suppressClick = null;
  if (event.button !== 0) return;
  setSelected(index);
  const tile = event.target.closest(".network-tile");
  tile.setPointerCapture?.(event.pointerId);
  clearLongPress();
  const record = {
    index,
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    fired: false,
    timer: 0,
  };
  record.timer = window.setTimeout(() => fireLongPress(record), LONG_PRESS_MS);
  longPress = record;
}

function onBoardPointerMove(event) {
  if (!longPress || event.pointerId !== longPress.pointerId || longPress.fired) return;
  if (Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y) > 12) clearLongPress();
}

function onBoardPointerEnd(event) {
  if (!longPress || event.pointerId !== longPress.pointerId) return;
  clearTimeout(longPress.timer);
  const fired = longPress.fired;
  if (fired && suppressClick?.pointerId === longPress.pointerId) {
    // Start the grace period on release, however long the user kept holding.
    suppressClick.until = performance.now() + 900;
  }
  longPress = null;
  if (fired) event.preventDefault();
}

function onBoardLostPointerCapture(event) {
  if (!longPress || event.pointerId !== longPress.pointerId || longPress.fired) return;
  clearLongPress();
}

function onBoardClick(event) {
  const index = tileIndexFromEvent(event);
  if (index < 0) return;
  if (suppressClick && suppressClick.index === index && performance.now() < suppressClick.until) {
    suppressClick = null;
    event.preventDefault();
    return;
  }
  selectedIndex = index;
  if (event.shiftKey || event.altKey) rotateSelected(-1, { focus: false });
  else rotateSelected(1, { focus: false });
}

function onBoardContextMenu(event) {
  const index = tileIndexFromEvent(event);
  if (index < 0) return;
  event.preventDefault();

  const isActivePress = longPress?.index === index;
  const isTouchContext = isActivePress
    || event.pointerType === "touch"
    || event.pointerType === "pen"
    || event.sourceCapabilities?.firesTouchEvents === true;

  if (isTouchContext) {
    if (isActivePress) {
      fireLongPress(longPress);
    } else if (!(suppressClick?.index === index && performance.now() < suppressClick.until)) {
      // Some engines cancel the pointer before dispatching the touch context
      // event. Treat that event itself as the completed long press.
      suppressClick = { index, pointerId: null, until: performance.now() + 900 };
      selectedIndex = index;
      toggleSelectedLock({ focus: false });
      if (navigator.vibrate) navigator.vibrate(18);
    }
    return;
  }

  if (suppressClick && suppressClick.index === index && performance.now() < suppressClick.until) {
    return;
  }
  // Context-menu keys and synthetic touch events must never rotate a tile.
  if (event.button !== 2) return;
  selectedIndex = index;
  rotateSelected(-1, { focus: false });
}

function onBoardKeyDown(event) {
  const index = tileIndexFromEvent(event);
  if (index >= 0) selectedIndex = index;
  const key = event.key;
  if (key === "ArrowUp") moveSelection(-1, 0);
  else if (key === "ArrowRight") moveSelection(0, 1);
  else if (key === "ArrowDown") moveSelection(1, 0);
  else if (key === "ArrowLeft") moveSelection(0, -1);
  else if (key === "Enter" || key === " " || key.toLowerCase() === "d") rotateSelected(1, { focus: true });
  else if (key.toLowerCase() === "a") rotateSelected(-1, { focus: true });
  else if (key.toLowerCase() === "f") rotateSelected(2, { focus: true });
  else if (key.toLowerCase() === "s" || key.toLowerCase() === "l") toggleSelectedLock({ focus: true });
  else return;
  event.preventDefault();
}

function toggleMute() {
  preferences = { ...preferences, muted: !preferences.muted };
  savePreferences();
  audio.setMuted(preferences.muted);
  renderAudioPreference();
  if (!preferences.muted) {
    audio.ensure();
    audio.tone(440, 0.1, { volume: 0.08, endFrequency: 620 });
  }
  announce(preferences.muted ? "声音已关闭" : "声音已开启");
}

function renderAudioPreference() {
  elements.muteAudio.setAttribute("aria-pressed", String(preferences.muted));
  elements.muteIcon.textContent = preferences.muted ? "×" : "♪";
  elements.muteLabel.textContent = preferences.muted ? "声音关闭" : "声音开启";
}

function openRules() {
  if (typeof elements.rulesDialog.showModal === "function") elements.rulesDialog.showModal();
  else elements.rulesDialog.setAttribute("open", "");
}

function onGlobalShortcut(event) {
  if (event.defaultPrevented || event.repeat) return;
  if (elements.rulesDialog.open) return;
  const target = event.target;
  const isTile = target?.classList?.contains("network-tile");
  const isInteractive = target?.closest?.("button, a, input, select, textarea, [contenteditable='true']");
  if (isInteractive && !isTile) return;
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "z") undo(isTile);
  else if (key === "u" || key === "z") undo(isTile);
  else if (key === "r") restartCurrent(isTile);
  else if (key === "n") nextLevelInDifficulty(isTile);
  else if (key === "m") toggleMute();
  else if (event.key === "?") openRules();
  else return;
  event.preventDefault();
}

function armAudio() {
  audio.ensure();
}

const victoryDialog = createVictoryDialogController({
  dialog: elements.victoryPanel,
  primaryAction: elements.nextLevel,
  dismissAction: elements.closeVictory,
  getReturnFocus: () => {
    const active = document.activeElement;
    if (active && active !== document.body) return active;
    return elements.board.querySelector(`[data-index="${selectedIndex}"]`);
  },
  focusFallback: focusSelected,
  onDismiss: () => {
    clearTimeout(victoryTimer);
    if (game.status === STATUS.WON) victoryDismissed = true;
    announce("已关闭胜利提示，留在当前海图");
    saveState();
  },
});

function bindEvents() {
  elements.board.addEventListener("pointerdown", onBoardPointerDown);
  elements.board.addEventListener("pointermove", onBoardPointerMove);
  elements.board.addEventListener("lostpointercapture", onBoardLostPointerCapture);
  elements.board.addEventListener("click", onBoardClick);
  elements.board.addEventListener("contextmenu", onBoardContextMenu);
  elements.board.addEventListener("keydown", onBoardKeyDown);

  elements.rotateCounterclockwise.addEventListener("click", () => rotateSelected(-1));
  elements.rotateClockwise.addEventListener("click", () => rotateSelected(1));
  elements.toggleLock.addEventListener("click", () => toggleSelectedLock());
  elements.newGame.addEventListener("click", () => nextLevelInDifficulty(true));
  elements.restartGame.addEventListener("click", () => restartCurrent(true));
  elements.undoMove.addEventListener("click", () => undo(true));
  elements.muteAudio.addEventListener("click", toggleMute);
  elements.openRules.addEventListener("click", openRules);
  elements.nextLevel.addEventListener("click", () => nextLevelInDifficulty(true));

  elements.difficultyButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-difficulty]");
    if (!button) return;
    chooseDifficulty(button.dataset.difficulty, true);
  });

  elements.rulesDialog.addEventListener("click", (event) => {
    if (event.target === elements.rulesDialog) elements.rulesDialog.close();
  });

  document.addEventListener("pointerup", onBoardPointerEnd, { capture: true });
  document.addEventListener("pointercancel", onBoardPointerEnd, { capture: true });
  document.addEventListener("keydown", onGlobalShortcut);
  document.addEventListener("pointerdown", armAudio, { capture: true, once: true });
  document.addEventListener("keydown", armAudio, { capture: true, once: true });
  window.addEventListener("pagehide", () => saveState(true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveState(true);
  });
}

function startClock() {
  clearInterval(clockTimer);
  clockTimer = window.setInterval(() => {
    elements.timeCount.textContent = formatTime(currentElapsed());
    if (game.status !== STATUS.WON && Math.floor(currentElapsed() / 10000) % 3 === 0) saveState();
  }, 1000);
}

buildDifficultyButtons();
renderAudioPreference();
bindEvents();
render();
startClock();
saveState();

// Exposed read-only hooks make local browser acceptance deterministic without
// coupling the rules engine to the DOM.
Object.defineProperty(window, "stormLanterns", {
  value: Object.freeze({
    getState: () => game,
    getSelectedIndex: () => selectedIndex,
    chooseLevel: (id) => {
      const level = findLevel(id);
      if (!level) return false;
      startLevel(level);
      return true;
    },
  }),
  writable: false,
});
