import { readFile, cp, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = process.cwd();
const games = JSON.parse(await readFile(path.join(root, 'standalone/games.json'), 'utf8'));
function run(command,cwd) { execFileSync(command[0],command.slice(1),{cwd,stdio:'inherit'}); }
export async function buildStandalone() {
 const target=path.join(root,'dist/standalone');
 await mkdir(path.join(target,'downloads'),{recursive:true});
 await cp(path.join(root,'standalone/index.html'),path.join(target,'index.html'));
 for(const game of games) {
  const cwd=path.join(root,'standalone',game.slug); run(game.build,cwd);
  await cp(path.join(cwd,game.output),path.join(target,game.slug),{recursive:true});
  run(['python3','-c',"import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2])",path.join(target,'downloads',game.slug+'-offline'),path.join(target,game.slug)],root);
 }
}
if(process.argv[2]==='install') {
 for(const game of games) {
  const cwd=path.join(root,'standalone',game.slug);
  let pkg; try {pkg=JSON.parse(await readFile(path.join(cwd,'package.json'),'utf8'));}catch{continue;}
  if(pkg.dependencies||pkg.devDependencies) run(['npm','ci','--no-audit','--no-fund'],cwd);
 }
}
if(process.argv[2]==='test') for(const game of games) {
 const cwd=path.join(root,'standalone',game.slug); run(game.build,cwd); run(game.test,cwd);
}
