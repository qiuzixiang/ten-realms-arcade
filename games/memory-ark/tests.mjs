import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BOARD_SIZE,
  CANONICAL_ORIENTATION,
  DIRECTIONS,
  FACE_IDS,
  applyMove,
  boardIndex,
  countAwakeFaces,
  countGroundTokens,
  createPuzzle,
  createSolvedState,
  deserializeState,
  isWon,
  rewindMove,
  rollOrientation,
  serializeState,
  sameState,
  isImmediateSuccessor,
  validateHistoryChain,
  validateState,
} from "./logic.mjs";
import { FACE_VISUALS, ROLL_VISUALS, rollTransform, rollVisual } from "./visuals.mjs";

let assertions = 0;
function test(name, run) {
  try {
    run();
    process.stdout.write(`✓ Memory Ark · ${name}\n`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function orientationKey(orientation) {
  return Object.values(orientation).join("|");
}

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => permutations(values.toSpliced(index, 1))
    .map((rest) => [value, ...rest]));
}

test("四个方向保持精确的立方体朝向映射", () => {
  equal(rollOrientation(CANONICAL_ORIENTATION, "north"), {
    top: "wing", bottom: "tide", north: "sun", south: "echo", east: "seed", west: "eye",
  });
  equal(rollOrientation(CANONICAL_ORIENTATION, "east"), {
    top: "eye", bottom: "seed", north: "tide", south: "wing", east: "sun", west: "echo",
  });
  equal(rollOrientation(CANONICAL_ORIENTATION, "south"), {
    top: "tide", bottom: "wing", north: "echo", south: "sun", east: "seed", west: "eye",
  });
  equal(rollOrientation(CANONICAL_ORIENTATION, "west"), {
    top: "seed", bottom: "eye", north: "tide", south: "wing", east: "echo", west: "sun",
  });
});

test("视觉翻滚轴与规则朝向一致，东西向不再被误画成原地转身", () => {
  equal(ROLL_VISUALS.north, { arrow: "↑", axis: "X", quarterTurns: 1, label: "向上翻滚" });
  equal(ROLL_VISUALS.south, { arrow: "↓", axis: "X", quarterTurns: -1, label: "向下翻滚" });
  equal(ROLL_VISUALS.east, { arrow: "→", axis: "Z", quarterTurns: 1, label: "向右翻滚" });
  equal(ROLL_VISUALS.west, { arrow: "←", axis: "Z", quarterTurns: -1, label: "向左翻滚" });
  equal(rollTransform("base", "east", 0.5), "base rotateZ(45deg)");
  equal(rollTransform("base", "north", 1), "base rotateX(90deg)");
  equal(rollVisual("west").arrow, "←");
  assert.throws(() => rollVisual("diagonal"), /Unknown direction/);
  assert.throws(() => rollTransform("base", "east", 1.1), /between 0 and 1/);
  assertions += 2;

  const slotVectors = {
    top: [0, -1, 0], bottom: [0, 1, 0], north: [0, 0, -1],
    south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0],
  };
  const vectorSlots = new Map(Object.entries(slotVectors).map(([slot, vector]) => [vector.join(","), slot]));
  const rotateVector = ([x, y, z], { axis, quarterTurns }) => {
    if (axis === "X" && quarterTurns === 1) return [x, -z, y];
    if (axis === "X" && quarterTurns === -1) return [x, z, -y];
    if (axis === "Z" && quarterTurns === 1) return [-y, x, z];
    return [y, -x, z];
  };
  for (const direction of Object.keys(DIRECTIONS)) {
    const visualOrientation = {};
    for (const [oldSlot, face] of Object.entries(CANONICAL_ORIENTATION)) {
      const newSlot = vectorSlots.get(rotateVector(slotVectors[oldSlot], ROLL_VISUALS[direction]).join(","));
      visualOrientation[newSlot] = face;
    }
    equal(visualOrientation, rollOrientation(CANONICAL_ORIENTATION, direction));
  }
});

test("六个物理表面始终具有互不重复的刻度标识", () => {
  equal(Object.keys(FACE_VISUALS).sort(), [...FACE_IDS].sort());
  equal(new Set(Object.values(FACE_VISUALS).map(({ index }) => index)).size, FACE_IDS.length);
  for (const visual of Object.values(FACE_VISUALS)) {
    ok(visual.index.length > 0);
    ok(visual.name.endsWith("面"));
  }
});

