export const MAX_BRIDGES = 2;

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "clear", label: "晴空航线", shortLabel: "晴空", note: "小型港群 · 熟悉调度" }),
  Object.freeze({ id: "mist", label: "雾海航线", shortLabel: "雾海", note: "中型港群 · 交叉抉择" }),
  Object.freeze({ id: "storm", label: "风暴航线", shortLabel: "风暴", note: "大型港群 · 全网联调" }),
]);

function integer(value) {
  return Number.isSafeInteger(value);
}

function freezeIsland(island) {
  return Object.freeze({ ...island });
}

export function coordinateKey(row, column) {
  return `${row}:${column}`;
}

export function createPuzzle(definition) {
  if (!definition || !Array.isArray(definition.islands) || definition.islands.length < 2) {
    throw new TypeError("A puzzle needs at least two islands.");
  }

  const ids = new Set();
  const coordinates = new Set();
  const islands = definition.islands.map((source, index) => {
    const id = String(source?.id ?? `p${index}`);
    const row = source?.row;
    const column = source?.column;
    const target = source?.target;
    if (!id || ids.has(id)) throw new TypeError("Island ids must be non-empty and unique.");
    if (!integer(row) || !integer(column) || row < 0 || column < 0) {
      throw new TypeError("Island coordinates must be non-negative integers.");
    }
    if (!integer(target) || target < 1 || target > MAX_BRIDGES * 4) {
      throw new TypeError("Island targets must be integers from 1 to 8.");
    }
    const key = coordinateKey(row, column);
    if (coordinates.has(key)) throw new TypeError("Island coordinates must be unique.");
    ids.add(id);
    coordinates.add(key);
    return freezeIsland({ id, row, column, target, index });
  });

  const inferredHeight = Math.max(...islands.map(({ row }) => row)) + 1;
  const inferredWidth = Math.max(...islands.map(({ column }) => column)) + 1;
  const width = definition.width ?? inferredWidth;
  const height = definition.height ?? inferredHeight;
  if (!integer(width) || !integer(height) || width < inferredWidth || height < inferredHeight) {
    throw new TypeError("Puzzle dimensions must contain every island.");
  }

  const base = {
    id: String(definition.id ?? "puzzle"),
    title: String(definition.title ?? "未命名航区"),
    difficulty: String(definition.difficulty ?? DIFFICULTIES[0].id),
    width,
    height,
    islands: Object.freeze(islands),
  };
  const edges = Object.freeze(buildCandidateEdges(base));
  const capacity = new Map(islands.map(({ id }) => [id, 0]));
  for (const edge of edges) {
    capacity.set(edge.a, capacity.get(edge.a) + MAX_BRIDGES);
    capacity.set(edge.b, capacity.get(edge.b) + MAX_BRIDGES);
  }
  for (const island of islands) {
    if (island.target > capacity.get(island.id)) {
      throw new TypeError(`Island ${island.id} cannot reach its target.`);
    }
  }

  return Object.freeze({ ...base, edges });
}

export function edgeIdFromIndices(firstIndex, secondIndex) {
  const low = Math.min(firstIndex, secondIndex);
  const high = Math.max(firstIndex, secondIndex);
  return `e:${low}:${high}`;
}

function createEdge(first, second) {
  const horizontal = first.row === second.row;
  const before = horizontal
    ? (first.column < second.column ? first : second)
    : (first.row < second.row ? first : second);
  const after = before === first ? second : first;
  const cells = [];
  if (horizontal) {
    for (let column = before.column + 1; column < after.column; column += 1) {
      cells.push(Object.freeze({ row: before.row, column }));
    }
  } else {
    for (let row = before.row + 1; row < after.row; row += 1) {
      cells.push(Object.freeze({ row, column: before.column }));
    }
  }
  return Object.freeze({
    id: edgeIdFromIndices(first.index, second.index),
    a: first.id,
    b: second.id,
    aIndex: first.index,
    bIndex: second.index,
    orientation: horizontal ? "horizontal" : "vertical",
    from: Object.freeze({ row: before.row, column: before.column }),
    to: Object.freeze({ row: after.row, column: after.column }),
    cells: Object.freeze(cells),
  });
}

