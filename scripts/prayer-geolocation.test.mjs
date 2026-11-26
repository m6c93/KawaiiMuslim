import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../today-v2.js', import.meta.url), 'utf8');

function target() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatchEvent(event) {
      if (!event.target) event.target = this;
      event.currentTarget = this;
      for (const callback of listeners.get(event.type) || []) callback.call(this, event);
      return true;
    }
  };
}

function element(id, tagName = 'div') {
  const attributes = new Map();
  const classes = new Set();
  let ownText = '';
  const node = Object.assign(target(), {
    id, tagName: tagName.toUpperCase(), children: [], value: '',
    hidden: ['prayerCityForm', 'prayerDone', 'prayerApproxButton', 'prayerRetryButton', 'prayerCitySuggestions'].includes(id),
    disabled: false, dataset: {}, style: { setProperty() {} }, offsetWidth: 100,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : force;
        if (enabled) classes.add(name); else classes.delete(name);
        return enabled;
      }
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    hasAttribute(name) { return attributes.has(name); },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    append(...children) { children.forEach(child => this.appendChild(child)); },
    replaceChildren(...children) { this.textContent = ''; this.append(...children); },
    removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; return child; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    focus() {},
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      const found = [];
      for (const child of this.children) {
        if (selector === '*' || child.tagName?.toLowerCase() === selector.toLowerCase()) found.push(child);
        if (child.querySelectorAll) found.push(...child.querySelectorAll(selector));
      }
      return found;
    },
    getBoundingClientRect() { return { x: 0, y: 0, width: 320, height: 100 }; }
  });
  Object.defineProperties(node, {
    textContent: {
      get() { return ownText + this.children.map(child => child.textContent || '').join(''); },
      set(value) { ownText = String(value ?? ''); this.children = []; }
    },
    firstChild: { get() { return this.children[0] || null; } },
    childElementCount: { get() { return this.children.length; } }
  });
  return node;
}

