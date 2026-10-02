# minitool-zip-builder 1.7.0 本地规范

2026-09-25 按用户提醒，从本机下载目录归档 `minitool-zip-builder-1.7.0.skill`。另一份同名带 `(1)` 的下载文件 SHA-256 相同。归档原包的 SHA-256：`8bd0f4fde976ec3e9784bebc9fd8d16270769c129b39098698fc58572716c305`。

包内 `skill-package.json` 声明版本 **1.7.0**；包内 `SKILL.md` 的 YAML `metadata.version` 仍写 **1.6.0**，属于原包内部标记不一致，未擅自修改原件。判断本次规范包版本以包名和 package manifest 为准；若平台在线文档与本地包不同，以当前在线文档为准。

相对 1.6.0，本包新增 `references/js-api.md` 作为 2026-09-23 端 API 快照，要求任务开始时优先核对小工具在线文档及能力替代关系；更新了端能力、存储及打包自检措辞。ZIP 结构、体积和兼容性要求仍需逐条按 1.7.0 的 references 与当前平台文档核对。打包后的普通浏览器运行不等同于平台模拟器、Android 和 iOS 真机验证。此处仅归档规范，并未据此重打包或重审历史小工具。

历史 1.6.0 规范保留在 `docs/five-games-20260913-prep/platform/`，用于解释当时的交付记录，不能作为新包当前规范。
