const VALID_FOCUSES = new Set(["elements", "action", "goal"]);

function normaliseFocus(focus) {
  return VALID_FOCUSES.has(focus) ? focus : "elements";
}

function realmSvg(realm, label, focus, content, layerAttributes = "") {
  const state = normaliseFocus(focus);
  const glowId = `${realm}-${state}-tutorial-glow`;
  const seaId = `${realm}-${state}-tutorial-sea`;
  return `<svg class="realm-art" data-focus="${state}" width="320" height="184" viewBox="0 0 320 184" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="${glowId}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="${seaId}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${realm === "abyss" ? "#082d43" : "#123b39"}"/><stop offset="1" stop-color="${realm === "abyss" ? "#020d18" : "#031515"}"/></linearGradient>
    </defs>
    <g class="art-${state}"${layerAttributes} data-glow="${glowId}" data-sea="${seaId}">${content}</g>
  </svg>`;
}

const ABYSS_SIZE = 6;
const ABYSS_SIGNATURE = Object.freeze([
  "H", "E:23", "H", "E:6", "H", "H",
  "E:3", "H", "R", "H", "R", "E:13",
  "H", "E:11", "H", "E:18", "H", "H",
  "E:15", "H", "R", "H", "R", "E:1",
]);
const ABYSS_PAIR_LABELS = new Map([
  [1, "1"], [23, "1"],
  [3, "2"], [6, "2"],
  [11, "3"], [13, "3"],
  [15, "4"], [18, "4"],
]);
const ABYSS_BALLS = Object.freeze([
  Object.freeze({ column: 0, row: 2 }),
  Object.freeze({ column: 2, row: 1 }),
  Object.freeze({ column: 3, row: 4 }),
  Object.freeze({ column: 5, row: 3 }),
]);

function abyssPortPoint(port, x, y, cell) {
  const extent = ABYSS_SIZE * cell;
  const inset = cell / 2;
  const gap = cell * 0.52;
  if (port < ABYSS_SIZE) return { x: x + inset + port * cell, y: y - gap, side: "top" };
  if (port < ABYSS_SIZE * 2) return { x: x + extent + gap, y: y + inset + (port - ABYSS_SIZE) * cell, side: "right" };
  if (port < ABYSS_SIZE * 3) return { x: x + extent - inset - (port - ABYSS_SIZE * 2) * cell, y: y + extent + gap, side: "bottom" };
  return { x: x - gap, y: y + extent - inset - (port - ABYSS_SIZE * 3) * cell, side: "left" };
}

function abyssResponseText(port, response) {
  if (!response) return "";
  if (response === "H" || response === "R") return response;
  return ABYSS_PAIR_LABELS.get(port) ?? "";
}

function abyssPort(port, response, x, y, cell) {
  const point = abyssPortPoint(port, x, y, cell);
  const text = abyssResponseText(port, response);
  const tested = Boolean(response);
  const fill = response === "H"
    ? "#351017"
    : response === "R"
      ? "#35280d"
      : tested
        ? "#073239"
        : "#04171e";
  const stroke = response === "H"
    ? "#ff806f"
    : response === "R"
      ? "#ffca7a"
      : tested
        ? "#6afbf1"
        : "#37767c";
  const radius = Math.max(5.2, cell * 0.34);
  return `<g data-port="${port}" data-side="${point.side}" data-response="${response ?? "untested"}" aria-label="端口 ${port + 1}${tested ? ` 响应 ${text}` : " 未测"}">
    <circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
    ${tested ? `<text x="${point.x}" y="${point.y + 2.7}" text-anchor="middle" fill="${stroke}" font-family="ui-monospace,monospace" font-size="${Math.max(6.6, cell * 0.42)}" font-weight="900">${text}</text>` : `<circle cx="${point.x}" cy="${point.y}" r="1.5" fill="#6a999b"/>`}
  </g>`;
}

