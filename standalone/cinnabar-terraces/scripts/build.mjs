import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(base);
execFileSync(process.execPath,['scripts/assets.mjs'],{stdio:'inherit'});
const output=path.join(base,'dist/xhs');fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(path.join(output,'assets'),{recursive:true});
for(const f of ['index.html','style.css','engine.js','levels.js','session.js','storage.js','view.js','app.js'])fs.copyFileSync(f,path.join(output,f));
for(const f of fs.readdirSync('assets'))if(/\.svg$/.test(f))fs.copyFileSync(path.join('assets',f),path.join(output,'assets',f));
// Preserve MIT and notices in a permitted JSON artifact, with complete license text.
fs.writeFileSync(path.join(output,'licenses.json'),JSON.stringify({license:fs.readFileSync('LICENSE','utf8'),notices:fs.readFileSync('THIRD_PARTY_NOTICES.md','utf8')},null,2));
const zip=path.join(base,'dist/cinnabar-terraces-xhs-candidate.zip');fs.rmSync(zip,{force:true});execFileSync('zip',['-q','-r',zip,'.'],{cwd:output});console.log('Built local candidate: '+zip+' ('+fs.statSync(zip).size+' bytes)');
