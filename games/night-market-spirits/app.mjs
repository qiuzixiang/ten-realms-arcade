import {
  DIFFICULTIES,
  EMPTY,
  MIN_GROUP_SIZE,
  STATUS,
  applyMove,
  boardFocusTarget,
  countSpirits,
  createGame,
  difficultyFor,
  getGroup,
  keyOf,
  listGroups,
  normalizeSeed,
  previewMove,
  restoreGame,
  scoreForGroup,
  selectionRenderOptions,
  serializeGame,
} from "./logic.mjs";

const SAVE_KEY = "ten-realms.night-market-spirits.session.v1";
const PREFS_KEY = "ten-realms.night-market-spirits.preferences.v1";
const DEFAULT_SEED = 1;
const COMPACT_BOARD_BREAKPOINT = 430;
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const DIFFICULTY_TIER = Object.freeze({ lantern: 1, canopy: 2, bell: 3 });

const SPIRITS = Object.freeze([
  Object.freeze({
    name: "灯盏灵",
    drawing: '<path class="spirit-fill" d="M24 5c8.5 0 14.5 7.2 14.5 16.2S32.5 39 24 43c-8.5-4-14.5-12.8-14.5-21.8S15.5 5 24 5Z"/><path d="M15 17h18M14 25h20M18 10c-2 10-2 21 6 29M30 10c2 10 2 21-6 29"/><circle cx="24" cy="24" r="3.2"/>',
  }),
  Object.freeze({
    name: "伞影灵",
    drawing: '<path class="spirit-fill" d="M7 24C8.8 13.4 15.2 7 24 7s15.2 6.4 17 17c-4.4-2.8-8.4-2.8-12 0-3.3-2.8-6.7-2.8-10 0-3.7-2.8-7.7-2.8-12 0Z"/><path d="M24 7v29c0 6 8 6 8 0M13 21c2-6 5.7-10 11-14M35 21c-2-6-5.7-10-11-14"/>',
  }),
  Object.freeze({
    name: "叶纹灵",
    drawing: '<path class="spirit-fill" d="M39.5 8.5C24 7.2 10.3 15.3 9 29.2c-.7 7.1 4.1 11.2 10.2 10.2C33.1 37 40.9 23.9 39.5 8.5Z"/><path d="M11 39C17.5 28.7 25.5 21 37.5 11.5M18 29l1-10M24 24l9 .5M29 18l.5-6"/>',
  }),
  Object.freeze({
    name: "月纱灵",
    drawing: '<path class="spirit-fill" d="M34.8 7.5c-8.1 2.2-13.1 9.1-12 17 1 7.2 6.9 12.4 14.2 12.8A17 17 0 1 1 34.8 7.5Z"/><circle cx="15" cy="17" r="2.2"/><circle cx="11" cy="28" r="1.5"/><path d="M13 38c4-4.2 7.8-5.6 12-5.2"/>',
  }),
  Object.freeze({
    name: "风铃灵",
    drawing: '<path class="spirit-fill" d="M14 13c0-4.5 4.5-7.5 10-7.5s10 3 10 7.5l3.5 20.5h-27L14 13Z"/><path d="M10.5 33.5h27M19 12l-2 16M29 12l2 16M20 39c1.7 4.7 6.3 4.7 8 0"/><circle cx="24" cy="37" r="2.2"/>',
  }),
]);

