# 云阶筑城

离线单页 Towers / Skyscrapers 逻辑小游戏，六章共 60 关。点格后选择楼高；支持候选笔记、撤销、重开、确认式提示、每日街区与六座天际线收藏。

## 运行与验证

在本目录运行（Node.js 18+，系统 zip/unzip、Python 3）：

```sh
npm run build
npm test
npm run audit
npm run qa:browser
python3 -m http.server 4177 --directory dist/xhs
```

打开 `http://localhost:4177`。三个核心构建/规则/审计命令零 npm 依赖。浏览器验收需要已安装的 Google Chrome 和 Playwright；脚本优先读取本地 Playwright，当前环境回退到 Codex 随附运行时。其他机器可运行 `npm install --no-save playwright`，或用 `CLOUDSTEP_PLAYWRIGHT` 指向 Playwright 模块目录。`qa:browser` 自建短期 HTTP 服务并注入受限 CSP，结束自动关闭。它验证构建产物，须先 build。

`node scripts/generate.mjs` 以固定种子重新生成题库与筛选记录；一般改 UI 无须重生成。`node scripts/artwork.mjs` 生成封面与图标。重建离线 ZIP 不依赖宣传 PNG 或截图。

## 目录

- `src/engine.js`：纯规则引擎、动作、求解和历史重放。
- `src/levels.js`：稳定 ID 的离线题库。
- `src/store.js`：存档、奖励 claim、完成 outbox；宿主可选 `window.cloudstepCompletionHost(payload)`，同步返回 `true` 才确认接收，同一 completionId 可重试。
- `src/render.js`：真实数据生成的教程 SVG。
- `src/app.js`、`src/styles.css`：单页交互与晨雾城市主题。
- `tests/`：独立逐格求解 oracle、动作/教程/存档/去重测试。
- `assets/`：SVG 城市装饰与三张教程。
- `dist/xhs/`、`dist/cloudstep-city-xhs.zip`：classic ES2017、本地相对路径离线包。
- `release/`：真实浏览器截图、512×512 图标、1080×1440 封面、笔记文案和验收数据；不进入小工具 ZIP。

存档键 `mini-polish:cloudstep-city:v1:save`；教程标记独立为 `mini-polish:cloudstep-city:tutorial:v1`。完整局面如缺结算记录，会在启动时重放并幂等补记。损坏局面逐关丢弃；不清除其他游戏或教程键。存储失败仍可当页游玩，状态区明确提示，宿主通知在持久化成功后才发出。

规则来源、验证范围和设备限制见 RULES.md、QA.md、DELIVERY.json。仅本地开发交付，未上传、未发布。
