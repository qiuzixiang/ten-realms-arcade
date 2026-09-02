# 量子配方馆（Keen）规则契约

- 上游规则：Simon Tatham's Portable Puzzle Collection，`upstream/main` 提交 `5a9e1795a3324e0f6433b79fbe31cbd9b12048a3` 的 `doc-zh/keen.html`；上游为 MIT License，声明见 V4 `THIRD_PARTY_NOTICES.md`。
- 主题映射：数字是量子粒子；算术笼是反应容器；填格是投放粒子。主题没有改变数字、行列或算术语义。
- 状态：4×4 格可填 0–4，0 为未投放。每行、每列的 1–4 不重复；每个反应笼的加、乘、减、除精确等于标示目标。笼内可重复数字，只要不处于同一行/列。
- 胜利：所有格非空，且所有行列与八个笼同时满足。红色冲突只是可见的规则反馈，不会成为额外失败规则。
- 固定关卡：`quantum-catalyst-04`。教程依次使用空盘、`fill:0:1`、和已验证完整解；`countSolutions` 不读取 `solution`，以限制 2 的搜索证实唯一。
- 存档与奖励：由 V4 game kit 使用 `ten-realms-v4:games:quantum-apothecary:session:v1` 与教程键；完成事件由 run ID 构成，V4 奖励宿主按稳定 event ID 去重。
