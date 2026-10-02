import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { KEYS, freshSession } from '../storage.mjs';
import { move, findPath } from '../core.mjs';

// Exercise the real UI handlers with a small DOM adapter, including WebView
// capability failures. No test hooks or synthetic game states are shipped.
const files = ['core.mjs', 'storage.mjs', 'renderer.mjs', 'app.mjs'];
const source = (await Promise.all(files.map(f => readFile(new URL('../' + f, import.meta.url), 'utf8'))))
  .map(s => s.replace(/^import .*?;\s*$/gm, '').replace(/^export (?=(?:const|function|class)\b)/gm, '')).join('\n');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function launch({ blockedCrypto = false, blockedStorage = false, ignoreEventProperties = false } = {}) {
  const elements = new Map();
  class Element {
    constructor() {
      this.listeners = {}; this.dataset = {}; this.children = []; this.hidden = false;
      this.style = { setProperty() {} }; this.attributes = {}; this.textContent = '';
      const classes = new Set();
      this.classList = { add: (...v) => v.forEach(x => classes.add(x)), remove: (...v) => v.forEach(x => classes.delete(x)), toggle: (v, on) => on ? classes.add(v) : classes.delete(v) };
      if (ignoreEventProperties) Object.defineProperty(this, 'onclick', { set() {}, get() { return null; } });
    }
    set innerHTML(value) {
      this.markup = value;
      for (const match of value.matchAll(/\bid="([^"]+)"/g)) elements.set(match[1], new Element());
    }
    get innerHTML() { return this.markup || ''; }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.append(node); }
    remove() {}
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    click() { if (this.onclick) this.onclick({ target: this }); for (const fn of this.listeners.click || []) fn({ target: this }); }
    focus() { document.activeElement = this; }
    querySelectorAll() { return []; }
  }
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) elements.set(m[1], new Element());
  const document = { body: new Element(), documentElement: new Element(), activeElement: null, createElement: () => new Element(), getElementById: id => elements.get(id), querySelector: () => null, addEventListener() {} };
  document.activeElement = document.body;
  const saved = freshSession(121, 'existing');
  let pair;
  for (let from = 0; from < 81 && !pair; from++) for (let to = 0; to < 81; to++) if (findPath(saved.state.board, from, to)) { pair = [from, to]; break; }
  assert.equal(move(saved.state, ...pair).ok, true);
  saved.session.moves.push(pair);
  const values = new Map([[KEYS.session, JSON.stringify(saved.session)], [KEYS.tutorial, 'true']]);
  const storage = { getItem: k => values.get(k), setItem: (k, v) => { if (blockedStorage) throw new Error('Storage denied'); values.set(k, v); } };
  const crypto = { getRandomValues(n) { if (blockedCrypto) throw new Error('Crypto denied'); n[0] = 98765; return n; } };
  const api = runInNewContext(`(function() { ${source}
    return { inspect: () => ({session, state}), complete: () => {
      state.score = 172; state.turns = 31; state.gameOver = true;
      state.board = Array(81).fill(1); visualBoard = state.board.slice(); render(); showGameOver();
    }};
  })()`, { document, window: { localStorage: storage, crypto, addEventListener() {} }, crypto, matchMedia: () => ({matches:true}), setTimeout: () => 1, clearTimeout() {} });
  return { api, values, el: id => elements.get(id) };
}
function assertFresh(h, target) {
  const {state, session} = h.api.inspect();
  assert.equal(state.score, 0); assert.equal(state.turns, 0); assert.equal(state.gameOver, false);
  assert.equal(state.board.filter(Boolean).length, 5); assert.equal(state.next.length, 3);
  assert.equal(session.moves.length, 0); assert.equal(session.target, target);
  assert.notEqual(session.id, 'existing');
  assert.equal(h.el('score').textContent, '0'); assert.equal(h.el('king-stage-score').textContent, String(target));
  assert.equal(h.el('dialog-backdrop').hidden, true);
  assert.equal(h.el('board').children.filter(cell => Number(cell.dataset.color) !== 0).length, 5);
}

for (const blockedCrypto of [false, true]) {
  test(`manual restart supports cancel and confirm (crypto blocked: ${blockedCrypto})`, () => {
    const h = launch({blockedCrypto, ignoreEventProperties:true});
    const previous = h.api.inspect().session;
    h.el('new-game').click();
    assert.equal(h.el('dialog-backdrop').hidden, false);
    h.el('keep-playing').click();
    assert.equal(h.api.inspect().session, previous);
    h.el('new-game').click(); h.el('confirm-new').click(); assertFresh(h, 100);
    assert.equal(JSON.parse(h.values.get(KEYS.session)).moves.length, 0);
    h.el('new-game').click(); assertFresh(h, 100);
  });
  test(`game-over restart refreshes board and king record (crypto blocked: ${blockedCrypto})`, () => {
    const h = launch({blockedCrypto, ignoreEventProperties:true});
    h.api.complete(); h.el('over-new').click(); assertFresh(h, 172);
    assert.equal(JSON.parse(h.values.get(KEYS.records))[0].score, 172);
    assert.equal(JSON.parse(h.values.get(KEYS.session)).target, 172);
  });
}
test('both restart entries remain usable when storage writes and crypto fail', () => {
  const h = launch({blockedCrypto:true, blockedStorage:true});
  h.el('new-game').click(); h.el('confirm-new').click(); assertFresh(h, 100);
  h.api.complete(); h.el('over-new').click(); assertFresh(h, 172);
  assert.equal(h.el('save-status').innerHTML, '当前环境无法保存进度');
});
