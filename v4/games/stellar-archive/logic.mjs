/** Star Archive keeps Solo's standard 4×4 Sudoku contract: rows, columns
 * and 2×2 regions must each contain 1–4 exactly once. */
export const SIZE = 4;
export const REGION_WIDTH = 2;
export const REGION_HEIGHT = 2;

const rawLevel = {
  id: "catalogue-orion-04",
  solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
  givens: [[0, 1], [3, 4], [5, 4], [10, 4], [13, 3], [14, 2]],
};

export const LEVEL = Object.freeze({
  id: rawLevel.id,
  solution: Object.freeze([...rawLevel.solution]),
  givens: Object.freeze(rawLevel.givens.map(([cell, value]) => Object.freeze([cell, value]))),
});

const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
const copy = (values) => [...values];

function freezeState({ values, moves, history }) {
  return Object.freeze({
    values: Object.freeze(copy(values)),
    moves,
    history: Object.freeze(history.map((item) => Object.freeze({ values: Object.freeze(copy(item.values)), moves: item.moves }))),
  });
}

export function regionFor(cell) {
  if (!integer(cell, 0, SIZE * SIZE - 1)) return -1;
  const row = Math.floor(cell / SIZE);
  const column = cell % SIZE;
  return Math.floor(row / REGION_HEIGHT) * (SIZE / REGION_WIDTH) + Math.floor(column / REGION_WIDTH);
}

export function cellsForRegion(region) {
  if (!integer(region, 0, 3)) return Object.freeze([]);
  const startRow = Math.floor(region / 2) * REGION_HEIGHT;
  const startColumn = (region % 2) * REGION_WIDTH;
  return Object.freeze(Array.from({ length: REGION_WIDTH * REGION_HEIGHT }, (_, index) => {
    const row = startRow + Math.floor(index / REGION_WIDTH);
    const column = startColumn + index % REGION_WIDTH;
    return row * SIZE + column;
  }));
}

export function givenAt(level, cell) {
  return level.givens.find(([index]) => index === cell)?.[1] ?? 0;
}

export function createState() {
  return freezeState({ values: Array.from({ length: SIZE * SIZE }, (_, cell) => givenAt(LEVEL, cell)), moves: 0, history: [] });
}

function validHistory(source) {
  if (!Array.isArray(source)) return [];
  const output = [];
  for (const entry of source.slice(-96)) {
    if (!entry || !Array.isArray(entry.values) || entry.values.length !== SIZE * SIZE || !integer(entry.moves, 0, 1_000_000)) continue;
    if (entry.values.some((value) => !integer(value, 0, SIZE))) continue;
    if (entry.values.some((value, cell) => givenAt(LEVEL, cell) && givenAt(LEVEL, cell) !== value)) continue;
    output.push({ values: copy(entry.values), moves: entry.moves });
  }
  return output;
}

export function normalizeState(source) {
  if (!source || typeof source !== "object" || !Array.isArray(source.values) || source.values.length !== SIZE * SIZE) return null;
  if (!integer(source.moves, 0, 1_000_000) || source.values.some((value) => !integer(value, 0, SIZE))) return null;
  if (source.values.some((value, cell) => givenAt(LEVEL, cell) && givenAt(LEVEL, cell) !== value)) return null;
  return freezeState({ values: source.values, moves: source.moves, history: validHistory(source.history) });
}

function duplicateCells(cells, values) {
  const grouped = new Map();
  for (const cell of cells) {
    const value = values[cell];
    if (!value) continue;
    const matches = grouped.get(value) ?? [];
    matches.push(cell); grouped.set(value, matches);
  }
  return [...grouped.values()].filter((matches) => matches.length > 1).flat();
}

export function evaluate(level, state) {
  const errors = [];
  for (let row = 0; row < SIZE; row += 1) {
    const cells = Array.from({ length: SIZE }, (_, column) => row * SIZE + column);
    const conflict = duplicateCells(cells, state.values);
    if (conflict.length) errors.push({ type: "row", cells: conflict });
  }
  for (let column = 0; column < SIZE; column += 1) {
    const cells = Array.from({ length: SIZE }, (_, row) => row * SIZE + column);
    const conflict = duplicateCells(cells, state.values);
    if (conflict.length) errors.push({ type: "column", cells: conflict });
  }
  for (let region = 0; region < 4; region += 1) {
    const conflict = duplicateCells(cellsForRegion(region), state.values);
    if (conflict.length) errors.push({ type: "region", region, cells: conflict });
  }
  const filled = state.values.every(Boolean);
  return Object.freeze({
    filled,
    errors: Object.freeze(errors.map((entry) => Object.freeze({ ...entry, cells: Object.freeze([...entry.cells]) }))),
    invalidCells: Object.freeze([...new Set(errors.flatMap((entry) => entry.cells))]),
    complete: filled && errors.length === 0,
  });
}

export function isComplete(state) { return evaluate(LEVEL, state).complete; }

export function setCell(state, cell, value) {
  if (!integer(cell, 0, SIZE * SIZE - 1) || !integer(value, 0, SIZE) || givenAt(LEVEL, cell) || state.values[cell] === value) return state;
  const values = copy(state.values); values[cell] = value;
  const history = [...state.history, { values: state.values, moves: state.moves }].slice(-96);
  return freezeState({ values, moves: state.moves + 1, history });
}

export function undo(state) {
  const previous = state.history.at(-1);
  return previous ? freezeState({ values: previous.values, moves: previous.moves, history: state.history.slice(0, -1) }) : state;
}

