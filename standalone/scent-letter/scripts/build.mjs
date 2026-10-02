import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { tutorialSVG } from "../src/view.mjs";
import { secretFor } from "../src/engine.mjs";
import { tutorialLevel, tutorialStates } from "../src/tutorial.mjs";
const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
const dir = "dist/xhs";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(dir + "/assets", { recursive: true });
const runs = tutorialStates(), secret = secretFor(tutorialLevel), guess = runs[1].history[0].pegs;
const states = runs.map((r) => ({ pegs: r.history.length ? r.history[r.history.length - 1].pegs : r.draft, f: r.history.length ? r.history[r.history.length - 1].feedback : null }));
for (let i = 0; i < 3; i++) fs.writeFileSync(`assets/tutorial-${i + 1}.svg`, tutorialSVG(states[i].pegs, states[i].f, i));
fs.writeFileSync("assets/tutorial-truth.json", JSON.stringify({ id: tutorialLevel.id, seed: tutorialLevel.seed, secret, guess, states }, null, 2));
await build({ entryPoints: ["src/app.mjs"], bundle: true, format: "iife", target: ["es2017", "chrome61"], outfile: dir + "/app.js", minify: true, legalComments: "none" });
fs.copyFileSync("index.html", dir + "/index.html");
fs.copyFileSync("src/styles.css", dir + "/styles.css");
fs.cpSync("assets", dir + "/assets", { recursive: true });
fs.writeFileSync(dir + "/license.json", JSON.stringify({ license: fs.readFileSync("LICENSE", "utf8"), notices: fs.readFileSync("THIRD_PARTY.md", "utf8") }));
execFileSync("python3", ["-c", `import zipfile,pathlib
root=pathlib.Path('dist/xhs')
with zipfile.ZipFile('dist/scent-letter-xhs.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():
   info=zipfile.ZipInfo(str(p.relative_to(root)),(2026,9,14,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())`]);
console.log("Built classic offline bundle and dist/scent-letter-xhs.zip");
