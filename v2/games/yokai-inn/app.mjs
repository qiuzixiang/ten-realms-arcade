import {
  DIFFICULTIES,
  EDGE_ACTION,
  ENGINE_VERSION,
  analyzePosition,
  applyEdgeAction,
  areOrthogonalNeighbours,
  coordinatesOf,
  createPosition,
  difficultyById,
  difficultyByOrder,
  edgeKey,
  generatePuzzle,
  seedFromString,
  solvePuzzle,
  toggleHighlight,
} from "./logic.mjs";
import { reportCompatibilityCompletion } from "./delivery.mjs";
import {
  DEMAND_LABELS,
  HISTORY_LIMIT,
  STORAGE_PREFIX,
  YOKAI_GUESTS,
  canonicalCompletionDetail,
  createDefaultProfile,
  loadProfile,
  loadCompletionOutbox,
  loadSession,
  markTutorialSeen,
  recordCompletion,
  mergeCompletionOutbox,
  removeCompletionOutbox,
  saveCompletionOutbox,
  saveProfile,
  saveSession,
  starSummary,
  tutorialSeen,
} from "./profile.mjs";

const INTEGRATION_VERSION = 1;
const GAME_ID = "yokai-inn";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let localStorageRef = null;
try {
  localStorageRef = window.localStorage;
} catch {
  // Sandboxed documents can throw while evaluating the localStorage getter.
}

