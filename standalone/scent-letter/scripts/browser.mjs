import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
let pw;
try {
  pw = await import("playwright");
} catch {
  const fallback = process.env.SCENT_PLAYWRIGHT_PATH || "playwright/index.mjs";
  pw = await import(pathToFileURL(fallback));
}
process.chdir(path.resolve(import.meta.dirname, ".."));
const server = http.createServer((req, res) => {
  if (req.url === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  const file = path.resolve("dist/xhs", "." + decodeURIComponent(req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]));
  if (!file.startsWith(path.resolve("dist/xhs") + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'");
  res.setHeader("Content-Type", file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream");
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = "http://127.0.0.1:" + server.address().port;
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.SCENT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const errors = [], network = [], checks = [];
const key = "mini-polish:scent-letter:v1:save";
try {
  for (const size of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1280, height: 720 }, { width: 358, height: 720 }, { width: 359, height: 720 }, { width: 360, height: 720 }, { width: 758, height: 844 }, { width: 759, height: 844 }, { width: 760, height: 844 }]) {
    const context2 = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
    const page2 = await context2.newPage();
    page2.on("pageerror", (e) => errors.push(e.message));
    page2.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page2.on("request", (r) => {
      if (!r.url().startsWith(url)) network.push(r.url());
    });
    await page2.goto(url);
    await page2.screenshot({ path: `release/home-${size.width}.png`, fullPage: true });
    await page2.getByRole("button", { name: /拆开第一封信/ }).click();
    await page2.locator(".tutorial-image").waitFor();
    await page2.screenshot({ path: `release/tutorial-${size.width}.png` });
    await page2.getByRole("button", { name: "跳过教程" }).click();
    await page2.getByRole("button", { name: /递交配方/ }).click();
    assert.ok((await page2.locator(".message").textContent()).includes("填满"));
    await page2.getByRole("button", { name: "放入玫瑰", exact: true }).click();
    await page2.getByRole("button", { name: "撤销填写" }).click();
    assert.equal(await page2.locator(".slot .empty").count(), 4);
    await page2.getByRole("button", { name: /重看三图教程/ }).click();
    await page2.getByRole("button", { name: "下一张 →" }).click();
    await page2.getByRole("button", { name: "下一张 →" }).click();
    await page2.getByRole("button", { name: "开始试香", exact: true }).click();
    for (let i = 0; i < 8 && await page2.locator('[data-act="hint"]').count(); i++) {
      await page2.getByRole("button", { name: "推理提示" }).click();
      await page2.getByRole("button", { name: "填入这个候选" }).click();
      await page2.getByRole("button", { name: /递交配方/ }).click();
    }
    assert.ok((await page2.locator(".result").textContent()).includes("香笺已成"));
    const saved = await page2.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
    assert.equal(saved.records.length, 1);
    await page2.reload();
    await page2.getByRole("button", { name: /继续这封来信/ }).click();
    assert.equal(await page2.locator(".result").count(), 1);
    const after = await page2.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
    assert.equal(after.records.length, 1);
    await page2.screenshot({ path: `release/completion-${size.width}.png` });
    await page2.getByRole("button", { name: "再练一次" }).click();
    await page2.getByRole("button", { name: "重开练习" }).click();
    assert.ok((await page2.locator(".practice-note").textContent()).includes("练习"));
    await page2.getByRole("button", { name: "返回信匣", exact: true }).click();
    await page2.locator('[data-act="chapter"][data-chapter="6"]').click();
    await page2.locator('[data-act="start"][data-id="chapter-06-level-10"]').click();
    await page2.screenshot({ path: `release/gameplay-${size.width}.png` });
    const geometry = await page2.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, small: Array.from(document.querySelectorAll("button")).filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width && r.height && (r.width < 43.9 || r.height < 43.9);
    }).map((b) => ({ text: b.textContent, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })) }));
    assert.equal(geometry.overflow, false, JSON.stringify({ size, geometry }));
    assert.deepEqual(geometry.small, [], JSON.stringify({ size, geometry }));
    await page2.route("**/styles.css", async (route) => {
      const css = fs.readFileSync("dist/xhs/styles.css", "utf8");
      await route.fulfill({ contentType: "text/css", body: css + "\n:root{--safe-area-inset-top:44px;--safe-area-inset-bottom:34px}" });
    });
    await page2.reload();
    await page2.getByRole("button", { name: /继续这封来信/ }).click();
    await page2.screenshot({ path: `release/safe-area-${size.width}.png`, fullPage: true });
    assert.equal(await page2.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(await page2.locator("[data-act=submit]").evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight - 34), "submit reachable above bottom safe area");
    checks.push({ viewport: size, legalInput: true, undo: true, tutorial: true, win: true, refresh: true, practice: true, geometry: true, safeArea: true });
    await context2.close();
  }
  const context = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const page = await context.newPage();
  await page.goto(url);
  await page.getByRole("button", { name: /拆开第一封信/ }).click();
  await page.getByRole("button", { name: "跳过教程" }).click();
  const initial = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
  const all = JSON.parse(fs.readFileSync("src/levels.json"));
  const l = all[0];
  for (let n = 0; n < l.params.guesses; n++) {
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "放入玫瑰", exact: true }).click();
    await page.getByRole("button", { name: /递交配方/ }).click();
  }
  assert.ok((await page.locator(".result").textContent()).includes("留待再读"));
  await page.screenshot({ path: "release/failure-max-history-320.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.reload();
  await page.getByRole("button", { name: /继续这封来信/ }).click();
  assert.ok((await page.locator(".result").textContent()).includes("留待再读"));
  await page.getByRole("button", { name: "返回信匣", exact: true }).click();
  await page.getByRole("button", { name: /收藏/ }).click();
  assert.equal(await page.locator(".collection-list p").count(), 10);
  await page.getByRole("button", { name: "下一册" }).click();
  assert.equal(await page.locator(".collection-list p").count(), 10);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("[role=dialog]").count(), 0);
  await page.evaluate((k) => {
    localStorage.setItem("unrelated-game", "preserved");
    localStorage.setItem(k, "{bad");
  }, key);
  await page.reload();
  assert.equal(await page.evaluate(() => localStorage.getItem("unrelated-game")), "preserved");
  assert.equal(await page.getByRole("button", { name: /拆开第一封信/ }).count(), 1);
  await page.getByRole("button", { name: /拆开第一封信/ }).click();
  await page.getByRole("button", { name: "放入佛手", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /继续这封来信/ }).click();
  assert.ok((await page.locator(".slot").first().textContent()).includes("佛手"));
  await page.getByRole("button", { name: "撤销填写" }).click();
  assert.equal(await page.locator(".slot .empty").count(), 4);
  await context.close();
  checks.push({ failureAndMaxHistory: true, collectionPagination: true, corruptStorageIsolation: true, draftUndoAfterRefresh: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  fs.writeFileSync("release/browser-report.json", JSON.stringify({ checks, errors, externalRequests: network, device: "Headless installed Chrome; simulated viewports only" }, null, 2));
  console.log("Browser matrix passed:", checks.filter((c) => c.viewport).length, "viewports plus storage/failure suite");
} finally {
  await browser.close();
  server.close();
}
