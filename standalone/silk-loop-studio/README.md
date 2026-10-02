# 彩绸回环 / silk-loop-studio

自包含 Sixteen 主题游戏：4×4 无空位数字织台，整行整列循环平移归序。六章48关，12块策略收藏，真实三图教程，行／列模式＋1–4编号＋方向按钮，键盘 R/C、1–4、方向键、Z/Y。提示、可暂停回放、撤销／重做／重开、目标底稿、静音／减少动态、自动保存与首通去重均已实现。

当前状态 **LOCAL_VERIFIED_CANDIDATE**。普通 Chromium 模拟已通过；不是 platform-ready。当前在线规范、官方模拟器、iOS／Android 真机与小红书容器均未验证。没有上传、推送或发布。

在本目录执行（Node 18+、系统 zip/unzip、Python 3；核心无第三方 npm 依赖）：

```sh
node scripts/assets.cjs
node scripts/generate.cjs
node --test tests/*.test.cjs
node scripts/build.cjs
node scripts/audit.cjs
python3 platform/audit_artifact.py dist/xhs
python3 platform/audit_artifact.py dist/silk-loop-studio-xhs.zip
node scripts/contrast.cjs
```

浏览器验证和封面渲染另需已安装 Playwright 与 Chrome。可配置 SILK_NODE_MODULES 指向包目录、SILK_CHROME 指向 Chrome 可执行文件。本机默认路径是已提供的工作区依赖与 /Applications/Google Chrome.app；没有安装新的运行时或浏览器。

```sh
node scripts/browser.cjs
node scripts/promotional.cjs
python3 -m http.server 4173 --directory dist/xhs
```

访问 http://127.0.0.1:4173。候选包为 dist/silk-loop-studio-xhs.zip，唯一根 index.html、本地 classic 脚本，无共享注册表或仓库资源依赖。源码模块通过私有全局命名空间连接，无打包器转译；直接使用 ES2017 和 Chrome61 基础 CSS。构建把完整 MIT 与来源声明写进 license.json。

来源固定提交 55cdddb75cf57c17baee80bac4121bd3be1687c6，原型 v4/games/orbit-atlas；细节见 THIRD_PARTY_NOTICES.md、RULES.md。题库生成 seed 只作可复现元数据，不宣传随机无限关。D4＋环面平移去重，独立坐标表示证明每个参考解可解；未声明最短／唯一。原计划第03关的单行简例会与第01/02关在镜像下重复，正式第03关改为两行回入，保留单轴学习目标。

release/ 保存真实最终包截图、封面、图标、关卡证明、静态审计、对比度、浏览器报告及本地用量记录；封面是原创 SVG 场景渲染，真实教程来自正式棋盘渲染器，均没有 AI 位图或假实机图。NOTE-DRAFT.md 仅是本地稿。平台侧验证需未来在账号问题解除并获得授权后进行。

存档在本游戏私有键；缓存不保证永久存在。历史上限4096操作，存储超过900000字符或读写失败会提示；不会向宿主投递未持久化结算。没有适用于当前环境的宿主时，仅做本地结算。可选宿主按 eventId 幂等处理，返回 true 确认收妥。
