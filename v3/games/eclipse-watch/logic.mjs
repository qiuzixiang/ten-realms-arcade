const SAFE_ID = /^(?!__proto__$|prototype$|constructor$)[a-z0-9][a-z0-9-]{2,63}$/;
export const UNKNOWN = -1;
export const WHITE_MARK = 0;
export const BLACK = 1;

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function integer(value, minimum, maximum) { return Number.isInteger(value) && value >= minimum && value <= maximum; }

export function cellCount(level) { return level.width * level.height; }
export function pointFor(level, cell) {
  if (!integer(cell, 0, cellCount(level) - 1)) return null;
  return Object.freeze({ x: cell % level.width, y: Math.floor(cell / level.width) });
}
export function cellFor(level, x, y) {
  return integer(x, 0, level.width - 1) && integer(y, 0, level.height - 1) ? y * level.width + x : -1;
}
export function neighbours(level, cell) {
  const point = pointFor(level, cell);
  if (!point) return Object.freeze([]);
  return Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => cellFor(level, point.x + dx, point.y + dy)).filter((next) => next >= 0));
}

export function clueValue(level, cell) { return level.clueByCell?.[cell] ?? 0; }
export function isClue(level, cell) { return clueValue(level, cell) > 0; }

export function validateLevel(source) {
  const errors = [];
  if (!plainObject(source)) return Object.freeze(["level must be a plain object"]);
  if (!SAFE_ID.test(source.id ?? "")) errors.push("invalid level id");
  if (!integer(source.width, 5, 6) || !integer(source.height, 5, 6)) errors.push("board must be 5x5 or 6x6");
  const total = integer(source.width, 5, 6) && integer(source.height, 5, 6) ? source.width * source.height : 0;
  if (!["easy", "medium", "hard"].includes(source.difficulty)) errors.push("invalid difficulty");
  if (!integer(source.tier, 1, 3) || !integer(source.seed, 0, 0x7fffffff)) errors.push("invalid tier or seed");
  if (!integer(source.par, 1, total)) errors.push("invalid reference action count");
  if (!Array.isArray(source.clues) || source.clues.length < 3) errors.push("at least three light readings are required");
  else {
    const seen = new Set();
    for (const clue of source.clues) {
      if (!Array.isArray(clue) || clue.length !== 2 || !integer(clue[0], 0, total - 1) || !integer(clue[1], 2, total)) {
        errors.push("invalid light reading"); continue;
      }
      if (seen.has(clue[0])) errors.push("duplicate light reading");
      seen.add(clue[0]);
    }
  }
  if (source.solution !== undefined) {
    if (!Array.isArray(source.solution) || source.solution.length !== total || source.solution.some((value) => value !== WHITE_MARK && value !== BLACK)) errors.push("invalid reference solution");
    else for (const [cell] of source.clues ?? []) if (source.solution[cell] !== WHITE_MARK) errors.push("a clue square cannot be black");
  }
  return Object.freeze([...new Set(errors)]);
}

export function defineLevel(source) {
  const level = { ...source, clues: Object.freeze((source.clues ?? []).map((item) => Object.freeze([...item]))), solution: source.solution ? Object.freeze([...source.solution]) : undefined };
  const errors = validateLevel(level);
  if (errors.length) throw new TypeError(`Invalid Range level ${source?.id ?? "unknown"}: ${errors.join(", ")}`);
  const clueByCell = Object.freeze(Array.from({ length: cellCount(level) }, (_, cell) => level.clues.find(([index]) => index === cell)?.[1] ?? 0));
  return Object.freeze({ ...level, clueByCell });
}

function freezeState(state) { return Object.freeze({ marks: Object.freeze([...state.marks]), moves: state.moves }); }
export function createState(level) { return freezeState({ marks: Array.from({ length: cellCount(level) }, (_, cell) => isClue(level, cell) ? WHITE_MARK : UNKNOWN), moves: 0 }); }
export function serializeState(state) { return { marks: [...state.marks], moves: state.moves }; }
export function restoreState(level, source) {
  if (!plainObject(source) || !Array.isArray(source.marks) || source.marks.length !== cellCount(level) || !integer(source.moves, 0, 1_000_000)) return createState(level);
  const marks = [...source.marks];
  for (let cell = 0; cell < marks.length; cell += 1) {
    if (![UNKNOWN, WHITE_MARK, BLACK].includes(marks[cell]) || (isClue(level, cell) && marks[cell] !== WHITE_MARK)) return createState(level);
  }
  if (marks.filter((mark) => mark === BLACK).length > source.moves) return createState(level);
  return freezeState({ marks, moves: source.moves });
}

