(function () {
  'use strict';
  var E=Dye.Engine,L=Dye.Levels,R=Dye.Render,S=Dye.Storage;
  var app=document.getElementById('app'), modal=document.getElementById('modal-root');
  var storage;try{storage=window.localStorage;}catch(error){storage=null;}
  var store=S.create(storage,L.get),state=store.loadSession(),view='home',hint=null,lastFill=null;
  var notice='',lastSettlement=null,modalKind='',tutorialIndex=0,previousFocus=null,collectionChapter=1;
  var DAY=localDay(),tutorialTitles=['从一角，染起四季','换一色，让染意流动','一匹同色，便是合幅'];
  var tutorialTexts=['白色缝线围住左上角相连的布面。相同颜色、上下左右相接的布格，属于同一片染区；每色还有自己的纹样。','点底部染碟，整片染区一起换色，并接入相邻的同色布格。图中从初始布面换一次色，记录为第 1 步。','继续合法换色，直到整匹布都是同一色，并且步数不超过预算。参考策略只是已验证的一条路线，你也可以比它更省。'];
  function esc(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function localDay(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function current(){return state?L.get(state.levelId):null;}
  function progress(){return store.progress();}
  function chapterFor(level){return L.chapters.filter(function(c){return c.id===level.chapter;})[0]||L.chapters[0];}
  function modeFor(level){return level.id.indexOf('daily:')===0?'daily':level.id.indexOf('workshop:')===0?'workshop':'campaign';}
  function descriptor(level){return {mode:modeFor(level)};}
  function labelFor(level){var mode=modeFor(level);return mode==='daily'?'每日配色 · '+level.id.slice(6):mode==='workshop'?'自由工坊 · 自选染布':chapterFor(level).name;}
  function checkSaved(result){if(result&&result.ok&&result.persisted&&result.localOnly)notice='本地布样已保存；同步队列已满，新局仅保留本机。';if(result && (!result.ok||result.persisted===false))notice=result.error==='outbox-capacity'||result.error==='evidence-capacity'?'记录空间已满：本次合幅可欣赏，新的收藏暂未写入。':'这次记录暂未完整保存；请留在当前页面，关闭页面可能丢失。';}
  function save(){checkSaved(store.saveSession(state,descriptor(current())));}
  function flush(){store.flush(window.DyeHost);}
  function stars(n){return '★'.repeat(n)+'☆'.repeat(3-n);}
  function start(level,resume){
    if(!resume){state=E.create(level,store.newRunId());hint=null;lastFill=null;lastSettlement=null;save();}
    view='game';hint=null;lastFill=null;closeModal();render();
    if(state.status==='won')showWin();
  }
  function nextLevel(){var p=progress();return L.all.filter(function(l){return !p.levels[l.id];})[0]||L.all[0];}
  function brand(){return '<span class="brand"><span class="brand-mark">染</span>四季染旅</span>';}
  function noticeHtml(){return notice?'<div class="notice" role="status">'+esc(notice)+'</div>':'';}
  function render(){if(view==='home')renderHome();else renderGame();}
  function renderHome(){
    DAY=localDay();
    var p=progress();
    app.innerHTML='<main class="shell">'+noticeHtml()+'<header class="topbar">'+brand()+'<div class="top-actions"><button data-action="tutorial">染布入门</button><button data-action="about">关于</button></div></header><section class="hero"><div class="hero-copy"><div class="eyebrow">SEASONS IN EVERY THREAD</div><h1>一色一山河</h1><p class="tagline">借四季的颜色，染一匹心里的风景。<br>从左上角出发，让色彩慢慢相遇。</p></div><div class="hero-art"><img src="./assets/workshop-hero.svg" alt="木轴上铺展着四季染布，旁边是陶碟、线轴与枝叶"></div><div class="hero-cta"><button class="primary" data-action="continue">'+(state&&state.status!=='won'?'续染这匹布':'开启染旅')+' <span class="arrow">↗</span></button><p class="hero-note">72 匹布样 · 6 段染旅 · 每日一抹新色</p></div></section><section aria-label="章节地图"><div class="section-head"><h2>四时染途</h2><span>已收藏 '+p.collected.length+' / 72 匹</span></div><div class="route-grid">'+L.chapters.map(function(c,i){
      var done=L.all.filter(function(l){return l.chapter===c.id&&p.levels[l.id];}).length;
      var art=['spring','latespring','summer','autumn','winter','fourseasons'][i];
      return '<button class="chapter-card" data-action="chapter" data-id="'+c.id+'"><img class="chapter-image" src="./assets/chapter-'+art+'.svg" alt=""><div class="chapter-copy"><span class="number">CHAPTER '+String(i+1).padStart(2,'0')+'</span><h3>'+esc(c.name)+'</h3><p>'+esc(c.subtitle||c.lesson||['初识连区 · 3 色小幅','让染区生长 · 3–4 色','水路分岔 · 4 色','层叠交织 · 4–5 色','深浅呼应 · 5 色','四时合锦 · 6 色'][i])+'</p><div class="chapter-progress"><span class="thread-line"><i style="width:'+Math.round(done/12*100)+'%"></i></span><span>'+done+' / 12</span></div></div></button>';
    }).join('')+'</div></section><section class="extras" aria-label="更多染布方式"><button class="extra-card" data-action="daily"><i class="extra-icon">◒</i><b>每日配色</b><span>今天独有的一匹<br>'+DAY.slice(5).replace('-',' / ')+'</span></button><button class="extra-card" data-action="workshop"><i class="extra-icon">✣</i><b>自由工坊</b><span>自选尺寸与颜色<br>以种子留住灵感</span></button><button class="extra-card" data-action="collection"><i class="extra-icon">▤</i><b>布样收藏</b><span>把走过的四季<br>缝进自己的布册</span></button></section><footer class="footnote">不催促，不扣回成长。随时停下，下次接着染。</footer></main>';
  }
  function renderGame(){
    var focused=document.activeElement,focusAction=focused&&focused.dataset?focused.dataset.action:null,focusColor=focused&&focused.dataset?focused.dataset.color:null;
    var level=current(),chapter=chapterFor(level), mode=modeFor(level);
    var ratio=Math.round(state.controlled/state.board.length*100);
    var title=mode==='campaign'?level.name:mode==='daily'?'今日 · 四时一染':'工坊 · 随心成色';
    var number=mode==='campaign'?'布样 '+String(L.all.indexOf(level)+1).padStart(2,'0')+' / 72':mode==='daily'?level.id.slice(6):'种子 '+level.seed;
    var message=hint?'试试'+R.colours[hint.color].name+'（'+R.colours[hint.color].motif+'纹）：可接入 '+hint.expandedBy+' 格。'+(state.moves+hint.path.length<=level.moveLimit?'当前参考路线还需 '+hint.path.length+' 步。':'当前参考路线需 '+hint.path.length+' 步，可撤销再规划。'):lastFill?lastFill.expandedBy>0?'染意相连，接入 '+lastFill.expandedBy+' 格新布面。':'这次换色未接入新格，仍计 1 步。':'白缝线内是染区。选一种颜色，让它向外生长。';
    if(state.status==='over-limit')message=E.complete(state.board)?'练习合幅完成。撤销或重开，再试着在预算内合幅。':'预算已用完，可继续练习；撤销和重开随时可用。';
    if(state.status==='won')message='这匹布已合幅。你的颜色，被四季收藏。';
    app.innerHTML='<main class="game-shell">'+noticeHtml()+'<header class="game-top"><button data-action="home" aria-label="返回染途主页">‹ 染途</button><span class="eyebrow">'+esc(labelFor(level))+'</span><button data-action="tutorial" aria-label="重看染布教程">入门 ?</button></header><section class="game-title"><div><div class="level-label">'+esc(number)+'</div><h1>'+esc(title)+'</h1></div><div class="level-side">'+level.width+' × '+level.height+' · '+level.colours+' 色<br>'+esc(level.topologyName||'四向连色')+'</div></section><section class="stat-row" aria-label="染布进度"><div class="stat-box"><span class="stat-number">'+state.moves+'</span><small>/ '+level.moveLimit+' 步预算</small><span class="stat-label">参考 '+level.referenceMoves+' 步</span></div><div class="stat-box"><span class="stat-number">'+ratio+'<small>%</small></span><small>已连色</small><span class="stat-label">'+state.controlled+' / '+state.board.length+' 格 · '+R.colours[state.board[0]].motif+'纹染区</span></div></section><div class="loom-area"><div class="cloth">'+R.boardSvg(state.board,level.width,level.height,{moves:state.moves,absorbed:lastFill?lastFill.absorbed:[],recoloured:lastFill?lastFill.recoloured:[]})+'</div></div><p class="board-caption">● 左上起染　┈ 白缝线：已连通　◇ 每色皆有纹样</p><div class="live-note '+(state.status==='over-limit'?'warning':'')+'" role="status" aria-live="polite">'+esc(message)+'</div><section aria-label="染色操作"><div class="palette-title"><span>选一碟颜色</span><span>当前色不计步 · 键盘 1–'+level.colours+'</span></div><div class="palette">'+R.colours.slice(0,level.colours).map(function(c,i){return '<button class="dye-button'+(state.board[0]===i?' current':'')+(hint&&hint.color===i?' hinted':'')+'" data-action="dye" data-color="'+i+'" aria-label="'+c.name+' '+c.motif+'纹'+(state.board[0]===i?' 当前颜色':'')+'" aria-pressed="'+(state.board[0]===i)+'"><span class="dye-chip" style="background:'+c.hex+'"><svg viewBox="0 0 40 40" aria-hidden="true">'+R.glyph(i,20,20,45)+'</svg></span><span class="dye-name">'+c.name+'</span></button>';}).join('')+'</div><div class="tool-row"><button data-action="undo" '+(!state.moves?'disabled':'')+'><span class="symbol">↶</span>撤销</button><button data-action="hint" '+(E.complete(state.board)?'disabled':'')+'><span class="symbol hint-tag">✧</span>提示</button><button data-action="restart"><span class="symbol">↻</span>重染</button></div></section></main>';
    sizeBoard();
    if(focusAction){var target=app.querySelector('[data-action="'+focusAction+'"]'+(focusColor!==undefined?'[data-color="'+focusColor+'"]':''));if(target&&!target.disabled)target.focus();}
  }
  function sizeBoard(){
    document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');
    if(view!=='game')return;
    var loom=document.querySelector('.loom-area'),shell=document.querySelector('.game-shell');if(!loom||!shell)return;
    var available=window.innerHeight-(window.innerWidth<360?340:355)-(notice?45:0);
    var max=window.innerWidth>=701?350:420;
    var width=Math.max(185,Math.min(shell.clientWidth-(window.innerWidth<360?28:40),max,available));
    loom.style.width=width+'px';
  }
  function move(color){
    if(view!=='game'||modalKind)return;
    var result=E.move(state,current(),color);
    if(!result.accepted){if(result.reason==='same-colour'){var live=document.querySelector('.live-note');if(live)live.textContent='已经是这碟颜色了，不会增加步数。';}return;}
    state=result.state;lastFill=result;hint=null;
    if(state.status==='won'){lastSettlement=store.saveCompletion(state,descriptor(current()));checkSaved(lastSettlement);flush();renderGame();showWin();}else{save();renderGame();}
  }
  function openModal(kind,html){
    if(!modalKind)previousFocus=document.activeElement;
    modalKind=kind;document.body.classList.add('modal-open');
    modal.innerHTML='<div class="modal-overlay"><section class="modal-card" role="dialog" aria-modal="true" aria-label="'+({tutorial:'染布教程',chapter:'章节关卡',win:'合幅完成',workshop:'自由工坊',collection:'布样收藏',about:'关于与规则',restart:'重新染布'}[kind]||'染旅')+'">'+html+'</section></div>';
    var card=modal.querySelector('.modal-card');card.scrollTop=0;
    var focusable=modal.querySelector('button,input,select');if(focusable)focusable.focus();
  }
  function closeModal(){modalKind='';modal.innerHTML='';document.body.classList.remove('modal-open');if(previousFocus&&document.body.contains(previousFocus))previousFocus.focus();previousFocus=null;}
  function modalHeader(label){return '<div class="modal-header"><span class="eyebrow">'+label+'</span><button class="icon-button" data-action="close" aria-label="关闭">×</button></div>';}
  function showTutorial(index){tutorialIndex=index;openModal('tutorial',modalHeader('染布入门 · '+(index+1)+' / 3')+'<h2>'+tutorialTitles[index]+'</h2><img class="tutorial-picture" src="./assets/tutorial-'+['elements','action','goal'][index]+'.png" alt="'+esc(Dye.Tutorial[index].alt)+'"><p>'+tutorialTexts[index]+'</p><div class="tutorial-dots">'+[0,1,2].map(function(i){return '<i class="'+(i===index?'active':'')+'"></i>';}).join('')+'</div><button class="primary" data-action="tutorial-next">'+(index===2?'开始染布':'下一张 →')+'</button><button class="text-button" data-action="tutorial-skip">'+(index===2?'回到染途':'跳过，稍后再看')+'</button>');}
  function showChapter(id){var c=L.chapters.filter(function(item){return String(item.id)===String(id);})[0];if(!c)return;var p=progress();openModal('chapter',modalHeader('四时染途 · '+String(L.chapters.indexOf(c)+1).padStart(2,'0'))+'<h2>'+esc(c.name)+'</h2><p>'+esc(c.subtitle||'从一小片相连的颜色，染成一整匹季节。')+'</p><div class="level-grid">'+L.all.filter(function(l){return l.chapter===c.id;}).map(function(l){var record=p.levels[l.id];return '<button class="level-cell '+(record?'done':'')+'" data-action="level" data-id="'+l.id+'" aria-label="第 '+(L.all.indexOf(l)+1)+' 关 '+esc(l.name)+' '+(record?record.stars+' 星':'未完成')+'"><strong>'+String(L.all.indexOf(l)+1).padStart(2,'0')+'</strong><span>'+(record?stars(record.stars):l.width+'×'+l.height+' · '+l.colours+'色')+'</span></button>';}).join('')+'</div><p class="small">每章 12 匹不同布样，全部可自由探索。星级对照已验证参考策略，提示与撤销不扣星。</p>');}
  function showWin(){var level=current(),count=state.moves<=level.referenceMoves?3:state.moves<=level.referenceMoves+2?2:1;
    openModal('win',modalHeader('一匹布，收入四季')+'<div class="win"><div class="win-seal">合幅</div><h2>'+esc(level.name)+'</h2><div class="stars" aria-label="'+count+' 星">'+stars(count)+'</div><p>'+(count===3?'染色步数达到参考策略，手中的山河已成。':'一匹新的风景，已经缝进你的染旅。')+'</p><div class="score-line"><span><strong>'+state.moves+'</strong>本次染色</span><span><strong>'+level.referenceMoves+'</strong>参考策略</span></div><div class="result-ribbon">'+(lastSettlement&&(!lastSettlement.ok||!lastSettlement.persisted)?'本次已合幅 · 收藏暂未保存':modeFor(level)==='campaign'?'布样已收入收藏册':'本次配色已记录')+' · 提示与撤销不扣星</div>'+(notice?'<div class="notice" role="status">'+esc(notice)+'</div>':'')+'<p class="small">★★★ ≤ 参考步数　★★ ≤ 参考 +2<br>★ 其余预算内合幅。参考路线不保证最优。</p><button class="primary" data-action="next">'+(modeFor(level)==='campaign'?'下一匹布 →':'回到染途')+'</button><button class="text-button" data-action="close">欣赏这匹布</button></div>');}
  function showWorkshop(){openModal('workshop',modalHeader('留住一缕灵感')+'<h2>自由工坊</h2><p>让一串种子长成布面。同样的尺寸、色数与种子，会得到同一匹布。</p><div class="field"><label for="seed">种子 · 数字或一小段文字</label><input id="seed" maxlength="32" value="山间微雨" autocomplete="off"></div><div class="field"><label for="size">布面尺寸</label><select id="size"><option value="4">4 × 4 · 掌心小幅</option><option value="6" selected>6 × 6 · 舒展绢布</option><option value="8">8 × 8 · 长风织锦</option><option value="10">10 × 10 · 四季大幅</option></select></div><div class="field"><label for="colours">颜色数量</label><select id="colours"><option value="3">3 色 · 清简</option><option value="4" selected>4 色 · 丰盈</option><option value="5">5 色 · 层叠</option><option value="6">6 色 · 四时</option></select></div><button class="primary" data-action="workshop-start">铺开这匹布 →</button><p class="small">预算随已验证参考路线生成，超过预算仍可继续练习。</p>');}
  function showCollection(chapter){collectionChapter=Number(chapter)||1;var p=progress();var chapterObj=L.chapters[collectionChapter-1]||L.chapters[0];var entries=L.all.filter(function(l){return l.chapter===chapterObj.id&&p.levels[l.id];});openModal('collection',modalHeader('私人布样册 · '+p.collected.length+' / 72')+'<h2>把四季，缝进日常</h2><p>每完成一关，留下一匹原始配色布样。再次染布，可以刷新自己的参考星级。</p><div class="collection-tabs">'+L.chapters.map(function(c,i){return '<button class="'+(i+1===collectionChapter?'active':'')+'" data-action="collection-tab" data-chapter="'+(i+1)+'">'+String(i+1).padStart(2,'0')+'</button>';}).join('')+'</div>'+(entries.length?'<div class="collection-grid">'+entries.map(function(l){return '<button class="swatch" data-action="level" data-id="'+l.id+'"><div class="swatch-cloth">'+R.boardSvg(l.initialBoard,l.width,l.height,{label:l.name+'原始布样'})+'</div><div class="swatch-title">'+esc(l.name)+'<br>'+stars(p.levels[l.id].stars)+'</div></button>';}).join('')+'</div>':'<div class="empty">这一页还留着空白。<br>去「'+esc(chapterObj.name)+'」染一匹新的风景吧。</div>')+'<button class="secondary" data-action="chapter" data-id="'+chapterObj.id+'">前往这一章</button>');}
  function showAbout(){openModal('about',modalHeader('关于这段染旅')+'<h2>颜色相接，四时相逢</h2><p class="rule-line">从左上角的连通区开始。选择非当前色，整片连通区换色；只沿上、下、左、右吸收同色布格。零扩张也记一步。选当前色无效。</p><p class="rule-line">整幅同色且不超过预算，才算合幅通关。用完预算后可继续练习；撤销与重染不限次数。参考步数来自求解器的一条合法路线，不声称最优或唯一。</p><p class="rule-line">提示基于当前局面计算，并显示扩染格数与参考剩余步数。提示和撤销都不扣星。72 关全部可选，无连胜惩罚、无广告、无内购。</p><p class="rule-line">进度保存在本机浏览器。清理浏览器数据或小工具缓存可能移除记录。每日按设备本地日期生成。</p><div class="about-list">规则原型：Flood · Simon Tatham’s Portable Puzzle Collection<br>参考：ebnbin/puzzles 与《四季染坊》<br>本作规则实现、美术、文案与界面：Ten Realms Arcade contributors · MIT License。<br>来源记录见交付包 RULES.md 与 release/LICENSE-SOURCES.md。</div><button class="secondary" data-action="tutorial">重看图片教程</button>');}
  function dispatch(action,el){
    if(action==='close'){if(modalKind==='tutorial')store.markTutorial();closeModal();return;}
    if(action==='home'){view='home';hint=null;closeModal();renderHome();return;}
    if(action==='continue'){start(state&&state.status!=='won'?current():nextLevel(),!!(state&&state.status!=='won'));return;}
    if(action==='tutorial'){showTutorial(0);return;}
    if(action==='tutorial-skip'){store.markTutorial();closeModal();return;}
    if(action==='tutorial-next'){if(tutorialIndex<2)showTutorial(tutorialIndex+1);else{store.markTutorial();closeModal();if(view==='home')start(state&&state.status!=='won'?current():nextLevel(),!!(state&&state.status!=='won'));}return;}
    if(action==='chapter'){showChapter(el.dataset.id);return;}
    if(action==='level'){start(L.get(el.dataset.id),false);return;}
    if(action==='daily'){start(L.daily(localDay()),false);return;}
    if(action==='workshop'){showWorkshop();return;}
    if(action==='workshop-start'){var seed=document.getElementById('seed').value||'四季染旅';var size=Number(document.getElementById('size').value),colours=Number(document.getElementById('colours').value);start(L.workshop(seed,size,colours),false);return;}
    if(action==='collection'){showCollection(collectionChapter);return;}
    if(action==='collection-tab'){showCollection(el.dataset.chapter);return;}
    if(action==='about'){showAbout();return;}
    if(action==='dye'){move(Number(el.dataset.color));return;}
    if(action==='undo'){var completed=state.status==='won';state=E.undo(state,current());if(completed)state.runId=store.newRunId();lastSettlement=null;lastFill=null;hint=null;save();renderGame();return;}
    if(action==='hint'){hint=E.suggest(state.board,current());if(hint){state.hints+=1;save();renderGame();}return;}
    if(action==='restart'){openModal('restart',modalHeader('重新铺布')+'<h2>从这一匹的起点重染</h2><p>本局步数会归零，已经收好的布样和最佳记录都会保留。也可以先撤销几步，再换条路线。</p><button class="primary" data-action="restart-confirm">重新染这匹布</button><button class="secondary" data-action="close">继续当前染布</button>');return;}
    if(action==='restart-confirm'){start(current(),false);return;}
    if(action==='next'){var level=current(),index=L.all.indexOf(level);if(index>=0&&index<L.all.length-1)start(L.all[index+1],false);else{view='home';closeModal();renderHome();}return;}
  }
  document.addEventListener('click',function(event){var el=event.target.closest('[data-action]');if(el&&!el.disabled)dispatch(el.dataset.action,el);});
  document.addEventListener('keydown',function(event){
    if(modalKind){
      if(event.key==='Escape'){event.preventDefault();if(modalKind==='tutorial')store.markTutorial();closeModal();}
      if(event.key==='Tab'){var all=modal.querySelectorAll('button:not([disabled]),input,select');var first=all[0],last=all[all.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
      return;
    }
    if(view==='game'&&/^[1-6]$/.test(event.key)){event.preventDefault();move(Number(event.key)-1);}
    if(view==='game'&&(event.key==='z'||event.key==='Z')&&state.moves){event.preventDefault();dispatch('undo',null);}
  });
  window.addEventListener('resize',sizeBoard);
  window.addEventListener('dye-host-ready',flush);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)flush();});
  if(state&&state.status==='won'){lastSettlement=store.saveCompletion(state,descriptor(current()));checkSaved(lastSettlement);}
  render();sizeBoard();flush();
  if(!store.seenTutorial())showTutorial(0);
}());
