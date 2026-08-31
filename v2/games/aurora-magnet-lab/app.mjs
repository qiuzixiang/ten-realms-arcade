import {
  POLARITY,
  SLOT_STATE,
  applyMove,
  evaluatePosition,
  keyOf,
  normalizePosition,
  pointFromKey,
  positionToJSON,
  slotForCell,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  difficultyById,
  findPuzzle,
  nextPuzzle,
  puzzleAt,
} from "./levels.mjs";
import {
  HISTORY_LIMIT,
  createSession,
  loadPreferences,
  loadSession,
  loadTutorialSeen,
  markTutorialSeen,
  savePreferences,
  saveSession,
} from "./persistence.mjs";
import {
  COMPLETION_EVENT,
  GAME_ID,
  READY_EVENT,
  awardCompletion,
  completionDetail,
  loadProfile,
  profileSummary,
  saveProfile,
} from "./rewards.mjs";
import { createDialogController } from "./dialog-controller.mjs";
import { completionDeliveryConfirmed, publishCompletion } from "./completion-bridge.mjs";
import {
  TOOL_IDS,
  cellAriaLabel,
  cloneHistorySnapshot,
  clueId,
  formatElapsed,
  moveForTool,
  nextCellKey,
  shouldHandleGlobalShortcut,
} from "./ui-helpers.mjs";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const VALID_DIFFICULTIES = DIFFICULTIES.map((difficulty) => difficulty.id);
const LONG_PRESS_MS = 560;

