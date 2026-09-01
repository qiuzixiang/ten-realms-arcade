import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CLEAR_BONUS,
  DIFFICULTIES,
  EMPTY,
  MIN_GROUP_SIZE,
  SCORE_SUBTRACT,
  STATUS,
  applyMove,
  boardFocusTarget,
  boardShape,
  cellAt,
  cloneBoard,
  collapseBoard,
  countSpirits,
  createGame,
  evacuationPath,
  generateBoard,
  getGroup,
  hasLegalMove,
  inBounds,
  isBoardEmpty,
  keyOf,
  listGroups,
  normalizeSeed,
  pointFromKey,
  previewMove,
  restoreGame,
  scoreForGroup,
  selectionRenderOptions,
  serializeGame,
  statusForBoard,
  validateBoard,
  validateGame,
} from "./logic.mjs";

const stylesheet = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("./app.mjs", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("./index.html", import.meta.url), "utf8");

let assertions = 0;
let passed = 0;

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function test(name, run) {
  try {
    run();
    passed += 1;
    process.stdout.write(`✓ Night Market Spirits · ${name}\n`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

function playPath(board, path) {
  let game = {
    version: 1,
    difficulty: "lantern",
    seed: 1,
    board: cloneBoard(board),
    score: 0,
    moves: 0,
    removed: 0,
    status: statusForBoard(board),
  };
  for (const point of path) {
    const result = applyMove(game, point.row, point.column);
    ok(result.accepted, `参考路径在 ${point.row}:${point.column} 必须合法`);
    game = result.state;
  }
  return game;
}

test("规则常量采用上游默认计分，而非变体或常见清盘奖", () => {
  equal(MIN_GROUP_SIZE, 2);
  equal(SCORE_SUBTRACT, 2);
  equal(CLEAR_BONUS, 0);
  equal(scoreForGroup(0), 0);
  equal(scoreForGroup(1), 0);
  equal(scoreForGroup(2), 0);
  equal(scoreForGroup(3), 1);
  equal(scoreForGroup(4), 4);
  equal(scoreForGroup(5), 9);
  equal(scoreForGroup(8), 36);
});

test("棋盘校验、边界与坐标助手拒绝畸形输入", () => {
  equal(validateBoard([]), false);
  equal(validateBoard([[]]), false);
  equal(validateBoard([[0, 1], [2]]), false);
  equal(validateBoard([[0, -1]]), false);
  equal(validateBoard([[0, 3]], { colors: 3 }), false);
  equal(validateBoard([[0, EMPTY], [2, 1]], { width: 2, height: 2, colors: 3 }), true);
  equal(boardShape([[0, 1], [1, 0]]), { width: 2, height: 2 });
  equal(inBounds([[0]], 0, 0), true);
  equal(inBounds([[0]], 0, 1), false);
  equal(cellAt([[2]], 0, 0), 2);
  equal(cellAt([[2]], -1, 0), EMPTY);
  equal(keyOf(12, 3), "12:3");
  equal(pointFromKey("12:3"), { row: 12, column: 3 });
  equal(pointFromKey("-1:3"), null);
});

test("洪泛只沿正交方向，并返回完整最大同色分量", () => {
  const board = [
    [0, 0, 1, 2],
    [0, 1, 1, 2],
    [2, 1, 0, 0],
    [1, 2, 0, 0],
  ];
  equal(getGroup(board, 0, 0), [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 1, column: 0 },
  ]);
  equal(getGroup(board, 0, 2), [
    { row: 0, column: 2 },
    { row: 1, column: 1 },
    { row: 1, column: 2 },
    { row: 2, column: 1 },
  ]);
  equal(getGroup(board, 2, 2).length, 4);
  equal(getGroup(board, 0, 0).some((point) => point.row === 2 && point.column === 2), false);
  equal(getGroup(board, 99, 99), []);
});

test("对角同色不连接，单只不是合法群组", () => {
  const diagonal = [
    [0, 1, 2],
    [2, 0, 1],
    [1, 2, 0],
  ];
  equal(getGroup(diagonal, 0, 0), [{ row: 0, column: 0 }]);
  equal(listGroups(diagonal), []);
  equal(hasLegalMove(diagonal), false);
  equal(statusForBoard(diagonal), STATUS.STUCK);
});

test("单只与空摊位完全不改变棋盘、步数或得分", () => {
  const game = {
    version: 1,
    difficulty: "lantern",
    seed: 3,
    board: [[0, 1], [2, EMPTY]],
    score: 7,
    moves: 2,
    removed: 26,
    status: STATUS.PLAYING,
  };
  const singleton = applyMove(game, 0, 0);
  equal(singleton.accepted, false);
  equal(singleton.reason, "group-too-small");
  equal(singleton.state, game);
  equal(game.score, 7);
  equal(game.moves, 2);
  equal(game.board, [[0, 1], [2, EMPTY]]);

  const empty = applyMove(game, 1, 1);
  equal(empty.accepted, false);
  equal(empty.reason, "empty");
  equal(empty.state, game);
});

test("预览完整群组及预计分数，但本身是纯只读操作", () => {
  const game = createGame({ seed: 42, difficulty: "lantern" });
  const group = listGroups(game.board)[0];
  const anchor = group[0];
  const before = JSON.stringify(game);
  const preview = previewMove(game, anchor.row, anchor.column);
  equal(preview.accepted, true);
  equal(preview.group, getGroup(game.board, anchor.row, anchor.column));
  equal(preview.scoreDelta, scoreForGroup(preview.group.length));
  equal(preview.clearBonus, 0);
  equal(JSON.stringify(game), before);
  equal(preview.state, game);
});

test("首次选组重建棋盘时仅键盘路径恢复 roving 焦点", () => {
  const coordinate = { row: 2, column: 3 };
  equal(selectionRenderOptions(coordinate, true), {
    preferredFocus: coordinate,
    focus: true,
  });
  equal(selectionRenderOptions(coordinate, false), {
    preferredFocus: coordinate,
    focus: false,
  });
  equal(selectionRenderOptions(coordinate), {
    preferredFocus: coordinate,
    focus: false,
  }, "鼠标、触控和默认路径不得强制聚焦重建后的按钮");
});

test("终局弹窗关闭后按盘面状态选择合理焦点目标", () => {
  equal(boardFocusTarget([[EMPTY, EMPTY]]), "board", "空盘应聚焦可聚焦的 grid 容器");
  equal(boardFocusTarget([[0, 1], [1, 0]]), "cell", "非空残局应聚焦 roving 棋格");
  equal(boardFocusTarget(generateBoard(19, "lantern")), "cell", "可玩盘面同样应回到棋格");
});

test("返回入口与页脚独立触控目标声明至少 44 × 44", () => {
  const backLinkRule = /\.back-link\s*\{([^}]*)\}/.exec(stylesheet)?.[1] ?? "";
  const footerControlsRule = /footer a,\s*footer button\s*\{([^}]*)\}/.exec(stylesheet)?.[1] ?? "";
  ok(/min-height:\s*44px/.test(backLinkRule), "返回链接自身必须至少 44px 高");
  ok(/display:\s*inline-flex/.test(footerControlsRule), "页脚目标必须由真实布局盒承载尺寸");
  ok(/min-width:\s*44px/.test(footerControlsRule), "页脚链接和按钮必须至少 44px 宽");
  ok(/min-height:\s*44px/.test(footerControlsRule), "页脚链接和按钮必须至少 44px 高");
});

