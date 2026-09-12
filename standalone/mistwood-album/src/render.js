(function (root) {
  'use strict';
  function escape(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function photo(level, color, unknown) {
    var size = 120, n = level.width, unit = size / n;
    var cells = '';
    for (var r = 0; r < level.height; r++) {
      for (var c = 0; c < n; c++) {
        if (!unknown && level.rows[r][c] === '#') cells += '<rect x="' + c * unit + '" y="' + r * unit + '" width="' + (unit + 0.2) + '" height="' + (unit + 0.2) + '"/>';
      }
    }
    return '<svg class="photo-art" viewBox="0 0 120 120" role="img" aria-label="' + escape(unknown ? '尚未显影的照片' : level.title) + '"><rect width="120" height="120" fill="#d9d9c7"/><circle cx="90" cy="27" r="40" fill="#e7c18b" opacity=".35"/><path d="M0 100 Q35 70 70 104 T140 80 V120 H0" fill="#a8b0a0" opacity=".4"/><g fill="' + (color || '#344a3c') + '">' + cells + '</g>' + (unknown ? '<path d="M46 49 Q48 33 63 36 Q78 40 72 52 L60 65 V71 M60 79 V82" fill="none" stroke="#889080" stroke-width="5" stroke-linecap="round"/>' : '') + '</svg>';
  }
  function boardImage(level, grid, highlight) {
    var cell = 38, left = 66, top = 66, w = left + level.width * cell + 10, h = top + level.height * cell + 12;
    var result = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" data-level="' + level.id + '" data-grid="' + grid.join('') + '" role="img"><rect width="100%" height="100%" rx="12" fill="#eee7d7"/>';
    level.columnClues.forEach(function(clue, c) {
      (clue.length ? clue : [0]).forEach(function(v, k, a) { result += '<text x="' + (left + c * cell + cell / 2) + '" y="' + (top - 10 - (a.length - 1 - k) * 17) + '" text-anchor="middle" fill="#41554b" font-size="15" font-family="sans-serif">' + v + '</text>'; });
    });
    level.rowClues.forEach(function(clue, r) { result += '<text x="' + (left - 9) + '" y="' + (top + r * cell + 25) + '" text-anchor="end" fill="#41554b" font-size="15" font-family="sans-serif">' + (clue.length ? clue.join(' ') : '0') + '</text>'; });
    grid.forEach(function(v, i) {
      var x = left + (i % level.width) * cell, y = top + Math.floor(i / level.width) * cell;
      result += '<rect data-cell="' + i + '" data-state="' + v + '" x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" fill="' + (v === 1 ? '#3c5648' : '#faf5e8') + '" stroke="#c1c6b7"/>';
      if (v === 2) result += '<path d="M' + (x+14) + ' ' + (y+14) + 'l10 10m0 -10l-10 10" stroke="#959b8b" stroke-width="2"/>';
      if (i === highlight) result += '<rect x="' + (x+2) + '" y="' + (y+2) + '" width="' + (cell-4) + '" height="' + (cell-4) + '" fill="none" stroke="#bd623f" stroke-width="3"/>';
    });
    return result + '</svg>';
  }
  var api = {escape: escape, photo: photo, boardImage: boardImage};
  root.MistRender = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : global));
