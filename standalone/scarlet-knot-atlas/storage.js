(function(root){
  'use strict';
  var PREFIX='mini-polish:scarlet-knot-atlas:v1:';
  function call(api,name,args){return new Promise(function(resolve,reject){var done=false,t=setTimeout(function(){if(!done){done=true;reject(new Error('Storage timeout'));}},2200);function ok(v){if(!done){done=true;clearTimeout(t);resolve(v);}}function fail(e){if(!done){done=true;clearTimeout(t);reject(e);}}try{var params=Object.assign({},args,{success:ok,fail:fail}),p=api[name](params);if(p&&typeof p.then==='function')p.then(ok,fail);}catch(e){fail(e);}});}
  async function adapter(env){
    var x=env.xhs,api=x&&x.miniTool,launch=x&&x.launchOptions,version=Number(launch&&launch.miniToolEnv&&launch.miniToolEnv.buildVersion)||0;
    if(!version&&api&&typeof api.getLaunchOptions==='function'){try{launch=await call(api,'getLaunchOptions',{});version=Number(launch&&launch.miniToolEnv&&launch.miniToolEnv.buildVersion)||0;}catch(e){version=0;}}
    var native=Math.floor(version/1000)>=9460&&api&&typeof api.getStorage==='function'&&typeof api.setStorage==='function';
    return {kind:native?'native':'web',read:async function(key){try{var text;if(native){var r=await call(api,'getStorage',{key:PREFIX+key});text=r&&r.data;}else{text=env.localStorage.getItem(PREFIX+key);}return {ok:true,value:text?JSON.parse(text):null};}catch(e){return {ok:false,value:null};}},write:async function(key,value){try{var text=JSON.stringify(value);if(native)await call(api,'setStorage',{key:PREFIX+key,data:text});else env.localStorage.setItem(PREFIX+key,text);return true;}catch(e){return false;}}};
  }
  // A serialized snapshot is taken at enqueue time; a slow old write can
  // never overwrite a newer one. A failed write does not poison the queue.
  function repository(store){var chain=Promise.resolve();return {read:store.read,kind:store.kind,write:function(key,value){var snapshot=JSON.parse(JSON.stringify(value));var result=chain.then(function(){return store.write(key,snapshot);});chain=result.then(function(){},function(){});return result;}};}
  async function flush(doc,repo,host,latest,timeoutMs){
    var C=root.ScarletCore,S=root.ScarletSession;if(typeof module!=='undefined'&&module.exports){C=require('./core.js');S=require('./session.js');}
    var next=C.clone(latest?latest():doc);
    if(typeof host!=='function')return {doc:next,ok:true};
    // Re-persist pending claims before every delivery, including retry after
    // an earlier storage failure. No event is sent without a durable outbox.
    if(!await repo.write('ledger',next))return {doc:next,ok:false};
    var ids=next.outbox.slice();
    for(var i=0;i<ids.length;i++){
      var claim=next.claims[ids[i]];if(!claim||claim.delivered)continue;
      var timer;try{var ack=await new Promise(function(resolve,reject){timer=setTimeout(function(){reject(new Error('Host timeout'));},timeoutMs||1800);Promise.resolve().then(function(){return host(C.clone(claim.event));}).then(resolve,reject);});clearTimeout(timer);if(ack!==true)continue;var candidate=S.acknowledge(C.clone(latest?latest():next),ids[i]);if(!await repo.write('ledger',candidate))return {doc:next,ok:false};next=candidate;}catch(e){clearTimeout(timer);/* durable same-ID retry on next save/open */}
    }
    return {doc:next,ok:true};
  }
  var out={PREFIX:PREFIX,adapter:adapter,repository:repository,flush:flush};root.ScarletStorage=out;if(typeof module!=='undefined'&&module.exports)module.exports=out;
}(typeof window!=='undefined'?window:this));
