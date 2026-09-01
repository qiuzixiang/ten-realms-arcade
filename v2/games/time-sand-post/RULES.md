# 时砂邮路局（Time Sand Post）规则契约

## 身份、版本与来源

- 合集批次：十境谜游馆 `v2.5`
- 游戏 slug：`time-sand-post`
- 主题名：时砂邮路局
- 规则原型：Signpost，又名 Pfeilpfad（箭头路径）
- 来源仓库：`https://github.com/ebnbin/puzzles`
- 固定来源提交：`5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`

本契约使用以下固定版本真源：

- `doc-zh/signpost.html`：中文规则、操作与谜题源流；本地审核路径为 `/tmp/ebnbin-puzzles-v25.D1KetP/source/doc-zh/signpost.html`。
- `vendor/sgtpuzzles/signpost.c`：Simon Tatham’s Portable Puzzle Collection 中的上游规则、生成、求解与交互实现；本地审核路径为 `/tmp/ebnbin-puzzles-v25.D1KetP/source/vendor/sgtpuzzles/signpost.c`。
- `src/games/signpost.ts`：ebnbin/puzzles 的 Web 集成实现；本地审核路径为 `/tmp/ebnbin-puzzles-v25.D1KetP/source/src/games/signpost.ts`。
- `LICENCE` 与 `vendor/sgtpuzzles/LICENCE`：两层许可和归属真源。

ebnbin/puzzles 按 MIT License 发布，其 vendor 中的 Portable Puzzle Collection 也依自身 MIT License 发布。原谜题 Pfeilpfad 归功于 Janko，Signpost 由 James Harvey 贡献给 Simon Tatham’s Portable Puzzle Collection。该归属与 MIT 声明必须保留在页面及合集第三方声明中。

本游戏复用的是公开规则；题面数据、求解器、游戏逻辑、时砂邮局主题、界面、SVG 教程与持久化代码均在本项目中独立重新实现，没有复制上游视觉资产。

## 规则真值

### 棋盘、坐标与实体

- 棋盘是 `width × height` 的矩形方格网格，索引按从左到右、从上到下排列：`index = y * width + x`。
- 每格是序列中的一个顶点。除最终数 `N = width * height` 所在格外，每格都有一个固定方向。
- 方向集合严格为八向：`N, NE, E, SE, S, SW, W, NW`，向量分别为 `(0,-1), (1,-1), (1,0), (1,1), (0,1), (-1,1), (-1,0), (-1,-1)`。
- 题面会显示固定数字（“时间戳”）。`1` 和 `N` 必须显示，可以再显示若干中间数字。固定数字的格位不可更改。
- 局面使用两个等长数组 `next[]` 与 `previous[]`表示邮路。`-1` 表示该端点尚未连接。

### 主操作与精确状态转移

1. 玩家先选一个非终点格 `from`，再选后继格 `to`。两次点按是对上游“从前驱拖到后继”的触摸屏控制转译，不改变边的含义。
2. `to` 必须在 `from` 的箭头所指严格射线上。可跨越任意多格，但向量方向和对角斜率必须完全一致。
3. 上游 `isvalidmove` 先调用 `ispointing`：任何当前 raw number 已是 `N` 的格（包括错误态中临时推导出的非固定格）都不再指向目标；随后才检查固定最终时间戳 `N` 不能作为 `from`、固定时间戳 `1` 不能作为 `to`。格子也不能连接自身。
4. 每格最多只有一个后继和一个前驱。上游会先在当前局面验证 `from` 与 `to` 不属于同一条短链；验证通过后，新连接才会释放 `from` 的旧后继端、以及 `to` 的旧前驱端，再建立 `from → to`。
5. 同一条已连通短链中的任意两格都不得直接重接；即使释放占用端点后看似不会成环，上游仍在释放前按同一连通域原子拒绝。
6. 若两个端点当前都是真实数 `1…N`，只有 `to = from + 1` 才能相连。上游的普通玩家输入不启用求解器式 `clever` 预判，因此连接到空格或代数端点后可以形成负数、`0`、重复数、错向数，或包含互相矛盾固定数的合法错误局面；这些不是非法点击。
7. 任一检查失败时，整个操作是原子 no-op：局面、历史和操作数都不改变。
8. 上游 `C` 操作只移除所选格的入边和出边；本作对应“拆所选格”及 Delete/Backspace。上游 `X` 在真实数或 `0` 上与 `C` 相同，在代数编号上会按 raw set 一次拆掉同组全部格；本作对应“拆代数链”、Shift+Delete 与右键。所选格没有入边也没有出边时，`C/X` 必须先成为 no-op，即使单轮自动补线刚留下 stale 代数 raw number，也不能误拆同组其他边或计步。
9. 每次成功的 `L / C / X` 先执行 `update_numbers`，重建本轮 raw numbers 与 DSF；随后只运行一轮 `check_completion(true)`，可自动补上当前可见的 `n → n+1`。自动补线不会在同一轮再次重算 numbers 或 DSF，这个 pre-auto 快照会保留到下一次玩家操作。
10. 每次成功建线或拆线记一步。由于上一轮自动边尚未进入 DSF，同一自动边在下一步可能再次被 `L` 接受并计步，即使最终边集合不变。撤销恢复完整 position 与对应日志；选中、高亮、教程进度与无效尝试不计步。

