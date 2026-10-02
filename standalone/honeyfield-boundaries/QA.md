# 本地验收记录 · 2026-10-02（Asia/Shanghai）

状态：LOCAL_VERIFIED_CANDIDATE。6章60题，全部独立唯一证明；本地源码、玩法与候选ZIP验收完成。不称platform-ready。没有外部发布或共享合集集成。

| 命令 | 最终结果 | 证据 |
|---|---|---|
| npm run generate | exit 0，固定seed生成60题，分区+线索D4无重复 | release/level-proofs.json |
| npm run build | exit 0，classic ES2017，本地13文件 | dist/xhs、候选ZIP |
| npm test | exit 0，5706断言、60穷尽唯一证明、117完整4×4分区 | release/rules-report.json |
| npm run audit | exit 0，0错误/0警告，ES2017解析/路径/XML/CRC | release/package-audit.json |
| npm run qa:browser | exit 0，8条功能记录，0 JS异常/0外部请求 | release/browser-report.json |
| node scripts/reproduce.mjs | exit 0，新建空目录从源码重新生成/构建/测试/审计；题库与运行文件字节一致 | release/reproducibility.json |
| git diff --check | exit 0 | 本地提交前终检 |

命令运行目录为本游戏隔离目录。没有对其他游戏做全仓修改/重构；全仓测试不属于该独立候选包验收，后续合集集成由协调者单独执行。

规则覆盖：固定外框计数；null与0；正交/对角边界；未知与无墙等价通行；合法/非法/相同值编辑；局部线索全对但格数错；线索与格数均对但同区内有冗余墙；区域数由总格数/K导出；撤销/重做；参考解和推理链；教程同题初态→一动作→完成态与正式renderer逐字相符。独立oracle只接受参数和线索，连通K格集精确覆盖搜索穷尽到唯一，不读取参考答案。

题库递进：前三章线索数依次14–16、10–13、8–10；第四章5×5线索18–22；第五章6×6线索27–31；第六章22–26。容量与田形共同边推理用量上升，见chapter-metrics.json。第24关确含折角区；第55关36格分为六个连通六格区。4×4全体117分区归一化仅22田形，其中14种全线索唯一；前三章重访部分田形，但不同线索形成不同约束题面，每章内部10种不同田形。未进行真实玩家难度校准，不承诺全程易懂或最佳路线。

Chrome实际版本见browser-report.json。HTTP服务最终dist/xhs，并注入default-src none、script-src self、connect-src none等受限CSP。320×720、390×844、1280×720分别保存首页、章节、游玩、结算、收藏及教程三卡真实PNG；另测479/480/481及799/800/801断点两侧。无横滚；320棋盘288、6×6命中48；方向按钮48；模式按钮≥48。密集边统一先选格再四向输入，不创建重叠边热区。桌面键盘真实完成首关，手机触摸模拟完成首关，并测试6×6四方向精确设边、撤销/重做、刷新runId与状态一致。

存档/奖励覆盖：损坏当前局保留有效完成证明；伪造完成布尔值不被信任；另一个游戏哨兵键不变；第一次完成只发一张田契，刷新与重开同题不重复发；提示第三级和示范不奖励。localStorage不可用仍可操作且显示保存失败。按9.46+原生Storage API快照模拟串行读写；可选宿主在持久化后收到claimId，首次拒绝后的重试使用同ID，确认后不再重复发送。模拟不是官方桥接实测。

收藏全解锁画面从60题逐边重放、引擎核验和同一settlement函数生成的测试存档加载；不是手填completed布尔。release/collection-unlocked-390.png及detail图标示测试进度。宣传封面release/cover.png使用正式浏览器实际renderer，1080×1440；不冒充实体设备截图。assets/farm.svg是装饰无数字地图，不是可判定题面。

视觉检查查看了窄屏/桌面游戏、教程完成图、结算、收藏与封面：数字平坦标签清楚，木篱实线稳定；最后选边有双圈，墙数超额同时有!符号及文字。六张花型轮廓不同。已修复装饰SVG内线默认黑填色；未围合诊断不再把合法探索说成必须修错；重绘保留键盘焦点。大字、减少动态下布局可用；无自动发声。正文与关键线条对比结果见release/contrast-report.json。

离线门禁：13文件、ZIP 39872 bytes（低于2MiB建议）、解压415171 bytes，无网络、模块、内联JS、Worker/SW、iframe/object、eval/WASM、外部资源；入口在根、所有资源相对路径，许可在licenses.json。1.7.0归档package版本已核对，但SKILL内部metadata仍为1.6.0，未擅改资料。

未覆盖：在线规范DNS请求20秒后失败（curl exit28，HTTP000）；最新规范、官方创服模拟器、小红书真实容器、Android与iOS实体设备扫码、Chrome61旧内核运行、安全区/地址栏/横竖屏实机行为、真实低端性能与色觉模拟均未验证。账号限制期间不上传、不提交审核、不新建更新笔记。应在解除限制且另获授权后对同一ZIP完成官方模拟器、Android和iOS扫码验证，再判断平台状态。

Token：无法统计。本任务未得到精确Token数据，共享账户百分比不能归因；窗口中途变化也不能作差估算。release/usage-account-snapshot.json保存正式工具账户快照与这个限制。本任务没有购买额度、使用重置券、创建自动任务或发消息到其他对话。
