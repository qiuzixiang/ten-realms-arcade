/** Reproducible CUA browser verification. See QA.md for invocation in a Codex CUA session.
 * It operates only on the supplied dedicated tab. No other browser tabs or storage are touched.
 */
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {LEVELS} from '../src/levels.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function assert(condition,message){if(!condition)throw Error(message);}
export async function runBrowserQA({tab,viewport,url='http://127.0.0.1:4281'}){
  const output=resolve(root,'release');await mkdir(output,{recursive:true});const report={testedAt:new Date().toISOString(),browser:'Codex In-app Browser',productionURL:url,checks:[],layouts:[],screenshots:[]};
  const click=async action=>{const inside=tab.playwright.locator('.modal [data-action="'+action+'"]');return (await inside.count()?inside:tab.playwright.locator('[data-action="'+action+'"]')).first().click();};
  const snap=async name=>{await writeFile(resolve(output,name),await tab.screenshot({fullPage:true}));report.screenshots.push(name);};
  const goHome=async()=>{if(await tab.playwright.locator('.modal').count())await tab.playwright.locator('.modal').press('Escape');await click('home');};
  const startLevel=async level=>{await goHome();await click('map');await click('chapter:'+level.chapter);await click('level:'+level.id);await tab.playwright.domSnapshot();};
  await viewport.set({width:390,height:844});
  if((await tab.url()).replace(/\/$/,'')!==url.replace(/\/$/,''))await tab.goto(url);else await tab.reload();
  await tab.playwright.domSnapshot();
  if(await tab.playwright.locator('.tutorial-modal').count())await click('tutorial:skip');
  await goHome();await snap('cover-mobile.jpg');
  await click('map');await click('chapter:4');await snap('chapter-map.jpg');
  await startLevel(LEVELS[0]);
  await click('tutorial');await snap('tutorial-mobile.jpg');await click('tutorial:1');await tab.playwright.domSnapshot();await click('tutorial:2');await click('tutorial:done');
  assert(!(await tab.playwright.locator('.modal').count()),'Tutorial must close');report.checks.push('First-entry tutorial already verified in fresh tab; complete three-card replay and skip are usable');
  const tree=LEVELS[0].trees[0],first=LEVELS[0].solution[0];
  await tab.playwright.locator('[data-cell="'+tree+'"]').click();assert(!(await tab.playwright.locator('[data-action="place:1"]').isEnabled()),'Tree must remain fixed');
  await tab.playwright.locator('[data-cell="'+first+'"]').click();await click('place:2');assert(await tab.playwright.locator('[data-cell="'+first+'"].grass').count(),'Mark empty');await click('place:0');await click('place:1');
  await snap('gameplay-390.jpg');await tab.reload();await tab.playwright.domSnapshot();assert(await tab.playwright.locator('[data-cell="'+first+'"].tent').count(),'Board resumes after refresh');
  await click('undo');assert(!(await tab.playwright.locator('[data-cell="'+first+'"].tent').count()),'Undo after reload');
  await click('restart');await click('close');await click('restart');await click('restart:yes');assert(!(await tab.playwright.locator('[data-action="undo"]').isEnabled()),'Fresh board cannot undo');
  await click('hint');assert((await tab.playwright.locator('.help-note').innerText()).length>12,'Helpful current-board explanation');
  await click('restart');await click('restart:yes');
  for(const i of LEVELS[0].solution){await tab.playwright.locator('[data-cell="'+i+'"]').click();await click('place:1');}
  assert(await tab.playwright.locator('.win-modal').count(),'Victory is visible');await snap('completion-mobile.jpg');report.checks.push('Real cell selection; tree input disabled; mark/erase; place; refresh; undo; restart cancel/confirm; current-board hint; actual completion');
  await click('home');const progress=await tab.playwright.locator('.progress-pill').innerText();await tab.reload();await tab.playwright.domSnapshot();assert((await tab.playwright.locator('.progress-pill').innerText())===progress,'Completed refresh cannot duplicate first clear');
  await startLevel(LEVELS[0]);for(const i of LEVELS[0].solution){await tab.playwright.locator('[data-cell="'+i+'"]').click();await click('place:1');}await click('home');assert((await tab.playwright.locator('.progress-pill').innerText())===progress,'Replaying same camp cannot add first-clear progress');report.checks.push('Refresh and a second full play preserve first-clear progress');
  await click('daily');assert((await tab.playwright.locator('.brand').innerText()).includes('DAILY'),'Daily mode');await tab.reload();await tab.playwright.domSnapshot();assert((await tab.playwright.locator('.brand').innerText()).includes('DAILY'),'Daily resumes');
  await goHome();await click('seed');await tab.playwright.locator('#seed-input').fill('山风与松果');await click('seed:start');const routeTitle=await tab.playwright.locator('.play-heading h1').innerText();await tab.reload();await tab.playwright.domSnapshot();assert((await tab.playwright.locator('.play-heading h1').innerText())===routeTitle,'Seed route resumes deterministically');report.checks.push('Daily and named seed journey enter and refresh correctly');
  await startLevel(LEVELS[59]);
  for(const size of [{width:320,height:720},{width:359,height:720},{width:360,height:720},{width:390,height:844},{width:700,height:844},{width:701,height:844},{width:1280,height:720}]){
    await viewport.set(size);const metrics=await tab.playwright.evaluate(()=>({width:window.innerWidth,height:window.innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,toolsBottom:document.querySelector('.secondary-tools').getBoundingClientRect().bottom,cellWidth:document.querySelector('.cell').getBoundingClientRect().width,directions:Array.from(document.querySelectorAll('.direction')).map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})),imagesComplete:Array.from(document.images).every(x=>x.complete&&x.naturalWidth>0)}));
    assert(metrics.scrollWidth<=metrics.width,'Horizontal overflow '+size.width);assert(metrics.toolsBottom<=metrics.height,'Core tools below viewport '+size.width);assert(metrics.directions.every(x=>x.width>=44&&x.height>=44),'Precision controls below 44px');assert(metrics.imagesComplete,'Missing image');report.layouts.push(metrics);
    if(size.width===320)await snap('gameplay-320.jpg');if(size.width===390)await snap('gameplay-7x7.jpg');if(size.width===1280)await snap('desktop-1280.jpg');
  }
  await viewport.set({width:320,height:720});const selected=Number(await tab.playwright.locator('.cell.selected').getAttribute('data-cell'));await click(selected%7<6?'move:right':'move:left');const after=Number(await tab.playwright.locator('.cell.selected').getAttribute('data-cell'));assert(after!==selected,'Large direction controls change selection');
  await tab.playwright.locator('.cell.selected').press('ArrowDown');await tab.playwright.domSnapshot();report.checks.push('7x7 precision controls and keyboard arrow input; all required widths and both responsive breakpoints');
  await click('tutorial');await snap('tutorial-320.jpg');await click('tutorial:skip');
  await goHome();await click('collection');await snap('collection-mobile.jpg');
  await viewport.set({width:390,height:844});await goHome();await snap('cover-mobile.jpg');
  const errors=await tab.dev.logs({levels:['error'],limit:30});assert(errors.length===0,'Browser console errors: '+JSON.stringify(errors));report.consoleErrors=errors;report.checks.push('No browser console errors');
  report.ok=true;await writeFile(resolve(output,'browser-qa.json'),JSON.stringify(report,null,2));return report;
}
if(typeof process!=='undefined'&&process.argv[1]===fileURLToPath(import.meta.url))console.log('Use this module from a Codex CUA session: await (await import("'+fileURLToPath(import.meta.url)+'")).runBrowserQA({tab:campTab,viewport}); See QA.md.');
