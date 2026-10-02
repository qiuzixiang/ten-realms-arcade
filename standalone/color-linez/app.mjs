import { move, tutorialStates, emptyCells } from './core.mjs';
import { KEYS, loadSettings, loadSession, freshSession, loadRecords, recordRun, safeWrite } from './storage.mjs';
import { PALETTE, defsMarkup, beadMarkup, crownMarkup, tutorialSvg } from './renderer.mjs';

const $ = (id) => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
let settings = loadSettings(storage), records = loadRecords(storage);
const seedNow = () => {
  // Some embedded WebViews expose crypto but reject calls to it.
  try {
    const cryptoSource = window.crypto;
    if (cryptoSource && typeof cryptoSource.getRandomValues === 'function') {
      const n = new Uint32Array(1); cryptoSource.getRandomValues(n); return n[0];
    }
  } catch { /* A new board does not require cryptographic randomness. */ }
  return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
};
const runId = () => `${Date.now().toString(36)}-${seedNow().toString(36)}`;
let loaded = loadSession(storage);
let { session, state } = loaded || freshSession(seedNow(), runId(), (records[0] && records[0].score) || 100);
let visualBoard = [...state.board], selected = -1, busy = false, epoch = 0, tutorialPage = 0, activeDialog = '', returnFocus = null, toastTimer, gainTimer, audioContext;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const cells = [];

// Measure Flex gap once: old WebViews may recognize gap only in Grid.
const gapProbe = document.createElement('div');
gapProbe.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px';
gapProbe.appendChild(document.createElement('div')); gapProbe.appendChild(document.createElement('div'));
document.body.appendChild(gapProbe);
if (gapProbe.scrollHeight === 1) document.body.classList.remove('no-flex-gap');
gapProbe.remove();

$('svg-defs').innerHTML = defsMarkup();
$('heading-beads').innerHTML = beadMarkup(3) + beadMarkup(2) + beadMarkup(4);
$('record-label').textContent = '纪录';
for (let i = 0; i < 81; i++) {
  const button = document.createElement('button');
  button.className = `cell${(Math.floor(i / 9) + i % 9) % 2 ? ' dark' : ''}`;
  button.type = 'button'; button.dataset.cell = i; button.tabIndex = i === 0 ? 0 : -1;
  $('board').append(button); cells.push(button);
}