function abyssEnergyBall(column, row, x, y, cell, state = "guess") {
  const cx = x + (column + 0.5) * cell;
  const cy = y + (row + 0.5) * cell;
  const radius = cell * 0.27;
  const revealed = state === "revealed";
  const accent = revealed ? "#eafffb" : "#7effdc";
  return `<g data-energy-state="${state}" data-column="${column}" data-row="${row}" aria-label="${revealed ? "已揭示能量体" : "推测能量球"}">
    <ellipse cx="${cx}" cy="${cy}" rx="${cell * 0.43}" ry="${cell * 0.18}" fill="none" stroke="${accent}" stroke-width="1.2" ${revealed ? "stroke-dasharray=\"2.2 2.2\"" : ""} transform="rotate(-18 ${cx} ${cy})" opacity=".84"/>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${revealed ? "#087f82" : "#0aa49b"}" stroke="${accent}" stroke-width="1.3"/>
    <circle cx="${cx - radius * 0.28}" cy="${cy - radius * 0.3}" r="${radius * 0.24}" fill="#f2fffb"/>
  </g>`;
}

function abyssGrid({ x, y, cell, responses = new Map(), balls = [], energyState = "guess" }) {
  const extent = ABYSS_SIZE * cell;
  let cells = "";
  for (let row = 0; row < ABYSS_SIZE; row += 1) {
    for (let column = 0; column < ABYSS_SIZE; column += 1) {
      cells += `<rect x="${x + column * cell}" y="${y + row * cell}" width="${cell}" height="${cell}" fill="${(row + column) % 2 ? "#082731" : "#092e37"}" stroke="#66dcd529" stroke-width=".8"/>`;
      cells += `<circle cx="${x + (column + 0.5) * cell}" cy="${y + (row + 0.5) * cell}" r="${Math.max(1.1, cell * 0.08)}" fill="#2b6669"/>`;
    }
  }
  let ports = "";
  for (let port = 0; port < ABYSS_SIZE * 4; port += 1) {
    const response = responses instanceof Map ? responses.get(port) : responses[port];
    ports += abyssPort(port, response ?? null, x, y, cell);
  }
  const energy = balls.map(({ column, row }) => abyssEnergyBall(column, row, x, y, cell, energyState)).join("");
  return `<g data-board-size="6" data-port-count="24"><rect x="${x - 3}" y="${y - 3}" width="${extent + 6}" height="${extent + 6}" rx="6" fill="#03151d" stroke="#61ded693" stroke-width="1.4"/>${cells}${ports}${energy}</g>`;
}

function abyssResponseLegend(x, y, response, title, body) {
  const fill = response === "H" ? "#351017" : response === "R" ? "#35280d" : "#073239";
  const accent = response === "H" ? "#ff806f" : response === "R" ? "#ffca7a" : "#6afbf1";
  return `<g transform="translate(${x} ${y})"><circle r="10" fill="${fill}" stroke="${accent}" stroke-width="1.5"/><text y="3.4" text-anchor="middle" fill="${accent}" font-family="ui-monospace,monospace" font-size="10" font-weight="900">${response}</text><text x="17" y="-1" fill="#ecffff" font-size="9" font-weight="850">${title}</text><text x="17" y="10" fill="#8fb8bd" font-size="7.2">${body}</text></g>`;
}

