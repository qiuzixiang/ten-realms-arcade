import {
  ACTOR,
  ACTOR_TYPES,
  CELL,
  DIFFICULTIES,
  LEVELS,
  SIDE,
  applyMove,
  cellAt,
  edgeEntries,
  entryKey,
  evaluatePosition,
  findLevel,
  isFloor,
  keyOf,
  levelsForDifficulty,
  normalizePosition,
  pointFromKey,
  positionToJSON,
} from "./logic.mjs";
import {
  shouldHandleGlobalShortcut,
  shouldRestoreDifficultyFocus,
} from "./shortcut.mjs";

const STORAGE_KEY = "ten-realms.mirror-theatre:v1";
const STORAGE_VERSION = 1;
const HISTORY_LIMIT = 80;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const ACTOR_LABEL = Object.freeze({
  [ACTOR.HUMAN]: "真人演员",
  [ACTOR.HOLOGRAM]: "全息演员",
  [ACTOR.ROBOT]: "机械演员",
});

const ACTOR_SHORT_LABEL = Object.freeze({
  [ACTOR.HUMAN]: "真人",
  [ACTOR.HOLOGRAM]: "全息",
  [ACTOR.ROBOT]: "机械",
});

const SIDE_LABEL = Object.freeze({
  [SIDE.TOP]: "上方",
  [SIDE.RIGHT]: "右侧",
  [SIDE.BOTTOM]: "下方",
  [SIDE.LEFT]: "左侧",
});

const TOOL_ACTOR = Object.freeze({
  human: ACTOR.HUMAN,
  hologram: ACTOR.HOLOGRAM,
  robot: ACTOR.ROBOT,
});