### 正常态、代数态与错误态

- 每条已建边的出发方向始终满足题面箭头。
- 同一格不可同时有两个前驱或两个后继。
- 未锚定短链使用 `set * (N+1) + offset` 的 raw number；界面显示为 `a, a+1, …, b…`。`C` 与 `X` 必须依据 raw set，而不是依据主题文本重新猜分组。
- 锚定链会从固定时间戳向前后推导真实数；推导值可以小于 `1`、为 `0`、重复或错向。`check_completion` 会按固定源码标记对应错误格，且负数/连线 `0` 的扫描刻意从 cell index `1` 开始，保留上游 index `0` 边界。
- `impossible` 是上游 sticky 诊断：一旦更新数字时发现固定数矛盾或环便保持为真。它单独暴露，不等同于 `FLAG_ERROR`，也不直接参与完成判定。
- 手动 `L` 不能在当前 DSF 内造环；但单轮自动补线读取的是 pre-auto numbers/DSF，确实可能形成一个上游可达的错误小环。此类 position 仍可存档、撤销，并用 `C/X` 拆开，不能当作结构异常抛弃。position 反序列化只验证结构，不凭 post-auto 拓扑反推 `impossible`；session 的完整 timeline 重放与全 position 对比才负责证明可达性。

### 完成条件

完成真值直接复刻 `check_completion`，而不是另写“边数等于多少”的近似规则：

1. raw real numbers `1…N` 不得重复；
2. `numsi[1]…numsi[N]` 必须全部存在；
3. 每个 `n` 所在格必须严格指向 `n+1` 所在格；通过时本轮会自动建立该边；
4. 不得存在源码扫描范围内的负数，或仍带边的 `0`；
5. 上述错误检查全部通过。sticky `impossible` 本身不阻止完成。

在六个正式题面里，这会得到从固定 `1` 到固定 `N`、恰好访问每格一次的 Hamilton 路径和 `N-1` 条边；但 `N-1` 是结果，不是替代上游检查的独立胜利条件。“没有冲突”、只有代数编号或局部数字连续都不足以通关。

## 题面、难度与唯一性

正式题面共六个，每档两个：

| 难度 | 关卡 ID | 尺寸 | seed | 参考玩家操作数 `par` |
| --- | --- | ---: | ---: | ---: |
| 入门 | `chronicle-dawn` | 4 × 4 | 11021 | 8 |
| 入门 | `amber-relay` | 4 × 4 | 11037 | 8 |
| 进阶 | `moonlit-dispatch` | 5 × 5 | 22041 | 15 |
| 进阶 | `glass-hour-route` | 5 × 5 | 22069 | 16 |
| 秘境 | `eclipse-express` | 6 × 5 | 33073 | 17 |
| 秘境 | `last-bell-circuit` | 6 × 5 | 33107 | 16 |

难度改变真实棋盘规模、跨格分支和固定时间戳约束，不是只改名称。六条 `referenceTimeline` 均由玩家同源 `L` 操作逐步重放，每步有效，最后一轮才完成；长度为 `N - givens.length`。独立固定-C 推导证明这是显式合链操作的严格下界，其余连续数字边由初始或动作后的单轮自动检查补上。因此 `par` 不是 `N-1`，页面仍用“建议/参考”表述，不把含任意返工过程混写成另一套计分规则。

