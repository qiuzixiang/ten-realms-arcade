# 红线绮梦馆 · Scarlet Knot Atlas

自包含 Untangle 主题逻辑游戏，六章48关。玩家挪动铜边纸签，让所有没有共同逻辑端点的直朱线互不接触。T接触、共线重叠、不同签号端点重合均计入交叉，同ID共端点边对豁免。判胜依据正式点位，不依赖内置答案；不承诺唯一或最优摆法。

**交付状态：本地候选通过规则、包审计和现代Chrome浏览器验收；不是平台ready。** 未推送GitHub，未上传/审核小红书工具，未创建或更新平台笔记。

## 本地游玩与构建

在本目录使用 Node 24 / Python 3 / 系统zip，无需 npm install：

```sh
npm run generate
npm test
npm run prove
npm run build
npm run audit
python3 -m http.server 4183 --bind 127.0.0.1 --directory dist/xhs
```

浏览器打开 `http://127.0.0.1:4183/`。源码入口 index.html 同样可用HTTP服务，但验收针对 dist/xhs 生产目录。

候选ZIP：`dist/scarlet-knot-atlas-xhs.zip`，根目录只有一个 index.html，经典外置 app.js，本地CSS与资源。源码classic ES2017编写，规则oracle/generator仅为离线开发工具，不进入ZIP。构建不修改任何其他游戏或注册表；输出与源码分离。

自动浏览器检查需要本机Chrome及Playwright（已提供可用的bundled路径）：

```sh
npm run qa:browser
npm run qa:boundary
```

不同机器可设置 PLAYWRIGHT_PATH / CHROME_PATH。包审计默认使用已归档1.7.0脚本，可用 MINITOOL_AUDIT 指向同版 audit_artifact.py。这些测试依赖先构建；普通构建和规则测试没有额外npm依赖。

## 主线与交互

每章8封，两封引导、四封迁移、两封综合。章节目标依次为邻边影响、两个相接循环图块、回环外轮廓、多个关节点、非对称多图块、三图块综合归册。48图两两不互相同构；第五章排除非恒等图自同构。正式难度标签是设计目标，不宣称已由真实玩家测得。

拖动预览实时更新；松手提交一次，取消恢复不计步。坐标输入在 inclusive [0,1]，正式引擎拒绝越界；指针映射在案面留边后的坐标夹取。密集命中先选择签号，所有节点可用44px方向按钮或键盘微调，Shift更细。支持提示、撤销、重开、存档恢复、声音开关、减少动态。交叉总数是边对数，不是不同交点数。

三卡教程来自同一题真实初态、一次合法移动和完成态，交叉数1/1/0；使用正式renderer生成，首次可跳过、随时重看。声明几何容差 EPS=1e-10，用于浮点近共线判断；独立整数BigInt参数法oracle不共享该算法。

## 存档、收藏与奖励

私有前缀 `mini-polish:scarlet-knot-atlas:v1:`。会话从初态重放动作验证；图鉴也验证真实完成布局。每关首通claim一次，复玩和撤销不重复领奖。个人记录保留移动次数及完成时间，不是最少步数榜。

检测客户端9.46+且有对应API时优先 xhs.miniTool Storage；未注入或版本不足才回退 localStorage。异步写串行，失败会提示，不删除其他游戏存档。教程已读键与账本分别处理，教程写成功不能掩盖账本失败。

可选本地宿主接口 `window.ScarletRewardHost(payload)`：返回Promise/true确认；payload含 gameId / levelId / graphVersion / runId / completionId / claimId / reward / moves。宿主必须按claimId去重。先持久化ledger/outbox再投递；失败或1800ms超时保留同ID，后续保存/打开时重试。晚到的回执只合并claim确认，不能覆盖新的游戏会话。默认没有宿主，不做外部投递或联网。

## 证据、素材与限制

QA.md、DELIVERY.json、release/*-proofs.json、generation.json、tutorial-truth.json、browser-qa.json、boundary-qa.json、package-audit.json和independent-review.md记录实际证据。release/clean-check.json确认提交dd0a46f的干净源码归档重建ZIP与候选包逐字节一致。

封面 release/cover.webp（1080×1440）为ImageGen辅助馆景插画；release/imagegen-source.json保存最终提示词。运行图 assets/hall.webp（720×960）。图标为原创SVG及512/64pxPNG。教程SVG与960×960导出PNG来自正式renderer。其他 release/*game* / *complete* / collection* / tutorial-*-390.png 是生产包真实浏览器截图，手机尺寸模拟，不冒充实体手机。

未覆盖：最新线上平台规则（单次DNS超时）、官方创服模拟器、小红书真机容器、实体iOS/Android、Chrome61实际引擎、真实设备性能/亮度/系统字体设置。需在后续获授权且账号可用时，对同一个ZIP完成官方模拟器和Android/iOS扫码验证；目前全部上传和发布暂停。

规则/代码来源与许可见SOURCE.md、LICENSE、THIRD_PARTY_NOTICES.md，许可也随ZIP保留在app.js与assets/licenses.json。精确任务Token无法从正式账户百分比工具取得，未估算；ImageGen图片Token与成本同样未披露。
