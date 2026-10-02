import {
  applyMove, cellAt, createPuzzle, evaluatePosition, isPlot, isRune,
  keyOf, normalizePosition, pointFromKey, positionToJSON,
} from "./logic.mjs";
import { CHAPTERS, LEVELS, findLevel } from "./levels.mjs";
import { explainStep } from "./solver.mjs";

const GAME_ID = "firefly-nocturne";
const GENERATOR_VERSION = "1";
const PREFIX = "mini-polish:firefly-nocturne:v1:";
const SAVE_KEY = `${PREFIX}save`;
const TUTORIAL_KEY = `${PREFIX}tutorial:1`;
const HISTORY_LIMIT = 100;
const PLANT_NAMES = ["门阶蕨", "零灯鸢尾", "花墙藤", "夜竹", "水荷", "星花"];
const PLANT_DETAILS = ["新芽", "叶缘", "叶脉", "花苞", "露滴", "满庭"];
const PLANT_THRESHOLDS = [1, 2, 4, 6, 8, 10];
const smallScreen = window.matchMedia("(max-width: 620px)");
const $ = (selector) => document.querySelector(selector);
const clear = (element) => { while (element.firstChild) element.removeChild(element.firstChild); };

const el = {
  home: $("#home-view"), chapters: $("#chapters-view"), atlas: $("#atlas-view"), game: $("#game-view"),
  chapterList: $("#chapter-list"), board: $("#board"), boardWrap: $("#board-wrap"),
  zones: $("#zone-layer"), precision: $("#precision-panel"), precisionGrid: $("#precision-grid"),
  status: $("#status-message"), save: $("#save-message"), tutorial: $("#tutorial-dialog"),
  win: $("#win-dialog"), announcement: $("#announcement"),
};

const freshRunId = () => window.crypto && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const state = {
  view: "home", level: LEVELS[0], bulbs: new Set(), marks: new Set(), history: [],
  tool: "bulb", selectedKey: null, zone: null, hintedKey: null, hintStage: 0,
  hintCount: 0, runId: freshRunId(), elapsedBase: 0, clockStart: null,
  completed: false, completedRecords: {}, outbox: [], dispatched: new Set(),
  soundOn: false, tutorialSeen: false, tutorialStep: 0, tutorialMarksSeen: true,
  modalReturnFocus: null,
};

function announce(message) {
  el.announcement.textContent = "";
  window.requestAnimationFrame(() => { el.announcement.textContent = message; });
}

function setMessage(message) { el.status.textContent = message; }

function elapsedMs() {
  return state.elapsedBase + (state.clockStart === null ? 0 : Date.now() - state.clockStart);
}

function freezeClock() {
  if (state.clockStart !== null) {
    state.elapsedBase = elapsedMs();
    state.clockStart = null;
  }
}

function resumeClock() {
  if (state.clockStart === null && !state.completed) state.clockStart = Date.now();
}

function formatTime(milliseconds) {
  const total = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function validSnapshot(level, input) {
  if (!input || !Array.isArray(input.bulbs) || !Array.isArray(input.marks)) return null;
  if (input.bulbs.some((key) => typeof key !== "string") || input.marks.some((key) => typeof key !== "string")) return null;
  const bulbSet = new Set(input.bulbs);
  const markSet = new Set(input.marks);
  if (bulbSet.size !== input.bulbs.length || markSet.size !== input.marks.length) return null;
  for (const key of [...bulbSet, ...markSet]) {
    const point = pointFromKey(key);
    if (!point || key !== keyOf(point.row, point.column) || !isPlot(cellAt(level, point.row, point.column))) return null;
  }
  for (const key of bulbSet) if (markSet.has(key)) return null;
  return { bulbs: bulbSet, marks: markSet };
}

function recordIsValid(level, record) {
  if (!record || typeof record !== "object" || !Array.isArray(record.bulbs)) return false;
  const parsed = validSnapshot(level, { bulbs: record.bulbs, marks: [] });
  return Boolean(parsed && evaluatePosition(level, parsed).complete
    && record.claimId === `${GAME_ID}:first:${level.id}`
    && typeof record.runId === "string" && record.runId.length > 0 && record.runId.length <= 100
    && record.completionId === `${GAME_ID}:${level.id}:${record.runId}`);
}

function readSave() {
  let recoveredRecords = {};
  let recoveredOutbox = [];
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    state.tutorialSeen = localStorage.getItem(TUTORIAL_KEY) === "seen";
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.version !== 1) throw new Error("save version");
    const records = {};
    if (saved.completedRecords && typeof saved.completedRecords === "object") {
      for (const [id, record] of Object.entries(saved.completedRecords)) {
        const candidate = findLevel(id);
        if (candidate && recordIsValid(candidate, record)) records[id] = record;
      }
    }
    recoveredRecords = records;
    recoveredOutbox = Array.isArray(saved.outbox)
      ? saved.outbox.reduce((events, event) => {
        if (!event || typeof event.levelId !== "string") return events;
        const record = records[event.levelId];
        const item = findLevel(event.levelId);
        if (!record || !item || event.completionId !== record.completionId) return events;
        events.push({
          gameId: GAME_ID, levelId: item.id, generatorVersion: item.generatorVersion,
          seed: item.seed, runId: record.runId, completionId: record.completionId,
          claimId: record.claimId,
          elapsedMs: Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0
            ? Math.min(record.elapsedMs, 86400000) : 0,
          hintsUsed: Number.isInteger(record.hintsUsed) && record.hintsUsed >= 0
            ? Math.min(record.hintsUsed, 10000) : 0,
          firstClear: true,
        });
        return events;
      }, []).slice(-60) : [];
    if (!saved.active) throw new Error("missing active position");
    const level = findLevel(saved.active.levelId);
    if (!level || saved.active.generatorVersion !== level.generatorVersion) throw new Error("level version");
    const active = validSnapshot(level, saved.active);
    if (!active) throw new Error("active position");
    const history = Array.isArray(saved.active.history)
      ? saved.active.history.slice(-HISTORY_LIMIT).map((item) => validSnapshot(level, item)) : [];
    if (history.some((item) => !item)) throw new Error("history");
    state.completedRecords = records;
    state.level = level;
    state.bulbs = active.bulbs;
    state.marks = active.marks;
    state.history = history;
    state.runId = typeof saved.active.runId === "string" && saved.active.runId.length <= 100
      ? saved.active.runId : freshRunId();
    state.elapsedBase = Number.isFinite(saved.active.elapsedMs) && saved.active.elapsedMs >= 0
      ? Math.min(saved.active.elapsedMs, 86400000) : 0;
    state.hintCount = Number.isInteger(saved.active.hintCount) && saved.active.hintCount >= 0
      ? Math.min(saved.active.hintCount, 10000) : 0;
    state.completed = evaluatePosition(level, active).complete;
    state.soundOn = saved.soundOn === true;
    state.selectedKey = [...active.bulbs][0] || firstPlotKey(level);
    state.outbox = recoveredOutbox;
  } catch (error) {
    state.level = LEVELS[0];
    state.bulbs = new Set(); state.marks = new Set(); state.history = [];
    state.selectedKey = firstPlotKey(state.level);
    state.completedRecords = recoveredRecords; state.outbox = recoveredOutbox;
    el.save.textContent = "旧进度无法验证，已从首关重新开始";
    el.save.classList.add("is-error");
  }
}

