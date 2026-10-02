# 规则、规范与资产来源

- 规则来源：Bridges / Hashi。参考 `games/sky-bridges`，计划指定提交 `55cdddb75cf57c17baee80bac4121bd3be1687c6`。2026-10-01核对来源logic SHA256为 `e0a0195efd5a9ee2b114940e5cfbffd195002f0a187b1df4ccb3f7d64c36d643`，与计划一致。独立引擎和题库重新编写，不复制六题充数。
- 来源作者与许可：Simon Tatham及contributors的Portable Puzzle Collection、ebnbin/puzzles，MIT。见 `THIRD_PARTY_NOTICES.md` 和 `LICENSE`。构建脚本将完整MIT声明与规则致谢写入候选包JS注释。
- 开发基线：`374d2eee951c8f6aa0bbc829e9cceaa127596b7c`，独立managed worktree `[local-source]`。开发范围仅 `standalone/cloudharbor-chart/`。未找到仓库/祖先适用的AGENTS.md。主工作区的其他未提交修改受保护。
- 计划：主工作区 `docs/remaining-games-20260922-plans/v1/sky-bridges/{PLAN,DESIGN,NOTE-DRAFT}.md`，以及共用CONTRACT/XHS-PACKAGING。执行技能：`[local-source]`。
- 本地小工具规范包：`docs/platform/minitool-zip-builder-1.7.0/minitool-zip-builder-1.7.0.skill`，原包SHA256 `8bd0f4fde976ec3e9784bebc9fd8d16270769c129b39098698fc58572716c305`。2026-09-25归档自本机下载，包manifest=1.7.0，SKILL metadata.version=1.6.0，按原包保留这项不一致。已读ZIP、设备能力、JS API、JS/CSS兼容、跨端、性能预算参考。
- 2026-10-01尝试 `curl -L --max-time 30 https://miniapp-sandbox.xiaohongshu.com/minitool/doc`，DNS解析超时，curl退出28/HTTP000。无在线规范副本，使用2026-09-23本地JS API快照匹配存储能力；不声称获得最新要求。
- 审计使用该归档包原始 `scripts/audit_artifact.py`，目录与最终ZIP分别PASS；其只查体积/文件元数据。另行自建扫描、CRC、资源、CSP与真实浏览器交互检查，见QA。
- 界面、纸纹、浮港、邮艇、六章景观、工具文字/符号、SVG图标与封面均在本任务中由AI辅助编写向量/代码，MIT。未使用ImageGen或第三方位图、字体、音频。提示音为可选WebAudio短合成音，不需要媒体文件。
- 精确航图/教程由正式renderer与引擎状态绘制。`release`中的玩法截图来自打包产物浏览器运行，未用插画伪造实机。资产母版与截图来源分别标注。
