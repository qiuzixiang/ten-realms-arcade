// Standalone ES2017 gameplay engine. The source generator is retained separately.
export function makePuzzle(level) {
  var order = level.order;
  var width = order + 2;
  var height = order + 1;
  var values = level.numbers.split('').map(Number);
  var expected = (order + 1) * (order + 2);
  if (values.length !== expected || values.some(function (v) { return !Number.isInteger(v) || v < 0 || v > order; })) throw new Error('Invalid level grid');
  for (var v = 0; v <= order; v += 1) if (values.filter(function (x) { return x === v; }).length !== order + 2) throw new Error('Invalid value inventory');
  var edges = {};
  var pairs = [];
  for (var high = 0; high <= order; high += 1) for (var low = 0; low <= high; low += 1) pairs.push(low + '-' + high);
  for (var row = 0; row < height; row += 1) for (var col = 0; col < width; col += 1) {
    var a = row * width + col;
    for (var j = 0; j < 2; j += 1) {
      var b = j === 0 ? (col + 1 < width ? a + 1 : -1) : (row + 1 < height ? a + width : -1);
      if (b < 0) continue;
      var lowValue = Math.min(values[a], values[b]);
      var highValue = Math.max(values[a], values[b]);
      var key = a + ':' + b;
      edges[key] = { key: key, a: a, b: b, pair: lowValue + '-' + highValue, vertical: j === 1 };
    }
  }
  return { level: level, order: order, width: width, height: height, values: values, pairs: pairs, edges: edges, total: pairs.length };
}

export function keyFor(puzzle, a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  var key = Math.min(a, b) + ':' + Math.max(a, b);
  return puzzle.edges[key] ? key : null;
}

export function freshPosition() { return { rooms: [], excluded: [] }; }

export function analyze(puzzle, position) {
  var occupied = {};
  var pairCounts = {};
  var legal = true;
  position.rooms.forEach(function (key) {
    var edge = puzzle.edges[key];
    if (!edge || occupied[edge.a] || occupied[edge.b]) { legal = false; return; }
    occupied[edge.a] = key;
    occupied[edge.b] = key;
    pairCounts[edge.pair] = (pairCounts[edge.pair] || 0) + 1;
  });
  position.excluded.forEach(function (key) {
    var edge = puzzle.edges[key];
    if (!edge || occupied[edge.a] || occupied[edge.b] || position.rooms.indexOf(key) >= 0) legal = false;
  });
  var duplicates = puzzle.pairs.filter(function (pair) { return pairCounts[pair] > 1; });
  var used = puzzle.pairs.filter(function (pair) { return pairCounts[pair] > 0; });
  var covered = Object.keys(occupied).length;
  return {
    legal: legal,
    occupied: occupied,
    pairCounts: pairCounts,
    duplicates: duplicates,
    used: used,
    covered: covered,
    complete: legal && duplicates.length === 0 && covered === puzzle.values.length && used.length === puzzle.total && position.rooms.length === puzzle.total,
  };
}

export function act(puzzle, position, key, action) {
  var edge = puzzle.edges[key];
  if (!edge || (action !== 'room' && action !== 'exclude')) return { accepted: false, position: position, reason: 'invalid' };
  var rooms = position.rooms.slice();
  var excluded = position.excluded.slice();
  var occupied = analyze(puzzle, position).occupied;
  if (action === 'exclude') {
    if (occupied[edge.a] || occupied[edge.b]) return { accepted: false, position: position, reason: 'occupied' };
    var old = excluded.indexOf(key);
    if (old >= 0) excluded.splice(old, 1); else excluded.push(key);
    return { accepted: true, position: { rooms: rooms, excluded: excluded }, effect: old >= 0 ? 'unmark' : 'mark', removed: [] };
  }
  if (rooms.indexOf(key) >= 0) {
    rooms.splice(rooms.indexOf(key), 1);
    return { accepted: true, position: { rooms: rooms, excluded: excluded }, effect: 'remove', removed: [key] };
  }
  var removed = rooms.filter(function (roomKey) {
    var room = puzzle.edges[roomKey];
    return room.a === edge.a || room.a === edge.b || room.b === edge.a || room.b === edge.b;
  });
  rooms = rooms.filter(function (roomKey) { return removed.indexOf(roomKey) < 0; });
  excluded = excluded.filter(function (excludedKey) {
    var candidate = puzzle.edges[excludedKey];
    return candidate.a !== edge.a && candidate.a !== edge.b && candidate.b !== edge.a && candidate.b !== edge.b;
  });
  rooms.push(key);
  return { accepted: true, position: { rooms: rooms, excluded: excluded }, effect: 'add', removed: removed, duplicate: analyze(puzzle, { rooms: rooms, excluded: excluded }).duplicates.indexOf(edge.pair) >= 0 };
}

export function parsePosition(puzzle, raw) {
  if (!raw || !Array.isArray(raw.rooms) || !Array.isArray(raw.excluded)) return null;
  if (raw.rooms.some(function (key) { return typeof key !== 'string' || !puzzle.edges[key]; }) || raw.excluded.some(function (key) { return typeof key !== 'string' || !puzzle.edges[key]; })) return null;
  if (new Set(raw.rooms).size !== raw.rooms.length || new Set(raw.excluded).size !== raw.excluded.length) return null;
  var result = { rooms: raw.rooms.slice(), excluded: raw.excluded.slice() };
  return analyze(puzzle, result).legal ? result : null;
}
