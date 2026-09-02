# 星图档案院（Solo）规则契约

- 上游规则：Simon Tatham's Portable Puzzle Collection，固定来源提交 `5a9e1795a3324e0f6433b79fbe31cbd9b12048a3` 的 `doc-zh/solo.html`，MIT License（V4 第三方声明中保留）。
- 主题映射：数字是星标编号，2×2 宫是档案星区，给定数是不可修改的馆藏索引。没有引入额外的对角线、Killer 或 jigsaw 规则。
- 真值：每行、每列和每个 2×2 星区都恰有 1、2、3、4 各一次。馆藏格固定；空格和冲突不是完成状态。
- 固定关卡：`catalogue-orion-04`，6 个馆藏星标。`countSolutions` 从 givens 开始且不读取 `solution`，以第二解上限证明唯一。
- 教程：空档案 → `fill:1:2` → 已验证解；三个 SVG 都写明真实关卡、状态与动作。存档、教程版本和完成奖励由 V4 game kit 的独立命名空间与 run event ID 管理。