const elements = {
  assertiveStatus: document.querySelector("#assertive-status"),
  board: document.querySelector("#theatre-board"),
  castItems: new Map([...document.querySelectorAll("#cast-list [data-actor]")].map((item) => [item.dataset.actor, item])),
  checkButton: document.querySelector("#check-button"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  difficultyKicker: document.querySelector("#difficulty-kicker"),
  edgeStat: document.querySelector("#edge-stat"),
  filledStat: document.querySelector("#filled-stat"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  levelNote: document.querySelector("#level-note"),
  levelSubtitle: document.querySelector("#level-subtitle"),
  levelTitle: document.querySelector("#level-title"),
  mirrorStage: document.querySelector("#mirror-stage"),
  muteButton: document.querySelector("#mute-button"),
  newGameButton: document.querySelector("#new-game-button"),
  nextLevelButton: document.querySelector("#next-level-button"),
  rayReader: document.querySelector("#ray-reader"),
  restartButton: document.querySelector("#restart-button"),
  rulesButton: document.querySelector("#rules-button"),
  rulesCloseButton: document.querySelector("#rules-close-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  saveIndicator: document.querySelector("#save-indicator"),
  saveCopy: document.querySelector("#save-copy"),
  selectedRayCard: document.querySelector("#selected-ray-card"),
  stageFrame: document.querySelector("#stage-frame"),
  statusCopy: document.querySelector("#status-copy"),
  statusTitle: document.querySelector("#status-title"),
  stayButton: document.querySelector("#stay-button"),
  stepStat: document.querySelector("#step-stat"),
  toast: document.querySelector("#toast"),
  toolButtons: [...document.querySelectorAll("#tool-buttons [data-tool]")],
  topClues: document.querySelector("#top-clues"),
  rightClues: document.querySelector("#right-clues"),
  bottomClues: document.querySelector("#bottom-clues"),
  leftClues: document.querySelector("#left-clues"),
  undoButton: document.querySelector("#undo-button"),
  victoryCopy: document.querySelector("#victory-copy"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryEdges: document.querySelector("#victory-edges"),
  victoryLevel: document.querySelector("#victory-level"),
  victorySteps: document.querySelector("#victory-steps"),
};

const clueContainers = Object.freeze({
  [SIDE.TOP]: elements.topClues,
  [SIDE.RIGHT]: elements.rightClues,
  [SIDE.BOTTOM]: elements.bottomClues,
  [SIDE.LEFT]: elements.leftClues,
});

const emptyStats = () => ({
  completedByLevel: {},
  bestMovesByLevel: {},
});

const defaultState = () => ({
  level: LEVELS[0],
  difficulty: LEVELS[0].difficulty,
  actors: new Map(),
  notes: new Map(),
  steps: 0,
  history: [],
  completed: false,
  muted: false,
  tool: "cycle",
  activeRay: null,
  stats: emptyStats(),
});

let state = defaultState();
let currentEvaluation = evaluatePosition(state.level, state);
let cellElements = new Map();
let clueElements = new Map();
let focusKey = null;
let audioContext = null;
let storageAvailable = true;
let toastTimer = 0;
let saveTimer = 0;
let victoryTimer = 0;

function snapshot() {
  return {
    ...positionToJSON(state),
    steps: state.steps,
  };
}

function runtimeSnapshot() {
  return {
    actors: new Map(state.actors),
    notes: new Map([...state.notes].map(([key, values]) => [key, new Set(values)])),
    steps: state.steps,
  };
}

function parseSnapshot(level, value) {
  if (!value || typeof value !== "object" || !value.actors || typeof value.actors !== "object") return null;
  if (!value.notes || typeof value.notes !== "object") return null;
  if (!Number.isInteger(value.steps) || value.steps < 0) return null;

  const actorEntries = Object.entries(value.actors);
  const noteEntries = Object.entries(value.notes);
  if (actorEntries.some(([key, actor]) => !pointFromKey(key) || !ACTOR_TYPES.includes(actor))) return null;
  if (noteEntries.some(([key, values]) => (
    !pointFromKey(key)
    || !Array.isArray(values)
    || values.length === 0
    || values.some((actor) => !ACTOR_TYPES.includes(actor))
    || new Set(values).size !== values.length
  ))) return null;

  const normalized = normalizePosition(level, value);
  if (normalized.actors.size !== actorEntries.length || normalized.notes.size !== noteEntries.length) return null;
  return {
    actors: normalized.actors,
    notes: normalized.notes,
    steps: value.steps,
  };
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { restored: false };
    const saved = JSON.parse(raw);
    if (saved.version !== STORAGE_VERSION || !saved.active) throw new Error("Unsupported save");
    const level = findLevel(saved.active.levelId);
    if (!level || saved.active.difficulty !== level.difficulty) throw new Error("Unknown level");
    const active = parseSnapshot(level, saved.active);
    if (!active) throw new Error("Invalid active position");

    const history = Array.isArray(saved.active.history)
      ? saved.active.history.slice(-HISTORY_LIMIT).map((item) => parseSnapshot(level, item))
      : [];
    if (history.some((item) => item === null)) throw new Error("Invalid history");

    const completedByLevel = {};
    const bestMovesByLevel = {};
    for (const levelItem of LEVELS) {
      const completed = Number(saved.stats?.completedByLevel?.[levelItem.id]);
      const best = Number(saved.stats?.bestMovesByLevel?.[levelItem.id]);
      if (Number.isInteger(completed) && completed > 0) completedByLevel[levelItem.id] = completed;
      if (Number.isInteger(best) && best > 0) bestMovesByLevel[levelItem.id] = best;
    }

    state = {
      level,
      difficulty: level.difficulty,
      actors: active.actors,
      notes: active.notes,
      steps: active.steps,
      history,
      completed: evaluatePosition(level, active).complete,
      muted: Boolean(saved.preferences?.muted),
      tool: ["cycle", "human", "hologram", "robot", "notes", "erase"].includes(saved.preferences?.tool)
        ? saved.preferences.tool
        : "cycle",
      activeRay: null,
      stats: { completedByLevel, bestMovesByLevel },
    };
    return { restored: true };
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      storageAvailable = false;
    }
    state = defaultState();
    return { restored: false, invalid: true };
  }
}

function setSaveMessage(message, saved = false) {
  window.clearTimeout(saveTimer);
  if (!storageAvailable) {
    elements.saveCopy.textContent = "本机存档不可用";
    elements.saveIndicator.classList.remove("is-saved");
    return;
  }
  elements.saveCopy.textContent = message;
  elements.saveIndicator.classList.toggle("is-saved", saved);
  if (saved) {
    saveTimer = window.setTimeout(() => {
      elements.saveCopy.textContent = "本机自动存档";
      elements.saveIndicator.classList.remove("is-saved");
    }, 1800);
  }
}

function writeSave() {
  const active = snapshot();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      preferences: { muted: state.muted, tool: state.tool },
      active: {
        levelId: state.level.id,
        difficulty: state.difficulty,
        ...active,
        completed: state.completed,
        history: state.history.map((item) => ({
          ...positionToJSON(item),
          steps: item.steps,
        })),
        updatedAt: new Date().toISOString(),
      },
      stats: state.stats,
    }));
    storageAvailable = true;
    setSaveMessage("排演已存档", true);
  } catch {
    storageAvailable = false;
    setSaveMessage("本机存档不可用", false);
  }
}

