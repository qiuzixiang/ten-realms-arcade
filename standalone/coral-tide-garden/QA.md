# 验收记录 — 2026-09-21

通过：

- 从提交 f4e8f27 使用 git archive 导出本目录到空的 .clean-verification，npm run build → npm test → npm run audit 全通过；未携带原有 dist。

- `node --test tests/*.test.mjs`：9 项测试，60题独立唯一性与D4去重，625种2×2状态独立对照。
- `node scripts/build.mjs` → `node scripts/audit.mjs`：7个运行文件；经典脚本、零远端依赖、CRC、禁止能力扫描、体积通过。
- `python3 platform/audit_artifact.py dist/coral-tide-garden-xhs.zip`：7文件，0警告。
- Chrome真实操作：教程三步/跳过、固定格拒绝修改、候选不计步、正式落笔、撤销/刷新恢复、键盘完成首关、刷新首通不重复。
- 内嵌浏览器生产包：点击完成首关，刷新图鉴1/60；教程三张真实截图；6×6窄屏检查；控制台无error。
- 320×720、390×844、1280×720及390/700断点两侧：无横向溢出；最窄6×6格宽44.33px、高44px。中间尺寸允许纵向滚动。详细实测 release/viewport-checks.json。
- 限制 CSP 的真实生产页面，script-src self / connect-src none / frame、worker、object禁用：界面与选关成功，无控制台错误。复现 `node scripts/serve.mjs`，端口42186。

平台时效：已在当前上传表单核对仍提供minitool-zip-builder 1.6.0、ZIP最大10MB。网络下载DNS超时，使用项目缓存相同版本。归档 SHA256：29c04115fd89d7eab7b81775f4287ae20c569ad3794d25d8404dc0ec3ec3b65e。

未覆盖：实体iOS/Android、小红书手机容器、Chrome61真机、真实玩家难度/留存、独立第二位审查者、平台审核通过与公开访问。现代语法静态扫描不等同Chrome61实际执行。无共享集成改动，未执行合集全仓测试/根构建。

已知范围：题库按空白量/容量/棋盘/求解成本递进，尚未按真人表现校准。每海域图鉴展示已完成数量和一张真实完成棋盘，不是无限生态生成。进度存在浏览器本机，换设备不互通。

补充平台验收（2026-09-21 10:20）：上传部署成功，小红书PC模拟器正常加载教程、跳过后首关实际通关，图鉴为1/60。发布提交成功，当前审核中；真机依旧未覆盖。