function applySettings() { document.body.classList.toggle('no-symbols', !settings.symbols); renderPreview(); }
function renderBoard() {
  for (let i = 0; i < 81; i++) {
    const color = visualBoard[i];
    if (cells[i].dataset.color !== String(color)) { cells[i].innerHTML = color ? beadMarkup(color) : ''; cells[i].dataset.color = color; }
    cells[i].setAttribute('aria-label', `${Math.floor(i / 9) + 1}行${i % 9 + 1}列，${color ? PALETTE[color - 1].name : '空格'}`);
    cells[i].setAttribute('aria-pressed', i === selected ? 'true' : 'false');
    cells[i].classList.toggle('selected', i === selected);
  }
  $('board').classList.toggle('game-over-board', state.gameOver);
}
function renderPreview(next = state.next) {
  $('next-balls').innerHTML = settings.preview ? next.map((c) => beadMarkup(c)).join('') : '<span class="preview-hidden">预告已隐藏</span>';
  $('next-balls').setAttribute('aria-label', settings.preview ? `接下来：${next.map((c) => PALETTE[c - 1].name).join('、')}` : '出球预告已隐藏');
}
function renderStats() {
  $('score').textContent = state.score.toLocaleString('en-US');
  $('best').textContent = session.target.toLocaleString('en-US');
  $('king-stage-score').textContent = session.target.toLocaleString('en-US');
  $('player-stage-score').textContent = state.score.toLocaleString('en-US');
  const kingHeight = Math.min(260, Math.max(34, Math.round(session.target * 1.7)));
  const playerHeight = Math.min(260, Math.max(18, Math.round(state.score * 1.7)));
  document.documentElement.style.setProperty('--king-pedestal-height', `${kingHeight}px`);
  document.documentElement.style.setProperty('--player-pedestal-height', `${playerHeight}px`);
  document.body.classList.toggle('record-surpassed', state.score > session.target);
  $('empty-count').textContent = emptyCells(state.board).length;
  $('turn-count').textContent = `第 ${state.turns} 步`;
  $('progress-fill').style.width = `${Math.min(100, state.score / session.target * 100)}%`;
  $('king-message').textContent = state.score > session.target ? '皇冠已经属于你，继续创造新纪录。' : `超过 ${session.target.toLocaleString('en-US')} 分，${session.target === 100 ? '摘下第一顶皇冠' : '刷新自己的纪录'}`;
}
function status(text) { $('status').textContent = text; }
function restingStatus() { status(state.gameOver ? '游戏结束：棋盘已满' : selected >= 0 ? '请选择目标空格' : '请选择一个彩球'); }
function render() { renderBoard(); renderPreview(); renderStats(); restingStatus(); }
function persist() {
  const ok = safeWrite(storage, KEYS.session, session);
  const recordsOk = safeWrite(storage, KEYS.records, records);
  $('save-status').innerHTML = ok && recordsOk ? '进度已自动保存 <i></i>' : '当前环境无法保存进度';
}
function showToast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2300); }
function sound(kind = 'tap') {
  if (!settings.sound) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {});
    const notes = kind === 'clear' ? [523.25, 659.25, 783.99] : kind === 'crown' ? [523.25, 659.25, 783.99, 1046.5] : [kind === 'blocked' ? 170 : 660];
    notes.forEach((f, i) => { const osc = audioContext.createOscillator(), gain = audioContext.createGain(), start = audioContext.currentTime + i * .055; osc.type = 'sine'; osc.frequency.value = f; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.065, start + .007); gain.gain.exponentialRampToValueAtTime(.001, start + .18); osc.connect(gain); gain.connect(audioContext.destination); osc.start(start); osc.stop(start + .2); });
  } catch { /* Audio is decorative; unsupported WebViews remain playable. */ }
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion.matches ? 0 : ms));
function settleAnimation() {
  epoch++; busy = false; selected = -1; visualBoard = [...state.board]; $('effects').textContent = '';
  cells.forEach((c) => c.classList.remove('clearing', 'spawning', 'touch-target'));
  render();
}
async function travel(event, token) {
  visualBoard[event.from] = 0; renderBoard();
  if (!reduceMotion.matches) {
    const ghost = document.createElement('div'); ghost.className = 'moving-bead'; ghost.innerHTML = beadMarkup(event.color); $('effects').append(ghost);
    const duration = Math.min(520, Math.max(120, (event.path.length - 1) * 38)), start = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        if (token !== epoch) { ghost.remove(); resolve(); return; }
        const p = Math.min(1, (now - start) / duration) * (event.path.length - 1), segment = Math.min(event.path.length - 2, Math.floor(p)), t = p - segment;
        const a = event.path[segment], b = event.path[segment + 1];
        const x = (a % 9) * (1 - t) + (b % 9) * t, y = Math.floor(a / 9) * (1 - t) + Math.floor(b / 9) * t;
        ghost.style.left = `${x / 9 * 100}%`; ghost.style.top = `${y / 9 * 100}%`;
        if (p >= event.path.length - 1) { ghost.remove(); resolve(); } else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }
  if (token === epoch) { visualBoard[event.to] = event.color; renderBoard(); }
}
async function performMove(from, to) {
  const result = move(state, from, to);
  if (!result.ok) {
    status('这里走不通，试试另一条路'); sound('blocked'); cells[to].classList.add('invalid');
    setTimeout(() => cells[to].classList.remove('invalid'), 300); return;
  }
  const previousScore = state.score;
  state = result.state; session.moves.push([from, to]); selected = -1; busy = true;
  records = recordRun(records, session, state, new Date().toISOString()); persist();
  const token = ++epoch;
  try {
    for (const event of result.events) {
      if (token !== epoch) return;
      if (event.type === 'move') { sound(); await travel(event, token); }
      else if (event.type === 'spawn') {
        visualBoard[event.at] = event.color; renderBoard(); renderPreview(event.next); cells[event.at].classList.add('spawning');
        await delay(120); if (token !== epoch) return; cells[event.at].classList.remove('spawning');
      } else {
        event.cells.forEach((i) => cells[i].classList.add('clearing'));
        sound('clear'); status(event.automatic ? '新珠自动成线，消除后继续补球' : `${event.cells.length} 颗成线 · +${event.points} 分`);
        await delay(280); if (token !== epoch) return;
        event.cells.forEach((i) => { visualBoard[i] = 0; cells[i].classList.remove('clearing'); }); renderBoard();
      }
    }
  } finally {
    if (token === epoch) {
      busy = false; visualBoard = [...state.board]; render();
      if (state.score > previousScore) {
        clearTimeout(gainTimer); $('score-gain').textContent = `+${state.score - previousScore}`;
        gainTimer = setTimeout(() => $('score-gain').textContent = '', 1700);
      }
      if (previousScore <= session.target && state.score > session.target) { showToast('摘下皇冠，这一次你超越了自己'); sound('crown'); }
      if (state.gameOver) showGameOver();
    }
  }
}
function activate(i) {
  if (busy || activeDialog || !Number.isInteger(i) || i < 0 || i >= 81) return;
  if (state.gameOver) { showGameOver(); return; }
  if (state.board[i]) { selected = i; sound(); renderBoard(); restingStatus(); }
  else if (selected >= 0) void performMove(selected, i);
}

