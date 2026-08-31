import {
  RESPONSE,
  areResponseEquivalent,
  cellKey,
  findDistinguishingPort,
  generateLayout,
  parseCellKey,
  portToRay,
  responseMatchesRecord,
  responseSignature,
  traceRay,
} from "./logic.mjs";

const STORAGE_KEY = "five-realms:abyss-echo:v1";
const SAVE_VERSION = 1;
const HISTORY_LIMIT = 30;

const DIFFICULTIES = Object.freeze({
  shelf: Object.freeze({ name: "陆架", code: "SHELF", size: 6, target: 4 }),
  trench: Object.freeze({ name: "海沟", code: "TRENCH", size: 8, target: 5 }),
  hadal: Object.freeze({ name: "深渊", code: "HADAL", size: 10, target: 7 }),
});
const COMPLETION_TIERS = Object.freeze({ shelf: 1, trench: 2, hadal: 3 });

const SIDE_NAMES = Object.freeze({
  top: "北",
  right: "东",
  bottom: "南",
  left: "西",
});

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  arrayHint: document.querySelector("#arrayHint"),
  board: document.querySelector("#board"),
  boardScroll: document.querySelector("#boardScroll"),
  boardStage: document.querySelector("#boardStage"),
  checkButton: document.querySelector("#checkButton"),
  checkHint: document.querySelector("#checkHint"),
  checkMetric: document.querySelector("#checkMetric"),
  console: document.querySelector("#console"),
  difficultySelect: document.querySelector("#difficultySelect"),
  guessMetric: document.querySelector("#guessMetric"),
  mappingButton: document.querySelector("#mappingButton"),
  marineSnow: document.querySelector("#marineSnow"),
  missionCopy: document.querySelector("#missionCopy"),
  modelRing: document.querySelector("#modelRing"),
  moveMetric: document.querySelector("#moveMetric"),
  muteButton: document.querySelector("#muteButton"),
  newGameButton: document.querySelector("#newGameButton"),
  phaseLabel: document.querySelector("#phaseLabel"),
  progressFill: document.querySelector("#progressFill"),
  progressLabel: document.querySelector("#progressLabel"),
  responseCount: document.querySelector("#responseCount"),
  responseList: document.querySelector("#responseList"),
  restartButton: document.querySelector("#restartButton"),
  ringCount: document.querySelector("#ringCount"),
  rulesButton: document.querySelector("#rulesButton"),
  rulesDialog: document.querySelector("#rulesDialog"),
  sessionId: document.querySelector("#sessionId"),
  shotMetric: document.querySelector("#shotMetric"),
  signalCanvas: document.querySelector("#signalCanvas"),
  toast: document.querySelector("#toast"),
  undoButton: document.querySelector("#undoButton"),
  victoryBubbles: document.querySelector("#victoryBubbles"),
  victoryCopy: document.querySelector("#victoryCopy"),
  victoryDialog: document.querySelector("#victoryDialog"),
  victoryInspectButton: document.querySelector("#victoryInspectButton"),
  victoryNewButton: document.querySelector("#victoryNewButton"),
  victoryStats: document.querySelector("#victoryStats"),
};

let state;
let history = [];
let muted = false;
let audioContext = null;
let audioMaster = null;
let toastTimer = 0;
let failureTimer = 0;
let animationFrame = 0;
let clearCanvasTimer = 0;
let responseSoundTimer = 0;
let victoryTimer = 0;
let completionReported = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function secureRandom() {
  if (globalThis.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] / 4294967296;
  }
  return Math.random();
}

function makeSessionId() {
  const value = Math.floor(secureRandom() * 0x10000);
  return value.toString(16).toUpperCase().padStart(4, "0");
}

function isValidCellKeys(keys, size, exactLength = null) {
  if (!Array.isArray(keys)) return false;
  if (exactLength !== null && keys.length !== exactLength) return false;
  const unique = new Set();

  for (const key of keys) {
    const point = parseCellKey(key);
    if (!point || point.x < 0 || point.x >= size || point.y < 0 || point.y >= size) return false;
    unique.add(cellKey(point.x, point.y));
  }

  return unique.size === keys.length;
}

function isValidMark(mark) {
  if (mark === null) return true;
  if (!mark || typeof mark !== "object") return false;
  if (mark.kind === RESPONSE.HIT || mark.kind === RESPONSE.REFLECT) return mark.label === undefined;
  return mark.kind === RESPONSE.EXIT && Number.isInteger(mark.label) && mark.label > 0;
}

function isValidLogItem(item, size) {
  if (!item || typeof item !== "object") return false;
  if (!Number.isInteger(item.port) || item.port < 0 || item.port >= size * 4) return false;
  if (item.kind === RESPONSE.HIT || item.kind === RESPONSE.REFLECT) {
    return item.exit == null && item.label == null;
  }
  return (
    item.kind === RESPONSE.EXIT &&
    Number.isInteger(item.exit) &&
    item.exit >= 0 &&
    item.exit < size * 4 &&
    Number.isInteger(item.label) &&
    item.label > 0
  );
}

