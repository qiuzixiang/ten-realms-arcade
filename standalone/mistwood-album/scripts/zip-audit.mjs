import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
export function audit(out,zip){
  const checks=[];function check(value,label){if(!value)throw new Error('ZIP audit failed: '+label);checks.push(label);}
  const files=fs.readdirSync(out,{recursive:true}).filter(f=>fs.statSync(path.join(out,f)).isFile());
  check(files.includes('index.html'),'index.html at package root');
  check(files.filter(f=>/\.html$/.test(f)).length===1,'single HTML entry');
  check(files.every(f=>/\.(html|css|js|png|jpe?g|gif|webp|svg|woff2?|json)$/.test(f)),'all extensions allowed');
  check(!files.some(f=>/node_modules|\.git|\.map$|\.DS_Store/.test(f)),'no development artifacts');
  const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
  check(/lang="zh-CN"/.test(html)&&/charset="UTF-8"/.test(html)&&/viewport-fit=cover/.test(html),'Chinese UTF-8 and mobile viewport');
  check(!/<(?:iframe|object|base)\b|type="module"|\son\w+\s*=|javascript:|http-equiv="Content-Security-Policy"/i.test(html),'no forbidden HTML features');
  const scriptTags=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  check(scriptTags.every(m=>/src="\.\//.test(m[1])&&!m[2].trim()),'classic external scripts only');
  [...html.matchAll(/(?:src|href)="([^\"]+)"/g)].forEach(m=>check(m[1].startsWith('./')&&fs.existsSync(path.join(out,m[1])),'local resource '+m[1]));
  let textBytes=0;
  files.forEach(file=>{
    const full=path.join(out,file);if(/\.(js|css|html|json)$/.test(file))textBytes+=fs.statSync(full).size;
    if(/\.(js|css|html|svg)$/.test(file)){
      const text=fs.readFileSync(full,'utf8');
      check(!/(?:src|href)=["']https?:|url\(\s*["']?https?:/i.test(text),'no external resources in '+file);
      if(/\.css$/.test(file))check(!/#[a-f0-9]{8}\b|#[a-f0-9]{4}\b|\b(?:clamp|min|max|color-mix)\(|backdrop-filter|(?:^|[;{])\s*gap:|aspect-ratio|:has\(/i.test(text),'Chrome 61 CSS baseline '+file);
      if(/\.js$/.test(file)){
        new vm.Script(text);
        check(!/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|SharedWorker|Worker\s*\(|WebAssembly|eval\s*\(|new Function)|navigator\.(?:clipboard|geolocation|serviceWorker|bluetooth|usb|hid|serial|credentials|locks)|window\.(?:open|prompt)\s*\(/.test(text),'no prohibited capabilities in '+file);
        check(!/\?\.|\?\?|\b(?:import|export)\s|\.at\(|\.replaceAll\(|structuredClone|Object\.hasOwn|\d_\d/.test(text),'ES2017 static syntax and API screening '+file);
        check(!/localStorage\.clear|storage\.clear\(/.test(text),'storage isolation '+file);
      }
    }
  });
  check(textBytes<5*1024*1024,'text budget under 5 MiB');
  check(fs.statSync(zip).size<10*1024*1024,'ZIP under 10 MiB');
  const listing=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');
  check(listing.includes('index.html'),'ZIP root verified');
  check(!listing.some(f=>f.startsWith('/')||f.split('/').includes('..')),'safe archive paths');
  return {passed:true,zipBytes:fs.statSync(zip).size,textBytes,files,checks};
}
