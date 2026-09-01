import {
  PRESETS,
  STATUS,
  applyMove,
  connectedComponent,
  createGame,
  dailySeed,
  isComplete,
  localDayKey,
  markCompletionReported,
  normalizeSeed,
  presetFor,
  puzzleIdFor,
  restartGame,
  undoMove,
} from "./logic.mjs";
import {
  CATALOGUE,
  normalizeRecords,
  recordCompletion,
  recordsSummary,
} from "./rewards.mjs";
import {
  STORAGE_KEYS,
  TUTORIAL_VERSION,
  loadPreferences,
  loadSession,
  readJSON,
  savePreferences,
  saveSession,
  writeJSON,
} from "./storage.mjs";
import {
  completionIdFor,
  createAttemptId,
  createCompletionPayload,
  exposeGameApi,
  flushCompletionReports,
} from "./integration.mjs";
import { createDialogScheduler } from "./dialog-scheduler.mjs";

const DYES = Object.freeze([
  Object.freeze({ name: "春青", season: "春", symbol: "芽", texture: "嫩芽斜纹" }),
  Object.freeze({ name: "夏绯", season: "夏", symbol: "☀", texture: "日轮方纹" }),
  Object.freeze({ name: "秋金", season: "秋", symbol: "叶", texture: "落叶绫纹" }),
  Object.freeze({ name: "冬蓝", season: "冬", symbol: "❄", texture: "雪花格纹" }),
  Object.freeze({ name: "梅紫", season: "梅", symbol: "梅", texture: "梅瓣菱纹" }),
  Object.freeze({ name: "松墨", season: "松", symbol: "松", texture: "松针星纹" }),
]);

const TUTORIAL_SLIDES = Object.freeze([
  Object.freeze({
    title: "先认真实布面与六味季染",
    src: "./assets/tutorial-elements.svg?tutorial=2",
    alt: "四季染坊种子一真实题面左上区域，以及游戏内六味染料的符号与纹理。",
    copy: "图中截取“春绢·从容”种子 1 的真实题面。左上“池”字格是起始染池；只有与它同色且上下左右连通的布格才受控。右侧六味染料与实机符号、纹理一致。",
  }),
  Object.freeze({
    title: "选色，先换色再正交吸收",
    src: "./assets/tutorial-action.svg?tutorial=2",
    alt: "种子一真实题面左上区域：选择春青前受控一格，选择后受控三格并吸收两格。",
    copy: "真实状态中，左上冬蓝染池只有 1 格。点“春青”后，旧染池先整体换成春青，再吸收右邻与下邻两格，变为 3 格。选当前色无效且不计步；其他色即使零扩张，也会计 1 步。",
  }),
  Object.freeze({
    title: "全幅同色，并且不超过步限",
    src: "./assets/tutorial-goal.svg?tutorial=2",
    alt: "春绢从容种子一的真实完成状态：十二乘十二共一百四十四格全为梅紫，二十步不超过二十五步限制。",
    copy: "整幅布只剩一种颜色，且用步不超过本局步限，才算通关。图中是种子 1 的真实参考路线：20 步完成梅紫 144/144，步限为 25；参考路线可靠，但不声称数学最优。",
  }),
]);

