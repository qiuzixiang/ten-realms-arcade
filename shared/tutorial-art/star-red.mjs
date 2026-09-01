const VALID_FOCUSES = new Set(["elements", "action", "goal"]);

function normaliseFocus(focus) {
  return VALID_FOCUSES.has(focus) ? focus : "elements";
}

function realmSvg(prefix, focus, label, content, definitions) {
  const mode = normaliseFocus(focus);
  return `<svg class="realm-art" data-focus="${mode}" viewBox="0 0 320 184" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
    <defs>${definitions}</defs>
    ${content}
  </svg>`;
}

function starDefinitions(id) {
  return `
    <radialGradient id="${id}-space" cx="46%" cy="39%" r="78%"><stop stop-color="#0b1b33"/><stop offset=".56" stop-color="#050d1a"/><stop offset="1" stop-color="#02050b"/></radialGradient>
    <linearGradient id="${id}-wall" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2b405c"/><stop offset=".42" stop-color="#111d30"/><stop offset="1" stop-color="#070e1a"/></linearGradient>
    <linearGradient id="${id}-ship" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#274a6a"/><stop offset=".48" stop-color="#e5fbff"/><stop offset="1" stop-color="#4652ab"/></linearGradient>
    <linearGradient id="${id}-crystal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#efffff"/><stop offset=".42" stop-color="#76eaff"/><stop offset="1" stop-color="#5267ff"/></linearGradient>
    <linearGradient id="${id}-flame" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e6faff"/><stop offset=".3" stop-color="#56dcff"/><stop offset="1" stop-color="#7e41ff" stop-opacity="0"/></linearGradient>
    <filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

function spaceBackdrop(id) {
  return `<rect x="8" y="8" width="304" height="168" rx="18" fill="url(#${id}-space)" stroke="#73d7ff55"/>
    <g fill="#d7f8ff" opacity=".45"><circle cx="31" cy="30" r=".8"/><circle cx="73" cy="17" r=".6"/><circle cx="291" cy="38" r=".7"/><circle cx="273" cy="158" r=".6"/><circle cx="24" cy="151" r=".7"/><circle cx="207" cy="20" r=".5"/><circle cx="303" cy="99" r=".5"/></g>`;
}

function emptyStarTile(x, y, size) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#071222" stroke="#6fb1e42e" stroke-width=".8"/>`;
}

function starWall(x, y, size, id) {
  const inset = Math.max(1.4, size * 0.055);
  const left = x + inset;
  const top = y + inset;
  const inner = size - inset * 2;
  const bolt = Math.max(1, size * 0.035);
  return `<g>
    <rect x="${left}" y="${top}" width="${inner}" height="${inner}" fill="url(#${id}-wall)" stroke="#7ea3cd4d" stroke-width=".8"/>
    <path d="M${x + size * .17} ${y + size * .74}L${x + size * .74} ${y + size * .17}M${x + size * .38} ${y + size * .86}L${x + size * .86} ${y + size * .38}" fill="none" stroke="#7894bc2f" stroke-width="${Math.max(.7, size * .024)}"/>
    <rect x="${x + size * .13}" y="${y + size * .13}" width="${bolt}" height="${bolt}" fill="#9dc0e166"/><rect x="${x + size * .83}" y="${y + size * .83}" width="${bolt}" height="${bolt}" fill="#9dc0e166"/>
    <path d="M${left} ${top + .7}H${left + inner}" stroke="#76c6ef35" stroke-width="${Math.max(1, size * .04)}"/>
  </g>`;
}

function starAnchor(cx, cy, radius, home = false) {
  const color = home ? "#71e7ff" : "#a573ff";
  return `<g fill="none" stroke="${color}" filter="url(#STAR_GLOW)">
    <circle cx="${cx}" cy="${cy}" r="${radius}" stroke-width="${Math.max(1.1, radius * .08)}" opacity=".78"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * .67}" stroke-width="${Math.max(.8, radius * .06)}" stroke-dasharray="${radius * .28} ${radius * .18}" opacity=".5"/>
    <rect x="${cx - radius * .11}" y="${cy - radius * .11}" width="${radius * .22}" height="${radius * .22}" fill="${color}" stroke="none"/>
  </g>`;
}

