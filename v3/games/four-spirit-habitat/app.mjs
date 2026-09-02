import { LEVELS, levelById } from "./levels.mjs";
import { analyse, applyColour, buildAdjacency, createState, isFixed, restoreState, toggleNote } from "./logic.mjs";
import { createRunId, createSession, normalizeSession, readJson, readJsonResult, STORAGE_KEYS, writeJson } from "./storage.mjs";
import { createCompletion, deliverCompletion, enqueueCompletion, loadCompletionOutbox, removeCompletion } from "./completion.mjs";

const SPIRITS = [
  { name: "水麟", mark: "麟" }, { name: "火羽", mark: "羽" },
  { name: "月狐", mark: "狐" }, { name: "森龟", mark: "龟" },
];
const TUTORIALS = [
  { title: "认识四灵与神龛", image: "./assets/tutorial-elements.svg?tutorial=1", alt: "灵泉初醒真实首关的初始栖境和四种守护灵", copy: "每片不规则栖境最终迎来一位守护灵。带有“神龛”的栖境已经固定，不能改动。", bullets: ["水麟、火羽、月狐、森龟同时用颜色、字形和纹理区分。", "只在一点相触不算相邻；共享一段边界才会互相影响。"] },
  { title: "安置或留下候选印", image: "./assets/tutorial-action.svg?tutorial=1", alt: "在灵泉初醒首关为第 2 片栖境合法安置森龟的前后状态", copy: "选择守护灵后点按栖境即可正式安置。候选模式只留下推理笔记，不会参与冲突或通关。", bullets: ["本图的真实操作是为第 2 片栖境安置森龟（内部区域索引 1）。", "相邻栖境若出现同一种守护灵，会以红边提示冲突。"] },
  { title: "四灵各安其境", image: "./assets/tutorial-goal.svg?tutorial=1", alt: "灵泉初醒首关通过规则引擎验证的完整通关状态", copy: "当每片栖境都已正式安置，并且所有共享边界两侧的守护灵都不同，校准完成。", bullets: ["候选印不能代替正式安置。", "这张通关图是首关的真实唯一解，并由图着色求解器复证。"] },
];

const $ = (selector) => document.querySelector(selector);
const board = $("[data-board]");
const status = $("[data-status]");
const tutorialDialog = $(".tutorial-dialog[data-tutorial]");
const winDialog = $(".win-dialog[data-win]");
let selectedColour = 0;
let noteMode = false;
let tutorialIndex = 0;
let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
const sessionRead = readJsonResult(STORAGE_KEYS.session, null, storage);
let storageAvailable = sessionRead.available;
let session = normalizeSession(sessionRead.value, LEVELS) ?? createSession(LEVELS[0]);
let level = levelById(session.levelId);

function save() {
  if (!storageAvailable) return false;
  const saved = writeJson(STORAGE_KEYS.session, session, storage);
  storageAvailable = storageAvailable && saved;
  return saved;
}
function message(text, kind = "") { status.textContent = text; status.className = `status${kind ? ` is-${kind}` : ""}`; }

function anchorsFor(layout) {
  const cells = new Map();
  layout.forEach((row, y) => row.forEach((region, x) => {
    if (!cells.has(region)) cells.set(region, []);
    cells.get(region).push([x, y]);
  }));
  const anchors = new Map();
  for (const [region, points] of cells) {
    const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
    const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
    anchors.set(region, points.reduce((best, point) => {
      const score = (point[0] - cx) ** 2 + (point[1] - cy) ** 2;
      return score < best.score ? { point, score } : best;
    }, { point: points[0], score: Infinity }).point.join(","));
  }
  return anchors;
}

function renderLevels() {
  const list = $("[data-levels]");
  list.replaceChildren(...LEVELS.map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.level = item.id;
    button.setAttribute("aria-current", item.id === level.id ? "true" : "false");
    button.innerHTML = `<b>${index + 1}</b><b>${item.title}</b><small>${item.difficulty}</small>`;
    button.addEventListener("click", () => switchLevel(item.id));
    return button;
  }));
}