const elements = {
  assertiveStatus: document.querySelector("#assertive-status"),
  board: document.querySelector("#inn-board"),
  boardProgress: document.querySelector(".board-progress"),
  boardProgressBar: document.querySelector("#board-progress-bar"),
  boardSelectionStatus: document.querySelector("#board-selection-status"),
  boardViewport: document.querySelector("#board-viewport"),
  cleanCount: document.querySelector("#clean-count"),
  collectionCount: document.querySelector("#collection-count"),
  compendiumButton: document.querySelector("#compendium-button"),
  compendiumDialog: document.querySelector("#compendium-dialog"),
  compendiumGrid: document.querySelector("#compendium-grid"),
  compendiumSummary: document.querySelector("#compendium-summary"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  difficultyLabel: document.querySelector("#difficulty-label"),
  difficultyNote: document.querySelector("#difficulty-note"),
  excludeTool: document.querySelector("#exclude-tool"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  guestBookCount: document.querySelector("#guest-book-count"),
  highlightButtons: document.querySelector("#highlight-buttons"),
  mistakeCount: document.querySelector("#mistake-count"),
  moveCount: document.querySelector("#move-count"),
  muteButton: document.querySelector("#mute-button"),
  newPuzzleButton: document.querySelector("#new-puzzle-button"),
  nextStarCopy: document.querySelector("#next-star-copy"),
  pairCount: document.querySelector("#pair-count"),
  pairTotal: document.querySelector("#pair-total"),
  pairTray: document.querySelector("#pair-tray"),
  proofSeal: document.querySelector("#proof-seal"),
  puzzleId: document.querySelector("#puzzle-id"),
  puzzleTitle: document.querySelector("#puzzle-title"),
  rankProgress: document.querySelector("#rank-progress"),
  rareCount: document.querySelector("#rare-count"),
  restartButton: document.querySelector("#restart-button"),
  roomCount: document.querySelector("#room-count"),
  roomTool: document.querySelector("#room-tool"),
  roomTotal: document.querySelector("#room-total"),
  roomTotalLabel: document.querySelector("#room-total-label"),
  rulesButton: document.querySelector("#rules-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  saveStatus: document.querySelector("#save-status"),
  starDisplay: document.querySelector("#star-display"),
  toast: document.querySelector("#toast"),
  tutorialButton: document.querySelector("#tutorial-button"),
  tutorialCounter: document.querySelector("#tutorial-counter"),
  tutorialDialog: document.querySelector("#tutorial-dialog"),
  tutorialDots: document.querySelector("#tutorial-dots"),
  tutorialNext: document.querySelector("#tutorial-next"),
  tutorialPages: document.querySelector("#tutorial-pages"),
  tutorialPrevious: document.querySelector("#tutorial-previous"),
  tutorialSkip: document.querySelector("#tutorial-skip"),
  undoButton: document.querySelector("#undo-button"),
  uniqueToggle: document.querySelector("#unique-toggle"),
  victoryCopy: document.querySelector("#victory-copy"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryNew: document.querySelector("#victory-new"),
  victoryQuality: document.querySelector("#victory-quality"),
  victoryRewardCopy: document.querySelector("#victory-reward-copy"),
  victoryRewards: document.querySelector("#victory-rewards"),
  victoryStay: document.querySelector("#victory-stay"),
};

let audioContext = null;
let saveStatusTimer = 0;
let toastTimer = 0;
let tutorialIndex = 0;
let pendingVictory = false;
let touchStart = null;
let storageAvailable = true;
let focusedCell = 0;
let cellElements = new Map();
let edgeVisualElements = new Map();
let edgeHitElements = new Map();
let pairElements = new Map();
let longPressTimer = 0;
let suppressClickKey = null;
const modalReturnFocus = new WeakMap();
const announcedCompletionIds = new Set();
const announcedRewardIds = new Set();

const profileResult = loadProfile(localStorageRef);
let profile = profileResult.profile;
storageAvailable = profileResult.storageAvailable;
const outboxResult = loadCompletionOutbox(localStorageRef);
let completionOutbox = [...outboxResult.entries];
storageAvailable = storageAvailable && outboxResult.storageAvailable;

function resolvePuzzle({ order, seed, ensureUnique }) {
  return generatePuzzle(order, seed, { ensureUnique, maxAttempts: 1200 });
}

function puzzleCounterKey(difficultyId, ensureUnique) {
  return `${difficultyId}:${ensureUnique ? "u" : "a"}`;
}

function seedForCounter(difficultyId, ensureUnique, counter) {
  return seedFromString(`${GAME_ID}:g${ENGINE_VERSION}:${difficultyId}:${ensureUnique ? "unique" : "open"}:${counter}`);
}

function generateForSettings(difficultyId, ensureUnique, counter) {
  const difficulty = difficultyById(difficultyId) ?? DIFFICULTIES[0];
  const seed = seedForCounter(difficulty.id, ensureUnique, counter);
  try {
    return generatePuzzle(difficulty.order, seed, { ensureUnique, maxAttempts: 1200 });
  } catch {
    const fallbackSeed = seedFromString(`bench-${difficulty.order}`);
    return generatePuzzle(difficulty.order, fallbackSeed, { ensureUnique, maxAttempts: 2000 });
  }
}

function createAttemptId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.round(performance.now() * 1000).toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

function currentCompletionId() {
  return `${state.puzzle.id}:run:${state.attemptId}`;
}

const loadedSession = loadSession(localStorageRef, resolvePuzzle);
storageAvailable = storageAvailable && loadedSession.storageAvailable;

function freshState(puzzle) {
  return {
    puzzle,
    attemptId: createAttemptId(),
    position: createPosition(),
    history: [],
    moves: 0,
    mistakes: 0,
    elapsedMs: 0,
    startedAt: performance.now(),
    completed: false,
    completionReported: false,
    completionAnnounced: false,
    unconfirmedCompletion: null,
    tool: profile.preferences.tool,
    highlights: [],
    anchor: null,
  };
}

let state;
if (loadedSession.session) {
  const session = loadedSession.session;
  const difficulty = difficultyByOrder(session.puzzle.order) ?? DIFFICULTIES[0];
  profile.preferences.difficulty = difficulty.id;
  profile.preferences.ensureUnique = session.puzzle.ensureUnique;
  state = {
    ...session,
    startedAt: performance.now(),
    completionAnnounced: false,
    unconfirmedCompletion: null,
    tool: profile.preferences.tool,
    highlights: [],
    anchor: null,
  };
} else {
  const difficulty = difficultyById(profile.preferences.difficulty) ?? DIFFICULTIES[0];
  const counter = profile.counters[puzzleCounterKey(difficulty.id, profile.preferences.ensureUnique)] ?? 0;
  state = freshState(generateForSettings(difficulty.id, profile.preferences.ensureUnique, counter));
}

function currentDifficulty() {
  return difficultyByOrder(state.puzzle.order) ?? DIFFICULTIES[0];
}

function checkpointTime() {
  if (state.completed) return;
  const now = performance.now();
  state.elapsedMs += Math.max(0, Math.round(now - state.startedAt));
  state.startedAt = now;
}

function sessionPayload() {
  return {
    puzzle: state.puzzle,
    attemptId: state.attemptId,
    position: state.position,
    history: state.history,
    moves: state.moves,
    mistakes: state.mistakes,
    elapsedMs: state.elapsedMs,
    completionReported: state.completionReported,
  };
}

function setSaveStatus(message, saved = false) {
  window.clearTimeout(saveStatusTimer);
  elements.saveStatus.textContent = storageAvailable ? message : "本机存档暂不可用";
  elements.saveStatus.classList.toggle("is-saved", saved && storageAvailable);
  if (saved && storageAvailable) {
    saveStatusTimer = window.setTimeout(() => {
      elements.saveStatus.textContent = "本机自动存档";
      elements.saveStatus.classList.remove("is-saved");
    }, 1800);
  }
}

function persistProfile() {
  const result = saveProfile(localStorageRef, profile);
  if (result.ok) {
    profile = result.profile;
    storageAvailable = true;
    return true;
  }
  storageAvailable = false;
  setSaveStatus("本机存档暂不可用");
  return false;
}

function persistSession({ announce = true, checkpoint = true } = {}) {
  if (checkpoint) checkpointTime();
  const result = saveSession(localStorageRef, sessionPayload());
  if (result.ok) storageAvailable = true;
  else storageAvailable = false;
  if (announce) setSaveStatus(result.ok ? "旅簿已保存" : "本机存档暂不可用", result.ok);
  return result.ok;
}

function persistCompletionOutbox() {
  const result = saveCompletionOutbox(localStorageRef, completionOutbox);
  if (result.ok) {
    completionOutbox = [...result.entries];
    storageAvailable = true;
    return true;
  }
  storageAvailable = false;
  return false;
}

function showToast(message, error = false, duration = 2500) {
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

function setBoardStatus(message, tone = "normal") {
  elements.boardSelectionStatus.textContent = message;
  elements.boardSelectionStatus.classList.toggle("is-warning", tone === "warning");
  elements.boardSelectionStatus.classList.toggle("is-success", tone === "success");
}

function ensureAudio() {
  if (profile.preferences.muted) return null;
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
  if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.025, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSound(effect) {
  if (profile.preferences.muted) return;
  if (effect === "room-added") {
    tone(392, 0.13, { type: "triangle", gain: 0.021 });
    tone(587, 0.18, { gain: 0.015, delay: 0.05 });
  } else if (effect === "room-removed") {
    tone(430, 0.16, { endFrequency: 260, gain: 0.018 });
  } else if (effect.startsWith("exclusion")) {
    tone(effect.endsWith("added") ? 240 : 300, 0.08, { type: "square", gain: 0.012 });
  } else if (effect === "invalid") {
    tone(150, 0.12, { type: "sawtooth", gain: 0.015 });
    tone(126, 0.12, { type: "sawtooth", gain: 0.01, delay: 0.09 });
  } else if (effect === "undo") {
    tone(330, 0.12, { endFrequency: 470, gain: 0.015 });
  } else if (effect === "win") {
    [294, 392, 494, 659].forEach((frequency, index) => {
      tone(frequency, 0.7, { gain: 0.02, delay: index * 0.14 });
      tone(frequency * 2, 0.45, { gain: 0.005, delay: index * 0.14 + 0.04 });
    });
  }
}

function snapshot() {
  return {
    position: createPosition(state.position),
    moves: state.moves,
    mistakes: state.mistakes,
  };
}

function difficultyTier(id) {
  return Math.max(1, DIFFICULTIES.findIndex((item) => item.id === id) + 1);
}

function completionDetail(result) {
  const difficulty = currentDifficulty();
  const detail = {
    version: INTEGRATION_VERSION,
    game: GAME_ID,
    levelId: state.puzzle.id,
    puzzleId: state.puzzle.id,
    attemptId: state.attemptId,
    completionId: currentCompletionId(),
    difficulty: difficulty.id,
    tier: difficultyTier(difficulty.id),
    order: state.puzzle.order,
    seed: state.puzzle.seed,
    ensureUnique: state.puzzle.ensureUnique,
    uniqueRequested: state.puzzle.ensureUnique,
    uniquenessProven: state.puzzle.uniquenessProven,
    moves: state.moves,
    par: state.puzzle.dominoCount,
    mistakes: state.mistakes,
    flawless: state.mistakes === 0,
    elapsedMs: state.elapsedMs,
    rewardIds: result.claims.map(({ id }) => id),
    rewardClaims: result.claims.map((claim) => ({ ...claim })),
    starLevel: result.starLevel,
  };
  return Object.freeze({
    ...detail,
    rewardIds: Object.freeze(detail.rewardIds),
    rewardClaims: Object.freeze(detail.rewardClaims.map(Object.freeze)),
  });
}

function dispatchCompletionEvents(detail) {
  let dispatched = false;
  if (!announcedCompletionIds.has(detail.completionId)) {
    announcedCompletionIds.add(detail.completionId);
    window.dispatchEvent(new CustomEvent("ten-realms-v2:game-complete", { detail }));
    dispatched = true;
  }
  for (const claim of detail.rewardClaims) {
    if (announcedRewardIds.has(claim.id)) continue;
    announcedRewardIds.add(claim.id);
    window.dispatchEvent(new CustomEvent("ten-realms-v2:reward-earned", {
      detail: Object.freeze({ version: INTEGRATION_VERSION, game: GAME_ID, completionId: detail.completionId, ...claim }),
    }));
    dispatched = true;
  }
  return dispatched;
}

function showVictory(result) {
  const difficulty = currentDifficulty();
  elements.victoryMoves.textContent = `${state.moves} 步`;
  elements.victoryQuality.textContent = result.flawless ? "无误" : `${state.mistakes} 次修正`;
  elements.victoryRewards.textContent = `${result.claims.length} 项`;
  elements.victoryCopy.textContent = state.puzzle.ensureUnique
    ? `${difficulty.label}的唯一排法已经完成。`
    : "这份开放旅簿已按完整 Dominosa 规则合法铺满。";
  if (result.claims.length) {
    const stars = result.claims.filter(({ kind }) => kind === "star").length;
    const guests = result.claims.filter(({ kind }) => kind === "collection").length;
    elements.victoryRewardCopy.textContent = `本次新增 ${guests} 组图鉴、${result.claims.length - guests} 项里程碑${stars ? `，旅店升至 ${result.starLevel} 星` : ""}。`;
  } else {
    elements.victoryRewardCopy.textContent = "这本旅簿已经登记过；重复完成不会重复领取奖励。";
  }
  if (document.querySelector("dialog[open]")) {
    pendingVictory = true;
    return;
  }
  pendingVictory = false;
  openDialog(elements.victoryDialog, elements.newPuzzleButton, elements.victoryStay);
}

function handleCompletion(analysis) {
  if (!analysis.complete || state.completionReported) return;
  state.completed = true;
  const firstAnnouncement = !state.completionAnnounced;
  const result = recordCompletion(profile, {
    puzzle: state.puzzle,
    difficultyId: currentDifficulty().id,
    position: state.position,
    moves: state.moves,
    mistakes: state.mistakes,
    elapsedMs: state.elapsedMs,
  });
  profile = result.profile;
  const detail = canonicalCompletionDetail(state.unconfirmedCompletion ?? completionDetail(result), result, state.puzzle);
  state.unconfirmedCompletion = detail;
  let outboxStaged = false;
  try {
    completionOutbox = [...mergeCompletionOutbox(completionOutbox, detail)];
    outboxStaged = true;
  } catch {
    // An invalid/full outbox is treated as unavailable; the terminal session
    // remains unreported so a refresh can retry instead of losing rewards.
  }
  const outboxSaved = outboxStaged && persistCompletionOutbox();
  let profileSaved = outboxSaved ? persistProfile() : false;
  if (firstAnnouncement) {
    dispatchCompletionEvents(detail);
    state.completionAnnounced = true;
  }
  const queuedDetail = completionOutbox.find(({ completionId }) => completionId === detail.completionId) ?? detail;
  const canonicalQueuedDetail = canonicalCompletionDetail(queuedDetail, result, state.puzzle);
  const delivery = reportCompatibilityCompletion(window, canonicalQueuedDetail);
  if (delivery.delivered && !profileSaved) profileSaved = persistProfile();
  if (delivery.delivered && profileSaved) {
    completionOutbox = [...removeCompletionOutbox(completionOutbox, detail.completionId)];
    persistCompletionOutbox();
  }
  state.completionReported = outboxSaved || (delivery.delivered && profileSaved);
  if (state.completionReported) state.unconfirmedCompletion = null;
  persistSession({ announce: true, checkpoint: false });
  if (firstAnnouncement) playSound("win");
  renderProfile();
  if (firstAnnouncement) showVictory(result);
}

function flushCompletionOutbox() {
  const reconciled = new Map();
  for (const detail of completionOutbox) {
    try {
      const puzzle = resolvePuzzle({ order: detail.order, seed: detail.seed, ensureUnique: detail.ensureUnique });
      if (puzzle.id !== detail.puzzleId) continue;
      const result = recordCompletion(profile, {
        puzzle,
        difficultyId: detail.difficulty,
        position: createPosition({ rooms: puzzle.solution }),
        moves: detail.moves,
        mistakes: detail.mistakes,
        elapsedMs: detail.elapsedMs,
      });
      profile = result.profile;
      reconciled.set(detail.completionId, canonicalCompletionDetail(detail, result, puzzle));
    } catch {
      // Keep an entry that cannot be reconstructed; a later compatible engine
      // may still be able to reconcile and deliver it.
    }
  }
  const profileSaved = reconciled.size === 0 || persistProfile();
  let changed = false;
  for (const storedDetail of [...completionOutbox]) {
    const detail = reconciled.get(storedDetail.completionId);
    if (!detail) continue;
    if (!(state.completionAnnounced && detail.completionId === currentCompletionId())) dispatchCompletionEvents(detail);
    const delivery = reportCompatibilityCompletion(window, detail);
    if (delivery.delivered && profileSaved) {
      completionOutbox = [...removeCompletionOutbox(completionOutbox, detail.completionId)];
      changed = true;
    }
  }
  if (changed) persistCompletionOutbox();
}

function cellLabel(index, analysis) {
  const { row, column } = coordinatesOf(index, state.puzzle.width);
  const value = state.puzzle.numbers[index];
  const parts = [`第 ${row + 1} 行第 ${column + 1} 列，需求 ${value}`];
  const roomKey = analysis.occupiedBy.get(index);
  if (roomKey) {
    const edge = state.puzzle.edgeMap.get(roomKey);
    const other = edge.first === index ? edge.second : edge.first;
    const otherPoint = coordinatesOf(other, state.puzzle.width);
    parts.push(`已与第 ${otherPoint.row + 1} 行第 ${otherPoint.column + 1} 列需求 ${state.puzzle.numbers[other]} 同住`);
    if (analysis.duplicateRooms.has(roomKey)) parts.push("组合重复冲突");
  } else {
    parts.push("尚未入住");
    const excludedCount = state.puzzle.incidentEdges[index].filter((edge) => state.position.excluded.has(edge.key)).length;
    if (excludedCount) parts.push(`周围有 ${excludedCount} 条排除线`);
  }
  const slot = state.highlights.indexOf(value);
  if (slot >= 0) parts.push(slot === 0 ? "圆印高亮" : "菱印高亮");
  if (state.anchor === index) parts.push("当前配房起点");
  return parts.join("，");
}

function setCellFocus(index, focus = true) {
  if (!cellElements.has(index)) return;
  focusedCell = index;
  for (const [cell, element] of cellElements) element.tabIndex = cell === focusedCell ? 0 : -1;
  if (focus) cellElements.get(index).focus({ preventScroll: true });
}

function moveCellFocus(key) {
  const point = coordinatesOf(focusedCell, state.puzzle.width);
  const delta = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }[key];
  if (!delta) return false;
  const row = Math.max(0, Math.min(state.puzzle.height - 1, point.row + delta[0]));
  const column = Math.max(0, Math.min(state.puzzle.width - 1, point.column + delta[1]));
  setCellFocus(row * state.puzzle.width + column);
  return true;
}

function edgeCoordinates(edge) {
  const first = coordinatesOf(edge.first, state.puzzle.width);
  const second = coordinatesOf(edge.second, state.puzzle.width);
  if (first.row === second.row) {
    return {
      orientation: "horizontal",
      row: first.row,
      column: Math.min(first.column, second.column),
      x: `calc(${Math.min(first.column, second.column) + 1} * var(--cell) + ${Math.min(first.column, second.column)} * var(--gap) + var(--gap) / 2)`,
      y: `calc(${first.row} * (var(--cell) + var(--gap)) + var(--cell) / 2)`,
    };
  }
  return {
    orientation: "vertical",
    row: Math.min(first.row, second.row),
    column: first.column,
    x: `calc(${first.column} * (var(--cell) + var(--gap)) + var(--cell) / 2)`,
    y: `calc(${Math.min(first.row, second.row) + 1} * var(--cell) + ${Math.min(first.row, second.row)} * var(--gap) + var(--gap) / 2)`,
  };
}

function onCellKeydown(event, index) {
  if (moveCellFocus(event.key)) {
    event.preventDefault();
    return;
  }
  if (event.key === "Home") {
    event.preventDefault();
    setCellFocus(Math.floor(index / state.puzzle.width) * state.puzzle.width);
    return;
  }
  if (event.key === "End") {
    event.preventDefault();
    setCellFocus(Math.floor(index / state.puzzle.width) * state.puzzle.width + state.puzzle.width - 1);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    activateCell(index, EDGE_ACTION.ROOM);
  } else if (event.key === " ") {
    event.preventDefault();
    activateCell(index, EDGE_ACTION.EXCLUDE);
  } else if (event.key === "Escape" && state.anchor !== null) {
    event.preventDefault();
    state.anchor = null;
    renderBoard();
    setBoardStatus("已取消配房起点。");
  }
}

function buildBoard() {
  elements.board.replaceChildren();
  cellElements = new Map();
  edgeVisualElements = new Map();
  edgeHitElements = new Map();
  elements.board.style.setProperty("--columns", state.puzzle.width);
  elements.board.style.setProperty("--rows", state.puzzle.height);
  elements.board.setAttribute("aria-rowcount", String(state.puzzle.height));
  elements.board.setAttribute("aria-colcount", String(state.puzzle.width));
  elements.board.setAttribute("aria-label", `${currentDifficulty().label}，${state.puzzle.width} 乘 ${state.puzzle.height} 妖怪旅店房图`);

  focusedCell = Math.min(focusedCell, state.puzzle.cellCount - 1);
  for (let index = 0; index < state.puzzle.cellCount; index += 1) {
    const point = coordinatesOf(index, state.puzzle.width);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "number-cell";
    cell.dataset.cell = String(index);
    cell.style.setProperty("--row", point.row);
    cell.style.setProperty("--column", point.column);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-rowindex", String(point.row + 1));
    cell.setAttribute("aria-colindex", String(point.column + 1));
    cell.tabIndex = index === focusedCell ? 0 : -1;
    cell.innerHTML = `<span class="cell-number">${state.puzzle.numbers[index]}</span><i class="highlight-marker" aria-hidden="true"></i>`;
    cell.addEventListener("focus", () => setCellFocus(index, false));
    cell.addEventListener("click", () => activateCell(index, state.tool));
    cell.addEventListener("keydown", (event) => onCellKeydown(event, index));
    cellElements.set(index, cell);
    elements.board.append(cell);
  }

  for (const edge of state.puzzle.edges) {
    const placement = edgeCoordinates(edge);
    const visual = document.createElement("span");
    visual.className = `edge-visual ${placement.orientation}`;
    visual.dataset.edge = edge.key;
    visual.setAttribute("aria-hidden", "true");
    visual.style.setProperty("--edge-x", placement.x);
    visual.style.setProperty("--edge-y", placement.y);
    edgeVisualElements.set(edge.key, visual);
    elements.board.append(visual);

    const hit = document.createElement("button");
    hit.type = "button";
    hit.className = `edge-hit ${placement.orientation}`;
    hit.dataset.edge = edge.key;
    hit.tabIndex = -1;
    hit.setAttribute("aria-hidden", "true");
    hit.style.setProperty("--edge-x", placement.x);
    hit.style.setProperty("--edge-y", placement.y);
    hit.addEventListener("click", () => {
      if (suppressClickKey === edge.key) {
        suppressClickKey = null;
        setCellFocus(edge.first);
        return;
      }
      applyAction(edge.key, state.tool);
      setCellFocus(edge.first);
    });
    hit.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      applyAction(edge.key, EDGE_ACTION.EXCLUDE);
      setCellFocus(edge.first);
    });
    hit.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      window.clearTimeout(longPressTimer);
      longPressTimer = window.setTimeout(() => {
        suppressClickKey = edge.key;
        applyAction(edge.key, EDGE_ACTION.EXCLUDE);
        setCellFocus(edge.first);
        if (navigator.vibrate) navigator.vibrate(18);
      }, 520);
    });
    const cancelLongPress = () => window.clearTimeout(longPressTimer);
    hit.addEventListener("pointerup", cancelLongPress);
    hit.addEventListener("pointercancel", cancelLongPress);
    hit.addEventListener("pointerleave", cancelLongPress);
    edgeHitElements.set(edge.key, hit);
    elements.board.append(hit);
  }
}

function buildPairTray() {
  elements.pairTray.replaceChildren();
  elements.pairTray.setAttribute("role", "list");
  elements.pairTray.style.setProperty("--pair-columns", state.puzzle.order + 1);
  pairElements = new Map();
  for (const key of state.puzzle.pairKeys) {
    const [first, second] = key.split("-");
    const chip = document.createElement("span");
    chip.className = "pair-chip is-missing";
    chip.setAttribute("role", "listitem");
    chip.innerHTML = `<i aria-hidden="true"></i><span>${first}·${second}</span>`;
    pairElements.set(key, chip);
    elements.pairTray.append(chip);
  }
}

function buildHighlightButtons() {
  elements.highlightButtons.replaceChildren();
  for (let value = 0; value <= state.puzzle.order; value += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "highlight-button";
    button.dataset.value = String(value);
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `高亮所有需求 ${value} 的房客，共 ${state.puzzle.order + 2} 位`);
    button.textContent = String(value);
    button.addEventListener("click", () => toggleNumberHighlight(value));
    elements.highlightButtons.append(button);
  }
}

