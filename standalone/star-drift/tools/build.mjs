/** Pure static packaging. Both accepted destinations are generated build output. */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const standaloneOutput = path.join(sourceRoot, 'dist');
const collectionOutput = path.resolve(sourceRoot, '../../dist/standalone/star-drift');
export const RUNTIME_FILES = Object.freeze([
  'index.html', 'styles.css', 'app.mjs', 'core.mjs', 'levels.mjs', 'generate.mjs',
  'renderer.mjs', 'storage.mjs', 'worker.mjs',
]);
const documentation = ['README.md', 'RULES.md', 'THIRD_PARTY_NOTICES.md', 'ART.md'];

export async function buildStandalone({ outDir = standaloneOutput } = {}) {
  const destination = path.resolve(outDir);
  // Deliberately refuse arbitrary deletion targets: only these two directories
  // are build products owned by this build script and the root build script.
  if (![standaloneOutput, collectionOutput].includes(destination)) {
    throw new RangeError('Star Drift builds may only replace their documented generated dist directories.');
  }
  // Check every required source before replacing an existing build.
  for (const entry of [...RUNTIME_FILES, ...documentation]) await readFile(path.join(sourceRoot, entry));
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const entry of [...RUNTIME_FILES, ...documentation, 'assets']) {
    await cp(path.join(sourceRoot, entry), path.join(destination, entry), { recursive: true });
  }
  await writeFile(path.join(destination, 'build-info.json'), `${JSON.stringify({
    game: 'star-drift-standalone', version: 1, runtimeFiles: RUNTIME_FILES,
    runtimeDependencies: [], generatedDirectory: true,
  }, null, 2)}\n`);
  return { destination, runtimeFiles: [...RUNTIME_FILES] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { destination } = await buildStandalone();
  console.log(`Built independent Star Drift browser game into ${destination}`);
}