function showToast(message, isError = false, duration = 2200) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
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
  oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.022, start + Math.min(0.02, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function playSound(effect) {
  if (state.muted) return;
  if (effect === "actor-human") {
    tone(392, 0.16, { type: "triangle", gain: 0.025 });
  } else if (effect === "actor-hologram") {
    tone(880, 0.18, { gain: 0.018, endFrequency: 1180 });
    tone(1320, 0.12, { gain: 0.007, delay: 0.035 });
  } else if (effect === "actor-robot") {
    tone(196, 0.1, { type: "square", gain: 0.012 });
    tone(294, 0.12, { type: "triangle", gain: 0.014, delay: 0.06 });
  } else if (["actor-cleared", "cell-cleared"].includes(effect)) {
    tone(460, 0.13, { endFrequency: 240, gain: 0.018 });
  } else if (effect === "note-changed") {
    tone(620, 0.065, { type: "triangle", gain: 0.012 });
  } else if (effect === "undo") {
    tone(360, 0.12, { endFrequency: 540, gain: 0.014 });
  } else if (effect === "invalid") {
    tone(150, 0.1, { type: "triangle", gain: 0.018 });
    tone(126, 0.12, { type: "triangle", gain: 0.012, delay: 0.09 });
  } else if (effect === "ray") {
    tone(660, 0.12, { gain: 0.012, endFrequency: 940 });
  } else if (effect === "win") {
    [294, 392, 494, 659].forEach((frequency, index) => {
      tone(frequency, 0.9 - index * 0.06, { gain: 0.02, delay: index * 0.14 });
      tone(frequency * 2, 0.56, { gain: 0.006, delay: index * 0.14 + 0.04 });
    });
  }
}

function createActorMark(actor) {
  const mark = document.createElement("span");
  mark.className = `actor-mark actor-mark--${actor}`;
  mark.setAttribute("aria-hidden", "true");
  mark.append(document.createElement("i"));
  return mark;
}

function createActorToken(actor, order) {
  const token = document.createElement("span");
  token.className = `actor-token actor-token--${actor}`;
  token.style.setProperty("--actor-delay", `${order * 45 + 250}ms`);
  token.setAttribute("aria-hidden", "true");
  token.append(createActorMark(actor));
  return token;
}

function createCandidateSet(notes) {
  const set = document.createElement("span");
  set.className = "candidate-set";
  set.setAttribute("aria-hidden", "true");
  const glyphs = {
    [ACTOR.HUMAN]: "●",
    [ACTOR.HOLOGRAM]: "◇",
    [ACTOR.ROBOT]: "▦",
  };
  for (const actor of ACTOR_TYPES) {
    const candidate = document.createElement("span");
    candidate.className = `candidate-${actor}`;
    candidate.textContent = notes.has(actor) ? glyphs[actor] : "";
    set.append(candidate);
  }
  return set;
}

function renderDifficultyButtons() {
  elements.difficultyButtons.replaceChildren();
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "difficulty-button";
    button.textContent = difficulty.label;
    button.title = difficulty.note;
    button.setAttribute("aria-pressed", String(state.difficulty === difficulty.id));
    button.addEventListener("click", (event) => {
      const restoreFocus = shouldRestoreDifficultyFocus({
        clickDetail: event.detail,
        buttonHadFocus: document.activeElement === button,
      });
      changeDifficulty(difficulty.id);
      if (restoreFocus) {
        elements.difficultyButtons.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      }
    });
    elements.difficultyButtons.append(button);
  }
}

