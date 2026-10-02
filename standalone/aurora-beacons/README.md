# 极光信标

60 关、6 章的离线 Magnets 逻辑游戏。点选铜质双格信标，安排正负极或明确中性，同时满足配额和邻接规则。

## 开发与构建

Node.js 18+、Python 3，无 npm 依赖。

```
npm run generate  # 重现 v1 题库及证明摘要；发布后改变题库应升级版本
npm run build
npm test
npm run audit
node scripts/serve.cjs
```

浏览器预览 http://127.0.0.1:4187/ 。服务注入受限 CSP，禁止网络和内联脚本。上传 `dist/aurora-beacons-xhs.zip`；唯一入口为包根 index.html。`release/` 宣传素材不进入小工具包。

## 文件职责

- src/engine.js：纯规则、动作、回放、局部候选。
- src/oracle.js：独立域传播 + 完整三态回溯，不读取内置答案、不依赖引擎。
- scripts/generate.cjs：固定 seed、随机双格铺排、线索消减、唯一性与对称去重。
- src/session.js：私有存档、重放验证、首通记录、稳定事件 outbox。
- src/renderer.js：正式棋盘和三张教程共用 SVG renderer。
- src/app.js / styles.css：触控、键盘、六站收藏、每日轮换、提示。

每日调试从 60 道主线题中按本机日期循环，每 60 天重复。全关可自由选择，仅保存一局当前进度；首次完成记录独立保留。没有联网追踪，无需摄像头、相册或麦克风权限。

源码与文档仅位于本独立 worktree 的 standalone/aurora-beacons/。未修改主工作区、旧游戏或合集入口。发布目标为小红书；未请求 GitHub 发布。
