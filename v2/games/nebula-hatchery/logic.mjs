/*
 * 星云孵化场 · Spiral Galaxies 规则引擎
 *
 * 本模块不访问 DOM、存储、音频或计时器。棋盘使用上游同构的“双倍整数坐标”：
 * 格心为奇/奇，边心为奇/偶或偶/奇，角点为偶/偶。玩家画出的边界与
 * 星核归属笔记分开保存；evaluatePosition 与 solvePuzzle 永远忽略笔记。
 */

export const HISTORY_LIMIT = 100;

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "sprout", label: "微光育苗", shortLabel: "微光", note: "5×5 · 观察星核落点" }),
  Object.freeze({ id: "orbit", label: "环流培育", shortLabel: "环流", note: "7×7 · 兼顾连通与对称" }),
  Object.freeze({ id: "quasar", label: "类星孵化", shortLabel: "类星", note: "9×9 · 回溯级星云群" }),
]);

const CORE_TYPES = Object.freeze({
  cell: Object.freeze({ label: "格心星核", rarity: "常辉" }),
  edge: Object.freeze({ label: "边心双生核", rarity: "伴生" }),
  vertex: Object.freeze({ label: "角点四象核", rarity: "原初" }),
});

function integer(value) {
  return Number.isSafeInteger(value);
}

export function cellIndex(width, row, column) {
  return row * width + column;
}

export function cellCoordinates(width, index) {
  return { row: Math.floor(index / width), column: index % width };
}

export function coreTypeFor(x, y) {
  if (x % 2 === 1 && y % 2 === 1) return "cell";
  if (x % 2 === 0 && y % 2 === 0) return "vertex";
  return "edge";
}

export function edgeKey(orientation, row, column) {
  return `${orientation}:${row}:${column}`;
}

export function parseEdgeKey(value) {
  if (typeof value !== "string") return null;
  const match = /^(h|v):(\d+):(\d+)$/.exec(value);
  if (!match) return null;
  return { orientation: match[1], row: Number(match[2]), column: Number(match[3]) };
}

function edgeSort(left, right) {
  const a = parseEdgeKey(left);
  const b = parseEdgeKey(right);
  if (!a || !b) return String(left).localeCompare(String(right));
  return a.orientation.localeCompare(b.orientation) || a.row - b.row || a.column - b.column;
}

export function cellsAroundPoint(width, height, x, y) {
  const cells = [];
  const firstRow = Math.floor((y - 1) / 2);
  const lastRow = Math.floor(y / 2);
  const firstColumn = Math.floor((x - 1) / 2);
  const lastColumn = Math.floor(x / 2);
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      if (row >= 0 && column >= 0 && row < height && column < width) {
        cells.push(cellIndex(width, row, column));
      }
    }
  }
  return [...new Set(cells)].sort((a, b) => a - b);
}

export function oppositeCell(puzzle, index, coreOrId) {
  const core = typeof coreOrId === "string" ? coreById(puzzle, coreOrId) : coreOrId;
  if (!core || !integer(index) || index < 0 || index >= puzzle.width * puzzle.height) return null;
  const { row, column } = cellCoordinates(puzzle.width, index);
  const cellX = column * 2 + 1;
  const cellY = row * 2 + 1;
  const oppositeX = core.x * 2 - cellX;
  const oppositeY = core.y * 2 - cellY;
  if (oppositeX % 2 === 0 || oppositeY % 2 === 0) return null;
  const oppositeColumn = (oppositeX - 1) / 2;
  const oppositeRow = (oppositeY - 1) / 2;
  if (oppositeRow < 0 || oppositeColumn < 0
    || oppositeRow >= puzzle.height || oppositeColumn >= puzzle.width) return null;
  return cellIndex(puzzle.width, oppositeRow, oppositeColumn);
}

