var BellRender = (function () {
  'use strict';
  function bell(on){return '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="hanger" d="M32 0v12m-5 3a5 5 0 0 1 10 0"/><path class="shell" d="M17 40c4-5 3-14 6-19 4-6 14-6 18 0 3 5 2 14 6 19l4 5H13z"/><path class="rim" d="M15 45h34"/>'+(on?'<path class="shine" d="M22 29l3-6m13 3l2 7"/><path class="clapper" d="M32 45v8m-4 0h8"/><path class="rays" d="M8 22l-4-3m52 3l4-3M7 32H2m55 0h5"/>':'<path class="closed" d="M22 49h20m-10-4v3"/>')+'</svg>';}
  function picture(l,lights,selected,id){
    var cell=76,pad=12,size=l.size*cell+pad*2,lines='',bells='';
    if(selected>=0)l.templates[selected].forEach(function(j){if(j===selected)return;lines+='<path d="M'+(pad+(selected%l.size+.5)*cell)+' '+(pad+(Math.floor(selected/l.size)+.5)*cell)+'L'+(pad+(j%l.size+.5)*cell)+' '+(pad+(Math.floor(j/l.size)+.5)*cell)+'" stroke="#e9c18b" stroke-width="2"/>';});
    lights.forEach(function(on,i){var affected=selected>=0&&l.templates[selected].indexOf(i)>=0; bells+='<g data-cell="'+i+'" data-light="'+on+'" transform="translate('+(pad+i%l.size*cell)+','+(pad+Math.floor(i/l.size)*cell)+')"><rect x="3" y="3" width="70" height="70" rx="12" fill="'+(on?'#385859':'#21373e')+'" stroke="'+(affected?'#ecc78d':'#557172')+'" stroke-width="'+(i===selected?3:1)+'"/><path d="M38 8v10m-5 0a5 5 0 0 1 10 0M23 49c5-7 2-25 15-25s10 18 15 25z" fill="'+(on?'#e8bd7f':'#789797')+'" stroke="#e8bd7f"/>'+(on?'<path d="M38 50v6m-4 0h8" stroke="#ffe5ad" stroke-width="3"/>':'<path d="M29 54h18" stroke="#90abab" stroke-width="2"/>')+'<text x="38" y="69" text-anchor="middle" fill="#e9dfc6" font-size="10">'+(i+1)+'</text></g>';});
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'" data-level="'+l.id+'" data-state="'+lights.join('')+'" role="img" aria-label="'+id+'"><rect width="'+size+'" height="'+size+'" rx="16" fill="#182e36"/>'+bells+'<g opacity=".7">'+lines+'</g></svg>';
  }
  return {bell:bell,picture:picture};
}());
