import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url)),repo=path.resolve(root,'../..'),temp=path.join(root,'.verification','clean');
if(fs.existsSync(temp))fs.rmSync(temp,{recursive:true,force:true});fs.mkdirSync(temp,{recursive:true});
const archive=execFileSync('git',['archive','HEAD'],{cwd:repo,maxBuffer:100*1024*1024});execFileSync('tar',['-xf','-','-C',temp],{input:archive});
const destination=path.join(temp,'standalone','stardew-formulas');
fs.mkdirSync(destination,{recursive:true});
for(const name of fs.readdirSync(root))if(!['.verification','dist','node_modules','release'].includes(name))fs.cpSync(path.join(root,name),path.join(destination,name),{recursive:true});
const logs=[];
for(const script of ['build','test','audit']){
 const out=execFileSync('npm',['run',script],{cwd:destination,encoding:'utf8',maxBuffer:5*1024*1024});logs.push('npm run '+script+'\n'+out);console.log('clean game:',script,'PASS');
}
for(const script of ['test','build']){
 try{const out=execFileSync('npm',['run',script],{cwd:temp,encoding:'utf8',maxBuffer:5*1024*1024});logs.push('root npm run '+script+'\n'+out);console.log('clean repository:',script,'PASS');}catch(e){logs.push('root npm run '+script+'\nFAILED\n'+e.stdout+'\n'+e.stderr);console.log('clean repository:',script,'FAILED (see log)');}
}
fs.mkdirSync(path.join(root,'release'),{recursive:true});fs.writeFileSync(path.join(root,'release','clean-check.log'),logs.join('\n\n'));
// Compare regenerated campaign to versioned source to detect hidden generator dependencies.
const before=fs.readFileSync(path.join(destination,'data/campaign.json'));execFileSync(process.execPath,['scripts/generate.mjs'],{cwd:destination});if(!before.equals(fs.readFileSync(path.join(destination,'data/campaign.json'))))throw Error('Generator not reproducible');
console.log('Deterministic regeneration PASS. Clean source export from HEAD + task files (no commit created).');
