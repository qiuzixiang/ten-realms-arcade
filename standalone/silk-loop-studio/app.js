(function(){
'use strict';
const E=window.SilkEngine,S=window.SilkSession,V=window.SilkView,L=window.SilkLevels.levels,chapters=window.SilkLevels.chapters;
const $=id=>document.getElementById(id),main=$('main'),modal=$('modal'),body=$('modal-body');
let data,store,page='home',selection={axis:'row',index:0},hintStage=0,focusValue=null,notice='',busy=false,generation=0,timer=null,previousFocus=null,tutorialStep=0,replayState=null,audio=null,persistQueue=Promise.resolve();
const level=()=>L.find(l=>l.id===data.run.levelId);
const count=()=>Object.keys(data.receipts).length;
const completed=id=>!!data.receipts[id];
function bind(id,fn){const el=$(id);if(el)el.addEventListener('click',fn);}
function button(id,text,cls){return '<button id="'+id+'"'+(cls?' class="'+cls+'"':'')+'>'+text+'</button>';}
function sound(){if(!data.settings.sound)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!audio)audio=new AC();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(420,audio.currentTime);o.frequency.exponentialRampToValueAtTime(180,audio.currentTime+.10);g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.13);}catch(e){}}
function persist(){persistQueue=persistQueue.then(async()=>{const ok=await S.flush(data,store.write,window.SilkCompletionHost);$('storage-warning').hidden=ok;return ok;});return persistQueue;}
function cancel(){generation++;busy=false;if(timer){clearTimeout(timer);timer=null;}}
function navigate(to){cancel();page=to;render();window.scrollTo(0,0);main.focus();}
function start(l,practice){cancel();data.run=S.fresh(l,practice);selection={axis:'row',index:0};hintStage=0;focusValue=null;notice='';persist();navigate('game');}
function switchPage(to){persist();navigate(to);}
function render(){
 document.body.classList.toggle('reduced',!data.settings.motion);
 const focusId=document.activeElement&&document.activeElement.id;
 if(page==='home')home();else if(page==='chapters')chapterPage();else if(page==='collection')collection();else if(page==='settings')settings();else game();
 if(focusId&&$(focusId))$(focusId).focus();
}
function heading(title,sub){return '<div class="page-heading"><div><p class="eyebrow">SILK LOOP / 织台手记</p><h1>'+title+'</h1><p>'+sub+'</p></div>'+button('back-home','首页','quiet')+'</div>';}
function home(){
 main.innerHTML='<section class="home"><img class="hero-art" src="./assets/atelier.svg" alt="奶白织台上，杏黄、莓红和群青的几何样布与纤维流苏"><div class="home-copy"><p class="eyebrow">一间小工坊 · 一幅慢慢归齐的绸</p><h1>经纬相遇，<span>彩绸回环。</span></h1><p class="intro">没有空位，整行整列一起走。<br>让十六枚纸签归回 1—16 的位置，<br>把错开的织纹重新织成一幅。</p>'+button('continue',E.solved(S.board(data.run))?'看看下一幅 →':'继续第 '+level().number+' 幅 →','primary')+'<div class="home-meta"><span><strong>'+count()+' / 48</strong>已归序的样布</span><span><strong>6</strong>从单行到全幅</span></div></div></section><nav class="menu-cards" aria-label="工坊导航">'+button('chapters','<strong>01 · 样布册</strong><small>六章，循序学经纬</small>')+button('collection','<strong>02 · 织纹架</strong><small>收下策略，回看动作</small>')+button('settings','<strong>03 · 工坊设置</strong><small>底稿、动态与声音</small>')+'</nav>';
 bind('continue',()=>{if(E.solved(S.board(data.run))){const next=L[level().number%48];start(next,false);}else navigate('game');});
 ['chapters','collection','settings'].forEach(p=>bind(p,()=>navigate(p)));
}
function chapterPage(){
 main.innerHTML=heading('样布册','所有关卡都可进入，建议从第 1 幅顺序学习。')+chapters.map((ch,i)=>'<section class="chapter"><div class="chapter-header"><h2>'+String(i+1).padStart(2,'0')+' · '+ch.name+'</h2><span>'+L.filter(l=>l.chapter===i&&completed(l.id)).length+' / 8</span></div><p>'+ch.lesson+'</p><div class="level-grid">'+L.filter(l=>l.chapter===i).map(l=>'<button class="level-button" data-level="'+l.id+'"><strong>'+String(l.number).padStart(2,'0')+'</strong><span><small>'+l.name+'</small><small class="done">'+(completed(l.id)?(data.receipts[l.id].practice?'◇ 练习归齐':'✓ 已归齐'):'未归齐')+'</small></span></button>').join('')+'</div></section>').join('');
 bind('back-home',()=>navigate('home'));main.querySelectorAll('[data-level]').forEach(el=>el.addEventListener('click',()=>{const l=L.find(x=>x.id===el.getAttribute('data-level'));if(l.id===data.run.levelId)navigate('game');else start(l,false);}));
}
function game(){
 const l=level(),b=S.board(data.run),done=E.solved(b),result=done?S.settle(data):null;
 const track=selection.axis==='row'?'行':'列';
 main.innerHTML='<div class="game-layout"><section class="play"><div class="game-status"><div><p class="eyebrow">'+String(l.chapter+1).padStart(2,'0')+' / '+chapters[l.chapter].name+'</p><h1>'+String(l.number).padStart(2,'0')+' · '+l.name+'</h1><p>'+ (data.run.practice?'◇ 练习：不计首通奖励':'编号归序 · 没有时间限制')+'</p></div><div class="step-count"><strong>'+data.run.actions.length+'</strong><small>有效环移</small></div></div><div id="game-board">'+V.boardHTML(b,done?null:selection,data.settings.target,focusValue)+'</div><p class="board-caption">'+(done?'✓ 每枚纸签都回到了自己的位置':'已选第 '+(selection.index+1)+' '+track+' · 出端的标签会从另一端回入')+'</p><div class="track-controls"'+(done?' hidden':'')+'><div class="axis-switch" aria-label="选择行或列"><button id="row-mode" aria-pressed="'+(selection.axis==='row')+'">行模式 ↔</button><button id="column-mode" aria-pressed="'+(selection.axis==='column')+'">列模式 ↕</button></div><div class="numbers" aria-label="选择轨道编号">'+[0,1,2,3].map(i=>'<button id="track-'+i+'" aria-label="第 '+(i+1)+' '+track+'" aria-pressed="'+(selection.index===i)+'">'+(i+1)+'</button>').join('')+'</div><div class="directions">'+[-1,1].map(d=>button('move-'+(d===1?'plus':'minus'),'<span class="arrow">'+(selection.axis==='row'?(d===1?'→':'←'):(d===1?'↓':'↑'))+'</span>整'+track+'向'+(selection.axis==='row'?(d===1?'右':'左'):(d===1?'下':'上')))).join('')+'</div></div><div class="tools">'+button('undo','撤销')+button('redo','重做')+button('hint','提示')+button('restart','重开')+'</div><p class="trace" id="trace"'+(!data.settings.target?' hidden':'')+'>'+(data.run.actions.length?'最近动作：'+data.run.actions.slice(-3).map(V.actionText).join(' → '):'选择轨道不计步；只有方向按钮才会移动。')+'</p><p class="notice" role="status">'+notice+'</p></section><aside class="side-note">'+(done?'<div class="win"><p class="eyebrow">LOOM COMPLETE / 织台落款</p><h2>这一幅，归齐了。</h2><p><span class="score">'+data.run.actions.length+'</span> 次环移</p><p>'+ (data.run.practice?'这是一次练习归齐，可收藏织纹；首通奖励留给独立完成。':'首通记录已核验。重复完成同一幅不会重复领取首通奖励。')+'</p><p class="muted">个人记录 '+data.receipts[l.id].actions.length+' 步'+(data.receipts[l.id].practice?'（练习）':'')+' · 参考路线 '+l.referenceMoves+' 步<br>参考路线经过验证，不代表最少步数。</p>'+button('next-level',l.number===48?'回到样布册 →':'下一幅 →','primary')+button('win-collection','看看织纹架','quiet')+'</div>':'<p class="eyebrow">STUDIO NOTE / 这幅的重点</p><span class="note-index">'+String(l.number).padStart(2,'0')+'</span><h2>'+chapters[l.chapter].name+'</h2><p>'+l.lesson+'</p><p class="muted">'+(l.chapter<2?'先看哪些纸签离开了目标位。行移动不会改变所在行，列移动会扰动已经排好的行。':'借位不是失误：行、列、反向行、反向列可组成局部循环。支援轨道要记得回补。')+'</p><p class="muted">参考路线 '+l.referenceMoves+' 步，不要求达标。<br>键盘：R 行 / C 列，1–4 选轨，再用方向键。Z 撤销，Y 重做。</p>'+button('show-route','看可暂停的参考回放','quiet')+'<div id="hint-box" class="hint-box" hidden></div>')+'<p style="margin-top:20px">'+button('to-chapters','样布册','quiet')+button('target-toggle',data.settings.target?'隐藏目标底稿':'显示目标底稿','quiet')+'</p></aside></div>';
 bind('row-mode',()=>select('row',selection.index));bind('column-mode',()=>select('column',selection.index));
 for(let i=0;i<4;i++)bind('track-'+i,()=>select(selection.axis,i));
 bind('move-minus',()=>move(-1));bind('move-plus',()=>move(1));
 bind('undo',()=>{if(busy)return;if(S.undo(data.run)){notice='已撤销，步数与棋盘一起恢复。';hintStage=0;focusValue=null;persist();render();}});
 bind('redo',()=>{if(busy)return;if(S.redo(data.run)){notice='已重做。';hintStage=0;focusValue=null;if(E.solved(S.board(data.run)))S.settle(data);persist();render();}});
 $('undo').disabled=!data.run.actions.length;$('redo').disabled=!data.run.redo.length;$('hint').disabled=done;
 bind('hint',showHint);bind('restart',()=>{openModal('重新铺开这幅样布','<p>重开会保留通关和收藏记录，当前动作将清零。</p><div class="modal-actions">'+button('restart-confirm','重开这一幅','primary')+'</div>');bind('restart-confirm',()=>{closeModal();start(l,false);});});
 bind('to-chapters',()=>switchPage('chapters'));bind('target-toggle',()=>{data.settings.target=!data.settings.target;persist();render();});
 bind('next-level',()=>l.number===48?navigate('chapters'):start(L[l.number],false));bind('win-collection',()=>navigate('collection'));
 bind('show-route',()=>openReplay(l));
 if(hintStage&&!done)paintHint();
}
function select(axis,index){if(busy)return;selection={axis,index};render();}
function move(d){
 if(busy||page!=='game'||!modal.hidden||E.solved(S.board(data.run)))return;
 const a={axis:selection.axis,index:selection.index,direction:d},old=S.board(data.run);
 if(!S.act(data.run,a)){notice='这局动作记录已满，请撤销或重开。';render();return;}
 sound();hintStage=0;focusValue=null;notice='';
 if(E.solved(S.board(data.run)))S.settle(data);persist();
 const reduced=!data.settings.motion||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 if(reduced){render();return;}
 busy=true;const token=++generation,board=main.querySelector('#game-board .board');
 if(!board){busy=false;render();return;}
 const tiles=Array.from(board.children),active=tiles.filter(t=>a.axis==='row'?Math.floor(Number(t.getAttribute('data-position'))/4)===a.index:Number(t.getAttribute('data-position'))%4===a.index);
 const edge=active[a.direction===1?3:0],clone=edge.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.removeAttribute('data-value');clone.removeAttribute('data-position');
 clone.style[a.axis==='row'?'left':'top']=a.direction===1?'-25%':'100%';board.appendChild(clone);active.push(clone);
 active.forEach(t=>{t.style.transition='transform 200ms ease';t.style.transform='translate'+(a.axis==='row'?'X':'Y')+'('+(a.direction*100)+'%)';});
 timer=setTimeout(()=>{if(token!==generation)return;busy=false;timer=null;render();},210);
}
function showHint(){if(busy||E.solved(S.board(data.run)))return;hintStage=Math.min(hintStage+1,3);const b=S.board(data.run);focusValue=b.find((v,p)=>v!==p+1);render();}
function paintHint(){const box=$('hint-box'),b=S.board(data.run),l=level(),plan=E.route(l,data.run.actions),a=plan[0];box.hidden=false;
 const pos=b.indexOf(focusValue),dest=focusValue-1;
 let text=hintStage===1?'观察纸签 '+focusValue+'：现在位于第 '+(Math.floor(pos/4)+1)+' 行、第 '+(pos%4+1)+' 列；目标是第 '+(Math.floor(dest/4)+1)+' 行、第 '+(dest%4+1)+' 列。':hintStage===2?'一次动作会移动整条轨道。参考回补路线先处理第 '+(a.index+1)+(a.axis==='row'?' 行':' 列')+'，已经归位的纸签也可能暂时离开；之后再回补。':'经当前盘面复验，下一步是：'+V.actionText(a)+'。路线会回补本局偏离，再接参考解；共 '+plan.length+' 步，不保证最少。';
 box.innerHTML='<p>'+text+'</p>'+(hintStage<3?button('deeper-hint','继续看下一层提示','primary'):button('apply-hint','执行这一步 · 标为练习','primary'));
 bind('deeper-hint',showHint);bind('apply-hint',()=>{data.run.practice=true;data.run.hintCount++;selection={axis:a.axis,index:a.index};move(a.direction);});
}
function collection(){
 const cards=chapters.reduce((arr,ch,c)=>arr.concat([{c,slot:0,l:L[c*8+3],name:['并行彩带','交点回补','借位折返','边角守护','两簇连纹','经纬规划'][c]},{c,slot:1,l:L[c*8+7],name:['四带归序','经纬归齐','借完归还','角落循环','连纹入框','全幅落款'][c]}]),[]);
 const earnedChapters=chapters.filter((ch,c)=>L.filter(l=>l.chapter===c).every(l=>completed(l.id))).length;
 const mural='<section class="tapestry-panel"><p class="eyebrow">SIX WEAVES / 六章挂毯</p><h2>'+ (earnedChapters===6?'六段经纬，织成一幅。':earnedChapters+' / 6 段织纹已归齐')+'</h2><div class="tapestry">'+chapters.map((ch,c)=>{const n=L.filter(l=>l.chapter===c&&completed(l.id)).length;return '<div class="chapter-cloth '+(n===8?'earned':'waiting')+'"><strong>'+String(c+1).padStart(2,'0')+' · '+ch.name+'</strong><span>'+(n===8?'✓ 一章织纹已收藏':n+' / 8 幅归齐')+'</span></div>';}).join('')+'</div></section>';
 main.innerHTML=heading('织纹架','十二块策略样布，完成对应关卡后可逐步回看。练习也可收藏。')+mural+'<div class="collection-grid">'+cards.map((card,i)=>'<button id="sample-'+i+'" class="sample-card '+(completed(card.l.id)?'':'locked')+'"><span class="swatch" aria-hidden="true">'+(completed(card.l.id)?V.swatchHTML(card.l):'')+'</span><strong>'+String(card.c+1).padStart(2,'0')+' · '+card.name+'</strong><small>'+(completed(card.l.id)?'✓ 已收藏 · 点击回看路线':'待织 · 完成第 '+card.l.number+' 幅解锁')+'</small></button>').join('')+'</div>';
 bind('back-home',()=>navigate('home'));cards.forEach((card,i)=>bind('sample-'+i,()=>{if(completed(card.l.id))openReplay(card.l);else{openModal('这块样布还没归齐','<p>完成第 '+card.l.number+' 幅「'+card.l.name+'」后，这里会收藏对应策略的回放。</p><div class="modal-actions">'+button('go-sample','前往这一幅','primary')+'</div>');bind('go-sample',()=>{closeModal();start(card.l,false);});}}));
}
function settings(){
 main.innerHTML='<div class="settings">'+heading('工坊设置','只改变观察与反馈，不改变棋盘规则。')+[['target','目标底稿','纸签下方的小号数字是目标位置。'],['motion','环移动画','200ms 整轨平移；系统减少动态优先。'],['sound','轻梭声音','点击操作后播放；设备不支持时静默。']].map(([k,title,sub])=>'<div class="settings-row"><span>'+title+'<small>'+sub+'</small></span>'+button('set-'+k,data.settings[k]?'已开启':'已关闭')+'</div>').join('')+'<p class="notice">存档：'+(store.backend==='xhs-storage'?'端缓存（客户端 9.46+）':'浏览器本地存储')+'。动作自动保存；缓存可能被设备清理。</p><p class="muted">提示前两层只观察；执行提示或完整路线会把本局标为练习，不领取首通奖励。重开后可独立挑战。</p>'+button('settings-tutorial','重看三图教程','primary')+'</div>';
 bind('back-home',()=>navigate('home'));['target','motion','sound'].forEach(k=>bind('set-'+k,()=>{data.settings[k]=!data.settings[k];persist();render();}));bind('settings-tutorial',openTutorial);
}
function openModal(title,html){cancel();if(modal.hidden)previousFocus=document.activeElement;$('modal-title').textContent=title;body.innerHTML=html;modal.hidden=false;document.body.style.overflow='hidden';body.scrollTop=0;$('modal-close').focus();}
function closeModal(){modal.hidden=true;document.body.style.overflow='';replayState=null;if(previousFocus&&document.contains(previousFocus))previousFocus.focus();else main.focus();}
function openTutorial(){tutorialStep=0;paintTutorial();}
function paintTutorial(){const titles=['十六枚标签，没有空位','第 2 列向上，整列一起走','第 3 行向右，全部归序'];const descriptions=['从左到右、从上到下的 1—16 才是目标。选“行 / 列”和 1—4 编号，再点大方向按钮。离开边界的纸签会从同一轨道另一端回入。','同一题实际执行第 2 列向上一格：顶端的 14 从最下方回入。已归位的标签也可能被其他轨道带走，之后要回补。','再把第 3 行向右一格，16 个位置全部正确。颜色和纹样只是辅助记忆，判胜只看纸签编号。'];
 const sel=tutorialStep===0?null:tutorialStep===1?{axis:'column',index:1}:{axis:'row',index:2};
 openModal('织台入门 · 三幅真图','<div class="tutorial-progress"><span>同一固定题 · silk-tutorial-1</span><span>0'+(tutorialStep+1)+' / 03</span></div><h3>'+titles[tutorialStep]+'</h3><div id="tutorial-board" data-stage="'+tutorialStep+'" data-level="silk-tutorial-1">'+V.boardHTML(E.tutorial[tutorialStep],sel,true)+'</div><p>'+descriptions[tutorialStep]+'</p><div class="tutorial-mark">'+(tutorialStep===0?'真实起始状态 · 尚未完成':tutorialStep===1?'已执行一次合法列环移 · 尚未完成':'✓ 引擎验证：全部 1—16 归位')+'</div><div class="modal-actions">'+button('tutorial-skip',tutorialStep===2?'回到工坊':'跳过')+button('tutorial-next',tutorialStep===0?'演示第 2 列向上 ↑':tutorialStep===1?'演示第 3 行向右 →':'进入第 1 幅 →','primary')+'</div>');
 bind('tutorial-skip',()=>{data.tutorialSeen=true;persist();closeModal();});bind('tutorial-next',()=>{if(tutorialStep<2){const next=E.shift(E.tutorial[tutorialStep],E.tutorialActions[tutorialStep]);if(!E.same(next,E.tutorial[tutorialStep+1]))throw Error('Tutorial mismatch');tutorialStep++;paintTutorial();}else{data.tutorialSeen=true;persist();closeModal();if(page==='home')navigate('game');}});
}
function openReplay(l){replayState={level:l,board:l.initial.slice(),step:0};paintReplay();}
function paintReplay(){const r=replayState,last=r.step?r.level.solution[r.step-1]:null;
 openModal('策略回放 · '+r.level.name,'<p class="eyebrow">参考路线 · 可暂停 · 不代表最少步数</p><div id="replay-board">'+V.boardHTML(r.board,last,true)+'</div><p>'+r.level.lesson+'</p><p class="tutorial-mark">'+r.step+' / '+r.level.solution.length+' 步'+(last?' · 上一步：'+V.actionText(last):' · 真实开局')+'</p><div class="modal-actions">'+button('replay-reset','回到起点')+button('replay-next',r.step===r.level.solution.length?'已验证归序':'下一步：'+V.actionText(r.level.solution[r.step]),'primary')+'</div><p class="muted">这里是独立观察回放，不改变当前局。若要把当前局接入完整参考路线，使用下方按钮；本局将标为练习。</p>'+button('practice-route','将当前局接入练习路线','quiet'));
 // openModal cancels animations, but preserves this sandbox object.
 replayState=r;bind('replay-reset',()=>{r.board=r.level.initial.slice();r.step=0;paintReplay();});bind('replay-next',()=>{if(r.step<r.level.solution.length){r.board=E.shift(r.board,r.level.solution[r.step++]);paintReplay();}});$('replay-next').disabled=r.step===r.level.solution.length;
 bind('practice-route',()=>{closeModal();if(data.run.levelId!==r.level.id)start(r.level,true);else{data.run.practice=true;persist();navigate('game');}hintStage=3;const b=S.board(data.run);focusValue=b.find((v,p)=>v!==p+1);render();});
}
document.addEventListener('keydown',e=>{
 if(!modal.hidden){if(e.key==='Escape'){e.preventDefault();closeModal();return;}if(e.key==='Tab'){const nodes=Array.from(modal.querySelectorAll('button:not([disabled])'));const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(page!=='game'||busy||e.altKey||e.ctrlKey||e.metaKey)return;
 if(e.key.toLowerCase()==='r'){e.preventDefault();select('row',selection.index);}else if(e.key.toLowerCase()==='c'){e.preventDefault();select('column',selection.index);}else if(/^[1-4]$/.test(e.key)){e.preventDefault();select(selection.axis,Number(e.key)-1);}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();if((selection.axis==='row'&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))||(selection.axis==='column'&&(e.key==='ArrowUp'||e.key==='ArrowDown')))move(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1);else{notice='方向与当前模式不一致，请先选行或列。';render();}}else if(e.key.toLowerCase()==='z')$('undo').click();else if(e.key.toLowerCase()==='y')$('redo').click();
});
bind('modal-close',closeModal);bind('brand',()=>{if(!modal.hidden)closeModal();if(data)navigate('home');});bind('tutorial-open',()=>{if(data)openTutorial();});
document.addEventListener('visibilitychange',()=>{if(data){if(document.hidden){cancel();if(page==='game')render();}persist();}});
window.addEventListener('pagehide',()=>{if(data)persist();});
(async()=>{store=await window.SilkStorage.create(window);data=S.reconcile(await store.read());if(E.solved(S.board(data.run)))S.settle(data);await persist();render();if(!data.tutorialSeen)openTutorial();})();
})();
