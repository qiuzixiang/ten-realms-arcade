/**
 * Quantum Apothecary is a fixed 4×4 Keen (KenKen) board.  The exported
 * evaluator never reads LEVEL.solution: the solution only documents the
 * independently checked tutorial and regression fixture.
 */
export const SIZE = 4;

const rawLevel = {
  id: "quantum-catalyst-04",
  solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
  cages: [
    { id: "a", cells: [0, 1], op: "+", target: 3 },
    { id: "b", cells: [2, 3], op: "+", target: 7 },
    { id: "c", cells: [4, 5], op: "+", target: 7 },
    { id: "d", cells: [6, 7], op: "+", target: 3 },
    { id: "e", cells: [8, 12], op: "+", target: 6 },
    { id: "f", cells: [9, 10], op: "*", target: 4 },
    { id: "g", cells: [11, 15], op: "/", target: 3 },
    { id: "h", cells: [13, 14], op: "-", target: 1 },
  ],
};

function freezeLevel(source) {
  return Object.freeze({
    id: source.id,
    solution: Object.freeze([...source.solution]),
    cages: Object.freeze(source.cages.map((cage) => Object.freeze({ ...cage, cells: Object.freeze([...cage.cells]) }))),
  });
}

export const LEVEL = freezeLevel(rawLevel);

const isInteger = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const cloneValues = (values) => [...values];

function freezeState({ values, moves, history }) {
  return Object.freeze({
    values: Object.freeze(cloneValues(values)),
    moves,
    history: Object.freeze(history.map((entry) => Object.freeze({ values: Object.freeze(cloneValues(entry.values)), moves: entry.moves }))),
  });
}

export function createState() {
  return freezeState({ values: Array(SIZE * SIZE).fill(0), moves: 0, history: [] });
}

function normalHistory(source) {
  if (!Array.isArray(source)) return [];
  const entries = [];
  for (const entry of source.slice(-96)) {
    if (!entry || !Array.isArray(entry.values) || entry.values.length !== SIZE * SIZE || !isInteger(entry.moves, 0, 1_000_000)) continue;
    if (entry.values.some((value) => !isInteger(value, 0, SIZE))) continue;
    entries.push({ values: cloneValues(entry.values), moves: entry.moves });
  }
  return entries;
}

/** Validates saved state instead of trusting saved completion flags. */
export function normalizeState(source) {
  if (!source || typeof source !== "object" || !Array.isArray(source.values) || source.values.length !== SIZE * SIZE) return null;
  if (!isInteger(source.moves, 0, 1_000_000) || source.values.some((value) => !isInteger(value, 0, SIZE))) return null;
  return freezeState({ values: source.values, moves: source.moves, history: normalHistory(source.history) });
}

export function cellAt(row, column) {
  return row * SIZE + column;
}

export function positionOf(cell) {
  if (!isInteger(cell, 0, SIZE * SIZE - 1)) return null;
  return Object.freeze({ row: Math.floor(cell / SIZE), column: cell % SIZE });
}

export function cageFor(level, cell) {
  return level.cages.find((cage) => cage.cells.includes(cell)) ?? null;
}

export function cageLabel(cage) {
  if (!cage) return "";
  return `${cage.target}${({ "+": "+", "*": "×", "-": "−", "/": "÷" })[cage.op] ?? ""}`;
}

function operationValue(op, values) {
  if (op === "+") return values.reduce((sum, value) => sum + value, 0);
  if (op === "*") return values.reduce((product, value) => product * value, 1);
  if (op === "-") return Math.abs(values[0] - values[1]);
  if (op === "/") return Math.max(...values) / Math.min(...values);
  return NaN;
}

export function cageSatisfied(cage, boardValues) {
  const values = cage.cells.map((cell) => boardValues[cell]);
  return values.every((value) => value > 0) && operationValue(cage.op, values) === cage.target;
}

/** A partial cage must still be able to reach its declared arithmetic target. */
export function cagePossible(cage, boardValues) {
  const values = cage.cells.map((cell) => boardValues[cell]);
  const filled = values.filter(Boolean);
  if (filled.length === values.length) return cageSatisfied(cage, boardValues);
  if (cage.op === "+") {
    const sum = filled.reduce((total, value) => total + value, 0);
    const blanks = values.length - filled.length;
    return sum < cage.target && sum + blanks * SIZE >= cage.target;
  }
  if (cage.op === "*") {
    const product = filled.reduce((total, value) => total * value, 1);
    return product <= cage.target && cage.target % product === 0;
  }
  return true;
}

