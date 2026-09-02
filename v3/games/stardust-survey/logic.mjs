/** Pure Minesweeper rule engine for 星屑勘测站. */

export const CELL = Object.freeze({
  COVERED: "covered",
  MARKED: "marked",
  REVEALED: "revealed",
  EXPLODED: "exploded",
});

export const PHASE = Object.freeze({
  READY: "ready",
  PLAYING: "playing",
  LOST: "lost",
  WON: "won",
});

const VALID_CELLS = new Set(Object.values(CELL));
const VALID_PHASES = new Set(Object.values(PHASE));
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const sameNumberList = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);

export function cellCount(level) {
  return level.width * level.height;
}

export function inBounds(level, index) {
  return integer(index, 0, cellCount(level) - 1);
}

export function neighbors(level, index) {
  if (!inBounds(level, index)) return [];
  const x = index % level.width;
  const y = Math.floor(index / level.width);
  const output = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < level.width && ny >= 0 && ny < level.height) output.push(ny * level.width + nx);
    }
  }
  return output;
}

export function canonicalMines(level, mines = level.mines) {
  if (!Array.isArray(mines)) return null;
  const sorted = [...mines].sort((left, right) => left - right);
  if (!sorted.length || sorted.length >= cellCount(level) || sorted.some((index, offset) => !inBounds(level, index) || (offset > 0 && sorted[offset - 1] === index))) return null;
  return sorted;
}

export function numberGrid(level, mines = level.mines) {
  const clean = canonicalMines(level, mines);
  if (!clean) return null;
  const mineSet = new Set(clean);
  return Array.from({ length: cellCount(level) }, (_, index) => (
    mineSet.has(index) ? -1 : neighbors(level, index).filter((neighbor) => mineSet.has(neighbor)).length
  ));
}

export function createState(level) {
  return Object.freeze({
    mines: Object.freeze([...level.mines]),
    cells: Object.freeze(Array(cellCount(level)).fill(CELL.COVERED)),
    errors: Object.freeze([]),
    moves: 0,
    scans: 0,
    phase: PHASE.READY,
  });
}

function mutableCopy(state) {
  return {
    mines: [...state.mines],
    cells: [...state.cells],
    errors: [...state.errors],
    moves: state.moves,
    scans: state.scans,
    phase: state.phase,
  };
}

function freezeState(state) {
  return Object.freeze({
    mines: Object.freeze([...state.mines]),
    cells: Object.freeze([...state.cells]),
    errors: Object.freeze([...new Set(state.errors)].sort((left, right) => left - right)),
    moves: state.moves,
    scans: state.scans,
    phase: state.phase,
  });
}

export function mineCount(state) {
  return state.mines.length;
}

export function flagCount(state) {
  return state.cells.filter((cell) => cell === CELL.MARKED).length;
}

export function safeCellsLeft(state, level) {
  const mines = new Set(state.mines);
  return state.cells.reduce((remaining, cell, index) => remaining + (!mines.has(index) && cell !== CELL.REVEALED ? 1 : 0), 0);
}

export function isWon(state, level) {
  const mines = new Set(state.mines);
  return state.phase !== PHASE.LOST && state.cells.every((cell, index) => mines.has(index) || cell === CELL.REVEALED);
}

function legalActiveState(state) {
  return state.phase === PHASE.READY || state.phase === PHASE.PLAYING;
}

function relocateFirstMine(level, mines, scannedIndex) {
  const mineSet = new Set(mines);
  if (!mineSet.has(scannedIndex)) return mines;
  mineSet.delete(scannedIndex);
  const protectedCells = new Set([scannedIndex, ...neighbors(level, scannedIndex)]);
  const total = cellCount(level);
  const start = ((level.seed ?? 0) + scannedIndex * 17) % total;
  let replacement = -1;
  for (let offset = 0; offset < total; offset += 1) {
    const candidate = (start + offset) % total;
    if (!mineSet.has(candidate) && !protectedCells.has(candidate)) { replacement = candidate; break; }
  }
  // Tiny boards can leave no non-neighbor destination. The clicked tile is
  // still excluded; the deterministic fallback preserves mine count.
  if (replacement < 0) {
    for (let offset = 0; offset < total; offset += 1) {
      const candidate = (start + offset) % total;
      if (!mineSet.has(candidate) && candidate !== scannedIndex) { replacement = candidate; break; }
    }
  }
  if (replacement < 0) throw new RangeError("No destination is available for first-scan safety.");
  mineSet.add(replacement);
  return [...mineSet].sort((left, right) => left - right);
}