function saveGame() {
  const active = Object.assign({
    levelId: state.level.id,
    generatorVersion: state.level.generatorVersion,
  }, positionToJSON(state), {
    history: state.history.map(positionToJSON),
    runId: state.runId,
    elapsedMs: elapsedMs(),
    hintCount: state.hintCount,
  });
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 1, active, soundOn: state.soundOn,
      completedRecords: state.completedRecords, outbox: state.outbox,
    }));
    el.save.textContent = "进度保存在本机";
    el.save.classList.remove("is-error");
    return true;
  } catch (error) {
    el.save.textContent = "本机存储不可用，本次进度可能丢失";
    el.save.classList.add("is-error");
    return false;
  }
}

function saveTutorialSeen() {
  state.tutorialSeen = true;
  try { localStorage.setItem(TUTORIAL_KEY, "seen"); } catch (error) { /* private mode */ }
}

function firstPlotKey(level) {
  for (let row = 0; row < level.height; row += 1) {
    for (let column = 0; column < level.width; column += 1) {
      if (isPlot(cellAt(level, row, column))) return keyOf(row, column);
    }
  }
  return null;
}

function showView(view) {
  const previousFocus = document.activeElement;
  if (state.view === "game" && view !== "game") freezeClock();
  state.view = view;
  el.home.hidden = view !== "home";
  el.chapters.hidden = view !== "chapters";
  el.atlas.hidden = view !== "atlas";
  el.game.hidden = view !== "game";
  if (view === "game") resumeClock();
  if (view === "home") updateHome();
  if (view === "chapters") renderChapters();
  if (view === "atlas") renderAtlas();
  if (view === "game") renderGame();
  window.scrollTo(0, 0);
  if (!previousFocus || !previousFocus.isConnected || !previousFocus.getClientRects().length) {
    if (view === "game") focusGameEntry();
    else $(`#${view === "chapters" ? "chapters" : view === "atlas" ? "atlas" : "home"}-title`).focus();
  }
}

function updateHome() {
  const done = Object.keys(state.completedRecords).length;
  $("#home-progress").textContent = `已点亮 ${done} / ${LEVELS.length} 座小庭院`;
  $("#continue-button").textContent = done === 0 && state.history.length === 0 ? "开始夜游" : "继续夜游";
}

