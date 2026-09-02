import {
  affectedCells,
  createState,
  evaluateState,
  pressCell,
  solveMinimum,
  undoPress,
} from "./logic.mjs";
import {
  DIFFICULTIES,
  LEVELS,
  TUTORIAL_LEVEL_ID,
  TUTORIAL_OPERATION_INDEX,
  difficultyById,
  getLevel,
  levelsByDifficulty,
} from "./levels.mjs";
import {
  enqueueCompletion,
  flushCompletionOutbox,
  settleCompletion,
} from "./completion.mjs";
import {
  loadProfile,
  loadSession,
  markTutorialSeen,
  saveProfile,
  saveSession,
  tutorialSeen,
} from "./storage.mjs";

const TUTORIAL_CARDS = Object.freeze([
  Object.freeze({
    step: "01 · 认识钟阵",
    title: "每枚钟都有自己的影响纹",
    body: "这是真实首关“初醒九响”的初始钟阵。金色钟面已经点亮，暗色钟面仍沉睡；每枚钟右下角的九点小图就是它自己的影响范围。",
    bullets: Object.freeze(["亮暗同时用明度、金属材质与发光轮廓区分", "影响纹逐格独立，不能把一枚钟的纹样套到另一枚上"]),
    image: "./assets/tutorial-elements.svg?tutorial=2",
    alt: "初醒九响真实初始状态：九枚编钟中第1、第2和第5枚点亮，其余熄灭，每枚钟显示独立九点影响纹",
  }),
  Object.freeze({
    step: "02 · 敲响一钟",
    title: "纹样里的钟会一起翻转",
    body: "从同一初始题面合法敲击中央第 5 枚钟一次。它的影响纹是第 2、3、4、5、6 枚，所以这五枚同时由亮变暗或由暗变亮。",
    bullets: Object.freeze(["翻转只改变明暗，不改变任何钟的影响纹", "同一枚钟敲两次会抵消，敲击顺序不影响终局"]),
    image: "./assets/tutorial-operation.svg?tutorial=2",
    alt: "初醒九响敲击中央钟后的真实状态：第1、第3、第4和第6枚点亮，第2、第5、第7、第8、第9枚熄灭",
  }),
  Object.freeze({
    step: "03 · 万钟齐鸣",
    title: "全部钟面同时点亮才通关",
    body: "独立求解器复算首关后，依次各敲第 2、3、5、8 枚钟可让九枚钟全部点亮。首关允许多解，但 4 敲是经过 GF(2) 枚举证明的真实最少敲击。",
    bullets: Object.freeze(["只亮八枚仍未完成，必须九枚同时点亮", "建议最少是效率参考，不宣称通关路径唯一"]),
    image: "./assets/tutorial-goal.svg?tutorial=2",
    alt: "初醒九响真实完成状态：九枚编钟全部点亮，通关条件九比九满足，最少敲击为4",
  }),
]);