async function settle() {
  // Flush the GPS callback, fetch and response.json promise chains.
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function setup({ stored = {}, geolocation = true, permission = 'prompt', inactiveFrame = false,
  authenticated = false, blockedRewardStorage = false, nowISO = '2026-11-26T12:00:00Z' } = {}) {
  let now = Date.parse(nowISO);
  let nextTimer = 0;
  const timers = new Map();
  const nodes = new Map();
  const storage = new Map(Object.entries(stored));
  const storageReads = [];
  const requests = [];
  const gps = [];
  const awards = [];
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  };
  const document = Object.assign(target(), {
    readyState: 'complete', visibilityState: 'visible', hidden: false,
    getElementById: get,
    createElement: tagName => element('', tagName),
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: element('html'), body: element('body')
  });
  const location = new URL('https://kawaiimuslimworld.com/Aujourd%27hui.dc.html' + (authenticated ? '' : '?guest=1'));
  location.replace = () => assert.fail('The prayer card must not redirect the user away');
  const localStorage = {
    getItem: key => {
      storageReads.push(key);
      if (blockedRewardStorage && key.startsWith('km-prayer-done:')) throw new Error('Storage access denied');
      return storage.get(key) ?? null;
    },
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  };
  const navigator = {
    onLine: true,
    permissions: { query: async () => Object.assign(target(), { state: permission }) }
  };
  if (geolocation) navigator.geolocation = {
    getCurrentPosition(success, error, options) { gps.push({ success, error, options }); }
  };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const setTimeout = (callback, delay = 0) => {
    const id = ++nextTimer;
    timers.set(id, { callback, due: now + Number(delay), delay: Number(delay) });
    return id;
  };
  const clearTimeout = id => timers.delete(id);
  const fetch = (url, options) => new Promise((resolve, reject) => {
    // Deliberately permit late completion after abort: request ordering must also
    // guard an already fulfilled response whose .json() is still pending.
    requests.push({ url: new URL(url, location.href), options,
      body: options?.body ? JSON.parse(options.body) : null, resolve, reject });
  });
  const window = Object.assign(target(), {
    location, document, navigator, localStorage,
    sessionStorage: localStorage, isSecureContext: true,
    matchMedia: () => ({ matches: true }),
    setTimeout, clearTimeout
  });
  const child = { id: 'child-test', type: 'child', name: 'Aya', avatar: 'a' };
  const KMAuth = authenticated ? {
    getContext: async () => ({ user: { id: 'parent-test' }, children: [child] }),
    validateActiveProfile: () => child,
    getStarShop: async () => ({ balance: 0 }),
    awardChildStars: args => new Promise((resolve, reject) => awards.push({ args, resolve, reject }))
  } : undefined;
  if (KMAuth) window.KMAuth = KMAuth;
  window.window = window;
  window.self = window;
  window.parent = window;
  if (inactiveFrame) {
    window.frameElement = element('appFrame');
    window.frameElement.setAttribute('aria-hidden', 'true');
  }
  const deviceIntl = Object.create(Intl);
  deviceIntl.DateTimeFormat = function (locale, options) {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: options?.timeZone || 'UTC' });
  };
  const context = vm.createContext({
    window, document, navigator, location, localStorage, sessionStorage: localStorage,
    setTimeout, clearTimeout, URL, URLSearchParams, Intl: deviceIntl, Date: ClockDate,
    AbortController, console, Event, fetch, KMAuth, isSecureContext: true,
    addEventListener: window.addEventListener.bind(window)
  });
  vm.runInContext(source, context, { filename: 'today-v2.js' });

  async function emit(subject, type) {
    subject.dispatchEvent({ type, preventDefault() {} });
    await settle();
  }
  async function advance(ms) {
    const until = now + ms;
    let count = 0;
    while (true) {
      const ready = [...timers].filter(([, t]) => t.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
      if (!ready) break;
      assert.ok(++count < 1000, 'Timers should not spin continuously');
      now = ready[1].due;
      timers.delete(ready[0]);
      ready[1].callback();
      await settle();
    }
    now = until;
    await settle();
  }
  const prayerRequests = () => requests.filter(request => request.url.origin === location.origin && request.url.pathname === '/api/prayer-times');
  const cityRequests = () => requests.filter(request => request.url.origin === location.origin && request.url.pathname === '/api/prayer-city');
  const searchRequests = () => requests.filter(request => request.url.origin === location.origin && request.url.pathname === '/api/prayer-cities');
  async function position(index = gps.length - 1, latitude = 48.9362, longitude = 2.3574) {
    assert.ok(gps[index], 'A position request should exist');
    gps[index].success({ coords: { latitude, longitude, accuracy: 100 }, timestamp: now });
    await settle();
  }
  async function deny(code = 1, index = gps.length - 1) {
    assert.ok(gps[index], 'A position request should exist');
    gps[index].error({ code, message: 'Position unavailable in test' });
    await settle();
  }
  async function answer(request = prayerRequests().at(-1), {
    zone = 'Europe/Paris', dhuhr = '12:37', asr = '14:43', date = '26-11-2026', timings
  } = {}) {
    assert.ok(request, 'An API request should exist');
    request.resolve({ ok: true, status: 200, json: async () => ({
      code: 200,
      data: {
        timings: timings || { Fajr: '06:47', Dhuhr: dhuhr, Asr: asr, Maghrib: '16:58', Isha: '18:32' },
        meta: { timezone: zone },
        date: { gregorian: { date } }
      }
    }) });
    await settle();
  }
  async function city(value) {
    await emit(get('prayerCityButton'), 'click');
    get('prayerCityInput').value = value;
    await submitFreeCity();
  }
  async function submitFreeCity() {
    await emit(get('prayerCityForm'), 'submit');
    const search = searchRequests().at(-1);
    if (search && !search.answered) await answerSearch([], search);
  }
  async function failPrayer(status, error, request = prayerRequests().at(-1)) {
    assert.ok(request, 'A prayer time request should exist');
    request.resolve({ ok: false, status, json: async () => ({ code: status, error }) });
    await settle();
  }
  async function suggest() {
    await emit(get('prayerApproxButton'), 'click');
    assert.equal(cityRequests().length, 1, 'City estimation should only be requested by its explicit control');
    return cityRequests()[0];
  }
  async function answerCity(request = cityRequests().at(-1), payload = { city: 'Paris', countryCode: 'FR', approximate: true }, ok = true) {
    assert.ok(request, 'A city estimation request should exist');
    request.resolve({ ok, status: ok ? 200 : 503, json: async () => payload });
    await settle();
  }
  async function typeCity(value) {
    get('prayerCityInput').value = value;
    await emit(get('prayerCityInput'), 'input');
  }
  async function answerSearch(results = [], request = searchRequests().at(-1), ok = true) {
    assert.ok(request, 'A city search request should exist');
    request.answered = true;
    request.resolve({ ok, status: ok ? 200 : 503, json: async () => ({ results, source: request.body.scope }) });
    await settle();
  }
  const suggestionButtons = () => get('prayerCitySuggestions').querySelectorAll('button');
  return { get, storage, storageReads, gps, requests, awards, prayerRequests, cityRequests, searchRequests, document, window,
    emit, advance, position, deny, answer, city, suggest, answerCity, failPrayer,
    typeCity, answerSearch, suggestionButtons, submitFreeCity };
}

test('a new guest requests their position and never loads the former Casablanca default', async () => {
  const app = setup();
  await settle();
  assert.equal(app.gps.length, 1);
  assert.equal(app.prayerRequests().length, 0);
  assert.equal(app.get('prayerApproxButton').hidden, true);
  assert.doesNotMatch(app.get('prayerCityLabel').textContent, /Casablanca|Maroc/);
});

test('GPS success posts coordinates privately to the same-origin endpoint and renders the local prayer time', async () => {
  const app = setup();
  await settle();
  await app.position();
  const request = app.prayerRequests().at(-1);
  assert.equal(request.url.href, 'https://kawaiimuslimworld.com/api/prayer-times');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'same-origin');
  assert.equal(request.options.cache, 'no-store');
  assert.match(new Headers(request.options.headers).get('Content-Type'), /^application\/json/);
  assert.equal(new Headers(request.options.headers).get('Accept'), 'application/json');
  assert.equal(request.body.date, '2026-11-26');
  assert.ok(Math.abs(Number(request.body.latitude) - 48.9362) < 0.001);
  assert.ok(Math.abs(Number(request.body.longitude) - 2.3574) < 0.001);
  assert.equal(Object.hasOwn(request.body, 'city'), false);
  assert.equal(app.requests.some(item => item.url.hostname === 'api.aladhan.com'), false);
  await app.answer();
  assert.match(app.get('prayerTitle').textContent, /Dhohr.*12:37/);
  assert.equal(app.get('prayerCityForm').hidden, true);
  assert.equal(app.get('prayerLocateButton').disabled, false);
  assert.doesNotMatch(JSON.stringify([...app.storage]), /48\.9362|2\.3574|latitude|longitude/);
});

