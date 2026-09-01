import {
  BOARD_SIZE,
  DIRECTIONS,
  FACE_IDS,
  applyMove,
  boardIndex,
  cloneState,
  countAwakeFaces,
  countGroundTokens,
  createPuzzle,
  isWon,
  validateHistoryChain,
  validateState,
} from "./logic.mjs?v=20260901a";
import { FACE_VISUALS, rollTransform, rollVisual } from "./visuals.mjs?v=20260901a";

const SAVE_KEY = "five-realms.memory-ark.session.v1";
const BEST_KEY = "five-realms.memory-ark.best.v1";
const SOUND_KEY = "five-realms.memory-ark.muted";
const BASE_CUBE_TRANSFORM = "translateY(-8%) rotateX(-24deg) rotateY(38deg)";

const TOKEN_META = Object.freeze({
  "memory-sun": { glyph: "✦", name: "曜印" },
  "memory-tide": { glyph: "≋", name: "潮印" },
  "memory-seed": { glyph: "◇", name: "生印" },
  "memory-wing": { glyph: "⌁", name: "翼印" },
  "memory-eye": { glyph: "◉", name: "观印" },
  "memory-echo": { glyph: "∿", name: "回印" },
});

const dom = {
  board: document.querySelector("#board"),
  boardWrap: document.querySelector("#boardWrap"),
  coreAnchor: document.querySelector("#coreAnchor"),
  cubeVisual: document.querySelector("#cubeVisual"),
  rollLanding: document.querySelector("#rollLanding"),
  moveCount: document.querySelector("#moveCount"),
  referenceCount: document.querySelector("#referenceCount"),
  bestCount: document.querySelector("#bestCount"),
  progressText: document.querySelector("#progressText"),
  facePips: document.querySelector("#facePips"),
  statusMessage: document.querySelector("#statusMessage"),
  saveIndicator: document.querySelector("#saveIndicator"),
  soundButton: document.querySelector("#soundButton"),
  rulesButton: document.querySelector("#rulesButton"),
  rulesButtonSecondary: document.querySelector("#rulesButtonSecondary"),
  newButton: document.querySelector("#newButton"),
  restartButton: document.querySelector("#restartButton"),
  undoButton: document.querySelector("#undoButton"),
  rulesDialog: document.querySelector("#rulesDialog"),
  closeRulesButton: document.querySelector("#closeRulesButton"),
  ending: document.querySelector("#ending"),
  endingCopy: document.querySelector("#endingCopy"),
  endingMoves: document.querySelector("#endingMoves"),
  endingReference: document.querySelector("#endingReference"),
  continueButton: document.querySelector("#continueButton"),
  endingNewButton: document.querySelector("#endingNewButton"),
  toast: document.querySelector("#toast"),
  directionButtons: [...document.querySelectorAll("[data-direction]")],
  cubeFaces: [...document.querySelectorAll(".cube-face[data-slot]")],
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const cells = [];
let busy = false;
let toastTimer = 0;
let saveTimer = 0;
let endingTimer = 0;
let rollCueTimer = 0;
let endingReturnFocus = null;
let suppressClick = false;
let pointerStart = null;

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function readBestScores() {
  try {
    const parsed = JSON.parse(storageGet(BEST_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => Number.isInteger(value) && value > 0),
    );
  } catch {
    return {};
  }
}

let bestScores = readBestScores();

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function newSession(seed = randomSeed()) {
  const puzzle = createPuzzle(seed);
  return {
    version: 1,
    seed: puzzle.seed,
    initial: cloneState(puzzle.initial),
    current: cloneState(puzzle.initial),
    history: [],
    referenceMoves: puzzle.referenceMoves,
    completed: false,
  };
}

function restoreSession() {
  try {
    const parsed = JSON.parse(storageGet(SAVE_KEY) ?? "null");
    if (!parsed || parsed.version !== 1) return null;
    if (!validateState(parsed.initial) || !validateState(parsed.current)) return null;
    if (countAwakeFaces(parsed.initial) !== 0 || countGroundTokens(parsed.initial) !== FACE_IDS.length) return null;
    if (parsed.initial.moves !== 0) return null;
    if (!Number.isInteger(parsed.referenceMoves) || parsed.referenceMoves < 1) return null;
    if (!Number.isInteger(parsed.seed)) return null;

    if (!validateHistoryChain(parsed.initial, parsed.current, parsed.history, 400)) return null;
    const history = parsed.history.map(cloneState);

    return {
      version: 1,
      seed: parsed.seed >>> 0,
      initial: cloneState(parsed.initial),
      current: cloneState(parsed.current),
      history,
      referenceMoves: parsed.referenceMoves,
      completed: isWon(parsed.current),
    };
  } catch {
    return null;
  }
}

function seedFromUrl() {
  const value = new URLSearchParams(window.location.search).get("seed");
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const seed = Number(value);
  return Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff ? seed : null;
}

const requestedSeed = seedFromUrl();
let session = requestedSeed === null ? restoreSession() ?? newSession() : newSession(requestedSeed);
let completionReported = session.completed;

function reportCompletion(payload) {
  if (window.RealmArcade?.complete) {
    window.RealmArcade.complete(payload);
  } else {
    (window.__realmCompletionQueue ??= []).push(payload);
  }
}

class ArkAudio {
  constructor() {
    this.context = null;
    this.muted = storageGet(SOUND_KEY) === "true";
  }

  ensure() {
    if (this.muted) return null;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  }

  tone(frequency, duration, options = {}) {
    const context = this.ensure();
    if (!context) return;

    const start = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.endFrequency ?? frequency),
      start + duration,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.035, start + Math.min(0.018, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  roll(exchange) {
    if (this.muted) return;
    this.tone(116, 0.2, { type: "triangle", endFrequency: 62, volume: 0.035 });
    this.tone(228, 0.09, { type: "sine", endFrequency: 172, volume: 0.016, delay: 0.19 });
    if (exchange.changed && exchange.pickedUp) {
      this.tone(430, 0.26, { type: "sine", endFrequency: 720, volume: 0.038, delay: 0.21 });
      this.tone(860, 0.18, { type: "sine", endFrequency: 1040, volume: 0.017, delay: 0.25 });
    } else if (exchange.changed && exchange.pressedDown) {
      this.tone(180, 0.28, { type: "triangle", endFrequency: 92, volume: 0.045, delay: 0.2 });
    } else {
      this.tone(150, 0.12, { type: "sine", endFrequency: 126, volume: 0.016, delay: 0.2 });
    }
  }

  invalid() {
    this.tone(92, 0.16, { type: "sawtooth", endFrequency: 64, volume: 0.028 });
    this.tone(70, 0.12, { type: "square", endFrequency: 58, volume: 0.012, delay: 0.09 });
  }

  ui() {
    this.tone(360, 0.1, { type: "sine", endFrequency: 470, volume: 0.018 });
  }

  undo() {
    this.tone(250, 0.18, { type: "triangle", endFrequency: 145, volume: 0.025 });
  }

  victory() {
    [196, 246.94, 293.66, 392, 493.88, 587.33].forEach((frequency, index) => {
      this.tone(frequency, 0.7, {
        type: index % 2 ? "sine" : "triangle",
        endFrequency: frequency * 1.012,
        volume: 0.027,
        delay: index * 0.12,
      });
    });
    this.tone(98, 1.25, { type: "sine", endFrequency: 65, volume: 0.045 });
  }

  toggle() {
    this.muted = !this.muted;
    storageSet(SOUND_KEY, String(this.muted));
    if (!this.muted) {
      this.ensure();
      this.ui();
    }
    return this.muted;
  }
}

const audio = new ArkAudio();

function buildBoard() {
  const fragment = document.createDocumentFragment();
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const cell = document.createElement("button");
      const sigil = document.createElement("span");
      const coordinate = document.createElement("span");
      cell.type = "button";
      cell.className = "board-cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      sigil.className = "ground-sigil";
      sigil.hidden = true;
      sigil.setAttribute("aria-hidden", "true");
      coordinate.className = "cell-coordinate";
      coordinate.textContent = `${String.fromCharCode(65 + y)}${x + 1}`;
      coordinate.setAttribute("aria-hidden", "true");
      cell.append(sigil, coordinate);
      cells.push({ cell, sigil, x, y });
      fragment.append(cell);
    }
  }
  dom.board.append(fragment);
  dom.board.append(dom.coreAnchor, dom.rollLanding);
}

