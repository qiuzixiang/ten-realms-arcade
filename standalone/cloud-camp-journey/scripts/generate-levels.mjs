import { writeFile } from 'node:fs/promises';
import { generateUnique, measureDifficulty, puzzleSignature, quotaOnlyAudit } from '../src/generator.mjs';
import { solve } from '../src/solver.mjs';

const chapters = [
  {id:1,title:'晨露草甸',subtitle:'看见行列中的小数字',focus:'行列配额',size:4,collection:'晨露帐篷',description:'从零配额出发，让每行每列的帐篷数刚刚好。'},
  {id:2,title:'杉林风声',subtitle:'为每一棵树找一顶帐篷',focus:'上下左右',size:5,collection:'松风天幕',description:'辨认正交邻接。斜对着树并不能成为它的营位。'},
  {id:3,title:'溪谷野餐',subtitle:'给夜晚留下呼吸的空隙',focus:'邻接排除',size:5,collection:'花坡野餐垫',description:'帐篷的八个方向都要留出空间，用排除缩小候选。'},
  {id:4,title:'日落山坡',subtitle:'数字与树影交织成路',focus:'交叉推理',size:6,collection:'溪光营灯',description:'只靠配额渐渐走不动了。观察树的候选，交叉验证你的判断。'},
  {id:5,title:'星夜营地',subtitle:'每顶帐篷都有自己的树',focus:'一一匹配',size:6,collection:'暮云帐篷',description:'配额与间隔都满足也未必完成：需要用整组树帐配对排除伪解。'},
  {id:6,title:'云海远行',subtitle:'把整片草甸放进心里',focus:'全局推理',size:7,collection:'星河观景台',description:'每片营地都需要多次综合推演，用假设与矛盾打开最后的云海。'}
];
const suffixes = ['晨雾','小径','野花','微风','树影','远山','溪声','晚霞','月升','归宿'];
const titlePrefixes = ['露珠','杉风','溪谷','暮坡','星夜','云海'];
const seen = new Set(), pools = {};
let totalAttempts = 0;
for (const size of [4,5,6,7]) {
  const target = size === 4 ? 120 : size === 5 ? 850 : 6000;
  const pool = [];
  for (let k = 0; pool.length < target; k += 1) {
    const count = size === 4 ? 3+(k%3 === 0 ? 1 : 0) : size === 5 ? 4+(k%3) : size === 6 ? 6+(k%3) : 8+(k%3);
    const seed = 60908000+size*100000+k;
    const generated = generateUnique({size:size,tentCount:count,seed:seed,attempts:10000});
    totalAttempts += generated.level.generationAttempt;
    const level = generated.level;
    if (seen.has(level.signature)) continue;
    seen.add(level.signature);
    level.difficulty = measureDifficulty(level,generated.proof);
    pool.push(level);
    if (pool.length % 1000 === 0) console.log('Measured '+size+'×'+size+': '+pool.length+'/'+target);
    if (k > 100000) throw new Error('Insufficient distinct puzzle space');
  }
  pools[size] = pool.sort(function(a,b) { return a.difficulty.score-b.difficulty.score || a.seed-b.seed; });
}
const selected = new Set(), main = [], replay = [];
function spread(pool,count,low,high) {
  if (pool.length < count) throw new Error('Insufficient depth-qualified candidates: '+pool.length+' < '+count);
  const picks = [];
  for (let k=0; k<count; k+=1) picks.push(pool[Math.floor((low+(high-low)*k/Math.max(1,count-1))*(pool.length-1))]);
  if (new Set(picks.map(function(level) { return level.signature; })).size !== count) throw new Error('Spread selection duplicates');
  return picks;
}
for (const chapter of chapters) {
  const pool = pools[chapter.size].filter(function(level) { return !selected.has(level.signature); });
  let picks;
  if (chapter.id <= 3) {
    const band = chapter.id === 1 ? [0.02,0.70] : chapter.id === 2 ? [0.08,0.48] : [0.58,0.97];
    picks = spread(pool,10,band[0],band[1]);
  } else if (chapter.id === 4) {
    // Two warm-ups, then eight camps where even an unusually generous quota-only
    // strategy stalls. Save Hall/matching-heavy boards for the next chapter.
    const warmups = pool.filter(function(l) { return l.difficulty.quotaOnlySolved; });
    const beyondQuota = pool.filter(function(l) { return !l.difficulty.quotaOnlySolved && l.difficulty.matchingRejectedLayouts === 0 && l.difficulty.globalSteps <= 1; });
    picks = spread(warmups,2,0.70,0.88).concat(spread(beyondQuota,8,0.08,0.75));
  } else if (chapter.id === 5) {
    // Full search found a geometrically valid row/column layout rejected solely
    // by complete matching. Every selected board therefore requires tree logic.
    const matchingEssential = pool.filter(function(l) { return !l.difficulty.quotaOnlySolved && l.difficulty.matchingRejectedLayouts > 0; });
    picks = spread(matchingEssential,10,0.08,0.92);
  } else {
    const global = pool.filter(function(l) { return !l.difficulty.quotaOnlySolved && l.difficulty.globalSteps >= 2 && l.difficulty.branchPoints >= 4; });
    picks = spread(global,10,0.08,0.985);
  }
  picks.sort(function(a,b) { return a.difficulty.score-b.difficulty.score || a.seed-b.seed; });
  picks.forEach(function(level,k) {
    selected.add(level.signature);
    const index = main.length+1;
    main.push(Object.assign({},level,{id:'camp-'+String(index).padStart(2,'0'),index:index,chapter:chapter.id,title:titlePrefixes[chapter.id-1]+suffixes[k],focus:chapter.focus}));
  });
}
for (const size of [4,5,6,7]) {
  const available = pools[size].filter(function(level) { return !selected.has(level.signature); });
  for (let k=0; k<30; k+=1) {
    const level = available[Math.floor(k*(available.length-1)/29)];
    selected.add(level.signature);
    const index = replay.length+1;
    replay.push(Object.assign({},level,{id:'replay-'+String(index).padStart(3,'0'),index:index,chapter:size === 4 ? 1 : size === 5 ? 3 : size === 6 ? 5 : 6,title:'旅途营地 '+String(index).padStart(3,'0'),focus:'自由复习'}));
  }
}
const all = main.concat(replay);
if (new Set(all.map(puzzleSignature)).size !== all.length) throw new Error('Duplicate up to symmetry');
const proofs = all.map(function(level) {
  const result = solve({size:level.size,trees:level.trees,rows:level.rows,cols:level.cols},{limit:2});
  if (!result.unique || JSON.stringify(result.solutions[0]) !== JSON.stringify(level.solution)) throw new Error('Proof mismatch '+level.id);
  return {id:level.id,size:level.size,treeCount:level.trees.length,seed:level.seed,signature:level.signature,solutionCount:result.count,searchLimit:2,exhausted:result.exhausted,nodes:result.nodes,branchPoints:result.branchPoints,geometricLayoutsChecked:result.matchingChecks,matchingRejectedLayouts:result.matchingChecks-1,matchingRejectedWitnesses:result.matchingRejectedWitnesses,difficulty:level.difficulty,quotaOnlyAudit:quotaOnlyAudit(level)};
});
const depthAudit = chapters.map(function(ch) {
  const levels = main.filter(function(l) { return l.chapter === ch.id; });
  return {chapter:ch.id,title:ch.title,count:levels.length,quotaOnlyStalls:levels.filter(function(l) { return !l.difficulty.quotaOnlySolved; }).length,matchingEssential:levels.filter(function(l) { return l.difficulty.matchingRejectedLayouts > 0; }).length,globalRequired:levels.filter(function(l) { return l.difficulty.globalSteps > 0; }).length,multipleGlobalSteps:levels.filter(function(l) { return l.difficulty.globalSteps >= 2; }).length};
});
if (depthAudit[3].quotaOnlyStalls < 6 || depthAudit[4].matchingEssential < 7 || depthAudit[5].multipleGlobalSteps < 8) throw new Error('Depth gate failed');
const source = '// Deterministic generated catalog. Regenerate with node scripts/generate-levels.mjs.\n'+
  '// All 180 layouts independently exhaustively verified; canonical D4 signatures are distinct.\n'+
  'function freezeLevel(level) { level.trees = Object.freeze(level.trees); level.rows = Object.freeze(level.rows); level.cols = Object.freeze(level.cols); level.solution = Object.freeze(level.solution); level.difficulty = Object.freeze(level.difficulty); return Object.freeze(level); }\n'+
  'export const CHAPTERS = Object.freeze('+JSON.stringify(chapters,null,2)+'.map(Object.freeze));\n'+
  'export const LEVELS = Object.freeze('+JSON.stringify(main)+'.map(freezeLevel));\n'+
  'export const REPLAY_LEVELS = Object.freeze('+JSON.stringify(replay)+'.map(freezeLevel));\n'+
  'export function findLevel(id) { return LEVELS.concat(REPLAY_LEVELS).find(function(level) { return level.id === id; }) || null; }\n'+
  'export function levelsForChapter(id) { return LEVELS.filter(function(level) { return level.chapter === Number(id); }); }\n';