const elements = {
  assertiveStatus: document.querySelector("#assertive-status"),
  assignedCount: document.querySelector("#assigned-count"),
  bestCopy: document.querySelector("#best-copy"),
  bestMoves: document.querySelector("#best-moves"),
  board: document.querySelector("#magnet-board"),
  boardViewport: document.querySelector("#board-viewport"),
  checkButton: document.querySelector("#check-button"),
  clueCount: document.querySelector("#clue-count"),
  clueTotal: document.querySelector("#clue-total"),
  columnMinusClues: document.querySelector("#column-minus-clues"),
  columnPlusClues: document.querySelector("#column-plus-clues"),
  conflictCount: document.querySelector("#conflict-count"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  difficultyKicker: document.querySelector("#difficulty-kicker"),
  difficultyNote: document.querySelector("#difficulty-note"),
  fieldChamber: document.querySelector("#field-chamber"),
  moveCount: document.querySelector("#move-count"),
  muteButton: document.querySelector("#mute-button"),
  newPuzzleButton: document.querySelector("#new-puzzle-button"),
  nextExperimentButton: document.querySelector("#next-experiment-button"),
  puzzleGrid: document.querySelector("#puzzle-grid"),
  puzzleNote: document.querySelector("#puzzle-note"),
  puzzleSeed: document.querySelector("#puzzle-seed"),
  puzzleSubtitle: document.querySelector("#puzzle-subtitle"),
  puzzleTitle: document.querySelector("#puzzle-title"),
  restartButton: document.querySelector("#restart-button"),
  rowMinusClues: document.querySelector("#row-minus-clues"),
  rowPlusClues: document.querySelector("#row-plus-clues"),
  rulesButton: document.querySelector("#rules-button"),
  rulesCloseButton: document.querySelector("#rules-close-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  saveBeacon: document.querySelector("#save-beacon"),
  saveMessage: document.querySelector("#save-message"),
  slotTotal: document.querySelector("#slot-total"),
  spectrumCount: document.querySelector("#spectrum-count"),
  spectrumList: document.querySelector("#spectrum-list"),
  spectrumTotal: document.querySelector("#spectrum-total"),
  spectrumTutorialButton: document.querySelector("#spectrum-tutorial-button"),
  statusCopy: document.querySelector("#status-copy"),
  statusTitle: document.querySelector("#status-title"),
  stayButton: document.querySelector("#stay-button"),
  stormCount: document.querySelector("#storm-count"),
  toast: document.querySelector("#toast"),
  toolButtons: [...document.querySelectorAll("[data-tool]")],
  tutorialBullets: document.querySelector("#tutorial-bullets"),
  tutorialAnnouncement: document.querySelector("#tutorial-announcement"),
  tutorialButton: document.querySelector("#tutorial-button"),
  tutorialCounter: document.querySelector("#tutorial-counter"),
  tutorialDialog: document.querySelector("#tutorial-dialog"),
  tutorialDots: document.querySelector("#tutorial-dots"),
  tutorialImage: document.querySelector("#tutorial-image"),
  tutorialNextButton: document.querySelector("#tutorial-next-button"),
  tutorialPreviousButton: document.querySelector("#tutorial-previous-button"),
  tutorialSkipButton: document.querySelector("#tutorial-skip-button"),
  tutorialStep: document.querySelector("#tutorial-step"),
  tutorialTitle: document.querySelector("#tutorial-title"),
  tutorialBody: document.querySelector("#tutorial-body"),
  undoButton: document.querySelector("#undo-button"),
  victoryConflicts: document.querySelector("#victory-conflicts"),
  victoryCopy: document.querySelector("#victory-copy"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryLevel: document.querySelector("#victory-level"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryRewards: document.querySelector("#victory-rewards"),
  victoryTime: document.querySelector("#victory-time"),
  zeroConflictCount: document.querySelector("#zero-conflict-count"),
};

const clueContainers = Object.freeze({
  "columns:plus": elements.columnPlusClues,
  "columns:minus": elements.columnMinusClues,
  "rows:plus": elements.rowPlusClues,
  "rows:minus": elements.rowMinusClues,
});

const TUTORIAL_CARDS = Object.freeze([
  Object.freeze({
    step: "01 · 认识元件",
    title: "一眼分清正、负与中性",
    body: "每条描边都圈出一个固定双格槽位。正极是青色圆形“+ 正”，负极是洋红菱形“− 负”，中性是琥珀六边形。",
    bullets: Object.freeze(["文字、形状、颜色三重区分", "四周数字分别统计正极与负极"]),
    image: "./assets/tutorial-elements.svg",
    alt: "元素图鉴：固定双格槽位、青色圆形正极、洋红菱形负极、琥珀六边形中性模块和正负线索",
  }),
  Object.freeze({
    step: "02 · 装载操作",
    title: "点哪一端，正极就先落在哪一端",
    body: "点击空槽一端会装入正负磁极；继续点同一端会反转，再点会清空。右键、长按或 Space 则在中性、两个问号和清空之间循环。",
    bullets: Object.freeze(["槽位两端永远同步改变", "问号只是“不可能中性”的候选笔记"]),
    image: "./assets/tutorial-operation.svg",
    alt: "三个分开的操作步骤：选择槽位、装入正负或中性模块、核对四周线索",
  }),
  Object.freeze({
    step: "03 · 稳定磁场",
    title: "全部装满、线索吻合、同性不接触",
    body: "所有槽位进入正负或中性状态，已给正负数量全部精确满足，且没有两个相同磁极正交相邻时，实验舱才会生成极光。",
    bullets: Object.freeze(["破折号是缺失线索，数字 0 仍必须满足", "对角同极允许，中性不产生排斥"]),
    image: "./assets/tutorial-goal.svg",
    alt: "完成状态：四乘四棋盘全部装满，正负线索吻合且没有同极正交相邻，背景生成极光",
  }),
]);

const REWARD_LABELS = Object.freeze({
  clear: "首次完成该实验",
  spectrum: "解锁一段极光光谱",
  "zero-conflict": "零冲突实验记录",
  "rare-storm": "捕获稀有磁暴",
  "personal-best": "刷新最佳操作",
});

let storage = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}

const preferenceLoad = loadPreferences(storage, VALID_DIFFICULTIES);
let preferences = preferenceLoad.preferences;
const fallbackPuzzle = puzzleAt(preferences.difficulty, 0) ?? LEVELS[0];
const sessionLoad = loadSession(storage, LEVELS, fallbackPuzzle, { now: Date.now() });
let puzzle = sessionLoad.puzzle ?? findPuzzle(sessionLoad.session.puzzleId) ?? fallbackPuzzle;
let session = sessionLoad.session;
preferences.difficulty = puzzle.difficulty;
let position = normalizePosition(puzzle, session.position);
let evaluation = evaluatePosition(puzzle, position);
const profileLoad = loadProfile(storage, LEVELS);
let profile = profileLoad.profile;
let storageAvailable = preferenceLoad.available && sessionLoad.available && profileLoad.available;
let resumeAt = Date.now();
let tutorialCard = 0;
let activeKey = puzzle.slots[0].cells[0].key;
let cellElements = new Map();
let clueElements = new Map();
let audioContext = null;
let saveTimer = 0;
let toastTimer = 0;
let victoryTimer = 0;
let longPress = null;
let suppressedClickKey = null;

function anyDialogOpen(except = null) {
  return [...document.querySelectorAll("dialog[open]")].some((dialog) => dialog !== except);
}

const rulesController = createDialogController({
  dialog: elements.rulesDialog,
  initialFocus: elements.rulesCloseButton,
  fallbackFocus: elements.rulesButton,
});

const tutorialController = createDialogController({
  dialog: elements.tutorialDialog,
  initialFocus: elements.tutorialSkipButton,
  fallbackFocus: () => cellElements.get(activeKey) ?? elements.tutorialButton,
  onClose: () => markTutorialSeen(storage),
});

const victoryController = createDialogController({
  dialog: elements.victoryDialog,
  initialFocus: elements.nextExperimentButton,
  fallbackFocus: () => cellElements.get(activeKey) ?? elements.newPuzzleButton,
  closeOnEscape: false,
  closeOnCancel: false,
  closeOnBackdrop: false,
});

function currentElapsed(now = Date.now()) {
  if (session.completed) return session.elapsedMs;
  return session.elapsedMs + Math.max(0, now - resumeAt);
}

function syncSession(now = Date.now()) {
  session.position = positionToJSON(position);
  session.elapsedMs = currentElapsed(now);
  resumeAt = now;
  session.completed = evaluation.complete;
}

function setSaveMessage(message, saved = false) {
  window.clearTimeout(saveTimer);
  elements.saveMessage.textContent = storageAvailable ? message : "本机存档不可用，当前仍可游玩";
  elements.saveBeacon.classList.toggle("is-saved", saved && storageAvailable);
  if (saved && storageAvailable) {
    saveTimer = window.setTimeout(() => {
      elements.saveMessage.textContent = "本机实验记录已就绪";
      elements.saveBeacon.classList.remove("is-saved");
    }, 1800);
  }
}

function persistSession(message = "实验记录已保存") {
  syncSession();
  const saved = saveSession(storage, puzzle, session);
  storageAvailable = storageAvailable && saved;
  setSaveMessage(message, saved);
  return saved;
}

function persistPreferences() {
  const saved = savePreferences(storage, preferences, VALID_DIFFICULTIES);
  storageAvailable = storageAvailable && saved;
  return saved;
}

function showToast(message, error = false, duration = 2400) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", error);
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
  if (preferences.muted) return null;
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

function playSound(effect) {
  if (preferences.muted) return;
  if (effect.includes("forward") || effect.includes("reverse")) {
    tone(520, 0.12, { type: "triangle", endFrequency: 760 });
    tone(310, 0.14, { type: "sine", delay: 0.035, endFrequency: 230 });
  } else if (effect.includes("neutral")) {
    tone(360, 0.16, { type: "sine", gain: 0.014 });
  } else if (effect.includes("note")) {
    tone(820, 0.07, { type: "triangle", gain: 0.011 });
  } else if (effect === "undo") {
    tone(430, 0.13, { endFrequency: 620, gain: 0.014 });
  } else if (effect === "invalid") {
    tone(145, 0.12, { type: "sawtooth", endFrequency: 110, gain: 0.01 });
  } else if (effect === "check") {
    tone(680, 0.1, { endFrequency: 980, gain: 0.012 });
  } else if (effect === "win") {
    [293.66, 369.99, 440, 587.33].forEach((frequency, index) => {
      tone(frequency, 0.9, { type: "sine", gain: 0.018, delay: index * 0.14 });
      tone(frequency * 2, 0.55, { type: "triangle", gain: 0.005, delay: index * 0.14 + 0.04 });
    });
  }
}

function buildDifficultyButtons() {
  elements.difficultyButtons.replaceChildren();
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = difficulty.label;
    button.dataset.difficulty = difficulty.id;
    button.title = difficulty.note;
    button.addEventListener("click", () => changeDifficulty(difficulty.id));
    elements.difficultyButtons.append(button);
  }
}

function createClueElement(axis, polarity, index, target) {
  const id = clueId(axis, polarity, index);
  const isPlus = polarity === "plus";
  let element;
  if (target === null) {
    element = document.createElement("span");
    element.className = "edge-clue is-missing";
    element.setAttribute("aria-label", `${axis === "rows" ? `第 ${index + 1} 行` : `第 ${index + 1} 列`}${isPlus ? "正极" : "负极"}线索缺失`);
  } else {
    element = document.createElement("button");
    element.type = "button";
    element.className = "edge-clue";
    element.addEventListener("click", () => toggleClueMark(id));
  }
  element.dataset.clue = id;
  const symbol = document.createElement("i");
  symbol.className = `clue-pole clue-pole--${polarity}`;
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = isPlus ? "+" : "−";
  const value = document.createElement("b");
  value.className = "clue-target";
  value.textContent = target === null ? "—" : String(target);
  const tally = document.createElement("small");
  tally.className = "clue-tally";
  tally.textContent = target === null ? "" : "0";
  element.append(symbol, value, tally);
  clueElements.set(id, element);
  return element;
}

function buildClues() {
  clueElements = new Map();
  Object.values(clueContainers).forEach((container) => container.replaceChildren());
  for (const [axis, length] of [["columns", puzzle.width], ["rows", puzzle.height]]) {
    for (const polarity of ["plus", "minus"]) {
      const container = clueContainers[`${axis}:${polarity}`];
      container.style.setProperty(axis === "columns" ? "--columns" : "--rows", length);
      for (let index = 0; index < length; index += 1) {
        container.append(createClueElement(axis, polarity, index, puzzle.clues[axis][polarity][index]));
      }
    }
  }
}

function onPointerDown(event, key) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  window.clearTimeout(longPress?.timer);
  longPress = {
    pointerId: event.pointerId,
    key,
    timer: window.setTimeout(() => {
      if (!longPress || longPress.key !== key) return;
      suppressedClickKey = key;
      commitMove({ type: "cycle-secondary", key });
      if (navigator.vibrate) navigator.vibrate(24);
      longPress = null;
    }, LONG_PRESS_MS),
  };
}

function clearLongPress(event) {
  if (longPress && (event.pointerId === undefined || event.pointerId === longPress.pointerId)) {
    window.clearTimeout(longPress.timer);
    longPress = null;
  }
}

function buildBoard() {
  elements.board.replaceChildren();
  cellElements = new Map();
  elements.puzzleGrid.style.setProperty("--columns", puzzle.width);
  elements.puzzleGrid.style.setProperty("--rows", puzzle.height);
  elements.board.style.setProperty("--columns", puzzle.width);
  elements.board.style.setProperty("--rows", puzzle.height);
  elements.board.setAttribute("aria-rowcount", String(puzzle.height));
  elements.board.setAttribute("aria-colcount", String(puzzle.width));
  elements.board.setAttribute("aria-label", `${puzzle.title}，${puzzle.width} 列 ${puzzle.height} 行，固定双格槽位磁场棋盘`);

  if (!puzzle.cellSlots.has(activeKey)) activeKey = puzzle.slots[0].cells[0].key;
  for (let row = 0; row < puzzle.height; row += 1) {
    for (let column = 0; column < puzzle.width; column += 1) {
      const key = keyOf(row, column);
      const reference = puzzle.cellSlots.get(key);
      if (!reference) {
        const sealed = document.createElement("div");
        sealed.className = "slot-cell sealed-cell";
        sealed.setAttribute("role", "gridcell");
        sealed.setAttribute("aria-label", `第 ${row + 1} 行第 ${column + 1} 列，固定中性封闭空位`);
        sealed.innerHTML = '<span aria-hidden="true">✦</span><small aria-hidden="true">封闭</small>';
        elements.board.append(sealed);
        cellElements.set(key, sealed);
        continue;
      }
      const slot = slotForCell(puzzle, key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-cell";
      button.dataset.key = key;
      button.dataset.slot = slot.id;
      button.dataset.end = String(reference.end);
      button.dataset.orientation = slot.orientation;
      button.dataset.parity = String(slot.index % 3);
      button.setAttribute("role", "gridcell");
      button.tabIndex = key === activeKey ? 0 : -1;
      button.addEventListener("focus", () => { activeKey = key; });
      button.addEventListener("click", () => {
        if (suppressedClickKey === key) {
          suppressedClickKey = null;
          return;
        }
        performToolAt(key);
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        clearLongPress(event);
        commitMove({ type: "cycle-secondary", key });
      });
      button.addEventListener("pointerdown", (event) => onPointerDown(event, key));
      button.addEventListener("pointerup", clearLongPress);
      button.addEventListener("pointercancel", clearLongPress);
      button.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "mouse") clearLongPress(event);
      });
      button.addEventListener("keydown", (event) => handleCellKeydown(event, key));
      elements.board.append(button);
      cellElements.set(key, button);
    }
  }
}

