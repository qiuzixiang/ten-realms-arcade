(function(root){
 'use strict';var E=root.TerraceEngine;
 function escape(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function geometry(n){return {cell:64,gap:20,side:n*64+(n-1)*20};}
 function board(l,s,selected,interactive){
   var n=l.n,g=geometry(n),status=E.evaluate(l,s.values),duplicate=[],conflict=[];
   status.errors.forEach(function(e){(e.type==='duplicate'?duplicate:conflict).push.apply(e.type==='duplicate'?duplicate:conflict,e.cells);});
   var html='<div class="board n'+n+'" role="group" aria-label="'+n+'阶棋盘：每行每列 1 至 '+n+'，无宫格">';
   s.values.forEach(function(v,c){var x=(c%n)*84/g.side*100,y=Math.floor(c/n)*84/g.side*100,w=64/g.side*100,active=c===selected,related=selected>=0&&(Math.floor(c/n)===Math.floor(selected/n)||c%n===selected%n),dup=duplicate.indexOf(c)>=0,bad=conflict.indexOf(c)>=0;
     var attrs=' class="tile'+(active?' selected':'')+(related?' related':'')+(dup?' duplicate':'')+(bad?' inequality-error':'')+'" style="left:'+x+'%;top:'+y+'%;width:'+w+'%;height:'+w+'%" data-cell="'+c+'" data-value="'+v+'"';
     html+=(interactive?'<button type="button"'+attrs+' aria-label="'+E.position(c,n)+'，'+(v?v:'空格')+'" aria-pressed="'+active+'">':'<div'+attrs+'>')+(v?'<span class="number">'+v+'</span>':s.notes[c].length?'<span class="notes">'+s.notes[c].join(' ')+'</span>':'<span class="dot">·</span>')+(bad?'<span class="error-mark">!</span>':'')+(interactive?'</button>':'</div>');
   });
   l.relations.forEach(function(e,i){var hor=e.b===e.a+1,c=e.a,x=((c%n)*84+(hor?74:32))/g.side*100,y=(Math.floor(c/n)*84+(hor?32:74))/g.side*100;html+='<span class="relation" data-relation="'+i+'" data-a="'+e.a+'" data-b="'+e.b+'" data-sign="'+escape(e.sign)+'" style="left:'+x+'%;top:'+y+'%" title="'+E.position(e.a,n)+(e.sign==='<'?'小于':'大于')+E.position(e.b,n)+'">'+escape(E.glyph(e,n))+'</span>';});
   return html+'</div>';
 }
 function svg(l,s,stage,selected){var n=l.n,g=geometry(n),size=g.side+32,body='',numberFont=n===6?40:n===5?34:30,markFont=n===6?32:n===5?28:24,markRadius=n===6?16:n===5?14:12;
   s.values.forEach(function(v,c){var x=16+c%n*84,y=16+Math.floor(c/n)*84,active=c===selected;body+='<g data-cell="'+c+'" data-value="'+v+'"><rect x="'+x+'" y="'+y+'" width="64" height="64" rx="9" fill="'+(active?'#F3C86E':'#E2BFA7')+'" stroke="'+(active?'#793C3A':'#8D5B49')+'" stroke-width="'+(active?3:1)+'"/><text x="'+(x+32)+'" y="'+(y+42)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-size="'+numberFont+'" fill="#2E3037">'+(v||'·')+'</text></g>';});
   l.relations.forEach(function(e){var hor=e.b===e.a+1,x=16+e.a%n*84+(hor?74:32),y=16+Math.floor(e.a/n)*84+(hor?32:74);body+='<g data-a="'+e.a+'" data-b="'+e.b+'" data-sign="'+escape(e.sign)+'"><circle cx="'+x+'" cy="'+y+'" r="'+markRadius+'" fill="#FAEEE3"/><text x="'+x+'" y="'+(y+6)+'" font-family="Arial,sans-serif" font-size="'+markFont+'" font-weight="700" fill="#793C3A" text-anchor="middle">'+escape(E.glyph(e,n))+'</text></g>';});
   return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'" role="img" aria-label="真实'+n+'阶教程'+stage+'" data-stage="'+stage+'" data-level-id="'+l.id+'" data-seed="'+l.seed+'" data-checksum="'+l.checksum+'" data-board="'+s.values.join(',')+'" data-complete="'+E.evaluate(l,s.values).complete+'"><rect width="'+size+'" height="'+size+'" rx="16" fill="#F7E6D7"/>'+body+'</svg>';
 }
 // Original code-drawn ceramic architecture; heights in the result view come only from the actual filled board.
 function courtyard(values,n){var polys='',order=[];for(var r=0;r<n;r++)for(var c=0;c<n;c++)order.push({r:r,c:c});
   order.forEach(function(p){var v=values[p.r*n+p.c]||1,x=280+(p.c-p.r)*31,y=83+(p.c+p.r)*16,h=v*12,a=[x,y-h],b=[x+27,y+14-h],c=[x,y+28-h],d=[x-27,y+14-h];
     polys+='<g data-height="'+v+'"><path d="M'+d+' L'+c+' L'+[x,y+28]+' L'+[x-27,y+14]+'Z" fill="#A8533E"/><path d="M'+b+' L'+c+' L'+[x,y+28]+' L'+[x+27,y+14]+'Z" fill="#B96647"/><path d="M'+a+' L'+b+' L'+c+' L'+d+'Z" fill="'+(['#D99575','#CF8261','#DFAB88','#C97657','#D59B7A','#E3B999'][v-1])+'" stroke="#F2C6A5" stroke-width="1.2"/></g>';
   });return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 340" role="img" aria-label="按已填数字高度生成的朱陶庭院"><defs><linearGradient id="sun" x2="0" y2="1"><stop stop-color="#F2D0BC"/><stop offset="1" stop-color="#F7E6D7"/></linearGradient></defs><rect width="560" height="340" fill="url(#sun)"/><circle cx="438" cy="63" r="36" fill="#F3C86E" opacity=".6"/><path d="M54 215V46L145 19V176M435 245V119L514 83V224" fill="#E8BBAB" stroke="#C89483" stroke-width="2"/><path d="M72 242L282 129L498 242L280 333Z" fill="#D9B59A"/><path d="M103 243L281 149L458 243L280 315Z" fill="#CDA589"/>'+polys+'<path d="M64 267Q78 241 95 256M64 267Q57 244 49 251M480 267Q488 244 502 249" fill="none" stroke="#6A7C76" stroke-width="5" stroke-linecap="round"/><ellipse cx="66" cy="280" rx="18" ry="12" fill="#C96B48"/><path d="M49 271h34l-5 21H54Z" fill="#AD5F48"/></svg>';
 }
 root.TerraceView={escape:escape,geometry:geometry,board:board,svg:svg,courtyard:courtyard};if(typeof module!=='undefined')module.exports=root.TerraceView;
})(typeof window!=='undefined'?window:global);