function tokenName(token) {
  return token ? TOKEN_META[token]?.name ?? "记忆符印" : "无符印";
}

function formatMoves(value) {
  return String(value).padStart(3, "0");
}

function setStatus(message, tone = "neutral") {
  dom.statusMessage.textContent = message;
  dom.statusMessage.classList.toggle("success", tone === "success");
  dom.statusMessage.classList.toggle("failure", tone === "failure");
}

function renderBoard() {
  const { current } = session;
  for (const item of cells) {
    const index = boardIndex(item.x, item.y, current.size);
    const token = current.board[index];
    const isCore = item.x === current.position.x && item.y === current.position.y;
    const distance = Math.abs(item.x - current.position.x) + Math.abs(item.y - current.position.y);
    item.cell.classList.toggle("has-token", Boolean(token));
    item.cell.classList.toggle("neighbor", distance === 1);
    item.cell.setAttribute("aria-selected", String(isCore));
    item.cell.setAttribute(
      "aria-label",
      `第 ${item.y + 1} 行，第 ${item.x + 1} 列，${tokenName(token)}${isCore ? "，核心当前位置" : distance === 1 ? "，可滚动到此" : ""}`,
    );

    if (token) {
      item.cell.dataset.token = token;
      item.sigil.dataset.token = token;
      item.sigil.textContent = TOKEN_META[token].glyph;
      item.sigil.hidden = false;
    } else {
      delete item.cell.dataset.token;
      delete item.sigil.dataset.token;
      item.sigil.textContent = "";
      item.sigil.hidden = true;
    }
  }

  dom.coreAnchor.style.left = `${current.position.x * 25}%`;
  dom.coreAnchor.style.top = `${current.position.y * 25}%`;
}

