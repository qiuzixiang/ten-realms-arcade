import { DIRECTIONS, createGame, attemptMove, undo, solve } from './core.mjs';
import { LEVELS, CHAPTERS, createDailyLevel, createExpeditionLevel } from './levels.mjs';
import { loadProfile, saveProfile, restoreRun, resumeMode, beginRun, updateRun, completeRun, recordHint, starsFor, getStats, isUnlocked, MAX_MOVE_LOG } from './storage.mjs';
import { renderBoard, boardMarkup, boardDimensions, cellPoint } from './renderer.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad = value => String(value).padStart(2, '0');
const icons = {
  orbit:'<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-32 12 12)"/><circle cx="12" cy="12" r="6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01"/>',
  sound:'<path d="M10 5 5 9H2v6h3l5 4ZM14 8a6 6 0 0 1 0 8M17 5a10 10 0 0 1 0 14"/>',
  muted:'<path d="M10 5 5 9H2v6h3l5 4ZM15 9l6 6M21 9l-6 6"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M20 4l-2 2M6 18l-2 2"/>',
  infinity:'<path d="M12 12C5-1-4 13 5 16c6 2 9-12 14-9 9 4 0 17-7 5Z"/>',
  constellation:'<path d="m4 17 5-12 10 4-4 10-11-2Z M9 5l6 14"/><circle cx="4" cy="17" r="1.5"/><circle cx="9" cy="5" r="1.5"/><circle cx="19" cy="9" r="1.5"/><circle cx="15" cy="19" r="1.5"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  ship:'<path d="m12 2 8 17-8-4-8 4ZM12 15v7"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 7-2.5 6.5L7 16l2.5-6.5Z"/>',
  undo:'<path d="M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12"/>',
  restart:'<path d="M4 10a8 8 0 1 1 1 7M4 3v7h7"/>',
  spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  grid:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
hydrateIcons();
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let profile = loadProfile(storage);
let game = restoreRun(profile);
let mode = profile.currentRun?.mode || 'campaign';
let busy = false, epoch = 0, animationFrame = 0, hintDirection = null, previewDirection = null;
let toastTimer, modalKind = null, modalReturnFocus = null, tutorialStep = 0, expeditionDifficulty = 1;
let lastCampaignId = mode === 'campaign' ? game?.levelId : null;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const chapterEnglish = ['THE FIRST LIGHT','REFRACTED ROUTES','GRAVITY ISLANDS','THE REDSHIFT','A WEB OF STARS','INTO THE INFINITE'];
const directionLabels = {N:'向上',NE:'向右上',E:'向右',SE:'向右下',S:'向下',SW:'向左下',W:'向左',NW:'向左上'};
const directionArrows = {N:'↑',NE:'↗',E:'→',SE:'↘',S:'↓',SW:'↙',W:'←',NW:'↖'};

if (!game) {
  const index = LEVELS.findIndex((level, index) => isUnlocked(profile,index) && !profile.records[level.id]);
  game = createGame(LEVELS[index < 0 ? 0 : index]); mode = 'campaign';
  profile = beginRun(profile, game.level, mode); lastCampaignId = game.levelId;
}
if (game.status === 'won') profile = completeRun(profile, game);

function persist() {
  const result = saveProfile(storage, profile);
  $('save-status').textContent = result.ok ? '航程自动保存' : '暂未保存 · 浏览器存储不可用';
  $('save-status').classList.toggle('storage-warning', !result.ok);
  return result.ok;
}
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible'); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3600); }
function feedback(message, danger = false) { $('flight-feedback').classList.toggle('danger',danger); $('flight-feedback').querySelector('p').textContent = message; }
function invalidate() { touchStart=null; epoch++; cancelAnimationFrame(animationFrame); busy = false; hintDirection = null; previewDirection = null; }
function currentChapter() { return CHAPTERS[game.level.chapter || 0]; }
function starsText(count) { return '✦'.repeat(count) + '✧'.repeat(3-count); }
function localDate() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function nextCampaignIndex() { return LEVELS.findIndex((level, i) => isUnlocked(profile,i) && !profile.records[level.id]); }

let audioContext;
function sound(kind) {
  if (!profile.settings.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {});
    const notes = kind === 'won' ? [392,523.25,659.25,783.99] : kind === 'collect' ? [659.25,880] : kind === 'lost' ? [146.83,110] : kind === 'undo' ? [349.23,261.63] : [220,329.63];
    notes.forEach((frequency,i) => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      const start = audioContext.currentTime + i * (kind === 'won' ? .12 : .055);
      osc.type = 'sine'; osc.frequency.setValueAtTime(frequency,start);
      gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.045,start+.016); gain.gain.exponentialRampToValueAtTime(.0001,start+.22);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(start); osc.stop(start+.24);
    });
  } catch { /* Audio is decorative; navigation always remains available. */ }
}
function renderSound() {
  $('sound-button').innerHTML = `<span data-icon="${profile.settings.sound ? 'sound' : 'muted'}"></span>`;
  $('sound-button').setAttribute('aria-label', profile.settings.sound ? '关闭音效' : '打开音效');
  $('sound-button').setAttribute('aria-pressed',String(profile.settings.sound)); hydrateIcons($('sound-button'));
}
function renderUI({board = true, effects = false} = {}) {
  const level = game.level, chapter = currentChapter(), record = profile.records[level.id];
  $('chapter-eyebrow').textContent = mode === 'campaign' ? `CHAPTER ${pad(chapter.id+1)} / ${chapterEnglish[chapter.id]}` : mode === 'daily' ? `DAILY VOYAGE / ${level.date}` : 'FREE EXPLORATION / UNCHARTED SPACE';
  $('chapter-title').innerHTML = `${mode === 'campaign' ? escape(chapter.name) : mode === 'daily' ? '今日，有新的星光' : '把航线交给远方'}<span class="title-dot">.</span>`;
  $('mission-number').textContent = mode === 'campaign' ? `MISSION ${pad(level.number)}` : mode === 'daily' ? 'DAILY MISSION' : `EXPLORATION / ${['01','02','03'][level.difficulty]}`;
  $('level-name').textContent = level.name;
  $('level-brief').textContent = level.briefing.replaceAll('能源芯','星核').replaceAll('能源','星核').replaceAll('失控反应堆','暗雷').replaceAll('反应堆','暗雷');
  $('pilot-note').textContent = level.lesson.replaceAll('能源芯','星核').replaceAll('反应堆','暗雷');
  $('level-stars').textContent = starsText(record?.stars || 0);
  $('level-stars').setAttribute('aria-label',record ? `本关最佳${record.stars}星` : '尚未获得星级');
  $('board-label').textContent = mode === 'campaign' ? `SECTOR ${pad(chapter.id+1)}—${pad((level.number-1)%8+1)}` : mode === 'daily' ? level.date : `SIGNAL / ${String(level.seed).slice(0,22)}`;
  $('board-size').textContent = `${level.width} × ${level.height}`;
  $('collected').textContent = game.collected; $('total-energy').textContent = game.totalEnergy; $('moves').textContent = pad(game.moves);
  $('par-label').textContent = profile.currentRun?.hints ? '已用提示 · 本局可获一星' : `三星航线 ≤ ${level.par} 次`;
  $('energy-dots').innerHTML = Array.from({length:game.totalEnergy},(_,i)=>`<i class="${i<game.collected?'filled':''}"></i>`).join('');
  $('energy-dots').setAttribute('aria-hidden','true');
  $('header-stars').textContent = getStats(profile).campaignStars;
  $('collection-button').setAttribute('aria-label', `查看星图，已获得 ${getStats(profile).campaignStars} 颗旅程星光`);
  ['campaign','daily','expedition'].forEach(name => { $(`${name}-button`).classList.toggle('active', mode===name); $(`${name}-button`).setAttribute('aria-pressed',String(mode===name)); });
  if (board) renderBoard($('board'),game,{idPrefix:'main',effects:effects&&!reduced.matches});
  renderControls(); renderJourney(); renderSound();
}
function renderControls() {
  document.querySelectorAll('[data-direction]').forEach(button => {
    const direction = button.dataset.direction;
    const canMove = game.status === 'playing' && attemptMove(game,direction).moved;
    button.disabled = busy || !canMove;
    button.classList.toggle('hinted',hintDirection===direction);
    button.classList.toggle('previewing',previewDirection===direction);
  });
  $('undo-button').disabled = busy || !game.history.length;
  $('hint-button').disabled = busy || game.status !== 'playing';
}
function renderJourney() {
  const savedCampaign = profile.suspendedRuns?.campaign;
  const chapter = mode==='campaign' ? currentChapter() : CHAPTERS[Math.floor((LEVELS.find(l=>l.id===savedCampaign?.levelId)?.campaignIndex || 0)/8)];
  document.querySelector('.journey-label .eyebrow').textContent = mode==='campaign' ? 'YOUR JOURNEY' : 'RETURN TO YOUR JOURNEY';
  const levels = LEVELS.filter(level => level.chapter === chapter.id);
  $('journey-caption').textContent = mode === 'campaign' ? `${levels.filter(level=>profile.records[level.id]).length} / 8 段航线已点亮` : mode === 'daily' ? '每日刷新 · 旅程进度为你保留' : `航图编号：${game.level.seed}`;
  $('journey-nodes').innerHTML = levels.map(level => {
    const record = profile.records[level.id], current = mode==='campaign' && level.id===game.levelId;
    return `<button class="journey-node ${record?'complete':''} ${current?'current':''}" data-level="${level.id}" ${isUnlocked(profile,level.campaignIndex)?'':'disabled'} ${current?'aria-current="step"':''} aria-label="第${level.number}关 ${escape(level.name)}${record?`，${record.stars}星`:isUnlocked(profile,level.campaignIndex)?'':'，未解锁'}">${isUnlocked(profile,level.campaignIndex)?pad(level.number):`<span data-icon="lock" class="lock-icon"></span>`}${record?`<small>${'✦'.repeat(record.stars)}</small>`:''}</button>`;
  }).join(''); hydrateIcons($('journey-nodes'));
}
function startLevel(level, newMode = 'campaign') {
  closeModal(); invalidate(); game = createGame(level); mode = newMode;
  profile = beginRun(profile,level,mode); if (mode==='campaign') lastCampaignId = level.id;
  persist(); renderUI(); feedback(level.number===1 ? '向右推进，回收你的第一枚星核。' : '先看停靠点，再规划你的航线。');
}
function restartLevel() { startLevel(game.level,mode); toast('飞船已回到起点，换一条航线试试。'); }

