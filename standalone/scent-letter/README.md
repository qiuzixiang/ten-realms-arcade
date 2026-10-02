# 香笺秘方

本地可玩版本 1.0.0。六章60封固定委托，使用重复香材的 Guess / Mastermind 规则。已实现来信线索、聚合反馈、手机点选、填写撤销、候选笔记、解释型提示、练习重开、三图教程、每日选题、分页收藏、存档重放与完成事件 outbox。

## 本地运行

需要 Node.js 22+、npm、Python 3。当前任务独立目录，不需要修改或构建仓库根目录。

```sh
npm ci
npm run build
npm test
npm run audit
npm run qa:browser
npm run serve
```

浏览器验证另需 Playwright 与 Chromium/Chrome。本机自动使用已配置的 Codex Playwright 1.62.1 和已安装 Google Chrome；其他机器可安装 Playwright 后设置 `SCENT_CHROME_PATH`，或用 `SCENT_PLAYWRIGHT_PATH` 指向 Playwright 的 `index.mjs`。例如 `npm install --no-save playwright`。浏览器依赖不进入离线包。`npm run serve` 默认仅监听本机4189端口，可用 `SCENT_PORT` 修改。

- `npm run generate`：确定性重建60关，枚举槽位置换、香材改名与线索行排列去重，计算独立候选空间及参考决策树。
- `npm run media`：导出原创SVG封面/图标的PNG，以及复制真实浏览器素材；先运行浏览器验证。
- `dist/xhs/index.html`：构建入口。
- `dist/scent-letter-xhs.zip`：根入口的独立离线包。
- `release/`：浏览器截图、图标、封面、笔记、审计结果；不进入运行包。

构建会重建本项目的 `dist/xhs/`，不修改共享目录。存档命名空间为 `mini-polish:scent-letter:v1:`；没有任何跨目录运行依赖。

## 交付边界

当前完成本地实现与自动验收，未上传、未创建平台草稿、未发布、未提交或推送。未进行真实iOS、Android或小红书容器测试，也未安排另一个人/代理独立终检，状态不标为平台 ready。难度来自候选规模与确定策略轮数，尚无真人试玩数据，不承诺线性难度、最佳猜法或无限新题。

上游规则与许可证见 THIRD_PARTY.md；规则细节见 RULES.md；验证证据见 QA.md 与 DELIVERY.json。