function renderCube() {
  for (const element of dom.cubeFaces) {
    const slot = element.dataset.slot;
    const physicalFace = session.current.orientation[slot];
    const faceVisual = FACE_VISUALS[physicalFace];
    const token = session.current.faceTokens[physicalFace];
    const symbol = element.querySelector("span");
    element.classList.toggle("has-token", Boolean(token));
    element.dataset.physicalFace = physicalFace;
    element.dataset.faceIndex = faceVisual.index;
    element.setAttribute("aria-label", `${faceVisual.name}${token ? `，${tokenName(token)}` : "，空白"}`);
    if (token) {
      element.dataset.token = token;
      symbol.textContent = TOKEN_META[token].glyph;
    } else {
      delete element.dataset.token;
      symbol.textContent = "";
    }
  }
}

function renderStats() {
  const awake = countAwakeFaces(session.current);
  const best = bestScores[String(session.seed)];
  dom.moveCount.textContent = formatMoves(session.current.moves);
  dom.referenceCount.textContent = formatMoves(session.referenceMoves);
  dom.bestCount.textContent = best ? formatMoves(best) : "—";
  dom.progressText.textContent = `${awake} / ${FACE_IDS.length}`;
  [...dom.facePips.children].forEach((pip, index) => pip.classList.toggle("awake", index < awake));
}

function renderControls() {
  const locked = busy || isWon(session.current);
  dom.directionButtons.forEach((button) => {
    button.disabled = locked;
  });
  dom.undoButton.disabled = busy || session.history.length === 0;
  dom.restartButton.disabled = busy;
  dom.newButton.disabled = busy;
  dom.rulesButton.disabled = busy;
  dom.rulesButtonSecondary.disabled = busy;
  dom.board.setAttribute("aria-busy", String(busy));
  dom.board.setAttribute("aria-disabled", String(locked));
}

function render() {
  renderBoard();
  renderCube();
  renderStats();
  renderControls();
}

function pulseSaved() {
  window.clearTimeout(saveTimer);
  dom.saveIndicator.classList.remove("saving");
  void dom.saveIndicator.offsetWidth;
  dom.saveIndicator.classList.add("saving");
  saveTimer = window.setTimeout(() => dom.saveIndicator.classList.remove("saving"), 520);
}

