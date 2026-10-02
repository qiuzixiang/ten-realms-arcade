# 规则、源码与素材来源

Same Game规则研究参考Simon Tatham及其贡献者的Portable Puzzle Collection（MIT）：
https://www.chiark.greenend.org.uk/~sgtatham/puzzles/
https://git.tartarus.org/?p=simon/puzzles.git

中文规则研究参考ebnbin/puzzles（MIT）：https://github.com/ebnbin/puzzles

项目来源games/night-market-spirits，固定来源提交55cdddb75cf57c17baee80bac4121bd3be1687c6，原logic.mjs SHA256为5520a02b30850b17de90d796c3e37ec19e5a057bdb88ac17f6fd940e27044569。未复制第三方位图、字体或上游C代码。本款采用新的纯JS引擎、独立oracle、筛选题库和原创SVG/CSS主题；新代码和资产按本目录LICENSE的MIT条款提供。

规则见RULES.md，游玩页面侧栏展示正式规则。LICENSE完整文本和来源说明同时保留在候选ZIP的index.html注释中。开发测试用Playwright（Apache-2.0）与Acorn（MIT），依赖不进入运行包；正式产品无运行库依赖。
