import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createGame, attemptMove } from '../core.mjs';
import { LEVELS } from '../levels.mjs';
import { boardMarkup, boardDimensions, cellPoint, renderBoard } from '../renderer.mjs';
import { buildStandalone, RUNTIME_FILES } from '../tools/build.mjs';

const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const app=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const {destination:output}=await buildStandalone();
const tutorialLevel=LEVELS[1];
const initial=createGame(tutorialLevel);
const action=attemptMove(initial,'E').state;
const won=attemptMove(action,'S').state;

function tileCount(svg,tile) {return [...svg.matchAll(new RegExp(`data-tile="${tile}"`,'g'))].length;}

test('tutorial initial → right → down is an exact two-move, two-crystal win', () => {
  assert.deepEqual(tutorialLevel.solution,['E','S']);
  assert.equal(tutorialLevel.par,2);
  assert.deepEqual(initial.position,{x:1,y:1});assert.equal(initial.remainingEnergy.length,2);
  assert.deepEqual(action.position,{x:4,y:1});assert.equal(action.remainingEnergy.length,1);
  assert.equal(action.moves,1);assert.equal(action.status,'playing');
  assert.deepEqual(won.position,{x:4,y:4});assert.equal(won.remainingEnergy.length,0);
  assert.equal(won.moves,2);assert.equal(won.status,'won');
  assert.match(app,/const level\s*=\s*LEVELS\[1\]/);
  assert.match(app,/action\s*=\s*attemptMove\(initial,\s*'E'\)/);
});

test('actual tutorial figures carry replayable metadata and consistent rendered entities', () => {
  const start=app.indexOf('function figure('),end=app.indexOf('function showTutorial(',start);
  assert.ok(start>=0&&end>start,'tutorial figure generator must be available');
  // Execute the production pure figure function without booting DOM event wiring.
  const figure=vm.runInNewContext(`(${app.slice(start,end).trim()})`,{
    boardDimensions,boardMarkup,escape:value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
  });
  for(const [index,state] of [initial,action,won].entries()) {
    const markup=figure(state,`integration-${index}`,'真实教程状态');
    assert.match(markup,new RegExp(`data-level="${tutorialLevel.id}"`));
    assert.match(markup,new RegExp(`data-moves="${index}"`));
    assert.match(markup,new RegExp(`data-status="${state.status}"`));
    assert.match(markup,/<svg role="img" aria-label="真实教程状态" viewBox="0 0 400 400" xmlns="http:\/\/www.w3.org\/2000\/svg">/);
    assert.equal(tileCount(markup,'energy'),2-index);
    assert.equal(tileCount(markup,'anchor'),1);
    assert.equal(tileCount(markup,'mine'),0);
    assert.equal(tileCount(markup,'wall'),20);
    const point=cellPoint(state,state.position);
    assert.ok(markup.includes(`data-ship transform="translate(${point.x} ${point.y})"`));
    assert.doesNotMatch(markup,/NaN|undefined|Infinity/);
  }
});

