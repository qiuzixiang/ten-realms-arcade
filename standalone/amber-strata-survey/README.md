# 琥珀勘探队

一款可独立运行的浅砂地层扫雷游戏：六章 60 关认证主线、任意起点的自由练习、三图真题教程、三级推理提示、显式确认的合并探测、本机进度与标本册。

在仓库根目录运行 `python3 -m http.server 4173`，打开 `http://localhost:4173/standalone/amber-strata-survey/`。无需安装运行依赖。源码、题库、测试与构建脚本都只在本目录。

验证与离线候选包：

```bash
node --test standalone/amber-strata-survey/tests.mjs
node standalone/amber-strata-survey/build.mjs
```

构建生成 `dist/xhs/index.html`、`app.js`、`styles.css` 和根入口 ZIP `dist/amber-strata-survey-xhs.zip`。ZIP 仅为本地候选产物；小红书在线文档在 2026-09-29 访问超时，当前依据本地 1.7.0 快照实现并完成静态审计与普通浏览器检查。创服平台模拟器、Android 与 iOS 真机容器均尚未验收，上传或发布前须逐项实测并重新核对在线规范。

本目录没有修改根注册表、共享 UI、根构建或其他游戏。独立游戏的本机键前缀为 `mini-polish:amber-strata-survey:v1:`。较新小红书客户端可用时优先读写小工具 Storage API；低版本和普通浏览器使用 `localStorage`。存储失败会提示，数据不跨设备同步。

关卡生成器 `generate.mjs` 固定随机种子并筛选独立棋盘；重新运行会覆盖本目录的 `levels.mjs`，应在需要重制题库时使用。现有 60 关的准入证据由 `tests.mjs` 在干净检出上重新验证。
