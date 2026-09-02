/** Balance Terrace preserves Unequal/Futoshiki: a 4×4 Latin square plus the
 * declared greater-than / less-than relations.  It deliberately has no
 * hidden given values or extra adjacency rule. */
export const SIZE = 4;

const rawLevel = {
  id: "terrace-equilibrium-04",
  solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
  relations: [
    { id: "r1", a: 1, b: 5, sign: "<" },
    { id: "r2", a: 7, b: 11, sign: "<" },
    { id: "r3", a: 1, b: 2, sign: "<" },
    { id: "r4", a: 14, b: 15, sign: ">" },
    { id: "r5", a: 8, b: 9, sign: ">" },
    { id: "r6", a: 6, b: 10, sign: "<" },
    { id: "r7", a: 2, b: 3, sign: "<" },
    { id: "r8", a: 12, b: 13, sign: ">" },
    { id: "r9", a: 4, b: 8, sign: ">" },
    { id: "r10", a: 0, b: 4, sign: "<" },
  ],
};

export const LEVEL = Object.freeze({
  id: rawLevel.id,
  solution: Object.freeze([...rawLevel.solution]),
  relations: Object.freeze(rawLevel.relations.map((relation) => Object.freeze({ ...relation }))),
});

const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
const copy = (values) => [...values];
function freezeState({ values, moves, history }) { return Object.freeze({ values: Object.freeze(copy(values)), moves, history: Object.freeze(history.map((entry) => Object.freeze({ values: Object.freeze(copy(entry.values)), moves: entry.moves }))) }); }

export function createState() { return freezeState({ values: Array(SIZE * SIZE).fill(0), moves: 0, history: [] }); }

function normalHistory(source) {
  if (!Array.isArray(source)) return [];
  return source.slice(-96).flatMap((entry) => entry && Array.isArray(entry.values) && entry.values.length === SIZE * SIZE && integer(entry.moves, 0, 1_000_000) && entry.values.every((value) => integer(value, 0, SIZE)) ? [{ values: copy(entry.values), moves: entry.moves }] : []);
}

export function normalizeState(source) {
  if (!source || typeof source !== "object" || !Array.isArray(source.values) || source.values.length !== SIZE * SIZE || !integer(source.moves, 0, 1_000_000) || source.values.some((value) => !integer(value, 0, SIZE))) return null;
  return freezeState({ values: source.values, moves: source.moves, history: normalHistory(source.history) });
}

export function positionOf(cell) { return integer(cell, 0, SIZE * SIZE - 1) ? Object.freeze({ row: Math.floor(cell / SIZE), column: cell % SIZE }) : null; }
export function relationSatisfied(relation, values) { return values[relation.a] > 0 && values[relation.b] > 0 && (relation.sign === ">" ? values[relation.a] > values[relation.b] : values[relation.a] < values[relation.b]); }
// a is the upper cell and b the lower cell: the narrow tip always points to
// the smaller value, so top < bottom is ∧ and top > bottom is ∨.
export function verticalGlyph(relation) { return relation.sign === "<" ? "∧" : "∨"; }

function duplicates(cells, values) {
  const grouped = new Map();
  for (const cell of cells) { const value = values[cell]; if (!value) continue; const matches = grouped.get(value) ?? []; matches.push(cell); grouped.set(value, matches); }
  return [...grouped.values()].filter((group) => group.length > 1).flat();
}

export function evaluate(level, state) {
  const errors = [];
  for (let row = 0; row < SIZE; row += 1) { const conflict = duplicates(Array.from({ length: SIZE }, (_, column) => row * SIZE + column), state.values); if (conflict.length) errors.push({ type: "row", cells: conflict }); }
  for (let column = 0; column < SIZE; column += 1) { const conflict = duplicates(Array.from({ length: SIZE }, (_, row) => row * SIZE + column), state.values); if (conflict.length) errors.push({ type: "column", cells: conflict }); }
  for (const relation of level.relations) if (state.values[relation.a] && state.values[relation.b] && !relationSatisfied(relation, state.values)) errors.push({ type: "relation", relation: relation.id, cells: [relation.a, relation.b] });
  const filled = state.values.every(Boolean);
  return Object.freeze({ filled, errors: Object.freeze(errors.map((entry) => Object.freeze({ ...entry, cells: Object.freeze([...entry.cells]) }))), invalidCells: Object.freeze([...new Set(errors.flatMap((entry) => entry.cells))]), complete: filled && errors.length === 0 });
}

export function isComplete(state) { return evaluate(LEVEL, state).complete; }
export function setCell(state, cell, value) { if (!integer(cell, 0, SIZE * SIZE - 1) || !integer(value, 0, SIZE) || state.values[cell] === value) return state; const values = copy(state.values); values[cell] = value; return freezeState({ values, moves: state.moves + 1, history: [...state.history, { values: state.values, moves: state.moves }].slice(-96) }); }
export function undo(state) { const previous = state.history.at(-1); return previous ? freezeState({ values: previous.values, moves: previous.moves, history: state.history.slice(0, -1) }) : state; }

function choices(values, cell) { const { row, column } = positionOf(cell); const used = new Set(); for (let i = 0; i < SIZE; i += 1) { used.add(values[row * SIZE + i]); used.add(values[i * SIZE + column]); } return Array.from({ length: SIZE }, (_, i) => i + 1).filter((value) => !used.has(value)); }

