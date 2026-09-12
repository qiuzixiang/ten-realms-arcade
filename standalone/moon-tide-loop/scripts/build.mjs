import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { LEVELS } from '../src/levels.mjs';
import { createState,applyEdge,checkWin } from '../src/engine.mjs';
import { boardSvg } from '../src/render.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist/xhs');
await fs.mkdir(out,{recursive:true});
// Only this game's known generated output directory is replaced.
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(path.join(out,'assets'),{recursive:true});
const modules=new Map();
async function bundle(file){
 const full=path.resolve(file);if(modules.has(full))return;const source=(await fs.readFile(full,'utf8')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
 const deps=[];const imports=/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g;let match;
 while((match=imports.exec(source)))deps.push(path.resolve(path.dirname(full),match[2]));
 for(const dep of deps)await bundle(dep);
 const exported=[];let code=source.replace(imports,(_,names,rel)=>'const {'+names.replace(/\bas\b/g,':')+'}=M['+JSON.stringify(path.relative(root,path.resolve(path.dirname(full),rel)))+'];');
 code=code.replace(/export\s+(const|let|var|function|class)\s+(\w+)/g,(_,kind,name)=>{exported.push(name);return kind+' '+name;});
 if(/\bexport\s|\bimport\s/.test(code))throw new Error('Unsupported module syntax in '+full);
 modules.set(full,'M['+JSON.stringify(path.relative(root,full))+']=(function(){\n'+code+'\nreturn {'+exported.join(',')+'};\n})();');
}
await bundle(path.join(root,'src/app.mjs'));
const script='/* Moon Tide Loop | MIT | ES2017 classic offline bundle */\n(function(){"use strict";const M={};\n'+Array.from(modules.values()).join('\n')+'\n})();\n';
await fs.writeFile(path.join(out,'app.js'),script);
await fs.writeFile(path.join(root,'app.js'),script);
for(const file of ['index.html','styles.css'])await fs.copyFile(path.join(root,file),path.join(out,file));
for(const file of await fs.readdir(path.join(root,'assets')))if(/\.(svg|png|webp)$/.test(file))await fs.copyFile(path.join(root,'assets',file),path.join(out,'assets',file));
const level=LEVELS[0],initial=createState(level),acted=applyEdge(level,initial,0,1),solved=level.solution;
if(!checkWin(level,solved))throw new Error('Tutorial solution is invalid');
const states=[initial.edges,acted.edges,solved],stages=['initial','one-action','complete'];
for(let i=0;i<3;i++){
 const svg=boardSvg(level,states[i],{stage:stages[i],selectedCell:i===1?0:undefined});
 await fs.writeFile(path.join(root,'assets/tutorial-'+(i+1)+'.svg'),svg);
 await fs.writeFile(path.join(out,'assets/tutorial-'+(i+1)+'.svg'),svg);
}
await fs.writeFile(path.join(root,'assets/tutorial-data.json'),JSON.stringify({levelId:level.id,seed:level.seed,states:states.map((edges,i)=>({stage:stages[i],edges,won:checkWin(level,edges)})),action:{edge:0,value:1}},null,2)+'\n');
const license=await fs.readFile(path.join(root,'LICENSE'),'utf8');
await fs.writeFile(path.join(out,'license.json'),JSON.stringify({license:'MIT',copyright:'2026 Ten Realms Arcade contributors',text:license,rule:'Loopy / Slitherlink',sources:['https://www.chiark.greenend.org.uk/~sgtatham/puzzles/','https://github.com/ebnbin/puzzles'],implementation:'Original rule engine, solver, generator, interface and vector artwork for Moon Tide Loop.'},null,2));
const zip=path.join(root,'dist/moon-tide-loop-xhs.zip');await fs.rm(zip,{force:true});execFileSync('zip',['-q','-r',zip,'.'],{cwd:out});
console.log('Built '+out+'\nZIP '+zip+' ('+(await fs.stat(zip)).size+' bytes)');
