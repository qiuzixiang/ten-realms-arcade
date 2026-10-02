import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import crypto from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);
const dir='dist/xhs',names=fs.readdirSync(dir),html=fs.readFileSync(dir+'/index.html','utf8'),js=fs.readFileSync(dir+'/app.js','utf8'),css=fs.readFileSync(dir+'/styles.css','utf8');
assert.deepEqual(names.filter(n=>n.endsWith('.html')),['index.html']);
for(const name of names){assert.ok(/\.(html|js|css|svg|json)$/.test(name));assert.ok(fs.statSync(dir+'/'+name).size>0);}
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert.ok(match[1].startsWith('./'));assert.ok(fs.existsSync(path.join(dir,match[1])));}
assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>|\bon\w+\s*=|type="module"|<iframe|<object|<base|http-equiv="Content-Security-Policy"/i.test(html));
for(const pattern of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/WebAssembly/,/\beval\s*\(/,/new\s+Function/,/\bimport\s/,/\bexport\s/,/localStorage\.clear/,/serviceWorker/,/new\s+Worker/,/window\.open/,/https?:\/\/(?!www\.w3\.org)/,/\.at\(/,/replaceAll\(/,/structuredClone\(/])assert.ok(!pattern.test(js),String(pattern));
assert.ok(!/@import|https?:\/\/|aspect-ratio|clamp\(|:has\(|\binset:|(?:[;{]\s*)gap:/.test(css));
execFileSync(process.execPath,['--expose-internals','-e',"const p=require('internal/deps/acorn/acorn/dist/acorn');p.parse(require('fs').readFileSync(0,'utf8'),{ecmaVersion:2017,sourceType:'script'});"],{input:js});
execFileSync('unzip',['-t','dist/stardew-formulas-xhs.zip']);
const zipNames=execFileSync('unzip',['-Z1','dist/stardew-formulas-xhs.zip'],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(zipNames.sort(),names.sort());
const zipSize=fs.statSync('dist/stardew-formulas-xhs.zip').size;assert.ok(zipSize<2*1024*1024);
const sha=crypto.createHash('sha256').update(fs.readFileSync('dist/stardew-formulas-xhs.zip')).digest('hex');
const report={version:1,files:names.map(name=>({name,bytes:fs.statSync(dir+'/'+name).size})),zipSize,sha256:sha,checks:['ES2017 parsed','relative references exist','classic external script','prohibited API scan','ZIP root and CRC','under historical 2MiB recommendation'],platformBaseline:'minitool 1.6.0 cached; current version unverified',realContainer:false};
fs.mkdirSync('release',{recursive:true});fs.writeFileSync('release/audit-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
