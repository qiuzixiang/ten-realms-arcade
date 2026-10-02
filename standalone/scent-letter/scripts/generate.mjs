import fs from "node:fs";
import { PARAMS, secretFor, feedback, candidates } from "../src/engine.mjs";
import { generateSecret, hashSeed } from "../src/source-logic.mjs";
const chapterNames = ["初识香材", "同香重叠", "位置试探", "新香入笺", "复杂来信", "秘方档案"];
const titles = ["雾窗", "纸上花园", "雨后的信", "晚风来客", "铜印", "旧书页", "温室微光", "月下独白", "远方回音", "封存的春天"];
function perms(a) {
  return a.length < 2 ? [a] : a.flatMap((v, i) => perms(a.filter((_, j) => j !== i)).map((p) => [v, ...p]));
}
function canonical(l) {
  const secret = secretFor(l);
  let best = null;
  for (const clues of perms(l.clues.map((r) => r.pegs))) {
    const rows = [secret, ...clues];
    for (const p of perms(Array.from({ length: l.params.slots }, (_, i) => i))) {
      const map = /* @__PURE__ */ new Map();
      const key = rows.map((row) => p.map((i) => {
        if (!map.has(row[i])) map.set(row[i], map.size + 1);
        return map.get(row[i]);
      }).join("")).join("/");
      if (best === null || key < best) best = key;
    }
  }
  return best + "|" + l.params.colours;
}
function worstDepth(pool, p) {
  if (!pool.length) return 0;
  const guess = pool[0], groups = /* @__PURE__ */ new Map();
  for (const s of pool) {
    const f = feedback(s, guess, p);
    if (f.exact === p.slots) continue;
    const key = f.exact + "," + f.misplaced;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return 1 + Math.max(0, ...Array.from(groups.values()).map((g) => worstDepth(g, p)));
}
const levels = [], seen = /* @__PURE__ */ new Set();
for (let chapter = 0; chapter < 6; chapter++) {
  for (let j = 0; j < 10; j++) {
    let accepted;
    for (let attempt = 0; attempt < 3e3 && !accepted; attempt++) {
      const params = PARAMS(chapter < 3 ? 4 : 6, chapter === 5 ? 5 : 4, 10);
      const seed = `scent-letter:v1:${chapter}:${j}:${attempt}`;
      const level = { id: `chapter-${String(chapter + 1).padStart(2, "0")}-level-${String(j + 1).padStart(2, "0")}`, chapter: chapter + 1, index: j + 1, title: titles[j], chapterName: chapterNames[chapter], seed, params, mode: "chapter", clues: [] };
      const secret = secretFor(level);
      if (chapter === 1 && new Set(secret).size === params.slots) continue;
      const clueCount = j < 2 ? 3 : j < 8 ? 2 : 1;
      for (let k = 0; k < clueCount; k++) {
        let pegs = generateSecret(seed + ":clue:" + k, params);
        if (chapter === 2 && k > 0) pegs = level.clues[0].pegs.slice(k).concat(level.clues[0].pegs.slice(0, k));
        const f = feedback(secret, pegs, params);
        if (f.exact === params.slots) break;
        level.clues.push({ pegs, feedback: f });
      }
      if (level.clues.length !== clueCount) continue;
      let pool = candidates(level), initial = pool.length;
      const min = j < 2 ? 2 : j < 8 ? 5 : 12;
      if (initial < min || initial > (chapter === 5 ? 1400 : chapter < 3 ? 130 : 650)) continue;
      let rounds = 0;
      const trace = [];
      while (pool.length && rounds < 10) {
        const guess = pool[0], f = feedback(secret, guess, params);
        trace.push({ pegs: guess, feedback: f, candidates: pool.length });
        rounds++;
        if (f.exact === params.slots) break;
        pool = pool.filter((s) => {
          const t = feedback(s, guess, params);
          return t.exact === f.exact && t.misplaced === f.misplaced;
        });
      }
      if (trace[trace.length - 1].feedback.exact !== params.slots || rounds > 8) continue;
      const signature = canonical(level);
      if (seen.has(signature)) continue;
      seen.add(signature);
      level.referenceRounds = rounds;
      level.initialCandidates = initial;
      level.worstCaseRounds = worstDepth(candidates(level), params);
      level.params.guesses = Math.max(level.worstCaseRounds + 2, chapter < 3 ? 6 : 8);
      level.proof = { strategy: "first-consistent-v1", trace, signature };
      accepted = level;
    }
    if (!accepted) throw Error("Unable to generate " + chapter + ":" + j);
    levels.push(accepted);
  }
}
fs.writeFileSync(new URL("../src/levels.json", import.meta.url), JSON.stringify(levels, null, 2));
console.log("Generated", levels.length, "distinct constraint instances; candidate ranges", chapterNames.map((n, i) => [n, ...["initialCandidates", "referenceRounds"].map((k) => {
  const a = levels.filter((l) => l.chapter === i + 1).map((l) => l[k]);
  return [Math.min(...a), Math.max(...a)];
})]));
