# 月潮回环

循着数字织出一圈月光的独立 Slitherlink 游戏。72 个主线关卡，6 座珊瑚岛，从 3×3 到 6×6；每日潮汐与瓶中种子模式为已验证题库的几何变式。无计时惩罚，无联网运行依赖。

## 运行

需 Node.js 22+、Python 3、系统 zip/unzip；无需 npm install。

```sh
cd standalone/moon-tide-loop
npm test
npm run build
npm run serve
```

打开 `http://127.0.0.1:4285`。服务读取 **dist/xhs/** 生产文件；可用 `PORT=其它端口 npm run serve`。本目录自身的 `index.html` 与构建生成的 `app.js` 也可由普通静态服务运行，不依赖仓库共享目录。

## 交付物

- 小红书上传 ZIP：`dist/moon-tide-loop-xhs.zip`（根 index.html，classic app.js，资源全本地）。
- 解包入口：`dist/xhs/index.html`。
- PNG 图标：`release/icon-512.png`，512×512。
- 宣传封面：`release/cover-xhs.png`，1080×1440；原始矢量 `release/cover.svg`。
- 实际游玩截图：`release/play-390.png`、`release/play-320.png`、`release/deep-sea-390.png`。
- 其余截图：`release/home-390.png`、`release/chapter-390.png`、`release/tutorial-320.png`、`release/complete-390.png`、桌面图。
- 中文发布文案：`release/小红书发布文案.md`。规则与来源：`RULES.md`、`LICENSE`、`release/来源与许可.md`。
- 验收记录：`QA.md`、`release/browser-qa.json`。机器可读清单：`DELIVERY.json`。

## 操作

默认直接点边画线，再点同一状态的边擦除；也可从格子内向一侧轻划，一次手势操作一条边。角点、斜划和取消手势不会猜边。切换「精确模式」仍可选格后用四方向按钮操作。画线、排除 ×、擦除三个工具分开。最密 6×6 棋盘在 320px 宽视口中，每格约 46px，边方向按键彼此不重叠。键盘方向键选格，W/D/S/A 操作对应边，1/2/3 切换工具，Z 撤销。

首进自动显示三张真实图片教程，可以跳过、看完与重看。听潮提示依据当前状态推理，先解释再由玩家选择是否应用；提示不扣已得收藏。点亮本岛 12 页获得海物，未用提示通关另记 ✧。全部关卡自由进入。

## 验证与重现

```sh
npm run audit
node scripts/generate-levels.mjs  # 重新生成相同72题与证明元数据
node scripts/release-art.mjs     # 重建宣传封面SVG（真实引擎状态）
npm run qa:browser              # 先在另一终端保持 npm run serve
```

浏览器 QA 使用独立 headless Chrome 进程、4286 调试端口与本目录临时 profile，结束只关闭自己的进程。默认 macOS Google Chrome 路径；其他环境用 `CHROME_PATH` 指定 Chromium。可用 `QA_URL`、`QA_DEBUG_PORT` 覆盖。脚本真实触摸/鼠标点击、验证存档、通关、截图；不会改写其他浏览器标签或其他游戏存档。

## 实现边界

`src/input.mjs` 为无歧义点边/滑动几何；`src/engine.mjs` 为规则；`solver.mjs` 为独立穷尽搜索；`levels.mjs` 与生成脚本为题库；`hint.mjs` 为推理解释；`render.mjs` 为棋盘/教程真值视图；`storage.mjs` 为重放存档与幂等奖励；`app.mjs`、`styles.css` 为交互。构建器零依赖，将明确的命名 ESM 模块静态包成 ES2017 经典脚本；不会执行运行时模块加载。

存档前缀 `mini-polish:moon-tide-loop:v1:`，教程独立版本键。宿主可选实现 `window.moonTideHost.complete(payload)`；返回 false 或抛错会保留 outbox。宿主需按 completionId 与 rewardClaimId 去重；无宿主正常通关。这个可选本地回调不属于小红书 JSBridge，不调用原生发布能力。

尚未在实体 iOS/Android、小红书 PC 模拟器/真机容器或 Chrome 61 内核验收；当前为静态兼容检查与现代 Chromium 触摸模拟。未上传、未对外发布，未参加已截止活动。
