const VALID_FOCUS = new Set(["elements", "action", "goal"]);

function normalizedFocus(focus) {
  return VALID_FOCUS.has(focus) ? focus : "elements";
}

function tutorialSvg(label, focus, background, content, layerAttributes = "") {
  const state = normalizedFocus(focus);
  return `<svg class="realm-art" data-focus="${state}" viewBox="0 0 320 184" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
    ${background}
    <g class="art-${state}"${layerAttributes} font-family="ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">${content}</g>
  </svg>`;
}

const NIGHT_BACKGROUND = `
  <rect x="18" y="14" width="284" height="156" rx="18" fill="#07131f" stroke="#f4bc6a2e"/>
  <path d="M30 46H290M30 138H290" stroke="#f4bc6a12" stroke-width="1"/>
  <circle cx="274" cy="34" r="34" fill="#24678218"/>`;

const SPIRITS = Object.freeze([
  Object.freeze({
    name: "灯盏灵",
    color: "#f2bd62",
    drawing: '<path class="spirit-fill" d="M24 5c8.5 0 14.5 7.2 14.5 16.2S32.5 39 24 43c-8.5-4-14.5-12.8-14.5-21.8S15.5 5 24 5Z"/><path d="M15 17h18M14 25h20M18 10c-2 10-2 21 6 29M30 10c2 10 2 21-6 29"/><circle cx="24" cy="24" r="3.2"/>',
  }),
  Object.freeze({
    name: "伞影灵",
    color: "#ed7b6e",
    drawing: '<path class="spirit-fill" d="M7 24C8.8 13.4 15.2 7 24 7s15.2 6.4 17 17c-4.4-2.8-8.4-2.8-12 0-3.3-2.8-6.7-2.8-10 0-3.7-2.8-7.7-2.8-12 0Z"/><path d="M24 7v29c0 6 8 6 8 0M13 21c2-6 5.7-10 11-14M35 21c-2-6-5.7-10-11-14"/>',
  }),
  Object.freeze({
    name: "叶纹灵",
    color: "#69c8a4",
    drawing: '<path class="spirit-fill" d="M39.5 8.5C24 7.2 10.3 15.3 9 29.2c-.7 7.1 4.1 11.2 10.2 10.2C33.1 37 40.9 23.9 39.5 8.5Z"/><path d="M11 39C17.5 28.7 25.5 21 37.5 11.5M18 29l1-10M24 24l9 .5M29 18l.5-6"/>',
  }),
  Object.freeze({
    name: "月纱灵",
    color: "#75c8e2",
    drawing: '<path class="spirit-fill" d="M34.8 7.5c-8.1 2.2-13.1 9.1-12 17 1 7.2 6.9 12.4 14.2 12.8A17 17 0 1 1 34.8 7.5Z"/><circle cx="15" cy="17" r="2.2"/><circle cx="11" cy="28" r="1.5"/><path d="M13 38c4-4.2 7.8-5.6 12-5.2"/>',
  }),
  Object.freeze({
    name: "风铃灵",
    color: "#c19be4",
    drawing: '<path class="spirit-fill" d="M14 13c0-4.5 4.5-7.5 10-7.5s10 3 10 7.5l3.5 20.5h-27L14 13Z"/><path d="M10.5 33.5h27M19 12l-2 16M29 12l2 16M20 39c1.7 4.7 6.3 4.7 8 0"/><circle cx="24" cy="37" r="2.2"/>',
  }),
]);

function spiritGlyph(type, centerX, centerY, scale = 0.58) {
  const spirit = SPIRITS[type];
  if (!spirit) return "";
  return `<g class="tutorial-spirit spirit-type-${type}" data-spirit-type="${type}" data-spirit-name="${spirit.name}" transform="translate(${centerX} ${centerY}) scale(${scale}) translate(-24 -24)" fill="none" stroke="${spirit.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${spirit.drawing
    .replace('<path class="spirit-fill"', `<path class="spirit-fill" fill="${spirit.color}" fill-opacity=".2"`)
    .replaceAll("<circle ", `<circle fill="${spirit.color}" fill-opacity=".38" `)}
  </g>`;
}

