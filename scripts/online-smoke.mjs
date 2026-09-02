import { readFile } from "node:fs/promises";

const V1_GAMES = [
  "star-drift", "memory-ark", "red-thread-office", "firefly-garden", "abyss-echo",
  "storm-lanterns", "night-market-spirits", "sky-bridges", "spirit-dragon", "mirror-theatre",
];

const editions = [
  {
    label: "V2.0", directory: "v2", edition: "2.0",
    workerToken: "__TEN_REALMS_V2_BUILD_REVISION__", cachePrefix: "ten-realms-v2-arcade-",
    otherCachePrefix: "ten-realms-v3-arcade-",
    games: [
      "cloud-camp", "mist-photo-studio", "mystic-perfumery", "nebula-hatchery", "neon-skyline",
      "polar-railway", "season-dyehouse", "yokai-inn", "aurora-magnet-lab", "dream-hotel",
    ],
    tutorials: new Map([
      ["polar-railway", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
      ["season-dyehouse", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["yokai-inn", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
      ["aurora-magnet-lab", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
      ["dream-hotel", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
    ]),
    sharedTutorials: ["cloud-camp", "mist-photo-studio", "mystic-perfumery", "nebula-hatchery", "neon-skyline"],
  },
  {
    label: "V3.0", directory: "v3", edition: "3.0",
    workerToken: "__TEN_REALMS_V3_BUILD_REVISION__", cachePrefix: "ten-realms-v3-arcade-",
    otherCachePrefix: "ten-realms-v2-arcade-",
    games: [
      "time-sand-post", "molten-core-vent", "paper-crane-sanctuary", "resonance-bell-room", "four-spirit-habitat",
      "star-dial-bureau", "stardust-survey", "coral-bloom-lab", "eclipse-watch", "celestial-mural",
    ],
    tutorials: new Map([
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
    sharedTutorials: [],
  },
  {
    label: "V4.0", directory: "v4", edition: "4.0",
    workerToken: "__TEN_REALMS_V4_BUILD_REVISION__", cachePrefix: "ten-realms-v4-arcade-",
    storagePrefix: "ten-realms-v4:", rewardHost: "window.TenRealmsV4", previewType: "image/jpeg", previewExtension: "jpg",
    // V4 game shells deliberately delegate their interface to the module renderer.
    // Keep a meaningful lower bound without requiring inert markup just to reach 1 KB.
    gameHtmlMinimumBytes: 640,
    games: [
      "time-cargo-bay", "quantum-apothecary", "lunar-tide-seal", "orbital-formation", "archipelago-guard",
      "shadow-print-lab", "orbit-atlas", "stellar-archive", "balance-terrace", "daynight-loom",
    ],
    tutorials: new Map(),
    sharedTutorials: [],
    runtimeTutorials: new Set([
      "time-cargo-bay", "quantum-apothecary", "lunar-tide-seal", "orbital-formation", "archipelago-guard",
      "shadow-print-lab", "orbit-atlas", "stellar-archive", "balance-terrace", "daynight-loom",
    ]),
  },
];

const RELEASE = (process.env.GITHUB_SHA || "manual").slice(0, 12);
const RETRIES = Number.parseInt(process.env.ONLINE_SMOKE_RETRIES || "30", 10);
const RETRY_DELAY_MS = Number.parseInt(process.env.ONLINE_SMOKE_RETRY_DELAY_MS || "10000", 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireBase(name, value) {
  if (!value) throw new Error(`${name} is required.`);
  const url = new URL(value);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function releaseUrl(path, base) {
  const url = new URL(path, base);
  url.searchParams.set("release", RELEASE);
  return url;
}

async function fetchAsset(url, { type, minimumBytes = 1 } = {}) {
  const requestedUrl = new URL(url);
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const finalUrl = new URL(response.url);
  if (finalUrl.origin !== requestedUrl.origin || finalUrl.pathname !== requestedUrl.pathname) {
    throw new Error(`Unexpected redirect from ${requestedUrl} to ${finalUrl}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (type && !contentType.toLowerCase().includes(type)) {
    throw new Error(`Unexpected content type ${JSON.stringify(contentType)} for ${url}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < minimumBytes) throw new Error(`Short response (${bytes.byteLength} bytes) for ${url}`);
  return { bytes, text: new TextDecoder().decode(bytes) };
}

async function rejectUnexpectedAsset(url) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.ok) throw new Error(`Unexpected fallback or mixed-edition asset at ${url}`);
}

function parsePrecacheManifest(name, text) {
  let assets;
  try {
    assets = JSON.parse(text);
  } catch {
    throw new Error(`${name}: precache manifest is not valid JSON.`);
  }
  assert(Array.isArray(assets), `${name}: precache manifest is not an array.`);
  assert(assets.length === new Set(assets).size, `${name}: precache manifest contains duplicates.`);
  const scope = new URL("https://precache.invalid/scope/");
  for (const asset of assets) {
    const segments = typeof asset === "string" ? asset.slice(2).split("/") : [];
    assert(typeof asset === "string" && /^\.\/[A-Za-z0-9._~/-]+$/.test(asset)
      && segments.every((segment) => segment && segment !== "." && segment !== ".."),
    `${name}: precache path is invalid: ${JSON.stringify(asset)}.`);
    const resolved = new URL(asset, scope);
    assert(resolved.origin === scope.origin && resolved.pathname === `${scope.pathname}${asset.slice(2)}`,
      `${name}: precache path escapes its scope: ${JSON.stringify(asset)}.`);
  }
  return assets;
}

function gameSlugs(assets) {
  return [...new Set(assets.flatMap((asset) => {
    const match = asset.match(/^\.\/games\/([a-z0-9][a-z0-9-]{1,39})\//);
    return match ? [match[1]] : [];
  }))].sort();
}

function requireAssets(name, assets, required) {
  const available = new Set(assets);
  for (const asset of required) assert(available.has(asset), `${name}: precache is missing ${asset}.`);
}

function revisionFromWorker(name, source) {
  const revision = source.match(/\bconst BUILD_REVISION\s*=\s*"([0-9a-f]{12})"\s*;/i)?.[1];
  assert(revision, `${name}: service-worker build revision is not finalized.`);
  return revision;
}

function assertExactBytes(name, actual, expected) {
  assert(actual.byteLength === expected.byteLength && Buffer.from(actual).equals(expected),
    `${name}: deployed bytes differ from this build.`);
}

function webpDimensions(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 30) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start, end) => new TextDecoder("ascii").decode(bytes.subarray(start, end));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP") return null;
  const chunk = ascii(12, 16);
  if (chunk === "VP8X") return {
    width: view.getUint8(24) + (view.getUint8(25) << 8) + (view.getUint8(26) << 16) + 1,
    height: view.getUint8(27) + (view.getUint8(28) << 8) + (view.getUint8(29) << 16) + 1,
  };
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (chunk === "VP8L" && view.getUint8(20) === 0x2f) {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

function jpegDimensions(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 10 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset]; offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.byteLength) return null;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.byteLength) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function tutorialIsNative(source) {
  return /<svg\b/i.test(source)
    && /\brole=["']img["']/i.test(source)
    && /\bviewBox=["']/i.test(source)
    && /\bpreserveAspectRatio=["']xMidYMid/i.test(source)
    && /\bdata-[a-z-]+=["']/i.test(source);
}

const localDist = new URL("../dist/", import.meta.url);
const rootSources = await Promise.all([
  readFile(new URL("sw.js", localDist), "utf8"),
  readFile(new URL("precache-manifest.json", localDist), "utf8"),
]);
const localEditionSources = new Map(await Promise.all(editions.map(async (spec) => [spec.directory, await Promise.all([
  readFile(new URL(`${spec.directory}/sw.js`, localDist), "utf8"),
  readFile(new URL(`${spec.directory}/precache-manifest.json`, localDist), "utf8"),
])])));

async function verifyRoot(name, root) {
  const [page, workerResponse, manifestResponse] = await Promise.all([
    fetchAsset(releaseUrl("./", root), { type: "text/html", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("sw.js", root), { type: "javascript", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("precache-manifest.json", root), { type: "json", minimumBytes: 500 }),
  ]);
  const [expectedWorker, expectedManifestText] = rootSources;
  assert(page.text.includes("十境谜游馆"), `${name}/v1: root guide is missing.`);
  assertExactBytes(`${name}/v1/sw.js`, workerResponse.bytes, Buffer.from(expectedWorker));
  assertExactBytes(`${name}/v1/precache-manifest.json`, manifestResponse.bytes, Buffer.from(expectedManifestText));
  assert(!workerResponse.text.includes("__TEN_REALMS_BUILD_REVISION__"), `${name}/v1: worker revision token remains.`);
  assert(workerResponse.text.includes("ten-realms-arcade-"), `${name}/v1: cache namespace is missing.`);
  assert(["v2", "v3", "v4"].every((directory) => workerResponse.text.includes(`new URL("./${directory}/", self.registration.scope)`)),
    `${name}/v1: worker does not bypass all later edition scopes.`);
  const manifest = parsePrecacheManifest(`${name}/v1`, manifestResponse.text);
  assert(JSON.stringify(gameSlugs(manifest)) === JSON.stringify([...V1_GAMES].sort()),
    `${name}/v1: game precache boundary is wrong.`);
  assert(!manifest.some((asset) => asset.startsWith("./v2/") || asset.startsWith("./v3/") || asset.startsWith("./v4/")),
    `${name}/v1: later-edition private assets leaked into root cache.`);
  requireAssets(`${name}/v1`, manifest, ["./index.html", "./app.js", "./styles.css", "./sw.js", "./shared/realm-ui.mjs"]);
  await Promise.all(V1_GAMES.map(async (slug) => {
    const html = await fetchAsset(releaseUrl(`games/${slug}/`, root), { type: "text/html", minimumBytes: 1_000 });
    assert(!/请稍候|开发中|即将开放|coming\s+soon/i.test(html.text), `${name}/v1/${slug}: placeholder page deployed.`);
  }));
  return { revision: revisionFromWorker(`${name}/v1`, workerResponse.text), assets: manifest.length };
}

async function verifyEdition(name, root, spec) {
  const base = new URL(`${spec.directory}/`, root);
  const [guide, registryResponse, workerResponse, manifestResponse] = await Promise.all([
    fetchAsset(releaseUrl("./", base), { type: "text/html", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("games.json", base), { type: "json", minimumBytes: 500 }),
    fetchAsset(releaseUrl("sw.js", base), { type: "javascript", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("precache-manifest.json", base), { type: "json", minimumBytes: 500 }),
  ]);
  const [expectedWorker, expectedManifestText] = localEditionSources.get(spec.directory);
  assert(guide.text.includes(`十境谜游馆 ${spec.edition}`), `${name}/${spec.directory}: guide shell is missing ${spec.edition}.`);
  const registry = JSON.parse(registryResponse.text);
  assert(registry.edition === spec.edition && registry.status === "ready" && registry.expectedGames === spec.games.length,
    `${name}/${spec.directory}: registry release metadata is inconsistent.`);
  assert(JSON.stringify(registry.games?.map((game) => game.slug)) === JSON.stringify(spec.games),
    `${name}/${spec.directory}: registry games are not the fixed ten-game release.`);
  assertExactBytes(`${name}/${spec.directory}/sw.js`, workerResponse.bytes, Buffer.from(expectedWorker));
  assertExactBytes(`${name}/${spec.directory}/precache-manifest.json`, manifestResponse.bytes, Buffer.from(expectedManifestText));
  assert(!workerResponse.text.includes(spec.workerToken), `${name}/${spec.directory}: worker revision token remains.`);
  assert(workerResponse.text.includes(spec.cachePrefix) && editions.filter((item) => item.directory !== spec.directory)
    .every((item) => !workerResponse.text.includes(item.cachePrefix)),
    `${name}/${spec.directory}: cache namespace is not edition-isolated.`);
  assert(workerResponse.text.includes("url.pathname.startsWith(scope.pathname)") && !/\bcaches\.match\(/.test(workerResponse.text),
    `${name}/${spec.directory}: worker scope guard is missing.`);
  const manifest = parsePrecacheManifest(`${name}/${spec.directory}`, manifestResponse.text);
  assert(JSON.stringify(gameSlugs(manifest)) === JSON.stringify([...spec.games].sort()),
    `${name}/${spec.directory}: game precache boundary is wrong.`);
  assert(!manifest.some((asset) => editions.some((item) => asset.startsWith(`./${item.directory}/`))),
    `${name}/${spec.directory}: nested edition resources leaked into precache.`);
  requireAssets(`${name}/${spec.directory}`, manifest, [
    "./index.html", "./games.json", "./app.js", "./styles.css", "./sw.js", "./manifest.webmanifest",
    "./shared/storage.mjs", "./shared/realm-ui.mjs", "./shared/realm-ui.css", "./shared/reward-engine.mjs", "./shared/tutorial-data.mjs",
    ...(spec.directory === "v4" ? ["./shared/game-kit.mjs", "./shared/completion-outbox.mjs"] : []),
    ...spec.games.flatMap((slug) => [
      `./games/${slug}/index.html`, `./games/${slug}/app.mjs`, `./games/${slug}/styles.css`,
      `./assets/previews/${slug}.${spec.previewExtension ?? "webp"}`,
      ...(spec.tutorials.get(slug) ?? []).map((file) => `./games/${slug}/assets/${file}`),
    ]),
  ]);

  const [sharedStorage, sharedUi, sharedTutorialData] = await Promise.all([
    fetchAsset(releaseUrl("shared/storage.mjs", base), { type: "javascript", minimumBytes: 300 }),
    fetchAsset(releaseUrl("shared/realm-ui.mjs", base), { type: "javascript", minimumBytes: 3_000 }),
    fetchAsset(releaseUrl("shared/tutorial-data.mjs", base), { type: "javascript", minimumBytes: 100 }),
  ]);
  const storagePrefix = spec.storagePrefix ?? (spec.directory === "v2" ? "ten-realms-v2:" : "ten-realms-v3:");
  const rewardHost = spec.rewardHost ?? (spec.directory === "v2" ? "window.RealmArcade" : "window.TenRealmsV3");
  assert(sharedStorage.text.includes(storagePrefix), `${name}/${spec.directory}: shared storage prefix is wrong.`);
  assert(sharedUi.text.includes(rewardHost),
    `${name}/${spec.directory}: shared reward host is absent.`);

  await Promise.all(registry.games.map(async (game) => {
    const gameBase = new URL(`games/${game.slug}/`, base);
    const [html, app, css, preview] = await Promise.all([
      fetchAsset(releaseUrl("./", gameBase), { type: "text/html", minimumBytes: spec.gameHtmlMinimumBytes ?? 1_000 }),
      fetchAsset(releaseUrl("app.mjs", gameBase), { type: "javascript", minimumBytes: 800 }),
      fetchAsset(releaseUrl("styles.css", gameBase), { type: "css", minimumBytes: 800 }),
      fetchAsset(releaseUrl(game.preview.replace(/^\.\//, ""), base), { type: spec.previewType ?? "image/webp", minimumBytes: 4_096 }),
    ]);
    assert(html.text.includes(`data-realm="${game.slug}"`), `${name}/${spec.directory}/${game.slug}: data-realm is absent.`);
    assert(html.text.includes("../../shared/realm-ui"), `${name}/${spec.directory}/${game.slug}: shared reward UI is not wired.`);
    const nativeTutorials = spec.tutorials.get(game.slug);
    const sharedTutorial = spec.sharedTutorials.includes(game.slug);
    const runtimeTutorial = spec.runtimeTutorials?.has(game.slug) === true;
    assert(Number(Boolean(nativeTutorials)) + Number(sharedTutorial) + Number(runtimeTutorial) === 1,
      `${name}/${spec.directory}/${game.slug}: tutorial mode must be exactly native, shared or runtime.`);
    if (nativeTutorials) {
      assert(html.text.includes('id="tutorial-button"'), `${name}/${spec.directory}/${game.slug}: native tutorial entry is absent.`);
    } else if (sharedTutorial) {
      assert(sharedTutorialData.text.includes(`"${game.slug}"`),
        `${name}/${spec.directory}/${game.slug}: shared tutorial contract is absent.`);
    } else {
      assert(app.text.includes("tutorialCards") && app.text.includes("game-kit"),
        `${name}/${spec.directory}/${game.slug}: rule-derived runtime tutorial is absent.`);
    }
    assert(html.text.includes('href="../../"'), `${name}/${spec.directory}/${game.slug}: return link is not canonical.`);
    assert(!/请稍候|开发中|即将开放|coming\s+soon/i.test(html.text), `${name}/${spec.directory}/${game.slug}: placeholder page deployed.`);
    assert(app.bytes.byteLength >= 800 && css.bytes.byteLength >= 800, `${name}/${spec.directory}/${game.slug}: core assets are too short.`);
    const dimensions = spec.previewExtension === "jpg" ? jpegDimensions(preview.bytes) : webpDimensions(preview.bytes);
    assert(dimensions?.width === 1200 && dimensions?.height === 652,
      `${name}/${spec.directory}/${game.slug}: preview is not a 1200×652 ${spec.previewExtension === "jpg" ? "JPEG" : "WebP"}.`);
    for (const filename of nativeTutorials ?? []) {
      const tutorial = await fetchAsset(releaseUrl(`assets/${filename}`, gameBase), { type: "image/svg+xml", minimumBytes: 1_000 });
      assert(tutorialIsNative(tutorial.text), `${name}/${spec.directory}/${game.slug}/${filename}: tutorial is not a replayable native SVG.`);
    }
  }));

  const localBase = new URL(`${spec.directory}/`, localDist);
  const criticalModules = [
    "./app.js", "./shared/storage.mjs", "./shared/realm-ui.mjs", "./shared/reward-engine.mjs", "./shared/tutorial-data.mjs",
    ...(spec.directory === "v4" ? ["./shared/game-kit.mjs", "./shared/completion-outbox.mjs"] : []),
    ...spec.games.map((slug) => `./games/${slug}/app.mjs`),
  ];
  await Promise.all(criticalModules.map(async (asset) => {
    const [remote, local] = await Promise.all([
      fetchAsset(releaseUrl(asset.slice(2), base), { type: "javascript", minimumBytes: 16 }),
      readFile(new URL(asset.slice(2), localBase)),
    ]);
    assertExactBytes(`${name}/${spec.directory}/${asset.slice(2)}`, remote.bytes, local);
  }));

  await Promise.all([
    ...editions.filter((item) => item.directory !== spec.directory)
      .map((other) => rejectUnexpectedAsset(releaseUrl(`games/${other.games[0]}/app.mjs`, base))),
    rejectUnexpectedAsset(releaseUrl("games/__not-a-realm__/app.mjs", base)),
  ]);
  return { revision: revisionFromWorker(`${name}/${spec.directory}`, workerResponse.text), assets: manifest.length };
}

async function verifyHost(name, root) {
  const rootResult = await verifyRoot(name, root);
  const results = await Promise.all(editions.map((spec) => verifyEdition(name, root, spec)));
  return `${name}: V1 (${rootResult.assets} assets, ${rootResult.revision}), ${editions.map((spec, index) => `${spec.label} (${results[index].assets} assets, ${results[index].revision})`).join(", ")} verified`;
}

async function eventually(name, task) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === RETRIES) break;
      console.log(`${name}: waiting for production release (${attempt}/${RETRIES}) — ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

const targets = [
  ["GitHub Pages", requireBase("PAGES_BASE_URL", process.env.PAGES_BASE_URL)],
  ["Vercel", requireBase("VERCEL_BASE_URL", process.env.VERCEL_BASE_URL)],
];
const results = await Promise.all(targets.map(([name, root]) => eventually(name, () => verifyHost(name, root))));
for (const result of results) console.log(`✓ ${result}`);