function starEnergy(cx, cy, radius, id) {
  return `<g transform="translate(${cx} ${cy}) rotate(45)" filter="url(#${id}-glow)">
    <rect x="${-radius}" y="${-radius}" width="${radius * 2}" height="${radius * 2}" fill="none" stroke="#dafbffcc" stroke-width=".8"/>
    <rect x="${-radius * .64}" y="${-radius * .64}" width="${radius * 1.28}" height="${radius * 1.28}" fill="url(#${id}-crystal)"/>
  </g>`;
}

function starMine(cx, cy, radius, id) {
  return `<g transform="translate(${cx} ${cy})" filter="url(#${id}-glow)">
    <path d="M0 ${-radius}L${radius * .9} ${radius * .82}L${-radius * .9} ${radius * .82}Z" fill="#62081db8" stroke="#ff4b6aea" stroke-width="${Math.max(1, radius * .09)}"/>
    <rect x="${-radius * .055}" y="${-radius * .43}" width="${radius * .11}" height="${radius * .53}" fill="#ff9aab"/><rect x="${-radius * .055}" y="${radius * .26}" width="${radius * .11}" height="${radius * .11}" fill="#ff9aab"/>
  </g>`;
}

function starShip(cx, cy, angle, size, id, { thrust = false, heading = "" } = {}) {
  const headingData = heading ? ` data-heading="${heading}"` : "";
  return `<g transform="translate(${cx} ${cy}) rotate(${angle})"${headingData} filter="url(#${id}-glow)">
    ${thrust ? `<path d="M${-size * .22} ${size * .42}L0 ${size * 1.62}L${size * .22} ${size * .42}Z" fill="url(#${id}-flame)"/>` : ""}
    <path d="M0 ${-size}L${size * .67} ${size * .45}L${size * .3} ${size * .35}L${size * .58} ${size * .76}L0 ${size * .52}L${-size * .58} ${size * .76}L${-size * .3} ${size * .35}L${-size * .67} ${size * .45}Z" fill="url(#${id}-ship)" stroke="#c7f7ff" stroke-width="${Math.max(1.1, size * .07)}"/>
    <ellipse cy="${-size * .16}" rx="${size * .2}" ry="${size * .33}" fill="#16324a" stroke="#71e7ffcc" stroke-width="${Math.max(.7, size * .04)}"/>
  </g>`;
}

function replaceStarGlow(markup, id) {
  return markup.replaceAll("STAR_GLOW", `${id}-glow`);
}

function starBoard(grid, x, y, size, id, { showEnergy = true } = {}) {
  let tiles = `<rect x="${x}" y="${y}" width="${grid[0].length * size}" height="${grid.length * size}" rx="4" fill="#050d19" stroke="#73d7ff70"/>`;
  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < grid[row].length; column += 1) {
      const left = x + column * size;
      const top = y + row * size;
      const tile = grid[row][column];
      tiles += emptyStarTile(left, top, size);
      if (tile === "#") tiles += starWall(left, top, size, id);
    }
  }
  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < grid[row].length; column += 1) {
      const tile = grid[row][column];
      const cx = x + (column + .5) * size;
      const cy = y + (row + .5) * size;
      if (tile === "@") tiles += replaceStarGlow(starAnchor(cx, cy, size * .3, true), id);
      if (tile === "o") tiles += replaceStarGlow(starAnchor(cx, cy, size * .27, false), id);
      if (tile === "x") tiles += starMine(cx, cy, size * .23, id);
      if (tile === "e" && showEnergy) tiles += starEnergy(cx, cy, size * .17, id);
    }
  }
  return tiles;
}

