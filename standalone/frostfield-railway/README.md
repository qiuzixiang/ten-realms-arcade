# 霜野铁道

依据行列配额，铺出一条完整的 A→B 铁路。60 关 / 6 章 / 5×5–6×6；独立唯一解验证、真实三图教程、撤销、候选/排除、分级提示、章节收藏及有限题库每日轮换。

本目录完全独立，不修改主项目、其他游戏、根构建或 Service Worker。仅发布小红书离线版本；合集集成由协调任务处理。

## 命令

Node.js 20+，Python 3，系统 zip/unzip。生产运行无第三方依赖；仅审计工具使用锁定的 acorn 开发依赖。

```sh
npm ci
npm run generate  # 可选：重生成同一版本的 60 题和证明
npm run build
npm test
npm run audit
npm run serve     # http://127.0.0.1:4194，受限 CSP
npm run browser   # 另一个终端中执行
```

浏览器回归需 Playwright 与 Chrome：设置 `PLAYWRIGHT_MODULE` 为本机 Playwright 包路径，`CHROME_PATH` 为可执行文件路径，`GAME_URL` 可覆盖测试地址。缺省值适配本次开发主机，外部环境应显式配置。浏览器测试只读取生产 dist/xhs，不加载源码。

- 规则：[RULES.md](RULES.md)
- 来源：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- 验收边界：[QA.md](QA.md)
- 发布状态：[release/PUBLICATION.json](release/PUBLICATION.json)
- 文案：[release/NOTE.md](release/NOTE.md)
- 离线包：`dist/frostfield-railway-xhs.zip`
- 发行入口：`dist/xhs/index.html`

`src/` 为 ES2017 模块；`scripts/build.mjs` 按检查过的固定依赖顺序生成 IIFE classic 脚本。产物没有网络、CDN、内联脚本、Worker、Service Worker、iframe 或模块加载。许可随源码和 app.js 注释分发。素材为代码原生 SVG；图标/封面 PNG 位于 release，包中不含宣传源图或测试。
