import {
  CELL,
  DIFFICULTIES,
  LEVELS,
  applyMove,
  cellAt,
  evaluatePosition,
  findLevel,
  isPlot,
  isRune,
  keyOf,
  levelsForDifficulty,
  normalizePosition,
  pointFromKey,
  positionToJSON,
} from "./logic.mjs";

const STORAGE_KEY = "five-realms.firefly-garden:v1";
const STORAGE_VERSION = 1;
const HISTORY_LIMIT = 80;
const COMPACT_BOARD_BREAKPOINT = 680;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const COMPLETION_TIERS = Object.freeze({ glimmer: 1, moonpath: 2, deepgarden: 3 });

const elements = {
  board: document.querySelector("#garden-board"),
  boardFrame: document.querySelector("#board-frame"),
  checkButton: document.querySelector("#check-button"),
  conflictCount: document.querySelector("#conflict-count"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  difficultyKicker: document.querySelector("#difficulty-kicker"),
  difficultyNote: document.querySelector("#difficulty-note"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  levelTitle: document.querySelector("#level-title"),
  litCount: document.querySelector("#lit-count"),
  markTool: document.querySelector("#mark-tool"),
  bulbTool: document.querySelector("#bulb-tool"),
  muteButton: document.querySelector("#mute-button"),
  newGameButton: document.querySelector("#new-game-button"),
  nightMessage: document.querySelector("#night-message"),
  plotTotal: document.querySelector("#plot-total"),
  progressBar: document.querySelector("#progress-bar"),
  progressOrb: document.querySelector("#progress-orb"),
  progressPercent: document.querySelector("#progress-percent"),
  restartButton: document.querySelector("#restart-button"),
  rulesButton: document.querySelector("#rules-button"),
  rulesCloseButton: document.querySelector("#rules-close-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  runeCount: document.querySelector("#rune-count"),
  runeTotal: document.querySelector("#rune-total"),
  saveState: document.querySelector("#save-state"),
  stepCount: document.querySelector("#step-count"),
  toast: document.querySelector("#toast"),
  assertiveStatus: document.querySelector("#assertive-status"),
  undoButton: document.querySelector("#undo-button"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryPlots: document.querySelector("#victory-plots"),
  victorySteps: document.querySelector("#victory-steps"),
  nextLevelButton: document.querySelector("#next-level-button"),
  stayButton: document.querySelector("#stay-button"),
};

let audioContext = null;
let toastTimer = 0;
let reviewTimer = 0;
let saveTimer = 0;
let cellElements = new Map();
let focusKey = null;
let currentEvaluation = null;
let storageAvailable = true;

const defaultState = () => ({
  level: LEVELS[0],
  difficulty: DIFFICULTIES[0].id,
  bulbs: new Set(),
  marks: new Set(),
  steps: 0,
  history: [],
  completed: false,
  completionReported: false,
  muted: false,
  tool: "bulb",
  stats: {
    completedByDifficulty: Object.fromEntries(DIFFICULTIES.map(({ id }) => [id, 0])),
    bestMovesByPuzzle: {},
  },
});

let state = defaultState();

function setNightMessage(title, copy, tone = "normal") {
  const titleElement = elements.nightMessage.querySelector("strong");
  const copyElement = elements.nightMessage.querySelector("p span");
  titleElement.textContent = title;
  copyElement.textContent = copy;
  elements.nightMessage.classList.toggle("is-warning", tone === "warning");
  elements.nightMessage.classList.toggle("is-success", tone === "success");
}

function showToast(message, isError = false, duration = 2600) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}

function announceError(message) {
  elements.assertiveStatus.textContent = "";
  window.requestAnimationFrame(() => {
    elements.assertiveStatus.textContent = message;
  });
}

function setSavedMessage(message = "刚刚已自动保存") {
  if (!storageAvailable) {
    elements.saveState.textContent = "此浏览器未开放本机存档";
    return;
  }
  elements.saveState.textContent = message;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    elements.saveState.textContent = "每一步都会留在本机";
  }, 2400);
}

function snapshot() {
  return {
    ...positionToJSON(state),
    steps: state.steps,
  };
}

function isValidSavedKeyArray(level, value) {
  if (!Array.isArray(value) || value.some((key) => typeof key !== "string")) return false;
  const normalized = normalizePosition(level, { bulbs: value }).bulbs;
  return normalized.size === new Set(value).size;
}

function parseSnapshot(level, value) {
  if (!value || !isValidSavedKeyArray(level, value.bulbs) || !isValidSavedKeyArray(level, value.marks)) {
    return null;
  }
  if (!Number.isInteger(value.steps) || value.steps < 0) return null;
  const normalized = normalizePosition(level, value);
  if (normalized.bulbs.size + normalized.marks.size !== new Set([...value.bulbs, ...value.marks]).size) {
    return null;
  }
  return { bulbs: normalized.bulbs, marks: normalized.marks, steps: value.steps };
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { restored: false };
    const saved = JSON.parse(raw);
    if (saved.version !== STORAGE_VERSION || !saved.active) throw new Error("Unsupported save version");

    const level = findLevel(saved.active.levelId);
    if (!level || level.difficulty !== saved.active.difficulty) throw new Error("Unknown saved level");
    const active = parseSnapshot(level, saved.active);
    if (!active) throw new Error("Invalid saved position");

    const history = Array.isArray(saved.active.history)
      ? saved.active.history.slice(-HISTORY_LIMIT).map((item) => parseSnapshot(level, item))
      : [];
    if (history.some((item) => item === null)) throw new Error("Invalid saved history");

    const savedStats = saved.stats && typeof saved.stats === "object" ? saved.stats : {};
    const completedByDifficulty = Object.fromEntries(DIFFICULTIES.map(({ id }) => [
      id,
      Math.max(0, Number(savedStats.completedByDifficulty?.[id]) || 0),
    ]));
    const bestMovesByPuzzle = savedStats.bestMovesByPuzzle && typeof savedStats.bestMovesByPuzzle === "object"
      ? { ...savedStats.bestMovesByPuzzle }
      : {};

    const completed = evaluatePosition(level, active).complete;
    state = {
      level,
      difficulty: level.difficulty,
      bulbs: active.bulbs,
      marks: active.marks,
      steps: active.steps,
      history,
      completed,
      completionReported: completed || saved.active.completionReported === true,
      muted: Boolean(saved.preferences?.muted),
      tool: "bulb",
      stats: { completedByDifficulty, bestMovesByPuzzle },
    };
    return { restored: true };
  } catch (error) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      storageAvailable = false;
    }
    state = defaultState();
    return { restored: false, invalid: true };
  }
}

