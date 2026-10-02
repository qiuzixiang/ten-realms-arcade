'use strict';
const core=require('../core.js');
function points(rows) { return rows.map((p,id)=>({id,x:p[0]/1000,y:p[1]/1000})); }
const tutorial={
  id:'scarlet-tutorial-01', graphVersion:1, chapter:1, name:'第一封缘签',
  goal:'一次移动带动相连朱线；先看两条不共端点的交叉边。',
  initial:points([[200,200],[800,800],[800,200],[200,800]]),
  edges:[[0,1],[1,2],[2,3]],
  witness:points([[200,550],[800,800],[800,200],[600,100]]),
  replay:[{id:0,x:.2,y:.55},{id:3,x:.6,y:.1}]
};
module.exports=[tutorial];
