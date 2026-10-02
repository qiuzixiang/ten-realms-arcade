import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../dist/xhs");
const server = http.createServer((req, res) => {
  let file;
  try {
    file = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]));
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader("Content-Type", file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : "application/json");
  res.end(fs.readFileSync(file));
});
server.listen(Number(process.env.SCENT_PORT || 4189), "127.0.0.1", () => console.log("香笺秘方 preview: http://127.0.0.1:" + server.address().port));
