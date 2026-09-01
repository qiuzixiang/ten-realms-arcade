import {
  DIFFICULTIES,
  LEVELS,
  applySessionMove,
  cellCoordinates,
  coreById,
  createSession,
  edgeById,
  evaluatePosition,
  findLevel,
  levelsForDifficulty,
  oppositeCell,
  resolvePointerTarget,
  restartSession,
  restoreSession,
  sessionToJSON,
  solvePuzzle,
  undoSession,
} from "./logic.mjs";

export const STORAGE_KEYS = Object.freeze({
  session: "ten-realms-v2:games:nebula-hatchery:save:v1",
  preferences: "ten-realms-v2:games:nebula-hatchery:preferences:v1",
  atlas: "ten-realms-v2:games:nebula-hatchery:atlas:v1",
});

const STORAGE_VERSION = 1;
const POINTER_RADIUS_CSS_PX = 22;
const AMBIGUITY_GAP_CSS_PX = 4;
const MAX_COMPACT_EDGE_TOLERANCE = 0.46;
const MAX_COMPACT_AMBIGUITY_GAP = 0.14;
const RARITIES = Object.freeze([
  Object.freeze({ id: "常辉", colour: "#ffd58e" }),
  Object.freeze({ id: "伴生", colour: "#86f2d0" }),
  Object.freeze({ id: "原初", colour: "#ff8fbd" }),
]);
const COMPONENT_COLOURS = Object.freeze([
  "rgba(134, 242, 208, 0.25)",
  "rgba(185, 154, 255, 0.26)",
  "rgba(255, 213, 142, 0.23)",
  "rgba(156, 217, 255, 0.24)",
  "rgba(255, 143, 189, 0.21)",
]);

/**
 * Convert a client-space point into an SVG board-space point.
 *
 * The helper is exported so pointer geometry can be tested without booting the
 * page. It deliberately uses the SVG screen CTM instead of assuming that the
 * rendered board is an untransformed rectangle.
 */
export function clientToBoardPoint(svg, clientXOrEvent, clientY) {
  const clientX = Number(
    typeof clientXOrEvent === "object" ? clientXOrEvent?.clientX : clientXOrEvent,
  );
  const resolvedClientY = Number(
    typeof clientXOrEvent === "object" ? clientXOrEvent?.clientY : clientY,
  );
  if (!svg || !Number.isFinite(clientX) || !Number.isFinite(resolvedClientY)) return null;

  let inverse;
  try {
    const matrix = svg.getScreenCTM?.();
    if (!matrix || typeof matrix.inverse !== "function") return null;
    inverse = matrix.inverse();
  } catch {
    return null;
  }

  try {
    if (typeof DOMPoint === "function") {
      const point = new DOMPoint(clientX, resolvedClientY).matrixTransform(inverse);
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) return { x: point.x, y: point.y };
    }
  } catch {
    // Some test doubles and older engines expose a matrix but not DOMPoint.
  }

  try {
    const point = svg.createSVGPoint?.();
    if (point) {
      point.x = clientX;
      point.y = resolvedClientY;
      const transformed = point.matrixTransform(inverse);
      if (Number.isFinite(transformed.x) && Number.isFinite(transformed.y)) {
        return { x: transformed.x, y: transformed.y };
      }
    }
  } catch {
    // Fall through to the affine calculation below.
  }

  const values = [inverse.a, inverse.b, inverse.c, inverse.d, inverse.e, inverse.f];
  if (!values.every(Number.isFinite)) return null;
  return {
    x: inverse.a * clientX + inverse.c * resolvedClientY + inverse.e,
    y: inverse.b * clientX + inverse.d * resolvedClientY + inverse.f,
  };
}

function cssPixelsToBoardUnits(svg, pixels) {
  try {
    const matrix = svg.getScreenCTM?.();
    if (!matrix) return 0.22;
    const scaleX = Math.hypot(matrix.a, matrix.b);
    const scaleY = Math.hypot(matrix.c, matrix.d);
    if (!(scaleX > 0) || !(scaleY > 0)) return 0.22;
    return Math.max(pixels / scaleX, pixels / scaleY);
  } catch {
    return 0.22;
  }
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function svgStarPoints(cx, cy, outerRadius, innerRadius, points = 6) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + index * Math.PI / points;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(" ");
}

function difficultyById(id) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? DIFFICULTIES[0];
}

function defaultAtlas() {
  return {
    completed: new Set(),
    rarities: new Set(),
    badges: { zeroConflict: false, intuition: false },
  };
}

let elements = null;
let state = null;
let pointerGesture = null;
let audioContext = null;
let masterGain = null;
let toastTimer = 0;
let victoryTimer = 0;
let victoryBlocker = null;
let victoryBlockerHandler = null;
let rulesOpener = null;
let storageHealthy = true;
let storageWarningShown = false;
const parCache = new Map();

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    storageHealthy = false;
    return null;
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    storageHealthy = false;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    storageHealthy = false;
    return false;
  }
}

function parseStoredJSON(key) {
  const raw = readStorage(key);
  if (raw === null) return { value: null, invalid: false };
  try {
    return { value: JSON.parse(raw), invalid: false };
  } catch {
    removeStorage(key);
    return { value: null, invalid: true };
  }
}

function loadPreferences() {
  const stored = parseStoredJSON(STORAGE_KEYS.preferences);
  const valid = exactKeys(stored.value, ["version", "muted", "mode"])
    && stored.value.version === STORAGE_VERSION
    && typeof stored.value.muted === "boolean"
    && ["draw", "erase", "note"].includes(stored.value.mode);
  if (stored.value !== null && !valid) removeStorage(STORAGE_KEYS.preferences);
  return {
    muted: valid ? stored.value.muted : false,
    mode: valid ? stored.value.mode : "draw",
    invalid: stored.invalid || (stored.value !== null && !valid),
  };
}

