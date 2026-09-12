// Local QA only. Not copied to dist or ZIP. Faults are restricted to this game's namespace.
(function(){
  var failing=false,original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(failing&&key.indexOf('mini-polish:cloud-camp-journey:v1:')===0)throw new Error('QA simulated QuotaExceededError');return original.call(this,key,value);};
  var box=document.createElement('div');box.style.cssText='position:fixed;right:8px;top:6px;z-index:1000;background:#fff;border:2px solid #885c32;border-radius:6px;padding:3px;font:11px sans-serif;';
  var fail=document.createElement('button'),recover=document.createElement('button');fail.textContent='模拟保存失败';recover.textContent='恢复写入';
  fail.addEventListener('click',function(){failing=true;fail.textContent='写入已阻断';});
  recover.addEventListener('click',function(){failing=false;fail.textContent='模拟保存失败';});
  box.appendChild(fail);box.appendChild(recover);document.body.appendChild(box);
})();