const elements = {
  bellGrid: document.querySelector("#bell-grid"),
  chamber: document.querySelector("#chamber"),
  clearCount: document.querySelector("#clear-count"),
  difficultyNote: document.querySelector("#difficulty-note"),
  difficultyPicker: document.querySelector("#difficulty-picker"),
  levelKicker: document.querySelector("#level-kicker"),
  levelPicker: document.querySelector("#level-picker"),
  levelSubtitle: document.querySelector("#level-subtitle"),
  levelTitle: document.querySelector("#level-title"),
  litCount: document.querySelector("#lit-count"),
  liveStatus: document.querySelector("#live-status"),
  minimumCount: document.querySelector("#minimum-count"),
  moveCount: document.querySelector("#move-count"),
  muteButton: document.querySelector("#mute-button"),
  newRunButton: document.querySelector("#new-run-button"),
  restartButton: document.querySelector("#restart-button"),
  rewardCount: document.querySelector("#reward-count"),
  saveIndicator: document.querySelector("#save-indicator"),
  selectedCoordinate: document.querySelector("#selected-coordinate"),
  selectedState: document.querySelector("#selected-state"),
  solutionNote: document.querySelector("#solution-note"),
  solverStatus: document.querySelector("#solver-status"),
  templateCopy: document.querySelector("#template-copy"),
  templateMap: document.querySelector("#template-map"),
  toast: document.querySelector("#toast"),
  tutorialBody: document.querySelector("#tutorial-body"),
  tutorialBullets: document.querySelector("#tutorial-bullets"),
  tutorialButton: document.querySelector("#tutorial-button"),
  tutorialClose: document.querySelector("#tutorial-close"),
  tutorialDialog: document.querySelector("#tutorial-dialog"),
  tutorialImage: document.querySelector("#tutorial-image"),
  tutorialNext: document.querySelector("#tutorial-next"),
  tutorialPosition: document.querySelector("#tutorial-position"),
  tutorialPrevious: document.querySelector("#tutorial-previous"),
  tutorialStep: document.querySelector("#tutorial-step"),
  tutorialTitle: document.querySelector("#tutorial-title"),
  undoButton: document.querySelector("#undo-button"),
  victoryCopy: document.querySelector("#victory-copy"),
  victoryDialog: document.querySelector("#victory-dialog"),
  victoryMinimum: document.querySelector("#victory-minimum"),
  victoryMoves: document.querySelector("#victory-moves"),
  victoryNext: document.querySelector("#victory-next"),
  victoryRewards: document.querySelector("#victory-rewards"),
  victoryStay: document.querySelector("#victory-stay"),
};

let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
const profileLoad = loadProfile(storage, getLevel, TUTORIAL_LEVEL_ID);
let profile = profileLoad.profile;
let storageAvailable = profileLoad.available;
const sessionLoad = loadSession(storage, getLevel);
storageAvailable = storageAvailable && sessionLoad.available;

let level = sessionLoad.session?.level ?? getLevel(profile.preferences.levelId) ?? LEVELS[0];
let state = sessionLoad.session?.state ?? createState(level);
let runId = sessionLoad.session?.runId ?? createRunId();
let elapsedBase = sessionLoad.session?.elapsedMs ?? 0;
let resumedAt = Date.now();
let selectedIndex = 0;
let tutorialIndex = 0;
let tutorialReturnFocus = null;
let victoryReturnFocus = null;
let bellElements = [];
let pulseGeneration = 0;
let toastTimer = 0;
let saveTimer = 0;
let completionTimer = 0;
let audioContext = null;

profile.preferences.levelId = level.id;
profile.preferences.difficulty = level.difficulty;

function createRunId() {
  const random = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID().replaceAll("-", "").slice(0, 16)
    : Math.random().toString(36).slice(2, 14).padEnd(12, "x");
  return `resonance-${Date.now().toString(36)}-${random}`;
}

function elapsedNow() {
  return elapsedBase + Math.max(0, Date.now() - resumedAt);
}

function syncClock() {
  elapsedBase = elapsedNow();
  resumedAt = Date.now();
}

function setStorageMessage(message, saved = false) {
  window.clearTimeout(saveTimer);
  elements.saveIndicator.querySelector("span").textContent = storageAvailable ? message : "存档不可用 · 当前仍可游玩";
  elements.saveIndicator.classList.toggle("is-saved", saved && storageAvailable);
  if (saved && storageAvailable) {
    saveTimer = window.setTimeout(() => {
      elements.saveIndicator.querySelector("span").textContent = "本机钟谱已就绪";
      elements.saveIndicator.classList.remove("is-saved");
    }, 1600);
  }
}

function persistSession(message = "本局已保存") {
  syncClock();
  const saved = saveSession(storage, { level, state, runId, elapsedMs: elapsedBase });
  storageAvailable = storageAvailable && saved;
  setStorageMessage(message, saved);
  return saved;
}

function persistProfile() {
  const saved = saveProfile(storage, profile, getLevel, TUTORIAL_LEVEL_ID);
  storageAvailable = storageAvailable && saved;
  return saved;
}

function announce(message) {
  elements.liveStatus.textContent = "";
  window.requestAnimationFrame(() => { elements.liveStatus.textContent = message; });
}

function showToast(message, duration = 2600) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}

