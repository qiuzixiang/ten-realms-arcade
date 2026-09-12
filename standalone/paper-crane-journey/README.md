# 纸鹤归旅

自包含离线 Pegs 游戏。60 个主线关卡、6 章、每日归巢、可复现的旅笺庭院、六种纸鹤图鉴。任意位置余一只即通关，莲心终点仅用于额外收藏。

## 运行

在本目录使用 Node.js 18+，构建和测试无需 npm install：

```sh
npm test
npm run build
npm run serve
```

打开 http://127.0.0.1:4317 。默认服务生产目录 `dist/xhs/`，可用 `PORT=其它端口 npm run serve`。

- 上传包：`dist/paper-crane-journey-xhs.zip`，根入口 `index.html`。
- 发布素材：`release/cover.png`、`release/icon.png`、`release/gameplay-hint-390.png`、`release/completion-390.png`。
- 中文文案：`release/COPY.zh-CN.md`；来源：`release/SOURCES.md`、`LICENSE`、`RULES.md`。
- `npm run generate` 重建题库和矢量图；`npm run build` 重建图片教程、经典脚本与 ZIP 并自动审计。
- `npm run qa:browser` 使用本地 Chrome、Playwright 和 sharp 重跑生产浏览器流程，导出PNG及截图。需先启动服务器；可通过 `QA_NODE_MODULES` 指定含 playwright/sharp 的 node_modules、`CHROME_PATH` 指定浏览器、`QA_URL` 指定本地地址。默认使用 Codex 捆绑依赖路径，生产游戏不依赖这些工具。

## 实现

`src/engine.js` 为纯规则与有界搜索；`src/levels.js` 为反向生成器及60关；`src/art.js` 为共享纸艺渲染；`src/storage.js` 为重放存档及幂等结算；`src/app.js` 为单页交互。运行时不依赖目录外资源，无网络、模块脚本、Worker或Service Worker。

存档前缀 `mini-polish:paper-crane-journey:v1:`。教程独立版本键；存档读取异常时只临时游玩，不覆盖未知原档，重新打开页面后重试读取。浏览器清除数据后无法恢复。提示搜索有节点上限，截断会诚实说明；可继续撤销探索。

当前仅完成本地发布准备，未上传或对外发布。实体手机、小红书容器与 Chrome 61 未实测，详见 QA.md。
