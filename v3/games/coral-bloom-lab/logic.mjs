const SAFE_ID = /^(?!__proto__$|prototype$|constructor$)[a-z0-9][a-z0-9-]{2,63}$/;
const MAX_DIGIT = 9;

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function integer(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function cellCount(level) {
  return level.width * level.height;
}

export function pointFor(level, cell) {
  if (!integer(cell, 0, cellCount(level) - 1)) return null;
  return Object.freeze({ x: cell % level.width, y: Math.floor(cell / level.width) });
}

export function cellFor(level, x, y) {
  if (!integer(x, 0, level.width - 1) || !integer(y, 0, level.height - 1)) return -1;
  return y * level.width + x;
}

export function neighbours(level, cell) {
  const point = pointFor(level, cell);
  if (!point) return Object.freeze([]);
  const output = [];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const target = cellFor(level, point.x + dx, point.y + dy);
    if (target >= 0) output.push(target);
  }
  return Object.freeze(output);
}

export function givenValue(level, cell) {
  return level.givenByCell?.[cell] ?? 0;
}

export function isGiven(level, cell) {
  return givenValue(level, cell) > 0;
}

export function validateLevel(source) {
  const errors = [];
  if (!plainObject(source)) return ["level must be a plain object"];
  if (!SAFE_ID.test(source.id ?? "")) errors.push("invalid level id");
  if (!integer(source.width, 4, 5) || !integer(source.height, 4, 5)) errors.push("board must be 4x4 or 5x5");
  const total = integer(source.width, 4, 5) && integer(source.height, 4, 5) ? source.width * source.height : 0;
  if (!["easy", "medium", "hard"].includes(source.difficulty)) errors.push("invalid difficulty");
  if (!integer(source.tier, 1, 3)) errors.push("invalid tier");
  if (!integer(source.seed, 0, 0x7fffffff)) errors.push("invalid seed");
  if (!integer(source.par, 1, total || 25)) errors.push("invalid reference move count");
  if (!Array.isArray(source.givens) || !source.givens.length) {
    errors.push("at least one coral nucleus is required");
  } else {
    const cells = new Set();
    for (const pair of source.givens) {
      if (!Array.isArray(pair) || pair.length !== 2 || !integer(pair[0], 0, total - 1) || !integer(pair[1], 1, MAX_DIGIT)) {
        errors.push("invalid nucleus");
        continue;
      }
      if (cells.has(pair[0])) errors.push("duplicate nucleus cell");
      cells.add(pair[0]);
    }
  }
  if (source.solution !== undefined) {
    if (!Array.isArray(source.solution) || source.solution.length !== total || source.solution.some((value) => !integer(value, 1, MAX_DIGIT))) {
      errors.push("invalid reference solution");
    } else {
      for (const [cell, value] of source.givens ?? []) if (source.solution[cell] !== value) errors.push("solution changes a nucleus");
    }
  }
  return Object.freeze([...new Set(errors)]);
}

export function defineLevel(source) {
  const level = {
    ...source,
    givens: Object.freeze((source.givens ?? []).map((pair) => Object.freeze([...pair]))),
    solution: source.solution ? Object.freeze([...source.solution]) : undefined,
  };
  const errors = validateLevel(level);
  if (errors.length) throw new TypeError(`Invalid Filling level ${source?.id ?? "unknown"}: ${errors.join(", ")}`);
  const givenByCell = Object.freeze(Array.from({ length: cellCount(level) }, (_, cell) => {
    const pair = level.givens.find(([index]) => index === cell);
    return pair?.[1] ?? 0;
  }));
  return Object.freeze({ ...level, givenByCell });
}

function freezeState(state) {
  return Object.freeze({
    values: Object.freeze([...state.values]),
    notes: Object.freeze([...state.notes]),
    moves: state.moves,
  });
}

export function createState(level) {
  const values = Array.from({ length: cellCount(level) }, (_, cell) => givenValue(level, cell));
  return freezeState({ values, notes: Array(cellCount(level)).fill(0), moves: 0 });
}

export function restoreState(level, source) {
  if (!plainObject(source) || !Array.isArray(source.values) || !Array.isArray(source.notes)
      || source.values.length !== cellCount(level) || source.notes.length !== cellCount(level)
      || !integer(source.moves, 0, 1_000_000)) return createState(level);
  const values = [...source.values];
  const notes = [...source.notes];
  for (let cell = 0; cell < values.length; cell += 1) {
    if (!integer(values[cell], 0, MAX_DIGIT) || !integer(notes[cell], 0, (1 << MAX_DIGIT) - 1)) return createState(level);
    const clue = givenValue(level, cell);
    if (clue && values[cell] !== clue) return createState(level);
    if (values[cell]) notes[cell] = 0;
  }
  return freezeState({ values, notes, moves: source.moves });
}

export function serializeState(state) {
  return { values: [...state.values], notes: [...state.notes], moves: state.moves };
}

