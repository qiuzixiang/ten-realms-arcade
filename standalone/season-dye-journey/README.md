# 四季染旅

一款手机优先的东方织物 Flood 解谜游戏。72 个独立主线关卡、6 章，从 4×4 / 3 色递进到 10×10 / 6 色；另有每日配色、种子自由工坊、布样收藏。提供真实三图教程、当前局面提示、撤销、重染、续局和非惩罚性星级。

## 运行与构建

在本目录执行（Node.js 18+；无需 npm install）：

```sh
npm run build
npm test
npm run audit
npm run serve
```

浏览器访问 http://localhost:4187/ 。`npm run serve` 需要 Python 3。亦可使用任意静态 HTTP 服务托管 `dist/xhs/`。

- 最终入口：`dist/xhs/index.html`
- 小红书上传包：`dist/season-dye-journey-xhs.zip`
- 主图：`release/cover.png`（1080×1440）
- 图标：`release/icon-512.png`
- 实际游戏截图：`release/play-midgame.png`、`release/play-320.png`
- 中文发布文案：`release/XHS-COPY.md`
- 验收：`QA.md`、`DELIVERY.json`

本目录自包含，运行/测试/构建不依赖仓库共享目录。构建仅写本目录的 `dist/xhs/`、ZIP 和根 `app.js`。根 `app.js` 为生成文件；修改 `src/` 后重新构建。

## 规则与操作

点底部染碟（或键盘 1–6），将左上连通区换色，吸收上下左右相邻的同色布格。相同颜色点击无效；零扩张换色仍记一步。整幅同色且在预算内通关，超出预算可继续练习。撤销按钮或 Z 撤销；重染会开始新局。

三星：步数不超过已验证参考路线；二星：不超过参考 +2；其余预算内通关一星。提示与撤销不扣星。参考路线不保证最优，不宣称唯一。

所有关卡可自由探索；每日按设备本地日期生成。工坊可设种子、尺寸和颜色数。主线通关后原始布样收入收藏。

## 存档与宿主

私有前缀 `mini-polish:season-dye-journey:v1:`；单局最多512步。存档只信任可重放日志，教程已读独立版本化。

完成会话、证据、奖励、待同步事件原子写入，再调用可选 `window.DyeHost.complete(payload)`。没有宿主时不影响游玩。待同步队列上限256；满后新局仍存本地并明确提示，不丢弃旧待同步事件。证据上限512，保留主线最佳/首通/最低提示记录与已排队事件，较旧非主线记录可能轮换。宿主须按 completionId/rewardClaimId 去重。

## 可复现素材和浏览器验收

日常 build/test 不需要第三方包。可选作者工具需要 Sharp、Playwright 和 Chrome：

```sh
npm install --no-save sharp playwright
node scripts/generate-assets.mjs
npm run build
npm run qa:browser
```

也可通过 `DYE_SHARP_MODULE`、`DYE_PLAYWRIGHT_MODULE` 指定已安装模块入口的绝对路径；`DYE_CHROME` 指定 Chrome 可执行文件。浏览器脚本使用独立无头实例及4188端口，只访问本作生产构建，自动生成截图与 `release/browser-qa.json`。教程SVG/PNG已随源码提供，普通构建无需图像依赖。

来源和MIT许可见 `RULES.md`、`LICENSE`、`release/LICENSE-SOURCES.md`。未上传或对外发布；实体手机、Chrome61旧内核与小红书容器验收未覆盖。