function saveSession() {
  const payload = {
    version: 1,
    seed: session.seed,
    initial: session.initial,
    current: session.current,
    history: session.history.slice(-400),
    referenceMoves: session.referenceMoves,
  };
  if (storageSet(SAVE_KEY, JSON.stringify(payload))) pulseSaved();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => dom.toast.classList.remove("visible"), 1900);
}

function signalInvalid(message = "阵列边界封闭：核心不能向此方向滚动。") {
  dom.boardWrap.classList.remove("denied");
  void dom.boardWrap.offsetWidth;
  dom.boardWrap.classList.add("denied");
  window.setTimeout(() => dom.boardWrap.classList.remove("denied"), 390);
  setStatus(message, "failure");
  showToast(message);
  audio.invalid();
  navigator.vibrate?.(18);
}

function exchangeMessage(exchange) {
  if (exchange.changed && exchange.pickedUp) {
    return `${tokenName(exchange.pickedUp)}进入新的底面，核心共鸣增强。`;
  }
  if (exchange.changed && exchange.pressedDown) {
    return `${tokenName(exchange.pressedDown)}重新压印在地面，继续调整朝向。`;
  }
  if (exchange.pickedUp && exchange.pressedDown) {
    return "底面与地格同为有符印，明暗状态保持不变。";
  }
  return "空白底面掠过空格，符印状态保持不变。";
}

function prepareRollCue(direction) {
  window.clearTimeout(rollCueTimer);
  const delta = DIRECTIONS[direction];
  const visual = rollVisual(direction);
  const destination = {
    x: session.current.position.x + delta.dx,
    y: session.current.position.y + delta.dy,
  };
  dom.rollLanding.style.left = `${destination.x * 25}%`;
  dom.rollLanding.style.top = `${destination.y * 25}%`;
  dom.rollLanding.dataset.arrow = visual.arrow;
  dom.rollLanding.dataset.label = visual.label;
  dom.rollLanding.classList.remove("settled");
  dom.rollLanding.classList.add("visible");
  dom.board.dataset.rollLabel = `${visual.arrow} ${visual.label}`;
  dom.board.classList.add("show-roll-label");
  dom.coreAnchor.dataset.rollDirection = direction;
  dom.coreAnchor.dataset.rollArrow = visual.arrow;
  dom.coreAnchor.classList.add("is-rolling");
}

function settleRollCue() {
  dom.coreAnchor.classList.remove("is-rolling");
  dom.rollLanding.classList.add("settled");
  rollCueTimer = window.setTimeout(() => {
    dom.rollLanding.classList.remove("visible", "settled");
    dom.board.classList.remove("show-roll-label");
    delete dom.board.dataset.rollLabel;
    delete dom.coreAnchor.dataset.rollDirection;
    delete dom.coreAnchor.dataset.rollArrow;
  }, prefersReducedMotion.matches ? 180 : 360);
}

function clearRollCue() {
  window.clearTimeout(rollCueTimer);
  dom.coreAnchor.classList.remove("is-rolling");
  dom.rollLanding.classList.remove("visible", "settled");
  dom.board.classList.remove("show-roll-label");
  delete dom.board.dataset.rollLabel;
  delete dom.coreAnchor.dataset.rollDirection;
  delete dom.coreAnchor.dataset.rollArrow;
}