function updateBoard() {
  for (const [key, element] of cellElements) {
    if (!puzzle.cellSlots.has(key)) continue;
    const slot = slotForCell(puzzle, key);
    const state = evaluation.states.get(slot.id) ?? SLOT_STATE.EMPTY;
    const polarity = evaluation.polarities.get(key);
    element.classList.toggle("is-plus", polarity === POLARITY.PLUS);
    element.classList.toggle("is-minus", polarity === POLARITY.MINUS);
    element.classList.toggle("is-neutral", polarity === POLARITY.NEUTRAL);
    element.classList.toggle("is-note", state === SLOT_STATE.EMPTY && evaluation.notes.has(slot.id));
    element.classList.toggle("is-conflict", evaluation.conflictKeys.has(key));
    element.classList.toggle("is-complete", evaluation.complete);
    element.replaceChildren();
    const well = document.createElement("span");
    well.className = "slot-well";
    well.setAttribute("aria-hidden", "true");
    if (polarity === POLARITY.PLUS || polarity === POLARITY.MINUS) {
      const pole = document.createElement("span");
      pole.className = `pole pole--${polarity === POLARITY.PLUS ? "plus" : "minus"}`;
      const sign = document.createElement("b");
      sign.textContent = polarity === POLARITY.PLUS ? "+" : "−";
      const word = document.createElement("small");
      word.textContent = polarity === POLARITY.PLUS ? "正" : "负";
      pole.append(sign, word);
      well.append(pole);
    } else if (polarity === POLARITY.NEUTRAL) {
      const neutral = document.createElement("span");
      neutral.className = "pole pole--neutral";
      neutral.innerHTML = "<b>中</b><small>N</small>";
      well.append(neutral);
    } else if (evaluation.notes.has(slot.id)) {
      const note = document.createElement("span");
      note.className = "candidate-note";
      note.textContent = "??";
      well.append(note);
    } else {
      const empty = document.createElement("span");
      empty.className = "empty-end";
      empty.textContent = element.dataset.end === "0" ? "Ⅰ" : "Ⅱ";
      well.append(empty);
    }
    if (evaluation.conflictKeys.has(key)) {
      const warning = document.createElement("span");
      warning.className = "conflict-mark";
      warning.textContent = "!";
      well.append(warning);
    }
    element.append(well);
    element.setAttribute("aria-label", cellAriaLabel(puzzle, key, evaluation));
    element.setAttribute("aria-invalid", String(evaluation.conflictKeys.has(key)));
    element.setAttribute("aria-pressed", String(state !== SLOT_STATE.EMPTY));
    element.tabIndex = key === activeKey ? 0 : -1;
  }
}

