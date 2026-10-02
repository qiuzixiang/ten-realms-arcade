/** Presentation-only SVG renderer. Rules and movement remain in core.mjs. */
const CELL = 60;
const PADDING = 20;
const ANGLES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

function levelOf(value) {
  return value.level || value;
}

export function boardDimensions(value) {
  const level = levelOf(value);
  const width = level.width ?? level.grid[0].length;
  const height = level.height ?? level.grid.length;
  return { width: width * CELL + PADDING * 2, height: height * CELL + PADDING * 2 };
}

export function cellPoint(_gameOrLevel, { x, y }) {
  return { x: PADDING + x * CELL + CELL / 2, y: PADDING + y * CELL + CELL / 2 };
}

function pointList(level, cells) {
  return cells.map((cell) => {
    const p = cellPoint(level, cell);
    return `${p.x},${p.y}`;
  }).join(' ');
}

function prefixFor(value) {
  const safe = String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `sd-${safe || 'board'}`;
}

function remainingOf(game, level) {
  if (game.remainingEnergy != null) return new Set(game.remainingEnergy);
  const cells = [];
  level.grid.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile === 'e') cells.push(`${x},${y}`);
  }));
  return new Set(cells);
}

function anchorMarkup(x, y, start = false) {
  return `<g transform="translate(${x} ${y})" data-tile="anchor">
    <circle r="23" fill="#63d9c3" fill-opacity=".045"/>
    <circle r="19" fill="none" stroke="#70d9c8" stroke-opacity=".47" stroke-width="1"/>
    <circle r="14" fill="#1c5555" fill-opacity=".55" stroke="#95f0d9" stroke-width="2" stroke-dasharray="17 5" transform="rotate(8)"/>
    <circle r="6" fill="none" stroke="#b2f8e3" stroke-opacity=".7" stroke-width="1.2"/>
    <path d="M-23 0h5 M18 0h5 M0-23v5 M0 18v5" stroke="#b2f8e3" stroke-width="2"/>
    ${start ? '<circle r="2" fill="#b2f8e3"/>' : '<path d="M-2 0h4 M0-2v4" stroke="#b2f8e3" stroke-width="1.2"/>'}
  </g>`;
}

function energyMarkup(x, y, id) {
  return `<g transform="translate(${x} ${y})" data-tile="energy">
    <ellipse cy="16" rx="14" ry="4" fill="#020d16" fill-opacity=".7"/>
    <circle r="21" fill="url(#${id}-energy-halo)"/>
    <path d="M0-18 13-2 0 16-13-2Z" fill="#ffbb91" fill-opacity=".17" stroke="#fcaf84" stroke-opacity=".38" stroke-width=".7"/>
    <path d="M0-14 10-2 0 12-10-2Z" fill="url(#${id}-crystal)" stroke="#ffe3bd" stroke-width="1.2"/>
    <path d="M0-14 1-2-10-2ZM1-2 0 12 10-2Z" fill="#fff1c9" fill-opacity=".6"/>
    <path d="M-10-2H10 M0-14 1-2 0 12" fill="none" stroke="#ffe4c1" stroke-width=".7"/>
    <circle cx="18" cy="-13" r="1.2" fill="#fbe3b9"/>
    <path d="M-17 9v5 M-19.5 11.5h5" stroke="#eaa378" stroke-opacity=".6" stroke-width=".8"/>
  </g>`;
}

function mineMarkup(x, y, id) {
  return `<g transform="translate(${x} ${y})" data-tile="mine">
    <ellipse cy="17" rx="16" ry="4" fill="#020b13" fill-opacity=".8"/>
    <circle r="23" fill="none" stroke="#ef847e" stroke-opacity=".17" stroke-dasharray="2 5"/>
    <path d="M-3-11 0-22 3-11 8-7 19-11 13-1 13 4 19 11 8 10 3 13 0 22-3 12-8 8-19 11-13 1-13-4-19-11-8-10Z" fill="#6d4449" stroke="#e6938f" stroke-width="1.2" stroke-linejoin="round"/>
    <circle r="12" fill="url(#${id}-mine)" stroke="#f59b91" stroke-width="1.2"/>
    <path d="M-4-4 4 4 M4-4-4 4" stroke="#ffdbbd" stroke-width="2.3" stroke-linecap="round"/>
    <path d="M-7-8a11 11 0 0 1 11-2" fill="none" stroke="#ffd8c7" stroke-opacity=".65" stroke-width="1"/>
  </g>`;
}

