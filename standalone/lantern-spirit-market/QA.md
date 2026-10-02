# 灯灵夜归市 · 本地验收

日期：2026-10-01（Asia/Shanghai）。源码最终位于专属worktree，来源基线55cdddb75cf57c17baee80bac4121bd3be1687c6，分支codex/lantern-spirit-market。没有修改根构建、共享注册表或其他游戏。最初工作暂存于主工作区本游戏目录，补读共用合同后迁入worktree，逐文件hash比对成功并移除了原暂存目录。

## 实际命令与结果

| 命令 | 退出码 / 结果 | 证据 |
|---|---|---|
| `node --test tests/*.test.mjs` | 0，11/11通过 | release/core-test.log |
| `node tools/generate.mjs` | 0，固定seed筛得60题 | level-review.json，levels.js |
| `node tools/build.mjs` | 0，9个白名单运行文件 | release/build-report.json |
| `node tools/audit.mjs` | 0，所有经典JS经Acorn按ES2017解析，本地引用完整 | release/static-audit.json |
| `node tools/browser-qa.mjs` | 0，320×720、390×844、1280×720矩阵通过 | release/browser-report.json |
| `node tools/edge-qa.mjs` | 0，9个宽度、安全区、60盘与异常路径通过 | release/edge-report.json |
| minitool缓存 `audit_artifact.py dist/xhs` | 0，9文件、0警告 | release/package-audit.log |
| 同脚本审计最终ZIP | 0，9文件、0警告 | release/package-audit.log |
| 无dist的临时干净目录重建及运行测试 | 0，运行文件hash一致、ZIP字节一致 | release/clean-build-report.json |
| `git diff --check` / 最终暂存检查 | 0 | 本地源码检查 |

浏览器使用本机Google Chrome无头模式，Playwright1.62.1；Node24.13.0、Python3.13.1；Acorn8.18.0。测试依赖只用于开发，不进入ZIP。`tools/serve.py`注入受限CSP：脚本仅self、connect/worker/frame/object均none；runtime为外置经典脚本，无fetch、CDN、桥接发布API或Service Worker。外部运行请求0、控制台错误0。这里是普通浏览器与CSP模拟，不能代替官方容器验收。

## 规则与题库

独立union-find oracle发现完整最大分量，独立底部优先列序列模型验证下落与左并；枚举729个2×3双类含空盘，核对每个合法移动。覆盖对角、单只no-op、两只0分、只读预览、无连消、空盘优先、零清盘加分。

60条主线见证逐步由独立模型回放至空盘，分数逐项一致，颜色重命名规范去重无重复。第3至6章每题有至少一次移除后的最大群增长，以及至少一个经完整搜索证明无清盘路线的首步；所标陷阱再次用独立无预算截断DFS核验。最后10题每题有两条得分不同的合法清盘路线。第21题验证了“小群先行、当前最大群可能断路”的代表条件，第60题284/274两条路线均清空。没有将贪心失败或截断宣称为无解，没有标唯一、满分或最优。

固定教程通过共享tutorial.js与正式引擎复算：初盘4×2，两只圆灯预览+0；移除后上方灯灵下落；移除葫芦列使方灯列左并；最终0只、2分、3次送行。三张教程截图为真实页面，不是绘制的假棋盘。

题库是确定性搜索筛选与章节特征复核，未声称60题全部由人工从零排布。六章逐步引入组、重力、保留连接、小群换大群、五类、得分比较；每题实际难度仍带个人差异，不使用搜索节点数冒充玩家难度。

## 存档、奖励与异常

恢复重放路径，不信任注入score/status/claim；坏路径回退，合法路径的分数重新计算。首通奖励按关卡claim去重，重复完成、撤销后重做和刷新不重复领取。个人最好成绩必须以合法清盘路径证明。

平台9.46+且Storage能力完整时优先原生缓存，版本或能力不满足时回退localStorage。模拟接口验证了原生优先、按快照串行写入、旧客户端回退、失败反馈；读失败不覆盖旧数据。原生Storage在官方容器未实测。没有外部奖励宿主或事件投递，因此无虚构outbox投递成功记录。

实际浏览器走过首次教程、三张看完、跳过/关闭、重看、Esc、真实预览确认、撤销、重开、清盘、再清同题、reload恢复。重复confirm只完成一手；动作中重开后旧回调不能改新盘；真实卡住盘仍可撤销。键盘Arrow/Enter/Esc已测，触摸方式由Pointer交互实现，实体触控未覆盖。

## 视觉与手机

320/390/1280截图已查看，纸纹、灯灵剪影、群外轮廓、确认区、真实空摊架、教程均正常。关键断点449/450/451与799/800/801测试，加320、390、1280；上下44/34px安全区变量注入。页面scrollWidth不超过clientWidth。最大盘7×8完整显示；小格盘作为概览，群组卡至少48px高且锚点明确，禁止小格直接落子。手机工具栏固定，选群后确认区滚到工具栏上方；测试确认按钮底边在工具栏顶边之前。所有主按钮至少48px。

主文字对比11.78:1，奶油底文字13.80:1，朱红按钮5.98:1，辅助正文7.31:1。五类使用形状+颜色，不只靠颜色区分。CSS采用基础Grid/Flex/margin与定位回退，不依赖flex-gap或clamp。减弱动态有相同规则反馈。

## 规范与未覆盖项

已读取本地命名为1.7.0的规范包及所需references；归档SHA256为8bd0f4fde976ec3e9784bebc9fd8d16270769c129b39098698fc58572716c305。其SKILL元数据仍标1.6.0，js-api.md注明2026-09-23快照。在线规范获取尝试DNS解析超时，curl28、HTTP000，不能声称核验了最新规范。按缓存契约做本地候选包审计，最终不标平台ready。

未覆盖：创服平台官方模拟器；Android与iOS实体扫码容器；iOS Safari/Android Chrome实体触控；真实Chrome/WebView61运行；真机帧率、内存与容器缓存生命周期；最新线上规范。账号暂停期间不上传、不审核提交、不发布笔记、不更新平台；不推送GitHub。恢复后应先在官方模拟器，再Android与iOS扫码验证同一ZIP，发现差异再修。

用量：没有可用的本任务正式token统计接口，本次实际token、图像或费用无法统计；不以账户额度百分比或估算替代。未调用ImageGen。
