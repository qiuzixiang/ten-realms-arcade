const BUILD_REVISION = "__TEN_REALMS_V4_BUILD_REVISION__";
const CACHE_NAME = `ten-realms-v4-arcade-${
  BUILD_REVISION.startsWith("__") ? "dev" : BUILD_REVISION
}`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./games.json",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/icon.svg",
];

async function installCache() {
  const cache = await caches.open(CACHE_NAME);
  let assets = CORE_ASSETS;
  try {
    const response = await fetch(new URL("./precache-manifest.json", self.registration.scope), { cache: "no-store" });
    if (response.ok) assets = [...new Set([...CORE_ASSETS, ...(await response.json())])];
  } catch {
    // Source-mode development has no generated manifest; cache the shell only.
  }
  await cache.addAll(assets.map((asset) => new URL(asset, self.registration.scope).href));
}

self.addEventListener("install", (event) => {
  event.waitUntil(installCache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("ten-realms-v4-arcade-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const relativePath = url.pathname.slice(scope.pathname.length);
          const isGameDirectory = /^games\/[a-z0-9][a-z0-9-]{1,39}\/?$/.test(relativePath);
          if (url.pathname.endsWith("/") || isGameDirectory) {
            const directoryPath = relativePath.replace(/\/?$/, "/");
            const directoryIndex = await cache.match(new URL(`${directoryPath}index.html`, scope), { ignoreSearch: true });
            if (directoryIndex) return directoryIndex;
          }
        }
        if (event.request.mode === "navigate") return cache.match(new URL("./index.html", self.registration.scope).href);
        return Response.error();
      }),
  );
});
