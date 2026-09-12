import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),base=resolve(root,'dist/xhs');
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())await walk(resolve(dir,e.name));else files.push(resolve(dir,e.name));}}await walk(base);
const allowed=new Set(['.html','.js','.css','.svg','.png','.jpg','.jpeg','.webp','.json','.woff','.woff2','.gif']);
let textBytes=0;for(const f of files){if(!allowed.has(extname(f)))throw Error('Unsupported artifact: '+f);if(/\.(js|css|html|json)$/.test(f))textBytes+=(await stat(f)).size;}
const html=await readFile(resolve(base,'index.html'),'utf8'),js=await readFile(resolve(base,'app.js'),'utf8'),css=await readFile(resolve(base,'styles.css'),'utf8');
const denied=[/\bfetch\s*\(/,/XMLHttpRequest/,/\bnew\s+(?:Worker|SharedWorker|WebSocket|EventSource|RTCPeerConnection)\b/,/navigator\.(?:serviceWorker|geolocation|clipboard|bluetooth|usb|hid|serial|credentials|locks|connection)/,/\beval\s*\(/,/\bnew\s+Function\s*\(/,/WebAssembly\./,/window\.(?:open|prompt)\s*\(/,/localStorage\.clear\s*\(/,/\bimport\s*\(/,/^\s*(?:import|export)\s/m,/\?\./,/\?\?/,/\.flatMap\s*\(/,/\.replaceAll\s*\(/,/\.at\s*\(/,/structuredClone\s*\(/];
for(const re of denied)if(re.test(js))throw Error('Forbidden/unsupported JS: '+re);
if(/type=["']module|<script[^>]*>\s*[^<\s]|\son\w+\s*=|<iframe|<object|<base|javascript:|http-equiv=["']Content-Security-Policy/i.test(html))throw Error('Invalid HTML capability');
if(/(?:src|href)=["'](?:https?:|\/)/i.test(html)||/url\(\s*['"]?https?:/i.test(css))throw Error('External reference');
if(/(?:aspect-ratio|clamp\(|color-mix\(|:has\(|@container|\binset:|[;{]\s*gap:)/.test(css))throw Error('Unreviewed modern CSS');
for(const m of html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g))await stat(resolve(base,m[1]));
for(const m of js.matchAll(/\.\/assets\/([a-zA-Z0-9_-]+\.(?:svg|png|webp))/g))await stat(resolve(base,'assets',m[1]));
if(files.filter(f=>f.endsWith('.html')).length!==1)throw Error('Single-page package required');
let zipBytes=null,entries=[];if(!process.argv.includes('--directory')){const zip=resolve(root,'dist/cloud-camp-journey-xhs.zip');zipBytes=(await stat(zip)).size;if(zipBytes>10*1024*1024)throw Error('ZIP too large');entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');if(!entries.includes('index.html')||entries.some(x=>x.includes('node_modules')||x.endsWith('.map')||x.includes('.DS_Store')))throw Error('ZIP shape invalid');execFileSync('unzip',['-t',zip]);}
const report={ok:true,createdAt:new Date().toISOString(),fileCount:files.length,textBytes,zipBytes,entry:'index.html',classicScript:true,networkCalls:false,workers:false,modules:false,inlineScript:false,chrome61Baseline:'static source review, runtime not tested',entries};
if(zipBytes!==null)await writeFile(resolve(root,'release/zip-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
