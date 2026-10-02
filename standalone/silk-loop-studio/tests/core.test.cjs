const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),L=require('../levels.js').levels,S=require('../session.js'),V=require('../view.js'),{oracle,canonical}=require('./oracle.cjs');
test('All legal moves agree with coordinate oracle; four cycles and inverses restore',()=>{
 for(const l of L) for(const axis of ['row','column'])for(let index=0;index<4;index++)for(const direction of [-1,1]){const a={axis,index,direction};const b=E.shift(l.initial,a);assert.deepEqual(b,oracle(l.initial,[a]));assert.deepEqual(E.shift(b,E.inverse(a)),l.initial);assert.deepEqual(E.replay(l.initial,[a,a,a,a]),l.initial);assert.ok(E.validBoard(b));assert.notEqual(b,l.initial);}
 assert.deepEqual(E.shift(E.goal,{axis:'row',index:0,direction:1}),[4,1,2,3,5,6,7,8,9,10,11,12,13,14,15,16]);
});
test('Malformed moves are exact no-ops; malformed or partially solved boards never win',()=>{
 for(const a of [null,{},[],{axis:'row',index:4,direction:1},{axis:'row',index:1.1,direction:1},{axis:'column',index:0,direction:0},{axis:'diagonal',index:0,direction:1},{axis:'row',index:'0',direction:1}])assert.equal(E.shift(E.goal,a),E.goal);
 assert.equal(E.solved(E.goal.slice(1)),false);assert.equal(E.solved(Array(16).fill(1)),false);assert.equal(E.solved([2,1].concat(E.goal.slice(2))),false);
});
test('48 campaign levels independently solve, have no D4/torus-equivalent repetitions',()=>{
 assert.equal(L.length,48);assert.equal(new Set(L.map(l=>canonical(l.initial))).size,48);
 for(let c=0;c<6;c++)assert.equal(L.filter(l=>l.chapter===c).length,8);
 for(const l of L){assert.equal(l.checksum,E.checksum(l.initial));assert.equal(E.solved(l.initial),false);assert.deepEqual(oracle(l.initial,l.solution),E.goal);assert.deepEqual(E.replay(l.initial,l.solution),E.goal);assert.equal(l.referenceMoves,l.solution.length);}
});
test('Tutorial chain and shared renderer show exactly sixteen real tiles',()=>{
 assert.deepEqual(oracle(E.tutorial[0],[E.tutorialActions[0]]),E.tutorial[1]);assert.deepEqual(oracle(E.tutorial[1],[E.tutorialActions[1]]),E.tutorial[2]);assert.equal(E.solved(E.tutorial[2]),true);
 E.tutorial.forEach(b=>{const html=V.boardHTML(b,null,true);assert.equal((html.match(/data-value=/g)||[]).length,16);for(let p=0;p<16;p++)assert.match(html,new RegExp('data-value="'+b[p]+'" data-position="'+p+'"'));});
});
test('Hints solve arbitrary legal deviations without replaying stale original steps',()=>{
 let rng=892;const rand=n=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return Math.floor(rng/65536)%n;};
 for(const l of L){let actions=[];for(let n=0;n<30;n++){const a={axis:rand(2)?'row':'column',index:rand(4),direction:rand(2)?1:-1};actions.push(a);const b=E.replay(l.initial,actions),route=E.route(l,actions);assert.deepEqual(oracle(b,route),E.goal);}}
});
test('Undo/redo restore board and effective step count; independent best and first claims dedupe',()=>{
 const d=S.initial(),l=L[0];S.act(d.run,l.solution[0]);assert.ok(E.solved(S.board(d.run)));const r=S.settle(d);assert.ok(r.earned);assert.equal(S.settle(d).earned,false);assert.equal(d.claims.length,1);
 const restored=S.reconcile(JSON.parse(JSON.stringify(d)));assert.equal(restored.claims.length,1);assert.equal(S.settle(restored).earned,false);assert.equal(S.undo(restored.run),true);assert.deepEqual(S.board(restored.run),l.initial);assert.equal(S.redo(restored.run),true);assert.equal(S.settle(restored).earned,false);
 restored.run=S.fresh(l);S.act(restored.run,l.solution[0]);S.settle(restored);assert.equal(restored.claims.length,1);
 const practice=S.initial();practice.run.practice=true;S.act(practice.run,l.solution[0]);assert.equal(S.settle(practice).earned,false);assert.equal(practice.claims.length,0);
});
test('Corrupt current run does not destroy replay-verified receipts; fake claims rejected',()=>{
 const d=S.initial();S.act(d.run,L[0].solution[0]);S.settle(d);d.run.actions=[{axis:'hack',index:0,direction:1}];d.claims.push('foreign');d.receipts['silk-02']={completed:true};const restored=S.reconcile(d);assert.equal(restored.run.actions.length,0);assert.equal(Object.keys(restored.receipts).length,1);assert.deepEqual(restored.claims,['silk-loop-studio:silk-01:first']);
});
test('Persistence failure blocks host delivery, retry keeps one stable claim ID',async()=>{
 const d=S.initial();S.act(d.run,L[0].solution[0]);S.settle(d);let received=[];
 await S.flush(d,async()=>false,async p=>{received.push(p);return true;});assert.equal(received.length,0);
 await S.flush(d,async()=>true,async p=>{received.push(p);throw Error('offline host');});assert.equal(d.outbox.length,1);
 await S.flush(d,async()=>true,async p=>{received.push(p);return true;});assert.equal(d.outbox.length,0);assert.equal(received[0].eventId,received[1].eventId);
});
test('Better independent score updates receipt without repeating first reward',()=>{
 const d=S.initial(),l=L[1];d.run=S.fresh(l);const extra={axis:'row',index:2,direction:1};S.act(d.run,extra);S.act(d.run,E.inverse(extra));l.solution.forEach(a=>S.act(d.run,a));S.settle(d);assert.equal(d.receipts[l.id].actions.length,l.referenceMoves+2);assert.equal(d.claims.length,1);
 d.run=S.fresh(l);l.solution.forEach(a=>S.act(d.run,a));assert.equal(S.settle(d).best,true);assert.equal(d.receipts[l.id].actions.length,l.referenceMoves);assert.equal(d.claims.length,1);
 const receipt=d.receipts[l.id];d.run=S.fresh(l,true);l.solution.forEach(a=>S.act(d.run,a));S.settle(d);assert.equal(d.receipts[l.id],receipt,'practice cannot overwrite independent record');
});
test('Restored pending rewards use verified receipts, sanitize fields and remove duplicate IDs',()=>{
 const d=S.initial();S.act(d.run,L[0].solution[0]);S.settle(d);d.outbox.push(Object.assign({},d.outbox[0],{moves:0,runId:'forged'}));d.outbox[0].moves=0;const restored=S.reconcile(d);assert.equal(restored.outbox.length,1);assert.equal(restored.outbox[0].moves,1);assert.equal(restored.outbox[0].runId,d.run.runId);
});