function buildBoard() {
  elements.board.replaceChildren();
  cellElements = new Map();
  focusKey = null;
  elements.mirrorStage.style.setProperty("--columns", state.level.width);
  elements.mirrorStage.style.setProperty("--rows", state.level.height);
  elements.board.style.setProperty("--columns", state.level.width);
  elements.board.style.setProperty("--rows", state.level.height);
  elements.board.setAttribute("aria-rowcount", state.level.height);
  elements.board.setAttribute("aria-colcount", state.level.width);
  elements.board.setAttribute(
    "aria-label",
    `${state.level.title}，${state.level.width} 乘 ${state.level.height} 镜廊舞台`,
  );

  let order = 0;
  for (let row = 0; row < state.level.height; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";
    rowElement.setAttribute("role", "row");
    for (let column = 0; column < state.level.width; column += 1) {
      const cell = cellAt(state.level, row, column);
      const key = keyOf(row, column);
      let element;
      if (isFloor(cell)) {
        element = document.createElement("button");
        element.type = "button";
        element.className = "stage-cell floor-cell";
        element.setAttribute("role", "gridcell");
        element.dataset.key = key;
        element.dataset.order = order;
        element.tabIndex = focusKey === null ? 0 : -1;
        if (focusKey === null) focusKey = key;
        element.addEventListener("click", () => performToolAt(key));
        element.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          commitMove({ type: "cycle-notes", key });
        });
        element.addEventListener("keydown", (event) => handleCellKeydown(event, key));
        order += 1;
      } else {
        element = document.createElement("div");
        element.className = "stage-cell mirror-cell";
        element.setAttribute("role", "gridcell");
        element.setAttribute("aria-label", `第 ${row + 1} 行第 ${column + 1} 列，${cell} 斜镜`);
        element.setAttribute("aria-readonly", "true");
        element.dataset.mirror = cell;
        const blade = document.createElement("span");
        blade.className = "mirror-blade";
        blade.setAttribute("aria-hidden", "true");
        element.append(blade);
      }
      element.dataset.key = key;
      rowElement.append(element);
      cellElements.set(key, element);
    }
    elements.board.append(rowElement);
  }
}

function buildClues() {
  clueElements = new Map();
  for (const side of Object.values(SIDE)) clueContainers[side].replaceChildren();
  const lengths = {
    [SIDE.TOP]: state.level.width,
    [SIDE.RIGHT]: state.level.height,
    [SIDE.BOTTOM]: state.level.width,
    [SIDE.LEFT]: state.level.height,
  };
  for (const side of Object.values(SIDE)) {
    for (let index = 0; index < lengths[side]; index += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "edge-clue";
      button.dataset.entry = entryKey({ side, index });
      button.setAttribute("aria-pressed", "false");
      const target = document.createElement("span");
      target.className = "clue-target";
      target.textContent = state.level.clues[side][index];
      const tally = document.createElement("span");
      tally.className = "clue-tally";
      button.append(target, tally);
      button.addEventListener("click", () => toggleRay({ side, index }));
      clueContainers[side].append(button);
      clueElements.set(entryKey({ side, index }), button);
    }
  }
}

function floorAriaLabel(key, rayStates = null) {
  const point = pointFromKey(key);
  const actor = currentEvaluation.actors.get(key);
  const notes = currentEvaluation.notes.get(key);
  const parts = [`第 ${point.row + 1} 行第 ${point.column + 1} 列，演员位`];
  if (actor) parts.push(`已安排${ACTOR_LABEL[actor]}`);
  else parts.push("尚未安排演员");
  if (notes?.size) parts.push(`候选：${ACTOR_TYPES.filter((type) => notes.has(type)).map((type) => ACTOR_SHORT_LABEL[type]).join("、")}`);
  if (currentEvaluation.conflictKeys.has(key)) parts.push("造成观众席超数");
  if (rayStates?.direct && rayStates?.reflected) parts.push("所选光路会在直视与反射后分别经过这里");
  else if (rayStates?.reflected) parts.push("所选光路在反射后经过这里");
  else if (rayStates?.direct) parts.push("所选光路在直视时经过这里");
  return parts.join("，");
}

function selectedRayData() {
  if (!state.activeRay) return null;
  return currentEvaluation.edgeResults.get(entryKey(state.activeRay)) ?? null;
}

function updateBoard() {
  const ray = selectedRayData();
  const rayCells = new Map();
  const occurrenceCount = new Map();
  if (ray) {
    for (const step of ray.path) {
      if (!rayCells.has(step.key)) rayCells.set(step.key, { direct: false, reflected: false });
      const states = rayCells.get(step.key);
      if (step.hasReflected) states.reflected = true;
      else states.direct = true;
    }
    for (const occurrence of ray.occurrences) {
      occurrenceCount.set(occurrence.key, (occurrenceCount.get(occurrence.key) ?? 0) + 1);
    }
  }

  for (const [key, element] of cellElements) {
    const rayStates = rayCells.get(key);
    element.classList.toggle("is-on-ray", Boolean(rayStates));
    element.classList.toggle("is-ray-direct", Boolean(rayStates?.direct));
    element.classList.toggle("is-ray-reflected", Boolean(rayStates?.reflected));
    const repeated = Math.min(4, occurrenceCount.get(key) ?? 0);
    if (repeated > 1) element.dataset.occurrences = repeated;
    else delete element.dataset.occurrences;

    if (!element.classList.contains("floor-cell")) continue;
    const actor = currentEvaluation.actors.get(key);
    const notes = currentEvaluation.notes.get(key);
    element.replaceChildren();
    element.classList.toggle("is-conflict", currentEvaluation.conflictKeys.has(key));
    if (actor) element.append(createActorToken(actor, Number(element.dataset.order) || 0));
    else if (notes?.size) element.append(createCandidateSet(notes));
    element.setAttribute("aria-label", floorAriaLabel(key, rayStates));
  }
  elements.stageFrame.classList.toggle("is-complete", state.completed);
}

