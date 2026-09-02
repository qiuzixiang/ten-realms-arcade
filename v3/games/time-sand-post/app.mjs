import {
  DIRECTIONS,
  applyLink,
  candidateTargets,
  clearAlgebraicChain,
  clearCell,
  connectionSegment,
  deriveLabels,
  evaluatePosition,
  givenMaps,
  linksOf,
  snapshotPosition,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  findLevel,
  levelsForDifficulty,
  nextLevel,
} from "./levels.mjs";
import {
  HISTORY_LIMIT,
  STORAGE_KEYS,
  createRunId,
  createSession,
  enqueueOutbox,
  loadOutbox,
  loadRecords,
  loadSession,
  loadSettings,
  markTutorialSeen,
  recordCompletion,
  removeFromOutbox,
  saveRecords,
  saveSession,
  saveSettings,
  tutorialSeen,
} from "./storage.mjs";
import {
  createCompletion,
  deliverCompletion,
  normalizeCompletion,
} from "./completion.mjs";

const TUTORIAL_CARDS = Object.freeze([
  Object.freeze({
    image: "./assets/tutorial-elements.svg?tutorial=2",
    alt: "晨钟首邮真实初始棋盘：十六座驿站、八枚固定时间戳，以及规则自动接通的 4 到 5、15 到 16 两段邮路",
    tag: "01 · 认识驿站",
    title: "先看时间戳，再看八向箭头",
    body: "金色数字是不可移动的时间戳；相邻时间戳方向正确时，上游规则会自动接线。其余箭头规定下一站所在射线。",
    bullets: ["开局已自动接通 4→5 与 15→16", "目标可以跨越多格，但不能偏离箭头方向"],
  }),
  Object.freeze({
    image: "./assets/tutorial-action.svg?tutorial=2",
    alt: "晨钟首邮的一次真实操作：从时间戳 1 向南连到第 2 站",
    tag: "02 · 接通邮路",
    title: "点起点，再点同射线目标",
    body: "首关的时间戳 1 箭头向南。先点 1，再点它正下方的驿站，就接出真实的第一段 1→2。",
    bullets: ["操作后棋盘共有三段：两段自动线与新建的 1→2", "代数短链会显示 a、a+1，接到时间戳后再变成数字"],
  }),
  Object.freeze({
    image: "./assets/tutorial-goal.svg?tutorial=2",
    alt: "晨钟首邮的真实唯一解：全部十六座驿站已从 1 连续接到 16",
    tag: "03 · 抵达终钟",
    title: "所有驿站必须只属于一条链",
    body: "画面是首关由同一规则引擎验证通过的完成状态。从 1 出发恰好访问全部 16 站，并在 16 终止才算送达。",
    bullets: ["每站最多一个前驱、一个后继", "无冲突但仍分成多条短链，不算通关"],
  }),
]);

const DIFFICULTY_LABELS = Object.freeze({ easy: "入门", medium: "进阶", hard: "秘境" });
const $ = (selector) => document.querySelector(selector);
const elements = Object.freeze({
  board: $("#post-board"),
  boardShell: $("#board-shell"),
  connections: $("#connection-layer"),
  newLevel: $("#new-level-button"),
  undo: $("#undo-button"),
  restart: $("#restart-button"),
  tutorial: $("#tutorial-button"),
  rules: $("#rules-button"),
  clear: $("#clear-button"),
  clearChain: $("#clear-chain-button"),
  difficultyButtons: $("#difficulty-buttons"),
  difficultyNote: $("#difficulty-note"),
  levelButtons: $("#level-buttons"),
  levelKicker: $("#level-kicker"),
  levelTitle: $("#level-title"),
  levelSubtitle: $("#level-subtitle"),
  levelNote: $("#level-note"),
  levelSeed: $("#level-seed"),
  linkCount: $("#link-count"),
  linkTotal: $("#link-total"),
  numberedCount: $("#numbered-count"),
  cellTotal: $("#cell-total"),
  chainCount: $("#chain-count"),
  moveCount: $("#move-count"),
  statusCard: $("#status-card"),
  statusTitle: $("#status-title"),
  statusCopy: $("#status-copy"),
  archiveList: $("#archive-list"),
  clearCount: $("#clear-count"),
  winCount: $("#win-count"),
  bestMoves: $("#best-moves"),
  archiveTutorial: $("#archive-tutorial-button"),
  saveMessage: $("#save-message"),
  rulesDialog: $("#rules-dialog"),
  rulesClose: $("#rules-close-button"),
  tutorialDialog: $("#tutorial-dialog"),
  tutorialSkip: $("#tutorial-skip-button"),
  tutorialPrevious: $("#tutorial-previous-button"),
  tutorialNext: $("#tutorial-next-button"),
  tutorialImage: $("#tutorial-image"),
  tutorialStep: $("#tutorial-step"),
  tutorialTitle: $("#tutorial-title"),
  tutorialBody: $("#tutorial-body"),
  tutorialBullets: $("#tutorial-bullets"),
  tutorialCounter: $("#tutorial-counter"),
  tutorialAnnouncement: $("#tutorial-announcement"),
  victoryDialog: $("#victory-dialog"),
  victoryLevel: $("#victory-level"),
  victoryMoves: $("#victory-moves"),
  victoryPar: $("#victory-par"),
  victoryTime: $("#victory-time"),
  victoryCopy: $("#victory-copy"),
  victoryReward: $("#victory-reward"),
  nextLevel: $("#next-level-button"),
  stay: $("#stay-button"),
  toast: $("#toast"),
  assertive: $("#assertive-status"),
});

