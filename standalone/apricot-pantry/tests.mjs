import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { independentDistance4 } from "./scripts/analyze-campaign.mjs";
import "./logic.js";
import "./levels.js";

const L = globalThis.ApricotLogic;
const { levels, chapters } = globalThis.ApricotLevels;
const solved = (width) => Array.from({ length: width * width }, (_, i) => (i + 1) % (width * width));
const key = (board) => board.join(",");

// A second implementation of the click: shift a row/column segment by copying
// the clicked tile toward the hole, without calling the product's move().
function oracleMove(board, width, index) {
  if (!Number.isInteger(index) || index < 0 || index >= board.length || !board[index]) return null;
  const hole = board.indexOf(0);
  if (Math.floor(hole / width) !== Math.floor(index / width) && hole % width !== index % width) return null;
  const stride = Math.floor(hole / width) === Math.floor(index / width) ? 1 : width;
  const direction = index > hole ? stride : -stride;
  const out = board.slice();
  for (let at = hole; at !== index; at += direction) out[at] = board[at + direction];
  out[index] = 0;
  return out;
}

function oracleGraph3() {
  const first = solved(3);
  const distance = new Map([[key(first), 0]]);
  const queue = [first];
  for (let head = 0; head < queue.length; head += 1) {
    const board = queue[head];
    const depth = distance.get(key(board));
    for (let index = 0; index < 9; index += 1) {
      const next = oracleMove(board, 3, index);
      if (!next || distance.has(key(next))) continue;
      distance.set(key(next), depth + 1);
      queue.push(next);
    }
  }
  return distance;
}

assert.deepEqual(L.move([1, 2, 3, 4, 5, 6, 7, 8, 0], 3, 6)?.board, [1, 2, 3, 4, 5, 6, 0, 7, 8]);
assert.equal(L.move([1, 2, 3, 4, 5, 6, 7, 8, 0], 3, 0), null, "diagonal input is atomic no-op");
assert.equal(L.move(solved(3), 3, 8), null, "empty slot cannot move");
assert.equal(L.move(solved(3), 3, -1), null);
assert.equal(L.isSolvable([1, 2, 3, 4, 5, 6, 8, 7, 0], 3), false);
assert.equal(L.isSolvable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0], 4), false);
assert.equal(L.isSolvable(solved(4), 4), true);

const tutorialStart = [1, 2, 3, 4, 0, 6, 7, 5, 8];
const tutorialAfter = oracleMove(tutorialStart, 3, 7);
assert.deepEqual(tutorialAfter, [1, 2, 3, 4, 5, 6, 7, 0, 8]);
assert.deepEqual(oracleMove(tutorialAfter, 3, 8), solved(3));
const longExample = oracleMove([1, 2, 3, 4, 5, 6, 0, 7, 8], 3, 8);
assert.deepEqual(longExample, solved(3));
assert.deepEqual(L.affectedIndices([1, 2, 3, 4, 5, 6, 0, 7, 8], 3, 8), [6, 7, 8]);