function wallMarkup(x, y, id) {
  return `<g transform="translate(${x} ${y})" data-tile="wall">
    <rect x="-26" y="-24" width="52" height="53" rx="7" fill="#03131d" fill-opacity=".68"/>
    <rect x="-25" y="-24" width="50" height="50" rx="6" fill="#1b3945" stroke="#305261" stroke-width="1"/>
    <rect x="-25" y="-30" width="50" height="50" rx="6" fill="url(#${id}-wall)" stroke="#587780" stroke-opacity=".53" stroke-width="1"/>
    <path d="M-18-28H18a5 5 0 0 1 5 5 M-23-23v34" fill="none" stroke="#a4bcc0" stroke-opacity=".18" stroke-width="1"/>
    <path d="M-15-18h12 M-15-14h5 M12 10h6" fill="none" stroke="#93b4b8" stroke-opacity=".28" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M-16 19H16" stroke="#0a2634" stroke-width="1.5"/>
    <circle cx="17" cy="-20" r="1.4" fill="#4e7780"/>
  </g>`;
}

function shipMarkup(game, id) {
  const p = cellPoint(game, game.position || levelOf(game).start || { x: 0, y: 0 });
  const angle = ANGLES[game.lastMove?.direction] ?? 0;
  const lost = game.status === 'lost';
  return `<g data-ship transform="translate(${p.x} ${p.y})">
    <ellipse cy="12" rx="20" ry="8" fill="#000812" fill-opacity=".68"/>
    <circle r="27" fill="#bcfff2" fill-opacity=".035" stroke="${lost ? '#f18c84' : '#a2dfd9'}" stroke-opacity=".23" stroke-width=".8"/>
    <g data-ship-heading transform="rotate(${angle})">
      <path d="M-5 13Q-7 25 0 29 7 25 5 13Z" fill="#ffae85" fill-opacity=".16"/>
      <path d="M-3 13Q-4 22 0 25 4 22 3 13Z" fill="#ffa780"/>
      <path d="M-1.5 13 0 20 1.5 13Z" fill="#fff1cd"/>
      <path d="M0-23 8-7 20 12 19 17 6 12 0 16-6 12-19 17-20 12-8-7Z" fill="url(#${id}-ship)" stroke="${lost ? '#ffae9a' : '#f8f3d9'}" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M0-23V14L-6 11-17 14-7-6Z" fill="#f4efd8" fill-opacity=".35"/>
      <path d="M0-11 5 1 3 7H-3L-5 1Z" fill="#175e68" stroke="#7dd3cd" stroke-width="1" stroke-linejoin="round"/>
      <path d="M0-8 2 1H-2Z" fill="#b8f4e7" fill-opacity=".8"/>
      <path d="M-10 3-13 9 M10 3l3 6" stroke="#6e8a8e" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M-17 12-12 11 M12 11l5 1" stroke="#a4eee3" stroke-width="2" stroke-linecap="round"/>
      <path d="M-3 12H3" stroke="#60747b" stroke-width="2"/>
    </g>
  </g>`;
}

