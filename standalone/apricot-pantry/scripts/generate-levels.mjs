import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { exactRoute4 } from "./solve-4.mjs";
import "../logic.js";

const L = globalThis.ApricotLogic;
const output = fileURLToPath(new URL("../levels.js", import.meta.url));
const chapters = [
  ["开门前的托盘", "认清空位，学会换轴"],
  ["长架轻推", "点远端，让一整段滑过去"],
  ["留一条通道", "暂时挪开已归位的罐子"],
  ["尾角交接", "照顾最后一行与一列"],
  ["周末大货架", "把旧办法用到四乘四"],
  ["杏橘开张日", "分区整理，完成最后交接"],
];

function build3Graph() {
  const root = L.solved(3);
  const nodes = [{ board: root, depth: 0, parent: -1, undo: -1, long: 0 }];
  const seen = new Set([L.key(root)]);
  for (let head = 0; head < nodes.length; head += 1) {
    const node = nodes[head];
    for (const index of L.legalIndices(node.board, 3)) {
      const result = L.move(node.board, 3, index);
      const k = L.key(result.board);
      if (seen.has(k)) continue;
      seen.add(k);
      nodes.push({ board: result.board, depth: node.depth + 1, parent: head,
        undo: result.blankBefore, long: node.long + Number(result.line.length > 2) });
    }
  }
  if (nodes.length !== 181440) throw new Error(`3×3 graph incomplete: ${nodes.length}`);
  return nodes;
}

function pathToSolved(nodes, index) {
  const path = [];
  while (nodes[index].parent >= 0) {
    path.push(nodes[index].undo);
    index = nodes[index].parent;
  }
  return path;
}

function mirrors(board, width) {
  const variants = [];
  for (let flip = 0; flip < 2; flip += 1) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const cells = [];
      for (let y = 0; y < width; y += 1) for (let x = 0; x < width; x += 1) {
        let a = x, b = y;
        if (flip) a = width - 1 - a;
        for (let turn = 0; turn < rotation; turn += 1) [a, b] = [width - 1 - b, a];
        cells[b * width + a] = board[y * width + x];
      }
      variants.push(L.key(cells));
    }
  }
  return variants;
}

const nodes = build3Graph();
const counts = new Map();
for (const n of nodes) counts.set(n.depth, (counts.get(n.depth) ?? 0) + 1);
const maxDepth = Math.max(...counts.keys());
console.log(`3×3: ${nodes.length} reachable boards; max click distance ${maxDepth}`);

const levels = [];
const used = new Set();
const bands = [[1, 3], [4, 9], [8, 13], [12, maxDepth]];
for (let chapter = 0; chapter < 4; chapter += 1) {
  const [lo, hi] = bands[chapter];
  const pool = nodes.map((node, index) => ({ node, index }))
    .filter(({ node }) => node.depth >= lo && node.depth <= hi && (chapter !== 1 || node.long > 0))
    .sort((a, b) => a.node.depth - b.node.depth || b.node.long - a.node.long || a.index - b.index);
  for (let slot = 0; slot < 8; slot += 1) {
    const desired = Math.round(lo + (hi - lo) * slot / 7);
    const candidates = pool.filter(({ node, index }) => node.depth >= desired && node.depth <= desired + 1
      && !mirrors(node.board, 3).some((v) => used.has(v))
      && (chapter !== 0 || slot > 1 || (node.depth === slot + 1 && (() => {
        let board = node.board;
        for (const action of pathToSolved(nodes, index)) {
          const result = L.move(board, 3, action);
          if (result.line.length !== 2) return false;
          board = result.board;
        }
        return true;
      })())));
    if (!candidates.length) throw new Error(`Insufficient 3×3 boards for ${chapter + 1}.${slot + 1}`);
    const pick = candidates[Math.floor((slot * 31 + chapter * 17) % candidates.length)];
    for (const v of mirrors(pick.node.board, 3)) used.add(v);
    const id = levels.length + 1;
    levels.push({ id, chapter: chapter + 1, width: 3, board: pick.node.board, generatorVersion: 1,
      reference: pathToSolved(nodes, pick.index), proof: "exact", distance: pick.node.depth,
      title: ["借一个空位", "换个方向", "留出通道", "托盘接力", "轻推一下", "顺着空槽", "最后交接", "整齐开门"][slot] });
  }
}

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function scramble4(seed, steps, minimumIndex = 0) {
  const rng = random(seed);
  let board = L.solved(4);
  const undos = [];
  const seen = new Set([L.key(board)]);
  for (let turn = 0; turn < steps; turn += 1) {
    const choices = L.legalIndices(board, 4).filter((index) => index >= minimumIndex).map((index) => L.move(board, 4, index))
      .filter((move) => !seen.has(L.key(move.board)) && indexNotUndo(move.clicked, undos));
    if (!choices.length) return null;
    const move = choices[Math.floor(rng() * choices.length)];
    board = move.board;
    seen.add(L.key(board));
    undos.push(move.blankBefore);
  }
  return { board, reference: undos.reverse() };
}

