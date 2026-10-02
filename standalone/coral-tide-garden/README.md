# 珊瑚育海

60 道独立唯一解 Filling 谜题，6 章，每章 10 关，4×4 至 6×6。纯离线、自包含、不联网。

在本目录运行：

- `npm run generate`：确定性种子生成与最多二解搜索筛选。
- `npm run build`：构建经典外置脚本与小红书 ZIP。
- `npm test`：规则、独立唯一性、存档、奖励和教程测试。
- `npm run audit`：生产包路径、CRC、语法与禁用能力审计。
- `npm run serve`：在 http://localhost:4186 预览生产产物。

不依赖 npm 安装；需要 Node 18+、Python 3 和 zip/unzip。日常重建使用已版本化 src/levels.js；generate 仅在有意换题时执行。

候选笔记、完整撤销、重新开局、直接数字提示、版本化三步教程、六海域图鉴、每日 60 题循环、键盘操作均已实现。存档由动作重放验证；可选 CoralGardenHost.complete(payload) 返回 true 表示接收，按 completionId/rewardClaimId 去重。本小工具不依赖宿主。

发布素材在 release/，不进入离线包。规则来源和许可证见 RULES.md、LICENSE、THIRD_PARTY_NOTICES.md；测试边界见 QA.md。
