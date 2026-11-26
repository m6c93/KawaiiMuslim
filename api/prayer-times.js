'use strict';

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const REQUEST_KEYS = new Set(['date', 'city', 'cityId', 'latitude', 'longitude']);
const GMP_CALENDAR = require('../data/prayer-gmp-2026-11.json');
const FRENCH_CITIES = require('../data/prayer-fr-cities.json');
const officialCalendar = require('../lib/prayer-gmp-calendar.js');
const CITIES_BY_ID = new Map(FRENCH_CITIES.cities.map(city => ['fr:' + city[0], city]));
const GMP_DEPARTMENTS = new Set(['75', '92', '93', '94']);
const GMP_CENTRES = FRENCH_CITIES.cities.filter(city => GMP_DEPARTMENTS.has(city[2]));
const CALCULATED_SOURCE = {
  id: 'aladhan-mwl',
  label: 'Horaires calculés · Ligue islamique mondiale',
  url: 'https://aladhan.com/calculation-methods'
};

function normalizeCity(value) {
  return value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte');
}

const CITIES_BY_NAME = new Map();
const CITIES_BY_LABEL = new Map();
for (const city of FRENCH_CITIES.cities) {
  const name = normalizeCity(city[1]);
  if (!CITIES_BY_NAME.has(name)) CITIES_BY_NAME.set(name, []);
  CITIES_BY_NAME.get(name).push(city);
  CITIES_BY_LABEL.set(normalizeCity(city[1] + ' · ' + FRENCH_CITIES.departments[city[2]]
    + ' (' + city[2] + '), France'), city);
}

// Migrate older, free-text preferences only when the commune is certain.
// A shared name such as Saint-Denis still requires the user's explicit choice.
function resolveFrenchCity(value) {
  let name = normalizeCity(value);
  const labelled = CITIES_BY_LABEL.get(name);
  if (labelled) return [labelled];
  name = name.replace(/(?:^| )(?:france|fr)$/, '').trim();
  const codeMatch = name.match(/(?:^| )(\d{2}|\d{5})$/);
  const code = codeMatch ? codeMatch[1] : '';
  if (codeMatch) name = name.slice(0, codeMatch.index).trim();
  const candidates = name ? (CITIES_BY_NAME.get(name) || []) : code ? FRENCH_CITIES.cities : [];
  return code ? candidates.filter(city => code.length === 2 ? city[2] === code : city[6].includes(code)) : candidates;
}

function isSameOrigin(headers) {
  const site = headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false;
  // A native request may omit Origin and Fetch Metadata.
  if (headers.origin === undefined) return true;
  if (typeof headers.origin !== 'string' || typeof headers.host !== 'string') return false;
  if (headers.origin.length > 512 || headers.host.length > 255) return false;
  try {
    const origin = new URL(headers.origin);
    const target = new URL('https://' + headers.host);
    return headers.origin === origin.origin && origin.protocol === 'https:'
      && !target.username && !target.password && target.pathname === '/' && !target.search && !target.hash
      && origin.origin === target.origin;
  } catch { return false; }
}

function readRequest(body) {
  if (typeof body === 'string') {
    if (body.length > 2048) return null;
    try { body = JSON.parse(body); } catch { return null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !REQUEST_KEYS.has(key))) return null;
  if (typeof body.date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(body.date)) return null;
  const parsed = new Date(body.date + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.date) return null;

  const hasCity = Object.hasOwn(body, 'city');
  const hasCityId = Object.hasOwn(body, 'cityId');
  const hasLatitude = Object.hasOwn(body, 'latitude');
  const hasLongitude = Object.hasOwn(body, 'longitude');
  const date = body.date.split('-').reverse().join('-');
  if (hasCity) {
    if (hasCityId || hasLatitude || hasLongitude || typeof body.city !== 'string' || body.city.length > 1024) return null;
    const city = body.city.normalize('NFC').trim();
    if (!city || [...city].length > 160 || /[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(city)) return null;
    return { date, isoDate: body.date, city };
  }
  if (!hasLatitude || !hasLongitude || typeof body.latitude !== 'number' || typeof body.longitude !== 'number'
    || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)
    || Math.abs(body.latitude) > 90 || Math.abs(body.longitude) > 180) return null;
  if (hasCityId) {
    if (typeof body.cityId !== 'string') return null;
    const city = CITIES_BY_ID.get(body.cityId);
    if (!city) return null;
    // A chosen commune is identified by the catalogue, never by untrusted
    // coordinates supplied alongside its ID (which may also be stale).
    return { date, isoDate: body.date, cityId: body.cityId, department: city[2], latitude: city[4], longitude: city[3] };
  }
  return { date, isoDate: body.date, latitude: body.latitude, longitude: body.longitude };
}

function withinThreeKilometres(latitude, longitude, city) {
  const radians = Math.PI / 180;
  const dLatitude = (city[4] - latitude) * radians;
  const dLongitude = (city[3] - longitude) * radians;
  const a = Math.sin(dLatitude / 2) ** 2
    + Math.cos(latitude * radians) * Math.cos(city[4] * radians) * Math.sin(dLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) <= 3;
}

