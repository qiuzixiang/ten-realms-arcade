# 四灵山居规则契约

## 身份与来源

- 游戏：四灵山居；slug：`four-spirit-valley`；本地版本：1.0.0。
- 规则原型：Simon Tatham’s Portable Puzzle Collection 的 Map。固定参考 `ebnbin/puzzles@5a9e1795a3324e0f6433b79fbe31cbd9b12048a3` 的 `doc-zh/map.html`、`src/games/map.ts`、`vendor/sgtpuzzles/map.c`。上游按 MIT License 发布。
- 本项目独立重写规则、界面、题库、主题和矢量图；不包含上游实现或美术。详细来源与许可见 [LICENSE](LICENSE) 和 `src/license.txt`。

## 状态与动作

地图是矩形格上的连通区域标签。每个区域是一片山居；四种灵色编号为 0 水麟、1 火羽、2 月狐、3 森龟。布局保证每个区域正交连通。

仅正交格之间标签不同才形成相邻边。两区仅在角点相遇时不相邻。固定神龛区域由题面给定且不可更改。正式安置或清除是可撤销动作；候选印独立储存，仅空白非固定区域可记候选，不参与冲突、求解约束或胜利判定。非法或未改变状态的操作严格 no-op。

完成要求每一区域正式安置且所有相邻边两端灵色不同。无需用完四种灵色，也不要求每色数量相等。任何合法着色都能完成；运行时不按内置答案比对判输。

## 关卡与证明

60 道固定关卡分 6 章，每章 10 道。生成器的 seed 和版本固定；布局拓扑在旋转、镜像与颜色重命名下去重。每区独立连通。每题记录固定神龛数量、seed 和 `limit: 2` 的求解证明。专属测试使用不同于引擎的邻接重建与回溯搜索复核唯一性；找到第二解或超限都不算唯一。

难度标签依据区域数、线索比例与章节目标安排；“建议安置”不是最优操作数。每日小谷按 UTC 日期从固定 60 题轮换，60 天后重复，不承诺无限不重复。

## 持久化与奖励

所有键前缀为 `mini-polish:four-spirit-valley:v1:`；本游戏不清除其他键。着色动作时间线重放后与存档颜色、步数核对；候选印独立校验。伪造的已完成字段不作为证据。

完成事件先写入本地进度与 outbox，再尝试通知可选宿主。事件字段为 `schemaVersion`、`gameId`、`levelId`、`mode`、`runId`、`completionId`、`rewardClaims`、`metrics`、`completedAt`。稳定 completion ID 用于重试去重；首次独立通关奖励按关卡 claim 去重。没有宿主时仍可本地游玩，事件留存等待下次重试。

## 教程

三张图都基于 `valley-01-01`：真实初态、正式规则引擎所允许的一次合法安置、求解后由引擎验证的完整解。由 `scripts/render-tutorial.mjs` 和 `src/tutorial.mjs` 生成到 `assets/tutorial/`，元数据记录关卡、seed 和动作。
