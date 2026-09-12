# 来源与许可

- 玩法原型：Tents。规则参考 Simon Tatham’s Portable Puzzle Collection：[Tents 文档](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/tents.html)，[项目](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/)。上游项目采用 MIT 许可。本目录没有复制其 C 源码、二进制或美术。
- 本项目来源：`v2/games/cloud-camp`，读取时仓库 HEAD `374d2eee951c8f6aa0bbc829e9cceaa127596b7c`。保留 `Copyright (c) 2026 Ten Realms Arcade contributors` 及完整 MIT 文本于本目录 `LICENSE`，离线 ZIP 内亦有 `license.json`。
- 新实现：独立规则引擎、增广路径匹配、第二解搜索器、确定性关卡筛选、界面、存档、中文文案和真实三图教程。
- 美术：本项目原创代码原生 SVG 裁纸风景、树与帐篷符号。没有外部图片、字体、音频或生成图片模型素材。细节与再生成方法见 `ART.md`。
- 截图：`*.jpg` 均来自本游戏最终构建的真实浏览器页面；`storage-failure.jpg` 来自本地故障注入验收页，不用于宣传。
- `scripts/audit_artifact.py` 来自用户指定的小红书打包技能 1.6.0，仅作为本地检查辅助，不进入上传包。ZIP 使用本地 classic JavaScript、CSS、SVG 与许可 JSON，不包含 Node 或其他运行依赖。

公开规则和上游实现的贡献不被声称为本项目首创。本目录原创代码与美术按所附 MIT 许可使用。
