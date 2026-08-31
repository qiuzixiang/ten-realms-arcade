import { access, readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { REALM_CONFIGS } from "../v2/shared/tutorial-data.mjs";

const root = process.cwd();
const ignored = new Set([".git", "dist", "node_modules"]);
const files = [];
const realms = [
  ["星滞回收局", "star-drift"],
  ["记忆方舟", "memory-ark"],
  ["月老红线事务所", "red-thread-office"],
  ["夜庭萤火", "firefly-garden"],
  ["深海回声站", "abyss-echo"],
  ["风暴灯塔网", "storm-lanterns"],
  ["夜市精灵撤离", "night-market-spirits"],
  ["云海航路", "sky-bridges"],
  ["灵龙巡脉", "spirit-dragon"],
  ["镜影大剧院", "mirror-theatre"],
];
const v2Root = path.join(root, "v2");
const expectedV2Slugs = Object.keys(REALM_CONFIGS).sort();

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else files.push(file);
  }
}

await walk(root);
let failures = 0;

function fail(message) {
  failures += 1;
  console.error(message);
}

function readAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, "i"));
  return match?.[2];
}

for (const file of files.filter((item) => item.endsWith(".js") || item.endsWith(".mjs"))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failures += 1;
    console.error(result.stderr.trim());
  }
}

const referencePattern = /<(?:script\b[^>]*\bsrc|link\b[^>]*\bhref|a\b[^>]*\bhref|img\b[^>]*\bsrc|source\b[^>]*\bsrc|video\b[^>]*\bposter)=["']([^"']+)["']/gi;

async function validateReference(file, reference) {
  if (/^(?:https?:|mailto:|tel:|data:|#|%23)/i.test(reference)) return;
  const clean = reference.split(/[?#]/)[0];
  if (!clean) return;
  try {
    await access(path.resolve(path.dirname(file), clean));
  } catch {
    failures += 1;
    console.error(`Missing local reference in ${path.relative(root, file)}: ${reference}`);
  }
}

for (const file of files.filter((item) => item.endsWith(".html"))) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(referencePattern)) {
    await validateReference(file, match[1]);
  }
}

const cssReferencePattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
for (const file of files.filter((item) => item.endsWith(".css"))) {
  const css = await readFile(file, "utf8");
  for (const match of css.matchAll(cssReferencePattern)) await validateReference(file, match[1]);
}

const moduleReferencePattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
for (const file of files.filter((item) => item.endsWith(".js") || item.endsWith(".mjs"))) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(moduleReferencePattern)) {
    const reference = match[1] ?? match[2];
    if (reference.startsWith(".")) await validateReference(file, reference);
  }
}

const manifest = JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));
for (const icon of manifest.icons ?? []) await validateReference(path.join(root, "manifest.webmanifest"), icon.src);
const v2ManifestPath = path.join(v2Root, "manifest.webmanifest");
const v2Manifest = JSON.parse(await readFile(v2ManifestPath, "utf8"));
for (const icon of v2Manifest.icons ?? []) await validateReference(v2ManifestPath, icon.src);

const v2RegistryPath = path.join(v2Root, "games.json");
const v2Registry = JSON.parse(await readFile(v2RegistryPath, "utf8"));
const v2Games = Array.isArray(v2Registry.games) ? v2Registry.games : [];
if (!Array.isArray(v2Registry.games)) fail("v2/games.json must expose a games array.");
if (v2Registry.schemaVersion !== 1) fail("v2/games.json schemaVersion must be 1.");
if (v2Registry.edition !== "2.0") fail("v2/games.json edition must be 2.0.");
if (v2Registry.expectedGames !== expectedV2Slugs.length) {
  fail(`v2/games.json expectedGames must be exactly ${expectedV2Slugs.length}.`);
}
if (v2Registry.status !== "ready") fail("v2/games.json status must be ready for release.");
if (v2Games.length !== expectedV2Slugs.length) {
  fail(`v2 registry must expose exactly ${expectedV2Slugs.length} games; found ${v2Games.length}.`);
}

