import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {} });
for (const file of ['engine.js', 'levels.js', 'art.js']) vm.runInContext(fs.readFileSync(path.join(base, 'src', file), 'utf8'), context);
const { CraneEngine: engine, CraneLevels: catalogue, CraneArt: art } = context.window;

// Parse our intentionally small, unnamespaced SVG/XML subset, rather than
// treating a marker regex as proof that the file is a valid nested image.
function parseXml(source) {
  const nodes = [], stack = [], tokens = source.match(/<(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+/g) || [];
  assert.equal(tokens.join(''), source, 'XML must tokenize without dropped content');
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      if (stack.length) stack[stack.length - 1].text += token;
      else assert.equal(token.trim(), '', 'Text outside root');
      continue;
    }
    if (token.startsWith('</')) {
      assert.ok(stack.length, 'Unexpected closing tag');
      assert.equal(token, `</${stack.pop().tag}>`, 'Mismatched closing tag');
      continue;
    }
    const match = token.match(/^<([a-zA-Z][\w:-]*)([\s\S]*?)\/?\s*>$/);
    assert.ok(match, `Unsupported XML tag ${token}`);
    const node = { tag: match[1], attrs: {}, children: [], text: '' };
    let residue = match[2];
    residue = residue.replace(/\s+([\w:-]+)="([^"]*)"/g, (_, name, value) => {
      assert.ok(!(name in node.attrs), `Duplicate attribute ${name}`);
      node.attrs[name] = value.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
      return '';
    });
    assert.equal(residue.trim(), '', 'Malformed XML attribute');
    if (stack.length) stack[stack.length - 1].children.push(node);
    else nodes.push(node);
    if (!/\/\s*>$/.test(token)) stack.push(node);
  }
  assert.equal(stack.length, 0, 'Every XML tag is closed');
  assert.equal(nodes.length, 1, 'Exactly one root');
  assert.equal(nodes[0].tag, 'svg');
  assert.equal(nodes[0].attrs.xmlns, 'http://www.w3.org/2000/svg');
  return nodes[0];
}

function flatten(root) { return [root].concat(root.children.flatMap(flatten)); }

test('real tutorial images match engine initial, first jump, and full solution', () => {
  const level = catalogue.levels[0];
  assert.equal(level.id, 'crane-001', 'Tutorial level remains stable');
  const initial = engine.create(level);
  const first = engine.apply(initial, level.solution[0]);
  const complete = engine.replay(level, level.solution);
  assert.notEqual(first, initial);
  assert.equal(engine.count(initial), 4);
  assert.equal(engine.count(first), 3);
  assert.equal(engine.won(initial), false);
  assert.equal(engine.won(first), false);
  assert.equal(engine.won(complete), true);
  const states = [initial, first, complete];
  const stages = ['initial', 'first-move', 'complete'];
  states.forEach((state, i) => {
    const source = fs.readFileSync(path.join(base, 'assets', `tutorial-${i + 1}.svg`), 'utf8');
    const root = parseXml(source);
    assert.equal(root.attrs['data-level'], level.id);
    assert.equal(root.attrs['data-level-id'], level.id);
    assert.equal(root.attrs['data-seed'], String(level.seed));
    assert.equal(root.attrs['data-state'], stages[i]);
    assert.equal(Number(root.attrs['data-count']), engine.count(state));
    assert.equal(Number(root.attrs['data-moves']), state.moves);
    assert.equal(root.attrs['data-won'], String(engine.won(state)));
    assert.equal(root.attrs.viewBox, '0 0 640 440');
    assert.equal(Number(root.attrs.width) / Number(root.attrs.height), 640 / 440);
    const all = flatten(root);
    const groups = all.filter(node => 'data-cell' in node.attrs);
    assert.equal(groups.length, state.cells.filter(cell => cell !== '#').length);
    assert.equal(new Set(groups.map(node => node.attrs['data-cell'])).size, groups.length);
    const cranes = all.filter(node => 'data-crane' in node.attrs);
    assert.equal(cranes.length, engine.count(state));
    const indices = cranes.map(node => Number(node.attrs['data-crane'])).sort((a, b) => a - b);
    const expected = Array.from(state.cells).map((cell, index) => cell === 'P' ? index : -1).filter(index => index >= 0);
    assert.deepEqual(indices, expected, 'Visible cranes occupy the engine cells');
    groups.forEach(group => {
      const index = Number(group.attrs['data-cell']);
      assert.equal(group.attrs['data-value'], state.cells[index]);
      const lotus = group.children.find(node => node.attrs['data-lotus'] === String(index));
      assert.ok(lotus, 'Every real cell has a visible lotus');
      assert.ok(Number(lotus.attrs.x) >= 0 && Number(lotus.attrs.x) + Number(lotus.attrs.width) <= 640);
      assert.ok(Number(lotus.attrs.y) >= 0 && Number(lotus.attrs.y) + Number(lotus.attrs.height) <= 440);
      assert.equal(group.children.filter(node => 'data-crane' in node.attrs).length, state.cells[index] === 'P' ? 1 : 0);
    });
    const visibleCount = all.find(node => node.tag === 'text');
    assert.equal(Number(visibleCount.text), engine.count(state), 'Visible count agrees with image');
    const arrow = all.filter(node => 'data-jump' in node.attrs);
    assert.equal(arrow.length, i === 1 ? 1 : 0);
    if (i === 1) {
      const move = level.solution[0];
      assert.equal(arrow[0].attrs['data-jump'], `${move.from}>${move.to}`);
      assert.equal(root.attrs['data-move'], `${move.from}>${move.to}`);
      assert.equal(state.cells[move.from], '.');
      assert.equal(state.cells[(move.from + move.to) / 2], '.');
      assert.equal(state.cells[move.to], 'P');
    }
    const options = i === 0 ? { stage: stages[i], selected: level.solution[0].from, destinations: [level.solution[0].to] } : i === 1 ? { stage: stages[i], move: level.solution[0] } : { stage: stages[i] };
    assert.equal(source.trim(), art.boardSvg(level, state, options), 'Asset can be reproduced with current renderer');
    assert.ok(!/<(?:script|foreignObject)\b/.test(source), 'Tutorial remains a passive local image');
  });
});