const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();

function entropy() {
  try { return window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2); }
  catch { return Math.random().toString(36).slice(2); }
}

function freshSession(level) {
  return createSession(level, createRunId(Date.now(), entropy()));
}

const settings = loadSettings(storage);
const storedSessionRaw = (() => {
  try { return storage?.getItem?.(STORAGE_KEYS.session) ?? null; } catch { return null; }
})();
const restored = loadSession(storage, findLevel);
const fallbackLevel = findLevel(settings.lastLevelId)
  ?? levelsForDifficulty(settings.difficulty)[0]
  ?? LEVELS[0];
const initialSession = restored ?? freshSession(fallbackLevel);
const initialEvaluation = evaluatePosition(initialSession.level, initialSession.position);

const state = {
  level: initialSession.level,
  runId: initialSession.runId,
  position: initialSession.position,
  timeline: initialSession.timeline,
  history: initialSession.history,
  moves: initialSession.moves,
  activeCell: initialSession.activeCell,
  selectedFrom: initialSession.selectedFrom,
  completion: initialEvaluation.complete ? initialSession.completion : null,
  completed: initialEvaluation.complete,
  elapsedBase: initialSession.elapsedMs,
  startedAt: performance.now(),
  finishedElapsed: initialEvaluation.complete ? initialSession.elapsedMs : null,
  tutorialIndex: 0,
  statusOverride: null,
};

let records = loadRecords(storage, findLevel);
let toastTimer = 0;
let statusTimer = 0;
let tutorialGeneration = 0;
const dialogTriggers = new WeakMap();
const outboxValidator = (payload) => normalizeCompletion(payload);

