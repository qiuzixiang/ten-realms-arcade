import {label,evaluate} from './engine.js';
export function boardMarkup(l,s,selected,interactive){
 const result=evaluate(l,s),owner=[];l.cages.forEach((c,k)=>c.cells.forEach(i=>owner[i]=k));
 return s.values.map((v,i)=>{
  const c=l.cages[owner[i]],row=Math.floor(i/l.n),col=i%l.n;
  const edge=[row===0||owner[i-l.n]!==owner[i]?' edge-t':'',col===l.n-1||owner[i+1]!==owner[i]?' edge-r':'',row===l.n-1||owner[i+l.n]!==owner[i]?' edge-b':'',col===0||owner[i-1]!==owner[i]?' edge-l':''].join('');
  const notes=Array.from({length:l.n},(_,k)=>k+1).filter(x=>s.notes[i]&(1<<x)).join(' ');
  const error=result.invalid.includes(i),done=result.cages[owner[i]]==='done';
  const content='<span class="cage-label">'+(i===c.cells[0]?label(c):'')+'</span><span class="value">'+(v||'')+'</span><span class="notes">'+notes+'</span>'+(error?'<span class="mark">!</span>':done&&i===c.cells[0]?'<span class="mark done">✓</span>':'');
  const attrs=' class="cell'+edge+(selected===i?' selected':'')+(error?' conflict':'')+(done?' reacted':'')+'" data-cell="'+i+'" data-value="'+v+'"';
  return interactive?'<button type="button"'+attrs+' tabindex="'+(i===selected?'0':'-1')+'" aria-label="第'+(row+1)+'行第'+(col+1)+'列，'+(v?'数字'+v:'空格'+(notes?'，候选'+notes:''))+'，算笼'+label(c)+(error?'，冲突':'')+'" aria-pressed="'+(i===selected)+'">'+content+'</button>':'<div'+attrs+'>'+content+'</div>';
 }).join('');
}
