import { readFile, writeFile, mkdir, rm, copyFile, utimes } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist', 'xhs');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const names = ['levels.mjs', 'engine.mjs', 'profile.mjs', 'storage.mjs', 'app.mjs'];
const parts = [];
for (const name of names) {
  let source = await readFile(path.join(root, 'src', name), 'utf8');
  source = source.replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  if (/^\s*(import|export)\s/m.test(source)) throw new Error('Module token left in ' + name);
  parts.push('// ' + name + '\n' + source);
}
await writeFile(path.join(output, 'app.js'), '(function(){\n"use strict";\n' + parts.join('\n') + '\n})();\n');
await copyFile(path.join(root, 'src', 'index.html'), path.join(output, 'index.html'));
await copyFile(path.join(root, 'src', 'styles.css'), path.join(output, 'styles.css'));
// ZIP stores DOS timestamps. Fix them so rebuilding the same sources produces
// the same archive bytes regardless of when the package is made.
const archiveTime = new Date('2020-01-01T00:00:00Z');
for (const name of ['index.html', 'app.js', 'styles.css']) {
  await utimes(path.join(output, name), archiveTime, archiveTime);
}
const zipPath = path.join(root, 'dist', 'yokai-pairing-house-xhs.zip');
await rm(zipPath, { force: true });
const archive = spawnSync('zip', ['-X', '-q', zipPath, 'index.html', 'app.js', 'styles.css'], { cwd: output, encoding: 'utf8' });
if (archive.status !== 0) throw new Error(archive.stderr || 'zip failed');
process.stdout.write('Built ' + zipPath + '\n');
