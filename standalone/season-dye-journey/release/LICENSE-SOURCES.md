# 来源与许可

本作：四季染旅 / season-dye-journey / 1.0.0。

规则参考来自 Flood：
- Simon Tatham’s Portable Puzzle Collection：https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/flood.html
- Simon Tatham 上游代码：https://git.tartarus.org/?p=simon/puzzles.git
- 上游 MIT 许可证：https://git.tartarus.org/?p=simon/puzzles.git;a=blob;f=LICENCE
- ebnbin/puzzles 中文规则：https://puzzles.ebnbin.dev/doc/zh/flood.html
- ebnbin/puzzles：https://github.com/ebnbin/puzzles （MIT）

直接项目参考：v2/games/season-dyehouse/，读取时主项目提交 374d2eee951c8f6aa0bbc829e9cceaa127596b7c。原实现可能含未提交更新；具体读取文件 SHA-256 见 RULES.md。保留根目录 LICENSE：Copyright (c) 2026 Ten Realms Arcade contributors，MIT License。

本独立版重新实现与划分 Flood 引擎、可复现72关、存档/结算、界面和截图构建；上游规则作者与参考网页不代表为本作背书。没有捆绑上游 C/TS 代码、第三方可执行程序或美术图片。

美术：8 张可编辑 SVG 工坊/章节/图标由本项目原创制作，详见 ART-SOURCES.md；三个教程状态通过本作引擎重放并由共享渲染器生成 SVG，再导出 PNG。不是生成模型猜绘的规则图。截图均来自本作最终构建、在真实 Chrome 浏览器中实际操作。

字体：系统字体栈，不分发字体文件。运行时无第三方 npm 库。作者工具使用 Node.js、Sharp/librsvg 与 Playwright/Chrome，但这些依赖不进入小工具 ZIP。

小工具 ZIP 内含 licenses.json，保留本项目完整 MIT 许可文本和规则来源。宣传插画为氛围画面，不承担教程或规则状态证明。