function elapsedMs() {
  if (state.finishedElapsed !== null) return state.finishedElapsed;
  return Math.floor(state.elapsedBase + Math.max(0, performance.now() - state.startedAt));
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function showToast(message, assertive = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  if (assertive) elements.assertive.textContent = message;
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function setTemporaryStatus(title, copy, kind = "calm") {
  window.clearTimeout(statusTimer);
  state.statusOverride = { title, copy, kind };
  renderStatus();
  statusTimer = window.setTimeout(() => {
    state.statusOverride = null;
    renderStatus();
  }, 2800);
}

function sessionSnapshot() {
  return {
    version: 1,
    level: state.level,
    runId: state.runId,
    position: state.position,
    timeline: state.timeline,
    history: state.history,
    moves: state.moves,
    elapsedMs: elapsedMs(),
    activeCell: state.activeCell,
    selectedFrom: state.selectedFrom,
    completion: state.completion,
  };
}

function persistSession(message = "进度已存入本机邮袋") {
  const saved = saveSession(storage, sessionSnapshot());
  elements.saveMessage.textContent = saved ? message : "无法写入本机，本局仍可继续";
  return saved;
}

function persistSettings() {
  return saveSettings(storage, {
    version: 1,
    difficulty: state.level.difficulty,
    lastLevelId: state.level.id,
  });
}

function pushHistory() {
  state.history = [...state.history, { position: state.position, moves: state.moves }].slice(-HISTORY_LIMIT);
}

function statusForReason(reason) {
  return {
    "off-ray": ["目标偏离时流", "后继驿站必须位于起点箭头的严格射线上。"],
    cycle: ["不能提前闭合", "这两站已属于同一短链，相接会把未完成邮路锁成小环。"],
    "stamp-order": ["当前数字顺序冲突", "两个已定序端点只有相差 1 时才能直接相接。"],
    terminal: ["终钟不再发件", "最后一枚时间戳没有后继驿站。"],
    "before-start": ["不能接入时间戳 1", "时间戳 1 是整条邮路唯一的起点。"],
    "already-linked": ["这段邮路已接通", "当前状态没有改变，也不会增加操作数。"],
  }[reason] ?? ["这段邮路暂不合法", "局面保持原状，请重新检查箭头和时间戳。"];
}

function legalTargets() {
  if (state.selectedFrom === null || state.completed) return new Set();
  return new Set(candidateTargets(state.level, state.selectedFrom).filter((target) => (
    applyLink(state.level, state.position, state.selectedFrom, target).changed
  )));
}

function renderBoard() {
  const evaluation = evaluatePosition(state.level, state.position);
  const labels = deriveLabels(state.level, state.position);
  const { numberByCell } = givenMaps(state.level);
  const targets = legalTargets();
  const total = state.level.width * state.level.height;
  elements.boardShell.style.setProperty("--cols", String(state.level.width));
  elements.boardShell.style.setProperty("--rows", String(state.level.height));
  elements.board.style.setProperty("--cols", String(state.level.width));
  elements.board.style.setProperty("--rows", String(state.level.height));
  elements.board.setAttribute("aria-rowcount", String(state.level.height));
  elements.board.setAttribute("aria-colcount", String(state.level.width));

  const cells = [];
  for (let index = 0; index < total; index += 1) {
    const direction = state.level.directions[index];
    const given = numberByCell[index];
    const rawNumber = labels.numbers[index];
    const displayLabel = labels.displayLabels[index];
    const button = document.createElement("button");
    const row = Math.floor(index / state.level.width) + 1;
    const column = (index % state.level.width) + 1;
    button.type = "button";
    button.className = "post-cell";
    button.dataset.index = String(index);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-rowindex", String(row));
    button.setAttribute("aria-colindex", String(column));
    button.tabIndex = index === state.activeCell ? 0 : -1;
    if (index === state.selectedFrom) button.classList.add("is-selected");
    if (targets.has(index)) button.classList.add("is-target");
    if (state.position.next[index] !== -1 || state.position.previous[index] !== -1) button.classList.add("is-connected");
    if (direction === null) button.classList.add("is-terminal");
    if (state.position.previous[index] !== -1) button.classList.add("has-previous");
    if (labels.errorCells.includes(index)) button.classList.add("is-error");
    if (state.completed) button.classList.add("is-complete");
    const parts = [`第 ${row} 行第 ${column} 列`];
    if (given) parts.push(`固定时间戳 ${given}`);
    else if (rawNumber > 0 && rawNumber <= total) parts.push(`推定序号 ${rawNumber}`);
    else if (rawNumber < 0) parts.push(`错误序号 ${rawNumber}`);
    else if (rawNumber === 0 && (state.position.next[index] !== -1 || state.position.previous[index] !== -1)) parts.push("错误序号 0");
    else if (displayLabel) parts.push(`代数短链标记 ${displayLabel}`);
    else parts.push("未定序驿站");
    parts.push(direction ? `${DIRECTIONS[direction].label}箭头` : "终点");
    if (state.position.previous[index] !== -1) parts.push(`前站为 ${state.position.previous[index] + 1} 号格`);
    if (state.position.next[index] !== -1) parts.push(`后站为 ${state.position.next[index] + 1} 号格`);
    if (targets.has(index)) parts.push("当前可连");
    if (labels.errorCells.includes(index)) parts.push("当前存在数字或方向错误");
    button.setAttribute("aria-label", parts.join("，"));
    const arrow = document.createElement("span");
    arrow.className = "post-cell__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = direction ? DIRECTIONS[direction].glyph : "◈";
    const number = document.createElement("span");
    number.className = "post-cell__number";
    number.setAttribute("aria-hidden", "true");
    if (given) number.classList.add("is-given");
    else if (rawNumber > 0 && rawNumber <= total) number.classList.add("is-derived");
    else if (rawNumber <= 0 && (state.position.next[index] !== -1 || state.position.previous[index] !== -1)) number.classList.add("is-error-number");
    else if (rawNumber > total) number.classList.add("is-algebraic");
    number.textContent = String(given || displayLabel || (rawNumber === 0 && labels.errorCells.includes(index) ? "0" : ""));
    const port = document.createElement("span");
    port.className = "post-cell__need";
    port.setAttribute("aria-hidden", "true");
    button.append(arrow, number, port);
    cells.push(button);
  }
  elements.board.replaceChildren(...cells);

  elements.connections.setAttribute("viewBox", `0 0 ${state.level.width} ${state.level.height}`);
  elements.connections.textContent = "";
  const svgNamespace = "http://www.w3.org/2000/svg";
  const maskId = "time-sand-route-cutouts";
  const definitions = document.createElementNS(svgNamespace, "defs");
  const mask = document.createElementNS(svgNamespace, "mask");
  mask.id = maskId;
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  const maskBase = document.createElementNS(svgNamespace, "rect");
  maskBase.setAttribute("width", String(state.level.width));
  maskBase.setAttribute("height", String(state.level.height));
  maskBase.setAttribute("fill", "white");
  mask.append(maskBase);
  for (let cell = 0; cell < total; cell += 1) {
    const rawNumber = labels.numbers[cell];
    const hasVisibleNumber = Boolean(
      numberByCell[cell]
      || labels.displayLabels[cell]
      || (rawNumber === 0 && evaluation.errorCells.includes(cell)),
    );
    if (!hasVisibleNumber) continue;
    const cutout = document.createElementNS(svgNamespace, "circle");
    cutout.setAttribute("cx", String((cell % state.level.width) + 0.5));
    cutout.setAttribute("cy", String(Math.floor(cell / state.level.width) + 0.5));
    cutout.setAttribute("r", ".38");
    cutout.setAttribute("fill", "black");
    mask.append(cutout);
  }
  definitions.append(mask);
  const routeGroup = document.createElementNS(svgNamespace, "g");
  routeGroup.setAttribute("mask", `url(#${maskId})`);
  elements.connections.append(definitions, routeGroup);
  for (let from = 0; from < state.position.next.length; from += 1) {
    const to = state.position.next[from];
    if (to === -1) continue;
    const line = document.createElementNS(svgNamespace, "line");
    line.classList.add("connection-line");
    if (evaluation.complete) line.classList.add("is-complete");
    if (evaluation.errorCells.includes(from) || evaluation.errorCells.includes(to)) line.classList.add("is-error");
    const segment = connectionSegment(state.level, from, to);
    if (!segment) continue;
    line.setAttribute("x1", String(segment.x1));
    line.setAttribute("y1", String(segment.y1));
    line.setAttribute("x2", String(segment.x2));
    line.setAttribute("y2", String(segment.y2));
    routeGroup.append(line);
    const dot = document.createElementNS(svgNamespace, "circle");
    dot.classList.add("connection-node");
    dot.setAttribute("cx", String((to % state.level.width) + 0.5));
    dot.setAttribute("cy", String(Math.floor(to / state.level.width) + 0.5));
    dot.setAttribute("r", ".39");
    elements.connections.append(dot);
  }
}

function renderSelectors() {
  elements.difficultyButtons.replaceChildren(...DIFFICULTIES.map((difficulty) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty.id;
    button.textContent = difficulty.label;
    button.setAttribute("aria-pressed", String(difficulty.id === state.level.difficulty));
    return button;
  }));
  const difficulty = DIFFICULTIES.find((item) => item.id === state.level.difficulty);
  elements.difficultyNote.textContent = difficulty?.note ?? "";
  elements.levelButtons.replaceChildren(...levelsForDifficulty(state.level.difficulty).map((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.levelId = level.id;
    button.textContent = `${String(index + 1).padStart(2, "0")} · ${level.title}`;
    button.setAttribute("aria-pressed", String(level.id === state.level.id));
    return button;
  }));
}

function renderMission() {
  elements.levelKicker.textContent = `${state.level.difficulty.toUpperCase()} · CHRONO MAIL`;
  elements.levelTitle.textContent = state.level.title;
  elements.levelSubtitle.textContent = state.level.subtitle;
  elements.levelNote.textContent = state.level.note;
  elements.levelSeed.textContent = `SEED · ${state.level.seed}`;
}

function renderMetrics() {
  const evaluation = evaluatePosition(state.level, state.position);
  const total = state.level.width * state.level.height;
  elements.linkCount.textContent = String(evaluation.linkCount);
  elements.linkTotal.textContent = ` / ${total - 1}`;
  elements.numberedCount.textContent = String(evaluation.numberedCount);
  elements.cellTotal.textContent = ` / ${total}`;
  elements.chainCount.textContent = String(evaluation.chainCount);
  elements.moveCount.textContent = String(state.moves);
  elements.undo.disabled = !state.history.length;
  elements.clear.disabled = state.completed;
  elements.clearChain.disabled = state.completed;
}

function renderStatus() {
  const evaluation = evaluatePosition(state.level, state.position);
  let status = state.statusOverride;
  if (!status && state.completed) status = { title: "终钟已签收", copy: `全部 ${state.level.width * state.level.height} 站已连成唯一邮路。`, kind: "complete" };
  if (!status && evaluation.hasErrors) status = { title: "邮路出现红色错序", copy: "这是上游允许形成的错误态：可撤销、拆单格，或拆除整条代数链后继续。", kind: "invalid" };
  if (!status && evaluation.impossible) status = { title: "已记录一次短链矛盾", copy: "这是上游保留的诊断标记，不会冒充当前红色错误，也不会阻止你拆错线后完成邮路。", kind: "warning" };
  if (!status && state.selectedFrom !== null) {
    const count = legalTargets().size;
    status = { title: `已选第 ${state.selectedFrom + 1} 号驿站`, copy: count ? `再点一个青色高亮目标；当前有 ${count} 个合法落点。` : "当前没有可接目标，可按 Esc 取消或拆除该站连线。", kind: "selected" };
  }
  if (!status && evaluation.linkCount) status = { title: `时邮链已接通 ${evaluation.linkCount} 段`, copy: `还有 ${state.level.width * state.level.height - 1 - evaluation.linkCount} 段待校准；独立短链仍有 ${evaluation.chainCount} 条。`, kind: "progress" };
  if (!status) status = { title: "等待首段邮路", copy: "先点时间戳 1，再点它箭头射线上的后继驿站。", kind: "calm" };
  elements.statusCard.dataset.kind = status.kind;
  elements.statusTitle.textContent = status.title;
  elements.statusCopy.textContent = status.copy;
}

function renderArchive() {
  elements.archiveList.replaceChildren(...LEVELS.map((level) => {
    const record = records.levels[level.id];
    const item = document.createElement("li");
    if (record) item.classList.add("is-cleared");
    item.innerHTML = "<i aria-hidden=\"true\"></i><span><b></b><small></small></span>";
    item.querySelector("i").textContent = record ? "✓" : "·";
    item.querySelector("b").textContent = level.title;
    item.querySelector("small").textContent = record ? `${record.wins} 次送达 · 最佳 ${record.bestMoves} 步` : `${DIFFICULTY_LABELS[level.difficulty]} · 待签收`;
    return item;
  }));
  elements.clearCount.textContent = String(Object.keys(records.levels).length);
  elements.winCount.textContent = String(records.totalWins);
  const current = records.levels[state.level.id];
  elements.bestMoves.textContent = current ? `${current.bestMoves} 步` : "—";
}

function render() {
  renderSelectors();
  renderMission();
  renderBoard();
  renderMetrics();
  renderStatus();
  renderArchive();
}

function focusCell(index = state.activeCell) {
  requestAnimationFrame(() => elements.board.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true }));
}

