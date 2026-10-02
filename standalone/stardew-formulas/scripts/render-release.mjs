import fs from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'));}
const root=new URL('../',import.meta.url);const b=await chromium.launch({channel:'chrome',headless:true});
for(const [input,output,width,height] of [['release/cover.svg','release/cover.png',1080,1440],['icon.svg','release/icon-512.png',512,512]]){
 const p=await b.newPage({viewport:{width,height},deviceScaleFactor:1});await p.setContent('<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>'+fs.readFileSync(new URL(input,root),'utf8'));await p.screenshot({path:fileURLToPath(new URL(output,root))});await p.close();
}
await b.close();console.log('Theme cover and icon rendered. Gameplay images remain separate.');
