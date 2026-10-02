export const PALETTE = [
  { name: '红色', light: '#ffefef', base: '#ff3030', dark: '#790000', mark: 'M19 18h10v10H19z' },
  { name: '黄色', light: '#ffffe8', base: '#ffd400', dark: '#8a6200', mark: 'M24 16l8 8-8 8-8-8z' },
  { name: '绿色', light: '#efffef', base: '#22c12f', dark: '#006318', mark: 'M24 16l9 15H15z' },
  { name: '青色', light: '#efffff', base: '#20d9df', dark: '#006d74', mark: 'M16 24h16M24 16v16' },
  { name: '蓝色', light: '#eef4ff', base: '#306eff', dark: '#001a7d', mark: 'M24 17a7 7 0 1 0 0 14a7 7 0 1 0 0-14' },
  { name: '紫色', light: '#fff0ff', base: '#b735e8', dark: '#500075', mark: 'M24 16l2.4 5.6L32 24l-5.6 2.4L24 32l-2.4-5.6L16 24l5.6-2.4z' },
  { name: '粉色', light: '#fff0f8', base: '#ff55ac', dark: '#8a174f', mark: 'M18 17v14M24 17v14M30 17v14' },
];

function definitions(prefix = 'glass') {
  return PALETTE.map((p, i) => `<radialGradient id="${prefix}-body-${i}" cx="32%" cy="24%" r="77%"><stop stop-color="${p.light}"/><stop offset=".40" stop-color="${p.base}"/><stop offset=".84" stop-color="${p.dark}"/><stop offset="1" stop-color="${p.base}"/></radialGradient>
    <radialGradient id="${prefix}-shine-${i}" cx="42%" cy="0%" r="95%"><stop stop-color="white" stop-opacity=".98"/><stop offset=".54" stop-color="white" stop-opacity=".12"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
    <symbol id="${prefix}-bead-${i}" viewBox="0 0 48 48"><ellipse cx="25" cy="42" rx="17" ry="3.5" fill="#000" opacity=".34"/><circle cx="24" cy="23" r="19.8" fill="url(#${prefix}-body-${i})" stroke="#000" stroke-width="1.1"/><ellipse cx="18" cy="13" rx="8" ry="5" fill="#fff" opacity=".78" transform="rotate(-28 18 13)"/><path d="M11 30c5 10 18 13 27 3" fill="none" stroke="${p.light}" opacity=".55" stroke-width="2"/><path class="bead-symbol" d="${p.mark}" fill="none" stroke="white" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" opacity=".42"/></symbol>`).join('');
}
export const defsMarkup = () => `<svg class="svg-library" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>${definitions()}</defs></svg>`;
export const beadMarkup = (color, extra = '') => `<span class="bead ${extra}"><svg viewBox="0 0 48 48" aria-hidden="true"><use href="#glass-bead-${color - 1}"/></svg></span>`;
export const crownMarkup = (className = '') => `<svg class="${className}" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m5 10 5.5 6L16 7l5.5 9 5.5-6-3 15H8L5 10Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 28h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="5" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="5" r="1.5" fill="currentColor"/><circle cx="27" cy="8" r="1.5" fill="currentColor"/></svg>`;

export function tutorialSvg(state, { path = [], selected = -1, cleared = [], prefix = 'lesson' } = {}) {
  const size = 32, margin = 10;
  const cellCenter = (i) => [margin + (i % 9) * size + 16, margin + Math.floor(i / 9) * size + 16];
  let content = '';
  for (let i = 0; i < 81; i++) {
    const [x, y] = cellCenter(i);
    content += `<rect x="${x - 16}" y="${y - 16}" width="32" height="32" fill="${(Math.floor(i / 9) + i % 9) % 2 ? '#e4eae3' : '#ebefe8'}" stroke="#dae1d9" stroke-width=".45"/>`;
    if (cleared.includes(i)) content += `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="#bf944c" stroke-dasharray="2 3"/>`;
    if (state.board[i]) content += `<use href="#${prefix}-bead-${state.board[i] - 1}" x="${x - 16}" y="${y - 16}" width="32" height="32"/>`;
    if (i === selected) content += `<rect x="${x - 15}" y="${y - 15}" width="30" height="30" rx="6" fill="none" stroke="#347563" stroke-width="1.6"/>`;
  }
  if (path.length) content += `<polyline points="${path.map((i) => cellCenter(i).join(',')).join(' ')}" stroke="#397764" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 4" fill="none"/><circle cx="${cellCenter(path[path.length - 1])[0]}" cy="${cellCenter(path[path.length - 1])[1]}" r="6" fill="none" stroke="#397764" stroke-width="1.7"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 308 308" role="img" aria-label="真实规则棋盘示例" data-score="${state.score}" data-balls="${state.board.filter(Boolean).length}"><defs>${definitions(prefix)}</defs><rect width="308" height="308" rx="12" fill="#d3ddd4"/>${content}</svg>`;
}
