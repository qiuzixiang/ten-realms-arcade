import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { Script } from 'node:vm';
import { buildStandalone, RUNTIME_FILES } from '../tools/build.mjs';
import { tutorialStates } from '../core.mjs';
import { tutorialSvg, defsMarkup } from '../renderer.mjs';
const output = await buildStandalone();
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
test('single HTML has parseable bundled JavaScript, embedded styles, and no external runtime requests', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Script(script));
  assert.doesNotMatch(script, /^\s*(?:import|export)\s/m);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel="stylesheet"|https:\/\/cdn\./);
  assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.match(html, /Color Linez v1\.21/);
  assert.ok(output.bytes < 150000);
});
test('ZIP contains a root entry and external classic script compatible with platform CSP', async () => {
  const zip = await readFile(new URL('../dist/glass-linez-xhs.zip', import.meta.url));
  let offset = 0; const entries = {};
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const length = zip.readUInt16LE(offset + 26), size = zip.readUInt32LE(offset + 18);
    const name = zip.subarray(offset + 30, offset + 30 + length).toString(), start = offset + 30 + length;
    entries[name] = inflateRawSync(zip.subarray(start, start + size)).toString();
    assert.equal(entries[name], await readFile(new URL('../dist/xhs/' + name, import.meta.url), 'utf8'));
    offset = start + size;
  }
  assert.deepEqual(Object.keys(entries), ['index.html', 'app.js']);
  assert.equal(zip.readUInt16LE(zip.length - 12), 2);
  assert.match(entries['index.html'], /<script src="\.\/app\.js"><\/script>/);
  assert.doesNotMatch(entries['index.html'], /type="module"|<script>|\bon\w+=|<iframe|<object|http-equiv="Content-Security-Policy"/i);
  assert.doesNotThrow(() => new Script(entries['app.js']));
  assert.doesNotMatch(entries['app.js'], /\?\.|\?\?|\|\|=|\.at\(|\.flat(?:Map)?\(|Object\.fromEntries|replaceChildren|globalThis|\{\s*\.\.\./);
  assert.doesNotMatch(entries['app.js'], /\b(?:fetch|eval)\(|new (?:Function|Worker|WebSocket)\(|navigator\.(?:clipboard|serviceWorker)/);
  assert.equal(html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1], entries['app.js']);
});
test('web output contains all local modules and original executable is never shipped', async () => {
  for (const file of RUNTIME_FILES) assert.ok((await readFile(new URL('../dist/web/' + file, import.meta.url))).length > 0);
  const contents = await readdir(new URL('../dist/', import.meta.url));
  assert.ok(!contents.some((f) => /\.exe$|\.dll$|reference-fixtures|tests|tools/i.test(f)));
});
test('builder refuses source or arbitrary deletion targets', async () => {
  await assert.rejects(buildStandalone({outDir:new URL('../',import.meta.url).pathname}), /documented/);
  await assert.rejects(buildStandalone({outDir:'/tmp/unrelated'}), /documented/);
});
test('tutorial images use actual engine states with isolated SVG definitions and exact bead counts', () => {
  const lesson = tutorialStates();
  for (const [i, state] of [lesson.before, lesson.before, lesson.after].entries()) {
    const svg = tutorialSvg(state, { prefix: 'qa-' + i, path: i === 1 ? lesson.path : [] });
    assert.equal([...svg.matchAll(/<use href=/g)].length, state.board.filter(Boolean).length);
    assert.match(svg, new RegExp(`data-score="${state.score}"`));
    assert.doesNotMatch(svg, /NaN|undefined/);
  }
  const combined = defsMarkup() + tutorialSvg(lesson.before, {prefix:'unique'});
  const ids = [...combined.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
});
