# 朱陶阶庭 · 来源与素材声明

规则为 Unequal / Futoshiki：行列拉丁方与显式严格大小关系。参考 Simon Tatham’s Portable Puzzle Collection，Unequal 由 James Harvey 贡献。

- 规则：https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/unequal.html
- 上游：https://git.tartarus.org/?p=simon/puzzles.git
- 中文研究参考：ebnbin/puzzles，固定快照 5a9e1795a3324e0f6433b79fbe31cbd9b12048a3，https://github.com/ebnbin/puzzles
- 本地来源：小游戏-five-release/v4/games/balance-terrace，提交 55cdddb75cf57c17baee80bac4121bd3be1687c6；原 logic.mjs SHA256 615022afd0a9426066ac525019de38ea3c1190ff7ae1bf4ec90f22882d11ccce。

本项目依据公开规则独立扩展并重写引擎、题库生成、独立oracle、界面、教程、存档。没有捆绑上游 C/TS 实现或其美术。项目原创代码与素材沿用仓库 MIT LICENSE，完整许可随源码和离线包 licenses.json 保留。

图标、首页庭院、结算陶庭、棋盘与九张教程 SVG 都由本项目代码原生绘制；教程与实际游戏共享坐标、刻印和状态映射。封面及截图从实际构建页面获得，封面明确区分原创场景装饰与真实浏览器模拟画面。本次未使用 imagegen、外部字体或下载美术素材。

minitool 规范归档包 manifest 为 1.7.0（SKILL.md YAML 遗留 1.6.0）；原包 SHA256 8bd0f4fde976ec3e9784bebc9fd8d16270769c129b39098698fc58572716c305。本任务只把其规范与审计脚本作为构建参考，不捆绑为运行依赖。2026-10-02 在线规范获取失败（DNS 超时），按 2026-09-23 本地 API 快照使用 9.46+ Storage 检测与 Web 存储降级；不声称当前线上合规或 platform-ready。
