export const REALM_TUTORIALS = Object.freeze({
  "star-drift": {
    title: "星滞回收局",
    token: "回收勋章",
    cards: [
      { tag: "识别航区", title: "先看懂四类关键目标", body: "青色三角是回收艇；发光圆点是能源芯；空心圆环是引力锚；警示三角是失稳反应堆。", bullets: ["残骸墙可以安全制动", "反应堆不可触碰"], focus: "elements" },
      { tag: "点燃推进器", title: "一旦出发，就不会中途刹车", body: "选择八个方向之一，回收艇会持续滑行，直到撞上残骸墙或进入引力锚。先在脑中预演整条航迹。", bullets: ["经过能源芯会自动回收", "支持八方向、滑动与键盘"], focus: "action" },
      { tag: "任务完成", title: "带回全部能源芯", body: "不要求停在固定终点。只要安全收齐本星区的全部能源芯，任务立即完成；更少推进次数会获得效率奖励。", bullets: ["失联后可撤销或重开", "建议航程是效率挑战线"], focus: "goal" },
    ],
  },
  "memory-ark": {
    title: "记忆方舟",
    token: "记忆晶片",
    cards: [
      { tag: "识别符印", title: "地面与方舟共有六枚记忆符印", body: "地格保存曜、潮、生、翼、观、回六枚符印，立方核心的六个表面也能保存符印。目标是把六枚符印全部收进立方体。", bullets: ["每枚符印只出现一次", "空白面也参与交换"], focus: "elements" },
      { tag: "滚动交换", title: "落地时，底面与地格交换状态", body: "每滚动一步，立方体朝向会改变；新的底面和落脚地格互换“有符印 / 无符印”状态。离开的地格保持原样。", bullets: ["先判断哪一面将朝下", "可撤销试错"], focus: "action" },
      { tag: "记忆归舱", title: "六面集齐即完成", body: "当六枚符印全部位于立方体六个表面、地面不再留有符印时，方舟记忆完整。以参考步数内完成会获得妙手奖励。", bullets: ["符印所在表面不作额外要求", "可重复挑战刷新最佳步数"], focus: "goal" },
    ],
  },
  "red-thread-office": {
    title: "月老红线事务所",
    token: "合契印",
    cards: [
      { tag: "查看案卷", title: "人物印章由红线两两相连", body: "写有汉字的红色方印是可移动的人物印章，红线连接关系固定不变。发亮的交点就是当前仍待处理的线结。", bullets: ["共享端点不算交叉", "线的连接关系不会改变"], focus: "elements" },
      { tag: "拖动理线", title: "移动印章，改变红线走向", body: "拖动任意人物印章到空位，所有与它相连的红线会同步移动。优先拆开交叉最密集的区域。", bullets: ["一步可以同时消除多个交点", "随时撤销最后一次摆放"], focus: "action" },
      { tag: "零线结", title: "所有红线互不相交即完成", body: "不需要排序，也没有长度限制；只要任意两条红线都不再交叉，案卷就会自动盖章。更少移动可刷新个人最佳。", bullets: ["边界接触也属于相交", "三档案卷各有独立记录"], focus: "goal" },
    ],
  },
  "firefly-garden": {
    title: "夜庭萤火",
    token: "晨露光",
    cards: [
      { tag: "花庭元素", title: "花圃、石墙与萤火精灵", body: "空花圃需要被照亮；石墙会挡住光线；带数字的石墙要求周围恰好出现指定数量的萤火。", bullets: ["光只沿上下左右传播", "石墙本身不需要被照亮"], focus: "elements" },
      { tag: "安放萤火", title: "点击花圃切换萤火与排除记号", body: "一只萤火会照亮同行同列，直到被石墙挡住。两只萤火不能隔着空地互相看见。", bullets: ["数字只统计正交相邻位置", "排除记号只是笔记"], focus: "action" },
      { tag: "黎明条件", title: "全庭被照亮，且所有限制成立", body: "每个空花圃都亮起、萤火彼此不可见、所有数字石墙恰好满足，三项同时成立才迎来黎明。", bullets: ["冲突位置会即时提示", "重复挑战可刷新个人最佳"], focus: "goal" },
    ],
  },
  "abyss-echo": {
    title: "深海回声站",
    token: "回声样本",
    cards: [
      { tag: "声场元素", title: "浮标、声呐与隐藏能量体", body: "边缘浮标可以发射声呐；深海网格中藏着若干能量体。声呐可能被吸收、偏折、反射或从另一浮标离开。", bullets: ["编号相同的一对互为入口出口", "问号位置是你的推测"], focus: "elements" },
      { tag: "读取响应", title: "从边缘发射，记录整片声场", body: "点击浮标观察响应，再根据多条声呐的组合结果推断能量体位置。不要只依赖单条路径。", bullets: ["正面命中会被吸收", "擦边会发生偏折"], focus: "action" },
      { tag: "响应等价", title: "让你的模型解释全部声呐结果", body: "标出规定数量的能量体并核验。只要你的布局对所有浮标产生完全相同的响应，就算通关，即使坐标并非唯一。", bullets: ["核验次数也会计入表现", "精确坐标与等价解都有效"], focus: "goal" },
    ],
  },
  "storm-lanterns": {
    title: "风暴灯塔网",
    token: "灯塔电报码",
    cards: [
      { tag: "航标模块", title: "每块模块都有固定形状与接口", body: "直线、弯角、三岔和终端只能旋转，不能移动或改变形状。发光源会沿正确对接的接口输送能量。", bullets: ["外边界不能出现向外接口", "单边接口属于悬空"], focus: "elements" },
      { tag: "旋转校准", title: "旋转模块，接通相邻接口", body: "选择模块后顺时针或逆时针旋转。锁定只是防误触的笔记，不会改变规则判定。", bullets: ["亮起表示已连到能量源", "可撤销、重开并切换海图"], focus: "action" },
      { tag: "驱散云墙", title: "全图连通，而且不能形成回路", body: "所有模块必须属于同一张互相对接的网络，不能悬空、不能越界，也不能出现闭合环路。正确答案是一棵覆盖全图的网络树。", bullets: ["只点亮部分区域不算完成", "少旋转、短用时均可挑战最佳"], focus: "goal" },
    ],
  },
  "night-market-spirits": {
    title: "夜市精灵撤离",
    token: "灯火券",
    cards: [
      { tag: "寻找灯灵群", title: "正交相连的同色灯灵组成一群", body: "上下左右相邻才算同群；对角接触不连接。至少两只灯灵才能一起撤离，单只无法点击。", bullets: ["悬停会预览整群与得分", "群越大，单次得分越高"], focus: "elements" },
      { tag: "撤离与坠落", title: "送走一群后，摊位会先下落再左移", body: "空位上方的灯灵会向下坠落；空列消失后，其右侧列整体左移。新形成的灯灵群留到下一步处理。", bullets: ["不会自动连消", "可撤销重新规划"], focus: "action" },
      { tag: "闭市清场", title: "把整座夜市清空", body: "棋盘清空即胜利；若仍有灯灵却不存在任何两只正交同色相邻，则形成残局。规划顺序比追求眼前大群更重要。", bullets: ["积分采用经典群组计分", "清空比局部高分更重要"], focus: "goal" },
    ],
  },
  "sky-bridges": {
    title: "云海航路",
    token: "云航里程",
    cards: [
      { tag: "浮空港", title: "港口数字就是所需航线总数", body: "圆形浮空港旁的数字表示它最终连接的航线单位数。两个港口间可以没有航线、一条航线或两条并行航线。", bullets: ["航线只能横向或纵向", "中间不能穿过其他港口"], focus: "elements" },
      { tag: "铺设航线", title: "点击候选航路，在 0、1、2 之间循环", body: "每次增加或减少一条航线都会更新两端港口数字。禁航记号和核验印章只是辅助笔记，不参与最终判定。", bullets: ["两条航线会并排显示", "航线不能互相交叉"], focus: "action" },
      { tag: "全域通航", title: "数字全满足，所有港口连成一体", body: "每个港口度数必须恰好等于数字，航线不交叉，并且所有港口都能沿航线互相抵达。三项同时满足才算通航。", bullets: ["局部小岛群不能单独封闭", "布局会自动为新增航线留出空间"], focus: "goal" },
    ],
  },
  "spirit-dragon": {
    title: "灵龙巡脉",
    token: "龙脉灵息",
    cards: [
      { tag: "天地灵珠", title: "黑色地珠与白色天珠规定龙脉走向", body: "地珠要求龙脉在珠上转弯、两侧继续直行；天珠要求在珠上直穿，并在前后至少一侧紧邻处转弯。", bullets: ["每颗珠都必须经过", "珠子颜色代表不同规律"], focus: "elements" },
      { tag: "绘制龙脉", title: "连接相邻格点，线段与排除记号三态切换", body: "拖动或点击相邻格点铺线。每个经过点最终应有两条线；排除记号只是推理笔记，不会阻断其他路径。", bullets: ["分叉会立即提示冲突", "可撤销最近落笔"], focus: "action" },
      { tag: "唯一闭环", title: "形成一条经过所有灵珠的单一闭环", body: "不能留下开放端点、分叉、多余线段或多个小环。唯一龙脉闭合并满足全部天地珠规律时，灵龙归脉。", bullets: ["过早形成小环会被标记", "少落笔可刷新个人最佳"], focus: "goal" },
    ],
  },
  "mirror-theatre": {
    title: "镜影大剧院",
    token: "谢幕票根",
    cards: [
      { tag: "演员与镜面", title: "三类演员对视线的反应不同", body: "全息演员只在镜中可见；真人演员只在直视时可见；机械演员无论直视或经镜面反射都可见。斜镜会改变观众视线方向。", bullets: ["镜格不能安排演员", "每个普通舞台格都要有人"], focus: "elements" },
      { tag: "安排卡司", title: "点击舞台格，循环三类演员与候选记号", body: "边缘数字表示从该观众席沿光路能看见的演员数量。沿途可能经过多面镜，也可能再次经过同一格。", bullets: ["候选记号不算正式演员", "总表同时限制三类人数"], focus: "action" },
      { tag: "完美谢幕", title: "所有边缘视线与演员总数同时吻合", body: "填满每个非镜格，三类演员数量与节目单一致，并让每一个边缘数字都精确满足，演出才会谢幕。", bullets: ["过量和无法达成都有提示", "更少调整可刷新个人最佳"], focus: "goal" },
    ],
  },
});

