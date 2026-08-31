import {
  DIFFICULTIES,
  DIRECTION_VECTORS,
  LEVELS,
  STATUS,
  TILES,
  attemptMove,
  createGame,
  getLegalMoves,
  remainingEnergyPositions,
  restoreGame,
  serializeGame,
  tileAt,
  undoMove,
} from "./logic.mjs";

const STORAGE_KEY = "five-realms.star-drift.save.v1";
const PREFS_KEY = "five-realms.star-drift.preferences.v1";
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const TAU = Math.PI * 2;
const RING_LENGTH = 307.88;

const $ = (selector) => document.querySelector(selector);
const elements = {
  canvas: $("#game-canvas"),
  canvasWrap: $("#game-board"),
  boardDescription: $("#board-description"),
  boardShell: $("#board-shell"),
  directionPad: $("#direction-pad"),
  difficultyButtons: $("#difficulty-buttons"),
  levelCode: $("#level-code"),
  levelName: $("#level-name"),
  levelBrief: $("#level-brief"),
  sectorSize: $("#sector-size"),
  energyCount: $("#energy-count"),
  progressRing: $("#progress-ring"),
  moveCount: $("#move-count"),
  parCount: $("#par-count"),
  riskReading: $("#risk-reading"),
  saveState: $("#save-state"),
  positionReadout: $("#position-readout"),
  statusReadout: $("#status-readout"),
  mineWarning: $("#mine-warning"),
  liveRegion: $("#live-region"),
  newGame: $("#new-game"),
  restartGame: $("#restart-game"),
  undoMove: $("#undo-move"),
  muteAudio: $("#mute-audio"),
  muteIcon: $("#mute-icon"),
  muteLabel: $("#mute-label"),
  openRules: $("#open-rules"),
  rulesDialog: $("#rules-dialog"),
  outcomePanel: $("#outcome-panel"),
  outcomeKicker: $("#outcome-kicker"),
  outcomeTitle: $("#outcome-title"),
  outcomeCopy: $("#outcome-copy"),
  outcomePrimary: $("#outcome-primary"),
  outcomeSecondary: $("#outcome-secondary"),
};

const context = elements.canvas.getContext("2d", { alpha: false });
const levelGroups = Object.fromEntries(
  Object.values(DIFFICULTIES).map((difficulty) => [
    difficulty,
    LEVELS.filter((level) => level.difficulty === difficulty),
  ]),
);
const difficultyCopy = {
  [DIFFICULTIES.EASY]: { label: "近地", code: "LOW" },
  [DIFFICULTIES.MEDIUM]: { label: "深空", code: "DEEP" },
  [DIFFICULTIES.HARD]: { label: "禁区", code: "RED" },
};
const rewardTier = {
  [DIFFICULTIES.EASY]: 1,
  [DIFFICULTIES.MEDIUM]: 2,
  [DIFFICULTIES.HARD]: 3,
};
const directionCopy = {
  N: "向上",
  NE: "右上",
  E: "向右",
  SE: "右下",
  S: "向下",
  SW: "左下",
  W: "向左",
  NW: "左上",
};

let preferences = loadPreferences();
let game = loadSavedGame() ?? createGame(LEVELS[0]);
let selectedDifficulty = game.level.difficulty;
let canvasMetrics = null;
let pointerStart = null;
let activeFlight = null;
let rewindFlight = null;
let trails = [];
let particles = [];
let impactFlash = 0;
let frameHandle = 0;
let lastFrameTime = 0;
let outcomeTimer = 0;
let statusTimer = 0;
let warningLatched = false;
let completionReported = game.status === STATUS.WON;

function reportCompletion(payload) {
  if (window.RealmArcade?.complete) {
    window.RealmArcade.complete(payload);
  } else {
    (window.__realmCompletionQueue ??= []).push(payload);
  }
}

class SignalAudio {
  constructor() {
    this.audioContext = null;
    this.master = null;
  }

  ensure() {
    if (preferences.muted) return null;
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.audioContext = new AudioContext();
      this.master = this.audioContext.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === "suspended") this.audioContext.resume();
    return this.audioContext;
  }

  setMuted(muted) {
    if (!this.audioContext || !this.master) return;
    const now = this.audioContext.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.18, now, 0.012);
  }

  tone(frequency, duration, options = {}) {
    const audioContext = this.ensure();
    if (!audioContext || !this.master) return;
    const start = audioContext.currentTime + (options.delay ?? 0);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.endFrequency),
        start + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.24, start + Math.min(0.025, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise(duration = 0.12, volume = 0.09) {
    const audioContext = this.ensure();
    if (!audioContext || !this.master) return;
    const sampleCount = Math.ceil(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    }
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 940;
    filter.Q.value = 0.7;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  thrust(pathLength = 1) {
    this.tone(84, Math.min(0.34, 0.11 + pathLength * 0.028), {
      type: "sawtooth",
      volume: 0.13,
      endFrequency: 210,
    });
    this.noise(Math.min(0.26, 0.08 + pathLength * 0.02), 0.055);
  }

  collect(index = 0) {
    const root = 520 + Math.min(index, 4) * 55;
    this.tone(root, 0.13, { volume: 0.25, endFrequency: root * 1.42 });
    this.tone(root * 1.5, 0.09, { delay: 0.045, volume: 0.12 });
  }

  warning() {
    this.tone(188, 0.13, { type: "square", volume: 0.17 });
    this.tone(158, 0.13, { type: "square", delay: 0.16, volume: 0.14 });
  }

  blocked() {
    this.tone(92, 0.09, { type: "square", volume: 0.08, endFrequency: 66 });
  }

  undo() {
    this.tone(340, 0.2, { type: "triangle", volume: 0.14, endFrequency: 130 });
  }

  failure() {
    this.noise(0.36, 0.11);
    this.tone(116, 0.5, { type: "sawtooth", volume: 0.2, endFrequency: 35 });
    this.tone(244, 0.22, { type: "square", volume: 0.08, endFrequency: 87 });
  }

  victory() {
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.tone(frequency, 0.3, {
        type: index % 2 ? "sine" : "triangle",
        delay: index * 0.095,
        volume: 0.17,
        endFrequency: frequency * 1.01,
      });
    });
  }

  click() {
    this.tone(420, 0.045, { type: "square", volume: 0.065, endFrequency: 620 });
  }
}