function starElements(id) {
  const samples = [
    { cx: 56, cy: 57, label: "回收艇", art: starShip(56, 57, 0, 14, id, { heading: "N" }) },
    { cx: 160, cy: 57, label: "能源芯", art: starEnergy(160, 57, 10, id) },
    { cx: 264, cy: 57, label: "引力锚", art: replaceStarGlow(starAnchor(264, 57, 15, false), id) },
    { cx: 108, cy: 129, label: "残骸墙", art: starWall(86, 107, 44, id) },
    { cx: 212, cy: 129, label: "失稳反应堆", art: starMine(212, 129, 13, id) },
  ];
  const cells = samples.map(({ cx, cy, art }) => `${emptyStarTile(cx - 22, cy - 22, 44)}${art}`).join("");
  const labels = samples.map(({ cx, cy, label }) => `<text x="${cx}" y="${cy + 37}" text-anchor="middle">${label}</text>`).join("");
  return `<g class="art-elements" font-family="ui-sans-serif,system-ui,sans-serif">
    ${cells}<g fill="#cfe7f5" font-size="10" font-weight="800">${labels}</g>
  </g>`;
}

function starAction(id) {
  const grid = ["#####", "#@#.#", "##..#", "#..e#", "#####"];
  return `<g class="art-action" data-path="1,1 2,2 3,3" data-direction="SE" font-family="ui-sans-serif,system-ui,sans-serif">
    ${starBoard(grid, 90, 22, 28, id)}
    <path d="M132 64L160 92L188 120" fill="none" stroke="#07101d" stroke-width="7" stroke-linecap="round"/>
    <path d="M132 64L160 92L188 120" fill="none" stroke="#64ddff" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="7 5" filter="url(#${id}-glow)"/>
    <g fill="#dffbff" stroke="#37677d" stroke-width="1"><circle cx="132" cy="64" r="3.5"/><circle cx="160" cy="92" r="3.5"/><circle cx="188" cy="120" r="3.5"/></g>
    ${starEnergy(188, 120, 5, id)}${starShip(160, 92, 135, 11.5, id, { thrust: true, heading: "SE" })}
    <g><rect x="18" y="39" width="58" height="48" rx="10" fill="#0b1d31" stroke="#71e7ff66"/><text x="47" y="56" text-anchor="middle" fill="#8ca0b9" font-size="8" font-weight="800">推进方向</text><text x="47" y="76" text-anchor="middle" fill="#dffbff" font-size="15" font-weight="900">SE ↘</text></g>
    <g><rect x="242" y="82" width="60" height="48" rx="10" fill="#0b1d31" stroke="#9e72ff66"/><text x="272" y="99" text-anchor="middle" fill="#8ca0b9" font-size="8" font-weight="800">每一步</text><text x="272" y="117" text-anchor="middle" fill="#e5dcff" font-size="10" font-weight="900">+1, +1</text></g>
  </g>`;
}

function starGoal(id) {
  const blueDock = ["#######", "#@...e#", "#..o..#", "#..x..#", "#.....#", "#e...e#", "#######"];
  return `<g class="art-goal" data-energy-remaining="0" data-energy-total="3" font-family="ui-sans-serif,system-ui,sans-serif">
    ${starBoard(blueDock, 18, 22, 20, id, { showEnergy: false })}
    <path d="M48 52H128V132H48" fill="none" stroke="#64ddff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 5" opacity=".46"/>
    ${starShip(48, 132, -90, 8, id, { heading: "W" })}
    <rect x="176" y="29" width="126" height="126" rx="16" fill="#09182a" stroke="#71e7ff55"/>
    <text x="239" y="54" text-anchor="middle" fill="#8d9bb2" font-size="10" font-weight="800">能源芯回收</text>
    <text x="239" y="87" text-anchor="middle" fill="#e8fbff" font-size="29" font-weight="900">3 / 3</text>
    <rect x="198" y="99" width="82" height="22" rx="11" fill="#113d3a" stroke="#72efbb88"/><text x="239" y="114" text-anchor="middle" fill="#a9ffdc" font-size="10" font-weight="900">剩余 0</text>
    <circle cx="215" cy="139" r="10" fill="#72efbb"/><path d="M210 139l4 4 7-9" fill="none" stroke="#092329" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><text x="252" y="143" text-anchor="middle" fill="#dffef1" font-size="11" font-weight="900">任务完成</text>
  </g>`;
}

