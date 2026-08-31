import {
  DIFFICULTIES,
  EDGE_STATES,
  LEVELS,
  analyzeBoard,
  allEdgeKeys,
  createState,
  deserializeState,
  edgeKey,
  getLevel,
  getLevels,
  inBounds,
  nodeKey,
  normalizeBoardPoint,
  parseEdgeKey,
  serializeState,
  setEdgeState,
  stepBoardPoint,
  toggleEdge,
  traceLoop,
} from "./logic.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "ten-realms.spirit-dragon.save.v1";
const PREFS_KEY = "ten-realms.spirit-dragon.prefs.v1";
const VIEW_SIZE = 640;
const BOARD_PADDING = 76;
const MIN_POINTER_TARGET = 46;
const EDGE_AMBIGUITY_GAP = 4;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const DIFFICULTY_META = Object.freeze({
  easy: Object.freeze({ label: "初醒境", note: "5 × 5 · 灵珠启蒙" }),
  medium: Object.freeze({ label: "叠岚境", note: "6 × 6 · 山脉回折" }),
  hard: Object.freeze({ label: "归元境", note: "7 × 7 · 九曲合龙" }),
});

const elements = Object.freeze({
  board: document.querySelector("#dragon-board"),
  boardPearlStatus: document.querySelector("#board-pearl-status"),
  boardWash: document.querySelector("#board-wash"),
  levelKicker: document.querySelector("#level-kicker"),
  levelTitle: document.querySelector("#level-title"),
  pearlCount: document.querySelector("#pearl-count"),
  edgeCount: document.querySelector("#edge-count"),
  settledCount: document.querySelector("#settled-count"),
  clueTotal: document.querySelector("#clue-total"),
  conflictCount: document.querySelector("#conflict-count"),
  moveCount: document.querySelector("#move-count"),
  statusBanner: document.querySelector("#status-banner"),
  statusTitle: document.querySelector("#status-title"),
  statusCopy: document.querySelector("#status-copy"),
  saveState: document.querySelector("#save-state"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  difficultyNote: document.querySelector("#difficulty-note"),
  lineTool: document.querySelector("#line-tool"),
  markTool: document.querySelector("#mark-tool"),
  checkButton: document.querySelector("#check-button"),
  newGameButton: document.querySelector("#new-game-button"),
  restartButton: document.querySelector("#restart-button"),
  undoButton: document.querySelector("#undo-button"),
  muteButton: document.querySelector("#mute-button"),
  rulesButton: document.querySelector("#rules-button"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  rulesCloseButton: document.querySelector("#rules-close-button"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryEdges: document.querySelector("#victory-edges"),
  nextLevelButton: document.querySelector("#next-level-button"),
  stayButton: document.querySelector("#stay-button"),
  toast: document.querySelector("#toast"),
  assertiveStatus: document.querySelector("#assertive-status"),
});

let audioContext = null;
let toastTimer = 0;
let victoryTimer = 0;
let storageAvailable = true;
let pointerGesture = null;

function loadPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    return { muted: Boolean(value?.muted) };
  } catch {
    storageAvailable = false;
    return { muted: false };
  }
}

const preferences = loadPreferences();

const state = {
  level: LEVELS[0],
  difficulty: LEVELS[0].difficulty,
  game: createState(LEVELS[0]),
  history: [],
  tool: EDGE_STATES.LINE,
  cursor: { x: LEVELS[0].pearls[0].x, y: LEVELS[0].pearls[0].y },
  previousCursor: null,
  completed: false,
  muted: preferences.muted,
};

function stateSnapshot(game = state.game) {
  return serializeState(game);
}

function restoreSnapshot(snapshot) {
  const restored = deserializeState(snapshot, state.level);
  if (!restored) return false;
  state.game = restored;
  return true;
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || typeof saved.levelId !== "string") return false;
    const level = getLevel(saved.levelId);
    if (!level || !DIFFICULTIES.includes(saved.difficulty)) return false;
    const game = deserializeState(saved.game, level);
    if (!game) return false;

    const history = Array.isArray(saved.history)
      ? saved.history.slice(-120).filter((snapshot) => deserializeState(snapshot, level))
      : [];
    state.level = level;
    state.difficulty = level.difficulty;
    state.game = game;
    state.history = history;
    state.tool = saved.tool === EDGE_STATES.MARK ? EDGE_STATES.MARK : EDGE_STATES.LINE;
    state.completed = analyzeBoard(level, game).solved;
    state.cursor = normalizeBoardPoint(level, saved.cursor)
      ?? { x: level.pearls[0].x, y: level.pearls[0].y };
    state.previousCursor = null;
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}