const audio = new SignalAudio();

function loadPreferences() {
  const defaults = { muted: false, completed: [], lastLevelByDifficulty: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return defaults;
    return {
      muted: parsed.muted === true,
      completed: Array.isArray(parsed.completed)
        ? parsed.completed.filter((id) => LEVELS.some((level) => level.id === id))
        : [],
      lastLevelByDifficulty: parsed.lastLevelByDifficulty && typeof parsed.lastLevelByDifficulty === "object"
        ? parsed.lastLevelByDifficulty
        : {},
    };
  } catch {
    return defaults;
  }
}

function savePreferences() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  } catch {
    // The game remains fully playable when storage is blocked.
  }
}

function loadSavedGame() {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    return serialized ? restoreGame(serialized) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, serializeGame(game));
    elements.saveState.textContent = "已同步";
    elements.saveState.classList.remove("is-warning");
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      elements.saveState.textContent = "持续同步";
    }, 900);
  } catch {
    elements.saveState.textContent = "本机受限";
    elements.saveState.classList.add("is-warning");
  }
}

function buildDifficultyButtons() {
  const fragment = document.createDocumentFragment();
  for (const difficulty of Object.values(DIFFICULTIES)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty;
    button.setAttribute("aria-pressed", String(difficulty === selectedDifficulty));
    button.setAttribute("aria-label", `${difficultyCopy[difficulty].label}难度，${levelGroups[difficulty].length}个星区`);
    button.textContent = difficultyCopy[difficulty].label;
    fragment.append(button);
  }
  elements.difficultyButtons.replaceChildren(fragment);
}

function updateDifficultyButtons() {
  elements.difficultyButtons.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === selectedDifficulty));
  });
}

function setStatus(message, announce = false) {
  elements.statusReadout.textContent = message;
  if (announce) {
    elements.liveRegion.textContent = "";
    requestAnimationFrame(() => {
      elements.liveRegion.textContent = message;
    });
  }
}

function isMineNear(position) {
  return game.level.mines.some((mine) => (
    Math.max(Math.abs(mine.x - position.x), Math.abs(mine.y - position.y)) === 1
  ));
}

function updateWarning(position = game.position, playSound = false) {
  const near = game.status === STATUS.LOST || isMineNear(position);
  elements.mineWarning.classList.toggle("is-visible", near);
  elements.riskReading.classList.toggle("is-warning", near && game.status !== STATUS.LOST);
  elements.riskReading.classList.toggle("is-danger", game.status === STATUS.LOST);
  elements.riskReading.textContent = game.status === STATUS.LOST ? "失稳" : near ? "近雷" : "稳定";
  if (near && playSound && !warningLatched) audio.warning();
  warningLatched = near;
}

function formatPositions(points) {
  if (points.length === 0) return "无";
  return points.map((point) => `第${point.x + 1}列第${point.y + 1}行`).join("、");
}

function updateBoardDescription() {
  const energy = remainingEnergyPositions(game);
  const routes = getLegalMoves(game).map((direction) => {
    const preview = attemptMove(game, direction);
    if (preview.status === STATUS.LOST) return `${directionCopy[direction]}会撞上反应堆`;
    const landing = `第${preview.state.position.x + 1}列第${preview.state.position.y + 1}行`;
    const collected = preview.collected.length ? `，沿途可回收${preview.collected.length}枚能源芯` : "";
    return `${directionCopy[direction]}停在${landing}${collected}`;
  });
  elements.boardDescription.textContent = [
    `棋盘${game.level.width}列${game.level.height}行。`,
    `回收艇位于第${game.position.x + 1}列第${game.position.y + 1}行。`,
    `剩余能源芯：${formatPositions(energy)}。`,
    `引力锚：${formatPositions(game.level.stops)}。`,
    `失稳反应堆：${formatPositions(game.level.mines)}。`,
    routes.length ? `当前航线：${routes.join("；")}。` : "当前没有可执行的推进航线。",
  ].join("");
}