export function buildCandidateEdges(puzzle) {
  const rows = new Map();
  const columns = new Map();
  for (const island of puzzle.islands) {
    if (!rows.has(island.row)) rows.set(island.row, []);
    if (!columns.has(island.column)) columns.set(island.column, []);
    rows.get(island.row).push(island);
    columns.get(island.column).push(island);
  }

  const edges = [];
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const line = rows.get(row).sort((a, b) => a.column - b.column);
    for (let index = 0; index < line.length - 1; index += 1) {
      edges.push(createEdge(line[index], line[index + 1]));
    }
  }
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const line = columns.get(column).sort((a, b) => a.row - b.row);
    for (let index = 0; index < line.length - 1; index += 1) {
      edges.push(createEdge(line[index], line[index + 1]));
    }
  }
  return edges;
}

export function edgeById(puzzle, edgeId) {
  return puzzle.edges.find(({ id }) => id === edgeId) ?? null;
}

export function islandById(puzzle, islandId) {
  return puzzle.islands.find(({ id }) => id === islandId) ?? null;
}

export function edgeBetween(puzzle, firstIslandId, secondIslandId) {
  const first = islandById(puzzle, firstIslandId);
  const second = islandById(puzzle, secondIslandId);
  if (!first || !second) return null;
  return edgeById(puzzle, edgeIdFromIndices(first.index, second.index));
}

export function edgesCross(first, second) {
  if (!first || !second || first.orientation === second.orientation) return false;
  const horizontal = first.orientation === "horizontal" ? first : second;
  const vertical = horizontal === first ? second : first;
  return (
    horizontal.from.column < vertical.from.column
    && vertical.from.column < horizontal.to.column
    && vertical.from.row < horizontal.from.row
    && horizontal.from.row < vertical.to.row
  );
}

function inputBridgeEntries(value) {
  if (value instanceof Map) return [...value.entries()];
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.entries(value);
  return [];
}

function inputSet(value) {
  if (value instanceof Set || Array.isArray(value)) return [...value];
  return [];
}

export function normalizePosition(puzzle, position = {}) {
  const validEdges = new Set(puzzle.edges.map(({ id }) => id));
  const validIslands = new Set(puzzle.islands.map(({ id }) => id));
  const bridges = new Map();
  for (const entry of inputBridgeEntries(position.bridges)) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [edgeId, rawCount] = entry;
    const count = Number(rawCount);
    if (validEdges.has(edgeId) && integer(count) && count >= 1 && count <= MAX_BRIDGES) {
      bridges.set(edgeId, count);
    }
  }
  const marks = new Set(inputSet(position.marks).filter((edgeId) => (
    validEdges.has(edgeId) && !bridges.has(edgeId)
  )));
  const checked = new Set(inputSet(position.checked).filter((islandId) => validIslands.has(islandId)));
  return { bridges, marks, checked };
}

export function positionToJSON(position = {}) {
  const bridges = inputBridgeEntries(position.bridges)
    .filter(([, count]) => Number(count) > 0)
    .map(([edgeId, count]) => [edgeId, Number(count)])
    .sort(([a], [b]) => a.localeCompare(b));
  return {
    bridges,
    marks: inputSet(position.marks).map(String).sort(),
    checked: inputSet(position.checked).map(String).sort(),
  };
}

export function crossingConflicts(puzzle, position = {}) {
  const { bridges } = normalizePosition(puzzle, position);
  const active = puzzle.edges.filter(({ id }) => bridges.has(id));
  const conflicts = new Set();
  for (let first = 0; first < active.length; first += 1) {
    for (let second = first + 1; second < active.length; second += 1) {
      if (edgesCross(active[first], active[second])) {
        conflicts.add(active[first].id);
        conflicts.add(active[second].id);
      }
    }
  }
  return conflicts;
}

