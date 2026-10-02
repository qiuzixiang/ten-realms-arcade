const fs=require('node:fs'),path=require('node:path');const E=require('../src/engine.js'),O=require('../src/oracle.js');
let seed=20260922;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function tile(w,h){let a=Array(w*h).fill(false),out=[];function go(){let i=a.indexOf(false);if(i<0)return true;for(const j of shuffle([i%w+1<w?i+1:-1,i+w<w*h?i+w:-1].filter(x=>x>=0&&!a[x]))){a[i]=a[j]=true;out.push([i,j]);if(go())return true;out.pop();a[i]=a[j]=false;}return false;}go();return out;}
const {canonical}=require('./canonical.cjs');

const chapters=['认识双极','反向安排','明确中性','行列配额','邻接排除','极夜联调'];let levels=[],seen=new Set(),seenFull=new Set(),tried=0;
for(let ch=0;ch<6;ch++){let pool=[];while(pool.length<18&&tried<30000){tried++;let w=ch<3?4:6,h=ch<5?4:6,slots=tile(w,h),values=slots.map(q=>rand()<(ch<2?0.12:0.30)?0:((Math.floor(q[0]/w)+q[0]%w)%2?1:-1));
 // Independently flip separated active components for richer polarity patterns.
 const p={w,h,slots,clues:{rp:Array(h).fill(null),rm:Array(h).fill(null),cp:Array(w).fill(null),cm:Array(w).fill(null)}};
 slots.forEach((q,i)=>{if(values[i]&&rand()<.5){let n=values.slice();n[i]*=-1;if(E.inspect(p,{values:n,notes:[]}).consistent)values=n;}});
 const counts=E.inspect(p,{values,notes:[]}).counts;p.clues=counts;
 let result=O.solve(p,2);if(!result.unique)continue;
 const fullKey=canonical(p);if(seenFull.has(fullKey))continue;
 const removable=shuffle(Object.keys(counts).reduce((a,k)=>a.concat(counts[k].map((_,i)=>[k,i])),[]));let target=[0,1,2,5,8,12][ch],removed=0;
 for(const [k,i] of removable){if(removed>=target)break;let old=p.clues[k][i];p.clues[k][i]=null;let r=O.solve(p,2);if(r.unique){removed++;result=r;}else p.clues[k][i]=old;}
 if(ch>=2&&!values.includes(0))continue;if(ch>=3&&removed<3)continue;
 let key=canonical(p);if(seen.has(key))continue;seen.add(key);seenFull.add(fullKey);pool.push(Object.assign(p,{seed,solution:values,proof:{nodes:result.nodes,branches:result.branches,maxDepth:result.maxDepth,removed}}));
 }if(pool.length<10)throw Error('Insufficient chapter '+ch);pool.sort((a,b)=>(a.proof.branches*100+a.proof.nodes)-(b.proof.branches*100+b.proof.nodes));pool.slice(0,10).forEach((p,i)=>levels.push(Object.assign(p,{id:'ab-'+String(ch*10+i+1).padStart(2,'0'),chapter:ch,title:chapters[ch],phase:i<2?'概念练习':i<8?'组合推理':'站点联调'})));console.log(chapters[ch],pool.length,levels.slice(-10).map(p=>p.proof));}
fs.writeFileSync(path.join(__dirname,'../src/levels.js'),'/* Generated and independently proven; generator v1 */\n(function(root){const data='+JSON.stringify(levels)+';if(typeof module!=="undefined")module.exports=data;else root.AuroraLevels=data;})(typeof window!=="undefined"?window:globalThis);\n');
fs.writeFileSync(path.join(__dirname,'../release/proofs.json'),JSON.stringify({generator:1,seed:20260922,tried,count:levels.length,levels:levels.map(p=>({id:p.id,...p.proof}))},null,2));
module.exports={canonical};
