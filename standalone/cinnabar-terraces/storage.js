(function(root){
  'use strict';var key='mini-polish:cinnabar-terraces:v1:save',native=null;
  async function init(){var x=root.xhs,mt=x&&x.miniTool,opts=x&&x.launchOptions;
    if(!opts && mt && typeof mt.getLaunchOptions==='function'){try{opts=await mt.getLaunchOptions();}catch(e){opts=null;}}
    var version=Math.floor(Number(opts&&opts.miniToolEnv&&opts.miniToolEnv.buildVersion)/1000)||0;
    if(version>=9460 && mt && typeof mt.getStorage==='function' && typeof mt.setStorage==='function')native=mt;
    return native?'xhs-9.46-storage':'web-storage';
  }
  async function read(){try{var value=native?(await native.getStorage({key:key})).data:root.localStorage.getItem(key);return {ok:true,value:value?JSON.parse(value):null};}catch(e){return {ok:false,value:null};}}
  async function write(data){try{var text=JSON.stringify(data);if(text.length>800000)return false;if(native)await native.setStorage({key:key,data:text});else root.localStorage.setItem(key,text);return true;}catch(e){return false;}}
  root.TerraceStorage={key:key,init:init,read:read,write:write};if(typeof module!=='undefined')module.exports=root.TerraceStorage;
})(typeof window!=='undefined'?window:global);