function renderRoomOverlays(analysis) {
  for (const overlay of elements.board.querySelectorAll(".room-overlay")) overlay.remove();
  for (const key of state.position.rooms) {
    const edge = state.puzzle.edgeMap.get(key);
    const placement = edgeCoordinates(edge);
    const overlay = document.createElement("span");
    overlay.className = `room-overlay ${placement.orientation}${analysis.duplicateRooms.has(key) ? " is-duplicate" : ""}`;
    overlay.dataset.room = key;
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.setProperty("--row", placement.row);
    overlay.style.setProperty("--column", placement.column);
    elements.board.prepend(overlay);
  }
}

function renderBoard() {
  const analysis = analyzePosition(state.puzzle, state.position);
  renderRoomOverlays(analysis);
  for (const [index, cell] of cellElements) {
    const value = state.puzzle.numbers[index];
    const highlightSlot = state.highlights.indexOf(value);
    cell.classList.toggle("is-anchor", state.anchor === index);
    cell.classList.toggle("is-occupied", analysis.occupiedBy.has(index));
    cell.classList.toggle("is-highlight-a", highlightSlot === 0);
    cell.classList.toggle("is-highlight-b", highlightSlot === 1);
    cell.setAttribute("aria-label", cellLabel(index, analysis));
  }
  for (const edge of state.puzzle.edges) {
    const visual = edgeVisualElements.get(edge.key);
    const room = state.position.rooms.has(edge.key);
    const excluded = state.position.excluded.has(edge.key);
    visual.classList.toggle("is-room", room);
    visual.classList.toggle("is-excluded", excluded);
    visual.classList.toggle("is-duplicate", analysis.duplicateRooms.has(edge.key));
    const first = coordinatesOf(edge.first, state.puzzle.width);
    const second = coordinatesOf(edge.second, state.puzzle.width);
    edgeHitElements.get(edge.key).title = `${first.row + 1}行${first.column + 1}列与${second.row + 1}行${second.column + 1}列：${room ? "已配房" : excluded ? "已排除" : "未标记"}`;
  }
  for (const key of state.puzzle.pairKeys) {
    const chip = pairElements.get(key);
    const count = analysis.roomsByPair.get(key).length;
    const mode = count > 1 ? "duplicate" : count === 1 ? "used" : "missing";
    chip.className = `pair-chip is-${mode}`;
    chip.querySelector("i").textContent = count > 1 ? "!" : count === 1 ? "✓" : "";
    chip.setAttribute("aria-label", `${key.replace("-", " 和 ")} 组合，${count > 1 ? `重复 ${count} 次` : count === 1 ? "已使用一次" : "尚未使用"}`);
  }
  for (const button of elements.highlightButtons.querySelectorAll("button")) {
    const value = Number(button.dataset.value);
    const slot = state.highlights.indexOf(value);
    button.dataset.slot = slot === 0 ? "a" : slot === 1 ? "b" : "";
    button.setAttribute("aria-pressed", String(slot >= 0));
  }
  return analysis;
}

