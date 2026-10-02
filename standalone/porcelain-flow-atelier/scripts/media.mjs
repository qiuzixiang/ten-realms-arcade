import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {LEVELS} from '../levels.mjs';
import {emptyBoard,logicTrace,inspect} from '../logic.mjs';
import {boardSvg} from '../render.mjs';
const require=createRequire(import.meta.url),{chromium}=require(resolve(process.env.PORCELAIN_NODE_MODULES||'node_modules','playwright')),sharp=require(resolve(process.env.PORCELAIN_NODE_MODULES||'node_modules','sharp'));
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),release=resolve(root,'release');mkdirSync(resolve(release,'screenshots'),{recursive:true});
const t=LEVELS[0],d=logicTrace(t,false).steps[0],one=emptyBoard(t);one[d.i]=d.value;
const frames=[emptyBoard(t),one,t.solution];frames.forEach((board,i)=>writeFileSync(resolve(release,'tutorial-'+(i+1)+'.svg'),boardSvg(t,board,{label:['真实空盘','同题合法一步','同题引擎验证完成'][i]})));
writeFileSync(resolve(release,'tutorial-proof.json'),JSON.stringify({levelId:t.id,action:{i:d.i,value:d.value},frames:frames.map(b=>({board:b,filled:inspect(t,b).filled,complete:inspect(t,b).complete}))},null,2));
const server=createServer((req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!path.startsWith(root+'/'))throw Error();const data=readFileSync(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[extname(path)]||'application/octet-stream'});res.end(data);}catch(e){res.writeHead(404);res.end();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});await page.goto(url+'/dist/xhs/index.html');await page.locator('#app[aria-busy="false"]').waitFor();
 for(let i=0;i<3;i++){await page.screenshot({path:resolve(release,'screenshots/tutorial-'+(i+1)+'-390.png')});await page.locator('[data-action="tutorial-next"]').click();}
 await page.locator('[data-action="continue"]').click();
 for(const step of logicTrace(t,false).steps){await page.locator('[data-tool]').filter({hasText:step.value==='\\'?'╲':'╱'}).click();await page.locator('[data-cell="'+step.i+'"]').click(); }
 await page.locator('.win-banner').waitFor();await page.screenshot({path:resolve(release,'screenshots/complete-390.png'),fullPage:true});await page.locator('[data-action="result"]').click();await page.screenshot({path:resolve(release,'screenshots/result-390.png')});await page.locator('[data-action="collection"]').click();await page.screenshot({path:resolve(release,'screenshots/collection-390.png'),fullPage:true});
 await page.locator('[data-action="home"]').click();await page.locator('[data-action="continue"]').click();await page.locator('.board-frame').screenshot({path:resolve(release,'screenshots/real-solved-board.png')});
 await page.locator('[data-action="restart"]').click();await page.locator('[data-action="restart-confirm"]').click();for(const step of logicTrace(t,false).steps.slice(0,7)){await page.locator('[data-tool]').filter({hasText:step.value==='\\'?'╲':'╱'}).click();await page.locator('[data-cell="'+step.i+'"]').click();}
 await page.screenshot({path:resolve(release,'screenshots/gameplay-390.png'),fullPage:true});await page.locator('.board-frame').screenshot({path:resolve(release,'screenshots/real-play-board.png')});
 await sharp(resolve(root,'assets/icon.svg')).resize(512,512).png().toFile(resolve(release,'icon-512.png'));
 await page.close();const cover=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});await cover.goto(url+'/release/cover.html');await cover.locator('img').first().waitFor();await cover.evaluate(()=>Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(done=>{img.onload=done;img.onerror=done;}))));await cover.screenshot({path:resolve(release,'cover-1080x1440.png')});
 writeFileSync(resolve(release,'media-capture.json'),JSON.stringify({capturedAt:new Date().toISOString(),browserVersion:browser.version(),bundleSha256:createHash('sha256').update(readFileSync(resolve(root,'dist/xhs/app.js'))).digest('hex'),source:'Actual click sequence in production bundle; browser screenshots, not physical devices; cover original vector scene + actual board screenshot'},null,2));
 console.log('PASS media: same puzzle 3 engine frames, 3 mobile tutorial captures, true UI completion/collection/gameplay captures, original vector cover + actual screenshot inset.');
}finally{await browser.close();await new Promise(done=>server.close(done));}
