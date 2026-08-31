import {
  findCrossingPairs,
  generatePuzzle,
} from "./logic.mjs";
import {
  canUndo,
  restoreSavedSession,
  undoLastMove,
} from "./session.mjs";

const SAVE_KEY = "five-realms:red-thread-office:game:v2";
const SETTINGS_KEY = "five-realms:red-thread-office:settings:v1";
const SAVE_VERSION = 2;
const MAX_SAVED_HISTORY = 400;

const LEVEL_COPY = {
  easy: { short: "初签", title: "初签 · 七枚印章" },
  medium: { short: "合契", title: "合契 · 十枚印章" },
  hard: { short: "星罗", title: "星罗 · 十四枚印章" },
};
const REWARD_TIER = { easy: 1, medium: 2, hard: 3 };

const SEAL_STORIES = [
  { mark: "归", name: "远舟", wish: "愿有灯可归" },
  { mark: "晴", name: "听雨", wish: "愿共看天晴" },
  { mark: "知", name: "青简", wish: "愿有人知意" },
  { mark: "安", name: "南枝", wish: "愿岁岁相安" },
  { mark: "逢", name: "迟星", wish: "愿久别重逢" },
  { mark: "暖", name: "小满", wish: "愿长夜有暖" },
  { mark: "同", name: "白榆", wish: "愿并肩同行" },
  { mark: "见", name: "流萤", wish: "愿真心被见" },
  { mark: "守", name: "云岫", wish: "愿相守如初" },
  { mark: "念", name: "照川", wish: "愿所念有回声" },
  { mark: "合", name: "春信", wish: "愿两意相合" },
  { mark: "久", name: "砚秋", wish: "愿朝暮长久" },
  { mark: "明", name: "微澜", wish: "愿心事澄明" },
  { mark: "在", name: "望舒", wish: "愿寻常都在" },
];

const elements = {
  board: document.querySelector("#threadBoard"),
  canvas: document.querySelector("#threadCanvas"),
  nodeLayer: document.querySelector("#nodeLayer"),
  registry: document.querySelector("#sealRegistry"),
  sealCount: document.querySelector("#sealCount"),
  crossingCount: document.querySelector("#crossingCount"),
  moveCount: document.querySelector("#moveCount"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  progressFill: document.querySelector("#progressFill"),
  liveStatus: document.querySelector("#liveStatus"),
  boardState: document.querySelector("#boardState"),
  boardTitle: document.querySelector("#boardTitle"),
  gestureHint: document.querySelector("#gestureHint"),
  newGameButton: document.querySelector("#newGameButton"),
  restartButton: document.querySelector("#restartButton"),
  undoButton: document.querySelector("#undoButton"),
  muteButton: document.querySelector("#muteButton"),
  rulesButton: document.querySelector("#rulesButton"),
  footerRulesButton: document.querySelector("#footerRulesButton"),
  levelButtons: [...document.querySelectorAll(".level-button")],
  victorySheet: document.querySelector("#victorySheet"),
  victoryMoves: document.querySelector("#victoryMoves"),
  nextCaseButton: document.querySelector("#nextCaseButton"),
  reviewBoardButton: document.querySelector("#reviewBoardButton"),
  victoryUndoButton: document.querySelector("#victoryUndoButton"),
  rulesDialog: document.querySelector("#rulesDialog"),
  officeShell: document.querySelector(".office-shell"),
  museumLink: document.querySelector(".museum-link"),
};

const state = {
  difficulty: "medium",
  seed: "",
  vertices: [],
  initialVertices: [],
  edges: [],
  crossings: [],
  initialCrossingCount: 1,
  history: [],
  steps: 0,
  selectedId: null,
  dragging: null,
  solved: false,
  muted: false,
};

let audioContext = null;
let drawFrame = null;
let victoryTimer = null;
let lastFocusBeforeVictory = null;
let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let completionReported = false;

function reportCompletion(payload) {
  if (window.RealmArcade?.complete) {
    window.RealmArcade.complete(payload);
  } else {
    (window.__realmCompletionQueue ??= []).push(payload);
  }
}

function clonePoint(vertex) {
  return { id: vertex.id, x: vertex.x, y: vertex.y };
}

function pointFor(id) {
  return state.vertices.find((vertex) => vertex.id === id);
}

function setPoint(id, point) {
  const vertex = pointFor(id);
  if (!vertex) return;
  vertex.x = point.x;
  vertex.y = point.y;
}

function makeSeed() {
  try {
    const words = new Uint32Array(2);
    crypto.getRandomValues(words);
    return `${Date.now().toString(36)}-${words[0].toString(36)}${words[1].toString(36)}`;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function loadMutedSetting() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return saved?.muted === true;
  } catch {
    return false;
  }
}

function saveMutedSetting() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: state.muted }));
  } catch {
    // Storage can be disabled in private browsing; the puzzle remains playable.
  }
}