function loadAtlas() {
  const stored = parseStoredJSON(STORAGE_KEYS.atlas);
  const value = stored.value;
  const levelIds = new Set(LEVELS.map(({ id }) => id));
  const rarityIds = new Set(RARITIES.map(({ id }) => id));
  const valid = exactKeys(value, ["version", "completed", "rarities", "badges"])
    && value.version === STORAGE_VERSION
    && Array.isArray(value.completed)
    && new Set(value.completed).size === value.completed.length
    && value.completed.every((id) => typeof id === "string" && levelIds.has(id))
    && Array.isArray(value.rarities)
    && new Set(value.rarities).size === value.rarities.length
    && value.rarities.every((id) => typeof id === "string" && rarityIds.has(id))
    && exactKeys(value.badges, ["zeroConflict", "intuition"])
    && typeof value.badges.zeroConflict === "boolean"
    && typeof value.badges.intuition === "boolean";
  if (value !== null && !valid) removeStorage(STORAGE_KEYS.atlas);
  if (!valid) return { atlas: defaultAtlas(), invalid: stored.invalid || value !== null };
  return {
    atlas: {
      completed: new Set(value.completed),
      rarities: new Set(value.rarities),
      badges: { ...value.badges },
    },
    invalid: false,
  };
}

function loadGame() {
  const stored = parseStoredJSON(STORAGE_KEYS.session);
  const value = stored.value;
  try {
    if (!exactKeys(value, ["version", "difficulty", "levelId", "session", "run", "completionReported"])
      || value.version !== STORAGE_VERSION
      || typeof value.difficulty !== "string"
      || typeof value.levelId !== "string"
      || typeof value.completionReported !== "boolean"
      || !exactKeys(value.run, ["conflicts", "hadConflict", "usedNotes"])
      || !safeInteger(value.run.conflicts)
      || typeof value.run.hadConflict !== "boolean"
      || typeof value.run.usedNotes !== "boolean"
      || (value.run.conflicts > 0 && !value.run.hadConflict)) {
      throw new TypeError("Invalid outer save schema.");
    }
    const level = findLevel(value.levelId);
    const difficulty = DIFFICULTIES.find(({ id }) => id === value.difficulty);
    if (!level || !difficulty || level.difficulty !== difficulty.id) {
      throw new TypeError("Saved level and difficulty do not match.");
    }
    const session = restoreSession(level, value.session);
    const evaluation = evaluatePosition(level, session.position);
    return {
      restored: true,
      invalid: false,
      level,
      difficulty: value.difficulty,
      session,
      evaluation,
      run: { ...value.run },
      completionReported: value.completionReported,
    };
  } catch {
    if (value !== null || stored.invalid) removeStorage(STORAGE_KEYS.session);
    const level = LEVELS[0];
    const session = createSession(level);
    return {
      restored: false,
      invalid: value !== null || stored.invalid,
      level,
      difficulty: level.difficulty,
      session,
      evaluation: evaluatePosition(level, session.position),
      run: { conflicts: 0, hadConflict: false, usedNotes: false },
      completionReported: false,
    };
  }
}

function serializeAtlas() {
  return {
    version: STORAGE_VERSION,
    completed: [...state.atlas.completed].sort(),
    rarities: [...state.atlas.rarities].sort(),
    badges: { ...state.atlas.badges },
  };
}

function persistPreferences() {
  writeStorage(STORAGE_KEYS.preferences, {
    version: STORAGE_VERSION,
    muted: state.muted,
    mode: state.mode,
  });
}

function persistAtlas() {
  writeStorage(STORAGE_KEYS.atlas, serializeAtlas());
}

function persistGame() {
  const saved = writeStorage(STORAGE_KEYS.session, {
    version: STORAGE_VERSION,
    difficulty: state.difficulty,
    levelId: state.level.id,
    session: sessionToJSON(state.level, state.session),
    run: { ...state.run },
    completionReported: state.completionReported,
  });
  if (elements?.saveState) {
    elements.saveState.textContent = saved ? "进度已保存在本机" : "本机存储不可用，本局仍可继续";
  }
  return saved;
}

function showToast(message, { assertive = false, duration = 2600 } = {}) {
  if (!elements?.toast) return;
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  if (assertive) elements.assertiveStatus.textContent = message;
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}

function showStorageWarning() {
  if (storageWarningShown) return;
  storageWarningShown = true;
  showToast(
    storageHealthy
      ? "检测到无法读取的本机记录，已安全回到新星胚。"
      : "本机存储暂不可用；游戏仍可继续，但刷新后不会保留进度。",
    { assertive: true, duration: 4200 },
  );
}

function ensureAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  try {
    audioContext = new AudioContextConstructor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = state?.muted ? 0 : 0.2;
    masterGain.connect(audioContext.destination);
    return audioContext;
  } catch {
    audioContext = null;
    masterGain = null;
    return null;
  }
}

function playSound(kind) {
  if (state.muted) return;
  const context = ensureAudio();
  if (!context || !masterGain) return;
  const sounds = {
    draw: [440, 0.07, "sine"],
    erase: [250, 0.08, "triangle"],
    note: [660, 0.1, "sine"],
    invalid: [155, 0.16, "sawtooth"],
    undo: [330, 0.09, "triangle"],
    complete: [880, 0.5, "sine"],
  };
  const [frequency, duration, type] = sounds[kind] ?? sounds.draw;
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (kind === "complete") oscillator.frequency.exponentialRampToValueAtTime(1320, start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(kind === "complete" ? 0.6 : 0.34, start + 0.018);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function updateMuteControl() {
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "开启声音" : "静音");
  const glyph = elements.muteButton.querySelector("[aria-hidden]");
  const label = elements.muteButton.querySelector(".action-label");
  if (glyph) glyph.textContent = state.muted ? "×" : "♬";
  if (label) label.textContent = state.muted ? "已静音" : "声音";
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(state.muted ? 0 : 0.2, audioContext.currentTime, 0.015);
  }
}