const $ = (selector) => document.querySelector(selector);
const elements = {
  board: $("#cloth-board"),
  boardFrame: $("#board-frame"),
  boardHeading: $("#board-heading"),
  boardKicker: $("#board-kicker"),
  boardStatus: $("#board-status"),
  controlled: $("#controlled-value"),
  controlledTotal: $("#controlled-total"),
  moves: $("#moves-value"),
  limit: $("#limit-value"),
  reference: $("#reference-value"),
  clean: $("#clean-value"),
  saveState: $("#save-state"),
  palette: $("#dye-palette"),
  preset: $("#preset-select"),
  seedForm: $("#seed-form"),
  seedInput: $("#seed-input"),
  newPuzzle: $("#new-puzzle-button"),
  daily: $("#daily-button"),
  restart: $("#restart-button"),
  undo: $("#undo-button"),
  mute: $("#mute-button"),
  tutorialButton: $("#tutorial-button"),
  rulesButton: $("#rules-button"),
  tutorialDialog: $("#tutorial-dialog"),
  tutorialScrollBody: $(".tutorial-body"),
  tutorialTitle: $("#tutorial-title"),
  tutorialImage: $("#tutorial-image"),
  tutorialCopy: $("#tutorial-copy"),
  tutorialStep: $("#tutorial-step"),
  tutorialPrev: $("#tutorial-prev"),
  tutorialNext: $("#tutorial-next"),
  tutorialSkip: $("#tutorial-skip"),
  tutorialClose: $("#tutorial-close"),
  tutorialDots: [...document.querySelectorAll(".tutorial-dots i")],
  rulesDialog: $("#rules-dialog"),
  rulesClose: $("#rules-close"),
  victoryDialog: $("#victory-dialog"),
  victoryTitle: $("#victory-title"),
  victoryCopy: $("#victory-copy"),
  victoryMoves: $("#victory-moves"),
  victoryLimit: $("#victory-limit"),
  victoryReference: $("#victory-reference"),
  victoryCatalogue: $("#victory-catalogue"),
  victoryNext: $("#victory-next"),
  victoryStay: $("#victory-stay"),
  failureDialog: $("#failure-dialog"),
  failureCopy: $("#failure-copy"),
  failureContinue: $("#failure-continue"),
  failureUndo: $("#failure-undo"),
  catalogue: $("#catalogue-grid"),
  catalogueCount: $("#catalogue-count"),
  dailyCount: $("#daily-count"),
  best: $("#best-value"),
  toast: $("#toast"),
  live: $("#live-status"),
};

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const dialogFocus = new WeakMap();
const victoryScheduler = createDialogScheduler();
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}

let preferences = loadPreferences(storage);
let records = normalizeRecords(readJSON(storage, STORAGE_KEYS.records));
const restored = loadSession(storage);
let game = restored?.game ?? createGame({ seed: 1, presetId: preferences.presetId });
let context = restored
  ? { mode: restored.mode, day: restored.day, attemptId: restored.attemptId || createAttemptId() }
  : { mode: "seed", day: "", attemptId: createAttemptId() };
let selectedCell = 0;
let tutorialIndex = 0;
let toastTimer = 0;
let animationToken = 0;
let failureShownAt = game.status === STATUS.OVER_LIMIT ? game.moveLimit : -1;

class DyehouseAudio {
  constructor() {
    this.context = null;
    this.master = null;
  }

  unlock() {
    if (preferences.muted) return null;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  }