function ensureAudio() {
  if (profile.preferences.muted) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function tone(frequency, duration, delay = 0, gainAmount = 0.018) {
  const context = ensureAudio();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.28, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainAmount, start + Math.min(0.025, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function sound(effect, affected = 1) {
  if (effect === "press") {
    tone(290 + affected * 18, 0.2);
    tone(580 + affected * 12, 0.32, 0.025, 0.007);
  } else if (effect === "undo") {
    tone(430, 0.14, 0, 0.012);
  } else if (effect === "win") {
    [293.66, 369.99, 440, 587.33].forEach((frequency, index) => tone(frequency, 0.75, index * 0.12, 0.015));
  }
}

function buildDifficultyPicker() {
  elements.difficultyPicker.replaceChildren(...DIFFICULTIES.map((difficulty) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = difficulty.id === "easy" ? "入门" : difficulty.id === "medium" ? "进阶" : "大师";
    button.dataset.difficulty = difficulty.id;
    button.addEventListener("click", () => {
      if (level.difficulty === difficulty.id) return;
      startLevel(levelsByDifficulty(difficulty.id)[0]);
    });
    return button;
  }));
}

function buildLevelPicker() {
  const available = levelsByDifficulty(level.difficulty);
  elements.levelPicker.replaceChildren(...available.map((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.levelId = candidate.id;
    button.innerHTML = `<i aria-hidden="true">${index + 1}</i><span><b></b><small></small></span><em></em>`;
    button.querySelector("b").textContent = candidate.title;
    button.querySelector("small").textContent = `${candidate.width}×${candidate.height} · 最少 ${candidate.suggestedMinimum} 敲`;
    button.querySelector("em").textContent = profile.completedLevelIds.includes(candidate.id) ? "已齐鸣" : "未完成";
    button.addEventListener("click", () => { if (candidate.id !== level.id) startLevel(candidate); });
    return button;
  }));
}

function miniPattern(levelData, template) {
  const pattern = document.createElement("span");
  pattern.className = "mini-pattern";
  pattern.style.setProperty("--mini-columns", String(levelData.width));
  const affected = new Set(template);
  for (let index = 0; index < levelData.width * levelData.height; index += 1) {
    const dot = document.createElement("i");
    dot.className = affected.has(index) ? "is-affected" : "";
    pattern.append(dot);
  }
  return pattern;
}

function buildBoard() {
  elements.bellGrid.style.setProperty("--columns", String(level.width));
  elements.bellGrid.setAttribute("aria-rowcount", String(level.height));
  elements.bellGrid.setAttribute("aria-colcount", String(level.width));
  bellElements = level.templates.map((template, index) => {
    const row = Math.floor(index / level.width);
    const column = index % level.width;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bell";
    button.dataset.index = String(index);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-rowindex", String(row + 1));
    button.setAttribute("aria-colindex", String(column + 1));
    const number = document.createElement("span");
    number.className = "bell-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const clapper = document.createElement("span");
    clapper.className = "bell-clapper";
    clapper.setAttribute("aria-hidden", "true");
    button.append(number, miniPattern(level, template), clapper);
    button.addEventListener("click", () => handlePress(index));
    button.addEventListener("focus", () => { selectedIndex = index; renderSelection(); });
    button.addEventListener("keydown", (event) => handleGridKey(event, index));
    return button;
  });
  elements.bellGrid.replaceChildren(...bellElements);
}

function renderBoard() {
  const evaluation = evaluateState(level, state);
  bellElements.forEach((button, index) => {
    const lit = state.lights[index] === 1;
    const row = Math.floor(index / level.width) + 1;
    const column = (index % level.width) + 1;
    button.dataset.lit = String(lit);
    button.classList.toggle("is-selected", index === selectedIndex);
    button.setAttribute("aria-label", `第 ${row} 行第 ${column} 列，${lit ? "已亮" : "熄灭"}，影响 ${level.templates[index].length} 枚钟`);
    button.setAttribute("aria-pressed", String(Boolean(state.pressParity[index])));
  });
  elements.moveCount.textContent = String(state.moves);
  elements.minimumCount.textContent = String(level.suggestedMinimum);
  elements.litCount.textContent = `${evaluation.lit} / ${evaluation.total}`;
  elements.chamber.classList.toggle("is-complete", evaluation.complete);
  elements.undoButton.disabled = state.history.length === 0 || evaluation.complete;
  renderSelection();
}

function renderSelection() {
  selectedIndex = Math.max(0, Math.min(selectedIndex, level.width * level.height - 1));
  const row = Math.floor(selectedIndex / level.width);
  const column = selectedIndex % level.width;
  const affected = new Set(affectedCells(level, selectedIndex));
  elements.selectedCoordinate.textContent = `钟位 ${row + 1} · ${column + 1}`;
  elements.selectedState.textContent = state.lights[selectedIndex] ? "当前已亮" : "当前熄灭";
  elements.templateMap.style.setProperty("--columns", String(level.width));
  elements.templateMap.replaceChildren(...Array.from({ length: level.width * level.height }, (_, index) => {
    const marker = document.createElement("span");
    marker.textContent = String(index + 1);
    marker.classList.toggle("is-affected", affected.has(index));
    marker.classList.toggle("is-origin", index === selectedIndex);
    return marker;
  }));
  elements.templateCopy.textContent = `敲击第 ${selectedIndex + 1} 枚钟会翻转：${[...affected].map((index) => index + 1).join("、")}。绿色回纹标出本次敲击的起点。`;
  bellElements.forEach((button, index) => button.classList.toggle("is-selected", index === selectedIndex));
}

function renderChrome() {
  const difficulty = difficultyById(level.difficulty);
  document.documentElement.style.setProperty("--level-accent", level.accent);
  elements.levelKicker.textContent = difficulty.label;
  elements.levelTitle.textContent = level.title;
  elements.levelSubtitle.textContent = level.subtitle;
  elements.difficultyNote.textContent = difficulty.note;
  elements.difficultyPicker.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === level.difficulty));
  });
  elements.levelPicker.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.levelId === level.id));
  });
  elements.clearCount.textContent = `${profile.completedLevelIds.length} / ${LEVELS.length}`;
  elements.rewardCount.textContent = String(profile.rewardLedger.length);
  elements.muteButton.setAttribute("aria-pressed", String(profile.preferences.muted));
  elements.muteButton.querySelector("b").textContent = profile.preferences.muted ? "声音关" : "声音开";
  elements.solverStatus.textContent = `已证明可解 · 最少 ${level.suggestedMinimum} 敲`;
  elements.solutionNote.textContent = level.solutionCount > 1
    ? `本题有 ${level.solutionCount} 组奇偶解；建议数取其中真实最短者，不承诺路径唯一。`
    : "本题的奇偶解唯一；建议数由当前影响矩阵独立复算。";
}