function writeSave() {
  const active = snapshot();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      preferences: { muted: state.muted },
      active: {
        levelId: state.level.id,
        difficulty: state.difficulty,
        ...active,
        completed: state.completed,
        completionReported: state.completionReported,
        history: state.history.map((item) => ({
          bulbs: [...item.bulbs],
          marks: [...item.marks],
          steps: item.steps,
        })),
        updatedAt: new Date().toISOString(),
      },
      stats: state.stats,
    }));
    storageAvailable = true;
    setSavedMessage();
  } catch {
    storageAvailable = false;
    setSavedMessage();
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
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.028, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSound(effect, amount = 1) {
  if (state.muted) return;
  if (effect === "bulb-added") {
    tone(740, 0.18, { gain: 0.026 });
    tone(1110, 0.15, { gain: 0.013, delay: 0.035 });
    for (let index = 0; index < Math.min(3, Math.max(0, amount - 1)); index += 1) {
      tone(860 + index * 120, 0.12, { gain: 0.008, delay: 0.07 + index * 0.045 });
    }
  } else if (effect === "bulb-removed") {
    tone(510, 0.17, { type: "sine", gain: 0.02, endFrequency: 280 });
  } else if (effect === "mark-added" || effect === "mark-removed") {
    tone(effect === "mark-added" ? 430 : 370, 0.08, { type: "triangle", gain: 0.016 });
  } else if (effect === "invalid") {
    tone(145, 0.12, { type: "triangle", gain: 0.02 });
    tone(124, 0.14, { type: "triangle", gain: 0.012, delay: 0.11 });
  } else if (effect === "undo") {
    tone(490, 0.1, { type: "sine", gain: 0.014, endFrequency: 620 });
  } else if (effect === "win") {
    [294, 440, 587, 740].forEach((frequency, index) => {
      tone(frequency, 1.35 - index * 0.1, { gain: 0.022, delay: index * 0.17 });
      tone(frequency * 2, 0.85, { gain: 0.006, delay: index * 0.17 + 0.04 });
    });
  }
}

function createFlowerMarkup() {
  return `
    <span class="soil-grain" aria-hidden="true"></span>
    <span class="light-ribbon" aria-hidden="true"></span>
    <span class="flower" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></span>
    <span class="firefly" aria-hidden="true"><i></i></span>
    <span class="forbidden" aria-hidden="true"></span>
    <span class="cell-state" aria-hidden="true"></span>
  `;
}

function plotAriaLabel(row, column, evaluation) {
  const key = keyOf(row, column);
  const parts = [`第 ${row + 1} 行第 ${column + 1} 列，花圃`];
  if (evaluation.bulbs.has(key)) parts.push("有萤火");
  else if (evaluation.marks.has(key)) parts.push("标记为这里不能放");
  else parts.push("空着");
  parts.push(evaluation.light.has(key) ? "已点亮" : "未点亮");
  if (evaluation.conflicts.has(key)) parts.push("与另一只萤火冲光");
  return parts.join("，");
}

function buildBoard() {
  elements.board.replaceChildren();
  cellElements = new Map();
  elements.board.style.setProperty("--columns", state.level.width);
  elements.board.setAttribute("aria-rowcount", state.level.height);
  elements.board.setAttribute("aria-colcount", state.level.width);
  elements.board.setAttribute("aria-label", `${state.level.title}，${state.level.width} 乘 ${state.level.height} 夜庭花圃`);

  const firstPlot = state.level.rows.flatMap((row, rowIndex) => (
    [...row].map((cell, columnIndex) => ({ cell, key: keyOf(rowIndex, columnIndex) }))
  )).find(({ cell }) => cell === CELL.PLOT)?.key;
  focusKey = firstPlot ?? null;

  for (let row = 0; row < state.level.height; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";
    rowElement.setAttribute("role", "row");
    rowElement.style.display = "contents";
    for (let column = 0; column < state.level.width; column += 1) {
      const cell = cellAt(state.level, row, column);
      const key = keyOf(row, column);
      let element;
      if (isPlot(cell)) {
        element = document.createElement("button");
        element.type = "button";
        element.className = "board-cell plot";
        element.dataset.key = key;
        element.dataset.row = String(row);
        element.dataset.column = String(column);
        element.setAttribute("role", "gridcell");
        element.setAttribute("aria-rowindex", String(row + 1));
        element.setAttribute("aria-colindex", String(column + 1));
        element.tabIndex = key === focusKey ? 0 : -1;
        element.innerHTML = createFlowerMarkup();
        element.addEventListener("focus", () => {
          focusKey = key;
          updateRovingTabIndex();
        });
      } else {
        element = document.createElement("div");
        element.className = `board-cell ruin${isRune(cell) ? " rune" : ""}`;
        element.dataset.key = key;
        element.setAttribute("role", "gridcell");
        element.setAttribute("aria-rowindex", String(row + 1));
        element.setAttribute("aria-colindex", String(column + 1));
        if (isRune(cell)) {
          element.innerHTML = `<span class="rune-number" aria-hidden="true">${cell}</span>`;
        }
      }
      cellElements.set(key, element);
      rowElement.append(element);
    }
    elements.board.append(rowElement);
  }

  syncBoardScale();
  window.requestAnimationFrame(syncBoardScale);
}

function syncBoardScale() {
  if (!elements.boardFrame || !elements.board) return;
  if (window.innerWidth > COMPACT_BOARD_BREAKPOINT) {
    elements.board.style.removeProperty("--cell");
    elements.boardFrame.scrollLeft = 0;
    return;
  }

  const frameStyle = window.getComputedStyle(elements.boardFrame);
  const boardStyle = window.getComputedStyle(elements.board);
  const framePadding = (Number.parseFloat(frameStyle.paddingLeft) || 0)
    + (Number.parseFloat(frameStyle.paddingRight) || 0);
  const boardChrome = (Number.parseFloat(boardStyle.paddingLeft) || 0)
    + (Number.parseFloat(boardStyle.paddingRight) || 0)
    + (Number.parseFloat(boardStyle.borderLeftWidth) || 0)
    + (Number.parseFloat(boardStyle.borderRightWidth) || 0);
  const gap = Number.parseFloat(boardStyle.columnGap) || 0;
  const columns = state.level.width;
  const availableWidth = Math.max(0, elements.boardFrame.clientWidth - framePadding - boardChrome);
  const fittedCell = Math.floor((availableWidth - gap * (columns - 1)) / columns);
  elements.board.style.setProperty("--cell", `${Math.min(68, Math.max(24, fittedCell))}px`);
  elements.boardFrame.scrollLeft = 0;
}

function updateRovingTabIndex() {
  for (const [key, element] of cellElements) {
    if (element.matches("button")) element.tabIndex = key === focusKey ? 0 : -1;
  }
}

function illuminatingAxes(key, evaluation) {
  const target = pointFromKey(key);
  const axes = { horizontal: false, vertical: false };
  for (const sourceKey of evaluation.light.get(key) ?? []) {
    if (sourceKey === key) continue;
    const source = pointFromKey(sourceKey);
    if (source.row === target.row) axes.horizontal = true;
    if (source.column === target.column) axes.vertical = true;
  }
  return axes;
}

function updateToolButtons() {
  const bulbActive = state.tool === "bulb";
  elements.bulbTool.classList.toggle("is-active", bulbActive);
  elements.markTool.classList.toggle("is-active", !bulbActive);
  elements.bulbTool.setAttribute("aria-pressed", String(bulbActive));
  elements.markTool.setAttribute("aria-pressed", String(!bulbActive));
}

function updateDifficultyButtons() {
  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficulty));
  }
  const difficulty = DIFFICULTIES.find(({ id }) => id === state.difficulty);
  elements.difficultyNote.textContent = difficulty.note;
  const index = levelsForDifficulty(state.difficulty).findIndex(({ id }) => id === state.level.id);
  elements.difficultyKicker.textContent = `${difficulty.label}庭 · ${String(index + 1).padStart(2, "0")}`;
}

