# 梦屿旅舍

独立的 Rect / Shikaku 海岛旅舍游戏，版本 1.0.0。60 道固定唯一解题目，6 章递进；两点选房/拖动预览、原子确认、清房、撤销、临时候选、解释提示、三图教程、每日题与章节陈设集均已实现。

当前状态：本地开发交付；未上传、未提交、未发布。实体设备、小红书容器及外部独立人工验收尚未进行。

## 使用与构建

最终小工具包：`dist/dream-isle-hotel-xhs.zip`。解压后的根入口为 `index.html`。网站无运行时依赖、无联网请求，无原生 Bridge 依赖。

开发需要 Node.js 22+、Python 3、unzip，以及本机 Chrome。在本目录执行：

```sh
npm install
npm run build
npm test
npm run audit
npm run qa:browser
npm run serve
```

预览地址为 `http://127.0.0.1:4178`。浏览器测试默认使用 macOS Google Chrome；其它系统通过 `CHROME_PATH` 指定可执行文件。

本次因 npm DNS 不可用，使用 Codex 预装 Playwright 1.62.1、Sharp 0.35.4 以及本机缓存的 Acorn 8.18.0；依赖目录不属于交付代码。没有把网络依赖安装描述为通过。干净源文件副本在复用这些已安装开发依赖的条件下通过四项检查，并生成字节一致的 ZIP；详见 `release/clean-check.json`。

构建只写本目录的 `assets/`、`release/`、`dist/`。源码保持 ES2017，构建将模块按固定顺序组合为经典 IIFE；Acorn 对最终脚本按 ES2017 解析。ZIP 使用固定时间戳与排序，便于校验。

## 文件职责

- `src/engine.mjs`：纯规则、合法操作、历史重放与提示；`src/storage.mjs`：隔离存档与完成 outbox。
- `src/renderer.mjs`：正式棋盘/教程共用 SVG renderer；`src/app.mjs`、`src/styles.css`：交互和响应式界面。
- `src/levels.mjs`：固定题库与固定 4×4 教程；`scripts/oracle.mjs`：不依赖规则引擎的独立精确覆盖验证。
- `scripts/generate.mjs`：seed 20260914，筛选、双解搜索和题面/答案的八重对称去重。普通构建不会重新生成题库。
- `tests/`：规则、教程、存档、奖励回归；`scripts/browser.mjs`：受限 CSP 下的真实浏览器交互检查。
- `release/`：封面、图标、真实模拟视口截图、关卡审核图、证明数据、笔记底稿与验收结果。宣传素材不放入 ZIP。

题库进阶分数是候选余量加搜索分支权重，不是人类难度保证。玩家试玩尚未进行，详见 QA.md。

本目录是唯一开发边界；未改动共享根、来源游戏、其它独立游戏、注册表或 Service Worker。来源版本与许可证见 RULES.md、LICENSE、THIRD_PARTY_NOTICES.md。
