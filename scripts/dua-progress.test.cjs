const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');

const activityCode = readFileSync('km-activity-progress.js', 'utf8');
const duaCode = readFileSync('dua-ritual.js', 'utf8');
const key = 'kmw-weekly-dua-preview-v1';
const legacyKey = 'kmw-dua-sleep-ritual-v1';
const profileKey = 'km-active-profile-v2';
const plain = value => JSON.parse(JSON.stringify(value));

function localStore() {
  const values = new Map();
  return {
    getItem: name => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, String(value)),
    removeItem: name => values.delete(name)
  };
}

function page({local = localStore(), child = 'amal', guest = false, seed = {}, now = '2026-11-26T12:00:00Z'} = {}) {
  let clock = now;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return Date.parse(clock); }
  }
  local.setItem(profileKey, JSON.stringify({type: 'child', id: child}));
  const window = {
    Date: Clock, URL, URLSearchParams, CustomEvent, document: new EventTarget(),
    localStorage: local, sessionStorage: localStore(), addEventListener() {},
    location: new URL('https://example.test/Aujourd%27hui.dc.html' + (guest ? '?guest=1' : ''))
  };
  window.window = window;
  vm.createContext(window);
  vm.runInContext(activityCode, window);
  const storage = window.KMActivityProgress.storage;
  for (const [name, value] of Object.entries(seed)) storage.setItem(name, JSON.stringify(value));
  vm.runInContext(duaCode, window);
  return {
    local, window, storage, api: window.KMDuaProgress,
    setTime(value) { clock = value; },
    stored: name => JSON.parse(storage.getItem(name))
  };
}

test('a guided confirmation awards its day atomically and preserves every unrelated invocation field', () => {
  const p = page({seed: {
    [key]: {learned: ['sleep'], practices: {sleep: 4, leaving: 2},
      ritualDays: {morning: ['2026-11-25']},
      weeklySessions: {leaving: {'1795392000000': {tries: 2, note: 'keep'}}, sleep: {old: {tries: 3}}},
      extra: {keep: true}},
    [legacyKey]: ['2026-11-24']
  }});
  assert.equal(p.api.read('leaving').confidence, null);
  const result = p.api.complete('leaving');
  assert.equal(result.saved, true);
  assert.equal(result.awarded, true);
  assert.deepEqual(plain(result.snapshot), {
    days: ['2026-11-26'], count: 1, day: 1, todayDone: true, complete: false, confidence: null
  });
  assert.deepEqual(p.stored(key), {
    learned: ['sleep'], practices: {sleep: 4, leaving: 3},
    ritualDays: {morning: ['2026-11-25'], leaving: ['2026-11-26']},
    weeklySessions: {leaving: {'1795392000000': {tries: 3, note: 'keep'}}, sleep: {old: {tries: 3}}},
    extra: {keep: true}
  });
  assert.deepEqual(p.stored(legacyKey), ['2026-11-24']);
});