function preview(direction) {
  if (busy || modal.open || game.status !== 'playing') return;
  previewDirection = direction; const result = attemptMove(game,direction);
  renderBoard($('board'),game,{idPrefix:'main',preview:result}); renderControls();
}
function clearPreview() {
  if (busy || !previewDirection) return;
  previewDirection = null; renderBoard($('board'),game,{idPrefix:'main'}); renderControls();
}
function move(direction) {
  if (busy || modal.open || game.status !== 'playing') return;
  if (game.moves >= MAX_MOVE_LOG) { toast('这次航程已达512次推进，请撤销或重开后继续。'); return; }
  const result = attemptMove(game,direction);
  if (!result.moved) { feedback('前方就是舱壁，换个方向看看。'); return; }
  const previous = game, token = ++epoch, first = !profile.records[game.levelId];
  previewDirection = null; hintDirection = null; busy = true; game = result.state;
  profile = updateRun(profile,game);
  if (game.status === 'won') profile = completeRun(profile,game);
  persist();
  // Draw final facts now, but the craft travels through every actual cell of the move.
  renderUI({effects:true});
  const ship = $('board').querySelector('[data-ship]');
  const points = [previous.position,...result.path].map(p=>cellPoint(game,p));
  const duration = reduced.matches ? 0 : Math.min(650,180 + result.path.length * 45);
  const started = performance.now();
  if (ship) ship.setAttribute('transform',`translate(${points[0].x} ${points[0].y})`);
  sound(game.status==='lost'?'lost':result.collected?.length?'collect':'move');
  feedback(game.status==='lost'?'触碰暗雷了。撤销一步，就能重新选择。':result.collected?.length?`回收 ${result.collected.length} 枚星核${game.status==='won'?'，本段航线完成。':'，继续寻找下一段航线。'}`:result.stopReason==='stop'?'已停泊。这里是一个新的出发点。':'安全停稳。下一枚星核在等你。',game.status==='lost');
  function frame(now) {
    if (token !== epoch) return;
    const raw = duration ? Math.min(1,(now-started)/duration) : 1;
    const t = (raw<.5 ? 2*raw*raw : 1-Math.pow(-2*raw+2,2)/2)*(points.length-1);
    const index = Math.min(points.length-2,Math.floor(t)), part=t-index;
    const a=points[index],b=points[index+1];
    if(ship)ship.setAttribute('transform',`translate(${a.x+(b.x-a.x)*part} ${a.y+(b.y-a.y)*part})`);
    if(raw<1) animationFrame=requestAnimationFrame(frame);
    else {
      busy=false; renderControls();
      if(game.status==='won') { renderUI(); sound('won'); if(!modal.open)showVictory(first); }
    }
  }
  animationFrame=requestAnimationFrame(frame);
}
function undoMove() {
  if(busy || !game.history.length) return;
  closeModal(); invalidate(); game=undo(game); profile=updateRun(profile,game); persist(); renderUI(); sound('undo'); feedback('已撤销一步。慢慢想，不会扣除星级。');
}

