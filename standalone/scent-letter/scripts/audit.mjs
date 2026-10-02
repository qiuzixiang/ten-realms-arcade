import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parse } from "acorn";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = "dist/xhs";
const js = fs.readFileSync(dir + "/app.js", "utf8");
parse(js, { ecmaVersion: 2017, sourceType: "script" });
for (const re of [/\beval\s*\(/, /new Function\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /new Worker/, /serviceWorker/, /localStorage\.clear/, /https?:\/\//]) assert.ok(!re.test(js), "Forbidden JS " + re);
const html = fs.readFileSync(dir + "/index.html", "utf8");
assert.ok(!/type=["']module|\son\w+=|<iframe|<object|http-equiv/i.test(html));
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(fs.existsSync(dir + "/" + m[1]));
const zip = fs.readFileSync("dist/scent-letter-xhs.zip");
assert.ok(zip.length <= 2 * 1024 * 1024);
const crc = execFileSync("python3", ["-c", `import zipfile,xml.etree.ElementTree as E
with zipfile.ZipFile('dist/scent-letter-xhs.zip') as z:
 assert z.testzip() is None
 assert z.namelist().count('index.html')==1
 assert all(p.rsplit('.',1)[-1] in ['html','css','js','svg','json','png','jpg','jpeg','webp','gif','woff','woff2'] for p in z.namelist())
 assert all(not p.startswith('/') and '..' not in p.split('/') for p in z.namelist())
 for p in z.namelist():
  if p.endswith('.svg'): E.fromstring(z.read(p))
 print('ZIP CRC, paths, tutorial XML passed')`], { encoding: "utf8" });
const report = { bytes: zip.length, sha256: crypto.createHash("sha256").update(zip).digest("hex"), es2017: true, offlineStaticAudit: true, crc: crc.trim() };
fs.writeFileSync("release/audit.json", JSON.stringify(report, null, 2));
console.log(report);
