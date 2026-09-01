export const REALM_TUTORIALS = Object.freeze({
  "cloud-camp": {
    title: "云端露营季",
    token: "星火营钉",
    accent: "#ffb45f",
    accentRgb: "255, 180, 95",
    version: 2,
    cards: [
      { tag: "读懂浮地", title: "云杉、帐篷与边缘数字", body: "深绿树冠是固定的云杉；其他格子可以搭帐篷或留下草地笔记。上方数字管每列，右侧数字管每行。", bullets: ["数字要精确满足", "云杉格不可落子"], focus: "elements" },
      { tag: "三态布营", title: "在未知、帐篷和草地之间切换", body: "用帐篷工具落营，用草地工具排除候选格。帐篷必须与云杉正交相邻，但界面同时响应的多棵树都只是候选，不是固定配对。", bullets: ["帐篷八方向不得接触", "草地标记不参与胜负"], focus: "action" },
      { tag: "篝火入夜", title: "同时通过数字、间距与全局配对", body: "帐篷总数与云杉相同，每行每列数字刚好满足，帐篷互不接触，并且存在覆盖所有树与帐篷的一一对应，篝火才会点亮。", bullets: ["每顶帐篷旁有树仍可能不够", "正确时可留下未标记空格"], focus: "goal" },
    ],
  },
  "mist-photo-studio": {
    title: "雾都照相馆",
    token: "馆藏底片",
    accent: "#f04d48",
    accentRgb: "240, 77, 72",
    version: 2,
    cards: [
      { tag: "读取底片边签", title: "数字按顺序记录黑格连续段", body: "每行左侧、每列上方的数字，依次写出该行或列中黑格连续段的长度。两段之间至少隔一格留白；短横线表示整条都不填黑。", bullets: ["行提示从左向右读取", "列提示从上向下读取"], focus: "elements" },
      { tag: "三态显影", title: "显影、排除与未知必须清楚区分", body: "填黑是照片影像，红色 × 是确认留白，淡色圆点仍是未知。触控先选工具再点格；键盘 Enter 正向循环，Space 反向循环。", bullets: ["右键可直接排除", "Shift 点击可回到未知"], focus: "action" },
      { tag: "照片入册", title: "全盘明确且所有行列吻合", body: "只有每一格都离开未知状态，并让全部行列的连续段顺序与长度精确匹配，照片才会显现并收入图鉴。", bullets: ["仅填对黑格、留白仍未知不算完成", "九张底片均由求解器证明唯一解"], focus: "goal" },
    ],
  },
  "mystic-perfumery": {
    title: "神秘调香所",
    token: "密封香签",
    accent: "#d29a5c",
    accentRgb: "210, 154, 92",
    version: 2,
    cards: [
      { tag: "辨认精华", title: "颜色之外，每种精华都有自己的形与纹", body: "玫瑰、佛手、雪松等精华同时使用不同轮廓、纹理和汉字短名。上方密封槽就是要复原的秘密香方。", bullets: ["同一种精华可以重复出现", "当前三档都不允许空槽提交"], focus: "elements" },
      { tag: "调香验印", title: "逐槽放香，再读取两类聚合香印", body: "选择香槽与精华，放满后封蜡验香。实心星印表示精华和位置都正确；空心菱印表示精华正确但位置错误。", bullets: ["留香会把该槽复制到下一轮", "香印不对应任何具体槽位"], focus: "action" },
      { tag: "香瓶成形", title: "在轮数用尽前完全复原秘密香方", body: "当每一滴精华与位置都完全命中，调香瓶便会成形并收入配方图鉴。剩余轮数越多，评级越高。", bullets: ["最后一轮完全命中仍然获胜", "每日香方与稀有香瓶长期留档"], focus: "goal" },
    ],
  },
  "nebula-hatchery": {
    title: "星云孵化场",
    token: "孵化星尘",
    accent: "#86f2d0",
    accentRgb: "134, 242, 208",
    version: 2,
    cards: [
      { tag: "辨认星核", title: "星核可以落在格心、边心或角点", body: "格心核起初属于一格；边心核两侧的格子、角点核四周的格子必须留在同一片星云。", bullets: ["边界永远不能穿过星核", "每片星云最终恰含一枚星核"], focus: "elements" },
      { tag: "划出孵化舱", title: "在细网格边上绘制或擦除边界", body: "边界笔会改变正式分区。归属笔记则先选星核、再选方格，同时标出它绕该核旋转半周后的伙伴格。", bullets: ["归属笔记不参与胜负判定", "可随时撤销或切换擦除笔"], focus: "action" },
      { tag: "稳定星云", title: "连通、一核、半周对称同时成立", body: "每片四向连通的星云都必须恰含一枚中心星核，并在绕核旋转 180° 后与自身完全重合。全盘每格都稳定才完成孵化。", bullets: ["星云可以凹陷，不必是矩形", "只共用角点的方格不算连通"], focus: "goal" },
    ],
  },
  "neon-skyline": {
    title: "霓虹天际线",
    token: "城市蓝图",
    accent: "#63f3ff",
    accentRgb: "99, 243, 255",
    version: 2,
    cards: [
      { tag: "读取街景", title: "数字是楼高，街口是观察点", body: "每格最终建一座 1 到 N 层的楼；四周数字表示从该街口能看见几座，较高建筑会遮住后方较矮建筑。", bullets: ["横竖每种高度各一次", "空白街口表示没有线索"], focus: "elements" },
      { tag: "落塔规划", title: "选格，再落下楼高或候选", body: "点选地块后用数字面板建楼。开启蓝图笔记时，同一数字会作为候选反复开关；正式建楼或清除都会擦掉该格候选。", bullets: ["带锁地块是不可修改的预填塔", "方向键、数字键与触控均可完成"], focus: "action" },
      { tag: "城市点亮", title: "拉丁街区与全部视线同时成立", body: "每行每列都恰好包含 1 到 N，并让所有存在的四边观察数字精确吻合，整片城市才会接通夜航灯带。", bullets: ["候选不参与通关判定", "零冲突与更少操作会记录在城市版图"], focus: "goal" },
    ],
  },
});

