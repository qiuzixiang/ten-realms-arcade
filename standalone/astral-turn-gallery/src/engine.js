/* Astral Turn Gallery · Twiddle rules, independent ES2017 implementation. */
var Astral = (function () {
  'use strict';
  var goal = Array.from({length:16}, function (_,i) { return i+1; });
  function valid(b) { return Array.isArray(b) && b.length===16 && new Set(b).size===16 && b.every(function(n){return Number.isInteger(n)&&n>0&&n<=16;}); }
  function moveOK(m) {return Array.isArray(m)&&m.length===2&&Number.isInteger(m[0])&&m[0]>=0&&m[0]<9&&(m[1]===1||m[1]===-1);}
  function rotate(b,m) {
    if(!valid(b)||!moveOK(m)) return b;
    var p=Math.floor(m[0]/3)*4+m[0]%3, ring=[p,p+1,p+5,p+4], out=b.slice();
    ring.forEach(function(cell,i){out[ring[(i+m[1]+4)%4]]=b[cell];}); return out;
  }
  function won(b) {return valid(b)&&b.every(function(n,i){return n===i+1;});}
  function replay(b,moves,stop) {if(!valid(b)||!Array.isArray(moves)||moves.length>4096)return null; for(var i=0;i<moves.length;i++){if(!moveOK(moves[i])||(stop&&won(b)))return null;b=rotate(b,moves[i]);}return b;}
  function inverse(m){return [m[0],-m[1]];}
  function reverse(ms){return ms.slice().reverse().map(inverse);}
  function session(level,id,mode){return {levelId:level.id,runId:id,mode:mode||'campaign',history:[],assisted:false};}
  function board(level,s){return replay(level.board,s.history,true);}
  function apply(level,s,m){var b=board(level,s);if(!b||won(b)||!moveOK(m)||s.history.length>=4096)return false;s.history.push(m.slice());return true;}
  function restore(level,s){if(!s||s.levelId!==level.id||typeof s.runId!=='string'||!/^[a-z0-9-]{3,80}$/.test(s.runId)||!['campaign','daily'].includes(s.mode)||!Array.isArray(s.history))return null;var b=board(level,s);if(!b)return null;return {levelId:level.id,runId:s.runId,mode:s.mode,history:s.history.map(function(m){return m.slice();}),assisted:s.assisted===true};}
  function hint(level,s){var b=board(level,s), ref=level.board;for(var i=0;i<level.solution.length;i++){if(b.join(',')===ref.join(','))return {move:level.solution[i],kind:'reference'};ref=rotate(ref,level.solution[i]);}return s.history.length?{move:inverse(s.history[s.history.length-1]),kind:'undo'}:null;}
  function empty(){return {version:1,proofs:{},claims:[],outbox:[],current:null};}
  function completion(level,s,db){var b=board(level,s);if(!b||!won(b))return null;var id='astral-turn-gallery-'+s.runId, claim='first-'+level.id;
    if(db.outbox.some(function(e){return e.completionId===id;})||db.claims.includes('run-'+s.runId))return null;
    var prior=db.proofs[level.id], rewards=[];
    if(!db.claims.includes(claim)){db.claims.push(claim);rewards.push(claim);}
    db.claims.push('run-'+s.runId);
    if(!prior||(s.assisted===prior.assisted&&s.history.length<prior.history.length)||(prior.assisted&&!s.assisted))db.proofs[level.id]=JSON.parse(JSON.stringify(s));
    var e={schemaVersion:1,gameId:'astral-turn-gallery',levelId:level.id,mode:s.mode,runId:s.runId,completionId:id,rewardClaims:rewards,metrics:{moves:s.history.length,assisted:s.assisted},completedAt:new Date().toISOString(),replayProof:JSON.parse(JSON.stringify(s))};db.outbox.push(e);return e;
  }
  function load(raw,levels){var db=empty();try{var x=JSON.parse(raw);if(!x||x.version!==1)return db;
    levels.forEach(function(l){var s=x.proofs&&restore(l,x.proofs[l.id]);if(s&&won(board(l,s))){db.proofs[l.id]=s;db.claims.push('first-'+l.id);}});
    if(Array.isArray(x.claims))db.claims=db.claims.concat(x.claims.filter(function(c){return typeof c==='string'&&/^run-[a-z0-9-]{3,80}$/.test(c);}));
    if(x.current){var l=levels.find(function(v){return v.id===x.current.levelId;});if(l)db.current=restore(l,x.current);}
    if(Array.isArray(x.outbox))db.outbox=x.outbox.filter(function(e){if(!e)return false;var l=levels.find(function(v){return v.id===e.levelId;}),p=l&&restore(l,e.replayProof);return p&&won(board(l,p))&&e.gameId==='astral-turn-gallery'&&e.completionId==='astral-turn-gallery-'+p.runId&&e.runId===p.runId&&e.mode===p.mode&&e.metrics&&e.metrics.moves===p.history.length&&e.metrics.assisted===p.assisted&&Array.isArray(e.rewardClaims)&&e.rewardClaims.every(function(c){return c==='first-'+l.id;})&&db.claims.includes('run-'+e.runId);});
  }catch(ignore){}return db;}
  return {goal:goal,valid:valid,moveOK:moveOK,rotate:rotate,won:won,replay:replay,inverse:inverse,reverse:reverse,session:session,board:board,apply:apply,restore:restore,hint:hint,empty:empty,completion:completion,load:load};
}());
