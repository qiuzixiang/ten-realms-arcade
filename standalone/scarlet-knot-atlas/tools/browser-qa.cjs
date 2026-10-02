'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const L=require('../levels.js'),C=require('../core.js'),root=path.resolve(__dirname,'../dist/xhs'),release=path.resolve(__dirname,'../release');
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; font-src 'self'; media-src 'self'";
const server=http.createServer((req,res)=>{const uri=decodeURIComponent(req.url.split('?')[0]),f=path.resolve(root,'.'+(uri==='/'?'/index.html':uri));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}const types={'.js':'application/javascript','.svg':'image/svg+xml','.css':'text/css','.webp':'image/webp','.html':'text/html','.json':'application/json'};res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.setHeader('Content-Security-Policy',csp);res.end(fs.readFileSync(f));});
const report={date:new Date().toISOString(),CSP:csp,viewports:[],interactions:[],errors:[],externalRequests:[],screenshots:[]};let browser;
async function ledger(p){return p.evaluate(()=>JSON.parse(localStorage.getItem('mini-polish:scarlet-knot-atlas:v1:ledger')));}
async function snap(p,name){await p.screenshot({path:path.join(release,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');}
async function pause(p){await p.waitForTimeout(30);}
async function drag(p,id,x,y){const node=p.locator('.node-hit[data-node="'+id+'"]'),b=await node.boundingBox(),r=await p.locator('#board').boundingBox();await p.mouse.move(b.x+22,b.y+22);await p.mouse.down();await p.mouse.move(r.x+18+x*(r.width-36),r.y+20+y*(r.height-40),{steps:6});await p.mouse.up();await pause(p);}
async function geometry(p,label){const g=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,board:document.getElementById('board')?document.getElementById('board').getBoundingClientRect().toJSON():null,targets:Array.from(document.querySelectorAll('button:not([disabled])')).filter(e=>e.offsetWidth&&e.offsetHeight).map(e=>({text:e.getAttribute('aria-label')||e.textContent,w:e.offsetWidth,h:e.offsetHeight}))}));assert(g.scroll<=g.client,label+' horizontal overflow');for(const t of g.targets)assert(t.h>=44&&t.w>=44,label+' too small '+t.text);report.viewports.push({label,...g});}
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=browser.version();
for(const width of [320,359,360,390,799,800,1280]){
 const ctx=await browser.newContext({viewport:{width,height:width===390?844:720},reducedMotion:'reduce'}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('request',req=>{if(!req.url().startsWith(origin))report.externalRequests.push(req.url());});
 await p.goto(origin);await p.locator('[data-action="continue"]').waitFor();await geometry(p,'home-'+width);if([320,390,1280].includes(width))await snap(p,'home-'+width);
 await p.locator('[data-action="continue"]').click();await p.locator('.tutorial-img').waitFor();await geometry(p,'tutorial-'+width);if(width===390)await snap(p,'tutorial-initial-390');
 if(width===390){await p.locator('[data-action="tutorial-next"]').click();await snap(p,'tutorial-one-390');await p.locator('[data-action="tutorial-next"]').click();await snap(p,'tutorial-complete-390');await p.locator('[data-action="tutorial-finish"]').click();}else await p.locator('[data-action="tutorial-skip"]').click();
 await pause(p);await geometry(p,'game-'+width);if([320,390,1280].includes(width))await snap(p,'game-'+width);
 if(width===390){
  await p.evaluate(()=>localStorage.setItem('other-game-preserved','yes'));
  await drag(p,0,.2,.55);let d=await ledger(p);assert.equal(d.sessions[L[0].id].history.length,1);assert.equal(C.pairs(d.sessions[L[0].id].points,L[0].edges).length,1);
  await p.reload();await p.locator('[data-action="continue"]').click();await pause(p);assert(await p.locator('#modal').isHidden());assert.equal((await ledger(p)).sessions[L[0].id].history.length,1);
  await drag(p,3,.6,.1);d=await ledger(p);assert(C.solved(d.sessions[L[0].id].points,L[0].edges));assert.equal(Object.keys(d.claims).length,1);await snap(p,'complete-390');
  await p.locator('[data-action="undo"]').click();await pause(p);assert(!(await p.locator('#win').isVisible()));assert.equal(Object.keys((await ledger(p)).claims).length,1);await drag(p,3,.6,.1);assert.equal(Object.keys((await ledger(p)).claims).length,1);
  await p.locator('[data-action="restart"]').click();await p.locator('[data-action="restart-confirm"]').click();await pause(p);await p.reload();await p.locator('[data-action="continue"]').click();await pause(p);assert.equal((await ledger(p)).sessions[L[0].id].history.length,0);
  const before=(await ledger(p)).sessions[L[0].id];const b=await p.locator('.node-hit[data-node="0"]').boundingBox();await p.mouse.move(b.x+22,b.y+22);await p.mouse.down();await p.mouse.move(b.x+50,b.y+60);await p.locator('#board').dispatchEvent('pointercancel');await p.mouse.up();await pause(p);assert.deepEqual((await ledger(p)).sessions[L[0].id],before);
  await p.locator('[data-action="pick"]').first().click();await p.locator('[data-action="select"][data-id="0"]').click();await p.locator('#board').press('ArrowRight');await pause(p);assert.equal((await ledger(p)).sessions[L[0].id].history.length,1);
  await p.locator('[data-action="undo"]').click();await pause(p);await drag(p,0,.8,.8);const overlap=await p.locator('.node-hit[data-node="1"]').boundingBox();await p.mouse.click(overlap.x+22,overlap.y+22);assert(await p.getByRole('heading',{name:'选择一枚签印'}).isVisible());assert.equal(await p.locator('.pick-row').count(),2);await p.locator('[data-action="select"][data-id="1"]').click();await p.locator('#board').press('ArrowUp');await pause(p);
  assert.equal(await p.evaluate(()=>localStorage.getItem('other-game-preserved')),'yes');
  await p.locator('[data-action="tutorial"]').click();await p.locator('[data-action="tutorial-next"]').click();await p.locator('#close-modal').focus();await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('data-action')),'tutorial-next');await p.keyboard.press('Escape');assert(await p.locator('#modal').isHidden());
  report.interactions.push('legal drag -> preview/commit -> refresh -> victory -> undo victory -> duplicate claim prevention -> restart/refresh -> pointercancel -> picker/keyboard -> overlapping hit chooser -> tutorial focus trap/Esc -> other storage preserved');
 }
 await p.locator('[data-action="chapters"]').click();await geometry(p,'chapters-'+width);if(width===390)await snap(p,'chapters-390');await p.locator('[data-action="level"][data-index="47"]').click();await pause(p);await geometry(p,'dense-'+width);if([320,390,1280].includes(width))await snap(p,'dense-'+width);
 if(width===320){await p.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','44px');document.documentElement.style.setProperty('--safe-area-inset-bottom','34px');});await geometry(p,'dense-safe-320');await snap(p,'dense-safe-320');}
 await ctx.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);fs.writeFileSync(path.join(release,'browser-qa.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS '+report.viewports.length+' viewport states, real mouse and keyboard paths, no errors/external requests.');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(release,'browser-qa.json'),JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