function render(previousLight = null, originKey = null) {
  const evaluation = evaluatePosition(state.level, state);
  currentEvaluation = evaluation;
  const previous = previousLight instanceof Map ? previousLight : new Map();
  const origin = pointFromKey(originKey);

  for (let row = 0; row < state.level.height; row += 1) {
    for (let column = 0; column < state.level.width; column += 1) {
      const key = keyOf(row, column);
      const element = cellElements.get(key);
      const cell = cellAt(state.level, row, column);
      if (isPlot(cell)) {
        const lit = evaluation.light.has(key);
        const hasBulb = evaluation.bulbs.has(key);
        const isMarked = evaluation.marks.has(key);
        const hasConflict = evaluation.conflicts.has(key);
        const axes = illuminatingAxes(key, evaluation);
        element.classList.toggle("is-lit", lit);
        element.classList.toggle("has-bulb", hasBulb);
        element.classList.toggle("is-marked", isMarked);
        element.classList.toggle("has-conflict", hasConflict);
        element.classList.toggle("ray-horizontal", axes.horizontal);
        element.classList.toggle("ray-vertical", axes.vertical);
        element.classList.remove("is-review-unlit", "is-invalid");
        element.dataset.visualState = hasConflict
          ? "萤火冲光"
          : hasBulb
            ? "萤火实体"
            : isMarked
              ? "禁放标记"
              : lit
                ? "照亮范围"
                : "沉睡花圃";
        element.setAttribute("aria-label", plotAriaLabel(row, column, evaluation));
        if (!previous.has(key) && lit && previousLight) {
          const distance = origin ? Math.abs(origin.row - row) + Math.abs(origin.column - column) : 0;
          element.style.setProperty("--wave-delay", `${Math.min(distance, 8) * 42}ms`);
          element.classList.remove("just-lit");
          window.requestAnimationFrame(() => element.classList.add("just-lit"));
          window.setTimeout(() => element.classList.remove("just-lit"), 1100);
        }
      } else if (isRune(cell)) {
        const rune = evaluation.runes.get(key);
        element.classList.toggle("rune-exact", rune.exact);
        element.classList.toggle("rune-impossible", rune.impossible);
        element.classList.remove("is-review-error");
        element.setAttribute(
          "aria-label",
          `第 ${row + 1} 行第 ${column + 1} 列，符文石要求 ${rune.target} 只相邻萤火，目前 ${rune.count} 只${rune.exact ? "，已满足" : rune.impossible ? "，当前已无法满足" : "，尚未满足"}`,
        );
      } else {
        element.setAttribute("aria-label", `第 ${row + 1} 行第 ${column + 1} 列，遮光遗迹`);
      }
    }
  }

  const percent = Math.round(evaluation.lightProgress * 100);
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressOrb.style.setProperty("--progress", `${percent}%`);
  elements.litCount.textContent = String(evaluation.litCount);
  elements.plotTotal.textContent = `/ ${evaluation.totalPlots}`;
  elements.runeCount.textContent = String(evaluation.exactRunes);
  elements.runeTotal.textContent = `/ ${evaluation.totalRunes}`;
  elements.conflictCount.textContent = String(evaluation.conflicts.size);
  elements.stepCount.textContent = String(state.steps);
  elements.levelTitle.textContent = state.level.title;
  elements.undoButton.disabled = state.history.length === 0;
  elements.board.classList.toggle("is-complete", evaluation.complete);
  document.body.classList.toggle("has-live-conflicts", evaluation.conflicts.size > 0);
  document.body.classList.toggle("is-dawn", state.completed || evaluation.complete);

  if (evaluation.complete) {
    setNightMessage("黎明已到", "三条约定都已满足。整座花庭在晨光里醒来。", "success");
  } else if (evaluation.conflicts.size > 0) {
    setNightMessage("萤火彼此照见了", `有 ${evaluation.conflicts.size} 只萤火正在冲光；移走其中一只即可继续。`, "warning");
  } else {
    const impossibleRunes = [...evaluation.runes.values()].filter(({ impossible }) => impossible).length;
    if (impossibleRunes > 0) {
      setNightMessage("符文正在发烫", `${impossibleRunes} 块符文石的相邻数量已无法满足，请调整标记或萤火。`, "warning");
    } else if (percent === 0) {
      setNightMessage("花庭仍在沉睡", "点亮一块花圃，花朵会沿光路逐格开放。");
    } else {
      setNightMessage("月光正在蔓延", `已唤醒 ${evaluation.litCount} / ${evaluation.totalPlots} 块花圃，再看看未见光的角落。`);
    }
  }

  updateToolButtons();
  updateDifficultyButtons();
}

