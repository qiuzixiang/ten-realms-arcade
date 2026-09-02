# Ten Realms Arcade 3.0 · Third-party notices

本文件适用于仓库中的 `/v3/` 独立十款合集。

## 规则参考与上游致谢

3.0 的谜题规则主要参考 **Simon Tatham's Portable Puzzle Collection**，该合集由 Simon Tatham 及贡献者维护，以 MIT License 发布：

- 项目与游戏文档：<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/>
- 上游源码：<https://git.tartarus.org/?p=simon/puzzles.git>
- MIT 许可文本：<https://git.tartarus.org/?p=simon/puzzles.git;a=blob;f=LICENCE>

中文规则文档与网页版研究还参考 **ebnbin/puzzles**，该项目以 MIT License 发布。3.0 新增游戏固定审计快照为 `ebnbin/puzzles@5a9e1795a3324e0f6433b79fbe31cbd9b12048a3`：

- 项目：<https://github.com/ebnbin/puzzles>
- MIT 许可文本：<https://github.com/ebnbin/puzzles/blob/main/LICENSE>
- 规则文档与参考实现：`doc-zh/<原型>.html`、`vendor/sgtpuzzles/<原型>.c`、`src/games/<原型>.ts`

本版规则原型为 Signpost、Slant、Pegs、Flip、Map、Twiddle、Mines、Filling、Range 与 Mosaic。所有规则逻辑都由本项目依据公开规则独立重做；主题、界面、文案、动画与视觉素材均为本项目自制，不捆绑或再分发上游源码、可执行文件或美术资产。

## 特定谜题的原始署名

- **Signpost / Pfeilpfad**（`/v3/games/time-sand-post/`）：原谜题 Pfeilpfad 归功于 **Janko**；**James Harvey** 将其以 Signpost 名称贡献给 Portable Puzzle Collection。
- **Filling / Fillomino**（`/v3/games/coral-bloom-lab/`）：规则源流归功于 **Nikoli**；Filling 由 **Jonas Kölker** 贡献给 Portable Puzzle Collection。
- **Range / Kurodoko**（`/v3/games/eclipse-watch/`）：规则源流归功于 **Nikoli**；Range 由 **Jonas Kölker** 贡献给 Portable Puzzle Collection。
- **Mines / Minesweeper**（`/v3/games/stardust-survey/`）：经典扫雷玩法因 Windows 而广为人知；本项目采用 Portable Puzzle Collection 的公开 Mines 规则与“默认可推理、无需猜测”生成约定，仅作独立实现，不复用上游代码或美术。
- **Mosaic**（`/v3/games/celestial-mural/`）：Mosaic 由 **Didi Kohen** 贡献给 Portable Puzzle Collection，配色设计归功于 **Michal Shomer**；本项目只依据已确认 MIT 的上游规则参考重新实现，不复用外部项目代码或美术。
- **Twiddle**（`/v3/games/star-dial-bureau/`）：仅采用 Portable Puzzle Collection 的公开旋转规则；本项目不使用其文档中提及的任何其他作品名称、角色或美术。

## 本项目许可

除非某个资产旁另有说明，`/v3/` 中本项目原创的代码、主题、界面、动画和素材均依本仓库的 [MIT License](../LICENSE) 发布。