function indexNotUndo(index, undos) { return index !== undos.at(-1); }

function hasLongSlide(board, route) {
  for (const index of route) {
    const move = L.move(board, 4, index);
    if (move.line.length > 2) return true;
    board = move.board;
  }
  return false;
}

function onlyAdjacentSlides(board, route) {
  for (const index of route) {
    const move = L.move(board, 4, index);
    if (move.line.length !== 2) return false;
    board = move.board;
  }
  return true;
}

for (let slot = 0; slot < 16; slot += 1) {
  const id = levels.length + 1;
  const chapter = slot < 8 ? 5 : 6;
  const steps = slot < 8 ? slot + 1 : 15 + (slot - 8) * 2;
  let candidate;
  let exact;
  let seed;
  let found = false;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    seed = 20260924 + slot * 1009 + attempt;
    candidate = scramble4(seed, steps, id === 44 ? 8 : 0);
    if (!candidate || mirrors(candidate.board, 4).some((v) => used.has(v))) continue;
    exact = exactRoute4(candidate.board);
    if (!exact) continue;
    if (slot < 8 && (exact.distance !== steps
      || (slot < 2 && !onlyAdjacentSlides(candidate.board, exact.route))
      || (slot >= 2 && !hasLongSlide(candidate.board, exact.route)))) continue;
    found = true;
    break;
  }
  if (!found) throw new Error(`Cannot create 4×4 level ${id}`);
  for (const v of mirrors(candidate.board, 4)) used.add(v);
  levels.push({ id, chapter, width: 4, board: candidate.board, reference: exact.route,
    proof: "exact", distance: exact.distance, seed, generatorVersion: 2,
    title: slot < 8 ? ["大架初见", "把路留宽", "一排一排", "交错罐位", "先让后进", "顺着空格", "转角转运", "周末盘点"][slot]
      : ["开张准备", "分区摆放", "双排接力", "换个落点", "最后的两排", "留出回路", "窗边归位", "杏橘开张"][slot - 8] });
}

levels[0].title = "第一只罐子";
levels[2].title = "借一个空位";
levels[18].title = "给长架让路";
levels[43].title = "最后的两排";
// The final chapter keeps its authored boards, but orders the last trio by
// independently proven click distance so the difficulty does not dip.
for (const field of ["board", "reference", "distance", "seed"]) {
  [levels[44][field], levels[46][field]] = [levels[46][field], levels[44][field]];
}
levels[44].title = "橘皮转运";

for (const level of levels) {
  let board = level.board;
  for (const index of level.reference) {
    const result = L.move(board, level.width, index);
    if (!result) throw new Error(`Broken reference at level ${level.id}`);
    board = result.board;
  }
  if (!L.complete(board, level.width)) throw new Error(`Unsolved reference at level ${level.id}`);
}

fs.writeFileSync(output, `/* Generated by scripts/generate-levels.mjs; edit generator, not this file. */\n` +
  `globalThis.ApricotLevels = ${JSON.stringify({ version: 2, chapters, levels })};\n`);
console.log(`Wrote ${levels.length} verified levels to ${output}`);
