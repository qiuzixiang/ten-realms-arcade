# 珊瑚孢群培育所（coral-bloom-lab）规则契约

## 身份、来源与许可

- 批次：十境谜游馆 3.0；玩家身份为深海珊瑚培育员。
- 原型：Simon Tatham Portable Puzzle Collection 的 **Filling**。
- 冻结来源：`upstream/main` 的 `ebnbin/puzzles@5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`；规则说明 `doc-zh/filling.html`，参考实现 `vendor/sgtpuzzles/filling.c`，触控映射参考 `src/games/filling.ts`。
- 原型、规则说明与参考实现按上游 MIT License 使用；本目录的主题、SVG、HTML、CSS 和 JavaScript 为本项目新实现，不复制上游绘制资产。

## 不变的规则真值

棋盘是 4 邻接的矩形格。每个固定孢核显示一个 1–9 的数字，不能修改；其他格可正式填入 1–9 或清除为空。

完成时，对每一个由**正交相邻**、且填有同一个数字的格所组成的连通分量，其面积必须**恰好等于该数字**。对角接触不连通。同一个数字允许有多个互不相连的分量；相邻的同数字一定属于同一分量，因此不能让它的面积超过该数字。

候选孢子是每格的 1–9 位掩码，只可写入空白非线索格；它不计步、不进可验证回放、不参与错误或胜利。错误警示只报告“已超过容量”或“即使占满可达空格仍长不够”，不改变任何合法输入。

## 主题映射

| 原规则概念 | 珊瑚世界元素 | 操作反馈 | 不得改变的含义 |
| --- | --- | --- | --- |
| 固定数字 | 孢核 | “核”徽记、不可编辑 | 初始线索不可改 |
| 同值正交连通 | 同型珊瑚枝群 | 同色枝节、完整群绿环 | 仅四方向连接 |
| 数字 | 群落容量 | 数字与容量面板 | 分量面积必须等于数字 |
| 候选 | 候选孢子 | 小号数字笔记 | 永不满足胜利 |
| 冲突 | 过度/断粮警示 | 红色警示环 | 仅反馈，不篡改状态 |

## 固定关卡与唯一性

关卡 ID：`tidal-nursery`、`lagoon-buds`、`anemone-archive`、`shelf-reef`、`abyssal-garden`。前三关 4×4，后二关 5×5；`levels.mjs` 固定其题面 ID、seed、线索与仅作回归对照的答案。

`logic.mjs#solveLevel` 是独立枚举器：它只读取棋盘尺寸和 `givens`，从不读取 `level.solution`。它以“分量不得超容、可达格数不得低于容量”剪枝，搜索至第二解上限。每个固定题面在 `tests.mjs` 中被证明 `count === 1` 且 `truncated === false`；因此“唯一”不依赖内置答案。

## 回放、存储和奖励

- 正式动作：`{ type: "fill", cell, value }`，`value` 可为 0–9；对线索、越界或同值的动作是原子 no-op，不进入时间线。
- 撤销删去最后一条正式动作后从初始状态回放；候选笔记不污染时间线。
- 私有键只能以 `ten-realms-v3:games:coral-bloom-lab:` 开头。恢复时必须重放时间线并逐字匹配状态，伪造答案或完成标志无效。
- 完成 ID 固定为 `coral-bloom-lab:<runId>:complete`。先把可验证 completion 写进私有 outbox，再交给 `window.TenRealmsV3` 或兼容的 `window.RealmArcade`；同 ID 重试由双方去重。
- 共享成长按首次关卡、个人最佳、建议步数、今日首胜和徽章计算；单纯刷新与重复同一完成事件不加分。

## 图片教程真值链

三张 SVG 都使用真实首关 `tidal-nursery`：初始状态、动作 `fill:0:4`、以及独立求解器验证的完整答案。它们带有 `data-level-id`、`data-state`、正确 `viewBox` 和语义标题；初访自动弹出，玩家可跳过、完整阅读或随时通过 `#tutorial-button` 重看。

## 验收

运行 `node v3/games/coral-bloom-lab/tests.mjs`。覆盖结构、五关独立唯一性、错误/胜利边界、候选不胜利、无效 no-op、撤销回放、损坏存档、完成幂等、私有键隔离、教程 SVG 真值和 320px 响应式合同。
