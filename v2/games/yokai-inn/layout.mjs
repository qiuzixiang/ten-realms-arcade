const DEFAULT_DESIRED_CELL = 44;
const DEFAULT_MIN_GAP = 2;
const DEFAULT_MAX_GAP = 8;

/**
 * Fit a dense Dominosa board into the available inline space without changing
 * its rows, columns, or pairing rules. Wider mobile boards keep 44 px cells;
 * only the seven-column board at the narrowest supported viewport needs to
 * reduce the cells, while retaining a clear two-tap cell interaction.
 */
export function computeCompactBoardMetrics({
  availableWidth,
  columns,
  desiredCell = DEFAULT_DESIRED_CELL,
  minGap = DEFAULT_MIN_GAP,
  maxGap = DEFAULT_MAX_GAP,
} = {}) {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    throw new RangeError("availableWidth must be a positive finite number.");
  }
  if (!Number.isInteger(columns) || columns < 2) {
    throw new RangeError("columns must be an integer of at least 2.");
  }
  if (!Number.isFinite(desiredCell) || desiredCell <= 0) {
    throw new RangeError("desiredCell must be a positive finite number.");
  }
  if (![minGap, maxGap].every(Number.isFinite) || minGap < 0 || maxGap < minGap) {
    throw new RangeError("gap bounds are invalid.");
  }

  const width = Math.floor(availableWidth);
  const gapSlots = columns - 1;
  const roomForDesiredCell = width - desiredCell * columns;
  const desiredGap = Math.floor(roomForDesiredCell / gapSlots);
  const gap = Math.max(minGap, Math.min(maxGap, desiredGap));
  const cell = Math.max(1, Math.min(desiredCell, Math.floor((width - gap * gapSlots) / columns)));
  const boardWidth = cell * columns + gap * gapSlots;

  return Object.freeze({
    cell,
    gap,
    boardWidth,
    availableWidth: width,
    fits: boardWidth <= width,
  });
}
