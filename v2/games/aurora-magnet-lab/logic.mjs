/**
 * Aurora Magnet Lab — pure Magnets rules.
 *
 * This module intentionally has no DOM, storage, audio, timer, or random side
 * effects. Candidate notes and manually dimmed clues never enter evaluation.
 */

export const POLARITY = Object.freeze({
  PLUS: "+",
  MINUS: "-",
  NEUTRAL: "0",
});

export const SLOT_STATE = Object.freeze({
  EMPTY: "empty",
  FORWARD: "forward",
  REVERSE: "reverse",
  NEUTRAL: "neutral",
});

export const ASSIGNED_STATES = Object.freeze([
  SLOT_STATE.FORWARD,
  SLOT_STATE.REVERSE,
  SLOT_STATE.NEUTRAL,
]);

export const SOLUTION_CODE = Object.freeze({
  F: SLOT_STATE.FORWARD,
  R: SLOT_STATE.REVERSE,
  N: SLOT_STATE.NEUTRAL,
});

export const STATE_CODE = Object.freeze({
  [SLOT_STATE.FORWARD]: "F",
  [SLOT_STATE.REVERSE]: "R",
  [SLOT_STATE.NEUTRAL]: "N",
});

export const ORTHOGONAL_STEPS = Object.freeze([
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([1, 0]),
  Object.freeze([0, -1]),
]);

export function keyOf(row, column) {
  return `${row}:${column}`;
}

export function pointFromKey(key) {
  const match = /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(String(key));
  if (!match) return null;
  return { row: Number(match[1]), column: Number(match[2]) };
}

function freezePoint(point) {
  return Object.freeze({ row: point.row, column: point.column, key: keyOf(point.row, point.column) });
}

function parseLayout(rowsInput) {
  if (!Array.isArray(rowsInput) || rowsInput.length === 0) {
    throw new TypeError("Puzzle layout must be a non-empty array.");
  }
  const rows = rowsInput.map((row) => String(row));
  const width = rows[0].length;
  if (width === 0 || rows.some((row) => row.length !== width)) {
    throw new TypeError("Puzzle layout rows must share one non-zero width.");
  }
  if (rows.some((row) => /[^A-Z0-9*]/.test(row))) {
    throw new TypeError("Layout cells must be slot labels A-Z/0-9 or one '*' fixed void.");
  }

  const occurrences = new Map();
  const holes = [];
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const label = rows[row][column];
      const point = freezePoint({ row, column });
      if (label === "*") holes.push(point);
      else {
        if (!occurrences.has(label)) occurrences.set(label, []);
        occurrences.get(label).push(point);
      }
    }
  }

  const expectedHoles = (width * rows.length) % 2;
  if (holes.length !== expectedHoles) {
    throw new TypeError(`This board requires exactly ${expectedHoles} fixed void cell(s).`);
  }

  const slots = [];
  const cellSlots = new Map();
  for (const [id, points] of occurrences) {
    if (points.length !== 2) throw new TypeError(`Slot ${id} must occupy exactly two cells.`);
    const distance = Math.abs(points[0].row - points[1].row) + Math.abs(points[0].column - points[1].column);
    if (distance !== 1) throw new TypeError(`Slot ${id} cells must be orthogonally adjacent.`);
    const orientation = points[0].row === points[1].row ? "horizontal" : "vertical";
    const slot = Object.freeze({ id, index: slots.length, orientation, cells: Object.freeze(points) });
    slots.push(slot);
    points.forEach((point, end) => cellSlots.set(point.key, Object.freeze({ slotId: id, end })));
  }
  if (slots.length === 0) throw new TypeError("Puzzle must contain at least one domino slot.");

  return {
    rows: Object.freeze(rows),
    width,
    height: rows.length,
    slots: Object.freeze(slots),
    cellSlots,
    holes: Object.freeze(holes),
  };
}

export function polarityForState(state, end) {
  if (end !== 0 && end !== 1) throw new RangeError("A domino end must be 0 or 1.");
  if (state === SLOT_STATE.FORWARD) return end === 0 ? POLARITY.PLUS : POLARITY.MINUS;
  if (state === SLOT_STATE.REVERSE) return end === 0 ? POLARITY.MINUS : POLARITY.PLUS;
  if (state === SLOT_STATE.NEUTRAL) return POLARITY.NEUTRAL;
  if (state === SLOT_STATE.EMPTY || state === undefined || state === null) return null;
  throw new TypeError(`Unknown slot state: ${state}`);
}

