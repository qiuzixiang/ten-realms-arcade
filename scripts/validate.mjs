import { access, readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { REALM_CONFIGS as V2_REALM_CONFIGS, REALM_TUTORIALS as V2_REALM_TUTORIALS } from "../v2/shared/tutorial-data.mjs";
import { REALM_CONFIGS as V3_REALM_CONFIGS, REALM_TUTORIALS as V3_REALM_TUTORIALS } from "../v3/shared/tutorial-data.mjs";

const root = process.cwd();
const ignored = new Set([".git", "dist", "node_modules"]);
const files = [];
const v1Games = [
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

const nativeTutorials = (entries) => new Map(entries);
const editions = [
  {
    directory: "v2",
    label: "V2.0",
    edition: "2.0",
    cachePrefix: "ten-realms-v2-arcade-",
    storagePrefix: "ten-realms-v2:",
    configs: V2_REALM_CONFIGS,
    tutorials: V2_REALM_TUTORIALS,
    games: [
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
    ],
    nativeTutorialAssets: nativeTutorials([
      ["polar-railway", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
      ["season-dyehouse", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["yokai-inn", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["aurora-magnet-lab", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
      ["dream-hotel", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
    ]),
  },
  {
    directory: "v3",
    label: "V3.0",
    edition: "3.0",
    cachePrefix: "ten-realms-v3-arcade-",
    storagePrefix: "ten-realms-v3:",
    configs: V3_REALM_CONFIGS,
    tutorials: V3_REALM_TUTORIALS,
    games: [
      ["时砂邮路局", "time-sand-post"],
      ["熔心泄压站", "molten-core-vent"],
      ["纸鹤归巢台", "paper-crane-sanctuary"],
      ["万象共振钟房", "resonance-bell-room"],
      ["四灵栖境署", "four-spirit-habitat"],
      ["星盘校准局", "star-dial-bureau"],
      ["星屑勘测站", "stardust-survey"],
      ["珊瑚孢群培育所", "coral-bloom-lab"],
      ["蚀光巡检署", "eclipse-watch"],
      ["天象壁画修复室", "celestial-mural"],
    ],
    nativeTutorialAssets: nativeTutorials([
      ["time-sand-post", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["molten-core-vent", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
      ["paper-crane-sanctuary", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
      ["resonance-bell-room", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
      ["four-spirit-habitat", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["star-dial-bureau", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["stardust-survey", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["coral-bloom-lab", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["eclipse-watch", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["celestial-mural", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
    ]),
  },
];

let failures = 0;
function fail(message) {
  failures += 1;
  console.error(message);
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else files.push(file);
  }
}
await walk(root);

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
  if (result.status !== 0) fail(result.stderr.trim() || `Syntax check failed: ${path.relative(root, file)}`);
}

const referencePattern = /<(?:script\b[^>]*\bsrc|link\b[^>]*\bhref|a\b[^>]*\bhref|img\b[^>]*\bsrc|source\b[^>]*\bsrc|video\b[^>]*\bposter)=["']([^"']+)["']/gi;
const cssReferencePattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const moduleReferencePattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

async function validateReference(file, reference) {
  if (/^(?:https?:|mailto:|tel:|data:|#|%23)/i.test(reference)) return;
  const clean = reference.split(/[?#]/)[0];
  if (!clean) return;
  try {
    await access(path.resolve(path.dirname(file), clean));
  } catch {
    fail(`Missing local reference in ${path.relative(root, file)}: ${reference}`);
  }
}

for (const file of files.filter((item) => item.endsWith(".html"))) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(referencePattern)) await validateReference(file, match[1]);
}
for (const file of files.filter((item) => item.endsWith(".css"))) {
  const css = await readFile(file, "utf8");
  for (const match of css.matchAll(cssReferencePattern)) await validateReference(file, match[1]);
}
for (const file of files.filter((item) => item.endsWith(".js") || item.endsWith(".mjs"))) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(moduleReferencePattern)) {
    const reference = match[1] ?? match[2];
    if (reference.startsWith(".")) await validateReference(file, reference);
  }
}

const rootManifest = JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));
for (const icon of rootManifest.icons ?? []) await validateReference(path.join(root, "manifest.webmanifest"), icon.src);
if (JSON.stringify(rootManifest).includes("/v2/") || JSON.stringify(rootManifest).includes("/v3/")) {
  fail("Root manifest must not claim V2 or V3 scope/assets.");
}
const packageMetadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageMetadata.version !== "3.0.0") fail("package.json version must be 3.0.0 for the V3.0 release.");

const editionSources = new Map();
for (const spec of editions) {
  const editionRoot = path.join(root, spec.directory);
  editionSources.set(spec.directory, editionRoot);
  const manifestPath = path.join(editionRoot, "manifest.webmanifest");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const icon of manifest.icons ?? []) await validateReference(manifestPath, icon.src);
  if (manifest.id !== "./" || manifest.start_url !== "./" || manifest.scope !== "./") {
    fail(`${spec.label} manifest id, start_url and scope must remain isolated at ./.`);
  }
  if (!String(manifest.name).includes(spec.edition) || !String(manifest.short_name).includes(spec.edition)) {
    fail(`${spec.label} manifest names must identify its release.`);
  }

  const registryPath = path.join(editionRoot, "games.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const games = Array.isArray(registry.games) ? registry.games : [];
  const expectedSlugs = spec.games.map(([, slug]) => slug);
  if (registry.schemaVersion !== 1 || registry.edition !== spec.edition || registry.status !== "ready"
      || registry.expectedGames !== spec.games.length || games.length !== spec.games.length) {
    fail(`${spec.label} registry metadata must describe its fixed ten-game release.`);
  }
  if (JSON.stringify(games.map((game) => game?.slug)) !== JSON.stringify(expectedSlugs)) {
    fail(`${spec.label} registry order/slugs do not match its fixed release.`);
  }
  if (JSON.stringify(Object.keys(spec.configs).sort()) !== JSON.stringify([...expectedSlugs].sort())) {
    fail(`${spec.label} shared realm configs must exactly match its registry.`);
  }
  const discoveredDirectories = (await readdir(path.join(editionRoot, "games"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (JSON.stringify(discoveredDirectories) !== JSON.stringify([...expectedSlugs].sort())) {
    fail(`${spec.label} game directories must exactly match the registry.`);
  }
  const seenSlugs = new Set();
  const seenTitles = new Set();
  const seenPreviews = new Set();
  for (const [index, game] of games.entries()) {
    const [expectedTitle, expectedSlug] = spec.games[index] ?? [];
    if (!game || typeof game !== "object") {
      fail(`${spec.label} registry entry ${index + 1} must be an object.`);
      continue;
    }
    for (const field of ["slug", "title", "genre", "mechanic", "summary", "preview", "accent"]) {
      if (typeof game[field] !== "string" || !game[field].trim()) fail(`${spec.label} game ${game.slug ?? "(unknown)"} is missing ${field}.`);
    }
    if (game.slug !== expectedSlug || game.title !== expectedTitle) fail(`${spec.label} game ${index + 1} must be ${expectedTitle} (${expectedSlug}).`);
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(game.slug ?? "")) fail(`${spec.label} has an invalid slug: ${game.slug}`);
    if (!/^#[0-9a-f]{6}$/i.test(game.accent ?? "")) fail(`${spec.label} has an invalid accent: ${game.slug}`);
    if (seenSlugs.has(game.slug) || seenTitles.has(game.title) || seenPreviews.has(game.preview)) fail(`${spec.label} registry has duplicate game metadata: ${game.slug}`);
    seenSlugs.add(game.slug); seenTitles.add(game.title); seenPreviews.add(game.preview);
    if (game.preview !== `./assets/previews/${game.slug}.webp`) fail(`${spec.label} preview path is not canonical for ${game.slug}.`);
    const config = spec.configs[game.slug];
    if (!config || config.title !== game.title || config.accent.toLowerCase() !== game.accent.toLowerCase()) {
      fail(`${spec.label} realm config is inconsistent for ${game.slug}.`);
    }
    const gameDirectory = path.join(editionRoot, "games", game.slug);
    const indexPath = path.join(gameDirectory, "index.html");
    let html = "";
    try {
      html = await readFile(indexPath, "utf8");
    } catch {
      fail(`${spec.label} game is missing entry page: ${game.slug}`);
      continue;
    }
    if (/请稍候|开发中|即将开放|coming\s+soon/i.test(html)) fail(`${spec.label} game contains placeholder copy: ${game.slug}`);
    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
    if (readAttribute(htmlTag, "data-realm") !== game.slug) fail(`${spec.label} page data-realm is wrong for ${game.slug}.`);
    if (!html.includes("../../shared/realm-ui.css") || !html.includes("../../shared/realm-ui.mjs")) {
      fail(`${spec.label} game must load its own shared realm UI: ${game.slug}`);
    }
    if (!/<script\b[^>]*\bsrc=["']\.\/app\.mjs["'][^>]*>/i.test(html)) fail(`${spec.label} game needs canonical app.mjs: ${game.slug}`);
    if (!/<a\b[^>]*\bhref=["']\.\.\/\.\.\/["'][^>]*>/i.test(html)) fail(`${spec.label} game needs a canonical return link: ${game.slug}`);

    const tutorialFiles = spec.nativeTutorialAssets.get(game.slug);
    const sharedTutorial = spec.tutorials[game.slug];
    if (!tutorialFiles && !sharedTutorial) fail(`${spec.label} game has no tutorial contract: ${game.slug}`);
    if (tutorialFiles && !html.includes('id="tutorial-button"')) {
      fail(`${spec.label} native tutorial needs its own tutorial button: ${game.slug}`);
    }
    const runtimeFiles = files.filter((file) => file.startsWith(`${gameDirectory}${path.sep}`) && /\.(?:html|js|mjs)$/.test(file));
    const runtimeSources = await Promise.all(runtimeFiles.map((file) => readFile(file, "utf8")));
    const tutorialWiring = runtimeSources.join("\n");
    for (const filename of tutorialFiles ?? []) {
      const assetPath = path.join(gameDirectory, "assets", filename);
      try {
        const source = await readFile(assetPath, "utf8");
        if (Buffer.byteLength(source) < 1000 || !/<svg\b/i.test(source) || !/\brole=["']img["']/i.test(source)
            || !/\bviewBox=["']/i.test(source) || !/preserveAspectRatio=["']xMidYMid/i.test(source)) {
          fail(`${spec.label} tutorial SVG is incomplete: ${game.slug}/${filename}`);
        }
        if (!/\bdata-[a-z-]+=["']/i.test(source)) fail(`${spec.label} tutorial SVG lacks a replayable state marker: ${game.slug}/${filename}`);
      } catch {
        fail(`${spec.label} tutorial asset is missing: ${game.slug}/${filename}`);
      }
      if (!tutorialWiring.includes(`./assets/${filename}`)) fail(`${spec.label} tutorial is not wired: ${game.slug}/${filename}`);
    }
    try {
      const previewPath = path.resolve(path.dirname(registryPath), game.preview);
      const preview = await readFile(previewPath);
      const dimensions = webpDimensions(preview);
      if ((await stat(previewPath)).size < 4096 || dimensions?.width !== 1200 || dimensions?.height !== 652) {
        fail(`${spec.label} preview must be a 1200×652 WebP: ${game.slug}`);
      }
    } catch {
      fail(`${spec.label} preview is missing: ${game.slug}`);
    }
  }
  for (const [realmId, tutorial] of Object.entries(spec.tutorials)) {
    if (!spec.configs[realmId] || !tutorial || tutorial.cards?.length !== 3) fail(`${spec.label} shared tutorial contract is invalid: ${realmId}`);
  }
}

const homepage = await readFile(path.join(root, "index.html"), "utf8");
const gameCardTags = [...homepage.matchAll(/<a\b[^>]*>/gi)].filter((match) =>
  readAttribute(match[0], "class")?.split(/\s+/).includes("game-card"));
if (gameCardTags.length !== v1Games.length) fail(`Homepage must expose exactly ${v1Games.length} game cards.`);
for (const [title, slug] of v1Games) {
  const href = `./games/${slug}/`;
  if (gameCardTags.filter((match) => readAttribute(match[0], "href") === href).length !== 1) fail(`Homepage must link once to ${title}.`);
  try {
    const html = await readFile(path.join(root, "games", slug, "index.html"), "utf8");
    if (/请稍候|开发中|即将开放|coming\s+soon/i.test(html)) fail(`V1 game has placeholder copy: ${slug}`);
  } catch {
    fail(`V1 game is missing: ${slug}`);
  }
}

const testSpecs = [
  { directory: "", games: v1Games },
  ...editions.map((spec) => ({ directory: `${spec.directory}/`, games: spec.games })),
];
for (const spec of testSpecs) {
  const prefix = spec.directory ? `${spec.directory}games/` : "games/";
  const discovered = files
    .map((file) => [file, path.relative(root, file).split(path.sep).join("/")])
    .filter(([, relative]) => new RegExp(`^${prefix.replace("/", "\\/")}[^/]+/tests\\.mjs$`).test(relative));
  const expected = new Set(spec.games.map(([, slug]) => `${prefix}${slug}/tests.mjs`));
  const found = new Set(discovered.map(([, relative]) => relative));
  for (const pathName of expected) if (!found.has(pathName)) fail(`Realm test suite is missing: ${pathName}`);
  for (const pathName of found) if (!expected.has(pathName)) fail(`Unregistered realm test suite found: ${pathName}`);
  for (const [test] of discovered) {
    const result = spawnSync(process.execPath, [test], { encoding: "utf8" });
    process.stdout.write(result.stdout);
    if (result.status !== 0) {
      failures += 1;
      process.stderr.write(result.stderr || `Test failed: ${path.relative(root, test)}\n`);
    }
  }
}

for (const sharedTest of ["shared/tests.mjs", "v2/shared/tests.mjs", "v3/shared/tests.mjs"]) {
  const test = path.join(root, sharedTest);
  const result = spawnSync(process.execPath, [test], { encoding: "utf8" });
  process.stdout.write(result.stdout);
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(result.stderr || `Test failed: ${sharedTest}\n`);
  }
}

for (const spec of editions) {
  const editionRoot = editionSources.get(spec.directory);
  const oppositePrefix = spec.directory === "v2" ? "ten-realms-v3" : "ten-realms-v2";
  for (const file of files.filter((item) => item.startsWith(`${editionRoot}${path.sep}`) && /\.(?:js|mjs)$/.test(item))) {
    const source = await readFile(file, "utf8");
    if (path.basename(file) !== "tests.mjs" && source.includes(oppositePrefix)) {
      fail(`${spec.label} production code refers to the other edition namespace: ${path.relative(root, file)}`);
    }
    if (path.basename(file) !== "tests.mjs" && source.includes("localStorage.clear(")) {
      fail(`${spec.label} production code may not clear shared browser storage: ${path.relative(root, file)}`);
    }
    for (const match of source.matchAll(moduleReferencePattern)) {
      const reference = match[1] ?? match[2];
      if (!reference.startsWith(".")) continue;
      const resolved = path.resolve(path.dirname(file), reference);
      if (resolved !== editionRoot && !resolved.startsWith(`${editionRoot}${path.sep}`)) {
        fail(`${spec.label} runtime import escapes its version tree: ${path.relative(root, file)} -> ${reference}`);
      }
    }
  }
  const worker = await readFile(path.join(editionRoot, "sw.js"), "utf8");
  if (!worker.includes(spec.cachePrefix) || !worker.includes("url.pathname.startsWith(scope.pathname)")
      || /\bcaches\.match\(/.test(worker)) {
    fail(`${spec.label} service worker is not correctly scope-isolated.`);
  }
  if (spec.directory === "v3" && (!worker.includes("__TEN_REALMS_V3_BUILD_REVISION__") || worker.includes("ten-realms-v2-arcade-"))) {
    fail("V3 service worker must use the V3 revision token and cache prefix only.");
  }
  if (spec.directory === "v2" && (!worker.includes("__TEN_REALMS_V2_BUILD_REVISION__") || worker.includes("ten-realms-v3-arcade-"))) {
    fail("V2 service worker must use the V2 revision token and cache prefix only.");
  }
}

const rootWorker = await readFile(path.join(root, "sw.js"), "utf8");
if (!rootWorker.includes('new URL("./v2/", self.registration.scope)') || !rootWorker.includes('new URL("./v3/", self.registration.scope)')) {
  fail("Root service worker must bypass both V2 and V3 paths.");
}
const v2Ui = await readFile(path.join(root, "v2", "shared", "realm-ui.mjs"), "utf8");
const v3Ui = await readFile(path.join(root, "v3", "shared", "realm-ui.mjs"), "utf8");
if (!v2Ui.includes("2.0 十款共享")) fail("V2 shared reward copy must identify the ten-game 2.0 release.");
if (!v3Ui.includes("3.0 十款共享") || !v3Ui.includes("window.TenRealmsV3")) {
  fail("V3 shared reward host must identify the ten-game 3.0 release and expose its isolated host.");
}

if (failures) {
  console.error(`Validation failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log(`Validated ${files.length} files.`);