const $ = (selector) => document.querySelector(selector);
const elements = {
  board: $("#spirit-board"),
  boardScroll: $("#board-scroll"),
  boardShell: $(".board-shell"),
  flightLayer: $("#flight-layer"),
  difficultyKicker: $("#difficulty-kicker"),
  seedHeading: $("#seed-heading"),
  remainingHeader: $("#remaining-header"),
  boardMessage: $("#board-message"),
  previewScore: $("#preview-score"),
  scoreValue: $("#score-value"),
  bestValue: $("#best-value"),
  movesValue: $("#moves-value"),
  groupsValue: $("#groups-value"),
  saveState: $("#save-state"),
  difficultyButtons: $("#difficulty-buttons"),
  seedForm: $("#seed-form"),
  seedInput: $("#seed-input"),
  newGame: $("#new-game-button"),
  restart: $("#restart-button"),
  undo: $("#undo-button"),
  mute: $("#mute-button"),
  rulesButton: $("#rules-button"),
  footerRules: $("#footer-rules-button"),
  rulesDialog: $("#rules-dialog"),
  rulesClose: $("#rules-close-button"),
  spiritLegend: $("#spirit-legend-items"),
  outcomeDialog: $("#outcome-dialog"),
  outcomeKicker: $("#outcome-kicker"),
  outcomeTitle: $("#outcome-title"),
  outcomeCopy: $("#outcome-copy"),
  outcomeScore: $("#outcome-score"),
  outcomeMoves: $("#outcome-moves"),
  outcomeRemaining: $("#outcome-remaining"),
  outcomeNext: $("#outcome-next-button"),
  outcomeUndo: $("#outcome-undo-button"),
  outcomeStay: $("#outcome-stay-button"),
  toast: $("#toast"),
  assertiveStatus: $("#assertive-status"),
};

let preferences = loadPreferences();
const restoredSession = loadSession();
let game = restoredSession?.game ?? createGame({ seed: DEFAULT_SEED, difficulty: "lantern" });
let history = restoredSession?.history ?? [];
let selectedGroup = [];
let pointerAnchor = null;
let focusAnchor = null;
let focusCoordinate = null;
let toastTimer = 0;
let saveTimer = 0;
let outcomeTimer = 0;
let lastInputWasKeyboard = false;

function awardClear() {
  const payload = {
    levelId: `${game.difficulty}:${game.seed}`,
    tier: DIFFICULTY_TIER[game.difficulty] ?? 1,
    moves: game.moves,
  };
  if (window.RealmArcade?.complete) window.RealmArcade.complete(payload);
  else (window.__realmCompletionQueue ??= []).push(payload);
}

class MarketAudio {
  constructor() {
    this.context = null;
    this.master = null;
  }

  unlock() {
    if (preferences.muted) return null;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.17;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  }

  setMuted(muted) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.17, now, 0.015);
  }

  tone(frequency, duration, options = {}) {
    const context = this.unlock();
    if (!context || !this.master) return;
    const start = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(Math.max(frequency, 24), start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(options.endFrequency, 24),
        start + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.18, start + Math.min(0.025, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  select(size) {
    const root = 390 + Math.min(size, 8) * 18;
    this.tone(root, 0.12, { type: "triangle", volume: 0.12, endFrequency: root * 1.25 });
    this.tone(root * 1.5, 0.1, { delay: 0.045, volume: 0.07 });
  }

  depart(size) {
    const count = Math.min(size, 7);
    for (let index = 0; index < count; index += 1) {
      const frequency = 350 + index * 58;
      this.tone(frequency, 0.22, {
        delay: index * 0.035,
        type: index % 2 ? "sine" : "triangle",
        volume: 0.09,
        endFrequency: frequency * 1.72,
      });
    }
  }

  blocked() {
    this.tone(112, 0.1, { type: "square", volume: 0.06, endFrequency: 78 });
  }

  undo() {
    this.tone(560, 0.2, { type: "triangle", volume: 0.11, endFrequency: 250 });
  }

  reset() {
    this.tone(260, 0.12, { type: "triangle", volume: 0.08, endFrequency: 390 });
  }

  complete() {
    [261.63, 392, 523.25, 659.25].forEach((frequency, index) => {
      this.tone(frequency, 0.45, {
        delay: index * 0.11,
        type: index % 2 ? "sine" : "triangle",
        volume: 0.13,
        endFrequency: frequency * 1.01,
      });
    });
  }

  stuck() {
    this.tone(220, 0.3, { type: "triangle", volume: 0.1, endFrequency: 146 });
    this.tone(164, 0.42, { delay: 0.14, type: "sine", volume: 0.08, endFrequency: 105 });
  }
}

const audio = new MarketAudio();

function loadPreferences() {
  const fallback = {
    muted: false,
    best: Object.fromEntries(Object.keys(DIFFICULTIES).map((id) => [id, 0])),
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      muted: parsed.muted === true,
      best: Object.fromEntries(Object.keys(DIFFICULTIES).map((id) => [
        id,
        Number.isInteger(parsed.best?.[id]) && parsed.best[id] >= 0 ? parsed.best[id] : 0,
      ])),
    };
  } catch {
    return fallback;
  }
}

function savePreferences() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are optional; blocked storage does not affect play.
  }
}

function loadSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    if (!parsed || parsed.version !== 1) return null;
    const savedGame = restoreGame(parsed.game);
    if (!savedGame) return null;
    const savedHistory = Array.isArray(parsed.history)
      ? parsed.history
        .map((entry) => restoreGame(entry))
        .filter((entry) => (
          entry
          && entry.difficulty === savedGame.difficulty
          && entry.seed === savedGame.seed
          && entry.status === STATUS.PLAYING
        ))
        .slice(-80)
      : [];
    return { game: savedGame, history: savedHistory };
  } catch {
    return null;
  }
}

function saveSession(message = "已自动留档") {
  try {
    const payload = {
      version: 1,
      game: JSON.parse(serializeGame(game)),
      history: history.slice(-80).map((entry) => JSON.parse(serializeGame(entry))),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    elements.saveState.textContent = "正在留档…";
    elements.saveState.classList.add("is-saving");
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      elements.saveState.textContent = message;
      elements.saveState.classList.remove("is-saving");
    }, 520);
  } catch {
    elements.saveState.textContent = "本机存储受限";
    elements.saveState.classList.remove("is-saving");
  }
}

function updateBest() {
  const current = preferences.best[game.difficulty] ?? 0;
  if (game.score <= current) return false;
  preferences.best[game.difficulty] = game.score;
  savePreferences();
  return true;
}

function groupKeys(group) {
  return new Set(group.map((point) => keyOf(point.row, point.column)));
}

function sameGroup(first, second) {
  if (first.length !== second.length || first.length === 0) return false;
  const secondKeys = groupKeys(second);
  return first.every((point) => secondKeys.has(keyOf(point.row, point.column)));
}

function activePoints() {
  const points = [];
  for (let row = 0; row < game.board.length; row += 1) {
    for (let column = 0; column < game.board[row].length; column += 1) {
      if (game.board[row][column] !== EMPTY) points.push({ row, column });
    }
  }
  return points;
}

function nearestActive(coordinate = focusCoordinate) {
  const points = activePoints();
  if (points.length === 0) return null;
  if (!coordinate) {
    const firstGroup = listGroups(game.board)[0];
    return firstGroup?.[0] ?? points[0];
  }
  const exact = points.find((point) => point.row === coordinate.row && point.column === coordinate.column);
  if (exact) return exact;
  return points.reduce((best, point) => {
    const distance = Math.abs(point.row - coordinate.row) + Math.abs(point.column - coordinate.column);
    const bestDistance = Math.abs(best.row - coordinate.row) + Math.abs(best.column - coordinate.column);
    return distance < bestDistance ? point : best;
  });
}

function spiritMarkup(color) {
  const spirit = SPIRITS[color];
  return `<svg class="spirit-mark" viewBox="0 0 48 48" aria-hidden="true">${spirit.drawing}</svg>`;
}

function ariaLabelFor(row, column, color) {
  const group = getGroup(game.board, row, column);
  const spirit = SPIRITS[color];
  const position = `第${row + 1}行第${column + 1}列`;
  if (group.length < MIN_GROUP_SIZE) return `${position}，${spirit.name}，独自一只，不能撤离`;
  const points = scoreForGroup(group.length);
  const action = sameGroup(group, selectedGroup) ? "再次按下确认撤离" : "按下选中整组";
  return `${position}，${spirit.name}，完整群组${group.length}只，预计${points}分，${action}`;
}