function renderChapters() {
  const done = Object.keys(state.completedRecords).length;
  $("#campaign-progress").textContent = `${done} / ${LEVELS.length} 关已完成`;
  clear(el.chapterList);
  CHAPTERS.forEach((chapter, chapterIndex) => {
    const levels = LEVELS.filter((level) => level.chapterId === chapter.id);
    const completed = levels.filter((level) => state.completedRecords[level.id]).length;
    const card = document.createElement("article");
    card.className = "chapter-card";
    const art = document.createElement("div"); art.className = "chapter-art";
    const image = document.createElement("img");
    image.src = `./assets/chapter-${chapterIndex + 1}.svg`;
    image.alt = ""; image.loading = "lazy";
    art.append(image);
    const body = document.createElement("div"); body.className = "chapter-body";
    const head = document.createElement("div"); head.className = "chapter-head";
    const name = document.createElement("h2"); name.textContent = chapter.title;
    const count = document.createElement("strong"); count.textContent = `${completed} / ${levels.length}`;
    head.append(name, count);
    const description = document.createElement("p"); description.textContent = chapter.subtitle || "循着光，走进下一座庭院。";
    const grid = document.createElement("div"); grid.className = "level-grid";
    for (const [index, level] of levels.entries()) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "level-tile";
      button.textContent = String(index + 1).padStart(2, "0");
      button.setAttribute("aria-label", `${chapter.title}第${index + 1}关：${level.title}${state.completedRecords[level.id] ? "，已完成" : ""}`);
      if (state.completedRecords[level.id]) button.classList.add("is-complete");
      if (level.id === state.level.id) button.classList.add("is-current");
      button.addEventListener("click", () => startLevel(level));
      grid.append(button);
    }
    body.append(head, description, grid); card.append(art, body); el.chapterList.append(card);
  });
}

function renderAtlas() {
  clear($("#atlas-list"));
  const discovered = CHAPTERS.reduce((total, chapter) => total + PLANT_THRESHOLDS.filter((threshold) =>
    LEVELS.filter((level) => level.chapterId === chapter.id && state.completedRecords[level.id]).length >= threshold,
  ).length, 0);
  $("#atlas-progress").textContent = `${discovered} / 36 处细节已发现`;
  CHAPTERS.forEach((chapter, index) => {
    const completed = LEVELS.filter((level) => level.chapterId === chapter.id && state.completedRecords[level.id]).length;
    const revealed = PLANT_THRESHOLDS.filter((threshold) => completed >= threshold).length;
    const card = document.createElement("article"); card.className = "plant-card";
    const figure = document.createElement("div"); figure.className = "plant-art";
    figure.style.opacity = String(.3 + revealed * .115);
    const image = document.createElement("img");
    image.src = `./assets/plant-${index + 1}.svg`; image.alt = ""; image.loading = "lazy";
    figure.append(image);
    const copy = document.createElement("div"); copy.className = "plant-copy";
    const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow";
    eyebrow.textContent = `第 ${index + 1} 章 · ${chapter.title}`;
    const title = document.createElement("h2"); title.textContent = revealed ? PLANT_NAMES[index] : "未发现的花叶";
    const progress = document.createElement("p"); progress.className = "quiet-note";
    progress.textContent = `完成 ${completed} / 10 关 · 发现 ${revealed} / 6 处细节`;
    const seals = document.createElement("div"); seals.className = "plant-seals";
    PLANT_DETAILS.forEach((name, detailIndex) => {
      const seal = document.createElement("span");
      seal.className = detailIndex < revealed ? "is-unlocked" : "";
      seal.textContent = detailIndex < revealed ? name : "·";
      seal.setAttribute("aria-label", `${name}${detailIndex < revealed ? "已发现" : `，完成本章 ${PLANT_THRESHOLDS[detailIndex]} 关后发现`}`);
      seals.append(seal);
    });
    copy.append(eyebrow, title, progress, seals); card.append(figure, copy);
    $("#atlas-list").append(card);
  });
}

function cellLabel(level, row, column, evaluation) {
  const cell = cellAt(level, row, column);
  const key = keyOf(row, column);
  const location = `第${row + 1}行第${column + 1}列`;
  if (cell === "#") return `${location}，无数字陶石墙`;
  if (isRune(cell)) {
    const status = evaluation.runes.get(key);
    return `${location}，数字${cell}陶石，当前相邻${status.count}盏灯${status.impossible ? "，有矛盾" : ""}`;
  }
  const parts = [location, "石径"];
  if (evaluation.bulbs.has(key)) parts.push(evaluation.conflicts.has(key) ? "互照的萤灯" : "萤灯");
  else if (evaluation.marks.has(key)) parts.push("排除记号");
  else parts.push(evaluation.light.has(key) ? "已照亮" : "未照亮");
  return parts.join("，");
}

function lampGlyph() {
  const wings = document.createElement("span"); wings.className = "lamp-glyph";
  const core = document.createElement("i"); core.className = "lamp-core"; wings.append(core);
  return wings;
}

function createCell(level, row, column, evaluation, interactive = true) {
  const cell = cellAt(level, row, column);
  const key = keyOf(row, column);
  const button = document.createElement(interactive ? "button" : "div");
  if (interactive) button.type = "button";
  button.className = `cell ${isPlot(cell) ? "cell-plot" : "cell-wall"}`;
  button.dataset.key = key;
  if (isRune(cell)) button.classList.add("cell-clue");
  if (evaluation.light.has(key)) button.classList.add("is-lit");
  if (evaluation.conflicts.has(key)) button.classList.add("is-conflict");
  if (key === state.selectedKey && interactive) button.classList.add("is-selected");
  if (key === state.hintedKey && interactive) button.classList.add("is-hinted");
  if (isRune(cell) && evaluation.runes.get(key).exact) button.classList.add("is-exact");
  if (isRune(cell) && evaluation.runes.get(key).impossible) button.classList.add("is-impossible");
  const inner = document.createElement("span"); inner.className = "cell-inner";
  if (isRune(cell)) inner.textContent = cell;
  if (evaluation.bulbs.has(key)) inner.append(lampGlyph());
  else if (evaluation.marks.has(key)) {
    const cross = document.createElement("span"); cross.className = "cross-glyph"; cross.textContent = "×"; inner.append(cross);
  }
  button.append(inner);
  if (interactive) {
    button.setAttribute("aria-label", cellLabel(level, row, column, evaluation));
    button.tabIndex = key === state.selectedKey && isPlot(cell) ? 0 : -1;
    if (!isPlot(cell)) button.disabled = true;
  }
  return button;
}

