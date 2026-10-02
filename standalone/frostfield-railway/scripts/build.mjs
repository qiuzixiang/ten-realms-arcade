import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import './assets.mjs';
const output='dist/xhs';fs.mkdirSync(output,{recursive:true});fs.mkdirSync(output+'/assets',{recursive:true});
const files=['engine','levels','render','storage','session','app'];
// A closed dependency list; module declarations are stripped only after graph/order checks.
let code='/*'+fs.readFileSync('LICENSE','utf8')+'*/\n'+'/*! Frostfield Railway 1.0.0 | MIT | Ten Realms Arcade contributors | Tracks by Simon Tatham collection */\n(function(){\n\"use strict\";\n';
for(const file of files){let source=fs.readFileSync(`src/${file}.mjs`,'utf8');for(const m of source.matchAll(/^import .* from ['"]\.\/(.*?)\.mjs['"];?$/gm)){if(!files.slice(0,files.indexOf(file)).includes(m[1]))throw Error('Dependency order '+m[1]);}source=source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');code+='\n// '+file+'\n'+source+'\n';}code+='})();\n';
fs.writeFileSync(output+'/app.js',code);fs.copyFileSync('index.html',output+'/index.html');fs.copyFileSync('src/style.css',output+'/style.css');for(const f of fs.readdirSync('assets'))if(/\.(svg|png|webp)$/.test(f))fs.copyFileSync('assets/'+f,output+'/assets/'+f);
const zip=path.resolve('dist/frostfield-railway-xhs.zip');if(fs.existsSync(zip))fs.unlinkSync(zip);execFileSync('zip',['-X','-q','-r',zip,'.'],{cwd:output});console.log('Built '+zip+' · '+fs.statSync(zip).size+' bytes');
