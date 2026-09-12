import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LEVELS, REPLAY_LEVELS, CHAPTERS, findLevel, levelsForChapter } from '../src/levels.mjs';
import { createBoard, validateBoard, validateLevel, applyAction, analyze, isSolved, maximumMatching, orthogonal, touching, getHint } from '../src/engine.mjs';
import { solve } from '../src/solver.mjs';
import { puzzleSignature, generateUnique, dailyLevel, seedJourney, hashSeed, dayKey, quotaOnlyAudit } from '../src/generator.mjs';

function solvedBoard(level) { const board=createBoard(level); level.solution.forEach(function(i) { board[i]=1; }); return board; }

test('60 main camps in six real increasing chapters; 120 extra camps have no D4 duplicate', function() {
  assert.equal(LEVELS.length,60); assert.equal(REPLAY_LEVELS.length,120); assert.equal(CHAPTERS.length,6);
  assert.deepEqual(CHAPTERS.map(function(ch) { return ch.size; }),[4,5,5,6,6,7]);
  const signatures = LEVELS.concat(REPLAY_LEVELS).map(puzzleSignature);
  assert.equal(new Set(signatures).size,180);
  CHAPTERS.forEach(function(ch) { assert.equal(levelsForChapter(ch.id).length,10); });
  LEVELS.forEach(function(level,i) {
    assert.equal(level.index,i+1); assert.equal(findLevel(level.id),level);
    if (i && level.chapter === LEVELS[i-1].chapter) assert.ok(level.difficulty.score >= LEVELS[i-1].difficulty.score,level.id+' advances its chapter-local measured route');
  });
  assert.ok(LEVELS.slice(40).some(function(l) { return l.difficulty.globalSteps > 0; }));
  assert.ok(LEVELS[59].difficulty.globalSteps >= 2);
  assert.equal(findLevel('nonexistent'),null);
});

test('later chapters pass independently reproducible depth gates instead of quota-only skins', function() {
  const summary=[];
  CHAPTERS.forEach(function(ch) {
    const levels=levelsForChapter(ch.id);
    let quotaStalls=0, matchingEssential=0, multipleGlobal=0;
    levels.forEach(function(level) {
      const audit=quotaOnlyAudit(level), proof=solve(level,{limit:2});
      assert.equal(audit.solved,level.difficulty.quotaOnlySolved,level.id);
      assert.equal(audit.remainingTents,level.difficulty.quotaOnlyRemainingTents,level.id);
      assert.equal(proof.matchingChecks-1,level.difficulty.matchingRejectedLayouts,level.id);
      let replay=createBoard(level);
      audit.events.forEach(function(event) { const result=applyAction(level,replay,event.index,event.value); assert.equal(result.accepted,true); replay=result.board; });
      assert.deepEqual(replay,audit.board,level.id+' quota witness replays');
      assert.equal(solve(level,{board:audit.board,limit:2}).count,1,level.id+' audit never guesses wrong');
      if(!audit.solved) { quotaStalls+=1; assert.ok(audit.remainingTents>0); }
      if(proof.matchingChecks>1) {
        matchingEssential+=1;
        assert.ok(proof.matchingRejectedWitnesses.length>0,level.id+' has concrete rejected layout');
        proof.matchingRejectedWitnesses.forEach(function(tents) {
          const board=createBoard(level); tents.forEach(function(i) { board[i]=1; });
          const state=analyze(level,board);
          assert.ok(state.rows.every(function(line) { return line.exact; }),level.id);
          assert.ok(state.cols.every(function(line) { return line.exact; }),level.id);
          assert.ok(tents.every(function(a) { return tents.every(function(b) { return !touching(level.size,a,b); }); }),level.id);
          assert.ok(tents.every(function(t) { return orthogonal(level.size,t).some(function(i) { return level.trees.indexOf(i)>=0; }); }),level.id);
          assert.equal(state.matching.perfect,false,level.id+' tree matching alone rejects this geometric alternative');
          assert.equal(state.solved,false);
        });
      }
      if(level.difficulty.globalSteps>=2) multipleGlobal+=1;
    });
    summary.push({quotaStalls:quotaStalls,matchingEssential:matchingEssential,multipleGlobal:multipleGlobal});
  });
  assert.ok(summary[3].quotaStalls>=6,'chapter 4: at least 6/10 resist quota-only play');
  assert.ok(summary[4].matchingEssential>=7,'chapter 5: at least 7/10 require tree matching to reject geometric alternatives');
  assert.ok(summary[5].multipleGlobal>=8,'chapter 6: at least 8/10 need two or more global assumptions');
});