export function starDriftTutorialArt(focus = "elements") {
  const mode = normaliseFocus(focus);
  const id = `tutorial-star-${mode}`;
  const labels = {
    elements: "真实回收航区元素：回收艇、旋转能源晶体、双环引力锚、金属残骸墙与三角失稳反应堆",
    action: "回收艇以正确船头朝东南推进，每一步横纵坐标同时增加一格，沿合法四十五度路径回收能源芯",
    goal: "蓝港校准真实胜利状态：三枚能源芯全部回收，棋盘不再显示剩余晶体，进度为三分之三",
  };
  const content = mode === "action" ? starAction(id) : mode === "goal" ? starGoal(id) : starElements(id);
  return realmSvg(id, mode, labels[mode], `${spaceBackdrop(id)}${content}`, starDefinitions(id));
}

const RED_MARKS = ["归", "晴", "知", "安", "逢", "暖", "同"];
const RED_EDGES = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [0, 1], [0, 4]];
const RED_SOLUTION = [
  { id: 0, x: .5, y: .5 },
  { id: 1, x: .5, y: .12 },
  { id: 2, x: .8290896534, y: .31 },
  { id: 3, x: .8290896534, y: .69 },
  { id: 4, x: .5, y: .88 },
  { id: 5, x: .1709103466, y: .69 },
  { id: 6, x: .1709103466, y: .31 },
];
const RED_ACTION_BEFORE = RED_SOLUTION.map((point) => point.id === 0 ? { ...point, x: .1, y: .1 } : point);
const RED_ELEMENTS_STATE = [
  { id: 0, x: .8687040469, y: .5019560943 },
  { id: 1, x: .5050468547, y: .872602533 },
  { id: 2, x: .1175672373, y: .8916677839 },
  { id: 3, x: .5108803759, y: .12017652 },
  { id: 4, x: .891299161, y: .1294294375 },
  { id: 5, x: .5228062857, y: .5228175631 },
  { id: 6, x: .1055457603, y: .136364371 },
];