function mutate(result, successMessage, action) {
  if (!result.changed || state.completed) {
    const [title, copy] = statusForReason(result.reason);
    setTemporaryStatus(title, copy, "invalid");
    showToast(title, true);
    return false;
  }
  pushHistory();
  state.position = result.position;
  state.timeline = [...state.timeline, action];
  state.moves = state.timeline.length;
  state.selectedFrom = null;
  render();
  persistSession();
  const evaluation = evaluatePosition(state.level, state.position);
  if (evaluation.complete) settleCompletion(true);
  else setTemporaryStatus(successMessage, "新邮段已校准，继续沿箭头寻找后继。", "progress");
  return true;
}

function chooseCell(index, { focus = true } = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= state.level.width * state.level.height || state.completed) return false;
  state.activeCell = index;
  if (state.selectedFrom === null) {
    if (state.level.directions[index] === null) {
      setTemporaryStatus("终钟不能作为起点", "请选择一座有箭头的驿站。", "invalid");
      showToast("终钟没有后继", true);
      return false;
    }
    state.selectedFrom = index;
    renderBoard();
    renderStatus();
    persistSession();
    if (focus) focusCell(index);
    return true;
  }
  if (state.selectedFrom === index) {
    state.selectedFrom = null;
    renderBoard();
    renderStatus();
    persistSession();
    if (focus) focusCell(index);
    return true;
  }
  const from = state.selectedFrom;
  const result = applyLink(state.level, state.position, from, index);
  const changed = mutate(result, `已接通第 ${from + 1} 号与第 ${index + 1} 号驿站`, { type: "link", from, to: index });
  if (focus) focusCell(index);
  return changed;
}