function renderBoard(options = {}) {
  const config = difficultyFor(game.difficulty);
  focusCoordinate = nearestActive(options.preferredFocus ?? focusCoordinate);
  const fragment = document.createDocumentFragment();
  elements.board.style.setProperty("--columns", String(config.width));
  elements.board.setAttribute("aria-rowcount", String(config.height));
  elements.board.setAttribute("aria-colcount", String(config.width));
  elements.board.setAttribute(
    "aria-label",
    `${config.name}棋盘，${config.height}行${config.width}列，剩余${countSpirits(game.board)}只灯灵`,
  );
  elements.board.tabIndex = countSpirits(game.board) === 0 ? 0 : -1;

  for (let row = 0; row < config.height; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";
    rowElement.setAttribute("role", "row");
    rowElement.setAttribute("aria-rowindex", String(row + 1));

    for (let column = 0; column < config.width; column += 1) {
      const color = game.board[row][column];
      if (color === EMPTY) {
        const empty = document.createElement("div");
        empty.className = "stall-slot stall-slot--empty";
        empty.setAttribute("role", "gridcell");
        empty.setAttribute("aria-rowindex", String(row + 1));
        empty.setAttribute("aria-colindex", String(column + 1));
        empty.setAttribute("aria-label", `第${row + 1}行第${column + 1}列，空摊位`);
        rowElement.append(empty);
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = `stall-slot spirit-type-${color}`;
      button.dataset.row = String(row);
      button.dataset.column = String(column);
      button.dataset.color = String(color);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-rowindex", String(row + 1));
      button.setAttribute("aria-colindex", String(column + 1));
      button.setAttribute("aria-label", ariaLabelFor(row, column, color));
      const selected = selectedGroup.some((point) => point.row === row && point.column === column);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = focusCoordinate?.row === row && focusCoordinate?.column === column ? 0 : -1;
      button.innerHTML = spiritMarkup(color);
      rowElement.append(button);
    }
    fragment.append(rowElement);
  }

  elements.board.replaceChildren(fragment);
  syncBoardScale();
  requestAnimationFrame(syncBoardScale);
  elements.board.classList.toggle("is-settling", options.settle === true && !REDUCED_MOTION.matches);
  if (options.settle === true) {
    window.setTimeout(() => elements.board.classList.remove("is-settling"), 320);
  }
  updateHighlights();

  if (options.focus === true && focusCoordinate) {
    requestAnimationFrame(() => {
      const button = buttonAt(focusCoordinate.row, focusCoordinate.column);
      button?.focus({ preventScroll: true });
    });
  }
}

function syncBoardScale() {
  if (!elements.boardScroll || !elements.board) return;
  if (window.innerWidth > COMPACT_BOARD_BREAKPOINT) {
    elements.board.style.removeProperty("--cell");
    elements.boardScroll.scrollLeft = 0;
    return;
  }

  const boardStyle = window.getComputedStyle(elements.board);
  const boardChrome = (Number.parseFloat(boardStyle.borderLeftWidth) || 0)
    + (Number.parseFloat(boardStyle.borderRightWidth) || 0);
  const columns = difficultyFor(game.difficulty).width;
  const fittedCell = Math.floor((elements.boardScroll.clientWidth - boardChrome) / columns);
  elements.board.style.setProperty("--cell", `${Math.min(44, Math.max(24, fittedCell))}px`);
  elements.boardScroll.scrollLeft = 0;
}

function renderLegend() {
  const config = difficultyFor(game.difficulty);
  const fragment = document.createDocumentFragment();
  for (let color = 0; color < config.colors; color += 1) {
    const item = document.createElement("span");
    item.className = `legend-item spirit-type-${color}`;
    item.innerHTML = `${spiritMarkup(color)}<span>${SPIRITS[color].name}</span>`;
    fragment.append(item);
  }
  elements.spiritLegend.replaceChildren(fragment);
}

function renderPanel() {
  const config = difficultyFor(game.difficulty);
  const remaining = countSpirits(game.board);
  elements.difficultyKicker.textContent = `${config.name} · ${config.width} × ${config.height} · ${config.colors} 类灯灵`;
  elements.seedHeading.textContent = String(game.seed);
  elements.seedInput.value = String(game.seed);
  elements.remainingHeader.textContent = String(remaining);
  elements.scoreValue.textContent = String(game.score);
  elements.bestValue.textContent = String(preferences.best[game.difficulty] ?? 0);
  elements.movesValue.textContent = String(game.moves);
  elements.groupsValue.textContent = String(listGroups(game.board).length);
  elements.undo.disabled = history.length === 0;

  elements.difficultyButtons.querySelectorAll("button[data-difficulty]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === game.difficulty));
  });
  updateMuteButton();
  renderLegend();
}