function updateInterface({ announce = false } = {}) {
  const levelIndex = LEVELS.indexOf(game.level) + 1;
  const remaining = game.remainingEnergy.length;
  const total = game.totalEnergy;
  const recovered = total - remaining;
  const progress = total === 0 ? 1 : recovered / total;

  selectedDifficulty = game.level.difficulty;
  elements.levelCode.textContent = `S-${String(levelIndex).padStart(2, "0")}`;
  elements.levelName.textContent = game.level.name;
  elements.levelBrief.textContent = game.level.briefing;
  elements.sectorSize.textContent = `${game.level.width} × ${game.level.height} GRID`;
  elements.energyCount.textContent = `${recovered}/${total}`;
  elements.progressRing.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
  elements.moveCount.textContent = String(game.moves).padStart(2, "0");
  elements.parCount.textContent = String(game.level.par).padStart(2, "0");
  elements.positionReadout.textContent = `X ${String(game.position.x + 1).padStart(2, "0")} / Y ${String(game.position.y + 1).padStart(2, "0")}`;
  elements.undoMove.disabled = game.history.length === 0;
  elements.boardShell.dataset.state = game.status;
  elements.muteAudio.setAttribute("aria-pressed", String(preferences.muted));
  elements.muteIcon.textContent = preferences.muted ? "×" : "♪";
  elements.muteLabel.textContent = preferences.muted ? "声音已静音" : "声音开启";
  updateDifficultyButtons();
  updateWarning(game.position, false);
  updateBoardDescription();

  if (!activeFlight && !rewindFlight) {
    if (game.status === STATUS.WON) setStatus("能源链路闭合，任务完成", announce);
    else if (game.status === STATUS.LOST) setStatus("接触失稳反应堆，艇体失联", announce);
    else if (game.lastMove?.stopReason === "stop") setStatus("引力锚完成停泊", announce);
    else setStatus("等待推进指令", announce);
  }
}

function hideOutcome() {
  clearTimeout(outcomeTimer);
  elements.outcomePanel.classList.remove("is-visible", "is-failure");
  elements.outcomePanel.setAttribute("aria-hidden", "true");
  elements.outcomePanel.inert = true;
}

function showOutcome(status = game.status, immediate = false) {
  clearTimeout(outcomeTimer);
  const delay = immediate || REDUCED_MOTION.matches ? 0 : status === STATUS.LOST ? 500 : 260;
  outcomeTimer = window.setTimeout(() => {
    const failure = status === STATUS.LOST;
    elements.outcomePanel.classList.toggle("is-failure", failure);
    elements.outcomeKicker.textContent = failure ? "HULL SIGNAL LOST" : "MISSION COMPLETE";
    elements.outcomeTitle.textContent = failure ? "时间回卷就绪" : "回收链路闭合";
    elements.outcomeCopy.textContent = failure
      ? "失稳反应堆已击穿艇体。可撤销致命一步，从点火之前重算航线。"
      : `全部 ${game.totalEnergy} 枚能源芯已入库，共用 ${game.moves} 次推进。`;
    elements.outcomePrimary.textContent = failure ? "撤销致命一步" : "下一任务";
    elements.outcomeSecondary.textContent = failure ? "重开任务" : "重走航线";
    elements.outcomePanel.setAttribute("aria-hidden", "false");
    elements.outcomePanel.inert = false;
    elements.outcomePanel.classList.add("is-visible");
    requestAnimationFrame(() => elements.outcomePrimary.focus({ preventScroll: true }));
  }, delay);
}

function clearEffects() {
  activeFlight = null;
  rewindFlight = null;
  trails = [];
  particles = [];
  impactFlash = 0;
  warningLatched = false;
  hideOutcome();
}

function activateLevel(level, { announce = true } = {}) {
  clearEffects();
  game = createGame(level);
  completionReported = false;
  selectedDifficulty = level.difficulty;
  preferences.lastLevelByDifficulty[selectedDifficulty] = level.id;
  savePreferences();
  saveGame();
  updateInterface();
  setStatus(`新任务：${level.name}，${level.energy.length}枚能源芯`, announce);
  resizeCanvas();
  elements.canvasWrap.focus({ preventScroll: true });
}

function nextLevelInDifficulty({ randomize = false } = {}) {
  const group = levelGroups[selectedDifficulty];
  const currentIndex = group.findIndex((level) => level.id === game.levelId);
  let nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % group.length;
  if (randomize && group.length > 1) {
    const offset = 1 + Math.floor(Math.random() * (group.length - 1));
    nextIndex = currentIndex < 0 ? Math.floor(Math.random() * group.length) : (currentIndex + offset) % group.length;
  }
  activateLevel(group[nextIndex]);
}

function switchDifficulty(difficulty) {
  if (!levelGroups[difficulty]) return;
  selectedDifficulty = difficulty;
  const rememberedId = preferences.lastLevelByDifficulty[difficulty];
  const remembered = levelGroups[difficulty].find((level) => level.id === rememberedId);
  activateLevel(remembered ?? levelGroups[difficulty][0]);
}

function restartCurrentLevel() {
  audio.ensure();
  audio.click();
  activateLevel(game.level);
}

function undoLastMove() {
  audio.ensure();
  const result = undoMove(game);
  if (!result.undone) {
    audio.blocked();
    setStatus("没有可回卷的推进记录", true);
    return;
  }
  clearEffects();
  game = result.state;
  completionReported = false;
  saveGame();
  updateInterface();
  audio.undo();
  setStatus("时间线已回卷至上次点火之前", true);
  render(performance.now());
  elements.canvasWrap.focus({ preventScroll: true });
}

