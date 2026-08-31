/**
 * Star Drift / Inertia rules engine.
 *
 * The engine is deliberately UI-free and immutable: every successful move
 * returns a new game value, while a blocked/terminal move returns the original
 * value. Coordinates are zero based, with x increasing right and y increasing
 * down.
 */

export const SAVE_SCHEMA = "star-drift/inertia";
export const SAVE_VERSION = 1;

export const TILES = Object.freeze({
  WALL: "#",
  FLOOR: ".",
  START: "@",
  STOP: "o",
  ENERGY: "e",
  MINE: "x",
});

export const STATUS = Object.freeze({
  PLAYING: "playing",
  WON: "won",
  LOST: "lost",
});

export const DIFFICULTIES = Object.freeze({
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
});

export const DIRECTION_VECTORS = Object.freeze({
  N: Object.freeze({ dx: 0, dy: -1 }),
  NE: Object.freeze({ dx: 1, dy: -1 }),
  E: Object.freeze({ dx: 1, dy: 0 }),
  SE: Object.freeze({ dx: 1, dy: 1 }),
  S: Object.freeze({ dx: 0, dy: 1 }),
  SW: Object.freeze({ dx: -1, dy: 1 }),
  W: Object.freeze({ dx: -1, dy: 0 }),
  NW: Object.freeze({ dx: -1, dy: -1 }),
});

export const DIRECTIONS = Object.freeze(Object.keys(DIRECTION_VECTORS));

const DIRECTION_ALIASES = Object.freeze({
  NORTH: "N",
  UP: "N",
  NORTHEAST: "NE",
  "NORTH-EAST": "NE",
  UPRIGHT: "NE",
  "UP-RIGHT": "NE",
  EAST: "E",
  RIGHT: "E",
  SOUTHEAST: "SE",
  "SOUTH-EAST": "SE",
  DOWNRIGHT: "SE",
  "DOWN-RIGHT": "SE",
  SOUTH: "S",
  DOWN: "S",
  SOUTHWEST: "SW",
  "SOUTH-WEST": "SW",
  DOWNLEFT: "SW",
  "DOWN-LEFT": "SW",
  WEST: "W",
  LEFT: "W",
  NORTHWEST: "NW",
  "NORTH-WEST": "NW",
  UPLEFT: "NW",
  "UP-LEFT": "NW",
});

const ALLOWED_TILES = new Set(Object.values(TILES));
const VALID_DIFFICULTIES = new Set(Object.values(DIFFICULTIES));

function positionKey(position) {
  return `${position.x},${position.y}`;
}