export function decodeDescription(width, height, description) {
  if (!integer(width) || !integer(height) || width < 3 || height < 3) {
    throw new TypeError("Puzzle width and height must both be at least 3.");
  }
  if (typeof description !== "string" || !description) {
    throw new TypeError("Puzzle description must be a non-empty string.");
  }
  const stride = width * 2 - 1;
  const area = stride * (height * 2 - 1);
  const cores = [];
  let cursor = 0;
  for (const token of description) {
    if (token === "z") {
      cursor += 25;
      if (cursor > area) throw new TypeError("Puzzle description exceeds the board.");
      continue;
    }
    const code = token.codePointAt(0);
    let skip;
    let ink;
    if (code >= 97 && code <= 121) {
      skip = code - 97;
      ink = "white";
    } else if (code >= 65 && code <= 89) {
      skip = code - 65;
      ink = "black";
    } else {
      throw new TypeError("Puzzle description contains an invalid token.");
    }
    cursor += skip;
    if (cursor >= area) throw new TypeError("Puzzle description exceeds the board.");
    const x = (cursor % stride) + 1;
    const y = Math.floor(cursor / stride) + 1;
    const type = coreTypeFor(x, y);
    cores.push(Object.freeze({
      id: `k${cores.length}`,
      x,
      y,
      type,
      ink,
      label: CORE_TYPES[type].label,
      rarity: CORE_TYPES[type].rarity,
    }));
    cursor += 1;
  }
  if (cores.length === 0) throw new TypeError("Puzzle needs at least one core.");
  return Object.freeze(cores);
}

function edgeGeometry(orientation, row, column) {
  if (orientation === "v") {
    return Object.freeze({
      orientation,
      row,
      column,
      x1: column,
      y1: row,
      x2: column,
      y2: row + 1,
      midpointX: column * 2,
      midpointY: row * 2 + 1,
      endpointA: Object.freeze({ x: column * 2, y: row * 2 }),
      endpointB: Object.freeze({ x: column * 2, y: (row + 1) * 2 }),
    });
  }
  return Object.freeze({
    orientation,
    row,
    column,
    x1: column,
    y1: row,
    x2: column + 1,
    y2: row,
    midpointX: column * 2 + 1,
    midpointY: row * 2,
    endpointA: Object.freeze({ x: column * 2, y: row * 2 }),
    endpointB: Object.freeze({ x: (column + 1) * 2, y: row * 2 }),
  });
}

function buildEdges(width, height, cores) {
  const coreCoordinates = new Set(cores.map(({ x, y }) => `${x}:${y}`));
  const edges = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 1; column < width; column += 1) {
      const geometry = edgeGeometry("v", row, column);
      const blocked = coreCoordinates.has(`${geometry.midpointX}:${geometry.midpointY}`)
        || coreCoordinates.has(`${geometry.endpointA.x}:${geometry.endpointA.y}`)
        || coreCoordinates.has(`${geometry.endpointB.x}:${geometry.endpointB.y}`);
      edges.push(Object.freeze({ ...geometry, id: edgeKey("v", row, column), legal: !blocked }));
    }
  }
  for (let row = 1; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const geometry = edgeGeometry("h", row, column);
      const blocked = coreCoordinates.has(`${geometry.midpointX}:${geometry.midpointY}`)
        || coreCoordinates.has(`${geometry.endpointA.x}:${geometry.endpointA.y}`)
        || coreCoordinates.has(`${geometry.endpointB.x}:${geometry.endpointB.y}`);
      edges.push(Object.freeze({ ...geometry, id: edgeKey("h", row, column), legal: !blocked }));
    }
  }
  return Object.freeze(edges);
}

function validateCoreSeeds(puzzle) {
  const owners = new Map();
  for (const core of puzzle.cores) {
    const seeds = cellsAroundPoint(puzzle.width, puzzle.height, core.x, core.y);
    for (const index of seeds) {
      const previous = owners.get(index);
      if (previous && previous !== core.id) throw new TypeError("Puzzle cores are too close together.");
      owners.set(index, core.id);
    }
  }
}

