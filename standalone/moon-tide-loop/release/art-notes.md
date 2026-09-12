# 月潮回环 · 美术说明

本包的 `assets/coast.svg` 与 `assets/icon.svg` 为 2026 年 9 月 8 日专门为《月潮回环》手工编写的原创 SVG 矢量美术，未调用图像生成模型，未引用外部图库、字体、图片或第三方图标。所有形状、颜色、构图、渐变和水纹均在本地 SVG 文件中定义；没有外链、脚本、动画或网络依赖。

- `coast.svg`：1200 × 1000；靛蓝夜海、银月、远岸灯塔、细线潮纹与珊瑚群岛。主景位于右半，左上留标题空间，432px 以下渐隐至 `#101f30`，方便承接首页卡片。建议宽屏使用 `background-position: center top`；窄屏使用 `background-position: 68% top`，并使背景渲染高度至少 500px，以保持月与岛的关系。若只显示顶部 360px，可按宽高保持比例缩放，不要把月轮独立拉伸。
- `icon.svg`：512 × 512；无文字，银月、珊瑚岛与单一闭合潮线，四周保留安全区，适合导出 PNG 后用作小红书小工具图标。深色圆角底已包含在图中。

图标与海岸画是装饰性世界观资产，不是 Slitherlink 题面，也不作为教程、解法或规则正确性证据。闭合潮线用于传达游戏的视觉主题；正式数字、点、边与完成态必须由游戏引擎绘制。

SVG 使用原生路径、形状、渐变和内部复用；没有滤镜或位图嵌入。建议将 SVG 光栅化至至少 512px PNG，并在最终页面的 320px、390px 与桌面视口检查实际裁切。美术单文件检查与最终页面验收应分别记录，单看原图不能替代页面视觉 QA。

## 本次素材检查

2026-09-08：两张 SVG 均经 Python XML 解析通过，画布分别为 `0 0 1200 1000` 与 `0 0 512 512`。静态检查确认没有外部 URL 或脚本。通过独立的 `127.0.0.1:4389` 本地服务在 Codex In-app Browser 实际打开并查看两张原图；月轮、珊瑚分枝、潮线、渐变和内部复用均正常显示，无 XML 错误。此检查覆盖素材本身，不覆盖主游戏页面的响应式裁切、PNG 导出或小红书真机显示。

## 许可

原创美术以 MIT License 授权，与本游戏项目一同分发时请保留本说明。

Copyright (c) 2026 月潮回环 contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