function renderAll(options = {}) {
  updateBest();
  renderBoard(options);
  renderPanel();
  updatePreview();
}

function buttonAt(row, column) {
  return elements.board.querySelector(`button[data-row="${row}"][data-column="${column}"]`);
}

function setRovingTabStop(coordinate) {
  if (!coordinate) return;
  focusCoordinate = { ...coordinate };
  elements.board.querySelectorAll("button[data-row][data-column]").forEach((button) => {
    button.tabIndex = (
      Number(button.dataset.row) === coordinate.row
      && Number(button.dataset.column) === coordinate.column
    ) ? 0 : -1;
  });
}

function focusBoardSurface() {
  requestAnimationFrame(() => {
    if (elements.outcomeDialog.open) return;
    if (boardFocusTarget(game.board) === "board") {
      elements.board.focus({ preventScroll: true });
      return;
    }
    const target = nearestActive(focusCoordinate);
    if (!target) {
      elements.board.focus({ preventScroll: true });
      return;
    }
    setRovingTabStop(target);
    buttonAt(target.row, target.column)?.focus({ preventScroll: true });
  });
}

function anchorFromElement(element) {
  const button = element?.closest?.("button[data-row][data-column]");
  if (!button || !elements.board.contains(button)) return null;
  return { row: Number(button.dataset.row), column: Number(button.dataset.column) };
}

function previewAnchor() {
  return pointerAnchor ?? focusAnchor ?? selectedGroup[0] ?? null;
}

function updateHighlights(group = null) {
  const preview = group ?? (() => {
    const anchor = previewAnchor();
    return anchor ? getGroup(game.board, anchor.row, anchor.column) : [];
  })();
  const previewKeys = preview.length >= MIN_GROUP_SIZE ? groupKeys(preview) : new Set();
  const selectedKeys = groupKeys(selectedGroup);
  elements.board.querySelectorAll("button[data-row][data-column]").forEach((button) => {
    const key = keyOf(Number(button.dataset.row), Number(button.dataset.column));
    button.classList.toggle("is-preview", previewKeys.has(key));
    button.classList.toggle("is-selected", selectedKeys.has(key));
    button.setAttribute("aria-selected", String(selectedKeys.has(key)));
  });
}

function setReadout(title, copy, score = "—") {
  elements.boardMessage.innerHTML = "";
  const strong = document.createElement("strong");
  const span = document.createElement("span");
  strong.textContent = title;
  span.textContent = copy;
  elements.boardMessage.append(strong, span);
  elements.previewScore.textContent = score;
}

function updatePreview() {
  const anchor = previewAnchor();
  if (!anchor) {
    if (game.status === STATUS.CLEARED) {
      setReadout("摊位已经腾空", "全部灯灵都赶上了闭市前的夜风。", `总分 ${game.score}`);
    } else if (game.status === STATUS.STUCK) {
      setReadout("闭市钟已响", "剩余精灵都落了单；可撤销末步另寻路径。", `总分 ${game.score}`);
    } else {
      setReadout("寻找结伴的灯灵", "悬停或聚焦一只精灵，可预览整组与本次得分。", "—");
    }
    updateHighlights([]);
    return;
  }

  const color = game.board[anchor.row]?.[anchor.column];
  if (color === EMPTY || color === undefined) {
    updateHighlights([]);
    return;
  }
  const group = getGroup(game.board, anchor.row, anchor.column);
  if (group.length < MIN_GROUP_SIZE) {
    setReadout(`${SPIRITS[color].name}独自守摊`, "至少两只正交相连的同类灯灵才能撤离。", "不可撤");
    updateHighlights([]);
    return;
  }

  const points = scoreForGroup(group.length);
  if (sameGroup(group, selectedGroup)) {
    setReadout(
      `${group.length} 只${SPIRITS[color].name}已结伴`,
      "再次点击，或再按一次 Enter / Space，确认整组升空。",
      `+${points}`,
    );
  } else {
    setReadout(
      `发现 ${group.length} 只${SPIRITS[color].name}`,
      "这是完整合法群组；首次确认只会选亮，不会立刻移除。",
      `+${points}`,
    );
  }
  updateHighlights(group);
}

