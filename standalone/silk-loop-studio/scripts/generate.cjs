const fs=require('node:fs'),path=require('node:path');
const E=require('../engine.js'),{oracle,canonical}=require('../tests/oracle.cjs');
const R=(i,d=1)=>({axis:'row',index:i,direction:d}),C=(i,d=1)=>({axis:'column',index:i,direction:d});
const comm=(r,c,a=1,b=1)=>[R(r,a),C(c,b),R(r,-a),C(c,-b)];
const chapterNames=['第一条彩带','经纬相遇','借位再归','角落换线','连纹入框','最后一幅绸'];
const lessons=['先看出端回入，再同时整理几条行。','先动一轴，再用另一轴回补交点。','借一行一列，完成局部三枚标签的循环。','用局部循环留下更多完整区域。','将两组局部任务接起来，观察交点冲突。','把借位、回补和全盘规划连成一幅挂毯。'];
const names=[['一格回入','绕过半幅','双带回入','双带错拍','隔行相织','三条并行','长短相织','四带归序'],['第一根经线','横竖交点','先行后列','双行一列','两处回补','长短交织','先留一行','经纬归齐'],['借位初试','三枚成环','折返经线','另一端借位','借一下经线','相邻回补','双向折返','借完归还'],['角上换线','内侧换线','留住边框','交点叠纹','两角相望','远端换线','保护一角','转角成纹'],['接起两端','远近两簇','交点让路','横向连纹','纵向回补','三线交汇','双环折返','连纹入框'],['展开最后一幅','先借后还','留一条边','错拍经纬','回补两角','留住一块花纹','全幅回环','织台落款']];
const candidates=[
 [ [R(0)], [R(0),R(0)], [R(0),R(1)], [R(0),R(1,-1)], [R(0),R(2)], [R(0),R(1),R(2,-1)], [R(0),R(1),R(1),R(2,-1)], [R(0),R(1),R(1),R(2,-1),R(3)] ],
 [ [C(0)], [R(0),C(0)], [R(1,-1),C(2),C(2)], [R(0),R(2,-1),C(1)], [R(0),C(1),R(2,-1),C(3)], [R(0),C(2),C(2),R(1),C(0,-1)], [C(1),R(3),C(2,-1),R(0,-1)], [R(0),C(0),R(1),C(2,-1),R(3),C(3)] ],
 [comm(0,0)],[],[],[]
];
let rng=901039;const rand=n=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return Math.floor(rng/65536)%n;};
for(let i=0;i<500;i++) {
 const r=rand(4),c=rand(4),a=rand(2)?1:-1,b=rand(2)?1:-1;
 candidates[2].push(comm(r,c,a,b).concat(i%3===0?[R((r+2)%4)]:i%3===1?[C((c+1)%4,-1)]:[R((r+1)%4),C((c+2)%4)]));
 candidates[3].push(comm(r,c,a,b).concat(comm((r+1+i%2)%4,(c+1+i%3)%4,b,-a)));
 candidates[4].push(comm(r,c,a,b).concat([R((r+2)%4)],comm((r+1+rand(3))%4,(c+1+rand(3))%4,rand(2)?1:-1,rand(2)?1:-1),[R((r+2)%4,-1)]));
 candidates[5].push(comm(r,c,a,b).concat(comm((r+1)%4,c,b,a),comm(r,(c+1)%4,-a,b)));
 candidates[5].push(comm(r,c,a,b).concat(comm((r+1+rand(3))%4,(c+1+rand(3))%4,b,a),[C((c+3)%4)],comm(rand(4),rand(4),rand(2)?1:-1,rand(2)?1:-1),[R((r+3)%4),C((c+3)%4,-1)]));
}
// Add structured axis-only variations for chapter one, never color or number renamings.
for(let mask=1;mask<256;mask++){let m=mask,script=[];for(let r=0;r<4;r++){const k=m%4;m=Math.floor(m/4);for(let j=0;j<k;j++)script.push(R(r));}candidates[0].push(script);}
for(let i=0;i<100;i++) candidates[1].push([R(rand(4),1),C(rand(4),-1),R(rand(4),-1),C(rand(4),1)]);
const seen=new Set(),levels=[],proofs=[];
for(let ch=0;ch<6;ch++)for(const input of candidates[ch]) {
 if(levels.filter(l=>l.chapter===ch).length===8)break;
 const scramble=E.simplify(input),initial=E.replay(E.goal,scramble),key=canonical(initial);
 if(E.solved(initial)||seen.has(key))continue;
 if(ch===5&&levels.filter(l=>l.chapter===ch).length===5&&initial.filter((v,i)=>v!==i+1).length>7)continue;
 // Introductory row-only states must genuinely differ, not just move to a new row.
 seen.add(key);const idx=levels.length,within=idx%8,solution=scramble.slice().reverse().map(E.inverse);
 const affected=initial.reduce((p,v,i)=>v===i+1?p:p.concat(i),[]);
 const first=solution[0];
 const ch1=['单行向左一格，把末端纸签带回前端。','同一行偏移两格，左右两次都能回到原位。','两条相邻行分别回补；选轨本身不会计步。','两条彩带反向错开，记清各自的回入端。','隔开的两行可以分别整理，不必碰中间完整行。','三条彩带错向移动，逐行保留已排好的区域。','长短位移并存，先看每行与目标底稿的距离。','四行都偏移了，依次整理并检查每一个编号。'];
 const lesson=ch===0?ch1[within]:(ch===1?'先整理交点，再回补经纬。':ch===2?'借位完成局部循环，随后归还支援轨道。':ch===3?'用两段局部循环保护完整区域。':ch===4?'把两簇错位接成一条路线，记住中途借出的轨道。':'综合使用局部循环和回补，先规划再推动。')+' 这幅有 '+affected.length+' 枚错位纸签；参考路线先'+(first.axis==='row'?'处理第 '+(first.index+1)+' 行':'处理第 '+(first.index+1)+' 列')+'。';
 const l={id:'silk-'+String(idx+1).padStart(2,'0'),chapter:ch,number:idx+1,name:names[ch][within],seed:901039+idx,generatorVersion:'silk-structure-1',checksum:E.checksum(initial),initial,solution,referenceMoves:solution.length,lesson,focus:affected[0],metrics:{displaced:affected.length,axes:new Set(scramble.map(a=>a.axis)).size,turns:scramble.filter((a,i)=>i>0&&a.axis!==scramble[i-1].axis).length},proof:'independent-coordinate-replay'};
 if(!E.solved(oracle(initial,solution))||!E.same(oracle(E.goal,scramble),initial))throw Error('Oracle mismatch');
 levels.push(l);proofs.push({id:l.id,chapter:ch,canonical:key,referenceMoves:solution.length,displaced:affected.length,proof:l.proof,verified:true,optimal:false,uniqueActionSequence:false});
}
console.log(chapterNames.map((n,c)=>[n,levels.filter(l=>l.chapter===c).length]));
if(levels.length!==48)throw Error('Only '+levels.length+' structurally unique levels');
const api={chapters:chapterNames.map((name,i)=>({name,lesson:lessons[i]})),levels};
fs.writeFileSync(path.join(__dirname,'../levels.js'),'(function(root){\n\'use strict\';\nconst data='+JSON.stringify(api)+';\nroot.SilkLevels=data;\nif(typeof module!==\'undefined\')module.exports=data;\n})(typeof window!==\'undefined\'?window:globalThis);\n');
fs.writeFileSync(path.join(__dirname,'../release/level-proofs.json'),JSON.stringify({generator:'silk-structure-1',count:48,deduplication:'D4 reflections/rotations + torus translations, goal-preserving conjugation',levels:proofs},null,2));
console.log('Generated 48 coordinate-oracle verified, symmetry-distinct levels');