function toggleMute() {
  preferences.muted = !preferences.muted;
  savePreferences();
  updateInterface();
  if (!preferences.muted) {
    audio.ensure();
    audio.setMuted(false);
    audio.click();
    setStatus("合成通讯声已开启", true);
  } else {
    audio.setMuted(true);
    setStatus("合成通讯声已静音", true);
  }
}

function requestMove(direction) {
  if (activeFlight || rewindFlight) return;
  audio.ensure();
  const before = game;
  const result = attemptMove(game, direction);
  if (!result.moved) {
    audio.blocked();
    const message = result.stopReason === "terminal"
      ? game.status === STATUS.LOST ? "艇体已失联，请撤销或重开" : "任务已完成，可开始下一星区"
      : `${directionCopy[direction]}方向被残骸封锁`;
    setStatus(message, true);
    elements.canvasWrap.classList.remove("is-blocked");
    void elements.canvasWrap.offsetWidth;
    elements.canvasWrap.classList.add("is-blocked");
    return;
  }

  hideOutcome();
  game = result.state;
  saveGame();
  setStatus(`${directionCopy[direction]}推进 · 惯性航行中`, false);
  const duration = REDUCED_MOTION.matches ? 1 : Math.min(740, 150 + result.path.length * 72);
  activeFlight = {
    before,
    result,
    direction,
    points: [before.position, ...result.path].map((point) => ({ ...point })),
    collectedIndices: new Set(),
    start: performance.now(),
    duration,
  };
  trails.push({
    points: activeFlight.points.map((point) => ({ ...point })),
    born: performance.now(),
    fatal: result.status === STATUS.LOST,
  });
  audio.thrust(result.path.length);
  warningLatched = false;
  const nearOnPath = result.path.some((point) => isMineNear(point));
  elements.mineWarning.classList.toggle("is-visible", nearOnPath);
  if (nearOnPath) {
    elements.liveRegion.textContent = "";
    requestAnimationFrame(() => {
      elements.liveRegion.textContent = "警告：当前航迹接近失稳反应堆。";
    });
  }
  if (nearOnPath && result.status !== STATUS.LOST) audio.warning();
  if (REDUCED_MOTION.matches) finishFlight();
}

function finishFlight() {
  if (!activeFlight) return;
  const finished = activeFlight;
  activeFlight = null;
  for (let index = 0; index < finished.result.collected.length; index += 1) {
    const point = finished.result.collected[index];
    if (!finished.collectedIndices.has(index)) collectAt(point, index);
  }

  updateInterface({ announce: true });
  if (game.status === STATUS.LOST) {
    impactFlash = performance.now();
    audio.failure();
    if (!REDUCED_MOTION.matches) {
      rewindFlight = {
        points: [...finished.points].reverse(),
        start: performance.now() + 90,
        duration: 620,
      };
    }
    showOutcome(STATUS.LOST);
    setStatus("反应堆接触 · 启动时间回卷", true);
  } else if (game.status === STATUS.WON) {
    preferences.completed = [...new Set([...preferences.completed, game.levelId])];
    savePreferences();
    if (!completionReported) {
      completionReported = true;
      reportCompletion({
        levelId: `mission:${game.level.difficulty}:${game.levelId}`,
        tier: rewardTier[game.level.difficulty],
        moves: game.moves,
        par: game.level.par,
      });
    }
    audio.victory();
    launchVictoryParticles();
    showOutcome(STATUS.WON);
    setStatus("能源链路闭合 · 任务完成", true);
  } else {
    const recovered = finished.result.collected.length;
    const stopMessage = finished.result.stopReason === "stop" ? "引力锚制动完成" : "残骸墙前完成制动";
    const recoveryMessage = recovered ? `${stopMessage} · 回收 ${recovered} 枚能源芯` : stopMessage;
    setStatus(isMineNear(game.position) ? `${recoveryMessage} · 警告：反应堆近接` : recoveryMessage, true);
  }
}

function collectAt(point, soundIndex) {
  const center = cellCenter(point);
  if (!center) return;
  spawnBurst(center.x, center.y, "#71e7ff", REDUCED_MOTION.matches ? 4 : 17, 1.65);
  audio.collect(soundIndex);
}

function launchVictoryParticles() {
  const center = cellCenter(game.position);
  if (!center) return;
  const colors = ["#71e7ff", "#a877ff", "#f2fbff", "#ffb15b"];
  const count = REDUCED_MOTION.matches ? 8 : 68;
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * TAU;
    const speed = 0.5 + Math.random() * 3.4;
    particles.push({
      x: center.x,
      y: center.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      born: performance.now(),
      life: 500 + Math.random() * 900,
      size: 1 + Math.random() * 2.8,
      color: colors[index % colors.length],
    });
  }
}

function spawnBurst(x, y, color, count, strength = 1) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * TAU;
    const speed = (0.35 + Math.random() * 2.3) * strength;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      born: performance.now(),
      life: 280 + Math.random() * 620,
      size: 0.8 + Math.random() * 2.4,
      color,
    });
  }
}

