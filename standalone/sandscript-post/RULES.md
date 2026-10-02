# 规则与来源

版本1.0.0，slug sandscript-post。来源参考为小游戏-five-release/v3/games/time-sand-post，计划记录提交55cdddb75cf57c17baee80bac4121bd3be1687c6；实际开工读取其 RULES/logic。上游为 Simon Tatham Portable Puzzle Collection 的 Signpost，由 James Harvey 贡献，Pfeilpfad 归功于 Janko；中文参考 ebnbin/puzzles 固定提交5a9e1795a3324e0f6433b79fbe31cbd9b12048a3。上游和参考 MIT 声明随 LICENSE 保留，页面可阅读。源码、题库、主题、矢量图形独立编写，未复制上游代码与视觉。

1. 坐标从左至右、从上至下，索引 y×size+x。每格为站点；箭头八向固定，终点无箭头。
2. 后继须处于严格正向射线，允许跨格，允许几何交叉。每站至多一前驱、一后继。
3. 新线释放起点旧出线、落点旧入线，然后检查整个新局面。逆向、自连、越界、小环、固定序号矛盾或越界整次原子拒绝。不计时，不用固定链长衡量操作成绩。
4. 本作采用计划冻结的手动规则交互：不复刻原版自动补线与代数编号；不允许本地片段出现固定数字冲突。无已知数字的片段显示问号，已知锚点推导的号码不带下划线。暂时可连不保证可完成。
5. 通关必须从固定1出发，经所有格一次，到固定N，形成唯一单链；全部箭头与固定号码吻合。局部无冲突、笔记、装饰、外部标志均不能判胜。
6. 断开本站移除其入线和出线；撤销移除动作日志末项后重放，恢复完整正式邮路。圆点笔记独立，不参与动作日志与奖励；提示累计不因撤销清除。
7. 每章10题：前2题认识概念、中6题组合、后2题综合。按搜索节点、分支数、分支深度排序取样；尺寸、固定号码量、长跳比例共同变化。尚未获得玩家难度或留存数据。
8. 独立oracle不读取答案、不导入引擎，使用叉积/点积建立有向图并穷尽到第二解。只有一解且完整穷尽才接纳；节点截断淘汰。按8种正方形对称变换规范化题面去重。证明见release/level-proof.json。浏览器提示路径由构建期oracle生成，仅作提示，不参与判胜。
9. 每日题使用设备本地日历日期映射60题，60天循环，与主线共用邮册。不承诺无限题库。

主题映射：站点→纸上邮票，固定序号→下划线邮戳，八向箭头→机械指针，完整路径→已签收来信。装饰信封图标不表示题面。

## 存档及宿主

命名空间 mini-polish:sandscript-post:v1:ledger。单JSON保存current、records、outbox和单独教程已读字段。恢复逐条重放有效动作并重新判胜；损坏会话丢弃，其他有效记录保留。完成记录保留较低提示次数的通关证据；首次邮戳或提示改善可触发宿主事件，日常重通不重复发奖。

runId 为每次开局稳定ID；completionId=sandscript-post:<runId>:complete；rewardClaimId=sandscript-post:<levelId>:assisted或independent。先成功持久化再调用可选window.SandscriptHost.complete(payload)；仅true或{accepted:true}确认成功。异常保留outbox，同ID重试、并发去重。各outbox保存独立通关日志，刷新后不能因最佳成绩更新丢失。宿主须按rewardClaimId幂等；无宿主时仅本地邮册。存储失败提示，仅内存可玩且不发宿主事件。禁止清理其他键。

离线存档验证用于防损坏与伪造completed布尔值，不是防篡改竞技系统；客户端用户可编辑完整有效解与提示次数，不作可信排行榜。

## 教程

固定ID sandscript-post-tutorial-v1，固定题sand-01。构建调用正式引擎得到初态、一次合法连接、完整解，并调用正式SVG renderer绘制三图；最终状态必须引擎判胜。首次可跳过，随时重看。数据与证据位于release/tutorial-proof.json。
