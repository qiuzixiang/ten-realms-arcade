import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, move, findPath } from '../core.mjs';
import { KEYS, safeWrite, loadSession, freshSession, loadSettings, loadRecords, recordRun } from '../storage.mjs';
const mock = () => { const map = new Map(); return { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v), map }; };
test('session recovery recomputes board, points and queue instead of trusting injected state', () => {
  const store = mock(), { session, state } = freshSession(121, 'example');
  let pair;
  for (let i = 0; i < 81 && !pair; i++) for (let j = 0; j < 81; j++) if (findPath(state.board, i, j)) { pair = [i, j]; break; }
  const expected = move(state, ...pair).state;
  session.moves.push(pair); session.score = 999999; session.board = Array(81).fill(7);
  safeWrite(store, KEYS.session, session);
  assert.deepEqual(loadSession(store).state, expected);
});
test('corrupt, malformed and illegal saved runs recover safely without touching other games', () => {
  const store = mock(); store.setItem('other-game', 'untouched');
  for (const value of ['broken', JSON.stringify({version:1,id:'bad',seed:1,moves:[[90,91]]}),JSON.stringify({version:1,id:'bad',seed:-1,moves:[]})]) {
    store.setItem(KEYS.session, value); assert.equal(loadSession(store), null); assert.equal(store.getItem('other-game'), 'untouched');
  }
});
test('new game and tutorial flag cannot reset settings or records', () => {
  const store = mock(); safeWrite(store, KEYS.settings, { sound: true, preview: false, symbols: true });
  safeWrite(store, KEYS.records, [{id:'past',score:100,turns:10,date:'2026-09-06'}]);
  safeWrite(store, KEYS.tutorial, true); safeWrite(store, KEYS.session, freshSession(2, 'new').session);
  assert.equal(loadSettings(store).preview, false); assert.equal(loadSettings(store).sound, true); assert.equal(loadRecords(store)[0].score, 100);
});
test('repeated saves do not duplicate a score; top ten remain sorted', () => {
  const { session, state } = freshSession(121, 'same'); state.score = 40;
  let records = recordRun([], session, state, '2026-09-06');
  records = recordRun(records, session, state, '2026-09-06'); assert.equal(records.length, 1);
  state.score = 50; records = recordRun(records, session, state, '2026-09-06'); assert.equal(records.length, 1); assert.equal(records[0].score, 50);
  for (let i = 0; i < 15; i++) records = recordRun(records, {...session,id:'run-'+i}, {...state, score:100+i}, '2026-09-06');
  assert.equal(records.length, 10); assert.equal(records[0].score, 114);
});
test('completed score becomes the king target when starting the next board', () => {
  const completed = freshSession(121, 'completed');
  completed.state.score = 172; completed.state.turns = 31; completed.state.gameOver = true;
  const records = recordRun([], completed.session, completed.state, '2026-09-06');
  const next = freshSession(122, 'next', Math.max(100, records[0].score));
  assert.equal(next.session.target, 172);
  assert.equal(next.state.score, 0);
  assert.equal(next.state.turns, 0);
  assert.equal(next.state.board.filter(Boolean).length, 5);
});
test('unavailable storage cannot interrupt gameplay', () => {
  const store = { getItem: () => { throw new Error('disabled'); }, setItem: () => { throw new Error('disabled'); } };
  assert.equal(loadSession(store), null); assert.equal(safeWrite(store, KEYS.session, {}), false);
  assert.deepEqual(loadSettings(store), {sound:false,preview:true,symbols:true}); assert.deepEqual(loadRecords(store), []);
  assert.equal(createGame(121).board.length, 81);
});
