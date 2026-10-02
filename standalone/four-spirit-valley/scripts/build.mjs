import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/xhs");
const zip = resolve(root, "dist/four-spirit-valley-xhs.zip");
await rm(dist, { recursive: true, force: true });
await rm(zip, { force: true });
await mkdir(dist, { recursive: true });
const sourceFiles = ["src/engine.mjs", "src/levels.mjs", "src/app.mjs"];
const pieces = [];
for (const file of sourceFiles) {
  let source = await readFile(resolve(root, file), "utf8");
  source = source.replace(/^import\s+[^\n]+\s+from\s+["'][^"']+["'];\s*$/gm, "");
  source = source.replace(/^export\s+(?=(?:const|function|class)\s)/gm, "");
  pieces.push("\n/* " + file + " */\n" + source);
}
await writeFile(resolve(dist, "app.js"), pieces.join("\n"));
await cp(resolve(root, "index.html"), resolve(dist, "index.html"));
await cp(resolve(root, "styles.css"), resolve(dist, "styles.css"));
await cp(resolve(root, "assets"), resolve(dist, "assets"), { recursive: true });
const licenseText = await readFile(resolve(root, "src/license.txt"), "utf8");
await writeFile(resolve(dist, "LICENSES.json"), JSON.stringify({ attribution: licenseText }, null, 2) + "\n");
execFileSync("zip", ["-X", "-q", "-r", zip, "."], { cwd: dist });
console.log("Built dist/xhs and dist/four-spirit-valley-xhs.zip.");
