const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const key = 'kmw-weekly-dua-preview-v1';
const scripts = ['km-activity-progress.js', 'dua-ritual.js', 'weekly-invocation.js'].map(path => readFileSync(path, 'utf8'));

function localStore() {
  const values = new Map();
  return {
    failWrites: false,
    getItem: k => values.get(k) ?? null,
    setItem(k, value) {
      if (this.failWrites) throw new Error('Storage unavailable');
      values.set(k, String(value));
    },
    removeItem: k => values.delete(k), key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; }
  };
}

// Selectors traverse a real tree. Media completion must be explicitly triggered;
// clicking a hidden/disabled control does nothing, as with a browser interaction.
class Element extends EventTarget {
  constructor(tag = 'div', attributes = {}) {
    super();
    this.tagName = tag.toUpperCase(); this.dataset = {}; this.children = [];
    this.attributes = new Map(); this.style = {setProperty() {}};
    this.hidden = false; this.disabled = false; this.textContent = '';
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, force) {
        const on = force === undefined ? !classes.has(name) : Boolean(force);
        if (on) classes.add(name); else classes.delete(name);
        return on;
      }
    };
    Object.entries(attributes).forEach(([name, value]) => this.setAttribute(name, value));
  }
  setAttribute(name, value) {
    value = String(value); this.attributes.set(name, value);
    if (name === 'id') this.id = value;
    if (name === 'class') this.classList.add(...value.split(/\s+/));
    if (name === 'hidden') this.hidden = true;
    if (name === 'disabled') this.disabled = true;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'hidden') this.hidden = false;
    if (name === 'disabled') this.disabled = false;
  }
  matches(selector) {
    return selector.split(',').some(branch => {
      const parts = branch.trim().split(/\s+/);
      const match = (node, part) => {
        const tag = part.match(/^[\w-]+/)?.[0];
        if (tag && node.tagName !== tag.toUpperCase()) return false;
        const id = part.match(/#([\w-]+)/)?.[1];
        if (id && node.id !== id) return false;
        for (const [, name] of part.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(name)) return false;
        for (const [, name, expected] of part.matchAll(/\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\]/g)) {
          const actual = name === 'open' ? (node.open ? '' : null) : node.getAttribute(name);
          if (actual === null || (expected !== undefined && actual !== expected)) return false;
        }
        return true;
      };
      if (!match(this, parts.pop())) return false;
      let ancestor = this.parentElement;
      while (parts.length) {
        const part = parts.pop();
        while (ancestor && !match(ancestor, part)) ancestor = ancestor.parentElement;
        if (!ancestor) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [child, ...child.querySelectorAll('*')])
      .filter(child => selector === '*' || child.matches(selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this; node.ownerDocument = this.ownerDocument; this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  focus() {
    if (this.hidden || this.disabled) return;
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }
  click() {
    if (this.disabled || this.hidden) return;
    const event = new Event('click'); this.dispatchEvent(event); this.onclick?.(event);
  }
}

function page({id = 'leaving', local = localStore(), child = 'amal', seed = {}, time = '2026-11-26T23:30:00Z'} = {}) {
  local.setItem('km-active-profile-v2', JSON.stringify({type: 'child', id: child}));
  const document = new Element('document');
  document.ownerDocument = document; document.hidden = false;
  document.createElement = tag => new Element(tag);
  const add = (parent, tag, attrs = {}) => { const element = new Element(tag, attrs); parent.append(element); return element; };
  const card = add(document, 'section', {id: 'weeklyDua', 'data-dua-id': id});
  const audio = add(card, 'audio');
  audio.paused = true; audio.currentTime = 0; audio.duration = 9;
  audio.play = async () => { audio.paused = false; };
  audio.pause = () => { audio.paused = true; };
  add(card, 'p', {class: 'dua-status'});
  add(card, 'button', {'data-train': ''}); add(card, 'button', {'data-outside': ''});
  add(card, 'p', {'data-ritual-progress': ''});
  const stars = add(card, 'div', {'data-ritual-stars': ''});
  for (let i = 1; i <= 7; i++) {
    const star = add(stars, 'span', {'data-day': String(i)});
    add(star, 'span', {class: 'material-symbols-rounded'});
    add(star, 'small').textContent = String(i);
  }
  for (const name of ['training-label', 'day-goal', 'ritual-note']) add(card, 'p', {['data-' + name]: ''});
  const reference = add(card, 'details', {id: 'duaReference'});
  add(reference, 'button', {'data-listen': ''});
  const slow = add(reference, 'input', {id: 'duaSlow'}); slow.checked = true;
  const confidence = add(card, 'details', {'data-confidence': ''});
  add(confidence, 'summary', {'data-confidence-label': ''});
  for (const value of ['help', 'alone']) add(confidence, 'button', {'data-confidence-choice': value});
  const dialog = add(document, 'dialog', {id: 'duaPractice'});
  dialog.open = false; dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  add(dialog, 'button', {class: 'close'}); add(dialog, 'p', {class: 'part'});
  add(dialog, 'h2', {id: 'duaPracticeTitle'}); add(dialog, 'p', {class: 'dua-coach'});
  add(dialog, 'div', {class: 'dua-words'});
  add(dialog, 'button', {'data-reveal': ''}); add(dialog, 'button', {'data-listen': ''});
  add(dialog, 'button', {'data-listened-elsewhere': '', hidden: ''});
  add(dialog, 'button', {id: 'duaPrevious'}); add(dialog, 'button', {'data-next': '', class: 'main'});
  add(dialog, 'p', {class: 'dua-status'}); add(dialog, 'a', {'data-audio-link': '', hidden: ''});
  const dialogConfidence = add(dialog, 'div', {'data-dialog-confidence': ''});
  for (const value of ['help', 'alone']) add(dialogConfidence, 'button', {'data-confidence-choice': value});
  const bus = new EventTarget(), timers = new Map();
  let now = time, timerId = 0;
  class ParisDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new Date(now).getTime(); }
  }
  const window = {document, localStorage: local, sessionStorage: localStore(), Date: ParisDate,
    URL, URLSearchParams, Event, CustomEvent, Intl, location: new URL('https://example.test/Aujourd%27hui.dc.html'),
    addEventListener: bus.addEventListener.bind(bus), dispatchEvent: bus.dispatchEvent.bind(bus),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: timer => timers.delete(timer),
    setInterval: callback => { timers.set(++timerId, callback); return timerId; },
    clearInterval: timer => timers.delete(timer),
    requestAnimationFrame: callback => callback(), console};
  window.window = window; vm.createContext(window);
  vm.runInContext(scripts[0], window);
  const storage = window.KMActivityProgress.storage;
  for (const [name, value] of Object.entries(seed)) storage.setItem(name, JSON.stringify(value));
  vm.runInContext(scripts[1], window); vm.runInContext(scripts[2], window);
  const c = selector => card.querySelector(selector), d = selector => dialog.querySelector(selector);
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  return {local, window, document, card, dialog, audio, storage, c, d, settle,
    read: () => JSON.parse(storage.getItem(key)),
    progress: () => window.KMDuaProgress.read(id),
    advanceTime(value) { now = value; bus.dispatchEvent(new Event('pageshow')); },
    async listen() { d('[data-listen]').click(); await settle(); },
    endAudio() { audio.paused = true; audio.currentTime = audio.duration; audio.dispatchEvent(new Event('ended')); },
    async finish() {
      c('[data-train]').click(); await this.listen(); this.endAudio();
      d('[data-next]').click(); // listening complete
      d('[data-next]').click(); // I repeated
      d('[data-next]').click(); // explicit recitation confirmation
    }
  };
}

test('guided practice requires listening, repetition and explicit confirmation before awarding one day', async () => {
  const p = page({seed: {[key]: {learned: ['sleep'], practices: {sleep: 4}, extra: {keep: true}, ritualDays: {morning: ['2026-11-25']}}}});
  p.c('[data-train]').click();
  const firstTitle = p.d('#duaPracticeTitle').textContent;
  assert.equal(p.d('[data-next]').hidden, true);
  p.d('[data-next]').onclick?.({target: p.d('[data-next]')});
  assert.equal(p.d('#duaPracticeTitle').textContent, firstTitle, 'hidden next action is also guarded');
  p.endAudio();
  assert.equal(p.d('[data-next]').hidden, true, 'unrelated media completion cannot unlock the lesson');
  await p.listen(); assert.equal(p.audio.paused, false); p.endAudio();
  assert.equal(p.d('[data-next]').hidden, false);
  assert.equal(p.progress().count, 0);
  p.d('[data-next]').click(); p.d('[data-next]').click();
  assert.equal(p.progress().count, 0, 'advancing past repetition does not credit a recitation');
  p.d('[data-next]').click();
  assert.deepEqual(p.read().ritualDays.leaving, ['2026-11-27']);
  assert.equal(p.read().practices.leaving, 1);
  assert.deepEqual(p.read().learned, ['sleep'], 'practice must never certify memorization');
  assert.deepEqual(p.read().extra, {keep: true});
  assert.deepEqual(p.read().ritualDays.morning, ['2026-11-25']);
  assert.equal(p.dialog.open, true, 'success remains available to read');
  p.d('[data-next]').click(); assert.equal(p.dialog.open, false);
});

test('closing a lesson stops audio, clears stale status and never awards a day', async () => {
  const p = page(); p.c('[data-train]').click(); await p.listen();
  assert.equal(p.audio.paused, false);
  p.d('.close').click();
  assert.equal(p.dialog.open, false); assert.equal(p.audio.paused, true);
  assert.equal(p.audio.currentTime, 0); assert.equal(p.d('.dua-status').textContent, '');
  assert.equal(p.progress().count, 0);
  p.endAudio(); p.c('[data-train]').click();
  assert.equal(p.d('[data-next]').hidden, true, 'a new lesson starts with its own listening gate');
});

test('audio failure offers an explicit adult-assisted fallback without automatically crediting progress', async () => {
  const p = page(); p.audio.play = async () => { throw new Error('Offline'); };
  p.c('[data-train]').click(); await p.listen();
  assert.equal(p.d('[data-next]').hidden, true);
  assert.equal(p.d('[data-listened-elsewhere]').hidden, false);
  assert.equal(p.d('[data-audio-link]').hidden, false); assert.equal(p.progress().count, 0);
  p.d('[data-listened-elsewhere]').click(); assert.equal(p.d('[data-next]').hidden, false);
  p.d('[data-next]').click(); p.d('[data-next]').click(); assert.equal(p.progress().count, 0);
  p.d('[data-next]').click(); assert.equal(p.progress().count, 1);
});

test('same-day review keeps the same personal day; the next Paris date unlocks the next day', async () => {
  const p = page(); await p.finish(); p.d('[data-next]').click();
  assert.equal(p.progress().day, 1); assert.equal(p.c('[data-outside]').hidden, true);
  await p.finish(); p.d('[data-next]').click();
  assert.equal(p.progress().count, 1); assert.equal(p.progress().day, 1);
  assert.equal(p.read().practices.leaving, 2);
  p.advanceTime('2026-11-27T23:01:00Z');
  assert.equal(p.progress().day, 2); assert.equal(p.progress().todayDone, false);
  assert.equal(p.c('[data-outside]').hidden, false);
  assert.match(p.c('[data-training-label]').textContent, /2/);
});

test('outside recitation requires confirmation and stays separate from guided practice counters', () => {
  const p = page(); p.c('[data-outside]').click();
  assert.equal(p.progress().count, 0); assert.equal(p.audio.paused, true);
  p.d('[data-next]').click(); assert.equal(p.progress().count, 1);
  assert.equal(p.read().practices?.leaving ?? 0, 0); assert.equal(p.c('[data-outside]').hidden, true);
  p.d('[data-next]').click(); assert.equal(p.dialog.open, false);
  assert.equal(p.document.activeElement, p.c('[data-train]'), 'focus returns to a visible control after the outside button is hidden');
});

test('the seventh day completes practice, leaves mastery undecided and allows reversible confidence', async () => {
  const dates = ['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-13', '2026-11-18', '2026-11-24'];
  const p = page({seed: {[key]: {ritualDays: {leaving: dates}}}});
  await p.finish();
  assert.equal(p.progress().complete, true); assert.equal(p.progress().count, 7);
  assert.equal(p.progress().confidence, null);
  assert.equal(p.d('[data-dialog-confidence]').hidden, false);
  assert.equal(p.c('[data-confidence]').hidden, false);
  p.d('[data-confidence-choice="alone"]').click(); assert.equal(p.progress().confidence, 'alone');
  p.d('[data-confidence-choice="help"]').click(); assert.equal(p.progress().confidence, 'help');
  assert.equal(p.d('[data-confidence-choice="help"]').getAttribute('aria-pressed'), 'true');
  assert.equal(p.c('[data-confidence-choice="alone"]').getAttribute('aria-pressed'), 'false');
  p.d('[data-next]').click(); p.advanceTime('2026-12-01T10:00:00Z'); await p.finish();
  assert.equal(p.read().ritualDays.leaving.length, 7, 'reviews add no invisible eighth star');
  assert.equal(p.progress().confidence, 'help');
});

test('cloud restoration updates visible progress and reloads stay isolated between children', () => {
  const p = page({seed: {[key]: {learned: ['sleep'], practices: {sleep: 3}}}});
  const restored = {learned: ['sleep'], practices: {sleep: 3, leaving: 2}, ritualDays: {leaving: ['2026-11-25', '2026-11-27']}};
  p.storage.applyRemote(key, restored);
  p.document.dispatchEvent(new CustomEvent('km-activity-restored', {detail: {key, value: restored}}));
  assert.match(p.c('[data-ritual-progress]').textContent, /2/);
  assert.equal(p.c('[data-ritual-stars]').querySelectorAll('[data-day]').filter(star => star.classList.contains('is-earned')).length, 2);
  assert.equal(p.progress().confidence, null, 'bedtime confidence does not leak');
  const again = page({local: p.local});
  assert.equal(again.progress().count, 2); assert.equal(again.progress().todayDone, true);
  const sibling = page({local: p.local, child: 'nour'});
  assert.equal(sibling.progress().count, 0); assert.equal(sibling.read(), null);
  p.c('[data-outside]').onclick?.({target: p.c('[data-outside]')});
  assert.equal(p.dialog.open, false, 'an inactive profile cannot open another lesson');
});

test('failed saving stays at confirmation and can be retried without losing or duplicating the day', () => {
  const p = page(); p.c('[data-outside]').click(); p.local.failWrites = true;
  p.d('[data-next]').click();
  assert.equal(p.progress().count, 0); assert.equal(p.dialog.open, true);
  assert.match(p.d('.dua-status').textContent, /enregistr|sauvegard/i);
  p.local.failWrites = false; p.d('[data-next]').click();
  assert.equal(p.progress().count, 1);
  p.d('[data-next]').click(); assert.equal(p.dialog.open, false);
});

test('leaving the app cancels pending audio and ignores a late completion event', async () => {
  const p = page(); let resolvePlay;
  p.audio.play = () => { p.audio.paused = false; return new Promise(resolve => { resolvePlay = resolve; }); };
  p.c('[data-train]').click(); p.d('[data-listen]').click();
  p.document.dispatchEvent(new Event('km-app-inactive'));
  assert.equal(p.audio.paused, true); assert.equal(p.dialog.open, false);
  assert.equal(p.d('.dua-status').textContent, '');
  resolvePlay(); await p.settle(); p.endAudio();
  assert.equal(p.progress().count, 0); assert.equal(p.d('.dua-status').textContent, '');
  p.document.dispatchEvent(new Event('km-app-active')); p.c('[data-train]').click();
  assert.equal(p.d('[data-next]').hidden, true);
});