function renderBoard() {
  const analysis = analyse(session.state, level);
  const conflictRegions = new Set(analysis.conflicts.flat());
  const adjacency = buildAdjacency(level.layout);
  const anchors = anchorsFor(level.layout);
  const height = level.layout.length;
  const width = level.layout[0].length;
  board.style.setProperty("--cols", width);
  board.style.setProperty("--rows", height);
  board.style.setProperty("--board-max", `${width * 66}px`);
  const cells = [];
  level.layout.forEach((row, y) => row.forEach((region, x) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "habitat-cell";
    cell.dataset.region = region;
    cell.dataset.x = x;
    cell.dataset.y = y;
    const colour = session.state.colours[region];
    cell.dataset.colour = colour;
    const sides = [[0,-1,"top"],[1,0,"right"],[0,1,"bottom"],[-1,0,"left"]];
    for (const [dx, dy, name] of sides) if (level.layout[y + dy]?.[x + dx] !== region) cell.classList.add(`b-${name}`);
    if (isFixed(level, region)) cell.classList.add("is-fixed");
    if (conflictRegions.has(region)) cell.classList.add("is-conflict");
    const anchor = anchors.get(region) === `${x},${y}`;
    if (anchor) {
      cell.classList.add("is-anchor");
      cell.tabIndex = 0;
      cell.setAttribute("aria-label", `栖境 ${region + 1}，${isFixed(level, region) ? "固定神龛，" : ""}${colour >= 0 ? SPIRITS[colour].name : "未安置"}，相邻 ${adjacency[region].length} 境`);
      if (colour >= 0) cell.innerHTML = `<span class="region-mark">${SPIRITS[colour].mark}</span>`;
      else if (session.state.notes[region]) {
        const marks = SPIRITS.map((spirit, index) => session.state.notes[region] & (1 << index) ? spirit.mark : "").join("");
        cell.innerHTML = `<span class="candidate-marks">${[...marks].map((mark) => `<i>${mark}</i>`).join("")}</span>`;
      }
    } else {
      cell.tabIndex = -1;
      cell.setAttribute("aria-hidden", "true");
    }
    cell.addEventListener("click", () => actOnRegion(region));
    cell.addEventListener("keydown", moveFocus);
    cells.push(cell);
  }));
  board.replaceChildren(...cells);
  $("[data-moves]").textContent = session.state.moves;
  $("[data-left]").textContent = analysis.uncoloured;
  $("[data-level-title]").textContent = level.title;
  $("[data-difficulty]").textContent = level.difficulty;
  if (analysis.conflicts.length) message(`${analysis.conflicts.length} 处共享边界迎来了同一种守护灵。`, "error");
  else if (analysis.solved) message("四灵和鸣，全部栖境校准完成。", "good");
  else message(`还有 ${analysis.uncoloured} 片栖境等待正式安置。`);
}

function renderTools() {
  document.querySelectorAll("[data-colour]").forEach((button) => button.setAttribute("aria-pressed", String(+button.dataset.colour === selectedColour)));
  $("[data-note]").setAttribute("aria-pressed", String(noteMode));
  $("[data-note]").textContent = `候选印：${noteMode ? "开" : "关"}`;
}

function render() { renderLevels(); renderBoard(); renderTools(); }

function commit(nextState, formalAction = null) {
  if (session.completed) session.runId = createRunId();
  session.history.push(session.state);
  session.history = session.history.slice(-100);
  if (formalAction) session.timeline.push(formalAction);
  session.state = nextState;
  session.completed = false;
  session.reported = false;
  save();
  renderBoard();
  if (analyse(session.state, level).solved) completeRun();
}

function actOnRegion(region) {
  const result = noteMode
    ? toggleNote(session.state, level, region, selectedColour)
    : applyColour(session.state, level, region, selectedColour);
  if (!result.changed) {
    message(isFixed(level, region) ? "固定神龛不可更改。" : "这个操作没有改变栖境。", "error");
    return;
  }
  commit(result.state, noteMode ? null : { region, colour: selectedColour });
}

function moveFocus(event) {
  const direction = { ArrowUp:[0,-1], ArrowRight:[1,0], ArrowDown:[0,1], ArrowLeft:[-1,0] }[event.key];
  if (!direction) {
    if (/^[1-4]$/.test(event.key)) { selectedColour = +event.key - 1; renderTools(); actOnRegion(+event.currentTarget.dataset.region); event.preventDefault(); }
    else if (event.key === "Delete" || event.key === "Backspace") { eraseRegion(+event.currentTarget.dataset.region); event.preventDefault(); }
    else if (event.key.toLowerCase() === "n") { noteMode = !noteMode; renderTools(); event.preventDefault(); }
    return;
  }
  event.preventDefault();
  let x = +event.currentTarget.dataset.x;
  let y = +event.currentTarget.dataset.y;
  const current = +event.currentTarget.dataset.region;
  while (level.layout[y + direction[1]]?.[x + direction[0]] !== undefined) {
    x += direction[0]; y += direction[1];
    const region = level.layout[y][x];
    if (region !== current) { board.querySelector(`.is-anchor[data-region="${region}"]`)?.focus(); break; }
  }
}

function eraseRegion(region) {
  const result = applyColour(session.state, level, region, -1);
  if (result.changed) commit(result.state, { region, colour: -1 });
  else message(isFixed(level, region) ? "固定神龛不可清除。" : "当前栖境已经是空白。", "error");
}

function switchLevel(id) {
  level = levelById(id);
  session = createSession(level, createRunId());
  save();
  render();
}