function renderBoard(evaluation) {
  el.boardWrap.style.maxWidth = `${Math.min(540, state.level.width * 80)}px`;
  el.board.style.setProperty("--columns", String(state.level.width));
  clear(el.board);
  for (let row = 0; row < state.level.height; row += 1) {
    for (let column = 0; column < state.level.width; column += 1) {
      el.board.append(createCell(state.level, row, column, evaluation));
    }
  }
  renderZones();
  renderPrecision(evaluation);
}

function usesPrecision() {
  if (!smallScreen.matches) return false;
  return el.board.clientWidth / state.level.width < 44;
}

function renderZones() {
  const dense = usesPrecision();
  el.board.dataset.dense = String(dense);
  el.zones.hidden = !dense;
  if (!dense) {
    state.zone = null; el.precision.hidden = true;
    return;
  }
  clear(el.zones);
  for (let row = 0; row < state.level.height; row += 3) {
    for (let column = 0; column < state.level.width; column += 3) {
      const zone = { row, column, height: Math.min(3, state.level.height - row), width: Math.min(3, state.level.width - column) };
      const button = document.createElement("button");
      button.type = "button";
      button.className = "zone-button";
      if (state.zone && state.zone.row === row && state.zone.column === column) button.classList.add("is-active");
      button.style.left = `${column / state.level.width * 100}%`;
      button.style.top = `${row / state.level.height * 100}%`;
      button.style.width = `${zone.width / state.level.width * 100}%`;
      button.style.height = `${zone.height / state.level.height * 100}%`;
      button.dataset.row = String(row); button.dataset.column = String(column);
      button.setAttribute("aria-label", `第${row + 1}至${row + zone.height}行、第${column + 1}至${column + zone.width}列分区，打开精确落灯面板`);
      button.addEventListener("click", () => { state.zone = zone; renderGame(); $("#precision-close").focus(); });
      el.zones.append(button);
    }
  }
}

function renderPrecision(evaluation) {
  if (!usesPrecision() || !state.zone) { el.precision.hidden = true; return; }
  el.precision.hidden = false;
  const { row, column, height, width } = state.zone;
  $("#precision-title").textContent = `第 ${row + 1}–${row + height} 行 · 第 ${column + 1}–${column + width} 列`;
  $("#precision-subtitle").textContent = "面板与整盘同步，箭头方向的光可继续延伸";
  clear(el.precisionGrid);
  for (let deltaRow = 0; deltaRow < 3; deltaRow += 1) {
    for (let deltaColumn = 0; deltaColumn < 3; deltaColumn += 1) {
      if (deltaRow >= height || deltaColumn >= width) {
        const blank = document.createElement("span"); blank.className = "precision-cell is-wall"; blank.setAttribute("aria-hidden", "true");
        el.precisionGrid.append(blank); continue;
      }
      const r = row + deltaRow; const c = column + deltaColumn;
      const key = keyOf(r, c); const cell = cellAt(state.level, r, c);
      const button = document.createElement("button"); button.type = "button";
      button.className = `precision-cell${isPlot(cell) ? "" : " is-wall"}`;
      if (evaluation.light.has(key)) button.classList.add("is-lit");
      if (evaluation.conflicts.has(key)) button.classList.add("is-conflict");
      if (key === state.selectedKey) button.classList.add("is-selected");
      button.dataset.key = key;
      button.setAttribute("aria-label", cellLabel(state.level, r, c, evaluation));
      if (!isPlot(cell)) button.disabled = true;
      if (isRune(cell)) button.textContent = cell;
      else if (evaluation.bulbs.has(key)) button.append(lampGlyph());
      else if (evaluation.marks.has(key)) {
        const cross = document.createElement("span"); cross.className = "cross-glyph"; cross.textContent = "×"; button.append(cross);
      }
      const coordinates = document.createElement("small"); coordinates.textContent = `${r + 1},${c + 1}`; button.append(coordinates);
      if (isPlot(cell) && evaluation.light.has(key)) {
        const arrows = [];
        for (const [dr, dc, symbol] of [[-1, 0, "↑"], [0, 1, "→"], [1, 0, "↓"], [0, -1, "←"]]) {
          const nextRow = r + dr; const nextColumn = c + dc;
          const outsideZone = nextRow < row || nextRow >= row + height
            || nextColumn < column || nextColumn >= column + width;
          if (!outsideZone || !isPlot(cellAt(state.level, nextRow, nextColumn))) continue;
          const nextLight = evaluation.light.get(keyOf(nextRow, nextColumn));
          if (nextLight && [...evaluation.light.get(key)].some((source) => nextLight.has(source))) arrows.push(symbol);
        }
        if (arrows.length) {
          const extension = document.createElement("span"); extension.className = "flow-arrow";
          extension.textContent = arrows.join(""); extension.setAttribute("aria-hidden", "true");
          button.append(extension);
        }
      }
      el.precisionGrid.append(button);
    }
  }
}