function toggleMute({ focusBoard = false } = {}) {
  ensureAudio();
  state.muted = !state.muted;
  updateMuteControl();
  persistPreferences();
  showToast(state.muted ? "孵化场声音已静音。" : "孵化场声音已开启。");
  if (focusBoard) elements.board.focus({ preventScroll: true });
}

function noteArrowMarkup(coreX, coreY, cellX, cellY) {
  const dx = cellX - coreX;
  const dy = cellY - coreY;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const tipX = cellX - ux * 0.16;
  const tipY = cellY - uy * 0.16;
  const baseX = tipX - ux * 0.15;
  const baseY = tipY - uy * 0.15;
  const perpendicularX = -uy * 0.08;
  const perpendicularY = ux * 0.08;
  return `${tipX},${tipY} ${baseX + perpendicularX},${baseY + perpendicularY} ${baseX - perpendicularX},${baseY - perpendicularY}`;
}

function noteMarkup() {
  const rendered = new Set();
  const markup = [];
  for (const [cell, coreId] of state.session.position.notes) {
    const core = coreById(state.level, coreId);
    const opposite = core ? oppositeCell(state.level, cell, core) : null;
    if (!core || opposite === null) continue;
    const first = Math.min(cell, opposite);
    const second = Math.max(cell, opposite);
    const key = `${coreId}:${first}:${second}`;
    if (rendered.has(key)) continue;
    rendered.add(key);
    const cells = first === second ? [first] : [first, second];
    const coreX = core.x / 2;
    const coreY = core.y / 2;
    const cellParts = cells.map((index) => {
      const { row, column } = cellCoordinates(state.level.width, index);
      const x = column + 0.5;
      const y = row + 0.5;
      return `<rect class="note-cell" x="${column + 0.1}" y="${row + 0.1}" width="0.8" height="0.8" rx="0.1"/>
        <path class="note-line" d="M ${coreX} ${coreY} L ${x} ${y}"/>
        <polygon class="note-arrow" points="${noteArrowMarkup(coreX, coreY, x, y)}"/>`;
    });
    markup.push(`<g>${cellParts.join("")}</g>`);
  }
  return markup.join("");
}

function birthMarkup() {
  if (!state.evaluation.complete || state.reducedMotion) return "";
  return state.level.cores.map((core, index) => {
    const cx = core.x / 2;
    const cy = core.y / 2;
    const radius = 0.28 + (index % 3) * 0.035;
    const colour = RARITIES.find(({ id }) => id === core.rarity)?.colour ?? "#86f2d0";
    return `<g>
      <ellipse class="birth-orbit" cx="${cx}" cy="${cy}" rx="${radius}" ry="${radius * 0.43}" transform="rotate(${index * 37} ${cx} ${cy})"/>
      <circle class="birth-planet" cx="${cx + radius}" cy="${cy}" r="0.055" style="--planet-colour:${colour}"/>
    </g>`;
  }).join("");
}

function cursorDescription() {
  const { x, y } = state.cursor;
  const core = state.level.cores.find((candidate) => candidate.x === x && candidate.y === y);
  if (core) return `${core.label}，${core.rarity}`;
  if (x % 2 === 1 && y % 2 === 1) {
    return `第 ${(y + 1) / 2} 行第 ${(x + 1) / 2} 列方格`;
  }
  if ((x + y) % 2 === 1) return "内部网格边";
  return "网格交点";
}

function renderBoard() {
  const { width, height } = state.level;
  elements.board.dataset.gridSize = String(width);
  elements.board.closest(".board-frame")?.classList.toggle("is-wide-board", width >= 9);
  elements.board.setAttribute("viewBox", `-0.28 -0.28 ${width + 0.56} ${height + 0.56}`);
  elements.board.classList.toggle("is-note-mode", state.mode === "note");
  elements.board.classList.toggle("is-complete", state.evaluation.complete);

  const cellMarkup = [];
  for (let index = 0; index < width * height; index += 1) {
    const { row, column } = cellCoordinates(width, index);
    const component = state.evaluation.components[state.evaluation.componentOf[index]];
    const valid = state.evaluation.validCells.has(index);
    const colour = COMPONENT_COLOURS[(component?.id ?? 0) % COMPONENT_COLOURS.length];
    cellMarkup.push(`<rect class="cell-fill${valid ? " is-valid" : ""}" x="${column}" y="${row}" width="1" height="1"
      style="--cell-colour:${colour};--cell-delay:${(index % 11) * -0.12}s"/>`);
  }

  const gridMarkup = state.level.edges.map((edge) => (
    `<line class="grid-line${edge.legal ? "" : " is-core-blocked"}" x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}"/>`
  )).join("");
  const boundaries = [...state.session.position.edges].map((edgeId) => edgeById(state.level, edgeId)).filter(Boolean);
  const boundaryMarkup = boundaries.map((edge) => (
    `<line class="user-boundary-shadow" x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}"/>
     <line class="user-boundary" x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}"/>`
  )).join("");
  const coreMarkup = state.level.cores.map((core) => {
    const cx = core.x / 2;
    const cy = core.y / 2;
    const colour = RARITIES.find(({ id }) => id === core.rarity)?.colour ?? "#ffd58e";
    return `<g class="core--${core.type}" style="--core-colour:${colour}">
      <circle class="core-halo" cx="${cx}" cy="${cy}" r="0.3"/>
      <circle class="core-shell" cx="${cx}" cy="${cy}" r="0.16"/>
      <polygon class="core-star" points="${svgStarPoints(cx, cy, 0.12, 0.052)}"/>
      <circle class="core-ring" cx="${cx}" cy="${cy}" r="0.23"/>
      ${state.selectedCoreId === core.id ? `<circle class="selected-core-ring" cx="${cx}" cy="${cy}" r="0.34"/>` : ""}
    </g>`;
  }).join("");
  const cursorX = state.cursor.x / 2;
  const cursorY = state.cursor.y / 2;
  const cursorMarkup = `<circle class="board-cursor" cx="${cursorX}" cy="${cursorY}" r="0.19"/>`;

  elements.board.setAttribute(
    "aria-label",
    `${state.level.title}，${width} 乘 ${height} 育床，${state.level.cores.length} 枚星核。当前${cursorDescription()}，使用${state.mode === "draw" ? "边界笔" : state.mode === "erase" ? "擦除笔" : "归属笔记"}。`,
  );
  elements.board.innerHTML = `<g aria-hidden="true">
    <rect class="bed-backdrop" x="0" y="0" width="${width}" height="${height}" rx="0.16"/>
    ${cellMarkup.join("")}
    ${gridMarkup}
    ${boundaryMarkup}
    <rect class="outer-boundary" x="0" y="0" width="${width}" height="${height}" rx="0.06"/>
    ${noteMarkup()}
    ${coreMarkup}
    ${birthMarkup()}
    ${cursorMarkup}
  </g>`;
  window.requestAnimationFrame(updateBoardPanControls);
}

