import { readFile } from "node:fs/promises";

const EXPECTED_SLUGS = [
  "cloud-camp",
  "mist-photo-studio",
  "mystic-perfumery",
  "nebula-hatchery",
  "neon-skyline",
  "polar-railway",
  "season-dyehouse",
  "yokai-inn",
  "aurora-magnet-lab",
  "dream-hotel",
  "time-sand-post",
  "molten-core-vent",
  "paper-crane-sanctuary",
  "resonance-bell-room",
  "four-spirit-habitat",
];

const V1_GAME_SLUGS = [
  "star-drift",
  "memory-ark",
  "red-thread-office",
  "firefly-garden",
  "abyss-echo",
  "storm-lanterns",
  "night-market-spirits",
  "sky-bridges",
  "spirit-dragon",
  "mirror-theatre",
];

const NATIVE_TUTORIAL_ASSETS = new Map([
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

const NATIVE_TUTORIAL_REVISIONS = new Map([
  ["time-sand-post", 2],
  ["molten-core-vent", 1],
  ["paper-crane-sanctuary", 1],
  ["resonance-bell-room", 2],
  ["four-spirit-habitat", 1],
]);

const NATIVE_TUTORIAL_GOAL_MARKERS = new Map([
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

const RELEASE = (process.env.GITHUB_SHA || "manual").slice(0, 12);
const RETRIES = Number.parseInt(process.env.ONLINE_SMOKE_RETRIES || "30", 10);
const RETRY_DELAY_MS = Number.parseInt(process.env.ONLINE_SMOKE_RETRY_DELAY_MS || "10000", 10);

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parsePrecacheManifest(name, text) {
  let assets;
  try {
    assets = JSON.parse(text);
  } catch {
    throw new Error(`${name}: precache manifest is not valid JSON.`);
  }
  assert(Array.isArray(assets), `${name}: precache manifest is not an array.`);
  assert(assets.length === new Set(assets).size, `${name}: precache manifest contains duplicate assets.`);
  const sentinelScope = new URL("https://precache.invalid/scope/");
  for (const asset of assets) {
    const segments = typeof asset === "string" ? asset.slice(2).split("/") : [];
    assert(typeof asset === "string" && /^\.\/[A-Za-z0-9._~/-]+$/.test(asset)
      && segments.every((segment) => segment && segment !== "." && segment !== ".."),
      `${name}: precache manifest contains an invalid asset path ${JSON.stringify(asset)}.`);
    const resolved = new URL(asset, sentinelScope);
    assert(resolved.origin === sentinelScope.origin
      && resolved.pathname.startsWith(sentinelScope.pathname)
      && resolved.pathname === `${sentinelScope.pathname}${asset.slice(2)}`,
      `${name}: precache manifest path escapes its service-worker scope: ${JSON.stringify(asset)}.`);
  }
  return assets;
}

function manifestGameSlugs(assets) {
  return [...new Set(assets.flatMap((asset) => {
    const match = asset.match(/^\.\/games\/([a-z0-9][a-z0-9-]{1,39})\//);
    return match ? [match[1]] : [];
  }))].sort();
}

function requireManifestAssets(name, assets, requiredAssets) {
  const manifest = new Set(assets);
  for (const asset of requiredAssets) {
    assert(manifest.has(asset), `${name}: precache manifest is missing ${asset}.`);
  }
}

function requireExactGameSlugs(name, assets, expectedSlugs) {
  assert(JSON.stringify(manifestGameSlugs(assets)) === JSON.stringify([...expectedSlugs].sort()),
    `${name}: precache game directories do not match the release contract.`);
}

function expectGuardFailure(name, task) {
  try {
    task();
  } catch {
    return;
  }
  throw new Error(`online smoke self-check did not reject ${name}.`);
}

expectGuardFailure("an encoded precache path", () => parsePrecacheManifest("fault/encoded", '["./games/%2e%2e/index.html"]'));
expectGuardFailure("a traversal precache path", () => parsePrecacheManifest("fault/traversal", '["./games/../index.html"]'));
expectGuardFailure("a missing required module", () => requireManifestAssets("fault/missing", ["./app.js"], ["./logic.mjs"]));
expectGuardFailure("a mixed-edition manifest", () => requireExactGameSlugs(
  "fault/mixed",
  ["./games/star-drift/index.html", "./games/cloud-camp/index.html"],
  ["star-drift"],
));

async function eachWithConcurrency(items, limit, task) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index]);
    }
  }));
}

