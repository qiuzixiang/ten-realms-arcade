import {CAMPAIGN,TUTORIAL} from './campaign.js';
import {createState,apply,replay,evaluate,label,hint} from './engine.js';
import {boardMarkup} from './renderer.js';
import {PREFIX,SAVE_KEY,TUTORIAL_KEY,fresh,restore,newRun,record,settle,flush,dailyIndex} from './session.js';
const $=id=>document.getElementById(id),levels=CAMPAIGN.levels;
let storage=true,raw=null;try{raw=localStorage.getItem(SAVE_KEY);}catch(e){storage=false;}
let data=restore(raw,levels),level,state,run,selected=0,noteMode=false,modalKind='',returnFocus=null,tutorialStep=0,bookChapter=0,flushing=false;
const tips=['每行、每列填入 1 到 N，各出现一次。先看小目标，再用行列排除。','乘法先想因数组合：哪些数字相乘，恰好得到目标？','减法只用两格，大数减小数。差值不规定数字放在哪一边。','除法只用两格，大数除以小数，结果必须精确为整数。','一个算笼的候选，会改变交叉行列。留意线索之间的联系。','把加、乘、差与整除放在一起，慢慢完成最后一册配方。'];
const meanings={'+':'笼内数字相加','*':'笼内数字相乘','-':'两格大数减小数','/':'两格大数除以小数','=':'单格直接填目标'};
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));storage=true;$('save-state').textContent='已在本地保存';return true;}catch(e){storage=false;$('save-state').textContent='保存失败 · 本次仅临时保留';return false;}}
async function deliver(){if(flushing)return;flushing=true;await flush(data,persist,window.stardewCompletionHost);flushing=false;}
function load(index){data.active=index;level=levels[index];run=data.sessions[level.id]||newRun();data.sessions[level.id]=run;state=replay(level,run.events)||createState(level);selected=0;noteMode=false;render();persist();if(evaluate(level,state).complete)complete();}
function collection(){return CAMPAIGN.chapters.map((name,ch)=>{const count=levels.filter(l=>l.chapter===ch&&data.completed[l.id]).length;return '<div class="vial" style="--fill:'+count*10+'%" title="'+name+' '+count+'/10" aria-label="'+name+' '+count+'/10"><span>'+count+'/10</span></div>';}).join('');}
function render(){
 const active=document.activeElement,numberFocus=active&&active.dataset.number,boardFocus=active&&active.hasAttribute('data-cell');
 const result=evaluate(level,state),count=Object.keys(data.completed).length;
 $('chapter-label').textContent='CHAPTER '+String(level.chapter+1).padStart(2,'0')+' / '+CAMPAIGN.chapters[level.chapter];
 $('level-title').textContent='配方 '+String(data.active+1).padStart(2,'0')+' · '+(['初露','晨光','流萤','月影','星河','星露'][level.chapter]);
 $('progress').textContent=count+'/60';$('progress-fill').style.width=count/60*100+'%';
 $('stage').textContent=level.stage+' · '+level.n+' × '+level.n;$('cage-count').textContent=result.cages.filter(x=>x==='done').length+' / '+level.cages.length+' 算笼满足';
 $('board').style.gridTemplateColumns='repeat('+level.n+',1fr)';$('board').innerHTML=boardMarkup(level,state,selected,true);
 $('rule-line').textContent='每行每列 1–'+level.n+' 不重复 · 粗线内按运算达到目标';
 $('keypad').innerHTML=Array.from({length:level.n},(_,k)=>'<button type="button" data-number="'+(k+1)+'" aria-label="'+(noteMode?'候选':'填入')+(k+1)+'">'+(k+1)+'</button>').join('');
 $('note').setAttribute('aria-pressed',String(noteMode));$('note').textContent=noteMode?'✎ 候选中':'✎ 候选';$('undo').disabled=!state.history.length;
 const c=level.cages.find(c=>c.cells.includes(selected));$('selection').textContent='第 '+(Math.floor(selected/level.n)+1)+' 行 · 第 '+(selected%level.n+1)+' 列　'+label(c)+' '+meanings[c.op];
 $('chapter-name').textContent=CAMPAIGN.chapters[level.chapter];$('chapter-tip').textContent=tips[level.chapter];
 const example=level.cages.find(c=>c.op===['+','*','-','/','*','/'][level.chapter])||level.cages[0];$('sample-label').textContent=label(example);$('sample-meaning').textContent=meanings[example.op];$('collection').innerHTML=collection();
 $('win').hidden=!result.complete;
 if(boardFocus)$('board').children[selected].focus();else if(numberFocus){const key=$('keypad').querySelector('[data-number="'+numberFocus+'"]');if(key)key.focus();}
 if(!result.complete)$('message').textContent=result.invalid.length?'标有 ! 的位置需要检查。修改数字或撤销，随时可以继续。':noteMode?'候选模式：数字只作笔记，不参与判胜。':'选中一格，放入合适的数字。';
}
function complete(){const first=settle(data,level,run,state);persist();render();$('message').textContent='每行、每列与所有算笼均已验证。';$('win-copy').textContent=first?'这份配方已收入收藏。再添一点微光。':'再次调制成功，收藏已保留，不重复计数。';$('next').textContent=data.active===59?'翻开配方册 →':'下一配方 →';deliver();}
function action(a){if(run.events.length>=2000){$('message').textContent='本局操作记录已满，请重新调制；已获收藏会保留。';return;}const next=record(level,run,state,a);if(next===state)return;state=next;persist();render();if(evaluate(level,state).complete)complete();}
$('board').addEventListener('click',e=>{const b=e.target.closest('[data-cell]');if(!b)return;selected=Number(b.dataset.cell);render();$('board').children[selected].focus();});
$('keypad').addEventListener('click',e=>{const b=e.target.closest('[data-number]');if(b)action({type:noteMode?'note':'fill',cell:selected,value:Number(b.dataset.number)});});
$('note').addEventListener('click',()=>{noteMode=!noteMode;render();});
$('erase').addEventListener('click',()=>action({type:'fill',cell:selected,value:0}));
$('undo').addEventListener('click',()=>action({type:'undo'}));
$('hint').addEventListener('click',()=>{const h=hint(level,state);if(h.cell!==undefined)selected=h.cell;render();$('message').textContent=h.text;});
$('next').addEventListener('click',()=>{if(data.active===59)openBook();else load(data.active+1);});
function openModal(kind){returnFocus=document.activeElement;modalKind=kind;$('modal').hidden=false;document.body.classList.add('modal-open');$('shell').setAttribute('aria-hidden','true');$('modal').querySelector('.dialog').scrollTop=0;}
function focusModal(){$('close-modal').focus();$('modal').querySelector('.dialog').scrollTop=0;}
function closeModal(){if(modalKind==='tutorial')try{localStorage.setItem(TUTORIAL_KEY,'seen');}catch(e){}modalKind='';$('modal').hidden=true;document.body.classList.remove('modal-open');$('shell').removeAttribute('aria-hidden');if(returnFocus&&document.contains(returnFocus))returnFocus.focus();else $('help').focus();}
$('close-modal').addEventListener('click',closeModal);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
function tutorial(){
 const p=levels.find(l=>l.id===TUTORIAL.levelId);let s=createState(p);
 if(tutorialStep===1)s=apply(p,s,TUTORIAL.action);
 if(tutorialStep===2)TUTORIAL.answer.forEach((v,i)=>s=apply(p,s,{type:'fill',cell:i,value:v}));
 const titles=['认一认，铜线里的配方','选一格，放入一个数字','每一格，都恰到好处'];
 const text=['这是配方 01 的真实初态。每行每列填 1–'+p.n+' 且不重复；同一粗线算笼内，数字要按左上角运算达到目标。单格线索直接填。','选中第 1 行第 1 列，再点数字 '+TUTORIAL.action.value+'。画面是这一步真实操作后的状态。候选按钮只作笔记；数字可擦除，也可撤销。','这是同一配方的真实完成态：行列数字不重复，所有算笼同时满足。减法取两格差的绝对值；除法取大数除小数；不同列不同行的同笼数字允许相同。'];
 $('modal-eyebrow').textContent='调制指南 · '+(tutorialStep+1)+' / 3';
 $('modal-content').innerHTML='<h2 id="modal-title">'+titles[tutorialStep]+'</h2><p>'+text[tutorialStep]+'</p><div class="board tutorial-board" role="img" aria-label="配方01，教程第'+(tutorialStep+1)+'步，'+(tutorialStep===2?'引擎验证完成':tutorialStep===1?'一次合法填入':'空白初态')+'" data-level="'+p.id+'" data-complete="'+evaluate(p,s).complete+'" style="grid-template-columns:repeat('+p.n+',1fr)">'+boardMarkup(p,s,tutorialStep===1?0:-1,false)+'</div><p class="modal-footnote">键盘：方向键选格，数字填入，N 切候选，Backspace 擦除，Ctrl / ⌘ Z 撤销。无需计时，慢慢来。</p>';
 $('modal-actions').innerHTML='<button id="skip">'+(tutorialStep?'上一步':'跳过教程')+'</button><button id="tutorial-next" class="primary">'+(tutorialStep===2?'开始调制':'下一张 →')+'</button>';
 $('skip').onclick=()=>{if(tutorialStep){tutorialStep--;tutorial();}else closeModal();};$('tutorial-next').onclick=()=>{if(tutorialStep===2)closeModal();else{tutorialStep++;tutorial();}};
 focusModal();
}
function openTutorial(){openModal('tutorial');tutorialStep=0;tutorial();}
$('help').addEventListener('click',openTutorial);
function book(){
 $('modal-eyebrow').textContent='RECIPE COLLECTION · '+Object.keys(data.completed).length+' / 60';
 $('modal-content').innerHTML='<h2 id="modal-title">六册微光，慢慢收藏</h2><p>所有配方均可选择。✓ 表示已完成的不同配方。</p><div class="chapter-tabs">'+CAMPAIGN.chapters.map((name,i)=>'<button data-chapter="'+i+'" class="'+(i===bookChapter?'active':'')+'">'+(i+1)+'. '+name+'</button>').join('')+'</div><p>'+tips[bookChapter]+'</p><div class="level-grid">'+levels.map((l,i)=>l.chapter!==bookChapter?'':'<button data-level-index="'+i+'" class="'+(data.completed[l.id]?'completed':'')+'" aria-label="配方'+(i+1)+' '+l.stage+(data.completed[l.id]?' 已完成':'')+'">'+(data.completed[l.id]?'✓ ': '')+String(i+1).padStart(2,'0')+'<small>'+l.stage+' · '+l.n+'×'+l.n+'</small></button>').join('')+'</div><div class="collection">'+collection()+'</div><p class="modal-footnote">每日调制按北京时间每日轮换，来自这 60 道配方，60 天循环。收藏保存在当前浏览器，清除网站数据会丢失。</p>';
 $('modal-actions').innerHTML='<button id="book-back" class="primary">回到实验台</button>';$('book-back').onclick=closeModal;
 $('modal-content').querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>{bookChapter=Number(b.dataset.chapter);book();$('modal-content').querySelector('[data-chapter="'+bookChapter+'"]').focus();});
 $('modal-content').querySelectorAll('[data-level-index]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.levelIndex);closeModal();load(i);});focusModal();
}
function openBook(){openModal('book');bookChapter=level.chapter;book();}
$('chapters').addEventListener('click',openBook);$('collection-open').addEventListener('click',openBook);
$('restart').addEventListener('click',()=>{openModal('restart');$('modal-eyebrow').textContent='A FRESH RECIPE';$('modal-content').innerHTML='<h2 id="modal-title">重新调制这份配方？</h2><p>将清空当前数字和候选笔记，已完成的收藏会保留。</p>';$('modal-actions').innerHTML='<button id="cancel-restart">继续当前配方</button><button id="confirm-restart" class="primary">重新调制</button>';$('cancel-restart').onclick=closeModal;$('confirm-restart').onclick=()=>{closeModal();data.sessions[level.id]=newRun();load(data.active);};focusModal();});
$('daily').addEventListener('click',()=>{load(dailyIndex(new Date(),levels.length));$('message').textContent='今日配方 · 北京时间每天轮换，60 道题循环，与配方册共用进度。';});
document.addEventListener('keydown',e=>{
 if(modalKind){if(e.key==='Escape'){e.preventDefault();closeModal();}if(e.key==='Tab'){const all=Array.from($('modal').querySelectorAll('button:not(:disabled),[tabindex="0"]'));const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(e.altKey)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();action({type:'undo'});return;}
 if(e.ctrlKey||e.metaKey)return;
 const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-level.n,ArrowDown:level.n}[e.key];
 if(offset!==undefined){e.preventDefault();selected=(selected+offset+state.values.length)%state.values.length;render();$('board').children[selected].focus();}
 else if(/^[1-5]$/.test(e.key)){e.preventDefault();action({type:noteMode?'note':'fill',cell:selected,value:Number(e.key)});}
 else if(e.key==='Backspace'||e.key==='Delete'||e.key==='0'){e.preventDefault();action({type:'fill',cell:selected,value:0});}
 else if(e.key.toLowerCase()==='n'){noteMode=!noteMode;render();}
});
window.addEventListener('stardew-host-ready',deliver);
load(data.active);deliver();
let seen=false;try{seen=localStorage.getItem(TUTORIAL_KEY)==='seen';}catch(e){}if(!seen)openTutorial();
if(raw&&JSON.stringify(restore(raw,levels))!==raw){$('message').textContent='已重新验证本地记录；无法验证的内容不会计入收藏。';}
