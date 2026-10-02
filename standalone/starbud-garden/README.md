# 星芽花园

独立、离线的 Galaxies / 180° 对称分区小游戏。60 关、6 章、5×5 至 7×7；含精确选边、笔记、撤销、真实三图教程、答案提示、图鉴、收藏和每日轮换。

在本目录运行，使用 Node.js 18+、Python 3、系统 zip/unzip：

```sh
npm run generate  # 已提交题库可直接构建；此命令确定性重建并证明题库
npm run build
npm test
npm run audit
node scripts/browser.cjs
```

浏览器 QA 需要 Playwright 和本机 Chrome。可用 `PLAYWRIGHT_PATH` 指定 Playwright 包路径；脚本含本次环境的默认依赖路径。其余生成、证明、构建、单测、包审计均零 npm 依赖。脚本启动自己的仅本机 HTTP 服务并测试真实 dist，不依赖其他预览服务。

上传物：`dist/starbud-garden-xhs.zip`；包根 `dist/xhs/`；宣传材料、证据与本地文案：`release/`。页面只读取包内资源；无联网、模块运行时、Worker、SW、动态代码、跨游戏依赖。

公开发布目标仅为小红书小工具。笔记只准备本地文案。GitHub/Pages 未请求发布。开发隔离在专属 worktree，未修改主工作区或共享构建。

完整规则与来源见 RULES.md；验收范围见 QA.md；发布实际状态见 DELIVERY.md。
