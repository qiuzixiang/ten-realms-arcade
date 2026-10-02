# 晚风铃庭

独立离线逻辑小游戏，版本 1.0.0。敲一口铃，按可见风线翻转一组铃的明暗，让所有铃同时亮起。六章共 60 个固定关卡，另有按本地日期从已验证题库选取的每日曲谱。

## 试玩与离线包

在本目录运行：

```sh
npm ci
npm run build
npm test
npm run audit
npm run qa:browser
npm run preview
```

本地预览默认使用 `http://127.0.0.1:4178`，只服务 `dist/xhs/`，并注入受限 CSP。可用 `PORT` 更改端口。不要把 `src/index.html` 当作构建入口直接打开。

- `dist/xhs/index.html`：完整离线产物入口。
- `dist/evening-bell-garden-xhs.zip`：小红书结构的本地 ZIP；根目录直接是 index.html。
- `release/`：封面、图标、真实浏览器截图、关卡证明、文案与验收报告，不包含在 ZIP 中。
- `DELIVERY.json`：版本、包体、校验和、范围及未覆盖项。

构建只需 Node.js 20+ 和 Python 3；测试无第三方运行时依赖。静态审计使用锁定的 Acorn。浏览器测试优先读取本项目安装的 Playwright，其次使用 Codex 工作区内置 Playwright；其他环境可安装 Playwright 或设置 `PLAYWRIGHT_MODULE` 指向其 `index.mjs`。`CHROME_PATH` 可指定 Chromium/Chrome 可执行文件；macOS 默认读取已安装的 Google Chrome，其他平台回退到 Playwright 浏览器。

## 已实现

- 2×2 到 5×5 固定题面；默认先预览影响范围，再确认敲击。
- 撤销、带确认的重开、可选快捷单击（手机在规则面板内设置）。
- 同一真实 3×3 题面的三卡图解；可跳过、重看，支持 Esc、焦点恢复与弹窗内部滚动。
- 从当前状态计算的单步提示，不替玩家直接落子。提示局独立徽记不发放。
- 逐关独立首次和最少步数徽记；六章庭景收藏，分页查看。
- 历史重放存档、损坏局面恢复、存储失败提示、幂等结算和本地 outbox。
- 系统字体、本地 SVG 原创插画、无音频依赖、减少动态模式。

## 文件职责

`src/engine.js` 为纯规则引擎；`src/levels.js` 是固定题库；`src/store.js` 负责历史校验、存档及完成事件；`src/render.js` 提供铃的主题映射与教程状态图；`src/app.js` 负责交互；`src/styles.css` 负责布局。

`scripts/generate.mjs` 由固定 seed 筛题并用独立 oracle 验证，显式运行才重新生成题库。`scripts/oracle.mjs` 使用与运行时不同的折半枚举算法证明最少次数，并检查带初态颜色的有向联动图同构。`scripts/assets.mjs` 生成三张真实状态图和原创矢量美术。`scripts/review-gallery.mjs` 生成六章审核图。

`node scripts/check-clean.mjs` 会在本游戏目录内创建临时的干净源码副本，重新安装依赖、构建、测试、审计并比较 ZIP SHA256，最后清理该临时副本。它不会修改共享根或其他游戏。

## 来源与边界

规则参考 Simon Tatham 的 Flip；本地参考实现固定为 Ten Realms Arcade 的 `v3/games/resonance-bell-room/`，提交 `55cdddb75cf57c17baee80bac4121bd3be1687c6`。代码与素材归属见 [RULES.md](RULES.md)、[LICENSE](LICENSE) 和 `assets/licenses.json`。

小红书包采用准备阶段保存的 minitool-zip-builder 1.6.0 规范。本轮没有查询到可验证的更新版本，上传前应核对平台最新要求。本地浏览器模拟与静态兼容检查不能替代 Chrome 61、实体 iOS/Android 或小红书容器验收。

当前交付为本地实现及验证版本；未提交、未推送、未上传，未创建小红书平台草稿，也未发布。主协调的集成和独立终检尚未执行，不标记平台 ready。详细证据见 [QA.md](QA.md)。
