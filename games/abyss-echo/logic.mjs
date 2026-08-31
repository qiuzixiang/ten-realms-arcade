/**
 * Pure rule engine for 深海回声站 / Black Box.
 *
 * Ports are numbered clockwise: top (left to right), right (top to bottom),
 * bottom (right to left), then left (bottom to top).
 */

export const RESPONSE = Object.freeze({
  HIT: "hit",
  REFLECT: "reflect",
  EXIT: "exit",
});

function assertBoardSize(size) {
  if (!Number.isInteger(size) || size < 2) {
    throw new RangeError("Board size must be an integer of at least 2.");
  }
}

function assertPort(size, port) {
  if (!Number.isInteger(port) || port < 0 || port >= size * 4) {
    throw new RangeError("Port must be an integer on the board perimeter.");
  }
}

export function cellKey(x, y) {
  return String(x) + "," + String(y);
}

export function parseCellKey(key) {
  const parts = String(key).split(",");
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

function normaliseBalls(size, balls) {
  assertBoardSize(size);
  const set = new Set();

  for (const ball of balls ?? []) {
    let point;
    if (typeof ball === "string") point = parseCellKey(ball);
    else if (Array.isArray(ball) && ball.length >= 2) point = { x: ball[0], y: ball[1] };
    else if (ball && typeof ball === "object") point = { x: ball.x, y: ball.y };

    if (
      !point ||
      !Number.isInteger(point.x) ||
      !Number.isInteger(point.y) ||
      point.x < 0 ||
      point.x >= size ||
      point.y < 0 ||
      point.y >= size
    ) {
      throw new RangeError("Every energy body must occupy a valid board cell.");
    }

    const key = cellKey(point.x, point.y);
    if (set.has(key)) throw new Error("Energy body positions must be unique.");
    set.add(key);
  }

  return set;
}

export function portToRay(size, port) {
  assertBoardSize(size);
  assertPort(size, port);

  if (port < size) {
    return { x: port, y: -1, dx: 0, dy: 1, side: "top", offset: port };
  }
  if (port < size * 2) {
    const offset = port - size;
    return { x: size, y: offset, dx: -1, dy: 0, side: "right", offset };
  }
  if (port < size * 3) {
    const offset = port - size * 2;
    return { x: size - 1 - offset, y: size, dx: 0, dy: -1, side: "bottom", offset };
  }

  const offset = port - size * 3;
  return { x: -1, y: size - 1 - offset, dx: 1, dy: 0, side: "left", offset };
}

export function pointToPort(size, x, y) {
  assertBoardSize(size);
  if (y === -1 && x >= 0 && x < size) return x;
  if (x === size && y >= 0 && y < size) return size + y;
  if (y === size && x >= 0 && x < size) return size * 2 + (size - 1 - x);
  if (x === -1 && y >= 0 && y < size) return size * 3 + (size - 1 - y);
  throw new RangeError("Point is not a perimeter port.");
}

export function portToGridPoint(size, port) {
  const ray = portToRay(size, port);
  return { x: ray.x, y: ray.y };
}

function inBounds(size, x, y) {
  return x >= 0 && x < size && y >= 0 && y < size;
}

function contains(balls, x, y) {
  return balls.has(cellKey(x, y));
}

/**
 * Trace one complete Black Box ray.
 *
 * The returned path uses board coordinates. Perimeter points sit at -1 or size,
 * which lets the UI animate the exact route without participating in the rules.
 */
export function traceRay(size, balls, entryPort) {
  assertBoardSize(size);
  assertPort(size, entryPort);
  const occupied = normaliseBalls(size, balls);
  const start = portToRay(size, entryPort);
  let { x, y, dx, dy } = start;
  const path = [{ x, y }];
  const seen = new Set();
  let entered = false;

  // A ray is reversible, so a boundary-connected route cannot form a closed
  // cycle. The visited-state guard protects callers from accidental regressions.
  for (let step = 0; step < size * size * 32 + 64; step += 1) {
    const stateKey = [x, y, dx, dy].join(":");
    if (seen.has(stateKey)) throw new Error("Ray entered an impossible cycle.");
    seen.add(stateKey);

    const frontX = x + dx;
    const frontY = y + dy;

    // Direct impact always has priority over diagonal field effects.
    if (inBounds(size, frontX, frontY) && contains(occupied, frontX, frontY)) {
      path.push({ x: frontX, y: frontY });
      return { kind: RESPONSE.HIT, entry: entryPort, path };
    }

    // In screen coordinates (positive y points down), these are the cells one
    // step forward and one step to the ray's left/right.
    const leftX = frontX + dy;
    const leftY = frontY - dx;
    const rightX = frontX - dy;
    const rightY = frontY + dx;
    const leftOccupied = inBounds(size, leftX, leftY) && contains(occupied, leftX, leftY);
    const rightOccupied = inBounds(size, rightX, rightY) && contains(occupied, rightX, rightY);

    // A diagonal influence before the beam enters the box is defined by Black
    // Box as an immediate reflection, even when only one side is occupied.
    if (!entered && (leftOccupied || rightOccupied)) {
      path.push({ x: (x + frontX) / 2, y: (y + frontY) / 2 });
      path.push({ x: start.x, y: start.y });
      return { kind: RESPONSE.REFLECT, entry: entryPort, path };
    }

    if (leftOccupied && rightOccupied) {
      dx = -dx;
      dy = -dy;
      path.push({ x, y });
      // Direction changes are resolved in place. The official rule engine then
      // evaluates the new forward direction before the ray advances.
      continue;
    } else if (leftOccupied) {
      // Turn away from the body on the left.
      const nextDx = -dy;
      const nextDy = dx;
      dx = nextDx;
      dy = nextDy;
      continue;
    } else if (rightOccupied) {
      // Turn away from the body on the right.
      const nextDx = dy;
      const nextDy = -dx;
      dx = nextDx;
      dy = nextDy;
      continue;
    }

    x += dx;
    y += dy;
    path.push({ x, y });

    if (inBounds(size, x, y)) {
      entered = true;
      continue;
    }

    const exitPort = pointToPort(size, x, y);
    if (exitPort === entryPort) {
      return { kind: RESPONSE.REFLECT, entry: entryPort, path };
    }
    return { kind: RESPONSE.EXIT, entry: entryPort, exit: exitPort, path };
  }

  throw new Error("Ray trace exceeded its safety limit.");
}

/**
 * Responses are canonical: paired exits store the exact partner port, so label
 * assignment or discovery order cannot affect equality.
 */
export function responseSignature(size, balls) {
  return Array.from({ length: size * 4 }, (_, port) => {
    const response = traceRay(size, balls, port);
    if (response.kind === RESPONSE.HIT) return "H";
    if (response.kind === RESPONSE.REFLECT) return "R";
    return "E:" + String(response.exit);
  });
}

export function areResponseEquivalent(size, firstBalls, secondBalls) {
  const first = responseSignature(size, firstBalls);
  const second = responseSignature(size, secondBalls);
  return first.every((value, index) => value === second[index]);
}

export function responseMatchesRecord(size, balls, port, record) {
  if (!record || typeof record !== "object") return false;
  const response = traceRay(size, balls, port);
  if (response.kind !== record.kind) return false;
  return response.kind !== RESPONSE.EXIT || response.exit === record.exit;
}

/**
 * Return one ray that distinguishes a proposed layout from the hidden layout.
 * Already revealed contradictory rays take priority; otherwise the caller can
 * reveal exactly one new ray, matching the original Black Box check behaviour.
 */
export function findDistinguishingPort(size, referenceBalls, candidateBalls, revealedPorts = []) {
  const reference = responseSignature(size, referenceBalls);
  const candidate = responseSignature(size, candidateBalls);
  const mismatches = reference.flatMap((value, port) => (value === candidate[port] ? [] : [port]));
  if (!mismatches.length) return null;

  const revealed = new Set(
    [...revealedPorts].filter((port) => Number.isInteger(port) && port >= 0 && port < size * 4),
  );
  const port = mismatches.find((candidatePort) => revealed.has(candidatePort)) ?? mismatches[0];
  return {
    port,
    alreadyRevealed: revealed.has(port),
    expected: traceRay(size, referenceBalls, port),
    proposed: traceRay(size, candidateBalls, port),
  };
}

export function generateLayout(size, count, random = Math.random) {
  assertBoardSize(size);
  if (!Number.isInteger(count) || count < 0 || count > size * size) {
    throw new RangeError("Energy body count must fit inside the board.");
  }
  if (typeof random !== "function") throw new TypeError("Random source must be a function.");

  const cells = Array.from({ length: size * size }, (_, index) => ({
    x: index % size,
    y: Math.floor(index / size),
  }));

  for (let index = cells.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("Random source must return values in [0, 1).");
    }
    const swapIndex = Math.floor(value * (index + 1));
    [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
  }

  return cells.slice(0, count);
}
