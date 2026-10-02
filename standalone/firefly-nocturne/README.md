# 萤庭夜游

一款独立 Light Up / Akari 逻辑小游戏：在冷陶石微缩夜庭安放萤灯，照亮全部花径，同时满足数字墙与灯不互照。六章共 60 道静态题，从 4×4 逐步到 9×9。含真实首关三步教程、三层规则证明提示、本机进度和六种植物的 36 处图鉴细节。主题、界面、庭院 SVG 与题库在本目录内自包含。

从仓库根目录运行 `python3 -m http.server 4174`，打开 `http://127.0.0.1:4174/standalone/firefly-nocturne/`。专属验证：

```sh
node --test standalone/firefly-nocturne/campaign-tests.mjs
node standalone/firefly-nocturne/generate-campaign.mjs --check
node --check standalone/firefly-nocturne/app.mjs
node standalone/firefly-nocturne/build-offline.mjs
node --check standalone/firefly-nocturne/dist/xhs/app.js
unzip -t standalone/firefly-nocturne/dist/firefly-nocturne-offline.zip
```

离线构建写入 `dist/xhs/` 和 `dist/firefly-nocturne-offline.zip`；ZIP 根目录是 `index.html`、经典 `app.js`、`styles.css` 和本地 SVG。`dist/` 被 Git 忽略，干净检出需重新构建。宿主可监听 `mini-game:complete` 接收首次通关事件；监听器若在页面启动后才挂载，可向 `window` 派发 `mini-game:request-pending` 以重放本机保存的事件，并按 `completionId` 或 `claimId` 去重。

2026-09-25 本地交付状态：60 题独立穷举均唯一，专属测试 5/5、生成器复现检查、脚本语法、ZIP CRC 通过；按本地缓存的小工具规范 1.6.0 审计目录和 ZIP 均为 0 warning。打包入口已在浏览器模拟的 320×720、390×844、1280×720 视口验证无横向溢出，并实测首次解锁结算、图鉴、焦点、密盘精确输入和刷新存档。离线 ZIP 是**本地候选包**；实体手机、小红书容器导入、上传和发布尚未执行。本目录未改动合集注册表、根构建或共享代码。规则和署名见 [RULES.md](RULES.md) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