function statusFromEvaluation(evaluation) {
  if (evaluation.complete) return "所有石径都亮了，萤灯彼此守住了距离。";
  if (evaluation.conflicts.size) return `有 ${evaluation.conflicts.size} 盏萤灯相互照见。撤销或移开其中一盏。`;
  const impossible = [...evaluation.runes.values()].filter((clue) => clue.impossible).length;
  if (impossible) return `有 ${impossible} 处数字陶石暂时矛盾；留意邻灯与排除记号。`;
  if (evaluation.unlit.size) return `还有 ${evaluation.unlit.size} 块石径未亮。墙会截住光，沿行列寻找灯位。`;
  return "石径已经见光，还要让每块数字陶石旁的灯数刚刚好。";
}

function renderGame() {
  if (state.view !== "game") return;
  const level = state.level;
  const evaluation = evaluatePosition(level, state);
  const chapter = CHAPTERS.find((item) => item.id === level.chapterId);
  const index = LEVELS.filter((item) => item.chapterId === level.chapterId).findIndex((item) => item.id === level.id);
  $("#level-kicker").textContent = `${chapter ? chapter.title : "夜庭"} · 第 ${String(index + 1).padStart(2, "0")} 庭`;
  $("#level-title").textContent = level.title;
  $("#lit-count").textContent = `${evaluation.litCount}/${evaluation.totalPlots}`;
  $("#clue-count").textContent = `${evaluation.exactRunes}/${evaluation.totalRunes}`;
  $("#conflict-count").textContent = String(evaluation.conflicts.size);
  $("#conflict-chip").hidden = evaluation.conflicts.size === 0;
  $("#bulb-count").textContent = String(state.bulbs.size);
  $("#hint-count").textContent = String(state.hintCount);
  $("#time-count").textContent = formatTime(elapsedMs());
  $("#progress-fill").style.width = `${Math.round(evaluation.lightProgress * 100)}%`;
  $("#undo-button").disabled = state.history.length === 0;
  updateToolButtons();
  setMessage(statusFromEvaluation(evaluation));
  renderBoard(evaluation);
  $("#board-help").textContent = usesPrecision()
    ? "先点整盘的分区，再在 3×3 精确面板选格。数字是原行列；箭头表示光跨出分区。"
    : "选择萤灯或记号，再点石径。方向键选格，Enter 落灯，M 记号。";
}

function updateToolButtons() {
  for (const tool of ["bulb", "mark"]) {
    const button = $(`#${tool}-tool`);
    button.classList.toggle("is-active", state.tool === tool);
    button.setAttribute("aria-pressed", String(state.tool === tool));
  }
}

function playTone(frequency = 600) {
  if (!state.soundOn) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    const context = new Audio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.025, context.currentTime + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + .17);
    oscillator.onended = () => context.close();
  } catch (error) { /* audio is optional */ }
}

function commitCell(key, tool = state.tool) {
  const move = applyMove(state.level, state, { type: tool === "mark" ? "toggle-mark" : "toggle-bulb", key });
  if (!move.accepted) {
    const reason = move.reason === "marked" ? "先清除叉号，才能在这里落灯。"
      : move.reason === "lit" ? "已照亮的石径不能新加叉号。"
        : move.reason === "bulb" ? "这里已有萤灯，先切换到萤灯工具收起它。" : "这里只能在石径上操作。";
    setMessage(reason); announce(reason); playTone(180); return;
  }
  state.history.push(positionToJSON(state));
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
  state.bulbs = move.bulbs; state.marks = move.marks;
  state.selectedKey = key; state.hintedKey = null; state.hintStage = 0;
  const wasCompleted = state.completed;
  state.completed = false;
  if (wasCompleted) resumeClock();
  playTone(tool === "bulb" ? 690 : 430);
  const evaluation = evaluatePosition(state.level, state);
  if (evaluation.complete) {
    finishLevel(evaluation);
  } else {
    saveGame(); renderGame(); focusSelectedCell();
  }
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return;
  state.bulbs = new Set(previous.bulbs); state.marks = new Set(previous.marks);
  const wasCompleted = state.completed;
  state.completed = false; state.hintedKey = null; state.hintStage = 0;
  if (wasCompleted) resumeClock();
  if (el.win.open) closeModal(el.win);
  saveGame(); renderGame(); focusSelectedCell(); playTone(390);
  announce("已撤销上一步");
}

function restart() {
  state.bulbs = new Set(); state.marks = new Set(); state.history = [];
  state.selectedKey = firstPlotKey(state.level); state.hintedKey = null;
  state.hintStage = 0; state.hintCount = 0;
  state.completed = false; state.runId = freshRunId();
  state.elapsedBase = 0; state.clockStart = state.view === "game" ? Date.now() : null;
  state.zone = null;
  saveGame(); renderGame(); announce("已重开本关");
}

function startLevel(level) {
  if (level.id !== state.level.id) {
    freezeClock(); state.level = level; restart();
  } else if (state.completed) {
    restart();
  }
  state.selectedKey = state.selectedKey || firstPlotKey(level);
  showView("game");
  if (!state.tutorialSeen) openTutorial(0);
  else focusGameEntry();
}