function announce(message, assertive = false) {
  const element = assertive ? elements.assertiveStatus : elements.toast;
  if (assertive) {
    element.textContent = "";
    requestAnimationFrame(() => { element.textContent = message; });
    return;
  }
  clearTimeout(toastTimer);
  element.textContent = message;
  element.classList.add("is-visible");
  toastTimer = window.setTimeout(() => element.classList.remove("is-visible"), 2100);
}

function captureFlights(group) {
  if (REDUCED_MOTION.matches) return [];
  const shellRect = elements.boardShell.getBoundingClientRect();
  return group.flatMap((point, index) => {
    const button = buttonAt(point.row, point.column);
    if (!button) return [];
    const rect = button.getBoundingClientRect();
    return [{
      x: rect.left - shellRect.left + rect.width / 2,
      y: rect.top - shellRect.top + rect.height / 2,
      color: Number(button.dataset.color),
      delay: index * 24,
    }];
  });
}

function releaseFlights(flights) {
  for (const flight of flights) {
    const particle = document.createElement("i");
    particle.className = `flight-particle spirit-type-${flight.color}`;
    particle.style.left = `${flight.x}px`;
    particle.style.top = `${flight.y}px`;
    particle.style.animationDelay = `${flight.delay}ms`;
    particle.style.setProperty("--drift", `${((flight.x * 17) % 26) - 13}px`);
    elements.flightLayer.append(particle);
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
    window.setTimeout(() => particle.remove(), 1100);
  }
}

function activateCell(row, column, keyboard = false) {
  if (game.status !== STATUS.PLAYING) {
    showOutcome();
    return;
  }
  const group = getGroup(game.board, row, column);
  if (group.length < MIN_GROUP_SIZE) {
    selectedGroup = [];
    audio.blocked();
    updatePreview();
    announce("这只灯灵没有同伴；盘面、步数和得分都没有改变。", true);
    return;
  }

  if (!sameGroup(group, selectedGroup)) {
    selectedGroup = group;
    focusCoordinate = { row, column };
    audio.select(group.length);
    renderBoard(selectionRenderOptions(focusCoordinate, keyboard));
    updatePreview();
    announce(`已选中${group.length}只${SPIRITS[game.board[row][column]].name}，再次确认才会撤离。`);
    return;
  }

  const preview = previewMove(game, row, column);
  if (!preview.accepted) return;
  const flights = captureFlights(preview.group);
  const previousGame = game;
  history.push(previousGame);
  game = applyMove(game, row, column).state;
  focusCoordinate = { row, column };
  selectedGroup = [];
  pointerAnchor = null;
  focusAnchor = null;
  const newBest = updateBest();
  audio.depart(preview.group.length);
  renderAll({ settle: true, focus: keyboard || lastInputWasKeyboard, preferredFocus: focusCoordinate });
  releaseFlights(flights);
  saveSession();
  const scoreCopy = preview.scoreDelta === 0 ? "本组按公式得 0 分" : `得到 ${preview.scoreDelta} 分`;
  announce(`送走 ${preview.group.length} 只灯灵，${scoreCopy}${newBest ? "，刷新本档最高分" : ""}。`, game.status !== STATUS.PLAYING);

  if (game.status !== STATUS.PLAYING) {
    if (game.status === STATUS.CLEARED) awardClear();
    clearTimeout(outcomeTimer);
    outcomeTimer = window.setTimeout(showOutcome, REDUCED_MOTION.matches ? 0 : 700);
  }
}

function newGame(seed, difficulty = game.difficulty, message = "新摊簿已经摊开。") {
  clearTimeout(outcomeTimer);
  if (elements.outcomeDialog.open) elements.outcomeDialog.close();
  game = createGame({ seed, difficulty });
  history = [];
  selectedGroup = [];
  pointerAnchor = null;
  focusAnchor = null;
  focusCoordinate = null;
  renderAll({ settle: true, focus: lastInputWasKeyboard });
  saveSession("新局已留档");
  audio.reset();
  announce(`${message} 牌号 ${game.seed}，${difficultyFor(game.difficulty).note}。`);
}

