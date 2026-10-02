import { COVER, FLAG, OPEN, HIT, apply, clone, isWon, newGame, neighbors, publicView, readings, replay, safeLeft, undo } from './engine.mjs';
import { CHAPTERS, LEVELS } from './levels.mjs';
import { certify, deductions } from './proof.mjs';
import { PREFIX, completionFromSession, flushOutbox, loadRecords, loadSession, runId, saveSession, settle } from './store.mjs';
import { createPlatformStorage } from './platform-storage.mjs';

const $ = selector => document.querySelector(selector);
function replace(element, ...children) { while (element.firstChild) element.removeChild(element.firstChild); children.forEach(child => element.appendChild(child)); }
const pages = [...document.querySelectorAll('.page')];
const board = $('#board');
const tutorial = $('#tutorial-dialog'), chordDialog = $('#chord-dialog'), finishDialog = $('#finish-dialog');
const CHAPTER_ITEMS = ['树脂薄片', '苔痕琥珀', '叶脉化石', '气泡标本', '昆虫剪影封存', '透明层积座'];
const CHAPTER_SIGNS = ['◇', '⌁', '↟', '◌', '✧', '◈'];
let storage = null, session = null;
let page = 'home', bookMode = 'campaign', tool = 'scan', selected = null, preview = [], hintStage = 0, hintStep = null;
let tutorialPage = 0, lastFocus = null, suppressClickUntil = 0, longTimer = null, pointerOrigin = null;
let lastChosenLevel = LEVELS[0].id;

function showPage(name) {
  page = name;
  pages.forEach(element => { element.hidden = element.id !== name; });
  if (name === 'book') renderBook();
  if (name === 'specimens') renderSpecimens();
  if (name === 'play') renderPlay();
  window.scrollTo(0, 0);
}
function say(message) { $('#feedback').textContent = message; }
function coords(level, i) { return `${Math.floor(i / level.width) + 1} 行 ${i % level.width + 1} 列`; }

