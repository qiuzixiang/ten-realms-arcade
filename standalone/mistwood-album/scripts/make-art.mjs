/**
 * Original vector artwork for 雾窗显影. No downloaded artwork or fonts.
 * Rebuild SVG assets: node scripts/make-art.mjs --svg-only
 * Rebuild PNG release art: node scripts/make-art.mjs
 * PNG rendering requires sharp in local node_modules, NODE_PATH, or the
 * bundled Codex runtime. The delivered game has no dependency on this script.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (path, data) => writeFile(resolve(root, path), data);
await mkdir(resolve(root, 'assets'), { recursive: true });
await mkdir(resolve(root, 'release'), { recursive: true });

const leaf = ['000110000', '001111100', '011111110', '111111110', '011111100', '001111000', '000110000', '000100000', '001000000'];
const mountains = ['000000000', '000010000', '000111000', '001111100', '011101110', '111000111', '110000011', '111111111', '111111111'];
const cup = ['000000000', '011111000', '011111110', '011111010', '011111110', '011111000', '001110000', '000000000', '011111110'];
const sprout = ['000000000', '011001100', '011111100', '001111000', '000100000', '000100000', '001110000', '011111000', '011111000'];
function pixels(rows, cell, color = '#d2b276', gap = 1.5) {
  return rows.map((row, y) => row.split('').map((v, x) => v === '1' ? `<rect x="${x * cell}" y="${y * cell}" width="${cell - gap}" height="${cell - gap}" rx="1" fill="${color}"/>` : '').join('')).join('');
}
function photo(x, y, width, rotation, rows, opacity = 1) {
  const h = width * 1.19, border = width * .095, cell = (width - border * 2) / 9;
  return `<g transform="translate(${x} ${y}) rotate(${rotation} ${width / 2} 0)"><rect x="3" y="8" width="${width}" height="${h}" rx="3" fill="#030e0d" opacity=".22"/><rect width="${width}" height="${h}" rx="3" fill="#dfd4b9"/><rect x="${border}" y="${border}" width="${width - border * 2}" height="${width - border * 2}" fill="#254a42"/><g transform="translate(${border} ${border})" opacity="${opacity}">${pixels(rows, cell, '#a4b68f', 1.3)}</g><path d="M${width * .31} ${h - border * .95}h${width * .37}" stroke="#6d7160" stroke-width="1.7" opacity=".5"/><rect x="${width / 2 - 8}" y="-18" width="16" height="38" rx="3" fill="#9b6742"/><path d="M${width / 2} -11v24" stroke="#d2a170" stroke-width="2"/><path d="M${width / 2 - 6} 3h12" stroke="#4b3526" stroke-width="3"/></g>`;
}

const room = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-labelledby="room-title room-desc">
<title id="room-title">雾窗显影：温润暗房</title><desc id="room-desc">墨绿墙面、雾玻璃窗、胡桃木工作台，悬挂的像素照片与赭红安全灯。显影盘里是一张慢慢清晰的叶片照片；这是装饰插画，不是关卡截图。</desc>
<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#183f38"/><stop offset=".55" stop-color="#15322e"/><stop offset="1" stop-color="#102421"/></linearGradient>
  <radialGradient id="lampglow" cx=".78" cy=".26" r=".6"><stop stop-color="#c06837" stop-opacity=".34"/><stop offset=".43" stop-color="#c35c31" stop-opacity=".12"/><stop offset="1" stop-color="#bd582e" stop-opacity="0"/></radialGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#82a69b"/><stop offset=".35" stop-color="#597e71"/><stop offset="1" stop-color="#304d40"/></linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#986b44"/><stop offset=".24" stop-color="#775236"/><stop offset="1" stop-color="#523725"/></linearGradient>
  <linearGradient id="deskfront" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#68472f"/><stop offset="1" stop-color="#3f2b20"/></linearGradient>
  <linearGradient id="tray" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8e927f"/><stop offset="1" stop-color="#515e51"/></linearGradient>
  <radialGradient id="liquid" cx=".5" cy=".2" r="1"><stop stop-color="#899c8a"/><stop offset="1" stop-color="#435b4e"/></radialGradient>
  <linearGradient id="lamp" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d58950"/><stop offset=".35" stop-color="#a45230"/><stop offset="1" stop-color="#653c2a"/></linearGradient>
  <linearGradient id="bottle" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#183d30"/><stop offset=".4" stop-color="#54745a"/><stop offset="1" stop-color="#15372b"/></linearGradient>
  <pattern id="wallgrain" width="73" height="67" patternUnits="userSpaceOnUse"><circle cx="11" cy="9" r="1" fill="#d1c797" opacity=".07"/><circle cx="45" cy="39" r=".8" fill="#d1c797" opacity=".07"/><path d="M67 17h2M19 52h3" stroke="#0b1917" stroke-opacity=".13"/></pattern>
  <clipPath id="windowclip"><path d="M109 395V177a119 119 0 0 1 238 0v218z"/></clipPath>
</defs>
<rect width="1200" height="900" fill="url(#wall)"/>
<rect width="1200" height="900" fill="url(#wallgrain)"/>
<rect width="1200" height="900" fill="url(#lampglow)"/>
<path d="M0 588H1200M0 599H1200" stroke="#071e1a" stroke-width="5" opacity=".6"/>
<path d="M43 0v590M1157 0v590" stroke="#d4c79f" stroke-width="2" opacity=".07"/>
<!-- A quiet arched, rain-fogged window. -->
<path d="M85 431V176a144 144 0 0 1 288 0v255z" fill="#0b2420"/>
<path d="M95 417V177a133 133 0 0 1 266 0v240z" fill="#91694a"/>
<path d="M109 395V177a119 119 0 0 1 238 0v218z" fill="url(#glass)"/>
<g clip-path="url(#windowclip)">
  <path d="M88 352 164 240 216 317 260 226 375 371v70H88Z" fill="#486b5b" opacity=".6"/>
  <path d="M103 345 154 279 181 323 216 265 286 355 341 291 374 355v65H103z" fill="#365744" opacity=".6"/>
  <path d="M123 128v87M150 177v64M183 113v50M216 212v89M260 130v112M295 186v74M327 298v43M165 298v62M307 80v55" stroke="#c6d3b7" stroke-width="3" opacity=".2" stroke-linecap="round"/>
  <path d="M115 102 330 345M96 143 317 396" stroke="#d6dac2" stroke-width="28" opacity=".06"/>
  <path d="M107 360c70-29 151-23 244-13" stroke="#91ad98" stroke-width="2" fill="none" opacity=".45"/>
</g>
<path d="M225 60v339M109 260h238" stroke="#75573e" stroke-width="14"/>
<path d="M229 64v328M110 256h234" stroke="#bd9664" stroke-width="2" opacity=".4"/>
<rect x="78" y="410" width="302" height="23" rx="4" fill="#5c4431"/><path d="M89 414h281" stroke="#ad8358" stroke-width="3"/>
<!-- Film hanging from a slightly bowed drying line. -->
<path d="M393 121Q694 184 1097 111" stroke="#081d19" stroke-width="7" fill="none" opacity=".5"/>
<path d="M394 117Q694 180 1097 107" stroke="#9a9172" stroke-width="3" fill="none"/>
<circle cx="394" cy="117" r="6" fill="#cab07b"/><circle cx="1097" cy="107" r="6" fill="#cab07b"/>
${photo(425, 147, 156, 6, mountains, .33)}
${photo(644, 153, 165, -4, cup, .67)}
${photo(862, 137, 164, 5, leaf, 1)}
<!-- Safe light, copper arm and scalloped reflector. -->
<path d="M1120 0v350h-86" fill="none" stroke="#493b2b" stroke-width="15"/>
<path d="M1124 0v345h-89" fill="none" stroke="#ab8355" stroke-width="4"/>
<path d="M1023 296h38l17 54h-73z" fill="#6b4730"/>
<path d="M1001 332Q1045 318 1084 340l43 61q-78 27-155 0z" fill="url(#lamp)"/>
<ellipse cx="1048" cy="401" rx="76" ry="17" fill="#452d24"/>
<ellipse cx="1048" cy="403" rx="56" ry="10" fill="#eaa866"/>
<path d="M998 393q50-12 100 0" stroke="#f6bd7d" fill="none" opacity=".4" stroke-width="3"/>
<path d="M1004 416 884 591H1176L1090 416" fill="#dda764" opacity=".035"/>
<!-- Shelved keepsakes, darkroom clock and labelled negatives. -->
<rect x="429" y="407" width="295" height="16" rx="3" fill="#58412e"/><path d="M430 408h293" stroke="#ae8050" stroke-width="3"/>
<path d="M449 423v45h14v-45M690 423v45h14v-45" fill="#604731"/>
<rect x="467" y="331" width="36" height="73" rx="2" fill="#ae754a"/><rect x="471" y="340" width="28" height="3" fill="#e2b986"/>
<rect x="506" y="344" width="25" height="60" rx="2" fill="#d6bd8b"/><path d="M515 352v41" stroke="#81674b" stroke-width="2"/>
<rect x="534" y="338" width="31" height="66" rx="2" fill="#6d8b72"/><path d="M539 347h21M539 389h21" stroke="#c9c6a0" stroke-width="2"/>
<circle cx="630" cy="365" r="43" fill="#132924" stroke="#98774b" stroke-width="7"/><circle cx="630" cy="365" r="31" fill="#dbcfac"/><path d="M630 343v23l17 9" stroke="#445248" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="630" cy="365" r="4" fill="#ae7650"/>
<path d="M630 338v4M630 388v4M603 365h4M653 365h4" stroke="#616854" stroke-width="2"/>
<rect x="815" y="385" width="100" height="146" rx="3" fill="#162b24" stroke="#b89a68" stroke-width="5" transform="rotate(4 865 455)"/>
<g transform="translate(832 403) rotate(4 32 50)"><rect width="64" height="95" fill="#443c2e"/><g transform="translate(9 22)">${pixels(sprout, 5.4, '#839277', 1)}</g><path d="M8 84h47" stroke="#c2ad85" opacity=".4"/></g>
<!-- Walnut workbench with long, hand-drawn grain. -->
<path d="M0 642 80 544h1038l82 98v185H0z" fill="url(#wood)"/>
<path d="M0 642h1200v28H0z" fill="#a67b4f"/>
<path d="M0 672h1200v228H0z" fill="url(#deskfront)"/>
<path d="M0 669h1200" stroke="#362c21" stroke-width="7"/>
<g fill="none" stroke="#3b2a1d" stroke-opacity=".25" stroke-width="2">
<path d="M62 564c195 18 297-8 425 1s336 1 593-1M44 586c183-17 339 10 510 0s333 0 553 1M25 618c242 12 367-14 555-1s382-9 574 4"/>
<path d="M245 574c62 17 175 9 148-1-14-6-112-8-148 1ZM824 600c35-11 149-9 163-2-5 11-132 12-163 2z"/>
<path d="M65 746c118-12 197 10 257 0s192-6 258 0M645 804c188-18 320 15 485-2M33 873c137-18 341 13 448 0M700 716c128-12 253 10 416 0"/>
</g>
<path d="M45 701h510v127H45zM605 701h550v127H605z" fill="none" stroke="#2c271d" stroke-width="4" opacity=".42"/>
<path d="M46 700h508M607 700h546" stroke="#bf9060" opacity=".25" stroke-width="2"/>
<rect x="262" y="730" width="78" height="12" rx="6" fill="#362b1e"/><rect x="266" y="731" width="70" height="6" rx="3" fill="#b69662"/>
<rect x="839" y="730" width="78" height="12" rx="6" fill="#362b1e"/><rect x="843" y="731" width="70" height="6" rx="3" fill="#b69662"/>
<!-- Amber chemistry, linen and a handled developing tray. -->
<ellipse cx="182" cy="614" rx="108" ry="18" fill="#291f16" opacity=".22"/>
<path d="M93 550h218l-27 74H58z" fill="#b29c76" opacity=".8"/>
<path d="M90 554 65 619M109 554 84 619M128 554 103 619M147 554 122 619M166 554 141 619M185 554 160 619M204 554 179 619M223 554 198 619M242 554 217 619M261 554 236 619" stroke="#7a7258" stroke-width="1" opacity=".5"/>
<path d="M110 442h42v37q20 5 20 26v88q0 9-9 9h-63q-9 0-9-9v-88q0-21 19-26z" fill="url(#bottle)"/>
<rect x="107" y="432" width="49" height="17" rx="3" fill="#302b20"/><path d="M114 455v20q-15 16-15 42v53" fill="none" stroke="#9cba8c" opacity=".3" stroke-width="5"/>
<rect x="104" y="519" width="56" height="51" rx="2" fill="#d4c19a"/><path d="M116 531h32M121 544h22M123 556h18" stroke="#7c8062" stroke-width="2"/>
<path d="M211 482h35v24q15 7 15 23v65q0 7-7 7h-50q-7 0-7-7v-65q0-16 14-23z" fill="#804b2d"/><rect x="207" y="475" width="43" height="13" rx="3" fill="#382d21"/>
<path d="M212 516q-9 11-9 28v31" stroke="#d89b59" stroke-width="4" fill="none" opacity=".4"/>
<rect x="206" y="544" width="45" height="34" rx="2" fill="#d9bd89"/><path d="M216 555h25M222 564h15" stroke="#936c43" stroke-width="2"/>
<ellipse cx="604" cy="637" rx="256" ry="25" fill="#251e16" opacity=".25"/>
<path d="M394 498h351q17 0 26 19l62 101q5 24-18 31H354q-19-6-11-25l31-106q5-20 20-20z" fill="#364b41"/>
<path d="M394 491h348q18 0 27 19l56 101q8 20-13 25H359q-18-3-11-22l29-104q4-19 17-19z" fill="url(#tray)"/>
<path d="M409 507h319q15 0 23 15l43 80q7 14-9 17H381q-15-2-10-16l24-81q3-15 14-15z" fill="#243f35"/>
<path d="M410 514h316q10 0 17 12l38 69q5 10-7 12H389q-10-2-7-11l20-71q2-11 8-11z" fill="url(#liquid)"/>
<g transform="translate(493 523) matrix(1 0 .26 .57 0 0)"><rect width="170" height="145" rx="2" fill="#e3d6b9"/><rect x="12" y="11" width="146" height="110" fill="#506a57"/><g transform="translate(28 6)">${pixels(leaf, 14, '#c9c29b', 1.8)}</g></g>
<path d="M391 572q24-11 57-5M684 552q39-11 62 4M708 586q26 8 53-2" stroke="#c8cfb0" opacity=".42" stroke-width="2" fill="none"/>
<path d="M400 501h330" stroke="#d6d1ae" opacity=".7" stroke-width="3" stroke-linecap="round"/>
<path d="M809 560q22 2 14 21l-4 7M354 558q-17 0-19 15l-1 9" stroke="#828d76" stroke-width="8" fill="none"/>
<!-- Album, brass scissors and an old negative strip. -->
<g transform="translate(892 520) rotate(-7)"><rect x="5" y="10" width="188" height="111" rx="5" fill="#31261d" opacity=".4"/><rect y="7" width="183" height="104" rx="4" fill="#c6bb95"/><path d="M8 96h165M8 102h165" stroke="#94856b" stroke-width="1"/><rect width="185" height="100" rx="5" fill="#315447"/><path d="M15 0v100" stroke="#ba9b63" stroke-width="2"/><rect x="60" y="29" width="85" height="41" rx="2" fill="none" stroke="#bba575" stroke-width="1.5"/><path d="M76 44h53M89 54h28" stroke="#bba575" stroke-width="2"/><path d="M169 16v68" stroke="#6a8870" stroke-width="2"/></g>
<g transform="translate(908 605) rotate(12)"><path d="M-22 0 69-27M-16 16 69-27" stroke="#b6ad83" stroke-width="5" stroke-linecap="round"/><ellipse cx="-29" cy="3" rx="15" ry="10" fill="none" stroke="#b5965b" stroke-width="5"/><ellipse cx="-22" cy="23" rx="15" ry="10" fill="none" stroke="#b5965b" stroke-width="5"/><circle cx="7" cy="0" r="4" fill="#6a6b50"/></g>
<g transform="translate(1080 483) rotate(9)"><path d="M0 0h32v132H0z" fill="#352c20"/><path d="M6 17h20v24H6zM6 50h20v24H6zM6 83h20v24H6z" fill="#7a6748"/>${Array.from({length: 10}, (_, i) => `<path d="M2 ${5 + i * 12}h2v5H2zM28 ${5 + i * 12}h2v5h-2z" fill="#c1a36b"/>`).join('')}</g>
<path d="M0 885h1200v15H0z" fill="#17211b" opacity=".32"/>
</svg>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="icon-title icon-desc">
<title id="icon-title">雾窗显影图标</title><desc id="icon-desc">墨绿底色上一张奶油色相纸，像素叶片与暖金星光。</desc>
<defs><linearGradient id="ib" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#284b3f"/><stop offset="1" stop-color="#112c28"/></linearGradient><linearGradient id="ip" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0d0"/><stop offset="1" stop-color="#d9c496"/></linearGradient><radialGradient id="ig"><stop stop-color="#bd8052" stop-opacity=".35"/><stop offset="1" stop-color="#bd8052" stop-opacity="0"/></radialGradient><clipPath id="ic"><rect width="1024" height="1024" rx="222"/></clipPath></defs>
<g clip-path="url(#ic)"><rect width="1024" height="1024" fill="url(#ib)"/><circle cx="780" cy="233" r="353" fill="url(#ig)"/>
<rect x="46" y="46" width="932" height="932" rx="181" fill="none" stroke="#b9b38a" stroke-opacity=".15" stroke-width="3"/>
<g transform="translate(241 176) rotate(-8 270 325)"><rect x="-35" y="15" width="540" height="650" rx="15" fill="#091d1a" opacity=".28"/><rect x="-25" y="-15" width="540" height="650" rx="12" fill="#a48257" transform="rotate(15 245 310)"/><rect width="540" height="650" rx="12" fill="url(#ip)"/><rect x="42" y="42" width="456" height="456" rx="4" fill="#315746"/><g transform="translate(71 71)">${pixels(leaf, 44, '#c5d0a0', 5)}</g><path d="M179 572h181" stroke="#8a9475" stroke-width="9" stroke-linecap="round"/><circle cx="149" cy="572" r="6" fill="#8a9475"/></g>
<path d="M793 153q10 63 66 72-56 9-66 72-10-63-66-72 56-9 66-72z" fill="#f2c586"/><path d="M867 304q5 25 28 29-23 4-28 29-5-25-28-29 23-4 28-29z" fill="#dfad72"/></g>
</svg>`;

const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
<defs><linearGradient id="cb" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#203e33"/><stop offset=".5" stop-color="#112e28"/><stop offset="1" stop-color="#0c2421"/></linearGradient><radialGradient id="ca" cx=".9" cy=".3" r=".75"><stop stop-color="#a16439" stop-opacity=".3"/><stop offset="1" stop-color="#a16439" stop-opacity="0"/></radialGradient><clipPath id="cp"><rect x="57" y="384" width="966" height="694" rx="20"/></clipPath></defs>
<rect width="1080" height="1440" fill="url(#cb)"/><rect width="1080" height="1440" fill="url(#ca)"/>
<path d="M40 83V40h44M996 40h44v43M40 1356v44h44M996 1400h44v-44" stroke="#b4a779" stroke-width="2" fill="none" opacity=".48"/>
<g font-family="PingFang SC, Noto Sans CJK SC, sans-serif" text-anchor="middle">
<path d="M358 91h57M665 91h57" stroke="#9ea487" stroke-width="1"/><text x="540" y="100" font-size="22" letter-spacing="6" fill="#b5bb9c">一 间 口 袋 暗 房</text>
<text x="540" y="243" font-family="Songti SC, STSong, serif" font-size="132" font-weight="600" letter-spacing="13" fill="#f0e4c2">雾窗显影</text>
<text x="540" y="316" font-size="32" letter-spacing="3" fill="#c7cfaf">把一格一格的光，洗成一张照片</text>
<path d="M514 349h52" stroke="#ca9e6d" stroke-width="2"/>
</g>
<rect x="50" y="377" width="980" height="708" rx="25" fill="none" stroke="#7d8263" stroke-width="1.5"/>
<g clip-path="url(#cp)"><svg x="57" y="366" width="966" height="724.5" viewBox="0 0 1200 900">${room.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg></g>
<path d="M83 1108h169M828 1108h169" stroke="#69785c" stroke-width="1"/>
<g font-family="PingFang SC, Noto Sans CJK SC, sans-serif" text-anchor="middle">
<text x="540" y="1117" font-size="22" letter-spacing="6" fill="#aab498">慢慢看见，日常的形状</text>
<g fill="#e9ddba"><text x="222" y="1212" font-family="Songti SC, STSong, serif" font-size="65">60</text><text x="540" y="1212" font-family="Songti SC, STSong, serif" font-size="65">6</text><text x="858" y="1205" font-family="Songti SC, STSong, serif" font-size="46">数织</text></g>
<g fill="#aebc9c" font-size="22" letter-spacing="4"><text x="222" y="1254">张照片</text><text x="540" y="1254">本相册</text><text x="858" y="1254">逻辑解谜</text></g>
<path d="M381 1165v87M700 1165v87" stroke="#8d9370" stroke-opacity=".38"/>
<text x="540" y="1322" font-size="23" letter-spacing="3" fill="#c2ba97">看懂线索 · 逐格显影 · 收藏小小日常</text>
<text x="540" y="1375" font-size="17" letter-spacing="2" fill="#8d9a7f">宣传插画 · 非实机截图</text>
</g></svg>`;

await out('assets/room.svg', room);
await out('assets/icon.svg', icon);
if (!process.argv.includes('--svg-only')) {
  const require = createRequire(import.meta.url);
  let sharp;
  for (const candidate of [
    'sharp',
    process.env.MISTWOOD_SHARP_PATH,
    '/Users/qiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'
  ].filter(Boolean)) {
    try { sharp = require(candidate); break; } catch {}
  }
  if (!sharp) throw new Error('PNG generation needs sharp. Install sharp locally or set MISTWOOD_SHARP_PATH. SVG assets were generated.');
  await sharp(Buffer.from(icon)).resize(512, 512).png({ compressionLevel: 9 }).toFile(resolve(root, 'release/icon.png'));
  await sharp(Buffer.from(cover)).png({ compressionLevel: 9 }).toFile(resolve(root, 'release/cover.png'));
}
console.log('Original artwork generated: assets/room.svg, assets/icon.svg' + (process.argv.includes('--svg-only') ? '' : ', release/icon.png (512×512), release/cover.png (1080×1440)'));
