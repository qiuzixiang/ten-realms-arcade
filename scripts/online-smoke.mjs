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
]);

const NATIVE_TUTORIAL_GOAL_MARKERS = new Map([
  ["aurora-magnet-lab", ['data-level-id="ice-window"', 'data-state="solved"', 'data-solution="NNNNRNFF"']],
  ["polar-railway", ['data-level-id="whiteout-5a"', 'data-state="solved"', 'data-route="0,0;0,1;1,1']],
  ["dream-hotel", ['data-level-id="lullaby-lobby"', 'data-state="solved"', 'data-board-size="5x5"']],
  ["season-dyehouse", ['data-preset-id="12x12-easy"', 'data-controlled="144"', 'data-moves="20"']],
  ["yokai-inn", ['data-puzzle-id="yokai-inn:g1:o3:u:do80yl:a10"', 'data-tutorial-state="goal"', 'data-board-size="5x4"']],
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
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const contentType = response.headers.get("content-type") || "";
  if (type && !contentType.toLowerCase().includes(type)) {
    throw new Error(`Unexpected content type ${JSON.stringify(contentType)} for ${url}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < minimumBytes) throw new Error(`Short response (${bytes.byteLength} bytes) for ${url}`);
  return { bytes, text: new TextDecoder().decode(bytes) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyHost(name, root) {
  const v2 = new URL("v2/", root);
  const rootPage = await fetchAsset(releaseUrl("./", root), { type: "text/html", minimumBytes: 1_000 });
  assert(rootPage.text.includes("十境谜游馆"), `${name}: 1.0 root shell is missing.`);

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

  const guide = await fetchAsset(releaseUrl("./", v2), { type: "text/html", minimumBytes: 1_000 });
  assert(guide.text.includes("十境谜游馆 2.0"), `${name}: 2.0 guide shell is missing.`);

  const registryResponse = await fetchAsset(releaseUrl("games.json", v2), { type: "json", minimumBytes: 500 });
  const registry = JSON.parse(registryResponse.text);
  assert(registry.status === "ready", `${name}: registry is not ready.`);
  assert(registry.expectedGames === 10, `${name}: expectedGames is not 10.`);
  assert(Array.isArray(registry.games) && registry.games.length === 10, `${name}: registry does not contain 10 games.`);
  assert(JSON.stringify(registry.games.map(({ slug }) => slug)) === JSON.stringify(EXPECTED_SLUGS), `${name}: registry order or slugs changed.`);

  const sharedTutorial = await fetchAsset(releaseUrl("shared/tutorial-data.mjs", v2), { type: "javascript", minimumBytes: 5_000 });
  const sharedCss = await fetchAsset(releaseUrl("shared/realm-ui.css", v2), { type: "css", minimumBytes: 2_000 });
  const sharedUi = await fetchAsset(releaseUrl("shared/realm-ui.mjs", v2), { type: "javascript", minimumBytes: 5_000 });
  assert(sharedCss.text.includes("min-height: 44px"), `${name}: 44px tutorial target fix is missing.`);
  assert(sharedCss.text.includes("html:has(.realm-guide-dialog[open])"), `${name}: open tutorial scroll lock is missing.`);
  assert(sharedUi.text.includes("图片教程"), `${name}: shared tutorial control is missing.`);
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
        : app;
      for (const file of nativeAssets) {
        assert(tutorialWiring.text.includes(`./assets/${file}?tutorial=2`), `${name}/${game.slug}: ${file} cache revision is missing.`);
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

  return `${name}: v1 fixes + v2 guide + 20 games + 10 previews + tutorial contracts verified`;
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