function createSession(level, mode) {
  return { level, mode, runId: runId(), timeline: [], hints: 0, state: newGame(level), history: [] };
}
function chooseLevel(level, mode) {
  if (session && session.level.id === level.id && session.mode === mode && session.state.phase !== 'won') {
    // Continue the existing run, including a failed board that can be undone.
  } else session = createSession(level, mode);
  lastChosenLevel = level.id;
  saveSession(storage, session); storage.flush().then(ok => { if (!ok) say('本机存储写入失败，刷新后可能失去进度。'); });
  selected = null; preview = []; hintStage = 0; hintStep = null; tool = 'scan';
  showPage('play');
  say(mode === 'campaign' && !session.timeline.length ? '从标出的勘测口开始，这一关才计入推理认证。' : '读数表示周围八格的危险数量。');
}
function continueCampaign() {
  if (session && session.mode === 'campaign' && session.state.phase !== 'won') return chooseLevel(session.level, 'campaign');
  const records = loadRecords(storage);
  const next = LEVELS.find(level => !records.some(record => record.levelId === level.id && record.mode === 'campaign')) || LEVELS[0];
  chooseLevel(next, 'campaign');
}
function renderBook() {
  document.querySelectorAll('[data-book-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bookMode === bookMode)));
  const records = loadRecords(storage), root = $('#chapter-list');
  replace(root);
  CHAPTERS.forEach((title, index) => {
    const section = document.createElement('section'); section.className = 'chapter-card';
    const info = document.createElement('div'); info.className = 'chapter-info';
    const numeral = document.createElement('span'); numeral.className = 'chapter-index'; numeral.textContent = String(index + 1).padStart(2, '0');
    const intro = document.createElement('div');
    const h = document.createElement('h2'); h.textContent = title;
    const p = document.createElement('p');
    const done = records.filter(r => { const found = LEVELS.find(l => l.id === r.levelId); return r.mode === bookMode && found && found.chapter === index + 1; });
    p.textContent = `${new Set(done.map(r => r.levelId)).size} / 10 已完成 · ${CHAPTER_ITEMS[index]}`;
    intro.append(h, p); info.append(numeral, intro);
    const grid = document.createElement('div'); grid.className = 'level-grid';
    LEVELS.filter(level => level.chapter === index + 1).forEach((level, within) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'level-button';
      if (done.some(record => record.levelId === level.id)) button.classList.add('done');
      const number = document.createElement('span'); number.className = 'level-number'; number.textContent = String(index * 10 + within + 1).padStart(2, '0');
      const label = document.createElement('strong'); label.textContent = level.title;
      const state = document.createElement('small');
      const record = done.find(item => item.levelId === level.id);
      state.textContent = record ? `✓ 最佳 ${record.moves} 步` : `${level.width} × ${level.height}`;
      button.append(number, label, state);
      button.addEventListener('click', () => chooseLevel(level, bookMode));
      grid.append(button);
    });
    section.append(info, grid); root.append(section);
  });
}
function renderSpecimens() {
  const records = loadRecords(storage), root = $('#specimen-list'); replace(root);
  CHAPTERS.forEach((title, index) => {
    const unlocked = records.some(r => { const found = LEVELS.find(l => l.id === r.levelId); return r.mode === 'campaign' && found && found.chapter === index + 1; });
    const card = document.createElement('article'); card.className = `specimen-card${unlocked ? '' : ' locked'}`;
    const top = document.createElement('span'); top.className = 'eyebrow'; top.textContent = `LAYER ${String(index + 1).padStart(2, '0')}`;
    const icon = document.createElement('div'); icon.className = 'specimen-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = CHAPTER_SIGNS[index];
    const bottom = document.createElement('div'); const h = document.createElement('h2'); h.textContent = unlocked ? CHAPTER_ITEMS[index] : '尚未封存';
    const p = document.createElement('p'); p.textContent = unlocked ? `${title} · 主线首通收藏` : `完成第 ${index + 1} 章任意一关主线即可解锁`;
    bottom.append(h, p); card.append(top, icon, bottom); root.append(card);
  });
}
function boardElement(level, state, interactive = true) {
  const element = document.createElement('div'); element.className = 'board'; element.style.setProperty('--cols', level.width);
  const grid = readings(level, state.mines);
  state.cells.forEach((cell, i) => {
    const tile = document.createElement(interactive ? 'button' : 'div');
    if (interactive) { tile.type = 'button'; tile.dataset.index = i; tile.setAttribute('role', 'gridcell'); tile.tabIndex = i === (selected === null ? 0 : selected) ? 0 : -1; }
    tile.className = `cell ${cell}${cell === OPEN && grid[i] === 0 ? ' zero' : ''}`;
    if (interactive && i === selected) tile.classList.add('selected');
    if (interactive && preview.includes(i)) tile.classList.add('preview');
    if (cell === OPEN && grid[i]) { tile.textContent = String(grid[i]); tile.dataset.number = grid[i]; }
    const label = `${coords(level, i)}，${cell === COVER ? '覆盖' : cell === FLAG ? '旗记，未核实' : cell === HIT ? '触发气囊' : grid[i] === 0 ? '已开空格' : `已开，八邻读数 ${grid[i]}`}`;
    tile.setAttribute('aria-label', label);
    if (interactive && state.errors.includes(i) && cell !== HIT) tile.dataset.error = 'true';
    element.append(tile);
  });
  return element;
}
function renderPlay() {
  if (!session) return;
  const { level, state, mode } = session;
  $('#chapter-label').textContent = `第 ${level.chapter} 层 · ${CHAPTERS[level.chapter - 1]} / ${level.id.slice(-2)}`;
  $('#board-title').textContent = level.title;
  $('#mode-badge').textContent = mode === 'campaign' ? '推理认证 · 指定起点' : '自由练习 · 任意首格';
  $('#mode-badge').classList.toggle('practice', mode === 'practice');
  $('#safe-left').textContent = safeLeft(state); $('#flag-count').textContent = state.cells.filter(c => c === FLAG).length; $('#move-count').textContent = state.moves;
  const rendered = boardElement(level, state);
  replace(board, ...Array.from(rendered.childNodes)); board.style.setProperty('--cols', level.width);
  $('#start-panel').hidden = !(mode === 'campaign' && state.phase === 'ready' && state.scans === 0);
  $('#start-copy').textContent = `认证起点：${coords(level, level.firstSafe)}。按下按钮后真实揭开此格；只对这条起点路线承诺可逐步推理。`;
  $('#board-state').textContent = state.phase === 'lost' ? '气囊触发 · 可撤销' : state.phase === 'won' ? '全部安全格已开' : state.phase === 'ready' ? '等待首次探测' : '勘探中';
  $('#scan-mode').setAttribute('aria-pressed', String(tool === 'scan')); $('#flag-mode').setAttribute('aria-pressed', String(tool === 'flag'));
  $('#tool-copy').textContent = tool === 'scan' ? '探测模式：点覆盖格，打开这块土层。第一次真实探测必安全。' : '旗记模式：点覆盖格插三角标桩，再点一次拔除；旗只是你的笔记。';
  $('#coordinate').textContent = selected === null ? '选择一格' : coords(level, selected);
  renderReading();
}
function renderReading() {
  if (!session) return;
  const { level, state } = session;
  if (selected === null || state.cells[selected] !== OPEN) {
    $('#reading-panel').textContent = '点按一个已开数字，可查看它的八邻读数。';
    $('#chord-button').disabled = true; $('#chord-button').textContent = '合并探测 · 先选数字'; return;
  }
  const number = readings(level, state.mines)[selected];
  const around = neighbors(level.width, level.height, selected);
  const flagged = around.filter(i => state.cells[i] === FLAG).length, covered = around.filter(i => state.cells[i] === COVER).length;
  $('#reading-panel').textContent = `${coords(level, selected)}：读数 ${number}，周围已标 ${flagged}，未定 ${covered}。旗是笔记，读数不核对旗的位置。`;
  const allowed = number > 0 && covered > 0 && flagged === number && ['ready', 'playing'].includes(state.phase);
  $('#chord-button').disabled = !allowed;
  $('#chord-button').textContent = allowed ? `合并探测 · 将打开 ${covered} 格` : '合并探测 · 旗数需等于读数';
}
function commitAction(action) {
  if (!session) return false;
  const previous = session.state;
  const result = apply(previous, session.level, action);
  if (!result.changed) return false;
  session.state = result.state; session.history.push(previous); session.timeline.push(action);
  preview = []; hintStage = 0; hintStep = null; $('#hint-button').textContent = '推理提示';
  const saved = saveSession(storage, session);
  renderPlay();
  if (result.hit.length) say('气囊触发。可以撤销这次操作，保留错误位置供复盘。');
  else if (isWon(session.state)) finishRun(saved);
  else say(!saved ? '本机存储不可用，刷新后可能失去当前进度。' : action.type === 'flag' ? '旗记已更新。它不会自动判定为真雷。' : `${result.opened.length} 格已安全揭开。`);
  if (!isWon(session.state)) storage.flush().then(ok => { if (!ok) say('本机存储写入失败，刷新后可能失去进度。'); });
  return true;
}
async function finishRun(sessionSaved) {
  const completion = completionFromSession(session);
  const chapterFirst = session.mode === 'campaign' && !loadRecords(storage).some(record => {
    const level = LEVELS.find(item => item.id === record.levelId);
    return record.mode === 'campaign' && level && level.chapter === session.level.chapter;
  });
  const outcome = completion && sessionSaved ? settle(storage, completion) : { saved: false, first: false };
  const durable = outcome.saved && await storage.flush();
  if (durable) await flushOutbox(storage);
  $('#finish-copy').textContent = `${session.mode === 'campaign' ? '推理认证' : '自由练习'} · ${session.state.moves} 次操作 · ${session.hints} 次提示。${durable && chapterFirst ? `首次封存「${CHAPTER_ITEMS[session.level.chapter - 1]}」。` : durable && outcome.first ? '本关首次完成。' : '本次关卡已完成。'}${durable ? '' : '本机记录保存失败，请检查存储。'}`;
  say('全部安全格已揭开。危险格无须全部插旗。');
  finishDialog.showModal();
}
function undoAction() {
  if (!session || !session.history.length) { say('暂无可撤销的操作。'); return; }
  session.state = undo(session.history.pop(), session.state);
  session.timeline.push({ type: 'undo' });
  preview = []; hintStage = 0; hintStep = null;
  saveSession(storage, session); storage.flush().then(ok => { if (!ok) say('本机存储写入失败。'); }); renderPlay(); say('已撤销一步；错误刻痕仅供复盘，不影响判胜。');
}
function chooseCell(i, execute = true) {
  if (!session) return;
  selected = i; preview = []; hintStage = 0; hintStep = null; $('#hint-button').textContent = '推理提示';
  const cell = session.state.cells[i];
  if (cell === OPEN || !execute) { renderPlay(); return; }
  if (session.mode === 'campaign' && session.state.scans === 0) {
    renderPlay(); say('主线需要先按「从勘测口开始」。'); return;
  }
  if (tool === 'scan' && cell === COVER) commitAction({ type: 'scan', index: i });
  else if (tool === 'flag' && [COVER, FLAG].includes(cell)) commitAction({ type: 'flag', index: i });
  else renderPlay();
}
function chordCandidates() {
  if (!session || selected === null || session.state.cells[selected] !== OPEN) return [];
  const around = neighbors(session.level.width, session.level.height, selected);
  const number = readings(session.level, session.state.mines)[selected];
  return number > 0 && around.filter(i => session.state.cells[i] === FLAG).length === number ? around.filter(i => session.state.cells[i] === COVER) : [];
}
function openChord() {
  const candidates = chordCandidates();
  if (!candidates.length) return;
  preview = candidates; renderPlay();
  $('#chord-copy').textContent = `${coords(session.level, selected)} 的旗数等于读数。即将打开：${candidates.map(i => coords(session.level, i)).join('、')}。`;
  lastFocus = document.activeElement; chordDialog.showModal();
}
function closeChord() { chordDialog.close(); preview = []; renderPlay(); if (lastFocus) lastFocus.focus(); }
function hint() {
  if (!session || !['playing', 'ready'].includes(session.state.phase)) { say('当前局面不能使用推理提示。'); return; }
  if (session.mode === 'campaign' && session.state.scans === 0) { say('先从勘测口开始。'); return; }
  if (!hintStep) {
    // Player flags are unverified notes. Ignore them when deriving a hint.
    const view = publicView(session.level, session.state);
    view.cells = view.cells.map(cell => cell === FLAG ? COVER : cell);
    const result = deductions(view);
    if (result.inconsistent) { say('当前旗记与公开读数矛盾；请检查并撤回自己的假设。'); return; }
    if (!result.steps.length) { say('当前尚无可证明的安全格或危险格。自由练习可能需要猜测。'); return; }
    const retract = result.steps.find(step => step.type === 'scan' && session.state.cells[step.index] === FLAG);
    if (retract) { say(`${coords(session.level, retract.index)} 的旗记与公开读数冲突：这格可以证明安全。请先手动拔旗。`); return; }
    hintStep = result.steps.find(step => session.state.cells[step.index] === COVER);
    if (!hintStep) { say('可证明的格已经标记。拔旗后可继续检验，或自行探测。'); return; }
    hintStage = 0;
  }
  session.hints++;
  if (hintStage === 0) {
    selected = hintStep.sources.length ? hintStep.sources[0] : hintStep.index;
    preview = [hintStep.index, ...hintStep.sources];
    hintStage = 1; renderPlay();
    say(`留意高亮的读数和 ${coords(session.level, hintStep.index)}。再点「推理提示」查看理由。`);
  } else if (hintStage === 1) {
    hintStage = 2; say(hintStep.explanation + ' 再点「执行已证明动作」确认。');
    $('#hint-button').textContent = '执行已证明动作';
  } else {
    const action = { type: hintStep.type, index: hintStep.index };
    hintStep = null; hintStage = 0; commitAction(action);
  }
  saveSession(storage, session); storage.flush().then(ok => { if (!ok) say('本机存储写入失败。'); });
}
const tutorialLevel = LEVELS[0];
const tutorialProof = certify(tutorialLevel);
const tutorialStates = [newGame(tutorialLevel), apply(newGame(tutorialLevel), tutorialLevel, { type: 'scan', index: tutorialLevel.firstSafe }).state, tutorialProof.state];
function renderTutorial() {
  const headings = ['01 / 元素：读周围八格', '02 / 操作：真实勘测口', '03 / 目标：揭开安全格'];
  const copies = [
    `这是第 01 关真实初态。封土格隐藏读数；主线从 ${coords(tutorialLevel, tutorialLevel.firstSafe)} 的勘测口开始。`,
    `引擎已经真实探测勘测口。空白 0 会展开相连安全格；数字只计算周围八格，不含自己。`,
    `这张完成盘由同一关的可验证操作轨迹生成。所有安全格已开，即使危险格没有全部插旗也能获胜。`,
  ];
  $('#tutorial-title').textContent = headings[tutorialPage]; $('#tutorial-copy').textContent = copies[tutorialPage];
  $('#tutorial-index').textContent = `${tutorialPage + 1} / 3`;
  $('#tutorial-prev').disabled = tutorialPage === 0;
  $('#tutorial-next').textContent = tutorialPage === 2 ? '开始勘探' : '下一张';
  const root = $('#tutorial-board'); replace(root, boardElement(tutorialLevel, tutorialStates[tutorialPage], false)); root.scrollTop = 0;
}
function openTutorial() { lastFocus = document.activeElement; tutorialPage = 0; renderTutorial(); tutorial.showModal(); }
function closeTutorial() {
  tutorial.close(); try { storage.setItem(PREFIX + 'tutorial:v1', 'seen'); storage.flush(); } catch (error) { /* storage may be disabled */ }
  if (lastFocus) lastFocus.focus();
}

