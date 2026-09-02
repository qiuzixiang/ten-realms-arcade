# 四季染坊 · Season Dyehouse

`season-dyehouse` 是「十境谜游馆 2.0」的独立 Flood 规则游戏。所有游戏代码、样式、教程图、测试、存档和奖励桥都在本目录内，不读写 1.0 成长档案。

## 本地运行与测试

在仓库根目录运行：

```bash
npm run serve
node v2/games/season-dyehouse/tests.mjs
```

打开 <http://localhost:4173/v2/games/season-dyehouse/> 。页面没有远程运行时依赖。

## 规则与参考线

引擎保留 Simon Tatham Portable Puzzle Collection 的 Flood 不变量：固定左上起点、正交连通块换色、任意非当前色合法计步、同色严格无效、步限内合幅获胜，以及超限后可继续练习但不再获胜。七组参数与上游预设一致。

步限是深度 3 的上游启发式求解器路线长度加宽限；界面只称「求解器参考」，不声称最优或唯一解。

- [ebnbin/puzzles Flood 中文规则](https://puzzles.ebnbin.dev/doc/zh/flood.html)
- [ebnbin/puzzles `src/games/flood.ts`](https://github.com/ebnbin/puzzles/blob/main/src/games/flood.ts)
- [Simon Tatham `flood.c`](https://github.com/ebnbin/puzzles/blob/main/vendor/sgtpuzzles/flood.c)
- [上游 MIT 许可](https://github.com/ebnbin/puzzles/blob/main/vendor/sgtpuzzles/LICENCE)

## 私有存档

仅使用以下前缀：

```text
ten-realms-v2:season-dyehouse:
```

存档仅信任游戏/生成器版本、参数、uint32 种子、本局 `attemptId` 与合法操作日志；恢复时会重新生成布面并逐手重放。损坏数据仅移除本游戏 session，不枚举、不清空其他键。为避免写出无法安全重放的无界日志，单局练习记录最多 512 步；达到后会明示提示撤销或重开。

## 2.0 完成契约

每次新开局都有独立、持久化的 `attemptId`：同一局刷新或重试保持稳定 `completionId` 并严格幂等，后续重开的同题改进局则可再次上报。`rewardClaims[].id` 仍按谜题与成就去重。传递顺序是：

1. `window.TenRealmsV2.complete(payload)`（兼容 V2 主桥）；
2. `window.RealmArcade.complete(payload)`（现有兼容桥）；
3. 两者不可用或调用抛错时，按 `completionId` 去重写入 `window.__realmCompletionQueue`，并派发 `ten-realms-v2:game-complete`。这两者只是供迟到宿主消费的内存提示，不代表已确认送达。

本地奖励会先以 pending 台账留存，再尝试共享上报；只有主桥或兼容桥 API 调用真正成功才会移除 pending 并写入确认台账。启动、宿主 ready、换题、重开、撤销与新通关都会按顺序重试未送达项。因此桥接暂时不可用时不会重复累计本地胜场，也不会在换题后丢失首通 claim。

`payload` 还固化完整 `timeline`。从存储恢复 pending 时，引擎会重新生成题面、逐手重放，并核对获胜状态、题面 ID、规格、种子、步数、步限、参考步、无空染与连续扩张指标；缺少真实通关证明的伪造记录不会上报。页面还在 `window.TenRealmsV2Games["season-dyehouse"]` 暴露只读快照、本地记录、开题与重看教程 API，并派发 `ten-realms-v2:game-ready`。

V2.0 根构建会将本目录与教程资产纳入独立的 `/v2/` 预缓存清单，不进入 1.0 的私有资源范围。
