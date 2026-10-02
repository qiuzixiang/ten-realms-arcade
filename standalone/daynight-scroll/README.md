# 昼夜织卷

基于 Unruly 的独立离线逻辑游戏，版本 1.0.0。6章72关，4×4与6×6棋盘；所有题面已验证唯一解、可用基础推理完成，旋转、镜像与昼夜互换重复已排除。

本地实现与自动验证已完成。独立只读终检和小红书PC模拟器首关验证已通过。已上传并提交，平台显示审核中；尚未确认公开发布。实体设备未实测。

## 游玩

在本目录运行 `npm run serve`，浏览器打开 http://localhost:4186 。入口是 `dist/xhs/index.html`，可选章节、续织、每日织片或重看指南。

选中格子后按昼、夜或擦除；键盘方向键移动，1为昼、2为夜、Backspace/Delete擦除。设置中可开启候选笔记或轻点循环。固定格不能修改。候选笔记不参与判胜，换关或重开清空。

提示先说明依据，由玩家确认填入。首次通关获得织片，重复完成不重复领奖；图鉴分页展示6段纹样。每日织片按本地日期与 bank-v1 从固定题库选取，不是无限生成。

## 本地命令

需要 Node.js 18+、Python 3。构建、规则测试与审计不依赖 npm 包：

```sh
npm run build
npm test
npm run audit
npm run qa:browser
```

浏览器检查需要 Playwright 和已安装的 Google Chrome。可 `npm install` 安装声明的开发依赖；本次验证使用 Codex 已提供的 Playwright 1.62.1，依赖通过 `CODEX_NODE_MODULES` 指向运行时的 node_modules。全新 npm 安装没有完成验证。`PLAYWRIGHT_CHANNEL` 可切换已安装的浏览器通道。

`npm run generate` 使用固定种子重新生成题库及证明；无需在普通构建时生成。`node scripts/artwork.mjs` 使用 Sharp 渲染已有原创 SVG 为宣传 PNG，普通构建不依赖此步骤。

## 交付

- `dist/daynight-scroll-xhs.zip`：离线包，根目录直接是唯一 index.html。
- `assets/`：实际使用的本地 SVG、同题三卡教程。
- `release/`：封面、图标、真实浏览器截图、题库证明、审计、笔记本地草稿。
- `RULES.md`：规则、来源与存档契约。
- `QA.md`：验证证据与未覆盖项。
- `DELIVERY.json`：版本、包体与 SHA256。

仅本目录拥有源码及产物，无跨游戏运行时依赖。没有改动仓库共享入口或来源游戏。源码采用 MIT；来源说明见 THIRD_PARTY_NOTICES.md。