function duplicateCells(cells, values) {
  const byValue = new Map();
  for (const cell of cells) {
    const value = values[cell];
    if (!value) continue;
    const matches = byValue.get(value) ?? [];
    matches.push(cell);
    byValue.set(value, matches);
  }
  return [...byValue.values()].filter((matches) => matches.length > 1).flat();
}

/**
 * Reports every rule break; incomplete-but-consistent boards remain playable
 * and are deliberately not treated as wins.
 */
export function evaluate(level, state) {
  const values = state.values;
  const errors = [];
  for (let row = 0; row < SIZE; row += 1) {
    const cells = Array.from({ length: SIZE }, (_, column) => cellAt(row, column));
    const conflict = duplicateCells(cells, values);
    if (conflict.length) errors.push({ type: "row", cells: conflict });
  }
  for (let column = 0; column < SIZE; column += 1) {
    const cells = Array.from({ length: SIZE }, (_, row) => cellAt(row, column));
    const conflict = duplicateCells(cells, values);
    if (conflict.length) errors.push({ type: "column", cells: conflict });
  }
  for (const cage of level.cages) {
    if (!cagePossible(cage, values)) errors.push({ type: "cage", cage: cage.id, cells: [...cage.cells] });
  }
  const filled = values.every((value) => value > 0);
  return Object.freeze({
    filled,
    errors: Object.freeze(errors.map((error) => Object.freeze({ ...error, cells: Object.freeze([...error.cells]) }))),
    invalidCells: Object.freeze([...new Set(errors.flatMap((error) => error.cells))]),
    complete: filled && errors.length === 0,
  });
}

export function isComplete(state) {
  return evaluate(LEVEL, state).complete;
}

export function setCell(state, cell, value) {
  if (!isInteger(cell, 0, SIZE * SIZE - 1) || !isInteger(value, 0, SIZE) || state.values[cell] === value) return state;
  const history = [...state.history, { values: state.values, moves: state.moves }].slice(-96);
  const values = cloneValues(state.values);
  values[cell] = value;
  return freezeState({ values, moves: state.moves + 1, history });
}

export function undo(state) {
  const entry = state.history.at(-1);
  if (!entry) return state;
  return freezeState({ values: entry.values, moves: entry.moves, history: state.history.slice(0, -1) });
}

function candidates(level, values, cell) {
  const { row, column } = positionOf(cell);
  const used = new Set();
  for (let index = 0; index < SIZE; index += 1) {
    used.add(values[cellAt(row, index)]);
    used.add(values[cellAt(index, column)]);
  }
  return Array.from({ length: SIZE }, (_, offset) => offset + 1).filter((value) => !used.has(value));
}

/** Independent bounded backtracker used only for test/fixture verification. */
export function countSolutions(level = LEVEL, limit = 2) {
  const values = Array(SIZE * SIZE).fill(0);
  let found = 0;
  function search() {
    if (found >= limit) return;
    let target = -1;
    let options = null;
    for (let cell = 0; cell < values.length; cell += 1) {
      if (values[cell]) continue;
      const next = candidates(level, values, cell);
      if (!next.length) return;
      if (!options || next.length < options.length) { target = cell; options = next; }
    }
    if (target < 0) { if (evaluate(level, { values }).complete) found += 1; return; }
    for (const value of options) {
      values[target] = value;
      if (level.cages.every((cage) => cagePossible(cage, values))) search();
      values[target] = 0;
    }
  }
  search();
  return found;
}

export function stateFromValues(values, moves = 0) {
  return normalizeState({ values, moves, history: [] });
}

export const TUTORIAL = Object.freeze({
  levelId: LEVEL.id,
  action: Object.freeze({ type: "fill", cell: 0, value: 1, id: "fill:0:1" }),
  initial: createState(),
  actionState: setCell(createState(), 0, 1),
  solved: stateFromValues(LEVEL.solution, 15),
});

const svgEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