// Opt-in decoration: a redraw for hints, undo, or reduced motion stays still.
function effectsMarkup(game, id, enabled) {
  if (!enabled || !['playing', 'won'].includes(game.status) || !game.lastMove?.collected?.length) return '';
  const bursts = game.lastMove.collected.map((cell, index) => {
    const { x, y } = cellPoint(game, cell);
    const rays = Array.from({ length: 6 }, (_, ray) => `<path transform="rotate(${ray * 60 + index * 17})" d="M0-11 1.3-17 0-24-1.3-17Z" fill="${ray % 2 ? '#ffca9b' : '#fff1ca'}"/>`).join('');
    return `<g id="${id}-collect-${index}" data-collect-effect transform="translate(${x} ${y})" opacity="0">
      <animate attributeName="opacity" values="0;.8;.55;0" keyTimes="0;.12;.45;1" dur="440ms" fill="freeze"/>
      <circle r="8" fill="none" stroke="#ffdbab" stroke-width="1.1" stroke-opacity=".65">
        <animate attributeName="r" from="8" to="26" dur="440ms" fill="freeze"/>
      </circle>
      <circle r="4" fill="#fff2cd" fill-opacity=".65">
        <animate attributeName="r" from="4" to="1" dur="320ms" fill="freeze"/>
      </circle>
      ${rays}
    </g>`;
  }).join('');
  let edge = '';
  if (game.status === 'won') {
    const { width, height } = boardDimensions(game);
    const left = PADDING - 4, right = width - PADDING + 4;
    const top = PADDING - 4, bottom = height - PADDING + 4;
    const spots = [[left, top + 20], [width / 2, top], [right, top + 20], [left, bottom - 20], [width / 2, bottom], [right, bottom - 20]];
    edge = `<g id="${id}-completion-glints" data-completion-effect opacity="0" fill="#d8ffe9">
      <animate attributeName="opacity" values="0;.55;.25;0" keyTimes="0;.2;.55;1" dur="480ms" fill="freeze"/>
      ${spots.map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0-5 1.1-1.1 5 0 1.1 1.1 0 5-1.1 1.1-5 0-1.1-1.1Z"/>`).join('')}
    </g>`;
  }
  return `<g data-effects pointer-events="none" aria-hidden="true">${bursts}${edge}</g>`;
}

/** Return SVG children so the same board can be used in gameplay or diagrams. */
export function boardMarkup(game, { idPrefix = 'board', preview = null, showCoordinates = true, effects = false } = {}) {
  const level = levelOf(game);
  const grid = game.grid || level.grid;
  const columns = level.width ?? grid[0].length;
  const rows = level.height ?? grid.length;
  const { width, height } = boardDimensions(level);
  const id = prefixFor(idPrefix);
  const remaining = remainingOf(game, level);
  const floor = [];
  const objects = [];
  const coords = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const p = cellPoint(level, { x, y });
      const tile = grid[y][x];
      floor.push(`<rect x="${p.x - 29}" y="${p.y - 29}" width="58" height="58" rx="4" fill="${(x + y) % 2 ? '#0c2633' : '#102d39'}" fill-opacity=".78" stroke="#75bbb9" stroke-opacity=".09" stroke-width=".7"/>`);
      if (tile !== '#') {
        floor.push(`<path d="M${p.x - 23} ${p.y - 23}h3 M${p.x - 23} ${p.y - 23}v3 M${p.x + 23} ${p.y + 23}h-3 M${p.x + 23} ${p.y + 23}v-3" fill="none" stroke="#83bebc" stroke-opacity=".17" stroke-width=".8"/>`);
      }
      if (tile === '#') objects.push(wallMarkup(p.x, p.y, id));
      if (tile === 'o' || tile === '@') objects.push(anchorMarkup(p.x, p.y, tile === '@'));
      if (tile === 'e' && remaining.has(`${x},${y}`)) objects.push(energyMarkup(p.x, p.y, id));
      if (tile === 'e' && !remaining.has(`${x},${y}`)) objects.push(`<path transform="translate(${p.x} ${p.y})" d="M0-3 3 0 0 3-3 0Z" fill="#dcbe91" fill-opacity=".2"/>`);
      if (tile === 'x') objects.push(mineMarkup(p.x, p.y, id));
    }
  }

  if (showCoordinates) {
    for (let x = 0; x < columns; x += 1) coords.push(`<text x="${PADDING + x * CELL + CELL / 2}" y="12" text-anchor="middle">${x + 1}</text>`);
    for (let y = 0; y < rows; y += 1) coords.push(`<text x="9" y="${PADDING + y * CELL + CELL / 2 + 3}" text-anchor="middle">${y + 1}</text>`);
  }

  let trail = '';
  if (game.lastMove?.path?.length) {
    const path = game.lastMove.from ? [game.lastMove.from, ...game.lastMove.path] : game.lastMove.path;
    trail = `<polyline points="${pointList(level, path)}" fill="none" stroke="#b5e7dd" stroke-opacity=".13" stroke-width="2" stroke-dasharray="1 8" stroke-linecap="round"/>`;
  }

  let projectedPath = '';
  if (preview?.path?.length && game.position) {
    const end = cellPoint(level, preview.path[preview.path.length - 1]);
    const danger = preview.stopReason === 'mine' || preview.status === 'lost';
    const color = danger ? '#ff9c8b' : '#c0f1dc';
    projectedPath = `<g data-preview pointer-events="none">
      <polyline points="${pointList(level, [game.position, ...preview.path])}" fill="none" stroke="#05151d" stroke-opacity=".85" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${pointList(level, [game.position, ...preview.path])}" fill="none" stroke="${color}" stroke-opacity=".9" stroke-width="2" stroke-dasharray="5 6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${end.x}" cy="${end.y}" r="25" fill="${color}" fill-opacity=".05" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 4"/>
      ${danger ? `<path d="M${end.x - 8} ${end.y - 8}l16 16 M${end.x + 8} ${end.y - 8}l-16 16" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>` : `<circle cx="${end.x}" cy="${end.y}" r="3" fill="${color}"/>`}
    </g>`;
  }

  return `<defs>
    <linearGradient id="${id}-platform" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#173747"/><stop offset="1" stop-color="#071824"/></linearGradient>
    <linearGradient id="${id}-wall" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#45616a"/><stop offset="1" stop-color="#2a4753"/></linearGradient>
    <linearGradient id="${id}-crystal" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#ffe5b4"/><stop offset=".5" stop-color="#f5ab82"/><stop offset="1" stop-color="#dc766d"/></linearGradient>
    <radialGradient id="${id}-energy-halo"><stop stop-color="#ffca96" stop-opacity=".28"/><stop offset="1" stop-color="#ffac86" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}-mine" cx=".3" cy=".25"><stop stop-color="#bc7473"/><stop offset="1" stop-color="#673d48"/></radialGradient>
    <linearGradient id="${id}-ship" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffae7"/><stop offset=".5" stop-color="#dedecb"/><stop offset="1" stop-color="#9fbbb8"/></linearGradient>
  </defs>
  <rect x="${PADDING - 4}" y="${PADDING + 3}" width="${columns * CELL + 8}" height="${rows * CELL + 8}" rx="10" fill="#020d15" fill-opacity=".7"/>
  <rect x="${PADDING - 4}" y="${PADDING - 4}" width="${columns * CELL + 8}" height="${rows * CELL + 8}" rx="10" fill="url(#${id}-platform)" stroke="#75b8bb" stroke-opacity=".27" stroke-width="1"/>
  <g data-floor>${floor.join('')}</g>
  <g data-trail pointer-events="none">${trail}</g>
  <g data-objects>${objects.join('')}</g>
  ${effectsMarkup(game, id, effects)}
  ${projectedPath}
  ${shipMarkup(game, id)}
  <g fill="#8dacb1" fill-opacity=".68" font-family="ui-monospace, SFMono-Regular, monospace" font-size="8" aria-hidden="true">${coords.join('')}</g>
  <path d="M${PADDING - 4} ${PADDING + 11}v-8q0-7 7-7h8 M${width - PADDING - 11} ${height - PADDING + 4}h8q7 0 7-7v-8" fill="none" stroke="#a0d5cd" stroke-opacity=".65" stroke-width="2" stroke-linecap="round"/>`;
}

function boardDescription(game, preview) {
  const level = levelOf(game);
  const remaining = remainingOf(game, level);
  const position = game.position || level.start;
  const status = { won: '已收集所有星核，航行完成', lost: '撞到暗雷，航行中断', playing: '航行中' }[game.status] || '待启航';
  const location = position ? `飞船位于第 ${position.x + 1} 列、第 ${position.y + 1} 行。` : '';
  const anchors = [];
  const mines = [];
  level.grid.forEach((row, y) => [...row].forEach((tile, x) => {
    const spot = `${x + 1} 列 ${y + 1} 行`;
    if (tile === 'x') mines.push(spot);
    if (tile === 'o' || tile === '@') anchors.push(spot);
  }));
  const energy = [...remaining].map((key) => {
    const [x, y] = key.split(',').map(Number);
    return `${x + 1} 列 ${y + 1} 行`;
  });
  let projected = '';
  if (preview?.path?.length) {
    const end = preview.path.at(-1);
    projected = `预览终点为 ${end.x + 1} 列 ${end.y + 1} 行${preview.stopReason === 'mine' ? '，会撞到暗雷' : ''}。`;
  }
  return `${level.name || '星际漂流'}，${level.width ?? level.grid[0].length} 列 ${level.height ?? level.grid.length} 行。${location}${status}。剩余 ${remaining.size} 枚星核${energy.length ? `，位于 ${energy.join('、')}` : ''}。引力锚点位于 ${anchors.join('、') || '无'}。${mines.length ? `暗雷位于 ${mines.join('、')}。` : '无暗雷。'}${projected}`;
}

export function renderBoard(svg, game, options = {}) {
  const { width, height } = boardDimensions(game);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', boardDescription(game, options.preview));
  svg.innerHTML = boardMarkup(game, options);
  // An existing SVG keeps its clock across innerHTML redraws; restart this
  // opt-in, one-shot timeline so later moves animate too.
  if (options.effects && typeof svg.setCurrentTime === 'function') svg.setCurrentTime(0);
  return svg;
}
