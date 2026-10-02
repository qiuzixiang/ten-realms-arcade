import { LEVELS } from './levels.mjs';
import { makePuzzle, freshPosition, analyze, act, keyFor } from './engine.mjs';
import { loadProfile, saveProfile, loadSession, saveSession, loadOutbox, saveOutbox, tutorialSeen, markTutorialSeen, runId, finish } from './profile.mjs';
import { createStorage } from './storage.mjs';

async function boot() {
var CHAPTERS = ['初夜登记', '谁与谁同住', '满房名单', '转角客房', '百妖大厅', '月下合宿'];
var GUESTS = [
  { name: '狸', mark: '◕', color: '#bb703d' },
  { name: '狐', mark: '◇', color: '#c36463' },
  { name: '灯', mark: '✦', color: '#bd9040' },
  { name: '鹤', mark: '⌁', color: '#618e82' },
  { name: '雾', mark: '☾', color: '#7c83a0' },
];
var storage = await createStorage();
var profile = loadProfile(storage, LEVELS);
var outbox = loadOutbox(storage);
var session = loadSession(storage, LEVELS);
var puzzle = session ? makePuzzle(session.level) : null;
var view = session ? 'play' : 'map';
var selectedChapter = session ? session.level.chapter : 1;
var anchor = null;
var tool = 'room';
var history = [];
var pendingAction = null;
var modal = null;
var modalReturnFocus = null;
var tutorialPage = 0;
var currentHint = null;
var statusText = '';

function $(selector) { return document.querySelector(selector); }
function dateKey() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}
function dailyLevel() {
  var parts = dateKey().split('-').map(Number);
  var day = Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
  return LEVELS[((day % LEVELS.length) + LEVELS.length) % LEVELS.length];
}
function openModal(element) {
  if (modal) closeModal();
  modalReturnFocus = document.activeElement;
  modal = element;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  var first = modal.querySelector('button');
  if (first) first.focus();
}
function closeModal() {
  if (!modal) return;
  modal.hidden = true;
  modal = null;
  document.body.classList.remove('modal-open');
  if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus();
  modalReturnFocus = null;
}
function alertStatus(message) {
  statusText = message;
  $('#game-status').textContent = message;
  $('#live-status').textContent = message;
}
function startLevel(level, mode) {
  session = { level: level, mode: mode || 'campaign', date: mode === 'daily' ? dateKey() : '', runId: runId(), position: freshPosition(), moves: 0, hinted: false };
  puzzle = makePuzzle(level);
  anchor = null;
  history = [];
  currentHint = null;
  view = 'play';
  saveSession(storage, session);
  render();
  alertStatus('先点一位妖怪，再点正交相邻的一位，安排一间客房。');
}
function restoreLevel() {
  if (!session) return;
  history.push({ position: { rooms: session.position.rooms.slice(), excluded: session.position.excluded.slice() }, moves: session.moves, hinted: session.hinted });
  session.position = freshPosition();
  session.moves = 0;
  session.hinted = false;
  anchor = null;
  currentHint = null;
  saveSession(storage, session);
  render();
  alertStatus('客房安排已重开，可以撤销。');
}
function snapshot() {
  history.push({ position: { rooms: session.position.rooms.slice(), excluded: session.position.excluded.slice() }, moves: session.moves, hinted: session.hinted });
  if (history.length > 100) history.shift();
}
function commitAction(result, usedHint) {
  snapshot();
  session.position = result.position;
  session.moves += 1;
  if (usedHint) session.hinted = true;
  anchor = null;
  currentHint = null;
  saveSession(storage, session);
  render();
  var report = analyze(puzzle, session.position);
  if (report.complete) {
    settle();
    return;
  }
  if (report.duplicates.length) alertStatus('组合重复：' + report.duplicates.join('、') + '。调整客房后再完成入住。');
  else if (result.effect === 'mark') alertStatus('已画排除线。这是笔记，不计入客房。');
  else if (result.effect === 'remove') alertStatus('已拆除这间客房。');
  else if (result.removed && result.removed.length) alertStatus('已拆除旧房并安排新房，可一次撤销。');
  else alertStatus('已安排 ' + report.used.length + '/' + puzzle.total + ' 种组合。');
}
function requestAction(key, usedHint) {
  var result = act(puzzle, session.position, key, tool);
  if (!result.accepted) { alertStatus('这条边暂时不能标记。'); return; }
  if (result.removed && result.removed.length && result.effect === 'add') {
    pendingAction = { result: result, usedHint: usedHint };
    $('#replace-description').textContent = '新房会拆除 ' + result.removed.length + ' 间已有客房。确认后可一次撤销。';
    openModal($('#replace-modal'));
    return;
  }
  commitAction(result, usedHint);
}
function tapCell(index) {
  if (!session || modal) return;
  if (anchor === null) { anchor = index; renderBoard(puzzle, session.position, $('#board'), true); alertStatus('已选第 ' + (index + 1) + ' 格；请点它上下左右的一格。'); return; }
  if (anchor === index) { anchor = null; renderBoard(puzzle, session.position, $('#board'), true); alertStatus('已取消选择。'); return; }
  var key = keyFor(puzzle, anchor, index);
  if (!key) { anchor = index; renderBoard(puzzle, session.position, $('#board'), true); alertStatus('只能配正交相邻的两位；已改选当前格。'); return; }
  requestAction(key, false);
}
async function settle() {
  var detail = finish(profile, session, puzzle, dateKey());
  if (!detail) return;
  var alreadyQueued = outbox.some(function (entry) { return entry.completionId === detail.completionId; });
  if (!alreadyQueued) outbox.push(detail);
  var profileSaved = saveProfile(storage, profile);
  var outboxSaved = saveOutbox(storage, outbox);
  var sessionSaved = saveSession(storage, session);
  var durable = profileSaved && outboxSaved && sessionSaved && await storage.flush();
  if (durable && !alreadyQueued) {
    window.dispatchEvent(new CustomEvent('mini-polish:game-complete', { detail: detail }));
  }
  if (durable) await deliverOutbox();
  $('#win-title').textContent = session.mode === 'daily' ? '今日入住完成' : '满房，名单齐了';
  $('#win-description').textContent = '全部 ' + puzzle.total + ' 间客房已安排，每种组合恰好一次。' + (session.hinted ? '本局使用过提示。' : '本局独立完成。');
  $('#win-reward').textContent = !durable ? '本机存档暂不可用，请保持页面并稍后重试。' : detail.rewardClaims.length ? '新收获：' + detail.rewardClaims.map(function (claim) { return claim.kind === 'daily' ? '今日印章' : '首通房卡'; }).join('、') : '本题奖励已领取过，可继续重玩。';
  renderNav();
  openModal($('#win-modal'));
}
async function deliverOutbox() {
  var host = window.MiniPolishHost;
  if (!host || typeof host.onGameComplete !== 'function') return;
  var retained = [];
  for (var i = 0; i < outbox.length; i += 1) {
    var detail = outbox[i];
    try { await host.onGameComplete(detail); } catch (_) { retained.push(detail); }
  }
  outbox = retained;
  saveOutbox(storage, outbox);
  await storage.flush();
}
function renderBoard(boardPuzzle, position, container, interactive) {
  var report = analyze(boardPuzzle, position);
  container.innerHTML = '';
  container.style.gridTemplateColumns = 'repeat(' + boardPuzzle.width + ', minmax(0, 1fr))';
  container.setAttribute('data-order', String(boardPuzzle.order));
  for (var i = 0; i < boardPuzzle.values.length; i += 1) {
    var guest = GUESTS[boardPuzzle.values[i]];
    var cell = document.createElement(interactive ? 'button' : 'div');
    var roomKey = report.occupied[i];
    var edge = roomKey ? boardPuzzle.edges[roomKey] : null;
    cell.className = 'guest-cell' + (roomKey ? ' is-room' : '') + (interactive && anchor === i ? ' is-anchor' : '');
    if (edge) {
      cell.className += edge.vertical ? (edge.a === i ? ' room-top' : ' room-bottom') : (edge.a === i ? ' room-left' : ' room-right');
      if (report.duplicates.indexOf(edge.pair) >= 0) cell.className += ' is-conflict';
    }
    cell.style.setProperty('--guest-color', guest.color);
    cell.innerHTML = '<span class="guest-mark" aria-hidden="true">' + guest.mark + '</span><strong>' + boardPuzzle.values[i] + '</strong><small>' + guest.name + '</small>';
    if (interactive) {
      cell.type = 'button';
      cell.setAttribute('aria-label', '第' + (Math.floor(i / boardPuzzle.width) + 1) + '行第' + (i % boardPuzzle.width + 1) + '列，' + guest.name + '，数字' + boardPuzzle.values[i] + (roomKey ? '，已入住' : '，未入住'));
      cell.dataset.cell = String(i);
      cell.addEventListener('click', function (event) { tapCell(Number(event.currentTarget.dataset.cell)); });
    }
    container.appendChild(cell);
  }
}
function renderInventory() {
  var report = analyze(puzzle, session.position);
  var tray = $('#inventory');
  tray.innerHTML = '';
  puzzle.pairs.forEach(function (pair) {
    var item = document.createElement('span');
    var count = report.pairCounts[pair] || 0;
    item.className = 'pair-chip' + (count === 1 ? ' is-used' : '') + (count > 1 ? ' is-duplicate' : '');
    item.textContent = pair + (count > 1 ? ' ×' + count : count === 1 ? ' ✓' : '');
    tray.appendChild(item);
  });
  $('#room-progress').textContent = report.used.length + ' / ' + puzzle.total;
  $('#board-progress').textContent = report.covered + ' / ' + puzzle.values.length + ' 格';
  $('#move-count').textContent = String(session.moves);
  $('#conflict-message').textContent = report.duplicates.length ? '重复组合：' + report.duplicates.join('、') : '每种组合只能用一次';
  $('#conflict-message').className = report.duplicates.length ? 'conflict-message warning' : 'conflict-message';
}
function renderNav() {
  ['map', 'play', 'collection'].forEach(function (name) {
    var button = $('#nav-' + name);
    button.classList.toggle('is-active', view === name);
    button.setAttribute('aria-current', view === name ? 'page' : 'false');
  });
  $('#nav-play').disabled = !session;
  $('#screen-map').hidden = view !== 'map';
  $('#screen-play').hidden = view !== 'play';
  $('#screen-collection').hidden = view !== 'collection';
}
function unlocked(level) {
  if (level.chapter === 1 && level.number === 1) return true;
  var previous = level.number > 1 ? LEVELS.filter(function (item) { return item.chapter === level.chapter && item.number === level.number - 1; })[0] : LEVELS.filter(function (item) { return item.chapter === level.chapter - 1 && item.number === 10; })[0];
  return !!(previous && profile.proofs[previous.id]);
}
function renderMap() {
  var chapterNav = $('#chapter-tabs');
  chapterNav.innerHTML = '';
  CHAPTERS.forEach(function (name, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-tab' + (selectedChapter === index + 1 ? ' is-active' : '');
    var complete = LEVELS.filter(function (level) { return level.chapter === index + 1 && profile.proofs[level.id]; }).length;
    button.textContent = '第' + (index + 1) + '章 ' + name + ' ' + complete + '/10';
    button.addEventListener('click', function () { selectedChapter = index + 1; renderMap(); });
    chapterNav.appendChild(button);
  });
  $('#chapter-heading').textContent = '第' + selectedChapter + '章 · ' + CHAPTERS[selectedChapter - 1];
  $('#chapter-description').textContent = ['从六种组合学会安排客房。', '1-2 与 2-1 是同一种房卡。', '看清还缺哪些组合。', '转角处的邻居会牵动整排。', '更热闹的大厅，十五种组合。', '让覆盖与名单一起指路。'][selectedChapter - 1];
  var grid = $('#level-grid');
  grid.innerHTML = '';
  LEVELS.filter(function (level) { return level.chapter === selectedChapter; }).forEach(function (level) {
    var button = document.createElement('button');
    var clear = !!profile.proofs[level.id];
    var available = unlocked(level);
    button.type = 'button';
    button.disabled = !available;
    button.className = 'level-tile' + (clear ? ' is-clear' : '');
    button.innerHTML = '<span>' + String(level.number).padStart(2, '0') + '</span><small>' + (clear ? '已入住 ✓' : available ? level.order + '阶 · 开始' : '待解锁') + '</small>';
    button.setAttribute('aria-label', level.title + (clear ? '，已通关' : available ? '，可游玩' : '，未解锁'));
    button.addEventListener('click', function () { startLevel(level, 'campaign'); });
    grid.appendChild(button);
  });
  var daily = dailyLevel();
  $('#daily-info').textContent = '今日题：第' + daily.chapter + '章第' + daily.number + '关 · ' + (profile.daily[dateKey()] && profile.daily[dateKey()].levelId === daily.id ? '今日已完成' : '今日未完成') + '。来自固定60题轮换。';
  $('#campaign-progress').textContent = Object.keys(profile.proofs).length + ' / 60';
}
function renderCollection() {
  var count = Object.keys(profile.proofs).length;
  $('#collection-total').textContent = String(count);
  var grid = $('#collection-grid');
  grid.innerHTML = '';
  CHAPTERS.forEach(function (name, index) {
    var cleared = LEVELS.filter(function (level) { return level.chapter === index + 1 && profile.proofs[level.id]; }).length;
    var card = document.createElement('article');
    card.className = 'collection-card' + (cleared === 10 ? ' is-complete' : '');
    card.innerHTML = '<div class="collection-symbol" aria-hidden="true">' + ['✦', '◇', '▤', '⌁', '◈', '☾'][index] + '</div><strong>' + name + '</strong><p>' + cleared + ' / 10 张首通房卡</p><small>' + (cleared === 10 ? '章节摆件已点亮' : '继续安排客房，点亮章节摆件') + '</small>';
    grid.appendChild(card);
  });
  $('#daily-count').textContent = String(Object.keys(profile.daily).length);
}
function renderPlay() {
  if (!session) return;
  $('#level-heading').textContent = session.level.title;
  $('#level-meta').textContent = session.mode === 'daily' ? '每日入住 · ' + session.date : '第' + session.level.chapter + '章 · ' + session.level.number + '/10';
  $('#order-description').textContent = '0–' + puzzle.order + ' · ' + puzzle.total + ' 间客房';
  renderBoard(puzzle, session.position, $('#board'), true);
  renderInventory();
  $('#undo-button').disabled = history.length === 0;
  $('#tool-room').classList.toggle('is-active', tool === 'room');
  $('#tool-exclude').classList.toggle('is-active', tool === 'exclude');
  $('#game-status').textContent = statusText || '先点一位妖怪，再点正交相邻的一位。';
  $('#hint-action').hidden = !currentHint;
}
function render() { renderNav(); renderMap(); renderPlay(); renderCollection(); }
function showTutorial() {
  tutorialPage = 0;
  renderTutorial();
  openModal($('#tutorial-modal'));
}
function renderTutorial() {
  var level = LEVELS[0];
  var tutorialPuzzle = makePuzzle(level);
  var initial = freshPosition();
  var first = act(tutorialPuzzle, initial, level.solution[0], 'room');
  var complete = { rooms: level.solution.slice(), excluded: [] };
  if (!first.accepted || !analyze(tutorialPuzzle, complete).complete) throw new Error('Tutorial truth chain failed');
  var positions = [initial, first.position, complete];
  var headings = ['① 看房客', '② 配一间房', '③ 满房核对'];
  var descriptions = [
    '每格是一位房客。数字0也是真实数字；下方清单列出完整六种组合。',
    '点相邻两格，把它们安排进一间房。这里使用首关的一次真实合法操作。',
    '首关真实完成态：每格住进一间房，0-0到2-2六种无序组合各用一次。',
  ];
  $('#tutorial-heading').textContent = headings[tutorialPage];
  $('#tutorial-description').textContent = descriptions[tutorialPage];
  $('#tutorial-counter').textContent = (tutorialPage + 1) + ' / 3';
  $('#tutorial-back').disabled = tutorialPage === 0;
  $('#tutorial-next').textContent = tutorialPage === 2 ? '开始游玩' : '下一张';
  renderBoard(tutorialPuzzle, positions[tutorialPage], $('#tutorial-board'), false);
  $('#tutorial-pairs').textContent = tutorialPuzzle.pairs.join(' · ');
}
function closeTutorial() { markTutorialSeen(storage); closeModal(); }
function hint() {
  if (!session) return;
  var missing = session.level.solution.filter(function (key) { return session.position.rooms.indexOf(key) < 0; });
  if (!missing.length) { alertStatus('解法已经全部放好；检查重复组合。'); return; }
  var key = missing[0];
  var edge = puzzle.edges[key];
  currentHint = key;
  $('#hint-action').hidden = false;
  $('#hint-description').textContent = '唯一题解中，第' + (Math.floor(edge.a / puzzle.width) + 1) + '行第' + (edge.a % puzzle.width + 1) + '格与第' + (Math.floor(edge.b / puzzle.width) + 1) + '行第' + (edge.b % puzzle.width + 1) + '格组成 ' + edge.pair + '。先观察，再决定是否放入。';
  openModal($('#hint-modal'));
}

