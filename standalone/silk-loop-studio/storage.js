(function(root){
'use strict';
const key='mini-polish:silk-loop-studio:v1:save';
async function create(env){
 const x=env.xhs,tool=x&&x.miniTool;let build=x&&x.launchOptions&&x.launchOptions.miniToolEnv&&x.launchOptions.miniToolEnv.buildVersion;
 if(!build&&tool&&typeof tool.getLaunchOptions==='function'){try{const o=await tool.getLaunchOptions();build=o&&o.miniToolEnv&&o.miniToolEnv.buildVersion;}catch(e){build=0;}}
 const native=Math.floor((Number(build)||0)/1000)>=9460&&tool&&typeof tool.getStorage==='function'&&typeof tool.setStorage==='function';
 let queue=Promise.resolve(),readFailed=false;
 async function read(){try{const raw=native?(await tool.getStorage({key})).data:env.localStorage.getItem(key);readFailed=false;try{return raw?JSON.parse(raw):null;}catch(e){return null;}}catch(e){readFailed=true;return null;}}
 function write(value){const snapshot=JSON.stringify(value);queue=queue.then(async()=>{try{if(readFailed||snapshot.length>900000)return false;if(native)await tool.setStorage({key,data:snapshot});else env.localStorage.setItem(key,snapshot);return true;}catch(e){return false;}});return queue;}
 return {key,read,write,backend:native?'xhs-storage':'web-storage'};
}
root.SilkStorage={create,key};if(typeof module!=='undefined')module.exports={create,key};
})(typeof window!=='undefined'?window:globalThis);