function updateBoardPanControls() {
  if (!elements?.boardScroll) return;
  const maximum = Math.max(0, elements.boardScroll.scrollWidth - elements.boardScroll.clientWidth);
  elements.boardPanLeft.disabled = elements.boardScroll.scrollLeft <= 1;
  elements.boardPanRight.disabled = elements.boardScroll.scrollLeft >= maximum - 1;
}

function panBoard(direction) {
  const distance = Math.max(120, elements.boardScroll.clientWidth * 0.7) * direction;
  elements.boardScroll.scrollBy({ left: distance, behavior: state.reducedMotion ? "auto" : "smooth" });
  window.setTimeout(updateBoardPanControls, state.reducedMotion ? 0 : 280);
}

function statusCopy() {
  if (state.evaluation.complete) {
    return {
      board: `全部 ${state.evaluation.validComponentCount} 片星云已稳定，新生星系正在点亮。`,
      title: "孵化完成",
      detail: "每片空间连通、含唯一星核，并与半周旋转后的自身重合。",
      className: "is-complete",
    };
  }
  if (state.evaluation.invalidComponentCount > 0) {
    return {
      board: `发现 ${state.evaluation.invalidComponentCount} 个封闭矛盾区域；擦除边界，让星核与对称伙伴重新连通。`,
      title: "封闭区域仍有矛盾",
      detail: "每片星云必须恰含一个位于旋转中心的星核，且内部不能残留边界。",
      className: "is-warning",
    };
  }
  if (state.session.position.edges.size === 0) {
    return {
      board: "育床尚未分区。选择边界笔，从星核附近开始观察旋转对称。",
      title: "等待第一段孵化边界",
      detail: "星核可能落在格心、边心或角点；边界永远不能穿过星核。",
      className: "",
    };
  }
  if (state.evaluation.validComponentCount > 0) {
    return {
      board: `${state.evaluation.validComponentCount} 片星云已经稳定，其余空间仍可继续划分。`,
      title: "局部星云已点亮",
      detail: "亮起的格子已经形成合法区域；继续检查未发光空间的连通与半周对称。",
      className: "",
    };
  }
  return {
    board: "边界正在延伸；尚未封闭出完整、唯一星核且旋转对称的区域。",
    title: "星云边界正在成形",
    detail: "交点附近若方向含糊不会落笔；靠近目标边的中段再试。",
    className: "",
  };
}

function renderDifficultyButtons() {
  elements.difficultyButtons.replaceChildren();
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `difficulty-button${difficulty.id === state.difficulty ? " is-active" : ""}`;
    button.dataset.difficulty = difficulty.id;
    button.textContent = difficulty.shortLabel;
    button.setAttribute("aria-pressed", String(difficulty.id === state.difficulty));
    button.setAttribute("aria-label", `${difficulty.label}，${difficulty.note}`);
    button.addEventListener("click", (event) => {
      chooseDifficulty(difficulty.id);
      if (event.detail === 0) elements.board.focus({ preventScroll: true });
    });
    elements.difficultyButtons.append(button);
  }
}

function renderAtlas() {
  elements.atlasCount.textContent = String(state.atlas.completed.size);
  elements.rarityStrip.innerHTML = RARITIES.map((rarity) => (
    `<span class="rarity-chip${state.atlas.rarities.has(rarity.id) ? " is-discovered" : ""}" style="--chip-colour:${rarity.colour}">
      <i aria-hidden="true"></i>${rarity.id}${state.atlas.rarities.has(rarity.id) ? " · 已发现" : " · 待发现"}
    </span>`
  )).join("");
  elements.zeroConflictBadge.classList.toggle("is-unlocked", state.atlas.badges.zeroConflict);
  elements.intuitionBadge.classList.toggle("is-unlocked", state.atlas.badges.intuition);
}

