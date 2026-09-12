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
