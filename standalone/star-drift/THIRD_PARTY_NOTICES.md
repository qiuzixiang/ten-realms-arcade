# 来源、署名与许可

## 规则来源

本游戏的规则原型为 **Inertia**，由 Simon Tatham 与贡献者创作，属于 [Simon Tatham's Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/)。

- 权威规则：[Inertia manual](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/inertia.html)
- 上游源码：[inertia.c](https://git.tartarus.org/?p=simon/puzzles.git;a=blob;f=inertia.c)
- 上游许可：[MIT License](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/licence.html)
- 中文规则研究参考：[ebnbin/puzzles](https://github.com/ebnbin/puzzles)，MIT License

本版本直接继承本仓库 `games/star-drift/logic.mjs` 的惯性规则实现，以提交 `374d2eee951c8f6aa0bbc829e9cceaa127596b7c` 为基线。八向滑行、能源不停车、起点作为停止格、斜向仅检查目标格，以及地雷失败优先级均保留，具体见 `RULES.md`。

## 本次独立开发

《星际漂流 · Star Drift》的 48 关独立题面、六章结构、确定性题面生成与筛选、最短解搜索与验证、中文叙事、界面、SVG 棋盘、动画、声音合成及独立持久化为本项目制作。运行时代码不加载原合集、第三方 CDN、第三方字体或第三方服务。

背景 `assets/nebula.png` 是本次使用 OpenAI ImageGen 制作的 AI 生成图像；生成方式和提示词见 `ART.md`。棋盘实体、规则状态、教学图片和图标由代码绘制，不把生成背景作为规则真值。背景与本次原创实现以本项目 MIT 许可提供；分发者须保留此说明及以下许可。

这是一款独立浏览器游戏，并非微信小游戏或微信小程序移植版本。它没有引用合集的微信桥接模块。

## 本项目完整许可

MIT License

Copyright (c) 2026 Ten Realms Arcade contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
