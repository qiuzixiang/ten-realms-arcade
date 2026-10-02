# 灯灵夜归市

独立、纯本地的 Same Game 谜题。6章60关；清空摊架才算完成。厚纸丝网夜市、五种原创陶灯剪影、整群预览、先下落后左并、生活收藏册。网站和小工具候选包使用同一经典脚本运行时，不依赖共享注册表。

## 游玩

通过 HTTP 服务打开 `dist/xhs/index.html`。主线依次解锁，清盘即可过关；参考分不代表最优。首次教程可跳过、随时重看。7列窄屏用带锚点坐标的群组卡精确选群；确认前不改盘。手机撤销、提示和重开固定于底部。键盘方向键移动焦点，Enter预览/确认，Esc取消或关闭教程。

存档键：`mini-polish:lantern-spirit-market:v1:save`。存档以关卡固定初盘与动作路径重放；成绩和完成状态重新计算。首通claim按关卡去重，个人纪录仅保留更高的经验证清盘成绩。平台9.46+且缓存能力可用时优先使用小工具Storage；其他环境使用浏览器localStorage。异步写入串行化，完成结果先保存再显示，读取失败时不覆盖旧存档。没有外部宿主或奖励投递通道。关闭页面保留进度，存储失败显示提醒；教程标记升级不清进度。

## 命令

在本目录运行，Node 18+ / Python 3（没有运行时安装步骤）：

```sh
node --test tests/*.test.mjs
node tools/generate.mjs
node tools/build.mjs
python3 tools/serve.py
```

`generate`是开发期复现题库的命令，通常无须运行。`build`只将明确白名单文件放进本游戏 `dist/xhs/`，ZIP入口直接位于根目录。源码不使用ES2018+语法，运行时不联网。构建脚本只操作本游戏的产物。

浏览器QA依赖Playwright和本机Chrome；ES2017审计依赖Acorn。可安装package.json的devDependencies，或通过 `LANTERN_PLAYWRIGHT` / `LANTERN_ACORN` 指向已安装的包。`LANTERN_BROWSER`可指定Chrome可执行路径。启动4180端口受限CSP测试服务后运行：

```sh
node tools/audit.mjs
node tools/browser-qa.mjs
node tools/edge-qa.mjs
```

实测环境与命令结果在 `QA.md`；截图、JSON报告在 `release/`。测试脚本默认使用本机已有依赖路径，跨机器请设置上述环境变量。

## 关卡与证据

题库来自确定性搜索筛选，并经章节特征复核；不是照搬来源的竖直色段生成器。`level-review.json`保存每题清盘参考、形成较大群的步数、已证无解的首步和可比较路线。第3至6章均有汇合与陷阱；最后10题都有不同得分的两条清盘路径。测试采用独立union-find连通模型、底部优先列序列模型，独立回放60题，并完整搜索核验所标陷阱；不宣称唯一或最优。

三个代表摊局：教程固定局（两只0分、真实下落与左并）；第21摊（小群先行，最大群可能断路）；第60摊（清盘参考284分，另一合法清盘路线274分）。教学与策略事实可从题库复算。

## 交付边界

源码、离线候选ZIP、本地截图及笔记已准备。创服平台模拟器、Android和iOS实体扫码、Chrome61实际运行与真机性能尚未验证。小红书工具上传、审核、笔记发布与GitHub推送均未执行。账号暂停期间不进行任何平台写入。

版权、规则来源及原创资产见 `THIRD_PARTY_NOTICES.md`、`ART.md`。最终状态与产物hash见 `DELIVERY.json`。