function usesParisCalendar(input) {
  if (input.city !== undefined) return false;
  return input.cityId
    ? GMP_DEPARTMENTS.has(input.department)
    : GMP_CENTRES.some(city => withinThreeKilometres(input.latitude, input.longitude, city));
}

function publishedTimings(input) {
  if (input.isoDate < GMP_CALENDAR.source.validFrom || input.isoDate > GMP_CALENDAR.source.validUntil) return null;
  const row = GMP_CALENDAR.days[input.isoDate];
  if (!row || !usesParisCalendar(input)) return null;
  const timings = Object.fromEntries(PRAYERS.map(key => [key, row[GMP_CALENDAR.columns.indexOf(key)]]));
  const { id, label, url, validUntil } = GMP_CALENDAR.source;
  return {
    timings,
    meta: { timezone: GMP_CALENDAR.timezone, source: { id, label, url, validUntil } },
    date: { gregorian: { date: input.date } }
  };
}

function validatedData(payload, date) {
  const data = payload && Number(payload.code) === 200 && payload.data;
  if (!data || data.date?.gregorian?.date !== date) return null;
  const timezone = data.meta?.timezone;
  if (typeof timezone !== 'string' || !timezone || timezone.length > 80) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { return null; }
  const timings = {};
  for (const key of PRAYERS) {
    const value = data.timings?.[key];
    if (typeof value !== 'string') return null;
    const match = value.match(/^(\d{1,2}):(\d{2})(?:\s+\([A-Za-z0-9+:\- ]{1,16}\))?$/);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    timings[key] = match[1].padStart(2, '0') + ':' + match[2];
  }
  // Do not expose the provider's coordinates, address or additional metadata.
  return { timings, meta: { timezone, source: { ...CALCULATED_SOURCE } }, date: { gregorian: { date } } };
}

function addressNotFound(payload) {
  if (Number(payload?.code) !== 400) return false;
  const message = typeof payload.data === 'string' ? payload.data.trim().toLowerCase().replace(/\.$/, '') : '';
  // Geocoding outages or exhausted provider quotas are not invalid cities.
  return ['address not found', 'invalid address', 'please specify a valid address'].includes(message);
}

module.exports = async function prayerTimes(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const fail = (code, error) => res.status(code).json({ code, error });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(405, 'method_not_allowed');
  }
  const headers = req.headers || {};
  if (!isSameOrigin(headers)) return fail(403, 'origin_not_allowed');
  if (typeof headers['content-type'] !== 'string'
    || !/^application\/json(?:\s*;|\s*$)/i.test(headers['content-type'])) return fail(400, 'invalid_request');
  const input = readRequest(req.body);
  if (!input) return fail(400, 'invalid_request');
  if (input.city !== undefined) {
    const matches = resolveFrenchCity(input.city);
    if (matches.length > 1) return fail(422, 'location_ambiguous');
    if (matches.length === 1) {
      const city = matches[0];
      delete input.city;
      Object.assign(input, { cityId: 'fr:' + city[0], department: city[2], latitude: city[4], longitude: city[3] });
    }
  }
  const published = publishedTimings(input);
  if (published) return res.status(200).json({ code: 200, data: published });
  if (usesParisCalendar(input)) {
    // The official source publishes monthly images, not a public timings API.
    // Show its current poster after the verified transcription ends, rather than
    // silently replacing the requested mosque with an unrelated calculation.
    const calendar = await officialCalendar(input.isoDate);
    return res.status(200).json({ code: 200, data: {
      presentation: 'official-calendar', calendar,
      meta: { timezone: 'Europe/Paris', source: {
        id: 'gmp-calendar', label: 'Grande Mosquée de Paris · calendrier officiel',
        url: GMP_CALENDAR.source.url, ...(calendar ? { validUntil: calendar.validUntil } : {})
      } },
      date: { gregorian: { date: input.date } }
    } });
  }

  const manual = input.city !== undefined;
  const url = new URL('https://api.aladhan.com/v1/' + (manual ? 'timingsByAddress/' : 'timings/') + input.date);
  url.searchParams.set('method', '3');
  if (manual) url.searchParams.set('address', input.city);
  else {
    url.searchParams.set('latitude', String(input.latitude));
    url.searchParams.set('longitude', String(input.longitude));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    // Only the confirmed location and date are sent to the existing provider.
    // No request headers, cookies, credentials or visitor IP are forwarded.
    const response = await fetch(url.href, {
      headers: { Accept: 'application/json' },
      signal: controller.signal, redirect: 'error', cache: 'no-store'
    });
    const payload = await response.json();
    if (manual && addressNotFound(payload)) return fail(422, 'location_not_found');
    if (!response.ok) return fail(502, 'timings_unavailable');
    const data = validatedData(payload, input.date);
    if (!data) return fail(502, 'timings_unavailable');
    return res.status(200).json({ code: 200, data });
  } catch {
    return fail(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'timings_timeout' : 'timings_unavailable');
  } finally {
    clearTimeout(timeout);
  }
};