function updateClues() {
  for (const axis of ["rows", "columns"]) {
    for (const polarity of ["plus", "minus"]) {
      evaluation.clueResults[axis][polarity].forEach((result, index) => {
        const id = clueId(axis, polarity, index);
        const element = clueElements.get(id);
        if (!element) return;
        element.classList.toggle("is-at-target", result.atTarget);
        element.classList.toggle("is-exact", result.exact);
        element.classList.toggle("is-over", result.over);
        element.classList.toggle("is-impossible", result.impossible);
        element.classList.toggle("is-marked", session.markedClues.includes(id));
        const tally = element.querySelector(".clue-tally");
        if (tally && result.given) tally.textContent = String(result.count);
        if (element instanceof HTMLButtonElement) {
          const line = axis === "rows" ? `第 ${index + 1} 行` : `第 ${index + 1} 列`;
          const pole = polarity === "plus" ? "正极" : "负极";
          element.setAttribute("aria-label", `${line}${pole}线索 ${result.target}，当前 ${result.count}${result.over ? "，已超量" : result.exact ? "，已精确满足" : ""}；点按切换手动标灰`);
          element.setAttribute("aria-pressed", String(session.markedClues.includes(id)));
        }
      });
    }
  }
}

function updateMission() {
  const difficulty = difficultyById(puzzle.difficulty);
  elements.difficultyKicker.textContent = difficulty.kicker;
  elements.difficultyNote.textContent = difficulty.note;
  elements.puzzleTitle.textContent = puzzle.title;
  elements.puzzleSubtitle.textContent = puzzle.subtitle;
  elements.puzzleNote.textContent = puzzle.note;
  elements.puzzleSeed.textContent = `seed · ${puzzle.seed}`;
  elements.assignedCount.textContent = String(evaluation.assignedCount);
  elements.slotTotal.textContent = ` / ${evaluation.slotCount}`;
  elements.clueCount.textContent = String(evaluation.exactGivenClueCount);
  elements.clueTotal.textContent = ` / ${evaluation.givenClueCount}`;
  elements.conflictCount.textContent = String(evaluation.conflictPairs.length);
  elements.moveCount.textContent = String(session.moves);
  elements.undoButton.disabled = session.history.length === 0;
  elements.fieldChamber.classList.toggle("is-complete", evaluation.complete);
  elements.checkButton.classList.toggle("is-ready", evaluation.complete);
  document.body.classList.toggle("has-aurora", evaluation.complete);

  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    const active = button.dataset.difficulty === puzzle.difficulty;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  }
  for (const button of elements.toolButtons) {
    const active = button.dataset.tool === preferences.tool;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  }
  elements.muteButton.setAttribute("aria-pressed", String(preferences.muted));
  elements.muteButton.querySelector("b").textContent = preferences.muted ? "已静音" : "声音";

  if (evaluation.complete) {
    elements.statusTitle.textContent = "磁场完全稳定";
    elements.statusCopy.textContent = "所有观测值精确吻合，极光正在越过实验舱。";
  } else if (evaluation.conflictPairs.length > 0) {
    elements.statusTitle.textContent = "检测到同性排斥";
    elements.statusCopy.textContent = `有 ${evaluation.conflictPairs.length} 组相同磁极正交接触；红色感叹号同时提供形状提示。`;
  } else if (evaluation.overClueCount > 0) {
    elements.statusTitle.textContent = "观测值已经超量";
    elements.statusCopy.textContent = `${evaluation.overClueCount} 条已给线索超出目标，请反转或清空相关槽位。`;
  } else if (evaluation.impossibleClueCount > 0) {
    elements.statusTitle.textContent = "当前方案无法补足线索";
    elements.statusCopy.textContent = "剩余未填槽位已经不够，请撤销最近的实验操作。";
  } else if (evaluation.assignedCount === 0) {
    elements.statusTitle.textContent = "等待模块装载";
    elements.statusCopy.textContent = "点击任一槽位端点，把正极放在这一端。";
  } else {
    elements.statusTitle.textContent = "磁场正在收敛";
    elements.statusCopy.textContent = `还需明确 ${evaluation.slotCount - evaluation.assignedCount} 个槽位；候选问号不会填槽。`;
  }
}