function revealFlood(state, level, numbers, start) {
  const mines = new Set(state.mines);
  const queue = [start];
  const opened = [];
  while (queue.length) {
    const index = queue.shift();
    if (state.cells[index] !== CELL.COVERED || mines.has(index)) continue;
    state.cells[index] = CELL.REVEALED;
    opened.push(index);
    if (numbers[index] === 0) {
      for (const neighbor of neighbors(level, index)) {
        if (state.cells[neighbor] === CELL.COVERED && !mines.has(neighbor)) queue.push(neighbor);
      }
    }
  }
  return opened;
}

function settlePhase(state, level) {
  if (state.phase === PHASE.LOST) return;
  state.phase = isWon(state, level) ? PHASE.WON : (state.scans > 0 ? PHASE.PLAYING : PHASE.READY);
}

/** Reveal one covered cell. The first actual scan is always safe. */
export function scanCell(state, level, index) {
  if (!legalActiveState(state) || !inBounds(level, index) || state.cells[index] !== CELL.COVERED) return { state, changed: false, opened: [] };
  const next = mutableCopy(state);
  if (next.scans === 0 && next.mines.includes(index)) next.mines = relocateFirstMine(level, next.mines, index);
  const numbers = numberGrid(level, next.mines);
  const mines = new Set(next.mines);
  next.scans += 1;
  next.moves += 1;
  if (mines.has(index)) {
    next.cells[index] = CELL.EXPLODED;
    next.errors.push(index);
    next.phase = PHASE.LOST;
    return { state: freezeState(next), changed: true, opened: [], exploded: [index], relocated: !sameNumberList(next.mines, state.mines) };
  }
  const opened = revealFlood(next, level, numbers, index);
  settlePhase(next, level);
  return { state: freezeState(next), changed: true, opened, exploded: [], relocated: !sameNumberList(next.mines, state.mines) };
}

/** Toggle an analyst's warning marker. Markers never reveal or prove a cell. */
export function toggleMark(state, level, index) {
  if (!legalActiveState(state) || !inBounds(level, index)) return { state, changed: false };
  const current = state.cells[index];
  if (current !== CELL.COVERED && current !== CELL.MARKED) return { state, changed: false };
  const next = mutableCopy(state);
  next.cells[index] = current === CELL.COVERED ? CELL.MARKED : CELL.COVERED;
  next.moves += 1;
  return { state: freezeState(next), changed: true };
}

/**
 * A chord opens every unmarked neighbour only when the marker count equals
 * the visible 8-neighbour reading. Wrong markers can therefore cause a real
 * mine failure, exactly as in Minesweeper.
 */
export function chordCell(state, level, index) {
  if (!legalActiveState(state) || !inBounds(level, index) || state.cells[index] !== CELL.REVEALED) return { state, changed: false, opened: [], exploded: [] };
  const numbers = numberGrid(level, state.mines);
  const reading = numbers[index];
  if (reading <= 0) return { state, changed: false, opened: [], exploded: [] };
  const around = neighbors(level, index);
  const marked = around.filter((neighbor) => state.cells[neighbor] === CELL.MARKED).length;
  const candidates = around.filter((neighbor) => state.cells[neighbor] === CELL.COVERED);
  if (!candidates.length || marked !== reading) return { state, changed: false, opened: [], exploded: [] };
  const next = mutableCopy(state);
  const mines = new Set(next.mines);
  const opened = [];
  const exploded = [];
  for (const candidate of candidates) {
    if (mines.has(candidate)) {
      next.cells[candidate] = CELL.EXPLODED;
      next.errors.push(candidate);
      exploded.push(candidate);
    } else {
      opened.push(...revealFlood(next, level, numbers, candidate));
    }
  }
  next.moves += 1;
  if (exploded.length) next.phase = PHASE.LOST;
  else settlePhase(next, level);
  return { state: freezeState(next), changed: true, opened, exploded };
}

