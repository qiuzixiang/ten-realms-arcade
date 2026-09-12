/* Four Seasons Dye Journey · Flood rule engine. MIT; source attribution in RULES.md. */
var Dye = typeof Dye !== 'undefined' ? Dye : {};
(function () {
  'use strict';
  var MAX_HISTORY = 512;
  function integer(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function validBoard(board, level) {
    return !!level && integer(level.width) && integer(level.height) && level.width >= 1 && level.height >= 1 &&
      level.width * level.height >= 2 && level.width <= 10 && level.height <= 10 &&
      integer(level.colours) && level.colours >= 3 && level.colours <= 6 && Array.isArray(board) &&
      board.length === level.width * level.height && board.every(function (c) { return integer(c) && c >= 0 && c < level.colours; });
  }
  function neighbours(index, width, height) {
    var result = [], x = index % width, y = Math.floor(index / width);
    if (x > 0) result.push(index - 1);
    if (x + 1 < width) result.push(index + 1);
    if (y > 0) result.push(index - width);
    if (y + 1 < height) result.push(index + width);
    return result;
  }
  function component(board, width, height, start) {
    if (start === undefined) start = 0;
    if (!Array.isArray(board) || !integer(width) || !integer(height) || width < 1 || height < 1 ||
        board.length !== width * height || !integer(start) || start < 0 || start >= board.length) return [];
    var seen = [], queue = [start], colour = board[start], head, i, next;
    seen[start] = true;
    for (head = 0; head < queue.length; head += 1) {
      next = neighbours(queue[head], width, height);
      for (i = 0; i < next.length; i += 1) {
        if (!seen[next[i]] && board[next[i]] === colour) { seen[next[i]] = true; queue.push(next[i]); }
      }
    }
    return queue;
  }
  function complete(board) {
    return Array.isArray(board) && board.length > 0 && board.every(function (colour) {
      return integer(colour) && colour >= 0 && colour <= 5 && colour === board[0];
    });
  }
  function fill(board, width, height, colour) {
    if (!integer(width) || !integer(height) || width < 1 || height < 1 || width > 10 || height > 10 ||
        !Array.isArray(board) || board.length !== width * height || board.length < 2 ||
        !board.every(function (c) { return integer(c) && c >= 0 && c <= 5; }) || !integer(colour) || colour < 0 || colour > 5) {
      return { accepted: false, board: board, reason: 'invalid-input' };
    }
    if (colour === board[0]) return { accepted: false, board: board, reason: 'same-colour' };
    var old = component(board, width, height, 0), next = board.slice(), set = [], i;
    for (i = 0; i < old.length; i += 1) { next[old[i]] = colour; set[old[i]] = true; }
    var controlled = component(next, width, height, 0);
    var absorbed = controlled.filter(function (index) { return !set[index]; });
    return { accepted: true, board: next, recoloured: old, absorbed: absorbed, controlled: controlled, expandedBy: absorbed.length };
  }
  function validateLevel(level) {
    return !!level && typeof level.id === 'string' && level.id.length > 0 && level.id.length <= 160 &&
      validBoard(level.initialBoard, level) && !complete(level.initialBoard) && integer(level.moveLimit) &&
      level.moveLimit > 0 && level.moveLimit <= MAX_HISTORY && integer(level.referenceMoves) &&
      level.referenceMoves > 0 && level.referenceMoves <= level.moveLimit && Array.isArray(level.referencePath) &&
      level.referencePath.length === level.referenceMoves && level.referencePath.every(function (c) { return integer(c) && c >= 0 && c < level.colours; });
  }
  function statusFor(board, moves, limit) {
    if (complete(board) && moves <= limit) return 'won';
    if (moves >= limit) return 'over-limit';
    return 'playing';
  }
  function validRunId(runId) { return typeof runId === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(runId); }
  function create(level, runId) {
    if (!validateLevel(level) || !validRunId(runId)) return null;
    return { version: 1, levelId: level.id, board: level.initialBoard.slice(), moves: 0, timeline: [],
      status: 'playing', controlled: component(level.initialBoard, level.width, level.height).length,
      runId: runId, hints: 0, wastes: 0 };
  }
  function move(state, level, colour) {
    if (!state || !validateLevel(level) || state.levelId !== level.id || !validBoard(state.board, level) ||
        !Array.isArray(state.timeline) || state.moves !== state.timeline.length) return { accepted: false, state: state, reason: 'invalid-state' };
    if (!integer(colour) || colour < 0 || colour >= level.colours) return { accepted: false, state: state, reason: 'invalid-colour' };
    if (complete(state.board)) return { accepted: false, state: state, reason: 'complete' };
    if (colour === state.board[0]) return { accepted: false, state: state, reason: 'same-colour' };
    if (state.timeline.length >= MAX_HISTORY) return { accepted: false, state: state, reason: 'history-limit' };
    var result = fill(state.board, level.width, level.height, colour), moves = state.moves + 1;
    var next = { version: 1, levelId: level.id, board: result.board, moves: moves,
      timeline: state.timeline.concat([colour]), status: statusFor(result.board, moves, level.moveLimit),
      controlled: result.controlled.length, runId: state.runId, hints: state.hints,
      wastes: state.wastes + (result.expandedBy === 0 ? 1 : 0) };
    return { accepted: true, state: next, expandedBy: result.expandedBy, recoloured: result.recoloured, absorbed: result.absorbed };
  }
  function replay(level, runId, timeline, hints) {
    var state = create(level, runId), result, i;
    if (!state || !Array.isArray(timeline) || timeline.length > MAX_HISTORY || !integer(hints) || hints < 0 || hints > 10000) return null;
    for (i = 0; i < timeline.length; i += 1) {
      result = move(state, level, timeline[i]);
      if (!result.accepted) return null;
      state = result.state;
    }
    state.hints = hints;
    return state;
  }
  function undo(state, level) {
    if (!state || !Array.isArray(state.timeline) || !state.timeline.length) return state;
    return replay(level, state.runId, state.timeline.slice(0, -1), state.hints) || state;
  }
  function restore(raw, resolveLevel) {
    try {
      var value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!value || value.version !== 1 || typeof resolveLevel !== 'function' || typeof value.levelId !== 'string' || !validRunId(value.runId)) return null;
      var level = resolveLevel(value.levelId, value);
      if (!level || level.id !== value.levelId) return null;
      var state = replay(level, value.runId, value.timeline, value.hints);
      if (!state) return null;
      if (value.moves !== undefined && value.moves !== state.moves) return null;
      if (value.status !== undefined && value.status !== state.status) return null;
      if (value.board !== undefined && (!Array.isArray(value.board) || value.board.length !== state.board.length ||
          value.board.some(function (c, i) { return c !== state.board[i]; }))) return null;
      if (value.controlled !== undefined && value.controlled !== state.controlled) return null;
      if (value.wastes !== undefined && value.wastes !== state.wastes) return null;
      return state;
    } catch (error) { return null; }
  }
  function serialize(state) {
    if (!state || state.version !== 1 || !validRunId(state.runId) || !Array.isArray(state.timeline) || state.timeline.length > MAX_HISTORY) return null;
    return { version: 1, levelId: state.levelId, runId: state.runId, timeline: state.timeline.slice(), hints: state.hints };
  }
  /* 0/1 shortest-path heuristic: crossing a colour boundary costs one future dye. */
  function metrics(board, width, height) {
    var distance = [], queued = [], queue = [0], head = 0, i, next, cell, cost, far = 0, number = 0, total = 0, control = 0;
    for (i = 0; i < board.length; i += 1) distance[i] = Infinity;
    distance[0] = 0; queued[0] = true;
    while (head < queue.length) {
      cell = queue[head]; head += 1; queued[cell] = false;
      next = neighbours(cell, width, height);
      for (i = 0; i < next.length; i += 1) {
        cost = distance[cell] + (board[next[i]] === board[cell] ? 0 : 1);
        if (cost < distance[next[i]]) {
          distance[next[i]] = cost;
          if (!queued[next[i]]) { queued[next[i]] = true; queue.push(next[i]); }
        }
      }
    }
    for (i = 0; i < distance.length; i += 1) {
      if (distance[i] > far) { far = distance[i]; number = 1; } else if (distance[i] === far) number += 1;
      total += distance[i]; if (distance[i] === 0) control += 1;
    }
    return { far: far, number: number, total: total, control: control };
  }
  function better(a, b) {
    if (!b) return true;
    if (a.far !== b.far) return a.far < b.far;
    if (a.number !== b.number) return a.number < b.number;
    if (a.total !== b.total) return a.total < b.total;
    return a.control > b.control;
  }
  function choose(board, level, depth) {
    var best = null, colour, result, score;
    for (colour = 0; colour < level.colours; colour += 1) {
      if (colour === board[0]) continue;
      result = fill(board, level.width, level.height, colour);
      if (result.expandedBy === 0) continue;
      if (complete(result.board)) return { colour: colour, far: -1, number: -depth, total: 0, control: board.length };
      score = depth > 1 ? choose(result.board, level, depth - 1) : metrics(result.board, level.width, level.height);
      if (score && better(score, best)) best = { colour: colour, far: score.far, number: score.number, total: score.total, control: score.control };
    }
    return best;
  }
  function solve(board, level) {
    if (!validBoard(board, level)) return null;
    var current = board.slice(), path = [], choice, result;
    while (!complete(current) && path.length < board.length) {
      choice = choose(current, level, 2);
      if (!choice) return null;
      result = fill(current, level.width, level.height, choice.colour);
      if (!result.accepted || result.expandedBy <= 0) return null;
      path.push(choice.colour); current = result.board;
    }
    return complete(current) ? path : null;
  }
  function suggest(board, level) {
    if (!validBoard(board, level) || complete(board)) return null;
    var path = solve(board, level);
    if (!path || !path.length) return null;
    var result = fill(board, level.width, level.height, path[0]);
    return { color: path[0], path: path, expandedBy: result.expandedBy };
  }
  Dye.Engine = { MAX_HISTORY: MAX_HISTORY, create: create, move: move, undo: undo, restore: restore,
    serialize: serialize, complete: complete, fill: fill, component: component, validateLevel: validateLevel,
    validateBoard: validBoard, solve: solve, suggest: suggest, metrics: metrics };
}());