async function animateRoll(direction, exchange) {
  prepareRollCue(direction);
  if (prefersReducedMotion.matches || !dom.coreAnchor.animate) {
    dom.boardWrap.classList.add("exchanged");
    window.setTimeout(() => dom.boardWrap.classList.remove("exchanged"), 20);
    return;
  }

  const delta = DIRECTIONS[direction];
  const boardRect = dom.board.getBoundingClientRect();
  const x = (boardRect.width / BOARD_SIZE) * delta.dx;
  const y = (boardRect.height / BOARD_SIZE) * delta.dy;
  const duration = 540;
  const anchorAnimation = dom.coreAnchor.animate([
    { transform: "translate3d(0, 0, 0)", offset: 0 },
    { transform: "translate3d(0, 0, 0)", offset: 0.12 },
    { transform: `translate3d(${x * 0.52}px, ${y * 0.52 - 10}px, 0) scale(1.045)`, offset: 0.52 },
    { transform: `translate3d(${x}px, ${y}px, 0)`, offset: 0.88 },
    { transform: `translate3d(${x}px, ${y}px, 0)`, offset: 1 },
  ], { duration, easing: "cubic-bezier(.34,.04,.18,1)" });

  const cubeAnimation = dom.cubeVisual.animate([
    { transform: BASE_CUBE_TRANSFORM, offset: 0 },
    { transform: BASE_CUBE_TRANSFORM, offset: 0.12 },
    { transform: rollTransform(BASE_CUBE_TRANSFORM, direction, 0.5), offset: 0.52 },
    { transform: rollTransform(BASE_CUBE_TRANSFORM, direction, 1), offset: 0.88 },
    { transform: rollTransform(BASE_CUBE_TRANSFORM, direction, 1), offset: 1 },
  ], { duration, easing: "cubic-bezier(.34,.04,.18,1)" });

  const shadow = dom.coreAnchor.querySelector(".core-shadow");
  const shadowAnimation = shadow.animate([
    { opacity: 0.85, transform: "rotate(-5deg) scale(1)" },
    { opacity: 0.28, transform: "rotate(-5deg) scale(.62)" },
    { opacity: 0.85, transform: "rotate(-5deg) scale(1)" },
  ], { duration, easing: "ease-in-out" });

  window.setTimeout(() => {
    dom.boardWrap.classList.remove("exchanged");
    void dom.boardWrap.offsetWidth;
    dom.boardWrap.classList.add("exchanged");
  }, exchange?.changed ? 245 : 300);

  await Promise.allSettled([
    anchorAnimation.finished,
    cubeAnimation.finished,
    shadowAnimation.finished,
  ]);
  dom.boardWrap.classList.remove("exchanged");
}

function setBusy(value) {
  busy = value;
  renderControls();
}

function recordBest() {
  const key = String(session.seed);
  const previous = bestScores[key];
  if (!previous || session.current.moves < previous) {
    bestScores[key] = session.current.moves;
    const entries = Object.entries(bestScores).slice(-40);
    bestScores = Object.fromEntries(entries);
    storageSet(BEST_KEY, JSON.stringify(bestScores));
    return true;
  }
  return false;
}

function isUsableFocusTarget(target) {
  return target instanceof HTMLElement
    && target.isConnected
    && target !== document.body
    && target !== document.documentElement
    && target.getAttribute("aria-disabled") !== "true"
    && !(target instanceof HTMLButtonElement && target.disabled);
}

function endingFocusFallback() {
  if (isUsableFocusTarget(dom.undoButton)) return dom.undoButton;
  if (isUsableFocusTarget(dom.newButton)) return dom.newButton;
  return dom.board;
}

function rememberEndingFocus() {
  const activeElement = document.activeElement;
  endingReturnFocus = isUsableFocusTarget(activeElement) && !dom.ending.contains(activeElement)
    ? activeElement
    : endingFocusFallback();
}

function focusEndingTarget(target) {
  const nextTarget = isUsableFocusTarget(target) ? target : endingFocusFallback();
  nextTarget.focus({ preventScroll: true });
}

function scheduleEndingFocusRestore() {
  const target = isUsableFocusTarget(endingReturnFocus) ? endingReturnFocus : endingFocusFallback();
  endingReturnFocus = null;
  window.requestAnimationFrame(() => focusEndingTarget(target));
  window.setTimeout(() => focusEndingTarget(target), 80);
}

function hideEnding({ restoreFocus = true } = {}) {
  window.clearTimeout(endingTimer);
  dom.ending.classList.remove("visible");
  if (!restoreFocus) endingReturnFocus = null;
  if (dom.ending.open) dom.ending.close();
  if (restoreFocus) scheduleEndingFocusRestore();
}