for (const code of [1, 2, 3]) {
  test(`GPS error ${code} presents a usable city fallback without showing Morocco`, async () => {
    const app = setup();
    await settle();
    await app.deny(code);
    assert.equal(app.get('prayerCityForm').hidden, false);
    assert.ok(app.get('prayerStatus').textContent.trim());
    assert.equal(app.get('prayerLocateButton').disabled, false);
    assert.equal(app.get('prayerDone').hidden, true);
    assert.equal(app.prayerRequests().length, 0);
    assert.equal(app.requests.length, 0, 'GPS failure must not trigger city estimation automatically');
    assert.equal(app.get('prayerApproxButton').hidden, code === 1);
    assert.doesNotMatch(app.get('prayerCityLabel').textContent, /Casablanca|Maroc/);
  });
}

test('an unresponsive native location request eventually releases the location control', async () => {
  const app = setup();
  await settle();
  await app.advance(21000);
  assert.equal(app.get('prayerLocateButton').disabled, false);
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.ok(app.get('prayerStatus').textContent.trim());
  assert.equal(app.prayerRequests().length, 0);
  assert.equal(app.requests.length, 0);
  const timedOut = setup();
  await settle();
  await timedOut.deny(3);
  assert.notEqual(app.get('prayerStatus').textContent, timedOut.get('prayerStatus').textContent,
    'Waiting for an unanswered permission prompt must not be reported as an actual GPS timeout');
});

test('a browser without GPS offers manual city selection', async () => {
  const app = setup({ geolocation: false });
  await settle();
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.ok(app.get('prayerStatus').textContent.trim());
  assert.equal(app.get('prayerApproxButton').hidden, false);
  assert.equal(app.requests.length, 0);
  await app.city('Saint-Denis, France');
  const request = app.prayerRequests().at(-1);
  assert.equal(request.url.pathname, '/api/prayer-times');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.body.city, 'Saint-Denis, France');
  assert.equal(request.body.date, '2026-11-26');
  assert.equal(Object.hasOwn(request.body, 'latitude'), false);
  assert.equal(request.url.search, '');
  await app.answer();
  assert.equal(app.get('prayerCityLabel').textContent, 'Saint-Denis, France');
  assert.equal(app.storage.get('km-prayer-city:guest'), 'Saint-Denis, France');
});

test('an explicit manual city remains selected on the next visit', async () => {
  const first = setup();
  await settle();
  await first.deny();
  await first.city('Lyon, France');
  await first.answer();
  const second = setup({ stored: Object.fromEntries(first.storage) });
  await settle();
  assert.equal(second.gps.length, 0);
  const request = second.prayerRequests().at(-1);
  assert.equal(request.body.city, 'Lyon, France');
  await second.answer();
  assert.equal(second.get('prayerCityLabel').textContent, 'Lyon, France');
});

test('a late GPS result cannot overwrite a city chosen while location was pending', async () => {
  const app = setup();
  await settle();
  await app.city('Lyon, France');
  await app.answer();
  const count = app.prayerRequests().length;
  await app.position(0, 33.5731, -7.5898);
  assert.equal(app.prayerRequests().length, count);
  assert.equal(app.get('prayerCityLabel').textContent, 'Lyon, France');
  assert.match(app.get('prayerTitle').textContent, /12:37/);
});

test('a slow prayer response for the GPS location cannot replace newer manual timings', async () => {
  const app = setup();
  await settle();
  await app.position();
  const oldRequest = app.prayerRequests().at(-1);
  await app.city('Lyon, France');
  await app.answer(undefined, { dhuhr: '12:22' });
  await app.answer(oldRequest, { dhuhr: '12:37' });
  assert.equal(app.get('prayerCityLabel').textContent, 'Lyon, France');
  assert.match(app.get('prayerTitle').textContent, /12:22/);
});

test('resume does not ask again after location permission was refused', async () => {
  const app = setup();
  await settle();
  await app.deny();
  await app.emit(app.window, 'pageshow');
  await app.emit(app.document, 'km-app-active');
  await app.emit(app.document, 'visibilitychange');
  assert.equal(app.gps.length, 1);
  assert.equal(app.get('prayerCityForm').hidden, false);
  const reloaded = setup({ stored: Object.fromEntries(app.storage) });
  await settle();
  assert.equal(reloaded.gps.length, 0);
  assert.equal(reloaded.get('prayerCityForm').hidden, false);
});

test('the location button lets a manual-city user switch back to GPS', async () => {
  const app = setup();
  await settle();
  await app.deny();
  await app.city('Lyon, France');
  await app.answer();
  await app.emit(app.get('prayerLocateButton'), 'click');
  assert.equal(app.gps.length, 2);
  await app.position(1, 43.2965, 5.3698);
  assert.ok(Math.abs(Number(app.prayerRequests().at(-1).body.latitude) - 43.2965) < 0.001);
  await app.answer();
  assert.notEqual(app.get('prayerCityLabel').textContent, 'Lyon, France');
});

test('an inactive preloaded home frame waits until the user visits it to request GPS', async () => {
  const app = setup({ inactiveFrame: true });
  await settle();
  assert.equal(app.gps.length, 0);
  assert.equal(app.prayerRequests().length, 0);
  await app.emit(app.document, 'km-app-active');
  assert.equal(app.gps.length, 1);
});

