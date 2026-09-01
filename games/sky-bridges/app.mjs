import {
  DIFFICULTIES,
  LEVELS,
  applySessionMove,
  createSession,
  edgeBetween,
  evaluatePosition,
  findLevel,
  islandById,
  levelsForDifficulty,
  restartSession,
  restoreSession,
  sessionToJSON,
  undoSession,
} from "./logic.mjs";
import { shouldRestoreDifficultyFocus } from "./ui-helpers.mjs";

const STORAGE_KEY = "ten-realms.sky-bridges:v1";
const STORAGE_VERSION = 1;
const SVG_NS = "http://www.w3.org/2000/svg";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  skipLink: document.querySelector(".skip-link"),
  routeBoard: document.querySelector("#route-board"),
  routeLayer: document.querySelector("#route-layer"),
  dragLayer: document.querySelector("#drag-layer"),
  edgeControls: document.querySelector("#edge-controls"),
  portLayer: document.querySelector("#port-layer"),
  boardViewport: document.querySelector("#board-viewport"),
  levelKicker: document.querySelector("#level-kicker"),
  levelTitle: document.querySelector("#level-title"),
  progressDial: document.querySelector("#progress-dial"),
  progressPercent: document.querySelector("#progress-percent"),
  progressBar: document.querySelector("#progress-bar"),
  exactCount: document.querySelector("#exact-count"),
  portTotal: document.querySelector("#port-total"),
  componentCount: document.querySelector("#component-count"),
  routeCount: document.querySelector("#route-count"),
  moveCount: document.querySelector("#move-count"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  difficultyNote: document.querySelector("#difficulty-note"),
  newGameButton: document.querySelector("#new-game-button"),
  restartButton: document.querySelector("#restart-button"),
  undoButton: document.querySelector("#undo-button"),
  dispatchMessage: document.querySelector("#dispatch-message"),
  saveState: document.querySelector("#save-state"),
  muteButton: document.querySelector("#mute-button"),
  rulesButton: document.querySelector("#rules-button"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  rulesCloseButton: document.querySelector("#rules-close-button"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryPorts: document.querySelector("#victory-ports"),
  victoryRoutes: document.querySelector("#victory-routes"),
  nextLevelButton: document.querySelector("#next-level-button"),
  stayButton: document.querySelector("#stay-button"),
  toast: document.querySelector("#toast"),
  assertiveStatus: document.querySelector("#assertive-status"),
  toolButtons: [...document.querySelectorAll(".tool-button")],
};

let audioContext = null;
let storageAvailable = true;
let toastTimer = 0;
let victoryTimer = 0;
let drag = null;
let suppressClickUntil = 0;

function defaultStats() {
  return {
    completed: {},
    bestMoves: {},
  };
}

function defaultState() {
  const level = LEVELS[0];
  return {
    level,
    session: createSession(level),
    difficulty: level.difficulty,
    mode: "forward",
    selectedIslandId: null,
    focusedIslandId: level.islands[0].id,
    completed: false,
    celebrated: false,
    muted: false,
    stats: defaultStats(),
  };
}

let state = defaultState();

function loadSave() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { restored: false };
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== STORAGE_VERSION) throw new TypeError("Save version mismatch");
    const level = findLevel(saved.active?.puzzleId);
    if (!level) throw new TypeError("Unknown saved level");
    const session = restoreSession(level, saved.active);
    const evaluation = evaluatePosition(level, session.position);
    const stats = saved.stats && typeof saved.stats === "object" ? saved.stats : defaultStats();
    state = {
      level,
      session,
      difficulty: level.difficulty,
      mode: ["forward", "reverse", "mark", "check"].includes(saved.preferences?.mode)
        ? saved.preferences.mode
        : "forward",
      selectedIslandId: null,
      focusedIslandId: level.islands[0].id,
      completed: evaluation.complete,
      celebrated: evaluation.complete,
      muted: Boolean(saved.preferences?.muted),
      stats: {
        completed: stats.completed && typeof stats.completed === "object" ? { ...stats.completed } : {},
        bestMoves: stats.bestMoves && typeof stats.bestMoves === "object" ? { ...stats.bestMoves } : {},
      },
    };
    storageAvailable = true;
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

function writeSave() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      preferences: { muted: state.muted, mode: state.mode },
      active: sessionToJSON(state.level, state.session),
      stats: state.stats,
    }));
    storageAvailable = true;
    elements.saveState.textContent = "刚刚自动保存到本机";
  } catch {
    storageAvailable = false;
    elements.saveState.textContent = "浏览器未开放本机存档";
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
  if (options.to) oscillator.frequency.exponentialRampToValueAtTime(options.to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.045, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playRouteSound(effect) {
  if (effect === "mark-added" || effect === "mark-removed") {
    tone(effect === "mark-added" ? 260 : 220, 0.08, { type: "triangle", volume: 0.025 });
    return;
  }
  if (effect === "checked-added" || effect === "checked-removed") {
    tone(effect === "checked-added" ? 710 : 540, 0.11, { volume: 0.03 });
    return;
  }
  if (effect === "bridge-cleared") {
    tone(330, 0.11, { to: 230, type: "triangle", volume: 0.03 });
    return;
  }
  tone(effect === "bridge-2" ? 610 : 470, 0.12, { to: effect === "bridge-2" ? 690 : 520, volume: 0.035 });
}

function playError() {
  tone(175, 0.12, { to: 140, type: "square", volume: 0.018 });
}

function playVictory() {
  [392, 494, 587, 784].forEach((frequency, index) => {
    tone(frequency, 0.48, { delay: index * 0.12, volume: 0.032, type: index % 2 ? "triangle" : "sine" });
  });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2300);
}

function announce(message, assertive = false) {
  if (assertive) {
    elements.assertiveStatus.textContent = "";
    window.requestAnimationFrame(() => { elements.assertiveStatus.textContent = message; });
  } else {
    showToast(message);
  }
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function lineCoordinates(edge, offset = 0) {
  const x1 = edge.from.column + 0.5;
  const y1 = edge.from.row + 0.5;
  const x2 = edge.to.column + 0.5;
  const y2 = edge.to.row + 0.5;
  if (edge.orientation === "horizontal") return { x1, y1: y1 + offset, x2, y2: y2 + offset };
  return { x1: x1 + offset, y1, x2: x2 + offset, y2 };
}

function appendLine(parent, edge, className, offset = 0) {
  const coordinates = lineCoordinates(edge, offset);
  parent.append(svgElement("line", { ...coordinates, class: className }));
}

function appendActiveRoute(parent, edge, count) {
  const offsets = count === 2 ? [-0.105, 0.105] : [0];
  for (const offset of offsets) appendLine(parent, edge, "route-active-shadow", offset);
  for (const offset of offsets) appendLine(parent, edge, "route-active", offset);
}

function appendCargoMote(parent, edge, index) {
  const { x1, y1, x2, y2 } = lineCoordinates(edge);
  const circle = svgElement("circle", { r: 0.06, class: "cargo-mote" });
  const motion = svgElement("animateMotion", {
    path: `M ${x1} ${y1} L ${x2} ${y2}`,
    dur: `${2.4 + (index % 5) * 0.28}s`,
    begin: `${-(index % 7) * 0.37}s`,
    repeatCount: "indefinite",
  });
  circle.append(motion);
  parent.append(circle);
}

function islandLabel(island, port, checked) {
  const status = port.exact ? "需求已满足" : port.over ? "航线超出需求" : "需求未满";
  return `第 ${island.row + 1} 行第 ${island.column + 1} 列浮空港，需求 ${island.target}，当前 ${port.count}，${status}${checked ? "，已核验" : ""}`;
}

function edgeLabel(edge, count, marked) {
  const first = islandById(state.level, edge.a);
  const second = islandById(state.level, edge.b);
  const routeState = marked ? "禁航笔记" : `${count} 条航线`;
  return `第 ${first.row + 1} 行第 ${first.column + 1} 列港口（需求 ${first.target}）与第 ${second.row + 1} 行第 ${second.column + 1} 列港口（需求 ${second.target}）之间，当前${routeState}；按当前工具调整`;
}

function renderBoard(options = {}) {
  const evaluation = evaluatePosition(state.level, state.session.position);
  const { width, height } = state.level;
  elements.routeBoard.dataset.gridSize = String(Math.max(width, height));
  elements.routeBoard.style.setProperty("--grid-width", width);
  elements.routeBoard.style.setProperty("--grid-height", height);
  elements.routeBoard.style.setProperty("--grid-size", Math.max(width, height));
  elements.routeBoard.classList.toggle("is-complete", evaluation.complete);
  elements.routeLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  elements.dragLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  elements.routeLayer.replaceChildren();
  elements.edgeControls.replaceChildren();
  elements.portLayer.replaceChildren();

  state.level.edges.forEach((edge, index) => {
    const count = evaluation.bridges.get(edge.id) ?? 0;
    const marked = evaluation.marks.has(edge.id);
    appendLine(elements.routeLayer, edge, marked ? "route-marked" : "route-candidate");
    if (count > 0) appendActiveRoute(elements.routeLayer, edge, count);
    if (evaluation.complete && count > 0 && !reduceMotion.matches) appendCargoMote(elements.routeLayer, edge, index);

    const control = document.createElement("button");
    control.type = "button";
    control.className = `edge-control edge-control--${edge.orientation}${marked ? " is-marked" : ""}`;
    control.id = `edge-${edge.id.replaceAll(":", "-")}`;
    control.dataset.edgeId = edge.id;
    control.dataset.count = String(count);
    control.style.left = `${(((edge.from.column + 0.5) + (edge.to.column + 0.5)) / 2 / width) * 100}%`;
    control.style.top = `${(((edge.from.row + 0.5) + (edge.to.row + 0.5)) / 2 / height) * 100}%`;
    control.style.marginTop = edge.orientation === "horizontal" ? "-12px" : "0";
    control.style.marginLeft = edge.orientation === "vertical" ? "12px" : "0";
    control.setAttribute("aria-label", edgeLabel(edge, count, marked));
    control.addEventListener("click", (event) => executeEdge(edge.id, {
      direction: event.shiftKey ? -1 : null,
      focusEdgeId: edge.id,
    }));
    control.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      executeEdge(edge.id, { direction: -1, focusEdgeId: edge.id });
    });
    elements.edgeControls.append(control);
  });

  const selectableTargets = new Set();
  if (state.selectedIslandId) {
    for (const edge of state.level.edges) {
      if (edge.a === state.selectedIslandId) selectableTargets.add(edge.b);
      if (edge.b === state.selectedIslandId) selectableTargets.add(edge.a);
    }
  }

  for (const island of state.level.islands) {
    const port = evaluation.ports.get(island.id);
    const checked = evaluation.checked.has(island.id);
    const button = document.createElement("button");
    button.type = "button";
    button.id = `port-${island.id}`;
    button.className = "port";
    button.dataset.islandId = island.id;
    button.style.left = `${((island.column + 0.5) / width) * 100}%`;
    button.style.top = `${((island.row + 0.5) / height) * 100}%`;
    button.setAttribute("aria-label", islandLabel(island, port, checked));
    const portPressed = state.mode === "check" ? checked : state.selectedIslandId === island.id;
    button.setAttribute("aria-pressed", String(portPressed));
    button.tabIndex = state.focusedIslandId === island.id ? 0 : -1;
    button.classList.toggle("is-selected", state.selectedIslandId === island.id);
    button.classList.toggle("is-exact", port.exact);
    button.classList.toggle("is-over", port.over);
    button.classList.toggle("is-checked", checked);
    button.classList.toggle("is-target", selectableTargets.has(island.id));
    button.classList.toggle("is-right-edge", island.column === width - 1);
    button.classList.toggle("is-bottom-edge", island.row === height - 1);
    button.innerHTML = `<span class="port-target">${island.target}</span><span class="port-count">${port.count}/${island.target}</span><span class="port-stamp" aria-hidden="true">✓</span>`;
    button.addEventListener("focus", () => { state.focusedIslandId = island.id; });
    button.addEventListener("click", (event) => {
      if (performance.now() < suppressClickUntil) return;
      handlePort(island.id, { direction: event.shiftKey ? -1 : null, focusIslandId: island.id });
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      handlePort(island.id, { direction: -1, focusIslandId: island.id });
    });
    button.addEventListener("keydown", (event) => handlePortKeydown(event, island.id));
    button.addEventListener("pointerdown", (event) => startDrag(event, island.id));
    elements.portLayer.append(button);
  }

  const focusIslandId = options.focusIslandId;
  const focusEdgeId = options.focusEdgeId;
  if (focusIslandId) {
    window.requestAnimationFrame(() => document.querySelector(`#port-${CSS.escape(focusIslandId)}`)?.focus({ preventScroll: true }));
  } else if (focusEdgeId) {
    window.requestAnimationFrame(() => document.querySelector(`#edge-${CSS.escape(focusEdgeId.replaceAll(":", "-"))}`)?.focus({ preventScroll: true }));
  }
}

