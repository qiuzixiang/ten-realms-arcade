import {inspect,edgeEnds} from './logic.mjs';
export function boardSvg(p,board,opts={}){
  const size=60,pad=14,w=p.width*size+pad*2,h=p.height*size+pad*2,r=inspect(p,board),selected=opts.selected,notes=opts.notes||[],path=opts.path||[],showNode=opts.node;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" aria-label="${opts.label||'瓷片阵：数字位于交点'}" role="img"><defs><linearGradient id="glaze" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#35659a"/><stop offset=".45" stop-color="#163f78"/><stop offset="1" stop-color="#123263"/></linearGradient></defs>`;
  for(let i=0;i<board.length;i++){
    const x=i%p.width,y=Math.floor(i/p.width),left=pad+x*size,top=pad+y*size;
    svg+=`<rect x="${left+1}" y="${top+1}" width="58" height="58" rx="4" fill="${i===selected?'#d9e6ee':'#faf8f1'}" stroke="${i===selected?'#163f78':'#78909b'}" stroke-width="${i===selected?3:1}"/>`;
    if(!board[i]&&!notes[i])svg+=`<path d="M${left+26} ${top+30}h8" stroke="#d4d6d1" stroke-width="2"/>`;
    const value=board[i]||notes[i];if(value){
      const ends=edgeEnds(p.width,i,value).map(v=>[pad+(v%(p.width+1))*size,pad+Math.floor(v/(p.width+1))*size]);
      const conflict=r.loops.includes(i),highlight=path.includes(i);
      svg+=`<line x1="${ends[0][0]}" y1="${ends[0][1]}" x2="${ends[1][0]}" y2="${ends[1][1]}" stroke="${conflict?'#bd482d':highlight?'#986324':board[i]?'url(#glaze)':'#566b7b'}" stroke-width="${board[i]?9:3}" stroke-linecap="round" ${board[i]?'':'stroke-dasharray="4 5"'}/>`;
      if(board[i])svg+=`<line x1="${ends[0][0]+1}" y1="${ends[0][1]}" x2="${ends[1][0]+1}" y2="${ends[1][1]}" stroke="#96b4ce" stroke-width="1.5" opacity=".6"/>`;
      if(conflict||highlight)svg+=`<line x1="${ends[0][0]}" y1="${ends[0][1]}" x2="${ends[1][0]}" y2="${ends[1][1]}" stroke="${conflict?'#bd482d':'#986324'}" stroke-width="15" stroke-dasharray="4 5" opacity=".45"/>`;
      if(!board[i])svg+=`<text x="${left+44}" y="${top+50}" font-size="12" fill="#566b7b">✎</text>`;
    }
  }
  r.nodes.forEach(n=>{const x=pad+(n.i%(p.width+1))*size,y=pad+Math.floor(n.i/(p.width+1))*size,chosen=n.i===showNode;
    if(n.target===null)svg+=`<circle cx="${x}" cy="${y}" r="${chosen?6:3}" fill="${chosen?'#163f78':'#83969f'}"/>`;
    else {svg+=`<circle cx="${x}" cy="${y}" r="14" fill="${n.error?'#fff0e9':n.locked?'#e0eee7':'#fff'}" stroke="${n.error?'#bd482d':chosen?'#163f78':n.locked?'#327864':'#7d929d'}" stroke-width="${chosen?3:1.5}"/><text x="${x}" y="${y+8}" text-anchor="middle" font-size="24" font-weight="600" fill="${n.error?'#a33822':n.locked?'#245c4c':'#172a3b'}" font-family="Arial,sans-serif">${n.target}</text>`;}
  });
  return svg+'</svg>';
}
export function relicSvg(chapter,locked){
 const color=locked?'#bcc4c4':'#163f78';
 const shapes=[`<path d="M30 36h60v48H30z"/><path d="M38 24h44v12H38z"/>`,`<path d="M32 27h56l-6 57H38z"/><path d="M32 39C10 28 10 67 35 68M88 39c22-11 22 28-3 29"/>`,`<rect x="26" y="24" width="68" height="68" rx="8"/><path d="M26 24l68 68M26 92l68-68"/>`,`<ellipse cx="60" cy="60" rx="43" ry="28"/><ellipse cx="60" cy="60" rx="34" ry="20"/>`,`<path d="M20 44h53v32H20zM73 54h33v12H73z"/><path d="M30 50v20m12-20v20m12-20v20m12-20v20"/>`,`<path d="M20 37l20-14h40l20 14v46L80 98H40L20 83z"/><path d="M30 45h60v30H30z"/>`];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="55" fill="#f4f0e7"/><g fill="#e9eff2" stroke="${color}" stroke-width="4" stroke-linejoin="round">${shapes[chapter-1]}</g><path d="M38 91h44" stroke="#a6b4bb" stroke-width="2"/></svg>`;
}