test('returning after a minute obtains a fresh position without duplicating requests', async () => {
  const app = setup();
  await settle();
  await app.position();
  await app.answer();
  await app.emit(app.document, 'km-app-inactive');
  await app.advance(61000);
  assert.equal(app.gps.length, 1);
  assert.equal(app.prayerRequests().length, 1);
  await app.emit(app.document, 'km-app-active');
  await app.emit(app.window, 'pageshow');
  assert.equal(app.gps.length, 2);
  await app.position(1, 43.2965, 5.3698);
  assert.equal(app.prayerRequests().length, 2);
});

test('a short trip to another section does not permanently stop prayer refreshes', async () => {
  const app = setup();
  await settle();
  await app.position();
  await app.answer();
  await app.advance(10000);
  await app.emit(app.document, 'km-app-inactive');
  await app.advance(10000);
  await app.emit(app.document, 'km-app-active');
  await app.advance(60000);
  assert.ok(app.prayerRequests().length >= 2, 'The minute refresh must resume after returning to the home section');
});

for (const pending of ['GPS', 'timings']) {
test(`opening the city editor cancels pending ${pending} before a city is submitted`, async () => {
  const app = setup();
  await settle();
  if (pending === 'timings') await app.position();
  await app.emit(app.get('prayerCityButton'), 'click');
  app.get('prayerCityInput').value = 'Saint-D';
  await app.emit(app.get('prayerCityInput'), 'input');
  if (pending === 'timings') await app.answer();
  else await app.position();
  assert.equal(app.prayerRequests().length, pending === 'timings' ? 1 : 0);
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.equal(app.get('prayerCityInput').value, 'Saint-D');
  assert.equal(app.get('prayerLocateButton').disabled, false);
  assert.doesNotMatch(app.get('prayerTitle').textContent, /Dhohr/);
});
}

test('editing pauses automatic refreshes and cancelling restores the selected location', async () => {
  const app = setup();
  await settle();
  await app.position();
  await app.answer();
  await app.emit(app.get('prayerCityButton'), 'click');
  app.get('prayerCityInput').value = 'Saint-D';
  await app.emit(app.get('prayerCityInput'), 'input');
  await app.advance(310000);
  await app.emit(app.document, 'km-app-active');
  assert.equal(app.gps.length, 1);
  assert.equal(app.prayerRequests().length, 1);
  assert.equal(app.get('prayerCityInput').value, 'Saint-D');
  assert.equal(app.get('prayerCityForm').hidden, false);
  await app.emit(app.get('prayerCityCancel'), 'click');
  assert.equal(app.get('prayerCityForm').hidden, true);
  assert.equal(app.prayerRequests().length, 2);
  assert.equal(Object.hasOwn(app.prayerRequests()[1].body, 'latitude'), true);
  await app.answer();
  assert.match(app.get('prayerTitle').textContent, /Dhohr.*12:37/);
});

for (const finishWhileLoading of [true, false]) {
  test(`a delayed reward stays attached to the prayer clicked before a location change; loading = ${finishWhileLoading}`, async () => {
    const app = setup({ authenticated: true });
    await settle();
    await app.position();
    await app.answer();
    assert.match(app.get('prayerTitle').textContent, /Dhohr/);
    await app.emit(app.get('prayerDone'), 'click');
    assert.equal(app.awards.length, 1);
    assert.equal(app.awards[0].args.sourceKey, 'prayer:2026-11-26:Dhuhr');
    await app.city('Lyon, France');
    if (!finishWhileLoading) await app.answer(undefined, { asr: '12:55' });
    app.awards[0].resolve({ awarded: 2, balance: 2, reason: 'earned' });
    await settle();
    assert.equal(app.storage.get('km-prayer-done:child-test:2026-11-26:Dhuhr'), '1');
    assert.equal(app.storage.has('km-prayer-done:child-test:2026-11-26:Asr'), false);
    assert.equal(app.get('prayerReward').textContent, '');
    if (finishWhileLoading) await app.answer(undefined, { asr: '12:55' });
    assert.match(app.get('prayerTitle').textContent, /Asr.*12:55/);
    assert.equal(app.get('prayerDone').hidden, false);
    assert.equal(app.get('prayerDone').disabled, false);
  });
}

test('the request switches calendar day when the detected timezone has already passed midnight', async () => {
  const app = setup({ nowISO: '2026-11-26T23:30:00Z' });
  await settle();
  await app.position();
  assert.equal(app.prayerRequests()[0].body.date, '2026-11-26');
  await app.answer(undefined, { zone: 'Europe/Paris', date: '26-11-2026' });
  assert.equal(app.prayerRequests().length, 2);
  assert.equal(app.prayerRequests()[1].body.date, '2026-11-27');
  await app.answer(undefined, { zone: 'Europe/Paris', date: '27-11-2026' });
  assert.match(app.get('prayerTitle').textContent, /Fajr.*06:47/);
  assert.equal(app.get('prayerEyebrow').textContent, 'PROCHAINE PRIÈRE');
});