function deliverOutbox() {
  for (const event of state.outbox) {
    if (state.dispatched.has(event.completionId)) continue;
    state.dispatched.add(event.completionId);
    try { window.dispatchEvent(new CustomEvent("mini-game:complete", { detail: event })); }
    catch (error) { state.dispatched.delete(event.completionId); }
  }
}

function finishLevel(evaluation) {
  if (!evaluation.complete) return;
  state.completed = true; freezeClock();
  const first = !state.completedRecords[state.level.id];
  const chapterIndex = CHAPTERS.findIndex((chapter) => chapter.id === state.level.chapterId);
  const chapterClearsBefore = LEVELS.filter((level) => level.chapterId === state.level.chapterId
    && state.completedRecords[level.id]).length;
  const detailIndex = first ? PLANT_THRESHOLDS.indexOf(chapterClearsBefore + 1) : -1;
  if (first) {
    const completionId = `${GAME_ID}:${state.level.id}:${state.runId}`;
    const claimId = `${GAME_ID}:first:${state.level.id}`;
    const record = {
      bulbs: [...state.bulbs].sort(), completedAt: new Date().toISOString(),
      completionId, claimId, runId: state.runId,
      elapsedMs: elapsedMs(), hintsUsed: state.hintCount,
    };
    state.completedRecords[state.level.id] = record;
    state.outbox.push({
      gameId: GAME_ID, levelId: state.level.id, generatorVersion: state.level.generatorVersion,
      seed: state.level.seed, runId: state.runId, completionId, claimId,
      elapsedMs: elapsedMs(), hintsUsed: state.hintCount, firstClear: true,
    });
  }
  const persisted = saveGame();
  renderGame();
  $("#win-copy").textContent = `${state.level.title}的石径全部见光，数字陶石也安定了。`;
  $("#win-detail").textContent = first
    ? `首次点亮 · ${formatTime(elapsedMs())} · 使用提示 ${state.hintCount} 次`
    : `再次点亮 · ${formatTime(elapsedMs())} · 使用提示 ${state.hintCount} 次`;
  if (detailIndex >= 0) {
    $("#win-detail").textContent += ` · 新发现「${PLANT_NAMES[chapterIndex]}」的${PLANT_DETAILS[detailIndex]}`;
  }
  $("#win-atlas").hidden = detailIndex < 0;
  const nextIndex = LEVELS.findIndex((level) => level.id === state.level.id) + 1;
  $("#win-next").disabled = nextIndex >= LEVELS.length;
  openModal(el.win);
  if (persisted && first) deliverOutbox();
  playTone(880);
}

function hint() {
  if (state.completed) return;
  state.hintCount += 1;
  state.hintStage = Math.min(state.hintStage + 1, 3);
  const evaluation = evaluatePosition(state.level, state);
  let message = "";
  if (state.hintStage === 1) {
    message = evaluation.conflicts.size ? "先看互照的两盏灯，墙没有挡在它们之间。"
      : [...evaluation.runes.values()].some((item) => item.impossible) ? "先检查红色数字陶石，叉号也可能只是笔记矛盾。"
        : "先找只能从一处照亮的暗格，或从数字 0 和满额数字入手。";
  } else if (state.hintStage === 2) {
    const step = explainStep(state.level, state);
    if (step.reason && step.reason.anchor) {
      const point = pointFromKey(step.reason.anchor);
      if (point) message = `看看第 ${point.row + 1} 行、第 ${point.column + 1} 列附近：${step.reason.text}`;
    }
    if (!message) message = (step.reason && step.reason.text) || "留意暗格的整条横竖光路，以及数字旁剩余的空位。";
  } else {
    const step = explainStep(state.level, state);
    if ((step.type === "bulb" || step.type === "exclude") && step.key) {
      const point = pointFromKey(step.key);
      state.hintedKey = step.key;
      message = `第 ${point.row + 1} 行、第 ${point.column + 1} 列${step.type === "bulb" ? "必须放灯" : "不能放灯"}。${(step.reason && step.reason.text) || "由当前规则可推出。"}`;
    } else if (step.type === "contradiction") {
      message = `${(step.reason && step.reason.text) || "当前摆法有矛盾。"}可以撤销最近一步，或清除相关叉号。`;
    } else {
      message = "这一步暂时没有得到完整证明。先处理数字陶石与暗格，或撤销有矛盾的摆法。";
    }
  }
  saveGame(); renderGame(); setMessage(message); announce(message);
}