function difficultyFor(id) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? DIFFICULTIES[0];
}

function renderDifficultyButtons(options = {}) {
  elements.difficultyButtons.replaceChildren();
  for (const difficulty of DIFFICULTIES) {
    let pointerType = "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "difficulty-button";
    button.dataset.difficultyId = difficulty.id;
    button.classList.toggle("is-active", state.difficulty === difficulty.id);
    button.setAttribute("aria-pressed", String(state.difficulty === difficulty.id));
    button.textContent = difficulty.shortLabel;
    button.addEventListener("pointerdown", (event) => { pointerType = event.pointerType; });
    button.addEventListener("pointercancel", () => { pointerType = ""; });
    button.addEventListener("pointerleave", () => { pointerType = ""; });
    button.addEventListener("keydown", () => { pointerType = ""; });
    button.addEventListener("click", (event) => {
      const focusDifficultyId = shouldRestoreDifficultyFocus({
        eventDetail: event.detail,
        pointerType: event.pointerType || pointerType,
      }) ? difficulty.id : null;
      pointerType = "";
      selectDifficulty(difficulty.id, { focusDifficultyId });
    });
    elements.difficultyButtons.append(button);
  }

  if (options.focusDifficultyId) {
    window.requestAnimationFrame(() => {
      elements.difficultyButtons
        .querySelector(`[data-difficulty-id="${CSS.escape(options.focusDifficultyId)}"]`)
        ?.focus({ preventScroll: true });
    });
  }
}