document.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', () => showPage('home')));
document.querySelectorAll('[data-book]').forEach(button => button.addEventListener('click', () => showPage('book')));
document.querySelectorAll('[data-specimens]').forEach(button => button.addEventListener('click', () => showPage('specimens')));
document.querySelectorAll('[data-tutorial]').forEach(button => button.addEventListener('click', openTutorial));
document.querySelectorAll('[data-book-mode]').forEach(button => button.addEventListener('click', () => { bookMode = button.dataset.bookMode; renderBook(); }));
$('[data-continue]').addEventListener('click', continueCampaign);
$('[data-practice]').addEventListener('click', () => chooseLevel(LEVELS.find(level => level.id === lastChosenLevel) || LEVELS[0], 'practice'));
$('#start-button').addEventListener('click', () => { if (session && session.mode === 'campaign' && session.state.scans === 0) commitAction({ type: 'scan', index: session.level.firstSafe }); });
$('#scan-mode').addEventListener('click', () => { tool = 'scan'; renderPlay(); });
$('#flag-mode').addEventListener('click', () => { tool = 'flag'; renderPlay(); });
$('#chord-button').addEventListener('click', openChord);
$('#confirm-chord').addEventListener('click', () => { const i = selected; closeChord(); commitAction({ type: 'chord', index: i }); });
$('[data-cancel-chord]').addEventListener('click', closeChord);
chordDialog.addEventListener('cancel', event => { event.preventDefault(); closeChord(); });
$('#hint-button').addEventListener('click', hint);
$('#undo-button').addEventListener('click', undoAction);
$('#restart-button').addEventListener('click', () => {
  if (!session || !window.confirm('重新开始这关？当前未完成的操作会被清除。')) return;
  chooseLevel(session.level, session.mode); session = createSession(session.level, session.mode); saveSession(storage, session); storage.flush(); renderPlay(); say('已重新开始。');
});
board.addEventListener('click', event => {
  if (Date.now() < suppressClickUntil) return;
  const tile = event.target.closest('[data-index]'); if (tile) chooseCell(Number(tile.dataset.index));
});
board.addEventListener('pointerdown', event => {
  const tile = event.target.closest('[data-index]'); if (!tile || event.pointerType === 'mouse') return;
  pointerOrigin = { x: event.clientX, y: event.clientY, i: Number(tile.dataset.index) };
  clearTimeout(longTimer);
  longTimer = setTimeout(() => {
    if (!pointerOrigin) return;
    suppressClickUntil = Date.now() + 700; chooseCell(pointerOrigin.i, false);
    say(`${coords(session.level, pointerOrigin.i)}。长按仅预览，不会自动插旗。`);
  }, 450);
});
board.addEventListener('pointermove', event => {
  if (pointerOrigin && Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) > 8) {
    clearTimeout(longTimer); pointerOrigin = null; suppressClickUntil = Date.now() + 700;
  }
});
for (const name of ['pointerup', 'pointercancel']) board.addEventListener(name, () => { clearTimeout(longTimer); pointerOrigin = null; });
document.querySelectorAll('[data-close-tutorial]').forEach(button => button.addEventListener('click', closeTutorial));
$('#tutorial-prev').addEventListener('click', () => { if (tutorialPage > 0) { tutorialPage--; renderTutorial(); } });
$('#tutorial-next').addEventListener('click', () => { if (tutorialPage < 2) { tutorialPage++; renderTutorial(); } else closeTutorial(); });
tutorial.addEventListener('cancel', event => { event.preventDefault(); closeTutorial(); });
document.querySelectorAll('[data-finish-book]').forEach(button => button.addEventListener('click', () => { finishDialog.close(); showPage('book'); }));
document.querySelectorAll('[data-next-level]').forEach(button => button.addEventListener('click', () => {
  const next = LEVELS[LEVELS.findIndex(level => level.id === session.level.id) + 1]; finishDialog.close();
  if (next) chooseLevel(next, session.mode); else showPage('book');
}));
board.addEventListener('keydown', event => {
  if (!session) return;
  const current = selected === null ? 0 : selected, width = session.level.width, count = session.state.cells.length;
  const shifts = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -width, ArrowDown: width };
  if (event.key in shifts) {
    event.preventDefault();
    const next = current + shifts[event.key];
    if (next < 0 || next >= count || (event.key === 'ArrowLeft' && current % width === 0) ||
        (event.key === 'ArrowRight' && current % width === width - 1)) return;
    selected = next; renderPlay(); const target = board.querySelector(`[data-index="${next}"]`); if (target) target.focus();
  } else if (event.key.toLowerCase() === 'm') { tool = tool === 'scan' ? 'flag' : 'scan'; renderPlay(); }
  else if (event.key.toLowerCase() === 'c') openChord();
  else if (event.key.toLowerCase() === 'u') undoAction();
});

createPlatformStorage().then(created => {
  storage = created;
  session = loadSession(storage);
  lastChosenLevel = session ? session.level.id : LEVELS[0].id;
  flushOutbox(storage);
  showPage('home');
  try { if (storage.getItem(PREFIX + 'tutorial:v1') !== 'seen') Promise.resolve().then(openTutorial); } catch (error) { Promise.resolve().then(openTutorial); }
});
