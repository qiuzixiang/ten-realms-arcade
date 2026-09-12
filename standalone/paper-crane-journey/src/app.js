(function () {
  'use strict';
  var E = window.CraneEngine, L = window.CraneLevels, A = window.CraneArt;
  var local = null;
  try { local = window.localStorage; } catch (error) { /* Storage may be denied by the container. */ }
  var store = window.CraneStorage.create(local, function (payload) {
    if (window.PaperCraneHost && typeof window.PaperCraneHost.onComplete === 'function') {
      return window.PaperCraneHost.onComplete(payload);
    }
    throw new Error('host-unavailable');
  });
  var app = document.getElementById('app'), modalRoot = document.getElementById('modal-root');
  var view = 'home', chapter = 1, session = store.loadSession(), level = null, state = null;
  var selected = -1, destination = -1, hintMove = null, message = '', messageClass = '', optionalTarget = true;
  var modal = null, tutorialPage = 0, focusBeforeModal = null, generation = 0;
  var chapterLessons = ['认清起点、同伴与空位', '让横跳与纵跳接续', '为边缘纸鹤留一条路', '先后顺序改变庭院', '别过早断开两侧支路', '在多条路线间找到归程'];
  var specimenNames = ['初折 · 杏羽', '莲间 · 青羽', '竹影 · 竹羽', '雨霁 · 雾羽', '月下 · 银羽', '星河 · 金羽'];
  var specimenNotes = ['第一道折痕，也是一段新旅程。', '把一池绿意，折进轻轻的翼。', '穿过竹叶之间，听见风的形状。', '雨停时，庭院多了一点从容。', '月色落在纸上，归途也会发亮。', '折起最后一角，把远方带回家。'];
  var numeral = ['一', '二', '三', '四', '五', '六'];
  function esc(value) { return String(value).replace(/[&<>"']/g, function (char) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]; }); }
  function dateKey() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function findSessionLevel(s) {
    if (!s) return null;
    if (s.mode === 'daily') return L.daily(s.seed);
    if (s.mode === 'seeded') return L.seeded(s.seed, s.chapter);
    return L.find(s.levelId);
  }
  function progress() { return store.progress(); }
  function countMap(map) { return Object.keys(map || {}).length; }
  function number(id) { var found = L.levels.findIndex(function (item) { return item.id === id; }); return found + 1; }
  function chapterInfo(id) { return L.chapters.find(function (item) { return item.id === id; }) || L.chapters[id-1]; }
  function inChapter(id) { return L.levels.filter(function (item) { return item.chapter === id; }); }
  function chapterCount(id,p) { return inChapter(id).filter(function (item) { return !!p.completed[item.id]; }).length; }
  function brand() { return '<div class="brand">' + A.craneSvg() + '<div>纸鹤归旅<div class="edition">PAPER CRANE JOURNEY</div></div></div>'; }
  function topbar() { return '<header class="topbar">' + brand() + '<nav class="topnav" aria-label="主导航"><button data-action="collection">图鉴</button><button data-action="tutorial">玩法</button></nav></header>'; }
  function home() {
    var p=progress(), done=L.levels.filter(function (item) { return p.completed[item.id]; }).length;
    var label=session && !E.won(E.replay(findSessionLevel(session),session.timeline)) ? '继续归旅' : (done ? '再入庭院' : '启程 · 初羽小径');
    var html='<main class="shell">'+topbar()+'<section class="hero"><img class="hero-art" src="./assets/cover.svg" alt="层叠纸艺月门与莲叶池，一只折纸鹤舒展羽翼"><div class="hero-copy"><div class="eyebrow">六座庭院 · 一羽归途</div><h1>把纷繁，<br>折成从容。</h1><p>跃过一只同伴，落在空莲叶。<br>让最后一只纸鹤，安静归巢。</p><button class="primary" data-action="continue">'+label+'<span class="arrow">↗</span></button></div></section><div class="section-heading"><h2>庭院手记</h2><span class="small">已归巢 '+done+' / 60</span></div><section class="chapter-grid" aria-label="六章地图">';
    L.chapters.forEach(function (c,i) {
      var n=chapterCount(c.id,p);
      html+='<button class="chapter-card" data-action="chapter" data-id="'+c.id+'"><span class="chapter-no">庭院 '+String(i+1).padStart(2,'0')+'</span><h3>'+esc(c.name)+'</h3><p>'+chapterLessons[i]+'</p><p>'+n+' / 10 枚归巢印</p><div class="progress-line"><span style="width:'+n*10+'%"></span></div>'+(n===10?'<span class="stamp">已藏</span>':'')+'</button>';
    });
    html+='</section><section class="daily-strip"><div><span class="eyebrow">每日归巢</span><h3>今日的风，新的折痕。</h3><p class="small">'+dateKey()+' · '+(p.daily[dateKey()]?'今日已归巢':'今日庭院已备好')+'</p></div><button class="secondary" data-action="daily">入庭 ↗</button></section><footer class="page-foot"><span>不计时 · 随时撤销 · 离线可玩</span><button data-action="seed">旅笺庭院 ↗</button><button data-action="about">关于</button></footer></main>';
    return html;
  }
  function chapterView() {
    var p=progress(),c=chapterInfo(chapter),n=chapterCount(chapter,p);
    var html='<main class="shell chapter-view"><header class="topbar"><button class="back-button" data-action="home">← 庭院</button><span class="eyebrow">归旅 · 第'+numeral[chapter-1]+'章</span><button data-action="collection">图鉴</button></header><div class="subpage-title"><div class="eyebrow">GARDEN '+String(chapter).padStart(2,'0')+'</div><h1>'+esc(c.name)+'</h1><p class="small">'+chapterLessons[chapter-1]+'。每一步，都为下一次起落留出空间。</p></div><div class="chapter-banner"><div><h3>'+n+' / 10 枚归巢印</h3><p class="small">集齐本章，收藏「'+specimenNames[chapter-1]+'」。<br>任选一关开始，也可以按顺序慢慢走。</p></div>'+A.craneSvg()+'</div><section class="level-grid" aria-label="关卡">';
    inChapter(chapter).forEach(function (item) {
      var done=!!p.completed[item.id],seals=(done?'●':'○')+(p.independent[item.id]?'◇':'')+(p.targets[item.id]?'✧':'');
      html+='<button class="level-card '+(done?'done':'')+'" data-action="level" data-id="'+item.id+'" aria-label="第'+number(item.id)+'关 '+esc(item.title)+(done?' 已通关':'')+'"><span class="level-number">'+String(number(item.id)).padStart(2,'0')+'</span><span class="level-name">'+esc(item.title)+'</span><span class="level-seals">'+seals+'</span></button>';
    });
    return html+'</section><p class="legend">● 已归巢　◇ 无提示独立完成　✧ 最后落在莲心<br>任意位置只剩一只即通关。收藏不设失去，也没有每日连签惩罚。</p><button class="text-button" data-action="seed">带一张旅笺，去相同难度的新庭院 →</button></main>';
  }
  function collection() {
    var p=progress(),done=L.levels.filter(function (item) {return p.completed[item.id];}).length;
    var independent=L.levels.filter(function (item){return p.independent[item.id];}).length;
    var targets=L.levels.filter(function (item){return p.targets[item.id];}).length;
    var html='<main class="shell"><header class="topbar"><button class="back-button" data-action="home">← 庭院</button><span class="eyebrow">纸上收藏</span><button data-action="tutorial">玩法</button></header><div class="subpage-title"><div class="eyebrow">THE FOLDED ARCHIVE</div><h1>每一羽，都有来处。</h1><p class="small">六种折羽，藏着六段归程。按自己的节奏，慢慢收集。</p></div><div class="collection-counts"><div><b>'+done+'</b><span class="small">归巢印 ●</span></div><div><b>'+independent+'</b><span class="small">独立印 ◇</span></div><div><b>'+targets+'</b><span class="small">莲心印 ✧</span></div></div><section class="collection-grid">';
    L.chapters.forEach(function(c,i){var n=chapterCount(c.id,p);html+='<article class="specimen '+(n===10?'':'locked')+'">'+A.craneSvg(i+1)+'<h3>'+specimenNames[i]+'</h3><p class="small">'+specimenNotes[i]+'</p><p class="small">'+(n===10?'已收入图鉴':'本章归巢 '+n+' / 10')+'</p></article>';});
    return html+'</section><p class="legend">提示、撤销和重玩都不会扣除已有收藏。今日归巢累计 '+countMap(p.daily)+' 天，缺席任何一天也不清空。</p></main>';
  }
  function coord(index) { return String.fromCharCode(65+index%state.width)+(Math.floor(index/state.width)+1); }
  function game() {
    var done=E.won(state),moves=E.legal(state),dead=!done&&!moves.length;
    var legal=selected<0?[]:moves.filter(function (m){return m.from===selected;}).map(function(m){return m.to;});
    var label=session.mode==='main'?'第 '+String(number(level.id)).padStart(2,'0')+' 关 / 60':session.mode==='daily'?'每日归巢 · '+session.seed:'旅笺 · '+esc(String(session.seed).slice(0,24));
    var html='<main class="shell game-shell"><header class="topbar game-top"><button data-action="return-map">← 庭院</button><div class="game-title"><strong>纸鹤归旅</strong><span>PAPER CRANE JOURNEY</span></div><button data-action="tutorial">玩法</button></header><section class="game-intro"><div class="eyebrow">'+label+'</div><h1>'+esc(level.title)+'</h1><p>'+esc(level.lesson || chapterLessons[level.chapter-1])+'</p></section><div class="game-stats"><div class="stat"><b>'+E.count(state)+'</b><span>庭中纸鹤</span></div><div class="stat"><b>'+session.timeline.length+'</b><span>已走跳跃</span></div><div class="stat"><b>'+(session.hints===0?'◇':session.hints)+'</b><span>'+(session.hints===0?'独立探索':'已用提示')+'</span></div></div><section class="garden" aria-label="纸艺莲池"><div id="board" class="board" role="group" aria-label="'+state.width+'列'+state.height+'行棋盘，余下'+E.count(state)+'只纸鹤">';
    state.cells.forEach(function (cell,i) {
      if(cell==='#') { html+='<span class="cell blocked" aria-hidden="true"></span>';return; }
      var isDestination=legal.indexOf(i)>=0,cls=cell==='P'?'peg':'hole';
      if(selected===i)cls+=' selected';if(isDestination)cls+=' destination';if(optionalTarget&&level.target===i)cls+=' target';if(destination===i)cls+=' arrived';
      if(hintMove&&hintMove.from===i)cls+=' hint-from';if(hintMove&&hintMove.to===i)cls+=' hint-to';
      var description=coord(i)+' '+(cell==='P'?'纸鹤':'空莲叶')+(isDestination?' 合法落点':'')+(optionalTarget&&i===level.target?' 莲心收藏点':'');
      html+='<button class="cell '+cls+'" data-cell="'+i+'" aria-label="'+description+'" aria-pressed="'+(selected===i)+'">'+(cell==='P'?A.craneSvg():A.lotusSvg())+'<span class="coord" aria-hidden="true">'+coord(i)+'</span></button>';
    });
    var msg=message||(done?'一羽归庭。任意位置只剩一只，就是归巢。':dead?'纸鹤暂时没有可跳的空位了。撤销几步，换一条路试试。':selected>=0?(legal.length?'点带 ↓ 的空莲叶，让纸鹤跃过一只同伴。':'这只纸鹤暂时不能跳。试试另一只，或先整理相邻路线。'):'先点一只纸鹤，再点它能跳到的空莲叶。');
    html+='</div></section><div class="game-message '+(messageClass||(dead?'warning':''))+'" role="status">'+esc(msg)+'</div><div class="tools"><button data-action="undo" '+(session.timeline.length?'':'disabled')+'><span class="tool-icon">↶</span>撤销</button><button data-action="restart"><span class="tool-icon">↺</span>重开</button><button class="hint-button" data-action="'+(done?'completion':'hint')+'"><span class="tool-icon">'+(done?'✧':'☼')+'</span>'+(done?'归巢手记':'提示')+'</button></div><div class="game-option"><button data-action="target" class="'+(optionalTarget?'enabled':'')+'">'+(optionalTarget?'✧ 已标出莲心':'○ 标出莲心')+' · 可选落点收藏</button></div><p class="tiny-notice '+(!store.saved?'storage-error':'')+'">'+(!store.saved?'当前浏览器暂未保存，关闭页面可能丢失本次进度。':'任意位置余一只即通关 · 撤销无限次')+'</p><span class="game-view-foot">一跃一折 · 不疾不徐</span></main>';
    return html;
  }
  function render() {
    var active=document.activeElement, focusSelector=null;
    if(active&&app.contains(active)){if(active.hasAttribute('data-action'))focusSelector='[data-action="'+active.getAttribute('data-action')+'"]';else if(active.hasAttribute('data-cell'))focusSelector='[data-cell="'+active.getAttribute('data-cell')+'"]';}
    app.innerHTML=view==='game'?game():view==='chapter'?chapterView():view==='collection'?collection():home();
    sizeBoard();
    if(focusSelector){var replacement=app.querySelector(focusSelector);if(!replacement||replacement.disabled)replacement=app.querySelector('[data-cell]')||app.querySelector('button');if(replacement)replacement.focus();}
  }
  function sizeBoard() {
    document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');
    var board=document.getElementById('board');if(!board||!state)return;
    var parent=board.parentElement;parent.style.width='100%';
    var available=parent.clientWidth-18;
    var overhead=document.querySelector('.game-shell').getBoundingClientRect().height-board.getBoundingClientRect().height;
    var availableHeight=Math.max(44*state.height,window.innerHeight-overhead-4);
    var cellSize=Math.max(44,Math.floor(Math.min(available/state.width,430/state.width,availableHeight/state.height,430/state.height)));
    parent.style.width=(cellSize*state.width+20)+'px';
    board.style.width=(cellSize*state.width)+'px';board.style.height=(cellSize*state.height)+'px';
    board.style.gridTemplateColumns='repeat('+state.width+','+cellSize+'px)';
    board.style.gridTemplateRows='repeat('+state.height+','+cellSize+'px)';
  }
  function save() { store.saveSession(session); }
  function start(nextLevel,mode) {
    closeModal();generation++;level=nextLevel;chapter=level.chapter;
    session=store.newSession(level,mode||'main');state=E.create(level);view='game';selected=-1;destination=-1;hintMove=null;message='';messageClass='';render();window.scrollTo(0,0);
  }
  function resume() {
    if(session) { var restored=findSessionLevel(session),played=restored&&E.replay(restored,session.timeline);if(played&&!E.won(played)){generation++;level=restored;chapter=level.chapter;state=played;view='game';selected=-1;hintMove=null;message='';render();window.scrollTo(0,0);return;} }
    var p=progress(),next=L.levels.find(function(item){return !p.completed[item.id];})||L.levels[0];start(next,'main');
  }
  function chooseCell(index,keyboard) {
    if(view!=='game'||modal||E.won(state))return;
    generation++;
    message='';messageClass='';hintMove=null;destination=-1;
    if(state.cells[index]==='P'){selected=selected===index?-1:index;render();}
    else if(selected>=0){var move={from:selected,to:index},next=E.apply(state,move);if(next===state){message='这里不能落下。只能横向或纵向跨过一只纸鹤。';messageClass='warning';render();}
      else {state=next;session.timeline.push(move);selected=-1;destination=index;save();if(E.won(state)){store.complete(session,level);render();showCompletion();}else render();}}
    else {message='先点一只纸鹤，再选择它能跳到的空莲叶。';render();}
    if(keyboard&&!modal){var cell=app.querySelector('[data-cell="'+index+'"]');if(cell)cell.focus();}
    document.getElementById('announcement').textContent=message||('余下 '+E.count(state)+' 只纸鹤。');
  }
  function undo() {
    if(!session.timeline.length)return;
    generation++;var timeline=session.timeline.slice(0,-1),hints=session.hints,undos=session.undos+1;
    if(E.won(state))session=store.newSession(level,session.mode);
    session.timeline=timeline;session.hints=hints;session.undos=undos;state=E.replay(level,timeline);selected=-1;hintMove=null;destination=-1;message='已退回一步。每条归途，都允许重新想一想。';messageClass='';save();render();
  }
  function hint() {
    if(E.won(state))return;
    var token=++generation;message='正在观察这一刻的庭院…';messageClass='tip';render();
    setTimeout(function(){
      if(token!==generation||view!=='game'||modal||E.won(state))return;
      var answer=E.solve(state,{nodeLimit:60000,target:optionalTarget?level.target:undefined});
      if(!answer.solution&&optionalTarget)answer=E.solve(state,{nodeLimit:60000});
      if(!answer.solution){
        var witness=E.create(level),remaining=null;
        for(var i=0;i<=level.solution.length;i++){if(witness.cells.join('')===state.cells.join('')){remaining=level.solution.slice(i);break;}if(i<level.solution.length)witness=E.apply(witness,level.solution[i]);}
        if(remaining)answer.solution=remaining;
      }
      session.hints++;save();
      if(answer.solution&&answer.solution.length){hintMove=answer.solution[0];selected=hintMove.from;message='试试 '+coord(hintMove.from)+' → '+coord(hintMove.to)+'：跃过中间的同伴，给下一步留出空位。';}
      else if(answer.truncated){message='这条支路需要更多探索。可撤销一步，再试另一条路线；提示不会自动改动棋盘。';}
      else {message='从当前局面已找不到单鹤归巢路线。撤销一步，再看看不同的起跳顺序。';}
      messageClass='tip';render();
    },20);
  }
  function showCompletion() { if(!E.won(state))return;store.complete(session,level);openModal('completion'); }
  function nextLevel() {
    if(session.mode==='main'){var index=number(level.id);if(index<60){start(L.levels[index],'main');}else{closeModal();view='collection';render();}}
    else{closeModal();view='home';render();}
  }
  function openModal(kind) { generation++; if(message==='正在观察这一刻的庭院…'){message='';messageClass='';render();} focusBeforeModal=document.activeElement;modal=kind;document.body.style.overflow='hidden';drawModal(); }
  function closeModal() { if(!modal)return;modal=null;modalRoot.innerHTML='';document.body.style.overflow='';if(focusBeforeModal&&document.contains(focusBeforeModal))focusBeforeModal.focus(); }
  function drawModal() {
    var content='',top='归旅手记',close='关闭';
    if(modal==='tutorial') {
      top='三张纸笺 · '+(tutorialPage+1)+' / 3';close='跳过';
      var titles=['一池莲叶，几只纸鹤','跃过一只，落向空位','只留一羽，就是归巢'];
      var texts=['有纸鹤的莲叶是起点，空莲叶是落点。没有莲叶的地方不能站立；点选纸鹤会显示它能跳到的空位。','横向或纵向，恰好跳两格。中间必须有一只同伴，落点必须空着；起点与中间的纸鹤离开，落点留下跳来的纸鹤。','每一步少一只，任意位置只剩一只就通关。✧ 莲心只是额外收藏；提示、撤销与重开都随时可用。'];
      content='<h2 id="modal-title">'+titles[tutorialPage]+'</h2><img class="tutorial-image" src="./assets/tutorial-'+(tutorialPage+1)+'.svg" alt="'+(tutorialPage===0?'真实教程关的初始棋盘，四只纸鹤与空莲叶':tutorialPage===1?'同一关完成一次合法跳跃后，余下三只纸鹤':'同一关完整回放三步后，只剩一只纸鹤')+'"><p>'+texts[tutorialPage]+'</p><div class="modal-actions"><div class="tutorial-dots" aria-hidden="true">'+[0,1,2].map(function(i){return '<i class="'+(i===tutorialPage?'active':'')+'"></i>';}).join('')+'</div><button class="primary" data-action="tutorial-next">'+(tutorialPage===2?'开始归旅':'下一张 →')+'</button></div>';
    } else if(modal==='completion') {
      var target=state.cells[level.target]==='P';
      content='<div class="win"><div class="win-art">'+A.craneSvg()+'</div><div class="eyebrow">THE JOURNEY FINDS ITS HOME</div><h2 id="modal-title">一羽归庭。</h2><p>'+esc(level.title)+' · '+session.timeline.length+' 次真实跳跃<br>庭院慢慢安静了，你的归程已记下。</p><div class="seal-row"><div class="seal earned"><b>●</b>归巢印</div><div class="seal '+(session.hints===0?'earned':'')+'"><b>◇</b>'+(session.hints===0?'独立完成':'提示伴行')+'</div><div class="seal '+(target?'earned':'')+'"><b>✧</b>'+(target?'莲心收藏':'下次试试莲心')+'</div></div>'+(!store.saved?'<p class="storage-error">本次已通关，但浏览器暂未保存。</p>':'')+'<button class="primary" data-action="next">'+(session.mode==='main'?(number(level.id)===60?'翻开全部图鉴':'下一处庭院 →'):'回到庭院地图')+'</button><button class="text-button" data-action="close-modal">留在这里看看</button></div>';
    } else if(modal==='restart') {
      content='<h2 id="modal-title">重新折一遍？</h2><p>这一局回到最初的庭院。已经获得的归巢印与图鉴都会保留。</p><div class="modal-actions"><button class="secondary" data-action="close-modal">继续想想</button><button class="primary" data-action="confirm-restart">重新启程</button></div>';
    } else if(modal==='seed') {
      content='<h2 id="modal-title">带上你的旅笺</h2><p>同一旅笺、同一庭院难度，会遇见相同的题面。可反复练习，也可换一个词，开始另一段归程。</p><label class="input-label">旅笺文字（1–24字）<input id="seed-input" maxlength="24" value="莲风'+dateKey().slice(5).replace('-','')+'" autocomplete="off"></label><label class="input-label">庭院难度<select id="seed-chapter">'+L.chapters.map(function(c){return '<option value="'+c.id+'" '+(c.id===chapter?'selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select></label><div class="modal-actions"><span class="small">已验证可解 · 可选终点</span><button class="primary" data-action="start-seed">沿笺入庭 →</button></div>';
    } else {
      content='<div class="about-text"><h2 id="modal-title">纸鹤归旅</h2><p>把经典 Pegs 跳棋，折进六座安静庭院。60 个主线题面、每日归巢与旅笺庭院，均保留可合法回放的通关路线。</p><p>所有通关都固定为初始纸鹤数减一的跳跃次数，因此这里没有“最少步数”评分。独立完成表示这一局未用提示，撤销不影响；任意余子位置均可胜利。</p><p>关卡不宣称唯一解。存档仅保存在当前浏览器，浏览器清理数据会丢失记录。小工具无需联网。</p><p class="small">规则原型：Simon Tatham’s Portable Puzzle Collection · Pegs。来源快照：ebnbin/puzzles，5a9e1795。独立重写与纸艺矢量创作；MIT 许可与出处随发布包保存。</p><p class="small">© 2026 Ten Realms Arcade contributors · v1.0</p></div>';
    }
    modalRoot.innerHTML='<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-top"><span>'+top+'</span><button data-action="close-modal">'+close+'</button></div><div class="modal-body">'+content+'</div></section></div>';
    var first=modalRoot.querySelector('button');if(first)first.focus();
  }
  function navigate(nextView) { generation++;closeModal();view=nextView;message='';render();window.scrollTo(0,0); }
  function action(name,target) {
    if(name==='close-modal'){if(modal==='tutorial')store.markTutorial();closeModal();return;}
    if(name==='tutorial'){tutorialPage=0;openModal('tutorial');return;}
    if(name==='tutorial-next'){if(tutorialPage<2){tutorialPage++;drawModal();}else{store.markTutorial();closeModal();}return;}
    if(name==='home'){navigate('home');return;}
    if(name==='collection'){navigate('collection');return;}
    if(name==='chapter'){chapter=Number(target.dataset.id);navigate('chapter');return;}
    if(name==='return-map'){navigate(session.mode==='main'?'chapter':'home');return;}
    if(name==='level'){start(L.find(target.dataset.id),'main');return;}
    if(name==='continue'){resume();return;}
    if(name==='daily'){start(L.daily(dateKey()),'daily');return;}
    if(name==='seed'||name==='about'){openModal(name);return;}
    if(name==='start-seed'){var seed=document.getElementById('seed-input').value.trim(),c=Number(document.getElementById('seed-chapter').value);if(!seed){document.getElementById('seed-input').focus();return;}start(L.seeded(seed,c),'seeded');return;}
    if(name==='undo'){undo();return;}
    if(name==='restart'){openModal('restart');return;}
    if(name==='confirm-restart'){start(level,session.mode);return;}
    if(name==='hint'){hint();return;}
    if(name==='target'){generation++;optionalTarget=!optionalTarget;hintMove=null;message=optionalTarget?'✧ 标出的是额外收藏点，任意位置余一只都能通关。':'莲心标记已收起；经典归巢规则不变。';render();return;}
    if(name==='completion'){showCompletion();return;}
    if(name==='next'){nextLevel();}
  }
  document.addEventListener('click',function(event){var target=event.target.closest('button');if(!target||target.disabled)return;if(target.hasAttribute('data-cell')){if(!window.PointerEvent||event.detail===0)chooseCell(Number(target.dataset.cell),event.detail===0);return;}if(target.dataset.action)action(target.dataset.action,target);});
  if(window.PointerEvent)document.addEventListener('pointerup',function(event){var target=event.target.closest('[data-cell]');if(target&&event.button===0)chooseCell(Number(target.dataset.cell),false);});
  document.addEventListener('keydown',function(event){
    if(event.key==='Escape'&&modal){if(modal==='tutorial')store.markTutorial();closeModal();return;}
    if(event.key==='Tab'&&modal){var buttons=modalRoot.querySelectorAll('button,input,select'),first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    if(!modal&&view==='game'&&event.target.hasAttribute('data-cell')&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(event.key)>=0){event.preventDefault();var index=Number(event.target.dataset.cell),dx=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0,dy=event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0,x=index%state.width,y=Math.floor(index/state.width);while(true){x+=dx;y+=dy;if(x<0||y<0||x>=state.width||y>=state.height)break;var next=app.querySelector('[data-cell="'+(y*state.width+x)+'"]');if(next){next.focus();break;}}}
  });
  window.addEventListener('resize',sizeBoard);
  window.addEventListener('paper-crane-host-ready',function(){store.retry();});
  if(!store.tutorialSeen()){if(session){level=findSessionLevel(session);state=E.replay(level,session.timeline);chapter=level.chapter;view='game';render();}else{start(L.levels[0],'main');}tutorialPage=0;openModal('tutorial');}else{render();}
  store.retry();
})();
