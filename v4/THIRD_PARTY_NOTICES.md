# Ten Realms Arcade 4.0 · Third-party notices

本文件适用于仓库中的 `/v4/` 独立十款合集。

## 规则参考与上游致谢

4.0 的谜题规则主要参考 **Simon Tatham's Portable Puzzle Collection**，该合集由 Simon Tatham 及贡献者维护，以 MIT License 发布：

- 项目与游戏文档：<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/>
- 上游源码：<https://git.tartarus.org/?p=simon/puzzles.git>
- MIT 许可文本：<https://git.tartarus.org/?p=simon/puzzles.git;a=blob;f=LICENCE>

中文规则文档与网页版研究还参考 **ebnbin/puzzles**，该项目以 MIT License 发布。4.0 新增游戏固定审计快照为 `ebnbin/puzzles@5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`：

- 项目：<https://github.com/ebnbin/puzzles>
- MIT 许可文本：<https://github.com/ebnbin/puzzles/blob/main/LICENSE>
- 规则文档与参考实现：`doc-zh/<原型>.html`、`vendor/sgtpuzzles/<原型>.c`、`src/games/<原型>.ts`

本版规则原型为 Fifteen、Keen、Loopy、Netslide、Palisade、Singles、Sixteen、Solo、Unequal 与 Unruly。所有规则逻辑都由本项目依据公开规则独立重做；主题、界面、文案、动画与视觉素材均为本项目自制，不捆绑或再分发上游源码、可执行文件或美术资产。

## 特定谜题的原始署名

- **Loopy / Slitherlink**（`/v4/games/lunar-tide-seal/`）：基本创意归功于 **Nikoli**；**Mike Pinna** 贡献初版，**Lambros Lambrou** 扩展多网格支持。
- **Netslide**（`/v4/games/orbital-formation/`）：由 **Richard Boulton** 贡献给 Portable Puzzle Collection。
- **Palisade / Five Cells**（`/v4/games/archipelago-guard/`）：规则源流归功于 **Nikoli**；Palisade 由 **Jonas Kölker** 贡献。
- **Singles / Hitori**（`/v4/games/shadow-print-lab/`）：规则源流归功于 **Nikoli**；Singles 由 **James Harvey** 贡献。
- **Solo / Sudoku**（`/v4/games/stellar-archive/`）：规则源流归功于 **Nikoli**；现代 Sudoku 形式通常署名 **Howard Garns**。
- **Unequal / Futoshiki**（`/v4/games/balance-terrace/`）：由 **James Harvey** 贡献给 Portable Puzzle Collection。
- **Unruly / Tohu wa Vohu**（`/v4/games/daynight-loom/`）：由 **Adolfo Zanellati** 发明；**Lennard Sprong** 贡献实现。

## 本项目许可

除非某个资产旁另有说明，`/v4/` 中本项目原创的代码、主题、界面、动画和素材均依本仓库的 [MIT License](../LICENSE) 发布。