function clearAt(index) {
  if (state.completed) return false;
  const result = clearCell(state.level, state.position, index);
  if (!result.changed) {
    setTemporaryStatus("该驿站没有可拆邮段", "可选择已连接驿站，再使用拆线按钮或 Delete。", "invalid");
    return false;
  }
  return mutate(result, `已释放第 ${index + 1} 号驿站的端点`, { type: "clear", cell: index });
}

function clearChainAt(index) {
  if (state.completed) return false;
  const result = clearAlgebraicChain(state.level, state.position, index);
  if (!result.changed) {
    setTemporaryStatus("这里没有可拆短链", "选择带 a、a+1 标记的代数链；数字链会按上游规则只拆所选格。", "invalid");
    return false;
  }
  return mutate(result, "已释放所选代数短链", { type: "clear-chain", cell: index });
}

function undo() {
  if (!state.history.length) return false;
  const wasCompleted = state.completed;
  if (wasCompleted) {
    closeDialog(elements.victoryDialog, "undo-completion");
    const resumeElapsed = state.finishedElapsed ?? elapsedMs();
    state.completed = false;
    state.completion = null;
    state.elapsedBase = resumeElapsed;
    state.startedAt = performance.now();
    state.finishedElapsed = null;
  }
  const previous = state.history.at(-1);
  state.history = state.history.slice(0, -1);
  state.position = previous.position;
  state.timeline = state.timeline.slice(0, previous.moves);
  state.moves = previous.moves;
  state.selectedFrom = null;
  render();
  persistSession();
  setTemporaryStatus(
    wasCompleted ? "已从终钟前撤回" : "已撤回上一次校准",
    wasCompleted
      ? "本机邮戳与已交付奖励保持幂等记录；补回最后一段仍使用同一完成事件。"
      : "邮路、序号和操作数都已一起恢复。",
    "progress",
  );
  focusCell();
  return true;
}

