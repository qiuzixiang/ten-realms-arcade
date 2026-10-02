# 本地验收记录 · 2026-10-02（Asia/Shanghai）

状态：LOCAL_VALIDATED_CANDIDATE。6章60关和本地浏览器体验已验收；平台适配未获得官方容器与真机证据。

## 规则、题库与教程

- `node scripts/generate.cjs` exit 0：固定seed 20261002、生成器v1，可复现60关及证书。前20关单数字余量即可完成，后40关必须相减；同尺寸以相减步数排序。不将装饰换色当新关。
- `node scripts/test.cjs` exit 0，9组测试（release/tests.log）：512种3×3二色状态与独立方程判胜对比；oracle与独立枚举对比；角/边/中心含自身；0/null；深浅循环与清除no-op；全明确条件；无连通条件、非参考图合法胜利；60题唯一穷尽；真实合法完整重放及提示证书；错误存档、伪造完成、幂等首通；真实三图教程与classic脚本解析。
- 题库不含运行期隐藏参考答案。第二解搜索只读显示线索，生产引擎与oracle不共用邻域枚举。
- 初始版本发现一题虽唯一但提示轨迹不足，已淘汰并补上整盘提示覆盖门槛，最终所有轨迹长度等于格数。
- 教程SVG同一levelId，初始全未定、一次合法彩片循环、合法完成；元数据在release/tutorial-metadata.json。

## 浏览器生产包

`node scripts/browser.cjs` exit 0，使用本机桌面Chrome与Playwright，HTTP服务dist/xhs，注入受限CSP。release/browser-results.json记录实际指标。测试尺寸320×720、390×844、1280×720及359/360/361、759/760/761断点。全页无横向溢出，320六列最小格宽46.328125px；无页面脚本错误、无外部资源请求。

真实触摸模拟点击验证首次教程关闭、首次落片、查看模式不改存档、撤销/重做、重开确认、刷新恢复、完成、刷新完成态、完成后撤销重投首通不重复、实际格态展墙/彩釉、教程重看/Esc。用界面提示确认路径完整完成第22关25次落片，无答案注入。安全区44/34px、普通文本/按钮200%及减少动态检查无横向溢出。素材完整加载。

`node scripts/edge-browser.cjs` exit 0（release/edge-browser.log）：桌面方向键/Enter/Space/Delete/U实际操作；损坏JSON存档回退；9.46+Native存储接口模拟命中且不写浏览器存储；存储写失败显示告知。Native模拟仅证明适配逻辑，非官方容器测试。

视觉复核实际检查home-390、work-320、work-1280、gameplay-390、complete-390、cover-1080x1440。手机长盘工具与选中格预览常驻底部；棋盘和说明允许纵向滚动，未定斜纹/彩片菱形/底片短线可辨认。320长盘必须向下滚动才能看全部8行，未缩小格子。无默认拖涂。数字章与深色彩片保持强对比。

## 构建与包

- `node scripts/build.cjs` exit 0：单入口、classic外置脚本、相对本地资源。ZIP只含最终9个文件，无开发日志、源码证明、node_modules、map、账号数据或发布脚本。
- 归档1.7.0的audit_artifact.py对dist/xhs及最终ZIP各exit 0：9 files、0 warnings。该脚本只审体积/文件，不冒称规则或容器验证。
- `node scripts/compatibility.cjs` exit 0：脚本解析、已列出现代语法特征、禁止API、资源存在性扫描。ES2017源码直写，基础Grid与grid-gap，无flex-gap/clamp/aspect-ratio等唯一布局路径。
- `unzip -t` exit 0，CRC全部通过。ZIP大小和SHA256见DELIVERY.json。
- 首次Chrome默认headless-shell路径不存在，改用已安装桌面Chrome成功；未安装或下载浏览器。
- 在线规范获取curl exit28：DNS resolving timed out，HTTP 000。没有绕过网络限制，使用本地js-api快照与1.7.0归档；不声称最新在线规范已核对。

## 未覆盖

iOS Safari实体设备、Android Chrome实体设备、小红书官方模拟器与容器、Chrome/WebView61真实执行、原生存储真实持久性、真机安全区/地址栏/横竖屏、帧率/内存/启动性能及玩家难度体验。200%验证为文本尺寸模拟，不等同各系统字体设置。

本地奖励为每题首通收藏章，不提供共享宿主outbox/积分集成；本任务未改共享注册表，未做全仓合集构建或合集测试。无需平台账号即可完成本地准备；账号禁止期间未进行任何上传、审核、笔记新建/更新、GitHub推送或自动任务。

## 用量

任务精确输入/缓存/输出Token无正式可读数据，无法统计，不估算。get_usage_limits仅用于遵守窗口阈值，已读五小时窗口usedPercent 80→88；不能作为本任务Token或单任务额度消耗归因。

## 额度恢复后的终检

2026-10-02恢复同一worktree，窗口usedPercent9→11。补齐A/B两枚数字标识、公共区实线/差集虚线、真实余量相减算式，并新增独立方程与区域元数据核对测试；9组规则测试通过。最终代码再次通过9宽度生产包+CSP交互及边界浏览器检查，新增release/overlap-explanation-390.png真实截图。ZIP固定文件顺序、UTC时间戳并去除系统额外字段，后续干净检出按SHA256核对字节一致性。

补充长记录边界：4096次合法循环的存档可重放；界面到达上限后提示撤销或重开，拒绝再添加不可恢复的第4097次落笔，撤销仍可用。edge-browser新增真实加载满记录及点击/撤销回归。

## 最终干净检出交付

代码提交 `eb41340e7d181abfa84b65bfa343cce892fa06ec`，本地分支codex/tessera-mural-studio。`python3 scripts/verify-clean.py --audit-script <归档1.7.0审计脚本>` exit0（release/clean-checkout.json）：从此提交git archive只提取本游戏并删除dist，重跑generate/build/test/兼容扫描/生产包浏览器/边界浏览器/目录与ZIP审计/CRC；全部通过。重新生成levels.js及proofs.json字节一致，ZIP SHA256与提交中的候选包完全相同。临时目录已清理。文件暂存后的git diff --cached --check通过，所有提交都限于standalone/tessera-mural-studio/，未改其他游戏或共享注册表。

最终ZIP 17523 bytes，SHA256 `326d5df60dc46789d36c98c171311a2a292365758d02898aa08072124795386e`。当前额度最后检查usedPercent15、remaining85；本轮恢复检查9/11/12/14/15，仅作为阈值控制，不能归因成本轮Token。精确Token仍无法统计。
