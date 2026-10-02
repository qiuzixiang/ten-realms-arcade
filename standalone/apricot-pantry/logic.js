/* 杏橘收纳所：独立的 Fifteen 规则。一次同行／列点击是一条完整边。 */
(() => {
  "use strict";
  const sizes = new Set([3, 4]);
  const solved = (width) => Array.from({ length: width * width }, (_, i) => (i + 1) % (width * width));
  const key = (board) => board.join(",");
  const validIndex = (index, board) => Number.isInteger(index) && index >= 0 && index < board.length;

  function isPermutation(board, width) {
    return sizes.has(width) && Array.isArray(board) && board.length === width * width
      && board.every((tile) => Number.isInteger(tile) && tile >= 0 && tile < board.length)
      && new Set(board).size === board.length;
  }

  function inversions(board) {
    const tiles = board.filter(Boolean);
    let count = 0;
    for (let i = 0; i < tiles.length; i += 1) {
      for (let j = i + 1; j < tiles.length; j += 1) if (tiles[i] > tiles[j]) count += 1;
    }
    return count;
  }

  function isSolvable(board, width) {
    if (!isPermutation(board, width)) return false;
    const parity = inversions(board) % 2;
    if (width % 2) return parity === 0;
    const blankRowFromBottom = width - Math.floor(board.indexOf(0) / width);
    return (parity + blankRowFromBottom) % 2 === 1;
  }

  function legalIndices(board, width) {
    if (!isSolvable(board, width)) return [];
    const blank = board.indexOf(0);
    return board.flatMap((tile, index) => tile !== 0
      && (Math.floor(index / width) === Math.floor(blank / width) || index % width === blank % width)
      ? [index] : []);
  }

  function affectedIndices(board, width, index) {
    if (!validIndex(index, board) || !legalIndices(board, width).includes(index)) return [];
    const blank = board.indexOf(0);
    const step = Math.floor(blank / width) === Math.floor(index / width) ? 1 : width;
    const line = [];
    for (let at = blank; at !== index; at += index > blank ? step : -step) line.push(at);
    line.push(index);
    return line;
  }

  function move(board, width, index) {
    const line = affectedIndices(board, width, index);
    if (!line.length) return null;
    const next = board.slice();
    for (let i = 0; i < line.length - 1; i += 1) next[line[i]] = board[line[i + 1]];
    next[index] = 0;
    return { board: next, line, clicked: index, blankBefore: line[0] };
  }

  function complete(board, width) {
    return isSolvable(board, width) && key(board) === key(solved(width));
  }

  function referenceSuffix(board, width, initial, reference) {
    if (!isSolvable(board, width) || !isSolvable(initial, width) || !Array.isArray(reference)) return null;
    const wanted = key(board);
    let frame = initial;
    if (key(frame) === wanted) return reference.slice();
    for (let step = 0; step < reference.length; step += 1) {
      const result = move(frame, width, reference[step]);
      if (!result) return null;
      frame = result.board;
      if (key(frame) === wanted) return reference.slice(step + 1);
    }
    return null;
  }

  // This is a real shortest path in the click graph: each segment slide costs one.
  function shortestPath3(board) {
    if (!isSolvable(board, 3)) return null;
    const target = key(solved(3));
    const start = key(board);
    if (start === target) return [];
    const queue = [{ board, path: [] }];
    const seen = new Set([start]);
    for (let head = 0; head < queue.length; head += 1) {
      const item = queue[head];
      for (const index of legalIndices(item.board, 3)) {
        const next = move(item.board, 3, index).board;
        const nextKey = key(next);
        if (seen.has(nextKey)) continue;
        const path = [...item.path, index];
        if (nextKey === target) return path;
        seen.add(nextKey);
        queue.push({ board: next, path });
      }
    }
    return null;
  }

  const api = Object.freeze({ solved, key, isPermutation, inversions, isSolvable, legalIndices, affectedIndices, move, complete, referenceSuffix, shortestPath3 });
  globalThis.ApricotLogic = api;
})();
