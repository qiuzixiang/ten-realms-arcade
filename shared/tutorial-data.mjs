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
      { tag: "识别符印", title: "地面与方舟共有六枚记忆符印", body: "彩色地格保存地面符印，立方核心的六个表面也能保存符印。目标是把六种颜色全部收进立方体。", bullets: ["每种颜色只出现一次", "空白面也参与交换"], focus: "elements" },
      { tag: "滚动交换", title: "落地时，底面与地格交换状态", body: "每滚动一步，立方体朝向会改变；新的底面和落脚地格互换“有符印 / 无符印”状态。离开的地格保持原样。", bullets: ["先判断哪一面将朝下", "可撤销试错"], focus: "action" },
      { tag: "记忆归舱", title: "六面集齐即完成", body: "当六枚符印全部位于立方体六个表面、地面不再留有符印时，方舟记忆完整。以参考步数内完成会获得妙手奖励。", bullets: ["颜色所在表面不作额外要求", "可重复挑战刷新最佳步数"], focus: "goal" },
    ],
  },
  "red-thread-office": {
    title: "月老红线事务所",
    token: "合契印",
    cards: [
      { tag: "查看案卷", title: "人物节点由红线两两相连", body: "圆形角色是可移动节点，红线连接关系固定不变。发亮的交点就是当前仍待处理的线结。", bullets: ["共享端点不算交叉", "线的连接关系不会改变"], focus: "elements" },
      { tag: "拖动理线", title: "移动人物，改变红线走向", body: "拖动任意角色到空位，所有与其相连的红线会同步移动。优先拆开交叉最密集的区域。", bullets: ["一步可以同时消除多个交点", "随时撤销最后一次摆放"], focus: "action" },
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
  return `<svg class="realm-art" data-focus="${focus}" viewBox="0 0 320 184" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
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
  return svg("回收艇沿八向航迹经过能源芯，在残骸墙或引力锚处停下", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="url(#realm-sea)"/>${grid(56, 26, 6, 4, 32)}
    <g class="art-elements"><circle cx="120" cy="74" r="8" fill="#7df9ff" filter="url(#realm-glow)"/><circle cx="216" cy="138" r="8" fill="#7df9ff" filter="url(#realm-glow)"/><circle cx="248" cy="74" r="13" fill="none" stroke="#ffd66b" stroke-width="4"/><path d="M184 124l11 20h-22z" fill="#ff5d8f"/><path d="M62 42h24v32H62zM254 106h24v32h-24z" fill="#5d6f8d"/></g>
    <g class="art-action"><path d="M88 138L205 43" fill="none" stroke="#64ddff" stroke-width="5" stroke-linecap="round" stroke-dasharray="8 8"/><path d="M203 43l-15 3 10 12z" fill="#64ddff"/><g transform="translate(88 138) rotate(-39)"><path d="M-13 10L0-15 13 10 0 5z" fill="#f4fbff" stroke="#64ddff" stroke-width="3"/></g></g>
    <g class="art-goal"><rect x="205" y="24" width="78" height="28" rx="14" fill="#123f4e" stroke="#7df9ff"/><text x="244" y="43" text-anchor="middle" fill="#dffeff" font-size="12" font-weight="700">3 / 3 回收</text></g>`);
}

function memoryArk(focus) {
  return svg("立方方舟滚过彩色符印地格，把六枚记忆符印收进六个表面", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#101735"/>${grid(42, 28, 6, 4, 32)}
    <g class="art-elements"><rect x="74" y="60" width="30" height="30" rx="5" fill="#ffca67"/><rect x="234" y="92" width="30" height="30" rx="5" fill="#7df1d6"/><rect x="202" y="28" width="30" height="30" rx="5" fill="#f783a7"/></g>
    <g class="art-action"><path d="M126 68l34-20 34 20-34 20z" fill="#acb8ff"/><path d="M126 68v42l34 20V88z" fill="#6576dc"/><path d="M194 68v42l-34 20V88z" fill="#8295ff"/><circle cx="160" cy="68" r="7" fill="#ffca67"/><path d="M111 137c34 24 78 22 105-4" fill="none" stroke="#f6f1ff" stroke-width="4" stroke-linecap="round"/><path d="M214 133l-12-2 7 10z" fill="#f6f1ff"/></g>
    <g class="art-goal"><g transform="translate(230 36)"><circle r="30" fill="#202b5d" stroke="#9ee8ff"/><circle cx="-12" cy="-9" r="5" fill="#ffca67"/><circle cx="5" cy="-12" r="5" fill="#f783a7"/><circle cx="13" cy="3" r="5" fill="#7df1d6"/><circle cx="-7" cy="10" r="5" fill="#a997ff"/><circle cx="9" cy="17" r="5" fill="#ff986f"/><circle cx="-17" cy="8" r="5" fill="#8ed1ff"/></g></g>`);
}

function redThread(focus) {
  return svg("拖动人物节点，把交叉的红线整理成互不相交的星图", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#fff7ed"/>
    <g class="art-elements" stroke="#c83456" stroke-width="4" stroke-linecap="round"><path d="M72 48L244 132M244 48L72 132M72 48L72 132M244 48L244 132"/><circle cx="158" cy="90" r="12" fill="#ff315f33" stroke="#ff315f" stroke-dasharray="3 4"/></g>
    <g class="art-action"><path d="M244 48C270 42 278 28 282 22" fill="none" stroke="#845bff" stroke-width="4" stroke-dasharray="6 5"/><path d="M283 22l-12 5 10 7z" fill="#845bff"/></g>
    <g class="art-goal" stroke="#7b2340" stroke-width="3"><path d="M72 48L244 48L270 118L158 148L46 118z" fill="none"/></g>
    <g fill="#fff" stroke="#7b2340" stroke-width="4"><circle cx="72" cy="48" r="12"/><circle cx="244" cy="48" r="12"/><circle cx="72" cy="132" r="12"/><circle cx="244" cy="132" r="12"/></g>`);
}

