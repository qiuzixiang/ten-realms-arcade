# 星芽花园交付

版本 1.0.0。独立开发、本地测试、离线部署及发布提交已完成；**小红书当前审核中，尚未确认公开可玩**。60 关 / 6 章，每题独立唯一解证明通过。

## 文件与证据

- 上传包：`dist/starbud-garden-xhs.zip`，23,170 bytes。
- SHA256：`5e7085a16d25b9f4405935c45e9ec9688c88bc953f02bf554d0a0d0022242360`。
- 源码、生成器、独立 oracle、规则/存储测试、构建/包审计/浏览器脚本、MIT 许可与来源均在本目录。
- 笔记文案：`release/note.md`；真实初态/一步/通关/图鉴截图位于 `release/`，没有发布笔记或创建平台笔记草稿。
- QA：`QA.md`、`release/puzzle-proof.json`、`release/browser-qa.json`、`release/package-audit.json`。

## 可复建

开发提交 `210d7b9`，来源基线 `55cdddb75cf57c17baee80bac4121bd3be1687c6`。从该提交 git archive 提取到本游戏目录内的干净副本，无残留 dist，依次执行 generate → build → 11 项 test → audit → 生产产物 browser，全通过。重建题库源码一致，重建 ZIP 与实际上传包逐字节一致。构建固定 ZIP 文件时间戳，支持相同内容得到一致哈希。

仓库只读基线验证 `node scripts/validate.mjs` 通过：Validated 795 files。根 npm test 后半段会构建其他独立游戏，未越过本游戏写入边界执行。未改动共享注册表、根构建或主工作区其他内容。没有 GitHub/Pages 推送或部署。

## 小红书发布

2026-09-22 已通过当前上传表单：名称「星芽花园」、简介「围绕星核画出对称花园」、版本1.0.0、休闲游戏、无相册/摄像头/麦克风权限。上传返回“部署成功”；用户指定链接对应协议已勾选（表单显示《小工具发布安全规范》）。

提交接口 HTTP200 / code0 / success:true；随后列表出现本游戏及“审核中”。
app_id：`6ab246f2454c510015180a00`。
管理入口：https://creator.xiaohongshu.com/new/red-app
开发预览 deep link：`xhsdiscover://miniTool/6ab246f2454c510015180a00_develop?xhsMpScreenMode=full`。此链接为接口返回的开发预览，不当作已公开链接。

回执：`release/publication-response.json`，截图：`release/platform-deployed.png`、`release/publication-result.png`。没有把“发布成功”提示混同为审核通过。后续状态以平台为准；本轮未创建自动化或后台监控。

## 未覆盖

实体 iOS/Android、Chrome61 实际内核未测；SDK 存储以模拟接口测试，尚未实机容器验收。现代浏览器运行 9 组尺寸和4个代表题真实操作通过，零 pageerror、零外部请求。章节难度还没有真实玩家反馈；每日题是60关有限循环。