test('an estimated city is requested explicitly and requires confirmation before loading prayer times', async () => {
  const app = setup();
  await settle();
  await app.deny(2);
  const saved = [...app.storage];
  assert.equal(app.cityRequests().length, 0);
  await app.suggest();
  await app.answerCity();
  assert.equal(app.get('prayerCityInput').value, 'Paris, France');
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.match(app.get('prayerStatus').textContent, /estimée/i);
  assert.match(app.get('prayerStatus').textContent, /vérifie/i);
  assert.match(app.get('prayerStatus').textContent, /Afficher/i);
  assert.equal(app.prayerRequests().length, 0);
  assert.deepEqual([...app.storage], saved);
  await app.submitFreeCity();
  assert.equal(app.prayerRequests().length, 1);
  assert.equal(app.prayerRequests()[0].body.city, 'Paris, France');
  await app.answer();
  assert.equal(app.storage.get('km-prayer-city:guest'), 'Paris, France');
  assert.equal(app.get('prayerCityLabel').textContent, 'Paris, France');
});

test('a delayed city suggestion cannot overwrite text the user has begun typing', async () => {
  const app = setup();
  await settle();
  await app.deny(2);
  const saved = [...app.storage];
  await app.suggest();
  app.get('prayerCityInput').value = 'Saint-Denis, France';
  await app.emit(app.get('prayerCityInput'), 'input');
  await app.answerCity();
  assert.equal(app.get('prayerCityInput').value, 'Saint-Denis, France');
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.equal(app.prayerRequests().length, 0);
  assert.deepEqual([...app.storage], saved);
  assert.doesNotMatch(app.get('prayerStatus').textContent, /Paris/);
});

test('a delayed city suggestion cannot replace a city already submitted by the user', async () => {
  const app = setup();
  await settle();
  await app.deny(3);
  await app.suggest();
  await app.city('Lyon, France');
  await app.answer();
  await app.answerCity();
  assert.equal(app.get('prayerCityLabel').textContent, 'Lyon, France');
  assert.equal(app.storage.get('km-prayer-city:guest'), 'Lyon, France');
  assert.equal(app.prayerRequests().length, 1);
  assert.equal(app.get('prayerCityForm').hidden, true);
  assert.doesNotMatch(app.get('prayerStatus').textContent, /Paris/);
});

test('an unavailable city estimation service keeps the manual fallback usable', async () => {
  const app = setup({ geolocation: false });
  await settle();
  const saved = [...app.storage];
  await app.suggest();
  await app.answerCity(undefined, { error: 'city_unavailable' }, false);
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.equal(app.get('prayerApproxButton').disabled, false);
  assert.ok(app.get('prayerStatus').textContent.trim());
  assert.equal(app.prayerRequests().length, 0);
  assert.deepEqual([...app.storage], saved);
  await app.city('Saint-Denis, France');
  await app.answer();
  assert.equal(app.get('prayerCityLabel').textContent, 'Saint-Denis, France');
});

for (const [status, error] of [[422, 'location_not_found'], [502, 'timings_unavailable'], [504, 'timings_timeout']]) {
  test(`a prayer server error ${status} allows a manual retry without exposing technical errors`, async () => {
    const app = setup();
    await settle();
    await app.deny(2);
    await app.city('Montreuil');
    await app.failPrayer(status, error);
    assert.equal(app.get('prayerCityForm').hidden, false);
    assert.equal(app.get('prayerDone').hidden, true);
    assert.ok(app.get('prayerStatus').textContent.trim());
    assert.doesNotMatch(app.get('prayerStatus').textContent, /timings_|location_not_found|api\.aladhan|502|504/);
    await app.city('Montreuil, France');
    assert.equal(app.prayerRequests().length, 2);
    assert.equal(app.prayerRequests()[1].body.city, 'Montreuil, France');
    assert.equal(app.prayerRequests()[1].options.method, 'POST');
    await app.answer();
    assert.match(app.get('prayerTitle').textContent, /Dhohr.*12:37/);
    assert.equal(app.get('prayerCityLabel').textContent, 'Montreuil, France');
    assert.equal(app.get('prayerStatus').textContent, '');
    assert.equal(app.get('prayerCityForm').hidden, true);
  });
}

for (const [name, timings] of [
  ['invalid hour', { Fajr: '25:00', Dhuhr: '12:37', Asr: '14:43', Maghrib: '16:58', Isha: '18:32' }],
  ['missing prayer', { Fajr: '06:47', Dhuhr: '12:37', Asr: '14:43', Maghrib: '16:58' }]
]) {
  test(`a successful HTTP response with ${name} cannot display a usable prayer schedule`, async () => {
    const app = setup();
    await settle();
    await app.position();
    await app.answer(undefined, { timings });
    assert.equal(app.get('prayerTitle').textContent, 'Horaires indisponibles');
    assert.equal(app.get('prayerDone').hidden, true);
    assert.equal(app.get('prayerCityForm').hidden, false);
    assert.ok(app.get('prayerStatus').textContent.trim());
  });
}

test('a response for a different date is not presented as today’s prayer schedule', async () => {
  const app = setup();
  await settle();
  await app.position();
  assert.equal(app.prayerRequests()[0].body.date, '2026-11-26');
  await app.answer(undefined, { date: '25-11-2026' });
  assert.equal(app.get('prayerTitle').textContent, 'Horaires indisponibles');
  assert.equal(app.get('prayerDone').hidden, true);
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.ok(app.get('prayerStatus').textContent.trim());
});