function renderAll(rebuild = false) {
  if (rebuild) {
    buildLevelPicker();
    buildBoard();
  }
  renderChrome();
  renderBoard();
}

function animateAffected(index) {
  pulseGeneration += 1;
  const generation = String(pulseGeneration);
  for (const target of affectedCells(level, index)) {
    const button = bellElements[target];
    button.dataset.pulse = generation;
    button.classList.remove("is-ringing");
    void button.offsetWidth;
    button.classList.add("is-ringing");
    window.setTimeout(() => {
      if (button.dataset.pulse === generation) button.classList.remove("is-ringing");
    }, 420);
  }
}

function handlePress(index) {
  if (evaluateState(level, state).complete || elements.tutorialDialog.open || elements.victoryDialog.open) return;
  const previous = state;
  state = pressCell(level, state, index);
  if (state === previous) return;
  selectedIndex = index;
  animateAffected(index);
  sound("press", level.templates[index].length);
  renderBoard();
  persistSession(`第 ${index + 1} 枚钟已记谱`);
  const evaluation = evaluateState(level, state);
  announce(`敲击第 ${index + 1} 枚钟，当前点亮 ${evaluation.lit} / ${evaluation.total}`);
  if (evaluation.complete) {
    window.clearTimeout(completionTimer);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 30 : 520;
    completionTimer = window.setTimeout(finalizeCompletion, delay);
  }
}

