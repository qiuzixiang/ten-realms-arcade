import {
  ARCHIVE_RECIPE_COUNT,
  DIFFICULTIES,
  EMPTY_ESSENCE,
  INGREDIENTS,
  archiveRecipe,
  bottleIdentity,
  dailyRecipe,
  difficultyById,
  feedbackMarkers,
  isGuessSubmittable,
  localDayKey,
  remainingRating,
  setDraftPeg,
  submitGuess,
  suggestGuess,
  toggleHold,
} from "./logic.mjs";
import {
  HISTORY_LIMIT,
  createSaveState,
  confirmPerfumeryCompletion,
  enqueuePerfumeryCompletion,
  hasRevealedRecipe,
  markRecipeRevealed,
  normalizeSave,
  recordOutcome,
  serializeSave,
  stagePerfumeryCompletion,
  statsSummary,
} from "./session.mjs";

const STORAGE_KEY = "ten-realms-v2:games:mystic-perfumery:save:v1";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  assertiveStatus: document.querySelector("#assertive-status"),
  atelierMessage: document.querySelector("#atelier-message"),
  bottleCount: document.querySelector("#bottle-count"),
  bottleLiquid: document.querySelector("#bottle-liquid"),
  bottleShelf: document.querySelector("#bottle-shelf"),
  bottleStage: document.querySelector("#bottle-stage"),
  bottleStateCopy: document.querySelector("#bottle-state-copy"),
  bottleStateLabel: document.querySelector("#bottle-state-label"),
  clearButton: document.querySelector("#clear-button"),
  collectionToggle: document.querySelector("#collection-toggle"),
  composer: document.querySelector("#composer"),
  dailyButton: document.querySelector("#daily-button"),
  dailyCount: document.querySelector("#daily-count"),
  dailyStatus: document.querySelector("#daily-status"),
  difficultyButtons: document.querySelector("#difficulty-buttons"),
  difficultyNote: document.querySelector("#difficulty-note"),
  draftRow: document.querySelector("#draft-row"),
  draftStatus: document.querySelector("#draft-status"),
  emptyHistory: document.querySelector("#empty-history"),
  footerRulesButton: document.querySelector("#footer-rules-button"),
  formulaCard: document.querySelector(".formula-card"),
  formulaVault: document.querySelector("#formula-vault"),
  hintButton: document.querySelector("#hint-button"),
  historyCount: document.querySelector("#history-count"),
  historyList: document.querySelector("#history-list"),
  historyScroll: document.querySelector("#history-scroll"),
  ingredientPalette: document.querySelector("#ingredient-palette"),
  muteButton: document.querySelector("#mute-button"),
  newGameButton: document.querySelector("#new-game-button"),
  nextRecipeButton: document.querySelector("#next-recipe-button"),
  rareCount: document.querySelector("#rare-count"),
  recipeKicker: document.querySelector("#recipe-kicker"),
  recipeParams: document.querySelector("#recipe-params"),
  recipeTitle: document.querySelector("#recipe-title"),
  restartButton: document.querySelector("#restart-button"),
  resultAnswer: document.querySelector("#result-answer"),
  resultCopy: document.querySelector("#result-copy"),
  resultDialog: document.querySelector("#result-dialog"),
  resultGuesses: document.querySelector("#result-guesses"),
  resultKicker: document.querySelector("#result-kicker"),
  resultRating: document.querySelector("#result-rating"),
  resultTitle: document.querySelector("#result-title"),
  resultUndoButton: document.querySelector("#result-undo-button"),
  resultUnlock: document.querySelector("#result-unlock"),
  roundRemaining: document.querySelector("#round-remaining"),
  rulesButton: document.querySelector("#rules-button"),
  rulesCloseButton: document.querySelector("#rules-close-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  saveState: document.querySelector("#save-state"),
  secretSlots: document.querySelector("#secret-slots"),
  stayButton: document.querySelector("#stay-button"),
  streakCount: document.querySelector("#streak-count"),
  submitButton: document.querySelector("#submit-button"),
  toast: document.querySelector("#toast"),
  undoButton: document.querySelector("#undo-button"),
};

let audioContext = null;
let toastTimer = 0;
let saveTimer = 0;
let storageAvailable = true;
let lastModalFocus = null;
let resultWaitObserver = null;
let pendingResultTimer = 0;
let lastOutcome = null;

function freshRuntime(recipe, preferences = {}, stats = undefined, completionOutbox = []) {
  const normalized = normalizeSave(createSaveState(recipe, preferences, stats, { completionOutbox }));
  if (!normalized) throw new Error("Unable to create a fresh perfumery session.");
  return normalized;
}

let state = freshRuntime(archiveRecipe(DIFFICULTIES[0].id, 0));

function ingredientFor(id) {
  return INGREDIENTS.find((ingredient) => ingredient.id === id) ?? null;
}

function essenceMarkup(id, extraClass = "") {
  const ingredient = ingredientFor(id);
  if (!ingredient) return "";
  return `<span class="essence-token essence-${ingredient.id} ${extraClass}" aria-hidden="true"><span>${ingredient.short}</span></span>`;
}