export function createPuzzle(definition) {
  if (!definition || !integer(definition.width) || !integer(definition.height)
    || definition.width < 3 || definition.height < 3) {
    throw new TypeError("A puzzle needs integer dimensions of at least 3 by 3.");
  }
  const width = definition.width;
  const height = definition.height;
  const cores = definition.cores
    ? Object.freeze(definition.cores.map((core, index) => {
        if (!integer(core?.x) || !integer(core?.y)
          || core.x < 1 || core.y < 1 || core.x >= width * 2 || core.y >= height * 2) {
          throw new TypeError("Core coordinates must be interior doubled-grid integers.");
        }
        const type = coreTypeFor(core.x, core.y);
        return Object.freeze({
          id: String(core.id ?? `k${index}`),
          x: core.x,
          y: core.y,
          type,
          ink: core.ink === "black" ? "black" : "white",
          label: CORE_TYPES[type].label,
          rarity: CORE_TYPES[type].rarity,
        });
      }))
    : decodeDescription(width, height, definition.description);
  if (cores.length === 0) throw new TypeError("Puzzle needs at least one core.");
  if (cores.some(({ id }) => !id)
    || new Set(cores.map(({ id }) => id)).size !== cores.length
    || new Set(cores.map(({ x, y }) => `${x}:${y}`)).size !== cores.length) {
    throw new TypeError("Core ids must be non-empty; ids and coordinates must be unique.");
  }
  const base = {
    id: String(definition.id ?? "puzzle"),
    title: String(definition.title ?? "未命名孵化舱"),
    difficulty: String(definition.difficulty ?? DIFFICULTIES[0].id),
    width,
    height,
    description: String(definition.description ?? "custom"),
    generatorSeed: integer(definition.generatorSeed) ? definition.generatorSeed : null,
    sourceParameters: String(definition.sourceParameters ?? `${width}x${height}`),
    cores,
  };
  const edges = buildEdges(width, height, cores);
  const puzzle = Object.freeze({
    ...base,
    edges,
    legalEdges: Object.freeze(edges.filter(({ legal }) => legal)),
  });
  validateCoreSeeds(puzzle);
  return puzzle;
}

export function coreById(puzzle, coreId) {
  return puzzle.cores.find(({ id }) => id === coreId) ?? null;
}

export function edgeById(puzzle, id) {
  return puzzle.edges.find((edge) => edge.id === id) ?? null;
}

function inputSet(value) {
  if (value instanceof Set || Array.isArray(value)) return [...value];
  return [];
}

function inputMap(value) {
  if (value instanceof Map || Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return Object.entries(value);
  return [];
}

export function normalizePosition(puzzle, position = {}) {
  const legalEdges = new Set(puzzle.legalEdges.map(({ id }) => id));
  const coreIds = new Set(puzzle.cores.map(({ id }) => id));
  const edges = new Set(inputSet(position.edges).filter((id) => legalEdges.has(id)));
  const notes = new Map();
  for (const entry of inputMap(position.notes)) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const index = Number(entry[0]);
    const coreId = String(entry[1]);
    if (integer(index) && index >= 0 && index < puzzle.width * puzzle.height && coreIds.has(coreId)) {
      notes.set(index, coreId);
    }
  }
  return { edges, notes };
}

export function positionToJSON(position = {}) {
  return {
    edges: inputSet(position.edges).map(String).sort(edgeSort),
    notes: inputMap(position.notes)
      .map(([index, coreId]) => [Number(index), String(coreId)])
      .sort(([left], [right]) => left - right),
  };
}

function adjacentCellsForEdge(puzzle, edge) {
  if (edge.orientation === "v") {
    return [
      cellIndex(puzzle.width, edge.row, edge.column - 1),
      cellIndex(puzzle.width, edge.row, edge.column),
    ];
  }
  return [
    cellIndex(puzzle.width, edge.row - 1, edge.column),
    cellIndex(puzzle.width, edge.row, edge.column),
  ];
}

function neighbours(puzzle, index) {
  const { row, column } = cellCoordinates(puzzle.width, index);
  const result = [];
  if (row > 0) result.push([cellIndex(puzzle.width, row - 1, column), edgeKey("h", row, column)]);
  if (row + 1 < puzzle.height) result.push([cellIndex(puzzle.width, row + 1, column), edgeKey("h", row + 1, column)]);
  if (column > 0) result.push([cellIndex(puzzle.width, row, column - 1), edgeKey("v", row, column)]);
  if (column + 1 < puzzle.width) result.push([cellIndex(puzzle.width, row, column + 1), edgeKey("v", row, column + 1)]);
  return result;
}

