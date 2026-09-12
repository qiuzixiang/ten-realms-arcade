import test from 'node:test';import assert from 'node:assert/strict';
import {edgeAt,cellAt,gestureEdge,directValue} from '../src/input.mjs';
import {cellEdges,edgeCoordinates} from '../src/render.mjs';
for(const n of [3,4,5,6])test(n+'x'+n+' tap regions and swipe directions are unambiguous',()=>{
 const l={width:n,height:n};const count=n*(n+1)*2;
 for(let e=0;e<count;e++){const p=edgeCoordinates(l,e);assert.equal(edgeAt(l,16+(p[0]+p[2])*40,16+(p[1]+p[3])*40),e);}
 for(let y=0;y<=n;y++)for(let x=0;x<=n;x++)for(const dx of [-10,0,10])for(const dy of [-10,0,10])assert.equal(edgeAt(l,16+x*80+dx,16+y*80+dy),null);
 for(let i=0;i<n*n;i++){const x=56+i%n*80,y=56+Math.floor(i/n)*80,start={x,y,cell:cellAt(l,x,y)};assert.equal(start.cell,i);[[0,-28],[28,0],[0,28],[-28,0]].forEach(([dx,dy],d)=>assert.equal(gestureEdge(l,start,{x:x+dx,y:y+dy}),cellEdges(l,i)[d]));assert.equal(gestureEdge(l,start,{x:x+25,y:y+25}),null);assert.equal(gestureEdge(l,start,{x,y}),null);assert.equal(gestureEdge(l,start,{x:-30,y}),null);}
});
test('same-tool second tap erases without cycling through exclusion',()=>{assert.equal(directValue(0,1),1);assert.equal(directValue(1,1),0);assert.equal(directValue(-1,-1),0);assert.equal(directValue(1,-1),-1);assert.equal(directValue(1,0),0);});