test('every one of 180 camps has exactly one tent layout proven by exhaustive second-solution search', function() {
  LEVELS.concat(REPLAY_LEVELS).forEach(function(level) {
    assert.equal(validateLevel(level),true,level.id);
    // Any accidental answer dependency throws, rather than merely passing a mismatched stored answer.
    const publicClues = {size:level.size,trees:level.trees,rows:level.rows,cols:level.cols};
    Object.defineProperty(publicClues,'solution',{get:function() { throw new Error('Verifier read an answer'); }});
    const proof = solve(publicClues,{limit:2});
    assert.equal(proof.count,1,level.id); assert.equal(proof.exhausted,true,level.id); assert.equal(proof.unique,true,level.id);
    assert.deepEqual(proof.solutions[0],level.solution,level.id);
    assert.equal(isSolved(level,solvedBoard(level)),true,level.id);
    assert.equal(isSolved(level,createBoard(level)),false,level.id);
    const withNotes = solvedBoard(level).map(function(v,i) { return level.trees.indexOf(i)>=0 ? 0 : v || 2; });
    assert.equal(isSolved(level,withNotes),true,'notes do not enter victory '+level.id);
  });
});

test('proof ledger has complete independently reproducible records', async function() {
  const ledger=JSON.parse(await readFile(new URL('../release/level-proof.json',import.meta.url),'utf8'));
  assert.equal(ledger.levels.length,180);
  ledger.levels.forEach(function(entry) {
    const level=findLevel(entry.id), proof=solve(level,{limit:2});
    assert.equal(entry.signature,puzzleSignature(level)); assert.equal(entry.solutionCount,1); assert.equal(entry.searchLimit,2); assert.equal(entry.exhausted,true);
    assert.equal(entry.nodes,proof.nodes); assert.equal(entry.branchPoints,proof.branchPoints);
    assert.deepEqual(entry.quotaOnlyAudit,quotaOnlyAudit(level));
    assert.deepEqual(entry.matchingRejectedWitnesses,proof.matchingRejectedWitnesses);
  });
});

test('placement, mark-empty, erase, and atomic illegal no-ops preserve their inputs', function() {
  const level=LEVELS[0], board=createBoard(level), i=level.solution[0];
  const tent=applyAction(level,board,i,1); assert.equal(tent.accepted,true); assert.equal(tent.board[i],1); assert.equal(board[i],0);
  const mark=applyAction(level,tent.board,i,2); assert.equal(mark.board[i],2);
  const erase=applyAction(level,mark.board,i,0); assert.deepEqual(erase.board,board);
  [[level.trees[0],1],[-1,1],[board.length,1],[0.5,1],[i,3],[i,'1'],[NaN,2],[i,undefined]].forEach(function(action) {
    const invalid=applyAction(level,board,action[0],action[1]); assert.equal(invalid.accepted,false); assert.equal(invalid.board,board);
  });
  assert.equal(applyAction(level,board,i,0).accepted,false);
  // Undo is implemented by the session layer as immutable pre-action snapshots.
  const snapshots=[board,tent.board,mark.board]; assert.deepEqual(snapshots.pop(),mark.board); assert.deepEqual(snapshots.pop(),tent.board); assert.deepEqual(snapshots.pop(),createBoard(level));
});