export function abyssTutorialArt(focus) {
  const state = normaliseFocus(focus);
  const sea = `abyss-${state}-tutorial-sea`;
  const glow = `abyss-${state}-tutorial-glow`;

  if (state === "action") {
    const observed = new Map([[0, "H"], [1, "E:23"], [3, "E:6"], [6, "E:3"], [8, "R"], [23, "E:1"]]);
    const boardX = 39;
    const boardY = 31;
    const cell = 20;
    const guess = { column: 3, row: 4 };
    const guessX = boardX + (guess.column + 0.5) * cell;
    const guessY = boardY + (guess.row + 0.5) * cell;
    return realmSvg("abyss", "点击声场格点只会放置带轨道的推测能量球，外围端口记录 H、R 与成对编号，隐藏能量体不会暴露", state, `
      <rect x="12" y="9" width="296" height="166" rx="18" fill="url(#${sea})" stroke="#64e5df33"/>
      <g data-action="place-guess" data-reveal="false">${abyssGrid({ x: boardX, y: boardY, cell, responses: observed, balls: [guess], energyState: "guess" })}
        <circle cx="${guessX}" cy="${guessY}" r="14" fill="none" stroke="#fff7" stroke-width="1.5" stroke-dasharray="3 3"/>
        <path d="M${guessX + 7} ${guessY - 15}l7-11" fill="none" stroke="#dffeff" stroke-width="1.5" stroke-linecap="round"/>
      </g>
      <g transform="translate(198 32)" font-family="ui-sans-serif,system-ui,sans-serif">
        <text x="0" y="0" fill="#6afbf1" font-size="9" font-weight="900" letter-spacing="1.2">格点推测</text>
        <text x="0" y="22" fill="#f3ffff" font-size="12" font-weight="900">点击放置</text>
        <text x="0" y="37" fill="#a8cbd0" font-size="8.2">再点一次取消</text>
        <g transform="translate(20 69)" filter="url(#${glow})">${abyssEnergyBall(0, 0, -10, -10, 20, "guess")}</g>
        <text x="46" y="73" fill="#7effdc" font-size="9" font-weight="850">推测球 + 轨道</text>
        <path d="M0 95H94" stroke="#5aa6aa55"/>
        <text x="0" y="113" fill="#ffca7a" font-size="8.6" font-weight="800">屏幕仍只显示推测</text>
        <text x="0" y="128" fill="#8fb8bd" font-size="7.8">真实位置到通关才揭示</text>
      </g>`, ` data-action="guess-toggle" data-hidden-revealed="false"`);
  }

  if (state === "goal") {
    return realmSvg("abyss", "深海回声站真实通关画面：六乘六声场的全部二十四个端口响应与推测模型完全吻合，四枚能量体全部揭示", state, `
      <rect x="12" y="9" width="296" height="166" rx="18" fill="url(#${sea})" stroke="#64e5df33"/>
      <g data-response-signature="${ABYSS_SIGNATURE.join(",")}" data-layout="0,2|2,1|3,4|5,3">${abyssGrid({ x: 35, y: 30, cell: 20, responses: ABYSS_SIGNATURE, balls: ABYSS_BALLS, energyState: "revealed" })}</g>
      <g transform="translate(192 29)" font-family="ui-sans-serif,system-ui,sans-serif">
        <rect x="0" y="0" width="103" height="126" rx="13" fill="#061c27e8" stroke="#6afbf14d"/>
        <path d="M15 23l7 7 14-18" fill="none" stroke="#75f3c2" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#${glow})"/>
        <text x="45" y="24" fill="#75f3c2" font-size="9" font-weight="900">校验通过</text>
        <text x="51.5" y="55" text-anchor="middle" fill="#f1ffff" font-family="ui-monospace,monospace" font-size="22" font-weight="950">24 / 24</text>
        <text x="51.5" y="70" text-anchor="middle" fill="#8fbfc4" font-size="7.8" font-weight="800">全部端口响应签名吻合</text>
        <path d="M13 80H90" stroke="#5aa6aa55"/>
        <text x="20" y="103" fill="#7effdc" font-family="ui-monospace,monospace" font-size="15" font-weight="900">4 / 4</text>
        <text x="63" y="101" fill="#e8ffff" font-size="8.2" font-weight="850">能量体</text>
        <text x="63" y="112" fill="#8fb8bd" font-size="7.2">全部揭示</text>
      </g>`, ` data-response-count="24" data-energy-count="4" data-equivalent="true"`);
  }

  const observed = new Map([[0, "H"], [1, "E:23"], [3, "E:6"], [6, "E:3"], [8, "R"], [23, "E:1"]]);
  return realmSvg("abyss", "真实声场元素：围绕六乘六网格的二十四个端口，H 表示吞没，R 表示回声，相同数字是成对入口出口，带轨道的球是玩家推测", state, `
    <rect x="12" y="9" width="296" height="166" rx="18" fill="url(#${sea})" stroke="#64e5df33"/>
    <g data-port-count="24" data-response-kinds="H,R,pair" data-energy-state="guess">${abyssGrid({ x: 38, y: 31, cell: 20, responses: observed, balls: [{ column: 2, row: 3 }], energyState: "guess" })}</g>
    <g transform="translate(205 29)" font-family="ui-sans-serif,system-ui,sans-serif">
      <text x="0" y="0" fill="#6afbf1" font-size="9" font-weight="900" letter-spacing="1.1">端口响应</text>
      ${abyssResponseLegend(10, 25, "H", "吞没", "正面命中")}
      ${abyssResponseLegend(10, 59, "R", "回声", "原浮标返回")}
      ${abyssResponseLegend(10, 93, "1", "配对号", "两端同号")}
      <path d="M30 93H52" stroke="#6afbf1" stroke-width="1.3" stroke-dasharray="2 2"/><circle cx="62" cy="93" r="10" fill="#073239" stroke="#6afbf1" stroke-width="1.5"/><text x="62" y="96.4" text-anchor="middle" fill="#6afbf1" font-family="ui-monospace,monospace" font-size="10" font-weight="900">1</text>
      <text x="0" y="128" fill="#7effdc" font-size="8" font-weight="850">轨道球 = 玩家推测</text>
      <text x="0" y="141" fill="#8fb8bd" font-size="7.2">未通关时不显示真实位置</text>
    </g>`, ` data-port-count="24" data-shows="H,R,pair,guess"`);
}

