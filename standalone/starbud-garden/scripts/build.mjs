import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const out='dist/xhs';fs.mkdirSync(out,{recursive:true});
for(const f of ['index.html','styles.css','icon.svg'])fs.copyFileSync(f,path.join(out,f));
fs.writeFileSync(out+'/index.html',fs.readFileSync('index.html','utf8').replace(/<!-- runtime-start -->[\s\S]*?<!-- runtime-end -->/,'<script src="./app.js"></script>'));
const files=['engine','storage','render','levels'];const license=fs.readFileSync('LICENSE','utf8')+'\n'+fs.readFileSync('THIRD_PARTY_NOTICES.md','utf8');let js='/* Starbud Garden 1.0.0 · MIT */\n'+files.map(f=>fs.readFileSync('src/'+f+'.js','utf8')).join('\n')+'\nStarbud.license='+JSON.stringify(license)+';\n'+fs.readFileSync('src/app.js','utf8');fs.writeFileSync(out+'/app.js',js);
const names=['index.html','styles.css','icon.svg','app.js'];for(const name of names)fs.utimesSync(out+'/'+name,new Date('2000-01-01T00:00:00Z'),new Date('2000-01-01T00:00:00Z'));const zip=path.resolve('dist/starbud-garden-xhs.zip');if(fs.existsSync(zip))fs.unlinkSync(zip);execFileSync('zip',['-X','-q',zip,...names],{cwd:out,env:Object.assign({},process.env,{TZ:'UTC'})});console.log('Built',zip,fs.statSync(zip).size,'bytes');