function render() {
  const difficulty = difficultyById(state.difficulty);
  const levels = levelsForDifficulty(state.difficulty);
  const levelIndex = Math.max(0, levels.findIndex(({ id }) => id === state.level.id));
  const progress = Math.round(state.evaluation.progress * 100);
  const status = statusCopy();

  elements.levelKicker.textContent = `${difficulty.label} · ${String(levelIndex + 1).padStart(2, "0")}`;
  elements.levelTitle.textContent = state.level.title;
  elements.progressPercent.textContent = `${progress}%`;
  elements.progressBar.style.width = `${progress}%`;
  elements.progressMeter.setAttribute("aria-valuenow", String(progress));
  elements.validCount.textContent = String(state.evaluation.validComponentCount);
  elements.coreTotal.textContent = `/ ${state.level.cores.length} 片`;
  elements.conflictCount.textContent = String(state.evaluation.invalidComponentCount);
  elements.edgeCount.textContent = String(state.session.position.edges.size);
  elements.moveCount.textContent = String(state.session.moves);
  elements.difficultyNote.textContent = `${state.level.width}×${state.level.height} · ${state.level.cores.length} 枚星核 · 求解器已证明唯一`;
  elements.undoButton.disabled = state.session.history.length === 0;

  elements.boardStatus.textContent = status.board;
  elements.boardStatus.className = `board-status${status.className ? ` ${status.className}` : ""}`;
  elements.labMessage.className = `lab-message${status.className ? ` ${status.className}` : ""}`;
  const labText = elements.labMessage.querySelector("p");
  labText.innerHTML = `<strong>${status.title}</strong><span>${status.detail}</span>`;

  for (const button of elements.toolButtons) {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  renderDifficultyButtons();
  renderAtlas();
  renderBoard();
}

function resetCursor() {
  state.cursor = { x: state.level.width, y: state.level.height };
}

function clearVictoryPresentation({ close = false } = {}) {
  window.clearTimeout(victoryTimer);
  victoryTimer = 0;
  if (victoryBlocker && victoryBlockerHandler) {
    victoryBlocker.removeEventListener("close", victoryBlockerHandler);
  }
  victoryBlocker = null;
  victoryBlockerHandler = null;
  if (close && elements.victoryDialog.open) elements.victoryDialog.close();
}

function openVictoryWhenClear() {
  victoryTimer = 0;
  if (!state.evaluation.complete || elements.victoryDialog.open) return;
  const blocker = [...document.querySelectorAll("dialog[open]")]
    .find((dialog) => dialog !== elements.victoryDialog);
  if (blocker) {
    victoryBlocker = blocker;
    victoryBlockerHandler = () => {
      victoryBlocker = null;
      victoryBlockerHandler = null;
      window.setTimeout(openVictoryWhenClear, 0);
    };
    blocker.addEventListener("close", victoryBlockerHandler, { once: true });
    return;
  }
  elements.victoryMoves.textContent = String(state.session.moves);
  elements.victoryRegions.textContent = `${state.evaluation.validComponentCount} / ${state.level.cores.length}`;
  elements.victoryConflicts.textContent = String(state.run.conflicts);
  elements.victoryDiscovery.textContent = state.lastDiscovery || `图鉴已记录：${state.level.title}`;
  if (typeof elements.victoryDialog.showModal === "function") elements.victoryDialog.showModal();
  else elements.victoryDialog.setAttribute("open", "");
}

function scheduleVictory(discovery) {
  clearVictoryPresentation();
  state.lastDiscovery = discovery;
  victoryTimer = window.setTimeout(openVictoryWhenClear, state.reducedMotion ? 80 : 850);
}

function parForLevel(level) {
  if (parCache.has(level.id)) return parCache.get(level.id);
  const par = solvePuzzle(level, { limit: 1 }).solutions[0]?.edges.size ?? 0;
  parCache.set(level.id, par);
  return par;
}

function reportSharedCompletion() {
  const difficultyIndex = DIFFICULTIES.findIndex(({ id }) => id === state.difficulty);
  const payload = {
    levelId: state.level.id,
    tier: difficultyIndex + 1,
    moves: state.session.moves,
    par: parForLevel(state.level),
  };
  if (window.RealmArcade?.complete) {
    window.RealmArcade.complete(payload);
  } else {
    (window.__realmCompletionQueue ??= []).push(payload);
  }
  return true;
}

function registerCompletion() {
  const discoveries = [];
  if (!state.atlas.completed.has(state.level.id)) {
    state.atlas.completed.add(state.level.id);
    discoveries.push(state.level.title);
  }
  for (const core of state.level.cores) {
    if (!state.atlas.rarities.has(core.rarity)) {
      state.atlas.rarities.add(core.rarity);
      discoveries.push(`${core.rarity}星核`);
    }
  }
  if (!state.run.hadConflict && !state.atlas.badges.zeroConflict) {
    state.atlas.badges.zeroConflict = true;
    discoveries.push("零矛盾孵化徽章");
  }
  if (!state.run.usedNotes && !state.atlas.badges.intuition) {
    state.atlas.badges.intuition = true;
    discoveries.push("对称直觉徽章");
  }
  persistAtlas();
  renderAtlas();

  if (!state.completionReported) {
    try {
      // Assignment happens only after the synchronous report (or queue write)
      // succeeds. If the shared reward layer throws, the saved false value lets
      // bootstrap retry this completed board on the next visit.
      state.completionReported = reportSharedCompletion();
      persistGame();
    } catch {
      showToast("星系已经孵化；共享进度稍后可在谜游馆中同步。", { assertive: true });
    }
  }
  playSound("complete");
  elements.assertiveStatus.textContent = `孵化完成：${state.level.title}。`;
  const discovery = discoveries.length > 0
    ? `图鉴新增：${discoveries.join("、")}`
    : `图鉴已记录：${state.level.title}`;
  scheduleVictory(discovery);
}

function commitMove(move, { transaction = null, sound = true } = {}) {
  const previousEvaluation = state.evaluation;
  const result = applySessionMove(state.level, state.session, move);
  if (!result.accepted) return result;

  // Reward efficiency is measured against the number of boundaries in a
  // solved layout, so every accepted boundary/note edit must use that same
  // atomic unit. A pointer drag may touch several edges; each edge is therefore
  // a move and an undo step instead of collapsing the whole gesture to one.
  state.session = result.session;
  if (transaction) transaction.changed = true;

  if (move.type === "toggle-note") state.run.usedNotes = true;
  state.evaluation = evaluatePosition(state.level, state.session.position);
  const newConflicts = Math.max(
    0,
    state.evaluation.invalidComponentCount - previousEvaluation.invalidComponentCount,
  );
  if (newConflicts > 0) state.run.hadConflict = true;
  state.run.conflicts += newConflicts;
  persistGame();
  render();

  if (newConflicts > 0) playSound("invalid");
  else if (sound) {
    if (result.effect === "edge-added") playSound("draw");
    else if (result.effect === "edge-removed") playSound("erase");
    else playSound("note");
  }
  if (!previousEvaluation.complete && state.evaluation.complete) registerCompletion();
  return result;
}

function rejectionMessage(reason) {
  const messages = {
    "note-outside": "这个方格绕所选星核旋转后会落到育床之外。",
    "note-on-core": "格心星核所在的方格不需要归属笔记。",
    "region-complete": "这片星云已经稳定，不再接受归属笔记。",
    "invalid-note-target": "请先选择一枚星核，再标记方格。",
    "core-blocked": "边界不能穿过星核。",
  };
  return messages[reason] ?? "当前位置没有可执行的操作。";
}

function applyTarget(target, { transaction = null, quiet = false } = {}) {
  if (!target) {
    if (!quiet) showToast("交点附近方向不明确，请靠近目标边的中段再试。");
    return false;
  }
  if (state.evaluation.complete) {
    if (!quiet) showToast("这枚星胚已经完成；可撤销一步或培育下一枚。");
    return false;
  }

  if (state.mode === "note") {
    if (target.type === "core") {
      state.selectedCoreId = target.coreId;
      render();
      const core = coreById(state.level, target.coreId);
      if (!quiet) showToast(`已选择${core.label}；现在点选一个方格。`);
      playSound("note");
      return true;
    }
    if (target.type !== "cell" || !state.selectedCoreId) {
      if (!quiet) showToast("归属笔记需要先选择星核，再选择方格。");
      return false;
    }
    const result = commitMove({
      type: "toggle-note",
      cell: target.cell,
      coreId: state.selectedCoreId,
    }, { transaction });
    if (!result.accepted && !quiet) {
      showToast(rejectionMessage(result.reason));
      playSound("invalid");
    }
    return result.accepted;
  }

  if (target.type !== "edge") {
    if (!quiet) showToast("星核拥有触控优先区，边界不能从星核上穿过。请靠近边中部。");
    return false;
  }
  const result = commitMove({
    type: "set-edge",
    edgeId: target.edgeId,
    value: state.mode === "draw",
  }, { transaction, sound: !transaction?.soundPlayed });
  if (result.accepted && transaction) transaction.soundPlayed = true;
  return result.accepted;
}

function pointerTarget(point) {
  const edgeTolerance = Math.min(
    cssPixelsToBoardUnits(elements.board, POINTER_RADIUS_CSS_PX),
    MAX_COMPACT_EDGE_TOLERANCE,
  );
  const ambiguityGap = Math.min(
    cssPixelsToBoardUnits(elements.board, AMBIGUITY_GAP_CSS_PX),
    MAX_COMPACT_AMBIGUITY_GAP,
  );
  return resolvePointerTarget(state.level, point, {
    mode: state.mode,
    // Dense 9x9 boards leave roughly one cell between many cores. Keep the
    // full 44px core target for note selection, but let draw/erase reach an
    // adjacent legal edge. An exact-core tap still resolves to the core and
    // is rejected by applyTarget, so this cannot create a path through it.
    coreTolerance: state.mode === "note"
      ? cssPixelsToBoardUnits(elements.board, POINTER_RADIUS_CSS_PX)
      : 0,
    edgeTolerance,
    ambiguityGap,
  });
}

function updateCursorFromPoint(point) {
  state.cursor = {
    x: clamp(Math.round(point.x * 2), 0, state.level.width * 2),
    y: clamp(Math.round(point.y * 2), 0, state.level.height * 2),
  };
}

function onPointerDown(event) {
  if (event.button !== 0 || document.querySelector("dialog[open]")) return;
  ensureAudio();
  const point = clientToBoardPoint(elements.board, event);
  if (!point) return;
  updateCursorFromPoint(point);
  const target = pointerTarget(point);
  pointerGesture = {
    pointerId: event.pointerId,
    visited: new Set(),
    changed: false,
    history: null,
    moves: null,
    soundPlayed: false,
  };
  try {
    elements.board.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture may be unavailable in synthetic test events.
  }
  if (target?.type === "edge") pointerGesture.visited.add(target.edgeId);
  applyTarget(target, { transaction: pointerGesture });
  event.preventDefault();
}

function onPointerMove(event) {
  if (!pointerGesture || pointerGesture.pointerId !== event.pointerId || state.mode === "note") return;
  const samples = typeof event.getCoalescedEvents === "function"
    ? [...event.getCoalescedEvents(), event]
    : [event];
  let handled = false;
  for (const sample of samples) {
    const point = clientToBoardPoint(elements.board, sample);
    if (!point) continue;
    const target = pointerTarget(point);
    if (target?.type !== "edge" || pointerGesture.visited.has(target.edgeId)) continue;
    pointerGesture.visited.add(target.edgeId);
    updateCursorFromPoint(point);
    handled = applyTarget(target, { transaction: pointerGesture, quiet: true }) || handled;
  }
  if (handled) event.preventDefault();
}

function finishPointer(event) {
  if (!pointerGesture || pointerGesture.pointerId !== event.pointerId) return;
  pointerGesture = null;
  try {
    if (elements.board.hasPointerCapture(event.pointerId)) {
      elements.board.releasePointerCapture(event.pointerId);
    }
  } catch {
    // Capture can already be gone after pointercancel/lostpointercapture.
  }
}

function setMode(mode, { focusBoard = false } = {}) {
  if (!["draw", "erase", "note"].includes(mode)) return;
  state.mode = mode;
  if (mode !== "note") state.selectedCoreId = null;
  persistPreferences();
  render();
  showToast(mode === "draw" ? "边界笔已启用。" : mode === "erase" ? "擦除笔已启用。" : "归属笔记：先选择星核，再选择方格。");
  if (focusBoard) elements.board.focus({ preventScroll: true });
}

function startLevel(level, { message = "已换入一枚新星胚。", focusBoard = false } = {}) {
  clearVictoryPresentation({ close: true });
  state.level = level;
  state.difficulty = level.difficulty;
  state.session = restartSession(level);
  state.evaluation = evaluatePosition(level, state.session.position);
  state.run = { conflicts: 0, hadConflict: false, usedNotes: false };
  state.completionReported = false;
  state.selectedCoreId = null;
  state.lastDiscovery = "";
  resetCursor();
  persistGame();
  render();
  elements.boardScroll.scrollLeft = 0;
  updateBoardPanControls();
  showToast(message);
  if (focusBoard) elements.board.focus({ preventScroll: true });
}

function chooseDifficulty(difficultyId, { focusBoard = false } = {}) {
  const difficulty = DIFFICULTIES.find(({ id }) => id === difficultyId);
  if (!difficulty) return;
  const level = levelsForDifficulty(difficulty.id)[0];
  startLevel(level, { message: `已切换到${difficulty.label}。`, focusBoard });
}

function nextLevel({ focusBoard = false } = {}) {
  const levels = levelsForDifficulty(state.difficulty);
  const index = Math.max(0, levels.findIndex(({ id }) => id === state.level.id));
  const next = levels[(index + 1) % levels.length];
  startLevel(next, { message: `新星胚「${next.title}」已进入育床。`, focusBoard });
}

function restart({ focusBoard = false } = {}) {
  startLevel(state.level, { message: "当前星胚已恢复到未分区状态。", focusBoard });
}

function undo({ focusBoard = false } = {}) {
  clearVictoryPresentation({ close: true });
  const result = undoSession(state.level, state.session);
  if (!result.accepted) {
    showToast("还没有可以撤销的观测步骤。");
  } else {
    state.session = result.session;
    state.evaluation = evaluatePosition(state.level, state.session.position);
    persistGame();
    render();
    playSound("undo");
    showToast("已撤销上一步观测。" );
  }
  if (focusBoard) elements.board.focus({ preventScroll: true });
}

function cursorTarget() {
  const { x, y } = state.cursor;
  if (state.mode === "note") {
    const core = state.level.cores.find((candidate) => candidate.x === x && candidate.y === y);
    if (core) return { type: "core", coreId: core.id, distance: 0 };
    if (x % 2 !== 1 || y % 2 !== 1) return null;
    const column = (x - 1) / 2;
    const row = (y - 1) / 2;
    if (row < 0 || column < 0 || row >= state.level.height || column >= state.level.width) return null;
    return { type: "cell", cell: row * state.level.width + column };
  }
  if ((x + y) % 2 !== 1) return null;
  const edge = state.level.legalEdges.find((candidate) => (
    candidate.midpointX === x && candidate.midpointY === y
  ));
  return edge ? { type: "edge", edgeId: edge.id, distance: 0 } : null;
}

const CURSOR_DIRECTIONS = Object.freeze({
  ArrowUp: Object.freeze({ x: 0, y: -1 }),
  ArrowRight: Object.freeze({ x: 1, y: 0 }),
  ArrowDown: Object.freeze({ x: 0, y: 1 }),
  ArrowLeft: Object.freeze({ x: -1, y: 0 }),
});

function onBoardKeyDown(event) {
  if (document.querySelector("dialog[open]")) return;
  const direction = CURSOR_DIRECTIONS[event.key];
  if (direction) {
    ensureAudio();
    state.cursor = {
      x: clamp(state.cursor.x + direction.x, 0, state.level.width * 2),
      y: clamp(state.cursor.y + direction.y, 0, state.level.height * 2),
    };
    render();
    event.preventDefault();
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    ensureAudio();
    applyTarget(cursorTarget());
    elements.board.focus({ preventScroll: true });
    event.preventDefault();
  }
}

function editableTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select")) return true;
  const editable = target.closest("[contenteditable]");
  return Boolean(editable && editable.getAttribute("contenteditable") !== "false");
}

