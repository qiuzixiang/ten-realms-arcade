import { LEVELS, CHAPTERS } from "./levels.mjs";
import { SPIRITS, analyse, applyColour, buildAdjacency, createState, isFixed, solveLevel, toggleNote } from "./engine.mjs";

const STORAGE_PREFIX = "mini-polish:four-spirit-valley:v1:";
const STORAGE = { progress: STORAGE_PREFIX + "progress", sessions: STORAGE_PREFIX + "sessions", settings: STORAGE_PREFIX + "settings", outbox: STORAGE_PREFIX + "outbox", tutorial: STORAGE_PREFIX + "tutorial-v1" };
const $ = (selector, base) => (base || document).querySelector(selector);
const home = $("[data-home]");
const game = $("[data-game]");
const board = $("[data-board]");
const status = $("[data-status]");
const tutorialDialog = $("[data-tutorial]");
const resultDialog = $("[data-result]");
const journalDialog = $("[data-journal]");
const licenseDialog = $("[data-license]");
const marks = ["麟", "羽", "狐", "龟"];
let local = null;
try { local = window.localStorage; } catch (error) { local = null; }
let currentLevel = LEVELS[0];
let currentSession = newSession(currentLevel);
let progress = safeRead(STORAGE.progress, { cleared: [], claims: [], runs: 0 });
if (!progress || !Array.isArray(progress.cleared) || !Array.isArray(progress.claims)) progress = { cleared: [], claims: [], runs: 0 };
let sessions = safeRead(STORAGE.sessions, {});
if (!sessions || typeof sessions !== "object" || Array.isArray(sessions)) sessions = {};
let noteMode = false;
let selectedRegion = -1;
let selectedSpirit = 0;
let tutorialIndex = 0;
let tutorialReturn = null;
let lastStatus = "";

