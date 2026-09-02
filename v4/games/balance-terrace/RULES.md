# 天平阶梯庭（Unequal / Futoshiki）规则契约

- 上游规则：Simon Tatham's Portable Puzzle Collection，来源固定为提交 `5a9e1795a3324e0f6433b79fbe31cbd9b12048a3` 的 `doc-zh/unequal.html`；许可证为 MIT（V4 第三方声明）。
- 主题映射：数字是 1–4 阶石，`<`/`>` 是阶梯庭高低刻印。横向刻印直接写比较号；纵向刻印尖端面向较小值、开口面向较大值。
- 真值：每行和每列都使用 1、2、3、4 各一次；仅十道显示的相邻大小关系必须满足。没有上游的 Adjacent 模式，也没有未显示边的隐含相邻约束。
- 固定关卡：`terrace-equilibrium-04`，无 givens、10 条真实不等式。`countSolutions` 独立枚举拉丁方与关系，截断上限为 2，证实唯一。
- 教程：真实空盘 → `fill:0:1` → 真实解。V4 game kit 提供本地存档、教程已读与按 run ID 去重的完成事件；奖励宿主只接受稳定 event ID。
