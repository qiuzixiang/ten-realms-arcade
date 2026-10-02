import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const collectionOutput = path.resolve(root, '../../dist/standalone/color-linez');
export const RUNTIME_FILES = ['index.html', 'styles.css', 'core.mjs', 'storage.mjs', 'renderer.mjs', 'app.mjs', 'assets/icon.svg'];
const modules = ['core.mjs', 'storage.mjs', 'renderer.mjs', 'app.mjs'];

function zipFiles(files) {
  const locals = [], directories = []; let offset = 0;
  for (const [name, content] of Object.entries(files)) {
  const filename = Buffer.from(name), input = Buffer.from(content), compressed = deflateRawSync(input);
  let crc = 0xffffffff;
  for (const b of input) { crc ^= b; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(input.length, 22); local.writeUInt16LE(filename.length, 26);
  const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(8, 10); directory.writeUInt16LE(0x21, 14); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(input.length, 24); directory.writeUInt16LE(filename.length, 28);
  directory.writeUInt32LE(offset, 42);
  const localEntry = Buffer.concat([local, filename, compressed]);
  locals.push(localEntry); directories.push(directory, filename); offset += localEntry.length;
  }
  const central = Buffer.concat(directories), count = Object.keys(files).length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

export async function buildStandalone({ outDir = output } = {}) {
  const destination = path.resolve(outDir);
  if (![output, collectionOutput].includes(destination)) throw new Error('Build output must be a documented generated directory.');
  const source = Object.fromEntries(await Promise.all(RUNTIME_FILES.map(async (file) => [file, await readFile(path.join(root, file), 'utf8')])));
  const notices = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  const script = modules.map((file) => `// ${file}\n${source[file].replace(/^import .*?;\s*$/gm, '').replace(/^export (?=(?:const|function|class)\b)/gm, '')}`).join('\n');
  if (/^import\s/m.test(script) || /<\/script/i.test(script)) throw new Error('The self-contained script is unsafe or has unresolved imports.');
  const classicScript = `(function () {\n'use strict';\n${script}\n})();\n`;
  const styled = source['index.html']
    .replace('<link rel="stylesheet" href="./styles.css">', `<style>\n${source['styles.css']}\n</style>`)
    .replace('href="./assets/icon.svg"', `href="data:image/svg+xml;base64,${Buffer.from(source['assets/icon.svg']).toString('base64')}"`);
  const single = styled.replace('<script type="module" src="./app.mjs"></script>', `<script>\n${classicScript}\n</script>`);
  // The Xiaohongshu container forbids inline and module scripts.
  const xhsFiles = { 'index.html': styled.replace('<script type="module" src="./app.mjs"></script>', '<script src="./app.js"></script>'), 'app.js': classicScript };
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.join(destination, 'web/assets'), { recursive: true });
  await mkdir(path.join(destination, 'xhs'), { recursive: true });
  for (const file of RUNTIME_FILES) await cp(path.join(root, file), path.join(destination, 'web', file));
  // index.html is the standalone platform entry, with no CDN or external assets.
  await writeFile(path.join(destination, 'index.html'), single);
  for (const [file, content] of Object.entries(xhsFiles)) await writeFile(path.join(destination, 'xhs', file), content);
  await writeFile(path.join(destination, 'glass-linez-xhs.zip'), zipFiles(xhsFiles));
  await cp(path.join(root, 'assets/icon.png'), path.join(destination, 'icon.png'));
  await writeFile(path.join(destination, 'THIRD_PARTY_NOTICES.md'), notices);
  await writeFile(path.join(destination, 'build-info.json'), JSON.stringify({ game: 'glass-linez', version: '1.0.0', rules: 'Color Linez 1.21', entry: 'index.html', bytes: Buffer.byteLength(single), xhs: { spec: 'minitool-zip-builder 1.6.0', scriptTarget: 'ES2017 / Chrome 61', files: Object.keys(xhsFiles) }, externalRuntimeDependencies: [], runtimeFiles: RUNTIME_FILES }, null, 2) + '\n');
  return { destination, bytes: Buffer.byteLength(single) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await buildStandalone());