function renderProof() {
  const strong = elements.proofSeal.querySelector("strong");
  const icon = elements.proofSeal.querySelector(":scope > span");
  if (state.puzzle.ensureUnique) {
    elements.proofSeal.dataset.proof = "unique";
    strong.textContent = "唯一解已证明";
    icon.textContent = "✓";
  } else {
    elements.proofSeal.dataset.proof = "open";
    strong.textContent = state.puzzle.uniquenessProven ? "开放题 · 恰为唯一" : "开放题 · 不保证唯一";
    icon.textContent = state.puzzle.uniquenessProven ? "1" : "◇";
  }
}

function renderTool() {
  const roomActive = state.tool === EDGE_ACTION.ROOM;
  elements.roomTool.classList.toggle("is-active", roomActive);
  elements.excludeTool.classList.toggle("is-active", !roomActive);
  elements.roomTool.setAttribute("aria-pressed", String(roomActive));
  elements.excludeTool.setAttribute("aria-pressed", String(!roomActive));
  profile.preferences.tool = state.tool;
}

function renderProfile() {
  const stats = profile.stats;
  const stars = starSummary(stats);
  elements.starDisplay.textContent = `${"★".repeat(stars.level)}${"☆".repeat(5 - stars.level)}`;
  elements.starDisplay.setAttribute("aria-label", `旅店 ${stars.level} 星，共 5 星`);
  elements.collectionCount.textContent = `${stats.compendium.length} / 21`;
  elements.guestBookCount.textContent = `${stats.compendium.length} 组`;
  elements.rareCount.textContent = `${stats.rarePairs.length} / 6`;
  elements.cleanCount.textContent = `${stats.cleanPuzzleIds.length} 本`;
  if (stars.next) {
    elements.nextStarCopy.textContent = `下一星：${stars.next.label}。`;
    const progress = stars.next.progress;
    elements.rankProgress.style.setProperty("--rank-progress", `${Math.round(progress * 100)}%`);
  } else {
    elements.nextStarCopy.textContent = "五星旅店达成：继续刷新旅簿最佳步数。";
    elements.rankProgress.style.setProperty("--rank-progress", "100%");
  }
}