function closeDialog(dialog, reason = "close") {
  if (!dialog?.open) return false;
  dialog.close(reason);
  return true;
}

function closeOtherDialogs(except) {
  [elements.rulesDialog, elements.tutorialDialog, elements.victoryDialog].forEach((dialog) => {
    if (dialog !== except && dialog.open) closeDialog(dialog, "superseded");
  });
}

function openDialog(dialog, trigger, focusTarget) {
  if (!dialog || dialog.open) return false;
  closeOtherDialogs(dialog);
  dialogTriggers.set(dialog, trigger instanceof Element ? trigger : document.activeElement);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
  return true;
}

function installDialog(dialog, { onClose = null, backdrop = true } = {}) {
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(dialog, "escape");
  });
  if (backdrop) dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog, "backdrop");
  });
  dialog.addEventListener("close", () => {
    onClose?.(dialog.returnValue);
    if (![elements.rulesDialog, elements.tutorialDialog, elements.victoryDialog].some((item) => item.open)) {
      document.body.classList.remove("modal-open");
    }
    const trigger = dialogTriggers.get(dialog);
    dialogTriggers.delete(dialog);
    if (trigger?.isConnected) requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
  });
}

function resetTutorialScroll() {
  elements.tutorialDialog.scrollTop = 0;
  const tutorialShell = elements.tutorialDialog.querySelector(".tutorial-shell");
  const tutorialCard = elements.tutorialDialog.querySelector(".tutorial-card");
  if (tutorialShell) tutorialShell.scrollTop = 0;
  if (tutorialCard) tutorialCard.scrollTop = 0;
}