/** Self-contained tutorial art, generated from a validated rule state. */
export function tutorialSvg(state, stage) {
  const clean = normalizeState(state);
  if (!clean) throw new TypeError("Quantum tutorial art requires a real board state.");
  const label = ({ elements: "真实初始配方", action: "一次合法投放", complete: "真实反应完成" })[stage] ?? "配方状态";
  const cells = clean.values.map((value, cell) => {
    const { row, column } = positionOf(cell);
    const x = 42 + column * 54; const y = 60 + row * 54;
    const active = stage === "action" && cell === TUTORIAL.action.cell;
    return `<g data-cell="${cell}" data-value="${value}"><rect x="${x}" y="${y}" width="54" height="54" fill="${active ? "#2f668d" : "#10263c"}" stroke="${active ? "#fff0ad" : "#6e9cc0"}" stroke-width="${active ? 3 : 1}"/><text x="${x + 27}" y="${y + 35}" text-anchor="middle" fill="#f5fbff" font-family="Georgia,serif" font-size="26" font-weight="700">${value || "·"}</text></g>`;
  }).join("");
  const cages = LEVEL.cages.map((cage) => {
    const points = cage.cells.map(positionOf); const minRow = Math.min(...points.map((point) => point.row)); const maxRow = Math.max(...points.map((point) => point.row)); const minColumn = Math.min(...points.map((point) => point.column)); const maxColumn = Math.max(...points.map((point) => point.column));
    const x = 42 + minColumn * 54 + 2; const y = 60 + minRow * 54 + 2;
    return `<g data-cage="${cage.id}" data-target="${cage.target}" data-op="${cage.op}"><rect x="${x}" y="${y}" width="${(maxColumn - minColumn + 1) * 54 - 4}" height="${(maxRow - minRow + 1) * 54 - 4}" rx="6" fill="none" stroke="#bfe5ff" stroke-width="2.5"/><text x="${x + 4}" y="${y + 14}" fill="#d6eeff" font-family="ui-monospace,monospace" font-size="10" font-weight="800">${svgEscape(cageLabel(cage))}</text></g>`;
  }).join("");
  const annotation = stage === "elements" ? "粗边反应笼 + 行列不重" : stage === "action" ? "真实操作：fill:0:1" : "所有行列和反应笼均成立";
  const action = stage === "action" ? '<path d="M43 45v-18" stroke="#fff0ad" stroke-width="3"/><path d="m36 34 7-7 7 7" fill="none" stroke="#fff0ad" stroke-width="3"/>' : "";
  const verified = stage === "complete" ? '<circle cx="434" cy="103" r="25" fill="#c9edff"/><path d="m423 103 8 8 15-18" fill="none" stroke="#14354c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' : "";
  const actionData = stage === "action" ? ' data-action="fill:0:1"' : "";
  const completeData = stage === "complete" ? ` data-complete="true" data-solution="${LEVEL.solution.join(",")}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 320" preserveAspectRatio="xMidYMid meet" role="img" aria-label="量子配方馆${svgEscape(label)}" data-tutorial-game="quantum-apothecary" data-stage="${svgEscape(stage)}" data-level-id="${LEVEL.id}" data-board="${clean.values.join(",")}"${actionData}${completeData}><rect width="540" height="320" rx="22" fill="#081522"/><text x="32" y="33" fill="#a9d5ff" font-family="ui-monospace,monospace" font-size="13" font-weight="800">QUANTUM APOTHECARY · ${svgEscape(label)}</text>${cells}${cages}${action}${verified}<text x="290" y="96" fill="#e8f5ff" font-family="ui-sans-serif,system-ui" font-size="22" font-weight="700">${svgEscape(stage === "complete" ? "反应完成" : stage === "action" ? "投放一枚粒子" : "读取反应笼")}</text><text x="290" y="132" fill="#c0d9ed" font-family="ui-sans-serif,system-ui" font-size="15">${svgEscape(annotation)}</text><text x="290" y="162" fill="#c0d9ed" font-family="ui-sans-serif,system-ui" font-size="14">每行、每列都要拥有 1、2、3、4。</text><text x="290" y="190" fill="#c0d9ed" font-family="ui-sans-serif,system-ui" font-size="14">加、乘、减、除标签必须同时满足。</text><rect x="290" y="224" width="204" height="50" rx="11" fill="#a9d5ff16" stroke="#a9d5ff55"/><text x="306" y="254" fill="#bfe5ff" font-family="ui-sans-serif,system-ui" font-size="13">${svgEscape(stage === "complete" ? "✓ 规则引擎已验证通关" : "固定教程关 · 可由规则复算")}</text></svg>`;
}
