import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {parse} from 'acorn';import {root} from './lib.mjs';
const dir=new URL('dist/xhs/',root),zip=new URL('dist/evening-bell-garden-xhs.zip',root),js=fs.readFileSync(new URL('app.js',dir),'utf8'),html=fs.readFileSync(new URL('index.html',dir),'utf8'),css=fs.readFileSync(new URL('styles.css',dir),'utf8');
parse(js,{ecmaVersion:2017,sourceType:'script'});
for(const re of [/\bfetch\s*\(/,/XMLHttpRequest/,/\bWorker\b/,/\beval\s*\(/,/new\s+Function/,/WebAssembly/,/\.replaceAll\s*\(/,/\.at\s*\(/,/\blocalStorage\.clear/,/window\.open/,/window\.prompt/,/navigator\.(clipboard|geolocation|serviceWorker|credentials|locks|bluetooth|usb|hid|serial|storage|connection|getBattery)/,/new\s+(WebSocket|EventSource|RTCPeerConnection)/,/requestFullscreen/])assert(!re.test(js),re.toString());
assert(!/<script(?![^>]*src=)[^>]*>/i.test(html));assert(!/\son\w+=|type="module"|<base|<iframe|<object|Content-Security-Policy/i.test(html));assert(!/\b(?:clamp|min|max)\(|aspect-ratio|(?:^|[;{])gap:|:has\(|backdrop-filter|\binset:/.test(css));
for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert(m[1].startsWith('./'));assert(fs.existsSync(new URL(m[1],dir)));}
for(const m of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){assert(m[1].startsWith('./'));assert(fs.existsSync(new URL(m[1],dir)));}
const report=JSON.parse(execFileSync('python3',['-c',`import pathlib,zipfile,sys,json,xml.etree.ElementTree as ET
base=pathlib.Path(sys.argv[1]); archive=pathlib.Path(sys.argv[2]); exts={'.html','.css','.js','.json','.svg','.png','.jpg','.webp'}
files=[p for p in base.rglob('*') if p.is_file()]
for p in files:
 assert p.suffix in exts,p
 if p.suffix=='.svg': ET.parse(p)
 assert p.stat().st_size<2*1024*1024,p
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert z.namelist().count('index.html')==1
 assert len([n for n in z.namelist() if n.endswith('.html')])==1
 assert sorted(z.namelist())==sorted(p.relative_to(base).as_posix() for p in files)
 for p in files: assert z.read(p.relative_to(base).as_posix())==p.read_bytes()
assert archive.stat().st_size<2*1024*1024
print(json.dumps({'files':len(files),'uncompressedBytes':sum(p.stat().st_size for p in files),'zipBytes':archive.stat().st_size,'crc':'PASS','xml':'PASS','zipMatchesDirectory':True}))`,fileURLToPath(dir),fileURLToPath(zip)],{encoding:'utf8'}));
report.es2017='PASS';report.prohibitedAPIs='PASS';report.localReferences='PASS';report.compatibilityNote='Static ES2017/CSS61 checks; actual Chrome61 and device WebViews not tested';fs.writeFileSync(new URL('release/audit.json',root),JSON.stringify(report,null,2));console.log(report);
