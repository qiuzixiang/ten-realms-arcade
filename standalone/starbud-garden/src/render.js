var Starbud = typeof Starbud === 'undefined' ? {} : Starbud;
(function(S){
'use strict';
const palette=['#9de5c2','#e7c783','#b4c7fa','#dcb0d7','#7dd3d6','#d8e0a0'];
function flower(x,y,size,color,label){return '<g transform="translate('+x+' '+y+')"><circle r="'+size*1.4+'" fill="'+color+'" opacity=".08"/>'+[0,60,120].map(a=>'<ellipse rx="'+size*.46+'" ry="'+size+'" fill="none" stroke="'+color+'" stroke-width="1.1" transform="rotate('+a+')"/>').join('')+'<circle r="'+size*.35+'" fill="'+color+'"/>'+(label?'<text x="'+(size+3)+'" y="'+(-size+1)+'" class="core-label">'+label+'</text>':'')+'</g>';}
function render(p,state,options){options=options||{};const size=60,pad=12,w=p.w*size,h=p.h*size,result=S.evaluate(p,state),core=p.cores[options.core||0],selected=options.selected,paired=Number.isSafeInteger(selected)?S.mirror(p,selected,core):-1;let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 '+(w+24)+' '+(h+24)+'" role="img" aria-label="'+p.w+'乘'+p.h+'星芽棋盘" data-level="'+p.id+'" data-complete="'+result.complete+'">';
 s+='<rect x="0" y="0" width="'+w+'" height="'+h+'" rx="4" fill="#102d3b"/>';
 result.groups.filter(g=>g.valid).forEach(g=>g.cells.forEach(i=>{s+='<rect x="'+(i%p.w*size)+'" y="'+(Math.floor(i/p.w)*size)+'" width="60" height="60" fill="'+palette[g.core%6]+'" opacity=".15"/>';s+='<circle cx="'+(i%p.w*size+7)+'" cy="'+(Math.floor(i/p.w)*size+7)+'" r="2" fill="#a1e6c2"/>';}));
 Object.keys(state.notes).forEach(i=>{s+='<text x="'+(i%p.w*size+11)+'" y="'+(Math.floor(i/p.w)*size+49)+'" class="note-label">·'+(state.notes[i]+1)+'</text>';});
 if(paired>=0)s+='<rect x="'+(paired%p.w*size+5)+'" y="'+(Math.floor(paired/p.w)*size+5)+'" width="50" height="50" rx="8" fill="#e7c783" opacity=".14" stroke="#e7c783" stroke-dasharray="4 3" stroke-width="2"/>';
 for(let x=1;x<p.w;x++)s+='<path d="M'+(x*size)+' 0V'+h+'" stroke="#2c4957"/>';
 for(let y=1;y<p.h;y++)s+='<path d="M0 '+(y*size)+'H'+w+'" stroke="#2c4957"/>';
 for(const e of S.edges(p))if(state.walls.includes(e.id)){let x=e.a%p.w*size,y=Math.floor(e.a/p.w)*size;const d=e.b-e.a===1?'M'+(x+size)+' '+y+'v60':'M'+x+' '+(y+size)+'h60';s+='<path data-wall="'+e.id+'" d="'+d+'" stroke="#bcead0" stroke-width="4" stroke-linecap="round"/>';}
 s+='<rect width="'+w+'" height="'+h+'" rx="4" fill="none" stroke="#8dafa9" stroke-width="3"/>';
 p.cores.forEach((c,k)=>{s+=flower(c.x*30,c.y*30,10,palette[k%6],k+1);});
 if(Number.isSafeInteger(selected))s+='<rect x="'+(selected%p.w*size+3)+'" y="'+(Math.floor(selected/p.w)*size+3)+'" width="54" height="54" rx="5" fill="none" stroke="#f4d28e" stroke-width="2"/>';
 if(options.interactive)for(let i=0;i<p.w*p.h;i++)s+='<rect data-cell="'+i+'" x="'+(i%p.w*size)+'" y="'+(Math.floor(i/p.w)*size)+'" width="60" height="60" fill="transparent"/>';
 return s+'</svg>';
}
const tutorial={id:'starbud-garden-tutorial-v1',w:3,h:3,cores:[{x:1,y:1},{x:5,y:1},{x:3,y:3},{x:1,y:5},{x:5,y:5}]};
const tutorialOwners=[0,2,1,2,2,2,3,2,4];
function tutorialStates(){const a=S.blank(),walls=S.solutionWalls(tutorial,tutorialOwners),b=S.act(tutorial,a,{type:'wall',id:walls[0]});let c=a;walls.forEach(id=>c=S.act(tutorial,c,{type:'wall',id}));if(!S.evaluate(tutorial,c).complete)throw Error('tutorial proof');return [a,b,c];}
Object.assign(S,{render,flower,palette,tutorial,tutorialStates});
})(Starbud);
if(typeof module!=='undefined')module.exports=Starbud;
