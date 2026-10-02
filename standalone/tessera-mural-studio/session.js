const TesseraSession = (() => {
 const key='mini-polish:tessera-mural-studio:v1:save';
 function normalize(raw,levels){const out={version:1,current:null,completed:[],tutorial:false};if(!raw||raw.version!==1)return out;out.tutorial=raw.tutorial===true;
 function valid(r){if(!r||typeof r.runId!=='string'||!/^[a-z0-9-]{3,100}$/.test(r.runId)||!Number.isInteger(r.hints)||r.hints<0||r.hints>4096)return null;const l=levels.find(l=>l.id===r.levelId);if(!l||r.version!==l.version)return null;const b=Tessera.replay(l,r.history);if(!b)return null;return {levelId:l.id,version:l.version,runId:r.runId,history:r.history.map(m=>({index:m.index,tool:m.tool})),hints:r.hints,completionId:'tessera-mural-studio:'+r.runId+':complete',rewardClaimId:'tessera-mural-studio:'+l.id+':first'};}
 out.current=valid(raw.current);const seen={};if(Array.isArray(raw.completed))raw.completed.slice(0,60).forEach(r=>{const c=valid(r);if(!c||seen[c.levelId])return;const l=levels.find(l=>l.id===c.levelId);if(!Tessera.evaluate(l,Tessera.replay(l,c.history)).complete)return;seen[c.levelId]=true;out.completed.push(c);});return out;}
 function settle(data,l,run){const b=Tessera.replay(l,run.history);if(!b||!Tessera.evaluate(l,b).complete)return false;if(!data.completed.some(r=>r.levelId===l.id))data.completed.push(Object.assign(JSON.parse(JSON.stringify(run)),{completionId:'tessera-mural-studio:'+run.runId+':complete',rewardClaimId:'tessera-mural-studio:'+l.id+':first'}));return true;}
 async function storage(){const x=typeof window!=='undefined'&&window.xhs,api=x&&x.miniTool;let launch=x&&x.launchOptions;if(api&&!launch&&typeof api.getLaunchOptions==='function'){try{launch=await api.getLaunchOptions();}catch(e){}}
 const version=Math.floor(Number(launch&&launch.miniToolEnv&&launch.miniToolEnv.buildVersion||0)/1000);const native=version>=9460&&api&&typeof api.setStorage==='function'&&typeof api.getStorage==='function';
 return {async read(){try{const text=native?(await api.getStorage({key})).data:localStorage.getItem(key);return text?JSON.parse(text):null;}catch(e){return null;}},async write(value){try{const data=JSON.stringify(value);if(native)await api.setStorage({key,data});else localStorage.setItem(key,data);return true;}catch(e){return false;}}};}
 return {key,normalize,settle,storage};
})();
if(typeof module!=='undefined')module.exports=TesseraSession;