function render() {
  const difficulty = currentDifficulty();
  const analysis = renderBoard();
  if (analysis.complete && !state.completed) checkpointTime();
  state.completed = analysis.complete;
  elements.difficultyLabel.textContent = difficulty.label;
  elements.difficultyNote.textContent = difficulty.note;
  elements.roomTotalLabel.textContent = `${state.puzzle.dominoCount} 间`;
  elements.puzzleTitle.textContent = state.puzzle.title;
  elements.puzzleId.textContent = state.puzzle.id;
  elements.roomCount.textContent = String(analysis.roomCount);
  elements.roomTotal.textContent = `/ ${state.puzzle.dominoCount}`;
  elements.pairCount.textContent = String(analysis.usedPairCount);
  elements.pairTotal.textContent = `/ ${state.puzzle.dominoCount}`;
  elements.moveCount.textContent = String(state.moves);
  elements.mistakeCount.textContent = String(state.mistakes);
  const ratio = analysis.roomCount / state.puzzle.dominoCount;
  elements.boardProgress.style.setProperty("--progress", ratio.toFixed(4));
  elements.boardProgress.setAttribute("aria-valuemax", String(state.puzzle.dominoCount));
  elements.boardProgress.setAttribute("aria-valuenow", String(analysis.roomCount));
  elements.boardProgress.setAttribute("aria-valuetext", `已配 ${analysis.roomCount} 间，共 ${state.puzzle.dominoCount} 间`);
  elements.undoButton.disabled = state.history.length === 0;
  elements.uniqueToggle.checked = state.puzzle.ensureUnique;
  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === difficulty.id));
  }
  renderProof();
  renderTool();
  renderProfile();
  if (analysis.duplicatePairKeys.length) {
    setBoardStatus(`有 ${analysis.duplicatePairKeys.length} 种组合重复：${analysis.duplicatePairKeys.map((key) => key.replace("-", "·")).join("、")}。红色三角房框需要调整。`, "warning");
  } else if (state.anchor !== null) {
    const value = state.puzzle.numbers[state.anchor];
    setBoardStatus(`已选需求 ${value} 的房客；再选一个正交相邻格，使用“${state.tool === EDGE_ACTION.ROOM ? "确定客房" : "排除"}”。`);
  } else if (analysis.complete) {
    setBoardStatus("全馆铺满，所有无序组合恰好一次。", "success");
  } else {
    setBoardStatus(`已入住 ${analysis.roomCount}/${state.puzzle.dominoCount} 间，还缺 ${analysis.missingPairKeys.length} 种组合。`);
  }
  handleCompletion(analysis);
}

