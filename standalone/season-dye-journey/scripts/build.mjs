import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {tutorialStates} from './tutorial.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist/xhs');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'assets'),{recursive:true});
const tutorial=tutorialStates().map(({svg,...s})=>s);
for(const f of ['index.html','styles.css'])fs.copyFileSync(path.join(root,f),path.join(out,f));
for(const f of fs.readdirSync(path.join(root,'assets'))){if(/\.(svg|png|webp|jpg|json)$/.test(f))fs.copyFileSync(path.join(root,'assets',f),path.join(out,'assets',f));}
for(const t of tutorial)if(!fs.existsSync(path.join(out,'assets','tutorial-'+t.key+'.png')))throw new Error('Missing generated tutorial PNG; run assets script first');
const sources=['engine','levels','render','storage'].map(f=>fs.readFileSync(path.join(root,'src',f+'.js'),'utf8'));
sources.push('Dye.Tutorial = '+JSON.stringify(tutorial)+';');sources.push(fs.readFileSync(path.join(root,'src/app.js'),'utf8'));
fs.writeFileSync(path.join(out,'app.js'),sources.join('\n;\n'));
fs.writeFileSync(path.join(root,'app.js'),sources.join('\n;\n'));
fs.writeFileSync(path.join(out,'licenses.json'),JSON.stringify({license:'MIT',copyright:'Copyright (c) 2026 Ten Realms Arcade contributors',text:fs.readFileSync(path.join(root,'LICENSE'),'utf8'),rule:'Flood — Simon Tatham’s Portable Puzzle Collection',references:['https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/flood.html','https://github.com/ebnbin/puzzles','https://puzzles.ebnbin.dev/doc/zh/flood.html'],sourceCommit:'374d2eee951c8f6aa0bbc829e9cceaa127596b7c',art:'Original editable SVG textile illustrations and engine-rendered tutorials; no third-party art.'},null,2));
function files(dir,prefix=''){return fs.readdirSync(dir).sort().flatMap(f=>fs.statSync(path.join(dir,f)).isDirectory()?files(path.join(dir,f),prefix+f+'/'):[prefix+f]);}
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
const entries=files(out),chunks=[],centers=[];let offset=0;
for(const name of entries){const nameBytes=Buffer.from(name),raw=fs.readFileSync(path.join(out,name)),data=zlib.deflateRawSync(raw,{level:9}),sum=crc(raw);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x0800,6);h.writeUInt16LE(8,8);h.writeUInt32LE(sum,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(nameBytes.length,26);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x0800,8);c.writeUInt16LE(8,10);c.writeUInt32LE(sum,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(nameBytes.length,28);c.writeUInt32LE(offset,42);chunks.push(h,nameBytes,data);centers.push(c,nameBytes);offset+=h.length+nameBytes.length+data.length;}
const central=Buffer.concat(centers),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...chunks,central,end]);fs.writeFileSync(path.join(root,'dist/season-dye-journey-xhs.zip'),zip);
console.log('Built '+entries.length+' local files; ZIP '+zip.length+' bytes. Entry: dist/xhs/index.html');
