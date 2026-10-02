# 新开一局修复 · 2026-09-07

## 原因
复古布局移除了 record-note 元素，但 renderStats 仍对其写 textContent，产生 TypeError。startNew 首先调用 settleAnimation → render → renderStats，因此生成新局前被异常中断。主动新局与结束重开均受影响。旧页面浏览器日志和基于实际 HTML 的 UI 回归测试都复现了该空元素错误。

## 改动
- 删除对已移除 record-note 的写入，不新增隐藏占位元素。
- 将按钮和设置事件统一使用 addEventListener。
- 随机种子接口增加异常降级，兼容暴露 crypto 但禁止调用的 WebView；原版局内 LCG、计分与移动速度不变。
- 新局清理残留触摸手势。

## 验证
- npm test：29/29 通过；新增测试覆盖主动重开确认/取消、零步直接重开、结束重开、172 分纪录更新、存储写入及 crypto 异常。
- 实际本地页面：主动新局后 5 球、0 分、0 步，国王纪录 170。
- 独立浏览器测试页：由生成的 app.js 设置一个明确的结束测试状态，启用只允许同源脚本的 CSP；点击“再来一局”后 5 球、0 分、0 步、国王纪录 172，无控制台错误。该测试状态及页面不包含在交付包中。
- 平台包审计：2 files、0 warnings；根目录为 index.html 和 app.js。
- 尚未上传小红书、尚未在小红书真机验证。

## 交付
winlinez-restart-fix-20260907.zip
SHA-256: 86d17bcdfae2525f7de37031e5f61a368d08b33ae1fcfe26e518b82489645455