function keyToPosition(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function samePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function clonePosition(position) {
  return { x: position.x, y: position.y };
}

function cloneLastMove(lastMove) {
  if (!lastMove) return null;
  return {
    ...lastMove,
    from: clonePosition(lastMove.from),
    to: clonePosition(lastMove.to),
    path: lastMove.path.map(clonePosition),
    collected: lastMove.collected.map(clonePosition),
  };
}

/** Normalize a direction name or unit vector to one of N/NE/E/SE/S/SW/W/NW. */
export function normalizeDirection(direction) {
  if (typeof direction === "string") {
    const compact = direction.trim().toUpperCase().replace(/[ _]+/g, "");
    if (DIRECTION_VECTORS[compact]) return compact;
    if (DIRECTION_ALIASES[compact]) return DIRECTION_ALIASES[compact];
    return null;
  }

  let dx;
  let dy;
  if (Array.isArray(direction) && direction.length === 2) {
    [dx, dy] = direction;
  } else if (direction && typeof direction === "object") {
    ({ dx, dy } = direction);
  }

  if (!Number.isInteger(dx) || !Number.isInteger(dy)) return null;
  if (dx < -1 || dx > 1 || dy < -1 || dy > 1 || (dx === 0 && dy === 0)) {
    return null;
  }

  return DIRECTIONS.find((name) => {
    const vector = DIRECTION_VECTORS[name];
    return vector.dx === dx && vector.dy === dy;
  }) ?? null;
}

/**
 * Compile and validate a level definition. The returned object is deeply
 * immutable enough to share between all game states.
 */
export function createLevel(definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("Level definition must be an object.");
  }

  const { id, name, difficulty, par, grid } = definition;
  if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) {
    throw new TypeError("Level id must contain only lowercase letters, numbers, and hyphens.");
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new TypeError("Level name must be a non-empty string.");
  }
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    throw new RangeError(`Unknown level difficulty: ${difficulty}`);
  }
  if (!Number.isInteger(par) || par < 1) {
    throw new RangeError("Level par must be a positive integer.");
  }
  if (!Array.isArray(grid) || grid.length < 3 || grid.some((row) => typeof row !== "string")) {
    throw new TypeError("Level grid must be an array of at least three strings.");
  }

  const width = grid[0].length;
  if (width < 3 || grid.some((row) => row.length !== width)) {
    throw new RangeError("Every grid row must have the same width of at least three cells.");
  }

  const starts = [];
  const energy = [];
  const mines = [];
  const stops = [];
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = grid[y][x];
      if (!ALLOWED_TILES.has(tile)) {
        throw new RangeError(`Unknown tile ${JSON.stringify(tile)} at (${x}, ${y}).`);
      }
      const target = tile === TILES.START
        ? starts
        : tile === TILES.ENERGY
          ? energy
          : tile === TILES.MINE
            ? mines
            : tile === TILES.STOP
              ? stops
              : null;
      if (target) target.push(Object.freeze({ x, y }));
    }
  }

  if (starts.length !== 1) throw new RangeError("A level must contain exactly one @ start cell.");
  if (energy.length === 0) throw new RangeError("A level must contain at least one e energy cell.");

  return Object.freeze({
    id,
    name: name.trim(),
    difficulty,
    difficultyLabel: typeof definition.difficultyLabel === "string"
      ? definition.difficultyLabel
      : difficulty,
    briefing: typeof definition.briefing === "string" ? definition.briefing : "",
    par,
    width,
    height: grid.length,
    grid: Object.freeze([...grid]),
    start: starts[0],
    energy: Object.freeze(energy),
    mines: Object.freeze(mines),
    // START is an encoded stop tile in Inertia's level format. Exposing it in
    // stops as well as through tileAt keeps renderers and rule consumers in
    // agreement after the craft has moved away from its initial position.
    stops: Object.freeze([...stops, starts[0]]),
  });
}

