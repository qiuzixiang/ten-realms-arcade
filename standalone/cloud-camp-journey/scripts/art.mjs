/** Original, deterministic vector artwork. Run: node scripts/art.mjs.
 * Runtime assets are self-contained SVG/PNG; sharp is needed only to regenerate PNGs.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let sharp;
for (const candidate of [process.env.CLOUD_CAMP_SHARP, 'sharp', '/Users/qiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'].filter(Boolean)) {
  try { sharp = require(candidate); break; } catch { /* Try the next explicitly configured runtime. */ }
}
if (!sharp) throw new Error('PNG regeneration needs sharp. Install it locally or set CLOUD_CAMP_SHARP to its module path.');
await Promise.all(['assets', 'release'].map(dir => mkdir(resolve(root, dir), { recursive: true })));

const themes = [
  { name: '晨露草甸', sky: '#edf0dc', glow: '#f6dba0', mountain: '#bac8ae', peak: '#d0d7bd', far: '#8fac8b', mid: '#74977b', ground: '#acb887', front: '#d0ce98', leaf: '#355c48', leafLight: '#568064', detail: '#f5eac8', tent: '#db864e', tentLight: '#e8a468', door: '#6a6449' },
  { name: '杉林风声', sky: '#dce5d8', glow: '#f2ddb0', mountain: '#93b4a5', peak: '#b9cbbc', far: '#567e68', mid: '#73977b', ground: '#98b397', front: '#bdc49b', leaf: '#294e41', leafLight: '#527761', detail: '#e0e8c5', tent: '#cd8451', tentLight: '#e0a778', door: '#4a5847' },
  { name: '溪谷野餐', sky: '#e2ebe4', glow: '#f2deb0', mountain: '#acc6ba', peak: '#cad9c9', far: '#7e9e8c', mid: '#91b194', ground: '#b7c49b', front: '#d6d5a8', leaf: '#3b6756', leafLight: '#6d9170', detail: '#fff2ce', tent: '#d58051', tentLight: '#e9ab7d', door: '#68654c' },
  { name: '日落山坡', sky: '#f1d0ae', glow: '#e8a25b', mountain: '#c69b88', peak: '#dbb19a', far: '#b68f70', mid: '#aa996e', ground: '#c2ad77', front: '#e2c48b', leaf: '#6b7150', leafLight: '#8d8a5c', detail: '#fae6b5', tent: '#b66543', tentLight: '#db9361', door: '#715145' },
  { name: '星夜营地', sky: '#283e50', glow: '#f1dba5', mountain: '#41586c', peak: '#536c7a', far: '#3c645f', mid: '#497468', ground: '#62836c', front: '#8b9976', leaf: '#223f3d', leafLight: '#3b5e51', detail: '#e4dbad', tent: '#ce8351', tentLight: '#dfa25e', door: '#f1d591' },
  { name: '云海远行', sky: '#d9e6e4', glow: '#f6e5b5', mountain: '#91ada9', peak: '#b9c9c1', far: '#6c9384', mid: '#90ac94', ground: '#aeba8e', front: '#d0d1a5', leaf: '#3e6657', leafLight: '#658a70', detail: '#f5efda', tent: '#cb7c4b', tentLight: '#e6a267', door: '#5a6551' }
];