function clueAriaLabel(result) {
  const position = `${SIDE_LABEL[result.entry.side]}第 ${result.entry.index + 1} 席`;
  const range = result.unknownOccurrences > 0
    ? `目前可见 ${result.visible}，最多 ${result.maximum}`
    : `可见 ${result.visible}`;
  const stateText = result.exact ? "已满足" : result.impossible ? "无法满足" : "仍待确认";
  return `${position}，目标 ${result.clue}，${range}，${stateText}。按下可显示光路。`;
}

function updateClues() {
  for (const [key, button] of clueElements) {
    const result = currentEvaluation.edgeResults.get(key);
    const selected = state.activeRay && entryKey(state.activeRay) === key;
    button.classList.toggle("is-selected", Boolean(selected));
    button.classList.toggle("is-exact", result.exact);
    button.classList.toggle("is-error", result.impossible);
    button.setAttribute("aria-pressed", String(Boolean(selected)));
    button.setAttribute("aria-label", clueAriaLabel(result));
    const tally = button.querySelector(".clue-tally");
    tally.textContent = result.unknownOccurrences > 0
      ? `${result.visible}–${result.maximum}`
      : `${result.visible}`;
  }
}

function updateCast() {
  for (const actor of ACTOR_TYPES) {
    const item = elements.castItems.get(actor);
    const result = currentEvaluation.totalResults.get(actor);
    item.querySelector(".cast-current").textContent = result.count;
    item.querySelector(".cast-target").textContent = result.target;
    item.classList.toggle("is-exact", result.exact);
    item.classList.toggle("is-error", result.impossible);
    item.setAttribute(
      "aria-label",
      `${ACTOR_LABEL[actor]}，已登台 ${result.count}，目标 ${result.target}${result.impossible ? "，数量无法满足" : ""}`,
    );
  }
}

function rayDescription(result) {
  const exit = result.exit
    ? `${SIDE_LABEL[result.exit.side]}第 ${result.exit.index + 1} 席`
    : "内部循环";
  const uniqueActors = new Set(result.occurrences.map((occurrence) => occurrence.key)).size;
  const repeatCount = result.occurrences.length - uniqueActors;
  const range = result.unknownOccurrences > 0
    ? `当前 ${result.visible}，可能到 ${result.maximum}`
    : `当前 ${result.visible}`;
  return {
    title: `${SIDE_LABEL[result.entry.side]}第 ${result.entry.index + 1} 席 → ${exit}`,
    copy: `${result.mirrorsHit} 面镜 · ${result.occurrences.length} 次演员经过${repeatCount > 0 ? ` · 含 ${repeatCount} 次重复经过` : ""}`,
    count: `${range} / 目标 ${result.clue}`,
  };
}

function updateSelectedRayCard() {
  const result = selectedRayData();
  elements.selectedRayCard.replaceChildren();
  const kicker = document.createElement("p");
  kicker.textContent = "LIGHT PATH";
  const title = document.createElement("h3");
  const copy = document.createElement("span");
  if (!result) {
    title.textContent = "点一处观众席";
    copy.textContent = "舞台会描出这排观众的完整视线。";
    elements.selectedRayCard.append(kicker, title, copy);
    return;
  }
  const description = rayDescription(result);
  title.textContent = description.title;
  copy.textContent = description.copy;
  const count = document.createElement("span");
  count.className = "ray-count";
  count.textContent = description.count;
  elements.selectedRayCard.append(kicker, title, copy, count);
}

function setStatus(title, copy, tone = "normal") {
  elements.statusTitle.textContent = title;
  elements.statusCopy.textContent = copy;
  elements.rayReader.classList.toggle("is-warning", tone === "warning");
  elements.rayReader.classList.toggle("is-success", tone === "success");
}

