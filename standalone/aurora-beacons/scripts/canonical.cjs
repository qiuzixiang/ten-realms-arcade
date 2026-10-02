function canonical(p){const forms=[];for(let rot=0;rot<4;rot++)for(let mirror=0;mirror<2;mirror++)for(let swap=0;swap<2;swap++){
 let w=p.w,h=p.h,sl=p.slots.map(x=>x.slice()),cl=JSON.parse(JSON.stringify(p.clues));
 for(let t=0;t<rot;t++){sl=sl.map(q=>q.map(i=>(i%w)*h+(h-1-Math.floor(i/w))));cl={rp:cl.cp.slice(),rm:cl.cm.slice(),cp:cl.rp.slice().reverse(),cm:cl.rm.slice().reverse()};[w,h]=[h,w];}
 if(mirror){sl=sl.map(q=>q.map(i=>Math.floor(i/w)*w+w-1-i%w));cl.cp.reverse();cl.cm.reverse();}
 if(swap)cl={rp:cl.rm,rm:cl.rp,cp:cl.cm,cm:cl.cp};
 forms.push(JSON.stringify([w,h,sl.map(q=>q.sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]),cl]));}return forms.sort()[0];}
module.exports={canonical};
