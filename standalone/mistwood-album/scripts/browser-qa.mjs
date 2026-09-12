import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url), root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let pw;
try{pw=require('playwright');}catch{pw=require(process.env.PLAYWRIGHT_MODULE||'/Users/qiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const L=require('../src/levels.js');
const url=process.env.QA_URL||'http://127.0.0.1:4283';
const browser=await pw.chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
const checks=[],errors=[],network=[];
function ok(value,label){assert.ok(value,label);checks.push(label);}
const dir=path.join(root,'release');
async function shot(page,file,fullPage=false){await page.waitForTimeout(280);await page.screenshot({path:path.join(dir,file),fullPage});}
async function state(page){return page.evaluate(()=>JSON.parse(localStorage.getItem(window.MistStore.KEY)));}
async function click(page,action){await page.locator('[data-action="'+action+'"]').first().click();}
async function fit(page,label){const data=await page.evaluate(()=>{const a=document.querySelector('.actions'),b=document.querySelector('.board');return{width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,actions:a?a.getBoundingClientRect().bottom:0,board:b?b.getBoundingClientRect().bottom:0};});ok(data.scroll<=data.width,label+' no horizontal overflow');if(data.actions)ok(data.actions<=data.height,label+' board and all main controls fit one screen');return data;}
async function solveByTap(page,level,partialScreenshot){
  for(let value of [1,2]){
    await page.locator('[data-action="tool"][data-value="'+value+'"]').click();
    for(let i=0;i<level.width*level.height;i++){
      const want=level.rows[Math.floor(i/level.width)][i%level.width]==='#'?1:2;
      const current=Number(await page.locator('[data-cell="'+i+'"]').getAttribute('data-state'));
      if(want===value&&current!==value)await page.locator('[data-cell="'+i+'"]').tap();
    }
    if(value===1&&partialScreenshot)await shot(page,partialScreenshot);
  }
  await page.getByRole('dialog').waitFor();
}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(url))network.push(r.url());});
 await page.route(url+'/**',async route=>{const response=await route.fetch();await route.fulfill({response,headers:Object.assign({},response.headers(),{'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'"})});});
 await page.goto(url);ok(await page.getByRole('dialog').isVisible(),'first entry automatically opens tutorial');
 ok(await page.evaluate(()=>document.body.classList.contains('modal-open')),'tutorial locks background scroll');
 await shot(page,'tutorial-390.png');
 await click(page,'skip-tutorial');ok(await page.locator('.board').isVisible(),'skip enters playable first 5x5');
 await fit(page,'390x844 first photo');
 await click(page,'tutorial');
 for(let i=0;i<3;i++){
   await page.waitForFunction(()=>{const el=document.querySelector('.tutorial-img');return el&&el.complete&&el.naturalWidth>0;});const image=page.locator('.tutorial-img');ok(await image.evaluate(el=>el.complete&&el.naturalWidth>0),'tutorial image '+i+' is loaded');
   await click(page,'next-tutorial');
 }
 ok(await page.getByRole('dialog').count()===0,'full tutorial closes on final card');
 await page.locator('[data-cell="0"]').tap();ok((await state(page)).current.grid[0]===1,'touch fills the intended cell');
 await click(page,'undo');ok((await state(page)).current.grid[0]===0,'undo restores unknown');
 await click(page,'hint');await click(page,'hint-detail');await shot(page,'hint-390.png');await click(page,'hint-apply');
 let saved=await state(page);ok(saved.current.hints===1&&saved.current.grid.some(v=>v!==0),'expanded hint applies one justified cell');
 await page.reload();ok(await page.getByRole('dialog').count()===0,'tutorial read flag survives reload');
 await click(page,'continue');ok(JSON.stringify((await state(page)).current.grid)===JSON.stringify(saved.current.grid),'refresh and continue restore exact grid');
 await solveByTap(page,L.levels[0],'gameplay-390.png');
 saved=await state(page);ok(saved.records.length===1,'real UI completion persists one record');ok(saved.claims.length===1,'hinted completion awards only photo claim');
 const completionId=saved.records[0].completionId,runId=saved.current.runId;
 await shot(page,'reveal-390.png');
 await page.reload();await click(page,'continue');ok((await state(page)).records.length===1,'reload completed game does not duplicate record');ok((await state(page)).records[0].completionId===completionId,'completion ID stable on reload');
 await click(page,'close-modal');await click(page,'undo');await page.locator('[data-action="tool"][data-value="2"]').click();
 const current=(await state(page)).current;const lastUnknown=current.grid.findIndex(v=>v===0);await page.locator('[data-cell="'+lastUnknown+'"]').tap();
 ok((await state(page)).records.length===1,'undo and recomplete same run is idempotent');
 await click(page,'close-modal');await click(page,'restart');await click(page,'confirm-restart');ok((await state(page)).current.runId!==runId,'restart creates new stable run');
 ok((await state(page)).current.grid.every(v=>v===0),'restart clears board');
 await solveByTap(page,L.levels[0]);
 saved=await state(page);ok(saved.records.length===2&&saved.claims.length===2,'independent replay earns new badge once; photo reward not repeated');
 await click(page,'gallery');await shot(page,'gallery-390.png');ok(await page.locator('.gallery-grid .level-card').count()===1,'gallery reveals one distinct photograph despite two runs');
 await page.locator('.bottom-nav [data-action="home"]').click();await shot(page,'home-390.png');
 await click(page,'daily');saved=await state(page);ok(saved.current.mode==='daily'&&L.daily(saved.current.day).id===saved.current.levelId,'daily selection matches verified date schedule');
 await fit(page,'daily 390x844');
 await click(page,'back');await page.locator('[data-action="chapter"][data-index="5"]').click();
 await page.locator('[data-action="level"][data-id="'+L.levels[59].id+'"]').click();
 await fit(page,'chapter six 7x7 at 390');
 await page.locator('[data-action="tool"][data-value="1"]').click();await page.locator('#row-select').selectOption({value:'6'});await page.locator('#col-select').selectOption({value:'6'});await click(page,'apply');ok((await state(page)).current.grid[48]===1,'7x7 precision row-column controls write exact final square');
 await click(page,'undo');await shot(page,'gameplay-7x7-390.png');
 await page.setViewportSize({width:320,height:720});await fit(page,'320x720 7x7');await shot(page,'gameplay-320.png');
 const touch=await page.locator('.precision button').boundingBox();ok(touch.width>=44&&touch.height>=44,'dense board precision button meets 44px baseline');
 await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','44px');document.documentElement.style.setProperty('--safe-area-inset-bottom','34px');});await fit(page,'320x720 safe-area 44/34');ok(await page.locator('.play-top').evaluate(el=>el.getBoundingClientRect().top)>=44,'top controls clear injected safe area');await page.evaluate(()=>{document.documentElement.style.removeProperty('--safe-area-inset-top');document.documentElement.style.removeProperty('--safe-area-inset-bottom');});
 await click(page,'tutorial');await shot(page,'tutorial-320.png');ok(await page.locator('.modal').evaluate(el=>el.scrollHeight>=el.clientHeight),'narrow tutorial has internal scroll container');
 await page.keyboard.press('Escape');ok(await page.getByRole('dialog').count()===0,'Escape closes tutorial');
 // Keyboard action path on a physical-sized desktop context.
 await page.setViewportSize({width:1280,height:720});await fit(page,'1280x720 7x7');await shot(page,'gameplay-desktop.png');
 await page.locator('[data-cell="0"]').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');ok((await state(page)).current.grid[1]===1,'keyboard arrows and Space target a selected square');
 await click(page,'back');await page.locator('.bottom-nav [data-action="home"]').click();await shot(page,'home-desktop.png');
 for(const width of [359,360,361,699,700,701]){await page.setViewportSize({width,height:844});await fit(page,'breakpoint '+width);}
 // A local corrupted save must never damage another game's namespace.
 await page.evaluate(()=>{localStorage.setItem('other-game:sentinel','keep');localStorage.setItem(window.MistStore.KEY,'{broken');});await page.addInitScript(()=>localStorage.setItem('mini-polish:mistwood-album:v1:state','{broken'));await page.reload();ok((await page.locator('.stat strong').first().textContent()).includes('00'),'corrupt save falls back to fresh progress');ok(await page.evaluate(()=>localStorage.getItem('other-game:sentinel'))==='keep','corrupt recovery leaves other game storage intact');
 ok(errors.length===0,'no browser JavaScript errors');ok(network.length===0,'only packaged local resources requested');
 const S=require('../src/store.js');let fixture=S.emptyState();for(const level of L.levels){let run=S.newSession(level,'story');level.rows.join('').split('').forEach((v,i)=>{run=S.setCell(run,level,i,v==='#'?1:2);});fixture.current=run;fixture=S.settle(fixture,run,level).state;}
 const galleryContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await galleryContext.addInitScript(({key,raw})=>{localStorage.setItem(key,raw);localStorage.setItem('mini-polish:mistwood-album:v1:tutorial:v1','1');},{key:S.KEY,raw:JSON.stringify(fixture)});const galleryPage=await galleryContext.newPage();await galleryPage.goto(url);await click(galleryPage,'gallery');ok(await galleryPage.locator('.gallery-grid .level-card').count()===12,'full collection renders only twelve photos per page');await click(galleryPage,'gallery-next');ok(await galleryPage.locator('.gallery-grid .level-card').first().getAttribute('data-id')===L.levels[12].id,'gallery next page starts at correct photograph');for(let i=0;i<3;i++)await click(galleryPage,'gallery-next');ok(await galleryPage.locator('[data-action="gallery-next"]').isDisabled(),'gallery final page cannot overflow');await shot(galleryPage,'gallery-full-390.png');await galleryContext.close();
 await context.close();
 fs.writeFileSync(path.join(dir,'browser-qa.json'),JSON.stringify({passed:true,browser:await browser.version(),url,checks,errors,network,deviceNote:'Desktop Chrome touch/viewport simulation, not a physical mobile device.'},null,2));
 console.log(`Browser QA: ${checks.length} checks passed; screenshots in release/`);
}finally{await browser.close();}