function handleGridKey(event, index) {
  if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
    event.preventDefault();
    handlePress(index);
    return;
  }
  const row = Math.floor(index / level.width);
  const column = index % level.width;
  let next = -1;
  if (event.key === "ArrowUp") next = ((row - 1 + level.height) % level.height) * level.width + column;
  if (event.key === "ArrowDown") next = ((row + 1) % level.height) * level.width + column;
  if (event.key === "ArrowLeft") next = row * level.width + ((column - 1 + level.width) % level.width);
  if (event.key === "ArrowRight") next = row * level.width + ((column + 1) % level.width);
  if (next >= 0) {
    event.preventDefault();
    selectedIndex = next;
    bellElements[next].focus();
  }
}

function startLevel(nextLevel) {
  window.clearTimeout(completionTimer);
  level = nextLevel;
  state = createState(level);
  runId = createRunId();
  elapsedBase = 0;
  resumedAt = Date.now();
  selectedIndex = 0;
  profile.preferences.levelId = level.id;
  profile.preferences.difficulty = level.difficulty;
  persistProfile();
  renderAll(true);
  persistSession("新钟谱已保存");
  announce(`已进入${level.title}`);
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function restartCurrent(newRun = false) {
  window.clearTimeout(completionTimer);
  const wasComplete = evaluateState(level, state).complete;
  state = createState(level);
  if (newRun || wasComplete) runId = createRunId();
  elapsedBase = 0;
  resumedAt = Date.now();
  selectedIndex = 0;
  renderAll(false);
  persistSession(newRun ? "新一轮钟谱已保存" : "钟阵已复位");
  announce(newRun ? "已重开本关" : "钟阵已重置到初始状态");
}

function finalizeCompletion() {
  if (!evaluateState(level, state).complete) return;
  syncClock();
  let result;
  try {
    result = settleCompletion({ profile, level, state, runId, elapsedMs: elapsedBase });
  } catch {
    showToast("通关已确认，但本地结算暂时不可用");
    return;
  }
  let staged = true;
  let saved = true;
  if (result.detail) {
    const previousProfile = profile;
    staged = enqueueCompletion(storage, result.detail);
    if (staged) {
      profile = result.profile;
      saved = persistProfile();
      if (!saved) profile = previousProfile;
    } else {
      saved = false;
    }
  } else {
    profile = result.profile;
  }
  persistSession("齐鸣记录已保存");
  if (staged && saved) flushCompletionOutbox(storage, window, profile);
  else showToast("已验证通关；本地结算会在存储恢复后重试", 3600);
  renderChrome();
  sound("win");
  elements.victoryMoves.textContent = String(state.moves);
  elements.victoryMinimum.textContent = String(level.suggestedMinimum);
  elements.victoryRewards.textContent = String(result.claims.length);
  elements.victoryCopy.textContent = state.moves === level.suggestedMinimum
    ? `${level.title}完成，并达到求解器证明的最少敲击。`
    : `${level.title}完成；还可向 ${level.suggestedMinimum} 敲的效率线挑战。`;
  victoryReturnFocus = bellElements[selectedIndex];
  openDialog(elements.victoryDialog, elements.victoryNext);
  announce(`${level.title}万钟齐鸣，本局 ${state.moves} 敲`);
}

function nextLevel() {
  const index = LEVELS.findIndex((candidate) => candidate.id === level.id);
  return LEVELS[(index + 1) % LEVELS.length];
}

function anyDialogOpen() {
  return Boolean(document.querySelector("dialog[open]"));
}

function openDialog(dialog, initialFocus) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  document.body.classList.add("is-dialog-open");
  window.requestAnimationFrame(() => initialFocus?.focus({ preventScroll: true }));
}