function solutionStatesFromDefinition(layout, solution) {
  if (solution === undefined) return undefined;
  const codes = typeof solution === "string" ? [...solution] : Array.isArray(solution) ? solution : null;
  if (!codes || codes.length !== layout.slots.length) {
    throw new TypeError("Declared solution must provide one F/R/N code per slot.");
  }
  const states = new Map();
  codes.forEach((code, index) => {
    const state = SOLUTION_CODE[code] ?? (ASSIGNED_STATES.includes(code) ? code : null);
    if (!state) throw new TypeError("Declared solution may contain only F, R, or N.");
    states.set(layout.slots[index].id, state);
  });
  return states;
}

function emptyCountGrid(width, height) {
  return {
    rows: {
      plus: Array(height).fill(0),
      minus: Array(height).fill(0),
    },
    columns: {
      plus: Array(width).fill(0),
      minus: Array(width).fill(0),
    },
  };
}

function countsForStates(layout, states) {
  const counts = emptyCountGrid(layout.width, layout.height);
  for (const slot of layout.slots) {
    const state = states.get(slot.id);
    if (!ASSIGNED_STATES.includes(state)) continue;
    slot.cells.forEach((cell, end) => {
      const polarity = polarityForState(state, end);
      if (polarity === POLARITY.PLUS) {
        counts.rows.plus[cell.row] += 1;
        counts.columns.plus[cell.column] += 1;
      } else if (polarity === POLARITY.MINUS) {
        counts.rows.minus[cell.row] += 1;
        counts.columns.minus[cell.column] += 1;
      }
    });
  }
  return counts;
}

function normalizeMask(mask, length, label) {
  if (mask === undefined) return Array(length).fill(true);
  const values = typeof mask === "string" ? [...mask] : Array.isArray(mask) ? [...mask] : null;
  if (!values || values.length !== length) throw new TypeError(`${label} clue mask must have length ${length}.`);
  return values.map((value) => {
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0") return false;
    throw new TypeError(`${label} clue mask may contain only true/false or 1/0.`);
  });
}

function cluesFromSolution(layout, solutionStates, mask = {}) {
  const counts = countsForStates(layout, solutionStates);
  const rowPlus = normalizeMask(mask.rows?.plus, layout.height, "Row +");
  const rowMinus = normalizeMask(mask.rows?.minus, layout.height, "Row -");
  const columnPlus = normalizeMask(mask.columns?.plus, layout.width, "Column +");
  const columnMinus = normalizeMask(mask.columns?.minus, layout.width, "Column -");
  return {
    rows: {
      plus: counts.rows.plus.map((value, index) => (rowPlus[index] ? value : null)),
      minus: counts.rows.minus.map((value, index) => (rowMinus[index] ? value : null)),
    },
    columns: {
      plus: counts.columns.plus.map((value, index) => (columnPlus[index] ? value : null)),
      minus: counts.columns.minus.map((value, index) => (columnMinus[index] ? value : null)),
    },
  };
}

function cloneClueLine(values, length, maximums, label) {
  if (!Array.isArray(values) || values.length !== length) {
    throw new TypeError(`${label} clues must contain ${length} values.`);
  }
  return Object.freeze(values.map((value, index) => {
    if (value === null) return null;
    if (!Number.isInteger(value) || value < 0 || value > maximums[index]) {
      throw new TypeError(`${label} clue ${index + 1} is outside its line capacity.`);
    }
    return value;
  }));
}

function normalizeClues(layout, clues) {
  if (!clues?.rows || !clues?.columns) throw new TypeError("Puzzle must include row and column polarity clues.");
  const rowCapacity = Array.from({ length: layout.height }, (_, row) => (
    layout.width - layout.holes.filter((hole) => hole.row === row).length
  ));
  const columnCapacity = Array.from({ length: layout.width }, (_, column) => (
    layout.height - layout.holes.filter((hole) => hole.column === column).length
  ));
  return Object.freeze({
    rows: Object.freeze({
      plus: cloneClueLine(clues.rows.plus, layout.height, rowCapacity, "Row +"),
      minus: cloneClueLine(clues.rows.minus, layout.height, rowCapacity, "Row -"),
    }),
    columns: Object.freeze({
      plus: cloneClueLine(clues.columns.plus, layout.width, columnCapacity, "Column +"),
      minus: cloneClueLine(clues.columns.minus, layout.width, columnCapacity, "Column -"),
    }),
  });
}

