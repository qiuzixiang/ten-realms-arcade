# 十境谜游馆 4.0：规则契约与来源

本批次保留 [Simon Tatham's Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/) 的规则真值；主题、美术、文案、交互、存档和奖励均为本项目的新实现。规则与参考实现冻结在上游 `ebnbin/puzzles` 的 `5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`，MIT 许可见仓库根目录 `LICENSE` 与 `v4/THIRD_PARTY_NOTICES.md`。

| 4.0 世界 | slug | 原型 | 不可改变的规则真值 | 教程固定动作 |
| --- | --- | --- | --- | --- |
| 时序货舱 | `time-cargo-bay` | Fifteen | 有一个空位；仅同一行/列、通向空位的货箱可滑动；数字顺序且空位右下才完成。 | 将同列货箱滑入空位 |
| 量子配方馆 | `quantum-apothecary` | Keen | 1..N 拉丁方；每一算术笼满足加、乘、减或除提示。 | 在一格填入合法元素值 |
| 月潮结界 | `lunar-tide-seal` | Loopy | 边三态：未定/选择/排除；选择边须成唯一闭环，线索等于周边选择边数。 | 选择一条结界边 |
| 轨道编队调度 | `orbital-formation` | Netslide | 连接端口的网络拓扑固定；每次将一整行或一整列循环滑移；全部模块连通完成。 | 循环推移一条航道 |
| 群岛边防署 | `archipelago-guard` | Palisade | 边界划出连通且同面积的区域；数字为该格相邻边界数（含外缘）。 | 在两格之间架起一道墙 |
| 影印净化室 | `shadow-print-lab` | Singles | 涂黑后行列无重复；黑格不得正交相邻；白格必须整体连通。 | 屏蔽一个重复印记 |
| 环轨星图台 | `orbit-atlas` | Sixteen | 无空位；整行/列可环绕循环位移；数字全部顺序排列完成。 | 推移一整条环轨 |
| 星图档案院 | `stellar-archive` | Solo | 固定数不可改；每行、列、宫均恰含 1..N；候选不参与胜利。 | 向空档填入数字 |
| 天平阶梯庭 | `balance-terrace` | Unequal | 1..N 拉丁方且所有大小关系提示成立。 | 填入满足相邻秩序的数字 |
| 昼夜织机 | `daynight-loom` | Unruly | 每行列黑/白数相同且不出现连续三个同色；固定经线不可改。 | 把空格切至昼/夜状态 |

## 共享运行契约

- 每款游戏拥有唯一 stable slug、`ten-realms-v4:` 存档前缀、教程版本与独立 run/event ID。
- 结算先写本地进度，再调用 `window.TenRealmsV4.complete`；同一 event ID 刷新或重投不重复发奖。
- 进入游戏首次自动展示三卡教程：真实起局元素、同引擎的一次合法操作、同引擎验证为完成的终局；可跳过、看完或从工具栏重看。
- 4.0 的导览、Service Worker、manifest、预缓存和进度不读取 V1/V2/V3 私有资源或存档。
- 每款的固定练习题只用于可复测的入门关；不把“固定题面”错误描述为上游生成器或唯一性证明。

## 主题映射与可访问性

每款需同时用颜色之外的形状、纹理、数字、边型或文字表明状态。触控主操作目标不小于 44 CSS px；网格不得需要页面横向滚动；教程 SVG 采用 `viewBox`、`preserveAspectRatio="xMidYMid meet"` 与完整的图例。