function isValidState(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.version !== SAVE_VERSION) return false;
  const config = DIFFICULTIES[candidate.difficulty];
  if (!config || candidate.size !== config.size || candidate.target !== config.target) return false;
  if (!isValidCellKeys(candidate.hidden, config.size, config.target)) return false;
  if (!isValidCellKeys(candidate.guesses, config.size)) return false;
  if (!Array.isArray(candidate.marks) || candidate.marks.length !== config.size * 4 || !candidate.marks.every(isValidMark)) return false;
  if (!Array.isArray(candidate.log) || candidate.log.length > 12 || !candidate.log.every((item) => isValidLogItem(item, config.size))) {
    return false;
  }
  if (!["playing", "won"].includes(candidate.phase)) return false;
  if (typeof candidate.session !== "string" || candidate.session.length < 1 || candidate.session.length > 12) return false;

  for (const key of ["nextPair", "moves", "shots", "checks"]) {
    if (!Number.isInteger(candidate[key]) || candidate[key] < 0) return false;
  }
  if (candidate.nextPair < 1) return false;

  const labels = new Map();
  for (let port = 0; port < candidate.marks.length; port += 1) {
    const mark = candidate.marks[port];
    if (!mark) continue;
    const response = traceRay(config.size, candidate.hidden, port);
    if (response.kind !== mark.kind) return false;
    if (mark.kind !== RESPONSE.EXIT) continue;

    const partner = candidate.marks[response.exit];
    if (partner?.kind !== RESPONSE.EXIT || partner.label !== mark.label) return false;
    const ports = labels.get(mark.label) ?? [];
    ports.push(port);
    labels.set(mark.label, ports);
  }

  const usedLabels = [...labels.keys()].sort((a, b) => a - b);
  if (candidate.nextPair !== (usedLabels.at(-1) ?? 0) + 1) return false;
  if (usedLabels.some((label, index) => label !== index + 1 || labels.get(label).length !== 2)) return false;

  for (const item of candidate.log) {
    if (!responseMatchesRecord(config.size, candidate.hidden, item.port, item)) return false;
    const mark = candidate.marks[item.port];
    if (!mark || mark.kind !== item.kind) return false;
    if (item.kind === RESPONSE.EXIT && mark.label !== item.label) return false;
  }

  if (candidate.shots < candidate.log.length || candidate.shots > config.size * 4) return false;
  if (candidate.shots > candidate.moves || candidate.checks > candidate.moves) return false;
  if (candidate.phase === "won") {
    if (
      candidate.checks < 1 ||
      candidate.guesses.length !== candidate.target ||
      candidate.marks.some((mark) => !mark) ||
      !areResponseEquivalent(config.size, candidate.hidden, candidate.guesses)
    ) {
      return false;
    }
  }
  return true;
}

function saveGame() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state,
        history: history.slice(-HISTORY_LIMIT),
        muted,
        completionReported,
      }),
    );
  } catch {
    // Private browsing or a full storage quota should never stop play.
  }
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!isValidState(saved?.state)) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    state = saved.state;
    muted = Boolean(saved.muted);
    completionReported = saved.completionReported === true || state.phase === "won";
    const hiddenKey = [...state.hidden].sort().join("|");
    history = Array.isArray(saved.history)
      ? saved.history
          .filter(
            (snapshot) =>
              isValidState(snapshot) &&
              snapshot.session === state.session &&
              snapshot.difficulty === state.difficulty &&
              [...snapshot.hidden].sort().join("|") === hiddenKey,
          )
          .slice(-HISTORY_LIMIT)
      : [];
    return true;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures and start a clean local session.
    }
    return false;
  }
}

function scoreLayout(size, balls) {
  const signature = responseSignature(size, balls);
  const hits = signature.filter((value) => value === "H").length;
  const reflections = signature.filter((value) => value === "R").length;
  const pairedPorts = signature.filter((value) => value.startsWith("E:")).length;
  const pairs = pairedPorts / 2;
  const diversity = Number(hits > 0) + Number(reflections > 0) + Number(pairs > 0);
  return diversity * 12 + Math.min(hits, 7) + Math.min(reflections, 7) + Math.min(pairs, 8) * 2;
}

function createInterestingLayout(config) {
  let best = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const candidate = generateLayout(config.size, config.target, secureRandom);
    const signature = responseSignature(config.size, candidate);
    const hits = signature.filter((value) => value === "H").length;
    const reflections = signature.filter((value) => value === "R").length;
    const pairs = signature.filter((value) => value.startsWith("E:")).length / 2;
    const score = scoreLayout(config.size, candidate);

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
    if (hits >= 2 && reflections >= 1 && pairs >= 2) return candidate;
  }

  return best;
}

function freshState(difficulty, hidden = null, session = null) {
  const config = DIFFICULTIES[difficulty];
  const layout = hidden ?? createInterestingLayout(config);
  return {
    version: SAVE_VERSION,
    difficulty,
    size: config.size,
    target: config.target,
    hidden: layout.map(({ x, y }) => cellKey(x, y)),
    guesses: [],
    marks: Array(config.size * 4).fill(null),
    log: [],
    nextPair: 1,
    moves: 0,
    shots: 0,
    checks: 0,
    phase: "playing",
    session: session ?? makeSessionId(),
  };
}

