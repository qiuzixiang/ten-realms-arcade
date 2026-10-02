// Offline authoring solver. Every edge is one full row/column segment click.
const digits = "0123456789abcdef";
const keyOf = (board) => board.map((tile) => digits[tile]).join("");
const solved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

function moves(board) {
  const blank = board.indexOf(0), row = blank >> 2, col = blank & 3;
  const result = [];
  for (let index = 0; index < 16; index += 1) {
    if (index === blank || ((index >> 2) !== row && (index & 3) !== col)) continue;
    const next = board.slice();
    const stride = (index >> 2) === row ? 1 : 4;
    const direction = index > blank ? stride : -stride;
    for (let cursor = blank; cursor !== index; cursor += direction) next[cursor] = board[cursor + direction];
    next[index] = 0;
    result.push({ board: next, index, undo: blank });
  }
  return result;
}

function expand(frontier, own, other, fromStart) {
  const nextFrontier = [];
  let meeting = null, best = Infinity;
  for (const board of frontier) {
    const parent = keyOf(board);
    for (const move of moves(board)) {
      const key = keyOf(move.board);
      if (own.has(key)) continue;
      const depth = own.get(parent).depth + 1;
      own.set(key, { parent, action: fromStart ? move.index : move.undo, depth });
      if (other.has(key) && depth + other.get(key).depth < best) {
        best = depth + other.get(key).depth;
        meeting = key;
      }
      nextFrontier.push(move.board);
    }
  }
  return { frontier: nextFrontier, meeting };
}

export function exactRoute4(start, cap = 1500000) {
  if (!Array.isArray(start) || start.length !== 16 || new Set(start).size !== 16) return null;
  const startKey = keyOf(start), goalKey = keyOf(solved);
  if (startKey === goalKey) return { distance: 0, route: [], visited: 1 };
  const forward = new Map([[startKey, { parent: null, action: null, depth: 0 }]]);
  const backward = new Map([[goalKey, { parent: null, action: null, depth: 0 }]]);
  let left = [start], right = [solved];
  while (left.length && right.length) {
    const a = expand(left, forward, backward, true);
    left = a.frontier;
    if (a.meeting) return assemble(a.meeting, forward, backward);
    if (forward.size + backward.size > cap) return null;
    const b = expand(right, backward, forward, false);
    right = b.frontier;
    if (b.meeting) return assemble(b.meeting, forward, backward);
    if (forward.size + backward.size > cap) return null;
  }
  return null;
}

function assemble(meeting, forward, backward) {
  const first = [];
  for (let at = meeting; forward.get(at).parent; at = forward.get(at).parent) first.push(forward.get(at).action);
  first.reverse();
  const second = [];
  for (let at = meeting; backward.get(at).parent; at = backward.get(at).parent) second.push(backward.get(at).action);
  const route = first.concat(second);
  return { distance: route.length, route, visited: forward.size + backward.size };
}