function resizeCanvas() {
  const rect = elements.canvasWrap.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (elements.canvas.width !== Math.round(width * dpr) || elements.canvas.height !== Math.round(height * dpr)) {
    elements.canvas.width = Math.round(width * dpr);
    elements.canvas.height = Math.round(height * dpr);
  }
  const pad = Math.max(20, Math.min(width, height) * 0.055);
  const cell = Math.min(
    (width - pad * 2) / game.level.width,
    (height - pad * 2) / game.level.height,
  );
  const gridWidth = cell * game.level.width;
  const gridHeight = cell * game.level.height;
  canvasMetrics = {
    width,
    height,
    dpr,
    cell,
    gridWidth,
    gridHeight,
    offsetX: (width - gridWidth) / 2,
    offsetY: (height - gridHeight) / 2,
  };
  render(performance.now());
}

function cellCenter(point) {
  if (!canvasMetrics) return null;
  return {
    x: canvasMetrics.offsetX + (point.x + 0.5) * canvasMetrics.cell,
    y: canvasMetrics.offsetY + (point.y + 0.5) * canvasMetrics.cell,
  };
}

function mixPosition(from, to, t) {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

function positionAlong(points, progress) {
  if (points.length <= 1) return { ...points[0] };
  const segmentCount = points.length - 1;
  const scaled = Math.min(segmentCount, Math.max(0, progress * segmentCount));
  const index = Math.min(segmentCount - 1, Math.floor(scaled));
  return mixPosition(points[index], points[index + 1], scaled - index);
}

function drawGrid(now) {
  const { width, height, cell, offsetX, offsetY, gridWidth, gridHeight } = canvasMetrics;
  const background = context.createRadialGradient(width * 0.48, height * 0.42, 0, width * 0.5, height * 0.5, width * 0.75);
  background.addColorStop(0, "#081426");
  background.addColorStop(0.54, "#050c18");
  background.addColorStop(1, "#02050b");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = "#6fb1e4";
  context.lineWidth = 0.5;
  for (let x = 0; x <= game.level.width; x += 1) {
    const screenX = offsetX + x * cell;
    context.beginPath();
    context.moveTo(screenX, offsetY);
    context.lineTo(screenX, offsetY + gridHeight);
    context.stroke();
  }
  for (let y = 0; y <= game.level.height; y += 1) {
    const screenY = offsetY + y * cell;
    context.beginPath();
    context.moveTo(offsetX, screenY);
    context.lineTo(offsetX + gridWidth, screenY);
    context.stroke();
  }
  context.restore();

  context.strokeStyle = "rgba(115, 215, 255, .34)";
  context.lineWidth = 1;
  context.strokeRect(offsetX - 1, offsetY - 1, gridWidth + 2, gridHeight + 2);

  for (let y = 0; y < game.level.height; y += 1) {
    for (let x = 0; x < game.level.width; x += 1) {
      const tile = tileAt(game.level, x, y);
      if (tile === TILES.WALL) drawWall(x, y);
    }
  }

  for (const stop of game.level.stops) {
    if (stop.x !== game.level.start.x || stop.y !== game.level.start.y) drawAnchor(stop, now, false);
  }
  drawAnchor(game.level.start, now, true);
  for (const mine of game.level.mines) drawMine(mine, now);
  drawTrails(now);
  drawEnergy(now);
}

function drawWall(x, y) {
  const { cell, offsetX, offsetY } = canvasMetrics;
  const left = offsetX + x * cell;
  const top = offsetY + y * cell;
  const inset = Math.max(1.2, cell * 0.035);
  const plate = context.createLinearGradient(left, top, left + cell, top + cell);
  plate.addColorStop(0, "#25364e");
  plate.addColorStop(0.42, "#101b2c");
  plate.addColorStop(1, "#070e1a");
  context.fillStyle = plate;
  context.fillRect(left + inset, top + inset, cell - inset * 2, cell - inset * 2);
  context.strokeStyle = "rgba(126, 163, 205, .25)";
  context.lineWidth = 0.8;
  context.strokeRect(left + inset + 0.5, top + inset + 0.5, cell - inset * 2 - 1, cell - inset * 2 - 1);

  context.fillStyle = "rgba(118, 198, 239, .13)";
  context.fillRect(left + inset, top + inset, cell - inset * 2, Math.max(1, cell * 0.035));
  if ((x * 5 + y * 3) % 4 === 0) {
    context.save();
    context.strokeStyle = "rgba(120, 148, 188, .13)";
    context.lineWidth = Math.max(0.6, cell * 0.018);
    context.beginPath();
    context.moveTo(left + cell * 0.15, top + cell * 0.72);
    context.lineTo(left + cell * 0.72, top + cell * 0.15);
    context.moveTo(left + cell * 0.34, top + cell * 0.86);
    context.lineTo(left + cell * 0.86, top + cell * 0.34);
    context.stroke();
    context.restore();
  }
  const bolt = Math.max(1, cell * 0.025);
  context.fillStyle = "rgba(157, 192, 225, .32)";
  context.fillRect(left + cell * 0.13, top + cell * 0.13, bolt, bolt);
  context.fillRect(left + cell * 0.84, top + cell * 0.84, bolt, bolt);
}

function drawAnchor(point, now, isHome) {
  const center = cellCenter(point);
  const radius = canvasMetrics.cell * (isHome ? 0.31 : 0.27);
  const pulse = REDUCED_MOTION.matches ? 0 : Math.sin(now / 520 + point.x) * radius * 0.055;
  context.save();
  context.translate(center.x, center.y);
  context.strokeStyle = isHome ? "rgba(113, 231, 255, .55)" : "rgba(165, 115, 255, .7)";
  context.shadowColor = isHome ? "#71e7ff" : "#9e72ff";
  context.shadowBlur = radius * 0.45;
  context.lineWidth = Math.max(1, radius * 0.07);
  context.beginPath();
  context.arc(0, 0, radius + pulse, 0, TAU);
  context.stroke();
  context.shadowBlur = 0;
  context.globalAlpha = 0.42;
  context.setLineDash([Math.max(2, radius * 0.22), Math.max(2, radius * 0.15)]);
  context.beginPath();
  context.arc(0, 0, radius * 0.68, now / 1300, now / 1300 + TAU);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = isHome ? "rgba(113, 231, 255, .65)" : "rgba(175, 128, 255, .72)";
  context.fillRect(-radius * 0.1, -radius * 0.1, radius * 0.2, radius * 0.2);
  context.restore();
}

function drawMine(point, now) {
  const center = cellCenter(point);
  const radius = canvasMetrics.cell * 0.23;
  const pulse = REDUCED_MOTION.matches ? 1 : 0.86 + Math.sin(now / 180 + point.y) * 0.12;
  context.save();
  context.translate(center.x, center.y);
  context.shadowColor = "#ff3458";
  context.shadowBlur = radius * (1.3 + pulse);
  context.strokeStyle = "rgba(255, 75, 106, .92)";
  context.fillStyle = "rgba(98, 8, 29, .72)";
  context.lineWidth = Math.max(1, radius * 0.08);
  context.beginPath();
  context.moveTo(0, -radius * pulse);
  context.lineTo(radius * 0.9 * pulse, radius * 0.82 * pulse);
  context.lineTo(-radius * 0.9 * pulse, radius * 0.82 * pulse);
  context.closePath();
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "#ff9aab";
  context.fillRect(-radius * 0.055, -radius * 0.42, radius * 0.11, radius * 0.52);
  context.fillRect(-radius * 0.055, radius * 0.26, radius * 0.11, radius * 0.11);
  context.restore();
}

function animationProgress(now, flight) {
  return Math.min(1, Math.max(0, (now - flight.start) / flight.duration));
}

function currentlyVisibleEnergy(now) {
  const points = remainingEnergyPositions(game).map((point) => ({ ...point, transient: false }));
  if (!activeFlight) return points;
  const progress = animationProgress(now, activeFlight);
  const scaledIndex = progress * (activeFlight.points.length - 1);
  for (let index = 0; index < activeFlight.result.collected.length; index += 1) {
    const point = activeFlight.result.collected[index];
    const pathIndex = activeFlight.points.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y);
    if (scaledIndex < pathIndex) points.push({ ...point, transient: true });
    else if (!activeFlight.collectedIndices.has(index)) {
      activeFlight.collectedIndices.add(index);
      collectAt(point, index);
    }
  }
  return points;
}

