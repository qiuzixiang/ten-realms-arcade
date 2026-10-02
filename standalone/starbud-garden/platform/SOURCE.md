# 规范核验记录

2026-09-22，在已登录小红书创作服务平台的“上传小工具”表单读取当前口令，仍指定：
https://fe-static.xhscdn.com/mini-tool/20260831163932/minitool-zip-builder-1.6.0.skill

重新 curl 下载因 DNS 解析 30 秒超时。使用本项目 2026-09-13 保存的同版本归档，并读取/核对 SKILL.md 及 HTML/ZIP、设备能力、JS、CSS、跨端、性能、JSBridge 参考；没有声称重新下载成功。
SHA256: 29c04115fd89d7eab7b81775f4287ae20c569ad3794d25d8404dc0ec3ec3b65e
归档路径已列出检查，仅解出规范与审计脚本到本游戏目录。

另于 2026-09-22 从当前平台链接读取在线能力清单：
https://miniapp-sandbox.xiaohongshu.com/minitool/doc
该页标注最后更新 2026-09-10，新增 getLaunchOptions、9.46.0 起 Storage JS API 及持久化降级要求。实现按此较新官方文档支持存储接口，其他包格式维持当前口令 1.6.0 基线。未使用发笔记/相册/摄像头/麦克风接口。

当前上传表单：名称和简介各最多14字，图标 png/jpg/jpeg ≤5MB、推荐1:1，ZIP ≤10MB。协议表单名称为《小工具发布安全规范》，链接与用户授权的《小工具服务协议》完全相同：
https://agree.xiaohongshu.com/h5/terms/ZXXY20260630004/-1
用户本轮已明确授权发布及勾选此链接对应协议。
