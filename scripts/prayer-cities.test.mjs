import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handlerPath = require.resolve('../api/prayer-cities.js');
const handler = require(handlerPath);
const catalogue = require('../data/prayer-fr-cities.json');
const sources = require('../data/prayer-cities-sources.json');
const host = 'www.kawaiimuslimworld.com';

function freshHandler() {
  delete require.cache[handlerPath];
  return require(handlerPath);
}

async function invoke(options = {}) {
  const output = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await (options.handler || handler)({
    method: options.method || 'POST',
    body: Object.hasOwn(options, 'body') ? options.body : { query: 'Paris' },
    headers: options.rawHeaders || {
      host, origin: 'https://' + host, 'sec-fetch-site': 'same-origin',
      'content-type': 'application/json', ...options.headers
    }
  }, output);
  return output;
}

function feature(id = 1, name = 'Tokyo', properties = {}, coordinates = [139.6917, 35.6895]) {
  return {
    type: 'Feature', geometry: { type: 'Point', coordinates },
    properties: { osm_type: 'R', osm_id: id, osm_key: 'place', osm_value: 'city',
      type: 'city', name, country: 'Japon', countrycode: 'JP', state: 'Tokyo', ...properties }
  };
}

const reply = features => ({ ok: true, status: 200,
  json: async () => ({ type: 'FeatureCollection', features }) });
const ids = response => response.body.results.map(result => result.id);

test('the local catalogue has unique official centres, postal codes and source attribution', () => {
  assert.equal(catalogue.schema, 1);
  assert.deepEqual(catalogue.columns, ['code', 'name', 'department', 'longitude', 'latitude', 'population', 'postcodes']);
  assert.ok(catalogue.cities.length > 34000);
  assert.equal(Object.keys(catalogue.departments).length, 101);
  const codes = new Set();
  for (const row of catalogue.cities) {
    assert.equal(row.length, 7);
    assert.match(row[0], /^[0-9AB]{5}$/);
    assert.equal(codes.has(row[0]), false);
    codes.add(row[0]);
    assert.ok(row[1] && catalogue.departments[row[2]]);
    assert.ok(Number.isFinite(row[3]) && Math.abs(row[3]) <= 180);
    assert.ok(Number.isFinite(row[4]) && Math.abs(row[4]) <= 90);
    assert.ok(Number.isSafeInteger(row[5]) && row[5] >= 0);
    assert.ok(Array.isArray(row[6]) && row[6].every(value => /^\d{5}$/.test(value)));
  }
  for (const code of ['75056', '13055', '93066', '97411']) assert.ok(codes.has(code));
  assert.equal(sources.frenchCatalogue.count, catalogue.cities.length);
  assert.match(sources.frenchCatalogue.url, /^https:\/\/geo\.api\.gouv\.fr\/communes\?/);
  assert.match(sources.frenchCatalogue.license, /Licence Ouverte/);
  assert.ok(sources.frenchCatalogue.attribution.includes(catalogue.date));
  assert.equal(sources.worldSearch.attributionUrl, 'https://www.openstreetmap.org/copyright');
});

test('spaces, hyphens, accents, case and saint abbreviations produce the same French suggestions', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('France must work offline'); });
  const expected = ids(await invoke({ body: { query: 'Saint-Denis' } }));
  for (const query of ['saint denis', '  SAINT   DENIS ', 'saint—denis', 'saintdenis', 'st denis', 'St. Denis', 'stdenis', 'Saint-Denis, France']) {
    const response = await invoke({ body: { query } });
    assert.equal(response.code, 200, query);
    assert.equal(response.body.source, 'fr');
    assert.deepEqual(ids(response), expected, query);
  }
  for (const query of ["L'Hay-les-Roses", 'L’Haÿ les Roses', 'l hay les roses']) {
    assert.equal(ids(await invoke({ body: { query } }))[0], 'fr:94038', query);
  }
  assert.equal(ids(await invoke({ body: { query: 'ste. genevieve des bois' } }))[0], 'fr:91549');
  assert.equal(fetch.mock.callCount(), 0);
});

