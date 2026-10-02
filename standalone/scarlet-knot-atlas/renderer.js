(function(root){
  'use strict';
  var C=root.ScarletCore;
  if(typeof module!=='undefined'&&module.exports) C=require('./core.js');
  function escape(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
  function knot(a,b,c,d){
    var rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
    if(Math.abs(den)>C.EPS){var t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den;return {x:a.x+t*rx,y:a.y+t*ry};}
    var choices=[a,b,c,d].filter(function(p){return p.x>=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))-C.EPS&&p.x<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+C.EPS&&p.y>=Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))-C.EPS&&p.y<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+C.EPS;});
    if(choices.length)return choices.reduce(function(v,p){return {x:v.x+p.x/choices.length,y:v.y+p.y/choices.length};},{x:0,y:0});
    return {x:(a.x+b.x+c.x+d.x)/4,y:(a.y+b.y+c.y+d.y)/4};
  }
  function svg(level,points,options){
    options=options||{};
    var width=options.width||350,height=options.height||400,byId={},cross=C.pairs(points,level.edges),marked={};
    points.forEach(function(p){byId[p.id]=p;});
    cross.forEach(function(pair){marked[pair[0]]=true;marked[pair[1]]=true;});
    function pos(p){return {x:18+p.x*(width-36),y:20+p.y*(height-40)};}
    var out='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escape(level.name+'，'+cross.length+' 对交叉')+'" data-level="'+escape(level.id)+'" data-crossings="'+cross.length+'">';
    out+='<defs><pattern id="silk" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 1H6M1 0V6" stroke="#241b20" opacity=".025" stroke-width=".5"/></pattern></defs><rect x="1" y="1" width="'+(width-2)+'" height="'+(height-2)+'" rx="8" fill="#f6ebd9" stroke="#b98745"/><rect x="8" y="8" width="'+(width-16)+'" height="'+(height-16)+'" fill="url(#silk)"/><path d="M8 28V8H28M'+(width-28)+' 8H'+(width-8)+'V28M8 '+(height-28)+'V'+(height-8)+'H28M'+(width-28)+' '+(height-8)+'H'+(width-8)+'V'+(height-28)+'" fill="none" stroke="#815c29" stroke-width="2"/>';
    level.edges.forEach(function(e,i){var a=pos(byId[e[0]]),b=pos(byId[e[1]]),dim=options.onlySelected&&e[0]!==options.selected&&e[1]!==options.selected;
      out+='<line data-edge="'+i+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#9f3040" stroke-width="2" opacity="'+(dim?'.16':'1')+'"/>';
      if(marked[i]&&!dim){var x=(a.x+b.x)/2,y=(a.y+b.y)/2;out+='<path d="M'+(x-3)+' '+(y-5)+'l3 7m1-8l3 7" stroke="#6e2036" stroke-width="1.5"/>';}
    });
    cross.forEach(function(pair){var e=level.edges[pair[0]],f=level.edges[pair[1]];if(options.onlySelected&&e.indexOf(options.selected)<0&&f.indexOf(options.selected)<0)return;var p=pos(knot(byId[e[0]],byId[e[1]],byId[f[0]],byId[f[1]]));out+='<path data-knot="'+pair.join('-')+'" d="M'+p.x+' '+(p.y-5)+'l5 5-5 5-5-5Z" fill="#fff6e8" stroke="#a12827" stroke-width="1.5"/>';});
    points.forEach(function(p){var q=pos(p),selected=p.id===options.selected;
      out+='<g data-node="'+p.id+'" data-x="'+p.x+'" data-y="'+p.y+'">';
      if(selected)out+='<rect x="'+(q.x-19)+'" y="'+(q.y-19)+'" width="38" height="38" rx="9" fill="none" stroke="#2e6e66" stroke-width="2"/><rect x="'+(q.x-16)+'" y="'+(q.y-16)+'" width="32" height="32" rx="7" fill="none" stroke="#2e6e66"/>';
      var radius=p.id%3===0?3:p.id%3===1?10:6;
      out+='<rect x="'+(q.x-13)+'" y="'+(q.y-12)+'" width="26" height="26" rx="'+radius+'" fill="#6e2036" opacity=".16"/><rect x="'+(q.x-13)+'" y="'+(q.y-14)+'" width="26" height="26" rx="'+radius+'" fill="#fff9ec" stroke="#815c29" stroke-width="1.7"/><text x="'+q.x+'" y="'+(q.y+4)+'" text-anchor="middle" fill="#241b20" font-family="sans-serif" font-size="14" font-weight="700">'+(p.id+1)+'</text></g>';
    });
    return out+'</svg>';
  }
  var api={svg:svg,knot:knot};root.ScarletRenderer=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
}(typeof window!=='undefined'?window:this));