  setMuted(muted) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.16, now, 0.018);
  }

  tone(frequency, duration, options = {}) {
    const audioContext = this.unlock();
    if (!audioContext || !this.master) return;
    const start = audioContext.currentTime + (options.delay ?? 0);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(Math.max(24, frequency), start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, options.endFrequency), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.11, start + Math.min(0.025, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  expand(colour, amount) {
    const root = 220 + colour * 46;
    this.tone(root, 0.2, { type: "triangle", endFrequency: root * 1.35, volume: 0.09 });
    if (amount > 0) this.tone(root * 1.5, 0.28, { delay: 0.055, endFrequency: root * 1.9, volume: 0.07 });
  }

  noEffect() {
    this.tone(128, 0.08, { type: "square", endFrequency: 112, volume: 0.035 });
  }

  undo() {
    this.tone(520, 0.19, { type: "triangle", endFrequency: 260, volume: 0.08 });
  }

  complete() {
    [261.63, 329.63, 392, 523.25].forEach((frequency, index) => {
      this.tone(frequency, 0.42, { delay: index * 0.09, type: index % 2 ? "sine" : "triangle", volume: 0.09 });
    });
  }

  failed() {
    this.tone(196, 0.3, { type: "triangle", endFrequency: 132, volume: 0.08 });
    this.tone(146, 0.34, { delay: 0.12, endFrequency: 98, volume: 0.06 });
  }
}

const audio = new DyehouseAudio();

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function announce(message) {
  elements.live.textContent = "";
  requestAnimationFrame(() => { elements.live.textContent = message; });
}

function currentPuzzleId() {
  return puzzleIdFor(game, context.mode, context.day);
}

function saveGame(message = "每一步已留存本机") {
  const saved = saveSession(storage, game, context);
  elements.saveState.textContent = saved ? message : "本机存储受限，当前仍可游玩";
  elements.saveState.dataset.state = saved ? "saved" : "limited";
}

function savePrefs() {
  savePreferences(storage, preferences);
}

function saveRecords() {
  const saved = writeJSON(storage, STORAGE_KEYS.records, records);
  if (!saved) {
    elements.saveState.textContent = "本机存储受限，图鉴暂存本页";
    elements.saveState.dataset.state = "limited";
  }
}

function flushPendingCompletions() {
  const result = flushCompletionReports(records);
  if (result.delivered.length) saveRecords();
  return result;
}

function boardStatusText() {
  if (game.status === STATUS.WON) return `合幅完成·${game.moves} 步通关`;
  if (game.status === STATUS.OVER_LIMIT && isComplete(game.board)) return "布面已统一，但本局超出步限";
  if (game.status === STATUS.OVER_LIMIT) return "已超步限·可继续练习合幅";
  return `还可用 ${Math.max(0, game.moveLimit - game.moves)} 步`;
}

function renderBoard(animation = {}) {
  const preset = presetFor(game.presetId);
  const controlled = new Set(connectedComponent(game.board, preset.width, preset.height, 0));
  const recoloured = new Set(animation.recoloured ?? []);
  const absorbed = new Set(animation.absorbed ?? []);
  const waveOrder = new Map((animation.waveOrder ?? []).map((index, order) => [index, order]));
  const fragment = document.createDocumentFragment();
  const activeIndex = Math.min(selectedCell, game.board.length - 1);
  selectedCell = activeIndex;

  for (let row = 0; row < preset.height; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "cloth-row";
    rowElement.setAttribute("role", "row");
    for (let column = 0; column < preset.width; column += 1) {
      const index = row * preset.width + column;
      const colour = game.board[index];
      const dye = DYES[colour];
      const cell = document.createElement("div");
      cell.id = `cloth-cell-${index}`;
      cell.className = "cloth-cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.index = String(index);
      cell.dataset.dye = String(colour);
      cell.dataset.symbol = dye.symbol;
      cell.setAttribute("aria-rowindex", String(row + 1));
      cell.setAttribute("aria-colindex", String(column + 1));
      cell.setAttribute("aria-selected", String(index === activeIndex));
      cell.setAttribute(
        "aria-label",
        `第 ${row + 1} 行第 ${column + 1} 列，${dye.name}，${dye.texture}${controlled.has(index) ? "，已连入起始染池" : ""}`,
      );
      if (controlled.has(index)) cell.classList.add("is-controlled");
      if (index === 0) cell.classList.add("is-origin");
      if (index === activeIndex) cell.classList.add("is-active");
      if (recoloured.has(index)) cell.classList.add("is-recoloured");
      if (absorbed.has(index)) cell.classList.add("is-newly-controlled");
      if (recoloured.has(index) || absorbed.has(index)) {
        const order = waveOrder.get(index) ?? 0;
        cell.style.setProperty("--wave-delay", `${Math.min(order * 18, 260)}ms`);
      }
      const fibreSweep = document.createElement("i");
      fibreSweep.setAttribute("aria-hidden", "true");
      cell.append(fibreSweep);
      rowElement.append(cell);
    }
    fragment.append(rowElement);
  }

  elements.board.replaceChildren(fragment);
  elements.board.style.setProperty("--board-columns", String(preset.width));
  elements.board.setAttribute("aria-rowcount", String(preset.height));
  elements.board.setAttribute("aria-colcount", String(preset.width));
  elements.board.setAttribute("aria-activedescendant", `cloth-cell-${activeIndex}`);
  elements.board.setAttribute("aria-label", `${preset.name}布面，${preset.width} 行 ${preset.height} 列`);
}

function renderPalette() {
  const preset = presetFor(game.presetId);
  const buttons = [...elements.palette.querySelectorAll("[data-colour]")];
  for (let colour = 0; colour < DYES.length; colour += 1) {
    let button = buttons.find((candidate) => Number(candidate.dataset.colour) === colour);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "dye-button";
      button.dataset.colour = String(colour);
      elements.palette.append(button);
    }
    const dye = DYES[colour];
    button.hidden = colour >= preset.colours;
    button.disabled = isComplete(game.board);
    button.dataset.dye = String(colour);
    button.setAttribute("aria-pressed", String(game.board[0] === colour));
    button.setAttribute("aria-label", `${colour + 1} 号染料，${dye.name}，${dye.texture}${game.board[0] === colour ? "，当前色" : ""}`);
    button.innerHTML = `<span class="dye-swatch" data-symbol="${dye.symbol}" aria-hidden="true"></span><span><strong>${dye.name}</strong><small>${dye.texture}</small></span><kbd>${colour + 1}</kbd>`;
  }
}

