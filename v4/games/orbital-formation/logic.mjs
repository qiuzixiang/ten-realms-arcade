/**
 * 轨道编队调度 / Netslide
 *
 * Modules never rotate. A command cyclically shifts an entire row or column,
 * while every module keeps its original ports. The completed arrangement must
 * be one connected, acyclic Net: matching ports only, no signal into space.
 */
export const WIDTH = 3;
export const SIZE = WIDTH * WIDTH;
export const TARGET_ORDER = Object.freeze(Array.from({ length: SIZE }, (_, index) => index));

export const DIRECTIONS = Object.freeze({
  N: Object.freeze({ row: -1, column: 0, opposite: "S", label: "北" }),
  E: Object.freeze({ row: 0, column: 1, opposite: "W", label: "东" }),
  S: Object.freeze({ row: 1, column: 0, opposite: "N", label: "南" }),
  W: Object.freeze({ row: 0, column: -1, opposite: "E", label: "西" }),
});
export const DIRECTION_ORDER = Object.freeze(["N", "E", "S", "W"]);

// This target layout is a nine-node tree. The orientation is part of each
// physical module and is deliberately not changed by a slide command.
export const MODULES = Object.freeze([
  Object.freeze({ id: 0, name: "曙光弯接器", ports: "ES", kind: "elbow" }),
  Object.freeze({ id: 1, name: "横向桥接器", ports: "EW", kind: "line" }),
  Object.freeze({ id: 2, name: "北斗弯接器", ports: "SW", kind: "elbow" }),
  Object.freeze({ id: 3, name: "纵向引导器", ports: "NS", kind: "line" }),
  Object.freeze({ id: 4, name: "南辰弯接器", ports: "ES", kind: "elbow" }),
  Object.freeze({ id: 5, name: "三叉中继器", ports: "NSW", kind: "fork" }),
  Object.freeze({ id: 6, name: "回声端点", ports: "N", kind: "end" }),
  Object.freeze({ id: 7, name: "脉冲端点", ports: "N", kind: "end" }),
  Object.freeze({ id: 8, name: "远航端点", ports: "N", kind: "end" }),
]);

const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
const permutation = (order) => Array.isArray(order)
  && order.length === SIZE
  && new Set(order).size === SIZE
  && order.every((item) => integer(item, 0, SIZE - 1));

function parity(order) {
  let inversions = 0;
  for (let left = 0; left < order.length; left += 1) {
    for (let right = left + 1; right < order.length; right += 1) if (order[left] > order[right]) inversions += 1;
  }
  return inversions % 2;
}

/** Every 3-cell row/column cycle is even, so an odd stored order is impossible. */
export function isReachableOrder(order) {
  return permutation(order) && parity(order) === 0;
}

function freezeState(order, moves = 0) {
  return Object.freeze({ order: Object.freeze([...order]), moves });
}

export function createState(order = TARGET_ORDER, moves = 0) {
  if (!isReachableOrder(order) || !integer(moves, 0, 100000)) throw new TypeError("Invalid orbital formation state.");
  return freezeState(order, moves);
}

export function normalizeState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  if (!isReachableOrder(candidate.order) || !integer(candidate.moves, 0, 100000)) return null;
  return freezeState(candidate.order, candidate.moves);
}

export function moduleAt(state, position) {
  const clean = normalizeState(state);
  if (!clean || !integer(position, 0, SIZE - 1)) return null;
  return MODULES[clean.order[position]] ?? null;
}

export function hasPort(module, direction) {
  return Boolean(module && DIRECTION_ORDER.includes(direction) && module.ports.includes(direction));
}

export function neighborFor(position, direction) {
  if (!integer(position, 0, SIZE - 1) || !DIRECTIONS[direction]) return -1;
  const row = Math.floor(position / WIDTH) + DIRECTIONS[direction].row;
  const column = position % WIDTH + DIRECTIONS[direction].column;
  return row >= 0 && row < WIDTH && column >= 0 && column < WIDTH ? row * WIDTH + column : -1;
}