const NATIVE_REALM_CONFIGS = Object.freeze({
  "polar-railway": Object.freeze({ title: "极地蒸汽列车", token: "极光车票", accent: "#77d9f5", accentRgb: "119, 217, 245", nativeTutorialSelector: "#tutorial-button" }),
  "season-dyehouse": Object.freeze({ title: "四季染坊", token: "四时染签", accent: "#d7aa56", accentRgb: "215, 170, 86", nativeTutorialSelector: "#tutorial-button" }),
  "yokai-inn": Object.freeze({ title: "妖怪旅店", token: "百鬼房牌", accent: "#f0c468", accentRgb: "240, 196, 104", nativeTutorialSelector: "#tutorial-button" }),
  "aurora-magnet-lab": Object.freeze({ title: "极光磁场实验室", token: "磁场棱镜", accent: "#62f2e6", accentRgb: "98, 242, 230", nativeTutorialSelector: "#tutorial-button" }),
  "dream-hotel": Object.freeze({ title: "梦境旅舍", token: "梦境房卡", accent: "#c7a9ff", accentRgb: "199, 169, 255", nativeTutorialSelector: "#tutorial-button" }),
  "time-sand-post": Object.freeze({ title: "时砂邮路局", token: "时砂邮戳", accent: "#ffc96b", accentRgb: "255, 201, 107", nativeTutorialSelector: "#tutorial-button" }),
  "molten-core-vent": Object.freeze({ title: "熔心泄压站", token: "熔心阀芯", accent: "#5fe5de", accentRgb: "95, 229, 222", nativeTutorialSelector: "#tutorial-button" }),
  "paper-crane-sanctuary": Object.freeze({ title: "纸鹤归巢台", token: "月羽折签", accent: "#efb4b1", accentRgb: "239, 180, 177", nativeTutorialSelector: "#tutorial-button" }),
  "resonance-bell-room": Object.freeze({ title: "万象共振钟房", token: "共振音徽", accent: "#f4c56a", accentRgb: "244, 197, 106", nativeTutorialSelector: "#tutorial-button" }),
  "four-spirit-habitat": Object.freeze({ title: "四灵栖境署", token: "四灵栖印", accent: "#e8d48f", accentRgb: "232, 212, 143", nativeTutorialSelector: "#tutorial-button" }),
});

export const REALM_CONFIGS = Object.freeze({
  ...Object.fromEntries(Object.entries(REALM_TUTORIALS).map(([realmId, tutorial]) => [realmId, Object.freeze({
    title: tutorial.title,
    token: tutorial.token,
    accent: tutorial.accent,
    accentRgb: tutorial.accentRgb,
  })])),
  ...NATIVE_REALM_CONFIGS,
});

function svg(label, focus, content) {
  const hash = [...label].reduce((value, character) => ((value * 31) + character.codePointAt(0)) >>> 0, 17).toString(36);
  const prefix = `realm-art-${hash}-${focus}`;
  const scopedContent = content
    .replaceAll("url(#realm-glow)", `url(#${prefix}-glow)`)
    .replaceAll("url(#realm-sea)", `url(#${prefix}-sea)`);
  return `<svg class="realm-art" data-focus="${focus}" viewBox="0 0 320 184" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="${prefix}-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="${prefix}-sea" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#122849"/><stop offset="1" stop-color="#07111f"/></linearGradient>
    </defs>${scopedContent}</svg>`;
}

const grid = (x, y, columns, rows, size, color = "#ffffff24") => {
  let lines = "";
  for (let column = 0; column <= columns; column += 1) lines += `<path d="M${x + column * size} ${y}V${y + rows * size}"/>`;
  for (let row = 0; row <= rows; row += 1) lines += `<path d="M${x} ${y + row * size}H${x + columns * size}"/>`;
  return `<g fill="none" stroke="${color}" stroke-width="1">${lines}</g>`;
};