function stallCell(x, y, size, type, selected = false, metadata = "") {
  const empty = type === null;
  return `<g class="tutorial-stall${empty ? " is-empty" : ""}${selected ? " is-selected" : ""}" ${metadata}>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${empty ? "#030d14" : "#0c1d25"}" stroke="#d6b2801c"/>
    <path d="M${x + 3} ${y + 3}l${size - 6} ${size - 6}" stroke="#ffffff08"/>
    ${empty
    ? `<circle class="stall-center" cx="${x + size / 2}" cy="${y + size / 2}" r="${Math.max(1.4, size * 0.055)}" fill="#a9988224"/>`
    : spiritGlyph(type, x + size / 2, y + size / 2, size / 65)}
    ${selected ? `<rect class="tutorial-selected-cell" x="${x + 2}" y="${y + 2}" width="${size - 4}" height="${size - 4}" rx="3" fill="none" stroke="#ffe0a1" stroke-width="2.2"/>` : ""}
  </g>`;
}

function nightBoard(board, x, y, size, options = {}) {
  const selected = options.selected ?? new Set();
  const role = options.role ?? "board";
  const cells = board.flatMap((row, rowIndex) => row.map((type, columnIndex) => {
    const key = `${rowIndex}:${columnIndex}`;
    return stallCell(
      x + columnIndex * size,
      y + rowIndex * size,
      size,
      type,
      selected.has(key),
      `data-row="${rowIndex}" data-column="${columnIndex}" data-cell="${type === null ? "empty" : type}"`,
    );
  })).join("");
  return `<g class="tutorial-market-board" data-board-role="${role}" data-board-matrix="${JSON.stringify(board)}">${cells}</g>`;
}

const NIGHT_ACTION_BEFORE = Object.freeze([
  Object.freeze([1, 1, 1, 3]),
  Object.freeze([null, null, 1, 3]),
  Object.freeze([null, null, 1, null]),
  Object.freeze([0, 0, 1, null]),
]);

const NIGHT_ACTION_AFTER = Object.freeze([
  Object.freeze([null, null, null, null]),
  Object.freeze([null, null, null, null]),
  Object.freeze([null, null, 3, null]),
  Object.freeze([0, 0, 3, null]),
]);

const NIGHT_ACTION_REMOVED = Object.freeze([
  Object.freeze([null, null, null, 3]),
  Object.freeze([null, null, null, 3]),
  Object.freeze([null, null, null, null]),
  Object.freeze([0, 0, null, null]),
]);

const NIGHT_ACTION_DROPPED = Object.freeze([
  Object.freeze([null, null, null, null]),
  Object.freeze([null, null, null, null]),
  Object.freeze([null, null, null, 3]),
  Object.freeze([0, 0, null, 3]),
]);

const NIGHT_SELECTED_GROUP = new Set(["0:0", "0:1", "0:2", "1:2", "2:2", "3:2"]);

function nightElements() {
  const legend = SPIRITS.map((spirit, type) => {
    const x = 27 + type * 54;
    return `${stallCell(x, 32, 42, type, false, `data-legend-type="${type}"`)}
      <text x="${x + 21}" y="88" text-anchor="middle" fill="${spirit.color}" font-size="8.5" font-weight="800">${spirit.name}</text>`;
  }).join("");
  const selectedExample = [0, 1, 2].map((column) => stallCell(109 + column * 34, 116, 34, 0, true, `data-group-cell="${column}"`)).join("");
  return `${legend}
    <text x="94" y="108" text-anchor="end" fill="#b9b2ad" font-size="9" font-weight="800">同色正交成群</text>
    ${selectedExample}
    <text x="230" y="137" fill="#ffe0a1" font-size="9" font-weight="800">逐格选亮</text>
    <path d="M224 141H211" stroke="#ffe0a1" stroke-width="2" stroke-linecap="round"/>`;
}