const STORM_SOLUTION = Object.freeze([
  6, 10, 10, 10, 8,
  3, 12, 6, 10, 12,
  6, 9, 1, 6, 9,
  5, 6, 12, 3, 12,
  3, 9, 3, 10, 9,
]);

function stormPortPath(mask) {
  const parts = [];
  if (mask & 1) parts.push("M50 50 L50 0");
  if (mask & 2) parts.push("M50 50 L100 50");
  if (mask & 4) parts.push("M50 50 L50 100");
  if (mask & 8) parts.push("M50 50 L0 50");
  return parts.join(" ");
}

function stormShape(mask) {
  const degree = [1, 2, 4, 8].filter((bit) => (mask & bit) !== 0).length;
  if (degree === 1) return "end";
  if (degree === 3) return "tee";
  if (degree === 4) return "cross";
  return mask === 5 || mask === 10 ? "straight" : "corner";
}

function stormModule(x, y, size, mask, { powered = false, source = false, moduleId = "" } = {}) {
  const path = stormPortPath(mask);
  const powerOpacity = powered ? "1" : "0";
  const base = powered ? "#746943" : "#66877e";
  const haloStroke = source ? "#fff2a8" : powered ? "#f6c86f" : "#99c4b8";
  return `<svg class="storm-module" data-real-module="true" data-module-id="${moduleId}" data-mask="${mask}" data-shape="${stormShape(mask)}" data-powered="${powered}" data-source="${source}" x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="98" height="98" fill="${powered ? "#102d29" : "#0b2525"}" stroke="${powered ? "#6f7252" : "#315d58"}" stroke-width="2"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="${powered ? "#f6c86f38" : "#9bc9bc1d"}" stroke-width="2" stroke-dasharray="2 7"/>
    <path class="cable-shadow" d="${path}" fill="none" stroke="#0009" stroke-width="15" stroke-linecap="round"/>
    <path class="cable-base" d="${path}" fill="none" stroke="${base}" stroke-width="9" stroke-linecap="round"/>
    <path class="cable-power" d="${path}" fill="none" stroke="#f6c86f" stroke-width="5" stroke-linecap="round" opacity="${powerOpacity}"/>
    <path class="cable-pulse" d="${path}" fill="none" stroke="#fff4c9" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 14" opacity="${powerOpacity}"/>
    <circle class="buoy-halo" cx="50" cy="50" r="25" fill="${powered ? "#2d2b1c" : "#061717"}" stroke="${haloStroke}" stroke-width="${source ? 4 : 2}" ${source ? "stroke-dasharray=\"3 4\"" : ""}/>
    <path class="buoy-body" d="M38 45 L42 31 L58 31 L62 45 L66 62 Q50 72 34 62 Z" fill="${source ? "#5b4624" : powered ? "#4c452c" : "#173c39"}" stroke="${powered ? "#ffe08c" : "#91b7aa"}" stroke-width="2"/>
    <path class="cable-rivet" d="M31 51 A19 19 0 0 0 69 51" fill="#0b2525" stroke="#8eb1a5" stroke-width="3"/>
    <circle class="cable-rivet-inner" cx="31" cy="51" r="2.3" fill="#a5c9bd"/><circle class="cable-rivet-inner" cx="69" cy="51" r="2.3" fill="#a5c9bd"/>
    <path class="buoy-lamp" d="M45 44 Q50 35 55 44 L54 54 Q50 58 46 54 Z" fill="${powered ? "#fff2bd" : "#89a69d"}" stroke="${powered ? "#fff" : "#c7dfd6"}" stroke-width="1.5"/>
    <path class="buoy-lamp" d="M42 62 Q50 66 58 62 L56 69 L44 69 Z" fill="${powered ? "#fff2bd" : "#89a69d"}" stroke="${powered ? "#fff" : "#c7dfd6"}" stroke-width="1.5"/>
    ${source ? `<path class="source-crown" d="M50 18 L54 25 L62 24 L58 31 L61 37 L50 34 L39 37 L42 31 L38 24 L46 25 Z" fill="#ffe08c" stroke="#fff8dd" stroke-width="1"/>` : ""}
  </svg>`;
}