let requestNumber=0, worker=null;
const pending=new Map();
try {
  worker = new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{ const request=pending.get(data.id); if(!request)return; pending.delete(data.id); clearTimeout(request.timer); data.error?request.reject(new Error(data.error)):request.resolve(data.result); };
  worker.onerror=()=>{ pending.forEach(request=>{clearTimeout(request.timer);request.reject(new Error('航图计算暂时不可用，请重试。'));}); pending.clear(); worker.terminate(); worker=null; };
} catch { worker=null; }
async function calculate(data) {
  if(!worker) { await new Promise(resolve=>setTimeout(resolve,20)); return data.type==='hint'?solve(data.game,{maxStates:100000}):data.type==='daily'?createDailyLevel(data.date):createExpeditionLevel(data.seed,data.difficulty); }
  const id=++requestNumber;
  return new Promise((resolve,reject)=>{ const timer=setTimeout(()=>{pending.delete(id);reject(new Error('星图计算超时，请重新尝试。'));},15000); pending.set(id,{resolve,reject,timer}); worker.postMessage({id,...data}); });
}
async function requestHint() {
  closeModal(); if(busy || game.status!=='playing')return;
  const current=game, token=epoch; busy=true;renderControls();feedback('领航员正在推算下一段航线…');
  try {
    const result=await calculate({type:'hint',game:{...game,history:[]}});
    if(token!==epoch || game!==current)return;
    if(result.path?.length) {
      profile=recordHint(profile); persist(); hintDirection=result.path[0];
      feedback(`${directionLabels[hintDirection]}推进 ${directionArrows[hintDirection]}。当前局面还需 ${result.path.length} 次可完成。`);
      renderUI();
      renderBoard($('board'),game,{idPrefix:'main',preview:attemptMove(game,hintDirection)});
    } else feedback(result.exhausted?'这段航线需要更多推算。试着撤销一步，再观察停靠点。':'从这里无法收齐星核。撤销一步，换一条航线。',true);
  } catch(error) { if(token===epoch)feedback(error.message,true); }
  finally { if(token===epoch){busy=false;renderControls();} }
}
function showHint() {
  if(game.status!=='playing' || busy)return;
  if(profile.currentRun.hints>0){requestHint();return;}
  openModal('hint','领航员的下一步','A LITTLE GUIDANCE',`<p class="modal-description">提示会标出一条安全航线的下一次推进，并告诉你从当前位置还需几步。</p><p class="modal-description">本局使用提示后可获得 <strong>1 星</strong>。通关、解锁与星图碎片照常获得；重新挑战时，仍可争取三星。轨迹预览和撤销始终免费。</p><div class="modal-actions"><button class="secondary-button" data-action="close">我再想一想</button><button class="primary-button" data-action="hint">查看下一步 <span>✧</span></button></div>`);
}

