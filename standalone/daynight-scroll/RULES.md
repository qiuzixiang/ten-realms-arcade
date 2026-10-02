# 规则与实现契约

## 规则真值

- 偶数尺寸 n×n 棋盘。本版 n 为4或6，36道4×4及36道6×6。
- 空格 -1、夜0、昼1。固定格不可改；输入索引、数值和重复写入非法时原子拒绝。
- 每行每列的昼、夜数量必须各为 n/2。
- 横竖任何连续三格不能全部相同。
- 空格未填满不算完成；错误填法允许保留，冲突以虚线边框和文字提示。
- 不要求各行各列互异。题面唯一解与行列互异是不同概念。
- 候选、动画、提示次数及收藏状态不参与判胜。

`src/engine.js` 为纯引擎。独立 `scripts/oracle.mjs` 以合法整行组合逐行检查纵向约束，不引用引擎；每题搜索至第二解。测试额外穷举全部65536种4×4完整二色棋盘交叉验证。题库按二面体8种变换乘昼夜交换共16种变换规范化去重。

## 章节

第一针、留一针、一半月色、经纬相遇、疏星留白、长卷成章各12关。前两章介绍题分别以三连、夹心推理开始；第三章以各半开始。每章内空格数量递进，末章使用6×6，未实现可选8×8。所有题可由三连、夹心及各半规则求完，具体步骤与种子见 release/level-proof.json。没有人工玩家试玩数据，难度标签不是实测难度评级。

教程 ID `daynight-scroll-tutorial-v1`，复用首关初态、同一引擎的一次真实动作及独立求解器的完成态，共享 SVG renderer；每次构建重新生成并校验。

## 存档与结算

命名空间 `mini-polish:daynight-scroll:v1:`。教程已读标记独立于 save，教程升级不清空成绩。会话保存稳定关卡ID、局ID、动作历史与提示次数，恢复时逐步重放，非法记录隔离舍弃；已完成记录同样重放并重新判胜，不信任布尔完成标志。候选笔记仅保留在本局内存。

关卡首次通关 claim 为关卡ID，每日 claim 为 `daily:YYYY-MM-DD`。相同 claim 重开、刷新均不重复结算。完成 payload 包含 schemaVersion、gameId、levelId、mode、runId、completionId、rewardClaims、metrics、completedAt。

先把证明与 outbox 一起持久化，再尝试可选宿主 `window.onDaynightComplete(payload)`；宿主同步返回 true 表示确认，否则保留同ID重试。此回调是本地可选接口，不是原生 JSBridge。宿主应按 completionId 去重。无宿主仍正常本地胜利。存储异常时显示未保存提示、保留内存游玩，不能保证关闭页面后进度存在。近期会话恢复最多100份，历史完成记录最多2000份；不承诺永久保留无限每日记录。

## 来源与许可

规则原型：Simon Tatham’s Portable Puzzle Collection / Unruly。

- https://www.chiark.greenend.org.uk/~sgtatham/puzzles/
- https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/unruly.html
- 本地可信参考 `v4/games/daynight-loom/logic.mjs`、同目录 app.mjs。
- 核对提交 `55cdddb75cf57c17baee80bac4121bd3be1687c6`。

本次已读取本地固定提交实现及仓库MIT声明；上游帮助页网络获取超时，未保存或声称已在线复核最新版。新引擎、题库、界面与原创SVG由AI辅助编写；保留来源归属及MIT许可，不声称规则原创。封面是原创矢量装饰渲染，没有生成式位图或伪造棋盘截图。