function savePreferences() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ muted: state.muted }));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      levelId: state.level.id,
      difficulty: state.difficulty,
      game: stateSnapshot(),
      history: state.history.slice(-120),
      tool: state.tool,
      cursor: state.cursor,
      updatedAt: new Date().toISOString(),
    }));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  elements.saveState.textContent = storageAvailable ? "每一步留存本机" : "本机存档暂不可用";
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
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.022, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function playSound(effect) {
  if (state.muted) return;
  if (effect === "line") {
    tone(440, 0.12, { gain: 0.018, endFrequency: 660 });
    tone(880, 0.08, { gain: 0.008, delay: 0.028 });
  } else if (effect === "erase") {
    tone(360, 0.1, { type: "triangle", gain: 0.014, endFrequency: 240 });
  } else if (effect === "mark") {
    tone(610, 0.08, { type: "triangle", gain: 0.012 });
  } else if (effect === "undo") {
    tone(520, 0.13, { type: "sine", gain: 0.014, endFrequency: 390 });
  } else if (effect === "conflict") {
    tone(180, 0.16, { type: "triangle", gain: 0.018, endFrequency: 145 });
  } else if (effect === "complete") {
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      tone(frequency, 0.58, { gain: 0.019 - index * 0.002, delay: index * 0.115 });
    });
  }
}

function showToast(message, { assertive = false } = {}) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  if (assertive) {
    elements.assertiveStatus.textContent = "";
    requestAnimationFrame(() => { elements.assertiveStatus.textContent = message; });
  }
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function geometryFor(level = state.level) {
  const usable = VIEW_SIZE - BOARD_PADDING * 2;
  const step = Math.min(usable / Math.max(1, level.width - 1), usable / Math.max(1, level.height - 1));
  const width = step * (level.width - 1);
  const height = step * (level.height - 1);
  return {
    step,
    originX: (VIEW_SIZE - width) / 2,
    originY: (VIEW_SIZE - height) / 2,
  };
}

function pointPosition(point) {
  const geometry = geometryFor();
  return {
    x: geometry.originX + point.x * geometry.step,
    y: geometry.originY + point.y * geometry.step,
  };
}

function svgLine(x1, y1, x2, y2, className, attributes = "") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${className}" ${attributes}/>`;
}