function messageFor(evaluation) {
  const over = [...evaluation.ports.values()].filter(({ over }) => over).length;
  if (evaluation.complete) return {
    className: "is-complete",
    title: "货运网络已全线贯通",
    copy: "光点正在完整航网中穿行，云层已经打开。",
  };
  if (over > 0) return {
    className: "is-warning",
    title: `${over} 座港口航线超额`,
    copy: "带有“当前 / 需求”红色徽记的港口需要减线。",
  };
  if (evaluation.exactPorts === evaluation.totalPorts && !evaluation.connected) return {
    className: "is-warning",
    title: "数字齐了，网络仍未贯通",
    copy: `目前分成 ${evaluation.components.length} 个饱和子网；需要重新调度使全港连通。`,
  };
  if (state.selectedIslandId) return {
    className: "",
    title: "已锁定第一座港口",
    copy: "发光外环标出四向最近港口；选一个端点完成调度。",
  };
  if (evaluation.bridgeUnits === 0) return {
    className: "",
    title: "等待首条航线",
    copy: "先选一座港，再选它四向最近的港口。",
  };
  return {
    className: "",
    title: `${evaluation.exactPorts} 座港口需求已满足`,
    copy: evaluation.connected
      ? "当前已有一张连通骨架，继续校准剩余数字。"
      : `网络仍分为 ${evaluation.components.length} 区；数字与全局连通都要兼顾。`,
  };
}