function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
}

function invalidMove(key, reason) {
  const messages = {
    marked: "这里已有禁放标记；先清除标记，才能安放萤火。",
    lit: "这里已经见光，不能新增“这里不能放”标记。",
    bulb: "这里住着萤火；先移走它，才能添加禁放标记。",
    "not-a-plot": "遗迹与符文石上不能落子。",
    "unknown-move": "这次操作没有落在可用的花圃工具上。",
  };
  const message = messages[reason] ?? "这一步不能落下。";
  const element = cellElements.get(key);
  if (element) {
    element.classList.remove("is-invalid");
    window.requestAnimationFrame(() => element.classList.add("is-invalid"));
    window.setTimeout(() => element.classList.remove("is-invalid"), 650);
  }
  showToast(message, true);
  announceError(message);
  playSound("invalid");
}

function reportRealmCompletion() {
  const payload = {
    levelId: `${state.difficulty}:${state.level.id}`,
    tier: COMPLETION_TIERS[state.difficulty] ?? 1,
    moves: state.steps,
  };
  if (typeof window.RealmArcade?.complete === "function") window.RealmArcade.complete(payload);
  else (window.__realmCompletionQueue ??= []).push(payload);
}

function completeGarden() {
  if (state.completed) return;
  state.completed = true;
  state.stats.completedByDifficulty[state.difficulty] += 1;
  const previousBest = Number(state.stats.bestMovesByPuzzle[state.level.id]);
  if (!previousBest || state.steps < previousBest) state.stats.bestMovesByPuzzle[state.level.id] = state.steps;
  if (!state.completionReported) {
    state.completionReported = true;
    reportRealmCompletion();
  }
  document.body.classList.add("is-dawn");
  elements.victorySteps.textContent = String(state.steps);
  elements.victoryPlots.textContent = `${currentEvaluation.totalPlots} / ${currentEvaluation.totalPlots}`;
  writeSave();
  playSound("win");
  const openVictory = () => {
    if (!elements.victoryDialog.open) elements.victoryDialog.showModal();
  };
  window.setTimeout(openVictory, reduceMotion.matches ? 0 : 620);
}

