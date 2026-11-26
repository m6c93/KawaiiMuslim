(() => {
  'use strict';

  // A personal course belongs to the invocation, not to the calendar week.
  // Keep this inside the existing per-child, cloud-supported activity record.
  const key = 'kmw-weekly-dua-preview-v1';
  const legacyKey = 'kmw-dua-sleep-ritual-v1';
  const progress = window.KMActivityProgress;
  const storage = progress?.storage;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const object = value => isObject(value) ? value : {};
  const validId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(id) &&
    id !== 'constructor' && id !== 'prototype';
  const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  const current = () => !!storage && progress.isCurrent?.() !== false;
  const paris = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
  });

  function dayKey(date = new Date()) {
    const parts = paris.formatToParts(date);
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  }

  function weekAt(date = new Date()) {
    const start = Date.parse(dayKey(date) + 'T00:00:00Z');
    return start - ((new Date(start).getUTCDay() + 6) % 7) * 86400000;
  }

  function validDays(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(day => {
      if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
      const parsed = new Date(day + 'T00:00:00Z');
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
    }))].sort();
  }

  function load(id) {
    let record = {}, legacy = [], readable = !!storage;
    try { record = object(JSON.parse(storage?.getItem(key) || '{}')); }
    catch { readable = false; }
    // Read the old bedtime history without replacing it or assigning it to a new invocation.
    if (id === 'sleep') {
      try { legacy = validDays(JSON.parse(storage?.getItem(legacyKey) || '[]')); }
      catch { readable = false; }
    }
    return {record, legacy, readable};
  }

  function snapshot(id, date, record, legacy = []) {
    const days = validDays([...(Array.isArray(record.ritualDays?.[id]) ? record.ritualDays[id] : []), ...legacy]);
    const total = Math.min(days.length, 7);
    const todayDone = days.includes(dayKey(date));
    const preference = record.confidence?.[id];
    const confidence = preference === 'help' || preference === 'alone' ? preference :
      (Array.isArray(record.learned) && record.learned.includes(id) ? 'alone' : null);
    return {
      days, count: total, day: Math.min(7, Math.max(1, total + (todayDone ? 0 : 1))),
      todayDone, complete: total >= 7, confidence
    };
  }

  function read(id, date = new Date()) {
    const state = validId(id) ? load(id) : {record: {}, legacy: []};
    return snapshot(id, date, state.record, state.legacy);
  }

  function complete(id, {source = 'guided', date = new Date()} = {}) {
    const state = load(id);
    const before = snapshot(id, date, state.record, state.legacy);
    const failed = () => ({saved: false, awarded: false, snapshot: before});
    if (!validId(id) || !state.readable || !current() || !['guided', 'outside'].includes(source)) return failed();

    const awarded = !before.complete && !before.todayDone;
    // A second self-confirmation on the same day is a successful no-op.
    if (!awarded && source === 'outside') return {saved: true, awarded: false, snapshot: before};

    const days = awarded ? validDays([...before.days, dayKey(date)]) : before.days;
    const record = {
      ...state.record,
      ritualDays: {...object(state.record.ritualDays), [id]: days}
    };
    if (source === 'guided') {
      const practices = object(record.practices);
      record.practices = {...practices, [id]: count(practices[id]) + 1};
      const sessions = object(record.weeklySessions);
      const weeks = object(sessions[id]);
      const week = weekAt(date);
      const entry = object(weeks[week]);
      // The existing synchronizer merges concurrent counters named "tries".
      record.weeklySessions = {...sessions, [id]: {...weeks, [week]: {...entry, tries: count(entry.tries) + 1}}};
    }

    try {
      storage.setItem(key, JSON.stringify(record));
      if (!current()) return failed();
    } catch { return failed(); }
    return {saved: true, awarded, snapshot: snapshot(id, date, record, state.legacy)};
  }

  function setConfidence(id, value) {
    const date = new Date();
    const state = load(id);
    const before = snapshot(id, date, state.record, state.legacy);
    const failed = () => ({saved: false, snapshot: before});
    if (!validId(id) || !['help', 'alone'].includes(value) || !state.readable || !current()) return failed();
    const record = {...state.record, confidence: {...object(state.record.confidence), [id]: value}};
    try {
      storage.setItem(key, JSON.stringify(record));
      if (!current()) return failed();
    } catch { return failed(); }
    return {saved: true, snapshot: snapshot(id, date, record, state.legacy)};
  }

  window.KMDuaProgress = {key, legacyKey, dayKey, weekAt, read, complete, setConfidence};
})();