function applyAction(key, action) {
  if (document.querySelector("dialog[open]")) return;
  if (state.completed) {
    showToast("已结账的旅簿请先撤销、重开或换题。", true);
    return;
  }
  const before = snapshot();
  const result = applyEdgeAction(state.puzzle, state.position, key, action);
  if (!result.accepted) {
    playSound("invalid");
    if (result.reason === "occupied") {
      setBoardStatus("排除线只能画在两端都尚未入住的接缝上。", "warning");
      announce("此接缝的房客已经入住，不能画排除线。");
    } else announce("这不是合法的相邻接缝。");
    return;
  }
  state.history.push(before);
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
  state.position = result.position;
  state.moves += 1;
  state.anchor = null;
  const extension = solvePuzzle(state.puzzle, {
    limit: 1,
    requiredRooms: state.position.rooms,
    excluded: state.position.excluded,
  });
  const contradiction = extension.count === 0;
  if (contradiction) state.mistakes += 1;
  playSound(contradiction ? "invalid" : result.effect);
  const visual = edgeVisualElements.get(key);
  visual?.classList.remove("is-pulse");
  window.requestAnimationFrame(() => visual?.classList.add("is-pulse"));
  const removed = result.removedRooms.length + result.removedExclusions.length;
  render();
  if (contradiction) {
    setBoardStatus("这一步让当前笔记无法延伸成完整解，已记作一次误排；可以撤销或继续修正。", "warning");
    announce("当前排房出现逻辑矛盾。");
  } else if (result.effect === "room-added") {
    setBoardStatus(`客房已确定${removed ? `，并原子清理 ${removed} 项重叠判断` : ""}。`);
  } else if (result.effect === "room-removed") setBoardStatus("这间客房已拆除；先前自动清掉的排除线不会恢复。");
  else setBoardStatus(result.effect === "exclusion-added" ? "已画排除封条：这两格不属于同一间房。" : "已擦除排除封条。");
  persistSession();
}

function activateCell(index, action) {
  if (document.querySelector("dialog[open]")) return;
  if (state.anchor === null) {
    state.anchor = index;
    renderBoard();
    setBoardStatus(`已选需求 ${state.puzzle.numbers[index]} 的房客；请选择正交相邻格。`);
    return;
  }
  if (state.anchor === index) {
    state.anchor = null;
    renderBoard();
    setBoardStatus("已取消配房起点。");
    return;
  }
  if (!areOrthogonalNeighbours(state.anchor, index, state.puzzle.width, state.puzzle.height)) {
    state.anchor = index;
    renderBoard();
    setBoardStatus("两格不相邻，已把当前格改为新的配房起点。", "warning");
    return;
  }
  const key = edgeKey(state.anchor, index, state.puzzle.width, state.puzzle.height);
  applyAction(key, action);
}

function toggleNumberHighlight(value) {
  const next = toggleHighlight(state.highlights, value, state.puzzle.order);
  if (next.length === state.highlights.length && !next.every((item, index) => item === state.highlights[index])) {
    state.highlights = [...next];
  } else if (next.length === state.highlights.length && !state.highlights.includes(value) && state.highlights.length >= 2) {
    showToast("最多同时追踪两种需求；请先取消一组。", true);
    playSound("invalid");
    return;
  } else state.highlights = [...next];
  renderBoard();
  const slot = state.highlights.indexOf(value);
  setBoardStatus(slot < 0 ? `已取消需求 ${value} 的追踪。` : `已用${slot === 0 ? "圆印" : "菱印"}标出全部 ${state.puzzle.order + 2} 位需求 ${value} 的房客。`);
}

function setTool(tool, { persist = true } = {}) {
  if (![EDGE_ACTION.ROOM, EDGE_ACTION.EXCLUDE].includes(tool)) return;
  state.tool = tool;
  profile.preferences.tool = tool;
  renderTool();
  if (persist) persistProfile();
  if (state.anchor !== null) setBoardStatus(`配房起点保留；下一格将使用“${tool === EDGE_ACTION.ROOM ? "确定客房" : "排除"}”。`);
}

function rebuildPuzzleSurface() {
  buildBoard();
  buildPairTray();
  buildHighlightButtons();
  elements.boardViewport.scrollTo({ left: 0, top: 0, behavior: "instant" });
  render();
}

function startNewPuzzle({ difficultyId = currentDifficulty().id, ensureUnique = state.puzzle.ensureUnique, advance = true } = {}) {
  flushCompletionOutbox();
  if (elements.victoryDialog.open) closeDialog(elements.victoryDialog);
  const difficulty = difficultyById(difficultyId) ?? DIFFICULTIES[0];
  const key = puzzleCounterKey(difficulty.id, ensureUnique);
  if (advance) profile.counters[key] = Math.min(1000000, (profile.counters[key] ?? 0) + 1);
  profile.preferences.difficulty = difficulty.id;
  profile.preferences.ensureUnique = ensureUnique;
  const puzzle = generateForSettings(difficulty.id, ensureUnique, profile.counters[key] ?? 0);
  state = freshState(puzzle);
  persistProfile();
  rebuildPuzzleSurface();
  persistSession();
  showToast(`${difficulty.label} · ${puzzle.title} 已展开`);
  window.setTimeout(() => setCellFocus(0), 0);
}

function restartPuzzle() {
  flushCompletionOutbox();
  if (elements.victoryDialog.open) closeDialog(elements.victoryDialog);
  state.position = createPosition();
  state.history = [];
  state.moves = 0;
  state.mistakes = 0;
  state.elapsedMs = 0;
  state.startedAt = performance.now();
  state.attemptId = createAttemptId();
  state.completed = false;
  state.completionReported = false;
  state.completionAnnounced = false;
  state.unconfirmedCompletion = null;
  state.anchor = null;
  render();
  persistSession();
  playSound("undo");
  showToast("已按原题重开，seed 与唯一性证明保持不变。", false, 3000);
  setCellFocus(0);
}

