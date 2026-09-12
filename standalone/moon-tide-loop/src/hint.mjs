import { topology, validEdges, checkWin } from './engine.mjs';
import { solve } from './solver.mjs';

function cellName(level, cell) { return '第' + (Math.floor(cell / level.width) + 1) + '行第' + (cell % level.width + 1) + '格'; }
function edgeName(board, edge) {
  const data = board.edges[edge];
  return '第' + (data.row + 1) + '行、第' + (data.col + 1) + '段' + (data.orientation === 'h' ? '横边' : '竖边');
}
function hint(kind, title, explanation, edge, value, extras) {
  return Object.assign({ kind, title, explanation, action: edge === null ? null : { edge, value } }, extras || {});
}
/** Hints are deductions from this board state, never a disguised built-in answer lookup.
 * Local explanations are preferred. A fallback proves a forced edge by contradiction.
 * In inconsistent states, compare against an independently derived unique completion,
 * then invite clearing one mistaken commitment instead of extending an impossible board.
 */
export function getHint(level, state) {
  const values = Array.isArray(state) ? state : state && state.edges;
  if (!validEdges(level, values)) return hint('invalid', '潮线暂时无法读取', '请重新开始这一关，恢复有效棋盘。', null, 0);
  if (checkWin(level, values)) return hint('complete', '月环已经合拢', '数字全部满足，潮线连成唯一的闭环。', null, 0);
  const board = topology(level.width, level.height);
  // First establish that the player's commitments admit a complete legal loop.
  // This keeps locally sensible suggestions from reinforcing a globally wrong branch.
  const continuation = solve(level, { limit: 1, edges: values });
  if (continuation.count === 0) {
    const reference = solve(level, { limit: 2 });
    if (reference.count === 1 && reference.exhausted) {
      const edge = values.findIndex((value, index) => value !== 0 && value !== reference.solutions[0][index]);
      if (edge >= 0) {
        const related = board.edgeCells[edge];
        let reason = '当前这些标记无法共同延伸为满足数字的单环。独立推演发现这条' + (values[edge] === 1 ? '潮线' : '排除记号') + '与唯一可行闭环冲突';
        const problemCell = related.find(cell => {
          const clue = level.clues[cell];
          if (clue === null) return false;
          const group = board.cellEdges[cell], lines = group.filter(e => values[e] === 1).length, free = group.filter(e => values[e] === 0).length;
          return lines > clue || lines + free < clue;
        });
        if (problemCell !== undefined) {
          const group = board.cellEdges[problemCell], lines = group.filter(e => values[e] === 1).length;
          reason = cellName(level, problemCell) + '写着' + level.clues[problemCell] + '，目前' + (lines > level.clues[problemCell] ? '已经有' + lines + '条线，超过数字' : '排除过多，剩余可用边已不够') ;
        }
        return hint('repair', '先松开这一处', reason + '。把' + edgeName(board, edge) + '恢复为待定，再继续观察。', edge, 0, { cells: related });
      }
    }
    return hint('conflict', '有一处潮线需要回看', '当前标记不能组成合法闭环。可撤销最近一步，或重开后从数字0、3与边角开始。', null, 0);
  }
  for (let cell = 0; cell < level.clues.length; cell++) {
    const clue = level.clues[cell];
    if (clue === null) continue;
    const group = board.cellEdges[cell], lines = group.filter(edge => values[edge] === 1).length, free = group.filter(edge => values[edge] === 0);
    if (!free.length) continue;
    if (lines === clue) return hint('clue-full', '数字已经够了', cellName(level, cell) + '需要' + clue + '条潮线，现在已有' + lines + '条。其余边必须排除；先给高亮边标一个×。', free[0], -1, { cells: [cell] });
    if (lines + free.length === clue) return hint('clue-needed', '剩下的边都要留下', cellName(level, cell) + '还缺' + (clue - lines) + '条潮线，恰好只剩' + free.length + '条待定边，因此高亮边必须连上。', free[0], 1, { cells: [cell] });
  }
  for (let vertex = 0; vertex < board.vertexEdges.length; vertex++) {
    const group = board.vertexEdges[vertex], lines = group.filter(edge => values[edge] === 1).length, free = group.filter(edge => values[edge] === 0);
    if (!free.length) continue;
    if (lines === 2) return hint('vertex-full', '角点不分岔', '这个角点已有两条潮线，环在这里已经一进一出。其他连接边必须排除。', free[0], -1, { vertices: [vertex] });
    if (lines === 1 && free.length === 1) return hint('vertex-extend', '让潮线继续前行', '这个角点已经有一条线，且只剩一条可用边。每个经过的角点必须接两条线，因此高亮边必须连上。', free[0], 1, { vertices: [vertex] });
    if (lines === 0 && free.length === 1) return hint('vertex-unused', '这里无法独自起头', '这个角点没有潮线，却只剩一条可用边。单独连线会留下断头，所以高亮边必须排除。', free[0], -1, { vertices: [vertex] });
  }
  // Prefer an edge that would prematurely close an existing path.
  for (let edge = 0; edge < values.length; edge++) {
    if (values[edge] !== 0 || continuation.solutions[0][edge] !== -1) continue;
    const start = board.edges[edge].a, target = board.edges[edge].b, reached = new Set([start]), stack = [start];
    while (stack.length) {
      const point = stack.pop();
      board.vertexEdges[point].forEach(next => {
        if (values[next] !== 1) return;
        const data = board.edges[next], other = data.a === point ? data.b : data.a;
        if (!reached.has(other)) { reached.add(other); stack.push(other); }
      });
    }
    if (reached.has(target)) {
      const trial = values.slice(); trial[edge] = 1;
      const opposing = solve(level, { limit: 1, edges: trial });
      if (opposing.count === 0) return hint('premature-loop', '先别合上这个小环', '连接高亮边会提前封住已有潮线，而其他数字或潮线还未安顿。所有潮线只能组成一个环，因此这里要排除。', edge, -1);
    }
  }
  for (let edge = 0; edge < values.length; edge++) {
    if (values[edge] !== 0) continue;
    const expected = continuation.solutions[0][edge], opposite = values.slice(); opposite[edge] = -expected;
    const rejected = solve(level, { limit: 1, edges: opposite });
    if (rejected.count === 0) return hint('lookahead', '把可能性沿着潮线推下去', '高亮的是' + edgeName(board, edge) + '。若把它' + (expected === 1 ? '排除' : '连上') + '，继续满足各格数字和角点0或2条线后，将无法组成合法的完整单环。独立推演已排除这种可能，所以这里应' + (expected === 1 ? '连线' : '标×') + '。', edge, expected, { cells: board.edgeCells[edge] });
  }
  return hint('choice', '暂时有不止一种走法', '当前题面还没有可证明的单边结论，可继续比较数字与相邻角点。', null, 0);
}