/** Independent bounded Latin-plus-relation search; it never reads solution. */
export function countSolutions(level = LEVEL, limit = 2) {
  const values = Array(SIZE * SIZE).fill(0); let found = 0;
  function search() {
    if (found >= limit) return;
    let target = -1; let options = null;
    for (let cell = 0; cell < values.length; cell += 1) { if (values[cell]) continue; const next = choices(values, cell); if (!next.length) return; if (!options || next.length < options.length) { target = cell; options = next; } }
    if (target < 0) { if (evaluate(level, { values }).complete) found += 1; return; }
    for (const value of options) { values[target] = value; const relationOkay = level.relations.every((relation) => !values[relation.a] || !values[relation.b] || relationSatisfied(relation, values)); if (relationOkay) search(); values[target] = 0; }
  }
  search(); return found;
}

export function stateFromValues(values, moves = 0) { return normalizeState({ values, moves, history: [] }); }
export const TUTORIAL = Object.freeze({ levelId: LEVEL.id, action: Object.freeze({ type: "fill", cell: 0, value: 1, id: "fill:0:1" }), initial: createState(), actionState: setCell(createState(), 0, 1), solved: stateFromValues(LEVEL.solution, 16) });

const svgEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

/** A self-contained, replayable Unequal tutorial image from the actual state. */
export function tutorialSvg(state, stage) {
  const clean = normalizeState(state);
  if (!clean) throw new TypeError("Terrace tutorial requires a real Futoshiki state.");
  const label = ({ elements: "真实初始阶庭", action: "一次合法安放", complete: "真实平衡阶庭" })[stage] ?? "阶庭状态";
  const cells = clean.values.map((value, cell) => { const point = positionOf(cell); const x = 44 + point.column * 54; const y = 60 + point.row * 54; const active = stage === "action" && cell === TUTORIAL.action.cell; return `<g data-cell="${cell}" data-value="${value}"><rect x="${x}" y="${y}" width="54" height="54" rx="7" fill="${active ? "#5c7b40" : "#2f4528"}" stroke="${active ? "#fff0a5" : "#8fb378"}" stroke-width="${active ? 3 : 1}"/><text x="${x + 27}" y="${y + 35}" text-anchor="middle" fill="#f6fae9" font-family="Georgia,serif" font-size="26" font-weight="700">${value || "·"}</text></g>`; }).join("");
  const marks = LEVEL.relations.map((relation) => { const a = positionOf(relation.a); const b = positionOf(relation.b); const horizontal = a.row === b.row; const x = horizontal ? 44 + (Math.min(a.column, b.column) + 1) * 54 : 44 + a.column * 54 + 27; const y = horizontal ? 60 + a.row * 54 + 27 : 60 + (Math.min(a.row, b.row) + 1) * 54; const glyph = horizontal ? relation.sign : verticalGlyph(relation); return `<g data-relation="${relation.id}" data-a="${relation.a}" data-b="${relation.b}" data-sign="${relation.sign}"><circle cx="${x}" cy="${y}" r="11" fill="#1b2917" stroke="#d9f2a6"/><text x="${x}" y="${y + 7}" text-anchor="middle" fill="#fff3bd" font-family="Georgia,serif" font-size="18" font-weight="700">${svgEscape(glyph)}</text></g>`; }).join("");
  const actionData = stage === "action" ? ' data-action="fill:0:1"' : ""; const completeData = stage === "complete" ? ` data-complete="true" data-solution="${LEVEL.solution.join(",")}"` : ""; const seal = stage === "complete" ? '<circle cx="438" cy="102" r="25" fill="#d9f2a6"/><path d="m427 102 8 8 16-19" fill="none" stroke="#253d1d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' : ""; const annotation = stage === "elements" ? "十道显示的高低刻印" : stage === "action" ? "真实操作：fill:0:1" : "行、列、刻印全部成立";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 320" preserveAspectRatio="xMidYMid meet" role="img" aria-label="天平阶梯庭${svgEscape(label)}" data-tutorial-game="balance-terrace" data-stage="${svgEscape(stage)}" data-level-id="${LEVEL.id}" data-board="${clean.values.join(",")}"${actionData}${completeData}><rect width="540" height="320" rx="22" fill="#111d12"/><text x="32" y="33" fill="#b7df82" font-family="ui-monospace,monospace" font-size="13" font-weight="800">BALANCE TERRACE · ${svgEscape(label)}</text>${cells}${marks}${seal}<text x="292" y="96" fill="#f1f9e6" font-family="ui-sans-serif,system-ui" font-size="22" font-weight="700">${svgEscape(stage === "complete" ? "阶庭平衡" : stage === "action" ? "安放一阶石" : "读取高低刻印")}</text><text x="292" y="132" fill="#c8dfb8" font-family="ui-sans-serif,system-ui" font-size="15">${svgEscape(annotation)}</text><text x="292" y="162" fill="#c8dfb8" font-family="ui-sans-serif,system-ui" font-size="14">每行、每列都要拥有 1、2、3、4。</text><text x="292" y="190" fill="#c8dfb8" font-family="ui-sans-serif,system-ui" font-size="14">尖端朝较小值，开口朝较大值。</text><rect x="292" y="224" width="204" height="50" rx="11" fill="#b7df8219" stroke="#b7df8255"/><text x="308" y="254" fill="#d8f5a7" font-family="ui-sans-serif,system-ui" font-size="13">${svgEscape(stage === "complete" ? "✓ 规则引擎已验证通关" : "固定教程关 · 可由规则复算")}</text></svg>`;
}