const RAW_LEVELS = [
  {
    id: "blue-dock",
    name: "蓝港校准",
    difficulty: DIFFICULTIES.EASY,
    difficultyLabel: "巡航 · 近地",
    briefing: "在四面舱壁间校准推进器，别把对角线当成刹车。",
    par: 3,
    grid: [
      "#######",
      "#@...e#",
      "#..o..#",
      "#..x..#",
      "#.....#",
      "#e...e#",
      "#######",
    ],
  },
  {
    id: "relay-lane",
    name: "中继航道",
    difficulty: DIFFICULTIES.EASY,
    difficultyLabel: "巡航 · 近地",
    briefing: "利用引力锚改线，回收散落在旧中继站边缘的能源芯。",
    par: 3,
    grid: [
      "########",
      "#@..e..#",
      "#......#",
      "#..#x..#",
      "#..o...#",
      "#e...e.#",
      "########",
    ],
  },
  {
    id: "cold-ring",
    name: "冷环试航",
    difficulty: DIFFICULTIES.EASY,
    difficultyLabel: "巡航 · 近地",
    briefing: "沿冷却环外缘滑行；中央反应堆仍在低功率失稳。",
    par: 3,
    grid: [
      "########",
      "#e....e#",
      "#......#",
      "#..xo..#",
      "#......#",
      "#@..e..#",
      "########",
    ],
  },
  {
    id: "broken-spindle",
    name: "断轴回收",
    difficulty: DIFFICULTIES.MEDIUM,
    difficultyLabel: "深空 · 漂移",
    briefing: "断裂桁架改变了每条制动线，先找到安全的停靠序列。",
    par: 4,
    grid: [
      "#########",
      "#e..#..e#",
      "#...o...#",
      "#.#...#.#",
      "#..x.x..#",
      "#...#...#",
      "#e..o...#",
      "#..@...e#",
      "#########",
    ],
  },
  {
    id: "violet-crossing",
    name: "紫电交叉口",
    difficulty: DIFFICULTIES.MEDIUM,
    difficultyLabel: "深空 · 漂移",
    briefing: "废弃电网仍在放电；引力锚只会停船，不会替你选路。",
    par: 8,
    grid: [
      "##########",
      "#e...#...#",
      "#..x...e.#",
      "#....o...#",
      "##..#....#",
      "#e....x..#",
      "#..o.....#",
      "#....#...#",
      "#@......e#",
      "##########",
    ],
  },
  {
    id: "silent-array",
    name: "静默阵列",
    difficulty: DIFFICULTIES.MEDIUM,
    difficultyLabel: "深空 · 漂移",
    briefing: "传感器阵列已经沉默，只剩几枚引力锚还回应你的信标。",
    par: 7,
    grid: [
      "##########",
      "#..e...#e#",
      "#.#...x..#",
      "#...o....#",
      "#x....#..#",
      "#..#.....#",
      "#e...o...#",
      "#....x...#",
      "#@.....e.#",
      "##########",
    ],
  },
  {
    id: "reactor-veil",
    name: "反应堆帷幕",
    difficulty: DIFFICULTIES.HARD,
    difficultyLabel: "禁区 · 临界",
    briefing: "多座反应堆封住直线航道，安全路线藏在斜向缝隙里。",
    par: 10,
    grid: [
      "###########",
      "#e...#....#",
      "#..x...#e.#",
      "#.#..o....#",
      "#...x...#.#",
      "##....#...#",
      "#e.o....x.#",
      "#...#.....#",
      "#.x....o.e#",
      "#@...#...e#",
      "###########",
    ],
  },
  {
    id: "ghost-foundry",
    name: "幽灵铸造带",
    difficulty: DIFFICULTIES.HARD,
    difficultyLabel: "禁区 · 临界",
    briefing: "铸造带的残余热源会伪装成航标；每次停靠都要给下一步留路。",
    par: 10,
    grid: [
      "############",
      "#e....#....#",
      "#..x....e#.#",
      "#.#..o.....#",
      "#....#..x..#",
      "##.e....#..#",
      "#...x......#",
      "#..#...o...#",
      "#e....#..x.#",
      "#...o.....e#",
      "#@....#....#",
      "############",
    ],
  },
  {
    id: "event-horizon",
    name: "事件视界仓",
    difficulty: DIFFICULTIES.HARD,
    difficultyLabel: "禁区 · 临界",
    briefing: "最后一片残骸云正在坍缩；规划整条回收链，再点燃推进器。",
    par: 9,
    grid: [
      "############",
      "#e..#.....e#",
      "#..x...#...#",
      "#....o...x.#",
      "##.#....#..#",
      "#e...x.....#",
      "#..#...o...#",
      "#....#....e#",
      "#.x....#...#",
      "#e..o....x.#",
      "#@.....#..e#",
      "############",
    ],
  },
];

export const LEVELS = Object.freeze(RAW_LEVELS.map(createLevel));
export const LEVELS_BY_ID = Object.freeze(Object.fromEntries(LEVELS.map((level) => [level.id, level])));

/** Resolve a built-in level id or validate an ad-hoc level definition. */
export function getLevel(levelOrId) {
  if (typeof levelOrId === "string") return LEVELS_BY_ID[levelOrId] ?? null;
  if (LEVELS.includes(levelOrId)) return levelOrId;
  if (levelOrId && typeof levelOrId === "object") return createLevel(levelOrId);
  return null;
}

export function tileAt(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return TILES.WALL;
  const tile = level.grid[y][x];
  // In the original Inertia new-game loader, START is converted into a STOP.
  // The craft may leave it normally, but entering the start cell again must
  // stop the current slide exactly like any other gravity anchor.
  return tile === TILES.START ? TILES.STOP : tile;
}

function requireLevel(levelOrId) {
  const level = getLevel(levelOrId);
  if (!level) throw new RangeError(`Unknown level: ${String(levelOrId)}`);
  return level;
}

/** Create a fresh game. */
export function createGame(levelOrId = LEVELS[0]) {
  const level = requireLevel(levelOrId);
  return {
    level,
    levelId: level.id,
    position: clonePosition(level.start),
    remainingEnergy: level.energy.map(positionKey),
    collected: 0,
    totalEnergy: level.energy.length,
    moves: 0,
    status: STATUS.PLAYING,
    history: [],
    moveLog: [],
    lastMove: null,
  };
}

function snapshot(game) {
  return {
    position: clonePosition(game.position),
    remainingEnergy: [...game.remainingEnergy],
    collected: game.collected,
    moves: game.moves,
    status: game.status,
    lastMove: cloneLastMove(game.lastMove),
  };
}

function blockedResult(game, direction, stopReason) {
  return {
    state: game,
    moved: false,
    direction,
    path: [],
    collected: [],
    stopReason,
    status: game.status,
  };
}