function shiftIndices(state, positions, direction) {
  const clean = normalizeState(state);
  if (!clean || ![1, -1].includes(direction)) return state;
  const next = [...clean.order];
  for (let offset = 0; offset < positions.length; offset += 1) {
    const target = positions[(offset + direction + positions.length) % positions.length];
    next[target] = clean.order[positions[offset]];
  }
  return createState(next, clean.moves + 1);
}

export function shiftRow(state, row, direction) {
  if (!integer(row, 0, WIDTH - 1)) return state;
  return shiftIndices(state, Array.from({ length: WIDTH }, (_, column) => row * WIDTH + column), direction);
}

export function shiftColumn(state, column, direction) {
  if (!integer(column, 0, WIDTH - 1)) return state;
  return shiftIndices(state, Array.from({ length: WIDTH }, (_, row) => row * WIDTH + column), direction);
}

export function applyShift(state, action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) return state;
  if (action.axis === "row") return shiftRow(state, action.index, action.direction);
  if (action.axis === "column") return shiftColumn(state, action.index, action.direction);
  return state;
}

/** Inspect the actual current Net; no target-layout shortcut is used for victory. */
export function networkReport(state) {
  const clean = normalizeState(state);
  if (!clean) return Object.freeze({ valid: false, dangling: Object.freeze([]), mismatches: Object.freeze([]), pairs: Object.freeze([]), connected: Object.freeze([]), edgeCount: 0, solved: false });
  const dangling = [];
  const mismatches = [];
  const pairs = [];
  const links = Array.from({ length: SIZE }, () => []);
  for (let position = 0; position < SIZE; position += 1) {
    const module = moduleAt(clean, position);
    for (const direction of DIRECTION_ORDER) {
      if (!hasPort(module, direction)) continue;
      const neighbor = neighborFor(position, direction);
      if (neighbor < 0) { dangling.push(Object.freeze({ position, direction })); continue; }
      const other = moduleAt(clean, neighbor);
      if (!hasPort(other, DIRECTIONS[direction].opposite)) {
        mismatches.push(Object.freeze({ position, neighbor, direction }));
        continue;
      }
      if (position < neighbor) {
        pairs.push(Object.freeze([position, neighbor]));
        links[position].push(neighbor);
        links[neighbor].push(position);
      }
    }
  }
  const connected = [];
  const queue = [0];
  const seen = new Set();
  while (queue.length) {
    const position = queue.shift();
    if (seen.has(position)) continue;
    seen.add(position);
    connected.push(position);
    for (const neighbor of links[position]) if (!seen.has(neighbor)) queue.push(neighbor);
  }
  const solved = dangling.length === 0 && mismatches.length === 0 && connected.length === SIZE && pairs.length === SIZE - 1;
  return Object.freeze({
    valid: true,
    dangling: Object.freeze(dangling),
    mismatches: Object.freeze(mismatches),
    pairs: Object.freeze(pairs),
    connected: Object.freeze(connected.sort((left, right) => left - right)),
    edgeCount: pairs.length,
    solved,
  });
}

export function isComplete(state) {
  return networkReport(state).solved;
}

function runFromTarget(actions) {
  return actions.reduce((state, action) => applyShift(state, action), createState(TARGET_ORDER));
}

export const START_SCRIPT = Object.freeze([
  Object.freeze({ axis: "row", index: 0, direction: 1 }),
  Object.freeze({ axis: "column", index: 2, direction: -1 }),
  Object.freeze({ axis: "row", index: 1, direction: 1 }),
  Object.freeze({ axis: "column", index: 0, direction: 1 }),
]);
export const START_STATE = runFromTarget(START_SCRIPT);
export const SUGGESTED_STEPS = START_SCRIPT.length;
export function freshState() { return createState(START_STATE.order, 0); }