function nightAction() {
  const removedGhosts = [...NIGHT_SELECTED_GROUP].map((key) => {
    const [row, column] = key.split(":").map(Number);
    const size = 19;
    const x = 22 + column * size;
    const y = 50 + row * size;
    return `<g class="tutorial-removed-spirit" data-removed-cell="${key}" opacity=".36">
      ${spiritGlyph(1, x + size / 2, y + size / 2, size / 65)}
      <rect x="${x + 1.5}" y="${y + 1.5}" width="${size - 3}" height="${size - 3}" rx="2" fill="none" stroke="#ffe0a1" stroke-width="1.6"/>
      <path d="M${x + 5} ${y + 5}L${x + size - 5} ${y + size - 5}M${x + size - 5} ${y + 5}L${x + 5} ${y + size - 5}" stroke="#ff9a8d" stroke-width="1.5" stroke-linecap="round"/>
    </g>`;
  }).join("");
  return `<g data-action-step="remove" data-step-index="1" data-selected-cells="${[...NIGHT_SELECTED_GROUP].join(",")}" data-input-matrix="${JSON.stringify(NIGHT_ACTION_BEFORE)}" data-output-matrix="${JSON.stringify(NIGHT_ACTION_REMOVED)}">
      <text x="60" y="34" text-anchor="middle" fill="#ffe0a1" font-size="8.5" font-weight="900">① 删除所选群</text>
      ${nightBoard(NIGHT_ACTION_REMOVED, 22, 50, 19, { role: "removed" })}${removedGhosts}
      <text x="60" y="145" text-anchor="middle" fill="#a99ab7" font-size="7.5" font-weight="800">逐格消失 · 留下空位</text>
    </g>
    <g data-action-step="drop" data-step-index="2" data-input-matrix="${JSON.stringify(NIGHT_ACTION_REMOVED)}" data-output-matrix="${JSON.stringify(NIGHT_ACTION_DROPPED)}">
      <text x="159" y="34" text-anchor="middle" fill="#8ccfe5" font-size="8.5" font-weight="900">② 逐列下落</text>
      ${nightBoard(NIGHT_ACTION_DROPPED, 121, 50, 19, { role: "dropped" })}
      <path d="M173 61V102" stroke="#75c8e2" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/><path d="M173 107l-5-8h10z" fill="#75c8e2"/>
      <text x="159" y="145" text-anchor="middle" fill="#8baeb9" font-size="7.5" font-weight="800">各列独立压到底部</text>
    </g>
    <g data-action-step="shift" data-step-index="3" data-input-matrix="${JSON.stringify(NIGHT_ACTION_DROPPED)}" data-output-matrix="${JSON.stringify(NIGHT_ACTION_AFTER)}">
      <text x="258" y="34" text-anchor="middle" fill="#d4a5ff" font-size="8.5" font-weight="900">③ 空列左移</text>
      ${nightBoard(NIGHT_ACTION_AFTER, 220, 50, 19, { role: "after" })}
      <path d="M289 60H269" stroke="#d4a5ff" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/><path d="M265 60l8-5v10z" fill="#d4a5ff"/>
      <text x="258" y="145" text-anchor="middle" fill="#b19ac6" font-size="7.5" font-weight="800">右侧非空列整体靠左</text>
    </g>
    <g fill="#d4a5ff" stroke="#d4a5ff" stroke-width="2" stroke-linecap="round"><path d="M103 87h10"/><path d="M117 87l-7-5v10z" stroke="none"/><path d="M202 87h10"/><path d="M216 87l-7-5v10z" stroke="none"/></g>`;
}

