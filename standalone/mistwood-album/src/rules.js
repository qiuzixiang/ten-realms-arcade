/* Mistwood Album — pure Nonogram rules. MIT; see release/素材与许可.md. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MistRules = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var CELL = Object.freeze({ UNKNOWN: 0, FILLED: 1, EXCLUDED: 2 });
  var cache = Object.create(null);
  function lineClues(values) {
    var result = [], run = 0;
    for (var i = 0; i < values.length; i++) {
      if (values[i] === 1 || values[i] === '#' || values[i] === true) run++;
      else if (run) { result.push(run); run = 0; }
    }
    if (run) result.push(run);
    return result;
  }
  function clues(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 15) throw new TypeError('Invalid photo rows');
    var w = rows[0].length, h = rows.length;
    if (!w || w > 15 || rows.some(function (r) { return typeof r !== 'string' || r.length !== w || /[^.#]/.test(r); })) throw new TypeError('Photo rows must be rectangular .# strings');
    var columns = [];
    for (var x = 0; x < w; x++) columns.push(lineClues(rows.map(function (r) { return r[x]; })));
    return { width: w, height: h, rowClues: rows.map(lineClues), columnClues: columns };
  }
  function validLevel(level) {
    function fits(list, length) {
      return Array.isArray(list) && list.every(function (n) { return Number.isInteger(n) && n > 0; }) && list.reduce(function (a, b) { return a + b; }, 0) + Math.max(0, list.length - 1) <= length;
    }
    return !!level && Number.isInteger(level.width) && Number.isInteger(level.height) && level.width > 0 && level.height > 0 && level.width <= 15 && level.height <= 15 && Array.isArray(level.rowClues) && Array.isArray(level.columnClues) && level.rowClues.length === level.height && level.columnClues.length === level.width && level.rowClues.every(function (line) { return fits(line, level.width); }) && level.columnClues.every(function (line) { return fits(line, level.height); });
  }
  function validGrid(level, grid) {
    return validLevel(level) && Array.isArray(grid) && grid.length === level.width * level.height && grid.every(function (v) { return v === 0 || v === 1 || v === 2; });
  }
  function blank(level) { return Array(level.width * level.height).fill(0); }
  function apply(level, grid, index, value) {
    if (!validGrid(level, grid) || !Number.isInteger(index) || index < 0 || index >= grid.length || (value !== 0 && value !== 1 && value !== 2) || grid[index] === value) return grid;
    var next = grid.slice(); next[index] = value; return next;
  }
  function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
  function complete(level, grid) {
    if (!validGrid(level, grid) || grid.indexOf(0) >= 0) return false;
    for (var y = 0; y < level.height; y++) if (!same(lineClues(grid.slice(y * level.width, (y + 1) * level.width)), level.rowClues[y])) return false;
    for (var x = 0; x < level.width; x++) {
      var col = []; for (var yy = 0; yy < level.height; yy++) col.push(grid[yy * level.width + x]);
      if (!same(lineClues(col), level.columnClues[x])) return false;
    }
    return true;
  }
  // Assignment values use the public CELL enum: 0=unknown, 1=filled, 2=excluded.
  function lineOptions(length, numbers, assignment) {
    if (!Number.isInteger(length) || length < 1 || length > 15 || !Array.isArray(numbers) || numbers.some(function (n) { return !Number.isInteger(n) || n < 1; })) return [];
    var required = numbers.reduce(function (a, b) { return a + b; }, 0) + Math.max(0, numbers.length - 1);
    if (required > length || (assignment && (!Array.isArray(assignment) || assignment.length !== length || assignment.some(function (n) { return n !== 0 && n !== 1 && n !== 2; })))) return [];
    var key = length + ':' + numbers.join(','), patterns = cache[key];
    if (!patterns) {
      patterns = [];
      var cells = Array(length).fill(0);
      function place(k, cursor) {
        if (k === numbers.length) { patterns.push(Object.freeze(cells.slice())); return; }
        var later = numbers.slice(k + 1).reduce(function (a, b) { return a + b; }, 0) + numbers.length - k - 1;
        for (var start = cursor; start <= length - numbers[k] - later; start++) {
          for (var p = start; p < start + numbers[k]; p++) cells[p] = 1;
          place(k + 1, start + numbers[k] + 1);
          for (var q = start; q < start + numbers[k]; q++) cells[q] = 0;
        }
      }
      place(0, 0); cache[key] = Object.freeze(patterns);
    }
    return patterns.filter(function (pattern) {
      return !assignment || pattern.every(function (v, i) { return assignment[i] === 0 || (assignment[i] === 1 ? v === 1 : v === 0); });
    });
  }
  function lineState(level, grid, kind, line) {
    if (kind === 'row') return grid.slice(line * level.width, (line + 1) * level.width);
    var result = []; for (var y = 0; y < level.height; y++) result.push(grid[y * level.width + line]); return result;
  }
  function at(level, kind, line, position) { return kind === 'row' ? line * level.width + position : position * level.width + line; }
  function analyze(level, grid) {
    if (!validGrid(level, grid)) return { valid: false, rows: [], columns: [], complete: false, conflicts: 0 };
    function scan(kind, count, list) {
      var result = [];
      for (var i = 0; i < count; i++) {
        var state = lineState(level, grid, kind, i), options = lineOptions(state.length, list[i], state);
        result.push({ possible: options.length > 0, possibilityCount: options.length, matches: same(lineClues(state), list[i]), decided: state.indexOf(0) < 0 });
      }
      return result;
    }
    var rows = scan('row', level.height, level.rowClues), columns = scan('column', level.width, level.columnClues);
    return { valid: true, rows: rows, columns: columns, complete: complete(level, grid), conflicts: rows.concat(columns).filter(function (r) { return !r.possible; }).length };
  }
  // Production solver: intersect line domains, then branch on a cell. Never reads rows/solution.
  function solve(level, input, limit) {
    var found = [], maximum = limit === undefined ? 2 : Math.max(1, limit);
    var initial = input || blank(level);
    if (!validGrid(level, initial)) return found;
    function visit(grid) {
      if (found.length >= maximum) return;
      var changed = true;
      while (changed) {
        changed = false;
        for (var axis = 0; axis < 2; axis++) {
          var kind = axis ? 'column' : 'row', count = axis ? level.width : level.height, lists = axis ? level.columnClues : level.rowClues;
          for (var line = 0; line < count; line++) {
            var state = lineState(level, grid, kind, line), options = lineOptions(state.length, lists[line], state);
            if (!options.length) return;
            for (var p = 0; p < state.length; p++) if (state[p] === 0 && options.every(function (o) { return o[p] === options[0][p]; })) {
              grid[at(level, kind, line, p)] = options[0][p] ? 1 : 2; changed = true;
            }
          }
        }
      }
      var index = grid.indexOf(0);
      if (index < 0) { if (complete(level, grid)) found.push(grid); return; }
      var filled = grid.slice(), excluded = grid.slice(); filled[index] = 1; excluded[index] = 2;
      visit(filled); visit(excluded);
    }
    visit(initial.slice()); return found;
  }
  function hint(level, grid) {
    if (!validGrid(level, grid)) return { kind: 'conflict', line: -1, index: -1, value: 0, text: '底片数据不完整，请重新开始。', detail: '当前状态未通过格子范围检查。' };
    if (complete(level, grid)) return null;
    var suggestions = [];
    for (var axis = 0; axis < 2; axis++) {
      var kind = axis ? 'column' : 'row', count = axis ? level.width : level.height, lists = axis ? level.columnClues : level.rowClues;
      for (var line = 0; line < count; line++) {
        var state = lineState(level, grid, kind, line), nums = lists[line], options = lineOptions(state.length, nums, state), name = '第 ' + (line + 1) + (axis ? ' 列' : ' 行');
        var label = nums.length ? nums.join(' · ') : '0';
        if (!options.length) return { kind: 'conflict', line: line, axis: kind, index: at(level, kind, line, Math.max(0, state.findIndex(function (v) { return v !== 0; }))), value: 0, text: name + '与线索冲突，先检查这一整条。', detail: '线索 ' + label + ' 表示依次排列的连续段，段间至少隔一格。当前填格与 × 已让所有排列失效；可撤销最近一步，或擦去可疑标记。' };
        for (var p = 0; p < state.length; p++) if (state[p] === 0 && options.every(function (o) { return o[p] === options[0][p]; })) {
          var value = options[0][p] ? 1 : 2;
          var detail = '线索 ' + label + ' 在当前标记下有 ' + options.length + ' 种合法排列。';
          if (!nums.length) detail += '0 表示这一条没有任何填格，因此全部可标 ×。';
          else if (options.length === 1) detail += '各连续段和段间空格的位置已经确定。';
          else detail += '把各段所有可能的位置重叠，这一格在每种排列中都' + (value === 1 ? '被覆盖。' : '留空。');
          suggestions.push({ kind: kind, line: line, index: at(level, kind, line, p), value: value, text: name + '第 ' + (p + 1) + ' 格可以' + (value === 1 ? '显影。' : '标 ×。'), detail: detail, candidates: options.length });
        }
      }
    }
    // Even a locally plausible line may belong to an inconsistent full grid.
    // Check existence before suggesting another mark, so a previous error is not amplified.
    var solutions = solve(level, grid, 1);
    if (!solutions.length) return { kind: 'conflict', line: -1, index: -1, value: 0, text: '几条线索彼此矛盾，请回看最近的标记。', detail: '每条线索单独尚有排列，但行列交叉后没有完整解。撤销或擦除最近的输入不会损失相册进度。' };
    if (suggestions.length) {
      suggestions.sort(function (a, b) { return a.candidates - b.candidates || (b.value === 1 ? 1 : 0) - (a.value === 1 ? 1 : 0); });
      return suggestions[0];
    }
    for (var i = 0; i < grid.length; i++) if (grid[i] === 0) {
      var alternate = grid.slice(); alternate[i] = solutions[0][i] === 1 ? 2 : 1;
      if (!solve(level, alternate, 1).length) return { kind: 'search', line: Math.floor(i / level.width), index: i, value: solutions[0][i], text: '第 ' + (Math.floor(i / level.width) + 1) + ' 行第 ' + (i % level.width + 1) + ' 格经过交叉推演，可以' + (solutions[0][i] === 1 ? '显影。' : '标 ×。'), detail: '暂时假设这一格' + (solutions[0][i] === 1 ? '留空' : '填满') + '，逐条检查行列后，没有任何完整排列能满足全部线索。因此相反状态成立；这一步只使用题面与当前标记。' };
    }
    return { kind: 'search', line: -1, index: -1, value: 0, text: '目前还没有唯一确定的一格。', detail: '这份题面存在多种可能；继续比较长段的重叠位置。' };
  }
  return Object.freeze({ CELL: CELL, clues: clues, lineClues: lineClues, blank: blank, validGrid: validGrid, apply: apply, complete: complete, lineOptions: lineOptions, analyze: analyze, solve: solve, hint: hint });
}));
