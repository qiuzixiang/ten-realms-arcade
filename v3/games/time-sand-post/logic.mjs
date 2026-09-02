export const DIRECTION_ORDER = Object.freeze(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);

export const DIRECTIONS = Object.freeze({
  N: Object.freeze({ dx: 0, dy: -1, glyph: "↑", label: "向北" }),
  NE: Object.freeze({ dx: 1, dy: -1, glyph: "↗", label: "向东北" }),
  E: Object.freeze({ dx: 1, dy: 0, glyph: "→", label: "向东" }),
  SE: Object.freeze({ dx: 1, dy: 1, glyph: "↘", label: "向东南" }),
  S: Object.freeze({ dx: 0, dy: 1, glyph: "↓", label: "向南" }),
  SW: Object.freeze({ dx: -1, dy: 1, glyph: "↙", label: "向西南" }),
  W: Object.freeze({ dx: -1, dy: 0, glyph: "←", label: "向西" }),
  NW: Object.freeze({ dx: -1, dy: -1, glyph: "↖", label: "向西北" }),
});

const SAFE_ID = /^(?!__proto__$|prototype$|constructor$)[a-z0-9][a-z0-9-]{2,63}$/;

function isPlainObject(value) {
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

export function pointFor(level, index) {
  if (!integer(index, 0, cellCount(level) - 1)) return null;
  return Object.freeze({ x: index % level.width, y: Math.floor(index / level.width) });
}

export function indexFor(level, x, y) {
  if (!integer(x, 0, level.width - 1) || !integer(y, 0, level.height - 1)) return -1;
  return y * level.width + x;
}

export function givenMaps(level) {
  const numberByCell = new Int16Array(cellCount(level));
  const cellByNumber = new Int16Array(cellCount(level) + 1);
  cellByNumber.fill(-1);
  for (const [cell, number] of level.givens) {
    numberByCell[cell] = number;
    cellByNumber[number] = cell;
  }
  return { numberByCell, cellByNumber };
}

export function candidateTargets(level, from) {
  const point = pointFor(level, from);
  const direction = point ? DIRECTIONS[level.directions[from]] : null;
  if (!point || !direction) return Object.freeze([]);
  const targets = [];
  let x = point.x + direction.dx;
  let y = point.y + direction.dy;
  while (x >= 0 && y >= 0 && x < level.width && y < level.height) {
    targets.push(indexFor(level, x, y));
    x += direction.dx;
    y += direction.dy;
  }
  return Object.freeze(targets);
}

export function pointsAlongDirection(level, from, to) {
  return candidateTargets(level, from).includes(to);
}

/** SVG-safe centreline shortened away from both cell label zones. */
export function connectionSegment(level, from, to, inset = 0.38) {
  const start = pointFor(level, from);
  const end = pointFor(level, to);
  if (!start || !end || from === to || !pointsAlongDirection(level, from, to)
      || !Number.isFinite(inset) || inset < 0 || inset >= 0.5) return null;
  const x1 = start.x + 0.5;
  const y1 = start.y + 0.5;
  const x2 = end.x + 0.5;
  const y2 = end.y + 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const unitX = dx / length;
  const unitY = dy / length;
  return Object.freeze({
    x1: x1 + unitX * inset,
    y1: y1 + unitY * inset,
    x2: x2 - unitX * inset,
    y2: y2 - unitY * inset,
  });
}

export function validateLevel(level) {
  const errors = [];
  if (!isPlainObject(level)) return ["level must be a plain object"];
  if (!SAFE_ID.test(level.id ?? "")) errors.push("invalid level id");
  if (!["easy", "medium", "hard"].includes(level.difficulty)) errors.push("invalid difficulty");
  if (!integer(level.tier, 1, 3)) errors.push("invalid tier");
  if (!integer(level.width, 3, 8) || !integer(level.height, 3, 8)) errors.push("invalid board size");
  const total = integer(level.width, 3, 8) && integer(level.height, 3, 8) ? cellCount(level) : 0;
  if (!integer(level.seed, 0, 0x7fffffff)) errors.push("invalid seed");
  if (!Array.isArray(level.directions) || level.directions.length !== total) {
    errors.push("directions must cover every cell");
  } else {
    const terminalCount = level.directions.filter((direction) => direction === null).length;
    if (terminalCount !== 1) errors.push("exactly one terminal cell is required");
    for (const direction of level.directions) {
      if (direction !== null && !DIRECTION_ORDER.includes(direction)) errors.push("invalid direction");
    }
  }
  if (!Array.isArray(level.givens) || level.givens.length < 2) {
    errors.push("at least the first and final stamps are required");
  } else {
    const cells = new Set();
    const numbers = new Set();
    for (const pair of level.givens) {
      if (!Array.isArray(pair) || pair.length !== 2 || !integer(pair[0], 0, total - 1) || !integer(pair[1], 1, total)) {
        errors.push("invalid given stamp");
        continue;
      }
      if (cells.has(pair[0]) || numbers.has(pair[1])) errors.push("duplicate given stamp");
      cells.add(pair[0]);
      numbers.add(pair[1]);
    }
    if (!numbers.has(1) || !numbers.has(total)) errors.push("stamps 1 and N must be shown");
    const finalCell = level.givens.find(([, number]) => number === total)?.[0];
    if (integer(finalCell, 0, total - 1) && level.directions?.[finalCell] !== null) errors.push("stamp N must be the terminal cell");
  }
  if (Array.isArray(level.directions) && level.directions.length === total) {
    for (let cell = 0; cell < total; cell += 1) {
      if (level.directions[cell] !== null && candidateTargets(level, cell).length === 0) errors.push(`cell ${cell} points out of the board`);
    }
  }
  return [...new Set(errors)];
}

export function defineLevel(source) {
  const level = {
    ...source,
    directions: Object.freeze([...(source.directions ?? [])]),
    givens: Object.freeze((source.givens ?? []).map((pair) => Object.freeze([...pair]))),
  };
  const errors = validateLevel(level);
  if (errors.length) throw new TypeError(`Invalid Signpost level ${source?.id ?? "unknown"}: ${errors.join(", ")}`);
  return Object.freeze(level);
}

/**
 * Independent forward Hamiltonian-path search. It reads only arrows and shown
 * stamps, never a stored answer. `limit=2` is sufficient to distinguish a
 * unique level from an ambiguous one; `truncated` is false only if the search
 * tree was exhausted before reaching the limit.
 */
export function solveLevel(level, limit = 2) {
  const errors = validateLevel(level);
  if (errors.length) return { count: 0, solutions: [], truncated: false, errors };
  const maximum = integer(limit, 1, 100) ? limit : 2;
  const total = cellCount(level);
  const { numberByCell, cellByNumber } = givenMaps(level);
  const start = cellByNumber[1];
  const used = new Uint8Array(total);
  const path = new Int16Array(total);
  const solutions = [];
  let truncated = false;

  used[start] = 1;
  path[0] = start;

  function search(number, current) {
    if (solutions.length >= maximum) {
      truncated = true;
      return;
    }
    if (number === total) {
      if (current === cellByNumber[total]) solutions.push(Object.freeze(Array.from(path)));
      return;
    }
    const required = cellByNumber[number + 1];
    const candidates = candidateTargets(level, current);
    for (const target of candidates) {
      if (used[target]) continue;
      if (required !== -1 && target !== required) continue;
      if (numberByCell[target] !== 0 && numberByCell[target] !== number + 1) continue;
      if (level.directions[target] === null && number + 1 !== total) continue;
      used[target] = 1;
      path[number] = target;
      search(number + 1, target);
      used[target] = 0;
      if (solutions.length >= maximum) {
        truncated = true;
        return;
      }
    }
  }

  search(1, start);
  return Object.freeze({ count: solutions.length, solutions: Object.freeze(solutions), truncated, errors: Object.freeze([]) });
}

function createBarePosition(level) {
  const total = cellCount(level);
  const { numberByCell } = givenMaps(level);
  return Object.freeze({
    next: Object.freeze(Array(total).fill(-1)),
    previous: Object.freeze(Array(total).fill(-1)),
    numbers: Object.freeze(Array.from(numberByCell)),
    numberCells: Object.freeze(Array(total + 1).fill(-1)),
    regions: Object.freeze(Array.from({ length: total }, (_, index) => index)),
    impossible: false,
  });
}

function mutablePosition(position) {
  return {
    next: [...position.next],
    previous: [...position.previous],
    numbers: [...position.numbers],
    numberCells: [...position.numberCells],
    regions: [...position.regions],
    impossible: position.impossible === true,
  };
}

function freezePosition(position) {
  return Object.freeze({
    next: Object.freeze(position.next),
    previous: Object.freeze(position.previous),
    numbers: Object.freeze(position.numbers),
    numberCells: Object.freeze(position.numberCells),
    regions: Object.freeze(position.regions),
    impossible: position.impossible === true,
  });
}

function makeLinkMutable(position, from, to) {
  const displacedNext = position.next[from];
  const displacedPrevious = position.previous[to];
  if (displacedNext !== -1) position.previous[displacedNext] = -1;
  if (displacedPrevious !== -1) position.next[displacedPrevious] = -1;
  position.next[from] = to;
  position.previous[to] = from;
}

function unlinkCellMutable(position, cell) {
  const before = position.previous[cell];
  const after = position.next[cell];
  if (before !== -1) position.next[before] = -1;
  if (after !== -1) position.previous[after] = -1;
  position.previous[cell] = -1;
  position.next[cell] = -1;
}

export function linksOf(position) {
  const links = [];
  for (let from = 0; from < position.next.length; from += 1) {
    if (position.next[from] >= 0) links.push(Object.freeze([from, position.next[from]]));
  }
  return Object.freeze(links);
}

function topologyOf(position) {
  const total = position.next.length;
  const visited = new Uint8Array(total);
  const components = [];

  for (let head = 0; head < total; head += 1) {
    if (position.previous[head] !== -1) continue;
    const cells = [];
    let cell = head;
    while (cell !== -1) {
      if (visited[cell]) return null;
      visited[cell] = 1;
      cells.push(cell);
      cell = position.next[cell];
    }
    components.push({ head, cells, cyclic: false });
  }

  // With reciprocal next/previous endpoints, every unvisited component has no
  // head and is therefore a closed cycle. Such a state is reachable in fixed
  // signpost.c when check_completion auto-links against its pre-auto DSF.
  for (let start = 0; start < total; start += 1) {
    if (visited[start]) continue;
    const cells = [];
    let cell = start;
    while (!visited[cell]) {
      visited[cell] = 1;
      cells.push(cell);
      cell = position.next[cell];
      if (cell === -1) return null;
    }
    if (cell !== start) return null;
    components.push({ head: start, cells, cyclic: true });
  }

  return components;
}

export function validatePosition(level, position) {
  const total = cellCount(level);
  if (!position || !Array.isArray(position.next) || !Array.isArray(position.previous)
      || !Array.isArray(position.numbers) || !Array.isArray(position.numberCells)
      || !Array.isArray(position.regions) || position.next.length !== total
      || position.previous.length !== total || position.numbers.length !== total
      || position.numberCells.length !== total + 1 || position.regions.length !== total
      || typeof position.impossible !== "boolean") return false;
  const maximumRawNumber = total * (total + 1) + total;
  for (let cell = 0; cell < total; cell += 1) {
    const next = position.next[cell];
    const previous = position.previous[cell];
    const number = position.numbers[cell];
    const region = position.regions[cell];
    if (!integer(next, -1, total - 1) || !integer(previous, -1, total - 1)) return false;
    if (!integer(number, -total, maximumRawNumber)) return false;
    if (!integer(region, 0, total - 1)) return false;
    if (next === cell || previous === cell) return false;
    if (next !== -1 && (position.previous[next] !== cell || !pointsAlongDirection(level, cell, next))) return false;
    if (previous !== -1 && position.next[previous] !== cell) return false;
  }
  if (position.numberCells[0] !== -1) return false;
  for (let number = 1; number <= total; number += 1) {
    const cell = position.numberCells[number];
    if (!integer(cell, -1, total - 1) || (cell !== -1 && position.numbers[cell] !== number)) return false;
  }
  return topologyOf(position) !== null;
}

function chainsOf(position) {
  return topologyOf(position)?.filter((component) => !component.cyclic) ?? null;
}

function groupName(group) {
  let value = group;
  let label = "";
  do {
    value -= 1;
    label = String.fromCharCode(97 + (value % 26)) + label;
    value = Math.floor(value / 26);
  } while (value > 0);
  return label;
}

function displayNumber(raw, total) {
  if (raw <= total) return raw === 0 ? "" : String(raw);
  const group = Math.floor(raw / (total + 1));
  const offset = raw % (total + 1);
  return `${groupName(group)}${offset ? `+${offset}` : ""}`;
}

function isRealNumber(value, total) {
  return Number.isInteger(value) && value > 0 && value <= total;
}

function rawGroup(number, total) {
  return number > 0 ? Math.floor(number / (total + 1)) : 0;
}

function updateNumbers(level, position) {
  const total = cellCount(level);
  const { numberByCell } = givenMaps(level);
  const next = mutablePosition(position);
  next.numberCells.fill(-1);
  for (let cell = 0; cell < total; cell += 1) {
    if (numberByCell[cell]) {
      next.numbers[cell] = numberByCell[cell];
      next.numberCells[numberByCell[cell]] = cell;
    }
    else if (next.previous[cell] === -1 && next.next[cell] === -1) next.numbers[cell] = 0;
  }

  const topology = topologyOf(next);
  if (!topology) throw new TypeError("Invalid Signpost topology");
  const currentChains = topology.filter((component) => !component.cyclic);
  topology.forEach((component) => {
    const region = component.cyclic ? Math.min(...component.cells) : component.head;
    component.cells.forEach((cell) => { next.regions[cell] = region; });
    if (component.cyclic) next.impossible = true;
  });
  const heads = [];
  for (const chain of currentChains) {
    if (chain.cells.length < 2) continue;
    let start = 0;
    let preference = 0;
    const anchors = [];
    chain.cells.forEach((cell, offset) => {
      if (numberByCell[cell]) anchors.push({ offset, number: numberByCell[cell] });
    });
    if (anchors.length) {
      start = anchors[0].number - anchors[0].offset;
      preference = 1;
      if (anchors.some((anchor) => anchor.number - anchor.offset !== start)) next.impossible = true;
    } else if (next.numbers[chain.head] === 0 && next.numbers[chain.cells[1]] > total) {
      start = rawGroup(next.numbers[chain.cells[1]], total) * (total + 1);
      preference = 1;
    } else if (next.numbers[chain.head] <= total) {
      start = 0;
      preference = 0;
    } else {
      const headGroup = rawGroup(next.numbers[chain.head], total);
      let sameGroupCount = 1;
      let decided = false;
      for (let offset = 1; offset < chain.cells.length; offset += 1) {
        const cell = chain.cells[offset];
        const number = next.numbers[cell];
        if (number === 0 && offset === chain.cells.length - 1) {
          start = headGroup * (total + 1);
          preference = 1;
          decided = true;
          break;
        }
        const group = rawGroup(number, total);
        if (group === headGroup) {
          sameGroupCount += 1;
          continue;
        }
        start = (sameGroupCount < chain.cells.length - sameGroupCount ? group : headGroup) * (total + 1);
        preference = 1;
        decided = true;
        break;
      }
      if (!decided) {
        start = headGroup * (total + 1);
        preference = headGroup === 0 ? 0 : 1;
      }
    }
    heads.push({ ...chain, start, preference });
  }

  heads.sort((left, right) => (
    right.preference - left.preference
    || left.start - right.start
    || right.cells.length - left.cells.length
    || right.head - left.head
  ));

  function lowestStart() {
    for (let group = 1; group < total; group += 1) {
      if (!heads.some((head) => rawGroup(head.start, total) === group)) return group * (total + 1);
    }
    return total * (total + 1);
  }

  for (let index = heads.length - 1; index >= 0; index -= 1) {
    if (index !== 0 && heads[index].start === heads[index - 1].start) {
      heads[index].start = lowestStart();
      heads[index].preference = -1;
    } else if (!heads[index].preference) {
      heads[index].start = lowestStart();
    }
  }

  for (const head of heads) {
    head.cells.forEach((cell, offset) => {
      if (!numberByCell[cell]) {
        next.numbers[cell] = head.start + offset;
        if (isRealNumber(next.numbers[cell], total)) next.numberCells[next.numbers[cell]] = cell;
      }
    });
  }
  return freezePosition(next);
}

/** signpost.c:update_numbers state plus one check_completion error scan. */
export function deriveLabels(level, position) {
  const total = cellCount(level);
  if (!validatePosition(level, position)) {
    return Object.freeze({ valid: false, numbers: Object.freeze(Array(total).fill(0)), displayLabels: Object.freeze(Array(total).fill("")), chainIds: Object.freeze(Array(total).fill(-1)), chainAnchored: Object.freeze(Array(total).fill(false)), chainCount: total, numberedCount: 0, errorCells: Object.freeze([]), hasErrors: true, impossible: true, cellByNumber: Object.freeze(Array(total + 1).fill(-1)) });
  }
  const { numberByCell } = givenMaps(level);
  const numbers = [...position.numbers];
  const topology = topologyOf(position);
  const chainIds = Array(total).fill(-1);
  const chainAnchored = Array(total).fill(false);
  topology.forEach((component, id) => {
    const anchored = component.cells.some((cell) => numberByCell[cell] > 0);
    component.cells.forEach((cell) => {
      chainIds[cell] = id;
      chainAnchored[cell] = anchored;
    });
  });

  // numsi is a pre-auto snapshot just like raw nums and DSF. Automatic links
  // can replace endpoints or create a cycle, so it cannot be reconstructed
  // exactly from the post-auto topology.
  const cellByNumber = [...position.numberCells];

  const errorCells = new Set();
  for (let left = 0; left < total; left += 1) {
    if (!isRealNumber(numbers[left], total)) continue;
    for (let right = left + 1; right < total; right += 1) {
      if (numbers[right] === numbers[left]) {
        errorCells.add(left);
        errorCells.add(right);
      }
    }
  }
  for (let number = 1; number < total; number += 1) {
    const from = cellByNumber[number];
    const to = cellByNumber[number + 1];
    if (from !== -1 && to !== -1 && !pointsAlongDirection(level, from, to)) {
      errorCells.add(from);
      errorCells.add(to);
    }
  }
  // Preserve the fixed upstream cell-index boundary: index 0 is not scanned.
  for (let cell = 1; cell < total; cell += 1) {
    if (numbers[cell] < 0 || (numbers[cell] === 0 && (position.next[cell] !== -1 || position.previous[cell] !== -1))) errorCells.add(cell);
  }
  const checkHasErrors = errorCells.size > 0;

  return Object.freeze({
    valid: true,
    numbers: Object.freeze(numbers),
    displayLabels: Object.freeze(numbers.map((number) => displayNumber(number, total))),
    chainIds: Object.freeze(chainIds),
    chainAnchored: Object.freeze(chainAnchored),
    chainCount: topology.length,
    numberedCount: numbers.filter((number) => isRealNumber(number, total)).length,
    errorCells: Object.freeze([...errorCells].sort((a, b) => a - b)),
    hasErrors: checkHasErrors,
    checkHasErrors,
    impossible: position.impossible,
    cellByNumber: Object.freeze(cellByNumber),
  });
}

/** One check_completion(mark_errors=true) pass; labels are not recomputed mid-pass. */
export function applyAutoLinks(level, position) {
  if (!validatePosition(level, position)) {
    return Object.freeze({ changed: false, position, autoLinks: Object.freeze([]), reason: "invalid-position" });
  }
  const total = cellCount(level);
  const labels = deriveLabels(level, position);
  const next = mutablePosition(position);
  const autoLinks = [];
  for (let number = 1; number < total; number += 1) {
    const from = labels.cellByNumber[number];
    const to = labels.cellByNumber[number + 1];
    if (from === -1 || to === -1 || !pointsAlongDirection(level, from, to)) continue;
    if (next.next[from] === to && next.previous[to] === from) continue;
    makeLinkMutable(next, from, to);
    autoLinks.push(Object.freeze([from, to]));
  }
  const candidate = freezePosition(next);
  if (!validatePosition(level, candidate)) {
    throw new TypeError("Upstream auto-link pass produced a structurally invalid position");
  }
  return Object.freeze({
    changed: autoLinks.length > 0,
    position: candidate,
    autoLinks: Object.freeze(autoLinks),
    reason: autoLinks.length ? "auto-linked" : "stable",
  });
}

export function createPosition(level) {
  return applyAutoLinks(level, updateNumbers(level, createBarePosition(level))).position;
}

export function applyLink(level, position, from, to) {
  if (!validatePosition(level, position)) return { changed: false, position, reason: "invalid-position" };
  const total = cellCount(level);
  if (!integer(from, 0, total - 1) || !integer(to, 0, total - 1) || from === to) {
    return { changed: false, position, reason: "invalid-cell" };
  }
  const { numberByCell } = givenMaps(level);
  const labels = deriveLabels(level, position);
  // signpost.c:isvalidmove calls ispointing before its immutable endpoint,
  // DSF and real-number checks. ispointing itself rejects every current raw N
  // (including a mutable inferred N), then verifies the arrow ray.
  if (labels.numbers[from] === total || !pointsAlongDirection(level, from, to)) {
    return { changed: false, position, reason: "off-ray" };
  }
  if (numberByCell[from] === total || level.directions[from] === null) return { changed: false, position, reason: "terminal" };
  if (numberByCell[to] === 1) return { changed: false, position, reason: "before-start" };
  // Upstream performs the current-DSF test before its real-number test.
  // The DSF snapshot is rebuilt by update_numbers before this turn's automatic
  // links; check_completion does not merge those new free links until the next
  // player action.
  if (position.regions[from] === position.regions[to]) return { changed: false, position, reason: "cycle" };
  const fromNumber = labels.numbers[from];
  const toNumber = labels.numbers[to];
  if (isRealNumber(fromNumber, total) && isRealNumber(toNumber, total) && toNumber !== fromNumber + 1) {
    return { changed: false, position, reason: "stamp-order" };
  }
  // Signpost validates the proposed endpoints against the current DSF before
  // makelink releases either occupied endpoint. Reconnecting two cells that
  // already belong to one chain is therefore illegal even when replacing the
  // endpoints would otherwise split that chain first.

  const next = mutablePosition(position);
  makeLinkMutable(next, from, to);
  const candidate = freezePosition(next);
  if (!validatePosition(level, candidate)) return { changed: false, position, reason: "invalid-position" };
  const settled = applyAutoLinks(level, updateNumbers(level, candidate));
  return { changed: true, position: settled.position, autoLinks: settled.autoLinks, reason: "linked" };
}

export function clearCell(level, position, cell) {
  if (!validatePosition(level, position) || !integer(cell, 0, cellCount(level) - 1)) {
    return { changed: false, position, reason: "invalid-cell" };
  }
  if (position.previous[cell] === -1 && position.next[cell] === -1) {
    return { changed: false, position, reason: "already-clear" };
  }
  const next = mutablePosition(position);
  unlinkCellMutable(next, cell);
  const settled = applyAutoLinks(level, updateNumbers(level, freezePosition(next)));
  return { changed: true, position: settled.position, autoLinks: settled.autoLinks, reason: "cleared" };
}

export function clearAlgebraicChain(level, position, cell) {
  if (!validatePosition(level, position) || !integer(cell, 0, cellCount(level) - 1)) {
    return { changed: false, position, reason: "invalid-cell" };
  }
  // interpret_move/execute_move do not emit or accept C/X for an isolated
  // selected cell, even when a single auto pass left a stale pseudo label.
  if (position.previous[cell] === -1 && position.next[cell] === -1) {
    return { changed: false, position, reason: "already-clear" };
  }
  const labels = deriveLabels(level, position);
  const group = rawGroup(labels.numbers[cell], cellCount(level));
  if (group === 0) return clearCell(level, position, cell);
  const members = labels.numbers
    .map((number, index) => number !== 0 && rawGroup(number, cellCount(level)) === group ? index : -1)
    .filter((index) => index !== -1);
  const next = mutablePosition(position);
  members.forEach((member) => unlinkCellMutable(next, member));
  const settled = applyAutoLinks(level, updateNumbers(level, freezePosition(next)));
  return { changed: true, position: settled.position, autoLinks: settled.autoLinks, reason: "chain-cleared" };
}

export function evaluatePosition(level, position) {
  if (!validatePosition(level, position)) {
    return Object.freeze({ valid: false, complete: false, linkCount: 0, numberedCount: 0, chainCount: cellCount(level), path: Object.freeze([]) });
  }
  const total = cellCount(level);
  const labels = deriveLabels(level, position);
  const linkCount = position.next.filter((cell) => cell !== -1).length;
  const path = labels.cellByNumber.slice(1);
  const complete = !labels.checkHasErrors
    && path.length === total
    && path.every((cell) => cell !== -1)
    && new Set(path).size === total
    && path.slice(0, -1).every((from, index) => pointsAlongDirection(level, from, path[index + 1]));
  return Object.freeze({
    valid: true,
    complete,
    linkCount,
    numberedCount: labels.numberedCount,
    chainCount: labels.chainCount,
    path: Object.freeze(path),
    numbers: labels.numbers,
    chainIds: labels.chainIds,
    chainAnchored: labels.chainAnchored,
    displayLabels: labels.displayLabels,
    errorCells: labels.errorCells,
    hasErrors: labels.hasErrors,
    impossible: labels.impossible,
  });
}

export function positionFromPath(level, path) {
  const total = cellCount(level);
  if (!Array.isArray(path) || path.length !== total || new Set(path).size !== total) return null;
  const position = mutablePosition(createBarePosition(level));
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    if (!pointsAlongDirection(level, from, to) || position.next[from] !== -1 || position.previous[to] !== -1) return null;
    makeLinkMutable(position, from, to);
  }
  const candidate = updateNumbers(level, freezePosition(position));
  return validatePosition(level, candidate) && evaluatePosition(level, candidate).complete ? candidate : null;
}