function essenceName(id) {
  return ingredientFor(id)?.name ?? "空槽";
}

function setMessage(title, copy, tone = "normal") {
  elements.atelierMessage.querySelector("strong").textContent = title;
  elements.atelierMessage.querySelector("p span").textContent = copy;
  elements.atelierMessage.classList.toggle("is-warning", tone === "warning");
  elements.atelierMessage.classList.toggle("is-success", tone === "success");
}

function showToast(message, isError = false, duration = 2600) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}

function announceError(message) {
  elements.assertiveStatus.textContent = "";
  window.requestAnimationFrame(() => {
    elements.assertiveStatus.textContent = message;
  });
}

function setSavedMessage(message = "刚刚已自动保存") {
  window.clearTimeout(saveTimer);
  elements.saveState.textContent = storageAvailable ? message : "此浏览器未开放本机存档";
  if (!storageAvailable) return;
  saveTimer = window.setTimeout(() => {
    elements.saveState.textContent = "每一步都会留在本机";
  }, 2300);
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { restored: false };
    const normalized = normalizeSave(JSON.parse(raw));
    if (!normalized) throw new Error("Invalid save");
    state = normalized;
    return { restored: true };
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      storageAvailable = false;
    }
    state = freshRuntime(archiveRecipe(DIFFICULTIES[0].id, 0));
    return { restored: false, invalid: true };
  }
}

function writeSave(message) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeSave(state)));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  setSavedMessage(message);
}