function renderTutorial() {
  const card = TUTORIAL_CARDS[state.tutorialIndex];
  elements.tutorialImage.src = card.image;
  elements.tutorialImage.alt = card.alt;
  elements.tutorialStep.textContent = card.tag;
  elements.tutorialTitle.textContent = card.title;
  elements.tutorialBody.textContent = card.body;
  elements.tutorialBullets.replaceChildren(...card.bullets.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  elements.tutorialCounter.textContent = `${state.tutorialIndex + 1} / ${TUTORIAL_CARDS.length}`;
  elements.tutorialPrevious.disabled = state.tutorialIndex === 0;
  elements.tutorialNext.textContent = state.tutorialIndex === TUTORIAL_CARDS.length - 1 ? "开始分拣" : "下一张";
  elements.tutorialAnnouncement.textContent = `教程第 ${state.tutorialIndex + 1} 张：${card.title}`;
  resetTutorialScroll();
}

function openTutorial(trigger = elements.tutorial) {
  const generation = ++tutorialGeneration;
  state.tutorialIndex = 0;
  renderTutorial();
  const opened = openDialog(elements.tutorialDialog, trigger, elements.tutorialNext);
  if (!opened) return false;
  // A closed dialog may preserve its inner scroll position after showModal,
  // so reset once synchronously and once after layout. The generation guard
  // prevents an old reopen callback from jumping a newer card or dialog.
  resetTutorialScroll();
  requestAnimationFrame(() => {
    if (generation === tutorialGeneration && elements.tutorialDialog.open && state.tutorialIndex === 0) {
      resetTutorialScroll();
    }
  });
  return true;
}

function finishTutorial(reason) {
  markTutorialSeen(storage);
  closeDialog(elements.tutorialDialog, reason);
}

function resetWithLevel(level, message) {
  if (!level) return false;
  closeOtherDialogs(null);
  const session = freshSession(level);
  state.level = level;
  state.runId = session.runId;
  state.position = session.position;
  state.timeline = [];
  state.history = [];
  state.moves = 0;
  state.activeCell = session.activeCell;
  state.selectedFrom = null;
  state.completion = null;
  state.completed = false;
  state.elapsedBase = 0;
  state.startedAt = performance.now();
  state.finishedElapsed = null;
  state.statusOverride = null;
  persistSettings();
  render();
  persistSession();
  setTemporaryStatus(message, `${level.title} · ${level.subtitle}。`, "progress");
  focusCell();
  return true;
}

function restart() {
  return resetWithLevel(state.level, "这张急件已重新装盒");
}

function chooseNextLevel() {
  return resetWithLevel(nextLevel(state.level), "新的时邮急件已抵达");
}

function setDifficulty(difficulty) {
  const level = levelsForDifficulty(difficulty)[0];
  return level ? resetWithLevel(level, `已进入${DIFFICULTY_LABELS[difficulty]}邮路`) : false;
}

function flushOutbox() {
  for (const payload of loadOutbox(storage, outboxValidator)) {
    const result = deliverCompletion(window, payload);
    if (!result.confirmed) continue;
    const removed = removeFromOutbox(storage, payload.eventId, outboxValidator);
    if (!removed.saved) continue;
    if (state.completion?.eventId === payload.eventId) {
      state.completion.delivered = true;
      persistSession("完成邮戳已交付成长图鉴");
    }
  }
}

function settleCompletion(presentVictory) {
  const evaluation = evaluatePosition(state.level, state.position);
  if (!evaluation.complete) return false;
  state.completed = true;
  state.finishedElapsed ??= elapsedMs();
  const eventId = `time-sand-post:${state.runId}:complete`;
  const completedAt = state.completion?.completedAt
    ?? records.settledEvents[eventId]
    ?? new Date().toISOString();
  const payload = createCompletion(state.level, state.runId, {
    moves: state.moves,
    elapsedMs: state.finishedElapsed,
    timeline: state.timeline,
    edges: linksOf(state.position),
  }, completedAt);
  state.completion = { eventId: payload.eventId, delivered: false, completedAt: payload.completedAt };

  // The local result and retryable outbox are durable before host delivery.
  const recordResult = recordCompletion(records, payload, findLevel, new Date(payload.completedAt));
  records = recordResult.records;
  const recordsSaved = saveRecords(storage, records, findLevel);
  const queued = enqueueOutbox(storage, payload, outboxValidator);
  const sessionSaved = persistSession("终钟邮戳已存入本机");
  render();

  if (recordsSaved && queued.saved && sessionSaved) {
    const delivery = deliverCompletion(window, payload);
    if (delivery.confirmed) {
      const removed = removeFromOutbox(storage, payload.eventId, outboxValidator);
      if (removed.saved) {
        state.completion.delivered = true;
        persistSession("完成邮戳已交付成长图鉴");
      }
    }
  }

  if (presentVictory) {
    elements.victoryLevel.textContent = state.level.title;
    elements.victoryMoves.textContent = `${state.moves} 步`;
    elements.victoryPar.textContent = `${state.level.par} 步`;
    elements.victoryTime.textContent = formatTime(state.finishedElapsed);
    elements.victoryCopy.textContent = `从 1 到 ${state.level.width * state.level.height} 的时序邮路已穿过每一座驿站。`;
    elements.victoryReward.textContent = recordResult.firstClear
      ? "新邮戳已写入本机纪念册。"
      : recordResult.personalBest
        ? "你刷新了这张急件的个人最佳操作数。"
        : "本次送达已记录；同一完成事件不会重复奖励。";
    openDialog(
      elements.victoryDialog,
      elements.board.querySelector(`[data-index="${state.activeCell}"]`),
      elements.nextLevel,
    );
  }
  return true;
}

function onBoardClick(event) {
  const cell = event.target.closest("[data-index]");
  if (!cell || !elements.board.contains(cell)) return;
  chooseCell(Number(cell.dataset.index));
}

function onBoardKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const width = state.level.width;
  const height = state.level.height;
  const row = Math.floor(state.activeCell / width);
  const column = state.activeCell % width;
  const next = {
    ArrowUp: Math.max(0, row - 1) * width + column,
    ArrowDown: Math.min(height - 1, row + 1) * width + column,
    ArrowLeft: row * width + Math.max(0, column - 1),
    ArrowRight: row * width + Math.min(width - 1, column + 1),
  }[event.key];
  if (next !== undefined) {
    event.preventDefault();
    state.activeCell = next;
    renderBoard();
    focusCell(next);
    persistSession();
  } else if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    chooseCell(state.activeCell);
  } else if (["Delete", "Backspace"].includes(event.key)) {
    event.preventDefault();
    if (event.shiftKey) clearChainAt(state.activeCell);
    else clearAt(state.activeCell);
    focusCell();
  } else if (event.key === "Escape" && state.selectedFrom !== null) {
    event.preventDefault();
    state.selectedFrom = null;
    renderBoard();
    renderStatus();
    persistSession();
    showToast("已取消起点选择");
  }
}

