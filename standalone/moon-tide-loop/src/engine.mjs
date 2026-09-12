/** Moon Tide Loop — original implementation of rectangular Slitherlink.
 * Edge values: 0 unknown, 1 line, -1 excluded. Notes never count as lines.
 * Horizontals first, row-major; verticals second, row-major.
 */
export const UNKNOWN = 0;
export const LINE = 1;
export const EXCLUDED = -1;
const valueOK = value => value === 0 || value === 1 || value === -1;
const cache = new Map();

export function topology(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12 || height > 12) throw new RangeError('Invalid board dimensions');
  const key = width + 'x' + height;
  if (cache.has(key)) return cache.get(key);
  const edges = [], vertexEdges = Array.from({ length: (width + 1) * (height + 1) }, () => []);
  const vertex = (x, y) => y * (width + 1) + x;
  const add = (a, b, orientation, row, col) => {
    const id = edges.length;
    edges.push(Object.freeze({ id, a, b, orientation, row, col }));
    vertexEdges[a].push(id); vertexEdges[b].push(id);
  };
  for (let y = 0; y <= height; y++) for (let x = 0; x < width; x++) add(vertex(x, y), vertex(x + 1, y), 'h', y, x);
  for (let y = 0; y < height; y++) for (let x = 0; x <= width; x++) add(vertex(x, y), vertex(x, y + 1), 'v', y, x);
  const horizontal = width * (height + 1);
  const cellEdges = Array.from({ length: width * height }, (_, index) => {
    const x = index % width, y = Math.floor(index / width);
    return Object.freeze([y * width + x, horizontal + y * (width + 1) + x + 1, (y + 1) * width + x, horizontal + y * (width + 1) + x]);
  });
  const edgeCells = edges.map(() => []);
  cellEdges.forEach((group, cell) => group.forEach(edge => edgeCells[edge].push(cell)));
  const result = Object.freeze({ width, height, edges: Object.freeze(edges), cellEdges: Object.freeze(cellEdges), edgeCells: Object.freeze(edgeCells.map(Object.freeze)), vertexEdges: Object.freeze(vertexEdges.map(Object.freeze)), edgeCount: edges.length, vertexCount: vertexEdges.length });
  cache.set(key, result);
  return result;
}

export function validLevel(level) {
  return !!level && Number.isInteger(level.width) && Number.isInteger(level.height) && level.width >= 1 && level.width <= 12 && level.height >= 1 && level.height <= 12 && Array.isArray(level.clues) && level.clues.length === level.width * level.height && level.clues.every(n => n === null || (Number.isInteger(n) && n >= 0 && n <= 3));
}
export function validEdges(level, edges) {
  return validLevel(level) && Array.isArray(edges) && edges.length === level.width * (level.height + 1) + (level.width + 1) * level.height && edges.every(valueOK);
}
export function createState(level) {
  if (!validLevel(level)) throw new TypeError('Invalid puzzle');
  return { levelId: level.id, edges: Array(topology(level.width, level.height).edgeCount).fill(0), history: [], moves: 0, hintsUsed: 0 };
}
export function applyEdge(level, state, edge, value) {
  if (!state || !validEdges(level, state.edges) || !Array.isArray(state.history) || !Number.isInteger(state.moves) || state.moves < 0 || !Number.isInteger(edge) || edge < 0 || edge >= state.edges.length || !valueOK(value) || state.edges[edge] === value) return state;
  const edges = state.edges.slice();
  const from = edges[edge]; edges[edge] = value;
  return Object.assign({}, state, { edges, history: [...state.history, { edge, from, to: value }], moves: state.moves + 1 });
}
export function undo(level, state) {
  if (!state || !validEdges(level, state.edges) || !Array.isArray(state.history) || !Number.isInteger(state.moves) || state.moves < 0 || state.history.length === 0) return state;
  const last = state.history[state.history.length - 1];
  if (!last || !Number.isInteger(last.edge) || last.edge < 0 || last.edge >= state.edges.length || !valueOK(last.from) || last.to !== state.edges[last.edge]) return state;
  const edges = state.edges.slice(); edges[last.edge] = last.from;
  return Object.assign({}, state, { edges, history: state.history.slice(0, -1), moves: Math.max(0, state.moves - 1) });
}
export function restart(level) { return createState(level); }

export function inspect(level, stateOrEdges) {
  const values = Array.isArray(stateOrEdges) ? stateOrEdges : stateOrEdges && stateOrEdges.edges;
  if (!validEdges(level, values)) return { valid: false, won: false, singleLoop: false, lineCount: 0, components: 0, clueCounts: [], clueErrors: [], overflow: [], impossibleClues: [], degreeErrors: [], branchVertices: [] };
  const board = topology(level.width, level.height);
  const clueCounts = board.cellEdges.map(group => group.reduce((sum, e) => sum + (values[e] === LINE ? 1 : 0), 0));
  const clueErrors = [], overflow = [], impossibleClues = [];
  level.clues.forEach((clue, cell) => {
    if (clue === null) return;
    if (clueCounts[cell] !== clue) clueErrors.push(cell);
    if (clueCounts[cell] > clue) overflow.push(cell);
    const unknown = board.cellEdges[cell].filter(e => values[e] === UNKNOWN).length;
    if (clueCounts[cell] > clue || clueCounts[cell] + unknown < clue) impossibleClues.push(cell);
  });
  const degrees = board.vertexEdges.map(group => group.filter(e => values[e] === LINE).length);
  const degreeErrors = [], branchVertices = [];
  degrees.forEach((degree, vertex) => { if (degree !== 0 && degree !== 2) degreeErrors.push(vertex); if (degree > 2) branchVertices.push(vertex); });
  const active = values.reduce((arr, value, edge) => { if (value === LINE) arr.push(edge); return arr; }, []);
  const seen = new Set(); let components = 0;
  active.forEach(edgeId => {
    if (seen.has(edgeId)) return;
    components++;
    const stack = [edgeId];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      const edge = board.edges[id];
      for (const vertex of [edge.a, edge.b]) for (const next of board.vertexEdges[vertex]) if (values[next] === LINE && !seen.has(next)) stack.push(next);
    }
  });
  const singleLoop = active.length > 0 && degreeErrors.length === 0 && components === 1;
  return { valid: true, won: singleLoop && clueErrors.length === 0, singleLoop, lineCount: active.length, components, clueCounts, clueErrors, overflow, impossibleClues, degrees, degreeErrors, branchVertices };
}
export function checkWin(level, stateOrEdges) { return inspect(level, stateOrEdges).won; }

/** Replay, rather than trust, serialized states. Unknown auxiliary fields are discarded. */
export function restoreState(level, candidate) {
  if (!candidate || candidate.levelId !== level.id || !Array.isArray(candidate.history) || candidate.history.length > 20000 || !validEdges(level, candidate.edges)) return null;
  let state = createState(level);
  for (const action of candidate.history) {
    if (!action || state.edges[action.edge] !== action.from) return null;
    const next = applyEdge(level, state, action.edge, action.to);
    if (next === state) return null;
    state = next;
  }
  if (state.moves !== candidate.moves || state.edges.some((value, edge) => value !== candidate.edges[edge])) return null;
  return Object.assign({}, state, { hintsUsed: Number.isInteger(candidate.hintsUsed) && candidate.hintsUsed >= 0 ? candidate.hintsUsed : 0 });
}