function render(options = {}) {
  const evaluation = evaluatePosition(state.level, state.session.position);
  state.completed = evaluation.complete;
  document.body.classList.toggle("is-complete", evaluation.complete);
  const difficulty = difficultyFor(state.level.difficulty);
  const list = levelsForDifficulty(state.level.difficulty);
  const levelNumber = list.findIndex(({ id }) => id === state.level.id) + 1;
  elements.levelKicker.textContent = `${difficulty.label} · ${String(levelNumber).padStart(2, "0")}`;
  elements.levelTitle.textContent = state.level.title;
  const percent = Math.round(evaluation.progress * 100);
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressDial.style.setProperty("--progress", `${percent}%`);
  elements.exactCount.textContent = String(evaluation.exactPorts);
  elements.portTotal.textContent = `/ ${evaluation.totalPorts} 港`;
  elements.componentCount.textContent = String(evaluation.components.length);
  elements.routeCount.textContent = String(evaluation.bridgeUnits);
  elements.moveCount.textContent = String(state.session.moves);
  elements.difficultyNote.textContent = `${state.level.islands.length} 港 · ${state.level.edges.length} 条候选航路 · ${difficulty.note}`;
  elements.undoButton.disabled = state.session.history.length === 0;
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "声音已静音，点击开启" : "声音已开启，点击静音");
  for (const button of elements.toolButtons) {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  const message = messageFor(evaluation);
  elements.dispatchMessage.className = `dispatch-message ${message.className}`.trim();
  elements.dispatchMessage.querySelector("strong").textContent = message.title;
  elements.dispatchMessage.querySelector("p span").textContent = message.copy;
  if (!storageAvailable) elements.saveState.textContent = "浏览器未开放本机存档";
  renderDifficultyButtons(options);
  renderBoard(options);
}

