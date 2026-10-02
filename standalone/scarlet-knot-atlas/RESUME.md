# 后续维护与边界

原额度检查点：8ad0cd3（2026-10-01，剩余10%停止）；同一worktree恢复并完成本地开发验收。当前源码、测试、包审计、截图和笔记草稿已交付；没有等待中的开发工作或自动重启任务。

工作目录：[local-source]
分支：codex/scarlet-knot-atlas。不重建worktree，不覆盖主工作区其他未提交修改；仅本目录归属本游戏。

下一次获授权修复时先检查DELIVERY.json、QA.md和Git状态，并用get_usage_limits读取codex的300分钟窗口。仅 remaining=100-usedPercent>10%继续；≤10%或读取失败立即保存与停止。不得购买额度或使用重置券。

本地复现：npm run generate → npm test → npm run prove → npm run build → npm run audit；浏览器需先build，再运行qa:browser与qa:boundary。规则、包和界面各有证据文件。clean-check验证干净Git归档重建字节一致。

后续平台验证仍未覆盖：最新线上规范、官方模拟器、Chrome61实际引擎、Android/iOS实体及官方容器。未来新授权、账号恢复且设备可用后，对同一候选ZIP核验；不把普通浏览器模拟标为真机或platform-ready。

持续禁止（直到用户明确更改）：小红书小工具上传/审核提交/笔记新建更新、GitHub推送、创建自动任务或新用户对话、向其他对话发消息、其他游戏和共享注册表修改。本地源码和ZIP不表示已发布。

精确任务Token及图像成本未披露，无法统计，不估算；账户百分比只作阶段额度门槛。