export const TUTORIAL_INITIAL = runFromTarget([
  { axis: "row", index: 1, direction: 1 },
  { axis: "column", index: 0, direction: 1 },
]);
export const TUTORIAL_AFTER_ACTION = applyShift(TUTORIAL_INITIAL, { axis: "column", index: 0, direction: -1 });
export const TUTORIAL_COMPLETE = applyShift(TUTORIAL_AFTER_ACTION, { axis: "row", index: 1, direction: -1 });

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function segmentForPort(port, cx, cy, reach) {
  const point = {
    N: [cx, cy - reach], E: [cx + reach, cy], S: [cx, cy + reach], W: [cx - reach, cy],
  }[port];
  return `<path d="M${cx} ${cy}L${point[0]} ${point[1]}" fill="none" stroke="#8ef5ed" stroke-width="6" stroke-linecap="round"/>`;
}

/** Reusable exact physical module art for both board and tutorial SVG. */
export function moduleSvg(moduleId, { label = true, compact = false } = {}) {
  const module = MODULES[moduleId];
  if (!module) return "";
  const size = compact ? 72 : 100;
  const center = size / 2;
  const reach = compact ? 28 : 40;
  const paths = [...module.ports].map((port) => segmentForPort(port, center, center, reach)).join("");
  const text = label ? `<text x="${center}" y="${size - 11}" text-anchor="middle" fill="#d9ffff" font-family="ui-monospace, monospace" font-size="10" font-weight="800">${moduleId + 1}</text>` : "";
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true" data-module-id="${moduleId}" data-ports="${module.ports}" preserveAspectRatio="xMidYMid meet"><rect x="6" y="6" width="${size - 12}" height="${size - 12}" rx="${compact ? 13 : 18}" fill="#102b3b" stroke="#77e4e0" stroke-opacity=".7"/>${paths}<circle cx="${center}" cy="${center}" r="${compact ? 10 : 14}" fill="#193e4f" stroke="#dcfffd" stroke-width="2"/><path d="M${center - 4} ${center}h8M${center} ${center - 4}v8" stroke="#f6f5bf" stroke-width="2" stroke-linecap="round"/>${text}</svg>`;
}

function tutorialModule(state, position, focus) {
  const module = moduleAt(state, position);
  const column = position % WIDTH;
  const row = Math.floor(position / WIDTH);
  const x = 132 + column * 96;
  const y = 78 + row * 68;
  const highlighted = (focus?.axis === "row" && focus.index === row) || (focus?.axis === "column" && focus.index === column);
  const wire = [...module.ports].map((port) => {
    const delta = { N: [0, -26], E: [34, 0], S: [0, 26], W: [-34, 0] }[port];
    return `<path d="M${x + 38} ${y + 28}l${delta[0]} ${delta[1]}" stroke="#8ef5ed" stroke-width="5" stroke-linecap="round"/>`;
  }).join("");
  return `<g data-formation-cell="${position}" data-module-id="${module.id}" data-ports="${module.ports}"><rect x="${x}" y="${y}" width="76" height="56" rx="12" fill="${highlighted ? "#286273" : "#102b3b"}" stroke="${highlighted ? "#fff0a0" : "#77e4e0"}" stroke-width="${highlighted ? 3 : 1.3}"/>${wire}<circle cx="${x + 38}" cy="${y + 28}" r="10" fill="#193e4f" stroke="#dcfffd" stroke-width="1.6"/><text x="${x + 38}" y="${y + 47}" text-anchor="middle" fill="#d9ffff" font-family="ui-monospace, monospace" font-size="10" font-weight="800">${module.id + 1}</text></g>`;
}

