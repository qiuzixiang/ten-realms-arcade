var LoomView=(function(){
 function symbol(v){return v===1?'☀':v===0?'☾':'·';}
 function svg(p,cells,highlight){var n=p.n,size=n*64;return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'" role="img" data-level="'+p.id+'" data-cells="'+cells.join(',')+'"><rect width="100%" height="100%" fill="#172c42"/>'+cells.map(function(v,i){var x=i%n*64,y=Math.floor(i/n)*64;return '<g data-cell="'+i+'" data-value="'+v+'"><rect x="'+(x+3)+'" y="'+(y+3)+'" width="58" height="58" rx="7" fill="'+(v===1?'#f3e6c9':v===0?'#29465e':'#1e354b')+'" stroke="'+(i===highlight?'#e9b977':'#76909a')+'" stroke-width="'+(i===highlight?3:1)+'"/><text x="'+(x+32)+'" y="'+(y+42)+'" text-anchor="middle" font-size="34" fill="'+(v===1?'#26384b':'#f3e6c9')+'">'+symbol(v)+'</text>'+(p.givens[i]!==-1?'<circle cx="'+(x+12)+'" cy="'+(y+12)+'" r="2" fill="'+(v===1?'#26384b':'#f3e6c9')+'"/>':'')+'</g>';}).join('')+'</svg>';}
 return {symbol:symbol,svg:svg};
}());
