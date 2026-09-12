import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {LEVELS} from '../src/levels.mjs';import {createState,applyEdge,checkWin,topology} from '../src/engine.mjs';import {boardSvg,cellEdges,edgeCoordinates} from '../src/render.mjs';
test('renderer cell direction mapping agrees with engine for every level',()=>{for(const level of LEVELS){const t=topology(level.width,level.height);for(let i=0;i<level.clues.length;i++)assert.deepEqual(cellEdges(level,i),t.cellEdges[i]);for(let i=0;i<t.edgeCount;i++){const [x1,y1,x2,y2]=edgeCoordinates(level,i);assert.equal(Math.abs(x1-x2)+Math.abs(y1-y2),1);}}});
test('three tutorial SVG images match current rules, legal action and complete state',()=>{const level=LEVELS[0],initial=createState(level),acted=applyEdge(level,initial,0,1);const data=JSON.parse(fs.readFileSync(new URL('../assets/tutorial-data.json',import.meta.url)));const expected=[initial.edges,acted.edges,level.solution];assert.equal(data.levelId,level.id);for(let i=0;i<3;i++){assert.deepEqual(data.states[i].edges,expected[i]);assert.equal(data.states[i].won,checkWin(level,expected[i]));const svg=fs.readFileSync(new URL('../assets/tutorial-'+(i+1)+'.svg',import.meta.url),'utf8');assert.equal(svg,boardSvg(level,expected[i],{stage:data.states[i].stage,selectedCell:i===1?0:undefined}));assert.equal((svg.match(/data-clue=/g)||[]).length,9);assert.equal((svg.match(/data-edge=/g)||[]).length,expected[i].filter(v=>v===1).length);}assert.deepEqual(data.states.map(s=>s.won),[false,false,true]);});
test('all SVG art and tutorial files parse as XML and contain no scripts or remote resources',()=>{execFileSync('python3',['-c',`import pathlib,xml.etree.ElementTree as E
for f in pathlib.Path('assets').glob('*.svg'):
 root=E.parse(f).getroot()
 assert root.tag.endswith('svg') and 'viewBox' in root.attrib
 for el in root.iter():
  assert not el.tag.endswith('script')
  for k,v in el.attrib.items():
   assert not k.startswith('on')
   if k.endswith('href'): assert not v.startswith(('http:', 'https:'))
`],{cwd:new URL('..',import.meta.url)});});
