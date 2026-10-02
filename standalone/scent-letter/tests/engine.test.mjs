import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PARAMS, feedback, secretFor, newRun, submit, edit, undo, restore, candidates, suggestion, dailyLevel } from "../src/engine.mjs";
import { enumerateSecrets } from "../src/source-logic.mjs";
import { tutorialLevel, tutorialStates } from "../src/tutorial.mjs";
import { blank, settle, save, load, deliver, KEY } from "../src/storage.mjs";
const levels = JSON.parse(fs.readFileSync(new URL("../src/levels.json", import.meta.url)));
const find = (id) => levels.find((l) => l.id === id);
function oracle(s, g) {
  let exact = 0, a = [], b = [];
  s.forEach((v, i) => {
    if (v === g[i]) exact++;
    else {
      a.push(v);
      b.push(g[i]);
    }
  });
  let misplaced = 0;
  for (const v of b) {
    const index = a.indexOf(v);
    if (index >= 0) {
      a.splice(index, 1);
      misplaced++;
    }
  }
  return { exact, misplaced };
}
test("exhaustive independent feedback oracle on 4^4 pairs (65,536)", () => {
  const p = PARAMS(), all = enumerateSecrets(p);
  for (const s of all) for (const g of all) assert.deepEqual(feedback(s, g, p), oracle(s, g));
});
test("all 60 dossiers and strategy traces independently verified", () => {
  assert.equal(levels.length, 60);
  assert.equal(new Set(levels.map((l) => l.proof.signature)).size, 60);
  for (const l of levels) {
    const secret = secretFor(l);
    for (const c of l.clues) assert.deepEqual(oracle(secret, c.pegs), c.feedback);
    let run = newRun(l, "test");
    for (const step of l.proof.trace) {
      assert.deepEqual(step.feedback, oracle(secret, step.pegs));
      assert.equal(candidates(l, run.history).length, step.candidates);
      run = submit(l, { ...run, draft: step.pegs });
    }
    assert.equal(run.status, "won");
    assert.equal(run.history.length, l.referenceRounds);
    assert.ok(run.history.length <= l.params.guesses);
    assert.ok(l.initialCandidates > 1);
  }
});
test("invalid operations are atomic; draft undo; final round victory and failure", () => {
  const l = levels[0], r = newRun(l, "a");
  assert.equal(submit(l, r), r);
  assert.equal(edit(l, r, -1, 2), r);
  const e = edit(l, r, 0, 2);
  assert.deepEqual(undo(e).draft, r.draft);
  const one = { ...l, params: { ...l.params, guesses: 1 } };
  assert.equal(submit(one, { ...r, draft: secretFor(l) }).status, "won");
  let wrong = secretFor(l).slice();
  wrong[0] = wrong[0] % l.params.colours + 1;
  assert.equal(submit(one, { ...r, draft: wrong }).status, "lost");
});
test("restore replays history rather than trusting status, feedback or metrics", () => {
  const l = levels[0], r = newRun(l, "a");
  assert.equal(restore(l, { ...r, status: "won" }).status, "playing");
  assert.equal(restore(l, { ...r, history: [{ pegs: [0, 0, 0, 0] }] }), null);
  const won = submit(l, { ...r, draft: secretFor(l) });
  won.history[0].feedback = { exact: 0, misplaced: 0 };
  assert.equal(restore(l, won).history[0].feedback.exact, 4);
  assert.equal(restore(l, { ...r, draft: [99] }), null);
});
test("save and settlement idempotence, practice exclusion, host throws and retries", () => {
  const l = levels[0], win = submit(l, { ...newRun(l, "run-1"), draft: secretFor(l) });
  let db = settle(blank(), win);
  assert.equal(db.records.length, 1);
  assert.ok(db.outbox[0].rewardClaims.length);
  assert.deepEqual(settle(db, win), db);
  const mem = { data: { other: "safe" }, getItem(k) {
    return this.data[k] || null;
  }, setItem(k, v) {
    this.data[k] = v;
  } };
  assert.ok(save(mem, db));
  const restored = load(mem, find);
  assert.equal(restored.records.length, 1);
  assert.deepEqual(restored.outbox, db.outbox);
  const retry = deliver(mem, db, () => {
    throw Error("offline");
  });
  assert.equal(retry.outbox.length, 1);
  const ids = [];
  db = deliver(mem, retry, (p) => {
    ids.push(p.completionId);
    return true;
  });
  assert.equal(db.outbox.length, 0);
  assert.equal(mem.data.other, "safe");
  db = settle(db, { ...win, runId: "practice", practice: true });
  assert.deepEqual(db.outbox[0].rewardClaims, []);
  mem.data[KEY] = "{broken";
  assert.deepEqual(load(mem, find), blank());
  assert.equal(mem.data.other, "safe");
});
test("suggestions depend only on visible history; daily deterministic", () => {
  const l = levels[11], r = newRun(l, "x");
  const changed = { ...l, seed: "different-secret" };
  assert.deepEqual(suggestion(l, r), suggestion(changed, r));
  assert.deepEqual(dailyLevel(levels, new Date(2026, 8, 14)), dailyLevel(levels, new Date(2026, 8, 14)));
});
test("tutorial SVG truth chain and shared renderer metadata", () => {
  const d = JSON.parse(fs.readFileSync(new URL("../assets/tutorial-truth.json", import.meta.url)));
  assert.deepEqual(oracle(d.secret, d.guess), { exact: 1, misplaced: 2 });
  assert.deepEqual(d.states[2].f, { exact: 4, misplaced: 0 });
  d.states.forEach((s, i) => {
    const svg = fs.readFileSync(new URL(`../assets/tutorial-${i + 1}.svg`, import.meta.url), "utf8");
    assert.ok(svg.includes(`data-pegs="${s.pegs.join(",")}"`));
    assert.ok(svg.includes('viewBox="0 0 360 180"'));
    if (s.f) assert.ok(svg.includes(`data-exact="${s.f.exact}"`));
  });
});
test("tutorial uses actual engine transitions and ends won", () => {
  const states = tutorialStates();
  assert.equal(states[0].history.length, 0);
  assert.equal(states[1].status, "playing");
  assert.deepEqual(states[1].history[0].feedback, { exact: 1, misplaced: 2 });
  assert.equal(states[2].status, "won");
  assert.equal(states[2].history.length, 2);
  assert.equal(secretFor(tutorialLevel).join(","), "1,1,2,3");
});
test("independent decision tree verifies worst-case budget for every dossier", () => {
  function depth(pool) {
    if (!pool.length) return 0;
    const guess = pool[0], buckets = {};
    for (const s of pool) {
      const f = oracle(s, guess);
      if (f.exact === s.length) continue;
      const k = f.exact + "," + f.misplaced;
      (buckets[k] || (buckets[k] = [])).push(s);
    }
    return 1 + Math.max(0, ...Object.values(buckets).map(depth));
  }
  for (const l of levels) {
    const all = enumerateSecrets(l.params).filter((s) => l.clues.every((c) => JSON.stringify(oracle(s, c.pegs)) === JSON.stringify(c.feedback)));
    const worst = depth(all);
    assert.equal(worst, l.worstCaseRounds);
    assert.ok(worst <= l.params.guesses);
  }
});