function nightGoal() {
  const emptyBoard = Array.from({ length: 4 }, () => Array(4).fill(null));
  return `${nightBoard(emptyBoard, 30, 30, 29, { role: "cleared" })}
    <g data-outcome="cleared" data-remaining="0">
      <rect x="169" y="34" width="116" height="116" rx="15" fill="#0c1c27" stroke="#6ccbbf66"/>
      <text x="227" y="58" text-anchor="middle" fill="#7f8b91" font-size="8" font-weight="900" letter-spacing="1.2">THE MARKET IS CLEAR</text>
      <text x="227" y="91" text-anchor="middle" fill="#f8f0e2" font-size="17" font-weight="900">全员升空</text>
      <path d="M190 103H264" stroke="#f4bc6a30"/>
      <text x="205" y="126" fill="#b9b2ad" font-size="10" font-weight="800">剩余灯灵</text>
      <text x="263" y="130" text-anchor="end" fill="#72efbb" font-size="25" font-weight="900">0</text>
      <g fill="#f4bc6a"><circle cx="193" cy="79" r="2" opacity=".35"/><circle cx="269" cy="73" r="2.6" opacity=".55"/><circle cx="278" cy="57" r="1.8" opacity=".3"/></g>
    </g>`;
}

export function nightMarketTutorialArt(focus) {
  const state = normalizedFocus(focus);
  const labels = {
    elements: "真实夜市摊位展示五类灯灵的四十八像素轮廓，同色相邻群按摊位逐格选亮",
    action: "伞影灵群逐格删除，余下灯灵先逐列下坠、再在空列消失后整体左移",
    goal: "真实空摊位保留中心点，剩余灯灵为零并显示全员升空胜利状态",
  };
  const content = state === "action" ? nightAction() : state === "goal" ? nightGoal() : nightElements();
  const layerAttributes = state === "action"
    ? ' data-collapsed-board="..B./YYB." data-action-sequence="remove,drop,shift" data-action-step-count="3"'
    : state === "goal" ? ' data-remaining="0"' : "";
  return tutorialSvg(labels[state], state, NIGHT_BACKGROUND, content, layerAttributes);
}

const SKY_BACKGROUND = `
  <rect x="18" y="14" width="284" height="156" rx="18" fill="#02101b" stroke="#91e2de30"/>
  <path d="M34 44H286M34 78H286M34 112H286M34 146H286M60 26V158M110 26V158M160 26V158M210 26V158M260 26V158" fill="none" stroke="#86c5c914"/>
  <circle cx="76" cy="62" r="74" fill="#297b8720"/><circle cx="266" cy="142" r="82" fill="#193e5524"/>`;

function skyPort(x, y, target, current, options = {}) {
  const scale = options.scale ?? 1;
  const exact = options.exact === true;
  const selected = options.selected === true;
  const targetable = options.targetable === true;
  const badgeLeft = options.badgeSide === "left";
  const badgeX = badgeLeft ? -43 : 13;
  const badgeTextX = badgeLeft ? -28 : 28;
  const ring = exact ? "#f5c977" : "#a9dada8c";
  const badgeFill = exact ? "#fff1bd" : "#071d2b";
  const badgeInk = exact ? "#071521" : "#c7dcdf";
  return `<g class="tutorial-port${exact ? " is-exact" : ""}${selected ? " is-selected" : ""}${targetable ? " is-target" : ""}" data-target="${target}" data-current="${current}" data-exact="${exact}" transform="translate(${x} ${y}) scale(${scale})">
    <circle r="27" fill="#010913" opacity=".82"/>
    ${selected ? '<circle r="31" fill="none" stroke="#91e2de" stroke-width="1.4" stroke-dasharray="4 3"/>' : ""}
    ${targetable ? '<circle r="32" fill="none" stroke="#f5c977aa" stroke-width="1.2"/>' : ""}
    <circle r="23" fill="#0a2636" stroke="${ring}" stroke-width="2"/>
    <circle r="15" fill="${exact ? "#31555a" : "#183e4d"}" stroke="${exact ? "#b68a49" : "#4b7981"}" stroke-width="3"/>
    <circle cx="-6" cy="-7" r="4.2" fill="#ffffff1e"/>
    <text y="6" text-anchor="middle" fill="#f7fcfb" font-family="Iowan Old Style,Songti SC,STSong,serif" font-size="19" font-weight="800">${target}</text>
    <g class="tutorial-port-count" data-count-label="${current}/${target}">
      <rect x="${badgeX}" y="16" width="30" height="14" rx="7" fill="${badgeFill}" stroke="${exact ? "#f5c977" : "#80bec46b"}"/>
      <text x="${badgeTextX}" y="26" text-anchor="middle" fill="${badgeInk}" font-size="8" font-weight="900">${current}/${target}</text>
    </g>
  </g>`;
}

