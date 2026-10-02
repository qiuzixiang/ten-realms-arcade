import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/levels.mjs';
import { makePuzzle, freshPosition, analyze, act, keyFor, parsePosition } from '../src/engine.mjs';
import { finish, loadProfile, loadSession, saveProfile, saveSession } from '../src/profile.mjs';
import { createStorage } from '../src/storage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Independent cell-first search: it does not read the stored solution or source solver.
function oracle(puzzle, limit = 2) {
  const covered = Array(puzzle.values.length).fill(false);
  const usedPairs = new Set();
  let count = 0;
  const choices = [];
  function search() {
    if (count >= limit) return;
    const first = covered.indexOf(false);
    if (first < 0) { if (usedPairs.size === puzzle.total) count += 1; return; }
    covered[first] = true;
    const row = Math.floor(first / puzzle.width);
    const col = first % puzzle.width;
    const neighbours = [
      row > 0 ? first - puzzle.width : -1,
      row + 1 < puzzle.height ? first + puzzle.width : -1,
      col > 0 ? first - 1 : -1,
      col + 1 < puzzle.width ? first + 1 : -1,
    ];
    for (const second of neighbours) {
      if (second < 0 || covered[second]) continue;
      const key = keyFor(puzzle, first, second);
      const pair = puzzle.edges[key].pair;
      if (usedPairs.has(pair)) continue;
      covered[second] = true;
      usedPairs.add(pair);
      choices.push(key);
      search();
      choices.pop();
      usedPairs.delete(pair);
      covered[second] = false;
      if (count >= limit) break;
    }
    covered[first] = false;
  }
  search();
  return count;
}

assert.equal(LEVELS.length, 60);
assert.equal(new Set(LEVELS.map((level) => level.id)).size, 60);
for (let chapter = 1; chapter <= 6; chapter += 1) assert.equal(LEVELS.filter((level) => level.chapter === chapter).length, 10);
for (const level of LEVELS) {
  const puzzle = makePuzzle(level);
  assert.equal(puzzle.width, level.order + 2);
  assert.equal(puzzle.height, level.order + 1);
  assert.equal(puzzle.total, (level.order + 1) * (level.order + 2) / 2);
  assert.equal(oracle(puzzle), 1, level.id + ' must have exactly one solution');
  const complete = { rooms: level.solution, excluded: [] };
  assert.equal(analyze(puzzle, complete).complete, true, level.id + ' stored answer must satisfy gameplay engine');
  let position = freshPosition();
  for (const key of level.solution) {
    const step = act(puzzle, position, key, 'room');
    assert.equal(step.accepted, true);
    assert.equal(step.removed.length, 0, level.id + ' solution rooms must not overlap');
    position = step.position;
  }
  assert.equal(analyze(puzzle, position).complete, true);
}

const firstLevel = LEVELS[0];
const firstPuzzle = makePuzzle(firstLevel);
let position = freshPosition();
const invalid = act(firstPuzzle, position, '0:999', 'room');
assert.equal(invalid.accepted, false);
assert.equal(invalid.position, position);
assert.equal(keyFor(firstPuzzle, 0, firstPuzzle.width + 1), null);
const noteKey = firstLevel.solution[0];
const noted = act(firstPuzzle, position, noteKey, 'exclude');
assert.equal(noted.accepted, true);
assert.equal(analyze(firstPuzzle, noted.position).complete, false);
const removeNote = act(firstPuzzle, noted.position, noteKey, 'exclude');
assert.deepEqual(removeNote.position, position);
const room = act(firstPuzzle, position, noteKey, 'room');
const blockedNote = act(firstPuzzle, room.position, noteKey, 'exclude');
assert.equal(blockedNote.accepted, false);
assert.equal(blockedNote.position, room.position);
const overlapping = Object.keys(firstPuzzle.edges).find((key) => key !== noteKey && (firstPuzzle.edges[key].a === firstPuzzle.edges[noteKey].a || firstPuzzle.edges[key].b === firstPuzzle.edges[noteKey].a));
assert.ok(overlapping);
const replaced = act(firstPuzzle, room.position, overlapping, 'room');
assert.deepEqual(replaced.removed, [noteKey]);
assert.deepEqual(room.position.rooms, [noteKey]);
assert.equal(parsePosition(firstPuzzle, { rooms: [noteKey, overlapping], excluded: [] }), null);
assert.equal(parsePosition(firstPuzzle, { rooms: [noteKey], excluded: [noteKey] }), null);

const memory = new Map();
const storage = { getItem(key) { return memory.has(key) ? memory.get(key) : null; }, setItem(key, value) { memory.set(key, value); } };
let profile = loadProfile(storage, LEVELS);
const session = { level: firstLevel, mode: 'campaign', date: '', runId: 'test-run', position: { rooms: firstLevel.solution.slice(), excluded: [] }, moves: firstPuzzle.total, hinted: false };
const firstCompletion = finish(profile, session, firstPuzzle, '2026-09-23');
assert.equal(firstCompletion.rewardClaims.length, 1);
assert.equal(finish(profile, session, firstPuzzle, '2026-09-23'), null, 'same run must settle once');
assert.equal(saveProfile(storage, profile), true);
profile = loadProfile(storage, LEVELS);
assert.equal(Object.keys(profile.proofs).length, 1);
assert.equal(finish(profile, { ...session, runId: 'replay' }, firstPuzzle, '2026-09-23').rewardClaims.length, 0);
saveSession(storage, session);
assert.equal(loadSession(storage, LEVELS).position.rooms.length, firstPuzzle.total);
memory.set('mini-polish:yokai-pairing-house:v1:session', '{bad json');
assert.equal(loadSession(storage, LEVELS), null);
memory.set('mini-polish:yokai-pairing-house:v1:profile', JSON.stringify({ proofs: { [firstLevel.id]: { rooms: [], excluded: [] } }, claims: [] }));
assert.equal(Object.keys(loadProfile(storage, LEVELS).proofs).length, 0, 'forged completion flag must not grant progress');
memory.set('mini-polish:yokai-pairing-house:v1:profile', JSON.stringify({ daily: { '2026-09-23': { levelId: firstLevel.id, position: { rooms: [], excluded: [] } } } }));
assert.equal(Object.keys(loadProfile(storage, LEVELS).daily).length, 0, 'forged daily claim must not grant progress');

const native = new Map();
globalThis.window = { localStorage: storage, xhs: { launchOptions: { miniToolEnv: { buildVersion: 9462004 } }, miniTool: {
  async getStorage({ key }) { return { data: native.has(key) ? native.get(key) : null }; },
  async setStorage({ key, data }) { native.set(key, data); },
} } };
const adapter = await createStorage();
assert.equal(adapter.mode, 'xhs-storage');
adapter.setItem('mini-polish:yokai-pairing-house:v1:session', JSON.stringify({ check: 1 }));
assert.equal(await adapter.flush(), true);
assert.deepEqual(JSON.parse(native.get('mini-polish:yokai-pairing-house:v1:session')), { check: 1 });
delete globalThis.window;

const dist = path.join(root, 'dist', 'xhs');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const js = await readFile(path.join(dist, 'app.js'), 'utf8');
assert.match(html, /<script src="\.\/app\.js"><\/script>/);
assert.doesNotMatch(html, /type="module"|<script[^>]*>\s*[^<\s]/);
assert.doesNotMatch(js, /^\s*(import|export)\s/m);
assert.doesNotMatch(js, /\b(fetch|XMLHttpRequest|WebSocket|Worker|ServiceWorker|eval)\s*\(/);
console.log('Verified 60 unique-solution levels, core actions, replay safety, and production script.');