function stormSolvedBoard(x, y, cell) {
  let modules = "";
  for (let index = 0; index < STORM_SOLUTION.length; index += 1) {
    const row = Math.floor(index / 5);
    const column = index % 5;
    modules += stormModule(x + column * cell, y + row * cell, cell, STORM_SOLUTION[index], {
      powered: true,
      source: index === 12,
      moduleId: `R${row + 1}C${column + 1}`,
    });
  }
  return `<g data-level="harbour-whisper" data-level-name="港湾初鸣" data-solution="${STORM_SOLUTION.join(",")}" data-lighthouse-index="12"><rect x="${x - 2}" y="${y - 2}" width="${cell * 5 + 4}" height="${cell * 5 + 4}" fill="#031011" stroke="#f6c86f7a" stroke-width="1.5"/>${modules}<rect x="${x + cell * 2 + 1}" y="${y + cell * 2 + 1}" width="${cell - 2}" height="${cell - 2}" fill="none" stroke="#fff2a8" stroke-width="1.3" stroke-dasharray="2 2"/></g>`;
}

export function stormTutorialArt(focus) {
  const state = normaliseFocus(focus);
  const sea = `storm-${state}-tutorial-sea`;
  const glow = `storm-${state}-tutorial-glow`;

  if (state === "action") {
    return realmSvg("storm", "同一块 R03 C04 弯角航标裁片从北东接口顺时针旋转九十度后变为东南接口，中心航标和裁片形状保持不变", state, `
      <rect x="12" y="9" width="296" height="166" rx="18" fill="url(#${sea})" stroke="#f6c86f33"/>
      <text x="160" y="27" text-anchor="middle" fill="#f7e8bd" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10" font-weight="900">同一裁片 · R03 C04</text>
      <g data-action="rotate-clockwise" data-module-id="R03C04" data-shape="corner" data-before-mask="3" data-after-mask="6">
        ${stormModule(39, 45, 82, 3, { moduleId: "R03C04" })}
        ${stormModule(199, 45, 82, 6, { moduleId: "R03C04" })}
        <path d="M137 70a27 27 0 0 1 44 21" fill="none" stroke="#f6c86f" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M181 91l-10-5 9-7z" fill="#f6c86f"/>
        <text x="160" y="111" text-anchor="middle" fill="#ffe08c" font-family="ui-monospace,monospace" font-size="9" font-weight="900">顺旋 90°</text>
      </g>
      <g fill="#dff7ef" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" font-weight="850" text-anchor="middle"><text x="80" y="147">旋转前 · 北+东</text><text x="240" y="147">旋转后 · 东+南</text></g>
      <text x="160" y="164" text-anchor="middle" fill="#8fb8ad" font-family="ui-sans-serif,system-ui,sans-serif" font-size="7.5">只改接口朝向；中心航标与弯角形状没有改变</text>`, ` data-action="rotate" data-same-module="R03C04"`);
  }

  if (state === "goal") {
    return realmSvg("storm", "风暴灯塔网港湾初鸣真实五乘五通关画面：全部二十五块航标模块从中央主灯塔通能，主灯塔带源冠，计数二十五分之二十五，无断口、无回路、无错误", state, `
      <rect x="12" y="9" width="296" height="166" rx="18" fill="url(#${sea})" stroke="#f6c86f33"/>
      <text x="88" y="20" text-anchor="middle" fill="#f7e8bd" font-family="ui-sans-serif,system-ui,sans-serif" font-size="8.5" font-weight="900">港湾初鸣 · 5 × 5 解答态</text>
      ${stormSolvedBoard(22, 28, 27)}
      <g transform="translate(174 28)" font-family="ui-sans-serif,system-ui,sans-serif">
        <rect x="0" y="0" width="121" height="134" rx="13" fill="#061c1be8" stroke="#f6c86f55"/>
        <path d="M15 23l7 7 14-18" fill="none" stroke="#75f3c2" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#${glow})"/>
        <text x="45" y="24" fill="#75f3c2" font-size="9" font-weight="900">全网通能</text>
        <text x="60.5" y="62" text-anchor="middle" fill="#fff2bd" font-family="ui-monospace,monospace" font-size="25" font-weight="950">25 / 25</text>
        <text x="60.5" y="77" text-anchor="middle" fill="#b8d1c8" font-size="8" font-weight="800">航标模块全部 powered</text>
        <path d="M13 88H108" stroke="#8caa9f44"/>
        <g transform="translate(19 101)"><path d="M0 10L4 17 12 16 8 23 11 29 0 26-11 29-8 23-12 16-4 17Z" fill="#ffe08c" stroke="#fff8dd" transform="scale(.55) translate(13 -8)"/><text x="25" y="8" fill="#f7e8bd" font-size="8.3" font-weight="850">中央源冠</text></g>
        <rect x="13" y="111" width="95" height="17" rx="8.5" fill="#123c32" stroke="#75f3c277"/>
        <text x="60.5" y="122.5" text-anchor="middle" fill="#75f3c2" font-size="8" font-weight="900">无断口 · 无回路 · 无错误</text>
      </g>`, ` data-module-count="25" data-powered-count="25" data-solved="true" data-errors="0"`);
  }

  const modules = [
    { x: 20, mask: 2, label: "终端", note: "1 接口", source: true },
    { x: 92, mask: 10, label: "直线", note: "2 对向", source: false },
    { x: 164, mask: 3, label: "弯角", note: "2 直角", source: false },
    { x: 236, mask: 11, label: "三岔", note: "3 接口", source: false },
  ];
  return realmSvg("storm", "真实航标模块 SVG：终端、直线、弯角和三岔都由接口电缆和中心航标组成，主灯塔只在中心航标上多一枚源冠", state, `
    <rect x="12" y="9" width="296" height="166" rx="18" fill="url(#${sea})" stroke="#f6c86f33"/>
    <text x="160" y="28" text-anchor="middle" fill="#f7e8bd" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" font-weight="900" letter-spacing="1.1">真实 MODULE SVG · 电缆 + 中心航标</text>
    <g data-module-types="end,straight,corner,tee" data-center-buoy="true">${modules.map((module, index) => `${stormModule(module.x, 48, 56, module.mask, { source: module.source, moduleId: `sample-${index + 1}` })}<text x="${module.x + 28}" y="124" text-anchor="middle" fill="#e8f7f1" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" font-weight="900">${module.label}</text><text x="${module.x + 28}" y="138" text-anchor="middle" fill="#8fb8ad" font-family="ui-sans-serif,system-ui,sans-serif" font-size="7.2">${module.note}</text>`).join("")}</g>
    <g transform="translate(112 154)" font-family="ui-sans-serif,system-ui,sans-serif"><path d="M0 0l4-7 8 1-4-7 3-6-11 3-11-3 3 6-4 7 8-1z" fill="#ffe08c"/><text x="17" y="3" fill="#f7e8bd" font-size="7.5" font-weight="850">源冠标出主灯塔，不改变模块形状</text></g>`, ` data-module-types="4" data-center-buoy="true"`);
}