function assertExactBytes(name, actual, expected) {
  assert(actual.byteLength === expected.byteLength && Buffer.from(actual).equals(expected),
    `${name}: deployed bytes do not exactly match this build.`);
}

function revisionFromWorker(name, source) {
  const revision = source.match(/\bconst BUILD_REVISION\s*=\s*"([0-9a-f]{12})"\s*;/i)?.[1];
  assert(revision, `${name}: service-worker build revision is not a finalized 12-digit hash.`);
  return revision;
}

function verifyBuiltServiceWorker(name, source, {
  token,
  cachePrefix,
  forbiddenCachePrefix,
  expectedRevision,
  expectedSource,
}) {
  assert(!source.includes(token), `${name}: service-worker revision token was not replaced.`);
  const revision = revisionFromWorker(name, source);
  assert(revision === expectedRevision,
    `${name}: deployed revision ${revision} does not match this build ${expectedRevision}.`);
  assert(source === expectedSource, `${name}: deployed service worker does not exactly match this build.`);
  assert(source.includes(cachePrefix), `${name}: service-worker cache namespace is not isolated.`);
  assert(!source.includes(forbiddenCachePrefix), `${name}: service worker references the other edition's cache namespace.`);
  assert(source.includes("precache-manifest.json"), `${name}: service worker does not load its precache manifest.`);
  return revision;
}

const [expectedRootWorker, expectedV2Worker, expectedRootPrecacheText, expectedV2PrecacheText] = await Promise.all([
  readFile(new URL("../dist/sw.js", import.meta.url), "utf8"),
  readFile(new URL("../dist/v2/sw.js", import.meta.url), "utf8"),
  readFile(new URL("../dist/precache-manifest.json", import.meta.url), "utf8"),
  readFile(new URL("../dist/v2/precache-manifest.json", import.meta.url), "utf8"),
]);
const EXPECTED_ROOT_REVISION = revisionFromWorker("local/v1", expectedRootWorker);
const EXPECTED_V2_REVISION = revisionFromWorker("local/v2", expectedV2Worker);
const EXPECTED_ROOT_PRECACHE = parsePrecacheManifest("local/v1", expectedRootPrecacheText);
const EXPECTED_V2_PRECACHE = parsePrecacheManifest("local/v2", expectedV2PrecacheText);
const LOCAL_V2_DIST = new URL("../dist/v2/", import.meta.url);

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