function nextGame() {
  newGame((game.seed + 1) >>> 0, game.difficulty, "闭市人换上了下一号摊簿。");
}

function restartGame() {
  newGame(game.seed, game.difficulty, "已回到这张摊簿的开市时刻。");
}

function undoMove() {
  if (history.length === 0) {
    audio.blocked();
    announce("还没有可以撤销的撤离。", true);
    return;
  }
  clearTimeout(outcomeTimer);
  if (elements.outcomeDialog.open) elements.outcomeDialog.close();
  game = history.pop();
  selectedGroup = [];
  pointerAnchor = null;
  focusAnchor = null;
  renderAll({ settle: true, focus: lastInputWasKeyboard, preferredFocus: focusCoordinate });
  saveSession("撤销已留档");
  audio.undo();
  announce(`已撤销末次撤离，回到 ${game.score} 分、剩余 ${countSpirits(game.board)} 只灯灵。`);
}

function showOutcome() {
  const cleared = game.status === STATUS.CLEARED;
  elements.outcomeDialog.dataset.status = game.status;
  elements.outcomeKicker.textContent = cleared ? "THE MARKET IS CLEAR" : "THE LAST BELL HAS RUNG";
  elements.outcomeTitle.textContent = cleared ? "全员升空" : "孤灯留市";
  elements.outcomeCopy.textContent = cleared
    ? "最后一盏微光越过屋檐，闭市钟终于可以落下。清盘没有额外奖励，账簿只记每次真实群组分。"
    : "盘面仍有灯灵，却已没有任何两只正交相邻的同类。撤销末步，或换一张摊簿再试。";
  elements.outcomeScore.textContent = String(game.score);
  elements.outcomeMoves.textContent = String(game.moves);
  elements.outcomeRemaining.textContent = String(countSpirits(game.board));
  elements.outcomeUndo.disabled = history.length === 0;
  if (!elements.outcomeDialog.open) elements.outcomeDialog.showModal();
  if (cleared) audio.complete(); else audio.stuck();
}

function updateMuteButton() {
  elements.mute.setAttribute("aria-pressed", String(preferences.muted));
  elements.mute.setAttribute("aria-label", preferences.muted ? "声音已静音，点击开启" : "声音开启，点击静音");
  elements.mute.title = preferences.muted ? "开启声音（M）" : "静音（M）";
}

function toggleMute() {
  preferences.muted = !preferences.muted;
  savePreferences();
  if (!preferences.muted) audio.unlock();
  audio.setMuted(preferences.muted);
  updateMuteButton();
  announce(preferences.muted ? "夜市声音已静音。" : "夜市声音已开启。");
}

function openRules() {
  if (!elements.rulesDialog.open) elements.rulesDialog.showModal();
}

function moveFocus(rowStep, columnStep) {
  const current = focusAnchor ?? focusCoordinate ?? nearestActive();
  if (!current) return;
  const config = difficultyFor(game.difficulty);
  let row = current.row + rowStep;
  let column = current.column + columnStep;
  while (row >= 0 && column >= 0 && row < config.height && column < config.width) {
    if (game.board[row][column] !== EMPTY) {
      setRovingTabStop({ row, column });
      buttonAt(row, column)?.focus();
      return;
    }
    row += rowStep;
    column += columnStep;
  }
}

function focusEdge(last = false) {
  const points = activePoints();
  const point = last ? points.at(-1) : points[0];
  if (!point) return;
  setRovingTabStop(point);
  buttonAt(point.row, point.column)?.focus();
}

elements.board.addEventListener("pointerover", (event) => {
  const anchor = anchorFromElement(event.target);
  if (!anchor) return;
  pointerAnchor = anchor;
  updatePreview();
});

elements.board.addEventListener("pointerleave", () => {
  pointerAnchor = null;
  updatePreview();
});

elements.board.addEventListener("focusin", (event) => {
  const anchor = anchorFromElement(event.target);
  if (!anchor) return;
  focusAnchor = anchor;
  setRovingTabStop(anchor);
  updatePreview();
});

