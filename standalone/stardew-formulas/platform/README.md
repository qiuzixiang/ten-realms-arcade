# 平台基线核验

开发日期：2026-09-20（北京时间）。

已读取项目存档的 minitool-zip-builder 1.6.0：ZIP 结构、设备能力、JS、CSS、跨端和性能参考。没有 Native 桥接需求，不引入平台桥。

历史官方地址：https://fe-static.xhscdn.com/mini-tool/20260831163932/minitool-zip-builder-1.6.0.skill

本轮尝试重新下载时 DNS 解析超时；**未确认当前最新版或当前上传门槛**。使用项目 `docs/five-games-20260913-prep/platform/` 中既有缓存副本。`audit_artifact.py` 是此归档中的体积审计脚本，只检查结构/体积，不证明运行兼容。

实际运行包为经典外置 JS、ES2017；没有联网、Worker、SW、动态执行或外部依赖。CSS 使用基础 Grid、grid-gap、普通 margin、百分比比例盒；safe area 有普通 padding 回退。

未实测 Chrome 61 / Android 8.1、iOS Safari 或小红书实体容器。后续上传前仍须核对当时规范和设备表现。

缓存 SHA-256：`29c04115fd89d7eab7b81775f4287ae20c569ad3794d25d8404dc0ec3ec3b65e`。