function celebrate() {
  if (session.completed) return;
  rememberEndingFocus();
  session.completed = true;
  if (!completionReported) {
    completionReported = true;
    reportCompletion({
      levelId: `cube:standard:${session.seed.toString(36)}`,
      tier: 2,
      moves: session.current.moves,
      par: session.referenceMoves,
    });
  }
  const isNewBest = recordBest();
  saveSession();
  renderStats();
  setStatus("六面记忆全部归位，方舟正在苏醒。", "success");
  dom.boardWrap.classList.add("celebrating");
  window.setTimeout(() => dom.boardWrap.classList.remove("celebrating"), 1900);
  audio.victory();
  navigator.vibrate?.([30, 50, 45]);

  const difference = session.current.moves - session.referenceMoves;
  if (difference < 0) {
    dom.endingCopy.textContent = `比参考航迹少 ${Math.abs(difference)} 步。你找到了更短的记忆回路。`;
  } else if (difference === 0) {
    dom.endingCopy.textContent = "与参考航迹同长，六面记忆完整归位。";
  } else {
    dom.endingCopy.textContent = `六面记忆完整归位。再试一次，也许还能省下 ${difference} 步。`;
  }
  if (isNewBest) dom.endingCopy.textContent += " 已记录为本局最佳。";
  dom.endingMoves.textContent = `${session.current.moves} 步`;
  dom.endingReference.textContent = `${session.referenceMoves} 步`;

  endingTimer = window.setTimeout(() => {
    if (!dom.ending.open) dom.ending.showModal();
    dom.ending.classList.add("visible");
    dom.endingNewButton.focus({ preventScroll: true });
  }, prefersReducedMotion.matches ? 40 : 720);
}

async function requestMove(direction) {
  if (busy || dom.rulesDialog.open || dom.ending.open) return;
  audio.ensure();
  if (isWon(session.current)) {
    showToast("方舟已经唤醒；可撤销一步、重开或开启新航迹。 ");
    return;
  }

  const result = applyMove(session.current, direction);
  if (!result.moved) {
    signalInvalid();
    return;
  }

  const previous = cloneState(session.current);
  setBusy(true);
  setStatus(exchangeMessage(result.exchange));
  audio.roll(result.exchange);

  try {
    await animateRoll(direction, result.exchange);
    session.history.push(previous);
    if (session.history.length > 400) session.history.shift();
    session.current = result.state;
    session.completed = false;
    render();
    settleRollCue();
    saveSession();
    if (isWon(session.current)) celebrate();
  } finally {
    if (!dom.rollLanding.classList.contains("settled")) clearRollCue();
    setBusy(false);
  }
}

function directionBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "east";
  if (dx === -1 && dy === 0) return "west";
  if (dx === 0 && dy === 1) return "south";
  if (dx === 0 && dy === -1) return "north";
  return null;
}

async function undo() {
  if (busy || session.history.length === 0) return;
  hideEnding();
  const previous = session.history.at(-1);
  const direction = directionBetween(session.current.position, previous.position);
  setBusy(true);
  audio.ensure();
  audio.undo();
  try {
    if (direction) await animateRoll(direction, null);
    session.history.pop();
    session.current = cloneState(previous);
    session.completed = false;
    completionReported = false;
    setStatus("已撤回上一段航迹，位置、朝向与符印一并复原。 ");
    render();
    settleRollCue();
    saveSession();
  } finally {
    if (!dom.rollLanding.classList.contains("settled")) clearRollCue();
    setBusy(false);
  }
}

function restart() {
  if (busy) return;
  clearRollCue();
  hideEnding();
  audio.ensure();
  audio.undo();
  session.current = cloneState(session.initial);
  session.history = [];
  session.completed = false;
  completionReported = false;
  setStatus("航迹已重置：六枚符印回到本局最初的位置。 ");
  render();
  saveSession();
  dom.boardWrap.animate?.([
    { opacity: 0.35, transform: "scale(.985)" },
    { opacity: 1, transform: "scale(1)" },
  ], { duration: prefersReducedMotion.matches ? 1 : 320, easing: "ease-out" });
}

function startNewGame() {
  if (busy) return;
  clearRollCue();
  hideEnding({ restoreFocus: false });
  audio.ensure();
  audio.ui();
  let seed = randomSeed();
  if (seed === session.seed) seed = (seed + 1) >>> 0;
  session = newSession(seed);
  completionReported = false;
  setStatus("新的可解航迹已展开。先观察六枚符印，再决定第一滚。 ");
  render();
  saveSession();
  dom.boardWrap.animate?.([
    { opacity: 0, filter: "brightness(1.8)" },
    { opacity: 1, filter: "brightness(1)" },
  ], { duration: prefersReducedMotion.matches ? 1 : 520, easing: "ease-out" });
  dom.board.focus({ preventScroll: true });
}