await writeFile(new URL('../src/levels.mjs',import.meta.url),source);
await writeFile(new URL('../release/level-proof.json',import.meta.url),JSON.stringify({schemaVersion:2,generatedAt:'2026-09-08',mainline:60,replay:120,chapters:6,seedBase:60908000,candidatePoolCount:Object.values(pools).reduce(function(a,p) { return a+p.length; },0),generationAttempts:totalAttempts,verifier:'src/solver.mjs: row-mask exhaustive enumeration; independent tree-assignment DFS; never reads stored solution',layoutUniqueness:'Exactly one tent layout. Tree assignment itself is not claimed unique.',symmetryDeduplication:'D4: 4 rotations × 2 reflections, including all clue permutations',difficulty:'(size−4)×1000 + globalSteps×180 + matchingRejectedLayouts×90 + branchPoints×12 + nodes×2 + candidateCells×3 + tentCount×6 − zeroLines×5; chapter-local ordering only, not a human or optimal rating',quotaOnlyMethod:'Independent quotaOnlyAudit grants tree adjacency and eight-neighbor tent exclusions for free, then only fills all remaining slots when quota equals capacity and marks full rows/columns. Exact stop board and every action stored per level.',matchingEssentialMethod:'Full verifier enumerates every non-touching layout satisfying row/column totals with each tent next to some tree. Geometric layouts rejected by independent complete tree assignment >0 prove that per-tree/global matching logic is essential to disambiguation.',depthAudit:depthAudit,levels:proofs},null,2)+'\n');
console.log(JSON.stringify({mainline:main.length,replay:replay.length,depthAudit:depthAudit,chapters:chapters.map(function(ch) { const levels=main.filter(function(l) { return l.chapter===ch.id; }); return {chapter:ch.id,size:ch.size,scores:levels.map(function(l) { return l.difficulty.score; }),globalSteps:levels.map(function(l) { return l.difficulty.globalSteps; }),matchingRejectedLayouts:levels.map(function(l) { return l.difficulty.matchingRejectedLayouts; })}; })},null,2));