// Release-to-commit prevents scrolling or a slipping finger from spending a turn.
let gesture = null;
function cellAt(event) {
  const r = $('board').getBoundingClientRect(), x = Math.floor((event.clientX - r.left) / (r.width / 9)), y = Math.floor((event.clientY - r.top) / (r.height / 9));
  return x < 0 || x > 8 || y < 0 || y > 8 ? -1 : y * 9 + x;
}
function removeLoupe() { const loupe = document.querySelector('.touch-loupe'); if (loupe) loupe.remove(); }
function clearGesture() {
  if (gesture) clearTimeout(gesture.timer);
  gesture = null; cells.forEach((c) => c.classList.remove('touch-target')); removeLoupe();
}
function showLoupe(i, event) {
  if (i < 0) { removeLoupe(); return; }
  let loupe = document.querySelector('.touch-loupe');
  if (!loupe) { loupe = document.createElement('div'); loupe.className = 'touch-loupe'; loupe.setAttribute('aria-hidden', 'true'); document.body.append(loupe); }
  loupe.innerHTML = visualBoard[i] ? beadMarkup(visualBoard[i]) : '<span class="loupe-target">＋</span>';
  loupe.style.left = `${Math.max(45, Math.min(innerWidth - 45, event.clientX))}px`;
  loupe.style.top = `${Math.max(10, event.clientY - 98)}px`;
}
$('board').addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || busy || activeDialog) return;
  const i = cellAt(event); if (i < 0) return;
  clearGesture(); $('board').setPointerCapture(event.pointerId);
  gesture = { id: event.pointerId, first: i, current: i, held: false, event };
  cells[i].classList.add('touch-target');
  if (event.pointerType !== 'mouse') gesture.timer = setTimeout(() => { if (!gesture) return; gesture.held = true; showLoupe(gesture.current, gesture.event); }, 300);
});
$('board').addEventListener('pointermove', (event) => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const i = cellAt(event); gesture.current = i; gesture.event = event;
  cells.forEach((c) => c.classList.remove('touch-target')); if (i >= 0) cells[i].classList.add('touch-target');
  if (gesture.held) showLoupe(i, event);
});
$('board').addEventListener('pointerup', (event) => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const i = cellAt(event), commit = i >= 0 && (i === gesture.first || gesture.held);
  clearGesture(); if (commit) activate(i);
});
$('board').addEventListener('pointercancel', clearGesture);
$('board').addEventListener('lostpointercapture', clearGesture);
$('board').addEventListener('click', (event) => {
  // Keyboard / assistive-technology click. Pointer actions are handled above.
  if (event.detail === 0) { const target = event.target.closest('[data-cell]'); const i = target ? Number(target.dataset.cell) : -1; if (Number.isInteger(i)) activate(i); }
});
$('board').addEventListener('keydown', (event) => {
  const i = cells.indexOf(document.activeElement); if (i < 0) return;
  let next = i;
  if (event.key === 'ArrowLeft' && i % 9) next--;
  else if (event.key === 'ArrowRight' && i % 9 < 8) next++;
  else if (event.key === 'ArrowUp' && i >= 9) next -= 9;
  else if (event.key === 'ArrowDown' && i < 72) next += 9;
  else if (event.key === 'Escape') { selected = -1; render(); }
  if (event.key.startsWith('Arrow')) { event.preventDefault(); cells[i].tabIndex = -1; cells[next].tabIndex = 0; cells[next].focus(); }
});