function moveFailureMessage(reason) {
  if (reason === "crossing") return "这条航线会在云海内部交叉，未执行。";
  if (reason === "marked") return "这段候选航路已有禁航笔记，请先取消标记。";
  if (reason === "has-bridge") return "已有真实航线时不能添加禁航笔记。";
  if (reason === "not-exact") return "港口数字尚未刚好满足，暂不能核验。";
  if (reason === "not-a-candidate") return "两港不是同行或同列的最近可见邻港。";
  return "这次调度不能执行。";
}

function executeMove(move, options = {}) {
  const wasComplete = evaluatePosition(state.level, state.session.position).complete;
  const result = applySessionMove(state.level, state.session, move);
  if (!result.accepted) {
    playError();
    const message = moveFailureMessage(result.reason);
    announce(message, result.reason === "crossing");
    return false;
  }
  state.session = result.session;
  playRouteSound(result.effect);
  const evaluation = evaluatePosition(state.level, state.session.position);
  state.completed = evaluation.complete;
  writeSave();
  render(options);
  if (evaluation.complete && !wasComplete) celebrate(evaluation);
  return true;
}

function executeEdge(edgeId, options = {}) {
  if (state.mode === "check" && options.direction == null) {
    announce("核验港口工具只作用于港口；请选择带数字的圆形港口。" );
    return false;
  }
  const move = state.mode === "mark" && options.direction == null
    ? { type: "toggle-mark", edgeId }
    : {
        type: "cycle-bridge",
        edgeId,
        direction: options.direction === -1 || state.mode === "reverse" ? -1 : 1,
      };
  return executeMove(move, options);
}

function handlePort(islandId, options = {}) {
  ensureAudio();
  state.focusedIslandId = islandId;
  if (state.mode === "check" && options.direction == null) {
    state.selectedIslandId = null;
    executeMove({ type: "toggle-checked", islandId }, { focusIslandId: islandId });
    return;
  }
  if (!state.selectedIslandId) {
    state.selectedIslandId = islandId;
    render({ focusIslandId: options.focusIslandId });
    showToast("已选择第一座港口，请选择发光外环中的端点。" );
    return;
  }
  if (state.selectedIslandId === islandId) {
    state.selectedIslandId = null;
    render({ focusIslandId: options.focusIslandId });
    return;
  }
  const edge = edgeBetween(state.level, state.selectedIslandId, islandId);
  if (!edge) {
    state.selectedIslandId = islandId;
    playError();
    render({ focusIslandId: options.focusIslandId });
    showToast("不能越过中间港或斜向连接；已改选这座港口。" );
    return;
  }
  const previousSelection = state.selectedIslandId;
  state.selectedIslandId = islandId;
  const accepted = executeEdge(edge.id, {
    direction: options.direction,
    focusIslandId: islandId,
  });
  if (!accepted) {
    state.selectedIslandId = previousSelection;
    render({ focusIslandId: options.focusIslandId });
  }
}

