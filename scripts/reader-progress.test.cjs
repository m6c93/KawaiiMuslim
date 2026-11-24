const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const progressScript = readFileSync(path.resolve(__dirname, '../km-reading-progress.js'), 'utf8');
const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

function createReader(search = '') {
  const window = new EventTarget();
  const document = new EventTarget();
  const range = Object.assign(new EventTarget(), {
    tagName: 'INPUT',
    dataset: {readingSlug: 'miracles-du-coran', readingTitle: 'Les miracles du Coran'},
    value: '0', max: '32'
  });
  const writes = [];
  const timers = new Map();
  let mounted = false;
  let remote = null;
  let nextTimer = 0;
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return {data: remote}; },
    upsert(row) { writes.push(row); return this; },
    async single() { return {data: {}}; }
  };
  window.supabase = {createClient: () => ({
    from: () => query,
    auth: {getSession: async () => ({data: {session: {user: {id: 'parent'}}}})}
  })};
  window.KM_CONFIG = {supabaseUrl: 'https://example.test', supabaseAnonKey: 'test'};
  document.getElementById = id => mounted && id === 'progress' ? range : null;
  document.readyState = 'complete';
  vm.runInNewContext(progressScript, {
    window, document, URLSearchParams, Event, console,
    localStorage: {getItem: () => JSON.stringify({type: 'child', id: 'child'})},
    location: new URL('https://example.test/books/miracles-du-coran.html' + search),
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }
  });
  return {
    window, range, writes,
    mount(position) {
      remote = {position};
      mounted = true;
      document.dispatchEvent(new Event('km-reader-ready'));
    },
    async tick() {
      for (const [id, callback] of timers) { timers.delete(id); callback(); }
      await waitForPromises();
    }
  };
}

test('a late mounted reader saves its final rendered position without losing a rapid second turn', async () => {
  const reader = createReader();
  reader.range.dataset.readingSlug = 'pdf:distinct-document-id';
  reader.mount(0);
  await waitForPromises();
  for (const value of ['10', '32']) {
    reader.range.value = value;
    reader.range.dispatchEvent(new Event('km-reader-position'));
  }
  await reader.tick();
  assert.deepEqual(reader.writes.map(row => [row.book_slug, row.position, row.completed]), [
    ['pdf:distinct-document-id', 32, true]
  ]);
  reader.range.value = '12';
  reader.range.dispatchEvent(new Event('km-reader-position'));
  reader.window.dispatchEvent(new Event('pagehide'));
  await reader.tick();
  assert.deepEqual(reader.writes.map(row => row.position), [32, 12]);
});

test('restoring an explicit coloring spread preserves the page requested by an existing draft', async () => {
  const reader = createReader('?page=3');
  reader.range.value = '3';
  reader.mount(25);
  await waitForPromises();
  await reader.tick();
  assert.equal(reader.range.value, '3');
  assert.equal(reader.writes[0].position, 3);
});

test('the discovery reader never writes to a child profile', async () => {
  const reader = createReader('?guest=1');
  reader.mount(0);
  reader.range.value = '2';
  reader.range.dispatchEvent(new Event('km-reader-position'));
  reader.window.dispatchEvent(new Event('pagehide'));
  await reader.tick();
  assert.equal(reader.writes.length, 0);
});