function safeRead(key, fallback) {
  if (!local) return fallback;
  try { const raw = local.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (error) { return fallback; }
}
function safeWrite(key, value) {
  if (!local) return false;
  try { local.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
}
function createId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 0x100000000).toString(36);
}
function newSession(level) {
  return { version: 1, levelId: level.id, runId: createId("run"), timeline: [], state: createState(level), history: [], hintsUsed: 0, completed: false, mode: "campaign" };
}
function replayTimeline(level, timeline) {
  if (!Array.isArray(timeline) || timeline.length > 10000) return null;
  let state = createState(level);
  for (const action of timeline) {
    if (!action || typeof action !== "object" || !Number.isInteger(action.region) || !Number.isInteger(action.colour)) return null;
    const result = applyColour(state, level, action.region, action.colour);
    if (!result.changed) return null;
    state = result.state;
  }
  return state;
}
function restoreSession(candidate, level) {
  if (!candidate || candidate.version !== 1 || candidate.levelId !== level.id || typeof candidate.runId !== "string"
      || !/^run-[a-z0-9-]{5,80}$/i.test(candidate.runId)) return newSession(level);
  const state = replayTimeline(level, candidate.timeline);
  if (!state || !candidate.state || !Array.isArray(candidate.state.notes) || !Array.isArray(candidate.state.colours)
      || candidate.state.notes.length !== state.notes.length || candidate.state.colours.length !== state.colours.length
      || !Array.isArray(candidate.timeline)) return newSession(level);
  for (let region = 0; region < state.notes.length; region += 1) {
    const bits = candidate.state.notes[region];
    if (!Number.isInteger(bits) || bits < 0 || bits > 15) return newSession(level);
    if (state.colours[region] < 0) state.notes[region] = bits;
  }
  if (candidate.state.moves !== state.moves
      || candidate.state.colours.some((colour, region) => colour !== state.colours[region])) return newSession(level);
  const history = [];
  if (Array.isArray(candidate.history) && candidate.history.length <= 100) {
    for (const item of candidate.history) {
      const prior = replayTimeline(level, item.timeline);
      if (!prior || !Array.isArray(item.notes) || item.notes.length !== prior.notes.length) { history.length = 0; break; }
      const noteValues = item.notes.map((value, region) => Number.isInteger(value) && value >= 0 && value <= 15 && prior.colours[region] < 0 ? value : 0);
      prior.notes = noteValues;
      history.push({ timeline: item.timeline.map((entry) => ({ region: entry.region, colour: entry.colour })), notes: noteValues });
    }
  }
  const analysis = analyse(state, level);
  return { version: 1, levelId: level.id, runId: candidate.runId, timeline: candidate.timeline.map((item) => ({ region: item.region, colour: item.colour })), state, history, hintsUsed: Number.isInteger(candidate.hintsUsed) && candidate.hintsUsed >= 0 ? candidate.hintsUsed : 0, completed: analysis.solved, mode: candidate.mode === "daily" ? "daily" : "campaign" };
}
function saveCurrent() {
  sessions[currentLevel.id] = { version: 1, levelId: currentLevel.id, runId: currentSession.runId, timeline: currentSession.timeline, state: currentSession.state, history: currentSession.history, hintsUsed: currentSession.hintsUsed, completed: currentSession.completed, mode: currentSession.mode };
  safeWrite(STORAGE.sessions, sessions);
  safeWrite(STORAGE.progress, progress);
}
function say(text, kind) {
  status.textContent = text;
  status.className = "live-status" + (kind ? " is-" + kind : "");
  lastStatus = text;
}
function pushSnapshot() {
  currentSession.history.push({ timeline: currentSession.timeline.map((item) => ({ region: item.region, colour: item.colour })), notes: [...currentSession.state.notes] });
  currentSession.history = currentSession.history.slice(-100);
}
function loadLevel(level, mode) {
  currentLevel = level;
  currentSession = restoreSession(sessions[level.id], level);
  if (!sessions[level.id]) currentSession = newSession(level);
  if (mode) currentSession.mode = mode;
  noteMode = false;
  selectedRegion = -1;
  selectedSpirit = 0;
  home.hidden = true;
  game.hidden = false;
  renderGame();
  saveCurrent();
  window.scrollTo(0, 0);
}
function showHome() {
  saveCurrent();
  game.hidden = true;
  home.hidden = false;
  selectedRegion = -1;
  renderHome();
  window.scrollTo(0, 0);
}
function completeChapter(chapterId) {
  const chapterLevels = LEVELS.filter((level) => level.chapter === chapterId);
  return chapterLevels.length > 0 && chapterLevels.every((level) => progress.cleared.indexOf(level.id) >= 0);
}
function chapterUnlocked(chapterId) {
  return chapterId === 1 || completeChapter(chapterId - 1);
}
function renderHome() {
  const target = $("[data-chapters]");
  const completedCount = LEVELS.filter((level) => progress.cleared.indexOf(level.id) >= 0).length;
  $("[data-total-progress]").textContent = completedCount + " / 60 境已安居";
  target.innerHTML = "";
  for (const chapter of CHAPTERS) {
    const unlocked = chapterUnlocked(chapter.id);
    const items = LEVELS.filter((level) => level.chapter === chapter.id);
    const cleared = items.filter((level) => progress.cleared.indexOf(level.id) >= 0).length;
    const article = document.createElement("article");
    article.className = "chapter-card" + (unlocked ? "" : " is-locked");
    const heading = document.createElement("header");
    const number = document.createElement("span"); number.className = "chapter-number"; number.textContent = String(chapter.id).padStart(2, "0");
    const title = document.createElement("h3"); title.textContent = chapter.title;
    const label = document.createElement("small"); label.textContent = unlocked ? cleared + " / 10 已完成" : "完成上一章后开放";
    heading.append(number, title, label);
    const focus = document.createElement("p"); focus.className = "chapter-focus"; focus.textContent = chapter.focus;
    const progressBar = document.createElement("div"); progressBar.className = "chapter-progress";
    const fill = document.createElement("span"); fill.style.width = (cleared * 10) + "%"; progressBar.append(fill);
    const grid = document.createElement("div"); grid.className = "level-grid"; grid.setAttribute("aria-label", chapter.title + "的十道关卡");
    for (let index = 0; index < items.length; index += 1) {
      const level = items[index];
      const button = document.createElement("button"); button.type = "button"; button.className = "level-button" + (progress.cleared.indexOf(level.id) >= 0 ? " is-cleared" : "");
      button.textContent = String(index + 1).padStart(2, "0"); button.setAttribute("aria-label", chapter.title + "，第" + (index + 1) + "境：" + level.title);
      button.disabled = !unlocked;
      button.addEventListener("click", () => loadLevel(level, "campaign"));
      grid.append(button);
    }
    article.append(heading, focus, progressBar, grid); target.append(article);
  }
}
function anchorFor(layout) {
  const positions = new Map();
  layout.forEach((row, y) => row.forEach((region, x) => {
    if (!positions.has(region)) positions.set(region, []);
    positions.get(region).push([x, y]);
  }));
  const anchors = new Map();
  for (const [region, points] of positions) {
    let best = points[0]; let bestDistance = Infinity;
    const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    for (const point of points) {
      const distance = (point[0] - cx) * (point[0] - cx) + (point[1] - cy) * (point[1] - cy);
      if (distance < bestDistance) { best = point; bestDistance = distance; }
    }
    anchors.set(region, best[0] + "," + best[1]);
  }
  return anchors;
}
function renderBoard() {
  const analysis = analyse(currentSession.state, currentLevel);
  const conflictRegions = new Set();
  for (const pair of analysis.conflicts) { conflictRegions.add(pair[0]); conflictRegions.add(pair[1]); }
  const adjacency = buildAdjacency(currentLevel.layout);
  const anchors = anchorFor(currentLevel.layout);
  const height = currentLevel.layout.length;
  const width = currentLevel.layout[0].length;
  board.style.setProperty("--cols", String(width));
  board.style.setProperty("--rows", String(height));
  const maxWidth = Math.min(480, board.parentElement.clientWidth - 20);
  board.style.height = Math.max(1, Math.round(maxWidth * height / width)) + "px";
  const fragment = document.createDocumentFragment();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const region = currentLevel.layout[y][x];
      const colour = currentSession.state.colours[region];
      const cell = document.createElement("button"); cell.type = "button"; cell.className = "habitat-cell";
      cell.dataset.region = String(region); cell.dataset.x = String(x); cell.dataset.y = String(y); cell.dataset.colour = String(colour);
      if (x === 0 || currentLevel.layout[y][x - 1] !== region) cell.classList.add("b-left");
      if (x + 1 === width || currentLevel.layout[y][x + 1] !== region) cell.classList.add("b-right");
      if (y === 0 || currentLevel.layout[y - 1][x] !== region) cell.classList.add("b-top");
      if (y + 1 === height || currentLevel.layout[y + 1][x] !== region) cell.classList.add("b-bottom");
      if (isFixed(currentLevel, region)) cell.classList.add("is-fixed");
      if (conflictRegions.has(region)) cell.classList.add("is-conflict");
      if (region === selectedRegion) cell.classList.add("is-selected");
      else if (selectedRegion >= 0 && adjacency[selectedRegion].indexOf(region) >= 0) cell.classList.add("is-neighbor");
      const anchor = anchors.get(region) === x + "," + y;
      if (anchor) {
        const text = document.createElement("span"); text.className = "region-mark";
        if (colour >= 0) text.textContent = marks[colour];
        else if (currentSession.state.notes[region]) {
          text.className = "candidate-marks";
          for (let spirit = 0; spirit < 4; spirit += 1) if (currentSession.state.notes[region] & (1 << spirit)) { const mark = document.createElement("i"); mark.textContent = marks[spirit]; text.append(mark); }
        } else text.textContent = String(region + 1);
        cell.append(text);
      }
      if (isFixed(currentLevel, region) && anchor) { const shrine = document.createElement("span"); shrine.className = "shrine-mark"; shrine.textContent = "✦"; cell.append(shrine); }
      cell.setAttribute("aria-label", "第" + (region + 1) + "片山居，" + (isFixed(currentLevel, region) ? "固定神龛，" : "") + (colour >= 0 ? SPIRITS[colour].name : "未安置") + "，相邻" + adjacency[region].length + "境");
      cell.setAttribute("aria-pressed", String(region === selectedRegion));
      cell.addEventListener("click", () => selectRegion(region));
      cell.addEventListener("keydown", onCellKeydown);
      fragment.append(cell);
    }
  }
  board.replaceChildren(fragment);
  const regionButtons = document.createDocumentFragment();
  for (let region = 0; region < currentSession.state.colours.length; region += 1) {
    const button = document.createElement("button"); button.type = "button";
    button.className = (isFixed(currentLevel, region) ? "is-fixed " : "") + (region === selectedRegion ? "is-selected" : "");
    button.textContent = (isFixed(currentLevel, region) ? "✦ " : "") + "第 " + (region + 1) + " 片";
    button.setAttribute("aria-pressed", String(region === selectedRegion));
    button.addEventListener("click", () => selectRegion(region));
    regionButtons.append(button);
  }
  $("[data-regions]").replaceChildren(regionButtons);
  $("[data-moves]").textContent = String(currentSession.state.moves);
  $("[data-level-title]").textContent = currentLevel.title;
  const chapter = CHAPTERS.find((item) => item.id === currentLevel.chapter);
  $("[data-chapter-title]").textContent = "第" + currentLevel.chapter + "章 · " + chapter.title;
  $("[data-level-meta]").textContent = currentLevel.regionTotal + "片山居 · " + currentLevel.difficulty + " · Seed " + currentLevel.seed;
  const index = LEVELS.indexOf(currentLevel) % 10;
  $("[data-level-position]").textContent = "第 " + (index + 1) + " / 10 境";
  $("[data-prev-level]").disabled = index === 0;
  $("[data-next-level]").disabled = index === 9;
  if (analysis.conflicts.length) say(analysis.conflicts.length + " 处相邻山居颜色相同，调整红边提示的区域。", "warning");
  else if (analysis.solved) say("四灵和鸣，所有山居都已安定。", "good");
  else if (selectedRegion >= 0) say("已选第 " + (selectedRegion + 1) + " 片山居" + (isFixed(currentLevel, selectedRegion) ? "（固定神龛）" : "") + "。选择守护灵安置。", "");
  else say("先点选一片山居，再选择守护灵。", "");
  $("[data-selected-line]").textContent = selectedRegion >= 0 ? "当前选择：第 " + (selectedRegion + 1) + " 片" + (isFixed(currentLevel, selectedRegion) ? "固定神龛" : "山居") + " · 亮框标出相邻区域" : "尚未选中山居";
}
function renderPalette() {
  for (const button of document.querySelectorAll("[data-spirit]")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.spirit) === selectedSpirit));
  }
  const noteButton = $("[data-notes]"); noteButton.setAttribute("aria-pressed", String(noteMode)); noteButton.textContent = "候选印：" + (noteMode ? "开" : "关");
}
function renderGame() { renderBoard(); renderPalette(); }
function selectRegion(region) {
  selectedRegion = region;
  renderBoard();
  if (isFixed(currentLevel, region)) say("固定神龛的守护灵不可修改；可继续查看它的邻居。", "");
}
function commitState(nextState, action) {
  if (currentSession.completed) return;
  pushSnapshot();
  if (action) currentSession.timeline.push(action);
  currentSession.state = nextState;
  saveCurrent();
  renderBoard();
  if (analyse(currentSession.state, currentLevel).solved) finishLevel();
}
function useSpirit(spirit) {
  selectedSpirit = spirit;
  renderPalette();
  if (selectedRegion < 0) { say("先点选一片山居，再选择守护灵。", ""); return; }
  if (currentSession.completed) return;
  const outcome = noteMode ? toggleNote(currentSession.state, currentLevel, selectedRegion, spirit) : applyColour(currentSession.state, currentLevel, selectedRegion, spirit);
  if (!outcome.changed) { say(isFixed(currentLevel, selectedRegion) ? "固定神龛不可更改。" : "这次选择没有改变山居。", "warning"); return; }
  if (!noteMode) {
    const neighbors = buildAdjacency(currentLevel.layout)[selectedRegion];
    if (neighbors.some((region) => currentSession.state.colours[region] === spirit)) say("这片山居与相邻区域有颜色冲突，操作已保留，请查看红边。", "warning");
    commitState(outcome.state, { region: selectedRegion, colour: spirit });
  } else { commitState(outcome.state, null); }
}
function eraseSelected() {
  if (selectedRegion < 0) { say("先点选要清除的山居。", ""); return; }
  const outcome = applyColour(currentSession.state, currentLevel, selectedRegion, -1);
  if (outcome.changed) commitState(outcome.state, { region: selectedRegion, colour: -1 });
  else say(isFixed(currentLevel, selectedRegion) ? "固定神龛不可清除。" : "这里已经空着。", "");
}
function undo() {
  if (currentSession.completed) { say("这片山居已经完成，重开后可以继续尝试。", ""); return; }
  const previous = currentSession.history.pop();
  if (!previous) { say("还没有可撤销的操作。", ""); return; }
  const restored = replayTimeline(currentLevel, previous.timeline);
  if (!restored) { currentSession.history = []; say("存档记录无法复核，已保护当前关卡。", "warning"); return; }
  restored.notes = previous.notes.slice();
  currentSession.timeline = previous.timeline;
  currentSession.state = restored;
  saveCurrent(); renderBoard();
}
function resetLevel() {
  currentSession = newSession(currentLevel); selectedRegion = -1; noteMode = false; saveCurrent(); renderGame();
}
function requestHint() {
  if (currentSession.completed) { say("本境已完成，可回地图选择其他山居。", "good"); return; }
  const solution = solveLevel(currentLevel, { current: currentSession.state.colours, limit: 1 }).solutions[0];
  if (!solution) { say("当前安置与题面条件冲突；可以撤销或重开，再继续推理。", "warning"); return; }
  let region = selectedRegion;
  if (region < 0 || currentSession.state.colours[region] >= 0 || isFixed(currentLevel, region)) region = currentSession.state.colours.findIndex((colour, index) => colour < 0 && !isFixed(currentLevel, index));
  if (region < 0) { say("所有区域都已填写，请检查冲突提示。", "warning"); return; }
  const spirit = solution[region];
  const neighbors = buildAdjacency(currentLevel.layout)[region];
  const used = neighbors.filter((neighbor) => currentSession.state.colours[neighbor] >= 0).map((neighbor) => SPIRITS[currentSession.state.colours[neighbor]].name);
  currentSession.hintsUsed += 1; selectedRegion = region; saveCurrent(); renderBoard();
  const reason = used.length ? "它的邻居已有 " + used.join("、") + "，当前解留下了" + SPIRITS[spirit].name + "。" : "从完整邻接约束推演，一种可行安排是" + SPIRITS[spirit].name + "。";
  say("线索：第 " + (region + 1) + " 片山居可以安置" + SPIRITS[spirit].name + "。" + reason + "由你决定是否采用。", "");
}
function finishLevel() {
  if (currentSession.completed) return;
  currentSession.completed = true;
  const firstClear = progress.cleared.indexOf(currentLevel.id) < 0;
  if (firstClear) progress.cleared.push(currentLevel.id);
  const claims = [];
  if (firstClear) {
    const claim = "first-clear:" + currentLevel.id;
    if (progress.claims.indexOf(claim) < 0) { progress.claims.push(claim); claims.push(claim); }
  }
  if (!currentSession.hintsUsed && progress.claims.indexOf("independent:" + currentLevel.id) < 0) {
    const claim = "independent:" + currentLevel.id; progress.claims.push(claim); claims.push(claim);
  }
  const completionId = "four-spirit-valley:" + currentSession.runId + ":complete";
  const payload = { schemaVersion: 1, gameId: "four-spirit-valley", levelId: currentLevel.id, mode: currentSession.mode, runId: currentSession.runId, completionId, rewardClaims: claims, metrics: { moves: currentSession.state.moves, hintsUsed: currentSession.hintsUsed, firstClear }, completedAt: new Date().toISOString() };
  progress.runs = (progress.runs || 0) + 1;
  safeWrite(STORAGE.progress, progress);
  const outbox = safeRead(STORAGE.outbox, []); const queue = Array.isArray(outbox) ? outbox : [];
  if (!queue.some((item) => item.completionId === completionId)) queue.push(payload);
  safeWrite(STORAGE.outbox, queue);
  saveCurrent();
  deliverOutbox();
  renderHome();
  $("[data-result-copy]").textContent = "你为每片山居安置了守护灵，共享边界两侧各不相同。" + (firstClear ? " 手账新增一处收藏。" : " 这是一场新的复玩记录。") + (currentSession.hintsUsed ? " 本局用过线索。" : " 本局独立完成。");
  if (!resultDialog.open) resultDialog.showModal();
  renderBoard();
}
function deliverOutbox() {
  const queue = safeRead(STORAGE.outbox, []);
  if (!Array.isArray(queue) || !queue.length) return;
  const remaining = [];
  for (const payload of queue) {
    const valid = payload && payload.schemaVersion === 1 && payload.gameId === "four-spirit-valley"
      && LEVELS.some((level) => level.id === payload.levelId)
      && typeof payload.runId === "string"
      && payload.completionId === "four-spirit-valley:" + payload.runId + ":complete"
      && payload.metrics && Number.isInteger(payload.metrics.moves) && payload.metrics.moves > 0
      && typeof payload.completedAt === "string" && !Number.isNaN(Date.parse(payload.completedAt));
    if (!valid) continue;
    try {
      if (window.RealmArcade && typeof window.RealmArcade.complete === "function") window.RealmArcade.complete(payload);
      else { remaining.push(payload); continue; }
    } catch (error) { remaining.push(payload); }
  }
  safeWrite(STORAGE.outbox, remaining);
}
function renderJournal() {
  const target = $("[data-journal-grid]"); target.innerHTML = "";
  for (const spirit of SPIRITS) {
    const count = LEVELS.filter((level) => progress.cleared.indexOf(level.id) >= 0 && (level.clues[0] !== undefined || level.layout.length > 0)).length;
    const article = document.createElement("article"); article.className = "journal-card";
    const icon = document.createElement("b"); icon.textContent = spirit.glyph; icon.style.backgroundColor = ["#317da0", "#bd5739", "#8b60a7", "#498451"][spirit.id]; icon.style.color = "#fff";
    const text = document.createElement("span"); text.textContent = spirit.name;
    const caption = document.createElement("small"); caption.textContent = count ? "陪你安居 " + count + " 境" : "等待第一次相逢";
    text.append(caption); article.append(icon, text); target.append(article);
  }
}
function openDialog(dialog, trigger) {
  if (trigger) dialog.returnFocus = trigger;
  if (!dialog.open) dialog.showModal();
}
function closeDialog(dialog) { if (dialog.open) dialog.close(); }
function openTutorial(trigger) {
  tutorialIndex = 0;
  tutorialReturn = trigger || document.activeElement;
  renderTutorial();
  openDialog(tutorialDialog, tutorialReturn);
}
const tutorialCards = [
  { title: "看懂山居与神龛", image: "./assets/tutorial/01-elements.svg", copy: "每片连成一体的山居最终迎来一位守护灵。带有金色神龛点的区域已经固定。", bullets: ["共享一段边界才算相邻，对角只碰到一点不算。", "水麟、火羽、月狐、森龟用颜色、纹理与字形共同区分。"] },
  { title: "为山居安排守护灵", image: "./assets/tutorial/02-action.svg", copy: "这是首关从真实初态执行的一次合法安置。选择区域，再点守护灵卡片；候选印只记笔记。", bullets: ["亮框显示所选区域，邻区也会高亮。", "相同守护灵若共享边界，冲突会以红框和文字提示。"] },
  { title: "让整幅山谷安定", image: "./assets/tutorial/03-goal.svg", copy: "全部山居都正式着色，且每条相邻边两端不同，才算完成。", bullets: ["完成图由同一关卡引擎求解并复验。", "首次教程可跳过；在任意游戏页都能重看。"] },
];
function renderTutorial() {
  const card = tutorialCards[tutorialIndex];
  $("[data-tutorial-title]").textContent = card.title;
  const image = $("[data-tutorial-image]"); image.src = card.image; image.alt = card.title + "，灵泉初醒真实首关地图";
  $("[data-tutorial-copy]").textContent = card.copy;
  const list = $("[data-tutorial-bullets]"); list.replaceChildren();
  for (const text of card.bullets) { const item = document.createElement("li"); item.textContent = text; list.append(item); }
  $("[data-tutorial-position]").textContent = (tutorialIndex + 1) + " / 3";
  $("[data-tutorial-prev]").disabled = tutorialIndex === 0;
  $("[data-tutorial-next]").textContent = tutorialIndex === 2 ? "开始巡境" : "下一张";
}
function dismissTutorial() {
  safeWrite(STORAGE.tutorial, { version: 1, seen: true });
  closeDialog(tutorialDialog);
  if (tutorialReturn && typeof tutorialReturn.focus === "function") tutorialReturn.focus();
  else $("[data-daily]").focus();
}
function onCellKeydown(event) {
  if (/^[1-4]$/.test(event.key)) { event.preventDefault(); selectedRegion = Number(event.currentTarget.dataset.region); useSpirit(Number(event.key) - 1); return; }
  if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); eraseSelected(); return; }
  if (event.key.toLowerCase() === "n") { event.preventDefault(); noteMode = !noteMode; renderPalette(); say("候选印" + (noteMode ? "已开启，只记作笔记。" : "已关闭。"), ""); return; }
  const delta = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] }[event.key];
  if (!delta) return;
  event.preventDefault();
  let x = Number(event.currentTarget.dataset.x); let y = Number(event.currentTarget.dataset.y); const start = currentLevel.layout[y][x];
  while (currentLevel.layout[y + delta[1]] && currentLevel.layout[y + delta[1]][x + delta[0]] !== undefined) {
    x += delta[0]; y += delta[1]; const region = currentLevel.layout[y][x];
    if (region !== start) { const target = board.querySelector('[data-region="' + region + '"]'); if (target) target.focus(); break; }
  }
}
function openJournal() { renderJournal(); openDialog(journalDialog, $("[data-journal-open]")); }
function goRelative(offset) {
  const chapterLevels = LEVELS.filter((level) => level.chapter === currentLevel.chapter); const index = chapterLevels.indexOf(currentLevel); const next = chapterLevels[index + offset];
  if (next) loadLevel(next, currentSession.mode);
}

