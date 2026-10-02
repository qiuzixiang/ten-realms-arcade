# 星露配方交付清单

状态：**本地开发及自动验收完成（LOCAL_VALIDATED）**。平台发布、协调集成、外部独立人审和实机验收不在本次完成状态中。

开发 worktree：`[local-source]`。
分支：`codex/stardew-formulas`，基线 `374d2ee`，未新建提交。
所有交付文件位于 `standalone/stardew-formulas/`，原小游戏主工作区未改动。

## 可玩产物

- 本地预览：http://127.0.0.1:4187 （当前服务；以后可在本目录 `npm run serve` 重启）。
- 离线目录：`dist/xhs/`。
- 上传候选包：`dist/stardew-formulas-xhs.zip`，约 20 KB。未上传，平台当前规范与实体容器待核验。
- 60 关 / 6 章；笔记、完整撤销、擦除、解释型提示、三图教程、版本化存档、首次收藏、60 天循环的每日调制。

## 源码与证明

纯引擎、独立 oracle、生成器、版本化关卡、渲染与会话模块、单页交互、构建/审计/浏览器/干净导出脚本均已提供。主线与教程的规则真值可重算，运行不依赖外部网络和共享项目文件。

`README.md` 记录复现命令和宿主契约；`RULES.md` 冻结规则；`QA.md` 列出检查范围和未覆盖项；`THIRD_PARTY_NOTICES.md`、`LICENSE`、`UPSTREAM-LICENSE`、`REFERENCE-LICENSE` 保留来源和许可。

## 宣传预备（本地）

- `release/cover.png`：1080×1440 主题封面，与真实玩法截图分开。
- `release/icon-512.png`：512×512 图标。
- `release/screenshots/`：手机/桌面玩法、同一题真实三图、3 个代表题完成态、窄屏压力态。
- `release/NOTE-DRAFT.md`：事实核对后的本地文案，未创建平台草稿、未挂载游玩链接。
- `release/audit-report.json`、`browser-report.json`、`campaign-proof.json`、`clean-check.log`：验收证据。

## 后续集成建议

先安排独立人审和设备试用，再由协调任务按需接入合集；不要直接合并或覆盖主工作区既有修改。根构建当前不会自动带入此游戏，独立运行入口由本目录构建提供。外部发布须另获用户明确授权。