;
/* Deterministic original level catalogue and replay modes. MIT. */
var Dye = typeof Dye !== 'undefined' ? Dye : {};
(function () {
  'use strict';
  var Engine = Dye.Engine, cache = {}, cacheKeys = [];
  var chapters = [
    { id: 1, name: '春芽初染', season: '春', subtitle: '从一角出发，让相邻的颜色相逢。' },
    { id: 2, name: '溪桥晾绸', season: '暮春', subtitle: '看见转角，连起散落的小染池。' },
    { id: 3, name: '荷风织夏', season: '夏', subtitle: '在经纬之间，安排染色的先后。' },
    { id: 4, name: '秋山拾锦', season: '秋', subtitle: '循着支流，照顾远处的每一片。' },
    { id: 5, name: '霜庭暖染', season: '冬', subtitle: '六味染料，织成耐心的冬日长幅。' },
    { id: 6, name: '四时合卷', season: '四时', subtitle: '把四季的手艺，收进自己的锦卷。' }
  ];
  var textureNames = { terraces: '水田层染', diagonal: '斜纹溪流', pools: '散池相逢', weave: '经纬交织', rings: '回纹流转', mosaic: '碎锦合幅' };
  var names = [
    ['第一缕春色', '相邻的枝芽', '染过小桥', '转角新绿', '一池春水', '左右相逢', '细雨阶田', '沿溪问色', '双叶连枝', '春巷织纹', '远处的花', '春芽成幅'],
    ['溪桥晨晾', '绸带拐弯', '池塘照影', '两岸相连', '雨后斜纹', '挑一条支流', '穿过染池', '把远色接近', '错落经纬', '桥边小锦', '暮春长巷', '溪绸成幅'],
    ['荷叶初展', '夏风穿梭', '双池映荷', '菱纹入水', '长短经线', '绕过曲径', '莲心回纹', '染满一支流', '散落的藕节', '织出清凉', '远岸候色', '荷风成幅'],
    ['秋叶入锦', '拾色山径', '层峦叠染', '穿过锦市', '四方回廊', '先近后远', '经纬分岔', '一池秋光', '斜阳碎锦', '照顾角落', '山路重逢', '秋山成幅'],
    ['霜落窗棂', '暖池生烟', '六味初会', '回廊听雪', '双线穿梭', '霜枝连色', '雪径转折', '碎锦藏暖', '最远的灯', '冬夜长幅', '合拢支流', '霜庭成幅'],
    ['四时开卷', '春溪入夏', '荷纹映秋', '霜色织春', '六色回环', '经纬千结', '曲水归池', '锦上山河', '循色而行', '远近同染', '四季长卷', '染旅大成']
  ];
  function normalizeSeed(value) {
    if (typeof value === 'number' && isFinite(value)) return Math.floor(value) >>> 0;
    var text = String(value === undefined || value === null ? '' : value).trim(), hash = 2166136261, i;
    if (/^[0-9]+$/.test(text)) return parseInt(text, 10) >>> 0;
    if (!text) return 1;
    for (i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function randomFor(seed) {
    var state = normalizeSeed(seed);
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      var value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }
  function generateBoard(seed, size, colours, topology, complexity) {
    var random = randomFor(seed), board = [], palette = [], i, j, temp, x, y, value;
    for (i = 0; i < colours; i += 1) palette.push(i);
    for (i = colours - 1; i > 0; i -= 1) { j = Math.floor(random() * (i + 1)); temp = palette[i]; palette[i] = palette[j]; palette[j] = temp; }
    var phase = Math.floor(random() * colours), offset = Math.floor(random() * 3), centers = [], centerCount = Math.max(5, Math.floor(size * size * (0.24 + complexity * 0.02)));
    if (topology === 'pools') {
      for (i = 0; i < centerCount; i += 1) centers.push({ x: random() * size, y: random() * size, c: Math.floor(random() * colours) });
    }
    for (y = 0; y < size; y += 1) {
      for (x = 0; x < size; x += 1) {
        if (topology === 'terraces') {
          value = y + Math.floor(x / (complexity < 3 ? 3 : 2)) + phase;
          if (random() < complexity * 0.045) value += Math.floor(random() * colours);
        } else if (topology === 'diagonal') {
          value = Math.floor((x + y + (Math.floor(x / 3) % 2)) / (complexity < 2 ? 2 : 1)) + phase;
          if (random() < complexity * 0.025) value += 1 + Math.floor(random() * (colours - 1));
        } else if (topology === 'pools') {
          var best = Infinity, nearest = 0;
          for (j = 0; j < centers.length; j += 1) {
            var dx = x - centers[j].x, dy = y - centers[j].y, distance = dx * dx + dy * dy;
            if (distance < best) { best = distance; nearest = j; }
          }
          value = centers[nearest].c;
          if (random() < Math.max(0, complexity - 2) * 0.07) value = Math.floor(random() * colours);
        } else if (topology === 'weave') {
          value = Math.floor(x / 2) + Math.floor(y / 2) * (1 + offset) + ((x % 2 && y % 2) ? 1 : 0) + phase;
          if (random() < complexity * 0.035) value += Math.floor(random() * colours);
        } else if (topology === 'rings') {
          value = Math.min(x, y, size - 1 - x, size - 1 - y) + Math.floor((x + y) / 3) + phase;
          if (random() < complexity * 0.04) value = Math.floor(random() * colours);
        } else {
          value = Math.floor(random() * colours);
          if (x > 0 && random() < Math.max(0.12, 0.44 - complexity * 0.045)) value = board[board.length - 1];
          else if (y > 0 && random() < 0.18) value = board[board.length - size];
          board.push(value); continue;
        }
        board.push(palette[value % colours]);
      }
    }
    /* Keep all selected dyes visible and ensure a nontrivial upper-left start. */
    var missingColour = false;
    for (i = 0; i < colours; i += 1) if (board.indexOf(i) === -1) missingColour = true;
    if (missingColour) for (i = 0; i < colours; i += 1) board[board.length - 1 - i] = i;
    if (Engine.complete(board)) board[board.length - 1] = (board[0] + 1) % colours;
    return board;
  }
  function buildLevel(options) {
    var board = options.board || generateBoard(options.seed, options.size, options.colours, options.topology, options.complexity || 3);
    var shell = { width: options.size, height: options.size, colours: options.colours };
    var path = Engine.solve(board, shell);
    if (!path || !path.length) throw new Error('Reference route generation failed: ' + options.id);
    return { id: options.id, mode: options.mode || 'campaign', chapter: options.chapter || 0, index: options.index || 0,
      name: options.name, width: options.size, height: options.size, colours: options.colours, initialBoard: board,
      referencePath: path, referenceMoves: path.length, moveLimit: path.length + options.leniency,
      seed: normalizeSeed(options.seed), topology: options.topology, topologyName: textureNames[options.topology],
      lesson: options.lesson || '先观察连区边缘，再想一想下一次相逢。' };
  }
  function remember(level) {
    Object.freeze(level.initialBoard); Object.freeze(level.referencePath); Object.freeze(level);
    cache[level.id] = level; cacheKeys.push(level.id);
    if (cacheKeys.length > 576) delete cache[cacheKeys.shift()];
    return level;
  }
  function daily(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    var parsed = new Date(day + 'T00:00:00Z');
    if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return null;
    var id = 'daily:' + day;
    if (cache[id]) return cache[id];
    var seed = normalizeSeed('season-dye-journey:daily:v1:' + day), types = ['pools', 'weave', 'rings', 'diagonal', 'mosaic', 'terraces'];
    return remember(buildLevel({ id: id, mode: 'daily', name: '今日配色 · ' + day, seed: seed, size: 7,
      colours: 5, topology: types[seed % types.length], complexity: 4, leniency: 3,
      lesson: '同一天是同一块布；按自己的节奏完成，错过不扣奖励。' }));
  }
  function workshop(seed, size, colours) {
    size = Number(size); colours = Number(colours);
    if ([4, 5, 6, 7, 8, 9, 10].indexOf(size) === -1 || [3, 4, 5, 6].indexOf(colours) === -1) return null;
    seed = normalizeSeed(seed);
    var id = 'workshop:' + seed + ':' + size + ':' + colours;
    if (cache[id]) return cache[id];
    var types = ['pools', 'weave', 'rings', 'diagonal', 'mosaic', 'terraces'];
    return remember(buildLevel({ id: id, mode: 'workshop', name: '自由工坊 · ' + seed, seed: seed, size: size,
      colours: colours, topology: types[seed % types.length], complexity: Math.max(1, size - 3), leniency: 5,
      lesson: '同一染方与规格会重现同一布面，适合比较自己的新路线。' }));
  }
  var all = [
    {"id":"c1-01","mode":"campaign","chapter":1,"index":1,"name":"第一缕春色","width":4,"height":4,"colours":3,"initialBoard":[0,0,1,1,0,0,1,1,1,1,2,2,1,1,2,2],"referencePath":[1,2],"referenceMoves":2,"moveLimit":6,"seed":202710080,"topology":"tutorial","topologyName":"三色初染","lesson":"选新颜色，左上染区会与相邻同色布片连成一片。"},
    {"id":"c1-02","mode":"campaign","chapter":1,"index":2,"name":"相邻的枝芽","width":4,"height":4,"colours":3,"initialBoard":[0,1,1,0,0,0,1,2,0,0,2,2,0,0,0,2],"referencePath":[1,0,2],"referenceMoves":3,"moveLimit":7,"seed":202711083,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c1-03","mode":"campaign","chapter":1,"index":3,"name":"染过小桥","width":4,"height":4,"colours":3,"initialBoard":[0,0,1,2,0,1,1,2,1,1,2,0,1,2,2,0],"referencePath":[1,2,0],"referenceMoves":3,"moveLimit":7,"seed":202712080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c1-04","mode":"campaign","chapter":1,"index":4,"name":"转角新绿","width":4,"height":4,"colours":3,"initialBoard":[2,2,1,1,2,1,1,0,0,0,2,2,0,2,2,1],"referencePath":[1,0,2,1],"referenceMoves":4,"moveLimit":8,"seed":202713082,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c1-05","mode":"campaign","chapter":1,"index":5,"name":"一池春水","width":4,"height":4,"colours":3,"initialBoard":[2,0,2,1,2,1,0,1,2,0,0,1,1,1,1,0],"referencePath":[0,1,0,2],"referenceMoves":4,"moveLimit":8,"seed":202714087,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c1-06","mode":"campaign","chapter":1,"index":6,"name":"左右相逢","width":4,"height":4,"colours":3,"initialBoard":[2,2,2,1,0,1,1,1,2,0,1,1,2,1,0,2],"referencePath":[1,0,1,2],"referenceMoves":4,"moveLimit":8,"seed":202715081,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c1-07","mode":"campaign","chapter":1,"index":7,"name":"细雨阶田","width":4,"height":4,"colours":3,"initialBoard":[0,0,0,2,2,2,2,1,1,1,1,0,0,0,0,2],"referencePath":[2,1,0,2],"referenceMoves":4,"moveLimit":8,"seed":202716080,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c1-08","mode":"campaign","chapter":1,"index":8,"name":"沿溪问色","width":4,"height":4,"colours":3,"initialBoard":[0,0,0,0,1,0,0,2,1,1,2,0,1,1,1,0],"referencePath":[1,0,2],"referenceMoves":3,"moveLimit":7,"seed":202717083,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c1-09","mode":"campaign","chapter":1,"index":9,"name":"双叶连枝","width":5,"height":5,"colours":3,"initialBoard":[0,0,2,2,2,1,1,1,2,0,1,1,2,0,0,1,2,2,0,1,2,2,0,1,1],"referencePath":[2,0,1,0,2],"referenceMoves":5,"moveLimit":9,"seed":202718089,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c1-10","mode":"campaign","chapter":1,"index":10,"name":"春巷织纹","width":5,"height":5,"colours":3,"initialBoard":[1,2,0,0,1,2,2,0,1,1,1,1,2,2,0,1,2,2,0,0,0,1,1,1,2],"referencePath":[2,1,2,0,1,2],"referenceMoves":6,"moveLimit":10,"seed":202719081,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c1-11","mode":"campaign","chapter":1,"index":11,"name":"远处的花","width":5,"height":5,"colours":3,"initialBoard":[2,2,2,0,1,2,0,1,1,0,2,1,2,1,1,0,1,1,2,1,0,0,1,1,1],"referencePath":[0,1,0,2],"referenceMoves":4,"moveLimit":8,"seed":202720081,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c1-12","mode":"campaign","chapter":1,"index":12,"name":"春芽成幅","width":5,"height":5,"colours":3,"initialBoard":[1,2,2,0,1,2,2,2,1,2,1,0,2,0,0,0,2,2,0,1,1,2,1,2,0],"referencePath":[2,0,1,0,2],"referenceMoves":5,"moveLimit":9,"seed":202721080,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c2-01","mode":"campaign","chapter":2,"index":1,"name":"溪桥晨晾","width":5,"height":5,"colours":3,"initialBoard":[0,0,1,1,0,0,0,1,1,0,1,1,1,0,1,1,1,1,0,1,1,1,2,1,0],"referencePath":[1,0,1,0,2],"referenceMoves":5,"moveLimit":9,"seed":202810095,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c2-02","mode":"campaign","chapter":2,"index":2,"name":"绸带拐弯","width":5,"height":5,"colours":3,"initialBoard":[2,1,0,1,0,1,0,2,0,2,0,2,1,2,1,2,1,0,1,0,1,0,2,0,2],"referencePath":[1,0,2,1,0,1,0,1,2],"referenceMoves":9,"moveLimit":12,"seed":202811080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c2-03","mode":"campaign","chapter":2,"index":3,"name":"池塘照影","width":5,"height":5,"colours":3,"initialBoard":[1,1,0,0,2,1,0,0,2,2,2,2,1,0,1,2,1,1,0,0,0,0,2,2,1],"referencePath":[0,1,0,1,2],"referenceMoves":5,"moveLimit":9,"seed":202812088,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c2-04","mode":"campaign","chapter":2,"index":4,"name":"两岸相连","width":5,"height":5,"colours":3,"initialBoard":[2,0,0,2,2,0,2,1,1,2,0,1,0,0,1,2,1,1,0,1,2,2,1,2,1],"referencePath":[0,2,1,0,2],"referenceMoves":5,"moveLimit":8,"seed":202813108,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c2-05","mode":"campaign","chapter":2,"index":5,"name":"雨后斜纹","width":5,"height":5,"colours":4,"initialBoard":[1,0,1,1,1,2,2,2,3,3,3,0,0,1,3,2,2,0,3,0,1,3,2,3,1],"referencePath":[2,0,2,3,0,1],"referenceMoves":6,"moveLimit":10,"seed":202814080,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c2-06","mode":"campaign","chapter":2,"index":6,"name":"挑一条支流","width":5,"height":5,"colours":4,"initialBoard":[1,1,2,0,0,0,2,0,3,3,3,3,1,2,2,2,2,2,1,1,1,1,1,0,0],"referencePath":[2,3,2,1,0,2,3],"referenceMoves":7,"moveLimit":10,"seed":202815088,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c2-07","mode":"campaign","chapter":2,"index":7,"name":"穿过染池","width":6,"height":6,"colours":4,"initialBoard":[0,1,1,2,0,0,0,0,1,2,2,0,2,2,1,2,2,0,2,3,3,2,2,2,1,1,1,2,3,3,1,1,1,3,3,3],"referencePath":[1,2,1,0,3],"referenceMoves":5,"moveLimit":9,"seed":202816082,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c2-08","mode":"campaign","chapter":2,"index":8,"name":"把远色接近","width":6,"height":6,"colours":4,"initialBoard":[1,0,2,1,0,1,0,2,3,0,2,3,2,2,1,2,0,1,3,1,0,3,1,0,1,0,2,1,0,2,0,1,3,0,2,3],"referencePath":[0,2,1,0,3,1,0,2,1,3],"referenceMoves":10,"moveLimit":13,"seed":202817081,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c2-09","mode":"campaign","chapter":2,"index":9,"name":"错落经纬","width":6,"height":6,"colours":4,"initialBoard":[3,0,1,1,2,2,0,1,1,2,2,3,3,3,0,0,1,1,3,0,0,1,1,2,2,2,0,3,0,0,2,3,3,0,0,1],"referencePath":[0,1,0,1,0,2,1,3],"referenceMoves":8,"moveLimit":12,"seed":202818080,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c2-10","mode":"campaign","chapter":2,"index":10,"name":"桥边小锦","width":6,"height":6,"colours":4,"initialBoard":[3,3,1,0,0,0,3,0,2,2,0,2,0,2,1,1,1,0,0,2,1,3,1,2,0,2,1,1,1,1,0,2,2,2,1,1],"referencePath":[1,0,1,0,2,3],"referenceMoves":6,"moveLimit":9,"seed":202819108,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c2-11","mode":"campaign","chapter":2,"index":11,"name":"暮春长巷","width":6,"height":6,"colours":4,"initialBoard":[3,1,3,1,3,3,1,1,2,0,3,3,3,2,2,2,2,1,0,3,3,3,2,0,0,0,1,2,1,2,0,0,0,2,2,0],"referencePath":[1,2,3,0,1,2,0],"referenceMoves":7,"moveLimit":11,"seed":202820093,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c2-12","mode":"campaign","chapter":2,"index":12,"name":"溪绸成幅","width":6,"height":6,"colours":4,"initialBoard":[3,3,3,0,0,0,0,3,0,1,1,1,1,1,1,3,2,2,2,2,2,3,3,3,3,3,3,0,0,0,0,0,0,1,1,1],"referencePath":[1,3,0,1,0,2,3],"referenceMoves":7,"moveLimit":10,"seed":202821080,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c3-01","mode":"campaign","chapter":3,"index":1,"name":"荷叶初展","width":6,"height":6,"colours":4,"initialBoard":[1,0,3,1,0,3,0,3,2,0,3,2,3,3,1,3,2,1,2,2,0,2,1,0,1,0,1,1,0,3,0,3,2,0,3,2],"referencePath":[0,3,2,0,1,0,3,2,0,1],"referenceMoves":10,"moveLimit":13,"seed":202910080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c3-02","mode":"campaign","chapter":3,"index":2,"name":"夏风穿梭","width":6,"height":6,"colours":4,"initialBoard":[1,1,2,3,2,2,1,3,3,2,2,0,2,2,0,1,1,2,2,0,0,1,1,3,1,1,3,3,0,2,1,3,3,1,2,0],"referencePath":[3,2,1,0,2,0,1,3],"referenceMoves":8,"moveLimit":11,"seed":202911080,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c3-03","mode":"campaign","chapter":3,"index":3,"name":"双池映荷","width":6,"height":6,"colours":4,"initialBoard":[2,2,2,0,0,0,2,0,3,3,3,3,2,3,1,1,1,3,0,3,1,2,1,3,3,0,1,1,1,1,0,3,3,3,1,1],"referencePath":[3,0,1,2,3,0],"referenceMoves":6,"moveLimit":9,"seed":202912089,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c3-04","mode":"campaign","chapter":3,"index":4,"name":"菱纹入水","width":6,"height":6,"colours":4,"initialBoard":[1,2,2,0,1,1,0,3,3,3,1,2,3,3,1,1,1,1,2,2,0,1,0,0,0,1,0,0,0,0,1,0,2,0,3,3],"referencePath":[2,3,2,0,1,2,0,3],"referenceMoves":8,"moveLimit":11,"seed":202913094,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c3-05","mode":"campaign","chapter":3,"index":5,"name":"长短经线","width":6,"height":6,"colours":4,"initialBoard":[3,3,1,1,0,0,1,1,0,0,2,2,0,0,2,2,1,3,2,2,3,3,1,1,3,3,1,1,3,0,1,1,0,0,1,2],"referencePath":[1,0,2,3,1,0,1,2,3],"referenceMoves":9,"moveLimit":12,"seed":202914098,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c3-06","mode":"campaign","chapter":3,"index":6,"name":"绕过曲径","width":6,"height":6,"colours":4,"initialBoard":[2,2,1,0,0,2,2,2,1,0,0,2,1,0,1,0,0,0,3,3,3,0,0,0,3,3,3,2,2,3,1,1,3,0,3,3],"referencePath":[1,0,2,3,0,1],"referenceMoves":6,"moveLimit":9,"seed":202915144,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c3-07","mode":"campaign","chapter":3,"index":7,"name":"莲心回纹","width":7,"height":7,"colours":4,"initialBoard":[2,1,3,2,1,3,2,1,3,0,1,3,0,2,3,3,2,3,0,2,2,0,1,1,0,2,1,1,2,1,3,2,1,3,3,1,0,0,1,3,0,0,3,0,2,3,0,2,2],"referencePath":[1,3,1,0,1,3,0,2,1,3],"referenceMoves":10,"moveLimit":13,"seed":202916080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c3-08","mode":"campaign","chapter":3,"index":8,"name":"染满一支流","width":7,"height":7,"colours":4,"initialBoard":[2,3,0,0,1,1,2,3,0,0,1,1,2,2,1,2,3,1,0,0,1,2,3,3,0,0,1,1,1,1,2,2,3,3,0,1,2,2,3,3,2,0,0,0,1,1,2,2,3],"referencePath":[3,0,1,0,3,1,0,2,3],"referenceMoves":9,"moveLimit":12,"seed":202917095,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c3-09","mode":"campaign","chapter":3,"index":9,"name":"散落的藕节","width":7,"height":7,"colours":4,"initialBoard":[0,2,2,0,1,0,3,3,0,3,3,3,1,3,2,3,1,1,2,1,3,0,3,1,0,2,1,1,2,3,1,2,2,2,1,0,1,1,1,2,2,0,3,2,0,0,1,2,2],"referencePath":[2,3,1,0,2,0,1,3],"referenceMoves":8,"moveLimit":11,"seed":202918113,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c3-10","mode":"campaign","chapter":3,"index":10,"name":"织出清凉","width":7,"height":7,"colours":4,"initialBoard":[1,0,0,0,0,0,3,0,2,2,3,0,3,0,2,3,1,2,3,0,3,1,0,0,3,3,3,3,0,3,3,2,1,1,1,1,1,1,3,3,3,3,3,1,2,3,3,3,3],"referencePath":[0,3,2,3,0,1,2,3],"referenceMoves":8,"moveLimit":11,"seed":202919085,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c3-11","mode":"campaign","chapter":3,"index":11,"name":"远岸候色","width":7,"height":7,"colours":4,"initialBoard":[1,1,0,0,2,2,3,0,0,1,2,0,3,1,2,2,3,3,3,1,0,3,3,1,1,0,0,1,1,1,0,0,2,2,3,1,0,2,2,3,3,1,2,2,3,3,1,1,0],"referencePath":[0,2,3,0,2,3,1,0,2,3],"referenceMoves":10,"moveLimit":13,"seed":202920081,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c3-12","mode":"campaign","chapter":3,"index":12,"name":"荷风成幅","width":7,"height":7,"colours":4,"initialBoard":[3,1,2,3,2,0,3,0,3,2,1,3,2,3,0,0,2,1,1,2,2,1,1,3,0,0,2,2,3,2,1,1,1,1,2,3,3,1,1,1,1,3,3,3,1,1,1,1,3],"referencePath":[0,2,1,2,1,0,2,3],"referenceMoves":8,"moveLimit":11,"seed":202921106,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c4-01","mode":"campaign","chapter":4,"index":1,"name":"秋叶入锦","width":7,"height":7,"colours":4,"initialBoard":[0,3,2,2,1,1,0,3,3,2,1,1,0,0,0,0,3,3,1,2,1,0,3,3,2,2,1,2,2,1,0,0,3,3,2,1,0,0,3,3,2,2,3,2,1,1,0,0,3],"referencePath":[3,0,3,2,0,1,2,0,1,3],"referenceMoves":10,"moveLimit":13,"seed":203010091,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c4-02","mode":"campaign","chapter":4,"index":2,"name":"拾色山径","width":7,"height":7,"colours":4,"initialBoard":[1,0,1,3,3,3,1,0,3,1,0,1,2,1,0,1,2,2,0,2,1,3,1,2,3,0,2,3,3,1,0,0,1,0,2,3,2,2,2,0,0,2,1,1,1,2,2,2,0],"referencePath":[0,1,3,2,0,1,2,3],"referenceMoves":8,"moveLimit":10,"seed":203011086,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c4-03","mode":"campaign","chapter":4,"index":3,"name":"层峦叠染","width":7,"height":7,"colours":4,"initialBoard":[3,0,3,1,0,3,3,1,0,1,1,0,2,2,1,2,1,3,2,2,2,2,2,1,3,1,2,3,0,0,0,2,1,1,0,3,1,0,1,3,2,3,1,3,3,3,0,1,2],"referencePath":[0,1,0,2,3,0,1,2,3],"referenceMoves":9,"moveLimit":12,"seed":203012160,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c4-04","mode":"campaign","chapter":4,"index":4,"name":"穿过锦市","width":7,"height":7,"colours":4,"initialBoard":[0,3,1,1,2,2,1,1,1,2,2,1,3,0,1,2,2,3,0,1,1,3,1,0,0,1,0,2,1,0,1,1,2,2,3,1,1,2,2,3,1,0,2,2,3,3,0,0,1],"referencePath":[1,3,1,2,3,1,0,1,2,3],"referenceMoves":10,"moveLimit":12,"seed":203013081,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c4-05","mode":"campaign","chapter":4,"index":5,"name":"四方回廊","width":7,"height":7,"colours":5,"initialBoard":[0,4,4,4,1,2,1,4,0,4,2,1,2,1,2,2,2,1,0,2,4,4,0,2,2,4,0,1,4,4,4,3,3,0,2,4,4,4,3,3,4,0,2,4,4,2,0,4,4],"referencePath":[4,1,2,0,1,3,4,0,2],"referenceMoves":9,"moveLimit":12,"seed":203014087,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c4-06","mode":"campaign","chapter":4,"index":6,"name":"先近后远","width":7,"height":7,"colours":5,"initialBoard":[2,4,2,2,1,4,4,4,2,3,1,4,2,2,2,3,0,4,2,3,3,3,0,1,2,3,0,0,0,1,4,3,0,1,1,1,1,2,0,1,2,1,4,2,3,1,4,2,2],"referencePath":[4,2,1,4,2,3,0,1,2,3,4],"referenceMoves":11,"moveLimit":13,"seed":203015080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c4-07","mode":"campaign","chapter":4,"index":7,"name":"经纬分岔","width":8,"height":8,"colours":5,"initialBoard":[0,0,3,4,1,1,2,2,0,3,3,1,4,2,2,4,0,2,4,4,0,0,3,3,2,4,4,0,0,4,3,1,3,3,4,1,2,2,4,4,3,1,1,2,2,4,4,0,4,4,0,0,3,2,1,1,4,0,0,3,3,1,3,4],"referencePath":[3,4,1,2,4,1,0,2,1,3,4],"referenceMoves":11,"moveLimit":14,"seed":203016081,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c4-08","mode":"campaign","chapter":4,"index":8,"name":"一池秋光","width":8,"height":8,"colours":5,"initialBoard":[1,4,1,2,2,2,0,3,3,2,0,0,0,1,4,0,1,1,4,4,3,3,4,4,2,0,4,1,1,3,3,4,2,0,3,0,1,1,3,4,2,4,3,3,1,1,3,3,0,4,4,3,2,3,1,3,1,0,4,4,4,2,0,3],"referencePath":[4,2,1,2,0,3,1,0,2,3,4],"referenceMoves":11,"moveLimit":13,"seed":203017142,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c4-09","mode":"campaign","chapter":4,"index":9,"name":"斜阳碎锦","width":8,"height":8,"colours":5,"initialBoard":[1,4,2,3,4,2,2,4,0,1,4,4,1,1,1,1,4,0,4,4,4,1,1,4,2,0,0,0,3,2,2,2,3,0,1,2,1,3,3,1,3,0,0,3,1,3,0,0,3,4,2,3,0,0,3,0,1,4,2,2,3,3,0,2],"referencePath":[0,4,0,3,2,1,0,3,2,0,4],"referenceMoves":11,"moveLimit":14,"seed":203018109,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c4-10","mode":"campaign","chapter":4,"index":10,"name":"照顾角落","width":8,"height":8,"colours":5,"initialBoard":[3,0,1,1,0,0,4,2,1,1,0,0,4,4,2,2,0,0,4,4,2,2,3,1,4,4,2,2,3,3,1,1,2,2,3,3,1,2,0,0,3,3,1,1,0,4,4,4,1,1,0,0,4,4,2,2,0,0,2,4,2,2,3,3],"referencePath":[1,0,4,2,3,2,4,0,1,0,2,3,4],"referenceMoves":13,"moveLimit":15,"seed":203019083,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c4-11","mode":"campaign","chapter":4,"index":11,"name":"山路重逢","width":8,"height":8,"colours":5,"initialBoard":[3,1,0,2,2,4,1,0,1,4,4,2,2,2,4,4,3,4,2,2,2,2,2,4,3,3,2,2,3,1,1,3,3,3,2,3,3,1,1,1,3,4,0,0,4,0,0,0,0,1,1,3,4,0,0,1,3,0,0,4,4,0,1,2],"referencePath":[1,3,2,1,0,4,1,0,2,3],"referenceMoves":10,"moveLimit":13,"seed":203020103,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c4-12","mode":"campaign","chapter":4,"index":12,"name":"秋山成幅","width":8,"height":8,"colours":5,"initialBoard":[3,3,3,4,1,3,3,0,3,0,2,1,3,0,0,2,0,2,4,3,0,2,2,4,2,4,1,0,2,4,4,1,4,1,3,2,4,1,1,3,1,0,2,0,1,3,3,0,3,0,2,1,4,0,0,2,0,2,4,3,0,2,2,4],"referencePath":[2,4,1,3,2,1,4,0,1,2,3,0,1,4],"referenceMoves":14,"moveLimit":16,"seed":203021080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c5-01","mode":"campaign","chapter":5,"index":1,"name":"霜落窗棂","width":8,"height":8,"colours":5,"initialBoard":[1,0,1,4,2,4,4,4,4,4,2,3,2,3,3,2,1,2,3,3,0,0,3,3,4,2,3,1,1,0,4,3,4,2,2,1,1,1,2,3,4,2,3,1,1,1,0,0,2,3,3,0,0,0,1,1,2,2,3,3,3,3,0,0],"referencePath":[4,2,3,0,1,2,3,0,2,4],"referenceMoves":10,"moveLimit":12,"seed":203110080,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c5-02","mode":"campaign","chapter":5,"index":2,"name":"暖池生烟","width":8,"height":8,"colours":5,"initialBoard":[1,4,1,1,1,2,2,1,4,2,1,4,2,1,4,4,0,1,0,0,2,0,2,4,2,4,3,2,3,2,2,4,4,2,2,0,0,0,0,0,4,3,3,4,4,1,3,0,3,1,0,3,3,4,1,1,2,3,0,4,4,3,1,1],"referencePath":[4,0,2,4,2,3,0,4,1,2,0,3,4],"referenceMoves":13,"moveLimit":15,"seed":203111174,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c5-03","mode":"campaign","chapter":5,"index":3,"name":"六味初会","width":8,"height":8,"colours":5,"initialBoard":[3,0,1,1,3,3,2,2,1,1,3,3,2,2,4,4,3,3,2,2,4,4,0,1,2,2,4,4,0,0,1,1,4,4,4,0,0,1,1,1,0,0,1,1,3,3,2,2,1,1,3,3,4,2,0,3,3,0,2,2,4,4,0,1],"referencePath":[1,3,2,4,0,3,1,2,0,3,2,1,4],"referenceMoves":13,"moveLimit":15,"seed":203112083,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c5-04","mode":"campaign","chapter":5,"index":4,"name":"回廊听雪","width":8,"height":8,"colours":5,"initialBoard":[2,2,3,3,3,3,4,0,3,3,3,1,3,4,0,1,1,0,0,3,2,2,3,1,0,2,1,1,3,1,3,2,4,1,1,3,0,3,4,1,0,2,3,2,3,3,2,1,0,0,1,1,4,3,3,3,0,4,1,3,4,4,2,2],"referencePath":[3,2,3,1,3,4,0,1,2,3,4],"referenceMoves":11,"moveLimit":13,"seed":203113151,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c5-05","mode":"campaign","chapter":5,"index":5,"name":"双线穿梭","width":8,"height":8,"colours":5,"initialBoard":[1,3,0,4,1,2,0,3,1,3,0,1,0,3,4,2,3,2,3,0,3,2,2,3,2,4,1,3,2,4,4,1,2,1,0,2,1,1,1,0,1,1,3,4,1,0,0,3,1,3,2,1,0,1,3,2,3,2,4,0,3,2,2,4],"referencePath":[3,2,1,0,2,1,0,3,4,1,0,2,3,4],"referenceMoves":14,"moveLimit":16,"seed":203114080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c5-06","mode":"campaign","chapter":5,"index":6,"name":"霜枝连色","width":8,"height":8,"colours":5,"initialBoard":[0,4,1,1,0,3,1,3,4,1,1,0,0,4,3,2,0,0,3,3,2,2,4,3,0,3,3,2,2,4,3,1,2,2,4,4,1,1,0,3,2,4,4,1,1,2,3,3,0,3,2,0,3,4,2,2,1,0,0,3,3,2,0,4],"referencePath":[4,1,0,2,1,3,4,3,2,0,1,3,4],"referenceMoves":13,"moveLimit":15,"seed":203115109,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c5-07","mode":"campaign","chapter":5,"index":7,"name":"雪径转折","width":9,"height":9,"colours":6,"initialBoard":[5,0,0,5,5,5,3,3,5,0,5,3,3,4,1,5,1,1,0,3,1,1,2,2,2,1,1,5,3,1,4,4,4,4,2,1,5,3,2,0,0,0,3,2,4,5,1,2,3,0,0,4,4,2,5,4,2,4,1,4,0,3,5,0,5,2,2,2,2,4,4,0,3,1,1,1,2,2,2,4,1],"referencePath":[0,3,1,2,1,4,0,3,2,4,0,1,5],"referenceMoves":13,"moveLimit":15,"seed":203116090,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c5-08","mode":"campaign","chapter":5,"index":8,"name":"碎锦藏暖","width":9,"height":9,"colours":6,"initialBoard":[1,5,4,0,0,5,5,5,5,0,0,1,0,4,5,5,5,5,4,0,2,3,4,0,5,4,0,4,0,2,5,5,2,2,1,4,0,5,5,4,2,3,3,2,2,0,0,4,1,0,0,2,3,2,1,5,5,5,5,5,3,4,3,2,2,0,5,4,4,4,1,2,1,2,0,0,2,5,4,4,1],"referencePath":[0,5,4,5,0,3,2,4,1,0,3,2,4,5],"referenceMoves":14,"moveLimit":16,"seed":203117082,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c5-09","mode":"campaign","chapter":5,"index":9,"name":"最远的灯","width":9,"height":9,"colours":6,"initialBoard":[3,3,4,3,4,3,2,2,1,1,1,0,5,2,2,4,0,5,0,0,2,2,4,2,5,0,3,2,0,4,4,5,5,3,3,1,1,2,5,5,3,3,2,1,0,1,5,1,3,1,1,0,0,2,2,3,1,0,0,0,2,0,3,1,1,3,0,5,3,1,4,5,3,0,2,2,4,4,0,5,3],"referencePath":[1,0,4,5,3,2,0,3,5,1,2,0,3,4,5],"referenceMoves":15,"moveLimit":17,"seed":203118081,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c5-10","mode":"campaign","chapter":5,"index":10,"name":"冬夜长幅","width":9,"height":9,"colours":6,"initialBoard":[2,3,4,3,3,3,2,2,2,1,4,4,1,3,4,2,2,5,2,5,0,2,3,4,2,0,2,4,4,1,2,3,2,2,0,1,4,4,4,1,1,2,2,4,4,4,4,1,1,3,1,4,2,2,3,1,5,0,1,1,0,5,1,3,4,3,3,3,2,5,5,5,5,5,1,1,2,2,5,3,4],"referencePath":[1,4,3,2,1,4,2,3,0,1,5,2,3,4],"referenceMoves":14,"moveLimit":16,"seed":203119123,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c5-11","mode":"campaign","chapter":5,"index":11,"name":"合拢支流","width":9,"height":9,"colours":6,"initialBoard":[5,3,4,0,2,5,5,3,4,3,4,1,2,5,3,3,4,1,4,1,0,5,3,4,4,1,0,1,4,2,3,4,1,1,0,2,0,2,5,4,1,0,0,1,5,2,5,5,1,0,2,2,5,3,5,3,4,0,2,5,5,1,4,3,4,1,2,5,3,3,4,1,4,1,0,5,3,4,4,1,0],"referencePath":[3,4,1,0,2,5,4,1,2,5,3,4,1,0,2,1,4,3,5],"referenceMoves":19,"moveLimit":21,"seed":203120080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c5-12","mode":"campaign","chapter":5,"index":12,"name":"霜庭成幅","width":9,"height":9,"colours":6,"initialBoard":[0,0,1,1,3,3,5,5,2,0,1,1,3,4,5,5,2,2,4,3,5,4,2,2,4,4,2,3,5,5,4,2,4,4,2,4,2,2,1,4,0,0,1,5,3,2,4,3,0,0,1,1,0,3,0,0,1,4,3,1,0,5,3,0,1,1,1,0,0,5,0,2,3,1,5,5,2,2,1,4,3],"referencePath":[1,3,5,2,4,1,0,3,2,1,4,0,3,5],"referenceMoves":14,"moveLimit":16,"seed":203121088,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c6-01","mode":"campaign","chapter":6,"index":1,"name":"四时开卷","width":9,"height":9,"colours":6,"initialBoard":[5,5,3,2,2,0,3,0,0,4,2,0,3,5,3,2,2,0,2,4,3,4,3,2,5,1,4,5,2,3,2,0,1,5,3,5,2,4,3,2,2,1,4,4,1,5,1,5,5,5,0,2,2,1,2,1,1,5,1,3,4,5,5,5,2,4,1,5,0,2,4,1,5,4,0,1,1,0,0,3,1],"referencePath":[3,0,3,5,0,2,1,5,2,0,3,1,4,2,5],"referenceMoves":15,"moveLimit":17,"seed":203210097,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c6-02","mode":"campaign","chapter":6,"index":2,"name":"春溪入夏","width":9,"height":9,"colours":6,"initialBoard":[1,3,2,4,5,3,3,3,0,2,4,5,5,3,3,0,0,4,5,5,3,3,0,0,4,4,2,4,3,0,0,0,4,1,1,2,0,0,4,4,1,0,2,2,0,4,4,3,1,4,2,5,5,3,1,1,2,2,5,5,3,3,0,2,2,5,5,0,3,0,0,4,5,5,3,3,0,0,4,4,1],"referencePath":[2,5,3,0,1,4,5,3,0,1,2,4,3,0,1,5],"referenceMoves":16,"moveLimit":17,"seed":203211102,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c6-03","mode":"campaign","chapter":6,"index":3,"name":"荷纹映秋","width":9,"height":9,"colours":6,"initialBoard":[4,5,3,0,3,3,3,2,2,3,1,2,0,2,1,4,2,5,2,2,4,2,3,2,2,3,3,2,5,0,5,3,3,1,2,5,3,2,3,2,3,2,4,4,2,3,2,5,5,5,3,2,1,2,4,4,3,5,4,3,3,1,2,4,0,3,4,4,1,3,3,3,2,5,5,3,4,3,3,3,3],"referencePath":[3,2,4,2,3,2,4,3,2,1,0,4,3,5],"referenceMoves":14,"moveLimit":15,"seed":203212121,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c6-04","mode":"campaign","chapter":6,"index":4,"name":"霜色织春","width":9,"height":9,"colours":6,"initialBoard":[3,5,4,1,2,3,3,2,4,5,1,0,2,3,5,5,4,0,4,0,1,1,5,4,0,0,1,0,1,2,5,4,0,0,3,2,1,2,3,4,0,1,1,1,3,2,3,5,0,1,2,2,3,5,3,0,4,1,2,3,3,5,5,5,4,0,2,3,5,5,4,0,4,0,1,3,5,4,4,0,4],"referencePath":[5,4,0,1,5,4,0,1,2,3,5,0,4,0,1,2],"referenceMoves":16,"moveLimit":16,"seed":203213080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c6-05","mode":"campaign","chapter":6,"index":5,"name":"六色回环","width":9,"height":9,"colours":6,"initialBoard":[0,0,3,3,1,1,5,4,5,0,2,3,1,1,4,4,2,5,3,3,1,1,4,4,5,5,2,3,1,1,2,4,1,5,3,2,1,1,4,4,5,5,0,2,4,1,4,4,5,5,0,2,0,4,5,4,5,5,2,1,0,0,3,4,3,5,3,5,0,1,3,5,5,5,2,2,0,0,1,5,1],"referencePath":[3,1,4,5,2,0,1,3,4,0,2,3,5,1],"referenceMoves":14,"moveLimit":16,"seed":203214096,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c6-06","mode":"campaign","chapter":6,"index":6,"name":"经纬千结","width":9,"height":9,"colours":6,"initialBoard":[1,5,5,2,2,3,3,3,3,5,2,3,3,3,3,0,0,0,5,3,0,0,4,4,4,1,5,2,3,5,1,1,1,5,5,0,2,3,5,2,5,5,0,4,4,5,0,3,2,5,5,1,1,4,3,0,1,1,4,1,5,1,4,3,2,4,4,4,1,1,0,1,3,0,0,0,5,4,5,3,1],"referencePath":[5,3,0,1,5,4,1,0,2,3,4,5],"referenceMoves":12,"moveLimit":13,"seed":203215086,"topology":"rings","topologyName":"回纹流转","lesson":"回纹向内延伸，也别遗漏外沿的分支。"},
    {"id":"c6-07","mode":"campaign","chapter":6,"index":7,"name":"曲水归池","width":10,"height":10,"colours":6,"initialBoard":[2,2,3,5,2,0,5,3,2,5,3,1,3,5,1,1,1,1,3,4,0,0,4,3,3,1,2,4,4,4,2,1,2,0,3,3,0,4,5,1,2,0,0,1,1,3,0,3,2,1,5,3,3,3,2,2,2,4,0,0,5,5,4,4,3,4,2,2,2,3,1,3,3,4,1,0,4,4,0,1,0,5,5,2,2,4,1,4,2,2,0,3,1,4,4,0,5,0,0,2],"referencePath":[3,0,2,5,3,2,4,0,5,3,1,2,0,4,3,5],"referenceMoves":16,"moveLimit":17,"seed":203216088,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"先观察较远的碎锦，给后续颜色留一条通路。"},
    {"id":"c6-08","mode":"campaign","chapter":6,"index":8,"name":"锦上山河","width":10,"height":10,"colours":6,"initialBoard":[0,5,1,4,5,5,2,3,3,3,5,4,5,5,2,2,3,5,0,2,4,5,2,2,3,3,1,1,0,0,1,2,3,3,1,1,0,3,4,4,3,0,1,1,1,0,3,4,5,5,1,5,0,1,5,3,5,5,2,2,0,5,5,4,5,0,2,2,3,3,4,4,3,5,2,5,3,3,1,1,5,5,2,4,3,3,1,1,0,3,2,2,3,3,1,1,0,0,4,4],"referencePath":[5,4,5,2,3,1,5,2,5,3,1,3,0,4,2,3,5],"referenceMoves":17,"moveLimit":17,"seed":203217086,"topology":"terraces","topologyName":"水田层染","lesson":"沿着层染的边缘，先想好通往下一层的颜色。"},
    {"id":"c6-09","mode":"campaign","chapter":6,"index":9,"name":"循色而行","width":10,"height":10,"colours":6,"initialBoard":[1,3,3,5,1,1,2,4,2,5,3,4,4,3,1,0,4,0,2,0,0,5,5,5,5,0,1,1,2,5,5,5,3,2,4,0,4,1,2,2,1,3,2,0,2,4,3,1,4,4,4,3,1,0,3,3,5,4,4,1,3,4,0,0,5,2,2,0,3,1,4,4,0,0,5,2,1,4,2,1,4,4,3,3,5,0,5,5,1,0,4,4,4,4,3,5,5,1,5,5],"referencePath":[3,4,5,3,4,0,1,3,5,1,2,0,4,1,3,5],"referenceMoves":16,"moveLimit":18,"seed":203218133,"topology":"pools","topologyName":"散池相逢","lesson":"一小片相邻色，可能连起身后的整座染池。"},
    {"id":"c6-10","mode":"campaign","chapter":6,"index":10,"name":"远近同染","width":10,"height":10,"colours":6,"initialBoard":[0,5,2,1,2,3,0,5,4,1,0,4,3,2,0,5,3,4,5,2,1,3,1,0,5,4,4,3,1,0,3,1,2,5,4,3,3,1,2,5,1,2,0,4,3,1,1,3,0,0,2,0,5,3,1,2,2,2,5,3,0,5,4,1,5,0,0,5,4,1,5,4,3,2,0,5,5,4,3,2,4,3,1,0,5,4,4,3,1,0,3,1,2,5,4,3,3,1,2,5],"referencePath":[4,3,1,2,0,5,3,1,2,5,4,3,1,0,2,5,3,1,4],"referenceMoves":19,"moveLimit":20,"seed":203219080,"topology":"diagonal","topologyName":"斜纹溪流","lesson":"斜纹看似相接，只有上下左右相连才会归入染区。"},
    {"id":"c6-11","mode":"campaign","chapter":6,"index":11,"name":"四季长卷","width":10,"height":10,"colours":6,"initialBoard":[5,5,3,2,4,4,3,3,0,0,1,2,0,4,4,3,2,0,0,1,4,4,3,3,0,0,1,1,5,5,4,3,3,0,0,1,1,4,5,4,0,2,1,1,1,5,0,2,4,4,0,1,1,5,5,0,2,4,4,3,5,5,4,2,2,4,3,3,0,0,5,2,2,4,4,3,3,0,0,3,4,3,3,3,0,0,2,1,2,1,4,1,3,0,0,1,1,5,5,2],"referencePath":[2,4,0,5,2,4,3,0,2,1,4,0,2,3,5],"referenceMoves":15,"moveLimit":16,"seed":203220081,"topology":"weave","topologyName":"经纬交织","lesson":"经纬交叉处，比较两种颜色之后能接近哪里。"},
    {"id":"c6-12","mode":"campaign","chapter":6,"index":12,"name":"染旅大成","width":10,"height":10,"colours":6,"initialBoard":[2,2,0,3,5,0,5,1,1,2,1,3,5,1,3,0,5,5,2,2,3,3,5,0,1,3,5,0,2,5,1,5,3,1,0,3,3,4,4,4,1,0,2,0,4,0,3,1,4,4,2,5,3,1,0,0,1,4,5,3,3,3,3,1,2,1,3,5,5,4,2,4,2,5,3,3,1,1,3,1,2,5,1,5,4,2,3,2,1,0,1,2,1,0,5,5,3,1,4,4],"referencePath":[0,5,0,1,3,0,1,3,1,5,2,1,0,3,4,1,2,5],"referenceMoves":18,"moveLimit":18,"seed":2026092862,"topology":"mosaic","topologyName":"碎锦合幅","lesson":"从碎锦的各条支流入手，让远近六色在最后一染相逢。"}
  ];
  var byId = {};
  all.forEach(function (level) {
    Object.freeze(level.initialBoard); Object.freeze(level.referencePath); Object.freeze(level);
    byId[level.id] = level;
  });
  chapters.forEach(function (chapter) { Object.freeze(chapter); });
  Object.freeze(all); Object.freeze(chapters);
  function get(id) {
    if (typeof id !== 'string') return null;
    if (Object.prototype.hasOwnProperty.call(byId, id)) return byId[id];
    if (id.indexOf('daily:') === 0) return daily(id.slice(6));
    var match = /^workshop:(\d+):(\d+):(\d+)$/.exec(id);
    if (!match || String(normalizeSeed(match[1])) !== match[1]) return null;
    return workshop(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  Dye.Levels = { chapters: chapters, all: all, get: get, daily: daily, workshop: workshop,
    normalizeSeed: normalizeSeed, generatorVersion: 1 };
}());

;
var Dye = typeof Dye !== 'undefined' ? Dye : {};
(function () {
  'use strict';
  var colours = [
    {name:'胭脂',symbol:'✿',hex:'#bc725e',ink:'#fff8e8',motif:'花'},
    {name:'松烟',symbol:'╱',hex:'#527b70',ink:'#f4f1d9',motif:'竹'},
    {name:'栀子',symbol:'◇',hex:'#d5ad64',ink:'#513f2e',motif:'菱'},
    {name:'靛青',symbol:'≈',hex:'#647f99',ink:'#f6f1e5',motif:'水'},
    {name:'藕荷',symbol:'○',hex:'#a286a0',ink:'#fff3e9',motif:'月'},
    {name:'茶褐',symbol:'✚',hex:'#8b775d',ink:'#fff4db',motif:'十'}
  ];
  function glyph(c,x,y,s) {
    var st=' fill="none" stroke="'+colours[c].ink+'" stroke-width="'+Math.max(1.4,s*0.045)+'" stroke-linecap="round" stroke-linejoin="round"';
    var a=s*0.15;
    if(c===0) return '<path d="M '+(x-a)+' '+y+' Q '+(x-a)+' '+(y-2*a)+' '+x+' '+(y-a)+' Q '+(x+2*a)+' '+(y-a)+' '+(x+a)+' '+y+' Q '+(x+a)+' '+(y+2*a)+' '+x+' '+(y+a)+' Q '+(x-2*a)+' '+(y+a)+' '+(x-a)+' '+y+' Z"'+st+'/>';
    if(c===1) return '<path d="M '+(x-a)+' '+(y+a)+' L '+(x+a)+' '+(y-a)+' M '+(x-a)+' '+(y-a*.3)+' L '+x+' '+(y-a*1.3)+' M '+x+' '+(y+a*1.3)+' L '+(x+a)+' '+(y+a*.3)+'"'+st+'/>';
    if(c===2) return '<path d="M '+x+' '+(y-a*1.3)+' L '+(x+a)+' '+y+' L '+x+' '+(y+a*1.3)+' L '+(x-a)+' '+y+' Z"'+st+'/>';
    if(c===3) return '<path d="M '+(x-a*1.4)+' '+(y-a*.5)+' Q '+(x-a*.5)+' '+(y-a*1.4)+' '+x+' '+(y-a*.5)+' T '+(x+a*1.4)+' '+(y-a*.5)+' M '+(x-a*1.4)+' '+(y+a*.7)+' Q '+(x-a*.5)+' '+(y-a*.2)+' '+x+' '+(y+a*.7)+' T '+(x+a*1.4)+' '+(y+a*.7)+'"'+st+'/>';
    if(c===4) return '<circle cx="'+x+'" cy="'+y+'" r="'+a+'"'+st+'/>';
    return '<path d="M '+(x-a)+' '+y+' H '+(x+a)+' M '+x+' '+(y-a)+' V '+(y+a)+'"'+st+'/>';
  }
  function boardSvg(board,width,height,options) {
    options=options||{};
    var unit=480/width, ch=480/height;
    var controlled=Dye.Engine.component(board,width,height,0);
    var set={}; controlled.forEach(function(i){set[i]=true;});
    var absorbed=options.absorbed||[];
    var old=options.recoloured||[];
    var result='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" role="img" aria-label="'+(options.label||'染布：左上角白线内为当前连通区域')+'" data-cells="'+board.length+'" data-controlled="'+controlled.length+'" data-moves="'+(options.moves||0)+'">';
    var descriptions=[];for(var row=0;row<height;row++){descriptions.push('第'+(row+1)+'行：'+board.slice(row*width,(row+1)*width).map(function(c){return colours[c].name+colours[c].motif+'纹';}).join('、'));}
    result+='<desc>共'+width+'列'+height+'行，已连通'+controlled.length+'格。'+descriptions.join('。')+'。</desc>';
    result+='<defs><pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0H6M0 3H6" stroke="#fff" stroke-opacity=".075"/><path d="M0 0V6M3 0V6" stroke="#192e26" stroke-opacity=".07"/></pattern></defs>';
    board.forEach(function(c,i){
      var x=(i%width)*unit,y=Math.floor(i/width)*ch;
      var pulse=absorbed.indexOf(i)>=0||old.indexOf(i)>=0;
      result+='<g data-cell="'+i+'" data-colour="'+c+'" class="tile'+(pulse?' dye-spread':'')+'" style="animation-delay:'+Math.floor((x+y)*.3)+'ms"><rect x="'+x+'" y="'+y+'" width="'+(unit+.2)+'" height="'+(ch+.2)+'" fill="'+colours[c].hex+'"/><rect x="'+x+'" y="'+y+'" width="'+unit+'" height="'+ch+'" fill="url(#weave)"/>';
      result+=glyph(c,x+unit/2,y+ch/2,Math.min(unit,ch));
      result+='<path d="M'+x+' '+(y+ch)+'H'+(x+unit)+'V'+y+'" fill="none" stroke="#20392e" stroke-opacity=".12" stroke-width="1"/>';
      if(set[i]) {
        var path='';
        if(i<width||!set[i-width])path+='M'+(x+2)+' '+(y+2)+'H'+(x+unit-2);
        if(i>=board.length-width||!set[i+width])path+='M'+(x+2)+' '+(y+ch-2)+'H'+(x+unit-2);
        if(i%width===0||!set[i-1])path+='M'+(x+2)+' '+(y+2)+'V'+(y+ch-2);
        if(i%width===width-1||!set[i+1])path+='M'+(x+unit-2)+' '+(y+2)+'V'+(y+ch-2);
        result+='<path d="'+path+'" fill="none" stroke="#fff9e9" stroke-width="3" stroke-dasharray="6 3" class="control-edge"/>';
      }
      result+='</g>';
    });
    result+='<circle cx="9" cy="9" r="6" fill="#fff9e9" stroke="#2d534a" stroke-width="2"/></svg>';
    return result;
  }
  Dye.Render={colours:colours,glyph:glyph,boardSvg:boardSvg};
}());

;
/* Four Seasons Dye Journey · replay-validated saves and completion outbox. MIT. */
var Dye = typeof Dye !== 'undefined' ? Dye : {};
(function () {
  'use strict';
  var GAME = 'season-dye-journey';
  var PREFIX = 'mini-polish:' + GAME + ':v1:';
  var KEY = PREFIX + 'journal';
  var TUTORIAL_KEY = PREFIX + 'tutorial:v1';
  var MAX_EVIDENCE = 512;
  var MAX_OUTBOX = 256;
  var runCounter = 0;

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function empty() { return { schemaVersion: 1, gameId: GAME, session: null, evidence: [], outbox: [] }; }
  function completionId(runId) { return GAME + ':completion:' + runId; }
  function modeFor(level) { return level.mode || (level.id.indexOf('daily:') === 0 ? 'daily' : level.id.indexOf('workshop:') === 0 ? 'workshop' : 'campaign'); }
  function stars(state, level) {
    if (!state || state.status !== 'won') return 0;
    return state.moves <= level.referenceMoves ? 3 : state.moves <= level.referenceMoves + 2 ? 2 : 1;
  }
  function earnedClaims(state, level) {
    var result = [], rating = stars(state, level), i;
    if (!rating) return result;
    result.push({ rewardClaimId: GAME + ':swatch:' + level.id, kind: 'swatch', levelId: level.id, value: 1 });
    for (i = 1; i <= rating; i += 1) {
      result.push({ rewardClaimId: GAME + ':star:' + level.id + ':' + i, kind: 'star', levelId: level.id, value: 1, star: i });
    }
    return result;
  }
  function newRunId() {
    runCounter += 1;
    var random = Math.floor(Math.random() * 4294967296).toString(36);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      try { var buffer = new Uint32Array(2); crypto.getRandomValues(buffer); random = buffer[0].toString(36) + buffer[1].toString(36); } catch (error) { /* A timestamp and process counter remain available. */ }
    }
    return 'dye-' + Date.now().toString(36) + '-' + runCounter.toString(36) + '-' + random;
  }
  function create(storage, resolveLevel) {
    var journal = empty(), persistent = true, dirty = false, warnings = [], lastError = null, tutorialMemory = false, flushPromise = null;
    var evidenceCache = Object.create(null);
    function note(code) { if (warnings.indexOf(code) < 0) warnings.push(code); }
    function warn(code) { lastError = code; note(code); }
    function levelFor(id, raw) { try { return typeof resolveLevel === 'function' ? resolveLevel(id, raw) : null; } catch (error) { return null; } }
    function restore(raw) { return Dye.Engine.restore(raw, levelFor); }
    function descriptor(value) {
      if (value === undefined || value === null) return null;
      try { var text = JSON.stringify(value); return text.length <= 2048 ? JSON.parse(text) : null; } catch (error) { return null; }
    }
    function evidenceState(entry) {
      var level = levelFor(entry.state.levelId, entry.state), key = completionId(entry.state.runId);
      var signature = JSON.stringify(entry.state), previous = evidenceCache[key];
      /* Only immutable rule definitions may reuse a private, replay-validated snapshot. */
      var cacheable = level && Object.isFrozen(level) && Object.isFrozen(level.initialBoard) && Object.isFrozen(level.referencePath);
      if (cacheable && previous && previous.level === level && previous.signature === signature) return previous.state;
      var state = restore(entry.state);
      if (cacheable && state) {
        Object.freeze(state.board); Object.freeze(state.timeline); Object.freeze(state);
        evidenceCache[key] = { signature: signature, level: level, state: state };
      } else delete evidenceCache[key];
      return state;
    }
    function trimCache() {
      var retained = Object.create(null);
      journal.evidence.forEach(function (entry) { retained[completionId(entry.state.runId)] = true; });
      Object.keys(evidenceCache).forEach(function (key) { if (!retained[key]) delete evidenceCache[key]; });
    }
    function persist(next) {
      journal = next;
      trimCache();
      try {
        if (!storage || typeof storage.setItem !== 'function') throw new Error('storage unavailable');
        storage.setItem(KEY, JSON.stringify(next));
        persistent = true; dirty = false; lastError = null;
        return true;
      } catch (error) {
        persistent = false; dirty = true; warn('storage-unavailable');
        return false;
      }
    }
    function result(ok, extra) {
      var value = { ok: ok, persisted: persistent && !dirty, error: lastError };
      if (extra) Object.keys(extra).forEach(function (key) { value[key] = extra[key]; });
      return value;
    }
    function findEvidence(id) {
      for (var i = 0; i < journal.evidence.length; i += 1) if (completionId(journal.evidence[i].state.runId) === id) return journal.evidence[i];
      return null;
    }
    function payload(entry) {
      var state = evidenceState(entry), level = state && levelFor(state.levelId, entry.state);
      if (!state || !level || state.status !== 'won') return null;
      var all = earnedClaims(state, level), ids = entry.claims;
      return { schemaVersion: 1, gameId: GAME, levelId: state.levelId, mode: modeFor(level), runId: state.runId,
        completionId: completionId(state.runId), rewardClaims: all.filter(function (claim) { return ids.indexOf(claim.rewardClaimId) >= 0; }),
        metrics: { moves: state.moves, referenceMoves: level.referenceMoves, moveLimit: level.moveLimit,
          stars: stars(state, level), hints: state.hints, wastes: state.wastes, width: level.width, height: level.height, colours: level.colours },
        completedAt: entry.completedAt };
    }
    function progress() {
      var levels = Object.create(null), claims = Object.create(null), totalStars = 0, collected = [], campaignCompleted = 0;
      journal.evidence.forEach(function (entry) {
        var state = evidenceState(entry), level = state && levelFor(state.levelId, entry.state);
        if (!state || !level || state.status !== 'won') return;
        var rating = stars(state, level), previous = levels[state.levelId];
        if (!previous) {
          levels[state.levelId] = { stars: rating, bestMoves: state.moves, bestHints: state.hints, mode: modeFor(level), completedAt: entry.completedAt };
        } else {
          previous.stars = Math.max(previous.stars, rating);
          previous.bestMoves = Math.min(previous.bestMoves, state.moves);
          previous.bestHints = Math.min(previous.bestHints, state.hints);
          if (entry.completedAt < previous.completedAt) previous.completedAt = entry.completedAt;
        }
        earnedClaims(state, level).forEach(function (claim) { claims[claim.rewardClaimId] = true; });
      });
      Object.keys(levels).forEach(function (id) {
        totalStars += levels[id].stars;
        if (levels[id].mode === 'campaign') { campaignCompleted += 1; collected.push(id); }
      });
      collected.sort();
      return { levels: levels, totalStars: totalStars, collected: collected, completedCount: Object.keys(levels).length,
        campaignCompleted: campaignCompleted, claims: Object.keys(claims), outboxCount: journal.outbox.length,
        persistent: persistent && !dirty, warnings: warnings.slice() };
    }
    function normalize(raw) {
      if (!raw || raw.schemaVersion !== 1 || raw.gameId !== GAME || !Array.isArray(raw.evidence) ||
          !Array.isArray(raw.outbox) || raw.evidence.length > MAX_EVIDENCE || raw.outbox.length > MAX_OUTBOX) return null;
      var clean = empty(), seen = Object.create(null);
      if (raw.session) {
        var session = restore(raw.session.state);
        if (session) clean.session = { state: Dye.Engine.serialize(session), descriptor: descriptor(raw.session.descriptor) };
        else warn('invalid-session');
      }
      raw.evidence.forEach(function (entry) {
        if (!entry || !entry.state || typeof entry.completedAt !== 'string' || !isFinite(Date.parse(entry.completedAt)) ||
            (entry.localOnly !== undefined && typeof entry.localOnly !== 'boolean')) { warn('invalid-evidence'); return; }
        var state = restore(entry.state), level = state && levelFor(state.levelId, entry.state), id = state && completionId(state.runId);
        if (!state || !level || state.status !== 'won' || seen[id]) { warn('invalid-evidence'); return; }
        var allowed = earnedClaims(state, level).map(function (claim) { return claim.rewardClaimId; });
        if (!Array.isArray(entry.claims) || entry.claims.length > allowed.length || entry.claims.some(function (claim, index) {
          return allowed.indexOf(claim) < 0 || entry.claims.indexOf(claim) !== index;
        })) { warn('invalid-evidence'); return; }
        seen[id] = entry.localOnly === true ? 'local-only' : 'sync';
        if (entry.localOnly === true) note('sync-queue-full');
        clean.evidence.push({ state: Dye.Engine.serialize(state), descriptor: descriptor(entry.descriptor), completedAt: entry.completedAt,
          claims: entry.claims.slice(), localOnly: entry.localOnly === true });
      });
      raw.outbox.forEach(function (id) { if (typeof id === 'string' && seen[id] === 'sync' && clean.outbox.indexOf(id) < 0) clean.outbox.push(id); else warn('invalid-outbox'); });
      return clean;
    }
    try {
      if (!storage || typeof storage.getItem !== 'function') throw new Error('storage unavailable');
      var saved = storage.getItem(KEY);
      if (saved) {
        if (saved.length > 2097152) throw new Error('oversized save');
        var normalized = normalize(JSON.parse(saved));
        if (normalized) journal = normalized; else warn('invalid-journal');
      }
    } catch (error) {
      if (error && (error.name === 'SyntaxError' || error.message === 'oversized save')) warn('invalid-journal');
      else { persistent = false; warn('storage-unavailable'); }
    }
    function loadSession() { return journal.session ? restore(journal.session.state) : null; }
    function saveSession(state, meta) {
      var restored = restore(state);
      if (!restored) return result(false, { error: 'invalid-session' });
      var next = copy(journal);
      next.session = { state: Dye.Engine.serialize(restored), descriptor: descriptor(meta) };
      persist(next);
      return result(true);
    }
    function trimEvidence(next) {
      var protectedIds = Object.create(null), best = Object.create(null), leastHints = Object.create(null), first = Object.create(null), i, entry, state, id;
      next.outbox.forEach(function (item) { protectedIds[item] = true; });
      if (next.session) protectedIds[completionId(next.session.state.runId)] = true;
      next.evidence.forEach(function (item) {
        var value = evidenceState(item), old = value && best[value.levelId];
        if (value && (!old || value.moves < old.state.moves || (value.moves === old.state.moves && value.hints < old.state.hints))) best[value.levelId] = { state: value, entry: item };
        if (value && (!leastHints[value.levelId] || value.hints < leastHints[value.levelId].state.hints)) leastHints[value.levelId] = { state: value, entry: item };
        if (value && (!first[value.levelId] || item.completedAt < first[value.levelId].entry.completedAt)) first[value.levelId] = { state: value, entry: item };
      });
      Object.keys(best).forEach(function (levelId) {
        protectedIds[completionId(best[levelId].state.runId)] = true;
        protectedIds[completionId(leastHints[levelId].state.runId)] = true;
        protectedIds[completionId(first[levelId].state.runId)] = true;
      });
      while (next.evidence.length > MAX_EVIDENCE) {
        for (i = 0; i < next.evidence.length; i += 1) if (!protectedIds[completionId(next.evidence[i].state.runId)]) break;
        if (i < next.evidence.length) { next.evidence.splice(i, 1); continue; }
        /* Keep every campaign best and every pending delivery. Older generated levels may rotate out. */
        for (i = 0; i < next.evidence.length; i += 1) {
          entry = next.evidence[i]; state = evidenceState(entry); id = completionId(entry.state.runId);
          if (state && modeFor(levelFor(state.levelId, entry.state)) !== 'campaign' && next.outbox.indexOf(id) < 0 &&
              (!next.session || next.session.state.runId !== state.runId)) break;
        }
        if (i === next.evidence.length) return false;
        next.evidence.splice(i, 1);
      }
      return true;
    }
    function saveCompletion(state, meta) {
      var restored = restore(state), level = restored && levelFor(restored.levelId, state);
      if (!restored || !level || restored.status !== 'won') return result(false, { error: 'not-complete' });
      var id = completionId(restored.runId), existing = findEvidence(id);
      if (existing) {
        if (existing.state.levelId !== restored.levelId || JSON.stringify(existing.state.timeline) !== JSON.stringify(restored.timeline) || existing.state.hints !== restored.hints) return result(false, { error: 'run-already-completed' });
        return result(true, { duplicate: true, localOnly: existing.localOnly === true, syncQueued: existing.localOnly !== true,
          payload: payload(existing), progress: progress() });
      }
      var localOnly = journal.outbox.length >= MAX_OUTBOX;
      var claimed = progress().claims;
      var entry = { state: Dye.Engine.serialize(restored), descriptor: descriptor(meta), completedAt: new Date().toISOString(),
        localOnly: localOnly,
        claims: earnedClaims(restored, level).filter(function (claim) { return claimed.indexOf(claim.rewardClaimId) < 0; }).map(function (claim) { return claim.rewardClaimId; }) };
      var next = copy(journal);
      next.evidence.push(entry);
      if (!localOnly) next.outbox.push(id);
      next.session = { state: Dye.Engine.serialize(restored), descriptor: descriptor(meta) };
      if (!trimEvidence(next)) return result(false, { persisted: false, error: 'evidence-capacity', progress: progress() });
      persist(next);
      if (localOnly) note('sync-queue-full');
      return result(true, { duplicate: false, localOnly: localOnly, syncQueued: !localOnly, payload: payload(entry), progress: progress() });
    }
    function flush(host) {
      if (flushPromise) return flushPromise;
      var bridge = host || (typeof DyeHost !== 'undefined' ? DyeHost : null);
      var send = typeof bridge === 'function' ? bridge : bridge && typeof bridge.complete === 'function' ? function (event) { return bridge.complete(event); } : null;
      var sent = 0;
      if (dirty && !persist(journal)) return Promise.resolve(result(false, { sent: 0, pending: journal.outbox.length, hostAvailable: !!send }));
      if (!send) return Promise.resolve(result(true, { sent: 0, pending: journal.outbox.length, hostAvailable: false }));
      function deliverNext() {
        if (!journal.outbox.length) return result(true, { sent: sent, pending: 0, hostAvailable: true });
        var id = journal.outbox[0], entry = findEvidence(id), event = entry && payload(entry);
        if (!event) return result(false, { error: 'invalid-outbox', sent: sent, pending: journal.outbox.length, hostAvailable: true });
        return Promise.resolve().then(function () { return send(copy(event)); }).then(function (accepted) {
          if (accepted === false || (accepted && accepted.accepted === false)) throw new Error('host declined');
          var next = copy(journal); next.outbox = next.outbox.filter(function (item) { return item !== id; });
          sent += 1;
          if (!persist(next)) return result(false, { sent: sent, pending: journal.outbox.length, hostAvailable: true, error: 'delivery-ack-not-persisted' });
          return deliverNext();
        }, function () { return result(false, { error: 'host-unavailable', sent: sent, pending: journal.outbox.length, hostAvailable: true }); }).catch(function () {
          return result(false, { error: 'host-unavailable', sent: sent, pending: journal.outbox.length, hostAvailable: true });
        });
      }
      flushPromise = Promise.resolve().then(deliverNext).then(function (value) { flushPromise = null; return value; }, function () {
        flushPromise = null; return result(false, { error: 'host-unavailable', sent: sent, pending: journal.outbox.length, hostAvailable: true });
      });
      return flushPromise;
    }
    function seenTutorial() {
      if (tutorialMemory) return true;
      try { return !!storage && storage.getItem(TUTORIAL_KEY) === '1'; } catch (error) { warn('tutorial-storage-unavailable'); return false; }
    }
    function markTutorial() {
      tutorialMemory = true;
      try { if (!storage) throw new Error('storage unavailable'); storage.setItem(TUTORIAL_KEY, '1'); return { ok: true, persisted: true }; }
      catch (error) { warn('tutorial-storage-unavailable'); return { ok: true, persisted: false, error: 'tutorial-storage-unavailable' }; }
    }
    return { loadSession: loadSession, saveSession: saveSession, saveCompletion: saveCompletion, progress: progress, flush: flush,
      sessionDescriptor: function () { return journal.session ? copy(journal.session.descriptor) : null; },
      seenTutorial: seenTutorial, markTutorial: markTutorial, newRunId: newRunId,
      status: function () { return result(true, { warnings: warnings.slice(), pending: journal.outbox.length }); } };
  }
  Dye.Storage = { create: create, stars: stars, newRunId: newRunId, PREFIX: PREFIX, KEY: KEY,
    TUTORIAL_KEY: TUTORIAL_KEY, MAX_EVIDENCE: MAX_EVIDENCE, MAX_OUTBOX: MAX_OUTBOX };
}());

;
Dye.Tutorial = [{"key":"elements","levelId":"c1-01","moves":0,"controlled":4,"board":[0,0,1,1,0,0,1,1,1,1,2,2,1,1,2,2],"timeline":[],"status":"playing","alt":"首关初始：4×4 布面，左上胭脂染区占 4 格，0 步。"},{"key":"action","levelId":"c1-01","moves":1,"controlled":12,"board":[1,1,1,1,1,1,1,1,1,1,2,2,1,1,2,2],"timeline":[1],"status":"playing","alt":"首关一次合法操作：选松烟竹纹，染区接入 8 格，共连通 12 格，1 步。"},{"key":"goal","levelId":"c1-01","moves":2,"controlled":16,"board":[2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],"timeline":[1,2],"status":"won","alt":"首关真实完成：再选栀子菱纹，16 格同色，2 步合幅。"}];
;
(function () {
  'use strict';
  var E=Dye.Engine,L=Dye.Levels,R=Dye.Render,S=Dye.Storage;
  var app=document.getElementById('app'), modal=document.getElementById('modal-root');
  var storage;try{storage=window.localStorage;}catch(error){storage=null;}
  var store=S.create(storage,L.get),state=store.loadSession(),view='home',hint=null,lastFill=null;
  var notice='',lastSettlement=null,modalKind='',tutorialIndex=0,previousFocus=null,collectionChapter=1;
  var DAY=localDay(),tutorialTitles=['从一角，染起四季','换一色，让染意流动','一匹同色，便是合幅'];
  var tutorialTexts=['白色缝线围住左上角相连的布面。相同颜色、上下左右相接的布格，属于同一片染区；每色还有自己的纹样。','点底部染碟，整片染区一起换色，并接入相邻的同色布格。图中从初始布面换一次色，记录为第 1 步。','继续合法换色，直到整匹布都是同一色，并且步数不超过预算。参考策略只是已验证的一条路线，你也可以比它更省。'];
  function esc(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function localDay(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function current(){return state?L.get(state.levelId):null;}
  function progress(){return store.progress();}
  function chapterFor(level){return L.chapters.filter(function(c){return c.id===level.chapter;})[0]||L.chapters[0];}
  function modeFor(level){return level.id.indexOf('daily:')===0?'daily':level.id.indexOf('workshop:')===0?'workshop':'campaign';}
  function descriptor(level){return {mode:modeFor(level)};}
  function labelFor(level){var mode=modeFor(level);return mode==='daily'?'每日配色 · '+level.id.slice(6):mode==='workshop'?'自由工坊 · 自选染布':chapterFor(level).name;}
  function checkSaved(result){if(result&&result.ok&&result.persisted&&result.localOnly)notice='本地布样已保存；同步队列已满，新局仅保留本机。';if(result && (!result.ok||result.persisted===false))notice=result.error==='outbox-capacity'||result.error==='evidence-capacity'?'记录空间已满：本次合幅可欣赏，新的收藏暂未写入。':'这次记录暂未完整保存；请留在当前页面，关闭页面可能丢失。';}
  function save(){checkSaved(store.saveSession(state,descriptor(current())));}
  function flush(){store.flush(window.DyeHost);}
  function stars(n){return '★'.repeat(n)+'☆'.repeat(3-n);}
  function start(level,resume){
    if(!resume){state=E.create(level,store.newRunId());hint=null;lastFill=null;lastSettlement=null;save();}
    view='game';hint=null;lastFill=null;closeModal();render();
    if(state.status==='won')showWin();
  }
  function nextLevel(){var p=progress();return L.all.filter(function(l){return !p.levels[l.id];})[0]||L.all[0];}
  function brand(){return '<span class="brand"><span class="brand-mark">染</span>四季染旅</span>';}
  function noticeHtml(){return notice?'<div class="notice" role="status">'+esc(notice)+'</div>':'';}
  function render(){if(view==='home')renderHome();else renderGame();}
  function renderHome(){
    DAY=localDay();
    var p=progress();
    app.innerHTML='<main class="shell">'+noticeHtml()+'<header class="topbar">'+brand()+'<div class="top-actions"><button data-action="tutorial">染布入门</button><button data-action="about">关于</button></div></header><section class="hero"><div class="hero-copy"><div class="eyebrow">SEASONS IN EVERY THREAD</div><h1>一色一山河</h1><p class="tagline">借四季的颜色，染一匹心里的风景。<br>从左上角出发，让色彩慢慢相遇。</p></div><div class="hero-art"><img src="./assets/workshop-hero.svg" alt="木轴上铺展着四季染布，旁边是陶碟、线轴与枝叶"></div><div class="hero-cta"><button class="primary" data-action="continue">'+(state&&state.status!=='won'?'续染这匹布':'开启染旅')+' <span class="arrow">↗</span></button><p class="hero-note">72 匹布样 · 6 段染旅 · 每日一抹新色</p></div></section><section aria-label="章节地图"><div class="section-head"><h2>四时染途</h2><span>已收藏 '+p.collected.length+' / 72 匹</span></div><div class="route-grid">'+L.chapters.map(function(c,i){
      var done=L.all.filter(function(l){return l.chapter===c.id&&p.levels[l.id];}).length;
      var art=['spring','latespring','summer','autumn','winter','fourseasons'][i];
      return '<button class="chapter-card" data-action="chapter" data-id="'+c.id+'"><img class="chapter-image" src="./assets/chapter-'+art+'.svg" alt=""><div class="chapter-copy"><span class="number">CHAPTER '+String(i+1).padStart(2,'0')+'</span><h3>'+esc(c.name)+'</h3><p>'+esc(c.subtitle||c.lesson||['初识连区 · 3 色小幅','让染区生长 · 3–4 色','水路分岔 · 4 色','层叠交织 · 4–5 色','深浅呼应 · 5 色','四时合锦 · 6 色'][i])+'</p><div class="chapter-progress"><span class="thread-line"><i style="width:'+Math.round(done/12*100)+'%"></i></span><span>'+done+' / 12</span></div></div></button>';
    }).join('')+'</div></section><section class="extras" aria-label="更多染布方式"><button class="extra-card" data-action="daily"><i class="extra-icon">◒</i><b>每日配色</b><span>今天独有的一匹<br>'+DAY.slice(5).replace('-',' / ')+'</span></button><button class="extra-card" data-action="workshop"><i class="extra-icon">✣</i><b>自由工坊</b><span>自选尺寸与颜色<br>以种子留住灵感</span></button><button class="extra-card" data-action="collection"><i class="extra-icon">▤</i><b>布样收藏</b><span>把走过的四季<br>缝进自己的布册</span></button></section><footer class="footnote">不催促，不扣回成长。随时停下，下次接着染。</footer></main>';
  }
  function renderGame(){
    var focused=document.activeElement,focusAction=focused&&focused.dataset?focused.dataset.action:null,focusColor=focused&&focused.dataset?focused.dataset.color:null;
    var level=current(),chapter=chapterFor(level), mode=modeFor(level);
    var ratio=Math.round(state.controlled/state.board.length*100);
    var title=mode==='campaign'?level.name:mode==='daily'?'今日 · 四时一染':'工坊 · 随心成色';
    var number=mode==='campaign'?'布样 '+String(L.all.indexOf(level)+1).padStart(2,'0')+' / 72':mode==='daily'?level.id.slice(6):'种子 '+level.seed;
    var message=hint?'试试'+R.colours[hint.color].name+'（'+R.colours[hint.color].motif+'纹）：可接入 '+hint.expandedBy+' 格。'+(state.moves+hint.path.length<=level.moveLimit?'当前参考路线还需 '+hint.path.length+' 步。':'当前参考路线需 '+hint.path.length+' 步，可撤销再规划。'):lastFill?lastFill.expandedBy>0?'染意相连，接入 '+lastFill.expandedBy+' 格新布面。':'这次换色未接入新格，仍计 1 步。':'白缝线内是染区。选一种颜色，让它向外生长。';
    if(state.status==='over-limit')message=E.complete(state.board)?'练习合幅完成。撤销或重开，再试着在预算内合幅。':'预算已用完，可继续练习；撤销和重开随时可用。';
    if(state.status==='won')message='这匹布已合幅。你的颜色，被四季收藏。';
    app.innerHTML='<main class="game-shell">'+noticeHtml()+'<header class="game-top"><button data-action="home" aria-label="返回染途主页">‹ 染途</button><span class="eyebrow">'+esc(labelFor(level))+'</span><button data-action="tutorial" aria-label="重看染布教程">入门 ?</button></header><section class="game-title"><div><div class="level-label">'+esc(number)+'</div><h1>'+esc(title)+'</h1></div><div class="level-side">'+level.width+' × '+level.height+' · '+level.colours+' 色<br>'+esc(level.topologyName||'四向连色')+'</div></section><section class="stat-row" aria-label="染布进度"><div class="stat-box"><span class="stat-number">'+state.moves+'</span><small>/ '+level.moveLimit+' 步预算</small><span class="stat-label">参考 '+level.referenceMoves+' 步</span></div><div class="stat-box"><span class="stat-number">'+ratio+'<small>%</small></span><small>已连色</small><span class="stat-label">'+state.controlled+' / '+state.board.length+' 格 · '+R.colours[state.board[0]].motif+'纹染区</span></div></section><div class="loom-area"><div class="cloth">'+R.boardSvg(state.board,level.width,level.height,{moves:state.moves,absorbed:lastFill?lastFill.absorbed:[],recoloured:lastFill?lastFill.recoloured:[]})+'</div></div><p class="board-caption">● 左上起染　┈ 白缝线：已连通　◇ 每色皆有纹样</p><div class="live-note '+(state.status==='over-limit'?'warning':'')+'" role="status" aria-live="polite">'+esc(message)+'</div><section aria-label="染色操作"><div class="palette-title"><span>选一碟颜色</span><span>当前色不计步 · 键盘 1–'+level.colours+'</span></div><div class="palette">'+R.colours.slice(0,level.colours).map(function(c,i){return '<button class="dye-button'+(state.board[0]===i?' current':'')+(hint&&hint.color===i?' hinted':'')+'" data-action="dye" data-color="'+i+'" aria-label="'+c.name+' '+c.motif+'纹'+(state.board[0]===i?' 当前颜色':'')+'" aria-pressed="'+(state.board[0]===i)+'"><span class="dye-chip" style="background:'+c.hex+'"><svg viewBox="0 0 40 40" aria-hidden="true">'+R.glyph(i,20,20,45)+'</svg></span><span class="dye-name">'+c.name+'</span></button>';}).join('')+'</div><div class="tool-row"><button data-action="undo" '+(!state.moves?'disabled':'')+'><span class="symbol">↶</span>撤销</button><button data-action="hint" '+(E.complete(state.board)?'disabled':'')+'><span class="symbol hint-tag">✧</span>提示</button><button data-action="restart"><span class="symbol">↻</span>重染</button></div></section></main>';
    sizeBoard();
    if(focusAction){var target=app.querySelector('[data-action="'+focusAction+'"]'+(focusColor!==undefined?'[data-color="'+focusColor+'"]':''));if(target&&!target.disabled)target.focus();}
  }
  function sizeBoard(){
    document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');
    if(view!=='game')return;
    var loom=document.querySelector('.loom-area'),shell=document.querySelector('.game-shell');if(!loom||!shell)return;
    var available=window.innerHeight-(window.innerWidth<360?340:355)-(notice?45:0);
    var max=window.innerWidth>=701?350:420;
    var width=Math.max(185,Math.min(shell.clientWidth-(window.innerWidth<360?28:40),max,available));
    loom.style.width=width+'px';
  }
  function move(color){
    if(view!=='game'||modalKind)return;
    var result=E.move(state,current(),color);
    if(!result.accepted){if(result.reason==='same-colour'){var live=document.querySelector('.live-note');if(live)live.textContent='已经是这碟颜色了，不会增加步数。';}return;}
    state=result.state;lastFill=result;hint=null;
    if(state.status==='won'){lastSettlement=store.saveCompletion(state,descriptor(current()));checkSaved(lastSettlement);flush();renderGame();showWin();}else{save();renderGame();}
  }
  function openModal(kind,html){
    if(!modalKind)previousFocus=document.activeElement;
    modalKind=kind;document.body.classList.add('modal-open');
    modal.innerHTML='<div class="modal-overlay"><section class="modal-card" role="dialog" aria-modal="true" aria-label="'+({tutorial:'染布教程',chapter:'章节关卡',win:'合幅完成',workshop:'自由工坊',collection:'布样收藏',about:'关于与规则',restart:'重新染布'}[kind]||'染旅')+'">'+html+'</section></div>';
    var card=modal.querySelector('.modal-card');card.scrollTop=0;
    var focusable=modal.querySelector('button,input,select');if(focusable)focusable.focus();
  }
  function closeModal(){modalKind='';modal.innerHTML='';document.body.classList.remove('modal-open');if(previousFocus&&document.body.contains(previousFocus))previousFocus.focus();previousFocus=null;}
  function modalHeader(label){return '<div class="modal-header"><span class="eyebrow">'+label+'</span><button class="icon-button" data-action="close" aria-label="关闭">×</button></div>';}
  function showTutorial(index){tutorialIndex=index;openModal('tutorial',modalHeader('染布入门 · '+(index+1)+' / 3')+'<h2>'+tutorialTitles[index]+'</h2><img class="tutorial-picture" src="./assets/tutorial-'+['elements','action','goal'][index]+'.png" alt="'+esc(Dye.Tutorial[index].alt)+'"><p>'+tutorialTexts[index]+'</p><div class="tutorial-dots">'+[0,1,2].map(function(i){return '<i class="'+(i===index?'active':'')+'"></i>';}).join('')+'</div><button class="primary" data-action="tutorial-next">'+(index===2?'开始染布':'下一张 →')+'</button><button class="text-button" data-action="tutorial-skip">'+(index===2?'回到染途':'跳过，稍后再看')+'</button>');}
  function showChapter(id){var c=L.chapters.filter(function(item){return String(item.id)===String(id);})[0];if(!c)return;var p=progress();openModal('chapter',modalHeader('四时染途 · '+String(L.chapters.indexOf(c)+1).padStart(2,'0'))+'<h2>'+esc(c.name)+'</h2><p>'+esc(c.subtitle||'从一小片相连的颜色，染成一整匹季节。')+'</p><div class="level-grid">'+L.all.filter(function(l){return l.chapter===c.id;}).map(function(l){var record=p.levels[l.id];return '<button class="level-cell '+(record?'done':'')+'" data-action="level" data-id="'+l.id+'" aria-label="第 '+(L.all.indexOf(l)+1)+' 关 '+esc(l.name)+' '+(record?record.stars+' 星':'未完成')+'"><strong>'+String(L.all.indexOf(l)+1).padStart(2,'0')+'</strong><span>'+(record?stars(record.stars):l.width+'×'+l.height+' · '+l.colours+'色')+'</span></button>';}).join('')+'</div><p class="small">每章 12 匹不同布样，全部可自由探索。星级对照已验证参考策略，提示与撤销不扣星。</p>');}
  function showWin(){var level=current(),count=state.moves<=level.referenceMoves?3:state.moves<=level.referenceMoves+2?2:1;
    openModal('win',modalHeader('一匹布，收入四季')+'<div class="win"><div class="win-seal">合幅</div><h2>'+esc(level.name)+'</h2><div class="stars" aria-label="'+count+' 星">'+stars(count)+'</div><p>'+(count===3?'染色步数达到参考策略，手中的山河已成。':'一匹新的风景，已经缝进你的染旅。')+'</p><div class="score-line"><span><strong>'+state.moves+'</strong>本次染色</span><span><strong>'+level.referenceMoves+'</strong>参考策略</span></div><div class="result-ribbon">'+(lastSettlement&&(!lastSettlement.ok||!lastSettlement.persisted)?'本次已合幅 · 收藏暂未保存':modeFor(level)==='campaign'?'布样已收入收藏册':'本次配色已记录')+' · 提示与撤销不扣星</div>'+(notice?'<div class="notice" role="status">'+esc(notice)+'</div>':'')+'<p class="small">★★★ ≤ 参考步数　★★ ≤ 参考 +2<br>★ 其余预算内合幅。参考路线不保证最优。</p><button class="primary" data-action="next">'+(modeFor(level)==='campaign'?'下一匹布 →':'回到染途')+'</button><button class="text-button" data-action="close">欣赏这匹布</button></div>');}
  function showWorkshop(){openModal('workshop',modalHeader('留住一缕灵感')+'<h2>自由工坊</h2><p>让一串种子长成布面。同样的尺寸、色数与种子，会得到同一匹布。</p><div class="field"><label for="seed">种子 · 数字或一小段文字</label><input id="seed" maxlength="32" value="山间微雨" autocomplete="off"></div><div class="field"><label for="size">布面尺寸</label><select id="size"><option value="4">4 × 4 · 掌心小幅</option><option value="6" selected>6 × 6 · 舒展绢布</option><option value="8">8 × 8 · 长风织锦</option><option value="10">10 × 10 · 四季大幅</option></select></div><div class="field"><label for="colours">颜色数量</label><select id="colours"><option value="3">3 色 · 清简</option><option value="4" selected>4 色 · 丰盈</option><option value="5">5 色 · 层叠</option><option value="6">6 色 · 四时</option></select></div><button class="primary" data-action="workshop-start">铺开这匹布 →</button><p class="small">预算随已验证参考路线生成，超过预算仍可继续练习。</p>');}
  function showCollection(chapter){collectionChapter=Number(chapter)||1;var p=progress();var chapterObj=L.chapters[collectionChapter-1]||L.chapters[0];var entries=L.all.filter(function(l){return l.chapter===chapterObj.id&&p.levels[l.id];});openModal('collection',modalHeader('私人布样册 · '+p.collected.length+' / 72')+'<h2>把四季，缝进日常</h2><p>每完成一关，留下一匹原始配色布样。再次染布，可以刷新自己的参考星级。</p><div class="collection-tabs">'+L.chapters.map(function(c,i){return '<button class="'+(i+1===collectionChapter?'active':'')+'" data-action="collection-tab" data-chapter="'+(i+1)+'">'+String(i+1).padStart(2,'0')+'</button>';}).join('')+'</div>'+(entries.length?'<div class="collection-grid">'+entries.map(function(l){return '<button class="swatch" data-action="level" data-id="'+l.id+'"><div class="swatch-cloth">'+R.boardSvg(l.initialBoard,l.width,l.height,{label:l.name+'原始布样'})+'</div><div class="swatch-title">'+esc(l.name)+'<br>'+stars(p.levels[l.id].stars)+'</div></button>';}).join('')+'</div>':'<div class="empty">这一页还留着空白。<br>去「'+esc(chapterObj.name)+'」染一匹新的风景吧。</div>')+'<button class="secondary" data-action="chapter" data-id="'+chapterObj.id+'">前往这一章</button>');}
  function showAbout(){openModal('about',modalHeader('关于这段染旅')+'<h2>颜色相接，四时相逢</h2><p class="rule-line">从左上角的连通区开始。选择非当前色，整片连通区换色；只沿上、下、左、右吸收同色布格。零扩张也记一步。选当前色无效。</p><p class="rule-line">整幅同色且不超过预算，才算合幅通关。用完预算后可继续练习；撤销与重染不限次数。参考步数来自求解器的一条合法路线，不声称最优或唯一。</p><p class="rule-line">提示基于当前局面计算，并显示扩染格数与参考剩余步数。提示和撤销都不扣星。72 关全部可选，无连胜惩罚、无广告、无内购。</p><p class="rule-line">进度保存在本机浏览器。清理浏览器数据或小工具缓存可能移除记录。每日按设备本地日期生成。</p><div class="about-list">规则原型：Flood · Simon Tatham’s Portable Puzzle Collection<br>参考：ebnbin/puzzles 与《四季染坊》<br>本作规则实现、美术、文案与界面：Ten Realms Arcade contributors · MIT License。<br>来源记录见交付包 RULES.md 与 release/LICENSE-SOURCES.md。</div><button class="secondary" data-action="tutorial">重看图片教程</button>');}
  function dispatch(action,el){
    if(action==='close'){if(modalKind==='tutorial')store.markTutorial();closeModal();return;}
    if(action==='home'){view='home';hint=null;closeModal();renderHome();return;}
    if(action==='continue'){start(state&&state.status!=='won'?current():nextLevel(),!!(state&&state.status!=='won'));return;}
    if(action==='tutorial'){showTutorial(0);return;}
    if(action==='tutorial-skip'){store.markTutorial();closeModal();return;}
    if(action==='tutorial-next'){if(tutorialIndex<2)showTutorial(tutorialIndex+1);else{store.markTutorial();closeModal();if(view==='home')start(state&&state.status!=='won'?current():nextLevel(),!!(state&&state.status!=='won'));}return;}
    if(action==='chapter'){showChapter(el.dataset.id);return;}
    if(action==='level'){start(L.get(el.dataset.id),false);return;}
    if(action==='daily'){start(L.daily(localDay()),false);return;}
    if(action==='workshop'){showWorkshop();return;}
    if(action==='workshop-start'){var seed=document.getElementById('seed').value||'四季染旅';var size=Number(document.getElementById('size').value),colours=Number(document.getElementById('colours').value);start(L.workshop(seed,size,colours),false);return;}
    if(action==='collection'){showCollection(collectionChapter);return;}
    if(action==='collection-tab'){showCollection(el.dataset.chapter);return;}
    if(action==='about'){showAbout();return;}
    if(action==='dye'){move(Number(el.dataset.color));return;}
    if(action==='undo'){var completed=state.status==='won';state=E.undo(state,current());if(completed)state.runId=store.newRunId();lastSettlement=null;lastFill=null;hint=null;save();renderGame();return;}
    if(action==='hint'){hint=E.suggest(state.board,current());if(hint){state.hints+=1;save();renderGame();}return;}
    if(action==='restart'){openModal('restart',modalHeader('重新铺布')+'<h2>从这一匹的起点重染</h2><p>本局步数会归零，已经收好的布样和最佳记录都会保留。也可以先撤销几步，再换条路线。</p><button class="primary" data-action="restart-confirm">重新染这匹布</button><button class="secondary" data-action="close">继续当前染布</button>');return;}
    if(action==='restart-confirm'){start(current(),false);return;}
    if(action==='next'){var level=current(),index=L.all.indexOf(level);if(index>=0&&index<L.all.length-1)start(L.all[index+1],false);else{view='home';closeModal();renderHome();}return;}
  }
  document.addEventListener('click',function(event){var el=event.target.closest('[data-action]');if(el&&!el.disabled)dispatch(el.dataset.action,el);});
  document.addEventListener('keydown',function(event){
    if(modalKind){
      if(event.key==='Escape'){event.preventDefault();if(modalKind==='tutorial')store.markTutorial();closeModal();}
      if(event.key==='Tab'){var all=modal.querySelectorAll('button:not([disabled]),input,select');var first=all[0],last=all[all.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
      return;
    }
    if(view==='game'&&/^[1-6]$/.test(event.key)){event.preventDefault();move(Number(event.key)-1);}
    if(view==='game'&&(event.key==='z'||event.key==='Z')&&state.moves){event.preventDefault();dispatch('undo',null);}
  });
  window.addEventListener('resize',sizeBoard);
  window.addEventListener('dye-host-ready',flush);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)flush();});
  if(state&&state.status==='won'){lastSettlement=store.saveCompletion(state,descriptor(current()));checkSaved(lastSettlement);}
  render();sizeBoard();flush();
  if(!store.seenTutorial())showTutorial(0);
}());
