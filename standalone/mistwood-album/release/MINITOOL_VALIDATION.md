# minitool-zip-builder 1.6.0 复核摘要

范围：当前 worktree 的 standalone/mistwood-album。已重新校验、修复并打包，未上传或对外发布。

## 技能来源

用户提供地址：https://fe-static.xhscdn.com/mini-tool/20260831163932/minitool-zip-builder-1.6.0.skill

本次两次下载尝试均未成功：Could not resolve host / Resolving timed out。已实际读取本机现存 `/tmp/codex-minitool-1.6.0/minitool-zip-builder/SKILL.md`（声明版本 1.6.0）及其六份相关规范。无法重新确认远程包与本地副本的逐字节一致性，未伪称远程读取成功。本游戏不调用 Native JSBridge，所以 jsbridge-api 为不适用。

## 本次修复

- 为主页、棋盘页和模态补齐顶部安全区，保留普通 CSS padding 回退；额外验证 320×720 下顶部 44px、底部 34px 的注入安全区。
- 图鉴由一次绘制全部收藏改为每页 12 张，满 60 张时分为 5 页；验证分页顺序、末页按钮边界。关卡、奖励和存档语义未变。
- 浏览器测试通过 HTTP 测试响应注入受限 CSP：classic 外置脚本、禁止 connect-src、iframe/object/Worker，允许本地资源和必要的行内样式。此 CSP 仅在测试器设置，未向产物写 CSP meta。

## 校验结果

| 项目 | 结果 |
| --- | --- |
| npm test | 37/37 通过，0 失败 |
| npm run build | 通过 |
| 构建产物结构/能力/兼容性静态检查 | 26 项通过 |
| npm run qa:browser | 53 项通过，Chrome 152.0.7977.77，移动触控模拟 |
| 技能 audit_artifact.py：dist/xhs | PASS: 10 file(s), 0 warning(s) |
| 技能 audit_artifact.py：最终 ZIP | PASS: 10 file(s), 0 warning(s) |
| unzip -t | 所有条目 CRC/解压检查通过 |
| 扩展禁用 API 扫描 / SVG XML | 通过 |
| git diff --check | 通过 |

入口 index.html 位于 ZIP 根；全包 10 个文件，仅使用允许后缀；资源本地相对引用，classic app.js，无模块、内联脚本、外部请求、动态代码、Worker、站外跳转或开发垃圾。没有 Base64、音视频、WebGL 或大型静态数据库。CSS 使用 Chrome 61 基础 Grid 的 grid-gap 与 Flex margin；现代 accent-color 仅装饰原生复选框，不是核心交互依赖。

最终 ZIP：`dist/mistwood-album-xhs.zip`，**38,363 bytes（约 37.46 KiB）**，远低于 10 MiB 上限。未修改本 worktree 的其他游戏或根共享文件。

生产浏览器检查覆盖 320×720、390×844、1280×720 及断点，教程/跳过/提示/真实通关/撤销/重开/刷新/幂等奖励/精确输入均通过。完整列表见 browser-qa.json。`gallery-full-390.png` 是由引擎合法完成日志构造的满收藏压力场景，仅用于 QA，不作为手动逐关通关宣传证据。

## 产物与复现

- 目录入口：`dist/xhs/index.html`
- 上传包：`dist/mistwood-album-xhs.zip`
- 全交付清单：`DELIVERY.json`
- 运行：本游戏目录 `npm run serve`，打开 http://127.0.0.1:4283
- 重建：`npm test` → `npm run build` → `npm run qa:browser`
- 技能审计：`python3 /tmp/codex-minitool-1.6.0/minitool-zip-builder/scripts/audit_artifact.py dist/xhs`，再将末参数换成 ZIP 路径。

实体 iOS/Android、小红书容器/PC模拟器、Chrome61 实际内核仍未实测；真实硬件性能、长期存储回收没有测试数据。此结果是本地离线包准备与浏览器校验，不代表平台审核通过。

## 已读取技能文件 SHA-256

- `SKILL.md`: `a2bfeef8484bd7b8009723c6712b04fc784551e14ecbfcce9bf0009e8a9fa85e`
- `references/zip-artifact-spec.md`: `32acec0f75414292bdaba7036f61e5f3f70cbce18747c5ea0a09ba9044c1deb3`
- `references/device-capabilities.md`: `634231ca02c91ff40632a4a83ca31dc816cdc6e075eec12e30498253f16af292`
- `references/js-compatibility.md`: `5b518dc0478b8be7ec57d0a6cd128d67e6611c31c5e2837f7e26f78e7f35ad35`
- `references/css-compatibility.md`: `6e94a99bb5d48805fd09444e8af8b9a6e9d4c0fdd4639242bdc65fbcf5fa11eb`
- `references/cross-platform-h5.md`: `e0cf76f2d037e9b267c08d6112b0f35e6fb34210c9d0e9deebd1e4058f50d344`
- `references/performance-budget.md`: `993baf9ebb268a9a40c9888d70e5977d80966686ced41dfa7e35a05c5c398feb`