test("版本化入口沿整条模块依赖链绕过旧缓存", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  ok(html.includes('./game.js?v=20260901a'));
  ok(game.includes('from "./logic.mjs?v=20260901a"'));
  ok(game.includes('from "./visuals.mjs?v=20260901a"'));
});

test("相反滚动复原朝向；同向四滚也复原", () => {
  for (const [direction, { opposite }] of Object.entries(DIRECTIONS)) {
    equal(rollOrientation(rollOrientation(CANONICAL_ORIENTATION, direction), opposite), CANONICAL_ORIENTATION);
    let orientation = CANONICAL_ORIENTATION;
    for (let index = 0; index < 4; index += 1) orientation = rollOrientation(orientation, direction);
    equal(orientation, CANONICAL_ORIENTATION);
  }
});

test("合法滚动恰好产生 24 个朝向，且校验只接受这 24 个", () => {
  const pending = [CANONICAL_ORIENTATION];
  const reachable = new Map([[orientationKey(CANONICAL_ORIENTATION), CANONICAL_ORIENTATION]]);
  for (let index = 0; index < pending.length; index += 1) {
    for (const direction of Object.keys(DIRECTIONS)) {
      const next = rollOrientation(pending[index], direction);
      const key = orientationKey(next);
      if (reachable.has(key)) continue;
      reachable.set(key, next);
      pending.push(next);
    }
  }

  equal(reachable.size, 24);
  const template = createSolvedState();
  for (const orientation of reachable.values()) {
    ok(validateState({ ...template, orientation }), "合法滚动得到的朝向必须被接受");
  }

  let accepted = 0;
  for (const permutation of permutations(FACE_IDS)) {
    const orientation = Object.fromEntries(Object.keys(CANONICAL_ORIENTATION)
      .map((position, index) => [position, permutation[index]]));
    if (!validateState({ ...template, orientation })) continue;
    accepted += 1;
    ok(reachable.has(orientationKey(orientation)), "校验不得接受滚动无法到达的排列");
  }
  equal(accepted, 24);
});

test("交换两个表面造成的不可能朝向会被存档校验拒绝", () => {
  const impossible = createSolvedState();
  impossible.orientation = {
    ...impossible.orientation,
    top: CANONICAL_ORIENTATION.bottom,
    bottom: CANONICAL_ORIENTATION.top,
  };
  equal(validateState(impossible), false);
  equal(deserializeState(serializeState(impossible)), null);
});

test("落地后目标地格与新的底面严格交换符印", () => {
  const state = createSolvedState({ x: 1, y: 1 });
  const destination = boardIndex(2, 1);
  state.faceTokens.seed = null;
  state.board[destination] = "memory-seed";
  const result = applyMove(state, "east");
  equal(result.moved, true);
  equal(result.exchange.face, "seed");
  equal(result.exchange.pickedUp, "memory-seed");
  equal(result.state.faceTokens.seed, "memory-seed");
  equal(result.state.board[destination], null);
  equal(result.state.position, { x: 2, y: 1 });
  equal(result.state.moves, 1);
  equal(state.position, { x: 1, y: 1 }, "输入状态必须保持不可变");
});

test("有符印底面落到空格会留下压印", () => {
  const state = createSolvedState({ x: 1, y: 1 });
  const result = applyMove(state, "north");
  equal(result.exchange.face, "tide");
  equal(result.state.faceTokens.tide, null);
  equal(result.state.board[boardIndex(1, 0)], "memory-tide");
  equal(countAwakeFaces(result.state), 5);
  equal(countGroundTokens(result.state), 1);
});

test("地格与底面同为有色或同为无色时二值状态不变", () => {
  const bothColored = createSolvedState({ x: 1, y: 1 });
  bothColored.board[boardIndex(2, 1)] = bothColored.faceTokens.sun;
  bothColored.faceTokens.sun = null;
  const beforeTile = bothColored.board[boardIndex(2, 1)];
  const beforeFace = bothColored.faceTokens.seed;
  const coloredResult = applyMove(bothColored, "east");
  equal(coloredResult.exchange.changed, false);
  equal(coloredResult.state.board[boardIndex(2, 1)], beforeTile, "两个有色状态不得因视觉纹样而互换身份");
  equal(coloredResult.state.faceTokens.seed, beforeFace);

  const puzzle = createPuzzle(9).initial;
  const emptyDirection = Object.keys(DIRECTIONS).find((direction) => {
    const delta = DIRECTIONS[direction];
    const x = puzzle.position.x + delta.dx;
    const y = puzzle.position.y + delta.dy;
    return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE && !puzzle.board[boardIndex(x, y)];
  });
  ok(emptyDirection, "测试局应至少有一个相邻空格");
  const emptyResult = applyMove(puzzle, emptyDirection);
  equal(emptyResult.exchange.changed, false);
  equal(countAwakeFaces(emptyResult.state), 0);
  equal(countGroundTokens(emptyResult.state), 6);
});