elements.board.addEventListener("pointerdown", (event) => {
  const cell = event.target.closest("[data-index]");
  if (cell) state.activeCell = Number(cell.dataset.index);
});
elements.board.addEventListener("click", onBoardClick);
elements.board.addEventListener("keydown", onBoardKeydown);
elements.board.addEventListener("contextmenu", (event) => {
  const cell = event.target.closest("[data-index]");
  if (!cell) return;
  event.preventDefault();
  state.activeCell = Number(cell.dataset.index);
  clearChainAt(state.activeCell);
  focusCell();
});
elements.difficultyButtons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-difficulty]");
  if (button) setDifficulty(button.dataset.difficulty);
});
elements.levelButtons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-level-id]");
  if (button) resetWithLevel(findLevel(button.dataset.levelId), "已切换急件");
});
elements.clear.addEventListener("click", () => clearAt(state.selectedFrom ?? state.activeCell));
elements.clearChain.addEventListener("click", () => clearChainAt(state.selectedFrom ?? state.activeCell));
elements.undo.addEventListener("click", undo);
elements.restart.addEventListener("click", restart);
elements.newLevel.addEventListener("click", chooseNextLevel);
elements.tutorial.addEventListener("click", (event) => {
  const activeTrigger = document.activeElement instanceof Element && document.activeElement !== document.body
    ? document.activeElement
    : event.currentTarget;
  openTutorial(activeTrigger);
});
elements.archiveTutorial.addEventListener("click", () => openTutorial(elements.archiveTutorial));
elements.rules.addEventListener("click", () => openDialog(elements.rulesDialog, elements.rules, elements.rulesClose));
elements.rulesClose.addEventListener("click", () => closeDialog(elements.rulesDialog, "close-button"));
elements.tutorialSkip.addEventListener("click", () => finishTutorial("skip"));
elements.tutorialPrevious.addEventListener("click", () => {
  state.tutorialIndex = Math.max(0, state.tutorialIndex - 1);
  renderTutorial();
});
elements.tutorialNext.addEventListener("click", () => {
  if (state.tutorialIndex < TUTORIAL_CARDS.length - 1) {
    state.tutorialIndex += 1;
    renderTutorial();
  } else finishTutorial("complete");
});
elements.nextLevel.addEventListener("click", () => {
  closeDialog(elements.victoryDialog, "next-level");
  chooseNextLevel();
});
elements.stay.addEventListener("click", () => closeDialog(elements.victoryDialog, "stay"));

installDialog(elements.rulesDialog);
installDialog(elements.tutorialDialog, { onClose: () => markTutorialSeen(storage) });
installDialog(elements.victoryDialog, { backdrop: false });

window.addEventListener("realm:ready", flushOutbox);
window.addEventListener("ten-realms-v3:realm-ready", flushOutbox);
window.addEventListener("beforeunload", () => persistSession());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) persistSession();
});

window.TimeSandPost = Object.freeze({
  gameId: "time-sand-post",
  storagePrefix: "ten-realms-v3:games:time-sand-post:",
  getSnapshot: () => Object.freeze({
    levelId: state.level.id,
    runId: state.runId,
    moves: state.moves,
    elapsedMs: elapsedMs(),
    complete: evaluatePosition(state.level, state.position).complete,
    position: snapshotPosition(state.position),
  }),
  openTutorial: () => openTutorial(document.activeElement),
  setDifficulty,
  newLevel: chooseNextLevel,
  restart,
  undo,
});

render();
persistSettings();
if (storedSessionRaw && !restored) showToast("发现损坏的时邮存档，已安全回到新急件。", true);
persistSession();
// A solved session with an unconfirmed marker may have survived a denied
// outbox write. Re-settling is safe because the event ID and local record are
// stable, and guarantees that a later reload can rebuild the durable outbox.
if (state.completed && !state.completion?.delivered) settleCompletion(false);
flushOutbox();
window.setInterval(() => {
  if (!state.completed && !document.hidden && state.moves > 0) persistSession("时序进度已自动保存");
}, 5000);

const forceTutorial = new URLSearchParams(window.location.search).get("tutorial") === "1";
if (forceTutorial || !tutorialSeen(storage)) {
  window.setTimeout(() => {
    if (![elements.rulesDialog, elements.tutorialDialog, elements.victoryDialog].some((dialog) => dialog.open)) openTutorial(elements.tutorial);
  }, 420);
}
