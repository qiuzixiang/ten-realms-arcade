import {neighbors,analyze} from './engine.mjs';
import {solve} from './solver.mjs';
export function getHint(p,state){
 const solution=solve(p,2).solutions[0];if(!solution)return {text:'这份题面未能求解，请重新选关。'};
 const wrong=state.modes.findIndex((v,i)=>(v===1)!==(solution[i]===1));
 if(wrong<0)return {text:'三条规则已经满足，书页完整了。'};
 const wrongBlack=state.modes.findIndex((v,i)=>v===1&&solution[i]===0);
 if(wrongBlack>=0)return {index:wrongBlack,mode:0,text:'这枚遮罩与本题的完整解不一致。继续保留它，会无法同时满足去重、黑格间距和白域连通。可先恢复白格再推理。',kind:'校正'};
 for(let i=0;i<p.cells.length;i++)if(state.modes[i]!==1&&solution[i]===1){
  const a=neighbors(i,p.n).find(j=>p.cells[j]===p.cells[i]&&state.modes[j]!==1);
  // Explain a sandwich or three consecutive equal numbers without reading a stored answer.
  const n=p.n,r=(i/n)|0,c=i%n;
  for(const d of [1,n]){const middle=i+d,end=i+2*d;if(end<p.cells.length&&(d===n||c+2<n)&&p.cells[i]===p.cells[middle]&&p.cells[i]===p.cells[end])return {index:i,mode:1,text:'三个相邻同号中，中间格不能遮黑：否则两端都必须留白，仍会重复。所以中间留白、两端遮黑。',kind:'三连同号'};}
  if(a!==undefined){const other=neighbors(a,n).find(j=>j!==i&&state.modes[j]===1);if(other!==undefined)return {index:i,mode:1,text:'相邻黑格旁必须留白。与这个白格同行或同列的同号格，就需要遮黑。',kind:'间距与去重'};}
 }
 return {index:wrong,mode:solution[wrong],text:'把这格保留为白格，会在继续推演后造成同行同列重复、相邻黑格或白域断开。完整约束搜索确认这里必须遮黑。此为解题辅助，不计作独立完成。',kind:'联合推演'};
}