function updateSpectrum() {
  const summary = profileSummary(profile, LEVELS);
  elements.spectrumList.replaceChildren();
  for (const level of LEVELS) {
    const unlocked = summary.unlocked.has(level.spectrum);
    const item = document.createElement("li");
    item.className = `spectrum-band spectrum-band--${level.spectrum}${unlocked ? " is-unlocked" : " is-locked"}`;
    const swatch = document.createElement("i");
    swatch.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    const title = document.createElement("b");
    title.textContent = unlocked ? level.title : "未解析光谱";
    const detail = document.createElement("small");
    detail.textContent = unlocked ? `${level.spectrum.toUpperCase()} · 已收录` : `${level.difficulty} · 待完成`;
    copy.append(title, detail);
    const mark = document.createElement("strong");
    mark.textContent = level.storm ? (unlocked ? "磁暴 ◆" : "磁暴 ◇") : (unlocked ? "◆" : "◇");
    item.append(swatch, copy, mark);
    elements.spectrumList.append(item);
  }
  elements.spectrumCount.textContent = String(summary.spectrumUnlocked);
  elements.spectrumTotal.textContent = String(summary.spectrumTotal);
  elements.zeroConflictCount.textContent = String(summary.zeroConflictExperiments);
  elements.stormCount.textContent = String(summary.stormsCaptured);
  const record = profile.records[puzzle.id];
  elements.bestMoves.textContent = record ? `${record.bestMoves} 步` : "—";
  elements.bestCopy.textContent = record
    ? `已完成 ${record.clears} 次${record.zeroConflict ? " · 含零冲突记录" : ""}`
    : "完成后会记录个人最佳；相同成绩不会重复奖励。";
}

