import { V4_PROGRESS_KEY, readStoredJson } from "./shared/storage.mjs";

const grid = document.querySelector("[data-game-grid]");
const emptyState = document.querySelector("[data-empty-state]");
const registryState = document.querySelector("[data-registry-state]");
const count = document.querySelector("[data-game-count]");
const target = document.querySelector("[data-game-target]");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildCard(game, index) {
  const card = element("a", "game-card");
  card.href = `./games/${game.slug}/`;
  card.setAttribute("aria-label", `进入${game.title}`);
  card.style.setProperty("--accent", game.accent || "#70f0d0");
  card.style.setProperty("--order", String(index));

  const preview = element("figure", "card-preview");
  const image = element("img");
  image.src = game.preview;
  image.alt = "";
  image.loading = index < 2 ? "eager" : "lazy";
  image.decoding = "async";
  const label = element("figcaption");
  label.append(element("span", "", "REALM"), element("b", "", String(index + 1).padStart(2, "0")));
  preview.append(image, label);

  const body = element("div", "card-body");
  const genre = element("p", "card-genre");
  genre.append(element("span", "", game.genre), document.createTextNode(` ${game.mechanic}`));
  body.append(genre, element("h3", "", game.title), element("p", "card-summary", game.summary));
  const enter = element("span", "enter");
  enter.append(element("span", "", "进入游戏"), element("b", "", "↗"));
  body.append(enter);
  card.append(preview, body);
  return card;
}

function validateRegistry(registry) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    throw new TypeError("registry must be an object");
  }
  if (registry.schemaVersion !== 1 || registry.edition !== "4.0" || registry.status !== "ready") {
    throw new TypeError("registry release metadata is inconsistent");
  }
  if (!Array.isArray(registry.games)) throw new TypeError("registry games must be an array");
  if (!Number.isSafeInteger(registry.expectedGames) || registry.expectedGames < 1
      || registry.expectedGames !== registry.games.length) {
    throw new RangeError("registry expectedGames must match the game list");
  }
  const slugs = new Set();
  for (const game of registry.games) {
    if (!game || typeof game !== "object" || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(game.slug ?? "")
        || typeof game.title !== "string" || typeof game.preview !== "string") {
      throw new TypeError("registry contains an invalid game entry");
    }
    if (slugs.has(game.slug)) throw new TypeError("registry contains a duplicate game slug");
    slugs.add(game.slug);
  }
  return registry;
}

async function loadRegistry() {
  const response = await fetch("./games.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`registry ${response.status}`);
  const registry = validateRegistry(await response.json());
  target.textContent = String(registry.expectedGames);
  count.textContent = String(registry.games.length);
  grid.replaceChildren(...registry.games.map(buildCard));
  emptyState.hidden = registry.games.length !== 0;
  registryState.textContent = registry.games.length
    ? `${registry.games.length} 款游戏已开放`
    : "世界门接入中";
}

document.querySelector("#year").textContent = String(new Date().getFullYear());
const storedProgress = readStoredJson(V4_PROGRESS_KEY, null);
document.documentElement.dataset.hasProgress = storedProgress ? "true" : "false";

loadRegistry().catch(() => {
  emptyState.hidden = false;
  registryState.textContent = "清单暂时无法读取，请刷新重试";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      // Offline support is progressive enhancement.
    });
  });
}
