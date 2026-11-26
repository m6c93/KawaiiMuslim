import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handler = require('../api/prayer-times.js');
const host = 'www.kawaiimuslimworld.com';
const input = { date: '2026-11-26', city: 'Montreuil, France' };
const expectedTimes = { Fajr: '06:23', Dhuhr: '12:38', Asr: '14:41', Maghrib: '16:59', Isha: '18:46' };

function payload(date = '26-11-2026') {
  return { code: 200, status: 'OK', data: {
    timings: { ...expectedTimes, Sunrise: '08:15', Midnight: '00:37' },
    meta: { timezone: 'Europe/Paris', latitude: 48.861, longitude: 2.443, method: { id: 3 } },
    date: { gregorian: { date, weekday: { en: 'Thursday' } }, hijri: { date: '16-06-1448' } }
  } };
}

function upstream(body = payload(), status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) };
}

async function invoke({ method = 'POST', body = input, headers = {}, rawHeaders } = {}) {
  const output = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(value) { this.body = value; return this; }
  };
  await handler({ method, body, headers: rawHeaders || {
    host, origin: 'https://' + host, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers
  } }, output);
  return output;
}

function assertPrivate(response) {
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.equal(response.headers['vercel-cdn-cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
}

test('a confirmed city uses the fixed provider and returns only validated timings, timezone and date', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => upstream());
  const response = await invoke({ body: JSON.stringify({ ...input, city: '  Montreuil, France  ' }) });
  assert.equal(response.code, 200);
  assert.deepEqual(response.body, { code: 200, data: {
    timings: expectedTimes, meta: { timezone: 'Europe/Paris' }, date: { gregorian: { date: '26-11-2026' } }
  } });
  assert.equal(fetch.mock.callCount(), 1);
  const [url, options] = fetch.mock.calls[0].arguments;
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://api.aladhan.com');
  assert.equal(parsed.pathname, '/v1/timingsByAddress/26-11-2026');
  assert.deepEqual(Object.fromEntries(parsed.searchParams), { method: '3', address: 'Montreuil, France' });
  assert.deepEqual(options.headers, { Accept: 'application/json' });
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.ok(options.signal instanceof AbortSignal);
  assertPrivate(response);
});

test('GPS coordinates including zero are used without a default city or an address lookup', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => upstream());
  for (const [latitude, longitude] of [[48.861, 2.443], [0, 0], [-33.868, 151.209], [90, -180]]) {
    const response = await invoke({ body: { date: input.date, latitude, longitude } });
    assert.equal(response.code, 200);
    const url = new URL(fetch.mock.calls.at(-1).arguments[0]);
    assert.equal(url.pathname, '/v1/timings/26-11-2026');
    assert.deepEqual(Object.fromEntries(url.searchParams), { method: '3', latitude: String(latitude), longitude: String(longitude) });
  }
});

test('rejects malformed dates, bodies, mixed locations and invalid coordinates before calling the provider', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('Invalid requests must not reach the provider'));
  for (const body of [
    null, [], '', '{', 'x'.repeat(2049), 42,
    {}, { city: input.city }, { date: input.date },
    { ...input, date: '2026-02-29' }, { ...input, date: '2026-04-31' }, { ...input, date: '26-11-2026' },
    { ...input, date: '2026-1-26' }, { ...input, date: '2026-11-26T00:00:00Z' },
    { ...input, url: 'https://evil.example' }, { ...input, method: 2 },
    { ...input, latitude: 48 }, { ...input, longitude: 2 },
    { date: input.date, latitude: '48', longitude: 2 },
    { date: input.date, latitude: 48, longitude: null },
    { date: input.date, latitude: NaN, longitude: 2 },
    { date: input.date, latitude: 48, longitude: Infinity },
    { date: input.date, latitude: 90.1, longitude: 2 },
    { date: input.date, latitude: 48, longitude: -180.1 },
    { ...input, city: '' }, { ...input, city: '   ' }, { ...input, city: ['Paris'] },
    { ...input, city: 'P'.repeat(161) }, { ...input, city: '<Paris>' },
    { ...input, city: 'Paris\nFrance' }, { ...input, city: 'Pa\u202Eris' }
  ]) {
    const response = await invoke({ body });
    assert.equal(response.code, 400, JSON.stringify(body));
    assert.deepEqual(response.body, { code: 400, error: 'invalid_request' });
    assertPrivate(response);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('preserves international city names and accepts a real leap date', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async url => upstream(payload(new URL(url).pathname.split('/').at(-1))));
  for (const city of ['الرباط, المغرب', '東京, 日本', 'L’Haÿ-les-Roses, France', 'Sa\u0303o Paulo, Brasil']) {
    const response = await invoke({ body: { date: '2028-02-29', city } });
    assert.equal(response.code, 200, city);
    const url = new URL(fetch.mock.calls.at(-1).arguments[0]);
    assert.equal(url.searchParams.get('address'), city.normalize('NFC'));
    assert.equal(response.body.data.date.gregorian.date, '29-02-2028');
  }
});

test('permits native JSON requests without Origin, but rejects cross-origin and non-JSON submissions', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => upstream());
  const native = await invoke({ rawHeaders: { 'content-type': 'application/json; charset=utf-8' } });
  assert.equal(native.code, 200);
  for (const headers of [
    { origin: 'https://evil.example' }, { origin: 'https://kawaiimuslimworld.com' },
    { origin: 'null' }, { origin: 'http://' + host }, { origin: 'https://' + host + '/path' },
    { origin: ['https://' + host] }, { host: 'name@' + host },
    { 'sec-fetch-site': 'cross-site', origin: undefined },
    { 'sec-fetch-site': 'same-site', origin: undefined }
  ]) {
    const response = await invoke({ headers });
    assert.equal(response.code, 403);
    assert.deepEqual(response.body, { code: 403, error: 'origin_not_allowed' });
    assertPrivate(response);
  }
  for (const contentType of [undefined, '', 'text/plain', 'application/x-www-form-urlencoded', ['application/json']]) {
    const response = await invoke({ headers: { 'content-type': contentType } });
    assert.equal(response.code, 400);
    assertPrivate(response);
  }
  assert.equal(fetch.mock.callCount(), 1);
});

