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

const NATIVE_TUTORIAL_ASSETS = new Map([
  ["polar-railway", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
  ["season-dyehouse", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
  ["yokai-inn", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
  ["aurora-magnet-lab", ["tutorial-elements.svg", "tutorial-operation.svg", "tutorial-goal.svg"]],
  ["dream-hotel", ["tutorial-elements.svg", "tutorial-action.svg", "tutorial-goal.svg"]],
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
  assert(sharedUi.text.includes("图片教程"), `${name}: shared tutorial control is missing.`);

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
      await Promise.all(nativeAssets.map((file) => fetchAsset(releaseUrl(`assets/${file}`, gameBase), {
        type: "image/svg+xml",
        minimumBytes: 1_000,
      })));
    } else {
      assert(sharedTutorial.text.includes(`"${game.slug}"`), `${name}/${game.slug}: shared tutorial data is missing.`);
    }
  }));

  return `${name}: guide + 10 games + 10 previews + 30 tutorial cards verified`;
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
