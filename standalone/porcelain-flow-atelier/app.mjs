import {GAME_ID,emptyBoard,inspect,findDeduction,logicTrace} from './logic.mjs';
import {LEVELS,CHAPTERS} from './levels.mjs';
import {STORE_KEY,TUTORIAL_KEY,newSession,replaySession,editSession,cleanStore,settleStore,createPersistence} from './session.mjs';
import {boardSvg,relicSvg} from './render.mjs';
const app=document.getElementById('app'),modalRoot=document.getElementById('modal-root'),toastEl=document.getElementById('toast');
let store=cleanStore(null),persistence,view='home',chapter=1,selected=0,tool='\\',pencil=false,checking=false,nodeCorner=0,modal=null,returnFocus=null,storageFailed=false,toastTimer,chain=Promise.resolve(),soundContext=null;
function task(fn){chain=chain.then(fn).catch(e=>{console.error(e);toast('检验台遇到问题，请重试。');});return chain;}
function toast(t){toastEl.textContent=t;toastEl.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastEl.style.display='none';},3400);}
function level(){return LEVELS.find(p=>store.current&&p.id===store.current.levelId)||LEVELS[0];}
function current(){return replaySession(level(),store.current)||{board:emptyBoard(level()),notes:emptyBoard(level()),moves:0};}
async function save(next){const ok=await persistence.write(STORE_KEY,next);store=next;storageFailed=!ok;if(!ok)toast('存档写入失败：本次仍可游玩，奖励暂不发放。');return ok;}
async function flush(){
  const host=window.PorcelainHost;if(!host||typeof host.complete!=='function'||storageFailed)return;
  for(const e of store.outbox.slice()){
    try{const result=await Promise.race([Promise.resolve(host.complete(JSON.parse(JSON.stringify(e)))),new Promise(resolve=>setTimeout(()=>resolve(false),1200))]);if(result!==true&&!(result&&result.accepted===true))continue;
      const next=JSON.parse(JSON.stringify(store));next.outbox=next.outbox.filter(v=>v.completionId!==e.completionId);if(!await save(next))break;
    }catch(err){break;}
  }
}
function chime(kind){
 if(!store.settings.sound)return;
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!soundContext)soundContext=new Audio();if(soundContext.state==='suspended')soundContext.resume();
 const o=soundContext.createOscillator(),g=soundContext.createGain(),now=soundContext.currentTime;o.type='sine';o.frequency.value=kind==='win'?780:kind==='clear'?430:640;g.gain.setValueAtTime(.04,now);g.gain.exponentialRampToValueAtTime(.001,now+.11);o.connect(g);g.connect(soundContext.destination);o.start(now);o.stop(now+.12);
 }catch(e){}
}
function doneCount(){return Object.keys(store.records).length;}
function homeBar(){return `<header class="topbar"><div><div class="brand">瓷流工坊</div><div class="small">PORCELAIN FLOW ATELIER</div></div><div class="nav-actions"><button class="plain" data-action="manual">手册</button><button class="plain" data-action="settings" aria-label="设置">设置</button></div></header>`;}
function backBar(title,back){return `<header class="topbar"><button class="plain" data-action="${back||'home'}">‹ 返回</button><strong>${title}</strong><button class="plain" data-action="manual">手册</button></header>`;}
function storageBanner(){return storageFailed?'<div class="storage-warning" role="alert">存档暂不可用。请勿关闭页面；完成记录与奖励等待重新保存。<button data-action="retry-save">重试保存</button></div>':'';}
function render(){
 const focus=document.activeElement,focusCell=focus&&focus.getAttribute('data-cell');
 let body='';
 if(view==='home'){
  const next=store.current?level():LEVELS.find(p=>!store.records[p.id])||LEVELS[0];
  body=homeBar()+`<section class="hero"><div class="hero-copy"><div class="eyebrow">干式瓷阵 · 开窑检验</div><h1>一片斜瓷，<br>两端相接。</h1><p class="lead">在钴蓝与白瓷之间，<br>做一盘没有闭环的纹样。</p><p>每格安装一片斜瓷，让交点数字恰好。<br>分开的枝条也可以合格。</p><div class="hero-cta"><button class="primary" data-action="continue">${store.current?'继续':'开始'}第 ${next.number} 关 · ${next.title}</button><button data-action="chapters">开窑册 · 六章六十关</button><button class="plain" data-action="collection">器件收藏 · 已检验 ${doneCount()}/60</button></div><div class="progress-line"><span style="width:${doneCount()/60*100}%"></span></div><small>慢慢推理，没有计时与生命惩罚。</small></div><div class="hero-art"><img src="./assets/atelier.svg" alt="象牙白检验托盘与钴蓝干式瓷片的原创产品插画，不是谜题盘面"></div><div class="home-mark">COBALT / IVORY / DRY CERAMIC</div></section><section class="intro-strip"><div><strong>01 选斜向</strong><p>先选工具，再点格中央。</p></div><div><strong>02 看端头</strong><p>数字只统计接入该点的端头。</p></div><div><strong>03 不闭环</strong><p>任何大小的闭合路径都不合格。</p></div></section><footer class="footer">Slant / Gokigen Naname 规则 · 原创瓷阵主题 <button class="plain" data-action="source">规则与来源</button></footer>`;
 }else if(view==='chapters'){
  body=backBar('六章开窑册')+'<div class="eyebrow">从白坯到展盘</div><h1>循着纹样学推理</h1><p class="small" style="margin-top:10px">所有关卡都可直接练习。完成十关，收藏该章器件。</p>'+CHAPTERS.map(c=>{
   const n=LEVELS.filter(p=>p.chapter===c.id&&store.records[p.id]).length;
   return `<button class="shelf" data-chapter="${c.id}"><div class="relic">${relicSvg(c.id,n<10)}</div><div class="details"><div class="eyebrow">CHAPTER 0${c.id} · ${n}/10 已检验</div><h2>${c.title}</h2><p>${c.concept} · ${c.relic}</p><div class="progress-line"><span style="width:${n*10}%"></span></div></div><span class="arrow">›</span></button>`;
  }).join('');
 }else if(view==='levels'){
  const c=CHAPTERS[chapter-1];body=backBar(c.title,'chapters')+`<div class="eyebrow">CHAPTER 0${chapter} · ${c.concept}</div><h1>${c.title}</h1><p style="margin-top:12px">${c.note}</p><div class="level-grid">`+LEVELS.filter(p=>p.chapter===chapter).map(p=>`<button class="level-card" data-level="${p.id}"><span class="level-number">${String(p.number).padStart(2,'0')}</span><span>${p.title}<small>${store.records[p.id]?'✓ 已检验':'○ 可练习'} · ${p.width}×${p.height}</small></span></button>`).join('')+'</div>';
 }else if(view==='play'){
  const p=level(),c=CHAPTERS[p.chapter-1],s=current(),r=inspect(p,s.board),x=selected%p.width,y=Math.floor(selected/p.width),vertices=[y*(p.width+1)+x,y*(p.width+1)+x+1,(y+1)*(p.width+1)+x,(y+1)*(p.width+1)+x+1],node=vertices[nodeCorner],n=r.nodes[node],names=['左上','右上','左下','右下'];
  let hits='';const w=p.width*60+28,h=p.height*60+28;
  for(let i=0;i<s.board.length;i++){const cx=i%p.width,cy=Math.floor(i/p.width),value=s.board[i]==='\\'?'反斜向，连接左上与右下':s.board[i]==='/'?'正斜向，连接右上与左下':'空格';hits+=`<button class="cell-hit" data-cell="${i}" aria-label="第 ${cy+1} 行第 ${cx+1} 格，${value}" style="left:${(14+cx*60)/w*100}%;top:${(14+cy*60)/h*100}%;width:${60/w*100}%;height:${60/h*100}%" tabindex="${i===selected?0:-1}"></button>`;}
  const conflict=r.errors.length||r.loops.length;
  body=backBar('推理工作台')+`<div class="work-head"><div><div class="eyebrow">${c.title} · ${String(p.number).padStart(2,'0')} / 60</div><h2>${p.title}</h2></div><button class="plain" data-action="levels">选关</button></div><div class="work-layout"><div class="work-main"><div class="status"><span>安装 ${r.filled}/${s.board.length}</span><span>${conflict?'! '+(r.loops.length?'出现闭环':r.errors.length+' 点冲突'):'✓ 尚无冲突'} · ${s.moves} 次</span></div><div class="board-frame" data-cols="${p.width}"><div class="board-inner">${boardSvg(p,s.board,{selected,notes:s.notes,node:checking?node:null})}<div class="board-hits">${hits}</div></div></div><div class="board-caption">${checking?'检查模式：点格只选中，再查看下方四个节点。':store.settings.cycle?'循环点按：空 → ╲ → ╱ → 空。选工具即切回直接设置。':pencil?'铅笔模式：虚线笔记不参与计数与检验。':'先选斜向，再点格中央。数字由下方检查按钮查看。'}</div>${conflict?`<div class="warning">${r.loops.length?'! 橙色点划线标出整个闭环，请撤掉或改向一片。':'! 数字已超出目标，或剩余空格已无法凑足。'} 可以继续改正，撤销不扣进度。</div>`:''}<div class="node-panel"><div class="node-buttons">${names.map((name,i)=>`<button data-corner="${i}" class="${checking&&i===nodeCorner?'active':''}">${name}点</button>`).join('')}</div><p>${checking?`第 ${y+1} 行第 ${x+1} 格 · ${names[nodeCorner]}节点：<strong>${n.target===null?'无数字限制':'目标 '+n.target}</strong>；已接 ${n.count}，周围未定 ${n.remaining}。${n.locked?'✓ 已稳定满足。':n.error?'! 当前冲突。':n.target!==null&&n.count===n.target?'当前数量吻合，周围仍有空格。':'仍需核对。'}`:'点四角按钮进入检查模式；先点一个格，定位它的四个交点。'}</p></div><div class="tools"><div class="tool-row"><button data-tool="\\" class="${tool==='\\'?'active':''}" aria-pressed="${tool==='\\'}"><span class="direction">╲</span>斜向</button><button data-tool="/" class="${tool==='/'?'active':''}" aria-pressed="${tool==='/'}"><span class="direction">╱</span>斜向</button><button data-tool="" class="${tool===''?'active':''}">清除</button></div><div class="mode-row"><button data-action="install" class="${!checking&&!pencil?'active':''}">正式安装</button><button data-action="pencil" class="${pencil?'active':''}">✎ 铅笔</button><button data-action="check" class="${checking?'active':''}">◎ 检查</button></div><div class="action-row"><button data-action="undo" ${store.current.cursor===0?'disabled':''}>撤销</button><button data-action="redo" ${store.current.cursor===store.current.actions.length?'disabled':''}>重做</button><button data-action="hint">提示</button><button data-action="restart">重开</button></div></div>${r.complete?`<div class="win-banner"><strong>✓ 检验合格 · ${store.records[p.id]&&!storageFailed?'器件纹样已归档':'等待保存'}</strong><p class="small">每格已填、数字恰好、全图无环。${store.current.hints?'使用了推理提示':'独立检验'} · 奖励按关卡去重</p><button data-action="result">看成品</button><button class="primary" data-action="next">${p.number===60?'返回开窑册':'下一关'}</button></div>`:''}</div><aside class="work-side"><div class="stamp">0${p.chapter} / ${c.concept}</div><h2 style="margin-top:14px">${c.relic}</h2><div class="relic">${relicSvg(c.id,false)}</div><p>${c.note}</p><p>每片有两个端头。数字为 0 时，所有瓷片都要避开它。</p><p>所有空格最终都要填；没有数字的节点仍然不能闭环。</p><p>键盘：方向键选格；╲ / ╱ 对应键直接输入；退格清除；Ctrl / ⌘ Z 撤销。</p><button data-action="ring">查看闭环练习</button></aside></div>`;
 }else if(view==='collection'){
  body=backBar('器件收藏')+`<div class="eyebrow">已检验 ${doneCount()} / 60 盘</div><h1>把每次推理留在窑架</h1><p class="small" style="margin-top:12px">每关首次合格只归档一次；同关重玩不重复领器件。</p><div class="collection-grid">`+CHAPTERS.map(c=>{const n=LEVELS.filter(p=>p.chapter===c.id&&store.records[p.id]).length;return `<div class="collection-card"><div class="relic">${relicSvg(c.id,n<10)}</div><h3>${c.relic}</h3><p>${n===10?'✓ 已入架':'○ 收集进度 '+n+'/10'}</p><button data-chapter="${c.id}">查看本章</button></div>`;}).join('')+'</div><div class="completed-list"><h2>已归档纹样</h2>'+(!doneCount()?'<p class="empty-state">完成任意一盘，就能在这里查看真实成品。</p>':LEVELS.filter(p=>store.records[p.id]).map(p=>`<button data-record="${p.id}">✓ ${String(p.number).padStart(2,'0')} · ${p.title} <small>${store.records[p.id].unassisted?'独立检验':'提示完成'}</small></button>`).join(''))+'</div>';
 }
 app.innerHTML=`<main class="shell">${storageBanner()}${body}</main>`;app.setAttribute('aria-busy','false');
 if(view==='play'&&focusCell!==null&&focusCell!==undefined){const hit=app.querySelector('[data-cell="'+selected+'"]');if(hit)hit.focus({preventScroll:true});}
}
function go(v){closeModal();view=v;render();window.scrollTo(0,0);}
async function start(p){
 chapter=p.chapter;
 if(!store.current||store.current.levelId!==p.id){await save(Object.assign({},store,{current:newSession(p)}));selected=0;tool='\\';pencil=false;checking=false;}
 go('play');
 if(p.number===21){const read=await persistence.read(TUTORIAL_KEY+':ring');if(!read.value)showRing();}
}
async function updateSession(next){
 if(!next)return false;
 const p=level(),replay=replaySession(p,next);if(!replay)return false;
 let changedStore=Object.assign({},store,{current:next}),win=inspect(p,replay.board).complete;
 if(win)changedStore=settleStore(changedStore,p,next,new Date().toISOString());
 const ok=await save(changedStore);if(win&&ok){chime('win');await flush();}render();return true;
}
async function install(i,value){
 selected=i;if(checking){render();return;}
 const next=editSession(level(),store.current,pencil?'note':'set',i,value);if(!next){render();return;}
 chime(value?'set':'clear');await updateSession(next);
}
function openModal(type,content){
 if(!modal)returnFocus=document.activeElement;
 modal={type};modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${type}">${content}</section></div>`;document.body.classList.add('modal-open');app.setAttribute('aria-hidden','true');
 const first=modalRoot.querySelector('button');if(first)first.focus();
}
function closeModal(){
 if(!modal)return;modal=null;modalRoot.innerHTML='';document.body.classList.remove('modal-open');app.removeAttribute('aria-hidden');if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});else {const fallback=app.querySelector('[data-action="hint"]')||app.querySelector('[data-action="manual"]');if(fallback)fallback.focus({preventScroll:true});}returnFocus=null;
}
function modalHead(title){return `<div class="modal-head"><h2>${title}</h2><button data-action="close" aria-label="关闭">关闭</button></div>`;}
let tutorialStep=0;
function showTutorial(step){
 tutorialStep=step;const p=LEVELS[0],initial=emptyBoard(p),d=logicTrace(p,false).steps[0],one=initial.slice();one[d.i]=d.value;
 const frames=[initial,one,p.solution],texts=[['每格一片，数字看端头','数字标在交点上，表示接入这里的瓷片端头数。空铆钉没有数字限制，数字 0 要避开。'],['先选工具，再点格','这一步安装在第 '+(Math.floor(d.i/p.width)+1)+' 行第 '+(d.i%p.width+1)+' 格，方向 '+(d.value==='\\'?'╲':'╱')+'。它同时连接两个对角交点；下方四个检查按钮可查看它们。'],['全填、数字恰好、没有环','这是同一题的真实合格盘面。分开的树状分支合法；不需要连成一整张网。']];
 openModal('检验手册',modalHead('检验手册')+`<div class="step-dots">${step+1} / 3 · 第 01 关真实状态</div><h3 style="margin-top:12px">${texts[step][0]}</h3><div class="modal-art">${boardSvg(p,frames[step],{selected:step===1?d.i:null,label:step===0?'真实空盘':step===1?'合法安装一片后':'引擎验证的完成盘'})}</div><p>${texts[step][1]}</p><p class="small">提示会标记“提示完成”，不会扣除进度。撤销、铅笔与重开都可使用。</p><div class="modal-actions"><button data-action="tutorial-skip">${step?'结束阅读':'跳过'}</button>${step?'<button data-action="tutorial-prev">上一图</button>':''}<button class="primary" data-action="tutorial-next">${step===2?'看完，去安装':'下一图'}</button></div>${step===2?'<button class="plain" data-action="ring" style="width:100%;margin-top:8px">练习识别闭环</button>':''}`);
}
let ringBoard=['/','\\','\\',''],ringLast=false;
const ringPuzzle={width:2,height:2,clues:Array(9).fill(null)};
function renderRing(){
 openModal('闭环练习',modalHead('数字之外，还有无环检验')+`<div class="stamp">独立 2×2 练习 · 不计主线进度</div><div class="modal-art">${boardSvg(ringPuzzle,ringBoard,{label:ringLast?'真实闭环错误态':'最后一片留空的练习态'})}</div><p>${ringLast?'! 四片围成菱形闭环。所有无线索交点也受无环规则约束；橙色点划线显示整个环。':'右下格若安装 ╱，就会把已经相连的两端再接起来，围成一圈。先试一下，再撤回。'}</p><div class="practice-tools"><button class="primary" data-action="ring-toggle">${ringLast?'撤掉最后一片':'安装最后一片 ╱'}</button><button data-action="ring-done">回到工作台</button></div>`);
}
function showRing(){ringLast=false;ringBoard=['/','\\','\\',''];renderRing();}
let hintStage=0,hintData=null;
async function showHint(stage){
 if(stage===0){
  const s=current(),d=findDeduction(level(),s.board,false);hintData=d;hintStage=0;
  if(d&&d.i!==undefined)selected=d.i;
  if(d&&d.type!=='conflict'&&d.type!=='contradiction')await updateSession(Object.assign({},store.current,{hints:store.current.hints+1}));
 }
 hintStage=stage;const p=level(),s=current(),d=hintData;
 if(!d){openModal('提示',modalHead('暂时没有一步强制')+'<p>这份题库的认证解有完整强制推理顺序。当前选择可能改变了顺序；试着撤回最近的几步，或先复核两端数字。</p>');return;}
 if(d.type==='conflict'||d.type==='contradiction'){
 const r=inspect(p,s.board);openModal('提示',modalHead('先处理已有冲突')+`<div class="modal-art">${boardSvg(p,s.board,{label:'当前冲突盘面'})}</div><p>${r.loops.length?'已安装的瓷片围成闭环，橙色点划线标出了完整路径。':'某个数字已超标或不可能凑足。'} 提示不会用答案替换你的瓷片。请改向、清除或撤回最近一步。</p>`);return;
 }
 const row=Math.floor(d.i/p.width)+1,col=d.i%p.width+1;
 const intro=d.type==='loop'?`查看第 ${row} 行第 ${col} 格的两端：它们可能已经通过其他瓷片相连。`:`查看第 ${Math.floor(d.vertex/(p.width+1))+1} 行第 ${d.vertex%(p.width+1)+1} 个交点，以及相邻的第 ${row} 行第 ${col} 格。`;
 const explanation=d.type==='loop'?`若此格装 ${d.invalid==='\\'?'╲':'╱'}，会接上已有 ${d.path.length} 片的路径，闭合成环。应装 ${d.value==='\\'?'╲':'╱'}。`:`该节点目标 ${d.target}，当前已接 ${d.count}，周围未定 ${d.remaining}。装 ${d.invalid==='\\'?'╲':'╱'} 后会超出目标或无法凑足；因此此格应装 ${d.value==='\\'?'╲':'╱'}。`;
 openModal('推理提示',modalHead('第 '+(stage+1)+' 层提示')+`<div class="stamp">提示完成仍然收藏器件</div><div class="modal-art">${boardSvg(p,s.board,{selected:d.i,path:stage?d.path||[]:[],label:'依据当前真实盘面的推理提示'})}</div><p>${stage===0?intro:explanation}</p>${stage&&d.type==='loop'?'<p class="hint-path">金色点划线为已有完整路径；新的一片不能把它闭合。</p>':''}<div class="modal-actions"><button data-action="close">自己继续</button><button class="primary" data-action="${stage===0?'hint-explain':stage===1?'hint-confirm':'hint-apply'}">${stage===0?'解释依据':stage===1?'准备安装':'确认安装这一片'}</button></div>${stage===2?'<p class="small">确认后只安装高亮格，不改变其他位置。</p>':''}`);
}
function showResult(p,proof){
 const session={levelId:p.id,seed:p.seed,generatorVersion:p.generatorVersion,ruleVersion:proof.ruleVersion,runId:proof.runId,actions:proof.timeline,cursor:proof.timeline.length,hints:proof.hints},s=replaySession(p,session);
 if(!s)return;openModal('合格成品',modalHead('瓷阵 '+String(p.number).padStart(2,'0')+' · 已合格')+`<div class="stamp">${CHAPTERS[p.chapter-1].relic} · 真实纹样</div><div class="modal-art">${boardSvg(p,s.board,{label:'真实已完成并独立验证的瓷阵'})}</div><p>所有 ${s.board.length} 格已安装，数字精确，全图无环。</p><p class="small">${proof.hints?'提示完成':'独立检验'} · 首通器件按关卡去重。</p><div class="modal-actions"><button data-action="close">稍后</button><button class="primary" data-action="collection">去收藏架</button></div>`);
}
function showSettings(){openModal('设置',modalHead('检验台设置')+`<div class="toggle"><p>轻瓷触音<small style="display:block">默认关闭；操作后播放</small></p><button data-action="sound">${store.settings.sound?'开启':'关闭'}</button></div><div class="toggle"><p>可选循环点按<small style="display:block">空 → ╲ → ╱ → 空；右键反向</small></p><button data-action="cycle">${store.settings.cycle?'开启':'关闭'}</button></div><p class="small">${store.settings.cycle?'当前使用循环模式。':'当前使用先选工具、再点格的直接设置模式。'}<br>存档仅保存在本设备；被清理后可能丢失。</p>`);}
async function act(action){
 if(action==='close'){closeModal();return;}
 if(['home','chapters','levels','collection'].includes(action)){go(action);return;}
 if(action==='continue'){await start(store.current?level():LEVELS.find(p=>!store.records[p.id])||LEVELS[0]);return;}
 if(action==='manual'){showTutorial(0);return;}
 if(action==='tutorial-prev'){showTutorial(tutorialStep-1);return;}
 if(action==='tutorial-next'&&tutorialStep<2){showTutorial(tutorialStep+1);return;}
 if(action==='tutorial-next'||action==='tutorial-skip'){await persistence.write(TUTORIAL_KEY,true);closeModal();return;}
 if(action==='ring'){showRing();return;}
 if(action==='ring-toggle'){ringLast=!ringLast;ringBoard[3]=ringLast?'/':'';renderRing();return;}
 if(action==='ring-done'){await persistence.write(TUTORIAL_KEY+':ring',true);closeModal();return;}
 if(action==='settings'){showSettings();return;}
 if(action==='sound'||action==='cycle'){const settings=Object.assign({},store.settings);settings[action]=!settings[action];await save(Object.assign({},store,{settings}));if(action==='sound')chime('set');render();showSettings();return;}
 if(action==='source'){openModal('规则与来源',modalHead('规则与来源')+'<p>规则为 Slant / Gokigen Naname（斜线）。每格一片；数字统计端头；全图没有任何闭环。多个分离分支合法。</p><p>参考 Simon Tatham’s Portable Puzzle Collection 与 ebnbin/puzzles 的公开规则。Simon Tatham 与贡献者，MIT License；保留在源码 THIRD_PARTY_NOTICES.md。</p><p>瓷流工坊为独立主题与界面，关卡由固定种子生成，再用独立搜索证明唯一。没有最少步或无限不重复承诺。</p><p class="small">本地版本 1.0.0 · 全部资源离线 · AI 辅助开发，原创代码矢量插画</p>');return;}
 if(action==='retry-save'){if(await save(store)){await flush();render();toast('当前进度已保存。');}return;}
 if(view!=='play')return;
 if(action==='install'||action==='pencil'||action==='check'){pencil=action==='pencil';checking=action==='check';render();return;}
 if(action==='undo'||action==='redo'){
  const s=store.current,cursor=s.cursor+(action==='undo'?-1:1);if(cursor>=0&&cursor<=s.actions.length)await updateSession(Object.assign({},s,{cursor}));return;
 }
 if(action==='restart'){openModal('重新开局',modalHead('重新检验这一盘？')+'<p>本局安装与铅笔记录会清空。已经归档的器件和首通进度会保留。</p><div class="modal-actions"><button data-action="close">保留当前盘</button><button class="primary" data-action="restart-confirm">确认重开</button></div>');return;}
 if(action==='restart-confirm'){closeModal();await save(Object.assign({},store,{current:newSession(level())}));selected=0;render();return;}
 if(action==='hint'){await showHint(0);return;}
 if(action==='hint-explain'||action==='hint-confirm'){await showHint(action==='hint-explain'?1:2);return;}
 if(action==='hint-apply'){const d=hintData;closeModal();pencil=false;checking=false;if(d&&d.i!==undefined)await install(d.i,d.value);return;}
 if(action==='result'){const p=level(),r=store.records[p.id];if(r)showResult(p,r.first);return;}
 if(action==='next'){const p=level();if(p.number===60)go('chapters');else await start(LEVELS[p.number]);return;}
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||b.disabled)return;
 if(b.hasAttribute('data-cell')){
  if(window.PointerEvent&&event.detail>0)return;
  const i=Number(b.getAttribute('data-cell'));if(event.detail>0&&nearNode(b,event.clientX,event.clientY)){inspectNear(i);return;}task(()=>cellAction(i,false));return;
 }
 if(b.hasAttribute('data-tool')){const value=b.getAttribute('data-tool');task(async()=>{tool=value;checking=false;if(store.settings.cycle){await save(Object.assign({},store,{settings:Object.assign({},store.settings,{cycle:false})}));toast('已切回直接设置模式。');}render();});return;}
 if(b.hasAttribute('data-corner')){checking=true;pencil=false;nodeCorner=Number(b.getAttribute('data-corner'));render();return;}
 if(b.hasAttribute('data-chapter')){chapter=Number(b.getAttribute('data-chapter'));go('levels');return;}
 if(b.hasAttribute('data-level')){task(()=>start(LEVELS.find(p=>p.id===b.getAttribute('data-level'))));return;}
 if(b.hasAttribute('data-record')){const p=LEVELS.find(p=>p.id===b.getAttribute('data-record'));showResult(p,store.records[p.id].first);return;}
 const action=b.getAttribute('data-action');if(action)task(()=>act(action));
});
async function cellAction(i,reverse){
 let value=tool;if(store.settings.cycle&&!checking){const s=current(),v=(pencil?s.notes:s.board)[i],cycle=['','\\','/'];value=cycle[(cycle.indexOf(v)+(reverse?2:1))%3];}
 await install(i,value);
}
function nearNode(button,x,y){const rect=button.getBoundingClientRect(),dx=Math.min(Math.abs(x-rect.left),Math.abs(rect.right-x)),dy=Math.min(Math.abs(y-rect.top),Math.abs(rect.bottom-y));return Math.hypot(dx,dy)<=Math.max(9,rect.width*14/60);}
function inspectNear(i){selected=i;checking=true;pencil=false;render();toast('已选中此格。用下方四角按钮查看节点；选斜向工具再安装。');}
let pointer=null;
document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-cell]');if(b&&e.button===0)pointer={id:e.pointerId,i:Number(b.getAttribute('data-cell')),x:e.clientX,y:e.clientY,cancel:false};});
document.addEventListener('pointermove',e=>{if(pointer&&pointer.id===e.pointerId&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8)pointer.cancel=true;});
document.addEventListener('pointercancel',()=>{pointer=null;});
document.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;const b=e.target.closest('[data-cell]');if(!p.cancel&&b&&Number(b.getAttribute('data-cell'))===p.i){if(nearNode(b,e.clientX,e.clientY))inspectNear(p.i);else task(()=>cellAction(p.i,false));}});
document.addEventListener('contextmenu',e=>{const b=e.target.closest('[data-cell]');if(b&&store.settings.cycle){e.preventDefault();task(()=>cellAction(Number(b.getAttribute('data-cell')),true));}});
document.addEventListener('keydown',e=>{
 if(modal){if(e.key==='Escape'){e.preventDefault();closeModal();}if(e.key==='Tab'){
  const list=Array.from(modalRoot.querySelectorAll('button:not([disabled])'));if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }return;}
 if(view!=='play')return;
 const hit=document.activeElement&&document.activeElement.hasAttribute('data-cell');if(!hit&&!(e.ctrlKey||e.metaKey))return;
 const p=level();if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
 e.preventDefault();const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0,x=Math.max(0,Math.min(p.width-1,selected%p.width+dx)),y=Math.max(0,Math.min(p.height-1,Math.floor(selected/p.width)+dy));selected=y*p.width+x;render();const b=app.querySelector('[data-cell="'+selected+'"]');if(b)b.focus({preventScroll:true});return;
 }
 if(e.key==='\\'||e.key==='/'||e.key==='Backspace'||e.key==='Delete'){e.preventDefault();const v=e.key==='\\'||e.key==='/'?e.key:'';task(()=>{checking=false;return install(selected,v);});return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();task(()=>act(e.shiftKey?'redo':'undo'));}
});
window.addEventListener('porcelain-host-ready',()=>task(flush));
async function boot(){
 persistence=await createPersistence(window);const saved=await persistence.read(STORE_KEY);storageFailed=!saved.ok;store=cleanStore(saved.value);
 if(saved.value&&JSON.stringify(saved.value)!==JSON.stringify(store))await save(store);
 render();const t=await persistence.read(TUTORIAL_KEY);if(!t.value)showTutorial(0);await task(flush);
}
boot().catch(e=>{console.error(e);app.innerHTML='<p class="boot">检验台无法打开，请重新加载。</p>';});