export function evaluatePosition(puzzle, position = {}) {
  const normalized = normalizePosition(puzzle, position);
  const total = puzzle.width * puzzle.height;
  const componentOf = new Int16Array(total);
  componentOf.fill(-1);
  const components = [];

  for (let start = 0; start < total; start += 1) {
    if (componentOf[start] !== -1) continue;
    const id = components.length;
    const cells = [];
    const queue = [start];
    componentOf[start] = id;
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      cells.push(current);
      for (const [next, boundaryId] of neighbours(puzzle, current)) {
        if (normalized.edges.has(boundaryId) || componentOf[next] !== -1) continue;
        componentOf[next] = id;
        queue.push(next);
      }
    }
    components.push({ id, cells });
  }

  const validCells = new Set();
  const details = components.map((component) => {
    const coordinates = component.cells.map((index) => cellCoordinates(puzzle.width, index));
    const minRow = Math.min(...coordinates.map(({ row }) => row));
    const maxRow = Math.max(...coordinates.map(({ row }) => row));
    const minColumn = Math.min(...coordinates.map(({ column }) => column));
    const maxColumn = Math.max(...coordinates.map(({ column }) => column));
    const centerX = minColumn + maxColumn + 1;
    const centerY = minRow + maxRow + 1;
    const member = new Set(component.cells);
    const touchingCores = puzzle.cores.filter((core) => (
      cellsAroundPoint(puzzle.width, puzzle.height, core.x, core.y).some((index) => member.has(index))
    ));
    const centreCore = touchingCores.find(({ x, y }) => x === centerX && y === centerY) ?? null;
    const coreContained = Boolean(centreCore) && cellsAroundPoint(
      puzzle.width, puzzle.height, centreCore.x, centreCore.y,
    ).every((index) => member.has(index));
    const symmetric = component.cells.every((index) => {
      const { row, column } = cellCoordinates(puzzle.width, index);
      const oppositeRow = centerY - 1 - row;
      const oppositeColumn = centerX - 1 - column;
      return oppositeRow >= 0 && oppositeColumn >= 0
        && oppositeRow < puzzle.height && oppositeColumn < puzzle.width
        && member.has(cellIndex(puzzle.width, oppositeRow, oppositeColumn));
    });
    let internalEdges = 0;
    for (const boundaryId of normalized.edges) {
      const boundary = edgeById(puzzle, boundaryId);
      const [first, second] = adjacentCellsForEdge(puzzle, boundary);
      if (member.has(first) && member.has(second)) internalEdges += 1;
    }
    const exactCore = touchingCores.length === 1 && Boolean(centreCore) && coreContained;
    const valid = exactCore && symmetric && internalEdges === 0;
    if (valid) component.cells.forEach((index) => validCells.add(index));
    return Object.freeze({
      id: component.id,
      cells: Object.freeze([...component.cells]),
      bounds: Object.freeze({ minRow, maxRow, minColumn, maxColumn }),
      center: Object.freeze({ x: centerX, y: centerY }),
      coreId: centreCore?.id ?? null,
      touchingCoreIds: Object.freeze(touchingCores.map(({ id }) => id)),
      exactCore,
      symmetric,
      internalEdges,
      valid,
    });
  });

  const complete = details.length > 0 && details.every(({ valid }) => valid);
  const validComponentCount = details.filter(({ valid }) => valid).length;
  const invalidComponentCount = details.length > 1 ? details.length - validComponentCount : 0;
  return {
    ...normalized,
    components: Object.freeze(details),
    componentOf,
    validCells,
    validComponentCount,
    invalidComponentCount,
    complete,
    progress: total === 0 ? 0 : validCells.size / total,
  };
}

function removeNoteOrbit(puzzle, notes, index) {
  const oldCoreId = notes.get(index);
  if (!oldCoreId) return;
  const opposite = oppositeCell(puzzle, index, oldCoreId);
  notes.delete(index);
  if (opposite !== null && notes.get(opposite) === oldCoreId) notes.delete(opposite);
}

