# 十境谜游馆 · Ten Realms Arcade

十款以经典逻辑规则为骨架、重新设计视觉叙事与交互手感的浏览器小游戏。十个世界现已全部开放；每款游戏都是独立页面，无运行时依赖，适合手机和桌面浏览器，也可以直接部署到 GitHub Pages。

每款游戏首次进入都会显示三张专属图片教程，可随时跳过或从游戏内重新打开。十款游戏共享本机“境界值”成长档案：首次通关、刷新个人最佳、达到建议步数、今日首胜与连续游玩都会获得 XP，并逐步解锁本境徽章和全馆称号。所有进度仅保存在当前浏览器中，无需登录。

## 在线体验

- [Vercel 正式站](https://ten-realms-arcade.vercel.app/)
- [GitHub Pages 镜像](https://qiuzixiang.github.io/ten-realms-arcade/)
- [GitHub 源码仓库](https://github.com/qiuzixiang/ten-realms-arcade)

| 游戏 | 规则原型 | 新主题 |
| --- | --- | --- |
| [星滞回收局](./games/star-drift/) | Inertia | 在残骸区利用惯性收回能源芯 |
| [记忆方舟](./games/memory-ark/) | Cube | 滚动遗迹核心，交换并收集记忆符印 |
| [月老红线事务所](./games/red-thread-office/) | Untangle | 挪动角色，解开全部红线交点 |
| [夜庭萤火](./games/firefly-garden/) | Light Up | 安放萤火精灵，点亮整座花庭 |
| [深海回声站](./games/abyss-echo/) | Black Box | 根据声呐吸收、偏折与回声定位隐物 |
| [风暴灯塔网](./games/storm-lanterns/) | Net | 旋转航标模块，为全部灯塔接通能量 |
| [夜市精灵撤离](./games/night-market-spirits/) | Same Game | 成群送走灯灵，在闭市前清空摊位 |
| [云海航路](./games/sky-bridges/) | Bridges | 用单双航线连通全部浮空港 |
| [灵龙巡脉](./games/spirit-dragon/) | Pearl | 遵循天地珠律铺成唯一龙脉闭环 |
| [镜影大剧院](./games/mirror-theatre/) | Undead | 借镜面视线安排三类演员的位置 |

## 本地运行

```bash
npm run serve
```

打开 <http://localhost:4173>。项目不需要安装第三方包。

## 验证与构建

```bash
npm test
npm run build
```

构建产物在 `dist/`。构建会将十款游戏的页面、逻辑、样式和图像全部加入离线预缓存；GitHub Actions 会在 `main` 分支更新后自动发布 GitHub Pages。

## 规则与许可

规则参考 [Simon Tatham's Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/) 及 [ebnbin/puzzles](https://github.com/ebnbin/puzzles) 的中文网页版本。原项目和本项目均采用 MIT License；详细致谢见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