function activateCell(key, moveType) {
  if (state.completed) {
    showToast("这座花庭已经迎来黎明。可撤销一步，或开启新庭院。", false, 3200);
    return;
  }
  const previousEvaluation = evaluatePosition(state.level, state);
  const result = applyMove(state.level, state, { type: moveType, key });
  if (!result.accepted) {
    invalidMove(key, result.reason);
    return;
  }

  pushHistory();
  state.bulbs = result.bulbs;
  state.marks = result.marks;
  state.steps += 1;
  const nextEvaluation = evaluatePosition(state.level, state);
  const newlyLit = [...nextEvaluation.light.keys()].filter((plotKey) => !previousEvaluation.light.has(plotKey)).length;
  render(previousEvaluation.light, key);
  playSound(result.effect, newlyLit);

  if (currentEvaluation.conflicts.size > 0) {
    const message = `冲光：${currentEvaluation.conflicts.size} 只萤火彼此照见。`;
    showToast(message, true);
    announceError(message);
    if (result.effect !== "bulb-removed") playSound("invalid");
  } else {
    const impossible = [...currentEvaluation.runes.values()].filter(({ impossible }) => impossible).length;
    if (impossible > 0) {
      const message = `${impossible} 块符文石的相邻萤火数量目前已无法满足。`;
      showToast(message, true);
      announceError(message);
      playSound("invalid");
    }
  }

  writeSave();
  if (currentEvaluation.complete) completeGarden();
}

