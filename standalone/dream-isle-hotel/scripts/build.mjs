import {readFileSync,writeFileSync,mkdirSync,cpSync,rmSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {LEVELS,TUTORIAL} from '../src/levels.mjs';
import {place,solved} from '../src/engine.mjs';
import {boardSVG,hotelSVG} from '../src/renderer.mjs';
const out='dist/xhs';mkdirSync(out,{recursive:true});mkdirSync('assets',{recursive:true});mkdirSync('release',{recursive:true});
let rooms=[];const tutorialStates=[rooms];rooms=place(TUTORIAL,rooms,TUTORIAL.answer[0]);tutorialStates.push(rooms);for(const r of TUTORIAL.answer.slice(1))rooms=place(TUTORIAL,rooms,r);if(!solved(TUTORIAL,rooms))throw Error('Tutorial truth');tutorialStates.push(rooms);
tutorialStates.forEach((rs,i)=>writeFileSync('assets/tutorial-'+i+'.svg',boardSVG(TUTORIAL,rs,null)));
writeFileSync('assets/hotel.svg',hotelSVG());
const icon='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#e8debf"/><circle cx="379" cy="112" r="36" fill="#d9a369"/><path d="M76 228L256 95l180 133" fill="#bd7b58"/><rect x="108" y="220" width="298" height="201" rx="16" fill="#fff4d9"/><g fill="#5e8774"><rect x="141" y="253" width="80" height="69" rx="23"/><rect x="288" y="253" width="80" height="69" rx="23"/><path d="M224 421v-59a32 32 0 0 1 64 0v59z"/></g><path d="M45 451q100-32 216 0t210-4" fill="none" stroke="#84ac98" stroke-width="24"/></svg>';
await sharp(Buffer.from(icon)).png().toFile('assets/icon.png');
const cover='<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440"><rect width="1080" height="1440" fill="#f6f1e5"/><text x="540" y="245" text-anchor="middle" font-family="Songti SC,serif" font-size="96" fill="#355b49">梦屿旅舍</text><text x="540" y="330" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="35" fill="#6b795f">把整座旅舍，一间间安排好</text><svg x="0" y="475" width="1080" height="660" viewBox="0 0 640 390">'+hotelSVG().replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')+'</svg><text x="540" y="1280" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="30" fill="#5f725d">数字 · 矩形 · 一点点空间推理</text></svg>';
await sharp(Buffer.from(cover)).png().toFile('release/cover.png');cpSync('assets/icon.png','release/icon.png');
writeFileSync('release/tutorial-truth.json',JSON.stringify({id:TUTORIAL.id,seed:TUTORIAL.seed,states:tutorialStates},null,2));
const sources=['engine','levels','storage','platform-storage','renderer','app'].map(name=>readFileSync('src/'+name+'.mjs','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''));
writeFileSync(out+'/app.js','(function(){\n"use strict";\n'+sources.join('\n')+'\n})();\n');
cpSync('src/index.template',out+'/index.html');cpSync('src/styles.css',out+'/styles.css');cpSync('assets',out+'/assets',{recursive:true});
const zip='dist/dream-isle-hotel-xhs.zip';if(existsSync(zip))rmSync(zip);execFileSync('python3',['-c',`from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
root=Path('dist/xhs')
with ZipFile('dist/dream-isle-hotel-xhs.zip','w',compression=ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():
   i=ZipInfo(p.relative_to(root).as_posix(),(2026,9,14,0,0,0))
   i.compress_type=ZIP_DEFLATED
   i.external_attr=0o644 << 16
   z.writestr(i,p.read_bytes(),compress_type=ZIP_DEFLATED,compresslevel=9)
`]);
console.log('Built classic offline package, '+LEVELS.length+' puzzles, 3 verified tutorial SVGs.');