function renderCatalogue() {
  const summary = recordsSummary(records);
  elements.catalogue.replaceChildren();
  for (const item of CATALOGUE) {
    const unlocked = Boolean(records.catalogue[item.id]);
    const tile = document.createElement("li");
    tile.className = `catalogue-item catalogue-tile catalogue-tile--${item.id}`;
    tile.dataset.unlocked = String(unlocked);
    const seal = document.createElement("i");
    seal.className = "catalogue-tile__seal";
    seal.setAttribute("aria-hidden", "true");
    seal.textContent = unlocked ? "纹" : "锁";
    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = unlocked ? item.name : "待染新纹";
    const hint = document.createElement("small");
    hint.textContent = unlocked ? "已收录·奖励不重复" : item.hint;
    text.append(title, hint);
    tile.append(seal, text);
    tile.setAttribute("aria-label", unlocked ? `已解锁 ${item.name}` : `未解锁：${item.hint}`);
    elements.catalogue.append(tile);
  }
  elements.catalogueCount.textContent = String(summary.catalogueUnlocked);
  elements.dailyCount.textContent = String(summary.dailyCount);
}

function renderAll(animation = {}) {
  const preset = presetFor(game.presetId);
  renderBoard(animation);
  renderPalette();
  renderCatalogue();
  elements.boardKicker.textContent = context.mode === "daily"
    ? `DAILY SWATCH · ${context.day}`
    : `REPRODUCIBLE SEED · ${game.seed}`;
  elements.boardHeading.textContent = `${preset.name}·${context.mode === "daily" ? "今日布样" : `第 ${game.seed} 号布样`}`;
  elements.boardStatus.textContent = boardStatusText();
  elements.boardStatus.dataset.status = game.status;
  elements.controlled.textContent = String(game.controlled);
  if (elements.controlledTotal) elements.controlledTotal.textContent = ` / ${game.board.length}`;
  elements.moves.textContent = String(game.moves);
  elements.limit.textContent = String(game.moveLimit);
  elements.reference.textContent = String(game.referenceMoves);
  elements.clean.textContent = String(game.cleanStreak);
  elements.preset.value = game.presetId;
  elements.seedInput.value = context.mode === "daily" ? context.day : String(game.seed);
  elements.seedInput.disabled = context.mode === "daily";
  elements.undo.disabled = game.timeline.length === 0;
  elements.restart.disabled = game.timeline.length === 0;
  elements.mute.setAttribute("aria-pressed", String(preferences.muted));
  elements.mute.dataset.muted = String(preferences.muted);
  const best = records.bestMoves[currentPuzzleId()];
  elements.best.textContent = Number.isInteger(best) ? `${best} 步` : "—";
  elements.boardFrame.dataset.status = game.status;
}

function animateMove(result) {
  animationToken += 1;
  const token = animationToken;
  renderAll({ recoloured: result.recoloured, absorbed: result.absorbed, waveOrder: result.controlled });
  if (reducedMotion.matches) return;
  window.setTimeout(() => {
    if (token !== animationToken) return;
    elements.board.querySelectorAll(".is-recoloured, .is-newly-controlled").forEach((cell) => {
      cell.classList.remove("is-recoloured", "is-newly-controlled");
    });
  }, 900);
}