function pushHistory() {
  history.push(clone(state));
  if (history.length > HISTORY_LIMIT) history.shift();
}

function portLabel(port) {
  const ray = portToRay(state.size, port);
  return SIDE_NAMES[ray.side] + "·" + String(ray.offset + 1).padStart(2, "0");
}

function portAriaLabel(port, mark = null) {
  const ray = portToRay(state.size, port);
  const location = SIDE_NAMES[ray.side] + "侧第 " + String(ray.offset + 1) + " 枚浮标";
  if (!mark) return location + "，尚未发射";
  if (mark.kind === RESPONSE.HIT) return location + "，反馈为吞没 H";
  if (mark.kind === RESPONSE.REFLECT) return location + "，反馈为回声 R";
  return location + "，出口配对编号 " + String(mark.label);
}

function gridPositionForPort(port) {
  const ray = portToRay(state.size, port);
  return {
    row: ray.y + 1,
    column: ray.x + 1,
  };
}

function makePortButton(port) {
  const position = gridPositionForPort(port);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "port";
  button.dataset.port = String(port);
  button.dataset.gridRow = String(position.row);
  button.dataset.gridColumn = String(position.column);
  button.dataset.side = portToRay(state.size, port).side;

  const label = document.createElement("span");
  label.setAttribute("aria-hidden", "true");
  button.append(label);
  return button;
}

function buildBoard() {
  elements.board.replaceChildren();
  elements.boardStage.style.setProperty("--grid-size", String(state.size + 2));
  elements.board.setAttribute(
    "aria-label",
    String(state.size) + " 乘 " + String(state.size) + " 声呐阵列，外围共有 " + String(state.size * 4) + " 枚浮标",
  );

  for (let row = 0; row < state.size + 2; row += 1) {
    for (let column = 0; column < state.size + 2; column += 1) {
      const isTopOrBottom = row === 0 || row === state.size + 1;
      const isLeftOrRight = column === 0 || column === state.size + 1;

      if (isTopOrBottom && isLeftOrRight) {
        const corner = document.createElement("div");
        corner.className = "corner-node";
        corner.setAttribute("aria-hidden", "true");
        elements.board.append(corner);
        continue;
      }

      let port = null;
      if (row === 0) port = column - 1;
      else if (column === state.size + 1) port = state.size + row - 1;
      else if (row === state.size + 1) port = state.size * 2 + (state.size - column);
      else if (column === 0) port = state.size * 3 + (state.size - row);

      if (port !== null) {
        elements.board.append(makePortButton(port));
        continue;
      }

      const x = column - 1;
      const y = row - 1;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "array-cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.dataset.gridRow = String(row);
      cell.dataset.gridColumn = String(column);
      elements.board.append(cell);
    }
  }

  const boardButtons = [...elements.board.querySelectorAll("button")];
  boardButtons.forEach((button, index) => {
    button.tabIndex = index === 0 ? 0 : -1;
  });

  render();
  requestAnimationFrame(() => {
    elements.boardScroll.scrollLeft = Math.max(0, (elements.boardScroll.scrollWidth - elements.boardScroll.clientWidth) / 2);
  });
}

function markText(mark) {
  if (!mark) return "";
  if (mark.kind === RESPONSE.HIT) return "H";
  if (mark.kind === RESPONSE.REFLECT) return "R";
  return String(mark.label);
}

function pairHue(label) {
  return 166 + ((label - 1) * 39) % 122;
}

function renderBoard() {
  const guessSet = new Set(state.guesses);
  const hiddenSet = new Set(state.hidden);

  for (const cell of elements.board.querySelectorAll(".array-cell")) {
    const key = cellKey(Number(cell.dataset.x), Number(cell.dataset.y));
    const guessed = guessSet.has(key);
    const actual = hiddenSet.has(key);
    const isWon = state.phase === "won";
    cell.classList.toggle("is-guess", guessed);
    cell.classList.toggle("is-actual", isWon && actual);
    cell.classList.toggle("is-equivalent-only", isWon && guessed && !actual);
    cell.disabled = isWon;

    let label = "内部节点，第 " + String(Number(cell.dataset.x) + 1) + " 列，第 " + String(Number(cell.dataset.y) + 1) + " 行";
    if (guessed) label += "，已标记为能量体";
    else label += "，未标记";
    if (isWon && actual) label += "；最终揭晓：此处存在隐藏能量体";
    if (isWon && guessed && !actual) label += "；此标记坐标不同，但属于已通过的响应等价解";
    cell.setAttribute("aria-label", label);
    cell.setAttribute("aria-pressed", String(guessed));
  }

  for (const port of elements.board.querySelectorAll(".port")) {
    const index = Number(port.dataset.port);
    const mark = state.marks[index];
    port.classList.toggle("has-result", Boolean(mark));
    port.classList.toggle("result-hit", mark?.kind === RESPONSE.HIT);
    port.classList.toggle("result-reflect", mark?.kind === RESPONSE.REFLECT);
    port.classList.toggle("result-exit", mark?.kind === RESPONSE.EXIT);
    port.style.setProperty("--pair-hue", mark?.kind === RESPONSE.EXIT ? String(pairHue(mark.label)) : "176");
    port.querySelector("span").textContent = markText(mark);
    port.setAttribute("aria-label", portAriaLabel(index, mark));
  }

  if (!elements.board.querySelector('button[tabindex="0"]:not(:disabled)')) {
    for (const button of elements.board.querySelectorAll("button")) button.tabIndex = -1;
    const firstEnabled = elements.board.querySelector("button:not(:disabled)");
    if (firstEnabled) firstEnabled.tabIndex = 0;
  }
}

