'use strict';
const test=require('node:test'),a=require('node:assert/strict'),T=require('../tools/topology.cjs');
const graph=(n,edges)=>({initial:Array.from({length:n},(_,id)=>({id,x:0,y:0})),edges});
test('exact isomorphism accepts relabeling and rejects same-degree different graphs',()=>{
  const prism=graph(6,[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]]);
  const bipartite=graph(6,[[0,3],[0,4],[0,5],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5]]);
  a.deepEqual(T.stats(prism).degrees,T.stats(bipartite).degrees);
  a.equal(T.isomorphic(prism,bipartite),false);
  const perm=[4,1,5,0,3,2],copy=graph(6,prism.edges.map(e=>e.map(id=>perm[id])));
  a.equal(T.isomorphic(prism,copy),true);
});
test('articulation classification covers two blocks sharing a point',()=>{
  const g=graph(5,[[0,1],[1,2],[2,0],[2,3],[3,4],[4,2]]);
  a.deepEqual(T.stats(g).articulations,[2]);a.equal(T.stats(g).cycles,2);
});
