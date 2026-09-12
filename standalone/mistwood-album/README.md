# 雾窗显影

一间温润的口袋暗房。读懂行列数字，把 60 张手绘数织图案逐步洗成照片。六本相册各 10 关：前 20 张 5×5，后 40 张 7×7；全部关卡可自由选片，无体力和倒计时惩罚。

## 运行

需要 Node.js 18+ 和系统 `zip` / `unzip`。核心游戏、测试与构建没有 npm 依赖，无需安装。所有运行资源均在本目录。

```sh
cd standalone/mistwood-album
npm test
npm run build
npm run serve
```

在浏览器打开 <http://127.0.0.1:4283>。使用 `PORT=其他端口 npm run serve` 改端口。服务器只提供本游戏 `dist/xhs/` 的最终构建。

可上传包：`dist/mistwood-album-xhs.zip`；解压根入口 `index.html`。只做本地发布准备，未上传或对外发布。不要用根项目构建覆盖本目录。

## 游玩

- 数字给出连续填格段的长度，顺序不可变；段之间至少一格留白。0 是整条留白。
- 显影 ■、留白 ×、未知空格是三个独立状态。每格都明确且所有线索吻合才完成。
- 直接点格使用当前工具；再次点击同状态恢复未知。也可选行、列，用 44px 以上的大按钮落笔。手册可开启点格只选择。
- 键盘方向键选格，空格 / Enter 落笔；F / X / E 切换工具，Ctrl / ⌘ + Z 撤销。
- 提示先给观察方向，再展开当前候选排列的推理，最后可选择落一笔。冲突只指出问题，不自动猜测或修改答案。
- 每张完成照片进入图鉴；记录复拍次数、最少展开提示数。无展开提示可获得独立印记，使用提示不影响完整收藏。
- 每日照片按本地日期从 60 张已验证题库轮换复拍，不宣称每日新增。主线、每日、自由复拍共享图鉴。
- 进度自动存本地，可续上最近一局。切换新片会替换当前未完成局；旧照片和记录保留。关闭成功弹窗仍可撤销回看，重复完成同局不重复发奖励。

## 模块与证据

`src/rules.js` 纯规则、候选线索与提示；`src/levels.js` 手绘题库；`src/store.js` 回放存档和幂等结算；`src/render.js` 真实图片渲染；`src/app.js` 交互；`styles.css` 暗房视觉。它们在构建时顺序合并成 classic `app.js`，直接编写 ES2017，不依赖 module、网络、Worker 或宿主桥。

`scripts/independent-solver.mjs` 独立枚举行位掩码并运行列线索自动机，不调用生产求解器。`npm test` 证明 60 题唯一且无旋转镜像重复，同时覆盖教程、非法输入、撤销、损坏存档、重复结算、刷新和宿主失败。审计报告在 `release/`，完整矩阵见 `QA.md`。

`npm run qa:browser` 需要 Playwright 和 Chrome；脚本优先本地 `playwright`，其次使用本次环境的已安装运行库。其他环境可设 `PLAYWRIGHT_MODULE=/绝对路径/playwright`、`BROWSER_CHANNEL=chrome`、`QA_URL=http://127.0.0.1:4283`。它新建专用浏览器实例，不连接已有用户标签页。截图全部由触控和按钮完成真实游玩流程产生。

`npm run art` 使用 Sharp 重建原创美术（可设 `MISTWOOD_SHARP_PATH`，具体见脚本）；`node scripts/make-art.mjs --svg-only` 无依赖重建 SVG。美术源和 PNG 已随目录提供，构建不需要 Sharp。

## 本地宿主协议

可选 `window.mistwoodCompletionHost(payload)`。先写入本地记录和 outbox，回调返回 `true` 或 `{ack:true}` 才确认；抛错或无确认保留相同 completionId，下一次激活页面再试。宿主按稳定 completionId 和 rewardClaims 去重。这不是小红书 Native API，不要求宿主存在，也不在游戏包里调用未授权的平台桥。

私有键前缀 `mini-polish:mistwood-album:v1:`；教程另用 `tutorial:v1`。不清除其他游戏数据。恢复时从动作日志重放棋盘、提示次数与成就，而非信任缓存的完成标志。

规则、素材、许可见 `RULES.md`、`LICENSE`、`THIRD_PARTY.md` 和 `release/素材与许可.md`。发布文案、图标、宣传海报与真实截图均列在 `DELIVERY.json`。