function cloudCamp(focus) {
  const cloudTree = (x, y, glow = false) => `<g transform="translate(${x} ${y})"${glow ? ' filter="url(#realm-glow)"' : ""}><path d="M0-25L-16 3H16Z" fill="#8fbd87"/><path d="M0-14L-20 16H20Z" fill="#5f9474"/><rect x="-3" y="14" width="6" height="10" rx="2" fill="#80664f"/></g>`;
  const campTent = (x, y, lit = false) => `<g transform="translate(${x} ${y})"><path d="M0-25L24 17H-24Z" fill="#f3b26a"/><path d="M0-25L24 17H0Z" fill="#c66c57"/><path d="M0-8L8 17H-8Z" fill="#493243"/>${lit ? '<path d="M25 16c-8-10 4-18 7-28 8 10 9 20 0 28z" fill="#ffbd62" filter="url(#realm-glow)"/>' : ""}</g>`;
  if (focus === "action") return svg("同一空地依次展示未知、帐篷和草地排除，帐篷左右两棵候选云杉同时发光", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#14364a"/>
    <g class="art-action"><g fill="#355f55" stroke="#d9e8d030" stroke-width="2"><rect x="34" y="66" width="52" height="52" rx="10"/><rect x="134" y="66" width="52" height="52" rx="10"/><rect x="234" y="66" width="52" height="52" rx="10"/></g><circle cx="60" cy="92" r="4" fill="#dfe8d4" opacity=".45"/>${campTent(160, 96)}<g stroke="#bfd2b7" stroke-width="5" stroke-linecap="round"><path d="M248 80l24 24M272 80l-24 24"/></g><g transform="translate(108 92) scale(.66)">${cloudTree(0, 0, true)}</g><g transform="translate(212 92) scale(.66)">${cloudTree(0, 0, true)}</g><path d="M119 92h14M187 92h14" stroke="#ffc978" stroke-width="3" stroke-dasharray="5 5"/><g fill="#d7e3dc" font-size="10" font-weight="800" text-anchor="middle"><text x="60" y="140">未知</text><text x="160" y="140">帐篷</text><text x="260" y="140">草地</text></g></g>`);
  if (focus === "goal") return svg("四乘四浮地中帐篷互不接触，行列数字全部变绿并点亮篝火", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#102d46"/>${grid(88, 32, 4, 4, 28, "#e7eee243")}
    <g class="art-goal">${cloudTree(102, 72)}${cloudTree(186, 44)}${cloudTree(158, 128)}${campTent(130, 128, true)}${campTent(186, 72, true)}${campTent(102, 44, true)}<g fill="#9ce0b2" font-size="12" font-weight="900" text-anchor="middle"><text x="102" y="25">1</text><text x="130" y="25">1</text><text x="158" y="25">0</text><text x="186" y="25">1</text><text x="248" y="48">1</text><text x="248" y="76">1</text><text x="248" y="104">0</text><text x="248" y="132">1</text></g><path d="M264 128l8 8 17-22" fill="none" stroke="#8ce0b0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("浮地棋盘分别展示云杉、观星帐篷、草地标记以及上方列数字和右侧行数字", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#14364a"/>${grid(76, 42, 5, 4, 28, "#e7eee23b")}
    <g class="art-elements"><g fill="#f7d9a1" font-size="12" font-weight="900" text-anchor="middle"><text x="90" y="34">1</text><text x="118" y="34">0</text><text x="146" y="34">1</text><text x="174" y="34">1</text><text x="202" y="34">0</text><text x="224" y="58">1</text><text x="224" y="86">1</text><text x="224" y="114">0</text><text x="224" y="142">1</text></g>${cloudTree(118, 83)}${campTent(174, 143)}<g stroke="#bfd2b7" stroke-width="5" stroke-linecap="round"><path d="M82 106l16 16M98 106l-16 16"/></g><g fill="#d7e3dc" font-size="8" font-weight="800" text-anchor="middle"><text x="38" y="27">上方</text><text x="38" y="38">列数</text><text x="262" y="158">右侧行数</text></g></g>`);
}

