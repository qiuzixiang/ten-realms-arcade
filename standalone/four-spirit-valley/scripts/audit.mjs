import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve, relative, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/xhs");
const zip = resolve(root, "dist/four-spirit-valley-xhs.zip");
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesIn(absolute)); else result.push(absolute);
  }
  return result;
}
const files = await filesIn(dist);
if (!files.some((file) => relative(dist, file) === "index.html")) throw new Error("index.html is not at the ZIP root.");
const allowed = new Set([".html", ".js", ".css", ".svg", ".json", ".txt"]);
for (const file of files) if (!allowed.has(extname(file).toLowerCase())) throw new Error("Unexpected package file: " + relative(dist, file));
const html = await readFile(resolve(dist, "index.html"), "utf8");
if (/<script[^>]+type=["']module/i.test(html)) throw new Error("Module scripts are not allowed in the classic package.");
if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(html)) throw new Error("Inline JavaScript is not allowed.");
if (/\son[a-z]+\s*=/i.test(html)) throw new Error("Inline event attributes are not allowed.");
if (/<(?:iframe|object|embed|base)\b/i.test(html)) throw new Error("Embedded content is not allowed.");
const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
for (const ref of refs) {
  if (/^(?:https?:|data:|#|mailto:)/i.test(ref)) continue;
  const target = resolve(dist, ref.split(/[?#]/)[0]);
  if (!target.startsWith(dist + "/") && target !== resolve(dist, "index.html")) throw new Error("Path escapes package: " + ref);
  await stat(target);
}
const app = await readFile(resolve(dist, "app.js"), "utf8");
if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b|\bimport\s*\(/.test(app)) throw new Error("Network or dynamic module access found in app.js.");
if (/\b(?:eval|Function)\s*\(/.test(app)) throw new Error("Dynamic code execution is not allowed.");
if (/\b(?:serviceWorker|Worker)\b/.test(app)) throw new Error("Worker or service worker references are not allowed.");
if (/<meta[^>]+http-equiv=["']Content-Security-Policy/i.test(html)) throw new Error("Do not ship a custom CSP meta tag.");
if (/#(?:[0-9a-f]{8})\b|\b(?:clamp|min|max)\([^)]*\)|aspect-ratio/i.test(await readFile(resolve(dist, "styles.css"), "utf8"))) throw new Error("CSS uses syntax outside the Chrome 61 fallback baseline.");
execFileSync("node", ["--check", resolve(dist, "app.js")], { stdio: "inherit" });
const zipList = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n");
if (!zipList.includes("index.html") || zipList.some((name) => name.startsWith("xhs/"))) throw new Error("ZIP root structure is invalid.");
execFileSync("unzip", ["-t", zip], { stdio: "inherit" });
const bytes = (await stat(zip)).size;
if (bytes > 10 * 1024 * 1024) throw new Error("ZIP exceeds the historical 10 MiB ceiling.");
console.log(JSON.stringify({ packageFiles: files.map((file) => relative(dist, file)), zipBytes: bytes, crc: "passed", externalRequests: "none in production app", rootEntry: "index.html", status: "PASS" }, null, 2));
