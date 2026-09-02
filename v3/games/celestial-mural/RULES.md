# 天象壁画修复室 · 规则契约

## 身份、来源与许可

- 版本：V3.0；slug：`celestial-mural`；规则原型：**Mosaic**。
- 权威规则：`doc-zh/mosaic.html`，固定来源提交
  [`5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`](https://github.com/ebnbin/puzzles/tree/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3)。
- 交互和结算语义交叉核对：`vendor/sgtpuzzles/mosaic.c` 的
  `current_key_label`、`interpret_move`、`update_board_state_around` 与
  `execute_move`；上游适配声明在 `src/games/mosaic.ts`。
- 上游 Mosaic 由 Didi Kohen 贡献；Portable Puzzle Collection 的相关代码以
  **MIT License** 许可。V3 总声明由 `v3/THIRD_PARTY_NOTICES.md` 维护。
- 本目录的天象叙事、壁画视觉、固定题面、SVG 教程、浏览器实现和测试为本项目新作；
  没有复制上游视觉素材或代码。

## 主题映射

| Mosaic 规则 | 天象世界元素 | 可见区分 | 玩家操作 | 不改变的含义 |
| --- | --- | --- | --- | --- |
| 未标记格 | 未定残片 | 蓝灰斜纹 + “未定”读屏文字 | 等待填色 | 尚未指定黑或白 |
| 黑格 | 深色星尘颜料 | 青绿深层、星砂纹、发光星点 | 左键/深色工具 | 计入线索黑格数 |
| 白格 | 浅色底料 | 石灰暖白、细颗粒纹 | 右键/浅色工具 | 不计入线索黑格数 |
| 数字线索 | 石刻计数印记 | 米白圆章与大数字 | 只读 | 统计自身在内的 3×3 深色格数 |
| 完成 | 壁画显影 | 穹顶光晕 + 完成章 | 所有条件同时满足 | 不改变原始计数规则 |

## 规则真值

### 棋盘与状态

- 每关为 `width × height` 格子；坐标从零开始，索引为 `row * width + column`。
- 单格状态严格为 `0=EMPTY`、`1=BLACK`、`2=WHITE`。没有“半填”“候选”或隐含颜色。
- 每枚线索的邻域是受棋盘边界裁切的 3×3 方块，**包括线索格自身**。
- 每个非空线索 `n` 都要求其邻域中的 `BLACK` 格数恰好为 `n`。`WHITE` 和
  `EMPTY` 不计入黑格数。

### 合法输入

- 上游左键循环：`EMPTY → BLACK → WHITE → EMPTY`。
- 上游右键循环：`EMPTY → WHITE → BLACK → EMPTY`。
- 本作提供等价的触屏颜料台：深色循环、浅色循环，以及直接将非空格设回 `EMPTY`
  的清除工具。清除空格为严格 no-op，不会计步。
- 键盘方向键移动焦点；`Enter` 执行深色循环、`Space` 执行浅色循环、
  `Backspace/Delete` 清除；`U` 撤回，`R` 重置。
- 一个历史动作只允许有效的 `{ index, tool }`；越界、未知工具、已完成后继续操作和
  空格清除不会被写入历史。撤回通过去掉最后一条历史后完整重放。

### 完成与过程反馈

- 线索出现“已不可能”只在 `black > target` 或 `black + empty < target`；它是反馈，
  不会自动结束或改变任何格子。
- “当前吻合”表示已知深色数等于目标；只有全部线索吻合且没有任何 `EMPTY` 才完成。
- **全盘明确**是本合集冻结的结算合同：哪怕某些原始谜面未显示的区域在计数上自由，
  玩家仍须明确为黑或白，才让壁画完成。它不改变任一线索的 3×3 计数或合法循环。
- 所有关卡从空盘开始；一次非清除的合法动作只会明确一格。因此参考 `par = width × height`
  是严格下界；执行正确深/浅首笔即可达到，并被标记为“无返工全显影”，不是唯一解宣称。

## 固定题面与可复算性

五个题面是静态数据：`dawn-archive` (4×4)、`moon-river` (5×5)、
`comet-court` (5×5)、`aurora-vault` (6×6)、`zenith-restoration` (7×7)。

- 每关的 `referenceMural` 只用于从规则生成可追溯的线索、制作真实教程和回归测试；
  胜利判定从不读取它，而是重新计算玩家棋盘的线索。
- `validateLevel` 重算每一枚显示线索，并验证 `referenceSolution` 是从空盘逐格执行的
  深/浅合法操作。所有固定题面可复现，`referenceState(level)` 均由同一个动作引擎判定完成。
- 未声称任何关卡唯一；不同的全明确图若满足所有显示线索，同样是合法完成，符合 Mosaic
  原型允许的谜面语义。

## 教程真值链

教程固定使用 `dawn-archive`：

1. `tutorial-elements.svg`：`data-state="initial"`，16 格都是 `0`，线索为
   `3,4,3,1,4,5,5,2,3,5,5,3,1,2,3,2`。
2. `tutorial-action.svg`：`data-action-index="5"`、`data-action-tool="black"`，
   左右并排的真实前后状态分别为全 `0` 和仅 index 5 为 `1`。
3. `tutorial-goal.svg`：`data-state="complete"`，棋盘为
   `2,1,2,2,1,1,1,2,2,1,2,1,2,2,1,2`；16 格明确且所有 16 条线索满足。

三图均为原生 SVG，使用 `viewBox="0 0 640 420"` 和 `preserveAspectRatio="xMidYMid meet"`；
不使用生成式图片表现规则状态。首次打开自动出现，支持跳过、完整浏览和 `#tutorial-button`
重看；教程已读键单独版本化，不触碰进度或奖励。

## 存档、完成与激励

- 私有键前缀：`ten-realms-v3:games:celestial-mural:`；绝不读取、删除或枚举 V2 键，
  绝不调用 `localStorage.clear()`。
- 会话只存关卡 ID、稳定 `runId`、操作历史与耗时；恢复时从空盘重放历史，不信任保存的
  棋盘、完成或奖励字段。
- 完成 ID / 事件 ID：`celestial-mural:<runId>:complete`。本地先写经重放验证的
  profile 和 outbox，再调用 `window.TenRealmsV3.complete`；失败会保留同一 payload 重试。
- `normalizeCompletion`、`normalizeProfile`、outbox 载入和 settled-event 恢复都会重放历史，
  因此伪造“已通关”或篡改格子不能结算。
- 奖励 claim 分为：每关首次显影、个人最少落笔纪录、`moves <= par` 的无返工全显影。
  claim ID 与完成事件均稳定去重，同一局刷新或重复投递不会重复给分。

## 验收基线

- 支持 320×720、390×844、1280×720；棋盘窄屏使用零/低间距 44px 触控格，不要求横向滚动。
- 深色、浅色、未定、当前选中和不可能线索均不只靠颜色：还使用纹理、边框、文字和形状。
- `tests.mjs` 覆盖 3×3 自身计数、三态循环、非法 no-op、未完成/完成边界、固定题面、
  存档重放、结算/outbox 幂等、三张 SVG 的状态标记与 XML 语法。
