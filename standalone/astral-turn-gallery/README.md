# 星仪回廊

4×4 Twiddle 旋转谜题；60 关、6 章。选择棋盘九个交点之一，顺/逆时针转动相邻四块，让 1–16 按行归位。

## 运行与复现

在本目录执行：

```sh
node scripts/generate.mjs
node scripts/build.mjs
node --test tests/core.test.mjs
python3 scripts/serve.py
```

打开 http://localhost:8770（生产包 + 受限 CSP）。上传包：`dist/astral-turn-gallery-xhs.zip`。
源码为 ES2017 classic 脚本，无第三方运行依赖；构建需要 Node 18+ 与 Python 3。

键盘 1–9 选择窗口，左右箭头旋转，Z 撤销。首次教程可跳过或重看。提示先解释，采用后标记辅助。偏离参考路径时只建议撤销，不强行重置。每日校准按本地日期从60关轮换。各章十关完成后解锁藏品。

存档键 `mini-polish:astral-turn-gallery:v1:save`，教程单独版本键。存档按历史重放验真。完成事件先持久化，可选 `window.astralCompletionHost(event)` 返回 true 后出队；缺失或抛错保留，按 completionId 去重。宿主接收方必须再次按 completionId 幂等处理。

素材 `release/` 包括代码绘制的原创几何图标、封面和本地笔记草稿；封面明确不是游戏截图。`scripts/artwork.py` 重建素材需要 Pillow 和 macOS 中文字体，不是运行和构建的依赖。

来源：Simon Tatham 的 Twiddle 规则；参考星盘校准局提交 `55cdddb75cf57c17baee80bac4121bd3be1687c6`。本实现重写规则及UI，保留仓库 MIT 许可。未复制上游 C 源码或美术。规则不声称原创。
