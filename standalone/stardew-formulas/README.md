# 星露配方

把数字放进配方格，让每只算笼反应成功。独立的 Keen 算笼拉丁小游戏，含 60 关 / 6 章、候选笔记、撤销、解释型提示、真实三步教程、六册收藏和每日轮换。

## 本地使用

在本目录执行（Node.js 24、系统 zip/unzip；运行时无 npm 依赖）：

```sh
npm run build
npm test
npm run audit
npm run serve
```

打开 http://127.0.0.1:4187 。`PORT` 可改变端口。源入口为 `index.template`，构建后唯一运行入口为 `dist/xhs/index.html`；不要将源码模板直接作为可玩页面。

上传候选包为 `dist/stardew-formulas-xhs.zip`。它是本地离线交付物，未上传、未审核、未公开发布。运行包不包含宣传素材。

## 验证与结构

- `src/engine.js`：参数化纯规则、候选、完整状态撤销与操作重放。
- `scripts/oracle.mjs`：独立元组约束搜索；不导入引擎，不读取内置答案，搜到第二解或穷尽。
- `scripts/generate.mjs`：固定种子筛选、几何/运算拓扑去重、6 章编排，同时生成 `data/campaign.json` 与 `src/campaign.js`。
- `data/campaign.json`：版本化题面、开发用答案、种子与证明成本。运行题库不携带通关答案，仅教程保留已验证完成态。
- `src/renderer.js`：正式棋盘与教程共用渲染。
- `src/session.js`：存档重放、首通收藏、稳定完成 ID 与宿主重试。
- `scripts/build.mjs`：明确依赖顺序和词法隔离的静态模块打包，输出 classic ES2017；无第三方运行库。
- `scripts/audit.mjs`：JS 语法、包结构、禁止能力与引用检查。
- `scripts/browser-test.mjs`：真实浏览器点击、键盘、截图与断点回归。需要 Playwright 和 Chrome；可用 `PLAYWRIGHT_PATH` 指定 Playwright 安装路径，`GAME_URL` 指定服务地址。
- `scripts/clean-check.mjs`：在本目录 `.verification/` 中导出仓库 HEAD 并复制本任务源码，排除 dist / release；重新构建、测试、审计，并核对题库再生成一致性。不创建提交。

```sh
npm run generate
node scripts/clean-check.mjs
npm run test:browser
```

## 操作与存档

点选格子，再点数字；候选模式只记笔记。方向键选格，数字键填入，N 切换笔记，Backspace / Delete / 0 擦除，Ctrl / ⌘ Z 撤销。重新调制会清空本局，保留已验证收藏。每局最多记录 2000 个有效动作；达到上限时提示重新调制。

`mini-polish:stardew-formulas:v1:save` 保存操作记录。读档重新重放，不信任完成标记。教程键独立：`mini-polish:stardew-formulas:v1:stardew-formulas-tutorial-v1`。浏览器禁止存储时仍可临时游玩，界面明确显示保存失败，不向宿主发未持久化的奖励。

可选宿主 `window.stardewCompletionHost(payload)` 返回或异步返回 `payload.rewardClaimId` 表示确认。宿主必须按该 ID 去重；安装宿主后可触发 `stardew-host-ready` 事件重试。payload 含 game / levelId / runId / completionId / rewardClaimId。宿主失败不阻断游戏。

## 交付边界

实体手机、Chrome 61 和小红书容器未实测；当前平台规范未联网确认。难度标签是求解成本初排，尚无外部玩家留存或完成率数据。独立人审与协调集成、任何外部发布均待后续安排。详见 `QA.md`、`DELIVERY.md` 和 `THIRD_PARTY_NOTICES.md`。