test('strict board and clue validation reject sparse, coerced, outside and tree-tampered states', function() {
  const level=LEVELS[0], board=createBoard(level);
  const sparse=board.slice(); delete sparse[1];
  const treeTamper=board.slice(); treeTamper[level.trees[0]]=1;
  const badValue=board.slice(); badValue[level.solution[0]]='1';
  [null,{},[],board.slice(1),sparse,treeTamper,badValue].forEach(function(bad) {
    assert.equal(validateBoard(level,bad),false); assert.equal(analyze(level,bad).solved,false); assert.equal(analyze(level,bad).contradiction,true);
  });
  const badLevels=[null,{},Object.assign({},level,{size:8}),Object.assign({},level,{trees:[-1]}),Object.assign({},level,{trees:level.trees.concat(level.trees[0])}),Object.assign({},level,{rows:Array(level.size)})];
  badLevels.forEach(function(bad) { assert.equal(validateLevel(bad),false); assert.equal(solve(bad,{limit:2}).count,0); });
  assert.equal(solve(level,{board:sparse}).count,0); assert.equal(solve(level,{board:treeTamper}).count,0);
  assert.throws(function() { createBoard(null); },TypeError);
});

test('full bipartite matching revises earlier choices instead of using greedy adjacency', function() {
  const level={size:4,trees:[1,3],rows:[2,0,0,0],cols:[1,0,1,0]};
  // Tree 1 tries tent 2 first; tree 3 needs tent 2, so the first tree must be reassigned to tent 0.
  const match=maximumMatching(level,[0,2]);
  assert.equal(match.size,2); assert.equal(match.perfect,true);
  assert.deepEqual(match.pairs.sort(function(a,b) { return a.tree-b.tree; }),[{tree:1,tent:0},{tree:3,tent:2}]);
});

test('Hall counterexample: correct totals and all local neighbors still cannot win', function() {
  const level={size:5,trees:[1,3,11,15],rows:[3,0,1,0,0],cols:[2,0,1,0,1]}, tents=[0,2,4,10];
  const board=createBoard(level); tents.forEach(function(i) { board[i]=1; });
  assert.ok(level.trees.every(function(t) { return orthogonal(5,t).some(function(i) { return tents.indexOf(i)>=0; }); }));
  assert.ok(tents.every(function(t) { return orthogonal(5,t).some(function(i) { return level.trees.indexOf(i)>=0; }); }));
  assert.ok(tents.every(function(a) { return tents.every(function(b) { return !touching(5,a,b); }); }));
  const state=analyze(level,board);
  assert.ok(state.rows.every(function(r) { return r.exact; })); assert.ok(state.cols.every(function(c) { return c.exact; }));
  assert.equal(state.matching.size,3); assert.equal(state.matching.perfect,false); assert.equal(state.solved,false); assert.equal(state.contradiction,true);
  assert.ok(state.errors.some(function(text) { return text.indexOf('一一配对')>=0; }));
  assert.equal(solve(level,{limit:2}).count,0);
});

test('diagonal tent adjacency, orphan tents, row overflow and premature completion fail', function() {
  const level=LEVELS[20], board=createBoard(level);
  for(let i=0;i<board.length;i+=1) if(level.trees.indexOf(i)<0) board[i]=1;
  const state=analyze(level,board); assert.equal(state.solved,false); assert.equal(state.contradiction,true); assert.ok(state.conflictCells.length);
  assert.equal(touching(5,0,6),true); assert.equal(touching(5,4,5),false); assert.equal(touching(5,0,0),false);
  assert.deepEqual(orthogonal(4,0),[1,4]);
  const incomplete=solvedBoard(level); incomplete[level.solution[0]]=0; assert.equal(isSolved(level,incomplete),false);
});

test('independent exhaustive verifier agrees with engine on every tent subset for tutorial camp', function() {
  const level=LEVELS[0], cells=createBoard(level).reduce(function(a,_,i) { if(level.trees.indexOf(i)<0) a.push(i); return a; },[]), solutions=[];
  function choose(k,remaining,picked) {
    if(!remaining) { const board=createBoard(level); picked.forEach(function(i) { board[i]=1; }); if(isSolved(level,board)) solutions.push(picked.slice()); return; }
    for(let p=k;p<=cells.length-remaining;p+=1) { picked.push(cells[p]); choose(p+1,remaining-1,picked); picked.pop(); }
  }
  choose(0,level.trees.length,[]);
  assert.deepEqual(solutions,solve(level,{limit:100}).solutions);
});

