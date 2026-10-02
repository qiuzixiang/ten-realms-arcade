import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const base = process.env.PAGES_BASE_URL;
if (!base) throw new Error('PAGES_BASE_URL is required');
const root = path.resolve('dist/standalone');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function verify(directory = root) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await verify(file); continue; }
    const relative = path.relative(root, file).split(path.sep).join('/');
    const url = new URL(`standalone/${relative}`, base.endsWith('/') ? base : `${base}/`);
    url.searchParams.set('release', digest(await readFile(file)).slice(0, 12));
    const response = await fetch(url);
    if (!response.ok || digest(Buffer.from(await response.arrayBuffer())) !== digest(await readFile(file))) {
      throw new Error(`Published file differs from build: ${relative} (${response.status})`);
    }
  }
}
await verify();
console.log('All standalone games: all deployed files and ZIP downloads match the build.');