function showDialog(dialog, trigger = document.activeElement) {
  if (!dialog || dialog.open) return;
  if (trigger instanceof HTMLElement) dialogFocus.set(dialog, trigger);
  dialog.showModal();
}

function restoreDialogFocus(dialog, fallback = elements.board) {
  const target = dialogFocus.get(dialog);
  dialogFocus.delete(dialog);
  requestAnimationFrame(() => {
    if (target?.isConnected && !target.disabled) target.focus({ preventScroll: true });
    else fallback?.focus?.({ preventScroll: true });
  });
}

function trapDialogFocus(dialog, event) {
  if (event.key !== "Tab") return;
  const focusable = [...dialog.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getClientRects().length > 0);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !dialog.contains(active))) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function settleCompletion() {
  if (game.status !== STATUS.WON || game.reportedCompletionId) return;
  flushPendingCompletions();
  const preset = presetFor(game.presetId);
  const puzzleId = currentPuzzleId();
  const attemptId = context.attemptId;
  const completionId = completionIdFor(puzzleId, attemptId);
  const alreadyReported = Boolean(records.completionReports[completionId]);
  const pendingPayload = records.pendingCompletions[completionId] ?? null;
  const efficient = game.moves <= game.referenceMoves;
  const wasteFree = game.wastes === 0;
  const locallySettled = alreadyReported || Boolean(pendingPayload);
  const settlement = locallySettled
    ? { records, claims: [], newCatalogue: [], personalBest: false }
    : recordCompletion(records, {
      puzzleId,
      presetId: game.presetId,
      moves: game.moves,
      efficient,
      wasteFree,
      maxCleanStreak: game.maxCleanStreak,
      mode: context.mode,
      day: context.day,
    });
  records = settlement.records;
  const payload = pendingPayload ?? createCompletionPayload({
      puzzleId,
      attemptId,
      mode: context.mode,
      day: context.day,
      presetId: game.presetId,
      tier: preset.tier,
      seed: game.seed,
      moves: game.moves,
      moveLimit: game.moveLimit,
      referenceMoves: game.referenceMoves,
      efficient,
      wasteFree,
      maxCleanStreak: game.maxCleanStreak,
      timeline: game.timeline,
      claims: settlement.claims,
    });

  if (!locallySettled) {
    records.pendingCompletions[payload.completionId] = payload;
    saveRecords();
  }

  if (!alreadyReported) flushPendingCompletions();
  const deliveryConfirmed = Boolean(records.completionReports[payload.completionId]);
  saveRecords();
  if (deliveryConfirmed) game = markCompletionReported(game, payload.completionId);
  saveGame(deliveryConfirmed ? "通关与图鉴已留存" : "通关已留存，等待共享奖励桥接");
  renderAll();

  elements.victoryTitle.textContent = efficient ? "一染成锦" : "四季合幅";
  elements.victoryCopy.textContent = wasteFree
    ? "每一次落染都让连通布面扩张，这是一匹无空染的成布。"
    : "整幅织物在步限内归于同一色系，新布样已编入本地档案。";
  elements.victoryMoves.textContent = String(game.moves);
  elements.victoryLimit.textContent = String(game.moveLimit);
  elements.victoryReference.textContent = String(game.referenceMoves);
  elements.victoryCatalogue.textContent = settlement.newCatalogue.length
    ? settlement.newCatalogue.map(({ name }) => name).join("、")
    : settlement.personalBest ? "刷新了这匹布的最佳步数" : "本局奖励已去重留存";
  audio.complete();
  victoryScheduler.schedule(
    reducedMotion.matches ? 0 : 360,
    () => (
      game.status === STATUS.WON
      && context.attemptId === attemptId
      && (!deliveryConfirmed || game.reportedCompletionId === payload.completionId)
      && currentPuzzleId() === puzzleId
      && !anyDialogOpen()
    ),
    () => showDialog(elements.victoryDialog, elements.board),
  );
}

function showFailure() {
  failureShownAt = game.moves;
  elements.failureCopy.textContent = `本局限制 ${game.moveLimit} 步，布面尚未统一。依照原版 Flood，你仍可继续染到合幅，但超限合幅不计通关。`;
  audio.failed();
  showDialog(elements.failureDialog, elements.board);
}

