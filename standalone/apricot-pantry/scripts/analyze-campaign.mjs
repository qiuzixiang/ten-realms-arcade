import "../levels.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Independent, bidirectional 4×4 click graph search for shallow campaign QA.
const alphabet = "0123456789abcdef";
const encode = (board) => board.map((tile) => alphabet[tile]).join("");
const goal = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

function neighbors(board) {
  const blank = board.indexOf(0);
  const row = blank >> 2, column = blank & 3;
  const output = [];
  for (let index = 0; index < 16; index += 1) {
    if (index === blank || ((index >> 2) !== row && (index & 3) !== column)) continue;
    const next = board.slice();
    const stride = (index >> 2) === row ? 1 : 4;
    const direction = index > blank ? stride : -stride;
    for (let cursor = blank; cursor !== index; cursor += direction) next[cursor] = board[cursor + direction];
    next[index] = 0;
    output.push(next);
  }
  return output;
}

export function independentDistance4(start, cap = 500000) {
  const fromStart = new Map([[encode(start), 0]]);
  const fromGoal = new Map([[encode(goal), 0]]);
  let left = [start], right = [goal], leftDepth = 0, rightDepth = 0;
  if (encode(start) === encode(goal)) return 0;
  while (left.length && right.length) {
    for (const expandLeft of [true, false]) {
      const frontier = expandLeft ? left : right;
      const own = expandLeft ? fromStart : fromGoal;
      const other = expandLeft ? fromGoal : fromStart;
      const depth = (expandLeft ? leftDepth : rightDepth) + 1;
      const nextFrontier = [];
      let best = Infinity;
      for (const board of frontier) {
        for (const next of neighbors(board)) {
          const key = encode(next);
          if (own.has(key)) continue;
          own.set(key, depth);
          if (other.has(key)) best = Math.min(best, depth + other.get(key));
          nextFrontier.push(next);
        }
      }
      if (best < Infinity) return best;
      if (expandLeft) { left = nextFrontier; leftDepth = depth; }
      else { right = nextFrontier; rightDepth = depth; }
      if (fromStart.size + fromGoal.size > cap) return null;
    }
  }
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  for (const level of globalThis.ApricotLevels.levels.slice(32)) {
    const exact = independentDistance4(level.board);
    console.log(`${level.id} ${level.title}: reference ${level.reference.length}, exact ${exact ?? "search cap"}`);
  }
}
