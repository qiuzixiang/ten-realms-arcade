# 蜜田巡界 · Honeyfield Boundaries

已完成本地独立版：6章60题、Palisade等格连通分区、精确三模式选边、三级提示、撤销/重做/重开、三图教程、田契压花与每日题库轮换、可选轻音效、存档与首通去重。泥土方格、矮木篱、奶油标签、压花纸地图均由原生SVG/CSS绘制。

源码隔离于本目录，Git分支 codex/honeyfield-boundaries；未修改共享注册表或其他游戏。LICENSE/THIRD_PARTY_NOTICES.md保留许可和来源。

```sh
cd standalone/honeyfield-boundaries
npm run generate
npm run build
npm test
npm run audit
npm run qa:browser
```

Node 24执行构建/测试；zip/unzip与xmllint用于包门禁。无安装依赖的产品运行时。审计使用Node内置Acorn作ES2017解析；浏览器测试用本机已装Chrome与Codex捆绑Playwright（可设置 HONEY_CHROME、HONEY_PLAYWRIGHT）。浏览器检查自动起本地HTTP服务，服务最终dist/xhs并注入受限CSP。直接预览可用 `python3 -m http.server 8767 --directory dist/xhs`，打开 http://127.0.0.1:8767/ 。

规则和题库见RULES.md；证据见QA.md及release/。前三章30道题面以14种可唯一确定的4×4田形为底，通过不同线索组合递进；每章无重复田形，60题按分区与线索的旋转镜像归一化去重。所有题独立证明唯一，并有无猜测推理链；不宣称60种全新田形或最优路线。

320px下棋盘288px，6×6格命中48px；所有尺寸统一先点格，再点四个48px方向边按钮。外框显示锁、禁用。墙/无墙/擦除为明确模式；双圈描出最后选边。键盘方向选格、Shift+方向设边、1/2/0切模式、Z/Y撤销重做。页面正常纵滚，工具不覆盖棋盘。

候选包：dist/honeyfield-boundaries-xhs-candidate.zip。按本地minitool-zip-builder1.7.0资料审计（归档SKILL内部metadata仍写1.6.0，已如实记录）。在线文档DNS超时，本轮没有确认最新规范；普通Chrome与原生存储mock不等于小红书容器验收。本包仅local candidate，不称platform-ready。创服平台模拟器、Android真机扫码、iOS真机扫码、旧Chrome61内核均未覆盖；应在账号限制解除且另获发布授权后验证。本轮严格没有上传、审核、笔记新建更新、GitHub推送或自动任务。

本地宣传材料：release/cover.png是正式renderer在浏览器实际渲染的题面封面；game/complete/tutorial等PNG为真实运行截图。assets/farm.svg为明确标注的装饰地图，不作题解。NOTE-DRAFT.md只是本地笔记，无“点击小工具游玩”的可用挂载承诺。