function chooseColour(colour, options = {}) {
  const previousStatus = game.status;
  const result = applyMove(game, colour);
  if (!result.accepted) {
    if (result.reason === "same-colour") {
      audio.noEffect();
      showToast("已是当前染色：不改布面，也不计步");
      announce("选择了当前色，本次操作无效且不计步。");
    } else if (result.reason === "history-limit") {
      showToast("练习记录已达 512 步，请撤销或重开布样");
      announce("本布样的本地练习记录已达 512 步，本次操作未计步。");
    }
    return;
  }
  game = result.state;
  audio.expand(colour, result.expandedBy);
  animateMove(result);
  saveGame();
  const message = result.expandedBy > 0
    ? `${DYES[colour].name}染入，新连入 ${result.expandedBy} 格，已用 ${game.moves} 步。`
    : `${DYES[colour].name}未吸收新布格，仍计 1 步，无浪费连续已中断。`;
  announce(message);
  if (result.expandedBy === 0) showToast("这次染色未扩张，但依原规则计 1 步");

  if (game.status === STATUS.WON && previousStatus !== STATUS.WON) {
    settleCompletion();
  } else if (
    game.status === STATUS.OVER_LIMIT
    && previousStatus !== STATUS.OVER_LIMIT
    && !isComplete(game.board)
    && failureShownAt < game.moveLimit
  ) {
    showFailure();
  }
  if (options.focusBoard) elements.board.focus({ preventScroll: true });
}

function startPuzzle(seed, presetId, nextContext = { mode: "seed", day: "" }, options = {}) {
  flushPendingCompletions();
  victoryScheduler.cancel();
  if (elements.victoryDialog.open) elements.victoryDialog.close();
  if (elements.failureDialog.open) elements.failureDialog.close();
  game = createGame({ seed, presetId });
  context = {
    mode: nextContext.mode === "daily" ? "daily" : "seed",
    day: nextContext.day ?? "",
    attemptId: createAttemptId(),
  };
  selectedCell = 0;
  failureShownAt = -1;
  preferences = { ...preferences, presetId: game.presetId };
  savePrefs();
  saveGame("新布样已留存");
  animationToken += 1;
  renderAll();
  announce(`已展开 ${presetFor(game.presetId).name}，步限 ${game.moveLimit}。`);
  if (options.focus !== false) elements.board.focus({ preventScroll: true });
}

function restartCurrent(options = {}) {
  flushPendingCompletions();
  victoryScheduler.cancel();
  if (elements.victoryDialog.open) elements.victoryDialog.close();
  if (elements.failureDialog.open) elements.failureDialog.close();
  game = restartGame(game);
  context = { ...context, attemptId: createAttemptId() };
  selectedCell = 0;
  failureShownAt = -1;
  animationToken += 1;
  saveGame("已恢复本匹初始布面");
  renderAll();
  announce("已重新展开本匹布样。");
  if (options.focus !== false) elements.board.focus({ preventScroll: true });
}

function undoCurrent(options = {}) {
  if (!game.timeline.length) return;
  flushPendingCompletions();
  const revisingCompletedRun = game.status === STATUS.WON || Boolean(game.reportedCompletionId);
  victoryScheduler.cancel();
  if (elements.victoryDialog.open) elements.victoryDialog.close();
  if (elements.failureDialog.open) elements.failureDialog.close();
  game = undoMove(game);
  if (revisingCompletedRun) context = { ...context, attemptId: createAttemptId() };
  failureShownAt = game.status === STATUS.OVER_LIMIT ? game.moves : -1;
  animationToken += 1;
  audio.undo();
  saveGame("已撤销上一次有效染色");
  renderAll();
  announce(`已撤销，回到 ${game.moves} 步。`);
  if (options.focus !== false) elements.board.focus({ preventScroll: true });
}