export function applyMove(puzzle, position = {}, move = {}) {
  const current = normalizePosition(puzzle, position);
  const next = { edges: new Set(current.edges), notes: new Map(current.notes) };
  if (move.type === "toggle-edge" || move.type === "set-edge") {
    const edge = edgeById(puzzle, move.edgeId);
    if (!edge) return { accepted: false, reason: "not-an-edge", position: current };
    if (!edge.legal) return { accepted: false, reason: "core-blocked", position: current };
    const previous = next.edges.has(edge.id);
    const value = move.type === "toggle-edge" ? !previous : Boolean(move.value);
    if (value === previous) return { accepted: false, reason: "no-change", position: current };
    if (value) next.edges.add(edge.id);
    else next.edges.delete(edge.id);
    return {
      accepted: true,
      effect: value ? "edge-added" : "edge-removed",
      edgeId: edge.id,
      position: next,
    };
  }

  if (move.type === "toggle-note") {
    const index = Number(move.cell);
    const core = coreById(puzzle, String(move.coreId));
    if (!integer(index) || index < 0 || index >= puzzle.width * puzzle.height || !core) {
      return { accepted: false, reason: "invalid-note-target", position: current };
    }
    const opposite = oppositeCell(puzzle, index, core);
    if (opposite === null) return { accepted: false, reason: "note-outside", position: current };
    const centreCoreCells = new Set(puzzle.cores
      .filter(({ type }) => type === "cell")
      .map(({ x, y }) => cellIndex(puzzle.width, (y - 1) / 2, (x - 1) / 2)));
    if (centreCoreCells.has(index) || centreCoreCells.has(opposite)) {
      return { accepted: false, reason: "note-on-core", position: current };
    }
    const evaluation = evaluatePosition(puzzle, current);
    if (evaluation.validCells.has(index) || evaluation.validCells.has(opposite)) {
      return { accepted: false, reason: "region-complete", position: current };
    }
    const removing = next.notes.get(index) === core.id && next.notes.get(opposite) === core.id;
    removeNoteOrbit(puzzle, next.notes, index);
    if (opposite !== index) removeNoteOrbit(puzzle, next.notes, opposite);
    if (!removing) {
      next.notes.set(index, core.id);
      next.notes.set(opposite, core.id);
    }
    return {
      accepted: true,
      effect: removing ? "note-removed" : "note-added",
      coreId: core.id,
      cells: Object.freeze(opposite === index ? [index] : [index, opposite].sort((a, b) => a - b)),
      position: next,
    };
  }

  return { accepted: false, reason: "unknown-move", position: current };
}

function parseStrictPosition(puzzle, value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.edges) || !Array.isArray(value.notes)) {
    throw new TypeError("Invalid saved position.");
  }
  if (new Set(value.edges).size !== value.edges.length) throw new TypeError("Duplicate saved edge.");
  const legalEdges = new Set(puzzle.legalEdges.map(({ id }) => id));
  if (value.edges.some((id) => typeof id !== "string" || !legalEdges.has(id))) {
    throw new TypeError("Invalid saved edge.");
  }
  const notes = new Map();
  for (const entry of value.notes) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError("Invalid saved note.");
    const [index, coreId] = entry;
    if (!integer(index) || index < 0 || index >= puzzle.width * puzzle.height
      || notes.has(index) || !coreById(puzzle, coreId)) throw new TypeError("Invalid saved note.");
    notes.set(index, coreId);
  }
  const cellCoreCells = new Set(puzzle.cores.filter(({ type }) => type === "cell").map(({ x, y }) => (
    cellIndex(puzzle.width, (y - 1) / 2, (x - 1) / 2)
  )));
  for (const [index, coreId] of notes) {
    const opposite = oppositeCell(puzzle, index, coreId);
    if (opposite === null || cellCoreCells.has(index) || cellCoreCells.has(opposite)
      || notes.get(opposite) !== coreId) throw new TypeError("Saved note symmetry is invalid.");
  }
  return { edges: new Set(value.edges), notes };
}