function ensureAudio() {
  if (state.preferences.muted) return null;
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
  oscillator.type = options.type ?? "triangle";
  oscillator.frequency.setValueAtTime(frequency, start);
  if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.018, start + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSound(effect, feedback = null) {
  if (state.preferences.muted) return;
  if (effect === "place") {
    tone(430 + state.active.selectedEssence * 38, 0.12, { gain: 0.015 });
    tone(690 + state.active.selectedEssence * 24, 0.1, { gain: 0.008, delay: 0.035 });
  } else if (effect === "remove") {
    tone(420, 0.13, { endFrequency: 220, gain: 0.014 });
  } else if (effect === "hold") {
    tone(290, 0.09, { type: "sine", gain: 0.014 });
    tone(580, 0.1, { type: "sine", gain: 0.008, delay: 0.045 });
  } else if (effect === "submit") {
    tone(220, 0.16, { gain: 0.016 });
    for (let index = 0; index < (feedback?.exact ?? 0); index += 1) {
      tone(620 + index * 55, 0.12, { gain: 0.01, delay: 0.08 + index * 0.055 });
    }
    for (let index = 0; index < (feedback?.misplaced ?? 0); index += 1) {
      tone(430 + index * 35, 0.1, { type: "sine", gain: 0.007, delay: 0.1 + index * 0.05 });
    }
  } else if (effect === "invalid" || effect === "lose") {
    tone(155, 0.13, { type: "sawtooth", gain: 0.014 });
    tone(116, 0.18, { type: "triangle", gain: 0.011, delay: 0.1 });
  } else if (effect === "undo") {
    tone(360, 0.11, { gain: 0.012, endFrequency: 520 });
  } else if (effect === "hint") {
    [392, 494, 587].forEach((frequency, index) => tone(frequency, 0.22, { type: "sine", gain: 0.008, delay: index * 0.07 }));
  } else if (effect === "win") {
    [294, 370, 440, 587, 740].forEach((frequency, index) => {
      tone(frequency, 0.95 - index * 0.08, { type: index % 2 ? "sine" : "triangle", gain: 0.017, delay: index * 0.13 });
    });
  }
}

function renderSecret() {
  const game = state.active.game;
  const revealed = game.status !== "playing";
  elements.secretSlots.replaceChildren();
  elements.secretSlots.setAttribute("aria-label", revealed ? `秘密香方：${game.secret.map(essenceName).join("、")}` : "秘密香方尚未揭晓");
  if (!revealed) {
    for (let index = 0; index < game.params.slots; index += 1) {
      const cover = document.createElement("span");
      cover.className = "secret-cover";
      cover.setAttribute("aria-hidden", "true");
      cover.textContent = "?";
      elements.secretSlots.append(cover);
    }
    return;
  }
  for (const essence of game.secret) {
    const wrapper = document.createElement("span");
    wrapper.innerHTML = essenceMarkup(essence);
    wrapper.title = essenceName(essence);
    elements.secretSlots.append(wrapper.firstElementChild);
  }
}

function historyRow(record, index) {
  const item = document.createElement("li");
  item.className = "history-row";
  item.setAttribute(
    "aria-label",
    `第 ${index + 1} 轮，${record.pegs.map(essenceName).join("、")}；完全命中 ${record.feedback.exact}，成分正确位置错误 ${record.feedback.misplaced}`,
  );

  const round = document.createElement("span");
  round.className = "history-row__round";
  round.setAttribute("aria-hidden", "true");
  round.textContent = String(index + 1).padStart(2, "0");

  const pegs = document.createElement("div");
  pegs.className = "history-row__pegs";
  pegs.setAttribute("aria-hidden", "true");
  pegs.innerHTML = record.pegs.map((essence) => essenceMarkup(essence)).join("");

  const feedback = document.createElement("div");
  feedback.className = "history-row__feedback";
  feedback.setAttribute("aria-hidden", "true");
  for (const marker of feedbackMarkers(record.feedback, state.active.game.params.slots)) {
    const mark = document.createElement("i");
    mark.className = `feedback-mark ${marker}`;
    mark.textContent = marker === "exact" ? "✦" : marker === "misplaced" ? "◇" : "·";
    feedback.append(mark);
  }
  const summary = document.createElement("span");
  summary.className = "feedback-summary";
  summary.textContent = `完全 ${record.feedback.exact} · 成分 ${record.feedback.misplaced}`;
  feedback.append(summary);
  item.append(round, pegs, feedback);
  return item;
}

function renderHistory(scrollToLatest = false) {
  const game = state.active.game;
  elements.historyList.replaceChildren(...game.guesses.map(historyRow));
  elements.emptyHistory.hidden = game.guesses.length > 0;
  elements.historyCount.textContent = `${game.guesses.length} / ${game.params.guesses}`;
  if (scrollToLatest) {
    window.requestAnimationFrame(() => {
      elements.historyScroll.scrollTop = elements.historyScroll.scrollHeight;
    });
  }
}

function slotAriaLabel(index, essence) {
  const held = state.active.game.holds[index];
  return `第 ${index + 1} 槽，${essence ? `已放入${essenceName(essence)}` : "空着"}${held ? "，已留香到下一轮" : ""}。数字键放入，Delete 清空，空格切换留香。`;
}

function renderDraft(restoreFocus = false) {
  const game = state.active.game;
  const focusedWithin = restoreFocus && elements.draftRow.contains(document.activeElement);
  elements.draftRow.replaceChildren();
  elements.draftRow.style.setProperty("--slots", game.params.slots);
  game.draft.forEach((essence, index) => {
    const unit = document.createElement("div");
    unit.className = "draft-unit";
    unit.setAttribute("role", "group");
    unit.setAttribute("aria-label", `第 ${index + 1} 槽`);

    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = `draft-slot${essence ? "" : " is-empty"}`;
    slot.dataset.slot = String(index);
    slot.dataset.position = String(index + 1).padStart(2, "0");
    slot.tabIndex = index === state.active.selectedSlot ? 0 : -1;
    slot.setAttribute("aria-pressed", String(index === state.active.selectedSlot));
    slot.setAttribute("aria-label", slotAriaLabel(index, essence));
    if (index === state.active.selectedSlot) slot.setAttribute("data-realm-game-focus", "");
    if (essence) slot.innerHTML = essenceMarkup(essence);

    const hold = document.createElement("button");
    hold.type = "button";
    hold.className = "hold-button";
    hold.dataset.hold = String(index);
    hold.setAttribute("aria-pressed", String(game.holds[index]));
    hold.setAttribute("aria-label", `${game.holds[index] ? "取消" : "开启"}第 ${index + 1} 槽留香`);
    hold.textContent = game.holds[index] ? "已留香" : "留香";
    hold.disabled = game.status !== "playing";
    slot.disabled = game.status !== "playing";
    unit.append(slot, hold);
    elements.draftRow.append(unit);
  });
  if (focusedWithin) elements.draftRow.querySelector(`[data-slot="${state.active.selectedSlot}"]`)?.focus({ preventScroll: true });
}

function renderPalette() {
  const game = state.active.game;
  elements.ingredientPalette.replaceChildren();
  for (const ingredient of INGREDIENTS.slice(0, game.params.colours)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ingredient-button";
    button.dataset.essence = String(ingredient.id);
    button.setAttribute("aria-pressed", String(ingredient.id === state.active.selectedEssence));
    button.setAttribute("aria-label", `放入${ingredient.name}，形状${ingredient.shape}，纹理${ingredient.pattern}`);
    button.disabled = game.status !== "playing";
    button.innerHTML = `${essenceMarkup(ingredient.id)}<span>${ingredient.name}</span>`;
    elements.ingredientPalette.append(button);
  }
}

function renderDifficulty() {
  const recipe = state.active.recipe;
  const difficulty = difficultyById(recipe.difficulty);
  for (const button of elements.difficultyButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(recipe.mode === "archive" && button.dataset.difficulty === recipe.difficulty));
  }
  elements.difficultyNote.textContent = difficulty.note;
  elements.recipeKicker.textContent = recipe.mode === "daily"
    ? `今日香方 · ${recipe.day}`
    : `${difficulty.label}馆藏 · ${String(recipe.index + 1).padStart(2, "0")}`;
  elements.recipeTitle.textContent = recipe.title;
  elements.recipeParams.textContent = `${recipe.params.colours} 种精华 · ${recipe.params.slots} 滴香方 · ${recipe.params.guesses} 轮机会 · ${recipe.params.allowDuplicates ? "可重复" : "不重复"}`;
}