function moveVirtualCursor(key) {
  const preset = presetFor(game.presetId);
  const row = Math.floor(selectedCell / preset.width);
  const column = selectedCell % preset.width;
  if (key === "ArrowUp" || key.toLowerCase() === "w") selectedCell = Math.max(0, row - 1) * preset.width + column;
  else if (key === "ArrowDown" || key.toLowerCase() === "s") selectedCell = Math.min(preset.height - 1, row + 1) * preset.width + column;
  else if (key === "ArrowLeft" || key.toLowerCase() === "a") selectedCell = row * preset.width + Math.max(0, column - 1);
  else if (key === "ArrowRight" || key.toLowerCase() === "d") selectedCell = row * preset.width + Math.min(preset.width - 1, column + 1);
  else if (key === "Home") selectedCell = 0;
  else if (key === "End") selectedCell = game.board.length - 1;
  else return false;
  renderBoard();
  return true;
}

function renderTutorialSlide() {
  const slide = TUTORIAL_SLIDES[tutorialIndex];
  elements.tutorialTitle.textContent = slide.title;
  elements.tutorialImage.src = slide.src;
  elements.tutorialImage.alt = slide.alt;
  elements.tutorialCopy.textContent = slide.copy;
  elements.tutorialStep.textContent = `${tutorialIndex + 1} / ${TUTORIAL_SLIDES.length}`;
  elements.tutorialPrev.disabled = tutorialIndex === 0;
  elements.tutorialNext.textContent = tutorialIndex === TUTORIAL_SLIDES.length - 1 ? "开始染色" : "下一张";
  elements.tutorialDots.forEach((dot, index) => dot.classList.toggle("is-current", index === tutorialIndex));
  elements.tutorialDialog.scrollTop = 0;
  elements.tutorialScrollBody.scrollTop = 0;
}

function openTutorial(trigger = document.activeElement) {
  tutorialIndex = 0;
  renderTutorialSlide();
  showDialog(elements.tutorialDialog, trigger);
}

function closeTutorial() {
  preferences = { ...preferences, tutorialVersion: TUTORIAL_VERSION };
  savePrefs();
  if (elements.tutorialDialog.open) elements.tutorialDialog.close();
}

function anyDialogOpen() {
  return Boolean(document.querySelector("dialog[open]"));
}

elements.board.addEventListener("click", (event) => {
  const cell = event.target.closest(".cloth-cell");
  if (!cell || !elements.board.contains(cell)) return;
  selectedCell = Number(cell.dataset.index);
  chooseColour(game.board[selectedCell]);
});

elements.board.addEventListener("keydown", (event) => {
  if (moveVirtualCursor(event.key)) {
    event.preventDefault();
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    chooseColour(game.board[selectedCell], { focusBoard: true });
  }
});

elements.palette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-colour]");
  if (!button || button.hidden || button.disabled) return;
  chooseColour(Number(button.dataset.colour));
});

elements.preset.addEventListener("change", () => {
  startPuzzle(game.seed, elements.preset.value, { mode: "seed", day: "" });
});

elements.seedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startPuzzle(normalizeSeed(elements.seedInput.value), game.presetId, { mode: "seed", day: "" });
});

elements.newPuzzle.addEventListener("click", () => {
  startPuzzle((game.seed + 1) >>> 0, game.presetId, { mode: "seed", day: "" });
});

elements.daily.addEventListener("click", () => {
  const day = localDayKey();
  startPuzzle(dailySeed(day), "12x12-medium", { mode: "daily", day });
});

elements.restart.addEventListener("click", () => restartCurrent());
elements.undo.addEventListener("click", () => undoCurrent());
elements.mute.addEventListener("click", () => {
  preferences = { ...preferences, muted: !preferences.muted };
  audio.setMuted(preferences.muted);
  savePrefs();
  renderPalette();
  elements.mute.setAttribute("aria-pressed", String(preferences.muted));
  elements.mute.dataset.muted = String(preferences.muted);
  showToast(preferences.muted ? "合成音效已静音" : "合成音效已开启");
});
elements.tutorialButton.addEventListener("click", (event) => openTutorial(event.currentTarget));
elements.rulesButton.addEventListener("click", (event) => showDialog(elements.rulesDialog, event.currentTarget));
document.querySelectorAll("[data-open-rules]").forEach((button) => {
  button.addEventListener("click", (event) => showDialog(elements.rulesDialog, event.currentTarget));
});