const distances = oracleGraph3();
assert.equal(distances.size, 181440, "all reachable 3×3 boards are independently enumerated");
assert.equal([...distances.values()].reduce((maximum, depth) => Math.max(maximum, depth), 0), 24);
assert.equal(levels.length, 48);
assert.equal(chapters.length, 6);
const unique = new Set();
for (const [offset, level] of levels.entries()) {
  assert.equal(level.id, offset + 1);
  assert.equal(level.chapter, Math.floor(offset / 8) + 1);
  assert.equal(level.width, offset < 32 ? 3 : 4);
  assert.equal(level.generatorVersion, offset < 32 ? 1 : 2);
  assert.ok(L.isSolvable(level.board, level.width), `level ${level.id} must be reachable`);
  assert.ok(!unique.has(key(level.board)), `level ${level.id} is duplicated`);
  unique.add(key(level.board));
  let board = level.board;
  for (const [step, index] of level.reference.entries()) {
    const expected = oracleMove(board, level.width, index);
    assert.ok(expected, `level ${level.id} reference step ${step + 1} must be legal`);
    assert.deepEqual(L.move(board, level.width, index)?.board, expected,
      `level ${level.id} engine and oracle differ at step ${step + 1}`);
    board = expected;
  }
  assert.deepEqual(board, solved(level.width), `level ${level.id} reference must complete`);
  if (level.width === 3) {
    assert.equal(level.proof, "exact");
    assert.equal(level.distance, distances.get(key(level.board)));
    assert.equal(level.reference.length, level.distance);
  } else {
    assert.equal(level.proof, "exact");
    assert.equal(level.distance, independentDistance4(level.board), `level ${level.id} independent 4×4 proof`);
    assert.equal(level.reference.length, level.distance);
  }
}
assert.ok(levels.slice(0, 8).every((level) => level.distance <= 3));
assert.deepEqual(levels.slice(32, 40).map((level) => level.distance), [1, 2, 3, 4, 5, 6, 7, 8]);
assert.ok(levels.slice(40).every((level, index, chapter) => index === 0 || level.distance >= chapter[index - 1].distance));
assert.equal(levels[0].title, "第一只罐子");
assert.equal(levels[2].title, "借一个空位");
assert.equal(levels[18].title, "给长架让路");
assert.equal(levels[43].title, "最后的两排");
assert.notEqual(levels[43].title, levels[44].title);
assert.deepEqual(levels[43].board.slice(0, 8), solved(4).slice(0, 8), "level 44 preserves the upper two rows");
assert.ok(levels[43].reference.every((index) => index >= 8), "level 44 solution keeps the upper two rows untouched");
const shallow4 = levels[33];
const afterFirst4 = oracleMove(shallow4.board, 4, shallow4.reference[0]);
assert.deepEqual(L.referenceSuffix(afterFirst4, 4, shallow4.board, shallow4.reference), shallow4.reference.slice(1));
const different4 = L.legalIndices(shallow4.board, 4).map((index) => oracleMove(shallow4.board, 4, index))
  .find((board) => L.referenceSuffix(board, 4, shallow4.board, shallow4.reference) === null);