function resetLevel() {
  session = createSession(level, createRunId());
  save();
  render();
}

function undo() {
  const previous = session.history.pop();
  if (!previous) { message("还没有可撤销的安置。", "error"); return; }
  if (session.completed) session.runId = createRunId();
  if (previous.moves < session.state.moves) session.timeline.pop();
  session.state = restoreState(previous, level);
  session.completed = false;
  session.reported = false;
  save(); renderBoard();
  if (analyse(session.state, level).solved) completeRun();
}

function completeRun() {
  if (session.completed && session.reported) return;
  session.completed = true;
  save();
  const eventId = `four-spirit-habitat:${session.runId}:complete`;
  const payload = loadCompletionOutbox(storageAvailable ? storage : null).find((item) => item.eventId === eventId) ?? createCompletion(level, session);
  const retained = enqueueCompletion(storageAvailable ? storage : null, payload);
  if (retained.retained) {
    const delivery = deliverCompletion(window, payload);
    if (delivery.delivered && removeCompletion(storage, eventId).removed) session.reported = true;
  }
  save();
  $("[data-win-copy]").textContent = `${level.title}以 ${session.state.moves} 步完成；建议线为 ${level.par} 步。共享成长会按稳定完成编号结算。`;
  if (!winDialog.open) winDialog.showModal();
}

function flushCompletionOutbox() {
  if (!storageAvailable) return;
  for (const payload of loadCompletionOutbox(storage)) {
    const delivery = deliverCompletion(window, payload);
    if (!delivery.delivered) continue;
    const removed = removeCompletion(storage, payload.eventId);
    if (removed.removed && payload.eventId === `four-spirit-habitat:${session.runId}:complete`) {
      session.reported = true;
      save();
    }
  }
}

function openTutorial(auto = false) {
  if (tutorialDialog.open || winDialog.open) return;
  tutorialIndex = 0;
  renderTutorial();
  tutorialDialog.showModal();
  $("[data-tutorial-next]").focus({ preventScroll: true });
  if (!auto) tutorialDialog.scrollTop = 0;
}
function renderTutorial() {
  const card = TUTORIALS[tutorialIndex];
  $("[data-tutorial-title]").textContent = card.title;
  const image = $("[data-tutorial-image]"); image.src = card.image; image.alt = card.alt;
  $("[data-tutorial-copy]").textContent = card.copy;
  $("[data-tutorial-bullets]").replaceChildren(...card.bullets.map((text) => { const li=document.createElement("li");li.textContent=text;return li; }));
  $("[data-tutorial-position]").textContent = `${tutorialIndex + 1} / ${TUTORIALS.length}`;
  $("[data-tutorial-prev]").disabled = tutorialIndex === 0;
  $("[data-tutorial-next]").textContent = tutorialIndex === TUTORIALS.length - 1 ? "开始校准" : "下一张";
  $(".tutorial-shell").scrollTop = 0;
}
function closeTutorial() { if (storageAvailable) writeJson(STORAGE_KEYS.tutorial, "seen", storage); tutorialDialog.close(); $("#tutorial-button").focus({ preventScroll:true }); }

document.querySelectorAll("[data-colour]").forEach((button) => button.addEventListener("click", () => { selectedColour = +button.dataset.colour; renderTools(); }));
$("[data-note]").addEventListener("click", () => { noteMode = !noteMode; renderTools(); });
$("[data-erase]").addEventListener("click", () => { selectedColour = -1; noteMode = false; renderTools(); message("清除工具已选中：点按一片非固定栖境即可清空正式安置。") });
$("[data-undo]").addEventListener("click", undo);
$("[data-reset]").addEventListener("click", resetLevel);
$("#tutorial-button").addEventListener("click", () => openTutorial(false));
$("[data-tutorial-close]").addEventListener("click", closeTutorial);
$("[data-tutorial-prev]").addEventListener("click", () => { if (tutorialIndex) { tutorialIndex -= 1; renderTutorial(); } });
$("[data-tutorial-next]").addEventListener("click", () => { if (tutorialIndex < TUTORIALS.length - 1) { tutorialIndex += 1; renderTutorial(); } else closeTutorial(); });
tutorialDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeTutorial(); });
$("[data-win-close]").addEventListener("click", () => winDialog.close());
$("[data-win-next]").addEventListener("click", () => { winDialog.close(); const index=LEVELS.findIndex((item)=>item.id===level.id);switchLevel(LEVELS[(index+1)%LEVELS.length].id); });

render();
flushCompletionOutbox();
if (analyse(session.state, level).solved && !session.reported) completeRun();
window.addEventListener("realm:ready", flushCompletionOutbox);
window.addEventListener("ten-realms-v3:realm-ready", flushCompletionOutbox);
if (readJson(STORAGE_KEYS.tutorial, null, storage) !== "seen") window.setTimeout(() => openTutorial(true), 520);