function svg(label, focus, content) {
  return `<svg class="realm-art" data-focus="${focus}" viewBox="0 0 320 184" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="realm-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="realm-sea" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#122849"/><stop offset="1" stop-color="#07111f"/></linearGradient>
    </defs>${content}</svg>`;
}

const grid = (x, y, columns, rows, size, color = "#ffffff24") => {
  let lines = "";
  for (let column = 0; column <= columns; column += 1) lines += `<path d="M${x + column * size} ${y}V${y + rows * size}"/>`;
  for (let row = 0; row <= rows; row += 1) lines += `<path d="M${x} ${y + row * size}H${x + columns * size}"/>`;
  return `<g fill="none" stroke="${color}" stroke-width="1">${lines}</g>`;
};

function starDrift(focus) {
  if (focus === "action") return svg("回收艇沿选定方向直线滑行，途中收集能源芯并停在引力锚", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="url(#realm-sea)"/>${grid(48, 28, 7, 4, 32)}
    <g class="art-action"><path d="M70 140L232 48" fill="none" stroke="#64ddff" stroke-width="5" stroke-linecap="round" stroke-dasharray="9 8"/><circle cx="148" cy="96" r="8" fill="#7df9ff" filter="url(#realm-glow)"/><circle cx="238" cy="44" r="16" fill="none" stroke="#ffd66b" stroke-width="4"/><path d="M226 51l11-16 5 18z" fill="#64ddff"/><g transform="translate(70 140) rotate(-30)"><path d="M-14 10L0-16 14 10 0 5z" fill="#f4fbff" stroke="#64ddff" stroke-width="3"/></g><rect x="260" y="100" width="22" height="42" rx="3" fill="#5d6f8d"/></g>`);
  if (focus === "goal") return svg("三枚能源芯全部回收，任务进度达到三分之三", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="url(#realm-sea)"/>${grid(48, 28, 7, 4, 32, "#ffffff18")}
    <g class="art-goal"><g fill="#7df9ff" filter="url(#realm-glow)"><circle cx="92" cy="70" r="11"/><circle cx="160" cy="70" r="11"/><circle cx="228" cy="70" r="11"/></g><g fill="none" stroke="#72efbb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M82 104l7 7 13-16"/><path d="M150 104l7 7 13-16"/><path d="M218 104l7 7 13-16"/></g><rect x="108" y="126" width="104" height="28" rx="14" fill="#123f4e" stroke="#7df9ff"/><text x="160" y="145" text-anchor="middle" fill="#dffeff" font-size="14" font-weight="800">3 / 3</text></g>`);
  return svg("回收艇、能源芯、引力锚、反应堆与残骸墙分开标示", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="url(#realm-sea)"/>${grid(48, 28, 7, 4, 32)}
    <g class="art-elements"><g transform="translate(82 58)"><path d="M-14 10L0-16 14 10 0 5z" fill="#f4fbff" stroke="#64ddff" stroke-width="3"/></g><circle cx="158" cy="58" r="10" fill="#7df9ff" filter="url(#realm-glow)"/><circle cx="238" cy="58" r="16" fill="none" stroke="#ffd66b" stroke-width="4"/><rect x="58" y="112" width="34" height="30" rx="3" fill="#5d6f8d"/><path d="M158 108l18 34h-36z" fill="#ff5d8f"/><text x="158" y="135" text-anchor="middle" fill="#fff" font-size="18" font-weight="900">!</text></g>`);
}

function memoryArk(focus) {
  if (focus === "action") return svg("滚动前后对照：方舟新底面与落脚地格上的符印清楚交换且互不遮挡", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#101735"/>
    <g class="art-action" font-family="ui-sans-serif, system-ui, sans-serif"><rect x="28" y="24" width="116" height="140" rx="12" fill="#ffffff08" stroke="#ffffff20"/><rect x="176" y="24" width="116" height="140" rx="12" fill="#ffffff08" stroke="#ffffff20"/><g fill="#f6f1ff" font-size="12" font-weight="800" text-anchor="middle"><text x="86" y="43">滚动前</text><text x="234" y="43">滚动后</text></g><g><path d="M58 67l28-17 28 17-28 17z" fill="#acb8ff"/><path d="M58 67v28l28 17V84z" fill="#6576dc"/><path d="M114 67v28l-28 17V84z" fill="#8295ff"/><path d="M206 67l28-17 28 17-28 17z" fill="#acb8ff"/><path d="M206 67v28l28 17V84z" fill="#6576dc"/><path d="M262 67v28l-28 17V84z" fill="#8295ff"/></g><g fill="#dce2ff" font-size="10" font-weight="700"><text x="43" y="127">底面</text><text x="43" y="151">地格</text><text x="191" y="127">底面</text><text x="191" y="151">地格</text></g><g font-size="16" font-weight="900" text-anchor="middle"><rect x="92" y="113" width="32" height="20" rx="6" fill="#ffffff08" stroke="#ffffff35"/><text x="108" y="128" fill="#9da7c7" font-size="10">空</text><rect x="92" y="137" width="32" height="20" rx="6" fill="#ef9c5c22" stroke="#ef9c5c"/><text x="108" y="153" fill="#ef9c5c">≋</text><rect x="240" y="113" width="32" height="20" rx="6" fill="#ef9c5c22" stroke="#ef9c5c"/><text x="256" y="129" fill="#ef9c5c">≋</text><rect x="240" y="137" width="32" height="20" rx="6" fill="#ffffff08" stroke="#ffffff35"/><text x="256" y="152" fill="#9da7c7" font-size="10">空</text></g><path d="M151 88h18" stroke="#f6f1ff" stroke-width="4" stroke-linecap="round"/><path d="M171 88l-10-7v14z" fill="#f6f1ff"/><text x="160" y="72" text-anchor="middle" fill="#dce2ff" font-size="9" font-weight="800">滚动</text></g>`);
  if (focus === "goal") return svg("曜潮生翼观回六枚符印全部收进方舟六个表面，地面已经清空", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#101735"/>
    <g class="art-goal"><path d="M106 62l54-32 54 32-54 32z" fill="#acb8ff"/><path d="M106 62v54l54 32V94z" fill="#6576dc"/><path d="M214 62v54l-54 32V94z" fill="#8295ff"/><g font-size="19" font-weight="900" text-anchor="middle"><text x="142" y="66" fill="#ffc766">✦</text><text x="178" y="66" fill="#ef9c5c">≋</text><text x="130" y="105" fill="#dbb66c">◇</text><text x="146" y="130" fill="#ffdf9b">⌁</text><text x="190" y="105" fill="#c87543">◉</text><text x="174" y="130" fill="#f5b77d">∿</text></g><rect x="105" y="151" width="110" height="17" rx="8.5" fill="#ffffff0d" stroke="#ffffff24"/><text x="160" y="163" text-anchor="middle" fill="#dce2ff" font-size="9" font-weight="800">地面已清空</text><path d="M250 56l9 9 18-24" fill="none" stroke="#72efbb" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("曜潮生三枚符印位于地格，翼观回三枚符印位于立方方舟表面", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#101735"/>
    <g class="art-elements" font-family="ui-sans-serif, system-ui, sans-serif"><text x="91" y="55" text-anchor="middle" fill="#dce2ff" font-size="11" font-weight="800">地格上的符印</text><g font-size="20" font-weight="900" text-anchor="middle"><rect x="36" y="74" width="34" height="34" rx="6" fill="#ffc76620" stroke="#ffc766"/><text x="53" y="98" fill="#ffc766">✦</text><rect x="78" y="74" width="34" height="34" rx="6" fill="#ef9c5c20" stroke="#ef9c5c"/><text x="95" y="98" fill="#ef9c5c">≋</text><rect x="120" y="74" width="34" height="34" rx="6" fill="#dbb66c20" stroke="#dbb66c"/><text x="137" y="98" fill="#dbb66c">◇</text></g><text x="224" y="35" text-anchor="middle" fill="#dce2ff" font-size="11" font-weight="800">方舟表面的符印</text><path d="M176 68l48-28 48 28-48 28z" fill="#acb8ff"/><path d="M176 68v50l48 28V96z" fill="#6576dc"/><path d="M272 68v50l-48 28V96z" fill="#8295ff"/><g font-size="20" font-weight="900" text-anchor="middle"><text x="224" y="72" fill="#ffdf9b">⌁</text><text x="203" y="116" fill="#c87543">◉</text><text x="245" y="116" fill="#f5b77d">∿</text></g><g fill="#dce2ff" font-size="9" font-weight="700" text-anchor="middle"><text x="53" y="122">曜印</text><text x="95" y="122">潮印</text><text x="137" y="122">生印</text><text x="224" y="160">翼 · 观 · 回</text></g></g>`);
}

function redSeal(x, y, mark, rotation = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation})"><path d="M-13-15L10-13 15-9 13 12 8 15-11 13-15 8-14-11Z" fill="#7a172b" stroke="#d7a552" stroke-width="2"/><path d="M-9-10L7-9 10-6 9 8 6 10-8 9-10 6-9-8Z" fill="none" stroke="#f3cf8a88"/><text x="0" y="6" text-anchor="middle" fill="#f6dec1" font-size="16" font-family="Songti SC, STSong, serif" font-weight="800">${mark}</text></g>`;
}

function redThread(focus) {
  if (focus === "action") return svg("拖动安字人物印章后，同一组红线随印章改道，交点随之消失", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#fff7ed"/>
    <g class="art-action"><g fill="#7b2340" font-size="10" font-weight="800" text-anchor="middle"><text x="84" y="28">拖动前</text><text x="238" y="28">拖动后</text></g><g stroke="#c83456" stroke-width="3" stroke-linecap="round"><path d="M48 60L120 132M120 60L48 132M48 60H120"/><circle cx="84" cy="96" r="8" fill="#ff315f33" stroke="#ff315f" stroke-dasharray="3 3"/></g>${redSeal(48, 60, "归", -3)}${redSeal(120, 60, "晴", 2)}${redSeal(48, 132, "知", 3)}${redSeal(120, 132, "安", -2)}<path d="M142 94h18" stroke="#845bff" stroke-width="4" stroke-dasharray="5 4"/><path d="M162 94l-10-7v14z" fill="#845bff"/><g stroke="#c83456" stroke-width="3" fill="none" stroke-linecap="round"><path d="M210 60H282M210 60L180 104M282 60L210 132"/></g>${redSeal(210, 60, "归", -3)}${redSeal(282, 60, "晴", 2)}${redSeal(210, 132, "知", 3)}${redSeal(180, 104, "安", -2)}<path d="M269 117h26v30h-26z" fill="none" stroke="#845bff88" stroke-width="2" stroke-dasharray="4 3"/><path d="M282 151c-28 13-81 11-98-31" fill="none" stroke="#845bff" stroke-width="3" stroke-dasharray="4 3"/><path d="M181 116l-3 11 10-5z" fill="#845bff"/></g>`);
  if (focus === "goal") return svg("归晴知安逢暖六枚人物印章位于红线端点，全部红线互不交叉", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#fff7ed"/>
    <g class="art-goal"><g stroke="#c83456" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M80 52L160 34L240 52L260 124L160 150L60 124L80 52"/><path d="M80 52L160 150M240 52L160 150"/></g>${redSeal(80, 52, "归", -3)}${redSeal(160, 34, "晴", 2)}${redSeal(240, 52, "知", -2)}${redSeal(260, 124, "安", 3)}${redSeal(160, 150, "逢", -3)}${redSeal(60, 124, "暖", 2)}<path d="M268 38l7 7 14-19" fill="none" stroke="#49b985" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("写有归晴知安的深红方印连接固定红线，发亮圆环标出交叉线结", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#fff7ed"/>
    <g class="art-elements"><g stroke="#c83456" stroke-width="4" stroke-linecap="round"><path d="M72 48L248 132M248 48L72 132M72 48V132M248 48V132"/><circle cx="160" cy="90" r="13" fill="#ff315f33" stroke="#ff315f" stroke-dasharray="4 4"/></g>${redSeal(72, 48, "归", -3)}${redSeal(248, 48, "晴", 2)}${redSeal(72, 132, "知", 3)}${redSeal(248, 132, "安", -2)}</g>`);
}

function firefly(focus) {
  if (focus === "action") return svg("萤火沿上下左右照明，光线在石墙处停止，排除记号只作笔记", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#0b2b2a"/>${grid(90, 22, 5, 5, 28, "#caffd035")}
    <g class="art-action"><path d="M104 92H216M160 36V148" stroke="#e9ff76" stroke-width="12" opacity=".18"/><rect x="160" y="22" width="28" height="28" rx="5" fill="#11201e"/><rect x="216" y="78" width="28" height="28" rx="5" fill="#11201e"/><g transform="translate(160 92)" fill="#efff9b" filter="url(#realm-glow)"><circle r="9"/><path d="M0-18v7M0 11v7M-18 0h7M11 0h7" stroke="#efff9b" stroke-width="3"/></g><g stroke="#9cc3b6" stroke-width="4" stroke-linecap="round"><path d="M101 119l14 14M115 119l-14 14"/></g></g>`);
  if (focus === "goal") return svg("全部花圃被照亮，两只萤火互不可见，数字石墙恰好满足", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#0b2b2a"/><rect x="90" y="22" width="140" height="140" rx="8" fill="#dfff7f16"/>${grid(90, 22, 5, 5, 28, "#caffd05c")}
    <g class="art-goal"><path d="M104 92H216M132 36V148M188 36V148" stroke="#e9ff76" stroke-width="12" opacity=".16"/><rect x="146" y="78" width="28" height="28" rx="5" fill="#11201e" stroke="#93a69f"/><text x="160" y="98" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">2</text><g transform="translate(132 92)" fill="#efff9b" filter="url(#realm-glow)"><circle r="9"/><path d="M0-17v6M0 11v6M-17 0h6M11 0h6" stroke="#efff9b" stroke-width="3"/></g><g transform="translate(188 92)" fill="#efff9b" filter="url(#realm-glow)"><circle r="9"/></g><path d="M252 48l9 9 18-24" fill="none" stroke="#72efbb" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("空花圃、普通石墙、数字石墙和萤火精灵分别显示", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#0b2b2a"/>${grid(90, 22, 5, 5, 28, "#caffd035")}
    <g class="art-elements"><rect x="146" y="78" width="28" height="28" rx="5" fill="#11201e" stroke="#93a69f"/><text x="160" y="98" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">2</text><rect x="202" y="50" width="28" height="28" rx="5" fill="#11201e"/><g transform="translate(104 50)" fill="#efff9b" filter="url(#realm-glow)"><circle r="9"/><path d="M0-18v7M0 11v7M-18 0h7M11 0h7" stroke="#efff9b" stroke-width="3"/></g><rect x="90" y="106" width="28" height="28" fill="#dfff7f1f"/></g>`);
}

function abyss(focus) {
  if (focus === "action") return svg("两束声呐分别展示被能量体吸收与受邻近能量体偏折", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#061f39"/>${grid(70, 30, 6, 4, 28, "#7ddcff29")}
    <g class="art-action"><circle cx="56" cy="72" r="8" fill="#ffd36f"/><path d="M56 72H142" stroke="#62e6ff" stroke-width="4" stroke-linecap="round"/><circle cx="154" cy="72" r="11" fill="#07121f" stroke="#56d8ff" stroke-width="3"/><path d="M142 64l12 8-12 8" fill="#62e6ff"/><path d="M140 106H190Q204 106 204 92V50" fill="none" stroke="#62e6ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="218" cy="106" r="10" fill="#102d4a" stroke="#56d8ff" stroke-width="3" stroke-dasharray="3 3"/><circle cx="204" cy="36" r="8" fill="#ffd36f"/><path d="M198 51l6-12 6 12z" fill="#62e6ff"/></g>`);
  if (focus === "goal") return svg("左右两个模型都从一号入口发射并从二号出口离开，输入输出相同因此等价", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#061f39"/>
    <g class="art-goal">${grid(42, 46, 4, 3, 24, "#7ddcff35")}${grid(182, 46, 4, 3, 24, "#7ddcff35")}<circle cx="90" cy="70" r="8" fill="#102d4a" stroke="#56d8ff" stroke-width="3"/><circle cx="210" cy="94" r="8" fill="#102d4a" stroke="#56d8ff" stroke-width="3"/><path d="M30 58H66V118H126" fill="none" stroke="#62e6ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M170 58H194V118H278" fill="none" stroke="#62e6ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><g fill="#ffd36f" stroke="#fff0bd" stroke-width="1"><circle cx="30" cy="58" r="9"/><circle cx="126" cy="118" r="9"/><circle cx="170" cy="58" r="9"/><circle cx="278" cy="118" r="9"/></g><g fill="#463612" font-size="10" font-weight="900" text-anchor="middle"><text x="30" y="62">1</text><text x="126" y="122">2</text><text x="170" y="62">1</text><text x="278" y="122">2</text></g><text x="160" y="94" text-anchor="middle" fill="#dffeff" font-size="28" font-weight="800">=</text><path d="M145 138l9 9 20-26" fill="none" stroke="#75f3c2" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("边缘浮标围绕声场网格，问号能量体表示尚待推断的位置", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#061f39"/>${grid(70, 30, 6, 4, 28, "#7ddcff29")}
    <g class="art-elements"><g fill="#ffd36f"><circle cx="56" cy="58" r="8"/><circle cx="56" cy="114" r="8"/><circle cx="154" cy="20" r="8"/><circle cx="252" cy="142" r="8"/></g><g fill="#102d4a" stroke="#56d8ff" stroke-width="3" stroke-dasharray="3 3"><circle cx="126" cy="86" r="12"/><circle cx="210" cy="114" r="12"/></g><g fill="#dffeff" font-size="12" font-weight="800" text-anchor="middle"><text x="126" y="90">?</text><text x="210" y="118">?</text></g></g>`);
}

function storm(focus) {
  if (focus === "action") return svg("旋转一块弯角模块后，两侧接口对接并被灯塔能量点亮", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#0d2843"/>
    <g class="art-action"><g transform="translate(72 54)" fill="none" stroke="#9db0c7" stroke-width="8" stroke-linecap="round"><rect x="-28" y="-28" width="56" height="56" rx="8" stroke="#ffffff20" stroke-width="2"/><path d="M0-20V0H20"/></g><path d="M125 72a28 28 0 1 1 0 40" fill="none" stroke="#ffd966" stroke-width="4"/><path d="M124 114l2-13 10 9z" fill="#ffd966"/><g fill="none" stroke="#6ef2c1" stroke-width="8" stroke-linecap="round" filter="url(#realm-glow)"><path d="M182 92h32V60M214 92h34"/></g><g fill="none" stroke="#ffffff20" stroke-width="2"><rect x="154" y="64" width="56" height="56" rx="8"/><rect x="210" y="64" width="56" height="56" rx="8"/></g><circle cx="182" cy="92" r="8" fill="#fff08a" filter="url(#realm-glow)"/></g>`);
  if (focus === "goal") return svg("棋盘内全部模块组成发光网络树，棋盘外独立提示闭合回路被禁止", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#0d2843"/>${grid(58, 30, 6, 4, 28, "#b2d8ff2a")}
    <g class="art-goal" fill="none" stroke="#6ef2c1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" filter="url(#realm-glow)"><path d="M72 44h56v42h56v56M128 86v56M184 86h42v-42M128 114H86"/></g><circle cx="72" cy="44" r="9" fill="#fff08a" filter="url(#realm-glow)"/><g><rect x="236" y="78" width="56" height="76" rx="12" fill="#ff7a9110" stroke="#ff7a9188" stroke-dasharray="4 3"/><g fill="none" stroke="#ff7a91" stroke-width="4"><circle cx="264" cy="108" r="17"/><path d="M252 96l24 24"/></g><text x="264" y="143" text-anchor="middle" fill="#ffb0bd" font-size="9" font-weight="800">禁止回路</text></g>`);
  return svg("终端、直线、弯角和三岔模块各自拥有固定接口形状", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#0d2843"/>
    <g class="art-elements" fill="none" stroke="#aebdd0" stroke-width="8" stroke-linecap="round"><g transform="translate(62 92)"><rect x="-28" y="-28" width="56" height="56" rx="8" stroke="#ffffff20" stroke-width="2"/><path d="M0 0H22"/></g><g transform="translate(126 92)"><rect x="-28" y="-28" width="56" height="56" rx="8" stroke="#ffffff20" stroke-width="2"/><path d="M-22 0H22"/></g><g transform="translate(190 92)"><rect x="-28" y="-28" width="56" height="56" rx="8" stroke="#ffffff20" stroke-width="2"/><path d="M-22 0H0V-22"/></g><g transform="translate(254 92)"><rect x="-28" y="-28" width="56" height="56" rx="8" stroke="#ffffff20" stroke-width="2"/><path d="M-22 0H22M0 0V-22"/></g></g>`);
}

function nightMarket(focus) {
  if (focus === "action") return svg("灯灵群移除后，剩余灯灵先向下坠落，空列再向左合并", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#251338"/>
    <g class="art-action">${grid(38, 42, 4, 4, 24, "#ffffff22")}${grid(186, 42, 4, 4, 24, "#ffffff22")}<g fill="#ff698b"><circle cx="50" cy="54" r="8"/><circle cx="74" cy="54" r="8"/></g><g fill="#65d7ff"><circle cx="122" cy="54" r="8"/><circle cx="122" cy="78" r="8"/></g><g fill="#ffd76e"><circle cx="74" cy="102" r="8"/><circle cx="98" cy="126" r="8"/></g><text x="150" y="34" text-anchor="middle" fill="#ecd6ff" font-size="10" font-weight="800">① 先下落</text><path d="M150 70v36" stroke="#d4a5ff" stroke-width="4" stroke-linecap="round"/><path d="M150 110l-8-12h16z" fill="#d4a5ff"/><g fill="#65d7ff"><circle cx="198" cy="102" r="8"/><circle cx="198" cy="126" r="8"/></g><g fill="#ffd76e"><circle cx="222" cy="126" r="8"/></g><text x="252" y="34" text-anchor="middle" fill="#ecd6ff" font-size="10" font-weight="800">② 再左移</text><path d="M278 88h-24" stroke="#d4a5ff" stroke-width="4" stroke-linecap="round"/><path d="M250 88l12-8v16z" fill="#d4a5ff"/></g>`);
  if (focus === "goal") return svg("清空棋盘获得胜利，留下互不相邻的孤立灯灵会形成残局", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#251338"/>
    <g class="art-goal">${grid(42, 46, 4, 4, 24, "#6ef2c155")}${grid(182, 46, 4, 4, 24, "#ff7a9150")}<path d="M72 126l9 9 20-26" fill="none" stroke="#6ef2c1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><g fill="#ff698b"><circle cx="194" cy="58" r="8"/><circle cx="254" cy="118" r="8"/></g><circle cx="230" cy="82" r="8" fill="#65d7ff"/><path d="M260 48l18 18M278 48l-18 18" stroke="#ff7a91" stroke-width="5" stroke-linecap="round"/></g>`);
  return svg("正交相连的同色灯灵形成可撤离群，对角接触不算相连", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#251338"/>${grid(90, 22, 5, 5, 28, "#ffffff1c")}
    <g class="art-elements"><g fill="#ff698b"><circle cx="104" cy="36" r="10"/><circle cx="132" cy="36" r="10"/><circle cx="104" cy="64" r="10"/></g><path d="M90 22h56v58H90z" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 4"/><g fill="#65d7ff"><circle cx="188" cy="64" r="10"/><circle cx="216" cy="64" r="10"/></g><g fill="#ffd76e"><circle cx="160" cy="120" r="10"/><circle cx="188" cy="148" r="10"/></g></g>`);
}

function skyBridges(focus) {
  if (focus === "action") return svg("同一对港口的候选航路依次显示零条、一条和两条航线", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#eaf8ff"/>
    <g class="art-action" font-weight="800" text-anchor="middle"><g fill="#fff" stroke="#23658f" stroke-width="3"><circle cx="74" cy="52" r="14"/><circle cx="246" cy="52" r="14"/><circle cx="74" cy="92" r="14"/><circle cx="246" cy="92" r="14"/><circle cx="74" cy="132" r="14"/><circle cx="246" cy="132" r="14"/></g><g fill="#164766" font-size="13"><text x="74" y="57">2</text><text x="246" y="57">2</text><text x="74" y="97">2</text><text x="246" y="97">2</text><text x="74" y="137">2</text><text x="246" y="137">2</text></g><g fill="#4a83ad" font-size="13"><text x="42" y="57">0</text><text x="42" y="97">1</text><text x="42" y="137">2</text></g><path d="M88 92H232M88 128H232M88 136H232" fill="none" stroke="#4a83ad" stroke-width="4" stroke-linecap="round"/></g>`);
  if (focus === "goal") return svg("四座港口的需求数字全部满足，单双航线组成一个连通网络", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#eaf8ff"/>
    <g class="art-goal" fill="none" stroke="#4a83ad" stroke-linecap="round"><path d="M82 54H226M82 54V132M82 132H226" stroke-width="5"/><path d="M222 54V132M230 54V132" stroke-width="4"/></g><g fill="#fff" stroke="#23658f" stroke-width="4"><circle cx="82" cy="54" r="20"/><circle cx="226" cy="54" r="20"/><circle cx="82" cy="132" r="20"/><circle cx="226" cy="132" r="20"/></g><g fill="#164766" font-size="17" font-weight="800" text-anchor="middle" dominant-baseline="middle"><text x="82" y="55">2</text><text x="226" y="55">3</text><text x="82" y="133">2</text><text x="226" y="133">3</text></g><circle cx="276" cy="134" r="16" fill="#53d8a7"/><path d="M268 134l6 6 11-14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
  return svg("港口中央数字表示最终需要连接的航线单位数，航线有零一二条", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#eaf8ff"/>
    <g class="art-elements"><g fill="#fff" stroke="#23658f" stroke-width="4"><circle cx="70" cy="64" r="22"/><circle cx="70" cy="124" r="22"/></g><g fill="#164766" font-size="18" font-weight="800" text-anchor="middle"><text x="70" y="70">2</text><text x="70" y="130">4</text></g><g fill="#fff" stroke="#23658f" stroke-width="3"><circle cx="142" cy="48" r="12"/><circle cx="270" cy="48" r="12"/><circle cx="142" cy="92" r="12"/><circle cx="270" cy="92" r="12"/><circle cx="142" cy="136" r="12"/><circle cx="270" cy="136" r="12"/></g><path d="M154 92H258M154 132H258M154 140H258" fill="none" stroke="#4a83ad" stroke-width="4" stroke-linecap="round"/><g fill="#4a83ad" font-size="12" font-weight="800" text-anchor="middle"><text x="118" y="52">0</text><text x="118" y="96">1</text><text x="118" y="140">2</text></g></g>`);
}

function spiritDragon(focus) {
  if (focus === "action") return svg("相邻格点之间可依次切换为空白、龙脉线段和排除记号", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#f1ead8"/>
    <g class="art-action"><g fill="#f1ead8" stroke="#5d493b" stroke-width="3"><circle cx="52" cy="92" r="6"/><circle cx="104" cy="92" r="6"/><circle cx="134" cy="92" r="6"/><circle cx="186" cy="92" r="6"/><circle cx="216" cy="92" r="6"/><circle cx="268" cy="92" r="6"/></g><path d="M134 92H186" stroke="#4f9c77" stroke-width="7" stroke-linecap="round"/><path d="M235 76l18 32M253 76l-18 32" stroke="#b55545" stroke-width="5" stroke-linecap="round"/><path d="M112 92h12M194 92h12" stroke="#8a7462" stroke-width="3" stroke-dasharray="3 3"/><text x="78" y="132" text-anchor="middle" fill="#70443b" font-size="12" font-weight="800">空白</text><text x="160" y="132" text-anchor="middle" fill="#4f765f" font-size="12" font-weight="800">画线</text><text x="242" y="132" text-anchor="middle" fill="#9f4f43" font-size="12" font-weight="800">排除</text></g>`);
  if (focus === "goal") return svg("一条不分叉的闭环经过所有黑白灵珠", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#f1ead8"/>${grid(70, 22, 6, 5, 28, "#5d493b35")}
    <g class="art-goal"><path d="M98 50H154V22H238V106H210V162H98V134H70V50z" fill="none" stroke="#4f9c77" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="98" cy="50" r="10" fill="#26352d"/><circle cx="210" cy="50" r="10" fill="#fff" stroke="#26352d" stroke-width="3"/><circle cx="154" cy="134" r="10" fill="#26352d"/><circle cx="238" cy="106" r="10" fill="#fff" stroke="#26352d" stroke-width="3"/><path d="M256 48l8 8 16-22" fill="none" stroke="#b55545" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("黑色地珠要求在珠上转弯，白色天珠要求在珠上直穿", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#f1ead8"/>
    <g class="art-elements"><path d="M38 58H104V132" fill="none" stroke="#4f9c77" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="104" cy="58" r="12" fill="#26352d"/><path d="M178 92H238V138" fill="none" stroke="#4f9c77" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="210" cy="92" r="12" fill="#fff" stroke="#26352d" stroke-width="3"/><text x="86" y="156" text-anchor="middle" fill="#70443b" font-size="12" font-weight="800">地珠 · 珠上转弯</text><text x="224" y="156" text-anchor="middle" fill="#70443b" font-size="12" font-weight="800">天珠 · 紧邻处转弯</text></g>`);
}

function mirror(focus) {
  if (focus === "action") return svg("观众视线进入舞台，遇到斜镜后转向并沿反射路径继续计数", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#21152d"/>${grid(76, 22, 6, 5, 28, "#ffffff1f")}
    <g class="art-action"><circle cx="48" cy="50" r="14" fill="#fff2b0"/><text x="48" y="55" text-anchor="middle" fill="#473715" font-size="14" font-weight="800">2</text><path d="M62 50H132V134H224" fill="none" stroke="#ffd66e" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 5"/><path d="M118 36l28 28" stroke="#a9e8ff" stroke-width="6"/><text x="132" y="100" text-anchor="middle" fill="#67e4eb" font-size="25" font-weight="900">◇</text><text x="188" y="142" text-anchor="middle" fill="#efcf81" font-size="24" font-weight="900">▦</text><path d="M217 128l12 6-12 6z" fill="#ffd66e"/></g>`);
  if (focus === "goal") return svg("舞台演员全部填满，演员总数和每条边缘视线数字都得到绿色核验", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#21152d"/>${grid(90, 34, 5, 3, 28, "#ffffff2c")}
    <g class="art-goal"><g font-size="20" font-weight="900" text-anchor="middle"><text x="104" y="55" fill="#ff8b72">●</text><text x="160" y="55" fill="#67e4eb">◇</text><text x="216" y="55" fill="#efcf81">▦</text><text x="132" y="83" fill="#67e4eb">◇</text><text x="188" y="83" fill="#ff8b72">●</text><text x="104" y="111" fill="#efcf81">▦</text><text x="160" y="111" fill="#ff8b72">●</text><text x="216" y="111" fill="#67e4eb">◇</text></g><g fill="#fff2b0" stroke="#6f5c31" stroke-width="2"><circle cx="76" cy="62" r="12"/><circle cx="244" cy="104" r="12"/></g><g fill="#473715" font-size="12" font-weight="800" text-anchor="middle"><text x="76" y="66">2</text><text x="244" y="108">3</text></g><g fill="none" stroke="#72efbb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M58 90l7 7 12-16"/><path d="M244 56l7 7 12-16"/></g><rect x="88" y="130" width="144" height="24" rx="12" fill="#31233f" stroke="#ffffff24"/><g font-size="11" font-weight="900" text-anchor="middle"><text x="116" y="146" fill="#ff8b72">● 3</text><text x="160" y="146" fill="#67e4eb">◇ 2</text><text x="204" y="146" fill="#efcf81">▦ 2</text></g></g>`);
  return svg("真人、全息演员、机械演员和斜镜分别使用独立形状", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#21152d"/>
    <g class="art-elements"><g transform="translate(80 78)"><circle cy="-18" r="13" fill="#ff8b72"/><path d="M-20 28c2-24 10-34 20-34s18 10 20 34z" fill="#ff8b72"/></g><g transform="translate(160 78)" stroke="#67e4eb"><circle cy="-12" r="19" fill="#67e4eb20" stroke-width="3"/><path d="M-22 8h44M-18 17h36M-12 26h24" stroke-width="4"/><path d="M-7-12h14M0-19v14" stroke="#67e4eb" stroke-width="3"/></g><g transform="translate(240 78)"><rect x="-20" y="-28" width="40" height="42" rx="4" fill="#efcf8120" stroke="#efcf81" stroke-width="3"/><circle cx="-7" cy="-10" r="3" fill="#efcf81"/><circle cx="7" cy="-10" r="3" fill="#efcf81"/><path d="M-9 2h18M0 14v18" stroke="#efcf81" stroke-width="4"/></g><g fill="#e9dff5" font-size="12" font-weight="800" text-anchor="middle"><text x="80" y="142">真人 ●</text><text x="160" y="142">全息 ◇</text><text x="240" y="142">机械 ▦</text></g><path d="M272 38l24 24" stroke="#a9e8ff" stroke-width="5"/></g>`);
}

const ART_RENDERERS = {
  "star-drift": starDrift,
  "memory-ark": memoryArk,
  "red-thread-office": redThread,
  "firefly-garden": firefly,
  "abyss-echo": abyss,
  "storm-lanterns": storm,
  "night-market-spirits": nightMarket,
  "sky-bridges": skyBridges,
  "spirit-dragon": spiritDragon,
  "mirror-theatre": mirror,
};

export function tutorialArt(realmId, focus = "elements") {
  return ART_RENDERERS[realmId]?.(focus) ?? "";
}