function redDefinitions(id) {
  return `
    <linearGradient id="${id}-paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4e6cf"/><stop offset=".58" stop-color="#ead3ae"/><stop offset="1" stop-color="#dcbf91"/></linearGradient>
    <radialGradient id="${id}-seal"><stop offset="0" stop-color="#a32b41"/><stop offset=".62" stop-color="#701427"/><stop offset="1" stop-color="#48101d"/></radialGradient>
    <linearGradient id="${id}-seal-solved" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d69b52"/><stop offset=".42" stop-color="#a94439"/><stop offset="1" stop-color="#67251d"/></linearGradient>
    <filter id="${id}-knot-glow" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="2.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="${id}-gold-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

function paperBackdrop(id) {
  return `<rect x="8" y="8" width="304" height="168" rx="18" fill="url(#${id}-paper)" stroke="#7f442c55"/>
    <path d="M24 35C87 22 213 22 296 38M26 145C112 158 222 158 294 141" fill="none" stroke="#8e5a3821" stroke-width="1.2"/>
    <g fill="#9d63372a"><circle cx="35" cy="115" r="1.2"/><circle cx="283" cy="57" r="1"/><circle cx="214" cy="162" r=".8"/><circle cx="95" cy="17" r=".7"/></g>`;
}

function mapRedPoint(point, box) {
  return { x: box.x + point.x * box.width, y: box.y + point.y * box.height };
}

function lineIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  return {
    x: ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / denominator,
    y: ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / denominator,
  };
}

function redEdge(a, b, knotted, solved, scale = 1) {
  const main = knotted && !solved ? "#da253d" : "#b17c2c";
  const highlight = knotted && !solved ? "#ffa2aa" : "#ffe49e";
  return `<g fill="none" stroke-linecap="round">
    <path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#3b17163d" stroke-width="${(knotted ? 5 : 4) * scale}"/>
    <path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${main}" stroke-width="${(knotted && !solved ? 2.5 : 2.1) * scale}"${solved ? " filter=\"url(#RED_GOLD_GLOW)\"" : ""}/>
    <path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${highlight}" stroke-width="${.7 * scale}"/>
  </g>`;
}

function redKnot(point, scale, id) {
  const radius = 6.4 * scale;
  return `<g transform="translate(${point.x} ${point.y})" filter="url(#${id}-knot-glow)">
    <circle r="${radius}" fill="#ef2c4838" stroke="#931227" stroke-width="${2 * scale}"/>
    <g fill="none" stroke="#ffd2cf" stroke-width="${Math.max(.7, scale)}" stroke-linecap="round"><path d="M${-radius * .75} ${-radius * .3}C${-radius * .15} ${-radius},${radius * .15} ${radius},${radius * .75} ${radius * .3}"/><path d="M${-radius * .75} ${radius * .3}C${-radius * .15} ${radius},${radius * .15} ${-radius},${radius * .75} ${-radius * .3}"/></g>
  </g>`;
}

const SEAL_OUTLINES = [
  "M-13-15L10-13 15-9 13 12 8 15-11 13-15 8-14-11Z",
  "M-10-15L13-12 15-5 12 14 5 15-13 11-15 3-12-12Z",
  "M-14-11L-9-15 9-14 15-7 13 12 6 15-12 13-15 6Z",
];

function redSeal(point, index, solved, scale, id) {
  const rotation = ((index * 7) % 9) - 4;
  const fill = solved ? `${id}-seal-solved` : `${id}-seal`;
  return `<g transform="translate(${point.x} ${point.y}) rotate(${rotation}) scale(${scale})"${solved ? ` filter="url(#${id}-gold-glow)"` : ""}>
    <path d="${SEAL_OUTLINES[index % SEAL_OUTLINES.length]}" fill="url(#${fill})" stroke="${solved ? "#f0c779" : "#d7a552"}" stroke-width="2"/>
    <path d="M-9-10L7-9 10-6 9 8 6 10-8 9-10 6-9-8Z" fill="none" stroke="#f8dcaa99"/>
    <text x="0" y="6" text-anchor="middle" fill="#fff0d6" font-size="16" font-family="Songti SC,STSong,serif" font-weight="800">${RED_MARKS[index]}</text>
  </g>`;
}

function replaceRedGoldGlow(markup, id) {
  return markup.replaceAll("RED_GOLD_GLOW", `${id}-gold-glow`);
}

function redGraph(points, box, id, { crossings = [], solved = false, scale = 1 } = {}) {
  const positions = points.map((point) => mapRedPoint(point, box));
  const crossed = new Set(crossings.flat());
  const edgeOrder = RED_EDGES.map((_, index) => index).sort((a, b) => Number(crossed.has(a)) - Number(crossed.has(b)));
  const edges = edgeOrder.map((edgeIndex) => {
    const [from, to] = RED_EDGES[edgeIndex];
    return replaceRedGoldGlow(redEdge(positions[from], positions[to], crossed.has(edgeIndex), solved, scale), id);
  }).join("");
  const knots = crossings.map(([firstIndex, secondIndex]) => {
    const first = RED_EDGES[firstIndex];
    const second = RED_EDGES[secondIndex];
    return redKnot(lineIntersection(positions[first[0]], positions[first[1]], positions[second[0]], positions[second[1]]), scale, id);
  }).join("");
  const seals = positions.map((point, index) => redSeal(point, index, solved, scale, id)).join("");
  return `${edges}${knots}${seals}`;
}

function redElements(id) {
  return `<g class="art-elements" font-family="ui-sans-serif,system-ui,sans-serif">
    ${redGraph(RED_ELEMENTS_STATE, { x: 34, y: 20, width: 252, height: 137 }, id, { crossings: [[1, 4], [1, 5]], scale: .78 })}
    <rect x="105" y="155" width="110" height="17" rx="8.5" fill="#fff4dfdd" stroke="#8d523744"/><text x="160" y="167" text-anchor="middle" fill="#7b2340" font-size="9" font-weight="900">2 线结 · 7 印 / 8 线</text>
  </g>`;
}

function redAction(id) {
  const beforeBox = { x: 24, y: 37, width: 116, height: 110 };
  const afterBox = { x: 180, y: 37, width: 116, height: 110 };
  const beforeSeal = mapRedPoint(RED_ACTION_BEFORE[0], beforeBox);
  const beforeTarget = mapRedPoint(RED_SOLUTION[0], beforeBox);
  return `<g class="art-action" data-crossings-before="1" data-crossings-after="0" font-family="ui-sans-serif,system-ui,sans-serif">
    <rect x="10" y="25" width="144" height="148" rx="13" fill="#fff7e8a8" stroke="#8d523744"/><rect x="166" y="25" width="144" height="148" rx="13" fill="#fff7e8a8" stroke="#8d523744"/>
    <text x="82" y="19" text-anchor="middle" fill="#8d2038" font-size="10" font-weight="900">拖动前 · 1 线结</text><text x="238" y="19" text-anchor="middle" fill="#6f5125" font-size="10" font-weight="900">归位后 · 0 线结</text>
    ${redGraph(RED_ACTION_BEFORE, beforeBox, id, { crossings: [[5, 7]], scale: .56 })}
    ${redGraph(RED_SOLUTION, afterBox, id, { solved: true, scale: .56 })}
    <path d="M${beforeSeal.x + 8} ${beforeSeal.y + 8}Q${beforeTarget.x - 12} ${beforeTarget.y - 26} ${beforeTarget.x} ${beforeTarget.y - 9}" fill="none" stroke="#845bff" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3"/><path d="M${beforeTarget.x} ${beforeTarget.y - 5}l-5-8h10z" fill="#845bff"/>
    <path d="M155 92H165" stroke="#845bff" stroke-width="2.4" stroke-linecap="round"/><path d="M166 92l-6-5v10z" fill="#845bff"/>
    <text x="82" y="166" text-anchor="middle" fill="#9b2940" font-size="9" font-weight="900">红边 + 真实绳结</text><text x="238" y="166" text-anchor="middle" fill="#84622e" font-size="9" font-weight="900">8 条红线全部金色</text>
  </g>`;
}

function redGoal(id) {
  return `<g class="art-goal" data-seal-count="7" data-crossings="0" font-family="ui-sans-serif,system-ui,sans-serif">
    ${redGraph(RED_SOLUTION, { x: 42, y: 20, width: 236, height: 136 }, id, { solved: true, scale: .94 })}
    <circle cx="286" cy="30" r="12" fill="#4e9f6a" stroke="#e4ffd9"/><path d="M280 30l4 4 8-10" fill="none" stroke="#fff8dc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="94" y="155" width="132" height="17" rx="8.5" fill="#fff4dfdd" stroke="#a4743055"/><text x="160" y="167" text-anchor="middle" fill="#795424" font-size="9" font-weight="900">初签 · 7 印 · 8 金线 · 0 线结</text>
  </g>`;
}

export function redThreadTutorialArt(focus = "elements") {
  const mode = normaliseFocus(focus);
  const id = `tutorial-red-${mode}`;
  const labels = {
    elements: "初签真实案卷：七枚人物印章由八条红线连接，三层线条区分理顺金线与相交红线，两个绳结标在真实交点",
    action: "初签七印八线案卷中，将归字印从左上拖回中心，交叉数从一个严格变为零个",
    goal: "初签真实通关状态：七枚印章全部呈金色归档光效，八条红线互不相交，线结数为零",
  };
  const content = mode === "action" ? redAction(id) : mode === "goal" ? redGoal(id) : redElements(id);
  return realmSvg(id, mode, labels[mode], `${paperBackdrop(id)}${content}`, redDefinitions(id));
}