async function verifyHost(name, root) {
  const v2 = new URL("v2/", root);
  const [rootPage, rootWorkerResponse, rootPrecacheResponse] = await Promise.all([
    fetchAsset(releaseUrl("./", root), { type: "text/html", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("sw.js", root), { type: "javascript", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("precache-manifest.json", root), { type: "json", minimumBytes: 500 }),
  ]);
  assert(rootPage.text.includes("十境谜游馆"), `${name}: 1.0 root shell is missing.`);
  const rootRevision = verifyBuiltServiceWorker(`${name}/v1`, rootWorkerResponse.text, {
    token: "__TEN_REALMS_BUILD_REVISION__",
    cachePrefix: "ten-realms-arcade-",
    forbiddenCachePrefix: "ten-realms-v2-arcade-",
    expectedRevision: EXPECTED_ROOT_REVISION,
    expectedSource: expectedRootWorker,
  });
  assert(rootWorkerResponse.text.includes('new URL("./v2/", self.registration.scope)'),
    `${name}/v1: service worker does not bypass the V2 scope.`);
  const rootPrecache = parsePrecacheManifest(`${name}/v1`, rootPrecacheResponse.text);
  assert(JSON.stringify(rootPrecache) === JSON.stringify(EXPECTED_ROOT_PRECACHE),
    `${name}/v1: deployed precache manifest does not exactly match this build.`);
  assert(!rootPrecache.some((asset) => asset === "./v2" || asset.startsWith("./v2/")),
    `${name}/v1: precache manifest contains private V2 assets.`);
  requireExactGameSlugs(`${name}/v1`, rootPrecache, V1_GAME_SLUGS);
  requireManifestAssets(`${name}/v1`, rootPrecache, [
    "./index.html",
    "./styles.css",
    "./app.js",
    "./sw.js",
    "./manifest.webmanifest",
    "./shared/realm-ui.css",
    "./shared/realm-ui.mjs",
    ...V1_GAME_SLUGS.map((slug) => `./games/${slug}/index.html`),
  ]);

  const [
    tutorialData,
    realmCss,
    realmUi,
    starRedTutorial,
    abyssStormTutorial,
    nightSkyTutorial,
  ] = await Promise.all([
    fetchAsset(releaseUrl("shared/tutorial-data.mjs", root), { type: "javascript", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("shared/realm-ui.css", root), { type: "css", minimumBytes: 2_000 }),
    fetchAsset(releaseUrl("shared/realm-ui.mjs", root), { type: "javascript", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("shared/tutorial-art/star-red.mjs", root), { type: "javascript", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("shared/tutorial-art/abyss-storm.mjs", root), { type: "javascript", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("shared/tutorial-art/night-sky.mjs", root), { type: "javascript", minimumBytes: 5_000 }),
  ]);
  assert(realmCss.text.includes("width: calc(100% - 12px)"), `${name}: narrow tutorial alignment fix is missing.`);
  assert(realmUi.text.includes("TUTORIAL_VERSION = 2"), `${name}: tutorial version was not advanced.`);
  assert(realmUi.text.includes('./realm-ui.css?v=2'), `${name}: tutorial CSS cache bust is missing.`);
  assert(realmUi.text.includes('./tutorial-data.mjs?v=2'), `${name}: tutorial data cache bust is missing.`);
  assert(starRedTutorial.text.includes('data-direction="SE"'), `${name}: legal star-drift diagonal tutorial is missing.`);
  assert(starRedTutorial.text.includes('data-seal-count="7"'), `${name}: seven-seal red-thread goal is missing.`);
  assert(abyssStormTutorial.text.includes('data-response-count="24"'), `${name}: full abyss response signature is missing.`);
  assert(abyssStormTutorial.text.includes('data-powered-count="25"'), `${name}: full storm network goal is missing.`);
  assert(nightSkyTutorial.text.includes('data-action-sequence="remove,drop,shift"'), `${name}: staged night-market collapse is missing.`);
  assert(nightSkyTutorial.text.includes('data-primary-cycle="0,1,2,0"'), `${name}: sky-bridge primary cycle is missing.`);
  assert(nightSkyTutorial.text.includes('data-mark-in-cycle="false"'), `${name}: sky-bridge mark separation is missing.`);
  assert(tutorialData.text.includes('id === "dew-court"'), `${name}: real firefly tutorial level is missing.`);
  assert(tutorialData.text.includes('data-level="${FIREFLY_GOAL_LEVEL.id}"'), `${name}: real firefly completion renderer is missing.`);
  assert(tutorialData.text.includes('data-level="${MIRROR_GOAL_LEVEL.id}"'), `${name}: real mirror completion renderer is missing.`);
  assert(tutorialData.text.includes('data-level="cloud-gate"'), `${name}: real spirit-dragon completion tutorial is missing.`);

  const v1Pages = await Promise.all(V1_GAME_SLUGS.map(async (slug) => {
    const html = await fetchAsset(releaseUrl(`games/${slug}/`, root), { type: "text/html", minimumBytes: 2_000 });
    assert(html.text.includes('../../shared/realm-ui.css?v=2'), `${name}/${slug}: current shared CSS is not wired.`);
    assert(html.text.includes('../../shared/realm-ui.mjs?v=2'), `${name}/${slug}: current shared tutorial module is not wired.`);
    return html;
  }));
  assert(v1Pages.length === 10, `${name}: not all 1.0 game pages were verified.`);

  const [starStyle, memoryGame, memoryLogic, memoryVisuals, fireflyStyle, spiritStyle, mirrorStyle] = await Promise.all([
    fetchAsset(releaseUrl("games/star-drift/styles.css", root), { type: "css", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("games/memory-ark/game.js", root), { type: "javascript", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("games/memory-ark/logic.mjs", root), { type: "javascript", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("games/memory-ark/visuals.mjs", root), { type: "javascript", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("games/firefly-garden/styles.css", root), { type: "css", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("games/spirit-dragon/styles.css", root), { type: "css", minimumBytes: 5_000 }),
    fetchAsset(releaseUrl("games/mirror-theatre/styles.css", root), { type: "css", minimumBytes: 5_000 }),
  ]);
  assert(starStyle.text.includes('.direction-pad [data-dir="NW"] { grid-column: 1; grid-row: 1; }'), `${name}: mobile star-drift compass fix is missing.`);
  assert(memoryGame.text.includes("validateHistoryChain"), `${name}: memory-ark history guard is missing.`);
  assert(memoryGame.text.includes("prepareRollCue"), `${name}: memory-ark roll cue is missing.`);
  assert(memoryGame.text.includes('./logic.mjs?v=20260901a'), `${name}: memory-ark logic cache bust is missing.`);
  assert(memoryGame.text.includes('./visuals.mjs?v=20260901a'), `${name}: memory-ark visual cache bust is missing.`);
  assert(memoryLogic.text.includes("validateHistoryChain"), `${name}: memory-ark history validator module is missing.`);
  assert(memoryVisuals.text.includes("ROLL_VISUALS"), `${name}: memory-ark roll visual module is missing.`);
  assert(fireflyStyle.text.includes('content: "萤"'), `${name}: firefly entity label is missing.`);
  assert(fireflyStyle.text.includes("html {\n  min-width: 0;"), `${name}: firefly phone overflow fix is missing.`);
  assert(spiritStyle.text.includes("html {\n  min-width: 0;"), `${name}: spirit-dragon phone overflow fix is missing.`);
  assert(mirrorStyle.text.includes(".actor-mark--robot::after"), `${name}: mirror actor portraits are missing.`);

  const [guide, registryResponse, v2WorkerResponse, v2PrecacheResponse] = await Promise.all([
    fetchAsset(releaseUrl("./", v2), { type: "text/html", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("games.json", v2), { type: "json", minimumBytes: 500 }),
    fetchAsset(releaseUrl("sw.js", v2), { type: "javascript", minimumBytes: 1_000 }),
    fetchAsset(releaseUrl("precache-manifest.json", v2), { type: "json", minimumBytes: 500 }),
  ]);
  assert(guide.text.includes("十境谜游馆 2.5"), `${name}: 2.5 guide shell is missing.`);

  const registry = JSON.parse(registryResponse.text);
  assert(registry.edition === "2.5", `${name}: registry edition is not 2.5.`);
  assert(registry.status === "ready", `${name}: registry is not ready.`);
  assert(registry.expectedGames === 15, `${name}: expectedGames is not 15.`);
  assert(Array.isArray(registry.games) && registry.games.length === 15, `${name}: registry does not contain 15 games.`);
  assert(JSON.stringify(registry.games.map(({ slug }) => slug)) === JSON.stringify(EXPECTED_SLUGS), `${name}: registry order or slugs changed.`);

  const v2Revision = verifyBuiltServiceWorker(`${name}/v2`, v2WorkerResponse.text, {
    token: "__TEN_REALMS_V2_BUILD_REVISION__",
    cachePrefix: "ten-realms-v2-arcade-",
    forbiddenCachePrefix: "ten-realms-arcade-",
    expectedRevision: EXPECTED_V2_REVISION,
    expectedSource: expectedV2Worker,
  });
  assert(v2WorkerResponse.text.includes("url.pathname.startsWith(scope.pathname)"),
    `${name}/v2: service worker does not restrict requests to its own scope.`);
  assert(!/\bcaches\.match\(/.test(v2WorkerResponse.text),
    `${name}/v2: service worker reads from caches outside its named V2 cache.`);
  const v2Precache = parsePrecacheManifest(`${name}/v2`, v2PrecacheResponse.text);
  assert(JSON.stringify(v2Precache) === JSON.stringify(EXPECTED_V2_PRECACHE),
    `${name}/v2: deployed precache manifest does not exactly match this build.`);
  assert(!v2Precache.some((asset) => asset === "./v2" || asset.startsWith("./v2/")),
    `${name}/v2: precache paths are not relative to the V2 scope.`);
  requireExactGameSlugs(`${name}/v2`, v2Precache, EXPECTED_SLUGS);
  for (const slug of V1_GAME_SLUGS) {
    assert(!v2Precache.some((asset) => asset.startsWith(`./games/${slug}/`)),
      `${name}/v2: precache manifest contains private V1 assets for ${slug}.`);
  }
  const v2RequiredAssets = [
    "./index.html",
    "./styles.css",
    "./app.js",
    "./sw.js",
    "./games.json",
    "./manifest.webmanifest",
    "./shared/tutorial-data.mjs",
    "./shared/realm-ui.css",
    "./shared/realm-ui.mjs",
    "./shared/reward-engine.mjs",
    ...registry.games.flatMap((game) => {
      assert(game.preview === `./assets/previews/${game.slug}.webp`,
        `${name}/${game.slug}: registry preview path is not canonical.`);
      return [
        `./games/${game.slug}/index.html`,
        `./games/${game.slug}/app.mjs`,
        `./games/${game.slug}/styles.css`,
        game.preview,
      ];
    }),
    ...[...NATIVE_TUTORIAL_ASSETS].flatMap(([slug, files]) =>
      files.map((file) => `./games/${slug}/assets/${file}`)),
  ];
  requireManifestAssets(`${name}/v2`, v2Precache, v2RequiredAssets);

  await Promise.all([
    rejectUnexpectedAsset(releaseUrl("games/cloud-camp/__missing-v25-module__.mjs", v2)),
    rejectUnexpectedAsset(releaseUrl(`games/${V1_GAME_SLUGS[0]}/app.mjs`, v2)),
    rejectUnexpectedAsset(releaseUrl(`games/${EXPECTED_SLUGS[0]}/app.mjs`, root)),
  ]);

  const deployedModuleAssets = v2Precache.filter((asset) => /\.(?:m?js)$/.test(asset));
  await eachWithConcurrency(deployedModuleAssets, 8, async (asset) => {
    const [remote, local] = await Promise.all([
      fetchAsset(releaseUrl(asset, v2), { type: "javascript", minimumBytes: 16 }),
      readFile(new URL(asset.slice(2), LOCAL_V2_DIST)),
    ]);
    assertExactBytes(`${name}/v2/${asset.slice(2)}`, remote.bytes, local);
  });

  const sharedTutorial = await fetchAsset(releaseUrl("shared/tutorial-data.mjs", v2), { type: "javascript", minimumBytes: 5_000 });
  const sharedCss = await fetchAsset(releaseUrl("shared/realm-ui.css", v2), { type: "css", minimumBytes: 2_000 });
  const sharedUi = await fetchAsset(releaseUrl("shared/realm-ui.mjs", v2), { type: "javascript", minimumBytes: 5_000 });
  const sharedReward = await fetchAsset(releaseUrl("shared/reward-engine.mjs", v2), { type: "javascript", minimumBytes: 5_000 });
  assert(sharedCss.text.includes("min-height: 44px"), `${name}: 44px tutorial target fix is missing.`);
  assert(sharedCss.text.includes("html:has(.realm-guide-dialog[open])"), `${name}: open tutorial scroll lock is missing.`);
  assert(sharedUi.text.includes("图片教程"), `${name}: shared tutorial control is missing.`);
  assert(sharedUi.text.includes("2.5 十五款共享"), `${name}: V2.5 reward copy is missing.`);
  assert(sharedUi.text.includes("if (!result.accepted)"), `${name}: invalid completion delivery guard is missing.`);
  assert(sharedReward.text.includes("suppliedCompletionId"), `${name}: completionId compatibility ledger is missing.`);
  assert(sharedReward.text.includes('"four-spirit-habitat": 6'), `${name}: attainable six-level mastery targets are missing.`);
  assert((sharedTutorial.text.match(/version:\s*2/g) || []).length === 5, `${name}: not all five shared tutorials are at version 2.`);
  assert(sharedTutorial.text.includes('data-feedback="2-exact-1-misplaced"'), `${name}: authentic perfumery feedback art is missing.`);
  assert(sharedTutorial.text.includes('data-clue-side="bottom"'), `${name}: four-sided skyline goal clues are missing.`);

  await Promise.all(registry.games.map(async (game) => {
    const gameBase = new URL(`games/${game.slug}/`, v2);
    const [html, app, css, preview] = await Promise.all([
      fetchAsset(releaseUrl("./", gameBase), { type: "text/html", minimumBytes: 2_000 }),
      fetchAsset(releaseUrl("app.mjs", gameBase), { type: "javascript", minimumBytes: 2_000 }),
      fetchAsset(releaseUrl("styles.css", gameBase), { type: "css", minimumBytes: 2_000 }),
      fetchAsset(releaseUrl(game.preview.replace(/^\.\//, ""), v2), { type: "image/webp", minimumBytes: 10_000 }),
    ]);
    assert(html.text.includes(`data-realm="${game.slug}"`), `${name}/${game.slug}: data-realm is missing.`);
    assert(html.text.includes("../../shared/realm-ui"), `${name}/${game.slug}: shared UI is not wired.`);
    assert(app.bytes.byteLength > 2_000 && css.bytes.byteLength > 2_000 && preview.bytes.byteLength > 10_000,
      `${name}/${game.slug}: core assets are incomplete.`);
    const previewSize = webpDimensions(preview.bytes);
    assert(previewSize?.width === 1200 && previewSize?.height === 652,
      `${name}/${game.slug}: preview is not the canonical 1200x652 WebP.`);
    if (game.slug === "polar-railway") {
      assert(app.text.includes("tutorialDialog.scrollTop = 0"), `${name}/${game.slug}: tutorial scroll reset fix is missing.`);
    }
    if (game.slug === "yokai-inn") {
      assert(css.text.includes("@media (max-width: 360px)"), `${name}/${game.slug}: 320px overflow fix is missing.`);
    }

    const nativeAssets = NATIVE_TUTORIAL_ASSETS.get(game.slug);
    if (nativeAssets) {
      const tutorialWiring = game.slug === "polar-railway"
        ? await fetchAsset(releaseUrl("ui-helpers.mjs", gameBase), { type: "javascript", minimumBytes: 1_000 })
        : game.slug === "yokai-inn" ? html : app;
      const tutorialRevision = NATIVE_TUTORIAL_REVISIONS.get(game.slug) ?? 2;
      for (const file of nativeAssets) {
        assert(tutorialWiring.text.includes(`./assets/${file}?tutorial=${tutorialRevision}`), `${name}/${game.slug}: ${file} cache revision is missing.`);
      }
      assert(html.text.includes('<script type="module" src="./app.mjs"></script>'), `${name}/${game.slug}: canonical module entry changed.`);
      const tutorialAssets = await Promise.all(nativeAssets.map((file) => fetchAsset(releaseUrl(`assets/${file}`, gameBase), {
        type: "image/svg+xml",
        minimumBytes: 1_000,
      })));
      const goal = tutorialAssets.at(-1).text;
      for (const marker of NATIVE_TUTORIAL_GOAL_MARKERS.get(game.slug) || []) {
        assert(goal.includes(marker), `${name}/${game.slug}: authentic goal marker ${marker} is missing.`);
      }
    } else {
      assert(sharedTutorial.text.includes(`"${game.slug}"`), `${name}/${game.slug}: shared tutorial data is missing.`);
    }
  }));

  return `${name}: v1 fixes + V2.5 guide + 25 games + 15 previews + ${deployedModuleAssets.length} exact modules + tutorial contracts + caches ${rootRevision}/${v2Revision} (${rootPrecache.length}/${v2Precache.length} assets) verified`;
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