function setTool(tool) {
  state.tool = tool;
  updateToolButtons();
  showToast(tool === "bulb" ? "萤火工具：点击花圃安放或移走萤火。" : "禁放工具：点击未点亮花圃添加或清除标记。", false, 1900);
}

function clearReviewClasses() {
  window.clearTimeout(reviewTimer);
  elements.board.classList.remove("is-reviewing");
  elements.boardFrame.classList.remove("has-check-failure");
  for (const element of cellElements.values()) {
    element.classList.remove("is-review-unlit", "is-review-error");
  }
}

function reviewGarden() {
  clearReviewClasses();
  const evaluation = evaluatePosition(state.level, state);
  if (evaluation.complete) {
    if (!state.completed) completeGarden();
    else if (!elements.victoryDialog.open) elements.victoryDialog.showModal();
    return;
  }

  for (const key of evaluation.unlit) cellElements.get(key)?.classList.add("is-review-unlit");
  for (const [key, rune] of evaluation.runes) {
    if (!rune.exact) cellElements.get(key)?.classList.add("is-review-error");
  }
  elements.board.classList.add("is-reviewing");
  elements.boardFrame.classList.add("has-check-failure");

  const unmetRunes = [...evaluation.runes.values()].filter(({ exact }) => !exact).length;
  const details = [];
  if (evaluation.unlit.size) details.push(`${evaluation.unlit.size} 块花圃未见光`);
  if (evaluation.conflicts.size) details.push(`${evaluation.conflicts.size} 只萤火冲光`);
  if (unmetRunes) details.push(`${unmetRunes} 块符文未满足`);
  const message = `巡夜未通过：${details.join("，")}。局面没有被改变。`;
  showToast(message, true, 4200);
  announceError(message);
  playSound("invalid");
  reviewTimer = window.setTimeout(clearReviewClasses, 3200);
}

function closeVictory() {
  if (elements.victoryDialog.open) elements.victoryDialog.close();
}

function startLevel(level, message) {
  closeVictory();
  clearReviewClasses();
  state.level = level;
  state.difficulty = level.difficulty;
  state.bulbs = new Set();
  state.marks = new Set();
  state.steps = 0;
  state.history = [];
  state.completed = false;
  state.completionReported = false;
  state.tool = "bulb";
  document.body.classList.remove("is-dawn");
  buildBoard();
  render();
  writeSave();
  if (message) showToast(message);
}

function nextLevelFor(difficulty) {
  const levels = levelsForDifficulty(difficulty);
  const currentIndex = levels.findIndex(({ id }) => id === state.level.id);
  return levels[currentIndex < 0 ? 0 : (currentIndex + 1) % levels.length];
}

function startNewGame(difficulty = state.difficulty) {
  const next = nextLevelFor(difficulty);
  startLevel(next, `新庭院已开放：${next.title}`);
}

function restartGame() {
  startLevel(state.level, "月色倒流：这座花庭已经重开。");
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    showToast("还没有可以撤销的脚步。");
    return;
  }
  closeVictory();
  clearReviewClasses();
  state.bulbs = new Set(previous.bulbs);
  state.marks = new Set(previous.marks);
  state.steps = previous.steps;
  state.completed = false;
  document.body.classList.remove("is-dawn");
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
      candidate.focus();
      return;
    }
    row += rowStep;
    column += columnStep;
  }
}

function openRules() {
  if (!elements.rulesDialog.open) elements.rulesDialog.showModal();
}

