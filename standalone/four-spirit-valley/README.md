# 四灵山居

在纸雕山谷中为相邻山居安排水麟、火羽、月狐或森龟。只有共享一段边界才算相邻；角点接触不算。完成条件是所有区域都有正式守护灵，且每条相邻边两侧不同。

本版本包含 60 道固定关卡、6 章，每章 10 关。关卡由固定 seed 复现，按旋转、镜像和颜色重命名做对称去重；每题的固定神龛通过不读答案的二解搜索证明唯一。主线地图、今日小谷、真实三态教程、候选笔记、撤销、重开、渐进章节、手账、提示、存档重验和幂等完成事件均在独立目录实现。

## 本地命令

- `npm run generate`：按固定种子重新生成和去重 60 道关卡。
- `npm test`：运行关卡、规则、唯一解与教程真值测试。
- `npm run build`：生成小红书 classic 离线目录 `dist/xhs/`。
- `npm run audit`：检查目录结构、脚本语法、路径引用、外部请求和 ZIP。

最终 ZIP 为 `dist/four-spirit-valley-xhs.zip`。ZIP 根目录直接放置 `index.html`，不需要联网或 Native Bridge。

## 规则来源

规则参考 Simon Tatham’s Portable Puzzle Collection 的 Map，以及 `ebnbin/puzzles` 固定提交 `5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`。本目录重新实现规则和界面，不包含上游代码或美术。版权和 MIT 致谢见 [RULES.md](RULES.md) 与 [LICENSE](LICENSE)。

## 视觉素材与平台状态

`assets/icon.svg` 为应用图标，`release/four-spirit-valley-icon-512.png` 为 512×512 上传图标。`release/four-spirit-valley-cover-1080x1440.png` 为 AI 辅助生成的装饰封面，另保留 `release/cover.svg` 矢量母版；教程 SVG 由真实首关地图、规则引擎状态和正式渲染器生成。宣传素材留在 release/，不进入小游戏 ZIP。平台上传、审核和上线状态记录在 [DELIVERY.json](DELIVERY.json)。
