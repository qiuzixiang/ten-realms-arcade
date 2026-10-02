/**
 * Star Drift / Inertia rules engine.
 *
 * The engine is deliberately UI-free and immutable: every successful move
 * returns a new game value, while a blocked/terminal move returns the original
 * value. Coordinates are zero based, with x increasing right and y increasing
 * down.
 */

export const SAVE_SCHEMA = "star-drift-standalone/inertia";
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

export const VECTORS = Object.freeze({
  N: Object.freeze({ dx: 0, dy: -1 }),
  NE: Object.freeze({ dx: 1, dy: -1 }),
  E: Object.freeze({ dx: 1, dy: 0 }),
  SE: Object.freeze({ dx: 1, dy: 1 }),
  S: Object.freeze({ dx: 0, dy: 1 }),
  SW: Object.freeze({ dx: -1, dy: 1 }),
  W: Object.freeze({ dx: -1, dy: 0 }),
  NW: Object.freeze({ dx: -1, dy: -1 }),
});

export const DIRECTIONS = Object.freeze(Object.keys(VECTORS));

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
    if (VECTORS[compact]) return compact;
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
    const vector = VECTORS[name];
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
    ...definition,
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

export function tileAt(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return TILES.WALL;
  const tile = level.grid[y][x];
  // In the original Inertia new-game loader, START is converted into a STOP.
  // The craft may leave it normally, but entering the start cell again must
  // stop the current slide exactly like any other gravity anchor.
  return tile === TILES.START ? TILES.STOP : tile;
}

function requireLevel(levelOrId) {
  const level = createLevel(levelOrId);
  if (!level) throw new RangeError(`Unknown level: ${String(levelOrId)}`);
  return level;
}

/** Create a fresh game. */
export function createGame(levelOrId) {
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
  if (!direction) return blockedResult(game, null, "invalid");
  if (!game || typeof game !== "object" || !game.level) {
    throw new TypeError("attemptMove requires a game created by createGame().");
  }
  if (game.status !== STATUS.PLAYING) return blockedResult(game, direction, "terminal");

  const vector = VECTORS[direction];
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

export function restart(gameOrLevel) {
  const level = gameOrLevel?.level ?? gameOrLevel;
  return createGame(level);
}

/** Directions that leave the current cell. They may still lead to a mine. */
export function getLegalMoves(game) {
  if (game.status !== STATUS.PLAYING) return [];
  return DIRECTIONS.filter((direction) => {
    const vector = VECTORS[direction];
    return tileAt(
      game.level,
      game.position.x + vector.dx,
      game.position.y + vector.dy,
    ) !== TILES.WALL;
  });
}


// The solver compiles geometry once, then searches position × remaining-energy.
// Collected crystals stay floor: only the bitset changes during the search.
const transitionCache = new WeakMap();
function compileTransitions(level) {
  if (transitionCache.has(level)) return transitionCache.get(level);
  const energyIndex = new Map(level.energy.map((p, i) => [positionKey(p), i]));
  if (level.energy.length > 20) throw new RangeError('Solver supports up to 20 energy cells.');
  const transitions = Array.from({ length: level.width * level.height }, () => []);
  for (let y = 0; y < level.height; y++) for (let x = 0; x < level.width; x++) {
    if (tileAt(level, x, y) === '#') continue;
    for (const direction of DIRECTIONS) {
      const { dx, dy } = VECTORS[direction];
      let px = x, py = y, mask = 0, dead = false;
      while (true) {
        const nx = px + dx, ny = py + dy;
        const tile = tileAt(level, nx, ny);
        if (tile === '#') break;
        px = nx; py = ny;
        const bit = energyIndex.get(`${px},${py}`);
        if (bit !== undefined) mask |= 1 << bit;
        if (tile === 'x') { dead = true; break; }
        if (tile === 'o') break;
      }
      if (!dead && (px !== x || py !== y)) {
        transitions[y * level.width + x].push({ direction, pos: py * level.width + px, mask });
      }
    }
  }
  const compiled = { transitions, energyIndex };
  transitionCache.set(level, compiled);
  return compiled;
}

/** Breadth-first search: every edge costs one actual, non-blocked slide.
 * A returned path is provably shortest from the supplied state. A null path
 * with exhausted:true means the budget was hit; it does not prove impossible.
 */
export function solve(gameOrLevel, { maxStates = 100_000 } = {}) {
  if (!Number.isInteger(maxStates) || maxStates < 1) throw new RangeError('maxStates must be a positive integer.');
  const game = gameOrLevel?.level ? gameOrLevel : createGame(gameOrLevel);
  if (game.status === STATUS.WON) return { path: [], visited: 1, exhausted: false };
  if (game.status === STATUS.LOST) return { path: null, visited: 0, exhausted: false };
  const { transitions, energyIndex } = compileTransitions(game.level);
  let startMask = 0;
  for (const key of game.remainingEnergy) {
    const bit = energyIndex.get(key);
    if (bit !== undefined) startMask |= 1 << bit;
  }
  if (startMask === 0) return { path: [], visited: 1, exhausted: false };
  const area = game.level.width * game.level.height;
  const startPos = game.position.y * game.level.width + game.position.x;
  const nodes = [{ pos: startPos, mask: startMask, parent: -1, direction: null }];
  const seen = new Set([startMask * area + startPos]);
  for (let head = 0; head < nodes.length; head++) {
    const node = nodes[head];
    for (const edge of transitions[node.pos]) {
      const mask = node.mask & ~edge.mask;
      if (mask === 0) {
        const path = [edge.direction];
        let cursor = head;
        while (nodes[cursor].parent !== -1) {
          path.push(nodes[cursor].direction);
          cursor = nodes[cursor].parent;
        }
        return { path: path.reverse(), visited: seen.size, exhausted: false };
      }
      const key = mask * area + edge.pos;
      if (seen.has(key)) continue;
      if (seen.size >= maxStates) return { path: null, visited: seen.size, exhausted: true };
      seen.add(key);
      nodes.push({ pos: edge.pos, mask, parent: head, direction: edge.direction });
    }
  }
  return { path: null, visited: seen.size, exhausted: false };
}

/** Canonical grid under the eight rotations/reflections, used for curation. */
export function geometryFingerprint(level) {
  let rows = level.grid.map(row => [...row]);
  const variants = [];
  for (let rotation = 0; rotation < 4; rotation++) {
    variants.push(rows.map(row => row.join('')).join('/'));
    variants.push(rows.map(row => [...row].reverse().join('')).join('/'));
    rows = rows[0].map((_, x) => rows.map(row => row[x]).reverse());
  }
  return variants.sort()[0];
}

export function replay(level, directions) {
  let game = createGame(level);
  for (const direction of directions) {
    const result = attemptMove(game, direction);
    if (!result.moved) throw new RangeError(`Replay contains a blocked or invalid action: ${direction}`);
    game = result.state;
  }
  return game;
}