test('the retry button reuses the detected coordinates without requesting GPS again', async () => {
  const app = setup();
  await settle();
  await app.position();
  const initialPayload = app.prayerRequests()[0].body;
  await app.failPrayer(502, 'timings_unavailable');
  assert.equal(app.get('prayerRetryButton').hidden, false);
  await app.emit(app.get('prayerRetryButton'), 'click');
  assert.equal(app.gps.length, 1);
  assert.equal(app.prayerRequests().length, 2);
  assert.deepEqual(app.prayerRequests()[1].body, initialPayload);
  assert.equal(app.get('prayerCityForm').hidden, true);
  await app.answer();
  assert.match(app.get('prayerTitle').textContent, /Dhohr.*12:37/);
  assert.equal(app.get('prayerStatus').textContent, '');
  assert.equal(app.get('prayerRetryButton').hidden, true);
});

test('blocked access to saved prayer rewards does not hide otherwise valid prayer times', async () => {
  const app = setup({ authenticated: true, blockedRewardStorage: true });
  await settle();
  await app.position();
  await app.answer();
  assert.ok(app.storageReads.some(key => key.startsWith('km-prayer-done:')));
  assert.match(app.get('prayerTitle').textContent, /Dhohr.*12:37/);
  assert.equal(app.get('prayerDone').hidden, false);
  assert.equal(app.get('prayerStatus').textContent, '');
  assert.equal(app.get('prayerCityForm').hidden, true);
});

const saintDenis93 = {
  id: 'fr:93066', label: 'Saint-Denis · Seine-Saint-Denis (93), France',
  latitude: 48.9378, longitude: 2.3657, countryCode: 'FR', departmentCode: '93'
};
const saintDenisReunion = {
  id: 'fr:97411', label: 'Saint-Denis · La Réunion (974), France',
  latitude: -20.882, longitude: 55.45, countryCode: 'FR', departmentCode: '974'
};
const paris = {
  id: 'fr:75056', label: 'Paris · Paris (75), France',
  latitude: 48.8566, longitude: 2.3522, countryCode: 'FR', departmentCode: '75'
};

async function selectSaintDenis(app) {
  await app.typeCity('Saint Denis');
  await app.advance(350);
  await app.answerSearch([saintDenis93, saintDenisReunion]);
  const button = app.suggestionButtons().find(item => item.textContent.includes('Seine-Saint-Denis'));
  assert.ok(button, 'The department should identify the desired Saint-Denis');
  assert.equal(button.type, 'button');
  await app.emit(button, 'click');
}

test('city searches wait for three characters and debounce quick typing to the final query', async () => {
  const app = setup({ geolocation: false });
  await settle();
  await app.typeCity('Sa');
  await app.advance(500);
  assert.equal(app.searchRequests().length, 0);
  await app.typeCity('Sai');
  await app.advance(200);
  await app.typeCity('Saint');
  await app.advance(200);
  await app.typeCity('Saint Denis');
  await app.advance(349);
  assert.equal(app.searchRequests().length, 0);
  await app.advance(1);
  assert.equal(app.searchRequests().length, 1);
  const request = app.searchRequests()[0];
  assert.deepEqual(request.body, { query: 'Saint Denis', scope: 'fr' });
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'same-origin');
  assert.equal(request.options.cache, 'no-store');
  assert.match(new Headers(request.options.headers).get('Content-Type'), /^application\/json/);
  await app.typeCity('');
  await app.answerSearch([saintDenis93], request);
  assert.equal(app.suggestionButtons().length, 0);
  assert.equal(app.prayerRequests().length, 0);
});

test('submitting an ambiguous name asks the user to choose a city without selecting the first result', async () => {
  const app = setup({ geolocation: false });
  await settle();
  const saved = [...app.storage];
  await app.typeCity('Saint Denis');
  await app.emit(app.get('prayerCityForm'), 'submit');
  assert.equal(app.searchRequests().length, 1, 'Submitting should search immediately');
  await app.advance(350);
  assert.equal(app.searchRequests().length, 1, 'The pending debounce must not duplicate the submit search');
  await app.answerSearch([saintDenis93, saintDenisReunion]);
  assert.equal(app.suggestionButtons().length, 2);
  assert.ok(app.suggestionButtons().some(button => button.textContent.includes('Seine-Saint-Denis (93)')));
  assert.ok(app.suggestionButtons().some(button => button.textContent.includes('La Réunion (974)')));
  assert.equal(app.get('prayerCityInput').value, 'Saint Denis');
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.equal(app.prayerRequests().length, 0);
  assert.deepEqual([...app.storage], saved);
});