function firefly(focus) {
  return svg("萤火照亮同行同列花圃，同时满足石墙数字并避免彼此相见", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#0b2b2a"/>${grid(80, 22, 5, 5, 28, "#caffd035")}
    <g class="art-elements"><rect x="136" y="78" width="28" height="28" rx="5" fill="#11201e" stroke="#93a69f"/><text x="150" y="98" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">2</text><rect x="192" y="50" width="28" height="28" rx="5" fill="#11201e"/></g>
    <g class="art-action"><path d="M94 36H220M108 22V162" stroke="#e9ff76" stroke-width="9" opacity=".18"/><g transform="translate(108 36)" fill="#efff9b" filter="url(#realm-glow)"><circle r="8"/><path d="M0-17v7M0 10v7M-17 0h7M10 0h7" stroke="#efff9b" stroke-width="3"/></g><g transform="translate(206 134)" fill="#efff9b"><circle r="8"/></g></g>
    <g class="art-goal"><rect x="218" y="112" width="64" height="36" rx="18" fill="#dfff7f"/><text x="250" y="135" text-anchor="middle" fill="#173c2c" font-size="13" font-weight="800">全庭点亮</text></g>`);
}

function abyss(focus) {
  return svg("从海沟边缘发射声呐，用吸收、偏折和出口响应推断隐藏能量体", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#061f39"/>${grid(82, 28, 5, 4, 28, "#7ddcff29")}
    <g class="art-elements"><circle cx="124" cy="70" r="10" fill="#102d4a" stroke="#56d8ff" stroke-width="3" stroke-dasharray="3 3"/><circle cx="208" cy="126" r="10" fill="#102d4a" stroke="#56d8ff" stroke-width="3" stroke-dasharray="3 3"/><circle cx="68" cy="70" r="7" fill="#ffd36f"/><circle cx="236" cy="98" r="7" fill="#ffd36f"/></g>
    <g class="art-action"><path d="M68 70H108Q124 70 124 86V126H208" fill="none" stroke="#62e6ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M201 120l12 6-12 6z" fill="#62e6ff"/></g>
    <g class="art-goal"><path d="M242 41l10 10 20-24" fill="none" stroke="#75f3c2" stroke-width="6" stroke-linecap="round"/><text x="256" y="70" text-anchor="middle" fill="#dffeff" font-size="11" font-weight="700">响应一致</text></g>`);
}

function storm(focus) {
  return svg("旋转航标模块，让所有接口形成一张无回路、全连通的灯塔网络", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#0d2843"/>${grid(88, 22, 5, 5, 28, "#b2d8ff2a")}
    <g class="art-elements" fill="none" stroke="#9db0c7" stroke-width="8" stroke-linecap="round"><path d="M102 36v28h28M158 36v28M186 64h28v28M102 120h28v28M158 120v28h28"/></g>
    <g class="art-action"><path d="M51 70a24 24 0 1 1 7 31" fill="none" stroke="#ffd966" stroke-width="4"/><path d="M55 104l2-13 10 9z" fill="#ffd966"/></g>
    <g class="art-goal" fill="none" stroke="#6ef2c1" stroke-width="8" stroke-linecap="round" filter="url(#realm-glow)"><path d="M102 36v28h56v56h56V92M130 64v56M158 120v28h28"/></g><circle cx="102" cy="36" r="9" fill="#fff08a" filter="url(#realm-glow)"/>`);
}

function nightMarket(focus) {
  return svg("选择正交相连的同色灯灵群，清除后棋子下落并向左合并", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#251338"/>${grid(88, 22, 5, 5, 28, "#ffffff1c")}
    <g class="art-elements"><g fill="#ff698b"><circle cx="102" cy="36" r="10"/><circle cx="130" cy="36" r="10"/><circle cx="102" cy="64" r="10"/></g><g fill="#65d7ff"><circle cx="186" cy="64" r="10"/><circle cx="214" cy="64" r="10"/></g><g fill="#ffd76e"><circle cx="158" cy="120" r="10"/><circle cx="158" cy="148" r="10"/></g></g>
    <g class="art-action"><path d="M88 20h56v58H88z" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 4"/><path d="M237 44v58M229 94l8 12 8-12M220 134h-58M170 126l-12 8 12 8" fill="none" stroke="#d4a5ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g class="art-goal"><rect x="210" y="122" width="74" height="30" rx="15" fill="#6ef2c1"/><text x="247" y="142" text-anchor="middle" fill="#17242c" font-size="12" font-weight="800">全摊清空</text></g>`);
}