function renderCollection() {
  const summary = statsSummary(state.stats);
  elements.bottleCount.textContent = String(summary.bottleCount);
  elements.rareCount.textContent = String(summary.rareCount);
  elements.streakCount.textContent = String(summary.winStreak);
  elements.dailyCount.textContent = String(summary.dailyCount);
  const today = localDayKey();
  elements.dailyStatus.textContent = state.stats.dailyClears.includes(today) ? "今日已入柜 · 可再挑战" : "每日一瓶 · 经典参数";

  elements.bottleShelf.replaceChildren();
  const bottles = Object.values(state.stats.collection).sort((left, right) => right.unlockedAt.localeCompare(left.unlockedAt));
  if (!bottles.length) {
    const empty = document.createElement("li");
    const copy = document.createElement("strong");
    copy.textContent = "配方柜尚空，首瓶会在通关后入柜。";
    empty.append(copy);
    elements.bottleShelf.append(empty);
    return;
  }
  for (const bottle of bottles) {
    const item = document.createElement("li");
    item.classList.toggle("is-rare", bottle.rare);
    const icon = document.createElement("span");
    icon.className = "shelf-bottle";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "V";
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = bottle.name;
    const note = document.createElement("small");
    note.textContent = bottle.rare ? "稀有香瓶" : "馆藏香瓶";
    copy.append(name, note);
    const stars = document.createElement("b");
    stars.setAttribute("aria-label", `${bottle.stars} 星评级`);
    stars.textContent = "★".repeat(bottle.stars);
    item.append(icon, copy, stars);
    elements.bottleShelf.append(item);
  }
}

function renderStatus() {
  const game = state.active.game;
  const missing = game.draft.filter((value) => value === EMPTY_ESSENCE).length;
  const remaining = Math.max(0, game.params.guesses - game.guesses.length);
  const bestExact = game.guesses.reduce((best, { feedback }) => Math.max(best, feedback.exact), 0);
  const fill = game.status === "won" ? 100 : Math.round(bestExact / game.params.slots * 78);
  elements.bottleLiquid.style.setProperty("--fill", `${fill}%`);
  elements.roundRemaining.textContent = String(remaining);
  elements.draftStatus.textContent = game.status === "playing"
    ? missing ? `尚缺 ${missing} 滴` : isGuessSubmittable(game.draft, game.params) ? "可以验香" : "本轮不合法"
    : game.status === "won" ? "香方已成" : "机会用尽";
  elements.submitButton.disabled = game.status !== "playing" || !isGuessSubmittable(game.draft, game.params);
  elements.clearButton.disabled = game.status !== "playing" || game.draft.every((value) => value === EMPTY_ESSENCE);
  elements.hintButton.disabled = game.status !== "playing";
  elements.undoButton.disabled = state.active.history.length === 0;
  elements.resultUndoButton.disabled = state.active.history.length === 0;
  elements.bottleStage.classList.toggle("is-complete", game.status === "won");
  elements.bottleStage.classList.toggle("is-lost", game.status === "lost");

  if (game.status === "won") {
    const rating = remainingRating(game);
    const practice = lastOutcome?.practice === true || !Object.hasOwn(state.stats.bestByRecipe, game.recipe.id);
    elements.bottleStateLabel.textContent = practice ? "练习香方已经复原" : `${rating.label}香瓶已成形`;
    elements.bottleStateCopy.textContent = practice
      ? "答案曾经揭晓，本次不会改写奖励或个人最佳。"
      : `还剩 ${rating.remaining} 轮，瓶身已收进配方柜。`;
    setMessage(practice ? "练习香方完全命中" : "香方完全命中", `${game.params.slots} 滴精华与位置全部正确。`, "success");
  } else if (game.status === "lost") {
    elements.bottleStateLabel.textContent = "香气已经散逸";
    elements.bottleStateCopy.textContent = "最后一轮未能完全命中，密封香方已经揭晓。";
    setMessage("本次未能成方", "秘密香方已经揭晓；可撤销末轮作为练习继续推理，或换一张馆藏。", "warning");
  } else if (!game.guesses.length) {
    elements.bottleStateLabel.textContent = "香气尚在雾中";
    elements.bottleStateCopy.textContent = "提交一轮香方，印记会告诉你两类命中的总数。";
    setMessage("香方尚未落笔", "先选中一个香槽，再从精华盘放入香料。", "normal");
  } else {
    const latest = game.guesses.at(-1).feedback;
    elements.bottleStateLabel.textContent = `完全 ${latest.exact} · 成分 ${latest.misplaced}`;
    elements.bottleStateCopy.textContent = "香印不对应具体槽位；请结合所有历史继续排除。";
    setMessage("香印已经凝结", `完全命中 ${latest.exact}，成分正确但位置错误 ${latest.misplaced}。`);
  }
}

