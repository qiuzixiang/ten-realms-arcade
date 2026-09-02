import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "dist");
const excluded = new Set([".git", ".github", "dist", "node_modules", "scripts"]);
const sourceEntries = [
  "index.html", "styles.css", "app.js", "sw.js", "assets", "games", "shared",
  "manifest.webmanifest", "v2", "v3", "v4", ".nojekyll", "LICENSE", "THIRD_PARTY_NOTICES.md",
];
const v1GameSlugs = [
  "star-drift", "memory-ark", "red-thread-office", "firefly-garden", "abyss-echo",
  "storm-lanterns", "night-market-spirits", "sky-bridges", "spirit-dragon", "mirror-theatre",
];

const nativeTutorials = (entries) => new Map(entries);
const editions = [
  {
    label: "V2.0",
    directory: "v2",
    edition: "2.0",
    token: "__TEN_REALMS_V2_BUILD_REVISION__",
    slugs: [
      "cloud-camp", "mist-photo-studio", "mystic-perfumery", "nebula-hatchery", "neon-skyline",
      "polar-railway", "season-dyehouse", "yokai-inn", "aurora-magnet-lab", "dream-hotel",
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
    label: "V3.0",
    directory: "v3",
    edition: "3.0",
    token: "__TEN_REALMS_V3_BUILD_REVISION__",
    slugs: [
      "time-sand-post", "molten-core-vent", "paper-crane-sanctuary", "resonance-bell-room", "four-spirit-habitat",
      "star-dial-bureau", "stardust-survey", "coral-bloom-lab", "eclipse-watch", "celestial-mural",
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
  {
    label: "V4.0",
    directory: "v4",
    edition: "4.0",
    previewExtension: "jpg",
    token: "__TEN_REALMS_V4_BUILD_REVISION__",
    slugs: [
      "time-cargo-bay", "quantum-apothecary", "lunar-tide-seal", "orbital-formation", "archipelago-guard",
      "shadow-print-lab", "orbit-atlas", "stellar-archive", "balance-terrace", "daynight-loom",
    ],
    nativeTutorialAssets: nativeTutorials([]),
  },
];

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

async function validateEdition(spec, assets) {
  validatePrecachePaths(spec.label, assets);
  const directory = path.join(out, spec.directory);
  const registry = JSON.parse(await readFile(path.join(directory, "games.json"), "utf8"));
  const expectedSorted = [...spec.slugs].sort();
  if (registry.edition !== spec.edition || registry.status !== "ready" || registry.expectedGames !== spec.slugs.length
      || JSON.stringify((registry.games ?? []).map((game) => game.slug)) !== JSON.stringify(spec.slugs)) {
    throw new Error(`${spec.label} registry does not match its fixed ten-game release.`);
  }
  if (JSON.stringify(gameSlugsIn(assets)) !== JSON.stringify(expectedSorted)) {
    throw new Error(`${spec.label} precache game directories do not exactly match the registry.`);
  }
  for (const slug of v1GameSlugs) {
    if (assets.some((asset) => asset.startsWith(`./games/${slug}/`))) {
      throw new Error(`${spec.label} precache must not contain the V1 game ${slug}.`);
    }
  }
  for (const asset of [
    "./index.html", "./styles.css", "./app.js", "./sw.js", "./games.json", "./manifest.webmanifest",
    "./shared/realm-ui.css", "./shared/realm-ui.mjs", "./shared/reward-engine.mjs",
    "./shared/storage.mjs", "./shared/tutorial-data.mjs",
  ]) {
    if (!assets.includes(asset)) throw new Error(`${spec.label} precache is missing ${asset}.`);
  }
  for (const game of registry.games) {
    if (game.preview !== `./assets/previews/${game.slug}.${spec.previewExtension ?? "webp"}`) {
      throw new Error(`${spec.label} preview path is not canonical for ${game.slug}.`);
    }
    const required = [
      `./games/${game.slug}/index.html`,
      `./games/${game.slug}/app.mjs`,
      `./games/${game.slug}/styles.css`,
      game.preview,
      ...(spec.nativeTutorialAssets.get(game.slug) ?? []).map((asset) => `./games/${game.slug}/assets/${asset}`),
    ];
    for (const asset of required) {
      if (!assets.includes(asset)) throw new Error(`${spec.label} precache is missing ${asset}.`);
    }
  }
}

const rootPrecache = await collect(out, out, (relative) => {
  const first = relative.split("/")[0];
  return first !== "v2" && first !== "v3" && first !== "v4" && relative !== "precache-manifest.json";
});
validatePrecachePaths("V1", rootPrecache);
if (rootPrecache.some((asset) => asset === "./v2" || asset.startsWith("./v2/")
    || asset === "./v3" || asset.startsWith("./v3/") || asset === "./v4" || asset.startsWith("./v4/"))) {
  throw new Error("The V1 precache must not contain V2, V3 or V4 private assets.");
}
if (JSON.stringify(gameSlugsIn(rootPrecache)) !== JSON.stringify([...v1GameSlugs].sort())) {
  throw new Error("The V1 precache game directories do not exactly match the ten V1 games.");
}

const editionPrecache = new Map();
for (const spec of editions) {
  const directory = path.join(out, spec.directory);
  const assets = await collect(directory, directory, (relative) => relative !== "precache-manifest.json");
  await validateEdition(spec, assets);
  editionPrecache.set(spec.directory, assets);
}

const rootRevision = await finalizeScope({
  directory: out,
  assets: rootPrecache,
  serviceWorker: "sw.js",
  token: "__TEN_REALMS_BUILD_REVISION__",
  manifest: "precache-manifest.json",
});
const editionRevisions = new Map();
for (const spec of editions) {
  editionRevisions.set(spec.directory, await finalizeScope({
    directory: path.join(out, spec.directory),
    assets: editionPrecache.get(spec.directory),
    serviceWorker: "sw.js",
    token: spec.token,
    manifest: "precache-manifest.json",
  }));
}

const rootWorker = await readFile(path.join(out, "sw.js"), "utf8");
if (rootWorker.includes("__TEN_REALMS_BUILD_REVISION__")) throw new Error("The V1 service-worker revision was not finalized.");
for (const spec of editions) {
  const worker = await readFile(path.join(out, spec.directory, "sw.js"), "utf8");
  if (worker.includes(spec.token)) throw new Error(`${spec.label} service-worker revision was not finalized.`);
}

console.log(
  `Built ${rootPrecache.length} V1 assets (cache ${rootRevision}), ${editionPrecache.get("v2").length} V2 assets (cache ${editionRevisions.get("v2")}), ${editionPrecache.get("v3").length} V3 assets (cache ${editionRevisions.get("v3")}), and ${editionPrecache.get("v4").length} V4 assets (cache ${editionRevisions.get("v4")}) into dist/.`,
);
