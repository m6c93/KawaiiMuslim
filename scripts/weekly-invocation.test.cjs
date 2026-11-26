const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');

const key = 'kmw-weekly-dua-preview-v1';
const legacyRitual = 'kmw-dua-sleep-ritual-v1';
const legacyWeek = 'kmw-dua-sleep-week-1795392000000';
const scripts = ['km-activity-progress.js', 'weekly-invocation.js', 'dua-ritual.js']
  .map(path => readFileSync(path, 'utf8'));
function localStore() {
  const values = new Map();
  return {getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)),
    removeItem: k => values.delete(k)};
}
class Element extends EventTarget {
  constructor() {
    super(); this.dataset = {}; this.children = []; this.attributes = new Map(); this.nodes = {};
    this.style = {}; this.classList = {add() {}, remove() {}}; this.textContent = '';
  }
  querySelector(selector) { return this.nodes[selector]; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  closest() { return this.container; }
  click() { if (!this.disabled) this.onclick?.({target: this}); }
}
function page({id = 'leaving', local = localStore(), child = 'amal', seed = {}} = {}) {
  local.setItem('km-active-profile-v2', JSON.stringify({type: 'child', id: child}));
  const card = new Element(), dialog = new Element(), ritual = new Element();
  card.dataset.duaId = id;
  const make = (parent, selectors) => { for (const selector of selectors) parent.nodes[selector] = new Element(); };
  make(card, ['audio', '.dua-status', '.known', '#duaWeek', '#duaSlow', '[data-train]']);
  make(dialog, ['.part', 'h2', '.dua-words', '[data-reveal]', '.main', '#duaPrevious', '.dua-status', '.dua-coach', '.close']);
  make(ritual, ['input', '[data-ritual-label]', '[data-ritual-progress]', '[data-ritual-stars]', '[role="status"]', '[data-ritual-note]']);
  const listen = [new Element(), new Element()];
  listen.forEach((button, index) => { button.textContent = 'Écouter'; button.container = index ? dialog : card; });
  card.nodes['#duaSlow'].checked = true;
  const audio = card.nodes.audio;
  audio.pause = () => { audio.paused = true; };
  audio.play = async () => { audio.paused = false; };
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  const document = new EventTarget();
  document.querySelector = selector => ({'#weeklyDua': card, '#duaPractice': dialog, '#duaRitual': ritual})[selector];
  document.querySelectorAll = () => listen;
  document.createElement = () => new Element();
  document.hidden = false;
  const bus = new EventTarget();
  class ParisDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-26T23:30:00Z'])); } }
  const window = {document, localStorage: local, sessionStorage: localStore(), Date: ParisDate,
    URL, URLSearchParams, CustomEvent, location: new URL('https://example.test/Aujourd%27hui.dc.html'),
    addEventListener: bus.addEventListener.bind(bus), setTimeout: () => 1, clearTimeout() {},
    setInterval: () => 2, clearInterval() {}};
  window.window = window;
  vm.createContext(window);
  vm.runInContext(scripts[0], window);
  const storage = window.KMActivityProgress.storage;
  for (const [name, value] of Object.entries(seed)) storage.setItem(name, JSON.stringify(value));
  vm.runInContext(scripts[1], window);
  vm.runInContext(scripts[2], window);
  return {local, window, document, card, dialog, ritual, storage,
    read: name => JSON.parse(storage.getItem(name)),
    finish() { card.nodes['[data-train]'].click(); while (dialog.open) dialog.nodes['.main'].click(); },
    validate() { ritual.nodes.input.checked = true; ritual.nodes.input.dispatchEvent(new Event('change')); }};
}

test('changing the invocation preserves sleep history and shares learning and daily ritual safely', () => {
  const p = page({seed: {
    [key]: {learned: ['sleep'], practices: {sleep: 4}, extra: {keep: true}, ritualDays: {morning: ['2026-11-25']}},
    [legacyRitual]: ['2026-11-24'], [legacyWeek]: 2
  }});
  assert.equal(p.card.nodes['.known'].getAttribute('aria-pressed'), 'false');
  p.validate();
  p.finish();
  p.card.nodes['.known'].click();
  const state = p.read(key);
  assert.deepEqual(state.learned, ['sleep', 'leaving']);
  assert.deepEqual(state.practices, {sleep: 4, leaving: 1});
  assert.deepEqual(state.ritualDays, {morning: ['2026-11-25'], leaving: ['2026-11-27']});
  assert.equal(state.weeklySessions.leaving['1795392000000'].tries, 1);
  assert.deepEqual(state.extra, {keep: true});
  assert.deepEqual(p.read(legacyRitual), ['2026-11-24']);
  assert.equal(p.read(legacyWeek), 2);
  assert.match(p.card.nodes['.dua-status'].textContent, /avant de sortir/);
  assert.doesNotMatch(p.ritual.nodes['[data-ritual-label]'].textContent, /soir/);
});

test('the current invocation returns on reload with its own daily and learning progress, isolated from siblings', () => {
  const p = page(); p.finish(); p.validate(); p.card.nodes['.known'].click();
  const again = page({local: p.local});
  assert.equal(again.ritual.nodes.input.checked, true);
  assert.equal(again.ritual.nodes.input.disabled, true);
  assert.equal(again.card.nodes['.known'].getAttribute('aria-pressed'), 'true');
  again.card.nodes['[data-train]'].click();
  assert.equal(again.dialog.nodes['.part'].textContent, 'ÉTAPE 2 SUR 3');
  const other = page({local: p.local, child: 'nour'});
  assert.equal(other.ritual.nodes.input.checked, false);
  assert.equal(other.card.nodes['.known'].getAttribute('aria-pressed'), 'false');
  assert.equal(other.read(key), null);
});

test('a cloud restoration updates leaving progress without inheriting the bedtime badge', () => {
  const p = page({seed: {[key]: {learned: ['sleep'], practices: {sleep: 3}}}});
  const restored = {learned: ['sleep', 'leaving'], practices: {sleep: 3, leaving: 2},
    ritualDays: {leaving: ['2026-11-27']}, weeklySessions: {leaving: {'1795392000000': {tries: 2}}}};
  p.storage.applyRemote(key, restored);
  p.document.dispatchEvent(new CustomEvent('km-activity-restored', {detail: {key, value: restored}}));
  assert.equal(p.card.nodes['.known'].getAttribute('aria-pressed'), 'true');
  assert.equal(p.ritual.nodes.input.checked, true);
  p.card.nodes['[data-train]'].click();
  assert.equal(p.dialog.nodes['.part'].textContent, 'ÉTAPE 3 SUR 3');
});

test('the previous bedtime invocation retains its historical storage and coaching', () => {
  const p = page({id: 'sleep', seed: {[key]: {learned: ['sleep'], practices: {sleep: 2}, extra: true},
    [legacyRitual]: ['2026-11-26'], [legacyWeek]: 2}});
  assert.equal(p.card.nodes['.known'].getAttribute('aria-pressed'), 'true');
  p.finish(); p.validate();
  assert.equal(p.read(key).practices.sleep, 3);
  assert.equal(p.read(key).extra, true);
  assert.equal(p.read(legacyWeek), 3);
  assert.deepEqual(p.read(legacyRitual), ['2026-11-26', '2026-11-27']);
  assert.match(p.card.nodes['.dua-status'].textContent, /avant de dormir/);
});
