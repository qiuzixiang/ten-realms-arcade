(function(root){
'use strict';
function boardHTML(board,selection,target,focus){
 return '<div class="loom"><div class="board" role="img" aria-label="数字织台：'+board.join('，')+'" data-board="'+board.join(',')+'">'+board.map((value,p)=>{
  const active=selection&&(selection.axis==='row'?Math.floor(p/4)===selection.index:p%4===selection.index);
  return '<div class="tile color-'+((value-1)%4)+' pattern-'+(Math.floor((value-1)/4)%4)+(active?' selected':'')+(value===p+1?' correct':'')+(focus===value?' hinted':'')+'" data-value="'+value+'" data-position="'+p+'" style="left:'+((p%4)*25)+'%;top:'+(Math.floor(p/4)*25)+'%"><div class="cloth"><i class="weave" aria-hidden="true"></i><span class="tag">'+value+'</span>'+(target?'<span class="target">目标 '+(p+1)+'</span>':'')+'<span class="pin" aria-hidden="true">'+(value===p+1?'·':'')+'</span></div></div>';
 }).join('')+'</div><div class="fringe" aria-hidden="true"></div></div>';
}
function actionText(a){return '第 '+(a.index+1)+(a.axis==='row'?' 行向'+(a.direction===1?'右':'左'):' 列向'+(a.direction===1?'下':'上'))+'一格';}
function swatchHTML(l){const colors=['#354a90','#97334f','#785719','#354a90','#97334f','#785719'];return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" aria-hidden="true" data-swatch-level="'+l.id+'">'+l.initial.map((v,p)=>{const wrong=v!==p+1,x=4+(p%4)*58,y=4+Math.floor(p/4)*18;return '<rect x="'+x+'" y="'+y+'" width="54" height="14" fill="'+(wrong?colors[l.chapter]:'#e8dac4')+'" stroke="'+(wrong?'#283033':'#bfae91')+'" stroke-width="'+(wrong?2:1)+'"/>'+(wrong?'<path d="M'+(x+3)+' '+(y+4)+'h48m-48 6h48" stroke="#fff8ed" stroke-opacity=".45" stroke-dasharray="2 3"/>':'');}).join('')+'</svg>';}
root.SilkView={boardHTML,actionText,swatchHTML};if(typeof module!=='undefined')module.exports=root.SilkView;
})(typeof window!=='undefined'?window:globalThis);