function snapshot(puzzle, position) {
  const value = positionToJSON(normalizePosition(puzzle, position));
  parseStrictPosition(puzzle, value);
  return value;
}

export function createSession(puzzle, position = {}) {
  const normalized = normalizePosition(puzzle, position);
  snapshot(puzzle, normalized);
  return { position: normalized, history: [], moves: 0 };
}

export function applySessionMove(puzzle, session, move) {
  const current = session?.position ?? {};
  const result = applyMove(puzzle, current, move);
  if (!result.accepted) return { accepted: false, reason: result.reason, session };
  return {
    accepted: true,
    effect: result.effect,
    session: {
      position: result.position,
      history: [
        ...(Array.isArray(session?.history) ? session.history : []),
        snapshot(puzzle, current),
      ].slice(-HISTORY_LIMIT),
      moves: Math.max(0, Number(session?.moves) || 0) + 1,
    },
  };
}

export function undoSession(puzzle, session) {
  const history = Array.isArray(session?.history) ? [...session.history] : [];
  if (history.length === 0) return { accepted: false, reason: "empty-history", session };
  const previous = history.pop();
  return {
    accepted: true,
    session: {
      position: parseStrictPosition(puzzle, previous),
      history,
      moves: Math.max(0, (Number(session?.moves) || 0) - 1),
    },
  };
}

export function restartSession(puzzle) {
  return createSession(puzzle);
}

export function sessionToJSON(puzzle, session) {
  return {
    puzzleId: puzzle.id,
    moves: Math.max(0, Number(session?.moves) || 0),
    position: snapshot(puzzle, session?.position ?? {}),
    history: (Array.isArray(session?.history) ? session.history : [])
      .slice(-HISTORY_LIMIT)
      .map((item) => snapshot(puzzle, item)),
  };
}

export function restoreSession(puzzle, value) {
  if (!value || typeof value !== "object" || value.puzzleId !== puzzle.id
    || !integer(value.moves) || value.moves < 0 || !Array.isArray(value.history)
    || value.history.length > HISTORY_LIMIT || value.history.length > value.moves) {
    throw new TypeError("Invalid saved session.");
  }
  return {
    position: parseStrictPosition(puzzle, value.position),
    history: value.history.map((item) => snapshot(puzzle, parseStrictPosition(puzzle, item))),
    moves: value.moves,
  };
}

function candidateCoresForCells(puzzle) {
  const total = puzzle.width * puzzle.height;
  const touching = Array.from({ length: total }, () => new Set());
  puzzle.cores.forEach((core, coreIndex) => {
    for (const index of cellsAroundPoint(puzzle.width, puzzle.height, core.x, core.y)) {
      touching[index].add(coreIndex);
    }
  });
  const candidates = Array.from({ length: total }, () => []);
  for (let index = 0; index < total; index += 1) {
    puzzle.cores.forEach((core, coreIndex) => {
      const opposite = oppositeCell(puzzle, index, core);
      if (opposite === null) return;
      if ([...touching[index]].some((other) => other !== coreIndex)) return;
      if ([...touching[opposite]].some((other) => other !== coreIndex)) return;
      candidates[index].push(coreIndex);
    });
  }
  return { candidates, touching };
}

function solutionKey(owners) {
  return [...owners].join(",");
}

export function boundariesFromOwners(puzzle, owners) {
  const result = new Set();
  for (const edge of puzzle.legalEdges) {
    const [first, second] = adjacentCellsForEdge(puzzle, edge);
    if (owners[first] !== owners[second]) result.add(edge.id);
  }
  return result;
}

