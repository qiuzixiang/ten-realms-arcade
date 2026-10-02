import sharp from 'sharp';import {writeFileSync} from 'node:fs';import {LEVELS} from '../src/levels.mjs';import {boardSVG} from '../src/renderer.mjs';import {candidates} from '../src/engine.mjs';
const review=[];
for(let ch=0;ch<6;ch++){
 const ps=LEVELS.filter(p=>p.chapter===ch),tiles=[];
 for(let i=0;i<ps.length;i++){const p=ps[i];const inner=boardSVG(p,[],null);const svg='<svg xmlns="http://www.w3.org/2000/svg" width="220" height="260"><rect width="220" height="260" fill="#fffaf0"/><text x="10" y="22" font-family="sans-serif" font-size="13">'+p.id.slice(8)+' · score '+p.score+'</text><svg x="10" y="35" width="200" height="200" viewBox="0 0 '+p.n*64+' '+p.n*64+'">'+inner.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')+'</svg></svg>';tiles.push({input:await sharp(Buffer.from(svg)).png().toBuffer(),left:i%5*220,top:Math.floor(i/5)*260});
 const options=p.clues.map(c=>candidates(p,c,[]).length);review.push({id:p.id,n:p.n,lesson:p.lesson,score:p.score,candidateCounts:options,edgeClues:p.clues.filter(c=>c.x===0||c.y===0||c.x===p.n-1||c.y===p.n-1).length,branches:p.proof.branches,forced:p.proof.forced,classification:'provisional solver-based progression; human playtesting not performed'});}
 await sharp({create:{width:1100,height:520,channels:4,background:'#fffaf0'}}).composite(tiles).png().toFile('release/chapter-'+(ch+1)+'-review.png');
}
writeFileSync('release/level-review.json',JSON.stringify(review,null,2));
