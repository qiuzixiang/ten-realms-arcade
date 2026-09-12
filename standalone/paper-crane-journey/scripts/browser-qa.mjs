import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const packages=process.env.QA_NODE_MODULES || '/Users/qiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(packages,'playwright'));
const sharp=require(path.join(packages,'sharp'));
for(const name of ['icon','cover'])await sharp(path.join(base,'release',name+'.svg')).png().toFile(path.join(base,'release',name+'.png'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.QA_URL||'http://127.0.0.1:4317';
const click=a=>page.locator('[data-action="'+a+'"]').first().click();
const shot=name=>page.screenshot({path:path.join(base,'release',name+'.png'),fullPage:true});
try {
await page.goto(url);await page.locator('.tutorial-image').waitFor();await shot('tutorial-390');
await click('close-modal');
const solution=await page.evaluate(()=>window.CraneLevels.levels[0].solution);
const move=async m=>{await page.locator('[data-cell="'+m.from+'"]').click();await page.locator('[data-cell="'+m.to+'"]').click();};
await move(solution[0]);assert.equal(await page.locator('.stat b').first().textContent(),'3');
await click('undo');assert.equal(await page.locator('.stat b').first().textContent(),'4');
await click('tutorial');await click('tutorial-next');await click('tutorial-next');await click('tutorial-next');
await move(solution[0]);await page.reload();await click('continue');assert.equal(await page.locator('.stat b').first().textContent(),'3');
for(const m of solution.slice(1))await move(m);
await page.locator('.win').waitFor();await shot('completion-390');
await click('close-modal');await click('undo');await move(solution[2]);await click('close-modal');
await click('return-map');assert.match(await page.locator('.chapter-banner').innerText(),/1 \/ 10/);
await click('home');await shot('home-390');
await click('daily');await click('hint');await page.waitForFunction(()=>document.querySelector('.game-message').textContent.includes('试试'));await shot('daily-390');
await click('return-map');await click('seed');await page.locator('#seed-input').fill('雨后莲风');await page.locator('#seed-chapter').selectOption('3');await click('start-seed');
assert.match(await page.locator('.game-intro').innerText(),/旅笺/);await click('hint');await page.waitForFunction(()=>document.querySelector('.game-message').textContent.includes('试试'));await shot('seeded-390');
await click('return-map');await page.locator('[data-action="chapter"][data-id="6"]').click();await page.locator('[data-id="crane-060"]').click();
const layouts=[];
for(const [width,height] of [[320,720],[358,720],[359,720],[360,720],[390,844],[699,740],[700,740],[701,740],[1280,720],[390,739],[390,741]]) {
await page.setViewportSize({width,height});await page.screenshot();
const result=await page.evaluate(()=>{const r=document.querySelector('.tools').getBoundingClientRect();const cells=Array.from(document.querySelectorAll('[data-cell]')).map(e=>e.getBoundingClientRect());return {width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,toolsBottom:r.bottom,minCell:Math.min(...cells.map(r=>Math.min(r.width,r.height)))};});
assert(result.scrollWidth<=result.width);assert(result.minCell>=44);assert(result.toolsBottom<=height);layouts.push({width,height,...result});
if(width===320)await shot('gameplay-320');if(width===390&&height===844)await shot('gameplay-390');if(width===1280)await shot('gameplay-1280');
}
await page.setViewportSize({width:390,height:844});await click('hint');await page.waitForFunction(()=>document.querySelector('.game-message').textContent.includes('试试'));await shot('gameplay-hint-390');
await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.cell svg').first().evaluate(e=>getComputedStyle(e).animationName),'none');
assert.deepEqual(errors,[]);
fs.writeFileSync(path.join(base,'release/browser-qa.json'),JSON.stringify({passed:true,date:new Date().toISOString(),browser:await browser.version(),layouts,errors,flows:['first tutorial','skip','reopen all tutorial cards','legal move','undo','refresh continue','win','undo win and re-win','reward dedup','daily hint','seeded hint','last-level layouts','reduced motion'],limitations:['Browser emulation only; no physical device or XHS container','Chrome61 not tested']},null,2));
console.log('Browser QA passed; PNG assets and production screenshots saved.');
} finally {await browser.close();}
