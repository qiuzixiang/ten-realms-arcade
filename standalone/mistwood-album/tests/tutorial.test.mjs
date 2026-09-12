import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const R=require('../src/rules.js'),L=require('../src/levels.js'),V=require('../src/render.js');
const root=new URL('../',import.meta.url);
test('all three tutorial assets reproduce real initial, legal-action and complete states',()=>{
 const truth=JSON.parse(fs.readFileSync(new URL('assets/tutorial-truth.json',root),'utf8'));
 const level=L.get(truth.levelId),initial=R.blank(level),action=R.apply(level,initial,truth.action.index,truth.action.value);
 assert.deepEqual(truth.states[0],initial);assert.deepEqual(truth.states[1],action);
 assert.equal(R.complete(level,initial),false);assert.equal(R.complete(level,action),false);assert.equal(R.complete(level,truth.states[2]),true);
 truth.states.forEach((grid,i)=>{
   const svg=fs.readFileSync(new URL('assets/tutorial-'+i+'.svg',root),'utf8');
   assert.equal(svg,V.boardImage(level,grid,i===1?truth.action.index:-1));
   const cells=[...svg.matchAll(/data-cell="(\d+)" data-state="(\d+)"/g)];
   assert.equal(cells.length,level.width*level.height);assert.deepEqual(cells.map(m=>Number(m[2])),grid);
   assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));assert.ok(svg.includes('viewBox="0 0 '));
 });
});
test('source page loads classic dependencies in order and stays completely local',()=>{
 const html=fs.readFileSync(new URL('index.html',root),'utf8');
 const modules=[...html.matchAll(/<script src="\.\/src\/(\w+)\.js"><\/script>/g)].map(m=>m[1]);
 assert.deepEqual(modules,['rules','levels','store','render','app']);
 assert.ok(!/type="module"|\son\w+\s*=|<iframe|<object|<base/.test(html));
 for(const match of html.matchAll(/(?:src|href)="([^\"]+)"/g))assert.ok(fs.existsSync(new URL(match[1],root)));
});
