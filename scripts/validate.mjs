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
const expectedV2Games = [
  ["云端露营季", "cloud-camp"],
  ["雾都照相馆", "mist-photo-studio"],
  ["神秘调香所", "mystic-perfumery"],
  ["星云孵化场", "nebula-hatchery"],
  ["霓虹天际线", "neon-skyline"],
  ["极地蒸汽列车", "polar-railway"],
  ["四季染坊", "season-dyehouse"],
  ["妖怪旅店", "yokai-inn"],
  ["极光磁场实验室", "aurora-magnet-lab"],
  ["梦境旅舍", "dream-hotel"],
  ["时砂邮路局", "time-sand-post"],
  ["熔心泄压站", "molten-core-vent"],
  ["纸鹤归巢台", "paper-crane-sanctuary"],
  ["万象共振钟房", "resonance-bell-room"],
  ["四灵栖境署", "four-spirit-habitat"],
];
const v2Root = path.join(root, "v2");
const expectedV2Slugs = expectedV2Games.map(([, slug]) => slug);
const expectedV2SlugsSorted = [...expectedV2Slugs].sort();
const configuredV2Slugs = Object.keys(REALM_CONFIGS).sort();
const nativeTutorialAssets = new Map([
  ["polar-railway", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
  ["season-dyehouse", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
  ["yokai-inn", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
  ["aurora-magnet-lab", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
  ["dream-hotel", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
  ["time-sand-post", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
  ["molten-core-vent", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
  ["paper-crane-sanctuary", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
  ["resonance-bell-room", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
  ["four-spirit-habitat", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
]);
const nativeTutorialGoalMarkers = new Map([
  ["aurora-magnet-lab", ['data-level-id="ice-window"', 'data-state="solved"', 'data-solution="NNNNRNFF"']],
  ["polar-railway", ['data-level-id="whiteout-5a"', 'data-state="solved"', 'data-route="0,0;0,1;1,1']],
  ["dream-hotel", ['data-level-id="lullaby-lobby"', 'data-state="solved"', 'data-board-size="5x5"']],
  ["season-dyehouse", ['data-preset-id="12x12-easy"', 'data-controlled="144"', 'data-moves="20"']],
  ["yokai-inn", ['data-puzzle-id="yokai-inn:g1:o3:u:do80yl:a10"', 'data-tutorial-state="goal"', 'data-board-size="5x4"']],
  ["time-sand-post", ['data-level-id="chronicle-dawn"', 'data-state="solved"', 'data-link-count="15"', 'data-path="8,12,0,4,14,15,13,1,5,9,10,11,6,3,2,7"']],
  ["molten-core-vent", ['data-level-id="ember-gate-1101"', 'data-state="complete"', 'data-complete="true"', 'data-filled="16"', 'data-satisfied-clues="17"', 'data-cycle="false"']],
  ["paper-crane-sanctuary", ['data-level-id="dawn-perch-101"', 'data-state="complete"', 'data-cranes="1"', 'data-complete="true"']],
  ["resonance-bell-room", ['data-level-id="first-awakening"', 'data-state="solved"', 'data-final-bits="111111111"', 'data-minimum-proven="true"']],
  ["four-spirit-habitat", ['data-level-id="spirit-spring"', 'data-state="solved"', 'data-solution="0,3,1,0,2,0,3,3,2"']],
]);

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

function webpDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 30
      || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  }
  if (chunk === "VP8 " && buffer.length >= 30 && buffer.toString("hex", 23, 26) === "9d012a") {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
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
const packageMetadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageMetadata.version !== "2.5.0") fail("package.json version must be 2.5.0 for the V2.5 release.");
if (v2Manifest.id !== "./" || v2Manifest.start_url !== "./" || v2Manifest.scope !== "./") {
  fail("v2 manifest id, start_url and scope must remain isolated at ./.");
}
if (!String(v2Manifest.name).includes("2.5") || !String(v2Manifest.short_name).includes("2.5")) {
  fail("v2 manifest names must identify the 2.5 release.");
}
if (JSON.stringify(manifest).includes("/v2/") || JSON.stringify(manifest).includes("./v2/")) {
  fail("Root manifest must not claim the V2 scope or assets.");
}

const v2RegistryPath = path.join(v2Root, "games.json");
const v2Registry = JSON.parse(await readFile(v2RegistryPath, "utf8"));
const v2Games = Array.isArray(v2Registry.games) ? v2Registry.games : [];
if (JSON.stringify(configuredV2Slugs) !== JSON.stringify(expectedV2SlugsSorted)) {
  fail(`v2 shared realm configs must exactly match the fixed V2.5 release: ${expectedV2Slugs.join(", ")}`);
}
if (!Array.isArray(v2Registry.games)) fail("v2/games.json must expose a games array.");
if (v2Registry.schemaVersion !== 1) fail("v2/games.json schemaVersion must be 1.");
if (v2Registry.edition !== "2.5") fail("v2/games.json edition must be 2.5.");
if (v2Registry.expectedGames !== expectedV2Games.length) fail("v2/games.json V2.5 release must contain exactly 15 games.");
if (v2Registry.expectedGames !== configuredV2Slugs.length) {
  fail(`v2/games.json expectedGames must be exactly ${expectedV2Slugs.length}.`);
}
if (v2Registry.status !== "ready") fail("v2/games.json status must be ready for release.");
if (v2Games.length !== expectedV2Games.length) {
  fail(`v2 registry must expose exactly ${expectedV2Slugs.length} games; found ${v2Games.length}.`);
}
if (JSON.stringify(v2Games.map((game) => game?.slug)) !== JSON.stringify(expectedV2Slugs)) {
  fail(`v2 registry order and slugs must exactly match the fixed V2.5 release: ${expectedV2Slugs.join(", ")}`);
}
const discoveredV2GameDirectories = (await readdir(path.join(v2Root, "games"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(discoveredV2GameDirectories) !== JSON.stringify(expectedV2SlugsSorted)) {
  fail(`v2 game directories must exactly match the V2.5 registry: ${expectedV2Slugs.join(", ")}`);
}

const seenV2Slugs = new Set();
const seenV2Titles = new Set();
const seenV2Previews = new Set();
for (const [index, game] of v2Games.entries()) {
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
  const [expectedTitle, expectedSlug] = expectedV2Games[index] ?? [];
  if (game.slug !== expectedSlug || game.title !== expectedTitle) {
    fail(`v2 registry entry ${index + 1} must be ${expectedTitle ?? "(missing)"} (${expectedSlug ?? "missing"}).`);
  }
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
  const tutorialFiles = nativeTutorialAssets.get(game.slug);
  if (REALM_CONFIGS[game.slug]?.nativeTutorialSelector === "#tutorial-button" && !tutorialFiles) {
    fail(`v2 native tutorial asset contract is missing for ${game.slug}.`);
  }
  if (tutorialFiles) {
    const gameDirectory = path.join(v2Root, "games", game.slug);
    const runtimeSources = await Promise.all(files
      .filter((file) => file.startsWith(`${gameDirectory}${path.sep}`) && /\.(?:html|js|mjs)$/.test(file))
      .map((file) => readFile(file, "utf8")));
    const tutorialWiring = [html, ...runtimeSources].join("\n");
    for (const tutorialFile of tutorialFiles) {
      const assetPath = path.join(gameDirectory, "assets", tutorialFile);
      try {
        const source = await readFile(assetPath, "utf8");
        if (Buffer.byteLength(source) < 1000) fail(`v2 tutorial asset is unexpectedly small: ${game.slug}/${tutorialFile}`);
        if (!/<svg\b/i.test(source) || !/\brole=["']img["']/i.test(source)) {
          fail(`v2 tutorial asset must be an accessible SVG image: ${game.slug}/${tutorialFile}`);
        }
      } catch {
        fail(`v2 native tutorial asset is missing: ${game.slug}/${tutorialFile}`);
      }
      if (!tutorialWiring.includes(`./assets/${tutorialFile}?tutorial=`)) {
        fail(`v2 native tutorial is not wired with a cache revision: ${game.slug}/${tutorialFile}`);
      }
    }
    try {
      const goalSource = await readFile(path.join(gameDirectory, "assets", tutorialFiles.at(-1)), "utf8");
      for (const marker of nativeTutorialGoalMarkers.get(game.slug) ?? []) {
        if (!goalSource.includes(marker)) fail(`v2 native tutorial goal marker is missing for ${game.slug}: ${marker}`);
      }
    } catch {
      // The missing asset is already reported above.
    }
  }
  await validateReference(v2RegistryPath, game.preview);
  try {
    const previewFile = path.resolve(path.dirname(v2RegistryPath), game.preview);
    if (!previewFile.startsWith(`${path.join(v2Root, "assets", "previews")}${path.sep}`)) {
      fail(`v2 preview escapes the preview directory: ${game.slug}`);
    } else if ((await stat(previewFile)).size < 4096) {
      fail(`v2 preview is unexpectedly small: ${game.slug}`);
    } else {
      const dimensions = webpDimensions(await readFile(previewFile));
      if (dimensions?.width !== 1200 || dimensions?.height !== 652) {
        fail(`v2 preview must be exactly 1200x652 WebP: ${game.slug}`);
      }
    }
  } catch {
    // validateReference already reports the missing file.
  }
}

if (JSON.stringify([...seenV2Slugs].sort()) !== JSON.stringify(expectedV2SlugsSorted)) {
  fail(`v2 registry slugs must exactly match shared realm configs: ${expectedV2Slugs.join(", ")}`);
}

const homepage = await readFile(path.join(root, "index.html"), "utf8");
const v2Homepage = await readFile(path.join(v2Root, "index.html"), "utf8");
const readme = await readFile(path.join(root, "README.md"), "utf8");
const v2HtmlTag = v2Homepage.match(/<html\b[^>]*>/i)?.[0] ?? "";
if (readAttribute(v2HtmlTag, "data-edition") !== "2.5") fail("v2 guide must declare data-edition=2.5.");
if (!/data-game-target[^>]*>15</i.test(v2Homepage) || !v2Homepage.includes("十五款")) {
  fail("v2 guide must expose the fixed fifteen-game V2.5 release metadata.");
}
for (const [title, slug] of expectedV2Games) {
  const link = `[${title}](./v2/games/${slug}/)`;
  if (readme.split(link).length !== 2) fail(`README must link exactly once to V2.5 game ${title}: ./v2/games/${slug}/`);
}
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
