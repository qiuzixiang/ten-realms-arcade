import { access, readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

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

const sharedTest = path.join(root, "shared", "tests.mjs");
const sharedResult = spawnSync(process.execPath, [sharedTest], { encoding: "utf8" });
process.stdout.write(sharedResult.stdout);
if (sharedResult.status !== 0) {
  failures += 1;
  process.stderr.write(sharedResult.stderr);
}

if (failures) {
  console.error(`Validation failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log(`Validated ${files.length} files.`);