export function solvePuzzle(puzzle, options = {}) {
  const limit = Math.max(1, Math.floor(Number(options.limit) || 2));
  const total = puzzle.width * puzzle.height;
  const { candidates } = candidateCoresForCells(puzzle);
  const initial = new Int16Array(total);
  initial.fill(-1);
  let impossible = false;
  puzzle.cores.forEach((core, coreIndex) => {
    for (const index of cellsAroundPoint(puzzle.width, puzzle.height, core.x, core.y)) {
      if (initial[index] !== -1 && initial[index] !== coreIndex) impossible = true;
      initial[index] = coreIndex;
    }
  });
  const solutions = [];
  const seen = new Set();
  let visited = 0;
  let truncated = false;

  function possibleFor(index, coreIndex, owners) {
    if (!candidates[index].includes(coreIndex)) return false;
    const opposite = oppositeCell(puzzle, index, puzzle.cores[coreIndex]);
    return opposite !== null && (owners[opposite] === -1 || owners[opposite] === coreIndex);
  }

  function connectivityViable(owners) {
    for (let coreIndex = 0; coreIndex < puzzle.cores.length; coreIndex += 1) {
      const assigned = [];
      for (let index = 0; index < total; index += 1) if (owners[index] === coreIndex) assigned.push(index);
      if (assigned.length === 0) return false;
      const reachable = new Set([assigned[0]]);
      const queue = [assigned[0]];
      for (let head = 0; head < queue.length; head += 1) {
        for (const [next] of neighbours(puzzle, queue[head])) {
          if (reachable.has(next)) continue;
          if (owners[next] !== coreIndex && !(owners[next] === -1 && possibleFor(next, coreIndex, owners))) continue;
          reachable.add(next);
          queue.push(next);
        }
      }
      if (assigned.some((index) => !reachable.has(index))) return false;
    }
    return true;
  }

  function propagate(source) {
    const owners = new Int16Array(source);
    let changed = true;
    while (changed) {
      changed = false;
      for (let index = 0; index < total; index += 1) {
        if (owners[index] !== -1) {
          const coreIndex = owners[index];
          if (!possibleFor(index, coreIndex, owners)) return null;
          const opposite = oppositeCell(puzzle, index, puzzle.cores[coreIndex]);
          if (owners[opposite] === -1) {
            owners[opposite] = coreIndex;
            changed = true;
          } else if (owners[opposite] !== coreIndex) return null;
          continue;
        }
        const domain = candidates[index].filter((coreIndex) => possibleFor(index, coreIndex, owners));
        if (domain.length === 0) return null;
        if (domain.length === 1) {
          const coreIndex = domain[0];
          const opposite = oppositeCell(puzzle, index, puzzle.cores[coreIndex]);
          if (owners[opposite] !== -1 && owners[opposite] !== coreIndex) return null;
          owners[index] = coreIndex;
          owners[opposite] = coreIndex;
          changed = true;
        }
      }
      if (!connectivityViable(owners)) return null;
    }
    return owners;
  }

  function search(source) {
    if (solutions.length >= limit) {
      truncated = true;
      return;
    }
    visited += 1;
    const owners = propagate(source);
    if (!owners) return;
    let branchIndex = -1;
    let branchDomain = null;
    for (let index = 0; index < total; index += 1) {
      if (owners[index] !== -1) continue;
      const domain = candidates[index].filter((coreIndex) => possibleFor(index, coreIndex, owners));
      if (!branchDomain || domain.length < branchDomain.length) {
        branchIndex = index;
        branchDomain = domain;
      }
    }
    if (branchIndex === -1) {
      const edges = boundariesFromOwners(puzzle, owners);
      const evaluation = evaluatePosition(puzzle, { edges });
      if (!evaluation.complete) return;
      const key = solutionKey(owners);
      if (!seen.has(key)) {
        seen.add(key);
        solutions.push(Object.freeze({ owners: new Int16Array(owners), edges }));
      }
      return;
    }
    for (const coreIndex of branchDomain) {
      const next = new Int16Array(owners);
      const opposite = oppositeCell(puzzle, branchIndex, puzzle.cores[coreIndex]);
      next[branchIndex] = coreIndex;
      next[opposite] = coreIndex;
      search(next);
      if (solutions.length >= limit) {
        truncated = true;
        break;
      }
    }
  }

  if (!impossible) search(initial);
  return {
    solutions,
    count: solutions.length,
    unique: solutions.length === 1 && !truncated,
    truncated,
    visited,
  };
}

