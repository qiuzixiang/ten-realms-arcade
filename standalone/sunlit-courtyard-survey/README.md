# 光庭测绘 · Sunlit Courtyard Survey

本地独立版，6章48关。奶白建筑平面、珊瑚边黑屏与蓝色测绘线；完成后可观察由真实布局生成的低矮庭院，并切回平面。规则为Range / Kurodoko / Kuromasu，详见[RULES.md](RULES.md)。源码全部自包含，未改合集注册表、其他游戏或共享模块。

当前状态：**本地规则、候选包、桌面浏览器模拟验收通过**。不是platform-ready，未上传、提交审核、发布笔记或推送GitHub。实体iOS/Android、官方小工具模拟器及当前在线规范未验证。

## 构建与运行

在本目录使用Node.js 18+、Python 3、系统zip；没有运行时npm依赖：

```sh
node scripts/generate.mjs
node scripts/assets.mjs
node scripts/build.mjs
node --test tests/*.test.mjs
python3 platform/audit_artifact.py dist/xhs
python3 platform/audit_artifact.py dist/sunlit-courtyard-survey-candidate.zip
node scripts/clean-check.mjs
python3 -m http.server 4176 --directory dist/xhs
```

浏览器打开 http://127.0.0.1:4176/ 。必须服务 `dist/xhs/`，根源码入口不是运行包。ZIP根直接为index.html、classic app.js、本地CSS/图像与许可；没有module、CDN、联网、Worker或Service Worker。

浏览器自动验证需已有Playwright与Chrome，通过 `COURTYARD_PLAYWRIGHT`（包路径）和 `COURTYARD_CHROME`（可执行文件）指定；默认使用本机Codex捆绑Playwright和已装Chrome，脚本不安装依赖：

```sh
node scripts/browser-qa.mjs
node scripts/storage-browser-qa.mjs
node scripts/release-assets.mjs
```

它们分别验证生产包交互和视口、按公开API契约模拟存储失败/重试、导出原生矢量封面与真实截图组合。普通浏览器与API mock均不代表小红书容器验证。

## 结构与证明

- core.mjs：生产射线、正交连通、状态与动作；session.mjs / storage.mjs：重放存档、奖励台账、串行落盘与原生存储适配。
- scripts/oracle.mjs：不导入生产引擎、不读取答案；逐行/逐列区间计算，独立矩阵BFS、黑格配对检查与二色搜索。继续排除第二解，截断不算证明。
- scripts/generate.mjs：固定seed、版本、D4布局去重；前三章先读光与间距，第四章使用真实断连反例，第五章和收官组合桥格与长臂。
- levels.mjs / release/level-proofs.json：48题及clueHash、解、穷尽标记、推理链和成本。所有题均能用已认证推理链解出，没有猜测或最优操作序列宣称；难度为设计标签，未做外部玩家研究。
- view.mjs / assets/tutorial-{1,2,3}.svg：同一题的真实初态、合法一次放黑与完成态。完成态仍有未加白点的白格。首页装饰模型没有题面数字。
- release/：真实游戏/教程/完成/收藏截图、1080×1440封面、512图标、本地笔记和QA报告；图片不是平台发布物。

窄屏普通字号使用独立滚动的测绘区与常驻工具区，最大6列在320px为46px格、390px为54px格。200%字号保留46px格并改为整页纵向滚动。数字标签在模型体块后绘制，避免遮屏盖住数字。图像均为原生SVG/真实截图，无AI位图或假实机图。

私有存档键 `mini-polish:sunlit-courtyard-survey:v1:save`；教程单独版本。9.46+且注入公开Storage API时优先原生存储，否则用Web存储。失败显示重试，不清空其他游戏，不在原生写入失败时暗中切换存储。读取失败先保护旧记录；可选宿主失败保留同一事件重试。认证档案有界，重放后重新计算积分与收藏。

来源基线、MIT许可和致谢见[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)与[LICENSE](LICENSE)。[QA.md](QA.md)记录验收边界，[DELIVERY.json](DELIVERY.json)记录真实路径和产物hash。精确任务Token无法从正式工具取得，记录为无法统计，不将账户百分比当作Token。