function render(options = {}) {
  renderDifficulty();
  renderSecret();
  renderHistory(options.scrollHistory === true);
  renderDraft(options.restoreDraftFocus === true);
  renderPalette();
  renderStatus();
  renderCollection();
  elements.muteButton.setAttribute("aria-pressed", String(state.preferences.muted));
  elements.muteButton.setAttribute("aria-label", state.preferences.muted ? "声音已静音，点击开启" : "声音已开启，点击静音");
  elements.muteButton.querySelector(".button-label").textContent = state.preferences.muted ? "静音" : "声音";
}

function pushHistory() {
  state.active.history.push({
    game: state.active.game,
    selectedSlot: state.active.selectedSlot,
    selectedEssence: state.active.selectedEssence,
    actions: state.active.actions,
  });
  if (state.active.history.length > HISTORY_LIMIT) state.active.history.shift();
}

function invalidAction(message) {
  elements.formulaCard.classList.remove("is-invalid");
  window.requestAnimationFrame(() => elements.formulaCard.classList.add("is-invalid"));
  window.setTimeout(() => elements.formulaCard.classList.remove("is-invalid"), 420);
  showToast(message, true);
  announceError(message);
  playSound("invalid");
}

function selectSlot(index, focus = false) {
  const game = state.active.game;
  if (!Number.isInteger(index) || index < 0 || index >= game.params.slots) return;
  state.active.selectedSlot = index;
  if (game.draft[index]) state.active.selectedEssence = game.draft[index];
  renderDraft(focus);
  renderPalette();
  writeSave();
}

function placeEssence(essence, options = {}) {
  const game = state.active.game;
  if (game.status !== "playing") return invalidAction("这张香方已经结算；请撤销或换一张馆藏。 ");
  const slot = state.active.selectedSlot;
  const result = setDraftPeg(game, slot, essence);
  if (!result.accepted) {
    if (result.reason === "unchanged") {
      state.active.selectedEssence = essence;
      renderPalette();
      return;
    }
    invalidAction("这滴精华无法放入当前香槽。 ");
    return;
  }
  pushHistory();
  state.active.game = result.game;
  state.active.selectedEssence = essence || state.active.selectedEssence;
  state.active.actions += 1;
  if (options.advance !== false && essence !== EMPTY_ESSENCE) {
    state.active.selectedSlot = Math.min(game.params.slots - 1, slot + 1);
  }
  render({ restoreDraftFocus: options.focus === true });
  writeSave();
  playSound(essence === EMPTY_ESSENCE ? "remove" : "place");
}

function toggleSelectedHold(slot = state.active.selectedSlot) {
  const result = toggleHold(state.active.game, slot);
  if (!result.accepted) return invalidAction("终局后不能再改变留香标记。 ");
  pushHistory();
  state.active.game = result.game;
  state.active.selectedSlot = slot;
  state.active.actions += 1;
  render({ restoreDraftFocus: true });
  writeSave();
  playSound("hold");
}

function clearDraft() {
  const game = state.active.game;
  if (game.status !== "playing" || game.draft.every((value) => value === EMPTY_ESSENCE)) return;
  pushHistory();
  let next = game;
  for (let index = 0; index < game.params.slots; index += 1) {
    if (next.draft[index] !== EMPTY_ESSENCE) next = setDraftPeg(next, index, EMPTY_ESSENCE).game;
  }
  state.active.game = next;
  state.active.actions += 1;
  render();
  writeSave();
  playSound("remove");
  showToast("本轮香方已经清空；留香标记仍保留。 ");
}

function useHint() {
  const candidate = suggestGuess(state.active.game);
  if (!candidate) return invalidAction("现有香印之间不一致，无法找到相容候选。 ");
  pushHistory();
  let next = state.active.game;
  candidate.forEach((essence, index) => {
    next = setDraftPeg(next, index, essence).game;
  });
  state.active.game = next;
  state.active.selectedEssence = candidate[state.active.selectedSlot];
  state.active.actions += 1;
  render();
  writeSave();
  playSound("hint");
  showToast("闻香建议已填入：它与所有公开香印相容，但不保证就是真正秘方。 ", false, 3900);
}

function reportRealmCompletion(payload) {
  if (typeof window.RealmArcade?.complete === "function") return window.RealmArcade.complete(payload);
  const queue = Array.isArray(window.__realmCompletionQueue)
    ? window.__realmCompletionQueue
    : (window.__realmCompletionQueue = []);
  enqueuePerfumeryCompletion(queue, payload);
  // The in-memory compatibility queue is not proof of delivery. Keep the
  // persisted outbox pending so realm:ready or a later page load retries the
  // same event id.
  return false;
}

function retryPendingRealmCompletion() {
  state.active = stagePerfumeryCompletion(state.active);
  if (state.active.completionOutbox.length === 0) return;
  writeSave();
  const realm = confirmPerfumeryCompletion(state.active, reportRealmCompletion);
  state.active = realm.active;
  writeSave();
}

function terminalOutcomeFallback() {
  const game = state.active.game;
  if (game.status === "lost") return { practice: true };
  if (game.status !== "won") return null;
  const rating = remainingRating(game);
  return {
    rating,
    bottle: bottleIdentity(game.recipe, game.secret, rating),
    newBottle: false,
    personalBest: false,
    practice: true,
  };
}

