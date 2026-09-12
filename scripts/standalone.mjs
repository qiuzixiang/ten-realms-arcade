import { readFile, cp, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = process.cwd();
const games = JSON.parse(await readFile(path.join(root, 'standalone/games.json'), 'utf8'));
export async function buildStandalone() {
  const target = path.join(root, 'dist/standalone');
  await mkdir(path.join(target, 'downloads'), { recursive: true });
  await cp(path.join(root, 'standalone/index.html'), path.join(target, 'index.html'));
  for (const { slug } of games) {
    const cwd = path.join(root, 'standalone', slug);
    execFileSync('npm', ['run', 'build'], { cwd, stdio: 'inherit' });
    await cp(path.join(cwd, 'dist/xhs'), path.join(target, slug), { recursive: true });
    await cp(path.join(cwd, `dist/${slug}-xhs.zip`), path.join(target, `downloads/${slug}-xhs.zip`));
  }
}
if (process.argv[2] === 'test') {
  for (const { slug } of games) {
    const cwd = path.join(root, 'standalone', slug);
    // Bundle regression tests read dist/xhs, so prepare it on clean checkouts.
    execFileSync('npm', ['run', 'build'], { cwd, stdio: 'inherit' });
    execFileSync('npm', ['test'], { cwd, stdio: 'inherit' });
  }
}