/**
 * Attempt one Inertia move. Only the cell directly ahead is tested for a wall;
 * diagonal movement intentionally ignores the two orthogonal corner cells.
 */
export function attemptMove(game, requestedDirection) {
  const direction = normalizeDirection(requestedDirection);
  if (!direction) throw new RangeError(`Invalid direction: ${String(requestedDirection)}`);
  if (!game || typeof game !== "object" || !game.level) {
    throw new TypeError("attemptMove requires a game created by createGame().");
  }
  if (game.status !== STATUS.PLAYING) return blockedResult(game, direction, "terminal");

  const vector = DIRECTION_VECTORS[direction];
  const path = [];
  const collected = [];
  const remaining = new Set(game.remainingEnergy);
  let position = clonePosition(game.position);
  let stopReason = "wall";
  let status = STATUS.PLAYING;

  // Every finite grid is surrounded by an implicit wall, so this terminates
  // even for ad-hoc levels whose visible border contains floor cells.
  while (true) {
    const next = { x: position.x + vector.dx, y: position.y + vector.dy };
    const tile = tileAt(game.level, next.x, next.y);
    if (tile === TILES.WALL) break;

    position = next;
    path.push(clonePosition(position));

    const key = positionKey(position);
    if (tile === TILES.ENERGY && remaining.delete(key)) collected.push(clonePosition(position));

    // A mine always wins the precedence contest. In particular, an energy
    // collected earlier on this same path remains collected for the fatal
    // animation, but an empty remaining set does not turn the result into win.
    if (tile === TILES.MINE) {
      status = STATUS.LOST;
      stopReason = "mine";
      break;
    }
    if (tile === TILES.STOP) {
      stopReason = "stop";
      break;
    }
  }

  if (path.length === 0) return blockedResult(game, direction, "blocked");
  if (status !== STATUS.LOST && remaining.size === 0) status = STATUS.WON;

  const lastMove = {
    direction,
    from: clonePosition(game.position),
    to: clonePosition(position),
    path: path.map(clonePosition),
    collected: collected.map(clonePosition),
    stopReason,
    status,
  };
  const state = {
    ...game,
    position,
    remainingEnergy: game.remainingEnergy.filter((key) => remaining.has(key)),
    collected: game.collected + collected.length,
    moves: game.moves + 1,
    status,
    history: [...game.history, snapshot(game)],
    moveLog: [...game.moveLog, direction],
    lastMove,
  };

  return {
    state,
    moved: true,
    direction,
    path: lastMove.path.map(clonePosition),
    collected: lastMove.collected.map(clonePosition),
    stopReason,
    status,
  };
}

/** Convenience wrapper returning only the next immutable state. */
export function move(game, direction) {
  return attemptMove(game, direction).state;
}

/** Undo one successful move, including a fatal or winning move. */
export function undoMove(game) {
  if (!game || typeof game !== "object" || !Array.isArray(game.history)) {
    throw new TypeError("undoMove requires a game created by createGame().");
  }
  if (game.history.length === 0) return { state: game, undone: false };

  const prior = game.history[game.history.length - 1];
  return {
    state: {
      ...game,
      position: clonePosition(prior.position),
      remainingEnergy: [...prior.remainingEnergy],
      collected: prior.collected,
      moves: prior.moves,
      status: prior.status,
      history: game.history.slice(0, -1),
      moveLog: game.moveLog.slice(0, -1),
      lastMove: cloneLastMove(prior.lastMove),
    },
    undone: true,
  };
}

/** Convenience wrapper returning only the undone state. */
export function undo(game) {
  return undoMove(game).state;
}

export function restart(gameOrLevel = LEVELS[0]) {
  const level = gameOrLevel?.level ?? gameOrLevel;
  return createGame(level);
}

/** Directions that leave the current cell. They may still lead to a mine. */
export function getLegalMoves(game) {
  if (game.status !== STATUS.PLAYING) return [];
  return DIRECTIONS.filter((direction) => {
    const vector = DIRECTION_VECTORS[direction];
    return tileAt(
      game.level,
      game.position.x + vector.dx,
      game.position.y + vector.dy,
    ) !== TILES.WALL;
  });
}

function solverKey(game) {
  return `${positionKey(game.position)}|${[...game.remainingEnergy].sort().join(";")}`;
}

/**
 * Breadth-first proof-of-solvability. Returns a shortest direction array, or
 * null when no solution is found within maxStates.
 */
