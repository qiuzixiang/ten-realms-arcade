export const FACE_VISUALS = Object.freeze({
  sun: Object.freeze({ index: "Ⅰ", name: "曜面" }),
  tide: Object.freeze({ index: "Ⅱ", name: "潮面" }),
  seed: Object.freeze({ index: "Ⅲ", name: "生面" }),
  wing: Object.freeze({ index: "Ⅳ", name: "翼面" }),
  eye: Object.freeze({ index: "Ⅴ", name: "观面" }),
  echo: Object.freeze({ index: "Ⅵ", name: "回面" }),
});

export const ROLL_VISUALS = Object.freeze({
  north: Object.freeze({ arrow: "↑", axis: "X", quarterTurns: 1, label: "向上翻滚" }),
  east: Object.freeze({ arrow: "→", axis: "Z", quarterTurns: 1, label: "向右翻滚" }),
  south: Object.freeze({ arrow: "↓", axis: "X", quarterTurns: -1, label: "向下翻滚" }),
  west: Object.freeze({ arrow: "←", axis: "Z", quarterTurns: -1, label: "向左翻滚" }),
});

export function rollVisual(direction) {
  const visual = ROLL_VISUALS[direction];
  if (!visual) throw new TypeError(`Unknown direction: ${direction}`);
  return visual;
}

export function rollTransform(baseTransform, direction, fraction = 1) {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new RangeError("Roll animation fraction must be between 0 and 1");
  }
  const visual = rollVisual(direction);
  const degrees = 90 * visual.quarterTurns * fraction;
  return `${baseTransform} rotate${visual.axis}(${degrees}deg)`;
}
