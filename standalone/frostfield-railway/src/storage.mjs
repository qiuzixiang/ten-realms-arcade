export const PREFIX='mini-polish:frostfield-railway:v1:';
export async function createStorage(root) {
 const xhs=root.xhs,mini=xhs&&xhs.miniTool;let launch=xhs&&xhs.launchOptions;
 if(!(launch&&launch.miniToolEnv&&launch.miniToolEnv.buildVersion)&&mini&&typeof mini.getLaunchOptions==='function'){try{launch=await mini.getLaunchOptions();}catch(e){launch=null;}}
 const version=Math.floor(Number(launch&&launch.miniToolEnv&&launch.miniToolEnv.buildVersion)/1000)||0;
 const native=version>=9460&&mini&&typeof mini.getStorage==='function'&&typeof mini.setStorage==='function';
 const key=PREFIX+'profile';let readBlocked=false;
 function legacy(){try{return JSON.parse(root.localStorage.getItem(key)||'null');}catch(e){return null;}}
 return {
  mode:native?'native':'browser',
  async read(){if(!native)return legacy();try{const result=await mini.getStorage({key});if(result&&result.data!==undefined&&result.data!==null)return result.data;const old=legacy();if(old)await mini.setStorage({key,data:old});return old;}catch(e){
   // A missing native key may be imported only after the keys API confirms absence.
   if(typeof mini.getStorageInfo==='function'){try{const info=await mini.getStorageInfo();if(Array.isArray(info.keys)&&!info.keys.includes(key)){const old=legacy();if(old)await mini.setStorage({key,data:old});return old;}}catch(ignore){}}
   readBlocked=true;throw Error('原存档暂时无法读取，已保护旧进度。请重新打开小工具；本次操作暂存内存。');
  }},
  async write(data){if(readBlocked)return false;try{if(native)await mini.setStorage({key,data});else root.localStorage.setItem(key,JSON.stringify(data));return true;}catch(e){return false;}}
 };
}