export function solveLevel(levelOrId, options = {}) {
  const level = requireLevel(levelOrId);
  const maxStates = options.maxStates ?? 250_000;
  if (!Number.isInteger(maxStates) || maxStates < 1) {
    throw new RangeError("maxStates must be a positive integer.");
  }

  const initial = createGame(level);
  const queue = [{ game: initial, solution: [] }];
  const visited = new Set([solverKey(initial)]);
  let cursor = 0;

  while (cursor < queue.length && visited.size <= maxStates) {
    const current = queue[cursor];
    cursor += 1;

    for (const direction of getLegalMoves(current.game)) {
      const result = attemptMove(current.game, direction);
      if (!result.moved || result.status === STATUS.LOST) continue;
      const solution = [...current.solution, direction];
      if (result.status === STATUS.WON) return solution;

      const key = solverKey(result.state);
      if (visited.has(key)) continue;
      visited.add(key);
      if (visited.size > maxStates) break;

      // Solver history is not needed to determine future moves. Removing it
      // prevents path length from multiplying memory use on larger boards.
      queue.push({
        game: { ...result.state, history: [], moveLog: [] },
        solution,
      });
    }
  }

  return null;
}

/** Validate structure and prove that at least one non-fatal solution exists. */
export function validateLevel(levelOrDefinition, options = {}) {
  try {
    const level = requireLevel(levelOrDefinition);
    const solution = solveLevel(level, options);
    if (!solution) {
      return { valid: false, level, solution: null, errors: ["Level has no proven solution."] };
    }
    return { valid: true, level, solution, errors: [] };
  } catch (error) {
    return {
      valid: false,
      level: null,
      solution: null,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function equivalentState(a, b) {
  return a.levelId === b.levelId
    && samePosition(a.position, b.position)
    && a.status === b.status
    && a.moves === b.moves
    && a.collected === b.collected
    && a.remainingEnergy.length === b.remainingEnergy.length
    && a.remainingEnergy.every((key, index) => key === b.remainingEnergy[index]);
}

/**
 * Save only an authenticated-by-replay move log. restoreGame reconstructs all
 * derived data and the undo stack instead of trusting arbitrary saved state.
 */
export function serializeGame(game) {
  if (!game || typeof game !== "object" || !LEVELS_BY_ID[game.levelId]) {
    throw new TypeError("Only games using a built-in level can be saved.");
  }
  const replayed = replayMoves(game.levelId, game.moveLog);
  if (!replayed || !equivalentState(game, replayed)) {
    throw new TypeError("Cannot save an inconsistent game state.");
  }
  return JSON.stringify({
    schema: SAVE_SCHEMA,
    version: SAVE_VERSION,
    levelId: game.levelId,
    moveLog: [...game.moveLog],
  });
}

function replayMoves(levelOrId, directions) {
  if (!Array.isArray(directions)) return null;
  let game;
  try {
    game = createGame(levelOrId);
    for (const requestedDirection of directions) {
      const direction = normalizeDirection(requestedDirection);
      // Saved commands must already use the canonical spelling. This rejects
      // ambiguous/old formats rather than silently migrating them.
      if (!direction || direction !== requestedDirection) return null;
      const result = attemptMove(game, direction);
      if (!result.moved) return null;
      game = result.state;
    }
  } catch {
    return null;
  }
  return game;
}

/** Restore a current-version save, or return null for malformed/old data. */
export function restoreGame(serialized, expectedLevelOrId = null) {
  let payload;
  try {
    payload = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const keys = Object.keys(payload).sort();
  const expectedKeys = ["levelId", "moveLog", "schema", "version"].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    return null;
  }
  if (payload.schema !== SAVE_SCHEMA || payload.version !== SAVE_VERSION) return null;
  if (typeof payload.levelId !== "string" || !LEVELS_BY_ID[payload.levelId]) return null;

  if (expectedLevelOrId !== null) {
    let expected;
    try {
      expected = getLevel(expectedLevelOrId);
    } catch {
      return null;
    }
    if (!expected || expected.id !== payload.levelId) return null;
  }

  return replayMoves(payload.levelId, payload.moveLog);
}

/** Small helpers useful to a renderer without exposing engine internals. */
export function remainingEnergyPositions(game) {
  return game.remainingEnergy.map(keyToPosition);
}

export function isWon(game) {
  return game.status === STATUS.WON;
}

export function isLost(game) {
  return game.status === STATUS.LOST;
}
