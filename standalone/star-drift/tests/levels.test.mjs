import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, CHAPTERS, getLevel, createDailyLevel, createExpeditionLevel } from '../levels.mjs';
import { solve, replay, geometryFingerprint } from '../core.mjs';
import { analyzeSolution, generateProvenLevel } from '../generate.mjs';

// Independent oracle: separate slide transition and BFS; never reads solution.
function shortestOracle(level) {
  let start;
  const energy=[];
  for(let y=0;y<level.height;y++) for(let x=0;x<level.width;x++) {
    if(level.grid[y][x]==='@') start=[x,y];
    if(level.grid[y][x]==='e') energy.push(`${x},${y}`);
  }
  const dirs=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  const initial=[...start,energy.join(';'),0];
  const queue=[initial], seen=new Set([initial.slice(0,3).join('|')]);
  for(let head=0;head<queue.length;head++) {
    const [x,y,encoded,depth]=queue[head];
    for(const [dx,dy] of dirs) {
      let px=x,py=y,dead=false,moved=false;
      const remaining=new Set(encoded.split(';').filter(Boolean));
      for(;;) {
        const nx=px+dx,ny=py+dy,t=level.grid[ny]?.[nx]??'#';
        if(t==='#') break;
        px=nx;py=ny;moved=true;remaining.delete(`${px},${py}`);
        if(t==='x'){dead=true;break;}
        if(t==='o'||t==='@')break;
      }
      if(!moved||dead)continue;
      if(!remaining.size)return depth+1;
      const encodedNext=[...remaining].join(';'),key=[px,py,encodedNext].join('|');
      if(seen.has(key))continue;
      seen.add(key);queue.push([px,py,encodedNext,depth+1]);
    }
  }
  return null;
}

test('campaign has six complete chapters and no rotated or mirrored duplicates', () => {
  assert.equal(LEVELS.length,48);
  assert.equal(CHAPTERS.length,6);
  assert.equal(new Set(LEVELS.map(l=>l.id)).size,48);
  assert.equal(new Set(LEVELS.map(geometryFingerprint)).size,48);
  for(let i=0;i<48;i++) {
    const l=LEVELS[i];
    assert.equal(l.number,i+1);assert.equal(l.campaignIndex,i);assert.equal(l.chapter,Math.floor(i/8));
    assert.equal(getLevel(l.id),l);assert.equal(l.mode,'campaign');
    assert.ok(l.briefing.length>5&&l.lesson.length>5);
  }
  for(let chapter=0;chapter<6;chapter++)assert.equal(LEVELS.filter(l=>l.chapter===chapter).length,8);
  assert.equal(getLevel('missing'),null);
});

for(const level of LEVELS) test(`${level.id} ${level.name}: replay and independent shortest proof`, () => {
  assert.equal(replay(level,level.solution).status,'won');
  assert.equal(level.solution.length,level.par);
  assert.equal(solve({...level,solution:null}).path.length,level.par);
  assert.equal(shortestOracle(level),level.par);
});

test('chapter progression changes actual geometry, energy count, and shortest depth', () => {
  const means=CHAPTERS.map(c=>LEVELS.filter(l=>l.chapter===c.id).reduce((a,l)=>a+l.par,0)/8);
  for(let i=1;i<means.length;i++)assert.ok(means[i]>means[i-1],`chapter ${i}`);
  for(const l of LEVELS.filter(l=>l.chapter===1))assert.equal(l.mines.length,0);
  for(const l of LEVELS.filter(l=>l.chapter===2))assert.equal(l.mines.length,0);
  for(const l of LEVELS.filter(l=>l.chapter>=2))assert.ok(l.metrics.anchorStops>=1);
  for(const l of LEVELS.filter(l=>l.chapter>=3))assert.ok(l.metrics.dangerOptions>=2);
  assert.ok(LEVELS[47].width>LEVELS[0].width);
  assert.ok(LEVELS[47].energy.length>LEVELS[0].energy.length);
  assert.ok(analyzeSolution(LEVELS[4],LEVELS[4].solution).anchorStops>0);
  assert.ok(analyzeSolution(LEVELS[5],LEVELS[5].solution).homeStops>0);
});

test('daily levels are calendar-correct, deterministic, varied, and proven', () => {
  const fingerprints=new Set();
  for(let day=1;day<=14;day++) {
    const date=`2026-09-${String(day).padStart(2,'0')}`;
    const a=createDailyLevel(date),b=createDailyLevel(date);
    assert.deepEqual(a,b);
    assert.equal(a.mode,'daily');assert.equal(a.date,date);
    assert.equal(replay(a,a.solution).status,'won');
    assert.equal(shortestOracle(a),a.par);
    fingerprints.add(geometryFingerprint(a));
  }
  assert.ok(fingerprints.size>=12);
  assert.throws(()=>createDailyLevel('2026-02-30'),/real calendar/);
  assert.throws(()=>createDailyLevel('09-05-2026'),/YYYY/);
});

test('seeded expeditions prove every sampled board at all three difficulties', () => {
  const fingerprints=new Set();
  for(let difficulty=0;difficulty<3;difficulty++) for(let i=0;i<12;i++) {
    const seed=`regression-${i}`;
    const a=createExpeditionLevel(seed,difficulty),b=createExpeditionLevel(seed,difficulty);
    assert.deepEqual(a,b);
    assert.equal(a.mode,'expedition');assert.equal(a.seed,seed);assert.equal(a.difficulty,difficulty);
    assert.equal(replay(a,a.solution).status,'won');
    assert.equal(solve(a).path.length,a.par);
    assert.equal(a.proof.shortest,true);
    fingerprints.add(geometryFingerprint(a));
  }
  assert.ok(fingerprints.size>=34,`only ${fingerprints.size} distinct layouts`);
  assert.throws(()=>createExpeditionLevel('x',3),/Difficulty/);
  assert.throws(()=>createExpeditionLevel('',0),/seed/);
});

test('bounded candidate search reports failure instead of inventing a solution', () => {
  assert.equal(generateProvenLevel('zero-budget',5,{attempts:0}),null);
  assert.equal(generateProvenLevel('infeasible-range',1,{attempts:5,minPar:999}),null);
});
