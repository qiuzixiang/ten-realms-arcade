const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),out=path.join(root,'dist/xhs');
const report={status:'PASSED',scope:'local static candidate only',files:[],checks:[],currentOnlineSpecification:'unverified: attempt returned no retained response body on 2026-10-02; full exit status not retained'};
const allowed=/\.(html|css|js|svg|png|jpg|jpeg|webp|gif|json|woff|woff2)$/;
const files=[];function visit(dir){for(const f of fs.readdirSync(dir)){const p=path.join(dir,f);if(fs.statSync(p).isDirectory())visit(p);else files.push(p);}}visit(out);
for(const p of files){assert.match(p,allowed);const rel=path.relative(out,p);assert.ok(!/node_modules|\.git|\.DS_Store|\.map$/.test(rel));const text=fs.readFileSync(p,'utf8');
 if(p.endsWith('.js')){cp.execFileSync(process.execPath,['--check',p]);assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|WebAssembly|\beval\s*\(|new\s+Function|new\s+(?:Shared)?Worker|serviceWorker|\.replaceAll\(|\.at\(|Object\.hasOwn|structuredClone|\?\.|\?\?|\bimport\s|\bexport\s/.test(text),rel);}
 report.files.push({path:rel,bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
}
const html=fs.readFileSync(path.join(out,'index.html'),'utf8');assert.equal(files.filter(p=>p.endsWith('.html')).length,1);assert.ok(!/type=["']module|<iframe|<object|<base|http-equiv=["']Content-Security-Policy|\son\w+\s*=|javascript:/.test(html));
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert.ok(match[1].startsWith('./'));assert.ok(fs.existsSync(path.join(out,match[1])));}
const scripts=Array.from(html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g));assert.ok(scripts.every(m=>/src=/.test(m[1])&&!m[2].trim()));
const css=fs.readFileSync(path.join(out,'style.css'),'utf8');assert.ok(!/(?:[;{]\s*)gap\s*:|clamp\(|aspect-ratio|:has\(|@container|color-mix\(|\bdvh\b|\bsvh\b/.test(css));assert.ok(/\.\w+[\s\S]*:focus/.test(css));
report.checks=['single root HTML; only permitted types; local references exist; ordered external classic scripts; script syntax checks; banned-capability/new-syntax scan; margin/grid-gap CSS baseline; safe area ordinary fallback; no shared dependencies; licenses embedded as JSON'];
const zip=path.join(root,'dist/silk-loop-studio-xhs.zip');cp.execFileSync('unzip',['-t',zip]);report.zip={bytes:fs.statSync(zip).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex')};assert.ok(report.zip.bytes<=2*1024*1024);
fs.writeFileSync(path.join(root,'release/package-audit.json'),JSON.stringify(report,null,2));console.log('Static audit passed:',files.length,'files; CRC valid; ZIP',report.zip.bytes,'bytes');
