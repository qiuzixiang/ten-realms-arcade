import test from 'node:test';import assert from 'node:assert/strict';import {readFile,stat} from 'node:fs/promises';import vm from 'node:vm';
test('release entry uses external classic JS and only local resources',async()=>{const h=await readFile(new URL('../dist/xhs/index.html',import.meta.url),'utf8');assert.doesNotMatch(h,/<script[^>]*type="module"|<script>|\bon\w+=|<iframe/i);for(const [,url]of h.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(url.startsWith('./'));const js=await readFile(new URL('../dist/xhs/app.js',import.meta.url),'utf8');assert.doesNotThrow(()=>new vm.Script(js));assert.doesNotMatch(js,/^import |^export /m);assert.equal(/\?\.(?![0-9])|\?\?/.test(js.split('\n').filter(l=>!l.trimStart().startsWith('//')).join('\n')),false);});
test('compressed and expanded package both remain below 10 MB',async()=>{const zip=await stat(new URL('../dist/rolling-town-xhs.zip',import.meta.url));const js=await stat(new URL('../dist/xhs/app.js',import.meta.url));assert.ok(zip.size<10*1024*1024);assert.ok(js.size<9*1024*1024);});

test('entire runtime parses as ES2017 including vendored Three.js',async()=>{const module={exports:{}};vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],{module,exports:module.exports});const js=await readFile(new URL('../dist/xhs/app.js',import.meta.url),'utf8');assert.doesNotThrow(()=>module.exports.parse(js,{ecmaVersion:2017,sourceType:'script'}));});

import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('actual ZIP contains only supported file types and preserves the full MIT license',async()=>{
 const archive=fileURLToPath(new URL('../dist/rolling-town-xhs.zip',import.meta.url));
 const result=JSON.parse(execFileSync('python3',['-c',"import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({'names':z.namelist(),'license':z.read('THREE-LICENSE.json').decode(),'crc':z.testzip()}))",archive],{encoding:'utf8'}));
 const allowed=new Set(['jpg','css','gif','svg','png','js','jpeg','json','html','woff2','webp','woff']);
 assert.ok(result.names.every(name=>allowed.has(name.split('.').pop())),result.names.join(', '));
 assert.deepEqual(result.names.sort(),['THREE-LICENSE.json','app.js','index.html','style.css']);
 assert.equal(result.crc,null);
 const original=await readFile(new URL('../vendor/THREE-LICENSE.txt',import.meta.url),'utf8');
 const embedded=JSON.parse(result.license).text;
 assert.equal(result.names.filter(name=>name.endsWith('.html')).length,1);
 assert.equal(embedded,original);
});
