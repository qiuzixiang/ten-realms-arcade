# 妖怪旅店

独立的 Dominosa 规则小游戏，位于 `/v2/games/yokai-inn/`，不依赖根站点或 `shared/` 运行时代码。

## 规则不变量

- 阶数 `N` 使用 `(N + 2) × (N + 1)` 棋盘。
- 每格恰好属于一个正交相邻配对。
- `0 ≤ a ≤ b ≤ N` 的每一种无序数对必须恰好出现一次。
- 排除线只作笔记；确定新客房会原子拆除端点旧房并清掉两端排除线。
- 唯一题由 exact-cover 搜索至第二解证明；开放题只承诺可解，不宣称多解。

## 集成合同

- 存档前缀：`ten-realms-v2:games:yokai-inn:`
- 事件：`ten-realms-v2:game-ready`、`ten-realms-v2:game-complete`、`ten-realms-v2:reward-earned`
- 公共 API：`window.YokaiInn`
- 兼容完成载荷包含 `levelId`、`tier`、`moves`、`par`，并使用每局持久化 `attemptId` 生成稳定 `completionId`。
- 未确认完成先写入本地 outbox；刷新会重试，同题重开则保留为不同 run。奖励消费者应按 `rewardIds` 去重。

## 验证

```sh
node v2/games/yokai-inn/tests.mjs
npm test
npm run build
```

根构建脚本目前尚未复制 `v2/`；统一 `/v2/` 入口接入时需同步更新 `scripts/build.mjs`。根 `npm test` 会做语法与本地引用检查，但专属行为测试需单独运行上面的第一条命令。