test('an explicit city choice uses coordinates and persists across refreshes and child profiles without GPS', async () => {
  const app = setup();
  await settle();
  await app.deny(2);
  await selectSaintDenis(app);
  const request = app.prayerRequests().at(-1);
  assert.deepEqual(request.body, {
    date: '2026-11-26', latitude: saintDenis93.latitude, longitude: saintDenis93.longitude, cityId: saintDenis93.id
  });
  const savedPlace = JSON.parse(app.storage.get('km-prayer-place:v1'));
  assert.equal(savedPlace.version, 1);
  assert.equal(savedPlace.kind, 'manual');
  assert.equal(savedPlace.label, saintDenis93.label);
  assert.equal(savedPlace.city, saintDenis93.label);
  assert.equal(savedPlace.latitude, saintDenis93.latitude);
  assert.equal(savedPlace.longitude, saintDenis93.longitude);
  assert.equal(savedPlace.cityId, saintDenis93.id);
  assert.equal(app.storage.get('km-prayer-location-mode:v1'), 'manual');
  await app.answer();
  assert.equal(app.get('prayerCityLabel').textContent, saintDenis93.label);
  assert.equal(app.get('prayerCityForm').hidden, true);
  await app.advance(61000);
  assert.equal(app.gps.length, 1);
  assert.equal(app.prayerRequests().at(-1).body.cityId, saintDenis93.id);
  assert.equal(app.prayerRequests().at(-1).body.latitude, saintDenis93.latitude);
  for (const authenticated of [false, true]) {
    const reloaded = setup({ authenticated, stored: Object.fromEntries(app.storage) });
    await settle();
    assert.equal(reloaded.gps.length, 0);
    assert.equal(reloaded.prayerRequests().at(-1).body.cityId, saintDenis93.id);
    assert.equal(reloaded.prayerRequests().at(-1).body.latitude, saintDenis93.latitude);
    await reloaded.answer();
    assert.equal(reloaded.get('prayerCityLabel').textContent, saintDenis93.label);
  }
});

test('an old city-search response cannot replace results for a newer query', async () => {
  const app = setup({ geolocation: false });
  await settle();
  await app.typeCity('Saint Denis');
  await app.advance(350);
  const oldSearch = app.searchRequests()[0];
  await app.typeCity('Paris');
  await app.advance(350);
  const newSearch = app.searchRequests()[1];
  await app.answerSearch([paris], newSearch);
  await app.answerSearch([saintDenis93, saintDenisReunion], oldSearch);
  assert.equal(app.get('prayerCityInput').value, 'Paris');
  assert.equal(app.suggestionButtons().length, 1);
  assert.equal(app.suggestionButtons()[0].textContent, paris.label);
  assert.equal(app.prayerRequests().length, 0);
});

for (const action of ['cancel', 'GPS']) {
  test(`a city-search response cannot reopen the editor after ${action}`, async () => {
    const app = setup();
    await settle();
    await app.deny(2);
    await app.typeCity('Saint Denis');
    await app.advance(350);
    const search = app.searchRequests()[0];
    await app.emit(app.get(action === 'cancel' ? 'prayerCityCancel' : 'prayerLocateButton'), 'click');
    await app.answerSearch([saintDenis93, saintDenisReunion], search);
    assert.equal(app.get('prayerCityForm').hidden, true);
    assert.equal(app.suggestionButtons().length, 0);
    assert.equal(app.prayerRequests().length, 0);
    assert.equal(app.gps.length, action === 'GPS' ? 2 : 1);
  });
}

test('editing a selected city discards its coordinates before a free-text submission', async () => {
  const app = setup({ geolocation: false });
  await settle();
  await selectSaintDenis(app);
  await app.answer();
  await app.emit(app.get('prayerCityButton'), 'click');
  await app.typeCity('Autre ville, France');
  await app.emit(app.get('prayerCityForm'), 'submit');
  await app.answerSearch([]);
  const request = app.prayerRequests().at(-1);
  assert.equal(request.body.city, 'Autre ville, France');
  assert.equal(Object.hasOwn(request.body, 'latitude'), false);
  assert.equal(Object.hasOwn(request.body, 'longitude'), false);
  assert.equal(Object.hasOwn(request.body, 'cityId'), false);
  await app.answer();
  const reloaded = setup({ stored: Object.fromEntries(app.storage) });
  await settle();
  assert.equal(reloaded.prayerRequests().at(-1).body.city, 'Autre ville, France');
  assert.equal(Object.hasOwn(reloaded.prayerRequests().at(-1).body, 'cityId'), false);
});

test('unresolved free text preserves the last confirmed city until valid timings are returned', async () => {
  const app = setup({ geolocation: false });
  await settle();
  await selectSaintDenis(app);
  await app.answer();
  const confirmed = Object.fromEntries(app.storage);
  await app.emit(app.get('prayerCityButton'), 'click');
  await app.typeCity('Ville introuvable, France');
  await app.submitFreeCity();
  assert.deepEqual(Object.fromEntries(app.storage), confirmed, 'A pending lookup must not replace the saved city');
  await app.failPrayer(422, 'location_not_found');
  assert.deepEqual(Object.fromEntries(app.storage), confirmed, 'A rejected city must leave the last valid preference intact');
  const reloaded = setup({ stored: Object.fromEntries(app.storage) });
  await settle();
  assert.equal(reloaded.gps.length, 0);
  assert.equal(reloaded.prayerRequests().at(-1).body.cityId, saintDenis93.id);

  await app.typeCity('Rabat, Maroc');
  await app.submitFreeCity();
  assert.deepEqual(Object.fromEntries(app.storage), confirmed);
  await app.answer(undefined, { zone: 'Africa/Casablanca' });
  assert.equal(JSON.parse(app.storage.get('km-prayer-place:v1')).city, 'Rabat, Maroc');
  assert.equal(app.storage.get('km-prayer-city:guest'), 'Rabat, Maroc');
  assert.equal(app.storage.get('km-prayer-location-mode:v1'), 'manual');
});

