import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "dist");
const excluded = new Set([".git", ".github", "dist", "node_modules", "scripts"]);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of ["index.html", "styles.css", "app.js", "sw.js", "assets", "games", "manifest.webmanifest", ".nojekyll", "LICENSE", "THIRD_PARTY_NOTICES.md"]) {
  await cp(path.join(root, entry), path.join(out, entry), {
    recursive: true,
    filter: (source) => !excluded.has(path.relative(root, source).split(path.sep)[0]),
  });
}

const precache = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else precache.push(`./${path.relative(out, file).split(path.sep).join("/")}`);
  }
}

await collect(out);
precache.sort();

const revisionHash = createHash("sha256");
for (const asset of precache) {
  revisionHash.update(asset);
  revisionHash.update(await readFile(path.join(out, asset.slice(2))));
}
const revision = revisionHash.digest("hex").slice(0, 12);
const serviceWorkerPath = path.join(out, "sw.js");
const serviceWorker = await readFile(serviceWorkerPath, "utf8");
const revisionToken = "__TEN_REALMS_BUILD_REVISION__";

if (!serviceWorker.includes(revisionToken)) {
  throw new Error("Service worker build revision token is missing.");
}

await writeFile(serviceWorkerPath, serviceWorker.replaceAll(revisionToken, revision));
await writeFile(path.join(out, "precache-manifest.json"), `${JSON.stringify(precache)}\n`);

console.log(`Built ${precache.length} static assets into dist/ (cache ${revision}).`);