function mistPhoto(focus) {
  const photo = ["00100", "01110", "11111", "00100", "01100"];
  const photoGrid = (stateClass, completed) => {
    let cells = "";
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const filled = photo[row][column] === "1";
        const x = 126 + column * 23;
        const y = 43 + row * 23;
        cells += `<rect x="${x}" y="${y}" width="22" height="22" fill="${filled ? "#171313" : "#ddcfb2"}" stroke="#6f6254" stroke-width="1"/>`;
        if (completed && !filled) cells += `<path d="M${x + 6} ${y + 6}l10 10m0-10l-10 10" stroke="#a43b36" stroke-width="2.4" stroke-linecap="round"/>`;
      }
    }
    return `<g class="${stateClass}">${cells}</g>`;
  };
  if (focus === "action") return svg("显影、排除和未知三种真实格态，配有鼠标与键盘操作提示", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#241416"/>
    <g class="art-action"><g transform="translate(51 49)"><rect width="58" height="58" rx="5" fill="#151212" stroke="#eb6b61" stroke-width="2"/><rect x="8" y="8" width="42" height="42" fill="#090808"/><text x="29" y="79" text-anchor="middle" fill="#f1ded7" font-size="11" font-weight="800">显影 · F</text></g><g transform="translate(131 49)"><rect width="58" height="58" rx="5" fill="#ddcfb2" stroke="#eb6b61" stroke-width="2"/><path d="M15 15l28 28m0-28L15 43" stroke="#a53632" stroke-width="5" stroke-linecap="round"/><text x="29" y="79" text-anchor="middle" fill="#f1ded7" font-size="11" font-weight="800">排除 · X</text></g><g transform="translate(211 49)"><rect width="58" height="58" rx="5" fill="#cdbf9f" stroke="#eb6b61" stroke-width="2"/><circle cx="29" cy="29" r="4" fill="#6e6252"/><text x="29" y="79" text-anchor="middle" fill="#f1ded7" font-size="11" font-weight="800">未知 · Del</text></g><path d="M94 34c12-14 23-14 35 0M174 34c12-14 23-14 35 0" fill="none" stroke="#ff8174" stroke-width="2.5" stroke-linecap="round"/><text x="160" y="154" text-anchor="middle" fill="#a98c8a" font-size="10">Enter 正向循环 · Space 反向循环</text></g>`);
  if (focus === "goal") return svg("完整雨伞剪影的所有黑格与排除格都已明确，行列提示全部核验", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#241416"/>
    <rect x="111" y="28" width="144" height="136" rx="5" fill="#c3b18e" stroke="#ef786d" stroke-width="2"/>${photoGrid("art-goal", true)}
    <g fill="#f0d9ca" font-size="10" font-weight="800" text-anchor="middle"><text x="137" y="38">1</text><text x="160" y="27">2</text><text x="160" y="38">1</text><text x="183" y="38">5</text><text x="206" y="38">2</text><text x="229" y="38">1</text></g><g fill="#f0d9ca" font-size="10" font-weight="800" text-anchor="end"><text x="120" y="58">1</text><text x="120" y="81">3</text><text x="120" y="104">5</text><text x="120" y="127">1</text><text x="120" y="150">2</text></g><path d="M267 72l8 8 17-22" fill="none" stroke="#b9d6a0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><text x="64" y="70" text-anchor="middle" fill="#ff8174" font-size="12" font-weight="900">全部明确</text><text x="64" y="91" text-anchor="middle" fill="#d6c1ba" font-size="10">黑格 + 排除格</text><text x="64" y="116" text-anchor="middle" fill="#b9d6a0" font-size="11" font-weight="800">行列吻合</text>`);
  return svg("真实数织底片展示行列连续段提示、相纸网格与三种格态", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#241416"/>
    <rect x="112" y="24" width="143" height="140" rx="5" fill="#c3b18e"/>${photoGrid("art-elements", false)}
    <g fill="#f0d9ca" font-size="10" font-weight="800" text-anchor="middle"><text x="137" y="38">1</text><text x="160" y="27">2</text><text x="160" y="38">1</text><text x="183" y="38">5</text><text x="206" y="38">2</text><text x="229" y="38">1</text></g><g fill="#f0d9ca" font-size="10" font-weight="800" text-anchor="end"><text x="120" y="58">1</text><text x="120" y="81">3</text><text x="120" y="104">5</text><text x="120" y="127">1</text><text x="120" y="150">2</text></g><path d="M51 56h41M51 93h41" stroke="#ff8174" stroke-width="2" stroke-linecap="round"/><text x="71" y="47" text-anchor="middle" fill="#ff8174" font-size="11" font-weight="900">列提示</text><text x="71" y="84" text-anchor="middle" fill="#ff8174" font-size="11" font-weight="900">行提示</text><text x="71" y="122" text-anchor="middle" fill="#d7c2ba" font-size="9">数字顺序不可交换</text>`);
}

function mysticPerfumery(focus) {
  if (focus === "action") return svg("四个香槽已经放满精华，第二槽带留香签，右侧聚合反馈显示两个完全命中与一个成分命中", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#1b1122"/>
    <g class="art-action" font-family="ui-sans-serif, system-ui, sans-serif">
      <text x="38" y="39" fill="#d7b477" font-size="10" font-weight="800">本轮香方</text>
      <g transform="translate(40 55)"><circle cx="18" cy="18" r="16" fill="#a83e62" stroke="#f4dfbf" stroke-width="2"/><text x="18" y="23" text-anchor="middle" fill="#fff" font-size="12" font-weight="900">玫</text></g>
      <g transform="translate(82 55)"><path d="M18 1L35 18 18 35 1 18Z" fill="#d88b39" stroke="#f4dfbf" stroke-width="2"/><path d="M7 13l22 10M7 20l16 8" stroke="#fff8" stroke-width="2"/><text x="18" y="23" text-anchor="middle" fill="#fff" font-size="12" font-weight="900">柑</text><path d="M7 43h22v18H7z" fill="#7b3853"/><text x="18" y="56" text-anchor="middle" fill="#fff" font-size="8" font-weight="800">留</text></g>
      <g transform="translate(124 55)"><rect x="2" y="2" width="32" height="32" rx="4" fill="#397d65" stroke="#f4dfbf" stroke-width="2"/><path d="M8 2v32M16 2v32M24 2v32" stroke="#153f3155" stroke-width="2"/><text x="18" y="23" text-anchor="middle" fill="#fff" font-size="12" font-weight="900">松</text></g>
      <g transform="translate(166 55)"><path d="M18 1L35 34H1Z" fill="#765191" stroke="#f4dfbf" stroke-width="2"/><path d="M18 7v24M10 25l8-18 8 18" stroke="#fff6" stroke-width="2"/><text x="18" y="27" text-anchor="middle" fill="#fff" font-size="11" font-weight="900">鸢</text></g>
      <path d="M218 70h52" stroke="#d7b477" stroke-width="3" stroke-dasharray="6 4"/><path d="M274 70l-10-6v12z" fill="#d7b477"/>
      <g transform="translate(220 91)" data-feedback="2-exact-1-misplaced"><path d="M12 0l4 8 8-4-4 8 8 4-8 4 4 8-8-4-4 8-4-8-8 4 4-8-8-4 8-4-4-8 8 4z" transform="scale(.62)" fill="#8f4962"/><path d="M12 0l4 8 8-4-4 8 8 4-8 4 4 8-8-4-4 8-4-8-8 4 4-8-8-4 8-4-4-8 8 4z" transform="translate(22) scale(.62)" fill="#8f4962"/><path d="M55 2l10 10-10 10-10-10z" fill="none" stroke="#b99ac2" stroke-width="3"/><text x="34" y="48" text-anchor="middle" fill="#eadcf0" font-size="9" font-weight="800">完全 2 · 成分 1</text></g>
    </g>`);
  if (focus === "goal") return svg("四滴秘密香方完全命中，三星彩色香瓶成形并收入配方柜", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#1b1122"/>
    <g class="art-goal" font-family="ui-sans-serif, system-ui, sans-serif">
      <g transform="translate(104 24)"><path d="M35 0h26l5 14H30z" fill="#d9a15f" stroke="#f0c988" stroke-width="2"/><path d="M39 14h18v20H39z" fill="#ece1d0aa" stroke="#b58aa2" stroke-width="2"/><path d="M16 38q0-8 10-8h44q10 0 10 8v82q0 10-10 10H26q-10 0-10-10z" fill="#ece1d044" stroke="#dfc6d4" stroke-width="3"/><path d="M21 75h54v40q0 10-10 10H31q-10 0-10-10z" fill="#794a8c"/><path d="M21 86c14-8 38 8 54 0" fill="none" stroke="#c06083" stroke-width="9"/><circle cx="48" cy="72" r="16" fill="#efe0c5" stroke="#70455b" stroke-width="2"/><text x="48" y="78" text-anchor="middle" fill="#70455b" font-size="17" font-weight="900">V</text></g>
      <g fill="#f0c988" font-size="17" text-anchor="middle"><text x="52" y="52">★</text><text x="52" y="76">★</text><text x="52" y="100">★</text></g>
      <path d="M216 36h58v106h-58z" fill="#2d1c35" stroke="#d7b477" stroke-width="2"/><path d="M216 70h58M216 106h58" stroke="#d7b47788" stroke-width="2"/><g fill="#c08b60"><rect x="225" y="45" width="15" height="22" rx="5"/><rect x="248" y="42" width="17" height="25" rx="5"/><rect x="225" y="79" width="18" height="24" rx="5"/><rect x="250" y="82" width="14" height="21" rx="5"/><rect x="226" y="116" width="17" height="22" rx="5"/></g><path d="M251 122l7 7 14-19" fill="none" stroke="#7ac9ae" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`);
  return svg("玫瑰圆印、佛手菱印、雪松方印、鸢尾三角印同时使用不同颜色纹理与文字，秘密香方仍被问号封住", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#1b1122"/>
    <g class="art-elements" font-family="ui-sans-serif, system-ui, sans-serif">
      <text x="36" y="39" fill="#d7b477" font-size="10" font-weight="800">香料精华</text>
      <g transform="translate(40 54)"><circle cx="20" cy="20" r="18" fill="#a83e62" stroke="#f4dfbf" stroke-width="2"/><circle cx="14" cy="14" r="3" fill="#fff7"/><text x="20" y="25" text-anchor="middle" fill="#fff" font-size="13" font-weight="900">玫</text><text x="20" y="55" text-anchor="middle" fill="#d8c9d7" font-size="11">圆 · 花瓣纹</text></g>
      <g transform="translate(94 54)"><path d="M20 1L39 20 20 39 1 20Z" fill="#d88b39" stroke="#f4dfbf" stroke-width="2"/><path d="M8 13l24 12M8 21l17 9" stroke="#fff8" stroke-width="2"/><text x="20" y="25" text-anchor="middle" fill="#fff" font-size="13" font-weight="900">柑</text><text x="20" y="55" text-anchor="middle" fill="#d8c9d7" font-size="11">菱 · 斜线纹</text></g>
      <g transform="translate(148 54)"><rect x="2" y="2" width="36" height="36" rx="4" fill="#397d65" stroke="#f4dfbf" stroke-width="2"/><path d="M10 2v36M19 2v36M28 2v36" stroke="#163e3055" stroke-width="2"/><text x="20" y="25" text-anchor="middle" fill="#fff" font-size="13" font-weight="900">松</text><text x="20" y="55" text-anchor="middle" fill="#d8c9d7" font-size="11">方 · 木纹</text></g>
      <g transform="translate(202 54)"><path d="M20 1L39 38H1Z" fill="#765191" stroke="#f4dfbf" stroke-width="2"/><path d="M20 8v25M10 28l10-20 10 20" stroke="#fff6" stroke-width="2"/><text x="20" y="29" text-anchor="middle" fill="#fff" font-size="12" font-weight="900">鸢</text><text x="20" y="55" text-anchor="middle" fill="#d8c9d7" font-size="11">角 · 放射纹</text></g>
      <g transform="translate(42 126)"><text x="0" y="0" fill="#d7b477" font-size="9" font-weight="800">密封香方</text><g transform="translate(72 -15)" fill="#2c1c35" stroke="#8f748f"><rect x="0" y="0" width="30" height="32"/><rect x="36" y="0" width="30" height="32"/><rect x="72" y="0" width="30" height="32"/><rect x="108" y="0" width="30" height="32"/></g><g transform="translate(87 8)" fill="#c6adc8" font-size="15" font-weight="900" text-anchor="middle"><text x="0">?</text><text x="36">?</text><text x="72">?</text><text x="108">?</text></g></g>
    </g>`);
}