export function applyAction(state, level, action) {
  if (!action || typeof action !== "object" || Array.isArray(action) || !inBounds(level, action.index)) return { state, changed: false };
  if (action.type === "scan") return scanCell(state, level, action.index);
  if (action.type === "mark") return toggleMark(state, level, action.index);
  if (action.type === "chord") return chordCell(state, level, action.index);
  return { state, changed: false };
}

/** Undo restores the positional snapshot while intentionally preserving a hit-mine diagnostic. */
export function undoState(previous, current, level) {
  const restored = restoreState(previous, level);
  const errors = [...new Set([...(restored.errors ?? []), ...(current?.errors ?? [])])].filter((index) => restored.mines.includes(index));
  const next = mutableCopy(restored);
  next.errors = errors;
  settlePhase(next, level);
  return freezeState(next);
}

function validAction(action, level) {
  return action && typeof action === "object" && !Array.isArray(action)
    && ((action.type === "undo" && Object.keys(action).length === 1)
      || (["scan", "mark", "chord"].includes(action.type) && inBounds(level, action.index) && Object.keys(action).every((key) => key === "type" || key === "index")));
}

/** Replays exactly the actions a player could have made; no stored completion flag is trusted. */
export function replayTimeline(level, timeline, maximum = 1000) {
  if (!Array.isArray(timeline) || timeline.length > maximum || !timeline.every((action) => validAction(action, level))) return null;
  let state = createState(level);
  const history = [];
  for (const action of timeline) {
    if (action.type === "undo") {
      const previous = history.pop();
      if (!previous) return null;
      state = undoState(previous, state, level);
      continue;
    }
    const result = applyAction(state, level, action);
    if (!result.changed) return null;
    history.push(state);
    state = result.state;
  }
  return { state, history };
}

/** Basic local Minesweeper inference, used only to prove each fixed board needs no guess. */
export function deriveNoGuessTimeline(level, maximum = 1000) {
  if (!validateLevelShape(level)) return null;
  const first = scanCell(createState(level), level, level.firstSafe);
  if (!first.changed || first.exploded?.length) return null;
  let state = first.state;
  const timeline = [{ type: "scan", index: level.firstSafe }];
  let progressed = true;
  while (progressed && !isWon(state, level) && timeline.length < maximum) {
    progressed = false;
    const numbers = numberGrid(level, state.mines);
    for (let index = 0; index < state.cells.length && !isWon(state, level); index += 1) {
      if (state.cells[index] !== CELL.REVEALED || numbers[index] <= 0) continue;
      const around = neighbors(level, index);
      const hidden = around.filter((neighbor) => state.cells[neighbor] === CELL.COVERED);
      const marks = around.filter((neighbor) => state.cells[neighbor] === CELL.MARKED).length;
      if (!hidden.length) continue;
      if (numbers[index] - marks === hidden.length) {
        for (const target of hidden) {
          const result = toggleMark(state, level, target);
          if (!result.changed) continue;
          state = result.state;
          timeline.push({ type: "mark", index: target });
          progressed = true;
        }
      } else if (numbers[index] === marks) {
        for (const target of hidden) {
          const result = scanCell(state, level, target);
          if (!result.changed || result.exploded?.length) return null;
          state = result.state;
          timeline.push({ type: "scan", index: target });
          progressed = true;
        }
      }
    }
  }
  return isWon(state, level) ? { timeline, state } : null;
}

