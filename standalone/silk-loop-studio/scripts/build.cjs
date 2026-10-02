const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.join(__dirname,'..'),out=path.join(root,'dist/xhs');
fs.mkdirSync(out,{recursive:true});
// Only this game's explicitly generated directory is removed.
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
['index.html','style.css','engine.js','levels.js','session.js','storage.js','view.js','app.js'].forEach(f=>fs.copyFileSync(path.join(root,f),path.join(out,f)));
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
// Package license inside supported HTML/JSON types, without a second HTML page.
const notices=fs.existsSync(path.join(root,'THIRD_PARTY_NOTICES.md'))?fs.readFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8'):'';
fs.writeFileSync(path.join(out,'license.json'),JSON.stringify({license:fs.readFileSync(path.join(root,'LICENSE'),'utf8'),notices}));
const zip=path.join(root,'dist/silk-loop-studio-xhs.zip');if(fs.existsSync(zip))fs.unlinkSync(zip);
function stamp(dir){fs.readdirSync(dir).sort().forEach(f=>{const p=path.join(dir,f);if(fs.statSync(p).isDirectory())stamp(p);fs.utimesSync(p,new Date('2026-01-01T00:00:00Z'),new Date('2026-01-01T00:00:00Z'));});}
stamp(out);
cp.execFileSync('zip',['-X','-q','-r',zip,'.'],{cwd:out,env:Object.assign({},process.env,{TZ:'UTC'})});
console.log('Built classic-script local candidate:',zip,fs.statSync(zip).size,'bytes');