assert.ok(different4, "an off-route move must not reuse the initial solution suffix");
assert.ok(levels.some((level) => level.reference.some((index, step) => {
  let board = level.board;
  for (let i = 0; i < step; i += 1) board = oracleMove(board, level.width, level.reference[i]);
  return L.affectedIndices(board, level.width, index).length > 2;
})), "campaign must teach a long segment slide");

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
assert.match(html, /src="logic\.js\?v=2"[\s\S]*src="levels\.js\?v=2"[\s\S]*src="game\.js\?v=3"/);
assert.doesNotMatch(html + css + app, /https?:\/\//, "offline entry has no remote dependency");
assert.match(app, /mini-polish:apricot-pantry:v1:save/);
assert.match(css, /prefers-reduced-motion/);

// Boot the real browser entry against minimal DOM/storage doubles. This checks
// that forged completion flags do not unlock content on restoration.
async function boot(candidate, triggerAction = null, xhs = null) {
  const listeners = {};
  let persisted = null;
  const root = { innerHTML: "", addEventListener(type, handler) { listeners[type] = handler; },
    querySelector() { return null; }, querySelectorAll() { return []; } };
  const storage = { getItem() { return JSON.stringify(candidate); }, setItem(_key, value) { persisted = JSON.parse(value); } };
  const context = vm.createContext({
    document: { getElementById() { return root; }, body: { classList: { toggle() {} } },
      addEventListener() {}, activeElement: null },
    window: { addEventListener() {}, xhs },
    localStorage: storage, console, Date, Math, setTimeout,
  });
  for (const source of ["logic.js", "levels.js", "game.js"]) {
    vm.runInContext(readFileSync(new URL(source, import.meta.url), "utf8"), context);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (triggerAction) {
    const target = { disabled: false, dataset: { action: triggerAction }, hasAttribute() { return false; } };
    listeners.click({ target: { closest() { return target; } } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { html: root.innerHTML, persisted };
  }
  return root.innerHTML;
}

const first = levels[0];
const firstCertificate = { actions: first.reference, runId: "proof-1", generatorVersion: 1, boardKey: key(first.board) };
assert.match(await boot({ schema: 1, completed: { 1: true }, best: { 1: 1 } }), /从第一只果酱罐开始/);
assert.match(await boot({ schema: 1, certificates: { 1: firstCertificate } }), /已收好 1 \/ 48 盘/);
assert.match(await boot({ schema: 1, certificates: { 1: { ...firstCertificate, actions: [0] } } }), /从第一只果酱罐开始/);
const second = levels[1];
const runBase = { levelId: 2, actions: [second.reference[0]], cursor: 1,
  runId: "run-2", generatorVersion: 1, boardKey: key(second.board) };
assert.match(await boot({ schema: 1, certificates: { 1: firstCertificate }, run: runBase }), /<strong>1<\/strong><span>次滑运<\/span>/);
assert.doesNotMatch(await boot({ schema: 1, certificates: { 1: firstCertificate },
  run: { ...runBase, actions: [0] } }), /次滑运/);
const old33 = { actions: [13, 12, 15], runId: "old-proof-33", generatorVersion: 1,
  boardKey: "1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15" };
assert.match(await boot({ schema: 1, certificates: { 33: old33 } }), /已收好 1 \/ 48 盘/);
assert.match(await boot({ schema: 1, certificates: { 33: old33 } }), /继续第 01 关/);
assert.match(await boot({ schema: 1, certificates: { 33: { ...old33, actions: [13] } } }), /从第一只果酱罐开始/);
const sparseCertificates = Object.fromEntries([0, 1, 2].map((index) => {
  const level = levels[index];
  return [level.id, { actions: level.reference, runId: `proof-${level.id}`,
    generatorVersion: 1, boardKey: key(level.board) }];
}));
sparseCertificates[33] = old33;
assert.match(await boot({ schema: 1, certificates: sparseCertificates }), /风味收藏<small>0 \/ 12<\/small>/);
const sparseStart = await boot({ schema: 1, tutorialSeen: true, certificates: sparseCertificates }, "start-first");
assert.equal(sparseStart.persisted.run.levelId, 4, "home starts the first playable gap, not completed count plus one");
assert.doesNotMatch(await boot({ schema: 1, run: { levelId: 33, actions: [13], cursor: 1,
  runId: "old-run-33", generatorVersion: 1, boardKey: old33.boardKey } }), /次滑运/);
const migrated = await boot({ schema: 1, tutorialSeen: true, run: { levelId: 33, actions: [13], cursor: 1,
  runId: "old-run-33", generatorVersion: 1, boardKey: old33.boardKey } }, "start-first");
assert.equal(migrated.persisted.legacyRun.boardKey, old33.boardKey, "an old in-progress board survives the first new save");
const sameBoard41 = levels[40];
assert.match(await boot({ schema: 1, certificates: { 41: { actions: sameBoard41.reference,
  runId: "old-proof-41", generatorVersion: 1, boardKey: key(sameBoard41.board) } } }), /已收好 1 \/ 48 盘/);
const allCertificates = Object.fromEntries(levels.map((level) => [level.id, {
  actions: level.reference, runId: `proof-${level.id}`, generatorVersion: level.generatorVersion,
  boardKey: key(level.board) }]));
assert.match(await boot({ schema: 1, certificates: allCertificates }), /data-action="chapters">挑一盘再整理/);
const nativeWrites = [];
const xhsStorage = {
  launchOptions: { miniToolEnv: { buildVersion: 9462004 } },
  miniTool: {
    async getStorage() { return { data: null }; },
    async setStorage(options) { nativeWrites.push(options); },
  },
};
assert.match(await boot({ schema: 1, certificates: { 1: firstCertificate } }, null, xhsStorage), /已收好 1 \/ 48 盘/);
assert.equal(nativeWrites.length, 1, "old browser save is migrated to native storage");
assert.equal(JSON.parse(nativeWrites[0].data).completed[1], true);
const nativeOwnSave = {
  launchOptions: { miniToolEnv: { buildVersion: 9462004 } },
  miniTool: {
    async getStorage() { return { data: JSON.stringify({ schema: 1 }) }; },
    async setStorage() { throw new Error("existing native save must not be replaced during boot"); },
  },
};
assert.match(await boot({ schema: 1, certificates: { 1: firstCertificate } }, null, nativeOwnSave), /从第一只果酱罐开始/);
let writesAfterReadFailure = 0;
const nativeReadFailure = {
  launchOptions: { miniToolEnv: { buildVersion: 9462004 } },
  miniTool: {
    async getStorage() { throw new Error("temporary read failure"); },
    async setStorage() { writesAfterReadFailure += 1; },
  },
};
await boot({ schema: 1, tutorialSeen: true, certificates: { 1: firstCertificate } }, "start-first", nativeReadFailure);
assert.equal(writesAfterReadFailure, 0, "a failed native read must not overwrite an unknown existing save");
console.log("杏橘收纳所：48关最短路线、独立搜索、旧版存档、教程与离线入口通过。");
