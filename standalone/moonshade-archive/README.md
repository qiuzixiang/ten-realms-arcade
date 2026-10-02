# 月影书斋

遮去重复印记，让留下的书页连成一片。基于 Hitori 规则的独立离线逻辑游戏，60关、6章，4×4 / 5×5 / 6×6。

点选格子后遮黑、圈注或恢复；可选快捷循环，支持撤销、重开、解释型提示、独立完成记录、每日固定题轮换、六卷藏书和逐章揭开的书斋画卷。首次三步教程可跳过并随时重看。无联网与计时压力。

## 本地运行

在此目录使用 Node.js 18+、Python 3、系统 zip：

```sh
npm run build
npm test
npm run audit
npm run serve
```

打开 http://127.0.0.1:4197 。浏览器验证需可用的 Chrome 和 Playwright：

```sh
PLAYWRIGHT_PATH=/absolute/path/to/playwright npm run test:browser
```

可通过 `npm run generate` 用固定种子20260922复现题库（会重写 levels 与 proof）。构建将源码静态组合成 ES2017 classic 外置脚本；不依赖 npm 下载，不输出 sourcemap。

## 交付物

- `dist/moonshade-archive-xhs.zip`：小红书离线包，入口直接位于ZIP根。
- `dist/xhs/`：相同内容的生产目录。
- `release/`：图标、主题封面、真实浏览器截图、验证报告、笔记文案。
- `RULES.md` / `QA.md` / `DELIVERY.json`：规则合同、测试边界、平台状态。

本作使用私有存档，不接入或修改其他小游戏的导航、共享根、注册表与 Service Worker。平台发布状态以 DELIVERY.json 为准；上传、审核通过与笔记发布分别记录。

规则参考 Simon Tatham 的 Singles/Hitori；项目参考 `shadow-print-lab`，固定提交 `55cdddb75cf57c17baee80bac4121bd3be1687c6`。代码和图形由AI辅助制作，保留MIT许可，不声称谜题规则原创。