test('bounded spelling correction and prefixes find real cities without inventing a fallback', async () => {
  for (const [query, id] of [['pariss', 'fr:75056'], ['marseile', 'fr:13055'], ['marsei', 'fr:13055'], ['lyno', 'fr:69123']]) {
    const response = await invoke({ body: { query } });
    assert.equal(response.code, 200);
    assert.equal(ids(response)[0], id, query);
    assert.ok(response.body.results.length <= 6);
  }
  const denis = ids(await invoke({ body: { query: 'saint deni' } }));
  assert.ok(denis.includes('fr:93066') && denis.includes('fr:97411'));
  const missing = await invoke({ body: { query: 'zzzzzzzzzzzzzz' } });
  assert.deepEqual(missing.body, { results: [], source: 'fr' });
});

test('Saint-Denis homonyms have distinct departments, coordinates and stable IDs; nothing is auto-selected', async () => {
  const response = await invoke({ body: { query: 'saint denis' } });
  const mainland = response.body.results.find(result => result.id === 'fr:93066');
  const reunion = response.body.results.find(result => result.id === 'fr:97411');
  assert.equal(mainland.label, 'Saint-Denis · Seine-Saint-Denis (93), France');
  assert.equal(reunion.label, 'Saint-Denis · La Réunion (974), France');
  assert.equal(mainland.departmentCode, '93');
  assert.equal(reunion.departmentCode, '974');
  assert.ok(mainland.latitude > 48 && mainland.latitude < 49);
  assert.ok(reunion.latitude < -20 && reunion.latitude > -22);
  assert.deepEqual(Object.keys(response.body).sort(), ['results', 'source']);
  assert.deepEqual(Object.keys(mainland).sort(), ['countryCode', 'departmentCode', 'id', 'label', 'latitude', 'longitude']);
});

test('postal codes, postal prefixes and name-plus-postcode disambiguate the selected commune', async () => {
  for (const [query, id] of [['93200', 'fr:93066'], ['93210', 'fr:93066'], ['97400', 'fr:97411'],
    ['Saint Denis 93', 'fr:93066'], ['Saint Denis93200', 'fr:93066'], ['Paris 75013', 'fr:75056'], ['75013', 'fr:75056']]) {
    const response = await invoke({ body: { query } });
    assert.equal(response.code, 200);
    assert.equal(ids(response)[0], id, query);
  }
  assert.deepEqual((await invoke({ body: { query: 'Saint Denis 75013' } })).body.results, []);
});