test('an ambiguous legacy city opens department choices without saving an arbitrary location', async () => {
  const legacy = { 'km-prayer-city:guest': 'Saint-Denis, France', 'km-prayer-mode:guest': 'manual' };
  const app = setup({ stored: legacy });
  await settle();
  assert.equal(app.gps.length, 0);
  assert.equal(app.prayerRequests()[0].body.city, 'Saint-Denis, France');
  assert.deepEqual(Object.fromEntries(app.storage), legacy);
  await app.failPrayer(422, 'location_ambiguous');
  assert.equal(app.get('prayerCityForm').hidden, false);
  assert.equal(app.get('prayerTitle').textContent, 'Choisis ta ville');
  assert.match(app.get('prayerStatus').textContent, /département/);
  assert.equal(app.get('prayerRetryButton').hidden, true);
  assert.deepEqual(app.searchRequests().at(-1).body, { query: 'Saint-Denis, France', scope: 'fr' });
  await app.answerSearch([saintDenis93, saintDenisReunion]);
  assert.equal(app.suggestionButtons().length, 2);
  assert.deepEqual(Object.fromEntries(app.storage), legacy);
  const choice = app.suggestionButtons().find(button => button.textContent.includes('Seine-Saint-Denis'));
  await app.emit(choice, 'click');
  assert.equal(app.prayerRequests().at(-1).body.cityId, saintDenis93.id);
  assert.equal(JSON.parse(app.storage.get('km-prayer-place:v1')).cityId, saintDenis93.id,
    'A real catalogue choice is remembered before the prayer service responds');
});

for (const available of [true, false]) {
  test(`free-text submission still loads prayer times when city search ${available ? 'has no results' : 'is unavailable'}`, async () => {
    const app = setup({ geolocation: false });
    await settle();
    await app.typeCity('Montreuil, France');
    await app.emit(app.get('prayerCityForm'), 'submit');
    await app.answerSearch([], undefined, available);
    assert.equal(app.prayerRequests().length, 1);
    assert.equal(app.prayerRequests()[0].body.city, 'Montreuil, France');
    await app.answer();
    assert.equal(app.get('prayerCityLabel').textContent, 'Montreuil, France');
  });
}

test('the other-countries control switches the explicit search scope and can return to France', async () => {
  const app = setup({ geolocation: false });
  await settle();
  await app.typeCity('Rabat');
  await app.advance(350);
  assert.equal(app.searchRequests().at(-1).body.scope, 'fr');
  await app.emit(app.get('prayerCityWorld'), 'click');
  await app.advance(350);
  assert.equal(app.searchRequests().at(-1).body.scope, 'world');
  assert.equal(app.searchRequests().at(-1).body.query, 'Rabat');
  assert.match(app.get('prayerCityWorld').textContent, /Chercher en France/);
  await app.answerSearch([]);
  await app.emit(app.get('prayerCityWorld'), 'click');
  await app.advance(350);
  assert.equal(app.searchRequests().at(-1).body.scope, 'fr');
  assert.match(app.get('prayerCityWorld').textContent, /Autres pays/);
  assert.equal(app.prayerRequests().length, 0);
});

for (const hasCurrentPoster of [true, false]) {
  test(`a new official month ${hasCurrentPoster ? 'displays its published poster' : 'offers the official link when not published'} and keeps the chosen city`, async () => {
    const savedPlace = { version: 1, kind: 'manual', city: saintDenis93.label, label: saintDenis93.label,
      latitude: saintDenis93.latitude, longitude: saintDenis93.longitude, cityId: saintDenis93.id };
    const app = setup({ nowISO: '2026-12-01T12:00:00Z', stored: {
      'km-prayer-place:v1': JSON.stringify(savedPlace), 'km-prayer-location-mode:v1': 'manual'
    } });
    await settle();
    const imageUrl = 'https://static.wixstatic.com/media/official_calendar_fixture.jpg';
    app.prayerRequests()[0].resolve({ ok: true, status: 200, json: async () => ({ code: 200, data: {
      presentation: 'official-calendar',
      calendar: hasCurrentPoster ? { imageUrl, month: '2026-12', label: 'décembre 2026',
        validFrom: '2026-12-01', validUntil: '2026-12-31' } : null,
      meta: { timezone: 'Europe/Paris', source: { id: 'gmp-calendar', label: 'Grande Mosquée de Paris · calendrier officiel' } },
      date: { gregorian: { date: '01-12-2026' } }
    } }) });
    await settle();
    assert.equal(app.gps.length, 0);
    assert.equal(app.get('prayerCityLabel').textContent, saintDenis93.label);
    assert.equal(app.get('prayerTitle').textContent, 'Horaires de la mosquée');
    assert.equal(app.get('prayerDone').hidden, true, 'No invented current prayer or reward without verified numeric times');
    assert.equal(app.get('prayerCountdown').textContent, '');
    assert.equal(app.get('prayerCalendar').hidden, !hasCurrentPoster);
    assert.equal(app.get('prayerSource').querySelector('a').href, 'https://www.grandemosqueedeparis.fr/horaire-des-prieres-paris');
    assert.equal(app.get('prayerCityForm').hidden, true, 'Changing month does not make users choose their city again');
    assert.equal(JSON.parse(app.storage.get('km-prayer-place:v1')).cityId, saintDenis93.id);
    if (hasCurrentPoster) {
      assert.equal(app.get('prayerCalendar').querySelector('img').src, imageUrl);
      assert.match(app.get('prayerStatus').textContent, /décembre 2026/);
    } else {
      assert.equal(app.get('prayerCalendar').querySelector('img'), null);
      assert.match(app.get('prayerStatus').textContent, /pas encore disponible/);
    }
  });
}