function toggleMute() {
  state.muted = !state.muted;
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "声音已静音，点击开启" : "声音已开启，点击静音");
  elements.muteButton.querySelector(".button-label").textContent = state.muted ? "静音" : "声音";
  if (!state.muted) {
    ensureAudio();
    playSound("mark-added");
  }
  writeSave();
  showToast(state.muted ? "花庭已经静音。" : "花庭声音已经开启。");
}

function createDifficultyButtons() {
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty.id;
    button.textContent = difficulty.label;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${difficulty.label}难度，${difficulty.note}`);
    button.addEventListener("click", () => startNewGame(difficulty.id));
    elements.difficultyButtons.append(button);
  }
}

elements.board.addEventListener("click", (event) => {
  const cell = event.target.closest("button.board-cell");
  if (!cell) return;
  focusKey = cell.dataset.key;
  updateRovingTabIndex();
  activateCell(cell.dataset.key, state.tool === "mark" ? "toggle-mark" : "toggle-bulb");
});

elements.board.addEventListener("contextmenu", (event) => {
  const cell = event.target.closest("button.board-cell");
  if (!cell) return;
  event.preventDefault();
  focusKey = cell.dataset.key;
  updateRovingTabIndex();
  activateCell(cell.dataset.key, "toggle-mark");
});

elements.board.addEventListener("keydown", (event) => {
  const cell = event.target.closest("button.board-cell");
  if (!cell) return;
  const movement = {
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
  }[event.key];
  if (movement) {
    event.preventDefault();
    moveFocus(...movement);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activateCell(cell.dataset.key, "toggle-bulb");
  } else if (event.key === "x" || event.key === "X") {
    event.preventDefault();
    activateCell(cell.dataset.key, "toggle-mark");
  } else if (event.key === "Home") {
    event.preventDefault();
    focusKey = [...cellElements].find(([, element]) => element.matches("button"))?.[0] ?? focusKey;
    updateRovingTabIndex();
    cellElements.get(focusKey)?.focus();
  } else if (event.key === "End") {
    event.preventDefault();
    focusKey = [...cellElements].reverse().find(([, element]) => element.matches("button"))?.[0] ?? focusKey;
    updateRovingTabIndex();
    cellElements.get(focusKey)?.focus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) return;
  if (elements.rulesDialog.open || elements.victoryDialog.open) return;
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
    restartGame();
  } else if (key === "n") {
    event.preventDefault();
    startNewGame();
  } else if (key === "c") {
    event.preventDefault();
    reviewGarden();
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
window.addEventListener("resize", () => window.requestAnimationFrame(syncBoardScale));

elements.bulbTool.addEventListener("click", () => setTool("bulb"));
elements.markTool.addEventListener("click", () => setTool("mark"));
elements.checkButton.addEventListener("click", reviewGarden);
elements.undoButton.addEventListener("click", undo);
elements.restartButton.addEventListener("click", restartGame);
elements.newGameButton.addEventListener("click", () => startNewGame());
elements.muteButton.addEventListener("click", toggleMute);
elements.rulesButton.addEventListener("click", openRules);
elements.footerRulesButton.addEventListener("click", openRules);
elements.rulesCloseButton.addEventListener("click", () => elements.rulesDialog.close());
elements.nextLevelButton.addEventListener("click", () => startNewGame());
elements.stayButton.addEventListener("click", closeVictory);

elements.rulesDialog.addEventListener("click", (event) => {
  if (event.target === elements.rulesDialog) elements.rulesDialog.close();
});

elements.victoryDialog.addEventListener("click", (event) => {
  if (event.target === elements.victoryDialog) closeVictory();
});

createDifficultyButtons();
const restoreResult = readSave();
elements.muteButton.setAttribute("aria-pressed", String(state.muted));
elements.muteButton.setAttribute("aria-label", state.muted ? "声音已静音，点击开启" : "声音已开启，点击静音");
elements.muteButton.querySelector(".button-label").textContent = state.muted ? "静音" : "声音";
buildBoard();
render();

if (restoreResult.restored) {
  setSavedMessage("已恢复上次庭院 · 自动存档开启");
  showToast(state.completed ? "已恢复黎明后的花庭。" : "已恢复上次守夜进度。");
} else if (restoreResult.invalid) {
  showToast("旧存档无法读取，已为你开启一座新庭院。", true, 3600);
  writeSave();
} else {
  setSavedMessage("自动存档已开启");
}
