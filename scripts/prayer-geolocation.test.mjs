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
      for (const callback of listeners.get(event.type) || []) callback.call(this, event);
      return true;
    }
  };
}

function element(id) {
  const attributes = new Map();
  const classes = new Set();
  return Object.assign(target(), {
    id, textContent: '', value: '', hidden: ['prayerCityForm', 'prayerDone', 'prayerApproxButton'].includes(id),
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
    focus() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 320, height: 100 }; }
  });
}

async function settle() {
  // Flush the GPS callback, fetch and response.json promise chains.
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function setup({ stored = {}, geolocation = true, permission = 'prompt', inactiveFrame = false,
  authenticated = false, nowISO = '2026-11-26T12:00:00Z' } = {}) {
  let now = Date.parse(nowISO);
  let nextTimer = 0;
  const timers = new Map();
  const nodes = new Map();
  const storage = new Map(Object.entries(stored));
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
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: element('html'), body: element('body')
  });
  const location = new URL('https://kawaiimuslimworld.com/Aujourd%27hui.dc.html' + (authenticated ? '' : '?guest=1'));
  location.replace = () => assert.fail('The prayer card must not redirect the user away');
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
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
    requests.push({ url: new URL(url, location.href), options, resolve, reject });
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
  const prayerRequests = () => requests.filter(request => request.url.hostname === 'api.aladhan.com');
  const cityRequests = () => requests.filter(request => request.url.origin === location.origin && request.url.pathname === '/api/prayer-city');
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
    zone = 'Europe/Paris', dhuhr = '12:37', asr = '14:43', date = '26-11-2026'
  } = {}) {
    assert.ok(request, 'An API request should exist');
    request.resolve({ ok: true, status: 200, json: async () => ({
      code: 200,
      data: {
        timings: { Fajr: '06:47', Dhuhr: dhuhr, Asr: asr, Maghrib: '16:58', Isha: '18:32' },
        meta: { timezone: zone },
        date: { gregorian: { date } }
      }
    }) });
    await settle();
  }
  async function city(value) {
    await emit(get('prayerCityButton'), 'click');
    get('prayerCityInput').value = value;
    await emit(get('prayerCityForm'), 'submit');
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
  return { get, storage, gps, requests, awards, prayerRequests, cityRequests, document, window,
    emit, advance, position, deny, answer, city, suggest, answerCity };
}

test('a new guest requests their position and never loads the former Casablanca default', async () => {
  const app = setup();
  await settle();
  assert.equal(app.gps.length, 1);
  assert.equal(app.prayerRequests().length, 0);
  assert.equal(app.get('prayerApproxButton').hidden, true);
  assert.doesNotMatch(app.get('prayerCityLabel').textContent, /Casablanca|Maroc/);
});

test('GPS success uses the detected coordinates and renders the local prayer time', async () => {
  const app = setup();
  await settle();
  await app.position();
  const request = app.prayerRequests().at(-1);
  assert.match(request.url.pathname, /^\/v1\/timings\/\d{2}-\d{2}-\d{4}$/);
  assert.ok(Math.abs(Number(request.url.searchParams.get('latitude')) - 48.9362) < 0.001);
  assert.ok(Math.abs(Number(request.url.searchParams.get('longitude')) - 2.3574) < 0.001);
  assert.equal(request.url.searchParams.get('method'), '3');
  assert.equal(request.url.searchParams.has('address'), false);
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
  assert.match(request.url.pathname, /\/timingsByAddress(?:\/|$)/);
  assert.equal(request.url.searchParams.get('address'), 'Saint-Denis, France');
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
  assert.equal(request.url.searchParams.get('address'), 'Lyon, France');
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
  assert.ok(Math.abs(Number(app.prayerRequests().at(-1).url.searchParams.get('latitude')) - 43.2965) < 0.001);
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
  assert.equal(app.prayerRequests()[1].url.searchParams.has('latitude'), true);
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
  assert.equal(app.prayerRequests()[0].url.pathname, '/v1/timings/26-11-2026');
  await app.answer(undefined, { zone: 'Europe/Paris', date: '26-11-2026' });
  assert.equal(app.prayerRequests().length, 2);
  assert.equal(app.prayerRequests()[1].url.pathname, '/v1/timings/27-11-2026');
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
  await app.emit(app.get('prayerCityForm'), 'submit');
  assert.equal(app.prayerRequests().length, 1);
  assert.equal(app.prayerRequests()[0].url.searchParams.get('address'), 'Paris, France');
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