function setMode(mode, announceChange = true) {
  if (!["forward", "reverse", "mark", "check"].includes(mode)) return;
  state.mode = mode;
  state.selectedIslandId = null;
  writeSave();
  render();
  if (announceChange) {
    const labels = {
      forward: "增加航线：0 → 1 → 2 → 0",
      reverse: "反向调整：0 → 2 → 1 → 0",
      mark: "禁航笔记：不计入航线与胜利",
      check: "核验港口：只标记当前数字恰好的港口",
    };
    showToast(labels[mode]);
  }
}

function directionalPort(fromId, key) {
  const from = islandById(state.level, fromId);
  const directions = {
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
  };
  const [rowSign, columnSign] = directions[key];
  const directEdge = state.level.edges.find((edge) => {
    if (edge.a !== fromId && edge.b !== fromId) return false;
    const other = islandById(state.level, edge.a === fromId ? edge.b : edge.a);
    const rowDelta = other.row - from.row;
    const columnDelta = other.column - from.column;
    return rowSign !== 0 ? Math.sign(rowDelta) === rowSign : Math.sign(columnDelta) === columnSign;
  });
  if (directEdge) return directEdge.a === fromId ? directEdge.b : directEdge.a;

  const candidates = state.level.islands.filter((island) => {
    const rowDelta = island.row - from.row;
    const columnDelta = island.column - from.column;
    return rowSign !== 0 ? Math.sign(rowDelta) === rowSign : Math.sign(columnDelta) === columnSign;
  });
  candidates.sort((first, second) => {
    const firstPrimary = rowSign !== 0 ? Math.abs(first.row - from.row) : Math.abs(first.column - from.column);
    const secondPrimary = rowSign !== 0 ? Math.abs(second.row - from.row) : Math.abs(second.column - from.column);
    const firstSecondary = rowSign !== 0 ? Math.abs(first.column - from.column) : Math.abs(first.row - from.row);
    const secondSecondary = rowSign !== 0 ? Math.abs(second.column - from.column) : Math.abs(second.row - from.row);
    return firstPrimary + firstSecondary * 2 - (secondPrimary + secondSecondary * 2);
  });
  return candidates[0]?.id ?? fromId;
}

function focusPort(islandId) {
  const current = elements.portLayer.querySelector('[tabindex="0"]');
  if (current) current.tabIndex = -1;
  const next = document.querySelector(`#port-${CSS.escape(islandId)}`);
  if (next) {
    next.tabIndex = 0;
    next.focus({ preventScroll: false });
    state.focusedIslandId = islandId;
  }
}

function handlePortKeydown(event, islandId) {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    focusPort(directionalPort(islandId, event.key));
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    const target = event.key === "Home" ? state.level.islands[0] : state.level.islands.at(-1);
    focusPort(target.id);
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handlePort(islandId, { direction: event.shiftKey ? -1 : null, focusIslandId: islandId });
    return;
  }
  if (event.key.toLowerCase() === "c") {
    event.preventDefault();
    executeMove({ type: "toggle-checked", islandId }, { focusIslandId: islandId });
    return;
  }
  if (event.key === "Escape") {
    state.selectedIslandId = null;
    render({ focusIslandId: islandId });
  }
}

function dragTargetFromVector(startId, deltaX, deltaY) {
  const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
  const direction = horizontal
    ? (deltaX >= 0 ? "right" : "left")
    : (deltaY >= 0 ? "down" : "up");
  const start = islandById(state.level, startId);
  for (const edge of state.level.edges) {
    if (edge.a !== startId && edge.b !== startId) continue;
    const otherId = edge.a === startId ? edge.b : edge.a;
    const other = islandById(state.level, otherId);
    if (direction === "right" && other.row === start.row && other.column > start.column) return otherId;
    if (direction === "left" && other.row === start.row && other.column < start.column) return otherId;
    if (direction === "down" && other.column === start.column && other.row > start.row) return otherId;
    if (direction === "up" && other.column === start.column && other.row < start.row) return otherId;
  }
  return null;
}

