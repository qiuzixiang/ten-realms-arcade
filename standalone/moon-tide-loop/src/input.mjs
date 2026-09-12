// Input geometry is in board SVG units, independent of DOM size and device pixel ratio.
import { cellEdges, edgeCoordinates } from './render.mjs';
export function cellAt(level,x,y){
 const col=Math.floor((x-16)/80),row=Math.floor((y-16)/80);
 return col>=0&&col<level.width&&row>=0&&row<level.height?row*level.width+col:null;
}
export function edgeAt(level,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 const count=level.width*(level.height+1)+level.height*(level.width+1),candidates=[];
 for(let edge=0;edge<count;edge++){
  const p=edgeCoordinates(level,edge),horizontal=p[1]===p[3];
  const along=horizontal?(x-16)/80-p[0]:(y-16)/80-p[1];
  const across=Math.abs(horizontal?(y-16)/80-p[1]:(x-16)/80-p[0]);
  // Endpoints are deliberately inert: no two adjacent edges share an actionable hit region.
  if(along>=.22&&along<=.78&&across<=.22)candidates.push(edge);
 }
 return candidates.length===1?candidates[0]:null;
}
export function gestureEdge(level,start,end){
 const dx=end.x-start.x,dy=end.y-start.y,ax=Math.abs(dx),ay=Math.abs(dy);
 if(ax<18&&ay<18)return edgeAt(level,end.x,end.y);
 if(start.cell===null||!Number.isInteger(start.cell)||start.cell<0||start.cell>=level.width*level.height)return null;
 if(Math.max(ax,ay)<Math.min(ax,ay)*1.5)return null;
 if(end.x<0||end.y<0||end.x>level.width*80+32||end.y>level.height*80+32)return null;
 const dir=ax>ay?(dx>0?1:3):(dy>0?2:0);
 return cellEdges(level,start.cell)[dir];
}
export function directValue(current,brush){return current===brush?0:brush;}