function cloneSolutionMap(states) {
  return states ? new Map(states) : undefined;
}

export function createPuzzle(definition) {
  if (!definition || typeof definition !== "object") throw new TypeError("Puzzle definition is required.");
  const layout = parseLayout(definition.layout);
  const solutionStates = solutionStatesFromDefinition(layout, definition.solution);
  const derivedClues = definition.clues ?? (solutionStates
    ? cluesFromSolution(layout, solutionStates, definition.clueMask)
    : null);
  const clues = normalizeClues(layout, derivedClues);
  const puzzle = {
    id: String(definition.id ?? "puzzle"),
    seed: String(definition.seed ?? definition.id ?? "puzzle"),
    difficulty: String(definition.difficulty ?? "custom"),
    title: String(definition.title ?? "未命名实验"),
    subtitle: String(definition.subtitle ?? "固定双格槽位"),
    note: String(definition.note ?? ""),
    spectrum: String(definition.spectrum ?? "unknown"),
    storm: Boolean(definition.storm),
    suggestedMoves: Number.isInteger(definition.suggestedMoves) && definition.suggestedMoves > 0
      ? definition.suggestedMoves
      : layout.slots.length,
    ...layout,
    clues,
    solution: cloneSolutionMap(solutionStates),
  };

  if (solutionStates) {
    const evaluation = evaluatePosition(puzzle, { states: solutionStates });
    if (!evaluation.complete) throw new TypeError("Declared solution does not satisfy its generated clues and adjacency rules.");
  }
  return Object.freeze(puzzle);
}

export function cellAt(puzzle, row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
  if (row < 0 || column < 0 || row >= puzzle.height || column >= puzzle.width) return null;
  const label = puzzle.rows[row][column];
  return label === "*" ? Object.freeze({ type: "void", row, column, key: keyOf(row, column) }) : Object.freeze({
    type: "slot",
    row,
    column,
    key: keyOf(row, column),
    label,
    ...puzzle.cellSlots.get(keyOf(row, column)),
  });
}

export function slotForCell(puzzle, keyOrRow, maybeColumn) {
  const key = typeof keyOrRow === "string" ? keyOrRow : keyOf(keyOrRow, maybeColumn);
  const reference = puzzle.cellSlots.get(key);
  if (!reference) return null;
  return puzzle.slots.find((slot) => slot.id === reference.slotId) ?? null;
}

function toStateMap(value) {
  if (value instanceof Map) return new Map(value);
  if (Array.isArray(value)) return new Map(value);
  if (value && typeof value === "object") return new Map(Object.entries(value));
  return new Map();
}

