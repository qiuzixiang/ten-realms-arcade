import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {} });
for (const file of ['engine.js', 'levels.js', 'art.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, 'src', file), 'utf8'), context, { filename: file });
}
const { CraneEngine: engine, CraneLevels: catalogue, CraneArt: art } = context.window;
const level = catalogue.levels[0];
const initial = engine.create(level);
const first = engine.apply(initial, level.solution[0]);
const complete = engine.replay(level, level.solution);
if (first === initial || engine.count(first) !== engine.count(initial) - 1 || !engine.won(complete)) throw new Error('Tutorial truth chain failed.');
fs.mkdirSync(path.join(base, 'assets'), { recursive: true });
fs.mkdirSync(path.join(base, 'release'), { recursive: true });
const write = (file, source) => fs.writeFileSync(path.join(base, file), source + '\n');
write('assets/tutorial-1.svg', art.boardSvg(level, initial, { stage: 'initial', selected: level.solution[0].from, destinations: [level.solution[0].to] }));
write('assets/tutorial-2.svg', art.boardSvg(level, first, { stage: 'first-move', move: level.solution[0] }));
write('assets/tutorial-3.svg', art.boardSvg(level, complete, { stage: 'complete' }));

const nest = (svg, x, y, size) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `);
const open = (width, height, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${label}</title>`;
const landscape = open(1600, 900, 'An origami crane rests above an emerald garden pond. Promotional illustration, not a game board.') + `
  <defs>
    <linearGradient id="water" x2="0" y2="1"><stop stop-color="#39665a"/><stop offset="1" stop-color="#173e3b"/></linearGradient>
    <linearGradient id="paper" x2="0" y2="1"><stop stop-color="#faf3e4"/><stop offset="1" stop-color="#e4d4b7"/></linearGradient>
    <pattern id="grain" width="22" height="18" patternUnits="userSpaceOnUse"><path d="M2 4h5m6 9h3M19 2v2" stroke="#bbaa83" stroke-width=".6" opacity=".14"/></pattern>
  </defs>
  <rect width="1600" height="900" fill="#f5ecd9"/>
  <path d="M0 236 252 149 547 206 891 110 1170 172 1600 42V655H0Z" fill="#e5ddc7"/>
  <path d="m0 272 282-70 275 61 340-108 259 61 444-119v368H0Z" fill="#eee4cf"/>
  <path d="M0 370Q320 287 749 336T1600 233V900H0Z" fill="url(#water)"/>
  <path d="M0 364Q344 288 729 331T1600 230" fill="none" stroke="#d4c6a8" stroke-width="24"/>
  <path d="M0 350Q355 285 734 320T1600 218" fill="none" stroke="#f8f0db" stroke-width="20"/>
  <circle cx="1250" cy="238" r="157" fill="#d4c6a7"/>
  <circle cx="1242" cy="226" r="157" fill="#f9f0dc"/>
  <circle cx="1242" cy="226" r="126" fill="#dcd5bd"/>
  <path d="M1129 281q95-132 229-18v107h-229" fill="#b5bca5"/>
  <circle cx="1213" cy="171" r="40" fill="#f3e4c5"/>
  <path d="M1116 286q115-33 252 3v75h-252" fill="#467363"/>
  <path d="M1111 329q132-29 264 3" stroke="#a3af8e" stroke-width="2" fill="none"/>
  <path d="m1538 69-42 291m28-215-90-53m80 105-126-42m116 97-117-9m101 76-69 21" stroke="#657c64" stroke-width="7" fill="none"/>
  <g fill="#758970"><path d="m1427 90-64-21 45 51Z"/><path d="m1447 138-76-7 54 41Z"/><path d="m1383 164-84-9 57 42Z"/><path d="m1385 231-66-28 36 55Z"/><path d="m1447 246 44-64-6 71Z"/><path d="m1425 340-69 14 60-44Z"/></g>
  <g fill="none" stroke="#b2c1a2" opacity=".20"><path d="M86 447q223-57 391 0t456 0 510-3"/><path d="M175 473q180-25 300 2m644-22q230-26 390 9"/><ellipse cx="695" cy="699" rx="411" ry="103"/><ellipse cx="695" cy="699" rx="466" ry="125"/><path d="M0 820q330-75 557 8m445-156q238-76 598-33"/></g>
  <path d="M1214 719 1427 647 1555 698 1335 779Z" fill="#152f2d" opacity=".25"/>
  <path d="M1245 663 1430 608 1555 657 1364 723Z" fill="#ded0b2"/><path d="M1245 663v27l119 62v-29Z" fill="#bbaa89"/><path d="m1364 723 191-66v27l-191 68Z" fill="#cbbb98"/>
  <path d="m1378 807 192-72 130 61-203 82Z" fill="#e5d8bd"/><path d="m1378 807v24l119 65v-18Z" fill="#c4b496"/>
  <path d="M91 856 43 784 88 685 134 768Z" fill="#566d59"/><path d="M91 856 88 685 102 771Z" fill="#8b9c77"/>
  <path d="M172 900 159 763 235 666 222 802Z" fill="#607759"/><path d="M172 900 235 666 194 805Z" fill="#8a9e79"/>
  ${nest(art.lotusSvg(), 408, 442, 552)}
  ${nest(art.craneSvg(), 441, 293, 501)}
  ${nest(art.lotusSvg(), 180, 426, 151)}
  ${nest(art.lotusSvg(), 1025, 454, 114)}
  <g fill="#efbb95"><path d="m1067 529 8-27 9 27 26-8-13 21-24 5-23-15Z"/><path d="m247 520 6-19 8 18 16-6-8 15-17 3-18-9Z"/></g>
  <g fill="#e9c395" opacity=".8"><path d="m909 177 22 11-12 4Z"/><path d="m930 166 20 9-11 3Z"/></g>
  <rect width="1600" height="900" fill="url(#grain)"/>
</svg>`;
write('assets/cover.svg', landscape);

const icon = open(512, 512, 'Paper Crane Journey icon') + `
  <rect width="512" height="512" rx="108" fill="#f4ead5"/>
  <rect x="24" y="24" width="464" height="464" rx="89" fill="#264f46"/>
  <circle cx="263" cy="185" r="136" fill="#658271"/>
  <circle cx="263" cy="185" r="116" fill="#244d44"/>
  <circle cx="281" cy="145" r="61" fill="#d4c49f"/>
  <path d="M51 360q140-27 267 6t144 0M72 397q156-19 372 0" stroke="#d5d9b3" stroke-width="2" fill="none" opacity=".27"/>
  ${nest(art.lotusSvg(), 92, 212, 327)}
  ${nest(art.craneSvg(), 97, 92, 322)}
  <path d="m411 62-5 61m-1-40-29-20m29 39-34-10" stroke="#9ca982" stroke-width="3" fill="none"/>
</svg>`;
write('assets/icon.svg', icon);
write('release/icon.svg', icon);

const promo = open(1080, 1440, '纸鹤归旅：纸间一隅，慢慢归巢。宣传封面。') + `
  <rect width="1080" height="1440" fill="#f5ecd9"/>
  <path d="M66 56h948v1328H66Z" fill="none" stroke="#cdbc99" stroke-width="2"/>
  <text x="540" y="147" text-anchor="middle" font-family="serif" font-size="27" letter-spacing="11" fill="#627461">纸 间 一 隅 · 慢 慢 归 巢</text>
  <text x="540" y="327" text-anchor="middle" font-family="serif" font-size="146" letter-spacing="12" fill="#244d44">纸鹤归旅</text>
  <path d="M470 382h140" stroke="#b17b54" stroke-width="3"/>
  ${landscape.replace(/<svg [^>]+>/, '<svg x="-255" y="451" width="1600" height="900" viewBox="0 0 1600 900">').replace(/<title>[^<]+<\/title>/, '')}
  <path d="M0 1210q530-110 1080 0v230H0Z" fill="#f5ecd9"/>
  <text x="540" y="1266" text-anchor="middle" font-family="serif" font-size="37" letter-spacing="4" fill="#244d44">一次轻跃，少一只纸鹤</text>
  <text x="540" y="1324" text-anchor="middle" font-family="sans-serif" font-size="25" letter-spacing="3" fill="#657363">六章庭院 · 每日归巢 · 随时撤销</text>
</svg>`;
write('release/cover.svg', promo);
console.log(`Generated vector art and true tutorial: ${level.id}, ${engine.count(initial)} → ${engine.count(first)} → ${engine.count(complete)} cranes.`);