function renderTutorialStep() {
  const level = LEVELS[0];
  const actionKey = level.solution[0];
  const position = state.tutorialStep === 0 ? {}
    : state.tutorialStep === 1 ? { bulbs: new Set([actionKey]) }
      : { bulbs: new Set(level.solution) };
  const evaluation = evaluatePosition(level, position);
  const headings = ["认识花径与陶石", "放下一盏萤灯", "让整座庭院亮起"];
  const descriptions = [
    "深色石径需要见光。陶石墙会挡住光；墙上的数字只数上下左右紧邻的灯。0 表示旁边不能放灯。",
    "萤灯照亮自己和四个方向的连续石径，遇墙就停。你可以先试一盏，再观察光路。",
    "全部石径都亮、数字刚好满足，且灯与灯不能沿无墙的直路互照，才算完成。叉号只是个人笔记，不会挡光。",
  ];
  el.tutorial.querySelector("#tutorial-title").textContent = headings[state.tutorialStep];
  const container = $("#tutorial-content"); clear(container);
  const index = document.createElement("span"); index.className = "tutorial-step-index";
  index.textContent = `${state.tutorialStep + 1} / 3 · 同一真实关卡`;
  const board = document.createElement("div"); board.className = "tutorial-board";
  board.style.setProperty("--columns", String(level.width));
  board.dataset.levelId = level.id; board.dataset.step = String(state.tutorialStep);
  board.dataset.complete = String(evaluation.complete);
  for (let row = 0; row < level.height; row += 1) {
    for (let column = 0; column < level.width; column += 1) {
      board.append(createCell(level, row, column, evaluation, false));
    }
  }
  const copy = document.createElement("p"); copy.textContent = descriptions[state.tutorialStep];
  const detail = document.createElement("p"); detail.className = "quiet-note";
  detail.textContent = `真实状态：已照亮 ${evaluation.litCount}/${evaluation.totalPlots} 格，互照 ${evaluation.conflicts.size} 盏。`;
  container.append(index, board, copy, detail);
  if (state.tutorialStep === 2) {
    const source = document.createElement("p"); source.className = "quiet-note";
    source.innerHTML = '规则参考 <a href="https://www.chiark.greenend.org.uk/~sgtatham/puzzles/" target="_blank" rel="noreferrer">Simon Tatham’s Portable Puzzle Collection</a> 与 <a href="https://github.com/ebnbin/puzzles" target="_blank" rel="noreferrer">ebnbin/puzzles</a>；本作的许可和致谢见 <a href="./THIRD_PARTY_NOTICES.md">来源声明</a>。';
    container.append(source);
  }
  $("#tutorial-next").textContent = state.tutorialStep === 2 ? "开始游玩" : "下一步";
  container.scrollTop = 0;
  el.tutorial.scrollTop = 0;
}

function openModal(dialog) {
  if (el.tutorial.open && dialog !== el.tutorial) closeModal(el.tutorial);
  if (el.win.open && dialog !== el.win) closeModal(el.win);
  const active = document.activeElement;
  state.modalReturnFocus = active && active.isConnected && active.getClientRects().length
    ? active : selectedCell() || $("#tutorial-button");
  dialog.showModal(); document.body.classList.add("has-modal");
}

function closeModal(dialog) {
  if (dialog.open) dialog.close();
  document.body.classList.remove("has-modal");
  const destination = state.modalReturnFocus && state.modalReturnFocus.isConnected
    && state.modalReturnFocus.getClientRects().length
    ? state.modalReturnFocus : selectedCell() || $("#tutorial-button");
  if (destination) destination.focus();
  state.modalReturnFocus = null;
}

function openTutorial(step = 0, marksSeen = true) {
  state.tutorialStep = step; state.tutorialMarksSeen = marksSeen;
  renderTutorialStep(); openModal(el.tutorial);
}

function closeTutorial() { if (state.tutorialMarksSeen) saveTutorialSeen(); closeModal(el.tutorial); }

function selectedCell() {
  if (state.view !== "game" || !state.selectedKey) return null;
  const selector = `[data-key="${state.selectedKey}"]`;
  return (!el.precision.hidden && el.precisionGrid.querySelector(selector))
    || el.board.querySelector(selector);
}

function focusGameEntry() {
  if (usesPrecision()) {
    const point = pointFromKey(state.selectedKey);
    const row = point ? Math.floor(point.row / 3) * 3 : 0;
    const column = point ? Math.floor(point.column / 3) * 3 : 0;
    const zone = el.zones.querySelector(`.zone-button[data-row="${row}"][data-column="${column}"]`);
    if (zone) { zone.focus(); return; }
  }
  focusSelectedCell();
}

function focusSelectedCell() { const cell = selectedCell(); if (cell) cell.focus(); }

function moveSelection(rowStep, columnStep) {
  const origin = pointFromKey(state.selectedKey) || pointFromKey(firstPlotKey(state.level));
  if (!origin) return;
  let row = origin.row + rowStep;
  let column = origin.column + columnStep;
  while (row >= 0 && row < state.level.height && column >= 0 && column < state.level.width) {
    if (isPlot(cellAt(state.level, row, column))) {
      state.selectedKey = keyOf(row, column);
      if (usesPrecision()) {
        state.zone = { row: Math.floor(row / 3) * 3, column: Math.floor(column / 3) * 3,
          height: Math.min(3, state.level.height - Math.floor(row / 3) * 3),
          width: Math.min(3, state.level.width - Math.floor(column / 3) * 3) };
      }
      renderGame();
      const target = usesPrecision()
        ? el.precisionGrid.querySelector(`[data-key="${state.selectedKey}"]`)
        : el.board.querySelector(`[data-key="${state.selectedKey}"]`);
      if (target) target.focus(); return;
    }
    row += rowStep; column += columnStep;
  }
}

function onBoardClick(event) {
  const button = event.target.closest("button[data-key]");
  if (!button || button.disabled) return;
  commitCell(button.dataset.key);
}

