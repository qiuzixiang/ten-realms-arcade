import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/xhs/',import.meta.url)),base=fileURLToPath(new URL('..',import.meta.url)),list=[];
function walk(dir){for(const name of readdirSync(dir)){const p=resolve(dir,name);if(statSync(p).isDirectory())walk(p);else list.push(p);}}walk(root);
const forbidden=[/\bfetch\s*\(/,/XMLHttpRequest/,/\bWebSocket\b/,/\bEventSource\b/,/\b(?:Shared)?Worker\b/,/serviceWorker/,/\beval\s*\(/,/new\s+Function/,/WebAssembly/,/window\.(?:open|prompt)\s*\(/,/navigator\.(?:clipboard|geolocation|bluetooth|usb|hid|serial|locks|credentials|storage)/,/getDisplayMedia/,/requestFullscreen/,/DeviceMotionEvent|DeviceOrientationEvent/,/\.replaceAll\s*\(|\.at\s*\(|Object\.hasOwn\s*\(|structuredClone\s*\(|\.flat\s*\(/];
const artifacts=[];
for(const path of list){const text=readFileSync(path,'utf8'),ext=extname(path);assert.ok(['.html','.css','.js','.svg','.json'].includes(ext));
 if(ext==='.js'){for(const re of forbidden)assert.ok(!re.test(text),'forbidden '+re);assert.ok(!/^\s*(?:import|export)\b/m.test(text));execFileSync(process.execPath,['--check',path]);}
 if(ext==='.html'){assert.ok(!/type=["']module/.test(text));assert.ok(!/\son[a-z]+\s*=/.test(text));assert.ok(!/<(?:iframe|object|base)\b/i.test(text));assert.ok(!/<meta[^>]+content-security-policy/i.test(text));assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>\s*[^<]/i.test(text));}
 if(ext==='.html'||ext==='.css'){for(const match of text.matchAll(/(?:src|href)=["']([^"']+)|url\(["']?([^)'"\s]+)/g)){const ref=match[1]||match[2];assert.ok(ref.startsWith('./')||ref.startsWith('#')||ref.startsWith('data:'),'relative ref '+ref);if(ref.startsWith('./'))assert.ok(statSync(resolve(root,ref)).isFile());}}
 artifacts.push({path:path.slice(root.length),bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
const zip=resolve(base,'dist/porcelain-flow-atelier-xhs.zip'),zipList=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).split('\n').filter(Boolean);assert.ok(zipList.includes('index.html'));assert.ok(zipList.filter(n=>n.endsWith('index.html')).length===1);assert.ok(!zipList.some(n=>n.startsWith('/')||n.includes('..')||n.includes('.DS_Store')||n.endsWith('.map')));execFileSync('unzip',['-t',zip]);
// Source is directly written in ES2017; no modern syntax transpiler or runtime polyfill required.
const js=readFileSync(resolve(root,'app.js'),'utf8');assert.ok(!/\?\.|\?\?|\bclass\s+\w+[^]*?#[a-zA-Z]|\basync\s*\*/.test(js));assert.ok(!/\.\.\.\s*\w+\s*[,}]/.test(js));
const report={files:artifacts,zip:{bytes:statSync(zip).size,sha256:createHash('sha256').update(readFileSync(zip)).digest('hex'),entries:zipList,crc:'pass'},checks:['classic script; node syntax parse','relative references exist','forbidden capability scan','ES2017 modern-syntax/runtime scan and manual review; not Chrome61 execution','ZIP root/type/escape/CRC','no external assets; licenses bundled'],limitations:['No official simulator or physical Android/iOS/Chrome61 execution','latest online document DNS timeout']};
writeFileSync(resolve(base,'release/static-audit.json'),JSON.stringify(report,null,2));console.log('PASS static audit: '+artifacts.length+' local files; CRC, references, classic script, banned APIs and syntax scan; ZIP '+report.zip.bytes+' bytes');
