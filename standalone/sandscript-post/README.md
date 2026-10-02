# 时砂来信

独立离线箭头序链游戏，6章60题，3×3至5×5。点起点再点射线上的落点；固定号码、跨格连接、片段拼接与全局单链构成推理。支持候选圆点、撤销、断开、提示、邮册、60天循环的每日题、私有本地存档。

## 开发与验证

需 Node 18+、Python 3，零 npm 依赖。在本目录执行：

```sh
npm run generate
npm run build
npm test
npm run audit
python3 platform/audit_artifact.py dist/xhs
python3 platform/audit_artifact.py dist/sandscript-post-xhs.zip
npm run serve
```

预览 http://127.0.0.1:4198 。生成题库使用固定种子；日常构建不重新生成题库。平台包在 `dist/sandscript-post-xhs.zip`，唯一根入口 `index.html`，仅本地经典脚本、样式与真实教程 SVG。源码位于 `src/`，独立 oracle 和生成器位于 `scripts/`。

游戏键盘：方向键移动焦点，Enter/Space选择，Delete/Backspace断开本站，Esc取消；模态支持焦点循环、Esc关闭和焦点恢复。笔记只标记站点、不参与判胜，撤销仅撤回正式连线/断线，提示记录保留。

平台发布与实测状态参阅 `DELIVERY.md`、`QA.md`。本项目未接入合集注册表或共享构建。
