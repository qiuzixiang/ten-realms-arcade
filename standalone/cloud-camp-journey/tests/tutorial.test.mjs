import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS} from '../src/levels.mjs';
import {createBoard,applyAction,isSolved} from '../src/engine.mjs';
import {boardSvg,treeShape,tentShape} from '../src/art.mjs';
test('tutorial states use the actual first level, legal action and completed engine state',()=>{
 const level=LEVELS[0],initial=createBoard(level),one=applyAction(level,initial,level.solution[0],1);assert.equal(one.accepted,true);assert.equal(isSolved(level,initial),false);assert.equal(isSolved(level,one.board),false);
 let end=initial;level.solution.forEach(i=>{end=applyAction(level,end,i,1).board;});assert.equal(isSolved(level,end),true);
 [initial,one.board,end].forEach((board,k)=>{const svg=boardSvg(level,board,'教程',-1);assert.match(svg,new RegExp('data-level="'+level.id+'"'));assert.ok(svg.includes('data-board="'+board.join(',')+'"'));assert.equal((svg.match(/data-cell=/g)||[]).length,level.size*level.size);assert.equal((svg.match(/data-kind="tree"/g)||[]).length,level.trees.length);assert.equal((svg.match(/data-kind="tent"/g)||[]).length,k===0?0:k===1?1:level.solution.length);assert.ok(svg.includes(treeShape));if(k)assert.ok(svg.includes(tentShape));assert.match(svg,/viewBox="0 0 \d+ \d+"/);});
});
