import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'dist/xhs'),zip=path.join(root,'dist/moon-tide-loop-xhs.zip');
const files=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.endsWith('/'));
assert(files.includes('index.html'));assert(files.filter(f=>f.endsWith('.html')).length===1);assert(files.every(f=>/\.(html|css|js|json|svg|png|jpg|jpeg|webp|gif|woff|woff2)$/.test(f)));assert(!files.some(f=>/node_modules|\.git|\.map$|\.DS_Store/.test(f)));
assert((await fs.stat(zip)).size<=10*1024*1024);
const html=await fs.readFile(path.join(out,'index.html'),'utf8'),js=await fs.readFile(path.join(out,'app.js'),'utf8'),css=await fs.readFile(path.join(out,'styles.css'),'utf8');
assert(!/<script(?![^>]*\bsrc=)|type=["']module|\bon\w+=|javascript:|<iframe|<object|<base|Content-Security-Policy/i.test(html));
for(const pattern of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/EventSource/,/RTCPeerConnection/,/navigator\.(geolocation|clipboard|bluetooth|usb|hid|serial|serviceWorker|storage|credentials|locks|connection|getBattery)/,/\b(?:Shared)?Worker\s*\(/,/\beval\s*\(/,/new\s+Function/,/WebAssembly/,/window\.(open|prompt)\s*\(/,/localStorage\.clear/,/\?\./,/\?\?/,/\.flat\s*\(/,/\.flatMap\s*\(/,/Object\.(fromEntries|hasOwn)/,/\.replaceAll\s*\(/,/\bimport\s/,/\bexport\s/])assert(!pattern.test(js),'Forbidden / incompatible pattern '+pattern);
assert(!/\baspect-ratio\s*:|\bclamp\(|\bcolor-mix\(|:has\(|@container|backdrop-filter|\b[sd]vh\b|(?<!grid-)gap\s*:/.test(css));
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){assert(m[1].startsWith('./'));await fs.access(path.join(out,m[1]));}
assert(!/(?:src|href)=["']https?:|url\(\s*["']?https?:/.test(html+css));
execFileSync(process.execPath,['--check',path.join(out,'app.js')]);
const bytes=(await Promise.all(files.map(f=>fs.stat(path.join(out,f))))).reduce((n,s)=>n+s.size,0);
console.log(JSON.stringify({status:'PASS',files:files.length,uncompressedBytes:bytes,zipBytes:(await fs.stat(zip)).size,checks:['ZIP root and file types','all referenced resources local','classic external script','banned capabilities absent','ES2017 patterns','CSS Chrome61 baseline','script syntax']},null,2));