test('all original SVG artwork parses and has explicit positive dimensions', () => {
  for (const file of ['assets/cover.svg', 'assets/icon.svg', 'release/cover.svg', 'release/icon.svg']) {
    const source = fs.readFileSync(path.join(base, file), 'utf8');
    const root = parseXml(source);
    assert.ok(Number(root.attrs.width) > 0 && Number(root.attrs.height) > 0, file);
    assert.ok(!/<script\b|onload=|href="https?:/i.test(source), `${file} has no active or remote resources`);
    const nodes = flatten(root);
    const ids = nodes.filter(node => node.attrs.id).map(node => node.attrs.id);
    assert.equal(new Set(ids).size, ids.length, `${file} has no duplicate SVG IDs`);
  }
});

test('shared crane and lotus SVGs can repeat in DOM without conflicting IDs', () => {
  for (const shape of [art.craneSvg(), art.lotusSvg()]) {
    const root = parseXml(shape);
    assert.equal(root.attrs.viewBox, '0 0 100 100');
    assert.equal(root.attrs['aria-hidden'], 'true');
    assert.equal(flatten(root).filter(node => node.attrs.id).length, 0);
  }
});

test('six collection cranes have distinct visible wing geometry and preserve the default', () => {
  const standard = art.craneSvg();
  const names = ['apricot', 'lotus', 'bamboo', 'rain', 'moon', 'stars'];
  const geometries = [], papers = [];
  names.forEach((name, index) => {
    const root = parseXml(art.craneSvg(index + 1));
    assert.equal(root.attrs['data-variant'], String(index + 1));
    assert.equal(root.attrs.viewBox, '0 0 100 100');
    const all = flatten(root);
    assert.equal(all.filter(node => node.attrs.id).length, 0, 'No shared DOM IDs');
    const pattern = all.find(node => node.attrs['data-wing-pattern'] === name);
    assert.ok(pattern && pattern.children.length > 0, 'Wing design has real SVG shapes');
    assert.ok(pattern.children.every(node => node.tag === 'path' || node.tag === 'circle'));
    geometries.push(JSON.stringify(pattern.children.map(node => ({ tag: node.tag, d: node.attrs.d, cx: node.attrs.cx, cy: node.attrs.cy, r: node.attrs.r }))));
    const wing = all.find(node => node.attrs.d === 'M47 52 79 9 75 60 53 73Z');
    assert.ok(wing);
    papers.push(wing.attrs.fill);
  });
  assert.equal(new Set(geometries).size, 6, 'All designs differ independently of color');
  assert.equal(new Set(papers).size, 6, 'Six different paper colors');
  for (const invalid of [undefined, null, 0, 7, -1, 2.5, '2', NaN]) assert.equal(art.craneSvg(invalid), standard);
  assert.ok(!standard.includes('data-wing-pattern') && !standard.includes('data-variant'));
});