function validateLevelShape(level) {
  return Boolean(level && typeof level === "object"
    && integer(level.width, 2, 12)
    && integer(level.height, 2, 12)
    && integer(level.firstSafe, 0, level.width * level.height - 1)
    && canonicalMines(level, level.mines)
    && !level.mines.includes(level.firstSafe)
    && integer(level.seed, 0, 9_999_999_999)
    && integer(level.par, 1, 1000));
}

export function validateLevel(level) {
  if (!validateLevelShape(level)) return false;
  const derived = deriveNoGuessTimelineUnchecked(level);
  return Boolean(derived && derived.state.phase === PHASE.WON && derived.timeline.length === level.par);
}

// `validateLevel` cannot call the public helper directly because the public helper validates its level first.
function deriveNoGuessTimelineUnchecked(level, maximum = 1000) {
  const first = scanCell(createState(level), level, level.firstSafe);
  if (!first.changed || first.exploded?.length) return null;
  let state = first.state;
  const timeline = [{ type: "scan", index: level.firstSafe }];
  let progressed = true;
  while (progressed && !isWon(state, level) && timeline.length < maximum) {
    progressed = false;
    const numbers = numberGrid(level, state.mines);
    for (let index = 0; index < state.cells.length && !isWon(state, level); index += 1) {
      if (state.cells[index] !== CELL.REVEALED || numbers[index] <= 0) continue;
      const around = neighbors(level, index);
      const hidden = around.filter((neighbor) => state.cells[neighbor] === CELL.COVERED);
      const marks = around.filter((neighbor) => state.cells[neighbor] === CELL.MARKED).length;
      if (!hidden.length) continue;
      if (numbers[index] - marks === hidden.length) {
        for (const target of hidden) {
          const result = toggleMark(state, level, target);
          if (!result.changed) continue;
          state = result.state;
          timeline.push({ type: "mark", index: target });
          progressed = true;
        }
      } else if (numbers[index] === marks) {
        for (const target of hidden) {
          const result = scanCell(state, level, target);
          if (!result.changed || result.exploded?.length) return null;
          state = result.state;
          timeline.push({ type: "scan", index: target });
          progressed = true;
        }
      }
    }
  }
  return isWon(state, level) ? { timeline, state } : null;
}

export function restoreState(candidate, level) {
  const clean = createState(level);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return clean;
  const mines = canonicalMines(level, candidate.mines);
  if (!mines || mines.length !== level.mines.length || !Array.isArray(candidate.cells) || candidate.cells.length !== cellCount(level)
    || candidate.cells.some((cell) => !VALID_CELLS.has(cell))
    || !Array.isArray(candidate.errors)
    || candidate.errors.some((index, offset) => !inBounds(level, index) || !mines.includes(index) || (offset > 0 && candidate.errors[offset - 1] >= index))
    || !integer(candidate.moves, 0, 100000)
    || !integer(candidate.scans, 0, candidate.moves)
    || !VALID_PHASES.has(candidate.phase)) return clean;
  const mineSet = new Set(mines);
  for (let index = 0; index < candidate.cells.length; index += 1) {
    const cell = candidate.cells[index];
    if (mineSet.has(index) && cell === CELL.REVEALED) return clean;
    if (!mineSet.has(index) && cell === CELL.EXPLODED) return clean;
  }
  const state = freezeState({ mines, cells: candidate.cells, errors: candidate.errors, moves: candidate.moves, scans: candidate.scans, phase: candidate.phase });
  if (state.phase === PHASE.WON && !isWon(state, level)) return clean;
  if (state.phase === PHASE.LOST && !state.cells.includes(CELL.EXPLODED)) return clean;
  return state;
}

export function stateEquals(left, right) {
  return Boolean(left && right
    && Array.isArray(left.mines) && Array.isArray(right.mines)
    && Array.isArray(left.cells) && Array.isArray(right.cells)
    && Array.isArray(left.errors) && Array.isArray(right.errors)
    && sameNumberList(left.mines, right.mines)
    && sameNumberList(left.cells, right.cells)
    && sameNumberList(left.errors, right.errors)
    && left.moves === right.moves
    && left.scans === right.scans
    && left.phase === right.phase);
}