function choices(level, values, cell) {
  const row = Math.floor(cell / SIZE); const column = cell % SIZE;
  const used = new Set();
  for (let index = 0; index < SIZE; index += 1) { used.add(values[row * SIZE + index]); used.add(values[index * SIZE + column]); }
  for (const peer of cellsForRegion(regionFor(cell))) used.add(values[peer]);
  return Array.from({ length: SIZE }, (_, index) => index + 1).filter((value) => !used.has(value));
}

/** Does not reference level.solution; used to prove this archived board is unique. */
export function countSolutions(level = LEVEL, limit = 2) {
  const values = Array.from({ length: SIZE * SIZE }, (_, cell) => givenAt(level, cell));
  let found = 0;
  function search() {
    if (found >= limit) return;
    let target = -1; let options = null;
    for (let cell = 0; cell < values.length; cell += 1) {
      if (values[cell]) continue;
      const next = choices(level, values, cell);
      if (!next.length) return;
      if (!options || next.length < options.length) { target = cell; options = next; }
    }
    if (target < 0) { if (evaluate(level, { values }).complete) found += 1; return; }
    for (const value of options) { values[target] = value; search(); values[target] = 0; }
  }
  search(); return found;
}

export function stateFromValues(values, moves = 0) { return normalizeState({ values, moves, history: [] }); }

export const TUTORIAL = Object.freeze({
  levelId: LEVEL.id,
  action: Object.freeze({ type: "fill", cell: 1, value: 2, id: "fill:1:2" }),
  initial: createState(),
  actionState: setCell(createState(), 1, 2),
  solved: stateFromValues(LEVEL.solution, 10),
});

const svgEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

/** A self-contained image made from actual Solo state, givens and regions. */
export function tutorialSvg(state, stage) {
  const clean = normalizeState(state);
  if (!clean) throw new TypeError("Star archive tutorial requires a real Sudoku state.");
  const label = ({ elements: "真实初始星图", action: "一次合法归档", complete: "真实封存星图" })[stage] ?? "星图状态";
  const cells = clean.values.map((value, cell) => {
    const row = Math.floor(cell / SIZE); const column = cell % SIZE; const x = 44 + column * 54; const y = 60 + row * 54; const given = givenAt(LEVEL, cell); const active = stage === "action" && cell === TUTORIAL.action.cell;
    return `<g data-cell="${cell}" data-value="${value}" data-given="${Boolean(given)}"><rect x="${x}" y="${y}" width="54" height="54" fill="${given ? "#6a4030" : active ? "#754537" : "#2b1b22"}" stroke="${active ? "#fff0a5" : "#9b7066"}" stroke-width="${active ? 3 : 1}"/><text x="${x + 27}" y="${y + 35}" text-anchor="middle" fill="#fff4df" font-family="Georgia,serif" font-size="26" font-weight="700">${value || "·"}</text>${given ? `<text x="${x + 42}" y="${y + 14}" fill="#ffe5a5" font-size="10">◆</text>` : ""}</g>`;
  }).join("");
  const regions = Array.from({ length: 4 }, (_, region) => { const cells = cellsForRegion(region); const row = Math.floor(cells[0] / SIZE); const column = cells[0] % SIZE; return `<rect data-region="${region}" x="${45 + column * 54}" y="${61 + row * 54}" width="106" height="106" rx="6" fill="none" stroke="#ffd6b5" stroke-width="3"/>`; }).join("");
  const actionData = stage === "action" ? ' data-action="fill:1:2"' : ""; const completeData = stage === "complete" ? ` data-complete="true" data-solution="${LEVEL.solution.join(",")}"` : "";
  const seal = stage === "complete" ? '<circle cx="438" cy="102" r="25" fill="#ffccaa"/><path d="m427 102 8 8 16-19" fill="none" stroke="#4b2a22" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' : "";
  const annotation = stage === "elements" ? "馆藏星号与四个 2×2 星区" : stage === "action" ? "真实操作：fill:1:2" : "行、列、星区全部无重";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 320" preserveAspectRatio="xMidYMid meet" role="img" aria-label="星图档案院${svgEscape(label)}" data-tutorial-game="stellar-archive" data-stage="${svgEscape(stage)}" data-level-id="${LEVEL.id}" data-board="${clean.values.join(",")}"${actionData}${completeData}><rect width="540" height="320" rx="22" fill="#1b1117"/><text x="32" y="33" fill="#f2ab82" font-family="ui-monospace,monospace" font-size="13" font-weight="800">STELLAR ARCHIVE · ${svgEscape(label)}</text>${cells}${regions}${seal}<text x="292" y="96" fill="#fff0e6" font-family="ui-sans-serif,system-ui" font-size="22" font-weight="700">${svgEscape(stage === "complete" ? "星图封存" : stage === "action" ? "归档二号星标" : "三重索引")}</text><text x="292" y="132" fill="#e3c3b4" font-family="ui-sans-serif,system-ui" font-size="15">${svgEscape(annotation)}</text><text x="292" y="162" fill="#e3c3b4" font-family="ui-sans-serif,system-ui" font-size="14">每行、每列各有 1、2、3、4。</text><text x="292" y="190" fill="#e3c3b4" font-family="ui-sans-serif,system-ui" font-size="14">每个粗线 2×2 星区也各有一次。</text><rect x="292" y="224" width="204" height="50" rx="11" fill="#f2ab8219" stroke="#f2ab8255"/><text x="308" y="254" fill="#ffd6ba" font-family="ui-sans-serif,system-ui" font-size="13">${svgEscape(stage === "complete" ? "✓ 规则引擎已验证通关" : "固定教程关 · 可由规则复算")}</text></svg>`;
}
