import {mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const out='dist/xhs';rmSync(out,{recursive:true,force:true});mkdirSync(out+'/assets',{recursive:true});
const order=['engine','solver','levels','session','render','hints','app'];
const js=order.map(name=>readFileSync('src/'+name+'.mjs','utf8').replace(/^import .*;\n/gm,'').replace(/\bexport (?=(const|function|async function)\b)/g,'')).join('\n');
// Modules use disjoint top-level names; statically bundled into one strict IIFE.
writeFileSync(out+'/app.js','/* 月影书斋 v1.0.0 | MIT | Ten Realms Arcade contributors */\n(function(){\n"use strict";\n'+js+'\n})();\n');
copyFileSync('src/index.template',out+'/index.html');copyFileSync('src/styles.css',out+'/styles.css');
for(const f of ['icon.svg','study.svg'])copyFileSync('assets/'+f,out+'/assets/'+f);
writeFileSync(out+'/assets/licenses.json',JSON.stringify({title:'月影书斋',version:'1.0.0',rule:'Hitori / Singles, Simon Tatham puzzle collection',reference:'Ten Realms Arcade shadow-print-lab at 55cdddb75cf57c17baee80bac4121bd3be1687c6',license:readFileSync('LICENSE','utf8'),art:'Original code-native SVG, AI-assisted'},null,2));
execFileSync(process.execPath,['--check',out+'/app.js'],{stdio:'inherit'});
rmSync('dist/moonshade-archive-xhs.zip',{force:true});execFileSync('zip',['-q','-r','../moonshade-archive-xhs.zip','.'],{cwd:out});console.log('Built classic ES2017 package.');