function openDialog(kind, content) {
  clearGesture(); if (busy) settleAnimation();
  if (!activeDialog) returnFocus = document.activeElement;
  activeDialog = kind; $('dialog-content').innerHTML = content; $('dialog-backdrop').hidden = false;
  document.body.style.overflow = 'hidden'; $('dialog').scrollTop = 0; $('dialog').focus();
}
function closeDialog() {
  if (activeDialog === 'tutorial') safeWrite(storage, KEYS.tutorial, true);
  activeDialog = ''; $('dialog-backdrop').hidden = true; document.body.style.overflow = '';
  if (returnFocus && returnFocus.focus) returnFocus.focus();
}
$('close-dialog').addEventListener('click', closeDialog);
$('dialog-backdrop').addEventListener('click', (event) => { if (event.target === $('dialog-backdrop')) closeDialog(); });
document.addEventListener('keydown', (event) => {
  if (!activeDialog) return;
  if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
  if (event.key === 'Tab') {
    const focusable = [...$('dialog').querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter((e) => !e.hidden);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === $('dialog'))) { event.preventDefault(); if (last) last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === $('dialog'))) { event.preventDefault(); if (first) first.focus(); }
  }
});
function showTutorial(page = 0) {
  tutorialPage = page; const lesson = tutorialStates();
  const titles = ['认识彩球与棋盘', '移动一个彩球', '五颗连线消除'];
  const descriptions = ['把同色珠子排成横线、竖线或斜线。连成至少五颗，就能腾出空间。', '点珠子，再点空格。珠子只能沿上下左右的空格通行，不能穿过其他珠子。', '这一手消去五颗琥珀珠，得到 10 分。主动消除后不补球；未消除时补入三颗。'];
  const picture = tutorialSvg(page === 2 ? lesson.after : lesson.before, { prefix: `lesson-${page}`, selected: page === 1 ? 60 : -1, path: page === 1 ? lesson.path : [], cleared: page === 2 ? lesson.events[1].cells : [] });
  openDialog('tutorial', `<p class="eyebrow">A LITTLE GUIDE · 0${page + 1} / 03</p><h2 id="dialog-title">${titles[page]}</h2><div class="tutorial-picture">${picture}</div><div class="tutorial-progress">${[0, 1, 2].map((i) => `<i class="${i <= page ? 'active' : ''}"></i>`).join('')}</div><p class="tutorial-description">${descriptions[page]}</p><div class="dialog-actions"><button id="lesson-skip" class="secondary-button">${page ? '上一步' : '跳过教学'}</button><button id="lesson-next" class="primary-button">${page === 2 ? '开始游玩' : '下一步'}</button></div>`);
  $('lesson-skip').addEventListener('click', () => page ? showTutorial(page - 1) : closeDialog());
  $('lesson-next').addEventListener('click', () => page === 2 ? closeDialog() : showTutorial(page + 1));
}
function showRules() {
  openDialog('rules', `<p class="eyebrow">THE ORIGINAL RULES</p><h2 id="dialog-title">简单，也值得琢磨</h2><ol class="rules-list"><li>9 × 9 棋盘、7 种颜色，开局放入 5 颗珠子。</li><li>每次移动一颗珠子，只能沿上下左右的空格通行。</li><li>横、竖或斜向，同色至少 5 颗成线即可消除。主动消除后，这一步不补球。</li><li>没有消除时，系统按顺序补入 3 颗。新珠自动成线会消除、不加分，并为这颗继续补球。</li><li>棋盘填满，本局结束。超过皇冠分数后仍可继续游玩。</li></ol><table class="score-table" aria-label="单线计分"><tr><th>连珠</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th></tr><tr><td>得分</td><td>10</td><td>12</td><td>18</td><td>28</td><td>42</td></tr></table><p>同时形成多条线时，按各条线长度的总和计分。例如两条五连交叉，消去 9 颗，计 60 分。</p><p>手机上可长按棋格放大，轻移手指选准后松开。电脑支持方向键选格、Enter 或空格操作。</p><div class="dialog-actions"><button id="review-tutorial" class="secondary-button">再看图片教学</button><button id="rules-done" class="primary-button">知道了</button></div><p class="source-note">规则依据 Color Linez v1.21（1999，Ivan Golubev），追溯 GAMOS Color Lines（1992）。本作重新绘制画面、独立实现规则；自动续局为手机端便利功能。</p>`);
  $('review-tutorial').addEventListener('click', () => showTutorial()); $('rules-done').addEventListener('click', closeDialog);
}
function showSettings() {
  openDialog('settings', `<p class="eyebrow">MAKE YOURSELF AT HOME</p><h2 id="dialog-title">按喜欢的方式玩</h2>${[['sound', '轻柔音效', '选中与消除时的玻璃轻响'], ['preview', '出球预告', '显示接下来三颗珠子的颜色'], ['symbols', '辨色纹样', '用细小图案辅助区分七种颜色']].map(([key, label, note]) => `<div class="setting-row"><label class="setting-label" for="setting-${key}"><span>${label}<small>${note}</small></span><input type="checkbox" class="switch" id="setting-${key}" ${settings[key] ? 'checked' : ''}></label></div>`).join('')}<p>进度与纪录仅保存在当前设备。游戏没有倒计时，随时停下，回来接着玩。</p><div class="dialog-actions"><button id="settings-done" class="primary-button">回到棋盘</button></div>`);
  for (const key of ['sound', 'preview', 'symbols']) $('setting-' + key).addEventListener('change', (event) => { settings[key] = event.target.checked; safeWrite(storage, KEYS.settings, settings); applySettings(); if (key === 'sound') sound(); });
  $('settings-done').addEventListener('click', closeDialog);
}
function showRecords() {
  const list = records.length ? `<div class="record-list">${records.map((r, i) => `<div class="record-row"><span class="rank">${String(i + 1).padStart(2, '0')}</span><div><strong>${r.score.toLocaleString('en-US')}</strong><small> 分 · ${r.turns} 步</small></div><span>${/^\d{4}-\d{2}-\d{2}/.test(r.date) ? r.date.slice(5, 10).replace('-', ' / ') : ''}</span></div>`).join('')}</div>` : `<div class="empty-record">${crownMarkup('crown')}<p>第一条纪录，等你来留下。<br>连成五颗，就从 10 分开始。</p></div>`;
  openDialog('records', `<p class="eyebrow">YOUR LITTLE HALL OF FAME</p><h2 id="dialog-title">每一次，都有进步</h2><p>本机最高的十局成绩 · 同一局只记录一次</p>${list}<div class="dialog-actions"><button id="records-done" class="primary-button">继续游玩</button></div>`); $('records-done').addEventListener('click', closeDialog);
}
function startNew() {
  clearGesture(); settleAnimation(); closeDialog();
  // Finalize the completed run before choosing the next king. This also covers
  // restored game-over sessions where the last record write was interrupted.
  if (state.gameOver) records = recordRun(records, session, state, new Date().toISOString());
  const nextKingScore = Math.max(100, (records[0] && records[0].score) || 0);
  ({ session, state } = freshSession(seedNow(), runId(), nextKingScore));
  visualBoard = [...state.board]; clearTimeout(gainTimer); $('score-gain').textContent = ''; render(); persist();
}
function requestNew() {
  if (busy) settleAnimation();
  if (!state.turns || state.gameOver) { startNew(); return; }
  openDialog('new', `<p class="eyebrow">A FRESH START</p><h2 id="dialog-title">重新铺开一局？</h2><p>当前棋盘会重新开始，已经获得的个人纪录会保留。</p><div class="dialog-actions"><button id="keep-playing" class="secondary-button">继续这局</button><button id="confirm-new" class="primary-button">开始新局</button></div>`);
  $('keep-playing').addEventListener('click', closeDialog); $('confirm-new').addEventListener('click', startNew);
}
function showGameOver() {
  openDialog('over', `<p class="eyebrow">UNTIL THE NEXT LITTLE MOMENT</p><h2 id="dialog-title">这一局，收好啦</h2><div class="final-score">${crownMarkup('crown')}<strong>${state.score.toLocaleString('en-US')}</strong><p>${state.score > session.target ? '你摘下了这一局的皇冠' : '每一次整理，都会多一点心得'}</p></div><div class="end-details"><span>${state.turns} 次移动</span><span>${state.removed.reduce((a, b) => a + b, 0)} 颗已消除</span></div><div class="dialog-actions"><button id="over-records" class="secondary-button">看看纪录</button><button id="over-new" class="primary-button">再来一局</button></div>`);
  $('over-records').addEventListener('click', showRecords); $('over-new').addEventListener('click', startNew);
}
$('new-game').addEventListener('click', requestNew); $('rules-button').addEventListener('click', showRules); $('settings-button').addEventListener('click', showSettings); $('records-button').addEventListener('click', showRecords);
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearGesture(); if (busy) settleAnimation(); persist(); } });
window.addEventListener('pagehide', () => { if (busy) settleAnimation(); persist(); });
applySettings(); render(); persist();
let tutorialSeen = false; try { tutorialSeen = JSON.parse(storage.getItem(KEYS.tutorial)) === true; } catch { /* first visit */ }
if (!tutorialSeen) showTutorial(); else if (state.gameOver) showGameOver();