function responseDescription(entry, response, label = null) {
  if (response.kind === RESPONSE.HIT) return portLabel(entry) + " · 信号被吞没";
  if (response.kind === RESPONSE.REFLECT) return portLabel(entry) + " · 回到原浮标";
  return portLabel(entry) + " ↔ " + portLabel(response.exit) + " · 配对 " + String(label);
}

function renderResponseLog() {
  elements.responseList.replaceChildren();
  const recent = state.log.slice(0, 4);
  elements.responseCount.textContent = state.shots ? String(state.shots) + " 次发射" : "尚未发射";

  if (!recent.length) {
    const empty = document.createElement("li");
    empty.className = "empty-log";
    empty.textContent = "等待第一束信号穿过海沟……";
    elements.responseList.append(empty);
    return;
  }

  for (const item of recent) {
    const entry = Number(item.port);
    const row = document.createElement("li");
    row.className = "log-" + item.kind;

    const location = document.createElement("span");
    location.className = "log-port";
    location.textContent = portLabel(entry);

    const result = document.createElement("b");
    if (item.kind === RESPONSE.HIT) result.textContent = "H";
    else if (item.kind === RESPONSE.REFLECT) result.textContent = "R";
    else result.textContent = String(item.label);

    const copy = document.createElement("span");
    if (item.kind === RESPONSE.HIT) copy.textContent = "正撞吞没";
    else if (item.kind === RESPONSE.REFLECT) copy.textContent = "原路回声";
    else copy.textContent = "穿出 " + portLabel(item.exit);

    row.append(location, result, copy);
    elements.responseList.append(row);
  }
}

function renderTelemetry() {
  const guessed = state.guesses.length;
  const totalPorts = state.size * 4;
  const known = state.marks.filter(Boolean).length;
  const remaining = state.target - guessed;
  const config = DIFFICULTIES[state.difficulty];

  elements.difficultySelect.value = state.difficulty;
  elements.guessMetric.textContent = String(guessed) + " / " + String(state.target);
  elements.shotMetric.textContent = String(state.shots);
  elements.moveMetric.textContent = String(state.moves);
  elements.checkMetric.textContent = String(state.checks);
  elements.ringCount.textContent = String(guessed) + "/" + String(state.target);
  elements.modelRing.style.setProperty("--model-progress", String(Math.min(guessed / state.target, 1) * 360) + "deg");
  elements.progressLabel.textContent = String(known) + " / " + String(totalPorts) + " 浮标已解析";
  elements.progressFill.style.width = String((known / totalPorts) * 100) + "%";
  elements.sessionId.textContent = "FIELD / " + config.code + " / " + state.session;
  elements.missionCopy.textContent =
    "在内部节点标记 " +
    String(state.target) +
    " 个深渊能量体。浮标可按任意顺序探测，编号相同的一对互为入口与出口。";

  if (state.phase === "won") {
    elements.checkHint.textContent = "完整响应一致。青色为隐藏能量体；金色表示等价解中的不同坐标。";
    elements.checkButton.disabled = true;
    elements.phaseLabel.textContent = "声场已确认";
    elements.arrayHint.textContent = "最终揭晓已开启 · 可继续点按浮标回放路径";
  } else if (remaining > 0) {
    elements.checkHint.textContent = "还需标记 " + String(remaining) + " 个能量体才可校验。";
    elements.checkButton.disabled = true;
    elements.phaseLabel.textContent = "监听中";
    elements.arrayHint.textContent = "点按外围浮标发射 · 点按内部节点标记能量体";
  } else if (remaining < 0) {
    elements.checkHint.textContent = "已超出目标 " + String(Math.abs(remaining)) + " 个；移除多余标记后再校验。";
    elements.checkButton.disabled = true;
    elements.phaseLabel.textContent = "模型超载";
  } else {
    elements.checkHint.textContent = "标记数量就绪。将对比所有 " + String(totalPorts) + " 个入口的完整响应。";
    elements.checkButton.disabled = false;
    elements.phaseLabel.textContent = "可校验";
  }

  elements.undoButton.disabled = history.length === 0;
  renderResponseLog();
}

function renderMute() {
  elements.muteButton.setAttribute("aria-pressed", String(muted));
  elements.muteButton.querySelector(".button-icon").textContent = muted ? "×" : "◖";
  elements.muteButton.querySelector(".button-label").textContent = muted ? "声音关闭" : "声音开启";
  elements.muteButton.setAttribute("aria-label", muted ? "开启声音" : "关闭声音");
}

function render() {
  renderBoard();
  renderTelemetry();
  renderMute();
}

function showToast(message, type = "info") {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", type === "error");
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), reducedMotion.matches ? 1600 : 2800);
}