elements.board.addEventListener("focusout", () => {
  requestAnimationFrame(() => {
    focusAnchor = anchorFromElement(document.activeElement);
    updatePreview();
  });
});

elements.board.addEventListener("click", (event) => {
  const anchor = anchorFromElement(event.target);
  if (!anchor) return;
  activateCell(anchor.row, anchor.column, event.detail === 0);
});

elements.board.addEventListener("keydown", (event) => {
  const anchor = anchorFromElement(event.target) ?? focusCoordinate;
  const directions = {
    ArrowUp: [-1, 0],
    w: [-1, 0],
    W: [-1, 0],
    ArrowRight: [0, 1],
    d: [0, 1],
    D: [0, 1],
    ArrowDown: [1, 0],
    s: [1, 0],
    S: [1, 0],
    ArrowLeft: [0, -1],
    a: [0, -1],
    A: [0, -1],
  };
  if (directions[event.key]) {
    event.preventDefault();
    moveFocus(...directions[event.key]);
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    focusEdge(event.key === "End");
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && anchor) {
    event.preventDefault();
    activateCell(anchor.row, anchor.column, true);
  }
});

elements.board.addEventListener("focus", () => {
  if (document.activeElement === elements.board) focusEdge(false);
});

elements.difficultyButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-difficulty]");
  if (!button || button.dataset.difficulty === game.difficulty) return;
  newGame(game.seed, button.dataset.difficulty, `已切换为${difficultyFor(button.dataset.difficulty).name}。`);
});

elements.seedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const seedText = elements.seedInput.value.trim();
  if (!seedText) {
    elements.seedInput.focus();
    announce("请输入数字或短语作为闭市牌号。", true);
    return;
  }
  newGame(normalizeSeed(seedText), game.difficulty, "同一牌号会生成完全相同的摊位。");
});

elements.newGame.addEventListener("click", nextGame);
elements.restart.addEventListener("click", restartGame);
elements.undo.addEventListener("click", undoMove);
elements.mute.addEventListener("click", toggleMute);
elements.rulesButton.addEventListener("click", openRules);
elements.footerRules.addEventListener("click", openRules);
elements.rulesClose.addEventListener("click", () => elements.rulesDialog.close());
elements.outcomeNext.addEventListener("click", nextGame);
elements.outcomeUndo.addEventListener("click", undoMove);
elements.outcomeStay.addEventListener("click", () => elements.outcomeDialog.close());

window.addEventListener("pointerdown", () => {
  lastInputWasKeyboard = false;
  audio.unlock();
}, { capture: true });

window.addEventListener("resize", () => requestAnimationFrame(syncBoardScale));

window.addEventListener("keydown", (event) => {
  lastInputWasKeyboard = true;
  audio.unlock();
  const target = event.target;
  if (target.matches("input, textarea, select") || target.isContentEditable) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === "Escape" && selectedGroup.length > 0 && !elements.rulesDialog.open && !elements.outcomeDialog.open) {
    selectedGroup = [];
    renderBoard({ preferredFocus: focusCoordinate });
    updatePreview();
    announce("已取消群组选择。");
    return;
  }
  if (elements.rulesDialog.open || elements.outcomeDialog.open) return;
  if (event.key === "u" || event.key === "U") undoMove();
  else if (event.key === "r" || event.key === "R") restartGame();
  else if (event.key === "n" || event.key === "N") nextGame();
  else if (event.key === "m" || event.key === "M") toggleMute();
  else if (event.key === "?") openRules();
});

elements.rulesDialog.addEventListener("click", (event) => {
  if (event.target === elements.rulesDialog) elements.rulesDialog.close();
});

elements.outcomeDialog.addEventListener("click", (event) => {
  if (event.target === elements.outcomeDialog) elements.outcomeDialog.close();
});

elements.outcomeDialog.addEventListener("close", focusBoardSurface);

updateMuteButton();
renderAll();
if (restoredSession) elements.saveState.textContent = "上次进度已恢复";
else saveSession("新局已留档");
if (game.status !== STATUS.PLAYING) {
  outcomeTimer = window.setTimeout(showOutcome, 250);
}
