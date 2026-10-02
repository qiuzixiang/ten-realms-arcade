# 百妖合宿

把正交相邻的两位妖怪安排进双人客房，让每格恰好入住，且完整 `0..N` 骨牌集合中的每一种无序组合恰好出现一次。独立单页游戏，共 6 章、60 道主线题；每日入住从这 60 题按本地日期轮换。

## 本地运行与验证

在仓库根目录执行：

```sh
node standalone/yokai-pairing-house/scripts/build.mjs
node standalone/yokai-pairing-house/tests/verify.mjs
python3 standalone/yokai-pairing-house/scripts/platform-audit.py standalone/yokai-pairing-house/dist/xhs
python3 standalone/yokai-pairing-house/scripts/platform-audit.py standalone/yokai-pairing-house/dist/yokai-pairing-house-xhs.zip
```

`dist/xhs/` 是离线包根目录；`dist/yokai-pairing-house-xhs.zip` 可交创作服务平台。宣传素材在 `release/`，不会进入游戏 ZIP。题库重生脚本是 `scripts/generate-campaign.mjs`；正式构建使用已验收的 `src/levels.mjs`，不会在玩家设备上随机生成题面。

规则原型为 Simon Tatham 谜题集的 Dominosa。生成器参考并保留了固定来源提交 `55cdddb75cf57c17baee80bac4121bd3be1687c6` 的 `v2/games/yokai-inn/logic.mjs`；其 MIT 许可见 [LICENSE.source](LICENSE.source)。本作的主题、手机界面、固定战役及图形素材另行制作，不声称 Dominosa 规则原创。

小工具发布状态与未覆盖设备见 [QA.md](QA.md) 和 [DELIVERY.json](DELIVERY.json)。