// This renderer intentionally uses no SVG ids or URL references so all three cards can
// be mounted together by the tutorial audit without cross-SVG gradient/filter collisions.
function nebulaArt(label, focus, stateClass, content) {
  return `<svg class="realm-art" data-focus="${focus}" viewBox="0 0 320 184" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#100b28"/><circle cx="54" cy="36" r="32" fill="#b99aff18"/><circle cx="274" cy="150" r="46" fill="#86f2d014"/>
    <g class="${stateClass}">${content}</g></svg>`;
}

function nebulaHatchery(focus) {
  if (focus === "action") return nebulaArt("边界笔改变正式分区，归属笔记成对标出绕星核旋转半周的方格", focus, "art-action", `
      <g font-family="ui-sans-serif, system-ui, sans-serif" text-anchor="middle"><text x="91" y="38" fill="#e9e1ff" font-size="11" font-weight="800">绘制边界</text><text x="231" y="38" fill="#e9e1ff" font-size="11" font-weight="800">归属笔记</text></g>
      ${grid(49, 50, 3, 3, 28, "#ffffff2b")}${grid(189, 50, 3, 3, 28, "#ffffff2b")}
      <path d="M105 50v84" stroke="#86f2d0" stroke-width="7" stroke-linecap="round"/><path d="M112 58l12-12 6 6-12 12z" fill="#ffd58e" stroke="#fff4d8" stroke-width="1.5"/><path d="M111 65l7-1-6-6z" fill="#ff8fbd"/>
      <circle cx="231" cy="92" r="9" fill="#ffd58e" stroke="#fff4d8" stroke-width="2"/><circle cx="231" cy="92" r="3" fill="#100b28"/>
      <rect x="193" y="54" width="20" height="20" rx="5" fill="#b99aff38" stroke="#b99aff" stroke-width="2"/><rect x="249" y="110" width="20" height="20" rx="5" fill="#b99aff38" stroke="#b99aff" stroke-width="2"/><path d="M210 72l17 16m8 8 17 16" fill="none" stroke="#ffd58e" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/><path d="M247 107l8 2-3 7z" fill="#ffd58e"/>`);
  if (focus === "goal") return nebulaArt("全盘分成四向连通、各含一枚星核且具有半周旋转对称的稳定星云", focus, "art-goal", `
      <rect x="48" y="32" width="168" height="112" rx="4" fill="#ffffff05" stroke="#d9cdff" stroke-width="2"/>
      <rect x="49" y="33" width="55" height="110" fill="#b99aff24"/><rect x="105" y="33" width="55" height="110" fill="#86f2d01e"/><rect x="161" y="33" width="54" height="110" fill="#ffd58e1c"/>${grid(48, 32, 6, 4, 28, "#ffffff25")}
      <path d="M104 32v112M160 32v112" stroke="#86f2d0" stroke-width="6" stroke-linecap="round"/>
      <g fill="#ffd58e" stroke="#fff4d8" stroke-width="2"><circle cx="76" cy="88" r="8"/><circle cx="132" cy="88" r="8"/><circle cx="188" cy="88" r="8"/></g><g fill="#100b28"><circle cx="76" cy="88" r="2.5"/><circle cx="132" cy="88" r="2.5"/><circle cx="188" cy="88" r="2.5"/></g>
      <g fill="none" stroke="#b99aff" stroke-width="2" stroke-dasharray="4 4"><path d="M58 55a25 25 0 1 1 35 36"/><path d="M114 55a25 25 0 1 1 35 36"/><path d="M170 55a25 25 0 1 1 35 36"/></g>
      <path d="M239 55l8 8 15-20" fill="none" stroke="#86f2d0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><g fill="#e9e1ff" font-size="10" font-weight="800"><text x="236" y="87">四向连通</text><text x="236" y="107">恰含一核</text><text x="236" y="127">180° 对称</text></g>`);
  return nebulaArt("格心、边心与角点三种星核落点在网格中分开标示", "elements", "art-elements", `
      <g font-family="ui-sans-serif, system-ui, sans-serif" text-anchor="middle"><g transform="translate(31)"><rect x="0" y="31" width="82" height="124" rx="12" fill="#ffffff08" stroke="#ffffff1f"/>${grid(9, 64, 2, 2, 32, "#ffffff35")}<circle cx="25" cy="80" r="9" fill="#ffd58e" stroke="#fff4d8" stroke-width="2"/><circle cx="25" cy="80" r="3" fill="#100b28"/><text x="41" y="51" fill="#e9e1ff" font-size="11" font-weight="800">格心核</text><text x="41" y="143" fill="#aaa2c5" font-size="9">一格起步</text></g>
      <g transform="translate(119)"><rect x="0" y="31" width="82" height="124" rx="12" fill="#ffffff08" stroke="#ffffff1f"/>${grid(9, 64, 2, 2, 32, "#ffffff35")}<circle cx="41" cy="80" r="9" fill="#86f2d0" stroke="#e8fff8" stroke-width="2"/><circle cx="41" cy="80" r="3" fill="#100b28"/><text x="41" y="51" fill="#e9e1ff" font-size="11" font-weight="800">边心核</text><text x="41" y="143" fill="#aaa2c5" font-size="9">两格同属</text></g>
      <g transform="translate(207)"><rect x="0" y="31" width="82" height="124" rx="12" fill="#ffffff08" stroke="#ffffff1f"/>${grid(9, 64, 2, 2, 32, "#ffffff35")}<circle cx="41" cy="96" r="9" fill="#b99aff" stroke="#f0eaff" stroke-width="2"/><circle cx="41" cy="96" r="3" fill="#100b28"/><text x="41" y="51" fill="#e9e1ff" font-size="11" font-weight="800">角点核</text><text x="41" y="143" fill="#aaa2c5" font-size="9">四格同属</text></g></g>`);
}

