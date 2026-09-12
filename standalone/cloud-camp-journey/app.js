/* 云野露营 | MIT (c) 2026 Ten Realms Arcade contributors | ES2017 classic bundle */
(function(){
"use strict";
const modules=[];
/* src/levels.mjs */
modules[0]=(function(){
// Deterministic generated catalog. Regenerate with node scripts/generate-levels.mjs.
// All 180 layouts independently exhaustively verified; canonical D4 signatures are distinct.
function freezeLevel(level) { level.trees = Object.freeze(level.trees); level.rows = Object.freeze(level.rows); level.cols = Object.freeze(level.cols); level.solution = Object.freeze(level.solution); level.difficulty = Object.freeze(level.difficulty); return Object.freeze(level); }
const CHAPTERS = Object.freeze([
  {
    "id": 1,
    "title": "晨露草甸",
    "subtitle": "看见行列中的小数字",
    "focus": "行列配额",
    "size": 4,
    "collection": "晨露帐篷",
    "description": "从零配额出发，让每行每列的帐篷数刚刚好。"
  },
  {
    "id": 2,
    "title": "杉林风声",
    "subtitle": "为每一棵树找一顶帐篷",
    "focus": "上下左右",
    "size": 5,
    "collection": "松风天幕",
    "description": "辨认正交邻接。斜对着树并不能成为它的营位。"
  },
  {
    "id": 3,
    "title": "溪谷野餐",
    "subtitle": "给夜晚留下呼吸的空隙",
    "focus": "邻接排除",
    "size": 5,
    "collection": "花坡野餐垫",
    "description": "帐篷的八个方向都要留出空间，用排除缩小候选。"
  },
  {
    "id": 4,
    "title": "日落山坡",
    "subtitle": "数字与树影交织成路",
    "focus": "交叉推理",
    "size": 6,
    "collection": "溪光营灯",
    "description": "只靠配额渐渐走不动了。观察树的候选，交叉验证你的判断。"
  },
  {
    "id": 5,
    "title": "星夜营地",
    "subtitle": "每顶帐篷都有自己的树",
    "focus": "一一匹配",
    "size": 6,
    "collection": "暮云帐篷",
    "description": "配额与间隔都满足也未必完成：需要用整组树帐配对排除伪解。"
  },
  {
    "id": 6,
    "title": "云海远行",
    "subtitle": "把整片草甸放进心里",
    "focus": "全局推理",
    "size": 7,
    "collection": "星河观景台",
    "description": "每片营地都需要多次综合推演，用假设与矛盾打开最后的云海。"
  }
].map(Object.freeze));
const LEVELS = Object.freeze([{"size":4,"trees":[7,10,13],"rows":[1,0,2,0],"cols":[0,1,0,2],"seed":61308067,"solution":[3,9,11],"signature":"4|1,6,11|0,2,0,1|0,1,0,2","generationAttempt":1,"difficulty":{"score":26,"nodes":5,"branchPoints":0,"candidateCells":6,"zeroLines":4,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-01","index":1,"chapter":1,"title":"露珠晨雾","focus":"行列配额"},{"size":4,"trees":[4,9,11],"rows":[1,0,2,0],"cols":[2,0,1,0],"seed":61308041,"solution":[0,8,10],"signature":"4|1,6,14|2,0,1,0|1,0,2,0","generationAttempt":1,"difficulty":{"score":29,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":4,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-02","index":2,"chapter":1,"title":"露珠小径","focus":"行列配额"},{"size":4,"trees":[3,12,14],"rows":[0,1,1,1],"cols":[1,0,0,2],"seed":61308107,"solution":[7,8,15],"signature":"4|0,13,15|0,1,1,1|2,0,0,1","generationAttempt":1,"difficulty":{"score":31,"nodes":5,"branchPoints":0,"candidateCells":6,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-03","index":3,"chapter":1,"title":"露珠野花","focus":"行列配额"},{"size":4,"trees":[3,8,14],"rows":[0,2,0,1],"cols":[1,0,0,2],"seed":61308082,"solution":[4,7,15],"signature":"4|0,11,13|0,2,0,1|2,0,0,1","generationAttempt":1,"difficulty":{"score":32,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":4,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-04","index":4,"chapter":1,"title":"露珠微风","focus":"行列配额"},{"size":4,"trees":[1,13,15],"rows":[1,0,2,0],"cols":[0,1,1,1],"seed":61308100,"solution":[2,9,11],"signature":"4|0,2,14|0,2,0,1|1,1,1,0","generationAttempt":1,"difficulty":{"score":34,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-05","index":5,"chapter":1,"title":"露珠树影","focus":"行列配额"},{"size":4,"trees":[1,2,12],"rows":[1,1,0,1],"cols":[1,1,1,0],"seed":61308056,"solution":[0,6,13],"signature":"4|0,13,14|1,0,1,1|1,1,1,0","generationAttempt":1,"difficulty":{"score":36,"nodes":5,"branchPoints":0,"candidateCells":6,"zeroLines":2,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-06","index":6,"chapter":1,"title":"露珠远山","focus":"行列配额"},{"size":4,"trees":[0,6,8],"rows":[1,1,0,1],"cols":[2,0,1,0],"seed":61308085,"solution":[2,4,12],"signature":"4|0,2,9|2,0,1,0|1,1,0,1","generationAttempt":1,"difficulty":{"score":37,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-07","index":7,"chapter":1,"title":"露珠溪声","focus":"行列配额"},{"size":4,"trees":[3,8,13,15],"rows":[0,2,0,2],"cols":[2,0,1,1],"seed":61308000,"solution":[4,7,12,14],"signature":"4|0,11,12,14|0,2,0,2|1,1,0,2","generationAttempt":1,"difficulty":{"score":40,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":3,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-08","index":8,"chapter":1,"title":"露珠晚霞","focus":"行列配额"},{"size":4,"trees":[7,9,15],"rows":[1,0,1,1],"cols":[1,0,1,1],"seed":61308022,"solution":[3,8,14],"signature":"4|0,2,9|1,1,0,1|1,1,0,1","generationAttempt":1,"difficulty":{"score":42,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":2,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-09","index":9,"chapter":1,"title":"露珠月升","focus":"行列配额"},{"size":4,"trees":[2,9,15],"rows":[1,1,0,1],"cols":[0,1,1,1],"seed":61308058,"solution":[3,5,14],"signature":"4|0,6,13|1,0,1,1|1,1,1,0","generationAttempt":1,"difficulty":{"score":45,"nodes":5,"branchPoints":0,"candidateCells":9,"zeroLines":2,"logicSteps":8,"globalSteps":0,"techniques":{"quota-empty":5,"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-10","index":10,"chapter":1,"title":"露珠归宿","focus":"行列配额"},{"size":5,"trees":[4,6,20,22],"rows":[1,1,0,0,2],"cols":[0,2,0,1,1],"seed":61408078,"solution":[1,9,21,23],"signature":"5|0,14,16,24|1,1,0,2,0|1,1,0,0,2","generationAttempt":1,"difficulty":{"score":1046,"nodes":6,"branchPoints":0,"candidateCells":10,"zeroLines":4,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-11","index":11,"chapter":2,"title":"杉风晨雾","focus":"上下左右"},{"size":5,"trees":[3,11,15,18],"rows":[1,1,0,2,0],"cols":[0,2,0,0,2],"seed":61408111,"solution":[4,6,16,19],"signature":"5|1,13,16,19|1,1,0,2,0|2,0,0,2,0","generationAttempt":1,"difficulty":{"score":1047,"nodes":6,"branchPoints":0,"candidateCells":12,"zeroLines":5,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-12","index":12,"chapter":2,"title":"杉风小径","focus":"上下左右"},{"size":5,"trees":[5,11,14,23],"rows":[0,0,2,1,1],"cols":[1,0,2,0,1],"seed":61408357,"solution":[10,12,19,22],"signature":"5|1,10,13,19|1,1,2,0,0|1,0,2,0,1","generationAttempt":1,"difficulty":{"score":1049,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":4,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-13","index":13,"chapter":2,"title":"杉风野花","focus":"上下左右"},{"size":5,"trees":[7,11,17,18],"rows":[0,2,0,1,1],"cols":[0,1,1,1,1],"seed":61408504,"solution":[6,8,19,22],"signature":"5|6,11,13,17|1,1,1,1,0|1,1,0,2,0","generationAttempt":1,"difficulty":{"score":1051,"nodes":6,"branchPoints":0,"candidateCells":10,"zeroLines":3,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-14","index":14,"chapter":2,"title":"杉风微风","focus":"上下左右"},{"size":5,"trees":[1,5,13,22],"rows":[1,1,1,0,1],"cols":[2,1,0,1,0],"seed":61408342,"solution":[0,8,10,21],"signature":"5|1,5,13,22|1,1,1,0,1|2,1,0,1,0","generationAttempt":1,"difficulty":{"score":1054,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":3,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-15","index":15,"chapter":2,"title":"杉风树影","focus":"上下左右"},{"size":5,"trees":[1,3,7,13,18],"rows":[3,0,1,0,1],"cols":[1,0,2,1,1],"seed":61408517,"solution":[0,2,4,12,23],"signature":"5|1,3,7,11,16|3,0,1,0,1|1,1,2,0,1","generationAttempt":1,"difficulty":{"score":1057,"nodes":6,"branchPoints":0,"candidateCells":10,"zeroLines":3,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-16","index":16,"chapter":2,"title":"杉风远山","focus":"上下左右"},{"size":5,"trees":[1,2,6,13,20],"rows":[2,0,1,1,1],"cols":[1,2,0,2,0],"seed":61408166,"solution":[0,3,11,18,21],"signature":"5|0,13,16,21,22|1,1,1,0,2|1,2,0,2,0","generationAttempt":2,"difficulty":{"score":1060,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":3,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-17","index":17,"chapter":2,"title":"杉风溪声","focus":"上下左右"},{"size":5,"trees":[7,11,17,22],"rows":[0,1,1,1,1],"cols":[1,1,0,2,0],"seed":61408273,"solution":[8,10,18,21],"signature":"5|10,11,13,17|0,2,0,1,1|1,1,1,1,0","generationAttempt":1,"difficulty":{"score":1062,"nodes":7,"branchPoints":1,"candidateCells":9,"zeroLines":3,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-18","index":18,"chapter":2,"title":"杉风晚霞","focus":"上下左右"},{"size":5,"trees":[6,8,11,15,24],"rows":[1,1,1,0,2],"cols":[2,0,1,2,0],"seed":61408799,"solution":[3,5,12,20,23],"signature":"5|0,8,17,18,21|0,2,1,0,2|2,0,1,1,1","generationAttempt":1,"difficulty":{"score":1063,"nodes":6,"branchPoints":0,"candidateCells":12,"zeroLines":3,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":5,"quota-empty":1},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-19","index":19,"chapter":2,"title":"杉风月升","focus":"上下左右"},{"size":5,"trees":[4,9,11,21,23],"rows":[1,1,1,0,2],"cols":[1,1,0,1,2],"seed":61408817,"solution":[3,6,14,20,24],"signature":"5|0,1,9,17,19|2,1,0,1,1|1,1,1,0,2","generationAttempt":1,"difficulty":{"score":1065,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":2,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-20","index":20,"chapter":2,"title":"杉风归宿","focus":"上下左右"},{"size":5,"trees":[5,7,11,13,22,23],"rows":[2,0,2,0,2],"cols":[2,1,2,0,1],"seed":61408755,"solution":[0,2,10,12,21,24],"signature":"5|1,2,11,13,17,19|2,0,2,0,2|1,0,2,1,2","generationAttempt":3,"difficulty":{"score":1069,"nodes":6,"branchPoints":0,"candidateCells":12,"zeroLines":3,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-21","index":21,"chapter":3,"title":"溪谷晨雾","focus":"邻接排除"},{"size":5,"trees":[1,3,10,16,18,24],"rows":[2,0,2,0,2],"cols":[1,2,1,2,0],"seed":61408518,"solution":[0,2,11,13,21,23],"signature":"5|0,6,8,14,21,23|2,0,2,0,2|0,2,1,2,1","generationAttempt":1,"difficulty":{"score":1072,"nodes":6,"branchPoints":0,"candidateCells":13,"zeroLines":3,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-22","index":22,"chapter":3,"title":"溪谷小径","focus":"邻接排除"},{"size":5,"trees":[1,12,13,15,21,23],"rows":[1,0,2,0,3],"cols":[1,1,2,0,2],"seed":61408395,"solution":[2,11,14,20,22,24],"signature":"5|1,12,13,15,21,23|1,0,2,0,3|1,1,2,0,2","generationAttempt":1,"difficulty":{"score":1075,"nodes":6,"branchPoints":0,"candidateCells":14,"zeroLines":3,"logicSteps":7,"globalSteps":0,"techniques":{"quota-fill":6,"quota-empty":1},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-23","index":23,"chapter":3,"title":"溪谷野花","focus":"邻接排除"},{"size":5,"trees":[2,7,8,11,19,21],"rows":[2,0,3,0,1],"cols":[1,1,2,1,1],"seed":61408419,"solution":[1,3,10,12,14,22],"signature":"5|1,8,13,14,15,17|1,1,2,1,1|1,0,3,0,2","generationAttempt":2,"difficulty":{"score":1077,"nodes":6,"branchPoints":0,"candidateCells":13,"zeroLines":2,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-24","index":24,"chapter":3,"title":"溪谷微风","focus":"邻接排除"},{"size":5,"trees":[1,7,10,14,18],"rows":[1,1,0,3,0],"cols":[2,0,1,1,1],"seed":61408340,"solution":[0,8,15,17,19],"signature":"5|1,7,10,14,18|1,1,0,3,0|2,0,1,1,1","generationAttempt":1,"difficulty":{"score":1080,"nodes":7,"branchPoints":1,"candidateCells":13,"zeroLines":3,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-25","index":25,"chapter":3,"title":"溪谷树影","focus":"邻接排除"},{"size":5,"trees":[2,8,10,13,14,21],"rows":[2,0,1,2,1],"cols":[1,1,2,1,1],"seed":61408728,"solution":[1,3,12,15,19,22],"signature":"5|1,10,13,14,18,22|1,2,1,0,2|1,1,2,1,1","generationAttempt":1,"difficulty":{"score":1082,"nodes":6,"branchPoints":0,"candidateCells":13,"zeroLines":1,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-26","index":26,"chapter":3,"title":"溪谷远山","focus":"邻接排除"},{"size":5,"trees":[1,3,6,9,17,19],"rows":[2,0,2,0,2],"cols":[1,1,2,0,2],"seed":61408179,"solution":[0,2,11,14,22,24],"signature":"5|1,3,5,13,15,16|2,0,2,1,1|2,0,2,0,2","generationAttempt":1,"difficulty":{"score":1088,"nodes":8,"branchPoints":1,"candidateCells":13,"zeroLines":3,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-27","index":27,"chapter":3,"title":"溪谷溪声","focus":"邻接排除"},{"size":5,"trees":[1,3,5,17,20,24],"rows":[3,0,1,1,1],"cols":[2,0,2,1,1],"seed":61408188,"solution":[0,2,4,12,15,23],"signature":"5|0,3,9,11,19,20|2,0,2,1,1|1,1,1,0,3","generationAttempt":1,"difficulty":{"score":1096,"nodes":8,"branchPoints":1,"candidateCells":14,"zeroLines":2,"logicSteps":16,"globalSteps":0,"techniques":{"quota-fill":5,"quota-empty":9,"no-tree":1,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":0},"id":"camp-28","index":28,"chapter":3,"title":"溪谷晚霞","focus":"邻接排除"},{"size":5,"trees":[1,9,10,13,16,21],"rows":[1,1,2,1,1],"cols":[2,0,3,0,1],"seed":61408563,"solution":[2,5,12,14,15,22],"signature":"5|1,6,10,13,19,21|1,1,2,1,1|2,0,3,0,1","generationAttempt":1,"difficulty":{"score":1110,"nodes":9,"branchPoints":2,"candidateCells":14,"zeroLines":2,"logicSteps":9,"globalSteps":0,"techniques":{"quota-empty":3,"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-29","index":29,"chapter":3,"title":"溪谷月升","focus":"邻接排除"},{"size":5,"trees":[1,6,9,11,24],"rows":[2,1,1,1,0],"cols":[2,0,1,0,2],"seed":61408262,"solution":[0,4,7,10,19],"signature":"5|0,13,15,18,23|0,1,1,1,2|2,0,1,0,2","generationAttempt":1,"difficulty":{"score":1273,"nodes":9,"branchPoints":2,"candidateCells":12,"zeroLines":3,"logicSteps":16,"globalSteps":1,"techniques":{"quota-empty":12,"quota-fill":4,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":2,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":0},"id":"camp-30","index":30,"chapter":3,"title":"溪谷归宿","focus":"邻接排除"},{"size":6,"trees":[4,6,9,11,13,24,25,35],"rows":[2,0,3,0,2,1],"cols":[2,0,2,1,0,3],"seed":61508404,"solution":[3,5,12,14,17,26,29,30],"signature":"6|0,10,11,22,24,26,29,31|1,2,0,3,0,2|3,0,1,2,0,2","generationAttempt":1,"difficulty":{"score":2109,"nodes":9,"branchPoints":1,"candidateCells":17,"zeroLines":4,"logicSteps":11,"globalSteps":0,"techniques":{"quota-fill":8,"quota-empty":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-31","index":31,"chapter":4,"title":"暮坡晨雾","focus":"交叉推理"},{"size":6,"trees":[3,6,14,17,19,30,33],"rows":[2,1,1,1,0,2],"cols":[1,1,2,0,3,0],"seed":61511943,"solution":[0,4,8,16,20,31,34],"signature":"6|0,3,13,20,23,24,33|2,0,1,1,1,2|1,1,2,0,3,0","generationAttempt":1,"difficulty":{"score":2115,"nodes":8,"branchPoints":1,"candidateCells":20,"zeroLines":3,"logicSteps":26,"globalSteps":0,"techniques":{"quota-fill":6,"quota-empty":18,"no-tree":1,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":4,"matchingRejectedLayouts":0},"id":"camp-32","index":32,"chapter":4,"title":"暮坡小径","focus":"交叉推理"},{"size":6,"trees":[6,9,11,22,23,24,28],"rows":[1,1,2,0,3,0],"cols":[1,1,1,1,1,2],"seed":61512192,"solution":[5,8,12,16,25,27,29],"signature":"6|1,3,9,10,13,31,34|2,1,1,1,1,1|1,1,2,0,3,0","generationAttempt":1,"difficulty":{"score":2127,"nodes":10,"branchPoints":2,"candidateCells":17,"zeroLines":2,"logicSteps":12,"globalSteps":0,"techniques":{"quota-fill":7,"quota-empty":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":7,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"camp-33","index":33,"chapter":4,"title":"暮坡野花","focus":"交叉推理"},{"size":6,"trees":[4,7,11,13,22,26,31,34],"rows":[2,1,2,0,1,2],"cols":[2,0,1,2,1,2],"seed":61513564,"solution":[3,5,6,14,16,27,30,35],"signature":"6|1,4,8,16,19,25,29,34|2,1,0,2,1,2|2,0,1,2,1,2","generationAttempt":1,"difficulty":{"score":2133,"nodes":10,"branchPoints":1,"candidateCells":21,"zeroLines":2,"logicSteps":25,"globalSteps":0,"techniques":{"quota-empty":15,"quota-fill":6,"no-tree":2,"tree-single":2},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":4,"matchingRejectedLayouts":0},"id":"camp-34","index":34,"chapter":4,"title":"暮坡微风","focus":"交叉推理"},{"size":6,"trees":[1,4,7,13,22,23,31],"rows":[1,2,1,1,2,0],"cols":[2,1,1,1,1,1],"seed":61511625,"solution":[0,8,10,12,21,25,29],"signature":"6|1,16,17,19,25,31,34|0,2,1,1,2,1|2,1,1,1,1,1","generationAttempt":1,"difficulty":{"score":2151,"nodes":12,"branchPoints":3,"candidateCells":18,"zeroLines":1,"logicSteps":20,"globalSteps":0,"techniques":{"quota-empty":5,"no-tree":8,"tree-single":1,"quota-fill":6},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":7,"matchingRejectedLayouts":0},"id":"camp-35","index":35,"chapter":4,"title":"暮坡树影","focus":"交叉推理"},{"size":6,"trees":[3,23,24,25,26,28],"rows":[0,1,0,2,0,3],"cols":[1,1,1,1,2,0],"seed":61511075,"solution":[9,19,22,30,32,34],"signature":"6|1,7,13,23,25,32|1,1,1,1,2,0|3,0,2,0,1,0","generationAttempt":1,"difficulty":{"score":2252,"nodes":7,"branchPoints":0,"candidateCells":14,"zeroLines":4,"logicSteps":27,"globalSteps":1,"techniques":{"quota-fill":6,"quota-empty":21,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":0},"id":"camp-36","index":36,"chapter":4,"title":"暮坡远山","focus":"交叉推理"},{"size":6,"trees":[6,7,11,18,19,28,35],"rows":[2,1,1,1,1,1],"cols":[2,1,1,0,2,1],"seed":61509540,"solution":[0,5,8,12,22,25,34],"signature":"6|0,4,7,26,28,32,34|1,2,0,1,1,2|1,1,1,1,1,2","generationAttempt":2,"difficulty":{"score":2290,"nodes":8,"branchPoints":1,"candidateCells":15,"zeroLines":1,"logicSteps":22,"globalSteps":1,"techniques":{"quota-fill":6,"quota-empty":9,"no-tree":6,"separation":1,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":1,"quotaOnlyRemainingTents":6,"matchingRejectedLayouts":0},"id":"camp-37","index":37,"chapter":4,"title":"暮坡溪声","focus":"交叉推理"},{"size":6,"trees":[0,4,8,13,21,24,26,28],"rows":[2,1,0,2,0,3],"cols":[2,1,2,0,2,1],"seed":61511908,"solution":[2,5,6,19,22,30,32,34],"signature":"6|0,4,8,13,16,21,24,28|2,1,2,0,2,1|2,1,0,2,0,3","generationAttempt":1,"difficulty":{"score":2304,"nodes":8,"branchPoints":1,"candidateCells":21,"zeroLines":3,"logicSteps":24,"globalSteps":1,"techniques":{"quota-fill":8,"quota-empty":16,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":0},"id":"camp-38","index":38,"chapter":4,"title":"暮坡晚霞","focus":"交叉推理"},{"size":6,"trees":[4,7,13,19,22,25,27],"rows":[0,2,1,2,0,2],"cols":[1,1,2,1,1,1],"seed":61513854,"solution":[8,10,12,20,23,31,33],"signature":"6|1,10,16,19,22,26,28|0,2,1,2,0,2|1,1,1,2,1,1","generationAttempt":1,"difficulty":{"score":2312,"nodes":11,"branchPoints":2,"candidateCells":18,"zeroLines":2,"logicSteps":26,"globalSteps":1,"techniques":{"quota-fill":7,"quota-empty":19,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":0},"id":"camp-39","index":39,"chapter":4,"title":"暮坡月升","focus":"交叉推理"},{"size":6,"trees":[0,10,18,20,23,24,27,34],"rows":[1,1,1,2,0,3],"cols":[2,1,0,2,1,2],"seed":61508137,"solution":[4,6,17,19,21,30,33,35],"signature":"6|0,10,18,20,23,24,27,34|1,1,1,2,0,3|2,1,0,2,1,2","generationAttempt":1,"difficulty":{"score":2321,"nodes":11,"branchPoints":2,"candidateCells":19,"zeroLines":2,"logicSteps":22,"globalSteps":1,"techniques":{"quota-fill":8,"quota-empty":9,"no-tree":5,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":5,"matchingRejectedLayouts":0},"id":"camp-40","index":40,"chapter":4,"title":"暮坡归宿","focus":"交叉推理"},{"size":6,"trees":[2,6,16,18,25,26],"rows":[1,1,1,1,1,1],"cols":[3,0,2,0,1,0],"seed":61510868,"solution":[0,8,12,22,24,32],"signature":"6|1,3,10,12,16,26|3,0,2,0,1,0|1,1,1,1,1,1","generationAttempt":1,"difficulty":{"score":2195,"nodes":12,"branchPoints":1,"candidateCells":16,"zeroLines":3,"logicSteps":29,"globalSteps":0,"techniques":{"quota-fill":5,"quota-empty":23,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":2,"matchingRejectedLayouts":1},"id":"camp-41","index":41,"chapter":5,"title":"星夜晨雾","focus":"一一匹配"},{"size":6,"trees":[6,11,14,15,19,31,33],"rows":[2,1,1,1,0,2],"cols":[2,0,3,0,1,1],"seed":61509807,"solution":[0,5,8,16,20,30,32],"signature":"6|1,14,17,20,27,29,31|1,1,0,3,0,2|2,1,1,1,0,2","generationAttempt":1,"difficulty":{"score":2205,"nodes":11,"branchPoints":1,"candidateCells":18,"zeroLines":3,"logicSteps":28,"globalSteps":0,"techniques":{"quota-fill":6,"quota-empty":21,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":2,"matchingRejectedLayouts":1},"id":"camp-42","index":42,"chapter":5,"title":"星夜小径","focus":"一一匹配"},{"size":6,"trees":[3,6,22,25,26,35],"rows":[2,0,1,1,2,0],"cols":[2,0,2,0,1,1],"seed":61509257,"solution":[0,2,16,20,24,29],"signature":"6|0,8,17,19,25,34|1,1,0,2,0,2|0,2,1,1,0,2","generationAttempt":1,"difficulty":{"score":2214,"nodes":15,"branchPoints":2,"candidateCells":18,"zeroLines":4,"logicSteps":29,"globalSteps":0,"techniques":{"quota-empty":23,"quota-fill":5,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":2,"matchingRejectedLayouts":1},"id":"camp-43","index":43,"chapter":5,"title":"星夜野花","focus":"一一匹配"},{"size":6,"trees":[3,11,12,13,19,23,30,33],"rows":[2,1,1,2,0,2],"cols":[2,1,2,0,2,1],"seed":61509883,"solution":[2,5,6,14,18,22,31,34],"signature":"6|0,3,13,17,18,19,29,33|2,0,2,1,1,2|2,1,2,0,2,1","generationAttempt":1,"difficulty":{"score":2223,"nodes":13,"branchPoints":1,"candidateCells":19,"zeroLines":2,"logicSteps":25,"globalSteps":0,"techniques":{"quota-empty":16,"quota-fill":7,"no-tree":1,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":4,"matchingRejectedLayouts":1},"id":"camp-44","index":44,"chapter":5,"title":"星夜微风","focus":"一一匹配"},{"size":6,"trees":[6,11,13,14,15,24,29,33],"rows":[2,1,1,1,0,3],"cols":[2,1,2,0,1,2],"seed":61513822,"solution":[0,5,8,16,19,30,32,35],"signature":"6|1,4,12,15,21,27,31,34|2,1,0,2,1,2|3,0,1,1,1,2","generationAttempt":1,"difficulty":{"score":2239,"nodes":12,"branchPoints":2,"candidateCells":21,"zeroLines":2,"logicSteps":26,"globalSteps":0,"techniques":{"quota-fill":7,"quota-empty":18,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":2,"matchingRejectedLayouts":1},"id":"camp-45","index":45,"chapter":5,"title":"星夜树影","focus":"一一匹配"},{"size":6,"trees":[1,11,12,21,25,28,31],"rows":[2,0,0,2,1,2],"cols":[2,0,2,0,2,1],"seed":61512555,"solution":[2,5,18,22,26,30,34],"signature":"6|1,10,15,24,28,29,32|1,2,0,2,0,2|2,0,0,2,1,2","generationAttempt":1,"difficulty":{"score":2276,"nodes":22,"branchPoints":5,"candidateCells":20,"zeroLines":4,"logicSteps":25,"globalSteps":0,"techniques":{"quota-empty":18,"quota-fill":6,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":4,"matchingRejectedLayouts":1},"id":"camp-46","index":46,"chapter":5,"title":"星夜远山","focus":"一一匹配"},{"size":6,"trees":[1,5,8,15,22,25,30,33],"rows":[3,0,2,0,2,1],"cols":[2,0,3,0,3,0],"seed":61509043,"solution":[0,2,4,14,16,24,26,34],"signature":"6|0,3,7,16,21,26,31,35|1,2,0,2,0,3|2,0,3,0,3,0","generationAttempt":2,"difficulty":{"score":2377,"nodes":9,"branchPoints":1,"candidateCells":18,"zeroLines":5,"logicSteps":25,"globalSteps":1,"techniques":{"quota-fill":7,"quota-empty":18,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":2,"matchingRejectedLayouts":1},"id":"camp-47","index":47,"chapter":5,"title":"星夜溪声","focus":"一一匹配"},{"size":6,"trees":[9,11,19,22,31,33],"rows":[1,0,2,1,0,2],"cols":[1,1,1,1,0,2],"seed":61509941,"solution":[5,13,15,23,30,32],"signature":"6|1,3,13,16,27,29|2,0,1,2,0,1|1,1,1,1,0,2","generationAttempt":1,"difficulty":{"score":2397,"nodes":14,"branchPoints":2,"candidateCells":18,"zeroLines":3,"logicSteps":27,"globalSteps":1,"techniques":{"quota-empty":21,"quota-fill":5,"global":1,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":1},"id":"camp-48","index":48,"chapter":5,"title":"星夜晚霞","focus":"一一匹配"},{"size":6,"trees":[0,3,7,16,19,25,32,34],"rows":[1,2,0,2,0,3],"cols":[2,1,1,1,2,1],"seed":61510207,"solution":[4,6,8,18,22,31,33,35],"signature":"6|0,3,7,16,19,25,32,34|1,2,0,2,0,3|2,1,1,1,2,1","generationAttempt":1,"difficulty":{"score":2417,"nodes":14,"branchPoints":2,"candidateCells":19,"zeroLines":2,"logicSteps":25,"globalSteps":1,"techniques":{"quota-fill":8,"quota-empty":17,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":1},"id":"camp-49","index":49,"chapter":5,"title":"星夜月升","focus":"一一匹配"},{"size":6,"trees":[1,4,9,17,21,24,33],"rows":[3,0,1,1,0,2],"cols":[2,0,1,1,2,1],"seed":61509462,"solution":[0,3,5,16,20,30,34],"signature":"6|1,11,18,20,22,29,33|2,0,1,1,2,1|2,0,1,1,0,3","generationAttempt":1,"difficulty":{"score":2584,"nodes":13,"branchPoints":2,"candidateCells":19,"zeroLines":3,"logicSteps":26,"globalSteps":2,"techniques":{"quota-empty":17,"no-tree":3,"global":2,"quota-fill":5,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":7,"matchingRejectedLayouts":1},"id":"camp-50","index":50,"chapter":5,"title":"星夜归宿","focus":"一一匹配"},{"size":7,"trees":[6,7,9,12,23,28,32,33,41,44],"rows":[2,2,0,2,1,2,1],"cols":[2,1,1,2,1,2,1],"seed":61611488,"solution":[0,2,11,13,22,26,31,35,40,45],"signature":"7|0,5,8,11,18,29,31,34,43,46|1,2,1,2,1,1,2|2,2,0,2,1,2,1","generationAttempt":1,"difficulty":{"score":3569,"nodes":14,"branchPoints":4,"candidateCells":26,"zeroLines":1,"logicSteps":31,"globalSteps":2,"techniques":{"quota-empty":13,"no-tree":9,"global":2,"separation":1,"quota-fill":8},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":10,"matchingRejectedLayouts":0},"id":"camp-51","index":51,"chapter":6,"title":"云海晨雾","focus":"全局推理"},{"size":7,"trees":[1,5,13,14,17,22,34,35,39,48],"rows":[3,0,2,1,1,1,2],"cols":[2,2,0,1,2,1,2],"seed":61610267,"solution":[0,4,6,15,18,27,29,38,42,47],"signature":"7|0,2,5,13,15,25,38,41,43,46|2,1,2,1,0,2,2|2,1,1,1,2,0,3","generationAttempt":3,"difficulty":{"score":3587,"nodes":18,"branchPoints":5,"candidateCells":27,"zeroLines":2,"logicSteps":28,"globalSteps":2,"techniques":{"quota-empty":13,"quota-fill":8,"no-tree":6,"global":2,"separation":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":7,"matchingRejectedLayouts":0},"id":"camp-52","index":52,"chapter":6,"title":"云海小径","focus":"全局推理"},{"size":7,"trees":[5,9,10,24,35,41,44,46],"rows":[1,1,1,1,1,0,3],"cols":[1,1,1,2,1,1,1],"seed":61610094,"solution":[3,12,16,25,28,43,45,48],"signature":"7|1,10,11,24,35,41,44,46|1,1,1,1,1,0,3|1,1,1,2,1,1,1","generationAttempt":1,"difficulty":{"score":3618,"nodes":25,"branchPoints":8,"candidateCells":23,"zeroLines":1,"logicSteps":37,"globalSteps":2,"techniques":{"quota-empty":13,"no-tree":17,"global":2,"quota-fill":7},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":8,"matchingRejectedLayouts":0},"id":"camp-53","index":53,"chapter":6,"title":"云海野花","focus":"全局推理"},{"size":7,"trees":[5,8,9,24,31,33,36,40,45],"rows":[1,2,1,1,1,2,1],"cols":[2,0,2,1,1,2,1],"seed":61608115,"solution":[2,7,12,17,26,30,35,41,46],"signature":"7|1,11,12,24,29,31,36,40,45|1,2,1,1,1,2,1|1,2,1,1,2,0,2","generationAttempt":1,"difficulty":{"score":3659,"nodes":17,"branchPoints":4,"candidateCells":26,"zeroLines":1,"logicSteps":36,"globalSteps":2,"techniques":{"quota-fill":8,"quota-empty":20,"no-tree":8,"global":2},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":2,"quotaOnlyRemainingTents":7,"matchingRejectedLayouts":1},"id":"camp-54","index":54,"chapter":6,"title":"云海微风","focus":"全局推理"},{"size":7,"trees":[2,19,20,22,24,29,33,35,38,40],"rows":[1,1,2,1,2,1,2],"cols":[1,1,1,3,1,1,2],"seed":61613219,"solution":[3,12,15,17,27,30,32,41,42,45],"signature":"7|1,9,10,20,22,24,36,37,39,46|1,1,1,3,1,1,2|2,1,2,1,2,1,1","generationAttempt":1,"difficulty":{"score":3697,"nodes":29,"branchPoints":12,"candidateCells":25,"zeroLines":0,"logicSteps":27,"globalSteps":2,"techniques":{"no-tree":14,"global":2,"quota-fill":9,"separation":1,"quota-empty":3},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":10,"matchingRejectedLayouts":0},"id":"camp-55","index":55,"chapter":6,"title":"云海树影","focus":"全局推理"},{"size":7,"trees":[7,13,19,21,23,26,39,41,42,45],"rows":[1,1,1,2,1,1,3],"cols":[1,2,1,1,1,1,3],"seed":61608770,"solution":[6,8,20,22,24,33,35,44,46,48],"signature":"7|0,3,11,13,21,23,26,33,35,41|3,1,1,2,1,1,1|1,2,1,1,1,1,3","generationAttempt":2,"difficulty":{"score":3752,"nodes":16,"branchPoints":4,"candidateCells":24,"zeroLines":0,"logicSteps":28,"globalSteps":3,"techniques":{"no-tree":15,"global":3,"quota-fill":9,"quota-empty":1,"separation":3},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":10,"matchingRejectedLayouts":0},"id":"camp-56","index":56,"chapter":6,"title":"云海远山","focus":"全局推理"},{"size":7,"trees":[1,11,12,22,23,33,35,40,48],"rows":[2,1,1,1,1,2,1],"cols":[2,1,1,1,1,2,1],"seed":61613983,"solution":[0,5,10,15,26,30,39,41,42],"signature":"7|0,8,13,15,25,26,36,37,47|1,2,1,1,1,1,2|1,2,1,1,1,1,2","generationAttempt":1,"difficulty":{"score":3796,"nodes":23,"branchPoints":7,"candidateCells":24,"zeroLines":0,"logicSteps":25,"globalSteps":3,"techniques":{"no-tree":16,"global":3,"separation":1,"quota-fill":8},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":9,"matchingRejectedLayouts":0},"id":"camp-57","index":57,"chapter":6,"title":"云海溪声","focus":"全局推理"},{"size":7,"trees":[2,11,14,20,25,38,40,43],"rows":[2,0,1,2,0,1,2],"cols":[1,2,1,1,1,1,1],"seed":61613346,"solution":[1,4,15,24,27,37,42,47],"signature":"7|1,10,12,25,28,34,39,44|2,1,0,2,1,0,2|1,2,1,1,1,1,1","generationAttempt":2,"difficulty":{"score":3852,"nodes":23,"branchPoints":5,"candidateCells":26,"zeroLines":2,"logicSteps":34,"globalSteps":3,"techniques":{"quota-empty":18,"no-tree":10,"global":3,"quota-fill":5,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":8,"matchingRejectedLayouts":1},"id":"camp-58","index":58,"chapter":6,"title":"云海晚霞","focus":"全局推理"},{"size":7,"trees":[7,11,12,23,27,29,32,36,38,39],"rows":[1,2,1,1,2,1,2],"cols":[1,2,1,2,1,2,1],"seed":61612265,"solution":[5,8,10,20,25,28,30,40,43,45],"signature":"7|1,11,12,17,26,29,32,33,36,45|1,2,1,2,1,2,1|1,2,1,1,2,1,2","generationAttempt":1,"difficulty":{"score":3976,"nodes":23,"branchPoints":6,"candidateCells":26,"zeroLines":0,"logicSteps":29,"globalSteps":4,"techniques":{"no-tree":13,"global":4,"quota-fill":10,"quota-empty":2,"separation":4},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":10,"matchingRejectedLayouts":0},"id":"camp-59","index":59,"chapter":6,"title":"云海月升","focus":"全局推理"},{"size":7,"trees":[1,2,5,14,18,27,31,33,42,46],"rows":[2,1,1,2,1,1,2],"cols":[2,1,1,1,2,1,2],"seed":61612553,"solution":[0,4,9,20,21,25,34,38,43,47],"signature":"7|0,4,13,20,23,28,32,37,41,45|2,1,1,1,2,1,2|2,1,1,2,1,1,2","generationAttempt":3,"difficulty":{"score":4369,"nodes":71,"branchPoints":23,"candidateCells":27,"zeroLines":0,"logicSteps":29,"globalSteps":3,"techniques":{"no-tree":12,"global":3,"separation":3,"tree-single":1,"quota-fill":7,"quota-empty":6},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":10,"matchingRejectedLayouts":3},"id":"camp-60","index":60,"chapter":6,"title":"云海归宿","focus":"全局推理"}].map(freezeLevel));
const REPLAY_LEVELS = Object.freeze([{"size":4,"trees":[7,11,14],"rows":[1,0,0,2],"cols":[0,1,0,2],"seed":61308070,"solution":[3,13,15],"signature":"4|1,2,4|2,0,1,0|2,0,0,1","generationAttempt":1,"difficulty":{"score":23,"nodes":5,"branchPoints":0,"candidateCells":5,"zeroLines":4,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-001","index":1,"chapter":1,"title":"旅途营地 001","focus":"自由复习"},{"size":4,"trees":[2,5,7],"rows":[2,0,1,0],"cols":[0,1,0,2],"seed":61308098,"solution":[1,3,11],"signature":"4|1,4,6|2,0,1,0|2,0,1,0","generationAttempt":1,"difficulty":{"score":26,"nodes":5,"branchPoints":0,"candidateCells":6,"zeroLines":4,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-002","index":2,"chapter":1,"title":"旅途营地 002","focus":"自由复习"},{"size":4,"trees":[2,7,14],"rows":[2,0,0,1],"cols":[0,1,0,2],"seed":61308017,"solution":[1,3,15],"signature":"4|1,4,13|2,0,0,1|2,0,1,0","generationAttempt":1,"difficulty":{"score":29,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":4,"logicSteps":11,"globalSteps":0,"techniques":{"quota-fill":3,"quota-empty":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-003","index":3,"chapter":1,"title":"旅途营地 003","focus":"自由复习"},{"size":4,"trees":[2,5,10],"rows":[2,0,1,0],"cols":[0,2,0,1],"seed":61308065,"solution":[1,3,9],"signature":"4|1,6,9|2,0,1,0|1,0,2,0","generationAttempt":1,"difficulty":{"score":29,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":4,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-004","index":4,"chapter":1,"title":"旅途营地 004","focus":"自由复习"},{"size":4,"trees":[3,13,14],"rows":[1,0,1,1],"cols":[1,0,2,0],"seed":61308035,"solution":[2,10,12],"signature":"4|0,13,14|1,0,1,1|0,2,0,1","generationAttempt":1,"difficulty":{"score":31,"nodes":5,"branchPoints":0,"candidateCells":6,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-005","index":5,"chapter":1,"title":"旅途营地 005","focus":"自由复习"},{"size":4,"trees":[3,10,11],"rows":[0,1,1,1],"cols":[0,1,0,2],"seed":61308119,"solution":[7,9,15],"signature":"4|0,2,6|2,0,1,0|0,1,1,1","generationAttempt":1,"difficulty":{"score":31,"nodes":5,"branchPoints":0,"candidateCells":6,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-006","index":6,"chapter":1,"title":"旅途营地 006","focus":"自由复习"},{"size":4,"trees":[2,9,14],"rows":[1,0,0,2],"cols":[0,2,0,1],"seed":61308008,"solution":[1,13,15],"signature":"4|1,10,13|1,0,0,2|1,0,2,0","generationAttempt":1,"difficulty":{"score":32,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":4,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":3,"quota-empty":2},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-007","index":7,"chapter":1,"title":"旅途营地 007","focus":"自由复习"},{"size":4,"trees":[1,10,13],"rows":[1,0,0,2],"cols":[2,0,1,0],"seed":61308118,"solution":[0,12,14],"signature":"4|1,10,13|1,0,0,2|2,0,1,0","generationAttempt":1,"difficulty":{"score":32,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":4,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-008","index":8,"chapter":1,"title":"旅途营地 008","focus":"自由复习"},{"size":4,"trees":[1,5,10],"rows":[1,0,2,0],"cols":[1,1,0,1],"seed":61308059,"solution":[0,9,11],"signature":"4|1,5,10|1,0,2,0|1,1,0,1","generationAttempt":1,"difficulty":{"score":34,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-009","index":9,"chapter":1,"title":"旅途营地 009","focus":"自由复习"},{"size":4,"trees":[4,7,15],"rows":[1,1,1,0],"cols":[0,1,0,2],"seed":61308092,"solution":[3,5,11],"signature":"4|0,2,14|2,0,1,0|0,1,1,1","generationAttempt":1,"difficulty":{"score":34,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-010","index":10,"chapter":1,"title":"旅途营地 010","focus":"自由复习"},{"size":4,"trees":[2,9,12],"rows":[1,0,2,0],"cols":[1,1,1,0],"seed":61308115,"solution":[1,8,10],"signature":"4|0,5,11|1,1,1,0|0,2,0,1","generationAttempt":1,"difficulty":{"score":34,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-011","index":11,"chapter":1,"title":"旅途营地 011","focus":"自由复习"},{"size":4,"trees":[2,12,13],"rows":[1,0,1,1],"cols":[1,1,1,0],"seed":61308002,"solution":[1,8,14],"signature":"4|0,1,14|1,1,0,1|1,1,1,0","generationAttempt":1,"difficulty":{"score":36,"nodes":5,"branchPoints":0,"candidateCells":6,"zeroLines":2,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-012","index":12,"chapter":1,"title":"旅途营地 012","focus":"自由复习"},{"size":4,"trees":[4,10,13],"rows":[1,1,0,1],"cols":[2,0,1,0],"seed":61308047,"solution":[0,6,12],"signature":"4|1,6,8|1,0,1,1|2,0,1,0","generationAttempt":1,"difficulty":{"score":37,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":3,"logicSteps":9,"globalSteps":0,"techniques":{"quota-fill":3,"quota-empty":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-013","index":13,"chapter":1,"title":"旅途营地 013","focus":"自由复习"},{"size":4,"trees":[1,9,10],"rows":[1,0,2,0],"cols":[1,0,1,1],"seed":61308071,"solution":[2,8,11],"signature":"4|1,9,10|1,0,2,0|1,0,1,1","generationAttempt":1,"difficulty":{"score":37,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-014","index":14,"chapter":1,"title":"旅途营地 014","focus":"自由复习"},{"size":4,"trees":[3,4,12,14],"rows":[0,2,0,2],"cols":[0,2,0,2],"seed":61308075,"solution":[5,7,13,15],"signature":"4|0,2,8,15|0,2,0,2|2,0,2,0","generationAttempt":1,"difficulty":{"score":38,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":4,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-015","index":15,"chapter":1,"title":"旅途营地 015","focus":"自由复习"},{"size":4,"trees":[7,11,13],"rows":[1,0,1,1],"cols":[1,0,1,1],"seed":61308068,"solution":[3,10,12],"signature":"4|1,2,11|1,1,0,1|1,0,1,1","generationAttempt":1,"difficulty":{"score":39,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":2,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-016","index":16,"chapter":1,"title":"旅途营地 016","focus":"自由复习"},{"size":4,"trees":[7,8,14],"rows":[0,2,0,1],"cols":[1,0,1,1],"seed":61308095,"solution":[4,6,15],"signature":"4|1,7,14|1,1,0,1|0,2,0,1","generationAttempt":2,"difficulty":{"score":40,"nodes":5,"branchPoints":0,"candidateCells":9,"zeroLines":3,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-017","index":17,"chapter":1,"title":"旅途营地 017","focus":"自由复习"},{"size":4,"trees":[3,4,8,10],"rows":[2,0,0,2],"cols":[2,0,2,0],"seed":61308009,"solution":[0,2,12,14],"signature":"4|0,6,13,14|0,2,0,2|2,0,0,2","generationAttempt":1,"difficulty":{"score":41,"nodes":5,"branchPoints":0,"candidateCells":9,"zeroLines":4,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-018","index":18,"chapter":1,"title":"旅途营地 018","focus":"自由复习"},{"size":4,"trees":[0,6,14],"rows":[1,1,0,1],"cols":[1,0,1,1],"seed":61308037,"solution":[2,4,15],"signature":"4|0,6,14|1,1,0,1|1,0,1,1","generationAttempt":1,"difficulty":{"score":42,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":2,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-019","index":19,"chapter":1,"title":"旅途营地 019","focus":"自由复习"},{"size":4,"trees":[1,2,4,11],"rows":[2,0,1,1],"cols":[2,0,0,2],"seed":61308024,"solution":[0,3,8,15],"signature":"4|1,2,4,11|2,0,1,1|2,0,0,2","generationAttempt":1,"difficulty":{"score":43,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":3,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-020","index":20,"chapter":1,"title":"旅途营地 020","focus":"自由复习"},{"size":4,"trees":[4,9,10,13],"rows":[1,1,1,1],"cols":[2,0,2,0],"seed":61308081,"solution":[0,6,8,14],"signature":"4|1,5,6,8|1,1,1,1|2,0,2,0","generationAttempt":1,"difficulty":{"score":45,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":2,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-021","index":21,"chapter":1,"title":"旅途营地 021","focus":"自由复习"},{"size":4,"trees":[0,2,7,8],"rows":[1,1,1,1],"cols":[2,0,0,2],"seed":61308111,"solution":[3,4,11,12],"signature":"4|0,2,7,8|1,1,1,1|2,0,0,2","generationAttempt":1,"difficulty":{"score":45,"nodes":5,"branchPoints":0,"candidateCells":7,"zeroLines":2,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-022","index":22,"chapter":1,"title":"旅途营地 022","focus":"自由复习"},{"size":4,"trees":[0,3,8,11],"rows":[1,1,0,2],"cols":[2,0,1,1],"seed":61308003,"solution":[2,4,12,15],"signature":"4|0,2,12,14|1,1,0,2|1,1,0,2","generationAttempt":1,"difficulty":{"score":48,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":2,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-023","index":23,"chapter":1,"title":"旅途营地 023","focus":"自由复习"},{"size":4,"trees":[0,2,6,9],"rows":[2,0,2,0],"cols":[1,1,1,1],"seed":61308030,"solution":[1,3,8,10],"signature":"4|0,2,6,9|2,0,2,0|1,1,1,1","generationAttempt":1,"difficulty":{"score":48,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":2,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-024","index":24,"chapter":1,"title":"旅途营地 024","focus":"自由复习"},{"size":4,"trees":[1,6,9,14],"rows":[2,0,1,1],"cols":[2,0,1,1],"seed":61308057,"solution":[0,2,8,15],"signature":"4|1,6,9,14|1,1,0,2|1,1,0,2","generationAttempt":1,"difficulty":{"score":48,"nodes":5,"branchPoints":0,"candidateCells":8,"zeroLines":2,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-025","index":25,"chapter":1,"title":"旅途营地 025","focus":"自由复习"},{"size":4,"trees":[1,5,12],"rows":[1,1,1,0],"cols":[2,0,1,0],"seed":61308080,"solution":[0,6,8],"signature":"4|0,6,7|2,0,1,0|0,1,1,1","generationAttempt":1,"difficulty":{"score":50,"nodes":7,"branchPoints":1,"candidateCells":7,"zeroLines":3,"logicSteps":6,"globalSteps":0,"techniques":{"quota-empty":3,"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-026","index":26,"chapter":1,"title":"旅途营地 026","focus":"自由复习"},{"size":4,"trees":[0,6,8,14],"rows":[1,1,1,1],"cols":[2,0,2,0],"seed":61308036,"solution":[2,4,10,12],"signature":"4|0,2,9,11|2,0,2,0|1,1,1,1","generationAttempt":1,"difficulty":{"score":54,"nodes":5,"branchPoints":0,"candidateCells":10,"zeroLines":2,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-027","index":27,"chapter":1,"title":"旅途营地 027","focus":"自由复习"},{"size":4,"trees":[3,5,12],"rows":[1,1,0,1],"cols":[1,1,1,0],"seed":61308110,"solution":[2,4,13],"signature":"4|0,6,15|1,1,0,1|0,1,1,1","generationAttempt":1,"difficulty":{"score":56,"nodes":6,"branchPoints":1,"candidateCells":8,"zeroLines":2,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-028","index":28,"chapter":1,"title":"旅途营地 028","focus":"自由复习"},{"size":4,"trees":[0,7,9],"rows":[0,1,1,1],"cols":[1,1,0,1],"seed":61308013,"solution":[4,11,13],"signature":"4|0,6,13|1,1,0,1|0,1,1,1","generationAttempt":1,"difficulty":{"score":59,"nodes":6,"branchPoints":1,"candidateCells":9,"zeroLines":2,"logicSteps":3,"globalSteps":0,"techniques":{"quota-fill":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-029","index":29,"chapter":1,"title":"旅途营地 029","focus":"自由复习"},{"size":4,"trees":[1,7,8,14],"rows":[1,1,1,1],"cols":[1,1,1,1],"seed":61308054,"solution":[2,4,11,13],"signature":"4|1,7,8,14|1,1,1,1|1,1,1,1","generationAttempt":1,"difficulty":{"score":478,"nodes":11,"branchPoints":3,"candidateCells":12,"zeroLines":0,"logicSteps":3,"globalSteps":2,"techniques":{"global":2,"quota-fill":3},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":4,"matchingRejectedLayouts":0},"id":"replay-030","index":30,"chapter":1,"title":"旅途营地 030","focus":"自由复习"},{"size":5,"trees":[6,9,12,13],"rows":[2,0,2,0,0],"cols":[0,2,0,0,2],"seed":61408321,"solution":[1,4,11,14],"signature":"5|1,7,12,16|2,0,0,2,0|2,0,2,0,0","generationAttempt":2,"difficulty":{"score":1033,"nodes":6,"branchPoints":0,"candidateCells":9,"zeroLines":6,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-031","index":31,"chapter":3,"title":"旅途营地 031","focus":"自由复习"},{"size":5,"trees":[4,6,10,23],"rows":[0,3,0,0,1],"cols":[1,0,2,0,1],"seed":61408510,"solution":[5,7,9,22],"signature":"5|0,8,14,21|0,3,0,0,1|1,0,2,0,1","generationAttempt":1,"difficulty":{"score":1041,"nodes":6,"branchPoints":0,"candidateCells":10,"zeroLines":5,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-032","index":32,"chapter":3,"title":"旅途营地 032","focus":"自由复习"},{"size":5,"trees":[6,10,12,16,22],"rows":[1,0,2,0,2],"cols":[0,3,0,2,0],"seed":61408649,"solution":[1,11,13,21,23],"signature":"5|10,12,16,18,22|0,2,0,3,0|2,0,2,0,1","generationAttempt":1,"difficulty":{"score":1044,"nodes":6,"branchPoints":0,"candidateCells":9,"zeroLines":5,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-033","index":33,"chapter":3,"title":"旅途营地 033","focus":"自由复习"},{"size":5,"trees":[3,5,20,24],"rows":[1,1,0,0,2],"cols":[1,1,0,2,0],"seed":61408462,"solution":[0,8,21,23],"signature":"5|0,3,19,20|1,1,0,2,0|2,0,0,1,1","generationAttempt":1,"difficulty":{"score":1046,"nodes":6,"branchPoints":0,"candidateCells":10,"zeroLines":4,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-034","index":34,"chapter":3,"title":"旅途营地 034","focus":"自由复习"},{"size":5,"trees":[4,10,11,24],"rows":[1,0,1,2,0],"cols":[1,0,1,1,1],"seed":61408345,"solution":[3,12,15,19],"signature":"5|0,13,14,20|0,2,1,0,1|1,1,1,0,1","generationAttempt":1,"difficulty":{"score":1048,"nodes":6,"branchPoints":0,"candidateCells":9,"zeroLines":3,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-035","index":35,"chapter":3,"title":"旅途营地 035","focus":"自由复习"},{"size":5,"trees":[9,10,19,21],"rows":[0,0,1,1,2],"cols":[1,0,1,0,2],"seed":61408381,"solution":[14,15,22,24],"signature":"5|1,3,15,22|2,0,1,0,1|2,1,1,0,0","generationAttempt":1,"difficulty":{"score":1049,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":4,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-036","index":36,"chapter":3,"title":"旅途营地 036","focus":"自由复习"},{"size":5,"trees":[3,10,16,17],"rows":[1,0,1,1,1],"cols":[0,2,0,1,1],"seed":61408303,"solution":[4,11,18,21],"signature":"5|1,14,17,18|1,0,1,1,1|1,1,0,2,0","generationAttempt":1,"difficulty":{"score":1051,"nodes":6,"branchPoints":0,"candidateCells":10,"zeroLines":3,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-037","index":37,"chapter":3,"title":"旅途营地 037","focus":"自由复习"},{"size":5,"trees":[11,18,19,21],"rows":[0,1,0,1,2],"cols":[1,1,1,0,1],"seed":61408000,"solution":[6,17,20,24],"signature":"5|1,6,15,17|1,0,1,1,1|2,1,0,1,0","generationAttempt":2,"difficulty":{"score":1054,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":3,"logicSteps":4,"globalSteps":0,"techniques":{"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-038","index":38,"chapter":3,"title":"旅途营地 038","focus":"自由复习"},{"size":5,"trees":[1,5,7,13,21],"rows":[2,0,2,0,1],"cols":[3,0,1,0,1],"seed":61408277,"solution":[0,2,10,14,20],"signature":"5|1,13,15,17,21|1,0,2,0,2|3,0,1,0,1","generationAttempt":1,"difficulty":{"score":1055,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":4,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-039","index":39,"chapter":3,"title":"旅途营地 039","focus":"自由复习"},{"size":5,"trees":[0,8,15,18],"rows":[1,1,0,1,1],"cols":[2,0,0,1,1],"seed":61408714,"solution":[3,5,19,20],"signature":"5|0,3,16,18|2,0,0,1,1|1,1,0,1,1","generationAttempt":1,"difficulty":{"score":1057,"nodes":6,"branchPoints":0,"candidateCells":12,"zeroLines":3,"logicSteps":5,"globalSteps":0,"techniques":{"quota-empty":1,"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-040","index":40,"chapter":3,"title":"旅途营地 040","focus":"自由复习"},{"size":5,"trees":[1,4,15,21,24],"rows":[1,1,1,1,1],"cols":[3,0,0,0,2],"seed":61408082,"solution":[0,9,10,19,20],"signature":"5|0,3,19,20,23|1,1,1,1,1|2,0,0,0,3","generationAttempt":1,"difficulty":{"score":1060,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":3,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-041","index":41,"chapter":3,"title":"旅途营地 041","focus":"自由复习"},{"size":5,"trees":[6,8,10,16,19],"rows":[2,0,1,1,1],"cols":[0,3,0,2,0],"seed":61408148,"solution":[1,3,11,18,21],"signature":"5|1,8,16,18,22|0,2,0,3,0|1,1,1,0,2","generationAttempt":3,"difficulty":{"score":1061,"nodes":6,"branchPoints":0,"candidateCells":13,"zeroLines":4,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-042","index":42,"chapter":3,"title":"旅途营地 042","focus":"自由复习"},{"size":5,"trees":[4,11,16,19,22],"rows":[1,1,1,0,2],"cols":[0,2,0,2,1],"seed":61408271,"solution":[3,6,14,21,23],"signature":"5|0,13,15,18,22|1,1,1,0,2|1,2,0,2,0","generationAttempt":1,"difficulty":{"score":1063,"nodes":6,"branchPoints":0,"candidateCells":12,"zeroLines":3,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-043","index":43,"chapter":3,"title":"旅途营地 043","focus":"自由复习"},{"size":5,"trees":[1,2,13,15,22],"rows":[2,0,1,0,2],"cols":[2,0,0,2,1],"seed":61408367,"solution":[0,3,14,20,23],"signature":"5|1,2,13,15,22|2,0,1,0,2|2,0,0,2,1","generationAttempt":1,"difficulty":{"score":1064,"nodes":6,"branchPoints":0,"candidateCells":14,"zeroLines":4,"logicSteps":12,"globalSteps":0,"techniques":{"quota-fill":5,"quota-empty":7},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-044","index":44,"chapter":3,"title":"旅途营地 044","focus":"自由复习"},{"size":5,"trees":[9,10,17,18,21],"rows":[0,1,2,0,2],"cols":[2,0,1,1,1],"seed":61408016,"solution":[5,12,14,20,23],"signature":"5|1,7,8,10,19|2,0,2,1,0|2,0,1,1,1","generationAttempt":1,"difficulty":{"score":1066,"nodes":6,"branchPoints":0,"candidateCells":13,"zeroLines":3,"logicSteps":17,"globalSteps":0,"techniques":{"quota-empty":12,"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-045","index":45,"chapter":3,"title":"旅途营地 045","focus":"自由复习"},{"size":5,"trees":[1,9,12,21,22],"rows":[2,1,0,1,1],"cols":[2,0,2,0,1],"seed":61408844,"solution":[0,4,7,17,20],"signature":"5|1,12,14,15,19|1,0,2,0,2|2,1,0,1,1","generationAttempt":1,"difficulty":{"score":1066,"nodes":6,"branchPoints":0,"candidateCells":13,"zeroLines":3,"logicSteps":9,"globalSteps":0,"techniques":{"quota-fill":5,"quota-empty":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-046","index":46,"chapter":3,"title":"旅途营地 046","focus":"自由复习"},{"size":5,"trees":[6,8,9,20,22],"rows":[0,2,1,0,2],"cols":[1,1,1,1,1],"seed":61408670,"solution":[5,7,14,21,23],"signature":"5|0,2,16,18,19|2,0,1,2,0|1,1,1,1,1","generationAttempt":1,"difficulty":{"score":1068,"nodes":6,"branchPoints":0,"candidateCells":12,"zeroLines":2,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-047","index":47,"chapter":3,"title":"旅途营地 047","focus":"自由复习"},{"size":5,"trees":[3,5,12,16,18],"rows":[2,0,1,1,1],"cols":[1,2,0,0,2],"seed":61408754,"solution":[0,4,11,19,21],"signature":"5|1,8,12,15,18|1,2,0,0,2|2,0,1,1,1","generationAttempt":2,"difficulty":{"score":1069,"nodes":6,"branchPoints":0,"candidateCells":14,"zeroLines":3,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":5,"quota-empty":1},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-048","index":48,"chapter":3,"title":"旅途营地 048","focus":"自由复习"},{"size":5,"trees":[2,8,11,22],"rows":[1,0,1,1,1],"cols":[0,2,0,2,0],"seed":61408159,"solution":[1,13,16,23],"signature":"5|2,11,18,22|1,1,1,0,1|0,2,0,2,0","generationAttempt":1,"difficulty":{"score":1072,"nodes":10,"branchPoints":1,"candidateCells":12,"zeroLines":4,"logicSteps":12,"globalSteps":0,"techniques":{"quota-empty":8,"quota-fill":4},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-049","index":49,"chapter":3,"title":"旅途营地 049","focus":"自由复习"},{"size":5,"trees":[1,3,5,6,8,17],"rows":[3,0,2,0,1],"cols":[1,1,2,1,1],"seed":61408320,"solution":[0,2,4,11,13,22],"signature":"5|1,3,5,6,8,17|3,0,2,0,1|1,1,2,1,1","generationAttempt":4,"difficulty":{"score":1074,"nodes":6,"branchPoints":0,"candidateCells":12,"zeroLines":2,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-050","index":50,"chapter":3,"title":"旅途营地 050","focus":"自由复习"},{"size":5,"trees":[5,6,11,19,20,24],"rows":[1,1,2,0,2],"cols":[2,1,1,1,1],"seed":61408359,"solution":[0,7,10,14,21,23],"signature":"5|0,1,17,18,20,23|1,1,1,1,2|2,0,2,1,1","generationAttempt":1,"difficulty":{"score":1076,"nodes":6,"branchPoints":0,"candidateCells":11,"zeroLines":1,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-051","index":51,"chapter":3,"title":"旅途营地 051","focus":"自由复习"},{"size":5,"trees":[2,5,10,13,21,23],"rows":[2,0,2,0,2],"cols":[2,1,0,1,2],"seed":61408026,"solution":[0,3,11,14,20,24],"signature":"5|1,2,9,10,17,19|2,1,0,1,2|2,0,2,0,2","generationAttempt":2,"difficulty":{"score":1078,"nodes":6,"branchPoints":0,"candidateCells":15,"zeroLines":3,"logicSteps":12,"globalSteps":0,"techniques":{"quota-fill":6,"quota-empty":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-052","index":52,"chapter":3,"title":"旅途营地 052","focus":"自由复习"},{"size":5,"trees":[4,5,7,13,15,18],"rows":[2,1,1,0,2],"cols":[2,0,2,1,1],"seed":61408641,"solution":[0,2,9,12,20,23],"signature":"5|0,7,8,11,21,23|1,1,2,0,2|2,1,1,0,2","generationAttempt":1,"difficulty":{"score":1080,"nodes":6,"branchPoints":0,"candidateCells":14,"zeroLines":2,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-053","index":53,"chapter":3,"title":"旅途营地 053","focus":"自由复习"},{"size":5,"trees":[1,9,11,21,22,24],"rows":[1,1,1,2,1],"cols":[3,0,1,1,1],"seed":61408578,"solution":[0,8,10,17,19,20],"signature":"5|0,2,3,13,15,23|1,2,1,1,1|1,1,1,0,3","generationAttempt":1,"difficulty":{"score":1082,"nodes":6,"branchPoints":0,"candidateCells":13,"zeroLines":1,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-054","index":54,"chapter":3,"title":"旅途营地 054","focus":"自由复习"},{"size":5,"trees":[2,9,10,13,17,19],"rows":[1,2,1,1,1],"cols":[1,1,1,0,3],"seed":61408494,"solution":[4,5,7,14,16,24],"signature":"5|1,3,7,10,13,22|3,0,1,1,1|1,2,1,1,1","generationAttempt":2,"difficulty":{"score":1085,"nodes":6,"branchPoints":0,"candidateCells":14,"zeroLines":1,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-055","index":55,"chapter":3,"title":"旅途营地 055","focus":"自由复习"},{"size":5,"trees":[2,7,16,18,19],"rows":[1,1,1,2,0],"cols":[1,1,1,1,1],"seed":61408604,"solution":[3,6,14,15,17],"signature":"5|1,6,13,14,16|1,1,1,1,1|0,2,1,1,1","generationAttempt":1,"difficulty":{"score":1092,"nodes":8,"branchPoints":1,"candidateCells":13,"zeroLines":1,"logicSteps":5,"globalSteps":0,"techniques":{"quota-fill":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":5,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-056","index":56,"chapter":3,"title":"旅途营地 056","focus":"自由复习"},{"size":5,"trees":[3,6,7,8,17,22],"rows":[2,1,1,1,1],"cols":[1,1,1,2,1],"seed":61408440,"solution":[2,4,5,13,16,23],"signature":"5|1,6,7,8,17,22|2,1,1,1,1|1,2,1,1,1","generationAttempt":1,"difficulty":{"score":1098,"nodes":7,"branchPoints":1,"candidateCells":12,"zeroLines":0,"logicSteps":11,"globalSteps":0,"techniques":{"quota-fill":6,"quota-empty":5},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-057","index":57,"chapter":3,"title":"旅途营地 057","focus":"自由复习"},{"size":5,"trees":[3,5,6,9,17,23],"rows":[2,1,1,1,1],"cols":[1,1,1,0,3],"seed":61408125,"solution":[0,4,7,14,16,24],"signature":"5|1,5,8,9,17,21|2,1,1,1,1|3,0,1,1,1","generationAttempt":1,"difficulty":{"score":1113,"nodes":8,"branchPoints":2,"candidateCells":14,"zeroLines":1,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-058","index":58,"chapter":3,"title":"旅途营地 058","focus":"自由复习"},{"size":5,"trees":[7,8,9,11,18,20],"rows":[2,0,2,0,2],"cols":[1,1,1,2,1],"seed":61408461,"solution":[2,4,10,13,21,23],"signature":"5|0,7,13,16,18,23|1,1,1,2,1|2,0,2,0,2","generationAttempt":7,"difficulty":{"score":1260,"nodes":6,"branchPoints":0,"candidateCells":14,"zeroLines":2,"logicSteps":15,"globalSteps":1,"techniques":{"quota-fill":5,"quota-empty":10,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":0},"id":"replay-059","index":59,"chapter":3,"title":"旅途营地 059","focus":"自由复习"},{"size":5,"trees":[1,8,11,16,19,21],"rows":[2,0,1,1,2],"cols":[3,0,1,1,1],"seed":61408269,"solution":[0,3,10,17,20,24],"signature":"5|1,6,9,11,18,21|2,1,1,0,2|3,0,1,1,1","generationAttempt":1,"difficulty":{"score":1708,"nodes":17,"branchPoints":5,"candidateCells":16,"zeroLines":2,"logicSteps":12,"globalSteps":3,"techniques":{"quota-empty":6,"no-tree":2,"global":3,"quota-fill":4},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":6,"matchingRejectedLayouts":0},"id":"replay-060","index":60,"chapter":3,"title":"旅途营地 060","focus":"自由复习"},{"size":6,"trees":[5,6,10,15,17,18],"rows":[0,3,0,3,0,0],"cols":[0,2,0,2,0,2],"seed":61509029,"solution":[7,9,11,19,21,23],"signature":"6|0,2,7,14,31,33|2,0,2,0,2,0|0,3,0,3,0,0","generationAttempt":1,"difficulty":{"score":2051,"nodes":7,"branchPoints":0,"candidateCells":12,"zeroLines":7,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-061","index":61,"chapter":5,"title":"旅途营地 061","focus":"自由复习"},{"size":6,"trees":[3,14,17,29,31,33],"rows":[1,0,0,2,0,3],"cols":[1,0,3,0,0,2],"seed":61513004,"solution":[2,20,23,30,32,35],"signature":"6|1,3,11,20,23,33|3,0,2,0,0,1|1,0,3,0,0,2","generationAttempt":1,"difficulty":{"score":2071,"nodes":7,"branchPoints":0,"candidateCells":17,"zeroLines":6,"logicSteps":16,"globalSteps":0,"techniques":{"quota-fill":6,"quota-empty":10},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-062","index":62,"chapter":5,"title":"旅途营地 062","focus":"自由复习"},{"size":6,"trees":[2,4,6,11,14,24],"rows":[1,1,2,1,0,1],"cols":[2,0,2,0,0,2],"seed":61511045,"solution":[5,8,12,17,20,30],"signature":"6|1,3,6,11,15,29|1,1,2,1,0,1|2,0,0,2,0,2","generationAttempt":1,"difficulty":{"score":2075,"nodes":7,"branchPoints":0,"candidateCells":15,"zeroLines":4,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-063","index":63,"chapter":5,"title":"旅途营地 063","focus":"自由复习"},{"size":6,"trees":[2,6,10,18,23,35],"rows":[2,1,0,2,0,1],"cols":[1,1,1,0,3,0],"seed":61509695,"solution":[0,4,8,19,22,34],"signature":"6|0,12,17,25,29,33|1,0,2,0,1,2|0,3,0,1,1,1","generationAttempt":1,"difficulty":{"score":2078,"nodes":7,"branchPoints":0,"candidateCells":16,"zeroLines":4,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-064","index":64,"chapter":5,"title":"旅途营地 064","focus":"自由复习"},{"size":6,"trees":[1,8,11,23,26,31],"rows":[1,1,1,0,1,2],"cols":[2,0,1,1,0,2],"seed":61511708,"solution":[0,9,17,29,30,32],"signature":"6|1,3,19,22,24,29|2,0,1,1,0,2|1,1,1,0,1,2","generationAttempt":1,"difficulty":{"score":2080,"nodes":7,"branchPoints":0,"candidateCells":15,"zeroLines":3,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-065","index":65,"chapter":5,"title":"旅途营地 065","focus":"自由复习"},{"size":6,"trees":[4,9,14,19,24,29,31,34],"rows":[0,2,0,3,0,3],"cols":[2,0,3,0,1,2],"seed":61513699,"solution":[8,10,18,20,23,30,32,35],"signature":"6|1,4,6,11,13,20,27,34|3,0,3,0,2,0|2,0,3,0,1,2","generationAttempt":1,"difficulty":{"score":2082,"nodes":7,"branchPoints":0,"candidateCells":15,"zeroLines":5,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-066","index":66,"chapter":5,"title":"旅途营地 066","focus":"自由复习"},{"size":6,"trees":[1,4,8,10,23,30,32],"rows":[2,0,2,0,3,0],"cols":[2,0,2,1,1,1],"seed":61513254,"solution":[0,3,14,16,24,26,29],"signature":"6|0,11,12,16,28,29,32|2,0,2,1,1,1|0,3,0,2,0,2","generationAttempt":1,"difficulty":{"score":2084,"nodes":7,"branchPoints":0,"candidateCells":16,"zeroLines":4,"logicSteps":7,"globalSteps":0,"techniques":{"quota-fill":7},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":7,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-067","index":67,"chapter":5,"title":"旅途营地 067","focus":"自由复习"},{"size":6,"trees":[5,6,8,14,23,25],"rows":[0,2,1,2,1,0],"cols":[2,0,1,1,1,1],"seed":61513892,"solution":[9,11,12,20,22,24],"signature":"6|0,3,19,20,28,31|1,1,1,1,0,2|0,2,1,2,1,0","generationAttempt":2,"difficulty":{"score":2086,"nodes":7,"branchPoints":0,"candidateCells":17,"zeroLines":3,"logicSteps":7,"globalSteps":0,"techniques":{"quota-empty":1,"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-068","index":68,"chapter":5,"title":"旅途营地 068","focus":"自由复习"},{"size":6,"trees":[1,3,19,20,23,28,29],"rows":[2,0,2,0,2,1],"cols":[1,1,2,1,0,2],"seed":61510461,"solution":[0,2,14,17,25,27,35],"signature":"6|1,2,7,17,20,26,29|2,0,1,2,1,1|1,2,0,2,0,2","generationAttempt":1,"difficulty":{"score":2089,"nodes":7,"branchPoints":0,"candidateCells":16,"zeroLines":3,"logicSteps":19,"globalSteps":0,"techniques":{"quota-fill":7,"quota-empty":12},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":7,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-069","index":69,"chapter":5,"title":"旅途营地 069","focus":"自由复习"},{"size":6,"trees":[0,4,11,25,28,32],"rows":[2,0,1,1,1,1],"cols":[0,3,0,2,0,1],"seed":61513274,"solution":[1,3,17,19,27,31],"signature":"6|0,10,17,24,28,31|0,3,0,2,0,1|2,0,1,1,1,1","generationAttempt":1,"difficulty":{"score":2091,"nodes":9,"branchPoints":1,"candidateCells":15,"zeroLines":4,"logicSteps":26,"globalSteps":0,"techniques":{"quota-fill":6,"quota-empty":20},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-070","index":70,"chapter":5,"title":"旅途营地 070","focus":"自由复习"},{"size":6,"trees":[2,6,10,13,17,26,27],"rows":[2,1,2,0,2,0],"cols":[2,1,1,0,3,0],"seed":61512753,"solution":[0,4,8,12,16,25,28],"signature":"6|1,8,12,16,22,25,32|2,1,1,0,3,0|2,1,2,0,2,0","generationAttempt":1,"difficulty":{"score":2093,"nodes":7,"branchPoints":0,"candidateCells":19,"zeroLines":4,"logicSteps":7,"globalSteps":0,"techniques":{"quota-fill":7},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":7,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-071","index":71,"chapter":5,"title":"旅途营地 071","focus":"自由复习"},{"size":6,"trees":[11,12,14,17,21,24,30,35],"rows":[1,2,0,3,0,2],"cols":[2,1,2,0,1,2],"seed":61512568,"solution":[5,6,8,18,20,23,31,34],"signature":"6|0,1,3,15,20,30,33,34|2,1,2,0,1,2|2,0,3,0,2,1","generationAttempt":1,"difficulty":{"score":2095,"nodes":7,"branchPoints":0,"candidateCells":16,"zeroLines":3,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-072","index":72,"chapter":5,"title":"旅途营地 072","focus":"自由复习"},{"size":6,"trees":[3,4,13,23,26,28,31],"rows":[1,1,1,1,2,1],"cols":[1,1,0,2,0,3],"seed":61512180,"solution":[5,9,17,19,27,29,30],"signature":"6|1,2,16,18,25,27,34|1,1,1,1,2,1|3,0,2,0,1,1","generationAttempt":1,"difficulty":{"score":2097,"nodes":7,"branchPoints":0,"candidateCells":17,"zeroLines":2,"logicSteps":7,"globalSteps":0,"techniques":{"quota-fill":7},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":7,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-073","index":73,"chapter":5,"title":"旅途营地 073","focus":"自由复习"},{"size":6,"trees":[7,8,11,13,23,24,26,35],"rows":[2,0,3,0,0,3],"cols":[2,1,2,0,1,2],"seed":61512562,"solution":[1,5,12,14,17,30,32,34],"signature":"6|0,2,4,19,22,27,28,31|2,1,0,2,1,2|3,0,0,3,0,2","generationAttempt":1,"difficulty":{"score":2099,"nodes":7,"branchPoints":0,"candidateCells":19,"zeroLines":4,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-074","index":74,"chapter":5,"title":"旅途营地 074","focus":"自由复习"},{"size":6,"trees":[8,11,13,18,23,27,32,35],"rows":[1,2,1,2,0,2],"cols":[0,3,0,2,1,2],"seed":61511668,"solution":[5,7,9,17,19,21,31,34],"signature":"6|0,2,4,13,18,22,27,32|2,1,2,0,3,0|2,0,2,1,2,1","generationAttempt":2,"difficulty":{"score":2101,"nodes":7,"branchPoints":0,"candidateCells":18,"zeroLines":3,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-075","index":75,"chapter":5,"title":"旅途营地 075","focus":"自由复习"},{"size":6,"trees":[0,2,11,13,23,27,28,33],"rows":[3,0,2,1,1,1],"cols":[1,1,1,2,0,3],"seed":61511440,"solution":[1,3,5,12,17,21,29,32],"signature":"6|0,2,11,13,23,27,28,33|3,0,2,1,1,1|1,1,1,2,0,3","generationAttempt":2,"difficulty":{"score":2103,"nodes":7,"branchPoints":0,"candidateCells":17,"zeroLines":2,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-076","index":76,"chapter":5,"title":"旅途营地 076","focus":"自由复习"},{"size":6,"trees":[1,3,7,8,17,28,29,30],"rows":[3,0,1,1,1,2],"cols":[1,2,1,1,1,2],"seed":61512181,"solution":[0,2,4,13,23,27,31,35],"signature":"6|0,10,11,16,23,25,31,33|1,2,1,1,1,2|2,1,1,1,0,3","generationAttempt":1,"difficulty":{"score":2105,"nodes":7,"branchPoints":0,"candidateCells":16,"zeroLines":1,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-077","index":77,"chapter":5,"title":"旅途营地 077","focus":"自由复习"},{"size":6,"trees":[0,3,8,10,22,24,34,35],"rows":[2,1,2,0,2,1],"cols":[1,1,2,1,2,1],"seed":61509058,"solution":[2,4,6,14,16,25,29,33],"signature":"6|0,1,11,13,25,27,32,35|1,2,0,2,1,2|1,2,1,2,1,1","generationAttempt":1,"difficulty":{"score":2108,"nodes":7,"branchPoints":0,"candidateCells":17,"zeroLines":1,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-078","index":78,"chapter":5,"title":"旅途营地 078","focus":"自由复习"},{"size":6,"trees":[1,8,16,18,20,28,31],"rows":[2,1,0,2,1,1],"cols":[2,1,1,1,1,1],"seed":61508844,"solution":[0,2,10,19,21,29,30],"signature":"6|1,10,12,14,22,26,31|1,1,2,0,1,2|2,1,1,1,1,1","generationAttempt":1,"difficulty":{"score":2111,"nodes":7,"branchPoints":0,"candidateCells":20,"zeroLines":1,"logicSteps":7,"globalSteps":0,"techniques":{"quota-fill":7},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":7,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-079","index":79,"chapter":5,"title":"旅途营地 079","focus":"自由复习"},{"size":6,"trees":[0,8,11,12,17,25,29],"rows":[2,1,1,1,1,1],"cols":[0,2,1,1,0,3],"seed":61509618,"solution":[1,5,9,13,23,26,35],"signature":"6|0,2,10,13,31,32,34|0,2,1,1,0,3|2,1,1,1,1,1","generationAttempt":2,"difficulty":{"score":2114,"nodes":8,"branchPoints":1,"candidateCells":18,"zeroLines":2,"logicSteps":7,"globalSteps":0,"techniques":{"quota-fill":7},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":7,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-080","index":80,"chapter":5,"title":"旅途营地 080","focus":"自由复习"},{"size":6,"trees":[7,9,11,17,25,32],"rows":[1,2,1,1,0,1],"cols":[1,1,1,1,1,1],"seed":61510289,"solution":[5,6,8,16,19,33],"signature":"6|1,2,13,23,25,28|1,1,1,1,1,1|1,2,1,1,0,1","generationAttempt":1,"difficulty":{"score":2118,"nodes":9,"branchPoints":2,"candidateCells":15,"zeroLines":1,"logicSteps":11,"globalSteps":0,"techniques":{"quota-empty":5,"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-081","index":81,"chapter":5,"title":"旅途营地 081","focus":"自由复习"},{"size":6,"trees":[7,15,17,21,27,30,34],"rows":[0,2,1,1,2,1],"cols":[2,0,2,0,1,2],"seed":61513680,"solution":[6,11,14,22,24,26,35],"signature":"6|0,10,19,20,21,24,33|2,0,2,0,1,2|1,2,1,1,2,0","generationAttempt":1,"difficulty":{"score":2122,"nodes":10,"branchPoints":2,"candidateCells":17,"zeroLines":3,"logicSteps":26,"globalSteps":0,"techniques":{"quota-fill":6,"quota-empty":17,"no-tree":1,"separation":1,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":4,"quotaOnlyRemainingTents":3,"matchingRejectedLayouts":0},"id":"replay-082","index":82,"chapter":5,"title":"旅途营地 082","focus":"自由复习"},{"size":6,"trees":[6,8,13,17,21,22,24,32],"rows":[2,1,2,0,2,1],"cols":[3,0,2,1,1,1],"seed":61511386,"solution":[0,2,11,12,15,26,28,30],"signature":"6|1,4,8,13,17,21,27,32|3,0,2,1,1,1|2,1,2,0,2,1","generationAttempt":1,"difficulty":{"score":2128,"nodes":9,"branchPoints":1,"candidateCells":20,"zeroLines":2,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-083","index":83,"chapter":5,"title":"旅途营地 083","focus":"自由复习"},{"size":6,"trees":[2,6,21,22,24,26],"rows":[1,1,1,0,1,2],"cols":[1,1,1,2,1,0],"seed":61510451,"solution":[3,7,15,28,30,32],"signature":"6|1,4,12,16,21,27|1,1,1,2,1,0|1,1,1,0,1,2","generationAttempt":1,"difficulty":{"score":2136,"nodes":13,"branchPoints":3,"candidateCells":16,"zeroLines":2,"logicSteps":6,"globalSteps":0,"techniques":{"quota-fill":6},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-084","index":84,"chapter":5,"title":"旅途营地 084","focus":"自由复习"},{"size":6,"trees":[1,3,6,8,15,23,24,32],"rows":[2,0,3,0,2,1],"cols":[2,1,2,1,1,1],"seed":61511389,"solution":[0,2,12,14,16,25,29,33],"signature":"6|1,3,6,8,15,23,24,32|2,0,3,0,2,1|2,1,2,1,1,1","generationAttempt":2,"difficulty":{"score":2146,"nodes":15,"branchPoints":2,"candidateCells":18,"zeroLines":2,"logicSteps":17,"globalSteps":0,"techniques":{"quota-empty":9,"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-085","index":85,"chapter":5,"title":"旅途营地 085","focus":"自由复习"},{"size":6,"trees":[2,6,8,11,16,18,20,28],"rows":[2,1,1,1,2,1],"cols":[2,1,1,1,2,1],"seed":61512559,"solution":[1,5,9,12,22,24,26,34],"signature":"6|1,3,12,13,15,26,28,31|2,1,1,1,2,1|2,1,1,1,2,1","generationAttempt":1,"difficulty":{"score":2181,"nodes":14,"branchPoints":4,"candidateCells":19,"zeroLines":0,"logicSteps":11,"globalSteps":0,"techniques":{"quota-fill":8,"quota-empty":3},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-086","index":86,"chapter":5,"title":"旅途营地 086","focus":"自由复习"},{"size":6,"trees":[1,5,11,12,16,20,24,35],"rows":[1,1,2,1,2,1],"cols":[2,1,1,1,1,2],"seed":61513891,"solution":[4,7,15,17,18,26,29,30],"signature":"6|0,1,5,8,21,24,32,34|2,1,1,1,1,2|1,1,2,1,2,1","generationAttempt":1,"difficulty":{"score":2229,"nodes":20,"branchPoints":7,"candidateCells":19,"zeroLines":0,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-087","index":87,"chapter":5,"title":"旅途营地 087","focus":"自由复习"},{"size":6,"trees":[0,8,10,14,18,21,24,28],"rows":[2,1,1,1,2,1],"cols":[2,1,1,2,1,1],"seed":61511827,"solution":[2,4,6,15,19,27,29,30],"signature":"6|0,3,4,13,14,21,25,28|2,1,1,2,1,1|2,1,1,1,2,1","generationAttempt":1,"difficulty":{"score":2313,"nodes":8,"branchPoints":1,"candidateCells":19,"zeroLines":0,"logicSteps":17,"globalSteps":1,"techniques":{"no-tree":9,"global":1,"quota-fill":8},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":8,"matchingRejectedLayouts":0},"id":"replay-088","index":88,"chapter":5,"title":"旅途营地 088","focus":"自由复习"},{"size":6,"trees":[2,3,13,15,24,28,33],"rows":[2,0,2,1,0,2],"cols":[2,1,1,0,3,0],"seed":61513137,"solution":[1,4,12,14,22,30,34],"signature":"6|1,9,17,18,21,23,25|2,1,1,0,3,0|2,0,1,2,0,2","generationAttempt":1,"difficulty":{"score":2394,"nodes":12,"branchPoints":2,"candidateCells":18,"zeroLines":4,"logicSteps":25,"globalSteps":1,"techniques":{"quota-fill":6,"quota-empty":18,"no-tree":1,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":2,"quotaOnlyRemainingTents":5,"matchingRejectedLayouts":1},"id":"replay-089","index":89,"chapter":5,"title":"旅途营地 089","focus":"自由复习"},{"size":6,"trees":[3,6,11,13,15,24,26,34],"rows":[2,0,3,0,1,2],"cols":[2,0,2,1,1,2],"seed":61512370,"solution":[2,5,12,14,16,27,30,35],"signature":"6|1,11,12,14,22,26,31,34|2,1,1,2,0,2|2,0,3,0,1,2","generationAttempt":1,"difficulty":{"score":3049,"nodes":34,"branchPoints":6,"candidateCells":22,"zeroLines":3,"logicSteps":21,"globalSteps":4,"techniques":{"quota-empty":14,"no-tree":1,"tree-single":2,"global":4,"quota-fill":4},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":8,"matchingRejectedLayouts":1},"id":"replay-090","index":90,"chapter":5,"title":"旅途营地 090","focus":"自由复习"},{"size":7,"trees":[8,13,14,29,35,37,39,43],"rows":[0,3,0,0,2,1,2],"cols":[3,0,3,0,0,2,0],"seed":61610397,"solution":[7,9,12,28,30,40,42,44],"signature":"7|1,19,33,36,39,41,44,47|0,2,0,0,3,0,3|0,3,0,0,2,1,2","generationAttempt":2,"difficulty":{"score":3083,"nodes":8,"branchPoints":0,"candidateCells":18,"zeroLines":7,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-091","index":91,"chapter":6,"title":"旅途营地 091","focus":"自由复习"},{"size":7,"trees":[4,7,12,21,25,43,45,48],"rows":[2,1,2,0,0,1,2],"cols":[3,0,0,1,2,0,2],"seed":61609863,"solution":[0,3,13,14,18,41,42,46],"signature":"7|0,12,17,20,21,35,45,47|2,0,2,1,0,0,3|2,1,0,0,2,1,2","generationAttempt":2,"difficulty":{"score":3102,"nodes":8,"branchPoints":0,"candidateCells":21,"zeroLines":5,"logicSteps":31,"globalSteps":0,"techniques":{"quota-fill":8,"quota-empty":23},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-092","index":92,"chapter":6,"title":"旅途营地 092","focus":"自由复习"},{"size":7,"trees":[5,8,11,19,35,39,45,48],"rows":[1,1,2,0,1,2,1],"cols":[1,1,0,0,4,0,2],"seed":61610496,"solution":[4,7,18,20,32,36,41,46],"signature":"7|0,11,13,15,19,21,40,43|2,0,4,0,0,1,1|1,2,1,0,2,1,1","generationAttempt":1,"difficulty":{"score":3107,"nodes":8,"branchPoints":0,"candidateCells":21,"zeroLines":4,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-093","index":93,"chapter":6,"title":"旅途营地 093","focus":"自由复习"},{"size":7,"trees":[4,9,13,17,19,23,42,45,47],"rows":[2,1,0,3,0,0,3],"cols":[0,3,0,2,1,1,2],"seed":61608544,"solution":[3,6,8,22,24,26,43,46,48],"signature":"7|0,17,19,21,25,34,35,39,47|0,3,0,2,1,1,2|3,0,0,3,0,1,2","generationAttempt":2,"difficulty":{"score":3111,"nodes":8,"branchPoints":0,"candidateCells":22,"zeroLines":5,"logicSteps":9,"globalSteps":0,"techniques":{"quota-fill":9},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":9,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-094","index":94,"chapter":6,"title":"旅途营地 094","focus":"自由复习"},{"size":7,"trees":[0,6,13,15,19,31,40,44],"rows":[2,0,3,0,1,1,1],"cols":[0,1,2,1,1,1,2],"seed":61609254,"solution":[1,5,16,18,20,30,41,45],"signature":"7|0,1,9,12,25,34,37,42|2,1,1,1,2,1,0|2,0,3,0,1,1,1","generationAttempt":2,"difficulty":{"score":3115,"nodes":8,"branchPoints":0,"candidateCells":22,"zeroLines":3,"logicSteps":29,"globalSteps":0,"techniques":{"quota-fill":8,"quota-empty":21},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-095","index":95,"chapter":6,"title":"旅途营地 095","focus":"自由复习"},{"size":7,"trees":[7,12,16,19,22,26,40,44],"rows":[2,1,1,0,2,0,2],"cols":[1,1,1,1,1,3,0],"seed":61611321,"solution":[0,5,9,18,29,33,45,47],"signature":"7|1,10,16,20,36,37,38,40|1,1,1,1,1,3,0|2,1,1,0,2,0,2","generationAttempt":1,"difficulty":{"score":3118,"nodes":8,"branchPoints":0,"candidateCells":23,"zeroLines":3,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-096","index":96,"chapter":6,"title":"旅途营地 096","focus":"自由复习"},{"size":7,"trees":[9,12,27,28,30,35,37,41],"rows":[1,1,0,1,2,0,3],"cols":[2,0,1,2,0,1,2],"seed":61611582,"solution":[5,10,21,31,34,42,44,48],"signature":"7|1,2,15,16,19,40,43,45|2,0,1,2,0,1,2|3,0,2,1,0,1,1","generationAttempt":1,"difficulty":{"score":3121,"nodes":9,"branchPoints":1,"candidateCells":21,"zeroLines":4,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-097","index":97,"chapter":6,"title":"旅途营地 097","focus":"自由复习"},{"size":7,"trees":[0,1,3,6,27,29,31,35,39,41],"rows":[2,2,0,1,2,1,2],"cols":[3,0,1,2,1,0,3],"seed":61610639,"solution":[2,4,7,13,24,28,34,38,42,48],"signature":"7|0,1,3,6,27,29,31,35,39,41|2,2,0,1,2,1,2|3,0,1,2,1,0,3","generationAttempt":1,"difficulty":{"score":3124,"nodes":8,"branchPoints":0,"candidateCells":21,"zeroLines":3,"logicSteps":11,"globalSteps":0,"techniques":{"quota-fill":10,"quota-empty":1},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-098","index":98,"chapter":6,"title":"旅途营地 098","focus":"自由复习"},{"size":7,"trees":[0,2,8,20,21,25,32,40,42,47],"rows":[2,1,2,0,3,0,2],"cols":[1,3,0,2,2,1,1],"seed":61610321,"solution":[1,3,13,15,18,28,31,33,43,46],"signature":"7|0,2,8,20,21,25,32,40,42,47|2,1,2,0,3,0,2|1,3,0,2,2,1,1","generationAttempt":2,"difficulty":{"score":3127,"nodes":8,"branchPoints":0,"candidateCells":22,"zeroLines":3,"logicSteps":10,"globalSteps":0,"techniques":{"quota-fill":10},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-099","index":99,"chapter":6,"title":"旅途营地 099","focus":"自由复习"},{"size":7,"trees":[0,2,4,22,27,30,37,40,43,46],"rows":[3,0,0,3,0,2,2],"cols":[2,1,2,1,1,2,1],"seed":61609703,"solution":[1,3,5,21,23,26,39,41,42,44],"signature":"7|0,10,13,14,18,19,28,34,40,45|2,1,2,1,1,2,1|3,0,0,3,0,2,2","generationAttempt":1,"difficulty":{"score":3130,"nodes":8,"branchPoints":0,"candidateCells":23,"zeroLines":3,"logicSteps":10,"globalSteps":0,"techniques":{"quota-fill":10},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-100","index":100,"chapter":6,"title":"旅途营地 100","focus":"自由复习"},{"size":7,"trees":[7,9,18,19,24,35,36,48],"rows":[0,2,1,2,1,1,1],"cols":[1,2,1,1,1,0,2],"seed":61610577,"solution":[8,10,20,23,25,28,41,43],"signature":"7|0,11,18,24,33,36,43,47|2,0,1,1,1,2,1|1,1,1,2,1,2,0","generationAttempt":3,"difficulty":{"score":3133,"nodes":10,"branchPoints":1,"candidateCells":21,"zeroLines":2,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-101","index":101,"chapter":6,"title":"旅途营地 101","focus":"自由复习"},{"size":7,"trees":[0,6,10,12,15,30,33,43,46],"rows":[0,4,0,1,2,1,1],"cols":[1,2,1,2,1,0,2],"seed":61611247,"solution":[7,9,11,13,22,31,34,36,45],"signature":"7|0,6,10,12,15,30,33,43,46|0,4,0,1,2,1,1|1,2,1,2,1,0,2","generationAttempt":2,"difficulty":{"score":3136,"nodes":8,"branchPoints":0,"candidateCells":27,"zeroLines":3,"logicSteps":17,"globalSteps":0,"techniques":{"quota-fill":9,"quota-empty":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":9,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-102","index":102,"chapter":6,"title":"旅途营地 102","focus":"自由复习"},{"size":7,"trees":[2,9,11,14,18,26,34,39],"rows":[1,2,1,2,0,1,1],"cols":[0,2,0,1,2,1,2],"seed":61611369,"solution":[1,10,12,15,25,27,41,46],"signature":"7|11,20,26,28,32,37,39,44|1,1,0,2,1,2,1|0,2,0,1,2,1,2","generationAttempt":2,"difficulty":{"score":3139,"nodes":11,"branchPoints":2,"candidateCells":20,"zeroLines":3,"logicSteps":17,"globalSteps":0,"techniques":{"quota-fill":8,"quota-empty":9},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-103","index":103,"chapter":6,"title":"旅途营地 103","focus":"自由复习"},{"size":7,"trees":[4,7,11,14,19,28,31,38,44,48],"rows":[2,1,2,0,2,0,3],"cols":[1,3,0,2,1,2,1],"seed":61610135,"solution":[0,5,10,15,20,29,32,43,45,47],"signature":"7|0,11,19,20,22,23,28,44,46,47|1,2,1,2,0,3,1|3,0,2,0,2,1,2","generationAttempt":1,"difficulty":{"score":3143,"nodes":10,"branchPoints":1,"candidateCells":22,"zeroLines":3,"logicSteps":17,"globalSteps":0,"techniques":{"quota-fill":10,"quota-empty":7},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-104","index":104,"chapter":6,"title":"旅途营地 104","focus":"自由复习"},{"size":7,"trees":[0,3,8,11,19,22,31,37,42,48],"rows":[1,2,2,1,1,2,1],"cols":[3,0,3,0,2,0,2],"seed":61609082,"solution":[4,7,9,18,20,21,30,35,41,44],"signature":"7|0,11,19,23,27,29,38,40,42,48|2,0,2,0,3,0,3|1,2,1,1,2,2,1","generationAttempt":2,"difficulty":{"score":3147,"nodes":9,"branchPoints":1,"candidateCells":24,"zeroLines":3,"logicSteps":22,"globalSteps":0,"techniques":{"quota-fill":10,"quota-empty":12},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-105","index":105,"chapter":6,"title":"旅途营地 105","focus":"自由复习"},{"size":7,"trees":[0,4,12,23,26,31,33,36,41,44],"rows":[3,0,1,0,3,1,2],"cols":[1,1,1,2,1,2,2],"seed":61610792,"solution":[1,3,5,19,30,32,34,35,45,48],"signature":"7|0,12,17,20,25,28,36,38,39,47|1,1,1,2,1,2,2|3,0,1,0,3,1,2","generationAttempt":3,"difficulty":{"score":3151,"nodes":10,"branchPoints":1,"candidateCells":23,"zeroLines":2,"logicSteps":10,"globalSteps":0,"techniques":{"quota-fill":10},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-106","index":106,"chapter":6,"title":"旅途营地 106","focus":"自由复习"},{"size":7,"trees":[0,5,10,14,26,28,29,33,46,48],"rows":[1,2,1,1,2,1,2],"cols":[3,0,2,1,0,2,2],"seed":61613474,"solution":[6,7,9,19,21,30,34,35,45,47],"signature":"7|0,2,15,19,20,22,34,38,43,48|2,1,2,1,1,2,1|2,2,0,1,2,0,3","generationAttempt":1,"difficulty":{"score":3155,"nodes":9,"branchPoints":1,"candidateCells":25,"zeroLines":2,"logicSteps":10,"globalSteps":0,"techniques":{"quota-fill":10},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-107","index":107,"chapter":6,"title":"旅途营地 107","focus":"自由复习"},{"size":7,"trees":[3,5,7,9,25,27,32,38,41,42],"rows":[3,0,2,1,1,3,0],"cols":[2,0,2,1,2,0,3],"seed":61610960,"solution":[2,4,6,14,20,24,34,35,37,39],"signature":"7|0,10,13,18,25,27,35,37,45,47|0,3,1,1,2,0,3|2,0,2,1,2,0,3","generationAttempt":1,"difficulty":{"score":3161,"nodes":14,"branchPoints":2,"candidateCells":23,"zeroLines":4,"logicSteps":21,"globalSteps":0,"techniques":{"quota-empty":11,"quota-fill":10},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-108","index":108,"chapter":6,"title":"旅途营地 108","focus":"自由复习"},{"size":7,"trees":[1,3,12,25,28,29,34,35,40,41],"rows":[1,2,1,2,1,1,2],"cols":[2,1,1,0,3,0,3],"seed":61613246,"solution":[4,8,13,18,21,27,30,39,42,48],"signature":"7|1,2,8,12,17,27,37,41,43,44|3,0,3,0,1,1,2|2,1,1,2,1,2,1","generationAttempt":1,"difficulty":{"score":3167,"nodes":12,"branchPoints":2,"candidateCells":23,"zeroLines":2,"logicSteps":10,"globalSteps":0,"techniques":{"quota-fill":10},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":10,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-109","index":109,"chapter":6,"title":"旅途营地 109","focus":"自由复习"},{"size":7,"trees":[5,19,22,25,33,38,41,43],"rows":[1,0,2,1,1,1,2],"cols":[0,2,0,2,1,0,3],"seed":61608972,"solution":[4,15,20,24,34,36,45,48],"signature":"7|1,10,13,19,22,25,33,47|2,1,1,1,2,0,1|0,2,0,2,1,0,3","generationAttempt":1,"difficulty":{"score":3176,"nodes":17,"branchPoints":4,"candidateCells":22,"zeroLines":4,"logicSteps":25,"globalSteps":0,"techniques":{"quota-empty":17,"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-110","index":110,"chapter":6,"title":"旅途营地 110","focus":"自由复习"},{"size":7,"trees":[8,11,20,24,28,34,35,43],"rows":[1,1,0,1,2,1,2],"cols":[2,1,1,1,1,0,2],"seed":61610580,"solution":[4,7,27,29,31,41,42,44],"signature":"7|1,2,7,12,24,33,44,46|2,1,1,1,1,0,2|2,1,2,1,0,1,1","generationAttempt":1,"difficulty":{"score":3188,"nodes":18,"branchPoints":4,"candidateCells":22,"zeroLines":2,"logicSteps":8,"globalSteps":0,"techniques":{"quota-fill":8},"quotaOnlySolved":true,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":0,"matchingRejectedLayouts":0},"id":"replay-111","index":111,"chapter":6,"title":"旅途营地 111","focus":"自由复习"},{"size":7,"trees":[0,5,7,17,18,28,33,42,46,47],"rows":[2,1,1,2,1,0,3],"cols":[1,3,0,2,1,1,2],"seed":61608854,"solution":[1,6,11,14,24,26,29,43,45,48],"signature":"7|0,1,4,6,23,30,34,35,39,41|1,3,0,2,1,1,2|2,1,1,2,1,0,3","generationAttempt":1,"difficulty":{"score":3203,"nodes":18,"branchPoints":4,"candidateCells":23,"zeroLines":2,"logicSteps":36,"globalSteps":0,"techniques":{"quota-fill":9,"quota-empty":19,"no-tree":7,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":3,"quotaOnlyRemainingTents":7,"matchingRejectedLayouts":0},"id":"replay-112","index":112,"chapter":6,"title":"旅途营地 112","focus":"自由复习"},{"size":7,"trees":[9,14,19,23,24,32,33,44],"rows":[0,2,1,2,1,1,1],"cols":[1,2,0,1,2,0,2],"seed":61609413,"solution":[7,10,20,22,25,34,39,43],"signature":"7|11,15,20,24,25,29,30,46|0,2,1,2,1,1,1|2,0,2,1,0,2,1","generationAttempt":1,"difficulty":{"score":3229,"nodes":14,"branchPoints":1,"candidateCells":22,"zeroLines":3,"logicSteps":39,"globalSteps":0,"techniques":{"quota-fill":7,"quota-empty":31,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":6,"quotaOnlyRemainingTents":2,"matchingRejectedLayouts":1},"id":"replay-113","index":113,"chapter":6,"title":"旅途营地 113","focus":"自由复习"},{"size":7,"trees":[0,5,6,15,20,24,38,40,42,43],"rows":[2,1,2,1,1,1,2],"cols":[2,1,1,2,1,1,2],"seed":61609529,"solution":[1,4,13,14,17,27,31,35,44,47],"signature":"7|0,1,10,12,24,29,34,42,47,48|2,1,1,1,2,1,2|2,1,1,2,1,1,2","generationAttempt":1,"difficulty":{"score":3260,"nodes":13,"branchPoints":1,"candidateCells":24,"zeroLines":0,"logicSteps":37,"globalSteps":0,"techniques":{"quota-fill":9,"quota-empty":27,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":8,"quotaOnlyRemainingTents":2,"matchingRejectedLayouts":1},"id":"replay-114","index":114,"chapter":6,"title":"旅途营地 114","focus":"自由复习"},{"size":7,"trees":[5,8,10,20,24,28,33,43,45],"rows":[0,3,0,2,1,1,2],"cols":[3,0,2,1,0,2,1],"seed":61613722,"solution":[7,9,12,21,27,31,40,42,44],"signature":"7|1,10,12,14,24,29,34,45,47|0,3,0,2,1,1,2|1,2,0,1,2,0,3","generationAttempt":1,"difficulty":{"score":3320,"nodes":20,"branchPoints":6,"candidateCells":28,"zeroLines":4,"logicSteps":38,"globalSteps":0,"techniques":{"quota-empty":29,"quota-fill":8,"tree-single":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":7,"quotaOnlyRemainingTents":2,"matchingRejectedLayouts":1},"id":"replay-115","index":115,"chapter":6,"title":"旅途营地 115","focus":"自由复习"},{"size":7,"trees":[1,4,7,16,18,26,30,35,38,39],"rows":[3,0,3,0,1,2,1],"cols":[1,2,1,3,0,3,0],"seed":61613510,"solution":[0,2,5,15,17,19,31,36,40,45],"signature":"7|1,4,7,16,18,26,30,35,38,39|3,0,3,0,1,2,1|1,2,1,3,0,3,0","generationAttempt":1,"difficulty":{"score":3361,"nodes":15,"branchPoints":3,"candidateCells":25,"zeroLines":4,"logicSteps":35,"globalSteps":1,"techniques":{"quota-empty":23,"no-tree":3,"tree-single":1,"quota-fill":8,"global":1},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":10,"matchingRejectedLayouts":0},"id":"replay-116","index":116,"chapter":6,"title":"旅途营地 116","focus":"自由复习"},{"size":7,"trees":[7,8,11,16,17,21,27,32,44,47],"rows":[1,2,1,1,2,1,2],"cols":[2,2,1,1,1,1,2],"seed":61611869,"solution":[1,10,12,14,23,28,34,39,43,48],"signature":"7|1,3,8,16,20,23,29,32,41,45|2,2,1,1,1,1,2|1,2,1,1,2,1,2","generationAttempt":1,"difficulty":{"score":3420,"nodes":21,"branchPoints":5,"candidateCells":26,"zeroLines":0,"logicSteps":23,"globalSteps":1,"techniques":{"no-tree":13,"global":1,"quota-fill":10},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":10,"matchingRejectedLayouts":0},"id":"replay-117","index":117,"chapter":6,"title":"旅途营地 117","focus":"自由复习"},{"size":7,"trees":[1,7,8,13,20,29,43,46],"rows":[2,1,1,1,1,0,2],"cols":[3,1,1,0,0,2,1],"seed":61613256,"solution":[0,2,12,15,27,28,42,47],"signature":"7|1,2,20,35,36,39,41,43|1,2,0,0,1,1,3|2,1,1,1,1,0,2","generationAttempt":1,"difficulty":{"score":3511,"nodes":14,"branchPoints":3,"candidateCells":18,"zeroLines":3,"logicSteps":36,"globalSteps":2,"techniques":{"quota-empty":22,"no-tree":8,"tree-single":1,"global":2,"quota-fill":5},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":8,"matchingRejectedLayouts":0},"id":"replay-118","index":118,"chapter":6,"title":"旅途营地 118","focus":"自由复习"},{"size":7,"trees":[2,9,12,15,17,22,27,37,45,48],"rows":[2,1,2,1,1,1,2],"cols":[1,2,1,2,1,1,2],"seed":61611473,"solution":[1,5,10,14,20,24,29,41,44,46],"signature":"7|0,3,11,21,26,31,33,36,39,46|2,1,1,1,2,1,2|2,1,1,2,1,2,1","generationAttempt":1,"difficulty":{"score":3637,"nodes":29,"branchPoints":7,"candidateCells":25,"zeroLines":0,"logicSteps":24,"globalSteps":2,"techniques":{"no-tree":14,"global":2,"separation":1,"quota-fill":9},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":0,"quotaOnlyRemainingTents":10,"matchingRejectedLayouts":0},"id":"replay-119","index":119,"chapter":6,"title":"旅途营地 119","focus":"自由复习"},{"size":7,"trees":[7,17,27,29,35,39,45,47],"rows":[1,0,2,0,2,0,3],"cols":[3,0,2,0,1,0,2],"seed":61613268,"solution":[0,16,20,28,32,42,44,48],"signature":"7|1,3,9,13,19,21,31,41|3,0,2,0,2,0,1|2,0,1,0,2,0,3","generationAttempt":1,"difficulty":{"score":5205,"nodes":51,"branchPoints":11,"candidateCells":21,"zeroLines":6,"logicSteps":35,"globalSteps":5,"techniques":{"quota-fill":6,"quota-empty":29,"global":5},"quotaOnlySolved":false,"quotaOnlyTentsPlaced":1,"quotaOnlyRemainingTents":7,"matchingRejectedLayouts":11},"id":"replay-120","index":120,"chapter":6,"title":"旅途营地 120","focus":"自由复习"}].map(freezeLevel));
function findLevel(id) { return LEVELS.concat(REPLAY_LEVELS).find(function(level) { return level.id === id; }) || null; }
function levelsForChapter(id) { return LEVELS.filter(function(level) { return level.chapter === Number(id); }); }

return {CHAPTERS,LEVELS,REPLAY_LEVELS,findLevel,levelsForChapter};
})();
/* src/solver.mjs */
modules[1]=(function(){
/* Independent exhaustive Tents verifier. Does not import the game engine or read answers.
 * Row-mask enumeration + a separate tree-assignment DFS prove tent-layout uniqueness.
 * MIT; cloud-camp-journey contributors, 2026. */
function solve(level, options) {
  options = options || {};
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 2;
  const result = { count: 0, solutions: [], nodes: 0, branchPoints: 0, maxDepth: 0, matchingChecks: 0, matchingRejectedWitnesses: [], exhausted: true, unique: false };
  if (!level || !Array.isArray(level.trees)) return result;
  const n = level.size;
  if (!Number.isInteger(n) || n < 2 || n > 7) return result;
  const trees = new Set(level.trees);
  const board = options.board || Array(n * n).fill(0);
  if (!Array.isArray(board) || board.length !== n * n || Array.from(board).some(function (v, i) { return !Number.isInteger(v) || v < 0 || v > 2 || (trees.has(i) && v !== 0); })) return result;
  if (!Array.isArray(level.rows) || !Array.isArray(level.cols) || level.rows.length !== n || level.cols.length !== n || Array.from(level.rows).some(function(v) { return !Number.isInteger(v) || v < 0 || v > n; }) || Array.from(level.cols).some(function(v) { return !Number.isInteger(v) || v < 0 || v > n; }) || level.rows.reduce(function(a,b) { return a+b; },0) !== trees.size || level.cols.reduce(function(a,b) { return a+b; },0) !== trees.size || trees.size !== level.trees.length || !trees.size || Array.from(level.trees).some(function(i) { return !Number.isInteger(i) || i < 0 || i >= n*n; })) return result;
  function adjacentTree(i) {
    const r = Math.floor(i / n), c = i % n;
    return (r > 0 && trees.has(i-n)) || (r+1 < n && trees.has(i+n)) || (c > 0 && trees.has(i-1)) || (c+1 < n && trees.has(i+1));
  }
  function bits(mask) { let count = 0; while (mask) { count += mask & 1; mask >>>= 1; } return count; }
  const patterns = [];
  for (let r = 0; r < n; r += 1) {
    let allowed = 0, required = 0;
    for (let c = 0; c < n; c += 1) {
      const i = r * n + c;
      if (!trees.has(i) && adjacentTree(i) && board[i] !== 2) allowed |= 1 << c;
      if (board[i] === 1) required |= 1 << c;
    }
    const rowPatterns = [];
    for (let mask = 0; mask < (1 << n); mask += 1) {
      if ((mask & allowed) !== mask || (mask & required) !== required || (mask & (mask << 1)) || bits(mask) !== level.rows[r]) continue;
      rowPatterns.push(mask);
    }
    if (!rowPatterns.length) return result;
    patterns.push(rowPatterns);
  }
  // Exact independent assignment search (not the engine's augmenting-path matcher).
  function hasPerfectAssignment(tents) {
    result.matchingChecks += 1;
    const candidates = level.trees.map(function(tree) {
      const r = Math.floor(tree/n), c = tree%n;
      return tents.filter(function(t) { return Math.abs(Math.floor(t/n)-r)+Math.abs(t%n-c) === 1; });
    }).sort(function(a,b) { return a.length-b.length; });
    const used = new Set();
    function assign(k) {
      if (k === candidates.length) return true;
      for (let p = 0; p < candidates[k].length; p += 1) {
        const t = candidates[k][p];
        if (used.has(t)) continue;
        used.add(t);
        if (assign(k+1)) return true;
        used.delete(t);
      }
      return false;
    }
    return assign(0);
  }
  const remaining = Array.from({ length: n+1 }, function() { return Array(n).fill(0); });
  for (let r = n-1; r >= 0; r -= 1) {
    for (let c = 0; c < n; c += 1) remaining[r][c] = remaining[r+1][c] + (patterns[r].some(function(m) { return (m & (1 << c)) !== 0; }) ? 1 : 0);
  }
  const counts = Array(n).fill(0), selected = Array(n).fill(0);
  function search(row, previous) {
    result.nodes += 1;
    result.maxDepth = Math.max(result.maxDepth, row);
    if (row === n) {
      if (counts.some(function(v,c) { return v !== level.cols[c]; })) return;
      const tents = [];
      for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (selected[r] & (1 << c)) tents.push(r*n+c);
      if (hasPerfectAssignment(tents)) result.solutions.push(tents);
      else if (result.matchingRejectedWitnesses.length < 3) result.matchingRejectedWitnesses.push(tents);
      return;
    }
    let viable = 0;
    for (let p = 0; p < patterns[row].length; p += 1) {
      const mask = patterns[row][p];
      if ((mask & previous) || (mask & (previous << 1)) || (mask & (previous >> 1))) continue;
      let valid = true;
      for (let c = 0; c < n; c += 1) {
        const next = counts[c] + ((mask >> c) & 1);
        if (next > level.cols[c] || next + remaining[row+1][c] < level.cols[c]) valid = false;
      }
      if (!valid) continue;
      viable += 1;
      selected[row] = mask;
      for (let c = 0; c < n; c += 1) counts[c] += (mask >> c) & 1;
      search(row+1, mask);
      for (let c = 0; c < n; c += 1) counts[c] -= (mask >> c) & 1;
      if (result.solutions.length >= limit) { result.exhausted = false; return; }
    }
    if (viable > 1) result.branchPoints += viable - 1;
  }
  search(0,0);
  result.count = result.solutions.length;
  result.unique = limit >= 2 && result.count === 1 && result.exhausted;
  return result;
}

return {solve};
})();
/* src/engine.mjs */
modules[2]=(function(){
/* Rules reimplemented from the MIT cloud-camp reference, 2026.
 * See RULES.md for Simon Tatham Tents attribution and original repository license. */
const {solve} = modules[1];
function orthogonal(size, index) {
  const r = Math.floor(index / size), c = index % size, values = [];
  if (r > 0) values.push(index-size);
  if (c+1 < size) values.push(index+1);
  if (r+1 < size) values.push(index+size);
  if (c > 0) values.push(index-1);
  return values;
}
function touching(size, a, b) { return a !== b && Math.abs(Math.floor(a/size)-Math.floor(b/size)) <= 1 && Math.abs(a%size-b%size) <= 1; }
function validateLevel(level) {
  if (!level || !Number.isInteger(level.size) || level.size < 2 || level.size > 7) return false;
  const n = level.size;
  if (!Array.isArray(level.trees) || !level.trees.length || new Set(level.trees).size !== level.trees.length || Array.from(level.trees).some(function(i) { return !Number.isInteger(i) || i < 0 || i >= n*n; })) return false;
  return [level.rows,level.cols].every(function(line) { return Array.isArray(line) && line.length === n && Array.from(line).every(function(v) { return Number.isInteger(v) && v >= 0 && v <= n; }) && line.reduce(function(a,b) { return a+b; },0) === level.trees.length; });
}
function createBoard(level) {
  if (!validateLevel(level)) throw new TypeError('Invalid camp definition');
  return Array(level.size*level.size).fill(0);
}
function validateBoard(level, board) {
  return validateLevel(level) && Array.isArray(board) && board.length === level.size*level.size && Array.from(board).every(function(v,i) { return Number.isInteger(v) && v >= 0 && v <= 2 && (level.trees.indexOf(i) < 0 || v === 0); });
}
function applyAction(level, board, index, value) {
  if (!validateBoard(level,board)) return { accepted: false, board: board, reason: 'invalid-board' };
  if (!Number.isInteger(index) || index < 0 || index >= board.length || level.trees.indexOf(index) >= 0) return { accepted: false, board: board, reason: 'fixed-or-outside' };
  if (!Number.isInteger(value) || value < 0 || value > 2) return { accepted: false, board: board, reason: 'invalid-value' };
  if (board[index] === value) return { accepted: false, board: board, reason: 'unchanged' };
  const next = board.slice(); next[index] = value;
  return { accepted: true, board: next, reason: null };
}
// Complete bipartite maximum matching with augmenting paths; local adjacency alone is insufficient.
function maximumMatching(level, tents) {
  const validTents = Array.from(new Set(tents)).filter(function(i) { return Number.isInteger(i) && i >= 0 && i < level.size*level.size && level.trees.indexOf(i) < 0; });
  const owners = new Map();
  function augment(tree, seen) {
    const candidates = orthogonal(level.size,tree).filter(function(i) { return validTents.indexOf(i) >= 0; });
    for (let p = 0; p < candidates.length; p += 1) {
      const tent = candidates[p];
      if (seen.has(tent)) continue;
      seen.add(tent);
      if (!owners.has(tent) || augment(owners.get(tent),seen)) { owners.set(tent,tree); return true; }
    }
    return false;
  }
  let size = 0;
  level.trees.forEach(function(tree) { if (augment(tree,new Set())) size += 1; });
  return { size: size, perfect: size === level.trees.length && validTents.length === level.trees.length, pairs: Array.from(owners.entries()).map(function(pair) { return {tree:pair[1],tent:pair[0]}; }) };
}
function analyze(level, board) {
  if (!validateBoard(level,board)) return { solved: false, complete: false, contradiction: true, valid: false, errors: ['营地记录无效，请重新开始。'], conflictCells: [], rows: [], cols: [], tentCount: 0, treeCount: level && level.trees ? level.trees.length : 0, matching: {size:0,perfect:false,pairs:[]} };
  const n = level.size, trees = new Set(level.trees), tents = [], errors = [], conflict = new Set();
  board.forEach(function(v,i) { if (v === 1) tents.push(i); });
  const available = board.map(function(v,i) { return v === 0 && !trees.has(i) && orthogonal(n,i).some(function(t) { return trees.has(t); }) && !tents.some(function(t) { return touching(n,i,t); }); });
  let orphan = false, touchingTents = false;
  tents.forEach(function(i) {
    if (!orthogonal(n,i).some(function(t) { return trees.has(t); })) { orphan = true; conflict.add(i); }
    tents.forEach(function(t) { if (touching(n,i,t)) { touchingTents = true; conflict.add(i); conflict.add(t); } });
  });
  if (orphan) errors.push('帐篷需要在一棵树的上下左右。');
  if (touchingTents) errors.push('两顶帐篷不能相邻，斜角也要留空。');
  function line(axis, lineIndex, target) {
    const cells = [];
    for (let v = 0; v < n; v += 1) cells.push(axis === 'row' ? lineIndex*n+v : v*n+lineIndex);
    const count = cells.filter(function(i) { return board[i] === 1; }).length;
    const possible = cells.filter(function(i) { return available[i]; }).length;
    const over = count > target, impossible = over || count+possible < target;
    if (impossible) {
      errors.push('第'+(lineIndex+1)+(axis === 'row' ? '行' : '列')+(over ? '帐篷超过配额。' : '剩余位置不足，请检查帐篷或标空。'));
      cells.forEach(function(i) { if (board[i]) conflict.add(i); });
    }
    return {target:target,count:count,possible:possible,exact:count === target,over:over,impossible:impossible};
  }
  const rows = level.rows.map(function(v,r) { return line('row',r,v); }), cols = level.cols.map(function(v,c) { return line('col',c,v); });
  const matching = maximumMatching(level,tents);
  // Every placed tent must already be injectively assignable to a distinct tree.
  if (matching.size < tents.length) { errors.push('这些帐篷争用了同一组树，无法一一配对。'); tents.forEach(function(i) { conflict.add(i); }); }
  const futureMatching = maximumMatching(level,tents.concat(available.reduce(function(a,v,i) { if(v) a.push(i); return a; },[])));
  if (futureMatching.size < level.trees.length) errors.push('有一组树已没有足够的可用营位，请检查标空与邻接。');
  const solved = !errors.length && rows.every(function(v) { return v.exact; }) && cols.every(function(v) { return v.exact; }) && matching.perfect;
  return {solved:solved,complete:solved,contradiction:errors.length > 0,valid:true,errors:errors,conflictCells:Array.from(conflict),rows:rows,cols:cols,tentCount:tents.length,treeCount:trees.size,matching:matching,available:available};
}
function isSolved(level,board) { return analyze(level,board).solved; }
function hint(index,value,text,kind) { return {index:index,value:value,text:text,kind:kind}; }
// Fast explainable deductions are also measured when selecting the main route.
function logicalHint(level,board) {
  const state = analyze(level,board), n = level.size, trees = new Set(level.trees);
  if (!state.valid || state.contradiction || state.solved) return null;
  const candidates = [];
  board.forEach(function(v,i) { if (v === 0 && !trees.has(i)) candidates.push(i); });
  // A remaining row/column quota can force actual tent placements.
  for (let axis = 0; axis < 2; axis += 1) {
    const lines = axis === 0 ? state.rows : state.cols;
    for (let p = 0; p < n; p += 1) {
      const possible = candidates.filter(function(i) { return (axis === 0 ? Math.floor(i/n) : i%n) === p && state.available[i]; });
      const remaining = lines[p].target-lines[p].count;
      if (remaining > 0 && remaining === possible.length) return hint(possible[0],1,'第'+(p+1)+(axis === 0 ? '行' : '列')+'还缺 '+remaining+' 顶帐篷，恰好只剩 '+possible.length+' 个可用位置。','quota-fill');
    }
  }
  for (let p = 0; p < candidates.length; p += 1) {
    const i = candidates[p], r = Math.floor(i/n), c = i%n;
    if (state.rows[r].exact) return hint(i,2,'第'+(r+1)+'行的 '+level.rows[r]+' 顶帐篷已经齐了，其余营位可以标空。','quota-empty');
    if (state.cols[c].exact) return hint(i,2,'第'+(c+1)+'列的 '+level.cols[c]+' 顶帐篷已经齐了，其余营位可以标空。','quota-empty');
  }
  for (let p = 0; p < candidates.length; p += 1) {
    const i = candidates[p];
    if (board.some(function(v,t) { return v === 1 && touching(n,i,t); })) return hint(i,2,'这里与已有帐篷相邻（含斜角），需要留出草地。','separation');
    if (!orthogonal(n,i).some(function(t) { return trees.has(t); })) return hint(i,2,'这里的上下左右没有树，不能搭帐篷。','no-tree');
  }
  for (let p = 0; p < level.trees.length; p += 1) {
    const tree = level.trees[p], neighbors = orthogonal(n,tree);
    if (neighbors.some(function(i) { return board[i] === 1; })) continue;
    const spots = neighbors.filter(function(i) { return state.available[i]; });
    if (spots.length === 1) return hint(spots[0],1,'这棵树只剩一个可用的上下左右营位，需要在这里搭帐篷。','tree-single');
  }
  return null;
}
function getHint(level,board) {
  if (!validateBoard(level,board) || isSolved(level,board)) return null;
  const current = solve(level,{board:board,limit:2});
  if (!current.count) {
    const base = solve(level,{limit:2});
    if (!base.count) return null;
    // A correction is labelled as such; it is not disguised as a local deduction.
    for (let i = 0; i < board.length; i += 1) {
      if (!board[i]) continue;
      const expected = base.solutions[0].indexOf(i) >= 0 ? 1 : 2;
      if (board[i] !== expected) return hint(i,0,'当前记录已无合法完成方式。先清除这个'+(board[i] === 1 ? '帐篷' : '标空')+'，再结合行列配额与树帐匹配继续。','correction');
    }
    return null;
  }
  const local = logicalHint(level,board);
  if (local) return local;
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] || level.trees.indexOf(i) >= 0) continue;
    const expected = current.solutions[0].indexOf(i) >= 0 ? 1 : 2;
    const trial = board.slice(); trial[i] = expected === 1 ? 2 : 1;
    if (!solve(level,{board:trial,limit:1}).count) return hint(i,expected,'综合行列配额、帐篷间隔和树帐一一匹配：假设这里'+(expected === 1 ? '留空' : '搭帐篷')+'，所有分支都会矛盾，所以这里应'+(expected === 1 ? '搭帐篷。' : '标空。'),'global');
  }
  return null;
}

return {orthogonal,touching,validateLevel,createBoard,validateBoard,applyAction,maximumMatching,analyze,isSolved,logicalHint,getHint};
})();
/* src/generator.mjs */
modules[3]=(function(){
const {solve} = modules[1];
const {createBoard,logicalHint,getHint,isSolved,orthogonal,touching} = modules[2];
const {REPLAY_LEVELS} = modules[0];
function hashSeed(input) {
  const text = String(input), prime = 16777619;
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i),prime);
  return h >>> 0;
}
function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return function() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(values,random) {
  const list = values.slice();
  for (let i = list.length-1; i > 0; i -= 1) { const p = Math.floor(random()*(i+1)); const old = list[i]; list[i]=list[p]; list[p]=old; }
  return list;
}
// Canonical signature includes all 8 square symmetries, so rotations/reflections are not extra levels.
function puzzleSignature(level) {
  const n = level.size, variants = [];
  for (let mirror = 0; mirror < 2; mirror += 1) for (let rotation = 0; rotation < 4; rotation += 1) {
    const trees = [], rows = Array(n).fill(0), cols = Array(n).fill(0);
    function transform(index) {
      let r = Math.floor(index/n), c = index%n;
      if (mirror) c = n-1-c;
      for (let k = 0; k < rotation; k += 1) { const previous = r; r=c; c=n-1-previous; }
      return r*n+c;
    }
    level.trees.forEach(function(i) { trees.push(transform(i)); });
    // Clues are transformed via artificial row/column tokens, not via the stored solution.
    for (let r = 0; r < n; r += 1) {
      const a = transform(r*n), b = transform(r*n+n-1);
      if (Math.floor(a/n) === Math.floor(b/n)) rows[Math.floor(a/n)] = level.rows[r]; else cols[a%n] = level.rows[r];
    }
    for (let c = 0; c < n; c += 1) {
      const a = transform(c), b = transform((n-1)*n+c);
      if (a%n === b%n) cols[a%n] = level.cols[c]; else rows[Math.floor(a/n)] = level.cols[c];
    }
    variants.push(n+'|'+trees.sort(function(a,b) { return a-b; }).join(',')+'|'+rows.join(',')+'|'+cols.join(','));
  }
  return variants.sort()[0];
}
function generateUnique(configuration) {
  const n = configuration.size, tentCount = configuration.tentCount, seed = Number(configuration.seed) >>> 0;
  if (!Number.isInteger(n) || n < 4 || n > 7 || !Number.isInteger(tentCount) || tentCount < 1 || tentCount > Math.ceil(n/2)*Math.ceil(n/2)) throw new TypeError('Invalid generation parameters');
  const random = seededRandom(seed), cells = Array.from({length:n*n},function(_,i) { return i; });
  const attempts = configuration.attempts || 10000;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tents = [];
    const order = shuffled(cells,random);
    for (let p = 0; p < order.length && tents.length < tentCount; p += 1) if (tents.every(function(t) { return !touching(n,t,order[p]); })) tents.push(order[p]);
    if (tents.length !== tentCount) continue;
    const choices = shuffled(tents,random).map(function(t) { return shuffled(orthogonal(n,t).filter(function(i) { return tents.indexOf(i) < 0; }),random); }).sort(function(a,b) { return a.length-b.length; });
    const used = new Set();
    function assign(k) {
      if (k === choices.length) return true;
      for (let p = 0; p < choices[k].length; p += 1) {
        const i = choices[k][p]; if (used.has(i)) continue;
        used.add(i); if (assign(k+1)) return true; used.delete(i);
      }
      return false;
    }
    if (!assign(0)) continue;
    const rows = Array(n).fill(0), cols = Array(n).fill(0);
    tents.forEach(function(t) { rows[Math.floor(t/n)] += 1; cols[t%n] += 1; });
    const level = {size:n,trees:Array.from(used).sort(function(a,b) { return a-b; }),rows:rows,cols:cols,seed:seed};
    const proof = solve(level,{limit:2});
    if (!proof.unique) continue;
    level.solution = proof.solutions[0];
    level.signature = puzzleSignature(level);
    level.generationAttempt = attempt;
    return {level:level,proof:proof};
  }
  throw new Error('No unique '+n+'×'+n+' camp found for seed '+seed);
}
// Independent restricted strategy for the depth audit. It deliberately grants the
// quota player tree-adjacency and already-placed-tent exclusions for free, then
// permits ONLY filling every remaining quota slot and crossing out filled lines.
// Thus failure here is stronger evidence than merely counting named hint kinds.
function quotaOnlyAudit(level) {
  const n = level.size, board = Array(n*n).fill(0), trees = new Set(level.trees), events = [];
  function candidates() {
    const result = [];
    for (let i = 0; i < board.length; i += 1) {
      if (board[i] !== 0 || trees.has(i)) continue;
      const r = Math.floor(i/n), c = i%n;
      const adjacent = (r > 0 && trees.has(i-n)) || (r+1 < n && trees.has(i+n)) || (c > 0 && trees.has(i-1)) || (c+1 < n && trees.has(i+1));
      if (!adjacent) continue;
      let clear = true;
      for (let t = 0; t < board.length; t += 1) if (board[t] === 1 && Math.abs(Math.floor(t/n)-r) <= 1 && Math.abs(t%n-c) <= 1) clear = false;
      if (clear) result.push(i);
    }
    return result;
  }
  while (true) {
    const possible = candidates();
    let action = null;
    for (let axis = 0; axis < 2 && !action; axis += 1) {
      for (let p = 0; p < n && !action; p += 1) {
        const cells = [];
        for (let v = 0; v < n; v += 1) cells.push(axis === 0 ? p*n+v : v*n+p);
        const count = cells.filter(function(i) { return board[i] === 1; }).length;
        const needed = (axis === 0 ? level.rows[p] : level.cols[p])-count;
        const available = cells.filter(function(i) { return possible.indexOf(i) >= 0; });
        if (needed > 0 && needed === available.length) action = {index:available[0],value:1};
      }
    }
    if (!action) {
      for (let i = 0; i < board.length && !action; i += 1) {
        if (board[i] !== 0 || trees.has(i)) continue;
        const r = Math.floor(i/n), c = i%n;
        let rowCount = 0, colCount = 0;
        for (let p = 0; p < n; p += 1) { if (board[r*n+p] === 1) rowCount += 1; if (board[p*n+c] === 1) colCount += 1; }
        if (rowCount === level.rows[r] || colCount === level.cols[c]) action = {index:i,value:2};
      }
    }
    if (!action || isSolved(level,board)) break;
    board[action.index] = action.value;
    events.push(action);
    if (events.length > n*n) throw new Error('Quota audit did not terminate');
  }
  return {solved:isSolved(level,board),steps:events.length,tentsPlaced:board.filter(function(v) { return v === 1; }).length,remainingTents:level.trees.length-board.filter(function(v) { return v === 1; }).length,board:board,events:events};
}
function measureDifficulty(level, proof) {
  let board = createBoard(level), logicSteps = 0, globalSteps = 0;
  const techniques = {};
  while (!isSolved(level,board)) {
    let next = logicalHint(level,board);
    if (next) logicSteps += 1;
    else { next = getHint(level,board); if (next) globalSteps += 1; }
    if (!next || next.kind === 'correction') throw new Error('Difficulty walk failed');
    techniques[next.kind] = (techniques[next.kind] || 0)+1;
    board = board.slice(); board[next.index] = next.value;
    if (logicSteps+globalSteps > level.size*level.size*2) throw new Error('Difficulty walk did not converge');
  }
  const candidates = Array.from({length:level.size*level.size},function(_,i) { return i; }).filter(function(i) { return level.trees.indexOf(i)<0 && orthogonal(level.size,i).some(function(t) { return level.trees.indexOf(t)>=0; }); }).length;
  const zeroLines = level.rows.concat(level.cols).filter(function(v) { return v === 0; }).length;
  // This is an implementation-defined route score, not a claim about human or optimal difficulty.
  const quota = quotaOnlyAudit(level);
  const matchingRejectedLayouts = Math.max(0,proof.matchingChecks-1);
  const score = (level.size-4)*1000 + globalSteps*180 + matchingRejectedLayouts*90 + proof.branchPoints*12 + proof.nodes*2 + candidates*3 + level.trees.length*6 - zeroLines*5;
  return {score:score,nodes:proof.nodes,branchPoints:proof.branchPoints,candidateCells:candidates,zeroLines:zeroLines,logicSteps:logicSteps,globalSteps:globalSteps,techniques:techniques,quotaOnlySolved:quota.solved,quotaOnlyTentsPlaced:quota.tentsPlaced,quotaOnlyRemainingTents:quota.remainingTents,matchingRejectedLayouts:matchingRejectedLayouts};
}
function dayKey(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = date instanceof Date ? date : new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dailyLevel(date) { return REPLAY_LEVELS[hashSeed('cloud-camp-daily:'+dayKey(date)) % REPLAY_LEVELS.length]; }
function seedJourney(seed,count) {
  const total = count === undefined ? 10 : Math.max(1,Math.min(REPLAY_LEVELS.length,Math.floor(Number(count) || 10)));
  return shuffled(REPLAY_LEVELS,seededRandom(hashSeed('cloud-camp-route:'+String(seed).trim()))).slice(0,total);
}

return {hashSeed,seededRandom,puzzleSignature,generateUnique,quotaOnlyAudit,measureDifficulty,dayKey,dailyLevel,seedJourney};
})();
/* src/storage.mjs */
modules[4]=(function(){
/** Cloud Camp persistence. The only authority for progress is a replayed solution. */
const GAME_ID = 'cloud-camp-journey';
const STORAGE_PREFIX = 'mini-polish:' + GAME_ID + ':v1:';
const STATE_KEY = STORAGE_PREFIX + 'state';
const MAX_EVENTS = 12000;

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 160; }
function iso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function dayAt(value) {
  const d = new Date(value);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    iso(value + 'T12:00:00Z') !== null && iso(value + 'T12:00:00Z').slice(0, 10) === value;
}
function puzzleSignature(level) {
  return JSON.stringify([level.id, level.size, level.trees, level.rows, level.cols]);
}
function completionId(runId) { return GAME_ID + ':completion:' + runId; }
function freshState() { return { schemaVersion: 1, active: null, completions: [], delivered: [] }; }

/**
 * Inject pure engine functions. resolveLevel(id, {mode, seed, day}) reconstructs
 * daily/seed puzzles; story puzzles always come from the trusted levels array.
 * Host delivery is optional, asynchronous, and receives only persisted events.
 */
function createStorage(options) {
  const config = options || {};
  ['createBoard', 'applyAction', 'isSolved'].forEach(function (name) {
    if (typeof config[name] !== 'function') throw new TypeError(name + ' is required');
  });
  const levels = Array.isArray(config.levels) ? config.levels : [];
  const clock = typeof config.now === 'function' ? config.now : Date.now;
  let storage = null;
  let available = true;
  let recoveryMessage = '';
  let state = freshState();
  let ledgerCache = null;
  let flushing = null;
  try {
    storage = Object.prototype.hasOwnProperty.call(config, 'storage') ? config.storage :
      (typeof localStorage === 'undefined' ? null : localStorage);
    available = Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
  } catch (error) { available = false; }

  function warn(message) { recoveryMessage = message; }
  function timeNow() { return iso(clock()) || new Date().toISOString(); }
  function newRunId() {
    if (typeof config.makeId === 'function') return String(config.makeId());
    return 'run-' + new Date(timeNow()).getTime().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  function levelFor(id, meta) {
    try {
      const level = meta.mode === 'story' ? levels.find(function (item) { return String(item.id) === id; }) :
        (typeof config.resolveLevel === 'function' ? config.resolveLevel(id, meta) : null);
      return level && String(level.id) === id ? level : null;
    } catch (error) { return null; }
  }
  function normalizeMeta(meta) {
    const source = meta || {};
    const mode = source.mode || 'story';
    if (['story', 'daily', 'seed'].indexOf(mode) === -1) return null;
    let seed = source.seed === undefined || source.seed === null ? null : source.seed;
    if (seed !== null && typeof seed !== 'string' && typeof seed !== 'number') return null;
    if (seed !== null && (String(seed).length > 120 || (typeof seed === 'number' && !Number.isFinite(seed)))) return null;
    let day = source.day === undefined || source.day === null ? null : source.day;
    if (day !== null && !validDay(day)) return null;
    if (mode === 'daily' && day === null) return null;
    if (mode === 'story') { seed = null; day = null; }
    return { mode: mode, seed: seed, day: day };
  }
  function replay(raw, allowPrefix) {
    if (!isObject(raw) || !validId(raw.runId) || !validId(raw.levelId) ||
      !Array.isArray(raw.events) || raw.events.length > MAX_EVENTS || !iso(raw.startedAt)) return null;
    const meta = normalizeMeta(raw);
    if (!meta) return null;
    const level = levelFor(raw.levelId, meta);
    if (!level || raw.puzzleSignature !== puzzleSignature(level)) return null;
    let board;
    try { board = config.createBoard(level).slice(); } catch (error) { return null; }
    const history = [];
    const events = [];
    let moves = 0;
    let hints = 0;
    let undoCount = 0;
    let valid = true;
    for (let i = 0; i < raw.events.length; i += 1) {
      const event = raw.events[i];
      if (!isObject(event)) { valid = false; break; }
      if (event.type === 'set') {
        if (!Number.isInteger(event.index) || !Number.isInteger(event.value) ||
          event.index < 0 || event.index >= board.length || event.value < 0 || event.value > 2) { valid = false; break; }
        let result;
        try { result = config.applyAction(level, board.slice(), event.index, event.value); } catch (error) { valid = false; break; }
        if (!result || !result.accepted || !Array.isArray(result.board) || result.board.length !== board.length) { valid = false; break; }
        history.push(board.slice());
        board = result.board.slice();
        events.push({ type: 'set', index: event.index, value: event.value });
        moves += 1;
      } else if (event.type === 'undo' && history.length > 0) {
        board = history.pop();
        events.push({ type: 'undo' });
        undoCount += 1;
      } else if (event.type === 'hint') {
        hints += 1;
        events.push({ type: 'hint' });
      } else { valid = false; break; }
    }
    if (!valid && !allowPrefix) return null;
    let solved = false;
    try { solved = config.isSolved(level, board) === true; } catch (error) { return null; }
    const clean = {
      runId: raw.runId, levelId: raw.levelId, mode: meta.mode, seed: meta.seed, day: meta.day,
      puzzleSignature: raw.puzzleSignature, startedAt: iso(raw.startedAt), events: events
    };
    return {
      valid: valid, level: level, raw: clean,
      run: {
        runId: raw.runId, levelId: raw.levelId, mode: meta.mode, seed: meta.seed, day: meta.day,
        board: board, moves: moves, hints: hints, undoCount: undoCount,
        canUndo: history.length > 0, completed: solved, completionId: completionId(raw.runId),
        startedAt: clean.startedAt
      }
    };
  }
  function persist() {
    if (!storage) { available = false; return false; }
    try { storage.setItem(STATE_KEY, JSON.stringify(state)); available = true; return true; }
    catch (error) { available = false; return false; }
  }
  function load() {
    if (!storage) return;
    let saved;
    try { saved = storage.getItem(STATE_KEY); }
    catch (error) { available = false; return; }
    if (saved === null || saved === undefined) return;
    let parsed;
    try { parsed = JSON.parse(saved); } catch (error) {
      warn('这份露营存档未能读取，已准备新的手账。其他游戏数据不受影响。'); return;
    }
    if (!isObject(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.completions) || !Array.isArray(parsed.delivered)) {
      warn('露营存档格式已损坏，已准备新的手账。'); return;
    }
    let recovered = false;
    if (parsed.active !== null && parsed.active !== undefined) {
      const active = replay(parsed.active, true);
      if (active) { state.active = active.raw; recovered = !active.valid; }
      else recovered = true;
    }
    const seen = new Set();
    parsed.completions.forEach(function (entry) {
      const proof = isObject(entry) ? replay(entry.run, false) : null;
      if (!proof || !proof.run.completed || !iso(entry.completedAt) || seen.has(proof.run.runId)) { recovered = true; return; }
      seen.add(proof.run.runId);
      state.completions.push({ run: proof.raw, completedAt: iso(entry.completedAt) });
    });
    const possible = new Set(state.completions.map(function (entry) { return completionId(entry.run.runId); }));
    state.delivered = parsed.delivered.filter(function (id, index, values) { return possible.has(id) && values.indexOf(id) === index; });
    if (recovered) warn('已核验手账并恢复有效操作；无法验证的记录没有计入成长。');
  }
  function deriveLedger() {
    if (ledgerCache) return ledgerCache;
    const completed = new Set();
    const dailyDates = new Set();
    const collections = new Set();
    const claimIds = new Set();
    const claims = [];
    const payloads = [];
    const chapterNumbers = Array.from(new Set(levels.map(function (level) { return level.chapter; }))).filter(function (n) { return Number.isInteger(n); }).sort(function (a, b) { return a - b; });
    state.completions.forEach(function (entry) {
      const proof = replay(entry.run, false);
      if (!proof || !proof.run.completed) return;
      const run = proof.run;
      const earned = [];
      function claim(id, kind, detail) {
        if (claimIds.has(id)) return;
        claimIds.add(id);
        const reward = Object.assign({ rewardClaimId: id, kind: kind, value: 1 }, detail);
        claims.push(reward); earned.push(reward);
      }
      if (run.mode === 'story') {
        completed.add(run.levelId);
        claim(GAME_ID + ':story:' + run.levelId + ':first', 'story-first', { levelId: run.levelId });
        chapterNumbers.forEach(function (chapter) {
          const members = levels.filter(function (level) { return level.chapter === chapter; });
          if (members.length > 0 && members.every(function (level) { return completed.has(String(level.id)); })) {
            collections.add(chapter);
            claim(GAME_ID + ':chapter:' + chapter + ':collection', 'chapter-collection', { chapter: chapter });
          }
        });
      } else if (run.mode === 'daily') {
        dailyDates.add(run.day);
        claim(GAME_ID + ':daily:' + run.day + ':first', 'daily-first', { day: run.day });
      }
      payloads.push({
        schemaVersion: 1, gameId: GAME_ID, levelId: run.levelId, mode: run.mode,
        runId: run.runId, completionId: run.completionId, rewardClaims: earned,
        metrics: { moves: run.moves, hints: run.hints, undoCount: run.undoCount,
          durationSeconds: Math.max(0, Math.floor((new Date(entry.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)) },
        completedAt: entry.completedAt
      });
    });
    ledgerCache = { payloads: payloads, profile: {
      completedLevelIds: levels.filter(function (level) { return completed.has(String(level.id)); }).map(function (level) { return String(level.id); }),
      dailyDates: Array.from(dailyDates).sort(), collections: Array.from(collections).sort(function (a, b) { return a - b; }),
      totalWins: payloads.length, totalRewards: claims.length, rewardClaims: claims
    } };
    return ledgerCache;
  }
  function getRun() {
    const proof = state.active ? replay(state.active, true) : null;
    return proof ? copy(proof.run) : null;
  }
  function profile() { return copy(deriveLedger().profile); }
  function begin(levelId, meta) {
    const supplied = Object.assign({}, meta || {});
    if (supplied.mode === 'daily' && !supplied.day) supplied.day = dayAt(timeNow());
    const context = normalizeMeta(supplied);
    const id = typeof levelId === 'object' && levelId ? String(levelId.id) : String(levelId);
    const level = context ? levelFor(id, context) : null;
    if (!level) throw new Error('无法恢复此营地，请从地图重新选择。');
    let runId = newRunId();
    if (!validId(runId)) throw new Error('Invalid run ID');
    // The normal random ID already differs. This also protects deterministic hosts.
    while ((state.active && state.active.runId === runId) || state.completions.some(function (entry) { return entry.run.runId === runId; })) runId += '-n';
    state.active = { runId: runId, levelId: id, mode: context.mode, seed: context.seed, day: context.day,
      puzzleSignature: puzzleSignature(level), startedAt: timeNow(), events: [] };
    persist();
    return getRun();
  }
  function act(index, value) {
    const proof = state.active ? replay(state.active, true) : null;
    if (!proof) return { accepted: false, run: null, reason: '请先选择营地。' };
    if (state.active.events.length >= MAX_EVENTS) return { accepted: false, run: getRun(), reason: '这页手账已写满，请重新开始这一关。' };
    let result;
    try { result = config.applyAction(proof.level, proof.run.board.slice(), index, value); }
    catch (error) { return { accepted: false, run: getRun(), reason: '这个操作不能落在此处。' }; }
    if (!result || !result.accepted) return { accepted: false, run: getRun(), reason: result && result.reason ? result.reason : '棋盘没有变化。' };
    // Replaying this proposed operation validates the same boundary used on restore.
    const proposed = copy(state.active);
    proposed.events.push({ type: 'set', index: index, value: value });
    const checked = replay(proposed, false);
    if (!checked) return { accepted: false, run: getRun(), reason: '这个操作不能落在此处。' };
    state.active = checked.raw; persist();
    return { accepted: true, run: copy(checked.run), reason: result.reason || '' };
  }
  function undo() {
    const run = getRun();
    if (run && run.canUndo && state.active.events.length < MAX_EVENTS) {
      state.active.events.push({ type: 'undo' }); persist();
    }
    return getRun();
  }
  function restart() {
    const run = getRun();
    return run ? begin(run.levelId, { mode: run.mode, seed: run.seed, day: run.day }) : null;
  }
  function hint() {
    if (state.active && state.active.events.length < MAX_EVENTS) { state.active.events.push({ type: 'hint' }); persist(); }
    return getRun();
  }
  function complete() {
    const proof = state.active ? replay(state.active, false) : null;
    if (!proof || !proof.run.completed) return { ok: false, alreadyCompleted: false, payload: null, profile: profile() };
    const existing = state.completions.some(function (entry) { return entry.run.runId === proof.run.runId; });
    if (!existing) {
      state.completions.push({ run: copy(proof.raw), completedAt: timeNow() });
      ledgerCache = null;
    }
    const payload = deriveLedger().payloads.find(function (item) { return item.completionId === proof.run.completionId; });
    const persisted = persist();
    // No host callback is possible until the completion and its outbox are on disk.
    if (persisted && typeof config.onComplete === 'function') flushOutbox().catch(function () {});
    return { ok: true, alreadyCompleted: existing, payload: copy(payload), profile: profile() };
  }
  function flushOutbox(host) {
    const receiver = typeof host === 'function' ? host : config.onComplete;
    if (typeof receiver !== 'function') return Promise.resolve({ sent: 0, pending: pending().length });
    if (flushing) return flushing;
    flushing = (async function () {
      let sent = 0;
      if (!persist()) return { sent: 0, pending: pending().length };
      const queue = pending();
      for (let i = 0; i < queue.length; i += 1) {
        try {
          const result = await receiver(copy(queue[i]));
          if (result === false) break;
        } catch (error) { break; }
        state.delivered.push(queue[i].completionId);
        sent += 1;
        if (!persist()) break;
      }
      return { sent: sent, pending: pending().length };
    }());
    flushing = flushing.then(function (result) { flushing = null; return result; }, function (error) { flushing = null; throw error; });
    return flushing;
  }
  function pending() {
    return deriveLedger().payloads.filter(function (payload) { return state.delivered.indexOf(payload.completionId) === -1; });
  }
  function tutorialKey(version) {
    if (!validId(version) || !/^[a-zA-Z0-9._-]+$/.test(version)) throw new Error('Invalid tutorial version');
    return STORAGE_PREFIX + 'tutorial:' + version;
  }
  const memoryTutorials = new Set();
  function tutorialSeen(version) {
    const key = tutorialKey(String(version));
    if (memoryTutorials.has(key)) return true;
    if (!storage) return false;
    try { return storage.getItem(key) === 'seen'; } catch (error) { available = false; return false; }
  }
  function markTutorialSeen(version) {
    const key = tutorialKey(String(version));
    memoryTutorials.add(key);
    if (storage) {
      // A tiny tutorial flag may still fit while the main save exceeds quota.
      // Only a successful full-state persist can clear a prior save failure.
      try { storage.setItem(key, 'seen'); } catch (error) { available = false; }
    }
    return true;
  }
  function getStatus() {
    return { persistenceAvailable: available, recoveryMessage: recoveryMessage, pendingCompletions: pending().length };
  }
  load();
  return {
    begin: begin, resume: getRun, getRun: getRun, act: act, undo: undo, restart: restart, hint: hint,
    complete: complete, profile: profile, flushOutbox: flushOutbox, getStatus: getStatus,
    tutorialSeen: tutorialSeen, markTutorialSeen: markTutorialSeen
  };
}

return {GAME_ID,STORAGE_PREFIX,STATE_KEY,createStorage};
})();
/* src/art.mjs */
modules[5]=(function(){
const treeShape = '<ellipse cx="24" cy="43" rx="14" ry="4" fill="rgba(41,76,56,0.125)"/><path d="M22 32h5v13h-5z" fill="#8a6642"/><path d="M24 3 8 27h7L5 38h38L32 27h7z" fill="#315f48"/><path d="M24 3v35h19L32 27h7z" fill="#234c3c"/><path d="m24 7-9 17h9" fill="#789369"/>';
const tentShape = '<ellipse cx="25" cy="42" rx="22" ry="4" fill="rgba(122,88,53,0.149)"/><path d="m7 38 16-30 13 30z" fill="#efb575"/><path d="m23 8 17 4 11 27-15-1z" fill="#dc8b52"/><path d="m23 18-9 20h19z" fill="#70513b"/><path d="m23 18 1 20h9z" fill="#352f2b"/><path d="M4 40 22 5M36 40 23 5" stroke="#fcdeb0" stroke-width="2"/><path d="m38 17 9 22" stroke="#ad6842" stroke-width="1.5"/>';
function symbol(kind) {
  return '<svg viewBox="0 0 54 48" aria-hidden="true" focusable="false">'+(kind==='tree'?treeShape:kind==='tent'?tentShape:'<path d="m18 18 16 16m0-16L18 34" stroke="#74886b" stroke-width="3" stroke-linecap="round"/>')+'</svg>';
}
function boardSvg(level, board, label, selected) {
  const n=level.size, cell=62, edge=48, w=edge+n*cell+18;
  let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+(w+40)+'" role="img" data-level="'+level.id+'" data-board="'+board.join(',')+'"><rect width="100%" height="100%" rx="20" fill="#f4f0df"/><text x="24" y="28" font-family="sans-serif" font-size="15" fill="#355c48">'+label+'</text><g transform="translate(0 34)">';
  for(let i=0;i<n;i++)s+='<text x="'+(edge+i*cell+31)+'" y="30" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#355c48">'+level.cols[i]+'</text><text x="25" y="'+(edge+i*cell+39)+'" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#355c48">'+level.rows[i]+'</text>';
  for(let i=0;i<n*n;i++){
    const x=edge+(i%n)*cell,y=edge+Math.floor(i/n)*cell,tree=level.trees.includes(i),kind=tree?'tree':board[i]===1?'tent':board[i]===2?'grass':'unknown';
    s+='<g data-cell="'+i+'" data-kind="'+kind+'" transform="translate('+x+' '+y+')"><rect x="1" y="1" width="60" height="60" rx="6" fill="'+((Math.floor(i/n)+i%n)%2?'#dce4bf':'#e6eaca')+'" stroke="'+(selected===i?'#d98953':'#b8c39e')+'" stroke-width="'+(selected===i?3:1)+'"/>';
    if(kind!=='unknown')s+='<g transform="translate(5 6)">'+(tree?treeShape:board[i]===1?tentShape:'<path d="m20 18 15 15m0-15L20 33" stroke="#74886b" stroke-width="3" stroke-linecap="round"/>')+'</g>';
    s+='</g>';
  }
  return s+'</g></svg>';
}

return {treeShape,tentShape,symbol,boardSvg};
})();
/* src/app.mjs */
modules[6]=(function(){
const {LEVELS,REPLAY_LEVELS} = modules[0];
const {createBoard,applyAction,analyze,isSolved,getHint} = modules[2];
const {dailyLevel,seedJourney} = modules[3];
const {createStorage} = modules[4];
const {symbol} = modules[5];
const $=s=>document.querySelector(s), app=$('#app'), modalRoot=$('#modal-root');
const TUTORIAL='paper-camp-1';
const chapterNames=['晨露草甸','杉林风声','溪谷野餐','日落山坡','星夜营地','云海远行'];
const chapterNotes=['看懂数字，安放第一顶帐篷','走进林间，学会一树一帐','留一点空地，风才会经过','从行列之间，找到唯一落点','让每棵树，都有自己的伙伴','把整片云野，连成一段旅途'];
const chapterFocus=['行列配额','树帐相邻','邻接排除','配额联动','一一匹配','全局推理'];
let view='home', activeLevel=null, run=null, selected=0, activeChapter=1, hint=null, feedback='', modal=null, restoreFocus=null, journeySeed='云野的一天', journeyIndex=0;
let previouslyUnsaved=false;
const volatileLevels={};
function dayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function resolveLevel(id,meta){
  if(meta&&meta.mode==='daily'){const d=dailyLevel(meta.day);return d.id===id?d:null;}
  if(meta&&meta.mode==='seed')return seedJourney(meta.seed,10).find(x=>x.id===id)||null;
  const l=LEVELS.find(x=>x.id===id);if(l)return l;
  return null;
}
const store=createStorage({levels:LEVELS,resolveLevel,createBoard,applyAction,isSolved,onComplete:payload=>{if(typeof window.cloudCampHost==='function')return window.cloudCampHost(payload);return false;}});
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function button(text,action,cls,extra){return '<button type="button" class="'+(cls||'')+'" data-action="'+action+'" '+(extra||'')+'>'+text+'</button>';}
function header(back,title,small){return '<header class="topbar">'+button(back?'‹':'<span class="brand-mark">△</span>',back?'home':'home','icon-button',back?'aria-label="返回营地首页"':'aria-label="云野露营首页"')+'<div class="brand"><strong>'+title+'</strong><span>'+small+'</span></div>'+button('?','tutorial','icon-button','aria-label="重看图片教程"')+'</header>';}
function stats(){return store.profile();}
function refreshSaveNotice(){
  const status=store.getStatus(),old=$('.save-status');if(old)old.parentNode.removeChild(old);
  if(!status.persistenceAvailable||previouslyUnsaved){const el=document.createElement('p');el.className='save-status';el.setAttribute('role','status');el.textContent=status.persistenceAvailable?'进度已重新保存，可以安心离开。':'当前未能保存。你可以继续玩；请保留此页面，恢复后操作会重试保存。';const bar=$('.topbar');if(bar)bar.parentNode.insertBefore(el,bar.nextSibling);}
  previouslyUnsaved=!status.persistenceAvailable;
}
function render(){
  document.body.classList.toggle('in-game',view==='game');
  if(view==='game')renderGame();else if(view==='map')renderMap();else if(view==='collection')renderCollection();else renderHome();
  refreshSaveNotice();
}
function renderHome(){
  const p=stats(), saved=store.getRun(), next=LEVELS.find(l=>!p.completedLevelIds.includes(l.id))||LEVELS[0];
  const canResume=saved&&(!saved.completed||(saved.mode==='seed'&&seedJourney(saved.seed,10).findIndex(l=>l.id===saved.levelId)<9));
  app.innerHTML='<div class="shell home-shell">'+header(false,'云野露营','CLOUD CAMP · 山野手账')+'<section class="hero"><div class="hero-copy"><span class="eyebrow">慢一点，住进风景里</span><h1>把日子安放<br>在山野。</h1><p>一棵树，一顶帐篷。<br>在刚刚好的留白里，搭起自己的营地。</p></div><img class="hero-scene" src="./assets/scene.svg" alt="层叠纸景山峦间的松树与橙色帐篷"><span class="hero-stamp">野外来信<br><b>VOL. 01</b></span></section><section class="home-content"><div class="journey-heading"><div><span class="eyebrow">YOUR LITTLE JOURNEY</span><h2>下一站，去露营</h2></div><span class="progress-pill">'+p.completedLevelIds.length+' / 60 营地</span></div>'+button('<span><b>'+(canResume?'继续这片营地':'出发 · '+next.title)+'</b><small>'+(canResume?'已为你收好帐篷与标记':'六章山野手账 · 随时停下，随时回来')+'</small></span><span class="arrow">↗</span>',canResume?'resume':'next','primary journey-start')+'<div class="mode-grid">'+button('<span class="mode-icon">☀</span><b>每日营地</b><small>'+dayKey()+' · 今日一题</small>','daily','mode-card')+button('<span class="mode-icon">⌁</span><b>种子旅途</b><small>一句口令，同一条十站路线</small>','seed','mode-card')+'</div><div class="notebook-links">'+button('<span>⌘ 章节地图</span><b>六站风景 →</b>','map','text-link')+button('<span>▧ 风景收藏</span><b>'+p.collections.length+' / 6 张 →</b>','collection','text-link')+'</div><footer>没有倒计时。风景会一直等你。'+button('玩法与出处','about','footer-link')+'</footer></section></div>';
}
function renderMap(){
  const p=stats(),n=activeChapter;
  app.innerHTML='<div class="shell map-shell">'+header(true,'山野路线','六章 · 六十片可以慢慢读的风景')+'<div class="chapter-tabs" aria-label="选择章节">'+chapterNames.map((x,i)=>button('<small>0'+(i+1)+'</small><span>'+x+'</span>','chapter:'+ (i+1),'chapter-tab '+(n===i+1?'active':''),'aria-pressed="'+(n===i+1)+'"')).join('')+'</div><section class="chapter-card"><img src="./assets/chapter-'+n+'.svg" alt="'+chapterNames[n-1]+'纸景"><div><span class="eyebrow">CHAPTER 0'+n+' · '+chapterFocus[n-1]+'</span><h1>'+chapterNames[n-1]+'</h1><p>'+chapterNotes[n-1]+'</p></div></section><div class="map-caption"><h2>挑一片营地坐坐</h2><span>可自由选关</span></div><section class="level-grid">'+LEVELS.filter(l=>l.chapter===n).map(l=>{const done=p.completedLevelIds.includes(l.id);return button('<span class="level-num">'+String(l.index).padStart(2,'0')+'</span><span><b>'+l.title+'</b><small>'+l.size+' × '+l.size+' · '+l.trees.length+' 顶帐篷</small></span><i>'+(done?'✓':'↗')+'</i>','level:'+l.id,'level-card '+(done?'done':''),'aria-label="第'+l.index+'关 '+l.title+(done?' 已完成':'')+'"');}).join('')+'</section><p class="map-note">每章首次完成 10 关，收下一张风景。提示不扣奖励。</p></div>';
}
function renderCollection(){
  const p=stats();
  app.innerHTML='<div class="shell collection-shell">'+header(true,'风景收藏','把走过的路，折进手账里')+'<div class="collection-title"><span class="eyebrow">POSTCARDS FROM THE WILD</span><h1>风，替你寄来的明信片</h1><p>每章十片营地全部完成，收藏一张风景。<br>无需连续签到，来过的地方不会消失。</p></div><div class="postcards">'+chapterNames.map((x,i)=>{const owned=p.collections.includes(i+1),count=LEVELS.filter(l=>l.chapter===i+1&&p.completedLevelIds.includes(l.id)).length;return '<article class="postcard '+(owned?'owned':'')+'"><img src="./assets/chapter-'+(i+1)+'.svg" alt="'+x+'风景预览"><div><span class="eyebrow">NO. 0'+(i+1)+(owned?' · 已收藏':' · 风景预览')+'</span><h2>'+x+'</h2><p>'+(owned?'这片风景，已经住进你的手账。':count+' / 10 营地 · 完成本章即可收藏')+'</p>'+button(owned?'再走一遍 →':'去这一章 →','chapter:'+ (i+1),'small-link')+'</div></article>';}).join('')+'</div></div>';
}
function select(index){selected=Math.max(0,Math.min(activeLevel.size*activeLevel.size-1,index));hint=null;feedback='';renderGame();}
function statusText(a){
  if(feedback)return feedback;
  if(hint)return hint.text;
  if(a.errors.length)return a.errors[0];
  if(activeLevel.trees.includes(selected))return '这是一棵树，不能放帐篷。请选它上、下、左、右的草地。';
  return '先选格子，再放帐／标空。帐篷之间连对角也不能碰。';
}
function renderGame(){
  if(!run||!activeLevel){view='home';renderHome();return;}
  const l=activeLevel,n=l.size,a=analyze(l,run.board),isTree=l.trees.includes(selected),row=Math.floor(selected/n)+1,col=selected%n+1;
  let board='<span class="clue-corner" aria-hidden="true">↓ →</span>';
  for(let c=0;c<n;c++){const count=a.cols[c].count;board+='<span class="clue '+(count===l.cols[c]?'met':count>l.cols[c]?'over':'')+'" aria-label="第'+(c+1)+'列 '+count+'顶，目标'+l.cols[c]+'">'+l.cols[c]+'<i>'+(count===l.cols[c]?'✓':'')+'</i></span>';}
  for(let r=0;r<n;r++){
    const count=a.rows[r].count;board+='<span class="clue '+(count===l.rows[r]?'met':count>l.rows[r]?'over':'')+'" aria-label="第'+(r+1)+'行 '+count+'顶，目标'+l.rows[r]+'">'+l.rows[r]+'<i>'+(count===l.rows[r]?'✓':'')+'</i></span>';
    for(let c=0;c<n;c++){
      const i=r*n+c,tree=l.trees.includes(i),kind=tree?'tree':run.board[i]===1?'tent':run.board[i]===2?'grass':'unknown';
      board+='<button type="button" data-cell="'+i+'" class="cell '+kind+' '+((r+c)%2?'shade':'')+' '+(selected===i?'selected':'')+' '+(a.conflictCells.includes(i)?'conflict':'')+' '+(hint&&hint.index===i?'hinted':'')+'" aria-label="第'+(r+1)+'行第'+(c+1)+'列 '+(tree?'树':kind==='tent'?'帐篷':kind==='grass'?'已标空':'未填写')+'" aria-pressed="'+(selected===i)+'">'+(kind==='unknown'?'<span class="grass-speck">′</span>':symbol(kind))+(selected===i?'<span class="selection-corner"></span>':'')+'</button>';
    }
  }
  app.innerHTML='<div class="shell play-shell">'+header(true,'云野露营',run.mode==='story'?'CHAPTER 0'+l.chapter+' · '+chapterNames[l.chapter-1]:run.mode==='daily'?'DAILY CAMP · '+run.day:'SEED JOURNEY · 第 '+(journeyIndex+1)+' 站')+'<section class="play-heading"><div><span class="eyebrow">'+(run.mode==='story'?'营地 '+String(l.index).padStart(2,'0')+' / 60':run.mode==='daily'?'今日营地':'口令 · '+escape(run.seed))+'</span><h1>'+escape(l.title)+'</h1></div><div class="tent-total">'+symbol('tent')+'<span><b>'+a.tentCount+'</b> / '+l.trees.length+'</span></div></section><div class="game-layout"><section class="board-area"><div class="board-topnote"><span>边上数字 = 这一行 / 列的帐篷数</span><span>'+n+' × '+n+'</span></div><div class="board-paper"><div class="board" style="grid-template-columns:26px repeat('+n+',1fr)" role="group" aria-label="'+n+'乘'+n+'营地棋盘">'+board+'</div><div class="board-paper-edge"></div></div><p class="board-legend"><span>'+symbol('tree')+'一树一帐</span><span>↔ 只看上下左右</span><span>× 可选标空</span></p></section><section class="camp-tools"><div class="selection-bar"><span>已选 <b>'+row+' 行 '+col+' 列</b></span><div class="dpad" aria-label="精确选择格子">'+button('←','move:left','direction','aria-label="向左选格"')+button('↑','move:up','direction','aria-label="向上选格"')+button('↓','move:down','direction','aria-label="向下选格"')+button('→','move:right','direction','aria-label="向右选格"')+'</div></div><div class="placement-tools">'+button(symbol('tent')+'<span>放帐</span>','place:1','place tent-tool',isTree?'disabled':'')+button('<span class="cross-symbol">×</span><span>标空</span>','place:2','place',isTree?'disabled':'')+button('<span class="erase-symbol">◇</span><span>擦除</span>','place:0','place',isTree?'disabled':'')+'</div><div class="help-note '+(a.errors.length?'warning':'')+'" aria-live="polite"><span class="note-icon">'+(hint?'✧':a.errors.length?'!':'⌁')+'</span><p>'+escape(statusText(a))+'</p></div><div class="secondary-tools">'+button('↶ 撤销','undo','secondary',!run.canUndo?'disabled':'')+button('↻ 重开','restart','secondary')+button('✧ 提示','hint','secondary hint-button')+'</div><p class="gentle-note">'+(!store.getStatus().persistenceAvailable?'当前未保存 · 请暂时保留此页面':run.hints?'已看 '+run.hints+' 次提示 · 不扣奖励':'不计时 · 提示不扣奖励 · 自动收好进度')+'</p></section></div></div>';
}
function begin(level,meta){volatileLevels[level.id]=level;activeLevel=level;run=store.begin(level.id,meta);selected=level.trees.includes(0)?level.trees.indexOf(0)+1:0;selected=run.board.findIndex((x,i)=>!level.trees.includes(i));hint=null;feedback='';view='game';closeModal();render();}
function resume(){run=store.resume();if(!run){startNext();return;}activeLevel=resolveLevel(run.levelId,run);if(run.mode==='seed'){journeySeed=run.seed;journeyIndex=seedJourney(run.seed,10).findIndex(x=>x.id===run.levelId);}selected=run.board.findIndex((x,i)=>!activeLevel.trees.includes(i));view='game';render();if(run.completed)showWin();}
function startNext(){const p=stats();begin(LEVELS.find(l=>!p.completedLevelIds.includes(l.id))||LEVELS[0],{mode:'story'});}
function place(value){
  if(run.completed)return;
  const result=store.act(selected,value);feedback=result.accepted?'':result.reason==='fixed-or-outside'?'树是固定的，请选择草地。':'这格没有改变。';if(result.run)run=result.run;hint=null;renderGame();if(isSolved(activeLevel,run.board))showWin();
}
function showWin(){
  const completion=store.complete();run=store.getRun();const p=stats(),savedNow=store.getStatus().persistenceAvailable;
  openModal('win','<div class="win-illustration"><img src="./assets/chapter-'+(activeLevel.chapter||1)+'.svg" alt="这片营地的纸景风光"><span class="postmark">CAMP<br>COMPLETE ✓</span></div><span class="eyebrow">A GOOD PLACE TO STAY</span><h2>帐篷搭好了，歇一会儿。</h2><p>每棵树都有伙伴，行列刚刚好，<br>帐篷之间也留好了呼吸的空地。</p><div class="win-facts"><span><b>'+activeLevel.trees.length+'</b> 顶帐篷</span><span><b>'+run.hints+'</b> 次提示</span><span><b>'+p.completedLevelIds.length+'</b> 片主线营地</span></div><p class="reward-note">'+(!savedNow?'本局已完成，但当前未能保存。请保留此页，恢复后继续操作会重试保存。':completion.alreadyCompleted?'这片风景已收进手账。再来一次也很好。':run.mode==='daily'?'今日营地已记录，明天也有新的风景。':run.mode==='seed'?'这一站已走过，继续沿口令去下一站。':'已记入山野手账。每章走完十站，收藏整章风景。')+'</p><div class="modal-actions">'+button('留在这片风景','home','secondary')+button('下一站 →','advance','primary')+'</div>');
}
function openModal(kind,html){
  if(!modal)restoreFocus=document.activeElement;
  modal=kind;modalRoot.innerHTML='<div class="modal-backdrop"><section class="modal '+kind+'-modal" role="dialog" aria-modal="true" aria-label="'+(kind==='tutorial'?'露营图片教程':kind==='win'?'营地完成':'云野露营对话框')+'" tabindex="-1">'+html+'</section></div>';
  document.body.classList.add('modal-open');const box=$('.modal');box.scrollTop=0;box.focus();
}
function closeModal(){if(!modal)return;modal=null;modalRoot.innerHTML='';document.body.classList.remove('modal-open');if(restoreFocus&&document.contains(restoreFocus))restoreFocus.focus();}
let tutorialStep=0;
function tutorial(step){
  tutorialStep=step;const titles=['先读一片营地','选好一格，再放帐篷','让每棵树都有伙伴'];
  const texts=['树是固定的。边上的数字告诉你，这一行、这一列各要几顶帐篷。数字 0 的整行可以标空。','点选树旁的草地，再点「放帐」。帐篷只和上下左右的树配对；其他帐篷连对角也不能碰。','每棵树与一顶帐篷一一配对，所有行列数量相符，且帐篷互不相邻，就能完成。空地不必全部标 ×。'];
  openModal('tutorial','<div class="modal-top"><span class="eyebrow">营地入门 · '+(step+1)+' / 3</span>'+button('跳过','tutorial:skip','skip')+'</div><img class="tutorial-image" src="./assets/tutorial-'+(step+1)+'.svg" alt="'+['真实首关初始棋盘，含固定树和全部行列配额','同一首关执行一次合法放帐操作，橙框标示落点','同一首关真实通关状态，帐篷满足全部规则'][step]+'"><div class="tutorial-body"><h2>'+titles[step]+'</h2><p>'+texts[step]+'</p></div><div class="tutorial-dots">'+[0,1,2].map(i=>'<i class="'+(i===step?'active':'')+'"></i>').join('')+'</div><div class="modal-actions">'+button(step?'上一张':'以后可随时重看',step?'tutorial:'+(step-1):'tutorial:skip','secondary')+button(step===2?'去搭帐篷 →':'下一张 →',step===2?'tutorial:done':'tutorial:'+(step+1),'primary')+'</div>');
}
function seedModal(){openModal('seed','<span class="eyebrow">A JOURNEY IN A WORD</span><h2>给旅途起个名字</h2><p>同一句口令，会得到相同的十站路线。<br>从 '+REPLAY_LEVELS.length+' 片额外营地里挑选，不用网络。</p><label class="seed-label" for="seed-input">旅途口令（最多 24 字）</label><input id="seed-input" maxlength="24" value="'+escape(journeySeed)+'" placeholder="例如：和风一起出发"><div class="modal-actions">'+button('再想想','close','secondary')+button('开始十站旅途 →','seed:start','primary')+'</div>');}
function onAction(action){
  if(action==='home'){closeModal();view='home';hint=null;feedback='';render();}
  else if(action==='map'){view='map';closeModal();render();}
  else if(action==='collection'){view='collection';render();}
  else if(action==='next')startNext();else if(action==='resume')resume();
  else if(action.indexOf('chapter:')===0){activeChapter=Number(action.split(':')[1]);view='map';render();}
  else if(action.indexOf('level:')===0)begin(LEVELS.find(l=>l.id===action.slice(6)),{mode:'story'});
  else if(action==='daily'){const day=dayKey();begin(dailyLevel(day),{mode:'daily',day});}
  else if(action==='seed')seedModal();
  else if(action==='seed:start'){journeySeed=$('#seed-input').value.trim()||'云野的一天';journeyIndex=0;begin(seedJourney(journeySeed,10)[0],{mode:'seed',seed:journeySeed});}
  else if(action==='tutorial'){tutorial(0);}
  else if(action==='tutorial:skip'||action==='tutorial:done'){store.markTutorialSeen(TUTORIAL);closeModal();}
  else if(action.indexOf('tutorial:')===0)tutorial(Number(action.split(':')[1]));
  else if(action==='close')closeModal();
  else if(action.indexOf('place:')===0)place(Number(action.split(':')[1]));
  else if(action.indexOf('move:')===0){const n=activeLevel.size,d=action.split(':')[1];if(d==='left'&&selected%n>0)select(selected-1);if(d==='right'&&selected%n<n-1)select(selected+1);if(d==='up'&&selected>=n)select(selected-n);if(d==='down'&&selected<n*(n-1))select(selected+n);}
  else if(action==='undo'){run=store.undo();hint=null;feedback='已退回上一次记录。';render();}
  else if(action==='restart')openModal('restart','<span class="eyebrow">FRESH AIR, FRESH START</span><h2>重新整理这片营地？</h2><p>本局的帐篷与标记会收起。<br>已收藏的风景和章节进度都会保留。</p><div class="modal-actions">'+button('继续这一局','close','secondary')+button('重新搭帐篷','restart:yes','primary')+'</div>');
  else if(action==='restart:yes'){run=store.restart();closeModal();hint=null;feedback='';render();}
  else if(action==='hint'){const h=getHint(activeLevel,run.board);run=store.hint();hint=h;feedback=h?'':'这片营地已经完成了。';if(h&&Number.isInteger(h.index))selected=h.index;render();}
  else if(action==='advance'){
    closeModal();if(run.mode==='story'){const next=LEVELS.find(l=>l.index===activeLevel.index+1);if(next)begin(next,{mode:'story'});else{view='collection';render();}}
    else if(run.mode==='seed'&&journeyIndex<9){journeyIndex++;begin(seedJourney(run.seed,10)[journeyIndex],{mode:'seed',seed:run.seed});}
    else{view='home';render();}
  }
  else if(action==='about')openModal('about','<span class="eyebrow">ABOUT THIS CAMPSITE</span><h2>留白，也是一种答案</h2><p>云野露营是一款 Tents 逻辑谜题。60 个主线关卡、六章纸景手账、每日营地与十站种子旅途。所有题面均经过独立搜索验证，帐篷位置唯一。</p><p>玩法参考 Simon Tatham’s Portable Puzzle Collection（Tents）。本作规则引擎、关卡、纸景、教程与界面由本项目实现。来源项目：Ten Realms Arcade contributors，MIT License。</p><p>快捷键：方向键选格，T / 空格放帐，G 标空，X 擦除，U 撤销，H 提示。标空是笔记，不影响胜利。</p><p>进度保存在此浏览器本地。提示不扣收藏奖励，没有倒计时或连续签到惩罚。</p>'+button('回到山野','close','primary'));
}
document.addEventListener('click',e=>{const cell=e.target.closest('[data-cell]');if(cell&&!modal){select(Number(cell.dataset.cell));refreshSaveNotice();return;}const b=e.target.closest('[data-action]');if(b&&!b.disabled){onAction(b.dataset.action);refreshSaveNotice();}});
document.addEventListener('keydown',e=>{
  if(modal){if(e.key==='Escape'){if(modal==='tutorial')store.markTutorialSeen(TUTORIAL);closeModal();e.preventDefault();}if(e.key==='Tab'){const focus=Array.from($('.modal').querySelectorAll('button:not([disabled]),input,[tabindex="0"]'));const first=focus[0],last=focus[focus.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('.modal'))){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}return;}
  if(view!=='game')return;
  const keys={ArrowLeft:'move:left',ArrowUp:'move:up',ArrowRight:'move:right',ArrowDown:'move:down',t:'place:1',g:'place:2',x:'place:0',u:'undo',h:'hint'};const a=keys[e.key]||(e.key===' '&&!e.target.closest('button')?'place:1':null);if(a){e.preventDefault();onAction(a);refreshSaveNotice();}
});
function syncHeight(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');}
window.addEventListener('resize',syncHeight);syncHeight();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)store.flushOutbox().catch(()=>{});});
store.flushOutbox().catch(()=>{});
const saved=store.resume();
if(saved&&saved.completed)store.complete();
if(!store.tutorialSeen(TUTORIAL)){if(saved)resume();else begin(LEVELS[0],{mode:'story'});tutorial(0);}else if(saved&&!saved.completed)resume();else render();
const storageStatus=store.getStatus();if(!storageStatus.persistenceAvailable||storageStatus.recoveryMessage){const notice=document.createElement('div');notice.className='storage-notice';notice.setAttribute('role','status');notice.textContent=storageStatus.recoveryMessage||'当前环境无法保存进度，本次仍可正常游玩。';document.body.appendChild(notice);setTimeout(()=>{if(notice.parentNode)notice.parentNode.removeChild(notice);},6500);}

return {};
})();
})();
