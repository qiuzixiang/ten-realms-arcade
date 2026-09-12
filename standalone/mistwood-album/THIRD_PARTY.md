# 规则、代码与素材来源

- 本独立版由 Ten Realms Arcade 的 `v2/games/mist-photo-studio` 玩法发展而来，保留其显影 / 排除 / 未知三态和全格明确的完成要求。只读源版本：`374d2eee951c8f6aa0bbc829e9cceaa127596b7c`。来源项目 MIT 全文保存在本目录 `LICENSE`，并以 `assets/license.json` 进入离线 ZIP。
- Pattern / Nonogram 规则参考 Simon Tatham’s Portable Puzzle Collection：<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/pattern.html>。上游集合来源 <https://git.tartarus.org/?p=simon/puzzles.git>，中文规则参考项目 <https://github.com/ebnbin/puzzles>；以上均为 MIT 项目，本次未打包它们的 C / WASM / 图像代码资产。
- 本次独立规则实现、双求解器、60 张点阵图案、界面、存档、教程生成、暗房插画、图标、封面与中文文案为本目录新开发，按同一 MIT 许可提供。无在线字体、CDN、第三方人物照片或 AI 生成图片。
- 原创矢量画 `assets/room.svg` 和 `assets/icon.svg` 可由 `scripts/make-art.mjs` 复现。宣传封面明确标为插画，不充当真实游戏截图。实际游玩截图来自最终 dist/xhs，在 QA.md 和 DELIVERY.json 中注明浏览器模拟设备边界。
- 构建只用 Node 标准库和系统 ZIP 工具；Playwright / Sharp 仅用于本地验收与素材生成，不进入游戏运行包。