export function tutorialSvg(state, { stage, focus = null, annotation = "" } = {}) {
  const clean = normalizeState(state);
  if (!clean) throw new TypeError("Tutorial art requires a real Netslide state.");
  const title = stage === "elements" ? "真实起始编队" : stage === "action" ? "一次整列环移" : "真实连通编队";
  const report = networkReport(clean);
  const modules = Array.from({ length: SIZE }, (_, position) => tutorialModule(clean, position, focus)).join("");
  const action = !focus ? "" : focus.axis === "column" && focus.direction < 0
    ? '<path d="M78 220V112" stroke="#fff0a0" stroke-width="3" stroke-dasharray="5 5"/><path d="M68 122l10-10 10 10" fill="none" stroke="#fff0a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    : focus.axis === "column"
      ? '<path d="M78 112v108" stroke="#fff0a0" stroke-width="3" stroke-dasharray="5 5"/><path d="M68 210l10 10 10-10" fill="none" stroke="#fff0a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
      : focus.direction < 0
        ? '<path d="M120 254H214" stroke="#fff0a0" stroke-width="3" stroke-dasharray="5 5"/><path d="M130 244l-10 10 10 10" fill="none" stroke="#fff0a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<path d="M214 254h94" stroke="#fff0a0" stroke-width="3" stroke-dasharray="5 5"/><path d="M298 244l10 10-10 10" fill="none" stroke="#fff0a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
  const actionData = focus ? ` data-action-axis="${focus.axis}" data-action-direction="${focus.direction}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 320" role="img" aria-label="${escapeXml(title)}" data-tutorial-game="orbital-formation" data-stage="${escapeXml(stage)}" data-order="${clean.order.join(",")}" data-edge-count="${report.edgeCount}"${actionData} preserveAspectRatio="xMidYMid meet"><rect width="540" height="320" rx="24" fill="#06161e"/><text x="42" y="35" fill="#8ef5ed" font-family="ui-monospace, monospace" font-size="13" font-weight="800">ORBITAL FORMATION · ${escapeXml(title)}</text><rect x="112" y="58" width="304" height="222" rx="20" fill="#0b2430" stroke="#76e4e0" stroke-opacity=".45"/>${action}${modules}<text x="42" y="300" fill="#b8dbdc" font-family="ui-sans-serif, sans-serif" font-size="13">${escapeXml(annotation)}</text></svg>`;
}

export function tutorialCards() {
  if (!isComplete(TUTORIAL_COMPLETE)) throw new Error("Netslide tutorial must culminate in a connected tree.");
  return Object.freeze([
    Object.freeze({
      tag: "01 · 读取端口",
      title: "模块不会旋转，只会换轨",
      body: "每个信号模块的亮线就是固定端口。你的任务不是转动它，而是让它随着整条轨道环移到能和邻居对接的位置。",
      bullets: Object.freeze(["亮线碰到边界或没有对端，是未接通的错误。", "完成时全部九个模块连成一棵没有闭环的编队。"]),
      svg: tutorialSvg(TUTORIAL_INITIAL, { stage: "elements", annotation: "固定教程关 · 当前端口并未全部对接" }),
    }),
    Object.freeze({
      tag: "02 · 环移整列",
      title: "把左侧整列向上环移一次",
      body: "这张图由同一题面实际执行“第 1 列向上”得到。离开顶部的模块会从底部回到队列，端口方向始终不变。",
      bullets: Object.freeze(["一次操作移动整列三枚模块，不是旋转其中一枚。", "黄色虚线标出这次真正受影响的列。"]),
      svg: tutorialSvg(TUTORIAL_AFTER_ACTION, { stage: "action", focus: { axis: "column", index: 0, direction: -1 }, annotation: "真实动作：shiftColumn(index: 0, direction: -1)" }),
    }),
    Object.freeze({
      tag: "03 · 全网合流",
      title: "让所有端口恰好对接",
      body: "接着把中间行向左环移，固定教程关就会形成一棵完整连通网。所有端口相接、没有越界信号，也没有闭环才算调度完成。",
      bullets: Object.freeze(["本图由第二次真实环移后重新计算连通性与边数。", "首次通关、提高效率与达到建议步数会计入 4.0 图鉴。"]),
      svg: tutorialSvg(TUTORIAL_COMPLETE, { stage: "complete", focus: { axis: "row", index: 1, direction: -1 }, annotation: "真实完成：shiftRow(index: 1, direction: -1) · 9 模块、8 条连接" }),
    }),
  ]);
}