`solveLevel(level, limit=2)` 只读取箭头与固定数字，不读取或保存作者答案。它从数字 `1` 出发搜索满足方向与固定数字的 Hamilton 路径，并搜索到第二解或穷尽搜索树。六个题面都必须同时满足 `count === 1` 且 `truncated === false`，才能在页面中被描述为已验证唯一解。

## 主题语义映射

| 规则概念 | 世界元素 | 视觉区分 | 玩家动作 | 反馈 | 不得改变的含义 |
| --- | --- | --- | --- | --- | --- |
| 方格顶点 | 浮空驿站 | 独立驿站轮廓 | 点选 | 金色选中轮廓 | 每格在序列中恰好出现一次 |
| 固定数字 | 时间戳 | 金色实心圆戳 | 用作推理锚点 | 链接后自动定序 | 数字与所在格不可更改 |
| 八向箭头 | 时流箭头 | 青色明确方向字形 | 选择后继 | 只高亮当前真正合法目标 | 只允许严格同射线连接 |
| `next / previous` 边 | 时序邮路 | 紫色发光线与金色落点 | 两次点按连线 | 端点重接时旧线即时释放 | 每格最多一进一出 |
| 完整 Hamilton 路径 | 从首邮到终钟的急件 | 全部邮路转为青色 | 完成最后一段 | 终钟签收弹层 | 必须从 1 恰好访问全格并到达 N |

玩家身份是“时序分拣员”，核心动词是“校准与接通”。主材质为深紫沙漏玻璃、金色邮戳与青色时流；完成奇观是所有短链合为一条跨时邮路。选中、可连、已连和完成同时使用轮廓、线型、节点和文字，不只依靠近似颜色。

## 教程真值

三张 SVG 固定使用首关 `chronicle-dawn`、seed `11021`：

1. `tutorial-elements.svg`：由引擎的真实初始局面生成；开局检查已自动建立 `4→5` 与 `15→16` 两条边。
2. `tutorial-action.svg`：对同一局面调用玩家同源的 `applyLink(level, initial, 8, 12)`，得到真实合法的 `1→2`；连同两条初始自动边，画面共 3 条边、1 次玩家操作。
3. `tutorial-goal.svg`：使用求解器得到唯一路径 `8,12,0,4,14,15,13,1,5,9,10,11,6,3,2,7`，并由八步 reference timeline 复算为 8 次玩家操作、7 条自动边、共 15 条完成边，再交由 `evaluatePosition` 判定通过。

每张图都携带关卡、seed、方向、固定数字和局面摘要 `data-*` 标记。测试会从规则引擎重算并核对十六格、操作边与全部通关边。SVG 使用 `viewBox="0 0 800 520"` 与 `preserveAspectRatio="xMidYMid meet"`；桌面完整显示全幅，窄屏只裁去右侧与 HTML 正文重复的微型注释，绝不裁掉真实棋盘、箭头、时间戳、连线或状态摘要。

三图标记 `data-tutorial-version="2"`，URL 使用 `?tutorial=2` 缓存版本。首次进入或旧 `seen-v1` 标记存在时仍会自动打开，可跳过、完整看完或稍后从页头与纪念册重看；完成或跳过只写 `seen-v2`。`?tutorial=1` 是强制打开入口参数，不是素材版本。教程升级不会清理进度、设置、纪录或奖励。

## 激励、存档与完成事件

### 本地激励

- 每关首次送达解锁一枚本机邮戳。
- 每关记录通关次数与个人最佳操作数。
- 每关以上表 `par` 作为固定-C 可重放参考线；自动补线不计玩家操作，拆线与返工照常计步。
- 合集共享成长引擎可按难度首通、达到参考线、刷新个人最佳和日活跃规则颁发 XP；共享引擎也必须按稳定 event ID 去重。

### 私有存档合同