function svgDefs() {
  return `
    <defs>
      <linearGradient id="field-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#154f55" stop-opacity=".4"/>
        <stop offset=".55" stop-color="#0b2932" stop-opacity=".08"/>
        <stop offset="1" stop-color="#296b64" stop-opacity=".26"/>
      </linearGradient>
      <linearGradient id="vein-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#56bda8"/><stop offset=".48" stop-color="#ddffe8"/><stop offset="1" stop-color="#d8bf75"/>
      </linearGradient>
      <radialGradient id="earth-gradient" cx="35%" cy="27%" r="75%">
        <stop offset="0" stop-color="#47645c"/><stop offset=".32" stop-color="#17383a"/><stop offset="1" stop-color="#031319"/>
      </radialGradient>
      <radialGradient id="heaven-gradient" cx="34%" cy="27%" r="74%">
        <stop offset="0" stop-color="#ffffff"/><stop offset=".46" stop-color="#c8e8df"/><stop offset="1" stop-color="#6baaa2"/>
      </radialGradient>
      <filter id="vein-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="danger-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4" result="blur"/><feFlood flood-color="#ff6e68" flood-opacity=".65"/><feComposite in2="blur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="pearl-shadow" x="-80%" y="-80%" width="260%" height="260%">
        <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#001015" flood-opacity=".6"/>
      </filter>
      <filter id="dragon-glow" x="-150%" y="-150%" width="400%" height="400%">
        <feGaussianBlur stdDeviation="6" result="blur"/><feFlood flood-color="#a3ffe0" flood-opacity=".9"/><feComposite in2="blur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;
}

function contourMarkup() {
  return `
    <path class="contour" d="M42 162 C142 82 236 102 302 166 S474 252 596 132"/>
    <path class="contour" d="M38 476 C147 382 246 429 328 493 S510 556 602 452"/>
    <path class="contour" d="M76 92 C170 32 288 75 347 112 S494 144 565 74"/>
    <path class="contour" d="M59 552 C180 499 239 542 338 577 S508 595 583 528"/>`;
}

function markMarkup(edge) {
  const { a, b } = parseEdgeKey(edge);
  const first = pointPosition(a);
  const second = pointPosition(b);
  const mx = (first.x + second.x) / 2;
  const my = (first.y + second.y) / 2;
  const size = 7.5;
  return `<g aria-hidden="true">
    ${svgLine(mx - size, my - size, mx + size, my + size, "edge-mark")}
    ${svgLine(mx - size, my + size, mx + size, my - size, "edge-mark")}
  </g>`;
}

function pearlMarkup(pearl, pearlResult) {
  const position = pointPosition(pearl);
  const stateClass = pearlResult?.status === "satisfied"
    ? " is-settled"
    : pearlResult?.status === "conflict" ? " is-conflict" : "";
  const mainClass = pearl.type === "black" ? "pearl-earth" : "pearl-heaven";
  const markClass = pearl.type === "black" ? "pearl-earth-mark" : "pearl-heaven-mark";
  const inner = pearl.type === "black"
    ? `<path class="${markClass}" d="M ${position.x - 6} ${position.y} L ${position.x} ${position.y - 6} L ${position.x + 6} ${position.y} L ${position.x} ${position.y + 6} Z"/>`
    : `<path class="${markClass}" d="M ${position.x - 7} ${position.y} Q ${position.x} ${position.y - 6} ${position.x + 7} ${position.y} Q ${position.x} ${position.y + 6} ${position.x - 7} ${position.y}"/>`;
  return `<g class="pearl-group${stateClass}" aria-hidden="true">
    <circle class="pearl-halo" cx="${position.x}" cy="${position.y}" r="25"/>
    <circle class="${mainClass}" cx="${position.x}" cy="${position.y}" r="15"/>
    ${inner}
  </g>`;
}

function pearlAccessibleLabel(pearl, pearlResult, { includePosition = true } = {}) {
  const typeLabel = pearl.type === "black" ? "地珠" : "天珠";
  const stateLabel = pearlResult?.status === "satisfied"
    ? "已安定"
    : pearlResult?.status === "conflict" ? "当前冲突" : "待贯通";
  const positionLabel = includePosition ? `第 ${pearl.y + 1} 行第 ${pearl.x + 1} 列，` : "";
  return `${positionLabel}${typeLabel}，${stateLabel}`;
}

function conflictEdgeSet(analysis) {
  const conflicts = new Set();
  const hasLoopConflict = analysis.conflicts.some((conflict) => conflict.type === "loop");
  if (hasLoopConflict) return new Set(state.game.lines);
  for (const conflict of analysis.conflicts) {
    if (conflict.type !== "degree" || !conflict.key) continue;
    for (const edge of state.game.lines) {
      const parsed = parseEdgeKey(edge);
      if (nodeKey(parsed.a) === conflict.key || nodeKey(parsed.b) === conflict.key) conflicts.add(edge);
    }
  }
  return conflicts;
}

function completedLoopMarkup(analysis) {
  if (!analysis.solved) return "";
  const loop = traceLoop(state.level, state.game);
  if (!loop) return "";
  const points = loop.map(pointPosition);
  const pathData = `${points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")} Z`;
  const nextPoint = points[1] ?? points[0];
  const staticAngle = Math.atan2(nextPoint.y - points[0].y, nextPoint.x - points[0].x) * 180 / Math.PI;
  const avatarTransform = reducedMotionQuery.matches
    ? ` transform="translate(${points[0].x} ${points[0].y}) rotate(${staticAngle})"`
    : "";
  const motion = reducedMotionQuery.matches
    ? ""
    : `<animateMotion dur="7.5s" repeatCount="indefinite" rotate="auto"><mpath href="#awakened-loop"/></animateMotion>`;
  return `
    <g aria-hidden="true">
    <path id="awakened-loop" class="final-loop" d="${pathData}"/>
    <g class="dragon-avatar"${avatarTransform}>
      <path class="dragon-avatar__body" d="M -16 0 C -10 -9 2 -10 12 -3 L 19 -7 L 16 1 L 20 7 L 11 4 C 1 12 -10 9 -16 0 Z"/>
      <circle class="dragon-avatar__eye" cx="10" cy="-2" r="1.7"/>
      ${motion}
    </g>
    </g>`;
}

function cssPixelsToViewBox(pixels) {
  const rect = elements.board.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return pixels;
  return Math.max(pixels * VIEW_SIZE / rect.width, pixels * VIEW_SIZE / rect.height);
}

function renderBoard(analysis) {
  elements.board.setAttribute("viewBox", `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
  const allEdges = allEdgeKeys(state.level);
  const conflictedEdges = conflictEdgeSet(analysis);
  const pearlByKey = new Map(analysis.pearls.map((result) => [result.key, result]));
  const baseEdges = [];
  const lineEdges = [];
  const hitEdges = [];
  const nodes = [];

  for (const edge of allEdges) {
    const { a, b } = parseEdgeKey(edge);
    const first = pointPosition(a);
    const second = pointPosition(b);
    baseEdges.push(svgLine(first.x, first.y, second.x, second.y, "grid-edge"));
    if (state.game.lines.has(edge)) {
      lineEdges.push(svgLine(first.x, first.y, second.x, second.y, "vein-shadow"));
      lineEdges.push(svgLine(
        first.x,
        first.y,
        second.x,
        second.y,
        `vein-edge${conflictedEdges.has(edge) ? " is-conflict" : ""}`,
      ));
    }
    hitEdges.push(svgLine(
      first.x,
      first.y,
      second.x,
      second.y,
      "edge-hit",
      `data-edge="${edge}"`,
    ));
  }

  for (let y = 0; y < state.level.height; y += 1) {
    for (let x = 0; x < state.level.width; x += 1) {
      const position = pointPosition({ x, y });
      nodes.push(`<circle class="node-dot" cx="${position.x}" cy="${position.y}" r="3.1"/>`);
    }
  }

  const pearls = state.level.pearls.map((pearl) => pearlMarkup(pearl, pearlByKey.get(nodeKey(pearl))));
  const pearlAnnouncements = state.level.pearls.map((pearl) => (
    pearlAccessibleLabel(pearl, pearlByKey.get(nodeKey(pearl)))
  ));
  const cursorPearl = state.level.pearls.find((pearl) => nodeKey(pearl) === nodeKey(state.cursor));
  const cursorPearlLabel = cursorPearl
    ? `，此处为${pearlAccessibleLabel(cursorPearl, pearlByKey.get(nodeKey(cursorPearl)), { includePosition: false })}`
    : "，此处无灵珠";
  const cursorPosition = pointPosition(state.cursor);
  const cursor = `<circle class="cursor-ring" cx="${cursorPosition.x}" cy="${cursorPosition.y}" r="29" aria-hidden="true"/>`;
  const touchNodes = [];
  const touchRadius = cssPixelsToViewBox(MIN_POINTER_TARGET / 2);
  for (let y = 0; y < state.level.height; y += 1) {
    for (let x = 0; x < state.level.width; x += 1) {
      const position = pointPosition({ x, y });
      touchNodes.push(`<circle class="node-touch" cx="${position.x}" cy="${position.y}" r="${touchRadius}" data-node="${x},${y}" aria-hidden="true"/>`);
    }
  }

  elements.board.setAttribute(
    "aria-label",
    `${state.level.title}，${state.level.width} 乘 ${state.level.height} 灵图，${state.level.pearls.length} 颗灵珠。当前游标第 ${state.cursor.y + 1} 行第 ${state.cursor.x + 1} 列${cursorPearlLabel}。`,
  );
  elements.boardPearlStatus.textContent = `灵珠状态：${pearlAnnouncements.join("；")}。`;
  elements.board.innerHTML = `${svgDefs()}
    <g aria-hidden="true">
    <rect class="board-field" x="18" y="18" width="604" height="604" rx="28"/>
    <rect class="field-glow" x="25" y="25" width="590" height="590" rx="24"/>
    ${contourMarkup()}
    <g aria-hidden="true">${baseEdges.join("")}</g>
    <g aria-hidden="true">${lineEdges.join("")}</g>
    <g aria-hidden="true">${[...state.game.marks].map(markMarkup).join("")}</g>
    <g aria-hidden="true">${nodes.join("")}${pearls.join("")}</g>
    ${cursor}
    ${completedLoopMarkup(analysis)}
    </g>
    <g aria-hidden="true">${hitEdges.join("")}${touchNodes.join("")}</g>`;
}

function statusCopyFor(analysis) {
  if (analysis.solved) return ["灵龙归脉", "唯一闭环已贯通所有灵珠。"];
  if (analysis.conflicts.length > 0) {
    const first = analysis.conflicts[0];
    return ["此处逆脉", first.message ?? "当前线势已经与灵珠约定冲突。"];
  }
  if (analysis.lineCount === 0) return ["山雾未散", "从任意节点起笔，穿过每颗灵珠。"];
  if (analysis.openEnds.length > 0) {
    return ["龙脉延伸中", `${analysis.openEnds.length} 个脉端仍待相接；未完成的端点不算冲突。`];
  }
  return ["灵珠仍在回应", `还有 ${analysis.uncoveredPearls.length} 颗灵珠未被龙脉经过。`];
}

function render({ save = true } = {}) {
  const analysis = analyzeBoard(state.level, state.game);
  const settled = analysis.pearls.filter((pearl) => pearl.status === "satisfied").length;
  const [statusTitle, statusCopy] = statusCopyFor(analysis);
  const levels = getLevels(state.difficulty);
  const levelIndex = Math.max(0, levels.findIndex((level) => level.id === state.level.id));
  const meta = DIFFICULTY_META[state.difficulty];

  elements.levelKicker.textContent = `${meta.label} · 卷${["一", "二", "三"][levelIndex] ?? levelIndex + 1}`;
  elements.levelTitle.textContent = state.level.title;
  elements.pearlCount.textContent = `${settled} / ${state.level.pearls.length}`;
  elements.edgeCount.textContent = String(analysis.lineCount);
  elements.settledCount.textContent = String(settled);
  elements.clueTotal.textContent = ` / ${state.level.pearls.length}`;
  elements.conflictCount.textContent = String(analysis.conflicts.length);
  elements.moveCount.textContent = String(state.game.moves);
  elements.statusTitle.textContent = statusTitle;
  elements.statusCopy.textContent = statusCopy;
  elements.statusBanner.classList.toggle("has-conflict", analysis.conflicts.length > 0);
  elements.statusBanner.classList.toggle("is-complete", analysis.solved);
  elements.undoButton.disabled = state.history.length === 0;
  elements.lineTool.classList.toggle("is-active", state.tool === EDGE_STATES.LINE);
  elements.markTool.classList.toggle("is-active", state.tool === EDGE_STATES.MARK);
  elements.lineTool.setAttribute("aria-pressed", String(state.tool === EDGE_STATES.LINE));
  elements.markTool.setAttribute("aria-pressed", String(state.tool === EDGE_STATES.MARK));
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "声音已关闭，点击开启" : "声音已开启，点击关闭");
  elements.difficultyNote.textContent = meta.note;
  elements.saveState.textContent = storageAvailable ? "每一步留存本机" : "本机存档暂不可用";
  document.body.classList.toggle("is-awake", analysis.solved);

  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficulty));
  }

  renderBoard(analysis);
  if (save) saveGame();
  return analysis;
}

function setTool(tool, { announce = true } = {}) {
  if (tool !== EDGE_STATES.LINE && tool !== EDGE_STATES.MARK) return;
  state.tool = tool;
  render();
  if (announce) showToast(tool === EDGE_STATES.LINE ? "已执龙脉笔：拖动画线或擦线" : "已执禁行笔：标记不走的边");
}

function pushHistory() {
  state.history.push(stateSnapshot());
  if (state.history.length > 120) state.history.shift();
}

function applyEdgeTarget(edge, target, { history = true, sound = true } = {}) {
  if (state.completed) return false;
  const beforeAnalysis = analyzeBoard(state.level, state.game);
  const result = setEdgeState(state.level, state.game, edge, target);
  if (!result.changed) {
    if (result.reason === "degree-limit") {
      showToast("一处节点最多只能接两段龙脉，不能分叉。", { assertive: true });
      playSound("conflict");
    }
    return false;
  }
  if (history) pushHistory();
  state.game = result.state;
  const analysis = render();
  if (sound) {
    if (target === EDGE_STATES.LINE) playSound("line");
    else if (target === EDGE_STATES.MARK) playSound("mark");
    else playSound("erase");
  }
  const newConflict = analysis.conflicts.length > beforeAnalysis.conflicts.length;
  if (newConflict) playSound("conflict");
  if (analysis.solved) completeGame(analysis);
  return true;
}

function toggleSelectedEdge(edge) {
  if (state.completed) return;
  const result = toggleEdge(state.level, state.game, edge, state.tool);
  if (!result.changed) {
    if (result.reason === "degree-limit") {
      showToast("龙脉不能分叉：请先擦去这个节点的一段线。", { assertive: true });
      playSound("conflict");
    }
    return;
  }
  pushHistory();
  state.game = result.state;
  const analysis = render();
  if (result.target === EDGE_STATES.LINE) playSound("line");
  else if (result.target === EDGE_STATES.MARK) playSound("mark");
  else playSound("erase");
  if (analysis.solved) completeGame(analysis);
}

function completeGame(analysis) {
  if (state.completed) return;
  state.completed = true;
  render();
  const tier = DIFFICULTIES.indexOf(state.difficulty) + 1;
  const reward = {
    levelId: state.level.id,
    tier: Math.max(1, tier),
    moves: state.game.moves,
  };
  if (window.RealmArcade?.complete) window.RealmArcade.complete(reward);
  else (window.__realmCompletionQueue ??= []).push(reward);
  playSound("complete");
  elements.boardWash.classList.remove("is-flashing");
  void elements.boardWash.offsetWidth;
  elements.boardWash.classList.add("is-flashing");
  elements.victoryMoves.textContent = `${state.game.moves} 步`;
  elements.victoryEdges.textContent = `${analysis.lineCount} 段`;
  clearTimeout(victoryTimer);
  victoryTimer = window.setTimeout(() => {
    if (!elements.victoryDialog.open) elements.victoryDialog.showModal();
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 900);
}

function undo() {
  const snapshot = state.history.pop();
  if (!snapshot) {
    showToast("还没有可以撤销的落笔。");
    return;
  }
  clearTimeout(victoryTimer);
  if (elements.victoryDialog.open) elements.victoryDialog.close();
  state.completed = false;
  restoreSnapshot(snapshot);
  render();
  playSound("undo");
  showToast("已撤销上一笔。");
}

function resetLevel({ announce = true } = {}) {
  clearTimeout(victoryTimer);
  if (elements.victoryDialog.open) elements.victoryDialog.close();
  state.game = createState(state.level);
  state.history = [];
  state.completed = false;
  state.cursor = { x: state.level.pearls[0].x, y: state.level.pearls[0].y };
  state.previousCursor = null;
  render();
  if (announce) showToast(`《${state.level.title}》已重新展开。`);
}

function selectLevel(level, { announce = true } = {}) {
  state.level = level;
  state.difficulty = level.difficulty;
  resetLevel({ announce: false });
  if (announce) showToast(`山河卷已换为《${level.title}》。`);
}

function nextLevel() {
  const levels = getLevels(state.difficulty);
  const currentIndex = levels.findIndex((level) => level.id === state.level.id);
  selectLevel(levels[(currentIndex + 1) % levels.length]);
}

function chooseDifficulty(difficulty) {
  if (!DIFFICULTIES.includes(difficulty)) return;
  const next = getLevels(difficulty)[0];
  selectLevel(next, { announce: false });
  showToast(`已进入${DIFFICULTY_META[difficulty].label}。`);
}

function checkBoard() {
  const analysis = render();
  elements.boardWash.classList.remove("is-flashing");
  void elements.boardWash.offsetWidth;
  elements.boardWash.classList.add("is-flashing");
  if (analysis.solved) {
    showToast("龙脉完整：灵龙已苏醒。");
  } else if (analysis.conflicts.length) {
    showToast(`${analysis.conflicts[0].message}（共 ${analysis.conflicts.length} 处）`, { assertive: true });
    playSound("conflict");
  } else if (analysis.lineCount === 0) {
    showToast("灵图仍空白，从任一相邻格心之间起笔。");
  } else if (analysis.openEnds.length) {
    showToast(`没有确定冲突；还有 ${analysis.openEnds.length} 个脉端需要接合。`);
  } else {
    showToast(`没有确定冲突；仍有 ${analysis.uncoveredPearls.length} 颗灵珠未贯通。`);
  }
}

function renderDifficultyButtons() {
  elements.difficultyButtons.replaceChildren();
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "difficulty-button";
    button.dataset.difficulty = difficulty;
    button.textContent = DIFFICULTY_META[difficulty].label;
    button.setAttribute("aria-pressed", String(difficulty === state.difficulty));
    button.addEventListener("click", () => chooseDifficulty(difficulty));
    elements.difficultyButtons.append(button);
  }
}

function clientToViewBox(event) {
  const rect = elements.board.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    x: (event.clientX - rect.left) * VIEW_SIZE / rect.width,
    y: (event.clientY - rect.top) * VIEW_SIZE / rect.height,
  };
}

function closestNodeFromEvent(event) {
  const viewPoint = clientToViewBox(event);
  if (!viewPoint) return null;
  const geometry = geometryFor();
  const x = Math.round((viewPoint.x - geometry.originX) / geometry.step);
  const y = Math.round((viewPoint.y - geometry.originY) / geometry.step);
  const point = { x, y };
  if (!inBounds(state.level, point)) return null;
  const position = pointPosition(point);
  const distance = Math.hypot(viewPoint.x - position.x, viewPoint.y - position.y);
  return distance <= cssPixelsToViewBox(MIN_POINTER_TARGET / 2) ? point : null;
}

function closestEdgeFromEvent(event) {
  const viewPoint = clientToViewBox(event);
  if (!viewPoint) return null;
  let closest = null;
  let closestDistance = Infinity;
  let secondDistance = Infinity;

  for (const edge of allEdgeKeys(state.level)) {
    const { a, b } = parseEdgeKey(edge);
    const first = pointPosition(a);
    const second = pointPosition(b);
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = ((viewPoint.x - first.x) * dx + (viewPoint.y - first.y) * dy) / lengthSquared;
    if (projection < 0.2 || projection > 0.8) continue;
    const projected = {
      x: first.x + projection * dx,
      y: first.y + projection * dy,
    };
    const distance = Math.hypot(viewPoint.x - projected.x, viewPoint.y - projected.y);
    if (distance < closestDistance) {
      secondDistance = closestDistance;
      closest = edge;
      closestDistance = distance;
    } else if (distance < secondDistance) {
      secondDistance = distance;
    }
  }

  const unambiguous = secondDistance - closestDistance >= cssPixelsToViewBox(EDGE_AMBIGUITY_GAP);
  return closestDistance <= cssPixelsToViewBox(MIN_POINTER_TARGET / 2) && unambiguous ? closest : null;
}

function alignedNodeSteps(from, to) {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (dx !== 0 && dy !== 0) return [];
  const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  if (distance === 0) return [];
  return Array.from({ length: distance }, (_, index) => ({
    x: from.x + dx * (index + 1),
    y: from.y + dy * (index + 1),
  }));
}

function gestureApplyBetween(from, to) {
  const steps = alignedNodeSteps(from, to);
  let previous = from;
  for (const point of steps) {
    const edge = edgeKey(previous, point);
    if (!pointerGesture.visited.has(edge)) {
      if (pointerGesture.target === null) {
        const collection = state.tool === EDGE_STATES.LINE ? state.game.lines : state.game.marks;
        pointerGesture.target = collection.has(edge) ? EDGE_STATES.EMPTY : state.tool;
      }
      const changed = applyEdgeTarget(edge, pointerGesture.target, {
        history: !pointerGesture.hasHistory,
        sound: !pointerGesture.moved,
      });
      if (changed) {
        pointerGesture.hasHistory = true;
        pointerGesture.moved = true;
      }
      pointerGesture.visited.add(edge);
    }
    previous = point;
  }
  pointerGesture.lastNode = to;
  state.previousCursor = state.cursor;
  state.cursor = to;
}

function onPointerDown(event) {
  if (event.button !== 0 || state.completed) return;
  ensureAudio();
  const targetEdge = closestEdgeFromEvent(event);
  const startNode = closestNodeFromEvent(event);
  pointerGesture = {
    pointerId: event.pointerId,
    startNode,
    lastNode: startNode,
    targetEdge,
    target: null,
    visited: new Set(),
    moved: false,
    hasHistory: false,
  };
  elements.board.setPointerCapture(event.pointerId);
  if (startNode) {
    state.previousCursor = state.cursor;
    state.cursor = startNode;
    render();
  }
  event.preventDefault();
}

function onPointerMove(event) {
  if (!pointerGesture || pointerGesture.pointerId !== event.pointerId || !pointerGesture.lastNode) return;
  const nextNode = closestNodeFromEvent(event);
  if (!nextNode || nodeKey(nextNode) === nodeKey(pointerGesture.lastNode)) return;
  const steps = alignedNodeSteps(pointerGesture.lastNode, nextNode);
  if (!steps.length) return;
  gestureApplyBetween(pointerGesture.lastNode, nextNode);
  event.preventDefault();
}

function finishPointer(event, cancelled = false) {
  if (!pointerGesture || pointerGesture.pointerId !== event.pointerId) return;
  const gesture = pointerGesture;
  pointerGesture = null;
  if (elements.board.hasPointerCapture(event.pointerId)) elements.board.releasePointerCapture(event.pointerId);
  if (!cancelled && !gesture.moved && gesture.targetEdge) toggleSelectedEdge(gesture.targetEdge);
  else if (!gesture.moved && gesture.startNode) render();
}

const KEY_DIRECTIONS = Object.freeze({
  ArrowUp: Object.freeze({ x: 0, y: -1 }),
  ArrowRight: Object.freeze({ x: 1, y: 0 }),
  ArrowDown: Object.freeze({ x: 0, y: 1 }),
  ArrowLeft: Object.freeze({ x: -1, y: 0 }),
});

function moveCursor(direction, draw) {
  const next = stepBoardPoint(state.level, state.cursor, direction);
  if (!next) {
    showToast("游标已到灵图边界。");
    return;
  }
  const traversedEdge = edgeKey(state.cursor, next);
  state.previousCursor = { ...state.cursor };
  state.cursor = next;
  if (draw) toggleSelectedEdge(traversedEdge);
  else render();
}

function onBoardKeyDown(event) {
  ensureAudio();
  const direction = KEY_DIRECTIONS[event.key];
  if (direction) {
    event.preventDefault();
    moveCursor(direction, event.shiftKey);
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && state.previousCursor) {
    event.preventDefault();
    if (Math.abs(state.previousCursor.x - state.cursor.x) + Math.abs(state.previousCursor.y - state.cursor.y) === 1) {
      toggleSelectedEdge(edgeKey(state.previousCursor, state.cursor));
    }
  }
}

function openRules() {
  if (!elements.rulesDialog.open) elements.rulesDialog.showModal();
}

function closeOnBackdrop(event) {
  if (event.target !== event.currentTarget) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) event.currentTarget.close();
}

function onGlobalKeyDown(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  if (elements.rulesDialog.open || elements.victoryDialog.open) {
    if (event.key === "Escape") return;
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "l") setTool(EDGE_STATES.LINE);
  else if (key === "x") setTool(EDGE_STATES.MARK);
  else if (key === "z") undo();
  else if (key === "r") resetLevel();
  else if (key === "n") nextLevel();
  else if (key === "c") checkBoard();
  else if (key === "m") toggleMute();
  else if (event.key === "?") openRules();
}

function toggleMute() {
  state.muted = !state.muted;
  savePreferences();
  if (!state.muted) {
    ensureAudio();
    tone(660, 0.12, { gain: 0.014, endFrequency: 880 });
  }
  render();
  showToast(state.muted ? "山谷已静音。" : "山谷声音已开启。");
}

function bindEvents() {
  elements.lineTool.addEventListener("click", () => setTool(EDGE_STATES.LINE));
  elements.markTool.addEventListener("click", () => setTool(EDGE_STATES.MARK));
  elements.checkButton.addEventListener("click", checkBoard);
  elements.newGameButton.addEventListener("click", nextLevel);
  elements.restartButton.addEventListener("click", () => resetLevel());
  elements.undoButton.addEventListener("click", undo);
  elements.muteButton.addEventListener("click", toggleMute);
  elements.rulesButton.addEventListener("click", openRules);
  elements.footerRulesButton.addEventListener("click", openRules);
  elements.rulesCloseButton.addEventListener("click", () => elements.rulesDialog.close());
  elements.nextLevelButton.addEventListener("click", () => {
    elements.victoryDialog.close();
    nextLevel();
  });
  elements.stayButton.addEventListener("click", () => elements.victoryDialog.close());
  elements.rulesDialog.addEventListener("click", closeOnBackdrop);
  elements.victoryDialog.addEventListener("click", closeOnBackdrop);
  elements.board.addEventListener("pointerdown", onPointerDown);
  elements.board.addEventListener("pointermove", onPointerMove);
  elements.board.addEventListener("pointerup", (event) => finishPointer(event));
  elements.board.addEventListener("pointercancel", (event) => finishPointer(event, true));
  elements.board.addEventListener("keydown", onBoardKeyDown);
  elements.board.addEventListener("contextmenu", (event) => event.preventDefault());
  reducedMotionQuery.addEventListener("change", () => render({ save: false }));
  window.addEventListener("resize", () => render({ save: false }));
  document.addEventListener("keydown", onGlobalKeyDown);
  document.addEventListener("pointerdown", () => ensureAudio(), { once: true, passive: true });
}

loadSavedGame();
renderDifficultyButtons();
bindEvents();
render({ save: false });
