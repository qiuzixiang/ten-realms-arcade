var Dye = typeof Dye !== 'undefined' ? Dye : {};
(function () {
  'use strict';
  var colours = [
    {name:'胭脂',symbol:'✿',hex:'#bc725e',ink:'#fff8e8',motif:'花'},
    {name:'松烟',symbol:'╱',hex:'#527b70',ink:'#f4f1d9',motif:'竹'},
    {name:'栀子',symbol:'◇',hex:'#d5ad64',ink:'#513f2e',motif:'菱'},
    {name:'靛青',symbol:'≈',hex:'#647f99',ink:'#f6f1e5',motif:'水'},
    {name:'藕荷',symbol:'○',hex:'#a286a0',ink:'#fff3e9',motif:'月'},
    {name:'茶褐',symbol:'✚',hex:'#8b775d',ink:'#fff4db',motif:'十'}
  ];
  function glyph(c,x,y,s) {
    var st=' fill="none" stroke="'+colours[c].ink+'" stroke-width="'+Math.max(1.4,s*0.045)+'" stroke-linecap="round" stroke-linejoin="round"';
    var a=s*0.15;
    if(c===0) return '<path d="M '+(x-a)+' '+y+' Q '+(x-a)+' '+(y-2*a)+' '+x+' '+(y-a)+' Q '+(x+2*a)+' '+(y-a)+' '+(x+a)+' '+y+' Q '+(x+a)+' '+(y+2*a)+' '+x+' '+(y+a)+' Q '+(x-2*a)+' '+(y+a)+' '+(x-a)+' '+y+' Z"'+st+'/>';
    if(c===1) return '<path d="M '+(x-a)+' '+(y+a)+' L '+(x+a)+' '+(y-a)+' M '+(x-a)+' '+(y-a*.3)+' L '+x+' '+(y-a*1.3)+' M '+x+' '+(y+a*1.3)+' L '+(x+a)+' '+(y+a*.3)+'"'+st+'/>';
    if(c===2) return '<path d="M '+x+' '+(y-a*1.3)+' L '+(x+a)+' '+y+' L '+x+' '+(y+a*1.3)+' L '+(x-a)+' '+y+' Z"'+st+'/>';
    if(c===3) return '<path d="M '+(x-a*1.4)+' '+(y-a*.5)+' Q '+(x-a*.5)+' '+(y-a*1.4)+' '+x+' '+(y-a*.5)+' T '+(x+a*1.4)+' '+(y-a*.5)+' M '+(x-a*1.4)+' '+(y+a*.7)+' Q '+(x-a*.5)+' '+(y-a*.2)+' '+x+' '+(y+a*.7)+' T '+(x+a*1.4)+' '+(y+a*.7)+'"'+st+'/>';
    if(c===4) return '<circle cx="'+x+'" cy="'+y+'" r="'+a+'"'+st+'/>';
    return '<path d="M '+(x-a)+' '+y+' H '+(x+a)+' M '+x+' '+(y-a)+' V '+(y+a)+'"'+st+'/>';
  }
  function boardSvg(board,width,height,options) {
    options=options||{};
    var unit=480/width, ch=480/height;
    var controlled=Dye.Engine.component(board,width,height,0);
    var set={}; controlled.forEach(function(i){set[i]=true;});
    var absorbed=options.absorbed||[];
    var old=options.recoloured||[];
    var result='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" role="img" aria-label="'+(options.label||'染布：左上角白线内为当前连通区域')+'" data-cells="'+board.length+'" data-controlled="'+controlled.length+'" data-moves="'+(options.moves||0)+'">';
    var descriptions=[];for(var row=0;row<height;row++){descriptions.push('第'+(row+1)+'行：'+board.slice(row*width,(row+1)*width).map(function(c){return colours[c].name+colours[c].motif+'纹';}).join('、'));}
    result+='<desc>共'+width+'列'+height+'行，已连通'+controlled.length+'格。'+descriptions.join('。')+'。</desc>';
    result+='<defs><pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0H6M0 3H6" stroke="#fff" stroke-opacity=".075"/><path d="M0 0V6M3 0V6" stroke="#192e26" stroke-opacity=".07"/></pattern></defs>';
    board.forEach(function(c,i){
      var x=(i%width)*unit,y=Math.floor(i/width)*ch;
      var pulse=absorbed.indexOf(i)>=0||old.indexOf(i)>=0;
      result+='<g data-cell="'+i+'" data-colour="'+c+'" class="tile'+(pulse?' dye-spread':'')+'" style="animation-delay:'+Math.floor((x+y)*.3)+'ms"><rect x="'+x+'" y="'+y+'" width="'+(unit+.2)+'" height="'+(ch+.2)+'" fill="'+colours[c].hex+'"/><rect x="'+x+'" y="'+y+'" width="'+unit+'" height="'+ch+'" fill="url(#weave)"/>';
      result+=glyph(c,x+unit/2,y+ch/2,Math.min(unit,ch));
      result+='<path d="M'+x+' '+(y+ch)+'H'+(x+unit)+'V'+y+'" fill="none" stroke="#20392e" stroke-opacity=".12" stroke-width="1"/>';
      if(set[i]) {
        var path='';
        if(i<width||!set[i-width])path+='M'+(x+2)+' '+(y+2)+'H'+(x+unit-2);
        if(i>=board.length-width||!set[i+width])path+='M'+(x+2)+' '+(y+ch-2)+'H'+(x+unit-2);
        if(i%width===0||!set[i-1])path+='M'+(x+2)+' '+(y+2)+'V'+(y+ch-2);
        if(i%width===width-1||!set[i+1])path+='M'+(x+unit-2)+' '+(y+2)+'V'+(y+ch-2);
        result+='<path d="'+path+'" fill="none" stroke="#fff9e9" stroke-width="3" stroke-dasharray="6 3" class="control-edge"/>';
      }
      result+='</g>';
    });
    result+='<circle cx="9" cy="9" r="6" fill="#fff9e9" stroke="#2d534a" stroke-width="2"/></svg>';
    return result;
  }
  Dye.Render={colours:colours,glyph:glyph,boardSvg:boardSvg};
}());