function handleTerminal() {
  const game = state.active.game;
  if (game.status === "playing") return;
  const pendingRealmReward = game.status === "won" && !state.active.completionReported;
  const rewardEligible = !hasRevealedRecipe(state.stats, game.recipe.id);
  if (state.active.recordedStatus !== game.status) {
    if (rewardEligible) {
      lastOutcome = recordOutcome(state.stats, game);
      state.stats = lastOutcome.stats;
    } else {
      lastOutcome = terminalOutcomeFallback();
    }
    state.active.recordedStatus = game.status;
  } else {
    lastOutcome = terminalOutcomeFallback();
    if (pendingRealmReward && lastOutcome) lastOutcome.practice = false;
  }
  state.stats = markRecipeRevealed(state.stats, game.recipe.id);
  state.active = stagePerfumeryCompletion(state.active);
  // Local settlement and the stable outbox must survive before the shared
  // host is called. If the host throws after persisting, retry is deduplicated
  // by the same eventId.
  writeSave();
  const realm = confirmPerfumeryCompletion(state.active, reportRealmCompletion);
  state.active = realm.active;
  writeSave();
  render({ scrollHistory: true });
  renderResult();
  scheduleResultDialog(realm.reward?.awarded > 0 ? (reduceMotion.matches ? 1400 : 6500) : undefined);
  playSound(game.status === "won" ? "win" : "lose");
}

function submitCurrent() {
  const game = state.active.game;
  const result = submitGuess(game);
  if (!result.accepted) {
    const messages = {
      incomplete: "当前档位不允许空白：请先放满所有香槽。 ",
      "all-blank": "允许空白的规则下也至少要放入一种精华。 ",
      duplicate: "当前参数禁止重复精华，请调整后再验香。 ",
      finished: "这张香方已经结算。 ",
    };
    return invalidAction(messages[result.reason] ?? "当前香方暂时不能提交。 ");
  }
  pushHistory();
  state.active.game = result.game;
  state.active.actions += 1;
  playSound("submit", result.feedback);
  if (result.game.status === "playing") {
    render({ scrollHistory: true });
    writeSave();
    showToast(`香印：完全命中 ${result.feedback.exact}，成分正确但位置错误 ${result.feedback.misplaced}。`, false, 3500);
  } else {
    handleTerminal();
  }
}

function closeResult() {
  cancelResultWait();
  if (elements.resultDialog.open) elements.resultDialog.close();
}

function startRecipe(recipe, message) {
  closeResult();
  const preferences = { ...state.preferences };
  const stats = state.stats;
  const completionOutbox = state.active.completionOutbox;
  const practice = hasRevealedRecipe(stats, recipe.id);
  state = freshRuntime(recipe, preferences, stats, completionOutbox);
  lastOutcome = null;
  render();
  writeSave();
  if (message) showToast(practice ? `${message} 答案曾经揭晓，本次只作练习，不计奖励。` : message, false, practice ? 3900 : 2600);
}

function nextArchiveRecipe(difficultyId = state.active.recipe.difficulty) {
  const current = state.active.recipe;
  const nextIndex = current.mode === "archive" && current.difficulty === difficultyId
    ? (current.index + 1) % ARCHIVE_RECIPE_COUNT
    : 0;
  const recipe = archiveRecipe(difficultyId, nextIndex);
  startRecipe(recipe, `馆藏已更换：${recipe.title}`);
}

function restartRecipe() {
  startRecipe(state.active.recipe, "蒸馏台已复位：同一张秘密香方重新开始。 ");
}

function startDaily() {
  const recipe = dailyRecipe();
  startRecipe(recipe, state.stats.dailyClears.includes(recipe.day) ? "今日香方已再次开启。 " : "今日香方已开启：每天同一设备上都可复现。 ");
}

function undo() {
  const previous = state.active.history.pop();
  if (!previous) return showToast("还没有可以撤销的操作。 ");
  closeResult();
  state.active.game = previous.game;
  state.active.selectedSlot = previous.selectedSlot;
  state.active.selectedEssence = previous.selectedEssence;
  state.active.actions = previous.actions;
  render({ restoreDraftFocus: true });
  writeSave();
  playSound("undo");
  showToast("已退回上一步；已经结算的奖励不会重复发放。 ");
}