- 命名空间前缀：`ten-realms-v2:games:time-sand-post:`
- 键：`session:v1` / `settings:v1` / `tutorial:v1` / `records:v1` / `outbox:v1`
- session schema 仍为 `v1`；其中每个 position 使用 schema `v2`，同时保存 `next/previous` 可还原的 links、上游 raw `numbers`、pre-auto `numsi`（字段 `numberCells`）、DSF `regions` 与 sticky `impossible`。只存 links 会丢失下一步合法性；auto 还可能替换端点、释放出带 stale raw number 的孤格或造出环，因此 `numbers/numsi/impossible` 都不能从 post-auto 拓扑反猜，也不能在 decode 时擅自再跑一轮 auto。
- 会话还保存严格白名单的 `link / clear / clear-chain` timeline、最多 80 个完整 position v2 撤销快照、操作数、用时、键盘焦点、选中起点与完成标记。
- 完成后仍允许撤销最后一步：胜利层关闭，当前 session 回到未完成且计时从完成时刻继续；已经写入的本地 records、outbox 与共享奖励不回滚。同一 run 补回最后一步仍使用同一 `eventId` 与最初 `completedAt`，因此不会重复增加胜场、经验或徽章。
- 恢复时从正式关卡开局逐个重放 timeline，并将 current position 与每个 history 前缀的完整序列化结果逐项比对；不信任存档中的答案、DSF、完成布尔值或仅凭 links 推断的状态。任一字段损坏时只放弃本游戏对应 session 并创建新 run。
- 禁止 `localStorage.clear()`，不枚举删除其他游戏或其他版本的键。

### 完成与 outbox 合同

- run ID 例：`time-sand-post-<time>-<entropy>`
- 稳定完成 event ID：`time-sand-post:<runId>:complete`
- schema：`ten-realms-v2.game-complete`，schema version `1`
- payload 字段：`gameId / realm / runId / eventId / levelId / difficulty / tier / seed / moves / par / elapsedMs / timeline / edges / completedAt`
- 顺序严格为：按 timeline 重新判定完成 → 持久化本地完成标记、记录及私有 outbox → 优先尝试 `TenRealmsV2.complete(payload)`，再尝试 `RealmArcade.complete(payload)`，不可确认时只保留兼容提示队列 → 宿主 API 成功后移除 outbox。
- 本地 records 使用 `settledEvents[eventId]` 去重；同一 run 刷新、同页重试、队列与全局 API 并存都不得重复增加胜场。重开同一关会生成新 run，允许再次记录通关，但“首次通关”仍只颁发一次。
- 页面启动和 `realm:ready` 时均重试 outbox。DOM `CustomEvent` 只是观察镜像，不是第二套奖励通道。

## 交互与可访问性验收

- 触摸主路径是两次点按，核心单元与所有主要控件至少 `44 × 44 CSS px`。
- 方向键在棋盘中移动，Enter/Space 选择或提交，Delete/Backspace 执行 `C`，Shift+Delete 或右键执行 `X`，Esc 取消选中。
- 当前焦点、固定/推定数字、箭头方向、前驱/后继和可连状态都有文本可读名称。
- 规则、教程与胜利 dialog 不重叠，关闭后恢复触发焦点；弹层打开时锁定背景滚动，内容自身可滚动。
- 教程图不拉伸、不重叠操作前后状态；桌面展示完整 `800×520` 画面，窄屏用保持原比例的左侧视窗放大真实棋盘，右侧微型注释由卡片下方同义正文承接，避免缩到不可读。减少动态设置下停止漂浮、脉冲与长过渡，但保留最终状态变化。
- 基线视口为 `320×720`、`390×844` 与 `1280×720`。在 320px 宽的 6 列难题中，棋盘保留 `6×44 + 5×3 = 279px` 的最小格子与间距宽度，不依赖页面横向滚动或用户缩放。

## 专属验收

```bash
node v2/games/time-sand-post/tests.mjs
```

专属测试必须覆盖六关精确初始自动边与逐步参考边数、唯一性、八向向量、pre-auto DSF、合法错误态、代数组、`C/X`、stale 代数孤格 no-op、自动形成的小环、sticky impossible、可变推定 `N` 的 `ispointing` 拒绝、最后一步胜利、position v2 可达随机游走 round-trip、刷新恢复后撤销、records/outbox 幂等、三张 SVG 教程复算、页面合同与窄屏 CSS。进入合集注册前还必须通过全仓验证、产品构建、320/390/1280 真实页面走查与独立只读终检。
