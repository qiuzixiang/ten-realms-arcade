import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'dist', 'xhs');
await mkdir(output, { recursive: true });
const files = ['engine.mjs', 'levels.mjs', 'proof.mjs', 'store.mjs', 'platform-storage.mjs', 'app.mjs'];
let bundle = '/* Amber Strata Survey · offline classic script · generated from local modules */\n(function(){\n\'use strict\';\n';
for (const file of files) {
  const source = await readFile(path.join(root, file), 'utf8');
  const imports = source.match(/^import .*;$/gm) || [];
  if (file !== 'levels.mjs' && file !== 'engine.mjs' && !imports.length) throw new Error(`${file}: expected imports`);
  const transformed = source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  if (/^\s*(import|export)\b/m.test(transformed)) throw new Error(`${file}: module syntax remained`);
  bundle += `\n/* ${file} */\n${transformed}\n`;
}
bundle += '\n})();\n';
if (/\?\.|\?\?|\bflatMap\s*\(|\bglobalThis\b|\bqueueMicrotask\b|\breplaceChildren\b|\bimport\s*\(|\bfetch\s*\(/.test(bundle))
  throw new Error('A post-ES2017 API or syntax feature remained in the bundle');
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace('<script type="module" src="./app.mjs"></script>', '<script src="./app.js" defer></script>');
if (html.includes('type="module"')) throw new Error('Module script remains in HTML');
const css = await readFile(path.join(root, 'styles.css'), 'utf8');
await Promise.all([
  writeFile(path.join(output, 'index.html'), html),
  writeFile(path.join(output, 'app.js'), bundle),
  writeFile(path.join(output, 'styles.css'), css),
]);
execFileSync(process.execPath, ['--check', path.join(output, 'app.js')]);
const zipFile = path.join(root, 'dist', 'amber-strata-survey-xhs.zip');
await rm(zipFile, { force: true });
execFileSync('zip', ['-q', '-X', '-j', zipFile, 'index.html', 'app.js', 'styles.css'], { cwd: output });
console.log(`Offline candidate: ${zipFile}`);
