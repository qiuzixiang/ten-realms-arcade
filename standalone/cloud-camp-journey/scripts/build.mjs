import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {LEVELS} from '../src/levels.mjs';
import {createBoard,applyAction,isSolved} from '../src/engine.mjs';
import {boardSvg} from '../src/art.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'dist/xhs');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const modules=[],known=new Map(),visiting=new Set();
// This project deliberately uses only static named imports and named declarations.
// A small, strict build-time linker avoids runtime modules and needs no npm dependencies.
async function link(file){
  file=resolve(file);if(known.has(file))return known.get(file);if(visiting.has(file))throw Error('Circular module dependency: '+file);
  visiting.add(file);let code=await readFile(file,'utf8');
  const imports=Array.from(code.matchAll(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm));
  for(const item of imports){if(!item[2].startsWith('./'))throw Error('Only local named imports supported');const id=await link(resolve(dirname(file),item[2]));const names=item[1].split(',').map(s=>s.trim()).filter(Boolean);if(names.some(s=>!/^[A-Za-z_$][\w$]*$/.test(s)))throw Error('Unsupported binding');code=code.replace(item[0],'const {'+names.join(',')+'} = modules['+id+'];');}
  const names=Array.from(code.matchAll(/^export\s+(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)).map(m=>m[1]);
  code=code.replace(/^export\s+(?=(?:function|const|let|class)\s)/gm,'');
  if(/^\s*(?:import|export)\s/m.test(code))throw Error('Unlinked syntax in '+file);
  const id=modules.length;modules.push('/* '+relative(root,file)+' */\nmodules['+id+']=(function(){\n'+code+'\nreturn {'+names.join(',')+'};\n})();');known.set(file,id);visiting.delete(file);return id;
}
await link(resolve(root,'src/app.mjs'));
const js='/* 云野露营 | MIT (c) 2026 Ten Realms Arcade contributors | ES2017 classic bundle */\n(function(){\n"use strict";\nconst modules=[];\n'+modules.join('\n')+'\n})();\n';
await writeFile(resolve(out,'app.js'),js);
await writeFile(resolve(root,'app.js'),js);
execFileSync(process.execPath,['--check',resolve(out,'app.js')]);
await cp(resolve(root,'assets'),resolve(out,'assets'),{recursive:true});
await cp(resolve(root,'styles.css'),resolve(out,'styles.css'));await cp(resolve(root,'index.html'),resolve(out,'index.html'));
const level=LEVELS[0],initial=createBoard(level),first=applyAction(level,initial,level.solution[0],1);
let complete=initial;level.solution.forEach(i=>{complete=applyAction(level,complete,i,1).board;});
if(!first.accepted||!isSolved(level,complete))throw Error('Tutorial truth failed');
const states=[initial,first.board,complete],labels=['01 · 认识树与行列配额','02 · 一次真实放帐操作','03 · 同一营地，真实完成'];
for(let i=0;i<3;i++){const svg=boardSvg(level,states[i],labels[i],i===1?level.solution[0]:-1);await writeFile(resolve(root,'assets/tutorial-'+(i+1)+'.svg'),svg);await writeFile(resolve(out,'assets/tutorial-'+(i+1)+'.svg'),svg);}
await writeFile(resolve(root,'release/tutorial-truth.json'),JSON.stringify({levelId:level.id,seed:level.seed,initial,action:{index:level.solution[0],value:1},after:first.board,complete,solved:true},null,2));
const license=await readFile(resolve(root,'LICENSE'),'utf8');await writeFile(resolve(out,'license.json'),JSON.stringify({license,rule:'Tents',source:'Simon Tatham Portable Puzzle Collection; Ten Realms Arcade cloud-camp (MIT)',art:'Original procedural SVG paper scenery by this project'},null,2));
execFileSync(process.execPath,[resolve(root,'scripts/audit.mjs'),'--directory']);
const zip=resolve(root,'dist/cloud-camp-journey-xhs.zip');await rm(zip,{force:true});
execFileSync('zip',['-q','-r',zip,'.'],{cwd:out});
execFileSync(process.execPath,[resolve(root,'scripts/audit.mjs')],{stdio:'inherit'});
console.log('Built classic ES2017 bundle, verified 3 tutorial states, and packaged '+zip);
