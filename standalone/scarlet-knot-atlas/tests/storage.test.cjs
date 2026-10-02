'use strict';
const test=require('node:test'),a=require('node:assert/strict'),C=require('../core.js'),S=require('../session.js'),D=require('../storage.js'),L=require('../levels.js');
function win(){let s=C.create(L[0],'test-run');L[0].replay.forEach(m=>s=C.move(s,m.id,m.x,m.y));return s;}
function web(){const map={other:'preserved'};return {map,localStorage:{getItem:k=>map[k]||null,setItem:(k,v)=>map[k]=v}};}
test('claim and outbox deduplicate same victory, replay and new-run first reward',()=>{
  let d=S.settle(S.fresh(),L[0],win());d=S.settle(d,L[0],win());const another=win();another.runId='next';d=S.settle(d,L[0],another);
  a.equal(Object.keys(d.collection).length,1);a.equal(Object.keys(d.claims).length,1);a.equal(d.outbox.length,1);
  a.deepEqual(S.restore(L,d),d);
  const forged=C.clone(d);forged.collection[L[0].id].session.points[0].x=.7;a.equal(Object.keys(S.restore(L,forged).collection).length,0);
});
test('Web adapter private keys, damaged JSON and write failure',async()=>{
  const env=web(),r=D.repository(await D.adapter(env));a.equal(r.kind,'web');a(await r.write('ledger',S.fresh()));a.equal(env.map.other,'preserved');a.equal((await r.read('ledger')).value.version,1);
  env.map[D.PREFIX+'ledger']='{bad';a.equal((await r.read('ledger')).ok,false);
  const bad=await D.adapter({localStorage:{setItem(){throw Error('quota');},getItem(){throw Error('blocked');}}});a.equal(await bad.write('x',{}),false);a.equal((await bad.read('x')).ok,false);
});
test('native Storage preferred at 9.46+; version fallback and slow queue retain latest',async()=>{
  const writes=[],map={};const env={xhs:{launchOptions:{miniToolEnv:{buildVersion:9462004}},miniTool:{getStorage(p){p.success({data:map[p.key]||null});},setStorage(p){setTimeout(()=>{map[p.key]=p.data;writes.push(JSON.parse(p.data).n);p.success({});},p.data.includes('1')?15:1);}}},localStorage:{getItem(){throw Error('must use native');},setItem(){throw Error('must use native');}}};
  const r=D.repository(await D.adapter(env));a.equal(r.kind,'native');await Promise.all([r.write('test',{n:1}),r.write('test',{n:2})]);a.deepEqual(writes,[1,2]);a.equal((await r.read('test')).value.n,2);
  env.xhs.launchOptions.miniToolEnv.buildVersion=9459000;a.equal((await D.adapter(env)).kind,'web');
});
test('persist before delivery, same completion/claim IDs on retry and ack write failure',async()=>{
  const d=S.settle(S.fresh(),L[0],win()),calls=[];let allowed=false;
  const repo={write:async()=>allowed};const host=async e=>{calls.push(e);throw Error('unavailable');};
  a.equal((await D.flush(d,repo,host)).ok,false);a.equal(calls.length,0);allowed=true;
  await D.flush(d,repo,host);await D.flush(d,repo,host);a.equal(calls.length,2);a.deepEqual(calls[0],calls[1]);
  let count=0;const ackFail={write:async()=>++count===1};const result=await D.flush(d,ackFail,async()=>true);a.equal(result.ok,false);a.equal(result.doc.outbox.length,1);
  const success=await D.flush(d,repo,async()=>true);a.equal(success.doc.outbox.length,0);a.equal(S.restore(L,success.doc).outbox.length,0);
});
test('late host ack persists latest game position rather than old flush snapshot',async()=>{
  let live=S.settle(S.fresh(),L[0],win()),release;const map={};const repo={write:async(k,v)=>{map[k]=C.clone(v);return true;}};
  const job=D.flush(live,repo,()=>new Promise(r=>release=r),()=>live);
  await new Promise(r=>setTimeout(r,0));live.current=1;live.sessions[L[1].id]=C.create(L[1],'newer-run');release(true);const out=await job;
  a.equal(out.doc.current,1);a.equal(map.ledger.current,1);a(map.ledger.sessions[L[1].id]);a.equal(out.doc.outbox.length,0);
});
test('hanging optional host has a bounded retry timeout, preserving stable claim',async()=>{
  const d=S.settle(S.fresh(),L[0],win()),repo={write:async()=>true};const start=Date.now();const result=await D.flush(d,repo,()=>new Promise(()=>{}),null,15);a(Date.now()-start<500);a.equal(result.doc.outbox.length,1);a.deepEqual(result.doc.claims,d.claims);
});