function ensureAudio() {
  if (muted) return null;
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    audioContext = new Context();
    audioMaster = audioContext.createGain();
    audioMaster.gain.value = 1;
    audioMaster.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, duration, options = {}) {
  const context = ensureAudio();
  if (!context || muted) return;
  const start = context.currentTime + (options.delay ?? 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  if (options.to) oscillator.frequency.exponentialRampToValueAtTime(options.to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.045, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioMaster);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSound(name) {
  if (muted) return;
  if (name === "ping") {
    tone(720, 0.42, { to: 190, volume: 0.055 });
    tone(1040, 0.13, { delay: 0.03, to: 650, volume: 0.018 });
  } else if (name === "select") {
    tone(330, 0.08, { to: 410, volume: 0.026 });
  } else if (name === "remove") {
    tone(310, 0.09, { to: 180, volume: 0.023 });
  } else if (name === "hit") {
    tone(105, 0.45, { to: 54, type: "sawtooth", volume: 0.035 });
    tone(180, 0.16, { to: 80, volume: 0.028 });
  } else if (name === "reflect") {
    tone(390, 0.14, { to: 620, volume: 0.034 });
    tone(620, 0.26, { delay: 0.14, to: 230, volume: 0.034 });
  } else if (name === "exit") {
    tone(520, 0.14, { to: 810, volume: 0.035 });
    tone(810, 0.19, { delay: 0.12, to: 560, volume: 0.029 });
  } else if (name === "undo") {
    tone(420, 0.15, { to: 260, volume: 0.025 });
  } else if (name === "failure") {
    tone(190, 0.38, { to: 80, type: "square", volume: 0.023 });
    tone(145, 0.42, { delay: 0.08, to: 65, volume: 0.03 });
  } else if (name === "victory") {
    [261.63, 329.63, 392, 523.25].forEach((frequency, index) => {
      tone(frequency, 0.62, { delay: index * 0.12, to: frequency * 1.012, volume: 0.03 });
    });
  }
}

function canvasPoint(point, cellSize) {
  return {
    x: (point.x + 1.5) * cellSize,
    y: (point.y + 1.5) * cellSize,
  };
}

function prepareCanvas() {
  const rect = elements.boardStage.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = elements.signalCanvas;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return {
    context,
    width: rect.width,
    height: rect.height,
    cellSize: rect.width / (state.size + 2),
  };
}

function drawPartialPath(context, points, distances, targetDistance, color) {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  let cursor = points[0];

  for (let index = 1; index < points.length; index += 1) {
    const segmentStart = distances[index - 1];
    const segmentEnd = distances[index];
    const segmentLength = segmentEnd - segmentStart;
    if (targetDistance >= segmentEnd) {
      context.lineTo(points[index].x, points[index].y);
      cursor = points[index];
      continue;
    }
    if (targetDistance > segmentStart && segmentLength > 0) {
      const amount = (targetDistance - segmentStart) / segmentLength;
      cursor = {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * amount,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * amount,
      };
      context.lineTo(cursor.x, cursor.y);
    }
    break;
  }

  context.strokeStyle = color;
  context.lineWidth = 2.2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowBlur = 14;
  context.shadowColor = color;
  context.stroke();
  return cursor;
}

function pulsePorts(entry, response) {
  const targets = [entry];
  if (response.kind === RESPONSE.EXIT) targets.push(response.exit);
  for (const port of targets) {
    const node = elements.board.querySelector('[data-port="' + String(port) + '"]');
    if (!node) continue;
    node.classList.remove("just-activated");
    void node.offsetWidth;
    node.classList.add("just-activated");
    window.setTimeout(() => node.classList.remove("just-activated"), 820);
  }
}

function animateResponse(entry, response) {
  cancelAnimationFrame(animationFrame);
  clearTimeout(clearCanvasTimer);
  clearTimeout(responseSoundTimer);
  const { context, width, height, cellSize } = prepareCanvas();
  const points = response.path.map((point) => canvasPoint(point, cellSize));
  const distances = [0];

  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    distances.push(distances[index - 1] + Math.hypot(dx, dy));
  }

  const total = distances.at(-1) || 1;
  const duration = reducedMotion.matches ? 60 : Math.min(1550, 430 + total * 0.72);
  const start = performance.now();
  const finalColor =
    response.kind === RESPONSE.HIT ? "#ff806f" : response.kind === RESPONSE.REFLECT ? "#ffca7a" : "#6afbf1";

  playSound("ping");

  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 2);
    context.clearRect(0, 0, width, height);

    context.save();
    context.globalAlpha = 0.14;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.strokeStyle = finalColor;
    context.lineWidth = 1;
    context.shadowBlur = 5;
    context.shadowColor = finalColor;
    context.stroke();
    context.restore();

    const cursor = drawPartialPath(context, points, distances, total * eased, finalColor);
    context.save();
    context.beginPath();
    context.arc(cursor.x, cursor.y, reducedMotion.matches ? 5 : 4 + Math.sin(now / 75) * 1.3, 0, Math.PI * 2);
    context.fillStyle = "#eaffff";
    context.shadowBlur = 18;
    context.shadowColor = finalColor;
    context.fill();
    context.restore();

    if (progress < 1) {
      animationFrame = requestAnimationFrame(frame);
    } else {
      pulsePorts(entry, response);
      responseSoundTimer = window.setTimeout(
        () => playSound(response.kind === RESPONSE.HIT ? "hit" : response.kind === RESPONSE.REFLECT ? "reflect" : "exit"),
        reducedMotion.matches ? 0 : 40,
      );
      clearCanvasTimer = window.setTimeout(() => context.clearRect(0, 0, width, height), reducedMotion.matches ? 260 : 900);
    }
  }

  animationFrame = requestAnimationFrame(frame);
}

