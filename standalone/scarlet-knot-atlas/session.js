(function(root){
  'use strict';
  var C=root.ScarletCore;if(typeof module!=='undefined'&&module.exports)C=require('./core.js');
  var GAME='scarlet-knot-atlas';
  function fresh(){return {version:1,current:0,sessions:{},collection:{},claims:{},outbox:[],muted:true};}
  function payload(level,state){return {gameId:GAME,levelId:level.id,graphVersion:level.graphVersion,runId:state.runId,completionId:GAME+':'+level.id+':'+state.runId,claimId:GAME+':first:'+level.id+':v1',reward:'缘签',moves:state.history.length};}
  function settle(doc,level,state){
    var next=C.clone(doc);next.sessions[level.id]=C.clone(state);
    if(C.solved(state.points,level.edges)){
      var e=payload(level,state),record=next.collection[level.id];
      if(!record){next.collection[level.id]={session:C.clone(state),event:e};next.claims[e.claimId]={event:e,delivered:false};next.outbox.push(e.claimId);}
      else if(state.history.length<record.session.history.length)next.collection[level.id].session=C.clone(state);
    }
    return next;
  }
  function restore(levels,raw){
    var next=fresh();if(!raw||raw.version!==1)return next;
    if(Number.isInteger(raw.current)&&raw.current>=0&&raw.current<levels.length)next.current=raw.current;
    next.muted=raw.muted!==false;
    levels.forEach(function(level){
      var state;try{state=C.restore(level,raw.sessions&&raw.sessions[level.id]);}catch(e){state=null;}
      if(state)next.sessions[level.id]=state;
      var record=raw.collection&&raw.collection[level.id],completed;
      try{completed=record&&C.restore(level,record.session);}catch(e){completed=null;}
      if(!completed||!C.solved(completed.points,level.edges))return;
      // Claims are reconstructed only from replay-verified completed layouts.
      var event=record.event,expected=payload(level,completed);
      if(!event||event.gameId!==GAME||event.levelId!==level.id||event.claimId!==expected.claimId||typeof event.runId!=='string'||event.completionId!==GAME+':'+level.id+':'+event.runId)return;
      var safeEvent={gameId:GAME,levelId:level.id,graphVersion:level.graphVersion,runId:event.runId,completionId:event.completionId,claimId:expected.claimId,reward:'缘签',moves:Number.isInteger(event.moves)&&event.moves>=0?event.moves:completed.history.length};
      next.collection[level.id]={session:completed,event:safeEvent};
      var old=raw.claims&&raw.claims[safeEvent.claimId],delivered=old&&old.delivered===true;
      next.claims[safeEvent.claimId]={event:safeEvent,delivered:!!delivered};if(!delivered)next.outbox.push(safeEvent.claimId);
    });
    return next;
  }
  function acknowledge(doc,id){var next=C.clone(doc);if(!next.claims[id])return doc;next.claims[id].delivered=true;next.outbox=next.outbox.filter(function(v){return v!==id;});return next;}
  var api={fresh:fresh,settle:settle,restore:restore,payload:payload,acknowledge:acknowledge};root.ScarletSession=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
}(typeof window!=='undefined'?window:this));