function drawEnergy(now) {
  for (const point of currentlyVisibleEnergy(now)) {
    const center = cellCenter(point);
    const radius = canvasMetrics.cell * 0.17;
    const phase = REDUCED_MOTION.matches ? 0 : Math.sin(now / 330 + point.x * 0.9 + point.y) * 0.09;
    context.save();
    context.translate(center.x, center.y);
    context.rotate(Math.PI / 4 + (REDUCED_MOTION.matches ? 0 : now / 3600));
    context.shadowColor = "#60dcff";
    context.shadowBlur = radius * 1.55;
    const gradient = context.createLinearGradient(-radius, -radius, radius, radius);
    gradient.addColorStop(0, "#efffff");
    gradient.addColorStop(0.42, "#76eaff");
    gradient.addColorStop(1, "#5267ff");
    context.fillStyle = gradient;
    const size = radius * (1 + phase);
    context.fillRect(-size * 0.64, -size * 0.64, size * 1.28, size * 1.28);
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(218, 251, 255, .8)";
    context.lineWidth = 0.7;
    context.strokeRect(-size, -size, size * 2, size * 2);
    context.restore();
  }
}

function drawTrails(now) {
  trails = trails.filter((trail) => now - trail.born < 1800);
  for (const trail of trails) {
    const age = now - trail.born;
    const alpha = Math.max(0, 1 - age / 1800) * 0.72;
    if (trail.points.length < 2 || alpha <= 0) continue;
    context.save();
    context.strokeStyle = trail.fatal ? `rgba(255, 72, 103, ${alpha})` : `rgba(91, 221, 255, ${alpha})`;
    context.shadowColor = trail.fatal ? "#ff355e" : "#65e4ff";
    context.shadowBlur = canvasMetrics.cell * 0.19;
    context.lineWidth = Math.max(1.2, canvasMetrics.cell * 0.035);
    context.beginPath();
    trail.points.forEach((point, index) => {
      const center = cellCenter(point);
      if (index === 0) context.moveTo(center.x, center.y);
      else context.lineTo(center.x, center.y);
    });
    context.stroke();
    context.restore();
  }
}