function updateStatus() {
  const ray = selectedRayData();
  if (state.completed) {
    setStatus("今晚全数谢幕", "所有观众席与演员总表同时吻合。", "success");
    return;
  }
  if (ray) {
    const description = rayDescription(ray);
    setStatus(description.title, `${description.count}；${description.copy}`, ray.impossible ? "warning" : "normal");
    return;
  }
  if (currentEvaluation.errors > 0) {
    setStatus("有目光失去演员", `发现 ${currentEvaluation.errors} 处超数或已无法达成的线索。`, "warning");
    return;
  }
  if (currentEvaluation.filledCount === 0) {
    setStatus("幕布已升起", "选择演员工具，再点舞台格开始排演。");
    return;
  }
  setStatus(
    "追光仍在排练",
    `还差 ${currentEvaluation.emptyKeys.size} 个演员位；${currentEvaluation.exactEdges} / ${currentEvaluation.totalEdges} 席已经完全确定。`,
  );
}

function updateTools() {
  for (const button of elements.toolButtons) {
    const selected = button.dataset.tool === state.tool;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.title = state.muted ? "恢复声音" : "静音";
  elements.muteButton.querySelector(".sound-icon").textContent = state.muted ? "×" : "♪";
  elements.muteButton.querySelector(".button-label").textContent = state.muted ? "开声" : "静音";
  elements.undoButton.disabled = state.history.length === 0;
}

function render() {
  currentEvaluation = evaluatePosition(state.level, state);
  state.completed = currentEvaluation.complete;
  const difficulty = DIFFICULTIES.find((item) => item.id === state.difficulty) ?? DIFFICULTIES[0];
  elements.difficultyKicker.textContent = difficulty.label;
  elements.levelTitle.textContent = state.level.title;
  elements.levelSubtitle.textContent = state.level.subtitle;
  elements.levelNote.textContent = state.level.note;
  elements.filledStat.textContent = `${currentEvaluation.filledCount} / ${currentEvaluation.floorCount}`;
  elements.edgeStat.textContent = `${currentEvaluation.exactEdges} / ${currentEvaluation.totalEdges}`;
  elements.stepStat.textContent = state.steps;
  updateBoard();
  updateClues();
  updateCast();
  updateSelectedRayCard();
  updateStatus();
  updateTools();
  renderDifficultyButtons();
}

function selectTool(tool, announceSelection = true) {
  if (!["cycle", "human", "hologram", "robot", "notes", "erase"].includes(tool)) return;
  state.tool = tool;
  updateTools();
  writeSave();
  if (announceSelection) {
    const labels = {
      cycle: "轮换演员",
      human: "安排真人",
      hologram: "安排全息",
      robot: "安排机械",
      notes: "候选笔记",
      erase: "清空演员位",
    };
    announce(`已选择${labels[tool]}工具`);
  }
}

function clearVictoryTimer() {
  window.clearTimeout(victoryTimer);
  victoryTimer = 0;
}

function commitMove(move) {
  const result = applyMove(state.level, state, move);
  if (!result.accepted) {
    playSound("invalid");
    if (result.reason === "occupied") showToast("先清出演员，才能写候选。", true);
    return false;
  }

  const wasComplete = state.completed;
  state.history.push(runtimeSnapshot());
  state.history = state.history.slice(-HISTORY_LIMIT);
  state.actors = result.actors;
  state.notes = result.notes;
  state.steps += 1;
  state.completed = false;
  clearVictoryTimer();
  render();
  writeSave();
  playSound(result.effect);

  if (!wasComplete && state.completed) finishPerformance();
  return true;
}

function performToolAt(key) {
  if (state.tool === "cycle") {
    commitMove({ type: "cycle-actor", key });
    return;
  }
  if (TOOL_ACTOR[state.tool]) {
    const actor = TOOL_ACTOR[state.tool];
    commitMove({
      type: "set-actor",
      key,
      actor: state.actors.get(key) === actor ? null : actor,
    });
    return;
  }
  if (state.tool === "notes") {
    commitMove({ type: "cycle-notes", key });
    return;
  }
  commitMove({ type: "clear-cell", key });
}

function setFocusKey(key, focus = true) {
  if (!cellElements.get(key)?.classList.contains("floor-cell")) return;
  if (focusKey && cellElements.has(focusKey)) cellElements.get(focusKey).tabIndex = -1;
  focusKey = key;
  const element = cellElements.get(key);
  element.tabIndex = 0;
  if (focus) element.focus();
}

function moveFocus(key, rowStep, columnStep) {
  const point = pointFromKey(key);
  let row = point.row + rowStep;
  let column = point.column + columnStep;
  while (row >= 0 && column >= 0 && row < state.level.height && column < state.level.width) {
    const nextKey = keyOf(row, column);
    if (isFloor(cellAt(state.level, row, column))) {
      setFocusKey(nextKey);
      return;
    }
    row += rowStep;
    column += columnStep;
  }
}

function directActorMove(key, actor) {
  if (state.tool === "notes") {
    commitMove({ type: "toggle-note", key, actor });
  } else {
    commitMove({
      type: "set-actor",
      key,
      actor: state.actors.get(key) === actor ? null : actor,
    });
  }
}

function handleCellKeydown(event, key) {
  const lower = event.key.toLowerCase();
  const directions = {
    arrowup: [-1, 0],
    w: [-1, 0],
    arrowright: [0, 1],
    d: [0, 1],
    arrowdown: [1, 0],
    s: [1, 0],
    arrowleft: [0, -1],
    a: [0, -1],
  };
  if (directions[lower]) {
    event.preventDefault();
    moveFocus(key, ...directions[lower]);
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    const floorKeys = [...cellElements].filter(([, element]) => element.classList.contains("floor-cell")).map(([cellKey]) => cellKey);
    setFocusKey(event.key === "Home" ? floorKeys[0] : floorKeys.at(-1));
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && event.shiftKey) {
    event.preventDefault();
    commitMove({ type: "cycle-notes", key });
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    performToolAt(key);
    return;
  }
  if (["Backspace", "Delete"].includes(event.key)) {
    event.preventDefault();
    commitMove({ type: "clear-cell", key });
    return;
  }
  if (event.key === "1" || event.key === "2" || event.key === "3") {
    event.preventDefault();
    directActorMove(key, ACTOR_TYPES[Number(event.key) - 1]);
    return;
  }
  if (lower === "p") {
    event.preventDefault();
    selectTool("notes");
    return;
  }
  if (lower === "c") {
    event.preventDefault();
    selectTool("cycle");
  }
}

function toggleRay(entry) {
  const key = entryKey(entry);
  state.activeRay = state.activeRay && entryKey(state.activeRay) === key ? null : entry;
  render();
  playSound("ray");
}

function openDialog(dialog) {
  if (dialog.open) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog.open) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function finishPerformance() {
  state.stats.completedByLevel[state.level.id] = (state.stats.completedByLevel[state.level.id] ?? 0) + 1;
  const previousBest = state.stats.bestMovesByLevel[state.level.id];
  if (!previousBest || state.steps < previousBest) state.stats.bestMovesByLevel[state.level.id] = state.steps;
  writeSave();
  const tier = DIFFICULTIES.findIndex((difficulty) => difficulty.id === state.difficulty) + 1;
  const reward = {
    levelId: state.level.id,
    tier: Math.max(1, tier),
    moves: state.steps,
  };
  if (window.RealmArcade?.complete) window.RealmArcade.complete(reward);
  else (window.__realmCompletionQueue ??= []).push(reward);
  playSound("win");
  announce(`演出完成：${state.level.title}，${state.steps} 步，全场谢幕。`);
  elements.victoryLevel.textContent = state.level.title;
  elements.victorySteps.textContent = state.steps;
  elements.victoryEdges.textContent = `${currentEvaluation.exactEdges} / ${currentEvaluation.totalEdges}`;
  elements.victoryCopy.textContent = `镜面扫过最后一道光，${state.level.floorCount} 位演员依次谢幕。`;
  const delay = reduceMotion.matches ? 40 : 900;
  victoryTimer = window.setTimeout(() => openDialog(elements.victoryDialog), delay);
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return;
  clearVictoryTimer();
  closeDialog(elements.victoryDialog);
  state.actors = new Map(previous.actors);
  state.notes = new Map([...previous.notes].map(([key, values]) => [key, new Set(values)]));
  state.steps = previous.steps;
  state.completed = false;
  render();
  writeSave();
  playSound("undo");
  announce(`已撤销，当前 ${state.steps} 步`);
}

function loadLevel(level, message = "新一场排演已就位") {
  clearVictoryTimer();
  closeDialog(elements.victoryDialog);
  state.level = level;
  state.difficulty = level.difficulty;
  state.actors = new Map();
  state.notes = new Map();
  state.steps = 0;
  state.history = [];
  state.completed = false;
  state.activeRay = null;
  buildBoard();
  buildClues();
  render();
  writeSave();
  showToast(`${message}：${level.title}`);
  announce(`${level.title}，${level.width} 乘 ${level.height} 舞台，${level.floorCount} 个演员位`);
}

function nextLevel() {
  const levels = levelsForDifficulty(state.difficulty);
  const currentIndex = levels.findIndex((level) => level.id === state.level.id);
  loadLevel(levels[(currentIndex + 1 + levels.length) % levels.length], "已换题");
}

function changeDifficulty(difficulty) {
  if (difficulty === state.difficulty) return;
  const [level] = levelsForDifficulty(difficulty);
  if (level) loadLevel(level, `已切换到${DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? "新"}场`);
}

function restart() {
  loadLevel(state.level, "本场已重新布置");
}

function checkPosition() {
  if (currentEvaluation.complete) {
    showToast("全部线索与演员总表已经吻合。", false, 2800);
    announce("核对完成，演出已获全场掌声");
  } else if (currentEvaluation.errors > 0) {
    showToast(`发现 ${currentEvaluation.errors} 处超数或无法达成的线索。`, true, 3000);
    announce(`核对发现 ${currentEvaluation.errors} 处错误`);
  } else {
    showToast(`目前没有矛盾；还差 ${currentEvaluation.emptyKeys.size} 个演员位。`, false, 2800);
    announce(`目前没有矛盾，还差 ${currentEvaluation.emptyKeys.size} 个演员位`);
  }
}

function bindStaticEvents() {
  elements.newGameButton.addEventListener("click", nextLevel);
  elements.undoButton.addEventListener("click", undo);
  elements.restartButton.addEventListener("click", restart);
  elements.checkButton.addEventListener("click", checkPosition);
  elements.rulesButton.addEventListener("click", () => openDialog(elements.rulesDialog));
  elements.footerRulesButton.addEventListener("click", () => openDialog(elements.rulesDialog));
  elements.rulesCloseButton.addEventListener("click", () => closeDialog(elements.rulesDialog));
  elements.stayButton.addEventListener("click", () => {
    closeDialog(elements.victoryDialog);
    if (focusKey) setFocusKey(focusKey);
  });
  elements.nextLevelButton.addEventListener("click", () => {
    closeDialog(elements.victoryDialog);
    nextLevel();
  });
  elements.muteButton.addEventListener("click", () => {
    state.muted = !state.muted;
    if (!state.muted) {
      ensureAudio();
      tone(520, 0.1, { gain: 0.013 });
    }
    updateTools();
    writeSave();
    announce(state.muted ? "声音已关闭" : "声音已开启");
  });
  for (const button of elements.toolButtons) {
    button.addEventListener("click", () => selectTool(button.dataset.tool));
  }

  for (const dialog of [elements.rulesDialog, elements.victoryDialog]) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const inside = (
        event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom
      );
      if (!inside && dialog === elements.rulesDialog) closeDialog(dialog);
    });
  }

  document.addEventListener("pointerdown", () => ensureAudio(), { once: true, capture: true });
  document.addEventListener("keydown", (event) => {
    const dialogOpen = Boolean(document.querySelector("dialog[open]"));
    const targetIsStageCell = Boolean(event.target.closest?.(".stage-cell"));
    if (!shouldHandleGlobalShortcut({
      dialogOpen,
      targetIsStageCell,
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    })) return;

    if (!audioContext) ensureAudio();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
      return;
    }
    const lower = event.key.toLowerCase();
    if (lower === "c") selectTool("cycle");
    else if (lower === "p") selectTool("notes");
    else if (event.key === "1") selectTool("human");
    else if (event.key === "2") selectTool("hologram");
    else if (event.key === "3") selectTool("robot");
    else if (event.key === "?" || (event.key === "/" && event.shiftKey)) openDialog(elements.rulesDialog);
  });
  window.addEventListener("pagehide", writeSave);
}

function initialize() {
  const restore = readSave();
  currentEvaluation = evaluatePosition(state.level, state);
  state.completed = currentEvaluation.complete;
  buildBoard();
  buildClues();
  bindStaticEvents();
  render();
  if (restore.restored) setSaveMessage("已恢复上次排演", true);
  else if (restore.invalid) showToast("旧存档无法读取，已为你铺好新舞台。", true, 3200);
  else writeSave();
}

initialize();