function neonSkyline(focus) {
  if (focus === "action") return svg("选中的城市地块从候选蓝图切换为三层霓虹建筑", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#071326"/>
    <g class="art-action"><g fill="none" stroke="#5cf6ff55">${grid(42, 34, 4, 3, 36, "#5cf6ff55")}</g><rect x="78" y="70" width="36" height="36" fill="#112a46" stroke="#ff4fd8" stroke-width="3"/><g fill="#a7c7da" font-size="9" font-weight="800" text-anchor="middle"><text x="88" y="83">1</text><text x="104" y="83">2</text><text x="88" y="99">3</text><text x="104" y="99">4</text></g><path d="M128 88h32" stroke="#ff4fd8" stroke-width="3" stroke-linecap="round"/><path d="M154 82l8 6-8 6" fill="none" stroke="#ff4fd8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><g transform="translate(198 106)"><path d="M-22 0V-54H22V0" fill="#153455" stroke="#5cf6ff" stroke-width="3"/><g fill="#ffcf5a"><rect x="-14" y="-44" width="8" height="6"/><rect x="5" y="-44" width="8" height="6"/><rect x="-14" y="-28" width="8" height="6"/><rect x="5" y="-28" width="8" height="6"/><rect x="-14" y="-12" width="8" height="6"/><rect x="5" y="-12" width="8" height="6"/></g><circle cx="0" cy="-27" r="13" fill="#071326" stroke="#ff4fd8" stroke-width="2"/><text x="0" y="-22" text-anchor="middle" fill="#fff" font-size="15" font-weight="900">3</text></g><g transform="translate(254 52)" font-size="11" font-weight="900" text-anchor="middle"><rect x="-18" y="-13" width="36" height="26" rx="8" fill="#ff4fd8"/><text y="4" fill="#160d28">3 层</text></g><g fill="#a7c7da" font-size="9" font-weight="800" text-anchor="middle"><text x="96" y="149">候选笔记</text><text x="198" y="149">正式建楼</text></g></g>`);
  if (focus === "goal") return svg("四乘四街区每行每列高度不重复，四边可见数全部通过", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#071326"/>
    <g class="art-goal"><g transform="translate(94 34)">${grid(0, 0, 4, 4, 27, "#5cf6ff66")}<g font-size="12" font-weight="900" text-anchor="middle" fill="#eafdff"><text x="13.5" y="18">1</text><text x="40.5" y="18">3</text><text x="67.5" y="18">4</text><text x="94.5" y="18">2</text><text x="13.5" y="45">4</text><text x="40.5" y="45">2</text><text x="67.5" y="45">3</text><text x="94.5" y="45">1</text><text x="13.5" y="72">2</text><text x="40.5" y="72">4</text><text x="67.5" y="72">1</text><text x="94.5" y="72">3</text><text x="13.5" y="99">3</text><text x="40.5" y="99">1</text><text x="67.5" y="99">2</text><text x="94.5" y="99">4</text></g></g><g font-size="10" font-weight="900" text-anchor="middle"><g data-clue-side="top" fill="#65ffaf"><circle cx="107.5" cy="25" r="8"/><circle cx="134.5" cy="25" r="8"/><circle cx="161.5" cy="25" r="8"/><circle cx="188.5" cy="25" r="8"/></g><g fill="#071326"><text x="107.5" y="28.5">2</text><text x="134.5" y="28.5">2</text><text x="161.5" y="28.5">1</text><text x="188.5" y="28.5">3</text></g><g data-clue-side="bottom" fill="#65ffaf"><circle cx="107.5" cy="151" r="8"/><circle cx="134.5" cy="151" r="8"/><circle cx="161.5" cy="151" r="8"/><circle cx="188.5" cy="151" r="8"/></g><g fill="#071326"><text x="107.5" y="154.5">2</text><text x="134.5" y="154.5">2</text><text x="161.5" y="154.5">3</text><text x="188.5" y="154.5">1</text></g><g data-clue-side="left" fill="#65ffaf"><circle cx="84" cy="47.5" r="8"/><circle cx="84" cy="74.5" r="8"/><circle cx="84" cy="101.5" r="8"/><circle cx="84" cy="128.5" r="8"/></g><g fill="#071326"><text x="84" y="51">3</text><text x="84" y="78">1</text><text x="84" y="105">2</text><text x="84" y="132">2</text></g><g data-clue-side="right" fill="#65ffaf"><circle cx="212" cy="47.5" r="8"/><circle cx="212" cy="74.5" r="8"/><circle cx="212" cy="101.5" r="8"/><circle cx="212" cy="128.5" r="8"/></g><g fill="#071326"><text x="212" y="51">2</text><text x="212" y="78">3</text><text x="212" y="105">2</text><text x="212" y="132">1</text></g></g><path d="M244 86l10 10 22-30" fill="none" stroke="#65ffaf" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return svg("不同高度的霓虹建筑与四周街口观察数字围绕方形街区", focus, `
    <rect x="18" y="14" width="284" height="156" rx="18" fill="#071326"/>
    <g class="art-elements"><g transform="translate(84 34)">${grid(0, 0, 4, 3, 38, "#5cf6ff55")}<g font-size="15" font-weight="900" text-anchor="middle"><text x="19" y="25" fill="#eafdff">1</text><text x="57" y="25" fill="#eafdff">3</text><text x="95" y="25" fill="#eafdff">4</text><text x="133" y="25" fill="#eafdff">2</text><text x="19" y="63" fill="#eafdff">4</text><text x="57" y="63" fill="#eafdff">2</text><text x="95" y="63" fill="#eafdff">3</text><text x="133" y="63" fill="#eafdff">1</text></g><g transform="translate(95 114)"><path d="M-14 0V-34H14V0" fill="#173b62" stroke="#ff4fd8" stroke-width="2"/><text y="-12" text-anchor="middle" fill="#fff" font-size="14" font-weight="900">3</text><path d="M16-31l5-5" stroke="#ffcf5a" stroke-width="3"/><circle cx="22" cy="-38" r="6" fill="#ffcf5a"/><path d="M19-41l6 6M25-41l-6 6" stroke="#071326" stroke-width="2"/></g></g><g fill="#ffcf5a" font-size="13" font-weight="900" text-anchor="middle"><text x="103" y="28">2</text><text x="141" y="28">2</text><text x="179" y="28">1</text><text x="217" y="28">3</text><text x="66" y="59">3</text><text x="66" y="97">1</text><text x="66" y="135">·</text><text x="244" y="59">2</text><text x="244" y="97">3</text><text x="244" y="135">1</text></g><path d="M34 151H286" stroke="#5cf6ff" stroke-width="3" stroke-dasharray="7 6"/></g>`);
}

const ART_RENDERERS = Object.freeze({
  "cloud-camp": cloudCamp,
  "mist-photo-studio": mistPhoto,
  "mystic-perfumery": mysticPerfumery,
  "nebula-hatchery": nebulaHatchery,
  "neon-skyline": neonSkyline,
});

export function tutorialArt(realmId, focus = "elements") {
  if (!REALM_TUTORIALS[realmId]?.cards?.some((card) => card.focus === focus)) return "";
  return ART_RENDERERS[realmId]?.(focus) ?? "";
}
