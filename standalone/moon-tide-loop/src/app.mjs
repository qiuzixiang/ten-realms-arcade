import { LEVELS, CHAPTERS, getLevel, getDailyLevel, getSeedLevel } from './levels.mjs';
import { createState, applyEdge, inspect, checkWin } from './engine.mjs';
import { getHint } from './hint.mjs';
import { createStore } from './storage.mjs';
import { boardSvg, cellEdges, escapeHtml } from './render.mjs';
import { cellAt, gestureEdge, directValue } from './input.mjs';
const $=s=>document.querySelector(s), app=$('#app'), modalRoot=$('#modal-root');
let warning='', run=null, level=null, selected=0, brush=1, view='home', chapter=1, hintedEdge=null, modal=null, returnFocus=null, noticeTimer=null;
let inputMode='gesture',drag=null,suppressBoardClickUntil=0;
const store=createStore({levels:LEVELS,getLevel,checkWin,onWarning:message=>{warning=message;}});
const names=['上','右','下','左'], arrows=['↑','→','↓','←'];
const dateKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const chapterName=id=>CHAPTERS.find(c=>c.id===id).title;
function button(action,text,css,extra){return '<button type="button" data-action="'+action+'" class="'+(css||'')+'" '+(extra||'')+'>'+text+'</button>';}
function toast(text){const n=$('#notice');n.textContent=text;n.classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.classList.remove('visible'),2800);}
function warningHtml(){return warning?'<div class="storage-warning">'+escapeHtml(warning)+'</div>':'';}
function save(){const saved=store.saveRun(run);if(saved)run=saved;}
function deliver(){if(window.moonTideHost&&typeof window.moonTideHost.complete==='function')store.flushOutbox(payload=>window.moonTideHost.complete(payload));}
function render(){if(view==='play')renderPlay();else if(view==='chapter')renderChapter();else renderHome();}
function renderHome(){
  view='home';const p=store.getProgress(),saved=store.loadRun();
  app.innerHTML='<main class="app-shell"><header class="topbar"><div class="brand"><img src="./assets/icon.svg" alt="">月潮回环</div>'+button('tutorial','玩法手记','quiet')+'</header>'+warningHtml()+'<section class="hero"><div class="hero-copy"><span class="eyebrow">A LITTLE MOON, A SINGLE LOOP</span><h1>月潮回环</h1><p>循着数字，织一圈月光。<br>让每一座珊瑚岛，回到潮汐里。</p><div class="hero-tag">72 道潮汐谜题　·　6 座月下小岛</div></div></section><div class="home-grid"><section class="home-main"><div class="section-top"><h2>六岛潮汐图</h2><span>'+p.totalCompleted+' / 72 已点亮</span></div><div class="island-list">'+CHAPTERS.map(c=>{const n=p.chapterCounts[c.id]||0;return button('chapter','<span class="island-num">ISLAND '+String(c.id).padStart(2,'0')+'</span><strong>'+c.title+'</strong><small>'+c.focus+' · '+n+'/12'+(n===12?'　✧':'')+'</small><div class="chapter-progress"><span style="width:'+(n/12*100)+'%"></span></div>','island-card','data-id="'+c.id+'"');}).join('')+'</div></section><aside class="home-side">'+(saved&&!saved.done?button('resume','<span>继续潮汐手记<br><small>'+escapeHtml(getLevel(saved.levelId).title)+'</small></span><span>↗</span>','continue-button'):'')+'<section class="daily-card"><span class="eyebrow">'+dateKey().replace(/-/g,' / ')+'</span><span class="daily-moon" aria-hidden="true"></span><h2>每日潮汐</h2><p>今日的一页月海练习。<br>来自已验证题库的每日变式。</p>'+button('daily','赴今日之约 ↗','primary')+'</section>'+button('seed','瓶中潮汐　→','secondary','style="width:100%"')+'<p class="little-note">写下一个词，带走同一页潮汐。<br>种子模式将题库旋转、镜像后复玩。</p></aside></div><footer class="footer-row"><span>不计时 · 不扣分 · 慢慢来</span>'+button('rules','规则与来源','quiet')+'</footer></main>';
}
function renderChapter(){const c=CHAPTERS[chapter-1],p=store.getProgress(),n=p.chapterCounts[chapter]||0;
 app.innerHTML='<main class="app-shell"><header class="topbar">'+button('home','← 六岛潮汐图','back')+'<span class="eyebrow">ISLAND '+String(chapter).padStart(2,'0')+'</span>'+button('tutorial','玩法','quiet')+'</header><section class="chapter-header"><span class="eyebrow">'+c.focus+'</span><h1>'+c.title+'</h1><p>'+c.subtitle+'。每一页都可以自由开始。</p></section><div class="collection">✧　'+(n===12?'已收藏「'+c.collectible+'」':'点亮本岛 12 页，收藏「'+c.collectible+'」')+'　'+n+'/12</div><section class="level-grid">'+LEVELS.filter(l=>l.chapter===chapter).map(l=>button('level','<span class="level-symbol">'+(p.independent[l.id]?'✧':p.completed[l.id]?'✓':'·')+'</span><strong>'+String(l.number).padStart(2,'0')+'</strong><span>'+l.width+'×'+l.height+' · '+(p.independent[l.id]?'独立点亮':p.completed[l.id]?'已点亮':l.difficulty)+'</span>','level-card'+(p.completed[l.id]?' completed':''),'data-id="'+l.id+'"')).join('')+'</section><footer class="footer-row"><span>✓ 已完成　✧ 未用提示独立完成</span>'+button('home','返回海图','quiet')+'</footer></main>';
}
function start(id,mode,resume){closeModal(false);level=getLevel(id);if(!level){toast('这页潮汐暂不可用');return;}run=resume||store.createRun(id,mode||'campaign');if(!run)return;selected=0;brush=1;hintedEdge=null;view='play';render();window.scrollTo(0,0);}
function renderPlay(){const report=inspect(level,run.edges),remaining=report.clueErrors.length,known=level.clues.filter(n=>n!==null).length;
 let status=inputMode==='gesture'?'点边画线，再点擦除；也可从格内向一侧轻划。':'点选数字格，再用下方方向按钮画边。';
 if(run.done)status='✧ 数字全部吻合，唯一月潮环已闭合。';
 else if(report.overflow.length)status='! 有数字周围的线过多。再点多余的线，或用「擦除」修改。';
 else if(report.branchVertices.length)status='! 出现了岔路。一个角点最多经过两条潮线。';
 else if(report.lineCount)status='数字已吻合 '+(known-remaining)+'/'+known+' · '+report.lineCount+' 条潮线。继续延伸，避免提前闭成小环。';
 const totalW=level.width*80+32,totalH=level.height*80+32;
 app.innerHTML='<main class="game-shell"><header class="topbar">'+button('home','← 海图','back')+'<span class="game-brand">月 潮 回 环</span>'+button('tutorial','? 玩法','quiet')+'</header>'+warningHtml()+'<section class="game-heading"><div><span class="eyebrow">'+(run.mode==='campaign'?'ISLAND '+String(level.chapter).padStart(2,'0')+' / '+chapterName(level.chapter):run.mode==='daily'?'DAILY TIDE · '+level.seed:'BOTTLED TIDE')+'</span><h1>'+escapeHtml(level.title)+'</h1></div><div class="level-meta">'+level.width+'×'+level.height+' · '+level.difficulty+'<br>'+(run.mode==='campaign'?'潮汐 '+String(level.number).padStart(2,'0')+' / 72':escapeHtml(level.seed))+'</div></section><div class="game-body"><div class="game-stage"><div class="board-wrap '+(inputMode==='gesture'?'gesture-board':'')+'">'+boardSvg(level,run.edges,{selectedCell:inputMode==='precise'?selected:undefined,highlightEdge:hintedEdge})+level.clues.map((n,i)=>'<button type="button" class="cell-hit" data-action="cell" data-cell="'+i+'" aria-label="第'+(Math.floor(i/level.width)+1)+'行第'+(i%level.width+1)+'格，'+(n===null?'无线索':'数字'+n)+'" aria-pressed="'+(i===selected)+'" style="left:'+((16+i%level.width*80)/totalW*100)+'%;top:'+((16+Math.floor(i/level.width)*80)/totalH*100)+'%;width:'+(80/totalW*100)+'%;height:'+(80/totalH*100)+'%"></button>').join('')+'</div></div><div class="game-control"><div class="selection-caption"><strong>'+(inputMode==='gesture'?'点边即画 · 再点擦除':'已选 '+(Math.floor(selected/level.width)+1)+' 行 '+(selected%level.width+1)+' 格')+'</strong>'+button('input-mode',inputMode==='gesture'?'切换精确模式':'返回手势画线','input-switch','aria-pressed="'+(inputMode==='precise')+'"')+'</div><div class="brush-bar" role="group" aria-label="画边工具">'+[1,-1,0].map((v,i)=>button('brush',['━ 画线','× 排除','· 擦除'][i],(brush===v?'active ':'')+['line','exclude','erase'][i],'data-value="'+v+'" aria-pressed="'+(brush===v)+'"')).join('')+'</div><div class="direction-bar '+(inputMode==='gesture'?'is-hidden':'')+'">'+names.map((n,i)=>{const value=run.edges[cellEdges(level,selected)[i]];return button('edge','<b>'+arrows[i]+'</b>'+n+'边'+(value===1?' ━':value===-1?' ×':''),'','data-dir="'+i+'" aria-label="'+n+'边"'+(run.done?' disabled':''));}).join('')+'</div><div class="status-line" role="status">'+status+'</div><div class="tools">'+button('undo','↶ 撤销','','aria-label="撤销"'+(run.actions.length?'':' disabled'))+button('restart','↻ 重开','','aria-label="重开"')+button('hint',run.done?'✧ 赏月':'✧ 听潮提示','','aria-label="'+(run.done?'查看通关':'听潮提示')+'"')+'</div></div></div></main>';
}
function commit(edge,value){if(!run||run.done)return;hintedEdge=null;const state={edges:run.edges,history:[],moves:run.actions.length,hintsUsed:run.hintsUsed};const next=applyEdge(level,state,edge,value);if(next===state){toast('这条边已是当前状态');return;}run.actions.push({edge,value});save();if(checkWin(level,run.edges)){const event=store.completeRun(run,{moves:run.actions.length,hintsUsed:run.hintsUsed});run=store.loadRun()||run;run.done=true;render();deliver();showWin(event);}else renderPlay();}
function showWin(){const p=store.getProgress(),c=CHAPTERS[level.chapter-1],collected=p.collectedChapters.indexOf(level.chapter)>=0;
 showModal('win','<span class="big-symbol">☾</span><span class="eyebrow">THE TIDE HAS COME HOME</span><h2>这一圈月光，回来了</h2><p>全部数字吻合，所有潮线连成一个没有分岔的闭环。</p><p class="hint-target">'+(run.hintsUsed?'借一束提示，也到达了海岸。':'✧ 这页由你独立点亮。')+(run.mode==='campaign'?'<br>'+chapterName(level.chapter)+' · '+(p.chapterCounts[level.chapter]||0)+'/12'+(collected?'　「'+c.collectible+'」已收藏':''):'')+'</p><div class="modal-actions">'+button('close','留在月下','secondary')+button('next','下一页潮汐','primary')+'</div>');
}
const tutorialCards=[
 {title:'数字，是这一格的潮汐',body:'每个数字表示这格四条边中，要画几条线。0 的周围一条也不画。虚点是未定的边，× 只是排除笔记。',alt:'首关3乘3初始棋盘，中心数字0，边角数字2，其余数字1，没有选线。'},
 {title:'点一下，落下一条月光',body:'直接点一段边的中间就能画线，再点擦除。也可以从格子里向上、右、下、左轻划。角点不猜边；想稳稳操作，切换「精确模式」使用方向按钮。',alt:'同一首关，只画了左上格的上边，这是一次合法动作。'},
 {title:'所有潮线，只绕一个环',body:'数字全都满足，经过的角点各有两条线，而且所有线首尾相接成唯一闭环，就点亮这一页。两个小环不能通关。',alt:'真实首关完成状态，12条外边组成唯一闭环，全部9个数字满足。'}
];
function showTutorial(index){const c=tutorialCards[index];showModal('tutorial','<div class="modal-top"><span class="eyebrow">潮汐手记　0'+(index+1)+' / 03</span>'+button('skip','跳过','quiet')+'</div><h2>'+c.title+'</h2><img class="tutorial-image" src="./assets/tutorial-'+(index+1)+'.svg" alt="'+c.alt+'"><p>'+c.body+'</p><div class="tutorial-dots" aria-hidden="true">'+tutorialCards.map((_,i)=>'<span class="'+(i===index?'active':'')+'"></span>').join('')+'</div><div class="modal-actions">'+(index?button('tutorial-prev','上一张','secondary','data-index="'+(index-1)+'"'):'')+button(index===2?'tutorial-done':'tutorial-next',index===2?'去织一圈月光':'下一张 →','primary','data-index="'+(index+1)+'"')+'</div>');}
function showRules(){showModal('rules','<div class="modal-top"><span class="eyebrow">玩法与出处</span>'+button('close','关闭','quiet')+'</div><h2>慢慢织，潮汐会回来</h2><div class="rule-item"><strong>1. 数字计边</strong><p>线索等于四边中实线的数量。空白格没有数字约束。× 是你的笔记，既不计为线，也不阻止正确闭环获胜。</p></div><div class="rule-item"><strong>2. 角点不分岔</strong><p>完成时，每个角点经过 0 或 2 条线；没有岔路，也没有悬空的线头。</p></div><div class="rule-item"><strong>3. 整体只有一环</strong><p>至少画出一条边，全部实线连成同一个闭环。所有数字满足也不能留下两个分开的环。</p></div><div class="rule-item"><strong>操作与收藏</strong><p>默认直接点边画线，再点擦除；从格内向一侧轻划也能操作。角点与斜划不猜边。精确模式保留选格和方向按钮。键盘方向键选格，W D S A 画对应边；1 画线、2 排除、3 擦除，Z 撤销。提示不扣分；未用提示通关记一枚 ✧，每岛 12 页都点亮后收藏海物。重玩不会重复领取同一奖励。</p></div><p>72 个主线题面均已由独立搜索核验唯一解。每日与瓶中模式为题库的旋转、镜像变式，不代表无限新题。</p><p class="sources">规则：Loopy / Slitherlink。参考 Simon Tatham 的 Portable Puzzle Collection（MIT），www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/loopy.html；中文参考 ebnbin/puzzles（MIT）。前身「月潮结界」，本版规则引擎、生成题库、界面与矢量美术重新实现。© 2026 Ten Realms Arcade contributors · MIT。</p>'+button('tutorial','重看图片教程','primary','style="width:100%"'));}
function showModal(kind,html){clearTimeout(noticeTimer);$('#notice').classList.remove('visible');if(!modal){returnFocus=document.activeElement;document.body.style.overflow='hidden';}modal=kind;modalRoot.innerHTML='<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="'+(kind==='tutorial'?'图片教程':kind==='win'?'潮汐完成':'月潮手记')+'">'+html+'</section></div>';const first=modalRoot.querySelector('button,input');if(first)first.focus();}
function closeModal(restore){const was=modal;modal=null;modalRoot.innerHTML='';document.body.style.overflow='';if(restore!==false&&returnFocus&&document.contains(returnFocus))returnFocus.focus();returnFocus=null;return was;}
function hint(){if(run.done){showWin();return;}run.hintsUsed=(run.hintsUsed||0)+1;save();const h=getHint(level,{edges:run.edges,hintsUsed:run.hintsUsed});let action=h.action;hintedEdge=action?action.edge:null;if(action){const idx=level.clues.findIndex((_,i)=>cellEdges(level,i).indexOf(action.edge)>=0);if(idx>=0)selected=idx;renderPlay();}
 showModal('hint','<div class="modal-top"><span class="eyebrow">听一听潮汐的理由</span>'+button('close','关闭','quiet')+'</div><h2>'+escapeHtml(h.title||'从这里继续')+'</h2><p>'+escapeHtml(h.explanation)+'</p>'+(action?'<p class="hint-target">已定位到 '+(Math.floor(selected/level.width)+1)+' 行 '+(selected%level.width+1)+' 格的'+names[cellEdges(level,selected).indexOf(action.edge)]+'边。</p>':'')+'<div class="modal-actions">'+button('close','我来试试','secondary')+(action?button('hint-apply','帮我这一步','primary','data-edge="'+action.edge+'" data-value="'+action.value+'"'):'')+'</div>');
}
function act(action,b){switch(action){
 case 'home':closeModal(false);view='home';renderHome();window.scrollTo(0,0);break;
 case 'chapter':chapter=Number(b.dataset.id);view='chapter';renderChapter();window.scrollTo(0,0);break;
 case 'level':start(b.dataset.id,'campaign');break;
 case 'resume':{const saved=store.loadRun();if(saved)start(saved.levelId,saved.mode,saved);break;}
 case 'daily':start(getDailyLevel(dateKey()).id,'daily');break;
 case 'seed':showModal('seed','<div class="modal-top"><span class="eyebrow">BOTTLED TIDE</span>'+button('close','关闭','quiet')+'</div><h2>装一页潮汐进瓶子</h2><p>输入一个词，同样的词会遇见同一道题。此模式使用已验证题库的旋转、镜像变式。</p><label for="seed-input" class="muted">瓶中记号（最多 32 字）</label><input id="seed-input" maxlength="32" value="月光" autocomplete="off"><div class="modal-actions">'+button('seed-start','开启瓶中潮汐','primary')+'</div>');break;
 case 'seed-start':start(getSeedLevel($('#seed-input').value).id,'seed');break;
 case 'input-mode':inputMode=inputMode==='gesture'?'precise':'gesture';hintedEdge=null;renderPlay();break;
 case 'cell':selected=Number(b.dataset.cell);hintedEdge=null;renderPlay();break;
 case 'brush':brush=Number(b.dataset.value);renderPlay();break;
 case 'edge':commit(cellEdges(level,selected)[Number(b.dataset.dir)],brush);break;
 case 'undo':if(run.actions.length){run.actions.pop();save();renderPlay();toast('已撤回上一步');}break;
 case 'restart':showModal('restart','<span class="eyebrow">重新听一次潮声</span><h2>重开这一页潮汐？</h2><p>清空本局画线与笔记，重新开始；已获得的岛屿收藏会保留。</p><div class="modal-actions">'+button('close','继续这局','secondary')+button('restart-confirm','重新开始','primary')+'</div>');break;
 case 'restart-confirm':start(level.id,run.mode);toast('新的一页潮汐已开始');break;
 case 'hint':hint();break;
 case 'hint-apply':{const e=Number(b.dataset.edge),v=Number(b.dataset.value);closeModal(false);commit(e,v);break;}
 case 'tutorial':showTutorial(0);break;
 case 'tutorial-next':case 'tutorial-prev':showTutorial(Number(b.dataset.index));break;
 case 'skip':case 'tutorial-done':store.markTutorialSeen('2');closeModal();break;
 case 'rules':showRules();break;
 case 'close':closeModal();break;
 case 'next':{const next=run.mode==='campaign'?LEVELS[LEVELS.findIndex(l=>l.id===level.id)+1]:null;if(next)start(next.id,'campaign');else{closeModal(false);renderHome();}break;}
}}
document.addEventListener('click',event=>{const b=event.target.closest('button[data-action]');if(b&&!b.disabled){if(inputMode==='gesture'&&b.dataset.action==='cell'&&event.detail>0&&Date.now()<suppressBoardClickUntil)return;act(b.dataset.action,b);}});
function boardPoint(board,event){const r=board.getBoundingClientRect();return {x:(event.clientX-r.left)/r.width*(level.width*80+32),y:(event.clientY-r.top)/r.height*(level.height*80+32)};}
document.addEventListener('pointerdown',event=>{
 const board=event.target.closest('.gesture-board');
 if(!board||modal||run.done||event.isPrimary===false||event.button!==0||drag)return;
 const p=boardPoint(board,event);drag={board,id:event.pointerId,x:p.x,y:p.y,cell:cellAt(level,p.x,p.y),edge:null};
 if(board.setPointerCapture)board.setPointerCapture(event.pointerId);
 event.preventDefault();
});
document.addEventListener('pointermove',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 const edge=gestureEdge(level,drag,boardPoint(drag.board,event));
 if(edge!==drag.edge){drag.edge=edge;const svg=drag.board.querySelector('svg');svg.outerHTML=boardSvg(level,run.edges,{highlightEdge:edge});}
});
document.addEventListener('pointerup',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 const old=drag,edge=gestureEdge(level,old,boardPoint(old.board,event));drag=null;
 suppressBoardClickUntil=Date.now()+500;
 if(old.board.hasPointerCapture&&old.board.hasPointerCapture(event.pointerId))old.board.releasePointerCapture(event.pointerId);
 if(edge!==null){const cell=level.clues.findIndex((_,i)=>cellEdges(level,i).indexOf(edge)>=0);if(cell>=0)selected=cell;commit(edge,directValue(run.edges[edge],brush));}
 else{renderPlay();toast('从格内向一侧轻划，或点边的中间');}
 event.preventDefault();
});
document.addEventListener('pointercancel',event=>{if(drag&&drag.id===event.pointerId){drag=null;renderPlay();}});
document.addEventListener('keydown',event=>{
 if(modal){if(event.key==='Escape'){if(modal==='tutorial')store.markTutorialSeen('2');closeModal();event.preventDefault();}else if(event.key==='Tab'){const focusable=Array.from(modalRoot.querySelectorAll('button:not(:disabled),input'));const i=focusable.indexOf(document.activeElement);if(event.shiftKey&&i<=0){focusable[focusable.length-1].focus();event.preventDefault();}else if(!event.shiftKey&&i===focusable.length-1){focusable[0].focus();event.preventDefault();}}return;}
 if(view!=='play'||event.ctrlKey||event.metaKey||event.altKey)return;
 let handled=true;const key=event.key.toLowerCase();if(['arrowright','arrowleft','arrowup','arrowdown','w','a','s','d'].indexOf(key)>=0)inputMode='precise';
 if(key==='arrowright')selected=Math.min(level.clues.length-1,selected+1);
 else if(key==='arrowleft')selected=Math.max(0,selected-1);
 else if(key==='arrowdown')selected=Math.min(level.clues.length-1,selected+level.width);
 else if(key==='arrowup')selected=Math.max(0,selected-level.width);
 else if(['w','d','s','a'].indexOf(key)>=0){commit(cellEdges(level,selected)[['w','d','s','a'].indexOf(key)],brush);event.preventDefault();return;}
 else if(key==='1')brush=1;else if(key==='2')brush=-1;else if(key==='3')brush=0;else if(key==='z'){act('undo',{});event.preventDefault();return;}else handled=false;
 if(handled){event.preventDefault();renderPlay();}
});
const existing=store.loadRun();
if(!store.hasSeenTutorial('2')){start(existing?existing.levelId:LEVELS[0].id,existing?existing.mode:'campaign',existing);showTutorial(0);}else if(existing&&!existing.done)start(existing.levelId,existing.mode,existing);else renderHome();
deliver();