for (const button of document.querySelectorAll("[data-spirit]")) button.addEventListener("click", () => useSpirit(Number(button.dataset.spirit)));
$("[data-notes]").addEventListener("click", () => { noteMode = !noteMode; renderPalette(); say("候選印" + (noteMode ? "已開啟，只記作筆記。" : "已關閉。"), ""); });
$("[data-erase]").addEventListener("click", eraseSelected);
$("[data-undo]").addEventListener("click", undo);
$("[data-reset]").addEventListener("click", resetLevel);
$("[data-hint]").addEventListener("click", requestHint);
$("[data-home-button]").addEventListener("click", showHome);
$("[data-prev-level]").addEventListener("click", () => goRelative(-1));
$("[data-next-level]").addEventListener("click", () => goRelative(1));
$("[data-daily]").addEventListener("click", () => { const day = Math.floor(Date.now() / 86400000); loadLevel(LEVELS[((day % LEVELS.length) + LEVELS.length) % LEVELS.length], "daily"); });
$("[data-journal-open]").addEventListener("click", openJournal);
$("[data-journal-close]").addEventListener("click", () => closeDialog(journalDialog));
$("[data-license-open]").addEventListener("click", () => openDialog(licenseDialog, $("[data-license-open]")));
$("[data-license-close]").addEventListener("click", () => closeDialog(licenseDialog));
for (const dialog of [tutorialDialog, resultDialog, journalDialog, licenseDialog]) dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); });
for (const button of document.querySelectorAll("[data-tutorial-open]")) button.addEventListener("click", () => openTutorial(button));
$("[data-tutorial-close]").addEventListener("click", dismissTutorial);
$("[data-tutorial-prev]").addEventListener("click", () => { tutorialIndex = Math.max(0, tutorialIndex - 1); renderTutorial(); });
$("[data-tutorial-next]").addEventListener("click", () => { if (tutorialIndex === 2) dismissTutorial(); else { tutorialIndex += 1; renderTutorial(); } });
$("[data-result-close]").addEventListener("click", () => closeDialog(resultDialog));
$("[data-result-next]").addEventListener("click", () => { closeDialog(resultDialog); const same = LEVELS.filter((level) => level.chapter === currentLevel.chapter); const next = same[same.indexOf(currentLevel) + 1]; if (next) loadLevel(next, currentSession.mode); else showHome(); });
tutorialDialog.addEventListener("close", () => { if (tutorialReturn && typeof tutorialReturn.focus === "function") tutorialReturn.focus(); });
resultDialog.addEventListener("close", () => { if (!currentSession.completed) return; renderHome(); });
renderHome(); deliverOutbox();
if (!safeRead(STORAGE.tutorial, null) || safeRead(STORAGE.tutorial, {}).version !== 1) window.setTimeout(() => openTutorial($("[data-daily]")), 180);
