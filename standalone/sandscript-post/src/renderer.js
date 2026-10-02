(function(root){'use strict';
var glyphs=['↑','↗','→','↘','↓','↙','←','↖'], labels=['上','右上','右','右下','下','左下','左','左上'];
function svg(l,next,selected,notes){var E=root.SandEngine,view=E.inspect(l,next),size=l.size,unit=100,w=size*unit,out='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+w+'" role="img" aria-label="邮路棋盘" data-level="'+l.id+'" data-edges="'+view.edges+'" data-won="'+view.won+'">';
 out+='<rect width="'+w+'" height="'+w+'" rx="14" fill="#e7d9bd"/>';
 for(var a=0;a<next.length;a++)if(next[a]>=0){var b=next[a],x1=(a%size+.5)*unit,y1=(Math.floor(a/size)+.5)*unit,x2=(b%size+.5)*unit,y2=(Math.floor(b/size)+.5)*unit;out+='<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" stroke="'+(a===selected?'#9f482f':'#466f65')+'" stroke-width="'+(a===selected?7:4)+'" opacity=".55" fill="none" data-edge="'+a+'-'+b+'"/>';}
 for(var i=0;i<next.length;i++){
 var x=i%size*unit+11,y=Math.floor(i/size)*unit+11,given=l.givens[i],target=selected>=0&&E.apply(l,next,{type:'link',a:selected,b:i}).changed,sel=i===selected,number=given||view.numbers[i],mark=notes&&notes.indexOf(i)>=0;
 out+='<g data-cell="'+i+'"><rect x="'+x+'" y="'+y+'" width="78" height="78" rx="8" fill="'+(sel?'#244e47':'#fff9ea')+'" stroke="'+(sel?'#244e47':target?'#9f482f':'#c6b795')+'" stroke-width="'+(sel||target?3:1)+'"'+(target?' stroke-dasharray="5 3"':'')+'/>';
 out+='<text x="'+(x+9)+'" y="'+(y+21)+'" font-family="Georgia,serif" font-size="23" fill="'+(sel?'#fff4d6':given?'#9f482f':'#466f65')+'" font-weight="bold">'+(number||'·')+'</text>';
 if(given)out+='<path d="M'+(x+7)+' '+(y+25)+'h20" stroke="'+(sel?'#fff4d6':'#9f482f')+'"/>';
 out+='<text x="'+(x+40)+'" y="'+(y+56)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" fill="'+(sel?'#fff4d6':'#244e47')+'">'+(l.arrows[i]<0?'✉':glyphs[l.arrows[i]])+'</text>';
 if(mark)out+='<circle cx="'+(x+65)+'" cy="'+(y+12)+'" r="5" fill="#9f482f"/>';
 out+='<text x="'+(x+69)+'" y="'+(y+70)+'" text-anchor="end" font-size="16" fill="'+(sel?'#fff4d6':'#786e59')+'">'+String.fromCharCode(65+i%size)+(Math.floor(i/size)+1)+'</text></g>';
 }return out+'</svg>';}
function label(l,next,i){var view=root.SandEngine.inspect(l,next);return '站点'+String.fromCharCode(65+i%l.size)+(Math.floor(i/l.size)+1)+'，'+(l.givens[i]?'固定号码'+l.givens[i]:view.numbers[i]?'推定号码'+view.numbers[i]:'号码待定')+'，'+(l.arrows[i]<0?'终点信箱':'箭头向'+labels[l.arrows[i]])+(next[i]>=0?'，已连至'+String.fromCharCode(65+next[i]%l.size)+(Math.floor(next[i]/l.size)+1):'');}
root.SandRender={svg:svg,label:label};
})(typeof window==='undefined'?globalThis:window);