function render() {
  evaluation = evaluatePosition(puzzle, position);
  updateBoard();
  updateClues();
  updateMission();
  updateSpectrum();
}

function selectTool(tool) {
  if (!TOOL_IDS.includes(tool)) return false;
  preferences.tool = tool;
  persistPreferences();
  updateMission();
  return true;
}

function performToolAt(key) {
  const slot = slotForCell(puzzle, key);
  if (!slot) return;
  const state = position.states.get(slot.id) ?? SLOT_STATE.EMPTY;
  const move = moveForTool(preferences.tool, key, state);
  if (move) commitMove(move);
}

function commitMove(move) {
  if (anyDialogOpen()) return false;
  const previousComplete = evaluation.complete;
  const result = applyMove(puzzle, position, move);
  if (!result.accepted) {
    playSound("invalid");
    const messages = {
      "neutral-locked": "中性模块须先用 Space、右键或中性工具移到候选，再清空。",
      "magnet-locked": "正负磁极上不能直接使用中性循环；请先用主操作清空。",
      occupied: "已有正式模块，候选笔记只能写在未填槽位。",
      unchanged: "这个槽位已经是该状态。",
    };
    showToast(messages[result.reason] ?? "当前操作不能应用在这里。", true);
    return false;
  }
  session.history.push(cloneHistorySnapshot({ ...session, position: positionToJSON(position) }));
  if (session.history.length > HISTORY_LIMIT) session.history.shift();
  position = { states: result.states, notes: result.notes };
  session.moves += 1;
  session.completed = false;
  session.completionReported = false;
  evaluation = evaluatePosition(puzzle, position);
  if (evaluation.conflictPairs.length > 0) session.conflictMoves += 1;
  playSound(result.effect);
  persistSession();
  render();
  if (!previousComplete && evaluation.complete) finishExperiment();
  return true;
}

function undo() {
  if (anyDialogOpen() || session.history.length === 0) return false;
  const previous = session.history.pop();
  position = normalizePosition(puzzle, previous.position);
  session.moves = previous.moves;
  session.conflictMoves = previous.conflictMoves;
  session.undos += 1;
  session.completed = false;
  session.completionReported = false;
  playSound("undo");
  persistSession("撤销结果已保存");
  render();
  announce("已撤销上一步实验操作");
  return true;
}

function restart() {
  if (anyDialogOpen()) return false;
  if (position.states.size === 0 && position.notes.size === 0) {
    showToast("实验舱已经是空的。", true);
    return false;
  }
  session.history.push(cloneHistorySnapshot({ ...session, position: positionToJSON(position) }));
  if (session.history.length > HISTORY_LIMIT) session.history.shift();
  position = { states: new Map(), notes: new Set() };
  session.moves = 0;
  session.conflictMoves = 0;
  session.completed = false;
  session.completionReported = false;
  evaluation = evaluatePosition(puzzle, position);
  resumeAt = Date.now();
  session.startedAt = resumeAt;
  session.elapsedMs = 0;
  persistSession("实验已重开，可撤销恢复");
  render();
  showToast("实验已重开；撤销可恢复刚才的盘面。");
  return true;
}

function loadFreshPuzzle(next) {
  window.clearTimeout(victoryTimer);
  if (elements.victoryDialog.open) victoryController.close({ reason: "next-puzzle", restoreFocus: false });
  puzzle = next;
  preferences.difficulty = puzzle.difficulty;
  session = createSession(puzzle, { now: Date.now() });
  position = { states: new Map(), notes: new Set() };
  evaluation = evaluatePosition(puzzle, position);
  resumeAt = Date.now();
  activeKey = puzzle.slots[0].cells[0].key;
  persistPreferences();
  buildClues();
  buildBoard();
  persistSession("新题面已保存");
  render();
  window.requestAnimationFrame(() => cellElements.get(activeKey)?.focus({ preventScroll: true }));
  announce(`已载入${puzzle.title}`);
}

function newPuzzle() {
  if (anyDialogOpen()) return false;
  loadFreshPuzzle(nextPuzzle(puzzle));
  playSound("check");
  return true;
}

function changeDifficulty(difficulty) {
  if (!VALID_DIFFICULTIES.includes(difficulty) || anyDialogOpen()) return false;
  if (difficulty === puzzle.difficulty) {
    showToast(`当前已经是${difficultyById(difficulty).label}级实验。`);
    return false;
  }
  loadFreshPuzzle(puzzleAt(difficulty, 0));
  return true;
}

function toggleClueMark(id) {
  const marked = new Set(session.markedClues);
  if (marked.has(id)) marked.delete(id);
  else marked.add(id);
  session.markedClues = [...marked].sort();
  persistSession("线索笔记已保存");
  updateClues();
}

function focusCell(key) {
  const target = cellElements.get(key);
  if (!(target instanceof HTMLButtonElement)) return false;
  activeKey = key;
  for (const [cellKey, element] of cellElements) {
    if (element instanceof HTMLButtonElement) element.tabIndex = cellKey === key ? 0 : -1;
  }
  target.focus({ preventScroll: true });
  return true;
}

