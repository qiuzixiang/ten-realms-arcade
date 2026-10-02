# 朱陶阶庭 / Cinnabar Terraces

本地独立完成的陶艺主题 Futoshiki 游戏，6章60关。4×4、5×5、6×6各20题，全部没有预填数字，全部独立证明唯一且可用列出的规则策略从空盘推完。交付状态为 **LOCAL_ACCEPTED / XHS_LOCAL_CANDIDATE**；未上传、未审核、未发布，也不是 platform-ready。

玩法：选格后填写1–N，每行每列各出现一次；仅显示的 `< > ∧ ∨` 规定严格大小。没有数独宫与对角条件。玩法阶段保持平面浅凹陶格，完成时才按真实数字生成立体小院。规则见 [RULES.md](./RULES.md)。

已实现首页、六章选关、游玩、真实三图教程（4/5/6阶分别可重看）、成庭结算、陶砖集、有限60题的上海日期轮换复习。支持填写/笔记文字模式、自动局部候选、擦除、160步撤销、重开、三级推理提示与完整解法练习。提示可获首通陶砖；完整演示标练习，不发首通奖励。

5/6阶提供选行→大格键选位置→数字盘。320px六阶格体约37px，替代格键88×48px、数字键88×52px；不靠捏合或重叠热区。密集刻印另有逐条48px高的精确阅读列表。页面采用正常竖滚；桌面仍可用同一精确面板或方向键、数字、N、Ctrl/⌘ Z。

## 开发与复现

仅修改本目录。独立worktree：`[local-source]`；分支 `codex/cinnabar-terraces`，基于主仓库 HEAD `374d2ee`。计划和来源基线在 QA 与 THIRD_PARTY_NOTICES 中记录。没有改合集注册表或其他游戏，也没有把本目录自动复制进主工作区。

在本目录执行（实际环境 Node 24.13.0、Python 3.13、macOS 的 zip/unzip/xmllint）：

```sh
npm run build
npm test
npm run prove
node scripts/reproduce.mjs
node scripts/contrast.mjs
npm run audit
python3 platform/minitool-zip-builder/scripts/audit_artifact.py dist/cinnabar-terraces-xhs-candidate.zip
```

生成器无需npm依赖，固定seed可重现同一题库和完整证明。`npm run generate` 会重建 levels.js 与 release/level-proofs.json。`reproduce.mjs` 在新的临时目录重建并对比SHA256，不覆盖当前题库。`build` 只清理本目录的生成目录 dist/xhs，并生成九张教程SVG及候选ZIP；不操作仓库根构建。许可证完整进入包内 licenses.json。

浏览器模拟需要已安装 Chrome 和 Playwright；依赖不进入ZIP，不自动安装：

```sh
# 环境不同可设置 TERRACE_NODE_MODULES 与 TERRACE_CHROME
node scripts/browser-qa.mjs
node scripts/promotional.mjs
```

脚本通过临时 localhost 服务读取**最终 dist/xhs**，注入禁止网络/内联脚本/eval的CSP，仅模拟浏览器，不冒充小红书容器。默认复用 Codex 已提供的 Playwright runtime，具体可通过环境变量覆盖。可手动预览：`python3 -m http.server 48768 --bind 127.0.0.1 --directory dist/xhs`。

## 存档与奖励

私有键 `mini-polish:cinnabar-terraces:v1:save`。每次动作/页面隐藏保存当前局（含笔记、历史、模式、选择、提示、练习标记），切到别庭前提示当前未完成数盘会替换。题面版本、校验值与数值schema复验；损坏当前局回到空盘，独立复验过的完成陶砖保留。教程版本标记不清进度。读取失败或存储不可用时明确显示不能保存，仍可玩，不删除其他游戏键。

根据1.7.0本地API快照，检测客户端9.46+且API完整时优先使用 `xhs.miniTool.getStorage/setStorage`；无适用环境时用 Web 存储，native写失败不伪称成功。真实native路径未在容器验证。稳定runId、completionId、rewardClaimId与本地完成/outbox同时持久化后，才投递可选 `window.TerraceHost.claimReward(payload)`。宿主应按rewardClaimId去重；只有返回true或同claimId确认才删除待投递事件，失败同ID重试。不捆绑宿主、不发跨游戏多通道奖励。

## 交付物与边界

- `dist/cinnabar-terraces-xhs-candidate.zip`：本地候选离线包，根index.html、classic脚本、相对本地资源、ES2017语法审计、MIT保留。
- `release/`：实际构建截图、1080×1440封面、512px图标、证明/浏览器/对比度/重现与包审计报告。
- `NOTE-DRAFT.md`：本地笔记文案；未创建任何平台草稿。
- `QA.md`、`DELIVERY.json`：准确命令结果、绝对路径、SHA256、已覆盖与未覆盖项。

未取得2026-10-02线上规范（DNS超时），参考归档manifest1.7.0（原SKILL YAML遗留1.6.0）及2026-09-23 API快照。尚未覆盖创服平台模拟器、实体iOS/Android容器、Chrome61实际内核、真实手机帧率与系统大字。后续获得授权并解决账号问题后，须在平台模拟器及Android/iOS真机验证同一ZIP，再判断是否可提交；本任务没有进行任何上传、审核、笔记操作或GitHub推送。

开发Token已取得本对话累计日志快照：输入5,526,416（缓存5,355,264），输出71,602，合计5,598,018；非缓存输入+输出242,754。排除建档首轮，未合并其他对话，累计与逐次增量逐字段核对一致。快照为2026-10-02 06:44:42 +08:00；之后的调用和最终答复未计入，**最终完整任务精确Token仍无法统计**。共享额度比例不换算成Token或费用，未购额度或使用重置券。完整口径见 release/token-usage-snapshot.json。
