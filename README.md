# 十境谜游馆 · Ten Realms Arcade

一个以经典逻辑规则为骨架、重新设计视觉叙事与交互手感的浏览器小游戏项目。仓库保留四个相互隔离的十款合集：根路径是初代 **1.0**，`/v2/` 是可稳定回退的 **2.0**，`/v3/` 是第三批 **3.0**，`/v4/` 是最新 **4.0**。各版本的导览、教程、奖励、离线缓存与本地进度互不覆盖。

每款游戏都包含首次自动弹出的三步图片教程（元素、一次合法操作、真实通关状态），可跳过或随时重看；同时提供首次通关、个人最佳、效率线、徽章、今日首胜与连游等不重复刷分的激励。项目没有运行时第三方依赖，支持手机与桌面浏览器，所有进度仅保存在当前浏览器。

## 在线体验

- 1.0：[Vercel](https://ten-realms-arcade.vercel.app/) · [GitHub Pages](https://qiuzixiang.github.io/ten-realms-arcade/)
- 2.0：[Vercel](https://ten-realms-arcade.vercel.app/v2/) · [GitHub Pages](https://qiuzixiang.github.io/ten-realms-arcade/v2/)
- 3.0：[Vercel](https://ten-realms-arcade.vercel.app/v3/) · [GitHub Pages](https://qiuzixiang.github.io/ten-realms-arcade/v3/)
- 4.0：[Vercel](https://ten-realms-arcade.vercel.app/v4/) · [GitHub Pages](https://qiuzixiang.github.io/ten-realms-arcade/v4/)
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

## 2.0 · 第二批十款

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

## 3.0 · 第三批十款

前五款来自原 2.5 扩展的后半批，后五款为本次新改编；它们现在作为完整独立的 3.0 版本发布。

| 游戏 | 规则原型 |
| --- | --- |
| [时砂邮路局](./v3/games/time-sand-post/) | Signpost |
| [熔心泄压站](./v3/games/molten-core-vent/) | Slant |
| [纸鹤归巢台](./v3/games/paper-crane-sanctuary/) | Pegs |
| [万象共振钟房](./v3/games/resonance-bell-room/) | Flip |
| [四灵栖境署](./v3/games/four-spirit-habitat/) | Map |
| [星盘校准局](./v3/games/star-dial-bureau/) | Twiddle |
| [星屑勘测站](./v3/games/stardust-survey/) | Mines |
| [珊瑚孢群培育所](./v3/games/coral-bloom-lab/) | Filling |
| [蚀光巡检署](./v3/games/eclipse-watch/) | Range |
| [天象壁画修复室](./v3/games/celestial-mural/) | Mosaic |

历史 `v2.5.0` 标签保留，可用于还原当时的十五款扩展快照；常规访问请使用稳定的 `/v2/` 与 `/v3/` 十款入口。

## 4.0 · 第四批十款

| 游戏 | 规则原型 | 新主题 |
| --- | --- | --- |
| [时序货舱](./v4/games/time-cargo-bay/) | Fifteen | 在时序货柜间滑动货物，恢复装卸序列 |
| [量子配方馆](./v4/games/quantum-apothecary/) | Keen | 调整粒子配方，使反应笼与行列同时成立 |
| [月潮结界](./v4/games/lunar-tide-seal/) | Loopy | 依据月潮刻印织出唯一闭合的封印环 |
| [轨道编队调度](./v4/games/orbital-formation/) | Netslide | 轮换轨道编队，让能量网络完整连通 |
| [群岛边防署](./v4/games/archipelago-guard/) | Palisade | 在海图上划分连续、等编制的巡防区 |
| [影印净化室](./v4/games/shadow-print-lab/) | Singles | 用遮罩消除重复印记，并保留连通白纸 |
| [环轨星图台](./v4/games/orbit-atlas/) | Sixteen | 旋转星轨，校准四行四列的星图顺序 |
| [星图档案院](./v4/games/stellar-archive/) | Solo | 修复每行、列和星区都完整的档案星图 |
| [天平阶梯庭](./v4/games/balance-terrace/) | Unequal | 让阶石的行列与高低刻印同时平衡 |
| [昼夜织机](./v4/games/daynight-loom/) | Unruly | 编织昼夜纹样，保持均衡且没有三连 |

## 本地运行

```bash
npm run serve
```

打开 <http://localhost:4173/> 查看 1.0，<http://localhost:4173/v2/> 查看 2.0，<http://localhost:4173/v3/> 查看 3.0，或打开 <http://localhost:4173/v4/> 查看 4.0。

## 验证与构建

```bash
npm test
npm run build
```

`npm test` 会校验四套入口、各十款注册表、规则测试、真实三卡教程、资源路径、存档命名空间和离线缓存边界。构建产物位于 `dist/`：1.0 位于根目录，2.0 位于 `dist/v2/`，3.0 位于 `dist/v3/`，4.0 位于 `dist/v4/`。GitHub Actions 在 `main` 更新后会发布 GitHub Pages，并对 Pages 与 Vercel 的四个 scope 进行线上烟测。

## 存档与缓存隔离

- 1.0 延续原存档键，共享成长档案为 `ten-realms:progress:v1`。
- 2.0 继续使用 `ten-realms-v2:` 前缀，保留前十款的既有进度。
- 3.0 仅使用 `ten-realms-v3:` 前缀，绝不读取、覆盖或清理 V2 存档。
- 4.0 仅使用 `ten-realms-v4:` 前缀；每局完成事件进入持久 outbox，奖励宿主暂不可用时会在下次进入安全重试。

四个版本各有独立 Service Worker scope 与预缓存清单；根 Service Worker 会绕过 `/v2/`、`/v3/`、`/v4/`，因此不会以初代离线页面替代后续版本。

## 规则与许可

规则参考 [Simon Tatham's Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/) 及 [ebnbin/puzzles](https://github.com/ebnbin/puzzles) 的中文网页版本。4.0 固定参考 `ebnbin/puzzles` 的指定提交，详情见 [4.0 规则契约](v4/RULES.md)。主题包装、视觉资产和本仓库中的游戏实现均为本项目重新制作。详细许可与署名见 [1.0 第三方声明](THIRD_PARTY_NOTICES.md)、[2.0 第三方声明](v2/THIRD_PARTY_NOTICES.md)、[3.0 第三方声明](v3/THIRD_PARTY_NOTICES.md) 与 [4.0 第三方声明](v4/THIRD_PARTY_NOTICES.md)。
