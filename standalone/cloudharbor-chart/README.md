# 云港航图 / Cloudharbor Chart

独立离线 Bridges / Hashi 游戏，六章60张已证明唯一的航图。奶油航空手帐、珐琅浮港与蓝色单双航道；小屏用港牌 → 四向最近港 → 0/1/2 精确输入，不依赖细线命中。密图只显示运力，编号在港牌和调度台中展示。

## 游玩

源码入口 `index.html`。交付入口 `dist/xhs/index.html`，候选包 `dist/cloudharbor-chart-xhs.zip`。用本地 HTTP 服务打开构建目录，例如在本目录执行：

```sh
npm run build
python3 -m http.server 4182 --directory dist/xhs
```

访问 http://127.0.0.1:4182 。离线包不需要网络，HTTP 仅用于本地验收。首页可继续航图、选关、查看旅行手册和教程。所有关卡开放，可跨章练习；每章完成10关收藏一张云域明信片。每日邮路使用设备本地日期在60题中轮换，不额外重复发首通奖励。

## 规则与体验

只连接同一行/列最近港，每边0–2条；双线在两端各贡献2。不交叉、不越港；全部运力恰好满足且全网连通才完成，允许环。超额可暂存。禁行叉仅为笔记，勾完成港不决定胜利，邻边修改取消勾选，撤销能恢复。

100步撤销、确认重开、容量推理提示、连通检查提示以及明确标注的“参考解证明一步”。提示不扣收藏，但本局不发无提示印章。三图教程由同一真实题面的初态、正式双线一步和验证完成态绘制；可跳过、关闭、重看。完成时邮艇沿真实航道遍历全部港口，系统减少动态时取消邮艇动画；声音默认关闭。

存档前缀 `mini-polish:cloudharbor-chart:v1:`。9.46+且能力存在时优先 `xhs.miniTool.getStorage/setStorage`；未注入/低版本回退浏览器存储。写失败明确提示。恢复严格校验线路、笔记、勾港和历史，重新计算完成网络，不信任完成布尔值。首通、无提示印章按关去重；完成事件先持久化，再送可选 `window.harborHost.onCompleted(payload)`，失败保留同ID，重载重试；收到确认后记录已投递。宿主应按 `completionId/rewardClaimId` 去重。本项目未接入共享宿主。

## 复现与证据

Node 18+、Python3、系统zip/unzip即可构建与规则测试，无npm安装步骤。

```sh
npm test
node tools/prove.cjs
npm run build
node tools/audit.cjs
```

`tools/generate.cjs` 是固定种子生成器；仅开发时运行 `npm run generate`，会更新题库，普通构建不生成随机题。独立 `tools/oracle.cjs` 不导入游戏引擎或参考答案；港口对可见性建模、域传播、穷尽排除第二解。题库做八种几何对称归一去重。规则测试另用小盘原始3^E枚举核对搜索。

浏览器检查：`node tools/browser-qa.cjs` 和 `node tools/boundary-qa.cjs`。需要Playwright和Chrome，设置 `PLAYWRIGHT_PATH`（包绝对路径）及 `CHROME_PATH`（可执行文件绝对路径）；脚本默认使用本机Codex提供的Playwright和已安装Chrome，不联网下载运行时。图片母版由 `tools/assets.cjs` 用原创SVG渲染，需sharp，可设 `SHARP_PATH`。

规则、ZIP、浏览器报告和真实截图在 `release/`。`viewport-*.png` 是浏览器手机模拟视口截图，其他玩法PNG为实际页面的完整滚动截图；`cover.png/icon.png` 是原创向量装饰素材，非玩法截图。见 [QA.md](QA.md)、[DELIVERY.json](DELIVERY.json)、[SOURCE.md](SOURCE.md)、[NOTE-DRAFT.md](NOTE-DRAFT.md)。

## 验收边界

本地开发、规则证明、静态包审计及现代Chrome手机/桌面模拟已完成。实体iOS/Android、小红书官方模拟器/容器、Chrome61运行与真机性能均未覆盖。在线规范获取DNS超时，按归档1.7.0包检查；manifest写1.7.0但SKILL元数据写1.6.0，原件未改。因此ZIP是本地候选包，未宣称最新在线规范/官方容器通过。

未上传、提交审核、发布或更新小红书工具/笔记，未推送GitHub。后续获授权后仍需官方模拟器、Android和iOS扫码验证同一ZIP。本轮不创建自动任务、不触碰其他游戏和共享注册表。
