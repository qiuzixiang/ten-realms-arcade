# 瓷流工坊 · Porcelain Flow Atelier

本地独立版本 1.0.0。六章六十关、钴蓝/象牙白干式工业陶瓷主题。规则是 Slant / Gokigen Naname：每格一片斜瓷，交点数字等于接入端头数，全图无环；分离的树状组件合法。

状态：本地验收通过的候选交付。未接入共享注册表，未推送 GitHub，未上传、审核或发布小红书。不是 platform-ready。最新在线规范、官方模拟器、Chrome61 实际执行、实体 iOS/Android 和低端性能尚未验证。

## 玩什么

- 4×4 → 5×5 → 6×6 / 6×7；所有关卡可直接练习。角边数字、双端传递、闭环、无线索节点、跨盘长路径、综合检验逐章展开。
- 每题由独立 DFS 图检查与不读取答案的完备二值搜索证明唯一；第三至第六章的局部数字推理不足，必须结合无环规则。第五、六章包含至少一处跨半盘且 ≥6 边的路径排除。
- 默认选 ╲ / ╱ / 清除，再点格中央。交点附近的点按仅进入检查；四个大按钮查看节点。铅笔为虚线，不参与检验。
- 撤销、重做、重开；三级提示为“定位 → 解释当前依据 → 另次确认安装”。展示完整闭环与已有连接路径。
- 同题真实空盘、一片、完成态三图教程；第21关首次提供可安装/撤回的独立 2×2 环练习。
- 首通与独立检验去重，六种章节器件和真实完成纹样收藏。无倒计时、生命惩罚或最少步宣称。

## 构建与验证

在本目录执行。规则/存档测试、生成器与构建仅用 Node 标准库；打包还需系统 zip/unzip；归档官方体积审计需 Python3。

```sh
npm test
npm run build
npm run audit
```

正式产物：`dist/xhs/`（唯一根 index.html + classic ES2017 app.js + 本地 CSS/SVG/许可），`dist/porcelain-flow-atelier-xhs.zip`（本地候选 ZIP）。只能用 HTTP 服务构建产物；源码 index.html 引用构建后的 app.js。

```sh
python3 -m http.server 8764 --bind 127.0.0.1 --directory dist/xhs
```

打开 http://127.0.0.1:8764/。这一预览是普通浏览器，不是小红书官方模拟器。

```sh
npm run generate
npm test
npm run build
npm run audit
npm run playtest
npm run media
```

生成器固定起始种子 2026100104 / 版本 pfa-gen-1。重新生成会写 levels.mjs、release/certificates.json 与标准输出；认证数据应保持相同。已提交完整固定题库，普通构建无需先生成。

浏览器与素材脚本使用已有 Playwright、Sharp 和本机 Google Chrome，没有安装新的依赖。此环境复用 Codex bundled node_modules。换机器用 `PORCELAIN_NODE_MODULES=/absolute/node_modules npm run playtest`（需已有 playwright），媒体另需 sharp；脚本默认打开 headless Google Chrome。全部浏览器验收通过 HTTP 服务生产产物并注入受限 CSP，主动阻断联网/Worker/iframe。截图仅表示浏览器模拟。

## 文件与证据

- logic.mjs：独立纯引擎、计数、并查集、完整路径与当前局面提示。
- oracle.mjs：不导入引擎，独立坐标/DFS 判环/二值搜索；仅开发证明，未打进运行包。
- levels.mjs / scripts/generate.mjs：60 固定题及可复现生成筛选。
- session.mjs：动作重放、版本校验、原生/浏览器存储、去重记录和待投递事件。
- app.mjs / render.mjs / styles.css / assets/：单页界面、真实 SVG 棋盘、原生矢量主题插画与器件。
- RULES.md、THIRD_PARTY_NOTICES.md、LICENSE：规则和来源许可。
- QA.md / DELIVERY.json：实际验收、文件路径、命令结果、未覆盖项与用量说明。
- release/certificates.json：每题哈希、唯一性、未截断证明和实际强制推理轨迹。
- release/browser-results.json / static-audit.json / contrast.json：浏览器、包、对比度证据。
- release/screenshots/：实际生产包点击、教程、完成/收藏截屏；release/cover-1080x1440.png 为原创装饰插画与真实截图组成的封面。
- release/NOTE-DRAFT.md：仅本地文案，账号问题期间禁止发布。

## 存档与宿主

前缀 `mini-polish:porcelain-flow-atelier:v1:`，教程版本键另存。当前会话历史上限 4096 次动作。存储失败会提示，完成事件不发放；恢复保存后使用原来的 completionId 重试。原生 Storage 检测 9.46+ 与方法存在，否则使用浏览器本地存储。容器可能清缓存，不能保证永久保存。

可选宿主 `window.PorcelainHost.complete(payload)` 返回 `true` 或 `{accepted:true}` 才确认；1200ms 未确认保留事件。设置宿主后派发 `porcelain-host-ready` 可重试。宿主必须按 `completionId` 和 `claimIds` 去重。无宿主时继续离线游玩，全部本地完成记录保留。本款没有调用平台发布或分享能力。

源码严格位于 standalone/porcelain-flow-atelier；不改共享构建、导航、其他游戏或存档，不创建自动任务，也不向其他聊天发送消息。