test("边界外滚动被拒绝且不增加步数", () => {
  const state = createSolvedState({ x: 0, y: 0 });
  for (const direction of ["north", "west"]) {
    const result = applyMove(state, direction);
    equal(result.moved, false);
    equal(result.state, state);
    equal(result.exchange, null);
  }
});

test("逆生成步骤和正向步骤逐方向完全互逆", () => {
  for (const backDirection of Object.keys(DIRECTIONS)) {
    const solved = createSolvedState({ x: 1, y: 1 });
    const rewound = rewindMove(solved, backDirection);
    const replayed = applyMove(rewound.state, rewound.forwardDirection).state;
    replayed.moves = solved.moves;
    equal(replayed, solved, `${backDirection} 未能复原`);
  }
});

test("胜利只在六枚符印全部位于六个表面时成立", () => {
  const solved = createSolvedState();
  equal(isWon(solved), true);
  const unsolved = applyMove(solved, "north").state;
  equal(isWon(unsolved), false);
  equal(countAwakeFaces(unsolved), 5);
  equal(countGroundTokens(unsolved), 1);
});

test("多组随机种子都生成标准 4×4、地面六符印且可回放求解", () => {
  for (const seed of [1, 2, 7, 42, 2026, 0x41524b, 0xffffffff]) {
    const puzzle = createPuzzle(seed);
    let state = puzzle.initial;
    equal(state.size, BOARD_SIZE);
    equal(state.board.length, 16);
    equal(countAwakeFaces(state), 0);
    equal(countGroundTokens(state), FACE_IDS.length);
    equal(state.board[boardIndex(state.position.x, state.position.y)], null, "核心开局格必须为空");
    equal(isWon(state), false);
    ok(puzzle.solution.length >= 30, "参考解不应是开局即解或过短占位局");
    ok(validateState(state));

    for (const direction of puzzle.solution) {
      const result = applyMove(state, direction);
      ok(result.moved, "生成器不得给出越界参考步");
      state = result.state;
      ok(validateState(state), "合法回放中的每个朝向都必须保持可存档");
      equal(countAwakeFaces(state) + countGroundTokens(state), FACE_IDS.length, "符印总量必须守恒");
    }
    equal(isWon(state), true, `seed ${seed} 的参考解无效`);
  }
});

test("存档仅接受结构与六枚唯一符印都有效的状态", () => {
  const state = createPuzzle(12).initial;
  equal(deserializeState(serializeState(state)), state);
  equal(deserializeState("{broken"), null);
  const duplicate = structuredClone(state);
  const occupied = duplicate.board.findIndex(Boolean);
  const second = duplicate.board.findIndex((token, index) => Boolean(token) && index !== occupied);
  duplicate.board[second] = duplicate.board[occupied];
  equal(validateState(duplicate), false);
  equal(deserializeState(JSON.stringify(duplicate)), null);
});

test("撤销历史必须由逐步相邻且规则可重放的状态组成", () => {
  const puzzle = createPuzzle(20260901);
  const history = [];
  let current = puzzle.initial;
  for (const direction of puzzle.solution.slice(0, 6)) {
    history.push(current);
    current = applyMove(current, direction).state;
  }

  equal(validateHistoryChain(puzzle.initial, current, history), true);
  equal(sameState(history[0], puzzle.initial), true);
  equal(isImmediateSuccessor(history.at(-1), current), true);

  const missingStep = history.toSpliced(2, 1);
  equal(validateHistoryChain(puzzle.initial, current, missingStep), false, "缺步历史不能恢复");

  const unrelated = structuredClone(history);
  unrelated[3] = createPuzzle(99).initial;
  unrelated[3].moves = history[3].moves;
  equal(validateHistoryChain(puzzle.initial, current, unrelated), false, "结构有效但无法重放的历史不能恢复");

  const forgedCurrent = structuredClone(current);
  forgedCurrent.moves += 1;
  equal(validateHistoryChain(puzzle.initial, forgedCurrent, history), false, "伪造步数不能绕过历史链");
  equal(validateHistoryChain(puzzle.initial, puzzle.initial, []), true);
});

process.stdout.write(`Memory Ark logic: ${assertions} assertions passed.\n`);
