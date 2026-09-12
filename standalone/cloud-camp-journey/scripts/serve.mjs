import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist/xhs'),port=Number(process.env.PORT||4281);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');
if(process.env.QA_HARNESS==='1'&&url.pathname==='/qa-storage.js'){res.writeHead(200,{'Content-Type':types['.js']});res.end(await readFile(resolve(root,'../../scripts/qa-storage.js')));return;}
if(process.env.QA_HARNESS==='1'&&url.pathname==='/qa-storage.html'){let html=await readFile(resolve(root,'index.html'),'utf8');html=html.replace('<script src="./app.js">','<script src="./qa-storage.js"></script><script src="./app.js">');res.writeHead(200,{'Content-Type':types['.html']});res.end(html);return;}
const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}await stat(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log('云野露营 http://127.0.0.1:'+port));
