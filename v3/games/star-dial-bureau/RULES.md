# 星盘校准局（`star-dial-bureau`）规则契约

## 身份、来源与归属

- 批次：十境谜游馆 V3.0；规则原型：**Twiddle**。
- 规则来源固定为 [`ebnbin/puzzles` `upstream/main` at `5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`](https://github.com/ebnbin/puzzles/tree/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3)：[`doc-zh/twiddle.html`](https://github.com/ebnbin/puzzles/blob/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/doc-zh/twiddle.html)、[`vendor/sgtpuzzles/twiddle.c`](https://github.com/ebnbin/puzzles/blob/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/vendor/sgtpuzzles/twiddle.c) 与 [`src/games/twiddle.ts`](https://github.com/ebnbin/puzzles/blob/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/src/games/twiddle.ts)。上游 `vendor/sgtpuzzles/LICENCE` 为 **MIT License**。
- 复用的是 Twiddle 的 2×2 方块旋转、升序目标与方向约定；星盘主题、中文文案、星环图形、固定题面、SVG 教程、存档、奖励和网页实现均为本项目独立创作。

## 规则真值

棋盘永远是一个 4×4 的 1…16 排列，行优先坐标为 `(row, column)`，均从零开始。完成态严格是：

```text
 1  2  3  4
 5  6  7  8
 9 10 11 12
13 14 15 16
```

唯一主操作是选择 `row ∈ [0,2]`、`column ∈ [0,2]` 的相邻 2×2 窗口，并旋转四枚星环。

```text
顺时针 cw                 逆时针 ccw
[ a b ] → [ c a ]         [ a b ] → [ b d ]
[ c d ]   [ d b ]         [ c d ]   [ a c ]
```

- 点击/触碰九个交点选窗口；页面上两个独立按钮明确写出 **逆时针** 与 **顺时针**。键盘 `Enter` 为逆时针，`Space` 为顺时针，方向键移动窗口。
- 非法行、列、方向或已完成状态的操作是原子 no-op：不改盘面、不计步、不写历史。
- 编号、星标、选框、动画、教程、参考步数与奖励不参与胜负判定。仅 `board[i] === i + 1` 对所有 `i=0…15` 才完成。
- 撤销删除最后一个经过验证的旋转；重开重新使用该关的固定初始盘面和新 `runId`。

## 固定关卡与可验证性

每关从完成盘 `SOLVED_BOARD` 依次执行 `levels.mjs` 中列出的 `scramble` 生成，不保存不透明洗牌结果。`defineLevel` 会重放扰动、反向反向回放，并拒绝非完成或无法逆转的关卡。`par` 是这条固定逆向回放长度；它是“可复算参考线”，**不宣称理论最少旋转数**。

| 等级 | ID | 种子 | 扰动次数 / 参考回放 |
| --- | --- | ---: | ---: |
| 入门 | `first-zenith` | 30101 | 1 |
| 入门 | `orion-offset` | 30102 | 3 |
| 进阶 | `lyra-shear` | 30103 | 5 |
| 进阶 | `perseus-weave` | 30104 | 7 |
| 深空 | `eclipse-lattice` | 30105 | 10 |
| 深空 | `deep-field-drift` | 30106 | 14 |

没有“唯一解”承诺：Twiddle 的旋转群可能让一关存在多条完成回放；每关只承诺上述固定合法扰动及其可重放逆序可解。

## 主题映射

| 原规则概念 | 世界元素 | 视觉及反馈 | 不可改变的含义 |
| --- | --- | --- | --- |
| 编号方块 | 不可编辑的星历环 | 金属同心环、星标、清晰编号 | 值仍是 1…16 的排列 |
| 2×2 方块 | 校准窗 | 九枚金色交点、青色选框 | 只能影响相邻四格 |
| 左/右键旋转 | 逆/顺时针校准 | `↺` / `↻` 分列按钮及文字 | 两种方向严格相反 |
| 升序完成 | 天球复位 | 金色对准环与完成校签 | 所有 16 个位置均正确 |

玩家身份是校准局天球技师；核心动词是“选窗、辨向、旋回”。星盘环、金属刻度和轨道脉冲避免把它呈现成普通数字方块拼图。

## 教程真值链

教程固定使用 `orion-offset`（seed `30102`）。三张 SVG 的 `data-*` 标记可被专测复算：

1. `assets/tutorial-elements.svg`：该关真实 `initialBoard`，`data-state="initial"`。
2. `assets/tutorial-action.svg`：从同一初始盘执行 `{row:2,column:2,direction:"ccw"}`；左右独立盘面分别显示前后状态，绝不叠影。
3. `assets/tutorial-goal.svg`：执行完整三步 `referenceSolution` 后的 `1…16` 完成盘，`data-state="solved"`。

初访自动打开；“跳过”、Esc、走完第三张和关闭路径均只写本游戏教程键 `ten-realms-v3:games:star-dial-bureau:tutorial:v3`，不会清除局面或奖励。模态保存并恢复焦点、锁定背景滚动，图片用完整 `640×420` viewBox 和 `object-fit: contain`。

## 存档、完成与幂等奖励

- 私有键只能位于 `ten-realms-v3:games:star-dial-bureau:`：`profile:v1`、`session:v1`、`tutorial:v3`、`completion-outbox:v1`。损坏的**本游戏目标键**会被移除；从不枚举或清空其他游戏的键。
- 会话只保存 `levelId`、`runId`、已验证的旋转历史和计时；读取时从固定初始盘重放，绝不信任保存的完成标志或盘面。
- 完成 ID 和事件 ID 固定为 `<slug>:<runId>:complete`，即 `star-dial-bureau:<runId>:complete`。完成 payload 包含官方关卡、历史、步骤、参考线、时间和本地 reward claims，接收前重新回放到完成盘。
- 结算顺序：先把本地 `settledEvents`/奖励账本写入 profile，再写会话及 outbox，最后安全调用 `window.TenRealmsV3` 或 `window.RealmArcade` 的单一 `complete` 方法。outbox 可重试；本地事件账本、outbox 和宿主的稳定 event ID 都会去重，刷新不会重复奖励。
- 激励：每关首次校准、刷新个人记录、达到或优于可复算参考线各有独立 claim ID。重复同一完成事件或同一 claim 不增加记录；参考线不是“最优”宣称。

## 移动与可访问性

九个校准交点及两颗方向按钮均至少 44×44 CSS 像素；触屏不依赖右键、悬停或横向滚动。盘面尺寸同时受视口宽高约束，窄屏折为单列；教程自身可滚动并保留完整比例。颜色外还使用位置、箭头字形、选框和文字区别方向与状态；`prefers-reduced-motion` 保留状态变化但缩短动画。

## 验收命令

```bash
node v3/games/star-dial-bureau/tests.mjs
```

专测覆盖排列/旋转不变量、顺逆方向、非法 no-op、六个固定关卡重放、完成边界、撤销/恢复、篡改会话回退、完成与奖励幂等、教程 XML 与真实盘面链、命名空间隔离及入口的移动触控合同。
