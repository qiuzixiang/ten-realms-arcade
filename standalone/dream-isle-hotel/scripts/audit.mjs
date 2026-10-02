import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {parse} from 'acorn';import assert from 'node:assert/strict';
const root='dist/xhs';const list=(p)=>readdirSync(p).flatMap(f=>statSync(p+'/'+f).isDirectory()?list(p+'/'+f):[p+'/'+f]);const files=list(root);let bytes=0;
for(const file of files){assert.match(file,/\.(html|css|js|svg|png|json)$/);const size=statSync(file).size;bytes+=size;assert.ok(size>0);assert.ok(size<2*1024*1024);}
const js=readFileSync(root+'/app.js','utf8'),html=readFileSync(root+'/index.html','utf8'),css=readFileSync(root+'/styles.css','utf8');parse(js,{ecmaVersion:2017,sourceType:'script'});
for(const r of [/\beval\s*\(/,/new\s+Function\b/,/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/\bWorker\b/,/serviceWorker/,/WebAssembly/,/localStorage\.clear/,/window\.open\s*\(/,/navigator\.(clipboard|geolocation|usb|bluetooth|storage|credentials|locks)/,/\.replaceAll\s*\(/,/Object\.fromEntries/])assert.ok(!r.test(js),String(r));
assert.ok(!/<script[^>]*>\s*[^<\s]/.test(html));assert.ok(!/\son\w+=|type="module"|<iframe|<object|<base|Content-Security-Policy/i.test(html));assert.ok(!/https?:\/\//.test(html+css));for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert.ok(m[1].startsWith('./'));assert.ok(statSync(root+'/'+m[1]).isFile());}
assert.ok(!/\b(clamp|min|max|color-mix)\(|aspect-ratio|backdrop-filter|(?:^|[;{])\s*gap\s*:|\binset\s*:|:has\(/.test(css));
execFileSync('python3',['-c',`from pathlib import Path
import xml.etree.ElementTree as E
for p in Path('dist/xhs/assets').glob('*.svg'):
 root=E.parse(p).getroot()
 assert root.tag.endswith('svg') and root.attrib.get('viewBox'), p
`]);
const zip='dist/dream-isle-hotel-xhs.zip';execFileSync('unzip',['-t',zip]);const names=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');assert.ok(names.includes('index.html'));assert.equal(names.filter(n=>n.endsWith('index.html')).length,1);assert.ok(names.every(n=>!n.includes('..')&&!n.startsWith('/')&&!/node_modules|\.map$|\.DS_Store|\.git/.test(n)));const raw=readFileSync(zip);assert.ok(raw.length<=2*1024*1024);const result={status:'PASS',files:files.length,uncompressedBytes:bytes,zipBytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),syntax:'ES2017 classic (Acorn)',zipCRC:'PASS',limits:'under 2 MiB project target; under 10 MiB hard cap'};writeFileSync('release/audit.json',JSON.stringify(result,null,2));console.log(result);