test("320px 手机完整显示最高难度摊位而不要求横滑", () => {
  ok(/function syncBoardScale\(\)/.test(appSource));
  ok(/elements\.boardScroll\.scrollLeft = 0/.test(appSource));
  ok(/@media \(max-width: 430px\)[\s\S]*?\.board-scroll\s*{[^}]*overflow-x:\s*hidden/.test(stylesheet));
  ok(/grid-template-columns:\s*repeat\(var\(--columns\),\s*var\(--cell, 44px\)\)/.test(stylesheet));
  ok(/\.stall-slot\s*{[\s\S]*?width:\s*var\(--cell, 44px\)[\s\S]*?min-width:\s*0/.test(stylesheet));
  ok(/styles\.css\?v=mobile-fit-1/.test(htmlSource));
  ok(/app\.mjs\?v=mobile-fit-1/.test(htmlSource));
});

test("移除后先逐列稳定下落，再稳定向左合并非空列", () => {
  const board = [
    [0, 1, 2, 3],
    [0, 1, EMPTY, 3],
    [2, 1, 2, 4],
  ];
  const group = getGroup(board, 0, 1);
  equal(group.length, 3);
  equal(collapseBoard(board, group), [
    [0, EMPTY, 3, EMPTY],
    [0, 2, 3, EMPTY],
    [2, 2, 4, EMPTY],
  ]);
  equal(board, [
    [0, 1, 2, 3],
    [0, 1, EMPTY, 3],
    [2, 1, 2, 4],
  ], "输入棋盘必须保持不变");
});

test("列合并保持每列内部次序与各非空列相对次序", () => {
  const board = [
    [EMPTY, 0, EMPTY, 1, 2],
    [EMPTY, 2, EMPTY, 3, 4],
    [EMPTY, 4, EMPTY, 0, 1],
  ];
  equal(collapseBoard(board, []), [
    [0, 1, 2, EMPTY, EMPTY],
    [2, 3, 4, EMPTY, EMPTY],
    [4, 0, 1, EMPTY, EMPTY],
  ]);
});

test("坠落形成的新群只成为下一手机会，不会自动连消或加分", () => {
  const game = {
    version: 1,
    difficulty: "lantern",
    seed: 7,
    board: [
      [1, 2, 1],
      [0, 2, 0],
      [0, 1, 0],
    ],
    score: 0,
    moves: 0,
    removed: 21,
    status: STATUS.PLAYING,
  };
  const result = applyMove(game, 0, 1);
  equal(result.accepted, true);
  equal(result.group.length, 2);
  equal(result.scoreDelta, 0);
  equal(result.state.moves, 1);
  equal(result.state.removed, 23);
  equal(countSpirits(result.state.board), 7);
  ok(listGroups(result.state.board).length > 0, "新形成的群应留在盘面等待下一次确认");
});

test("清空优先判胜，最终两只得零分且没有隐藏清盘奖励", () => {
  const game = {
    version: 1,
    difficulty: "lantern",
    seed: 9,
    board: [[0, 0]],
    score: 17,
    moves: 4,
    removed: 28,
    status: STATUS.PLAYING,
  };
  const result = applyMove(game, 0, 0);
  equal(result.accepted, true);
  equal(result.group.length, 2);
  equal(result.scoreDelta, 0);
  equal(result.clearBonus, 0);
  equal(result.state.score, 17);
  equal(result.state.status, STATUS.CLEARED);
  equal(isBoardEmpty(result.state.board), true);
  equal(hasLegalMove(result.state.board), false);
  equal(statusForBoard(result.state.board), STATUS.CLEARED, "空盘即使也无邻接，仍必须优先判胜");
});

test("非空且无同色正交邻接对时结束为残局失败", () => {
  const game = {
    version: 1,
    difficulty: "lantern",
    seed: 11,
    board: [
      [0, 0, 1],
      [2, 1, 2],
    ],
    score: 0,
    moves: 0,
    removed: 24,
    status: STATUS.PLAYING,
  };
  const result = applyMove(game, 0, 0);
  equal(result.accepted, true);
  equal(result.state.board, [
    [EMPTY, EMPTY, 1],
    [2, 1, 2],
  ]);
  equal(countSpirits(result.state.board), 4);
  equal(result.state.status, STATUS.STUCK);
  equal(listGroups(result.state.board), []);
  const afterEnd = applyMove(result.state, 1, 0);
  equal(afterEnd.accepted, false);
  equal(afterEnd.reason, "game-over");
  equal(afterEnd.state, result.state);
});

test("应用合法操作只删除该最大分量并精确累计真实计分", () => {
  const game = {
    version: 1,
    difficulty: "lantern",
    seed: 13,
    board: [
      [0, 0, 1],
      [0, 0, 1],
      [2, 2, 1],
    ],
    score: 5,
    moves: 2,
    removed: 21,
    status: STATUS.PLAYING,
  };
  const result = applyMove(game, 0, 0);
  equal(result.group.length, 4);
  equal(result.scoreDelta, 4);
  equal(result.state.score, 9);
  equal(result.state.moves, 3);
  equal(result.state.removed, 25);
  equal(countSpirits(result.state.board), 5);
  equal(game.score, 5, "应用操作不可改写历史状态");
});

test("种子归一化稳定，三档难度同时改变尺寸与颜色数", () => {
  equal(normalizeSeed(42), 42);
  equal(normalizeSeed("42"), 42);
  equal(normalizeSeed(-1), 0xffffffff);
  equal(normalizeSeed("夜市-42"), normalizeSeed("夜市-42"));
  ok(normalizeSeed("夜市-42") !== normalizeSeed("夜市-43"));

  const configs = Object.values(DIFFICULTIES);
  equal(configs.map(({ width, height, colors }) => [width, height, colors]), [
    [5, 6, 3],
    [6, 7, 4],
    [7, 8, 5],
  ]);
  for (const config of configs) {
    const first = generateBoard(20260831, config.id);
    const second = generateBoard(20260831, config.id);
    equal(first, second, `${config.id} 同种子必须逐格一致`);
    equal(boardShape(first), { width: config.width, height: config.height });
    const colors = new Set(first.flat());
    equal(colors.size, config.colors);
    ok([...colors].every((color) => color >= 0 && color < config.colors));
  }
  ok(JSON.stringify(generateBoard(9, "lantern")) !== JSON.stringify(generateBoard(10, "lantern")));
});

test("多档多种子都构造出可程序重放至空盘的可靠题面", () => {
  const seeds = [0, 1, 2, 7, 42, 2026, 0x4e494748, 0xffffffff];
  for (const config of Object.values(DIFFICULTIES)) {
    for (const seed of seeds) {
      const game = createGame({ seed, difficulty: config.id });
      equal(game.status, STATUS.PLAYING);
      equal(game.board.length, config.height);
      equal(game.board[0].length, config.width);
      equal(countSpirits(game.board), config.width * config.height);
      ok(hasLegalMove(game.board));
      const path = evacuationPath(game.board);
      ok(Array.isArray(path) && path.length > 0, `${config.id}/${seed} 必须有清盘路径`);
      let current = game;
      for (const point of path) {
        const result = applyMove(current, point.row, point.column);
        ok(result.accepted, `${config.id}/${seed} 路径每步必须合法`);
        current = result.state;
      }
      equal(current.status, STATUS.CLEARED, `${config.id}/${seed} 必须重放至胜利`);
      equal(current.removed, config.width * config.height);
    }
  }
});

test("存档往返严格保留盘面，损坏或不一致数据安全回退", () => {
  let game = createGame({ seed: 8675309, difficulty: "canopy" });
  const group = listGroups(game.board)[0];
  game = applyMove(game, group[0].row, group[0].column).state;
  const restored = restoreGame(serializeGame(game));
  equal(restored, game);
  equal(validateGame(restored), true);
  equal(restoreGame("{broken"), null);

  const badStatus = structuredClone(game);
  badStatus.status = STATUS.CLEARED;
  equal(validateGame(badStatus), false);
  equal(restoreGame(badStatus), null);

  const badRemoved = structuredClone(game);
  badRemoved.removed += 1;
  equal(validateGame(badRemoved), false);

  const badColor = structuredClone(game);
  badColor.board[0][0] = 99;
  equal(validateGame(badColor), false);
});

test("辅助路径可识别普通无解残局而不伪造答案", () => {
  const stuck = [
    [0, 1],
    [1, 0],
  ];
  equal(evacuationPath(stuck), null);
  equal(isBoardEmpty(stuck), false);
  equal(countSpirits(stuck), 4);
});

process.stdout.write(`Night Market Spirits logic: ${assertions} assertions across ${passed} tests passed.\n`);