function handleCellKeydown(event, key) {
  const next = nextCellKey(puzzle, key, event.key);
  if (next !== key) {
    event.preventDefault();
    focusCell(next);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    commitMove({ type: "cycle-primary", key });
  } else if (event.key === " ") {
    event.preventDefault();
    commitMove({ type: "cycle-secondary", key });
  } else if (event.key.toLowerCase() === "q") {
    event.preventDefault();
    commitMove({ type: "toggle-note", key });
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    commitMove({ type: "clear-slot", key });
  }
}

function checkField() {
  playSound("check");
  if (evaluation.complete) {
    showToast("磁场稳定：全部规则已经精确满足。", false, 3000);
    announce("核验通过，极光磁场稳定");
    return;
  }
  if (evaluation.conflictPairs.length) {
    showToast(`发现 ${evaluation.conflictPairs.length} 组同性正交冲突。`, true);
  } else if (evaluation.overClueCount) {
    showToast(`有 ${evaluation.overClueCount} 条线索已经超量。`, true);
  } else if (!evaluation.allAssigned) {
    showToast(`仍有 ${evaluation.slotCount - evaluation.assignedCount} 个槽位未明确装载。`, true);
  } else {
    showToast("槽位已装满，但仍有给定线索尚未吻合。", true);
  }
}

function finishExperiment() {
  if (session.completionReported || !evaluation.complete) return false;
  syncSession();
  const latestProfileLoad = loadProfile(storage, LEVELS);
  if (latestProfileLoad.restored || latestProfileLoad.corrupted || profile.totalClears === 0) {
    profile = latestProfileLoad.profile;
  }
  const award = awardCompletion(profile, puzzle, {
    moves: session.moves,
    undos: session.undos,
    conflictMoves: session.conflictMoves,
    elapsedMs: session.elapsedMs,
  }, {
    attemptId: [
      GAME_ID,
      "attempt",
      puzzle.id,
      session.startedAt,
      session.moves,
      session.undos,
      session.conflictMoves,
      session.elapsedMs,
    ].join(":"),
  });
  profile = award.profile;
  const profileSaved = saveProfile(storage, profile, LEVELS);
  storageAvailable = storageAvailable && profileSaved;
  session.completed = true;
  session.completionReported = false;
  let sessionSaved = saveSession(storage, puzzle, session);
  storageAvailable = storageAvailable && sessionSaved;
  const detail = completionDetail(puzzle, {
    moves: session.moves,
    undos: session.undos,
    conflictMoves: session.conflictMoves,
    elapsedMs: session.elapsedMs,
  }, award);
  const delivery = publishCompletion(window, detail, COMPLETION_EVENT);
  session.completionReported = completionDeliveryConfirmed(profileSaved, delivery);
  if (session.completionReported) {
    sessionSaved = saveSession(storage, puzzle, session);
    storageAvailable = storageAvailable && sessionSaved;
  }
  playSound("win");
  renderVictory(detail, award);
  render();
  scheduleVictoryDialog(reduceMotion.matches ? 0 : 720);
  return true;
}

function scheduleVictoryDialog(delay = 0) {
  window.clearTimeout(victoryTimer);
  victoryTimer = window.setTimeout(() => {
    if (!evaluation.complete || elements.victoryDialog.open) return;
    if (anyDialogOpen(elements.victoryDialog)) {
      scheduleVictoryDialog(240);
      return;
    }
    victoryController.show();
  }, delay);
}

function renderVictory(detail, award) {
  elements.victoryLevel.textContent = puzzle.title;
  elements.victoryMoves.textContent = `${detail.metrics.moves} 步`;
  elements.victoryConflicts.textContent = `${detail.metrics.conflictMoves} 次`;
  elements.victoryTime.textContent = formatElapsed(detail.metrics.elapsedMs);
  elements.victoryCopy.textContent = detail.metrics.zeroConflict
    ? "整场实验没有制造过同性接触；极光以最纯净的光谱穿过穹顶。"
    : "所有槽位与观测线索吻合，同性磁极最终保持了安全距离。";
  elements.victoryRewards.replaceChildren();
  const rewards = award.rewards.length ? award.rewards : [{ kind: "archive", id: detail.eventId }];
  for (const reward of rewards) {
    const item = document.createElement("li");
    item.innerHTML = `<span aria-hidden="true">${reward.kind === "archive" ? "◇" : "◆"}</span><b>${REWARD_LABELS[reward.kind] ?? "实验记录已归档"}</b>`;
    elements.victoryRewards.append(item);
  }
}

