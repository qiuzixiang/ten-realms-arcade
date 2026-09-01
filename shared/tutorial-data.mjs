import {
  abyssTutorialArt,
  stormTutorialArt,
} from "./tutorial-art/abyss-storm.mjs";
import {
  nightMarketTutorialArt,
  skyBridgesTutorialArt,
} from "./tutorial-art/night-sky.mjs";
import {
  redThreadTutorialArt,
  starDriftTutorialArt,
} from "./tutorial-art/star-red.mjs";
import {
  evaluatePosition as evaluateFireflyPosition,
  LEVELS as FIREFLY_LEVELS,
} from "../games/firefly-garden/logic.mjs";
import {
  ACTOR as MIRROR_ACTOR,
  evaluatePosition as evaluateMirrorPosition,
  LEVELS as MIRROR_LEVELS,
  solutionPosition as mirrorSolutionPosition,
} from "../games/mirror-theatre/logic.mjs";

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
      { tag: "识别符印", title: "先认清六个不会变的物理表面", body: "方舟六面用Ⅰ至Ⅵ、独立边色和曜潮生翼观回名称标识；滚动只改变它们朝向，不会改变物理表面的身份。", bullets: ["地格与方舟面都能保存符印", "空白面也参与交换"], focus: "elements" },
      { tag: "滚动交换", title: "跟随箭头看清翻滚与目标落点", body: "方向标签、弧形位移和虚线目标格会显示这一步怎样翻滚；落地后，新的底面与落脚地格交换“有符印 / 无符印”状态。", bullets: ["先看哪一面将朝下", "离开的地格保持原样"], focus: "action" },
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
      { tag: "花庭元素", title: "先分清萤火实体与照亮范围", body: "琥珀分节虫形和“萤”角标代表真正放下的萤火；蓝色开放花朵、虚线光路和“光”角标只表示已被照亮。", bullets: ["石墙会挡住光线", "数字石墙统计相邻萤火实体"], focus: "elements" },
      { tag: "安放萤火", title: "点击花圃切换萤火与排除记号", body: "一只萤火会沿同行同列送出蓝色光路，直到被石墙挡住。两只萤火不能隔着空地互相看见。", bullets: ["红色“冲”角标表示萤火互见", "“禁”角标只是推理笔记"], focus: "action" },
      { tag: "黎明条件", title: "全庭被照亮，且所有限制成立", body: "每个空花圃都亮起、萤火彼此不可见、所有数字石墙恰好满足，三项同时成立才迎来黎明。", bullets: ["冲突位置会即时提示", "重复挑战可刷新个人最佳"], focus: "goal" },
    ],
  },
  "abyss-echo": {
    title: "深海回声站",
    token: "回声样本",
    cards: [
      { tag: "声场元素", title: "浮标、声呐与隐藏能量体", body: "边缘浮标可以发射声呐；深海网格中藏着若干能量体。声呐可能被吸收、偏折、反射或从另一浮标离开。", bullets: ["H 表示吸收，R 表示原路反射", "带环轨的能量球是你的模型标记"], focus: "elements" },
      { tag: "读取响应", title: "从边缘发射，记录整片声场", body: "点击浮标观察响应，再根据多条声呐的组合结果推断能量体位置。不要只依赖单条路径。", bullets: ["正面命中会被吸收", "擦边会发生偏折"], focus: "action" },
      { tag: "响应等价", title: "让你的模型解释全部声呐结果", body: "标出规定数量的能量体并核验。只有全部边缘浮标的响应签名都完全相同才算通关，即使能量体坐标并非唯一。", bullets: ["不能只凭一束声呐判断等价", "精确坐标与全响应等价解都有效"], focus: "goal" },
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
      { tag: "全域通航", title: "数字全满足，所有港口连成一体", body: "每个港口度数必须恰好等于数字，航线不交叉，并且所有港口都能沿航线互相抵达。三项同时满足才算通航。", bullets: ["局部小岛群不能单独封闭", "港口位置不变，双航线在同一路径两侧并排"], focus: "goal" },
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
    <g class="art-action"><path d="M64 140L160 44" fill="none" stroke="#64ddff" stroke-width="5" stroke-linecap="round" stroke-dasharray="9 8"/><circle cx="112" cy="92" r="8" fill="#7df9ff" filter="url(#realm-glow)"/><circle cx="160" cy="44" r="16" fill="none" stroke="#ffd66b" stroke-width="4"/><path d="M148 51l11-16 5 18z" fill="#64ddff"/><g transform="translate(64 140) rotate(45)"><path d="M-14 10L0-16 14 10 0 5z" fill="#f4fbff" stroke="#64ddff" stroke-width="3"/></g><rect x="260" y="100" width="22" height="42" rx="3" fill="#5d6f8d"/></g>`);
  if (focus === "goal") return svg("三枚能源芯全部回收，任务进度达到三分之三", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="url(#realm-sea)"/>${grid(48, 28, 7, 4, 32, "#ffffff18")}
    <g class="art-goal"><g fill="#7df9ff" filter="url(#realm-glow)"><circle cx="92" cy="70" r="11"/><circle cx="160" cy="70" r="11"/><circle cx="228" cy="70" r="11"/></g><g fill="none" stroke="#72efbb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M82 104l7 7 13-16"/><path d="M150 104l7 7 13-16"/><path d="M218 104l7 7 13-16"/></g><rect x="108" y="126" width="104" height="28" rx="14" fill="#123f4e" stroke="#7df9ff"/><text x="160" y="145" text-anchor="middle" fill="#dffeff" font-size="14" font-weight="800">3 / 3</text></g>`);
  return svg("回收艇、能源芯、引力锚、反应堆与残骸墙分开标示", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="url(#realm-sea)"/>${grid(48, 28, 7, 4, 32)}
    <g class="art-elements"><g transform="translate(82 58)"><path d="M-14 10L0-16 14 10 0 5z" fill="#f4fbff" stroke="#64ddff" stroke-width="3"/></g><circle cx="158" cy="58" r="10" fill="#7df9ff" filter="url(#realm-glow)"/><circle cx="238" cy="58" r="16" fill="none" stroke="#ffd66b" stroke-width="4"/><rect x="58" y="112" width="34" height="30" rx="3" fill="#5d6f8d"/><path d="M158 108l18 34h-36z" fill="#ff5d8f"/><text x="158" y="135" text-anchor="middle" fill="#fff" font-size="18" font-weight="900">!</text></g>`);
}

const MEMORY_FACE_COLORS = Object.freeze({
  "Ⅰ": "#ffcc70",
  "Ⅱ": "#7ec9d4",
  "Ⅲ": "#a8c879",
  "Ⅳ": "#e7d8b0",
  "Ⅴ": "#b89ad7",
  "Ⅵ": "#e58c62",
});

function memoryCube(x, y, scale = 1, faces = {}, rollState = "static") {
  const top = faces.top ?? { index: "Ⅰ", token: "" };
  const front = faces.front ?? { index: "Ⅳ", token: "" };
  const right = faces.right ?? { index: "Ⅲ", token: "" };
  const colorOf = (face) => MEMORY_FACE_COLORS[face.index] ?? "#e7d8b0";
  const topColor = colorOf(top);
  const frontColor = colorOf(front);
  const rightColor = colorOf(right);
  const facePath = (slot, face, color, path, fill) => `<path class="tutorial-memory-face" data-roll-state="${rollState}" data-slot="${slot}" data-face-index="${face.index}" data-face-color="${color}" d="${path}" fill="${fill}" stroke="${color}" stroke-width="2"/>`;
  const faceText = (dx, dy, face, color) => `<g class="tutorial-memory-face-mark" data-roll-state="${rollState}" data-slot="${dx === 0 ? "top" : dx < 0 ? "front" : "right"}" data-face-index="${face.index}" transform="translate(${dx} ${dy})"><rect x="-9" y="-8" width="18" height="16" rx="3" fill="#100f0dbb" stroke="${color}"/><text y="3" text-anchor="middle" fill="${color}" font-size="8" font-weight="900">${face.token || face.index}</text></g>`;
  return `<g class="tutorial-memory-cube" transform="translate(${x} ${y}) scale(${scale})">
    ${facePath("top", top, topColor, "M-34-12L0-33 34-12 0 9Z", "#7a4c2c")}${facePath("front", front, frontColor, "M-34-12L0 9V47L-34 26Z", "#39271d")}${facePath("right", right, rightColor, "M34-12L0 9V47L34 26Z", "#231b16")}
    ${faceText(0,-12,top,topColor)}${faceText(-14,23,front,frontColor)}${faceText(14,23,right,rightColor)}
  </g>`;
}

function memoryArk(focus) {
  if (focus === "action") return svg("真实向右翻滚提示：方舟沿 Z 轴转九十度，目标地格明确标出，新底面与地格交换符印", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#101735"/>
    <g class="art-action" data-direction="east" data-axis="Z" data-quarter-turns="1" data-bottom-face-index="Ⅲ" font-family="ui-sans-serif,system-ui,sans-serif"><rect x="28" y="28" width="100" height="128" rx="12" fill="#ffffff08" stroke="#ffffff20"/><rect x="192" y="28" width="100" height="128" rx="12" fill="#ffffff08" stroke="#ffffff20"/>${memoryCube(78,70,.72,{},"before")}${memoryCube(242,70,.72,{top:{index:"Ⅴ"},front:{index:"Ⅳ"},right:{index:"Ⅰ"}},"after")}<path d="M133 78Q160 42 187 78" fill="none" stroke="#ffc878" stroke-width="4" stroke-linecap="round"/><path d="M188 78l-11-2 7-9z" fill="#ffc878"/><text x="160" y="40" text-anchor="middle" fill="#fff0cf" font-size="10" font-weight="900">→ 向右翻滚 · Z +90°</text><g font-size="9" font-weight="800" text-anchor="middle"><rect x="44" y="122" width="68" height="23" rx="6" fill="#ef9c5c18" stroke="#ef9c5c"/><text x="78" y="137" fill="#ef9c5c">目标地格 ≋</text><rect x="208" y="122" width="68" height="23" rx="6" fill="#ef9c5c18" stroke="#ef9c5c"/><text x="242" y="137" fill="#ef9c5c">Ⅲ 底面收印</text></g></g>`);
  if (focus === "goal") return svg("真实归舱状态：六个带独立刻度的物理表面全部收印，地面已经清空", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#101735"/>
    <g class="art-goal" data-face-token-count="6" data-ground-token-count="0">${memoryCube(126,74,1.12,{top:{index:"Ⅰ",token:"✦"},front:{index:"Ⅳ",token:"⌁"},right:{index:"Ⅲ",token:"◇"}})}<g transform="translate(214 34)" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" font-weight="900">${[["Ⅰ","✦","#ffcc70"],["Ⅱ","≋","#7ec9d4"],["Ⅲ","◇","#a8c879"],["Ⅳ","⌁","#e7d8b0"],["Ⅴ","◉","#b89ad7"],["Ⅵ","∿","#e58c62"]].map(([index,token,color],i)=>`<g transform="translate(0 ${i*19})"><rect width="56" height="15" rx="5" fill="${color}18" stroke="${color}"/><text x="7" y="11" fill="${color}">${index}</text><text x="28" y="11" text-anchor="middle" fill="${color}">${token}</text><path d="M43 8l3 3 6-7" fill="none" stroke="#72efbb" stroke-width="2"/></g>`).join("")}</g><rect x="64" y="151" width="112" height="17" rx="8.5" fill="#ffffff0d" stroke="#ffffff24"/><text x="120" y="163" text-anchor="middle" fill="#dce2ff" font-size="9" font-weight="800">地面已清空</text></g>`);
  return svg("真实方舟表面具备Ⅰ至Ⅵ刻度与独立边色；地格符印与方舟表面符印清楚分开", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#101735"/>
    <g class="art-elements" font-family="ui-sans-serif,system-ui,sans-serif"><text x="82" y="44" text-anchor="middle" fill="#dce2ff" font-size="10" font-weight="800">地格符印</text><g font-size="18" font-weight="900" text-anchor="middle"><rect x="32" y="58" width="30" height="30" rx="5" fill="#ffc76620" stroke="#ffc766"/><text x="47" y="79" fill="#ffc766">✦</text><rect x="67" y="58" width="30" height="30" rx="5" fill="#7ec9d420" stroke="#7ec9d4"/><text x="82" y="79" fill="#7ec9d4">≋</text><rect x="102" y="58" width="30" height="30" rx="5" fill="#a8c87920" stroke="#a8c879"/><text x="117" y="79" fill="#a8c879">◇</text></g><g fill="#dce2ff" font-size="8" text-anchor="middle"><text x="47" y="102">曜印</text><text x="82" y="102">潮印</text><text x="117" y="102">生印</text></g><text x="221" y="34" text-anchor="middle" fill="#dce2ff" font-size="10" font-weight="800">方舟物理表面</text>${memoryCube(221,80,.95,{top:{index:"Ⅰ",token:"✦"},front:{index:"Ⅳ",token:"⌁"},right:{index:"Ⅲ",token:"◇"}})}<text x="221" y="155" text-anchor="middle" fill="#b6c1db" font-size="8" font-weight="800">Ⅰ–Ⅵ 刻度不会随朝向改变</text></g>`);
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

function tutorialFirefly(x, y, scale = 1, state = "萤") {
  return `<g class="tutorial-firefly" transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-3-2C-17-19-24-3-8 8M3-2C17-19 24-3 8 8" fill="#c2e8e244" stroke="#e8fbf5" stroke-width="1.5"/>
    <ellipse cy="1" rx="5" ry="13" fill="#162a25" stroke="#101a16" stroke-width="1.5"/>
    <path d="M-4-5H4M-5 1H5M-4 7H4" stroke="#ffd06a" stroke-width="5"/><circle cy="-12" r="5" fill="#142720" stroke="#d9f3ed"/>
    <circle cx="-2" cy="-13" r="1" fill="#ffd06a"/><circle cx="2" cy="-13" r="1" fill="#ffd06a"/>
    <rect x="8" y="-20" width="16" height="14" rx="4" fill="${state === "冲" ? "#852f30" : "#593c16"}" stroke="${state === "冲" ? "#ffd6d3" : "#ffe3a4"}" ${state === "冲" ? `stroke-dasharray="2 2"` : ""}/><text x="16" y="-10" text-anchor="middle" fill="#fff0c7" font-size="9" font-weight="900">${state}</text>
  </g>`;
}

function tutorialLitFlower(x, y, label = true) {
  return `<g class="tutorial-light" transform="translate(${x} ${y})">
    <g fill="#71b2bd" stroke="#d6f7f8" stroke-width="1"><ellipse cy="-6" rx="4" ry="8"/><ellipse cy="6" rx="4" ry="8"/><ellipse cx="-6" rx="8" ry="4"/><ellipse cx="6" rx="8" ry="4"/></g><circle r="3" fill="#effff9"/>
    ${label ? `<rect x="7" y="-13" width="15" height="13" rx="4" fill="#0a3944" stroke="#b9ecf3"/><text x="14.5" y="-4" text-anchor="middle" fill="#e3fbff" font-size="8" font-weight="900">光</text>` : ""}
  </g>`;
}

const FIREFLY_GOAL_LEVEL = FIREFLY_LEVELS.find(({ id }) => id === "dew-court");
const FIREFLY_GOAL_RESULT = evaluateFireflyPosition(FIREFLY_GOAL_LEVEL, {
  bulbs: FIREFLY_GOAL_LEVEL.solution,
});

function fireflyGoalBoard() {
  const gridX = 90;
  const gridY = 22;
  const cellSize = 28;
  const bulbs = new Set(FIREFLY_GOAL_LEVEL.solution);
  const cells = [];

  for (let row = 0; row < FIREFLY_GOAL_LEVEL.height; row += 1) {
    for (let column = 0; column < FIREFLY_GOAL_LEVEL.width; column += 1) {
      const cell = FIREFLY_GOAL_LEVEL.rows[row][column];
      const key = `${row}:${column}`;
      const x = gridX + column * cellSize;
      const y = gridY + row * cellSize;
      const centerX = x + cellSize / 2;
      const centerY = y + cellSize / 2;

      if (cell === "#") {
        cells.push(`<rect class="tutorial-wall" data-row="${row}" data-column="${column}" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="5" fill="#11201e" stroke="#71847c"/>`);
        continue;
      }
      if (/^[0-4]$/.test(cell)) {
        const rune = FIREFLY_GOAL_RESULT.runes.get(key);
        cells.push(`<g class="tutorial-rune" data-row="${row}" data-column="${column}" data-target="${rune.target}" data-count="${rune.count}" data-exact="${rune.exact}"><rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="5" fill="#11201e" stroke="#72efbb"/><text x="${centerX}" y="${centerY + 5}" text-anchor="middle" fill="#fff" font-size="15" font-weight="900">${cell}</text></g>`);
        continue;
      }

      const hasFirefly = bulbs.has(key);
      cells.push(`<g class="tutorial-plot is-lit${hasFirefly ? " has-firefly" : ""}" data-row="${row}" data-column="${column}" data-lit="${FIREFLY_GOAL_RESULT.light.has(key)}" data-firefly="${hasFirefly}"><rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#6ac8dc20"/>${hasFirefly ? tutorialFirefly(centerX, centerY, .46) : tutorialLitFlower(centerX, centerY, false)}</g>`);
    }
  }

  return cells.join("");
}

