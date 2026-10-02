'use strict';
const fs=require('node:fs'),path=require('node:path'),C=require('../core.js'),O=require('./oracle.cjs'),T=require('./topology.cjs');
const reps=require('./representatives.cjs');
let seed=20261001;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function shuffle(v){v=v.slice();for(let i=v.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[v[i],v[j]]=[v[j],v[i]];}return v;}
const sizes=[[4,5,5,5,6,6,6,6],[6,6,7,7,7,8,8,8],[7,8,8,9,9,10,10,10],[9,9,10,10,11,11,12,12],[11,11,12,12,13,13,14,14],[12,13,13,14,14,15,16,16]];
const chapters=['初签','双缘','回环','交契','星罗','归缘'];
const goals=['观察一次移动如何带动相连朱线。','先整理一片图块，再照顾共用签印。','辨认回环的外轮廓，避开贴线和 T 接触。','检查关键签印影响的多个图块。','从非对称整体关系规划各片落点。','逐片消结，保留清楚的整体布局。'];
function lattice(v){return v.map(p=>({id:p.id,x:Math.round(p.x*1000),y:Math.round(p.y*1000)}));}
function candidate(n,chapter,trial){
  const witness=[],possible=[];let family;
  if(chapter<=3&&trial%2===0){
    family='convex-ear-triangulation';
    for(let i=0;i<n;i++){const angle=-Math.PI/2+i*2*Math.PI/n;witness.push({id:i,x:Math.round(500+420*Math.cos(angle))/1000,y:Math.round(500+420*Math.sin(angle))/1000});possible.push([i,(i+1)%n]);}
    const ring=Array.from({length:n},(_,i)=>i);
    while(ring.length>3){const k=Math.floor(rand()*ring.length),a=ring[(k+ring.length-1)%ring.length],b=ring[(k+1)%ring.length];possible.push([a,b]);ring.splice(k,1);}
  }else{
    family='triangulated-lattice-blocks';const cols=n<=9?3:n===13?5:4,rows=Math.ceil(n/cols);
    for(let id=0;id<n;id++){
      witness.push({id,x:Math.round(130+(id%cols)*740/(cols-1))/1000,y:Math.round(100+Math.floor(id/cols)*800/(rows-1))/1000});
      if(id%cols)possible.push([id-1,id]);if(id>=cols)possible.push([id-cols,id]);
      if(id>=cols&&id%cols){if(rand()<.5)possible.push([id-cols-1,id]);else possible.push([id-cols,id-1]);}
    }
  }
  const density=.55+rand()*.35,edges=possible.filter(()=>rand()<density);
  let initial=witness.map(p=>({...p}));const graph={initial,edges};
  if(!C.validGraph(initial,edges))return null;
  const s=T.stats(graph);
  if(s.components!==1||s.degrees[0]===0)return null;
  if(chapter===2&&(s.articulations.length<1||s.cyclicBlocks<2))return null;
  if(chapter===3&&s.cycles<2)return null;
  if(chapter===4&&(s.articulations.length<2||s.cycles<3))return null;
  if(chapter===5&&(s.cyclicBlocks<2||s.cycles<4||s.degrees[s.degrees.length-1]<4))return null;
  if(chapter===5){if(T.automorphisms(graph,2)!==1)return null;s.asymmetric=true;}
  if(chapter===6&&s.cycles<3)return null;
  if(O.pairs(lattice(witness),edges).length)return null;
  // Initial positions always use a spacious lattice, independent of the
  // reference embedding. Permutations are rejected if already solved.
  const cols=n<=6?3:4,rows=Math.ceil(n/cols),pool=[];
  for(let i=0;i<n;i++)pool.push({x:Math.round(130+i%cols*740/(cols-1))/1000,y:Math.round(100+Math.floor(i/cols)*800/(rows-1))/1000});
  for(let k=0;k<80;k++){const scrambled=shuffle(pool);initial=scrambled.map((p,id)=>({id,x:p.x,y:p.y}));if(C.pairs(initial,edges).length)break;}
  if(!C.pairs(initial,edges).length)return null;
  return {graphVersion:1,generatorVersion:1,family,initial,edges,witness,replay:witness.map(p=>({id:p.id,x:p.x,y:p.y})),topology:s};
}
const levels=[],generation=[];
for(let chapter=1;chapter<=6;chapter++)for(let slot=0;slot<8;slot++){
  let chosen,trials=0;
  if(chapter===1&&slot===0){chosen={...reps[0],family:'path-tutorial',generatorVersion:1,topology:T.stats(reps[0])};}
  else for(;trials<30000;trials++){const c=candidate(sizes[chapter-1][slot],chapter,trials);if(c&&!levels.some(l=>T.isomorphic(l,c))){chosen=c;break;}}
  if(chapter===6&&slot===7){
    const witness=Array.from({length:16},(_,id)=>({id,x:Math.round(130+(id%4)*740/3)/1000,y:Math.round(100+Math.floor(id/4)*800/3)/1000}));
    const edges=[[0,1],[1,2],[0,4],[4,5],[5,6],[1,5],[2,6],[0,5],[1,6],[6,7],[7,11],[11,10],[10,6],[6,11],[7,3],[8,9],[9,10],[8,12],[12,13],[13,14],[14,10],[9,13],[9,14],[14,15]];
    chosen={graphVersion:1,generatorVersion:2,family:'three-asymmetric-cyclic-blocks',initial:shuffle(witness).map((p,id)=>({id,x:p.x,y:p.y})),edges,witness,replay:witness.map(p=>({id:p.id,x:p.x,y:p.y}))};chosen.topology=T.stats(chosen);
    if(chosen.topology.cyclicBlocks!==3||O.pairs(lattice(witness),edges).length||levels.some(l=>T.isomorphic(l,chosen)))throw Error('Invalid three-block finale');
  }
  if(!chosen)throw new Error('No unique candidate for chapter '+chapter+' slot '+slot);
  const index=levels.length+1;
  Object.assign(chosen,{id:chapter===1&&slot===0?'scarlet-tutorial-01':'scarlet-'+String(index).padStart(2,'0'),chapter,name:chapter===1&&slot===0?'第一封缘签':chapters[chapter-1]+' · 第'+(slot+1)+'封',goal:goals[chapter-1],role:slot<2?'引导':slot<6?'迁移':'综合'});
  if(chapter===2&&slot===6)chosen.name='隔岸的两簿';if(chapter===6&&slot===7)chosen.name='星罗归册';
  levels.push(chosen);generation.push({id:chosen.id,trials,family:chosen.family,...chosen.topology});
}
fs.writeFileSync(path.join(__dirname,'../levels.js'),'(function(root){root.ScarletLevels='+JSON.stringify(levels)+';if(typeof module!=="undefined"&&module.exports)module.exports=root.ScarletLevels;}(typeof window!=="undefined"?window:this));\n');
fs.writeFileSync(path.join(__dirname,'../release/generation.json'),JSON.stringify({seed:20261001,count:levels.length,distinctGraphIsomorphismClasses:levels.length,method:'exhaustive adjacency-preserving pairwise graph isomorphism, no cutoff',levels:generation},null,2)+'\n');
console.log('Generated 48 connected non-isomorphic graphs in six chapters. Difficulty labels require play review.');