export function connectedComponents(puzzle, position = {}) {
  const { bridges } = normalizePosition(puzzle, position);
  const neighbours = new Map(puzzle.islands.map(({ id }) => [id, new Set()]));
  for (const edge of puzzle.edges) {
    if (!bridges.has(edge.id)) continue;
    neighbours.get(edge.a).add(edge.b);
    neighbours.get(edge.b).add(edge.a);
  }

  const remaining = new Set(neighbours.keys());
  const components = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value;
    const component = new Set([start]);
    const queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      const current = queue.shift();
      for (const neighbour of neighbours.get(current)) {
        if (!remaining.has(neighbour)) continue;
        remaining.delete(neighbour);
        component.add(neighbour);
        queue.push(neighbour);
      }
    }
    components.push(component);
  }
  return components;
}

export function evaluatePosition(puzzle, position = {}) {
  const normalized = normalizePosition(puzzle, position);
  const degrees = new Map(puzzle.islands.map(({ id }) => [id, 0]));
  let bridgeUnits = 0;
  for (const edge of puzzle.edges) {
    const count = normalized.bridges.get(edge.id) ?? 0;
    if (count === 0) continue;
    degrees.set(edge.a, degrees.get(edge.a) + count);
    degrees.set(edge.b, degrees.get(edge.b) + count);
    bridgeUnits += count;
  }

  const ports = new Map();
  for (const island of puzzle.islands) {
    const count = degrees.get(island.id);
    ports.set(island.id, {
      target: island.target,
      count,
      exact: count === island.target,
      over: count > island.target,
      under: count < island.target,
    });
  }
  const crossings = crossingConflicts(puzzle, normalized);
  const components = connectedComponents(puzzle, normalized);
  const connected = components.length === 1;
  const exactPorts = [...ports.values()].filter(({ exact }) => exact).length;
  const complete = (
    puzzle.islands.length >= 2
    && crossings.size === 0
    && connected
    && exactPorts === puzzle.islands.length
  );
  return {
    ...normalized,
    degrees,
    ports,
    crossings,
    components,
    connected,
    complete,
    bridgeUnits,
    exactPorts,
    totalPorts: puzzle.islands.length,
    progress: puzzle.islands.length === 0 ? 0 : exactPorts / puzzle.islands.length,
  };
}

function copyPosition(puzzle, position) {
  const normalized = normalizePosition(puzzle, position);
  return {
    bridges: new Map(normalized.bridges),
    marks: new Set(normalized.marks),
    checked: new Set(normalized.checked),
  };
}