function toNoteSet(value) {
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

export function normalizePosition(puzzle, position = {}) {
  const knownSlots = new Set(puzzle.slots.map((slot) => slot.id));
  const states = new Map();
  for (const [slotId, state] of toStateMap(position.states)) {
    if (knownSlots.has(slotId) && ASSIGNED_STATES.includes(state)) states.set(slotId, state);
  }
  const notes = new Set([...toNoteSet(position.notes)].filter((slotId) => (
    knownSlots.has(slotId) && !states.has(slotId)
  )));
  return { states, notes };
}

export function positionToJSON(position = {}) {
  return {
    states: Object.fromEntries([...toStateMap(position.states)].sort(([left], [right]) => left.localeCompare(right))),
    notes: [...toNoteSet(position.notes)].sort(),
  };
}

export function solutionPosition(puzzle) {
  return { states: cloneSolutionMap(puzzle.solution) ?? new Map(), notes: new Set() };
}

export function polaritiesForPosition(puzzle, position = {}) {
  const { states } = normalizePosition(puzzle, position);
  const cells = new Map();
  for (const slot of puzzle.slots) {
    const state = states.get(slot.id);
    slot.cells.forEach((cell, end) => cells.set(cell.key, polarityForState(state, end)));
  }
  for (const hole of puzzle.holes) cells.set(hole.key, POLARITY.NEUTRAL);
  return cells;
}

function lineRemainingPotential(puzzle, states, axis, index) {
  let count = 0;
  for (const slot of puzzle.slots) {
    if (states.has(slot.id)) continue;
    if (slot.cells.some((cell) => cell[axis] === index)) count += 1;
  }
  return count;
}

function evaluateClueLine(puzzle, states, values, clues, axis) {
  return clues.map((target, index) => {
    const count = values[index];
    const remaining = lineRemainingPotential(puzzle, states, axis, index);
    const given = target !== null;
    const atTarget = given && count === target;
    const over = given && count > target;
    const impossible = given && (over || count + remaining < target);
    return Object.freeze({
      given,
      target,
      count,
      remaining,
      minimum: count,
      maximum: count + remaining,
      atTarget,
      exact: atTarget && remaining === 0,
      over,
      impossible,
    });
  });
}

export function evaluatePosition(puzzle, position = {}) {
  const { states, notes } = normalizePosition(puzzle, position);
  const polarities = polaritiesForPosition(puzzle, { states });
  const counts = countsForStates(puzzle, states);
  const conflictPairs = [];
  const conflictKeys = new Set();

  for (let row = 0; row < puzzle.height; row += 1) {
    for (let column = 0; column < puzzle.width; column += 1) {
      const key = keyOf(row, column);
      const polarity = polarities.get(key);
      if (polarity !== POLARITY.PLUS && polarity !== POLARITY.MINUS) continue;
      for (const [rowStep, columnStep] of [[0, 1], [1, 0]]) {
        const otherKey = keyOf(row + rowStep, column + columnStep);
        if (polarities.get(otherKey) !== polarity) continue;
        const pair = Object.freeze({ polarity, keys: Object.freeze([key, otherKey]) });
        conflictPairs.push(pair);
        conflictKeys.add(key);
        conflictKeys.add(otherKey);
      }
    }
  }

  const clueResults = Object.freeze({
    rows: Object.freeze({
      plus: Object.freeze(evaluateClueLine(puzzle, states, counts.rows.plus, puzzle.clues.rows.plus, "row")),
      minus: Object.freeze(evaluateClueLine(puzzle, states, counts.rows.minus, puzzle.clues.rows.minus, "row")),
    }),
    columns: Object.freeze({
      plus: Object.freeze(evaluateClueLine(puzzle, states, counts.columns.plus, puzzle.clues.columns.plus, "column")),
      minus: Object.freeze(evaluateClueLine(puzzle, states, counts.columns.minus, puzzle.clues.columns.minus, "column")),
    }),
  });
  const flatClues = [
    ...clueResults.rows.plus,
    ...clueResults.rows.minus,
    ...clueResults.columns.plus,
    ...clueResults.columns.minus,
  ];
  const assignedCount = states.size;
  const allAssigned = assignedCount === puzzle.slots.length;
  const cluesSatisfied = flatClues.every((clue) => !clue.given || clue.count === clue.target);
  const complete = allAssigned && conflictPairs.length === 0 && cluesSatisfied;

  return {
    states,
    notes,
    polarities,
    counts,
    clueResults,
    conflictPairs: Object.freeze(conflictPairs),
    conflictKeys,
    assignedCount,
    slotCount: puzzle.slots.length,
    allAssigned,
    cluesSatisfied,
    overClueCount: flatClues.filter((clue) => clue.over).length,
    impossibleClueCount: flatClues.filter((clue) => clue.impossible).length,
    exactGivenClueCount: flatClues.filter((clue) => clue.given && clue.exact).length,
    givenClueCount: flatClues.filter((clue) => clue.given).length,
    complete,
  };
}

function copyPosition(position) {
  return { states: new Map(position.states), notes: new Set(position.notes) };
}

function resolveMoveTarget(puzzle, move) {
  if (typeof move.slotId === "string") {
    const slot = puzzle.slots.find((item) => item.id === move.slotId);
    return slot ? { slot, end: move.end === 1 ? 1 : 0 } : null;
  }
  const key = typeof move.key === "string" ? move.key : keyOf(move.row, move.column);
  const reference = puzzle.cellSlots.get(key);
  if (!reference) return null;
  return {
    slot: puzzle.slots.find((item) => item.id === reference.slotId),
    end: reference.end,
  };
}

export function applyMove(puzzle, position = {}, move = {}) {
  const normalized = normalizePosition(puzzle, position);
  const next = copyPosition(normalized);
  const target = resolveMoveTarget(puzzle, move);
  if (!target) return { accepted: false, reason: "not-a-slot", ...next };
  const { slot, end } = target;
  const current = next.states.get(slot.id) ?? SLOT_STATE.EMPTY;

  if (move.type === "cycle-primary") {
    if (current === SLOT_STATE.NEUTRAL) return { accepted: false, reason: "neutral-locked", ...next };
    const desired = end === 0 ? SLOT_STATE.FORWARD : SLOT_STATE.REVERSE;
    const opposite = desired === SLOT_STATE.FORWARD ? SLOT_STATE.REVERSE : SLOT_STATE.FORWARD;
    let following;
    if (current === SLOT_STATE.EMPTY) following = desired;
    else if (current === desired) following = opposite;
    else following = SLOT_STATE.EMPTY;
    if (following === SLOT_STATE.EMPTY) next.states.delete(slot.id);
    else next.states.set(slot.id, following);
    next.notes.delete(slot.id);
    return { accepted: true, effect: `primary-${following}`, slotId: slot.id, ...next };
  }

  if (move.type === "cycle-secondary") {
    if (current === SLOT_STATE.FORWARD || current === SLOT_STATE.REVERSE) {
      return { accepted: false, reason: "magnet-locked", ...next };
    }
    if (current === SLOT_STATE.EMPTY && !next.notes.has(slot.id)) {
      next.states.set(slot.id, SLOT_STATE.NEUTRAL);
      return { accepted: true, effect: "secondary-neutral", slotId: slot.id, ...next };
    }
    if (current === SLOT_STATE.NEUTRAL) {
      next.states.delete(slot.id);
      next.notes.add(slot.id);
      return { accepted: true, effect: "secondary-note", slotId: slot.id, ...next };
    }
    next.notes.delete(slot.id);
    return { accepted: true, effect: "secondary-clear", slotId: slot.id, ...next };
  }

  if (move.type === "set-state") {
    const state = move.state ?? SLOT_STATE.EMPTY;
    if (state !== SLOT_STATE.EMPTY && !ASSIGNED_STATES.includes(state)) {
      return { accepted: false, reason: "unknown-state", ...next };
    }
    const currentNote = next.notes.has(slot.id);
    if (current === state && !currentNote) return { accepted: false, reason: "unchanged", ...next };
    if (state === SLOT_STATE.EMPTY) next.states.delete(slot.id);
    else next.states.set(slot.id, state);
    next.notes.delete(slot.id);
    return { accepted: true, effect: `set-${state}`, slotId: slot.id, ...next };
  }

  if (move.type === "toggle-note") {
    if (current !== SLOT_STATE.EMPTY) return { accepted: false, reason: "occupied", ...next };
    if (next.notes.has(slot.id)) next.notes.delete(slot.id);
    else next.notes.add(slot.id);
    return { accepted: true, effect: "note-changed", slotId: slot.id, ...next };
  }

  if (move.type === "clear-slot") {
    const changed = next.states.delete(slot.id) || next.notes.delete(slot.id);
    return changed
      ? { accepted: true, effect: "slot-cleared", slotId: slot.id, ...next }
      : { accepted: false, reason: "unchanged", ...next };
  }

  return { accepted: false, reason: "unknown-move", ...next };
}

function contributionForOption(slot, state, width, height) {
  const contribution = emptyCountGrid(width, height);
  const cells = [];
  slot.cells.forEach((cell, end) => {
    const polarity = polarityForState(state, end);
    cells.push({ ...cell, polarity });
    if (polarity === POLARITY.PLUS) {
      contribution.rows.plus[cell.row] += 1;
      contribution.columns.plus[cell.column] += 1;
    } else if (polarity === POLARITY.MINUS) {
      contribution.rows.minus[cell.row] += 1;
      contribution.columns.minus[cell.column] += 1;
    }
  });
  return { state, cells, contribution };
}

function clueChannels(puzzle, counts) {
  return [
    { values: counts.rows.plus, clues: puzzle.clues.rows.plus },
    { values: counts.rows.minus, clues: puzzle.clues.rows.minus },
    { values: counts.columns.plus, clues: puzzle.clues.columns.plus },
    { values: counts.columns.minus, clues: puzzle.clues.columns.minus },
  ];
}

function addCounts(target, source, multiplier) {
  for (const group of ["rows", "columns"]) {
    for (const polarity of ["plus", "minus"]) {
      for (let index = 0; index < target[group][polarity].length; index += 1) {
        target[group][polarity][index] += source[group][polarity][index] * multiplier;
      }
    }
  }
}

function maximumContribution(options, width, height) {
  const maximum = emptyCountGrid(width, height);
  for (const group of ["rows", "columns"]) {
    for (const polarity of ["plus", "minus"]) {
      for (let index = 0; index < maximum[group][polarity].length; index += 1) {
        maximum[group][polarity][index] = Math.max(
          ...options.map((option) => option.contribution[group][polarity][index]),
        );
      }
    }
  }
  return maximum;
}

export function solvePuzzle(puzzle, options = {}) {
  const limit = options.limit ?? Infinity;
  if (limit !== Infinity && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError("Solver limit must be a non-negative integer or Infinity.");
  }
  if (limit === 0) return { solutions: [], count: 0, truncated: true, unique: false };

  const fixed = normalizePosition(puzzle, options.position).states;
  const data = puzzle.slots.map((slot) => {
    const domain = fixed.has(slot.id) ? [fixed.get(slot.id)] : ASSIGNED_STATES;
    const optionsForSlot = domain.map((state) => contributionForOption(slot, state, puzzle.width, puzzle.height));
    const clueWeight = slot.cells.reduce((weight, cell) => (
      weight
      + Number(puzzle.clues.rows.plus[cell.row] !== null)
      + Number(puzzle.clues.rows.minus[cell.row] !== null)
      + Number(puzzle.clues.columns.plus[cell.column] !== null)
      + Number(puzzle.clues.columns.minus[cell.column] !== null)
    ), 0);
    const neighbourWeight = slot.cells.reduce((weight, cell) => weight + ORTHOGONAL_STEPS.filter(([dr, dc]) => {
      const neighbour = puzzle.cellSlots.get(keyOf(cell.row + dr, cell.column + dc));
      return neighbour && neighbour.slotId !== slot.id;
    }).length, 0);
    return {
      slot,
      options: optionsForSlot,
      maximum: maximumContribution(optionsForSlot, puzzle.width, puzzle.height),
      weight: clueWeight * 4 + neighbourWeight + Number(fixed.has(slot.id)) * 100,
    };
  }).sort((left, right) => right.weight - left.weight || left.slot.index - right.slot.index);

  const counts = emptyCountGrid(puzzle.width, puzzle.height);
  const remaining = emptyCountGrid(puzzle.width, puzzle.height);
  data.forEach((item) => addCounts(remaining, item.maximum, 1));
  const assignedCells = new Map();
  const assignedStates = new Map();
  const solutions = [];
  let truncated = false;

  function clueBoundsAllow() {
    const currentChannels = clueChannels(puzzle, counts);
    const remainingChannels = clueChannels(puzzle, remaining);
    return currentChannels.every((channel, channelIndex) => channel.clues.every((target, index) => (
      target === null
      || (channel.values[index] <= target
        && channel.values[index] + remainingChannels[channelIndex].values[index] >= target)
    )));
  }

  function optionTouchesSamePole(option) {
    for (const cell of option.cells) {
      if (cell.polarity === POLARITY.NEUTRAL) continue;
      for (const [rowStep, columnStep] of ORTHOGONAL_STEPS) {
        if (assignedCells.get(keyOf(cell.row + rowStep, cell.column + columnStep)) === cell.polarity) return true;
      }
    }
    return false;
  }

  function search(depth) {
    if (solutions.length >= limit) {
      truncated = true;
      return;
    }
    if (depth === data.length) {
      if (!clueBoundsAllow()) return;
      const canonical = new Map(puzzle.slots.map((slot) => [slot.id, assignedStates.get(slot.id)]));
      solutions.push({ states: canonical, notes: new Set() });
      return;
    }

    const item = data[depth];
    addCounts(remaining, item.maximum, -1);
    for (const option of item.options) {
      if (optionTouchesSamePole(option)) continue;
      assignedStates.set(item.slot.id, option.state);
      option.cells.forEach((cell) => assignedCells.set(cell.key, cell.polarity));
      addCounts(counts, option.contribution, 1);
      if (clueBoundsAllow()) search(depth + 1);
      addCounts(counts, option.contribution, -1);
      option.cells.forEach((cell) => assignedCells.delete(cell.key));
      assignedStates.delete(item.slot.id);
      if (truncated) break;
    }
    addCounts(remaining, item.maximum, 1);
  }

  search(0);
  return {
    solutions,
    count: solutions.length,
    truncated,
    unique: solutions.length === 1 && !truncated,
  };
}

export function countSolutions(puzzle, limit = Infinity, position = {}) {
  return solvePuzzle(puzzle, { limit, position }).count;
}

export function statesToSolutionCode(puzzle, position) {
  const { states } = normalizePosition(puzzle, position);
  return puzzle.slots.map((slot) => STATE_CODE[states.get(slot.id)] ?? ".").join("");
}
