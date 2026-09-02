# 万象共振钟房（Resonance Bell Room）规则契约

## 身份、批次与来源

- 游戏名：万象共振钟房
- slug：`resonance-bell-room`
- 批次：Ten Realms Arcade V3.0
- 规则原型：Simon Tatham's Portable Puzzle Collection 的 **Flip**，随机影响矩阵模式
- 权威规则：[`public/doc/zh/flip.html`](https://github.com/ebnbin/puzzles/blob/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/public/doc/zh/flip.html)
- 参考实现：[`vendor/sgtpuzzles/flip.c`](https://github.com/ebnbin/puzzles/blob/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/vendor/sgtpuzzles/flip.c)
- 固定来源提交：`5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`
- 许可证：Simon Tatham's Portable Puzzle Collection 使用 MIT 许可证；上游 Web 前端也使用 MIT 许可证。

本目录不复制上游 C、Wasm、前端代码或视觉素材。规则引擎、题面、主题、SVG 教程和界面均为本项目重新实现；保留 Flip 的二值翻转、每格独立影响模板与全亮胜利条件。

> Portable Puzzle Collection copyright (c) 2004-2024 Simon Tatham and contributors. Permission is granted under the MIT License to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies, provided the copyright and permission notice are included. The software is provided “AS IS”, without warranty.

## 冻结的规则真值

### 状态模型

- 棋盘是 `width × height` 的矩形方格，按行优先编号，内部索引从 `0` 开始。
- 每格状态恰为 `0 = 熄灭` 或 `1 = 点亮`。不存在未知、候选、锁定、错误或装饰状态参与胜负。
- 每个输入格 `i` 有一份独立且不可变的影响模板 `templates[i]`。模板是输出格索引的非空集合，必须包含 `i` 自身；同题中没有两份完全相同的模板。
- 一局还记录按顺序发生的合法敲击 `history`。`pressParity[i]` 只是其奇偶摘要，不能替代历史计步。

### 唯一主操作

敲击任意合法格 `i`：

1. 对 `templates[i]` 中每个输出格执行 `light ^= 1`；
2. `pressParity[i] ^= 1`；
3. 把 `i` 原子追加到历史，移动数增加 1。

模板外的格严格不变。越界或非整数索引是原子 no-op，不改变灯光、历史或移动数。对同一格敲两次会完全抵消灯光与奇偶摘要，但仍是两次真实操作。由于 GF(2) 加法可交换，合法敲击的顺序不影响最终灯光。

### 撤回、重置与完成

- 撤回取出历史最后一格，并再次施加同一模板，从而恢复上一状态；空历史撤回是 no-op。
- 重置回到该关固定初始灯光，历史和移动数归零。已结算终局重置时使用新的 run ID。
- **只有每一格都等于 `1` 时才完成。** 无冲突但仍有任一暗格只是未完成，不能提前结算。
- 提示、选中、动画、声音、教程进度、奖励或存档字段都不参与完成判定。

## GF(2) 求解与建议最少敲击

对当前灯光 `s` 建立 `A·x = 1 ⊕ s`：矩阵第 `i` 列直接来自第 `i` 枚钟的真实影响模板。`logic.mjs` 的求解器只读取矩阵与当前灯光，不读取生成题面时的作者敲击或内置答案。

求解器执行 GF(2) 高斯消元，得到一个特解和零空间基。固定六关的零空间维度均不超过 2，因此会枚举全部仿射解并以 Hamming weight 选出真正最少的敲击集合；字典序只用于并列时稳定选一组。多解完全合法。

只有 `minimumProven === true` 时界面才显示“建议最少”。如果未来题面的零空间维度超过精确枚举上限，求解器仍可返回一组解，但不得声称它最少。本批次六关全部通过精确证明：

| 难度 | 关卡 ID | 规模 | 建议最少 | 奇偶解数量 |
| --- | --- | ---: | ---: | ---: |
| 入门 | `first-awakening` | 3×3 | 4 | 2 |
| 入门 | `jade-echo` | 3×3 | 5 | 2 |
| 进阶 | `moonlit-canon` | 4×4 | 7 | 1 |
| 进阶 | `amber-procession` | 4×4 | 6 | 4 |
| 大师 | `aurora-orchestra` | 5×5 | 11 | 1 |
| 大师 | `cosmic-carillon` | 5×5 | 13 | 2 |

难度不只改标题：棋盘依次扩大为 9、16、25 格，每格影响纹的最小规模也从 3 增加到 4、5/6，真实最少敲击整体上升。

## 主题映射

| Flip 规则概念 | 钟房世界元素 | 视觉与操作反馈 | 不得改变的含义 |
| --- | --- | --- | --- |
| 方格 | 独立编钟 | 钟形实体、稳定编号 | 仍是一格二值状态 |
| 明 / 暗 | 金色齐鸣 / 沉睡金属 | 发光、材质、轮廓三重区分 | 只对应 `1 / 0` |
| 每格影响集合 | 九/十六/廿五点影响纹 | 每枚钟内嵌独立微缩点阵，侧栏放大 | 模板始终不可变 |
| 点击翻转 | 敲钟引发共振 | 真实受影响钟短促摆动并同步换态 | 模板内全部 XOR 一次 |
| 全亮胜利 | 万钟齐鸣、穹顶开启 | 全阵光晕与结算卡 | 任一暗钟都不能通关 |

## 固定教程真值链

- 关卡：`first-awakening`
- 初始灯光：`110010000`
- 元素卡：由该初始状态直接绘制，九份 `data-template` 与真实关卡逐枚一致。
- 操作卡：调用玩家同一操作，合法敲击内部索引 `4`（界面第 5 枚钟）；真实影响集合 `1,2,3,4,5`，得到 `101101000`，移动数为 1。
- 通关卡：独立求解器选出一组最少解 `1,2,4,7`（界面第 2、3、5、8 枚），经同一 `pressCell` 回放后得到 `111111111`，`evaluateState.complete === true`。
- 首关共有 2 组奇偶解；教程只称上述回放为“一组最少解”，不称唯一解。
- 三张 SVG 根元素包含关卡、教程版本、状态 bit string、动作/解和求解摘要元数据；裁切与编号对比度复核后的入口统一使用 `?tutorial=2`。

## 私有存档、奖励与完成协议

- 前缀：`ten-realms-v3:games:resonance-bell-room:`
- 键：`profile:v1`、`session:v1`、`tutorial:v1`、`completion-outbox:v1`
- 教程已读值：`seen-v2`。升级教程只换教程版本，不清除会话、纪录或奖励。
- 会话只持久化关卡 ID、run ID、真实敲击历史和耗时。恢复时从官方关卡初始状态重放历史并重新判断完成；不会信任存档中的灯光、答案或 `completed` 标志。
- 损坏 JSON、越界历史、未知关卡或非法 ID 只删除对应的本游戏私有键；禁止 `localStorage.clear()`，也不枚举删除别的游戏键。
- completion ID：`resonance-bell-room:{levelId}:run:{runId}`。私有 settlement 与完成 payload 都固化真实敲击 `history`；恢复或外发前从官方题面重放，要求终局全亮、步数与历史长度一致，并核对 outbox 与 settlement 是同一条路径。
- 奖励：每关首次齐鸣、刷新个人最佳、达到已证明的最少敲击。奖励 ID 由游戏、关卡、条件和必要成绩组成，reward ledger 与 settled run 去重。
- 结算先写私有 outbox 和 profile，再调用 `window.RealmArcade.complete(payload)`；适配器缺失或抛错时保留同一 completion ID 待下次重试。共享宿主仍必须按 completion ID 去重。

## 入口与验收

- 游戏入口：`v3/games/resonance-bell-room/`
- 返回入口：`../../`
- 原生教程按钮：`#tutorial-button`
- 专属测试：`node v3/games/resonance-bell-room/tests.mjs`
- 支持键盘方向键、Space / Enter、U 撤回、R 重置；触控目标不小于 44×44 CSS px。
- 最窄目标为 320×720；核心棋盘不依赖整页横向滚动。教程图 `object-fit: contain`，模态内部滚动并锁定背景。
- `prefers-reduced-motion: reduce` 下去除钟摆和长转场，但保留最终明暗、选中轮廓与完成反馈。

## 已知边界

- 浏览器本地数据不是安全账户系统，用户可手工修改自己的 localStorage；实现通过严格结构、官方题面重放和完成重算防止普通损坏或伪造会话直接触发通关，但不声称具备防篡改或服务器反作弊能力。
- 题面允许多解；解数量是 GF(2) 奇偶向量数量，不代表不同敲击顺序的排列数。