function onBoardPreview(event) {
  const button = event.target.closest("button[data-key]");
  if (!button || button.disabled) return;
  const point = pointFromKey(button.dataset.key);
  if (point) setMessage(`第 ${point.row + 1} 行、第 ${point.column + 1} 列 · ${state.tool === "bulb" ? "萤灯" : "记号"}。松开后落下。`);
}

function bindEvents() {
  $("#home-button").addEventListener("click", () => showView("home"));
  $("#chapters-button").addEventListener("click", () => showView("chapters"));
  $("#atlas-button").addEventListener("click", () => showView("atlas"));
  $("#back-to-levels").addEventListener("click", () => showView("chapters"));
  $("#browse-button").addEventListener("click", () => showView("chapters"));
  $("#continue-button").addEventListener("click", () => startLevel(state.level));
  $("#tutorial-button").addEventListener("click", () => openTutorial(0));
  $("#source-button").addEventListener("click", () => openTutorial(2, false));
  $("#sound-button").addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    const button = $("#sound-button");
    button.setAttribute("aria-pressed", String(state.soundOn));
    button.setAttribute("aria-label", state.soundOn ? "关闭声音" : "开启声音");
    saveGame(); if (state.soundOn) playTone();
  });
  for (const tool of ["bulb", "mark"]) {
    $(`#${tool}-tool`).addEventListener("click", () => { state.tool = tool; updateToolButtons(); });
  }
  el.board.addEventListener("click", onBoardClick);
  el.precisionGrid.addEventListener("click", onBoardClick);
  el.board.addEventListener("pointerdown", onBoardPreview);
  el.precisionGrid.addEventListener("pointerdown", onBoardPreview);
  el.board.addEventListener("contextmenu", (event) => {
    const target = event.target.closest("button[data-key]");
    if (!target) return; event.preventDefault(); commitCell(target.dataset.key, "mark");
  });
  $("#precision-close").addEventListener("click", () => {
    const former = state.zone;
    state.zone = null; renderGame();
    const selector = `.zone-button[data-row="${former && former.row}"][data-column="${former && former.column}"]`;
    const button = el.zones.querySelector(selector); if (button) button.focus();
  });
  $("#undo-button").addEventListener("click", undo);
  $("#restart-button").addEventListener("click", restart);
  $("#hint-button").addEventListener("click", hint);
  $("#tutorial-skip").addEventListener("click", closeTutorial);
  $("#tutorial-next").addEventListener("click", () => {
    if (state.tutorialStep >= 2) closeTutorial();
    else { state.tutorialStep += 1; renderTutorialStep(); }
  });
  $("#win-stay").addEventListener("click", () => closeModal(el.win));
  $("#win-atlas").addEventListener("click", () => { closeModal(el.win); showView("atlas"); $("#atlas-title").focus(); });
  $("#win-next").addEventListener("click", () => {
    const next = LEVELS[LEVELS.findIndex((level) => level.id === state.level.id) + 1];
    closeModal(el.win); if (next) startLevel(next);
  });
  document.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", () => {
    if (el.tutorial.open) closeTutorial(); else if (el.win.open) closeModal(el.win);
  }));
  for (const dialog of [el.tutorial, el.win]) {
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault(); if (dialog === el.tutorial) closeTutorial(); else closeModal(dialog);
    });
  }
  document.addEventListener("keydown", (event) => {
    if (el.tutorial.open || el.win.open || state.view !== "game") return;
    if (!(event.target instanceof Element) || !event.target.closest("#board, #precision-grid")) return;
    const directions = { ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowDown: [1, 0], ArrowLeft: [0, -1] };
    if (directions[event.key]) { event.preventDefault(); moveSelection(...directions[event.key]); return; }
    if ((event.key === "Enter" || event.key === " ") && state.selectedKey) {
      event.preventDefault(); commitCell(state.selectedKey, "bulb");
    } else if (event.key.toLowerCase() === "m") { event.preventDefault(); commitCell(state.selectedKey, "mark"); }
    else if (event.key.toLowerCase() === "z" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); undo(); }
  });
  window.addEventListener("resize", () => { if (state.view === "game") renderGame(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { freezeClock(); saveGame(); }
    else if (state.view === "game") resumeClock();
  });
  window.addEventListener("mini-game:request-pending", () => {
    state.dispatched.clear();
    deliverOutbox();
  });
}

function supportsFlexGap() {
  const probe = document.createElement("div");
  probe.style.display = "flex";
  probe.style.flexDirection = "column";
  probe.style.rowGap = "1px";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.append(document.createElement("div"), document.createElement("div"));
  document.body.append(probe);
  const supported = probe.scrollHeight === 1;
  probe.parentNode.removeChild(probe);
  return supported;
}

function initialize() {
  if (supportsFlexGap()) document.documentElement.classList.add("supports-flex-gap");
  readSave();
  if (!state.selectedKey) state.selectedKey = firstPlotKey(state.level);
  bindEvents(); updateHome(); updateToolButtons();
  $("#sound-button").setAttribute("aria-pressed", String(state.soundOn));
  $("#sound-button").setAttribute("aria-label", state.soundOn ? "关闭声音" : "开启声音");
  window.setInterval(() => {
    if (state.view === "game") $("#time-count").textContent = formatTime(elapsedMs());
  }, 1000);
  deliverOutbox();
}

initialize();
