# 云野露营：存档与结算接口

实现文件：`src/storage.mjs`。纯 ES2017、无运行时依赖；通过 `createStorage` 注入规则引擎，持久化模块不实现第二套胜负规则。

```js
const store = createStorage({
  levels: LEVELS,
  createBoard,
  applyAction, // (level, board, index, value) => {accepted, board, reason}
  isSolved,    // (level, board) => boolean
  resolveLevel(levelId, meta) { /* 根据 mode/seed/day 重建每日或种子题 */ },
  onComplete(payload) { /* 可选宿主；Promise 支持，false/throw 表示稍后重试 */ }
});
```

- `begin(levelId, {mode:'story'|'daily'|'seed', seed?, day?})` 开新局，返回 run。主线从 `levels` 查询；复玩必须由 `resolveLevel(id, meta)` 重建且返回同一 ID。
- `resume()` / `getRun()` 返回当前 run 或 null。run 含 `runId, levelId, mode, seed, day, board, moves, hints, undoCount, canUndo, completed, completionId, startedAt`；`completed` 由实际重放后的引擎判定，即使还没有调用结算也是真实终局状态。
- `act(index,value)` 返回 `{accepted,run,reason}`；未知/帐篷/标空分别是 0/1/2，无效输入不记步、不落盘。
- `undo()` 返回 run，可连续撤销到初始状态；`restart()` 新 runId 重开当前题，历史成长保留；`hint()` 每点击一次计一次提示，不扣奖励。
- `complete()` 返回 `{ok,alreadyCompleted,payload,profile}`。未解题 ok=false；同局再次结算返回同一 payload，重复重开同题可记录一次新胜场，但首次奖励只发一次。
- `profile()` 返回 `{completedLevelIds,dailyDates,collections,totalWins,totalRewards,rewardClaims}`。`collections` 为已经完成该章全部主线的章节号数组；首次主线、每日首胜、章节收藏各计一个 claim。种子胜场有完成记录，无额外刷分奖励。没有连签惩罚，提示不会减少成长。
- `tutorialSeen(version)` / `markTutorialSeen(version)` 使用独立教程版本键，不触碰游戏进度；跳过也可以记已读。
- `getStatus()` 返回 `{persistenceAvailable,recoveryMessage,pendingCompletions}`。保存不可用时 UI 应显示“本次可继续游玩，关闭后可能无法保留”。恢复消息仅针对确实存在的损坏数据。
- `await flushOutbox(optionalHost)` 重试未确认事件；返回 `{sent,pending}`。无宿主时保持 pending，完成体验不受影响。宿主必须使用 completionId/rewardClaimId 去重。

## 数据边界

唯一游戏主键为 `mini-polish:cloud-camp-journey:v1:state`。教程键为 `mini-polish:cloud-camp-journey:v1:tutorial:<version>`。不调用 `localStorage.clear()`，不读写其他游戏或其他版本键。

主存档将当前操作日志、已完成操作证据与宿主确认列表一起原子写入一个键。每个事件包含 stable `runId`、由其派生的 `completionId`；reward claims 使用游戏、关卡/日期/章节和首次条件派生稳定 `rewardClaimId`。完成事件遵循批次约定：

```js
{schemaVersion:1,gameId,levelId,mode,runId,completionId,rewardClaims,metrics,completedAt}
```

不保存可被当作真值的 board、completed、XP、reward 总额或解锁 ID。恢复时从受信题库/确定性生成器建立初始棋盘，逐条重放合法操作，核验题面签名，重新调用 `isSolved`；已完成历史同样重放。当前局损坏操作只保留合法前缀；损坏完成证据不计成长。若题库定义变化而签名不一致，旧证据不能误用于新题。

先持久化完成证据（据此可重建 outbox），再调用可选宿主。无宿主、失败、拒绝和离线均不妨碍本地完成；存储不可用时保持内存会话并禁止发送尚未落盘的事件。并发 flush 共用一次投递。宿主收到事件后若本地确认落盘失败，刷新后可能重投同一 ID，宿主按 ID 幂等即可。

本地重放能拒绝伪造完成标志、奖励字段、非法动作、损坏题面，但不是服务器反作弊。用户若手动写入一套完整且合法的解题操作，也会构成规则有效的完成证据。系统时间也不是可信服务器时钟。此游戏采用本地、无对抗成长，因此不声明账号级防作弊。

## 验证

运行 `node --test tests/storage.test.mjs`。用隔离的最小规则夹具验证持久化边界：历史/撤销/提示、刷新终局、重复结算和新局去重、章节收藏、每日去重、伪造完成/奖励、损坏前缀及历史、题库版本变化、教程版本隔离、outbox 顺序/失败/并发重试、storage 禁用/配额恢复、返回值不可反向修改内部状态。

集成测试使用正式引擎逐关通过全部 60 个主线，验证 60 条首次奖励和 6 张章节收藏刷新重放后一致，并验证正式每日题、种子题带提示的操作恢复与结算。正式引擎的规则真值与全题库唯一性另由规则模块测试负责。
