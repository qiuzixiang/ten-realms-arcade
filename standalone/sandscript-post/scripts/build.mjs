import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {execFileSync} from 'node:child_process';import {solve} from './oracle.mjs';
const ctx=vm.createContext({});for(const f of ['engine','levels','renderer'])vm.runInContext(fs.readFileSync('src/'+f+'.js','utf8'),ctx);
const E=ctx.SandEngine,L=ctx.SandLevels,R=ctx.SandRender,out='dist/xhs';fs.mkdirSync(out,{recursive:true});
const answers={};for(const l of L){const proof=solve(l);if(proof.count!==1||!proof.exhausted)throw Error('Unproven '+l.id);answers[l.id]=proof.solutions[0];}
const l=L[0],p=answers[l.id],initial=E.empty(l),first=E.apply(l,initial,{type:'link',a:p[0],b:p[1]}).next;let final=initial;for(let k=0;k<p.length-1;k++)final=E.apply(l,final,{type:'link',a:p[k],b:p[k+1]}).next;if(!E.inspect(l,final).won)throw Error('Tutorial failed');
[initial,first,final].forEach((s,i)=>fs.writeFileSync(path.join(out,'tutorial-'+i+'.svg'),R.svg(l,s,-1,[])));
const license=fs.readFileSync('LICENSE','utf8');fs.writeFileSync(path.join(out,'app.js'),['engine','levels','storage','renderer'].map(f=>fs.readFileSync('src/'+f+'.js','utf8')).join('\n')+'\nwindow.SandAnswers='+JSON.stringify(answers)+';\nwindow.SandLicense='+JSON.stringify(license)+';\n'+fs.readFileSync('src/app.js','utf8'));
for(const f of ['index.html','styles.css'])fs.copyFileSync(f,path.join(out,f));
execFileSync('python3',['-c','import zipfile,pathlib; p=pathlib.Path("dist/xhs"); z=zipfile.ZipFile("dist/sandscript-post-xhs.zip","w",zipfile.ZIP_DEFLATED); [z.write(f,f.relative_to(p)) for f in sorted(p.rglob("*")) if f.is_file()]; z.close()']);
fs.writeFileSync('release/tutorial-proof.json',JSON.stringify({id:'sandscript-post-tutorial-v1',level:l.id,seed:l.seed,firstAction:{type:'link',a:p[0],b:p[1]},path:p,states:[initial,first,final]},null,2));console.log('Built classic offline bundle',fs.statSync('dist/sandscript-post-xhs.zip').size,'bytes');
