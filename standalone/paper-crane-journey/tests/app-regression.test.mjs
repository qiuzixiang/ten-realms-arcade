import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = Object.fromEntries(['engine', 'levels', 'storage', 'app'].map(name => [name, fs.readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8')]));
const plain = value => JSON.parse(JSON.stringify(value));

// This DOM stub models the behavior relevant to the app: innerHTML replaces
// nodes, removes their focus, and produces new focusable button instances.
// Tests dispatch the application's real document handlers and run real rules.
function harness(options = {}) {
  const values = new Map();
  const storage = {
    values, failGet: false, failSet: false,
    getItem(key) { if (this.failGet) throw Error('read denied'); return values.get(key) ?? null; },
    setItem(key, value) { if (this.failSet) throw Error('write denied'); values.set(key, value); }
  };
  const listeners = {};
  const timers = [];
  const document = { activeElement: null };
  const body = { style: {}, focus() { document.activeElement = body; } };
  document.body = body;
  document.activeElement = body;

  function matches(node, selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      const attribute = part.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      if (attribute) return node.hasAttribute(attribute[1]) && (attribute[2] === undefined || node.getAttribute(attribute[1]) === attribute[2]);
      return node.tagName.toLowerCase() === part;
    });
  }
  function makeRoot() {
    const root = {
      nodes: [], markup: '',
      contains(node) { return this.nodes.includes(node); },
      querySelector(selector) { return this.nodes.find(node => matches(node, selector)) || null; },
      querySelectorAll(selector) { return this.nodes.filter(node => matches(node, selector)); }
    };
    Object.defineProperty(root, 'innerHTML', {
      get() { return this.markup; },
      set(markup) {
        if (this.contains(document.activeElement)) document.activeElement = body;
        this.nodes.forEach(node => { node.isConnected = false; });
        this.markup = markup;
        this.nodes = [...markup.matchAll(/<(button|input|select)\b([^>]*)>/g)].map(match => {
          const attributes = {};
          for (const attribute of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attributes[attribute[1]] = attribute[2] ?? '';
          const node = {
            tagName: match[1].toUpperCase(), attributes, dataset: {}, isConnected: true,
            disabled: Object.hasOwn(attributes, 'disabled'), value: attributes.value || '',
            hasAttribute(name) { return Object.hasOwn(attributes, name); },
            getAttribute(name) { return this.hasAttribute(name) ? attributes[name] : null; },
            closest(selector) { return matches(this, selector) ? this : null; },
            focus() { if (this.isConnected && !this.disabled) document.activeElement = this; }
          };
          for (const [key, value] of Object.entries(attributes)) if (key.startsWith('data-')) node.dataset[key.slice(5)] = value;
          return node;
        });
      }
    });
    return root;
  }
  const app = makeRoot();
  const modal = makeRoot();
  const announcement = { textContent: '' };
  document.documentElement = { style: { setProperty() {} } };
  document.getElementById = id => ({ app, 'modal-root': modal, announcement }[id] || [...app.nodes, ...modal.nodes].find(node => node.getAttribute('id') === id) || null);
  document.contains = node => node === body || app.contains(node) || modal.contains(node);
  document.querySelector = selector => app.querySelector(selector) || modal.querySelector(selector);
  document.addEventListener = (type, callback) => { (listeners[type] ||= []).push(callback); };
  const window = { localStorage: storage, innerHeight: 844, scrollTo() {}, addEventListener() {}, CraneArt: { craneSvg() { return ''; }, lotusSvg() { return ''; } } };
  if (options.host) window.PaperCraneHost = { onComplete: options.host };
  const context = vm.createContext({ window, document, console, Uint32Array, setTimeout: callback => timers.push(callback) });
  for (const name of ['engine', 'levels', 'storage']) vm.runInContext(scripts[name], context);
  if (options.tutorialSeen !== false) values.set(window.CraneStorage.tutorialKey, '1');
  if (options.before) options.before(window, storage);
  storage.failGet = !!options.failGet;
  storage.failSet = !!options.failSet;
  let store;
  const originalCreate = window.CraneStorage.create;
  window.CraneStorage.create = function (...args) { store = originalCreate(...args); return store; };
  vm.runInContext(scripts.app, context);

  function dispatch(type, event) { for (const listener of listeners[type] || []) listener(event); }
  function click(node, keyboard = true) {
    assert.ok(node, 'the actual rendered control exists');
    assert.equal(node.disabled, false, 'the actual rendered control is enabled');
    node.focus();
    dispatch('click', { target: node, detail: keyboard ? 0 : 1 });
  }
  const result = {
    window, storage, document, app, modal, store,
    flushTimers() { while (timers.length) timers.shift()(); },
    clickAction(name, id) {
      const root = modal.nodes.length ? modal : app;
      click(root.nodes.find(node => node.dataset.action === name && (id === undefined || node.dataset.id === id)));
    },
    clickCell(index) { click(app.querySelector('[data-cell="' + index + '"]')); },
    move(move) { result.clickCell(move.from); result.clickCell(move.to); },
    start(index = 0) {
      const level = window.CraneLevels.levels[index];
      result.clickAction('chapter', String(level.chapter));
      result.clickAction('level', level.id);
      return level;
    },
    key(key, shiftKey = false) {
      let prevented = false;
      dispatch('keydown', { key, shiftKey, target: document.activeElement, preventDefault() { prevented = true; } });
      return prevented;
    }
  };
  return result;
}

test('a missing tutorial marker preserves valid main, daily, and seeded sessions and existing rewards', () => {
  for (const mode of ['main', 'daily', 'seeded']) {
    let original;
    const h = harness({ tutorialSeen: false, before(window, storage) {
      const store = window.CraneStorage.create(storage);
      const wonLevel = window.CraneLevels.levels[0];
      const completed = store.newSession(wonLevel, 'main');
      completed.timeline = plain(wonLevel.solution);
      store.complete(completed);
      const level = mode === 'main' ? window.CraneLevels.levels[9] : mode === 'daily' ? window.CraneLevels.daily('2026-09-08') : window.CraneLevels.seeded('kept-session', 4);
      original = store.newSession(level, mode);
      original.timeline = [plain(level.solution[0])];
      original.hints = 1;
      store.saveSession(original);
    } });
    assert.equal(h.store.loadSession().runId, original.runId);
    assert.equal(h.store.loadSession().timeline.length, 1);
    assert.equal(h.store.loadSession().hints, 1);
    assert.equal(h.store.progress().completedCount, 1);
    assert.match(h.modal.innerHTML, /三张纸笺/);
    h.clickAction('close-modal');
    assert.equal(h.store.loadSession().runId, original.runId);
    assert.equal(h.modal.innerHTML, '');
  }
});

test('continue resumes the same run and legal timeline without creating a replacement session', () => {
  let original;
  const h = harness({ before(window, storage) {
    const store = window.CraneStorage.create(storage);
    const level = window.CraneLevels.levels[0];
    original = store.newSession(level, 'main');
    original.timeline = plain(level.solution.slice(0, 2));
    original.hints = 1;
    original.undos = 3;
    store.saveSession(original);
  } });
  h.clickAction('continue');
  assert.equal(h.store.loadSession().runId, original.runId);
  assert.deepEqual(plain(h.store.loadSession().timeline), original.timeline);
  assert.equal(h.store.loadSession().hints, 1);
  assert.equal(h.store.loadSession().undos, 3);
  assert.ok(h.app.querySelector('[data-cell]'));
});

test('pending hints are cancelled by a move, undo, navigation, a modal, and optional-target changes', () => {
  for (const interruption of ['move', 'undo', 'navigation', 'modal', 'target']) {
    const h = harness();
    const level = h.start();
    if (interruption === 'undo') h.move(level.solution[0]);
    h.clickAction('hint');
    if (interruption === 'move') h.move(level.solution[0]);
    if (interruption === 'undo') h.clickAction('undo');
    if (interruption === 'navigation') h.clickAction('return-map');
    if (interruption === 'modal') h.clickAction('tutorial');
    if (interruption === 'target') h.clickAction('target');
    const before = JSON.stringify(h.store.loadSession());
    h.flushTimers();
    assert.equal(JSON.stringify(h.store.loadSession()), before, interruption + ' cancels all delayed hint effects');
    assert.equal(h.store.loadSession().hints, 0);
    if (interruption === 'modal') assert.match(h.modal.innerHTML, /三张纸笺/);
  }
});

test('a delayed hint cannot change an already completed run or its independent reward', () => {
  const h = harness();
  const level = h.start();
  for (const move of level.solution.slice(0, -1)) h.move(move);
  h.clickAction('hint');
  h.move(level.solution[level.solution.length - 1]);
  const before = JSON.stringify(h.store.loadSession());
  h.flushTimers();
  assert.equal(JSON.stringify(h.store.loadSession()), before);
  assert.equal(h.store.loadSession().hints, 0);
  assert.equal(h.store.progress().independent[level.id], true);
  assert.match(h.modal.innerHTML, /独立完成/);
  assert.doesNotMatch(h.app.innerHTML, /已找不到单鹤归巢路线/);
});

test('completion, undo, and completion create a new run without claiming the same rewards twice', () => {
  const h = harness();
  const level = h.start();
  for (const move of level.solution) h.move(move);
  const first = h.store.loadSession();
  assert.equal(h.store.progress().totalClaims, 3);
  h.clickAction('close-modal');
  h.clickAction('undo');
  const undone = h.store.loadSession();
  assert.notEqual(undone.runId, first.runId);
  assert.equal(undone.completionId, undefined);
  assert.equal(undone.timeline.length, level.solution.length - 1);
  assert.equal(undone.undos, 1);
  h.move(level.solution[level.solution.length - 1]);
  assert.notEqual(h.store.loadSession().completionId, first.completionId);
  assert.equal(h.store.progress().totalClaims, 3);
  assert.equal(h.store.progress().wins, 2);
  h.clickAction('close-modal');
  h.clickAction('completion');
  assert.equal(h.store.progress().wins, 2);
});

test('a delivered hint remains counted through undo while a full restart begins a fresh independent attempt', () => {
  const h = harness();
  const level = h.start();
  h.clickAction('hint');
  h.flushTimers();
  assert.equal(h.store.loadSession().hints, 1);
  h.clickCell(level.solution[0].to);
  for (const move of level.solution.slice(1)) h.move(move);
  assert.equal(h.store.progress().independent[level.id], undefined);
  assert.equal(h.store.progress().totalClaims, 2);
  h.clickAction('close-modal');
  h.clickAction('undo');
  assert.equal(h.store.loadSession().hints, 1);
  h.move(level.solution[level.solution.length - 1]);
  assert.equal(h.store.progress().totalClaims, 2);
  h.clickAction('close-modal');
  h.clickAction('restart');
  h.clickAction('confirm-restart');
  assert.equal(h.store.loadSession().hints, 0);
  for (const move of level.solution) h.move(move);
  assert.equal(h.store.progress().independent[level.id], true);
  assert.equal(h.store.progress().totalClaims, 3);
});

test('normal offline completion stays saved even when the optional host is absent', async () => {
  const h = harness();
  const level = h.start();
  for (const move of level.solution) h.move(move);
  await new Promise(setImmediate);
  assert.equal(h.store.saved, true);
  h.clickAction('close-modal');
  h.clickAction('target');
  assert.doesNotMatch(h.app.innerHTML, /当前浏览器暂未保存/);
  h.clickAction('completion');
  assert.doesNotMatch(h.modal.innerHTML, /浏览器暂未保存/);
  assert.equal(h.store.progress().completed[level.id], true);
});

test('write-denied games can finish with an honest warning and never send an unpersisted event', async () => {
  const received = [];
  const h = harness({ failSet: true, host: payload => received.push(payload) });
  const level = h.start();
  for (const move of level.solution) h.move(move);
  await new Promise(setImmediate);
  assert.equal(h.store.saved, false);
  assert.match(h.modal.innerHTML, /本次已通关，但浏览器暂未保存/);
  assert.equal(received.length, 0);
  assert.equal(h.storage.values.has(h.window.CraneStorage.key), false);
});

test('app startup and temporary play never overwrite an unknown save after a read exception', async () => {
  let originalRaw;
  const received = [];
  const h = harness({ failGet: true, host: payload => received.push(payload), before(window, storage) {
    const store = window.CraneStorage.create(storage);
    const level = window.CraneLevels.levels[9];
    const session = store.newSession(level, 'main');
    session.timeline = [plain(level.solution[0])];
    store.saveSession(session);
    originalRaw = storage.getItem(window.CraneStorage.key);
  } });
  await new Promise(setImmediate);
  assert.equal(h.storage.values.get(h.window.CraneStorage.key), originalRaw);
  h.clickAction('close-modal');
  for (const move of h.window.CraneLevels.levels[0].solution) h.move(move);
  await new Promise(setImmediate);
  assert.equal(h.store.saved, false);
  assert.equal(h.storage.values.get(h.window.CraneStorage.key), originalRaw);
  assert.equal(received.length, 0);
});

test('repainting tools retains keyboard focus, and modal close returns to its live trigger', () => {
  const h = harness();
  const level = h.start();
  h.clickAction('hint');
  assert.equal(h.document.activeElement.dataset.action, 'hint');
  h.flushTimers();
  assert.equal(h.document.activeElement.dataset.action, 'hint');
  h.clickAction('target');
  assert.equal(h.document.activeElement.dataset.action, 'target');
  h.clickCell(level.solution[0].to);
  h.move(level.solution[1]);
  h.clickAction('undo');
  assert.equal(h.document.activeElement.dataset.action, 'undo');
  assert.equal(h.document.activeElement.isConnected, true);
  h.clickAction('tutorial');
  const first = h.modal.nodes[0], last = h.modal.nodes[h.modal.nodes.length - 1];
  assert.equal(h.document.activeElement, first);
  assert.equal(h.key('Tab', true), true);
  assert.equal(h.document.activeElement, last);
  assert.equal(h.key('Tab'), true);
  assert.equal(h.document.activeElement, first);
  h.clickAction('close-modal');
  assert.equal(h.document.activeElement.dataset.action, 'tutorial');
  assert.equal(h.document.activeElement.isConnected, true);
});

test('closing the win dialog restores focus to the newly rendered final landing cell', () => {
  const h = harness();
  const level = h.start();
  for (const move of level.solution) h.move(move);
  const last = level.solution[level.solution.length - 1];
  assert.equal(h.document.activeElement.dataset.action, 'close-modal');
  h.clickAction('close-modal');
  assert.equal(h.document.activeElement.dataset.cell, String(last.to));
  assert.equal(h.document.activeElement.isConnected, true);
});

test('daily restart grants one daily claim for that date and keeps the date-bound board', () => {
  const h = harness();
  h.clickAction('daily');
  const original = h.store.loadSession();
  const level = h.window.CraneLevels.daily(original.seed);
  for (const move of level.solution) h.move(move);
  assert.equal(h.store.progress().dailyCount, 1);
  assert.equal(h.store.progress().rewardClaims.filter(claim => claim.type === 'daily').length, 1);
  h.clickAction('close-modal');
  h.clickAction('restart');
  h.clickAction('confirm-restart');
  assert.equal(h.store.loadSession().seed, original.seed);
  assert.equal(h.store.loadSession().levelId, original.levelId);
  for (const move of level.solution) h.move(move);
  assert.equal(h.store.progress().dailyCount, 1);
  assert.equal(h.store.progress().totalClaims, 4);
});
