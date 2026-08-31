export const BOARD_SIZE = 4;

export const FACE_IDS = Object.freeze(["sun", "tide", "seed", "wing", "eye", "echo"]);
export const POSITIONS = Object.freeze(["top", "bottom", "north", "south", "east", "west"]);

export const DIRECTIONS = Object.freeze({
  north: Object.freeze({ dx: 0, dy: -1, opposite: "south" }),
  east: Object.freeze({ dx: 1, dy: 0, opposite: "west" }),
  south: Object.freeze({ dx: 0, dy: 1, opposite: "north" }),
  west: Object.freeze({ dx: -1, dy: 0, opposite: "east" }),
});

export const CANONICAL_ORIENTATION = Object.freeze({
  top: "sun",
  bottom: "echo",
  north: "tide",
  south: "wing",
  east: "seed",
  west: "eye",
});

const TOKEN_IDS = Object.freeze(FACE_IDS.map((face) => `memory-${face}`));

function cloneRecord(record) {
  return Object.fromEntries(Object.entries(record));
}

export function boardIndex(x, y, size = BOARD_SIZE) {
  return y * size + x;
}

export function inBounds(position, size = BOARD_SIZE) {
  return Number.isInteger(position?.x)
    && Number.isInteger(position?.y)
    && position.x >= 0
    && position.y >= 0
    && position.x < size
    && position.y < size;
}

export function cloneState(state) {
  return {
    size: state.size,
    board: [...state.board],
    faceTokens: cloneRecord(state.faceTokens),
    orientation: cloneRecord(state.orientation),
    position: { ...state.position },
    moves: state.moves,
  };
}

export function rollOrientation(orientation, direction) {
  const current = cloneRecord(orientation);

  switch (direction) {
    case "north":
      return {
        ...current,
        top: current.south,
        bottom: current.north,
        north: current.top,
        south: current.bottom,
      };
    case "south":
      return {
        ...current,
        top: current.north,
        bottom: current.south,
        north: current.bottom,
        south: current.top,
      };
    case "east":
      return {
        ...current,
        top: current.west,
        bottom: current.east,
        east: current.top,
        west: current.bottom,
      };
    case "west":
      return {
        ...current,
        top: current.east,
        bottom: current.west,
        east: current.bottom,
        west: current.top,
      };
    default:
      throw new TypeError(`Unknown direction: ${direction}`);
  }
}

function orientationKey(orientation) {
  return POSITIONS.map((position) => orientation[position]).join("|");
}

function createReachableOrientationKeys() {
  const pending = [CANONICAL_ORIENTATION];
  const reachable = new Set([orientationKey(CANONICAL_ORIENTATION)]);

  for (let index = 0; index < pending.length; index += 1) {
    const orientation = pending[index];
    for (const direction of Object.keys(DIRECTIONS)) {
      const next = rollOrientation(orientation, direction);
      const key = orientationKey(next);
      if (reachable.has(key)) continue;
      reachable.add(key);
      pending.push(next);
    }
  }

  if (reachable.size !== 24) throw new Error("Cube orientation graph must contain exactly 24 states");
  return reachable;
}

const REACHABLE_ORIENTATION_KEYS = createReachableOrientationKeys();

export function legalDirections(state) {
  return Object.entries(DIRECTIONS)
    .filter(([, delta]) => inBounds({
      x: state.position.x + delta.dx,
      y: state.position.y + delta.dy,
    }, state.size))
    .map(([direction]) => direction);
}

/**
 * Roll to an adjacent square, then exchange the landing face's token with
 * the token on that square. Invalid edge moves return the original state.
 */
export function applyMove(state, direction) {
  const delta = DIRECTIONS[direction];
  if (!delta) throw new TypeError(`Unknown direction: ${direction}`);

  const destination = {
    x: state.position.x + delta.dx,
    y: state.position.y + delta.dy,
  };

  if (!inBounds(destination, state.size)) {
    return { state, moved: false, exchange: null };
  }

  const next = cloneState(state);
  next.position = destination;
  next.orientation = rollOrientation(state.orientation, direction);
  next.moves += 1;

  const face = next.orientation.bottom;
  const index = boardIndex(destination.x, destination.y, next.size);
  const tileToken = next.board[index];
  const faceToken = next.faceTokens[face];
  const changed = Boolean(tileToken) !== Boolean(faceToken);
  if (changed) {
    next.faceTokens[face] = tileToken;
    next.board[index] = faceToken;
  }

  return {
    state: next,
    moved: true,
    exchange: Object.freeze({
      face,
      pickedUp: tileToken,
      pressedDown: faceToken,
      changed,
      index,
    }),
  };
}

/**
 * Construct the predecessor of a state for puzzle generation. `backDirection`
 * is the direction travelled while rewinding; the corresponding forward move
 * is its opposite. This is the exact inverse of applyMove for that forward move.
 */
export function rewindMove(state, backDirection) {
  const delta = DIRECTIONS[backDirection];
  if (!delta) throw new TypeError(`Unknown direction: ${backDirection}`);

  const predecessorPosition = {
    x: state.position.x + delta.dx,
    y: state.position.y + delta.dy,
  };
  if (!inBounds(predecessorPosition, state.size)) {
    return { state, moved: false, forwardDirection: null };
  }

  const predecessor = cloneState(state);
  const landingIndex = boardIndex(state.position.x, state.position.y, state.size);
  const landingFace = state.orientation.bottom;
  const tileToken = predecessor.board[landingIndex];
  const faceToken = predecessor.faceTokens[landingFace];
  if (Boolean(tileToken) !== Boolean(faceToken)) {
    predecessor.board[landingIndex] = faceToken;
    predecessor.faceTokens[landingFace] = tileToken;
  }
  predecessor.position = predecessorPosition;
  predecessor.orientation = rollOrientation(state.orientation, backDirection);
  predecessor.moves = Math.max(0, state.moves - 1);

  return {
    state: predecessor,
    moved: true,
    forwardDirection: delta.opposite,
  };
}

