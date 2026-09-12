(function () {
  'use strict';
  var R = window.MistRules, L = window.MistLevels, S = window.MistStore, V = window.MistRender;
  var app = document.getElementById('app'), modalRoot = document.getElementById('modal-root');
  var storage;
  try { storage = window.localStorage; } catch (error) { storage = null; }
  function lookup(id, mode, day) { var level = L.get(id); return mode === 'daily' && (!day || L.daily(day).id !== id) ? null : level; }
  var state = S.load(storage, lookup), view = 'home', chapterIndex = 0, galleryPage = 0, tool = 1, selected = 0, precise = false, focusBefore = null, modalType = '', hintData = null, hintStage = 0, tutorialStep = 0, toastTimer, savingWarning = false, flushing = false;
  var tutorialText = [
    ['先读懂一束光', '边上的数字表示这一行或列里，连续显影的格数。多个数字按顺序排列，每段之间至少留一格。数字 0 表示整条留白。'],
    ['一次落笔，留下一格', '选「■ 显影」后点格子。上图橙框是一笔真实显影。确定不填的格子用「× 留白」；「· 擦除」恢复未知，随时可以撤销。'],
    ['照片，在确定中浮现', '每个格子都标成 ■ 或 ×，并让所有行列都符合数字，照片就会入册。7×7 小格也能用下方行、列选择器和大号落笔按钮准确操作。']
  ];
  function esc(s) { return V.escape(s); }
  function dayKey() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function chapterFor(level) { return L.chapters.find(function(c) {return c.id === level.chapter;}) || L.chapters[level.chapter] || L.chapters[0]; }
  function chapterLevels(c) { return L.levels.filter(function(l) {return l.chapter === c.id;}); }
  function recordsFor(id) { return state.records.filter(function(r) {return r.levelId === id;}); }
  function done(id) { return recordsFor(id).length > 0; }
  function collected() { return L.levels.filter(function(l) {return done(l.id);}).length; }
  function suggested() { return L.levels.find(function(l) {return !done(l.id);}) || L.levels[0]; }
  function levelNumber(level) { return L.levels.indexOf(level) + 1; }
  function toast(message) { var el = document.getElementById('toast'); el.textContent = message; el.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(function() {el.style.display='none';}, 3000); }
  function persist() { var result = S.save(storage, state); if (!result.ok && !savingWarning) { savingWarning = true; toast('当前浏览器无法保存，仍可游玩；关闭页面后进度可能丢失。'); } return result.ok; }
  function flush() {
    if (flushing || typeof window.mistwoodCompletionHost !== 'function') return;
    flushing = true;
    S.flush(state, storage, window.mistwoodCompletionHost, lookup).then(function(result) {
      // Only apply delivery acknowledgements; gameplay may have advanced meanwhile.
      state.acked = result.state.acked;
      state.outbox = state.outbox.filter(function(p) {return state.acked.indexOf(p.completionId) < 0;});
      persist(); flushing = false;
    }, function() {flushing=false;});
  }
  function nav(active) { return '<nav class="bottom-nav" aria-label="暗房导航"><button data-action="home" class="'+(active==='home'?'active':'')+'"><b>⌂</b>暗房</button><button data-action="albums" class="'+(active==='albums'?'active':'')+'"><b>▤</b>相册</button><button data-action="gallery" class="'+(active==='gallery'?'active':'')+'"><b>▧</b>图鉴</button></nav>'; }
  function header() { return '<header class="masthead"><div class="brand"><img src="./assets/icon.svg" alt=""><div><strong>雾窗显影</strong><small>MISTWOOD DARKROOM</small></div></div><button class="pill" data-action="settings">暗房手册</button></header>'; }
  function chapterCard(c, i) { var levels = chapterLevels(c), count = levels.filter(function(l){return done(l.id);}).length; return '<button class="chapter-card" data-action="chapter" data-index="'+i+'"><span class="chapter-no">0'+(i+1)+'</span><h3>'+esc(c.title)+'</h3><p>'+esc(c.subtitle)+' · '+count+'/10</p><div class="chapter-meter"><i style="width:'+count*10+'%"></i></div></button>'; }
  function renderHome() {
    var ongoing = state.current && !R.complete(lookup(state.current.levelId,state.current.mode,state.current.day),state.current.grid);
    var next = state.current ? lookup(state.current.levelId,state.current.mode,state.current.day) : suggested();
    var independent = L.levels.filter(function(l){return recordsFor(l.id).some(function(r){return r.hints===0;});}).length;
    app.innerHTML = '<main class="shell">'+header()+'<div class="page-heading"><div><div class="eyebrow">A LITTLE LIGHT, SLOWLY</div><h1>把日常，慢慢洗成光。</h1><p>一间安静的暗房，六本等待显影的相册。</p></div></div><div class="home-columns"><section class="hero"><img src="./assets/room.svg" alt="暖灯下的绿色暗房，显影盘与晾晒照片"><div class="hero-note"><strong>今日，光线刚刚好。</strong><small>OPEN · 07:00 — ∞</small></div></section><section class="home-side"><div class="stats"><div class="stat"><strong>'+String(collected()).padStart(2,'0')+' <small>/ 60</small></strong><span>已经显影</span></div><div class="stat"><strong>'+String(independent).padStart(2,'0')+'</strong><span>独立完成</span></div><div class="stat"><strong>06</strong><span>主题相册</span></div></div><h2 class="welcome-note">不急着找到答案，<br>先确定眼前的一格。</h2><p class="muted">没有倒计时，不扣生命。让数字牵着你的手，<br>把一张藏起来的照片找回来。</p><button class="primary continue" data-action="continue"><span><strong>'+(ongoing?'继续上次的底片':state.current?'回看刚刚显影的照片':'开始显影')+'</strong><small>'+esc(chapterFor(next).title)+' · 第 '+String(levelNumber(next)).padStart(2,'0')+' 张 · '+next.width+' × '+next.height+'</small></span><span>→</span></button><button class="daily" data-action="daily"><span class="daily-symbol">☼</span><div><strong>每日照片</strong><small>'+dayKey()+' · 题库中的一张旧光影</small></div><span>↗</span></button></section></div><div class="section-line"><h2>沿着光，翻一本相册</h2><button data-action="albums">全部相册 →</button></div><section class="chapter-shelf">'+L.chapters.map(chapterCard).join('')+'</section><p class="fine-print">数织 / Nonogram · 60 张独立图案 · 所有相册自由翻阅</p></main>'+nav('home');
  }
  function card(level, gallery) {
    var complete = done(level.id), n = levelNumber(level), rec = recordsFor(level.id), minHints = rec.length ? Math.min.apply(null,rec.map(function(r){return r.hints;})) : null;
    return '<button class="level-card" data-action="level" data-id="'+level.id+'"><span class="number"><span>NO. '+String(n).padStart(2,'0')+'</span><span class="check">'+(complete?'✓':'○')+'</span></span>'+V.photo(level,chapterFor(level).color,!complete)+'<b>'+esc(complete?level.title:(gallery?'待显影':'未显影 · '+level.width+'×'+level.height))+'</b><small>'+(complete?(minHints===0?'独立印记':'已入册')+' · 复拍 '+rec.length+' 次':esc(level.lesson || '循着数字寻找光'))+'</small></button>';
  }
  function renderAlbums() {
    var c = L.chapters[chapterIndex], levels=chapterLevels(c), count=levels.filter(function(l){return done(l.id);}).length;
    app.innerHTML='<main class="shell">'+header()+'<div class="page-heading"><div><div class="eyebrow">SIX ALBUMS · SIX SLOW WALKS</div><h1>光的旅行簿</h1><p>从整行开始，走向行列之间的推理。自由选片。</p></div></div><div class="chapter-tabs">'+L.chapters.map(function(ch,i){return '<button data-action="chapter" data-index="'+i+'" class="'+(i===chapterIndex?'active':'')+'">0'+(i+1)+' '+esc(ch.title)+'</button>';}).join('')+'</div><section class="album-heading"><div><div class="eyebrow">ALBUM 0'+(chapterIndex+1)+'</div><h2>'+esc(c.title)+'</h2><p>'+esc(c.lesson || c.subtitle)+'</p></div><div class="count">'+String(count).padStart(2,'0')+'<small> / 10</small></div></section><div class="level-grid">'+levels.map(function(l){return card(l,false);}).join('')+'</div><p class="fine-print">每张照片都有唯一解。使用提示也能完整入册，随时复拍。</p></main>'+nav('albums');
  }
  function renderGallery() {
    var photos=L.levels.filter(function(l){return done(l.id);});
    var pages=Math.max(1,Math.ceil(photos.length/12));galleryPage=Math.min(galleryPage,pages-1);
    var pager=pages>1?'<div class="gallery-pages"><button class="pill" data-action="gallery-prev"'+(galleryPage===0?' disabled':'')+'>← 上一页</button><span>'+(galleryPage+1)+' / '+pages+'</span><button class="pill" data-action="gallery-next"'+(galleryPage===pages-1?' disabled':'')+'>下一页 →</button></div>':'';
    app.innerHTML='<main class="shell">'+header()+'<div class="page-heading"><div><div class="eyebrow">THE LIGHT YOU HAVE KEPT</div><h1>已经留住的光</h1><p>'+photos.length+' / 60 张照片 · 点照片查看故事与复拍记录</p></div></div>'+(photos.length?'<div class="gallery-grid">'+photos.slice(galleryPage*12,galleryPage*12+12).map(function(l){return card(l,true);}).join('')+'</div>'+pager:'<section class="hero"><img src="./assets/room.svg" alt="等待晾晒照片的暗房"><div class="hero-note"><strong>第一张光，还在路上。</strong><small>TAKE YOUR TIME</small></div></section><p class="empty-note">每完成一张底片，它的名字和小故事就会在这里揭晓。提示不会影响收藏。</p><button class="primary" data-action="continue">洗出第一张照片 →</button>')+'</main>'+nav('gallery');
  }
  function lineStatus(values, clues) {
    var options=R.lineOptions(values.length,clues,values);
    return !options.length?'conflict':values.every(function(v){return v!==0;})?'match':'';
  }
  function renderPlay() {
    if(!state.current){view='home';render();return;}
    var s=state.current, level=lookup(s.levelId,s.mode,s.day), c=chapterFor(level), filled=s.grid.filter(function(v){return v!==0;}).length, row=Math.floor(selected/level.width), col=selected%level.width;
    var board='<div class="corner">'+level.width+' × '+level.height+'</div>';
    level.columnClues.forEach(function(clue,x){var vals=[];for(var y=0;y<level.height;y++)vals.push(s.grid[y*level.width+x]);board+='<div class="clue col-clue '+lineStatus(vals,clue)+'" data-col="'+x+'" aria-label="第'+(x+1)+'列 '+(clue.join(' ')||'0')+'">'+(clue.length?clue:[0]).map(function(v){return '<span>'+v+'</span>';}).join('')+'</div>';});
    for(var r=0;r<level.height;r++){
      board+='<div class="clue row-clue '+lineStatus(s.grid.slice(r*level.width,(r+1)*level.width),level.rowClues[r])+'" data-row="'+r+'" aria-label="第'+(r+1)+'行 '+(level.rowClues[r].join(' ')||'0')+'">'+(level.rowClues[r].join(' ')||'0')+'</div>';
      for(var x=0;x<level.width;x++){var i=r*level.width+x,v=s.grid[i];board+='<button class="cell '+(v===1?'filled':v===2?'excluded':'unknown')+(i===selected?' selected':'')+(r===0?' edge-top':'')+(x===0?' edge-left':'')+'" data-cell="'+i+'" data-state="'+v+'" aria-label="第'+(r+1)+'行第'+(x+1)+'列，'+(v===1?'显影':v===2?'留白':'未知')+'" tabindex="'+(i===selected?'0':'-1')+'">'+(v===2?'×':'')+'</button>';}
    }
    function options(n,current){var s='';for(var i=0;i<n;i++)s+='<option value="'+i+'"'+(i===current?' selected':'')+'>'+(i+1)+'</option>';return s;}
    app.innerHTML='<main class="play-shell"><header class="play-top"><button class="back" data-action="back" aria-label="返回相册">‹</button><div class="play-brand">雾窗显影<small>'+esc(s.mode==='daily'?'DAILY · '+s.day:s.mode==='replay'?'ANOTHER EXPOSURE':'MISTWOOD DARKROOM')+'</small></div><button class="help" data-action="tutorial" aria-label="重看图片教程">?</button></header><div class="play-title"><div><div class="eyebrow">'+esc(c.title)+' / '+String(levelNumber(level)).padStart(2,'0')+'</div><h1>'+esc(done(level.id)?level.title:'一张等待显影的照片')+'</h1></div><div class="counter">'+String(filled).padStart(2,'0')+'<small>/ '+s.grid.length+' 格确定</small></div></div><section class="tray"><div class="tray-label"><span>NEGATIVE '+String(levelNumber(level)).padStart(3,'0')+'</span><span>'+level.width+'×'+level.height+' / ISO 100</span></div><div class="board" role="group" aria-label="数织底片，使用箭头移动，空格落笔" style="--cols:'+level.width+';--rows:'+level.height+'">'+board+'</div><div class="exposure"><i style="width:'+filled/s.grid.length*100+'%"></i></div><div class="tray-foot"><span>■ 显影　× 留白　空格 = 未知</span><span>'+s.moves+' 笔 · '+s.hints+' 提示</span></div></section><div class="tools" role="group" aria-label="显影工具">'+[[1,'■','显影'],[2,'×','留白'],[0,'·','擦除']].map(function(t){return '<button class="tool '+(tool===t[0]?'active':'')+'" aria-pressed="'+(tool===t[0])+'" data-action="tool" data-value="'+t[0]+'"><b>'+t[1]+'</b>'+t[2]+'</button>';}).join('')+'</div><div class="precision-note">精确落笔：选择行、列 → 落笔'+(precise?' · 点格仅选中':' · 也可直接点格')+'</div><div class="precision"><label>行<select id="row-select" aria-label="精确选择行">'+options(level.height,row)+'</select></label><label>列<select id="col-select" aria-label="精确选择列">'+options(level.width,col)+'</select></label><button data-action="apply">落笔 '+(tool===1?'■':tool===2?'×':'·')+'</button></div><div class="actions"><button data-action="undo"'+(!s.history.length?' disabled':'')+'>↶ 撤销</button><button data-action="restart">↻ 重开</button><button class="hint" data-action="hint">✧ 显影提示</button></div><p class="play-tip">'+esc(level.lesson || '数字之间至少留一格，每格都确定后照片才会显影。')+'</p></main>';
    sizeBoard();
  }
  function sizeBoard() {
    var board=document.querySelector('.board');if(!board||!state.current)return;
    var level=lookup(state.current.levelId,state.current.mode,state.current.day), maxRows=Math.max.apply(null,level.rowClues.map(function(c){return c.length;})),maxCols=Math.max.apply(null,level.columnClues.map(function(c){return c.length;}));
    var cw=maxRows>=3?52:43, ch=Math.max(42,maxCols*17+10), available=board.clientWidth-cw;
    var heightLimit=window.innerHeight<740?244:290;
    var cell=Math.min(Math.floor(available/level.width),Math.floor(heightLimit/level.height),50);
    board.style.setProperty('--clue-width',cw+'px');board.style.setProperty('--clue-height',ch+'px');board.style.setProperty('--cell-size',cell+'px');
  }
  function render(){if(view==='home')renderHome();else if(view==='albums')renderAlbums();else if(view==='gallery')renderGallery();else renderPlay();}
  function navigate(next){closeModal();view=next;render();window.scrollTo(0,0);}
  function start(level,mode,day){closeModal();state.current=S.newSession(level,mode||'story',day||'');selected=0;view='play';persist();render();window.scrollTo(0,0);}
  function resume(){closeModal();if(state.current){view='play';selected=0;render();if(R.complete(lookup(state.current.levelId,state.current.mode,state.current.day),state.current.grid))finish();}else start(suggested());window.scrollTo(0,0);}
  function put(value, index){var level=lookup(state.current.levelId,state.current.mode,state.current.day);var next=S.setCell(state.current,level,index,value);if(next===state.current)return;state.current=next;persist();renderPlay();if(R.complete(level,next.grid))finish();}
  function finish(){var level=lookup(state.current.levelId,state.current.mode,state.current.day),result=S.settle(state,state.current,level,undefined,lookup);state=result.state;persist();flush();showSuccess(level);}
  function modal(content,type){if(!modalType)focusBefore=document.activeElement;modalType=type;document.body.classList.add('modal-open');modalRoot.innerHTML='<div class="modal-shade"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">'+content+'</section></div>';var m=modalRoot.querySelector('.modal');m.scrollTop=0;var b=m.querySelector('button');if(b)b.focus();}
  function modalHead(eyebrow){return '<div class="modal-top"><div class="eyebrow">'+eyebrow+'</div><button class="modal-close" data-action="close-modal" aria-label="关闭">×</button></div>';}
  function closeModal(){if(modalType==='tutorial')readTutorial();modalType='';modalRoot.innerHTML='';document.body.classList.remove('modal-open');if(focusBefore&&document.contains(focusBefore)){focusBefore.focus();}else{var b=app.querySelector('button');if(b)b.focus();}}
  function readTutorial(){try{if(storage)storage.setItem(S.TUTORIAL_KEY,'1');}catch(error){}}
  function tutorial(){tutorialStep=0;showTutorial();}
  function showTutorial(){var t=tutorialText[tutorialStep];modal(modalHead('DARKROOM GUIDE · 0'+(tutorialStep+1)+' / 03')+'<h2 id="modal-title">'+t[0]+'</h2><img class="tutorial-img" src="./assets/tutorial-'+tutorialStep+'.svg" alt="首张照片的真实'+['初始状态：边缘显示行列数字，所有格未知','合法操作：一个格被填黑，橙框标记它的位置','完成状态：所有格都已填黑或标留白，满足全部线索'][tutorialStep]+'"><p>'+t[1]+'</p><div class="tutorial-dots">'+[0,1,2].map(function(i){return '<span class="'+(i===tutorialStep?'active':'')+'"></span>';}).join('')+'</div><div class="tutorial-nav"><button class="skip" data-action="skip-tutorial">跳过</button><button class="primary" data-action="next-tutorial">'+(tutorialStep===2?'开始显影 →':'下一张 →')+'</button></div>','tutorial');}
  function showHint(){var l=lookup(state.current.levelId,state.current.mode,state.current.day);hintData=R.hint(l,state.current.grid);hintStage=0;hintModal();}
  function hintModal(){var h=hintData;if(!h){toast('每一格都已确定，检查完成状态。');return;}var firstText=h.kind==='row'||h.kind==='column'?'先看看第 '+(h.line+1)+(h.kind==='row'?' 行':' 列')+'。把连续段放进剩余空间，比较它们可能的位置。':h.kind==='conflict'?h.text:'这一次需要把几条交叉线索放在一起推演。';var body=modalHead('A GENTLE NUDGE')+'<h2 id="modal-title">'+(h.kind==='conflict'?'这束光，似乎偏了':'先看这一条线')+'</h2><p>'+esc(hintStage?h.text:firstText)+'</p>';
    if(hintStage===0)body+='<div class="hint-detail">先试着读线索。需要时，再展开具体推理。</div><button class="primary" data-action="hint-detail">展开推理 →</button><button class="modal-secondary" data-action="close-modal">我先想一想</button>';
    else{body+='<div class="hint-detail">'+esc(h.detail||h.text)+'</div>';if(h.kind!=='conflict'&&Number.isInteger(h.index)&&h.index>=0&&(h.value===1||h.value===2)){var l=lookup(state.current.levelId,state.current.mode,state.current.day);body+='<span class="hint-coord">第 '+(Math.floor(h.index/l.width)+1)+' 行 · 第 '+(h.index%l.width+1)+' 列</span><button class="primary" data-action="hint-apply">帮我落这一笔 '+(h.value===1?'■':'×')+'</button>';}body+='<button class="modal-secondary" data-action="close-modal">回到底片继续</button>';}
    modal(body,'hint');
  }
  function showSuccess(level){var s=state.current, records=recordsFor(level.id);modal(modalHead('DEVELOPED WITH CARE')+'<h2 id="modal-title">这束光，显影了。</h2><div class="success-photo">'+V.photo(level,chapterFor(level).color,false)+'<small>'+esc(level.title)+' · NO. '+String(levelNumber(level)).padStart(2,'0')+'</small></div><p>'+esc(level.caption)+'</p><div class="success-stats"><span><b>'+s.moves+'</b>落笔次数</span><span><b>'+s.hints+'</b>展开提示</span><span><b>'+records.length+'</b>本片完成</span></div><span class="badge">'+(s.hints===0?'✧ 获得独立印记':'✓ 照片已完整入册')+'</span><button class="primary" data-action="next-level">'+(s.mode==='daily'?'回暗房看看':'翻开下一张 →')+'</button><button class="modal-secondary" data-action="gallery">查看我的图鉴</button>','success');}
  function showPhoto(level){var records=recordsFor(level.id),best=Math.min.apply(null,records.map(function(r){return r.hints;}));modal(modalHead('A MOMENT IN YOUR ALBUM')+'<h2 id="modal-title">'+esc(level.title)+'</h2><div class="success-photo">'+V.photo(level,chapterFor(level).color,false)+'<small>'+esc(chapterFor(level).title)+'</small></div><p>'+esc(level.caption)+'</p><div class="hint-detail">完成 '+records.length+' 次 · 最少使用 '+best+' 次提示<br>最近一次：'+esc(records[records.length-1].completedAt.slice(0,10))+'</div><button class="primary" data-action="replay" data-id="'+level.id+'">再显影一次 →</button><button class="modal-secondary" data-action="close-modal">继续翻阅</button>','photo');}
  function settings(){modal(modalHead('THE DARKROOM HANDBOOK')+'<h2 id="modal-title">让显影慢一点。</h2><p>行列数字表示按顺序排列的连续显影段。段与段之间至少一格留白。每格都要明确标记，数字全部吻合才完成。</p><label class="settings-row"><span>点格只选择，用大按钮落笔</span><input id="precise-setting" type="checkbox"'+(precise?' checked':'')+'></label><p>键盘：方向键选格，空格落笔；F 显影、X 留白、E 擦除。Ctrl / ⌘ + Z 撤销。</p><button class="primary" data-action="tutorial">重看三张图片教程</button><button class="modal-secondary" data-action="sources">规则、素材与许可</button><p class="source-copy">进度保存在本地浏览器。无计时惩罚、无体力限制。每日照片按本地日期从同一组 60 张已验证照片轮换复拍。</p>','settings');}
  function sources(){modal(modalHead('RULES & CREDITS')+'<h2 id="modal-title">这间暗房的来处</h2><p>原型：Pattern / Nonogram（数织）。规则参考 Simon Tatham’s Portable Puzzle Collection。延续 Ten Realms Arcade 的《雾窗显影》三态玩法；本独立版重新编写界面、关卡、规则与存档模块。</p><p>60 个手绘像素图案，独立求解器从线索搜索至第二解上限，逐一验证唯一。主线没有用同题镜像、旋转或改名扩充。题目按尺寸和线索推理组织，并不宣称每相邻一关难度严格增加。</p><p>暗房插画、相纸图标、主题、文案与布局为本项目原创。教程图片由真实规则引擎生成。未使用外部在线资源。</p><p class="source-copy">参考：chiark.greenend.org.uk/~sgtatham/puzzles/doc/pattern.html<br>原项目：Ten Realms Arcade，MIT License，Copyright (c) 2026 Ten Realms Arcade contributors。完整许可随离线包 assets/license.json 提供。MIT 允许使用、修改和再分发，但必须保留版权与许可声明；软件按原样提供。</p><button class="primary" data-action="close-modal">回到暗房</button>','sources');}
  function handle(action,target){
    if(action==='home'||action==='albums'||action==='gallery')navigate(action);
    else if(action==='gallery-prev'||action==='gallery-next'){galleryPage+=action==='gallery-next'?1:-1;navigate('gallery');}
    else if(action==='chapter'){chapterIndex=Number(target.dataset.index);navigate('albums');}
    else if(action==='continue')resume();
    else if(action==='daily'){var day=dayKey();if(state.current&&state.current.mode==='daily'&&state.current.day===day)resume();else start(L.daily(day),'daily',day);}
    else if(action==='level'){var l=L.get(target.dataset.id);if(done(l.id))showPhoto(l);else start(l,'story');}
    else if(action==='replay')start(L.get(target.dataset.id),'replay');
    else if(action==='back'){chapterIndex=L.chapters.indexOf(chapterFor(lookup(state.current.levelId,state.current.mode,state.current.day)));navigate('albums');}
    else if(action==='tool'){tool=Number(target.dataset.value);renderPlay();}
    else if(action==='apply'){put(tool,selected);}
    else if(action==='undo'){var level=lookup(state.current.levelId,state.current.mode,state.current.day);state.current=S.undo(state.current,level);persist();renderPlay();}
    else if(action==='restart')modal(modalHead('A FRESH NEGATIVE')+'<h2 id="modal-title">重新洗这张底片？</h2><p>本张未完成的落笔会清空。已经入册的照片和印记都会保留。</p><button class="primary" data-action="confirm-restart">重新开始</button><button class="modal-secondary" data-action="close-modal">继续这一张</button>','restart');
    else if(action==='confirm-restart'){var s=state.current;start(lookup(s.levelId,s.mode,s.day),s.mode,s.day);}
    else if(action==='settings')settings();else if(action==='sources')sources();
    else if(action==='tutorial')tutorial();else if(action==='close-modal')closeModal();
    else if(action==='skip-tutorial'){closeModal();if(view!=='play')resume();}
    else if(action==='next-tutorial'){if(tutorialStep<2){tutorialStep++;showTutorial();}else{closeModal();if(view!=='play')resume();}}
    else if(action==='hint')showHint();
    else if(action==='hint-detail'){state.current=S.addHint(state.current);persist();hintStage=1;hintModal();}
    else if(action==='hint-apply'){var h=hintData;selected=h.index;closeModal();put(h.value,h.index);}
    else if(action==='next-level'){var s=state.current,l=lookup(s.levelId,s.mode,s.day),index=levelNumber(l);if(s.mode==='daily'||index>=L.levels.length)navigate('home');else start(L.levels[index],'story');}
  }
  document.addEventListener('click',function(e){var target=e.target.closest('[data-action]');if(target){handle(target.dataset.action,target);return;}var cell=e.target.closest('[data-cell]');if(cell&&view==='play'&&!modalType){selected=Number(cell.dataset.cell);if(precise)renderPlay();else put(state.current.grid[selected]===tool?0:tool,selected);}});
  document.addEventListener('change',function(e){if(e.target.id==='precise-setting'){precise=e.target.checked;try{if(storage)storage.setItem(S.PREFIX+'precise',precise?'1':'0');}catch(error){}return;}if(e.target.id==='row-select'||e.target.id==='col-select'){var l=lookup(state.current.levelId,state.current.mode,state.current.day);selected=Number(document.getElementById('row-select').value)*l.width+Number(document.getElementById('col-select').value);renderPlay();document.getElementById(e.target.id).focus();}});
  document.addEventListener('keydown',function(e){
    if(modalType){if(e.key==='Escape'){e.preventDefault();closeModal();}else if(e.key==='Tab'){var elements=Array.prototype.slice.call(modalRoot.querySelectorAll('button,input,select,[tabindex="0"]')).filter(function(el){return !el.disabled;});var first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
    if(view!=='play'||e.target.tagName==='SELECT'||e.target.tagName==='INPUT')return;
    if(e.target.hasAttribute('data-cell'))selected=Number(e.target.getAttribute('data-cell'));
    var l=lookup(state.current.levelId,state.current.mode,state.current.day),r=Math.floor(selected/l.width),c=selected%l.width,moved=true;
    if(e.key==='ArrowLeft')c=Math.max(0,c-1);else if(e.key==='ArrowRight')c=Math.min(l.width-1,c+1);else if(e.key==='ArrowUp')r=Math.max(0,r-1);else if(e.key==='ArrowDown')r=Math.min(l.height-1,r+1);else moved=false;
    if(moved){e.preventDefault();selected=r*l.width+c;renderPlay();document.querySelector('[data-cell="'+selected+'"]').focus();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();handle('undo');}
    else if(e.target.classList.contains('cell')&&(e.key===' '||e.key==='Enter')){e.preventDefault();put(tool,selected);var node=document.querySelector('[data-cell="'+selected+'"]');if(node&&!modalType)node.focus();}
    else if(['f','x','e'].indexOf(e.key.toLowerCase())>=0){tool=e.key.toLowerCase()==='f'?1:e.key.toLowerCase()==='x'?2:0;renderPlay();}
  });
  function resize(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');sizeBoard();}
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',function(){if(document.hidden)persist();else flush();});
  try{precise=storage&&storage.getItem(S.PREFIX+'precise')==='1';}catch(error){}
  resize();render();flush();
  var seen=false;try{seen=storage&&storage.getItem(S.TUTORIAL_KEY)==='1';}catch(error){}
  if(!seen)tutorial();
}());
