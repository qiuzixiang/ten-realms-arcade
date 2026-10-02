import { analyse, buildAdjacency, createState, solveLevel } from "./engine.mjs";

const fills = ["#317d9f", "#bd583a", "#8b60a7", "#4b8751"];
const marks = ["麟", "羽", "狐", "龟"];

export function renderTutorialMap(level, state, caption) {
  const height = level.layout.length;
  const width = level.layout[0].length;
  const size = 52;
  const margin = 18;
  const adjacency = buildAdjacency(level.layout);
  const conflicts = new Set(analyse(state, level).conflicts.flat());
  const centers = new Map();
  level.layout.forEach((row, y) => row.forEach((region, x) => {
    const list = centers.get(region) || [];
    list.push([x, y]);
    centers.set(region, list);
  }));
  const anchors = new Map();
  for (const [region, cells] of centers) {
    const point = cells[Math.floor(cells.length / 2)];
    anchors.set(region, point);
  }
  const body = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const region = level.layout[y][x];
      const colour = state.colours[region];
      const fill = colour >= 0 ? fills[colour] : "#a4ad8c";
      const px = margin + x * size;
      const py = margin + 32 + y * size;
      const rightBoundary = x + 1 < width && level.layout[y][x + 1] !== region;
      const bottomBoundary = y + 1 < height && level.layout[y + 1][x] !== region;
      body.push(`<rect x="${px}" y="${py}" width="${size}" height="${size}" fill="${fill}" stroke="#f3e8c8" stroke-width="${rightBoundary || bottomBoundary ? 4 : 1}"/>`);
      if (anchors.get(region)[0] === x && anchors.get(region)[1] === y) {
        body.push(`<text x="${px + size / 2}" y="${py + size * 0.66}" text-anchor="middle" font-family="sans-serif" font-size="23" font-weight="700" fill="#fffaf0">${colour >= 0 ? marks[colour] : region + 1}</text>`);
      }
      if (Object.prototype.hasOwnProperty.call(level.clues, String(region)) && anchors.get(region)[0] === x && anchors.get(region)[1] === y) {
        body.push(`<circle cx="${px + size - 8}" cy="${py + 8}" r="6" fill="#ffe6a0" stroke="#26372f" stroke-width="2"/>`);
      }
    }
  }
  const lineHeight = width * size;
  const legend = ["水麟", "火羽", "月狐", "森龟"].map((name, index) => `<text x="${margin + index * lineHeight / 4 + 8}" y="${margin + 32 + lineHeight + 34}" font-family="sans-serif" font-size="15" font-weight="700" fill="#f8f0da">${name}</text>`).join("");
  const selectedInfo = `${caption} · ${[...adjacency].length}片栖境`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" viewBox="0 0 ${margin * 2 + width * size} ${margin * 2 + height * size + 86}"><title id="title">${level.title}：${caption}</title><desc id="desc">真实首关地图。亮色圆点标出固定神龛。全部方格按同一题面布局绘制，区域通过共享边界识别。</desc><rect width="100%" height="100%" rx="20" fill="#102b26"/><text x="${margin}" y="21" font-family="sans-serif" font-size="13" fill="#e6d38e">${selectedInfo}</text>${body.join("")}${legend}</svg>`;
  return svg;
}

export function createTutorialStates(level) {
  const initial = createState(level);
  const solved = solveLevel(level, { limit: 1 }).solutions[0];
  if (!solved) throw new Error("Tutorial level has no solution.");
  const region = level.clues[0] === undefined ? 0 : Array.from({ length: initial.colours.length }, (_, index) => index).find((index) => level.clues[index] === undefined);
  const action = { region, colour: solved[region] };
  const afterAction = { ...initial, colours: [...initial.colours], notes: [...initial.notes], moves: 1 };
  afterAction.colours[region] = action.colour;
  const completed = { ...initial, colours: [...solved], notes: [...initial.notes], moves: initial.colours.filter((c) => c < 0).length };
  if (!analyse(afterAction, level) || !analyse(completed, level).solved) throw new Error("Tutorial states do not match the game rules.");
  return { initial, afterAction, completed, action };
}
