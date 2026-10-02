import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);
// Fixed, explicitly audited module graph: each module owns its lexical scope.
const order=['campaign','engine','renderer','session','app'];
let bundle='/* 星露配方 1.0.0 | MIT | Simon Tatham Keen rules reference */\n(function(){\n"use strict";\nconst modules={};\n';
for(const name of order){let source=fs.readFileSync('src/'+name+'.js','utf8');const exports=[];
 source=source.replace(/^import \{([^}]+)\} from '\.\/(\w+)\.js';$/gm,(_,names,dependency)=>{if(order.indexOf(dependency)>=order.indexOf(name))throw Error('Invalid dependency order');return 'const {'+names+'}=modules.'+dependency+';';});
 source=source.replace(/export (async )?(function|const) (\w+)/g,(_,asyncWord,type,key)=>{exports.push(key);return (asyncWord||'')+type+' '+key;});
 if(/\b(?:import|export)\s/.test(source))throw Error('Unsupported module syntax');
 bundle+='modules.'+name+'=(function(){\n'+source+'\nreturn {'+exports.join(',')+'};\n})();\n';
}
bundle+='})();\n';
fs.mkdirSync('dist/xhs',{recursive:true});
// Output is owned by this build; never touch paths outside this game's dist.
for(const name of fs.readdirSync('dist/xhs'))fs.rmSync(path.join('dist/xhs',name),{recursive:true,force:true});
fs.writeFileSync('dist/xhs/app.js',bundle);
fs.copyFileSync('index.template','dist/xhs/index.html');
for(const name of ['styles.css','icon.svg'])fs.copyFileSync(name,'dist/xhs/'+name);
const license=fs.readFileSync('LICENSE','utf8');fs.writeFileSync('dist/xhs/licenses.json',JSON.stringify({license,upstreamLicense:fs.readFileSync('UPSTREAM-LICENSE','utf8'),referenceLicense:fs.readFileSync('REFERENCE-LICENSE','utf8'),source:'Simon Tatham Portable Puzzle Collection: Keen; ebnbin/puzzles snapshot 5a9e1795a3324e0f6433b79fbe31cbd9b12048a3. Rules independently implemented.'}));
const zip=path.resolve('dist/stardew-formulas-xhs.zip');if(fs.existsSync(zip))fs.unlinkSync(zip);execFileSync('zip',['-q','-r',zip,'.'],{cwd:path.resolve('dist/xhs')});
console.log('Built classic ES2017 modules + ZIP',fs.statSync(zip).size,'bytes');