function skyRoute(x1, y1, x2, y2, count = 0, options = {}) {
  const horizontal = y1 === y2;
  const marked = options.marked === true;
  const candidate = options.candidate !== false;
  const offsets = count === 2 ? [-4, 4] : count === 1 ? [0] : [];
  const line = (offset, shadow = false) => {
    const ax = horizontal ? x1 : x1 + offset;
    const ay = horizontal ? y1 + offset : y1;
    const bx = horizontal ? x2 : x2 + offset;
    const by = horizontal ? y2 + offset : y2;
    return `<path d="M${ax} ${ay}L${bx} ${by}" stroke="${shadow ? "#010c14" : "#fff1bd"}" stroke-width="${shadow ? 8 : 4}" stroke-linecap="round"/>`;
  };
  return `<g class="tutorial-route" data-route-count="${count}" data-marked="${marked}">
    ${candidate ? `<path class="tutorial-route-candidate" d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${marked ? "#91e2de80" : "#83c4ca42"}" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 7"/>` : ""}
    ${offsets.map((offset) => line(offset, true)).join("")}${offsets.map((offset) => line(offset, false)).join("")}
  </g>`;
}

function routeControl(x, y, state, options = {}) {
  const values = {
    empty: { label: "·", fill: "#041824", stroke: "#77b9c038", ink: "#a2d2d694" },
    one: { label: "Ⅰ", fill: "#fff1bd", stroke: "#f5c977b3", ink: "#071521" },
    two: { label: "Ⅱ", fill: "#f5c977", stroke: "#f5c977", ink: "#071521" },
    marked: { label: "×", fill: "#072734", stroke: "#91e2de99", ink: "#91e2de" },
  };
  const value = values[state] ?? values.empty;
  const scale = options.scale ?? 1;
  return `<g class="tutorial-edge-control is-${state}" data-control-state="${state}" transform="translate(${x} ${y}) scale(${scale})">
    <rect x="-12" y="-10" width="24" height="20" rx="10" fill="${value.fill}" stroke="${value.stroke}"/>
    <text y="4" text-anchor="middle" fill="${value.ink}" font-size="11" font-weight="900">${value.label}</text>
  </g>`;
}

function skyElements() {
  return `${skyRoute(90, 68, 230, 68, 0)}
    ${skyPort(66, 68, 3, 0, { scale: 0.92 })}${skyPort(254, 68, 2, 0, { scale: 0.92, badgeSide: "left" })}
    ${routeControl(160, 68, "empty")}
    <text x="160" y="29" text-anchor="middle" fill="#c7dcdf" font-size="9" font-weight="800">港心需求 · 徽标显示 当前/需求</text>
    ${skyRoute(58, 124, 132, 124, 1, { candidate: false })}${routeControl(95, 124, "one", { scale: 0.8 })}
    ${skyRoute(190, 124, 264, 124, 2, { candidate: false })}${routeControl(227, 124, "two", { scale: 0.8 })}
    <g fill="#a8c4c8" font-size="8.5" font-weight="800" text-anchor="middle"><text x="95" y="151">单航线</text><text x="227" y="151">双航线</text></g>`;
}