function onGlobalKeyDown(event) {
  if (event.defaultPrevented || editableTarget(event.target) || document.querySelector("dialog[open]")) return;
  if (event.altKey || (event.shiftKey && event.key !== "?")) return;
  const key = event.key.toLowerCase();
  const unmodified = !event.metaKey && !event.ctrlKey;
  let handled = true;
  ensureAudio();
  if (key === "1" && unmodified) setMode("draw", { focusBoard: true });
  else if (key === "2" && unmodified) setMode("erase", { focusBoard: true });
  else if (key === "3" && unmodified) setMode("note", { focusBoard: true });
  else if ((key === "z" || key === "u") && unmodified && !event.shiftKey) undo({ focusBoard: true });
  else if (key === "r" && unmodified) restart({ focusBoard: true });
  else if (key === "n" && unmodified) nextLevel({ focusBoard: true });
  else if (key === "m" && unmodified) toggleMute({ focusBoard: true });
  else if (event.key === "Escape" && state.selectedCoreId) {
    state.selectedCoreId = null;
    render();
    elements.board.focus({ preventScroll: true });
    showToast("已取消归属笔记的星核选择。");
  }
  else if (event.key === "?" && unmodified) openRules(elements.board);
  else handled = false;
  if (handled) event.preventDefault();
}