function stopSignalAnimation() {
  cancelAnimationFrame(animationFrame);
  clearTimeout(clearCanvasTimer);
  clearTimeout(responseSoundTimer);
  elements.signalCanvas.width = elements.signalCanvas.width;
}

function recordResponse(port, response) {
  let label = null;
  if (response.kind === RESPONSE.EXIT) {
    const partnerMark = state.marks[response.exit];
    label = partnerMark?.kind === RESPONSE.EXIT ? partnerMark.label : state.nextPair++;
    state.marks[port] = { kind: RESPONSE.EXIT, label };
    state.marks[response.exit] = { kind: RESPONSE.EXIT, label };
  } else {
    state.marks[port] = { kind: response.kind };
  }

  state.log.unshift({
    port,
    kind: response.kind,
    exit: response.exit ?? null,
    label,
  });
  state.log = state.log.slice(0, 12);
  return label;
}

function firePort(port) {
  ensureAudio();
  const response = traceRay(state.size, state.hidden, port);
  const existing = state.marks[port];

  if (state.phase === "won" || existing) {
    animateResponse(port, response);
    if (existing) showToast(responseDescription(port, response, existing.label));
    return;
  }

  pushHistory();
  const label = recordResponse(port, response);

  state.shots += 1;
  state.moves += 1;
  render();
  saveGame();
  animateResponse(port, response);
  showToast(responseDescription(port, response, label));
}

function toggleGuess(x, y) {
  if (state.phase === "won") return;
  ensureAudio();
  const key = cellKey(x, y);
  const index = state.guesses.indexOf(key);
  pushHistory();

  if (index >= 0) {
    state.guesses.splice(index, 1);
    playSound("remove");
  } else {
    state.guesses.push(key);
    playSound("select");
  }

  state.moves += 1;
  render();
  saveGame();

  if (state.guesses.length === state.target) {
    showToast("目标数量已就绪：现在可以校验完整声场。");
  } else if (state.guesses.length > state.target) {
    showToast("标记超过目标数量；校验暂时锁定。", "error");
  }
}

function sameCoordinates() {
  const hidden = new Set(state.hidden);
  return state.guesses.length === state.hidden.length && state.guesses.every((key) => hidden.has(key));
}

function revealAllResponses() {
  for (let port = 0; port < state.size * 4; port += 1) {
    if (state.marks[port]) continue;
    const response = traceRay(state.size, state.hidden, port);
    if (response.kind === RESPONSE.EXIT) {
      const partnerMark = state.marks[response.exit];
      const label = partnerMark?.kind === RESPONSE.EXIT ? partnerMark.label : state.nextPair++;
      state.marks[port] = { kind: RESPONSE.EXIT, label };
      state.marks[response.exit] = { kind: RESPONSE.EXIT, label };
    } else {
      state.marks[port] = { kind: response.kind };
    }
  }
}

function makeVictoryBubbles() {
  elements.victoryBubbles.replaceChildren();
  if (reducedMotion.matches) return;
  for (let index = 0; index < 16; index += 1) {
    const bubble = document.createElement("i");
    bubble.style.setProperty("--bubble-x", String(5 + secureRandom() * 90) + "%");
    bubble.style.setProperty("--bubble-size", String(5 + secureRandom() * 15) + "px");
    bubble.style.setProperty("--bubble-duration", String(3.2 + secureRandom() * 3.2) + "s");
    bubble.style.setProperty("--bubble-delay", String(-secureRandom() * 5) + "s");
    bubble.style.setProperty("--bubble-drift", String(-25 + secureRandom() * 50) + "px");
    elements.victoryBubbles.append(bubble);
  }
}

function openVictory(exactCoordinates) {
  const blockingDialog = [...document.querySelectorAll("dialog[open]")]
    .find((dialog) => dialog !== elements.victoryDialog);
  if (blockingDialog) {
    blockingDialog.addEventListener("close", () => openVictory(exactCoordinates), { once: true });
    return;
  }
  elements.victoryCopy.textContent = exactCoordinates
    ? "你的模型与整片海沟的完整响应一致，隐藏能量体坐标也完全吻合。"
    : "你的坐标与隐藏布局并不完全相同，但所有浮标响应一致——这是 Black Box 允许的非唯一等价解。";
  elements.victoryStats.replaceChildren();

  for (const [value, label] of [
    [state.moves, "总步数"],
    [state.shots, "发射"],
    [state.checks, "校验"],
  ]) {
    const item = document.createElement("div");
    const number = document.createElement("b");
    const caption = document.createElement("span");
    number.textContent = String(value);
    caption.textContent = label;
    item.append(number, caption);
    elements.victoryStats.append(item);
  }
  makeVictoryBubbles();
  openDialog(elements.victoryDialog);
}

