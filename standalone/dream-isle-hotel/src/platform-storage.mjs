// Official online Storage API contract checked 2026-09-15:
// https://miniapp-sandbox.xiaohongshu.com/minitool/doc (§3.6–3.7).
export function clientVersion(build){const n=Number(build);return Number.isFinite(n)&&n>0?Math.floor(n/1000):0;}
export function boundedCall(fn,timeout){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Storage API timeout')),timeout);Promise.resolve().then(fn).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});}
export async function platformStorage(xhs,legacy,keys,timeout=4000){
 const api=xhs&&xhs.miniTool;let build=xhs&&xhs.launchOptions&&xhs.launchOptions.miniToolEnv&&xhs.launchOptions.miniToolEnv.buildVersion;
 if(!Number(build)&&api&&typeof api.getLaunchOptions==='function'){try{const opts=await boundedCall(()=>api.getLaunchOptions(),timeout);build=opts&&opts.miniToolEnv&&opts.miniToolEnv.buildVersion;}catch(e){}}
 if(clientVersion(build)<9460||!api||typeof api.getStorage!=='function'||typeof api.setStorage!=='function')return legacy;
 const cache={},migrations=[];let blocked=false,queue=Promise.resolve(true);
 for(const key of keys){try{const r=await boundedCall(()=>api.getStorage({key}),timeout);const value=r&&r.data;if(value===undefined||value===null){let old=null;try{old=legacy.getItem(key);}catch(e){}cache[key]=old;if(old!==null)migrations.push([key,old]);}else cache[key]=typeof value==='string'?value:JSON.stringify(value);}catch(e){const text=String(e&&(e.errMsg||e.message)||'');if(/not found|not exist|不存在|无此|未找到/i.test(text)){let old=null;try{old=legacy.getItem(key);}catch(err){}cache[key]=old;if(old!==null)migrations.push([key,old]);}else{blocked=true;cache[key]=null;}}}
 const storage={native:true,getItem(key){return cache[key]===undefined?null:cache[key];},setItem(key,value){if(!keys.includes(key))throw Error('Unexpected storage key');cache[key]=String(value);if(blocked)throw Error('Native storage unavailable');const snapshot=String(value);queue=queue.then(async ok=>{if(!ok||blocked)return false;try{await boundedCall(()=>api.setStorage({key,data:snapshot}),timeout);return true;}catch(e){blocked=true;return false;}});},drain(){return queue.then(ok=>ok&&!blocked);}};
 if(!blocked)migrations.forEach(([key,value])=>storage.setItem(key,value));
 await storage.drain();return storage;
}