export function countAwakeFaces(state) {
  return FACE_IDS.reduce((count, face) => count + Number(Boolean(state.faceTokens[face])), 0);
}

export function countGroundTokens(state) {
  return state.board.reduce((count, token) => count + Number(Boolean(token)), 0);
}

export function isWon(state) {
  return countAwakeFaces(state) === FACE_IDS.length && countGroundTokens(state) === 0;
}

export function createSolvedState(position = { x: 1, y: 1 }) {
  if (!inBounds(position, BOARD_SIZE)) throw new RangeError("Solved position is outside the board");
  return {
    size: BOARD_SIZE,
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    faceTokens: Object.fromEntries(FACE_IDS.map((face, index) => [face, TOKEN_IDS[index]])),
    orientation: cloneRecord(CANONICAL_ORIENTATION),
    position: { ...position },
    moves: 0,
  };
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function randomItem(items, random) {
  return items[Math.floor(random() * items.length)];
}

function stateKey(state) {
  return [
    state.position.x,
    state.position.y,
    ...POSITIONS.map((position) => state.orientation[position]),
    ...FACE_IDS.map((face) => state.faceTokens[face] ?? "-"),
    ...state.board.map((token) => token ?? "-"),
  ].join("|");
}

function potentialDepositScore(state) {
  const index = boardIndex(state.position.x, state.position.y, state.size);
  const bottomToken = state.faceTokens[state.orientation.bottom];
  const tileToken = state.board[index];
  if (bottomToken && !tileToken) return 8;
  if (!bottomToken && tileToken) return -6;
  return 0;
}

/**
 * Rewinds from a solved state until all six tokens are on the 4x4 floor.
 * Replaying `solution` therefore always restores all six cube faces.
 */
export function createPuzzle(seed = Date.now()) {
  const normalizedSeed = Number.isFinite(seed) ? seed >>> 0 : 1;
  const random = mulberry32(normalizedSeed || 1);

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const goalPosition = {
      x: Math.floor(random() * BOARD_SIZE),
      y: Math.floor(random() * BOARD_SIZE),
    };
    let state = createSolvedState(goalPosition);
    const forwardMoves = [];
    const visited = new Map([[stateKey(state), 1]]);
    let previousBackDirection = null;

    for (let step = 0; step < 360; step += 1) {
      const candidates = legalDirections(state).map((backDirection) => {
        const rewound = rewindMove(state, backDirection);
        const repeats = visited.get(stateKey(rewound.state)) ?? 0;
        let weight = 12 + potentialDepositScore(rewound.state) - repeats * 4;
        if (DIRECTIONS[backDirection].opposite === previousBackDirection) weight -= 2;
        weight = Math.max(1, weight);
        return { ...rewound, backDirection, weight };
      });

      const pool = candidates.flatMap((candidate) => Array(candidate.weight).fill(candidate));
      const chosen = randomItem(pool, random);
      state = chosen.state;
      state.moves = 0;
      forwardMoves.unshift(chosen.forwardDirection);
      previousBackDirection = chosen.backDirection;
      const key = stateKey(state);
      visited.set(key, (visited.get(key) ?? 0) + 1);

      const cubeTile = state.board[boardIndex(state.position.x, state.position.y, state.size)];
      if (countAwakeFaces(state) === 0 && !cubeTile && forwardMoves.length >= 30) {
        return {
          seed: normalizedSeed,
          initial: state,
          solution: forwardMoves,
          referenceMoves: forwardMoves.length,
        };
      }
    }
  }

  // A deterministic fallback seed is kept inside the same reverse-generation
  // algorithm so a hostile or stubbed RNG can never yield an unsolvable game.
  if (normalizedSeed !== 0x41524b) return createPuzzle(0x41524b);
  throw new Error("Unable to generate a solvable memory-ark puzzle");
}

export function validateState(state) {
  if (!state || state.size !== BOARD_SIZE || !Array.isArray(state.board)) return false;
  if (state.board.length !== BOARD_SIZE * BOARD_SIZE || !inBounds(state.position, state.size)) return false;
  if (!Number.isInteger(state.moves) || state.moves < 0) return false;

  const orientationFaces = POSITIONS.map((position) => state.orientation?.[position]);
  if (new Set(orientationFaces).size !== FACE_IDS.length) return false;
  if (orientationFaces.some((face) => !FACE_IDS.includes(face))) return false;
  if (!REACHABLE_ORIENTATION_KEYS.has(orientationKey(state.orientation))) return false;
  if (FACE_IDS.some((face) => !(face in (state.faceTokens ?? {})))) return false;

  const tokens = [
    ...state.board.filter(Boolean),
    ...FACE_IDS.map((face) => state.faceTokens[face]).filter(Boolean),
  ];
  return tokens.length === TOKEN_IDS.length
    && new Set(tokens).size === TOKEN_IDS.length
    && tokens.every((token) => TOKEN_IDS.includes(token));
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(serialized) {
  try {
    const state = JSON.parse(serialized);
    return validateState(state) ? state : null;
  } catch {
    return null;
  }
}