const seenV2Slugs = new Set();
const seenV2Titles = new Set();
const seenV2Previews = new Set();
for (const game of v2Games) {
  if (!game || typeof game !== "object") {
    fail("Every v2 registry entry must be an object.");
    continue;
  }
  const requiredStrings = ["slug", "title", "genre", "mechanic", "summary", "preview", "accent"];
  for (const field of requiredStrings) {
    if (typeof game[field] !== "string" || !game[field].trim()) fail(`v2 game ${game.slug ?? "(unknown)"} is missing ${field}.`);
  }
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(game.slug ?? "")) fail(`Invalid v2 game slug: ${game.slug ?? "(missing)"}`);
  if (seenV2Slugs.has(game.slug)) fail(`Duplicate v2 game slug: ${game.slug}`);
  seenV2Slugs.add(game.slug);
  if (seenV2Titles.has(game.title)) fail(`Duplicate v2 game title: ${game.title}`);
  seenV2Titles.add(game.title);
  if (seenV2Previews.has(game.preview)) fail(`Duplicate v2 preview path: ${game.preview}`);
  seenV2Previews.add(game.preview);
  if (!/^#[0-9a-f]{6}$/i.test(game.accent ?? "")) fail(`Invalid v2 accent for ${game.slug}: ${game.accent ?? "(missing)"}`);
  if (game.preview !== `./assets/previews/${game.slug}.webp`) {
    fail(`v2 preview must use the canonical local path for ${game.slug}: ./assets/previews/${game.slug}.webp`);
  }
  if (!Object.hasOwn(REALM_CONFIGS, game.slug)) fail(`v2 registry slug has no shared realm config: ${game.slug}`);
  else if (REALM_CONFIGS[game.slug].title !== game.title) {
    fail(`v2 registry title does not match shared realm config for ${game.slug}.`);
  } else if (typeof game.accent === "string"
    && REALM_CONFIGS[game.slug].accent.toLowerCase() !== game.accent.toLowerCase()) {
    fail(`v2 registry accent does not match shared realm config for ${game.slug}.`);
  }
  const gameIndex = path.join(v2Root, "games", game.slug, "index.html");
  let html;
  try {
    html = await readFile(gameIndex, "utf8");
  } catch {
    fail(`Registered v2 game is missing its entry page: v2/games/${game.slug}/index.html`);
    continue;
  }
  if (/请稍候|开发中|即将开放|coming\s+soon/i.test(html)) fail(`Registered v2 game contains placeholder copy: ${game.slug}`);
  if (!/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>/i.test(html)) fail(`Registered v2 game has no game script: ${game.slug}`);
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  if (readAttribute(htmlTag, "data-realm") !== game.slug) fail(`v2 game page data-realm must match its slug: ${game.slug}`);
  if (!/<link\b[^>]*\bhref=["']\.\.\/\.\.\/shared\/realm-ui\.css["'][^>]*>/i.test(html)) {
    fail(`v2 game page is missing the shared realm UI stylesheet: ${game.slug}`);
  }
  const realmUiScriptIndex = html.search(/<script\b[^>]*\bsrc=["']\.\.\/\.\.\/shared\/realm-ui\.mjs["'][^>]*>/i);
  const gameAppScriptIndex = html.search(/<script\b[^>]*\bsrc=["']\.\/app\.(?:mjs|js)["'][^>]*>/i);
  if (realmUiScriptIndex < 0) fail(`v2 game page is missing the shared realm UI module: ${game.slug}`);
  if (gameAppScriptIndex < 0) fail(`v2 game page is missing its canonical app module: ${game.slug}`);
  if (realmUiScriptIndex >= 0 && gameAppScriptIndex >= 0 && realmUiScriptIndex > gameAppScriptIndex) {
    fail(`v2 shared realm UI must load before the game app: ${game.slug}`);
  }
  if (!/<a\b[^>]*\bhref=["']\.\.\/\.\.\/["'][^>]*>/i.test(html)) fail(`v2 game page needs a canonical return link: ${game.slug}`);
  if (REALM_CONFIGS[game.slug]?.nativeTutorialSelector === "#tutorial-button" && !/\bid=["']tutorial-button["']/i.test(html)) {
    fail(`v2 native tutorial button is missing or misnamed: ${game.slug}`);
  }
  await validateReference(v2RegistryPath, game.preview);
  try {
    const previewFile = path.resolve(path.dirname(v2RegistryPath), game.preview);
    if (!previewFile.startsWith(`${path.join(v2Root, "assets", "previews")}${path.sep}`)) {
      fail(`v2 preview escapes the preview directory: ${game.slug}`);
    } else if ((await stat(previewFile)).size < 4096) {
      fail(`v2 preview is unexpectedly small: ${game.slug}`);
    }
  } catch {
    // validateReference already reports the missing file.
  }
}

if (JSON.stringify([...seenV2Slugs].sort()) !== JSON.stringify(expectedV2Slugs)) {
  fail(`v2 registry slugs must exactly match shared realm configs: ${expectedV2Slugs.join(", ")}`);
}

const homepage = await readFile(path.join(root, "index.html"), "utf8");
const readme = await readFile(path.join(root, "README.md"), "utf8");
const gameCardTags = [...homepage.matchAll(/<a\b[^>]*>/gi)].filter((match) =>
  readAttribute(match[0], "class")?.split(/\s+/).includes("game-card"),
);

if (gameCardTags.length !== realms.length) {
  fail(`Homepage must expose exactly ${realms.length} game cards; found ${gameCardTags.length}.`);
}

for (const [title, directory] of realms) {
  const href = `./games/${directory}/`;
  const matchingCards = gameCardTags.filter((match) => readAttribute(match[0], "href") === href);
  if (matchingCards.length !== 1) {
    fail(`Homepage must link exactly once to ${title}: ${href}`);
  }

  if (!readme.includes(`[${title}](${href})`)) {
    fail(`README game list is missing the playable link for ${title}: ${href}`);
  }

  const gameIndex = path.join(root, "games", directory, "index.html");
  let gameHtml;
  try {
    gameHtml = await readFile(gameIndex, "utf8");
  } catch {
    fail(`Playable realm is missing its entry page: games/${directory}/index.html`);
    continue;
  }

  if (/请稍候|开发中|即将开放|coming\s+soon/i.test(gameHtml)) {
    fail(`Playable realm still contains placeholder copy: games/${directory}/index.html`);
  }
  if (!/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>/i.test(gameHtml)) {
    fail(`Playable realm has no game script: games/${directory}/index.html`);
  }
}

const discoveredTests = files
  .map((file) => [file, path.relative(root, file).split(path.sep).join("/")])
  .filter(([, relative]) => /^games\/.+\/tests\.mjs$/.test(relative));
const discoveredTestPaths = new Set(discoveredTests.map(([, relative]) => relative));
const expectedTestPaths = new Set(realms.map(([, directory]) => `games/${directory}/tests.mjs`));

for (const [title, directory] of realms) {
  const expected = `games/${directory}/tests.mjs`;
  if (!discoveredTestPaths.has(expected)) fail(`Realm test suite is missing for ${title}: ${expected}`);
}

for (const discovered of discoveredTestPaths) {
  if (!expectedTestPaths.has(discovered)) fail(`Unregistered realm test suite found: ${discovered}`);
}

if (discoveredTestPaths.size !== realms.length) {
  fail(`Expected exactly ${realms.length} realm test suites; found ${discoveredTestPaths.size}.`);
}

for (const [test] of discoveredTests) {
  const result = spawnSync(process.execPath, [test], { encoding: "utf8" });
  process.stdout.write(result.stdout);
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(result.stderr);
  }
}

const discoveredV2Tests = files
  .map((file) => [file, path.relative(root, file).split(path.sep).join("/")])
  .filter(([, relative]) => /^v2\/games\/.+\/tests\.mjs$/.test(relative));
const discoveredV2TestPaths = new Set(discoveredV2Tests.map(([, relative]) => relative));
const expectedV2TestPaths = new Set(v2Games.map(({ slug }) => `v2/games/${slug}/tests.mjs`));
for (const game of v2Games) {
  const expected = `v2/games/${game.slug}/tests.mjs`;
  if (!discoveredV2TestPaths.has(expected)) fail(`v2 game test suite is missing for ${game.title}: ${expected}`);
}
for (const discovered of discoveredV2TestPaths) {
  if (!expectedV2TestPaths.has(discovered)) fail(`Unregistered v2 game test suite found: ${discovered}`);
}
for (const [test] of discoveredV2Tests) {
  const result = spawnSync(process.execPath, [test], { encoding: "utf8" });
  process.stdout.write(result.stdout);
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(result.stderr);
  }
}

const sharedTest = path.join(root, "shared", "tests.mjs");
const sharedResult = spawnSync(process.execPath, [sharedTest], { encoding: "utf8" });
process.stdout.write(sharedResult.stdout);
if (sharedResult.status !== 0) {
  failures += 1;
  process.stderr.write(sharedResult.stderr);
}

const v2SharedTest = path.join(v2Root, "shared", "tests.mjs");
const v2SharedResult = spawnSync(process.execPath, [v2SharedTest], { encoding: "utf8" });
process.stdout.write(v2SharedResult.stdout);
if (v2SharedResult.status !== 0) {
  failures += 1;
  process.stderr.write(v2SharedResult.stderr);
}

const allowedV2ProtocolNames = new Set([
  "ten-realms-v2.game-complete",
  "ten-realms-v2.game-ready",
  "ten-realms-v2/game-completion@1",
]);
const tenRealmsLiteralPattern = /["'`](ten-realms[^"'`]*)["'`]/g;

for (const file of files.filter((item) => item.startsWith(`${v2Root}${path.sep}`) && /\.(?:js|mjs)$/.test(item))) {
  const source = await readFile(file, "utf8");
  const basename = path.basename(file);
  if (basename !== "tests.mjs") {
    for (const match of source.matchAll(tenRealmsLiteralPattern)) {
      const value = match[1];
      const isStorageKey = value.startsWith("ten-realms-v2:");
      const isV2CacheName = basename === "sw.js" && value.startsWith("ten-realms-v2-arcade-");
      if (!isStorageKey && !isV2CacheName && !allowedV2ProtocolNames.has(value)) {
        fail(`v2 production code contains an invalid Ten Realms namespace in ${path.relative(root, file)}: ${value}`);
      }
    }
  }
  for (const match of source.matchAll(moduleReferencePattern)) {
    const reference = match[1] ?? match[2];
    if (!reference.startsWith(".")) continue;
    const resolved = path.resolve(path.dirname(file), reference);
    if (resolved !== v2Root && !resolved.startsWith(`${v2Root}${path.sep}`)) {
      fail(`v2 runtime import escapes the v2 tree: ${path.relative(root, file)} -> ${reference}`);
    }
  }
}

const rootSw = await readFile(path.join(root, "sw.js"), "utf8");
const v2Sw = await readFile(path.join(v2Root, "sw.js"), "utf8");
if (!rootSw.includes('new URL("./v2/", self.registration.scope)')) fail("Root service worker must bypass the v2 path.");
if (!v2Sw.includes("ten-realms-v2-arcade-")) fail("v2 service worker must use its isolated cache prefix.");
if (!v2Sw.includes("url.pathname.startsWith(scope.pathname)")) fail("v2 service worker must ignore requests outside its scope.");
if (/\bcaches\.match\(/.test(v2Sw)) fail("v2 service worker must only read from its own named cache.");
if (/ten-realms-arcade-/.test(v2Sw.replaceAll("ten-realms-v2-arcade-", ""))) {
  fail("v2 service worker must not use the root cache prefix.");
}

if (failures) {
  console.error(`Validation failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log(`Validated ${files.length} files.`);