function componentAt(level, values, start, seen) {
  const value = values[start];
  const cells = [];
  const queue = [start];
  seen[start] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    cells.push(cell);
    for (const next of neighbours(level, cell)) {
      if (!seen[next] && values[next] === value) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  const reachable = new Set(cells);
  const frontier = [...cells];
  for (let cursor = 0; cursor < frontier.length; cursor += 1) {
    for (const next of neighbours(level, frontier[cursor])) {
      if (!reachable.has(next) && (values[next] === 0 || values[next] === value)) {
        reachable.add(next);
        frontier.push(next);
      }
    }
  }
  return Object.freeze({ value, cells: Object.freeze(cells), size: cells.length, capacity: reachable.size });
}

/** The formal Filling predicate; candidate notes are deliberately absent. */
export function evaluateState(level, state) {
  const values = state?.values;
  if (!Array.isArray(values) || values.length !== cellCount(level)) {
    return Object.freeze({ complete: false, valid: false, remaining: cellCount(level), errors: Object.freeze(["invalid-state"]), components: Object.freeze([]) });
  }
  const seen = new Uint8Array(values.length);
  const components = [];
  const errors = [];
  for (let cell = 0; cell < values.length; cell += 1) {
    if (!integer(values[cell], 0, MAX_DIGIT)) {
      errors.push({ type: "invalid-value", cells: Object.freeze([cell]), value: values[cell] });
      continue;
    }
    if (givenValue(level, cell) && values[cell] !== givenValue(level, cell)) {
      errors.push({ type: "changed-nucleus", cells: Object.freeze([cell]), value: values[cell] });
    }
    if (!values[cell] || seen[cell]) continue;
    const component = componentAt(level, values, cell, seen);
    components.push(component);
    if (component.size > component.value) errors.push({ type: "overflow", cells: component.cells, value: component.value });
    if (component.capacity < component.value) errors.push({ type: "trapped", cells: component.cells, value: component.value });
  }
  const remaining = values.filter((value) => value === 0).length;
  const exact = components.every((component) => component.size === component.value);
  return Object.freeze({
    complete: remaining === 0 && !errors.length && exact,
    valid: !errors.length,
    remaining,
    errors: Object.freeze(errors.map((error) => Object.freeze({ ...error, cells: Object.freeze([...error.cells]) }))),
    components: Object.freeze(components),
  });
}

export function setValue(level, state, cell, value) {
  if (!integer(cell, 0, cellCount(level) - 1) || !integer(value, 0, MAX_DIGIT) || isGiven(level, cell)) {
    return Object.freeze({ changed: false, state });
  }
  if (state.values[cell] === value) return Object.freeze({ changed: false, state });
  const values = [...state.values];
  const notes = [...state.notes];
  values[cell] = value;
  notes[cell] = 0;
  return Object.freeze({ changed: true, state: freezeState({ values, notes, moves: state.moves + 1 }) });
}

export function toggleCandidate(level, state, cell, value) {
  if (!integer(cell, 0, cellCount(level) - 1) || !integer(value, 1, MAX_DIGIT) || isGiven(level, cell) || state.values[cell] !== 0) {
    return Object.freeze({ changed: false, state });
  }
  const values = [...state.values];
  const notes = [...state.notes];
  notes[cell] ^= 1 << (value - 1);
  return Object.freeze({ changed: true, state: freezeState({ values, notes, moves: state.moves }) });
}

function legalTimelineAction(level, action) {
  return plainObject(action) && Object.keys(action).length === 3 && action.type === "fill"
    && integer(action.cell, 0, cellCount(level) - 1) && integer(action.value, 0, MAX_DIGIT);
}

export function normalizeTimeline(level, source) {
  if (!Array.isArray(source) || source.length > 4096) return null;
  const output = [];
  for (const action of source) {
    if (!legalTimelineAction(level, action)) return null;
    output.push(Object.freeze({ type: "fill", cell: action.cell, value: action.value }));
  }
  return Object.freeze(output);
}

export function replayTimeline(level, source) {
  const timeline = normalizeTimeline(level, source);
  if (!timeline) return null;
  let state = createState(level);
  for (const action of timeline) {
    const result = setValue(level, state, action.cell, action.value);
    if (!result.changed) return null;
    state = result.state;
  }
  return Object.freeze({ timeline, state, evaluation: evaluateState(level, state) });
}

/**
 * Deliberately independent backtracking oracle. It reads only clue cells and
 * the public dimensions; `level.solution` is never consulted.
 */
export function solveLevel(level, { limit = 2 } = {}) {
  const errors = validateLevel(level);
  const maximum = integer(limit, 1, 16) ? limit : 2;
  if (errors.length) return Object.freeze({ count: 0, solutions: Object.freeze([]), truncated: false, errors });
  const values = Array.from({ length: cellCount(level) }, (_, cell) => givenValue(level, cell));
  const solutions = [];
  let truncated = false;
  function viable() {
    return evaluateState(level, { values }).valid;
  }
  function visit() {
    if (solutions.length >= maximum) { truncated = true; return; }
    let bestCell = -1;
    let bestDomain = null;
    for (let cell = 0; cell < values.length; cell += 1) {
      if (values[cell] !== 0) continue;
      const domain = [];
      for (let value = 1; value <= MAX_DIGIT; value += 1) {
        values[cell] = value;
        if (viable()) domain.push(value);
        values[cell] = 0;
      }
      if (!domain.length) return;
      if (!bestDomain || domain.length < bestDomain.length) {
        bestCell = cell;
        bestDomain = domain;
        if (domain.length === 1) break;
      }
    }
    if (bestCell < 0) {
      const evaluation = evaluateState(level, { values });
      if (evaluation.complete) solutions.push(Object.freeze([...values]));
      return;
    }
    for (const value of bestDomain) {
      values[bestCell] = value;
      visit();
      values[bestCell] = 0;
      if (solutions.length >= maximum) return;
    }
  }
  if (viable()) visit();
  return Object.freeze({ count: solutions.length, solutions: Object.freeze(solutions), truncated, errors: Object.freeze([]) });
}
