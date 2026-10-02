import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {root} from './lib.mjs';
import './assets.mjs';
const out=new URL('dist/xhs/',root);fs.mkdirSync(out,{recursive:true});
// Only this game's generated output directory is reset.
for(const name of fs.readdirSync(out))fs.rmSync(new URL(name,out),{recursive:true,force:true});
for(const f of ['index.html','styles.css'])fs.writeFileSync(new URL(f,out),fs.readFileSync(new URL('src/'+f,root),'utf8').replace(/\.\.\/assets\//g,'./assets/'));
let code='/* Evening Bell Garden 1.0.0 | MIT | See assets/licenses.json */\n';for(const f of ['engine','levels','store','render','app'])code+=fs.readFileSync(new URL('src/'+f+'.js',root),'utf8')+'\n';fs.writeFileSync(new URL('app.js',out),code);
fs.cpSync(new URL('assets/',root),new URL('assets/',out),{recursive:true});
const zip=new URL('dist/evening-bell-garden-xhs.zip',root);fs.rmSync(zip,{force:true});execFileSync('python3',['-c',`import zipfile,pathlib,sys
base=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(base.rglob('*')):
  if p.is_file():
   info=zipfile.ZipInfo(p.relative_to(base).as_posix(),(2026,9,14,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,p.read_bytes())`,fileURLToPath(out),fileURLToPath(zip)]);console.log('Built classic ES2017 offline ZIP:',fs.statSync(zip).size,'bytes');