function firefly(focus) {
  if (focus === "action") return svg("琥珀色萤火实体送出蓝色正交光路；石墙截光，禁放标记只作笔记", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#092329"/>${grid(90, 22, 5, 5, 28, "#b4eaf032")}
    <g class="art-action" data-grid-x="90" data-grid-y="22" data-cell-size="28"><path d="M90 92H202M160 50V162" stroke="#6ac8dc" stroke-width="6" opacity=".34" stroke-dasharray="8 5"/><rect class="tutorial-wall" data-row="0" data-column="2" x="146" y="22" width="28" height="28" rx="5" fill="#11201e"/><rect class="tutorial-wall" data-row="2" data-column="4" x="202" y="78" width="28" height="28" rx="5" fill="#11201e"/>${tutorialLitFlower(132,92,false)}${tutorialLitFlower(188,92,false)}${tutorialLitFlower(160,120,false)}${tutorialFirefly(160,92,.78)}<path d="M99 119l12 12M111 119l-12 12" stroke="#c7dbd1" stroke-width="3" stroke-linecap="round"/><rect x="111" y="115" width="15" height="13" rx="4" fill="#173029" stroke="#c7dbd1"/><text x="118.5" y="124" text-anchor="middle" fill="#e0ebe5" font-size="8" font-weight="900">禁</text></g>`);
  if (focus === "goal") return svg("真实黎明状态：花圃呈蓝色照亮状态，萤火仍是琥珀虫形，数字石墙恰好满足", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#092329"/><rect x="90" y="22" width="140" height="140" rx="8" fill="#6ac8dc17"/>${grid(90, 22, 5, 5, 28, "#b4eaf05a")}
    <g class="art-goal" data-level="${FIREFLY_GOAL_LEVEL.id}" data-rows="${FIREFLY_GOAL_LEVEL.rows.join("/")}" data-solution="${FIREFLY_GOAL_LEVEL.solution.join(",")}" data-plot-count="${FIREFLY_GOAL_RESULT.totalPlots}" data-lit-count="${FIREFLY_GOAL_RESULT.litCount}" data-firefly-count="${FIREFLY_GOAL_RESULT.bulbs.size}" data-all-plots-lit="${FIREFLY_GOAL_RESULT.unlit.size === 0}" data-conflicts="${FIREFLY_GOAL_RESULT.conflicts.size}" data-runes-exact="${[...FIREFLY_GOAL_RESULT.runes.values()].every(({ exact }) => exact)}">${fireflyGoalBoard()}<circle cx="272" cy="48" r="15" fill="#72efbb"/><path d="M265 48l6 6 12-16" fill="none" stroke="#092329" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("真实花庭元素：琥珀虫形和萤角标是实体，蓝色花朵和光角标是照亮范围", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#092329"/>${grid(90, 22, 5, 5, 28, "#b4eaf032")}
    <g class="art-elements">${tutorialFirefly(104,50,.72)}${tutorialLitFlower(216,50)}<rect x="146" y="78" width="28" height="28" rx="5" fill="#11201e" stroke="#93a69f"/><text x="160" y="98" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">2</text><rect x="202" y="106" width="28" height="28" rx="5" fill="#11201e"/><rect x="90" y="106" width="28" height="28" fill="#0c3035" stroke="#86daea7a"/></g>`);
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
    <g class="art-action">${grid(38, 42, 4, 4, 24, "#ffffff22")}${grid(186, 42, 4, 4, 24, "#ffffff22")}<g fill="#ff698b"><circle cx="50" cy="54" r="8"/><circle cx="74" cy="54" r="8"/></g><g fill="#65d7ff"><circle cx="122" cy="54" r="8"/><circle cx="122" cy="78" r="8"/></g><g fill="#ffd76e"><circle cx="74" cy="102" r="8"/><circle cx="98" cy="126" r="8"/></g><text x="150" y="34" text-anchor="middle" fill="#ecd6ff" font-size="10" font-weight="800">① 先下落</text><path d="M150 70v36" stroke="#d4a5ff" stroke-width="4" stroke-linecap="round"/><path d="M150 110l-8-12h16z" fill="#d4a5ff"/><g fill="#65d7ff"><circle cx="246" cy="102" r="8"/><circle cx="246" cy="126" r="8"/></g><g fill="#ffd76e"><circle cx="198" cy="126" r="8"/><circle cx="222" cy="126" r="8"/></g><text x="252" y="34" text-anchor="middle" fill="#ecd6ff" font-size="10" font-weight="800">② 再左移</text><path d="M278 88h-24" stroke="#d4a5ff" stroke-width="4" stroke-linecap="round"/><path d="M250 88l12-8v16z" fill="#d4a5ff"/></g>`);
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

function spiritPearl(x, y, type, settled = false) {
  const isEarth = type === "earth";
  return `<g class="tutorial-pearl tutorial-pearl--${type}${settled ? " is-settled" : ""}">
    <circle cx="${x}" cy="${y}" r="13" fill="${settled ? "#84edcf2e" : "#84edcf12"}" stroke="${settled ? "#9ff4d9" : "#92e9d344"}"/>
    <circle cx="${x}" cy="${y}" r="8" fill="url(#spirit-${type})" stroke="${isEarth ? "#e4c37f" : "#f1f8ec"}" stroke-width="1.5"/>
    ${isEarth
      ? `<path d="M${x - 3.5} ${y}l3.5-3.5 3.5 3.5-3.5 3.5z" fill="none" stroke="#f5dc97" stroke-width=".8"/>`
      : `<path d="M${x - 4} ${y}q4-3.5 8 0q-4 3.5-8 0" fill="none" stroke="#124449" stroke-width=".8"/>`}
  </g>`;
}

function spiritTutorialDefs() {
  return `<defs>
    <linearGradient id="spirit-vein" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#56bda8"/><stop offset=".48" stop-color="#ddffe8"/><stop offset="1" stop-color="#d8bf75"/></linearGradient>
    <radialGradient id="spirit-earth" cx="35%" cy="27%" r="75%"><stop stop-color="#47645c"/><stop offset=".32" stop-color="#17383a"/><stop offset="1" stop-color="#031319"/></radialGradient>
    <radialGradient id="spirit-heaven" cx="34%" cy="27%" r="74%"><stop stop-color="#fff"/><stop offset=".46" stop-color="#c8e8df"/><stop offset="1" stop-color="#6baaa2"/></radialGradient>
  </defs>`;
}

function spiritDragon(focus) {
  if (focus === "action") return svg("真实灵图中的相邻节点、发光龙脉、游标圈与金色禁行记号", focus, `
    ${spiritTutorialDefs()}<rect x="18" y="14" width="284" height="156" rx="18" fill="#092a30" stroke="#bee8da2e"/>
    <g class="art-action" font-family="ui-sans-serif,system-ui,sans-serif">
      <g fill="none" stroke="#a7d6cb38" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1 6"><path d="M38 84H112M123 84H197M208 84H282"/></g>
      <g fill="#b1e1d376"><circle cx="38" cy="84" r="3"/><circle cx="112" cy="84" r="3"/><circle cx="123" cy="84" r="3"/><circle cx="197" cy="84" r="3"/><circle cx="208" cy="84" r="3"/><circle cx="282" cy="84" r="3"/></g>
      <circle cx="75" cy="84" r="20" fill="none" stroke="#9ff4d9" stroke-width="1.5" stroke-dasharray="3 3"/>
      <path d="M123 84H197" stroke="#020d11b3" stroke-width="10" stroke-linecap="round"/><path d="M123 84H197" stroke="url(#spirit-vein)" stroke-width="6" stroke-linecap="round"/>
      <path d="M239 75l12 18M251 75l-12 18" fill="none" stroke="#e6c784" stroke-width="3" stroke-linecap="round"/>
      <g fill="#c5d8d3" font-size="10" font-weight="800" text-anchor="middle"><text x="75" y="124">选中边</text><text x="160" y="124">龙脉线</text><text x="245" y="124">禁行笔记</text></g>
    </g>`);
  if (focus === "goal") return svg("云岫初引的真实过关布局：唯一闭环经过五颗灵珠并唤醒灵龙", focus, `
    ${spiritTutorialDefs()}<rect x="18" y="8" width="284" height="168" rx="18" fill="#092a30" stroke="#bee8da2e"/>
    <g class="art-goal" data-level="cloud-gate" data-pearl-count="5" data-loop-count="1">
      ${grid(88, 20, 4, 4, 36, "#a7d6cb32")}
      <g fill="#b1e1d365">${[20, 56, 92, 128, 164].flatMap((y) => [88, 124, 160, 196, 232].map((x) => `<circle cx="${x}" cy="${y}" r="2.2"/>`)).join("")}</g>
      <path d="M88 20H232V56H196V128H232V164H88V92H124V128H160V56H88Z" fill="none" stroke="#020d11b3" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M88 20H232V56H196V128H232V164H88V92H124V128H160V56H88Z" fill="none" stroke="url(#spirit-vein)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${spiritPearl(160, 56, "earth", true)}${spiritPearl(196, 20, "heaven", true)}${spiritPearl(196, 92, "heaven", true)}${spiritPearl(88, 128, "heaven", true)}${spiritPearl(196, 164, "heaven", true)}
      <g transform="translate(124 20) scale(.58)" fill="#eafbe8" stroke="#e6c784" stroke-width="1.5"><path d="M-16 0c6-9 18-10 28-3l7-4-3 8 4 6-9-3C1 12-10 9-16 0Z"/><circle cx="10" cy="-2" r="1.7" fill="#0b3a3b" stroke="none"/></g>
      <circle cx="278" cy="35" r="14" fill="#8fe09a"/><path d="M271 35l5 5 10-13" fill="none" stroke="#071d25" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`);
  return svg("真实灵图中的地珠与天珠：地珠上转弯，天珠上直行并在紧邻处转弯", focus, `
    ${spiritTutorialDefs()}<rect x="18" y="14" width="284" height="156" rx="18" fill="#092a30" stroke="#bee8da2e"/>
    <g class="art-elements" font-family="ui-sans-serif,system-ui,sans-serif">
      <g fill="none" stroke="#a7d6cb38" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1 6"><path d="M34 50H142M34 82H142M34 114H142M178 50H286M178 82H286M178 114H286"/></g>
      <g fill="#b1e1d376">${[[34,50],[70,50],[106,50],[142,50],[106,82],[106,114],[178,82],[214,82],[250,82],[286,82],[286,114]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="2.7"/>`).join("")}</g>
      <path d="M34 50H106V114" fill="none" stroke="#020d11b3" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 50H106V114" fill="none" stroke="url(#spirit-vein)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${spiritPearl(106, 50, "earth", true)}
      <path d="M178 82H286V114" fill="none" stroke="#020d11b3" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M178 82H286V114" fill="none" stroke="url(#spirit-vein)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${spiritPearl(250, 82, "heaven", true)}
      <g fill="#d9e9e3" font-size="10" font-weight="800" text-anchor="middle"><text x="88" y="148">地珠 · 珠上转弯</text><text x="232" y="148">天珠 · 紧邻处转弯</text></g>
    </g>`);
}

function mirrorActor(x, y, type, scale = 1) {
  if (type === "human") return `<g class="tutorial-actor tutorial-actor--human" transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cy="-12" rx="10" ry="12" fill="#ffd2c5"/><path d="M-10-15q10-13 20 0v5q-3-7-7-9-7 6-13 7z" fill="#7d2039"/>
    <path d="M-22 26q2-25 15-31l7 8 7-8q13 6 15 31z" fill="#ff8b72" stroke="#ffd8ce" stroke-width="2"/><path d="M-7-4L0 3l7-7 5 22H-12z" fill="#6f1932"/><path d="M-4 10h8v8h-8z" fill="#efcf81" transform="rotate(45)"/>
  </g>`;
  if (type === "hologram") return `<g class="tutorial-actor tutorial-actor--hologram" transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cy="-12" rx="10" ry="12" fill="#67e4eb30" stroke="#b9fbff" stroke-width="2"/><path d="M-6-13h12M-8-8H5" stroke="#67e4eb" stroke-width="2" opacity=".8"/>
    <path d="M0-1C-15-2-21 8-22 26H22C21 8 15-2 0-1Z" fill="#67e4eb28" stroke="#67e4eb" stroke-width="2"/>
    <path d="M-17 7H17M-19 14H19M-20 21H20" stroke="#b9fbff" stroke-width="2" opacity=".72"/><ellipse cy="28" rx="18" ry="3" fill="#67e4eb" opacity=".75"/>
  </g>`;
  return `<g class="tutorial-actor tutorial-actor--robot" transform="translate(${x} ${y}) scale(${scale})">
    <path d="M0-31v6M-4-31h8" stroke="#efcf81" stroke-width="2"/><rect x="-13" y="-25" width="26" height="20" rx="5" fill="#4f4328" stroke="#ffe5a3" stroke-width="2"/>
    <circle cx="-5" cy="-15" r="2.5" fill="#67e4eb"/><circle cx="5" cy="-15" r="2.5" fill="#67e4eb"/><path d="M-6-8H6" stroke="#efcf81" stroke-width="2"/>
    <rect x="-18" y="0" width="36" height="27" rx="5" fill="#6c592f" stroke="#efcf81" stroke-width="2"/><rect x="-8" y="6" width="16" height="11" rx="2" fill="#241d17"/><circle cx="-3" cy="11.5" r="1.5" fill="#ff8b72"/><circle cx="3" cy="11.5" r="1.5" fill="#8fe09a"/><path d="M-12 27v6M12 27v6" stroke="#efcf81" stroke-width="3"/>
  </g>`;
}

const MIRROR_GOAL_LEVEL = MIRROR_LEVELS.find(({ id }) => id === "velvet-foyer");
const MIRROR_GOAL_POSITION = mirrorSolutionPosition(MIRROR_GOAL_LEVEL);
const MIRROR_GOAL_RESULT = evaluateMirrorPosition(MIRROR_GOAL_LEVEL, MIRROR_GOAL_POSITION);
const MIRROR_ACTOR_BY_CODE = Object.freeze({
  H: MIRROR_ACTOR.HUMAN,
  O: MIRROR_ACTOR.HOLOGRAM,
  R: MIRROR_ACTOR.ROBOT,
});

function mirrorGoalBoard() {
  const gridX = 108;
  const gridY = 34;
  const cellSize = 26;
  const cells = [];

  for (let row = 0; row < MIRROR_GOAL_LEVEL.height; row += 1) {
    for (let column = 0; column < MIRROR_GOAL_LEVEL.width; column += 1) {
      const puzzleCell = MIRROR_GOAL_LEVEL.rows[row][column];
      const solutionCell = MIRROR_GOAL_LEVEL.solution[row][column];
      const x = gridX + column * cellSize;
      const y = gridY + row * cellSize;
      const centerX = x + cellSize / 2;
      const centerY = y + cellSize / 2;
      if (puzzleCell === "/" || puzzleCell === "\\") {
        const blade = puzzleCell === "/"
          ? `M${x + 5} ${y + 21}L${x + 21} ${y + 5}`
          : `M${x + 5} ${y + 5}L${x + 21} ${y + 21}`;
        cells.push(`<g class="tutorial-stage-cell tutorial-mirror-cell" data-row="${row}" data-column="${column}" data-kind="mirror" data-mirror="${puzzleCell}"><rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" fill="#332440" stroke="#ffffff2f"/><path d="${blade}" stroke="#a9e8ff" stroke-width="4" stroke-linecap="round"/></g>`);
        continue;
      }
      const actor = MIRROR_ACTOR_BY_CODE[solutionCell];
      cells.push(`<g class="tutorial-stage-cell tutorial-actor-cell" data-row="${row}" data-column="${column}" data-kind="actor" data-actor-code="${solutionCell}" data-actor="${actor}"><rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" fill="#291d34" stroke="#ffffff24"/>${mirrorActor(centerX, centerY, actor, .26)}</g>`);
    }
  }

  const clue = (side, index, x, y) => {
    const result = MIRROR_GOAL_RESULT.edgeResults.get(`${side}:${index}`);
    return `<g class="tutorial-edge-clue is-exact" data-side="${side}" data-index="${index}" data-clue="${result.clue}" data-visible="${result.visible}" data-exact="${result.exact}" transform="translate(${x} ${y})"><circle r="8" fill="#d8f8c9" stroke="#72efbb" stroke-width="1.5"/><text y="3.5" text-anchor="middle" fill="#173827" font-size="9" font-weight="900">${result.clue}</text></g>`;
  };
  for (let index = 0; index < MIRROR_GOAL_LEVEL.width; index += 1) {
    const x = gridX + index * cellSize + cellSize / 2;
    cells.push(clue("top", index, x, 22));
    cells.push(clue("bottom", index, x, 150));
  }
  for (let index = 0; index < MIRROR_GOAL_LEVEL.height; index += 1) {
    const y = gridY + index * cellSize + cellSize / 2;
    cells.push(clue("left", index, 96, y));
    cells.push(clue("right", index, 224, y));
  }

  return cells.join("");
}

function mirror(focus) {
  if (focus === "action") return svg("观众视线进入舞台，遇到斜镜后转向并沿反射路径继续计数", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#21152d"/>${grid(76, 22, 6, 5, 28, "#ffffff1f")}
    <g class="art-action"><circle cx="48" cy="50" r="14" fill="#fff2b0"/><text x="48" y="55" text-anchor="middle" fill="#473715" font-size="14" font-weight="800">2</text><path d="M62 50H132V134H224" fill="none" stroke="#ffd66e" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 5"/><path d="M118 36l28 28" stroke="#a9e8ff" stroke-width="6"/>${mirrorActor(160, 78, "hologram", .56)}${mirrorActor(188, 134, "robot", .5)}<path d="M217 128l12 6-12 6z" fill="#ffd66e"/></g>`);
  if (focus === "goal") return svg("绒幕试光的四乘四舞台完整填入十一位演员，五面镜子、演员总数与十六条边缘线索全部精确", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#21152d"/>
    <g class="art-goal" data-level="${MIRROR_GOAL_LEVEL.id}" data-width="${MIRROR_GOAL_LEVEL.width}" data-height="${MIRROR_GOAL_LEVEL.height}" data-rows="${MIRROR_GOAL_LEVEL.rows.join("/")}" data-solution="${MIRROR_GOAL_LEVEL.solution.join("/")}" data-filled="${MIRROR_GOAL_RESULT.emptyKeys.size === 0}" data-floor-count="${MIRROR_GOAL_RESULT.floorCount}" data-actor-count="${MIRROR_GOAL_RESULT.filledCount}" data-mirror-count="${MIRROR_GOAL_LEVEL.width * MIRROR_GOAL_LEVEL.height - MIRROR_GOAL_RESULT.floorCount}" data-cast-human="${MIRROR_GOAL_RESULT.actorCounts[MIRROR_ACTOR.HUMAN]}" data-cast-hologram="${MIRROR_GOAL_RESULT.actorCounts[MIRROR_ACTOR.HOLOGRAM]}" data-cast-robot="${MIRROR_GOAL_RESULT.actorCounts[MIRROR_ACTOR.ROBOT]}" data-cast-exact="${MIRROR_GOAL_RESULT.totalsExact}" data-edge-count="${MIRROR_GOAL_RESULT.totalEdges}" data-exact-edge-count="${MIRROR_GOAL_RESULT.exactEdges}" data-edges-exact="${MIRROR_GOAL_RESULT.edgesExact}" font-family="ui-sans-serif,system-ui,sans-serif">${mirrorGoalBoard()}<rect x="84" y="157" width="152" height="13" rx="6.5" fill="#31233f" stroke="#ffffff24"/><g font-size="8" font-weight="900" text-anchor="middle"><text x="112" y="166.5" fill="#ffb8aa">真人 ${MIRROR_GOAL_LEVEL.targets[MIRROR_ACTOR.HUMAN]}</text><text x="160" y="166.5" fill="#9af8fc">全息 ${MIRROR_GOAL_LEVEL.targets[MIRROR_ACTOR.HOLOGRAM]}</text><text x="208" y="166.5" fill="#ffe3a0">机械 ${MIRROR_GOAL_LEVEL.targets[MIRROR_ACTOR.ROBOT]}</text></g><circle cx="272" cy="90" r="15" fill="#72efbb"/><path d="M265 90l6 6 12-16" fill="none" stroke="#173827" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("真人、全息演员、机械演员和斜镜分别使用独立形状", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#21152d"/>
    <g class="art-elements">${mirrorActor(78, 78, "human", .86)}${mirrorActor(160, 78, "hologram", .86)}${mirrorActor(242, 78, "robot", .86)}<g fill="#e9dff5" font-size="11" font-weight="800" text-anchor="middle"><text x="78" y="145">真人 · 直视</text><text x="160" y="145">全息 · 镜中</text><text x="242" y="145">机械 · 始终</text></g><path d="M274 30l22 22" stroke="#a9e8ff" stroke-width="5"/></g>`);
}

const ART_RENDERERS = {
  "star-drift": starDriftTutorialArt,
  "memory-ark": memoryArk,
  "red-thread-office": redThreadTutorialArt,
  "firefly-garden": firefly,
  "abyss-echo": abyssTutorialArt,
  "storm-lanterns": stormTutorialArt,
  "night-market-spirits": nightMarketTutorialArt,
  "sky-bridges": skyBridgesTutorialArt,
  "spirit-dragon": spiritDragon,
  "mirror-theatre": mirror,
};

export function tutorialArt(realmId, focus = "elements") {
  return ART_RENDERERS[realmId]?.(focus) ?? "";
}