elements.tutorialPrev.addEventListener("click", () => {
  tutorialIndex = Math.max(0, tutorialIndex - 1);
  renderTutorialSlide();
});
elements.tutorialNext.addEventListener("click", () => {
  if (tutorialIndex === TUTORIAL_SLIDES.length - 1) closeTutorial();
  else {
    tutorialIndex += 1;
    renderTutorialSlide();
  }
});
elements.tutorialSkip.addEventListener("click", closeTutorial);
elements.tutorialClose.addEventListener("click", closeTutorial);
elements.rulesClose.addEventListener("click", () => elements.rulesDialog.close());

elements.victoryNext.addEventListener("click", () => {
  elements.victoryDialog.close();
  startPuzzle((game.seed + 1) >>> 0, game.presetId, { mode: "seed", day: "" });
});
elements.victoryStay.addEventListener("click", () => elements.victoryDialog.close());
elements.failureContinue.addEventListener("click", () => elements.failureDialog.close());
elements.failureUndo.addEventListener("click", () => {
  elements.failureDialog.close();
  undoCurrent();
});

for (const [dialog, fallback] of [
  [elements.tutorialDialog, elements.palette.querySelector("button")],
  [elements.rulesDialog, elements.rulesButton],
  [elements.victoryDialog, elements.board],
  [elements.failureDialog, elements.board],
]) {
  dialog.addEventListener("keydown", (event) => trapDialogFocus(dialog, event));
  dialog.addEventListener("close", () => {
    if (dialog === elements.tutorialDialog && preferences.tutorialVersion !== TUTORIAL_VERSION) {
      preferences = { ...preferences, tutorialVersion: TUTORIAL_VERSION };
      savePrefs();
    }
    restoreDialogFocus(dialog, fallback);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog || dialog === elements.failureDialog || dialog === elements.victoryDialog) return;
    if (dialog === elements.tutorialDialog) closeTutorial();
    else dialog.close();
  });
}

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  if (anyDialogOpen()) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoCurrent();
    return;
  }
  const key = event.key.toLowerCase();
  if (/^[1-6]$/.test(event.key)) {
    const colour = Number(event.key) - 1;
    if (colour < presetFor(game.presetId).colours) {
      event.preventDefault();
      chooseColour(colour);
    }
  } else if (key === "u" || key === "z") {
    event.preventDefault();
    undoCurrent();
  } else if (key === "r") {
    event.preventDefault();
    restartCurrent();
  } else if (key === "n") {
    event.preventDefault();
    startPuzzle((game.seed + 1) >>> 0, game.presetId, { mode: "seed", day: "" });
  } else if (key === "m") {
    event.preventDefault();
    elements.mute.click();
  } else if (event.key === "?") {
    event.preventDefault();
    openTutorial(elements.tutorialButton);
  }
});

document.addEventListener("pointerdown", () => audio.unlock(), { once: true, capture: true });
document.addEventListener("keydown", () => audio.unlock(), { once: true, capture: true });
window.addEventListener("realm:ready", flushPendingCompletions);
window.addEventListener("ten-realms-v2:realm-ready", flushPendingCompletions);

renderAll();
saveGame(restored ? "已恢复上次染色进度" : "新布样已留存");
flushPendingCompletions();

if (game.status === STATUS.WON && !game.reportedCompletionId) {
  settleCompletion();
}

exposeGameApi({
  getSnapshot: () => ({
    gameId: "season-dyehouse",
    puzzleId: currentPuzzleId(),
    mode: context.mode,
    day: context.day,
    presetId: game.presetId,
    seed: game.seed,
    moves: game.moves,
    moveLimit: game.moveLimit,
    referenceMoves: game.referenceMoves,
    status: game.status,
    controlled: game.controlled,
    wastes: game.wastes,
  }),
  getRecords: () => structuredClone(records),
  startPuzzle: ({ seed = 1, presetId = game.presetId } = {}) => startPuzzle(seed, presetId, { mode: "seed", day: "" }),
  openTutorial: () => openTutorial(elements.tutorialButton),
});

if (preferences.tutorialVersion !== TUTORIAL_VERSION) {
  requestAnimationFrame(() => openTutorial(null));
}