function skyAction() {
  return `<text x="160" y="29" text-anchor="middle" fill="#c7dcdf" font-size="9" font-weight="800">普通点击只改变真实航线数量</text>
    ${skyRoute(66, 66, 254, 66, 1)}
    ${skyPort(46, 66, 2, 1, { scale: 0.74, selected: true })}${skyPort(274, 66, 2, 1, { scale: 0.74, targetable: true, badgeSide: "left" })}
    ${routeControl(160, 66, "one")}
    <g data-action-kind="primary-click" data-cycle="0,1,2,0">
      <text x="126" y="111" text-anchor="middle" fill="#91e2de" font-size="8" font-weight="900">普通点击 · 0 → 1 → 2 → 0</text>
      <path d="M48 135H220" fill="none" stroke="#83c4ca24" stroke-width="2" stroke-dasharray="4 7"/>
      ${routeControl(48, 135, "empty")}${routeControl(100, 135, "one")}${routeControl(152, 135, "two")}${routeControl(204, 135, "empty")}
      <g fill="#91e2de" font-size="10" font-weight="900" text-anchor="middle"><text x="74" y="139">→</text><text x="126" y="139">→</text><text x="178" y="139">→</text></g>
    </g>
    <path d="M232 105V158" stroke="#91e2de2b"/>
    <g data-action-kind="mark" data-trigger="contextmenu-or-tool">
      <text x="266" y="111" text-anchor="middle" fill="#f5c977" font-size="7.5" font-weight="900">右键 / 禁航工具</text>
      <path d="M244 135H288" fill="none" stroke="#91e2de80" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 7"/>
      ${routeControl(266, 135, "marked")}
      <text x="266" y="158" text-anchor="middle" fill="#91aeb4" font-size="7.5" font-weight="800">独立笔记 · 不进循环</text>
    </g>`;
}

function skyGoal() {
  return `<g data-layout="2/3/2/3" data-components="1" data-exact-ports="4">
    <text x="160" y="27" text-anchor="middle" fill="#91e2de" font-size="9" font-weight="900">4 / 4 港满足 · 网络 1 区</text>
    ${skyRoute(68, 54, 252, 54, 1)}
    ${skyRoute(68, 54, 68, 134, 1)}
    ${skyRoute(68, 134, 252, 134, 1)}
    ${skyRoute(252, 54, 252, 134, 2)}
    ${skyPort(68, 54, 2, 2, { scale: 0.82, exact: true })}
    ${skyPort(252, 54, 3, 3, { scale: 0.82, exact: true, badgeSide: "left" })}
    ${skyPort(68, 134, 2, 2, { scale: 0.82, exact: true })}
    ${skyPort(252, 134, 3, 3, { scale: 0.82, exact: true, badgeSide: "left" })}
  </g>`;
}

export function skyBridgesTutorialArt(focus) {
  const state = normalizedFocus(focus);
  const labels = {
    elements: "真实云海航图展示深海多环浮空港、当前与需求徽标、候选虚线及单双航线",
    action: "普通点击只在零条、一条和两条航线间循环；禁航记号由右键或禁航工具独立添加",
    goal: "规则有效的四港连通网络，四港目标二三二三分别精确显示二比二和三比三",
  };
  const content = state === "action" ? skyAction() : state === "goal" ? skyGoal() : skyElements();
  const layerAttributes = state === "goal"
    ? ' data-port-count="4" data-route-counts="1,1,1,2" data-complete="true"'
    : state === "action"
      ? ' data-primary-cycle="0,1,2,0" data-mark-action="contextmenu-or-tool" data-mark-in-cycle="false"'
      : "";
  return tutorialSvg(labels[state], state, SKY_BACKGROUND, content, layerAttributes);
}
