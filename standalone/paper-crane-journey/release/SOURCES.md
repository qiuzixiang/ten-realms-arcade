# 纸鹤归旅 · 素材、规则与许可出处

## 规则原型

规则采用经典单人跳棋 **Pegs**：横竖跳过一个相邻棋子，落到紧接其后的空位并移走被跨棋子；任意位置仅剩一子即胜。

- Simon Tatham’s Portable Puzzle Collection，由 Simon Tatham 与贡献者维护：[项目入口](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/)。
- [Pegs 官方规则](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/pegs.html)。
- [上游 MIT 许可](https://git.tartarus.org/?p=simon/puzzles.git;a=blob;f=LICENCE)。
- 中文规则与实现研究固定快照：`ebnbin/puzzles@5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`。
- [固定快照中文规则](https://github.com/ebnbin/puzzles/blob/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/doc-zh/pegs.html)。
- [固定快照参考实现](https://github.com/ebnbin/puzzles/blob/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/vendor/sgtpuzzles/pegs.c)。
- [ebnbin/puzzles MIT 许可](https://github.com/ebnbin/puzzles/blob/5a9e1795a3324e0f6433b79fbe31cbd9b12048a3/LICENSE)。

本独立版来自仓库 `v3/games/paper-crane-sanctuary` 的已确认规则契约；新规则引擎、关卡、界面及美术按公开规则重新实现。本包不包含 Simon Tatham 上游运行时代码、可执行文件或第三方美术。题库保留反向生成的合法解，并正向重放验证可解，不声称解法唯一。

## 自制素材

| 素材 | 来源与用途 |
| --- | --- |
| `src/art.js` 中纸鹤、莲叶 SVG | 本次开发以矢量路径原创；与游戏 DOM 共用 |
| `assets/tutorial-1.svg` | `crane-001` 的真实初始状态，4 只纸鹤 |
| `assets/tutorial-2.svg` | 同一关通过正式引擎执行 `solution[0]` 后的状态，3 只纸鹤 |
| `assets/tutorial-3.svg` | 同一关通过正式引擎重放全部解答后的完成状态，1 只纸鹤 |
| `assets/cover.svg` | 原创庭院宣传插画，1600 × 900，无文字；不作为棋局或教程证据 |
| `assets/icon.svg` / `release/icon.svg` | 原创 512 × 512 图标母版 |
| `release/cover.svg` | 原创 1080 × 1440 中文宣传封面母版 |
| PNG 图标、封面 | 上述 SVG 在本地转码，不额外使用图片生成模型或远程素材 |
| 实际游玩截图 | 最终生产构建在真实浏览器中操作后截图，尺寸与覆盖范围以 `QA.md` 为准 |

矢量母版由 `node scripts/generate-art.mjs` 可重现生成。三张教程均包含 `data-level`、`data-level-id`、`data-seed`、`data-state`、`data-count`、`data-moves`、`data-move`、`data-won`，每个棋格与纸鹤还有索引标记。`tests/tutorial.test.mjs` 独立重放状态并解析 XML，检查数量、位置、动作与完成条件。教程图片不依赖中文字体；中文说明由游戏 DOM 呈现。宣传封面使用系统中文字形，不打包或再分发商业字体。

## 本项目许可

本目录自制代码、文字和视觉素材沿用原仓库 MIT License，版权声明保留如下。上游规则和研究项目的版权与许可仍分别归原作者。

```text
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
```