function renderResult() {
  const game = state.active.game;
  const won = game.status === "won";
  const outcome = lastOutcome ?? terminalOutcomeFallback();
  elements.resultDialog.classList.toggle("is-lost", !won);
  elements.resultKicker.textContent = won ? "FORMULA DISTILLED" : "FORMULA DISPERSED";
  elements.resultTitle.textContent = won ? "香方成形" : "香气散逸";
  elements.resultCopy.textContent = won
    ? outcome.practice
      ? "你复原了已经揭晓的香方；本次作为练习，不会改写奖励、连胜或个人最佳。"
      : "瓶身在最后一枚香印落下时凝成，秘密香方已经收入你的配方柜。"
    : outcome?.practice
      ? "练习轮数已经用尽；答案仍然公开，本次不会改变连胜或其他奖励记录。"
      : "最后一轮未能完全命中。答案已经揭晓，你可以撤销末轮作为练习继续推理。";
  elements.resultGuesses.textContent = `${game.guesses.length} / ${game.params.guesses}`;
  elements.resultRating.textContent = won ? `${outcome.rating.label} · ${"★".repeat(outcome.rating.stars)}` : "未成方";
  elements.resultUnlock.textContent = won
    ? outcome.practice
      ? "练习成方：本次没有新增香瓶或境界值。"
      : outcome.newBottle ? `新香瓶入柜：${outcome.bottle.name}${outcome.bottle.rare ? " · 稀有" : ""}` : `${outcome.bottle.name} 的馆藏记录已更新。`
    : outcome?.practice
      ? `练习结束；秘密香方是 ${game.secret.map(essenceName).join("、")}。`
      : `本次连胜已中止；秘密香方是 ${game.secret.map(essenceName).join("、")}。`;
  elements.nextRecipeButton.textContent = game.recipe.mode === "daily" ? "回到馆藏" : "再调一瓶";
  elements.resultAnswer.replaceChildren();
  for (const essence of game.secret) {
    const holder = document.createElement("span");
    holder.innerHTML = essenceMarkup(essence);
    const token = holder.firstElementChild;
    token.title = essenceName(essence);
    elements.resultAnswer.append(token);
  }
  elements.resultAnswer.setAttribute("aria-label", `秘密香方：${game.secret.map(essenceName).join("、")}`);
}

function cancelResultWait() {
  resultWaitObserver?.disconnect();
  resultWaitObserver = null;
  window.clearTimeout(pendingResultTimer);
}

function blockingDialog(except = elements.resultDialog) {
  return [...document.querySelectorAll("dialog[open]")].find((dialog) => dialog !== except) ?? null;
}

function scheduleResultDialog(delayOverride) {
  cancelResultWait();
  const delay = Number.isFinite(delayOverride) ? delayOverride : reduceMotion.matches ? 0 : 620;
  const tryOpen = () => {
    if (state.active.game.status === "playing" || elements.resultDialog.open) return;
    if (blockingDialog()) {
      resultWaitObserver = new MutationObserver(() => {
        if (!blockingDialog()) {
          cancelResultWait();
          scheduleResultDialog();
        }
      });
      resultWaitObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: true });
      return;
    }
    rememberModalFocus();
    elements.resultDialog.showModal();
    elements.nextRecipeButton.focus({ preventScroll: true });
  };
  pendingResultTimer = window.setTimeout(tryOpen, delay);
}

function isRestorableFocus(target) {
  return target instanceof HTMLElement
    && target.isConnected
    && target !== document.body
    && target !== document.documentElement
    && !target.matches(":disabled")
    && !target.closest('[hidden], [inert], [aria-hidden="true"]')
    && target.getClientRects().length > 0;
}

function rememberModalFocus() {
  const active = document.activeElement;
  lastModalFocus = isRestorableFocus(active) ? active : null;
}

function restoreGameFocus() {
  const draftSlot = elements.draftRow.querySelector(`[data-slot="${state.active.selectedSlot}"]`);
  const target = isRestorableFocus(lastModalFocus)
    ? lastModalFocus
    : isRestorableFocus(draftSlot) ? draftSlot : elements.newGameButton;
  lastModalFocus = null;
  target?.focus({ preventScroll: true });
}

function openRules() {
  if (blockingDialog(elements.rulesDialog) || elements.rulesDialog.open) return;
  rememberModalFocus();
  elements.rulesDialog.showModal();
  elements.rulesCloseButton.focus({ preventScroll: true });
}

function closeRules() {
  if (elements.rulesDialog.open) elements.rulesDialog.close();
}

function toggleMute() {
  state.preferences.muted = !state.preferences.muted;
  if (!state.preferences.muted) {
    ensureAudio();
    tone(520, 0.12, { gain: 0.012 });
  }
  render();
  writeSave();
  showToast(state.preferences.muted ? "调香所已经静音。 " : "调香所声音已经开启。 ");
}

