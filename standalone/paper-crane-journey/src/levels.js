/* Deterministic reverse-play level generator. No network or runtime dependencies. */
(function (root) {
  'use strict';
  var chapters = [
    { id: 1, name: '初羽小径', subtitle: '看见落点 · 4–6 只纸鹤', theme: 'dawn', lesson: '先点一只纸鹤，再点高亮空位；每次只跨过一只。' },
    { id: 2, name: '莲影曲廊', subtitle: '横竖相接 · 7–9 只纸鹤', theme: 'lotus', lesson: '一次横跳可以为下一次竖跳留下空位。' },
    { id: 3, name: '竹风折庭', subtitle: '照顾支路 · 10–12 只纸鹤', theme: 'bamboo', lesson: '边缘的纸鹤也需要同伴，别太早拆散桥梁。' },
    { id: 4, name: '雨歇回桥', subtitle: '安排次序 · 12–14 只纸鹤', theme: 'rain', lesson: '多个跳法共用落点时，先想下一跳从哪里接上。' },
    { id: 5, name: '月门深院', subtitle: '往返织路 · 14–16 只纸鹤', theme: 'moon', lesson: '空位会随着跳跃移动；试着让两侧依次汇合。' },
    { id: 6, name: '星河归巢', subtitle: '全庭统筹 · 16–19 只纸鹤', theme: 'stars', lesson: '每条支路都要留出口。可以慢慢推演，无限撤销。' }
  ];
  var lessons = [
    ['高亮空位才是合法落点。', '横向和纵向都可以跳。', '跳过同伴，留下一个新的空位。', '留意外侧的纸鹤怎样回到庭中。', '先看落点，再看落点旁边。', '下一步可能要换一个方向。', '看清三格一线，不走斜线。', '暂时没有出口？可以撤销再试。', '顺序不同，也可能一起归巢。', '学会三格一跳，走向莲池。'],
    ['让横跳为竖跳留出入口。', '从外侧开始观察可接续的空位。', '同一个落点可以先后使用。', '别急着拆走连接两边的同伴。', '把末端纸鹤带回主路。', '看清短廊里的先后顺序。', '落下后，还能和谁继续跳？', '空位会跟着每一步改变。', '先收一边，再照顾另一边。', '试着连续计划两次跳跃。'],
    ['先让窄支路接回庭院。', '有些同伴要等侧翼到齐。', '留住通向边缘的一只纸鹤。', '空位不多时，先疏通转角。', '试着从最后两只的位置往回想。', '两边争用落点，先后会改变结果。', '不要让孤单纸鹤失去搭桥同伴。', '边缘与中央需要轮流接力。', '一条支路清空后，再接下一条。', '把支路看作几段可以相接的短廊。'],
    ['找出连接上下庭院的通道。', '先收拢远端，再穿过回桥。', '暂留一对相邻纸鹤，为下一跳搭桥。', '同一位置可以多次成为起点或落点。', '把几条短路线按先后接起来。', '先观察最难回来的那一只。', '每移走一只，也要想谁会用到它。', '空位通路可能需要一次折返。', '看完两侧，再决定第一跳。', '莲印可作额外终点挑战，任一余鹤仍算通关。'],
    ['让外庭依次向内汇合。', '先打开一侧，再让另一侧接上。', '不要一次用完中央的搭桥同伴。', '选择能给边角留下出口的跳法。', '先把远处分散的纸鹤连成一段。', '空位的顺序和纸鹤的顺序一样重要。', '短暂向外跳，也能为归巢铺路。', '观察哪些支路必须先清理。', '每一步都检查有没有失去同伴的纸鹤。', '把整个庭院看成相互接力的几段路。'],
    ['从最偏远的纸鹤开始规划。', '边庭和中庭需要交错归拢。', '留住关键通道上的接力同伴。', '先试想最后三只纸鹤的形状。', '分支多时，可以逐段试演并撤销。', '不要把两侧过早分开。', '一次折返可能连起新的路线。', '先处理狭窄出口，再收拢中央。', '想好先后，再让整庭纸鹤依次起落。', '慢慢完成最后一庭；归巢没有时间限制。']
  ];
  function hash(text) { var h = 2166136261; for (var i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function random(seed) { var x = hash(String(seed)) || 1; return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
  function choose(array, rng) { return array[Math.floor(rng() * array.length)]; }
  function parameter(chapter, variation) {
    var settings = [[4, 5, 4, 4, 6], [5, 5, 4, 7, 9], [5, 6, 5, 10, 12], [6, 6, 5, 12, 14], [6, 6, 6, 14, 16], [6, 6, 6, 16, 19]][chapter - 1];
    return { width: variation % 3 === 0 ? settings[0] : settings[1], height: settings[2], pegs: settings[3] + Math.min(settings[4] - settings[3], Math.floor((variation % 10) * (settings[4] - settings[3] + 1) / 10)) };
  }
  function generate(seed, chapter, desired) {
    var rng = random(seed), variation = hash(String(seed)) % 10;
    var settings = desired || parameter(chapter, variation), width = settings.width, height = settings.height;
    var allJumps = [], length = width * height;
    for (var from = 0; from < length; from += 1) {
      var x = from % width, y = Math.floor(from / width);
      [[0, -2], [2, 0], [0, 2], [-2, 0]].forEach(function (d) {
        var xx = x + d[0], yy = y + d[1];
        if (xx >= 0 && xx < width && yy >= 0 && yy < height) { var to = yy * width + xx; allJumps.push({ from: from, to: to, middle: (from + to) / 2 }); }
      });
    }
    for (var attempt = 0; attempt < 600; attempt += 1) {
      var cells = new Array(length).fill('.'), used = new Array(length).fill(false);
      var target = Math.floor(rng() * length), history = [];
      cells[target] = 'P'; used[target] = true;
      for (var step = 1; step < settings.pegs; step += 1) {
        var choices = allJumps.filter(function (j) { return cells[j.to] === 'P' && cells[j.from] === '.' && cells[j.middle] === '.'; });
        if (!choices.length) break;
        // Random tie-breaking plus look-ahead avoids repeatedly closing every exit.
        var scored = choices.map(function (j) {
          cells[j.to] = '.'; cells[j.from] = 'P'; cells[j.middle] = 'P';
          var continuation = allJumps.reduce(function (n, next) { return n + (cells[next.to] === 'P' && cells[next.from] === '.' && cells[next.middle] === '.' ? 1 : 0); }, 0);
          cells[j.to] = 'P'; cells[j.from] = '.'; cells[j.middle] = '.';
          return { jump: j, score: rng() * (chapter < 3 ? 5 : 8) + Math.min(continuation, 6) * 0.9 + (!used[j.from] ? 0.4 : 0) };
        });
        scored.sort(function (a, b) { return b.score - a.score; });
        var picked = scored[0].jump;
        cells[picked.to] = '.'; cells[picked.from] = 'P'; cells[picked.middle] = 'P';
        used[picked.to] = used[picked.from] = used[picked.middle] = true;
        history.push({ from: picked.from, to: picked.to });
      }
      if (history.length !== settings.pegs - 1) continue;
      // Extra empty perches must extend an actual triple, so no isolated decorative holes appear.
      for (var i = 0; i < length; i += 1) {
        if (used[i]) continue;
        var partOfRoute = allJumps.some(function (j) { return j.from === i && used[j.middle] && used[j.to] || j.middle === i && used[j.from] && used[j.to] || j.to === i && used[j.from] && used[j.middle]; });
        if (!partOfRoute || rng() > (chapter === 1 ? 0 : chapter === 2 ? 0.12 : 0.24)) cells[i] = '#';
      }
      var minX = width, minY = height, maxX = 0, maxY = 0;
      cells.forEach(function (cell, index) { if (cell !== '#') { minX = Math.min(minX, index % width); maxX = Math.max(maxX, index % width); minY = Math.min(minY, Math.floor(index / width)); maxY = Math.max(maxY, Math.floor(index / width)); } });
      var finalWidth = maxX - minX + 1, finalHeight = maxY - minY + 1;
      function remap(index) { return (Math.floor(index / width) - minY) * finalWidth + index % width - minX; }
      var board = []; for (var row = minY; row <= maxY; row += 1) board.push(cells.slice(row * width + minX, row * width + maxX + 1).join(''));
      var solution = history.reverse().map(function (move) { return { from: remap(move.from), to: remap(move.to) }; });
      return { id: 'seed-' + hash(String(seed)).toString(36), title: '风笺新庭', chapter: chapter, seed: String(seed), width: finalWidth, height: finalHeight, board: board, solution: solution, target: remap(target), lesson: chapters[chapter - 1].lesson, stats: { pegCount: settings.pegs, playable: cells.filter(function (c) { return c !== '#'; }).length, holes: cells.filter(function (c) { return c === '.'; }).length, reverseAttempts: attempt + 1 } };
    }
    throw new Error('此风笺暂未生成，可换一个种子。');
  }
  function seeded(seed, chapter) {
    chapter = Number.isInteger(chapter) && chapter >= 1 && chapter <= 6 ? chapter : 4;
    var level = generate('pcj-v1:' + String(seed), chapter);
    level.id = 'seed-c' + chapter + '-' + hash('pcj-v1:' + String(seed)).toString(36);
    level.seed = String(seed);
    return level;
  }
  function daily(dateString) {
    if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) throw new TypeError('每日日期须使用 YYYY-MM-DD。');
    var parsed = new Date(dateString + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateString) throw new TypeError('每日日期无效。');
    var level = seeded('daily:' + dateString, 4);
    level.id = 'daily-' + dateString; level.title = '今日归巢 · ' + dateString.slice(5).replace('-', '/');
    level.date = dateString; level.seed = dateString;
    return level;
  }
  var RAW_LEVELS = /* GENERATED_LEVELS_START */ [
  {
    "id": "crane-001",
    "title": "第一声风",
    "chapter": 1,
    "seed": "main-c1-p1-v1-0",
    "width": 4,
    "height": 3,
    "board": [
      "##P#",
      "##P#",
      "P..P"
    ],
    "solution": [
      {
        "from": 2,
        "to": 10
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 8,
        "to": 10
      }
    ],
    "target": 10,
    "lesson": "高亮空位才是合法落点。",
    "stats": {
      "pegCount": 4,
      "playable": 6,
      "holes": 2,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 3,
      "maxBranches": 1,
      "searchNodes": 4,
      "targetSearchNodes": 4,
      "independentSearchNodes": 4,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,1,.;2,1,."
    }
  },
  {
    "id": "crane-002",
    "title": "小径回身",
    "chapter": 1,
    "seed": "main-c1-p2-v1-0",
    "width": 4,
    "height": 3,
    "board": [
      "P..#",
      "#P##",
      "#.PP"
    ],
    "solution": [
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 9,
        "to": 1
      },
      {
        "from": 0,
        "to": 2
      }
    ],
    "target": 2,
    "lesson": "横向和纵向都可以跳。",
    "stats": {
      "pegCount": 4,
      "playable": 7,
      "holes": 3,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 3,
      "maxBranches": 1,
      "searchNodes": 4,
      "targetSearchNodes": 4,
      "independentSearchNodes": 4,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;1,1,.;2,1,.;2,2,.;2,3,."
    }
  },
  {
    "id": "crane-003",
    "title": "檐下三折",
    "chapter": 1,
    "seed": "main-c1-p3-v1-1",
    "width": 3,
    "height": 3,
    "board": [
      ".P.",
      "##P",
      "PP."
    ],
    "solution": [
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 8,
        "to": 2
      },
      {
        "from": 2,
        "to": 0
      }
    ],
    "target": 0,
    "lesson": "跳过同伴，留下一个新的空位。",
    "stats": {
      "pegCount": 4,
      "playable": 7,
      "holes": 3,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 3,
      "maxBranches": 1,
      "searchNodes": 4,
      "targetSearchNodes": 4,
      "independentSearchNodes": 4,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;1,0,.;1,2,.;2,0,.;2,2,."
    }
  },
  {
    "id": "crane-004",
    "title": "竹篱短廊",
    "chapter": 1,
    "seed": "main-c1-p4-v1-0",
    "width": 3,
    "height": 4,
    "board": [
      "PP.",
      "##P",
      "##.",
      "##P"
    ],
    "solution": [
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 2,
        "to": 8
      },
      {
        "from": 11,
        "to": 5
      }
    ],
    "target": 5,
    "lesson": "留意外侧的纸鹤怎样回到庭中。",
    "stats": {
      "pegCount": 4,
      "playable": 6,
      "holes": 2,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 3,
      "maxBranches": 1,
      "searchNodes": 4,
      "targetSearchNodes": 4,
      "independentSearchNodes": 4,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;2,0,."
    }
  },
  {
    "id": "crane-005",
    "title": "双叶相迎",
    "chapter": 1,
    "seed": "main-c1-p5-v1-1",
    "width": 4,
    "height": 4,
    "board": [
      "#..P",
      "P..#",
      "#PP#",
      "#P##"
    ],
    "solution": [
      {
        "from": 13,
        "to": 5
      },
      {
        "from": 4,
        "to": 6
      },
      {
        "from": 10,
        "to": 2
      },
      {
        "from": 3,
        "to": 1
      }
    ],
    "target": 1,
    "lesson": "先看落点，再看落点旁边。",
    "stats": {
      "pegCount": 5,
      "playable": 9,
      "holes": 4,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 4,
      "maxBranches": 1,
      "searchNodes": 5,
      "targetSearchNodes": 5,
      "independentSearchNodes": 5,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;1,1,.;1,2,.;1,3,.;2,1,.;2,2,.;3,2,."
    }
  },
  {
    "id": "crane-006",
    "title": "池边转角",
    "chapter": 1,
    "seed": "main-c1-p6-v1-4",
    "width": 5,
    "height": 3,
    "board": [
      ".#P##",
      "P#.PP",
      ".P.##"
    ],
    "solution": [
      {
        "from": 9,
        "to": 7
      },
      {
        "from": 2,
        "to": 12
      },
      {
        "from": 12,
        "to": 10
      },
      {
        "from": 10,
        "to": 0
      }
    ],
    "target": 0,
    "lesson": "下一步可能要换一个方向。",
    "stats": {
      "pegCount": 5,
      "playable": 9,
      "holes": 4,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 4,
      "maxBranches": 1,
      "searchNodes": 5,
      "targetSearchNodes": 5,
      "independentSearchNodes": 5,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;1,0,.;1,2,.;1,3,.;1,4,.;2,0,.;2,2,."
    }
  },
  {
    "id": "crane-007",
    "title": "晨光停处",
    "chapter": 1,
    "seed": "main-c1-p7-v1-1",
    "width": 4,
    "height": 3,
    "board": [
      "P..P",
      "#P#P",
      "#.P."
    ],
    "solution": [
      {
        "from": 3,
        "to": 11
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 9,
        "to": 1
      },
      {
        "from": 0,
        "to": 2
      }
    ],
    "target": 2,
    "lesson": "看清三格一线，不走斜线。",
    "stats": {
      "pegCount": 5,
      "playable": 9,
      "holes": 4,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 4,
      "maxBranches": 1,
      "searchNodes": 5,
      "targetSearchNodes": 5,
      "independentSearchNodes": 5,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,2,.;2,0,.;2,1,.;2,2,."
    }
  },
  {
    "id": "crane-008",
    "title": "纸窗留白",
    "chapter": 1,
    "seed": "main-c1-p8-v1-11",
    "width": 4,
    "height": 4,
    "board": [
      "##P#",
      "PP..",
      "#P.#",
      "#PP#"
    ],
    "solution": [
      {
        "from": 4,
        "to": 6
      },
      {
        "from": 13,
        "to": 5
      },
      {
        "from": 2,
        "to": 10
      },
      {
        "from": 14,
        "to": 6
      },
      {
        "from": 5,
        "to": 7
      }
    ],
    "target": 7,
    "lesson": "暂时没有出口？可以撤销再试。",
    "stats": {
      "pegCount": 6,
      "playable": 9,
      "holes": 3,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 9,
      "maxBranches": 3,
      "searchNodes": 6,
      "targetSearchNodes": 6,
      "independentSearchNodes": 6,
      "shapeSignature": "0,1,.;0,2,.;1,1,.;1,2,.;2,0,.;2,1,.;2,2,.;2,3,.;3,1,."
    }
  },
  {
    "id": "crane-009",
    "title": "微风绕庭",
    "chapter": 1,
    "seed": "main-c1-p9-v1-19",
    "width": 5,
    "height": 3,
    "board": [
      ".P.P#",
      "P##P#",
      ".P..P"
    ],
    "solution": [
      {
        "from": 3,
        "to": 13
      },
      {
        "from": 14,
        "to": 12
      },
      {
        "from": 12,
        "to": 10
      },
      {
        "from": 10,
        "to": 0
      },
      {
        "from": 0,
        "to": 2
      }
    ],
    "target": 2,
    "lesson": "顺序不同，也可能一起归巢。",
    "stats": {
      "pegCount": 6,
      "playable": 11,
      "holes": 5,
      "reverseAttempts": 1,
      "initialBranches": 1,
      "solutionBranches": 6,
      "maxBranches": 2,
      "searchNodes": 7,
      "targetSearchNodes": 7,
      "independentSearchNodes": 7,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,."
    }
  },
  {
    "id": "crane-010",
    "title": "初羽归来",
    "chapter": 1,
    "seed": "main-c1-p10-v1-1",
    "width": 4,
    "height": 3,
    "board": [
      "##P#",
      "P.PP",
      "#PP."
    ],
    "solution": [
      {
        "from": 7,
        "to": 5
      },
      {
        "from": 4,
        "to": 6
      },
      {
        "from": 9,
        "to": 11
      },
      {
        "from": 2,
        "to": 10
      },
      {
        "from": 11,
        "to": 9
      }
    ],
    "target": 9,
    "lesson": "学会三格一跳，走向莲池。",
    "stats": {
      "pegCount": 6,
      "playable": 8,
      "holes": 2,
      "reverseAttempts": 1,
      "initialBranches": 2,
      "solutionBranches": 7,
      "maxBranches": 2,
      "searchNodes": 6,
      "targetSearchNodes": 6,
      "independentSearchNodes": 6,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;1,0,.;1,1,.;1,2,.;1,3,.;2,1,."
    }
  },
  {
    "id": "crane-011",
    "title": "浮莲入水",
    "chapter": 2,
    "seed": "main-c2-p1-v1-7",
    "width": 5,
    "height": 3,
    "board": [
      "#P.PP",
      "#P.PP",
      "..P.."
    ],
    "solution": [
      {
        "from": 1,
        "to": 11
      },
      {
        "from": 9,
        "to": 7
      },
      {
        "from": 11,
        "to": 13
      },
      {
        "from": 4,
        "to": 2
      },
      {
        "from": 2,
        "to": 12
      },
      {
        "from": 12,
        "to": 14
      }
    ],
    "target": 14,
    "lesson": "让横跳为竖跳留出入口。",
    "stats": {
      "pegCount": 7,
      "playable": 13,
      "holes": 6,
      "reverseAttempts": 1,
      "initialBranches": 5,
      "solutionBranches": 19,
      "maxBranches": 6,
      "searchNodes": 15,
      "targetSearchNodes": 15,
      "independentSearchNodes": 15,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,."
    }
  },
  {
    "id": "crane-012",
    "title": "曲廊相接",
    "chapter": 2,
    "seed": "main-c2-p2-v1-8",
    "width": 5,
    "height": 4,
    "board": [
      "PP.P.",
      "#.###",
      ".PP##",
      "#.PP."
    ],
    "solution": [
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 18,
        "to": 16
      },
      {
        "from": 16,
        "to": 6
      },
      {
        "from": 3,
        "to": 1
      },
      {
        "from": 1,
        "to": 11
      },
      {
        "from": 12,
        "to": 10
      }
    ],
    "target": 10,
    "lesson": "从外侧开始观察可接续的空位。",
    "stats": {
      "pegCount": 7,
      "playable": 13,
      "holes": 6,
      "reverseAttempts": 1,
      "initialBranches": 4,
      "solutionBranches": 17,
      "maxBranches": 5,
      "searchNodes": 22,
      "targetSearchNodes": 22,
      "independentSearchNodes": 22,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,1,.;2,0,.;2,1,.;2,2,.;3,1,.;3,2,.;3,3,.;3,4,."
    }
  },
  {
    "id": "crane-013",
    "title": "两岸回声",
    "chapter": 2,
    "seed": "main-c2-p3-v1-8",
    "width": 5,
    "height": 3,
    "board": [
      ".PP.#",
      "P#PP.",
      "PP..#"
    ],
    "solution": [
      {
        "from": 10,
        "to": 0
      },
      {
        "from": 2,
        "to": 12
      },
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 11,
        "to": 13
      },
      {
        "from": 13,
        "to": 3
      },
      {
        "from": 3,
        "to": 1
      }
    ],
    "target": 1,
    "lesson": "同一个落点可以先后使用。",
    "stats": {
      "pegCount": 7,
      "playable": 12,
      "holes": 5,
      "reverseAttempts": 1,
      "initialBranches": 6,
      "solutionBranches": 16,
      "maxBranches": 6,
      "searchNodes": 25,
      "targetSearchNodes": 25,
      "independentSearchNodes": 25,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,."
    }
  },
  {
    "id": "crane-014",
    "title": "荷梗轻桥",
    "chapter": 2,
    "seed": "main-c2-p4-v1-3",
    "width": 5,
    "height": 3,
    "board": [
      ".PPP#",
      "#PPP#",
      "#...P"
    ],
    "solution": [
      {
        "from": 3,
        "to": 13
      },
      {
        "from": 1,
        "to": 3
      },
      {
        "from": 14,
        "to": 12
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 3,
        "to": 13
      },
      {
        "from": 13,
        "to": 11
      }
    ],
    "target": 11,
    "lesson": "别急着拆走连接两边的同伴。",
    "stats": {
      "pegCount": 7,
      "playable": 11,
      "holes": 4,
      "reverseAttempts": 1,
      "initialBranches": 4,
      "solutionBranches": 17,
      "maxBranches": 6,
      "searchNodes": 8,
      "targetSearchNodes": 9,
      "independentSearchNodes": 9,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,1,.;1,2,.;1,3,.;2,1,.;2,2,.;2,3,.;2,4,."
    }
  },
  {
    "id": "crane-015",
    "title": "莲叶递风",
    "chapter": 2,
    "seed": "main-c2-p5-v1-21",
    "width": 5,
    "height": 4,
    "board": [
      ".####",
      "...P.",
      "P.PPP",
      "#.PPP"
    ],
    "solution": [
      {
        "from": 19,
        "to": 9
      },
      {
        "from": 13,
        "to": 11
      },
      {
        "from": 18,
        "to": 16
      },
      {
        "from": 9,
        "to": 7
      },
      {
        "from": 16,
        "to": 6
      },
      {
        "from": 7,
        "to": 5
      },
      {
        "from": 10,
        "to": 0
      }
    ],
    "target": 0,
    "lesson": "把末端纸鹤带回主路。",
    "stats": {
      "pegCount": 8,
      "playable": 15,
      "holes": 7,
      "reverseAttempts": 1,
      "initialBranches": 4,
      "solutionBranches": 22,
      "maxBranches": 6,
      "searchNodes": 20,
      "targetSearchNodes": 37,
      "independentSearchNodes": 37,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,4,."
    }
  },
  {
    "id": "crane-016",
    "title": "亭角回望",
    "chapter": 2,
    "seed": "main-c2-p6-v1-10",
    "width": 5,
    "height": 4,
    "board": [
      "#P##P",
      "#P.PP",
      "#..P.",
      "PP..."
    ],
    "solution": [
      {
        "from": 1,
        "to": 11
      },
      {
        "from": 15,
        "to": 17
      },
      {
        "from": 4,
        "to": 14
      },
      {
        "from": 14,
        "to": 12
      },
      {
        "from": 17,
        "to": 7
      },
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 6,
        "to": 16
      }
    ],
    "target": 16,
    "lesson": "看清短廊里的先后顺序。",
    "stats": {
      "pegCount": 8,
      "playable": 15,
      "holes": 7,
      "reverseAttempts": 1,
      "initialBranches": 5,
      "solutionBranches": 21,
      "maxBranches": 5,
      "searchNodes": 15,
      "targetSearchNodes": 16,
      "independentSearchNodes": 16,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,.;3,0,.;3,3,."
    }
  },
  {
    "id": "crane-017",
    "title": "水纹相续",
    "chapter": 2,
    "seed": "main-c2-p7-v1-16",
    "width": 5,
    "height": 4,
    "board": [
      "#..PP",
      ".P.#P",
      "PPP..",
      "P#.##"
    ],
    "solution": [
      {
        "from": 15,
        "to": 5
      },
      {
        "from": 4,
        "to": 14
      },
      {
        "from": 5,
        "to": 7
      },
      {
        "from": 11,
        "to": 13
      },
      {
        "from": 14,
        "to": 12
      },
      {
        "from": 12,
        "to": 2
      },
      {
        "from": 2,
        "to": 4
      }
    ],
    "target": 4,
    "lesson": "落下后，还能和谁继续跳？",
    "stats": {
      "pegCount": 8,
      "playable": 15,
      "holes": 7,
      "reverseAttempts": 1,
      "initialBranches": 5,
      "solutionBranches": 24,
      "maxBranches": 6,
      "searchNodes": 11,
      "targetSearchNodes": 11,
      "independentSearchNodes": 9,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,2,.;3,4,."
    }
  },
  {
    "id": "crane-018",
    "title": "双廊织影",
    "chapter": 2,
    "seed": "main-c2-p8-v1-8",
    "width": 5,
    "height": 4,
    "board": [
      "##.#P",
      "PP..P",
      "P.PP.",
      ".PP.."
    ],
    "solution": [
      {
        "from": 17,
        "to": 7
      },
      {
        "from": 5,
        "to": 15
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 8,
        "to": 18
      },
      {
        "from": 15,
        "to": 17
      },
      {
        "from": 17,
        "to": 19
      },
      {
        "from": 4,
        "to": 14
      },
      {
        "from": 19,
        "to": 9
      }
    ],
    "target": 9,
    "lesson": "空位会跟着每一步改变。",
    "stats": {
      "pegCount": 9,
      "playable": 17,
      "holes": 8,
      "reverseAttempts": 1,
      "initialBranches": 8,
      "solutionBranches": 26,
      "maxBranches": 8,
      "searchNodes": 26,
      "targetSearchNodes": 26,
      "independentSearchNodes": 26,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,2,."
    }
  },
  {
    "id": "crane-019",
    "title": "疏叶成路",
    "chapter": 2,
    "seed": "main-c2-p9-v1-7",
    "width": 5,
    "height": 4,
    "board": [
      "#.###",
      "..PPP",
      "#.PPP",
      "PP.P."
    ],
    "solution": [
      {
        "from": 9,
        "to": 19
      },
      {
        "from": 19,
        "to": 17
      },
      {
        "from": 13,
        "to": 11
      },
      {
        "from": 16,
        "to": 18
      },
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 6,
        "to": 16
      },
      {
        "from": 15,
        "to": 17
      },
      {
        "from": 17,
        "to": 19
      }
    ],
    "target": 19,
    "lesson": "先收一边，再照顾另一边。",
    "stats": {
      "pegCount": 9,
      "playable": 15,
      "holes": 6,
      "reverseAttempts": 1,
      "initialBranches": 5,
      "solutionBranches": 29,
      "maxBranches": 7,
      "searchNodes": 83,
      "targetSearchNodes": 83,
      "independentSearchNodes": 83,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,3,."
    }
  },
  {
    "id": "crane-020",
    "title": "莲塘小集",
    "chapter": 2,
    "seed": "main-c2-p10-v1-12",
    "width": 4,
    "height": 4,
    "board": [
      ".P#.",
      ".P.P",
      "P.PP",
      "PPP."
    ],
    "solution": [
      {
        "from": 12,
        "to": 4
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 4,
        "to": 6
      },
      {
        "from": 7,
        "to": 5
      },
      {
        "from": 15,
        "to": 7
      },
      {
        "from": 1,
        "to": 9
      },
      {
        "from": 9,
        "to": 11
      },
      {
        "from": 11,
        "to": 3
      }
    ],
    "target": 3,
    "lesson": "试着连续计划两次跳跃。",
    "stats": {
      "pegCount": 9,
      "playable": 15,
      "holes": 6,
      "reverseAttempts": 1,
      "initialBranches": 7,
      "solutionBranches": 31,
      "maxBranches": 8,
      "searchNodes": 27,
      "targetSearchNodes": 155,
      "independentSearchNodes": 158,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,1,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,.;3,0,.;3,1,.;3,3,."
    }
  },
  {
    "id": "crane-021",
    "title": "竹外一枝",
    "chapter": 3,
    "seed": "main-c3-p1-v1-12",
    "width": 5,
    "height": 5,
    "board": [
      "##.##",
      ".PP.P",
      "..PPP",
      ".PPP.",
      "#P###"
    ],
    "solution": [
      {
        "from": 9,
        "to": 19
      },
      {
        "from": 21,
        "to": 11
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 18,
        "to": 16
      },
      {
        "from": 8,
        "to": 18
      },
      {
        "from": 12,
        "to": 10
      },
      {
        "from": 19,
        "to": 17
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 15,
        "to": 5
      }
    ],
    "target": 5,
    "lesson": "先让窄支路接回庭院。",
    "stats": {
      "pegCount": 10,
      "playable": 17,
      "holes": 7,
      "reverseAttempts": 1,
      "initialBranches": 9,
      "solutionBranches": 43,
      "maxBranches": 9,
      "searchNodes": 19,
      "targetSearchNodes": 20,
      "independentSearchNodes": 20,
      "shapeSignature": "0,1,.;0,2,.;0,3,.;1,0,.;1,1,.;1,2,.;1,3,.;2,1,.;2,2,.;2,3,.;2,4,.;3,1,.;3,2,.;3,3,.;4,1,.;4,2,.;4,3,."
    }
  },
  {
    "id": "crane-022",
    "title": "折庭双径",
    "chapter": 3,
    "seed": "main-c3-p2-v1-8",
    "width": 6,
    "height": 5,
    "board": [
      "...###",
      ".PP#P#",
      ".PP.P#",
      "P.#..P",
      "P##P.#"
    ],
    "solution": [
      {
        "from": 10,
        "to": 22
      },
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 27,
        "to": 15
      },
      {
        "from": 7,
        "to": 19
      },
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 24,
        "to": 12
      },
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 12,
        "to": 0
      }
    ],
    "target": 0,
    "lesson": "有些同伴要等侧翼到齐。",
    "stats": {
      "pegCount": 10,
      "playable": 20,
      "holes": 10,
      "reverseAttempts": 1,
      "initialBranches": 8,
      "solutionBranches": 42,
      "maxBranches": 8,
      "searchNodes": 24,
      "targetSearchNodes": 25,
      "independentSearchNodes": 25,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;3,2,.;3,3,.;3,4,.;4,1,.;4,2,.;4,3,.;4,4,.;5,3,."
    }
  },
  {
    "id": "crane-023",
    "title": "风过侧门",
    "chapter": 3,
    "seed": "main-c3-p3-v1-21",
    "width": 6,
    "height": 5,
    "board": [
      "##PP.P",
      "####P.",
      "##..PP",
      ".PP.PP",
      "###..."
    ],
    "solution": [
      {
        "from": 19,
        "to": 21
      },
      {
        "from": 23,
        "to": 11
      },
      {
        "from": 2,
        "to": 4
      },
      {
        "from": 5,
        "to": 17
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 4,
        "to": 16
      },
      {
        "from": 21,
        "to": 23
      },
      {
        "from": 15,
        "to": 17
      },
      {
        "from": 17,
        "to": 29
      }
    ],
    "target": 29,
    "lesson": "留住通向边缘的一只纸鹤。",
    "stats": {
      "pegCount": 10,
      "playable": 19,
      "holes": 9,
      "reverseAttempts": 1,
      "initialBranches": 9,
      "solutionBranches": 46,
      "maxBranches": 9,
      "searchNodes": 21,
      "targetSearchNodes": 21,
      "independentSearchNodes": 40,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,4,.;3,1,.;3,2,.;3,4,.;4,1,.;5,1,."
    }
  },
  {
    "id": "crane-024",
    "title": "青石留步",
    "chapter": 3,
    "seed": "main-c3-p4-v1-7",
    "width": 5,
    "height": 5,
    "board": [
      ".PP..",
      "#PPP#",
      "#.PP#",
      "#..P.",
      "#.PP."
    ],
    "solution": [
      {
        "from": 7,
        "to": 17
      },
      {
        "from": 22,
        "to": 12
      },
      {
        "from": 2,
        "to": 0
      },
      {
        "from": 13,
        "to": 11
      },
      {
        "from": 23,
        "to": 13
      },
      {
        "from": 11,
        "to": 1
      },
      {
        "from": 13,
        "to": 3
      },
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 2,
        "to": 4
      }
    ],
    "target": 4,
    "lesson": "空位不多时，先疏通转角。",
    "stats": {
      "pegCount": 10,
      "playable": 19,
      "holes": 9,
      "reverseAttempts": 1,
      "initialBranches": 8,
      "solutionBranches": 37,
      "maxBranches": 9,
      "searchNodes": 60,
      "targetSearchNodes": 503,
      "independentSearchNodes": 500,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,1,.;1,2,.;1,3,.;2,1,.;2,2,.;2,3,.;3,0,.;3,1,.;3,2,.;3,3,.;4,0,.;4,1,.;4,2,.;4,3,."
    }
  },
  {
    "id": "crane-025",
    "title": "疏竹照影",
    "chapter": 3,
    "seed": "main-c3-p5-v1-4",
    "width": 6,
    "height": 5,
    "board": [
      "PP#.P#",
      ".P.PP.",
      "P..P.#",
      "PP#.P#",
      ".###.#"
    ],
    "solution": [
      {
        "from": 18,
        "to": 6
      },
      {
        "from": 4,
        "to": 16
      },
      {
        "from": 22,
        "to": 10
      },
      {
        "from": 0,
        "to": 12
      },
      {
        "from": 1,
        "to": 13
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 10,
        "to": 8
      },
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 7,
        "to": 9
      }
    ],
    "target": 9,
    "lesson": "试着从最后两只的位置往回想。",
    "stats": {
      "pegCount": 11,
      "playable": 21,
      "holes": 10,
      "reverseAttempts": 1,
      "initialBranches": 8,
      "solutionBranches": 54,
      "maxBranches": 8,
      "searchNodes": 82,
      "targetSearchNodes": 288,
      "independentSearchNodes": 287,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;2,1,.;2,2,.;3,0,.;3,1,.;3,2,.;3,3,.;4,0,.;4,1,.;4,2,.;4,3,.;4,4,.;5,1,."
    }
  },
  {
    "id": "crane-026",
    "title": "支路相逢",
    "chapter": 3,
    "seed": "main-c3-p6-v1-7",
    "width": 5,
    "height": 5,
    "board": [
      "#P.#P",
      "#...P",
      ".PP..",
      "#PPPP",
      "#..PP"
    ],
    "solution": [
      {
        "from": 24,
        "to": 22
      },
      {
        "from": 4,
        "to": 14
      },
      {
        "from": 16,
        "to": 6
      },
      {
        "from": 1,
        "to": 11
      },
      {
        "from": 11,
        "to": 13
      },
      {
        "from": 18,
        "to": 8
      },
      {
        "from": 19,
        "to": 9
      },
      {
        "from": 22,
        "to": 12
      },
      {
        "from": 9,
        "to": 7
      },
      {
        "from": 12,
        "to": 2
      }
    ],
    "target": 2,
    "lesson": "两边争用落点，先后会改变结果。",
    "stats": {
      "pegCount": 11,
      "playable": 20,
      "holes": 9,
      "reverseAttempts": 1,
      "initialBranches": 10,
      "solutionBranches": 49,
      "maxBranches": 10,
      "searchNodes": 556,
      "targetSearchNodes": 557,
      "independentSearchNodes": 557,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,2,."
    }
  },
  {
    "id": "crane-027",
    "title": "篱边等候",
    "chapter": 3,
    "seed": "main-c3-p7-v1-15",
    "width": 5,
    "height": 5,
    "board": [
      "#PP.#",
      "#PPP#",
      ".P.PP",
      "#..#.",
      ".PP.P"
    ],
    "solution": [
      {
        "from": 14,
        "to": 12
      },
      {
        "from": 1,
        "to": 3
      },
      {
        "from": 3,
        "to": 13
      },
      {
        "from": 21,
        "to": 23
      },
      {
        "from": 6,
        "to": 16
      },
      {
        "from": 24,
        "to": 22
      },
      {
        "from": 7,
        "to": 17
      },
      {
        "from": 22,
        "to": 12
      },
      {
        "from": 13,
        "to": 11
      },
      {
        "from": 16,
        "to": 6
      }
    ],
    "target": 6,
    "lesson": "不要让孤单纸鹤失去搭桥同伴。",
    "stats": {
      "pegCount": 11,
      "playable": 19,
      "holes": 8,
      "reverseAttempts": 1,
      "initialBranches": 7,
      "solutionBranches": 54,
      "maxBranches": 9,
      "searchNodes": 38,
      "targetSearchNodes": 39,
      "independentSearchNodes": 35,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,1,.;3,2,.;3,3,.;4,1,.;4,2,.;4,3,."
    }
  },
  {
    "id": "crane-028",
    "title": "叶间回廊",
    "chapter": 3,
    "seed": "main-c3-p8-v1-18",
    "width": 6,
    "height": 5,
    "board": [
      ".P.PP#",
      "PP.P##",
      "..PP.#",
      "P#..##",
      "P##.PP"
    ],
    "solution": [
      {
        "from": 4,
        "to": 2
      },
      {
        "from": 29,
        "to": 27
      },
      {
        "from": 24,
        "to": 12
      },
      {
        "from": 9,
        "to": 21
      },
      {
        "from": 27,
        "to": 15
      },
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 1,
        "to": 3
      },
      {
        "from": 14,
        "to": 2
      },
      {
        "from": 2,
        "to": 4
      }
    ],
    "target": 4,
    "lesson": "边缘与中央需要轮流接力。",
    "stats": {
      "pegCount": 12,
      "playable": 21,
      "holes": 9,
      "reverseAttempts": 1,
      "initialBranches": 8,
      "solutionBranches": 69,
      "maxBranches": 10,
      "searchNodes": 781,
      "targetSearchNodes": 781,
      "independentSearchNodes": 781,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,2,.;3,3,.;4,0,.;4,3,.;4,4,.;4,5,."
    }
  },
  {
    "id": "crane-029",
    "title": "清风接力",
    "chapter": 3,
    "seed": "main-c3-p9-v1-11",
    "width": 6,
    "height": 4,
    "board": [
      "#.##P#",
      "PPP.PP",
      ".PP..#",
      "PP.P.P"
    ],
    "solution": [
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 8,
        "to": 10
      },
      {
        "from": 18,
        "to": 20
      },
      {
        "from": 4,
        "to": 16
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 16,
        "to": 14
      },
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 8,
        "to": 20
      },
      {
        "from": 21,
        "to": 19
      }
    ],
    "target": 19,
    "lesson": "一条支路清空后，再接下一条。",
    "stats": {
      "pegCount": 12,
      "playable": 19,
      "holes": 7,
      "reverseAttempts": 1,
      "initialBranches": 8,
      "solutionBranches": 57,
      "maxBranches": 9,
      "searchNodes": 142,
      "targetSearchNodes": 142,
      "independentSearchNodes": 142,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,1,.;3,4,."
    }
  },
  {
    "id": "crane-030",
    "title": "竹庭归拢",
    "chapter": 3,
    "seed": "main-c3-p10-v1-18",
    "width": 5,
    "height": 5,
    "board": [
      "#.PP#",
      ".P.PP",
      "#P.P.",
      "#PP.P",
      "#.PP."
    ],
    "solution": [
      {
        "from": 22,
        "to": 24
      },
      {
        "from": 16,
        "to": 18
      },
      {
        "from": 24,
        "to": 14
      },
      {
        "from": 14,
        "to": 12
      },
      {
        "from": 9,
        "to": 7
      },
      {
        "from": 11,
        "to": 13
      },
      {
        "from": 3,
        "to": 1
      },
      {
        "from": 18,
        "to": 8
      },
      {
        "from": 1,
        "to": 11
      },
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 6,
        "to": 16
      }
    ],
    "target": 16,
    "lesson": "把支路看作几段可以相接的短廊。",
    "stats": {
      "pegCount": 12,
      "playable": 20,
      "holes": 8,
      "reverseAttempts": 1,
      "initialBranches": 9,
      "solutionBranches": 61,
      "maxBranches": 9,
      "searchNodes": 458,
      "targetSearchNodes": 459,
      "independentSearchNodes": 494,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,3,."
    }
  },
  {
    "id": "crane-031",
    "title": "雨后开桥",
    "chapter": 4,
    "seed": "main-c4-p1-v1-19",
    "width": 6,
    "height": 5,
    "board": [
      "P.PP.#",
      "##PPP.",
      "#P..PP",
      ".PP.P.",
      "#....."
    ],
    "solution": [
      {
        "from": 3,
        "to": 1
      },
      {
        "from": 9,
        "to": 11
      },
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 2,
        "to": 14
      },
      {
        "from": 14,
        "to": 26
      },
      {
        "from": 16,
        "to": 28
      },
      {
        "from": 13,
        "to": 25
      },
      {
        "from": 25,
        "to": 27
      },
      {
        "from": 27,
        "to": 29
      },
      {
        "from": 11,
        "to": 23
      },
      {
        "from": 29,
        "to": 17
      }
    ],
    "target": 17,
    "lesson": "找出连接上下庭院的通道。",
    "stats": {
      "pegCount": 12,
      "playable": 25,
      "holes": 13,
      "reverseAttempts": 1,
      "initialBranches": 11,
      "solutionBranches": 59,
      "maxBranches": 11,
      "searchNodes": 2706,
      "targetSearchNodes": 2822,
      "independentSearchNodes": 2795,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,1,.;3,2,.;3,3,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,."
    }
  },
  {
    "id": "crane-032",
    "title": "檐雨回声",
    "chapter": 4,
    "seed": "main-c4-p2-v1-6",
    "width": 6,
    "height": 5,
    "board": [
      "##.PP.",
      "#P.PPP",
      ".P..P.",
      "P..P.#",
      "##PP.#"
    ],
    "solution": [
      {
        "from": 7,
        "to": 19
      },
      {
        "from": 3,
        "to": 5
      },
      {
        "from": 18,
        "to": 20
      },
      {
        "from": 5,
        "to": 17
      },
      {
        "from": 26,
        "to": 28
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 10,
        "to": 8
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 28,
        "to": 16
      },
      {
        "from": 16,
        "to": 14
      },
      {
        "from": 14,
        "to": 2
      }
    ],
    "target": 2,
    "lesson": "先收拢远端，再穿过回桥。",
    "stats": {
      "pegCount": 12,
      "playable": 23,
      "holes": 11,
      "reverseAttempts": 1,
      "initialBranches": 8,
      "solutionBranches": 64,
      "maxBranches": 10,
      "searchNodes": 43,
      "targetSearchNodes": 218,
      "independentSearchNodes": 218,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,1,.;4,2,.;4,3,."
    }
  },
  {
    "id": "crane-033",
    "title": "石阶相让",
    "chapter": 4,
    "seed": "main-c4-p3-v1-10",
    "width": 6,
    "height": 4,
    "board": [
      "PPP.##",
      "PPP.P.",
      ".P.PP.",
      ".PP..#"
    ],
    "solution": [
      {
        "from": 0,
        "to": 12
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 10,
        "to": 22
      },
      {
        "from": 1,
        "to": 3
      },
      {
        "from": 14,
        "to": 16
      },
      {
        "from": 7,
        "to": 9
      },
      {
        "from": 3,
        "to": 15
      },
      {
        "from": 22,
        "to": 10
      },
      {
        "from": 19,
        "to": 21
      },
      {
        "from": 21,
        "to": 9
      },
      {
        "from": 10,
        "to": 8
      }
    ],
    "target": 8,
    "lesson": "暂留一对相邻纸鹤，为下一跳搭桥。",
    "stats": {
      "pegCount": 12,
      "playable": 21,
      "holes": 9,
      "reverseAttempts": 1,
      "initialBranches": 9,
      "solutionBranches": 65,
      "maxBranches": 11,
      "searchNodes": 138,
      "targetSearchNodes": 138,
      "independentSearchNodes": 138,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,."
    }
  },
  {
    "id": "crane-034",
    "title": "折返微澜",
    "chapter": 4,
    "seed": "main-c4-p4-v1-4",
    "width": 6,
    "height": 5,
    "board": [
      "##.P.#",
      "#.PPP#",
      "P.PPP.",
      "##.PPP",
      "###..P"
    ],
    "solution": [
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 14,
        "to": 2
      },
      {
        "from": 29,
        "to": 17
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 9,
        "to": 21
      },
      {
        "from": 2,
        "to": 4
      },
      {
        "from": 4,
        "to": 16
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 16,
        "to": 28
      }
    ],
    "target": 28,
    "lesson": "同一位置可以多次成为起点或落点。",
    "stats": {
      "pegCount": 12,
      "playable": 20,
      "holes": 8,
      "reverseAttempts": 1,
      "initialBranches": 10,
      "solutionBranches": 55,
      "maxBranches": 10,
      "searchNodes": 856,
      "targetSearchNodes": 856,
      "independentSearchNodes": 857,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,1,.;3,2,.;3,3,.;3,4,.;4,2,.;4,3,.;5,2,."
    }
  },
  {
    "id": "crane-035",
    "title": "双桥会面",
    "chapter": 4,
    "seed": "main-c4-p5-v1-7",
    "width": 6,
    "height": 5,
    "board": [
      "PP...#",
      "P#P.P#",
      ".PPPP.",
      ".PPP.#",
      "#P####"
    ],
    "solution": [
      {
        "from": 21,
        "to": 9
      },
      {
        "from": 14,
        "to": 2
      },
      {
        "from": 1,
        "to": 3
      },
      {
        "from": 0,
        "to": 12
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 16,
        "to": 4
      },
      {
        "from": 25,
        "to": 13
      },
      {
        "from": 20,
        "to": 8
      },
      {
        "from": 4,
        "to": 2
      },
      {
        "from": 2,
        "to": 14
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 15,
        "to": 3
      }
    ],
    "target": 3,
    "lesson": "把几条短路线按先后接起来。",
    "stats": {
      "pegCount": 13,
      "playable": 21,
      "holes": 8,
      "reverseAttempts": 1,
      "initialBranches": 10,
      "solutionBranches": 68,
      "maxBranches": 10,
      "searchNodes": 662,
      "targetSearchNodes": 3815,
      "independentSearchNodes": 3815,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,1,."
    }
  },
  {
    "id": "crane-036",
    "title": "远岸一羽",
    "chapter": 4,
    "seed": "main-c4-p6-v1-2",
    "width": 6,
    "height": 5,
    "board": [
      "##.###",
      "P.PPPP",
      ".PP.P.",
      "#P.PP#",
      "PP...."
    ],
    "solution": [
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 9,
        "to": 7
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 8,
        "to": 10
      },
      {
        "from": 10,
        "to": 22
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 19,
        "to": 21
      },
      {
        "from": 15,
        "to": 27
      },
      {
        "from": 26,
        "to": 28
      },
      {
        "from": 28,
        "to": 16
      }
    ],
    "target": 16,
    "lesson": "先观察最难回来的那一只。",
    "stats": {
      "pegCount": 13,
      "playable": 23,
      "holes": 10,
      "reverseAttempts": 1,
      "initialBranches": 9,
      "solutionBranches": 74,
      "maxBranches": 9,
      "searchNodes": 470,
      "targetSearchNodes": 1443,
      "independentSearchNodes": 1446,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,2,."
    }
  },
  {
    "id": "crane-037",
    "title": "桥心留鹤",
    "chapter": 4,
    "seed": "main-c4-p7-v1-8",
    "width": 5,
    "height": 5,
    "board": [
      ".PP..",
      "..PPP",
      "P.PP.",
      "PP.P.",
      "..PP."
    ],
    "solution": [
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 2,
        "to": 0
      },
      {
        "from": 15,
        "to": 5
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 21,
        "to": 11
      },
      {
        "from": 9,
        "to": 19
      },
      {
        "from": 6,
        "to": 16
      },
      {
        "from": 19,
        "to": 17
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 0,
        "to": 10
      },
      {
        "from": 10,
        "to": 20
      }
    ],
    "target": 20,
    "lesson": "每移走一只，也要想谁会用到它。",
    "stats": {
      "pegCount": 13,
      "playable": 25,
      "holes": 12,
      "reverseAttempts": 1,
      "initialBranches": 12,
      "solutionBranches": 73,
      "maxBranches": 12,
      "searchNodes": 162,
      "targetSearchNodes": 2610,
      "independentSearchNodes": 2610,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,0,.;4,1,.;4,2,.;4,3,.;4,4,."
    }
  },
  {
    "id": "crane-038",
    "title": "雨丝成线",
    "chapter": 4,
    "seed": "main-c4-p8-v1-5",
    "width": 6,
    "height": 5,
    "board": [
      "#PP.P.",
      "..PPPP",
      ".PPPP.",
      "#P.PP.",
      "###.##"
    ],
    "solution": [
      {
        "from": 1,
        "to": 3
      },
      {
        "from": 3,
        "to": 5
      },
      {
        "from": 8,
        "to": 20
      },
      {
        "from": 10,
        "to": 8
      },
      {
        "from": 5,
        "to": 17
      },
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 7,
        "to": 9
      },
      {
        "from": 22,
        "to": 10
      },
      {
        "from": 9,
        "to": 11
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 11,
        "to": 23
      },
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 15,
        "to": 27
      }
    ],
    "target": 27,
    "lesson": "空位通路可能需要一次折返。",
    "stats": {
      "pegCount": 14,
      "playable": 23,
      "holes": 9,
      "reverseAttempts": 1,
      "initialBranches": 10,
      "solutionBranches": 87,
      "maxBranches": 12,
      "searchNodes": 32,
      "targetSearchNodes": 45,
      "independentSearchNodes": 33,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,2,."
    }
  },
  {
    "id": "crane-039",
    "title": "回廊候晴",
    "chapter": 4,
    "seed": "main-c4-p9-v1-21",
    "width": 6,
    "height": 5,
    "board": [
      "#.PP##",
      "PP..PP",
      "#.P.PP",
      "#PP.PP",
      ".P...#"
    ],
    "solution": [
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 2,
        "to": 14
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 3,
        "to": 15
      },
      {
        "from": 14,
        "to": 26
      },
      {
        "from": 15,
        "to": 27
      },
      {
        "from": 26,
        "to": 24
      },
      {
        "from": 13,
        "to": 25
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 26,
        "to": 28
      }
    ],
    "target": 28,
    "lesson": "看完两侧，再决定第一跳。",
    "stats": {
      "pegCount": 14,
      "playable": 24,
      "holes": 10,
      "reverseAttempts": 1,
      "initialBranches": 10,
      "solutionBranches": 72,
      "maxBranches": 10,
      "searchNodes": 81,
      "targetSearchNodes": 4986,
      "independentSearchNodes": 4986,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,1,.;4,2,.;4,3,."
    }
  },
  {
    "id": "crane-040",
    "title": "水光同归",
    "chapter": 4,
    "seed": "main-c4-p10-v1-22",
    "width": 6,
    "height": 5,
    "board": [
      ".PP###",
      ".P.PP#",
      "..PPP.",
      "PP..P#",
      ".PP.P."
    ],
    "solution": [
      {
        "from": 10,
        "to": 8
      },
      {
        "from": 2,
        "to": 0
      },
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 25,
        "to": 27
      },
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 0,
        "to": 12
      },
      {
        "from": 27,
        "to": 29
      },
      {
        "from": 16,
        "to": 28
      },
      {
        "from": 13,
        "to": 25
      },
      {
        "from": 12,
        "to": 24
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 29,
        "to": 27
      },
      {
        "from": 27,
        "to": 25
      }
    ],
    "target": 25,
    "lesson": "莲印可作额外终点挑战，任一余鹤仍算通关。",
    "stats": {
      "pegCount": 14,
      "playable": 25,
      "holes": 11,
      "reverseAttempts": 1,
      "initialBranches": 10,
      "solutionBranches": 87,
      "maxBranches": 12,
      "searchNodes": 55,
      "targetSearchNodes": 56,
      "independentSearchNodes": 61,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,0,.;4,1,.;4,2,."
    }
  },
  {
    "id": "crane-041",
    "title": "月门初开",
    "chapter": 5,
    "seed": "main-c5-p1-v1-21",
    "width": 6,
    "height": 5,
    "board": [
      ".#####",
      ".P.PP.",
      "P....P",
      "PPP.PP",
      "#PP.PP"
    ],
    "solution": [
      {
        "from": 18,
        "to": 6
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 29,
        "to": 27
      },
      {
        "from": 9,
        "to": 7
      },
      {
        "from": 25,
        "to": 13
      },
      {
        "from": 7,
        "to": 19
      },
      {
        "from": 19,
        "to": 21
      },
      {
        "from": 23,
        "to": 11
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 27,
        "to": 15
      },
      {
        "from": 9,
        "to": 21
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 26,
        "to": 14
      }
    ],
    "target": 14,
    "lesson": "让外庭依次向内汇合。",
    "stats": {
      "pegCount": 14,
      "playable": 24,
      "holes": 10,
      "reverseAttempts": 1,
      "initialBranches": 11,
      "solutionBranches": 88,
      "maxBranches": 12,
      "searchNodes": 2446,
      "targetSearchNodes": 2446,
      "independentSearchNodes": 2447,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,5,."
    }
  },
  {
    "id": "crane-042",
    "title": "两院通风",
    "chapter": 5,
    "seed": "main-c5-p2-v1-0",
    "width": 6,
    "height": 6,
    "board": [
      "P..###",
      "PP.PP.",
      ".PPP##",
      "PPPP.#",
      "PP..##",
      "#.####"
    ],
    "solution": [
      {
        "from": 10,
        "to": 8
      },
      {
        "from": 14,
        "to": 26
      },
      {
        "from": 15,
        "to": 27
      },
      {
        "from": 19,
        "to": 31
      },
      {
        "from": 27,
        "to": 25
      },
      {
        "from": 13,
        "to": 1
      },
      {
        "from": 24,
        "to": 12
      },
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 2,
        "to": 14
      },
      {
        "from": 31,
        "to": 19
      },
      {
        "from": 6,
        "to": 18
      },
      {
        "from": 18,
        "to": 20
      },
      {
        "from": 20,
        "to": 8
      }
    ],
    "target": 8,
    "lesson": "先打开一侧，再让另一侧接上。",
    "stats": {
      "pegCount": 14,
      "playable": 23,
      "holes": 9,
      "reverseAttempts": 1,
      "initialBranches": 13,
      "solutionBranches": 73,
      "maxBranches": 13,
      "searchNodes": 3890,
      "targetSearchNodes": 6683,
      "independentSearchNodes": 6683,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,1,.;3,2,.;3,3,.;3,4,.;4,1,.;4,3,.;5,1,."
    }
  },
  {
    "id": "crane-043",
    "title": "灯下留白",
    "chapter": 5,
    "seed": "main-c5-p3-v1-3",
    "width": 6,
    "height": 6,
    "board": [
      "....PP",
      ".P.PP.",
      "PP...#",
      "PPP.PP",
      "#PP###",
      "#..###"
    ],
    "solution": [
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 26,
        "to": 14
      },
      {
        "from": 5,
        "to": 3
      },
      {
        "from": 18,
        "to": 6
      },
      {
        "from": 14,
        "to": 12
      },
      {
        "from": 3,
        "to": 15
      },
      {
        "from": 25,
        "to": 13
      },
      {
        "from": 21,
        "to": 9
      },
      {
        "from": 13,
        "to": 1
      },
      {
        "from": 12,
        "to": 0
      },
      {
        "from": 10,
        "to": 8
      },
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 2,
        "to": 14
      }
    ],
    "target": 14,
    "lesson": "不要一次用完中央的搭桥同伴。",
    "stats": {
      "pegCount": 14,
      "playable": 27,
      "holes": 13,
      "reverseAttempts": 1,
      "initialBranches": 12,
      "solutionBranches": 86,
      "maxBranches": 12,
      "searchNodes": 5920,
      "targetSearchNodes": 5921,
      "independentSearchNodes": 5921,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,1,.;4,2,.;5,1,.;5,2,."
    }
  },
  {
    "id": "crane-044",
    "title": "池角清辉",
    "chapter": 5,
    "seed": "main-c5-p4-v1-15",
    "width": 6,
    "height": 6,
    "board": [
      "#..#.#",
      ".P.PP.",
      "PPP..#",
      ".PPPP#",
      ".PPP.#",
      "#P..##"
    ],
    "solution": [
      {
        "from": 20,
        "to": 18
      },
      {
        "from": 26,
        "to": 28
      },
      {
        "from": 31,
        "to": 19
      },
      {
        "from": 18,
        "to": 6
      },
      {
        "from": 28,
        "to": 16
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 10,
        "to": 22
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 19,
        "to": 21
      },
      {
        "from": 8,
        "to": 10
      },
      {
        "from": 21,
        "to": 9
      },
      {
        "from": 10,
        "to": 8
      }
    ],
    "target": 8,
    "lesson": "选择能给边角留下出口的跳法。",
    "stats": {
      "pegCount": 14,
      "playable": 27,
      "holes": 13,
      "reverseAttempts": 1,
      "initialBranches": 11,
      "solutionBranches": 91,
      "maxBranches": 13,
      "searchNodes": 12289,
      "targetSearchNodes": 12290,
      "independentSearchNodes": 12290,
      "shapeSignature": "0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,.;5,4,."
    }
  },
  {
    "id": "crane-045",
    "title": "疏影成行",
    "chapter": 5,
    "seed": "main-c5-p5-v1-16",
    "width": 6,
    "height": 6,
    "board": [
      "#PP..#",
      "#.#.#.",
      "PP..PP",
      ".PP.PP",
      "P.P.PP",
      "P##..#"
    ],
    "solution": [
      {
        "from": 30,
        "to": 18
      },
      {
        "from": 29,
        "to": 27
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 12,
        "to": 24
      },
      {
        "from": 1,
        "to": 3
      },
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 27,
        "to": 25
      },
      {
        "from": 21,
        "to": 9
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 26,
        "to": 14
      },
      {
        "from": 3,
        "to": 15
      },
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 13,
        "to": 1
      }
    ],
    "target": 1,
    "lesson": "先把远处分散的纸鹤连成一段。",
    "stats": {
      "pegCount": 15,
      "playable": 28,
      "holes": 13,
      "reverseAttempts": 1,
      "initialBranches": 13,
      "solutionBranches": 100,
      "maxBranches": 14,
      "searchNodes": 8335,
      "targetSearchNodes": 8336,
      "independentSearchNodes": 9451,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,1,.;2,2,.;2,3,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,0,.;4,1,.;4,2,.;4,3,.;4,5,.;5,1,.;5,2,.;5,3,.;5,4,."
    }
  },
  {
    "id": "crane-046",
    "title": "空庭月步",
    "chapter": 5,
    "seed": "main-c5-p6-v1-22",
    "width": 6,
    "height": 6,
    "board": [
      "#....P",
      ".P.PP.",
      "PP.PP#",
      "PPPPP.",
      "PP.###",
      "#.####"
    ],
    "solution": [
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 26,
        "to": 14
      },
      {
        "from": 18,
        "to": 6
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 9,
        "to": 21
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 16,
        "to": 4
      },
      {
        "from": 5,
        "to": 3
      },
      {
        "from": 14,
        "to": 2
      },
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 21,
        "to": 19
      },
      {
        "from": 3,
        "to": 1
      },
      {
        "from": 1,
        "to": 13
      },
      {
        "from": 19,
        "to": 7
      }
    ],
    "target": 7,
    "lesson": "空位的顺序和纸鹤的顺序一样重要。",
    "stats": {
      "pegCount": 15,
      "playable": 26,
      "holes": 11,
      "reverseAttempts": 1,
      "initialBranches": 11,
      "solutionBranches": 111,
      "maxBranches": 14,
      "searchNodes": 16829,
      "targetSearchNodes": 18157,
      "independentSearchNodes": 18151,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,3,.;4,4,.;4,5,.;5,4,."
    }
  },
  {
    "id": "crane-047",
    "title": "外廊折月",
    "chapter": 5,
    "seed": "main-c5-p7-v1-4",
    "width": 6,
    "height": 6,
    "board": [
      "#.##.#",
      ".P.PP.",
      "#PP.PP",
      "#P.PP#",
      "#PP.P.",
      "#...PP"
    ],
    "solution": [
      {
        "from": 10,
        "to": 8
      },
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 6,
        "to": 8
      },
      {
        "from": 8,
        "to": 20
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 26,
        "to": 14
      },
      {
        "from": 35,
        "to": 33
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 14,
        "to": 26
      },
      {
        "from": 25,
        "to": 27
      },
      {
        "from": 33,
        "to": 21
      },
      {
        "from": 15,
        "to": 27
      },
      {
        "from": 27,
        "to": 29
      }
    ],
    "target": 29,
    "lesson": "短暂向外跳，也能为归巢铺路。",
    "stats": {
      "pegCount": 15,
      "playable": 27,
      "holes": 12,
      "reverseAttempts": 1,
      "initialBranches": 10,
      "solutionBranches": 82,
      "maxBranches": 11,
      "searchNodes": 13770,
      "targetSearchNodes": 13770,
      "independentSearchNodes": 13778,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,0,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,.;5,1,.;5,4,."
    }
  },
  {
    "id": "crane-048",
    "title": "窄门回声",
    "chapter": 5,
    "seed": "main-c5-p8-v1-6",
    "width": 6,
    "height": 6,
    "board": [
      "###P##",
      "###P##",
      "PP.PP.",
      "##P..P",
      "PP.PP.",
      ".PPPP."
    ],
    "solution": [
      {
        "from": 15,
        "to": 17
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 3,
        "to": 15
      },
      {
        "from": 14,
        "to": 16
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 33,
        "to": 21
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 34,
        "to": 22
      },
      {
        "from": 15,
        "to": 27
      },
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 26,
        "to": 28
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 31,
        "to": 33
      },
      {
        "from": 22,
        "to": 34
      },
      {
        "from": 33,
        "to": 35
      }
    ],
    "target": 35,
    "lesson": "观察哪些支路必须先清理。",
    "stats": {
      "pegCount": 16,
      "playable": 24,
      "holes": 8,
      "reverseAttempts": 1,
      "initialBranches": 11,
      "solutionBranches": 102,
      "maxBranches": 11,
      "searchNodes": 1499,
      "targetSearchNodes": 15570,
      "independentSearchNodes": 15713,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,2,.;5,2,."
    }
  },
  {
    "id": "crane-049",
    "title": "万籁轻起",
    "chapter": 5,
    "seed": "main-c5-p9-v1-18",
    "width": 6,
    "height": 6,
    "board": [
      "#.##.#",
      ".PPPP.",
      "PPP.PP",
      ".P.PP.",
      "##.PP.",
      "#PP..."
    ],
    "solution": [
      {
        "from": 21,
        "to": 23
      },
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 6,
        "to": 18
      },
      {
        "from": 17,
        "to": 29
      },
      {
        "from": 18,
        "to": 20
      },
      {
        "from": 15,
        "to": 17
      },
      {
        "from": 31,
        "to": 33
      },
      {
        "from": 28,
        "to": 26
      },
      {
        "from": 20,
        "to": 32
      },
      {
        "from": 32,
        "to": 34
      },
      {
        "from": 9,
        "to": 11
      },
      {
        "from": 11,
        "to": 23
      },
      {
        "from": 23,
        "to": 35
      },
      {
        "from": 35,
        "to": 33
      }
    ],
    "target": 33,
    "lesson": "每一步都检查有没有失去同伴的纸鹤。",
    "stats": {
      "pegCount": 16,
      "playable": 29,
      "holes": 13,
      "reverseAttempts": 1,
      "initialBranches": 15,
      "solutionBranches": 106,
      "maxBranches": 15,
      "searchNodes": 34166,
      "targetSearchNodes": 34166,
      "independentSearchNodes": 34166,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,0,.;4,2,.;4,3,.;4,4,.;4,5,.;5,2,.;5,3,.;5,4,."
    }
  },
  {
    "id": "crane-050",
    "title": "满院归心",
    "chapter": 5,
    "seed": "main-c5-p10-v1-17",
    "width": 6,
    "height": 6,
    "board": [
      "#P..##",
      "#PP.PP",
      "PP.P.#",
      ".PP...",
      "PPPPP.",
      "#P...."
    ],
    "solution": [
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 8,
        "to": 10
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 20,
        "to": 32
      },
      {
        "from": 14,
        "to": 16
      },
      {
        "from": 10,
        "to": 22
      },
      {
        "from": 31,
        "to": 33
      },
      {
        "from": 1,
        "to": 13
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 33,
        "to": 21
      },
      {
        "from": 13,
        "to": 25
      },
      {
        "from": 21,
        "to": 23
      },
      {
        "from": 25,
        "to": 27
      },
      {
        "from": 27,
        "to": 29
      },
      {
        "from": 23,
        "to": 35
      }
    ],
    "target": 35,
    "lesson": "把整个庭院看成相互接力的几段路。",
    "stats": {
      "pegCount": 16,
      "playable": 30,
      "holes": 14,
      "reverseAttempts": 1,
      "initialBranches": 8,
      "solutionBranches": 96,
      "maxBranches": 9,
      "searchNodes": 21191,
      "targetSearchNodes": 33197,
      "independentSearchNodes": 32868,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,0,.;4,1,.;4,2,.;4,3,.;4,4,.;5,2,.;5,3,.;5,4,."
    }
  },
  {
    "id": "crane-051",
    "title": "星桥远信",
    "chapter": 6,
    "seed": "main-c6-p1-v1-13",
    "width": 6,
    "height": 6,
    "board": [
      "###.##",
      ".#PP.P",
      "PP.PP.",
      "P.PP..",
      ".PP.PP",
      "PP###."
    ],
    "solution": [
      {
        "from": 29,
        "to": 27
      },
      {
        "from": 31,
        "to": 19
      },
      {
        "from": 26,
        "to": 14
      },
      {
        "from": 12,
        "to": 24
      },
      {
        "from": 30,
        "to": 18
      },
      {
        "from": 15,
        "to": 17
      },
      {
        "from": 11,
        "to": 23
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 18,
        "to": 20
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 9,
        "to": 21
      },
      {
        "from": 27,
        "to": 15
      },
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 21,
        "to": 9
      },
      {
        "from": 8,
        "to": 10
      }
    ],
    "target": 10,
    "lesson": "从最偏远的纸鹤开始规划。",
    "stats": {
      "pegCount": 16,
      "playable": 27,
      "holes": 11,
      "reverseAttempts": 1,
      "initialBranches": 15,
      "solutionBranches": 94,
      "maxBranches": 15,
      "searchNodes": 8965,
      "targetSearchNodes": 21114,
      "independentSearchNodes": 20634,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;2,1,.;2,2,.;2,3,.;2,4,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,1,.;4,2,.;4,3,.;4,4,.;5,0,.;5,1,.;5,2,.;5,3,.;5,4,."
    }
  },
  {
    "id": "crane-052",
    "title": "长庭交织",
    "chapter": 6,
    "seed": "main-c6-p2-v1-5",
    "width": 6,
    "height": 6,
    "board": [
      "..PP##",
      "P.PP.P",
      "...PP.",
      "#PPP#P",
      "#PPP#P",
      "###.##"
    ],
    "solution": [
      {
        "from": 16,
        "to": 14
      },
      {
        "from": 25,
        "to": 13
      },
      {
        "from": 3,
        "to": 1
      },
      {
        "from": 29,
        "to": 17
      },
      {
        "from": 14,
        "to": 12
      },
      {
        "from": 12,
        "to": 0
      },
      {
        "from": 8,
        "to": 10
      },
      {
        "from": 26,
        "to": 14
      },
      {
        "from": 27,
        "to": 15
      },
      {
        "from": 14,
        "to": 16
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 15,
        "to": 3
      },
      {
        "from": 3,
        "to": 1
      }
    ],
    "target": 1,
    "lesson": "边庭和中庭需要交错归拢。",
    "stats": {
      "pegCount": 16,
      "playable": 25,
      "holes": 9,
      "reverseAttempts": 1,
      "initialBranches": 10,
      "solutionBranches": 95,
      "maxBranches": 11,
      "searchNodes": 3338,
      "targetSearchNodes": 17363,
      "independentSearchNodes": 17698,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,1,.;3,2,.;3,3,.;3,5,.;4,1,.;4,2,.;4,3,.;4,5,.;5,3,."
    }
  },
  {
    "id": "crane-053",
    "title": "银河留渡",
    "chapter": 6,
    "seed": "main-c6-p3-v1-22",
    "width": 6,
    "height": 6,
    "board": [
      ".P..##",
      "PPP.PP",
      "P.PP..",
      "#..PPP",
      "#P.PPP",
      "###..#"
    ],
    "solution": [
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 12,
        "to": 0
      },
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 29,
        "to": 17
      },
      {
        "from": 7,
        "to": 19
      },
      {
        "from": 25,
        "to": 13
      },
      {
        "from": 28,
        "to": 26
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 26,
        "to": 14
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 2,
        "to": 14
      },
      {
        "from": 14,
        "to": 16
      },
      {
        "from": 17,
        "to": 15
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 15,
        "to": 3
      }
    ],
    "target": 3,
    "lesson": "留住关键通道上的接力同伴。",
    "stats": {
      "pegCount": 16,
      "playable": 28,
      "holes": 12,
      "reverseAttempts": 1,
      "initialBranches": 15,
      "solutionBranches": 118,
      "maxBranches": 15,
      "searchNodes": 1917,
      "targetSearchNodes": 24859,
      "independentSearchNodes": 24864,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,.;5,3,.;5,4,."
    }
  },
  {
    "id": "crane-054",
    "title": "三羽望归",
    "chapter": 6,
    "seed": "main-c6-p4-v1-0",
    "width": 6,
    "height": 6,
    "board": [
      ".P.P..",
      "#PPP.#",
      "#.P.PP",
      "#P#.PP",
      ".PP.P.",
      "##PP.P"
    ],
    "solution": [
      {
        "from": 14,
        "to": 2
      },
      {
        "from": 22,
        "to": 10
      },
      {
        "from": 32,
        "to": 34
      },
      {
        "from": 10,
        "to": 8
      },
      {
        "from": 35,
        "to": 33
      },
      {
        "from": 1,
        "to": 13
      },
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 25,
        "to": 27
      },
      {
        "from": 33,
        "to": 21
      },
      {
        "from": 7,
        "to": 9
      },
      {
        "from": 17,
        "to": 29
      },
      {
        "from": 29,
        "to": 27
      },
      {
        "from": 2,
        "to": 4
      },
      {
        "from": 27,
        "to": 15
      },
      {
        "from": 15,
        "to": 3
      },
      {
        "from": 3,
        "to": 5
      }
    ],
    "target": 5,
    "lesson": "先试想最后三只纸鹤的形状。",
    "stats": {
      "pegCount": 17,
      "playable": 29,
      "holes": 12,
      "reverseAttempts": 1,
      "initialBranches": 13,
      "solutionBranches": 113,
      "maxBranches": 13,
      "searchNodes": 13402,
      "targetSearchNodes": 18128,
      "independentSearchNodes": 18763,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;3,0,.;3,1,.;3,2,.;3,4,.;4,0,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,.;5,0,.;5,1,.;5,2,.;5,3,."
    }
  },
  {
    "id": "crane-055",
    "title": "星芒分径",
    "chapter": 6,
    "seed": "main-c6-p5-v1-8",
    "width": 6,
    "height": 6,
    "board": [
      "PP.#P#",
      ".PPP.#",
      "..PPP#",
      "#P.PP#",
      "PP.PP.",
      "##P..#"
    ],
    "solution": [
      {
        "from": 8,
        "to": 6
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 32,
        "to": 20
      },
      {
        "from": 15,
        "to": 13
      },
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 22,
        "to": 10
      },
      {
        "from": 1,
        "to": 13
      },
      {
        "from": 0,
        "to": 12
      },
      {
        "from": 12,
        "to": 14
      },
      {
        "from": 4,
        "to": 16
      },
      {
        "from": 20,
        "to": 8
      },
      {
        "from": 21,
        "to": 33
      },
      {
        "from": 8,
        "to": 10
      },
      {
        "from": 10,
        "to": 22
      },
      {
        "from": 22,
        "to": 34
      },
      {
        "from": 34,
        "to": 32
      }
    ],
    "target": 32,
    "lesson": "分支多时，可以逐段试演并撤销。",
    "stats": {
      "pegCount": 17,
      "playable": 27,
      "holes": 10,
      "reverseAttempts": 1,
      "initialBranches": 15,
      "solutionBranches": 128,
      "maxBranches": 15,
      "searchNodes": 4231,
      "targetSearchNodes": 29252,
      "independentSearchNodes": 29282,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,0,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,.;5,4,."
    }
  },
  {
    "id": "crane-056",
    "title": "双岸相守",
    "chapter": 6,
    "seed": "main-c6-p6-v1-20",
    "width": 6,
    "height": 6,
    "board": [
      "#P..##",
      "PPPPP.",
      "P.PPPP",
      "...PPP",
      "P.PP..",
      "##.#P#"
    ],
    "solution": [
      {
        "from": 1,
        "to": 13
      },
      {
        "from": 16,
        "to": 28
      },
      {
        "from": 34,
        "to": 22
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 23,
        "to": 11
      },
      {
        "from": 9,
        "to": 21
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 27,
        "to": 25
      },
      {
        "from": 6,
        "to": 18
      },
      {
        "from": 21,
        "to": 19
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 18,
        "to": 20
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 26,
        "to": 14
      },
      {
        "from": 15,
        "to": 3
      },
      {
        "from": 14,
        "to": 2
      },
      {
        "from": 3,
        "to": 1
      }
    ],
    "target": 1,
    "lesson": "不要把两侧过早分开。",
    "stats": {
      "pegCount": 18,
      "playable": 29,
      "holes": 11,
      "reverseAttempts": 1,
      "initialBranches": 13,
      "solutionBranches": 150,
      "maxBranches": 13,
      "searchNodes": 1263,
      "targetSearchNodes": 30918,
      "independentSearchNodes": 31043,
      "shapeSignature": "0,1,.;0,2,.;0,3,.;0,4,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,.;5,1,.;5,2,.;5,3,.;5,4,."
    }
  },
  {
    "id": "crane-057",
    "title": "天际折返",
    "chapter": 6,
    "seed": "main-c6-p7-v1-19",
    "width": 6,
    "height": 6,
    "board": [
      "PP.PP.",
      "#PP...",
      "#.PP.#",
      ".P.PP#",
      "P##PP.",
      "P#P.PP"
    ],
    "solution": [
      {
        "from": 14,
        "to": 16
      },
      {
        "from": 22,
        "to": 10
      },
      {
        "from": 30,
        "to": 18
      },
      {
        "from": 27,
        "to": 15
      },
      {
        "from": 4,
        "to": 16
      },
      {
        "from": 35,
        "to": 33
      },
      {
        "from": 18,
        "to": 20
      },
      {
        "from": 0,
        "to": 2
      },
      {
        "from": 32,
        "to": 34
      },
      {
        "from": 34,
        "to": 22
      },
      {
        "from": 7,
        "to": 9
      },
      {
        "from": 2,
        "to": 4
      },
      {
        "from": 22,
        "to": 10
      },
      {
        "from": 9,
        "to": 21
      },
      {
        "from": 4,
        "to": 16
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 16,
        "to": 28
      }
    ],
    "target": 28,
    "lesson": "一次折返可能连起新的路线。",
    "stats": {
      "pegCount": 18,
      "playable": 29,
      "holes": 11,
      "reverseAttempts": 1,
      "initialBranches": 16,
      "solutionBranches": 121,
      "maxBranches": 16,
      "searchNodes": 38464,
      "targetSearchNodes": 38464,
      "independentSearchNodes": 38490,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,1,.;2,2,.;2,3,.;2,4,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,0,.;4,1,.;4,2,.;4,5,.;5,0,.;5,1,.;5,2,.;5,3,.;5,5,."
    }
  },
  {
    "id": "crane-058",
    "title": "深院出口",
    "chapter": 6,
    "seed": "main-c6-p8-v1-10",
    "width": 6,
    "height": 6,
    "board": [
      "#.PP##",
      "#PP..#",
      "#P#P.#",
      ".PP.PP",
      "P..PPP",
      "PPPP.."
    ],
    "solution": [
      {
        "from": 3,
        "to": 1
      },
      {
        "from": 32,
        "to": 34
      },
      {
        "from": 19,
        "to": 21
      },
      {
        "from": 23,
        "to": 35
      },
      {
        "from": 7,
        "to": 19
      },
      {
        "from": 35,
        "to": 33
      },
      {
        "from": 21,
        "to": 9
      },
      {
        "from": 9,
        "to": 7
      },
      {
        "from": 1,
        "to": 13
      },
      {
        "from": 30,
        "to": 32
      },
      {
        "from": 33,
        "to": 21
      },
      {
        "from": 13,
        "to": 25
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 28,
        "to": 16
      },
      {
        "from": 32,
        "to": 20
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 22,
        "to": 10
      }
    ],
    "target": 10,
    "lesson": "先处理狭窄出口，再收拢中央。",
    "stats": {
      "pegCount": 18,
      "playable": 28,
      "holes": 10,
      "reverseAttempts": 1,
      "initialBranches": 14,
      "solutionBranches": 133,
      "maxBranches": 14,
      "searchNodes": 15616,
      "targetSearchNodes": 15617,
      "independentSearchNodes": 15617,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;1,5,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,1,.;3,2,.;3,4,.;4,1,.;4,2,.;4,3,.;4,4,.;5,2,.;5,3,.;5,4,."
    }
  },
  {
    "id": "crane-059",
    "title": "千纸流光",
    "chapter": 6,
    "seed": "main-c6-p9-v1-9",
    "width": 6,
    "height": 6,
    "board": [
      "PP####",
      "P.P.PP",
      ".PP.P.",
      ".P.PPP",
      "PPPP.P",
      "P#...#"
    ],
    "solution": [
      {
        "from": 19,
        "to": 7
      },
      {
        "from": 30,
        "to": 18
      },
      {
        "from": 0,
        "to": 12
      },
      {
        "from": 11,
        "to": 9
      },
      {
        "from": 8,
        "to": 10
      },
      {
        "from": 12,
        "to": 24
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 10,
        "to": 22
      },
      {
        "from": 1,
        "to": 13
      },
      {
        "from": 26,
        "to": 28
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 23,
        "to": 21
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 29,
        "to": 27
      },
      {
        "from": 13,
        "to": 15
      },
      {
        "from": 26,
        "to": 28
      },
      {
        "from": 28,
        "to": 16
      },
      {
        "from": 15,
        "to": 17
      }
    ],
    "target": 17,
    "lesson": "想好先后，再让整庭纸鹤依次起落。",
    "stats": {
      "pegCount": 19,
      "playable": 30,
      "holes": 11,
      "reverseAttempts": 1,
      "initialBranches": 13,
      "solutionBranches": 142,
      "maxBranches": 14,
      "searchNodes": 6187,
      "targetSearchNodes": 23256,
      "independentSearchNodes": 36886,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;0,5,.;1,0,.;1,1,.;1,2,.;1,3,.;1,4,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,.;5,1,.;5,2,.;5,3,.;5,4,."
    }
  },
  {
    "id": "crane-060",
    "title": "万里归巢",
    "chapter": 6,
    "seed": "main-c6-p10-v1-21",
    "width": 6,
    "height": 6,
    "board": [
      "##P.P.",
      ".#PPPP",
      "PPPP.P",
      "PP...#",
      ".PPPP#",
      ".#.PP#"
    ],
    "solution": [
      {
        "from": 33,
        "to": 21
      },
      {
        "from": 8,
        "to": 20
      },
      {
        "from": 17,
        "to": 5
      },
      {
        "from": 20,
        "to": 22
      },
      {
        "from": 5,
        "to": 3
      },
      {
        "from": 2,
        "to": 4
      },
      {
        "from": 25,
        "to": 27
      },
      {
        "from": 4,
        "to": 16
      },
      {
        "from": 9,
        "to": 21
      },
      {
        "from": 13,
        "to": 25
      },
      {
        "from": 12,
        "to": 24
      },
      {
        "from": 22,
        "to": 20
      },
      {
        "from": 34,
        "to": 22
      },
      {
        "from": 16,
        "to": 28
      },
      {
        "from": 24,
        "to": 26
      },
      {
        "from": 20,
        "to": 32
      },
      {
        "from": 28,
        "to": 26
      },
      {
        "from": 32,
        "to": 20
      }
    ],
    "target": 20,
    "lesson": "慢慢完成最后一庭；归巢没有时间限制。",
    "stats": {
      "pegCount": 19,
      "playable": 29,
      "holes": 10,
      "reverseAttempts": 1,
      "initialBranches": 13,
      "solutionBranches": 149,
      "maxBranches": 15,
      "searchNodes": 5451,
      "targetSearchNodes": 15817,
      "independentSearchNodes": 13763,
      "shapeSignature": "0,0,.;0,1,.;0,2,.;0,3,.;0,4,.;1,1,.;1,2,.;1,3,.;2,0,.;2,1,.;2,2,.;2,3,.;2,4,.;2,5,.;3,0,.;3,1,.;3,2,.;3,3,.;3,4,.;3,5,.;4,0,.;4,1,.;4,2,.;4,3,.;4,4,.;4,5,.;5,3,.;5,4,.;5,5,."
    }
  }
] /* GENERATED_LEVELS_END */;
  var levels = RAW_LEVELS.map(function (level) { level.board = Object.freeze(level.board); level.solution = Object.freeze(level.solution.map(function (move) { return Object.freeze(move); })); level.stats = Object.freeze(level.stats); return Object.freeze(level); });
  function find(id) { for (var i = 0; i < levels.length; i += 1) if (levels[i].id === id) return levels[i]; return null; }
  root.CraneLevels = { levels: Object.freeze(levels), chapters: chapters, find: find, daily: daily, seeded: seeded, generate: generate, parameters: parameter, lessons: lessons, tutorialId: 'crane-001' };
})(typeof window !== 'undefined' ? window : this);