function drawDragPreview(startId, targetId, clientX, clientY) {
  const start = islandById(state.level, startId);
  const rect = elements.routeBoard.getBoundingClientRect();
  const x1 = start.column + 0.5;
  const y1 = start.row + 0.5;
  let x2 = ((clientX - rect.left) / rect.width) * state.level.width;
  let y2 = ((clientY - rect.top) / rect.height) * state.level.height;
  if (targetId) {
    const target = islandById(state.level, targetId);
    x2 = target.column + 0.5;
    y2 = target.row + 0.5;
  }
  elements.dragLayer.replaceChildren(svgElement("line", { x1, y1, x2, y2, class: "drag-preview" }));
  elements.portLayer.querySelectorAll(".port.is-target").forEach((port) => port.classList.remove("is-target"));
  if (targetId) document.querySelector(`#port-${CSS.escape(targetId)}`)?.classList.add("is-target");
}

function startDrag(event, islandId) {
  if (event.button !== 0) return;
  ensureAudio();
  drag = {
    pointerId: event.pointerId,
    startId: islandId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    targetId: null,
  };
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;
  if (!drag.moved && Math.hypot(deltaX, deltaY) < 10) return;
  drag.moved = true;
  drag.targetId = dragTargetFromVector(drag.startId, deltaX, deltaY);
  drawDragPreview(drag.startId, drag.targetId, event.clientX, event.clientY);
}

function finishDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const finished = drag;
  drag = null;
  elements.dragLayer.replaceChildren();
  elements.portLayer.querySelectorAll(".port.is-target").forEach((port) => port.classList.remove("is-target"));
  if (!finished.moved) return;
  suppressClickUntil = performance.now() + 450;
  if (!finished.targetId) {
    playError();
    showToast("拖动方向上没有可见的最近港口。" );
    return;
  }
  if (state.mode === "check") {
    showToast("核验港口无需拖动，轻触一座数字恰好的港口即可。" );
    return;
  }
  const edge = edgeBetween(state.level, finished.startId, finished.targetId);
  if (edge) {
    state.selectedIslandId = finished.targetId;
    executeEdge(edge.id, { focusIslandId: finished.targetId });
  }
}

function cancelDrag(event) {
  if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
  drag = null;
  elements.dragLayer.replaceChildren();
  elements.portLayer.querySelectorAll(".port.is-target").forEach((port) => port.classList.remove("is-target"));
}

function celebrate(evaluation) {
  state.celebrated = true;
  state.stats.completed[state.level.id] = (Number(state.stats.completed[state.level.id]) || 0) + 1;
  const previousBest = Number(state.stats.bestMoves[state.level.id]) || Infinity;
  state.stats.bestMoves[state.level.id] = Math.min(previousBest, state.session.moves);
  writeSave();
  const tier = DIFFICULTIES.findIndex((difficulty) => difficulty.id === state.level.difficulty) + 1;
  const reward = {
    levelId: state.level.id,
    tier: Math.max(1, tier),
    moves: state.session.moves,
  };
  if (window.RealmArcade?.complete) window.RealmArcade.complete(reward);
  else (window.__realmCompletionQueue ??= []).push(reward);
  playVictory();
  announce(`云层已开！${evaluation.totalPorts} 座港口全部连通。`, true);
  elements.victoryMoves.textContent = String(state.session.moves);
  elements.victoryPorts.textContent = `${evaluation.totalPorts} / ${evaluation.totalPorts}`;
  elements.victoryRoutes.textContent = String(evaluation.bridgeUnits);
  window.clearTimeout(victoryTimer);
  victoryTimer = window.setTimeout(() => {
    if (state.completed && !elements.victoryDialog.open) elements.victoryDialog.showModal();
  }, reduceMotion.matches ? 80 : 900);
}

function closeVictory() {
  window.clearTimeout(victoryTimer);
  if (elements.victoryDialog.open) elements.victoryDialog.close();
}

