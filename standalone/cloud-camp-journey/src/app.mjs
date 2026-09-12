import {LEVELS,REPLAY_LEVELS} from './levels.mjs';
import {createBoard,applyAction,analyze,isSolved,getHint} from './engine.mjs';
import {dailyLevel,seedJourney} from './generator.mjs';
import {createStorage} from './storage.mjs';
import {symbol} from './art.mjs';

const $=s=>document.querySelector(s), app=$('#app'), modalRoot=$('#modal-root');
const TUTORIAL='paper-camp-1';
const chapterNames=['晨露草甸','杉林风声','溪谷野餐','日落山坡','星夜营地','云海远行'];
const chapterNotes=['看懂数字，安放第一顶帐篷','走进林间，学会一树一帐','留一点空地，风才会经过','从行列之间，找到唯一落点','让每棵树，都有自己的伙伴','把整片云野，连成一段旅途'];
const chapterFocus=['行列配额','树帐相邻','邻接排除','配额联动','一一匹配','全局推理'];
let view='home', activeLevel=null, run=null, selected=0, activeChapter=1, hint=null, feedback='', modal=null, restoreFocus=null, journeySeed='云野的一天', journeyIndex=0;
let previouslyUnsaved=false;
const volatileLevels={};
function dayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function resolveLevel(id,meta){
  if(meta&&meta.mode==='daily'){const d=dailyLevel(meta.day);return d.id===id?d:null;}
  if(meta&&meta.mode==='seed')return seedJourney(meta.seed,10).find(x=>x.id===id)||null;
  const l=LEVELS.find(x=>x.id===id);if(l)return l;
  return null;
}
const store=createStorage({levels:LEVELS,resolveLevel,createBoard,applyAction,isSolved,onComplete:payload=>{if(typeof window.cloudCampHost==='function')return window.cloudCampHost(payload);return false;}});
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function button(text,action,cls,extra){return '<button type="button" class="'+(cls||'')+'" data-action="'+action+'" '+(extra||'')+'>'+text+'</button>';}
function header(back,title,small){return '<header class="topbar">'+button(back?'‹':'<span class="brand-mark">△</span>',back?'home':'home','icon-button',back?'aria-label="返回营地首页"':'aria-label="云野露营首页"')+'<div class="brand"><strong>'+title+'</strong><span>'+small+'</span></div>'+button('?','tutorial','icon-button','aria-label="重看图片教程"')+'</header>';}
function stats(){return store.profile();}
function refreshSaveNotice(){
  const status=store.getStatus(),old=$('.save-status');if(old)old.parentNode.removeChild(old);
  if(!status.persistenceAvailable||previouslyUnsaved){const el=document.createElement('p');el.className='save-status';el.setAttribute('role','status');el.textContent=status.persistenceAvailable?'进度已重新保存，可以安心离开。':'当前未能保存。你可以继续玩；请保留此页面，恢复后操作会重试保存。';const bar=$('.topbar');if(bar)bar.parentNode.insertBefore(el,bar.nextSibling);}
  previouslyUnsaved=!status.persistenceAvailable;
}
function render(){
  document.body.classList.toggle('in-game',view==='game');
  if(view==='game')renderGame();else if(view==='map')renderMap();else if(view==='collection')renderCollection();else renderHome();
  refreshSaveNotice();
}
function renderHome(){
  const p=stats(), saved=store.getRun(), next=LEVELS.find(l=>!p.completedLevelIds.includes(l.id))||LEVELS[0];
  const canResume=saved&&(!saved.completed||(saved.mode==='seed'&&seedJourney(saved.seed,10).findIndex(l=>l.id===saved.levelId)<9));
  app.innerHTML='<div class="shell home-shell">'+header(false,'云野露营','CLOUD CAMP · 山野手账')+'<section class="hero"><div class="hero-copy"><span class="eyebrow">慢一点，住进风景里</span><h1>把日子安放<br>在山野。</h1><p>一棵树，一顶帐篷。<br>在刚刚好的留白里，搭起自己的营地。</p></div><img class="hero-scene" src="./assets/scene.svg" alt="层叠纸景山峦间的松树与橙色帐篷"><span class="hero-stamp">野外来信<br><b>VOL. 01</b></span></section><section class="home-content"><div class="journey-heading"><div><span class="eyebrow">YOUR LITTLE JOURNEY</span><h2>下一站，去露营</h2></div><span class="progress-pill">'+p.completedLevelIds.length+' / 60 营地</span></div>'+button('<span><b>'+(canResume?'继续这片营地':'出发 · '+next.title)+'</b><small>'+(canResume?'已为你收好帐篷与标记':'六章山野手账 · 随时停下，随时回来')+'</small></span><span class="arrow">↗</span>',canResume?'resume':'next','primary journey-start')+'<div class="mode-grid">'+button('<span class="mode-icon">☀</span><b>每日营地</b><small>'+dayKey()+' · 今日一题</small>','daily','mode-card')+button('<span class="mode-icon">⌁</span><b>种子旅途</b><small>一句口令，同一条十站路线</small>','seed','mode-card')+'</div><div class="notebook-links">'+button('<span>⌘ 章节地图</span><b>六站风景 →</b>','map','text-link')+button('<span>▧ 风景收藏</span><b>'+p.collections.length+' / 6 张 →</b>','collection','text-link')+'</div><footer>没有倒计时。风景会一直等你。'+button('玩法与出处','about','footer-link')+'</footer></section></div>';
}
function renderMap(){
  const p=stats(),n=activeChapter;
  app.innerHTML='<div class="shell map-shell">'+header(true,'山野路线','六章 · 六十片可以慢慢读的风景')+'<div class="chapter-tabs" aria-label="选择章节">'+chapterNames.map((x,i)=>button('<small>0'+(i+1)+'</small><span>'+x+'</span>','chapter:'+ (i+1),'chapter-tab '+(n===i+1?'active':''),'aria-pressed="'+(n===i+1)+'"')).join('')+'</div><section class="chapter-card"><img src="./assets/chapter-'+n+'.svg" alt="'+chapterNames[n-1]+'纸景"><div><span class="eyebrow">CHAPTER 0'+n+' · '+chapterFocus[n-1]+'</span><h1>'+chapterNames[n-1]+'</h1><p>'+chapterNotes[n-1]+'</p></div></section><div class="map-caption"><h2>挑一片营地坐坐</h2><span>可自由选关</span></div><section class="level-grid">'+LEVELS.filter(l=>l.chapter===n).map(l=>{const done=p.completedLevelIds.includes(l.id);return button('<span class="level-num">'+String(l.index).padStart(2,'0')+'</span><span><b>'+l.title+'</b><small>'+l.size+' × '+l.size+' · '+l.trees.length+' 顶帐篷</small></span><i>'+(done?'✓':'↗')+'</i>','level:'+l.id,'level-card '+(done?'done':''),'aria-label="第'+l.index+'关 '+l.title+(done?' 已完成':'')+'"');}).join('')+'</section><p class="map-note">每章首次完成 10 关，收下一张风景。提示不扣奖励。</p></div>';
}
function renderCollection(){
  const p=stats();
  app.innerHTML='<div class="shell collection-shell">'+header(true,'风景收藏','把走过的路，折进手账里')+'<div class="collection-title"><span class="eyebrow">POSTCARDS FROM THE WILD</span><h1>风，替你寄来的明信片</h1><p>每章十片营地全部完成，收藏一张风景。<br>无需连续签到，来过的地方不会消失。</p></div><div class="postcards">'+chapterNames.map((x,i)=>{const owned=p.collections.includes(i+1),count=LEVELS.filter(l=>l.chapter===i+1&&p.completedLevelIds.includes(l.id)).length;return '<article class="postcard '+(owned?'owned':'')+'"><img src="./assets/chapter-'+(i+1)+'.svg" alt="'+x+'风景预览"><div><span class="eyebrow">NO. 0'+(i+1)+(owned?' · 已收藏':' · 风景预览')+'</span><h2>'+x+'</h2><p>'+(owned?'这片风景，已经住进你的手账。':count+' / 10 营地 · 完成本章即可收藏')+'</p>'+button(owned?'再走一遍 →':'去这一章 →','chapter:'+ (i+1),'small-link')+'</div></article>';}).join('')+'</div></div>';
}
function select(index){selected=Math.max(0,Math.min(activeLevel.size*activeLevel.size-1,index));hint=null;feedback='';renderGame();}
function statusText(a){
  if(feedback)return feedback;
  if(hint)return hint.text;
  if(a.errors.length)return a.errors[0];
  if(activeLevel.trees.includes(selected))return '这是一棵树，不能放帐篷。请选它上、下、左、右的草地。';
  return '先选格子，再放帐／标空。帐篷之间连对角也不能碰。';
}
function renderGame(){
  if(!run||!activeLevel){view='home';renderHome();return;}
  const l=activeLevel,n=l.size,a=analyze(l,run.board),isTree=l.trees.includes(selected),row=Math.floor(selected/n)+1,col=selected%n+1;
  let board='<span class="clue-corner" aria-hidden="true">↓ →</span>';
  for(let c=0;c<n;c++){const count=a.cols[c].count;board+='<span class="clue '+(count===l.cols[c]?'met':count>l.cols[c]?'over':'')+'" aria-label="第'+(c+1)+'列 '+count+'顶，目标'+l.cols[c]+'">'+l.cols[c]+'<i>'+(count===l.cols[c]?'✓':'')+'</i></span>';}
  for(let r=0;r<n;r++){
    const count=a.rows[r].count;board+='<span class="clue '+(count===l.rows[r]?'met':count>l.rows[r]?'over':'')+'" aria-label="第'+(r+1)+'行 '+count+'顶，目标'+l.rows[r]+'">'+l.rows[r]+'<i>'+(count===l.rows[r]?'✓':'')+'</i></span>';
    for(let c=0;c<n;c++){
      const i=r*n+c,tree=l.trees.includes(i),kind=tree?'tree':run.board[i]===1?'tent':run.board[i]===2?'grass':'unknown';
      board+='<button type="button" data-cell="'+i+'" class="cell '+kind+' '+((r+c)%2?'shade':'')+' '+(selected===i?'selected':'')+' '+(a.conflictCells.includes(i)?'conflict':'')+' '+(hint&&hint.index===i?'hinted':'')+'" aria-label="第'+(r+1)+'行第'+(c+1)+'列 '+(tree?'树':kind==='tent'?'帐篷':kind==='grass'?'已标空':'未填写')+'" aria-pressed="'+(selected===i)+'">'+(kind==='unknown'?'<span class="grass-speck">′</span>':symbol(kind))+(selected===i?'<span class="selection-corner"></span>':'')+'</button>';
    }
  }
  app.innerHTML='<div class="shell play-shell">'+header(true,'云野露营',run.mode==='story'?'CHAPTER 0'+l.chapter+' · '+chapterNames[l.chapter-1]:run.mode==='daily'?'DAILY CAMP · '+run.day:'SEED JOURNEY · 第 '+(journeyIndex+1)+' 站')+'<section class="play-heading"><div><span class="eyebrow">'+(run.mode==='story'?'营地 '+String(l.index).padStart(2,'0')+' / 60':run.mode==='daily'?'今日营地':'口令 · '+escape(run.seed))+'</span><h1>'+escape(l.title)+'</h1></div><div class="tent-total">'+symbol('tent')+'<span><b>'+a.tentCount+'</b> / '+l.trees.length+'</span></div></section><div class="game-layout"><section class="board-area"><div class="board-topnote"><span>边上数字 = 这一行 / 列的帐篷数</span><span>'+n+' × '+n+'</span></div><div class="board-paper"><div class="board" style="grid-template-columns:26px repeat('+n+',1fr)" role="group" aria-label="'+n+'乘'+n+'营地棋盘">'+board+'</div><div class="board-paper-edge"></div></div><p class="board-legend"><span>'+symbol('tree')+'一树一帐</span><span>↔ 只看上下左右</span><span>× 可选标空</span></p></section><section class="camp-tools"><div class="selection-bar"><span>已选 <b>'+row+' 行 '+col+' 列</b></span><div class="dpad" aria-label="精确选择格子">'+button('←','move:left','direction','aria-label="向左选格"')+button('↑','move:up','direction','aria-label="向上选格"')+button('↓','move:down','direction','aria-label="向下选格"')+button('→','move:right','direction','aria-label="向右选格"')+'</div></div><div class="placement-tools">'+button(symbol('tent')+'<span>放帐</span>','place:1','place tent-tool',isTree?'disabled':'')+button('<span class="cross-symbol">×</span><span>标空</span>','place:2','place',isTree?'disabled':'')+button('<span class="erase-symbol">◇</span><span>擦除</span>','place:0','place',isTree?'disabled':'')+'</div><div class="help-note '+(a.errors.length?'warning':'')+'" aria-live="polite"><span class="note-icon">'+(hint?'✧':a.errors.length?'!':'⌁')+'</span><p>'+escape(statusText(a))+'</p></div><div class="secondary-tools">'+button('↶ 撤销','undo','secondary',!run.canUndo?'disabled':'')+button('↻ 重开','restart','secondary')+button('✧ 提示','hint','secondary hint-button')+'</div><p class="gentle-note">'+(!store.getStatus().persistenceAvailable?'当前未保存 · 请暂时保留此页面':run.hints?'已看 '+run.hints+' 次提示 · 不扣奖励':'不计时 · 提示不扣奖励 · 自动收好进度')+'</p></section></div></div>';
}
function begin(level,meta){volatileLevels[level.id]=level;activeLevel=level;run=store.begin(level.id,meta);selected=level.trees.includes(0)?level.trees.indexOf(0)+1:0;selected=run.board.findIndex((x,i)=>!level.trees.includes(i));hint=null;feedback='';view='game';closeModal();render();}
function resume(){run=store.resume();if(!run){startNext();return;}activeLevel=resolveLevel(run.levelId,run);if(run.mode==='seed'){journeySeed=run.seed;journeyIndex=seedJourney(run.seed,10).findIndex(x=>x.id===run.levelId);}selected=run.board.findIndex((x,i)=>!activeLevel.trees.includes(i));view='game';render();if(run.completed)showWin();}
function startNext(){const p=stats();begin(LEVELS.find(l=>!p.completedLevelIds.includes(l.id))||LEVELS[0],{mode:'story'});}
function place(value){
  if(run.completed)return;
  const result=store.act(selected,value);feedback=result.accepted?'':result.reason==='fixed-or-outside'?'树是固定的，请选择草地。':'这格没有改变。';if(result.run)run=result.run;hint=null;renderGame();if(isSolved(activeLevel,run.board))showWin();
}
function showWin(){
  const completion=store.complete();run=store.getRun();const p=stats(),savedNow=store.getStatus().persistenceAvailable;
  openModal('win','<div class="win-illustration"><img src="./assets/chapter-'+(activeLevel.chapter||1)+'.svg" alt="这片营地的纸景风光"><span class="postmark">CAMP<br>COMPLETE ✓</span></div><span class="eyebrow">A GOOD PLACE TO STAY</span><h2>帐篷搭好了，歇一会儿。</h2><p>每棵树都有伙伴，行列刚刚好，<br>帐篷之间也留好了呼吸的空地。</p><div class="win-facts"><span><b>'+activeLevel.trees.length+'</b> 顶帐篷</span><span><b>'+run.hints+'</b> 次提示</span><span><b>'+p.completedLevelIds.length+'</b> 片主线营地</span></div><p class="reward-note">'+(!savedNow?'本局已完成，但当前未能保存。请保留此页，恢复后继续操作会重试保存。':completion.alreadyCompleted?'这片风景已收进手账。再来一次也很好。':run.mode==='daily'?'今日营地已记录，明天也有新的风景。':run.mode==='seed'?'这一站已走过，继续沿口令去下一站。':'已记入山野手账。每章走完十站，收藏整章风景。')+'</p><div class="modal-actions">'+button('留在这片风景','home','secondary')+button('下一站 →','advance','primary')+'</div>');
}
function openModal(kind,html){
  if(!modal)restoreFocus=document.activeElement;
  modal=kind;modalRoot.innerHTML='<div class="modal-backdrop"><section class="modal '+kind+'-modal" role="dialog" aria-modal="true" aria-label="'+(kind==='tutorial'?'露营图片教程':kind==='win'?'营地完成':'云野露营对话框')+'" tabindex="-1">'+html+'</section></div>';
  document.body.classList.add('modal-open');const box=$('.modal');box.scrollTop=0;box.focus();
}
function closeModal(){if(!modal)return;modal=null;modalRoot.innerHTML='';document.body.classList.remove('modal-open');if(restoreFocus&&document.contains(restoreFocus))restoreFocus.focus();}
let tutorialStep=0;
function tutorial(step){
  tutorialStep=step;const titles=['先读一片营地','选好一格，再放帐篷','让每棵树都有伙伴'];
  const texts=['树是固定的。边上的数字告诉你，这一行、这一列各要几顶帐篷。数字 0 的整行可以标空。','点选树旁的草地，再点「放帐」。帐篷只和上下左右的树配对；其他帐篷连对角也不能碰。','每棵树与一顶帐篷一一配对，所有行列数量相符，且帐篷互不相邻，就能完成。空地不必全部标 ×。'];
  openModal('tutorial','<div class="modal-top"><span class="eyebrow">营地入门 · '+(step+1)+' / 3</span>'+button('跳过','tutorial:skip','skip')+'</div><img class="tutorial-image" src="./assets/tutorial-'+(step+1)+'.svg" alt="'+['真实首关初始棋盘，含固定树和全部行列配额','同一首关执行一次合法放帐操作，橙框标示落点','同一首关真实通关状态，帐篷满足全部规则'][step]+'"><div class="tutorial-body"><h2>'+titles[step]+'</h2><p>'+texts[step]+'</p></div><div class="tutorial-dots">'+[0,1,2].map(i=>'<i class="'+(i===step?'active':'')+'"></i>').join('')+'</div><div class="modal-actions">'+button(step?'上一张':'以后可随时重看',step?'tutorial:'+(step-1):'tutorial:skip','secondary')+button(step===2?'去搭帐篷 →':'下一张 →',step===2?'tutorial:done':'tutorial:'+(step+1),'primary')+'</div>');
}
function seedModal(){openModal('seed','<span class="eyebrow">A JOURNEY IN A WORD</span><h2>给旅途起个名字</h2><p>同一句口令，会得到相同的十站路线。<br>从 '+REPLAY_LEVELS.length+' 片额外营地里挑选，不用网络。</p><label class="seed-label" for="seed-input">旅途口令（最多 24 字）</label><input id="seed-input" maxlength="24" value="'+escape(journeySeed)+'" placeholder="例如：和风一起出发"><div class="modal-actions">'+button('再想想','close','secondary')+button('开始十站旅途 →','seed:start','primary')+'</div>');}
function onAction(action){
  if(action==='home'){closeModal();view='home';hint=null;feedback='';render();}
  else if(action==='map'){view='map';closeModal();render();}
  else if(action==='collection'){view='collection';render();}
  else if(action==='next')startNext();else if(action==='resume')resume();
  else if(action.indexOf('chapter:')===0){activeChapter=Number(action.split(':')[1]);view='map';render();}
  else if(action.indexOf('level:')===0)begin(LEVELS.find(l=>l.id===action.slice(6)),{mode:'story'});
  else if(action==='daily'){const day=dayKey();begin(dailyLevel(day),{mode:'daily',day});}
  else if(action==='seed')seedModal();
  else if(action==='seed:start'){journeySeed=$('#seed-input').value.trim()||'云野的一天';journeyIndex=0;begin(seedJourney(journeySeed,10)[0],{mode:'seed',seed:journeySeed});}
  else if(action==='tutorial'){tutorial(0);}
  else if(action==='tutorial:skip'||action==='tutorial:done'){store.markTutorialSeen(TUTORIAL);closeModal();}
  else if(action.indexOf('tutorial:')===0)tutorial(Number(action.split(':')[1]));
  else if(action==='close')closeModal();
  else if(action.indexOf('place:')===0)place(Number(action.split(':')[1]));
  else if(action.indexOf('move:')===0){const n=activeLevel.size,d=action.split(':')[1];if(d==='left'&&selected%n>0)select(selected-1);if(d==='right'&&selected%n<n-1)select(selected+1);if(d==='up'&&selected>=n)select(selected-n);if(d==='down'&&selected<n*(n-1))select(selected+n);}
  else if(action==='undo'){run=store.undo();hint=null;feedback='已退回上一次记录。';render();}
  else if(action==='restart')openModal('restart','<span class="eyebrow">FRESH AIR, FRESH START</span><h2>重新整理这片营地？</h2><p>本局的帐篷与标记会收起。<br>已收藏的风景和章节进度都会保留。</p><div class="modal-actions">'+button('继续这一局','close','secondary')+button('重新搭帐篷','restart:yes','primary')+'</div>');
  else if(action==='restart:yes'){run=store.restart();closeModal();hint=null;feedback='';render();}
  else if(action==='hint'){const h=getHint(activeLevel,run.board);run=store.hint();hint=h;feedback=h?'':'这片营地已经完成了。';if(h&&Number.isInteger(h.index))selected=h.index;render();}
  else if(action==='advance'){
    closeModal();if(run.mode==='story'){const next=LEVELS.find(l=>l.index===activeLevel.index+1);if(next)begin(next,{mode:'story'});else{view='collection';render();}}
    else if(run.mode==='seed'&&journeyIndex<9){journeyIndex++;begin(seedJourney(run.seed,10)[journeyIndex],{mode:'seed',seed:run.seed});}
    else{view='home';render();}
  }
  else if(action==='about')openModal('about','<span class="eyebrow">ABOUT THIS CAMPSITE</span><h2>留白，也是一种答案</h2><p>云野露营是一款 Tents 逻辑谜题。60 个主线关卡、六章纸景手账、每日营地与十站种子旅途。所有题面均经过独立搜索验证，帐篷位置唯一。</p><p>玩法参考 Simon Tatham’s Portable Puzzle Collection（Tents）。本作规则引擎、关卡、纸景、教程与界面由本项目实现。来源项目：Ten Realms Arcade contributors，MIT License。</p><p>快捷键：方向键选格，T / 空格放帐，G 标空，X 擦除，U 撤销，H 提示。标空是笔记，不影响胜利。</p><p>进度保存在此浏览器本地。提示不扣收藏奖励，没有倒计时或连续签到惩罚。</p>'+button('回到山野','close','primary'));
}
document.addEventListener('click',e=>{const cell=e.target.closest('[data-cell]');if(cell&&!modal){select(Number(cell.dataset.cell));refreshSaveNotice();return;}const b=e.target.closest('[data-action]');if(b&&!b.disabled){onAction(b.dataset.action);refreshSaveNotice();}});
document.addEventListener('keydown',e=>{
  if(modal){if(e.key==='Escape'){if(modal==='tutorial')store.markTutorialSeen(TUTORIAL);closeModal();e.preventDefault();}if(e.key==='Tab'){const focus=Array.from($('.modal').querySelectorAll('button:not([disabled]),input,[tabindex="0"]'));const first=focus[0],last=focus[focus.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('.modal'))){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}return;}
  if(view!=='game')return;
  const keys={ArrowLeft:'move:left',ArrowUp:'move:up',ArrowRight:'move:right',ArrowDown:'move:down',t:'place:1',g:'place:2',x:'place:0',u:'undo',h:'hint'};const a=keys[e.key]||(e.key===' '&&!e.target.closest('button')?'place:1':null);if(a){e.preventDefault();onAction(a);refreshSaveNotice();}
});
function syncHeight(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');}
window.addEventListener('resize',syncHeight);syncHeight();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)store.flushOutbox().catch(()=>{});});
store.flushOutbox().catch(()=>{});
const saved=store.resume();
if(saved&&saved.completed)store.complete();
if(!store.tutorialSeen(TUTORIAL)){if(saved)resume();else begin(LEVELS[0],{mode:'story'});tutorial(0);}else if(saved&&!saved.completed)resume();else render();
const storageStatus=store.getStatus();if(!storageStatus.persistenceAvailable||storageStatus.recoveryMessage){const notice=document.createElement('div');notice.className='storage-notice';notice.setAttribute('role','status');notice.textContent=storageStatus.recoveryMessage||'当前环境无法保存进度，本次仍可正常游玩。';document.body.appendChild(notice);setTimeout(()=>{if(notice.parentNode)notice.parentNode.removeChild(notice);},6500);}