export function applyMove(puzzle, position = {}, move = {}) {
  const next = copyPosition(puzzle, position);

  if (move.type === "cycle-bridge") {
    const edge = edgeById(puzzle, move.edgeId);
    if (!edge) return { accepted: false, reason: "not-a-candidate", ...next };
    const current = next.bridges.get(edge.id) ?? 0;
    const reverse = move.direction === -1 || move.direction === "reverse";
    const count = reverse ? (current + MAX_BRIDGES) % (MAX_BRIDGES + 1) : (current + 1) % 3;

    if (count > 0 && next.marks.has(edge.id)) {
      return { accepted: false, reason: "marked", edgeId: edge.id, ...next };
    }
    if (current === 0 && count > 0) {
      const blocker = puzzle.edges.find((candidate) => (
        next.bridges.has(candidate.id) && edgesCross(edge, candidate)
      ));
      if (blocker) {
        return {
          accepted: false,
          reason: "crossing",
          edgeId: edge.id,
          blockingEdgeId: blocker.id,
          ...next,
        };
      }
    }

    if (count === 0) next.bridges.delete(edge.id);
    else next.bridges.set(edge.id, count);
    next.checked.delete(edge.a);
    next.checked.delete(edge.b);
    return {
      accepted: true,
      effect: count === 0 ? "bridge-cleared" : `bridge-${count}`,
      edgeId: edge.id,
      previousCount: current,
      count,
      ...next,
    };
  }

  if (move.type === "toggle-mark") {
    const edge = edgeById(puzzle, move.edgeId);
    if (!edge) return { accepted: false, reason: "not-a-candidate", ...next };
    if (next.bridges.has(edge.id)) {
      return { accepted: false, reason: "has-bridge", edgeId: edge.id, ...next };
    }
    const marked = !next.marks.has(edge.id);
    if (marked) next.marks.add(edge.id);
    else next.marks.delete(edge.id);
    return {
      accepted: true,
      effect: marked ? "mark-added" : "mark-removed",
      edgeId: edge.id,
      ...next,
    };
  }

  if (move.type === "toggle-checked") {
    const island = islandById(puzzle, move.islandId);
    if (!island) return { accepted: false, reason: "not-an-island", ...next };
    const checked = !next.checked.has(island.id);
    if (checked && !evaluatePosition(puzzle, next).ports.get(island.id).exact) {
      return { accepted: false, reason: "not-exact", islandId: island.id, ...next };
    }
    if (checked) next.checked.add(island.id);
    else next.checked.delete(island.id);
    return {
      accepted: true,
      effect: checked ? "checked-added" : "checked-removed",
      islandId: island.id,
      ...next,
    };
  }

  return { accepted: false, reason: "unknown-move", ...next };
}

export const HISTORY_LIMIT = 100;

function positionSnapshot(puzzle, position) {
  const snapshot = positionToJSON(normalizePosition(puzzle, position));
  parseStrictPosition(puzzle, snapshot);
  return snapshot;
}

export function createSession(puzzle, position = {}) {
  const normalized = normalizePosition(puzzle, position);
  positionSnapshot(puzzle, normalized);
  return {
    position: normalized,
    history: [],
    moves: 0,
  };
}

export function applySessionMove(puzzle, session, move) {
  const current = session?.position ?? {};
  const result = applyMove(puzzle, current, move);
  if (!result.accepted) {
    return {
      accepted: false,
      reason: result.reason,
      blockingEdgeId: result.blockingEdgeId,
      session,
    };
  }
  const history = [
    ...(Array.isArray(session?.history) ? session.history : []),
    positionSnapshot(puzzle, current),
  ].slice(-HISTORY_LIMIT);
  return {
    accepted: true,
    effect: result.effect,
    session: {
      position: normalizePosition(puzzle, result),
      history,
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
      position: normalizePosition(puzzle, previous),
      history,
      moves: Math.max(0, (Number(session?.moves) || 0) - 1),
    },
  };
}

export function restartSession(puzzle) {
  return createSession(puzzle);
}

function parseStrictPosition(puzzle, value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.bridges)
    || !Array.isArray(value.marks) || !Array.isArray(value.checked)) {
    throw new TypeError("Invalid saved position.");
  }
  const validEdges = new Set(puzzle.edges.map(({ id }) => id));
  const validIslands = new Set(puzzle.islands.map(({ id }) => id));
  const bridges = new Map();
  for (const entry of value.bridges) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError("Invalid saved bridge.");
    const [edgeId, count] = entry;
    if (!validEdges.has(edgeId) || bridges.has(edgeId) || !integer(count)
      || count < 1 || count > MAX_BRIDGES) {
      throw new TypeError("Invalid saved bridge.");
    }
    bridges.set(edgeId, count);
  }
  const marks = [...value.marks];
  if (new Set(marks).size !== marks.length
    || marks.some((edgeId) => !validEdges.has(edgeId) || bridges.has(edgeId))) {
    throw new TypeError("Invalid saved mark.");
  }
  const checked = [...value.checked];
  if (new Set(checked).size !== checked.length
    || checked.some((islandId) => !validIslands.has(islandId))) {
    throw new TypeError("Invalid saved checked port.");
  }
  const position = {
    bridges,
    marks: new Set(marks),
    checked: new Set(checked),
  };
  const evaluation = evaluatePosition(puzzle, position);
  if (evaluation.crossings.size > 0) throw new TypeError("Saved bridges cross.");
  if ([...position.checked].some((islandId) => !evaluation.ports.get(islandId).exact)) {
    throw new TypeError("Saved checked port is not exact.");
  }
  return position;
}