function serialisableHistory() {
  return state.history.slice(-MAX_SAVED_HISTORY).map((move) => ({
    id: move.id,
    from: { x: move.from.x, y: move.from.y },
    to: { x: move.to.x, y: move.to.y },
  }));
}

function saveGame() {
  // A pointer drag updates coordinates before its history entry is committed.
  // Keep the last complete snapshot instead of persisting that transient state.
  if (!state.seed || !state.vertices.length || state.dragging) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      difficulty: state.difficulty,
      seed: state.seed,
      vertices: state.vertices.map(clonePoint),
      history: serialisableHistory(),
      steps: state.steps,
      solved: state.solved,
    }));
  } catch {
    // Autosave is an enhancement; storage failures must never interrupt play.
  }
}

function restoreGame() {
  const restored = restoreSavedSession(localStorage, SAVE_KEY, { version: SAVE_VERSION });
  if (!restored) return false;
  Object.assign(state, restored);
  return true;
}

function ensureAudio() {
  if (state.muted) return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  if (!audioContext) audioContext = new Context();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function tone(frequency, delay = 0, duration = 0.09, volume = 0.035, type = "sine") {
  const context = ensureAudio();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function playCue(name, positive = false) {
  if (state.muted) return;
  if (name === "pick") tone(246, 0, 0.07, 0.025, "triangle");
  if (name === "drop") {
    tone(positive ? 494 : 330, 0, 0.08, 0.028, "triangle");
    if (positive) tone(622, 0.055, 0.1, 0.022, "sine");
  }
  if (name === "loosen") tone(523, 0, 0.07, 0.018, "sine");
  if (name === "undo") tone(294, 0, 0.08, 0.024, "triangle");
  if (name === "paper") tone(392, 0, 0.06, 0.018, "sine");
  if (name === "new") {
    tone(330, 0, 0.07, 0.022, "triangle");
    tone(440, 0.06, 0.09, 0.02, "triangle");
  }
  if (name === "win") {
    [392, 494, 587, 784].forEach((frequency, index) => {
      tone(frequency, index * 0.11, 0.28, 0.035 - index * 0.003, index < 2 ? "triangle" : "sine");
    });
  }
}

function storyFor(id) {
  return SEAL_STORIES[id % SEAL_STORIES.length];
}

function setSelected(id, announce = false) {
  state.selectedId = id;
  elements.nodeLayer.querySelectorAll(".seal-node").forEach((node) => {
    node.classList.toggle("is-selected", Number(node.dataset.id) === id);
  });
  elements.registry.querySelectorAll("li").forEach((item) => {
    item.classList.toggle("is-selected", Number(item.dataset.id) === id);
  });
  if (announce && id !== null) {
    const story = storyFor(id);
    elements.liveStatus.textContent = `已选中${story.name}的“${story.mark}”印，可用方向键移动。`;
  }
}

function updateNodePosition(id) {
  const vertex = pointFor(id);
  const node = elements.nodeLayer.querySelector(`[data-id="${id}"]`);
  if (!vertex || !node) return;
  node.style.left = `${vertex.x * 100}%`;
  node.style.top = `${vertex.y * 100}%`;
}

function renderNodes() {
  const fragment = document.createDocumentFragment();
  for (const vertex of state.vertices) {
    const story = storyFor(vertex.id);
    const node = document.createElement("button");
    node.type = "button";
    node.className = "seal-node";
    node.dataset.id = String(vertex.id);
    node.style.left = `${vertex.x * 100}%`;
    node.style.top = `${vertex.y * 100}%`;
    node.style.setProperty("--seal-rotate", `${((vertex.id * 7) % 9) - 4}deg`);
    node.setAttribute("aria-label", `${story.name}的${story.mark}印：${story.wish}。拖动，或聚焦后用方向键移动。`);
    node.innerHTML = `<span class="seal-node__mark" aria-hidden="true">${story.mark}</span>`;
    node.disabled = state.solved;
    fragment.append(node);
  }
  elements.nodeLayer.replaceChildren(fragment);
  setSelected(state.selectedId, false);
}

function renderRegistry() {
  const fragment = document.createDocumentFragment();
  for (const vertex of state.vertices) {
    const story = storyFor(vertex.id);
    const item = document.createElement("li");
    item.dataset.id = String(vertex.id);
    item.innerHTML = `<span class="registry-mark" aria-hidden="true">${story.mark}</span><span>${story.name} · ${story.wish}</span>`;
    fragment.append(item);
  }
  elements.registry.replaceChildren(fragment);
  elements.sealCount.textContent = `${state.vertices.length}枚`;
}

function updateDifficultyButtons() {
  elements.levelButtons.forEach((button) => {
    const active = button.dataset.difficulty === state.difficulty;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.boardTitle.textContent = `待理红线图 · ${LEVEL_COPY[state.difficulty].short}`;
}

function edgeSetFromCrossings(crossings) {
  const indices = new Set();
  crossings.forEach(([first, second]) => {
    indices.add(first);
    indices.add(second);
  });
  return indices;
}

function updateKnottedNodes(crossedEdges) {
  const ids = new Set();
  crossedEdges.forEach((edgeIndex) => {
    const edge = state.edges[edgeIndex];
    if (edge) {
      ids.add(edge[0]);
      ids.add(edge[1]);
    }
  });
  elements.nodeLayer.querySelectorAll(".seal-node").forEach((node) => {
    node.classList.toggle("is-knotted", !state.solved && ids.has(Number(node.dataset.id)));
  });
}

function progressValue(crossingCount) {
  if (crossingCount === 0) return 100;
  if (state.initialCrossingCount <= 0) return 0;
  return Math.max(0, Math.min(99, Math.round((1 - crossingCount / state.initialCrossingCount) * 100)));
}

function applySolvedAppearance() {
  elements.board.classList.toggle("is-solved", state.solved);
  elements.boardState.textContent = state.solved ? "已归档" : "待理顺";
  elements.undoButton.disabled = !canUndo(state.history);
  elements.victoryUndoButton.disabled = !canUndo(state.history);
  elements.nodeLayer.querySelectorAll(".seal-node").forEach((node) => {
    node.disabled = state.solved;
  });
}

function updatePuzzleView({ announce = false, allowWin = false } = {}) {
  state.crossings = findCrossingPairs(state.vertices, state.edges);
  const crossingCount = state.crossings.length;
  const progress = progressValue(crossingCount);
  const crossedEdges = edgeSetFromCrossings(state.crossings);

  elements.crossingCount.textContent = String(crossingCount);
  elements.crossingCount.classList.toggle("has-knots", crossingCount > 0);
  elements.moveCount.textContent = String(state.steps);
  elements.progressText.textContent = `${progress}%`;
  elements.progressBar.setAttribute("aria-valuenow", String(progress));
  elements.progressFill.style.width = `${progress}%`;
  elements.undoButton.disabled = !canUndo(state.history);
  updateKnottedNodes(crossedEdges);
  applySolvedAppearance();
  scheduleDraw();

  if (announce && !state.solved) {
    elements.liveStatus.textContent = crossingCount
      ? `当前还有 ${crossingCount} 个线结。红色边参与相交，金色边已经理顺。`
      : "所有红线都已理顺。";
  }

  if (allowWin && !state.solved && !state.dragging && crossingCount === 0) completePuzzle();
}

function startPuzzle(difficulty = state.difficulty, seed = makeSeed(), message = "新案卷已展开") {
  clearTimeout(victoryTimer);
  hideVictory();
  const puzzle = generatePuzzle(difficulty, seed);
  state.difficulty = puzzle.difficulty;
  state.seed = puzzle.seed;
  state.vertices = puzzle.vertices.map(clonePoint);
  state.initialVertices = puzzle.vertices.map(clonePoint);
  state.edges = puzzle.edges.map(([from, to]) => [from, to]);
  state.crossings = puzzle.crossings.map(([first, second]) => [first, second]);
  state.initialCrossingCount = puzzle.initialCrossingCount;
  state.history = [];
  state.steps = 0;
  state.selectedId = null;
  state.dragging = null;
  state.solved = false;
  completionReported = false;
  renderRegistry();
  renderNodes();
  updateDifficultyButtons();
  elements.gestureHint.classList.remove("is-dismissed");
  updatePuzzleView();
  elements.liveStatus.textContent = `${message}：${LEVEL_COPY[state.difficulty].title}，共有 ${state.crossings.length} 个线结。`;
  saveGame();
}

function restartPuzzle() {
  clearTimeout(victoryTimer);
  hideVictory();
  state.vertices = state.initialVertices.map(clonePoint);
  state.history = [];
  state.steps = 0;
  state.selectedId = null;
  state.dragging = null;
  state.solved = false;
  completionReported = false;
  renderNodes();
  elements.gestureHint.classList.remove("is-dismissed");
  updatePuzzleView();
  elements.liveStatus.textContent = `案卷已恢复原状，仍有 ${state.crossings.length} 个线结。`;
  saveGame();
  playCue("new");
}

function undoMove() {
  const undone = undoLastMove(state.vertices, state.history, state.steps);
  if (!undone) return;
  hideVictory();
  state.vertices = undone.vertices;
  state.history = undone.history;
  state.steps = undone.steps;
  state.solved = false;
  completionReported = false;
  const { move } = undone;
  updateNodePosition(move.id);
  setSelected(move.id, false);
  updatePuzzleView({ announce: true });
  saveGame();
  playCue("undo");
  elements.nodeLayer.querySelector(`[data-id="${move.id}"]`)?.focus({ preventScroll: true });
}

function completePuzzle() {
  state.solved = true;
  if (!completionReported) {
    completionReported = true;
    reportCompletion({
      levelId: `case:${state.difficulty}:${state.seed}`,
      tier: REWARD_TIER[state.difficulty],
      moves: state.steps,
    });
  }
  applySolvedAppearance();
  updateKnottedNodes(new Set());
  elements.boardState.textContent = "已归档";
  elements.liveStatus.textContent = `案卷完成：${state.steps} 步，所有红线都已相安。`;
  elements.victoryMoves.textContent = String(state.steps);
  saveGame();
  playCue("win");
  victoryTimer = window.setTimeout(showVictory, reducedMotion ? 80 : 620);
}

function showVictory() {
  lastFocusBeforeVictory = document.activeElement;
  elements.victorySheet.hidden = false;
  elements.officeShell.inert = true;
  elements.museumLink.inert = true;
  const utilityDock = document.querySelector(".realm-utility-dock");
  if (utilityDock) utilityDock.inert = true;
  document.body.classList.add("victory-open");
  elements.nextCaseButton.focus({ preventScroll: true });
}

function hideVictory() {
  clearTimeout(victoryTimer);
  elements.victorySheet.hidden = true;
  elements.officeShell.inert = false;
  elements.museumLink.inert = false;
  const utilityDock = document.querySelector(".realm-utility-dock");
  if (utilityDock) utilityDock.inert = false;
  document.body.classList.remove("victory-open");
}

function dismissGestureHint() {
  elements.gestureHint.classList.add("is-dismissed");
}

function boardMargins() {
  const rect = elements.board.getBoundingClientRect();
  const node = elements.nodeLayer.querySelector(".seal-node");
  const halfSize = (node?.offsetWidth || 52) / 2 + 5;
  return {
    x: Math.min(0.18, Math.max(0.055, halfSize / Math.max(rect.width, 1))),
    y: Math.min(0.18, Math.max(0.055, halfSize / Math.max(rect.height, 1))),
  };
}

function clampPoint(point) {
  const margin = boardMargins();
  const quantise = (value) => Math.round(value * 10000) / 10000;
  return {
    x: quantise(Math.max(margin.x, Math.min(1 - margin.x, point.x))),
    y: quantise(Math.max(margin.y, Math.min(1 - margin.y, point.y))),
  };
}

function onPointerDown(event) {
  const node = event.target.closest(".seal-node");
  if (!node || state.solved || (event.pointerType === "mouse" && event.button !== 0)) return;
  ensureAudio();
  event.preventDefault();
  const id = Number(node.dataset.id);
  const vertex = pointFor(id);
  const rect = elements.board.getBoundingClientRect();
  setSelected(id, true);
  node.focus({ preventScroll: true });
  try {
    node.setPointerCapture(event.pointerId);
  } catch {
    // Window-level move/up listeners below keep dragging robust without capture.
  }
  node.classList.add("is-dragging");
  state.dragging = {
    id,
    node,
    pointerId: event.pointerId,
    from: { x: vertex.x, y: vertex.y },
    offsetX: event.clientX - (rect.left + vertex.x * rect.width),
    offsetY: event.clientY - (rect.top + vertex.y * rect.height),
    startingCrossings: state.crossings.length,
    lastCrossings: state.crossings.length,
    moved: false,
  };
  dismissGestureHint();
  playCue("pick");
}

function onPointerMove(event) {
  const drag = state.dragging;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  const rect = elements.board.getBoundingClientRect();
  const next = clampPoint({
    x: (event.clientX - rect.left - drag.offsetX) / Math.max(rect.width, 1),
    y: (event.clientY - rect.top - drag.offsetY) / Math.max(rect.height, 1),
  });
  const current = pointFor(drag.id);
  if (!current || (current.x === next.x && current.y === next.y)) return;
  drag.moved = true;
  setPoint(drag.id, next);
  updateNodePosition(drag.id);
  updatePuzzleView();
  if (state.crossings.length < drag.lastCrossings) playCue("loosen");
  drag.lastCrossings = state.crossings.length;
}

function finishDrag(event) {
  const drag = state.dragging;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  drag.node.classList.remove("is-dragging");
  if (drag.node.hasPointerCapture?.(drag.pointerId)) drag.node.releasePointerCapture(drag.pointerId);
  const current = pointFor(drag.id);
  const moved = drag.moved && Math.hypot(current.x - drag.from.x, current.y - drag.from.y) > 0.0001;
  const improved = state.crossings.length < drag.startingCrossings;
  state.dragging = null;
  if (moved) {
    state.history.push({
      id: drag.id,
      from: { ...drag.from },
      to: { x: current.x, y: current.y },
    });
    state.steps += 1;
  }
  updatePuzzleView({ announce: moved, allowWin: moved });
  saveGame();
  if (!state.solved) playCue("drop", improved);
}

function onNodeFocus(event) {
  const node = event.target.closest(".seal-node");
  if (!node) return;
  setSelected(Number(node.dataset.id), false);
}

function onNodeKeyDown(event) {
  const node = event.target.closest(".seal-node");
  if (!node || state.solved) return;
  const arrows = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setSelected(Number(node.dataset.id), true);
    dismissGestureHint();
    playCue("pick");
    return;
  }
  if (!arrows[event.key]) return;
  event.preventDefault();
  ensureAudio();
  const id = Number(node.dataset.id);
  const current = pointFor(id);
  const from = { x: current.x, y: current.y };
  const amount = event.shiftKey ? 0.045 : 0.014;
  const [horizontal, vertical] = arrows[event.key];
  const next = clampPoint({
    x: current.x + horizontal * amount,
    y: current.y + vertical * amount,
  });
  if (next.x === current.x && next.y === current.y) return;
  const before = state.crossings.length;
  setPoint(id, next);
  state.history.push({ id, from, to: { ...next } });
  state.steps += 1;
  setSelected(id, false);
  dismissGestureHint();
  updateNodePosition(id);
  updatePuzzleView({ announce: true, allowWin: true });
  saveGame();
  if (!state.solved) playCue("drop", state.crossings.length < before);
}

function pointInPixels(vertex, width, height) {
  return { x: vertex.x * width, y: vertex.y * height };
}

function intersectionMarker(firstA, firstB, secondA, secondB) {
  const denominator = (firstA.x - firstB.x) * (secondA.y - secondB.y)
    - (firstA.y - firstB.y) * (secondA.x - secondB.x);
  if (Math.abs(denominator) > 1e-8) {
    const determinantA = firstA.x * firstB.y - firstA.y * firstB.x;
    const determinantB = secondA.x * secondB.y - secondA.y * secondB.x;
    return {
      x: (determinantA * (secondA.x - secondB.x) - (firstA.x - firstB.x) * determinantB) / denominator,
      y: (determinantA * (secondA.y - secondB.y) - (firstA.y - firstB.y) * determinantB) / denominator,
    };
  }
  const axis = Math.abs(firstA.x - firstB.x) >= Math.abs(firstA.y - firstB.y) ? "x" : "y";
  const ordered = [firstA, firstB, secondA, secondB].sort((a, b) => a[axis] - b[axis]);
  return {
    x: (ordered[1].x + ordered[2].x) / 2,
    y: (ordered[1].y + ordered[2].y) / 2,
  };
}

function strokeEdge(context, a, b, knotted, solved) {
  context.save();
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.lineCap = "round";
  context.strokeStyle = "rgba(59, 23, 22, 0.24)";
  context.lineWidth = knotted ? 5 : 4;
  context.stroke();

  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.strokeStyle = knotted && !solved ? "rgba(218, 37, 61, 0.92)" : "rgba(177, 124, 44, 0.88)";
  context.lineWidth = knotted && !solved ? 2.5 : 2.1;
  context.shadowBlur = knotted && !solved ? 13 : solved ? 11 : 5;
  context.shadowColor = knotted && !solved ? "rgba(239, 42, 70, 0.72)" : "rgba(215, 166, 77, 0.48)";
  context.stroke();

  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.strokeStyle = knotted && !solved ? "rgba(255, 162, 170, 0.7)" : "rgba(255, 228, 158, 0.58)";
  context.lineWidth = 0.7;
  context.shadowBlur = 0;
  context.stroke();
  context.restore();
}

function drawKnot(context, point, pulse) {
  const radius = 5.5 + pulse * 1.7;
  context.save();
  context.translate(point.x, point.y);
  context.strokeStyle = "rgba(147, 18, 39, 0.92)";
  context.fillStyle = "rgba(239, 44, 72, 0.2)";
  context.shadowColor = "rgba(239, 44, 72, 0.9)";
  context.shadowBlur = 12 + pulse * 6;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 2;
  context.strokeStyle = "rgba(255, 210, 207, 0.86)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(-radius * 0.75, -radius * 0.3);
  context.bezierCurveTo(-radius * 0.15, -radius, radius * 0.15, radius, radius * 0.75, radius * 0.3);
  context.moveTo(-radius * 0.75, radius * 0.3);
  context.bezierCurveTo(-radius * 0.15, radius, radius * 0.15, -radius, radius * 0.75, -radius * 0.3);
  context.stroke();
  context.restore();
}

function scheduleDraw() {
  if (drawFrame === null) drawFrame = requestAnimationFrame(drawCanvas);
}

function drawCanvas(timestamp = 0) {
  drawFrame = null;
  const rect = elements.board.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(rect.width * ratio);
  const targetHeight = Math.round(rect.height * ratio);
  if (elements.canvas.width !== targetWidth || elements.canvas.height !== targetHeight) {
    elements.canvas.width = targetWidth;
    elements.canvas.height = targetHeight;
  }
  const context = elements.canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);

  const positions = new Map(state.vertices.map((vertex) => [vertex.id, pointInPixels(vertex, rect.width, rect.height)]));
  const crossedEdges = edgeSetFromCrossings(state.crossings);
  const order = state.edges.map((_, index) => index).sort((a, b) => Number(crossedEdges.has(a)) - Number(crossedEdges.has(b)));
  order.forEach((edgeIndex) => {
    const [from, to] = state.edges[edgeIndex];
    const a = positions.get(from);
    const b = positions.get(to);
    if (a && b) strokeEdge(context, a, b, crossedEdges.has(edgeIndex), state.solved);
  });

  if (!state.solved) {
    const pulse = reducedMotion ? 0 : 0.55;
    state.crossings.forEach(([firstIndex, secondIndex]) => {
      const first = state.edges[firstIndex];
      const second = state.edges[secondIndex];
      const marker = intersectionMarker(
        positions.get(first[0]),
        positions.get(first[1]),
        positions.get(second[0]),
        positions.get(second[1]),
      );
      drawKnot(context, marker, pulse);
    });
  }

}

function openRules() {
  ensureAudio();
  playCue("paper");
  if (!elements.rulesDialog.open) elements.rulesDialog.showModal();
}

function toggleMute() {
  state.muted = !state.muted;
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "取消静音" : "静音");
  saveMutedSetting();
  if (!state.muted) {
    ensureAudio();
    playCue("paper");
    elements.liveStatus.textContent = "事务所铃音已开启。";
  } else {
    elements.liveStatus.textContent = "事务所铃音已静音。";
  }
}

function wireEvents() {
  elements.nodeLayer.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", finishDrag, { passive: false });
  window.addEventListener("pointercancel", finishDrag, { passive: false });
  elements.nodeLayer.addEventListener("focusin", onNodeFocus);
  elements.nodeLayer.addEventListener("keydown", onNodeKeyDown);

  elements.newGameButton.addEventListener("click", () => {
    ensureAudio();
    playCue("new");
    startPuzzle(state.difficulty);
  });
  elements.restartButton.addEventListener("click", restartPuzzle);
  elements.undoButton.addEventListener("click", undoMove);
  elements.muteButton.addEventListener("click", toggleMute);
  elements.rulesButton.addEventListener("click", openRules);
  elements.footerRulesButton.addEventListener("click", openRules);
  elements.levelButtons.forEach((button) => {
    button.addEventListener("click", () => {
      ensureAudio();
      playCue("new");
      startPuzzle(button.dataset.difficulty, makeSeed(), `${LEVEL_COPY[button.dataset.difficulty].short}案卷已展开`);
    });
  });
  elements.nextCaseButton.addEventListener("click", () => {
    hideVictory();
    playCue("new");
    startPuzzle(state.difficulty);
    elements.nodeLayer.querySelector(".seal-node:not(:disabled)")?.focus({ preventScroll: true });
  });
  elements.reviewBoardButton.addEventListener("click", () => {
    hideVictory();
    const target = lastFocusBeforeVictory?.isConnected && !lastFocusBeforeVictory.disabled
      ? lastFocusBeforeVictory
      : elements.newGameButton;
    target.focus({ preventScroll: true });
  });
  elements.victoryUndoButton.addEventListener("click", undoMove);
  elements.rulesDialog.addEventListener("click", (event) => {
    if (event.target === elements.rulesDialog) elements.rulesDialog.close();
  });
  elements.victorySheet.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hideVictory();
      elements.newGameButton.focus({ preventScroll: true });
    }
  });

  document.addEventListener("pointerdown", ensureAudio, { capture: true, once: true });
  document.addEventListener("keydown", ensureAudio, { capture: true, once: true });
  document.addEventListener("visibilitychange", scheduleDraw);
  window.addEventListener("pagehide", saveGame);

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener?.("change", (event) => {
    reducedMotion = event.matches;
    scheduleDraw();
  });
  if ("ResizeObserver" in window) new ResizeObserver(scheduleDraw).observe(elements.board);
  else window.addEventListener("resize", scheduleDraw);
}

function initialise() {
  state.muted = loadMutedSetting();
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "取消静音" : "静音");
  wireEvents();

  if (restoreGame()) {
    completionReported = state.solved;
    renderRegistry();
    renderNodes();
    updateDifficultyButtons();
    updatePuzzleView();
    if (state.solved) {
      elements.liveStatus.textContent = `已恢复完成的${LEVEL_COPY[state.difficulty].short}案卷，共用 ${state.steps} 步。`;
    } else {
      elements.liveStatus.textContent = `已恢复上次案卷：还有 ${state.crossings.length} 个线结，已流转 ${state.steps} 步。`;
    }
  } else {
    startPuzzle("medium", makeSeed(), "合契案卷已展开");
  }
}

initialise();