function ray(level, marks, start, dx, dy, stopAtUnknown = false) {
  const point = pointFor(level, start);
  const cells = [];
  let x = point.x + dx;
  let y = point.y + dy;
  while (x >= 0 && x < level.width && y >= 0 && y < level.height) {
    const cell = cellFor(level, x, y);
    if (marks[cell] === BLACK || (stopAtUnknown && marks[cell] === UNKNOWN)) break;
    cells.push(cell);
    x += dx; y += dy;
  }
  return cells;
}

/** Visible white cells including the clue itself, stopping at actual black cells. */
export function beamForClue(level, state, cell) {
  if (!isClue(level, cell) || !Array.isArray(state?.marks)) return Object.freeze({ target: clueValue(level, cell), count: 0, cells: Object.freeze([]) });
  const cells = [cell];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) cells.push(...ray(level, state.marks, cell, dx, dy));
  return Object.freeze({ target: clueValue(level, cell), count: cells.length, cells: Object.freeze(cells) });
}

function whiteComponents(level, marks) {
  const seen = new Uint8Array(marks.length);
  const groups = [];
  for (let cell = 0; cell < marks.length; cell += 1) {
    if (marks[cell] === BLACK || seen[cell]) continue;
    const cells = [cell]; seen[cell] = 1;
    for (let cursor = 0; cursor < cells.length; cursor += 1) {
      for (const next of neighbours(level, cells[cursor])) if (!seen[next] && marks[next] !== BLACK) { seen[next] = 1; cells.push(next); }
    }
    groups.push(Object.freeze(cells));
  }
  return Object.freeze(groups);
}

/**
 * Exact Range predicate. White marks are presentation notes: they remain
 * traversable like UNKNOWN and never change a beam, so they cannot create a
 * win that the underlying black placement did not already create.
 */
export function evaluateState(level, state) {
  const marks = state?.marks;
  if (!Array.isArray(marks) || marks.length !== cellCount(level)) return Object.freeze({ complete: false, valid: false, errors: Object.freeze(["invalid-state"]), readings: Object.freeze([]), whiteMarks: 0, unknown: 0 });
  const errors = [];
  const black = [];
  const whiteMarks = marks.reduce((count, mark, cell) => count + (mark === WHITE_MARK && !isClue(level, cell) ? 1 : 0), 0);
  for (let cell = 0; cell < marks.length; cell += 1) {
    if (![UNKNOWN, WHITE_MARK, BLACK].includes(marks[cell])) errors.push({ type: "invalid-mark", cells: Object.freeze([cell]) });
    if (isClue(level, cell) && marks[cell] !== WHITE_MARK) errors.push({ type: "clue-not-white", cells: Object.freeze([cell]) });
    if (marks[cell] !== BLACK) continue;
    black.push(cell);
    const adjacent = neighbours(level, cell).filter((next) => marks[next] === BLACK);
    if (adjacent.length) errors.push({ type: "adjacent-black", cells: Object.freeze([cell, ...adjacent]) });
  }
  const readings = level.clues.map(([cell, target]) => {
    const beam = beamForClue(level, state, cell);
    if (beam.count !== target) errors.push({ type: "reading", cells: beam.cells, clue: cell, target, count: beam.count });
    return Object.freeze({ cell, target, count: beam.count, cells: beam.cells });
  });
  const whiteGroups = whiteComponents(level, marks);
  if (whiteGroups.length > 1) errors.push({ type: "disconnected-white", cells: whiteGroups.flatMap((group) => group) });
  const unknown = marks.filter((mark) => mark === UNKNOWN).length;
  return Object.freeze({
    complete: errors.length === 0,
    valid: errors.length === 0,
    errors: Object.freeze(errors.map((error) => Object.freeze({ ...error, cells: Object.freeze([...error.cells]) }))),
    readings: Object.freeze(readings),
    black: Object.freeze(black),
    whiteMarks,
    unknown,
    whiteGroups,
  });
}

