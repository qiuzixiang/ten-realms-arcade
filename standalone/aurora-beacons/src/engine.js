/* Aurora Beacons — MIT. Pure rules, independent of oracle. */
(function(root){
'use strict';
function initial(p){return {values:p.slots.map(()=>null),notes:p.slots.map(()=>false)};}
function cells(p,s){let b=Array(p.w*p.h).fill(null); p.slots.forEach((q,i)=>{let v=s.values[i]; if(v!==null){b[q[0]]=v;b[q[1]]=-v;}});return b;}
function inspect(p,s){
 const b=cells(p,s), counts={rp:Array(p.h).fill(0),rm:Array(p.h).fill(0),cp:Array(p.w).fill(0),cm:Array(p.w).fill(0)}, conflicts=[];
 b.forEach((v,i)=>{let r=Math.floor(i/p.w),c=i%p.w;if(v===1){counts.rp[r]++;counts.cp[c]++;}if(v===-1){counts.rm[r]++;counts.cm[c]++;}if(v){if(c+1<p.w&&b[i+1]===v)conflicts.push([i,i+1]);if(r+1<p.h&&b[i+p.w]===v)conflicts.push([i,i+p.w]);}});
 let bad=[];['rp','rm','cp','cm'].forEach(k=>p.clues[k].forEach((v,i)=>{if(v===null)return;let unknown=b.filter((x,j)=>x===null&&(k[0]==='r'?Math.floor(j/p.w)===i:j%p.w===i)).length;if(counts[k][i]>v||counts[k][i]+unknown<v)bad.push(k+i);}));
 let full=s.values.every(v=>v!==null), exact=['rp','rm','cp','cm'].every(k=>p.clues[k].every((v,i)=>v===null||counts[k][i]===v));
 return {board:b,counts,conflicts,bad,full,complete:full&&exact&&!conflicts.length,consistent:!bad.length&&!conflicts.length};
}
function move(p,s,a){if(!a||!Number.isInteger(a.slot)||a.slot<0||a.slot>=p.slots.length)return s; let n={values:s.values.slice(),notes:s.notes.slice()};if(a.type==='note'){n.notes[a.slot]=!n.notes[a.slot];return n;}if(a.type!=='set'||[null,0,1,-1].indexOf(a.value)<0||s.values[a.slot]===a.value)return s;n.values[a.slot]=a.value;return n;}
function replay(p,actions){if(!Array.isArray(actions)||actions.length>10000)throw Error('Invalid history');let s=initial(p);actions.forEach(a=>{let n=move(p,s,a);if(n===s)throw Error('Invalid action');s=n;});return s;}
function candidates(p,s,i){return [1,-1,0].filter(v=>{let n={values:s.values.slice(),notes:s.notes.slice()};n.values[i]=v;return inspect(p,n).consistent;});}
const api={initial,cells,inspect,move,replay,candidates};if(typeof module!=='undefined')module.exports=api;else root.AuroraEngine=api;
})(typeof window!=='undefined'?window:globalThis);