function skyBridges(focus) {
  return svg("用一至两条横竖航线连接数字港口，满足度数且全图连通不交叉", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#eaf8ff"/>
    <g class="art-action" fill="none" stroke="#4a83ad" stroke-linecap="round"><path d="M78 52H242" stroke-width="5"/><path d="M78 118H158M78 124H158" stroke-width="4"/><path d="M158 118V52" stroke-width="5"/><path d="M242 52v72" stroke-width="5"/></g>
    <g class="art-elements" fill="#fff" stroke="#23658f" stroke-width="4"><circle cx="78" cy="52" r="20"/><circle cx="158" cy="52" r="20"/><circle cx="242" cy="52" r="20"/><circle cx="78" cy="121" r="20"/><circle cx="158" cy="121" r="20"/><circle cx="242" cy="121" r="20"/></g>
    <g fill="#164766" font-size="17" font-weight="800" text-anchor="middle" dominant-baseline="middle"><text x="78" y="53">2</text><text x="158" y="53">3</text><text x="242" y="53">2</text><text x="78" y="122">2</text><text x="158" y="122">3</text><text x="242" y="122">2</text></g>
    <g class="art-goal"><circle cx="274" cy="142" r="16" fill="#53d8a7"/><path d="M266 142l6 6 11-14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>`);
}

function spiritDragon(focus) {
  return svg("在天地灵珠之间绘制一条满足转弯与直行规则的唯一闭环", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#f1ead8"/>${grid(74, 22, 6, 5, 28, "#5d493b35")}
    <g class="art-elements"><circle cx="102" cy="50" r="10" fill="#26352d"/><circle cx="214" cy="50" r="10" fill="#fff" stroke="#26352d" stroke-width="3"/><circle cx="158" cy="134" r="10" fill="#26352d"/><circle cx="242" cy="106" r="10" fill="#fff" stroke="#26352d" stroke-width="3"/></g>
    <g class="art-action"><path d="M102 50H158V22H242V106H214V162H102V134H74V50z" fill="none" stroke="#4f9c77" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g class="art-goal"><path d="M269 34l8 8 15-20" fill="none" stroke="#b55545" stroke-width="5" stroke-linecap="round"/><text x="270" y="63" text-anchor="middle" fill="#70443b" font-size="11" font-weight="800">唯一闭环</text></g>`);
}

function mirror(focus) {
  return svg("观众视线经过斜镜转向，三类演员按直视与镜中可见性满足边缘数字", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#21152d"/>${grid(76, 22, 6, 5, 28, "#ffffff1f")}
    <g class="art-elements"><path d="M104 22l28 28M216 78l28 28" stroke="#a9e8ff" stroke-width="5"/><circle cx="160" cy="64" r="11" fill="#c9b7ff"/><path d="M155 64h10M160 59v10" stroke="#2d2040" stroke-width="3"/><circle cx="104" cy="120" r="11" fill="#ff8caa"/><path d="M99 116l10 8M109 116l-10 8" stroke="#42192a" stroke-width="3"/><circle cx="216" cy="148" r="11" fill="#9ee2b9"/><path d="M211 148h10" stroke="#173b2b" stroke-width="3"/></g>
    <g class="art-action"><path d="M44 36H104L132 64H160M276 92H244L216 120V148" fill="none" stroke="#ffd66e" stroke-width="4" stroke-linecap="round" stroke-dasharray="7 5"/><circle cx="44" cy="36" r="12" fill="#fff2b0"/><text x="44" y="40" text-anchor="middle" fill="#473715" font-size="12" font-weight="800">2</text></g>
    <g class="art-goal"><rect x="236" y="26" width="50" height="28" rx="14" fill="#7b5bb5"/><text x="261" y="45" text-anchor="middle" fill="#fff" font-size="11" font-weight="800">全席吻合</text></g>`);
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