function openRules(opener) {
  if (elements.rulesDialog.open || elements.victoryDialog.open) return;
  rulesOpener = opener instanceof HTMLElement ? opener : elements.board;
  if (typeof elements.rulesDialog.showModal === "function") elements.rulesDialog.showModal();
  else elements.rulesDialog.setAttribute("open", "");
  elements.rulesCloseButton.focus({ preventScroll: true });
}

function closeRules() {
  if (!elements.rulesDialog.open) return;
  if (typeof elements.rulesDialog.close === "function") elements.rulesDialog.close();
  else {
    elements.rulesDialog.removeAttribute("open");
    elements.rulesDialog.dispatchEvent(new Event("close"));
  }
}

function collectElements() {
  const byId = (id) => document.getElementById(id);
  return {
    board: byId("nebula-board"),
    boardScroll: byId("board-scroll"),
    boardPanLeft: byId("board-pan-left"),
    boardPanRight: byId("board-pan-right"),
    boardStatus: byId("board-status"),
    labMessage: byId("lab-message"),
    progressPercent: byId("progress-percent"),
    progressBar: byId("progress-bar"),
    progressMeter: document.querySelector(".hatch-meter"),
    validCount: byId("valid-count"),
    coreTotal: byId("core-total"),
    conflictCount: byId("conflict-count"),
    edgeCount: byId("edge-count"),
    moveCount: byId("move-count"),
    levelKicker: byId("level-kicker"),
    levelTitle: byId("level-title"),
    difficultyButtons: byId("difficulty-buttons"),
    difficultyNote: byId("difficulty-note"),
    newGameButton: byId("new-game-button"),
    restartButton: byId("restart-button"),
    undoButton: byId("undo-button"),
    toolButtons: [...document.querySelectorAll(".tool-button[data-mode]")],
    muteButton: byId("mute-button"),
    rulesButton: byId("rules-button"),
    footerRulesButton: byId("footer-rules-button"),
    rulesDialog: byId("rules-dialog"),
    rulesCloseButton: byId("rules-close-button"),
    victoryDialog: byId("victory-dialog"),
    victoryMoves: byId("victory-moves"),
    victoryRegions: byId("victory-regions"),
    victoryConflicts: byId("victory-conflicts"),
    victoryDiscovery: byId("victory-discovery"),
    nextLevelButton: byId("next-level-button"),
    stayButton: byId("stay-button"),
    atlasCount: byId("atlas-count"),
    rarityStrip: byId("rarity-strip"),
    zeroConflictBadge: byId("zero-conflict-badge"),
    intuitionBadge: byId("intuition-badge"),
    toast: byId("toast"),
    assertiveStatus: byId("assertive-status"),
    saveState: byId("save-state"),
  };
}