test('solver distinguishes actual multiple layouts and a first-solution early stop', function() {
  // The same two quotas permit tents on opposite diagonals, separated by an empty middle row.
  const multiple={size:3,trees:[1,7],rows:[1,0,1],cols:[1,0,1]};
  const proof=solve(multiple,{limit:2}); assert.equal(proof.count,2); assert.equal(proof.unique,false); assert.equal(proof.exhausted,false);
  const first=solve(LEVELS[0],{limit:1}); assert.equal(first.count,1); assert.equal(first.unique,false); assert.equal(first.exhausted,false);
});

test('current-board hints finish every main camp and each proposed action preserves solvability', function() {
  let globalHints=0;
  LEVELS.forEach(function(level) {
    let board=createBoard(level), steps=0;
    while(!isSolved(level,board)) {
      const next=getHint(level,board); assert.ok(next,level.id); assert.notEqual(next.kind,'correction',level.id);
      assert.ok(next.text.length>10); assert.equal(board[next.index],0);
      const applied=applyAction(level,board,next.index,next.value); assert.equal(applied.accepted,true); board=applied.board;
      assert.equal(solve(level,{board:board,limit:2}).count,1,level.id+' hint remains completable');
      if(next.kind==='global') globalHints+=1;
      steps+=1; assert.ok(steps<=level.size*level.size);
    }
    assert.equal(getHint(level,board),null);
  });
  assert.ok(globalHints>0);
});

test('a wrong mark and wrong tent receive a clearly identified correction', function() {
  const level=LEVELS[0], board=createBoard(level); board[level.solution[0]]=2;
  const hint=getHint(level,board); assert.equal(hint.kind,'correction'); assert.equal(hint.index,level.solution[0]); assert.equal(hint.value,0);
  const wrong=createBoard(level), empty=wrong.findIndex(function(_,i) { return level.trees.indexOf(i)<0 && level.solution.indexOf(i)<0; }); wrong[empty]=1;
  const other=getHint(level,wrong); assert.equal(other.kind,'correction'); assert.equal(other.index,empty); assert.equal(other.value,0);
});

test('fixed seed generation is reproducible, validates uniqueness and varies genuinely', function() {
  const config={size:5,tentCount:5,seed:8127};
  const a=generateUnique(config), b=generateUnique(config), c=generateUnique(Object.assign({},config,{seed:8128}));
  assert.equal(puzzleSignature(a.level),puzzleSignature(b.level)); assert.notEqual(puzzleSignature(a.level),puzzleSignature(c.level));
  assert.equal(a.proof.unique,true); assert.equal(b.proof.unique,true); assert.equal(c.proof.unique,true);
  assert.throws(function() { generateUnique({size:8,tentCount:2,seed:1}); },TypeError);
});

test('daily and seed routes disclose a finite verified pool and sample without duplicates', function() {
  const date='2026-09-08'; assert.equal(dayKey(new Date(2026,8,8)),date); assert.equal(dailyLevel(date),dailyLevel(date));
  assert.ok(REPLAY_LEVELS.indexOf(dailyLevel(date))>=0);
  const a=seedJourney('松风旅途',10), b=seedJourney('松风旅途',10), c=seedJourney('星河旅途',10);
  assert.deepEqual(a,b); assert.notDeepEqual(a,c); assert.equal(new Set(a.map(function(l) { return l.id; })).size,10);
  assert.equal(seedJourney('all',999).length,120); assert.equal(new Set(seedJourney('all',999)).size,120);
  assert.equal(hashSeed('same'),hashSeed('same'));
  const dates=[]; for(let d=1;d<=28;d+=1) dates.push(dailyLevel('2026-09-'+String(d).padStart(2,'0')).id);
  assert.ok(new Set(dates).size>=20);
});