function openRules() {
  if (busy || dom.rulesDialog.open) return;
  audio.ensure();
  audio.ui();
  dom.rulesDialog.showModal();
}

function closeRules() {
  if (dom.rulesDialog.open) dom.rulesDialog.close();
}

function updateSoundButton() {
  dom.soundButton.setAttribute("aria-pressed", String(audio.muted));
  dom.soundButton.setAttribute("aria-label", audio.muted ? "开启声音" : "静音");
  dom.soundButton.title = audio.muted ? "声音已关闭" : "声音已开启";
  dom.soundButton.querySelector(".button-icon").textContent = audio.muted ? "×" : "◖";
}

function handleCellClick(event) {
  if (suppressClick || busy) return;
  const cell = event.target.closest(".board-cell");
  if (!cell) return;
  const target = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
  const direction = directionBetween(session.current.position, target);
  if (direction) {
    requestMove(direction);
  } else if (target.x === session.current.position.x && target.y === session.current.position.y) {
    signalInvalid("核心正在此格；请选择一个相邻地格。 ");
  } else {
    signalInvalid("核心每次只能滚向一个相邻地格。 ");
  }
}

function handlePointerDown(event) {
  if (!event.isPrimary || busy) return;
  audio.ensure();
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  dom.board.setPointerCapture?.(event.pointerId);
}

function handlePointerUp(event) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  suppressClick = true;
  window.setTimeout(() => { suppressClick = false; }, 360);
  event.preventDefault();
  if (Math.abs(dx) > Math.abs(dy)) requestMove(dx > 0 ? "east" : "west");
  else requestMove(dy > 0 ? "south" : "north");
}

function handleKeyDown(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (dom.rulesDialog.open || dom.ending.open) return;
  const key = event.key.toLowerCase();
  const direction = {
    arrowup: "north",
    w: "north",
    arrowdown: "south",
    s: "south",
    arrowleft: "west",
    a: "west",
    arrowright: "east",
    d: "east",
  }[key];
  if (!direction) return;
  event.preventDefault();
  audio.ensure();
  requestMove(direction);
}

buildBoard();
render();
updateSoundButton();

if (isWon(session.current)) {
  setStatus("方舟已在此前航迹中唤醒。撤销、重开或开启新航迹。", "success");
} else if (session.current.moves > 0) {
  setStatus(`已恢复自动存档：当前 ${session.current.moves} 步，${countAwakeFaces(session.current)} 个表面有符印。`);
} else {
  setStatus("选择相邻地格，或使用方向键 / WASD 滚动核心。 ");
}

dom.directionButtons.forEach((button) => {
  button.addEventListener("click", () => requestMove(button.dataset.direction));
});
dom.board.addEventListener("click", handleCellClick);
dom.board.addEventListener("pointerdown", handlePointerDown);
dom.board.addEventListener("pointerup", handlePointerUp);
dom.board.addEventListener("pointercancel", () => { pointerStart = null; });
document.addEventListener("keydown", handleKeyDown);

dom.undoButton.addEventListener("click", undo);
dom.restartButton.addEventListener("click", restart);
dom.newButton.addEventListener("click", startNewGame);
dom.rulesButton.addEventListener("click", openRules);
dom.rulesButtonSecondary.addEventListener("click", openRules);
dom.closeRulesButton.addEventListener("click", closeRules);
dom.rulesDialog.addEventListener("click", (event) => {
  if (event.target === dom.rulesDialog) closeRules();
});
dom.ending.addEventListener("cancel", (event) => {
  event.preventDefault();
  hideEnding();
});
dom.ending.addEventListener("close", () => {
  dom.ending.classList.remove("visible");
  if (endingReturnFocus) scheduleEndingFocusRestore();
});
dom.ending.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusable = [...dom.ending.querySelectorAll("button:not(:disabled)")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
dom.soundButton.addEventListener("click", () => {
  audio.toggle();
  updateSoundButton();
  showToast(audio.muted ? "声音已关闭。" : "声音已开启。 ");
});

dom.continueButton.addEventListener("click", () => {
  hideEnding();
  showToast("方舟已唤醒；可撤销一步或开启新航迹。 ");
});
dom.endingNewButton.addEventListener("click", startNewGame);

window.addEventListener("pagehide", saveSession);