test('allows only POST and keeps errors private and uncacheable', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('A non-POST request must not call the provider'));
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']) {
    const response = await invoke({ method });
    assert.equal(response.code, 405);
    assert.equal(response.headers.allow, 'POST');
    assert.deepEqual(response.body, { code: 405, error: 'method_not_allowed' });
    assertPrivate(response);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('never displays incomplete, malformed or mismatched provider data as prayer times', async t => {
  const badPayloads = [null, {}, { code: 200 }, { code: 500, data: 'private provider failure' }];
  for (const mutate of [
    body => { delete body.data.timings.Fajr; },
    body => { body.data.timings.Asr = '24:01'; },
    body => { body.data.timings.Isha = '18:60'; },
    body => { body.data.timings.Maghrib = '16:59<script>'; },
    body => { body.data.timings.Dhuhr = 1238; },
    body => { body.data.date.gregorian.date = '25-11-2026'; },
    body => { delete body.data.date; },
    body => { body.data.meta.timezone = 'Not/A-Timezone'; },
    body => { delete body.data.meta.timezone; }
  ]) {
    const body = payload();
    mutate(body);
    badPayloads.push(body);
  }
  let current;
  t.mock.method(globalThis, 'fetch', async () => upstream(current));
  for (current of badPayloads) {
    const response = await invoke();
    assert.equal(response.code, 502);
    assert.deepEqual(response.body, { code: 502, error: 'timings_unavailable' });
    assertPrivate(response);
  }
});

test('reports provider failures without fabricating a location or exposing provider error details', async t => {
  let behavior;
  const fetch = t.mock.method(globalThis, 'fetch', (...args) => behavior(...args));
  for (behavior of [
    async () => upstream({ code: 503, data: 'private failure details' }, 503),
    async () => upstream({ code: 503, data: 'Geocoding is temporarily unavailable. Please try again later.' }, 503),
    async () => upstream({ code: 400, data: 'Unable to geocode address: quota exceeded.' }, 400),
    async () => upstream({ code: 429, data: 'geocoding quota' }, 429),
    async () => { throw new Error('Secret network detail'); },
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('HTML response'); } })
  ]) {
    const response = await invoke();
    assert.equal(response.code, 502);
    assert.deepEqual(response.body, { code: 502, error: 'timings_unavailable' });
    assertPrivate(response);
  }
  assert.equal(fetch.mock.callCount(), 6, 'Transient errors must not produce an unbounded retry loop');
});

test('distinguishes an explicit invalid address from a geocoding service failure', async t => {
  t.mock.method(globalThis, 'fetch', async () => upstream({ code: 400, data: 'Address not found.' }, 400));
  const response = await invoke();
  assert.equal(response.code, 422);
  assert.deepEqual(response.body, { code: 422, error: 'location_not_found' });
  assertPrivate(response);
  const gpsResponse = await invoke({ body: { date: input.date, latitude: 48.861, longitude: 2.443 } });
  assert.equal(gpsResponse.code, 502, 'A GPS request cannot be rejected as a misspelled city');
});

test('bounds the entire upstream request, including a stalled response body, to twelve seconds', async t => {
  let timeout;
  let delay;
  const token = {};
  t.mock.method(globalThis, 'setTimeout', (callback, ms) => { timeout = callback; delay = ms; return token; });
  const clear = t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(globalThis, 'fetch', async (url, options) => ({
    ok: true, status: 200,
    json: () => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Aborted'))))
  }));
  const pending = invoke();
  await Promise.resolve();
  assert.equal(delay, 12000);
  timeout();
  const response = await pending;
  assert.equal(response.code, 504);
  assert.deepEqual(response.body, { code: 504, error: 'timings_timeout' });
  assert.deepEqual(clear.mock.calls.map(call => call.arguments), [[token]]);
  assertPrivate(response);
});

test('does not read or forward visitor identity, IP headers, cookies or credentials and never logs inputs', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => upstream());
  const logs = ['log', 'warn', 'info', 'error', 'debug'].map(name => t.mock.method(console, name, () => {}));
  const allowed = new Set(['sec-fetch-site', 'origin', 'host', 'content-type']);
  const headers = new Proxy({
    host, origin: 'https://' + host, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
    authorization: 'private-token', cookie: 'private-cookie', 'x-forwarded-for': '198.51.100.20', 'x-real-ip': '192.0.2.99'
  }, { get(target, name) {
    assert.ok(allowed.has(name), 'Unexpected private header access: ' + String(name));
    return target[name];
  } });
  const response = await invoke({ rawHeaders: headers });
  assert.equal(response.code, 200);
  const [, options] = fetch.mock.calls[0].arguments;
  assert.deepEqual(Object.keys(options).sort(), ['cache', 'headers', 'redirect', 'signal']);
  assert.deepEqual(options.headers, { Accept: 'application/json' });
  assert.equal(JSON.stringify(response.body).includes('latitude'), false);
  assert.equal(JSON.stringify(response.body).includes('longitude'), false);
  for (const log of logs) assert.equal(log.mock.callCount(), 0);
});