function distanceToSegment(x, y, edge) {
  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;
  const lengthSquared = dx * dx + dy * dy;
  const projection = Math.max(0, Math.min(1, ((x - edge.x1) * dx + (y - edge.y1) * dy) / lengthSquared));
  const nearestX = edge.x1 + projection * dx;
  const nearestY = edge.y1 + projection * dy;
  return Math.hypot(x - nearestX, y - nearestY);
}

export function resolvePointerTarget(puzzle, point, options = {}) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x > puzzle.width || y > puzzle.height) return null;
  const coreToleranceValue = Number(options.coreTolerance);
  const edgeToleranceValue = Number(options.edgeTolerance);
  const ambiguityGapValue = Number(options.ambiguityGap);
  const coreTolerance = Number.isFinite(coreToleranceValue) ? Math.max(0, coreToleranceValue) : 0.22;
  const edgeTolerance = Number.isFinite(edgeToleranceValue) ? Math.max(0, edgeToleranceValue) : 0.22;
  const ambiguityGap = Number.isFinite(ambiguityGapValue) ? Math.max(0, ambiguityGapValue) : 0.04;
  const coreHits = puzzle.cores
    .map((core) => ({ core, distance: Math.hypot(x - core.x / 2, y - core.y / 2) }))
    .sort((a, b) => a.distance - b.distance);
  if (coreHits[0]?.distance <= coreTolerance) {
    if (coreHits[1] && coreHits[1].distance - coreHits[0].distance < ambiguityGap) return null;
    return { type: "core", coreId: coreHits[0].core.id, distance: coreHits[0].distance };
  }
  if (options.mode === "note") {
    const column = Math.floor(x);
    const row = Math.floor(y);
    if (row >= 0 && column >= 0 && row < puzzle.height && column < puzzle.width) {
      return { type: "cell", cell: cellIndex(puzzle.width, row, column) };
    }
    return null;
  }
  const edgeHits = puzzle.legalEdges
    .map((edge) => ({ edge, distance: distanceToSegment(x, y, edge) }))
    .sort((a, b) => a.distance - b.distance || edgeSort(a.edge.id, b.edge.id));
  if (!edgeHits[0] || edgeHits[0].distance > edgeTolerance) return null;
  if (edgeHits[1] && edgeHits[1].distance - edgeHits[0].distance < ambiguityGap) return null;
  return { type: "edge", edgeId: edgeHits[0].edge.id, distance: edgeHits[0].distance };
}

function generatedLevel(id, title, difficulty, width, description, generatorSeed) {
  return createPuzzle({
    id,
    title,
    difficulty,
    width,
    height: width,
    description,
    generatorSeed,
    sourceParameters: `${width}x${width}d${difficulty === "quasar" ? "u" : "n"}`,
  });
}

const LEVEL_DEFINITIONS = [
  ["sprout-dewdrop", "露滴育星皿", "sprout", 5, "egfjdtkn", 101],
  ["sprout-pollen", "花粉引力巢", "sprout", 5, "cflkzdcddc", 102],
  ["sprout-shell", "月壳初生池", "sprout", 5, "cflkkufe", 103],
  ["orbit-anemone", "星葵环流舱", "orbit", 7, "kqfdfizcgzfpfibd", 201],
  ["orbit-tide", "蓝潮胚云室", "orbit", 7, "ijiuuhzjecujfk", 202],
  ["orbit-cocoon", "银茧旋生庭", "orbit", 7, "agjpzaeacszpczdg", 203],
  ["quasar-cathedral", "类星孵化圣所", "quasar", 9, "bizovofccczzvzcddezfidjehf", 301],
  ["quasar-reef", "暗物质珊瑚礁", "quasar", 9, "mecuezigmlzzcilgkhzmcdsdg", 302],
  ["quasar-crown", "引力王冠温床", "quasar", 9, "bzckkczcodzcnzbezfdtgamzbg", 303],
];

export const LEVELS = Object.freeze(LEVEL_DEFINITIONS.map((definition) => generatedLevel(...definition)));

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function findLevel(levelId) {
  return LEVELS.find(({ id }) => id === levelId) ?? null;
}
