export function canonical(l){const n=l.n,strings=[];for(let flip=0;flip<2;flip++)for(let rot=0;rot<4;rot++)for(let inverse=0;inverse<2;inverse++){
  function map(c){let y=Math.floor(c/n),x=c%n;if(flip)x=n-1-x;for(let r=0;r<rot;r++)[x,y]=[n-1-y,x];return y*n+x;}
  const edges=l.relations.map(e=>{let a=map(e.a),b=map(e.b),sign=e.sign;if(a>b){[a,b]=[b,a];sign=sign==='<'?'>':'<';}if(inverse)sign=sign==='<'?'>':'<';return a+':'+b+sign;}).sort();strings.push(n+'|'+edges.join(';'));}return strings.sort()[0];}