function createDifficultyButtons() {
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.difficulty = difficulty.id;
    button.textContent = difficulty.label;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${difficulty.label}难度，${difficulty.note}`);
    button.addEventListener("click", () => nextArchiveRecipe(difficulty.id));
    elements.difficultyButtons.append(button);
  }
}

elements.draftRow.addEventListener("click", (event) => {
  const hold = event.target.closest("button[data-hold]");
  if (hold) {
    state.active.selectedSlot = Number(hold.dataset.hold);
    toggleSelectedHold(Number(hold.dataset.hold));
    return;
  }
  const slot = event.target.closest("button[data-slot]");
  if (slot) selectSlot(Number(slot.dataset.slot), true);
});

elements.draftRow.addEventListener("focusin", (event) => {
  const slot = event.target.closest("button[data-slot]");
  if (slot) {
    state.active.selectedSlot = Number(slot.dataset.slot);
    renderPalette();
  }
});

elements.draftRow.addEventListener("keydown", (event) => {
  const slot = event.target.closest("button[data-slot]");
  if (!slot) return;
  const index = Number(slot.dataset.slot);
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const next = event.key === "Home" ? 0
      : event.key === "End" ? state.active.game.params.slots - 1
        : Math.max(0, Math.min(state.active.game.params.slots - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
    selectSlot(next, true);
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    const count = state.active.game.params.colours;
    const step = event.key === "ArrowDown" ? 1 : -1;
    state.active.selectedEssence = ((state.active.selectedEssence - 1 + step + count) % count) + 1;
    renderPalette();
    writeSave();
  } else if (/^[1-8]$/.test(event.key) && Number(event.key) <= state.active.game.params.colours) {
    event.preventDefault();
    state.active.selectedSlot = index;
    placeEssence(Number(event.key), { advance: true, focus: true });
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    state.active.selectedSlot = index;
    placeEssence(EMPTY_ESSENCE, { advance: false, focus: true });
  } else if (event.key === " ") {
    event.preventDefault();
    state.active.selectedSlot = index;
    toggleSelectedHold(index);
  } else if (event.key === "Enter") {
    event.preventDefault();
    state.active.selectedSlot = index;
    if (isGuessSubmittable(state.active.game.draft, state.active.game.params)) submitCurrent();
    else placeEssence(state.active.selectedEssence, { advance: true, focus: true });
  }
});

elements.ingredientPalette.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-essence]");
  if (!button) return;
  const essence = Number(button.dataset.essence);
  const restoreFocus = event.detail === 0;
  placeEssence(essence, { advance: true });
  if (restoreFocus) {
    elements.ingredientPalette.querySelector(`[data-essence="${essence}"]`)?.focus({ preventScroll: true });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
  if (event.target.closest("button, a, input, select, textarea") && !event.target.closest("#draft-row")) return;
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "z") {
    event.preventDefault();
    undo();
  } else if (key === "z" || key === "u") {
    event.preventDefault();
    undo();
  } else if (key === "h") {
    event.preventDefault();
    useHint();
  } else if (key === "r") {
    event.preventDefault();
    restartRecipe();
  } else if (key === "n") {
    event.preventDefault();
    nextArchiveRecipe();
  } else if (key === "d") {
    event.preventDefault();
    startDaily();
  } else if (key === "m") {
    event.preventDefault();
    toggleMute();
  } else if (event.key === "?") {
    event.preventDefault();
    openRules();
  }
});

document.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
document.addEventListener("keydown", ensureAudio, { once: true, capture: true });
window.addEventListener("realm:ready", retryPendingRealmCompletion);

elements.submitButton.addEventListener("click", submitCurrent);
elements.hintButton.addEventListener("click", useHint);
elements.clearButton.addEventListener("click", clearDraft);
elements.undoButton.addEventListener("click", undo);
elements.restartButton.addEventListener("click", restartRecipe);
elements.newGameButton.addEventListener("click", () => nextArchiveRecipe());
elements.dailyButton.addEventListener("click", startDaily);
elements.muteButton.addEventListener("click", toggleMute);
elements.rulesButton.addEventListener("click", openRules);
elements.footerRulesButton.addEventListener("click", openRules);
elements.rulesCloseButton.addEventListener("click", closeRules);
elements.nextRecipeButton.addEventListener("click", () => {
  if (state.active.recipe.mode === "daily") nextArchiveRecipe("standard");
  else nextArchiveRecipe();
});
elements.resultUndoButton.addEventListener("click", undo);
elements.stayButton.addEventListener("click", closeResult);

elements.collectionToggle.addEventListener("click", () => {
  const expanded = elements.collectionToggle.getAttribute("aria-expanded") === "true";
  elements.collectionToggle.setAttribute("aria-expanded", String(!expanded));
  elements.collectionToggle.textContent = expanded ? "展开" : "收起";
  elements.bottleShelf.hidden = expanded;
});

elements.rulesDialog.addEventListener("click", (event) => {
  if (event.target === elements.rulesDialog) closeRules();
});
elements.resultDialog.addEventListener("click", (event) => {
  if (event.target === elements.resultDialog) closeResult();
});
elements.rulesDialog.addEventListener("close", restoreGameFocus);
elements.resultDialog.addEventListener("close", restoreGameFocus);

createDifficultyButtons();
const restoreResult = readSave();
render();

if (state.active.game.status !== "playing") handleTerminal();
else if (state.active.completionOutbox.length > 0) retryPendingRealmCompletion();

if (restoreResult.restored) {
  setSavedMessage("已恢复上次调香进度 · 自动存档开启");
  showToast(state.active.game.status === "playing" ? "已恢复上次未完成的香方。 " : "已恢复上次结算后的配方柜。 ");
} else if (restoreResult.invalid) {
  showToast("旧存档无法安全读取，已回退到一张新的合法香方。 ", true, 3900);
  writeSave();
} else {
  setSavedMessage("自动存档已开启");
  writeSave();
}
