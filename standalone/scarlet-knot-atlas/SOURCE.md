# 来源、许可与规范

来源：`games/red-thread-office`，固定提交 `55cdddb75cf57c17baee80bac4121bd3be1687c6`。
来源 logic.mjs SHA-256：`c35b2e53389c0dbf4b5f81ce85f5c93979a35a1f108108f5526a8e268a700541`，本轮实测与计划一致。
MIT LICENSE 和 THIRD_PARTY_NOTICES.md 原文保留，包含 Simon Tatham / ebnbin 来源致谢。
新引擎、renderer、图生成工具与程序生成的教程 SVG 为本任务代码原生素材，沿用 MIT。馆景位图由内置OpenAI ImageGen生成；原图、最终提示词和尺寸处理见release/imagegen-source.json。图标、签印、三态教程由原创向量/renderer生成，沿用MIT。声音由能力检测后的WebAudio原创合成，无外部音频资产；无外部字体。

按 [local-source] 及本机计划执行。仓库及所有父目录未发现 AGENTS.md；隔离 worktree 中 rg --files -g AGENTS.md 无结果。

本地平台基线：docs/platform/minitool-zip-builder-1.7.0/minitool-zip-builder/。原包 SHA-256：8bd0f4fde976ec3e9784bebc9fd8d16270769c129b39098698fc58572716c305；manifest 1.7.0 与 SKILL YAML 1.6.0 标记不一致，详见其 SOURCE.md。已读取 SKILL、ZIP、device、JS、CSS、cross-platform、performance、js-api references；下一阶段需对具体实现逐条复核。

2026-10-01 单次在线规范获取：curl -L --max-time 25 https://miniapp-sandbox.xiaohongshu.com/minitool/doc，失败为 curl(28) Resolving timed out after 25001 milliseconds，未取得远程文档。未绕过限制，采用 2026-09-23 本地 API 快照；不能确认最新版。存储实现需能力检测优先使用 9.46+ xhs.miniTool Storage，未注入或不满足版本时用 Web 回退；当前已实现Storage版本/方法检测、Web回退、异步串行与失败提示；真实容器尚未验证。
