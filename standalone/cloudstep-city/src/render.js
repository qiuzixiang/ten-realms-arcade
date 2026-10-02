var CityRender=(function(){
 function svg(p,b){const n=p.n,cell=48,pad=30,size=n*cell+pad*2;let out='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'" data-puzzle="'+p.id+'" role="img"><rect width="100%" height="100%" rx="16" fill="#f7f2e9"/>';
  b.forEach((v,i)=>{let x=pad+(i%n)*cell,y=pad+Math.floor(i/n)*cell;out+='<rect x="'+(x+2)+'" y="'+(y+2)+'" width="44" height="44" rx="7" fill="'+(v?'#ead6c4':'#fffdf8')+'" stroke="#c6b8a6"/><text data-cell="'+i+'" data-value="'+v+'" x="'+(x+24)+'" y="'+(y+31)+'" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#2c4846">'+(v||'·')+'</text>';});
  City.sides.forEach(s=>p.clues[s].forEach((v,i)=>{const x=s==='left'?14:s==='right'?size-14:pad+i*cell+24,y=s==='top'?19:s==='bottom'?size-8:pad+i*cell+31;out+='<text data-side="'+s+'" data-index="'+i+'" x="'+x+'" y="'+y+'" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#2c4846">'+(v||'—')+'</text>';}));return out+'</svg>';
 }
 return {svg:svg};
})();