function defs(p, extra = '') {
  return `<defs>
    <filter id="paper-shadow" x="-25%" y="-30%" width="150%" height="170%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#263e32" flood-opacity=".14"/></filter>
    <filter id="soft-shadow" x="-30%" y="-40%" width="160%" height="190%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#263e32" flood-opacity=".16"/></filter>
    <pattern id="paper-fleck" width="78" height="64" patternUnits="userSpaceOnUse"><path d="M5 14h1m24 25h1m24-33h1M70 53h1M12 57h1" stroke="#fff" stroke-opacity=".25" stroke-linecap="round"/><path d="M42 21h1M21 2h1M4 37h1m57-5h1" stroke="#526b53" stroke-opacity=".09" stroke-linecap="round"/></pattern>
    <linearGradient id="sky-wash" x2="0" y2="1"><stop stop-color="${p.sky}"/><stop offset="1" stop-color="${p.detail}"/></linearGradient>
    <linearGradient id="tent-wash" x2="0" y2="1"><stop stop-color="${p.tentLight}"/><stop offset="1" stop-color="${p.tent}"/></linearGradient>
    ${extra}
  </defs>`;
}
function pine(x, y, scale, p, flip = false) {
  return `<g transform="translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})" filter="url(#soft-shadow)"><path d="M-4-6h8v21h-8z" fill="#796d4f"/><path d="M0-142-29-92h12l-33 51h16l-28 39Q-2 13 59-2L31-41h17L16-92h12z" fill="${p.leaf}"/><path d="M0-142v143Q29 7 59-2L31-41h17L16-92h12z" fill="${p.leafLight}"/><path d="M0-124v119M-28-42l28 8M0-34l28-8M-18-83l18 7M0-76l15-7" fill="none" stroke="${p.detail}" stroke-width="1.4" opacity=".2"/></g>`;
}
function tent(x, y, scale, p) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cx="12" cy="13" rx="124" ry="18" fill="#314e3f" opacity=".14"/><g filter="url(#paper-shadow)"><path d="m-86 0 75-117 82 2L138 2 48 19z" fill="${p.tent}"/><path d="m-86 0 75-117L48 19z" fill="${p.tentLight}"/><path d="m-11-117 82 2L138 2 48 19z" fill="url(#tent-wash)"/><path d="m-61 1 48-83L29 15z" fill="${p.door}"/><path d="m-61 1 48-83-9 94z" fill="#f3dbab" opacity=".54"/><path d="m-13-82 7 95 35 2z" fill="#263d34" opacity=".21"/><path d="m-11-117 82 2M-11-117 48 19M48 19l90-17" fill="none" stroke="#fff2d0" stroke-width="2" opacity=".67"/><path d="m-7-110 54 118" fill="none" stroke="#8e573e" stroke-width="1" stroke-dasharray="2 4" opacity=".46"/><path d="M83-91 125-17l-13 2-38-69z" fill="#f9ca97" opacity=".37"/><path d="m-11-114-104 119m186-117 103 117" fill="none" stroke="#f7e6bc" stroke-width="2.5"/><path d="m-116 0 2 12M172 1l2 12" stroke="#766850" stroke-width="4" stroke-linecap="round"/><path d="m-15-122 3-9 3 11" fill="none" stroke="#71654e" stroke-width="3" stroke-linejoin="round"/></g></g>`;
}
function cloud(x, y, scale, color, opacity = 1) {
  return `<path transform="translate(${x} ${y}) scale(${scale})" d="M-78 13c-10-19 3-35 25-33 8-31 50-36 64-13 17-19 50-10 51 13 38-4 49 33 23 38H-67c-5 0-9-1-11-5Z" fill="${color}" opacity="${opacity}"/>`;
}
function grass(x, y, s, p) {
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0q-1-17-12-23M0 0q1-28 7-34M0 0q8-14 18-16" fill="none" stroke="${p.leaf}" stroke-width="2" stroke-linecap="round" opacity=".54"/>`;
}
function daisy(x, y, s, p) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0q-4 14 1 27m-1-9 9-7m-9 12-10-5" fill="none" stroke="${p.leafLight}" stroke-width="2"/><g fill="${p.detail}"><ellipse cy="-6" rx="3.5" ry="6"/><ellipse cy="6" rx="3.5" ry="6"/><ellipse cx="-6" rx="6" ry="3.5"/><ellipse cx="6" rx="6" ry="3.5"/></g><circle r="3.4" fill="#d49b52"/></g>`;
}
function scene(index) {
  const p = themes[index];
  const night = index === 4;
  const art = [];
  art.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" role="img" aria-labelledby="scene-title scene-desc"><title id="scene-title">云野露营 · ${p.name}</title><desc id="scene-desc">原创立体裁纸风景：橙色帐篷、松林、层叠山峦与${['晨露野花','林间薄雾','蜿蜒溪水','温暖落日','月光繁星','高山云海'][index]}。装饰插画，不是规则题面。</desc>${defs(p)}<rect width="1000" height="600" fill="url(#sky-wash)"/>`);
  if (night) {
    art.push(`<path d="M751 77a52 52 0 1 0 55 74 49 49 0 0 1-55-74" fill="${p.glow}" filter="url(#soft-shadow)"/>`);
    [[100,72,2],[205,134,2],[340,83,2.6],[465,61,2],[570,131,2],[679,56,1.7],[897,94,2.4],[932,189,1.5],[80,204,1.3],[401,168,1.8],[619,192,1.5]].forEach(([x,y,r])=>art.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${p.glow}" opacity=".9"/>`));
    art.push(`<g stroke="${p.glow}" stroke-width="2" stroke-linecap="round"><path d="M263 51v12m-6-6h12M853 185v9m-4.5-4.5h9M538 87v7m-3.5-3.5h7"/></g><path d="M115 106q214-99 446-3" fill="none" stroke="${p.glow}" opacity=".17" stroke-dasharray="2 10"/>`);
  } else {
    art.push(`<circle cx="${index===3?727:744}" cy="${index===3?204:135}" r="${index===3?90:56}" fill="${p.glow}" filter="url(#paper-shadow)"/>`);
    art.push(cloud(164,118,.79,'#fff9e8',.76), cloud(index===1?675:447,78,.46,'#fff9e8',.64));
  }
  art.push(`<g filter="url(#paper-shadow)"><path d="M-45 343 172 151l83 76 109-118 151 178 101-100 71 65 98-85 261 207v184H-45z" fill="${p.mountain}"/><path d="m364-0 0 0" fill="none"/><path d="m172 151 83 76-24-6-22 9-24-38-18 26-38-12zM364 109l68 80-31-10-24-37-19 16-22-4-18 10zM785 167l71 59-45-13-20-23-23 15-17-8z" fill="${p.peak}"/></g>`);
  if (index===5) art.push(`<g fill="#f5f1df" opacity=".9" filter="url(#paper-shadow)"><path d="M-80 324q61-57 132-15 69-71 164-13 85-55 169 10 84-37 156 14 81-42 160 9 82-52 160-7 110-57 222 14v85H-80z"/><path d="M-40 410q69-57 145-19 76-74 162-27 74-26 137 10 76-44 149-3 76-43 152 5 91-51 186-5 79-45 151 0v81H-40z"/></g>`);
  art.push(`<path d="M-10 346q135-118 299-49 109 48 221-3 156-74 279-4 95 53 221 12v298H-10Z" fill="${p.far}" filter="url(#paper-shadow)"/>`);
  if (index===1) {
    [[85,363,.66],[151,341,.9],[220,367,.71],[288,341,.55],[752,331,.72],[831,339,.97],[913,351,.64]].forEach(([x,y,s])=>art.push(pine(x,y,s,p)));
    art.push(cloud(384,326,2.8,'#e4e8d3',.23));
  }
  art.push(`<path d="M-20 396q185-99 350-24 142 63 300-32 156-94 390 67v193H-20Z" fill="${p.mid}" filter="url(#paper-shadow)"/>`);
  if (index===5) art.push(`<g filter="url(#paper-shadow)"><path d="M-20 389q42-62 103-30 55-51 119-12 59-54 131-14 53-49 114-14 60-36 115 8 56-48 120-15 66-38 128 12 58-32 127 16 61-8 99 27v99H-20Z" fill="#e7ece0"/><path d="M-20 430q63-54 125-14 58-46 111-7 68-36 122 5 54-41 104-7 64-47 130-9 68-48 128-5 75-34 144 0 62-34 176 14v78H-20Z" fill="#f3f1df"/></g>`);
  art.push(`<path d="M-10 450q156-45 329-24 127 17 238-19 218-71 453 68v125H-10Z" fill="${p.ground}" filter="url(#paper-shadow)"/>`);
  if (index===2) {
    art.push(`<path d="M361 342q96 34-3 81-83 42 24 66 69 18 105 111H232q24-44-61-76-80-31 54-81 118-37 94-77Z" fill="#8db9bd" filter="url(#paper-shadow)"/><path d="M344 362q67 18-29 63m-76 51q-72 29-16 45m120 9q40 20 47 45" fill="none" stroke="#e6ebd1" stroke-width="5" stroke-linecap="round" opacity=".8"/><g fill="#cad0b9" filter="url(#soft-shadow)"><ellipse cx="290" cy="433" rx="17" ry="7" transform="rotate(-15 290 433)"/><ellipse cx="258" cy="448" rx="12" ry="6"/><ellipse cx="225" cy="459" rx="15" ry="6"/></g>`);
  } else {
    art.push(`<path d="M418 384q-76 58 48 99 66 23 36 117H349q72-77 26-108-76-54 21-108Z" fill="${p.detail}" opacity=".4"/>`);
  }
  // Distant folded-paper pine groups frame the tent without resembling a grid.
  [[147,407,.86],[214,417,1.19],[302,416,.72],[875,429,.91],[933,424,1.16]].forEach(([x,y,s])=>art.push(pine(x,y,s,p)));
  art.push(`<ellipse cx="654" cy="450" rx="173" ry="28" fill="${p.detail}" opacity=".2"/>`, tent(index===5?618:618,442,1.02,p));
  // A small lantern and folded blanket make the campsite feel lived in.
  art.push(`<g transform="translate(787 449)" filter="url(#soft-shadow)"><path d="m-17 6 26-7 21 12-26 8z" fill="${p.detail}"/><path d="m-11 8 21-6m-13 14 19-6" stroke="${p.tent}" stroke-width="3" opacity=".7"/><path d="M-6-20h11v20H-6z" fill="#e3b871"/><path d="M-8-22H7v5H-8zM-8-2H7v4H-8z" fill="${p.leaf}"/><path d="M-4-23v-5q4-6 7 0v5" fill="none" stroke="${p.leaf}" stroke-width="2"/></g>`);
  if (index===4) art.push(`<ellipse cx="618" cy="447" rx="37" ry="8" fill="#f2d293" opacity=".35"/>`);
  if (index===5) art.push(`<g transform="translate(421 398)"><path d="M0 41V-49" stroke="#766e55" stroke-width="4"/><path d="M2-47h42l-12 13 12 13H2z" fill="${p.tent}" filter="url(#soft-shadow)"/><path d="M13-36h16" stroke="${p.detail}" stroke-width="2"/></g>`);
  if (index===3) art.push(`<g fill="none" stroke="#796749" stroke-width="2.5" stroke-linecap="round" opacity=".72"><path d="M477 132q8-8 16 0 8-8 16 0M539 111q6-6 12 0 6-6 12 0M576 141q5-5 10 0 5-5 10 0"/></g>`);
  art.push(`<path d="M-50 549q174-97 340-25 143 61 313 26 229-47 446-17v85H-50Z" fill="${p.front}" filter="url(#paper-shadow)"/>`);
  [[77,520,1],[143,551,.9],[333,540,.55],[855,534,.85],[925,551,1.25],[506,572,.65]].forEach(([x,y,s])=>art.push(grass(x,y,s,p)));
  if (index!==3 && index!==4) [[100,499,.6],[175,531,.8],[305,523,.52],[813,518,.67],[882,538,.53],[904,509,.42]].forEach(([x,y,s])=>art.push(daisy(x,y,s,p)));
  if (index===3) art.push(`<g fill="none" stroke="#94774f" stroke-width="2" stroke-linecap="round"><path d="M168 554q-8-45 13-73m-14 44-16-17m17 5 17-15m-11-1-10-11M846 541q-9-43 12-79m-15 44-15-14m18 3 14-11"/></g>`);
  if (index===1) {
    art.push(pine(-3,578,1.3,p),pine(1000,586,1.5,p,true));
  } else art.push(`<g fill="${p.leaf}" opacity=".86"><path d="M-11 600v-71q50-9 60 45-33 5-39-25 31 10 57 43 8-57 43-53 12 47-26 61zM1011 600v-67q-49-14-61 33 27 15 40-10-31 12-48 36-14-48-47-40-7 45 26 48z"/></g>`);
  art.push(`<rect width="1000" height="600" fill="url(#paper-fleck)" pointer-events="none"/></svg>`);
  return art.join('');
}

const p = themes[0];
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="icon-title"><title id="icon-title">云野露营：橙色纸帐篷与松树</title>${defs(p, '<clipPath id="icon-clip"><rect width="512" height="512" rx="112"/></clipPath>')}<g clip-path="url(#icon-clip)"><rect width="512" height="512" fill="#f4f0df"/><circle cx="365" cy="132" r="48" fill="#eed29a" filter="url(#soft-shadow)"/>${cloud(107,136,.53,'#fffaf0')}<path d="M-20 311 123 152l87 86 87-104 160 177 75-29v247H-20z" fill="#c2ceba" filter="url(#paper-shadow)"/><path d="m297 134 43 49-23-6-17-21-17 17-16-5z" fill="#e6e6d0"/><path d="M-20 362q110-100 234-38 131-103 318 22v196H-20z" fill="#8eab86" filter="url(#paper-shadow)"/><ellipse cx="260" cy="392" rx="243" ry="95" fill="#bdc797" filter="url(#paper-shadow)"/>${pine(126,345,1.05,p)}${pine(421,357,.76,p)}${tent(264,372,1.26,p)}${daisy(97,411,.77,p)}${grass(406,426,.8,p)}<path d="M-20 472q128-57 257-8 141 53 295-25v93H-20z" fill="#d5d3a2"/><rect width="512" height="512" fill="url(#paper-fleck)"/><rect x="12" y="12" width="488" height="488" rx="103" fill="none" stroke="#fffaf0" stroke-width="3" opacity=".8"/></g></svg>`;

await writeFile(resolve(root, 'assets/scene.svg'), scene(0));
await writeFile(resolve(root, 'assets/icon.svg'), icon);
await Promise.all(themes.map((_,i)=>writeFile(resolve(root, `assets/chapter-${i+1}.svg`), scene(i))));
await sharp(Buffer.from(icon)).resize(512,512).png().toFile(resolve(root, 'release/icon-512.png'));

const coverScene = scene(0).replace('<svg ', '<svg x="-440" y="440" width="1940" height="1164" ');
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440"><rect width="1080" height="1440" fill="#f4f0df"/>${coverScene}<path d="M0 398q540-43 1080 0v111q-540-54-1080 0z" fill="#f4f0df"/><g fill="#355c48" font-family="PingFang SC, Hiragino Sans GB, Noto Sans CJK SC, sans-serif"><text x="82" y="132" font-size="28" letter-spacing="7">CLOUD CAMP JOURNEY</text><text x="74" y="270" font-size="114" font-weight="600" letter-spacing="10">云野露营</text><text x="82" y="349" font-size="34" letter-spacing="4">把一顶帐篷，安放进山野</text></g><path d="M84 395h61" stroke="#db864e" stroke-width="6" stroke-linecap="round"/><g transform="translate(820 111)"><rect x="-30" y="-47" width="184" height="65" rx="10" fill="none" stroke="#799178" stroke-width="2" transform="rotate(8)"/><text x="62" y="1" text-anchor="middle" transform="rotate(8)" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="26" fill="#63816a" letter-spacing="3">露营手账</text></g><rect x="22" y="22" width="1036" height="1396" rx="20" fill="none" stroke="#355c48" stroke-opacity=".17" stroke-width="2"/></svg>`;
await sharp(Buffer.from(cover)).png().toFile(resolve(root,'release/cover-art.png'));

await writeFile(resolve(root, 'release/ART.md'), `# 云野露营美术资产\n\n本目录所列风景、图标和封面由本项目于 2026-09-08 以 SVG 路径原创绘制；未使用外部照片、图库、生成式位图、远程字体或第三方图形。许可：本项目的原创美术以 MIT License 提供，版权归 2026 云野露营项目贡献者；原游戏代码与规则出处由主项目另行记录。\n\n## 文件与用途\n\n- \`assets/scene.svg\`：1000 × 600，首页纸景草甸。帐篷主体约在 x=530–790、y=320–470；中心裁切可保留核心。\n- \`assets/icon.svg\`、\`release/icon-512.png\`：512 × 512，圆角图标。\n- \`assets/chapter-1.svg\` 至 \`chapter-6.svg\`：各 1000 × 600，依次为晨露草甸、杉林风声、溪谷野餐、日落山坡、星夜营地、云海远行。每幅有专属景物与构图变化，用于章节与风景收藏。\n- \`release/cover-art.png\`：1080 × 1440，3:4 宣传封面。仅表现露营世界，不含抽象棋盘，也不作为实际游玩截图。\n\nSVG 提供标题和描述，外层使用图像元素时还应设置具体 alt。装饰背景可以使用空 alt。所有 SVG 均无脚本、网络资源、外部字体或 CSS 依赖；阴影采用浏览器 SVG 滤镜，纸纹使用静态矢量图案。封面标题的系统字体仅在导出 PNG 时参与栅格化，发布图片不依赖字体文件。\n\n## 重新生成\n\n在游戏目录执行 \`node scripts/art.mjs\`。PNG 导出需要 \`sharp\`，优先使用本地模块；可设置 \`CLOUD_CAMP_SHARP\` 为其绝对模块路径。本开发环境也支持已安装的 Codex bundled sharp，游戏运行本身不需要该依赖。生成脚本仅写本清单内资产与本文档，不写主工作区。六幅章节 SVG 与 PNG 导出均为确定性生成。\n\n## 设计范围\n\n风景中的树和帐篷是装饰构图，不对应题面、邻接关系或已解状态。真实三图教程应由规则引擎和正式棋盘 renderer 生成，不能使用这些装饰风景充当规则证据。\n`);
console.log('Generated 8 SVG assets, icon-512.png (512×512), and cover-art.png (1080×1440).');