$('#nav-map').addEventListener('click', function () { view = 'map'; render(); });
$('#nav-play').addEventListener('click', function () { view = 'play'; render(); });
$('#nav-collection').addEventListener('click', function () { view = 'collection'; render(); });
$('#daily-button').addEventListener('click', function () { startLevel(dailyLevel(), 'daily'); });
$('#tool-room').addEventListener('click', function () { tool = 'room'; anchor = null; renderPlay(); alertStatus('安排客房：依次点两位相邻房客。'); });
$('#tool-exclude').addEventListener('click', function () { tool = 'exclude'; anchor = null; renderPlay(); alertStatus('排除笔记：依次点相邻两格；再次点同一条边可取消。'); });
$('#undo-button').addEventListener('click', function () {
  if (!history.length) return;
  var previous = history.pop();
  session.position = previous.position; session.moves = previous.moves; session.hinted = previous.hinted; anchor = null; currentHint = null;
  saveSession(storage, session); render(); alertStatus('已撤销上一步。');
});
$('#restart-button').addEventListener('click', restoreLevel);
$('#hint-button').addEventListener('click', hint);
$('#tutorial-button').addEventListener('click', showTutorial);
$('#replace-cancel').addEventListener('click', function () { pendingAction = null; closeModal(); });
$('#replace-confirm').addEventListener('click', function () { var pending = pendingAction; pendingAction = null; closeModal(); if (pending) commitAction(pending.result, pending.usedHint); });
$('#tutorial-close').addEventListener('click', closeTutorial);
$('#tutorial-skip').addEventListener('click', closeTutorial);
$('#tutorial-back').addEventListener('click', function () { if (tutorialPage > 0) { tutorialPage -= 1; renderTutorial(); } });
$('#tutorial-next').addEventListener('click', function () { if (tutorialPage < 2) { tutorialPage += 1; renderTutorial(); } else closeTutorial(); });
$('#hint-close').addEventListener('click', closeModal);
$('#hint-action').addEventListener('click', function () { var key = currentHint; closeModal(); if (key) { tool = 'room'; requestAction(key, true); } });
$('#win-close').addEventListener('click', closeModal);
$('#win-map').addEventListener('click', function () { closeModal(); view = 'map'; render(); });
$('#win-next').addEventListener('click', function () {
  var next = LEVELS.filter(function (level) { return level.chapter === session.level.chapter && level.number === session.level.number + 1; })[0];
  closeModal(); if (next) startLevel(next, 'campaign'); else { view = 'map'; render(); }
});
document.addEventListener('keydown', function (event) {
  if (!modal) return;
  if (event.key === 'Escape') { event.preventDefault(); if (modal.id === 'tutorial-modal') closeTutorial(); else closeModal(); return; }
  if (event.key !== 'Tab') return;
  var focusables = Array.prototype.slice.call(modal.querySelectorAll('button:not([disabled])'));
  if (!focusables.length) return;
  var first = focusables[0], last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
window.addEventListener('pagehide', function () { if (session) saveSession(storage, session); });
deliverOutbox();
render();
if (!tutorialSeen(storage)) showTutorial();
}
boot().catch(function (error) { document.body.textContent = '小工具启动失败，请重新打开。'; console.error(error); });