test('bedtime reads and migrates both old and new dates without changing the legacy records', () => {
  const oldWeek = 'kmw-dua-sleep-week-1795392000000';
  const p = page({seed: {
    [key]: {ritualDays: {sleep: ['2026-11-22', '2026-11-23']}, learned: ['sleep']},
    [legacyKey]: ['2026-11-21', '2026-11-22', 'bad', '2026-02-30', '2026-13-01', null],
    [oldWeek]: 4
  }});
  const before = p.storage.getItem(key);
  assert.deepEqual(plain(p.api.read('sleep').days), ['2026-11-21', '2026-11-22', '2026-11-23']);
  assert.equal(p.api.read('sleep').confidence, 'alone');
  assert.equal(p.storage.getItem(key), before, 'reading is not a write');
  const result = p.api.complete('sleep', {source: 'outside'});
  assert.equal(result.awarded, true);
  assert.deepEqual(p.stored(key).ritualDays.sleep, ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-26']);
  assert.deepEqual(p.stored(legacyKey), ['2026-11-21', '2026-11-22', 'bad', '2026-02-30', '2026-13-01', null]);
  assert.equal(p.stored(oldWeek), 4);
  assert.equal(p.stored(key).practices, undefined, 'outside recitation does not invent a guided session');
});

test('same-day repeats keep the same goal, missed weeks keep stars, and later days advance once', () => {
  const p = page();
  assert.equal(p.api.read('leaving').day, 1);
  p.api.complete('leaving');
  assert.equal(p.api.complete('leaving').awarded, false);
  assert.equal(p.api.complete('leaving', {source: 'outside'}).awarded, false);
  assert.equal(p.api.read('leaving').count, 1);
  assert.equal(p.api.read('leaving').day, 1);
  assert.equal(p.stored(key).practices.leaving, 2);
  p.setTime('2026-12-28T09:00:00Z');
  const next = p.api.read('leaving');
  assert.equal(next.count, 1);
  assert.equal(next.day, 2);
  assert.equal(next.todayDone, false);
  assert.equal(p.api.complete('leaving').snapshot.day, 2);
  assert.deepEqual(p.stored(key).ritualDays.leaving, ['2026-11-26', '2026-12-28']);
});

test('seven distinct days finish the course; further revisions cannot award invisible extra stars', () => {
  const p = page();
  for (let day = 1; day <= 7; day++) {
    p.setTime('2026-12-' + String(day).padStart(2, '0') + 'T12:00:00Z');
    assert.equal(p.api.read('leaving').day, day);
    assert.equal(p.api.complete('leaving').awarded, true);
  }
  const finished = p.api.read('leaving');
  assert.equal(finished.complete, true);
  assert.equal(finished.count, 7);
  p.setTime('2027-01-10T12:00:00Z');
  assert.equal(p.api.complete('leaving', {source: 'outside'}).awarded, false);
  const review = p.api.complete('leaving');
  assert.equal(review.saved, true);
  assert.equal(review.awarded, false);
  assert.equal(review.snapshot.complete, true);
  assert.equal(p.stored(key).ritualDays.leaving.length, 7);
  assert.equal(p.stored(key).practices.leaving, 8);
});

test('an old history longer than seven remains intact on review', () => {
  const days = Array.from({length: 10}, (_, index) => '2026-11-' + String(index + 1).padStart(2, '0'));
  const p = page({seed: {[key]: {ritualDays: {leaving: days}}}});
  const result = p.api.complete('leaving');
  assert.equal(result.awarded, false);
  assert.equal(result.snapshot.count, 7);
  assert.deepEqual(p.stored(key).ritualDays.leaving, days);
});

test('Paris midnight and both DST changes determine dates independently from the host clock', () => {
  const p = page();
  for (const [instant, expected] of [
    ['2026-11-26T22:59:59Z', '2026-11-26'], ['2026-11-26T23:00:00Z', '2026-11-27'],
    ['2026-06-01T21:59:59Z', '2026-06-01'], ['2026-06-01T22:00:00Z', '2026-06-02'],
    ['2026-03-29T00:59:59Z', '2026-03-29'], ['2026-03-29T01:00:00Z', '2026-03-29'],
    ['2026-10-25T00:59:59Z', '2026-10-25'], ['2026-10-25T01:00:00Z', '2026-10-25']
  ]) assert.equal(p.api.dayKey(new Date(instant)), expected);
  assert.equal(p.api.weekAt(new Date('2026-11-29T22:59:59Z')), Date.UTC(2026, 10, 23));
  assert.equal(p.api.weekAt(new Date('2026-11-29T23:00:00Z')), Date.UTC(2026, 10, 30));
  p.setTime('2026-11-26T22:59:59Z');
  p.api.complete('leaving');
  p.setTime('2026-11-26T23:00:00Z');
  assert.equal(p.api.read('leaving').day, 2);
  assert.equal(p.api.complete('leaving').awarded, true);
  assert.deepEqual(p.stored(key).ritualDays.leaving, ['2026-11-26', '2026-11-27']);
});

test('confidence is reversible and overrides an old learned badge without deleting it', () => {
  const p = page({seed: {[key]: {learned: ['sleep', 'leaving'], confidence: {morning: 'help'}}}});
  assert.equal(p.api.read('leaving').confidence, 'alone');
  let result = p.api.setConfidence('leaving', 'help');
  assert.equal(result.saved, true);
  assert.equal(result.snapshot.confidence, 'help');
  assert.equal(page({local: p.local}).api.read('leaving').confidence, 'help');
  result = p.api.setConfidence('leaving', 'alone');
  assert.equal(result.snapshot.confidence, 'alone');
  assert.deepEqual(p.stored(key).learned, ['sleep', 'leaving']);
  assert.equal(p.stored(key).confidence.morning, 'help');
  assert.equal(p.api.setConfidence('leaving', 'automatic-mastery').saved, false);
});

test('reload and child/guest scopes restore only their own progress, and stale screens cannot save', () => {
  const a = page();
  a.api.complete('leaving');
  const again = page({local: a.local});
  assert.equal(again.api.read('leaving').count, 1);
  const b = page({local: a.local, child: 'nour'});
  assert.equal(b.api.read('leaving').count, 0);
  assert.equal(a.api.complete('leaving').saved, false);
  assert.equal(a.api.setConfidence('leaving', 'alone').saved, false);
  assert.equal(b.stored(key), null);
  const guest = page({local: a.local, child: 'nour', guest: true});
  guest.api.complete('leaving');
  assert.equal(guest.api.read('leaving').count, 1);
  assert.equal(page({local: a.local, child: 'nour'}).api.read('leaving').count, 0);
  assert.equal(page({local: a.local}).api.read('leaving').count, 1);
});

test('fresh remote edits survive the next save, and failed storage never reports an earned star', () => {
  const p = page();
  const remote = {ritualDays: {leaving: ['2026-11-25']}, learned: ['sleep'], extra: {remote: true}};
  p.storage.applyRemote(key, remote);
  assert.equal(p.api.complete('leaving').snapshot.count, 2);
  assert.deepEqual(p.stored(key).extra, {remote: true});
  p.setTime('2026-11-27T12:00:00Z');
  const before = p.storage.getItem(key);
  p.storage.setItem = () => { throw new Error('Quota exceeded'); };
  const result = p.api.complete('leaving');
  assert.equal(result.saved, false);
  assert.equal(result.awarded, false);
  assert.equal(result.snapshot.count, 2);
  assert.equal(result.snapshot.todayDone, false);
  assert.equal(p.api.setConfidence('leaving', 'alone').saved, false);
  assert.equal(p.storage.getItem(key), before);
});

test('unreadable saved data is not overwritten by a new empty course', () => {
  const p = page();
  p.storage.setItem(key, '{unfinished');
  assert.equal(p.api.read('leaving').count, 0);
  assert.equal(p.api.complete('leaving').saved, false);
  assert.equal(p.api.setConfidence('leaving', 'help').saved, false);
  assert.equal(p.storage.getItem(key), '{unfinished');
});
