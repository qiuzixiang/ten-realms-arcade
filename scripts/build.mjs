import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "dist");
const excluded = new Set([".git", ".github", "dist", "node_modules", "scripts"]);
const sourceEntries = [
  "index.html", "styles.css", "app.js", "sw.js", "assets", "games", "shared",
  "manifest.webmanifest", "v2", ".nojekyll", "LICENSE", "THIRD_PARTY_NOTICES.md",
];
const v1GameSlugs = [
  "star-drift", "memory-ark", "red-thread-office", "firefly-garden", "abyss-echo",
  "storm-lanterns", "night-market-spirits", "sky-bridges", "spirit-dragon", "mirror-theatre",
];
const v2GameSlugs = [
  "cloud-camp", "mist-photo-studio", "mystic-perfumery", "nebula-hatchery", "neon-skyline",
  "polar-railway", "season-dyehouse", "yokai-inn", "aurora-magnet-lab", "dream-hotel",
  "time-sand-post", "molten-core-vent", "paper-crane-sanctuary", "resonance-bell-room", "four-spirit-habitat",
];
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

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of sourceEntries) {
  const source = path.join(root, entry);
  await cp(source, path.join(out, entry), {
    recursive: true,
    filter: (item) => !excluded.has(path.relative(root, item).split(path.sep)[0]),
  });
}

async function collect(directory, base = directory, filter = () => true) {
  const assets = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      const relative = path.relative(base, file).split(path.sep).join("/");
      if (!filter(relative, entry)) continue;
      if (entry.isDirectory()) await walk(file);
      else assets.push(`./${relative}`);
    }
  }
  await walk(directory);
  return assets.sort();
}

async function revisionFor(base, assets) {
  const hash = createHash("sha256");
  for (const asset of assets) {
    hash.update(asset);
    hash.update(await readFile(path.join(base, asset.slice(2))));
  }
  return hash.digest("hex").slice(0, 12);
}

function validatePrecachePaths(name, assets) {
  if (assets.length !== new Set(assets).size) throw new Error(`${name} precache contains duplicate paths.`);
  for (const asset of assets) {
    const segments = asset.slice(2).split("/");
    if (!/^\.\/[A-Za-z0-9._~/-]+$/.test(asset)
        || segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error(`${name} precache contains a non-canonical path: ${asset}`);
    }
  }
}

function gameSlugsIn(assets) {
  return [...new Set(assets.flatMap((asset) => {
    const match = asset.match(/^\.\/games\/([a-z0-9][a-z0-9-]{1,39})\//);
    return match ? [match[1]] : [];
  }))].sort();
}

async function finalizeScope({ directory, assets, serviceWorker, token, manifest }) {
  const revision = await revisionFor(directory, assets);
  const workerPath = path.join(directory, serviceWorker);
  const worker = await readFile(workerPath, "utf8");
  if (!worker.includes(token)) throw new Error(`${serviceWorker} build revision token is missing.`);
  await writeFile(workerPath, worker.replaceAll(token, revision));
  await writeFile(path.join(directory, manifest), `${JSON.stringify(assets)}\n`);
  return revision;
}

const rootPrecache = await collect(out, out, (relative) => {
  const first = relative.split("/")[0];
  return first !== "v2" && relative !== "precache-manifest.json";
});
const v2Directory = path.join(out, "v2");
const v2Precache = await collect(v2Directory, v2Directory, (relative) => relative !== "precache-manifest.json");
validatePrecachePaths("V1", rootPrecache);
validatePrecachePaths("V2.5", v2Precache);
if (rootPrecache.some((asset) => asset === "./v2" || asset.startsWith("./v2/"))) {
  throw new Error("The 1.0 precache must not contain 2.5 assets.");
}
if (JSON.stringify(gameSlugsIn(rootPrecache)) !== JSON.stringify([...v1GameSlugs].sort())) {
  throw new Error("The 1.0 precache game directories do not exactly match the ten V1 games.");
}
for (const slug of v1GameSlugs) {
  if (v2Precache.some((asset) => asset.startsWith(`./games/${slug}/`))) {
    throw new Error(`The 2.5 precache must not contain the 1.0 game ${slug}.`);
  }
}
const v2Registry = JSON.parse(await readFile(path.join(v2Directory, "games.json"), "utf8"));
if (v2Registry.edition !== "2.5" || v2Registry.status !== "ready" || v2Registry.expectedGames !== v2GameSlugs.length
    || JSON.stringify((v2Registry.games ?? []).map((game) => game.slug)) !== JSON.stringify(v2GameSlugs)) {
  throw new Error("The V2.5 registry does not exactly match the fixed fifteen-game release.");
}
if (JSON.stringify(gameSlugsIn(v2Precache)) !== JSON.stringify([...v2GameSlugs].sort())) {
  throw new Error("The V2.5 precache game directories do not exactly match the fifteen registered games.");
}
for (const asset of [
  "./index.html", "./styles.css", "./app.js", "./sw.js", "./games.json", "./manifest.webmanifest",
  "./shared/realm-ui.css", "./shared/realm-ui.mjs", "./shared/reward-engine.mjs",
  "./shared/storage.mjs", "./shared/tutorial-data.mjs",
]) {
  if (!v2Precache.includes(asset)) throw new Error(`The V2.5 precache is missing ${asset}.`);
}
for (const game of v2Registry.games ?? []) {
  if (game.preview !== `./assets/previews/${game.slug}.webp`) {
    throw new Error(`The V2.5 registry preview path is not canonical for ${game.slug}.`);
  }
  const requiredAssets = [
    `./games/${game.slug}/index.html`,
    `./games/${game.slug}/app.mjs`,
    `./games/${game.slug}/styles.css`,
    game.preview,
    ...(nativeTutorialAssets.get(game.slug) ?? []).map((asset) => `./games/${game.slug}/assets/${asset}`),
  ];
  for (const asset of requiredAssets) {
    if (!v2Precache.includes(asset)) throw new Error(`The 2.5 precache is missing ${asset}.`);
  }
}

const rootRevision = await finalizeScope({
  directory: out,
  assets: rootPrecache,
  serviceWorker: "sw.js",
  token: "__TEN_REALMS_BUILD_REVISION__",
  manifest: "precache-manifest.json",
});
const v2Revision = await finalizeScope({
  directory: v2Directory,
  assets: v2Precache,
  serviceWorker: "sw.js",
  token: "__TEN_REALMS_V2_BUILD_REVISION__",
  manifest: "precache-manifest.json",
});

const finalizedRootWorker = await readFile(path.join(out, "sw.js"), "utf8");
const finalizedV2Worker = await readFile(path.join(v2Directory, "sw.js"), "utf8");
if (finalizedRootWorker.includes("__TEN_REALMS_BUILD_REVISION__")) throw new Error("The 1.0 service-worker revision was not finalized.");
if (finalizedV2Worker.includes("__TEN_REALMS_V2_BUILD_REVISION__")) throw new Error("The 2.5 service-worker revision was not finalized.");

console.log(`Built ${rootPrecache.length} v1 assets (cache ${rootRevision}) and ${v2Precache.length} v2 assets (cache ${v2Revision}) into dist/.`);