test('accepts serialized JSON and native requests without Origin; invalid bodies never trigger an upstream call', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected lookup'); });
  const native = await invoke({ rawHeaders: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ query: 'Paris' }) });
  assert.equal(native.code, 200);
  assert.equal(ids(native)[0], 'fr:75056');
  for (const body of [undefined, null, [], '', '{', 'x'.repeat(2049), 42, { scope: 'fr' },
    { query: ['Paris'] }, { query: 'Paris', scope: 'FR' }, { query: 'Paris', scope: null },
    { query: 'Paris', latitude: 48 }, { query: 'Paris', url: 'https://evil.example' },
    ...['', ' ', '.', 'P', 'a'.repeat(121), 'Paris\n', 'Pa\u202Eris', '<script>', 'https://evil.example', 'Paris?url=evil'].map(query => ({ query }))]) {
    const response = await invoke({ body });
    assert.equal(response.code, 400, JSON.stringify(body));
    assert.deepEqual(response.body, { error: 'invalid_request' });
  }
  for (const type of [undefined, 'text/plain', 'application/jsonp', ['application/json']]) {
    assert.equal((await invoke({ headers: { 'content-type': type } })).code, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('cross-site and mismatched Origin/Host requests are rejected before lookup', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected lookup'); });
  for (const site of ['cross-site', 'cross-origin', 'same-site', '', ['same-origin']]) {
    assert.equal((await invoke({ body: { query: 'Tokyo', scope: 'world' }, headers: { 'sec-fetch-site': site, origin: undefined } })).code, 403);
  }
  for (const origin of ['https://evil.example', 'https://' + host + '.evil.example', 'http://' + host,
    'https://' + host + '/path', 'https://' + host + ':8443', 'null', '', ['https://' + host]]) {
    assert.equal((await invoke({ headers: { origin } })).code, 403, String(origin));
  }
  for (const badHost of [undefined, null, 'evil.example', 'name@' + host, host + '/path', [host]]) {
    assert.equal((await invoke({ headers: { host: badHost } })).code, 403, String(badHost));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('only POST is allowed and successful/error responses disable browser and CDN caching', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  const responses = [await invoke(), await invoke({ body: {} }), await invoke({ headers: { origin: 'https://evil.example' } }),
    await invoke({ handler: freshHandler(), body: { query: 'Tokyo', scope: 'world' } })];
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const response = await invoke({ method });
    assert.equal(response.code, 405);
    assert.equal(response.headers.allow, 'POST');
    responses.push(response);
  }
  for (const response of responses) {
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.equal(response.headers['vercel-cdn-cache-control'], 'no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
});

test('world search uses only the fixed Photon host and returns a small sanitized location contract', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => reply(Array.from({ length: 12 }, (_, index) =>
    feature(index + 1, 'Ville ' + index, { extra: { private: 'do-not-return' } }, [139 + index / 10, 35]))));
  const response = await invoke({ handler: freshHandler(), body: { query: 'Tokyo & Yokohama', scope: 'world' } });
  assert.equal(response.code, 200);
  assert.equal(response.body.source, 'world');
  assert.equal(response.body.results.length, 6);
  assert.deepEqual(Object.keys(response.body.results[0]).sort(), ['countryCode', 'id', 'label', 'latitude', 'longitude']);
  assert.equal(response.body.results[0].id, 'osm:R1');
  assert.doesNotMatch(JSON.stringify(response.body), /do-not-return|extra|osm_key|properties/);
  const [request, options] = fetch.mock.calls[0].arguments;
  const url = new URL(request);
  assert.equal(url.origin, 'https://photon.komoot.io');
  assert.equal(url.pathname, '/api/');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['lang', 'layer', 'limit', 'q']);
  assert.equal(url.searchParams.get('q'), 'Tokyo & Yokohama');
  assert.equal(url.searchParams.get('lang'), 'fr');
  assert.equal(url.searchParams.get('layer'), 'city');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.ok(options.signal instanceof AbortSignal);
});

test('world results reject invalid coordinates and markup, prefer settlements over duplicate boundaries and retain homonyms', async t => {
  const boundary = feature(10, 'Springfield', { country: 'États-Unis', countrycode: 'US', state: 'Illinois', county: 'Sangamon', osm_key: 'boundary' }, [-89.64, 39.80]);
  const settlement = feature(11, 'Springfield', { country: 'États-Unis', countrycode: 'US', state: 'Illinois', county: 'Sangamon' }, [-89.65, 39.81]);
  const homonym = feature(12, 'Springfield', { country: 'États-Unis', countrycode: 'US', state: 'Massachusetts', county: 'Hampden' }, [-72.59, 42.10]);
  const distant = feature(13, 'Springfield', { country: 'États-Unis', countrycode: 'US', state: 'Illinois', county: 'Sangamon' }, [-90.1, 40.6]);
  const missingGeometry = feature(20); delete missingGeometry.geometry;
  t.mock.method(globalThis, 'fetch', async () => reply([
    boundary, settlement, settlement, homonym, distant, missingGeometry, null,
    feature(21, 'Bad latitude', {}, [2, 100]), feature(22, 'Bad longitude', {}, [181, 48]),
    feature(23, 'String coordinate', {}, ['2', 48]), feature(24, '<script>'),
    feature(25, 'Hidden\u202EName'), feature(26, 'Unknown country', { countrycode: 'ZZ' }),
    feature(27, 'Station', { type: 'house' }), feature(-1, 'Invalid ID')
  ]));
  const response = await invoke({ handler: freshHandler(), body: { query: 'Springfield', scope: 'world' } });
  assert.equal(response.code, 200);
  assert.deepEqual(ids(response), ['osm:R11', 'osm:R12', 'osm:R13']);
  assert.match(response.body.results[0].label, /Illinois/);
  assert.match(response.body.results[1].label, /Massachusetts/);
});

test('world search never reads or forwards visitor headers, credentials, IP or coordinates and never logs', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => reply([feature()]));
  const logs = ['log', 'info', 'warn', 'error', 'debug'].map(name => t.mock.method(console, name, () => {}));
  const allowed = new Set(['host', 'origin', 'sec-fetch-site', 'content-type']);
  const headers = new Proxy({ host, origin: 'https://' + host, 'sec-fetch-site': 'same-origin',
    'content-type': 'application/json', authorization: 'private-token', cookie: 'private-cookie',
    'x-forwarded-for': '192.0.2.99', 'x-vercel-ip-latitude': '48.123456' }, {
    get(target, name) { assert.ok(allowed.has(name), 'Unexpected header access: ' + String(name)); return target[name]; }
  });
  const response = await invoke({ handler: freshHandler(), body: { query: 'Tokyo', scope: 'world' }, rawHeaders: headers });
  assert.equal(response.code, 200);
  const options = fetch.mock.calls[0].arguments[1];
  assert.deepEqual(options.headers, { Accept: 'application/json', 'User-Agent': 'KawaiiMuslimWorld/1.0 (https://www.kawaiimuslimworld.com)' });
  assert.equal(options.credentials, undefined);
  assert.equal(options.body, undefined);
  assert.doesNotMatch(JSON.stringify(response.body), /private-token|private-cookie|192\.0\.2|48\.123456/);
  for (const log of logs) assert.equal(log.mock.callCount(), 0);
});

