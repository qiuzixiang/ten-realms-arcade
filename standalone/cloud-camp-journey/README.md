# 云野露营

一棵树，一顶帐篷。以立体纸景与露营手账呈现的 Tents 逻辑游戏，手机优先，离线可玩。

## 开始

本目录可独立复制运行，不依赖仓库其他目录。需要 Node.js 18+，构建打包需要系统 `zip` / `unzip`；无需安装 npm 依赖。

```sh
npm test
npm run build
npm run serve
```

打开 http://127.0.0.1:4281 。可用 `PORT=4301 npm run serve` 更换端口。服务只监听本机，内容来自最终 `dist/xhs/`。构建也同步根目录 `app.js`，因此 `index.html` 可以直接打开；推荐 HTTP 方式验收，文件协议的存储行为因浏览器而异。

上传包：`dist/cloud-camp-journey-xhs.zip`，解压根入口为 `index.html`。本任务只准备发布，尚未上传。

## 内容与操作

- 60 个主线营地，6 章，每章 10 关，4×4 → 5×5 → 6×6 → 7×7。
- 120 道额外独立题面支持每日营地与十站种子旅途。同口令得到同路线；这是有限题库，日题可能重访。
- 首进三图教程、跳过和重看；当前局面提示、无限撤销、重开、自动续局。
- 每章完成 10 关收藏一张风景。提示不扣奖励，没有倒计时、断签扣分或体力限制。
- 点选格子后使用放帐、标空或擦除。窄屏小格可用四个 44×44 方向按钮精确选格。
- 键盘方向键选格，T 放帐、G 标空、X 擦除、U 撤销、H 提示；按钮可用 Tab / Enter 操作。

数字表示这一行或列的帐篷数。每棵树必须与上下左右的一顶帐篷一一匹配；帐篷之间包括斜角也不能相邻。标空只作笔记，空地无需填满。

## 模块与证据

`src/engine.mjs` 为规则与完整二分匹配；`solver.mjs` 为不读取答案的独立搜索；`levels.mjs` 为题库；`generator.mjs` 为确定性选题与难度审计；`storage.mjs` 管理操作重放、幂等奖励和 outbox；`art.mjs` / `assets/` 为真实棋盘元素与原创纸景；`app.mjs` / `styles.css` 管理界面。

详见 `RULES.md`、`QA.md`、`DELIVERY.json`。逐题唯一性、D4 去重、配额停滞与匹配反例在 `release/level-proof.json`。关卡再生成命令为 `node scripts/generate-levels.mjs`，会重写题库；无需每次构建重新生成。

美术可用 `node scripts/art.mjs` 重新生成；仅此可选美术工具需要 sharp，查找方式见 `release/ART.md`。浏览器可重放脚本在 `scripts/browser-qa.mjs`，需注入 Codex CUA 的专用 tab 与 viewport，具体见 QA。

已执行桌面浏览器手机尺寸模拟；尚未进行实体 iOS、Android、小红书真机容器及 Chrome 61 运行验收。
