import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, createGame, attemptMove, undo, solve, replay, DIRECTIONS, VECTORS, tileAt } from '../core.mjs';

const level = (grid, id='test') => createLevel({ id, name:'测试航区', grid });
const simple = level(['######','#@.e.#','#....#','#....#','######']);

test('compilation validates board and treats the start as a permanent anchor', () => {
  const game = createGame(simple);
  assert.deepEqual(game.position, {x:1,y:1});
  assert.equal(tileAt(game.level,1,1),'o');
  assert.equal(tileAt(game.level,-1,1),'#');
  assert.equal(game.totalEnergy,1);
  assert.equal(game.status,'playing');
  assert.throws(()=>level(['###','#@@','#e#']), /exactly one/);
  assert.throws(()=>level(['###','#@#','###']), /at least one/);
  assert.throws(()=>level(['####','#@e','####']), /same width/);
  assert.throws(()=>level(['####','#@?e','####']), /Unknown tile/);
});

test('all eight direction vectors agree with a one-cell anchor stop', () => {
  assert.deepEqual(DIRECTIONS,['N','NE','E','SE','S','SW','W','NW']);
  for (const direction of DIRECTIONS) {
    const grid=['#######','#e....#','#.ooo.#','#.o@o.#','#.ooo.#','#.....#','#######'];
    const result=attemptMove(createGame(level(grid)),direction);
    const {dx,dy}=VECTORS[direction];
    assert.deepEqual(result.state.position,{x:3+dx,y:3+dy});
    assert.equal(result.path.length,1);
    assert.equal(result.stopReason,'stop');
    assert.equal(result.state.moves,1);
  }
});

test('invalid, blocked, and terminal moves are atomic no-ops', () => {
  const initial=createGame(simple);
  for (const direction of ['N','W','???',null,[0,0]]) {
    const result=attemptMove(initial,direction);
    assert.equal(result.moved,false);
    assert.equal(result.state,initial);
    assert.equal(result.state.moves,0);
    assert.equal(result.state.history.length,0);
  }
  const won=attemptMove(initial,'E').state;
  assert.equal(won.status,'won');
  assert.equal(attemptMove(won,'S').state,won);
  assert.deepEqual(initial.remainingEnergy,['3,1']);
});

test('energy does not brake; the full path is retained after collection', () => {
  const result=attemptMove(createGame(simple),'E');
  assert.deepEqual(result.path,[{x:2,y:1},{x:3,y:1},{x:4,y:1}]);
  assert.deepEqual(result.state.position,{x:4,y:1});
  assert.equal(result.state.collected,1);
  assert.equal(result.stopReason,'wall');
});

test('mine death takes priority over collecting the final energy on the same slide', () => {
  const dangerous=level(['#######','#@.ex.#','#.....#','#######']);
  const initial=createGame(dangerous);
  const result=attemptMove(initial,'E');
  assert.equal(result.state.status,'lost');
  assert.equal(result.stopReason,'mine');
  assert.equal(result.state.remainingEnergy.length,0);
  assert.equal(result.state.collected,1);
  assert.deepEqual(result.state.position,{x:4,y:1});
  assert.equal(attemptMove(result.state,'W').moved,false);
  assert.deepEqual(undo(result.state),initial);
});

test('diagonal travel checks the destination, not the orthogonal corner cells', () => {
  const diagonal=level(['#####','#@###','##e##','###.#','#####']);
  const result=attemptMove(createGame(diagonal),'SE');
  assert.deepEqual(result.path,[{x:2,y:2},{x:3,y:3}]);
  assert.equal(result.state.status,'won');
});

test('returning to the launch cell brakes and undo restores full prior state', () => {
  const board=level(['#######','#e....#','#.....#','#..@..#','#.....#','#.....#','#######']);
  const initial=createGame(board);
  const right=attemptMove(initial,'E').state;
  const returned=attemptMove(right,'W').state;
  assert.deepEqual(returned.position,initial.position);
  assert.equal(returned.lastMove.stopReason,'stop');
  assert.deepEqual(returned.moveLog,['E','W']);
  assert.deepEqual(undo(returned),right);
  assert.deepEqual(undo(right),initial);
  assert.equal(undo(initial),initial);
});

test('undo restores a winning move and preserves untouched snapshots', () => {
  const initial=createGame(simple);
  const result=attemptMove(initial,'E');
  const restored=undo(result.state);
  assert.deepEqual(restored,initial);
  result.path[0].x=999;
  assert.equal(result.state.lastMove.path[0].x,2);
});

test('BFS solves fresh and partial games without consulting a stored solution', () => {
  const board=level(['######','#@..e#','#....#','#....#','#...e#','######']);
  const proof=solve({...board,solution:['W']});
  assert.deepEqual(proof.path,['E','S']);
  assert.equal(proof.exhausted,false);
  assert.equal(replay(board,proof.path).status,'won');
  const partial=attemptMove(createGame(board),'E').state;
  assert.deepEqual(solve(partial).path,['S']);
  assert.deepEqual(solve(replay(board,proof.path)).path,[]);
});

test('BFS distinguishes budget exhaustion, impossible, and terminal loss', () => {
  const budget=solve(level(['######','#@..e#','#....#','#....#','#e...#','######']),{maxStates:1});
  assert.equal(budget.path,null); assert.equal(budget.exhausted,true);
  const impossible=solve(level(['#####','#@###','#####','###e#','#####']));
  assert.equal(impossible.path,null); assert.equal(impossible.exhausted,false);
  const lost=attemptMove(createGame(level(['#####','#@xe#','#####'])),'E').state;
  assert.deepEqual(solve(lost),{path:null,visited:0,exhausted:false});
  assert.throws(()=>solve(simple,{maxStates:0}),/positive/);
  assert.throws(()=>replay(simple,['N']),/blocked/);
});