const modal=$('modal');
function openModal(kind,title,eyebrow,content) {
  if(busy && kind !== 'loading') { toast('飞船正在停稳，马上就好。'); return; }
  if(!modal.open)modalReturnFocus=document.activeElement;
  modalKind=kind; $('modal-title').textContent=title; $('modal-eyebrow').textContent=eyebrow; $('modal-content').innerHTML=content; hydrateIcons(modal);
  if(!modal.open)modal.showModal(); document.body.classList.add('modal-open'); modal.scrollTop=0;
  (modal.querySelector('.chapter-tab.selected') || modal.querySelector('.primary-button') || $('modal-close')).focus({preventScroll:true});
}
function closeModal() {
  if(!modal.open)return;
  const oldKind=modalKind;
  if(oldKind==='tutorial') {profile={...profile,tutorialVersion:1};persist();}
  if(oldKind==='loading') {epoch++;busy=false;renderControls();}
  modalKind=null;modal.close();document.body.classList.remove('modal-open');
  if(modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true});
}
$('modal-close').addEventListener('click',closeModal);
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
modal.addEventListener('click',event=>{ if(event.target===modal){const rect=modal.getBoundingClientRect(); if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();} });

function figure(state,id,caption) {
  const dims=boardDimensions(state.level);
  return `<figure class="guide-figure" data-level="${state.levelId}" data-moves="${state.moves}" data-status="${state.status}"><svg role="img" aria-label="${escape(caption)}" viewBox="0 0 ${dims.width} ${dims.height}" xmlns="http://www.w3.org/2000/svg">${boardMarkup(state,{idPrefix:id,showCoordinates:false})}</svg><figcaption>${escape(caption)}</figcaption></figure>`;
}
function showTutorial(step=0) {
  tutorialStep=step;
  const level=LEVELS[1], initial=createGame(level), action=attemptMove(initial,'E').state;
  let won=initial;for(const direction of level.solution)won=attemptMove(won,direction).state;
  const content=[
    {title:'一艘飞船，一片待亮的星海',subtitle:'01 / 认识航图',image:figure(initial,'guide-start','奶白色飞船在左上方，两个钻石星核等待回收。'),copy:'你是这片星海的领航员。驾驶飞船收集所有<strong>钻石星核</strong>，安全停稳，就能点亮这段航线。青色圆环是停泊点，方块是能让你停下的舱壁。'},
    {title:'点一下方向，滑行一整段',subtitle:'02 / 第一次推进',image:`<div class="guide-cards">${figure(initial,'guide-before','推进前 · 0 次')}${figure(action,'guide-action','向右 → · 1 次推进，回收 1 枚')}</div>`,copy:'轻点<strong>右箭头 →</strong>，飞船会一直滑行到右侧舱壁。星核会被沿途收回，<strong>不会让飞船停下</strong>。也可以在棋盘上滑动，或用八个方向按钮推进。'},
    {title:'想好停在哪里，再出发',subtitle:'03 / 一条完整航线',image:figure(won,'guide-goal','向右 → 再向下 ↓ · 2 次推进，2 枚星核全部回收'),copy:'再向下推进，回收最后一枚星核后安全停稳，即可通关。<strong>斜向同样可飞，圆环可以停泊；触碰暗雷 × 会令航程失败，可撤销重试。</strong>别只看星核，还要检查星核之后的航段。随时撤销，不扣星。'},
  ][step];
  openModal('tutorial',content.title,'YOUR FIRST VOYAGE',`<p class="guide-step">${content.subtitle}</p>${content.image}<p class="guide-copy">${content.copy}</p><div class="modal-actions"><button class="secondary-button" data-action="${step?'guide-back':'close'}">${step?'上一步':'跳过教程'}</button><div class="guide-dots" aria-label="第${step+1}步，共3步">${[0,1,2].map(i=>`<i class="${i===step?'active':''}"></i>`).join('')}</div><button class="primary-button" data-action="${step===2?'close':'guide-next'}">${step===2?'出发，去收集星光':'下一步'} <span>→</span></button></div>`);
}
function showMap(chapter=mode==='campaign'?currentChapter().id:Math.max(0,Math.floor(Math.max(0,nextCampaignIndex())/8))) {
  const selected=CHAPTERS[chapter],levels=LEVELS.filter(level=>level.chapter===chapter),stats=getStats(profile);
  openModal('map','在星海里，留下一条航线','THE CELESTIAL ATLAS',`<div class="chapter-tabs" role="group" aria-label="选择章节">${CHAPTERS.map(ch=>`<button class="chapter-tab ${ch.id===chapter?'selected':''}" data-chapter="${ch.id}" aria-pressed="${ch.id===chapter}">${pad(ch.id+1)} ${escape(ch.name)}</button>`).join('')}</div><p class="eyebrow">CHAPTER ${pad(chapter+1)} / ${escape(selected.name)}</p><p class="map-description">${escape(selected.description.replaceAll('能源','星核').replaceAll('反应堆','暗雷'))}</p><div class="level-map">${levels.map(level=>{const unlocked=isUnlocked(profile,level.campaignIndex),record=profile.records[level.id];return `<button class="level-card ${game.levelId===level.id?'current':''}" data-level="${level.id}" ${unlocked?'':'disabled'} aria-label="第${level.number}关 ${escape(level.name)}，${record?record.stars+'星':unlocked?'可挑战':'未解锁'}"><span class="level-card-number">${unlocked?pad(level.number):'<span data-icon="lock"></span>'}</span><span class="level-card-name">${escape(level.name)}</span><span class="level-card-stars">${starsText(record?.stars||0)}</span></button>`;}).join('')}</div><div class="map-footer"><span>通关前一段，即可继续启航</span><span>${stats.campaignCompleted} / 48 航线 · ${stats.campaignStars} / 144 星</span></div>`);
}
function showVictory(first=false) {
  const level=game.level,rating=starsFor(game,profile.currentRun.hints),record=profile.records[level.id];
  const chapterComplete=mode==='campaign' && LEVELS.filter(l=>l.chapter===level.chapter).every(l=>profile.records[l.id]);
  const allComplete=getStats(profile).campaignCompleted===48;
  const note=rating===3?'恰到好处的每一次推进。你找到了最短航线。':rating===2?'星核已全部归航。再次挑战，试着用更少的推进抵达。':'星光已经抵达。再独立挑战一次，也许会发现新的路线。';
  const actionLabel=mode==='campaign'?(level.number===48?'查看完整星图':'下一段航线'):mode==='daily'?'返回星际旅程':'再探索一片星海';
  openModal('victory',allComplete && mode==='campaign'?'四十八段航线，一整片星海':'这一程，星光已归航','VOYAGE COMPLETE',`<div class="victory-art"><div class="large-stars" aria-label="本局${rating}星">${starsText(rating)}</div><p>${escape(level.name)} / 航线已点亮</p></div><div class="victory-stats"><div><strong>${game.moves}</strong><span>本次推进</span></div><div><strong>${level.par}</strong><span>最短航线</span></div><div><strong>${record.bestMoves}</strong><span>个人最佳</span></div></div><p class="victory-note">${note}<br>${first?'✦ 收获一枚星图碎片。':'已保留本关的最高星级。'}</p>${chapterComplete?`<div class="chapter-award">✧ ${escape(currentChapter().name)}星图已完整点亮${allComplete?'。每日航线与自由远航，仍有新的风景。':'，新的星域正在回应你。'}</div>`:''}<div class="modal-actions"><button class="secondary-button" data-action="retry">再飞一次</button><button class="primary-button" data-action="next">${actionLabel} <span>→</span></button></div>`);
}
function showExpedition() {
  openModal('expedition','下一程，由你命名','FREE EXPLORATION',`<p class="modal-description">选一种飞行节奏，探索一张新的航图。每张图都经过可通关验证，也可以用航图编号重返同一片星海。</p><div class="expedition-options" role="group" aria-label="远航难度">${[['轻航','短线转向 · 4–6步'],['巡游','混合路线 · 7–10步'],['深潜','复合规划 · 12–17步']].map(([name,desc],i)=>`<button class="expedition-option ${i===expeditionDifficulty?'selected':''}" data-difficulty="${i}" aria-pressed="${i===expeditionDifficulty}">${name}<small>${desc}</small></button>`).join('')}</div><label class="seed-input">航图编号<input id="seed-input" maxlength="64" placeholder="留空，发现未知航图" autocomplete="off"></label><p class="modal-description" style="font-size:10px">同一编号与难度会回到同一张图。星图可能重逢，每一段路线都值得重新发现。</p><div class="modal-actions"><button class="secondary-button" data-action="close">暂不启航</button><button class="primary-button" data-action="generate">生成航图 <span>→</span></button></div>`);
}
async function generateLevel(type,seed,difficulty) {
  closeModal(); const token=++epoch;busy=true;renderControls();
  openModal('loading','正在寻找一条可抵达的航线','CHARTING THE STARS','<p class="loading-message">✧　校准停泊点，验证回收路线…</p><p class="modal-description">星图即将展开。每条航线都会先经过完整求解。</p>');
  try {
    const level=await calculate({type,seed,difficulty,date:localDate()});
    if(token!==epoch)return;
    modalKind='generated'; closeModal();startLevel(level,type);
    if(level.generation?.fallback)toast('这次发现了一张精选航图，已有完整可通关航线。');
  } catch(error) {if(token===epoch){modalKind='error';closeModal();toast(error.message);}}
  finally {if(token===epoch){busy=false;renderControls();}}
}
function resumeSavedMode(target) {
  if(target === 'daily' && profile.suspendedRuns?.daily?.date !== localDate()) return false;
  const resumed = resumeMode(profile,target);
  if(resumed === profile) return false;
  const restored = restoreRun(resumed);
  if(!restored) return false;
  closeModal(); invalidate(); profile=resumed; game=restored; mode=target;
  persist(); renderUI(); feedback('已接回这段航程，当前位置与提示记录都已保留。');
  if(game.status==='won')showVictory();
  return true;
}
function returnCampaign() {
  if(mode==='campaign'){showMap();return;}
  if(resumeSavedMode('campaign'))return;
  const level=LEVELS.find(l=>l.id===lastCampaignId) || LEVELS[Math.max(0,nextCampaignIndex())]; startLevel(level,'campaign');
}
function constellationMarkup(chapter) {
  const count=LEVELS.filter(l=>l.chapter===chapter && profile.records[l.id]).length;
  const points=[[20,48],[40,23],[65,34],[82,12],[113,31],[98,66],[64,76],[38,63]];
  const rotate=chapter*17;
  return `<svg viewBox="0 0 135 90" role="img" aria-label="${escape(CHAPTERS[chapter].name)}，已点亮${count}个节点"><g transform="rotate(${rotate} 67 45)"><circle cx="67" cy="45" r="38" fill="none" stroke="#85b3c017"/><polyline points="${points.map(p=>p.join(',')).join(' ')}" stroke="#7595a338" fill="none"/>${points.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i<count?3:1.7}" fill="${i<count?'#c7e4ca':'#466271'}"/>${i<count?`<circle cx="${x}" cy="${y}" r="7" fill="#c7e4ca0c"/>`:''}`).join('')}</g></svg>`;
}
function showCollection() {
  const stats=getStats(profile);
  openModal('collection','你收集的每一束光','A SKY OF YOUR OWN',`<div class="collection-summary"><strong>${stats.campaignStars}<small style="font-size:15px;color:#719599"> / 144</small></strong><span>旅程星光<br>${stats.campaignCompleted} 段航线已点亮 · ${stats.mastered} 张三星航图</span></div><div class="collection-grid">${CHAPTERS.map(ch=>`<article class="constellation-card">${constellationMarkup(ch.id)}<h3>${escape(ch.name)}</h3><p>${LEVELS.filter(l=>l.chapter===ch.id && profile.records[l.id]).length} / 8 星图碎片</p></article>`).join('')}</div><p class="modal-description" style="font-size:11px">每日航线 ${stats.dailyCompleted} 张 · 自由远航 ${stats.expeditionCompleted} 张<br>每关首次通关点亮一个节点。独立通关获两星，以最短步数独立通关获三星；撤销不扣星，提示通关获一星。重复挑战保留最高星级。</p><div class="modal-actions"><button class="secondary-button" data-action="map">查看航线图</button><button class="primary-button" data-action="close">继续收集星光 <span>→</span></button></div>`);
}
function showAbout() {
  openModal('about','每一条航线，都有迹可循','RULES & ORIGINS',`<ul class="rules-list"><li>从飞船位置向八个方向推进，一直滑行到舱壁前、停泊点或暗雷。边界也是墙。起点离开后仍是停泊点。</li><li>沿途回收全部星核，并在安全停稳后通关。星核不会刹车；即便同次推进已收齐星核，继续撞上暗雷仍会失败。</li><li>斜向只检查下一格，可以穿过两侧正交舱壁的夹角。圆环会立即停止本次滑行。</li><li>预览显示当前方向的完整航段，不计提示。撤销次数不限，死亡后也可撤销。三星要求不使用提示且达到已证明的最短推进次数。</li></ul><div class="key-guide"><strong>键盘导航</strong><br><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>W</kbd><kbd>S</kbd><kbd>A</kbd><kbd>D</kbd> 四向推进<br><kbd>Q</kbd> ↖ <kbd>E</kbd> ↗ <kbd>Z</kbd> ↙ <kbd>C</kbd> ↘<br><kbd>U</kbd> 撤销 · <kbd>R</kbd> 重开 · <kbd>H</kbd> 提示 · <kbd>?</kbd> 指南<br>手机：在棋盘上滑动，或轻点方向按钮。按住方向按钮可预览，松开推进。</div><p class="modal-description">《星际漂流》从《星滞回收局》独立扩展，玩法源自 Simon Tatham’s Portable Puzzle Collection 的 Inertia。六章关卡、场景、交互与声音为本作设计。星海背景通过 imagegen 制作，棋盘由真实规则绘制。</p><div class="source-links"><a href="https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/inertia.html" target="_blank" rel="noreferrer">Inertia 原始规则 ↗</a>　<a href="./THIRD_PARTY_NOTICES.md" target="_blank">来源与 MIT 致谢 ↗</a></div><div class="modal-actions"><a class="secondary-button" href="${location.pathname.includes('/standalone/star-drift/') ? '../../' : 'https://ten-realms-arcade.vercel.app/'}">返回十境谜游馆</a><button class="primary-button" data-action="guide">重看图片教程</button></div>`);
}

$('modal-content').addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target || target.disabled)return;
  if(target.dataset.level){const level=LEVELS.find(l=>l.id===target.dataset.level);if(level && isUnlocked(profile,level.campaignIndex))startLevel(level);return;}
  if(target.dataset.chapter!==undefined){showMap(Number(target.dataset.chapter));return;}
  if(target.dataset.difficulty!==undefined){expeditionDifficulty=Number(target.dataset.difficulty);document.querySelectorAll('[data-difficulty]').forEach(b=>{b.classList.toggle('selected',b===target);b.setAttribute('aria-pressed',String(b===target));});return;}
  switch(target.dataset.action){
    case 'close':closeModal();break;
    case 'guide-next':showTutorial(tutorialStep+1);break;
    case 'guide-back':showTutorial(tutorialStep-1);break;
    case 'guide':showTutorial();break;
    case 'hint':requestHint();break;
    case 'retry':restartLevel();break;
    case 'map':showMap();break;
    case 'generate':generateLevel('expedition',$('seed-input').value.trim() || `SD-${Date.now().toString(36)}-${Math.floor(Math.random()*10000)}`,expeditionDifficulty);break;
    case 'next':if(mode==='campaign'){game.level.number===48?showCollection():startLevel(LEVELS[game.level.number]);}else if(mode==='daily'){returnCampaign();}else{generateLevel('expedition',`SD-${Date.now().toString(36)}`,game.level.difficulty);}break;
  }
});
$('journey-nodes').addEventListener('click',event=>{const b=event.target.closest('[data-level]');if(!b || b.disabled)return;const level=LEVELS.find(l=>l.id===b.dataset.level);if(level && isUnlocked(profile,level.campaignIndex))startLevel(level);});
$('direction-pad').addEventListener('click',event=>{const button=event.target.closest('[data-direction]');if(button)move(button.dataset.direction);});
document.querySelectorAll('[data-direction]').forEach(button=>{
  button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')preview(button.dataset.direction);});
  button.addEventListener('pointerleave',clearPreview);
  button.addEventListener('pointerdown',()=>preview(button.dataset.direction));
  button.addEventListener('pointercancel',clearPreview);
  button.addEventListener('focus',()=>preview(button.dataset.direction));
  button.addEventListener('blur',clearPreview);
});
let touchStart=null;
$('board').addEventListener('pointerdown',event=>{if(busy || modal.open || touchStart || event.isPrimary===false || event.button!==0)return;touchStart={x:event.clientX,y:event.clientY,pointerId:event.pointerId};$('board').setPointerCapture(event.pointerId);});
$('board').addEventListener('pointerup',event=>{if(!touchStart || event.pointerId!==touchStart.pointerId)return;const dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;touchStart=null;if(Math.hypot(dx,dy)<18){toast('在棋盘上滑动，或轻点方向按钮推进。');return;}const index=(Math.round(Math.atan2(dx,-dy)/(Math.PI/4))+8)%8;move(DIRECTIONS[index]);});
$('board').addEventListener('pointercancel',event=>{if(event.pointerId===touchStart?.pointerId)touchStart=null;});
const keyDirections={ArrowUp:'N',ArrowRight:'E',ArrowDown:'S',ArrowLeft:'W',w:'N',e:'NE',d:'E',c:'SE',s:'S',z:'SW',a:'W',q:'NW',8:'N',9:'NE',6:'E',3:'SE',2:'S',1:'SW',4:'W',7:'NW'};
document.addEventListener('keydown',event=>{
  if(event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || modal.open || event.repeat)return;
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if(keyDirections[key]){event.preventDefault();move(keyDirections[key]);}
  else if(key==='u'){event.preventDefault();undoMove();}else if(key==='r'){event.preventDefault();restartLevel();}else if(key==='h'){event.preventDefault();showHint();}else if(key==='?'){event.preventDefault();showTutorial();}
});
$('undo-button').addEventListener('click',undoMove);
$('restart-button').addEventListener('click',restartLevel);
$('hint-button').addEventListener('click',showHint);
$('tutorial-button').addEventListener('click',()=>showTutorial());
$('map-button').addEventListener('click',()=>showMap());
$('all-levels-button').addEventListener('click',()=>showMap());
$('campaign-button').addEventListener('click',returnCampaign);
$('daily-button').addEventListener('click',()=>{if(mode==='daily' && game.level.date===localDate()){game.status==='won'?showVictory():toast('今天的航线已经在这里，继续回收星核吧。');}else if(!resumeSavedMode('daily'))generateLevel('daily');});
$('expedition-button').addEventListener('click',()=>{if(mode==='expedition' || !resumeSavedMode('expedition'))showExpedition();});
$('collection-button').addEventListener('click',showCollection);
$('about-button').addEventListener('click',showAbout);
$('sound-button').addEventListener('click',()=>{profile={...profile,settings:{...profile.settings,sound:!profile.settings.sound}};persist();renderSound();if(profile.settings.sound)sound('collect');});
window.addEventListener('pagehide',persist);
document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();audioContext?.suspend().catch(()=>{});}});
renderUI();persist();
if(game.status==='lost')feedback('飞船停在了暗雷上。撤销一步，可以继续这段航程。',true);
else if(game.moves)feedback('航程已恢复。沿着上次的星光，继续出发。');
else feedback(game.level.number===1?'向右推进，回收你的第一枚星核。':'先看停靠点，再规划你的航线。');
if(profile.tutorialVersion<1)showTutorial();else if(game.status==='won')showVictory();