function undo() {
  if (!state.history.length) return;
  if (elements.victoryDialog.open) closeDialog(elements.victoryDialog);
  const previous = state.history.pop();
  const mistakes = state.mistakes;
  state.position = previous.position;
  state.moves = previous.moves;
  state.mistakes = mistakes;
  state.completed = false;
  state.completionReported = false;
  state.completionAnnounced = false;
  state.unconfirmedCompletion = null;
  state.startedAt = performance.now();
  state.anchor = null;
  render();
  persistSession();
  playSound("undo");
  setBoardStatus("已完整撤销上一步，包括自动拆房和清除的排除线。", "success");
}

function toggleMute() {
  profile.preferences.muted = !profile.preferences.muted;
  elements.muteButton.setAttribute("aria-pressed", String(profile.preferences.muted));
  elements.muteButton.querySelector("[data-sound-icon]").textContent = profile.preferences.muted ? "×" : "♪";
  elements.muteButton.lastElementChild.textContent = profile.preferences.muted ? "静音" : "声音";
  persistProfile();
  if (!profile.preferences.muted) {
    ensureAudio();
    tone(523, 0.12, { gain: 0.014 });
  }
  showToast(profile.preferences.muted ? "合成音效已静音" : "合成音效已开启");
}

function usableFocusTarget(target) {
  return target instanceof HTMLElement
    && target.isConnected
    && !target.matches(":disabled")
    && !target.closest("[hidden], [inert], [aria-hidden='true']");
}

function focusablesIn(dialog) {
  return [...dialog.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex='-1'])")]
    .filter((item) => !item.closest("[hidden]") && item.getClientRects().length > 0);
}

function openDialog(dialog, trigger = document.activeElement, preferredFocus = null) {
  if (dialog.open || [...document.querySelectorAll("dialog[open]")].some((item) => item !== dialog)) return false;
  modalReturnFocus.set(dialog, usableFocusTarget(trigger) ? trigger : null);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  window.requestAnimationFrame(() => {
    const target = usableFocusTarget(preferredFocus) ? preferredFocus : focusablesIn(dialog)[0];
    target?.focus({ preventScroll: true });
  });
  return true;
}

function closeDialog(dialog, returnValue = "") {
  if (!dialog.open) return;
  if (typeof dialog.close === "function") dialog.close(returnValue);
  else {
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
  }
}

function installDialogLifecycle(dialog, { backdropCloses = true } = {}) {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusables = focusablesIn(dialog);
    if (!focusables.length) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (dialog === elements.tutorialDialog) finishTutorial("skip");
    else closeDialog(dialog, "cancel");
  });
  if (backdropCloses) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      if (!inside) {
        if (dialog === elements.tutorialDialog) finishTutorial("skip");
        else closeDialog(dialog, "backdrop");
      }
    });
  }
  dialog.addEventListener("close", () => {
    const target = modalReturnFocus.get(dialog);
    modalReturnFocus.delete(dialog);
    if (usableFocusTarget(target)) target.focus({ preventScroll: true });
    else cellElements.get(focusedCell)?.focus({ preventScroll: true });
    if (pendingVictory && !document.querySelector("dialog[open]")) {
      pendingVictory = false;
      window.setTimeout(() => openDialog(elements.victoryDialog, elements.newPuzzleButton, elements.victoryStay), 0);
    }
  });
}

function renderTutorial() {
  for (const page of elements.tutorialPages.querySelectorAll("[data-tutorial-page]")) {
    page.hidden = Number(page.dataset.tutorialPage) !== tutorialIndex;
  }
  elements.tutorialCounter.textContent = `${tutorialIndex + 1} / 3`;
  [...elements.tutorialDots.children].forEach((dot, index) => dot.classList.toggle("is-active", index === tutorialIndex));
  elements.tutorialPrevious.disabled = tutorialIndex === 0;
  elements.tutorialNext.textContent = tutorialIndex === 2 ? "开始排房" : "下一张";
  elements.tutorialPages.scrollTop = 0;
}

function openTutorial(auto = false) {
  if (auto && tutorialSeen(localStorageRef)) return;
  tutorialIndex = 0;
  renderTutorial();
  openDialog(elements.tutorialDialog, auto ? cellElements.get(focusedCell) : elements.tutorialButton, elements.tutorialNext);
}

function finishTutorial(reason) {
  markTutorialSeen(localStorageRef);
  closeDialog(elements.tutorialDialog, reason);
}

function nextTutorial() {
  if (tutorialIndex < 2) {
    tutorialIndex += 1;
    renderTutorial();
    return;
  }
  finishTutorial("complete");
}

function previousTutorial() {
  if (tutorialIndex > 0) {
    tutorialIndex -= 1;
    renderTutorial();
  }
}

function sortedGuestKeys() {
  return Object.keys(YOKAI_GUESTS).sort((a, b) => {
    const [al, ah] = a.split("-").map(Number);
    const [bl, bh] = b.split("-").map(Number);
    return (ah - bh) || (al - bl);
  });
}

function renderCompendium() {
  const stats = profile.stats;
  const stars = starSummary(stats);
  elements.compendiumSummary.innerHTML = `
    <div><span>旅店星级</span><strong>${stars.level} / 5</strong></div>
    <div><span>住客组合</span><strong>${stats.compendium.length} / 21</strong></div>
    <div><span>稀有双客</span><strong>${stats.rarePairs.length} / 6</strong></div>`;
  elements.compendiumGrid.innerHTML = sortedGuestKeys().map((key) => {
    const guest = YOKAI_GUESTS[key];
    const unlocked = stats.compendium.includes(key);
    return `<li class="compendium-card ${unlocked ? "is-unlocked" : "is-locked"}">
      ${guest.rare ? '<span class="rare-ribbon">RARE · 双数对</span>' : ""}
      <span class="pair-mark">${key.replace("-", " · ")}</span>
      <b>${unlocked ? guest.name : "未登记住客"}</b>
      <small>${unlocked ? guest.note : `完成包含 ${key.replace("-", "·")} 的旅店规模即可解锁`}</small>
    </li>`;
  }).join("");
}

function buildDifficultyButtons() {
  elements.difficultyButtons.replaceChildren();
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty.id;
    button.setAttribute("aria-pressed", "false");
    button.textContent = difficulty.label;
    button.addEventListener("click", () => {
      if (difficulty.id !== currentDifficulty().id) startNewPuzzle({ difficultyId: difficulty.id, ensureUnique: state.puzzle.ensureUnique });
    });
    elements.difficultyButtons.append(button);
  }
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
}

