# 十境谜游馆 · Ten Realms Arcade

一个以经典逻辑规则为骨架、重新设计视觉叙事与交互手感的浏览器小游戏项目。仓库同时保留两套独立合集：根路径是原十款 **1.0**，`/v2/` 是另外十款 **2.0**。两个版本的导览、游戏进度和本地存档互不干扰。

每款游戏都有独立页面、首次进入时的三张图片教程、可跳过或重新查看的规则说明，以及通关、个人最佳、建议步数、今日首胜和连续游玩等激励。项目无运行时第三方依赖，适配手机和桌面浏览器，所有进度仅保存在当前浏览器中。

## 在线体验

- 1.0：[Vercel](https://ten-realms-arcade.vercel.app/) · [GitHub Pages](https://qiuzixiang.github.io/ten-realms-arcade/)
- 2.0：[Vercel](https://ten-realms-arcade.vercel.app/v2/) · [GitHub Pages](https://qiuzixiang.github.io/ten-realms-arcade/v2/)
- [GitHub 源码仓库](https://github.com/qiuzixiang/ten-realms-arcade)

## 1.0 · 原十款

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

## 2.0 · 新十款

| 游戏 | 规则原型 |
| --- | --- |
| [云端露营季](./v2/games/cloud-camp/) | Tents |
| [雾都照相馆](./v2/games/mist-photo-studio/) | Pattern |
| [神秘调香所](./v2/games/mystic-perfumery/) | Guess |
| [星云孵化场](./v2/games/nebula-hatchery/) | Galaxies |
| [霓虹天际线](./v2/games/neon-skyline/) | Towers |
| [极地蒸汽列车](./v2/games/polar-railway/) | Tracks |
| [四季染坊](./v2/games/season-dyehouse/) | Flood |
| [妖怪旅店](./v2/games/yokai-inn/) | Dominosa |
| [极光磁场实验室](./v2/games/aurora-magnet-lab/) | Magnets |
| [梦境旅舍](./v2/games/dream-hotel/) | Rectangles |

## 本地运行

```bash
npm run serve
```

打开 <http://localhost:4173/> 查看 1.0，或打开 <http://localhost:4173/v2/> 查看 2.0。项目不需要安装第三方包。

## 验证与构建

```bash
npm test
npm run build
```

`npm test` 同时检查两个版本的游戏清单、路径、静态资源、存档命名空间和离线预缓存边界。构建产物位于 `dist/`：1.0 保持在根目录，2.0 位于 `dist/v2/`。GitHub Actions 会在 `main` 分支更新后发布 GitHub Pages。

## 存档隔离

1.0 继续使用原有存档键，其共享成长档案为 `ten-realms:progress:v1`。2.0 的共享成长、教程状态及每款游戏的私有存档均使用 `ten-realms-v2:` 前缀；因此在同一浏览器和站点来源下游玩、重置或升级 2.0，不会覆盖 1.0 进度。

## 规则与许可

规则参考 [Simon Tatham's Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/) 及 [ebnbin/puzzles](https://github.com/ebnbin/puzzles) 的中文网页版本。主题包装、视觉资产和本仓库中的游戏实现由本项目重新制作。详细许可与署名见 [1.0 第三方声明](THIRD_PARTY_NOTICES.md) 和 [2.0 第三方声明](v2/THIRD_PARTY_NOTICES.md)。
