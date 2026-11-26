import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handler = require('../api/prayer-city.js');
const host = 'www.kawaiimuslimworld.com';

function invoke({ method = 'GET', headers = {}, rawHeaders } = {}) {
  const output = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
  handler({ method, headers: rawHeaders || {
    host, origin: 'https://' + host, 'sec-fetch-site': 'same-origin',
    'x-vercel-ip-city': 'Saint-Denis', 'x-vercel-ip-country': 'FR', ...headers
  } }, output);
  return output;
}

test('same-origin GET returns only the approximate city and assigned country code', () => {
  const response = invoke();
  assert.equal(response.code, 200);
  assert.deepEqual(response.body, { city: 'Saint-Denis', countryCode: 'FR', approximate: true });
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('decodes UTF-8 cities once, normalizes accents and keeps international city names', () => {
  for (const [input, city, country] of [
    ['%20Saint-%C3%89tienne%20', 'Saint-Étienne', 'FR'],
    [encodeURIComponent('Sa\u0303o Paulo'), 'São Paulo', 'BR'],
    [encodeURIComponent('الدار البيضاء'), 'الدار البيضاء', 'MA'],
    [encodeURIComponent('東京'), '東京', 'JP'],
    [encodeURIComponent("L’Haÿ-les-Roses"), 'L’Haÿ-les-Roses', 'FR']
  ]) {
    const response = invoke({ headers: { 'x-vercel-ip-city': input, 'x-vercel-ip-country': country } });
    assert.equal(response.code, 200, input);
    assert.deepEqual(response.body, { city, countryCode: country, approximate: true });
  }
  assert.equal(invoke({ headers: { 'x-vercel-ip-country': '%66%72' } }).body.countryCode, 'FR');
});

test('accepts assigned ISO codes across regions and rejects unknown, reserved and malformed codes', () => {
  for (const country of ['FR', 'MA', 'US', 'GB', 'PS', 'BR', 'JP', 'AU', 'AX', 'ZA']) {
    assert.equal(invoke({ headers: { 'x-vercel-ip-country': country } }).code, 200, country);
  }
  for (const country of ['ZZ', 'UK', 'EU', 'UN', 'AA', 'XK', 'FRA', 'F', '00', 'F R', '%FF', 'FR\n', ['FR', 'MA'], 42]) {
    const response = invoke({ headers: { 'x-vercel-ip-country': country } });
    assert.equal(response.code, 404, String(country));
    assert.deepEqual(response.body, { error: 'city_unavailable' });
  }
});

test('missing city or country never falls back to a capital or a default location', () => {
  for (const headers of [
    { 'x-vercel-ip-city': undefined }, { 'x-vercel-ip-country': undefined },
    { 'x-vercel-ip-city': '' }, { 'x-vercel-ip-country': '' },
    { 'x-vercel-ip-city': '   ' }, { 'x-vercel-ip-country': null }
  ]) {
    const response = invoke({ headers });
    assert.equal(response.code, 404);
    assert.deepEqual(response.body, { error: 'city_unavailable' });
  }
});

test('malformed, oversized, markup and hidden-control city values are unavailable', () => {
  for (const city of [
    '%', '%C3%28', '%253Cscript%253E', '<script>alert(1)</script>',
    'Paris\r\nX-Test: injected', 'Paris%00', 'Paris%0A', 'Pa\u202Eris',
    'Paris\u2028France', 'x'.repeat(81), '%41'.repeat(241),
    '1234', ['Paris', 'Lyon'], 42, null
  ]) {
    const response = invoke({ headers: { 'x-vercel-ip-city': city } });
    assert.equal(response.code, 404, String(city));
    assert.deepEqual(response.body, { error: 'city_unavailable' });
  }
});

test('native requests without Origin or Fetch Metadata remain supported', () => {
  const response = invoke({ rawHeaders: { 'x-vercel-ip-city': 'Rabat', 'x-vercel-ip-country': 'MA' } });
  assert.equal(response.code, 200);
  assert.deepEqual(response.body, { city: 'Rabat', countryCode: 'MA', approximate: true });
});

test('cross-site and cross-origin requests are blocked before revealing a suggestion', () => {
  for (const site of ['cross-site', 'cross-origin', 'same-site', 'invalid', ['same-origin']]) {
    const response = invoke({ headers: { origin: undefined, 'sec-fetch-site': site } });
    assert.equal(response.code, 403, String(site));
    assert.deepEqual(response.body, { error: 'origin_not_allowed' });
  }
  for (const origin of [
    'https://evil.example', 'https://kawaiimuslimworld.com', 'http://' + host,
    'https://' + host + '.evil.example', 'https://' + host + ':8443',
    'https://' + host + '/path', 'null', '', ['https://' + host]
  ]) {
    assert.equal(invoke({ headers: { origin } }).code, 403, String(origin));
  }
  for (const badHost of [undefined, null, 'evil.example', 'name@' + host, host + '/path', [host]]) {
    assert.equal(invoke({ headers: { host: badHost } }).code, 403, String(badHost));
  }
});

test('only GET is allowed and every response forbids caching and MIME sniffing', () => {
  const responses = [invoke(), invoke({ headers: { 'x-vercel-ip-city': undefined } }),
    invoke({ headers: { origin: 'https://evil.example' } })];
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const response = invoke({ method });
    assert.equal(response.code, 405, method);
    assert.equal(response.headers.allow, 'GET');
    assert.deepEqual(response.body, { error: 'method_not_allowed' });
    responses.push(response);
  }
  for (const response of responses) {
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.equal(response.headers['vercel-cdn-cache-control'], 'no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
});

test('does not read, return, log or send IP, coordinates, cookies or other private headers', t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('No external lookup is allowed'); });
  const logs = ['log', 'info', 'warn', 'error', 'debug'].map(name => t.mock.method(console, name, () => {}));
  const allowed = new Set(['sec-fetch-site', 'origin', 'host', 'x-vercel-ip-city', 'x-vercel-ip-country']);
  const headers = new Proxy({
    host, origin: 'https://' + host, 'sec-fetch-site': 'same-origin',
    'x-vercel-ip-city': 'Paris', 'x-vercel-ip-country': 'FR',
    'x-real-ip': '192.0.2.99', 'x-forwarded-for': '198.51.100.20',
    'x-vercel-ip-latitude': '48.123456', 'x-vercel-ip-longitude': '2.654321',
    authorization: 'private-token', cookie: 'private-cookie'
  }, { get(target, name) {
    assert.ok(allowed.has(name), 'Unexpected header access: ' + String(name));
    return target[name];
  } });
  const response = invoke({ rawHeaders: headers });
  assert.equal(response.code, 200);
  assert.deepEqual(response.body, { city: 'Paris', countryCode: 'FR', approximate: true });
  assert.equal(fetch.mock.callCount(), 0);
  for (const log of logs) assert.equal(log.mock.callCount(), 0);
});