function renderTutorialCard() {
  const card = TUTORIAL_CARDS[tutorialCard];
  elements.tutorialStep.textContent = card.step;
  elements.tutorialTitle.textContent = card.title;
  elements.tutorialBody.textContent = card.body;
  elements.tutorialImage.src = card.image;
  elements.tutorialImage.alt = card.alt;
  elements.tutorialBullets.replaceChildren(...card.bullets.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  elements.tutorialAnnouncement.textContent = `${card.step}。${card.title}。${card.body}`;
  elements.tutorialCounter.textContent = `${tutorialCard + 1} / ${TUTORIAL_CARDS.length}`;
  elements.tutorialDots.replaceChildren(...TUTORIAL_CARDS.map((_, index) => {
    const dot = document.createElement("i");
    dot.classList.toggle("is-active", index === tutorialCard);
    return dot;
  }));
  elements.tutorialPreviousButton.disabled = tutorialCard === 0;
  elements.tutorialNextButton.textContent = tutorialCard === TUTORIAL_CARDS.length - 1 ? "开始实验" : "下一张";
}

function openTutorial(auto = false) {
  if (anyDialogOpen(elements.tutorialDialog) || elements.tutorialDialog.open) return false;
  tutorialCard = 0;
  renderTutorialCard();
  return tutorialController.show({
    returnFocus: auto ? cellElements.get(activeKey) : document.activeElement,
    initialFocus: elements.tutorialSkipButton,
  });
}

function nextTutorialCard() {
  if (tutorialCard < TUTORIAL_CARDS.length - 1) {
    tutorialCard += 1;
    renderTutorialCard();
  } else {
    tutorialController.close({ reason: "complete" });
  }
}

function previousTutorialCard() {
  if (tutorialCard === 0) return;
  tutorialCard -= 1;
  renderTutorialCard();
}

function openRules() {
  if (!anyDialogOpen(elements.rulesDialog)) rulesController.show();
}

function toggleMute() {
  preferences.muted = !preferences.muted;
  persistPreferences();
  updateMission();
  if (!preferences.muted) playSound("check");
  showToast(preferences.muted ? "合成音效已静音。" : "合成音效已开启。");
}

function snapshot() {
  syncSession();
  return JSON.parse(JSON.stringify({
    version: 1,
    gameId: GAME_ID,
    puzzle: { id: puzzle.id, seed: puzzle.seed, difficulty: puzzle.difficulty },
    position: positionToJSON(position),
    metrics: {
      moves: session.moves,
      undos: session.undos,
      conflictMoves: session.conflictMoves,
      elapsedMs: session.elapsedMs,
    },
    complete: evaluation.complete,
  }));
}

elements.newPuzzleButton.addEventListener("click", newPuzzle);
elements.undoButton.addEventListener("click", undo);
elements.restartButton.addEventListener("click", restart);
elements.muteButton.addEventListener("click", toggleMute);
elements.tutorialButton.addEventListener("click", () => openTutorial(false));
elements.spectrumTutorialButton.addEventListener("click", () => openTutorial(false));
elements.rulesButton.addEventListener("click", openRules);
elements.rulesCloseButton.addEventListener("click", () => rulesController.close({ reason: "button" }));
elements.checkButton.addEventListener("click", checkField);
elements.toolButtons.forEach((button) => button.addEventListener("click", () => selectTool(button.dataset.tool)));
elements.tutorialSkipButton.addEventListener("click", () => tutorialController.close({ reason: "skip" }));
elements.tutorialPreviousButton.addEventListener("click", previousTutorialCard);
elements.tutorialNextButton.addEventListener("click", nextTutorialCard);
elements.stayButton.addEventListener("click", () => victoryController.close({ reason: "stay" }));
elements.nextExperimentButton.addEventListener("click", () => loadFreshPuzzle(nextPuzzle(puzzle)));

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!shouldHandleGlobalShortcut({
    dialogOpen: anyDialogOpen(),
    targetTag: target?.tagName,
    contentEditable: target?.isContentEditable,
    targetIsBoardCell: target instanceof Element && target.matches(".slot-cell[data-key]"),
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  })) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
    event.preventDefault();
    undo();
  } else if (key === "r") {
    event.preventDefault();
    restart();
  } else if (key === "n") {
    event.preventDefault();
    newPuzzle();
  } else if (key === "m") {
    event.preventDefault();
    toggleMute();
  } else if (event.key === "?") {
    event.preventDefault();
    openRules();
  } else if (key === "p") {
    event.preventDefault();
    selectTool("polarity");
  } else if (key === "q") {
    event.preventDefault();
    selectTool("note");
  } else if (key === "x") {
    event.preventDefault();
    selectTool("erase");
  } else if (key === "c") {
    event.preventDefault();
    checkField();
  }
});

document.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
document.addEventListener("keydown", ensureAudio, { once: true, capture: true });

window.AuroraMagnetLab = Object.freeze({
  version: 1,
  gameId: GAME_ID,
  completionEvent: COMPLETION_EVENT,
  getSnapshot: snapshot,
  undo,
  restart,
  newPuzzle,
  setDifficulty: changeDifficulty,
  openTutorial: () => openTutorial(false),
});

buildDifficultyButtons();
buildClues();
buildBoard();
render();

if (sessionLoad.corrupted || preferenceLoad.corrupted || profileLoad.corrupted) {
  setSaveMessage("检测到损坏记录，已安全恢复为可用状态", false);
}
if (evaluation.complete && !session.completionReported) {
  window.setTimeout(finishExperiment, 0);
}
const tutorialState = loadTutorialSeen(storage);
if (!tutorialState.seen) window.setTimeout(() => openTutorial(true), 420);

window.dispatchEvent(new CustomEvent(READY_EVENT, {
  detail: { version: 1, gameId: GAME_ID, api: "window.AuroraMagnetLab" },
}));