test('world cache has a 64-query LRU bound and expires after 15 minutes', async t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const fetch = t.mock.method(globalThis, 'fetch', async () => reply([feature()]));
  const isolated = freshHandler();
  const search = query => invoke({ handler: isolated, body: { query, scope: 'world' } });
  await search('Alpha');
  await search('Beta');
  await search('ALPHA');
  assert.equal(fetch.mock.callCount(), 2);
  for (let i = 0; i < 63; i++) await search('Cache city ' + i);
  const before = fetch.mock.callCount();
  await search('Alpha');
  assert.equal(fetch.mock.callCount(), before, 'Recently used query must survive eviction');
  await search('Beta');
  assert.equal(fetch.mock.callCount(), before + 1, 'Least recently used query must have been evicted');
  now += 15 * 60 * 1000 + 1;
  await search('Alpha');
  assert.equal(fetch.mock.callCount(), before + 2, 'Expired results must be refreshed');
});

test('upstream errors are sanitized and never cached as a successful search', async t => {
  const isolated = freshHandler();
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('private-upstream-details'); });
  const options = { handler: isolated, body: { query: 'Tokyo', scope: 'world' } };
  assert.deepEqual((await invoke(options)).body, { error: 'cities_unavailable' });
  fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ unexpected: 'private-upstream-details' }) }));
  assert.equal((await invoke(options)).code, 502);
  fetch.mock.mockImplementation(async () => reply([feature()]));
  assert.equal((await invoke(options)).code, 200);
  assert.equal(fetch.mock.callCount(), 3);
  await invoke(options);
  assert.equal(fetch.mock.callCount(), 3);
});

test('a six-second timeout aborts the world provider and returns a distinct retryable error', async t => {
  let expire;
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds) => {
    assert.equal(milliseconds, 6000);
    expire = callback;
    return 123;
  });
  const clear = t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const pending = invoke({ handler: freshHandler(), body: { query: 'Tokyo', scope: 'world' } });
  assert.equal(typeof expire, 'function');
  expire();
  const response = await pending;
  assert.equal(response.code, 504);
  assert.deepEqual(response.body, { error: 'cities_timeout' });
  assert.equal(clear.mock.callCount(), 1);
});
