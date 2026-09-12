(function (root) {
  'use strict';

  // Small reusable shapes have no IDs: many cranes can share one DOM safely.
  function craneSvg(variant) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<ellipse cx="50" cy="80" rx="29" ry="7" fill="#143d39" opacity=".22"/>' +
      '<path d="M47 52 9 20 27 63 49 73Z" fill="#fff9e9"/>' +
      '<path d="M47 52 9 20 38 60Z" fill="#e8cfac"/>' +
      '<path d="M47 52 79 9 75 60 53 73Z" fill="#fffdf4"/>' +
      '<path d="M47 52 79 9 59 60Z" fill="#f4ddbc"/>' +
      '<path d="M25 63 42 53 66 62 52 80Z" fill="#f7e7cf"/>' +
      '<path d="M42 53 52 80 66 62Z" fill="#e8b487"/>' +
      '<path d="M54 71 65 44 80 36 92 43 81 42 72 49 65 67Z" fill="#fffbed"/>' +
      '<path d="M65 44 65 67 54 71 72 49Z" fill="#eed3ae"/>' +
      '<path d="M80 36 92 43 81 42Z" fill="#be744c"/>' +
      '<path d="M26 64 12 54 37 60Z" fill="#e6b88d"/>' +
      '<path d="m42 53 10 27m-5-28 12 8m6-16 7 5" fill="none" stroke="#bc9876" stroke-width=".75" opacity=".7"/>' +
      '</svg>';
    // Collection papers are optional. The default string stays byte-for-byte
    // unchanged so board states, tutorials and existing artwork remain stable.
    if (!Number.isInteger(variant) || variant < 1 || variant > 6) return svg;
    var papers = [
      ['#ffe6c5', '#efc391', '#fff0d8', '#f2cba0', '#f4d0aa', '#d69461', '#a35c32'],
      ['#e4edcf', '#a9c59e', '#f1f5df', '#c3d2ad', '#d6e3bc', '#85a280', '#4b7357'],
      ['#e2e4b8', '#a8b783', '#f2eed2', '#c2c392', '#dcdbb0', '#99a269', '#506645'],
      ['#d9e8ef', '#9bbcca', '#ebf4f5', '#b4cdd8', '#ccdde6', '#7a9fad', '#456b82'],
      ['#e5def0', '#b1a3c9', '#f4ecfa', '#c8bade', '#dccde6', '#a28fb7', '#705989'],
      ['#f3e3a9', '#c7ab68', '#fff2c4', '#dfc584', '#ebd291', '#b89148', '#836025']
    ];
    var names = ['apricot', 'lotus', 'bamboo', 'rain', 'moon', 'stars'];
    var patterns = [
      '<circle cx="26" cy="42" r="2.8"/><circle cx="31" cy="51" r="3"/><circle cx="37" cy="60" r="2.5"/><circle cx="67" cy="31" r="2.2"/><circle cx="70" cy="39" r="2.4"/>',
      '<path d="M30 59Q21 57 21 47q7 1 9 8-5-9-1-16 7 5 5 14 2-6 5-5-1 9-9 11Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M69 40Q62 37 64 31q5 3 5 9Z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
      '<path d="m25 41 10 21m-7-15 7-3m-4 11 7-3m27-13 5-14m-3 8 6 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m32 51 3-10 3 7Zm0 6-9-6 3 7Z"/>',
      '<path d="M28 40q-8 10 0 14 8-4 0-14Zm9 15q-5 6 0 8 5-2 0-8Zm31-27q-6 7 0 10 6-3 0-10Z"/>',
      '<path d="M27 39C18 44 26 61 37 58c-9-1-13-11-10-19Zm42-13c-8 3-8 13 0 15-4-4-3-10 0-15Z"/>',
      '<path d="m29 39 2 8 7 4-6 2v8l-5-6-4-2 3-4Zm38-12 1.5 5.5 4.5 2-4.5 1.5-1.5 5-1.5-5-4.5-1.5 4.5-2Z"/>'
    ];
    var paper = papers[variant - 1];
    var oldColors = ['#fff9e9', '#e8cfac', '#fffdf4', '#f4ddbc', '#f7e7cf', '#e8b487', '#fffbed', '#eed3ae', '#be744c', '#e6b88d', '#bc9876'];
    var newColors = [paper[0], paper[1], paper[2], paper[3], paper[4], paper[5], paper[2], paper[3], paper[6], paper[1], paper[6]];
    oldColors.forEach(function (color, index) { svg = svg.split(color).join(newColors[index]); });
    var pattern = '<g data-wing-pattern="' + names[variant - 1] + '" fill="' + paper[6] + '" color="' + paper[6] + '">' + patterns[variant - 1] + '</g>';
    // Patterns sit on the wings, below body and neck folds; no clipping IDs.
    return svg.replace('<svg ', '<svg data-variant="' + variant + '" ').replace('<path d="M25 63', pattern + '<path d="M25 63');
  }

  function lotusSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<ellipse cx="50" cy="69" rx="40" ry="19" fill="#163f39" opacity=".18"/>' +
      '<path d="M52 15C28 11 10 29 10 51c0 22 18 34 41 34 23 0 41-15 40-36C90 26 76 15 58 14L50 48Z" fill="#608977"/>' +
      '<path d="M50 48 52 15C28 11 10 29 10 51c0 22 18 34 41 34Z" fill="#71947d"/>' +
      '<path d="m50 48 24 22m-24-22-27 18m27-18-4 29m4-29 30-9m-30 9-25-14" stroke="#afbe91" stroke-width="1" opacity=".55" fill="none"/>' +
      '<circle cx="50" cy="49" r="11" fill="#315e52" stroke="#c2caa1" stroke-width="1.5" stroke-dasharray="2 3"/>' +
      '</svg>';
  }

  function escapeXml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function nested(shape, x, y, size, extra) {
    return shape.replace('<svg ', '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" ' + (extra || '') + ' ');
  }

  function boardSvg(level, state, options) {
    options = options || {};
    var w = 640, h = 440, width = state.width, height = state.height;
    var cell = Math.min(70, (w - 80) / width, (h - 92) / height);
    var ox = (w - width * cell) / 2, oy = (h - height * cell) / 2 + 18;
    var count = state.cells.filter(function (v) { return v === 'P'; }).length;
    var move = options.move;
    var dataMove = move ? move.from + '>' + move.to : '';
    var output = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440" role="img" ' +
      'data-level="' + escapeXml(level.id) + '" data-level-id="' + escapeXml(level.id) + '" data-seed="' + escapeXml(level.seed || '') +
      '" data-state="' + escapeXml(options.stage || 'current') + '" data-count="' + count + '" data-moves="' + state.moves + '" data-move="' + dataMove + '" data-won="' + (count === 1) + '">' +
      '<title>' + escapeXml(level.id) + ': ' + count + ' cranes, ' + (options.stage || 'current') + '</title>' +
      '<rect width="640" height="440" rx="26" fill="#f5ebd8"/>' +
      '<rect x="10" y="10" width="620" height="420" rx="21" fill="#234f48"/>' +
      '<path d="M18 282Q140 227 275 291T620 273M21 302Q161 256 282 315T621 298M26 77Q156 42 308 89T616 79" fill="none" stroke="#a9b994" stroke-width="1" opacity=".16"/>' +
      '<circle cx="596" cy="43" r="21" fill="#f8eedb"/>' +
      '<text x="596" y="50" text-anchor="middle" font-size="23" font-weight="600" font-family="sans-serif" fill="#204b43">' + count + '</text>';
    state.cells.forEach(function (value, index) {
      if (value === '#') return;
      var x = ox + (index % width) * cell, y = oy + Math.floor(index / width) * cell;
      output += '<g data-cell="' + index + '" data-value="' + value + '">';
      output += nested(lotusSvg(), x + cell * .06, y + cell * .10, cell * .88, 'data-lotus="' + index + '"');
      if (value === 'P') output += nested(craneSvg(), x + cell * .03, y - cell * .015, cell * .94, 'data-crane="' + index + '"');
      if (index === options.selected) output += '<circle cx="' + (x + cell / 2) + '" cy="' + (y + cell / 2) + '" r="' + (cell * .43) + '" fill="none" stroke="#f7ddb0" stroke-width="3"/>';
      if (options.destinations && options.destinations.indexOf(index) >= 0) output += '<g stroke="#fff1cb" stroke-width="2" fill="none"><circle cx="' + (x + cell / 2) + '" cy="' + (y + cell / 2) + '" r="' + (cell * .32) + '" stroke-dasharray="4 3"/><path d="M' + (x + cell * .41) + ' ' + (y + cell * .5) + 'h' + (cell * .18) + 'm' + (-cell * .09) + ' ' + (-cell * .09) + 'v' + (cell * .18) + '"/></g>';
      output += '</g>';
    });
    if (move) {
      var fx = ox + (move.from % width + .5) * cell, fy = oy + (Math.floor(move.from / width) + .5) * cell;
      var tx = ox + (move.to % width + .5) * cell, ty = oy + (Math.floor(move.to / width) + .5) * cell;
      var dx = tx - fx, dy = ty - fy, len = Math.sqrt(dx * dx + dy * dy);
      var nx = -dy / len, ny = dx / len, ux = dx / len, uy = dy / len;
      var bend = cell * .53;
      var ax = tx - ux * cell * .17 + nx * cell * .06, ay = ty - uy * cell * .17 + ny * cell * .06;
      var path = 'M' + fx + ' ' + fy + 'Q' + ((fx + tx) / 2 + nx * bend) + ' ' + ((fy + ty) / 2 + ny * bend) + ' ' + ax + ' ' + ay;
      output += '<g data-jump="' + dataMove + '" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '" stroke="#204b43" stroke-width="7"/><path d="' + path + '" stroke="#ffdeb0" stroke-width="3" stroke-dasharray="5 4"/><path d="M' + (ax - ux * 9 + nx * 7) + ' ' + (ay - uy * 9 + ny * 7) + 'L' + ax + ' ' + ay + ' ' + (ax - ux * 9 - nx * 4) + ' ' + (ay - uy * 9 - ny * 4) + '" stroke="#ffdeb0" stroke-width="3"/></g>';
    }
    if (count === 1) output += '<g transform="translate(32 25)" fill="none" stroke="#e8cea3" stroke-width="2"><circle cx="15" cy="15" r="14"/><path d="m8 15 5 5 10-11"/></g>';
    return output + '</svg>';
  }

  root.CraneArt = { craneSvg: craneSvg, lotusSvg: lotusSvg, boardSvg: boardSvg };
}(typeof window !== 'undefined' ? window : this));
