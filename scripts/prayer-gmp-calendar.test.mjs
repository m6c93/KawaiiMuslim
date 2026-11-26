import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modulePath = require.resolve('../lib/prayer-gmp-calendar.js');
const SOURCE_URL = 'https://www.grandemosqueedeparis.fr/horaire-des-prieres-paris';
const IMAGE_URL = 'https://static.wixstatic.com/media/fb33fe_4ce1f951fbe74b659543de9b69db2d24~mv2.jpg';
const imageTag = (month = 'NOVEMBRE 2026', source = IMAGE_URL + '/v1/fill/w_620,h_882/calendar.jpg') =>
  `<img src="${source}" alt="HEURES PRIERE - PARIS - GMP - ${month}.jpg">`;
const response = (html, options = {}) => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...options });
const fresh = () => { delete require.cache[modulePath]; return require(modulePath); };

test('uses only the fixed public page and extracts the requested official month', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response(imageTag()));
  const calendar = await fresh()('2026-11-26');
  assert.deepEqual(calendar, { imageUrl: IMAGE_URL, month: '2026-11', label: 'novembre 2026',
    validFrom: '2026-11-01', validUntil: '2026-11-30' });
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, SOURCE_URL);
  assert.deepEqual(options.headers, { Accept: 'text/html' });
  assert.equal(options.redirect, 'error');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.cache, 'no-store');
});

test('shares the catalogue and in-flight request between dates, caches absence and never reuses an old month', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response(imageTag()));
  const officialCalendar = fresh();
  const [november, december, nextYear] = await Promise.all([
    officialCalendar('2026-11-01'), officialCalendar('2026-12-01'), officialCalendar('2027-11-01')
  ]);
  assert.equal(november.month, '2026-11');
  assert.equal(december, null);
  assert.equal(nextYear, null);
  assert.equal(await officialCalendar('2026-12-31'), null);
  assert.equal(fetch.mock.callCount(), 1);
  november.month = 'changed';
  assert.equal((await officialCalendar('2026-11-30')).month, '2026-11');
});

test('refreshes after fifteen minutes and caches successful pages with no matching image', async t => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const fetch = t.mock.method(globalThis, 'fetch', async () => response('<p>Calendrier à venir</p>'));
  const officialCalendar = fresh();
  assert.equal(await officialCalendar('2026-12-01'), null);
  now += 14 * 60 * 1000;
  assert.equal(await officialCalendar('2026-11-26'), null);
  assert.equal(fetch.mock.callCount(), 1);
  now += 60 * 1000 + 1;
  fetch.mock.mockImplementation(async () => response(imageTag('DÉCEMBRE 2026')));
  assert.equal((await officialCalendar('2026-12-31')).validUntil, '2026-12-31');
  assert.equal(fetch.mock.callCount(), 2);
});

test('recognizes accented month names and leap years, rejects malformed dates before networking', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response(imageTag('FÉVRIER 2028')));
  const officialCalendar = fresh();
  for (const date of [null, {}, '2026-02-29', '2026-11-31', '2026-1-01', '2026-11-26?city=Paris']) {
    assert.equal(await officialCalendar(date), null);
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal((await officialCalendar('2028-02-29')).validUntil, '2028-02-29');
});

test('rejects misleading or untrusted image attributes and ignores script/comment decoys', async t => {
  const decoys = [
    imageTag().replace('PRIERE', 'ARTICLE'), imageTag().replace('PARIS', 'LYON'), imageTag().replace('GMP', 'AUTRE'),
    imageTag('NOVEMBRE 2026', 'http://static.wixstatic.com/media/calendar.jpg'),
    imageTag('NOVEMBRE 2026', 'https://static.wixstatic.com.evil.example/media/calendar.jpg'),
    imageTag('NOVEMBRE 2026', 'https://user@static.wixstatic.com/media/calendar.jpg'),
    imageTag('NOVEMBRE 2026', 'https://static.wixstatic.com/media/calendar.svg'),
    imageTag('NOVEMBRE 2026', IMAGE_URL + '?url=https://evil.example'),
    imageTag().replace('src=', 'data-src='), imageTag().replace('<img ', '<img alt="wrong" '),
    `<img title=" alt='HEURES PRIERE PARIS GMP NOVEMBRE 2026' src='${IMAGE_URL}' ">`,
    '<script>' + imageTag() + '</script>', '<!--' + imageTag() + '-->',
    '<style>' + imageTag() + '</style>'
  ];
  t.mock.method(globalThis, 'fetch', async () => response(decoys.join('\n')));
  assert.equal(await fresh()('2026-11-26'), null);
});

test('briefly caches upstream failures and retries after one minute', async t => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('network'); });
  const officialCalendar = fresh();
  assert.equal(await officialCalendar('2026-11-26'), null);
  now += 59000;
  assert.equal(await officialCalendar('2026-12-01'), null);
  assert.equal(fetch.mock.callCount(), 1);
  now += 1001;
  fetch.mock.mockImplementation(async () => response(imageTag()));
  assert.equal((await officialCalendar('2026-11-26')).month, '2026-11');
  assert.equal(fetch.mock.callCount(), 2);
});

test('rejects HTTP errors, non-HTML, declared oversize and streamed oversize bodies', async t => {
  const fetch = t.mock.method(globalThis, 'fetch');
  for (const upstream of [
    () => response(imageTag(), { status: 503 }),
    () => response(imageTag(), { headers: { 'content-type': 'application/json' } }),
    () => response(imageTag(), { headers: { 'content-type': 'text/html', 'content-length': '2097153' } }),
    () => response(' '.repeat(2097153) + imageTag())
  ]) {
    fetch.mock.mockImplementation(async () => upstream());
    assert.equal(await fresh()('2026-11-26'), null);
  }
});

test('enforces the six-second deadline while reading a stalled response body', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    signal = options.signal;
    return response(new ReadableStream({ start() {} }));
  });
  const result = fresh()('2026-11-26');
  await Promise.resolve();
  t.mock.timers.tick(6000);
  assert.equal(await result, null);
  assert.equal(signal.aborted, true);
});