export function sessionToJSON(puzzle, session) {
  return {
    puzzleId: puzzle.id,
    moves: Math.max(0, Number(session?.moves) || 0),
    position: positionSnapshot(puzzle, session?.position ?? {}),
    history: (Array.isArray(session?.history) ? session.history : [])
      .slice(-HISTORY_LIMIT)
      .map((snapshot) => positionSnapshot(puzzle, snapshot)),
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
    history: value.history.map((snapshot) => positionSnapshot(puzzle, parseStrictPosition(puzzle, snapshot))),
    moves: value.moves,
  };
}

function solutionKey(bridges) {
  return [...bridges.entries()]
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => `${id}=${count}`)
    .join("|");
}

export function solvePuzzle(puzzle, options = {}) {
  const limit = Math.max(1, Number(options.limit) || 2);
  const edges = [...puzzle.edges].sort((first, second) => {
    const firstPressure = (
      islandById(puzzle, first.a).target + islandById(puzzle, first.b).target
    );
    const secondPressure = (
      islandById(puzzle, second.a).target + islandById(puzzle, second.b).target
    );
    return secondPressure - firstPressure;
  });
  const incidentRemaining = new Map(puzzle.islands.map(({ id }) => [id, 0]));
  for (const edge of edges) {
    incidentRemaining.set(edge.a, incidentRemaining.get(edge.a) + MAX_BRIDGES);
    incidentRemaining.set(edge.b, incidentRemaining.get(edge.b) + MAX_BRIDGES);
  }
  const degrees = new Map(puzzle.islands.map(({ id }) => [id, 0]));
  const chosen = new Map();
  const solutions = [];
  const seen = new Set();
  let visited = 0;
  let truncated = false;

  function viable() {
    for (const island of puzzle.islands) {
      const degree = degrees.get(island.id);
      if (degree > island.target) return false;
      if (degree + incidentRemaining.get(island.id) < island.target) return false;
    }
    return true;
  }

  function search(index) {
    if (solutions.length >= limit) {
      truncated = true;
      return;
    }
    visited += 1;
    if (index === edges.length) {
      if (!puzzle.islands.every((island) => degrees.get(island.id) === island.target)) return;
      const result = evaluatePosition(puzzle, { bridges: chosen });
      if (!result.complete) return;
      const bridges = new Map(chosen);
      const key = solutionKey(bridges);
      if (!seen.has(key)) {
        seen.add(key);
        solutions.push(bridges);
      }
      return;
    }

    const edge = edges[index];
    incidentRemaining.set(edge.a, incidentRemaining.get(edge.a) - MAX_BRIDGES);
    incidentRemaining.set(edge.b, incidentRemaining.get(edge.b) - MAX_BRIDGES);
    const maximum = Math.min(
      MAX_BRIDGES,
      islandById(puzzle, edge.a).target - degrees.get(edge.a),
      islandById(puzzle, edge.b).target - degrees.get(edge.b),
    );

    for (let count = maximum; count >= 0; count -= 1) {
      if (count > 0) {
        const crossing = edges.slice(0, index).some((other) => (
          chosen.has(other.id) && edgesCross(edge, other)
        ));
        if (crossing) continue;
        chosen.set(edge.id, count);
        degrees.set(edge.a, degrees.get(edge.a) + count);
        degrees.set(edge.b, degrees.get(edge.b) + count);
      }
      if (viable()) search(index + 1);
      if (count > 0) {
        degrees.set(edge.a, degrees.get(edge.a) - count);
        degrees.set(edge.b, degrees.get(edge.b) - count);
        chosen.delete(edge.id);
      }
      if (solutions.length >= limit) {
        truncated = true;
        break;
      }
    }
    incidentRemaining.set(edge.a, incidentRemaining.get(edge.a) + MAX_BRIDGES);
    incidentRemaining.set(edge.b, incidentRemaining.get(edge.b) + MAX_BRIDGES);
  }

  search(0);
  return {
    solutions,
    count: solutions.length,
    unique: solutions.length === 1 && !truncated,
    truncated,
    visited,
  };
}