export function referenceTimeline(level) {
  const solved = solveLevel(level, 2);
  if (solved.count !== 1 || solved.truncated || !solved.solutions[0]) return null;
  const path = solved.solutions[0];
  const givenNumbers = level.givens.map(([, number]) => number).sort((a, b) => a - b);
  const timeline = [];
  for (let index = 0; index < givenNumbers.length - 1; index += 1) {
    const fromNumber = givenNumbers[index];
    const toNumber = givenNumbers[index + 1];
    const between = path.slice(fromNumber, toNumber - 1);
    for (let offset = 0; offset < between.length - 1; offset += 1) {
      timeline.push(Object.freeze({ type: "link", from: between[offset], to: between[offset + 1] }));
    }
    if (between.length) {
      timeline.push(Object.freeze({ type: "link", from: path[fromNumber - 1], to: between[0] }));
    }
  }
  return Object.freeze(timeline);
}

export function serializePosition(position) {
  return Object.freeze({
    version: 2,
    links: linksOf(position).map((pair) => [...pair]),
    numbers: [...position.numbers],
    numberCells: [...position.numberCells],
    regions: [...position.regions],
    impossible: position.impossible,
  });
}

export function deserializePosition(level, value) {
  if (!isPlainObject(value) || value.version !== 2 || !Array.isArray(value.links)
      || !Array.isArray(value.numbers) || value.numbers.length !== cellCount(level)
      || !Array.isArray(value.numberCells) || value.numberCells.length !== cellCount(level) + 1
      || !Array.isArray(value.regions) || value.regions.length !== cellCount(level)
      || typeof value.impossible !== "boolean" || value.links.length > cellCount(level) - 1) return null;
  const position = mutablePosition(createBarePosition(level));
  position.numbers = [...value.numbers];
  position.numberCells = [...value.numberCells];
  position.regions = [...value.regions];
  position.impossible = value.impossible;
  for (const pair of value.links) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [from, to] = pair;
    if (!integer(from, 0, cellCount(level) - 1) || !integer(to, 0, cellCount(level) - 1)
        || from === to || position.next[from] !== -1 || position.previous[to] !== -1
        || !pointsAlongDirection(level, from, to)) return null;
    position.next[from] = to;
    position.previous[to] = from;
  }
  const candidate = freezePosition(position);
  if (!validatePosition(level, candidate) || linksOf(candidate).length !== value.links.length) return null;
  // This is a structural position decoder, not another upstream turn. Raw
  // nums, numsi, DSF and sticky impossible are pre-auto snapshots, while links
  // are post-auto; a single check_completion pass can therefore leave stale
  // values on newly isolated cells or a transient cycle without implying any
  // additional recomputation here. Session loading establishes reachability by
  // replaying the full timeline and comparing the complete serialized state.
  const { numberByCell } = givenMaps(level);
  for (let cell = 0; cell < cellCount(level); cell += 1) {
    if (numberByCell[cell] && candidate.numbers[cell] !== numberByCell[cell]) return null;
  }
  return candidate;
}

export function snapshotPosition(position) {
  return serializePosition(position);
}