export function setMark(level, state, cell, mark) {
  if (!integer(cell, 0, cellCount(level) - 1) || ![UNKNOWN, WHITE_MARK, BLACK].includes(mark) || isClue(level, cell) || state.marks[cell] === mark) return Object.freeze({ changed: false, state });
  const marks = [...state.marks];
  const wasBlack = marks[cell] === BLACK;
  marks[cell] = mark;
  // White dots are deliberately notes. They do not affect score/reward moves.
  const moves = state.moves + (wasBlack || mark === BLACK ? 1 : 0);
  return Object.freeze({ changed: true, state: freezeState({ marks, moves }) });
}

export function cycleMark(level, state, cell, backward = false) {
  if (!integer(cell, 0, cellCount(level) - 1) || isClue(level, cell)) return Object.freeze({ changed: false, state });
  const order = backward ? [UNKNOWN, WHITE_MARK, BLACK] : [UNKNOWN, BLACK, WHITE_MARK];
  const index = order.indexOf(state.marks[cell]);
  return setMark(level, state, cell, order[(index + 1) % order.length]);
}

function legalAction(level, action) {
  return plainObject(action) && Object.keys(action).length === 3 && action.type === "mark"
    && integer(action.cell, 0, cellCount(level) - 1) && [UNKNOWN, WHITE_MARK, BLACK].includes(action.mark);
}
export function normalizeTimeline(level, source) {
  if (!Array.isArray(source) || source.length > 4096) return null;
  const output = [];
  for (const action of source) {
    if (!legalAction(level, action)) return null;
    output.push(Object.freeze({ type: "mark", cell: action.cell, mark: action.mark }));
  }
  return Object.freeze(output);
}
export function replayTimeline(level, source) {
  const timeline = normalizeTimeline(level, source);
  if (!timeline) return null;
  let state = createState(level);
  for (const action of timeline) {
    const result = setMark(level, state, action.cell, action.mark);
    if (!result.changed) return null;
    state = result.state;
  }
  return Object.freeze({ timeline, state, evaluation: evaluateState(level, state) });
}

function partialViable(level, marks) {
  for (let cell = 0; cell < marks.length; cell += 1) if (marks[cell] === BLACK && neighbours(level, cell).some((next) => marks[next] === BLACK)) return false;
  for (const [cell, target] of level.clues) {
    let minimum = 1;
    let maximum = 1;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      maximum += ray(level, marks, cell, dx, dy).length;
      minimum += ray(level, marks, cell, dx, dy, true).length;
    }
    if (target < minimum || target > maximum) return false;
  }
  return true;
}

/** Independent two-colour oracle: it reads only clue rays, never solution. */
export function solveLevel(level, { limit = 2 } = {}) {
  const errors = validateLevel(level);
  const maximum = integer(limit, 1, 16) ? limit : 2;
  if (errors.length) return Object.freeze({ count: 0, solutions: Object.freeze([]), truncated: false, errors });
  const marks = Array.from({ length: cellCount(level) }, (_, cell) => isClue(level, cell) ? WHITE_MARK : UNKNOWN);
  const solutions = [];
  let truncated = false;
  const pressure = Array.from({ length: marks.length }, (_, cell) => level.clues.reduce((score, [clue]) => {
    const point = pointFor(level, clue); const current = pointFor(level, cell);
    return score + (point.x === current.x || point.y === current.y ? 1 : 0);
  }, 0));
  function visit() {
    if (solutions.length >= maximum) { truncated = true; return; }
    let best = -1;
    for (let cell = 0; cell < marks.length; cell += 1) if (marks[cell] === UNKNOWN && (best < 0 || pressure[cell] > pressure[best])) best = cell;
    if (best < 0) {
      const evaluation = evaluateState(level, { marks });
      if (evaluation.complete) solutions.push(Object.freeze([...marks]));
      return;
    }
    for (const mark of [BLACK, WHITE_MARK]) {
      marks[best] = mark;
      if (partialViable(level, marks)) visit();
      marks[best] = UNKNOWN;
      if (solutions.length >= maximum) return;
    }
  }
  if (partialViable(level, marks)) visit();
  return Object.freeze({ count: solutions.length, solutions: Object.freeze(solutions), truncated, errors: Object.freeze([]) });
}