test('renderer exposes accessible size/state and collision-free gradient identifiers', () => {
  const attributes=new Map(),svg={setAttribute:(name,value)=>attributes.set(name,value),innerHTML:''};
  renderBoard(svg,action,{idPrefix:'current game'});
  assert.equal(attributes.get('role'),'img');
  assert.equal(attributes.get('xmlns'),'http://www.w3.org/2000/svg');
  assert.equal(attributes.get('viewBox'),'0 0 400 400');
  assert.match(attributes.get('aria-label'),/剩余 1 枚星核/);
  assert.match(attributes.get('aria-label'),/第 5 列、第 2 行/);
  const a=boardMarkup(initial,{idPrefix:'guide-a'}),b=boardMarkup(action,{idPrefix:'guide-b'});
  const ids=[...`${a}${b}`.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
});

const modulePattern=/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g;
const assetPattern=/(?:src|href)=["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/g;
async function assertLocalReference(file,reference) {
  if(/^(?:https?:|data:|#)/.test(reference))return;
  if(!reference.startsWith('.'))return;
  const target=path.resolve(output,path.dirname(file),reference.split(/[?#]/)[0]);
  assert.ok(target===output||target.startsWith(`${output}${path.sep}`),`${file} escapes independent package: ${reference}`);
  await stat(target);
}

test('production build contains every runtime dependency and no parent-game imports', async () => {
  for(const file of RUNTIME_FILES) {
    const source=await readFile(path.join(output,file),'utf8');
    for(const match of source.matchAll(modulePattern))await assertLocalReference(file,match[1]??match[2]);
    if(/\.(?:html|css)$/.test(file))for(const match of source.matchAll(assetPattern))await assertLocalReference(file,match[1]??match[2]);
    assert.doesNotMatch(source,/miniprogram-adapter|TenRealmsV[23]|localStorage\.clear\(/);
  }
  const entries=await readdir(output);
  for(const omitted of ['tests','tools','node_modules','dist','sw.js'])assert.ok(!entries.includes(omitted));
  assert.ok(entries.includes('THIRD_PARTY_NOTICES.md'));
  const metadata=JSON.parse(await readFile(path.join(output,'build-info.json'),'utf8'));
  assert.deepEqual(metadata.runtimeDependencies,[]);
});

test('build script refuses destructive destinations outside owned generated output', async () => {
  await assert.rejects(buildStandalone({outDir:sourceRoot}),/documented generated dist/);
  await assert.rejects(buildStandalone({outDir:path.join(sourceRoot,'assets')}),/documented generated dist/);
});

test('packaged HTML, modules, CSS, SVG, and PNG are served with usable web content', async t => {
  const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
  const server=createServer(async (request,response)=>{
    try {
      const requestPath=new URL(request.url,'http://localhost').pathname;
      const relative=requestPath==='/'?'index.html':decodeURIComponent(requestPath.slice(1));
      const target=path.resolve(output,relative);
      if(!target.startsWith(`${output}${path.sep}`)) {response.writeHead(403);response.end();return;}
      const content=await readFile(target);
      response.writeHead(200,{'content-type':types[path.extname(target)]??'application/octet-stream'});response.end(content);
    } catch {response.writeHead(404);response.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const filename of ['index.html','app.mjs','worker.mjs','styles.css','assets/icon.svg','assets/nebula.png']) {
    const response=await fetch(`${origin}/${filename}`);
    assert.equal(response.status,200,filename);
    assert.equal(response.headers.get('content-type'),types[path.extname(filename)]);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(filename.endsWith('.png'))assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    else if(filename.endsWith('.svg'))assert.match(bytes.toString(),/<svg\b/);
    else if(filename.endsWith('.html'))assert.match(bytes.toString(),/星际漂流/);
    else assert.ok(bytes.length>100);
  }
});

test('collection service worker bypasses independent game URLs at root and nested hosting paths', async t => {
  const workerPath=new URL('../../../sw.js',import.meta.url);
  let source;
  try {source=await readFile(workerPath,'utf8');} catch {
    // A copied standalone source package need not include the collection.
    t.skip('Collection service worker is absent from this standalone source package.');
    return;
  }
  for(const scope of ['https://example.test/','https://example.test/arcade/']) {
    const handlers={};
    const sandbox={URL,Response,fetch:async()=>({ok:false}),self:{registration:{scope},location:{origin:'https://example.test'},addEventListener:(name,handler)=>{handlers[name]=handler;}}};
    vm.runInNewContext(source,sandbox);
    for(const relative of ['standalone','standalone/','standalone/star-drift/','standalone/star-drift/core.mjs','v2/','v3/']) {
      let intercepted=false;
      handlers.fetch({request:{method:'GET',url:new URL(relative,scope).href},respondWith:()=>{intercepted=true;}});
      assert.equal(intercepted,false,relative);
    }
    let intercepted=false,pending;
    handlers.fetch({request:{method:'GET',url:new URL('games/star-drift/',scope).href},respondWith:p=>{intercepted=true;pending=p;}});
    assert.equal(intercepted,true);await pending;
  }
});