function levelDefinition(id, title, difficulty, size, islandRows) {
  return {
    id,
    title,
    difficulty,
    width: size,
    height: size,
    islands: islandRows.map(([row, column, target], index) => ({
      id: `p${index}`,
      row,
      column,
      target,
    })),
  };
}

const LEVEL_DEFINITIONS = [
  levelDefinition("clear-aurora", "曙光转运站", "clear", 5, [
    [0, 2, 2], [1, 1, 2], [1, 2, 5], [1, 4, 1], [2, 4, 3], [4, 2, 3], [4, 4, 4],
  ]),
  levelDefinition("clear-bell", "风铃短航道", "clear", 5, [
    [0, 1, 1], [0, 2, 4], [0, 3, 4], [0, 4, 1], [2, 3, 1], [4, 2, 2], [4, 4, 1],
  ]),
  levelDefinition("mist-delta", "雾汐三角洲", "mist", 7, [
    [0, 2, 2], [0, 3, 4], [0, 5, 3], [1, 0, 2], [1, 3, 3], [2, 2, 2], [2, 3, 5],
    [2, 5, 5], [4, 3, 2], [5, 0, 3], [5, 3, 3], [5, 5, 1], [6, 3, 1],
  ]),
  levelDefinition("mist-compass", "失向罗盘阵", "mist", 7, [
    [0, 0, 2], [0, 1, 4], [0, 4, 3], [2, 0, 3], [2, 6, 1], [3, 0, 3], [3, 4, 2],
    [3, 5, 5], [3, 6, 5], [5, 0, 2], [5, 1, 3], [5, 5, 3], [6, 6, 2],
  ]),
  levelDefinition("storm-crown", "天穹王冠港", "storm", 10, [
    [0, 1, 3], [0, 4, 4], [0, 8, 3], [0, 9, 2], [1, 4, 2], [2, 0, 3], [2, 1, 5],
    [3, 4, 2], [3, 7, 2], [3, 9, 2], [4, 3, 2], [4, 6, 2], [5, 5, 3], [5, 6, 4],
    [5, 8, 2], [5, 9, 3], [6, 1, 3], [6, 2, 1], [6, 6, 2], [7, 3, 2], [7, 5, 3],
    [7, 6, 3], [7, 9, 3], [9, 0, 2], [9, 4, 1],
  ]),
  levelDefinition("storm-meridian", "雷云子午网", "storm", 10, [
    [1, 1, 3], [1, 4, 4], [1, 6, 5], [1, 7, 5], [1, 8, 3], [2, 8, 2], [3, 7, 2],
    [4, 1, 3], [4, 8, 2], [4, 9, 2], [5, 0, 3], [5, 1, 4], [5, 3, 1], [5, 6, 3],
    [6, 4, 1], [6, 9, 2], [7, 9, 3], [8, 0, 3], [8, 2, 2], [8, 5, 1], [8, 6, 3],
    [8, 7, 4], [8, 9, 5], [9, 2, 3], [9, 9, 3],
  ]),
];

export const LEVELS = Object.freeze(LEVEL_DEFINITIONS.map(createPuzzle));

export function levelsForDifficulty(difficulty) {
  return LEVELS.filter((level) => level.difficulty === difficulty);
}

export function findLevel(levelId) {
  return LEVELS.find(({ id }) => id === levelId) ?? null;
}
