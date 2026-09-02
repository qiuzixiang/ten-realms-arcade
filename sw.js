const BUILD_REVISION = "__TEN_REALMS_BUILD_REVISION__";
const CACHE_NAME = `ten-realms-arcade-${
  BUILD_REVISION.startsWith("__") ? "dev-v2" : BUILD_REVISION
}`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

async function installCache() {
  const cache = await caches.open(CACHE_NAME);
  let assets = CORE_ASSETS;

  try {
    const response = await fetch(new URL("./precache-manifest.json", self.registration.scope), {
      cache: "no-store",
    });
    if (response.ok) assets = [...new Set([...CORE_ASSETS, ...(await response.json())])];
  } catch {
    // The generated manifest exists in production builds; local source serving uses the core shell.
  }

  await cache.addAll(assets.map((asset) => new URL(asset, self.registration.scope).href));
}

self.addEventListener("install", (event) => {
  event.waitUntil(installCache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ten-realms-arcade-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Later editions own their own shells, caches and service-worker scopes.
  // Let their requests reach the network (or their scoped workers) without
  // falling back to the 1.0 shell.
  const v2Path = new URL("./v2/", self.registration.scope).pathname;
  const v3Path = new URL("./v3/", self.registration.scope).pathname;
  if (url.pathname === v2Path.slice(0, -1) || url.pathname.startsWith(v2Path)
      || url.pathname === v3Path.slice(0, -1) || url.pathname.startsWith(v3Path)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;

        if (event.request.mode === "navigate" && url.pathname.endsWith("/")) {
          const directoryIndex = await caches.match(new URL("./index.html", url), {
            ignoreSearch: true,
          });
          if (directoryIndex) return directoryIndex;
        }

        if (event.request.mode === "navigate") {
          return caches.match(new URL("./index.html", self.registration.scope).href);
        }
        return Response.error();
      }),
  );
});