function closeDialog(dialog) {
  if (dialog.open && typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (!anyDialogOpen()) document.body.classList.remove("is-dialog-open");
}

function renderTutorialCard() {
  const card = TUTORIAL_CARDS[tutorialIndex];
  elements.tutorialStep.textContent = card.step;
  elements.tutorialTitle.textContent = card.title;
  elements.tutorialBody.textContent = card.body;
  elements.tutorialImage.src = card.image;
  elements.tutorialImage.alt = card.alt;
  elements.tutorialBullets.replaceChildren(...card.bullets.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  elements.tutorialPosition.textContent = `${tutorialIndex + 1} / ${TUTORIAL_CARDS.length}`;
  elements.tutorialPrevious.disabled = tutorialIndex === 0;
  elements.tutorialNext.textContent = tutorialIndex === TUTORIAL_CARDS.length - 1 ? "开始游戏" : "下一张";
  elements.tutorialDialog.scrollTop = 0;
}

function openTutorial() {
  if (elements.tutorialDialog.open) return;
  if (elements.victoryDialog.open) closeVictory(false);
  tutorialReturnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body && document.activeElement.isConnected
    ? document.activeElement : elements.tutorialButton;
  tutorialIndex = 0;
  renderTutorialCard();
  openDialog(elements.tutorialDialog, elements.tutorialNext);
}

function closeTutorial() {
  markTutorialSeen(storage);
  closeDialog(elements.tutorialDialog);
  tutorialReturnFocus?.focus?.({ preventScroll: true });
}

function closeVictory(restoreFocus = true) {
  closeDialog(elements.victoryDialog);
  if (restoreFocus) victoryReturnFocus?.focus?.({ preventScroll: true });
}

elements.tutorialButton.addEventListener("click", openTutorial);
elements.tutorialClose.addEventListener("click", closeTutorial);
elements.tutorialPrevious.addEventListener("click", () => {
  if (tutorialIndex > 0) { tutorialIndex -= 1; renderTutorialCard(); }
});
elements.tutorialNext.addEventListener("click", () => {
  if (tutorialIndex < TUTORIAL_CARDS.length - 1) { tutorialIndex += 1; renderTutorialCard(); }
  else closeTutorial();
});
elements.tutorialDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeTutorial(); });
elements.victoryDialog.addEventListener("cancel", (event) => event.preventDefault());
elements.victoryStay.addEventListener("click", () => closeVictory(true));
elements.victoryNext.addEventListener("click", () => { closeVictory(false); startLevel(nextLevel()); });
elements.undoButton.addEventListener("click", () => {
  if (evaluateState(level, state).complete) return;
  const previous = state;
  state = undoPress(level, state);
  if (state === previous) return;
  selectedIndex = previous.history.at(-1) ?? selectedIndex;
  sound("undo");
  renderBoard();
  persistSession("上一敲已撤回");
  announce("已撤回上一敲");
});
elements.restartButton.addEventListener("click", () => restartCurrent(false));
elements.newRunButton.addEventListener("click", () => restartCurrent(true));
elements.muteButton.addEventListener("click", () => {
  profile.preferences.muted = !profile.preferences.muted;
  persistProfile();
  renderChrome();
  showToast(profile.preferences.muted ? "钟房声音已关闭" : "钟房声音已开启");
});

document.addEventListener("keydown", (event) => {
  if (anyDialogOpen() || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key.toLowerCase() === "u") {
    event.preventDefault();
    elements.undoButton.click();
  } else if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    elements.restartButton.click();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persistSession("本局已保存");
  else { resumedAt = Date.now(); }
});
window.addEventListener("pagehide", () => persistSession("本局已保存"));
window.addEventListener("realm:ready", () => flushCompletionOutbox(storage, window, profile));
window.addEventListener("ten-realms-v3:realm-ready", () => flushCompletionOutbox(storage, window, profile));

// Static truth-chain guard: app and tutorial remain tied to one real level.
const tutorialLevel = getLevel(TUTORIAL_LEVEL_ID);
const tutorialProof = solveMinimum(tutorialLevel);
if (!tutorialProof.minimumProven || !tutorialProof.presses.includes(TUTORIAL_OPERATION_INDEX)) {
  throw new Error("Tutorial truth chain is no longer valid.");
}

buildDifficultyPicker();
renderAll(true);
persistProfile();
flushCompletionOutbox(storage, window, profile);
if (sessionLoad.status === "invalid" || profileLoad.status === "invalid") showToast("检测到损坏钟谱，已仅重建本游戏记录");
if (evaluateState(level, state).complete && !profile.settledRuns[runId]) {
  window.setTimeout(finalizeCompletion, 80);
} else if (!tutorialSeen(storage)) {
  window.requestAnimationFrame(openTutorial);
}