function shipRenderState(now) {
  if (activeFlight) {
    const progress = animationProgress(now, activeFlight);
    const position = positionAlong(activeFlight.points, progress);
    return { position, direction: activeFlight.direction, alpha: 1, thrust: true };
  }
  if (rewindFlight) {
    const progress = animationProgress(now, rewindFlight);
    const position = positionAlong(rewindFlight.points, progress);
    const first = rewindFlight.points[0];
    const second = rewindFlight.points[1] ?? first;
    const direction = directionFromVector(second.x - first.x, second.y - first.y) ?? game.lastMove?.direction ?? "N";
    return { position, direction, alpha: 0.34 + (1 - progress) * 0.38, thrust: false, rewind: true };
  }
  return { position: game.position, direction: game.lastMove?.direction ?? "N", alpha: 1, thrust: false };
}

function drawShip(now) {
  const renderState = shipRenderState(now);
  const center = cellCenter(renderState.position);
  const vector = DIRECTION_VECTORS[renderState.direction] ?? DIRECTION_VECTORS.N;
  const angle = Math.atan2(vector.dy, vector.dx) + Math.PI / 2;
  const size = canvasMetrics.cell * 0.29;

  context.save();
  context.globalAlpha = renderState.alpha;
  context.translate(center.x, center.y);
  context.rotate(angle);

  if (renderState.thrust) {
    const flicker = REDUCED_MOTION.matches ? 0.8 : 0.75 + Math.sin(now / 37) * 0.22;
    const flame = context.createLinearGradient(0, size * 0.45, 0, size * 1.65 * flicker);
    flame.addColorStop(0, "rgba(230, 250, 255, .92)");
    flame.addColorStop(0.28, "rgba(86, 220, 255, .9)");
    flame.addColorStop(1, "rgba(126, 65, 255, 0)");
    context.fillStyle = flame;
    context.shadowColor = "#665cff";
    context.shadowBlur = size;
    context.beginPath();
    context.moveTo(-size * 0.22, size * 0.42);
    context.lineTo(0, size * 1.65 * flicker);
    context.lineTo(size * 0.22, size * 0.42);
    context.closePath();
    context.fill();
  }

  if (renderState.rewind) {
    context.setLineDash([2, 3]);
    context.strokeStyle = "rgba(255, 116, 204, .9)";
  } else {
    context.strokeStyle = "#c7f7ff";
  }
  context.lineWidth = Math.max(1.1, size * 0.07);
  context.shadowColor = renderState.rewind ? "#ff62d5" : "#62dcff";
  context.shadowBlur = size * 0.85;
  const hull = context.createLinearGradient(-size, 0, size, 0);
  hull.addColorStop(0, "#274a6a");
  hull.addColorStop(0.48, "#e5fbff");
  hull.addColorStop(1, "#4652ab");
  context.fillStyle = hull;
  context.beginPath();
  context.moveTo(0, -size);
  context.lineTo(size * 0.67, size * 0.45);
  context.lineTo(size * 0.3, size * 0.35);
  context.lineTo(size * 0.58, size * 0.76);
  context.lineTo(0, size * 0.52);
  context.lineTo(-size * 0.58, size * 0.76);
  context.lineTo(-size * 0.3, size * 0.35);
  context.lineTo(-size * 0.67, size * 0.45);
  context.closePath();
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.shadowBlur = 0;
  context.fillStyle = "#16324a";
  context.beginPath();
  context.ellipse(0, -size * 0.16, size * 0.2, size * 0.33, 0, 0, TAU);
  context.fill();
  context.strokeStyle = "rgba(113, 231, 255, .8)";
  context.lineWidth = Math.max(0.7, size * 0.04);
  context.stroke();
  context.restore();
}

function updateParticles(now, delta) {
  const deltaScale = Math.min(2.5, delta / 16.67);
  particles = particles.filter((particle) => now - particle.born < particle.life);
  for (const particle of particles) {
    particle.x += particle.vx * deltaScale;
    particle.y += particle.vy * deltaScale;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    const alpha = Math.max(0, 1 - (now - particle.born) / particle.life);
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = particle.color;
    context.shadowColor = particle.color;
    context.shadowBlur = particle.size * 3;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
    context.restore();
  }
}

function render(now = performance.now()) {
  if (!canvasMetrics || !context) return;
  const delta = Math.max(0, now - (lastFrameTime || now));
  lastFrameTime = now;
  context.setTransform(canvasMetrics.dpr, 0, 0, canvasMetrics.dpr, 0, 0);
  context.clearRect(0, 0, canvasMetrics.width, canvasMetrics.height);
  drawGrid(now);
  drawShip(now);
  updateParticles(now, delta);

  if (impactFlash) {
    const age = now - impactFlash;
    if (age < 430) {
      context.save();
      context.globalAlpha = Math.max(0, 0.52 * (1 - age / 430));
      context.fillStyle = age < 70 ? "#fff1f5" : "#ff214e";
      context.fillRect(0, 0, canvasMetrics.width, canvasMetrics.height);
      context.restore();
    } else impactFlash = 0;
  }

  if (activeFlight && animationProgress(now, activeFlight) >= 1) finishFlight();
  if (rewindFlight && animationProgress(now, rewindFlight) >= 1) rewindFlight = null;
}

