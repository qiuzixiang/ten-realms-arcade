import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
let pw;
try {
  pw = await import("playwright");
} catch {
  pw = await import(pathToFileURL(process.env.SCENT_PLAYWRIGHT_PATH || "playwright/index.mjs"));
}
process.chdir(path.resolve(import.meta.dirname, ".."));
const defs = `<defs><linearGradient id="glass" x1="0" x2="1"><stop stop-color="#f8f4e8" stop-opacity=".8"/><stop offset=".3" stop-color="#d5b2a1" stop-opacity=".35"/><stop offset=".7" stop-color="#b0826b" stop-opacity=".4"/><stop offset="1" stop-color="#fff8e3" stop-opacity=".9"/></linearGradient><linearGradient id="paper" x2=".7" y2="1"><stop stop-color="#f3ebd7"/><stop offset="1" stop-color="#ded0ac"/></linearGradient></defs>`;
const bottle = (x, y, w, h, c, label, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})"><ellipse cx="${w / 2 + 14}" cy="${h + 10}" rx="${w * 0.7}" ry="20" fill="#283f36" opacity=".1"/><rect x="${w * 0.28}" y="-40" width="${w * 0.44}" height="50" rx="6" fill="#80664a"/>${Array.from({ length: 7 }, (_, i) => `<path d="M${w * 0.29 + i * w * 0.055} -35v40" stroke="#ad8e64" stroke-width="3"/>`).join("")}<rect width="${w}" height="${h}" rx="28" fill="${c}"/><rect width="${w}" height="${h}" rx="28" fill="url(#glass)" stroke="#f5ecd7" stroke-width="3"/><rect x="15" y="${h * 0.35}" width="${w - 30}" height="${h * 0.38}" fill="#f5efdc"/><text x="${w / 2}" y="${h * 0.51}" text-anchor="middle" font-family="Georgia,serif" font-size="${w * 0.105}" fill="#3f5347" letter-spacing="3">${label}</text><path d="M${w * 0.3} ${h * 0.6}h${w * 0.4}" stroke="#baaa86"/></g>`;
const plants = `<g fill="none" stroke="#6b7d56" stroke-width="5"><path d="M790 850Q840 680 963 529"/><path d="M840 714q-77 -105 -52 -170q100 38 52 170" fill="#8a9676"/><path d="M866 663q15 -115 88 -140q18 86 -88 140" fill="#758969"/><path d="M905 595q-64 -73 -35 -136q81 18 35 136" fill="#a0a47d"/></g>`;
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">${defs}<rect width="1080" height="1440" fill="#f2ecdc"/><rect x="44" y="44" width="992" height="1352" fill="none" stroke="#c5b692"/><text x="540" y="153" text-anchor="middle" fill="#937749" font-family="Georgia,serif" font-size="22" letter-spacing="9">THE SCENT ARCHIVE</text><text x="540" y="285" text-anchor="middle" fill="#2e493c" font-family="Songti SC,STSong,serif" font-size="100" letter-spacing="16">香笺秘方</text><text x="540" y="356" text-anchor="middle" fill="#80785f" font-family="PingFang SC,sans-serif" font-size="25" letter-spacing="5">这瓶香，藏着一道推理题</text><g transform="translate(240,585) rotate(-11)"><rect width="535" height="375" fill="url(#paper)"/><text x="45" y="78" font-family="Georgia,serif" font-size="23" fill="#8e7c57" letter-spacing="4">UNE LETTRE SECRÈTE</text>${[120, 165, 210, 255].map((y) => `<path d="M45 ${y}H455" stroke="#bcad87" stroke-width="2"/>`).join("")}<circle cx="438" cy="300" r="45" fill="#956356"/><text x="438" y="315" text-anchor="middle" fill="#dbb991" font-family="Songti SC,serif" font-size="43">笺</text></g>${plants}${bottle(250, 750, 195, 260, "#b98e84", "ROSE", -7)}${bottle(620, 682, 172, 240, "#99a391", "CEDAR", 10)}${bottle(591, 996, 145, 170, "#afa2b4", "IRIS", -5)}<text x="540" y="1250" text-anchor="middle" fill="#3d5344" font-family="PingFang SC,sans-serif" font-size="26" letter-spacing="7">试香 · 读反馈 · 推断秘方</text><text x="540" y="1310" text-anchor="middle" fill="#827b66" font-family="PingFang SC,sans-serif" font-size="20" letter-spacing="4">六册来信 / 六十封委托</text></svg>`;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${defs}<rect width="512" height="512" rx="112" fill="#294638"/><circle cx="256" cy="260" r="202" fill="none" stroke="#b59c6c" stroke-width="2"/><g transform="translate(77,132) rotate(-12)"><rect width="235" height="230" fill="url(#paper)"/>${[55, 90, 125].map((y) => `<path d="M30 ${y}H192" stroke="#bcad87" stroke-width="3"/>`).join("")}<circle cx="173" cy="182" r="28" fill="#956356"/></g>${bottle(248, 176, 133, 188, "#ac9182", "", 9)}<path d="M386 359q-21 -146 42 -226q-92 23 -82 115q69 -41 73 -71" fill="none" stroke="#a7b38b" stroke-width="9"/></svg>`;
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.SCENT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const [name, svg, w, h] of [["cover", cover, 1080, 1440], ["icon", icon, 512, 512]]) {
    fs.writeFileSync(`release/${name}.svg`, svg);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent('<body style="margin:0">' + svg + "</body>");
    await page.screenshot({ path: `release/${name}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
for (const [from, to] of [["gameplay-390.png", "gameplay-mobile.png"], ["tutorial-390.png", "tutorial-mobile.png"], ["completion-390.png", "completion-mobile.png"]]) fs.copyFileSync("release/" + from, "release/" + to);
console.log("Created original SVG artwork and PNG exports; copied real 390px gameplay captures.");