function onGlobalKeydown(event) {
  if (document.querySelector("dialog[open]") || isTypingTarget(event.target)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (/^[0-5]$/.test(event.key)) {
    const value = Number(event.key);
    if (value <= state.puzzle.order) {
      event.preventDefault();
      toggleNumberHighlight(value);
    }
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    undo();
  } else if (key === "r") {
    event.preventDefault();
    restartPuzzle();
  } else if (key === "n") {
    event.preventDefault();
    startNewPuzzle();
  } else if (key === "d") {
    event.preventDefault();
    setTool(EDGE_ACTION.ROOM);
  } else if (key === "x") {
    event.preventDefault();
    setTool(EDGE_ACTION.EXCLUDE);
  } else if (key === "m") {
    event.preventDefault();
    toggleMute();
  } else if (event.key === "?") {
    event.preventDefault();
    openDialog(elements.rulesDialog, document.activeElement, elements.rulesDialog.querySelector("[data-close-dialog]"));
  }
}

function bindEvents() {
  elements.roomTool.addEventListener("click", () => setTool(EDGE_ACTION.ROOM));
  elements.excludeTool.addEventListener("click", () => setTool(EDGE_ACTION.EXCLUDE));
  elements.undoButton.addEventListener("click", undo);
  elements.restartButton.addEventListener("click", restartPuzzle);
  elements.newPuzzleButton.addEventListener("click", () => startNewPuzzle());
  elements.muteButton.addEventListener("click", toggleMute);
  elements.rulesButton.addEventListener("click", () => openDialog(elements.rulesDialog, elements.rulesButton, elements.rulesDialog.querySelector("[data-close-dialog]")));
  elements.footerRulesButton.addEventListener("click", () => openDialog(elements.rulesDialog, elements.footerRulesButton, elements.rulesDialog.querySelector("[data-close-dialog]")));
  elements.tutorialButton.addEventListener("click", () => openTutorial(false));
  elements.compendiumButton.addEventListener("click", () => {
    renderCompendium();
    openDialog(elements.compendiumDialog, elements.compendiumButton, elements.compendiumDialog.querySelector("[data-close-dialog]"));
  });
  elements.uniqueToggle.addEventListener("change", () => {
    startNewPuzzle({ difficultyId: currentDifficulty().id, ensureUnique: elements.uniqueToggle.checked });
  });
  elements.tutorialSkip.addEventListener("click", () => finishTutorial("skip"));
  elements.tutorialNext.addEventListener("click", nextTutorial);
  elements.tutorialPrevious.addEventListener("click", previousTutorial);
  elements.tutorialPages.addEventListener("pointerdown", (event) => {
    touchStart = { x: event.clientX, y: event.clientY };
  });
  elements.tutorialPages.addEventListener("pointerup", (event) => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    if (dx < 0) nextTutorial();
    else previousTutorial();
  });
  for (const closeButton of document.querySelectorAll("[data-close-dialog]")) {
    closeButton.addEventListener("click", () => closeDialog(closeButton.closest("dialog"), "close"));
  }
  elements.victoryStay.addEventListener("click", () => closeDialog(elements.victoryDialog, "stay"));
  elements.victoryNew.addEventListener("click", () => startNewPuzzle());
  document.addEventListener("keydown", onGlobalKeydown);
  document.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
  document.addEventListener("keydown", ensureAudio, { once: true, capture: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistSession({ announce: false });
  });
  window.addEventListener("pagehide", () => persistSession({ announce: false }));
  reduceMotion.addEventListener("change", () => {
    elements.boardViewport.style.scrollBehavior = reduceMotion.matches ? "auto" : "smooth";
  });

  installDialogLifecycle(elements.tutorialDialog);
  installDialogLifecycle(elements.rulesDialog);
  installDialogLifecycle(elements.compendiumDialog);
  installDialogLifecycle(elements.victoryDialog, { backdropCloses: false });
}

function publicSnapshot() {
  const analysis = analyzePosition(state.puzzle, state.position);
  return Object.freeze({
    version: INTEGRATION_VERSION,
    game: GAME_ID,
    storagePrefix: STORAGE_PREFIX,
    puzzleId: state.puzzle.id,
    attemptId: state.attemptId,
    completionId: currentCompletionId(),
    difficulty: currentDifficulty().id,
    tier: difficultyTier(currentDifficulty().id),
    order: state.puzzle.order,
    seed: state.puzzle.seed,
    ensureUnique: state.puzzle.ensureUnique,
    uniquenessProven: state.puzzle.uniquenessProven,
    moves: state.moves,
    mistakes: state.mistakes,
    complete: analysis.complete,
    roomCount: analysis.roomCount,
    pairCount: analysis.usedPairCount,
    starLevel: profile.stats.starLevel,
    compendiumCount: profile.stats.compendium.length,
  });
}

buildDifficultyButtons();
bindEvents();
rebuildPuzzleSurface();
elements.muteButton.setAttribute("aria-pressed", String(profile.preferences.muted));
elements.muteButton.querySelector("[data-sound-icon]").textContent = profile.preferences.muted ? "×" : "♪";
if ([loadedSession.status, profileResult.status, outboxResult.status].includes("invalid")) {
  showToast("发现损坏的妖怪旅店存档，已安全回到新旅簿。", true, 4200);
}
persistProfile();
persistSession({ announce: false });

const publicApi = Object.freeze({
  version: INTEGRATION_VERSION,
  game: GAME_ID,
  storagePrefix: STORAGE_PREFIX,
  getSnapshot: publicSnapshot,
  getRewardLedger: () => Object.freeze(profile.stats.rewardLedger.map((entry) => Object.freeze({ ...entry }))),
  openTutorial: () => openTutorial(false),
  openRules: () => openDialog(elements.rulesDialog, document.activeElement, elements.rulesDialog.querySelector("[data-close-dialog]")),
  newPuzzle: (options = {}) => startNewPuzzle({
    difficultyId: difficultyById(options.difficulty)?.id ?? currentDifficulty().id,
    ensureUnique: typeof options.ensureUnique === "boolean" ? options.ensureUnique : state.puzzle.ensureUnique,
  }),
  restart: restartPuzzle,
  undo,
});

window.YokaiInn = publicApi;
window.dispatchEvent(new CustomEvent("ten-realms-v2:game-ready", {
  detail: Object.freeze({ version: INTEGRATION_VERSION, game: GAME_ID, api: publicApi }),
}));
window.addEventListener("realm:ready", flushCompletionOutbox);
window.addEventListener("ten-realms-v2:realm-ready", flushCompletionOutbox);
flushCompletionOutbox();

if (!tutorialSeen(localStorageRef)) window.setTimeout(() => openTutorial(true), 360);