function chooseLevel(level, options = {}) {
  closeVictory();
  state.level = level;
  state.difficulty = level.difficulty;
  state.session = createSession(level);
  state.selectedIslandId = null;
  state.focusedIslandId = level.islands[0].id;
  state.completed = false;
  state.celebrated = false;
  elements.boardViewport.scrollTo({ left: 0, top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
  writeSave();
  render(options);
}

function nextLevel() {
  const levels = levelsForDifficulty(state.difficulty);
  const index = levels.findIndex(({ id }) => id === state.level.id);
  chooseLevel(levels[(index + 1) % levels.length]);
  showToast("已切换到下一片航区。" );
}

function selectDifficulty(difficultyId, options = {}) {
  if (difficultyId === state.difficulty) return;
  const first = levelsForDifficulty(difficultyId)[0];
  chooseLevel(first, options);
  const difficulty = difficultyFor(difficultyId);
  announce(`已进入${difficulty.label}，题面规模与交叉抉择已改变。`, true);
}

function restart() {
  closeVictory();
  state.session = restartSession(state.level);
  state.selectedIslandId = null;
  state.completed = false;
  state.celebrated = false;
  writeSave();
  render({ focusIslandId: state.focusedIslandId });
  showToast("航区已恢复到未铺设状态。" );
  tone(280, 0.14, { to: 390, type: "triangle", volume: 0.025 });
}

function undo() {
  const result = undoSession(state.level, state.session);
  if (!result.accepted) {
    showToast("还没有可以撤销的调度。" );
    return;
  }
  closeVictory();
  state.session = result.session;
  state.selectedIslandId = null;
  state.completed = evaluatePosition(state.level, state.session.position).complete;
  state.celebrated = state.completed;
  writeSave();
  render({ focusIslandId: state.focusedIslandId });
  tone(350, 0.11, { to: 270, type: "triangle", volume: 0.025 });
  showToast("已撤销上一步。" );
}

function toggleMute() {
  state.muted = !state.muted;
  writeSave();
  render();
  if (!state.muted) tone(520, 0.12, { to: 650, volume: 0.03 });
  showToast(state.muted ? "合成音效已静音。" : "合成音效已开启。" );
}

function openRules() {
  if (!elements.rulesDialog.open) elements.rulesDialog.showModal();
}

function globalKeydown(event) {
  if (event.defaultPrevented) return;
  const tag = event.target instanceof HTMLElement ? event.target.tagName : "";
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
  if (elements.rulesDialog.open || elements.victoryDialog.open) return;
  const lower = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && lower === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && ["1", "2", "3", "4"].includes(event.key)) {
    event.preventDefault();
    setMode({ 1: "forward", 2: "reverse", 3: "mark", 4: "check" }[event.key]);
    return;
  }
  if (lower === "z" || lower === "u") {
    event.preventDefault();
    undo();
  } else if (lower === "r") {
    event.preventDefault();
    restart();
  } else if (lower === "n") {
    event.preventDefault();
    nextLevel();
  } else if (lower === "m") {
    event.preventDefault();
    toggleMute();
  } else if (event.key === "?") {
    event.preventDefault();
    openRules();
  }
}

for (const button of elements.toolButtons) {
  button.addEventListener("click", () => setMode(button.dataset.mode));
}
elements.skipLink.addEventListener("click", () => {
  window.requestAnimationFrame(() => elements.boardViewport.focus({ preventScroll: true }));
});
elements.newGameButton.addEventListener("click", nextLevel);
elements.restartButton.addEventListener("click", restart);
elements.undoButton.addEventListener("click", undo);
elements.muteButton.addEventListener("click", toggleMute);
elements.rulesButton.addEventListener("click", openRules);
elements.footerRulesButton.addEventListener("click", openRules);
elements.rulesCloseButton.addEventListener("click", () => elements.rulesDialog.close());
elements.nextLevelButton.addEventListener("click", nextLevel);
elements.stayButton.addEventListener("click", () => elements.victoryDialog.close());
elements.rulesDialog.addEventListener("click", (event) => {
  if (event.target === elements.rulesDialog) elements.rulesDialog.close();
});
elements.victoryDialog.addEventListener("click", (event) => {
  if (event.target === elements.victoryDialog) elements.victoryDialog.close();
});
window.addEventListener("pointermove", onPointerMove, { passive: true });
window.addEventListener("pointerup", finishDrag);
window.addEventListener("pointercancel", cancelDrag);
window.addEventListener("blur", cancelDrag);
window.addEventListener("keydown", globalKeydown);

const loaded = loadSave();
render();
if (loaded.restored) {
  showToast("已恢复上次的云海调度进度。" );
} else if (loaded.invalid) {
  showToast("旧存档无法校验，已安全开启新航区。" );
} else {
  writeSave();
}