function bindEvents() {
  elements.board.addEventListener("pointerdown", onPointerDown);
  elements.board.addEventListener("pointermove", onPointerMove);
  elements.board.addEventListener("pointerup", finishPointer);
  elements.board.addEventListener("pointercancel", finishPointer);
  elements.board.addEventListener("lostpointercapture", finishPointer);
  elements.board.addEventListener("keydown", onBoardKeyDown);
  elements.boardScroll.addEventListener("scroll", updateBoardPanControls, { passive: true });
  elements.boardPanLeft.addEventListener("click", () => panBoard(-1));
  elements.boardPanRight.addEventListener("click", () => panBoard(1));

  for (const button of elements.toolButtons) {
    button.addEventListener("click", (event) => setMode(button.dataset.mode, { focusBoard: event.detail === 0 }));
  }
  elements.newGameButton.addEventListener("click", (event) => nextLevel({ focusBoard: event.detail === 0 }));
  elements.restartButton.addEventListener("click", (event) => restart({ focusBoard: event.detail === 0 }));
  elements.undoButton.addEventListener("click", (event) => undo({ focusBoard: event.detail === 0 }));
  elements.muteButton.addEventListener("click", (event) => toggleMute({ focusBoard: event.detail === 0 }));
  elements.rulesButton.addEventListener("click", () => openRules(elements.rulesButton));
  elements.footerRulesButton.addEventListener("click", () => openRules(elements.footerRulesButton));
  elements.rulesCloseButton.addEventListener("click", closeRules);
  elements.rulesDialog.addEventListener("click", (event) => {
    if (event.target === elements.rulesDialog) closeRules();
  });
  elements.rulesDialog.addEventListener("close", () => {
    const target = rulesOpener?.isConnected ? rulesOpener : elements.board;
    rulesOpener = null;
    target.focus?.({ preventScroll: true });
  });

  elements.stayButton.addEventListener("click", () => {
    elements.victoryDialog.close();
    elements.board.focus({ preventScroll: true });
  });
  elements.nextLevelButton.addEventListener("click", () => {
    elements.victoryDialog.close();
    nextLevel({ focusBoard: true });
  });
  elements.victoryDialog.addEventListener("close", () => {
    if (state.evaluation.complete) elements.board.focus({ preventScroll: true });
  });

  document.addEventListener("keydown", onGlobalKeyDown);
  window.addEventListener("resize", updateBoardPanControls, { passive: true });
  window.addEventListener("pointerdown", ensureAudio, { capture: true, once: true });
  window.addEventListener("keydown", ensureAudio, { capture: true, once: true });
  state.motionQuery.addEventListener?.("change", (event) => {
    state.reducedMotion = event.matches;
    renderBoard();
  });
}

function bootstrap() {
  elements = collectElements();
  if (!elements.board) return;
  const preferences = loadPreferences();
  const atlas = loadAtlas();
  const game = loadGame();
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? {
    matches: false,
    addEventListener() {},
  };
  state = {
    ...game,
    mode: preferences.mode,
    selectedCoreId: null,
    cursor: { x: game.level.width, y: game.level.height },
    atlas: atlas.atlas,
    muted: preferences.muted,
    motionQuery,
    reducedMotion: motionQuery.matches,
    lastDiscovery: "",
  };
  bindEvents();
  updateMuteControl();
  render();
  persistGame();
  if (state.evaluation.complete) {
    if (state.completionReported) scheduleVictory(`图鉴已记录：${state.level.title}`);
    else registerCompletion();
  }
  if (game.invalid || atlas.invalid || preferences.invalid || !storageHealthy) {
    window.setTimeout(showStorageWarning, 0);
  }
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const start = () => {
    if (document.getElementById("nebula-board")) bootstrap();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