function completionLevelId() {
  const layout = [...state.hidden]
    .sort()
    .map((key) => key.replace(",", "-"))
    .join("_");
  return `${state.difficulty}:${state.size}:${layout}`;
}

function reportRealmCompletion() {
  const payload = {
    levelId: completionLevelId(),
    tier: COMPLETION_TIERS[state.difficulty] ?? 1,
    moves: state.moves,
  };
  if (typeof window.RealmArcade?.complete === "function") window.RealmArcade.complete(payload);
  else (window.__realmCompletionQueue ??= []).push(payload);
}

function checkModel() {
  if (state.phase !== "playing" || state.guesses.length !== state.target) return;
  ensureAudio();
  pushHistory();
  state.checks += 1;
  state.moves += 1;
  const equivalent = areResponseEquivalent(state.size, state.hidden, state.guesses);

  if (equivalent) {
    const exact = sameCoordinates();
    state.phase = "won";
    revealAllResponses();
    if (!completionReported) {
      completionReported = true;
      reportRealmCompletion();
    }
    render();
    saveGame();
    playSound("victory");
    showToast(exact ? "完整声场吻合，坐标确认。" : "完整声场吻合：已接受响应等价布局。");
    clearTimeout(victoryTimer);
    victoryTimer = window.setTimeout(() => openVictory(exact), reducedMotion.matches ? 0 : 420);
    return;
  }

  const distinction = findDistinguishingPort(
    state.size,
    state.hidden,
    state.guesses,
    state.marks.flatMap((mark, port) => (mark ? [port] : [])),
  );
  const response = distinction?.expected;
  let responseLabel = distinction ? state.marks[distinction.port]?.label ?? null : null;
  if (distinction && !distinction.alreadyRevealed) {
    responseLabel = recordResponse(distinction.port, response);
    state.shots += 1;
  }

  render();
  saveGame();
  playSound("failure");
  clearTimeout(failureTimer);
  elements.console.classList.remove("is-failure");
  void elements.console.offsetWidth;
  elements.console.classList.add("is-failure");
  elements.phaseLabel.textContent = "响应矛盾";
  failureTimer = window.setTimeout(() => {
    elements.console.classList.remove("is-failure");
    renderTelemetry();
  }, reducedMotion.matches ? 100 : 1500);
  if (distinction) {
    const portNode = elements.board.querySelector('[data-port="' + String(distinction.port) + '"]');
    portNode?.classList.add("is-contradiction");
    window.setTimeout(() => portNode?.classList.remove("is-contradiction"), reducedMotion.matches ? 500 : 1800);
    animateResponse(distinction.port, response);
    const evidence = responseDescription(distinction.port, response, responseLabel);
    showToast(
      distinction.alreadyRevealed
        ? "校验失败：已圈出一条与模型矛盾的已知光路 · " + evidence
        : "校验失败：补发一束最小区分光路 · " + evidence,
      "error",
    );
  } else {
    showToast("校验失败：完整响应不一致，请继续调整模型。", "error");
  }
}

function newGame(difficulty = elements.difficultySelect.value) {
  ensureAudio();
  stopSignalAnimation();
  clearTimeout(victoryTimer);
  clearTimeout(failureTimer);
  elements.console.classList.remove("is-failure");
  state = freshState(difficulty);
  history = [];
  completionReported = false;
  buildBoard();
  saveGame();
  playSound("select");
  showToast(DIFFICULTIES[difficulty].name + "区段已生成新的隐藏声场。");
}

function restartGame() {
  ensureAudio();
  stopSignalAnimation();
  clearTimeout(victoryTimer);
  clearTimeout(failureTimer);
  elements.console.classList.remove("is-failure");
  const hidden = state.hidden.map((key) => parseCellKey(key));
  const session = state.session;
  state = freshState(state.difficulty, hidden, session);
  history = [];
  completionReported = false;
  buildBoard();
  saveGame();
  playSound("undo");
  showToast("已清空本轮探测与标记，隐藏声场保持不变。");
}

function undo() {
  if (!history.length) return;
  ensureAudio();
  stopSignalAnimation();
  clearTimeout(victoryTimer);
  clearTimeout(failureTimer);
  elements.console.classList.remove("is-failure");
  const previousSize = state.size;
  state = history.pop();
  if (state.size !== previousSize) buildBoard();
  else render();
  saveGame();
  playSound("undo");
  if (elements.victoryDialog.open) elements.victoryDialog.close();
  showToast("已撤销上一步。");
}

