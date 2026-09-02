# 极光磁场实验室：规则不变量与集成契约

本游戏以 Magnets 为规则原型，规则引擎位于 `logic.mjs`，不依赖 DOM、存储、音频或计时器。六个题面由稳定 seed、固定槽位布局、合法答案和显式线索掩码复现；测试使用不读取内置答案的完整回溯求解器证明每题恰好一解。

## 必须始终成立的规则

1. 题盘为矩形；每个可操作格恰好属于一个正交相邻双格槽位，槽位不重叠、不遗漏，横竖方向在游玩中不可改变。
2. 偶数格题盘没有单格空位；奇数格题盘恰有一个 `*` 固定中性空位。它不属于槽位、不可操作，也不计正负极。
3. 每个槽位的完成状态只有 `+−`、`−+`、明确中性三种；未填是第四种过程状态，不能与“明确中性”混为一谈。
4. 磁铁槽位始终恰有一个正极和一个负极；中性槽位两端均中性，对正负计数各贡献 0。
5. 顶部线索统计每列正极，底部统计每列负极，左侧统计每行正极，右侧统计每行负极。
6. 数字线索（包括 `0`）必须精确满足；`null` / 破折号是缺失线索，完全不施加约束。只有同一行或列的正、负线索都存在时，才可由长度派生中性数量；引擎不会从缺失线索偷偷派生约束。
7. 两个正极不得正交相邻，两个负极也不得正交相邻；对角同极合法、异性正交相邻合法、中性与任何格相邻合法。
8. 两个问号表示“不可能中性”的候选笔记。它不填槽、不计极性、不制造或消除冲突，也不改变求解与胜利。
9. 手动标灰线索只是视觉笔记；不论标灰与否，给定线索仍参与同一套判定。
10. 错误态包括给定线索超量或同性正交接触；无错误但线索不足或有槽位未填仍是未完成，绝不能提前胜利。
11. 胜利必须同时满足：所有槽位已明确赋值、所有已给正负线索精确满足、同性正交冲突为零。
12. 主操作以被点端为基准循环 `+ → − → 未填`，另一端同步相反；中性循环为 `未填 → 中性 → 两问号 → 未填`。中性上主操作、磁铁上中性循环均拒绝，保持原作输入语义。

## 题面与唯一性

- 校准：两道 4×4，全线索。
- 巡测：两道 5×4，每题 12 条给定线索。
- 磁暴：一道 5×6、一道含固定空位的 5×5，每题 8 条给定线索。
- `levels.mjs` 的 `seed`、`layout` 与 `clueMask` 共同构成可复现题面。
- `solvePuzzle(puzzle, { limit: 2 })` 在找到第二解时可提前停止；只有返回 `count === 1 && truncated === false && unique === true` 才能声明唯一。

## 独立存档

本游戏只允许访问以下前缀：

```text
ten-realms-v2:games:aurora-magnet-lab:
```

子键为 `session:v1`、`profile:v1`、`preferences:v1`、`tutorial:v1`。结构、版本、题目 ID、槽位状态、候选、历史、计数与完成状态都会在恢复时重新校验；损坏数据只清理本游戏自己的键并回退新局。

## 完成事件与奖励去重

只在一次“未完成 → 完成”转换首次结算时发送：

```text
ten-realms-v2:game-complete
```

页面同时公开 `window.AuroraMagnetLab`，并兼容 `window.RealmArcade?.complete(payload)` / `window.__realmCompletionQueue`。兼容 payload 至少包含 `levelId`、数值 `tier`（校准/巡测/磁暴映射为 1/2/3）、`difficulty`、`moves`、`par`。

本地奖励使用稳定 ID：首次完成、光谱、逐题零冲突、逐题稀有磁暴、逐成绩个人最佳。`rewardLedger` 先去重并保存，再发布完成事件；未来 v2 全局 XP 应只按 `rewards[].id` 映射，不应直接信任事件次数。

每次完成还会写入稳定的本地结算 ID。若宿主回调抛错，载荷会退回到 `window.__realmCompletionQueue`；只有宿主接收或入队成功后才标记已上报。若两条兼容通道都暂时不可用，本地胜利界面仍正常显示，刷新后使用同一事件 ID 重试，且不会重复增加通关数或奖励。

## 上游来源与许可

- [Magnets 中文规则](https://github.com/ebnbin/puzzles/blob/main/doc-zh/magnets.html)
- [ebnbin/puzzles Magnets Web 包装](https://github.com/ebnbin/puzzles/blob/main/src/games/magnets.ts)
- [Simon Tatham 上游 magnets.c](https://github.com/ebnbin/puzzles/blob/main/vendor/sgtpuzzles/magnets.c)
- [Simon Tatham’s Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/)

谜题创意归功于 Janko；James Harvey 将 Magnets 贡献给 Simon Tatham 合集。上游代码依 MIT License 发布。

## 验证

```bash
node v2/games/aurora-magnet-lab/tests.mjs
npm test
npm run build
git diff --check
```

根构建脚本会把 `v2/` 作为独立 2.0 scope 复制、生成专属预缓存清单，并检查其不包含 1.0 游戏私有资源。