function animationLoop(now) {
  frameHandle = requestAnimationFrame(animationLoop);
  if (document.hidden) return;
  if (now - lastFrameTime < (REDUCED_MOTION.matches ? 80 : 24)) return;
  render(now);
}

function directionFromVector(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 0.001) return null;
  const directions = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const index = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return directions[(index + 8) % 8];
}

function localPointer(event) {
  const rect = elements.canvasWrap.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function handlePointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  audio.ensure();
  elements.canvasWrap.setPointerCapture?.(event.pointerId);
  pointerStart = { ...localPointer(event), id: event.pointerId };
}

function handlePointerUp(event) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const end = localPointer(event);
  const delta = { x: end.x - pointerStart.x, y: end.y - pointerStart.y };
  const swipeDistance = Math.hypot(delta.x, delta.y);
  let direction;
  if (swipeDistance >= 24) {
    direction = directionFromVector(delta.x, delta.y);
  } else {
    const ship = cellCenter(game.position);
    direction = ship ? directionFromVector(end.x - ship.x, end.y - ship.y) : null;
    if (ship && Math.hypot(end.x - ship.x, end.y - ship.y) < canvasMetrics.cell * 0.34) direction = null;
  }
  pointerStart = null;
  if (direction) requestMove(direction);
  else setStatus("请在回收艇周围点选方向，或轻扫棋盘", true);
}

function handleKeydown(event) {
  if (elements.rulesDialog.open) return;
  const keyMap = {
    ArrowUp: "N",
    ArrowRight: "E",
    ArrowDown: "S",
    ArrowLeft: "W",
    w: "N",
    d: "E",
    s: "S",
    a: "W",
    q: "NW",
    e: "NE",
    z: "SW",
    c: "SE",
  };
  const numpadMap = {
    Numpad8: "N",
    Numpad9: "NE",
    Numpad6: "E",
    Numpad3: "SE",
    Numpad2: "S",
    Numpad1: "SW",
    Numpad4: "W",
    Numpad7: "NW",
  };
  const direction = numpadMap[event.code] ?? keyMap[event.key] ?? keyMap[event.key.toLowerCase()];
  if (direction) {
    event.preventDefault();
    if (!event.repeat) requestMove(direction);
    return;
  }

  if (event.repeat) return;
  const command = event.key.toLowerCase();
  if (command === "u") {
    event.preventDefault();
    undoLastMove();
  } else if (command === "r") {
    event.preventDefault();
    restartCurrentLevel();
  } else if (command === "n") {
    event.preventDefault();
    audio.ensure();
    audio.click();
    nextLevelInDifficulty({ randomize: true });
  } else if (command === "m") {
    event.preventDefault();
    toggleMute();
  } else if (event.key === "?") {
    event.preventDefault();
    elements.rulesDialog.showModal();
  }
}

function bindEvents() {
  elements.directionPad.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-dir]");
    if (!button) return;
    requestMove(button.dataset.dir);
  });

  elements.difficultyButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-difficulty]");
    if (!button || button.dataset.difficulty === selectedDifficulty) return;
    audio.ensure();
    audio.click();
    switchDifficulty(button.dataset.difficulty);
  });

  elements.canvasWrap.addEventListener("pointerdown", handlePointerDown);
  elements.canvasWrap.addEventListener("pointerup", handlePointerUp);
  elements.canvasWrap.addEventListener("pointercancel", () => { pointerStart = null; });
  elements.canvasWrap.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("keydown", handleKeydown);

  elements.newGame.addEventListener("click", () => {
    audio.ensure();
    audio.click();
    nextLevelInDifficulty({ randomize: true });
  });
  elements.restartGame.addEventListener("click", restartCurrentLevel);
  elements.undoMove.addEventListener("click", undoLastMove);
  elements.muteAudio.addEventListener("click", toggleMute);
  elements.openRules.addEventListener("click", () => {
    audio.ensure();
    audio.click();
    elements.rulesDialog.showModal();
  });

  elements.outcomePrimary.addEventListener("click", () => {
    if (game.status === STATUS.LOST) undoLastMove();
    else nextLevelInDifficulty();
  });
  elements.outcomeSecondary.addEventListener("click", restartCurrentLevel);
  elements.outcomePanel.addEventListener("pointerdown", (event) => event.stopPropagation());
  elements.outcomePanel.addEventListener("pointerup", (event) => event.stopPropagation());

  elements.rulesDialog.addEventListener("click", (event) => {
    if (event.target !== elements.rulesDialog) return;
    const rect = elements.rulesDialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) elements.rulesDialog.close();
  });

  REDUCED_MOTION.addEventListener?.("change", () => {
    if (activeFlight) finishFlight();
    resizeCanvas();
  });
  new ResizeObserver(resizeCanvas).observe(elements.canvasWrap);
  window.addEventListener("pagehide", saveGame);
}

function initialize() {
  buildDifficultyButtons();
  bindEvents();
  updateInterface();
  resizeCanvas();
  saveGame();
  cancelAnimationFrame(frameHandle);
  frameHandle = requestAnimationFrame(animationLoop);

  if (game.status === STATUS.WON || game.status === STATUS.LOST) showOutcome(game.status, true);
  else setStatus(`已恢复任务：${game.level.name}`, true);
}

initialize();