function toggleMute() {
  muted = !muted;
  if (muted && audioContext && audioMaster) {
    audioMaster.gain.cancelScheduledValues(audioContext.currentTime);
    audioMaster.gain.setTargetAtTime(0, audioContext.currentTime, 0.008);
  } else if (!muted) {
    ensureAudio();
    if (audioContext && audioMaster) {
      audioMaster.gain.cancelScheduledValues(audioContext.currentTime);
      audioMaster.gain.setTargetAtTime(1, audioContext.currentTime, 0.008);
    }
    playSound("select");
  }
  renderMute();
  saveGame();
  showToast(muted ? "程序化声呐音效已关闭。" : "程序化声呐音效已开启。");
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

function makeMarineSnow() {
  elements.marineSnow.replaceChildren();
  if (reducedMotion.matches) return;
  for (let index = 0; index < 28; index += 1) {
    const particle = document.createElement("i");
    particle.className = "snow-particle";
    particle.style.left = String(secureRandom() * 100) + "%";
    particle.style.setProperty("--snow-size", String(1 + secureRandom() * 2.4) + "px");
    particle.style.setProperty("--snow-opacity", String(0.12 + secureRandom() * 0.36));
    particle.style.setProperty("--snow-duration", String(13 + secureRandom() * 24) + "s");
    particle.style.setProperty("--snow-delay", String(-secureRandom() * 28) + "s");
    particle.style.setProperty("--snow-drift", String(-30 + secureRandom() * 60) + "px");
    elements.marineSnow.append(particle);
  }
}

function onBoardClick(event) {
  const port = event.target.closest(".port");
  if (port) {
    firePort(Number(port.dataset.port));
    return;
  }

  const cell = event.target.closest(".array-cell");
  if (cell) toggleGuess(Number(cell.dataset.x), Number(cell.dataset.y));
}

function onBoardKeydown(event) {
  if (["Enter", " ", "Spacebar"].includes(event.key)) {
    const action = event.target.closest("button:not(:disabled)");
    if (action) {
      event.preventDefault();
      action.click();
    }
    return;
  }
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  const current = event.target.closest("[data-grid-row][data-grid-column]");
  if (!current) return;
  event.preventDefault();

  const delta = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }[event.key];
  let row = Number(current.dataset.gridRow) + delta[0];
  let column = Number(current.dataset.gridColumn) + delta[1];

  while (row >= 0 && row <= state.size + 1 && column >= 0 && column <= state.size + 1) {
    const target = elements.board.querySelector(
      '[data-grid-row="' + String(row) + '"][data-grid-column="' + String(column) + '"]:not(:disabled)',
    );
    if (target) {
      setRovingBoardTarget(target);
      target.focus();
      return;
    }
    row += delta[0];
    column += delta[1];
  }
}

function setRovingBoardTarget(target) {
  if (!(target instanceof HTMLButtonElement) || !elements.board.contains(target)) return;
  for (const button of elements.board.querySelectorAll("button")) button.tabIndex = -1;
  target.tabIndex = 0;
}

function onBoardFocusIn(event) {
  setRovingBoardTarget(event.target.closest("button"));
}

function onGlobalKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target.tagName;
  const isControl = ["INPUT", "SELECT", "TEXTAREA"].includes(tag);
  const anyDialogOpen = elements.rulesDialog.open || elements.victoryDialog.open;
  if (isControl || anyDialogOpen) return;
  const key = event.key.toLowerCase();

  if (key === "z") {
    event.preventDefault();
    undo();
  } else if (key === "m") {
    event.preventDefault();
    toggleMute();
  } else if (event.key === "?") {
    event.preventDefault();
    openDialog(elements.rulesDialog);
  } else if (key === "n") {
    event.preventDefault();
    newGame();
  } else if (key === "r") {
    event.preventDefault();
    restartGame();
  }
}

elements.board.addEventListener("click", onBoardClick);
elements.board.addEventListener("focusin", onBoardFocusIn);
elements.board.addEventListener("keydown", onBoardKeydown);
elements.checkButton.addEventListener("click", checkModel);
elements.difficultySelect.addEventListener("change", () => newGame(elements.difficultySelect.value));
elements.mappingButton.addEventListener("click", () => openDialog(elements.rulesDialog));
elements.muteButton.addEventListener("click", toggleMute);
elements.newGameButton.addEventListener("click", () => newGame());
elements.restartButton.addEventListener("click", restartGame);
elements.rulesButton.addEventListener("click", () => openDialog(elements.rulesDialog));
elements.undoButton.addEventListener("click", undo);
elements.victoryInspectButton.addEventListener("click", () => closeDialog(elements.victoryDialog));
elements.victoryNewButton.addEventListener("click", () => {
  closeDialog(elements.victoryDialog);
  newGame();
});
elements.rulesDialog.addEventListener("click", (event) => {
  if (event.target === elements.rulesDialog) closeDialog(elements.rulesDialog);
});
elements.victoryDialog.addEventListener("click", (event) => {
  if (event.target === elements.victoryDialog) closeDialog(elements.victoryDialog);
});
document.addEventListener("keydown", onGlobalKeydown);
window.addEventListener("resize", () => {
  cancelAnimationFrame(animationFrame);
  clearTimeout(clearCanvasTimer);
  const { context, width, height } = prepareCanvas();
  context.clearRect(0, 0, width, height);
});
reducedMotion.addEventListener?.("change", makeMarineSnow);

if (!loadGame()) {
  state = freshState("trench");
  history = [];
} else if (state.phase === "won") {
  revealAllResponses();
}

makeMarineSnow();
buildBoard();
saveGame();
